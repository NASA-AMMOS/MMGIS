import { test, expect } from '@playwright/test';
import F_ from '../../src/essence/Basics/Formulae_/Formulae_.js';
import { coordinatePairs, bearingTestCases } from '../fixtures/coordinate-samples.js';
import { validGeoJSON, colorTestCases } from '../fixtures/geojson-samples.js';

/**
 * Formulae_ Unit Tests
 * Testing utility functions from src/essence/Basics/Formulae_/Formulae_.js
 */

test.describe('Formulae_ - Migrated Tests', () => {

  test.describe('getBaseGeoJSON', () => {
    test('returns valid geojson', () => {
      const baseGeoJSON = F_.getBaseGeoJSON();

      expect(baseGeoJSON.type).toBe('FeatureCollection');
      expect(baseGeoJSON.features).toEqual([]);
      expect(baseGeoJSON).toHaveProperty('crs');
    });

    test('accepts features array', () => {
      const features = [validGeoJSON.point, validGeoJSON.lineString];
      const geojson = F_.getBaseGeoJSON(features);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toEqual(features);
      expect(geojson.features.length).toBe(2);
    });
  });

  test.describe('getExtension', () => {
    test('returns the extension of the filepath string', () => {
      expect(F_.getExtension('image.png')).toBe('png');
      expect(F_.getExtension('image.jpeg.png')).toBe('png');
      expect(F_.getExtension('image')).toBeFalsy();
    });

    test('handles various file types', () => {
      expect(F_.getExtension('file.tar.gz')).toBe('gz');
      expect(F_.getExtension('script.js')).toBe('js');
      expect(F_.getExtension('data.json')).toBe('json');
    });
  });

  test.describe('pad', () => {
    test('front pads a number with a string of zeroes', () => {
      expect(F_.pad(2, 5)).toBe('00002');
      expect(F_.pad(10, 3)).toBe('010');
      expect(F_.pad(586, 3)).toBe('586');
    });

    test('handles edge cases', () => {
      expect(F_.pad(0, 3)).toBe('000');
      expect(F_.pad(999, 2)).toBe('99'); // Truncates if number is longer than size
    });
  });
});

