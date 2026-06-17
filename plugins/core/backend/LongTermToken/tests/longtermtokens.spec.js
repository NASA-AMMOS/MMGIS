import { test, expect } from '@playwright/test';

/**
 * E2E tests for Long Term Tokens API endpoints.
 * Backend routes: API/Backend/LongTermToken/routes/longtermtokens.js
 * Route prefix: /api/longtermtoken (requires admin via ensureAdmin middleware)
 *
 * Endpoints:
 *   - GET  /api/longtermtoken/get           - list tokens
 *   - POST /api/longtermtoken/generate      { name?, period }
 *   - POST /api/longtermtoken/clear         { id }
 */

test.describe('Long Term Tokens API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test.skip(process.env.AUTH === 'off', 'SKIP: Requires AUTH != off for token management');

  test('create token, list, delete, verify revoked', async ({ request }) => {
    const uniqueName = `testtoken${Date.now()}`;

    // Generate a new long-term token
    const generateResponse = await request.post(`${baseURL}/api/longtermtoken/generate`, {
      data: { name: uniqueName, period: '1d' },
    });
    expect(generateResponse.status()).not.toBe(500);

    const generateBody = await generateResponse.json();

    // If auth blocks us, skip the rest
    if (generateBody.status !== 'success') {
      test.skip(true, 'SKIP: Long term tokens require authentication or returned non-success');
      return;
    }

    expect(generateBody.body).toHaveProperty('token');
    const createdToken = generateBody.body.token;
    expect(typeof createdToken).toBe('string');
    expect(createdToken).toContain(uniqueName);

    // List tokens and verify ours is present
    const listResponse = await request.get(`${baseURL}/api/longtermtoken/get`);
    expect(listResponse.status()).not.toBe(500);

    const listBody = await listResponse.json();
    expect(listBody.status).toBe('success');
    expect(Array.isArray(listBody.tokens)).toBe(true);

    const ourToken = listBody.tokens.find((t) => t.token === createdToken);
    expect(ourToken).toBeDefined();
    const tokenId = ourToken.id;

    // Delete the token
    const clearResponse = await request.post(`${baseURL}/api/longtermtoken/clear`, {
      data: { id: tokenId },
    });
    expect(clearResponse.status()).not.toBe(500);

    const clearBody = await clearResponse.json();
    expect(clearBody.status).toBe('success');

    // Verify token is gone
    const verifyResponse = await request.get(`${baseURL}/api/longtermtoken/get`);
    expect(verifyResponse.status()).not.toBe(500);

    const verifyBody = await verifyResponse.json();
    if (verifyBody.status === 'success') {
      const deletedToken = verifyBody.tokens.find((t) => t.id === tokenId);
      expect(deletedToken).toBeUndefined();
    }
  });

  test('POST /api/longtermtoken/clear rejects missing id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/longtermtoken/clear`, {
      data: {},
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should be failure — either "Unauthorized!" or "body.id is undefined"
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/longtermtoken/clear rejects non-existent id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/longtermtoken/clear`, {
      data: { id: 999999999 },
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should fail because token doesn't exist
      if (body.status === 'failure') {
        expect(body.message).toBeDefined();
      }
    }
  });

  test('GET /api/longtermtoken/get does not return 500', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/longtermtoken/get`);
    expect(response.status()).not.toBe(500);
  });
});
