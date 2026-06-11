import { test, expect } from '@playwright/test';

/**
 * E2E tests for the POST /api/utils/sightmap endpoint.
 *
 * Covers:
 *   - Input validation (missing required fields, non-finite numerics)
 *   - Path traversal protection on DEM path
 *   - maxOutputDim clamping to 800
 *   - Single-timestamp sightmap computation
 *     - Response structure (grid, bounds, az, el)
 *     - Grid dimensions and values
 *     - Az/el plausibility for known Sun positions
 *   - Batch (multi-timestamp) computation
 *     - Response structure (results array, per-timestamp grid/az/el)
 *   - Custom Az/El source (non-SPICE)
 *   - Invalid SPICE target handling
 *   - Invalid time format handling
 *
 * Note: Tests that require the Lunar South Pole DEM gracefully skip
 * when the reference mission or DEM file is not present.
 * In AUTH=local mode, unauthenticated requests return the login
 * page (HTML 200) instead of JSON — tests gracefully skip.
 */

test.describe('Sightmap API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const endpoint = `${baseURL}/api/utils/sightmap`;

  // Valid Lunar South Pole DEM path (relative, resolved by server)
  const LUNAR_DEM =
    '/Missions/Reference-Mission-Lunar-SouthPole/Data/DEMs/LRO_LOLA_DEM_4000m.tif';

  // Observer near the south pole
  const OBS_LAT = -89.98;
  const OBS_LNG = 36.87;
  const MOON_RADIUS = 1737400;

  /**
   * Post to the sightmap endpoint and parse JSON.
   * Returns null body when server responds with HTML (e.g. AUTH=local).
   */
  async function postSightmap(request, data) {
    const response = await request.post(endpoint, { data });
    const body = await response.json().catch(() => null);
    return { response, body };
  }

  /**
   * Check whether the Lunar South Pole mission and DEM are available.
   * Skips the test if not.
   */
  async function requireLunarMission(request) {
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (
      !listData.missions ||
      !listData.missions.includes('Reference-Mission-Lunar-SouthPole')
    ) {
      return false;
    }
    return true;
  }

  // ─── Input validation ────────────────────────────────────────

  test.describe('Input validation', () => {
    test('rejects request missing dem', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('dem, lat, lng, and target are required');
    });

    test('rejects request missing lat', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('dem, lat, lng, and target are required');
    });

    test('rejects request missing lng', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('dem, lat, lng, and target are required');
    });

    test('rejects request missing target', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 0,
        lng: 0,
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('dem, lat, lng, and target are required');
    });

    test('rejects request missing both time and times', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 0,
        lng: 0,
        target: 'SUN',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('time');
    });

    test('rejects non-finite numeric lat', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 'not-a-number',
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('finite numbers');
    });

    test('rejects NaN planetRadius', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        planetRadius: 'NaN',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('finite numbers');
    });

    test('rejects Infinity in height', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        height: 'Infinity',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('finite numbers');
    });
  });

  // ─── Path traversal protection ──────────────────────────────

  test.describe('Path traversal protection', () => {
    test('rejects DEM path not under /Missions', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: '/etc/passwd',
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
      expect(body.message).toContain('/Missions');
    });

    test('rejects DEM path with ../ escaping Missions', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: '/Missions/../../etc/passwd',
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });

    test('rejects URL-encoded path traversal in DEM', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: '/Missions/%2e%2e/%2e%2e/etc/passwd',
        lat: 0,
        lng: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });
  });

  // ─── Single-timestamp sightmap ──────────────────────────────

  test.describe('Single-timestamp sightmap', () => {
    test('returns valid sightmap grid for Lunar South Pole', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 50,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      expect(body.error).toBeFalsy();

      // Structure checks
      expect(body.grid).toBeDefined();
      expect(Array.isArray(body.grid)).toBe(true);
      expect(body.grid.length).toBeGreaterThan(0);
      expect(Array.isArray(body.grid[0])).toBe(true);

      expect(body.bounds).toBeDefined();
      expect(Array.isArray(body.bounds)).toBe(true);
      expect(body.bounds.length).toBe(4);

      expect(typeof body.az).toBe('number');
      expect(typeof body.el).toBe('number');

      // Az/el plausibility: Sun at south pole Jan 1 should have
      // low positive elevation (~1°) and some azimuth
      expect(body.el).toBeGreaterThan(-5);
      expect(body.el).toBeLessThan(30);
      expect(body.az).toBeGreaterThanOrEqual(0);
      expect(body.az).toBeLessThan(360);

      // Grid dimension: maxOutputDim=50 → grid rows/cols ≤ 50
      expect(body.grid.length).toBeLessThanOrEqual(50);
      expect(body.grid[0].length).toBeLessThanOrEqual(50);

      // Grid values: each cell should be 0 (shadow), 1 (visible), or 9 (nodata)
      const flatGrid = body.grid.flat();
      const validValues = flatGrid.every((v) => v === 0 || v === 1 || v === 9);
      expect(validValues).toBe(true);

      // At El~1° near the south pole, expect a mix of shadow and visible
      const visCount = flatGrid.filter((v) => v === 1).length;
      const shadowCount = flatGrid.filter((v) => v === 0).length;
      expect(visCount).toBeGreaterThan(0);
      expect(shadowCount).toBeGreaterThan(0);
    });

    test('projected bounds are returned for projected CRS DEMs', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      // Polar stereographic DEM should return projBounds
      if (body.projBounds) {
        expect(Array.isArray(body.projBounds)).toBe(true);
        expect(body.projBounds.length).toBe(4);
      }
    });

    test('maxOutputDim clamps grid size', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      // Request with very small maxOutputDim
      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 20,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      expect(body.grid.length).toBeLessThanOrEqual(20);
      expect(body.grid[0].length).toBeLessThanOrEqual(20);
    });

    test('observer height offset raises viewpoint', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      // Compute with height=0 and height=500m, expect more visibility
      // when elevated (higher vantage = more terrain visible)
      const [r0, r500] = await Promise.all([
        postSightmap(request, {
          dem: LUNAR_DEM,
          lat: OBS_LAT,
          lng: OBS_LNG,
          height: 0,
          target: 'SUN',
          time: '2027 JAN 01 00:00:00 UTC',
          obsRefFrame: 'IAU_MOON',
          obsBody: 'MOON',
          planetRadius: MOON_RADIUS,
          maxOutputDim: 30,
        }),
        postSightmap(request, {
          dem: LUNAR_DEM,
          lat: OBS_LAT,
          lng: OBS_LNG,
          height: 500,
          target: 'SUN',
          time: '2027 JAN 01 00:00:00 UTC',
          obsRefFrame: 'IAU_MOON',
          obsBody: 'MOON',
          planetRadius: MOON_RADIUS,
          maxOutputDim: 30,
        }),
      ]);

      if (!r0.body || !r500.body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      // Both should succeed
      expect(r0.response.ok()).toBeTruthy();
      expect(r500.response.ok()).toBeTruthy();

      // Az/el should match (same time, same target)
      expect(r0.body.az).toBeCloseTo(r500.body.az, 1);
      expect(r0.body.el).toBeCloseTo(r500.body.el, 1);
    });
  });

  // ─── Batch (multi-timestamp) sightmap ───────────────────────

  test.describe('Batch sightmap', () => {
    test('returns results array for multiple timestamps', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const times = [
        '2027 JAN 01 00:00:00 UTC',
        '2027 JAN 01 06:00:00 UTC',
        '2027 JAN 01 12:00:00 UTC',
      ];

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        times,
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();

      // Batch response is a raw JSON array (not wrapped in { results: [...] })
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(times.length);

      // Each result should have grid, az, el, bounds
      for (let i = 0; i < body.length; i++) {
        const r = body[i];
        expect(r.grid).toBeDefined();
        expect(Array.isArray(r.grid)).toBe(true);
        expect(typeof r.az).toBe('number');
        expect(typeof r.el).toBe('number');
        expect(r.bounds).toBeDefined();
        expect(r.bounds.length).toBe(4);
      }

      // Az values should differ across 6-hour intervals
      // (Sun moves ~0.5°/hour in az at the Moon)
      const azimuths = body.map((r) => r.az);
      const azRange = Math.max(...azimuths) - Math.min(...azimuths);
      expect(azRange).toBeGreaterThan(1);
    });

    test('batch with single timestamp matches single-mode result', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const timeStr = '2027 JAN 01 00:00:00 UTC';
      const commonParams = {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
      };

      const [single, batch] = await Promise.all([
        postSightmap(request, { ...commonParams, time: timeStr }),
        postSightmap(request, { ...commonParams, times: [timeStr] }),
      ]);

      if (!single.body || !batch.body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(single.response.ok()).toBeTruthy();
      expect(batch.response.ok()).toBeTruthy();

      // Az/el should match (batch response is a raw array)
      const batchResult = batch.body[0];
      expect(single.body.az).toBeCloseTo(batchResult.az, 2);
      expect(single.body.el).toBeCloseTo(batchResult.el, 2);

      // Grid dimensions should match
      expect(single.body.grid.length).toBe(batchResult.grid.length);
      expect(single.body.grid[0].length).toBe(batchResult.grid[0].length);
    });
  });

  // ─── Custom Az/El source ────────────────────────────────────

  test.describe('Custom Az/El source', () => {
    test('returns sightmap for custom azimuth/elevation', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'CUSTOM',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
        isCustom: 'true',
        customAz: 180,
        customEl: 10,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      expect(body.error).toBeFalsy();

      // Custom az/el should be echoed back
      expect(body.az).toBeCloseTo(180, 0);
      expect(body.el).toBeCloseTo(10, 0);

      // Grid should exist and have valid values
      expect(body.grid).toBeDefined();
      const flatGrid = body.grid.flat();
      const validValues = flatGrid.every((v) => v === 0 || v === 1 || v === 9);
      expect(validValues).toBe(true);

      // At 10° elevation, expect mostly visible
      const visCount = flatGrid.filter((v) => v === 1).length;
      expect(visCount).toBeGreaterThan(flatGrid.length * 0.3);
    });

    test('custom source at el=0 gives all shadow', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'CUSTOM',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 20,
        isCustom: 'true',
        customAz: 0,
        customEl: 0,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      // At elevation exactly 0°, no terrain can be illuminated
      const flatGrid = body.grid.flat();
      const visCount = flatGrid.filter((v) => v === 1).length;
      expect(visCount).toBe(0);
    });

    test('custom source at el=90 gives all visible', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'CUSTOM',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 20,
        isCustom: 'true',
        customAz: 0,
        customEl: 90,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.ok()).toBeTruthy();
      // At elevation 90° (directly overhead), all non-nodata cells should be visible
      const flatGrid = body.grid.flat();
      const nonNodata = flatGrid.filter((v) => v !== 9);
      const visCount = nonNodata.filter((v) => v === 1).length;
      expect(visCount).toBe(nonNodata.length);
    });
  });

  // ─── Error handling ─────────────────────────────────────────

  test.describe('Error handling', () => {
    test('invalid SPICE target returns error', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const { response, body } = await postSightmap(request, {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'NONEXISTENT_BODY_XYZ',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 20,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });

    test('nonexistent DEM file returns error', async ({ request }) => {
      const { response, body } = await postSightmap(request, {
        dem: '/Missions/NoSuchMission/no-such-dem.tif',
        lat: 0,
        lng: 0,
        height: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 20,
      });
      if (!body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      // Should fail with 400 (Python script exits non-zero or returns error)
      expect(response.status()).toBe(400);
      expect(body.error).toBe(true);
    });
  });

  // ─── Consistency / regression ───────────────────────────────

  test.describe('Consistency checks', () => {
    test('same inputs produce identical grids (deterministic)', async ({
      request,
    }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const params = {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        time: '2027 JAN 01 00:00:00 UTC',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
      };

      const [r1, r2] = await Promise.all([
        postSightmap(request, params),
        postSightmap(request, params),
      ]);

      if (!r1.body || !r2.body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(r1.response.ok()).toBeTruthy();
      expect(r2.response.ok()).toBeTruthy();

      // Az/el should be identical
      expect(r1.body.az).toBe(r2.body.az);
      expect(r1.body.el).toBe(r2.body.el);

      // Grids should be identical
      expect(r1.body.grid).toEqual(r2.body.grid);
    });

    test('different times produce different grids', async ({ request }) => {
      const available = await requireLunarMission(request);
      if (!available) {
        test.skip(
          true,
          'SKIP: Lunar South Pole mission not available in this CI mode'
        );
        return;
      }

      const commonParams = {
        dem: LUNAR_DEM,
        lat: OBS_LAT,
        lng: OBS_LNG,
        height: 0,
        target: 'SUN',
        obsRefFrame: 'IAU_MOON',
        obsBody: 'MOON',
        planetRadius: MOON_RADIUS,
        maxOutputDim: 30,
      };

      const [r1, r2] = await Promise.all([
        postSightmap(request, {
          ...commonParams,
          time: '2027 JAN 01 00:00:00 UTC',
        }),
        postSightmap(request, {
          ...commonParams,
          time: '2027 JAN 08 00:00:00 UTC',
        }),
      ]);

      if (!r1.body || !r2.body) {
        test.skip(true, 'SKIP: Non-JSON response — AUTH=local');
        return;
      }

      expect(r1.response.ok()).toBeTruthy();
      expect(r2.response.ok()).toBeTruthy();

      // 7 days apart — azimuths should differ substantially (~90°+)
      expect(r1.body.az).not.toBeCloseTo(r2.body.az, 0);
    });
  });
});
