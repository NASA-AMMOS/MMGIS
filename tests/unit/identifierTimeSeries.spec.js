import { test, expect } from '@playwright/test'
import * as echarts from 'echarts'
import {
    TIME_SERIES_LIMITS,
    classifyLayer,
    resolveStacEndpoints,
    buildDatetimeParam,
    parseIsoTime,
    parseStacItemTime,
    buildStacSearchUrl,
    nextPageToken,
    fetchStacItems,
    buildBandParams,
    buildPointUrl,
    parsePointResponse,
    fetchPointValues,
    resolveMeasurement,
    buildSeries,
    readValue,
    fetchLayerTimeSeries,
    createRequestGuard,
    cacheKey,
} from '../../plugins/core/tools/Identifier/IdentifierTimeSeries.js'
import {
    buildChartOption,
    createTimeSeriesChart,
    formatUtc,
    formatValue,
    axisUnits,
    gapLabel,
} from '../../plugins/core/tools/Identifier/IdentifierTimeSeriesChart.js'
import {
    listActiveLayers,
    createTimeSeriesController,
} from '../../plugins/core/tools/Identifier/IdentifierTimeSeriesPanel.js'
import {
    toolHasHandler,
    toolClaimingClicks,
    listensIsHandlerSpecific,
    isFeatureClickTarget,
    shouldChartMapClick,
    shouldChartGlobeClick,
} from '../../plugins/core/tools/Identifier/IdentifierClickGuard.js'

/**
 * Identifier click-for-time-series (#1159).
 *
 * Fixtures follow the real response shapes of the pinned servers:
 *  - stac-fastapi-pgstac 6.2 GET /search: an ItemCollection whose `next`
 *    link carries `token=next:...` in its href.
 *  - titiler-pgstac 3.1 /collections/{id}/point: { coordinates, assets:
 *    [{ name: 'collection/item', values, band_names, band_descriptions }] },
 *    nodata as null, 404 when no item has the point.
 */

const COLLECTION = 'emit_ch4'
const STAC_BASE = 'https://mmgis.test/stac'
const TITILER_BASE = 'https://mmgis.test/titilerpgstac'
const LOCATION = { origin: 'https://mmgis.test', pathname: '/' }

const stacLayer = (overrides = {}) => ({
    name: 'Methane',
    display_name: 'Methane',
    type: 'tile',
    url: `stac-collection:${COLLECTION}`,
    cogUnits: 'ppm m',
    cogBandsQuery: [1],
    time: {
        enabled: true,
        start: '2024-01-01T00:00:00Z',
        end: '2024-06-30T23:59:59Z',
    },
    ...overrides,
})

const item = (id, datetime, extra = {}) => ({
    type: 'Feature',
    id,
    collection: COLLECTION,
    properties: { datetime, ...extra },
})

const pointAsset = (id, values, bandNames = ['b1']) => ({
    name: `${COLLECTION}/${id}`,
    values,
    band_names: bandNames,
    band_descriptions: bandNames,
})

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
})

/**
 * A fake STAC + TiTiler. `items` are the STAC items in the server's order;
 * `values` maps item id -> values array (missing id = PointOutsideBounds).
 */
function fakeServers({
    items = [],
    values = {},
    pageSize,
    stacStatus = 200,
    pointStatus = 200,
    numberMatched,
    reverseTitiler = true,
} = {}) {
    const calls = { stac: [], point: [] }
    const fetchFn = async (url, init) => {
        const u = new URL(url)
        if (u.pathname.endsWith('/stac/search')) {
            calls.stac.push(u)
            if (stacStatus !== 200) return jsonResponse({}, stacStatus)
            const limit = Number(u.searchParams.get('limit'))
            const token = u.searchParams.get('token')
            const start = token ? Number(token.split(':')[1]) : 0
            const size = Math.min(limit, pageSize || limit)
            const page = items.slice(start, start + size)
            const links = []
            if (start + size < items.length)
                links.push({
                    rel: 'next',
                    type: 'application/geo+json',
                    method: 'GET',
                    // the upstream host, as seen behind the proxy
                    href: `http://localhost:8881/search?token=next:${start + size}`,
                })
            return jsonResponse({
                type: 'FeatureCollection',
                features: page,
                links,
                numberMatched: numberMatched ?? items.length,
                numberReturned: page.length,
            })
        }
        if (u.pathname.includes('/point/')) {
            calls.point.push(u)
            if (pointStatus !== 200)
                return jsonResponse({ detail: 'x' }, pointStatus)
            const ids = u.searchParams
                .get('ids')
                .split(',')
                .map(decodeURIComponent)
            let assets = ids
                .filter((id) => values[id] !== undefined)
                .map((id) => pointAsset(id, values[id]))
            if (reverseTitiler) assets = assets.reverse()
            // titiler-pgstac 3.1 answers NoAssetFound with 204 No Content
            if (assets.length === 0)
                return {
                    ok: true,
                    status: 204,
                    json: async () => {
                        throw new SyntaxError('Unexpected end of JSON input')
                    },
                }
            return jsonResponse({ coordinates: [0, 0], assets })
        }
        throw new Error(`unexpected url ${url}`)
    }
    return { fetchFn, calls }
}

// -------------------------------------------------------------------------
test.describe('classifyLayer - eligibility', () => {
    test('a time-enabled STAC collection tile layer can be charted', () => {
        expect(classifyLayer(stacLayer())).toEqual({
            eligible: true,
            url: `stac-collection:${COLLECTION}`,
        })
    })

    test('every unsupported kind says why, and none is silently dropped', () => {
        const cases = [
            [{ type: 'vector', url: 'a.geojson' }, /Vector layer/],
            [{ type: 'vectortile', url: 'x' }, /Vector layer/],
            [{ type: 'model', url: 'x' }, /no raster pixel values/],
            [
                { type: 'tile', url: 'Layers/Tiles/{z}/{x}/{y}.png' },
                /Pre-rendered tiles/,
            ],
            [{ type: 'tile', url: 'COG:https://x/a.tif' }, /Single COG/],
            [
                {
                    type: 'tile',
                    url: 'COG:https://x/a_{time}.tif',
                    time: { enabled: true, end: 'x' },
                },
                /Time-enabled COG: each time window reads one file, and no catalog lists its acquisition times/,
            ],
            [{ type: 'image', url: 'Layers/a.tif' }, /Image layer/],
            [stacLayer({ time: { enabled: false } }), /Not time-enabled/],
            [stacLayer({ time: undefined }), /Not time-enabled/],
            [
                stacLayer({ time: { enabled: true, start: '', end: '' } }),
                /No time range/,
            ],
        ]
        for (const [layer, reason] of cases) {
            const c = classifyLayer(layer)
            expect(c.eligible).toBe(false)
            expect(c.reason).toMatch(reason)
        }
    })

    test('an Identifier url on plain tiles is a single file, not a history', () => {
        const c = classifyLayer(
            { type: 'tile', url: 'Layers/t/{z}/{x}/{y}.png' },
            { hasIdentifierDataSource: true }
        )
        expect(c.reason).toMatch(/single raster file/)
    })

    test('header layers are not data and are not listed', () => {
        expect(classifyLayer({ type: 'header' })).toBeNull()
        expect(classifyLayer(null)).toBeNull()
    })
})

