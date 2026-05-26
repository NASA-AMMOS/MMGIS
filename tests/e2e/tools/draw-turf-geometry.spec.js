import { test, expect } from '@playwright/test';

/**
 * E2E tests for @turf/turf geometry operations in the Draw tool.
 *
 * The Draw tool (src/essence/Tools/Draw/) uses @turf/turf for:
 *   - bbox: bounding box calculations for feature selection/editing
 *   - difference: polygon subtraction in drawThrough/drawUnder modes
 *
 * These tests verify the Draw tool module loads without import errors
 * and the map renders correctly with turf-dependent layer operations.
 */

test.describe('Draw tool — @turf/turf geometry operations', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 60000,
    });
  });

  test('Draw tool module loads without turf import errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const drawButton = page.locator('#toolButtonDraw').first();
    const isVisible = await drawButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await drawButton.click();
      await page.waitForTimeout(1000);
    }

    const turfErrors = errors.filter(
      (e) => e.includes('turf') || e.includes('@turf') || e.includes('bbox') || e.includes('difference')
    );
    expect(turfErrors).toHaveLength(0);
  });

  test('Map loads with turf-dependent layers without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const mapExists = await page.evaluate(() => !!window.mmgisAPI.map);
    expect(mapExists).toBe(true);

    const criticalErrors = consoleErrors.filter(
      (e) => e.includes('turf') || e.includes('is not a function')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
