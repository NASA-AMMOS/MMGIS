import { test, expect } from '@playwright/test';

/**
 * @turf/turf geometry unit tests.
 *
 * Validates that the named exports used by the Draw tool
 * (bbox, difference) are available and produce correct results.
 * Also checks circle and other helpers used elsewhere in MMGIS.
 */

test.describe('@turf/turf — named exports', () => {
  test('bbox computes correct bounding box', async () => {
    const { bbox } = await import('@turf/turf');
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
      properties: {},
    };
    const bb = bbox(polygon);
    expect(bb).toEqual([0, 0, 10, 10]);
  });

  test('difference subtracts one polygon from another', async () => {
    const { polygon, difference } = await import('@turf/turf');
    const poly1 = polygon([[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]);
    const poly2 = polygon([[[5, 0], [15, 0], [15, 10], [5, 10], [5, 0]]]);
    const result = difference(poly1, poly2);
    expect(result).toBeDefined();
    expect(result.geometry).toBeDefined();
  });

  test('circle generates a polygon approximation', async () => {
    const { circle } = await import('@turf/turf');
    const circ = circle([0, 0], 10, { units: 'kilometers' });
    expect(circ.type).toBe('Feature');
    expect(circ.geometry.type).toBe('Polygon');
    expect(circ.geometry.coordinates[0].length).toBeGreaterThan(4);
  });

  test('all functions used by Draw tool are available', async () => {
    const turf = await import('@turf/turf');
    const requiredFunctions = ['bbox', 'difference', 'circle', 'polygon', 'featureCollection'];
    for (const fn of requiredFunctions) {
      expect(typeof turf[fn]).toBe('function');
    }
  });
});
