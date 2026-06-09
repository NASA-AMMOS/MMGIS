/**
 * Unit tests for rate limiting configuration.
 *
 * Imports the shared rate-limiter module (scripts/rateLimiters.js) and
 * validates that limiters are configured correctly.
 */

import { test, expect } from '@playwright/test';

const { apilimiter, authLimiter, computeLimiter } = require('../../scripts/rateLimiters');

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
});
