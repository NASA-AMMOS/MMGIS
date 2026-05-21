/**
 * Unit tests for Fix 1: Type coercion in geodatasets.js
 *
 * Validates that query parameters (starttime, endtime, format) are type-checked
 * to prevent SQL injection bypass via array coercion (e.g. ?starttime=a&starttime=b).
 */

import { test, expect } from '@playwright/test';

/**
 * Simulates the fixed validation logic from geodatasets.js.
 * Returns { valid: true, starttime, endtime, format } on success,
 * or { valid: false, message } on failure.
 */
function validateTimeParams(query) {
  const starttime = typeof query?.starttime === 'string' ? query.starttime : null;
  const endtime = typeof query?.endtime === 'string' ? query.endtime : null;
  const format = typeof query?.format === 'string' ? query.format : "YYYY-MM-DDTHH:MI:SSZ";

  if (
    starttime == null ||
    starttime.indexOf("'") != -1 ||
    endtime == null ||
    endtime.indexOf("'") != -1 ||
    format.indexOf("'") != -1
  ) {
    return { valid: false, message: "Missing or malformed time parameters." };
  }

  return { valid: true, starttime, endtime, format };
}

test.describe('Fix 1: Geodatasets type coercion', () => {
  test('rejects array starttime (simulating ?starttime=a&starttime=b)', () => {
    const result = validateTimeParams({
      starttime: ['2024-01-01', '2024-02-01'],
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(false);
  });

  test('rejects array endtime', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
      endtime: ['2024-12-31', '2025-01-01'],
    });
    expect(result.valid).toBe(false);
  });

  test('array format defaults to safe string (not rejected)', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
      endtime: '2024-12-31',
      format: ['YYYY', 'MM'],
    });
    // Array format is coerced to the safe default, so params are valid
    expect(result.valid).toBe(true);
    expect(result.format).toBe('YYYY-MM-DDTHH:MI:SSZ');
  });

  test('valid string parameters work correctly', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01T00:00:00Z',
      endtime: '2024-12-31T23:59:59Z',
      format: 'YYYY-MM-DDTHH:MI:SSZ',
    });
    expect(result.valid).toBe(true);
    expect(result.starttime).toBe('2024-01-01T00:00:00Z');
    expect(result.endtime).toBe('2024-12-31T23:59:59Z');
  });

  test('strings containing single quotes are rejected', () => {
    const result = validateTimeParams({
      starttime: "2024-01-01'; DROP TABLE--",
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(false);
  });

  test('single quote in endtime is rejected', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
      endtime: "' OR 1=1--",
    });
    expect(result.valid).toBe(false);
  });

  test('single quote in format is rejected', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
      endtime: '2024-12-31',
      format: "YYYY'; --",
    });
    expect(result.valid).toBe(false);
  });

  test('default format is used when format is not provided', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(true);
    expect(result.format).toBe('YYYY-MM-DDTHH:MI:SSZ');
  });

  test('null starttime is rejected', () => {
    const result = validateTimeParams({
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(false);
  });

  test('null endtime is rejected', () => {
    const result = validateTimeParams({
      starttime: '2024-01-01',
    });
    expect(result.valid).toBe(false);
  });

  test('numeric starttime is rejected (must be string)', () => {
    const result = validateTimeParams({
      starttime: 12345,
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(false);
  });

  test('object starttime is rejected', () => {
    const result = validateTimeParams({
      starttime: { $gt: '' },
      endtime: '2024-12-31',
    });
    expect(result.valid).toBe(false);
  });
});
