/**
 * Unit tests for request principals behind a proxy login provider:
 * a local account signed in behind the proxy, proxy-only users, bearer tokens,
 * connection storage for those principals, and the websocket's saved proxy identity.
 * Database models are replaced with in-memory fakes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { Op } = require('sequelize');

const root = path.resolve(__dirname, '../..');
const users = { 1: { id: 1, username: 'admin' }, 2: { id: 2, username: 'other' } };
const bindingRows = [
  { id: 1, role: 'superadmin', scope_type: 'global', subject_type: 'user', subject_id: '1' },
  { id: 2, role: 'viewer', scope_type: 'global', subject_type: 'audience', subject_id: 'authenticated' },
];
const tokens = {};

const fakeModels = {
  User: { findOne: async ({ where }) => users[where.id] || null },
  AuthGroupMember: { findAll: async () => [] },
  AuthGroup: { findAll: async () => [] },
  AuthIdentity: { findAll: async () => [] },
  RoleBinding: {
    findAll: async ({ where }) =>
      bindingRows.filter((r) =>
        where[Op.or].some((s) => s.subject_type === r.subject_type && s.subject_id === r.subject_id)
      ),
  },
};
const fakeTokens = {
  findOne: async ({ where }) => (where.token_hash ? tokens[where.token_hash] || null : null),
  update: async () => [1],
};

function stub(rel, exports) {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

let principal, policy, connections, savedProxyIdentity;
const saved = {};

test.beforeAll(() => {
  for (const k of ['AUTH_PROVIDERS', 'SITE_ACCESS', 'AUTH_LOCAL_LOGIN']) saved[k] = process.env[k];
  process.env.AUTH_PROVIDERS = '["proxy","local"]';
  process.env.SITE_ACCESS = 'required';
  delete process.env.AUTH_LOCAL_LOGIN;
  stub('API/permissions/models.js', fakeModels);
  stub('plugins/core/backend/Users/models/user.js', { User: fakeModels.User });
  stub('plugins/core/backend/LongTermToken/models/longtermtokens.js', { LongTermTokens: fakeTokens });
  principal = require(path.join(root, 'API/permissions/principal.js'));
  policy = require(path.join(root, 'API/permissions/policy.js'));
  connections = require(path.join(root, 'API/connections'));
  ({ savedProxyIdentity } = require(path.join(root, 'API/websocket.js')));
  const raw = 'mmgis-unit-test-token-value';
  tokens[principal.hashToken(raw)] = {
    id: 5, name: 't', created_by_user_id: 1, scopes: null, missions: null,
    last_used_at: new Date(), expires_at: null,
  };
});

test.afterAll(() => {
  for (const k of Object.keys(saved))
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
});

test.beforeEach(() => principal.invalidate());

const proxyIdentity = { provider: 'proxy', subject: 'jdoe', username: 'jdoe', groups: [], session: 's1' };

test.describe('groups of a provider that is not enabled', () => {
  test('grant nothing, while local groups still do', async () => {
    const orig = { members: fakeModels.AuthGroupMember.findAll, groups: fakeModels.AuthGroup.findAll };
    bindingRows.push(
      { id: 90, role: 'data_admin', scope_type: 'global', subject_type: 'group', subject_id: '10' },
      { id: 91, role: 'editor', scope_type: 'global', subject_type: 'group', subject_id: '11' }
    );
    fakeModels.AuthGroupMember.findAll = async ({ where }) =>
      where.user_id === 2 ? [{ group_id: 10 }, { group_id: 11 }] : [];
    // ldap isn't in AUTH_PROVIDERS here
    fakeModels.AuthGroup.findAll = async ({ where }) =>
      [{ id: 10, source: 'ldap' }, { id: 11, source: 'local' }].filter((g) => where.id.includes(g.id));
    try {
      const p = await principal.resolvePrincipal({ headers: {}, session: { uid: 2 } });
      expect(p.groupIds).toEqual([11]);
      expect(p.bindings.map((b) => b.role)).toContain('editor');
      expect(p.bindings.map((b) => b.role)).not.toContain('data_admin');
    } finally {
      bindingRows.splice(bindingRows.findIndex((r) => r.id === 90), 2);
      fakeModels.AuthGroupMember.findAll = orig.members;
      fakeModels.AuthGroup.findAll = orig.groups;
    }
  });
});

test.describe('local account signed in behind the proxy', () => {
  test('the proxy user is the identity and the local account adds its access', async () => {
    const p = await principal.resolvePrincipal({ headers: {}, session: { uid: 1 }, identity: proxyIdentity });
    expect(p.kind).toBe('external');
    expect(p.username).toBe('jdoe');
    expect(p.provider).toBe('proxy');
    expect(p.userId).toBe(1);
    expect(p.localUserId).toBe(1);
    expect(p.localUsername).toBe('admin');
    expect(policy.isSuperAdmin(p)).toBe(true);
  });

  test('can create tokens, and the capability list says so', async () => {
    const p = await principal.resolvePrincipal({ headers: {}, session: { uid: 1 }, identity: proxyIdentity });
    expect(policy.can(p, 'tokens.create')).toBe(true);
    expect(policy.capabilitiesOf(p)).toContain('tokens.create');
  });

  test('keeps its connections on the local account', async () => {
    const p = await principal.resolvePrincipal({ headers: {}, session: { uid: 1 }, identity: proxyIdentity });
    expect(connections.storageFor(p, { guests: false })).toBe('account');
    expect(connections.ownerKey(p)).toBe('user:1');
  });
});

test.describe('proxy user without a local sign-in', () => {
  test('has no account, cannot create tokens, and keeps connections in the session', async () => {
    const p = await principal.resolvePrincipal({ headers: {}, session: {}, identity: proxyIdentity });
    expect(p.kind).toBe('external');
    expect(p.userId).toBeNull();
    expect(policy.isSuperAdmin(p)).toBe(false);
    expect(policy.capabilitiesOf(p)).not.toContain('tokens.create');
    expect(connections.storageFor(p, { guests: false })).toBe('session');
    expect(connections.ownerKey(p)).toBe('external:proxy:jdoe');
  });

  test('a local account that may no longer log in is ignored and marked stale', async () => {
    const req = { headers: {}, session: { uid: 99 }, identity: proxyIdentity };
    const p = await principal.resolvePrincipal(req);
    expect(p.userId).toBeNull();
    expect(p.username).toBe('jdoe');
    expect(req.staleSession).toBe(true);
  });
});

test.describe('bearer tokens behind the proxy', () => {
  const auth = { authorization: 'Bearer mmgis-unit-test-token-value' };

  test('a token acts for its creator, not the proxy user', async () => {
    const p = await principal.resolvePrincipal({ headers: auth, session: {}, identity: proxyIdentity });
    expect(p.kind).toBe('token');
    expect(p.userId).toBe(1);
    expect(p.username).toBe('admin');
  });

  test("a token inside another account's session is refused", async () => {
    const p = await principal.resolvePrincipal({ headers: auth, session: { uid: 2 }, identity: proxyIdentity });
    expect(p.kind).toBe('invalid_token');
  });

  test('an unknown token never falls back to the proxy identity', async () => {
    const p = await principal.resolvePrincipal({
      headers: { authorization: 'Bearer nope' }, session: {}, identity: proxyIdentity,
    });
    expect(p.kind).toBe('invalid_token');
    expect(p.authenticated).toBe(false);
  });
});

test.describe('websocket saved proxy identity', () => {
  const session = { proxyIdentity: { subject: 'jdoe', username: 'jdoe', groups: ['A', 7, null], session: 42 } };

  test('rebuilds a proxy identity from the session', () => {
    expect(savedProxyIdentity(session)).toEqual({
      provider: 'proxy', subject: 'jdoe', username: 'jdoe', email: null, groups: ['A'], session: '42',
    });
  });

  test('is ignored after logout, when empty, or when the proxy provider is off', () => {
    expect(savedProxyIdentity({})).toBeNull();
    expect(savedProxyIdentity(null)).toBeNull();
    expect(savedProxyIdentity({ proxyIdentity: { username: '' } })).toBeNull();
    process.env.AUTH_PROVIDERS = '["local"]';
    try {
      expect(savedProxyIdentity(session)).toBeNull();
    } finally {
      process.env.AUTH_PROVIDERS = '["proxy","local"]';
    }
  });
});

test.describe('MMGIS logout', () => {
  test('clears the saved proxy identity so cookie-only websockets stop working', () => {
    const { clearLoginSession } = require(path.join(root, 'plugins/core/auth/Local/routes.js'));
    const req = { session: { uid: 1, user: 'admin', proxyIdentity: { username: 'jdoe' } } };
    clearLoginSession(req);
    expect(req.session.proxyIdentity).toBeUndefined();
    expect(savedProxyIdentity(req.session)).toBeNull();
  });
});
