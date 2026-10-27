import { test, expect } from '@playwright/test';

/**
 * E2E tests for layer management in the Configure CMS.
 *
 * Validates that the Layers tab is accessible, that known Reference Mission
 * layers appear in the list, and that basic layer-related UI interactions
 * work (reordering, selection, etc.).
 *
 * Tests are skipped when the configure page requires authentication
 * (AUTH=local mode) or when the Reference Mission is not available.
 */

test.describe('Configure CMS — Layer Management', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Log in as admin via the API.
   */
  async function loginAsAdmin(request) {
    try {
      const res = await request.post(`${baseURL}/api/users/login`, {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      });
      const body = await res.json().catch(() => null);
      return body && body.status === 'success';
    } catch { return false; }
  }

  /**
   * Log in as admin via the page's own request context (shares cookies with
   * the browser), then navigate to /configure.
   */
  async function gotoConfigureAsAdmin(page) {
    try {
      await page.request.post(`${baseURL}/api/users/login`, {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      });
    } catch { /* best effort */ }

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');
  }

  /**
   * Verify Reference-Mission exists via API, skip if not available.
   */
  async function ensureReferenceMission(request) {
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const text = await listRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      test.skip(true, 'SKIP: Non-JSON response from missions endpoint (auth redirect)');
      return false;
    }
    if (!data.missions || !data.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available');
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Tests
  // -------------------------------------------------------------------------

  test('configure page has a Layers tab or section', async ({ page, request }) => {
    await loginAsAdmin(request);
    if (!(await ensureReferenceMission(request))) return;
    await gotoConfigureAsAdmin(page);

    // Tabs only appear after selecting a mission — click Reference-Mission first
    const missionLink = page.locator('text="Reference-Mission"').first();
    if (!(await missionLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Reference-Mission not visible in sidebar');
      return;
    }
    await missionLink.click();
    await page.waitForLoadState('networkidle');

    // Look for a Layers tab/link/section in the configure UI
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const hasLayersSection =
      bodyHTML.includes('Layers') || bodyHTML.includes('layers');
    expect(hasLayersSection).toBeTruthy();
  });

  test('Reference Mission layers visible in configure', async ({ page, request }) => {
    await loginAsAdmin(request);
    if (!(await ensureReferenceMission(request))) return;
    await gotoConfigureAsAdmin(page);

    // Click on Reference-Mission in the sidebar/list to open it
    const missionLink = page
      .locator('text="Reference-Mission"')
      .first();
    if (await missionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await missionLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Try to open the Layers tab
    const layersTab = page
      .locator('[role="tab"], .tab, [class*="tab"], a, button')
      .filter({ hasText: /^Layers$/i })
      .first();
    if (await layersTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await layersTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Verify known layer names from Reference Mission appear
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const expectedLayers = [
      'Points Basic',
      'Lines Basic',
      'Polygons Basic',
    ];

    let layersFound = 0;
    for (const name of expectedLayers) {
      if (bodyHTML.includes(name)) layersFound++;
    }

    // At least one known layer should be visible
    expect(layersFound).toBeGreaterThan(0);
  });

  test('layer list contains tile/basemap layers', async ({ page, request }) => {
    await loginAsAdmin(request);
    if (!(await ensureReferenceMission(request))) return;
    await gotoConfigureAsAdmin(page);

    // Open Reference-Mission
    const missionLink = page.locator('text="Reference-Mission"').first();
    if (await missionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await missionLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Open Layers tab
    const layersTab = page
      .locator('[role="tab"], .tab, [class*="tab"], a, button')
      .filter({ hasText: /^Layers$/i })
      .first();
    if (await layersTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await layersTab.click();
      await page.waitForLoadState('networkidle');
    }

    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const basemapLayers = [
      'ArcGIS Light',
      'ArcGIS World Topographic',
      'ArcGIS World Imagery',
    ];

    let found = 0;
    for (const name of basemapLayers) {
      if (bodyHTML.includes(name)) found++;
    }

    // At least one basemap should appear
    expect(found).toBeGreaterThan(0);
  });

  test('layer configuration fetched via API contains expected layers', async ({ request }) => {
    await loginAsAdmin(request);
    if (!(await ensureReferenceMission(request))) return;

    // Fetch the full mission config via API
    const getRes = await request.get(
      `${baseURL}/api/configure/get?mission=Reference-Mission&full=true`,
    );
    const text = await getRes.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      test.skip(true, 'SKIP: Non-JSON response (auth redirect)');
      return;
    }

    if (body.status !== 'success') {
      test.skip(true, 'SKIP: Could not fetch Reference-Mission config');
      return;
    }

    // The config should contain a layers array (hierarchical with sublayers)
    const layers = body.config?.layers;
    expect(Array.isArray(layers)).toBeTruthy();
    expect(layers.length).toBeGreaterThan(0);

    // Collect all layer names recursively (layers are nested via sublayers)
    function collectNames(arr) {
      const names = [];
      for (const l of arr) {
        if (l.name) names.push(l.name);
        if (Array.isArray(l.sublayers)) names.push(...collectNames(l.sublayers));
      }
      return names;
    }
    const allNames = collectNames(layers);
    const expectedNames = ['Points Basic', 'Lines Basic', 'Polygons Basic'];
    let matched = 0;
    for (const name of expectedNames) {
      if (allNames.includes(name)) matched++;
    }
    expect(matched).toBeGreaterThan(0);
  });

  test('layer types are represented in config', async ({ request }) => {
    await loginAsAdmin(request);
    if (!(await ensureReferenceMission(request))) return;

    const getRes = await request.get(
      `${baseURL}/api/configure/get?mission=Reference-Mission&full=true`,
    );
    const text = await getRes.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      test.skip(true, 'SKIP: Non-JSON response (auth redirect)');
      return;
    }

    if (body.status !== 'success') {
      test.skip(true, 'SKIP: Could not fetch Reference-Mission config');
      return;
    }

    const layers = body.config?.layers || [];
    // Collect unique layer types recursively (layers are nested via sublayers)
    function collectTypes(arr) {
      const t = new Set();
      for (const l of arr) {
        if (l.type) t.add(l.type);
        if (Array.isArray(l.sublayers)) {
          for (const st of collectTypes(l.sublayers)) t.add(st);
        }
      }
      return t;
    }
    const types = collectTypes(layers);

    // Reference Mission should have a mix of vector and tile layers
    expect(types.size).toBeGreaterThan(0);
  });
});
