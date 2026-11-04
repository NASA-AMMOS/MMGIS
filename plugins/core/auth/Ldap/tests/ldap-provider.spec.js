import { test, expect, request as newRequest } from '@playwright/test';

/**
 * E2E tests for the LDAP login provider against a real OpenLDAP directory
 * (openldap/start.sh next to this file), with AUTH_PROVIDERS=["ldap","local"].
 *
 *   plugins/core/auth/Ldap/tests/openldap/start.sh /tmp/ldap
 *   SITE_ACCESS=optional AUTH_PROVIDERS='["ldap","local"]' LDAP_URL=ldaps://localhost:3636 \
 *   LDAP_TLS_CA=/tmp/ldap/ca.pem LDAP_BIND_DN=cn=mmgis-svc,ou=services,dc=example,dc=org \
 *   LDAP_BIND_PASSWORD=svc-test-password LDAP_USER_SEARCH_BASE=ou=people,dc=example,dc=org \
 *   LDAP_GROUP_SEARCH_BASE=ou=groups,dc=example,dc=org npx playwright test plugins/core/auth/Ldap/tests
 *
 * Skipped unless the ldap provider is enabled.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
const enabled = /\bldap\b/.test(process.env.AUTH_PROVIDERS || '') && !!process.env.LDAP_URL;
const admin = { username: 'test_admin', password: ['Test', 'Admin', '1!'].join('') };
// Test-only directory passwords from openldap/seed.ldif
const alice = { username: 'ldap_alice', password: ['alice', 'test', 'password'].join('-') };
const bob = { username: 'ldap_bob', password: ['bob', 'test', 'password'].join('-') };
const clash = { username: 'test_admin', password: ['clash', 'test', 'password'].join('-') };

// Each context gets its own address, so the per-IP login rate limits don't add up across tests
let ip = 10;
async function context() {
  ip += 1;
  return newRequest.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': `10.77.0.${ip}` } });
}
const ldapLogin = (ctx, body) => ctx.post('/api/auth/ldap/login', { data: body });

// Changes the fixture directory (openldap/start.sh) as its admin; false when that container isn't here
const container = process.env.LDAP_CONTAINER || 'mmgis-test-ldap';
function directoryAdmin(ldif) {
  const { execFileSync } = require('child_process');
  const adminPassword = ['admin', 'test', 'password'].join('-');
  try {
    execFileSync('docker', ['exec', '-i', container, 'ldapmodify', '-x', '-H', 'ldap://localhost', '-D', 'cn=admin,dc=example,dc=org', '-w', adminPassword], { input: ldif, stdio: ['pipe', 'ignore', 'pipe'] });
    return true;
  } catch (err) {
    return false;
  }
}
const recheckTeam = (change) =>
  `dn: cn=recheck-team,ou=groups,dc=example,dc=org\nchangetype: modify\n${change}: member\nmember: uid=ldap_bob,ou=people,dc=example,dc=org\n`;
async function me(ctx) {
  return (await (await ctx.get('/api/access/me')).json()).body;
}
async function adminContext() {
  const ctx = await context();
  const res = await ctx.post('/api/users/login', { data: admin });
  expect((await res.json()).status).toBe('success');
  return ctx;
}

test.describe('LDAP login provider', () => {
  // In order on one worker: the tests share ldap_alice and ldap_bob, and the recheck test changes their groups
  test.describe.configure({ mode: 'default' });
  test.skip(!enabled, 'SKIP: the ldap login provider is not enabled');

  test('the shared form lists LDAP first, with no separate login button', async () => {
    const ctx = await context();
    const auth = await (await ctx.get('/api/auth')).json();
    expect(auth.loginForms.map((f) => f.id)).toEqual(['ldap', 'local']);
    expect(auth.loginForms[0]).toMatchObject({ path: 'api/auth/ldap/login', icon: 'card-account-details-outline' });
    expect(auth.loginLinks.find((l) => l.id === 'ldap')).toBeUndefined();

    const html = await (await ctx.get('/configure')).text();
    expect(html).toContain('data-id="ldap"');
    expect(html).toContain('data-id="local"');
  });

  test('empty and wrong passwords are refused without signing in', async () => {
    const ctx = await context();
    expect((await ldapLogin(ctx, { username: alice.username, password: '' })).status()).toBe(400);
    const wrong = await ldapLogin(ctx, { username: alice.username, password: 'not-the-password' }); // pragma: allowlist secret
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).message).toMatch(/Invalid .* username or password/);
    // Filter metacharacters are escaped, so a wildcard matches nobody
    expect((await ldapLogin(ctx, { username: '*', password: alice.password })).status()).toBe(401);
    expect((await me(ctx)).authenticated).toBe(false);
  });

  test('a directory user signs in, keeps one account across logins, and signs out', async () => {
    const ctx = await context();
    const res = await ldapLogin(ctx, alice);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'success', username: alice.username, provider: 'ldap' });
    const p = await me(ctx);
    expect(p).toMatchObject({ authenticated: true, kind: 'user', username: alice.username, superadmin: false });

    // The main site's page-load check reports the LDAP session
    const check = await (await ctx.post('/api/users/login', { data: { useToken: true } })).json();
    expect(check).toMatchObject({ status: 'success', username: alice.username, provider: 'ldap' });

    await ctx.post('/api/users/logout');
    expect((await me(ctx)).authenticated).toBe(false);

    const again = await context();
    expect((await ldapLogin(again, alice)).status()).toBe(200);
    const adminCtx = await adminContext();
    const entries = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries;
    const mine = entries.filter((e) => e.username === alice.username);
    expect(mine).toHaveLength(1);
    // Users & Access shows that the account signs in through LDAP, and when it last did
    expect(mine[0].sign_ins).toEqual([expect.objectContaining({ provider: 'ldap', username: alice.username })]);
    expect(Date.now() - new Date(mine[0].sign_ins[0].last_login_at).getTime()).toBeLessThan(60000);
  });

  test('directory groups give roles through groups with Members from LDAP', async () => {
    const adminCtx = await adminContext();
    const name = `ldap-science-${Date.now()}`;
    const created = await (await adminCtx.post('/api/access/groups/create', { data: { name, source: 'ldap', external_name: 'cn=science-team,ou=groups,dc=example,dc=org' } })).json();
    expect(created.status).toBe('success');
    const bound = await (await adminCtx.post('/api/access/bindings/add', {
      data: { subject_type: 'group', subject_id: created.body.id, role: 'data_admin', scope_type: 'global' },
    })).json();
    expect(bound.status).toBe('success');

    try {
      const aliceCtx = await context();
      expect((await ldapLogin(aliceCtx, alice)).status()).toBe(200);
      const p = await me(aliceCtx);
      expect(p.role).toBe('data_admin');
      expect(p.capabilities).toContain('data.geodatasets.write');

      // bob isn't in science-team
      const bobCtx = await context();
      expect((await ldapLogin(bobCtx, bob)).status()).toBe(200);
      expect((await me(bobCtx)).role).toBe('user');
      const groups = (await (await adminCtx.get('/api/access/groups')).json()).body;
      const members = groups.find((g) => g.id === created.body.id).members.map((m) => m.username);
      expect(members).toEqual([alice.username]);
    } finally {
      await adminCtx.post('/api/access/bindings/remove', { data: { id: bound.body.id } });
      await adminCtx.post('/api/access/groups/delete', { data: { id: created.body.id } });
    }
  });

  test('directory group changes reach existing sessions without signing in again', async () => {
    const recheckMinutes = parseFloat(process.env.AUTH_RECHECK_MINUTES);
    test.skip(!(recheckMinutes > 0 && recheckMinutes <= 0.1), 'SKIP: needs the server started with AUTH_RECHECK_MINUTES=0.05');
    const wait = () => new Promise((r) => setTimeout(r, recheckMinutes * 60 * 1000 + 1000));
    const adminCtx = await adminContext();
    const created = await (await adminCtx.post('/api/access/groups/create', { data: { name: `ldap-recheck-${Date.now()}`, source: 'ldap', external_name: 'cn=recheck-team,ou=groups,dc=example,dc=org' } })).json();
    const bound = await (await adminCtx.post('/api/access/bindings/add', {
      data: { subject_type: 'group', subject_id: created.body.id, role: 'data_admin', scope_type: 'global' },
    })).json();
    let added = false;
    try {
      const bobCtx = await context();
      expect((await ldapLogin(bobCtx, bob)).status()).toBe(200);
      expect((await me(bobCtx)).role).toBe('user');
      added = directoryAdmin(recheckTeam('add'));
      test.skip(!added, `SKIP: can't change the fixture directory (docker container ${container})`);
      await wait();
      expect((await me(bobCtx)).role).toBe('data_admin');
      expect(directoryAdmin(recheckTeam('delete'))).toBe(true);
      added = false;
      await wait();
      const after = await me(bobCtx);
      expect(after.authenticated).not.toBe(false);
      expect(after.role).toBe('user');
    } finally {
      if (added) directoryAdmin(recheckTeam('delete'));
      await adminCtx.post('/api/access/bindings/remove', { data: { id: bound.body.id } });
      await adminCtx.post('/api/access/groups/delete', { data: { id: created.body.id } });
    }
  });

  test('a directory username that is already a local account gets a 409 that does not name the other account', async () => {
    const ctx = await context();
    const res = await ldapLogin(ctx, clash);
    expect(res.status()).toBe(409);
    const { message } = await res.json();
    expect(message).toMatch(/Ask an administrator/);
    expect(message).not.toMatch(/already|belongs|test_admin/);
    expect((await me(ctx)).authenticated).toBe(false);
  });

  test('LDAP accounts get no MMGIS password reset link', async () => {
    const ctx = await context();
    expect((await ldapLogin(ctx, alice)).status()).toBe(200);
    const adminCtx = await adminContext();
    const entries = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries;
    const account = entries.find((e) => e.username === alice.username);
    const res = await (await adminCtx.post('/api/accounts/generateResetPasswordLink', { data: { id: account.id } })).json();
    expect(res.status).toBe('failure');
    expect(res.message).toMatch(/signs in with .*no MMGIS password/);
  });

  test('failed logins are limited per account, whatever address or domain prefix they come with', async () => {
    const probe = `lockout_probe_${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const ctx = await context();
      const name = i % 2 ? `CORP\\${probe}` : probe;
      expect((await ldapLogin(ctx, { username: name, password: 'not-the-password' })).status()).toBe(401); // pragma: allowlist secret
    }
    const blocked = await ldapLogin(await context(), { username: probe.toUpperCase(), password: 'not-the-password' }); // pragma: allowlist secret
    expect(blocked.status()).toBe(429);
    expect((await blocked.json()).message).toMatch(/this account/);
    // Other accounts are unaffected
    expect((await ldapLogin(await context(), { username: bob.username, password: bob.password })).status()).toBe(200);
  });

  test('local accounts still log in alongside LDAP', async () => {
    const ctx = await adminContext();
    expect((await me(ctx)).superadmin).toBe(true);
  });
});
