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

  // ---------------------------------------------------------------------------
  // Test 8 — `{time}` placeholder preserved as literal in layer.url after
  // reload (regression: captureVector previously handled `{time}` directly,
  // but once it was gated on `!hasResolvedUrl` the replacement had to migrate
  // into TimeControl.reloadLayer's resolved-URL block).
  // ---------------------------------------------------------------------------
  test('reloadLayer preserves literal {time} placeholder in layer.url', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    const templateUrl = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return null;
      const layer = L_.layers.data[k];
      const original = `${layer.url}?at={time}`;
      layer.url = original;
      layer.time = layer.time || {};
      layer.time.type = 'global';
      layer.time.enabled = true;
      layer.time.start = layer.time.start || '2024-01-01T00:00:00Z';
      layer.time.end = layer.time.end || '2024-01-20T00:00:00Z';
      return original;
    }, 'Geodatasets - Time Series');

    expect(templateUrl).toContain('{time}');

    await page.evaluate(async () => {
      await window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
    });

    const urlAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      return k ? L_.layers.data[k].url : null;
    }, 'Geodatasets - Time Series');

    // Template must remain on the layer; the fetch URL is resolved
    // independently inside captureVector.
    expect(urlAfter).toContain('{time}');
  });

  // ---------------------------------------------------------------------------
  // Test 9 — time.type=local with endProp==null still gets placeholders
  // resolved in the outgoing request (this branch bypasses the in-
  // TimeControl resolved-URL replacement; captureVector must handle it).
  // ---------------------------------------------------------------------------
  test('local time.type with null endProp still resolves placeholders in outgoing fetch', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return;
      const layer = L_.layers.data[k];
      // Force the "local + endProp==null" branch in TimeControl.reloadLayer
      // (TimeControl.js:276-287). This branch falls through to the else block
      // which calls refreshLayer with a resolvedUrl that has NOT been
      // placeholder-replaced — so captureVector must do the replacement.
      layer.url = `${layer.url}?from={starttime}&to={endtime}`;
      layer.time = layer.time || {};
      layer.time.type = 'local';
      layer.time.enabled = true;
      layer.time.endProp = null;
      layer.time.start = layer.time.start || '2024-01-01T00:00:00Z';
      layer.time.end = layer.time.end || '2024-01-20T00:00:00Z';
    }, 'Geodatasets - Time Series');

    // Capture outgoing geodataset requests during the reload window.
    const capturedRequests = [];
    const onRequest = (req) => {
      const u = req.url();
      if (u.includes('/geodatasets/') || u.includes('geodatasets_get')) {
        capturedRequests.push(u);
      }
    };
    page.on('request', onRequest);

    await page.evaluate(async () => {
      await window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
    });
    await page.waitForTimeout(750);
    page.off('request', onRequest);

    // If no geodataset request was issued at all the test environment
    // probably skipped the fetch — skip rather than fail spuriously.
    if (capturedRequests.length === 0) {
      test.skip(true, 'SKIP: no geodataset request observed during reload window');
      return;
    }

    // Combine all observed request URLs into a single string for the
    // assertion. None of them should contain a literal placeholder.
    const combined = capturedRequests.join('\n');
    expect(combined).not.toContain('{starttime}');
    expect(combined).not.toContain('{endtime}');
    expect(combined).not.toContain('{time}');
  });

  // ---------------------------------------------------------------------------
  // Test 10 — Stress: 20 rapid reloads coalesce without dropping or
  // mutating the URL template.
  // ---------------------------------------------------------------------------
  test('20 rapid reloads of the same layer all complete and preserve template', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    const templateUrl = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return null;
      const layer = L_.layers.data[k];
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

    const droppedWarnings = [];
    const onConsole = (msg) => {
      const t = msg.type();
      if ((t === 'warning' || t === 'error') && msg.text().includes('Cannot make layer')) {
        droppedWarnings.push(msg.text());
      }
    };
    page.on('console', onConsole);

    const results = await page.evaluate(async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(window.mmgisAPI.reloadLayer('Geodatasets - Time Series'));
      }
      return Promise.all(promises);
    });

    // Allow the setTimeout(0)-based queue drain to complete fully.
    await page.waitForTimeout(2000);
    page.off('console', onConsole);

    expect(results).toHaveLength(20);
    for (const r of results) expect(r).not.toBe(false);

    expect(
      droppedWarnings,
      `Reloads were silently dropped:\n${droppedWarnings.join('\n')}`
    ).toHaveLength(0);

    const urlAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      return k ? L_.layers.data[k].url : null;
    }, 'Geodatasets - Time Series');

    expect(urlAfter).toContain('{starttime}');
    expect(urlAfter).toContain('{endtime}');
  });

  // ---------------------------------------------------------------------------
  // Test 11 — User-visible symptom: features remain rendered after a burst
  // of concurrent reloads (no "gaps where dynamically-appearing data
  // doesn't show up" — the original bug report).
  // ---------------------------------------------------------------------------
  test('layer features remain rendered after concurrent reloads of the same layer', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(2000);

    const countBefore = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return -1;
      const lyr = L_.layers.layer[k];
      if (!lyr) return 0;
      if (typeof lyr.getLayers === 'function') return lyr.getLayers().length;
      return 0;
    }, 'Geodatasets - Time Series');

    // countBefore can be 0 if the dataset returns no rows in the current
    // viewport/time range — in that case the post-reload count comparison
    // isn't meaningful, so skip.
    if (countBefore <= 0) {
      test.skip(true, `SKIP: layer has no features pre-reload (count=${countBefore})`);
      return;
    }

    await page.evaluate(async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(window.mmgisAPI.reloadLayer('Geodatasets - Time Series'));
      }
      await Promise.all(promises);
    });
    // Allow queued drain + fetch + redraw to complete
    await page.waitForTimeout(2500);

    const countAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return -1;
      const lyr = L_.layers.layer[k];
      if (!lyr) return 0;
      if (typeof lyr.getLayers === 'function') return lyr.getLayers().length;
      return 0;
    }, 'Geodatasets - Time Series');

    // The layer should still have features after the burst — not zero
    // (which is what the original "gap" symptom looked like).
    expect(countAfter).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test 12 — `{customtime.N}` placeholder preserved on layer.url after reload.
  // The customtime replacement loop in TimeControl.reloadLayer was migrated
  // off `layer.url = ...` onto a local `resolvedUrl = ...`; this test asserts
  // the template on the shared layer object stays intact afterwards.
  // ---------------------------------------------------------------------------
  test('reloadLayer preserves literal {customtime.0} placeholder in layer.url', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    const templateUrl = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const TimeControl = window.TimeControl || window.mmgisAPI?._TimeControl;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      if (!k) return null;
      const layer = L_.layers.data[k];
      const original = `${layer.url}?at={customtime.0}`;
      layer.url = original;
      layer.time = layer.time || {};
      layer.time.type = 'global';
      layer.time.enabled = true;
      layer.time.start = layer.time.start || '2024-01-01T00:00:00Z';
      layer.time.end = layer.time.end || '2024-01-20T00:00:00Z';
      // Seed TimeControl.customTimes so the customtime replacement loop runs
      // unconditionally — without this the loop is skipped entirely and the
      // placeholder stays as-is for an uninteresting reason.
      if (TimeControl) {
        TimeControl.customTimes = TimeControl.customTimes || {};
        TimeControl.customTimes.times = ['2024-06-15T12:00:00Z'];
      }
      return original;
    }, 'Geodatasets - Time Series');

    expect(templateUrl).toContain('{customtime.0}');

    await page.evaluate(async () => {
      await window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
    });

    const urlAfter = await page.evaluate((layerName) => {
      const L_ = window.L_;
      const k = Object.keys(L_.layers.data).find((kk) => {
        const l = L_.layers.data[kk];
        return l && (l.name === layerName || l.display_name === layerName);
      });
      return k ? L_.layers.data[k].url : null;
    }, 'Geodatasets - Time Series');

    expect(urlAfter).toContain('{customtime.0}');
  });

  // ---------------------------------------------------------------------------
  // Test 13 — `mmgisAPI.reloadTimeLayers()` returns a thenable. This is a
  // backward-incompatible behavior change from the previous synchronous return
  // — documented in docs/pages/APIs/JavaScript/Main/Main.md but worth pinning
  // with a test so the contract doesn't silently regress in either direction.
  // ---------------------------------------------------------------------------
  test('mmgisAPI.reloadTimeLayers returns a Promise that resolves to an array', async ({ page }) => {
    const info = await page.evaluate(async () => {
      const ret = window.mmgisAPI.reloadTimeLayers();
      const isThenable = !!(ret && typeof ret.then === 'function');
      const awaited = await ret;
      return {
        isThenable,
        isArray: Array.isArray(awaited),
        length: Array.isArray(awaited) ? awaited.length : null,
      };
    });
    expect(info.isThenable).toBe(true);
    expect(info.isArray).toBe(true);
    expect(info.length).toBeGreaterThanOrEqual(0);
  });

  // ---------------------------------------------------------------------------
  // Test 14 — `mmgisAPI.reloadLayers` handles an invalid layer name without
  // rejecting. `Promise.allSettled` semantics must surface the failure as
  // `false` in the returned array, in the same position as the input name.
  // ---------------------------------------------------------------------------
  test('mmgisAPI.reloadLayers returns false (not throw) for unknown layer names', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const realLayer = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!realLayer) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    const result = await page.evaluate(async () => {
      // Wrap in try/catch so a rejection surfaces as an explicit shape
      // (Playwright's evaluate returns rejection as an exception).
      try {
        const arr = await window.mmgisAPI.reloadLayers([
          'Geodatasets - Time Series',
          '__no_such_layer__',
          'Geodatasets - Time Series',
        ]);
        return { ok: true, arr };
      } catch (e) {
        return { ok: false, err: String(e && e.message ? e.message : e) };
      }
    });

    expect(result.ok, `reloadLayers threw: ${result.err}`).toBe(true);
    expect(Array.isArray(result.arr)).toBe(true);
    expect(result.arr).toHaveLength(3);
    // Real layers should not return false; the unknown name must return false.
    expect(result.arr[0]).not.toBe(false);
    expect(result.arr[1]).toBe(false);
    expect(result.arr[2]).not.toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 15 — Reloading a time-DISABLED vector layer is a no-op for the URL
  // template (no replacement work was ever expected for these, but the
  // mutate-in-place fix must not have accidentally introduced new mutations
  // for layers that opted out of time).
  // ---------------------------------------------------------------------------
  test('reloadLayer on a time-disabled vector layer leaves layer.url unchanged', async ({ page }) => {
    // Pick any vector layer without time. The Reference Mission's geometry
    // layers (e.g., "Points Basic") fit this category.
    const candidate = await page.evaluate(() => {
      const L_ = window.L_;
      for (const k of Object.keys(L_.layers.data)) {
        const l = L_.layers.data[k];
        if (
          l &&
          l.type === 'vector' &&
          (!l.time || l.time.enabled !== true) &&
          l.url
        ) {
          return { key: k, name: l.name, display_name: l.display_name, url: l.url };
        }
      }
      return null;
    });

    if (!candidate) test.skip(true, 'SKIP: no time-disabled vector layer with a URL found');

    // Toggle on (if needed) so the reload code path actually runs.
    await ensureLayerOn(page, candidate.display_name || candidate.name);
    await page.waitForTimeout(1000);

    const before = await page.evaluate((k) => window.L_.layers.data[k].url, candidate.key);

    const result = await page.evaluate(async (name) => {
      try {
        const r = await window.mmgisAPI.reloadLayer(name);
        return { ok: true, r };
      } catch (e) {
        return { ok: false, err: String(e && e.message ? e.message : e) };
      }
    }, candidate.display_name || candidate.name);

    const after = await page.evaluate((k) => window.L_.layers.data[k].url, candidate.key);

    expect(result.ok, `reloadLayer threw for time-disabled vector: ${result.err}`).toBe(true);
    expect(after).toBe(before);
  });

  // ---------------------------------------------------------------------------
  // Test 16a — Lock-release invariant. `L_._layersBeingMade[key]` MUST be
  // `false` after every reload completes (success OR caught exception). If
  // the try/finally wrapper in `makeLayer` ever regresses to a bare release
  // path, this test catches it — accidental lock retention would silently
  // jam all future reloads for the layer.
  // ---------------------------------------------------------------------------
  test('_layersBeingMade lock is released after single and concurrent reloads', async ({ page }) => {
    await layersPanel.expandGroup('Geodatasets').catch(() => {});
    await page.waitForTimeout(300);

    const key = await ensureLayerOn(page, 'Geodatasets - Time Series');
    if (!key) test.skip(true, 'SKIP: Geodatasets - Time Series not present in mission');
    await page.waitForTimeout(1500);

    // --- single reload ---
    const lockAfterSingle = await page.evaluate(async (k) => {
      await window.mmgisAPI.reloadLayer('Geodatasets - Time Series');
      // Allow the queue drain's setTimeout(0) to fire so the lock truly
      // settles to its final value.
      await new Promise((r) => setTimeout(r, 100));
      return window.L_._layersBeingMade?.[k] === true;
    }, key);
    expect(lockAfterSingle, '_layersBeingMade should be false (not true) after a single reload').toBe(false);

    // --- 5 concurrent reloads ---
    const lockAfterBurst = await page.evaluate(async (k) => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(window.mmgisAPI.reloadLayer('Geodatasets - Time Series'));
      }
      await Promise.all(promises);
      // Give the queue drain time to complete (setTimeout(0) + any
      // in-flight makeLayer awaits).
      await new Promise((r) => setTimeout(r, 1000));
      return window.L_._layersBeingMade?.[k] === true;
    }, key);
    expect(lockAfterBurst, '_layersBeingMade should be false (not true) after a burst of concurrent reloads').toBe(false);

    // --- queue should also be empty (otherwise a future reload would
    //     trigger an immediate drain instead of doing its own work) ---
    const queueEmpty = await page.evaluate(() => {
      const q = window.L_._layerReloadQueue || {};
      return Object.keys(q).length === 0;
    });
    expect(queueEmpty, '_layerReloadQueue should be empty after the burst settles').toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 16 — Robustness: `mmgisAPI.reloadLayers` handles empty array and
  // non-array inputs gracefully (returns `[]` instead of throwing).
  // ---------------------------------------------------------------------------
  test('mmgisAPI.reloadLayers returns [] for empty array and non-array inputs', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const out = {};
      try {
        out.empty = await window.mmgisAPI.reloadLayers([]);
      } catch (e) {
        out.empty = { __threw__: String(e && e.message ? e.message : e) };
      }
      try {
        out.nullArg = await window.mmgisAPI.reloadLayers(null);
      } catch (e) {
        out.nullArg = { __threw__: String(e && e.message ? e.message : e) };
      }
      try {
        out.undefArg = await window.mmgisAPI.reloadLayers(undefined);
      } catch (e) {
        out.undefArg = { __threw__: String(e && e.message ? e.message : e) };
      }
      try {
        out.stringArg = await window.mmgisAPI.reloadLayers('not-an-array');
      } catch (e) {
        out.stringArg = { __threw__: String(e && e.message ? e.message : e) };
      }
      return out;
    });

    expect(Array.isArray(results.empty)).toBe(true);
    expect(results.empty).toHaveLength(0);

    expect(Array.isArray(results.nullArg)).toBe(true);
    expect(results.nullArg).toHaveLength(0);

    expect(Array.isArray(results.undefArg)).toBe(true);
    expect(results.undefArg).toHaveLength(0);

    expect(Array.isArray(results.stringArg)).toBe(true);
    expect(results.stringArg).toHaveLength(0);
  });
});