test.describe('resolveStacEndpoints', () => {
    test("local collections use this site's /titilerpgstac and /stac", () => {
        expect(
            resolveStacEndpoints('stac-collection:abc?x=1', {
                origin: 'https://h',
                pathname: '/mmgis/',
            })
        ).toEqual({
            titilerBase: 'https://h/mmgis/titilerpgstac',
            stacBase: 'https://h/mmgis/stac',
            collection: 'abc',
            external: false,
        })
    })

    test('development points at the API port like the hover query', () => {
        expect(
            resolveStacEndpoints('stac-collection:abc', LOCATION, 'development')
                .stacBase
        ).toBe('http://localhost:8888/stac')
    })

    test('external collections use the sibling /stac of their TiTiler', () => {
        expect(
            resolveStacEndpoints(
                'stac-collection:https://ext.org/titilerpgstac/collections/c1',
                LOCATION
            )
        ).toEqual({
            titilerBase: 'https://ext.org/titilerpgstac',
            stacBase: 'https://ext.org/stac',
            collection: 'c1',
            external: true,
        })
    })

    test('unparseable urls give null', () => {
        expect(resolveStacEndpoints('COG:x', LOCATION)).toBeNull()
        expect(resolveStacEndpoints('stac-collection:', LOCATION)).toBeNull()
    })
})

test.describe('time window', () => {
    test("uses layer.time.start/end - the hover query's window", () => {
        expect(buildDatetimeParam({ start: 'A', end: 'B' })).toBe('A/B')
        expect(buildDatetimeParam({ start: '', end: 'B' })).toBe('../B')
        expect(buildDatetimeParam({ start: 'A', end: '' })).toBeNull()
        expect(buildDatetimeParam(null)).toBeNull()
    })

    test('the window is what the STAC search is filtered by', async () => {
        const { fetchFn, calls } = fakeServers({
            items: [item('a', '2024-02-01T00:00:00Z')],
            values: { a: [1] },
        })
        await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 10,
            lat: 20,
            fetchFn,
            location: LOCATION,
        })
        const u = calls.stac[0]
        expect(u.searchParams.get('datetime')).toBe(
            '2024-01-01T00:00:00Z/2024-06-30T23:59:59Z'
        )
        expect(u.searchParams.get('collections')).toBe(COLLECTION)
        expect(JSON.parse(u.searchParams.get('intersects'))).toEqual({
            type: 'Point',
            coordinates: [10, 20],
        })
    })
})

test.describe('acquisition timestamps', () => {
    test('parseIsoTime accepts ISO-8601 and rejects guesses', () => {
        expect(parseIsoTime('2024-01-02T03:04:05Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5)
        )
        expect(parseIsoTime('2024-01-02T03:04:05.123456Z')).not.toBeNull()
        expect(parseIsoTime('2024-01-02T03:04:05+02:00')).toBe(
            Date.UTC(2024, 0, 2, 1, 4, 5)
        )
        expect(parseIsoTime('2024-01-02')).toBe(Date.UTC(2024, 0, 2))
        for (const bad of [
            '5',
            'May',
            '',
            null,
            17,
            '2024-13-45T00:00:00Z',
            'item_2024_01_02.tif',
        ])
            expect(parseIsoTime(bad)).toBeNull()
    })

    test('properties.datetime is the time; a range uses its start', () => {
        expect(parseStacItemTime(item('a', '2024-03-01T00:00:00Z'))).toEqual({
            id: 'a',
            time: Date.UTC(2024, 2, 1),
            range: null,
        })
        expect(
            parseStacItemTime(
                item('r', null, {
                    start_datetime: '2024-03-01T00:00:00Z',
                    end_datetime: '2024-03-02T00:00:00Z',
                })
            )
        ).toEqual({
            id: 'r',
            time: Date.UTC(2024, 2, 1),
            range: ['2024-03-01T00:00:00Z', '2024-03-02T00:00:00Z'],
        })
    })

    test('items without a valid time or id are rejected, never guessed', () => {
        expect(parseStacItemTime(item('a', 'garbage'))).toBeNull()
        expect(parseStacItemTime(item('a', undefined))).toBeNull()
        // a filename-looking id is not a timestamp source
        expect(parseStacItemTime(item('EMIT_20240301T000000', null))).toBeNull()
        expect(
            parseStacItemTime({ properties: { datetime: '2024-01-01' } })
        ).toBeNull()
    })
})

test.describe('parseIsoTime - strict RFC 3339', () => {
    test('valid UTC and offset timestamps, to the millisecond', () => {
        expect(parseIsoTime('2024-01-02T03:04:05Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5)
        )
        expect(parseIsoTime('2024-01-02t03:04:05z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5)
        )
        expect(parseIsoTime('2024-01-02 03:04:05Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5)
        )
        expect(parseIsoTime('2024-01-02T03:04:05+05:45')).toBe(
            Date.UTC(2024, 0, 1, 21, 19, 5)
        )
        expect(parseIsoTime('2024-01-02T03:04:05-06:00')).toBe(
            Date.UTC(2024, 0, 2, 9, 4, 5)
        )
        expect(parseIsoTime('2024-01-02T03:04:05+00:00')).toBe(
            parseIsoTime('2024-01-02T03:04:05Z')
        )
        // fractional seconds: kept to the ms, longer fractions truncated
        expect(parseIsoTime('2024-01-02T03:04:05.1Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5, 100)
        )
        expect(parseIsoTime('2024-01-02T03:04:05.123456Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5, 123)
        )
        expect(parseIsoTime('2024-01-02T03:04:05.999999Z')).toBe(
            Date.UTC(2024, 0, 2, 3, 4, 5, 999)
        )
        // an offset can carry the instant across a day and year boundary
        expect(parseIsoTime('2024-01-01T00:30:00+01:00')).toBe(
            Date.UTC(2023, 11, 31, 23, 30, 0)
        )
        // the real EMIT item times
        expect(parseIsoTime('2024-01-30T20:47:07Z')).toBe(
            Date.UTC(2024, 0, 30, 20, 47, 7)
        )
        // years below 100 are not shifted into the 1900s
        expect(
            new Date(parseIsoTime('0050-06-01T00:00:00Z')).getUTCFullYear()
        ).toBe(50)
    })

    test('a time without a timezone is rejected', () => {
        for (const v of [
            '2024-01-02T03:04:05',
            '2024-01-02T03:04:05.123',
            '2024-01-02 03:04:05',
            '2024-01-02T03:04',
            '2024-01-02T03:04Z', // seconds are required
            '2024-01-02T03:04:05+0200', // RFC 3339 offsets have a colon
            '2024-01-02T03:04:05+02',
        ])
            expect(parseIsoTime(v), v).toBeNull()
    })

    test('impossible dates are rejected, not rolled into another day', () => {
        // Date.parse turns these into real dates (e.g. Feb 31 -> Mar 2)
        for (const v of [
            '2024-02-31T00:00:00Z',
            '2024-02-30',
            '2024-04-31T12:00:00Z',
            '2024-13-01T00:00:00Z',
            '2024-00-10T00:00:00Z',
            '2024-01-00T00:00:00Z',
            '2024-01-32',
            '2024-01-02T24:00:00Z',
            '2024-01-02T23:60:00Z',
            '2024-01-02T23:59:60Z', // leap second
            '2024-01-02T03:04:05+24:00',
            '2024-01-02T03:04:05+05:60',
        ])
            expect(parseIsoTime(v), v).toBeNull()
    })

    test('February 29 only in leap years', () => {
        expect(parseIsoTime('2024-02-29T12:00:00Z')).toBe(
            Date.UTC(2024, 1, 29, 12)
        )
        expect(parseIsoTime('2000-02-29')).toBe(Date.UTC(2000, 1, 29))
        expect(parseIsoTime('2400-02-29T00:00:00Z')).toBe(Date.UTC(2400, 1, 29))
        expect(parseIsoTime('2023-02-29T12:00:00Z')).toBeNull()
        expect(parseIsoTime('1900-02-29')).toBeNull()
        expect(parseIsoTime('2100-02-29T00:00:00Z')).toBeNull()
        expect(parseIsoTime('2023-02-28T23:59:59Z')).toBe(
            Date.UTC(2023, 1, 28, 23, 59, 59)
        )
    })

    test('a date alone is that day at 00:00 UTC', () => {
        expect(parseIsoTime('2024-01-02')).toBe(Date.UTC(2024, 0, 2))
        expect(parseIsoTime(' 2024-01-02 ')).toBe(Date.UTC(2024, 0, 2))
    })

    test('items whose datetime is invalid fall back or are rejected', () => {
        // no zone on datetime: not used; a valid start_datetime still is not,
        // because datetime is set (only a null datetime means "a range")
        expect(parseStacItemTime(item('a', '2024-03-01T00:00:00'))).toBeNull()
        expect(
            parseStacItemTime(
                item('r', null, {
                    start_datetime: '2024-02-31T00:00:00Z',
                    end_datetime: '2024-03-02T00:00:00Z',
                })
            )
        ).toBeNull()
    })
})

test.describe('STAC search paging', () => {
    test('the search url asks only for ids and times', () => {
        const u = new URL(
            buildStacSearchUrl(
                STAC_BASE,
                COLLECTION,
                1.5,
                -2,
                'A/B',
                100,
                'next:7'
            )
        )
        expect(u.pathname).toBe('/stac/search')
        expect(u.searchParams.get('limit')).toBe('100')
        expect(u.searchParams.get('token')).toBe('next:7')
        expect(u.searchParams.get('fields')).toContain('properties.datetime')
    })

    test('the next token is taken from the link, not its host', () => {
        expect(
            nextPageToken({
                links: [
                    {
                        rel: 'next',
                        href: 'http://localhost:8881/search?token=next:abc',
                    },
                ],
            })
        ).toBe('next:abc')
        expect(
            nextPageToken({
                links: [{ rel: 'next', body: { token: 'next:b' } }],
            })
        ).toBe('next:b')
        expect(
            nextPageToken({ links: [{ rel: 'self', href: 'x' }] })
        ).toBeNull()
        expect(nextPageToken({})).toBeNull()
    })

    test('pages through every item and re-sends to our own base url', async () => {
        const items = Array.from({ length: 23 }, (_, i) =>
            item(`i${i}`, new Date(Date.UTC(2024, 0, 1 + i)).toISOString())
        )
        const { fetchFn, calls } = fakeServers({ items, pageSize: 10 })
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            datetime: 'A/B',
        })
        expect(r.items).toHaveLength(23)
        expect(r.truncated).toBe(false)
        expect(calls.stac).toHaveLength(3)
        for (const c of calls.stac) expect(c.origin).toBe('https://mmgis.test')
    })

    test('stops at maxItems and says the history was cut short', async () => {
        const items = Array.from({ length: 30 }, (_, i) =>
            item(`i${i}`, new Date(Date.UTC(2024, 0, 1 + i)).toISOString())
        )
        const { fetchFn } = fakeServers({ items, pageSize: 10 })
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            limits: { ...TIME_SERIES_LIMITS, maxItems: 15, stacPageSize: 10 },
        })
        expect(r.items).toHaveLength(15)
        expect(r.truncated).toBe(true)
        expect(r.numberMatched).toBe(30)
    })

    test('a next link that never advances does not loop forever', async () => {
        let n = 0
        const fetchFn = async () => {
            n++
            return jsonResponse({
                features: [item(`x${n}`, '2024-01-01T00:00:00Z')],
                links: [
                    { rel: 'next', href: 'http://h/search?token=next:same' },
                ],
            })
        }
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
        })
        expect(n).toBe(2)
        expect(r.items).toHaveLength(2)
    })

    test('runs out of pages with more on offer -> truncated', async () => {
        let n = 0
        const fetchFn = async () => {
            n++
            return jsonResponse({
                features: [item(`x${n}`, '2024-01-01T00:00:00Z')],
                links: [
                    { rel: 'next', href: `http://h/search?token=next:${n}` },
                ],
            })
        }
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            limits: { ...TIME_SERIES_LIMITS, maxStacPages: 3 },
        })
        expect(n).toBe(3)
        expect(r.truncated).toBe(true)
    })

    test('duplicate and timeless items', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('a', '2024-01-01T00:00:00Z'),
                item('a', '2024-01-01T00:00:00Z'),
                item('bad', 'nope'),
            ],
            numberMatched: 3,
        })
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
        })
        expect(r.items.map((i) => i.id)).toEqual(['a'])
        expect(r.invalidTimes).toBe(1)
    })

    test('an HTTP failure throws with its status', async () => {
        const { fetchFn } = fakeServers({ stacStatus: 502 })
        await expect(
            fetchStacItems({
                fetchFn,
                stacBase: STAC_BASE,
                collection: COLLECTION,
                lng: 0,
                lat: 0,
            })
        ).rejects.toThrow('HTTP 502')
    })
})

