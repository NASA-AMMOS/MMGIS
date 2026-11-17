/**
 * Page Object Model for MMGIS login / signup pages.
 *
 * Provides helpers for authenticating users via the browser UI, signing up
 * new accounts, and logging out.
 */
export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  /**
   * Log in with the given credentials.
   *
   * @param {string} username - Username or email.
   * @param {string} password - Password.
   */
  async login(username, password) {
    // Navigate to the login page if not already there
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');

    // Fill credentials
    const usernameInput = this.page.locator(
      'input[name="username"], input[name="user"], input[placeholder*="user" i], input[type="text"]',
    ).first();
    await usernameInput.fill(username);

    const passwordInput = this.page.locator(
      'input[name="password"], input[type="password"]',
    ).first();
    await passwordInput.fill(password);

    // Submit the form
    const submitBtn = this.page.locator('button[type="submit"], button')
      .filter({ hasText: /log\s*in|sign\s*in|submit/i })
      .first();
    await submitBtn.click();

    await this.page.waitForLoadState('networkidle');
  }

  // ---------------------------------------------------------------------------
  // Signup
  // ---------------------------------------------------------------------------

  /**
   * Sign up a new user account.
   *
   * @param {string} username - Desired username.
   * @param {string} password - Desired password.
   * @param {string} email    - Email address.
   */
  async signup(username, password, email) {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');

    // Click the "Sign Up" / "Register" link or tab
    const signupLink = this.page.locator('a, button, [class*="signup"], [class*="register"]')
      .filter({ hasText: /sign\s*up|register/i })
      .first();
    await signupLink.click();

    // Fill signup form
    const usernameInput = this.page.locator(
      'input[name="username"], input[placeholder*="user" i]',
    ).first();
    await usernameInput.fill(username);

    const emailInput = this.page.locator(
      'input[name="email"], input[type="email"], input[placeholder*="email" i]',
    ).first();
    await emailInput.fill(email);

    const passwordInput = this.page.locator(
      'input[name="password"], input[type="password"]',
    ).first();
    await passwordInput.fill(password);

    // Submit
    const submitBtn = this.page.locator('button[type="submit"], button')
      .filter({ hasText: /sign\s*up|register|create|submit/i })
      .first();
    await submitBtn.click();

    await this.page.waitForLoadState('networkidle');
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  /**
   * Log out of the current session.
   */
  async logout() {
    // Try the user menu first, then a direct logout link/button
    const userMenu = this.page.locator(
      '[class*="user-menu"], [class*="account"], [class*="avatar"]',
    ).first();
    if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userMenu.click();
    }

    const logoutBtn = this.page.locator('a, button')
      .filter({ hasText: /log\s*out|sign\s*out/i })
      .first();
    await logoutBtn.click();

    await this.page.waitForLoadState('networkidle');
  }
}
