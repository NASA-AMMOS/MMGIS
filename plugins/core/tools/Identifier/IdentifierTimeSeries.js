/**
 * IdentifierTimeSeries.js
 *
 * Data side of the Identifier's click-for-time-series (#1159): decides which
 * active layers can be charted, and fetches one point's history for a
 * time-enabled STAC collection layer.
 *
 * How a history is read, and why:
 *
 * 1. Acquisition times come from the STAC API, never from TiTiler. TiTiler's
 *    point endpoint only returns `{ name: 'collection/item', values,
 *    band_names }`; pgSTAC's point search asks for `id, bbox, collection,
 *    assets` and nothing else. So the items under the point, inside the
 *    layer's time window, are listed from `GET /stac/search` (paged, bounded),
 *    and each item's `properties.datetime` is its time.
 * 2. Values are then read for exactly those items, in batches, with
 *    `/collections/{id}/point/{lng},{lat}?ids=...`. Asking by id, with
 *    `items_limit` equal to the batch, means pgSTAC's per-geometry item limit
 *    (100 by default) can never silently drop the older acquisitions, and
 *    every value is matched to its item by the asset name TiTiler returns.
 *    (titiler-pgstac already forces exitwhenfull/skipcovered off for points.)
 * 3. A masked (nodata) pixel comes back as null and stays null - it is a gap
 *    in the chart, never a zero.
 *
 * The module has no MMGIS imports beyond the pure LayerUtils, so it can be
 * unit-tested directly; `fetch` and global options are passed in.
 */
import {
    parseExternalStacUrl,
    formatStacBidx,
    normalizeTitilerExpression,
} from '../../../../src/essence/Basics/Layers_/LayerUtils.js'

export const TIME_SERIES_LIMITS = {
    // Most STAC items charted for one point and layer. Bounds the work a
    // single click can cause; the panel says when a history was cut short.
    maxItems: 500,
    // STAC search page size.
    stacPageSize: 100,
    // Items per TiTiler point request (also its items_limit).
    pointBatchSize: 50,
    // Point requests in flight at once, per layer.
    pointConcurrency: 2,
    // A broken `next` link must not page forever.
    maxStacPages: 20,
}

const RASTER_TYPES = ['tile', 'image']

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '')

/**
 * Whether a layer can be charted, and if not, why - in a sentence a user can
 * read. Header layers return null (they are not data and are never listed).
 *
 * @param {object} layer - L_.layers.data entry
 * @param {object} [options]
 * @param {boolean} [options.hasIdentifierDataSource] - the Identifier tool is
 *   configured with its own `url` (a single raster file) for this layer
 * @returns {{eligible: true, url: string} | {eligible: false, reason: string} | null}
 */
export function classifyLayer(layer, options = {}) {
    if (!layer || layer.type === 'header') return null
    const url = typeof layer.url === 'string' ? layer.url : ''

    if (!RASTER_TYPES.includes(layer.type)) {
        if (layer.type === 'vector' || layer.type === 'vectortile')
            return {
                eligible: false,
                reason: 'Vector layer: features carry no raster measurements to chart.',
            }
        return {
            eligible: false,
            reason: `${layer.type || 'This'} layer: has no raster pixel values to chart.`,
        }
    }

    if (url.startsWith('stac-collection:')) {
        if (layer.time?.enabled !== true)
            return {
                eligible: false,
                reason: 'Not time-enabled, so there is no time range to chart.',
            }
        if (isBlank(layer.time.end))
            return {
                eligible: false,
                reason: 'No time range is set for this layer yet.',
            }
        return { eligible: true, url }
    }
    // A COG's time support is URL templating ({time}, {starttime},
    // {endtime}, {customtime.N}): each time window resolves to one file, and
    // TiTiler's COG reader takes no datetime. Nothing lists the times a COG
    // has files for, so a history would mean inventing them.
    if (url.startsWith('COG:'))
        return {
            eligible: false,
            reason:
                layer.time?.enabled === true
                    ? 'Time-enabled COG: each time window reads one file, and no catalog lists its acquisition times.'
                    : 'Single COG: one snapshot with no per-acquisition history.',
        }
    if (options.hasIdentifierDataSource)
        return {
            eligible: false,
            reason: 'Identifier source is a single raster file with no acquisition timestamps.',
        }
    if (layer.type === 'image')
        return {
            eligible: false,
            reason: 'Image layer: a single snapshot with no acquisition history.',
        }
    return {
        eligible: false,
        reason: 'Pre-rendered tiles: colours only, no numeric source values.',
    }
}

