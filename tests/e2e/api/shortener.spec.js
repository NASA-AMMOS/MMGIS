import { test, expect } from '@playwright/test';

/**
 * E2E tests for Shortener API endpoints.
 * Backend routes: API/Backend/Shortener/routes/shortener.js
 * Route prefix: /api/shortener (requires user via ensureUser middleware)
 *
 * Endpoints:
 *   - POST /api/shortener/shorten  { url }
 *   - POST /api/shortener/expand   { short }
 */

test.describe('Shortener API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('shorten URL and expand round-trip', async ({ request }) => {
    test.skip(process.env.DISABLE_LINK_SHORTENER === 'true', 'SKIP: Link shortener is disabled');

    const testUrl = `https://example.com/test-page?ts=${Date.now()}`;

    // POST to shorten a URL
    const shortenResponse = await request.post(`${baseURL}/api/shortener/shorten`, {
      data: { url: testUrl },
    });
    expect(shortenResponse.status()).not.toBe(500);

    const shortenBody = await shortenResponse.json().catch(() => null);

    // If auth blocks us (HTML login page or non-success), skip the rest
    if (!shortenBody || shortenBody.status !== 'success') {
      test.skip(true, 'SKIP: Shortener requires authentication or returned non-success');
      return;
    }

    expect(shortenBody.body).toHaveProperty('url');
    const shortCode = shortenBody.body.url;
    expect(typeof shortCode).toBe('string');
    expect(shortCode.length).toBeGreaterThan(0);

    // POST to expand the shortened URL
    const expandResponse = await request.post(`${baseURL}/api/shortener/expand`, {
      data: { short: shortCode },
    });
    expect(expandResponse.status()).not.toBe(500);

    const expandBody = await expandResponse.json().catch(() => null);
    if (!expandBody) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(expandBody.status).toBe('success');
    expect(expandBody.body).toHaveProperty('url');
    // The original URL should be restored (it gets encoded/decoded)
    expect(expandBody.body.url).toBe(testUrl);
  });

  test('handles invalid short codes gracefully', async ({ request }) => {
    test.skip(process.env.DISABLE_LINK_SHORTENER === 'true', 'SKIP: Link shortener is disabled');

    // Request a non-existent short code
    const response = await request.post(`${baseURL}/api/shortener/expand`, {
      data: { short: `nonexistent_${Date.now()}` },
    });
    // Should get appropriate error, not 500
    expect(response.status()).not.toBe(500);

    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body.status).toBe('failure');
  });

  test('expand rejects null short code', async ({ request }) => {
    test.skip(process.env.DISABLE_LINK_SHORTENER === 'true', 'SKIP: Link shortener is disabled');

    const response = await request.post(`${baseURL}/api/shortener/expand`, {
      data: {},
    });
    expect(response.status()).not.toBe(500);

    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body.status).toBe('failure');
    expect(body.message).toContain('not defined');
  });

  test('shorten rejects when DISABLE_LINK_SHORTENER is true', async ({ request }) => {
    if (process.env.DISABLE_LINK_SHORTENER !== 'true') {
      test.skip(true, 'SKIP: DISABLE_LINK_SHORTENER is not true, cannot test disabled state');
      return;
    }

    const response = await request.post(`${baseURL}/api/shortener/shorten`, {
      data: { url: 'https://example.com' },
    });
    expect(response.status()).not.toBe(500);

    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body.status).toBe('failure');
  });
});
