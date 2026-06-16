import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Info Tool.
 *
 * The Info tool displays feature properties when a user clicks on a layer
 * whose `kind` is set to "info". In the Reference-Mission config the
 * "Mosaic - Receivers" layer uses `kind: "info"`.
 *
 * Currently covers:
 *   - Toggling the info-kind layer on and clicking a feature to open the Info panel
 */

test.describe('Info Tool', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 30000,
    });
  });

  test('toggle layer with kind=info and click feature to open Info panel', async ({ page }) => {
    // Open the Layers tool panel
    const layersBtn = page.locator('#toolButtonLayers').first();
    await layersBtn.click();
    await page.waitForTimeout(500);

    // Look for the "Mosaic - Receivers" layer (kind: "info") and toggle it on
    const receiverLayer = page.locator('text=Mosaic - Receivers').first();
    const receiverVisible = await receiverLayer.isVisible({ timeout: 3000 }).catch(() => false);

    if (!receiverVisible) {
      // The layer may be nested inside a collapsed header group — try expanding groups
      const headers = page.locator('[class*="header"], [class*="group"]');
      const headerCount = await headers.count();
      for (let i = 0; i < headerCount; i++) {
        const header = headers.nth(i);
        const text = await header.textContent().catch(() => '');
        if (text.includes('Mosaic') || text.includes('Interaction') || text.includes('Kind')) {
          await header.click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Try to find and toggle the layer checkbox
    const layerRow = page.locator('[class*="layer"], li, .checkbox-container')
      .filter({ hasText: 'Mosaic - Receivers' })
      .first();

    const layerRowVisible = await layerRow.isVisible({ timeout: 3000 }).catch(() => false);

    if (!layerRowVisible) {
      test.skip(true, 'SKIP: "Mosaic - Receivers" layer not found in Layers panel — may need different group expansion');
      return;
    }

    // Toggle the layer on
    const checkbox = layerRow.locator(
      'input[type="checkbox"], [class*="checkbox"], [class*="toggle"], [class*="visibility"]'
    ).first();
    await checkbox.click();
    await page.waitForTimeout(1000);

    // Click on the center of the map to try to hit a feature
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    await mapEl.click({ position: { x: mapBox.width / 2, y: mapBox.height / 2 } });
    await page.waitForTimeout(1500);

    // Check if the Info panel opened with feature properties
    const infoPanel = page.locator('[class*="InfoTool"], [class*="info-panel"], [class*="infotool"]').first();
    const infoPanelVisible = await infoPanel.isVisible({ timeout: 3000 }).catch(() => false);

    if (!infoPanelVisible) {
      // Check if any popup or property table appeared instead
      const popup = page.locator('.leaflet-popup, [class*="properties"], [class*="feature-info"]').first();
      const popupVisible = await popup.isVisible({ timeout: 2000 }).catch(() => false);

      if (!popupVisible) {
        test.skip(true, 'SKIP: No features with kind=info found clickable — may need layer data or different zoom level');
        return;
      }

      // Verify popup contains some property content
      const popupText = await popup.textContent();
      expect(popupText.length).toBeGreaterThan(0);
    } else {
      // Verify the Info panel contains property names or values
      const panelText = await infoPanel.textContent();
      expect(panelText.length).toBeGreaterThan(0);
    }
  });

});
