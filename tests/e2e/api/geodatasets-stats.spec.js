import { test, expect } from '@playwright/test';

/**
 * E2E tests for geodataset statistics:
 *   - GET|POST /api/geodatasets/get  `stats` — per-group numeric statistics
 *   - GET      /api/geodatasets/schema `field_stats` — dataset-wide statistics
 *
 * Requires a geodataset with at least one numeric field in the test database.
 * Tests skip themselves when none is available.
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

test.describe('Geodatasets statistics', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  let geodatasetName;
  let numericField;

  test.beforeAll(async ({ request }) => {
    const entriesRes = await request.post(`${baseURL}/api/geodatasets/entries`, {
      data: {},
    });
    const entries = await safeJson(entriesRes);
    const list = entries?.body?.entries;
    if (!Array.isArray(list) || list.length === 0) return;

    // Find the first geodataset that has a numeric field to summarize
    for (const entry of list) {
      const schemaRes = await request.get(
        `${baseURL}/api/geodatasets/schema?layers=${encodeURIComponent(entry.name)}`
      );
      const schema = await safeJson(schemaRes);
      if (schema?.status !== 'success') continue;
      const field = Object.keys(schema.schema || {}).find(
        (key) => schema.schema[key].type === 'number'
      );
      if (field) {
        geodatasetName = entry.name;
        numericField = field;
        break;
      }
    }
  });

  test('stats= annotates features with min/max/avg of their group', async ({ request }) => {
    if (!numericField) {
      test.skip(true, 'SKIP: no geodataset with a numeric field available');
      return;
    }

    const response = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(
        geodatasetName
      )}?stats=${encodeURIComponent(numericField)}`
    );
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response (login page in AUTH=local)');
      return;
    }
    expect(data.status).not.toBe('failure');
    if (!Array.isArray(data.features) || data.features.length === 0) {
      test.skip(true, 'SKIP: geodataset has no features');
      return;
    }

    const stats = data.features[0].properties?._?.stats;
    expect(stats).toBeDefined();
    expect(stats[numericField]).toBeDefined();
    expect(stats[numericField]).toHaveProperty('min');
    expect(stats[numericField]).toHaveProperty('max');
    expect(stats[numericField]).toHaveProperty('avg');

    const { min, max, avg } = stats[numericField];
    if (min !== null) {
      expect(typeof min).toBe('number');
      expect(max).toBeGreaterThanOrEqual(min);
      expect(avg).toBeGreaterThanOrEqual(min);
      expect(avg).toBeLessThanOrEqual(max);
    }
  });

  test('stats= composes with noDuplicates', async ({ request }) => {
    if (!numericField) {
      test.skip(true, 'SKIP: no geodataset with a numeric field available');
      return;
    }

    const plainRes = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(
        geodatasetName
      )}?stats=${encodeURIComponent(numericField)}`
    );
    const dedupedRes = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(
        geodatasetName
      )}?stats=${encodeURIComponent(numericField)}&noDuplicates=true`
    );
    expect(dedupedRes.status()).toBeLessThan(500);

    const plain = await safeJson(plainRes);
    const deduped = await safeJson(dedupedRes);
    if (!plain || !deduped) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(deduped.status).not.toBe('failure');
    if (!Array.isArray(deduped.features) || deduped.features.length === 0) {
      test.skip(true, 'SKIP: geodataset has no features');
      return;
    }

    // Deduplicating keeps one feature per group, and each survivor still
    // carries its whole group's statistics.
    expect(deduped.features.length).toBeLessThanOrEqual(plain.features.length);
    expect(deduped.features[0].properties?._?.stats?.[numericField]).toBeDefined();
  });

  test('stats= is accepted by the POST variant', async ({ request }) => {
    if (!numericField) {
      test.skip(true, 'SKIP: no geodataset with a numeric field available');
      return;
    }

    const response = await request.post(`${baseURL}/api/geodatasets/get`, {
      data: { layer: geodatasetName, stats: [numericField] },
    });
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data.status).not.toBe('failure');
    const features = data.body?.features;
    if (!Array.isArray(features) || features.length === 0) {
      test.skip(true, 'SKIP: geodataset has no features');
      return;
    }
    expect(features[0].properties?._?.stats?.[numericField]).toBeDefined();
  });

  test('stats= for a nonexistent or non-numeric field yields nulls, not an error', async ({
    request,
  }) => {
    if (!geodatasetName) {
      test.skip(true, 'SKIP: no geodatasets available in test database');
      return;
    }

    const response = await request.get(
      `${baseURL}/api/geodatasets/get/${encodeURIComponent(
        geodatasetName
      )}?stats=definitely_not_a_field`
    );
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data.status).not.toBe('failure');
    if (!Array.isArray(data.features) || data.features.length === 0) return;
    expect(data.features[0].properties._.stats.definitely_not_a_field).toEqual({
      min: null,
      max: null,
      avg: null,
    });
  });

  test('malformed stats values do not error the query', async ({ request }) => {
    if (!geodatasetName) {
      test.skip(true, 'SKIP: no geodatasets available in test database');
      return;
    }

    for (const value of [
      `elev'; DROP TABLE geodatasets; --`,
      ',,,',
      Array.from({ length: 50 }, (_, i) => `f${i}`).join(','),
    ]) {
      const response = await request.get(
        `${baseURL}/api/geodatasets/get/${encodeURIComponent(
          geodatasetName
        )}?stats=${encodeURIComponent(value)}`
      );
      expect(response.status()).toBeLessThan(500);
      const data = await safeJson(response);
      if (data) expect(data.status).not.toBe('failure');
    }
  });

  test('GET /schema reports dataset-wide field_stats', async ({ request }) => {
    if (!geodatasetName) {
      test.skip(true, 'SKIP: no geodatasets available in test database');
      return;
    }

    const response = await request.get(
      `${baseURL}/api/geodatasets/schema?layers=${encodeURIComponent(geodatasetName)}`
    );
    expect(response.status()).toBeLessThan(500);

    const data = await safeJson(response);
    if (!data) {
      test.skip(true, 'SKIP: HTML response');
      return;
    }
    expect(data.status).toBe('success');
    // Always present, but only populated for geodatasets written since the
    // field_stats column was added.
    expect(data).toHaveProperty('field_stats');
    const stats = data.field_stats[geodatasetName];
    if (stats == null) return;
    Object.values(stats).forEach((stat) => {
      expect(stat.type).toBe('number');
      expect(stat.max).toBeGreaterThanOrEqual(stat.min);
      expect(stat.count).toBeGreaterThan(0);
      expect(stat.avg).toBeCloseTo(stat.sum / stat.count, 6);
    });
  });
});