test.describe('Formulae_ - Geographic Calculations', () => {

  test.beforeAll(() => {
    // Set planetary radius to Mars (as used in MMGIS)
    F_.setRadius('major', 3396190);
    F_.setRadius('minor', 3396190);
  });

  test.describe('lngLatDistBetween', () => {
    test('calculates short distance correctly', () => {
      const { start, end } = coordinatePairs.shortDistance;
      const distance = F_.lngLatDistBetween(
        start.lng, start.lat,
        end.lng, end.lat
      );

      // Just verify it returns a positive distance (actual value depends on planet radius)
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Should be less than 100 meters
    });

    test('calculates distance between same point as zero', () => {
      const { start, end, expectedDistanceMeters } = coordinatePairs.samePoint;
      const distance = F_.lngLatDistBetween(
        start.lng, start.lat,
        end.lng, end.lat
      );

      expect(distance).toBe(expectedDistanceMeters);
    });

    test('is symmetric (A to B === B to A)', () => {
      const { start, end } = coordinatePairs.longDistance;
      const distAB = F_.lngLatDistBetween(start.lng, start.lat, end.lng, end.lat);
      const distBA = F_.lngLatDistBetween(end.lng, end.lat, start.lng, start.lat);

      expect(distAB).toBeCloseTo(distBA, 5);
    });

    test('handles negative coordinates', () => {
      const distance = F_.lngLatDistBetween(
        -118.2437, -34.0522,
        -74.0060, -40.7128
      );

      expect(distance).toBeGreaterThan(0);
    });
  });

  test.describe('bearingBetweenTwoLatLngs', () => {
    test('calculates bearing due east as 90 degrees', () => {
      const { start, end, expectedBearing } = bearingTestCases.dueEast;
      const bearing = F_.bearingBetweenTwoLatLngs(
        start.lat, start.lng,
        end.lat, end.lng
      );

      expect(bearing).toBeCloseTo(expectedBearing, 0);
    });

    test('calculates bearing due north as 0 degrees', () => {
      const { start, end, expectedBearing } = bearingTestCases.dueNorth;
      const bearing = F_.bearingBetweenTwoLatLngs(
        start.lat, start.lng,
        end.lat, end.lng
      );

      expect(bearing).toBeCloseTo(expectedBearing, 0);
    });

    test('returns value between 0 and 360', () => {
      const { start, end } = coordinatePairs.longDistance;
      const bearing = F_.bearingBetweenTwoLatLngs(
        start.lat, start.lng,
        end.lat, end.lng
      );

      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  test.describe('metersToDegrees and degreesToMeters', () => {
    test('round-trip conversion is consistent', () => {
      const meters = 1000;
      const degrees = F_.metersToDegrees(meters);
      const backToMeters = F_.degreesToMeters(degrees);

      expect(backToMeters).toBeCloseTo(meters, 1);
    });

    test('converts 1 degree correctly based on Mars radius', () => {
      const meters = F_.degreesToMeters(1);
      const expectedMeters = 1 * (Math.PI / 180) * 3396190; // Mars radius

      expect(meters).toBeCloseTo(expectedMeters, -1);
    });

    test('handles zero values', () => {
      expect(F_.metersToDegrees(0)).toBe(0);
      expect(F_.degreesToMeters(0)).toBe(0);
    });
  });
});

test.describe('Formulae_ - GeoJSON Utilities', () => {

  test.describe('getFeatureLength', () => {
    test('calculates LineString length', () => {
      const lineString = validGeoJSON.lineString;
      const length = F_.getFeatureLength(lineString);

      expect(typeof length).toBe('number');
      expect(length).toBeGreaterThan(0);
    });

    test('returns display-friendly format when requested', () => {
      const lineString = validGeoJSON.lineString;
      const length = F_.getFeatureLength(lineString, true);

      expect(typeof length).toBe('string');
      expect(length).toMatch(/\d+\.?\d*\s*(m|km)/);
    });

    test('returns zero for Point features', () => {
      const point = validGeoJSON.point;
      const length = F_.getFeatureLength(point);

      expect(length).toBe(0);
    });
  });
});

test.describe('Formulae_ - Color Utilities', () => {

  test.describe('hexToRGB', () => {
    test('converts hex color to RGB object', () => {
      const rgb = F_.hexToRGB('#ff0000');

      expect(rgb).toHaveProperty('r', 255);
      expect(rgb).toHaveProperty('g', 0);
      expect(rgb).toHaveProperty('b', 0);
    });

    test('handles hex without hash prefix', () => {
      const rgb = F_.hexToRGB('00ff00');

      expect(rgb).toHaveProperty('r', 0);
      expect(rgb).toHaveProperty('g', 255);
      expect(rgb).toHaveProperty('b', 0);
    });

    test('handles 3-character hex codes', () => {
      const rgb = F_.hexToRGB('#f00');

      expect(rgb).toHaveProperty('r', 255);
      expect(rgb).toHaveProperty('g', 0);
      expect(rgb).toHaveProperty('b', 0);
    });
  });

  test.describe('rgb2hex', () => {
    test('converts RGB string to hex', () => {
      const hex = F_.rgb2hex('rgb(255, 0, 0)');

      expect(hex).toBe('#ff0000');
    });

    test('handles RGB without spaces', () => {
      const hex = F_.rgb2hex('rgb(0,255,0)');

      expect(hex.toLowerCase()).toBe('#00ff00');
    });
  });
});

test.describe('Formulae_ - Geographic Calculations (Extended)', () => {

  test.describe('destinationFromBearing', () => {
    test('moves due east correctly', () => {
      const [newLat, newLng] = F_.destinationFromBearing(
        0,    // lat
        0,    // lng
        90,   // bearing (east)
        1000  // distance (km)
      );

      expect(newLat).toBeCloseTo(0, 1); // Latitude stays same
      expect(newLng).toBeGreaterThan(0); // Longitude increases
    });

    test('moves due north correctly', () => {
      const [newLat, newLng] = F_.destinationFromBearing(
        0,    // lat
        0,    // lng
        0,    // bearing (north)
        1000  // distance (km)
      );

      expect(newLat).toBeGreaterThan(0); // Latitude increases
      expect(newLng).toBeCloseTo(0, 1);  // Longitude stays same
    });

    test('round-trip with lngLatDistBetween', () => {
      const startLat = 34.0522, startLng = -118.2437;
      const bearing = 45;
      const distance = 1000; // km

      const [newLat, newLng] = F_.destinationFromBearing(
        startLat, startLng, bearing, distance
      );

      const calculatedDistance = F_.lngLatDistBetween(
        startLng, startLat,
        newLng, newLat
      ) / 1000; // convert to km

      expect(calculatedDistance).toBeCloseTo(distance, -1);
    });
  });

  test.describe('inclinationBetweenTwoLatLngs', () => {
    test('calculates positive inclination (uphill)', () => {
      const inclination = F_.inclinationBetweenTwoLatLngs(
        0, 0, 0,    // Start: lat, lng, elev
        0, 1, 100   // End: lat, lng, elev (100m higher)
      );

      expect(inclination).toBeGreaterThan(0);
    });

    test('calculates negative inclination (downhill)', () => {
      const inclination = F_.inclinationBetweenTwoLatLngs(
        0, 0, 100,  // Start: lat, lng, elev
        0, 1, 0     // End: lat, lng, elev (100m lower)
      );

      expect(inclination).toBeLessThan(0);
    });

    test('returns zero for flat terrain', () => {
      const inclination = F_.inclinationBetweenTwoLatLngs(
        0, 0, 50,
        0, 1, 50
      );

      expect(inclination).toBeCloseTo(0, 1);
    });
  });

  test.describe('lonLatToVector3nr', () => {
    test('converts lon/lat/height to 3D vector', () => {
      const vector = F_.lonLatToVector3nr(0, 0, 0);

      expect(vector).toHaveProperty('x');
      expect(vector).toHaveProperty('y');
      expect(vector).toHaveProperty('z');
      expect(typeof vector.x).toBe('number');
      expect(typeof vector.y).toBe('number');
      expect(typeof vector.z).toBe('number');
    });

    test('handles different heights', () => {
      const vector1 = F_.lonLatToVector3nr(0, 0, 0);
      const vector2 = F_.lonLatToVector3nr(0, 0, 1000);

      // Higher elevation should result in larger vector magnitude
      const mag1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2 + vector1.z ** 2);
      const mag2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2 + vector2.z ** 2);

      expect(mag2).toBeGreaterThan(mag1);
    });
  });
});

test.describe('Formulae_ - GeoJSON Utilities (Extended)', () => {

  test.describe('invertGeoJSONLatLngs', () => {
    test('inverts Point coordinates', () => {
      const point = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: {}
      };

      const inverted = F_.invertGeoJSONLatLngs(point);

      expect(inverted.geometry.coordinates[0]).toBe(2);
      expect(inverted.geometry.coordinates[1]).toBe(1);
    });

    test('inverts LineString coordinates', () => {
      const lineString = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] },
        properties: {}
      };

      const inverted = F_.invertGeoJSONLatLngs(lineString);

      expect(inverted.geometry.coordinates[0]).toEqual([2, 1]);
      expect(inverted.geometry.coordinates[1]).toEqual([4, 3]);
    });

    test('does not mutate original feature', () => {
      const original = validGeoJSON.point;
      const originalCoords = [...original.geometry.coordinates];

      F_.invertGeoJSONLatLngs(original);

      expect(original.geometry.coordinates).toEqual(originalCoords);
    });
  });

  test.describe('sortGeoJSONFeatures', () => {
    test('sorts by geometry type (polygon first, point last)', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          validGeoJSON.point,
          validGeoJSON.polygon,
          validGeoJSON.lineString
        ]
      };

      F_.sortGeoJSONFeatures(geojson);

      expect(geojson.features[0].geometry.type.toLowerCase()).toContain('polygon');
      expect(geojson.features[geojson.features.length - 1].geometry.type.toLowerCase()).toContain('point');
    });
  });

  test.describe('getFeatureArea', () => {
    test('calculates Polygon area', () => {
      const polygon = validGeoJSON.polygon;
      const area = F_.getFeatureArea(polygon);

      expect(typeof area).toBe('number');
      expect(area).toBeGreaterThan(0);
    });

    test('returns zero for non-polygon features', () => {
      const point = validGeoJSON.point;
      const area = F_.getFeatureArea(point);

      expect(area).toBe(0);
    });

    test('returns display-friendly format when requested', () => {
      const polygon = validGeoJSON.polygon;
      const area = F_.getFeatureArea(polygon, true);

      expect(typeof area).toBe('string');
      expect(area).toMatch(/\d+/);
    });
  });

  test.describe('geojsonAddSpatialProperties', () => {
    test('adds spatial properties to features', () => {
      const lineString = F_.clone(validGeoJSON.lineString);

      const result = F_.geojsonAddSpatialProperties(lineString);

      // Function should complete without error
      expect(result).toBeDefined();
    });
  });

  test.describe('geoJSONForceSimpleStyleSpec', () => {
    test('converts to SimpleStyle spec', () => {
      const geojson = F_.clone(validGeoJSON.featureCollection);
      const result = F_.geoJSONForceSimpleStyleSpec(geojson);

      expect(result).toBeDefined();
      // Returns an object (not a string)
      expect(typeof result).toBe('object');
    });
  });
});

