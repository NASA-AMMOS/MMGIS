import { test, expect } from '@playwright/test';

/**
 * Cross-browser basic rendering tests.
 *
 * These tests validate that the core UI renders correctly across all
 * browsers configured in playwright.config.js (chromium, firefox, webkit).
 * They intentionally avoid browser-specific APIs so they pass uniformly.
 */

const MISSION_URL = '/?mission=Reference-Mission';

async function ensureMissionAvailable(request, testCtx) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

test.describe('Cross-Browser Basic Rendering', () => {
  test('map container is visible', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });
  });

  test('tile images load in the map', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait for tile pane to contain at least one <img>
    const hasTiles = await page.waitForFunction(
      () => {
        const pane = document.querySelector('.leaflet-tile-pane');
        if (!pane) return false;
        return pane.querySelectorAll('img').length > 0;
      },
      { timeout: 30000 },
    ).then(() => true).catch(() => false);

    expect(hasTiles).toBe(true);
  });

  test('no critical JavaScript errors on load', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Filter out known benign MMGIS errors that occur during normal initialization
    const critical = errors.filter(
      (msg) =>
        !msg.includes('Cannot set properties of null') &&
        !msg.includes('Cannot read properties of null') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR') &&
        !msg.includes('404')
    );
    expect(critical).toEqual([]);
  });

  test('page renders meaningful content', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Body should have substantial content (not a blank page)
    const bodyLength = await page.evaluate(() => document.body.innerHTML.length);
    expect(bodyLength).toBeGreaterThan(500);

    // At least one stylesheet loaded
    const sheetCount = await page.evaluate(() => document.styleSheets.length);
    expect(sheetCount).toBeGreaterThan(0);
  });

  test('Leaflet map container has non-zero dimensions', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox).not.toBeNull();
    expect(mapBox.width).toBeGreaterThan(0);
    expect(mapBox.height).toBeGreaterThan(0);
  });
});
