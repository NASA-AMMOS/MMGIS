import { test, expect } from '@playwright/test';

/**
 * Page-load performance tests for MMGIS.
 *
 * Measures time-to-interactive, JS error count during boot, tile appearance,
 * and (where supported) JS heap size.
 */

const MISSION_URL = '/?mission=Reference-Mission';

/** Helper: check whether the Reference-Mission is available; skip if not. */
async function ensureMissionAvailable(request, testCtx) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

test.describe('Page Load Performance', () => {
  test('page loads within 30 seconds', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    const start = Date.now();
    await page.goto(MISSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    const elapsed = Date.now() - start;

    // Generous CI threshold
    expect(elapsed).toBeLessThan(30000);
  });

  test('time to first meaningful paint is reasonable', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const navTiming = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length === 0) return null;
      const nav = entries[0];
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadComplete: nav.loadEventEnd - nav.startTime,
        domInteractive: nav.domInteractive - nav.startTime,
      };
    });

    // Navigation timing may not be available in every browser
    if (navTiming) {
      // domContentLoaded should fire within 30 s for CI
      expect(navTiming.domContentLoaded).toBeLessThan(30000);
      expect(navTiming.domInteractive).toBeGreaterThan(0);
    }
  });

  test('no JavaScript errors during initial load', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(MISSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Filter out known benign MMGIS errors that occur during normal initialization
    const critical = jsErrors.filter(
      (msg) =>
        !msg.includes('Cannot set properties of null') &&
        !msg.includes('Cannot read properties of null') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR') &&
        !msg.includes('404')
    );
    expect(critical).toEqual([]);
  });

  test('map tiles appear after load', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait for at least one tile image to be present in .leaflet-tile-pane
    const tilesAppeared = await page.waitForFunction(
      () => {
        const pane = document.querySelector('.leaflet-tile-pane');
        if (!pane) return false;
        return pane.querySelectorAll('img').length > 0;
      },
      { timeout: 30000 },
    ).then(() => true).catch(() => false);

    expect(tilesAppeared).toBe(true);
  });

  test('memory usage stays within threshold', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const memory = await page.evaluate(() => {
      // performance.memory is a non-standard Chromium extension
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (!memory) {
      test.skip(true, 'SKIP: performance.memory not available in this browser');
      return;
    }

    // Heap should stay below 512 MB — very generous for CI
    const MB = 1024 * 1024;
    expect(memory.usedJSHeapSize).toBeLessThan(512 * MB);
  });
});