test.describe('bands, expressions, point query', () => {
    test('the runtime expression wins, then the configured one, normalised', () => {
        expect(
            buildBandParams({
                cogExpression: 'asset_b1*2',
                currentCogExpression: 'b2/b1',
            })
        ).toEqual({ assets: 'asset', expression: 'b2/b1' })
        expect(buildBandParams({ cogExpression: 'asset_b1*2' })).toEqual({
            assets: 'asset',
            expression: 'b1*2',
        })
        expect(buildBandParams({ cogBandsQuery: [1, null, 3] })).toEqual({
            assets: 'asset|bidx=1,3',
            expression: null,
        })
        expect(buildBandParams({})).toEqual({
            assets: 'asset',
            expression: null,
        })
    })

    test('a point query names its items and can return them all', () => {
        const url = buildPointUrl(
            TITILER_BASE,
            COLLECTION,
            1,
            2,
            ['a', 'b/c'],
            { cogExpression: 'b1+1' },
            { mosaicScanLimit: 500, mosaicTimeLimit: 9 }
        )
        expect(url).toContain(`/collections/${COLLECTION}/point/1,2?`)
        const u = new URL(url)
        expect(u.searchParams.get('ids')).toBe('a,b/c')
        expect(u.searchParams.get('items_limit')).toBe('2')
        expect(u.searchParams.get('scan_limit')).toBe('500')
        expect(u.searchParams.get('time_limit')).toBe('9')
        expect(u.searchParams.get('expression')).toBe('b1+1')
    })

    test('values are matched to items by asset name, not position', () => {
        const byId = parsePointResponse(
            {
                assets: [
                    pointAsset('second', [2]),
                    pointAsset('first', [1]),
                    {
                        name: `${COLLECTION}/with/slash`,
                        values: [3],
                        band_names: ['b1'],
                    },
                ],
            },
            COLLECTION
        )
        expect(byId.get('first').values).toEqual([1])
        expect(byId.get('second').values).toEqual([2])
        expect(byId.get('with/slash').values).toEqual([3])
        expect(parsePointResponse(null, COLLECTION).size).toBe(0)
    })

    test('batches ids, bounds concurrency, and reads 204/404 as no pixel', async () => {
        let inFlight = 0
        let peak = 0
        const seen = []
        const fetchFn = async (url) => {
            inFlight++
            peak = Math.max(peak, inFlight)
            await new Promise((r) => setTimeout(r, 5))
            inFlight--
            const ids = new URL(url).searchParams.get('ids').split(',')
            seen.push(ids.length)
            if (ids[0] === 'i100') return { ok: true, status: 204 }
            if (ids[0] === 'i50') return jsonResponse({}, 404)
            return jsonResponse({
                assets: ids.map((id) => pointAsset(id, [1])),
            })
        }
        const ids = Array.from({ length: 120 }, (_, i) => `i${i}`)
        const out = await fetchPointValues({
            fetchFn,
            titilerBase: TITILER_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ids,
            layer: {},
        })
        expect(seen.sort()).toEqual([20, 50, 50])
        expect(peak).toBeLessThanOrEqual(TIME_SERIES_LIMITS.pointConcurrency)
        expect(out.size).toBe(50)
    })

    test('after a failed batch no further batches are started', async () => {
        const started = []
        const fetchFn = async (url) => {
            const ids = new URL(url).searchParams.get('ids').split(',')
            started.push(ids[0])
            if (ids[0] === 'i0') return jsonResponse({}, 500)
            await new Promise((r) => setTimeout(r, 5))
            return jsonResponse({ assets: [] })
        }
        await expect(
            fetchPointValues({
                fetchFn,
                titilerBase: TITILER_BASE,
                collection: COLLECTION,
                lng: 0,
                lat: 0,
                ids: Array.from({ length: 300 }, (_, i) => `i${i}`),
                layer: {},
            })
        ).rejects.toThrow('HTTP 500')
        await new Promise((r) => setTimeout(r, 30))
        // 6 batches exist; only the two first in flight ever started
        expect(started.sort()).toEqual(['i0', 'i50'])
    })

    test('a point query error throws', async () => {
        const fetchFn = async () => jsonResponse({}, 500)
        await expect(
            fetchPointValues({
                fetchFn,
                titilerBase: TITILER_BASE,
                collection: COLLECTION,
                lng: 0,
                lat: 0,
                ids: ['a'],
                layer: {},
            })
        ).rejects.toThrow('HTTP 500')
    })
})

