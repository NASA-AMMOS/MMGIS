import { test, expect } from '@playwright/test';
import { MISSION_TOOLS } from '../../fixtures/mission-config.js';

/**
 * E2E tests for tool configuration in the Configure CMS.
 *
 * Validates that the Tools tab is accessible, that known tools from the
 * Reference Mission are listed, and that basic tool configuration UI
 * interactions work.
 *
 * Tests are skipped when the configure page requires authentication
 * (AUTH=local mode) or when the Reference Mission is not available.
 */

test.describe('Configure CMS — Tool Configuration', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function isLoginPage(page) {
    const title = await page.title().catch(() => '');
    if (title.toLowerCase().includes('login')) return true;
    const hasLoginForm = await page
      .locator('input[type="password"], form[action*="login"], [class*="login"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    return hasLoginForm;
  }

  async function gotoConfigureOrSkip(page) {
    await page.goto('/configure');
    await page.waitForLoadState('networkidle');
    if (await isLoginPage(page)) {
      test.skip(true, 'SKIP: Configure requires admin auth — AUTH=local mode');
      return false;
    }
    return true;
  }

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

  test('configure page has a Tools tab or section', async ({ page, request }) => {
    if (!(await ensureReferenceMission(request))) return;
    if (!(await gotoConfigureOrSkip(page))) return;

    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const hasToolsSection =
      bodyHTML.includes('Tools') || bodyHTML.includes('tools');
    expect(hasToolsSection).toBeTruthy();
  });

  test('known tools listed in configure UI', async ({ page, request }) => {
    if (!(await ensureReferenceMission(request))) return;
    if (!(await gotoConfigureOrSkip(page))) return;

    // Open Reference-Mission
    const missionLink = page.locator('text="Reference-Mission"').first();
    if (await missionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await missionLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Open the Tools tab
    const toolsTab = page
      .locator('[role="tab"], .tab, [class*="tab"], a, button')
      .filter({ hasText: /^Tools$/i })
      .first();
    if (await toolsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toolsTab.click();
      await page.waitForLoadState('networkidle');
    }

    const bodyHTML = await page.evaluate(() => document.body.innerHTML);

    // Check a subset of tools from MISSION_TOOLS
    const coreTools = ['Draw', 'Measure', 'Layers', 'Legend'];
    let toolsFound = 0;
    for (const tool of coreTools) {
      if (bodyHTML.includes(tool)) toolsFound++;
    }

    // At least some core tools should appear in the UI
    expect(toolsFound).toBeGreaterThan(0);
  });

  test('tool configuration fetched via API contains expected tools', async ({ request }) => {
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

    // The config should have a tools array
    const tools = body.config?.tools;
    expect(Array.isArray(tools)).toBeTruthy();
    expect(tools.length).toBeGreaterThan(0);

    // Extract tool names
    const toolNames = tools.map((t) => t.name);

    // All expected tools from the fixture should be present
    for (const expected of MISSION_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  test('each tool has a name property', async ({ request }) => {
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

    const tools = body.config?.tools || [];
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  test('tool enable/disable state is retrievable', async ({ request }) => {
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

    const tools = body.config?.tools || [];
    // All tools in Reference Mission should be present (enabled by virtue
    // of being listed in the config array)
    expect(tools.length).toBeGreaterThanOrEqual(MISSION_TOOLS.length);
  });

  test('tool toggle via API — add and remove tool from config', async ({ request }) => {
    // Create a temporary mission to test tool toggling without affecting Reference-Mission
    const testMission = `ToolToggle-${Date.now()}`;
    const addRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    const addText = await addRes.text();
    let addBody;
    try {
      addBody = JSON.parse(addText);
    } catch {
      test.skip(true, 'SKIP: Non-JSON response (auth redirect)');
      return;
    }

    if (addBody.status !== 'success') {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    try {
      // Fetch the default config
      const getRes = await request.get(
        `${baseURL}/api/configure/get?mission=${encodeURIComponent(testMission)}&full=true`,
      );
      const getBody = await getRes.json();
      expect(getBody.status).toBe('success');

      const config = getBody.config || {};
      const originalToolCount = (config.tools || []).length;

      // Add a test tool entry
      config.tools = config.tools || [];
      config.tools.push({
        name: 'TestToolToggle',
        icon: 'test',
        js: 'TestToolToggle',
        variables: {},
      });

      // Upsert
      const upsertRes = await request.post(`${baseURL}/api/configure/upsert`, {
        data: { mission: testMission, config },
      });
      const upsertBody = await upsertRes.json();
      expect(upsertBody.status).toBe('success');

      // Verify the tool was added
      const verifyRes = await request.get(
        `${baseURL}/api/configure/get?mission=${encodeURIComponent(testMission)}&full=true`,
      );
      const verifyBody = await verifyRes.json();
      const toolNames = (verifyBody.config?.tools || []).map((t) => t.name);
      expect(toolNames).toContain('TestToolToggle');

      // Remove the tool (simulate disable)
      verifyBody.config.tools = verifyBody.config.tools.filter(
        (t) => t.name !== 'TestToolToggle',
      );
      const removeRes = await request.post(`${baseURL}/api/configure/upsert`, {
        data: { mission: testMission, config: verifyBody.config },
      });
      const removeBody = await removeRes.json();
      expect(removeBody.status).toBe('success');

      // Verify removal
      const finalRes = await request.get(
        `${baseURL}/api/configure/get?mission=${encodeURIComponent(testMission)}&full=true`,
      );
      const finalBody = await finalRes.json();
      const finalToolNames = (finalBody.config?.tools || []).map((t) => t.name);
      expect(finalToolNames).not.toContain('TestToolToggle');
      expect(finalToolNames.length).toBe(originalToolCount);
    } finally {
      // Cleanup
      await request.post(`${baseURL}/api/configure/destroy`, {
        data: { mission: testMission },
      }).catch(() => {});
    }
  });
});
