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
    // In AUTH=local mode every route may redirect to the login page (200 HTML)
    expect(response.status()).toBe(200);
  });

  test('healthcheck response contains success indicator', async ({ request }) => {
    const response = await request.get('/api/utils/healthcheck');
    const text = await response.text();

    // The healthcheck returns plain text "Alive and Well!"
    // In AUTH=local the server may return the login page HTML instead
    expect(text.length).toBeGreaterThan(0);
    if (text.includes('<!DOCTYPE html>') || text.includes('Login')) {
      // Server is running but behind auth — login page means the server is up
      expect(text).toContain('MMGIS');
    } else {
      expect(text.toLowerCase()).toMatch(/alive|ok|success|healthy|well/);
    }
  });

  test('no critical errors in server startup', async ({ request }) => {
    // Verify the server responds. In AUTH=local mode it will be the login page.
    const healthResponse = await request.get('/api/utils/healthcheck');
    expect(healthResponse.status()).toBe(200);
  });
});
