import { test, expect } from '@playwright/test';
import { waitForMapReady } from '../../helpers/map-helpers.js';
import { MissionPage } from '../../pages/MissionPage.js';
import { LayersPanelPage } from '../../pages/LayersPanelPage.js';
// MISSION_TIME is imported per the plan; even though we drive the Reference
// Mission (which already has time-enabled layers configured equivalently to
// MISSION_TIME) the import documents the dependency for future refactors.
// eslint-disable-next-line no-unused-vars
import { MISSION_MSV, MISSION_TIME } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;

/**
 * Detect AUTH=local mode by checking if the page shows a login form
 * instead of the map. Returns true if we should skip the test.
 */
async function shouldSkipAuth(page) {
  const loginForm = await page
    .locator('form[action*="login"], input[name="password"], #loginScreen')
    .count();
  return loginForm > 0;
}

/**
 * Ensure a time-enabled vector layer is toggled on, then return its
 * canonical key in `L_.layers.data` (UUID-keyed name).
 *
 * Falls back to skipping the test if the named layer is not present in
 * the active mission config — protects against fixture drift.
 */
async function ensureLayerOn(page, displayName) {
  return page.evaluate(async (name) => {
    const L_ = window.L_;
    if (!L_ || !L_.layers || !L_.layers.data) return null;
    let key = null;
    for (const k of Object.keys(L_.layers.data)) {
      const l = L_.layers.data[k];
      if (l && (l.name === name || l.display_name === name)) {
        key = k;
        break;
      }
    }
    if (!key) return null;
    if (!L_.layers.on[key]) {
      try {
        await L_.toggleLayer(L_.layers.data[key]);
      } catch (e) {
        // some layers throw during toggle but still flip state
      }
    }
    return key;
  }, displayName);
}

