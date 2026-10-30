/**
 * Unit tests for login provider plugins (plugins/core/auth/*).
 * Source: API/permissions/providers.js, plugins/core/auth/Proxy/plugin.js
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const os = require('os');
const path = require('path');

const providers = require(path.resolve(__dirname, '../../API/permissions/providers.js'));
const siteAccess = require(path.resolve(__dirname, '../../API/permissions/siteAccess.js'));
const proxy = require(path.resolve(__dirname, '../../plugins/core/auth/Proxy/plugin.js'));
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

  test('the shipped providers are local and proxy', () => {
    expect(providers.loadProviders(REAL_ROOT).sort()).toEqual(['local', 'proxy']);
    for (const id of ['local', 'proxy']) {
      const m = providers.getProvider(id).manifest;
      expect(m).toMatchObject({ type: 'auth', tier: 'core', overridable: false, required: true });
    }
  });
});

test.describe('AUTH_PROVIDERS validation against the registry', () => {
  test.beforeAll(() => providers.loadProviders(REAL_ROOT));

  test('accepts discovered providers', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["local","proxy"]', PROXY_SECRET: 'x' })).toEqual([]); // pragma: allowlist secret
  });

  test('proxy refuses startup without PROXY_SECRET unless another trust mode is chosen', () => {
    const v = (env) => siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["proxy","local"]', ...env });
    expect(v({}).join()).toMatch(/PROXY_SECRET must be set.*PROXY_TRUST=network/);
    expect(v({ PROXY_TRUST: 'secret' }).join()).toMatch(/PROXY_SECRET must be set/);
    expect(v({ PROXY_TRUST: 'network' })).toEqual([]);
    expect(v({ PROXY_TRUST: 'ips' }).join()).toMatch(/PROXY_TRUSTED_IPS/);
    expect(v({ PROXY_TRUST: 'ips', PROXY_TRUSTED_IPS: '["10.0.0.5","10.1.0.0/16","::1"]' })).toEqual([]);
    expect(v({ PROXY_TRUST: 'ips', PROXY_TRUSTED_IPS: '10.0.0.5, 10.1.0.0/16' })).toEqual([]);
    for (const bad of ['["nope"]', '["10.0.0.0/33"]', '[]', '{}'])
      expect(v({ PROXY_TRUST: 'ips', PROXY_TRUSTED_IPS: bad }).join()).toMatch(/PROXY_TRUSTED_IPS/);
    expect(v({ PROXY_TRUST: 'bogus' }).join()).toMatch(/PROXY_TRUST must be one of/);
  });

  test('proxy validates header names, group format and URLs', () => {
    const v = (env) => siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["proxy"]', PROXY_TRUST: 'network', ...env }).join();
    expect(v({ PROXY_USER_HEADER: 'bad header' })).toMatch(/PROXY_USER_HEADER must be an HTTP header name/);
    expect(v({ PROXY_GROUPS_HEADER: 'x-sub' })).toMatch(/must all be different/);
    expect(v({ PROXY_GROUPS_FORMAT: 'xml' })).toMatch(/PROXY_GROUPS_FORMAT must be one of/);
    expect(v({ PROXY_STATUS_URL: 'javascript:alert(1)' })).toMatch(/PROXY_STATUS_URL/);
    expect(v({ PROXY_LOGOUT_URL: '//evil.example' })).toMatch(/PROXY_LOGOUT_URL/);
    expect(v({ PROXY_STATUS_URL: 'off', PROXY_LOGOUT_URL: 'https://sso.example/logout' })).not.toMatch(/URL/);
  });

  test('unknown providers list what is available', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["okta"]' }).join())
      .toMatch(/unknown provider 'okta'\. Available: .*local/);
  });

  test('proxy warns when it trusts the network, or when PROXY_SECRET is ignored', () => {
    expect(providers.providerWarnings(['proxy', 'local'], { PROXY_TRUST: 'network' }).join()).toMatch(/PROXY_TRUST=network/);
    expect(providers.providerWarnings(['proxy', 'local'], { PROXY_TRUST: 'ips', PROXY_SECRET: 'x' }).join()).toMatch(/PROXY_SECRET is set but ignored/); // pragma: allowlist secret
    expect(providers.providerWarnings(['proxy', 'local'], { PROXY_SECRET: 'x' })).toEqual([]); // pragma: allowlist secret
    expect(providers.providerWarnings(['local'], {})).toEqual([]);
  });

  test('proxy without local warns that local admins lose /configure', () => {
    expect(providers.providerWarnings(['proxy'], { PROXY_SECRET: 'x' }).join()).toMatch(/does not include local/);
    expect(providers.providerWarnings(['proxy', 'local'], { PROXY_SECRET: 'x' })).toEqual([]);
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

  const req = (headers, remoteAddress = '203.0.113.9') => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return { get: (h) => lower[String(h).toLowerCase()], socket: { remoteAddress } };
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
  const PROXY_ENVS = ['PROXY_TRUST', 'PROXY_SECRET', 'PROXY_SECRET_HEADER', 'PROXY_TRUSTED_IPS', 'PROXY_USER_HEADER',
    'PROXY_GROUPS_HEADER', 'PROXY_GROUPS_FORMAT', 'PROXY_SESSION_HEADER'];
  const withProxyEnv = (env, fn) => {
    const saved = Object.fromEntries(PROXY_ENVS.map((k) => [k, process.env[k]]));
    PROXY_ENVS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    try {
      fn();
    } finally {
      PROXY_ENVS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
    }
  };

  test('proxy (PROXY_TRUST=network) reads X-Sub, true-valued X-Groups and X-Session like AUTH=csso', () =>
    withProxyEnv({ PROXY_TRUST: 'network' }, () => {
      expect(proxy.identify(req({}))).toBeNull();
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-Groups': b64({ ops: true, old: false }), 'X-Session': 's1' })))
        .toEqual({ subject: 'jdoe', username: 'jdoe', groups: ['ops'], strictGroups: ['ops'], session: 's1' });
      expect(proxy.identify(req({ 'X-Sub': 'jdoe' }))).toEqual({ subject: 'jdoe', username: 'jdoe', groups: [], strictGroups: [], session: null });
    }));

  test('like AUTH=csso, any truthy group value is membership; only true counts as strict (lead)', () =>
    withProxyEnv({ PROXY_TRUST: 'network' }, () => {
      const id = proxy.identify(req({ 'X-Sub': 'a', 'X-Groups': b64({ A: 'true', B: 1, C: { m: true }, D: false, E: 0, F: '', L: true }) }));
      expect(id.groups).toEqual(['A', 'B', 'C', 'L']);
      expect(id.strictGroups).toEqual(['L']);
      expect(providers.normalizeIdentity('proxy', id).strictGroups).toEqual(['L']);
    }));

  test('proxy refuses an identity whose groups header cannot be read', () =>
    withProxyEnv({ PROXY_TRUST: 'network' }, () => {
      for (const bad of ['not base64 json', b64('ops'), b64(['ops']), b64(null), 'bnVsbA'])
        expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-Groups': bad }))).toBeNull();
    }));

  test('proxy trusts nothing by default: the secret is required', () => {
    withProxyEnv({}, () => {
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': '' }))).toBeNull();
    });
    withProxyEnv({ PROXY_SECRET: 'shh' }, () => { // pragma: allowlist secret
      expect(proxy.identify(req({ 'X-Sub': 'jdoe' }))).toBeNull();
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'nope' }))).toBeNull(); // pragma: allowlist secret
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'shhh' }))).toBeNull(); // pragma: allowlist secret
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'shh' })).subject).toBe('jdoe'); // pragma: allowlist secret
    });
  });

  test('PROXY_TRUST=ips only trusts the listed addresses and ranges', () =>
    withProxyEnv({ PROXY_TRUST: 'ips', PROXY_TRUSTED_IPS: '["10.0.0.5","10.1.0.0/16","::1"]' }, () => {
      const h = { 'X-Sub': 'jdoe' };
      expect(proxy.identify(req(h, '10.0.0.5')).subject).toBe('jdoe');
      expect(proxy.identify(req(h, '::ffff:10.1.2.3')).subject).toBe('jdoe');
      expect(proxy.identify(req(h, '::1')).subject).toBe('jdoe');
      expect(proxy.identify(req(h, '10.0.0.6'))).toBeNull();
      expect(proxy.identify(req(h, '10.2.0.1'))).toBeNull();
      expect(proxy.identify(req(h, ''))).toBeNull();
      // The secret header does not stand in for the address
      expect(proxy.identify(req({ ...h, 'X-MMGIS-Proxy-Secret': 'x' }, '198.51.100.1'))).toBeNull(); // pragma: allowlist secret
    }));

  test('header names and the groups format are configurable', () =>
    withProxyEnv({
      PROXY_SECRET: 'shh', PROXY_SECRET_HEADER: 'X-Edge-Key', PROXY_USER_HEADER: 'X-Forwarded-User', // pragma: allowlist secret
      PROXY_GROUPS_HEADER: 'X-Forwarded-Groups', PROXY_GROUPS_FORMAT: 'list', PROXY_SESSION_HEADER: 'X-Edge-Session',
    }, () => {
      const h = { 'X-Edge-Key': 'shh', 'X-Forwarded-User': 'jdoe', 'X-Forwarded-Groups': 'ops, sci,,', 'X-Edge-Session': 'e1' }; // pragma: allowlist secret
      expect(proxy.identify(req(h))).toEqual({ subject: 'jdoe', username: 'jdoe', groups: ['ops', 'sci'], strictGroups: ['ops', 'sci'], session: 'e1' });
      // The default names no longer identify anyone
      expect(proxy.identify(req({ 'X-Sub': 'jdoe', 'X-MMGIS-Proxy-Secret': 'shh' }))).toBeNull(); // pragma: allowlist secret
      expect(proxy.identityHeaders()).toEqual(['x-forwarded-user', 'x-forwarded-groups', 'x-edge-session', 'x-edge-key']);
    }));

  test('PROXY_GROUPS_FORMAT=json accepts an object of booleans or an array of names', () =>
    withProxyEnv({ PROXY_TRUST: 'network', PROXY_GROUPS_FORMAT: 'json' }, () => {
      expect(proxy.identify(req({ 'X-Sub': 'a', 'X-Groups': '{"ops":true,"old":false}' })).groups).toEqual(['ops']);
      expect(proxy.identify(req({ 'X-Sub': 'a', 'X-Groups': '["ops",3,"sci"]' })).groups).toEqual(['ops', 'sci']);
      expect(proxy.identify(req({ 'X-Sub': 'a', 'X-Groups': b64({ ops: true }) }))).toBeNull();
    }));
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
        { id: 4, source: 'proxy', external_name: 'm20-ops' },
      ],
      members: [{ group_id: 2, user_id: 9 }, { group_id: 3, user_id: 9 }, { group_id: 4, user_id: 9 }],
    });
    await providers.syncGroups(9, identity({ subject: 's', groups: ['m20-ops', 'unmapped'] }), m);
    expect(m.AuthGroupMember.rows.map((r) => r.group_id).sort()).toEqual([1, 3, 4]);
  });
});
