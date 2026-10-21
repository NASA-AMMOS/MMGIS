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

function api(who, method, url, body, { bearer, localAddress } = {}) {
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
          ...(who && who.cookie && !bearer ? { Cookie: who.cookie } : {}),
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
  test.skip(process.env.MMGIS_TEST_AUTH_MODE !== 'local', 'SKIP: needs SITE_ACCESS=required');

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
    expect(denied(await api(who, 'POST', '/api/configure/rename', { mission: MISSION_A, newMissionName: `NopeR_${RUN}` }))).toBe(true);
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

  test('anonymous requests are denied on a required site', async () => {
    expect(readable(await getConfig(null, MISSION_A))).toBe(false);
    expect(denied(await api(null, 'GET', '/api/accounts/entries'))).toBe(true);
    expect(denied(await initialView(null, MISSION_A))).toBe(true);
  });
});
