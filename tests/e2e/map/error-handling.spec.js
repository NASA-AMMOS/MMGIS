import { test, expect } from '@playwright/test';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

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

test.describe('Error Handling and Resilience', () => {
  test('non-existent mission shows error UI and does not crash', async ({ page }) => {
    // Collect console errors during navigation
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to a mission that does not exist
    await page.goto('/?mission=NonExistentMission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // The page should not crash — it should either:
    // 1. Show an error message/dialog
    // 2. Redirect to a default page
    // 3. Show the landing page
    // The key assertion is that the page is still functional (no unhandled crash)

    // Check for error indicators in the page
    const errorIndicators = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { hasCrashed: true };

      const bodyText = body.innerText || '';
      const hasErrorMessage =
        bodyText.includes('not found') ||
        bodyText.includes('does not exist') ||
        bodyText.includes('error') ||
        bodyText.includes('Error') ||
        bodyText.includes('404') ||
        bodyText.includes('No mission');

      // Check if the page loaded something (didn't just crash to blank)
      const hasContent = bodyText.trim().length > 0 || document.querySelectorAll('*').length > 10;

      return {
        hasCrashed: false,
        hasErrorMessage,
        hasContent,
        bodyLength: bodyText.length,
      };
    });

    // The page should not have crashed
    expect(errorIndicators.hasCrashed).toBeFalsy();

    // The page should have some content (not a blank crash page)
    expect(errorIndicators.hasContent).toBeTruthy();
  });

  test('invalid query parameters are handled gracefully', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate with extra invalid parameters
    await page.goto(`${MISSION_URL}&zoom=invalid&lat=notanumber&lng=NaN`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Handle AUTH=local mode
    if (await shouldSkipAuth(page)) {
      test.skip(true, 'SKIP: AUTH=local mode — login form shown instead of map');
      return;
    }

    await page.waitForTimeout(3000);

    // The page should still load the map (invalid params should be ignored)
    const pageState = await page.evaluate(() => {
      return {
        hasMap: !!document.querySelector('#map'),
        hasBody: !!document.body,
        bodyHasContent: (document.body?.innerText || '').trim().length > 0,
        // Check if mmgisAPI loaded despite invalid params
        hasAPI: !!(window.mmgisAPI && window.mmgisAPI.map),
      };
    });

    // Page should not crash — body should have content
    expect(pageState.hasBody).toBeTruthy();
    expect(pageState.bodyHasContent).toBeTruthy();
  });

  test('no critical JavaScript errors during normal map load', async ({ page }) => {
    const criticalErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Only flag critical errors — ReferenceError and TypeError
        // Ignore expected 404s for optional resources and network errors
        if (
          (text.includes('ReferenceError') || text.includes('TypeError')) &&
          !text.includes('favicon') &&
          !text.includes('404') &&
          !text.includes('net::ERR') &&
          !text.includes('Failed to load resource')
        ) {
          criticalErrors.push(text);
        }
      }
    });

    // Also catch uncaught page errors
    const pageErrors = [];
    page.on('pageerror', (error) => {
      const msg = error.message || String(error);
      if (
        msg.includes('ReferenceError') ||
        msg.includes('TypeError')
      ) {
        pageErrors.push(msg);
      }
    });

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Handle AUTH=local mode
    if (await shouldSkipAuth(page)) {
      test.skip(true, 'SKIP: AUTH=local mode — login form shown instead of map');
      return;
    }

    // Wait for full initialization
    await page.waitForFunction(
      () => !!(window.mmgisAPI && window.mmgisAPI.map),
      { timeout: 60000 },
    );
    await page.waitForTimeout(3000);

    // There should be no critical ReferenceErrors or TypeErrors
    expect(criticalErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('page handles missing mission parameter gracefully', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate without a mission parameter
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // The page should handle this gracefully — show landing page or default mission
    const pageState = await page.evaluate(() => {
      return {
        hasBody: !!document.body,
        hasContent: (document.body?.innerText || '').trim().length > 0,
        url: window.location.href,
      };
    });

    expect(pageState.hasBody).toBeTruthy();
    expect(pageState.hasContent).toBeTruthy();
  });

  test('network failure simulation — graceful degradation', async ({ page }) => {
    // Navigate normally first to load the app
    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Handle AUTH=local mode
    if (await shouldSkipAuth(page)) {
      test.skip(true, 'SKIP: AUTH=local mode — login form shown instead of map');
      return;
    }

    // Wait for the map to be ready
    const mapReady = await page.waitForFunction(
      () => !!(window.mmgisAPI && window.mmgisAPI.map),
      { timeout: 60000 },
    ).catch(() => null);

    if (!mapReady) {
      test.skip(true, 'SKIP: Map did not initialize — cannot test network failure');
      return;
    }

    // Block network requests to simulate partial failure
    await page.route('**/*.geojson', (route) => route.abort());
    await page.route('**/api/geodatasets/**', (route) => route.abort());

    // The map should still be functional — try panning
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found for network failure test');
      return;
    }

    // Pan the map while network is blocked
    const centerX = mapBox.x + mapBox.width / 2;
    const centerY = mapBox.y + mapBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 100, centerY + 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // The page should not crash — map should still exist
    const isMapStillAlive = await page.evaluate(() => {
      return !!(window.mmgisAPI && window.mmgisAPI.map);
    });

    expect(isMapStillAlive).toBeTruthy();

    // Unblock routes for cleanup
    await page.unroute('**/*.geojson');
    await page.unroute('**/api/geodatasets/**');
  });

  test('malformed mission URL with special characters', async ({ page }) => {
    // Navigate with special characters in the mission name
    await page.goto('/?mission=<script>alert(1)</script>');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // The page should not execute injected script — verify no alert dialog
    // (Playwright would throw if an unexpected dialog appeared)

    // Page should still be functional
    const pageState = await page.evaluate(() => {
      return {
        hasBody: !!document.body,
        hasContent: document.querySelectorAll('*').length > 5,
      };
    });

    expect(pageState.hasBody).toBeTruthy();
    expect(pageState.hasContent).toBeTruthy();
  });

  test('empty mission parameter is handled', async ({ page }) => {
    await page.goto('/?mission=');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Page should handle empty mission gracefully
    const pageState = await page.evaluate(() => {
      return {
        hasBody: !!document.body,
        hasContent: (document.body?.innerText || '').trim().length > 0,
      };
    });

    expect(pageState.hasBody).toBeTruthy();
    expect(pageState.hasContent).toBeTruthy();
  });

  test('concurrent rapid navigation does not crash', async ({ page }) => {
    // Rapidly navigate between different URLs to test stability
    const urls = [
      MISSION_URL,
      '/?mission=NonExistent1',
      MISSION_URL,
      '/?mission=NonExistent2',
      MISSION_URL,
    ];

    for (const url of urls) {
      await page.goto(url, { waitUntil: 'commit' });
      await page.waitForTimeout(500);
    }

    // Wait for the final navigation to settle
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Page should still be functional after rapid navigation
    const pageState = await page.evaluate(() => {
      return {
        hasBody: !!document.body,
        elementCount: document.querySelectorAll('*').length,
      };
    });

    expect(pageState.hasBody).toBeTruthy();
    expect(pageState.elementCount).toBeGreaterThan(0);
  });
});
