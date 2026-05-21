/**
 * Unit tests for Fix 5: Log sanitization
 *
 * Tests that sanitizeForLog strips ANSI escape sequences and dangerous control
 * characters while preserving newlines, tabs, and carriage returns for
 * readable stack traces.
 */

import { test, expect } from '@playwright/test';

function sanitizeForLog(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\x1B\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
}

test.describe('Fix 5: Log sanitization', () => {
  test('normal message is unchanged', () => {
    expect(sanitizeForLog('normal message')).toBe('normal message');
  });

  test('newlines are preserved for stack traces', () => {
    expect(sanitizeForLog('line1\nline2')).toBe('line1\nline2');
  });

  test('carriage returns are preserved', () => {
    expect(sanitizeForLog('line1\rline2')).toBe('line1\rline2');
  });

  test('tabs are preserved for indentation', () => {
    expect(sanitizeForLog('col1\tcol2')).toBe('col1\tcol2');
  });

  test('ANSI escape sequences are stripped', () => {
    expect(sanitizeForLog('\x1B[31mred\x1B[0m')).toBe('red');
  });

  test('complex ANSI sequences are stripped', () => {
    expect(sanitizeForLog('\x1B[1;32mbold green\x1B[0m')).toBe('bold green');
  });

  test('null passthrough', () => {
    expect(sanitizeForLog(null)).toBe(null);
  });

  test('numeric passthrough', () => {
    expect(sanitizeForLog(123)).toBe(123);
  });

  test('undefined passthrough', () => {
    expect(sanitizeForLog(undefined)).toBe(undefined);
  });

  test('null bytes are replaced', () => {
    expect(sanitizeForLog('data\x00injected')).toBe('data injected');
  });

  test('mixed control chars and ANSI are handled, newlines preserved', () => {
    const input = '\x1B[31mERROR\x1B[0m\nDetails:\tsome\x00thing';
    const expected = 'ERROR\nDetails:\tsome thing';
    expect(sanitizeForLog(input)).toBe(expected);
  });
});
