import { test, expect } from '@playwright/test';
import { waitForMapReady } from '../../helpers/map-helpers.js';

/**
 * Tests for the client-side mmgisAPI exposed on window.
 *
 * Navigates to the Reference-Mission, waits for the Leaflet map to
 * initialise, then exercises the public mmgisAPI surface.
 */

const MISSION_URL = '/?mission=Reference-Mission';

async function ensureMissionAvailable(request, testCtx) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

test.describe('mmgisAPI Client-Side API', () => {
  test('window.mmgisAPI exists after map load', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const hasAPI = await page.evaluate(() => typeof window.mmgisAPI === 'object' && window.mmgisAPI !== null);
    expect(hasAPI).toBe(true);
  });

  test('mmgisAPI.map is a valid Leaflet map', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const isLeafletMap = await page.evaluate(() => {
      const map = window.mmgisAPI.map;
      // Leaflet maps expose getCenter, getZoom, setView, etc.
      return (
        map &&
        typeof map.getCenter === 'function' &&
        typeof map.getZoom === 'function' &&
        typeof map.setView === 'function'
      );
    });

    expect(isLeafletMap).toBe(true);
  });

  test('mmgisAPI.map.getCenter() returns valid coordinates', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const center = await page.evaluate(() => {
      const c = window.mmgisAPI.map.getCenter();
      return { lat: c.lat, lng: c.lng };
    });

    expect(typeof center.lat).toBe('number');
    expect(typeof center.lng).toBe('number');
    expect(Number.isFinite(center.lat)).toBe(true);
    expect(Number.isFinite(center.lng)).toBe(true);
  });

  test('mmgisAPI.map.getZoom() returns valid zoom level', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const zoom = await page.evaluate(() => window.mmgisAPI.map.getZoom());

    expect(typeof zoom).toBe('number');
    expect(zoom).toBeGreaterThanOrEqual(0);
    expect(zoom).toBeLessThanOrEqual(30);
  });

  test('mmgisAPI.map.setView() changes the map view', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    // Get original center
    const before = await page.evaluate(() => {
      const c = window.mmgisAPI.map.getCenter();
      return { lat: c.lat, lng: c.lng };
    });

    // Set a new view
    const targetLat = before.lat + 5;
    const targetLng = before.lng + 5;
    await page.evaluate(
      ([lat, lng]) => {
        window.mmgisAPI.map.setView([lat, lng], 5);
      },
      [targetLat, targetLng],
    );

    // Brief pause for the map to update
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => {
      const c = window.mmgisAPI.map.getCenter();
      return { lat: c.lat, lng: c.lng };
    });

    // Center should have changed
    expect(after.lat).not.toBeCloseTo(before.lat, 1);
  });

  test('mmgisAPI exposes expected documented methods', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const apiInfo = await page.evaluate(() => {
      const api = window.mmgisAPI;
      return {
        hasMap: !!api.map,
        keys: Object.keys(api),
        mapMethods: api.map
          ? ['getCenter', 'getZoom', 'setView', 'getBounds', 'getContainer'].filter(
              (m) => typeof api.map[m] === 'function',
            )
          : [],
      };
    });

    expect(apiInfo.hasMap).toBe(true);
    expect(apiInfo.keys.length).toBeGreaterThan(0);

    // Core Leaflet map methods should be present
    expect(apiInfo.mapMethods).toContain('getCenter');
    expect(apiInfo.mapMethods).toContain('getZoom');
    expect(apiInfo.mapMethods).toContain('setView');
  });
});
