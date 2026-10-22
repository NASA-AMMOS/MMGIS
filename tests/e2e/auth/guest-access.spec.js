import { test, expect } from '@playwright/test';

/**
 * Guests on sites that allow them (SITE_ACCESS=public or optional) can browse,
 * but cannot read the signed-in-only shared mission folder or write through
 * adjacent-server proxies.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
// Denials are a redirect, a 401/403, or the JSON "Unauthorized" failure the admin gate sends
async function blocked(r) {
  if ([301, 302, 303, 401, 403].includes(r.status())) return true;
  const body = await r.json().catch(() => null);
  return body != null && body.status === 'failure' && /unauthori/i.test(body.message || '');
}

test.describe('Guests on open sites', () => {
  test.skip(
    !['off', 'none'].includes(process.env.MMGIS_TEST_AUTH_MODE),
    'SKIP: needs SITE_ACCESS=public or optional'
  );

  test('guests cannot read the shared mission folder', async ({ request }) => {
    const r = await request.get(`${baseURL}/Missions/shared/anything.json`, { maxRedirects: 0 });
    expect(await blocked(r), `status ${r.status()}`).toBe(true);
  });

  for (const path of ['/stac/collections', '/tipg/collections', '/titiler/cog/info', '/titilerpgstac/collections']) {
    test(`guests cannot write through ${path}`, async ({ request }) => {
      const read = await request.get(`${baseURL}${path}`, { maxRedirects: 0 });
      test.skip(read.status() === 404, `${path} is not proxied in this run`);
      for (const method of ['post', 'put', 'delete']) {
        const r = await request[method](`${baseURL}${path}`, { data: {}, maxRedirects: 0 });
        expect(await blocked(r), `${method.toUpperCase()} ${path}: ${r.status()}`).toBe(true);
      }
    });
  }
});
