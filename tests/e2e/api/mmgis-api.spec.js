import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { waitForMapReady } from '../../helpers/map-helpers.js';

/**
 * Tests for the client-side mmgisAPI exposed on window.
 *
 * Navigates to the Reference-Mission, waits for the Leaflet map to
 * initialise, then exercises the public mmgisAPI surface.
 *
 * These tests require `npm run build` to have been run first — the
 * server renders build/index.pug which is gitignored and only exists
 * after a production build.
 */

const MISSION_URL = '/?mission=Reference-Mission';

async function ensurePrerequisites(request, testCtx) {
  // The server renders build/index.pug — skip if it hasn't been built.
  const pugPath = resolve(process.cwd(), 'build', 'index.pug');
  if (!existsSync(pugPath)) {
    testCtx.skip(true, 'SKIP: build/index.pug not found — run npm run build first');
    return;
  }

  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

/**
 * Authenticate as the admin user so that subsequent page navigations are not
 * redirected to the login screen. A no-op in AUTH=off mode.
 *
 * Logs in via the standalone login page (form fill) — this is the reliable
 * path under AUTH=local because the login page persists the auth state into
 * the same `MMGISSession` cookie the rest of the app reads. POSTing to
 * `/api/users/login` from a separate request context does NOT carry the
 * resulting session over to subsequent `page.goto(...)` calls.
 */
async function loginIfRequired(page) {
  if (['off', 'none'].includes((process.env.AUTH || 'off').toLowerCase())) return;

  await page.goto('/');
  await page.locator('#username').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('#username', 'test_admin');
  await page.fill('#pwd', 'TestAdmin1!'); // pragma: allowlist secret
  // login.js calls window.location.reload() on success — wait for that to
  // happen *and* for the resulting page to leave the login screen.
  await Promise.all([
    page.waitForLoadState('load'),
    page.click('#login'),
  ]);
  await page.locator('#username').waitFor({ state: 'detached', timeout: 15000 });
}

test.describe('mmgisAPI Client-Side API', () => {
  // Run serially: under AUTH=local each test logs in as the shared admin
  // account, and concurrent logins from multiple workers race on the server's
  // session store and produce intermittent 401 responses.
  test.describe.configure({ mode: 'serial' });

  test('window.mmgisAPI exists after map load', async ({ page, request }) => {
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const hasAPI = await page.evaluate(() => typeof window.mmgisAPI === 'object' && window.mmgisAPI !== null);
    expect(hasAPI).toBe(true);
  });

  test('mmgisAPI.map is a valid Leaflet map', async ({ page, request }) => {
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

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
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

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
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const zoom = await page.evaluate(() => window.mmgisAPI.map.getZoom());

    expect(typeof zoom).toBe('number');
    expect(zoom).toBeGreaterThanOrEqual(0);
    expect(zoom).toBeLessThanOrEqual(30);
  });

  test('mmgisAPI.map.setView() changes the map view', async ({ page, request }) => {
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

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
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

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

  test('mmgisAPI exposes reloadLayer and reloadLayers as functions', async ({ page, request }) => {
    await ensurePrerequisites(request, test);
    await loginIfRequired(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page, { timeout: 60000 });

    const info = await page.evaluate(() => {
      const api = window.mmgisAPI;
      return {
        hasReloadLayer: 'reloadLayer' in api,
        reloadLayerIsFn: typeof api.reloadLayer === 'function',
        hasReloadLayers: 'reloadLayers' in api,
        reloadLayersIsFn: typeof api.reloadLayers === 'function',
      };
    });

    expect(info.hasReloadLayer).toBe(true);
    expect(info.reloadLayerIsFn).toBe(true);
    expect(info.hasReloadLayers).toBe(true);
    expect(info.reloadLayersIsFn).toBe(true);
  });
});
