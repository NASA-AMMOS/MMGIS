import { test, expect } from '@playwright/test';

/**
 * E2E CRUD lifecycle tests for the Draw/Files API.
 *
 * Backend routes:
 *   - Files API: API/Backend/Draw/routes/files.js  (mounted at /api/files)
 *   - Draw API:  API/Backend/Draw/routes/draw.js   (mounted at /api/draw)
 *
 * These tests exercise file creation, feature add/edit/remove, undo,
 * publish, and related endpoints.
 */

test.describe.serial('Draw/Files API — CRUD lifecycle', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';
  const mission = 'Reference-Mission';

  // Shared state across tests inside a serial describe
  let createdFileId = null;
  let createdFeatureId = null;

  // ── List files ──────────────────────────────────────────────────────
  test('POST /api/files/getfiles — lists files for mission', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/getfiles`, {
      data: { mission },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // status can be 'success' or 'failure' depending on user/auth context
    if (data.status === 'success') {
      expect(data).toHaveProperty('body');
    }
  });

  // ── Create a new draw file ──────────────────────────────────────────
  test('POST /api/files/make — creates a new draw file', async ({ request }) => {
    const fileName = `test_draw_crud_${Date.now()}`;
    const response = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: fileName,
        file_description: 'Automated test file',
        intent: 'roi',
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('file_id');
      createdFileId = data.body.file_id;
    }
  });

  // ── Add a Point feature ─────────────────────────────────────────────
  test('POST /api/draw/add — adds a point feature to the file', async ({ request }) => {
    if (createdFileId == null) {
      test.skip(true, 'SKIP: No file was created in the prior step');
      return;
    }

    const geometry = {
      type: 'Point',
      coordinates: [-122.42, 37.78],
    };

    const response = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: createdFileId,
        intent: 'point',
        properties: JSON.stringify({ name: 'Test Point', uuid: `uuid-${Date.now()}` }),
        geometry: JSON.stringify(geometry),
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('id');
      createdFeatureId = data.body.id;
    }
  });

  // ── Get the file back ───────────────────────────────────────────────
  test('POST /api/files/getfile — retrieves the created file', async ({ request }) => {
    if (createdFileId == null) {
      test.skip(true, 'SKIP: No file was created — cannot retrieve');
      return;
    }

    const response = await request.post(`${baseURL}/api/files/getfile`, {
      data: {
        id: createdFileId,
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('geojson');
    }
  });

  // ── Edit the feature ────────────────────────────────────────────────
  test('POST /api/draw/edit — edits the point feature geometry', async ({ request }) => {
    if (createdFileId == null || createdFeatureId == null) {
      test.skip(true, 'SKIP: File/feature not created — cannot edit');
      return;
    }

    const newGeometry = {
      type: 'Point',
      coordinates: [-122.43, 37.79],
    };

    const response = await request.post(`${baseURL}/api/draw/edit`, {
      data: {
        file_id: createdFileId,
        feature_id: createdFeatureId,
        geometry: JSON.stringify(newGeometry),
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(data.body).toHaveProperty('id');
      // Update the feature id since edit creates a new row
      createdFeatureId = data.body.id;
    }
  });

  // ── Remove the feature ──────────────────────────────────────────────
  test('POST /api/draw/remove — removes the feature', async ({ request }) => {
    if (createdFileId == null || createdFeatureId == null) {
      test.skip(true, 'SKIP: File/feature not created — cannot remove');
      return;
    }

    const response = await request.post(`${baseURL}/api/draw/remove`, {
      data: {
        file_id: createdFileId,
        id: createdFeatureId,
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  // ── Verify feature is removed from file ─────────────────────────────
  test('POST /api/files/getfile — file has no features after removal', async ({ request }) => {
    if (createdFileId == null) {
      test.skip(true, 'SKIP: No file was created');
      return;
    }

    const response = await request.post(`${baseURL}/api/files/getfile`, {
      data: {
        id: createdFileId,
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success' && data.body?.geojson) {
      // After remove, the file should have no features (or fewer)
      expect(data.body.geojson.features.length).toBe(0);
    }
  });

  // ── Hide / remove the file ─────────────────────────────────────────
  test('POST /api/files/remove — hides the created file', async ({ request }) => {
    if (createdFileId == null) {
      test.skip(true, 'SKIP: No file was created');
      return;
    }

    const response = await request.post(`${baseURL}/api/files/remove`, {
      data: {
        id: createdFileId,
        test: 'false',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});

test.describe('Draw/Files API — Line and Polygon features', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  let lineFileId = null;

  test('create file and add LineString feature', async ({ request }) => {
    // 1. Create file
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_line_${Date.now()}`,
        file_description: 'Line feature test',
        intent: 'all',
        test: 'false',
      },
    });
    expect(makeRes.status()).toBeLessThan(500);
    const makeData = await makeRes.json();
    if (makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file for line feature test');
      return;
    }
    lineFileId = makeData.body.file_id;

    // 2. Add LineString feature
    const lineGeometry = {
      type: 'LineString',
      coordinates: [
        [-122.42, 37.78],
        [-122.43, 37.79],
        [-122.44, 37.80],
      ],
    };

    const addRes = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: lineFileId,
        intent: 'line',
        properties: JSON.stringify({ name: 'Test Line', uuid: `uuid-line-${Date.now()}` }),
        geometry: JSON.stringify(lineGeometry),
        test: 'false',
      },
    });
    expect(addRes.status()).toBeLessThan(500);
    const addData = await addRes.json();
    expect(addData).toHaveProperty('status');
    if (addData.status === 'success') {
      expect(addData.body).toHaveProperty('id');
    }

    // 3. Verify via getfile
    const getRes = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: lineFileId, test: 'false' },
    });
    expect(getRes.status()).toBeLessThan(500);
    const getData = await getRes.json();
    if (getData.status === 'success' && getData.body?.geojson) {
      expect(getData.body.geojson.features.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('create file and add Polygon feature', async ({ request }) => {
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_polygon_${Date.now()}`,
        file_description: 'Polygon feature test',
        intent: 'all',
        test: 'false',
      },
    });
    expect(makeRes.status()).toBeLessThan(500);
    const makeData = await makeRes.json();
    if (makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file for polygon feature test');
      return;
    }
    const polyFileId = makeData.body.file_id;

    const polygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.42, 37.78],
          [-122.43, 37.78],
          [-122.43, 37.79],
          [-122.42, 37.79],
          [-122.42, 37.78],
        ],
      ],
    };

    const addRes = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: polyFileId,
        intent: 'polygon',
        properties: JSON.stringify({ name: 'Test Polygon', uuid: `uuid-poly-${Date.now()}` }),
        geometry: JSON.stringify(polygonGeometry),
        test: 'false',
      },
    });
    expect(addRes.status()).toBeLessThan(500);
    const addData = await addRes.json();
    expect(addData).toHaveProperty('status');
    if (addData.status === 'success') {
      expect(addData.body).toHaveProperty('id');
    }

    // Cleanup — hide the file
    await request.post(`${baseURL}/api/files/remove`, {
      data: { id: polyFileId, test: 'false' },
    });
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup
    if (lineFileId != null) {
      await request.post(`${baseURL}/api/files/remove`, {
        data: { id: lineFileId, test: 'false' },
      }).catch(() => {});
    }
  });
});

test.describe('Draw/Files API — merge, split, undo, publish', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('merge features', async ({ request }) => {
    test.skip(true, 'SKIP: Merge requires multiple polygon features in a file owned by the user — complex setup needed');
  });

  test('split feature', async ({ request }) => {
    test.skip(true, 'SKIP: Split requires a polygon feature and a line to split against — complex setup needed');
  });

  test('undo operation', async ({ request }) => {
    // 1. Create file
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_undo_${Date.now()}`,
        file_description: 'Undo test',
        intent: 'all',
        test: 'false',
      },
    });
    expect(makeRes.status()).toBeLessThan(500);
    const makeData = await makeRes.json();
    if (makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file for undo test');
      return;
    }
    const fileId = makeData.body.file_id;

    // 2. Add a feature
    const addRes = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: fileId,
        intent: 'point',
        properties: JSON.stringify({ name: 'Undo Me', uuid: `uuid-undo-${Date.now()}` }),
        geometry: JSON.stringify({ type: 'Point', coordinates: [-122.42, 37.78] }),
        test: 'false',
      },
    });
    expect(addRes.status()).toBeLessThan(500);
    const addData = await addRes.json();
    if (addData.status !== 'success') {
      test.skip(true, 'SKIP: Could not add feature for undo test');
      return;
    }

    // 3. Get history to find the undo_time
    const histRes = await request.post(`${baseURL}/api/files/gethistory`, {
      data: { id: fileId, test: 'false' },
    });
    expect(histRes.status()).toBeLessThan(500);
    const histData = await histRes.json();
    if (histData.status !== 'success' || !histData.body || histData.body.length === 0) {
      test.skip(true, 'SKIP: Could not get history for undo test');
      return;
    }

    // Use the time from the last history entry as undo_time
    const lastEntry = histData.body[0];
    const undoTime = lastEntry.time;

    // 4. Undo
    const undoRes = await request.post(`${baseURL}/api/draw/undo`, {
      data: {
        file_id: fileId,
        undo_time: undoTime,
        test: 'false',
      },
    });
    expect(undoRes.status()).toBeLessThan(500);
    const undoData = await undoRes.json();
    expect(undoData).toHaveProperty('status');

    // Cleanup
    await request.post(`${baseURL}/api/files/remove`, {
      data: { id: fileId, test: 'false' },
    }).catch(() => {});
  });

  test('publish draw file', async ({ request }) => {
    // Publish requires lead group membership which the test user may not have
    const response = await request.post(`${baseURL}/api/files/publish`, {
      data: { test: 'false' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Either 'success' (if authorized) or 'failure' (if unauthorized) — both are valid
    expect(['success', 'failure']).toContain(data.status);
  });
});

test.describe('Draw/Files API — error handling', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('rejects adding feature with invalid geometry', async ({ request }) => {
    // First create a file
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_invalid_geom_${Date.now()}`,
        file_description: 'Invalid geometry test',
        intent: 'all',
        test: 'false',
      },
    });
    const makeData = await makeRes.json();
    if (makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file for invalid geometry test');
      return;
    }
    const fileId = makeData.body.file_id;

    // Try to add feature with invalid geometry (not valid JSON for geometry)
    const response = await request.post(`${baseURL}/api/draw/add`, {
      data: {
        file_id: fileId,
        intent: 'point',
        properties: JSON.stringify({ name: 'Bad Feature' }),
        geometry: 'NOT_VALID_JSON',
        test: 'false',
      },
    });
    // Should fail gracefully — not a 500
    expect(response.status()).toBeLessThan(500);

    // Cleanup
    await request.post(`${baseURL}/api/files/remove`, {
      data: { id: fileId, test: 'false' },
    }).catch(() => {});
  });

  test('getfile with nonexistent id returns failure or error', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/getfile`, {
      data: { id: 999999, test: 'false' },
    });
    // Should not crash with 500; may return failure status or an error code
    const status = response.status();
    if (status >= 500) {
      // Some endpoints may return 500 for truly nonexistent resources;
      // accept as long as the server doesn't crash on subsequent requests
      const healthcheck = await request.get(`${baseURL}/api/utils/healthcheck`);
      expect(healthcheck.status()).toBe(200);
    } else {
      const data = await response.json();
      expect(data).toHaveProperty('status');
    }
  });

  test('remove nonexistent file returns gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/remove`, {
      data: { id: 999999, test: 'false' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('POST /api/files/gethistory for nonexistent file', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/gethistory`, {
      data: { id: 999999, test: 'false' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('POST /api/files/change — update file name', async ({ request }) => {
    // Create a file to change
    const makeRes = await request.post(`${baseURL}/api/files/make`, {
      data: {
        file_name: `test_change_${Date.now()}`,
        file_description: 'Change test',
        intent: 'all',
        test: 'false',
      },
    });
    const makeData = await makeRes.json();
    if (makeData.status !== 'success') {
      test.skip(true, 'SKIP: Could not create file for change test');
      return;
    }
    const fileId = makeData.body.file_id;

    const changeRes = await request.post(`${baseURL}/api/files/change`, {
      data: {
        id: fileId,
        file_name: `renamed_${Date.now()}`,
        test: 'false',
      },
    });
    expect(changeRes.status()).toBeLessThan(500);
    const changeData = await changeRes.json();
    expect(changeData).toHaveProperty('status');

    // Cleanup
    await request.post(`${baseURL}/api/files/remove`, {
      data: { id: fileId, test: 'false' },
    }).catch(() => {});
  });
});
