import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../../../../tests/helpers/auth.js';

/**
 * E2E tests for the Broadcast API.
 * Backend routes: plugins/core/backend/Broadcast/routes/broadcast.js
 * Route prefix: /api/broadcast (requires admin via ensureAdmin middleware)
 *
 * Endpoints:
 *   - POST /api/broadcast/layerUpdate  { mission, layerName: string | string[] }
 *
 * The test server runs with ENABLE_MMGIS_WEBSOCKETS unset, so a valid
 * request is expected to succeed with `broadcasted: false`.
 */

test.describe('Broadcast API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('POST /api/broadcast/layerUpdate rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/broadcast/layerUpdate`, {
      data: { mission: 'Reference-Mission', layerName: 'some-layer' },
    });
    expect(response.status()).not.toBe(500);
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('application/json')) {
      const body = await response.json();
      expect(body.status).toBe('failure');
    } else {
      // AUTH=local may redirect to the login page
      expect(response.ok()).toBeTruthy();
    }
  });

  test('POST /api/broadcast/layerUpdate validates body and reports websocket state', async ({ request }) => {
    // The request fixture keeps the session cookie after login
    const setCookie = await loginAsAdmin(request);
    if (!setCookie) {
      test.skip(true, 'SKIP: could not log in as admin (AUTH=off has no login)');
      return;
    }

    // Missing layerName
    let response = await request.post(`${baseURL}/api/broadcast/layerUpdate`, {
      data: { mission: 'Reference-Mission' },
    });
    let body = await response.json();
    if (body.message === 'Unauthorized!') {
      test.skip(true, 'SKIP: admin session not accepted in this AUTH mode');
      return;
    }
    expect(body.status).toBe('failure');
    expect(body.message).toContain('layerName');

    // Missing mission
    response = await request.post(`${baseURL}/api/broadcast/layerUpdate`, {
      data: { layerName: 'some-layer' },
    });
    body = await response.json();
    expect(body.status).toBe('failure');
    expect(body.message).toContain('mission');

    // Valid single layer
    response = await request.post(`${baseURL}/api/broadcast/layerUpdate`, {
      data: { mission: 'Reference-Mission', layerName: 'some-layer' },
    });
    body = await response.json();
    expect(body.status).toBe('success');
    expect(typeof body.broadcasted).toBe('boolean');
    expect(body.broadcasted).toBe(process.env.ENABLE_MMGIS_WEBSOCKETS === 'true');

    // Valid array of layers
    response = await request.post(`${baseURL}/api/broadcast/layerUpdate`, {
      data: { mission: 'Reference-Mission', layerName: ['layer-a', 'layer-b'] },
    });
    body = await response.json();
    expect(body.status).toBe('success');
  });
});
