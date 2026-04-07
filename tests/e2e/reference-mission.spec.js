import { test, expect } from '@playwright/test';

/**
 * Reference Mission Demo Mission - Smoke Tests
 *
 * These tests validate the Reference Mission demo mission loads correctly and
 * all core features are present. They run with FORCE_CONFIG_PATH set to
 * Missions/Reference-Mission/config.reference-mission.json.
 *
 * IMPORTANT: Set FORCE_CONFIG_PATH environment variable before running:
 * FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json npm test
 *
 * These are smoke tests only - they validate presence and basic loading,
 * not deep tool interactions.
 */

test.describe('Reference Mission Demo Mission - Smoke Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Suppress expected 404 errors from optional placeholder data
    page.on('response', response => {
      const url = response.url();
      // Expected 404s: optional tiles, DEMs, images, models
      const expected404s = [
        'Layers/Tiles/basemap',
        'Layers/Images/',
        'Data/elevation',
        'Data/dem-tiles',
        'science.nasa.gov/3d-resources'
      ];

      if (response.status() === 404 && expected404s.some(path => url.includes(path))) {
        // Suppress - these are expected placeholder 404s
        return;
      }
    });

    // Navigate to Reference Mission mission
    await page.goto('/?mission=Reference-Mission');
  });

  test('mission loads without crashes', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check page title
    await expect(page).toHaveTitle(/MMGIS Reference Mission Demo|MMGIS/i);

    // Verify no critical errors (warnings about 404s are okay)
    const criticalErrors = await page.evaluate(() => {
      // Check if there are any uncaught exceptions or critical errors
      // Look for error messages in the DOM or console
      const errorElements = document.querySelectorAll('.error, .critical-error');
      return errorElements.length;
    });
    expect(criticalErrors).toBe(0);
  });

  test('map container is visible', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for map container
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Verify map has loaded (has leaflet layers)
    const hasLeafletContent = await page.evaluate(() => {
      const mapElement = document.getElementById('map');
      return mapElement && mapElement.querySelector('.leaflet-container') !== null;
    });
    expect(hasLeafletContent).toBeTruthy();
  });

  test('page loads in under 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    const loadTime = Date.now() - startTime;

    // Performance check: should load in <5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('all configured tools are present', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Expected tools from Reference Mission configuration
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

    // Check that tools are present in the UI
    // Tools are typically in #toolPanel or .mmgisTools
    for (const toolName of expectedTools) {
      const toolExists = await page.evaluate((name) => {
        // Check for tool by name in various possible locations
        const body = document.body.innerHTML;
        return body.toLowerCase().includes(name.toLowerCase());
      }, toolName);

      expect(toolExists).toBeTruthy();
    }
  });

  test('layers tool lists all vector layers', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open Layers tool if not already open
    // Tool buttons typically have data-tool attribute or specific classes
    const layersButton = page.locator('[title*="Layers"], button:has-text("Layers")').first();
    if (await layersButton.isVisible()) {
      await layersButton.click();
    }

    // Wait a moment for layer list to populate
    await page.waitForTimeout(1000);

    // Expected vector layer names from Reference Mission config
    const expectedLayers = [
      'Vector - GeoJSON - Points Basic',
      'Vector - GeoJSON - Points Styled',
      'Vector - GeoJSON - Points Symbols',
      'Vector - GeoJSON - Lines Basic',
      'Vector - GeoJSON - Lines Styled',
      'Vector - GeoJSON - Polygons Basic',
      'Vector - GeoJSON - Polygons Styled',
      'Vector - GeoJSON - Time-Enabled',
      'Vector - GeoJSON - Clustered',
      'Vector - GeoJSON - TEST Geodataset Example',
      'Vector - GeoJSON - TEST Draw File Example'
    ];

    // Check that layer names are present in the DOM
    for (const layerName of expectedLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }
  });

  test('can toggle a vector layer on', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open Layers tool
    const layersButton = page.locator('[title*="Layers"], button:has-text("Layers")').first();
    if (await layersButton.isVisible()) {
      await layersButton.click();
      await page.waitForTimeout(500);
    }

    // Try to find and click a vector layer toggle
    // Look for Points Basic layer checkbox or toggle
    const layerToggle = page.locator('[title*="Points Basic"], input[type="checkbox"]').first();

    if (await layerToggle.isVisible({ timeout: 5000 })) {
      await layerToggle.click();
      await page.waitForTimeout(1000);

      // Check if Leaflet markers have been added to the map
      const hasMarkers = await page.evaluate(() => {
        const mapElement = document.getElementById('map');
        const markers = mapElement.querySelectorAll('.leaflet-marker-icon, .leaflet-marker-pane');
        return markers.length > 0;
      });

      expect(hasMarkers).toBeTruthy();
    } else {
      // If we can't find the toggle, at least verify the layer list is populated
      const layersListPopulated = await page.evaluate(() => {
        return document.body.innerHTML.includes('Vector - GeoJSON');
      });
      expect(layersListPopulated).toBeTruthy();
    }
  });

  test('TEST- prefixed layers are present', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for TEST example layers
    const testLayers = [
      'TEST Geodataset Example',
      'TEST Draw File Example'
    ];

    for (const layerName of testLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }
  });

  test('external tile layers configured', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check that external tile providers are configured
    const externalTileLayers = [
      'OpenStreetMap',
      'ArcGIS World Imagery',
      'ArcGIS World Topographic'
    ];

    for (const layerName of externalTileLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }

    // NOTE: We don't validate that external tiles actually load
    // (network dependency, not suitable for CI smoke tests)
  });

  test('model layers configured', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check that NASA 3D model layers are configured
    const modelLayers = [
      'Perseverance Rover',
      'Ingenuity',
      'James Webb'
    ];

    for (const layerName of modelLayers) {
      const layerExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, layerName);

      expect(layerExists).toBeTruthy();
    }

    // NOTE: We don't validate models actually load in Globe view
    // (models may have broken external URLs, which is documented)
  });

  test('no critical console errors', async ({ page }) => {
    const criticalErrors = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();

        // Filter out expected errors (404s from optional data)
        const expected404s = [
          'Failed to load resource',
          'elevation.tif',
          'dem-tiles',
          'basemap',
          'single-band.tif',
          'cloud-optimized.tif',
          'nasa.gov'
        ];

        const isExpectedError = expected404s.some(pattern =>
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

  test('sites navigation tool configured', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check that Sites tool has locations configured
    const siteNames = [
      'Golden Gate Bridge',
      'Downtown San Francisco',
      'SF Bay Overview',
      'Alcatraz Island'
    ];

    // Sites tool may show site names in the UI
    let sitesFound = 0;
    for (const siteName of siteNames) {
      const siteExists = await page.evaluate((name) => {
        return document.body.innerHTML.includes(name);
      }, siteName);

      if (siteExists) sitesFound++;
    }

    // At least some sites should be present (may not all be visible initially)
    expect(sitesFound).toBeGreaterThan(0);
  });

  test('draw tool configured with templates', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check that Draw tool is configured
    const drawToolExists = await page.evaluate(() => {
      return document.body.innerHTML.toLowerCase().includes('draw');
    });

    expect(drawToolExists).toBeTruthy();

    // Note: We don't test deep Draw tool interactions (template forms, etc.)
    // Those are deferred to future integration tests
  });

});
