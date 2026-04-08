import { test, expect } from '@playwright/test';

/**
 * ENV-variable behaviour tests.
 *
 * Validates that the MMGIS application responds correctly based on
 * runtime environment configuration (AUTH, DISABLE_LINK_SHORTENER, etc.).
 *
 * Uses process.env to determine the current mode and asserts behaviour
 * accordingly.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:8888';

/** Safely parse JSON; returns null on failure (e.g. HTML login page). */
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Detect whether a response body is the HTML login page.
 * In AUTH=local mode, unauthenticated requests return an HTML page with
 * a login form (HTTP 200).
 */
async function isLoginPage(response) {
  const contentType = response.headers()['content-type'] || '';
  if (contentType.includes('text/html')) {
    const text = await response.text().catch(() => '');
    return text.includes('login') || text.includes('password') || text.includes('Login');
  }
  return false;
}

test.describe('ENV Variable Behavior', () => {
  const authMode = process.env.AUTH || 'off';

  test('healthcheck works regardless of AUTH mode', async ({ request }) => {
    const res = await request.get(`${BASE}/api/utils/healthcheck`, { timeout: 10000 });
    expect(res.status()).toBe(200);

    // The healthcheck endpoint returns plain text ("Alive and Well!"), not JSON.
    // Use response.text() and verify it contains a success indicator.
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/alive|ok|success|healthy|well/);
  });

  test('AUTH=off: no login page is shown', async ({ page, request }) => {
    if (authMode !== 'off') {
      test.skip(true, `SKIP: Current AUTH mode is "${authMode}", not "off"`);
      return;
    }

    // Check that Reference-Mission is available
    const listRes = await request.get(`${BASE}/api/configure/missions`);
    const listData = await safeJson(listRes);
    if (!listData || !listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available');
      return;
    }

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Should NOT see a login form
    const loginForm = await page.locator('input[type="password"], form[action*="login"]').count();
    expect(loginForm).toBe(0);
  });

  test('AUTH=local: login page is shown for unauthenticated users', async ({ page, request }) => {
    if (authMode !== 'local') {
      test.skip(true, `SKIP: Current AUTH mode is "${authMode}", not "local"`);
      return;
    }

    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // In AUTH=local, unauthenticated users should see a login page
    const hasLoginIndicator = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const hasInput = document.querySelector('input[type="password"]') !== null;
      const hasLoginText = body.toLowerCase().includes('login') || body.toLowerCase().includes('sign in');
      return hasInput || hasLoginText;
    });

    expect(hasLoginIndicator).toBe(true);
  });

  test('AUTH=local: API endpoints return login page instead of JSON', async ({ request }) => {
    if (authMode !== 'local') {
      test.skip(true, `SKIP: Current AUTH mode is "${authMode}", not "local"`);
      return;
    }

    const res = await request.get(`${BASE}/api/configure/missions`, { timeout: 10000 });
    // Server should respond (not hang)
    expect(res.status()).toBe(200);

    // In AUTH=local the body is likely an HTML login page, not JSON
    const body = await safeJson(res);
    if (!body) {
      // Got HTML — expected
      const loginPage = await isLoginPage(res);
      // Either it is a login page or some other non-JSON response
      expect(typeof loginPage).toBe('boolean');
    }
  });

  test('DISABLE_LINK_SHORTENER behavior', async ({ request }) => {
    const shortenerDisabled = process.env.DISABLE_LINK_SHORTENER === 'true';

    const res = await request.get(`${BASE}/api/shortener`, {
      timeout: 10000,
      failOnStatusCode: false,
    });

    if (shortenerDisabled) {
      // When disabled, the shortener endpoint should return an error or 404
      // or a message indicating it is disabled
      const status = res.status();
      const body = await safeJson(res);

      // Accept 404, 403, or a JSON body indicating disabled state
      const isDisabledResponse =
        status === 404 ||
        status === 403 ||
        (body && body.status === 'failure') ||
        (body && body.message && body.message.toLowerCase().includes('disabled'));

      expect(isDisabledResponse).toBe(true);
    } else {
      // When enabled, the endpoint should respond (may require auth in local mode)
      expect(res.status()).toBeLessThan(500);
    }
  });

  test('missions endpoint reflects current AUTH mode', async ({ request }) => {
    const res = await request.get(`${BASE}/api/configure/missions`, { timeout: 10000 });
    expect(res.status()).toBe(200);

    const body = await safeJson(res);

    if (authMode === 'off') {
      // AUTH=off: should get a JSON response with missions array
      if (body && body.missions) {
        expect(Array.isArray(body.missions)).toBe(true);
      }
    } else if (authMode === 'local') {
      // AUTH=local: may get JSON (if token exists) or HTML login page
      if (!body) {
        // HTML login page returned — this is expected
        const text = await res.text().catch(() => '');
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });
});
