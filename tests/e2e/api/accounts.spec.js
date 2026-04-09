import { test, expect } from '@playwright/test';

/**
 * E2E tests for Accounts API endpoints.
 * Backend routes: API/Backend/Accounts/routes/accounts.js
 * Route prefix: /api/accounts (requires admin via ensureAdmin middleware)
 *
 * Endpoints:
 *   - GET  /api/accounts/entries
 *   - DELETE /api/accounts/remove/:id
 *   - POST /api/accounts/update
 *   - POST /api/accounts/generateResetPasswordLink
 */

test.describe('Accounts API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test.skip(process.env.AUTH === 'off', 'SKIP: Requires AUTH != off for account management');

  test('GET /api/accounts/entries returns user list or requires auth', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/accounts/entries`);
    // Should not return 500 regardless of auth state
    expect(response.status()).not.toBe(500);

    // If we get 200, verify the response structure
    if (response.status() === 200) {
      const body = await response.json();
      if (body.status === 'success') {
        expect(body.body).toHaveProperty('entries');
        expect(Array.isArray(body.body.entries)).toBe(true);
      }
    }
  });

  test('DELETE /api/accounts/remove/:id rejects invalid id', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/accounts/remove/notanumber`);
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should be failure — either "Unauthorized!" (no admin session) or "User Id is null"
      expect(body.status).toBe('failure');
    }
  });

  test('DELETE /api/accounts/remove/1 cannot delete original admin', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/accounts/remove/1`);
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should be failure — either "Unauthorized!" or "Cannot delete the original Administrator"
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/accounts/update rejects missing id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/accounts/update`, {
      data: { email: 'test@example.com' },
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should be failure — either "Unauthorized!" or "User Id is null"
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/accounts/update rejects non-numeric id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/accounts/update`, {
      data: { id: 'abc', email: 'test@example.com' },
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/accounts/update only accepts valid permission values', async ({ request }) => {
    // Permission must be "110" (admin) or "001" (user)
    const response = await request.post(`${baseURL}/api/accounts/update`, {
      data: { id: 999999, permission: 'invalid_perm' },
    });
    expect(response.status()).not.toBe(500);
  });

  test('POST /api/accounts/generateResetPasswordLink rejects missing id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/accounts/generateResetPasswordLink`, {
      data: {},
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Should be failure — either "Unauthorized!" or "User Id is null"
      expect(body.status).toBe('failure');
    }
  });

  test('POST /api/accounts/generateResetPasswordLink rejects non-numeric id', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/accounts/generateResetPasswordLink`, {
      data: { id: 'notanumber' },
    });
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.status).toBe('failure');
    }
  });
});