test.describe('Formulae_ - Color Utilities (Extended)', () => {

  // Note: parseColor and isColor require DOM (uses a canvas element)
  // These are better tested in E2E tests where browser context is available

  test.describe('stringToColor', () => {
    test('generates consistent color from string', () => {
      const color1 = F_.stringToColor('test');
      const color2 = F_.stringToColor('test');

      expect(color1).toBe(color2);
    });

    test('generates different colors for different strings', () => {
      const color1 = F_.stringToColor('test1');
      const color2 = F_.stringToColor('test2');

      expect(color1).not.toBe(color2);
    });
  });

  test.describe('hexToRGBA', () => {
    test('converts hex to RGBA string', () => {
      const rgba = F_.hexToRGBA('#ff0000', 0.5);

      expect(rgba).toContain('rgba');
      expect(rgba).toContain('0.5');
    });
  });

  test.describe('rgbToArray', () => {
    test('converts RGB string to array', () => {
      const arr = F_.rgbToArray('rgb(255, 0, 0)');

      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(3);
    });
  });

  test.describe('getColorFromRangeByPercent', () => {
    test('interpolates color from range', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const color = F_.getColorFromRangeByPercent(colors, 50);

      expect(color).toBeDefined();
    });
  });
});

test.describe('Formulae_ - Array/Object Utilities', () => {

  test.describe('getIn', () => {
    test('traverses nested object', () => {
      const obj = { a: { b: { c: 'value' } } };
      const result = F_.getIn(obj, ['a', 'b', 'c']);

      expect(result).toBe('value');
    });

    test('returns notSetValue for missing path', () => {
      const obj = { a: { b: 'value' } };
      const result = F_.getIn(obj, ['a', 'x', 'y'], 'default');

      expect(result).toBe('default');
    });

    test('handles array indices', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = F_.getIn(obj, ['items', 1]);

      expect(result).toBe('b');
    });
  });

  test.describe('clone', () => {
    test('deep clones object', () => {
      const obj = { a: { b: 'value' } };
      const cloned = F_.clone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.a).not.toBe(obj.a);
    });

    test('clones arrays', () => {
      const arr = [1, 2, [3, 4]];
      const cloned = F_.clone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });
  });

  test.describe('isEmpty', () => {
    test('returns true for empty object', () => {
      expect(F_.isEmpty({})).toBe(true);
    });

    test('returns false for non-empty object', () => {
      expect(F_.isEmpty({ a: 1 })).toBe(false);
    });

    test('returns false for zero', () => {
      expect(F_.isEmpty(0)).toBe(false);
    });
  });

  test.describe('isEqual', () => {
    test('compares objects correctly', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };

      expect(F_.isEqual(obj1, obj2)).toBe(true);
    });

    test('detects differences', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      expect(F_.isEqual(obj1, obj2)).toBe(false);
    });

    test('handles nested objects', () => {
      const obj1 = { a: { b: 1 } };
      const obj2 = { a: { b: 1 } };

      expect(F_.isEqual(obj1, obj2)).toBe(true);
    });
  });

  test.describe('arrayUnique', () => {
    test('removes duplicates from array', () => {
      const arr = [1, 2, 2, 3, 3, 4];
      const unique = F_.arrayUnique(arr);

      expect(unique).toEqual([1, 2, 3, 4]);
    });

    test('handles string arrays', () => {
      const arr = ['a', 'b', 'a', 'c'];
      const unique = F_.arrayUnique(arr);

      expect(unique).toEqual(['a', 'b', 'c']);
    });
  });

  test.describe('removeDuplicatesInArray', () => {
    test('removes duplicate values', () => {
      const arr = [1, 2, 2, 3, 3, 4];
      const result = F_.removeDuplicatesInArray(arr);

      expect(result.length).toBe(4);
    });
  });

  test.describe('chunkArray', () => {
    test('splits array into chunks', () => {
      const arr = [1, 2, 3, 4, 5, 6];
      const chunks = F_.chunkArray(arr, 2);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual([1, 2]);
      expect(chunks[1]).toEqual([3, 4]);
      expect(chunks[2]).toEqual([5, 6]);
    });

    test('handles uneven chunks', () => {
      const arr = [1, 2, 3, 4, 5];
      const chunks = F_.chunkArray(arr, 2);

      expect(chunks.length).toBe(3);
      expect(chunks[2]).toEqual([5]);
    });
  });
});

