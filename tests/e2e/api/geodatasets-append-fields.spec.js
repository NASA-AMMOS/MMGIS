import { test, expect, request as apiRequest } from '@playwright/test';

/**
 * E2E test: appending to a geodataset with all four field params set.
 *
 * Backend route: plugins/core/backend/Geodatasets/routes/geodatasets.js
 *   POST /api/geodatasets/append/:name
 *     ?start_prop=&end_prop=&group_id_prop=&feature_id_prop=
 *
 * Append does NOT automatically reuse the start_time_field / end_time_field /
 * group_id_field / feature_id_field configured when the geodataset was created —
 * the property names must be re-supplied on every append request. This test
 * exercises that contract end to end:
 *
 *   1. Create a geodataset configured with all four field mappings.
 *   2. Append features WITH the four *_prop params set and verify the appended
 *      features come back on a temporal (starttime/endtime) query and on a
 *      group_id query, with feature_id populated.
 *   3. Append a feature WITHOUT the *_prop params and verify it gets NULL
 *      group_id (it is excluded from the group_id query) — the documented
 *      gotcha that motivated this test.
 *
 * Creating / appending / removing a geodataset requires an admin session
 * (ensureAdmin middleware). global-setup creates `test_admin` when AUTH=local;
 * when admin access is unavailable (e.g. AUTH=off) the suite skips gracefully.
 */

test.describe.serial('Geodatasets API — append honors field params', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const layerName = `test_append_fields_${Date.now()}`;

  // Property keys inside each feature's `properties` object.
  const START_PROP = 'start_time';
  const END_PROP = 'end_time';
  const GROUP_ID_PROP = 'track';
  const FEATURE_ID_PROP = 'feat_id';

  // Values for the feature appended WITH all params supplied.
  const APPENDED_GROUP = 'TRACK_APPEND';
  const APPENDED_FEATURE_ID = 'feat-append-001';
  const APPENDED_START = '2024-06-01T00:00:00Z';
  const APPENDED_END = '2024-06-01T01:00:00Z';

  // Value for the feature appended WITHOUT any params (should get NULL group_id).
  const ORPHAN_GROUP = 'TRACK_ORPHAN';

  /** Shared authenticated request context (cookies persist across tests). */
  let api;
  /** True only when the geodataset was successfully created (admin available). */
  let adminReady = false;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL });

    // Admin login — succeeds under AUTH=local (test_admin created by global-setup).
    await api
      .post('/api/users/login', {
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      })
      .catch(() => {});

    // Create the geodataset configured with all four field mappings so the
    // start_time / end_time / group_id / feature_id columns exist on the table.
    const createRes = await api.post('/api/geodatasets/recreate', {
      data: {
        name: layerName,
        startProp: START_PROP,
        endProp: END_PROP,
        groupIdProp: GROUP_ID_PROP,
        featureIdProp: FEATURE_ID_PROP,
        geojson: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
              properties: {
                name: 'Seed feature',
                [START_PROP]: '2024-01-01T00:00:00Z',
                [END_PROP]: '2024-01-01T01:00:00Z',
                [GROUP_ID_PROP]: 'TRACK_SEED',
                [FEATURE_ID_PROP]: 'feat-seed-001',
              },
            },
          ],
        }),
      },
    });
    const createData = await createRes.json().catch(() => null);
    adminReady = !!createData && createData.status === 'success';
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${layerName}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  test('append WITH all *_prop params populates start/end/group_id/feature_id', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create/append geodataset');
      return;
    }

    const appendRes = await api.post(
      `/api/geodatasets/append/${layerName}` +
        `?start_prop=${START_PROP}` +
        `&end_prop=${END_PROP}` +
        `&group_id_prop=${GROUP_ID_PROP}` +
        `&feature_id_prop=${FEATURE_ID_PROP}`,
      {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-122.44, 37.8] },
              properties: {
                name: 'Appended with params',
                [START_PROP]: APPENDED_START,
                [END_PROP]: APPENDED_END,
                [GROUP_ID_PROP]: APPENDED_GROUP,
                [FEATURE_ID_PROP]: APPENDED_FEATURE_ID,
              },
            },
          ],
        },
      }
    );
    expect(appendRes.status()).toBeLessThan(500);
    const appendData = await appendRes.json();
    expect(appendData.status).toBe('success');
  });

  test('appended feature is returned by a temporal (starttime/endtime) query', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable');
      return;
    }

    const res = await api.get(`/api/geodatasets/get`, {
      params: {
        layer: layerName,
        // Window fully contains the appended feature's [start_time, end_time].
        starttime: '2024-05-01T00:00:00Z',
        endtime: '2024-07-01T00:00:00Z',
      },
    });
    expect(res.status()).toBeLessThan(500);
    const data = await res.json();
    expect(data.type).toBe('FeatureCollection');

    // Only the feature appended with a start/end inside the window matches;
    // the seed feature (Jan 2024) falls outside it.
    const names = data.features.map((f) => f.properties?.name);
    expect(names).toContain('Appended with params');
    expect(names).not.toContain('Seed feature');

    // The temporal columns round-trip on the appended feature. start_time /
    // end_time are BIGINT columns, serialized as strings, so coerce to Number.
    const appended = data.features.find(
      (f) => f.properties?.name === 'Appended with params'
    );
    expect(Number(appended.properties._.start_time)).toBe(new Date(APPENDED_START).getTime());
    expect(Number(appended.properties._.end_time)).toBe(new Date(APPENDED_END).getTime());
  });

  test('appended feature is returned by a group_id query with feature_id set', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable');
      return;
    }

    const res = await api.get(`/api/geodatasets/get`, {
      params: {
        layer: layerName,
        group_id: APPENDED_GROUP,
        _source: `name,group_id,feature_id`,
      },
    });
    expect(res.status()).toBeLessThan(500);
    const data = await res.json();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(1);

    const feature = data.features[0];
    expect(feature.properties.group_id).toBe(APPENDED_GROUP);
    expect(feature.properties.feature_id).toBe(APPENDED_FEATURE_ID);
  });

  test('append WITHOUT params leaves group_id NULL (documented gotcha)', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable');
      return;
    }

    // Append a feature carrying the same property keys but WITHOUT re-supplying
    // any *_prop query params — group_id/feature_id/start/end are NOT computed.
    const appendRes = await api.post(`/api/geodatasets/append/${layerName}`, {
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.46, 37.82] },
            properties: {
              name: 'Appended without params',
              [START_PROP]: APPENDED_START,
              [END_PROP]: APPENDED_END,
              [GROUP_ID_PROP]: ORPHAN_GROUP,
              [FEATURE_ID_PROP]: 'feat-orphan-001',
            },
          },
        ],
      },
    });
    expect(appendRes.status()).toBeLessThan(500);
    expect((await appendRes.json()).status).toBe('success');

    // Because group_id_prop was not supplied, the feature's group_id is NULL —
    // so a group_id query for its track value returns nothing.
    const res = await api.get(`/api/geodatasets/get`, {
      params: { layer: layerName, group_id: ORPHAN_GROUP },
    });
    expect(res.status()).toBeLessThan(500);
    const data = await res.json();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(0);
  });
});
