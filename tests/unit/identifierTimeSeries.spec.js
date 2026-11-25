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
    snapshotLayerQuery,
    createLimiter,
    runRequest,
    isNoAssetDetail,
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
    buildReadingsTable,
    describeWhen,
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
    globeClickPosition,
    normalizeLng,
    nearestWorldLng,
    mapClickPoint,
} from '../../plugins/core/tools/Identifier/IdentifierClickGuard.js'
import {
    parseIdentifierValue,
    unitForBand,
    formatStacReading,
    STAC_VALUE_FORMAT,
} from '../../plugins/core/tools/Identifier/IdentifierValueFormat.js'
import {
    getAppBaseUrl,
    transformStacUrl,
} from '../../src/essence/Basics/Layers_/LayerUtils.js'

/**
 * Identifier click-for-time-series (#1159).
 *
 * Fixtures follow the real response shapes of the pinned servers:
 *  - stac-fastapi-pgstac 6.2 GET /search: an ItemCollection whose `next`
 *    link carries `token=next:...` in its href.
 *  - titiler-pgstac 3.1 /collections/{id}/point: { coordinates, assets:
 *    [{ name: 'collection/item', values, band_names, band_descriptions }] },
 *    nodata as null, 204 No Content when no item has the point.
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
    // what a point answer with no values is: 'outside' - the items were
    // found but their pixel reads raised PointOutsideBounds (a 200 with an
    // empty assets list, as titiler-pgstac answers); 'noAssets' - TiTiler's
    // search found none of them (NoAssetFound -> 204)
    emptyAnswer = 'outside',
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
            if (assets.length === 0 && emptyAnswer === 'noAssets')
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

    test('a dev server on any port is used as-is: it proxies to the API', () => {
        // The webpack dev server forwards /stac and /titilerpgstac from its
        // own origin, so no port is hard-coded (it used to be 8888).
        const dev = { origin: 'http://localhost:9001', pathname: '/' }
        expect(resolveStacEndpoints('stac-collection:abc', dev)).toMatchObject({
            stacBase: 'http://localhost:9001/stac',
            titilerBase: 'http://localhost:9001/titilerpgstac',
        })
        // the same base the map's tiles use
        expect(
            transformStacUrl('stac-collection:abc', {}, 'tiles', dev)
        ).toMatch(/^http:\/\/localhost:9001\/titilerpgstac\/collections\/abc\//)
        expect(getAppBaseUrl(dev)).toBe('http://localhost:9001')
        expect(
            getAppBaseUrl({ origin: 'https://h', pathname: '/MMGIS/' })
        ).toBe('https://h/MMGIS')
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
            range: [Date.UTC(2024, 2, 1), Date.UTC(2024, 2, 2)],
        })
    })

    test('finding C: a range with offsets is kept as UTC instants and shown in UTC', () => {
        const ranged = (id, start, end) =>
            parseStacItemTime(
                item(id, null, { start_datetime: start, end_datetime: end })
            )
        // the example from the review: 08:00-09:00 at +02:00 is 06:00-07:00 UTC
        const r = ranged(
            'plus2',
            '2024-03-01T08:00:00+02:00',
            '2024-03-01T09:00:00+02:00'
        )
        expect(r).toEqual({
            id: 'plus2',
            time: Date.UTC(2024, 2, 1, 6),
            range: [Date.UTC(2024, 2, 1, 6), Date.UTC(2024, 2, 1, 7)],
        })
        expect(describeWhen(r)).toBe(
            '2024-03-01 06:00:00 UTC – 2024-03-01 07:00:00 UTC'
        )
        // a negative offset that crosses midnight into the next UTC day
        const west = ranged(
            'minus5',
            '2024-03-01T22:30:00-05:00',
            '2024-03-01T23:45:00-05:00'
        )
        expect(west.time).toBe(Date.UTC(2024, 2, 2, 3, 30))
        expect(describeWhen(west)).toBe(
            '2024-03-02 03:30:00 UTC – 2024-03-02 04:45:00 UTC'
        )
        // the end in another offset than the start still reads as UTC
        expect(
            describeWhen(
                ranged(
                    'mixed',
                    '2024-03-01T00:00:00Z',
                    '2024-03-01T05:30:00+05:30'
                )
            )
        ).toBe('2024-03-01 00:00:00 UTC – 2024-03-01 00:00:00 UTC')
        // Z stays as it is
        expect(
            describeWhen(
                ranged('z', '2024-03-01T10:00:00Z', '2024-03-01T11:00:00Z')
            )
        ).toBe('2024-03-01 10:00:00 UTC – 2024-03-01 11:00:00 UTC')
        // a point acquisition is a time, not an interval
        expect(
            describeWhen(
                parseStacItemTime(item('p', '2024-03-01T08:00:00+02:00'))
            )
        ).toBe('2024-03-01 06:00:00 UTC')
    })

    test('finding C: an unusable range end leaves the start as the time, with no range', () => {
        const ranged = (start, end) =>
            parseStacItemTime(
                item('x', null, { start_datetime: start, end_datetime: end })
            )
        // an invalid end: no made-up interval
        expect(ranged('2024-03-01T08:00:00+02:00', 'nope')).toEqual({
            id: 'x',
            time: Date.UTC(2024, 2, 1, 6),
            range: null,
        })
        // an end before its start is not an interval either
        expect(
            ranged('2024-03-01T08:00:00+02:00', '2024-03-01T05:00:00Z')
        ).toEqual({ id: 'x', time: Date.UTC(2024, 2, 1, 6), range: null })
        // a zero-length range is still a range (start = end)
        expect(
            ranged('2024-03-01T08:00:00+02:00', '2024-03-01T06:00:00Z').range
        ).toEqual([Date.UTC(2024, 2, 1, 6), Date.UTC(2024, 2, 1, 6)])
        // an invalid start: the item has no time and is skipped
        expect(ranged('nope', '2024-03-01T06:00:00Z')).toBeNull()
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

    test('maxStacPages: why paging stopped is reported truthfully', async () => {
        // a server that pages 1 item at a time, forever unless told a count
        const paging = (count) => {
            let n = 0
            const fetchFn = async () => {
                n++
                const body = {
                    features: [item(`x${n}`, '2024-01-01T00:00:00Z')],
                    links: [
                        {
                            rel: 'next',
                            href: `http://h/search?token=next:${n}`,
                        },
                    ],
                }
                if (count != null) body.numberMatched = count
                return jsonResponse(body)
            }
            return { fetchFn, pages: () => n }
        }
        const read = (fetchFn, extra = {}) =>
            fetchStacItems({
                fetchFn,
                stacBase: STAC_BASE,
                collection: COLLECTION,
                lng: 0,
                lat: 0,
                limits: { ...TIME_SERIES_LIMITS, maxStacPages: 3, ...extra },
            })

        // no count, next still offered on the last allowed page -> pages
        const a = paging(null)
        const ra = await read(a.fetchFn)
        expect(a.pages()).toBe(3)
        expect(ra).toMatchObject({ truncated: true, truncatedBy: 'pages' })

        // a count the 3 pages cover: the dangling next link is not a cut
        const b = paging(3)
        expect(await read(b.fetchFn)).toMatchObject({
            truncated: false,
            truncatedBy: null,
        })

        // a count beyond the 3 pages: still the page bound that stopped us
        const c = paging(10)
        expect(await read(c.fetchFn)).toMatchObject({
            truncated: true,
            truncatedBy: 'pages',
            numberMatched: 10,
        })

        // the item bound reached on the same page the page bound is: items
        const d = paging(10)
        expect(await read(d.fetchFn, { maxItems: 3 })).toMatchObject({
            truncatedBy: 'items',
        })
    })

    test('overlapping pages do not make an incomplete history look complete', async () => {
        // 2 matches; page 2 repeats page 1's item instead of giving b
        const pages = [
            {
                features: [item('a', '2024-01-01T00:00:00Z')],
                links: [{ rel: 'next', href: 'http://h/s?token=next:2' }],
                numberMatched: 2,
            },
            { features: [item('a', '2024-01-01T00:00:00Z')], numberMatched: 2 },
        ]
        let n = 0
        const r = await fetchStacItems({
            fetchFn: async () => jsonResponse(pages[n++]),
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
        })
        expect(n).toBe(2)
        expect(r.items.map((i) => i.id)).toEqual(['a'])
        expect(r).toMatchObject({ truncated: true, truncatedBy: 'count' })
        // and the same with the page bound reached on the repeat
        n = 0
        const capped = await fetchStacItems({
            fetchFn: async () =>
                jsonResponse({
                    ...pages[0],
                    links: [
                        { rel: 'next', href: `http://h/s?token=next:${++n}` },
                    ],
                }),
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            limits: { ...TIME_SERIES_LIMITS, maxStacPages: 2 },
        })
        expect(capped.items).toHaveLength(1)
        expect(capped).toMatchObject({ truncated: true, truncatedBy: 'pages' })
    })

    test('a server count above what its pages returned is reported as such', async () => {
        const { fetchFn } = fakeServers({
            items: [item('a', '2024-01-01T00:00:00Z')],
            numberMatched: 4,
        })
        const r = await fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
        })
        expect(r).toMatchObject({ truncated: true, truncatedBy: 'count' })
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
        // 2 distinct items against a count of 3: a repeat is not a second
        // match, so this may be missing one and is not passed as complete
        expect(r).toMatchObject({ truncated: true, truncatedBy: 'count' })
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
            { cogExpression: 'b1+1' },
            {
                ids: ['a', 'b/c'],
                stacOptions: { mosaicScanLimit: 500, mosaicTimeLimit: 9 },
            }
        )
        expect(url).toContain(`/collections/${COLLECTION}/point/1,2?`)
        const u = new URL(url)
        expect(u.searchParams.get('ids')).toBe('a,b/c')
        expect(u.searchParams.get('items_limit')).toBe('2')
        expect(u.searchParams.get('scan_limit')).toBe('500')
        expect(u.searchParams.get('time_limit')).toBe('9')
        expect(u.searchParams.get('expression')).toBe('b1+1')
        // a history asks by id, not by time window
        expect(u.searchParams.get('datetime')).toBeNull()
    })

    test('a configured scan_limit below the batch is raised to reach every id', () => {
        const ids = Array.from({ length: 50 }, (_, i) => `i${i}`)
        const u = new URL(
            buildPointUrl(
                TITILER_BASE,
                COLLECTION,
                0,
                0,
                {},
                {
                    ids,
                    stacOptions: { mosaicScanLimit: 10 },
                }
            )
        )
        expect(u.searchParams.get('scan_limit')).toBe('50')
        expect(u.searchParams.get('items_limit')).toBe('50')
    })

    test('the hover readout uses the same builder: mosaic limits and window', () => {
        const layer = {
            cogBandsQuery: [2],
            time: { enabled: true, start: 'A', end: 'B' },
        }
        const u = new URL(
            buildPointUrl(TITILER_BASE, COLLECTION, 3, 4, layer, {
                datetime: buildDatetimeParam(layer.time),
                stacOptions: { mosaicItemLimit: 25, mosaicTimeLimit: 7 },
            })
        )
        expect(u.searchParams.get('assets')).toBe('asset|bidx=2')
        expect(u.searchParams.get('items_limit')).toBe('25')
        expect(u.searchParams.get('time_limit')).toBe('7')
        expect(u.searchParams.get('datetime')).toBe('A/B')
        expect(u.searchParams.get('ids')).toBeNull()
        // TiTiler's default when nothing is configured; open start window
        const d = new URL(
            buildPointUrl(
                TITILER_BASE,
                COLLECTION,
                3,
                4,
                {},
                {
                    datetime: buildDatetimeParam({ start: '', end: 'B' }),
                }
            )
        )
        expect(d.searchParams.get('items_limit')).toBe('100')
        expect(d.searchParams.get('datetime')).toBe('../B')
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

    test('batches ids, bounds concurrency, and reads 204 / no-asset 404 as no pixel', async () => {
        let inFlight = 0
        let peak = 0
        const seen = []
        let empties = 0
        // i0..i49 have a reading here; i50..i119 never do - left out of every
        // answer. An answer with none of its ids is a 204 or, alternately, a
        // legacy titiler-pgstac NoAssetFound 404 that says so.
        const fetchFn = async (url) => {
            inFlight++
            peak = Math.max(peak, inFlight)
            await new Promise((r) => setTimeout(r, 5))
            inFlight--
            const ids = new URL(url).searchParams.get('ids').split(',')
            seen.push(ids.length)
            const have = ids.filter((id) => Number(id.slice(1)) < 50)
            if (have.length === 0)
                return empties++ % 2 === 0
                    ? { ok: true, status: 204 }
                    : jsonResponse(
                          { detail: 'No assets found for point (0,0)' },
                          404
                      )
            return jsonResponse({
                assets: have.map((id) => pointAsset(id, [1])),
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
            run: createLimiter(2),
        })
        // 3 batches (50, 50, 20); the 70 left out asked again in 7 batches
        // of 10; then one by one within the 20-request retry budget (13)
        const ones = (n) => Array(n).fill(1)
        expect(seen.sort((a, b) => a - b)).toEqual([
            ...ones(13),
            ...Array(7).fill(10),
            20,
            50,
            50,
        ])
        expect(peak).toBeLessThanOrEqual(2)
        // 204 and the legacy 404 are never an error
        expect(out.size).toBe(50)
        // a one-id 204/NoAssetFound is not a confirmed "no reading" (13),
        // and the budget didn't reach the other 57: all 70 unresolved
        expect(out.unresolved.size).toBe(70)
    })

    test('a generic 404 or a 200 without assets is an error, never "no data"', async () => {
        const call = (fetchFn) =>
            fetchPointValues({
                fetchFn,
                titilerBase: TITILER_BASE,
                collection: COLLECTION,
                lng: 0,
                lat: 0,
                ids: ['a'],
                layer: {},
            })
        // a missing route / wrong proxy path
        await expect(
            call(async () => jsonResponse({ detail: 'Not Found' }, 404))
        ).rejects.toThrow('HTTP 404')
        await expect(
            call(async () => ({
                ok: false,
                status: 404,
                json: async () => {
                    throw new SyntaxError('html')
                },
            }))
        ).rejects.toThrow('HTTP 404')
        // a 200 that isn't a point response
        await expect(call(async () => jsonResponse({}))).rejects.toThrow(
            'no assets list'
        )
        await expect(
            call(async () => ({
                ok: true,
                status: 200,
                json: async () => {
                    throw new SyntaxError('html')
                },
            }))
        ).rejects.toThrow('not JSON')
        expect(isNoAssetDetail({ detail: 'No assets found for point' })).toBe(
            true
        )
        expect(isNoAssetDetail({ detail: 'No items found' })).toBe(true)
        expect(isNoAssetDetail({ detail: 'Not Found' })).toBe(false)
        expect(isNoAssetDetail(null)).toBe(false)
    })

    test('items a batch left out are asked for once more, and found', async () => {
        // pgSTAC's time limit can end a search early, silently
        let calls = 0
        const fetchFn = async (url) => {
            calls++
            const ids = new URL(url).searchParams.get('ids').split(',')
            const answered = calls === 1 ? ids.slice(0, 1) : ids
            return jsonResponse({
                assets: answered.map((id) => pointAsset(id, [7])),
            })
        }
        const out = await fetchPointValues({
            fetchFn,
            titilerBase: TITILER_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ids: ['a', 'b', 'c'],
            layer: {},
        })
        expect(calls).toBe(2)
        expect([...out.keys()].sort()).toEqual(['a', 'b', 'c'])
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
                run: createLimiter(2),
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

    test('STAC readings are charted as the hover shows them: raw, in cogUnits', async () => {
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
        })
        expect(r.status).toBe('ok')
        // unscaled, so an extreme finite value stays finite and plotted
        expect(r.series[0].points.map((p) => p.value)).toEqual([
            Number.MAX_VALUE,
            3,
        ])
        expect(r.series[0].units).toBe('ppm m')
        const data = buildChartOption(r.series).series[0].data
        expect(data.every((d) => Number.isFinite(d.value[1]))).toBe(true)
    })

    test('a reading reads the same in the hover and the chart', () => {
        // the hover formats STAC values with sigfigs 2, scale 1
        for (const v of [
            1878.83841, 120.91466522216797, -11.682, 0, 3e-7, 123456.789,
        ])
            expect(formatValue(v)).toBe(
                String(
                    parseIdentifierValue(
                        v,
                        STAC_VALUE_FORMAT.sigfigs,
                        STAC_VALUE_FORMAT.scalefactor
                    )
                )
            )
        expect(formatValue(120.91466522216797)).toBe('120.91')
        expect(formatValue(null)).toBe('no data')
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

    test('measurement: the layer cogUnits, unscaled - as the hover', () => {
        expect(resolveMeasurement({ cogUnits: 'ppm' })).toEqual({
            scalefactor: 1,
            units: 'ppm',
        })
        expect(resolveMeasurement({ cogUnits: ['m', 's'] }).units).toEqual([
            'm',
            's',
        ])
        expect(resolveMeasurement({})).toEqual({ scalefactor: 1, units: '' })
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
        // nothing to list: told apart from acquisitions with no value
        expect(r.kind).toBe('no-acquisitions')
        expect(r.series).toBeUndefined()
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
        // the acquisitions are kept for the readings table (finding B)
        expect(r.kind).toBe('all-gaps')
        expect(
            r.series[0].points.map((p) => [p.itemId, p.value, p.status])
        ).toEqual([
            ['a', null, 'nodata'],
            ['b', null, 'nodata'],
        ])
    })

    test('all gaps for different reasons: each kept with its reason, and the table says so', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('masked', '2024-02-01T00:00:00Z'),
                item('absent', '2024-03-01T00:00:00Z'),
                item('bad', '2024-04-01T00:00:00Z'),
            ],
            values: { masked: [null], bad: [Infinity] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r).toMatchObject({ status: 'empty', kind: 'all-gaps' })
        expect(
            r.series[0].points.map((p) => [p.itemId, p.value, p.status])
        ).toEqual([
            ['masked', null, 'nodata'],
            ['absent', null, 'missing'],
            ['bad', null, 'invalid'],
        ])
        const t = buildReadingsTable(r.series)
        expect(t.rows).toEqual([
            ['2024-02-01 00:00:00 UTC', 'masked', 'no data'],
            ['2024-03-01 00:00:00 UTC', 'absent', 'no reading'],
            ['2024-04-01 00:00:00 UTC', 'bad', 'invalid value'],
        ])
    })

    test('mixed readings and gaps: ok, with gaps as nulls, never zeros', async () => {
        const { fetchFn } = fakeServers({
            items: [
                item('v1', '2024-02-01T00:00:00Z'),
                item('gap', '2024-03-01T00:00:00Z'),
                item('v2', '2024-04-01T00:00:00Z'),
            ],
            values: { v1: [0], gap: [null], v2: [4] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
        })
        expect(r.status).toBe('ok')
        expect(r.series[0].points.map((p) => p.value)).toEqual([0, null, 4])
        const option = buildChartOption(r.series)
        expect(option.series[0].data.map((d) => d.value[1])).toEqual([
            0,
            null,
            4,
        ])
        expect(option.series[0].connectNulls).not.toBe(true)
    })

    test('TiTiler 204 (no asset) for every item -> empty, times kept, unresolved', async () => {
        const { fetchFn } = fakeServers({
            items: [item('a', '2024-02-01T00:00:00Z')],
            values: {},
            emptyAnswer: 'noAssets',
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
        // TiTiler's search didn't find the item the STAC API matched: not
        // an error, but not a confirmed "no reading" either
        expect(r.series[0].points[0].status).toBe('unresolved')
        expect(r.incomplete).toEqual([
            '1 acquisition could not be read here (the point service left it out of its answers); its value may exist',
        ])
        expect(r.cacheable).toBe(false)
    })

    test('found but no pixel (200, empty assets) for every item -> empty, confirmed', async () => {
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
        expect(r.notes.join(' ')).toMatch(
            /1 acquisition returned no reading here \(gaps\)/
        )
        expect(r.incomplete).toEqual([])
        expect(r.cacheable).toBe(true)
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

    test('the expression reaches the query and the label; values stay unscaled', async () => {
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
        })
        expect(calls.point[0].searchParams.get('expression')).toBe('b1/2')
        expect(r.series[0].points[0].value).toBe(8)
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

    test('the cache key changes with the units the values are shown in', () => {
        const k = cacheKey('u', snapshotLayerQuery(stacLayer()), 1, 2)
        expect(
            cacheKey(
                'u',
                snapshotLayerQuery(stacLayer({ cogUnits: 'ppb' })),
                1,
                2
            )
        ).not.toBe(k)
        expect(
            cacheKey(
                'u',
                snapshotLayerQuery(stacLayer({ cogUnits: ['a', 'b'] })),
                1,
                2
            )
        ).not.toBe(
            cacheKey(
                'u',
                snapshotLayerQuery(stacLayer({ cogUnits: ['a', 'c'] })),
                1,
                2
            )
        )
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

    test('201 alternating readings and gaps keep visible symbols', () => {
        const points = Array.from({ length: 201 }, (_, i) => ({
            time: Date.UTC(2024, 0, 1 + i),
            value: i % 2 === 0 ? i + 1 : null,
            status: i % 2 === 0 ? 'ok' : 'nodata',
            itemId: `item-${i}`,
        }))
        const sparse = buildChartOption([{ name: 'b1', units: '', points }])
        expect(sparse.series[0].connectNulls).toBe(false)
        expect(sparse.series[0].showSymbol).toBe(true)
        expect(
            sparse.series[0].data.filter((d) => d.value[1] != null)
        ).toHaveLength(101)

        // Render real ECharts SVG: without symbols isolated points disappear.
        const renderSvg = (option) => {
            const chart = echarts.init(null, null, {
                renderer: 'svg',
                ssr: true,
                width: 800,
                height: 260,
            })
            try {
                chart.setOption(option)
                return chart.renderToSVGString()
            } finally {
                chart.dispose()
            }
        }
        const withSymbols = renderSvg(sparse)
        const withoutSymbols = renderSvg({
            ...sparse,
            series: sparse.series.map((line) => ({
                ...line,
                showSymbol: false,
            })),
        })
        const paintedShapes = (svg) =>
            (svg.match(/<(?:path|circle|ellipse|rect)\b/g) || []).length
        expect(paintedShapes(withSymbols)).toBeGreaterThan(
            paintedShapes(withoutSymbols)
        )

        // Dense histories may still suppress markers to avoid visual clutter.
        const dense = buildChartOption([
            {
                name: 'b1',
                units: '',
                points: points.map((p) => ({ ...p, value: 1 })),
            },
        ])
        expect(dense.series[0].showSymbol).toBe(false)
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

    test('formatting helpers', () => {
        expect(formatUtc(Date.UTC(2024, 4, 6, 7, 8, 9))).toBe(
            '2024-05-06 07:08:09 UTC'
        )
        expect(formatValue(null)).toBe('no data')
        expect(formatValue(NaN)).toBe('no data')
        expect(formatValue(0)).toBe('0')
        // two decimals, as the hover readout writes a STAC reading
        expect(formatValue(1.23456789)).toBe('1.23')
        expect(formatValue(244.6387481689453)).toBe('244.64')
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

    test('each fetch gets a frozen snapshot of the layer and the shared limiter', async () => {
        const got = []
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: {
                    ch4: stacLayer(),
                    no2: stacLayer({ url: 'stac-collection:no2' }),
                },
                on: { ch4: true, no2: true },
            }),
            fetchSeries: async (a) => {
                got.push(a)
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view: fakeView(),
        })
        c.selectPoint(1, 1)
        await flush()
        expect(got).toHaveLength(2)
        for (const a of got) {
            expect(Object.isFrozen(a.query)).toBe(true)
            expect(Object.isFrozen(a.query.time)).toBe(true)
            expect(a.layer).toBeUndefined()
        }
        // one budget for the whole selection, not one per layer
        expect(got[0].run).toBe(got[1].run)
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
    test('changed units re-read instead of reusing the cache', async () => {
        let calls = 0
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const c = createTimeSeriesController({
            getLayers: () => layers,
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
        layers.data.ch4 = stacLayer({ cogUnits: 'ppb' })
        c.refresh()
        await flush()
        expect(calls).toBe(2)
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

test.describe('globe click-point picking', () => {
    const makeCesium = () => {
        const canvas = {
            getBoundingClientRect: () => ({
                left: 100,
                top: 50,
                width: 600,
                height: 400,
            }),
        }
        const ellipsoid = {
            cartesianToCartographic: () => ({
                longitude: (-122.44 * Math.PI) / 180,
                latitude: (38.5 * Math.PI) / 180,
            }),
        }
        const picks = []
        const litho = {
            rendererType: 'cesium',
            // Deliberately poisoned hover coordinate; it must not be read.
            mouse: { lng: 0, lat: 0, onSurface: false },
            renderer: {
                scene: { canvas, globe: { ellipsoid } },
                camera: {
                    pickEllipsoid: (point, shape) => {
                        picks.push({ point, shape })
                        return { x: 1, y: 2, z: 3 }
                    },
                },
            },
        }
        return { canvas, ellipsoid, litho, picks }
    }

    test('stationary touch resolves fresh Cesium coordinates, ignoring stale hover', () => {
        const { canvas, ellipsoid, litho, picks } = makeCesium()
        const r = globeClickPosition(
            {
                target: canvas,
                clientX: 400,
                clientY: 250,
                pointerType: 'touch',
            },
            litho
        )
        expect(r.lng).toBeCloseTo(-122.44, 5)
        expect(r.lat).toBeCloseTo(38.5, 5)
        expect(picks).toEqual([{ point: { x: 300, y: 200 }, shape: ellipsoid }])
    })

    test('a control in the Cesium viewer cannot select a chart point', () => {
        const { litho, picks } = makeCesium()
        expect(
            globeClickPosition(
                {
                    target: { id: '_cesium_control_link' },
                    clientX: 400,
                    clientY: 250,
                },
                litho
            )
        ).toBeNull()
        expect(picks).toHaveLength(0)
    })

    test('sky, missing canvas and out-of-bounds pointers never select', () => {
        const { canvas, litho } = makeCesium()
        const evt = { target: canvas, clientX: 400, clientY: 250 }
        litho.renderer.camera.pickEllipsoid = () => null
        expect(globeClickPosition(evt, litho)).toBeNull()
        expect(globeClickPosition({ ...evt, clientX: 99 }, litho)).toBeNull()
        litho.renderer.scene.canvas = null
        expect(globeClickPosition(evt, litho)).toBeNull()
    })

    test('LithoSphere keeps its previous hover behavior', () => {
        const litho = {
            rendererType: 'lithosphere',
            mouse: { lng: 12, lat: 23 },
        }
        expect(globeClickPosition({}, litho)).toEqual({ lng: 12, lat: 23 })
        litho.mouse.onSurface = false
        expect(globeClickPosition({}, litho)).toBeNull()
    })
})

// -------------------------------------------------------------------------
// PR #1171 review findings. Each test drives the real fetchLayerTimeSeries
// through the controller against controllable stand-in STAC/TiTiler servers.

const settle = async (n = 4) => {
    for (let i = 0; i < n; i++) await flush()
}

/** STAC + TiTiler stand-ins whose answers the test controls. */
function controllableServers({ holdStac = false, honourAbort = true } = {}) {
    const s = {
        held: [],
        stacCalls: 0,
        pointUrls: [],
        inFlight: 0,
        peak: 0,
        // what the point endpoint answers: (url) => response
        point: (u) => {
            const expr = u.searchParams.get('expression')
            const ids = u.searchParams.get('ids').split(',')
            const v = expr === 'b2' ? 2 : 1
            return jsonResponse({
                assets: ids.map((id) => pointAsset(id, [v], [expr || 'b1'])),
            })
        },
        features: [item('a', '2024-02-01T00:00:00Z')],
    }
    s.fetchFn = async (url, init) => {
        const u = new URL(url)
        s.inFlight++
        s.peak = Math.max(s.peak, s.inFlight)
        try {
            if (u.pathname.endsWith('/stac/search')) {
                s.stacCalls++
                const answer = () =>
                    jsonResponse({
                        type: 'FeatureCollection',
                        features: s.features,
                        links: [],
                        numberMatched: s.features.length,
                    })
                if (!holdStac) {
                    await flush()
                    return answer()
                }
                return await new Promise((resolve, reject) => {
                    s.held.push({ release: () => resolve(answer()) })
                    if (honourAbort)
                        init?.signal?.addEventListener('abort', () =>
                            reject(
                                Object.assign(new Error('aborted'), {
                                    name: 'AbortError',
                                })
                            )
                        )
                })
            }
            s.pointUrls.push(u)
            await flush()
            return s.point(u)
        } finally {
            s.inFlight--
        }
    }
    return s
}

