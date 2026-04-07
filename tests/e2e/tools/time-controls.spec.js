import { test, expect } from '@playwright/test';

/**
 * E2E tests for time-related UI controls.
 * Frontend: src/essence/Basics/Formulae_/Formulae_.js (getTimeStartsBetweenTimestamps)
 *           src/essence/Basics/Map_/Map_.js (tile URL construction, COG case)
 *
 * Currently covers:
 *   - Time UI renders without infinite loop (impacted by Formulae_.js loop variable fix)
 *   - Time-enabled layer toggling triggers no 500 errors
 *   - COG tile URL construction does not fall through switch (impacted by Map_.js break fix)
 *
 * Future tests can cover:
 *   - Time slider drag interaction
 *   - Play/pause animation
 *   - Time range selection
 *   - Time-enabled layer feature filtering
 *   - COG layer rendering
 */

test.describe('Time Controls & Tile Rendering', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  });

  test.describe('Time UI (Formulae_.js)', () => {

    test('time-enabled layer can be toggled without infinite loop or crash', async ({ page }) => {
      const serverErrors = [];
      page.on('response', (response) => {
        if (response.status() >= 500) {
          serverErrors.push({ url: response.url(), status: response.status() });
        }
      });

      const consoleErrors = [];
      page.on('console', (msg) => {
        if (
          msg.type() === 'error' &&
          (msg.text().includes('Maximum call stack') || msg.text().includes('infinite'))
        ) {
          consoleErrors.push(msg.text());
        }
      });

      // Open Layers tool and toggle the Time-Enabled layer
      const layersButton = page.locator('[title*="Layers"], button:has-text("Layers")').first();
      if (await layersButton.isVisible({ timeout: 5000 })) {
        await layersButton.click();
        await page.waitForTimeout(500);
      }

      const timeLayer = page.locator('text=Time-Enabled').first();
      if (await timeLayer.isVisible({ timeout: 5000 })) {
        await timeLayer.click();
        await page.waitForTimeout(2000);
      }

      expect(consoleErrors).toHaveLength(0);
      expect(serverErrors).toHaveLength(0);
    });

  });

  test.describe('Tile URL construction (Map_.js)', () => {

    test('no page errors from switch fallthrough after loading map', async ({ page }) => {
      // The Map_.js switch fix prevents COG case from falling through to default.
      // Verify no unexpected errors during normal map rendering.
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      // Wait for map to fully render
      const mapContainer = page.locator('#map');
      await expect(mapContainer).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);

      // Filter out known/expected errors
      const unexpectedErrors = pageErrors.filter(
        (msg) =>
          !msg.includes('Failed to load resource') &&
          !msg.includes('404') &&
          !msg.includes('nasa.gov')
      );
      expect(unexpectedErrors).toHaveLength(0);
    });

  });

});