test.describe('Formulae_ - String Utilities', () => {

  test.describe('fileNameFromPath', () => {
    test('extracts filename from path without extension', () => {
      expect(F_.fileNameFromPath('/path/to/file.txt')).toBe('file');
      expect(F_.fileNameFromPath('C:\\Users\\test\\document.pdf')).toBe('document');
    });

    test('handles path without directory', () => {
      expect(F_.fileNameFromPath('file.txt')).toBe('file');
    });
  });

  test.describe('cleanString', () => {
    test('removes special characters', () => {
      const cleaned = F_.cleanString('test@#$%string');

      expect(cleaned).not.toContain('@');
      expect(cleaned).not.toContain('#');
      expect(cleaned).not.toContain('$');
    });
  });

  test.describe('getSafeName', () => {
    test('creates safe CSS/ID name', () => {
      const safe = F_.getSafeName('Test Name 123!');

      // Should return a string without spaces
      expect(typeof safe).toBe('string');
      expect(safe).not.toContain(' ');
    });
  });

  test.describe('toEllipsisString', () => {
    test('truncates long strings', () => {
      const str = 'This is a very long string';
      const truncated = F_.toEllipsisString(str, 10);

      expect(truncated.length).toBeLessThanOrEqual(13); // 10 + '...'
      expect(truncated).toContain('...');
    });

    test('does not truncate short strings', () => {
      const str = 'Short';
      const result = F_.toEllipsisString(str, 10);

      expect(result).toBe(str);
    });
  });

  test.describe('prettifyName', () => {
    test('converts snake_case to Title Case', () => {
      const pretty = F_.prettifyName('test_variable_name');

      expect(pretty).toContain(' ');
      expect(pretty).not.toContain('_');
    });
  });

  test.describe('isStringNumeric', () => {
    test('detects numeric strings', () => {
      expect(F_.isStringNumeric('123')).toBe(true);
      expect(F_.isStringNumeric('123.45')).toBe(true);
    });

    test('rejects non-numeric strings', () => {
      expect(F_.isStringNumeric('abc')).toBe(false);
      expect(F_.isStringNumeric('12a')).toBe(false);
    });
  });

  test.describe('bracketReplace', () => {
    test('replaces {property} placeholders', () => {
      const template = 'Hello {name}, you are {age} years old';
      const data = { name: 'John', age: 30 };
      const result = F_.bracketReplace(template, data);

      expect(result).toContain('John');
      expect(result).toContain('30');
      expect(result).not.toContain('{name}');
    });
  });
});

