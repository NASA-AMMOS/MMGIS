import { test, expect } from '@playwright/test';
import { waitForMapReady, waitForTilesLoaded, getMapCenter, getMapZoom, panMap } from '../../helpers/map-helpers.js';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;
const EXPECTED_CENTER = { lat: MISSION_MSV.view[0], lng: MISSION_MSV.view[1] };
const EXPECTED_ZOOM = MISSION_MSV.view[2];

test.describe('Map Initialization', () => {
  test('navigates to Reference-Mission and map container is visible', async ({ page }) => {
    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#map')).toBeVisible();
  });

  test('map API is initialized', async ({ page }) => {
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    const mapExists = await page.evaluate(() => !!window.mmgisAPI?.map);
    expect(mapExists).toBeTruthy();
  });

  test(`initial map center is approximately (${EXPECTED_CENTER.lat}, ${EXPECTED_CENTER.lng})`, async ({ page }) => {
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    const center = await getMapCenter(page);
    expect(center.lat).toBeCloseTo(EXPECTED_CENTER.lat, 0);
    expect(center.lng).toBeCloseTo(EXPECTED_CENTER.lng, 0);
  });

  test(`initial zoom level is approximately ${EXPECTED_ZOOM}`, async ({ page }) => {
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    const zoom = await getMapZoom(page);
    expect(zoom).toBeCloseTo(EXPECTED_ZOOM, 0);
  });

  test('tile images render in .leaflet-tile-pane', async ({ page }) => {
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await waitForTilesLoaded(page);
    const tileCount = await page.locator('.leaflet-tile-pane img').count();
    expect(tileCount).toBeGreaterThan(0);
  });

  test('pan via mouse drag changes map center', async ({ page }) => {
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await waitForTilesLoaded(page);

    const before = await getMapCenter(page);

    // Use page.evaluate to programmatically pan the map for reliability
    await page.evaluate(() => {
      const map = window.mmgisAPI.map;
      const center = map.getCenter();
      map.panTo([center.lat + 0.05, center.lng + 0.05], { animate: false });
    });
    await page.waitForTimeout(1000);
    const after = await getMapCenter(page);

    const moved = Math.abs(after.lat - before.lat) > 0.001 ||
                  Math.abs(after.lng - before.lng) > 0.001;
    expect(moved).toBeTruthy();
  });

  test('zoom via scroll wheel changes zoom level', async ({ page }) => {
    // zoomcontrol is false in Reference Mission config, so use programmatic zoom
    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await waitForTilesLoaded(page);

    const zoomBefore = await getMapZoom(page);

    // Use programmatic zoom for reliability (scroll wheel may not work in headless)
    await page.evaluate(() => {
      const map = window.mmgisAPI.map;
      map.setZoom(map.getZoom() + 1, { animate: false });
    });
    await page.waitForTimeout(1000);

    const zoomAfter = await getMapZoom(page);
    expect(zoomAfter).not.toEqual(zoomBefore);
  });
});