function realController(servers, layers, extra = {}) {
    const view = fakeView()
    const marker = {
        calls: [],
        place: (lng, lat, mapLng) => marker.calls.push([lng, lat, mapLng]),
        remove: () => marker.calls.push(['remove']),
    }
    const c = createTimeSeriesController({
        getLayers: () => layers,
        fetchSeries: (a) =>
            fetchLayerTimeSeries({
                ...a,
                fetchFn: servers.fetchFn,
                location: LOCATION,
            }),
        marker,
        view,
        ...extra,
    })
    return { c, view, marker }
}

test.describe('review 1 - query snapshots, cache and stale results', () => {
    for (const honourAbort of [true, false]) {
        test(`b1 -> b2 -> b1 while STAC is slow (fetch ${
            honourAbort ? 'aborts' : 'ignores aborts'
        }): only the newest is drawn or cached`, async () => {
            const servers = controllableServers({ holdStac: true, honourAbort })
            const layer = stacLayer({ currentCogExpression: 'b1' })
            const layers = { data: { ch4: layer }, on: { ch4: true } }
            const { c, view } = realController(servers, layers)

            c.selectPoint(1, 2)
            await settle()
            layer.currentCogExpression = 'b2'
            c.queryChanged()
            await settle()
            layer.currentCogExpression = 'b1'
            c.queryChanged()
            await settle()
            expect(servers.held).toHaveLength(3)

            // answers arrive newest first, then the two stale ones
            servers.held[2].release()
            await settle(8)
            servers.held[0].release()
            servers.held[1].release()
            await settle(8)

            const results = view.results()
            expect(results).toHaveLength(1)
            const r = results[0][2]
            expect(r.status).toBe('ok')
            expect(r.expression).toBe('b1')
            expect(r.query.currentCogExpression).toBe('b1')
            expect(r.series[0].points[0].value).toBe(1)
            // only the current settings were stored
            expect(c._cacheSize()).toBe(1)
            // the stale loads stopped at their STAC answer: even when fetch
            // ignores the abort, no point request is made for them
            const exprs = servers.pointUrls.map((u) =>
                u.searchParams.get('expression')
            )
            expect(exprs).toEqual(['b1'])

            // b2 again: not served from a stale b2 result - read afresh
            const before = servers.stacCalls
            layer.currentCogExpression = 'b2'
            c.queryChanged()
            await settle()
            servers.held.at(-1).release()
            await settle(8)
            expect(servers.stacCalls).toBe(before + 1)
            expect(view.results().at(-1)[2].series[0].points[0].value).toBe(2)
            expect(view.results().at(-1)[2].expression).toBe('b2')
        })
    }

    test('a layer edited mid-read: that read keeps its own inputs end to end', async () => {
        const servers = controllableServers({ holdStac: true })
        const layer = stacLayer({ currentCogExpression: 'b1' })
        const { c, view } = realController(servers, {
            data: { ch4: layer },
            on: { ch4: true },
        })
        c.selectPoint(1, 2)
        await settle()
        // changed without a re-chart (no queryChanged): the read under way
        // must not mix the new expression into its point request or label
        layer.currentCogExpression = 'b2'
        servers.held[0].release()
        await settle(10)
        expect(
            servers.pointUrls.map((u) => u.searchParams.get('expression'))
        ).toEqual(['b1'])
        const r = view.results()[0][2]
        expect([r.expression, r.series[0].points[0].value]).toEqual(['b1', 1])
        // stored under b1, so a b2 chart is read afresh, not taken from it
        expect(c._cacheSize()).toBe(1)
        c.refresh()
        await settle()
        expect(servers.held).toHaveLength(2)
    })

    test('the snapshot is frozen: later layer edits change nothing in it', () => {
        const layer = stacLayer({
            currentCogExpression: 'b1',
            cogBandsQuery: [1],
        })
        const q = snapshotLayerQuery(layer)
        layer.currentCogExpression = 'b2'
        layer.cogBandsQuery.push(3)
        layer.time.end = '2030-01-01T00:00:00Z'
        expect(q.currentCogExpression).toBe('b1')
        expect(q.cogBandsQuery).toEqual([1])
        expect(q.time.end).toBe('2024-06-30T23:59:59Z')
        expect(Object.isFrozen(q) && Object.isFrozen(q.time)).toBe(true)
        expect(cacheKey('u', q, 1, 2)).toBe(
            cacheKey(
                'u',
                snapshotLayerQuery(
                    stacLayer({
                        currentCogExpression: 'b1',
                        cogBandsQuery: [1],
                    })
                ),
                1,
                2
            )
        )
    })
})

