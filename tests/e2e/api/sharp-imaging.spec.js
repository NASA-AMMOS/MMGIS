import { test, expect } from '@playwright/test';

/**
 * E2E tests for sharp image processing middleware.
 *
 * Validates that the server-side tile compositing and image pipeline
 * (scripts/middleware.js) works correctly with the installed sharp version.
 * Sharp is loaded at require-time, so a broken import crashes the server.
 */

test.describe('Sharp — tile compositing middleware', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('GET /Missions tile path — server does not crash on sharp import', async ({ request }) => {
    const response = await request.get(
      `${baseURL}/Missions/Reference-Mission/Layers/0/0/0.png`,
      { failOnStatusCode: false }
    );
    // 200 (found), 404 (tile missing), or 304 are all acceptable.
    // 500 would indicate a sharp breakage.
    expect(response.status()).not.toBe(500);
  });

  test('server healthcheck still passes (sharp loaded at require time)', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`);
    expect(response.status()).toBe(200);
  });
});
