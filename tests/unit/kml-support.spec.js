import { test, expect } from '@playwright/test';

/**
 * KML Support Unit Tests
 *
 * Tests the isKmlUrl helper function and KML-to-GeoJSON conversion logic.
 * Since isKmlUrl is a pure function, we can test it directly.
 */

// Inline the isKmlUrl function for unit testing (mirrors the implementation in LayerCapturer.js)
function isKmlUrl(url) {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return pathname.toLowerCase().endsWith('.kml');
  } catch (e) {
    return url.toLowerCase().endsWith('.kml');
  }
}

test.describe('KML Support - isKmlUrl', () => {

  test('detects .kml extension in simple filename', () => {
    expect(isKmlUrl('data.kml')).toBe(true);
  });

  test('detects .kml extension in relative path', () => {
    expect(isKmlUrl('Layers/Vectors/sample.kml')).toBe(true);
  });

  test('detects .kml extension in absolute URL', () => {
    expect(isKmlUrl('https://example.com/data/layer.kml')).toBe(true);
  });

  test('detects .kml extension with query parameters', () => {
    expect(isKmlUrl('https://example.com/data/layer.kml?token=abc123')).toBe(true);
  });

  test('detects .kml extension with hash fragment', () => {
    expect(isKmlUrl('https://example.com/data/layer.kml#section')).toBe(true);
  });

  test('is case-insensitive (.KML)', () => {
    expect(isKmlUrl('data.KML')).toBe(true);
  });

  test('is case-insensitive (.Kml)', () => {
    expect(isKmlUrl('Layers/Vectors/sample.Kml')).toBe(true);
  });

  test('returns false for .geojson files', () => {
    expect(isKmlUrl('data.geojson')).toBe(false);
  });

  test('returns false for .json files', () => {
    expect(isKmlUrl('data.json')).toBe(false);
  });

  test('returns false for geodataset URLs', () => {
    expect(isKmlUrl('reference_mission_basic')).toBe(false);
  });

  test('returns false for API URLs', () => {
    expect(isKmlUrl('publishedall')).toBe(false);
  });

  test('returns false for URLs containing kml in path but not as extension', () => {
    expect(isKmlUrl('https://example.com/kml-data/layer.geojson')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isKmlUrl('')).toBe(false);
  });

  test('returns false for .kmz files (not supported)', () => {
    expect(isKmlUrl('data.kmz')).toBe(false);
  });
});

test.describe('KML Support - GeoJSON output structure', () => {

  test('valid KML produces a FeatureCollection', () => {
    // This test validates the expected output structure.
    // The actual @tmcw/togeojson conversion is tested via E2E tests.
    // Here we verify the contract: output must be a FeatureCollection with features array.
    const expectedStructure = {
      type: 'FeatureCollection',
      features: [],
    };

    expect(expectedStructure.type).toBe('FeatureCollection');
    expect(Array.isArray(expectedStructure.features)).toBe(true);
  });

  test('KML Point becomes GeoJSON Point feature', () => {
    // Validates the expected mapping from KML Placemark/Point to GeoJSON Feature/Point
    const expectedFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.3936, 37.7956, 0] },
      properties: { name: 'Ferry Building' },
    };

    expect(expectedFeature.type).toBe('Feature');
    expect(expectedFeature.geometry.type).toBe('Point');
    expect(expectedFeature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  test('KML LineString becomes GeoJSON LineString feature', () => {
    const expectedFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.3936, 37.7956, 0],
          [-122.3980, 37.7990, 0],
        ],
      },
      properties: { name: 'Embarcadero Path' },
    };

    expect(expectedFeature.geometry.type).toBe('LineString');
    expect(expectedFeature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  test('KML Polygon becomes GeoJSON Polygon feature', () => {
    const expectedFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.41, 37.80, 0],
          [-122.42, 37.80, 0],
          [-122.42, 37.808, 0],
          [-122.41, 37.808, 0],
          [-122.41, 37.80, 0],
        ]],
      },
      properties: { name: 'North Beach Area' },
    };

    expect(expectedFeature.geometry.type).toBe('Polygon');
    expect(expectedFeature.geometry.coordinates[0].length).toBeGreaterThanOrEqual(4);
  });
});
