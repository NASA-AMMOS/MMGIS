/**
 * Unit tests for adjacent-servers/validateTitilerUrl.js, the TITILER_ALLOWED_URL_PATTERNS check.
 */

import { test, expect } from '@playwright/test';
const createTitilerUrlValidator = require('../../adjacent-servers/validateTitilerUrl');

function validator(patterns) {
  const saved = process.env.TITILER_ALLOWED_URL_PATTERNS;
  process.env.TITILER_ALLOWED_URL_PATTERNS = JSON.stringify(patterns);
  try {
    return createTitilerUrlValidator();
  } finally {
    if (saved == null) delete process.env.TITILER_ALLOWED_URL_PATTERNS;
    else process.env.TITILER_ALLOWED_URL_PATTERNS = saved;
  }
}

function call(validate, req) {
  const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  let nextCalled = false;
  validate({ query: {}, body: {}, ...req }, res, () => (nextCalled = true));
  return { nextCalled, status: res.statusCode };
}

const ALLOWED = 'https://data.example.org/a.tif';
const BLOCKED = 'http://169.254.169.254/latest/meta-data';

test.describe('validateTitilerUrl', () => {
  const validate = validator(['^https://data\\.example\\.org/']);

  test('GET checks the query string', () => {
    expect(call(validate, { method: 'GET', query: { url: ALLOWED } }).nextCalled).toBe(true);
    expect(call(validate, { method: 'GET', query: { url: BLOCKED } }).status).toBe(403);
  });

  test('other methods check both the query string and the body', () => {
    for (const method of ['POST', 'PUT']) {
      expect(call(validate, { method, query: { url: BLOCKED } }).status).toBe(403);
      expect(call(validate, { method, body: { url: BLOCKED } }).status).toBe(403);
      expect(call(validate, { method, query: { url: ALLOWED }, body: { url: BLOCKED } }).status).toBe(403);
      expect(call(validate, { method, query: { url: ALLOWED }, body: { url: ALLOWED } }).nextCalled).toBe(true);
    }
  });

  test('repeated url parameters are refused', () => {
    expect(call(validate, { method: 'GET', query: { url: [ALLOWED, BLOCKED] } }).status).toBe(403);
    expect(call(validate, { method: 'GET', query: { url: [ALLOWED, ALLOWED] } }).status).toBe(403);
  });

  test('requests without a url pass through', () => {
    expect(call(validate, { method: 'POST' }).nextCalled).toBe(true);
  });

  test('unset, empty or invalid patterns only allow local Missions paths', () => {
    const saved = process.env.TITILER_ALLOWED_URL_PATTERNS;
    delete process.env.TITILER_ALLOWED_URL_PATTERNS;
    const unset = createTitilerUrlValidator();
    if (saved != null) process.env.TITILER_ALLOWED_URL_PATTERNS = saved;
    for (const validate of [unset, validator([]), validator(['(']), validator([42])]) {
      expect(call(validate, { method: 'GET', query: { url: BLOCKED } }).status).toBe(403);
      expect(call(validate, { method: 'POST', body: { url: BLOCKED } }).status).toBe(403);
      expect(call(validate, { method: 'GET', query: { url: ALLOWED } }).status).toBe(403);
      expect(call(validate, { method: 'GET', query: { url: '/Missions/../etc/passwd' } }).status).toBe(403);
      expect(call(validate, { method: 'GET', query: { url: '/Missions/Test/a.tif' } }).nextCalled).toBe(true);
      expect(call(validate, { method: 'GET', query: { url: '../../Missions/Test/a.tif' } }).nextCalled).toBe(true);
      expect(call(validate, { method: 'GET' }).nextCalled).toBe(true);
    }
  });

  test('allowing every URL needs an explicit pattern', () => {
    expect(call(validator(['.*']), { method: 'GET', query: { url: ALLOWED } }).nextCalled).toBe(true);
  });
});
