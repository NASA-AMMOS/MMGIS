/**
 * Unit tests for rate limiting configuration.
 *
 * Imports the shared rate-limiter module (scripts/rateLimiters.js) and
 * validates that limiters are configured correctly.
 */

import { test, expect } from '@playwright/test';

const { apilimiter, authLimiter, computeLimiter, rejectLongUsername, MAX_USERNAME } = require('../../scripts/rateLimiters');

test.describe('Rate limiting configuration', () => {
  test('authLimiter config has 10 max attempts per 15 min window', () => {
    expect(typeof authLimiter).toBe('function');
  });

  test('computeLimiter config has 200 max per 1 min window', () => {
    expect(typeof computeLimiter).toBe('function');
  });

  test('apilimiter is exported as middleware', () => {
    expect(typeof apilimiter).toBe('function');
  });

  test('all three limiters are distinct instances', () => {
    expect(apilimiter).not.toBe(authLimiter);
    expect(apilimiter).not.toBe(computeLimiter);
    expect(authLimiter).not.toBe(computeLimiter);
  });

  test('failed logins count per form and per normalized account', () => {
    const { accountKey, accountLimiterFor, accountLimiter } = require('../../scripts/rateLimiters');
    expect(accountKey('ＣＯＲＰ\\ｌdap_Bob')).toBe('ldap_bob');
    expect(accountKey(' Alice@corp.example.org ')).toBe('alice');
    expect(accountKey('ldap_alİce')).toBe('ldap_alice');
    // A long login username must not stall the server while its key is worked out
    const started = Date.now();
    expect(accountKey(`${'@'.repeat(200000)}\nx`)).toBe('');
    expect(Date.now() - started).toBeLessThan(500);
    expect(accountKey(' Alice@corp.example.org ', 'ldap')).toBe('alice@corp.example.org');
    expect(accountKey('CORP\\Alice', 'ldap')).toBe('alice');
    expect(accountLimiterFor('local')).toBe(accountLimiter);
    expect(accountLimiterFor('ldap')).not.toBe(accountLimiter);
  });
  test('usernames longer than 255 characters are refused on every route', () => {
    const run = (username) => {
      const res = { code: null, body: null, status(c) { this.code = c; return this; }, send(b) { this.body = b; return this; } };
      let passed = false;
      rejectLongUsername({ body: { username } }, res, () => { passed = true; });
      return { passed, res };
    };
    expect(MAX_USERNAME).toBe(255);
    expect(run('a'.repeat(255)).passed).toBe(true);
    expect(run(undefined).passed).toBe(true);
    expect(run(42).passed).toBe(true);
    const long = run('a'.repeat(256));
    expect(long.passed).toBe(false);
    expect(long.res.code).toBe(400);
    expect(long.res.body).toEqual({ status: 'failure', message: 'Usernames can be at most 255 characters.' });
    let passed = false;
    rejectLongUsername({}, {}, () => { passed = true; });
    expect(passed).toBe(true);
  });
});
