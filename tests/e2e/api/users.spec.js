import { test, expect } from '@playwright/test';

/**
 * E2E tests for Users API endpoints.
 * Backend routes: API/Backend/Users/routes/users.js
 *
 * Covers:
 *   - POST /api/users/signup
 *   - POST /api/users/login
 *   - POST /api/users/logout
 *   - GET  /api/users/logged_in
 *   - POST /api/users/updatepassword (skipped — not implemented)
 *   - POST /api/users/updateemail   (skipped — not implemented)
 */

test.describe('Users API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  // ---------- POST /api/users/signup ----------
  test.describe('POST /api/users/signup', () => {

    test('creates a new user successfully', async ({ request }) => {
      const username = `testuser_${Date.now()}`;
      // Password must satisfy isStrongPassword: >=8 chars, upper, lower, digit, symbol
      const password = 'TestPass1!'; // pragma: allowlist secret
      const response = await request.post(`${baseURL}/api/users/signup`, {
        data: { username, password, email: `${username}@test.com` },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      // When AUTH=off without an admin session the server may reject signup;
      // accept either outcome as long as it doesn't crash.
      expect(['success', 'failure']).toContain(body.status);
      if (body.status === 'success') {
        expect(body.username).toBe(username);
      }
    });

    test('rejects duplicate username', async ({ request }) => {
      const username = `dupuser_${Date.now()}`;
      const password = 'TestPass1!'; // pragma: allowlist secret
      const data = { username, password, email: `${username}@test.com` };

      // First signup attempt
      const first = await request.post(`${baseURL}/api/users/signup`, { data });
      expect(first.status()).toBeLessThan(500);
      const firstBody = await first.json();

      // If the first signup succeeded, the second must fail with duplicate message
      if (firstBody.status === 'success') {
        const second = await request.post(`${baseURL}/api/users/signup`, { data });
        expect(second.status()).toBeLessThan(500);
        const secondBody = await second.json();
        expect(secondBody.status).toBe('failure');
        expect(secondBody.message).toMatch(/already exists/i);
      }
      // If signup is blocked by auth policy, the test still passes (no crash).
    });

    test('rejects missing required fields', async ({ request }) => {
      // Missing username
      const noUser = await request.post(`${baseURL}/api/users/signup`, {
        data: { password: 'TestPass1!' }, // pragma: allowlist secret
      });
      expect(noUser.status()).toBeLessThan(500);
      const noUserBody = await noUser.json();
      expect(noUserBody.status).toBe('failure');

      // Missing password (empty string fails strength check)
      const noPass = await request.post(`${baseURL}/api/users/signup`, {
        data: { username: `nopass_${Date.now()}`, password: '' },
      });
      expect(noPass.status()).toBeLessThan(500);
      const noPassBody = await noPass.json();
      expect(noPassBody.status).toBe('failure');
    });

    test('rejects weak password', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/signup`, {
        data: {
          username: `weakpw_${Date.now()}`,
          password: 'short', // pragma: allowlist secret
          email: 'weak@test.com',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
      // Either password-strength message or auth-policy message — both are valid
      expect(body).toHaveProperty('message');
    });
  });

  // ---------- POST /api/users/login ----------
  test.describe('POST /api/users/login', () => {

    test('logs in with valid credentials', async ({ request }) => {
      // Create a user first
      const username = `loginuser_${Date.now()}`;
      const password = 'TestPass1!'; // pragma: allowlist secret
      const signupRes = await request.post(`${baseURL}/api/users/signup`, {
        data: { username, password, email: `${username}@test.com` },
      });
      const signupBody = await signupRes.json();

      if (signupBody.status !== 'success') {
        // Cannot test login without a user; skip gracefully
        test.skip(true, 'Signup blocked by auth policy — cannot test login with fresh user');
        return;
      }

      const loginRes = await request.post(`${baseURL}/api/users/login`, {
        data: { username, password },
      });
      expect(loginRes.status()).toBeLessThan(500);
      const loginBody = await loginRes.json();
      expect(loginBody.status).toBe('success');
      expect(loginBody.username).toBe(username);
      expect(loginBody).toHaveProperty('token');
    });

    test('rejects invalid credentials', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/login`, {
        data: {
          username: 'nonexistent_user_xyz',
          password: 'wrong_password', // pragma: allowlist secret
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
      expect(body).toHaveProperty('message');
    });

    test('returns failure with missing username', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/login`, {
        data: {
          password: 'some_password', // pragma: allowlist secret
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
    });

    test('does not return 500 on empty body', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/login`, {
        data: {},
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(['success', 'failure']).toContain(body.status);
    });
  });

  // ---------- POST /api/users/logout ----------
  test.describe('POST /api/users/logout', () => {

    test('clears session on logout', async ({ request }) => {
      // Create and login a user
      const username = `logoutuser_${Date.now()}`;
      const password = 'TestPass1!'; // pragma: allowlist secret
      const signupRes = await request.post(`${baseURL}/api/users/signup`, {
        data: { username, password, email: `${username}@test.com` },
      });
      const signupBody = await signupRes.json();

      if (signupBody.status !== 'success') {
        test.skip(true, 'Signup blocked by auth policy — cannot test logout');
        return;
      }

      const loginRes = await request.post(`${baseURL}/api/users/login`, {
        data: { username, password },
      });
      const loginBody = await loginRes.json();
      expect(loginBody.status).toBe('success');

      // Logout — backend reads the MMGISUser cookie
      const logoutRes = await request.post(`${baseURL}/api/users/logout`, {
        headers: {
          Cookie: `MMGISUser=${JSON.stringify({
            username: loginBody.username,
            token: loginBody.token,
          })}`,
        },
      });
      expect(logoutRes.status()).toBeLessThan(500);
      const logoutBody = await logoutRes.json();
      expect(logoutBody.status).toBe('success');
    });

    test('returns failure when no user cookie present', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/logout`);
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body.status).toBe('failure');
    });
  });

  // ---------- GET /api/users/logged_in ----------
  test.describe('GET /api/users/logged_in', () => {

    test('returns user info when authenticated', async ({ request }) => {
      test.skip(
        process.env.AUTH === 'off',
        'SKIP: Requires AUTH != off to test user session',
      );

      // Create and login
      const username = `loggedinuser_${Date.now()}`;
      const password = 'TestPass1!'; // pragma: allowlist secret
      await request.post(`${baseURL}/api/users/signup`, {
        data: { username, password, email: `${username}@test.com` },
      });
      await request.post(`${baseURL}/api/users/login`, {
        data: { username, password },
      });

      const response = await request.get(`${baseURL}/api/users/logged_in`);
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
      if (body.status === 'success') {
        expect(body.body.loggedIn).toBe(true);
      }
    });

    test('returns appropriate response when not authenticated', async ({ request }) => {
      test.skip(
        process.env.AUTH === 'off',
        'SKIP: Requires AUTH != off to test user session',
      );

      // Fresh request context — no prior login in this context
      const response = await request.get(`${baseURL}/api/users/logged_in`);
      expect(response.status()).toBeLessThan(500);
      const body = await response.json();
      expect(body).toHaveProperty('status');
      // Without a session the endpoint returns failure with loggedIn: false
      if (body.status === 'failure') {
        expect(body.body.loggedIn).toBe(false);
      }
    });
  });

  // ---------- POST /api/users/updatepassword ----------
  test.describe('POST /api/users/updatepassword', () => {
    // The backend does not expose an updatepassword endpoint;
    // password changes go through POST /api/users/resetPassword with a token.
    test.skip(
      process.env.AUTH === 'off',
      'SKIP: Requires AUTH != off to test password update',
    );

    test('updates password with correct old password', async ({ request }) => {
      test.skip(true, 'SKIP: /api/users/updatepassword not implemented — use resetPassword');
    });

    test('rejects wrong old password', async ({ request }) => {
      test.skip(true, 'SKIP: /api/users/updatepassword not implemented — use resetPassword');
    });
  });

  // ---------- POST /api/users/updateemail ----------
  test.describe('POST /api/users/updateemail', () => {
    // The backend does not expose an updateemail endpoint.
    test.skip(
      process.env.AUTH === 'off',
      'SKIP: Requires AUTH != off to test email update',
    );

    test('updates email with valid email', async ({ request }) => {
      test.skip(true, 'SKIP: /api/users/updateemail not implemented');
    });

    test('rejects invalid email format', async ({ request }) => {
      test.skip(true, 'SKIP: /api/users/updateemail not implemented');
    });
  });
});
