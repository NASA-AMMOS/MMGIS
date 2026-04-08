import { test, expect } from '@playwright/test';

/**
 * Mobile / responsive layout tests for MMGIS.
 *
 * Uses a 375x667 viewport (iPhone SE-class device) to verify that the
 * application adapts gracefully to small screens.
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

    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox).not.toBeNull();

    // Map should span at least 90% of the viewport width (375 px)
    expect(mapBox.width).toBeGreaterThanOrEqual(375 * 0.9);
  });

  test('toolbar is accessible on mobile', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check if any toolbar or navigation element is visible or at least
    // present in the DOM (it may be behind a hamburger menu on mobile)
    const toolbarVisible = await page.locator(
      '[class*="toolbar"], [class*="Toolbar"], [class*="ToolBar"], nav',
    ).count();

    const hamburger = await page.locator(
      '[class*="hamburger"], [class*="menu-toggle"], [aria-label="menu"], [class*="mmgis-menu"]',
    ).count();

    // At least one navigation mechanism should exist
    expect(toolbarVisible + hamburger).toBeGreaterThan(0);
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

    expect(errors).toEqual([]);
  });
});
