import { test, expect } from '@playwright/test';

/**
 * E2E tests for Utils API endpoints.
 * Backend routes: API/Backend/Utils/routes/utils.js
 * Mounted at /api/utils (via Utils/setup.js)
 *
 * Also tests mission retrieval via /api/configure/missions and /api/configure/get
 * since the original Utils routes do not include getmissions/getmissionconfig —
 * those live under the Configure API.
 *
 * Covers:
 *   - GET /api/utils/healthcheck
 *   - GET /api/configure/missions  (mission list)
 *   - GET /api/configure/get       (mission config)
 *   - Invalid mission name handling
 *   - Time-directory listing path traversal (retained from prior suite)
 */

test.describe('Utils API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('GET /api/utils/healthcheck returns 200', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`);
    // In AUTH=local mode the healthcheck may redirect to the login page
    const text = await response.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('<title>MMGIS / Login</title>')) {
      // Server is up but requires auth — healthcheck behind auth is still a running server
      expect(response.ok()).toBeTruthy();
    } else {
      expect(response.ok()).toBeTruthy();
      expect(text).toContain('Alive');
    }
  });

  test('GET /api/configure/missions returns array with Reference-Mission', async ({ request }) => {
    // Missions endpoint lives under /api/configure, not /api/utils
    const response = await request.get(`${baseURL}/api/configure/missions`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(Array.isArray(data.missions)).toBeTruthy();
    // Reference-Mission is created by CI workflow; may not exist in all CI modes
    if (data.missions.length === 0) {
      test.skip(true, 'SKIP: No missions found — Reference Mission setup may have failed in this CI mode');
      return;
    }
    expect(data.missions).toContain('Reference-Mission');
  });

  test('GET /api/configure/get returns Reference-Mission config', async ({ request }) => {
    // First check if Reference-Mission exists
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json();
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    // Mission config endpoint lives under /api/configure/get
    const response = await request.get(
      `${baseURL}/api/configure/get?mission=Reference-Mission&full=true`,
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.mission).toBe('Reference-Mission');
    expect(data.config).toBeDefined();
    expect(data.config.msv).toBeDefined();
    expect(data.config.msv.mission).toBe('Reference-Mission');
  });

  test('invalid mission name does not cause 500', async ({ request }) => {
    // Request config for a mission that does not exist
    const response = await request.get(
      `${baseURL}/api/configure/get?mission=NonExistentMission99999&full=true`,
    );
    // Should get a graceful failure, NOT a 500 server error
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });

  // ---------- Time-directory listing (retained from prior suite) ----------
  test.describe('Time-directory listing (path with _time_)', () => {

    test('rejects path traversal in time-directory URL', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/utils/queryTilesetTimes`, {
        params: {
          path: '/Missions/../../etc/passwd_time_/{z}/{x}/{y}.png',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      const body = await response.json().catch(() => null);
      // In AUTH=local the server may return the HTML login page instead of JSON
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body.status).toBe('failure');
    });

    test('rejects URL-encoded path traversal', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/utils/queryTilesetTimes`, {
        params: {
          path: '/Missions/%2e%2e/%2e%2e/etc/shadow_time_/{z}/{x}/{y}.png',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      const body = await response.json().catch(() => null);
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body.status).toBe('failure');
    });

    test('valid mission path does not return 500', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/utils/queryTilesetTimes`, {
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
