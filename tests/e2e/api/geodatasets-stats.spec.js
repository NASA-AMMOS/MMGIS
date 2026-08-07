import { test, expect, request as apiRequest } from '@playwright/test';

/**
 * E2E tests for geodataset statistics.
 *
 * Backend routes: plugins/core/backend/Geodatasets/routes/geodatasets.js
 *   GET|POST /api/geodatasets/get   ?stats=f1,f2   — per-group min/max/avg
 *   GET      /api/geodatasets/schema               — dataset-wide field_stats
 *
 * A purpose-built geodataset is created with known values so the arithmetic can
 * be asserted exactly, including the awkward cases: a numeric string, a
 * non-numeric string, a missing value and a nested property.
 *
 *   track A: elev 1, 2, "3"              meta.depth 5, 7
 *   track B: elev 10, "not_a_number", -  meta.depth -
 *
 * Creating / appending / removing a geodataset requires an admin session
 * (ensureAdmin middleware). global-setup creates `test_admin` when AUTH=local;
 * when admin access is unavailable (e.g. AUTH=off) the suite skips gracefully.
 */

test.describe.serial('Geodatasets statistics', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const layerName = `test_stats_${Date.now()}`;
  const GROUP_ID_PROP = 'track';

  /** Shared authenticated request context (cookies persist across tests). */
  let api;
  /** True only when the geodataset was successfully created (admin available). */
  let adminReady = false;

  const feature = (properties) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
    properties: properties,
  });

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL });

    // Admin login — succeeds under AUTH=local (test_admin created by global-setup).
    await api
      .post('/api/users/login', {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      })
      .catch(() => {});

    const create = () =>
      api.post('/api/geodatasets/recreate', {
        data: {
          name: layerName,
          groupIdProp: GROUP_ID_PROP,
          geojson: JSON.stringify({
            type: 'FeatureCollection',
            features: [
              feature({ track: 'A', elev: 1, meta: { depth: 5 } }),
              feature({ track: 'A', elev: 2, meta: { depth: 7 } }),
              feature({ track: 'A', elev: '3', when: '2024-01-15' }),
              feature({ track: 'B', elev: 10, huge: '1e999' }),
              feature({ track: 'B', elev: 'not_a_number' }),
              feature({ track: 'B' }),
            ],
          }),
        },
      });

    // Creating a geodataset derives its table name from MAX(id), so two suites
    // creating one at the same moment (parallel workers) collide and one fails.
    for (let attempt = 0; attempt < 3 && !adminReady; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      const createData = await create()
        .then((res) => res.json())
        .catch(() => null);
      adminReady = !!createData && createData.status === 'success';
    }
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${layerName}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  /** Statistics of the group each returned feature belongs to, keyed by track. */
  function statsByTrack(features, field) {
    const byTrack = {};
    features.forEach((f) => {
      byTrack[f.properties[GROUP_ID_PROP]] = f.properties._.stats[field];
    });
    return byTrack;
  }

  test('stats= annotates every feature with its own group\'s min/max/avg', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.features).toHaveLength(6);
    // Non-numeric and missing values are ignored, not fatal: track B sees only 10.
    expect(statsByTrack(data.features, 'elev')).toEqual({
      A: { min: 1, max: 3, avg: 2 },
      B: { min: 10, max: 10, avg: 10 },
    });
  });

  test('stats= reads nested properties and reports nulls for a numberless group', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=meta.depth`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(statsByTrack(data.features, 'meta.depth')).toEqual({
      A: { min: 5, max: 7, avg: 6 },
      B: { min: null, max: null, avg: null },
    });
  });

  test('stats= covers the whole group even when noDuplicates collapses it', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev&noDuplicates=true`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();

    // One feature per group survives, still carrying the whole group's statistics.
    expect(data.features).toHaveLength(2);
    expect(statsByTrack(data.features, 'elev')).toEqual({
      A: { min: 1, max: 3, avg: 2 },
      B: { min: 10, max: 10, avg: 10 },
    });
  });

  test('stats= is unaffected by limit and survives an _source projection', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev&_source=${GROUP_ID_PROP}&limit=1`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.features).toHaveLength(1);
    // Paging narrows the returned features, not the statistics behind them.
    const properties = data.features[0].properties;
    expect(properties._.stats.elev).toEqual(
      properties[GROUP_ID_PROP] === 'A'
        ? { min: 1, max: 3, avg: 2 }
        : { min: 10, max: 10, avg: 10 }
    );
    // _source kept only the requested field (plus the server-added metadata).
    expect(Object.keys(properties).sort()).toEqual(['_', GROUP_ID_PROP]);
  });

  test('asking for one feature still reports its whole group', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const all = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev`
    );
    const first = (await all.json()).features.find(
      (f) => f.properties[GROUP_ID_PROP] === 'A'
    );

    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev&id=${first.properties._.idx}`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();

    // The single row asked for; the statistics behind it are track A's three.
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties._.stats.elev).toEqual({
      min: 1,
      max: 3,
      avg: 2,
    });

    // Collapsing duplicates can't collapse away the one feature asked for.
    const deduped = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev&noDuplicates=true&id=${first.properties._.idx}`
    );
    const dedupedData = await deduped.json();
    expect(dedupedData.features).toHaveLength(1);
    expect(dedupedData.features[0].properties._.idx).toBe(
      first.properties._.idx
    );
  });

  test('asking for one groupless feature reports the groupless ones', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const groupless = `${layerName}_ng`;
    const created = await api
      .post('/api/geodatasets/recreate', {
        data: {
          name: groupless,
          groupIdProp: GROUP_ID_PROP,
          geojson: JSON.stringify({
            type: 'FeatureCollection',
            features: [
              feature({ elev: 4 }),
              feature({ elev: 6 }),
              feature({ track: 'A', elev: 100 }),
            ],
          }),
        },
      })
      .then((res) => res.json())
      .catch(() => null);
    test.skip(created?.status !== 'success', 'SKIP: geodataset unavailable');

    try {
      const all = await api.get(
        `/api/geodatasets/get/${groupless}?type=geojson&stats=elev`
      );
      const first = (await all.json()).features.find(
        (f) => f.properties[GROUP_ID_PROP] == null
      );

      const response = await api.get(
        `/api/geodatasets/get/${groupless}?type=geojson&stats=elev&id=${first.properties._.idx}`
      );
      const data = await response.json();

      // A feature with no group belongs to the group of those without one,
      // rather than to no group at all and so to nothing returned.
      expect(data.features).toHaveLength(1);
      expect(data.features[0].properties._.stats.elev).toEqual({
        min: 4,
        max: 6,
        avg: 5,
      });
    } finally {
      await api.delete(`/api/geodatasets/remove/${groupless}`).catch(() => {});
    }
  });

  test('an unknown field and hostile input are answered, not errored', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const unknown = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=definitely_not_a_field`
    );
    expect(unknown.status()).toBe(200);
    const unknownData = await unknown.json();
    expect(unknownData.features[0].properties._.stats).toEqual({
      definitely_not_a_field: { min: null, max: null, avg: null },
    });

    for (const value of [
      `elev'; DROP TABLE geodatasets; --`,
      `elev') OR 1=1--`,
      ',,,',
      Array.from({ length: 50 }, (_, i) => `f${i}`).join(','),
    ]) {
      const response = await api.get(
        `/api/geodatasets/get/${layerName}?type=geojson&stats=${encodeURIComponent(
          value
        )}`
      );
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).not.toBe('failure');
      expect(data.features).toHaveLength(6);
    }

    // The geodataset (and its table) survived the injection attempts.
    const stillThere = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson`
    );
    expect((await stillThere.json()).features).toHaveLength(6);
  });

  test('GET /schema reports dataset-wide field_stats over every feature', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const response = await api.get(`/api/geodatasets/schema?layers=${layerName}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('success');

    // 1 + 2 + "3" + 10 — the numeric string counts, "not_a_number" does not.
    // Of 6 features, 2 held no number for elev.
    expect(data.field_stats[layerName].elev).toMatchObject({
      type: 'number',
      min: 1,
      max: 10,
      sum: 16,
      sumsq: 114,
      count: 4,
      nullCount: 2,
      avg: 4,
    });
    expect(data.field_stats[layerName].elev.stddev).toBeCloseTo(Math.sqrt(12.5), 10);
    // Nested properties are flattened to dotted paths.
    expect(data.field_stats[layerName]['meta.depth']).toEqual({
      type: 'number',
      min: 5,
      max: 7,
      sum: 12,
      sumsq: 74,
      count: 2,
      nullCount: 4,
      avg: 6,
      stddev: 1,
    });
    // Text is not summarized — including text that merely starts with digits.
    expect(data.field_stats[layerName][GROUP_ID_PROP]).toBeUndefined();
    expect(data.field_stats[layerName].when).toBeUndefined();
    // Nor is a value no float can hold.
    expect(data.field_stats[layerName].huge).toBeUndefined();
  });

  test('a value too large for a float is ignored, not fatal', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    // Casting "1e999" to FLOAT8 raises "out of range", taking the whole query
    // with it; it must be ignored like any other unusable value.
    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=huge`
    );
    const data = await response.json();
    expect(data.features.length).toBe(6);
    data.features.forEach((f) =>
      expect(f.properties._.stats.huge).toEqual({
        min: null,
        max: null,
        avg: null,
      })
    );
  });

  test('an append widens field_stats rather than replacing it', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    const appendRes = await api.post(
      `/api/geodatasets/append/${layerName}?group_id_prop=${GROUP_ID_PROP}`,
      {
        data: {
          type: 'FeatureCollection',
          features: [feature({ track: 'A', elev: 100 })],
        },
      }
    );
    expect((await appendRes.json()).status).toBe('success');

    const schema = await api.get(`/api/geodatasets/schema?layers=${layerName}`);
    const field_stats = (await schema.json()).field_stats[layerName];
    // Extrema widen and sum/count add, so the average stays exact without
    // re-reading the table: (16 + 100) / 5.
    expect(field_stats.elev).toMatchObject({
      type: 'number',
      min: 1,
      max: 100,
      sum: 116,
      sumsq: 10114,
      count: 5,
      nullCount: 2,
      avg: 23.2,
    });
    // A field absent from the appended features is carried over untouched.
    expect(field_stats['meta.depth'].count).toBe(2);

    // The appended feature also joins track A's query-time statistics.
    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&stats=elev&noDuplicates=true`
    );
    expect(statsByTrack((await response.json()).features, 'elev').A).toEqual({
      min: 1,
      max: 100,
      avg: 26.5,
    });
  });

  test('an append that creates the geodataset still gets field_stats', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    // Appending to an unknown name creates the geodataset, so the appended
    // features are all of them — nothing earlier is left unsummarized.
    const newLayer = `${layerName}_via_append`;
    const appendRes = await api.post(`/api/geodatasets/append/${newLayer}`, {
      data: {
        type: 'FeatureCollection',
        features: [feature({ elev: 7 }), feature({ elev: 9 })],
      },
    });
    expect((await appendRes.json()).status).toBe('success');

    const schema = await api.get(`/api/geodatasets/schema?layers=${newLayer}`);
    expect((await schema.json()).field_stats[newLayer].elev).toEqual({
      type: 'number',
      min: 7,
      max: 9,
      sum: 16,
      sumsq: 130,
      count: 2,
      nullCount: 0,
      avg: 8,
      stddev: 1,
    });

    await api.delete(`/api/geodatasets/remove/${newLayer}`).catch(() => {});
  });

  test('concurrent appends both reach field_stats', async () => {
    test.skip(!adminReady, 'SKIP: admin access unavailable');

    // Merging reads then writes, so without a row lock one of these is lost.
    const append = (elev) =>
      api.post(
        `/api/geodatasets/append/${layerName}?group_id_prop=${GROUP_ID_PROP}`,
        {
          data: {
            type: 'FeatureCollection',
            features: [feature({ track: 'A', elev })],
          },
        }
      );
    await Promise.all([append(4), append(6)]);

    const schema = await api.get(`/api/geodatasets/schema?layers=${layerName}`);
    // On top of the previous test's {sum 116, count 5}.
    expect((await schema.json()).field_stats[layerName].elev).toMatchObject({
      sum: 126,
      count: 7,
    });
  });
});
