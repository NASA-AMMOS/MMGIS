import { test, expect } from '@playwright/test';

/**
 * E2E tests for dependency upgrade verification.
 *
 * Exercises the code paths affected by:
 *   1. sequelize (database ORM — models, queries, migrations)
 *   2. sharp (image compositing in middleware)
 *   3. @turf/turf (geometry operations in Draw tool)
 *
 * These tests hit API endpoints and pages that rely on the upgraded
 * packages so regressions surface immediately after a version bump.
 */

/** Safely parse JSON; returns null when the response is HTML (e.g. login page). */
async function safeJson(response) {
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('text/html')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ─── 1. Sequelize — database operations ───────────────────────────────────────
test.describe('Sequelize — database-backed API endpoints', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('GET /api/utils/healthcheck — server starts with Sequelize sync', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`);
    expect(response.status()).toBe(200);
  });

  test('POST /api/files/getfiles — Sequelize query returns file list', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/getfiles`, {
      data: { mission: 'Reference-Mission' },
    });
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response (login page in AUTH=local)');
      return;
    }
    expect(data).toHaveProperty('status');
    // Both 'success' (files found) and 'failure' (empty) are valid DB responses
    expect(['success', 'failure']).toContain(data.status);
  });

  test('POST /api/geodatasets/entries — Sequelize geodataset listing', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/entries`, {
      data: {},
    });
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data).toHaveProperty('status');
  });

  test('POST /api/shortener/shorten — Sequelize model insert + retrieve', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/shortener/shorten`, {
      data: { url: '/?mission=Reference-Mission&mapLon=0&mapLat=0&mapZoom=3' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('url');
    }
  });

  test('GET /api/configure/missions — Sequelize config query', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/configure/missions`);
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data).toHaveProperty('missions');
    expect(Array.isArray(data.missions)).toBeTruthy();
  });
});

// ─── 2. Sharp — image compositing ────────────────────────────────────────────
test.describe('Sharp — tile compositing middleware', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('GET /Missions tile path — server does not crash on sharp import', async ({ request }) => {
    // Hit a known tile-like path. The specific tile may 404, but the server
    // must not 500 due to sharp import or API changes.
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

// ─── 3. @turf/turf — geometry functions used by Draw tool ─────────────────────
test.describe('@turf/turf — Draw tool geometry operations', () => {

  test('Draw tool page loads without JS errors from turf imports', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 60000,
    });

    // Open the Draw tool (if available) to trigger its module load
    const drawButton = page.locator('#toolButtonDraw').first();
    const isVisible = await drawButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await drawButton.click();
      await page.waitForTimeout(1000);
    }

    // No turf-related import errors should have occurred
    const turfErrors = errors.filter(
      (e) => e.includes('turf') || e.includes('@turf') || e.includes('bbox') || e.includes('difference')
    );
    expect(turfErrors).toHaveLength(0);
  });

  test('Map loads with turf-dependent layers without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 60000,
    });

    // Verify the map rendered (turf is used for bbox/filtering in layer code)
    const mapExists = await page.evaluate(() => !!window.mmgisAPI.map);
    expect(mapExists).toBe(true);

    // No critical errors from turf operations
    const criticalErrors = consoleErrors.filter(
      (e) => e.includes('turf') || e.includes('is not a function')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