test.describe('review 3 - acquisitions sharing a timestamp', () => {
    const T = Date.UTC(2024, 1, 1, 10)
    const itemsAt = [
        { id: 'scene-a', time: T, range: null },
        { id: 'scene-b', time: T, range: null },
        { id: 'scene-c', time: T + 86400000, range: null },
    ]
    // ECharts' axis tooltip passes every series' point at that x - one per
    // acquisition sharing it (checked against ECharts 6.1 in a browser).
    const paramsAt = (option, dataIndexes) =>
        option.series.flatMap((s, seriesIndex) =>
            dataIndexes.map((dataIndex) => ({
                seriesIndex,
                seriesName: s.name,
                dataIndex,
                data: s.data[dataIndex],
                marker: '',
            }))
        )
    const groups = (html) =>
        [
            ...html.matchAll(
                /data-item="([^"]+)">(.*?)<\/div>(?=<div class="identifierTimeSeriesTooltip_item"|$)/gs
            ),
        ].map((m) => [m[1], m[2]])

    test('each reading is shown under its own acquisition id', () => {
        const r = buildSeries(
            itemsAt,
            new Map([
                ['scene-a', { values: [5], bandNames: ['b1'] }],
                ['scene-b', { values: [9], bandNames: ['b1'] }],
                ['scene-c', { values: [7], bandNames: ['b1'] }],
            ]),
            { units: 'ppm' }
        )
        const option = buildChartOption(r.series)
        const html = option.tooltip.formatter(paramsAt(option, [0, 1]))
        const g = groups(html)
        expect(g.map((x) => x[0])).toEqual(['scene-a', 'scene-b'])
        expect(g[0][1]).toContain('scene-a')
        expect(g[0][1]).toContain('<b>5ppm</b>')
        expect(g[0][1]).not.toContain('9')
        expect(g[1][1]).toContain('<b>9ppm</b>')
        expect(html.match(/2024-02-01 10:00:00 UTC/g)).toHaveLength(1)
    })

    test('several bands, a gap and a range stay with their own item', () => {
        const r = buildSeries(
            [
                { id: 'x1', time: T, range: null },
                {
                    id: 'x2',
                    time: T,
                    range: [Date.UTC(2024, 1, 1, 10), Date.UTC(2024, 1, 1, 11)],
                },
            ],
            new Map([
                ['x1', { values: [1, null], bandNames: ['red', 'nir'] }],
                ['x2', { values: [3], bandNames: ['red'] }],
            ]),
            { units: [' K', ' %'] }
        )
        const option = buildChartOption(r.series)
        const g = groups(option.tooltip.formatter(paramsAt(option, [0, 1])))
        expect(g.map((x) => x[0])).toEqual(['x1', 'x2'])
        expect(g[0][1]).toContain('red: <b>1 K</b>')
        expect(g[0][1]).toContain('nir: <b>no data</b>')
        expect(g[1][1]).toContain('red: <b>3 K</b>')
        expect(g[1][1]).toContain('nir: <b>no reading</b>')
        expect(g[1][1]).toContain(
            '2024-02-01 10:00:00 UTC – 2024-02-01 11:00:00 UTC'
        )
        expect(g[0][1]).not.toContain('–')
    })

    test('finding C: the tooltip, the table and the axis agree on a range in UTC', () => {
        const items = [
            parseStacItemTime(
                item('r2', null, {
                    start_datetime: '2024-03-01T08:00:00+02:00',
                    end_datetime: '2024-03-01T09:00:00+02:00',
                })
            ),
            // same start instant, other item: kept, ordered by id
            parseStacItemTime(
                item('r1', null, {
                    start_datetime: '2024-03-01T06:00:00Z',
                    end_datetime: '2024-03-01T06:30:00Z',
                })
            ),
        ]
        const r = buildSeries(
            items,
            new Map([
                ['r1', { values: [1], bandNames: ['b1'] }],
                ['r2', { values: [2], bandNames: ['b1'] }],
            ]),
            { units: '' }
        )
        const pts = r.series[0].points
        expect(pts.map((p) => [p.itemId, p.time])).toEqual([
            ['r1', Date.UTC(2024, 2, 1, 6)],
            ['r2', Date.UTC(2024, 2, 1, 6)],
        ])
        expect(buildReadingsTable(r.series).rows).toEqual([
            ['2024-03-01 06:00:00 UTC – 2024-03-01 06:30:00 UTC', 'r1', '1'],
            ['2024-03-01 06:00:00 UTC – 2024-03-01 07:00:00 UTC', 'r2', '2'],
        ])
        const option = buildChartOption(r.series)
        expect(option.series[0].data.map((d) => d.value[0])).toEqual([
            Date.UTC(2024, 2, 1, 6),
            Date.UTC(2024, 2, 1, 6),
        ])
        const html = option.tooltip.formatter(paramsAt(option, [0, 1]))
        expect(html).toContain(
            '2024-03-01 06:00:00 UTC – 2024-03-01 07:00:00 UTC'
        )
        expect(html).toContain(
            '2024-03-01 06:00:00 UTC – 2024-03-01 06:30:00 UTC'
        )
        expect(html).not.toContain('+02:00')
        expect(html).not.toContain('08:00')
    })

    test('the readings table gives every shared-time acquisition its own row', () => {
        const r = buildSeries(
            itemsAt,
            new Map([
                ['scene-a', { values: [5], bandNames: ['b1'] }],
                ['scene-b', { values: [9], bandNames: ['b1'] }],
            ]),
            { units: 'ppm' }
        )
        const t = buildReadingsTable(r.series)
        expect(t.columns).toEqual([
            'Acquired (UTC)',
            'Acquisition ID',
            'b1 (ppm)',
        ])
        expect(t.rows).toEqual([
            ['2024-02-01 10:00:00 UTC', 'scene-a', '5'],
            ['2024-02-01 10:00:00 UTC', 'scene-b', '9'],
            ['2024-02-02 10:00:00 UTC', 'scene-c', 'no reading'],
        ])
    })
})