test.describe('buildSeries', () => {
    const at = (d) => Date.UTC(2024, 0, d)
    const its = (pairs) =>
        pairs.map(([id, d]) => ({ id, time: at(d), range: null }))
    const vals = (obj) =>
        new Map(
            Object.entries(obj).map(([k, v]) => [
                k,
                { values: v, bandNames: ['b1'] },
            ])
        )

    test('chronological, whatever order the items arrive in', () => {
        const r = buildSeries(
            its([
                ['c', 3],
                ['a', 1],
                ['b', 2],
            ]),
            vals({ a: [10], b: [20], c: [30] })
        )
        expect(r.series[0].points.map((p) => p.itemId)).toEqual(['a', 'b', 'c'])
        expect(r.series[0].points.map((p) => p.value)).toEqual([10, 20, 30])
    })

    test('shared timestamps keep every item, ordered by id, and are counted', () => {
        const r = buildSeries(
            its([
                ['z', 1],
                ['m', 1],
                ['a', 2],
            ]),
            vals({ z: [1], m: [2], a: [3] })
        )
        expect(r.series[0].points.map((p) => p.itemId)).toEqual(['m', 'z', 'a'])
        expect(r.duplicateTimes).toBe(1)
        // the same input in another order gives the same output
        const again = buildSeries(
            its([
                ['a', 2],
                ['m', 1],
                ['z', 1],
            ]),
            vals({ z: [1], m: [2], a: [3] })
        )
        expect(again.series).toEqual(r.series)
    })

    test('nodata stays null - never zero - and the scale factor skips it', () => {
        const r = buildSeries(
            its([
                ['a', 1],
                ['b', 2],
            ]),
            vals({ a: [null], b: [4] }),
            { scalefactor: 0.5, units: 'K' }
        )
        expect(r.series[0].points.map((p) => p.value)).toEqual([null, 2])
        expect(r.series[0].points.map((p) => p.status)).toEqual([
            'nodata',
            'ok',
        ])
        expect(r.series[0].units).toBe('K')
        expect(r.withValue).toBe(1)
        expect(r.nodata).toBe(1)
    })

    test('invalid readings keep their time as gaps, counted', () => {
        const r = buildSeries(
            its([
                ['a', 1],
                ['b', 2],
                ['c', 3],
                ['d', 4],
            ]),
            vals({ a: [NaN], b: [Infinity], c: ['12'], d: [7] })
        )
        const pts = r.series[0].points
        expect(pts.map((p) => p.itemId)).toEqual(['a', 'b', 'c', 'd'])
        expect(pts.map((p) => p.time)).toEqual([at(1), at(2), at(3), at(4)])
        expect(pts.map((p) => p.value)).toEqual([null, null, null, 7])
        expect(pts.map((p) => p.status)).toEqual([
            'invalid',
            'invalid',
            'invalid',
            'ok',
        ])
        expect(r.invalidValues).toBe(3)
    })

    test('an acquisition with no returned asset is a gap at its time', () => {
        const r = buildSeries(
            its([
                ['a', 1],
                ['b', 2],
                ['c', 3],
            ]),
            vals({ a: [1], c: [3] })
        )
        expect(r.missing).toBe(1)
        expect(
            r.series[0].points.map((p) => [p.itemId, p.value, p.status])
        ).toEqual([
            ['a', 1, 'ok'],
            ['b', null, 'missing'],
            ['c', 3, 'ok'],
        ])
    })

    test('a band an acquisition did not return is a gap in that band only', () => {
        const r = buildSeries(
            its([
                ['a', 1],
                ['b', 2],
            ]),
            new Map([
                ['a', { values: [1, 2], bandNames: ['red', 'nir'] }],
                ['b', { values: [3], bandNames: ['red'] }],
            ])
        )
        expect(r.series.map((s) => s.name)).toEqual(['red', 'nir'])
        expect(r.series[0].points.map((p) => p.value)).toEqual([1, 3])
        expect(r.series[1].points.map((p) => [p.value, p.status])).toEqual([
            [2, 'ok'],
            [null, 'missing'],
        ])
        expect(r.missingBands).toBe(1)
        expect(r.missing).toBe(0)
    })

    test('nothing returned at all: still one series of gaps, no values', () => {
        const r = buildSeries(its([['a', 1]]), new Map())
        expect(r.series).toHaveLength(1)
        expect(r.series[0].points).toEqual([
            {
                time: at(1),
                value: null,
                status: 'missing',
                itemId: 'a',
                range: null,
            },
        ])
        expect(r.withValue).toBe(0)
    })

    test('scaling never plots an infinite value', () => {
        const r = buildSeries(
            its([
                ['a', 1],
                ['b', 2],
                ['c', 3],
            ]),
            vals({ a: [1e300], b: [-1e300], c: [2] }),
            { scalefactor: 1e10 }
        )
        const pts = r.series[0].points
        expect(pts.map((p) => [p.value, p.status])).toEqual([
            [null, 'invalid'],
            [null, 'invalid'],
            [2e10, 'ok'],
        ])
        expect(
            pts.every((p) => p.value === null || Number.isFinite(p.value))
        ).toBe(true)
        expect(r.invalidValues).toBe(2)
        expect(r.withValue).toBe(1)
        // the same readings unscaled are fine
        const plain = buildSeries(its([['a', 1]]), vals({ a: [1e300] }))
        expect(plain.series[0].points[0]).toMatchObject({
            value: 1e300,
            status: 'ok',
        })
    })

    test('an overflowing scale reaches the chart only as a gap', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('a', '2024-02-01T00:00:00Z'),
                item('b', '2024-02-02T00:00:00Z'),
            ],
            values: { a: [Number.MAX_VALUE], b: [3] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
            identifierConfig: { scalefactor: 10 },
        })
        expect(r.status).toBe('ok')
        expect(r.series[0].points.map((p) => p.value)).toEqual([null, 30])
        expect(r.notes.join(' ')).toMatch(/1 non-numeric value shown as gaps/)
        const data = buildChartOption(r.series).series[0].data
        expect(
            data.every(
                (d) => d.value[1] === null || Number.isFinite(d.value[1])
            )
        ).toBe(true)
    })

    test('positional band names fill only bands no response named', () => {
        const r = buildSeries(
            its([['a', 1]]),
            new Map([['a', { values: [1, 2, 3], bandNames: ['red'] }]])
        )
        expect(r.series.map((s) => s.name)).toEqual(['red', 'b2', 'b3'])
    })

    test('readValue says what a band holds', () => {
        expect(readValue([5], 0)).toEqual({ value: 5, status: 'ok' })
        expect(readValue([null], 0)).toEqual({ value: null, status: 'nodata' })
        expect(readValue([5], 1)).toEqual({ value: null, status: 'missing' })
        expect(readValue(undefined, 0)).toEqual({
            value: null,
            status: 'missing',
        })
        expect(readValue([NaN], 0).status).toBe('invalid')
        expect(readValue([-Infinity], 0).status).toBe('invalid')
        expect(readValue(['1'], 0).status).toBe('invalid')
        expect(readValue([0], 0)).toEqual({ value: 0, status: 'ok' })
    })

    test('one series per band, with per-band units', () => {
        const r = buildSeries(
            its([['a', 1]]),
            new Map([['a', { values: [1, 2], bandNames: ['b1', 'b2'] }]]),
            { units: ['m', 's'] }
        )
        expect(
            r.series.map((s) => [s.name, s.units, s.points[0].value])
        ).toEqual([
            ['b1', 'm', 1],
            ['b2', 's', 2],
        ])
    })

    test('measurement: Identifier config first, then cogUnits', () => {
        expect(resolveMeasurement({ cogUnits: 'ppm' })).toEqual({
            scalefactor: 1,
            units: 'ppm',
        })
        expect(
            resolveMeasurement(
                { cogUnits: 'ppm' },
                { scalefactor: '0.01', unit: ' K' }
            )
        ).toEqual({ scalefactor: 0.01, units: ' K' })
        expect(resolveMeasurement({}, { scalefactor: 'x' }).scalefactor).toBe(1)
    })
})

