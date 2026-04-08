import { test, expect } from '@playwright/test';

/**
 * E2E tests for Users API endpoints.
 * Backend routes: API/Backend/Users/routes/users.js
 *
 * Currently covers:
 *   - POST /api/users/login (impacted by return-value fix in pass() callback)
 *
 * Future tests can cover:
 *   - POST /api/users/signup
 *   - POST /api/users/logout
 *   - GET  /api/users/logged-in
 *   - POST /api/users/updatepassword
 *   - POST /api/users/updateemail
 */

test.describe('Users API', () => {

  test.describe('POST /api/users/login', () => {

    test('returns failure with invalid credentials', async ({ request }) => {
      const response = await request.post('/api/users/login', {
        data: {
          username: 'nonexistent_user_xyz',
          password: 'wrong_password',  // pragma: allowlist secret
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
      expect(body).toHaveProperty('message');
    });

    test('returns failure with missing username', async ({ request }) => {
      const response = await request.post('/api/users/login', {
        data: {
          password: 'some_password',  // pragma: allowlist secret
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
    });

    test('does not return 500 on valid login attempt', async ({ request }) => {
      // Even if guest login is disabled, the endpoint should respond gracefully
      const response = await request.post('/api/users/login', {
        data: {
          username: 'guest',
          password: '',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
      // status is either 'success' or 'failure' depending on config — both are valid
      expect(['success', 'failure']).toContain(body.status);
    });

  });

});
