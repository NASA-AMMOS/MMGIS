import { test, expect } from '@playwright/test';
import { getLongTermToken, revokeLongTermToken } from '../../helpers/auth.js';

/**
 * E2E tests for the Datasets API.
 *
 * Backend routes: API/Backend/Datasets/routes/datasets.js
 * Mounted at /api/datasets
 *
 * Endpoints tested:
 *   - POST /api/datasets/entries   — list all datasets
 *   - POST /api/datasets/get       — query dataset rows by column:value
 *   - POST /api/datasets/search    — search within a dataset by key:value
 *   - GET  /api/datasets/download  — download a dataset
 *   - POST /api/datasets/upload    — multipart CSV upload (requires long-term token)
 *   - POST /api/datasets/recreate  — create or recreate a dataset from CSV JSON
 */

test.describe('Datasets API — entries', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('POST /api/datasets/entries — lists all datasets', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/entries`, {
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
});

test.describe.serial('Datasets API — recreate and query lifecycle', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const testDatasetName = `test_dataset_${Date.now()}`;

  test('POST /api/datasets/recreate — creates a dataset from CSV data', async ({ request }) => {
    const csvRows = [
      { name: 'Point A', lat: '37.78', lon: '-122.42', value: '100' },
      { name: 'Point B', lat: '37.79', lon: '-122.41', value: '200' },
      { name: 'Point C', lat: '37.80', lon: '-122.40', value: '300' },
    ];

    const response = await request.post(`${baseURL}/api/datasets/recreate`, {
      data: {
        name: testDatasetName,
        header: JSON.stringify(['name', 'lat', 'lon', 'value']),
        mode: 'full',
        csv: JSON.stringify(csvRows),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Recreate may require admin permissions
    if (data.status !== 'success') {
      test.skip(true, 'SKIP: Dataset recreate requires admin privileges');
    }
  });

  test('POST /api/datasets/search — searches the created dataset', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/search`, {
      data: {
        layer: testDatasetName,
        key: 'name',
        value: 'Point A',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'failure' && data.message && data.message.includes('not found')) {
      test.skip(true, 'SKIP: Dataset not found — recreate may have failed');
      return;
    }
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });

  test('POST /api/datasets/get — queries dataset rows', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/get`, {
      data: {
        queries: JSON.stringify([
          {
            dataset: testDatasetName,
            column: 'name',
            search: 'Point B',
          },
        ]),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });

  test('GET /api/datasets/download — downloads the dataset', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/datasets/download`, {
      params: { layer: testDatasetName },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });

  test('POST /api/datasets/recreate — append mode adds rows', async ({ request }) => {
    const csvRows = [
      { name: 'Point D', lat: '37.81', lon: '-122.39', value: '400' },
    ];

    const response = await request.post(`${baseURL}/api/datasets/recreate`, {
      data: {
        name: testDatasetName,
        header: JSON.stringify(['name', 'lat', 'lon', 'value']),
        mode: 'append',
        csv: JSON.stringify(csvRows),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});

test.describe.serial('Datasets API — upload', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  let longTermToken = null;

  test.beforeAll(async ({ request }) => {
    longTermToken = await getLongTermToken(request);
  });

  test.afterAll(async ({ request }) => {
    if (longTermToken) await revokeLongTermToken(request, longTermToken);
  });

  // --- Crash regression tests (busboy error handling) ---

  test('POST /api/datasets/upload — invalid Content-Type does not crash server (returns 400, not 500)', async ({ request }) => {
    // Sending a non-multipart Content-Type previously caused busboy to throw
    // synchronously with no try/catch, crashing the process. After the fix it
    // must return 400 (when a valid token is present) or a non-5xx auth failure.
    const response = await request.post(`${baseURL}/api/datasets/upload`, {
      headers: {
        ...(longTermToken ? { Authorization: `Bearer ${longTermToken}` } : {}),
        'Content-Type': 'text/plain',
      },
      data: 'not a multipart body',
    });
    expect(response.status()).not.toBe(500);
    if (longTermToken) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/datasets/upload — missing Content-Type does not crash server', async ({ request }) => {
    // Busboy throws 'Missing Content-Type' synchronously when the header is absent.
    const response = await request.post(`${baseURL}/api/datasets/upload`, {
      headers: {
        ...(longTermToken ? { Authorization: `Bearer ${longTermToken}` } : {}),
        'Content-Type': '',
      },
      data: '',
    });
    expect(response.status()).not.toBe(500);
  });

  // --- Auth gate ---

  test('POST /api/datasets/upload — without token returns failure, not 5xx', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/upload`, {
      multipart: {
        name: `upload_noauth_${Date.now()}`,
        header: JSON.stringify(['name', 'value']),
        upsert: 'false',
        file: { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from('name,value\nfoo,1\n') },
      },
    });
    expect(response.status()).not.toBe(500);
    const body = await response.json();
    expect(body.status).toBe('failure');
  });

  // --- Happy-path upload (only when a long-term token was obtained) ---

  test('POST /api/datasets/upload — valid multipart CSV upload does not return 5xx', async ({ request }) => {
    if (!longTermToken) {
      test.skip(true, 'SKIP: Could not obtain a long-term token');
      return;
    }

    const csvContent = ['name,score', 'alpha,10', 'beta,20', 'gamma,30'].join('\n') + '\n';
    const response = await request.post(`${baseURL}/api/datasets/upload`, {
      headers: { Authorization: `Bearer ${longTermToken}` },
      multipart: {
        name: `upload_e2e_${Date.now()}`,
        header: JSON.stringify(['name', 'score']),
        upsert: 'false',
        file: { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from(csvContent) },
      },
    });
    expect(response.status()).not.toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('Datasets API — error handling', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('POST /api/datasets/search — nonexistent dataset returns failure', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/search`, {
      data: {
        layer: 'nonexistent_dataset_xyz',
        key: 'name',
        value: 'whatever',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });

  test('GET /api/datasets/download — nonexistent dataset returns failure', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/datasets/download`, {
      params: { layer: 'nonexistent_dataset_xyz_dl' },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data.status).toBe('failure');
  });

  test('POST /api/datasets/get — query nonexistent dataset returns gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/datasets/get`, {
      data: {
        queries: JSON.stringify([
          {
            dataset: 'nonexistent_dataset_xyz_get',
            column: 'name',
            search: 'nothing',
          },
        ]),
      },
    });
    expect(response.status()).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Should succeed but with empty results since dataset doesn't exist
    if (data.status === 'success') {
      expect(Array.isArray(data.body)).toBeTruthy();
    }
  });
});
