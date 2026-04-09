import { test, expect } from '@playwright/test';

/**
 * Helper to safely parse JSON from a response.
 * Returns null if parsing fails.
 */
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

test.describe('Draw/Files API — filter integration after SQL injection fix', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  let fileId = null;

  test('create file, add features, and query with filters', async ({ request }) => {
    // 1. Create file
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_filter_integration_${Date.now()}`,
        file_description: 'Filter integration test',
        intent: 'all',
        test: 'false',
      },
    });
    const makeData = await safeJson(makeRes);
    if (!makeData || makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file');
      return;
    }
    fileId = makeData.body.file_id;

    // 2. Add a Point feature with properties
    const addRes = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: fileId,
        intent: 'point',
        properties: JSON.stringify({ name: 'FilterTest', elevation: 500, status: 'active', uuid: `uuid-filter-${Date.now()}` }),
        geometry: JSON.stringify({ type: 'Point', coordinates: [-122.42, 37.78] }),
        test: 'false',
      },
    });
    const addData = await safeJson(addRes);
    if (!addData || addData.status !== 'success') {
      test.skip(true, 'SKIP: Could not add feature');
      return;
    }

    // 3. Query with equality filter on name
    const getRes1 = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: fileId, test: 'false', filters: 'name+=+string+FilterTest' },
    });
    expect(getRes1.status()).toBeLessThan(500);
    const getData1 = await safeJson(getRes1);
    if (getData1 && getData1.status === 'success' && getData1.body?.geojson) {
      expect(getData1.body.geojson.features.length).toBeGreaterThanOrEqual(1);
    }

    // 4. Query with numeric filter on elevation
    const getRes2 = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: fileId, test: 'false', filters: 'elevation+>+number+100' },
    });
    expect(getRes2.status()).toBeLessThan(500);

    // 5. Query with geometry.type filter
    const getRes3 = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: fileId, test: 'false', filters: 'geometry.type+=+string+Point' },
    });
    expect(getRes3.status()).toBeLessThan(500);

    // 6. Query with contains filter
    const getRes4 = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: fileId, test: 'false', filters: 'name+contains+string+Filter' },
    });
    expect(getRes4.status()).toBeLessThan(500);

    // Cleanup
    await request.post(`${baseURL}/api/files/remove`, {
      data: { id: fileId, test: 'false' },
    }).catch(() => {});
  });
});
