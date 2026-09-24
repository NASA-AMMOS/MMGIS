/**
 * Tile/cog — the TiTiler tile template shared by the 2D map and globe engines
 * for COG sources.
 */
import { test, expect } from '@playwright/test'
import {
    buildCogTileUrl,
    encodeCogSourceUrl,
} from '../../plugins/core/layertypes/Tile/cog'

const loc = { origin: 'https://host', pathname: '/mmgis/' }
const base = 'https://host/mmgis/titiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.webp'

test.describe('encodeCogSourceUrl', () => {
    test('encodes the source as one query value', () => {
        expect(
            encodeCogSourceUrl('s3://b/f.tif?versionId=abc&partNumber=1')
        ).toBe('s3%3A%2F%2Fb%2Ff.tif%3FversionId%3Dabc%26partNumber%3D1')
    })

    test('keeps {token} placeholders literal', () => {
        expect(encodeCogSourceUrl('s3://b/{starttime}.tif')).toBe(
            's3%3A%2F%2Fb%2F{starttime}.tif'
        )
    })
})

test.describe('buildCogTileUrl', () => {
    test('wraps an s3 source in the TiTiler tile endpoint', () => {
        expect(buildCogTileUrl('s3://my-bucket/file.tif', {}, loc)).toBe(
            `${base}?url=s3%3A%2F%2Fmy-bucket%2Ffile.tif`
        )
    })

    test('preserves query-bearing sources', () => {
        const url = buildCogTileUrl(
            's3://b/f.tif?versionId=abc&partNumber=1',
            {},
            loc
        )
        const parsed = new URL(url.replace(/\{[xyz]\}/g, '0'))
        expect(parsed.searchParams.get('url')).toBe(
            's3://b/f.tif?versionId=abc&partNumber=1'
        )
    })

    test('appends bands and resampling, honours tileMatrixSet', () => {
        expect(
            buildCogTileUrl(
                '../../Missions/M/f.tif',
                {
                    cogBands: [1, null, 3],
                    cogResampling: 'nearest',
                    tileMatrixSet: 'WGS1984Quad',
                },
                loc
            )
        ).toBe(
            'https://host/mmgis/titiler/cog/tiles/WGS1984Quad/{z}/{x}/{y}.webp' +
                '?url=..%2F..%2FMissions%2FM%2Ff.tif&bidx=1&bidx=3&resampling=nearest'
        )
    })

    test('omits bands when an expression is set', () => {
        expect(
            buildCogTileUrl(
                'https://example.com/f.tif',
                { cogBands: [1], cogExpression: 'b1*2' },
                loc
            )
        ).toBe(`${base}?url=https%3A%2F%2Fexample.com%2Ff.tif`)
    })
})
