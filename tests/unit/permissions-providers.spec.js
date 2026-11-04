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

  test('the shipped providers are ldap, local and proxy', () => {
    expect(providers.loadProviders(REAL_ROOT).sort()).toEqual(['ldap', 'local', 'proxy']);
    for (const id of ['ldap', 'local', 'proxy']) {
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

  test('a subject or username longer than MMGIS can store is refused, not a server error', async () => {
    const m = fakeModels();
    await expect(providers.linkIdentity(identity({ subject: 'x'.repeat(256), username: 'long' }), m)).rejects.toThrow(providers.LinkError);
    await expect(providers.linkIdentity(identity({ subject: 's', username: 'u'.repeat(256) }), m)).rejects.toThrow(providers.LinkError);
    expect(m.User.rows).toHaveLength(0);
  });

  test('never creates an account whose username has markup or control characters', async () => {
    const m = fakeModels();
    for (const username of ['evil<img src=x onerror=alert(1)>', 'a"b', 'a`b', 'a\nb'])
      await expect(providers.linkIdentity(identity({ subject: `s-${username}`, username }), m)).rejects.toThrow(/can't/);
    expect(m.User.rows).toHaveLength(0);
  });

  test("never creates an account named 'group', which Draw uses for shared files", async () => {
    const m = fakeModels();
    for (const username of ['group', ' Group ', 'ＧＲＯＵＰ'])
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
    for (const k of ['AUTH_LOCAL_LOGIN', 'LDAP_DISPLAY_NAME', 'LDAP_USERNAME_LABEL', 'LDAP_LOGIN_HINT']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    providers.loadProviders(REAL_ROOT);
  });
  test.afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('form providers share the form in AUTH_PROVIDERS order and get no login button', () => {
    process.env.LDAP_DISPLAY_NAME = 'JPL Directory';
    process.env.LDAP_USERNAME_LABEL = 'JPL username';
    process.env.LDAP_LOGIN_HINT = 'Same as your email.';
    expect(providers.loginForms(['ldap', 'local', 'proxy'])).toEqual([
      { id: 'ldap', title: 'JPL Directory', usernameLabel: 'JPL username', hint: 'Same as your email.', icon: 'card-account-details-outline', path: 'api/auth/ldap/login' },
      { id: 'local', title: 'MMGIS account', usernameLabel: 'Username', hint: '', icon: 'account-key-outline', path: 'api/auth/local/login' },
    ]);
    expect(providers.loginForms(['local', 'ldap']).map((f) => f.id)).toEqual(['local', 'ldap']);
    expect(providers.loginLinks(['ldap', 'local'])).toEqual([]);
    expect(providers.providerLabel('ldap')).toBe('JPL Directory');
    expect(providers.providerLabel('proxy')).toBe('Authenticating proxy');
  });

  test('with AUTH_LOCAL_LOGIN=admins, local accounts are only offered at Configure sign-in', () => {
    process.env.AUTH_LOCAL_LOGIN = 'admins';
    expect(providers.loginForms(['ldap', 'local']).map((f) => f.id)).toEqual(['ldap']);
    const configure = providers.loginForms(['ldap', 'local'], { configure: true });
    expect(configure.map((f) => f.id)).toEqual(['ldap', 'local']);
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
  let ldap, lookup;
  test.beforeAll(() => {
    providers.loadProviders(REAL_ROOT);
    ldap = providers.getProvider('ldap').impl;
    lookup = ldap.lookup;
  });
  test.afterAll(() => (ldap.lookup = lookup));
  const models = (userId) =>
    fakeModels({
      groups: [{ id: 1, source: 'ldap', external_name: 'cn=ops,ou=groups,dc=example,dc=org' }],
      members: [{ group_id: 1, user_id: userId }],
      links: [{ provider: 'ldap', subject: 'old', user_id: userId }],
    });

  test('checking every linked account asks the directory now, even about accounts checked a moment ago', async () => {
    const m = fakeModels({
      links: [
        { provider: 'ldap', subject: 'here', user_id: 9010 },
        { provider: 'ldap', subject: 'gone', user_id: 9011 },
        { provider: 'local-only', subject: 'x', user_id: 9012 },
      ],
    });
    ldap.lookup = async (subject) => (subject === 'here' ? { username: 'here', groups: [] } : null);
    expect(await providers.stillLinked(9011, 'ldap', m)).toBe(false);
    m.AuthMeta.rows.length = 0;
    expect(await providers.recheckLinked(m)).toEqual({ checked: 2, missing: 1, failed: 0, unsupported: 0 });
    ldap.lookup = async () => { throw new Error('directory down'); };
    expect(await providers.recheckLinked(m)).toEqual({ checked: 2, missing: 0, failed: 2, unsupported: 0 });
    ldap.lookup = async () => undefined;
    expect(await providers.recheckLinked(m)).toEqual({ checked: 0, missing: 0, failed: 0, unsupported: 2 });
    expect(m.AuthMeta.rows.map((r) => r.key)).toEqual(['missing:ldap:9011']);
  });

  test('a group change during a check of every account queues one more check after it', async () => {
    const m = fakeModels({ links: [{ provider: 'ldap', subject: 'here', user_id: 9013 }] });
    let calls = 0;
    let release;
    const gate = new Promise((r) => (release = r));
    ldap.lookup = async () => {
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

  test('a group change starts no check while rechecks are off', async () => {
    const saved = process.env.AUTH_RECHECK_MINUTES;
    process.env.AUTH_RECHECK_MINUTES = '0';
    let calls = 0;
    ldap.lookup = async () => (calls++, { username: 'here', groups: [] });
    try {
      expect(await providers.fillGroups('ldap', fakeModels({ links: [{ provider: 'ldap', subject: 'here', user_id: 9014 }] }))).toBeUndefined();
      expect(calls).toBe(0);
    } finally {
      if (saved === undefined) delete process.env.AUTH_RECHECK_MINUTES;
      else process.env.AUTH_RECHECK_MINUTES = saved;
    }
  });

  test('a new entry given a name whose old entry still exists is refused without suggesting a relink', async () => {
    const m = fakeModels({ links: [{ provider: 'ldap', subject: 'old-bob', username: 'bob', user_id: 9020 }] });
    const realLocate = ldap.locate;
    ldap.locate = (subject) => ldap.lookup(subject);
    ldap.lookup = async (subject) => (subject === 'old-bob' ? { username: 'bob_renamed', groups: [] } : null);
    const err = await providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(err).toBeInstanceOf(providers.LinkError);
    expect(err.message).toMatch(/still exists as 'bob_renamed'.*don't relink/);
    ldap.lookup = async () => null;
    const gone = await providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(gone.message).toMatch(/allow a relink/);
    ldap.lookup = async () => { throw new Error('directory down'); };
    const unknown = await providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'new-bob', username: 'bob' }), m).catch((e) => e);
    expect(unknown.message).toMatch(/couldn't say whether .* Check before allowing a relink/);
    // A service account that can't search the root: what lookup still finds under the search base counts
    ldap.locate = async () => { throw new Error('No such object'); };
    ldap.lookup = async (subject) => (subject === 'old-bob' ? { username: 'bob_renamed', groups: [] } : null);
    expect(await providers.locateSubject('ldap', 'old-bob')).toMatchObject({ username: 'bob_renamed' });
    ldap.lookup = async () => null;
    expect(await providers.locateSubject('ldap', 'old-bob')).toBeUndefined();
    ldap.locate = async () => null;
    expect(await providers.locateSubject('ldap', 'old-bob')).toBeNull();
    ldap.locate = realLocate;
  });

  test('a reused name is refused while the old entry exists anywhere, e.g. moved to a leavers OU', async () => {
    const m = fakeModels({ links: [{ provider: 'ldap', subject: 'old-carol', username: 'carol', user_id: 9040 }] });
    ldap.lookup = async () => null;
    const realLocate = ldap.locate;
    ldap.locate = async (subject) => (subject === 'old-carol' ? { dn: 'uid=carol,ou=disabled,dc=example,dc=org', username: 'carol' } : null);
    try {
      const err = await providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'new-carol', username: 'carol' }), m).catch((e) => e);
      expect(err.message).toMatch(/still exists at uid=carol,ou=disabled.*don't relink/);
    } finally {
      ldap.locate = realLocate;
    }
  });

  test('an account another process found missing is checked again once it has signed in since', async () => {
    const m = fakeModels({ links: [{ provider: 'ldap', subject: 'back', user_id: 9030, last_login_at: null }] });
    ldap.lookup = async () => null;
    expect(await providers.stillLinked(9030, 'ldap', m)).toBe(false);
    ldap.lookup = async () => ({ username: 'back', groups: [] });
    expect(await providers.stillLinked(9030, 'ldap', m)).toBe(false);
    m.AuthIdentity.rows[0].last_login_at = new Date(Date.now() + 1000);
    expect(await providers.stillLinked(9030, 'ldap', m)).toBe(true);
  });

  test('a directory that cannot be reached keeps access and groups', async () => {
    const m = models(9001);
    ldap.lookup = async () => { throw new Error('down'); };
    expect(await providers.stillLinked(9001, 'ldap', m)).toBe(true);
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });

  test('an entry the directory no longer has loses access and its provider groups', async () => {
    const m = models(9002);
    ldap.lookup = async () => null;
    expect(await providers.stillLinked(9002, 'ldap', m)).toBe(false);
    expect(m.AuthGroupMember.rows).toEqual([]);
    // Shown in People until the entry is back
    expect(m.AuthMeta.rows).toMatchObject([{ key: 'missing:ldap:9002', value: { since: expect.any(String), subject: 'old' } }]);
    m.User.rows.push({ id: 9002, username: 'back' });
    await providers.linkIdentity(providers.normalizeIdentity('ldap', { subject: 'old', username: 'back' }), m);
    expect(m.AuthMeta.rows).toEqual([]);
  });

  test('a rename in the directory is recorded at the recheck, before the next login', async () => {
    const m = models(9004);
    m.AuthIdentity.rows[0] = { ...m.AuthIdentity.rows[0], username: 'alice' };
    ldap.lookup = async () => ({ username: 'alice_r', groups: ['cn=ops,ou=groups,dc=example,dc=org'] });
    expect(await providers.stillLinked(9004, 'ldap', m)).toBe(true);
    expect(m.AuthIdentity.rows[0]).toMatchObject({ subject: 'old', username: 'alice_r' });
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });

  test('LDAP group DNs typed in another case or spacing are saved in the form LDAP reports', () => {
    expect(providers.groupName('ldap', 'CN=Ops, OU=Groups,DC=Example,DC=org')).toBe('cn=ops,ou=groups,dc=example,dc=org');
    expect(() => providers.groupName('ldap', 'Science Team')).toThrow(/enter the group's DN/);
    expect(providers.groupName('local', 'CN=Ops')).toBe('CN=Ops');
  });

  test('a relink during the lookup is not undone by the old subject coming back empty', async () => {
    const m = models(9003);
    ldap.lookup = async () => {
      m.AuthIdentity.rows[0] = { ...m.AuthIdentity.rows[0], subject: 'new' };
      return null;
    };
    expect(await providers.stillLinked(9003, 'ldap', m)).toBe(true);
    expect(m.AuthGroupMember.rows).toHaveLength(1);
  });
});
