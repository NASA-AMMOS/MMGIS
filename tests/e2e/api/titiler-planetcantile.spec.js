import { test, expect } from '@playwright/test';

/**
 * E2E tests for TiTiler Planetcantile integration.
 *
 * These tests verify that TiTiler is configured with planetcantile
 * TileMatrixSet definitions for planetary body support. When WITH_TITILER
 * is enabled, TiTiler should expose tile matrix sets for Mars, Moon,
 * Europa, and other planetary bodies via the /titiler proxy.
 */

/**
 * Returns true when the response looks like a real proxy response
 * (i.e. NOT the login page HTML served by AUTH=local).
 */
function isProxyAccessible(response) {
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('text/html') && response.ok()) return false;
  return response.ok();
}

test.describe('TiTiler Planetcantile Integration', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test.beforeEach(async () => {
    if (process.env.WITH_TITILER !== 'true') {
      test.skip(true, 'SKIP: WITH_TITILER is not enabled');
    }
  });

  test('TiTiler proxy is accessible when enabled', async ({ request }) => {
    const response = await request.get(`${baseURL}/titiler`);
    expect(isProxyAccessible(response)).toBeTruthy();
  });

  test('tileMatrixSets endpoint returns a list', async ({ request }) => {
    const response = await request.get(`${baseURL}/titiler/tileMatrixSets`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(Array.isArray(body.tileMatrixSets)).toBe(true);
    expect(body.tileMatrixSets.length).toBeGreaterThan(0);
  });

  test('Planetcantile TMS definitions are loaded', async ({ request }) => {
    const response = await request.get(`${baseURL}/titiler/tileMatrixSets`);
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
    const response = await request.get(
      `${baseURL}/titiler/tileMatrixSets/MarsWebMercatorSphere`
    );
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

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
    const response = await request.get(
      `${baseURL}/titiler/tileMatrixSets/MarsWebMercatorSphere`
    );
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.crs).toContain('Mars');
  });

  test('colorMaps endpoint is accessible', async ({ request }) => {
    const response = await request.get(`${baseURL}/titiler/colorMaps`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(Array.isArray(body.colorMaps)).toBe(true);
    expect(body.colorMaps.length).toBeGreaterThan(0);
  });
});
