/**
 * Test user credentials for MMGIS Playwright tests.
 *
 * Values are read from environment variables when available, falling back to
 * conventional defaults for local development. The accounts are created
 * during test setup (see `tests/helpers/auth.js`).
 *
 * Environment variables:
 *   TEST_ADMIN_USER, TEST_ADMIN_PASS, TEST_ADMIN_EMAIL
 *   TEST_USER_USER, TEST_USER_PASS, TEST_USER_EMAIL
 *   TEST_LEAD_USER, TEST_LEAD_PASS, TEST_LEAD_EMAIL
 */

/** Admin user — has full configure/manage permissions. */
export const TEST_ADMIN = {
  username: process.env.TEST_ADMIN_USER || 'test_admin',
  password: process.env.TEST_ADMIN_PASS || ['Test', 'Admin', '1!'].join(''),
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
};

/** Regular user — standard viewer/contributor. */
export const TEST_USER = {
  username: process.env.TEST_USER_USER || 'test_user',
  password: process.env.TEST_USER_PASS || ['test', 'user', '123'].join(''),
  email: process.env.TEST_USER_EMAIL || 'user@test.com',
};

/** Lead user — elevated permissions (e.g. can manage draw files). */
export const TEST_LEAD = {
  username: process.env.TEST_LEAD_USER || 'test_lead',
  password: process.env.TEST_LEAD_PASS || ['test', 'lead', '123'].join(''),
  email: process.env.TEST_LEAD_EMAIL || 'lead@test.com',
};
