/**
 * Unit tests for the capability/role policy core.
 * Source: API/permissions/policy.js
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const policy = require(path.resolve(__dirname, '../../API/permissions/policy.js'));
const { can, missionsWith, capabilitiesOf, isSuperAdmin, accountRole, scopeChain } = policy;

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
// Layer tree in M1: ROOT > FOLDER > (CHILD > GRANDCHILD), SIBLING under ROOT
const ROOT = 'aaaaaaaa-0000-4000-8000-000000000001';
const FOLDER = 'aaaaaaaa-0000-4000-8000-000000000002';
const CHILD = 'aaaaaaaa-0000-4000-8000-000000000003';
const GRANDCHILD = 'aaaaaaaa-0000-4000-8000-000000000004';
const SIBLING = 'aaaaaaaa-0000-4000-8000-000000000005';

const mission = (m) => ({ mission: m });
const layer = (m, ...chain) => ({ mission: m, layers: chain });

const user = (bindings, extra = {}) => ({
  kind: 'user',
  authenticated: true,
  userId: 1,
  bindings: bindings.map(([role, scope]) => ({ role, scope })),
  ...extra,
});
const anonymous = (bindings = [], guestsAllowed = true) => ({
  kind: 'anonymous',
  authenticated: false,
  guestsAllowed,
  bindings: bindings.map(([role, scope]) => ({ role, scope })),
});
const withToken = (principal, token) => ({ ...principal, kind: 'token', token: { scopes: null, missions: null, ...token } });

const ALL = policy.ALL_CAPABILITIES;
const SITE_WIDE_ADMIN = [
  'mission.create',
  'mission.manage',
  'accounts.manage',
  'groups.manage',
  'options.manage',
  'webhooks.manage',
  'broadcast.send',
  'tokens.manage',
  'data.geodatasets.write',
  'data.datasets.write',
  'data.stac.write',
];
const AUTH_BASELINE = ['site.view', 'draw.use', 'tokens.create', 'data.geodatasets.read', 'data.datasets.read', 'data.stac.read'];
const ANON_BASELINE = ['site.view', 'data.geodatasets.read', 'data.datasets.read', 'data.stac.read'];

// Resources each capability is checked against in the matrix
const RESOURCES = {
  none: null,
  m1: mission(M1),
  m2: mission(M2),
  m1Root: layer(M1, ROOT),
  m1Child: layer(M1, ROOT, FOLDER, CHILD),
  m1Grandchild: layer(M1, ROOT, FOLDER, CHILD, GRANDCHILD),
  m1Sibling: layer(M1, ROOT, SIBLING),
  m2Layer: layer(M2, ROOT),
};

function expectMatrix(principal, expected) {
  for (const cap of ALL)
    for (const [name, resource] of Object.entries(RESOURCES)) {
      const want = expected(cap, name);
      expect(can(principal, cap, resource), `${cap} on ${name}`).toBe(want);
    }
}

test.describe('Permissions policy: registry', () => {
  test('every role only uses known capabilities and scope types', () => {
    for (const [name, role] of Object.entries(policy.ROLES)) {
      for (const cap of role.capabilities) expect(policy.CAPABILITIES[cap], `${name}:${cap}`).toBeTruthy();
      for (const scope of role.scopes) expect(['global', 'mission', 'layer']).toContain(scope);
    }
  });

  test('read capabilities contain no write or management capability', () => {
    for (const cap of policy.READ_CAPABILITIES) expect(cap).not.toMatch(/write|manage|edit|create|send/);
  });

  test('scope keys and chains', () => {
    expect(policy.scopeKey('global')).toBe('global');
    expect(policy.scopeKey('mission', M1)).toBe(`mission:${M1}`);
    expect(policy.scopeKey('layer', M1, ROOT)).toBe(`layer:${M1}:${ROOT}`);
    expect(policy.scopeKey('bogus', M1)).toBeNull();
    expect(scopeChain(null)).toEqual(['global']);
    expect(scopeChain(layer(M1, ROOT, CHILD))).toEqual(['global', `mission:${M1}`, `layer:${M1}:${ROOT}`, `layer:${M1}:${CHILD}`]);
  });

  test('unknown capability and missing principal are denied', () => {
    const sa = user([['superadmin', 'global']]);
    expect(can(sa, 'not.a.capability', null)).toBe(false);
    expect(can(null, 'site.view', null)).toBe(false);
    expect(can(undefined, 'site.view', null)).toBe(false);
  });

  test('bindings with unknown roles grant nothing beyond the baseline', () => {
    const p = user([['god', 'global'], ['admin', `mission:${M1}`]]);
    expectMatrix(p, (cap) => AUTH_BASELINE.includes(cap));
  });
});

test.describe('Permissions policy: role matrix', () => {
  test('superadmin can do everything everywhere', () => {
    const p = user([['superadmin', 'global']]);
    expectMatrix(p, () => true);
    expect(isSuperAdmin(p)).toBe(true);
  });

  test('two independent superadmins each have full access', () => {
    for (const id of [1, 2]) {
      const p = user([['superadmin', 'global']], { userId: id });
      for (const cap of ALL) expect(can(p, cap, RESOURCES.m2Layer)).toBe(true);
    }
  });

  test('data admin manages data but not missions, accounts or site options', () => {
    const p = user([['data_admin', 'global']]);
    const dataCaps = policy.ROLES.data_admin.capabilities;
    expectMatrix(p, (cap) => AUTH_BASELINE.includes(cap) || dataCaps.includes(cap));
    expect(isSuperAdmin(p)).toBe(false);
  });

  test('mission admin edits only their mission and has no site-wide power', () => {
    const p = user([['mission_admin', `mission:${M1}`]]);
    const missionCaps = ['mission.view', 'mission.layer.edit', 'mission.config.edit'];
    expectMatrix(p, (cap, res) => {
      if (AUTH_BASELINE.includes(cap)) return true;
      if (missionCaps.includes(cap)) return res.startsWith('m1');
      return false;
    });
    for (const cap of SITE_WIDE_ADMIN) expect(can(p, cap, mission(M1)), cap).toBe(false);
  });

  test('global mission admin edits every mission but still has no site-wide power', () => {
    const p = user([['mission_admin', 'global']]);
    for (const res of Object.values(RESOURCES)) expect(can(p, 'mission.config.edit', res)).toBe(true);
    for (const cap of SITE_WIDE_ADMIN) expect(can(p, cap, null), cap).toBe(false);
  });

  test('layer editor edits the bound layer subtree only', () => {
    const p = user([['layer_editor', `layer:${M1}:${FOLDER}`]]);
    expect(can(p, 'mission.layer.edit', layer(M1, ROOT, FOLDER))).toBe(true);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Child)).toBe(true);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Grandchild)).toBe(true);
    // ancestors, siblings, other missions and whole-mission edits are out of scope
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Root)).toBe(false);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Sibling)).toBe(false);
    expect(can(p, 'mission.layer.edit', mission(M1))).toBe(false);
    expect(can(p, 'mission.layer.edit', layer(M2, ROOT, FOLDER))).toBe(false);
    expect(can(p, 'mission.config.edit', layer(M1, ROOT, FOLDER))).toBe(false);
    expect(can(p, 'mission.config.edit', mission(M1))).toBe(false);
    for (const cap of SITE_WIDE_ADMIN) expect(can(p, cap, null), cap).toBe(false);
  });

  test('layer editor can view the mission containing their layers, and no other', () => {
    const p = user([['layer_editor', `layer:${M1}:${CHILD}`]]);
    expect(can(p, 'mission.view', mission(M1))).toBe(true);
    expect(can(p, 'mission.view', mission(M2))).toBe(false);
    expect(missionsWith(p, 'mission.view')).toEqual([M1]);
  });

  test('mission-scoped layer editor edits every layer in the mission but not its config', () => {
    const p = user([['layer_editor', `mission:${M1}`]]);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Root)).toBe(true);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Grandchild)).toBe(true);
    expect(can(p, 'mission.layer.edit', RESOURCES.m2Layer)).toBe(false);
    expect(can(p, 'mission.config.edit', mission(M1))).toBe(false);
  });

  test('viewer sees only their mission', () => {
    const p = user([['viewer', `mission:${M1}`]]);
    expectMatrix(p, (cap, res) => {
      if (AUTH_BASELINE.includes(cap)) return true;
      return cap === 'mission.view' && res.startsWith('m1');
    });
  });

  test('global viewer sees every mission and edits nothing', () => {
    const p = user([['viewer', 'global']]);
    expectMatrix(p, (cap) => AUTH_BASELINE.includes(cap) || cap === 'mission.view');
  });

  test('an authenticated user with no bindings has only the baseline', () => {
    expectMatrix(user([]), (cap) => AUTH_BASELINE.includes(cap));
  });

  test('mission capabilities without a mission need a global grant', () => {
    expect(can(user([['mission_admin', `mission:${M1}`]]), 'mission.view', null)).toBe(false);
    expect(can(user([['viewer', 'global']]), 'mission.view', null)).toBe(true);
  });
});

test.describe('Permissions policy: mission isolation', () => {
  test('admin of one mission and viewer of another cannot edit the other', () => {
    const p = user([
      ['mission_admin', `mission:${M1}`],
      ['viewer', `mission:${M2}`],
    ]);
    expect(can(p, 'mission.config.edit', mission(M1))).toBe(true);
    expect(can(p, 'mission.view', mission(M2))).toBe(true);
    expect(can(p, 'mission.config.edit', mission(M2))).toBe(false);
    expect(can(p, 'mission.layer.edit', RESOURCES.m2Layer)).toBe(false);
  });

  test('a layer UUID shared across missions does not carry access across missions', () => {
    const p = user([['layer_editor', `layer:${M1}:${ROOT}`]]);
    expect(can(p, 'mission.layer.edit', layer(M1, ROOT))).toBe(true);
    expect(can(p, 'mission.layer.edit', layer(M2, ROOT))).toBe(false);
  });
});

test.describe('Permissions policy: groups and audiences', () => {
  test('group and direct bindings are a union (allow-only)', () => {
    // Principals carry the bindings of the user and all their groups
    const p = user([
      ['viewer', `mission:${M1}`],
      ['mission_admin', `mission:${M2}`],
    ]);
    expect(can(p, 'mission.view', mission(M1))).toBe(true);
    expect(can(p, 'mission.config.edit', mission(M2))).toBe(true);
    expect(missionsWith(p, 'mission.view').sort()).toEqual([M1, M2].sort());
  });

  test('anonymous guests get the guest baseline when guests are allowed', () => {
    expectMatrix(anonymous(), (cap) => ANON_BASELINE.includes(cap));
  });

  test('an "everyone" viewer binding lets guests view missions', () => {
    const p = anonymous([['viewer', 'global']]);
    expect(can(p, 'mission.view', mission(M1))).toBe(true);
    expect(can(p, 'mission.layer.edit', RESOURCES.m1Root)).toBe(false);
    expect(can(p, 'draw.use', null)).toBe(false);
    expect(can(p, 'tokens.create', null)).toBe(false);
  });

  test('guests get nothing at all when the site requires login', () => {
    const p = anonymous([['viewer', 'global']], false);
    expectMatrix(p, () => false);
    expect(missionsWith(p, 'mission.view')).toEqual([]);
    expect(capabilitiesOf(p)).toEqual([]);
  });
});

test.describe('Permissions policy: long-term tokens', () => {
  const creator = user([['superadmin', 'global']]);

  test('a full-scope token acts as its creator', () => {
    const t = withToken(creator, {});
    for (const cap of ALL) expect(can(t, cap, RESOURCES.m1Root)).toBe(true);
    expect(isSuperAdmin(t)).toBe(true);
  });

  test('a mission-limited token is not a SuperAdmin, even with every capability', () => {
    const t = withToken(creator, { missions: [M1] });
    expect(can(t, 'mission.config.edit', mission(M1))).toBe(true);
    expect(isSuperAdmin(t)).toBe(false);
  });

  test('a scoped token only has its scopes', () => {
    const t = withToken(creator, { scopes: ['mission.view', 'data.stac.read'] });
    expect(can(t, 'mission.view', mission(M1))).toBe(true);
    expect(can(t, 'data.stac.read', null)).toBe(true);
    expect(can(t, 'mission.config.edit', mission(M1))).toBe(false);
    expect(can(t, 'accounts.manage', null)).toBe(false);
    expect(can(t, 'site.view', null)).toBe(false);
    expect(isSuperAdmin(t)).toBe(false);
  });

  test('a read-only token from a SuperAdmin cannot write', () => {
    const t = withToken(creator, { scopes: policy.READ_CAPABILITIES });
    for (const cap of ALL) if (!policy.READ_CAPABILITIES.includes(cap)) expect(can(t, cap, mission(M1)), cap).toBe(false);
  });

  test('a mission-limited token is limited to those missions', () => {
    const t = withToken(creator, { missions: [M1] });
    expect(can(t, 'mission.config.edit', mission(M1))).toBe(true);
    expect(can(t, 'mission.config.edit', mission(M2))).toBe(false);
    expect(can(t, 'mission.view', RESOURCES.m2Layer)).toBe(false);
    expect(missionsWith(t, 'mission.view')).toEqual([M1]);
  });

  test('a token never exceeds its creator', () => {
    const viewer = user([['viewer', `mission:${M1}`]]);
    const t = withToken(viewer, { scopes: ['mission.config.edit', 'accounts.manage', 'mission.view'] });
    expect(can(t, 'mission.config.edit', mission(M1))).toBe(false);
    expect(can(t, 'accounts.manage', null)).toBe(false);
    expect(can(t, 'mission.view', mission(M1))).toBe(true);
    expect(can(t, 'mission.view', mission(M2))).toBe(false);
  });

  test('demoting the creator removes the token\'s access', () => {
    const scopes = { scopes: ['mission.config.edit'] };
    expect(can(withToken(user([['mission_admin', `mission:${M1}`]]), scopes), 'mission.config.edit', mission(M1))).toBe(true);
    expect(can(withToken(user([['viewer', `mission:${M1}`]]), scopes), 'mission.config.edit', mission(M1))).toBe(false);
  });
});

test.describe('Permissions policy: listing helpers', () => {
  test('missionsWith', () => {
    expect(missionsWith(user([['superadmin', 'global']]), 'mission.view')).toBeNull();
    const p = user([
      ['mission_admin', `mission:${M1}`],
      ['viewer', `mission:${M2}`],
    ]);
    expect(missionsWith(p, 'mission.config.edit')).toEqual([M1]);
    expect(missionsWith(p, 'mission.view').sort()).toEqual([M1, M2].sort());
    expect(missionsWith(user([]), 'mission.view')).toEqual([]);
    expect(missionsWith(withToken(p, { scopes: ['data.stac.read'] }), 'mission.view')).toEqual([]);
    expect(missionsWith(withToken(user([['viewer', 'global']]), { missions: [M2] }), 'mission.view')).toEqual([M2]);
    expect(missionsWith(null, 'mission.view')).toEqual([]);
  });

  test('layerRootsWith returns the bound subtree roots of a mission', () => {
    const p = user([
      ['layer_editor', `layer:${M1}:${FOLDER}`],
      ['layer_editor', `layer:${M1}:${SIBLING}`],
      ['layer_editor', `layer:${M2}:${ROOT}`],
      ['viewer', `mission:${M1}`],
    ]);
    expect(policy.layerRootsWith(p, 'mission.layer.edit', M1).sort()).toEqual([FOLDER, SIBLING].sort());
    expect(policy.layerRootsWith(p, 'mission.config.edit', M1)).toEqual([]);
  });

  test('capabilitiesOf drives UI gating', () => {
    const caps = capabilitiesOf(user([['mission_admin', `mission:${M1}`]]));
    expect(caps).toEqual(expect.arrayContaining(['mission.view', 'mission.layer.edit', 'mission.config.edit', ...AUTH_BASELINE]));
    for (const cap of SITE_WIDE_ADMIN) expect(caps).not.toContain(cap);
    expect(capabilitiesOf(user([['layer_editor', `layer:${M1}:${ROOT}`]]))).toContain('mission.layer.edit');
    expect(capabilitiesOf(user([['superadmin', 'global']])).sort()).toEqual(ALL.slice().sort());
  });

  test('accountRole is derived from bindings', () => {
    expect(accountRole([{ role: 'superadmin', scope: 'global' }])).toBe('superadmin');
    expect(accountRole([{ role: 'mission_admin', scope: `mission:${M1}` }])).toBe('mission_admin');
    expect(accountRole([{ role: 'layer_editor', scope: `layer:${M1}:x` }])).toBe('layer_editor');
    expect(accountRole([{ role: 'layer_editor', scope: `layer:${M1}:x` }, { role: 'mission_admin', scope: `mission:${M1}` }])).toBe('mission_admin');
    expect(accountRole([{ role: 'data_admin', scope: 'global' }])).toBe('data_admin');
    expect(accountRole([{ role: 'mission_admin', scope: 'global' }])).toBe('mission_admin');
    expect(accountRole([{ role: 'viewer', scope: 'global' }])).toBe('user');
    expect(accountRole([])).toBe('user');
  });
});

// Deterministic pseudo-random generator so failures are reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const ROLE_NAMES = Object.keys(policy.ROLES);
function randomBinding(r) {
  const role = ROLE_NAMES[Math.floor(r() * ROLE_NAMES.length)];
  const scopes = policy.ROLES[role].scopes;
  const type = scopes[Math.floor(r() * scopes.length)];
  const m = r() < 0.5 ? M1 : M2;
  const l = [ROOT, FOLDER, CHILD, GRANDCHILD, SIBLING][Math.floor(r() * 5)];
  return [role, policy.scopeKey(type, m, l)];
}
function randomPrincipal(r) {
  const n = Math.floor(r() * 4);
  return user(Array.from({ length: n }, () => randomBinding(r)));
}

test.describe('Permissions policy: properties', () => {
  test('adding a binding never removes access; removing one never adds access', () => {
    const r = rng(42);
    for (let i = 0; i < 400; i++) {
      const base = randomPrincipal(r);
      const extra = randomBinding(r);
      const more = user([...base.bindings.map((b) => [b.role, b.scope]), extra]);
      for (const cap of ALL)
        for (const res of Object.values(RESOURCES))
          if (can(base, cap, res)) expect(can(more, cap, res), `${cap} ${JSON.stringify(extra)}`).toBe(true);
    }
  });

  test('a token never grants more than its creator', () => {
    const r = rng(7);
    for (let i = 0; i < 400; i++) {
      const creator = randomPrincipal(r);
      const scopes = r() < 0.3 ? null : ALL.filter(() => r() < 0.5);
      const missions = r() < 0.5 ? null : [r() < 0.5 ? M1 : M2];
      const token = withToken(creator, { scopes, missions });
      for (const cap of ALL)
        for (const res of Object.values(RESOURCES))
          if (can(token, cap, res)) expect(can(creator, cap, res)).toBe(true);
    }
  });

  test('access to a layer implies access to all of its descendants', () => {
    const r = rng(99);
    for (let i = 0; i < 400; i++) {
      const p = randomPrincipal(r);
      for (const cap of ALL) {
        if (can(p, cap, layer(M1, ROOT, FOLDER))) expect(can(p, cap, RESOURCES.m1Child)).toBe(true);
        if (can(p, cap, RESOURCES.m1Child)) expect(can(p, cap, RESOURCES.m1Grandchild)).toBe(true);
      }
    }
  });

  test('mission-scoped bindings never grant site-wide administration', () => {
    const r = rng(1234);
    for (let i = 0; i < 400; i++) {
      const p = randomPrincipal(r);
      if (p.bindings.some((b) => b.scope === 'global')) continue;
      for (const cap of SITE_WIDE_ADMIN) expect(can(p, cap, null)).toBe(false);
    }
  });
});

test.describe('mission-limited tokens and site-wide capabilities', () => {
  const sa = { authenticated: true, bindings: [{ role: 'superadmin', scope: 'global' }] };
  const t = { ...sa, kind: 'token', token: { scopes: null, missions: ['m-1'] } };
  test('cannot use non-mission capabilities beyond reads', () => {
    for (const cap of ['mission.create', 'data.geodatasets.write', 'accounts.manage', 'tokens.create'])
      expect(can(t, cap)).toBe(false);
    for (const cap of ['site.view', 'data.geodatasets.read'])
      expect(can(t, cap)).toBe(true);
    expect(can(t, 'mission.config.edit', { mission: 'm-1' })).toBe(true);
    expect(can(t, 'mission.config.edit', { mission: 'm-2' })).toBe(false);
  });
  test('unrestricted tokens keep site-wide capabilities', () => {
    expect(can({ ...t, token: { scopes: null, missions: null } }, 'mission.create')).toBe(true);
  });
});

test.describe('shared mission folder', () => {
  const { canReadSharedFolder } = policy;

  test('signed-in users can always read it', () => {
    expect(canReadSharedFolder(user([]))).toBe(true);
    expect(canReadSharedFolder(withToken(user([]), { scopes: ['site.view'] }))).toBe(true);
  });

  test('guests need view access to at least one mission', () => {
    expect(canReadSharedFolder(anonymous([]))).toBe(false);
    expect(canReadSharedFolder(anonymous([['viewer', `mission:${M1}`]]))).toBe(true);
    expect(canReadSharedFolder(anonymous([['viewer', 'global']]))).toBe(true);
    expect(canReadSharedFolder(anonymous([['layer_editor', `layer:${M1}:${CHILD}`]]))).toBe(true);
  });

  test('guests on a site that requires login cannot', () => {
    expect(canReadSharedFolder(anonymous([['viewer', 'global']], false))).toBe(false);
    expect(canReadSharedFolder(null)).toBe(false);
  });
});

test.describe('adjacent servers', () => {
  const { canUseAdjacentServer } = policy;
  const editor = user([['layer_editor', `mission:${M1}`]]);
  const admin = user([['superadmin', 'global']]);
  const SERVERS = ['stac', 'titiler-pgstac', 'tipg', 'titiler', 'veloserver', 'custom'];

  test('session reads, and session writes to servers without a data capability, are left to the site gate', () => {
    for (const server of SERVERS) {
      expect(canUseAdjacentServer(editor, 'GET', server)).toBe(true);
      expect(canUseAdjacentServer(anonymous([]), 'GET', server)).toBe(true);
    }
    for (const server of ['titiler', 'veloserver', 'custom'])
      for (const method of ['POST', 'DELETE']) expect(canUseAdjacentServer(editor, method, server)).toBe(true);
  });

  test('read-only POSTs (STAC search, pgSTAC search registration) count as reads', () => {
    const read = withToken(admin, { scopes: ['data.stac.read'] });
    for (const [server, path] of [['stac', '/search'], ['titiler-pgstac', '/searches/register'], ['titiler-pgstac', '/mosaic/register']]) {
      expect(canUseAdjacentServer(editor, 'POST', server, path)).toBe(true);
      expect(canUseAdjacentServer(read, 'POST', server, path)).toBe(true);
    }
    expect(canUseAdjacentServer(editor, 'POST', 'stac', '/collections')).toBe(false);
    expect(canUseAdjacentServer(read, 'POST', 'stac', '/collections/c1/items')).toBe(false);
    expect(canUseAdjacentServer(editor, 'DELETE', 'stac', '/search')).toBe(false);
  });

  test('session writes to STAC and TiPg need the data write capability', () => {
    const dataAdmin = user([['data_admin', 'global']]);
    for (const [server, ok] of [['stac', true], ['titiler-pgstac', true], ['tipg', true]])
      for (const method of ['POST', 'DELETE']) {
        expect(canUseAdjacentServer(editor, method, server)).toBe(false);
        expect(canUseAdjacentServer(admin, method, server)).toBe(true);
        expect(canUseAdjacentServer(dataAdmin, method, server)).toBe(ok);
      }
  });

  test('STAC servers need data.stac.read to read and data.stac.write to change anything', () => {
    const read = withToken(admin, { scopes: ['data.stac.read'] });
    for (const server of ['stac', 'titiler-pgstac']) {
      expect(canUseAdjacentServer(withToken(admin, { scopes: ['site.view'] }), 'GET', server)).toBe(false);
      expect(canUseAdjacentServer(read, 'GET', server)).toBe(true);
      expect(canUseAdjacentServer(read, 'HEAD', server)).toBe(true);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(canUseAdjacentServer(read, method, server)).toBe(false);
      expect(canUseAdjacentServer(withToken(admin, {}), 'DELETE', server)).toBe(true);
    }
  });

  test('TiPG needs the geodataset capabilities, not the STAC ones', () => {
    expect(canUseAdjacentServer(withToken(admin, { scopes: ['data.stac.read'] }), 'GET', 'tipg')).toBe(false);
    expect(canUseAdjacentServer(withToken(admin, { scopes: ['data.geodatasets.read'] }), 'GET', 'tipg')).toBe(true);
    expect(canUseAdjacentServer(withToken(admin, { scopes: ['data.geodatasets.read'] }), 'POST', 'tipg')).toBe(false);
    expect(canUseAdjacentServer(withToken(admin, { scopes: ['data.geodatasets.write'] }), 'POST', 'tipg')).toBe(true);
  });

  test('other servers read with site.view and write only with unrestricted tokens', () => {
    for (const server of ['titiler', 'veloserver', 'custom']) {
      expect(canUseAdjacentServer(withToken(admin, { scopes: ['data.stac.read'] }), 'GET', server)).toBe(false);
      expect(canUseAdjacentServer(withToken(admin, { scopes: ['site.view'] }), 'GET', server)).toBe(true);
      expect(canUseAdjacentServer(withToken(admin, { scopes: ['site.view', 'data.stac.write'] }), 'POST', server)).toBe(false);
      expect(canUseAdjacentServer(withToken(admin, { missions: [M1] }), 'POST', server)).toBe(false);
      expect(canUseAdjacentServer(withToken(admin, {}), 'POST', server)).toBe(true);
    }
  });

  test('a token cannot write STAC unless its creator can', () => {
    expect(canUseAdjacentServer(withToken(editor, {}), 'GET', 'stac')).toBe(true);
    expect(canUseAdjacentServer(withToken(editor, {}), 'POST', 'stac')).toBe(false);
    expect(canUseAdjacentServer(withToken(editor, { scopes: ['mission.layer.edit'] }), 'POST', 'stac')).toBe(false);
  });

  test('a mission-limited token can read STAC but not write it', () => {
    const limited = withToken(admin, { missions: [M1] });
    expect(canUseAdjacentServer(limited, 'GET', 'stac')).toBe(true);
    expect(canUseAdjacentServer(limited, 'POST', 'stac')).toBe(false);
  });
});

test.describe('capabilities of tokens over layer grants', () => {
  const editor = user([['layer_editor', `layer:${M1}:${CHILD}`]]);
  test('a read-only token of a layer editor holds no edit capability', () => {
    expect(capabilitiesOf(editor)).toContain('mission.layer.edit');
    const read = withToken(editor, { scopes: ['site.view', 'mission.view'] });
    expect(capabilitiesOf(read)).not.toContain('mission.layer.edit');
  });
  test('a token limited to another mission holds no edit capability', () => {
    expect(capabilitiesOf(withToken(editor, { missions: [M2] }))).not.toContain('mission.layer.edit');
    expect(capabilitiesOf(withToken(editor, { missions: [M1] }))).toContain('mission.layer.edit');
  });
});

test.describe('provider users and tokens', () => {
  test('external principals are not offered tokens.create (tokens belong to accounts)', () => {
    const ext = { kind: 'external', provider: 'csso', authenticated: true, userId: null, bindings: [] };
    expect(capabilitiesOf(ext)).not.toContain('tokens.create');
    expect(capabilitiesOf(ext)).toContain('draw.use');
    expect(capabilitiesOf(user([]))).toContain('tokens.create');
  });
});