test.describe('Concurrent Layer Reload', () => {
  let missionPage;
  let layersPanel;

  test.beforeEach(async ({ page }) => {
    missionPage = new MissionPage(page);
    layersPanel = new LayersPanelPage(page);
    await page.goto(MISSION_URL);

    if (await shouldSkipAuth(page)) {
      test.skip(true, 'SKIP: AUTH=local mode — login form shown instead of map');
      return;
    }

    await waitForMapReady(page);

    // Open the Layers tool panel so groups can be expanded
    await missionPage.openTool('Layers');
    await page.waitForTimeout(500);
  });

  // ---------------------------------------------------------------------------
  // Test 1 — Baseline: reloadLayer for a single time-enabled layer
  // ---------------------------------------------------------------------------
  test('reloadLayer for a single time-enabled layer returns truthy and keeps features', async ({ page }) => {
    await layersPanel.expandGroup('Geometry Types').catch(() => {});
    await layersPanel.expandGroup('Time Tab').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Time-Enabled');
    if (!key) test.skip(true, 'SKIP: Time-Enabled layer not present in mission config');
    await page.waitForTimeout(1500);

    const result = await page.evaluate(async () => {
      return await window.mmgisAPI.reloadLayer('Time-Enabled');
    });
    expect(result).toBeTruthy();

    // After reload the layer should still be marked on and present in L_.layers.layer
    const stillThere = await page.evaluate(() => {
      const L_ = window.L_;
      const key = Object.keys(L_.layers.data).find((k) => {
        const l = L_.layers.data[k];
        return l && (l.name === 'Time-Enabled' || l.display_name === 'Time-Enabled');
      });
      return !!(key && L_.layers.on[key] && L_.layers.layer[key]);
    });
    expect(stillThere).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 2 — `reloadLayer` does not corrupt `layer.url` template placeholders
  // ---------------------------------------------------------------------------
  test('reloadLayer preserves {starttime}/{endtime} placeholders in layer.url', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series layer not present');
    await page.waitForTimeout(1500);

    // Inject placeholder URL and set time.type=global so the URL replacement
    // branch in TimeControl.reloadLayer runs. This is what exercises the
    // mutate-in-place bug.
    const templateUrl = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const key = Object.keys(L_.layers.data).find((k) => {
        const l = L_.layers.data[k];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!key) return null;
      const layer = L_.layers.data[key];
      const original = `${layer.url}?from={starttime}&to={endtime}`;
      layer.url = original;
      layer.time = layer.time || {};
      layer.time.type = 'global';
      layer.time.enabled = true;
      // Provide concrete start/end so the resolver has something to substitute
      layer.time.start = layer.time.start || '2024-01-01T00:00:00Z';
      layer.time.end = layer.time.end || '2024-01-20T00:00:00Z';
      return original;
    }, 'Geodatasets - Time Series');

    expect(templateUrl).toBeTruthy();
    expect(templateUrl).toContain('{starttime}');
    expect(templateUrl).toContain('{endtime}');

    // Kick off the reload and await its completion before reading the URL.
    await page.evaluate(async () => {
      await window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
    });

    const urlAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const key = Object.keys(L_.layers.data).find((k) => {
        const l = L_.layers.data[k];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      return key ? L_.layers.data[key].url : null;
    }, 'Geodatasets - Time Series');

    // Should still hold the placeholders, not the resolved 2024-01-01 values
    expect(urlAfter).toContain('{starttime}');
    expect(urlAfter).toContain('{endtime}');
  });

  // ---------------------------------------------------------------------------
  // Test 3 — Concurrent reload of DIFFERENT layers all complete
  // ---------------------------------------------------------------------------
  test('concurrent reload of different time-enabled layers all return truthy', async ({ page }) => {
    await layersPanel.expandGroup('Time Tab').catch(() => {});
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const layers = ['Time-Enabled', 'Time - Refresh Interval', 'Geodatasets - Time Series'];
    const presentKeys = [];
    for (const name of layers) {
      const key = await ensureLayerOn(page, name);
      if (key) presentKeys.push(name);
    }
    if (presentKeys.length < 2) test.skip(true, 'SKIP: needed multiple time-enabled layers in mission');
    await page.waitForTimeout(2000);

    const results = await page.evaluate(async (names) => {
      return await Promise.all(names.map((n) => window.mmgisAPI.reloadLayer(n)));
    }, presentKeys);

    expect(results.length).toBe(presentKeys.length);
    for (const r of results) {
      expect(r).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Rapid successive reloads of the SAME layer are queued, not dropped
  // ---------------------------------------------------------------------------
  test('rapid successive reloads of the same layer are not silently dropped', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    // Collect both console.warn and console.error since the lock-check warns
    // in refreshLayer and errors in makeLayer.
    const noisyMessages = [];
    const onConsole = (msg) => {
      const t = msg.type();
      if (t === 'warning' || t === 'error') {
        const text = msg.text();
        if (text.includes('Cannot make layer')) {
          noisyMessages.push(text);
        }
      }
    };
    page.on('console', onConsole);

    const results = await page.evaluate(async () => {
      const a = window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
      const b = window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
      return Promise.all([a, b]);
    });

    // Allow any queued console messages to flush
    await page.waitForTimeout(500);
    page.off('console', onConsole);

    expect(results.length).toBe(2);
    expect(results[0]).toBeTruthy();
    expect(results[1]).toBeTruthy();

    // No reload should have been silently dropped with a "Cannot make layer" warning
    expect(noisyMessages, `Unexpected lock-collision messages:\n${noisyMessages.join('\n')}`).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Test 5 — `layer.url` preserved after concurrent reloads of the same layer
  // ---------------------------------------------------------------------------
  test('layer.url preserved after concurrent reloads of the same layer', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    const templateUrl = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const key = Object.keys(L_.layers.data).find((k) => {
        const l = L_.layers.data[k];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!key) return null;
      const layer = L_.layers.data[key];
      const original = `${layer.url}?from={starttime}&to={endtime}`;
      layer.url = original;
      layer.time = layer.time || {};
      layer.time.type = 'global';
      layer.time.enabled = true;
      layer.time.start = layer.time.start || '2024-01-01T00:00:00Z';
      layer.time.end = layer.time.end || '2024-01-20T00:00:00Z';
      return original;
    }, 'Geodatasets - Time Series');

    expect(templateUrl).toContain('{starttime}');
    expect(templateUrl).toContain('{endtime}');

    await page.evaluate(async () => {
      const a = window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
      const b = window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
      await Promise.all([a, b]);
    });

    const urlAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const key = Object.keys(L_.layers.data).find((k) => {
        const l = L_.layers.data[k];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      return key ? L_.layers.data[key].url : null;
    }, 'Geodatasets - Time Series');

    expect(urlAfter).toContain('{starttime}');
    expect(urlAfter).toContain('{endtime}');
  });

  // ---------------------------------------------------------------------------
  // Test 6 — `reloadLayers` batch API works for multiple layers
  // ---------------------------------------------------------------------------
  test('mmgisAPI.reloadLayers returns an array of truthy results for each layer', async ({ page }) => {
    await layersPanel.expandGroup('Time Tab').catch(() => {});
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const layers = ['Time-Enabled', 'Time - Refresh Interval'];
    const presentLayers = [];
    for (const name of layers) {
      const key = await ensureLayerOn(page, name);
      if (key) presentLayers.push(name);
    }
    if (presentLayers.length < 2) test.skip(true, 'SKIP: needed two time-enabled layers');
    await page.waitForTimeout(2000);

    const results = await page.evaluate(async (names) => {
      if (typeof window.mmgisAPI.reloadLayers !== 'function') return null;
      return await window.mmgisAPI.reloadLayers(names);
    }, presentLayers);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(presentLayers.length);
    for (const r of results) {
      expect(r).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // Test 7 — `reloadLayers` exists on mmgisAPI
  // ---------------------------------------------------------------------------
  test('mmgisAPI exposes a reloadLayers function', async ({ page }) => {
    const info = await page.evaluate(() => ({
      hasMethod: 'reloadLayers' in window.mmgisAPI,
      isFunction: typeof window.mmgisAPI.reloadLayers === 'function',
    }));
    expect(info.hasMethod).toBe(true);
    expect(info.isFunction).toBe(true);
  });
});