/**
 * The servers a stac-collection layer reads from.
 *
 * Local collections use this MMGIS's /titilerpgstac and /stac proxies.
 * External ones (`stac-collection:https://host/titilerpgstac/collections/c`)
 * only name their TiTiler, so the STAC API is taken to be the sibling
 * `https://host/stac` - the layout every MMGIS deployment exposes. If it isn't
 * there the layer reports that it couldn't read acquisition times.
 *
 * @returns {{titilerBase: string, stacBase: string, collection: string, external: boolean} | null}
 */
export function resolveStacEndpoints(url, location, nodeEnv) {
    if (typeof url !== 'string' || !url.startsWith('stac-collection:'))
        return null
    const afterColon = url.substring(url.indexOf(':') + 1)
    if (afterColon.includes('://')) {
        const parsed = parseExternalStacUrl(afterColon)
        if (!parsed) return null
        return {
            titilerBase: parsed.baseUrl,
            stacBase: parsed.baseUrl.replace(/\/titilerpgstac$/, '/stac'),
            collection: parsed.collectionName,
            external: true,
        }
    }
    const collection = afterColon.split('?')[0].trim()
    if (!collection) return null
    // Same origin rule as the Identifier's hover query.
    const base =
        nodeEnv === 'development'
            ? 'http://localhost:8888'
            : `${location?.origin || ''}${(location?.pathname || '').replace(
                  /\/$/g,
                  ''
              )}`
    return {
        titilerBase: `${base}/titilerpgstac`,
        stacBase: `${base}/stac`,
        collection,
        external: false,
    }
}

/**
 * The layer's current time window as a STAC/TiTiler `datetime` interval - the
 * same window the hover readout queries.
 * @returns {string|null}
 */
export function buildDatetimeParam(time) {
    if (!time || isBlank(time.end)) return null
    return isBlank(time.start) ? `../${time.end}` : `${time.start}/${time.end}`
}

// RFC 3339 date-time (time requires a zone), or a bare date.
const ISO_INSTANT =
    /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2}):(\d{2})))?$/

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const daysInMonth = (y, m) =>
    [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]

/**
 * Parse an acquisition time to epoch ms, or null.
 *
 * Accepted: an RFC 3339 date-time with an explicit zone -
 * `2024-01-02T03:04:05Z`, `...05.123456Z`, `...05+02:00` - or a bare date,
 * `2024-01-02`, read as UTC midnight (as ECMAScript reads date-only forms).
 *
 * Rejected rather than guessed at:
 *  - a time with no zone (`2024-01-02T03:04:05`): JavaScript would read it in
 *    the browser's own timezone, so one item would land at different
 *    instants for different users;
 *  - impossible fields (`2024-02-31`, `2023-02-29`, hour 24, minute 60,
 *    offset +24:00), which Date.parse would roll into another date;
 *  - leap seconds (`:60`), which a JavaScript time can't hold;
 *  - anything else (`5`, `May`, a file name).
 *
 * The fields are read here and combined with Date.UTC, so the result never
 * depends on the host timezone. Fractional seconds are kept to the
 * millisecond (further digits are truncated).
 */
export function parseIsoTime(value) {
    if (typeof value !== 'string') return null
    const m = ISO_INSTANT.exec(value.trim())
    if (!m) return null
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    if (month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year, month)) return null

    let hour = 0
    let minute = 0
    let second = 0
    let ms = 0
    let offsetMinutes = 0
    if (m[4] !== undefined) {
        hour = Number(m[4])
        minute = Number(m[5])
        second = Number(m[6])
        if (hour > 23 || minute > 59 || second > 59) return null
        if (m[7] !== undefined) ms = Number(m[7].slice(0, 3).padEnd(3, '0'))
        if (m[9] !== undefined) {
            const oh = Number(m[10])
            const om = Number(m[11])
            if (oh > 23 || om > 59) return null
            offsetMinutes = (m[9] === '-' ? -1 : 1) * (oh * 60 + om)
        }
    }

    // Date.UTC maps years 0-99 to 1900-1999; set the year explicitly.
    const d = new Date(Date.UTC(2000, month - 1, day, hour, minute, second, ms))
    d.setUTCFullYear(year, month - 1, day)
    const t = d.getTime() - offsetMinutes * 60000
    return Number.isFinite(t) ? t : null
}

