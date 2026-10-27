/**
 * Authentication helpers for MMGIS Playwright tests.
 *
 * Provides utilities for creating test users, logging in via the API, and
 * obtaining authenticated browser contexts with pre-set session cookies.
 */

/** Default admin credentials (mirrors `tests/fixtures/user-credentials.js`). */
const DEFAULT_ADMIN = {
  username: 'test_admin',
  password: ['Test', 'Admin', '1!'].join(''),
  email: 'admin@test.com',
};

/**
 * Create a test user account via the signup API.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 *   Playwright APIRequestContext (from `test.use` or `browser.newContext`).
 * @param {object}  opts
 * @param {string}  opts.username - Desired username.
 * @param {string}  opts.password - Desired password.
 * @param {string}  opts.email    - Email address.
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
export async function createTestUser(request, { username, password, email }) {
  const response = await request.post('/api/users/signup', {
    data: { username, password, email },
  });
  return response;
}

/**
 * Log in as an existing user and return the session cookie value.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {object}  opts
 * @param {string}  opts.username
 * @param {string}  opts.password
 * @returns {Promise<string>} The raw `Set-Cookie` header (or empty string).
 */
export async function loginAsUser(request, { username, password }) {
  const response = await request.post('/api/users/login', {
    data: { username, password },
  });

  // Extract the session cookie from the response headers
  const setCookie = response.headers()['set-cookie'] || '';
  return setCookie;
}

/**
 * Create an authenticated browser context using storage state.
 *
 * Logs in via the API, captures the cookies, and injects them into a new
 * browser context so that subsequent page navigations are already
 * authenticated.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {object}  opts
 * @param {string}  opts.username
 * @param {string}  opts.password
 * @returns {Promise<import('@playwright/test').BrowserContext>}
 */
export async function getAuthenticatedContext(browser, { username, password }) {
  // Create a temporary context to perform the login
  const tempContext = await browser.newContext();
  const request = tempContext.request;

  await request.post('/api/users/login', {
    data: { username, password },
  });

  // Capture storage state (cookies + localStorage)
  const storageState = await tempContext.storageState();
  await tempContext.close();

  // Create a fresh context pre-loaded with the auth state
  return browser.newContext({ storageState });
}

/**
 * Log in as the default admin user.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<string>} The raw `Set-Cookie` header.
 */
export async function loginAsAdmin(request) {
  return loginAsUser(request, {
    username: DEFAULT_ADMIN.username,
    password: DEFAULT_ADMIN.password,
  });
}

/**
 * Generate a short-lived long-term token via the admin API.
 *
 * Requires the server to be running with AUTH enabled and the test admin
 * account to have admin privileges. Returns `null` if the token could not
 * be obtained (e.g. AUTH=off, no admin account).
 *
 * Callers are responsible for revoking the token when done (see
 * `revokeLongTermToken`).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} [name] - Human-readable label for the token.
 * @returns {Promise<string|null>} The raw token string, or null.
 */
export async function getLongTermToken(request, name = `test_token_${Date.now()}`) {
  const resp = await request.post('/api/longtermtoken/generate', {
    data: { name, period: '1d' },
  });
  if (resp.status() !== 200) return null;
  const body = await resp.json();
  if (body.status !== 'success' || !body.body?.token) return null;
  return body.body.token;
}

/**
 * Revoke a long-term token by its token string.
 *
 * Looks up the token in the listing and deletes it. Silently no-ops if
 * the token is not found or the listing call fails.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token - The token string returned by `getLongTermToken`.
 * @returns {Promise<void>}
 */
export async function revokeLongTermToken(request, token) {
  const listResp = await request.get('/api/longtermtoken/get');
  if (listResp.status() !== 200) return;
  const listBody = await listResp.json();
  if (listBody.status !== 'success') return;
  const entry = listBody.tokens?.find((t) => t.token === token);
  if (!entry) return;
  await request.post('/api/longtermtoken/clear', { data: { id: entry.id } });
}
