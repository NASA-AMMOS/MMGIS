/**
 * Unit tests for SITE_ACCESS / AUTH_PROVIDERS validation.
 * Source: API/permissions/siteAccess.js
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const siteAccess = require(path.resolve(__dirname, '../../API/permissions/siteAccess.js'));

function withEnv(env, fn) {
  const keys = ['SITE_ACCESS', 'AUTH_PROVIDERS', 'AUTH_LOCAL_LOGIN', 'AUTH_LOCAL_ALLOW_SIGNUP'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  for (const k of Object.keys(env)) if (env[k] === undefined) delete process.env[k];
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test.describe('SITE_ACCESS validation', () => {
  for (const value of ['public', 'optional', 'required'])
    test(`accepts SITE_ACCESS=${value}`, () => {
      expect(siteAccess.validate({ SITE_ACCESS: value })).toEqual([]);
      expect(siteAccess.validate({ SITE_ACCESS: value, AUTH_PROVIDERS: '["local","proxy"]', PROXY_TRUST: 'network' })).toEqual([]);
    });

  test('requires SITE_ACCESS (no default)', () => {
    const errors = siteAccess.validate({});
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/SITE_ACCESS must be set to one of/);
  });

  for (const bad of ['', 'off', 'none', 'local', 'proxy', 'PUBLIC', 'true'])
    test(`rejects SITE_ACCESS=${JSON.stringify(bad)}`, () => {
      expect(siteAccess.validate({ SITE_ACCESS: bad }).join('\n')).toMatch(/SITE_ACCESS must be set to one of/);
    });

  const legacy = {
    off: ['public', '["local"]'],
    none: ['optional', '["local"]'],
    local: ['required', '["local"]'],
    csso: ['required', '["proxy","local"]'],
  };
  for (const [auth, [access, providers]] of Object.entries(legacy))
    test(`legacy AUTH=${auth} fails with its exact replacement`, () => {
      const errors = siteAccess.validate({ AUTH: auth });
      expect(errors[0]).toContain(`'AUTH=${auth}'`);
      expect(errors[0]).toContain(`SITE_ACCESS=${access}`);
      expect(errors[0]).toContain(`AUTH_PROVIDERS=${providers}`);
      // Still fails even if the new ENVs are also set
      expect(siteAccess.validate({ AUTH: auth, SITE_ACCESS: access })).toHaveLength(1);
    });

  test('legacy AUTH=csso also names the proxy trust setting', () => {
    expect(siteAccess.validate({ AUTH: 'csso' })[0]).toContain('PROXY_TRUST=network (or PROXY_SECRET)');
  });

  for (const [from, to] of [['CSSO_GROUPS', 'PROXY_GROUPS'], ['CSSO_LEAD_GROUP', 'PROXY_LEAD_GROUP'], ['CSSO_PROXY_SECRET', 'PROXY_SECRET']])
    test(`${from} is refused with its new name`, () => {
      const errors = siteAccess.validate({ SITE_ACCESS: 'required', [from]: 'x' });
      expect(errors).toEqual([`${from} has been renamed. Use ${to} instead.`]);
      expect(errors.join()).not.toContain("'x'");
      expect(siteAccess.validate({ SITE_ACCESS: 'required', [from]: '' })).toEqual([]);
    });

  test('an unknown legacy AUTH value still fails', () => {
    expect(siteAccess.validate({ AUTH: 'weird', SITE_ACCESS: 'public' })[0]).toMatch(/AUTH ENV has been removed/);
  });

  test('an empty AUTH is ignored', () => {
    expect(siteAccess.validate({ AUTH: '', SITE_ACCESS: 'public' })).toEqual([]);
  });
});

test.describe('AUTH_PROVIDERS parsing', () => {
  test('defaults to local', () => {
    expect(siteAccess.parseProviders(undefined)).toEqual(['local']);
    expect(siteAccess.parseProviders('')).toEqual(['local']);
  });

  test('accepts JSON arrays, JSON strings and comma lists, deduplicated and lowercased', () => {
    expect(siteAccess.parseProviders('["local","proxy"]')).toEqual(['local', 'proxy']);
    expect(siteAccess.parseProviders('"proxy"')).toEqual(['proxy']);
    expect(siteAccess.parseProviders('local, Proxy,local')).toEqual(['local', 'proxy']);
  });

  test('rejects non-array JSON', () => {
    expect(siteAccess.parseProviders('{"a":1}')).toBeNull();
    expect(siteAccess.validate({ SITE_ACCESS: 'public', AUTH_PROVIDERS: '{"a":1}' }).join()).toMatch(/JSON array/);
    expect(siteAccess.validate({ SITE_ACCESS: 'public', AUTH_PROVIDERS: '[]' }).join()).toMatch(/JSON array/);
  });

  test('a provider without a plugin is unknown and points to the guide', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["ldap"]' }).join()).toMatch(/unknown provider 'ldap'.*contributing\/auth-providers/);
  });

  test('unknown providers are rejected', () => {
    expect(siteAccess.validate({ SITE_ACCESS: 'required', AUTH_PROVIDERS: 'oauth' }).join()).toMatch(/unknown provider 'oauth'\. Available/);
  });
});

test.describe('Site access helpers', () => {
  test('public', () =>
    withEnv({ SITE_ACCESS: 'public' }, () => {
      expect(siteAccess.isPublic()).toBe(true);
      expect(siteAccess.guestsAllowed()).toBe(true);
      expect(siteAccess.endUserLoginEnabled()).toBe(false);
    }));

  test('optional', () =>
    withEnv({ SITE_ACCESS: 'optional' }, () => {
      expect(siteAccess.isOptional()).toBe(true);
      expect(siteAccess.guestsAllowed()).toBe(true);
      expect(siteAccess.endUserLoginEnabled()).toBe(true);
    }));

  test('required', () =>
    withEnv({ SITE_ACCESS: 'required', AUTH_PROVIDERS: '["proxy"]' }, () => {
      expect(siteAccess.isRequired()).toBe(true);
      expect(siteAccess.guestsAllowed()).toBe(false);
      expect(siteAccess.hasProvider('proxy')).toBe(true);
      expect(siteAccess.hasProvider('local')).toBe(false);
    }));

  test('an invalid value at runtime is treated as the most restrictive mode', () =>
    withEnv({ SITE_ACCESS: 'bogus' }, () => {
      expect(siteAccess.getSiteAccess()).toBe('required');
      expect(siteAccess.guestsAllowed()).toBe(false);
    }));
});

test.describe('AUTH_LOCAL_LOGIN', () => {
  const base = { SITE_ACCESS: 'required', AUTH_PROVIDERS: '["local"]' };
  test('accepts all, admins or unset', () => {
    for (const v of [undefined, '', 'all', 'admins'])
      expect(siteAccess.validate({ ...base, AUTH_LOCAL_LOGIN: v }).filter((e) => /AUTH_LOCAL_LOGIN/.test(e))).toEqual([]);
  });
  test('rejects anything else', () => {
    expect(siteAccess.validate({ ...base, AUTH_LOCAL_LOGIN: 'everyone' }).some((e) => /AUTH_LOCAL_LOGIN/.test(e))).toBe(true);
  });
});

test.describe('Self sign-up', () => {
  const cases = [
    [{ SITE_ACCESS: 'optional', AUTH_PROVIDERS: 'local' }, true],
    [{ SITE_ACCESS: 'optional', AUTH_PROVIDERS: 'local', AUTH_LOCAL_LOGIN: 'admins' }, false],
    [{ SITE_ACCESS: 'required', AUTH_PROVIDERS: 'local' }, false],
    [{ SITE_ACCESS: 'required', AUTH_PROVIDERS: 'local', AUTH_LOCAL_ALLOW_SIGNUP: 'true' }, true],
    [{ SITE_ACCESS: 'required', AUTH_PROVIDERS: 'proxy,local', AUTH_LOCAL_ALLOW_SIGNUP: 'true', AUTH_LOCAL_LOGIN: 'admins' }, false],
    [{ SITE_ACCESS: 'optional', AUTH_PROVIDERS: 'proxy' }, false],
    [{ SITE_ACCESS: 'public', AUTH_PROVIDERS: 'local' }, false],
  ];
  for (const [env, expected] of cases)
    test(`${JSON.stringify(env)} -> ${expected}`, () => {
      const full = { AUTH_LOCAL_LOGIN: undefined, AUTH_LOCAL_ALLOW_SIGNUP: undefined, ...env };
      withEnv(full, () => expect(siteAccess.selfSignupAllowed()).toBe(expected));
    });
});
