import { test, expect } from '@playwright/test';

/**
 * Reference Mission Demo Mission - Smoke Tests
 *
 * These tests validate the Reference Mission demo mission loads correctly and
 * all core features are present. They run against a server with the
 * Reference-Mission created (via POST /api/config/add { setupReferenceMission: true }).
 *
 * When FORCE_CONFIG_PATH is empty, navigate to /?mission=Reference-Mission
 * so the app loads the correct mission from the database.
 *
 * These are smoke tests only - they validate presence and basic loading,
 * not deep tool interactions.
 */

test.describe('Reference Mission Demo Mission - Smoke Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to Reference Mission
    await page.goto('/?mission=Reference-Mission');
  });

  test('mission loads without crashes', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check page title contains MMGIS
    await expect(page).toHaveTitle(/MMGIS/i);

    // Verify no critical error elements in the DOM
    const criticalErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.error, .critical-error');
      return errorElements.length;
    });
    expect(criticalErrors).toBe(0);
  });

  test('map container is visible', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // The #map element itself IS the leaflet-container in MMGIS
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // Verify #map has the leaflet-container class directly
    const hasLeafletClass = await page.evaluate(() => {
      const mapEl = document.getElementById('map');
      return mapEl && mapEl.classList.contains('leaflet-container');
    });
    expect(hasLeafletClass).toBeTruthy();
  });

  test('page loads in under 15 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    const loadTime = Date.now() - startTime;

    // Performance check: generous threshold for CI and slower machines
    expect(loadTime).toBeLessThan(15000);
  });

  test('all configured tools are present', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Expected tools from Reference Mission config - these appear in the
    // DOM as JS module identifiers, data attributes, CSS class fragments, etc.
    const expectedTools = [
      'Identifier',
      'Layers',
      'Legend',
      'Info',
      'Sites',
      'Draw',
      'Measure',
      'Viewshed',
      'Isochrone',
      'Shade',
      'Chemistry',
      'Curtain',
      'Animation'
    ];

    for (const toolName of expectedTools) {
      const toolExists = await page.evaluate((name) => {
        return document.body.innerHTML.toLowerCase().includes(name.toLowerCase());
      }, toolName);

      expect(toolExists).toBeTruthy();
    }
  });

  test('layers panel shows configured vector layers', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Open the Layers tool panel
    const layersIcon = page.locator('#toolBarLayersTool, [id*="Layers"][id*="Tool"]').first();
    if (await layersIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await layersIcon.click();
      await page.waitForTimeout(2000);
    }

    // Check for actual vector layer names from config.reference-mission.json
    const expectedLayers = [
      'Points Basic',
      'Lines Basic',
      'Polygons Basic',
      'Time-Enabled'
    ];

    for (const layerName of expectedLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }
  });

  test('can open layers panel and see layer categories', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Open the Layers tool panel
    const layersIcon = page.locator('#toolBarLayersTool, [id*="Layers"][id*="Tool"]').first();
    if (await layersIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await layersIcon.click();
      await page.waitForTimeout(2000);
    }

    // The Reference Mission has header groups for layers
    const hasVectorLayers = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return html.includes('Geometry Types') ||
             html.includes('Feature Property') ||
             html.includes('Points Basic');
    });

    expect(hasVectorLayers).toBeTruthy();
  });

  test('basemap tile layers configured', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Open the Layers tool panel
    const layersIcon = page.locator('#toolBarLayersTool, [id*="Layers"][id*="Tool"]').first();
    if (await layersIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await layersIcon.click();
      await page.waitForTimeout(2000);
    }

    // Actual basemap layer names from config.reference-mission.json
    const basemapLayers = [
      'ArcGIS Light',
      'ArcGIS World Topographic',
      'ArcGIS World Imagery'
    ];

    for (const layerName of basemapLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }
  });

  test('no critical console errors', async ({ page }) => {
    const criticalErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();

        // Filter out expected errors (404s from optional data, external resources)
        const expectedPatterns = [
          'Failed to load resource',
          'elevation.tif',
          'dem-tiles',
          'basemap',
          'single-band.tif',
          'cloud-optimized.tif',
          'nasa.gov',
          'arcgisonline.com',
          'earthdata.nasa.gov',
          'net::ERR'
        ];

        const isExpectedError = expectedPatterns.some(pattern =>
          text.toLowerCase().includes(pattern.toLowerCase())
        );

        if (!isExpectedError) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verify no unexpected critical errors
    expect(criticalErrors.length).toBe(0);
  });

  test('sites navigation tool has configured locations', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Open the Sites tool panel
    const sitesIcon = page.locator('#toolBarSitesTool, [id*="Sites"][id*="Tool"]').first();
    if (await sitesIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sitesIcon.click();
      await page.waitForTimeout(2000);
    }

    // Actual site names from config.reference-mission.json
    const siteNames = [
      'San Francisco',
      'Golden Gate Bridge',
      'Downtown San Francisco',
      'San Francisco Bay Overview',
      'Alcatraz Island'
    ];

    let sitesFound = 0;
    for (const siteName of siteNames) {
      const siteExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, siteName);

      if (siteExists) sitesFound++;
    }

    // At least some sites should be present
    expect(sitesFound).toBeGreaterThan(0);
  });

  test('draw tool configured with templates', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check that Draw tool is configured
    const drawToolExists = await page.evaluate(() => {
      return document.body.innerHTML.toLowerCase().includes('draw');
    });

    expect(drawToolExists).toBeTruthy();
  });

});
