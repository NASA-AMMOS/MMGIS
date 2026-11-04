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

// The shipped Local and Proxy providers plus 'dir', a stand-in directory provider with every optional hook,
// so these tests of the shared provider code don't depend on any one directory plugin
const DIR_PLUGIN = `module.exports = {
  loginForm: (env) => ({ title: env.DIR_DISPLAY_NAME, usernameLabel: env.DIR_USERNAME_LABEL, hint: env.DIR_LOGIN_HINT }),
  lookupTimeoutMs: () => 25000,
  subjectFits: () => true,
  subjectSetting: () => 'entryuuid',
  subjectPermanent: () => true,
  groupName: (name) => String(name).split(',').map((p) => p.trim().toLowerCase()).join(','),
  relinkUsername: (name) => String(name).normalize('NFKC').trim(),
  lookup: async () => undefined,
  locate: async () => undefined,
  findSubject: async () => undefined,
};`;
let fixture = null;
function fixtureRoot() {
  if (fixture) return fixture;
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
  for (const name of ['Local', 'Proxy']) {
    const real = path.join(REAL_ROOT, 'core', 'auth', name);
    writePlugin(fixture, 'core', name, JSON.parse(fs.readFileSync(path.join(real, 'plugin.json'), 'utf8')), `module.exports = require(${JSON.stringify(path.join(real, 'plugin.js'))});`);
  }
  writePlugin(fixture, 'core', 'Dir', { ...coreManifest('dir'), display_name: 'Directory', login_path: '/login', login_form: true, login_icon: 'card-account-details-outline' }, DIR_PLUGIN);
  return fixture;
}
test.afterAll(() => fixture && fs.rmSync(fixture, { recursive: true, force: true }));

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

  test('the shipped providers include local and proxy, and all are core and required', () => {
    const shipped = providers.loadProviders(REAL_ROOT);
    expect(shipped).toEqual(expect.arrayContaining(['local', 'proxy']));
    for (const id of shipped) {
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

  test('AUTH_PROVIDER_NEW_ACCOUNTS accepts only true or false, so a misspelt pause is not ignored', () => {
    const v = (value) => siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["local"]', AUTH_PROVIDER_NEW_ACCOUNTS: value });
    expect(v('false')).toEqual([]);
    expect(v('true')).toEqual([]);
    expect(v('')).toEqual([]);
    for (const bad of ['FALSE', '0', 'no']) expect(v(bad).join()).toMatch(/AUTH_PROVIDER_NEW_ACCOUNTS must be true or false/);
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
function fakeModels({ users = [], links = [], groups = [], members = [], meta = [] } = {}) {
  const { Op } = require('sequelize');
  const like = (pattern) => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`);
  const match = (row, where) =>
    Object.entries(where).every(([k, v]) =>
      Array.isArray(v) ? v.includes(row[k]) : v && v[Op.like] ? like(v[Op.like]).test(row[k]) : row[k] === v
    );
  const table = (rows) => ({
    rows,
    findOne: async ({ where }) => rows.find((r) => match(r, where)) || null,
    findAll: async ({ where } = {}) => rows.filter((r) => !where || match(r, where)),
    create: async (r) => { const row = { id: rows.length + 100, ...r }; rows.push(row); return row; },
    bulkCreate: async (list) => list.forEach((r) => rows.push(r)),
    update: async (fields, { where }) => rows.filter((r) => match(r, where)).forEach((r) => Object.assign(r, fields)),
    destroy: async ({ where }) => { let n = 0; for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) { rows.splice(i, 1); n++; } return n; },
  });
  return { User: table(users), AuthIdentity: table(links), AuthGroup: table(groups), AuthGroupMember: table(members), AuthMeta: table(meta) };
}
const identity = (o) => providers.normalizeIdentity('keycloak', o);

test.describe('account linking', () => {
  const relinkModels = (value) =>
    fakeModels({
      users: [{ id: 1, username: 'carol' }],
      links: [{ provider: 'keycloak', subject: 'old', user_id: 1 }],
      meta: [{ key: 'relink:keycloak:1', value: { username: 'carol', by: 'admin', expires_at: new Date(Date.now() + 60000).toISOString(), ...value } }],
    });

  test('an allowed relink lets the next login with that username claim the account, once', async () => {
    const m = relinkModels();
    const user = await providers.linkIdentity(identity({ subject: 'new', username: 'carol' }), m);
    expect(user.id).toBe(1);
    expect(m.AuthIdentity.rows).toEqual([expect.objectContaining({ provider: 'keycloak', subject: 'new', user_id: 1 })]);
    expect(m.AuthMeta.rows).toEqual([]);
    await expect(providers.linkIdentity(identity({ subject: 'newer', username: 'carol' }), m)).rejects.toThrow(providers.LinkError);
  });

  test('a relink is cancelled, not claimed, if its account became a SuperAdmin after it was allowed', async () => {
    const m = { ...relinkModels(), isSuperAdmin: async (id) => id === 1 };
    await expect(providers.linkIdentity(identity({ subject: 'new', username: 'carol' }), m)).rejects.toThrow(/became a SuperAdmin/);
    expect(m.AuthMeta.rows).toEqual([]);
    expect(m.AuthIdentity.rows).toEqual([expect.objectContaining({ subject: 'old', user_id: 1 })]);
    // Allowed while it was already one (only a SuperAdmin can do that): claimed as usual
    const ok = { ...relinkModels({ superadmin: true }), isSuperAdmin: async (id) => id === 1 };
    expect((await providers.linkIdentity(identity({ subject: 'new', username: 'carol' }), ok)).id).toBe(1);
  });

  test('a relink can name a different username at the provider, and signs the old login out', async () => {
    const ended = [];
    const m = { ...relinkModels({ username: 'Carol.Smith' }), endSessionsOf: async (id) => ended.push(id) };
    const user = await providers.linkIdentity(identity({ subject: 'new', username: 'carol.smith' }), m);
    expect(user).toMatchObject({ id: 1, username: 'carol' });
    expect(ended).toEqual([1]);
    expect(m.User.rows[0].password).toMatch(/^[0-9a-f]{64}$/);
  });

  test('a relink pinned to a subject is refused for any other entry with that username', async () => {
    const m = relinkModels({ subject: 'expected' });
    await expect(providers.linkIdentity(identity({ subject: 'planted', username: 'carol' }), m)).rejects.toThrow(providers.LinkError);
    expect((await providers.linkIdentity(identity({ subject: 'expected', username: 'carol' }), m)).id).toBe(1);
  });

  test('a login through the existing link drops a relink allowed for that account', async () => {
    const m = relinkModels();
    expect((await providers.linkIdentity(identity({ subject: 'old', username: 'carol' }), m)).id).toBe(1);
    expect(m.AuthMeta.rows).toEqual([]);
    await expect(providers.linkIdentity(identity({ subject: 'newcomer', username: 'carol' }), m)).rejects.toThrow(providers.LinkError);
  });

  test('a concurrent first login that loses the race uses the account the other one created', async () => {
    const m = fakeModels();
    const create = m.User.create;
    m.User.create = async (r) => {
      m.User.create = create;
      await create(r);
      await m.AuthIdentity.create({ provider: 'keycloak', subject: 'race', username: r.username, user_id: 100 });
      throw Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' });
    };
    expect(await providers.linkIdentity(identity({ subject: 'race', username: 'dora' }), m)).toMatchObject({ id: 100, username: 'dora' });
  });

  test('a concurrent first login that sees the account only once the other one has created it uses that account', async () => {
    const m = fakeModels();
    m.usernameTaken = async (username) => {
      delete m.usernameTaken;
      const user = await m.User.create({ username });
      await m.AuthIdentity.create({ provider: 'keycloak', subject: 'race2', username, user_id: user.id });
      return { id: user.id };
    };
    expect(await providers.linkIdentity(identity({ subject: 'race2', username: 'dora' }), m)).toMatchObject({ id: 100, username: 'dora' });
    expect(m.User.rows).toHaveLength(1);
  });

  test('a recreated entry with a new ID but the name of a linked account is refused, not given a new empty account', async () => {
    const m = fakeModels({ users: [{ id: 1, username: 'bob' }], links: [{ provider: 'keycloak', subject: 'old', username: 'Robert', user_id: 1 }] });
    await expect(providers.linkIdentity(identity({ subject: 'new', username: 'robert' }), m)).rejects.toThrow(/already signs in to account 1/);
    expect(m.User.rows).toHaveLength(1);
  });

  test('a relink pinned to an entry the same username no longer signs in from is flagged as stale', async () => {
    const m = relinkModels({ subject: 'before-rebuild' });
    await expect(providers.linkIdentity(identity({ subject: 'after-rebuild', username: 'carol' }), m)).rejects.toThrow(providers.LinkError);
    expect(m.AuthMeta.rows[0].value).toMatchObject({ subject: 'before-rebuild', stale: { subject: 'after-rebuild', at: expect.any(String) } });
  });

  test('a relink pinned to an entry is claimed by that entry even after it was renamed', async () => {
    const m = relinkModels({ subject: 'new' });
    expect((await providers.linkIdentity(identity({ subject: 'new', username: 'carol2' }), m)).id).toBe(1);
    const other = relinkModels({ subject: 'new' });
    await expect(providers.linkIdentity(identity({ subject: 'look-alike', username: 'carol' }), other)).rejects.toThrow(providers.LinkError);
  });

  test('a relink is refused once expired, for another username, or for another provider', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    await expect(providers.linkIdentity(identity({ subject: 'new', username: 'carol' }), relinkModels({ expires_at: past }))).rejects.toThrow(providers.LinkError);
    const other = relinkModels({ username: 'someone_else' });
    await expect(providers.linkIdentity(identity({ subject: 'new', username: 'carol' }), other)).rejects.toThrow(providers.LinkError);
    const m = relinkModels();
    await expect(providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'new', username: 'carol' }), m)).rejects.toThrow(providers.LinkError);
    expect(m.AuthIdentity.rows).toEqual([expect.objectContaining({ subject: 'old' })]);
  });

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
    // The rename is recorded on the link; the MMGIS username, which drawings are keyed by, stays
    expect(m.User.rows[0].username).toBe('kc_user');
    expect(m.AuthIdentity.rows[0]).toMatchObject({ username: 'renamed', last_login_at: expect.any(Date) });
  });

  test('AUTH_PROVIDER_NEW_ACCOUNTS=false refuses a first sign-in but keeps existing links working', async () => {
    const m = fakeModels();
    const first = await providers.linkIdentity(identity({ subject: 'sub-1', username: 'kc_user' }), m);
    process.env.AUTH_PROVIDER_NEW_ACCOUNTS = 'false';
    try {
      await expect(providers.linkIdentity(identity({ subject: 'sub-2', username: 'newcomer' }), m)).rejects.toThrow(/AUTH_PROVIDER_NEW_ACCOUNTS=false/);
      expect(m.User.rows).toHaveLength(1);
      expect((await providers.linkIdentity(identity({ subject: 'sub-1', username: 'kc_user' }), m)).id).toBe(first.id);
    } finally {
      delete process.env.AUTH_PROVIDER_NEW_ACCOUNTS;
    }
  });

  test('a subject or username longer than MMGIS can store is refused, not a server error', async () => {
    const m = fakeModels();
    await expect(providers.linkIdentity(identity({ subject: 'x'.repeat(256), username: 'long' }), m)).rejects.toThrow(providers.LinkError);
    await expect(providers.linkIdentity(identity({ subject: 's', username: 'u'.repeat(256) }), m)).rejects.toThrow(providers.LinkError);
    expect(m.User.rows).toHaveLength(0);
  });

  test('a backslash, which would end the page\'s quoted username early, counts as unsafe', () => {
    expect(providers.unsafeUsername('alice\\')).toBe(true);
    expect(providers.unsafeUsername('alice')).toBe(false);
  });

  test('never creates an account whose username has markup, commas (Draw editor lists) or control characters', async () => {
    const m = fakeModels();
    for (const username of ['evil<img src=x onerror=alert(1)>', 'a"b', 'a`b', 'a\nb', 'smith, john'])
      await expect(providers.linkIdentity(identity({ subject: `s-${username}`, username }), m)).rejects.toThrow(/can't/);
    expect(m.User.rows).toHaveLength(0);
  });

  test("never creates an account named 'group' (Draw's shared files) or 'guest' (signed-out visitors)", async () => {
    const m = fakeModels();
    for (const username of ['group', ' Group ', 'ＧＲＯＵＰ', 'guest', 'GUEST'])
      await expect(providers.linkIdentity(identity({ subject: `s-${username}`, username }), m)).rejects.toThrow(/reserved/);
    expect(m.User.rows).toHaveLength(0);
    expect(m.AuthIdentity.rows).toHaveLength(0);
  });

  test('never takes over an existing account with the same username', async () => {
    const existing = { id: 1, username: 'admin', password: '$2a$10$unchangedhash' };
    const m = fakeModels({ users: [existing] });
    await expect(providers.linkIdentity(identity({ subject: 'x', username: 'admin' }), m))
      .rejects.toThrow(/already belongs to account .* allow a relink to \w+/);
    const err = await providers.linkIdentity(identity({ subject: 'x', username: 'admin' }), m).catch((e) => e);
    expect(err).toBeInstanceOf(providers.LinkError);
    expect(err.userMessage).not.toMatch(/'admin'|already|belongs/);
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

test.describe('login forms', () => {
  const saved = {};
  test.beforeEach(() => {
    for (const k of ['AUTH_LOCAL_LOGIN', 'DIR_DISPLAY_NAME', 'DIR_USERNAME_LABEL', 'DIR_LOGIN_HINT']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    providers.loadProviders(fixtureRoot());
  });
  test.afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('form providers share the form in AUTH_PROVIDERS order and get no login button', () => {
    process.env.DIR_DISPLAY_NAME = 'Example Directory';
    process.env.DIR_USERNAME_LABEL = 'Example username';
    process.env.DIR_LOGIN_HINT = 'Same as your email.';
    expect(providers.loginForms(['dir', 'local', 'proxy'])).toEqual([
      { id: 'dir', title: 'Example Directory', usernameLabel: 'Example username', hint: 'Same as your email.', icon: 'card-account-details-outline', path: 'api/auth/dir/login' },
      { id: 'local', title: 'MMGIS account', usernameLabel: 'Username', hint: '', icon: 'account-key-outline', path: 'api/auth/local/login' },
    ]);
    expect(providers.loginForms(['local', 'dir']).map((f) => f.id)).toEqual(['local', 'dir']);
    expect(providers.loginLinks(['dir', 'local'])).toEqual([]);
    expect(providers.providerLabel('dir')).toBe('Example Directory');
    expect(providers.providerLabel('proxy')).toBe('Authenticating proxy');
  });

  test('with AUTH_LOCAL_LOGIN=admins, local accounts are only offered at Configure sign-in', () => {
    process.env.AUTH_LOCAL_LOGIN = 'admins';
    expect(providers.loginForms(['dir', 'local']).map((f) => f.id)).toEqual(['dir']);
    const configure = providers.loginForms(['dir', 'local'], { configure: true });
    expect(configure.map((f) => f.id)).toEqual(['dir', 'local']);
    expect(configure[1].hint).toMatch(/admin role/);
  });

  test('wording from a provider is sanitized: blank labels fall back and bad icons are dropped', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
    try {
      writePlugin(root, 'core', 'Form', { ...coreManifest('form'), display_name: 'Form Dir', login_path: '/login', login_form: true, login_icon: 'bad icon"' },
        'module.exports = { loginForm: () => ({ usernameLabel: "  " }) };');
      writePlugin(root, 'core', 'Throws', { ...coreManifest('throws'), login_path: '/login', login_form: true }, 'module.exports = { loginForm: () => { throw new Error("x") } };');
      providers.loadProviders(root);
      expect(providers.loginForms(['form', 'throws'])).toEqual([
        { id: 'form', title: 'Form Dir', usernameLabel: 'Username', hint: '', icon: 'account-outline', path: 'api/auth/form/login' },
        { id: 'throws', title: 'Throws', usernameLabel: 'Username', hint: '', icon: 'account-outline', path: 'api/auth/throws/login' },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      providers.loadProviders(fixtureRoot());
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

  test('group names match exactly, including case', async () => {
    const m = fakeModels({ groups: [{ id: 1, source: 'keycloak', external_name: 'm20-ops' }], members: [] });
    await providers.syncGroups(9, identity({ subject: 's', groups: ['M20-Ops'] }), m);
    expect(m.AuthGroupMember.rows).toEqual([]);
  });
});

test.describe('identify', () => {
  test('a provider whose identify() never settles is skipped after 5 s instead of holding the request', async () => {
    test.setTimeout(20000);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-auth-'));
    const saved = process.env.AUTH_PROVIDERS;
    try {
      writePlugin(root, 'core', 'Hang', coreManifest('hang'), 'module.exports = { identify: () => new Promise(() => {}) };');
      writePlugin(root, 'core', 'Ok', coreManifest('ok'), 'module.exports = { identify: () => ({ subject: "u1", username: "u1" }) };');
      providers.loadProviders(root);
      process.env.AUTH_PROVIDERS = '["hang","ok"]';
      const started = Date.now();
      const id = await providers.identify({ headers: {}, get: () => undefined, socket: {} });
      expect(id && id.provider).toBe('ok');
      expect(Date.now() - started).toBeLessThan(10000);
    } finally {
      if (saved === undefined) delete process.env.AUTH_PROVIDERS;
      else process.env.AUTH_PROVIDERS = saved;
      fs.rmSync(root, { recursive: true, force: true });
      providers.loadProviders(REAL_ROOT);
    }
  });
});

test.describe('provider rechecks', () => {
  let dir, lookup, savedProviders;
  test.beforeAll(() => {
    providers.loadProviders(fixtureRoot());
    dir = providers.getProvider('dir').impl;
    lookup = dir.lookup;
    savedProviders = process.env.AUTH_PROVIDERS;
    process.env.AUTH_PROVIDERS = '["dir","local"]';
  });
  test.beforeEach(() => providers.forgetRechecks());
  test.afterAll(() => {
    dir.lookup = lookup;
    if (savedProviders === undefined) delete process.env.AUTH_PROVIDERS;
    else process.env.AUTH_PROVIDERS = savedProviders;
  });
  const models = (userId) =>
    fakeModels({
      groups: [{ id: 1, source: 'dir', external_name: 'cn=ops,ou=groups,dc=example,dc=org' }],
      members: [{ group_id: 1, user_id: userId }],
      links: [{ provider: 'dir', subject: 'old', user_id: userId }],
    });

  test('an account already not found stays refused while its recheck fails (directory down)', async () => {
    const m = models(9020);
    dir.lookup = async () => null;
    expect(await providers.stillLinked(9020, 'dir', m)).toBe(false);
    providers.forgetRechecks();
    dir.lookup = async () => { throw Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }); };
    expect(await providers.stillLinked(9020, 'dir', m)).toBe(false);
    expect(await providers.stillLinked(9020, 'dir', m, true, true)).toBe('failed');
    // One still linked keeps its access through the same failure
    const n = models(9021);
    providers.forgetRechecks();
    expect(await providers.stillLinked(9021, 'dir', n)).toBe(true);
  });

  test('checking every linked account asks the directory now, even about accounts checked a moment ago', async () => {
    const m = fakeModels({
      links: [
        { provider: 'dir', subject: 'here', user_id: 9010 },
        { provider: 'dir', subject: 'gone', user_id: 9011 },
        { provider: 'local-only', subject: 'x', user_id: 9012 },
      ],
    });
    dir.lookup = async (subject) => (subject === 'here' ? { username: 'here', groups: [] } : null);
    expect(await providers.stillLinked(9011, 'dir', m)).toBe(false);
    m.AuthMeta.rows.length = 0;
    expect(await providers.recheckLinked(m)).toEqual({ checked: 2, missing: 1, failed: 0, unsupported: 0, staleRelinks: 0 });
    dir.lookup = async () => { throw new Error('directory down'); };
    expect(await providers.recheckLinked(m)).toEqual({ checked: 2, missing: 0, failed: 2, unsupported: 0, staleRelinks: 0 });
    dir.lookup = async () => undefined;
    expect(await providers.recheckLinked(m)).toEqual({ checked: 0, missing: 0, failed: 0, unsupported: 2, staleRelinks: 0 });
    expect(m.AuthMeta.rows.map((r) => r.key)).toEqual(['missing:dir:9011']);
  });

  test('checking every linked account flags a pending relink whose pinned entry is gone', async () => {
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'here', user_id: 9013 }] });
    const expires_at = new Date(Date.now() + 3600e3).toISOString();
    m.AuthMeta.rows.push(
      { key: 'relink:dir:9014', value: { username: 'gone', subject: 'gone', expires_at } },
      { key: 'relink:dir:9016', value: { username: 'here', subject: 'here', expires_at } }
    );
    const realLocate = dir.locate;
    dir.lookup = async (subject) => (subject === 'here' ? { username: 'here', groups: [] } : null);
    dir.locate = async () => { throw new Error('directory down'); };
    expect((await providers.recheckLinked(m)).staleRelinks).toBe(0);
    dir.locate = async () => null;
    expect((await providers.recheckLinked(m)).staleRelinks).toBe(1);
    dir.locate = realLocate;
    expect(m.AuthMeta.rows.find((r) => r.key === 'relink:dir:9014').value.stale).toMatchObject({ gone: true });
    expect(m.AuthMeta.rows.find((r) => r.key === 'relink:dir:9016').value.stale).toBeUndefined();
  });

  test('after a subject setting change a matching value neither signs in, rechecks nor claims a relink as the old account', async () => {
    const realSetting = dir.subjectSetting;
    const realLocate = dir.locate;
    let looked = 0;
    try {
      dir.subjectSetting = () => 'uid';
      dir.lookup = async () => (looked++, { username: 'mallory', groups: ['cn=admins'] });
      dir.locate = async () => ({ username: 'mallory' });
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const m = fakeModels({
        users: [{ id: 9030, username: 'victim' }, { id: 9031, username: 'pinned' }],
        links: [{ provider: 'dir', subject: 'old-uuid', subject_setting: 'entryuuid', username: 'victim', user_id: 9030 }],
        meta: [{ key: 'relink:dir:9031', value: { username: 'pinned', subject: 'pin-uuid', subject_setting: 'entryuuid', expires_at } }],
      });
      await expect(providers.linkIdentity({ provider: 'dir', subject: 'old-uuid', username: 'mallory', groups: [] }, m)).rejects.toThrow(/different subject setting/);
      expect(m.AuthIdentity.rows[0].subject_setting).toBe('entryuuid');
      expect(await providers.stillLinked(9030, 'dir', m, true, true)).toBe('missing');
      expect(looked).toBe(0);
      expect(m.AuthMeta.rows.find((r) => r.key === 'missing:dir:9030').value.reason).toBe('subject');
      const claimed = await providers.linkIdentity({ provider: 'dir', subject: 'pin-uuid', username: 'mallory', groups: [] }, m).catch((e) => e);
      expect(claimed && claimed.id).not.toBe(9031);
      expect((await providers.recheckLinked(m)).staleRelinks).toBe(1);
      expect(m.AuthMeta.rows.find((r) => r.key === 'relink:dir:9031').value.stale).toMatchObject({ setting: true });
    } finally {
      dir.subjectSetting = realSetting;
      dir.locate = realLocate;
    }
  });

  test('after a subject setting change that kept the value, only that account\'s own fresh relink lets it sign in', async () => {
    const realSetting = dir.subjectSetting;
    try {
      dir.subjectSetting = () => 'cn';
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const m = fakeModels({
        users: [{ id: 9050, username: 'carol' }, { id: 9051, username: 'other' }],
        links: [{ provider: 'dir', subject: 'carol', subject_setting: 'uid', username: 'carol', user_id: 9050 }],
        meta: [{ key: 'relink:dir:9051', value: { username: 'carol', subject: 'carol', subject_setting: 'cn', expires_at } }],
      });
      const carol = { provider: 'dir', subject: 'carol', dn: 'uid=carol,ou=people', username: 'carol', groups: [] };
      await expect(providers.linkIdentity(carol, m)).rejects.toThrow(/different subject setting/);
      expect(m.AuthMeta.rows.some((r) => r.key === 'relink:dir:9051')).toBe(true);
      // Allow relink refuses a second account waiting for the same entry
      m.AuthMeta.rows.splice(0);
      const own = { key: 'relink:dir:9050', value: { username: 'carol', subject: 'carol', subject_setting: 'cn', dn: 'UID=carol,ou=people', expires_at, stale: { setting: true } } };
      m.AuthMeta.rows.push(own);
      await expect(providers.linkIdentity(carol, m)).rejects.toThrow(/different subject setting/);
      delete own.value.stale;
      // Another entry with the same cn
      await expect(providers.linkIdentity({ ...carol, dn: 'uid=eve,ou=people' }, m)).rejects.toThrow(/different subject setting/);
      expect((await providers.linkIdentity(carol, m)).id).toBe(9050);
      expect(m.AuthIdentity.rows.find((l) => l.user_id === 9050).subject_setting).toBe('cn');
      expect(m.AuthMeta.rows.some((r) => r.key === 'relink:dir:9050')).toBe(false);
    } finally {
      dir.subjectSetting = realSetting;
    }
  });

  test('while another process uses another subject setting, rechecks still run but leave its flags alone', async () => {
    const realSetting = dir.subjectSetting;
    let looked = 0;
    try {
      dir.subjectSetting = () => 'entryuuid';
      dir.lookup = async (subject) => (looked++, subject === 'u-1' ? { username: 'erin', groups: [] } : null);
      const at = new Date().toISOString();
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const m = fakeModels({
        users: [{ id: 9060, username: 'erin' }, { id: 9062, username: 'gone' }, { id: 9063, username: 'gil' }],
        links: [
          { provider: 'dir', subject: 'u-1', subject_setting: 'entryuuid', username: 'erin', user_id: 9060 },
          { provider: 'dir', subject: 'u-2', subject_setting: 'entryuuid', username: 'gone', user_id: 9062 },
        ],
        meta: [
          { key: 'subject_setting:dir:uid', value: { at } },
          { key: 'missing:dir:9060', value: { since: at, subject: 'u-1', reason: 'subject' } },
          { key: 'relink:dir:9063', value: { username: 'gil', subject: 'gil', subject_setting: 'uid', expires_at } },
        ],
      });
      expect(await providers.stillLinked(9060, 'dir', m, true, true)).toBe('ok');
      expect(m.AuthMeta.rows.some((r) => r.key === 'missing:dir:9060')).toBe(true);
      expect(await providers.stillLinked(9062, 'dir', m, true, true)).toBe('missing');
      expect(looked).toBe(2);
      expect((await providers.recheckLinked(m)).staleRelinks).toBe(0);
      expect(m.AuthMeta.rows.find((r) => r.key === 'relink:dir:9063').value).not.toHaveProperty('stale');
    } finally {
      dir.subjectSetting = realSetting;
    }
  });

  test('a relink flagged under another subject setting is unflagged once that setting is back', async () => {
    const realSetting = dir.subjectSetting;
    try {
      dir.subjectSetting = () => 'entryuuid';
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const m = fakeModels({
        users: [{ id: 9061, username: 'frank' }],
        meta: [{ key: 'relink:dir:9061', value: { username: 'frank', subject: 'f-1', subject_setting: 'entryuuid', expires_at, stale: { setting: true } } }],
      });
      expect((await providers.recheckLinked(m)).staleRelinks).toBe(0);
      expect(m.AuthMeta.rows.find((r) => r.key === 'relink:dir:9061').value).not.toHaveProperty('stale');
    } finally {
      dir.subjectSetting = realSetting;
    }
  });

  test('under a subject attribute that is not a permanent ID, only the entry the admin was shown claims a pinned relink', async () => {
    const realSetting = dir.subjectSetting;
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectSetting = () => 'cn';
      dir.subjectPermanent = () => false;
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const pinned = () =>
        fakeModels({
          users: [{ id: 9070, username: 'dave' }],
          meta: [{ key: 'relink:dir:9070', value: { username: 'dave', subject: 'dave', subject_setting: 'cn', dn: 'uid=dave,ou=people', expires_at } }],
        });
      const other = pinned();
      const mallory = await providers.linkIdentity({ provider: 'dir', subject: 'dave', dn: 'uid=mallory,ou=people', username: 'mallory', groups: [] }, other).catch((e) => e);
      expect(mallory).toBeInstanceOf(providers.LinkError);
      expect(other.User.rows).toHaveLength(1);
      expect(other.AuthMeta.rows.some((r) => r.key === 'relink:dir:9070')).toBe(true);
      expect((await providers.linkIdentity({ provider: 'dir', subject: 'dave', dn: 'UID=dave,ou=people', username: 'dave', groups: [] }, pinned())).id).toBe(9070);
    } finally {
      dir.subjectSetting = realSetting;
      dir.subjectPermanent = realPermanent;
    }
  });

  test('without a service account, an unpinned relink lets an account linked under another subject setting sign in again', async () => {
    const realSetting = dir.subjectSetting;
    try {
      dir.subjectSetting = () => 'cn';
      const expires_at = new Date(Date.now() + 3600e3).toISOString();
      const m = fakeModels({
        users: [{ id: 9080, username: 'carol' }],
        links: [{ provider: 'dir', subject: 'carol', subject_setting: 'uid', username: 'carol', user_id: 9080 }],
        meta: [{ key: 'relink:dir:9080', value: { username: 'carol', expires_at } }],
      });
      expect((await providers.linkIdentity({ provider: 'dir', subject: 'carol', dn: 'uid=carol,ou=people', username: 'carol', groups: [] }, m)).id).toBe(9080);
      expect(m.AuthIdentity.rows[0].subject_setting).toBe('cn');
    } finally {
      dir.subjectSetting = realSetting;
    }
  });

  test('a subject value re-cased at the same entry needs a relink; another entry is refused as a reused name', async () => {
    const realLocate = dir.locate;
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectPermanent = () => false;
      const models = () =>
        fakeModels({
          users: [{ id: 9090, username: 'ldap_alice' }],
          links: [{ provider: 'dir', subject: 'ldap_alice', username: 'ldap_alice', user_id: 9090 }],
        });
      const alice = { provider: 'dir', subject: 'Ldap_Alice', dn: 'uid=Ldap_Alice,ou=people', username: 'Ldap_Alice', groups: [] };
      dir.locate = async () => ({ dn: 'UID=Ldap_Alice,ou=people', username: 'Ldap_Alice' });
      const m = models();
      // The directory matches either case, so a newcomer looks the same: an admin decides
      await expect(providers.linkIdentity(alice, m)).rejects.toThrow(/except for letter case/);
      m.AuthMeta.rows.push({ key: 'relink:dir:9090', value: { username: 'ldap_alice', subject: 'Ldap_Alice', dn: 'uid=Ldap_Alice,ou=people', expires_at: new Date(Date.now() + 3600e3).toISOString() } });
      expect((await providers.linkIdentity(alice, m)).id).toBe(9090);
      expect(m.AuthIdentity.rows).toHaveLength(1);
      expect(m.AuthIdentity.rows[0].subject).toBe('Ldap_Alice');
      dir.locate = async () => ({ dn: 'uid=ldap_alice,ou=leavers', username: 'ldap_alice' });
      await expect(providers.linkIdentity(alice, models())).rejects.toThrow(/name was reused/);
      // Its old value found at this entry too, but the value itself is different (e.g. a second cn)
      dir.locate = async () => ({ dn: 'uid=Ldap_Alice,ou=people', username: 'Ldap_Alice' });
      await expect(providers.linkIdentity({ ...alice, subject: 'Mallory' }, models())).rejects.toThrow(/name was reused/);
      expect(providers.sameFolded('Alice  Directory', '\uff21lice directory ')).toBe(true);
      // The search base finds only the new entry, but the old one still exists elsewhere (e.g. moved to leavers)
      dir.lookup = async () => ({ dn: 'uid=Ldap_Alice,ou=people', username: 'Ldap_Alice', groups: [] });
      dir.locate = async () => ({});
      await expect(providers.linkIdentity(alice, models())).rejects.toThrow(/name was reused/);
    } finally {
      dir.subjectPermanent = realPermanent;
      dir.locate = realLocate;
    }
  });

  test('under a subject attribute that is not a permanent ID, a re-cased value under a new username gets no twin account', async () => {
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectPermanent = () => false;
      const m = fakeModels({
        users: [{ id: 9095, username: 'ldap_bob' }],
        links: [{ provider: 'dir', subject: 'Bob Directory', username: 'ldap_bob', user_id: 9095 }],
      });
      await expect(providers.linkIdentity({ provider: 'dir', subject: 'bob directory', dn: 'uid=bob2,ou=people', username: 'bob2', groups: [] }, m)).rejects.toThrow(/except for letter case/);
      expect(m.User.rows).toHaveLength(1);
    } finally {
      dir.subjectPermanent = realPermanent;
    }
  });

  test('a recheck that finds the stored value only without case treats the account as gone', async () => {
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectPermanent = () => false;
      dir.lookup = async (subject) => ({ subject, current: 'dave leaver', dn: 'uid=dave_new,ou=people', username: 'dave_new', groups: ['cn=science-team'] });
      const m = fakeModels({
        users: [{ id: 9097, username: 'dave_old' }],
        links: [{ provider: 'dir', subject: 'Dave Leaver', username: 'dave_old', user_id: 9097 }],
      });
      expect(await providers.stillLinked(9097, 'dir', m, true, true)).toBe('missing');
      expect(m.AuthIdentity.rows[0].username).toBe('dave_old');
    } finally {
      dir.subjectPermanent = realPermanent;
    }
  });

  test('a sign-in whose first subject value changed reuses the link made under another of its values', async () => {
    const realLocate = dir.locate;
    try {
      const m = fakeModels({
        users: [{ id: 9098, username: 'dave' }],
        links: [{ provider: 'dir', subject: 'dave@example.org', username: 'dave', user_id: 9098 }],
      });
      const dave = { provider: 'dir', subject: 'dave.alias@example.org', subjects: ['dave.alias@example.org', 'dave@example.org'], dn: 'uid=dave,ou=people', username: 'dave', groups: [] };
      dir.locate = async () => ({ dn: 'uid=dave,ou=people' });
      expect((await providers.linkIdentity(dave, m)).id).toBe(9098);
      expect(m.User.rows).toHaveLength(1);
      // Another person's entry given dave's old value as an alias
      await expect(providers.linkIdentity({ ...dave, username: 'carol', dn: 'uid=carol,ou=people' }, m)).rejects.toThrow(/also has 'dave@example.org'/);
      // Found elsewhere, so it isn't this entry's link
      dir.locate = async () => ({ dn: 'uid=mallory,ou=people' });
      await expect(providers.linkIdentity({ ...dave, dn: 'uid=dave2,ou=people' }, m)).rejects.toThrow(/different dir entry/);
      expect(m.User.rows).toHaveLength(1);
    } finally {
      dir.locate = realLocate;
    }
  });

  test('a relink pinned to one of an entry\'s values is claimed after the values are reordered, by that entry only', async () => {
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectPermanent = () => false;
      const pinned = () =>
        fakeModels({
          users: [{ id: 9099, username: 'carl' }],
          meta: [{ key: 'relink:dir:9099', value: { username: 'carl', subject: 'carl@example.org', dn: 'uid=carl,ou=people', by: 'admin', expires_at: new Date(Date.now() + 60000).toISOString() } }],
        });
      const carl = { provider: 'dir', subject: 'carl2@example.org', subjects: ['carl2@example.org', 'carl@example.org'], dn: 'UID=carl,ou=people', username: 'carl', groups: [] };
      const m = pinned();
      expect((await providers.linkIdentity(carl, m)).id).toBe(9099);
      expect(m.AuthMeta.rows).toEqual([]);
      // Another entry listing carl's pinned value doesn't claim carl's account
      const other = pinned();
      expect((await providers.linkIdentity({ ...carl, dn: 'uid=mallory,ou=people', username: 'mallory' }, other)).id).not.toBe(9099);
      expect(other.AuthMeta.rows).toEqual([expect.objectContaining({ key: 'relink:dir:9099' })]);
      // Nor does an entry at another DN with carl's username, which marks the relink stale instead
      const moved = pinned();
      await expect(providers.linkIdentity({ ...carl, dn: 'uid=carl,ou=contractors' }, moved)).rejects.toThrow(providers.LinkError);
      expect(moved.AuthMeta.rows[0].value.stale).toMatchObject({ subject: 'carl2@example.org' });
    } finally {
      dir.subjectPermanent = realPermanent;
    }
  });

  test('a recheck matching a leaver\'s value as another person\'s alias treats the account as gone', async () => {
    const realPermanent = dir.subjectPermanent;
    try {
      dir.subjectPermanent = () => false;
      dir.lookup = async (subject) => ({ subject, current: subject, first: 'carol@example.org', dn: 'uid=carol,ou=people', username: 'carol', groups: [] });
      const m = fakeModels({
        users: [{ id: 9099, username: 'alice' }],
        links: [{ provider: 'dir', subject: 'alice@example.org', username: 'alice', user_id: 9099 }],
      });
      expect(await providers.stillLinked(9099, 'dir', m, true, true)).toBe('missing');
      dir.lookup = async (subject) => ({ subject, current: subject, first: 'alias@example.org', dn: 'uid=alice,ou=people', username: 'alice', groups: [] });
      expect(await providers.stillLinked(9099, 'dir', m, true, true)).not.toBe('missing');
    } finally {
      dir.subjectPermanent = realPermanent;
    }
  });

  test('a leaver found again after a subject setting change keeps its leaver warning', async () => {
    const realSetting = dir.subjectSetting;
    try {
      dir.subjectSetting = () => 'uid';
      const m = fakeModels({
        users: [{ id: 9040, username: 'leaver' }],
        links: [{ provider: 'dir', subject: 'old-uuid', subject_setting: 'entryuuid', username: 'leaver', user_id: 9040 }],
        meta: [{ key: 'missing:dir:9040', value: { since: '2026-01-01T00:00:00.000Z', subject: 'old-uuid' } }],
      });
      expect(await providers.stillLinked(9040, 'dir', m, true, true)).toBe('missing');
      expect(m.AuthMeta.rows.find((r) => r.key === 'missing:dir:9040').value).toMatchObject({ since: '2026-01-01T00:00:00.000Z', reason: 'subject', was_gone: true });
    } finally {
      dir.subjectSetting = realSetting;
    }
  });

  test('pending relinks are not each asked about while every lookup in the pass failed', async () => {
    const realLocate = dir.locate;
    let located = 0;
    try {
      const m = fakeModels({ links: [{ provider: 'dir', subject: 'here', user_id: 9041 }] });
      m.AuthMeta.rows.push({ key: 'relink:dir:9042', value: { username: 'x', subject: 'x', expires_at: new Date(Date.now() + 3600e3).toISOString() } });
      dir.lookup = async () => { throw new Error('directory hangs'); };
      dir.locate = async () => (located++, null);
      expect(await providers.recheckLinked(m)).toMatchObject({ failed: 1, staleRelinks: 0 });
      expect(located).toBe(0);
    } finally {
      dir.locate = realLocate;
    }
  });

  test('a username typed for another account prefers the exact name and refuses an ambiguous folded one', () => {
    const rows = [{ id: 1, username: 'Dana' }, { id: 2, username: 'dana' }, { id: 3, username: 'Ève' }];
    expect(providers.matchUsername(rows, 'dana').match.id).toBe(2);
    expect(providers.matchUsername(rows, 'Dana').match.id).toBe(1);
    expect(providers.matchUsername(rows, 'DANA')).toMatchObject({ match: null });
    expect(providers.matchUsername(rows, 'DANA').alike).toHaveLength(2);
    expect(providers.matchUsername(rows, 'Ève'.normalize('NFD')).match.id).toBe(3);
    expect(providers.matchUsername(rows, 'ève').match.id).toBe(3);
  });

  test('a recheck waits as long as the provider says its lookup may take, not just 5 s', async () => {
    dir.lookup = async () => (await new Promise((r) => setTimeout(r, 5300)), null);
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'slow', user_id: 9015 }] });
    expect(await providers.stillLinked(9015, 'dir', m, true)).toBe(false);
  });

  test("a person's request waits at most 5 s for a slow recheck, whose result still applies when it ends", async () => {
    let ended;
    const lookedUp = new Promise((r) => (ended = r));
    dir.lookup = async () => (await new Promise((r) => setTimeout(r, 5300)), ended(), null);
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'slower', user_id: 9017 }] });
    const started = Date.now();
    expect(await providers.stillLinked(9017, 'dir', m)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5250);
    await lookedUp;
    await new Promise((r) => setTimeout(r, 50));
    expect(await providers.stillLinked(9017, 'dir', m)).toBe(false);
  });

  test('once a recheck finds the provider down, other people\'s requests wait at most 1 s for theirs, so a removal still applies if it answers', async () => {
    // An error about one entry (e.g. its group search) doesn't count as the directory being down
    dir.lookup = async () => { throw new Error('Size limit exceeded'); };
    const m0 = fakeModels({ links: [{ provider: 'dir', subject: 'odd', user_id: 9021 }, { provider: 'dir', subject: 'waits', user_id: 9022 }] });
    expect(await providers.stillLinked(9021, 'dir', m0)).toBe(true);
    dir.lookup = async () => (await new Promise((r) => setTimeout(r, 300)), null);
    expect(await providers.stillLinked(9022, 'dir', m0)).toBe(false);
    dir.lookup = async () => { throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3636'), { code: 'ECONNREFUSED' }); };
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'first', user_id: 9018 }, { provider: 'dir', subject: 'next', user_id: 9019 }, { provider: 'dir', subject: 'back', user_id: 9020 }] });
    expect(await providers.stillLinked(9018, 'dir', m)).toBe(true);
    let ended;
    const lookedUp = new Promise((r) => (ended = r));
    dir.lookup = async () => (await new Promise((r) => setTimeout(r, 1500)), ended(), { username: 'next', groups: [] });
    const started = Date.now();
    expect(await providers.stillLinked(9019, 'dir', m)).toBe(true);
    expect(Date.now() - started).toBeLessThan(1400);
    // A person the directory removed is still refused at once if it answers
    dir.lookup = async () => null;
    const m2 = fakeModels({ links: [{ provider: 'dir', subject: 'gone', user_id: 9023 }] });
    expect(await providers.stillLinked(9023, 'dir', m2)).toBe(false);
    await lookedUp;
    await new Promise((r) => setTimeout(r, 50));
    // It answered, so a removal applies to the request again
    dir.lookup = async () => null;
    expect(await providers.stillLinked(9020, 'dir', m)).toBe(false);
  });

  test('a group change during a check of every account queues one more check after it', async () => {
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'here', user_id: 9013 }] });
    let calls = 0;
    let release;
    const gate = new Promise((r) => (release = r));
    dir.lookup = async () => {
      calls++;
      if (calls === 1) await gate;
      return { username: 'here', groups: [] };
    };
    const first = providers.recheckLinked(m);
    expect(providers.recheckLinked(m)).toBe(first);
    const again = providers.recheckLinked(m, true);
    expect(again).not.toBe(first);
    expect(providers.recheckLinked(m, true)).toBe(again);
    release();
    await first;
    await again;
    expect(calls).toBe(2);
  });

  test('with rechecks off, an account Check linked accounts found gone loses access without asking the directory again', async () => {
    const saved = process.env.AUTH_RECHECK_MINUTES;
    process.env.AUTH_RECHECK_MINUTES = '0';
    let calls = 0;
    dir.lookup = async () => (calls++, null);
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'gone', user_id: 9016 }] });
    try {
      expect(await providers.stillLinked(9016, 'dir', m)).toBe(true);
      expect(calls).toBe(0);
      expect(await providers.recheckLinked(m)).toMatchObject({ checked: 1, missing: 1 });
      expect(await providers.stillLinked(9016, 'dir', m)).toBe(false);
      expect(calls).toBe(1);
    } finally {
      if (saved === undefined) delete process.env.AUTH_RECHECK_MINUTES;
      else process.env.AUTH_RECHECK_MINUTES = saved;
    }
  });

  test('a group change starts no check while rechecks are off', async () => {
    const saved = process.env.AUTH_RECHECK_MINUTES;
    process.env.AUTH_RECHECK_MINUTES = '0';
    let calls = 0;
    dir.lookup = async () => (calls++, { username: 'here', groups: [] });
    try {
      expect(await providers.fillGroups('dir', fakeModels({ links: [{ provider: 'dir', subject: 'here', user_id: 9014 }] }))).toBeUndefined();
      expect(calls).toBe(0);
    } finally {
      if (saved === undefined) delete process.env.AUTH_RECHECK_MINUTES;
      else process.env.AUTH_RECHECK_MINUTES = saved;
    }
  });

  test('a new entry given a name whose old entry still exists is refused without suggesting a relink', async () => {
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'old-bob', username: 'bob', user_id: 9020 }] });
    const realLocate = dir.locate;
    dir.locate = (subject) => dir.lookup(subject);
    dir.lookup = async (subject) => (subject === 'old-bob' ? { username: 'bob_renamed', groups: [] } : null);
    const err = await providers.linkIdentity(providers.normalizeIdentity('dir', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(err).toBeInstanceOf(providers.LinkError);
    expect(err.message).toMatch(/still exists as 'bob_renamed'.*don't relink/);
    dir.lookup = async () => null;
    const gone = await providers.linkIdentity(providers.normalizeIdentity('dir', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(gone.message).toMatch(/allow a relink/);
    dir.lookup = async () => { throw new Error('directory down'); };
    const unknown = await providers.linkIdentity(providers.normalizeIdentity('dir', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(unknown.message).toMatch(/couldn't say whether .* Check before allowing a relink/);
    // A service account that can't search the root: what lookup still finds under the search base counts
    dir.locate = async () => { throw new Error('No such object'); };
    dir.lookup = async (subject) => (subject === 'old-bob' ? { username: 'bob_renamed', groups: [] } : null);
    expect(await providers.locateSubject('dir', 'old-bob')).toMatchObject({ username: 'bob_renamed' });
    dir.lookup = async () => null;
    expect(await providers.locateSubject('dir', 'old-bob')).toBeUndefined();
    dir.locate = async () => null;
    expect(await providers.locateSubject('dir', 'old-bob')).toBeNull();
    dir.locate = realLocate;
  });

  test('a reused name is refused while the old entry exists anywhere, e.g. moved to a leavers OU', async () => {
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'old-carol', username: 'carol', user_id: 9040 }] });
    dir.lookup = async () => null;
    const realLocate = dir.locate;
    dir.locate = async (subject) => (subject === 'old-carol' ? { dn: 'uid=carol,ou=disabled,dc=example,dc=org', username: 'carol' } : null);
    try {
      const err = await providers.linkIdentity(providers.normalizeIdentity('dir', { subject: 'new-carol', username: 'carol' }), m).catch((e) => e);
      expect(err.message).toMatch(/still exists at uid=carol,ou=disabled.*don't relink/);
    } finally {
      dir.locate = realLocate;
    }
  });

  test('an account another process found missing is checked again once it has signed in since', async () => {
    const m = fakeModels({ links: [{ provider: 'dir', subject: 'back', user_id: 9030, last_login_at: null }] });
    dir.lookup = async () => null;
    expect(await providers.stillLinked(9030, 'dir', m)).toBe(false);
    dir.lookup = async () => ({ username: 'back', groups: [] });
    expect(await providers.stillLinked(9030, 'dir', m)).toBe(false);
    m.AuthIdentity.rows[0].last_login_at = new Date(Date.now() + 1000);
    expect(await providers.stillLinked(9030, 'dir', m)).toBe(true);
  });

  test('a directory that cannot be reached keeps access and groups', async () => {
    const m = models(9001);
    dir.lookup = async () => { throw new Error('down'); };
    expect(await providers.stillLinked(9001, 'dir', m)).toBe(true);
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });

  test('an entry the directory no longer has loses access and its provider groups', async () => {
    const m = models(9002);
    dir.lookup = async () => null;
    expect(await providers.stillLinked(9002, 'dir', m)).toBe(false);
    expect(m.AuthGroupMember.rows).toEqual([]);
    // Shown in People until the entry is back
    expect(m.AuthMeta.rows).toMatchObject([{ key: 'missing:dir:9002', value: { since: expect.any(String), subject: 'old' } }]);
    m.User.rows.push({ id: 9002, username: 'back' });
    await providers.linkIdentity(providers.normalizeIdentity('dir', { subject: 'old', username: 'back' }), m);
    expect(m.AuthMeta.rows).toEqual([]);
  });

  test('a rename in the directory is recorded at the recheck, before the next login', async () => {
    const m = models(9004);
    m.AuthIdentity.rows[0] = { ...m.AuthIdentity.rows[0], username: 'alice' };
    dir.lookup = async () => ({ username: 'alice_r', groups: ['cn=ops,ou=groups,dc=example,dc=org'] });
    expect(await providers.stillLinked(9004, 'dir', m)).toBe(true);
    expect(m.AuthIdentity.rows[0]).toMatchObject({ subject: 'old', username: 'alice_r' });
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });

  test("group names typed by an admin are saved in the provider's own form (its groupName hook)", () => {
    expect(providers.groupName('dir', 'CN=Ops, OU=Groups,DC=Example,DC=org')).toBe('cn=ops,ou=groups,dc=example,dc=org');
    expect(providers.groupName('local', 'CN=Ops')).toBe('CN=Ops');
  });

  test('a relink during the lookup is not undone by the old subject coming back empty', async () => {
    const m = models(9003);
    dir.lookup = async () => {
      m.AuthIdentity.rows[0] = { ...m.AuthIdentity.rows[0], subject: 'new' };
      return null;
    };
    expect(await providers.stillLinked(9003, 'dir', m)).toBe(true);
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });
});
