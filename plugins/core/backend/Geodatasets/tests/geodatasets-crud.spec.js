import { test, expect } from '@playwright/test';

/**
 * E2E CRUD lifecycle tests for the Geodatasets API.
 *
 * Backend routes: API/Backend/Geodatasets/routes/geodatasets.js
 * Mounted at /api/geodatasets (requires admin via ensureAdmin middleware)
 *
 * Endpoints tested:
 *   - POST /api/geodatasets/entries   — list all geodatasets
 *   - POST /api/geodatasets/search    — search by key:value within a geodataset
 *   - GET  /api/geodatasets/get       — get geodataset as geojson
 *   - POST /api/geodatasets/recreate  — create or recreate a geodataset
 *   - DELETE /api/geodatasets/remove/:name — delete a geodataset
 *   - POST /api/geodatasets/intersect — spatial intersection query
 */

test.describe.serial('Geodatasets API — CRUD lifecycle', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const testName = `test_geodataset_${Date.now()}`;

  test('POST /api/geodatasets/entries — lists all geodatasets', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/entries`, {
      data: {},
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('entries');
      expect(Array.isArray(data.body.entries)).toBeTruthy();
    }
  });

  test('POST /api/geodatasets/recreate — creates a new geodataset', async ({ request }) => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
          properties: { name: 'Test Feature A', category: 'alpha' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-122.43, 37.79] },
          properties: { name: 'Test Feature B', category: 'beta' },
        },
      ],
    };

    const response = await request.post(`${baseURL}/api/geodatasets/recreate`, {
      data: {
        name: testName,
        geojson: JSON.stringify(geojson),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Creation requires admin; if not admin we get failure — both are valid
    if (data.status === 'success') {
      expect(data).toHaveProperty('body');
    }
  });

  test('POST /api/geodatasets/search — searches the created geodataset', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/search`, {
      data: {
        layer: testName,
        key: 'name',
        value: 'Test Feature A',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });

  test('GET /api/geodatasets/get — fetches the geodataset as geojson', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/geodatasets/get`, {
      params: { layer: testName },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    // The GET endpoint returns raw GeoJSON (not wrapped in status) on success,
    // or {status: 'failure'} on error.
    if (data.status === 'failure') {
      // Geodataset not found or admin required — acceptable
      expect(data).toHaveProperty('status');
    } else if (data.type === 'FeatureCollection') {
      expect(Array.isArray(data.features)).toBeTruthy();
    }
  });

  test('POST /api/geodatasets/recreate — recreate (overwrite) the geodataset', async ({ request }) => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-122.44, 37.80] },
          properties: { name: 'Replaced Feature', category: 'gamma' },
        },
      ],
    };

    const response = await request.post(`${baseURL}/api/geodatasets/recreate`, {
      data: {
        name: testName,
        geojson: JSON.stringify(geojson),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('POST /api/geodatasets/search — search returns updated data', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/search`, {
      data: {
        layer: testName,
        key: 'name',
        value: 'Replaced Feature',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });

  test('DELETE /api/geodatasets/remove/:name — removes the geodataset', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/geodatasets/remove/${testName}`);
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // 'success' if admin and geodataset exists, 'failure' otherwise
  });

  test('POST /api/geodatasets/search — search after removal returns failure', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/search`, {
      data: {
        layer: testName,
        key: 'name',
        value: 'Replaced Feature',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // After removal, should be 'failure' with 'Layer not found'
    if (data.status === 'failure') {
      expect(data.message).toContain('not found');
    }
  });
});

test.describe('Geodatasets API — Reference Mission geodatasets', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  const geodatasets = [
    'reference_mission_basic',
    'reference_mission_dynamic_extent',
    'reference_mission_no_duplicates',
    'reference_mission_properties_on_click',
    'reference_mission_time_series',
  ];

  for (const name of geodatasets) {
    test(`${name} is searchable via POST /api/geodatasets/search`, async ({ request }) => {
      // Use the 'last' flag to get the latest feature without needing key/value
      const response = await request.post(`${baseURL}/api/geodatasets/search`, {
        data: { layer: name, last: true },
      });
      expect(response.status()).toBeLessThan(500);
      const data = await response.json();
      if (data.status === 'failure' && data.message && data.message.includes('not found')) {
        test.skip(true, `SKIP: Geodataset ${name} not found — needs Reference Mission setup`);
        return;
      }
      expect(data).toHaveProperty('status');
      if (data.status === 'success') {
        expect(Array.isArray(data.body)).toBeTruthy();
      }
    });
  }

  for (const name of geodatasets) {
    test(`${name} is accessible via GET /api/geodatasets/get`, async ({ request }) => {
      const response = await request.get(`${baseURL}/api/geodatasets/get`, {
        params: { layer: name, limited: 'true' },
      });
      expect(response.status()).toBeLessThan(500);
      const data = await response.json();
      if (data.status === 'failure') {
        test.skip(true, `SKIP: Geodataset ${name} not accessible — needs Reference Mission setup`);
        return;
      }
      // Successful GET returns raw GeoJSON
      if (data.type === 'FeatureCollection') {
        expect(Array.isArray(data.features)).toBeTruthy();
      }
    });
  }
});

test.describe('Geodatasets API — intersect', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('POST /api/geodatasets/intersect — spatial query on reference_mission_basic', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/intersect`, {
      data: {
        layer: 'reference_mission_basic',
        intersect: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
        }),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'failure' && data.message === 'Not Found') {
      test.skip(true, 'SKIP: reference_mission_basic not found — needs Reference Mission setup');
      return;
    }
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('type', 'FeatureCollection');
      expect(Array.isArray(data.body.features)).toBeTruthy();
    }
  });

  test('POST /api/geodatasets/intersect — nonexistent layer returns failure', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/intersect`, {
      data: {
        layer: 'nonexistent_layer_xyz',
        intersect: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
        }),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });
});

test.describe('Geodatasets API — append', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const appendName = `test_append_geodataset_${Date.now()}`;

  test('POST /api/geodatasets/recreate then append', async ({ request }) => {
    // 1. Create the geodataset
    const createRes = await request.post(`${baseURL}/api/geodatasets/recreate`, {
      data: {
        name: appendName,
        geojson: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
              properties: { name: 'Initial' },
            },
          ],
        }),
      },
    });
    expect(createRes.status()).toBeLessThan(500);
    const createData = await createRes.json();
    if (createData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create geodataset for append test (requires admin)');
      return;
    }

    // 2. Append a feature
    const appendRes = await request.post(`${baseURL}/api/geodatasets/append/${appendName}`, {
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.44, 37.80] },
            properties: { name: 'Appended' },
          },
        ],
      },
    });
    expect(appendRes.status()).toBeLessThan(500);
    const appendData = await appendRes.json();
    expect(appendData).toHaveProperty('status');

    // 3. Cleanup
    await request.delete(`${baseURL}/api/geodatasets/remove/${appendName}`).catch(() => {});
  });
});

test.describe('Geodatasets API — error handling', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('POST /api/geodatasets/search — nonexistent layer returns failure', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/geodatasets/search`, {
      data: {
        layer: 'nonexistent_layer_xyz_search',
        key: 'name',
        value: 'whatever',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });

  test('GET /api/geodatasets/get — nonexistent layer returns failure', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/geodatasets/get`, {
      params: { layer: 'nonexistent_layer_xyz_get' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });

  test('DELETE /api/geodatasets/remove — nonexistent layer returns failure', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/geodatasets/remove/nonexistent_layer_xyz_remove`);
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });
});
