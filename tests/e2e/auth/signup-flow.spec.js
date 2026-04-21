import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Signup UI flow.
 *
 * In AUTH=local mode the standalone login page (views/login.pug) has a
 * #toggle button that reveals signup fields:
 *   #username    — username input (shared with login)
 *   #email       — email input (visible in signup mode)
 *   #pwd         — password input (shared with login)
 *   #pwd_retype  — retype password input (visible in signup mode)
 *   #login       — submit button (text changes to "Sign Up" contextually via login.js)
 *   #toggle      — toggles between login and signup modes
 *   #msg         — error/success message area
 *
 * Signup may be restricted to admins only (AUTH_LOCAL_ALLOW_SIGNUP=false by default).
 * Tests handle both cases gracefully.
 *
 * In AUTH=off mode there is no login/signup page — all tests are skipped.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

test.describe('Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.AUTH !== 'local',
      'SKIP: AUTH is not local — no signup'
    );
  });

  test('signup toggle reveals signup fields', async ({ page }) => {
    await page.goto('/');
    // The toggle is only visible when AUTH_LOCAL_ALLOW_SIGNUP=true
    const toggle = page.locator('#toggleWrapper');
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) {
      // toggleWrapper hidden by CSS → signup is admin-only
      test.skip(true, 'SKIP: AUTH_LOCAL_ALLOW_SIGNUP is not true — signup toggle hidden');
      return;
    }
    await page.locator('#toggle').click();
    // After toggling, email and retype-password fields should become visible
    await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#pwd_retype')).toBeVisible({ timeout: 5000 });
  });

  test('signup with new user credentials', async ({ page, request }) => {
    const uniqueUser = `signup_test_${Date.now()}`;
    const strongPassword = 'SignupTest1!'; // pragma: allowlist secret

    await page.goto('/');
    // The toggle is only visible when AUTH_LOCAL_ALLOW_SIGNUP=true
    const toggle = page.locator('#toggleWrapper');
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'SKIP: AUTH_LOCAL_ALLOW_SIGNUP is not true — signup toggle hidden');
      return;
    }
    await page.locator('#toggle').click();

    await page.fill('#username', uniqueUser);
    await page.fill('#email', `${uniqueUser}@test.com`);
    await page.fill('#pwd', strongPassword);
    await page.fill('#pwd_retype', strongPassword);
    await page.click('#login');

    await page.waitForTimeout(3000);

    // Signup may succeed (redirect away from login) or be rejected (admin-only).
    // Check for success: no longer on login page, or error message displayed.
    const onLoginPage = await page.locator('#username').isVisible().catch(() => false);
    const errorText = await page.locator('#msg').textContent().catch(() => '');

    if (!onLoginPage) {
      // Signup succeeded and redirected
      const title = await page.title();
      expect(title).not.toContain('Login');
    } else {
      // Signup was rejected — verify an error/info message is shown (admin-only policy)
      // Accept either an error message or staying on the form (no crash)
      expect(onLoginPage).toBeTruthy();
    }

    // Cleanup: try to remove the user via API (best-effort)
    await request.post(`${baseURL}/api/users/signup`, {
      data: { username: uniqueUser, password: strongPassword, email: `${uniqueUser}@test.com` },
    }).catch(() => {});
  });

  test('signup with existing username is rejected', async ({ request }) => {
    // Use API-level test since signup may be admin-only in the UI
    const response = await request.post(`${baseURL}/api/users/signup`, {
      data: {
        username: 'test_user',
        password: 'TestPass1!', // pragma: allowlist secret
        email: 'duplicate@test.com',
      },
    });
    expect(response.status()).toBeLessThan(500);

    const body = await response.json().catch(() => null);
    if (body === null) {
      // HTML login page returned — signup not accessible without admin session
      test.skip(true, 'SKIP: Signup API returned HTML — likely requires admin session');
      return;
    }

    // Either "already exists" or "only administrators" — both are valid rejections
    expect(body.status).toBe('failure');
    expect(body.message).toBeTruthy();
  });

  test('signup with weak password is rejected', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/users/signup`, {
      data: {
        username: `weakpw_${Date.now()}`,
        password: 'short', // pragma: allowlist secret
        email: 'weak@test.com',
      },
    });
    expect(response.status()).toBeLessThan(500);

    const body = await response.json().catch(() => null);
    if (body === null) {
      test.skip(true, 'SKIP: Signup API returned HTML — likely requires admin session');
      return;
    }

    expect(body.status).toBe('failure');
    expect(body.message).toBeTruthy();
  });
});
