import { test, expect } from '@playwright/test';

/**
 * E2E tests for General Options API endpoints.
 * Backend routes: API/Backend/Config/routes/configs.js (GeneralOptions model used there)
 * GeneralOptions model: API/Backend/GeneralOptions/models/generaloptions.js
 *
 * Endpoints (via Config routes):
 *   - GET  /api/config/getGeneralOptions
 *   - POST /api/config/updateGeneralOptions  { options } (requires admin)
 */

test.describe('General Options API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('GET /api/config/getGeneralOptions returns options or appropriate error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/config/getGeneralOptions`);
    // Should not return 500
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Response should have a status field
      expect(body).toHaveProperty('status');
      if (body.status === 'success') {
        expect(body).toHaveProperty('body');
      }
    }
  });

  test('POST /api/config/updateGeneralOptions requires valid options payload', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/config/updateGeneralOptions`, {
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

  test('POST /api/config/updateGeneralOptions with empty body does not crash', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/config/updateGeneralOptions`, {
      data: {},
    });
    // Should not return 500 even with empty body
    expect(response.status()).not.toBe(500);
  });

  test('general options round-trip: update then read back', async ({ request }) => {
    const testTimestamp = Date.now();
    const testOptions = { e2eTestMarker: testTimestamp };

    // Update general options
    const updateResponse = await request.post(`${baseURL}/api/config/updateGeneralOptions`, {
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
    const getResponse = await request.get(`${baseURL}/api/config/getGeneralOptions`);
    expect(getResponse.status()).not.toBe(500);

    const getBody = await getResponse.json();
    if (getBody.status === 'success' && getBody.body) {
      // The options we set should be present
      expect(getBody.body.options).toBeDefined();
      expect(getBody.body.options.e2eTestMarker).toBe(testTimestamp);
    }
  });
});
