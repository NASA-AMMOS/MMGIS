import { test, expect } from '@playwright/test';

/**
 * E2E tests for Geodatasets API endpoints.
 * Backend routes: API/Backend/Geodatasets/routes/geodatasets.js
 *
 * Currently covers:
 *   - POST /api/geodatasets/intersect (impacted by SQL injection fix for time params)
 *   - GET  /api/geodatasets/get       (impacted by same SQL injection fix)
 *
 * Future tests can cover:
 *   - POST /api/geodatasets/search
 *   - POST /api/geodatasets/create, /recreate, /remove
 *   - POST /api/geodatasets/entries (CRUD)
 */

test.describe('Geodatasets API', () => {

  test.describe('POST /api/geodatasets/intersect', () => {

    test('returns a valid response for a basic intersect request', async ({ request }) => {
      const response = await request.post('/api/geodatasets/intersect', {
        data: {
          layer: 'test_geodataset',
          intersect: JSON.stringify({
            type: 'Polygon',
            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
          }),
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    test('returns a valid response with time filter parameters', async ({ request }) => {
      // Exercises the start_time/end_time SQL path that was fixed
      const response = await request.post('/api/geodatasets/intersect', {
        data: {
          layer: 'test_geodataset',
          intersect: JSON.stringify({
            type: 'Polygon',
            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
          }),
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
          startProp: 'start_time',
          endProp: 'end_time',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    test('handles malicious time parameters without server error', async ({ request }) => {
      const response = await request.post('/api/geodatasets/intersect', {
        data: {
          layer: 'test_geodataset',
          intersect: JSON.stringify({
            type: 'Polygon',
            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
          }),
          starttime: "1; DROP TABLE geodatasets; --",
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

  test.describe('GET /api/geodatasets/get', () => {

    test('returns a valid response with time filter parameters', async ({ request }) => {
      const response = await request.get('/api/geodatasets/get', {
        params: {
          layer: 'test_geodataset',
          type: 'all',
          starttime: '2024-01-01T00:00:00Z',
          endtime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

  });

});
