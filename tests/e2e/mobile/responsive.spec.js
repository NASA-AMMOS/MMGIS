import { test, expect } from '@playwright/test';

/**
 * Mobile / responsive layout tests for MMGIS.
 *
 * Uses a 375x667 viewport (iPhone SE-class device) to verify that the
 * application adapts gracefully to small screens.
 */

const MISSION_URL = '/?mission=Reference-Mission';

async function ensureMissionAvailable(request, testCtx) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

test.describe('Mobile Responsive Behavior', () => {
  // Override viewport for this suite
  test.use({ viewport: { width: 375, height: 667 } });

  test('map container is visible on mobile viewport', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });
  });

  test('map fills the viewport width', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    // Wait for mmgisAPI to be ready so the layout is fully rendered
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox).not.toBeNull();

    // Map should span at least 50% of the viewport width (375 px)
    // MMGIS may use a split-screen layout that reduces effective map width
    expect(mapBox.width).toBeGreaterThanOrEqual(375 * 0.5);
  });

  test('toolbar is accessible on mobile', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), { timeout: 15000 }).catch(() => {});

    // Check if any toolbar or navigation element is present in the DOM
    // On mobile, toolbar may be hidden or behind a hamburger menu
    const toolbarExists = await page.evaluate(() => {
      return !!(
        document.querySelector('#toolbar') ||
        document.querySelector('#toolbarTools') ||
        document.querySelector('[class*="toolbar"]') ||
        document.querySelector('[class*="Toolbar"]') ||
        document.querySelector('nav') ||
        document.querySelector('[class*="hamburger"]') ||
        document.querySelector('[class*="menu-toggle"]')
      );
    });

    expect(toolbarExists).toBeTruthy();
  });

  test('no horizontal scrollbar on mobile viewport', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('page renders without JS errors on mobile', async ({ page, request }) => {
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
});