test.describe('fetchLayerTimeSeries - end to end against fake servers', () => {
    test("a long history is charted whole, past the hover's 10-item cap", async () => {
        const items = Array.from({ length: 30 }, (_, i) =>
            item(
                `i${String(i).padStart(2, '0')}`,
                new Date(Date.UTC(2024, 0, 30 - i)).toISOString()
            )
        )
        const values = Object.fromEntries(
            items.map((it, i) => [it.id, [100 - i]])
        )
        const { fetchFn } = fakeServers({ items, values })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('ok')
        const pts = r.series[0].points
        expect(pts).toHaveLength(30)
        // oldest first; each value is its own item's, though TiTiler answered
        // in reverse and the STAC listing was newest first
        expect(pts[0]).toMatchObject({
            itemId: 'i29',
            value: 71,
            time: Date.UTC(2024, 0, 1),
        })
        expect(pts[29]).toMatchObject({ itemId: 'i00', value: 100 })
        expect(r.series[0].units).toBe('ppm m')
        expect(r.notes).toEqual([])
    })

    test('no items in the window -> empty, with a reason', async () => {
        const { fetchFn, calls } = fakeServers({ items: [] })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('empty')
        expect(r.message).toMatch(/No acquisitions/)
        expect(calls.point).toHaveLength(0)
    })

    test('every acquisition nodata -> empty, not a line of zeros', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('a', '2024-02-01T00:00:00Z'),
                item('b', '2024-03-01T00:00:00Z'),
            ],
            values: { a: [null], b: [null] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('empty')
        expect(r.message).toMatch(/nodata/)
    })

    test('TiTiler 204 (no asset) for every item -> empty, times kept', async () => {
        const { fetchFn } = fakeServers({
            items: [item('a', '2024-02-01T00:00:00Z')],
            values: {},
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('empty')
        expect(r.message).toMatch(/No usable values/)
        expect(r.notes.join(' ')).toMatch(
            /1 acquisition returned no reading here \(gaps\)/
        )
    })

    test('a missing acquisition between two readings is a gap, not a bridge', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('jan', '2024-01-10T00:00:00Z'),
                item('feb', '2024-02-10T00:00:00Z'),
                item('mar', '2024-03-10T00:00:00Z'),
            ],
            values: { jan: [1], mar: [3] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('ok')
        expect(r.series[0].points.map((p) => [p.itemId, p.value])).toEqual([
            ['jan', 1],
            ['feb', null],
            ['mar', 3],
        ])
        // and the chart breaks the line there
        const o = buildChartOption(r.series)
        expect(o.series[0].connectNulls).toBe(false)
        expect(o.series[0].data[1].value).toEqual([Date.UTC(2024, 1, 10), null])
        expect(o.series[0].data[1].status).toBe('missing')
    })

    test('STAC and TiTiler failures are reported, not charted', async () => {
        const stacDown = fakeServers({ stacStatus: 500 })
        const r1 = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn: stacDown.fetchFn,
            location: LOCATION,
        })
        expect(r1.status).toBe('error')
        expect(r1.message).toMatch(/STAC API.*HTTP 500/)

        const titilerDown = fakeServers({
            items: [item('a', '2024-02-01T00:00:00Z')],
            pointStatus: 503,
        })
        const r2 = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn: titilerDown.fetchFn,
            location: LOCATION,
        })
        expect(r2.status).toBe('error')
        expect(r2.message).toMatch(/HTTP 503/)
    })

    test('a network error is an error result; an abort rejects', async () => {
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn: async () => {
                throw new TypeError('Failed to fetch')
            },
            location: LOCATION,
        })
        expect(r.status).toBe('error')
        const abort = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        })
        await expect(
            fetchLayerTimeSeries({
                layer: stacLayer(),
                lng: 0,
                lat: 0,
                fetchFn: async () => {
                    throw abort
                },
                location: LOCATION,
            })
        ).rejects.toBe(abort)
    })

    test('expression and scale factor reach the query and the values', async () => {
        const { fetchFn, calls } = fakeServers({
            items: [item('a', '2024-02-01T00:00:00Z')],
            values: { a: [8] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer({ cogExpression: 'asset_b1/2' }),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
            identifierConfig: { scalefactor: 10 },
        })
        expect(calls.point[0].searchParams.get('expression')).toBe('b1/2')
        expect(r.series[0].points[0].value).toBe(80)
        expect(r.expression).toBe('b1/2')
    })
})

test.describe('request guard', () => {
    test('a new request aborts the old one and makes it stale', () => {
        const g = createRequestGuard()
        const a = g.begin()
        const b = g.begin()
        expect(a.signal.aborted).toBe(true)
        expect(a.isCurrent()).toBe(false)
        expect(b.isCurrent()).toBe(true)
        g.cancel()
        expect(b.signal.aborted).toBe(true)
        expect(b.isCurrent()).toBe(false)
    })

    test('the cache key changes with the point, window and expression', () => {
        const l = stacLayer()
        const k = cacheKey('u', l, 1, 2)
        expect(cacheKey('u', l, 1, 2)).toBe(k)
        expect(cacheKey('u', l, 1, 2.001)).not.toBe(k)
        expect(
            cacheKey(
                'u',
                stacLayer({ time: { enabled: true, start: 'x', end: 'y' } }),
                1,
                2
            )
        ).not.toBe(k)
        expect(
            cacheKey('u', stacLayer({ currentCogExpression: 'b1' }), 1, 2)
        ).not.toBe(k)
        expect(cacheKey('u', stacLayer({ cogBandsQuery: [2] }), 1, 2)).not.toBe(
            k
        )
    })

    test('the cache key changes with the measurement (scale factor, units)', () => {
        const l = stacLayer()
        const k = cacheKey('u', l, 1, 2, undefined)
        expect(cacheKey('u', l, 1, 2, { scalefactor: 1 })).toBe(k)
        expect(cacheKey('u', l, 1, 2, { scalefactor: 10 })).not.toBe(k)
        expect(cacheKey('u', l, 1, 2, { unit: 'K' })).not.toBe(k)
        expect(cacheKey('u', stacLayer({ cogUnits: 'ppb' }), 1, 2)).not.toBe(k)
        expect(
            cacheKey('u', stacLayer({ cogUnits: ['a', 'b'] }), 1, 2)
        ).not.toBe(cacheKey('u', stacLayer({ cogUnits: ['a', 'c'] }), 1, 2))
    })
})

