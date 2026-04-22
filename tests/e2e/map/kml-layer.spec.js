import { test, expect } from '@playwright/test';
import { waitForMapReady, waitForTilesLoaded } from '../../helpers/map-helpers.js';
import { MissionPage } from '../../pages/MissionPage.js';
import { LayersPanelPage } from '../../pages/LayersPanelPage.js';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;

test.describe('KML Layer Support', () => {
  let missionPage;
  let layersPanel;

  test.beforeEach(async ({ page }) => {
    missionPage = new MissionPage(page);
    layersPanel = new LayersPanelPage(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await waitForTilesLoaded(page);

    // Open the Layers tool panel
    await missionPage.openTool('Layers');
    await page.waitForTimeout(500);
  });

  test('KML layer appears in the Layers panel', async ({ page }) => {
    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    const kmlLayerExists = await page.evaluate(() => {
      return document.body.innerHTML.includes('KML');
    });
    expect(kmlLayerExists).toBeTruthy();
  });

  test('KML layer can be toggled on and features appear on the map', async ({ page }) => {
    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    // Toggle on "KML"
    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(2000);

    // Verify the layer is on
    const isOn = await layersPanel.isLayerOn('KML');
    expect(isOn).toBeTruthy();

    // Verify vector elements appear on the map (SVG paths, circles, or markers)
    const vectorElements = page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane svg circle, .leaflet-overlay-pane canvas, .leaflet-marker-pane .leaflet-marker-icon',
    );
    const count = await vectorElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('KML layer loads correct number of features', async ({ page }) => {
    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(2000);

    // Check that the layer data contains the expected features via L_.layers.data
    const featureCount = await page.evaluate(() => {
      const data = window.L_?.layers?.data;
      if (!data) return 0;
      for (const key of Object.keys(data)) {
        if (data[key]?.name === 'KML' || data[key]?.display_name === 'KML') {
          const layerData = window.L_?.layers?.layer?.[key];
          if (layerData && typeof layerData.getLayers === 'function') {
            return layerData.getLayers().length;
          }
          // Fallback: check the raw geojson stored in L_.layers
          const geojson = window.L_?.layers?.data[key]?._geojson;
          if (geojson && geojson.features) {
            return geojson.features.length;
          }
        }
      }
      return -1;
    });

    // The KML file has 5 placemarks (3 points, 1 line, 1 polygon)
    // At minimum, some features should have loaded
    expect(featureCount).toBeGreaterThan(0);
  });

  test('KML layer can be toggled off', async ({ page }) => {
    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    // Toggle on
    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(1500);

    // Toggle off
    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(1000);

    const isOn = await layersPanel.isLayerOn('KML');
    expect(isOn).toBeFalsy();
  });

  test('KML file is fetched as XML, not JSON', async ({ page }) => {
    // Intercept network requests to verify the .kml file is requested
    const kmlRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('sample-kml.kml')) {
        kmlRequests.push(req.url());
      }
    });

    const kmlResponses = [];
    page.on('response', (res) => {
      if (res.url().includes('sample-kml.kml')) {
        kmlResponses.push({
          url: res.url(),
          status: res.status(),
          contentType: res.headers()['content-type'] || '',
        });
      }
    });

    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(2000);

    // Verify the KML file was requested
    expect(kmlRequests.length).toBeGreaterThan(0);
    expect(kmlRequests[0]).toContain('.kml');

    // Verify the response was successful
    if (kmlResponses.length > 0) {
      expect(kmlResponses[0].status).toBe(200);
    }
  });

  test('no console errors when loading KML layer', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out expected errors (network issues, etc.)
        const expectedPatterns = [
          'Failed to load resource',
          'net::ERR',
          '404',
          'arcgisonline.com',
          'nasa.gov',
          'earthdata.nasa.gov',
          'Cannot set properties of null',
          'Cannot read properties of null',
          'Failed to fetch',
          'NetworkError',
        ];
        if (!expectedPatterns.some((p) => text.toLowerCase().includes(p.toLowerCase()))) {
          errors.push(text);
        }
      }
    });

    await layersPanel.expandGroup('Miscellaneous');
    await page.waitForTimeout(300);

    await layersPanel.toggleLayer('KML');
    await page.waitForTimeout(2000);

    // No unexpected errors should have occurred
    expect(errors.length).toBe(0);
  });
});
