/**
 * Unit tests for long-term token expiry parsing and secret redaction in logs.
 * Sources: plugins/core/backend/LongTermToken/routes/longtermtokens.js (expiryFrom),
 *          API/logger.js (redactSecrets)
 */

import { test, expect } from '@playwright/test';

const { expiryFrom } = require('../../plugins/core/backend/LongTermToken/routes/longtermtokens');
const { redactSecrets, cleanFields } = require('../../API/logger');

test.describe('Long-term token period', () => {
  test('never and omitted have no expiry', () => {
    expect(expiryFrom(null)).toBeNull();
    expect(expiryFrom(undefined)).toBeNull();
    expect(expiryFrom('never')).toBeNull();
  });

  test('whole milliseconds, as a string or number, expire that far ahead', () => {
    for (const period of ['86400000', 86400000]) {
      const before = Date.now();
      const at = expiryFrom(period).getTime();
      expect(at).toBeGreaterThanOrEqual(before + 86400000);
      expect(at).toBeLessThanOrEqual(Date.now() + 86400000);
    }
  });

  for (const period of ['1d', '12h', '1.5', '1e3', '-5', '0', '', ' 5', 'abc', '99999999999999999999']) {
    test(`rejects ${JSON.stringify(period)}`, () => {
      expect(() => expiryFrom(period)).toThrow("period must be 'never' or a positive number of milliseconds.");
    });
  }
});

test.describe('Log redaction', () => {
  const stringify = (v) => JSON.parse(JSON.stringify(v, redactSecrets));

  test('redacts passwords nested in error objects', () => {
    const err = {
      name: 'SequelizeValidationError',
      errors: [{ message: 'Validation isEmail on email failed', instance: { dataValues: { username: 'u', password: 'Passw0rd!x' } } }], // pragma: allowlist secret
    };
    const out = JSON.stringify(err, redactSecrets);
    expect(out).not.toContain('Passw0rd!x');
    expect(stringify(err).errors[0].instance.dataValues).toEqual({ username: 'u', password: '_redacted_' }); // pragma: allowlist secret
  });

  test('redacts token and password keys regardless of case', () => {
    expect(stringify({ Password: 'a', token: 'mmgis_x', retypePassword: 'b', keep: 'c' }))
      .toEqual({ Password: '_redacted_', token: '_redacted_', retypePassword: '_redacted_', keep: 'c' }); // pragma: allowlist secret
  });

  test('leaves null secrets and other fields alone', () => {
    expect(stringify({ password: null, user: 'u' })).toEqual({ password: null, user: 'u' });
  });
});

test('logged request bodies redact setup codes, tokens and passwords', () => {
  const out = cleanFields({ username: 'admin', password: 'p', setup_code: 'abc', token: 't', note: 'ok' }, 1000); // pragma: allowlist secret
  expect(out).toEqual({ username: 'admin', password: '_redacted_', setup_code: '_redacted_', token: '_redacted_', note: 'ok' }); // pragma: allowlist secret
});
