import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../helpers/auth.js';

/**
 * E2E tests for the Config /clone endpoint.
 *
 * Validates that POST /api/configure/clone correctly looks up the source
 * mission and creates a copy — a regression test for the Express 5
 * req.query mutation bug where req.query.full and req.query.mission were
 * silently lost.
 *
 * Requires AUTH=local with a test_admin account (created by global-setup)
 * and a Reference-Mission to clone from. Skipped in AUTH=off mode because
 * the clone endpoint requires admin session permission.
 */

/** Safely parse JSON; returns null when the response is HTML (e.g. login page). */
async function safeJson(response) {
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('text/html')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const CLONE_MISSION_NAME = 'Clone-Test-E2E';

test.describe('Config /clone — mission cloning', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  let sessionCookie;
  let referenceMissionExists = false;

  test.beforeAll(async ({ request }) => {
    // Authenticate as admin
    sessionCookie = await loginAsAdmin(request);

    // Check that Reference-Mission exists
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await safeJson(listRes);
    if (
      listData &&
      listData.missions &&
      listData.missions.includes('Reference-Mission')
    ) {
      referenceMissionExists = true;
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up: destroy the cloned mission if it was created
    if (sessionCookie) {
      await request.post(`${baseURL}/api/configure/destroy`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        data: { mission: CLONE_MISSION_NAME },
      }).catch(() => {});
    }
  });

  test('POST /api/configure/clone creates a copy of an existing mission', async ({ request }) => {
    if (!sessionCookie) {
      test.skip(true, 'SKIP: could not authenticate as admin (AUTH=off?)');
      return;
    }
    if (!referenceMissionExists) {
      test.skip(true, 'SKIP: Reference-Mission not available');
      return;
    }

    // Clone Reference-Mission
    const response = await request.post(`${baseURL}/api/configure/clone`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      data: {
        existingMission: 'Reference-Mission',
        cloneMission: CLONE_MISSION_NAME,
        hasPaths: 'false',
      },
    });

    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response (unexpected login redirect)');
      return;
    }

    expect(data.status).toBe('success');
  });

  test('cloned mission appears in the missions list', async ({ request }) => {
    if (!sessionCookie || !referenceMissionExists) {
      test.skip(true, 'SKIP: prerequisites not met');
      return;
    }

    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await safeJson(listRes);

    if (!listData) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }

    expect(listData.missions).toContain(CLONE_MISSION_NAME);
  });

  test('cloned mission config matches source structure', async ({ request }) => {
    if (!sessionCookie || !referenceMissionExists) {
      test.skip(true, 'SKIP: prerequisites not met');
      return;
    }

    // Fetch cloned mission config
    const cloneRes = await request.get(
      `${baseURL}/api/configure/get?mission=${encodeURIComponent(CLONE_MISSION_NAME)}`
    );
    const cloneConfig = await safeJson(cloneRes);

    if (!cloneConfig) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }

    // The config should have the standard MMGIS structure
    expect(cloneConfig).toHaveProperty('msv');
    expect(cloneConfig.msv).toHaveProperty('mission', CLONE_MISSION_NAME);

    // Fetch source mission config for structural comparison
    const sourceRes = await request.get(
      `${baseURL}/api/configure/get?mission=Reference-Mission`
    );
    const sourceConfig = await safeJson(sourceRes);

    if (sourceConfig) {
      // Cloned config should have the same layers structure
      expect(cloneConfig).toHaveProperty('layers');
      if (sourceConfig.layers) {
        expect(cloneConfig.layers.length).toBe(sourceConfig.layers.length);
      }
    }
  });

  test('clone with nonexistent source mission fails gracefully', async ({ request }) => {
    if (!sessionCookie) {
      test.skip(true, 'SKIP: could not authenticate as admin');
      return;
    }

    const response = await request.post(`${baseURL}/api/configure/clone`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      data: {
        existingMission: 'Nonexistent-Mission-12345',
        cloneMission: 'Should-Not-Be-Created',
        hasPaths: 'false',
      },
    });

    // Should NOT crash the server
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (data) {
      expect(data.status).toBe('failure');
    }
  });
});
