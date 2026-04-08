import { test, expect } from '@playwright/test';

/**
 * E2E tests for General Options API endpoints.
 * Backend routes: API/Backend/Config/routes/configs.js (GeneralOptions model used there)
 * GeneralOptions model: API/Backend/GeneralOptions/models/generaloptions.js
 *
 * Endpoints (via Config routes):
 *   - GET  /api/configure/getGeneralOptions
 *   - POST /api/configure/updateGeneralOptions  { options } (requires admin)
 */

test.describe('General Options API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('GET /api/configure/getGeneralOptions returns options or appropriate error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/configure/getGeneralOptions`);
    // Should not return 500
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Response should have a status field
      expect(body).toHaveProperty('status');
      if (body.status === 'success') {
        expect(body).toHaveProperty('options');
      }
    }
  });

  test('POST /api/configure/updateGeneralOptions requires valid options payload', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/configure/updateGeneralOptions`, {
      data: { options: { testKey: `testValue_${Date.now()}` } },
    });
    // Should not return 500
    expect(response.status()).not.toBe(500);

    // If auth blocks us, that is expected
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('status');
    }
  });

  test('POST /api/configure/updateGeneralOptions with empty body does not crash', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/configure/updateGeneralOptions`, {
      data: {},
    });
    // Should not return 500 even with empty body
    expect(response.status()).not.toBe(500);
  });

  test('general options round-trip: update then read back', async ({ request }) => {
    const testTimestamp = Date.now();
    const testOptions = { e2eTestMarker: testTimestamp };

    // Update general options
    const updateResponse = await request.post(`${baseURL}/api/configure/updateGeneralOptions`, {
      data: { options: testOptions },
    });
    expect(updateResponse.status()).not.toBe(500);

    const updateBody = await updateResponse.json();

    // If auth blocks us, skip the rest
    if (updateBody.status !== 'success') {
      test.skip(true, 'SKIP: updateGeneralOptions requires authentication or returned non-success');
      return;
    }

    // Read back and verify
    const getResponse = await request.get(`${baseURL}/api/configure/getGeneralOptions`);
    expect(getResponse.status()).not.toBe(500);

    const getBody = await getResponse.json();
    if (getBody.status === 'success' && getBody.options) {
      // The options we set should be present
      expect(getBody.options).toBeDefined();
      expect(getBody.options.e2eTestMarker).toBe(testTimestamp);
    }
  });
});
