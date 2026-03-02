import { test, expect } from '@playwright/test';
import { transformStacUrl, parseExternalStacUrl } from '../../src/essence/Basics/Layers_/LayerUtils.js';

/**
 * STAC URL Transformation Unit Tests
 * Testing STAC collection URL transformation logic
 *
 * These tests validate the URL transformation logic that converts STAC collection
 * URLs (e.g., stac-collection:name?params) into proper TiTiler PgSTAC HTTP endpoints.
 *
 * The logic being tested is implemented in:
 * - src/essence/Basics/Layers_/LayerUtils.js (transformStacUrl() and parseExternalStacUrl())
 *
 * These functions are imported directly from the source, ensuring tests validate
 * the actual implementation rather than a copy.
 */

test.describe('STAC URL Transformation Logic', () => {
    // Mock location object for tests
    const mockLocation = {
        origin: 'http://localhost:8888',
        pathname: '/MMGIS'
    };

    test('transforms basic STAC collection URL for tiles', () => {
        const url = 'stac-collection:swot_freeboard_monthly_10km';
        const layerData = {
            name: 'SWOT Freeboard',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain(
            'http://localhost:8888/MMGIS/titilerpgstac/collections/swot_freeboard_monthly_10km'
        );
        expect(result).toContain('/tiles/WebMercatorQuad/{z}/{x}/{y}');
        expect(result).toContain('?assets=asset');
    });

    test('transforms STAC URL with datetime parameter', () => {
        const url =
            'stac-collection:swot_freeboard_monthly_10km?datetime=2024-12-01T00:00:00.000Z/2024-12-31T23:59:59.000Z';
        const layerData = {
            name: 'SWOT Freeboard',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain(
            'http://localhost:8888/MMGIS/titilerpgstac/collections/swot_freeboard_monthly_10km'
        );
        expect(result).toContain('/tiles/WebMercatorQuad/{z}/{x}/{y}');
        // Note: datetime parameter is typically handled by TimeControl, not in URL transformation
    });

    test('transforms STAC URL with bands for tiles', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Test Layer',
            cogBands: [1, 2, 3],
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain('?assets=asset&bidx=1&bidx=2&bidx=3');
    });

    test('transforms STAC URL with resampling for tiles', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Test Layer',
            cogBands: null,
            cogExpression: null,
            cogResampling: 'bilinear',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain('?assets=asset&resampling=bilinear');
    });

    test('transforms STAC URL with custom tile matrix set', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Test Layer',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
            tileMatrixSet: 'WorldCRS84Quad',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain('/tiles/WorldCRS84Quad/{z}/{x}/{y}');
    });

    test('skips bands when expression exists', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Test Layer',
            cogBands: [1, 2, 3],
            cogExpression: 'asset_b1 + asset_b2',
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should not include bidx parameters when expression is present
        expect(result).not.toContain('bidx=');
        expect(result).toContain('?assets=asset');
    });

    test('transforms STAC URL for image type', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Test Image Layer',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'image', mockLocation);

        expect(result).toContain(
            'http://localhost:8888/MMGIS/titilerpgstac/collections/test_collection'
        );
        expect(result).toContain('/preview?assets=asset');
    });

    test('transforms STAC URL with multiple parameters', () => {
        const url = 'stac-collection:multi_param_collection';
        const layerData = {
            name: 'Multi Param Layer',
            cogBands: [2, 3, 4],
            cogExpression: null,
            cogResampling: 'nearest',
            tileMatrixSet: 'WorldCRS84Quad',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain('/tiles/WorldCRS84Quad/{z}/{x}/{y}');
        expect(result).toContain('bidx=2&bidx=3&bidx=4');
        expect(result).toContain('resampling=nearest');
    });

    test('handles STAC URL with null layerData', () => {
        const url = 'stac-collection:test_collection';

        const result = transformStacUrl(url, null, 'tile', mockLocation);

        expect(result).toContain(
            'http://localhost:8888/MMGIS/titilerpgstac/collections/test_collection'
        );
        expect(result).toContain('/tiles/WebMercatorQuad/{z}/{x}/{y}');
    });

    test('handles malformed STAC URL gracefully', () => {
        const url = 'stac-collection:';
        const layerData = {
            name: 'Malformed Layer',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should still process but with empty collection name
        expect(result).toContain('titilerpgstac/collections/');
    });

    test('handles STAC URL case-insensitively', () => {
        const url = 'STAC-COLLECTION:test_collection';
        const layerData = {
            name: 'Uppercase STAC',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        expect(result).toContain('titilerpgstac/collections/test_collection');
    });

    test('does not transform non-STAC URLs', () => {
        const url = 'http://example.com/tiles/{z}/{x}/{y}.png';
        const layerData = {
            name: 'Regular Tile Layer',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should return the original URL unchanged
        expect(result).toBe(url);
    });

    test('does not transform COG URLs', () => {
        const url = 'COG:http://example.com/image.tif';
        const layerData = {
            name: 'COG Layer',
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should not be transformed since it doesn't start with stac-collection:
        expect(result).toBe(url);
        expect(result).not.toContain('titilerpgstac');
    });

    test('handles empty bands array', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Empty Bands Layer',
            cogBands: [],
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should not add any bidx parameters
        expect(result).not.toContain('bidx=');
        expect(result).toContain('?assets=asset');
    });

    test('handles null bands', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Null Bands Layer',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should not add any bidx parameters
        expect(result).not.toContain('bidx=');
        expect(result).toContain('?assets=asset');
    });

    test('handles bands with null values in array', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Partial Bands Layer',
            cogBands: [1, null, 3],
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should only add bidx for non-null values
        expect(result).toContain('bidx=1');
        expect(result).toContain('bidx=3');
        expect(result).not.toContain('bidx=null');
    });

    test('handles empty expression string', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Empty Expression Layer',
            cogBands: [1, 2],
            cogExpression: '',
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should include bands since expression is empty
        expect(result).toContain('bidx=1&bidx=2');
    });

    test('handles whitespace-only expression', () => {
        const url = 'stac-collection:test_collection';
        const layerData = {
            name: 'Whitespace Expression Layer',
            cogBands: [1, 2],
            cogExpression: '   ',
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile', mockLocation);

        // Should include bands since expression is only whitespace
        expect(result).toContain('bidx=1&bidx=2');
    });

    test('transforms external STAC URL with full path', () => {
        const url = 'stac-collection:https://mars.nasa.gov/mmgis/titilerpgstac/collections/swot_collection';
        const result = transformStacUrl(url, {}, 'tile', mockLocation);
        expect(result).toContain('https://mars.nasa.gov/mmgis/titilerpgstac/collections/swot_collection');
        expect(result).toContain('/tiles/WebMercatorQuad/{z}/{x}/{y}');
        expect(result).toContain('?assets=asset');
    });

    test('handles external URL with port number', () => {
        const url = 'stac-collection:https://example.com:8888/titilerpgstac/collections/test_collection';
        const result = transformStacUrl(url, {}, 'tile', mockLocation);
        expect(result).toContain('https://example.com:8888/titilerpgstac/collections/test_collection');
    });

    test('preserves bands with external URL', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/collections/test_collection';
        const layerData = { cogBands: [1, 2, 3] };
        const result = transformStacUrl(url, layerData, 'tile', mockLocation);
        expect(result).toContain('bidx=1');
        expect(result).toContain('bidx=2');
        expect(result).toContain('bidx=3');
    });

    test('applies resampling to external URL', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/collections/test_collection';
        const layerData = { cogResampling: 'bilinear' };
        const result = transformStacUrl(url, layerData, 'tile', mockLocation);
        expect(result).toContain('resampling=bilinear');
    });

    test('transforms external STAC URL for image preview', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/collections/test_collection';
        const result = transformStacUrl(url, {}, 'image', mockLocation);
        expect(result).toContain('https://example.com/titilerpgstac/collections/test_collection/preview');
        expect(result).toContain('?assets=asset');
    });

    test('applies custom tile matrix set to external URL', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/collections/test_collection';
        const layerData = { tileMatrixSet: 'WorldCRS84Quad' };
        const result = transformStacUrl(url, layerData, 'tile', mockLocation);
        expect(result).toContain('/tiles/WorldCRS84Quad/{z}/{x}/{y}');
    });

    test('rejects external URL without /collections/ path', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/test_collection';
        const result = transformStacUrl(url, {}, 'tile', mockLocation);
        expect(result).toBe(url); // Returns original on error
    });

    test('rejects external URL missing collection name', () => {
        const url = 'stac-collection:https://example.com/titilerpgstac/collections/';
        const result = transformStacUrl(url, {}, 'tile', mockLocation);
        expect(result).toBe(url); // Returns original on error
    });

    test('local STAC URLs continue working unchanged', () => {
        const url = 'stac-collection:local_collection';
        const result = transformStacUrl(url, {}, 'tile', mockLocation);
        expect(result).toContain('/titilerpgstac/collections/local_collection');
        expect(result).toMatch(/^http/); // Has origin
    });

    test('parseExternalStacUrl validates URLs correctly', () => {
        // Valid external URL
        const valid = parseExternalStacUrl('https://example.com/titilerpgstac/collections/collection');
        expect(valid).toEqual({
            baseUrl: 'https://example.com/titilerpgstac',
            collectionName: 'collection'
        });

        // Missing /collections/ path
        const invalid1 = parseExternalStacUrl('https://example.com/titilerpgstac/collection');
        expect(invalid1).toBeNull();

        // Missing collection name
        const invalid2 = parseExternalStacUrl('https://example.com/titilerpgstac/collections/');
        expect(invalid2).toBeNull();

        // URL with port
        const withPort = parseExternalStacUrl('https://example.com:8888/titilerpgstac/collections/collection');
        expect(withPort).toEqual({
            baseUrl: 'https://example.com:8888/titilerpgstac',
            collectionName: 'collection'
        });

        // URL with subpath
        const withSubpath = parseExternalStacUrl('https://example.com/mmgis/titilerpgstac/collections/my_collection');
        expect(withSubpath).toEqual({
            baseUrl: 'https://example.com/mmgis/titilerpgstac',
            collectionName: 'my_collection'
        });
    });
});