/**
 * The acquisition time of one STAC item.
 *
 * `properties.datetime` is the item's time. Per the STAC spec it may be null
 * when the item covers a range instead; then the range's start is used as the
 * point on the axis and the range is kept for the tooltip.
 *
 * @returns {{id: string, time: number, range: [string, string]|null} | null}
 */
export function parseStacItemTime(feature) {
    if (!feature || typeof feature.id !== 'string' || feature.id === '')
        return null
    const p = feature.properties || {}
    const t = parseIsoTime(p.datetime)
    if (t != null) return { id: feature.id, time: t, range: null }
    const start = parseIsoTime(p.start_datetime)
    if (start != null && p.datetime == null) {
        const end = parseIsoTime(p.end_datetime)
        return {
            id: feature.id,
            time: start,
            range: end != null ? [p.start_datetime, p.end_datetime] : null,
        }
    }
    return null
}

/** `GET /search` for items in a collection that contain a point. */
export function buildStacSearchUrl(
    stacBase,
    collection,
    lng,
    lat,
    datetime,
    limit,
    token
) {
    const params = new URLSearchParams()
    params.set('collections', collection)
    params.set(
        'intersects',
        JSON.stringify({ type: 'Point', coordinates: [lng, lat] })
    )
    if (datetime) params.set('datetime', datetime)
    params.set('limit', String(limit))
    // Fields extension: only what is needed. Servers without it ignore this
    // and send whole items, which parse the same.
    params.set(
        'fields',
        'id,collection,properties.datetime,properties.start_datetime,properties.end_datetime'
    )
    if (token) params.set('token', token)
    return `${stacBase}/search?${params.toString()}`
}

/**
 * The pagination token of an ItemCollection's `next` link. The link's host is
 * whatever the STAC server saw (often the internal upstream behind MMGIS's
 * proxy), so only the token is taken and re-sent to our own base URL.
 * @returns {string|null}
 */
export function nextPageToken(json) {
    const next = (json?.links || []).find((l) => l && l.rel === 'next')
    if (!next) return null
    if (next.body && typeof next.body.token === 'string') return next.body.token
    if (typeof next.href !== 'string') return null
    try {
        return new URL(next.href, 'http://localhost').searchParams.get('token')
    } catch (e) {
        return null
    }
}

/** Response error with an HTTP status, for messages. */
export class TimeSeriesHttpError extends Error {
    constructor(what, status) {
        super(`${what} failed (HTTP ${status})`)
        this.status = status
    }
}

/**
 * Every item (up to `maxItems`) containing the point in the time window.
 *
 * @returns {Promise<{items: Array, numberMatched: number|null, truncated: boolean, invalidTimes: number}>}
 */
export async function fetchStacItems({
    fetchFn,
    stacBase,
    collection,
    lng,
    lat,
    datetime,
    signal,
    limits = TIME_SERIES_LIMITS,
}) {
    const items = []
    const seen = new Set()
    let invalidTimes = 0
    let numberMatched = null
    let token = null
    let truncated = false
    const seenTokens = new Set()

    for (let page = 0; page < limits.maxStacPages; page++) {
        const remaining = limits.maxItems - items.length
        const res = await fetchFn(
            buildStacSearchUrl(
                stacBase,
                collection,
                lng,
                lat,
                datetime,
                Math.min(limits.stacPageSize, Math.max(remaining, 1)),
                token
            ),
            {
                headers: { accept: 'application/geo+json, application/json' },
                signal,
            }
        )
        if (!res.ok) throw new TimeSeriesHttpError('STAC search', res.status)
        const json = await res.json()
        if (!json || !Array.isArray(json.features))
            throw new Error('STAC search returned no feature list')
        if (Number.isFinite(json.numberMatched))
            numberMatched = json.numberMatched
        else if (Number.isFinite(json.context?.matched))
            numberMatched = json.context.matched

        for (const f of json.features) {
            const parsed = parseStacItemTime(f)
            if (!parsed) {
                invalidTimes++
                continue
            }
            if (seen.has(parsed.id)) continue
            if (items.length >= limits.maxItems) {
                truncated = true
                break
            }
            seen.add(parsed.id)
            items.push(parsed)
        }
        if (truncated) break

        token = nextPageToken(json)
        if (!token || json.features.length === 0) break
        if (items.length >= limits.maxItems) {
            truncated = true
            break
        }
        if (seenTokens.has(token)) {
            token = null
            break
        }
        seenTokens.add(token)
        // Out of pages with a next page still offered: say so.
        if (page === limits.maxStacPages - 1) truncated = true
    }
    if (numberMatched != null && numberMatched > items.length + invalidTimes)
        truncated = true
    return { items, numberMatched, truncated, invalidTimes }
}

