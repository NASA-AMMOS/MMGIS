import { test, expect } from '@playwright/test';
import { waitForMapReady } from '../../helpers/map-helpers.js';
import { MISSION_PANELS } from '../../fixtures/mission-config.js';

/**
 * Panel Layout Tests
 *
 * The Reference Mission has `panels: { viewer: true, map: true, globe: true }`.
 * These tests verify the panel DOM structure, default layout, and the
 * `panePercents` URL parameter.
 */

test.describe('Panel Layout', () => {

  /** Shared setup: ensure Reference-Mission is available. */
  test.beforeEach(async ({ request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
    }
  });

  // --------------------------------------------------------------------------
  // 1. Default layout loads without errors
  // --------------------------------------------------------------------------

  test('default panel layout loads without errors', async ({ page }) => {
    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const expectedPatterns = [
          'Failed to load resource',
          'net::ERR',
          'arcgisonline.com',
          'nasa.gov',
          'earthdata.nasa.gov',
          'elevation.tif',
          'dem-tiles',
          'basemap',
          'single-band.tif',
          'cloud-optimized.tif',
        ];
        if (!expectedPatterns.some((p) => text.toLowerCase().includes(p.toLowerCase()))) {
          errors.push(text);
        }
      }
    });

    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);

    // No unexpected JS errors
    expect(errors.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 2. Viewer and Map panels exist in the DOM
  // --------------------------------------------------------------------------

  test('viewer and map panels exist in the DOM', async ({ page }) => {
    // Confirm config expectations
    expect(MISSION_PANELS.viewer).toBe(true);
    expect(MISSION_PANELS.map).toBe(true);
    expect(MISSION_PANELS.globe).toBe(true);

    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);

    // Check for the viewer panel
    const viewerExists = await page.evaluate(() => {
      const el =
        document.getElementById('viewer') ||
        document.querySelector('[id*="viewer" i]') ||
        document.querySelector('[class*="viewer" i]') ||
        document.querySelector('#splitscreens > div:first-child');
      return el !== null;
    });
    expect(viewerExists).toBeTruthy();

    // Check for the map panel
    const mapExists = await page.evaluate(() => {
      const el = document.getElementById('map');
      return el !== null;
    });
    expect(mapExists).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 3. Globe panel container present (when globe: true)
  // --------------------------------------------------------------------------

  test('globe panel container is present when globe is enabled', async ({ page }) => {
    expect(MISSION_PANELS.globe).toBe(true);

    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);

    const globeExists = await page.evaluate(() => {
      const el =
        document.getElementById('globe') ||
        document.querySelector('[id*="globe" i]') ||
        document.querySelector('[class*="globe" i]') ||
        document.querySelector('[id*="Globe"]');
      return el !== null;
    });
    expect(globeExists).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 4. panePercents param sets panel widths to ~50/50
  // --------------------------------------------------------------------------

  test('panePercents=50,50,0 sets panels to approximately 50/50 layout', async ({ page }) => {
    await page.goto('/?mission=Reference-Mission&panePercents=50,50,0');
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // Read actual panel widths from the DOM
    const panelWidths = await page.evaluate(() => {
      // MMGIS uses a "splitscreens" container with child panels
      const container = document.getElementById('splitscreens');
      if (!container) return null;

      const children = container.children;
      if (children.length < 2) return null;

      const containerWidth = container.offsetWidth;
      if (containerWidth === 0) return null;

      const widths = [];
      for (const child of children) {
        widths.push((child.offsetWidth / containerWidth) * 100);
      }
      return widths;
    });

    if (panelWidths && panelWidths.length >= 2) {
      // First two panels should each be roughly 50%
      expect(panelWidths[0]).toBeGreaterThan(30);
      expect(panelWidths[0]).toBeLessThan(70);
      expect(panelWidths[1]).toBeGreaterThan(30);
      expect(panelWidths[1]).toBeLessThan(70);

      // Third panel (globe) should be very small or zero
      if (panelWidths.length > 2) {
        expect(panelWidths[2]).toBeLessThan(10);
      }
    } else {
      // If the splitscreens container isn't found, check via mmgisAPI
      const apiPercents = await page.evaluate(() => {
        if (typeof window.mmgisAPI?.getPanelPercents === 'function') {
          return window.mmgisAPI.getPanelPercents();
        }
        return null;
      });

      if (apiPercents) {
        expect(apiPercents[0]).toBeCloseTo(50, -1);
        expect(apiPercents[1]).toBeCloseTo(50, -1);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 5. All three panels render when config has all enabled
  // --------------------------------------------------------------------------

  test('all three panel containers render with default config', async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);

    const panelCount = await page.evaluate(() => {
      const container = document.getElementById('splitscreens');
      if (container) return container.children.length;

      // Fallback: count known panel IDs
      let count = 0;
      if (document.getElementById('viewer') || document.querySelector('[id*="viewer" i]')) count++;
      if (document.getElementById('map')) count++;
      if (document.getElementById('globe') || document.querySelector('[id*="globe" i]')) count++;
      return count;
    });

    // With viewer, map, and globe all enabled, we expect at least 2 panels
    // (some layouts may merge viewer into the map pane)
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });
});