test.describe('review 4 - wrapped longitudes', () => {
    test('a click in another world copy queries the real longitude, marks the clicked one', () => {
        expect(mapClickPoint({ lat: 10, lng: 190 })).toEqual({
            lng: -170,
            lat: 10,
            mapLng: 190,
        })
        expect(mapClickPoint({ lat: 10, lng: -190 })).toEqual({
            lng: 170,
            lat: 10,
            mapLng: -190,
        })
        expect(mapClickPoint({ lat: 10, lng: 45 })).toEqual({
            lng: 45,
            lat: 10,
            mapLng: 45,
        })
        expect(mapClickPoint({ lat: 10, lng: 550 })).toEqual({
            lng: -170,
            lat: 10,
            mapLng: 550,
        })
        expect(mapClickPoint({ lat: NaN, lng: 1 })).toBeNull()
        expect(normalizeLng(180)).toBe(180)
        expect(normalizeLng(-180)).toBe(-180)
        expect(normalizeLng(-170)).toBe(-170)
        // a globe pick placed on the map copy in view
        expect(nearestWorldLng(-170, 200)).toBe(190)
        expect(nearestWorldLng(-170, 0)).toBe(-170)
        expect(nearestWorldLng(-170, 100)).toBe(190)
        expect(nearestWorldLng(170, -350)).toBe(-190)
    })

    test('190 and -170 are one point: same queries, one cache entry, marker where clicked', async () => {
        const servers = controllableServers()
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const { c, marker } = realController(servers, layers)
        const p = mapClickPoint({ lat: 10, lng: 190 })
        c.selectPoint(p.lng, p.lat, { mapLng: p.mapLng })
        await settle(10)
        expect(marker.calls[0]).toEqual([-170, 10, 190])
        const stacAt = servers.stacCalls
        const pointPath = servers.pointUrls[0].pathname
        expect(pointPath).toContain('/point/-170,10')
        // the same place clicked in the main world copy: served from cache
        const q = mapClickPoint({ lat: 10, lng: -170 })
        c.selectPoint(q.lng, q.lat, { mapLng: q.mapLng })
        await settle(10)
        expect(marker.calls.at(-1)).toEqual([-170, 10, -170])
        expect(servers.stacCalls).toBe(stacAt)
        expect(c._cacheSize()).toBe(1)
    })
})

test.describe('review 5 - failures stay retryable', () => {
    const failing = [
        ['a generic 404', () => jsonResponse({ detail: 'Not Found' }, 404)],
        [
            'a 404 with no body',
            () => ({
                ok: false,
                status: 404,
                json: async () => {
                    throw new SyntaxError('x')
                },
            }),
        ],
        ['a 503', () => jsonResponse({}, 503)],
        ['a 200 without assets', () => jsonResponse({ type: 'Point' })],
        [
            'a 200 that is not JSON',
            () => ({
                ok: true,
                status: 200,
                json: async () => {
                    throw new SyntaxError('x')
                },
            }),
        ],
    ]
    for (const [what, answer] of failing) {
        test(`${what} is an error, not cached, and the next click after recovery charts`, async () => {
            const servers = controllableServers()
            const healthy = servers.point
            servers.point = answer
            const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
            const { c, view } = realController(servers, layers)
            c.selectPoint(1, 2)
            await settle(10)
            expect(view.results().at(-1)[2].status).toBe('error')
            expect(c._cacheSize()).toBe(0)

            servers.point = healthy // the service recovers
            c.selectPoint(1, 2)
            await settle(10)
            const r = view.results().at(-1)[2]
            expect(r.status).toBe('ok')
            expect(r.series[0].points[0]).toMatchObject({
                value: 1,
                status: 'ok',
            })
            expect(c._cacheSize()).toBe(1)
        })
    }

    test('an explicit no-asset answer (204, or a legacy NoAssetFound 404) is no error, and not a confirmed gap', async () => {
        for (const answer of [
            () => ({
                ok: true,
                status: 204,
                json: async () => {
                    throw new SyntaxError('empty')
                },
            }),
            () =>
                jsonResponse(
                    { detail: 'No assets found for point (1,2)' },
                    404
                ),
        ]) {
            const servers = controllableServers()
            servers.point = answer
            const { c, view } = realController(servers, {
                data: { ch4: stacLayer() },
                on: { ch4: true },
            })
            c.selectPoint(1, 2)
            await settle(10)
            const r = view.results().at(-1)[2]
            expect(r.status).toBe('empty')
            // TiTiler's search didn't find the one item the STAC API
            // matched: shown as "not read", disclosed, retried next click
            expect(r.series[0].points[0].status).toBe('unresolved')
            expect(r.incomplete).toHaveLength(1)
            expect(r.cacheable).toBe(false)
            expect(c._cacheSize()).toBe(0)
            expect(servers.pointUrls).toHaveLength(1)
        }
    })
})

test.describe('review 6 - re-chart when query inputs change', () => {
    test('several changes in one task re-chart once; nothing while closed', async () => {
        let loads = 0
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: async () => {
                loads++
                return { status: 'ok', series: [] }
            },
            marker: fakeMarker(),
            view: fakeView(),
        })
        c.queryChanged()
        await settle()
        expect(loads).toBe(0)
        c.selectPoint(1, 2)
        await settle()
        expect(loads).toBe(1)
        layers.data.ch4 = stacLayer({ currentCogExpression: 'b2' })
        c.queryChanged()
        c.queryChanged()
        c.queryChanged()
        await settle()
        expect(loads).toBe(2)
        c.close()
        c.queryChanged()
        await settle()
        expect(loads).toBe(2)
    })

    test('a time window set while a read is out cancels it and charts the new window', async () => {
        const servers = controllableServers({ holdStac: true })
        const layer = stacLayer()
        const { c, view } = realController(servers, {
            data: { ch4: layer },
            on: { ch4: true },
        })
        c.selectPoint(1, 2)
        await settle()
        layer.time = {
            enabled: true,
            start: '2023-01-01T00:00:00Z',
            end: '2023-06-01T00:00:00Z',
        }
        c.queryChanged()
        await settle()
        expect(servers.held).toHaveLength(2)
        servers.held[1].release()
        servers.held[0].release()
        await settle(10)
        expect(view.results()).toHaveLength(1)
        expect(view.results()[0][2].query.time.end).toBe('2023-06-01T00:00:00Z')
    })
})

test.describe('review 8 - one request budget and incomplete histories', () => {
    test('requests for one point share one concurrency limit across all layers', async () => {
        const servers = controllableServers()
        servers.features = Array.from({ length: 120 }, (_, i) =>
            item(`i${i}`, new Date(Date.UTC(2024, 0, 1 + i)).toISOString())
        )
        const layers = {
            data: {
                a: stacLayer({ url: 'stac-collection:a' }),
                b: stacLayer({ url: 'stac-collection:b' }),
                c: stacLayer({ url: 'stac-collection:c' }),
            },
            on: { a: true, b: true, c: true },
        }
        const { c, view } = realController(servers, layers, {
            requestConcurrency: 2,
        })
        c.selectPoint(1, 2)
        for (let i = 0; i < 40 && view.results().length < 3; i++) await settle()
        expect(view.results()).toHaveLength(3)
        // 3 STAC searches + 3 x 3 point batches, never more than 2 at once
        expect(servers.pointUrls.length).toBe(9)
        expect(servers.peak).toBeLessThanOrEqual(2)
        expect(servers.peak).toBe(2)
    })

    test('createLimiter queues past the limit and keeps going after a failure', async () => {
        const run = createLimiter(1)
        const order = []
        const a = run(async () => {
            order.push('a')
            throw new Error('x')
        })
        const b = run(async () => order.push('b'))
        await expect(a).rejects.toThrow('x')
        await b
        await flush()
        expect(order).toEqual(['a', 'b'])
        expect(run.active()).toBe(0)
        expect(run.queued()).toBe(0)
    })

    const stacPages = (pages) => {
        let n = 0
        return async () => {
            const p = pages[Math.min(n++, pages.length - 1)]
            return jsonResponse(p)
        }
    }
    const page = (ids, links = [], extra = {}) => ({
        features: ids.map((id) => item(id, '2024-01-01T00:00:00Z')),
        links,
        ...extra,
    })
    const listing = (fetchFn, limits) =>
        fetchStacItems({
            fetchFn,
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ...(limits ? { limits } : {}),
        })

    test('a next link that cannot be followed is reported, not taken as the end', async () => {
        const r = await listing(
            stacPages([
                page(
                    ['a'],
                    [{ rel: 'next', method: 'POST', href: 'http://h/search' }]
                ),
            ])
        )
        expect(r.items).toHaveLength(1)
        expect(r.incomplete).toEqual([
            'the STAC API offered a next page in a form that could not be followed',
        ])
    })

    test('a full page with no next link and no count is reported', async () => {
        const limits = { ...TIME_SERIES_LIMITS, stacPageSize: 2 }
        const r = await listing(stacPages([page(['a', 'b'])]), limits)
        expect(r.incomplete).toEqual([
            'the STAC API returned a full page without a next link',
        ])
        // with a count saying that was everything: complete
        const done = await listing(
            stacPages([page(['a', 'b'], [], { numberMatched: 2 })]),
            limits
        )
        expect(done.incomplete).toEqual([])
        // a short page is the end
        const short = await listing(stacPages([page(['a'])]), limits)
        expect(short.incomplete).toEqual([])
    })

    test('a repeated page token is reported', async () => {
        const r = await listing(
            stacPages([
                page(
                    ['a'],
                    [{ rel: 'next', href: 'http://h/search?token=next:same' }]
                ),
            ])
        )
        expect(r.incomplete).toEqual(['the STAC API repeated a page token'])
    })

    test('an incomplete history still charts, flagged as incomplete', async () => {
        const servers = controllableServers()
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        servers.fetchFn = ((orig) => async (url, init) => {
            const res = await orig(url, init)
            if (new URL(url).pathname.endsWith('/stac/search')) {
                const body = await res.json()
                body.links = [
                    { rel: 'next', method: 'POST', href: 'http://h/search' },
                ]
                delete body.numberMatched
                return jsonResponse(body)
            }
            return res
        })(servers.fetchFn)
        const { c, view } = realController(servers, layers)
        c.selectPoint(1, 2)
        await settle(10)
        const r = view.results().at(-1)[2]
        expect(r.status).toBe('ok')
        expect(r.incomplete).toHaveLength(1)
        // the truncation of our own bound is reported the same way
        const cut = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn: fakeServers({
                items: Array.from({ length: 5 }, (_, i) =>
                    item(`i${i}`, `2024-01-0${i + 1}T00:00:00Z`)
                ),
                values: Object.fromEntries(
                    Array.from({ length: 5 }, (_, i) => [`i${i}`, [i]])
                ),
            }).fetchFn,
            location: LOCATION,
            limits: { ...TIME_SERIES_LIMITS, maxItems: 3, stacPageSize: 3 },
        })
        expect(cut.incomplete).toEqual([
            'showing 3 of 5 matching items (limit 3)',
        ])
        // the page bound is named as the page bound, not the item limit
        let n = 0
        const pagesOnly = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn: async (url, init) => {
                if (new URL(url).pathname.endsWith('/stac/search')) {
                    n++
                    return jsonResponse({
                        features: [item(`p${n}`, `2024-01-0${n}T00:00:00Z`)],
                        links: [
                            { rel: 'next', href: `http://h/s?token=next:${n}` },
                        ],
                    })
                }
                return fakeServers({
                    items: [1, 2].map((i) =>
                        item(`p${i}`, `2024-01-0${i}T00:00:00Z`)
                    ),
                    values: { p1: [1], p2: [2] },
                }).fetchFn(url, init)
            },
            location: LOCATION,
            limits: { ...TIME_SERIES_LIMITS, maxStacPages: 2 },
        })
        expect(pagesOnly.status).toBe('ok')
        expect(pagesOnly.incomplete).toEqual([
            'showing 2 matching items: stopped after 2 STAC pages with more on offer',
        ])
    })

    test('local collections use the page origin and path - no hard-coded port', () => {
        const e = resolveStacEndpoints('stac-collection:c', {
            origin: 'http://localhost:8889',
            pathname: '/mmgis/',
        })
        expect(e.titilerBase).toBe('http://localhost:8889/mmgis/titilerpgstac')
        expect(e.stacBase).toBe('http://localhost:8889/mmgis/stac')
        expect(getAppBaseUrl({ origin: 'https://h', pathname: '/' })).toBe(
            'https://h'
        )
    })
})

