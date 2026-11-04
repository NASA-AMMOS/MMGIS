/**
 * Unit tests for the LDAP login provider (plugins/core/auth/Ldap).
 * The directory is a fake client; ldap-provider.spec.js runs against a real OpenLDAP.
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const { InvalidCredentialsError, SizeLimitExceededError, NoSuchObjectError, InvalidDNSyntaxError } = require('ldapts');

const ldap = require(path.resolve(__dirname, '../plugin.js'));
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
    // A relink typed the way people sign in waits for the username their logins report
    const before = process.env.LDAP_USERNAME_DOMAIN;
    process.env.LDAP_USERNAME_DOMAIN = 'CORP';
    try {
      expect(ldap.relinkUsername(' CORP\\alice ')).toBe('alice');
    } finally {
      if (before === undefined) delete process.env.LDAP_USERNAME_DOMAIN;
      else process.env.LDAP_USERNAME_DOMAIN = before;
    }
  });

  test('group DNs are compared lowercased and without spaces, so same-named groups in different OUs stay apart', () => {
    expect(normalizeDn('CN=Science Team, OU=Groups ,DC=corp')).toBe('cn=science team,ou=groups,dc=corp');
    expect(normalizeDn('cn = a\\,b,dc=x')).toBe('cn=a\\,b,dc=x');
    // Directories return hex escapes (\2c); admins copy \, from their tools
    expect(normalizeDn('cn=Weird\\2c Group\\2bx,dc=x')).toBe(normalizeDn('CN=Weird\\, Group\\+x, DC=x'));
    expect(normalizeDn('cn=Weird\\2c Group\\2bx,dc=x')).toBe('cn=weird\\, group\\+x,dc=x');
    expect(normalizeDn('cn=Gr\\c3\\bcne,dc=x')).toBe('cn=grüne,dc=x');
    expect(normalizeDn('cn=a+uid=B,dc=x')).toBe('cn=a+uid=b,dc=x');
    expect(normalizeDn('uid=jose\u0301,dc=x')).toBe(normalizeDn('uid=jos\u00e9,dc=x'));
    expect(normalizeDn('cn=admins,ou=a,dc=x')).not.toBe(normalizeDn('cn=admins,ou=b,dc=x'));
  });

  test('groupName refuses plain names while groups are reported by DN', () => {
    const saved = { a: process.env.LDAP_GROUP_NAME_ATTRIBUTE, b: process.env.LDAP_GROUP_SEARCH_BASE };
    try {
      delete process.env.LDAP_GROUP_NAME_ATTRIBUTE;
      delete process.env.LDAP_GROUP_SEARCH_BASE;
      expect(ldap.groupName('CN=Data-Admins,OU=Groups,DC=x')).toBe('cn=data-admins,ou=groups,dc=x');
      expect(() => ldap.groupName('data-admins')).toThrow(/enter the group's DN/);
      process.env.LDAP_GROUP_SEARCH_BASE = 'OU=Groups,DC=x';
      expect(ldap.groupName('CN=Data-Admins,OU=Groups,DC=x')).toBe('cn=data-admins,ou=groups,dc=x');
      expect(() => ldap.groupName('cn=editors,ou=teams,dc=x')).toThrow(/only finds groups under LDAP_GROUP_SEARCH_BASE/);
      // An escaped comma keeps "ou=groups" inside the group's own name, so its parent is dc=x
      expect(() => ldap.groupName('cn=a\\,ou=groups,dc=x')).toThrow(/only finds groups under LDAP_GROUP_SEARCH_BASE/);
      expect(ldap.groupName('cn=a\\\\,ou=groups,dc=x')).toBe('cn=a\\\\,ou=groups,dc=x');
      process.env.LDAP_GROUP_NAME_ATTRIBUTE = 'cn';
      process.env.LDAP_GROUP_SEARCH_BASE = 'ou=groups,dc=x';
      expect(ldap.groupName('Data-Admins')).toBe('Data-Admins');
      // A DN saved before switching to names can never match, so it's refused (and flagged at startup and in sync logs)
      expect(() => ldap.groupName('cn=science-team,ou=groups,dc=x')).toThrow(/enter just the group's cn/);
      expect(ldap.groupName('a=b')).toBe('a=b');
      expect(ldap.groupName(' science-team ')).toBe('science-team');
      expect(() => ldap.groupName('cn=science-team')).toThrow(/enter just the group's cn/);
      const savedProviders = process.env.AUTH_PROVIDERS;
      process.env.AUTH_PROVIDERS = '["ldap","local"]';
      try {
        const providers = require('../../../../../API/permissions/providers');
        expect(providers.groupNameProblem('ldap', 'cn=science-team,ou=groups,dc=x')).toMatch(/not their DN/);
        expect(providers.groupNameProblem('ldap', 'science-team')).toBeNull();
        // LDAP_GROUP_NAME_ATTRIBUTE=dn reports groups by DN, as when it's unset
        process.env.LDAP_GROUP_NAME_ATTRIBUTE = 'dn';
        expect(ldap.groupName('CN=Data-Admins,OU=Groups,DC=x')).toBe('cn=data-admins,ou=groups,dc=x');
        // A DN saved in another form (e.g. by an older MMGIS process) matches nobody, so it's flagged
        expect(providers.groupNameProblem('ldap', 'CN=Data-Admins,OU=Groups,DC=x')).toMatch(/reports it as cn=data-admins,ou=groups,dc=x/);
        expect(providers.groupNameProblem('ldap', 'cn=data-admins,ou=groups,dc=x')).toBeNull();
      } finally {
        if (savedProviders === undefined) delete process.env.AUTH_PROVIDERS;
        else process.env.AUTH_PROVIDERS = savedProviders;
      }
    } finally {
      for (const [k, v] of [['LDAP_GROUP_NAME_ATTRIBUTE', saved.a], ['LDAP_GROUP_SEARCH_BASE', saved.b]])
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
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
    expect(id).toEqual({ subject: 'e1', dn: expect.any(String), username: 'alice', email: 'alice@example.org', groups: ['cn=science-team,ou=groups,dc=example,dc=org', 'cn=ops\\, east,ou=groups,dc=example,dc=org'], groupsLeftOut: [] });
    expect(log).toEqual([`bind ${base.LDAP_BIND_DN}`, `search ${base.LDAP_USER_SEARCH_BASE} (uid=alice)`, `bind ${alice.dn}`, 'unbind']);
  });

  test('wrong passwords count per directory entry, whichever name reached it', async () => {
    const { entryFailures } = require('../plugin')._internal;
    entryFailures.clear();
    try {
      for (let i = 0; i < 5; i++) expect(await authenticate('alice', 'wrong', config(base), fakeClient([alice]))).toBeNull();
      // Refused like a wrong password, without trying it, so the lock doesn't show that alice exists
      let reason = '';
      const log = [];
      expect(await authenticate('alice', 'right', config(base), fakeClient([alice], log), (r) => (reason = r))).toBeNull();
      expect(reason).toMatch(/had 5 wrong passwords/);
      expect(log).not.toContain(`bind ${alice.dn}`);
      entryFailures.clear();
      expect(await authenticate('alice', 'right', config(base), fakeClient([alice]))).not.toBeNull();
    } finally {
      entryFailures.clear();
    }
  });

  test('allowing a relink clears that entry\'s wrong-password count', async () => {
    const plugin = require('../plugin');
    const { entryFailures } = plugin._internal;
    entryFailures.clear();
    try {
      for (let i = 0; i < 5; i++) await authenticate('alice', 'wrong', config(base), fakeClient([alice]));
      expect(await authenticate('alice', 'right', config(base), fakeClient([alice]))).toBeNull();
      plugin.resetFailures({ username: 'alice', dn: 'UID=alice,ou=people,dc=example,dc=org' });
      expect(await authenticate('alice', 'right', config(base), fakeClient([alice]))).not.toBeNull();
      // A UPN-style template counts under the filled template, not the entry DN a pinned relink names
      entryFailures.set('alice@corp.example.org', { count: 5, until: Date.now() + 60000 });
      const prev = process.env.LDAP_USER_DN_TEMPLATE;
      process.env.LDAP_USER_DN_TEMPLATE = '{{username}}@corp.example.org';
      try {
        plugin.resetFailures({ username: 'alice', dn: 'cn=Alice Smith,ou=people,dc=example,dc=org' });
      } finally {
        if (prev === undefined) delete process.env.LDAP_USER_DN_TEMPLATE;
        else process.env.LDAP_USER_DN_TEMPLATE = prev;
      }
      expect(entryFailures.has('alice@corp.example.org')).toBe(false);
    } finally {
      entryFailures.clear();
    }
  });

  test('direct bind: someone the user filter leaves out is refused, not told the directory is down', async () => {
    let reason = '';
    const c = config({ ...base, LDAP_USER_DN_TEMPLATE: 'uid={{username}},ou=people,dc=example,dc=org', LDAP_USER_SEARCH_FILTER: '(&(uid={{username}})(mail=*))' });
    expect(await authenticate('alice', 'right', c, fakeClient([alice]), (r) => (reason = r))).toBeNull();
    expect(reason).toMatch(/no entry under LDAP_USER_SEARCH_BASE matches .*password for uid=alice.* was accepted/);
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

  test('direct mode with a search base refuses when the search finds a different entry than the bound one', async () => {
    const mallory = { dn: 'cn=alice,ou=people,dc=example,dc=org', password: 'mallory', entry: { dn: 'cn=alice,ou=people,dc=example,dc=org', entryUUID: 'm1', uid: 'mallory' } }; // pragma: allowlist secret
    const env = { ...base, LDAP_USER_DN_TEMPLATE: 'cn={{username}},ou=people,dc=example,dc=org' };
    const why = [];
    expect(await authenticate('alice', 'mallory', config(env), fakeClient([alice, mallory]), (r) => why.push(r))).toBeNull();
    expect(why[0]).toMatch(/found a different entry/);
    const same = { ...base, LDAP_USER_DN_TEMPLATE: 'uid={{username}},ou=people,dc=example,dc=org' };
    expect((await authenticate('alice', 'right', config(same), fakeClient([alice]))).subject).toBe('e1');
    // A UPN template is matched by userPrincipalName
    const upn = { ...base, LDAP_USER_DN_TEMPLATE: '{{username}}@corp.example.org' };
    const binder = { dn: 'alice@corp.example.org', password: 'right', entry: {} }; // pragma: allowlist secret
    const withUpn = { ...alice, entry: { ...alice.entry, userPrincipalName: 'Alice@corp.example.org' } };
    expect((await authenticate('alice', 'right', config(upn), fakeClient([withUpn, binder]))).subject).toBe('e1');
    expect(await authenticate('alice', 'right', config(upn), fakeClient([alice, binder]))).toBeNull();
  });

  test('StartTLS runs before anything else is sent', async () => {
    const log = [];
    await authenticate('alice', 'right', config({ ...base, LDAP_URL: 'ldap://x', LDAP_STARTTLS: 'true' }), fakeClient([alice], log));
    expect(log[0]).toBe('starttls');
  });

  test('a rejected service account or missing subject attribute throws (the route answers 503)', async () => {
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_BIND_PASSWORD: 'nope' }), fakeClient([alice]))).rejects.toThrow(/LDAP_BIND_DN/); // pragma: allowlist secret
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'objectGUID' }), fakeClient([alice]))).rejects.toThrow(/objectGUID/);
    // That one entry can't be used; it's not reported as the directory being down
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'objectGUID' }), fakeClient([alice]))).rejects.toBeInstanceOf(ldap._internal.UnusableEntryError);
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

  test('concurrent logins send a wrong service password to the directory only once', async () => {
    const env = { ...base, LDAP_BIND_PASSWORD: 'wrong-for-burst-test' }; // pragma: allowlist secret
    const log = [];
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => authenticate('alice', 'right', config(env), fakeClient([alice], log))));
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(log.filter((l) => l === `bind ${base.LDAP_BIND_DN}`)).toHaveLength(1);
  });

  test('a service bind that times out fails the logins waiting on it instead of letting them all bind', async () => {
    const env = { ...base, LDAP_BIND_PASSWORD: 'timeout-then-wrong' }; // pragma: allowlist secret
    const log = [];
    let first = true;
    const flaky = () => {
      const c = fakeClient([alice], log)();
      return { ...c, async bind(dn, pw) {
        if (dn === base.LDAP_BIND_DN && first) { first = false; log.push(`bind ${dn}`); await new Promise((r) => setTimeout(r, 20)); throw new Error('timeout'); }
        return c.bind(dn, pw);
      } };
    };
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => authenticate('alice', 'right', config(env), flaky)));
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(log.filter((l) => l === `bind ${base.LDAP_BIND_DN}`)).toHaveLength(1);
  });

  test('concurrent logins with a working service password all go ahead', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => authenticate('alice', 'right', config(base), fakeClient([alice]))));
    expect(results.every((r) => r && r.subject)).toBe(true);
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
    expect(explain(Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' }))).toMatch(/renew/);
    expect(explain(new Error('Connection closed before message response was received. Message type: ExtendedRequest (0x77)'))).toMatch(/ldap:\/\/ at the plain port/);
    expect(ldap._internal.directoryRoot('ou=people,ou=staff,dc=example,dc=org')).toBe('dc=example,dc=org');
    expect(ldap._internal.directoryRoot('ou=people,o=corp')).toBe('ou=people,o=corp');
    expect(ldap._internal.directoryRoot('dc=example,dc=org')).toBe('dc=example,dc=org');
    expect(explain(new NoSuchObjectError('No such object'))).toMatch(/LDAP_USER_SEARCH_BASE/);
  });

  test('the startup check signs in the service account and finds the search bases, without anyone\'s password', async () => {
    const log = [];
    const checked = await selfCheck(config({ ...base, LDAP_USER_SEARCH_BASE: alice.dn }), fakeClient([alice], log));
    expect([...checked]).toEqual(['connected to ldaps://ldap.example.org', 'the service account signed in', 'LDAP_USER_SEARCH_BASE exists', 'the directory root dc=example,dc=org is readable']);
    expect(checked.warnings).toEqual([]);
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
    // Nothing could check that no other entry shares a person's value
    expect(problems({ LDAP_URL: 'ldaps://x:636', LDAP_USER_DN_TEMPLATE: 'uid={{username}},dc=x', LDAP_SUBJECT_ATTRIBUTE: 'mail' })).toMatch(/isn't a permanent entry ID, and without LDAP_USER_SEARCH_BASE/);
    expect(ldap.validate({ LDAP_URL: 'ldaps://x:636', LDAP_USER_DN_TEMPLATE: 'uid={{username}},dc=x', LDAP_SUBJECT_ATTRIBUTE: 'dn' })).toEqual([]);
  });

  test('passwords never cross the network unencrypted unless explicitly allowed', () => {
    expect(problems({ ...base, LDAP_URL: 'ldap://x' })).toMatch(/unencrypted/);
    expect(problems({ ...base, LDAP_URL: 'ldap://x', LDAP_ALLOW_INSECURE: 'true' })).toBe('');
    expect(ldap.warnings({ ...base, LDAP_URL: 'ldap://x', LDAP_ALLOW_INSECURE: 'true' }).join()).toMatch(/unencrypted/);
    expect(ldap.warnings({ ...base, LDAP_GROUP_NAME_ATTRIBUTE: 'cn' }).join()).toMatch(/no effect without LDAP_GROUP_SEARCH_BASE/);
    const templateOnly = { LDAP_URL: 'ldaps://x:636', LDAP_USER_DN_TEMPLATE: 'uid={{username}},dc=x' };
    expect(ldap.warnings({ ...templateOnly, LDAP_BIND_DN: 'cn=svc,dc=x', LDAP_BIND_PASSWORD: 'p' }).join()).toMatch(/without LDAP_USER_SEARCH_BASE/); // pragma: allowlist secret
    expect(ldap.warnings(templateOnly).join()).not.toMatch(/without LDAP_USER_SEARCH_BASE/);
    expect(problems({ ...templateOnly, LDAP_USER_DN_TEMPLATE: 'CORP\\{{username}}' })).toMatch(/can't be DOMAIN/);
    expect(ldap.warnings({ ...base, LDAP_GROUP_NAME_ATTRIBUTE: 'cn', LDAP_GROUP_SEARCH_BASE: 'ou=g' }).join()).not.toMatch(/no effect/);
    expect(problems({ ...base, LDAP_STARTTLS: 'true' })).toMatch(/already encrypted/);
  });

  test('a subject stored under another LDAP_SUBJECT_ATTRIBUTE is told apart', () => {
    const saved = process.env.LDAP_SUBJECT_ATTRIBUTE;
    try {
      delete process.env.LDAP_SUBJECT_ATTRIBUTE;
      expect(ldap.subjectFits('a5e38d5c-6c61-1041-92de-b7aaf50b266a')).toBe(true);
      expect(ldap.subjectFits('uid=ldap_alice,ou=people,dc=example,dc=org')).toBe(false);
      process.env.LDAP_SUBJECT_ATTRIBUTE = 'dn';
      expect(ldap.subjectFits('uid=ldap_alice,ou=people,dc=example,dc=org')).toBe(true);
      expect(ldap.subjectFits('a5e38d5c-6c61-1041-92de-b7aaf50b266a')).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.LDAP_SUBJECT_ATTRIBUTE;
      else process.env.LDAP_SUBJECT_ATTRIBUTE = saved;
    }
  });

  test('missing or malformed settings refuse startup', () => {
    expect(problems({})).toMatch(/LDAP_URL must be set/);
    expect(problems({ ...base, LDAP_URL: 'ldaps://dc1:636 ldaps://dc2:636' })).toMatch(/single ldap:\/\/ or ldaps:\/\/ URL/);
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

test.describe('Rechecking existing sessions and tokens', () => {
  const { lookup, subjectFilter, authenticate: auth } = ldap._internal;
  const byUuid = (entries) => () => ({
    async startTLS() {},
    async bind(dn, password) {
      if (dn !== base.LDAP_BIND_DN || password !== base.LDAP_BIND_PASSWORD) throw new InvalidCredentialsError('Invalid credentials');
    },
    async search(searchBase, opts) {
      const terms = [...opts.filter.matchAll(/\(([A-Za-z]+)=([^()]*)\)/g)];
      return { searchEntries: entries.filter((e) => terms.length && terms.every(([, a, v]) => (v === '*' ? e[a] != null : e[a] === v))) };
    },
    async unbind() {},
  });

  test('the subject filter finds the entry subjectOf read, including AD objectGUIDs', () => {
    const buf = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const escaped = Array.from(buf, (b) => '\\' + b.toString(16).padStart(2, '0')).join('');
    expect(subjectFilter(config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'objectGUID' }), guidString(buf))).toBe(`(objectGUID=${escaped})`);
    expect(subjectFilter(config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'entryUUID' }), 'a*)')).toBe('(entryUUID=a\\2a\\29)');
  });

  test('reports current groups, null once the entry is gone or disabled, undefined without a service account', async () => {
    const c = config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'entryUUID' });
    const found = await lookup('e1', c, byUuid([alice.entry]));
    expect(found.username).toBe('alice');
    expect(found.groups).toEqual((await auth('alice', 'right', c, fakeClient([alice]))).groups);
    expect(await lookup('gone', c, byUuid([alice.entry]))).toBeNull();
    // Someone LDAP_USER_SEARCH_FILTER no longer lets sign in is gone too
    // In extensible and ~= terms * is literal, so they're checked for presence instead
    const { peopleFilter } = require('../plugin')._internal;
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(uid:caseExactMatch:={{username}})(objectClass=person))' }))).toBe('(&(uid=*)(objectClass=person))');
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(uid~={{username}})' }))).toBe('(uid=*)');
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(|(uid={{username}})(mail={{username}}@example.org))' }))).toBe('(|(uid=*)(mail=*@example.org))');
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(sAMAccountName={{username}})(!(userAccountControl:1.2.840.113556.1.4.803:=2)))' }))).toBe('(&(sAMAccountName=*)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))');
    expect((await lookup('e1', config({ ...base, LDAP_USER_SEARCH_FILTER: '(uid:caseExactMatch:={{username}})' }), byUuid([alice.entry]))).username).toBe('alice');
    // Wildcards next to {{username}} stay one wildcard, and a negated {{username}} term excludes nobody
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(uid={{username}}*)(cn=*{{username}}*))' }))).toBe('(&(uid=*)(cn=*))');
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(uid={{username}})(!(description:={{username}})))' }))).toBe('(&(uid=*)(objectClass=*))');
    expect(peopleFilter(config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(uid={{username}})(!(ou=contractors)))' }))).toBe('(&(uid=*)(!(ou=contractors)))');
    const staffOnly = config({ ...base, LDAP_USER_SEARCH_FILTER: '(&(uid={{username}})(ou=staff))' });
    expect(await lookup('e1', staffOnly, byUuid([alice.entry]))).toBeNull();
    expect((await lookup('e1', staffOnly, byUuid([{ ...alice.entry, ou: 'staff' }]))).username).toBe('alice');
    expect(await lookup('e1', c, byUuid([{ ...alice.entry, userAccountControl: '514' }]))).toBeNull();
    expect(await lookup('e1', c, byUuid([{ ...alice.entry, pwdAccountLockedTime: '000001010000Z' }]))).toBeNull(); // pragma: allowlist secret
    // A ppolicy lockout after failed passwords ends by itself, so it doesn't count as disabled
    expect((await lookup('e1', c, byUuid([{ ...alice.entry, pwdAccountLockedTime: '20261104063000Z' }]))).username).toBe('alice'); // pragma: allowlist secret
    expect(await lookup('e1', c, byUuid([{ ...alice.entry, nsAccountLock: 'TRUE' }]))).toBeNull();
    // Active Directory accountExpires: 100 ns steps since 1601; 0 and 2^63-1 mean never
    const filetime = (ms) => String((ms + 11644473600000) * 10000);
    expect(await lookup('e1', c, byUuid([{ ...alice.entry, accountExpires: filetime(Date.now() - 60000) }]))).toBeNull();
    expect((await lookup('e1', c, byUuid([{ ...alice.entry, accountExpires: filetime(Date.now() + 60000) }]))).username).toBe('alice');
    expect((await lookup('e1', c, byUuid([{ ...alice.entry, accountExpires: '9223372036854775807' }]))).username).toBe('alice');
    expect(await lookup('e1', config({ ...base, LDAP_BIND_DN: '' }), byUuid([alice.entry]))).toBeUndefined();
  });
});

test.describe('Whether an old entry still exists (locate)', () => {
  const { locate } = ldap._internal;
  const client = (search) => () => ({ async bind() {}, search, async unbind() {} });
  const env = { ...base, LDAP_BIND_PASSWORD: 'locate-test' }; // pragma: allowlist secret

  test('a root the service account cannot search is unknown, not gone', async () => {
    const search = async () => { throw new NoSuchObjectError('No such object'); };
    await expect(locate('e1', config(env), client(search))).rejects.toBeInstanceOf(NoSuchObjectError);
    expect(await locate('uid=a,ou=people,dc=example,dc=org', config({ ...env, LDAP_SUBJECT_ATTRIBUTE: 'dn' }), client(search))).toBeNull();
  });

  test('after a switch to LDAP_SUBJECT_ATTRIBUTE=dn, a subject saved as an entryUUID names no entry', async () => {
    const { lookup } = ldap._internal;
    const dn = config({ ...env, LDAP_SUBJECT_ATTRIBUTE: 'dn' });
    let searched = 0;
    const search = async () => { searched++; throw new InvalidDNSyntaxError('invalid DN'); };
    expect(await locate('5fc958d8-1c2b-4f3a-9d1e-0123456789ab', dn, client(search))).toBeNull();
    expect(await lookup('5fc958d8-1c2b-4f3a-9d1e-0123456789ab', dn, client(search))).toBeNull();
    expect(searched).toBe(0);
    expect(await locate('uid=a,ou=people,dc=example,dc=org', dn, client(search))).toBeNull();
    expect(await lookup('uid=a,ou=people,dc=example,dc=org', dn, client(search))).toBeNull();
  });

  test('several entries with the subject still count as present', async () => {
    const two = async () => ({ searchEntries: [alice.entry, alice.entry] });
    expect(await locate('e1', config(env), client(two))).toMatchObject({ dn: alice.dn });
    const many = async () => { throw new SizeLimitExceededError('Size limit exceeded'); };
    expect(await locate('e1', config(env), client(many))).toBeTruthy();
    expect(await locate('e1', config(env), client(async () => ({ searchEntries: [] })))).toBeNull();
  });

  test('an expired service-account password is not reported as the person\'s', async () => {
    const svcExpired = () => ({
      async bind(dn) {
        if (dn === base.LDAP_BIND_DN)
          throw new InvalidCredentialsError('80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, data 532, v4563');
      },
      async search() { return { searchEntries: [alice.entry] }; },
      async unbind() {},
    });
    const err = await authenticate('alice', 'right', config({ ...base, LDAP_BIND_PASSWORD: 'svc-expired' }), svcExpired).catch((e) => e); // pragma: allowlist secret
    expect(err).not.toBeInstanceOf(PasswordExpiredError);
    expect(err.message).toMatch(/LDAP_BIND_DN's password has expired/);
  });

  test('without a dc= suffix the directory\'s naming context is searched, and unknown without one', async () => {
    const corp = { ...env, LDAP_USER_SEARCH_BASE: 'ou=people,o=corp' };
    const searched = [];
    const search = (contexts) => async (dn, opts) => {
      searched.push(dn);
      if (dn === '') return { searchEntries: [{ dn: '', namingContexts: contexts }] };
      return { searchEntries: [{ ...alice.entry, dn: 'uid=alice,ou=leavers,o=corp' }] };
    };
    expect(await locate('e1', config(corp), client(search(['o=other', 'o=corp'])))).toMatchObject({ dn: 'uid=alice,ou=leavers,o=corp' });
    expect(searched).toEqual(['', 'o=corp']);
    await expect(locate('e1', config(corp), client(search(['o=other'])))).rejects.toThrow(/naming context/);
  });

  test('a binary subject attribute MMGIS cannot search for again is refused, not signed out at every recheck', async () => {
    const photo = { ...alice, entry: { ...alice.entry, jpegPhoto: Buffer.from('9f8102ff', 'hex') } };
    await expect(authenticate('alice', 'right', config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'jpegPhoto' }), fakeClient([photo]))).rejects.toThrow(/holds binary values/);
  });

  test('the startup check warns when no person has the subject or username attribute', async () => {
    const fake = () => ({
      async bind() {},
      async search(dn, opts) {
        if (/entryUUUID=\*/.test(opts.filter)) return { searchEntries: [] };
        if (opts.sizeLimit === 1) throw new SizeLimitExceededError('Size limit exceeded');
        return { searchEntries: [{ dn }] };
      },
      async unbind() {},
    });
    const typo = await selfCheck(config({ ...base, LDAP_SUBJECT_ATTRIBUTE: 'entryUUUID' }), fake);
    expect(typo.warnings.join(' ')).toMatch(/has the attribute entryUUUID \(LDAP_SUBJECT_ATTRIBUTE\)/);
    expect((await selfCheck(config(base), fake)).warnings).toEqual([]);
  });

  test('an attribute that can change is warned about as the subject', () => {
    const permanent = (env) => ldap.warnings({ ...base, ...env }).filter((w) => /isn't a permanent entry ID/.test(w));
    expect(permanent({ LDAP_SUBJECT_ATTRIBUTE: 'uid' })).toHaveLength(1);
    expect(permanent({ LDAP_SUBJECT_ATTRIBUTE: 'sAMAccountName' })).toHaveLength(1);
    expect(permanent({})).toHaveLength(0);
    expect(permanent({ LDAP_SUBJECT_ATTRIBUTE: 'objectGUID' })).toHaveLength(0);
  });

  test('the startup check warns when the service account cannot read the directory root', async () => {
    const fake = () => ({
      async bind() {},
      async search(dn) {
        if (dn === 'dc=example,dc=org') throw new NoSuchObjectError('No such object');
        return { searchEntries: [{ dn }] };
      },
      async unbind() {},
    });
    const checked = await selfCheck(config({ ...base, LDAP_BIND_PASSWORD: 'root-test' }), fake); // pragma: allowlist secret
    expect(checked.warnings.join(' ')).toMatch(/can't search the directory root dc=example,dc=org/);
  });
});
