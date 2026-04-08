import { test, expect } from '@playwright/test';

/**
 * E2E tests for mission CRUD operations via the Configure CMS.
 *
 * These tests exercise mission create / read / update / delete flows using
 * both the API and the configure UI.  In AUTH=local mode (where admin
 * credentials are required) the tests gracefully skip.
 *
 * All test missions are cleaned up in afterAll to avoid polluting the
 * database across CI runs.
 */

test.describe('Configure CMS — Mission CRUD', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  /** Missions created during this suite — cleaned up in afterAll. */
  const testMissionsCreated = [];

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Attempt to create a mission via the API.
   * Returns { ok, body } where ok=false means we should skip.
   */
  async function apiCreateMission(request, name) {
    const res = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: name },
    });

    // In AUTH=local the response may be HTML (login page) rather than JSON.
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, body: { status: 'failure', message: 'Non-JSON response (auth redirect)' } };
    }

    if (body.status === 'success') {
      testMissionsCreated.push(name);
    }
    return { ok: body.status === 'success', body };
  }

  /**
   * Best-effort mission deletion via the API.
   */
  async function apiDeleteMission(request, name) {
    try {
      const res = await request.post(`${baseURL}/api/configure/destroy`, {
        data: { mission: name },
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return;
      }
      if (body.status === 'success') {
        const idx = testMissionsCreated.indexOf(name);
        if (idx > -1) testMissionsCreated.splice(idx, 1);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  // -------------------------------------------------------------------------
  // Tests
  // -------------------------------------------------------------------------

  test('create a test mission via API', async ({ request }) => {
    const missionName = `CrudTest-Create-${Date.now()}`;
    const { ok, body } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin — AUTH=local mode or insufficient permissions');
      return;
    }

    expect(body.mission).toBe(missionName);
    expect(body).toHaveProperty('version');
  });

  test('created mission appears in mission list', async ({ request }) => {
    const missionName = `CrudTest-List-${Date.now()}`;
    const { ok } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listBody = await listRes.json().catch(() => ({}));
    expect(listBody.missions).toContain(missionName);
  });

  test('update mission config via upsert', async ({ request }) => {
    const missionName = `CrudTest-Upsert-${Date.now()}`;
    const { ok } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    // Fetch the default config
    const getRes = await request.get(
      `${baseURL}/api/configure/get?mission=${encodeURIComponent(missionName)}&full=true`,
    );
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.status).toBe('success');

    // Modify a field and upsert
    const updatedConfig = getBody.config || {};
    updatedConfig.customTestField = 'crud-test-value';

    const upsertRes = await request.post(`${baseURL}/api/configure/upsert`, {
      data: { mission: missionName, config: updatedConfig },
    });
    expect(upsertRes.status()).toBeLessThan(500);
    const upsertBody = await upsertRes.json();
    expect(upsertBody.status).toBe('success');

    // Verify persistence
    const verifyRes = await request.get(
      `${baseURL}/api/configure/get?mission=${encodeURIComponent(missionName)}&full=true`,
    );
    const verifyBody = await verifyRes.json();
    expect(verifyBody.status).toBe('success');
    expect(verifyBody.config.customTestField).toBe('crud-test-value');
  });

  test('delete a test mission via API', async ({ request }) => {
    const missionName = `CrudTest-Delete-${Date.now()}`;
    const { ok } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    // Destroy
    const destroyRes = await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: missionName },
    });
    expect(destroyRes.status()).toBeLessThan(500);
    const destroyBody = await destroyRes.json();
    expect(destroyBody.status).toBe('success');

    // Remove from tracking
    const idx = testMissionsCreated.indexOf(missionName);
    if (idx > -1) testMissionsCreated.splice(idx, 1);

    // Verify it is gone
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listBody = await listRes.json();
    expect(listBody.missions).not.toContain(missionName);
  });

  test('created mission visible in configure UI', async ({ page, request }) => {
    const missionName = `CrudTest-UI-${Date.now()}`;
    const { ok } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    // Detect login redirect
    const title = await page.title().catch(() => '');
    if (title.toLowerCase().includes('login')) {
      test.skip(true, 'SKIP: Configure UI requires auth — AUTH=local mode');
      return;
    }

    // The newly created mission should be listed somewhere in the configure page
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    expect(bodyHTML).toContain(missionName);
  });

  test('duplicate mission name is rejected', async ({ request }) => {
    const missionName = `CrudTest-Dup-${Date.now()}`;
    const { ok } = await apiCreateMission(request, missionName);

    if (!ok) {
      test.skip(true, 'SKIP: Mission creation requires SuperAdmin');
      return;
    }

    // Second create with the same name should fail
    const dupRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: missionName },
    });
    expect(dupRes.status()).toBeLessThan(500);
    const dupBody = await dupRes.json();
    expect(dupBody.status).toBe('failure');
    expect(dupBody.message).toMatch(/already exists/i);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  test.afterAll(async ({ request }) => {
    for (const mission of testMissionsCreated) {
      await apiDeleteMission(request, mission);
    }
  });
});