test.describe('review 8 - request time limit', () => {
    // a server that never answers, but honours an abort like fetch does
    const hanging = () => {
        const calls = []
        const fetchFn = (url, init) =>
            new Promise((_, reject) => {
                calls.push(url)
                const abortErr = () =>
                    reject(
                        Object.assign(new Error('aborted'), {
                            name: 'AbortError',
                        })
                    )
                if (init?.signal?.aborted) return abortErr()
                init?.signal?.addEventListener('abort', abortErr)
            })
        return { fetchFn, calls }
    }

    test('a hung request becomes a reported, retryable error - not a silent cancel', async () => {
        const { fetchFn } = hanging()
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            fetchFn,
            location: LOCATION,
            limits: { ...TIME_SERIES_LIMITS, requestTimeoutMs: 30 },
        })
        expect(r.status).toBe('error')
        expect(r.message).toMatch(/STAC API \(request timed out after 0 s\)/)

        // through the controller: shown, not cached, and the next click charts
        const servers = controllableServers()
        let hang = true
        const layers = { data: { ch4: stacLayer() }, on: { ch4: true } }
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: (url, init) =>
                        hang
                            ? hanging().fetchFn(url, init)
                            : servers.fetchFn(url, init),
                    location: LOCATION,
                    limits: { ...TIME_SERIES_LIMITS, requestTimeoutMs: 30 },
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await new Promise((r) => setTimeout(r, 80))
        expect(view.results().at(-1)[2].status).toBe('error')
        expect(c._cacheSize()).toBe(0)
        hang = false
        c.selectPoint(1, 2)
        await settle(10)
        expect(view.results().at(-1)[2].status).toBe('ok')
    })

    test('a cancellation stays a cancellation; no limit means none is set', async () => {
        const { fetchFn } = hanging()
        const ctrl = new AbortController()
        const read = (res) => res
        const p = runRequest({
            fetchFn,
            url: 'http://x/',
            signal: ctrl.signal,
            timeoutMs: 10000,
            read,
        })
        ctrl.abort()
        await expect(p).rejects.toMatchObject({ name: 'AbortError' })
        // already-aborted signal: aborted at once
        const pre = new AbortController()
        pre.abort()
        await expect(
            runRequest({
                fetchFn,
                url: 'http://x/',
                signal: pre.signal,
                timeoutMs: 10000,
                read,
            })
        ).rejects.toMatchObject({ name: 'AbortError' })
        // a fast answer passes through untouched
        expect(
            await runRequest({
                fetchFn: async () => 'res',
                url: 'http://x/',
                timeoutMs: 10000,
                read,
            })
        ).toBe('res')
        // no limit configured: no timer, the request is only ended by its answer
        let release
        const slow = runRequest({
            fetchFn: () => new Promise((r) => (release = r)),
            url: 'http://x/',
            timeoutMs: 0,
            read,
        })
        await new Promise((r) => setTimeout(r, 20))
        release('late')
        expect(await slow).toBe('late')
    })
})

test.describe('finding A - the time limit and cancellation cover the body', () => {
    // Headers arrive at once; the body is read through `body(kind, url, init)`,
    // which may delay, stall forever, or honour the abort as fetch does.
    const bodyServers = (body) => {
        const items = ['a', 'b', 'c'].map((id, i) =>
            item(id, `2024-01-0${i + 1}T00:00:00Z`)
        )
        const base = fakeServers({
            items,
            values: { a: [1], b: [2], c: [3] },
        })
        const stats = { stac: 0, point: 0 }
        const fetchFn = async (url, init) => {
            const res = await base.fetchFn(url, init)
            const kind = new URL(url).pathname.endsWith('/stac/search')
                ? 'stac'
                : 'point'
            stats[kind]++
            const real = res.json
            return {
                ...res,
                json: () => body(kind, real, init, stats[kind]),
            }
        }
        return { fetchFn, stats }
    }
    const never = () => new Promise(() => {})
    const abortable = (init) =>
        new Promise((_, reject) => {
            const fail = () =>
                reject(
                    Object.assign(new Error('The operation was aborted.'), {
                        name: 'AbortError',
                    })
                )
            if (init?.signal?.aborted) return fail()
            init?.signal?.addEventListener('abort', fail)
        })
    // fail fast instead of hanging the suite when a body is never bounded
    const within = (p, ms = 2000) =>
        Promise.race([
            p,
            new Promise((_, r) =>
                setTimeout(
                    () => r(new Error(`still pending after ${ms} ms`)),
                    ms
                )
            ),
        ])
    const fast = { ...TIME_SERIES_LIMITS, requestTimeoutMs: 40 }

    for (const [label, stall] of [
        ['a STAC body that never arrives (and ignores the abort)', 'stac'],
        ['a point body that never arrives (and ignores the abort)', 'point'],
    ])
        test(`${label} times out as an error`, async () => {
            const srv = bodyServers((kind, real, init) =>
                kind === stall ? never() : real()
            )
            const r = await within(
                fetchLayerTimeSeries({
                    layer: stacLayer(),
                    lng: 0,
                    lat: 0,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                    limits: fast,
                })
            )
            expect(r.status).toBe('error')
            expect(r.message).toMatch(/request timed out after/)
            expect(r.message).not.toMatch(/not JSON/)
        })

    test('a slow body inside the time limit is read, not cut off', async () => {
        const srv = bodyServers(async (kind, real) => {
            await new Promise((r) => setTimeout(r, 15))
            return real()
        })
        const r = await within(
            fetchLayerTimeSeries({
                layer: stacLayer(),
                lng: 0,
                lat: 0,
                fetchFn: srv.fetchFn,
                location: LOCATION,
                limits: { ...TIME_SERIES_LIMITS, requestTimeoutMs: 200 },
            })
        )
        expect(r.status).toBe('ok')
        expect(r.series[0].points.map((p) => p.value)).toEqual([1, 2, 3])
    })

    test('the time limit runs from the request, not from the headers', async () => {
        // headers would arrive in time; header + body together do not
        const srv = bodyServers(async (kind, real) => {
            await new Promise((r) => setTimeout(r, 120))
            return real()
        })
        const r = await within(
            fetchLayerTimeSeries({
                layer: stacLayer(),
                lng: 0,
                lat: 0,
                fetchFn: srv.fetchFn,
                location: LOCATION,
                limits: { ...TIME_SERIES_LIMITS, requestTimeoutMs: 50 },
            })
        )
        expect(r.status).toBe('error')
        expect(r.message).toMatch(/timed out/)
    })

    for (const honour of [true, false])
        test(`closing the panel mid-body cancels quietly, leaves no read pending, and reopening charts (body ${
            honour ? 'honours' : 'ignores'
        } the abort)`, async () => {
            let stallFirst = true
            const srv = bodyServers((kind, real, init) => {
                if (kind === 'point' && stallFirst)
                    return honour ? abortable(init) : never()
                return real()
            })
            const view = fakeView()
            const reads = []
            const c = createTimeSeriesController({
                getLayers: () => ({
                    data: { ch4: stacLayer() },
                    on: { ch4: true },
                }),
                fetchSeries: (a) => {
                    const p = fetchLayerTimeSeries({
                        ...a,
                        fetchFn: srv.fetchFn,
                        location: LOCATION,
                    })
                    reads.push(p)
                    return p
                },
                marker: fakeMarker(),
                view,
                requestConcurrency: 1,
            })
            c.selectPoint(1, 2)
            await settle(10)
            expect(srv.stats.point).toBe(1)
            c.close()
            // the cancelled read ends, as a cancellation - not left hanging
            await expect(within(reads[0], 500)).rejects.toMatchObject({
                name: 'AbortError',
            })
            await settle(10)
            // nothing drawn for the cancelled read: no error, no not-JSON
            expect(view.results()).toEqual([])
            expect(c._cacheSize()).toBe(0)
            // reopen: a new read completes
            stallFirst = false
            c.selectPoint(1, 2)
            const r = await within(
                (async () => {
                    while (!view.results().length) await settle(2)
                    return view.results().at(-1)[2]
                })()
            )
            expect(r.status).toBe('ok')
            expect(c._cacheSize()).toBe(1)
        })

    test('moving the point mid-body: the stalled read is dropped, the new one charts', async () => {
        let n = 0
        const srv = bodyServers((kind, real) => {
            if (kind === 'point' && ++n === 1) return never()
            return real()
        })
        const view = fakeView()
        const reads = []
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) => {
                const p = fetchLayerTimeSeries({
                    ...a,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                })
                reads.push(p)
                return p
            },
            marker: fakeMarker(),
            view,
            requestConcurrency: 1,
        })
        c.selectPoint(1, 2)
        await settle(10)
        c.selectPoint(3, 4)
        await expect(within(reads[0], 500)).rejects.toMatchObject({
            name: 'AbortError',
        })
        const r = await within(
            (async () => {
                while (!view.results().length) await settle(2)
                return view.results()
            })()
        )
        expect(r).toHaveLength(1)
        expect(r[0][2].status).toBe('ok')
        expect(c.getPoint()).toEqual({ lng: 3, lat: 4 })
    })

    test('timeout then recovery: the error is not cached and the next click reads again', async () => {
        let stall = true
        const srv = bodyServers((kind, real) =>
            kind === 'point' && stall ? never() : real()
        )
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                    limits: fast,
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await within(
            (async () => {
                while (!view.results().length)
                    await new Promise((r) => setTimeout(r, 5))
            })()
        )
        expect(view.results().at(-1)[2].status).toBe('error')
        expect(c._cacheSize()).toBe(0)
        stall = false
        c.selectPoint(1, 2)
        await within(
            (async () => {
                while (view.results().length < 2) await settle(2)
            })()
        )
        expect(view.results().at(-1)[2].status).toBe('ok')
        expect(c._cacheSize()).toBe(1)
    })

    test('concurrent layers: one stalled body does not hold the others back past the limit', async () => {
        const srv = bodyServers((kind, real, init, nth) =>
            kind === 'point' && nth === 1 ? never() : real()
        )
        const layers = {
            data: { l1: stacLayer(), l2: stacLayer(), l3: stacLayer() },
            on: { l1: true, l2: true, l3: true },
        }
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                    limits: fast,
                }),
            marker: fakeMarker(),
            view,
            requestConcurrency: 1,
        })
        c.selectPoint(1, 2)
        const results = await within(
            (async () => {
                while (view.results().length < 3)
                    await new Promise((r) => setTimeout(r, 5))
                return view.results().map((x) => x[2].status)
            })()
        )
        expect(results.sort()).toEqual(['error', 'ok', 'ok'])
    })

    test('a body that ignores the abort and answers late changes nothing shown or cached', async () => {
        // load 1's point body ignores the abort and resolves after the panel
        // closed and a new load charted - with different values
        let releaseLate
        let first = true
        const srv = bodyServers((kind, real) => {
            if (kind === 'point' && first) {
                first = false
                return new Promise((resolve) => {
                    releaseLate = () =>
                        resolve({
                            type: 'FeatureCollection',
                            assets: ['a', 'b', 'c'].map((id) => ({
                                name: `${COLLECTION}/${id}`,
                                values: [999],
                                band_names: ['b1'],
                            })),
                        })
                })
            }
            return real()
        })
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(10)
        expect(typeof releaseLate).toBe('function')
        c.close()
        c.selectPoint(1, 2)
        await within(
            (async () => {
                while (!view.results().length) await settle(2)
            })()
        )
        const shown = () =>
            view
                .results()
                .map(([, , r]) => r.series?.[0]?.points.map((p) => p.value))
        expect(shown()).toEqual([[1, 2, 3]])
        // the abandoned body now answers
        releaseLate()
        await settle(20)
        expect(shown()).toEqual([[1, 2, 3]])
        expect(c._cacheSize()).toBe(1)
        // and the cache still holds the real answer
        c.selectPoint(1, 2)
        await settle(10)
        expect(shown().at(-1)).toEqual([1, 2, 3])
    })

    test('timers, listeners and losing promises are cleaned up', async () => {
        const unhandled = []
        const onUnhandled = (e) => unhandled.push(e)
        process.on('unhandledRejection', onUnhandled)
        try {
            const ctrl = new AbortController()
            let added = 0
            let removed = 0
            const add = ctrl.signal.addEventListener.bind(ctrl.signal)
            const rem = ctrl.signal.removeEventListener.bind(ctrl.signal)
            ctrl.signal.addEventListener = (...a) => {
                added++
                return add(...a)
            }
            ctrl.signal.removeEventListener = (...a) => {
                removed++
                return rem(...a)
            }
            // success, timeout and cancellation, each through runRequest
            const ok = await runRequest({
                fetchFn: async () => jsonResponse({ x: 1 }),
                url: 'http://x/',
                signal: ctrl.signal,
                timeoutMs: 1000,
                read: (res) => res.json(),
            })
            expect(ok).toEqual({ x: 1 })
            await expect(
                runRequest({
                    fetchFn: async () => ({
                        ok: true,
                        status: 200,
                        json: never,
                    }),
                    url: 'http://x/',
                    signal: ctrl.signal,
                    timeoutMs: 20,
                    read: (res) => res.json(),
                })
            ).rejects.toMatchObject({ name: 'TimeoutError' })
            const pending = runRequest({
                fetchFn: async () => ({ ok: true, status: 200, json: never }),
                url: 'http://x/',
                signal: ctrl.signal,
                timeoutMs: 10000,
                read: (res) => res.json(),
            })
            await settle(3)
            ctrl.abort()
            await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
            // a signal already aborted never starts the request
            let started = false
            await expect(
                runRequest({
                    fetchFn: async () => {
                        started = true
                        return jsonResponse({})
                    },
                    url: 'http://x/',
                    signal: ctrl.signal,
                    timeoutMs: 1000,
                    read: (res) => res.json(),
                })
            ).rejects.toMatchObject({ name: 'AbortError' })
            expect(started).toBe(false)
            expect(removed).toBe(added)
            await new Promise((r) => setTimeout(r, 30))
            expect(unhandled).toEqual([])
        } finally {
            process.off('unhandledRejection', onUnhandled)
        }
    })
})

