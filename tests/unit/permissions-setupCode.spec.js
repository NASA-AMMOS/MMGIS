/**
 * Unit tests for the one-time setup code that gates the first account.
 * Source: API/permissions/setupCode.js
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const setupCode = require(path.resolve(__dirname, '../../API/permissions/setupCode.js'));

function captureLog(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines.join('\n');
}

function withSetupEnv(value, fn) {
  const saved = process.env.SETUP_CODE;
  if (value === undefined) delete process.env.SETUP_CODE;
  else process.env.SETUP_CODE = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.SETUP_CODE;
    else process.env.SETUP_CODE = saved;
  }
}

function issued() {
  const out = captureLog(() => setupCode.ensure());
  const m = out.match(/setup code:\s+([A-Z0-9-]+)/);
  return { out, code: m && m[1] };
}

test.describe('setup code', () => {
  test.beforeEach(() => setupCode.clear());
  test.afterAll(() => setupCode.clear());

  test('generated codes are 4x4 groups from an unambiguous alphabet and differ', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const c = setupCode.generate();
      expect(c).toMatch(/^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(200);
  });

  test('nothing is accepted before a code is issued', () => {
    expect(setupCode.isActive()).toBe(false);
    expect(setupCode.consume('ANYTHING')).toBe(false);
  });

  test('the printed code is accepted once, then consumed', () => {
    withSetupEnv(undefined, () => {
      const { code } = issued();
      expect(code).toBeTruthy();
      expect(setupCode.consume('WRONG-CODE-0000-0000')).toBe(false);
      expect(setupCode.consume('')).toBe(false);
      expect(setupCode.consume(undefined)).toBe(false);
      expect(setupCode.isActive()).toBe(true);
      expect(setupCode.consume(code)).toBe(true);
      expect(setupCode.isActive()).toBe(false);
      expect(setupCode.consume(code)).toBe(false);
    });
  });

  test('matching ignores case, spaces and dashes', () => {
    withSetupEnv(undefined, () => {
      const { code } = issued();
      expect(setupCode.consume(` ${code.toLowerCase().replace(/-/g, ' ')} `)).toBe(true);
    });
  });

  test('ensure keeps the active code and prints only once', () => {
    withSetupEnv(undefined, () => {
      const first = issued();
      const again = captureLog(() => expect(setupCode.ensure()).toBe(false));
      expect(again).toBe('');
      expect(setupCode.consume(first.code)).toBe(true);
    });
  });

  test('a new issue invalidates the previous code', () => {
    withSetupEnv(undefined, () => {
      const a = issued();
      setupCode.clear();
      const b = issued();
      expect(b.code).not.toBe(a.code);
      expect(setupCode.consume(a.code)).toBe(false);
      expect(setupCode.consume(b.code)).toBe(true);
    });
  });

  test('SETUP_CODE is used as the code and is never printed', () => {
    withSetupEnv('My-Deploy-Code-42', () => {
      const { out, code } = issued();
      expect(code).toBeNull();
      expect(out).toContain('SETUP_CODE');
      expect(out).not.toMatch(/deploy/i);
      expect(setupCode.consume('wrong')).toBe(false);
      expect(setupCode.consume('mydeploycode42')).toBe(true);
    });
  });

  test('a blank SETUP_CODE falls back to a generated code', () => {
    withSetupEnv('  - ', () => {
      const { code } = issued();
      expect(code).toBeTruthy();
      expect(setupCode.consume(code)).toBe(true);
    });
  });
});
