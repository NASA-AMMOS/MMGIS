import { test, expect } from '@playwright/test';
import { TEST_ADMIN } from '../../fixtures/user-credentials.js';

/**
 * E2E tests for the Login UI flow.
 *
 * In AUTH=local mode, unauthenticated requests to "/" are served a standalone
 * login page (views/login.pug) with:
 *   #username  — username text input
 *   #pwd       — password input
 *   #login     — "Log In" button
 *   #msg       — error message span
 *   #toggle    — "Or Sign Up" toggle
 *
 * In AUTH=off mode there is no login page — all tests are skipped.
 */

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.MMGIS_TEST_SITE_ACCESS !== 'required',
      'SKIP: AUTH is not local — no login page'
    );
  });

  test('login page is displayed when AUTH=local', async ({ page }) => {
    await page.goto('/');
    // The standalone login page should render these elements
    await expect(page.locator('#username')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#pwd')).toBeVisible();
    await expect(page.locator('#login')).toBeVisible();
  });

  test('login with valid credentials succeeds', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').waitFor({ state: 'visible', timeout: 10000 });
    await page.fill('#username', TEST_ADMIN.username);
    await page.fill('#pwd', TEST_ADMIN.password);
    // After login, the page reloads into the app instead of the login page.
    // Only this first load is checked: an account keeps one saved login, so another
    // suite signing in as the same account can sign this page out on its next reload
    const appLoad = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/' &&
        r.request().method() === 'GET' &&
        r.request().isNavigationRequest()
    );
    // The page reloads as soon as login succeeds, so the response is read on its way in
    let loginBody = null;
    await page.route('**/api/users/login', async (route) => {
      const response = await route.fetch();
      if (route.request().method() === 'POST' && loginBody === null)
        loginBody = await response.json().catch(() => ({}));
      await route.fulfill({ response });
    });
    await page.click('#login');
    const appPage = await (await appLoad).text();
    expect(loginBody && loginBody.status).toBe('success');
    expect(appPage).not.toContain('<title>MMGIS / Login</title>');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').waitFor({ state: 'visible', timeout: 10000 });
    await page.fill('#username', 'nonexistent_user');
    await page.fill('#pwd', 'wrong_password');
    await page.click('#login');
    // Should show error message and stay on login page
    await page.waitForTimeout(2000);
    const errorMsg = page.locator('#msg');
    // Error message should be visible or non-empty, or we're still on the login page
    const msgText = await errorMsg.textContent().catch(() => '');
    expect(msgText.length > 0 || await page.locator('#username').isVisible()).toBeTruthy();
  });

  test('login with empty fields does not crash', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login').waitFor({ state: 'visible', timeout: 10000 });
    await page.click('#login');
    // Should show validation or error, not crash
    await page.waitForTimeout(1000);
    // Page should still be responsive
    await expect(page.locator('#username')).toBeVisible();
  });
});