test.describe('a failed point batch cancels its siblings', () => {
    // batch a fails at once; batch b is in flight (honours the abort like
    // fetch); batch c is queued behind them in the shared limiter
    const setup = () => {
        const log = { requested: [], aborted: [] }
        const fetchFn = (url, init) => {
            const id = new URL(url).searchParams.get('ids')
            log.requested.push(id)
            if (id === 'a')
                return Promise.resolve({
                    ok: false,
                    status: 503,
                    json: async () => ({}),
                })
            return new Promise((resolve, reject) => {
                init.signal.addEventListener('abort', () => {
                    log.aborted.push(id)
                    reject(
                        Object.assign(new Error('aborted'), {
                            name: 'AbortError',
                        })
                    )
                })
                // b answers only after a long time, if ever asked to
                setTimeout(() => resolve(jsonResponse({ assets: [] })), 5000)
            })
        }
        return { log, fetchFn }
    }
    const pointArgs = (fetchFn, run, extra = {}) => ({
        fetchFn,
        titilerBase: 'https://mmgis.test/titilerpgstac',
        collection: COLLECTION,
        lng: 0,
        lat: 0,
        ids: ['a', 'b', 'c'],
        layer: stacLayer(),
        limits: { ...TIME_SERIES_LIMITS, pointBatchSize: 1 },
        run,
        ...extra,
    })

    test('in-flight siblings are aborted, queued ones never start, and the slots are freed at once', async () => {
        const { log, fetchFn } = setup()
        const run = createLimiter(2)
        const t0 = Date.now()
        await expect(fetchPointValues(pointArgs(fetchFn, run))).rejects.toThrow(
            /HTTP 503/
        )
        // the sibling in flight was cancelled, not left to run for seconds
        await settle(5)
        expect(log.aborted).toEqual(['b'])
        expect(log.requested).toEqual(['a', 'b'])
        expect(run.active()).toBe(0)
        // another layer's request on the same limiter starts straight away
        let started = null
        await run(async () => {
            started = Date.now() - t0
        })
        expect(started).toBeLessThan(500)
    })

    test("the caller's own signal is untouched by a sibling's failure", async () => {
        const { fetchFn } = setup()
        const ctrl = new AbortController()
        await expect(
            fetchPointValues(
                pointArgs(fetchFn, createLimiter(2), { signal: ctrl.signal })
            )
        ).rejects.toThrow(/HTTP 503/)
        expect(ctrl.signal.aborted).toBe(false)
    })

    test('a cancelled load still cancels every batch', async () => {
        const { log, fetchFn } = setup()
        const ctrl = new AbortController()
        const p = fetchPointValues(
            pointArgs(
                (url, init) =>
                    new URL(url).searchParams.get('ids') === 'a'
                        ? new Promise(() => {})
                        : fetchFn(url, init),
                createLimiter(3),
                { signal: ctrl.signal }
            )
        )
        await settle(5)
        ctrl.abort()
        await expect(p).rejects.toMatchObject({ name: 'AbortError' })
        await settle(5)
        expect(log.aborted.sort()).toEqual(['b', 'c'])
    })

    test('through the controller: a failing layer cancels its own in-flight batches; the other layer still charts', async () => {
        const { log, fetchFn } = setup()
        const healthy = fakeServers({
            items: [item('h', '2024-01-01T00:00:00Z')],
            values: { h: [7] },
        })
        // layer "bad" lists a, b, c; layer "good" lists h - one limiter of 2
        const badItems = fakeServers({
            items: ['a', 'b', 'c'].map((id, i) =>
                item(id, `2024-01-0${i + 1}T00:00:00Z`)
            ),
        })
        const layers = {
            data: {
                bad: stacLayer({ url: 'stac-collection:bad' }),
                good: stacLayer({ url: 'stac-collection:good' }),
            },
            on: { bad: true, good: true },
        }
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    location: LOCATION,
                    limits: { ...TIME_SERIES_LIMITS, pointBatchSize: 1 },
                    fetchFn: (url, init) => {
                        const u = new URL(url)
                        const bad =
                            u.pathname.includes('/bad') ||
                            u.searchParams.get('collections') === 'bad'
                        if (u.pathname.endsWith('/stac/search'))
                            return (bad ? badItems : healthy).fetchFn(url, init)
                        return bad
                            ? fetchFn(url, init)
                            : healthy.fetchFn(url, init)
                    },
                }),
            marker: fakeMarker(),
            view,
            requestConcurrency: 2,
        })
        const t0 = Date.now()
        c.selectPoint(1, 2)
        while (view.results().length < 2 && Date.now() - t0 < 3000)
            await new Promise((r) => setTimeout(r, 5))
        const byLayer = Object.fromEntries(
            view.results().map(([, uuid, r]) => [uuid, r.status])
        )
        expect(byLayer).toEqual({ bad: 'error', good: 'ok' })
        // the failed layer's sibling request was really cancelled, so it
        // stops costing the server and a shared slot
        await settle(5)
        expect(log.aborted).toContain('b')
        expect(log.requested).not.toContain('c')
    })
})

test.describe('COG-only configurations (#1159 scope)', () => {
    const cogTime = {
        type: 'tile',
        display_name: 'COG over time',
        url: 'COG:Layers/dem_{time}.tif',
        time: {
            enabled: true,
            start: '2024-01-01T00:00:00Z',
            end: '2024-02-01T00:00:00Z',
        },
    }
    const run = (layers) => {
        const fetched = []
        const view = fakeView()
        const marker = fakeMarker()
        const c = createTimeSeriesController({
            getLayers: () => layers,
            fetchSeries: async (a) => {
                fetched.push(a)
                return { status: 'ok', series: [] }
            },
            marker,
            view,
        })
        return { c, view, marker, fetched }
    }

    test('a time-enabled COG alone: the click opens the panel, requests nothing, and says why it is not charted', async () => {
        const { c, view, marker, fetched } = run({
            data: { cog: cogTime },
            on: { cog: true },
        })
        expect(c.selectPoint(1, 2)).toBe(true)
        await settle(5)
        expect(fetched).toEqual([])
        expect(marker.at).toEqual([1, 2])
        const [, , eligible, unsupported] = view.log.find(
            (l) => l[0] === 'render'
        )
        expect(eligible).toEqual([])
        expect(unsupported).toEqual([
            [
                'cog',
                'Time-enabled COG: each time window reads one file, and no catalog lists its acquisition times.',
            ],
        ])
        // and no time was made up for it anywhere
        expect(view.results()).toEqual([])
    })

    test('a COG without time alone: a click opens nothing', () => {
        const { c, marker } = run({
            data: { cog: { ...cogTime, time: { enabled: false } } },
            on: { cog: true },
        })
        expect(c.selectPoint(1, 2)).toBe(false)
        expect(marker.at).toBeNull()
    })

    test('the hover prompt is offered only for a layer that can be charted', () => {
        expect(classifyLayer(cogTime).eligible).toBe(false)
        expect(classifyLayer(stacLayer()).eligible).toBe(true)
    })
})

