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
    getAppBaseUrl,
    parseExternalStacUrl,
    formatStacBidx,
    normalizeTitilerExpression,
} from '../../../../src/essence/Basics/Layers_/LayerUtils.js'
import { unitForBand } from './IdentifierValueFormat.js'

export const TIME_SERIES_LIMITS = {
    // Most STAC items charted for one point and layer. Bounds the work a
    // single click can cause; the panel says when a history was cut short.
    maxItems: 500,
    // STAC search page size.
    stacPageSize: 100,
    // Items per TiTiler point request (also its items_limit).
    pointBatchSize: 50,
    // Requests in flight at once for one selected point, across every layer
    // charted there (STAC pages and TiTiler point batches alike).
    requestConcurrency: 4,
    // One request (a STAC page or a point batch), from sending it to having
    // parsed its body, taking longer than this is given up on and reported as
    // an error, so a hung server or a stalled body can't leave a chart
    // loading forever. MMGIS's titiler-pgstac proxy stops at 30 s.
    requestTimeoutMs: 60000,
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
 * Local collections use this MMGIS's /titilerpgstac and /stac proxies, at
 * the same proxy-aware base the map's tiles use (LayerUtils.getAppBaseUrl).
 * External ones (`stac-collection:https://host/titilerpgstac/collections/c`)
 * only name their TiTiler, so the STAC API is taken to be the sibling
 * `https://host/stac` - the layout every MMGIS deployment exposes. If it isn't
 * there the layer reports that it couldn't read acquisition times.
 *
 * @returns {{titilerBase: string, stacBase: string, collection: string, external: boolean} | null}
 */
export function resolveStacEndpoints(url, location) {
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
    const base = getAppBaseUrl(location)
    if (!collection || base == null) return null
    return {
        titilerBase: `${base}/titilerpgstac`,
        stacBase: `${base}/stac`,
        collection,
        external: false,
    }
}

/**
 * A frozen copy of everything about a layer that decides what a history
 * query asks for and how its values read. A history is fetched over several
 * awaits; the layer object itself can change meanwhile (an expression
 * applied or reset, a new time window), so the cache key, the STAC and
 * TiTiler requests and the chart's labels must all come from one snapshot
 * taken before the first request.
 */
export function snapshotLayerQuery(layer) {
    const copy = (v) => (Array.isArray(v) ? [...v] : v)
    return Object.freeze({
        type: layer.type,
        url: layer.url,
        time: Object.freeze({
            enabled: layer.time?.enabled === true,
            start: layer.time?.start ?? '',
            end: layer.time?.end ?? '',
        }),
        cogExpression: layer.cogExpression ?? null,
        currentCogExpression: layer.currentCogExpression ?? null,
        cogBandsQuery: Object.freeze(copy(layer.cogBandsQuery) ?? null),
        cogUnits: Object.freeze(copy(layer.cogUnits) ?? null),
    })
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
 * @returns {{id: string, time: number, range: [number, number]|null} | null}
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
        // Kept as instants (ms since the epoch, UTC) like `time`, never as
        // the item's strings, so every view writes them in UTC whatever
        // offset the item used. An end that's invalid or before the start
        // gives no interval rather than a wrong one.
        return {
            id: feature.id,
            time: start,
            range: end != null && end >= start ? [start, end] : null,
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
 * `truncated` means fewer items were read than the server holds, and
 * `truncatedBy` says why: 'items' (our maxItems bound), 'pages' (our
 * maxStacPages bound, with a next page still offered) or 'count' (the
 * server's numberMatched exceeds the distinct items its pages returned). A
 * server count that every item has been read overrides a page-bound guess.
 * `incomplete` lists reasons the server may hold items that were not read:
 * a next link whose token can't be found, a repeated token, or a full page
 * with no next link and no count to show it was the last.
 *
 * @returns {Promise<{items: Array, numberMatched: number|null, truncated: boolean, truncatedBy: 'items'|'pages'|'count'|null, invalidTimes: number, incomplete: string[]}>}
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
    run = createLimiter(limits.requestConcurrency),
}) {
    const items = []
    const seen = new Set()
    const incomplete = []
    let invalidTimes = 0
    let numberMatched = null
    let token = null
    let truncatedBy = null
    const seenTokens = new Set()

    for (let page = 0; page < limits.maxStacPages; page++) {
        const remaining = limits.maxItems - items.length
        const pageLimit = Math.min(limits.stacPageSize, Math.max(remaining, 1))
        const pageToken = token
        const json = await run(() =>
            runRequest({
                fetchFn,
                url: buildStacSearchUrl(
                    stacBase,
                    collection,
                    lng,
                    lat,
                    datetime,
                    pageLimit,
                    pageToken
                ),
                init: {
                    headers: {
                        accept: 'application/geo+json, application/json',
                    },
                },
                signal,
                timeoutMs: limits.requestTimeoutMs,
                read: (res) => {
                    if (!res.ok)
                        throw new TimeSeriesHttpError('STAC search', res.status)
                    return res.json()
                },
            })
        )
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
                truncatedBy = 'items'
                break
            }
            seen.add(parsed.id)
            items.push(parsed)
        }
        if (truncatedBy) break

        const hasNextLink = (json.links || []).some((l) => l?.rel === 'next')
        token = nextPageToken(json)
        if (!token) {
            if (hasNextLink)
                incomplete.push(
                    'the STAC API offered a next page in a form that could not be followed'
                )
            else if (
                json.features.length >= pageLimit &&
                numberMatched == null &&
                items.length < limits.maxItems
            )
                incomplete.push(
                    'the STAC API returned a full page without a next link'
                )
            break
        }
        if (json.features.length === 0) break
        if (items.length >= limits.maxItems) {
            truncatedBy = 'items'
            break
        }
        if (seenTokens.has(token)) {
            incomplete.push('the STAC API repeated a page token')
            token = null
            break
        }
        seenTokens.add(token)
        // Out of pages with a next page still offered: say so.
        if (page === limits.maxStacPages - 1) truncatedBy = 'pages'
    }
    // Distinct matches read. A repeated item is not a second match: counting
    // it would let overlapping pages pass for a complete history.
    const accounted = items.length + invalidTimes
    if (numberMatched != null) {
        // The server's count settles it: everything read, or not.
        if (accounted >= numberMatched) truncatedBy = null
        else if (!truncatedBy) truncatedBy = 'count'
    }
    return {
        items,
        numberMatched,
        truncated: truncatedBy != null,
        truncatedBy,
        invalidTimes,
        incomplete,
    }
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

/**
 * A titiler-pgstac `/collections/{id}/point/{lng},{lat}` URL: the one
 * request contract the Identifier's hover readout and its histories share.
 *
 * @param {object} opts
 * @param {string[]} [opts.ids] - read exactly these items (history); its
 *   items_limit is then the number of ids, and a configured scan_limit is
 *   raised to at least that many so pgSTAC can't stop before reaching them
 * @param {number} [opts.itemsLimit] - without ids (hover): the mosaic's
 *   items_limit (TiTiler's default 100)
 * @param {string|null} [opts.datetime] - without ids: the layer's window
 * @param {object} [opts.stacOptions] - mmgisglobal.options.stac
 */
export function buildPointUrl(
    titilerBase,
    collection,
    lng,
    lat,
    layer,
    opts = {}
) {
    const stacOptions = opts.stacOptions || {}
    const band = buildBandParams(layer)
    // The `|` and `=` inside assets are sent as-is, as the tiles send them.
    let qs = `assets=${band.assets}`
    let itemsLimit = opts.itemsLimit ?? stacOptions.mosaicItemLimit ?? 100
    let scanLimit = stacOptions.mosaicScanLimit
    if (Array.isArray(opts.ids)) {
        qs += `&ids=${opts.ids.map((id) => encodeURIComponent(id)).join(',')}`
        itemsLimit = opts.ids.length
        if (scanLimit != null) scanLimit = Math.max(scanLimit, opts.ids.length)
    }
    qs += `&items_limit=${itemsLimit}`
    if (scanLimit != null) qs += `&scan_limit=${scanLimit}`
    if (stacOptions.mosaicTimeLimit != null)
        qs += `&time_limit=${stacOptions.mosaicTimeLimit}`
    if (!Array.isArray(opts.ids) && opts.datetime)
        qs += `&datetime=${encodeURIComponent(opts.datetime)}`
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

const abortError = () =>
    Object.assign(new Error('The request was cancelled.'), {
        name: 'AbortError',
    })

/**
 * One HTTP request, start to finish - the fetch, reading the body and
 * parsing it (`read(res)`) - under one time limit and one cancellation.
 *
 *  - The caller's `signal` cancels it at any point, the body read included:
 *    it rejects with an AbortError, which callers drop silently.
 *  - Past `timeoutMs` it is aborted and rejects with a TimeoutError, an
 *    ordinary failure that is reported and retried.
 *  - It settles as soon as either happens, even if the response body
 *    ignores the abort, so a stalled body can't hold a concurrency slot or
 *    leave a chart loading. The abandoned work is sent the abort; a fetch or
 *    body that ignores it may still run to the end, but whatever it then
 *    returns or throws is discarded (the race has already settled), and a
 *    late rejection is swallowed rather than left unhandled.
 *  - The timer and the listener on the caller's signal are always removed.
 *  - An error thrown while the request is aborted is reported as the abort
 *    (cancellation or timeout), never as e.g. "not JSON".
 */
export function runRequest({
    fetchFn,
    url,
    init = {},
    signal,
    timeoutMs,
    read,
}) {
    if (signal?.aborted) return Promise.reject(abortError())
    const controller = new AbortController()
    let timedOut = false
    const reason = () =>
        timedOut && !signal?.aborted
            ? Object.assign(
                  new Error(
                      `request timed out after ${Math.round(timeoutMs / 1000)} s`
                  ),
                  { name: 'TimeoutError' }
              )
            : abortError()
    let rejectAborted
    const aborted = new Promise((_, reject) => {
        rejectAborted = reject
    })
    const onAbort = () => {
        controller.abort()
        rejectAborted(reason())
    }
    signal?.addEventListener('abort', onAbort)
    const timer =
        Number.isFinite(timeoutMs) && timeoutMs > 0
            ? setTimeout(() => {
                  timedOut = true
                  onAbort()
              }, timeoutMs)
            : null
    const work = Promise.resolve()
        .then(() => fetchFn(url, { ...init, signal: controller.signal }))
        .then((res) => read(res))
        .catch((e) => {
            throw controller.signal.aborted ? reason() : e
        })
    // whichever loses the race must not surface as an unhandled rejection
    work.catch(() => {})
    aborted.catch(() => {})
    return Promise.race([work, aborted]).finally(() => {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        // ask anything still running (a stalled body) to stop; this only
        // signals it - work that ignores the signal is left to finish, and
        // its outcome goes nowhere
        if (!controller.signal.aborted) controller.abort()
    })
}

/**
 * A concurrency limit shared by every request one point selection makes,
 * across all its layers: `run(task)` starts `task` when fewer than `limit`
 * tasks are running, else queues it. The limiter knows nothing of
 * cancellation: a queued task checks its own abort signal when it starts
 * (fetchPointValues does; a STAC page's fetch rejects on an aborted signal).
 */
export function createLimiter(limit) {
    let active = 0
    const queue = []
    const release = () => {
        active--
        pump()
    }
    function pump() {
        while (active < limit && queue.length > 0) {
            const { task, resolve, reject } = queue.shift()
            active++
            Promise.resolve().then(task).then(resolve, reject).finally(release)
        }
    }
    const run = (task) =>
        new Promise((resolve, reject) => {
            queue.push({ task, resolve, reject })
            pump()
        })
    run.active = () => active
    run.queued = () => queue.length
    return run
}

/**
 * Whether a 404 from the point endpoint says "no item has a pixel here" -
 * older titiler-pgstac answered NoAssetFound with 404 and a detail naming
 * it. Any other 404 (a missing route, a wrong collection or proxy path) is
 * a failure, not an absence of data.
 */
export function isNoAssetDetail(body) {
    const detail = body && typeof body === 'object' ? body.detail : undefined
    return (
        typeof detail === 'string' && /no (assets?|items?) found/i.test(detail)
    )
}

/**
 * One point request for a batch of items. Resolves to the readings by item
 * id; an empty map only when TiTiler said explicitly that none of them has a
 * pixel here. Throws (so nothing is cached and the next click retries) on a
 * generic 404, any other error status, or a 200 without an `assets` list.
 */
function readPointBatch({ fetchFn, url, signal, collection, timeoutMs }) {
    return runRequest({
        fetchFn,
        url,
        init: { headers: { accept: 'application/json' } },
        signal,
        timeoutMs,
        read: (res) => readPointResponse(res, collection),
    })
}

async function readPointResponse(res, collection) {
    // titiler-pgstac 3.x: NoAssetFound -> 204 No Content.
    if (res.status === 204) return new Map()
    if (res.status === 404) {
        let body = null
        try {
            body = await res.json()
        } catch (e) {
            body = null
        }
        if (isNoAssetDetail(body)) return new Map()
        throw new TimeSeriesHttpError('Point query', 404)
    }
    if (!res.ok) throw new TimeSeriesHttpError('Point query', res.status)
    let json
    try {
        json = await res.json()
    } catch (e) {
        throw new Error('Point query returned a response that is not JSON')
    }
    if (!json || !Array.isArray(json.assets))
        throw new Error('Point query returned no assets list')
    return parsePointResponse(json, collection)
}

/**
 * Values at the point for the given items, by item id.
 *
 * Items a batch returned nothing for are asked for once more, in their own
 * batches: pgSTAC's time limit can end a search early without saying so,
 * and a second, smaller search tells that apart from an item that simply has
 * no pixel here. Only items still absent after that are "no reading".
 */
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
    run = createLimiter(limits.requestConcurrency),
}) {
    const merged = new Map()
    // Once one batch has failed the result is an error: batches still queued
    // behind it (in the shared limiter) are not started, and the ones in
    // flight are cancelled - through this call's own signal, which follows
    // the caller's but never aborts it - so they stop holding shared slots.
    let failed = false
    const batchCtrl = new AbortController()
    const followCaller = () => batchCtrl.abort()
    if (signal?.aborted) batchCtrl.abort()
    else signal?.addEventListener('abort', followCaller)
    const readAll = async (wanted) => {
        const batches = []
        for (let i = 0; i < wanted.length; i += limits.pointBatchSize)
            batches.push(wanted.slice(i, i + limits.pointBatchSize))
        await Promise.all(
            batches.map((batch) =>
                run(async () => {
                    if (signal?.aborted)
                        throw Object.assign(new Error('aborted'), {
                            name: 'AbortError',
                        })
                    if (failed) return
                    try {
                        const got = await readPointBatch({
                            fetchFn,
                            url: buildPointUrl(
                                titilerBase,
                                collection,
                                lng,
                                lat,
                                layer,
                                { ids: batch, stacOptions }
                            ),
                            signal: batchCtrl.signal,
                            collection,
                            timeoutMs: limits.requestTimeoutMs,
                        })
                        got.forEach((v, k) => merged.set(k, v))
                    } catch (e) {
                        if (!failed) {
                            failed = true
                            batchCtrl.abort()
                        }
                        throw e
                    }
                })
            )
        )
    }
    try {
        await readAll(ids)
        const absent = ids.filter((id) => !merged.has(id))
        if (absent.length > 0) await readAll(absent)
        return merged
    } finally {
        signal?.removeEventListener('abort', followCaller)
    }
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
 * The units a STAC layer's values are shown in, and their scale: the same as
 * the Identifier's hover readout for STAC layers - the raw TiTiler value in
 * the layer's `cogUnits` (one per band when it is a list). A reading keeps
 * the same value and unit in the hover and in the chart.
 */
export function resolveMeasurement(layer) {
    return { scalefactor: 1, units: layer?.cogUnits ?? '' }
}

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
        units: unitForBand(measurement.units, b),
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
 * @param {object} args
 * @param {object} args.query - snapshotLayerQuery(layer); the live layer is
 *   also accepted (as `layer`) and snapshotted here
 * @param {Function} [args.run] - a shared limiter (createLimiter) for every
 *   request of this point selection
 * @returns {Promise<object>} `{ status: 'ok' | 'empty' | 'error', series,
 *   notes: string[], incomplete: string[], message, query }`. Aborts reject
 *   with an AbortError.
 */
export async function fetchLayerTimeSeries({
    query,
    layer,
    lng,
    lat,
    fetchFn,
    location,
    stacOptions = {},
    signal,
    limits = TIME_SERIES_LIMITS,
    run,
}) {
    const q = query || snapshotLayerQuery(layer)
    const limiter = run || createLimiter(limits.requestConcurrency)
    const endpoints = resolveStacEndpoints(q.url, location)
    if (!endpoints)
        return {
            status: 'error',
            message: "Couldn't parse the STAC collection URL.",
            query: q,
        }
    const datetime = buildDatetimeParam(q.time)

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
            run: limiter,
        })
    } catch (e) {
        if (e?.name === 'AbortError') throw e
        return {
            status: 'error',
            message: `Couldn't read acquisition times from the STAC API (${
                e?.message || 'request failed'
            }).`,
            query: q,
        }
    }

    const notes = []
    const incomplete = [...listing.incomplete]
    // Cut short by our own bound (maxItems / maxStacPages): the same request
    // gives the same answer, so the result - which keeps its note - may be
    // cached. Incomplete because of what the server sent (a next link that
    // can't be followed, a repeated token, a count its pages don't reach):
    // may differ next time, so it is not cached and the next click re-reads.
    const cacheable =
        listing.incomplete.length === 0 && listing.truncatedBy !== 'count'
    if (listing.invalidTimes > 0)
        notes.push(
            `${listing.invalidTimes} item${
                listing.invalidTimes === 1 ? '' : 's'
            } skipped: no valid acquisition time.`
        )
    if (listing.truncated) {
        const shown = `showing ${listing.items.length}${
            listing.numberMatched != null ? ` of ${listing.numberMatched}` : ''
        } matching items`
        incomplete.push(
            listing.truncatedBy === 'items'
                ? `${shown} (limit ${limits.maxItems})`
                : listing.truncatedBy === 'pages'
                  ? `${shown}: stopped after ${limits.maxStacPages} STAC pages with more on offer`
                  : `${shown}: the STAC API counted more items than its pages returned`
        )
    }
    if (listing.items.length === 0)
        return {
            status: 'empty',
            // nothing to list, as opposed to 'all-gaps' below
            kind: 'no-acquisitions',
            message:
                'No acquisitions cover this point in the selected time range.',
            notes,
            incomplete,
            cacheable,
            query: q,
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
            layer: q,
            stacOptions,
            signal,
            limits,
            run: limiter,
        })
    } catch (e) {
        if (e?.name === 'AbortError') throw e
        return {
            status: 'error',
            message: `Couldn't read values at this point (${
                e?.message || 'request failed'
            }).`,
            notes,
            incomplete,
            query: q,
        }
    }

    const built = buildSeries(listing.items, values, resolveMeasurement(q))
    const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
    if (built.missing > 0)
        notes.push(
            `${count(built.missing, 'acquisition', 'acquisitions')} returned no reading here, asked twice (gaps).`
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
            // Acquisitions exist but none has a usable value here. Their
            // ids, times and why each has no value are kept, for the
            // readings table; there's no line to draw.
            kind: 'all-gaps',
            series: built.series,
            message:
                built.nodata > 0 &&
                built.missing + built.missingBands + built.invalidValues === 0
                    ? 'Every acquisition here is nodata.'
                    : 'No usable values could be read at this point.',
            notes,
            incomplete,
            cacheable,
            query: q,
        }
    return {
        status: 'ok',
        series: built.series,
        notes,
        incomplete,
        cacheable,
        expression: buildBandParams(q).expression,
        query: q,
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
 * Cache key for one layer's history at one point: built from the same
 * snapshot the requests use (snapshotLayerQuery), so a result is only ever
 * stored under the inputs that produced it.
 */
export function cacheKey(layerUUID, query, lng, lat) {
    const band = buildBandParams(query)
    return [
        layerUUID,
        query.url,
        lng.toFixed(7),
        lat.toFixed(7),
        buildDatetimeParam(query.time),
        band.assets,
        band.expression || '',
        JSON.stringify(resolveMeasurement(query).units),
    ].join('|')
}
