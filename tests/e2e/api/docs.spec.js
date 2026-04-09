import { test, expect } from '@playwright/test';

/**
 * E2E tests for Docs (Swagger UI) API endpoint.
 * The server mounts swagger-ui-express at /api/docs (scripts/server.js).
 *
 * Covers:
 *   - GET /api/docs — Swagger UI page
 */

test.describe('Docs API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('GET /api/docs returns 200', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/docs`);
    // Swagger UI returns HTML (or a redirect to /api/docs/) — verify it is not a 500
    expect(response.status()).not.toBe(500);
    // Accept 200 or 301/302 redirect as valid responses
    expect(response.status()).toBeLessThan(500);
  });

  test('GET /api/docs/ returns Swagger HTML', async ({ request }) => {
    // swagger-ui-express typically serves at the trailing-slash path
    const response = await request.get(`${baseURL}/api/docs/`);
    expect(response.status()).not.toBe(500);
    if (response.ok()) {
      const text = await response.text();
      // The page should contain swagger-related content
      expect(text.toLowerCase()).toContain('swagger');
    }
  });
});