test.describe('Devin A - distinct ids before timestamp validation', () => {
    const read = (pages, extra = {}) => {
        let n = 0
        return fetchStacItems({
            fetchFn: async () => jsonResponse(pages[n++]),
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ...extra,
        })
    }
    const next = (t) => [{ rel: 'next', href: `http://h/s?token=next:${t}` }]

    test('the review case: [A, invalid B] then [invalid B] against a count of 3 is incomplete', async () => {
        const r = await read([
            {
                numberMatched: 3,
                features: [
                    item('A', '2024-01-01T00:00:00Z'),
                    item('B', 'not-a-time'),
                ],
                links: next(2),
            },
            { numberMatched: 3, features: [item('B', 'not-a-time')] },
        ])
        expect(r.items.map((i) => i.id)).toEqual(['A'])
        // B is one skipped item, not two
        expect(r.invalidTimes).toBe(1)
        // two distinct ids read, three matched: not complete
        expect(r).toMatchObject({ truncated: true, truncatedBy: 'count' })
    })

    test('the review case end to end: warned, one skip noted, not cacheable', async () => {
        const pages = [
            {
                numberMatched: 3,
                features: [
                    item('A', '2024-01-01T00:00:00Z'),
                    item('B', 'not-a-time'),
                ],
                links: next(2),
            },
            { numberMatched: 3, features: [item('B', 'not-a-time')] },
        ]
        let n = 0
        const points = fakeServers({
            items: [item('A', '2024-01-01T00:00:00Z')],
            values: { A: [5] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            location: LOCATION,
            fetchFn: (url, init) =>
                new URL(url).pathname.endsWith('/stac/search')
                    ? Promise.resolve(jsonResponse(pages[n++]))
                    : points.fetchFn(url, init),
        })
        expect(r.status).toBe('ok')
        expect(r.notes).toContain('1 item skipped: no valid acquisition time.')
        expect(r.incomplete).toEqual([
            'showing 1 of 3 matching items: the STAC API counted more items than its pages returned',
        ])
        expect(r.cacheable).toBe(false)
    })

    test('a repeated valid item is counted once and charted once', async () => {
        const r = await read([
            {
                numberMatched: 2,
                features: [
                    item('A', '2024-01-01T00:00:00Z'),
                    item('B', '2024-01-02T00:00:00Z'),
                ],
                links: next(2),
            },
            { numberMatched: 2, features: [item('A', '2024-01-01T00:00:00Z')] },
        ])
        expect(r.items.map((i) => i.id)).toEqual(['A', 'B'])
        expect(r.truncated).toBe(false)
        expect(r.incomplete).toEqual([])
    })

    test('an item repeated with different metadata is kept as first seen and flagged', async () => {
        for (const later of [
            item('A', '2024-03-03T00:00:00Z'), // another time
            item('A', 'not-a-time'), // valid first, invalid later
        ]) {
            const r = await read([
                {
                    numberMatched: 2,
                    features: [
                        item('A', '2024-01-01T00:00:00Z'),
                        item('B', '2024-01-02T00:00:00Z'),
                    ],
                    links: next(2),
                },
                { numberMatched: 2, features: [later] },
            ])
            expect(r.items.map((i) => [i.id, i.time])).toEqual([
                ['A', Date.UTC(2024, 0, 1)],
                ['B', Date.UTC(2024, 0, 2)],
            ])
            expect(r.invalidTimes).toBe(0)
            expect(r.incomplete).toEqual([
                'the STAC API returned 1 item with differing times on different pages',
            ])
        }
        // invalid first, valid later: still one item, flagged, not charted
        // on a guess of which copy is right
        const r = await read([
            {
                numberMatched: 1,
                features: [item('A', 'not-a-time')],
                links: next(2),
            },
            { numberMatched: 1, features: [item('A', '2024-01-01T00:00:00Z')] },
        ])
        expect(r.items).toEqual([])
        expect(r.invalidTimes).toBe(1)
        expect(r.incomplete).toHaveLength(1)
    })

    test('features without an id cannot be told apart: each counts once as skipped', async () => {
        const noId = (t) => ({ type: 'Feature', properties: { datetime: t } })
        const r = await read([
            {
                numberMatched: 3,
                features: [
                    item('A', '2024-01-01T00:00:00Z'),
                    noId('2024-01-02T00:00:00Z'),
                    noId('2024-01-03T00:00:00Z'),
                ],
            },
        ])
        expect(r.items.map((i) => i.id)).toEqual(['A'])
        expect(r.invalidTimes).toBe(2)
        expect(r.truncated).toBe(false)
    })

    test('repeats do not use up the item limit', async () => {
        const r = await read(
            [
                {
                    numberMatched: 3,
                    features: [
                        item('A', '2024-01-01T00:00:00Z'),
                        item('A', '2024-01-01T00:00:00Z'),
                        item('B', '2024-01-02T00:00:00Z'),
                    ],
                    links: next(2),
                },
                {
                    numberMatched: 3,
                    features: [item('C', '2024-01-03T00:00:00Z')],
                },
            ],
            { limits: { ...TIME_SERIES_LIMITS, maxItems: 3 } }
        )
        expect(r.items.map((i) => i.id)).toEqual(['A', 'B', 'C'])
        expect(r.truncated).toBe(false)
    })

    test('through the controller: the review case is not cached; a full answer later is', async () => {
        let complete = false
        let stacCalls = 0
        const points = fakeServers({
            items: ['A', 'B', 'C'].map((id, i) =>
                item(id, `2024-01-0${i + 1}T00:00:00Z`)
            ),
            values: { A: [1], B: [2], C: [3] },
        })
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) => {
                let page = 0
                return fetchLayerTimeSeries({
                    ...a,
                    location: LOCATION,
                    fetchFn: (url, init) => {
                        if (!new URL(url).pathname.endsWith('/stac/search'))
                            return points.fetchFn(url, init)
                        stacCalls++
                        page++
                        if (complete)
                            return Promise.resolve(
                                jsonResponse({
                                    numberMatched: 3,
                                    features: ['A', 'B', 'C'].map((id, i) =>
                                        item(id, `2024-01-0${i + 1}T00:00:00Z`)
                                    ),
                                })
                            )
                        return Promise.resolve(
                            jsonResponse(
                                page === 1
                                    ? {
                                          numberMatched: 3,
                                          features: [
                                              item('A', '2024-01-01T00:00:00Z'),
                                              item('B', 'not-a-time'),
                                          ],
                                          links: next(2),
                                      }
                                    : {
                                          numberMatched: 3,
                                          features: [item('B', 'not-a-time')],
                                      }
                            )
                        )
                    },
                })
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(10)
        expect(view.results().at(-1)[2].incomplete).toHaveLength(1)
        expect(c._cacheSize()).toBe(0)
        complete = true
        const before = stacCalls
        c.selectPoint(1, 2)
        await settle(10)
        expect(stacCalls).toBeGreaterThan(before)
        expect(view.results().at(-1)[2].incomplete).toEqual([])
        expect(c._cacheSize()).toBe(1)
    })
})

test.describe('Devin B - TiTiler omissions are recovered or disclosed, never guessed', () => {
    // A point server that answers each request through `answer(ids, n)`,
    // returning the ids to include (values from VALUES; null = nodata).
    const VALUES = { A: [1], B: [2], C: [3], N: [null] }
    const pointServer = (answer, { status } = {}) => {
        const asked = []
        let inFlight = 0
        const stats = { peak: 0 }
        const fetchFn = async (url, init) => {
            const ids = new URL(url).searchParams.get('ids').split(',')
            asked.push(ids)
            inFlight++
            stats.peak = Math.max(stats.peak, inFlight)
            await new Promise((r) => setTimeout(r, 2))
            inFlight--
            if (init?.signal?.aborted)
                throw Object.assign(new Error('aborted'), {
                    name: 'AbortError',
                })
            const st = status?.(ids, asked.length)
            if (st) return { ok: false, status: st, json: async () => ({}) }
            const include = answer(ids, asked.length)
            // nothing to include: found, but no pixel here (a 200, as
            // titiler-pgstac answers PointOutsideBounds)
            return jsonResponse({
                type: 'FeatureCollection',
                assets: include.map((id) => ({
                    name: `${COLLECTION}/${id}`,
                    values: VALUES[id] ?? [9],
                    band_names: ['b1'],
                })),
            })
        }
        return { fetchFn, asked, stats }
    }
    const values = (srv, ids, extra = {}) =>
        fetchPointValues({
            fetchFn: srv.fetchFn,
            titilerBase: 'https://mmgis.test/titilerpgstac',
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ids,
            layer: stacLayer(),
            ...extra,
        })

    test('the review case: [A,B,C] -> A; [B,C] -> B; C is recovered on its own', async () => {
        const srv = pointServer((ids, n) =>
            n === 1 ? ['A'] : n === 2 ? ['B'] : ids
        )
        const got = await values(srv, ['A', 'B', 'C'])
        expect(srv.asked).toEqual([['A', 'B', 'C'], ['B', 'C'], ['C']])
        expect([...got.keys()].sort()).toEqual(['A', 'B', 'C'])
        expect(got.get('C').values).toEqual([3])
        expect([...got.unresolved]).toEqual([])
    })

    test('nodata in a response is a confirmed answer: no re-asking', async () => {
        const srv = pointServer((ids) => ids)
        const got = await values(srv, ['A', 'N'])
        expect(srv.asked).toEqual([['A', 'N']])
        expect(got.get('N').values).toEqual([null])
    })

    test('omitted even when asked on its own: a confirmed "no reading", not unresolved', async () => {
        const srv = pointServer((ids) => ids.filter((id) => id !== 'C'))
        const got = await values(srv, ['A', 'B', 'C'])
        expect(srv.asked).toEqual([['A', 'B', 'C'], ['C']])
        expect(got.has('C')).toBe(false)
        expect([...got.unresolved]).toEqual([])
    })

    test('a one-id batch that omits its id is already definitive', async () => {
        const srv = pointServer(() => [])
        const got = await values(srv, ['C'])
        expect(srv.asked).toEqual([['C']])
        expect([...got.unresolved]).toEqual([])
    })

    test('omissions beyond the retry budget stay unresolved - bounded requests', async () => {
        const ids = Array.from({ length: 60 }, (_, i) => `i${i}`)
        // every multi-id request answers only its first id; singletons answer
        const srv = pointServer((asked) =>
            asked.length === 1 ? asked : [asked[0]]
        )
        const limits = {
            ...TIME_SERIES_LIMITS,
            pointBatchSize: 50,
            retryBatchSize: 10,
            maxRetryRequests: 8,
        }
        const got = await values(srv, ids, { limits })
        expect(srv.asked.length).toBeLessThanOrEqual(2 + 8)
        expect(got.size + got.unresolved.size).toBe(60)
        expect(got.unresolved.size).toBeGreaterThan(0)
        // nothing unresolved was turned into a value or a gap
        for (const id of got.unresolved) expect(got.has(id)).toBe(false)
    })

    test('a service error during recovery fails the read (nothing cached)', async () => {
        const srv = pointServer((ids, n) => (n === 1 ? ['A'] : ids), {
            status: (ids, n) => (n === 2 ? 503 : 0),
        })
        await expect(values(srv, ['A', 'B', 'C'])).rejects.toThrow(/HTTP 503/)
    })

    test('cancellation during recovery stops it', async () => {
        const ctrl = new AbortController()
        const srv = pointServer((ids, n) => {
            if (n === 2) ctrl.abort()
            return n === 1 ? ['A'] : []
        })
        await expect(
            values(srv, ['A', 'B', 'C'], { signal: ctrl.signal })
        ).rejects.toMatchObject({ name: 'AbortError' })
        await settle(5)
        expect(srv.asked.length).toBe(2)
    })

    test('recovery stays inside the shared concurrency limit', async () => {
        const ids = Array.from({ length: 30 }, (_, i) => `i${i}`)
        const srv = pointServer((asked) =>
            asked.length === 1 ? asked : asked.slice(0, 2)
        )
        const run = createLimiter(3)
        await values(srv, ids, {
            run,
            limits: {
                ...TIME_SERIES_LIMITS,
                pointBatchSize: 10,
                retryBatchSize: 4,
            },
        })
        expect(srv.stats.peak).toBeLessThanOrEqual(3)
    })

    test('end to end: an unresolved acquisition is a labelled gap, disclosed, and not cached', async () => {
        const stac = fakeServers({
            items: ['A', 'B', 'C'].map((id, i) =>
                item(id, `2024-01-0${i + 1}T00:00:00Z`)
            ),
        })
        let healthy = false
        // C is left out of every answer until the service recovers
        const srv = pointServer((ids) =>
            healthy ? ids : ids.filter((id) => id !== 'C')
        )
        // no retry budget: C cannot be resolved
        const limits = { ...TIME_SERIES_LIMITS, maxRetryRequests: 0 }
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    location: LOCATION,
                    limits,
                    fetchFn: (url, init) =>
                        new URL(url).pathname.endsWith('/stac/search')
                            ? stac.fetchFn(url, init)
                            : srv.fetchFn(url, init),
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(20)
        const r = view.results().at(-1)[2]
        expect(r.status).toBe('ok')
        const pts = r.series[0].points
        expect(pts.map((p) => [p.itemId, p.value, p.status])).toEqual([
            ['A', 1, 'ok'],
            ['B', 2, 'ok'],
            ['C', null, 'unresolved'],
        ])
        expect(buildReadingsTable(r.series).rows[2][2]).toBe('not read')
        expect(r.incomplete).toEqual([
            '1 acquisition could not be read here (the point service left it out of its answers); its value may exist',
        ])
        expect(r.cacheable).toBe(false)
        expect(c._cacheSize()).toBe(0)
        // the service recovers: the next click reads C and is cached
        healthy = true
        c.selectPoint(1, 2)
        await settle(20)
        const r2 = view.results().at(-1)[2]
        expect(r2.series[0].points.map((p) => p.value)).toEqual([1, 2, 3])
        expect(r2.incomplete).toEqual([])
        expect(c._cacheSize()).toBe(1)
    })
})

test.describe('one-item answers: only a 200 confirms a missing reading', () => {
    // pgSTAC 0.9.6 checks its time limit only after a match, so a one-item
    // search cut short still returns the item. A 200 whose `assets` lack it
    // means the item was found and its pixel read was dropped (no reading).
    // A 204 / NoAssetFound 404 means TiTiler's search didn't find an item
    // the STAC API said covers the point - unexplained, so not confirmed.
    const singleServer = (answer) => {
        const asked = []
        const fetchFn = async (url) => {
            const ids = new URL(url).searchParams.get('ids').split(',')
            asked.push(ids)
            return answer(ids)
        }
        return { fetchFn, asked }
    }
    const empty200 = () => jsonResponse({ coordinates: [0, 0], assets: [] })
    const noContent = () => ({ ok: true, status: 204, json: async () => null })
    const legacy404 = () =>
        jsonResponse({ detail: 'No assets found for point (0,0)' }, 404)
    const read = (srv, ids = ['C']) =>
        fetchPointValues({
            fetchFn: srv.fetchFn,
            titilerBase: TITILER_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
            ids,
            layer: {},
        })

    test('200 with an empty assets list: a confirmed "no reading"', async () => {
        const got = await read(singleServer(empty200))
        expect(got.has('C')).toBe(false)
        expect([...got.unresolved]).toEqual([])
    })

    for (const [label, answer] of [
        ['204', noContent],
        ['legacy NoAssetFound 404', legacy404],
    ])
        test(`${label} for one item: unresolved, not a confirmed gap`, async () => {
            const srv = singleServer(answer)
            const got = await read(srv)
            expect(srv.asked).toEqual([['C']])
            expect(got.has('C')).toBe(false)
            expect([...got.unresolved]).toEqual(['C'])
        })

    test('the same after a multi-item answer left the item out', async () => {
        // [A,C] -> A only; then C alone -> 204: unresolved
        const srv = singleServer((ids) =>
            ids.length > 1
                ? jsonResponse({ assets: [pointAsset('A', [1])] })
                : noContent()
        )
        const got = await read(srv, ['A', 'C'])
        expect(srv.asked).toEqual([['A', 'C'], ['C']])
        expect(got.get('A').values).toEqual([1])
        expect([...got.unresolved]).toEqual(['C'])
        // and a 200-empty in the same place confirms it instead
        const srv2 = singleServer((ids) =>
            ids.length > 1
                ? jsonResponse({ assets: [pointAsset('A', [1])] })
                : empty200()
        )
        expect([...(await read(srv2, ['A', 'C'])).unresolved]).toEqual([])
    })

    test('end to end: a 204 for the only item is disclosed and not cached; a 200 later is', async () => {
        let answer = noContent
        const stac = fakeServers({ items: [item('C', '2024-01-01T00:00:00Z')] })
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    location: LOCATION,
                    fetchFn: (url, init) =>
                        new URL(url).pathname.endsWith('/stac/search')
                            ? stac.fetchFn(url, init)
                            : Promise.resolve(answer()),
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(10)
        let r = view.results().at(-1)[2]
        expect(r).toMatchObject({ status: 'empty', kind: 'all-gaps' })
        expect(r.series[0].points[0].status).toBe('unresolved')
        expect(r.incomplete).toEqual([
            '1 acquisition could not be read here (the point service left it out of its answers); its value may exist',
        ])
        expect(r.cacheable).toBe(false)
        expect(c._cacheSize()).toBe(0)
        // the service now answers with a 200 that confirms no reading
        answer = empty200
        c.selectPoint(1, 2)
        await settle(10)
        r = view.results().at(-1)[2]
        expect(r.series[0].points[0].status).toBe('missing')
        expect(r.incomplete).toEqual([])
        expect(c._cacheSize()).toBe(1)
    })
})

test.describe('id-less STAC features cannot establish completeness', () => {
    const noId = (t) => ({ type: 'Feature', properties: { datetime: t } })
    const next = (t) => [{ rel: 'next', href: `http://h/s?token=next:${t}` }]
    const read = (pages) => {
        let n = 0
        return fetchStacItems({
            fetchFn: async () => jsonResponse(pages[n++]),
            stacBase: STAC_BASE,
            collection: COLLECTION,
            lng: 0,
            lat: 0,
        })
    }

    test('one id-less feature repeated across pages does not make the count', async () => {
        // 3 matched; A, and an id-less X sent twice - maybe one item, maybe two
        const r = await read([
            {
                numberMatched: 3,
                features: [item('A', '2024-01-01T00:00:00Z'), noId('nope')],
                links: next(2),
            },
            { numberMatched: 3, features: [noId('nope')] },
        ])
        expect(r.items.map((i) => i.id)).toEqual(['A'])
        expect(r.invalidTimes).toBe(2)
        expect(r.incomplete).toEqual([
            "the STAC API returned 2 items without an id, so it can't be confirmed that every matching item was read",
        ])
    })

    test('end to end: warned and not cacheable', async () => {
        let page = 0
        const pages = [
            {
                numberMatched: 3,
                features: [item('A', '2024-01-01T00:00:00Z'), noId('nope')],
                links: next(2),
            },
            { numberMatched: 3, features: [noId('nope')] },
        ]
        const points = fakeServers({
            items: [item('A', '2024-01-01T00:00:00Z')],
            values: { A: [5] },
        })
        const r = await fetchLayerTimeSeries({
            layer: stacLayer(),
            lng: 0,
            lat: 0,
            location: LOCATION,
            fetchFn: (url, init) =>
                new URL(url).pathname.endsWith('/stac/search')
                    ? Promise.resolve(jsonResponse(pages[page++]))
                    : points.fetchFn(url, init),
        })
        expect(r.status).toBe('ok')
        expect(r.incomplete).toHaveLength(1)
        expect(r.cacheable).toBe(false)
    })

    test('distinct ids that already make the count settle it, id-less extras aside', async () => {
        const r = await read([
            {
                numberMatched: 2,
                features: [
                    item('A', '2024-01-01T00:00:00Z'),
                    item('B', '2024-01-02T00:00:00Z'),
                    noId('nope'),
                ],
            },
        ])
        expect(r.truncated).toBe(false)
        expect(r.incomplete).toEqual([])
    })

    test('without a count, id-less features change nothing', async () => {
        const r = await read([
            { features: [item('A', '2024-01-01T00:00:00Z'), noId('nope')] },
        ])
        expect(r.truncated).toBe(false)
        expect(r.incomplete).toEqual([])
    })
})

test.describe('caching incomplete histories', () => {
    // STAC search that answers per `mode`; TiTiler from fakeServers
    const servers = (state) => {
        const ids = ['a', 'b', 'c']
        const points = fakeServers({
            items: ids.map((id, i) => item(id, `2024-01-0${i + 1}T00:00:00Z`)),
            values: { a: [1], b: [2], c: [3] },
        })
        const calls = { stac: 0 }
        const fetchFn = async (url, init) => {
            const u = new URL(url)
            if (!u.pathname.endsWith('/stac/search'))
                return points.fetchFn(url, init)
            calls.stac++
            const page = Number(u.searchParams.get('token')?.split(':')[1] || 0)
            if (state.mode === 'repeat')
                // the server hands back the same token forever
                return jsonResponse({
                    features: [
                        item(ids[page], `2024-01-0${page + 1}T00:00:00Z`),
                    ],
                    links: [{ rel: 'next', href: 'http://h/s?token=next:1' }],
                })
            // healthy: one item a page, numberMatched 3
            return jsonResponse({
                features: [item(ids[page], `2024-01-0${page + 1}T00:00:00Z`)],
                numberMatched: 3,
                links:
                    page < 2
                        ? [
                              {
                                  rel: 'next',
                                  href: `http://h/s?token=next:${page + 1}`,
                              },
                          ]
                        : [],
            })
        }
        return { fetchFn, calls }
    }
    const controllerFor = (srv, limits = TIME_SERIES_LIMITS) => {
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: srv.fetchFn,
                    location: LOCATION,
                    limits,
                }),
            marker: fakeMarker(),
            view,
        })
        return { c, view }
    }

    test('a history incomplete because of the server is shown but not cached; the next click re-reads', async () => {
        const state = { mode: 'repeat' }
        const srv = servers(state)
        const { c, view } = controllerFor(srv)
        c.selectPoint(1, 2)
        await settle(10)
        const first = view.results().at(-1)[2]
        expect(first.status).toBe('ok')
        expect(first.incomplete).toEqual(['the STAC API repeated a page token'])
        expect(first.cacheable).toBe(false)
        expect(c._cacheSize()).toBe(0)
        // the server recovers: the same point is read again, completely
        state.mode = 'ok'
        const before = srv.calls.stac
        c.selectPoint(1, 2)
        await settle(10)
        const second = view.results().at(-1)[2]
        expect(srv.calls.stac).toBeGreaterThan(before)
        expect(second.incomplete).toEqual([])
        expect(second.series[0].points.map((p) => p.value)).toEqual([1, 2, 3])
        expect(c._cacheSize()).toBe(1)
        // complete now, so served from the cache
        const cached = srv.calls.stac
        c.selectPoint(1, 2)
        await settle(10)
        expect(srv.calls.stac).toBe(cached)
    })

    test('cut short only by our own bound: cached, with its note kept', async () => {
        const srv = servers({ mode: 'ok' })
        const { c, view } = controllerFor(srv, {
            ...TIME_SERIES_LIMITS,
            maxItems: 2,
        })
        c.selectPoint(1, 2)
        await settle(10)
        const r = view.results().at(-1)[2]
        expect(r.incomplete).toEqual([
            'showing 2 of 3 matching items (limit 2)',
        ])
        expect(r.cacheable).toBe(true)
        expect(c._cacheSize()).toBe(1)
        const calls = srv.calls.stac
        c.selectPoint(1, 2)
        await settle(10)
        expect(srv.calls.stac).toBe(calls)
        expect(view.results().at(-1)[2].incomplete).toEqual([
            'showing 2 of 3 matching items (limit 2)',
        ])
    })

    test('a count its pages do not reach is not cached', async () => {
        const srv = servers({ mode: 'ok' })
        const wrapped = {
            fetchFn: async (url, init) => {
                const res = await srv.fetchFn(url, init)
                if (!new URL(url).pathname.endsWith('/stac/search')) return res
                const body = await res.json()
                return jsonResponse({ ...body, numberMatched: 4 })
            },
        }
        const { c, view } = controllerFor(wrapped)
        c.selectPoint(1, 2)
        await settle(10)
        const r = view.results().at(-1)[2]
        expect(r.incomplete).toEqual([
            'showing 3 of 4 matching items: the STAC API counted more items than its pages returned',
        ])
        expect(c._cacheSize()).toBe(0)
    })

    test('a reader that marks nothing: incomplete results are not cached', async () => {
        let n = 0
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            fetchSeries: async () => {
                n++
                return {
                    status: 'ok',
                    series: [],
                    notes: [],
                    incomplete: ['x'],
                }
            },
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(5)
        c.selectPoint(1, 2)
        await settle(5)
        expect(n).toBe(2)
        expect(c._cacheSize()).toBe(0)
    })
})

