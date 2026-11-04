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

  test('a login posted from another site is refused', async () => {
    const ctx = await context();
    const res = await ctx.post('/api/auth/ldap/login', { data: bob, headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } });
    expect(res.status()).toBe(403);
    expect((await ldapLogin(ctx, bob)).status()).toBe(200);
    // The shared form's local option posts to /api/users/login, so that alias is refused too
    for (const path of ['/api/users/login', '/api/auth/local/login']) {
      const local = await (await context()).post(path, { data: admin, headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } });
      expect(local.status()).toBe(403);
    }
  });

  test('sign-up refuses usernames that differ from an existing one only in case or Unicode form', async () => {
    const adminCtx = await adminContext();
    for (const username of ['TEST_ADMIN', 'ｔｅｓｔ＿ａｄｍｉｎ', 'test_admİn']) {
      const made = await (await adminCtx.post('/api/users/signup', { data: { username, email: `twin${Date.now()}@example.org`, password: ['twin', 'test', 'password'].join('-'), skipLogin: true } })).json();
      expect(made.status).toBe('failure');
    }
  });

  test('a local login with a non-string username is refused before the failed-login limits', async () => {
    const ctx = await context();
    const res = await ctx.post('/api/users/login', { data: { username: [admin.username], password: admin.password } });
    expect(res.status()).toBe(400);
  });

  test('requests refused for other reasons than wrong credentials do not use up the address limit', async () => {
    const ctx = await context();
    for (let i = 0; i < 6; i++) {
      expect((await ldapLogin(ctx, { username: `empty_${i}`, password: '' })).status()).toBe(400);
      expect((await ldapLogin(ctx, clash)).status()).toBe(409);
    }
    expect((await ldapLogin(ctx, bob)).status()).toBe(200);
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

  test('a new directory group fills in from people already signed in', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to read the directory between logins');
    test.skip(process.env.AUTH_RECHECK_MINUTES === '0', 'SKIP: with rechecks off, groups fill at sign-in or Check linked accounts');
    expect((await ldapLogin(await context(), alice)).status()).toBe(200);
    const adminCtx = await adminContext();
    const created = await (await adminCtx.post('/api/access/groups/create', { data: { name: `ldap-fill-${Date.now()}`, source: 'ldap', external_name: 'cn=science-team,ou=groups,dc=example,dc=org' } })).json();
    expect(created.status).toBe('success');
    try {
      const members = async () =>
        (await (await adminCtx.get('/api/access/groups')).json()).body.find((g) => g.id === created.body.id).members.map((m) => m.username);
      await expect.poll(members, { timeout: 15000 }).toContain(alice.username);
    } finally {
      await adminCtx.post('/api/access/groups/delete', { data: { id: created.body.id } });
    }
  });

  test('creating a directory group says why it may stay empty and names another group mapping the same DN', async () => {
    const adminCtx = await adminContext();
    const dn = `cn=dup-${Date.now()},ou=groups,dc=example,dc=org`;
    const ids = [];
    try {
      const first = await (await adminCtx.post('/api/access/groups/create', { data: { name: `ldap-dup-a-${Date.now()}`, source: 'ldap', external_name: dn } })).json();
      ids.push(first.body.id);
      const second = await (await adminCtx.post('/api/access/groups/create', { data: { name: `ldap-dup-b-${Date.now()}`, source: 'ldap', external_name: dn.toUpperCase() } })).json();
      ids.push(second.body.id);
      expect(second.note).toContain(`Group '${first.body.name}' also gets its members from ${dn}`);
      if (process.env.AUTH_RECHECK_MINUTES === '0') expect(second.note).toMatch(/Rechecks are off .* Check linked accounts/);
      else expect(second.note).not.toMatch(/Rechecks are off/);
    } finally {
      for (const id of ids) await adminCtx.post('/api/access/groups/delete', { data: { id } });
    }
  });

  test('Check a provider user with no groups lists the groups the directory reports now', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to look people up');
    const adminCtx = await adminContext();
    const found = await (await adminCtx.get(`/api/access/effective?provider=ldap&username=${alice.username}`)).json();
    expect(found.status).toBe('success');
    expect(found.body.reported).toContain('cn=science-team,ou=groups,dc=example,dc=org');
    const typed = await (await adminCtx.get(`/api/access/effective?provider=ldap&username=${alice.username}&groups=cn%3Dother,ou%3Dgroups,dc%3Dexample,dc%3Dorg`)).json();
    expect(typed.body.reported).toBeUndefined();
    const nobody = await (await adminCtx.get('/api/access/effective?provider=ldap&username=nobody-here')).json();
    expect(nobody.message).toMatch(/no single entry/);
  });

  test('Check a provider user follows the directory entry after a rename and a reused username', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to look people up');
    const name = `ldap_reuse_${Date.now()}`;
    const password = ['reuse', 'test', 'password'].join('-');
    const dn = (uid) => `uid=${uid},ou=people,dc=example,dc=org`;
    const entry = (uid) => `dn: ${dn(uid)}\nchangetype: add\nobjectClass: inetOrgPerson\nuid: ${uid}\ncn: ${uid}\nsn: ${uid}\nuserPassword: ${password}\n`;
    test.skip(!directoryAdmin(entry(name)), 'SKIP: needs the fixture directory container to change entries');
    try {
      expect((await ldapLogin(await context(), { username: name, password })).status()).toBe(200);
      expect(directoryAdmin(`dn: ${dn(name)}\nchangetype: modrdn\nnewrdn: uid=${name}_moved\ndeleteoldrdn: 1\n`)).toBe(true);
      expect(directoryAdmin(entry(name))).toBe(true);
      const adminCtx = await adminContext();
      const check = async (username) => (await (await adminCtx.get(`/api/access/effective?provider=ldap&username=${username}`)).json()).body;
      expect((await check(`${name}_moved`)).note).toContain(`MMGIS account '${name}' signs in as this person`);
      expect((await check(name)).note).toMatch(/linked to a different ldap entry .* sign-in is refused/);
      expect((await ldapLogin(await context(), { username: name, password })).status()).toBe(409);
    } finally {
      directoryAdmin(`dn: ${dn(name)}\nchangetype: delete\n`);
      directoryAdmin(`dn: ${dn(`${name}_moved`)}\nchangetype: delete\n`);
    }
  });

  test('Check a provider user shows a pending relink allowed under another username', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to look people up');
    const name = `ldap_pending_${Date.now()}`;
    const password = ['pending', 'test', 'password'].join('-');
    const dn = `uid=${name},ou=people,dc=example,dc=org`;
    test.skip(!directoryAdmin(`dn: ${dn}\nchangetype: add\nobjectClass: inetOrgPerson\nuid: ${name}\ncn: ${name}\nsn: ${name}\nuserPassword: ${password}\n`), 'SKIP: needs the fixture directory container to change entries');
    try {
      const adminCtx = await adminContext();
      const local = `${name}_local`;
      const made = await (await adminCtx.post('/api/users/signup', { data: { username: local, email: `${local}@example.org`, password: ['Local', 'Pass', '1!x'].join(''), skipLogin: true } })).json();
      expect(made.status).toBe('success');
      const account = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries.find((e) => e.username === local);
      expect((await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', username: name } })).json()).status).toBe('success');
      const check = (await (await adminCtx.get(`/api/access/effective?provider=ldap&username=${name}`)).json()).body;
      expect(check.note).toContain(`next sign-in takes over account '${local}'`);
      expect((await ldapLogin(await context(), { username: name, password })).status()).toBe(200);
      const after = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries.find((e) => e.id === account.id);
      expect(after.sign_ins).toEqual([expect.objectContaining({ provider: 'ldap' })]);
    } finally {
      directoryAdmin(`dn: ${dn}\nchangetype: delete\n`);
    }
  });

  test('pointing a directory group at another directory group fills it from people already signed in', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to read the directory between logins');
    test.skip(process.env.AUTH_RECHECK_MINUTES === '0', 'SKIP: with rechecks off, groups fill at sign-in or Check linked accounts');
    expect((await ldapLogin(await context(), alice)).status()).toBe(200);
    const adminCtx = await adminContext();
    const created = await (await adminCtx.post('/api/access/groups/create', { data: { name: `ldap-repoint-${Date.now()}`, source: 'ldap', external_name: 'cn=nobody-here,ou=groups,dc=example,dc=org' } })).json();
    expect(created.status).toBe('success');
    try {
      const members = async () =>
        (await (await adminCtx.get('/api/access/groups')).json()).body.find((g) => g.id === created.body.id).members.map((m) => m.username);
      const updated = await (await adminCtx.post('/api/access/groups/update', { data: { id: created.body.id, external_name: 'cn=science-team,ou=groups,dc=example,dc=org' } })).json();
      expect(updated.status).toBe('success');
      await expect.poll(members, { timeout: 15000 }).toContain(alice.username);
    } finally {
      await adminCtx.post('/api/access/groups/delete', { data: { id: created.body.id } });
    }
  });

  test('directory group changes reach existing sessions without signing in again', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to read the directory between logins');
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

  test('a relink typed as DOMAIN\\name waits for the name people sign in with', async () => {
    const domain = process.env.LDAP_USERNAME_DOMAIN;
    test.skip(!domain, 'SKIP: needs the server started with LDAP_USERNAME_DOMAIN');
    const username = `ldap_dom_${Date.now()}`;
    const password = ['dom', 'test', 'password'].join('-');
    const dn = `uid=${username},ou=people,dc=example,dc=org`;
    const added = directoryAdmin(`dn: ${dn}\nchangetype: add\nobjectClass: inetOrgPerson\nuid: ${username}\ncn: Dom\nsn: Dom\nuserPassword: ${password}\n`);
    test.skip(!added, `SKIP: can't change the fixture directory (docker container ${container})`);
    try {
      const adminCtx = await adminContext();
      const entries = async () => (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries;
      const local = `${username}_local`;
      const made = await (await adminCtx.post('/api/users/signup', { data: { username: local, email: `${local}@example.org`, password: ['Local', 'test', '1!'].join('-'), skipLogin: true } })).json();
      expect(made.status).toBe('success');
      const account = (await entries()).find((e) => e.username === local);
      const allowed = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', username: `${domain}\\${username}` } })).json();
      expect(allowed.status).toBe('success');
      expect((await entries()).find((e) => e.id === account.id).relink).toMatchObject({ username });
      expect((await ldapLogin(await context(), { username: `${domain}\\${username}`, password })).status()).toBe(200);
      const after = (await entries()).find((e) => e.id === account.id);
      expect(after.sign_ins).toEqual([expect.objectContaining({ provider: 'ldap' })]);
      expect((await entries()).some((e) => e.username === username)).toBe(false);
    } finally {
      directoryAdmin(`dn: ${dn}\nchangetype: delete\n`);
    }
  });

  test('with rechecks off, Check linked accounts still cuts off a leaver it finds gone', async () => {
    test.skip(process.env.AUTH_RECHECK_MINUTES !== '0', 'SKIP: needs the server started with AUTH_RECHECK_MINUTES=0');
    const uid = `ldap_leaver_${Date.now()}`;
    const password = ['leaver', 'test', 'password'].join('-');
    const dn = `uid=${uid},ou=people,dc=example,dc=org`;
    const added = directoryAdmin(`dn: ${dn}\nchangetype: add\nobjectClass: inetOrgPerson\nuid: ${uid}\ncn: Leaver\nsn: Leaver\nuserPassword: ${password}\n`);
    test.skip(!added, `SKIP: can't change the fixture directory (docker container ${container})`);
    let deleted = false;
    try {
      const ctx = await context();
      expect((await ldapLogin(ctx, { username: uid, password })).status()).toBe(200);
      const minted = await (await ctx.post('/api/longtermtoken/generate', { data: { name: 'leaver', period: 'never' } })).json();
      expect(minted.status).toBe('success');
      const withToken = await newRequest.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${minted.body.token}` } });
      expect((await me(withToken)).username).toBe(uid);
      deleted = directoryAdmin(`dn: ${dn}\nchangetype: delete\n`);
      expect(deleted).toBe(true);
      // Rechecks are off, so nothing changes until an admin checks
      expect((await me(ctx)).username).toBe(uid);
      const adminCtx = await adminContext();
      expect((await (await adminCtx.post('/api/accounts/recheckLinked')).json()).body.missing).toBeGreaterThanOrEqual(1);
      expect((await me(ctx)).authenticated).toBe(false);
      expect((await me(withToken)).username).not.toBe(uid);
    } finally {
      if (!deleted) directoryAdmin(`dn: ${dn}\nchangetype: delete\n`);
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

  test('the sign-in form only suggests another account type after a wrong password', async ({ page }) => {
    await page.goto(`${baseURL}/configure`);
    const signIn = async (username, password) => {
      await page.fill('#username', username);
      await page.fill('#pwd', password);
      await page.click('button.btn1');
    };
    await expect(page.locator('.loginProvider.active')).toHaveAttribute('data-id', 'ldap');
    await signIn(clash.username, clash.password);
    await expect(page.locator('#msg')).toContainText('Ask an administrator');
    await expect(page.locator('#msg')).not.toContainText('different account type');
    await signIn('ldap_nobody_ui', ['wrong', 'pw'].join('-'));
    await expect(page.locator('#msg')).toContainText('different account type');
  });

  test('an admin can let one directory login claim an existing local account', async () => {
    test.skip(!process.env.LDAP_BIND_DN, 'SKIP: needs a service account (LDAP_BIND_DN) to read the directory between logins');
    const username = `ldap_relink_${Date.now()}`;
    const password = ['relink', 'test', 'password'].join('-');
    const localPassword = ['Local', 'Pass', '1!x'].join('');
    const dn = `uid=${username},ou=people,dc=example,dc=org`;
    const added = directoryAdmin(`dn: ${dn}\nchangetype: add\nobjectClass: inetOrgPerson\nuid: ${username}\ncn: Relink\nsn: Relink\nuserPassword: ${password}\n`);
    test.skip(!added, `SKIP: can't change the fixture directory (docker container ${container})`);
    const adminCtx = await adminContext();
    let accountId;
    let otherId;
    try {
      const entries = async () => (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries;
      const made = await (await adminCtx.post('/api/users/signup', { data: { username, email: `${username}@example.org`, password: localPassword, skipLogin: true } })).json();
      expect(made.status).toBe('success');
      const account = (await entries()).find((e) => e.username === username);
      accountId = account.id;
      expect((await ldapLogin(await context(), { username, password })).status()).toBe(409);
      const localSession = await context();
      expect((await (await localSession.post('/api/users/login', { data: { username, password: localPassword } })).json()).status).toBe('success');
      expect((await me(localSession)).authenticated).toBe(true);

      // A preview names the entry without allowing anything
      const preview = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', preview: true } })).json();
      expect(preview).toMatchObject({ status: 'success', body: { dn, preview: true } });
      expect((await entries()).find((e) => e.id === account.id).relink).toBeFalsy();
      expect((await ldapLogin(await context(), { username, password })).status()).toBe(409);
      // Confirming refuses when the username now finds a different entry from the one shown
      const moved = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', dn: `uid=${username},ou=contractors,dc=example,dc=org` } })).json();
      expect(moved).toMatchObject({ status: 'failure', message: expect.stringContaining('as shown') });
      expect((await entries()).find((e) => e.id === account.id).relink).toBeFalsy();
      const allowed = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', dn: dn.toUpperCase() } })).json();
      expect(allowed.status).toBe('success');
      // Pinned to the directory entry that has the username now
      expect(allowed.body.dn).toBe(dn);
      expect((await entries()).find((e) => e.id === account.id).relink).toMatchObject({ provider: 'ldap', username, dn });

      expect((await ldapLogin(await context(), { username, password })).status()).toBe(200);
      const after = (await entries()).find((e) => e.username === username);
      expect(after.id).toBe(account.id);
      expect(after.sign_ins).toEqual([expect.objectContaining({ provider: 'ldap' })]);
      expect(after.relink).toBeNull();
      // A preview gives the same refusal the relink would
      const again = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: account.id, provider: 'ldap', preview: true } })).json();
      expect(again).toMatchObject({ status: 'failure', message: expect.stringContaining('nothing to relink') });
      // Whoever was signed in with the local password is signed out
      expect((await me(localSession)).authenticated).toBe(false);
      // Now linked to LDAP, so its old local password no longer signs in
      const local = await (await (await context()).post('/api/users/login', { data: { username, password: localPassword, skipLogin: true } })).json();
      expect(local.status).not.toBe('success');

      // That entry now signs in to this account, so another account can't be offered to it
      const other = await (await adminCtx.post('/api/users/signup', { data: { username: `${username}_b`, email: `${username}_b@example.org`, password: localPassword, skipLogin: true } })).json();
      expect(other.status).toBe('success');
      otherId = (await entries()).find((e) => e.username === `${username}_b`).id;
      const refused = await (await adminCtx.post('/api/accounts/allowRelink', { data: { id: otherId, provider: 'ldap', username } })).json();
      expect(refused.status).toBe('failure');
      expect(refused.message).toContain(`already signs in to account ${account.id}`);
    } finally {
      if (otherId) await adminCtx.delete(`/api/accounts/remove/${otherId}`);
      if (accountId) await adminCtx.delete(`/api/accounts/remove/${accountId}`);
      directoryAdmin(`dn: ${dn}\nchangetype: delete\n`);
    }
  });

  test('a deleted account\'s drawings do not go to the next account with its username', async () => {
    const adminCtx = await adminContext();
    const ctx = await context();
    expect((await ldapLogin(ctx, alice)).status()).toBe(200);
    const name = `alice private ${Date.now()}`;
    const made = await (await ctx.post('/api/files/make', { data: { file_name: name, intent: 'all' } })).json();
    expect(made.status).toBe('success');
    const files = async (c) => (await (await c.post('/api/files/getfiles', { data: {} })).json()).body.filter((f) => f.file_name === name);
    const [file] = await files(ctx);
    expect((await (await ctx.post('/api/files/change', { data: { id: file.id, public: '0' } })).json()).status).toBe('success');
    expect(await files(ctx)).toHaveLength(1);
    const bobCtx = await context();
    expect((await ldapLogin(bobCtx, bob)).status()).toBe(200);
    const sharedName = `bob shared ${Date.now()}`;
    expect((await (await bobCtx.post('/api/files/make', { data: { file_name: sharedName, intent: 'all' } })).json()).status).toBe('success');
    const shared = async () => (await (await bobCtx.post('/api/files/getfiles', { data: {} })).json()).body.find((f) => f.file_name === sharedName);
    const change = { id: (await shared()).id, public: '1', publicity_type: 'list_edit', public_editors: alice.username };
    expect((await (await bobCtx.post('/api/files/change', { data: change })).json()).status).toBe('success');
    expect((await shared()).public_editors).toContain(alice.username);
    const id = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries.find((e) => e.username === alice.username).id;
    expect((await (await adminCtx.delete(`/api/accounts/remove/${id}`)).json()).status).toBe('success');
    const next = await context();
    expect((await ldapLogin(next, alice)).status()).toBe(200);
    expect(await files(next)).toHaveLength(0);
    expect((await shared()).public_editors || []).not.toContain(alice.username);
  });

  test('deleting an account can give its drawings to another account', async () => {
    const adminCtx = await adminContext();
    const ctx = await context();
    expect((await ldapLogin(ctx, alice)).status()).toBe(200);
    const name = `alice interim ${Date.now()}`;
    expect((await (await ctx.post('/api/files/make', { data: { file_name: name, intent: 'all' } })).json()).status).toBe('success');
    const heir = `heir_${Date.now()}`;
    const heirPassword = ['Heir', 'Pass', '1!x'].join('');
    expect((await (await adminCtx.post('/api/users/signup', { data: { username: heir, email: `${heir}@example.org`, password: heirPassword, skipLogin: true } })).json()).status).toBe('success');
    const id = (await (await adminCtx.get('/api/accounts/entries')).json()).body.entries.find((e) => e.username === alice.username).id;
    const refused = await (await adminCtx.delete(`/api/accounts/remove/${id}?drawings_to=nobody-${Date.now()}`)).json();
    expect(refused.status).toBe('failure');
    const minted = await (await adminCtx.post('/api/longtermtoken/generate', { data: { name: 'heir', period: 'never' } })).json();
    const withToken = await newRequest.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${minted.body.token}` } });
    expect((await withToken.delete(`/api/accounts/remove/${id}?drawings_to=${heir}`)).status()).toBe(403);
    await withToken.dispose();
    expect((await me(ctx)).authenticated).toBe(true);
    expect((await (await adminCtx.delete(`/api/accounts/remove/${id}?drawings_to=${heir}`)).json()).status).toBe('success');
    const heirCtx = await context();
    expect((await (await heirCtx.post('/api/users/login', { data: { username: heir, password: heirPassword } })).json()).status).toBe('success');
    const files = (await (await heirCtx.post('/api/files/getfiles', { data: {} })).json()).body.filter((f) => f.file_name === name);
    expect(files).toHaveLength(1);
    expect(files[0].file_owner).toBe(heir);
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