// -------------------------------------------------------------------------
test.describe('chart option', () => {
    const series = [
        {
            name: 'b1',
            units: 'ppm',
            points: [
                {
                    time: Date.UTC(2024, 0, 1),
                    value: 1.5,
                    itemId: 'a',
                    range: null,
                },
                {
                    time: Date.UTC(2024, 0, 2),
                    value: null,
                    itemId: 'b',
                    range: null,
                },
            ],
        },
    ]

    test('time on x, value + units on y, nulls kept as gaps', () => {
        const o = buildChartOption(series)
        expect(o.xAxis.type).toBe('time')
        expect(o.yAxis.type).toBe('value')
        expect(o.yAxis.name).toBe('(ppm)')
        expect(o.series[0].connectNulls).toBe(false)
        expect(o.series[0].data.map((d) => d.value)).toEqual([
            [Date.UTC(2024, 0, 1), 1.5],
            [Date.UTC(2024, 0, 2), null],
        ])
        expect(o.legend).toBeUndefined()
    })

    test('several bands get a legend; mixed units leave the axis unitless', () => {
        const two = [series[0], { ...series[0], name: 'b2', units: 'K' }]
        const o = buildChartOption(two, { measurementLabel: 'b1/b2' })
        expect(o.legend).toBeDefined()
        expect(axisUnits(two)).toBe('')
        expect(o.yAxis.name).toBe('b1/b2')
    })

    test('the tooltip says when, what, and "no data" for nodata - escaped', () => {
        const o = buildChartOption([{ ...series[0], name: '<b1>' }])
        const html = o.tooltip.formatter([
            {
                seriesIndex: 0,
                seriesName: '<b1>',
                data: o.series[0].data[1],
                marker: '',
            },
        ])
        expect(html).toContain('2024-01-02 00:00:00 UTC')
        expect(html).toContain('no data')
        expect(html).toContain('&lt;b1&gt;')
        expect(html).not.toContain('<b1>')
        expect(html).toContain('>b<')
    })

    test('each kind of gap is named in the tooltip', () => {
        const pts = ['nodata', 'missing', 'invalid'].map((status, i) => ({
            time: Date.UTC(2024, 0, i + 1),
            value: null,
            status,
            itemId: status,
            range: null,
        }))
        const o = buildChartOption([{ name: 'b1', units: 'K', points: pts }])
        const say = (i) =>
            o.tooltip.formatter([
                { seriesIndex: 0, seriesName: 'b1', data: o.series[0].data[i] },
            ])
        expect(say(0)).toContain('<b>no data</b>')
        expect(say(1)).toContain('<b>no reading</b>')
        expect(say(2)).toContain('<b>invalid value</b>')
        // no units after a gap
        expect(say(1)).not.toContain('no reading K')
        expect(gapLabel(undefined)).toBe('no data')
    })

    test('formatting helpers', () => {
        expect(formatUtc(Date.UTC(2024, 4, 6, 7, 8, 9))).toBe(
            '2024-05-06 07:08:09 UTC'
        )
        expect(formatValue(null)).toBe('no data')
        expect(formatValue(NaN)).toBe('no data')
        expect(formatValue(0)).toBe('0')
        expect(formatValue(1.23456789)).toBe('1.2346')
        expect(formatValue(123456789)).toBe('1.235e+8')
    })
})

test.describe('chart lifecycle (real ECharts, server-side render)', () => {
    test('resizes with its container and releases everything on dispose', () => {
        const observed = []
        let disconnected = 0
        class FakeRO {
            constructor(cb) {
                this.cb = cb
            }
            observe(el) {
                observed.push(this)
            }
            disconnect() {
                disconnected++
            }
        }
        // ssr init needs no element; the observer is still attached when one is given
        const container = {}
        const origInit = echarts.init
        const chart = createTimeSeriesChart(
            container,
            buildChartOption([
                {
                    name: 'b1',
                    units: '',
                    points: [{ time: 1, value: 1, itemId: 'a' }],
                },
            ]),
            {
                echarts: {
                    init: (el, theme, opts) =>
                        origInit(null, theme, {
                            renderer: 'svg',
                            ssr: true,
                            width: 300,
                            height: 180,
                        }),
                },
                ResizeObserver: FakeRO,
            }
        )
        expect(chart.instance.getWidth()).toBe(300)
        chart.resize({ width: 420, height: 200 })
        expect(chart.instance.getWidth()).toBe(420)
        expect(observed).toHaveLength(1)
        const inst = chart.instance
        chart.dispose()
        expect(inst.isDisposed()).toBe(true)
        expect(disconnected).toBe(1)
        expect(chart.instance).toBeNull()
        // resize/setOption after dispose are no-ops, not throws
        chart.resize()
        chart.setOption({})
    })
})

// -------------------------------------------------------------------------
function fakeView() {
    const log = []
    let closeHandler
    return {
        log,
        onClose: (fn) => (closeHandler = fn),
        clickClose: () => closeHandler(),
        open: () => log.push(['open']),
        close: () => log.push(['close']),
        render: (pt, eligible, unsupported) =>
            log.push([
                'render',
                pt,
                eligible.map((e) => e.uuid),
                unsupported.map((u) => [u.uuid, u.reason]),
            ]),
        renderResult: (uuid, result) => log.push(['result', uuid, result]),
        results: () => log.filter((l) => l[0] === 'result'),
    }
}

function fakeMarker() {
    const m = { at: null, placed: 0, removed: 0 }
    m.place = (lng, lat) => {
        m.at = [lng, lat]
        m.placed++
    }
    m.remove = () => {
        m.at = null
        m.removed++
    }
    return m
}

