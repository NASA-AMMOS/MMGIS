/**
 * Unit tests for adjacent-servers/validateTitilerExpression.js — the band-math
 * token allowlist applied to TiTiler `expression` parameters.
 */

import { test, expect } from '@playwright/test';
const createTitilerExpressionValidator = require('../../adjacent-servers/validateTitilerExpression');
const { isSafeExpression, MAX_EXPRESSION_LENGTH } = createTitilerExpressionValidator;

function run(method, expression) {
  const req = { method, query: {}, body: {} };
  if (method === 'GET') req.query.expression = expression;
  else req.body.expression = expression;
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  createTitilerExpressionValidator()(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res };
}

test.describe('isSafeExpression', () => {
  test('accepts band math emitted by the MMGIS frontend and rio-tiler docs', () => {
    for (const expr of [
      'b1',
      'B1*2',
      'asset_b1',
      '(b1-b2)/(b1+b2)',
      'b1;b2;b3',
      'red / nir',
      'where(b1 > 0.5, 1, 0)',
      'sqrt(b1**2 + b2**2)',
      'b1 >= 10 & b2 != 3',
      '~(b1 == 0) | (b2 < 1e-3)',
      ' b1 * .5 % 2 ',
      'b1 - -1',
    ]) {
      expect(isSafeExpression(expr), expr).toBe(true);
    }
  });

  test('rejects string literals, brackets, attribute access and dunder names', () => {
    for (const expr of [
      '"abc"',
      "'abc'",
      'b1["x"]',
      'b1[0]',
      '{b1}',
      'b1.real',
      '().__class__',
      '__import__',
      'b1 + __builtins__',
      'a\\b',
      'b1 $ 2',
      'b1 # c',
      'b1 @ b2',
      'x = 1',
      'b1\u0000',
      'lambda: 1',
    ]) {
      expect(isSafeExpression(expr), expr).toBe(false);
    }
  });

  test('rejects builtin-like identifiers regardless of case', () => {
    for (const expr of ['eval(b1)', 'EVAL(b1)', 'exec(b1)', 'open(b1)', 'getattr(b1, b2)', 'import']) {
      expect(isSafeExpression(expr), expr).toBe(false);
    }
  });

  test('rejects non-strings, empty and oversized input', () => {
    expect(isSafeExpression(undefined)).toBe(false);
    expect(isSafeExpression(null)).toBe(false);
    expect(isSafeExpression(['b1'])).toBe(false);
    expect(isSafeExpression({ b: 1 })).toBe(false);
    expect(isSafeExpression('')).toBe(false);
    expect(isSafeExpression('b1+'.repeat(MAX_EXPRESSION_LENGTH))).toBe(false);
  });
});

test.describe('validateTitilerExpression middleware', () => {
  test('passes through when no expression is present', () => {
    expect(run('GET', undefined).nextCalled).toBe(true);
    expect(run('POST', undefined).nextCalled).toBe(true);
  });

  test('passes valid expressions from query and body', () => {
    expect(run('GET', '(b1-b2)/(b1+b2)').nextCalled).toBe(true);
    expect(run('POST', 'asset_b1*2').nextCalled).toBe(true);
  });

  test('returns 400 for invalid expressions from query and body', () => {
    for (const method of ['GET', 'POST']) {
      const { nextCalled, res } = run(method, '().__class__');
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.payload.error).toBe('Bad Request');
    }
  });

  test('returns 400 for repeated query parameters', () => {
    const { nextCalled, res } = run('GET', ['b1', 'b2']);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});