/**
 * The band/expression part of a point query, exactly as the hover readout
 * builds it: the runtime expression first, then the configured one, else the
 * queried bands inline on the asset (titiler>=2).
 */
export function buildBandParams(layer) {
    const expression = layer.currentCogExpression || layer.cogExpression
    if (expression && expression.trim() !== '')
        return {
            assets: 'asset',
            expression: normalizeTitilerExpression(expression),
        }
    const bands = formatStacBidx(layer.cogBandsQuery)
    return { assets: bands ? `asset|bidx=${bands}` : 'asset', expression: null }
}

/** `/collections/{id}/point/{lng},{lat}` for an explicit set of item ids. */
export function buildPointUrl(
    titilerBase,
    collection,
    lng,
    lat,
    ids,
    layer,
    stacOptions = {}
) {
    const band = buildBandParams(layer)
    // The `|` and `=` inside assets are left as the hover query sends them.
    let qs = `assets=${band.assets}`
    qs += `&ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`
    qs += `&items_limit=${ids.length}`
    if (stacOptions.mosaicScanLimit != null)
        qs += `&scan_limit=${stacOptions.mosaicScanLimit}`
    if (stacOptions.mosaicTimeLimit != null)
        qs += `&time_limit=${stacOptions.mosaicTimeLimit}`
    if (band.expression)
        qs += `&expression=${encodeURIComponent(band.expression)}`
    return `${titilerBase}/collections/${encodeURIComponent(
        collection
    )}/point/${lng},${lat}?${qs}`
}

/**
 * Index a titiler-pgstac (>=3) point response by item id. Asset names are
 * `${collection}/${itemId}`.
 * @returns {Map<string, {values: Array, bandNames: Array<string>}>}
 */
export function parsePointResponse(json, collection) {
    const byId = new Map()
    if (!json || !Array.isArray(json.assets)) return byId
    const prefix = `${collection}/`
    for (const asset of json.assets) {
        if (!asset || typeof asset.name !== 'string') continue
        const id = asset.name.startsWith(prefix)
            ? asset.name.substring(prefix.length)
            : asset.name.substring(asset.name.indexOf('/') + 1)
        if (!id) continue
        byId.set(id, {
            values: Array.isArray(asset.values) ? asset.values : [],
            bandNames: Array.isArray(asset.band_names) ? asset.band_names : [],
        })
    }
    return byId
}

/** Run async tasks with at most `limit` in flight; results in input order. */
export async function mapWithConcurrency(inputs, limit, task) {
    const out = new Array(inputs.length)
    let next = 0
    let failed = false
    const worker = async () => {
        // After a failure, start nothing new: the result is already an error.
        while (!failed && next < inputs.length) {
            const i = next++
            try {
                out[i] = await task(inputs[i], i)
            } catch (e) {
                failed = true
                throw e
            }
        }
    }
    await Promise.all(
        Array.from(
            { length: Math.max(1, Math.min(limit, inputs.length)) },
            worker
        )
    )
    return out
}

/** Values at the point for the given items, by item id. */
export async function fetchPointValues({
    fetchFn,
    titilerBase,
    collection,
    lng,
    lat,
    ids,
    layer,
    stacOptions,
    signal,
    limits = TIME_SERIES_LIMITS,
}) {
    const batches = []
    for (let i = 0; i < ids.length; i += limits.pointBatchSize)
        batches.push(ids.slice(i, i + limits.pointBatchSize))

    const merged = new Map()
    await mapWithConcurrency(
        batches,
        limits.pointConcurrency,
        async (batch) => {
            const res = await fetchFn(
                buildPointUrl(
                    titilerBase,
                    collection,
                    lng,
                    lat,
                    batch,
                    layer,
                    stacOptions
                ),
                { headers: { accept: 'application/json' }, signal }
            )
            // titiler-pgstac answers NoAssetFound with 204 No Content (404
            // on some deployments): no item in the batch has a pixel here.
            if (res.status === 204 || res.status === 404) return
            if (!res.ok)
                throw new TimeSeriesHttpError('Point query', res.status)
            parsePointResponse(await res.json(), collection).forEach((v, k) =>
                merged.set(k, v)
            )
        }
    )
    return merged
}