const deferred = () => {
    let resolve, reject
    const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function makeLayers() {
    return {
        data: {
            ch4: stacLayer({ display_name: 'Methane' }),
            no2: stacLayer({ display_name: 'NO2', url: 'stac-collection:no2' }),
            roads: {
                type: 'vector',
                display_name: 'Roads',
                url: 'r.geojson',
                time: { enabled: true },
            },
            cog: { type: 'tile', display_name: 'DEM', url: 'COG:x.tif' },
            hdr: { type: 'header', display_name: 'Group' },
            off: stacLayer({ display_name: 'Off' }),
        },
        on: {
            ch4: true,
            no2: true,
            roads: true,
            cog: true,
            hdr: true,
            off: false,
        },
    }
}

test.describe('controller - click, marker, panel', () => {
    test('lists active layers: chartable ones, and the rest with reasons', () => {
        const r = listActiveLayers(makeLayers())
        expect(r.eligible.map((e) => e.uuid)).toEqual(['ch4', 'no2'])
        expect(r.unsupported.map((u) => u.uuid)).toEqual(['roads', 'cog'])
        expect(r.anyTimeEnabled).toBe(true)
    })

    test('a click places the marker, opens the panel and charts each layer', async () => {
        const view = fakeView()
        const marker = fakeMarker()
        const fetched = []
        const c = createTimeSeriesController({
            getLayers: makeLayers,
            fetchSeries: async (a) => {
                fetched.push([a.layerUUID, a.lng, a.lat])
                return { status: 'ok', series: [], notes: [] }
            },
            marker,
            view,
        })
        expect(c.selectPoint(5, 6)).toBe(true)
        expect(marker.at).toEqual([5, 6])
        expect(view.log[0]).toEqual(['open'])
        expect(view.log[1][2]).toEqual(['ch4', 'no2'])
        expect(view.log[1][3].map((u) => u[0])).toEqual(['roads', 'cog'])
        await flush()
        expect(fetched).toEqual([
            ['ch4', 5, 6],
            ['no2', 5, 6],
        ])
        expect(view.results().map((r) => r[1])).toEqual(['ch4', 'no2'])
    })

    test('another click moves the marker and refreshes the charts', async () => {
        const view = fakeView()
        const marker = fakeMarker()
        const fetched = []
        const c = createTimeSeriesController({
            getLayers: makeLayers,
            fetchSeries: async (a) => {
                fetched.push([a.layerUUID, a.lng])
                return { status: 'ok', series: [] }
            },
            marker,
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        c.selectPoint(2, 2)
        await flush()
        expect(marker.at).toEqual([2, 2])
        expect(marker.placed).toBe(2)
        expect(view.log.filter((l) => l[0] === 'open')).toHaveLength(1)
        expect(fetched.filter((f) => f[1] === 2)).toHaveLength(2)
        expect(c.getPoint()).toEqual({ lng: 2, lat: 2 })
    })

    test('no time-enabled layer on: the click is left alone', () => {
        const view = fakeView()
        const marker = fakeMarker()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { t: { type: 'tile', url: 'x/{z}/{x}/{y}.png' } },
                on: { t: true },
            }),
            fetchSeries: async () => ({}),
            marker,
            view,
        })
        expect(c.selectPoint(1, 1)).toBe(false)
        expect(marker.placed).toBe(0)
        expect(view.log).toEqual([])
        expect(c.selectPoint(NaN, 1)).toBe(false)
    })

    test("rapid clicks: only the newest click's results are drawn", async () => {
        const view = fakeView()
        const pending = []
        const signals = []
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) => {
                const d = deferred()
                pending.push({ d, lng: a.lng })
                signals.push(a.signal)
                return d.promise
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 0)
        c.selectPoint(2, 0)
        c.selectPoint(3, 0)
        await flush()
        expect(pending).toHaveLength(3)
        expect(signals[0].aborted).toBe(true)
        expect(signals[1].aborted).toBe(true)
        expect(signals[2].aborted).toBe(false)
        // answers arrive newest first, then the stale ones
        pending[2].d.resolve({ status: 'ok', series: [{ name: 'third' }] })
        pending[0].d.resolve({ status: 'ok', series: [{ name: 'first' }] })
        pending[1].d.reject(
            Object.assign(new Error('x'), { name: 'AbortError' })
        )
        await flush()
        expect(view.results()).toHaveLength(1)
        expect(view.results()[0][2].series[0].name).toBe('third')
    })

    test('closing removes the marker and drops results still on the way', async () => {
        const view = fakeView()
        const marker = fakeMarker()
        const d = deferred()
        let signal
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) => {
                signal = a.signal
                return d.promise
            },
            marker,
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        view.clickClose()
        expect(marker.at).toBeNull()
        expect(marker.removed).toBeGreaterThan(0)
        expect(view.log.at(-1)).toEqual(['close'])
        expect(signal.aborted).toBe(true)
        expect(c.isOpen()).toBe(false)
        d.resolve({ status: 'ok', series: [] })
        await flush()
        expect(view.results()).toHaveLength(0)
        // refresh after close does nothing
        c.refresh()
        expect(view.log.at(-1)).toEqual(['close'])
    })

    test('destroy (Identifier off) closes everything and empties the cache', async () => {
        const view = fakeView()
        const marker = fakeMarker()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: async () => ({ status: 'ok', series: [] }),
            marker,
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        expect(c._cacheSize()).toBe(1)
        c.destroy()
        expect(c._cacheSize()).toBe(0)
        expect(marker.at).toBeNull()
        expect(c.isOpen()).toBe(false)
    })

    test('a repeat click is served from cache; failures are retried', async () => {
        const view = fakeView()
        let calls = 0
        let fail = true
        const layers = {
            data: {
                ch4: stacLayer(),
                no2: stacLayer({ url: 'stac-collection:no2' }),
            },
            on: { ch4: true, no2: true },
        }
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: async (a) => {
                calls++
                if (a.layerUUID === 'no2' && fail)
                    return { status: 'error', message: 'down' }
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        expect(calls).toBe(2)
        fail = false
        c.selectPoint(1, 1)
        await flush()
        // ch4 cached, no2 retried
        expect(calls).toBe(3)
        expect(
            view
                .results()
                .slice(-2)
                .map((r) => r[2].status)
        ).toEqual(['ok', 'ok'])
    })

    test('a thrown fetch shows an error for that layer only', async () => {
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: {
                    ch4: stacLayer(),
                    no2: stacLayer({ url: 'stac-collection:no2' }),
                },
                on: { ch4: true, no2: true },
            }),
            fetchSeries: async (a) => {
                if (a.layerUUID === 'no2') throw new Error('boom')
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        const byLayer = Object.fromEntries(
            view.results().map((r) => [r[1], r[2]])
        )
        expect(byLayer.ch4.status).toBe('ok')
        expect(byLayer.no2).toEqual({
            status: 'error',
            message: 'Time series failed: boom',
        })
    })

    test('the Identifier config is passed through for scale and units', async () => {
        let got
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            getIdentifierConfig: (uuid) =>
                uuid === 'ch4' ? { scalefactor: 2 } : undefined,
            fetchSeries: async (a) => {
                got = a.identifierConfig
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view: fakeView(),
        })
        c.selectPoint(1, 1)
        await flush()
        expect(got).toEqual({ scalefactor: 2 })
    })
})

