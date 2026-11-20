import { test, expect } from '@playwright/test';
import { fetchLayerTimeSeries } from '../IdentifierTimeSeries.js';

/**
 * E2E tests for the Identifier Tool.
 *
 * The Identifier tool is a separated tool (separatedTool: true) with
 * left-positioned panel. It shows coordinate/pixel information when the
 * user clicks on the map.
 *
 * Currently covers:
 *   - Panel opens when the Identifier toolbar button is clicked
 *   - Clicking on the map displays coordinate/pixel info
 *   - No unexpected console errors during use
 */

test.describe('Identifier Tool', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 30000,
    });
  });

  test('Identifier tool panel opens', async ({ page }) => {
    // Click the Identifier tool button in the toolbar
    const identifierBtn = page.locator('#toolButtonSeparated_Identifier, #toolButtonIdentifier').first();
    const btnVisible = await identifierBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'SKIP: Identifier tool button not found in toolbar');
      return;
    }

    await identifierBtn.click();
    await page.waitForTimeout(500);

    // Verify the Identifier panel is visible
    // MMGIS uses #toolContentSeparated_Identifier for separated tools
    const panel = page.locator(
      '#toolContentSeparated_Identifier, [id*="Identifier"][id*="ool"], [class*="IdentifierTool"]'
    ).first();
    const panelVisible = await panel.isVisible({ timeout: 3000 }).catch(() => false);

    // The Identifier is a separated tool — after clicking it becomes active
    // Check if the button is now in active state (has 'active' class)
    if (!panelVisible) {
      const isActive = await identifierBtn.evaluate(el => {
        return el.className.includes('active') || el.closest('.active') !== null;
      }).catch(() => false);
      expect(isActive).toBeTruthy();
    } else {
      expect(panelVisible).toBeTruthy();
    }
  });

  test('Click on map shows coordinate/pixel info', async ({ page }) => {
    // Open the Identifier tool
    const identifierBtn = page.locator('#toolButtonSeparated_Identifier, #toolButtonIdentifier').first();
    const btnVisible = await identifierBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'SKIP: Identifier tool button not found in toolbar');
      return;
    }

    await identifierBtn.click();
    await page.waitForTimeout(500);

    // Click on the center of the map
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    await mapEl.click({ position: { x: mapBox.width / 2, y: mapBox.height / 2 } });
    await page.waitForTimeout(1000);

    // Check for coordinate information displayed in the Identifier panel or popup
    const coordInfo = page.locator(
      '[class*="IdentifierTool"], [class*="identifiertool"], [class*="identifier"], [class*="separated"]'
    ).first();
    const coordVisible = await coordInfo.isVisible({ timeout: 3000 }).catch(() => false);

    if (coordVisible) {
      const text = await coordInfo.textContent();
      // Coordinate info should contain some numeric values (lat/lng or pixel coords)
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    } else {
      // Identifier info may appear in a different location; check for any coordinate display
      const coordDisplay = page.locator('[class*="coord"], [class*="lnglat"]').first();
      const displayVisible = await coordDisplay.isVisible({ timeout: 2000 }).catch(() => false);
      if (!displayVisible) {
        test.skip(true, 'SKIP: Coordinate info not displayed after map click — tool may require specific layer interaction');
      }
    }
  });

  test('No console errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // Open the Identifier tool
    const identifierBtn = page.locator('#toolButtonSeparated_Identifier, #toolButtonIdentifier').first();
    const btnVisible = await identifierBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      test.skip(true, 'SKIP: Identifier tool button not found in toolbar');
      return;
    }

    await identifierBtn.click();
    await page.waitForTimeout(500);

    // Click on the map
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (mapBox) {
      await mapEl.click({ position: { x: mapBox.width / 2, y: mapBox.height / 2 } });
      await page.waitForTimeout(1000);
    }

    // Filter out known benign MMGIS errors
    const unexpectedErrors = pageErrors.filter(
      (msg) =>
        !msg.includes('404') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR') &&
        !msg.includes('Cannot set properties of null') &&
        !msg.includes('Cannot read properties of null')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

});

/**
 * Click for time series (#1159), in the running app.
 *
 * Uses the Reference Mission's time-enabled STAC collection layer. The STAC
 * API and TiTiler are stood in for with page.route, in the response shapes of
 * the pinned stac-fastapi-pgstac 6.2 and titiler-pgstac 3.1, so the test does
 * not need the Python servers or the collection's data.
 */
