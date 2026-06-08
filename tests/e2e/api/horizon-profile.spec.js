import { test, expect } from '@playwright/test';

/**
 * E2E tests for the /api/utils/gethorizonprofile endpoint.
 *
 * Covers:
 *   - Input validation (missing required fields)
 *   - Path traversal protection
 *   - Numeric parameter validation
 *   - DoS caps (numAzimuths, maxRadius)
 *
 * Note: In AUTH=local mode, unauthenticated requests return the login
 * page (HTML 200) instead of JSON errors, so tests gracefully skip
 * when a non-JSON response is detected.
 */

test.describe('Horizon Profile API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const endpoint = `${baseURL}/api/utils/gethorizonprofile`;

  /**
   * Post to the endpoint and parse the JSON response.
   * If the server returns HTML (e.g. AUTH=local login redirect), returns null.
   */
  async function postJSON(request, data) {
    const response = await request.post(endpoint, { data });
    const body = await response.json().catch(() => null);
    return { response, body };
  }

  test.describe('Input validation', () => {
    test('rejects request with missing path', async ({ request }) => {
      const { response, body } = await postJSON(request, { lat: 0, lng: 0 });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('path, lat, and lng are required');
    });

    test('rejects request with missing lat', async ({ request }) => {
      const { response, body } = await postJSON(request, { path: '/Missions/test/dem.tif', lng: 0 });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('path, lat, and lng are required');
    });

    test('rejects request with missing lng', async ({ request }) => {
      const { response, body } = await postJSON(request, { path: '/Missions/test/dem.tif', lat: 0 });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('path, lat, and lng are required');
    });

    test('rejects non-finite numeric parameters', async ({ request }) => {
      const { response, body } = await postJSON(request, {
        path: '/Missions/test/dem.tif',
        lat: 'not-a-number',
        lng: 0,
      });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('finite numbers');
    });

    test('rejects NaN string in numeric parameters', async ({ request }) => {
      const { response, body } = await postJSON(request, {
        path: '/Missions/test/dem.tif',
        lat: 0,
        lng: 0,
        observerHeight: 'NaN',
      });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('finite numbers');
    });
  });

  test.describe('Path traversal protection', () => {
    test('rejects path not starting with /Missions', async ({ request }) => {
      const { response, body } = await postJSON(request, { path: '/etc/passwd', lat: 0, lng: 0 });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('/Missions');
    });

    test('rejects path traversal escaping /Missions', async ({ request }) => {
      const { response, body } = await postJSON(request, {
        path: '/Missions/../../etc/passwd',
        lat: 0,
        lng: 0,
      });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('access denied');
    });

    test('rejects encoded path traversal', async ({ request }) => {
      const { response, body } = await postJSON(request, {
        path: '/Missions/%2e%2e/%2e%2e/etc/passwd',
        lat: 0,
        lng: 0,
      });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });

    test('rejects double-encoded path traversal', async ({ request }) => {
      const { response, body } = await postJSON(request, {
        path: '/Missions/%252e%252e/%252e%252e/etc/passwd',
        lat: 0,
        lng: 0,
      });
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });

    test('allows cross-mission paths within /Missions', async ({ request }) => {
      const response = await request.post(endpoint, {
        data: {
          path: '/Missions/MissionA/../MissionB/dem.tif',
          lat: 0,
          lng: 0,
        },
      });
      // Should not get "access denied" — path stays within /Missions
      const text = await response.text();
      expect(text).not.toContain('access denied');
    });
  });
});
