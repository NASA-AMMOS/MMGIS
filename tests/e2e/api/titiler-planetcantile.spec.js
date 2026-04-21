import { test, expect } from '@playwright/test';

/**
 * E2E tests for TiTiler Planetcantile integration.
 *
 * These tests verify that TiTiler is configured with planetcantile
 * TileMatrixSet definitions for planetary body support. When WITH_TITILER
 * is enabled, TiTiler should expose tile matrix sets for Mars, Moon,
 * Europa, and other planetary bodies via the /titiler proxy.
 *
 * Note: sample.env ships WITH_TITILER=true so the env var alone is not
 * sufficient to know if TiTiler is actually running. Each test probes the
 * proxy and skips when the server is unreachable.
 */

/**
 * Returns true when the TiTiler proxy is reachable (response is OK and
 * is NOT the login/landing page HTML served by AUTH=local).
 */
function isTitilerAccessible(response) {
  if (!response.ok()) return false;
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('text/html')) return false;
  return true;
}

test.describe('TiTiler Planetcantile Integration', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test('TiTiler proxy is accessible when enabled', async ({ request }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    expect(probe.ok()).toBeTruthy();
  });

  test('tileMatrixSets endpoint returns a list', async ({ request }) => {
    const response = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(response)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('json');

    const body = await response.json();
    expect(Array.isArray(body.tileMatrixSets)).toBe(true);
    expect(body.tileMatrixSets.length).toBeGreaterThan(0);
  });

  test('Planetcantile TMS definitions are loaded', async ({ request }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    const response = probe;
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const tmsIds = body.tileMatrixSets.map((s) => s.id);

    expect(tmsIds).toContain('MarsWebMercatorSphere');
    expect(tmsIds).toContain('MarsGeographicSphere');
    expect(tmsIds).toContain('MoonWebMercatorSphere');
    expect(tmsIds).toContain('EuropaWebMercatorSphere');
  });

  test('Specific planetary TileMatrixSet details are retrievable', async ({
    request,
  }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    const response = await request.get(
      `${baseURL}/titiler/tileMatrixSets/MarsWebMercatorSphere`
    );
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('json');

    const body = await response.json();
    expect(body.id).toBe('MarsWebMercatorSphere');
    expect(typeof body.crs).toBe('string');
    expect(body.crs.length).toBeGreaterThan(0);
    expect(Array.isArray(body.tileMatrices)).toBe(true);
    expect(body.tileMatrices.length).toBeGreaterThan(0);
    expect(Array.isArray(body.orderedAxes)).toBe(true);
  });

  test('Planetary TMS has correct tile matrix structure', async ({
    request,
  }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    const response = await request.get(
      `${baseURL}/titiler/tileMatrixSets/MarsWebMercatorSphere`
    );
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const firstMatrix = body.tileMatrices[0];

    expect(firstMatrix).toHaveProperty('id');
    expect(firstMatrix).toHaveProperty('scaleDenominator');
    expect(firstMatrix).toHaveProperty('cellSize');
    expect(firstMatrix).toHaveProperty('tileWidth');
    expect(firstMatrix).toHaveProperty('tileHeight');
    expect(firstMatrix).toHaveProperty('matrixWidth');
    expect(firstMatrix).toHaveProperty('matrixHeight');
    expect(firstMatrix).toHaveProperty('pointOfOrigin');
    expect(firstMatrix.tileWidth).toBe(256);
    expect(firstMatrix.tileHeight).toBe(256);
  });

  test('Non-Earth TMS has non-Earth CRS', async ({ request }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    const response = await request.get(
      `${baseURL}/titiler/tileMatrixSets/MarsWebMercatorSphere`
    );
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.crs).toContain('Mars');
  });

  test('colorMaps endpoint is accessible', async ({ request }) => {
    const probe = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    if (!isTitilerAccessible(probe)) {
      test.skip(true, 'SKIP: TiTiler proxy is not reachable');
    }
    const response = await request.get(`${baseURL}/titiler/cog/colorMaps`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('json');

    const body = await response.json();
    expect(Array.isArray(body.colorMaps) || (typeof body.colorMaps === 'object' && body.colorMaps !== null)).toBe(true);
  });
});
