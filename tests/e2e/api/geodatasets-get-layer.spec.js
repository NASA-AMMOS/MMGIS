import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Geodatasets /get/:layer path-parameter route.
 *
 * Validates that GET /api/geodatasets/get/:layer correctly passes the layer
 * name from the URL path to the get() function — a regression test for the
 * Express 5 req.query mutation bug where req.query.layer = req.params.layer
 * was silently lost.
 *
 * Requires a geodataset to exist in the test database. If none exist, the
 * tests are skipped.
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

test.describe('Geodatasets /get/:layer — path parameter route', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  let geodatasetName;

  test.beforeAll(async ({ request }) => {
    // Discover an existing geodataset name from the entries endpoint
    const response = await request.post(`${baseURL}/api/geodatasets/entries`, {
      data: {},
    });
    const data = await safeJson(response);
    if (
      data &&
      data.status === 'success' &&
      data.body &&
      Array.isArray(data.body) &&
      data.body.length > 0
    ) {
      geodatasetName = data.body[0].name;
    }
  });

  test('GET /api/geodatasets/get/:layer returns data for the layer', async ({ request }) => {
    if (!geodatasetName) {
      test.skip(true, 'SKIP: no geodatasets available in test database');
      return;
    }

    const response = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(geodatasetName)}`
    );
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response (login page in AUTH=local)');
      return;
    }

    // The response should be a valid GeoJSON or a success envelope
    expect(data).toBeDefined();
    // Should NOT return an error about missing/null layer
    if (data.status) {
      expect(data.status).not.toBe('failure');
    }
  });

  test('GET /api/geodatasets/get/:layer matches query-string variant', async ({ request }) => {
    if (!geodatasetName) {
      test.skip(true, 'SKIP: no geodatasets available in test database');
      return;
    }

    // Path-parameter variant
    const pathRes = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(geodatasetName)}`
    );
    const pathData = await safeJson(pathRes);

    // Query-string variant
    const queryRes = await request.get(
      `${baseURL}/api/geodatasets/get?layer=${encodeURIComponent(geodatasetName)}`
    );
    const queryData = await safeJson(queryRes);

    if (!pathData || !queryData) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }

    // Both should succeed (or both fail identically)
    expect(pathRes.status()).toBe(queryRes.status());
    if (pathData.status && queryData.status) {
      expect(pathData.status).toBe(queryData.status);
    }
  });

  test('GET /api/geodatasets/get/:layer does not crash the server', async ({ request }) => {
    // Even with a nonexistent layer, the server should not crash (500)
    const response = await request.get(
      `${baseURL}/api/geodatasets/get/nonexistent_layer_name`
    );
    // Acceptable: 200 with failure status, 404, etc. — but NOT 500+
    expect(response.status()).toBeLessThan(500);
  });
});
