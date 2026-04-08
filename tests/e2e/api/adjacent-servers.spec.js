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
 * When disabled, these routes should return 404.
 */

test.describe('Adjacent Servers API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('STAC proxy returns 404 when disabled', async ({ request }) => {
    if (process.env.WITH_STAC === 'true') {
      test.skip(true, 'SKIP: STAC is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/stac`);
    expect(response.status()).toBe(404);
  });

  test('TiPG proxy returns 404 when disabled', async ({ request }) => {
    if (process.env.WITH_TIPG === 'true') {
      test.skip(true, 'SKIP: TiPG is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/tipg`);
    expect(response.status()).toBe(404);
  });

  test('TiTiler proxy returns 404 when disabled', async ({ request }) => {
    if (process.env.WITH_TITILER === 'true') {
      test.skip(true, 'SKIP: TiTiler is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/titiler`);
    expect(response.status()).toBe(404);
  });

  test('TiTiler-pgSTAC proxy returns 404 when disabled', async ({ request }) => {
    if (process.env.WITH_TITILER_PGSTAC === 'true') {
      test.skip(true, 'SKIP: TiTiler-pgSTAC is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/titilerpgstac`);
    expect(response.status()).toBe(404);
  });

  test('Veloserver proxy returns 404 when disabled', async ({ request }) => {
    if (process.env.WITH_VELOSERVER === 'true') {
      test.skip(true, 'SKIP: Veloserver is enabled, skipping disabled test');
    }
    const response = await request.get(`${baseURL}/veloserver`);
    expect(response.status()).toBe(404);
  });
});
