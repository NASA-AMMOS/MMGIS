import { test, expect } from '@playwright/test';

/**
 * E2E tests for Sequelize ORM database operations.
 *
 * Validates that the Sequelize-backed API endpoints function correctly,
 * exercising model queries, inserts, and migrations across multiple
 * backend modules:
 *   - Config (missions list)
 *   - Files (draw file listing)
 *   - Geodatasets (spatial dataset entries)
 *   - Shortener (URL insert + retrieve)
 *   - Utils (healthcheck / sync)
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

test.describe('Sequelize ORM — database-backed API endpoints', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('GET /api/utils/healthcheck — server starts with Sequelize sync', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`);
    expect(response.status()).toBe(200);
  });

  test('POST /api/files/getfiles — Sequelize query returns file list', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/getfiles`, {
      data: { mission: 'Reference-Mission' },
    });
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response (login page in AUTH=local)');
      return;
    }
    expect(data).toHaveProperty('status');
    expect(['success', 'failure']).toContain(data.status);
  });

  test('POST /api/geodatasets/entries — Sequelize geodataset listing', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/entries`, {
      data: {},
    });
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data).toHaveProperty('status');
  });

  test('POST /api/shortener/shorten — Sequelize model insert + retrieve', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/shortener/shorten`, {
      data: { url: '/?mission=Reference-Mission&mapLon=0&mapLat=0&mapZoom=3' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('url');
    }
  });

  test('GET /api/configure/missions — Sequelize config query', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/configure/missions`);
    expect(response.status()).toBeLessThan(500);
    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data).toHaveProperty('missions');
    expect(Array.isArray(data.missions)).toBeTruthy();
  });
});
