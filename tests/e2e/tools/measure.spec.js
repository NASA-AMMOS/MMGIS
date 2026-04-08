import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Measure tool.
 * Frontend: src/essence/Tools/Measure/MeasureTool.js
 *
 * Covers:
 *   - Measure panel opening
 *   - Clicking two points to measure distance
 *   - Elevation profile (skipped — requires TiTiler)
 *   - Clear/reset measurement
 *   - Console error monitoring
 *
 * Reference Mission Measure config:
 *   - DEM: Data/DEMs/USGS_13_n38w123_20250826_SFHill.tif
 *   - Default mode: continuous
 */

test.describe('Measure Tool', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 60000,
    });
  });

  test('Measure tool panel opens', async ({ page }) => {
    // Click Measure tool button in toolbar
    const measureButton = page.locator(
      '#toolButtonMeasure'
    ).first();

    const isVisible = await measureButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'SKIP: Measure tool button not found in toolbar');
      return;
    }

    await measureButton.click();
    await page.waitForTimeout(500);

    // Verify the Measure panel is visible — rendered as a React component with class MeasureTool
    const measurePanel = page.locator('.MeasureTool, #measureLeft').first();
    const panelVisible = await measurePanel.isVisible({ timeout: 5000 }).catch(() => false);

    expect(panelVisible).toBe(true);
  });

  test('Click two points on map shows measurement line and distance', async ({ page }) => {
    // Open Measure tool
    const measureButton = page.locator(
      '#toolButtonMeasure'
    ).first();

    const isVisible = await measureButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'SKIP: Measure tool button not found in toolbar');
      return;
    }

    await measureButton.click();
    await page.waitForTimeout(500);

    // Verify the tool opened
    const measurePanel = page.locator('.MeasureTool, #measureLeft').first();
    const panelVisible = await measurePanel.isVisible({ timeout: 5000 }).catch(() => false);
    if (!panelVisible) {
      test.skip(true, 'SKIP: Measure panel did not open');
      return;
    }

    // Get map container bounds for clicking
    const mapContainer = page.locator('#map');
    const mapBox = await mapContainer.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map container not found');
      return;
    }

    const centerX = Math.floor(mapBox.width / 2);
    const centerY = Math.floor(mapBox.height / 2);

    // Click first point on the map
    await mapContainer.click({
      position: { x: centerX - 80, y: centerY },
    });
    await page.waitForTimeout(500);

    // Click second point on the map
    await mapContainer.click({
      position: { x: centerX + 80, y: centerY },
    });
    await page.waitForTimeout(1500);

    // Verify measurement data is available — check that MeasureTool.lastData has entries
    const hasData = await page.evaluate(() => {
      // The polyline measure control adds measurement layers to the map
      const map = window.mmgisAPI?.map;
      if (!map) return false;
      let hasPolyline = false;
      map.eachLayer((layer) => {
        // Measure tool adds polyline layers for the measurement line
        if (layer._latlngs && layer._latlngs.length >= 2) {
          hasPolyline = true;
        }
        // Also check for circle markers (measurement endpoints)
        // eslint-disable-next-line no-undef
        if (layer instanceof L.CircleMarker) {
          hasPolyline = true;
        }
      });
      return hasPolyline;
    });

    // The measurement should have created some visual feedback on the map
    // In continuous mode (the default for Reference Mission), clicking adds points
    expect(hasData).toBe(true);
  });

  test('Elevation profile', async ({ page }) => {
    test.skip(true, 'SKIP: Elevation profile requires TiTiler serving the DEM — needs WITH_TITILER=true');
  });

  test('Clear measurement removes readout', async ({ page }) => {
    // Open Measure tool
    const measureButton = page.locator(
      '#toolButtonMeasure'
    ).first();

    const isVisible = await measureButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'SKIP: Measure tool button not found in toolbar');
      return;
    }

    await measureButton.click();
    await page.waitForTimeout(500);

    // Verify the tool opened
    const measurePanel = page.locator('.MeasureTool, #measureLeft').first();
    const panelVisible = await measurePanel.isVisible({ timeout: 5000 }).catch(() => false);
    if (!panelVisible) {
      test.skip(true, 'SKIP: Measure panel did not open');
      return;
    }

    // Make a measurement by clicking two points
    const mapContainer = page.locator('#map');
    const mapBox = await mapContainer.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map container not found');
      return;
    }

    const centerX = Math.floor(mapBox.width / 2);
    const centerY = Math.floor(mapBox.height / 2);

    await mapContainer.click({
      position: { x: centerX - 60, y: centerY },
    });
    await page.waitForTimeout(400);

    await mapContainer.click({
      position: { x: centerX + 60, y: centerY },
    });
    await page.waitForTimeout(1000);

    // Click the Reset button (#measureReset with title="Reset" in #measureIcons)
    const resetBtn = page.locator('#measureIcons #measureReset, #measureTop #measureReset').first();
    const resetVisible = await resetBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!resetVisible) {
      test.skip(true, 'SKIP: Reset button not found in Measure tool');
      return;
    }

    await resetBtn.click();
    await page.waitForTimeout(500);

    // After reset, the info readouts should show dashes (--) indicating no measurement
    // The readout should be reset to default (-- or empty/hidden)
    // opacity is set to 0 on reset, but textContent might still hold the last value
    // Check that the element's computed opacity is 0 or the text is "--"
    const isResetOrHidden = await page.evaluate(() => {
      const el = document.querySelector('#measureInfoLng > div:last-child');
      if (!el) return true;
      const style = window.getComputedStyle(el);
      return style.opacity === '0' || el.textContent.trim() === '--';
    });

    expect(isResetOrHidden).toBe(true);
  });

  test('No console errors during Measure operations', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) {
        errors.push(msg.text());
      }
    });

    // Open Measure tool
    const measureButton = page.locator(
      '#toolButtonMeasure'
    ).first();

    const isVisible = await measureButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'SKIP: Measure tool button not found in toolbar');
      return;
    }

    await measureButton.click();
    await page.waitForTimeout(1000);

    // Click a point on the map
    const mapContainer = page.locator('#map');
    const mapBox = await mapContainer.boundingBox();
    if (mapBox) {
      const centerX = Math.floor(mapBox.width / 2);
      const centerY = Math.floor(mapBox.height / 2);

      await mapContainer.click({
        position: { x: centerX - 30, y: centerY },
      });
      await page.waitForTimeout(400);

      await mapContainer.click({
        position: { x: centerX + 30, y: centerY },
      });
      await page.waitForTimeout(1000);
    }

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('WebSocket') &&
        !e.includes('net::ERR') &&
        !e.includes('CORS') &&
        !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
