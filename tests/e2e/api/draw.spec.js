import { test, expect } from '@playwright/test';

/**
 * E2E tests for Draw API endpoints.
 * Backend routes: API/Backend/Draw/routes/files.js
 *
 * Currently covers:
 *   - POST /api/files/getfile (impacted by SQL injection fix in filesutils.js)
 *
 * Future tests can cover:
 *   - POST /api/files/getfiles
 *   - POST /api/files/gethistory
 *   - POST /api/files/add, /edit, /remove, /merge, /split, /undo
 *   - POST /api/files/publish, /clip
 */

test.describe('Draw API', () => {

  test.describe('POST /api/files/getfile', () => {

    test('returns a valid response for a basic getfile request', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
        },
      });
      // Should not crash (no 500)
      expect(response.status()).toBeLessThan(500);
      const body = await response.json().catch(() => null);
      // In AUTH=local the server may return the HTML login page
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body).toHaveProperty('status');
    });

    test('returns a valid response with temporal filter parameters', async ({ request }) => {
      // Exercises the timeProp SQL path that was fixed
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
          timeProp: 'sol',
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json().catch(() => null);
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body).toHaveProperty('status');
    });

    test('handles malicious timeProp without server error', async ({ request }) => {
      // SQL injection attempt via timeProp — should be sanitized, not crash
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
          timeProp: "'; DROP TABLE user_features; --",
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

});
