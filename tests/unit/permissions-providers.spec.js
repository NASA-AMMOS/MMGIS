/**
 * Unit tests for login provider plugins (plugins/core/auth/*).
 * Source: API/permissions/providers.js, plugins/core/auth/CSSO/plugin.js
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const os = require('os');
const path = require('path');

const providers = require(path.resolve(__dirname, '../../API/permissions/providers.js'));
const siteAccess = require(path.resolve(__dirname, '../../API/permissions/siteAccess.js'));
const csso = require(path.resolve(__dirname, '../../plugins/core/auth/CSSO/plugin.js'));
const REAL_ROOT = path.resolve(__dirname, '../../plugins');

function writePlugin(root, container, name, manifest, js = 'module.exports = {};') {
  const dir = path.join(root, container, 'auth', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'plugin.js'), js);
}
const coreManifest = (provider) => ({ name: provider, type: 'auth', provider, tier: 'core', overridable: false });

test.describe('provider discovery', () => {
  let root;
  test.beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
    writePlugin(root, 'core', 'Good', coreManifest('good'));
    writePlugin(root, 'core', 'Dupe', coreManifest('good'));
    writePlugin(root, 'core', 'NotCoreTier', { ...coreManifest('tiered'), tier: 'community' });
    writePlugin(root, 'core', 'Overridable', { ...coreManifest('over'), overridable: true });
    writePlugin(root, 'core', 'NoId', { ...coreManifest(''), provider: undefined });
    writePlugin(root, 'core', 'Broken', coreManifest('broken'), 'throw new Error("boom")');
    writePlugin(root, 'external', 'Rogue', coreManifest('rogue'));
    writePlugin(root, 'external', 'Shadow', coreManifest('good'));
    writePlugin(root, 'core', 'Ldap', coreManifest('ldap'));
    writePlugin(root, 'core', 'Impostor', coreManifest('local'));
  });
  test.afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    providers.loadProviders(REAL_ROOT);
  });

  test('loads only core, non-overridable providers with a unique id', () => {
    expect(providers.loadProviders(root)).toEqual(['good', 'ldap']);
    // Discovery is alphabetical, so the first 'good' wins
    expect(providers.getProvider('good').name).toBe('Dupe');
    for (const id of ['tiered', 'over', 'broken', 'rogue']) expect(providers.getProvider(id)).toBeNull();
  });

  test('any id is allowed except the built-in ids from other folders', () => {
    providers.loadProviders(root);
    expect(providers.getProvider('ldap').name).toBe('Ldap');
    expect(providers.getProvider('local')).toBeNull();
  });

  test('the shipped providers are local and csso', () => {
    expect(providers.loadProviders(REAL_ROOT).sort()).toEqual(['csso', 'local']);
    for (const id of ['local', 'csso']) {
      const m = providers.getProvider(id).manifest;
      expect(m).toMatchObject({ type: 'auth', tier: 'core', overridable: false, required: true });
    }
  });
});

test.describe('AUTH_PROVIDERS validation against the registry', () => {
  test.beforeAll(() => providers.loadProviders(REAL_ROOT));

  test('accepts discovered providers', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["local","csso"]' })).toEqual([]);
  });

  test('unknown providers list what is available', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["okta"]' }).join())
      .toMatch(/unknown provider 'okta'\. Available: .*local/);
  });

  test('csso warns when CSSO_PROXY_SECRET is unset', () => {
    expect(providers.providerWarnings(['csso'], {}).join()).toMatch(/CSSO_PROXY_SECRET/);
    expect(providers.providerWarnings(['csso', 'local'], { CSSO_PROXY_SECRET: 'x' })).toEqual([]);
    expect(providers.providerWarnings(['local'], {})).toEqual([]);
  });

  test('csso without local warns that local admins lose /configure', () => {
    expect(providers.providerWarnings(['csso'], { CSSO_PROXY_SECRET: 'x' }).join()).toMatch(/does not include local/);
    expect(providers.providerWarnings(['csso', 'local'], { CSSO_PROXY_SECRET: 'x' })).toEqual([]);
  });
});

test.describe('identities', () => {
  test('normalizeIdentity requires a subject and cleans groups', () => {
    expect(providers.normalizeIdentity('p', null)).toBeNull();
    expect(providers.normalizeIdentity('p', { subject: '' })).toBeNull();
    expect(providers.normalizeIdentity('p', { subject: 42, groups: ['b', 'a', 'a', '', 7] })).toEqual({
      provider: 'p', subject: '42', username: '42', email: null, groups: ['a', 'b'], session: null,
    });
  });

  const req = (headers) => ({ get: (h) => headers[h] });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

  test('csso reads X-Sub, true-valued X-Groups and X-Session', () => {
    delete process.env.CSSO_PROXY_SECRET;
    expect(csso.identify(req({}))).toBeNull();
    expect(csso.identify(req({ 'X-Sub': 'jdoe', 'X-Groups': b64({ ops: true, old: false }), 'X-Session': 's1' })))
      .toEqual({ subject: 'jdoe', username: 'jdoe', groups: ['ops'], session: 's1' });
    expect(csso.identify(req({ 'X-Sub': 'jdoe', 'X-Groups': 'not base64 json' })).groups).toEqual([]);
  });

  test('csso only trusts headers carrying the proxy secret when one is set', () => {
    process.env.CSSO_PROXY_SECRET = 'shh'; // pragma: allowlist secret
    try {
      expect(csso.identify(req({ 'X-Sub': 'jdoe' }))).toBeNull();
      expect(csso.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'nope' }))).toBeNull(); // pragma: allowlist secret
      expect(csso.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'shh' })).subject).toBe('jdoe'); // pragma: allowlist secret
    } finally {
      delete process.env.CSSO_PROXY_SECRET;
    }
  });
});

// In-memory stand-ins for the Sequelize models linkIdentity/syncGroups use
function fakeModels({ users = [], links = [], groups = [], members = [] } = {}) {
  const match = (row, where) =>
    Object.entries(where).every(([k, v]) => (Array.isArray(v) ? v.includes(row[k]) : row[k] === v));
  const table = (rows) => ({
    rows,
    findOne: async ({ where }) => rows.find((r) => match(r, where)) || null,
    findAll: async ({ where }) => rows.filter((r) => match(r, where)),
    create: async (r) => { const row = { id: rows.length + 100, ...r }; rows.push(row); return row; },
    bulkCreate: async (list) => list.forEach((r) => rows.push(r)),
    destroy: async ({ where }) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); },
  });
  return { User: table(users), AuthIdentity: table(links), AuthGroup: table(groups), AuthGroupMember: table(members) };
}
const identity = (o) => providers.normalizeIdentity('keycloak', o);

test.describe('account linking', () => {
  test('first login creates an account and a link; later logins reuse it', async () => {
    const m = fakeModels();
    const first = await providers.linkIdentity(identity({ subject: 'sub-1', username: 'kc_user' }), m);
    expect(m.User.rows).toHaveLength(1);
    expect(m.User.rows[0].password).toMatch(/^[0-9a-f]{64}$/);
    expect(m.AuthIdentity.rows[0]).toMatchObject({ provider: 'keycloak', subject: 'sub-1', user_id: first.id });
    // Renamed at the provider: still the same account
    const again = await providers.linkIdentity(identity({ subject: 'sub-1', username: 'renamed' }), m);
    expect(again.id).toBe(first.id);
    expect(m.User.rows).toHaveLength(1);
  });

  test('never takes over an existing account with the same username', async () => {
    const existing = { id: 1, username: 'admin', password: '$2a$10$unchangedhash' };
    const m = fakeModels({ users: [existing] });
    await expect(providers.linkIdentity(identity({ subject: 'x', username: 'admin' }), m))
      .rejects.toThrow(/already belongs to another account/);
    expect(m.User.rows).toEqual([{ id: 1, username: 'admin', password: '$2a$10$unchangedhash' }]);
    expect(m.AuthIdentity.rows).toHaveLength(0);
  });

  test('the same subject at a different provider is a different identity', async () => {
    const m = fakeModels({ users: [{ id: 5, username: 'a' }], links: [{ provider: 'cognito', subject: 's', user_id: 5 }] });
    await expect(providers.linkIdentity(identity({ subject: 's', username: 'a' }), m)).rejects.toThrow();
  });
});

test.describe('provider accounts keep their email', () => {
  test('a new account gets the identity email unless another account has it', async () => {
    const m = fakeModels({ users: [{ id: 1, username: 'other', email: 'taken@example.test' }] });
    await providers.linkIdentity(identity({ subject: 's1', username: 'carol', email: 'carol@example.test' }), m);
    await providers.linkIdentity(identity({ subject: 's2', username: 'dave', email: 'taken@example.test' }), m);
    expect(m.User.rows.find((u) => u.username === 'carol').email).toBe('carol@example.test');
    expect(m.User.rows.find((u) => u.username === 'dave').email).toBeUndefined();
  });
});

test.describe('login links and returnTo', () => {
  test('returnTo only allows same-site paths', () => {
    expect(providers.returnTo('/?mission=A')).toBe('/?mission=A');
    for (const bad of ['//evil.test', 'https://evil.test', '/a\\b', '/a b', null, 42]) expect(providers.returnTo(bad)).toBe('/');
  });

  test('providers with a login_path get a login link', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
    try {
      writePlugin(root, 'core', 'Button', { ...coreManifest('button'), display_name: 'Button SSO', login_path: '/login' });
      writePlugin(root, 'core', 'Labelled', { ...coreManifest('labelled'), login_path: '/start', login_label: 'Use Labelled', logout_url: 'https://idp.test/out' });
      writePlugin(root, 'core', 'Headers', coreManifest('headers'));
      providers.loadProviders(root);
      expect(providers.loginLinks(['button', 'labelled', 'headers'])).toEqual([
        { id: 'button', label: 'Log in with Button SSO', path: 'api/auth/button/login' },
        { id: 'labelled', label: 'Use Labelled', path: 'api/auth/labelled/start' },
      ]);
      expect(providers.logoutUrl('labelled')).toBe('https://idp.test/out');
      expect(providers.logoutUrl('button')).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      providers.loadProviders(REAL_ROOT);
    }
  });
});

test.describe('provider hook results', () => {
  test('non-array, async and throwing validate() results are reported, and duplicate ids refuse startup', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
    try {
      writePlugin(root, 'core', 'Str', coreManifest('str'), 'module.exports = { validate: () => "STR_URL must be set" };');
      writePlugin(root, 'core', 'Async', coreManifest('async'), 'module.exports = { validate: async () => [] };');
      writePlugin(root, 'core', 'Throws', coreManifest('throws'), 'module.exports = { validate: () => { throw new Error("bad env") } };');
      writePlugin(root, 'core', 'Proxy', { ...coreManifest('proxy'), login_url: 'https://proxy.test/login', login_path: 'nope' });
      writePlugin(root, 'core', 'Twin1', coreManifest('twin'));
      writePlugin(root, 'core', 'Twin2', coreManifest('twin'));
      providers.loadProviders(root);
      const problems = providers.validateProviders(['str', 'async', 'throws']);
      expect(problems).toContain('STR_URL must be set');
      expect(problems.join()).toMatch(/'async': validate\(env\) must return an array of strings synchronously/);
      expect(problems.join()).toMatch(/'throws': validate\(env\) threw bad env/);
      expect(providers.loginLinks(['proxy'])).toEqual([{ id: 'proxy', label: 'Log in with Proxy', url: 'https://proxy.test/login' }]);
      expect(providers.providerWarnings(['proxy']).join()).toMatch(/login_path" must start with/);
      expect(providers.conflictingProviders()).toEqual(['twin']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      providers.loadProviders(REAL_ROOT);
    }
  });
});

test.describe('provider group sync', () => {
  test('membership of provider-sourced groups mirrors the reported groups', async () => {
    const m = fakeModels({
      groups: [
        { id: 1, source: 'keycloak', external_name: 'm20-ops' },
        { id: 2, source: 'keycloak', external_name: 'm20-sci' },
        { id: 3, source: 'local', external_name: null },
        { id: 4, source: 'csso', external_name: 'm20-ops' },
      ],
      members: [{ group_id: 2, user_id: 9 }, { group_id: 3, user_id: 9 }, { group_id: 4, user_id: 9 }],
    });
    await providers.syncGroups(9, identity({ subject: 's', groups: ['m20-ops', 'unmapped'] }), m);
    expect(m.AuthGroupMember.rows.map((r) => r.group_id).sort()).toEqual([1, 3, 4]);
  });
});
