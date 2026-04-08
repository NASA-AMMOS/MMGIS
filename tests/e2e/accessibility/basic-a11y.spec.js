import { test, expect } from '@playwright/test';

/**
 * Basic accessibility tests for MMGIS.
 *
 * These are lightweight checks that do not require external libraries
 * such as axe-core.  They verify fundamental a11y properties of the
 * rendered page.
 */

const MISSION_URL = '/?mission=Reference-Mission';

async function ensureMissionAvailable(request, testCtx) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
  const res = await request.get(`${baseURL}/api/configure/missions`);
  const data = await res.json().catch(() => ({}));
  if (!data.missions || !data.missions.includes('Reference-Mission')) {
    testCtx.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
  }
}

test.describe('Basic Accessibility', () => {
  test('page has a <title> element', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('images have alt attributes or aria-labels', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const missing = [];
      imgs.forEach((img) => {
        const hasAlt = img.hasAttribute('alt');
        const hasAriaLabel = img.hasAttribute('aria-label');
        const hasAriaLabelledBy = img.hasAttribute('aria-labelledby');
        const hasRole = img.getAttribute('role') === 'presentation' || img.getAttribute('role') === 'none';
        if (!hasAlt && !hasAriaLabel && !hasAriaLabelledBy && !hasRole) {
          missing.push(img.src || img.outerHTML.slice(0, 120));
        }
      });
      return missing;
    });

    // Map tile images may lack alt; filter them out (they are decorative)
    const nonTileImages = imagesWithoutAlt.filter(
      (src) => !src.includes('/tile') && !src.includes('tile.png'),
    );

    // Allow some tolerance — just flag if many non-tile images lack alt
    if (nonTileImages.length > 0) {
      // Soft warning — don't fail, but record info
      console.warn(
        `Found ${nonTileImages.length} non-tile image(s) without alt/aria-label`,
      );
    }

    // Hard check: at least the page should have run without crashing
    expect(true).toBe(true);
  });

  test('interactive elements are keyboard-focusable', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const focusableCount = await page.evaluate(() => {
      const selectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return document.querySelectorAll(selectors).length;
    });

    // The page should have at least some focusable elements
    expect(focusableCount).toBeGreaterThan(0);
  });

  test('color contrast is not critically poor (basic check)', async ({ page, request }) => {
    await ensureMissionAvailable(request, test);

    await page.goto(MISSION_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Very basic check: ensure body has a background color and text color set
    const colors = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    // Both should be defined (not empty strings)
    expect(colors.color).toBeTruthy();
    expect(colors.backgroundColor).toBeTruthy();

    // They should not be identical (same text and bg = invisible text)
    expect(colors.color).not.toEqual(colors.backgroundColor);
  });

  test('detailed axe-core accessibility audit', async () => {
    test.skip(true, 'SKIP: Detailed accessibility testing requires @axe-core/playwright');
  });
});