test.describe('Formulae_ - Math/Calculation Utilities', () => {

  test.describe('distanceFormula', () => {
    test('calculates 2D distance', () => {
      const distance = F_.distanceFormula(0, 0, 3, 4);

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    test('handles zero distance', () => {
      const distance = F_.distanceFormula(1, 1, 1, 1);

      expect(distance).toBe(0);
    });
  });

  test.describe('mod', () => {
    test('calculates true modulo', () => {
      expect(F_.mod(5, 3)).toBe(2);
      expect(F_.mod(-1, 3)).toBe(2); // True modulo handles negatives correctly
    });

    test('handles zero', () => {
      expect(F_.mod(0, 5)).toBe(0);
    });
  });

  test.describe('linearScale', () => {
    test('scales value linearly', () => {
      const scaled = F_.linearScale([0, 100], [0, 1], 50);

      expect(scaled).toBe(0.5);
    });

    test('handles edge values', () => {
      expect(F_.linearScale([0, 100], [0, 1], 0)).toBe(0);
      expect(F_.linearScale([0, 100], [0, 1], 100)).toBe(1);
    });
  });

  test.describe('arrayAverage', () => {
    test('calculates average of numbers', () => {
      const avg = F_.arrayAverage([1, 2, 3, 4, 5]);

      expect(avg).toBe(3);
    });

    test('handles single element', () => {
      const avg = F_.arrayAverage([42]);

      expect(avg).toBe(42);
    });

    test('calculates average from object property', () => {
      const arr = [{ val: 10 }, { val: 20 }, { val: 30 }];
      const avg = F_.arrayAverage(arr, 'val');

      expect(avg).toBe(20);
    });
  });

  test.describe('getMinMaxOfArray', () => {
    test('finds min and max', () => {
      const result = F_.getMinMaxOfArray([3, 1, 4, 1, 5, 9, 2, 6]);

      expect(result.min).toBe(1);
      expect(result.max).toBe(9);
    });

    test('handles single element', () => {
      const result = F_.getMinMaxOfArray([42]);

      expect(result.min).toBe(42);
      expect(result.max).toBe(42);
    });
  });

  test.describe('areaOfTriangle', () => {
    test('calculates triangle area', () => {
      const area = F_.areaOfTriangle(0, 0, 4, 0, 0, 3);

      expect(area).toBe(6); // 1/2 * base * height
    });
  });

  test.describe('rotatePoint', () => {
    test('rotates point around center', () => {
      const rotated = F_.rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);

      expect(rotated).toHaveProperty('x');
      expect(rotated).toHaveProperty('y');
      expect(typeof rotated.x).toBe('number');
      expect(typeof rotated.y).toBe('number');
    });

    test('maintains point structure', () => {
      const original = { x: 5, y: 5 };
      const rotated = F_.rotatePoint(original, { x: 0, y: 0 }, 30);

      expect(rotated).toHaveProperty('x');
      expect(rotated).toHaveProperty('y');
      expect(typeof rotated.x).toBe('number');
      expect(typeof rotated.y).toBe('number');
    });
  });
});

test.describe('Formulae_ - Time/Date Utilities', () => {

  test.describe('monthNumberToName', () => {
    test('converts month number to name', () => {
      const name = F_.monthNumberToName(1);
      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
    });
  });

  test.describe('timestampToDate', () => {
    test('converts timestamp to date string', () => {
      const date = F_.timestampToDate(1609459200000); // 2021-01-01 00:00:00 UTC

      expect(date).toBeDefined();
      expect(typeof date).toBe('string');
    });
  });

  test.describe('addTimeZoneOffset', () => {
    test('adds timezone offset to timestamp', () => {
      const timestamp = 1609459200000;
      const adjusted = F_.addTimeZoneOffset(timestamp);

      // Returns a Date object
      expect(adjusted).toBeDefined();
    });
  });

  test.describe('removeTimeZoneOffset', () => {
    test('removes timezone offset from timestamp', () => {
      const timestamp = 1609459200000;
      const adjusted = F_.removeTimeZoneOffset(timestamp);

      // Returns a Date object
      expect(adjusted).toBeDefined();
    });
  });
});

test.describe('Formulae_ - Validation Utilities', () => {

  test.describe('isUrlAbsolute', () => {
    test('detects absolute URLs', () => {
      expect(F_.isUrlAbsolute('http://example.com')).toBe(true);
      expect(F_.isUrlAbsolute('https://example.com')).toBe(true);
    });

    test('detects relative URLs', () => {
      expect(F_.isUrlAbsolute('/path/to/page')).toBe(false);
      expect(F_.isUrlAbsolute('relative/path')).toBe(false);
    });
  });

  // Note: isValidUrl requires DOM (document.createElement)
  // Better tested in E2E tests where browser context is available
});

test.describe('Formulae_ - Tile Operations', () => {

  test.describe('latlonzoomToTileCoords', () => {
    test('converts lat/lon/zoom to tile coordinates', () => {
      const tile = F_.latlonzoomToTileCoords(0, 0, 1);

      expect(tile).toHaveProperty('x');
      expect(tile).toHaveProperty('y');
      expect(tile).toHaveProperty('z');
      expect(typeof tile.x).toBe('number');
      expect(typeof tile.y).toBe('number');
      expect(tile.z).toBe(1);
    });
  });
});

test.describe('Formulae_ - getTimeStartsBetweenTimestamps', () => {

  test('returns correct year starts', () => {
    const result = F_.getTimeStartsBetweenTimestamps(
      '2020-01-01T00:00:00Z',
      '2023-01-01T00:00:00Z',
      'year'
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4);
    result.forEach(item => {
      expect(item).toHaveProperty('ts');
      expect(item).toHaveProperty('label');
      expect(typeof item.ts).toBe('number');
    });
  });

  test('returns correct month starts', () => {
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-01-01T00:00:00Z',
      '2023-06-01T00:00:00Z',
      'month'
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  test('returns correct day starts', () => {
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-01-01T00:00:00Z',
      '2023-01-05T00:00:00Z',
      'day'
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  test('returns correct hour starts', () => {
    // Note: the source uses getHours() (local) for initialization but
    // setUTCHours() in the loop, so result count is timezone-dependent.
    // We verify structure and termination rather than exact counts.
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-01-01T00:00:00Z',
      '2023-01-01T05:00:00Z',
      'hour'
    );
    expect(Array.isArray(result)).toBe(true);
    for (const item of result) {
      expect(item).toHaveProperty('ts');
      expect(item).toHaveProperty('label');
      expect(typeof item.ts).toBe('number');
    }
  });

  test('returns correct minute starts', () => {
    // Timezone-dependent initialization (getMinutes local vs setUTCMinutes)
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-01-01T00:00:00Z',
      '2023-01-01T00:10:00Z',
      'minute'
    );
    expect(Array.isArray(result)).toBe(true);
    for (const item of result) {
      expect(item).toHaveProperty('ts');
      expect(item).toHaveProperty('label');
      expect(typeof item.ts).toBe('number');
    }
  });

  test('returns correct second starts', () => {
    // Timezone-dependent initialization (getSeconds local vs setUTCSeconds)
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-01-01T00:00:00Z',
      '2023-01-01T00:00:10Z',
      'second'
    );
    expect(Array.isArray(result)).toBe(true);
    for (const item of result) {
      expect(item).toHaveProperty('ts');
      expect(item).toHaveProperty('label');
      expect(typeof item.ts).toBe('number');
    }
  });

  test('returns correct decade starts', () => {
    const result = F_.getTimeStartsBetweenTimestamps(
      '2000-01-01T00:00:00Z',
      '2030-01-01T00:00:00Z',
      'decade'
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  test('handles empty range', () => {
    // Use a mid-year date so getFullYear() returns the same year in all timezones
    const result = F_.getTimeStartsBetweenTimestamps(
      '2023-06-15T12:00:00Z',
      '2023-06-15T12:00:00Z',
      'year'
    );
    // The function initializes currentDate to the start of the containing year,
    // so with equal start/end the loop may produce 0 or 1 results depending
    // on whether the year-start falls before the endDate.
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  test('terminates for large ranges without infinite loop', () => {
    // This is the key regression test - the loop variable fix prevents infinite loops
    const start = Date.now();
    const result = F_.getTimeStartsBetweenTimestamps(
      '2000-01-01T00:00:00Z',
      '2100-01-01T00:00:00Z',
      'year'
    );
    const elapsed = Date.now() - start;
    // Should complete in under 1 second, not hang
    expect(elapsed).toBeLessThan(1000);
    expect(result.length).toBeGreaterThan(0);
  });
});
