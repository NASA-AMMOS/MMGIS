import { test, expect } from '@playwright/test';

/**
 * E2E tests for STAC API endpoints.
 * Backend routes: API/Backend/Stac/routes/stac.js
 * Route prefix: /api/stac (requires admin via ensureAdmin middleware)
 *
 * Endpoints:
 *   - GET /api/stac/collections
 *   - GET /api/stac/collections/:collection/export
 *
 * Note: These routes require a running STAC server (stac-fastapi).
 * The adjacent proxy route /stac also requires WITH_STAC=true.
 */

test.describe('STAC API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('STAC API routes return 404 when WITH_STAC is not enabled', async ({ request }) => {
    // When WITH_STAC is not set (default CI), the /stac proxy route should return 404
    // Only skip if STAC is actually enabled
    if (process.env.WITH_STAC === 'true') {
      test.skip(true, 'SKIP: Full STAC tests need WITH_STAC=true with a running STAC server');
    }

    const response = await request.get(`${baseURL}/stac`);
    // When proxy is disabled, expect non-200 (could be 404 or 504 gateway timeout)
    expect(response.ok()).toBeFalsy();
  });

  test('/api/stac/collections does not return 500', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/stac/collections`);
    // Without a STAC server, this could be 404 (no route) or other error
    // but should never be 500
    expect(response.status()).not.toBe(500);
  });

  test('/api/stac/collections/:collection/export handles missing collection', async ({ request }) => {
    const response = await request.get(
      `${baseURL}/api/stac/collections/nonexistent_collection_${Date.now()}/export`
    );
    // Should not crash with 500 for a non-existent collection
    expect(response.status()).not.toBe(500);
  });
});
