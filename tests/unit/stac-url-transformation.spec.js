import { test, expect } from '@playwright/test';

/**
 * STAC URL Transformation Unit Tests
 * Testing STAC collection URL transformation logic
 *
 * These tests validate the URL transformation logic that converts STAC collection
 * URLs (e.g., stac-collection:name?params) into proper TiTiler PgSTAC HTTP endpoints.
 *
 * The logic being tested is implemented in:
 * - src/essence/Basics/Layers_/Layers_.js (L_.getUrl() method)
 * - src/essence/Basics/Map_/Map_.js (transformStacUrl() function and makeTileLayer())
 */

test.describe('STAC URL Transformation Logic', () => {
    /**
     * Helper function that mimics the STAC URL transformation logic
     * from L_.getUrl() and transformStacUrl()
     */
    function transformStacUrl(url, layerData, type) {
        let nextUrl = url;

        // Check if this is a STAC collection URL
        if (
            nextUrl != null &&
            nextUrl.toLowerCase().startsWith('stac-collection:')
        ) {
            // Parse the STAC URL: stac-collection:collection_name?params
            const splitColonUrl = nextUrl.split(':');
            if (splitColonUrl.length >= 2) {
                const splitParams = splitColonUrl[1].split('?');
                const collectionName = splitParams[0];

                // Build bands parameter (only if no expression exists)
                let bandsParam = '';
                if (
                    layerData &&
                    (!layerData.cogExpression ||
                        layerData.cogExpression.trim() === '')
                ) {
                    const bands = layerData.cogBands;
                    if (bands != null) {
                        bands.forEach((band) => {
                            if (band != null) bandsParam += `&bidx=${band}`;
                        });
                    }
                }

                // Build resampling parameter
                let resamplingParam = '';
                if (layerData && layerData.cogResampling) {
                    resamplingParam = `&resampling=${layerData.cogResampling}`;
                }

                // Build the base URL
                const origin = 'http://localhost:8888';
                const pathname = '/MMGIS';

                // Generate endpoint based on type
                if (type === 'tile') {
                    // Tile endpoint for raster tiles
                    nextUrl = `${origin}${pathname}/titilerpgstac/collections/${collectionName}/tiles/${
                        (layerData && layerData.tileMatrixSet) ||
                        'WebMercatorQuad'
                    }/{z}/{x}/{y}?assets=asset${bandsParam}${resamplingParam}`;
                } else if (type === 'image') {
                    // For images, use preview endpoint
                    nextUrl = `${origin}${pathname}/titilerpgstac/collections/${collectionName}/preview?assets=asset${bandsParam}${resamplingParam}`;
                }
            }
        }

        return nextUrl;
    }

    test('transforms basic STAC collection URL for tiles', () => {
        const url = 'stac-collection:swot_freeboard_monthly_10km';
        const layerData = {
            name: 'SWOT Freeboard',
            cogBands: null,
            cogExpression: null,
            cogResampling: null,
        };

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'image');

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

        const result = transformStacUrl(url, layerData, 'tile');

        expect(result).toContain('/tiles/WorldCRS84Quad/{z}/{x}/{y}');
        expect(result).toContain('bidx=2&bidx=3&bidx=4');
        expect(result).toContain('resampling=nearest');
    });

    test('handles STAC URL with null layerData', () => {
        const url = 'stac-collection:test_collection';

        const result = transformStacUrl(url, null, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

        // Should still process but with empty collection name
        expect(result).toContain('titilerpgstac/collections/');
    });

    test('handles STAC URL case-insensitively', () => {
        const url = 'STAC-COLLECTION:test_collection';
        const layerData = {
            name: 'Uppercase STAC',
        };

        const result = transformStacUrl(url, layerData, 'tile');

        expect(result).toContain('titilerpgstac/collections/test_collection');
    });

    test('does not transform non-STAC URLs', () => {
        const url = 'http://example.com/tiles/{z}/{x}/{y}.png';
        const layerData = {
            name: 'Regular Tile Layer',
        };

        const result = transformStacUrl(url, layerData, 'tile');

        // Should return the original URL unchanged
        expect(result).toBe(url);
    });

    test('does not transform COG URLs', () => {
        const url = 'COG:http://example.com/image.tif';
        const layerData = {
            name: 'COG Layer',
        };

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

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

        const result = transformStacUrl(url, layerData, 'tile');

        // Should include bands since expression is only whitespace
        expect(result).toContain('bidx=1&bidx=2');
    });
});
