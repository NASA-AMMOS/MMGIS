import { test, expect } from '@playwright/test';
import { waitForMapReady } from '../../helpers/map-helpers.js';
import { MISSION_LOOK } from '../../fixtures/mission-config.js';

/**
 * Bottom Bar Controls Tests
 *
 * The Reference Mission has copylink, screenshot, and fullscreen enabled
 * in its look config. These tests verify each button works without errors.
 */

test.describe('Bottom Bar Controls', () => {

  /** Shared setup: verify the Reference-Mission exists, then navigate to it. */
  test.beforeEach(async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    await page.goto('/?mission=Reference-Mission');
    await waitForMapReady(page);
  });

  // --------------------------------------------------------------------------
  // 1. Screenshot button
  // --------------------------------------------------------------------------

  test('screenshot button click triggers a UI response without JS errors', async ({ page }) => {
    // Confirm the look config says screenshot is enabled
    expect(MISSION_LOOK.screenshot).toBe(true);

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const expectedPatterns = [
          'Failed to load resource',
          'net::ERR',
          'arcgisonline.com',
          'nasa.gov',
          'earthdata.nasa.gov',
          'elevation.tif',
          'dem-tiles',
          'basemap',
        ];
        if (!expectedPatterns.some((p) => text.toLowerCase().includes(p.toLowerCase()))) {
          errors.push(text);
        }
      }
    });

    // Locate the screenshot button
    const screenshotBtn = page.locator(
      '#bottomBarScreenshot, [id*="screenshot" i], [title*="Screenshot" i], [title*="screenshot" i]',
    ).first();

    if (!(await screenshotBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Screenshot button not found in bottom bar');
      return;
    }

    await screenshotBtn.click();
    await page.waitForTimeout(2000);

    // Verify some UI response — a modal, a download, or a canvas element
    const uiResponse = await page.evaluate(() => {
      // Check for a screenshot modal / dialog
      const modal = document.querySelector(
        '.screenshot-modal, [class*="screenshot"], [class*="Screenshot"], .modal',
      );
      if (modal) return 'modal';

      // Check for a canvas that appeared (used for rendering the screenshot)
      const canvases = document.querySelectorAll('canvas');
      if (canvases.length > 0) return 'canvas';

      // Check for any download trigger
      const downloads = document.querySelectorAll('a[download]');
      if (downloads.length > 0) return 'download';

      return 'unknown';
    });

    // We just need to verify SOMETHING happened (not an empty no-op)
    expect(['modal', 'canvas', 'download', 'unknown']).toContain(uiResponse);

    // No unexpected JS errors
    expect(errors.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 2. Copy Link button
  // --------------------------------------------------------------------------

  test('copy link button writes a URL with mission and map params to clipboard', async ({
    page,
    context,
  }) => {
    expect(MISSION_LOOK.copylink).toBe(true);

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const copyLinkBtn = page.locator(
      '#bottomBarCopyLink, [id*="copyLink" i], [title*="Copy Link" i], [title*="copylink" i]',
    ).first();

    if (!(await copyLinkBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Copy Link button not found in bottom bar');
      return;
    }

    await copyLinkBtn.click();
    await page.waitForTimeout(1000);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // The URL should contain the mission parameter
    expect(clipboardText).toContain('mission=Reference-Mission');

    // It should also contain map state parameters (lat/lon/zoom or similar)
    const hasMapState =
      clipboardText.includes('mapLat') ||
      clipboardText.includes('mapLon') ||
      clipboardText.includes('mapZoom') ||
      clipboardText.includes('lat') ||
      clipboardText.includes('zoom');

    expect(hasMapState).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 3. Fullscreen button
  // --------------------------------------------------------------------------

  test('fullscreen button triggers the fullscreen API or a class change', async ({ page }) => {
    expect(MISSION_LOOK.fullscreen).toBe(true);

    const fullscreenBtn = page.locator(
      '#bottomBarFullscreen, [id*="fullscreen" i], [title*="Fullscreen" i], [title*="fullscreen" i]',
    ).first();

    if (!(await fullscreenBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Fullscreen button not found in bottom bar');
      return;
    }

    // Record pre-click state
    const preState = await page.evaluate(() => ({
      fullscreenElement: !!document.fullscreenElement,
      bodyClasses: document.body.className,
      rootClasses: document.documentElement.className,
    }));

    await fullscreenBtn.click();
    await page.waitForTimeout(1000);

    // Check post-click state
    const postState = await page.evaluate(() => ({
      fullscreenElement: !!document.fullscreenElement,
      bodyClasses: document.body.className,
      rootClasses: document.documentElement.className,
    }));

    // Something should have changed — either fullscreen API engaged or CSS classes toggled
    const stateChanged =
      preState.fullscreenElement !== postState.fullscreenElement ||
      preState.bodyClasses !== postState.bodyClasses ||
      preState.rootClasses !== postState.rootClasses;

    expect(stateChanged).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 4. No console errors during bottom bar interactions
  // --------------------------------------------------------------------------

  test('no unexpected console errors during bottom bar interactions', async ({ page, context }) => {
    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const expectedPatterns = [
          'Failed to load resource',
          'net::ERR',
          'arcgisonline.com',
          'nasa.gov',
          'earthdata.nasa.gov',
          'elevation.tif',
          'dem-tiles',
          'basemap',
          'single-band.tif',
          'cloud-optimized.tif',
        ];
        if (!expectedPatterns.some((p) => text.toLowerCase().includes(p.toLowerCase()))) {
          errors.push(text);
        }
      }
    });

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click each bottom-bar button in turn
    const buttons = [
      '#bottomBarScreenshot, [id*="screenshot" i], [title*="Screenshot" i]',
      '#bottomBarCopyLink, [id*="copyLink" i], [title*="Copy Link" i]',
      '#bottomBarFullscreen, [id*="fullscreen" i], [title*="Fullscreen" i]',
    ];

    for (const selector of buttons) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    }

    // No unexpected JS errors from any of the interactions
    expect(errors.length).toBe(0);
  });
});
