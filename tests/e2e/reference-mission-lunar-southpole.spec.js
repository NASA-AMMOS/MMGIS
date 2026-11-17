import { test, expect } from '@playwright/test';

/**
 * Reference Mission Lunar South Pole - Smoke Tests
 *
 * Validates that the Lunar South Pole reference mission variant loads
 * correctly with IAU2000:30120 south polar stereographic projection.
 */

test.describe('Reference Mission Lunar South Pole - Smoke Tests', () => {
  const missionName = 'Reference-Mission-Lunar-SouthPole';

  test.beforeEach(async ({ request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes(missionName)) {
      test.skip(true, `SKIP: ${missionName} not available in this CI mode`);
    }
  });

  test('mission loads without crashes', async ({ page }) => {
    await page.goto(`/?mission=${missionName}`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await expect(page).toHaveTitle(/MMGIS/i);
  });

  test('projection uses IAU2000:30120', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const res = await request.get(
      `${baseURL}/api/configure/get?mission=${missionName}`
    );
    const data = await res.json();
    expect(data.projection).toBeDefined();
    expect(data.projection.epsg).toBe('IAU2000:30120');
    expect(data.projection.custom).toBe(true);
    expect(data.projection.proj).toContain('+proj=stere');
    expect(data.projection.proj).toContain('+lat_0=-90');
  });

  test('tools are configured', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const res = await request.get(
      `${baseURL}/api/configure/get?mission=${missionName}`
    );
    const data = await res.json();
    const toolNames = (data.tools || []).map((t) => t.name);
    expect(toolNames).toContain('Layers');
    expect(toolNames).toContain('Draw');
    expect(toolNames).toContain('Measure');
  });

  test('globe panel is disabled', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const res = await request.get(
      `${baseURL}/api/configure/get?mission=${missionName}`
    );
    const data = await res.json();
    expect(data.panels.globe).toBe(false);
  });

  test('layers contain South Pole 100m basemap', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const res = await request.get(
      `${baseURL}/api/configure/get?mission=${missionName}`
    );
    const data = await res.json();
    expect(data.layers.length).toBeGreaterThan(0);
    const basemapHeader = data.layers.find((l) => l.name === 'Basemap');
    expect(basemapHeader).toBeDefined();
    const spole = basemapHeader.sublayers.find(
      (l) => l.name === 'South Pole 100m'
    );
    expect(spole).toBeDefined();
    expect(spole.type).toBe('tile');
    expect(spole.url).toContain('SPole_100m');
  });
});
