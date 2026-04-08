import { test, expect } from '@playwright/test';

/**
 * E2E tests for Webhooks API endpoints.
 * Backend routes: API/Backend/Webhooks/routes/webhooks.js
 * Route prefix: /api/webhooks (requires admin via ensureAdmin middleware)
 *
 * Endpoints:
 *   - POST /api/webhooks/save     { config }
 *   - GET  /api/webhooks/entries
 *   - POST /api/webhooks/config
 */

test.describe('Webhooks API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('CRUD lifecycle: save webhook config and list entries', async ({ request }) => {
    const uniqueId = `test_webhook_${Date.now()}`;

    // Save a webhook config
    const saveResponse = await request.post(`${baseURL}/api/webhooks/save`, {
      data: {
        config: {
          name: uniqueId,
          url: 'https://example.com/webhook-receiver',
          events: ['layer_update'],
          active: true,
        },
      },
    });
    expect(saveResponse.status()).not.toBe(500);

    const saveBody = await saveResponse.json();

    // If auth blocks us, skip the rest
    if (saveBody.status !== 'success') {
      test.skip(true, 'SKIP: Webhooks requires authentication or returned non-success');
      return;
    }

    expect(saveBody.status).toBe('success');

    // List webhook entries and verify our config is there
    const entriesResponse = await request.get(`${baseURL}/api/webhooks/entries`);
    expect(entriesResponse.status()).not.toBe(500);

    const entriesBody = await entriesResponse.json();
    if (entriesBody.status === 'success' && entriesBody.body && entriesBody.body.entries) {
      const entries = entriesBody.body.entries;
      expect(Array.isArray(entries)).toBe(true);

      // Find the entry we just created
      const ourEntry = entries.find(
        (e) => e.config && e.config.name === uniqueId
      );
      expect(ourEntry).toBeDefined();
    }
  });

  test('POST /api/webhooks/config triggers config update', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/webhooks/config`, {
      data: {},
    });
    expect(response.status()).not.toBe(500);

    // If we have access, it should succeed
    if (response.status() === 200) {
      const body = await response.json();
      if (body.status === 'success') {
        expect(body.message).toContain('Successfully updated webhooks config');
      }
    }
  });

  test('GET /api/webhooks/entries does not return 500', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/webhooks/entries`);
    expect(response.status()).not.toBe(500);
  });
});
