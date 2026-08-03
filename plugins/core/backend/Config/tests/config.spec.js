import { test, expect } from '@playwright/test';

/**
 * E2E tests for Config (Configure) API endpoints.
 * Backend routes: API/Backend/Config/routes/configs.js
 * Mounted at /api/configure (via Config/setup.js)
 *
 * Covers:
 *   - GET  /api/configure/missions
 *   - POST /api/configure/add
 *   - POST /api/configure/upsert  (save / update)
 *   - POST /api/configure/destroy (remove / delete)
 *   - Authorization checks for non-admin users
 */

test.describe('Config API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  // Track missions created during this suite for best-effort cleanup
  const testMissionsCreated = [];

  // GET /api/configure/missions — returns array containing 'Reference-Mission'
  test('GET /api/configure/missions returns mission list', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/configure/missions`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(Array.isArray(data.missions)).toBeTruthy();
    // The CI workflow creates Reference-Mission; it may or may not be present
    // depending on whether the setup step succeeded (e.g. AUTH=off may prevent it)
    if (data.missions.length === 0) {
      test.skip(true, 'SKIP: No missions found — Reference Mission setup may have failed in this CI mode');
      return;
    }
    expect(data.missions).toContain('Reference-Mission');
  });

  // POST /api/configure/add — create test mission, verify in list, then clean up
  test('POST /api/configure/add creates a new mission', async ({ request }) => {
    const testMission = `TestMission-${Date.now()}`;

    // Create mission — requires SuperAdmin permission (session.permission === '111')
    const addRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    expect(addRes.status()).toBeLessThan(500);
    const addBody = await addRes.json();

    if (addBody.status !== 'success') {
      // If we lack admin permissions the endpoint returns failure; skip remaining checks
      test.skip(true, 'Config add requires SuperAdmin — skipping');
      return;
    }

    expect(addBody.mission).toBe(testMission);
    expect(addBody).toHaveProperty('version');
    testMissionsCreated.push(testMission);

    // Verify the new mission appears in the missions list
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listBody = await listRes.json();
    expect(listBody.missions).toContain(testMission);

    // Clean up
    const destroyRes = await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: testMission },
    });
    expect(destroyRes.status()).toBeLessThan(500);
    const idx = testMissionsCreated.indexOf(testMission);
    if (idx > -1) testMissionsCreated.splice(idx, 1);
  });

  // POST /api/configure/upsert — update test mission config, re-fetch, verify
  test('POST /api/configure/upsert updates mission config', async ({ request }) => {
    const testMission = `UpsertMission-${Date.now()}`;

    // Create a test mission first
    const addRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    const addBody = await addRes.json();

    if (addBody.status !== 'success') {
      test.skip(true, 'Config add requires SuperAdmin — skipping upsert test');
      return;
    }
    testMissionsCreated.push(testMission);

    // Fetch the default config that was created
    const getRes = await request.get(
      `${baseURL}/api/configure/get?mission=${encodeURIComponent(testMission)}&full=true`,
    );
    expect(getRes.ok()).toBeTruthy();
    const getBody = await getRes.json();
    expect(getBody.status).toBe('success');

    // Modify the config and upsert
    const updatedConfig = getBody.config;
    updatedConfig.msv.look = { lat: 10, lng: 20, zoom: 5 };

    const upsertRes = await request.post(`${baseURL}/api/configure/upsert`, {
      data: { mission: testMission, config: updatedConfig },
    });
    expect(upsertRes.status()).toBeLessThan(500);
    const upsertBody = await upsertRes.json();
    expect(upsertBody.status).toBe('success');
    expect(upsertBody.version).toBeGreaterThan(addBody.version);

    // Re-fetch and verify the change persisted
    const verifyRes = await request.get(
      `${baseURL}/api/configure/get?mission=${encodeURIComponent(testMission)}&full=true`,
    );
    const verifyBody = await verifyRes.json();
    expect(verifyBody.status).toBe('success');
    expect(verifyBody.config.msv.look.lat).toBe(10);

    // Clean up
    await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: testMission },
    });
    const idx = testMissionsCreated.indexOf(testMission);
    if (idx > -1) testMissionsCreated.splice(idx, 1);
  });

  // POST /api/configure/destroy — delete test mission, verify gone
  test('POST /api/configure/destroy deletes a mission', async ({ request }) => {
    const testMission = `DestroyMission-${Date.now()}`;

    // Create mission
    const addRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    const addBody = await addRes.json();

    if (addBody.status !== 'success') {
      test.skip(true, 'Config add requires SuperAdmin — skipping destroy test');
      return;
    }

    // Destroy it
    const destroyRes = await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: testMission },
    });
    expect(destroyRes.status()).toBeLessThan(500);
    const destroyBody = await destroyRes.json();
    expect(destroyBody.status).toBe('success');

    // Verify it is gone from the missions list
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listBody = await listRes.json();
    expect(listBody.missions).not.toContain(testMission);
  });

  // POST /api/configure/add — duplicate mission name rejected
  test('POST /api/configure/add rejects duplicate mission name', async ({ request }) => {
    const testMission = `DupMission-${Date.now()}`;

    const first = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    const firstBody = await first.json();

    if (firstBody.status !== 'success') {
      test.skip(true, 'Config add requires SuperAdmin — skipping duplicate test');
      return;
    }
    testMissionsCreated.push(testMission);

    // Second add with the same name should fail
    const second = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    expect(second.status()).toBeLessThan(500);
    const secondBody = await second.json();
    expect(secondBody.status).toBe('failure');
    expect(secondBody.message).toMatch(/already exists/i);

    // Clean up
    await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: testMission },
    });
    const idx = testMissionsCreated.indexOf(testMission);
    if (idx > -1) testMissionsCreated.splice(idx, 1);
  });

  // POST /api/configure/rename — rename a mission and verify the new name
  test('POST /api/configure/rename renames a mission', async ({ request }) => {
    const testMission = `RenameMission-${Date.now()}`;
    const renamedMission = `${testMission}-Renamed`;

    const addRes = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: testMission },
    });
    const addBody = await addRes.json();

    if (addBody.status !== 'success') {
      test.skip(true, 'Config add requires SuperAdmin — skipping rename test');
      return;
    }
    testMissionsCreated.push(testMission);

    const renameRes = await request.post(`${baseURL}/api/configure/rename`, {
      data: { mission: testMission, newName: renamedMission },
    });
    expect(renameRes.status()).toBeLessThan(500);
    const renameBody = await renameRes.json();
    expect(renameBody.status).toBe('success');

    // Old name gone, new name present
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listBody = await listRes.json();
    expect(listBody.missions).not.toContain(testMission);
    expect(listBody.missions).toContain(renamedMission);

    // Clean up
    await request.post(`${baseURL}/api/configure/destroy`, {
      data: { mission: renamedMission },
    });
    const idx = testMissionsCreated.indexOf(testMission);
    if (idx > -1) testMissionsCreated.splice(idx, 1);
  });

  // POST /api/configure/rename — rejects invalid names and path traversal
  test('POST /api/configure/rename rejects invalid names', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/configure/rename`, {
      data: { mission: 'SomeMission', newName: '../evil' },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body.status).toBe('failure');
    expect(body.message).toMatch(/invalid mission name/i);
  });

  // POST /api/configure/rename — rejects a rename to an existing mission name
  test('POST /api/configure/rename rejects an existing target name', async ({ request }) => {
    const missionA = `RenameSrc-${Date.now()}`;
    const missionB = `RenameDst-${Date.now()}`;

    const addA = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: missionA },
    });
    const addABody = await addA.json();
    if (addABody.status !== 'success') {
      test.skip(true, 'Config add requires SuperAdmin — skipping collision test');
      return;
    }
    testMissionsCreated.push(missionA);

    const addB = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: missionB },
    });
    const addBBody = await addB.json();
    expect(addBBody.status).toBe('success');
    testMissionsCreated.push(missionB);

    const renameRes = await request.post(`${baseURL}/api/configure/rename`, {
      data: { mission: missionA, newName: missionB },
    });
    expect(renameRes.status()).toBeLessThan(500);
    const renameBody = await renameRes.json();
    expect(renameBody.status).toBe('failure');
    expect(renameBody.message).toMatch(/already exists/i);
  });

  // POST /api/configure/rename — rejects renaming a mission that does not exist
  test('POST /api/configure/rename rejects an unknown mission', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/configure/rename`, {
      data: { mission: `NoSuchMission-${Date.now()}`, newName: `Target-${Date.now()}` },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body.status).toBe('failure');
  });

  // Authorization: non-admin rejected (skip if AUTH=off)
  test('rejects non-admin config changes', async ({ request }) => {
    test.skip(
      process.env.AUTH === 'off',
      'SKIP: Requires AUTH != off to test authorization',
    );

    // Without admin credentials the add endpoint should reject
    const response = await request.post(`${baseURL}/api/configure/add`, {
      data: { mission: 'UnauthorizedMission' },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body.status).toBe('failure');
  });

  // Best-effort cleanup of any leftover test missions
  test.afterAll(async ({ request }) => {
    for (const mission of testMissionsCreated) {
      try {
        await request.post(`${baseURL}/api/configure/destroy`, {
          data: { mission },
        });
      } catch {
        // ignore cleanup errors
      }
    }
  });
});
