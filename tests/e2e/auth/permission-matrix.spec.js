import { test, expect } from '@playwright/test';
import http from 'http';
import { randomUUID } from 'crypto';

/**
 * End-to-end permission matrix for capability-based authorization.
 *
 * Creates real accounts, missions and layers through the public APIs, grants
 * roles through /api/access, and checks each role against the routes it should
 * and should not reach: mission isolation, layer-subtree editing, site-wide
 * operations, groups, live revocation, the last-SuperAdmin rule and scoped
 * long-term tokens.
 *
 * Runs only when SITE_ACCESS=required with the local provider.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
const RUN = Date.now().toString(36);
const MISSION_A = `PermA_${RUN}`;
const MISSION_B = `PermB_${RUN}`;
const MISSION_C = `PermC_${RUN}`;
const FOLDER = randomUUID();
const CHILD = randomUUID();
const SIBLING = randomUUID();
const ADMIN = { username: 'test_admin', password: ['Test', 'Admin', '1!'].join('') };
const PASSWORD = ['Matrix', 'Pass', '1!'].join('');
const NAMES = ['sa2', 'madmin', 'ledit', 'viewer', 'plain', 'dadmin', 'grouped'];

// Each login uses its own loopback source address so the per-IP login limiter
// never trips while the matrix signs in many accounts.
let nextAddress = 10;
function freshAddress() {
  const n = nextAddress++;
  return `127.1.${Math.floor(n / 250)}.${(n % 250) + 2}`;
}

function api(who, method, url, body, { bearer, localAddress, withSession } = {}) {
  const target = new URL(baseURL + url);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        // An IPv4 local address can't reach localhost if it resolves to ::1
        hostname: localAddress && target.hostname === 'localhost' ? '127.0.0.1' : target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        localAddress,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(who && who.cookie && (!bearer || withSession) ? { Cookie: who.cookie } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      },
      (res) => {
        const setCookie = res.headers['set-cookie'] || [];
        if (who && setCookie.length) who.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (text += d));
        res.on('error', reject);
        res.on('aborted', () => reject(new Error(`${method} ${url}: response aborted`)));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (err) {}
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`${method} ${url}: timed out`)));
    if (payload) req.write(payload);
    req.end();
  });
}

const ok = (r) => r.status === 200 && r.json && r.json.status === 'success';
// Config reads return the raw config object (no status field)
const readable = (r) => r.status === 200 && r.json != null && r.json.status !== 'failure';
const denied = (r) =>
  r.status === 403 ||
  r.status === 401 ||
  (r.json && r.json.status === 'failure' && /unauthori|permission|not allowed/i.test(r.json.message || '')) ||
  (r.json == null && /<html/i.test(r.text));

async function login(username, password) {
  const who = { username };
  const r = await api(who, 'POST', '/api/users/login', { username, password }, { localAddress: freshAddress() });
  expect(ok(r), `login ${username}: ${r.text.slice(0, 200)}`).toBe(true);
  return who;
}

const admin = {};
const users = {};
const ids = {};

async function grant(actor, subject_type, subject_id, role, scope_type, mission, layer_uuid) {
  const r = await api(actor, 'POST', '/api/access/bindings/add', {
    subject_type,
    subject_id,
    role,
    scope_type,
    mission,
    layer_uuid,
  });
  expect(ok(r), `grant ${role}@${scope_type} to ${subject_type}:${subject_id}: ${r.text.slice(0, 200)}`).toBe(true);
  return r.json.body;
}

async function bindingsOf(userId) {
  const r = await api(admin, 'GET', `/api/access/bindings?subject_type=user&subject_id=${userId}`);
  expect(ok(r)).toBe(true);
  return r.json.body;
}

const initialView = (who, mission, opts) =>
  api(who, 'POST', '/api/configure/updateInitialView', { mission, latitude: 1, longitude: 2, zoom: 3 }, opts);
const updateLayer = (who, mission, uuid, opts) =>
  api(
    who,
    'POST',
    '/api/configure/updateLayer',
    { mission, layerUUID: uuid, layer: { description: `edited ${Date.now()}` } },
    opts
  );
const getConfig = (who, mission, opts) =>
  api(who, 'GET', `/api/configure/get?mission=${encodeURIComponent(mission)}`, null, opts);

test.describe.serial('Permission matrix', () => {
  test.skip(process.env.MMGIS_TEST_SITE_ACCESS !== 'required', 'SKIP: needs SITE_ACCESS=required');

  test.beforeAll(async () => {
    const r = await api(admin, 'POST', '/api/users/login', ADMIN, { localAddress: freshAddress() });
    expect(ok(r), `admin login: ${r.text.slice(0, 200)}`).toBe(true);

    for (const m of [MISSION_A, MISSION_B])
      expect(ok(await api(admin, 'POST', '/api/configure/add', { mission: m }))).toBe(true);
    const add = await api(admin, 'POST', '/api/configure/addLayer', {
      mission: MISSION_A,
      layer: {
        name: 'Folder',
        uuid: FOLDER,
        type: 'header',
        sublayers: [{ name: 'Child', uuid: CHILD, type: 'header', sublayers: [] }],
      },
    });
    expect(ok(add), `addLayer folder: ${add.text.slice(0, 300)}`).toBe(true);
    const sib = await api(admin, 'POST', '/api/configure/addLayer', {
      mission: MISSION_A,
      layer: { name: 'Sibling', uuid: SIBLING, type: 'header', sublayers: [] },
    });
    expect(ok(sib), `addLayer sibling: ${sib.text.slice(0, 300)}`).toBe(true);

    for (const n of NAMES) {
      const s = await api(admin, 'POST', '/api/users/signup', {
        username: `${n}_${RUN}`,
        password: PASSWORD,
        skipLogin: true,
      });
      expect(ok(s), `signup ${n}: ${s.text.slice(0, 200)}`).toBe(true);
    }
    const entries = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries;
    for (const n of NAMES) ids[n] = entries.find((e) => e.username === `${n}_${RUN}`).id;
    ids.admin = entries.find((e) => e.username === ADMIN.username).id;

    // New accounts start with only what the site grants everyone
    for (const n of NAMES)
      for (const b of await bindingsOf(ids[n]))
        expect(['viewer'], `${n} default binding`).toContain(b.role);

    await grant(admin, 'user', ids.sa2, 'superadmin', 'global');
    await grant(admin, 'user', ids.madmin, 'mission_admin', 'mission', MISSION_A);
    await grant(admin, 'user', ids.ledit, 'layer_editor', 'layer', MISSION_A, FOLDER);
    await grant(admin, 'user', ids.viewer, 'viewer', 'mission', MISSION_A);
    await grant(admin, 'user', ids.dadmin, 'data_admin', 'global');

    // Strict mission isolation: strip site-wide viewing from scoped users
    for (const n of ['madmin', 'ledit', 'viewer', 'plain', 'dadmin', 'grouped'])
      for (const b of await bindingsOf(ids[n]))
        if (b.role === 'viewer' && b.scope_type === 'global')
          expect(ok(await api(admin, 'POST', '/api/access/bindings/remove', { id: b.id }))).toBe(true);

    for (const n of NAMES) users[n] = await login(`${n}_${RUN}`, PASSWORD);
  });

  test.afterAll(async () => {
    if (!admin.cookie) return;
    for (const m of [MISSION_A, MISSION_B])
      await api(admin, 'POST', '/api/configure/destroy', { mission: m });
    for (const n of NAMES) if (ids[n]) await api(admin, 'DELETE', `/api/accounts/remove/${ids[n]}`);
  });

  test('dataset listings only name layers in missions the caller can view', async () => {
    const name = `pm_gds_${RUN}`;
    const made = await api(admin, 'POST', '/api/geodatasets/recreate', {
      name,
      geojson: JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { a: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } }],
      }),
    });
    expect(ok(made), made.text.slice(0, 300)).toBe(true);
    try {
      const layer = await api(admin, 'POST', '/api/configure/addLayer', {
        mission: MISSION_B,
        layer: { name: 'Uses geodataset', uuid: randomUUID(), type: 'vector', url: `geodatasets:${name}` },
      });
      expect(ok(layer), layer.text.slice(0, 300)).toBe(true);
      const occurrences = async (who, route, entryName) => {
        const r = await api(who, 'POST', route, {});
        expect(ok(r), r.text.slice(0, 300)).toBe(true);
        const entries = r.json.body.entries || [];
        const entry = entryName ? entries.find((e) => e.name === entryName) : entries[0];
        return entry ? Object.keys(entry.occurrences || {}) : [];
      };
      expect(await occurrences(admin, '/api/geodatasets/entries', name)).toContain(MISSION_B);
      for (const who of [users.viewer, users.plain]) {
        expect(await occurrences(who, '/api/geodatasets/entries', name)).not.toContain(MISSION_B);
        expect(await occurrences(who, '/api/datasets/entries')).not.toContain(MISSION_B);
      }
      // Every mission with layers gets an occurrences key (possibly empty), so the viewer's own mission stays listed
      expect(await occurrences(users.viewer, '/api/geodatasets/entries', name)).toContain(MISSION_A);
    } finally {
      await api(admin, 'DELETE', `/api/geodatasets/remove/${name}`);
    }
  });

  test('mission lists only include viewable missions', async () => {
    const list = async (who) => (await api(who, 'GET', '/api/configure/missions')).json.missions || [];
    expect(await list(admin)).toEqual(expect.arrayContaining([MISSION_A, MISSION_B]));
    expect(await list(users.sa2)).toEqual(expect.arrayContaining([MISSION_A, MISSION_B]));
    for (const n of ['madmin', 'ledit', 'viewer']) {
      const l = await list(users[n]);
      expect(l, n).toContain(MISSION_A);
      expect(l, n).not.toContain(MISSION_B);
    }
    for (const n of ['plain', 'dadmin']) {
      const l = await list(users[n]);
      expect(l, n).not.toContain(MISSION_A);
      expect(l, n).not.toContain(MISSION_B);
    }
  });

  test('mission configs are readable only inside granted missions', async () => {
    for (const n of ['madmin', 'ledit', 'viewer']) {
      expect(readable(await getConfig(users[n], MISSION_A)), `${n} reads A`).toBe(true);
      expect(denied(await getConfig(users[n], MISSION_B)), `${n} reads B`).toBe(true);
    }
    expect(denied(await getConfig(users.plain, MISSION_A))).toBe(true);
    expect(readable(await getConfig(users.sa2, MISSION_B))).toBe(true);
  });

  test('mission admins edit their own mission config only', async () => {
    expect(ok(await initialView(users.madmin, MISSION_A))).toBe(true);
    expect(denied(await initialView(users.madmin, MISSION_B))).toBe(true);
    expect(ok(await updateLayer(users.madmin, MISSION_A, SIBLING))).toBe(true);
    expect(denied(await updateLayer(users.madmin, MISSION_B, SIBLING))).toBe(true);
  });

  test('layer editors edit their layer subtree only', async () => {
    expect(ok(await updateLayer(users.ledit, MISSION_A, FOLDER))).toBe(true);
    expect(ok(await updateLayer(users.ledit, MISSION_A, CHILD))).toBe(true);
    expect(denied(await updateLayer(users.ledit, MISSION_A, SIBLING))).toBe(true);
    expect(denied(await initialView(users.ledit, MISSION_A))).toBe(true);
    // Moving a layer needs whole-config permission
    const move = await api(users.ledit, 'POST', '/api/configure/updateLayer', {
      mission: MISSION_A,
      layerUUID: CHILD,
      layer: {},
      placement: { index: 0 },
    });
    expect(denied(move)).toBe(true);
    const upsert = await api(users.ledit, 'POST', '/api/configure/upsert', { mission: MISSION_A, config: {} });
    expect(denied(upsert)).toBe(true);
    const perms = (await api(users.ledit, 'GET', '/api/configure/user-permissions')).json;
    expect(perms.capabilities).toContain('mission.layer.edit');
    expect(perms.missions_layer_editing).toContain(MISSION_A);
    expect(perms.missions_managing || []).not.toContain(MISSION_A);
  });

  test('viewers and plain users cannot edit', async () => {
    for (const n of ['viewer', 'plain']) {
      expect(denied(await initialView(users[n], MISSION_A)), n).toBe(true);
      expect(denied(await updateLayer(users[n], MISSION_A, CHILD)), n).toBe(true);
    }
  });

  test('mission admins have no site-wide operations', async () => {
    const who = users.madmin;
    expect(denied(await api(who, 'POST', '/api/configure/add', { mission: `Nope_${RUN}` }))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/configure/clone', { existingMission: MISSION_A, cloneMission: `NopeC_${RUN}` }))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/configure/rename', { mission: MISSION_A, newName: `NopeR_${RUN}` }))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/configure/destroy', { mission: MISSION_A }))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/configure/updateGeneralOptions', {}))).toBe(true);
    expect(denied(await api(who, 'GET', '/api/accounts/entries'))).toBe(true);
    expect(denied(await api(who, 'GET', '/api/webhooks/entries'))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/geodatasets/recreate', {}))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/datasets/recreate', {}))).toBe(true);
    expect(denied(await api(who, 'GET', '/api/access/groups'))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/access/bindings/add', {
      subject_type: 'user', subject_id: ids.madmin, role: 'superadmin', scope_type: 'global',
    }))).toBe(true);
    const list = (await api(who, 'GET', '/api/configure/missions')).json.missions;
    expect(list).not.toContain(`Nope_${RUN}`);
    expect(list).not.toContain(`NopeC_${RUN}`);
    expect(list).not.toContain(`NopeR_${RUN}`);
    expect(list).toContain(MISSION_A);
  });

  test('data admins manage data but not missions or accounts', async () => {
    const who = users.dadmin;
    const r = await api(who, 'POST', '/api/geodatasets/recreate', {});
    expect(denied(r), r.text.slice(0, 200)).toBe(false);
    expect(denied(await api(who, 'POST', '/api/datasets/recreate', {}))).toBe(false);
    expect(denied(await api(who, 'GET', '/api/accounts/entries'))).toBe(true);
    expect(denied(await api(who, 'POST', '/api/configure/add', { mission: `NopeD_${RUN}` }))).toBe(true);
    expect(denied(await initialView(who, MISSION_A))).toBe(true);
  });

  test('plain users cannot write data', async () => {
    expect(denied(await api(users.plain, 'POST', '/api/geodatasets/recreate', {}))).toBe(true);
    expect(denied(await api(users.plain, 'POST', '/api/datasets/upload', {}))).toBe(true);
  });

  test('repointing a group needs every role the group holds', async () => {
    const g = await api(admin, 'POST', '/api/access/groups/create', { name: `admins_${RUN}` });
    expect(ok(g)).toBe(true);
    const gid = g.json.body.id;
    try {
      await grant(admin, 'group', gid, 'data_admin', 'global');
      const gen = await api(admin, 'POST', '/api/longtermtoken/generate', {
        name: `gm_${RUN}`, period: '86400000', scopes: ['groups.manage'],
      });
      expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
      const bearer = gen.json.body.token;
      const update = (who, body, opts) => api(who, 'POST', '/api/access/groups/update', { id: gid, ...body }, opts);
      expect(ok(await update(null, { external_name: `elsewhere_${RUN}` }, { bearer }))).toBe(false);
      expect(ok(await update(null, { description: 'still editable' }, { bearer }))).toBe(true);
      expect(ok(await update(admin, { external_name: `elsewhere_${RUN}` }))).toBe(true);
    } finally {
      await api(admin, 'POST', '/api/access/groups/delete', { id: gid });
    }
  });

  test('setting an account to User removes its editing and data roles', async () => {
    await grant(admin, 'user', ids.grouped, 'layer_editor', 'layer', MISSION_A, CHILD);
    await grant(admin, 'user', ids.grouped, 'data_admin', 'global');
    const roles = async () => (await bindingsOf(ids.grouped)).map((b) => b.role);
    expect(await roles()).toEqual(expect.arrayContaining(['layer_editor', 'data_admin']));
    for (const b of (await bindingsOf(ids.grouped)).filter((x) => ['layer_editor', 'data_admin'].includes(x.role)))
      expect(ok(await api(admin, 'POST', '/api/access/bindings/remove', { id: b.id }))).toBe(true);
    const left = await roles();
    expect(left).not.toContain('layer_editor');
    expect(left).not.toContain('data_admin');
    expect(denied(await api(users.grouped, 'POST', '/api/geodatasets/recreate', {}))).toBe(true);
  });

  test('an account email can be changed and cleared', async () => {
    const mail = `pm_${RUN}@example.org`;
    const emailOf = async () => (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries.find((e) => e.id === ids.viewer).email;
    expect(ok(await api(admin, 'POST', '/api/accounts/update', { id: ids.viewer, email: mail }))).toBe(true);
    expect(await emailOf()).toBe(mail);
    expect(ok(await api(admin, 'POST', '/api/accounts/update', { id: ids.viewer, email: '' }))).toBe(true);
    expect(await emailOf()).toBeNull();
    expect(ok(await api(admin, 'POST', '/api/accounts/update', { id: ids.viewer, email: 'not-an-email' }))).toBe(false);
  });

  test('cloning without a new mission name is refused', async () => {
    const r = await api(admin, 'POST', '/api/configure/clone', { existingMission: MISSION_A });
    expect(ok(r)).toBe(false);
    expect(ok(await api(admin, 'GET', '/api/configure/missions'))).toBe(true);
  });

  test('SuperAdmin is only granted to users, and audiences only to everyone or logged-in users', async () => {
    const g = await api(admin, 'POST', '/api/access/groups/create', { name: `noSA_${RUN}` });
    expect(ok(g)).toBe(true);
    try {
      const add = (body) => api(admin, 'POST', '/api/access/bindings/add', body);
      expect(ok(await add({ subject_type: 'group', subject_id: g.json.body.id, role: 'superadmin', scope_type: 'global' }))).toBe(false);
      expect(ok(await add({ subject_type: 'audience', subject_id: 'anonymous', role: 'viewer', scope_type: 'mission', mission: MISSION_A }))).toBe(false);
      const everyone = await add({ subject_type: 'audience', subject_id: 'everyone', role: 'viewer', scope_type: 'mission', mission: MISSION_A });
      expect(ok(everyone)).toBe(true);
      await api(admin, 'POST', '/api/access/bindings/remove', { id: everyone.json.body.id });
    } finally {
      await api(admin, 'POST', '/api/access/groups/delete', { id: g.json.body.id });
    }
  });

  test('group roles apply to members and stop on removal', async () => {
    const g = await api(admin, 'POST', '/api/access/groups/create', { name: `editorsB_${RUN}` });
    expect(ok(g)).toBe(true);
    const gid = g.json.body.id;
    await grant(admin, 'group', gid, 'mission_admin', 'mission', MISSION_B);
    expect(denied(await initialView(users.grouped, MISSION_B))).toBe(true);
    expect(ok(await api(admin, 'POST', '/api/access/groups/members/add', { group_id: gid, user_id: ids.grouped }))).toBe(true);
    expect(ok(await initialView(users.grouped, MISSION_B))).toBe(true);
    expect(denied(await initialView(users.grouped, MISSION_A))).toBe(true);

    const eff = (await api(admin, 'GET', `/api/access/effective?user_id=${ids.grouped}`)).json.body;
    expect(eff.groups.map((x) => x.id)).toContain(gid);
    expect(eff.missions['mission.config.edit']).toEqual([MISSION_B]);

    expect(ok(await api(admin, 'POST', '/api/access/groups/members/remove', { group_id: gid, user_id: ids.grouped }))).toBe(true);
    expect(denied(await initialView(users.grouped, MISSION_B))).toBe(true);
    expect(ok(await api(admin, 'POST', '/api/access/groups/delete', { id: gid }))).toBe(true);
  });

  test('multiple SuperAdmins, live revocation and the last-SuperAdmin rule', async () => {
    expect(ok(await api(users.sa2, 'GET', '/api/accounts/entries'))).toBe(true);
    const saBinding = (await bindingsOf(ids.sa2)).find((b) => b.role === 'superadmin');
    // A SuperAdmin can grant and revoke for another SuperAdmin
    expect(ok(await api(users.sa2, 'POST', '/api/access/bindings/remove', { id: saBinding.id }))).toBe(true);
    expect(denied(await api(users.sa2, 'GET', '/api/accounts/entries'))).toBe(true);

    // Remaining SuperAdmins now = test_admin (plus any pre-existing ones)
    const sas = (await api(admin, 'GET', '/api/access/bindings?role=superadmin')).json.body.filter(
      (b) => b.role === 'superadmin' && b.subject_type === 'user' && b.scope_type === 'global'
    );
    if (sas.length === 1) {
      const r = await api(admin, 'POST', '/api/access/bindings/remove', { id: sas[0].id });
      expect(r.json.status).toBe('failure');
      expect(r.json.message).toMatch(/at least one SuperAdmin/i);
      expect(ok(await api(admin, 'GET', '/api/accounts/entries'))).toBe(true);
    }
  });

  test('simultaneous SuperAdmin removals always leave one SuperAdmin', async () => {
    const superAdmins = async () =>
      (await api(admin, 'GET', '/api/access/bindings?role=superadmin')).json.body.filter(
        (b) => b.role === 'superadmin' && b.subject_type === 'user' && b.scope_type === 'global'
      );
    await grant(admin, 'user', ids.sa2, 'superadmin', 'global');
    const sas = await superAdmins();
    const holders = new Set(sas.map((b) => String(b.subject_id)));
    test.skip(holders.size !== 2, 'needs exactly two SuperAdmins');
    const mine = sas.find((b) => String(b.subject_id) === String(ids.admin));
    const theirs = sas.find((b) => String(b.subject_id) === String(ids.sa2));
    const [a, b] = await Promise.all([
      api(admin, 'POST', '/api/access/bindings/remove', { id: theirs.id }),
      api(users.sa2, 'POST', '/api/access/bindings/remove', { id: mine.id }),
    ]);
    expect([ok(a), ok(b)].filter(Boolean).length).toBe(1);
    const left = await superAdmins();
    expect(left.length).toBe(1);
    // Put test_admin back as the only SuperAdmin
    if (String(left[0].subject_id) === String(ids.sa2)) {
      await grant(users.sa2, 'user', ids.admin, 'superadmin', 'global');
      expect(ok(await api(admin, 'POST', '/api/access/bindings/remove', { id: left[0].id }))).toBe(true);
    }
    expect(ok(await api(admin, 'GET', '/api/accounts/entries'))).toBe(true);
    expect(denied(await api(users.sa2, 'GET', '/api/accounts/entries'))).toBe(true);
  });

  test('read-only tokens read but never write', async () => {
    const gen = await api(users.madmin, 'POST', '/api/longtermtoken/generate', {
      name: `ro_${RUN}`, period: '86400000', scopes: 'read',
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const token = gen.json.body.token;
    const viaToken0 = await getConfig(null, MISSION_A, { bearer: token });
    expect(readable(viaToken0), viaToken0.text.slice(0, 200)).toBe(true);
    expect(denied(await getConfig(null, MISSION_B, { bearer: token }))).toBe(true);
    expect(denied(await initialView(null, MISSION_A, { bearer: token }))).toBe(true);
    // Tokens cannot mint or manage tokens
    expect(denied(await api(null, 'POST', '/api/longtermtoken/generate', { name: 'x' }, { bearer: token }))).toBe(true);
    expect(denied(await api(null, 'GET', '/api/longtermtoken/get', null, { bearer: token }))).toBe(true);

    // Only a prefix is ever listed again
    const list = (await api(users.madmin, 'GET', '/api/longtermtoken/get')).json.tokens;
    const row = list.find((t) => t.name === `ro_${RUN}`);
    expect(row.token).not.toContain(token);
    expect(token.startsWith(row.token.replace(/\.\.\.$/, ''))).toBe(true);

    expect(ok(await api(users.madmin, 'POST', '/api/longtermtoken/clear', { id: row.id }))).toBe(true);
    expect(readable(await getConfig(null, MISSION_A, { bearer: token }))).toBe(false);
  });

  test('ordinary users only get read-only tokens', async () => {
    const write = await api(users.plain, 'POST', '/api/longtermtoken/generate', {
      name: `w_${RUN}`, period: '86400000', scopes: ['mission.config.edit'],
    });
    expect(ok(write)).toBe(false);
    const read = await api(users.plain, 'POST', '/api/longtermtoken/generate', {
      name: `r_${RUN}`, period: '86400000',
    });
    expect(ok(read), read.text.slice(0, 200)).toBe(true);
    const row = (await api(users.plain, 'GET', '/api/longtermtoken/get')).json.tokens.find((t) => t.name === `r_${RUN}`);
    expect(row.scopes.every((s) => /\.(read|view)$/.test(s))).toBe(true);
    // Another user cannot revoke it
    expect(ok(await api(users.viewer, 'POST', '/api/longtermtoken/clear', { id: row.id }))).toBe(false);
    expect(ok(await api(users.plain, 'POST', '/api/longtermtoken/clear', { id: row.id }))).toBe(true);
  });

  test('write tokens are limited to their missions and to the creator\'s live access', async () => {
    const gen = await api(users.madmin, 'POST', '/api/longtermtoken/generate', {
      name: `rw_${RUN}`, period: '86400000', scopes: null, missions: [MISSION_A],
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const token = gen.json.body.token;
    // Cannot ask for missions the creator cannot reach
    const wider = await api(users.madmin, 'POST', '/api/longtermtoken/generate', {
      name: `rwB_${RUN}`, period: '86400000', scopes: null, missions: [MISSION_B],
    });
    expect(ok(wider)).toBe(false);
    // A single mission name instead of a list is refused, not ignored
    const unlisted = await api(users.madmin, 'POST', '/api/longtermtoken/generate', {
      name: `rwS_${RUN}`, period: '86400000', scopes: null, missions: MISSION_A,
    });
    expect(ok(unlisted)).toBe(false);

    expect(ok(await initialView(null, MISSION_A, { bearer: token }))).toBe(true);
    expect(denied(await initialView(null, MISSION_B, { bearer: token }))).toBe(true);
    expect(denied(await api(null, 'GET', '/api/accounts/entries', null, { bearer: token }))).toBe(true);

    // Demoting the creator immediately narrows the token
    const b = (await bindingsOf(ids.madmin)).find((x) => x.role === 'mission_admin');
    expect(ok(await api(admin, 'POST', '/api/access/bindings/remove', { id: b.id }))).toBe(true);
    expect(denied(await initialView(null, MISSION_A, { bearer: token }))).toBe(true);
    expect(denied(await initialView(users.madmin, MISSION_A))).toBe(true);
    await grant(admin, 'user', ids.madmin, 'mission_admin', 'mission', MISSION_A);
    expect(ok(await initialView(null, MISSION_A, { bearer: token }))).toBe(true);
  });

  test('expired tokens are rejected', async () => {
    const gen = await api(users.viewer, 'POST', '/api/longtermtoken/generate', {
      name: `exp_${RUN}`, period: '1500',
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const token = gen.json.body.token;
    const viaToken1 = await getConfig(null, MISSION_A, { bearer: token });
    expect(readable(viaToken1), viaToken1.text.slice(0, 200)).toBe(true);
    await new Promise((r) => setTimeout(r, 2500));
    expect(readable(await getConfig(null, MISSION_A, { bearer: token }))).toBe(false);
  });

  test('a rejected account update changes nothing', async () => {
    const before = (await bindingsOf(ids.madmin)).map((b) => b.id).sort();
    const r = await api(admin, 'POST', '/api/accounts/update', {
      id: ids.madmin,
      email: `changed_${RUN}@example.test`,
      viewing: [`Missing_${RUN}`],
    });
    expect(ok(r)).toBe(false);
    expect((await bindingsOf(ids.madmin)).map((b) => b.id).sort()).toEqual(before);
    const entry = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries.find((e) => e.id === ids.madmin);
    expect(entry.email).not.toBe(`changed_${RUN}@example.test`);
    expect(ok(await initialView(users.madmin, MISSION_A))).toBe(true);
  });

  test('an update rejected for a duplicate email changes nothing', async () => {
    const taken = `taken_${RUN}@example.test`;
    expect(ok(await api(admin, 'POST', '/api/accounts/update', { id: ids.viewer, email: taken }))).toBe(true);
    const before = (await bindingsOf(ids.madmin)).map((b) => b.id).sort();
    const r = await api(admin, 'POST', '/api/accounts/update', { id: ids.madmin, email: taken, viewing: [] });
    expect(ok(r)).toBe(false);
    expect((await bindingsOf(ids.madmin)).map((b) => b.id).sort()).toEqual(before);
    expect(ok(await initialView(users.madmin, MISSION_A))).toBe(true);
  });

  test('a bearer token keeps its limits when sent with a session', async () => {
    const gen = await api(users.madmin, 'POST', '/api/longtermtoken/generate', {
      name: `ros_${RUN}`, period: '86400000', scopes: 'read',
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const token = gen.json.body.token;
    expect(ok(await initialView(users.madmin, MISSION_A))).toBe(true);
    expect(denied(await initialView(users.madmin, MISSION_A, { bearer: token, withSession: true }))).toBe(true);
    expect(denied(await initialView(users.madmin, MISSION_A, { bearer: 'not-a-token', withSession: true }))).toBe(true);
    const row = (await api(users.madmin, 'GET', '/api/longtermtoken/get')).json.tokens.find((t) => t.name === `ros_${RUN}`);
    expect(ok(await api(users.madmin, 'POST', '/api/longtermtoken/clear', { id: row.id }))).toBe(true);
  });

  test('mission-limited tokens cannot use site-wide capabilities', async () => {
    const gen = await api(admin, 'POST', '/api/longtermtoken/generate', {
      name: `sam_${RUN}`, period: '86400000', scopes: null, missions: [MISSION_A],
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const token = gen.json.body.token;
    expect(ok(await initialView(null, MISSION_A, { bearer: token }))).toBe(true);
    expect(denied(await initialView(null, MISSION_B, { bearer: token }))).toBe(true);
    expect(denied(await api(null, 'POST', '/api/configure/add', { mission: `NopeT_${RUN}` }, { bearer: token }))).toBe(true);
    expect(denied(await api(null, 'GET', '/api/accounts/entries', null, { bearer: token }))).toBe(true);
    expect((await api(admin, 'GET', '/api/configure/missions')).json.missions).not.toContain(`NopeT_${RUN}`);
    const row = (await api(admin, 'GET', '/api/longtermtoken/get')).json.tokens.find((t) => t.name === `sam_${RUN}`);
    expect(ok(await api(admin, 'POST', '/api/longtermtoken/clear', { id: row.id }))).toBe(true);
  });

  test('renaming a mission keeps account mission lists current', async () => {
    const renamed = `${MISSION_C}_r`;
    expect(ok(await api(admin, 'POST', '/api/configure/add', { mission: MISSION_C }))).toBe(true);
    await grant(admin, 'user', ids.madmin, 'mission_admin', 'mission', MISSION_C);
    const rn = await api(admin, 'POST', '/api/configure/rename', { mission: MISSION_C, newName: renamed });
    expect(ok(rn), rn.text.slice(0, 200)).toBe(true);
    const managing = (await bindingsOf(ids.madmin)).filter((b) => b.role === 'mission_admin').map((b) => b.mission);
    expect(managing).toEqual(expect.arrayContaining([MISSION_A, renamed]));
    expect(managing).not.toContain(MISSION_C);
    expect(ok(await initialView(users.madmin, renamed))).toBe(true);
    expect(ok(await initialView(users.madmin, MISSION_A))).toBe(true);
    await api(admin, 'POST', '/api/configure/destroy', { mission: renamed });
  });

  test('anonymous requests are denied on a required site', async () => {
    expect(readable(await getConfig(null, MISSION_A))).toBe(false);
    expect(denied(await api(null, 'GET', '/api/accounts/entries'))).toBe(true);
    expect(denied(await initialView(null, MISSION_A))).toBe(true);
  });

  test('a drawing file is only readable by those who can view its mission', async () => {
    const make = async (mission) => {
      const r = await api(admin, 'POST', '/api/files/make', { file_name: `draw_${RUN}`, intent: 'all', mission });
      expect(ok(r), `make in ${mission}: ${r.text.slice(0, 200)}`).toBe(true);
      return r.json.body.file_id;
    };
    const inA = await make(MISSION_A);
    const inB = await make(MISSION_B);
    const get = (who, id) => api(who, 'POST', '/api/files/getfile', { id: JSON.stringify(id) });
    try {
      expect(ok(await get(users.viewer, inA))).toBe(true);
      expect(ok(await get(users.viewer, inB))).toBe(false);
      expect(ok(await get(users.viewer, [inA, inB]))).toBe(false);
      expect(ok(await get(users.madmin, inB))).toBe(false);
      expect(ok(await get(admin, inB))).toBe(true);
      expect(ok(await get(users.sa2, [inA, inB]))).toBe(true);
      // Listings only show other people's files from viewable missions
      const listed = async (who, body = {}) => ((await api(who, 'POST', '/api/files/getfiles', body)).json.body || []).map((f) => f.id);
      for (const body of [{}, { mission: MISSION_B }]) {
        expect(await listed(users.viewer, body)).not.toContain(inB);
        expect(await listed(admin, body)).toContain(inB);
      }
      expect(await listed(users.viewer, { mission: MISSION_A })).toContain(inA);
      // Nobody makes files in a mission they cannot view
      const outside = await api(users.viewer, 'POST', '/api/files/make', { file_name: `out_${RUN}`, intent: 'all', mission: MISSION_B });
      expect(ok(outside)).toBe(false);
    } finally {
      for (const id of [inA, inB]) await api(admin, 'POST', '/api/files/remove', { id });
    }
  });

  test('saved logins: a new session id on reload, and logout ends them without the cookie', async () => {
    const name = `saved_${RUN}`;
    for (const u of [name, `${name}_x`])
      expect(ok(await api(admin, 'POST', '/api/users/signup', { username: u, password: PASSWORD, skipLogin: true }))).toBe(true);
    try {
      const tab = {};
      const r = await api(tab, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(r)).toBe(true);
      const savedCookie = `MMGISUser=${encodeURIComponent(JSON.stringify({ username: name, token: r.json.token }))}`;
      const signedIn = async (who) => readable(await api(who, 'GET', '/api/configure/missions'));

      // Someone else's session id planted before the reload never becomes this user's session
      const planted = await login(`${name}_x`, PASSWORD);
      const victim = { cookie: `${planted.cookie}; ${savedCookie}` };
      expect(ok(await api(victim, 'POST', '/api/users/login', { useToken: true }, { localAddress: freshAddress() }))).toBe(true);
      expect(victim.cookie).not.toContain(planted.cookie);
      expect(await signedIn(victim)).toBe(true);
      expect(await signedIn(planted)).toBe(false);

      // A malformed cookie doesn't break logout
      const bad = await api({ cookie: `${tab.cookie}; MMGISUser=%7Bnot-json` }, 'POST', '/api/users/logout', {});
      expect(bad.status).toBe(200);

      // Logging out without the cookie still ends the saved login
      const tab2 = {};
      const r2 = await api(tab2, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(r2)).toBe(true);
      const saved2 = `MMGISUser=${encodeURIComponent(JSON.stringify({ username: name, token: r2.json.token }))}`;
      expect(ok(await api(tab2, 'POST', '/api/users/logout', {}))).toBe(true);
      expect(ok(await api({ cookie: saved2 }, 'POST', '/api/users/login', { useToken: true }, { localAddress: freshAddress() }))).toBe(false);

      // Logging out an older device leaves the newer device's saved login alone
      const older = {};
      expect(ok(await api(older, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() }))).toBe(true);
      const newer = {};
      const r3 = await api(newer, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(r3)).toBe(true);
      const saved3 = `MMGISUser=${encodeURIComponent(JSON.stringify({ username: name, token: r3.json.token }))}`;
      expect(ok(await api(older, 'POST', '/api/users/logout', {}))).toBe(true);
      expect(ok(await api({ cookie: saved3 }, 'POST', '/api/users/login', { useToken: true }, { localAddress: freshAddress() }))).toBe(true);

      // An older session logging out with the newer saved-login cookie ends that saved login too
      const stale = {};
      expect(ok(await api(stale, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() }))).toBe(true);
      const r4 = await api({}, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(r4), 'second login for the stale-session check').toBe(true);
      const saved4 = `MMGISUser=${encodeURIComponent(JSON.stringify({ username: name, token: r4.json.token }))}`;
      expect(ok(await api({ cookie: `${stale.cookie}; ${saved4}` }, 'POST', '/api/users/logout', {}))).toBe(true);
      expect(ok(await api({ cookie: saved4 }, 'POST', '/api/users/login', { useToken: true }, { localAddress: freshAddress() }))).toBe(false);
    } finally {
      const entries = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries;
      for (const e of entries.filter((x) => x.username === name || x.username === `${name}_x`))
        await api(admin, 'DELETE', `/api/accounts/remove/${e.id}`);
    }
  });

  test('a password reset ends open sessions and saved logins', async () => {
    const name = `reset_${RUN}`;
    const NEW_PASSWORD = ['Reset', 'Pass', '2!'].join('');
    expect(ok(await api(admin, 'POST', '/api/users/signup', { username: name, password: PASSWORD, skipLogin: true }))).toBe(true);
    const id = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries.find((e) => e.username === name).id;
    try {
      const tab = {};
      const r = await api(tab, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(r)).toBe(true);
      const saved = { cookie: `MMGISUser=${encodeURIComponent(JSON.stringify({ username: name, token: r.json.token }))}` };
      const signedIn = async (who) => readable(await api(who, 'GET', '/api/configure/missions'));
      const reauth = () => api({ ...saved }, 'POST', '/api/users/login', { useToken: true }, { localAddress: freshAddress() });
      expect(await signedIn(tab)).toBe(true);
      expect(ok(await reauth())).toBe(true);
      await grant(admin, 'user', id, 'superadmin', 'global');
      const gen = await api(tab, 'POST', '/api/longtermtoken/generate', { name: `rt_${RUN}`, period: '86400000' });
      expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
      const withToken = () => api(null, 'GET', '/api/accounts/entries', null, { bearer: gen.json.body.token });
      expect(ok(await withToken())).toBe(true);

      const link = await api(admin, 'POST', '/api/accounts/generateResetPasswordLink', { id });
      expect(ok(link), link.text.slice(0, 200)).toBe(true);
      const reset = await api({}, 'POST', '/api/users/resetPassword', {
        username: name,
        password: NEW_PASSWORD,
        resetToken: link.json.body.resetToken,
      }, { localAddress: freshAddress() });
      expect(ok(reset), reset.text.slice(0, 200)).toBe(true);

      expect(await signedIn(tab)).toBe(false);
      expect(ok(await reauth())).toBe(false);
      expect(ok(await withToken())).toBe(false);
      const old = await api({}, 'POST', '/api/users/login', { username: name, password: PASSWORD }, { localAddress: freshAddress() });
      expect(ok(old)).toBe(false);
      expect(await signedIn(await login(name, NEW_PASSWORD))).toBe(true);
    } finally {
      await api(admin, 'DELETE', `/api/accounts/remove/${id}`);
    }
  });

  test('sign-up gives the same answer for a taken username and a taken email', async () => {
    const name = `uniq_${RUN}`;
    const email = `${name}@example.test`;
    expect(ok(await api(admin, 'POST', '/api/users/signup', { username: name, email, password: PASSWORD, skipLogin: true }))).toBe(true);
    try {
      const takenName = await api(admin, 'POST', '/api/users/signup', {
        username: name, email: `other_${RUN}@example.test`, password: PASSWORD, skipLogin: true,
      });
      const takenEmail = await api(admin, 'POST', '/api/users/signup', {
        username: `other_${RUN}`, email, password: PASSWORD, skipLogin: true,
      });
      expect(ok(takenName)).toBe(false);
      expect(ok(takenEmail)).toBe(false);
      expect(takenName.json.message).toBe(takenEmail.json.message);
    } finally {
      const entries = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries;
      for (const e of entries.filter((x) => [name, `other_${RUN}`].includes(x.username)))
        await api(admin, 'DELETE', `/api/accounts/remove/${e.id}`);
    }
  });

  test('sign-up and password reset are rate limited per address, except for account admins', async () => {
    const tooMany = (r) => r.status === 429 || /too many/i.test((r.json && r.json.message) || '');
    const flood = async (url, body) => {
      const localAddress = freshAddress();
      let last = null;
      for (let i = 0; i < 21; i++) last = await api({}, 'POST', url, body, { localAddress });
      return last;
    };
    expect(tooMany(await flood('/api/users/signup', { username: `flood_${RUN}`, password: 'x' }))).toBe(true);
    expect(tooMany(await flood('/api/users/first_signup', { username: `flood_${RUN}`, password: 'x' }))).toBe(true);
    expect(tooMany(await flood('/api/users/resetPassword', { username: `flood_${RUN}`, password: 'x', resetToken: 'x' }))).toBe(true);

    const localAddress = freshAddress();
    for (let i = 0; i < 21; i++) {
      const r = await api(admin, 'POST', '/api/users/signup', { username: `flood_${RUN}`, password: 'weak' }, { localAddress }); // pragma: allowlist secret
      expect(tooMany(r)).toBe(false);
    }
  });

  test('mission version history is gated on the mission it returns', async () => {
    const r = await api(
      users.madmin,
      'GET',
      `/api/configure/versions?mission=${encodeURIComponent(MISSION_B)}`,
      { mission: MISSION_A }
    );
    expect(denied(r)).toBe(true);
    expect(ok(await api(users.madmin, 'GET', `/api/configure/versions?mission=${encodeURIComponent(MISSION_A)}`))).toBe(true);
  });

  test('grants to padded or non-numeric account ids are refused', async () => {
    for (const subject_id of [` ${ids.viewer}`, `${ids.viewer}x`, '0', '-1'])
      expect(ok(await api(admin, 'POST', '/api/access/bindings/add', {
        subject_type: 'user', subject_id, role: 'superadmin', scope_type: 'global',
      })), subject_id).toBe(false);
  });

  test('a token cannot generate password reset links', async () => {
    const gen = await api(admin, 'POST', '/api/longtermtoken/generate', {
      name: `rl_${RUN}`, period: '86400000', scopes: ['accounts.manage'],
    });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const r = await api(null, 'POST', '/api/accounts/generateResetPasswordLink', { id: ids.plain }, { bearer: gen.json.body.token });
    expect(ok(r)).toBe(false);
    expect(JSON.stringify(r.json || {})).not.toMatch(/resetToken|reset_token/i);
  });

  test('account updates refuse the legacy role fields and change nothing', async () => {
    await grant(admin, 'user', ids.plain, 'mission_admin', 'global');
    const before = (await bindingsOf(ids.plain)).map((b) => b.id).sort();
    for (const legacy of [{ role: 'user' }, { missions_managing: [] }, { missions_viewing: null }]) {
      const r = await api(admin, 'POST', '/api/accounts/update', { id: ids.plain, ...legacy });
      expect(ok(r)).toBe(false);
      expect(r.json.message).toContain('/api/access/bindings/add');
    }
    expect((await bindingsOf(ids.plain)).map((b) => b.id).sort()).toEqual(before);
    for (const b of (await bindingsOf(ids.plain)).filter((x) => x.role === 'mission_admin'))
      expect(ok(await api(admin, 'POST', '/api/access/bindings/remove', { id: b.id }))).toBe(true);
    expect(denied(await initialView(users.plain, MISSION_A))).toBe(true);
  });

  test('updating a layer under an ambiguous header name path refuses instead of moving it', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const inner = randomUUID();
    const mission = `PermD_${RUN}`;
    expect(ok(await api(admin, 'POST', '/api/configure/add', { mission }))).toBe(true);
    const add = (layer, placement) => api(admin, 'POST', '/api/configure/addLayer', { mission, layer, placement });
    expect(ok(await add({ name: `Dup_${RUN}`, uuid: first, type: 'header', sublayers: [] }, { index: 0 }))).toBe(true);
    expect(ok(await add({
      name: `Dup_${RUN}`, uuid: second, type: 'header',
      sublayers: [{ name: `Inner_${RUN}`, uuid: inner, type: 'header', sublayers: [] }],
    }, { index: 1 }))).toBe(true);
    const r = await updateLayer(admin, mission, inner);
    expect(ok(r)).toBe(false);
    expect(r.json.message).toMatch(/not unique/);
    const layers = (await getConfig(admin, mission)).json.layers;
    const firstHeader = layers.find((l) => l.uuid === first);
    const secondHeader = layers.find((l) => l.uuid === second);
    expect(firstHeader.sublayers.length).toBe(0);
    expect(secondHeader.sublayers.map((l) => l.uuid)).toEqual([inner]);
    await api(admin, 'POST', '/api/configure/destroy', { mission });
  });


  test('malformed draw bodies and repeated time parameters fail the request, not the server', async () => {
    for (const file_id of [undefined, '1 OR 1=1', { a: 1 }]) {
      const r = await api(admin, 'POST', '/api/draw/remove', file_id === undefined ? {} : { file_id, id: 1 });
      expect(r.status).toBeLessThan(500);
      expect(ok(r)).toBe(false);
    }
    const time = await api(admin, 'GET', `/Missions/${MISSION_A}/Layers/_time_/x.png?time=a&time=b`);
    expect(time.status).toBe(400);
    const start = await api(admin, 'GET', `/Missions/${MISSION_A}/Layers/_time_/x.png?time=a&starttime=b&starttime=c`);
    expect(start.status).toBe(400);
    expect((await api(admin, 'GET', '/api/utils/healthcheck')).status).toBe(200);
  });

  test('drawing history and shared editing follow mission visibility', async () => {
    const make = async (mission) => {
      const r = await api(admin, 'POST', '/api/files/make', { file_name: `share_${RUN}`, intent: 'all', mission });
      expect(ok(r), r.text.slice(0, 200)).toBe(true);
      const file_id = r.json.body.file_id;
      const ch = await api(admin, 'POST', '/api/files/change', { id: file_id, public: '1', publicity_type: 'all_edit' });
      expect(ok(ch), ch.text.slice(0, 200)).toBe(true);
      return file_id;
    };
    const inA = await make(MISSION_A);
    const inB = await make(MISSION_B);
    const history = (who, id) => api(who, 'POST', '/api/files/gethistory', { id });
    const addTo = (who, file_id) => api(who, 'POST', '/api/draw/add', {
      file_id,
      intent: 'point',
      properties: JSON.stringify({ name: 'p' }),
      geometry: JSON.stringify({ type: 'Point', coordinates: [0, 0] }),
    });
    try {
      expect(ok(await history(users.viewer, inA))).toBe(true);
      expect(ok(await history(users.viewer, inB))).toBe(false);
      expect(ok(await history(admin, inB))).toBe(true);
      expect(ok(await history(users.viewer, 'x'))).toBe(false);
      // "Anyone can edit" applies only to those who can view the file's mission
      const blocked = await addTo(users.viewer, inB);
      expect(ok(blocked)).toBe(false);
      expect(blocked.json.message).toBe('Permission denied.');
      expect(ok(await addTo(users.viewer, inA)), 'viewer edits shared file in viewable mission').toBe(true);
      expect(ok(await addTo(admin, inB))).toBe(true);
    } finally {
      for (const id of [inA, inB]) await api(admin, 'POST', '/api/files/remove', { id });
    }
  });

  test('tokens cannot grant SuperAdmin', async () => {
    const gen = await api(admin, 'POST', '/api/longtermtoken/generate', { name: `sa_${RUN}`, period: '86400000' });
    expect(ok(gen), gen.text.slice(0, 200)).toBe(true);
    const bearer = gen.json.body.token;
    try {
      const viaGrant = await api(null, 'POST', '/api/access/bindings/add', {
        subject_type: 'user', subject_id: ids.plain, role: 'superadmin', scope_type: 'global',
      }, { bearer });
      expect(ok(viaGrant)).toBe(false);
      const viaUpdate = await api(null, 'POST', '/api/accounts/update', { id: ids.plain, role: 'superadmin' }, { bearer });
      expect(ok(viaUpdate)).toBe(false);
      expect((await bindingsOf(ids.plain)).some((b) => b.role === 'superadmin')).toBe(false);
      // The same token still does other account management
      expect(ok(await api(null, 'GET', '/api/accounts/entries', null, { bearer }))).toBe(true);
    } finally {
      const row = (await api(admin, 'GET', '/api/longtermtoken/get')).json.tokens.find((t) => t.name === `sa_${RUN}`);
      if (row) await api(admin, 'POST', '/api/longtermtoken/clear', { id: row.id });
    }
  });

  test('a SuperAdmin grant made while its account is deleted never outlives the account', async () => {
    for (let i = 0; i < 5; i++) {
      const username = `race${i}_${RUN}`;
      expect(ok(await api(admin, 'POST', '/api/users/signup', { username, password: PASSWORD, skipLogin: true }))).toBe(true);
      const id = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries.find((e) => e.username === username).id;
      await Promise.all([
        api(admin, 'POST', '/api/access/bindings/add', { subject_type: 'user', subject_id: id, role: 'superadmin', scope_type: 'global' }),
        api(admin, 'DELETE', `/api/accounts/remove/${id}`),
      ]);
      const left = (await api(admin, 'GET', '/api/access/bindings?role=superadmin')).json.body.filter(
        (b) => b.subject_type === 'user' && String(b.subject_id) === String(id)
      );
      const stillThere = (await api(admin, 'GET', '/api/accounts/entries')).json.body.entries.some((e) => e.id === id);
      if (stillThere) await api(admin, 'DELETE', `/api/accounts/remove/${id}`);
      else expect(left, `SuperAdmin grant left for deleted account ${id}`).toEqual([]);
    }
  });

  test('renaming a Draw tag only changes the caller\'s own files', async () => {
    const tag = `t_${RUN}`;
    const made = await api(admin, 'POST', '/api/files/make', {
      file_name: `tags_${RUN}`, intent: 'all', mission: MISSION_A, file_description: `notes ~#${tag}`,
    });
    expect(ok(made), made.text.slice(0, 200)).toBe(true);
    const file_id = made.json.body.file_id;
    const description = async () =>
      (await api(admin, 'POST', '/api/files/getfiles', {})).json.body.find((f) => f.id === file_id).file_description;
    try {
      const rename = (who, newKeyword) => api(who, 'POST', '/api/files/modifykeyword', { keyword: tag, type: 'tags', newKeyword });
      await rename(users.viewer, 'pwned');
      await rename(users.viewer, undefined);
      expect(await description()).toBe(`notes ~#${tag}`);
      expect(ok(await rename(admin, 'mine'))).toBe(true);
      expect(await description()).toBe('notes ~#mine');
      expect((await api(admin, 'POST', '/api/files/modifykeyword', { keyword: tag })).status).toBeLessThan(500);
    } finally {
      await api(admin, 'POST', '/api/files/remove', { id: file_id });
    }
  });


  test('private drawings stay private through getfile and aggregations', async () => {
    const make = async (who, name) => {
      const r = await api(who, 'POST', '/api/files/make', { file_name: `${name}_${RUN}`, intent: 'all', mission: MISSION_A });
      expect(ok(r), r.text.slice(0, 200)).toBe(true);
      return r.json.body.file_id;
    };
    const secret = await make(admin, 'secret');
    const mine = await make(users.viewer, 'mine');
    try {
      expect(ok(await api(admin, 'POST', '/api/files/change', { id: secret, public: '0' }))).toBe(true);
      const getfile = (who, id) => api(who, 'POST', '/api/files/getfile', { id });
      const aggs = (who, id) => api(who, 'POST', '/api/draw/aggregations', { id: JSON.stringify(id) });
      expect(ok(await getfile(users.viewer, mine))).toBe(true);
      expect(ok(await getfile(users.viewer, secret))).toBe(false);
      expect(ok(await getfile(users.viewer, [mine, secret]))).toBe(false);
      expect(ok(await getfile(admin, secret))).toBe(true);
      expect(ok(await aggs(users.viewer, [mine]))).toBe(true);
      expect(ok(await aggs(users.viewer, [mine, secret]))).toBe(false);
      expect(ok(await aggs(users.viewer, [secret]))).toBe(false);
    } finally {
      await api(admin, 'POST', '/api/files/remove', { id: secret });
      await api(users.viewer, 'POST', '/api/files/remove', { id: mine });
    }
  });

  test('the Draw owner name "group" cannot be registered', async () => {
    for (const username of ['group', 'Group', ' group '])
      expect(ok(await api(admin, 'POST', '/api/users/signup', { username, password: PASSWORD, skipLogin: true }))).toBe(false);
  });

});
