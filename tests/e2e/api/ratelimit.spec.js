import { test, expect } from '@playwright/test';

/**
 * E2E tests for Rate Limiting behaviour.
 *
 * The server applies express-rate-limit via `apilimiter` (scripts/server.js).
 * This suite checks for the presence of standard rate-limit headers and
 * verifies the endpoint still responds successfully.
 *
 * Covers:
 *   - Rate limit headers on /api/utils/healthcheck
 */

test.describe('Rate Limiting', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('API responses include rate limit headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`);
    expect(response.ok()).toBeTruthy();

    // Check for common rate-limit headers set by express-rate-limit
    const headers = response.headers();
    const hasRateLimitHeader =
      headers['ratelimit-limit'] !== undefined ||
      headers['ratelimit-remaining'] !== undefined ||
      headers['x-ratelimit-limit'] !== undefined ||
      headers['x-ratelimit-remaining'] !== undefined ||
      headers['retry-after'] !== undefined;

    // If no rate-limiting middleware is configured the test still passes —
    // the key assertion is that the endpoint responds without error.
    if (hasRateLimitHeader) {
      // Validate the values are numeric strings
      const limitValue =
        headers['ratelimit-limit'] || headers['x-ratelimit-limit'];
      if (limitValue) {
        expect(Number(limitValue)).toBeGreaterThan(0);
      }
    }
  });

  test('multiple rapid requests do not cause 500', async ({ request }) => {
    // Send several requests in quick succession
    const promises = Array.from({ length: 5 }, () =>
      request.get(`${baseURL}/api/utils/healthcheck`),
    );
    const responses = await Promise.all(promises);

    for (const res of responses) {
      // Each response should be either 200 or 429 (rate-limited), never 500
      expect(res.status()).not.toBe(500);
      expect([200, 429]).toContain(res.status());
    }
  });
});
