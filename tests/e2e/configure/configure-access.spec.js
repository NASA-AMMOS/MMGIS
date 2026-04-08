import { test, expect } from '@playwright/test';

/**
 * E2E tests for Configure CMS page access.
 *
 * The /configure page is the admin CMS for managing missions, layers, and tools.
 * In AUTH=local mode it requires authentication and redirects to a login page.
 * In AUTH=off mode it should be accessible without auth.
 */

test.describe('Configure CMS Access', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  /**
   * Helper: detect whether the current page is showing the login screen
   * (AUTH=local mode) rather than the configure UI.
   */
  async function isLoginPage(page) {
    const title = await page.title().catch(() => '');
    if (title.toLowerCase().includes('login')) return true;

    // Some builds render a login form without changing the title
    const hasLoginForm = await page
      .locator('input[type="password"], form[action*="login"], [class*="login"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    return hasLoginForm;
  }

  test('configure page loads at /configure', async ({ page }) => {
    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    if (await isLoginPage(page)) {
      test.skip(true, 'SKIP: Configure requires auth — AUTH=local mode');
      return;
    }

    // Verify the configure UI has loaded — the body should be visible and
    // contain meaningful content (not just a blank page).
    await expect(page.locator('body')).toBeVisible();
    const contentLength = await page.evaluate(() => document.body.innerHTML.length);
    expect(contentLength).toBeGreaterThan(100);
  });

  test('configure page shows mission list', async ({ page, request }) => {
    // Pre-check: make sure at least one mission exists so the list is populated
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    const hasMissions =
      listData.missions && Array.isArray(listData.missions) && listData.missions.length > 0;

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    if (await isLoginPage(page)) {
      test.skip(true, 'SKIP: Configure requires auth — AUTH=local mode');
      return;
    }

    if (!hasMissions) {
      test.skip(true, 'SKIP: No missions found — cannot verify mission list');
      return;
    }

    // The configure page should mention "Reference-Mission" somewhere in its
    // sidebar, mission list, or main panel.
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    expect(bodyHTML).toContain('Reference-Mission');
  });

  test('configure page has navigation tabs', async ({ page }) => {
    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    if (await isLoginPage(page)) {
      test.skip(true, 'SKIP: Configure requires admin auth');
      return;
    }

    // The configure CMS exposes several tabs (Layers, Tools, Look/UserInterface,
    // Time, etc.) implemented as React tab components.
    const tabLabels = ['Layers', 'Tools'];
    let tabsFound = 0;

    for (const label of tabLabels) {
      const found = await page.evaluate((lbl) => {
        return document.body.innerHTML.includes(lbl);
      }, label);
      if (found) tabsFound++;
    }

    // At least one core tab should be visible
    expect(tabsFound).toBeGreaterThan(0);
  });

  test('configure page serves valid HTML', async ({ request }) => {
    const response = await request.get(`${baseURL}/configure`);
    expect(response.status()).toBeLessThan(500);

    const contentType = response.headers()['content-type'] || '';
    // Should return HTML (either the configure UI or a login page)
    expect(contentType).toMatch(/text\/html/i);
  });

  test('configure page does not crash on load', async ({ page }) => {
    const criticalErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected network / resource errors
        const ignoredPatterns = [
          'Failed to load resource',
          'net::ERR',
          'favicon',
          '404',
        ];
        const isIgnored = ignoredPatterns.some((p) =>
          text.toLowerCase().includes(p.toLowerCase()),
        );
        if (!isIgnored) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    if (await isLoginPage(page)) {
      test.skip(true, 'SKIP: Configure requires auth — AUTH=local mode');
      return;
    }

    // No unexpected console errors should have fired
    expect(criticalErrors.length).toBe(0);
  });
});
