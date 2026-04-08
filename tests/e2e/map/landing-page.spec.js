import { test, expect } from '@playwright/test';

/**
 * Landing Page / Mission Selection Tests
 *
 * Verify the mission-selection landing page behaviour, including listing
 * available missions, navigating into a mission, handling invalid mission
 * names, and the `forcelanding` parameter.
 */

test.describe('Landing Page — Mission Selection', () => {

  // --------------------------------------------------------------------------
  // 1. Landing page shows available missions
  // --------------------------------------------------------------------------

  test('navigating to / shows the landing page with Reference-Mission listed', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    // If MAIN_MISSION is set, the root URL redirects straight to a mission
    // instead of showing the landing page. Skip in that case.
    if (process.env.MAIN_MISSION) {
      test.skip(true, 'SKIP: MAIN_MISSION is set — root URL bypasses landing page');
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // The landing page should contain the text "Reference-Mission" or similar
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    expect(bodyHTML).toContain('Reference-Mission');
  });

  // --------------------------------------------------------------------------
  // 2. Clicking a mission navigates to /?mission=<name>
  // --------------------------------------------------------------------------

  test('clicking a mission on the landing page loads the map', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    if (process.env.MAIN_MISSION) {
      test.skip(true, 'SKIP: MAIN_MISSION is set — root URL bypasses landing page');
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Find and click the Reference-Mission link / card
    const missionLink = page.locator('a, button, [class*="mission"], [class*="Mission"]')
      .filter({ hasText: 'Reference-Mission' })
      .first();

    if (!(await missionLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Fallback: try clicking any element that contains "Reference-Mission"
      await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')];
        const target = els.find(
          (el) => el.textContent.trim() === 'Reference-Mission' && el.offsetParent !== null,
        );
        if (target) target.click();
      });
    } else {
      await missionLink.click();
    }

    // Wait for map mission page to load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // URL should contain the mission query parameter
    expect(page.url()).toContain('mission=Reference-Mission');

    // The map container should be present
    const mapVisible = await page.evaluate(() => {
      const mapEl = document.getElementById('map');
      return mapEl !== null;
    });
    expect(mapVisible).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 3. Invalid mission name → error / redirect, no crash
  // --------------------------------------------------------------------------

  test('navigating to an invalid mission shows an error without crashing', async ({ page }) => {
    const criticalErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const expectedPatterns = [
          'Failed to load resource',
          'net::ERR',
          '404',
          'NonExistentMission',
          'arcgisonline.com',
          'nasa.gov',
          'earthdata.nasa.gov',
        ];
        const isExpected = expectedPatterns.some((p) =>
          text.toLowerCase().includes(p.toLowerCase()),
        );
        if (!isExpected) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto('/?mission=NonExistentMission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // The page must NOT have thrown an unhandled exception (white screen of death)
    const bodyLength = await page.evaluate(() => document.body.innerHTML.length);
    expect(bodyLength).toBeGreaterThan(100);

    // Either an error message is shown, or we are redirected to the landing page
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText);

    const handledGracefully =
      url.includes('forcelanding') ||
      !url.includes('NonExistentMission') ||
      bodyText.toLowerCase().includes('error') ||
      bodyText.toLowerCase().includes('not found') ||
      bodyText.toLowerCase().includes('does not exist') ||
      bodyText.includes('Reference-Mission'); // redirected to landing

    expect(handledGracefully).toBeTruthy();

    // No unexpected JS errors
    expect(criticalErrors.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 4. ?forcelanding=true forces the landing page
  // --------------------------------------------------------------------------

  test('forcelanding=true shows the landing page even when MAIN_MISSION is set', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    await page.goto('/?forcelanding=true');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // The landing page should be visible — it typically lists available missions
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);

    // We expect to see mission names or a mission-selection UI
    const isLandingPage =
      bodyHTML.includes('Reference-Mission') ||
      bodyHTML.includes('mission') ||
      bodyHTML.includes('Mission');

    expect(isLandingPage).toBeTruthy();

    // The map container should NOT be loaded (we should be on the landing page)
    const hasMap = await page.evaluate(() => {
      const mapEl = document.getElementById('map');
      return mapEl && mapEl.classList.contains('leaflet-container');
    });
    expect(hasMap).toBeFalsy();
  });

  // --------------------------------------------------------------------------
  // 5. MAIN_MISSION env-dependent tests
  // --------------------------------------------------------------------------

  test('MAIN_MISSION redirects root to the configured mission', async ({ page }) => {
    test.skip(!process.env.MAIN_MISSION, 'SKIP: MAIN_MISSION env not set');

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // When MAIN_MISSION is set, the root URL should load that mission directly
    const url = page.url();
    const hasMap = await page.evaluate(() => {
      const mapEl = document.getElementById('map');
      return mapEl && mapEl.classList.contains('leaflet-container');
    });

    // Either we see the mission in the URL or the map is loaded
    expect(url.includes('mission=') || hasMap).toBeTruthy();
  });
});