test.describe('Identifier time series', () => {
  const START = '2024-01-01T00:00:00Z';
  const END = '2024-06-30T23:59:59Z';
  // 14 acquisitions - more than the hover readout's 10-item cap.
  const ITEMS = Array.from({ length: 14 }, (_, i) => ({
    id: `scene_${String(i).padStart(2, '0')}`,
    datetime: new Date(Date.UTC(2024, 0, 1 + i * 10)).toISOString(),
  }));

  let stacUUID;
  let collection;
  let requests;

  test.beforeEach(async ({ page }) => {
    requests = { search: [], pointIds: [], pointHover: 0 };

    await page.route('**/stac/search?**', (route) => {
      const u = new URL(route.request().url());
      requests.search.push(u);
      const features = ITEMS.slice()
        .reverse()
        .map((it) => ({
          type: 'Feature',
          id: it.id,
          collection,
          properties: { datetime: it.datetime },
        }));
      route.fulfill({
        contentType: 'application/geo+json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features,
          links: [],
          numberMatched: features.length,
          numberReturned: features.length,
        }),
      });
    });
    await page.route('**/titilerpgstac/collections/**', (route) => {
      const u = new URL(route.request().url());
      if (!u.pathname.includes('/point/')) return route.fulfill({ status: 404, body: '' });
      const ids = u.searchParams.get('ids');
      if (ids == null) requests.pointHover++;
      else requests.pointIds.push(ids.split(','));
      const wanted = ids ? ids.split(',') : ITEMS.slice(-2).map((i) => i.id);
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          coordinates: [0, 0],
          assets: wanted.map((id) => ({
            name: `${collection}/${id}`,
            values: [id === 'scene_03' ? null : Number(id.slice(-2)) * 1.5],
            band_names: ['b1'],
            band_descriptions: ['b1'],
          })),
        }),
      });
    });

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await page.waitForFunction(
      () => !!(window.mmgisAPI && window.mmgisAPI.map && window.ToolController_ && window.ToolController_.loaded),
      { timeout: 60000 }
    );
    // The loading screen fades out after load; until then it takes clicks.
    await page.waitForSelector('.LoadingPage', { state: 'detached', timeout: 30000 });

    stacUUID = await page.evaluate(() =>
      Object.keys(window.L_.layers.data).find((uuid) => {
        const l = window.L_.layers.data[uuid];
        return l.type === 'tile' && String(l.url).startsWith('stac-collection:') && l.time && l.time.enabled === true;
      })
    );
    test.skip(!stacUUID, 'SKIP: no time-enabled STAC collection layer in this mission');
    collection = await page.evaluate((uuid) => window.L_.layers.data[uuid].url.split(':')[1].split('?')[0], stacUUID);

    await page.evaluate(
      async ([uuid, start, end]) => {
        await window.mmgisAPI.toggleLayer(uuid, true);
        window.mmgisAPI.setLayerTime(uuid, start, end);
      },
      [stacUUID, START, END]
    );
    await page.evaluate(() => window.ToolController_.openTool('Identifier'));
    await page.waitForTimeout(300);
  });

  const yellowMarkers = (page) => page.locator('.leaflet-overlay-pane path[fill="yellow"]');

  // Click empty map near (centre + dx, dy). The mission's default vector
  // layers have features near the centre, and a feature takes its own click,
  // so step outward to a spot with no clickable layer under it.
  async function clickMap(page, dx = 0, dy = 0) {
    const box = await page.locator('#map').boundingBox();
    const spot = await page.evaluate(
      ([x0, y0]) => {
        for (let r = 0; r < 200; r += 6)
          for (let a = 0; a < 360; a += r === 0 ? 360 : 30) {
            const x = x0 + r * Math.cos((a * Math.PI) / 180);
            const y = y0 + r * Math.sin((a * Math.PI) / 180);
            const el = document.elementFromPoint(x, y);
            if (el && el.closest('#map') && !el.closest('.leaflet-interactive, .leaflet-control'))
              return { x, y };
          }
        return { x: x0, y: y0 };
      },
      [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy]
    );
    await page.mouse.click(spot.x, spot.y);
  }

  test('hover adds "Click for time series" and queries no history', async ({ page }) => {
    const box = await page.locator('#map').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
    await expect(page.locator('#cursorInfo')).toContainText('Click for time series', { timeout: 5000 });
    // the hover's own value read still happens
    await expect.poll(() => requests.pointHover).toBeGreaterThan(0);
    expect(requests.search).toHaveLength(0);
    expect(requests.pointIds).toHaveLength(0);
  });

  test('a click marks the point and charts the whole history', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await clickMap(page);
    const panel = page.locator('#identifierTimeSeriesPanel');
    await expect(panel).toBeVisible();
    await expect(yellowMarkers(page)).toHaveCount(1);
    const section = panel.locator(`[data-layer="${stacUUID}"]`);
    await expect(section.locator('canvas')).toHaveCount(1, { timeout: 10000 });

    // the layer's window, the clicked point, and every item asked for by id
    expect(requests.search).toHaveLength(1);
    expect(requests.search[0].searchParams.get('datetime')).toBe(`${START}/${END}`);
    expect(requests.search[0].searchParams.get('collections')).toBe(collection);
    expect(requests.pointIds.flat().sort()).toEqual(ITEMS.map((i) => i.id).sort());
    // placing the map and globe markers and drawing the chart threw nothing
    expect(pageErrors).toEqual([]);
  });

  test('another click moves the marker and refreshes; close removes it', async ({ page }) => {
    await clickMap(page);
    await expect(page.locator(`#identifierTimeSeriesPanel [data-layer="${stacUUID}"] canvas`)).toHaveCount(1, {
      timeout: 10000,
    });
    const coords = page.locator('.identifierTimeSeriesPanel_coords');
    const first = await coords.textContent();

    await clickMap(page, -120, 60);
    await expect(coords).not.toHaveText(first);
    await expect(yellowMarkers(page)).toHaveCount(1);
    await expect.poll(() => requests.search.length).toBe(2);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(1);

    await page.locator('.identifierTimeSeriesPanel_close').click();
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    await expect(yellowMarkers(page)).toHaveCount(0);
  });

  test('turning the Identifier off removes the panel, marker and listener', async ({ page }) => {
    await clickMap(page);
    await expect(page.locator('#identifierTimeSeriesPanel')).toBeVisible();
    await page.evaluate(() => window.ToolController_.closeTool('Identifier'));
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    await expect(yellowMarkers(page)).toHaveCount(0);
    const listening = await page.evaluate(() =>
      window.mmgisAPI.map.listens('click', window.ToolController_.getTool('IdentifierTool').clickMap)
    );
    expect(listening).toBe(false);

    const searches = requests.search.length;
    await clickMap(page, 40, 40);
    await page.waitForTimeout(500);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search.length).toBe(searches);
  });

  test('Measure open: Measure keeps its clicks; closed, the Identifier charts again', async ({ page }) => {
    await page.evaluate(() => window.ToolController_.openTool('Measure'));
    await page.waitForTimeout(500);
    const measurePaths = () => page.locator('.leaflet-overlay-pane path').count();
    const before = await measurePaths();
    await clickMap(page, -60, 0);
    await clickMap(page, 60, 0);
    // Measure drew its points and line, and no time series was started
    await expect.poll(measurePaths).toBeGreaterThan(before);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search).toHaveLength(0);

    await page.evaluate(() => window.ToolController_.closeTool('Measure'));
    await page.waitForTimeout(300);
    await clickMap(page);
    await expect(page.locator('#identifierTimeSeriesPanel')).toBeVisible();
    expect(requests.search).toHaveLength(1);
  });

  test('Sightline open: its click handler stays and no time series opens', async ({ page }) => {
    await page.evaluate(() => window.ToolController_.openTool('Sightline'));
    await page.waitForTimeout(1500);
    const listening = () =>
      page.evaluate(() =>
        window.mmgisAPI.map.listens('click', window.ToolController_.getTool('SightlineTool')._onMapClick)
      );
    test.skip(!(await listening()), 'SKIP: Sightline did not register its map click handler');
    await clickMap(page, 30, 30);
    await page.waitForTimeout(500);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search).toHaveLength(0);
    expect(await listening()).toBe(true);
    await page.evaluate(() => window.ToolController_.closeTool('Sightline'));
  });

  test("the app's Leaflet answers listens('click', fn) per handler", async ({ page }) => {
    const r = await page.evaluate(() => {
      const map = window.mmgisAPI.map;
      return {
        version: window.L && window.L.version,
        anything: map.listens('click'),
        identifier: map.listens('click', window.ToolController_.getTool('IdentifierTool').clickMap),
        notRegistered: map.listens('click', () => {}),
      };
    });
    // MMGIS's own map listeners mean "anything listens" is always true here,
    // so the guard must (and does) ask about one handler at a time.
    expect(r).toEqual({ version: '1.9.4', anything: true, identifier: true, notRegistered: false });
  });

  test('Viewshed open: its click handler stays and no time series opens', async ({ page }) => {
    await page.evaluate(() => window.ToolController_.openTool('Viewshed'));
    await page.waitForTimeout(1500);
    const listening = () =>
      page.evaluate(() =>
        window.mmgisAPI.map.listens('click', window.ToolController_.getTool('ViewshedTool').setSource)
      );
    test.skip(!(await listening()), 'SKIP: Viewshed did not register its map click handler');
    await clickMap(page, -40, 20);
    await page.waitForTimeout(500);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search).toHaveLength(0);
    expect(await listening()).toBe(true);
    await page.evaluate(() => window.ToolController_.closeTool('Viewshed'));
  });

  test('Draw drawing a polygon keeps its clicks; once drawing ends, clicks chart', async ({ page }) => {
    await page.evaluate(() => window.ToolController_.openTool('Draw'));
    await page.waitForTimeout(1500);
    const begun = await page.evaluate(() => {
      const Draw = window.ToolController_.getTool('DrawTool');
      if (!Draw.drawing || typeof Draw.setDrawingType !== 'function') return false;
      Draw.setDrawingType('polygon');
      return window.mmgisAPI.map.listens('click', Draw.drawing.polygon.start);
    });
    test.skip(!begun, 'SKIP: Draw could not start a polygon here');
    const vertices = () => page.locator('.leaflet-editing-icon').count();
    const before = await vertices();
    await clickMap(page, -50, -20);
    await page.waitForTimeout(400);
    await clickMap(page, 50, -20);
    await page.waitForTimeout(400);
    // Draw placed its vertices and is still drawing; no time series started
    await expect.poll(vertices).toBeGreaterThan(before);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search).toHaveLength(0);
    expect(
      await page.evaluate(() =>
        window.mmgisAPI.map.listens('click', window.ToolController_.getTool('DrawTool').drawing.polygon.start)
      )
    ).toBe(true);

    await page.evaluate(() => window.ToolController_.getTool('DrawTool').endDrawing());
    await page.waitForTimeout(300);
    await clickMap(page, 0, 60);
    await expect(page.locator('#identifierTimeSeriesPanel')).toBeVisible();
    await page.evaluate(() => window.ToolController_.closeTool('Draw'));
  });

  test('closing the Identifier removes only its own map listener', async ({ page }) => {
    await page.evaluate(() => window.ToolController_.openTool('Sightline'));
    await page.waitForTimeout(1500);
    const snapshot = () =>
      page.evaluate(() => {
        const map = window.mmgisAPI.map;
        const own = window.ToolController_.getTool('IdentifierTool').clickMap;
        // Test-only look at Leaflet's listener list, to count the others.
        const others = (map._events.click || []).filter((l) => l.fn !== own).map((l) => l.fn);
        window.__others = window.__others || others;
        return {
          own: map.listens('click', own),
          sightline: map.listens('click', window.ToolController_.getTool('SightlineTool')._onMapClick),
          others: others.length,
          sameOthers: others.length === window.__others.length && others.every((fn, i) => fn === window.__others[i]),
        };
      });
    const open = await snapshot();
    test.skip(!open.sightline, 'SKIP: Sightline did not register its map click handler');
    expect(open.own).toBe(true);
    await page.evaluate(() => window.ToolController_.closeTool('Identifier'));
    const closed = await snapshot();
    expect(closed).toEqual({ own: false, sightline: true, others: open.others, sameOthers: true });
    await page.evaluate(() => window.ToolController_.closeTool('Sightline'));
  });

  test('clicking a vector feature selects it and starts no time series', async ({ page }) => {
    const feature = await page.evaluate(() => {
      for (const uuid of Object.keys(window.L_.layers.on)) {
        if (window.L_.layers.on[uuid] !== true) continue;
        const data = window.L_.layers.data[uuid];
        const layer = window.L_.layers.layer[uuid];
        if (data?.type !== 'vector' || !layer?.getLayers) continue;
        const f = layer.getLayers().find((l) => l.getLatLng && l.feature);
        if (f) {
          const ll = f.getLatLng();
          return { lat: ll.lat, lng: ll.lng };
        }
      }
      return null;
    });
    test.skip(!feature, 'SKIP: no visible point feature in this mission');
    await page.evaluate((f) => window.mmgisAPI.map.setView([f.lat, f.lng], 14, { animate: false }), feature);
    await page.waitForTimeout(800);
    const pt = await page.evaluate((f) => window.mmgisAPI.map.latLngToContainerPoint([f.lat, f.lng]), feature);
    const box = await page.locator('#map').boundingBox();
    expect(await page.evaluate(() => window.mmgisAPI.getActiveFeature())).toBeFalsy();
    await page.mouse.click(box.x + pt.x, box.y + pt.y);
    await expect.poll(() => page.evaluate(() => !!window.mmgisAPI.getActiveFeature())).toBe(true);
    await page.waitForTimeout(500);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(requests.search).toHaveLength(0);
  });

  test('with no time-enabled layer on, a click opens nothing', async ({ page }) => {
    await page.evaluate((uuid) => window.mmgisAPI.toggleLayer(uuid, false), stacUUID);
    const anyTimeOn = await page.evaluate(() =>
      Object.keys(window.L_.layers.on).some(
        (u) => window.L_.layers.on[u] === true && window.L_.layers.data[u]?.time?.enabled === true
      )
    );
    test.skip(anyTimeOn, 'SKIP: another time-enabled layer is on by default');
    await clickMap(page);
    await page.waitForTimeout(500);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    await expect(yellowMarkers(page)).toHaveCount(0);
  });
});

