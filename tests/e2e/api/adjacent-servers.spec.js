import { test, expect } from '@playwright/test';

/**
 * E2E tests for Adjacent Server proxy routes.
 * Backend routes: adjacent-servers/adjacent-servers-proxy.js
 *
 * These proxies are conditionally enabled via environment variables:
 *   - WITH_STAC=true   -> /stac   proxy to stac-fastapi
 *   - WITH_TIPG=true   -> /tipg   proxy to tipg
 *   - WITH_TITILER=true -> /titiler proxy to titiler
 *   - WITH_TITILER_PGSTAC=true -> /titilerpgstac proxy
 *   - WITH_VELOSERVER=true -> /veloserver proxy
 *
 * When disabled, these routes may return 404, 504 (gateway timeout),
 * or redirect to the login page (200 with HTML) depending on AUTH mode.
 */

/**
 * Returns true when the response looks like a real proxy response
 * (i.e. NOT the login page HTML served by AUTH=local).
 */
function isProxyAccessible(response) {
  const ct = response.headers()['content-type'] || '';
  // If the server returned HTML it is the login/landing page, not the proxy
  if (ct.includes('text/html') && response.ok()) return false;
  return response.ok();
}

test.describe('Adjacent Servers API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('STAC proxy is not accessible when disabled', async ({ request }) => {
    if (process.env.WITH_STAC === 'true') {
      test.skip(true, 'SKIP: STAC is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/stac`);
    // When proxy is disabled, expect the proxy itself to not be reachable.
    // In AUTH=local the server may return the login page (200 HTML) — that is NOT the proxy.
    expect(isProxyAccessible(response)).toBeFalsy();
  });

  test('TiPG proxy is not accessible when disabled', async ({ request }) => {
    if (process.env.WITH_TIPG === 'true') {
      test.skip(true, 'SKIP: TiPG is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/tipg`);
    expect(isProxyAccessible(response)).toBeFalsy();
  });

  test('TiTiler proxy is not accessible when disabled', async ({ request }) => {
    if (process.env.WITH_TITILER === 'true') {
      test.skip(true, 'SKIP: TiTiler is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/titiler`);
    expect(isProxyAccessible(response)).toBeFalsy();
  });

  test('TiTiler-pgSTAC proxy is not accessible when disabled', async ({ request }) => {
    if (process.env.WITH_TITILER_PGSTAC === 'true') {
      test.skip(true, 'SKIP: TiTiler-pgSTAC is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/titilerpgstac`);
    expect(isProxyAccessible(response)).toBeFalsy();
  });

  test('Veloserver proxy is not accessible when disabled', async ({ request }) => {
    if (process.env.WITH_VELOSERVER === 'true') {
      test.skip(true, 'SKIP: Veloserver is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/veloserver`);
    expect(isProxyAccessible(response)).toBeFalsy();
  });
});
