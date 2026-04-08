import { test, expect } from '@playwright/test';

/**
 * E2E tests for Utils API endpoints.
 * Backend routes: API/Backend/Utils/routes/utils.js
 *
 * Currently covers:
 *   - Time-directory listing (impacted by path traversal fix on urlSplit[0])
 *
 * Future tests can cover:
 *   - GET /api/utils/healthcheck
 *   - GET /api/utils/getmissions
 *   - GET /api/utils/getmission
 *   - GET /api/utils/getmissionconfig
 */

test.describe('Utils API', () => {

  test.describe('Time-directory listing (path with _time_)', () => {

    test('rejects path traversal in time-directory URL', async ({ request }) => {
      // Attempt path traversal via the _time_ split path
      const response = await request.get('/api/utils/queryTilesetTimes', {
        params: {
          path: '/Missions/../../etc/passwd_time_/{z}/{x}/{y}.png',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      // Should be rejected, not serve filesystem contents
      const body = await response.json();
      expect(body.status).toBe('failure');
    });

    test('rejects URL-encoded path traversal', async ({ request }) => {
      const response = await request.get('/api/utils/queryTilesetTimes', {
        params: {
          path: '/Missions/%2e%2e/%2e%2e/etc/shadow_time_/{z}/{x}/{y}.png',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      const body = await response.json();
      expect(body.status).toBe('failure');
    });

    test('valid mission path does not return 500', async ({ request }) => {
      // A legitimate path (even if the directory doesn't exist) should not crash
      const response = await request.get('/api/utils/queryTilesetTimes', {
        params: {
          path: '/Missions/Reference-Mission/Layers/tiles_time_/{z}/{x}/{y}.png',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

});
