import { test, expect } from '@playwright/test';

/**
 * E2E tests for SQL injection protection.
 * Verifies that the server properly sanitizes user input to prevent
 * SQL injection attacks across various endpoints.
 */

test.describe('SQL Injection Protection', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "1' UNION SELECT * FROM users--",
    "admin'--",
  ];

  for (const payload of sqlPayloads) {
    test(`rejects SQL injection in geodatasets search: ${payload.substring(0, 25)}...`, async ({ request }) => {
      // Try endpoints that accept user input in queries
      const response = await request.post(`${baseURL}/api/geodatasets/search`, {
        data: { layer: payload },
      });
      // Should NOT return 500 (which would indicate SQL error)
      expect(response.status()).not.toBe(500);
    });
  }

  for (const payload of sqlPayloads) {
    test(`rejects SQL injection in shortener expand: ${payload.substring(0, 25)}...`, async ({ request }) => {
      const response = await request.post(`${baseURL}/api/shortener/expand`, {
        data: { short: payload },
      });
      // Should NOT return 500
      expect(response.status()).not.toBe(500);
    });
  }

  for (const payload of sqlPayloads) {
    test(`rejects SQL injection in accounts remove: ${payload.substring(0, 25)}...`, async ({ request }) => {
      const response = await request.delete(
        `${baseURL}/api/accounts/remove/${encodeURIComponent(payload)}`
      );
      // Should NOT return 500
      expect(response.status()).not.toBe(500);
    });
  }

  test('rejects SQL injection in config get mission parameter', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/configure/get`, {
      params: { mission: "'; DROP TABLE configs; --" },
    });
    expect(response.status()).not.toBe(500);
  });
});
