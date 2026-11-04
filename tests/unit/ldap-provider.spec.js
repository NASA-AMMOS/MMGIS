/**
 * Unit tests for the LDAP login provider (plugins/core/auth/Ldap).
 * The directory is a fake client; tests/e2e/ldap runs against a real OpenLDAP.
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const { InvalidCredentialsError, SizeLimitExceededError, NoSuchObjectError } = require('ldapts');

const ldap = require(path.resolve(__dirname, '../../plugins/core/auth/Ldap/plugin.js'));
const { config, stripDomain, escapeFilter, escapeDn, normalizeDn, guidString, authenticate, selfCheck, explain, PasswordExpiredError } = ldap._internal;

const base = {
  LDAP_URL: 'ldaps://ldap.example.org',
  LDAP_BIND_DN: 'cn=svc,dc=example,dc=org',
  LDAP_BIND_PASSWORD: 'svc', // pragma: allowlist secret
  LDAP_USER_SEARCH_BASE: 'ou=people,dc=example,dc=org',
};

// A fake directory: people by DN with a password, searched by uid
function fakeClient(people, log = []) {
  return () => ({
    async startTLS() { log.push('starttls'); },
    async bind(dn, password) {
      log.push(`bind ${dn}`);
      if (dn === base.LDAP_BIND_DN && password === base.LDAP_BIND_PASSWORD) return;
      const p = people.find((x) => x.dn === dn);
      if (!p || p.password !== password) {
        const err = new InvalidCredentialsError(p && p.adCode ? `80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, data ${p.adCode}, v4563` : 'Invalid credentials');
        throw err;
      }
    },
    async search(searchBase, opts) {
      log.push(`search ${searchBase} ${opts.filter}`);
      if (opts.scope === 'base') return { searchEntries: people.filter((p) => p.dn === searchBase).map((p) => p.entry) };
      const m = /^\(uid=(.*)\)$/.exec(opts.filter);
      const found = people.filter((p) => m && p.entry.uid === m[1]);
      if (opts.sizeLimit && found.length > opts.sizeLimit) throw new SizeLimitExceededError('Size limit exceeded');
      return { searchEntries: found.map((p) => p.entry) };
    },
    async unbind() { log.push('unbind'); },
  });
}

const alice = {
  dn: 'uid=alice,ou=people,dc=example,dc=org',
  password: 'right', // pragma: allowlist secret
  entry: {
    dn: 'uid=alice,ou=people,dc=example,dc=org',
    entryUUID: 'e1',
    uid: 'alice',
    mail: 'alice@example.org',
    memberOf: ['cn=science-team,ou=groups,dc=example,dc=org', 'cn=Ops\\2C East,ou=groups,dc=example,dc=org'],
  },
};

test.describe('LDAP escaping', () => {
  test('usernames are escaped in filters (RFC 4515) and DNs (RFC 4514)', () => {
    expect(escapeFilter('a*)(uid=*')).toBe('a\\2a\\29\\28uid=\\2a');
    expect(escapeFilter('back\\slash\0')).toBe('back\\5cslash\\00');
    expect(escapeDn('a,b+c"d<e>f;g=h\\i')).toBe('a\\,b\\+c\\"d\\<e\\>f\\;g\\=h\\\\i');
    expect(escapeDn(' #lead trail ')).toBe('\\ #lead trail\\ ');
    expect(escapeDn('#x')).toBe('\\#x');
  });

  test('LDAP_USERNAME_DOMAIN removes only that Windows domain prefix', () => {
    const c = config({ ...base, LDAP_USERNAME_DOMAIN: 'CORP' });
    expect(stripDomain('CORP\\alice', c)).toBe('alice');
    expect(stripDomain('corp\\alice', c)).toBe('alice');
    expect(stripDomain('OTHER\\alice', c)).toBe('OTHER\\alice');
    expect(stripDomain('alice@corp.example.org', c)).toBe('alice@corp.example.org');
    expect(stripDomain('CORP\\alice', config(base))).toBe('CORP\\alice');
  });

  test('group DNs are compared lowercased and without spaces, so same-named groups in different OUs stay apart', () => {
    expect(normalizeDn('CN=Science Team, OU=Groups ,DC=corp')).toBe('cn=science team,ou=groups,dc=corp');
    expect(normalizeDn('cn = a\\,b,dc=x')).toBe('cn=a\\,b,dc=x');
    expect(normalizeDn('cn=admins,ou=a,dc=x')).not.toBe(normalizeDn('cn=admins,ou=b,dc=x'));
  });

  test('Active Directory objectGUIDs are formatted like AD shows them', () => {
    const buf = Buffer.from('ab4bcf8b7e44e04c8b9e6b13f7c2e1a0', 'hex');
    expect(guidString(buf)).toBe('8bcf4bab-447e-4ce0-8b9e-6b13f7c2e1a0');
  });
});

test.describe('LDAP login', () => {
  test('search mode: service account finds the person, their password is checked by binding as them', async () => {
    const log = [];
    const id = await authenticate('alice', 'right', config(base), fakeClient([alice], log));
    expect(id).toEqual({ subject: 'e1', username: 'alice', email: 'alice@example.org', groups: ['cn=science-team,ou=groups,dc=example,dc=org', 'cn=ops\\2c east,ou=groups,dc=example,dc=org'] });
    expect(log).toEqual([`bind ${base.LDAP_BIND_DN}`, `search ${base.LDAP_USER_SEARCH_BASE} (uid=alice)`, `bind ${alice.dn}`, 'unbind']);
  });

  test('wrong passwords, unknown and ambiguous usernames are all "not signed in"', async () => {
    const twin = { ...alice, dn: 'uid=alice,ou=other,dc=example,dc=org', entry: { ...alice.entry, dn: 'uid=alice,ou=other,dc=example,dc=org' } };
    expect(await authenticate('alice', 'wrong', config(base), fakeClient([alice]))).toBeNull();
    expect(await authenticate('nobody', 'right', config(base), fakeClient([alice]))).toBeNull();
    expect(await authenticate('alice', 'right', config(base), fakeClient([alice, twin]))).toBeNull();
    expect(await authenticate('alice', 'right', config(base), fakeClient([alice, twin, twin]))).toBeNull();
  });

  test('filter metacharacters in the username are escaped, so a wildcard matches nobody', async () => {
    const log = [];
    expect(await authenticate('*', 'right', config(base), fakeClient([alice], log))).toBeNull();
    expect(log).toContain(`search ${base.LDAP_USER_SEARCH_BASE} (uid=\\2a)`);
  });

  test('direct mode binds as the DN template and reads the entry as the person', async () => {
    const log = [];
    const env = { LDAP_URL: 'ldaps://x', LDAP_USER_DN_TEMPLATE: 'uid={{username}},ou=people,dc=example,dc=org' };
    const id = await authenticate('alice', 'right', config(env), fakeClient([alice], log));
    expect(id.subject).toBe('e1');
    expect(log).toEqual([`bind ${alice.dn}`, `search ${alice.dn} (objectClass=*)`, 'unbind']);
  });

  test('StartTLS runs before anything else is sent', async () => {
    const log = [];
    await authenticate('alice', 'right', config({ ...base, LDAP_URL: 'ldap://x', LDAP_STARTTLS: 'true' }), fakeClient([alice], log));
    expect(log[0]).toBe('starttls');
  });

  test('a rejected service account or missing subject attribute throws (the route answers 503)', async () => {
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_BIND_PASSWORD: 'nope' }), fakeClient([alice]))).rejects.toThrow(/LDAP_BIND_DN/); // pragma: allowlist secret
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'objectGUID' }), fakeClient([alice]))).rejects.toThrow(/objectGUID/);
  });

  test('Active Directory "password expired" is told apart from a wrong password', async () => {
    const expired = { ...alice, password: 'other', adCode: '532' }; // pragma: allowlist secret
    await expect(authenticate('alice', 'right', config(base), fakeClient([expired]))).rejects.toBeInstanceOf(PasswordExpiredError);
  });

  test('a rejected service account is not retried at every login, so the directory does not lock it', async () => {
    const env = { ...base, LDAP_BIND_PASSWORD: 'wrong-for-lockout-test' }; // pragma: allowlist secret
    await expect(authenticate('alice', 'right', config(env), fakeClient([alice]))).rejects.toThrow(/won't retry it for 5 minutes/);
    const log = [];
    await expect(authenticate('alice', 'right', config(env), fakeClient([alice], log))).rejects.toThrow(/at most every 5 minutes/);
    expect(log.filter((l) => l.startsWith('bind'))).toEqual([]);
  });

  test('the reason a login was refused is reported for the server log', async () => {
    const reasons = [];
    const why = (r) => reasons.push(r);
    const twin = { ...alice, dn: 'uid=alice,ou=other,dc=example,dc=org', entry: { ...alice.entry, dn: 'uid=alice,ou=other,dc=example,dc=org' } };
    await authenticate('alice', 'wrong', config(base), fakeClient([alice]), why);
    await authenticate('nobody', 'right', config(base), fakeClient([alice]), why);
    await authenticate('alice', 'right', config(base), fakeClient([alice, twin, twin]), why);
    await authenticate('alice', 'right', config(base), fakeClient([{ ...alice, password: 'x', adCode: '533' }]), why); // pragma: allowlist secret
    expect(reasons[0]).toMatch(/refused the password for uid=alice/);
    expect(reasons[1]).toMatch(/no entry under LDAP_USER_SEARCH_BASE matches \(uid=nobody\)/);
    expect(reasons[2]).toMatch(/more than one entry/);
    expect(reasons[3]).toMatch(/account disabled/);
  });

  test('connection errors say which setting to check', () => {
    expect(explain(Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }))).toMatch(/LDAP_TLS_CA/);
    expect(explain(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:636'), { code: 'ECONNREFUSED' }))).toMatch(/host and port/);
    expect(explain(new NoSuchObjectError('No such object'))).toMatch(/LDAP_USER_SEARCH_BASE/);
  });

  test('the startup check signs in the service account and finds the search bases, without anyone\'s password', async () => {
    const log = [];
    const checked = await selfCheck(config({ ...base, LDAP_USER_SEARCH_BASE: alice.dn }), fakeClient([alice], log));
    expect(checked).toEqual(['connected to ldaps://ldap.example.org', 'the service account signed in', 'LDAP_USER_SEARCH_BASE exists']);
    const missing = () => ({
      async bind() {},
      async search(dn) {
        if (dn) throw new NoSuchObjectError('No such object');
        return { searchEntries: [] };
      },
      async unbind() {},
    });
    await expect(selfCheck(config(base), missing)).rejects.toThrow(/LDAP_USER_SEARCH_BASE \(ou=people/);
  });
});

test.describe('LDAP settings', () => {
  const problems = (env) => ldap.validate(env).join('\n');

  test('a valid search or direct-bind setup has no problems', () => {
    expect(ldap.validate(base)).toEqual([]);
    expect(ldap.validate({ LDAP_URL: 'ldap://x:389', LDAP_STARTTLS: 'true', LDAP_USER_DN_TEMPLATE: 'uid={{username}},dc=x' })).toEqual([]);
  });

  test('passwords never cross the network unencrypted unless explicitly allowed', () => {
    expect(problems({ ...base, LDAP_URL: 'ldap://x' })).toMatch(/unencrypted/);
    expect(problems({ ...base, LDAP_URL: 'ldap://x', LDAP_ALLOW_INSECURE: 'true' })).toBe('');
    expect(ldap.warnings({ ...base, LDAP_URL: 'ldap://x', LDAP_ALLOW_INSECURE: 'true' }).join()).toMatch(/unencrypted/);
    expect(problems({ ...base, LDAP_STARTTLS: 'true' })).toMatch(/already encrypted/);
  });

  test('missing or malformed settings refuse startup', () => {
    expect(problems({})).toMatch(/LDAP_URL must be set/);
    expect(problems({ LDAP_URL: 'ldaps://x' })).toMatch(/LDAP_USER_SEARCH_BASE .* or LDAP_USER_DN_TEMPLATE/);
    expect(problems({ ...base, LDAP_USER_SEARCH_FILTER: 'uid=x' })).toMatch(/LDAP_USER_SEARCH_FILTER/);
    expect(problems({ LDAP_URL: 'ldaps://x', LDAP_USER_DN_TEMPLATE: '{{username}}@corp' })).toMatch(/isn't a DN/);
    expect(problems({ ...base, LDAP_BIND_PASSWORD: '' })).toMatch(/LDAP_BIND_PASSWORD is empty/);
    expect(problems({ ...base, LDAP_TLS_CA: '/no/such/ca.pem' })).toMatch(/LDAP_TLS_CA/);
    const notPem = path.join(require('os').tmpdir(), `mmgis-ldap-not-pem-${process.pid}.cer`);
    require('fs').writeFileSync(notPem, Buffer.from([0x30, 0x82, 0x01]));
    expect(problems({ ...base, LDAP_TLS_CA: notPem })).toMatch(/isn't a PEM certificate/);
    expect(problems({ ...base, LDAP_TIMEOUT_MS: 'soon' })).toMatch(/LDAP_TIMEOUT_MS/);
    expect(problems({ ...base, LDAP_GROUP_SEARCH_BASE: 'ou=g', LDAP_GROUP_SEARCH_FILTER: '(member=x)' })).toMatch(/LDAP_GROUP_SEARCH_FILTER/);
  });

  test('the login form wording comes from the site settings', () => {
    expect(ldap.loginForm({})).toEqual({ title: 'LDAP', usernameLabel: 'Username', hint: '' });
    expect(ldap.loginForm({ LDAP_DISPLAY_NAME: 'JPL Directory', LDAP_USERNAME_LABEL: 'JPL username', LDAP_LOGIN_HINT: 'Same as email.' })) // pragma: allowlist secret
      .toEqual({ title: 'JPL Directory', usernameLabel: 'JPL username', hint: 'Same as email.' });
  });
});