/**
 * What one band of one acquisition holds:
 *  - a finite number                      -> { value, status: 'ok' }
 *  - null (a masked pixel)                -> { value: null, status: 'nodata' }
 *  - absent (no such band was returned)   -> { value: null, status: 'missing' }
 *  - anything else (NaN, ±Infinity, text) -> { value: null, status: 'invalid' }
 */
export function readValue(values, band) {
    if (!Array.isArray(values) || band >= values.length)
        return { value: null, status: 'missing' }
    const raw = values[band]
    if (raw === null) return { value: null, status: 'nodata' }
    if (raw === undefined) return { value: null, status: 'missing' }
    if (typeof raw === 'number' && Number.isFinite(raw))
        return { value: raw, status: 'ok' }
    return { value: null, status: 'invalid' }
}

/**
 * The scale factor and units the Identifier shows for this layer: those
 * configured on the Identifier tool for it, else the layer's cogUnits.
 */
export function resolveMeasurement(layer, identifierConfig) {
    const sf = Number.parseFloat(identifierConfig?.scalefactor)
    const units =
        identifierConfig?.unit ??
        identifierConfig?.units ??
        layer.cogUnits ??
        ''
    return { scalefactor: Number.isFinite(sf) ? sf : 1, units }
}

const unitFor = (units, bandIndex) =>
    Array.isArray(units) ? (units[bandIndex] ?? '') : units || ''

/**
 * Turn items + their point values into chart series, one per band.
 *
 * Every acquisition keeps its place on the time axis in every band. One with
 * no usable reading - nodata, an item TiTiler returned nothing for, a band it
 * didn't return, or a non-finite value - is a null point whose status says
 * which, so the chart shows a gap there rather than a line drawn across it,
 * and never a zero.
 *
 * Observations are ordered by time, then item id, so items sharing a
 * timestamp always appear in the same order.
 */