test.describe('step 3 - hover and chart write a reading the same way', () => {
    test('value and unit: per band, appended verbatim, as the hover does', () => {
        expect(unitForBand(['K', '%'], 1)).toBe('%')
        expect(unitForBand(['K'], 3)).toBe('')
        expect(unitForBand('ppm', 5)).toBe('ppm')
        expect(unitForBand(undefined, 0)).toBe('')
        // the hover's own formula: parseValue(v, 2, 1) + '' + unit
        for (const [v, unit] of [
            [120.91466522216797, 'ppm'],
            [-11.682, ' m'],
            [0, ''],
        ])
            expect(formatStacReading(v, unit)).toBe(
                parseIdentifierValue(v, 2, 1) + '' + unit
            )
        expect(formatStacReading(null, 'ppm')).toBe('no data')
        // the chart's tooltip and table use the same text
        const r = buildSeries(
            [{ id: 'a', time: 0, range: null }],
            new Map([
                [
                    'a',
                    {
                        values: [120.91466522216797, 3],
                        bandNames: ['b1', 'b2'],
                    },
                ],
            ]),
            { units: ['ppm', ' K'] }
        )
        const t = buildReadingsTable(r.series)
        expect(t.columns).toEqual([
            'Acquired (UTC)',
            'Acquisition ID',
            'b1 (ppm)',
            'b2 (K)',
        ])
        // the table puts the unit in the column header, the number in the cell
        expect(t.rows[0].slice(2)).toEqual(['120.91', '3'])
        const option = buildChartOption(r.series)
        const html = option.tooltip.formatter(
            option.series.map((s, i) => ({
                seriesIndex: i,
                seriesName: s.name,
                dataIndex: 0,
                data: s.data[0],
            }))
        )
        expect(html).toContain('b1: <b>120.91ppm</b>')
        expect(html).toContain('b2: <b>3 K</b>')
    })

    test('STAC scaling: an Identifier scalefactor/unit is not applied, as in the hover', async () => {
        // The hover readout replaces any Identifier data config for a
        // stac-collection layer with { units: cogUnits, sigfigs: 2,
        // scalefactor: 1 } (upstream behaviour). The chart must not scale a
        // value the hover shows raw.
        const servers = fakeServers({
            items: [item('a', '2024-01-02T00:00:00Z')],
            values: { a: [120.91466522216797] },
        })
        const view = fakeView()
        const c = createTimeSeriesController({
            getLayers: () => ({
                data: { ch4: stacLayer() },
                on: { ch4: true },
            }),
            getIdentifierConfig: () => ({ scalefactor: 10, unit: 'ppb' }),
            fetchSeries: (a) =>
                fetchLayerTimeSeries({
                    ...a,
                    fetchFn: servers.fetchFn,
                    location: LOCATION,
                }),
            marker: fakeMarker(),
            view,
        })
        c.selectPoint(1, 2)
        await settle(10)
        const r = view.results().at(-1)[2]
        expect(r.status).toBe('ok')
        const [band] = r.series
        expect(band.units).toBe('ppm m')
        expect(band.points[0].value).toBe(120.91466522216797)
        expect(buildReadingsTable(r.series).rows[0].at(-1)).toBe('120.91')
        expect(formatStacReading(band.points[0].value, band.units)).toBe(
            '120.91ppm m'
        )
    })

    test('the chart draws times in UTC (useUTC) for every browser zone', () => {
        expect(buildChartOption([]).useUTC).toBe(true)
    })
})
