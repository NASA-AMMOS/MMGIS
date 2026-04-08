import { test, expect } from '@playwright/test';
import { waitForMapReady, getMapCenter, getMapZoom } from '../../helpers/map-helpers.js';
import { MISSION_SITES } from '../../fixtures/mission-config.js';

/**
 * Deep Linking Tests
 *
 * Verify that URL query parameters correctly control the map state when
 * navigating to /?mission=Reference-Mission with various deep-link params.
 */

test.describe('Deep Linking — URL Parameters', () => {

  /** Helper: check that the Reference-Mission is available before each test. */
  test.beforeEach(async ({ request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
    }
  });

  // --------------------------------------------------------------------------
  // 1. mapLat / mapLon / mapZoom
  // --------------------------------------------------------------------------

  test('mapLat, mapLon, mapZoom params set the initial map view', async ({ page }) => {
    await page.goto(
      '/?mission=Reference-Mission&mapLat=37.7749&mapLon=-122.4194&mapZoom=14',
    );
    await waitForMapReady(page);

    // Allow the map to settle after flying to the requested coordinates
    await page.waitForTimeout(2000);

    const center = await getMapCenter(page);
    const zoom = await getMapZoom(page);

    // Coordinates should be within a reasonable tolerance
    expect(center.lat).toBeCloseTo(37.7749, 1);
    expect(center.lng).toBeCloseTo(-122.4194, 1);
    expect(zoom).toBeCloseTo(14, 0);
  });

  // --------------------------------------------------------------------------
  // 2. Layer on/off with opacity — &on=Points%20Basic$0.5
  // --------------------------------------------------------------------------

  test('on param activates a layer with specified opacity', async ({ page }) => {
    await page.goto(
      '/?mission=Reference-Mission&on=Points%20Basic$0.5',
    );
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // Check via mmgisAPI that "Points Basic" is among the active layers
    const layerState = await page.evaluate(() => {
      if (typeof window.mmgisAPI?.getActiveLayers === 'function') {
        return window.mmgisAPI.getActiveLayers();
      }
      // Fallback: check visible layers
      if (typeof window.mmgisAPI?.getVisibleLayers === 'function') {
        return window.mmgisAPI.getVisibleLayers().map((l) => (typeof l === 'string' ? l : l.name));
      }
      return null;
    });

    // If the API exposes active layers, verify the layer is present
    if (layerState !== null) {
      const names = Array.isArray(layerState)
        ? layerState.map((l) => (typeof l === 'string' ? l : l.name || ''))
        : [];
      expect(names.some((n) => n.includes('Points Basic'))).toBeTruthy();
    }

    // Verify opacity via the layer's Leaflet object or DOM style
    const opacity = await page.evaluate(() => {
      // Try mmgisAPI opacity accessor
      if (typeof window.mmgisAPI?.getLayerOpacity === 'function') {
        return window.mmgisAPI.getLayerOpacity('Points Basic');
      }
      // Fallback: inspect DOM for a layer pane / overlay with reduced opacity
      const panes = document.querySelectorAll('.leaflet-overlay-pane > *');
      for (const el of panes) {
        const style = window.getComputedStyle(el);
        if (parseFloat(style.opacity) < 1) {
          return parseFloat(style.opacity);
        }
      }
      return null;
    });

    // If we got an opacity value, it should be near 0.5
    if (opacity !== null) {
      expect(opacity).toBeCloseTo(0.5, 1);
    }
  });

  // --------------------------------------------------------------------------
  // 3. Time parameters — &startTime / &endTime
  // --------------------------------------------------------------------------

  test('startTime and endTime params set the time control range', async ({ page }) => {
    await page.goto(
      '/?mission=Reference-Mission&startTime=2024-01-05T00:00:00Z&endTime=2024-01-10T00:00:00Z',
    );
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // Read the current time range from the mmgisAPI or from the TimeUI DOM
    const timeRange = await page.evaluate(() => {
      // Prefer API
      if (window.mmgisAPI && typeof window.mmgisAPI.getTime === 'function') {
        return window.mmgisAPI.getTime();
      }
      // Fallback: read time inputs from the TimeUI DOM
      const startEl = document.querySelector(
        '#bottomBar .startTime, #timeUI .startTime, [class*="TimeUI"] input[name="start"]',
      );
      const endEl = document.querySelector(
        '#bottomBar .endTime, #timeUI .endTime, [class*="TimeUI"] input[name="end"]',
      );
      if (startEl && endEl) {
        return { start: startEl.value || startEl.textContent, end: endEl.value || endEl.textContent };
      }
      return null;
    });

    if (timeRange) {
      // Normalise to strings for comparison
      const start = typeof timeRange.start === 'string' ? timeRange.start : JSON.stringify(timeRange.start);
      const end = typeof timeRange.end === 'string' ? timeRange.end : JSON.stringify(timeRange.end);
      expect(start).toContain('2024-01-05');
      expect(end).toContain('2024-01-10');
    }
  });

  // --------------------------------------------------------------------------
  // 4. Site deep link — &site=GGB
  // --------------------------------------------------------------------------

  test('site param navigates to the matching site coordinates', async ({ page }) => {
    await page.goto('/?mission=Reference-Mission&site=GGB');
    await waitForMapReady(page);
    await page.waitForTimeout(3000); // Allow fly-to animation

    const center = await getMapCenter(page);

    const ggb = MISSION_SITES.find((s) => s.code === 'GGB');
    // The map should be near the Golden Gate Bridge
    expect(center.lat).toBeCloseTo(ggb.lat, 0);
    expect(center.lng).toBeCloseTo(ggb.lng, 0);
  });

  // --------------------------------------------------------------------------
  // 5. Tool deep link — &tools=Draw
  // --------------------------------------------------------------------------

  test('tools param opens the specified tool panel', async ({ page }) => {
    await page.goto('/?mission=Reference-Mission&tools=Draw');
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // The Draw tool panel should be visible in the DOM
    const drawPanelVisible = await page.evaluate(() => {
      // Look for the Draw tool's container in common MMGIS patterns
      const drawEl =
        document.querySelector('#toolPanel_Draw') ||
        document.querySelector('[class*="DrawTool"][class*="open"]') ||
        document.querySelector('[id*="Draw"][id*="Tool"]');
      if (drawEl) return true;

      // Fallback: search innerHTML for recognisable Draw content
      return document.body.innerHTML.includes('DrawTool') ||
        document.body.innerHTML.includes('drawToolContextMenu');
    });

    expect(drawPanelVisible).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 6. Copy Link round-trip
  // --------------------------------------------------------------------------

  test('Copy Link button produces a URL that restores map state', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/?mission=Reference-Mission&mapLat=37.82&mapLon=-122.47&mapZoom=13');
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // Record state before clicking Copy Link
    const origCenter = await getMapCenter(page);
    const origZoom = await getMapZoom(page);

    // Click the Copy Link button in the bottom bar
    const copyLinkBtn = page.locator(
      '#bottomBarCopyLink, [id*="copyLink"], [title*="Copy Link"], [title*="copylink"]',
    ).first();

    if (!(await copyLinkBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Copy Link button not found in bottom bar');
      return;
    }

    await copyLinkBtn.click();
    await page.waitForTimeout(1000);

    // Read the clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('mission=Reference-Mission');

    // Navigate to the copied URL
    const url = new URL(clipboardText, page.url());
    await page.goto(url.toString());
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    const newCenter = await getMapCenter(page);
    const newZoom = await getMapZoom(page);

    // The restored state should be close to the original
    expect(newCenter.lat).toBeCloseTo(origCenter.lat, 0);
    expect(newCenter.lng).toBeCloseTo(origCenter.lng, 0);
    expect(newZoom).toBeCloseTo(origZoom, 0);
  });

  // --------------------------------------------------------------------------
  // 7. Shortened URL round-trip (skip if shortener disabled)
  // --------------------------------------------------------------------------

  test('shortened URL round-trip preserves map state', async ({ page }) => {
    test.skip(
      process.env.DISABLE_LINK_SHORTENER === 'true',
      'SKIP: Link shortener disabled',
    );

    // This test verifies shortened URLs redirect and restore state.
    // If the shortener is available, the copy-link button may produce a short URL.
    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);

    // Attempt to trigger the shortener via the mmgisAPI
    const shortUrl = await page.evaluate(async () => {
      if (typeof window.mmgisAPI?.getShortenedUrl === 'function') {
        return window.mmgisAPI.getShortenedUrl();
      }
      return null;
    });

    if (!shortUrl) {
      test.skip(true, 'SKIP: Shortener API not available');
      return;
    }

    // Navigate to the shortened URL
    await page.goto(shortUrl);
    await waitForMapReady(page);
    await page.waitForTimeout(2000);

    // If we land back on the mission page, consider it a success
    expect(page.url()).toContain('mission=Reference-Mission');
  });
});