export function buildSeries(items, valuesById, measurement = {}) {
    const scalefactor = Number.isFinite(measurement.scalefactor)
        ? measurement.scalefactor
        : 1
    const sorted = [...items].sort(
        (a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )

    // Band names from the response that named the most; positional names
    // fill in only where no response named a band.
    let bandNames = []
    let widest = 0
    for (const it of sorted) {
        const v = valuesById.get(it.id)
        if (!v) continue
        if (v.bandNames.length > bandNames.length) bandNames = v.bandNames
        widest = Math.max(widest, v.values.length)
    }
    if (bandNames.length < widest)
        bandNames = Array.from(
            { length: widest },
            (_, i) => bandNames[i] || `b${i + 1}`
        )
    // No item returned anything: still one series, of gaps, so the
    // acquisitions show as times without readings.
    if (bandNames.length === 0) bandNames = ['b1']

    const counts = { missing: 0, missingBands: 0, invalidValues: 0, nodata: 0 }
    const series = bandNames.map((name, b) => ({
        name,
        units: unitFor(measurement.units, b),
        points: [],
    }))
    for (const it of sorted) {
        const v = valuesById.get(it.id)
        if (!v) counts.missing++
        for (let b = 0; b < series.length; b++) {
            const read = v
                ? readValue(v.values, b)
                : { value: null, status: 'missing' }
            if (v && read.status === 'missing') counts.missingBands++
            else if (read.status === 'invalid') counts.invalidValues++
            else if (read.status === 'nodata') counts.nodata++
            // A finite reading times the scale factor can overflow to
            // ±Infinity; that is not a value that can be plotted.
            let value = read.value === null ? null : read.value * scalefactor
            let status = read.status
            if (value !== null && !Number.isFinite(value)) {
                value = null
                status = 'invalid'
                counts.invalidValues++
            }
            series[b].points.push({
                time: it.time,
                value,
                status,
                itemId: it.id,
                range: it.range,
            })
        }
    }

    let duplicateTimes = 0
    for (let i = 1; i < sorted.length; i++)
        if (sorted[i].time === sorted[i - 1].time) duplicateTimes++

    const withValue = series.reduce(
        (n, s) => n + s.points.filter((p) => p.status === 'ok').length,
        0
    )
    return { series, ...counts, duplicateTimes, withValue }
}

/**
 * One layer's history at a point.
 *
 * @returns {Promise<object>} `{ status: 'ok' | 'empty' | 'error', series,
 *   notes: string[], message }`. Aborts reject with an AbortError.
 */
export async function fetchLayerTimeSeries({
    layer,
    lng,
    lat,
    fetchFn,
    location,
    nodeEnv,
    stacOptions = {},
    identifierConfig,
    signal,
    limits = TIME_SERIES_LIMITS,
}) {
    const endpoints = resolveStacEndpoints(layer.url, location, nodeEnv)
    if (!endpoints)
        return {
            status: 'error',
            message: "Couldn't parse the STAC collection URL.",
        }
    const datetime = buildDatetimeParam(layer.time)

    let listing
    try {
        listing = await fetchStacItems({
            fetchFn,
            stacBase: endpoints.stacBase,
            collection: endpoints.collection,
            lng,
            lat,
            datetime,
            signal,
            limits,
        })
    } catch (e) {
        if (e?.name === 'AbortError') throw e
        return {
            status: 'error',
            message: `Couldn't read acquisition times from the STAC API (${
                e?.message || 'request failed'
            }).`,
        }
    }

    const notes = []
    if (listing.invalidTimes > 0)
        notes.push(
            `${listing.invalidTimes} item${
                listing.invalidTimes === 1 ? '' : 's'
            } skipped: no valid acquisition time.`
        )
    if (listing.truncated)
        notes.push(
            `Showing ${listing.items.length}${
                listing.numberMatched != null
                    ? ` of ${listing.numberMatched}`
                    : ''
            } matching items (limit ${limits.maxItems}).`
        )
    if (listing.items.length === 0)
        return {
            status: 'empty',
            message:
                'No acquisitions cover this point in the selected time range.',
            notes,
        }

    let values
    try {
        values = await fetchPointValues({
            fetchFn,
            titilerBase: endpoints.titilerBase,
            collection: endpoints.collection,
            lng,
            lat,
            ids: listing.items.map((it) => it.id),
            layer,
            stacOptions,
            signal,
            limits,
        })
    } catch (e) {
        if (e?.name === 'AbortError') throw e
        return {
            status: 'error',
            message: `Couldn't read values at this point (${
                e?.message || 'request failed'
            }).`,
            notes,
        }
    }

    const built = buildSeries(
        listing.items,
        values,
        resolveMeasurement(layer, identifierConfig)
    )
    const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
    if (built.missing > 0)
        notes.push(
            `${count(built.missing, 'acquisition', 'acquisitions')} returned no reading here (gaps).`
        )
    if (built.missingBands > 0)
        notes.push(
            `${count(built.missingBands, 'band reading was', 'band readings were')} not returned (gaps).`
        )
    if (built.invalidValues > 0)
        notes.push(
            `${count(built.invalidValues, 'non-numeric value', 'non-numeric values')} shown as gaps.`
        )
    if (built.duplicateTimes > 0)
        notes.push(
            `${count(built.duplicateTimes, 'acquisition shares', 'acquisitions share')} a timestamp with another item.`
        )

    if (built.withValue === 0)
        return {
            status: 'empty',
            message:
                built.nodata > 0 &&
                built.missing + built.missingBands + built.invalidValues === 0
                    ? 'Every acquisition here is nodata.'
                    : 'No usable values could be read at this point.',
            notes,
        }
    return {
        status: 'ok',
        series: built.series,
        notes,
        expression: buildBandParams(layer).expression,
    }
}

/**
 * Hands out request tokens so a slow response for an old click can't
 * overwrite a newer one, and aborts the old click's requests.
 */
export function createRequestGuard(
    AbortControllerImpl = typeof AbortController !== 'undefined'
        ? AbortController
        : null
) {
    let generation = 0
    let controller = null
    return {
        begin() {
            if (controller) controller.abort()
            controller = AbortControllerImpl ? new AbortControllerImpl() : null
            const id = ++generation
            return {
                id,
                signal: controller ? controller.signal : undefined,
                isCurrent: () => id === generation,
            }
        },
        cancel() {
            generation++
            if (controller) controller.abort()
            controller = null
        },
    }
}

/**
 * Cache key for one layer's history at one point, time window, band
 * selection and measurement (scale factor and units are applied to the
 * cached values, so a change to either must not reuse them).
 */
export function cacheKey(layerUUID, layer, lng, lat, identifierConfig) {
    const band = buildBandParams(layer)
    const m = resolveMeasurement(layer, identifierConfig)
    return [
        layerUUID,
        layer.url,
        lng.toFixed(7),
        lat.toFixed(7),
        buildDatetimeParam(layer.time),
        band.assets,
        band.expression || '',
        m.scalefactor,
        JSON.stringify(m.units),
    ].join('|')
}
