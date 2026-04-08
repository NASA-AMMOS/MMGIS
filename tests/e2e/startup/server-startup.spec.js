import { test, expect } from '@playwright/test';

/**
 * Server startup tests for MMGIS.
 *
 * Validates that the application server starts correctly and its
 * healthcheck endpoint responds as expected.
 */

test.describe('MMGIS Server Startup', () => {

  test('GET /api/utils/healthcheck returns 200', async ({ request }) => {
    const response = await request.get('/api/utils/healthcheck');
    expect(response.status()).toBe(200);
  });

  test('healthcheck response contains success indicator', async ({ request }) => {
    const response = await request.get('/api/utils/healthcheck');
    const body = await response.json().catch(() => response.text());

    // The healthcheck should return a body indicating success.
    // Accept either a JSON object with a success/status field or a plain "OK".
    if (typeof body === 'object' && body !== null) {
      const hasSuccess =
        body.status === 'ok' ||
        body.status === 'success' ||
        body.success === true ||
        body.message === 'ok';
      expect(hasSuccess).toBeTruthy();
    } else {
      // Plain text — expect something truthy like "OK"
      expect(String(body).toLowerCase()).toContain('ok');
    }
  });

  test('no critical errors in server startup', async ({ request }) => {
    // Verify the server can serve the main page without a 500-level error.
    const response = await request.get('/');
    expect(response.status()).toBeLessThan(500);
  });
});
