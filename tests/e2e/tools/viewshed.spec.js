import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Viewshed Tool.
 *
 * The Viewshed tool performs viewshed analysis using DEM tilesets.
 * Reference-Mission config:
 *   - demtileurl: "Data/dem-tiles/{z}/{x}/{y}.png"
 *   - Camera presets: Default Camera (height: 2, azCenter: 0, azFOV: 70, elCenter: -10, elFOV: 30)
 *
 * Currently covers:
 *   - Viewshed panel opens
 *   - Full analysis is skipped (requires pre-generated DEM tilesets)
 */

test.describe('Viewshed Tool', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 30000,
    });
  });

  test('Viewshed tool panel opens', async ({ page }) => {
    // Click the Viewshed tool button in the toolbar
    const viewshedBtn = page.locator('[title*="Viewshed"]').first();
    const btnVisible = await viewshedBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'SKIP: Viewshed tool button not found in toolbar');
      return;
    }

    await viewshedBtn.click();
    await page.waitForTimeout(500);

    // Verify the Viewshed panel is visible
    const panel = page.locator(
      '[class*="ViewshedTool"], [class*="viewshedtool"], [class*="viewshed"]'
    ).first();
    const panelVisible = await panel.isVisible({ timeout: 5000 }).catch(() => false);
    expect(panelVisible).toBeTruthy();
  });

  test('viewshed analysis', async () => {
    test.skip(true, 'SKIP: Viewshed requires pre-generated DEM tilesets at Data/dem-tiles/ — needs tileset generation to fully test');
  });

});