// -------------------------------------------------------------------------
test.describe('click guard - whose click is it', () => {
    // A stand-in for Leaflet's map.listens(type, fn): the set of live handlers.
    const mapWith = (...handlers) => {
        const live = new Set(handlers)
        return {
            live,
            listens: (type, fn) => type === 'click' && live.has(fn),
            getContainer: () => CONTAINER,
        }
    }
    const CONTAINER = { classList: { contains: () => false }, parentNode: null }
    const el = (classes, parent = CONTAINER) => ({
        classList: { contains: (c) => classes.includes(c) },
        parentNode: parent,
    })
    const click = (target = el([]), latlng = { lat: 1, lng: 2 }) => ({
        latlng,
        originalEvent: { target },
    })

    test("no toolbar tool: a plain map click is the Identifier's", () => {
        expect(
            shouldChartMapClick(click(), { activeTool: null, map: mapWith() })
        ).toBe(true)
    })

    test('an unrelated click listener never makes a tool claim the click', () => {
        // MMGIS itself always listens for map clicks (clearOnMapClick), and
        // so does the Identifier; neither is the active tool's handler.
        const unrelated = () => {}
        const map = mapWith(unrelated)
        const drawIdle = { drawing: { polygon: { start() {} } } }
        expect(toolClaimingClicks(drawIdle, map.listens)).toBeNull()
        expect(
            shouldChartMapClick(click(), { activeTool: drawIdle, map })
        ).toBe(true)
    })

    test('listens is trusted only when it answers for one handler', () => {
        const registered = () => {}
        // Leaflet >= 1.8 (1.9.4 here): per handler
        expect(listensIsHandlerSpecific(mapWith(registered).listens)).toBe(true)
        // Leaflet < 1.8: the fn is ignored - "does anything listen?"
        const anyListener = (type) => type === 'click'
        expect(listensIsHandlerSpecific(anyListener)).toBe(false)
        // ...then a tool's handler can't be told from any other listener,
        // so only the explicit flag is used, and plain clicks still chart
        const sightline = { _onMapClick: registered }
        expect(toolClaimingClicks(sightline, anyListener)).toBeNull()
        expect(
            toolClaimingClicks({ disableLayerInteractions: true }, anyListener)
        ).toBe('tool-disables-layer-interactions')
        expect(listensIsHandlerSpecific(null)).toBe(false)
        expect(
            listensIsHandlerSpecific(() => {
                throw new Error('x')
            })
        ).toBe(false)
    })

    test('a tool that disables layer interactions (Measure) keeps the click', () => {
        const measure = { disableLayerInteractions: true, clickMap() {} }
        expect(toolClaimingClicks(measure, mapWith().listens)).toBe(
            'tool-disables-layer-interactions'
        )
        expect(
            shouldChartMapClick(click(), {
                activeTool: measure,
                map: mapWith(),
            })
        ).toBe(false)
    })

    test('a tool with its own live map-click handler keeps the click (Sightline, Viewshed)', () => {
        const sightline = { _onMapClick() {}, _onPanEnd() {} }
        const map = mapWith(sightline._onMapClick)
        expect(toolClaimingClicks(sightline, map.listens)).toBe(
            'tool-click-handler'
        )
        expect(
            shouldChartMapClick(click(), { activeTool: sightline, map })
        ).toBe(false)
        // once the tool removes its handler, clicks are the Identifier's again
        map.live.clear()
        expect(
            shouldChartMapClick(click(), { activeTool: sightline, map })
        ).toBe(true)
    })

    test('handlers kept a level or two down are found (Animation, Draw)', () => {
        const animation = { drawingHandlers: { click() {}, mousemove() {} } }
        expect(
            toolHasHandler(
                animation,
                mapWith(animation.drawingHandlers.click).listens
            )
        ).toBe(true)
        const draw = {
            drawing: {
                polygon: { start() {}, stop() {} },
                line: { start() {} },
            },
        }
        const drawing = mapWith(draw.drawing.line.start)
        expect(toolHasHandler(draw, drawing.listens)).toBe(true)
        // Draw open but not drawing: nothing registered, nothing claimed
        expect(toolHasHandler(draw, mapWith().listens)).toBe(false)
    })

    test('the search is bounded and skips non-plain objects and cycles', () => {
        const fn = () => {}
        // deeper than the limit
        const deep = { a: { b: { c: { d: { fn } } } } }
        expect(toolHasHandler(deep, mapWith(fn).listens)).toBe(false)
        expect(
            toolHasHandler({ a: { b: { c: { fn } } } }, mapWith(fn).listens)
        ).toBe(true)
        // class instances (DOM nodes, React roots, maps) are not walked
        class Thing {
            constructor() {
                this.fn = fn
            }
        }
        expect(
            toolHasHandler({ thing: new Thing() }, mapWith(fn).listens)
        ).toBe(false)
        // arrays are not walked
        expect(toolHasHandler({ list: [fn] }, mapWith(fn).listens)).toBe(false)
        // a cycle terminates
        const cyc = { x: {} }
        cyc.x.back = cyc
        expect(toolHasHandler(cyc, mapWith(fn).listens)).toBe(false)
        // a throwing getter is skipped
        const g = {}
        Object.defineProperty(g, 'boom', {
            enumerable: true,
            get() {
                throw new Error('no')
            },
        })
        g.fn = fn
        expect(toolHasHandler(g, mapWith(fn).listens)).toBe(true)
        expect(toolHasHandler(null, mapWith(fn).listens)).toBe(false)
        expect(toolHasHandler({ fn }, null)).toBe(false)
    })

    test("a click on a feature (leaflet-interactive) is the feature's", () => {
        const path = el(['leaflet-interactive'])
        expect(
            shouldChartMapClick(click(path), {
                activeTool: null,
                map: mapWith(),
            })
        ).toBe(false)
        // a child of an interactive marker icon too
        const icon = el(['leaflet-marker-icon', 'leaflet-interactive'])
        expect(isFeatureClickTarget(el([], icon), CONTAINER)).toBe(true)
        // tiles and the map pane are not features
        expect(
            isFeatureClickTarget(
                el(['leaflet-tile'], el(['leaflet-pane'])),
                CONTAINER
            )
        ).toBe(false)
        // the walk stops at the map container
        const outside = el(['leaflet-interactive'], null)
        const inner = el([], CONTAINER)
        CONTAINER.parentNode = outside
        expect(isFeatureClickTarget(inner, CONTAINER)).toBe(false)
        CONTAINER.parentNode = null
        expect(
            shouldChartMapClick({ originalEvent: {} }, { map: mapWith() })
        ).toBe(false)
    })

    test('globe: a picked feature or a click-owning tool keeps the click', () => {
        expect(
            shouldChartGlobeClick({ activeTool: null, map: mapWith() })
        ).toBe(true)
        expect(
            shouldChartGlobeClick({
                activeTool: null,
                map: mapWith(),
                pickedFeature: true,
            })
        ).toBe(false)
        expect(
            shouldChartGlobeClick({
                activeTool: { disableLayerInteractions: true },
                map: mapWith(),
            })
        ).toBe(false)
        const viewshed = { setSource() {} }
        expect(
            shouldChartGlobeClick({
                activeTool: viewshed,
                map: mapWith(viewshed.setSource),
            })
        ).toBe(false)
    })
})

test.describe('controller - cache and measurement', () => {
    test('a changed scale factor or units re-reads instead of reusing the cache', async () => {
        let config = { scalefactor: 1 }
        let calls = 0
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const c = createTimeSeriesController({
            getLayers: () => layers,
            getIdentifierConfig: () => config,
            fetchSeries: async () => {
                calls++
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view: fakeView(),
        })
        c.selectPoint(1, 1)
        await flush()
        c.refresh()
        await flush()
        expect(calls).toBe(1)
        config = { scalefactor: 100 }
        c.refresh()
        await flush()
        expect(calls).toBe(2)
        layers.data.ch4 = stacLayer({ cogUnits: 'ppb' })
        c.refresh()
        await flush()
        expect(calls).toBe(3)
    })

    test('a response that lands after refresh never reaches the panel or the cache', async () => {
        const view = fakeView()
        const pending = []
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: () => {
                const d = deferred()
                pending.push(d)
                return d.promise
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 1)
        await flush()
        // the time window moves while the first read is out
        layers.data.ch4 = stacLayer({
            time: {
                enabled: true,
                start: '2023-01-01T00:00:00Z',
                end: '2023-02-01T00:00:00Z',
            },
        })
        c.refresh()
        await flush()
        pending[0].resolve({ status: 'ok', series: [{ name: 'old window' }] })
        await flush()
        expect(view.results()).toHaveLength(0)
        expect(c._cacheSize()).toBe(0)
        pending[1].resolve({ status: 'ok', series: [{ name: 'new window' }] })
        await flush()
        expect(view.results().map((r) => r[2].series[0].name)).toEqual([
            'new window',
        ])
        expect(c._cacheSize()).toBe(1)
    })
})
