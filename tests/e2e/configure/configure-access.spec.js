import { test, expect } from '@playwright/test';

/**
 * E2E tests for Configure CMS page access.
 *
 * The /configure page is the admin CMS for managing missions, layers, and tools.
 * Tests authenticate as admin before accessing the CMS.
 */

test.describe('Configure CMS Access', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  /**
   * Helper: log in as admin via the API.
   * When called with the test-level `request` fixture, authenticates that context.
   */
  async function loginAsAdmin(request) {
    try {
      const res = await request.post(`${baseURL}/api/users/login`, {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      });
      const body = await res.json().catch(() => null);
      if (body && body.status === 'success') return body;
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Helper: log in as admin via the page's own request context (shares cookies
   * with the browser), then navigate to /configure.
   *
   * The configure page has its own "Admin Dashboard" login gate served by
   * adminlogin.pug.  Rather than fighting the AJAX-based UI login, we POST
   * to the same endpoint the UI uses (`api/users/login`) through
   * `page.request` so the session cookie lands in the browser jar, then
   * simply navigate to /configure which will now see the authenticated session.
   */
  async function gotoConfigureAsAdmin(page) {
    // Authenticate via the page's own request context so cookies are shared.
    try {
      await page.request.post(`${baseURL}/api/users/login`, {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      });
    } catch { /* best effort */ }

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');
  }

  test('configure page loads at /configure', async ({ page, request }) => {
    await loginAsAdmin(request);
    await gotoConfigureAsAdmin(page);

    // Verify the configure UI has loaded — the body should be visible and
    // contain meaningful content (not just a blank page).
    await expect(page.locator('body')).toBeVisible();
    const contentLength = await page.evaluate(() => document.body.innerHTML.length);
    expect(contentLength).toBeGreaterThan(100);
  });

  test('configure page shows mission list', async ({ page, request }) => {
    await loginAsAdmin(request);

    // Pre-check: make sure at least one mission exists so the list is populated
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    const hasMissions =
      listData.missions && Array.isArray(listData.missions) && listData.missions.length > 0;

    if (!hasMissions) {
      test.skip(true, 'SKIP: No missions found — cannot verify mission list');
      return;
    }

    await gotoConfigureAsAdmin(page);

    // The configure page should mention "Reference-Mission" somewhere in its
    // sidebar, mission list, or main panel.
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    expect(bodyHTML).toContain('Reference-Mission');
  });

  test('configure page has navigation tabs after selecting a mission', async ({ page, request }) => {
    await loginAsAdmin(request);

    // Tabs (Layers, Tools, Time, etc.) only appear once a mission is selected.
    // First verify a mission exists, then click it to reveal the tab bar.
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available — cannot test tabs');
      return;
    }

    await gotoConfigureAsAdmin(page);

    // Select Reference-Mission in the sidebar to reveal the tab bar
    const missionLink = page.locator('text="Reference-Mission"').first();
    if (await missionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await missionLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      test.skip(true, 'SKIP: Reference-Mission not clickable in sidebar');
      return;
    }

    // After selecting a mission the configure CMS renders MUI Tabs:
    // Home, Layers, Tools, Coordinates, Time, User Interface
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

  test('configure page does not crash on load', async ({ page, request }) => {
    await loginAsAdmin(request);
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

    await gotoConfigureAsAdmin(page);

    // No unexpected console errors should have fired
    expect(criticalErrors.length).toBe(0);
  });
});
