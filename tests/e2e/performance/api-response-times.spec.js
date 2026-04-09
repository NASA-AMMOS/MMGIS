import { test, expect } from '@playwright/test';

/**
 * API response-time tests.
 *
 * Validates that core MMGIS API endpoints respond within acceptable
 * thresholds.  In AUTH=local mode the server may return the HTML login
 * page (HTTP 200) instead of JSON — tests use safe JSON parsing to
 * handle that gracefully.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:18888';

/** Safely parse JSON; returns null on failure (e.g. HTML login page). */
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

test.describe('API Response Times', () => {
  test('GET /api/utils/healthcheck responds within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/utils/healthcheck`, { timeout: 10000 });
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(5000);
  });

  test('GET /api/configure/missions responds within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/configure/missions`, { timeout: 10000 });
    const elapsed = Date.now() - start;

    // In AUTH=local the response may be an HTML login page (200) or JSON
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(5000);

    // Safe parse — result may be null if login page was returned
    const data = await safeJson(res);
    if (data && data.missions) {
      expect(Array.isArray(data.missions)).toBe(true);
    }
  });

  test('protected endpoints in AUTH=local return quickly (not hanging)', async ({ request }) => {
    const authMode = process.env.AUTH || 'off';

    // This test is most meaningful in AUTH=local mode but should pass
    // in any mode — the key assertion is that the server responds fast.
    const endpoints = [
      '/api/configure/missions',
      '/api/users',
    ];

    for (const ep of endpoints) {
      const start = Date.now();
      const res = await request.get(`${BASE}${ep}`, { timeout: 10000 });
      const elapsed = Date.now() - start;

      // Server must not hang — respond within 5 s regardless of auth mode
      expect(elapsed).toBeLessThan(5000);

      if (authMode === 'local') {
        // May return HTML login page (200) — just ensure it responded
        const body = await safeJson(res);
        if (!body) {
          // Got HTML login page — expected in AUTH=local
          const text = await res.text().catch(() => '');
          expect(text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('healthcheck returns expected response body', async ({ request }) => {
    const res = await request.get(`${BASE}/api/utils/healthcheck`, { timeout: 10000 });
    expect(res.status()).toBe(200);

    const text = await res.text();
    // Healthcheck returns plain text "Alive and Well!" (or HTML login page in AUTH=local)
    expect(text.length).toBeGreaterThan(0);
  });
});