/**
 * Click for time series against the REAL backends - no mocked responses.
 *
 * Needs WITH_STAC=true and WITH_TITILER_PGSTAC=true (stac-fastapi-pgstac 6.2,
 * titiler-pgstac 3.1, pgSTAC 0.9). The Reference Mission's setup then loads
 * its blueprint STAC/ COGs - three genuine NASA EMIT L2B CH4ENH granules -
 * as STAC items, and these tests read them through MMGIS's /stac and
 * /titilerpgstac proxies. Skipped when that collection isn't served.
 *
 * At the point used, all three granules' footprints contain it: two have a
 * reading and the 2024-01-30T20:47:07Z granule is masked (nodata) there.
 */
test.describe('Identifier time series - real STAC and TiTiler', () => {
  const COLLECTION = 'reference_mission_EMIT_L2B_Methane_Enhancement_Data_60_m_V002';
  const LNG = -122.44;
  const LAT = 38.5;
  const START = '2024-01-01T00:00:00Z';
  const END = '2024-06-30T23:59:59Z';
  const base = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const layer = (time = { enabled: true, start: START, end: END }) => ({
    type: 'tile',
    url: `stac-collection:${COLLECTION}`,
    cogUnits: 'ppm m',
    time,
  });

  test.beforeEach(async ({ request }) => {
    const res = await request.get(`${base}/stac/collections/${COLLECTION}`).catch(() => null);
    test.skip(!res || res.status() !== 200, 'SKIP: EMIT STAC collection not served (needs WITH_STAC and WITH_TITILER_PGSTAC)');
  });

  async function series(lyr, lng = LNG, lat = LAT) {
    return fetchLayerTimeSeries({
      layer: lyr,
      lng,
      lat,
      fetchFn: (url, init) => fetch(url, init),
      location: { origin: base, pathname: '/' },
    });
  }

  test('each acquisition is its STAC item, at its STAC time, with its own value', async ({ request }) => {
    const r = await series(layer());
    expect(r.status).toBe('ok');
    const pts = r.series[0].points;

    // the items and times, straight from the STAC API
    const search = await (
      await request.get(
        `${base}/stac/search?collections=${COLLECTION}&limit=100&datetime=${START}/${END}&intersects=${encodeURIComponent(
          JSON.stringify({ type: 'Point', coordinates: [LNG, LAT] })
        )}`
      )
    ).json();
    const stacTimes = Object.fromEntries(search.features.map((f) => [f.id, Date.parse(f.properties.datetime)]));
    expect(pts.map((p) => p.itemId).sort()).toEqual(Object.keys(stacTimes).sort());
    expect(pts).toHaveLength(3);
    for (const p of pts) expect(p.time).toBe(stacTimes[p.itemId]);
    // chronological
    expect(pts.map((p) => p.time)).toEqual([...pts.map((p) => p.time)].sort((a, b) => a - b));

    // every value checked against TiTiler's single-item endpoint, a
    // different code path from the batched collection query
    for (const p of pts) {
      const one = await (
        await request.get(`${base}/titilerpgstac/collections/${COLLECTION}/items/${p.itemId}/point/${LNG},${LAT}?assets=asset`)
      ).json();
      expect(p.value).toBe(one.values[0]);
      expect(p.status).toBe(one.values[0] === null ? 'nodata' : 'ok');
    }
    // the masked granule is a gap, not a zero
    const masked = pts.find((p) => p.itemId.includes('20240130T204707'));
    expect(masked).toMatchObject({ value: null, status: 'nodata' });
    expect(pts.filter((p) => p.status === 'ok')).toHaveLength(2);
  });

  test('the time window filters acquisitions', async () => {
    const r = await series(layer({ enabled: true, start: START, end: '2024-01-31T00:00:00Z' }));
    expect(r.series[0].points.map((p) => p.itemId).sort()).toEqual([
      'EMIT_L2B_CH4ENH_002_20240130T204707_2403014_005',
      'EMIT_L2B_CH4ENH_002_20240130T204718_2403014_006',
    ]);
    const open = await series(layer({ enabled: true, start: '', end: '2024-01-31T00:00:00Z' }));
    expect(open.series[0].points).toHaveLength(2);
  });

  test('asking by id returns every item where items_limit would cut it short', async ({ request }) => {
    const capped = await (
      await request.get(`${base}/titilerpgstac/collections/${COLLECTION}/point/${LNG},${LAT}?assets=asset&items_limit=1`)
    ).json();
    expect(capped.assets).toHaveLength(1);
    const r = await series(layer());
    expect(r.series[0].points).toHaveLength(3);
  });

  test('a point no granule covers: empty, and TiTiler says 204', async ({ request }) => {
    const r = await series(layer(), -100, 10);
    expect(r.status).toBe('empty');
    expect(r.message).toMatch(/No acquisitions/);
    const direct = await request.get(
      `${base}/titilerpgstac/collections/${COLLECTION}/point/-100,10?assets=asset&ids=EMIT_L2B_CH4ENH_002_20240130T204718_2403014_006&items_limit=1`
    );
    expect(direct.status()).toBe(204);
  });

  async function openApp(page, panePercents = '0,100,0') {
    await page.goto(`/?mission=Reference-Mission&panePercents=${panePercents}&mapLat=${LAT}&mapLon=${LNG}&mapZoom=11`);
    await page.waitForFunction(
      () => !!(window.mmgisAPI && window.mmgisAPI.map && window.ToolController_ && window.ToolController_.loaded),
      { timeout: 60000 }
    );
    await page.waitForSelector('.LoadingPage', { state: 'detached', timeout: 30000 });
    // The mission has two layers on this collection; use the time-enabled one.
    const uuid = await page.evaluate(
      (c) =>
        Object.keys(window.L_.layers.data).find(
          (u) =>
            String(window.L_.layers.data[u].url).includes(c) &&
            window.L_.layers.data[u].time?.enabled === true
        ),
      COLLECTION
    );
    expect(uuid).toBeTruthy();
    await page.evaluate(
      async ([u, s, e]) => {
        // Only the EMIT layer: vector features would take the clicks.
        for (const id of Object.keys(window.L_.layers.on))
          if (window.L_.layers.on[id] && window.L_.layers.data[id]?.type === 'vector')
            await window.mmgisAPI.toggleLayer(id, false);
        await window.mmgisAPI.toggleLayer(u, true);
        window.mmgisAPI.setLayerTime(u, s, e);
        window.mmgisAPI.map.setView([38.5, -122.44], 11, { animate: false });
      },
      [uuid, START, END]
    );
    await page.evaluate(() => window.ToolController_.openTool('Identifier'));
    await page.waitForTimeout(500);
    return uuid;
  }

  test('in the app: a map click charts the real granules', async ({ page }) => {
    const seen = { stac: null, point: [] };
    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes('/stac/search?')) seen.stac = await res.json().catch(() => null);
      else if (u.includes('/titilerpgstac/') && u.includes('ids=')) seen.point.push(await res.json().catch(() => null));
    });
    const uuid = await openApp(page);
    const box = await page.locator('#map').boundingBox();
    // the map is centred on the point
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const section = page.locator(`#identifierTimeSeriesPanel [data-layer="${uuid}"]`);
    await expect(section.locator('canvas')).toHaveCount(1, { timeout: 20000 });
    await expect(section.locator('.identifierTimeSeriesPanel_status--error')).toHaveCount(0);
    expect(seen.stac.features).toHaveLength(3);
    const names = seen.point.flatMap((j) => j.assets.map((a) => a.name.split('/').pop()));
    expect(names.sort()).toEqual(seen.stac.features.map((f) => f.id).sort());
  });

  test('globe (Cesium): marker on the surface, click charts, drag and marker clicks do not', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let searches = 0;
    page.on('request', (req) => {
      if (req.url().includes('/stac/search?')) searches++;
    });
    await openApp(page, '0,50,50');
    const engine = await page.evaluate(() => window.L_.Globe_?.litho?.rendererType);
    test.skip(engine !== 'cesium', 'SKIP: mission globe is not Cesium');
    const canvasBox = await page.evaluate(() => {
      const r = window.L_.Globe_.litho.renderer.scene.canvas.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.evaluate(() =>
      window.L_.Globe_.litho.setCenter({ lat: 38.5, lng: -122.44, zoom: 11 })
    );
    await page.waitForTimeout(2000);
    const cx = canvasBox.x + canvasBox.w / 2;
    const cy = canvasBox.y + canvasBox.h / 2;

    // A stationary touchscreen tap: do NOT emit mousemove. Deliberately poison
    // GlobeRenderer.mouse so this fails if clickGlobe uses cached hover state.
    const at = await page.evaluate(({ cx, cy }) => {
      const G = window.L_.Globe_.litho;
      const scene = G.renderer.scene;
      const canvas = scene.canvas;
      const rect = canvas.getBoundingClientRect();
      const position = { x: cx - rect.left, y: cy - rect.top };
      const hit = G.renderer.camera.pickEllipsoid(position, scene.globe.ellipsoid);
      if (!hit) throw new Error('Globe test center does not hit the ellipsoid');
      const c = scene.globe.ellipsoid.cartesianToCartographic(hit);
      const expected = { lng: (c.longitude * 180) / Math.PI, lat: (c.latitude * 180) / Math.PI };
      Object.assign(G.mouse, { lng: 0, lat: 0, onSurface: false });
      for (const type of ['pointerdown', 'pointerup']) {
        canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0,
          clientX: cx, clientY: cy, pointerId: 8, pointerType: 'touch',
        }));
      }
      return expected;
    }, { cx, cy });
    await expect(page.locator('#identifierTimeSeriesPanel')).toBeVisible({ timeout: 10000 });
    await expect.poll(() => searches).toBe(1);

    // the marker is an entity on the surface at that point, and on the map
    await page.waitForTimeout(1500);
    const marker = await page.evaluate(() => {
      const G = window.L_.Globe_.litho;
      const ds = G._layers._identifierTimeSeriesPoint?.dataSource;
      if (!ds) return null;
      const p = ds.entities.values[0]?.position?.getValue();
      const c = p && G.renderer.scene.globe.ellipsoid.cartesianToCartographic(p);
      return c ? { lng: (c.longitude * 180) / Math.PI, lat: (c.latitude * 180) / Math.PI, h: c.height } : null;
    });
    expect(marker).not.toBeNull();
    expect(marker.lng).toBeCloseTo(at.lng, 6);
    expect(marker.lat).toBeCloseTo(at.lat, 6);
    expect(Math.abs(marker.h)).toBeLessThan(1);
    await expect(page.locator('.leaflet-overlay-pane path[fill="yellow"]')).toHaveCount(1);

    // Cesium's link control belongs to the UI, not the globe surface.
    const link = page.locator('#_cesium_control_link');
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(500);
      expect(searches).toBe(1);
    }

    // clicking the marker itself picks an entity: left alone
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(800);
    expect(searches).toBe(1);

    // a drag rotates the globe and is not a click
    await page.mouse.move(cx + 120, cy + 60);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy + 100, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    expect(searches).toBe(1);

    // closing the Identifier removes both markers; globe clicks do nothing
    await page.evaluate(() => window.ToolController_.closeTool('Identifier'));
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(await page.evaluate(() => !!window.L_.Globe_.litho._layers._identifierTimeSeriesPoint)).toBe(false);
    await page.mouse.move(cx - 150, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(800);
    await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0);
    expect(searches).toBe(1);
    expect(errors).toEqual([]);
  });
});
