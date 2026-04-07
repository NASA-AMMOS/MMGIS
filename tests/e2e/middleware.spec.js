import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Missions static-file middleware.
 * Backend: scripts/middleware.js
 *
 * Currently covers:
 *   - Path traversal prevention in composite tile serving (onlyExistingFilepaths)
 *   - Path traversal prevention in missions middleware (isPathInsideRoot)
 *
 * Future tests can cover:
 *   - Composite tile image generation
 *   - Time-based tile directory resolution (getTimePath)
 *   - Single vs composite tile serving
 */

test.describe('Missions Middleware', () => {

  test.describe('Path traversal prevention', () => {

    test('blocks path traversal via ../  in tile URL', async ({ request }) => {
      const response = await request.get('/Missions/../../etc/passwd');
      expect(response.status()).toBe(404);
    });

    test('blocks path traversal via encoded sequences', async ({ request }) => {
      const response = await request.get('/Missions/%2e%2e/%2e%2e/etc/shadow');
      expect(response.status()).toBe(404);
    });

    test('blocks path traversal in _time_ composite tile URL', async ({ request }) => {
      const response = await request.get(
        '/Missions/../../etc/passwd_time_/0/0/0.png?time=2024-01-01T00:00:00Z&composite=true'
      );
      expect(response.status()).toBe(404);
    });

    test('legitimate mission tile path does not return 500', async ({ request }) => {
      // Even if the tile doesn't exist, should be 404 not 500
      const response = await request.get('/Missions/Reference-Mission/Layers/Tiles/basemap/0/0/0.png');
      expect([200, 304, 404]).toContain(response.status());
    });

  });

});
