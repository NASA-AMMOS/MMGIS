import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'

const AREA_PRESETS = {
    'beaufort sea': {
        label: 'Beaufort Sea',
        bbox: [-160, 70, -120, 76],
    },
    'gulf of mexico': {
        label: 'Gulf of Mexico',
        bbox: [-97.5, 18.0, -80.5, 30.5],
    },
    'great lakes': {
        label: 'Great Lakes',
        bbox: [-92.5, 41.0, -75.0, 49.0],
    },
}

const CURRENT_VIEW_ALIASES = new Set([
    'current view',
    'current map',
    'current extent',
    'map view',
    'map',
    'view',
])

const AREA_RESOLUTION_CACHE = new Map()
const AREA_RESOLUTION_INFLIGHT = new Map()

function appendLine(text) {
    if (typeof window.__mmgisAgentChatAppend === 'function') {
        window.__mmgisAgentChatAppend(String(text))
        return
    }
    const $tx = $('#agentChatTranscript')
    if (!$tx.length) throw new Error('Agent chat transcript element not found.')
    const div = $(`<div style='margin:4px 0;white-space:pre-wrap'></div>`).text(
        String(text)
    )
    $tx.append(div)
    $tx.scrollTop($tx[0].scrollHeight)
}

function normalizeName(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function levenshtein(a, b) {
    const m = a.length
    const n = b.length
    if (m === 0) return n
    if (n === 0) return m
    const dp = Array.from({ length: m + 1 }, () =>
        new Array(n + 1).fill(0)
    )
    for (let i = 0; i <= m; i += 1) dp[i][0] = i
    for (let j = 0; j <= n; j += 1) dp[0][j] = j
    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
        }
    }
    return dp[m][n]
}

function scoreSimilarity(queryNorm, candidateNorm) {
    if (!queryNorm) return 0
    if (queryNorm === candidateNorm) return 1
    if (candidateNorm.includes(queryNorm))
        return Math.max(
            0.8,
            queryNorm.length / Math.max(candidateNorm.length, 1)
        )
    if (queryNorm.includes(candidateNorm))
        return Math.max(
            0.7,
            candidateNorm.length / Math.max(queryNorm.length, 1)
        )
    const dist = levenshtein(queryNorm, candidateNorm)
    const maxLen = Math.max(queryNorm.length, candidateNorm.length, 1)
    return Math.max(0, 1 - dist / maxLen)
}

const ANALYTICS_DEFAULT_BASE = null
let analyticsLayerCatalogPromise = null

function getAnalyticsBaseUrl() {
    const override =
        (window?.frozonAnalyticsBase &&
            String(window.frozonAnalyticsBase).trim()) ||
        (window?.mmgisglobal?.FROZON_ANALYTICS_BASE_URL &&
            String(window.mmgisglobal.FROZON_ANALYTICS_BASE_URL).trim()) ||
        (window?.mmgisglobal?.ANALYTICS_BASE_URL &&
            String(window.mmgisglobal.ANALYTICS_BASE_URL).trim())
    const root = (window?.mmgisglobal?.ROOT_PATH || '').replace(/\/+$/, '')
    const base =
        override && override.length
            ? override
            : `${root}/api/agent/analytics`
    return base.replace(/\/+$/, '')
}

function buildAnalyticsUrl(path) {
    const safePath = String(path || '').replace(/^\/+/, '')
    return `${getAnalyticsBaseUrl()}/${safePath}`
}

async function fetchAnalyticsLayerCatalog() {
    if (analyticsLayerCatalogPromise) return analyticsLayerCatalogPromise
    const url = buildAnalyticsUrl('layers')
    analyticsLayerCatalogPromise = fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => {
            if (!res.ok) {
                throw new Error(
                    `Analytics catalog request failed (${res.status})`
                )
            }
            return res.json()
        })
        .catch((error) => {
            analyticsLayerCatalogPromise = null
            throw error
        })
    return analyticsLayerCatalogPromise
}

function gatherAnalyticsAliases(key, info, layerConfig) {
    const values = new Set()
    const push = (value) => {
        if (typeof value === 'string' && value.trim()) values.add(value.trim())
    }
    const pushPath = (value) => {
        if (typeof value !== 'string' || !value.trim()) return
        push(value)
        const parts = value.split(/[\\/]/)
        const file = parts[parts.length - 1]
        if (file) {
            push(file)
            const withoutExt = file.replace(/\.[^.]+$/, '')
            if (withoutExt !== file) push(withoutExt)
            push(file.replace(/[_-]+/g, ' '))
            push(withoutExt.replace(/[_-]+/g, ' '))
        }
    }
    push(key)
    if (info) {
        push(info.name)
        push(info.display_name)
        push(info.displayName)
        push(info.title)
        if (Array.isArray(info.aliases)) info.aliases.forEach(push)
        if (Array.isArray(info.alias)) info.alias.forEach(push)
        if (Array.isArray(info.tags)) info.tags.forEach(push)
        if (info.path) pushPath(info.path)
        if (info.dataset) push(info.dataset)
    }
    if (layerConfig) {
        push(layerConfig.name)
        push(layerConfig.display_name)
        push(layerConfig.displayName)
        push(layerConfig.title)
        if (Array.isArray(layerConfig.aliases))
            layerConfig.aliases.forEach(push)
        else if (typeof layerConfig.alias === 'string') {
            layerConfig.alias
                .split(/[,;]+/)
                .map((a) => a.trim())
                .filter(Boolean)
                .forEach(push)
        }
        if (layerConfig.url) pushPath(layerConfig.url)
        if (layerConfig.cogUrl) pushPath(layerConfig.cogUrl)
        if (layerConfig.source) pushPath(layerConfig.source)
    }
    return Array.from(values)
}

async function resolveAnalyticsLayerKey(layerName, layerConfig) {
    try {
        const catalog = await fetchAnalyticsLayerCatalog()
        const layersRaw = catalog?.layers
        const entries = []
        if (Array.isArray(layersRaw)) {
            layersRaw.forEach((info) => {
                if (!info || typeof info !== 'object') return
                const key =
                    (typeof info.name === 'string' && info.name) ||
                    (typeof info.id === 'string' && info.id) ||
                    (typeof info.dataset === 'string' && info.dataset) ||
                    null
                entries.push({ key, info })
            })
        } else if (layersRaw && typeof layersRaw === 'object') {
            Object.keys(layersRaw).forEach((key) => {
                entries.push({ key, info: layersRaw[key] })
            })
        }
        if (!entries.length) return null
        const targetNorm = normalizeName(layerName)
        if (!targetNorm) return null
    let best = null
    let bestScore = 0
    entries.forEach(({ key, info }) => {
        const candidates = gatherAnalyticsAliases(key, info, layerConfig)
        candidates.forEach((candidate) => {
            const candidateNorm = normalizeName(candidate)
            if (!candidateNorm) return
            const score = scoreSimilarity(targetNorm, candidateNorm)
            if (score > bestScore) {
                bestScore = score
                best = { key, info }
            }
        })
    })
    if (!best) {
        if (entries.length === 1) {
            best = entries[0]
            bestScore = 0
        } else {
            return null
        }
    }
    const MIN_SCORE = 0.32
    if (bestScore < MIN_SCORE && entries.length > 1) {
        return {
            key:
                (typeof best.key === 'string' && best.key) ||
                (best.info && typeof best.info.name === 'string'
                    ? best.info.name
                    : null) ||
                null,
            info: best.info,
            confidence: bestScore,
        }
    }
    let resolvedKey =
        (typeof best.key === 'string' && best.key) ||
        (best.info && typeof best.info.name === 'string'
            ? best.info.name
            : null) ||
        null
    if (!resolvedKey && best.info?.dataset) {
        resolvedKey = best.info.dataset
    }
        if (!resolvedKey && typeof best.info?.path === 'string') {
            const parts = best.info.path.split(/[\\/]/)
            resolvedKey = parts[parts.length - 1]?.replace(/\.[^.]+$/, '')
        }
    if (!resolvedKey) {
        if (entries.length === 1) {
            resolvedKey = entries[0].key || entries[0].info?.name || 'default'
        } else {
            return null
        }
    }
    return {
        key: resolvedKey,
        info: best.info,
        confidence: bestScore,
    }
} catch (error) {
    console.error('Failed to resolve analytics layer:', error)
    return null
}
}

async function fetchAnalyticsStatistics(layerKey, bbox, timeRange, layerName) {
    const params = new URLSearchParams()
    if (layerKey) params.set('layer', layerKey)
    if (layerName) params.set('layer_name', layerName)
    if (
        Array.isArray(bbox) &&
        bbox.length === 4 &&
        bbox.every((value) => Number.isFinite(value))
    ) {
        params.set('lon_min', bbox[0])
        params.set('lat_min', bbox[1])
        params.set('lon_max', bbox[2])
        params.set('lat_max', bbox[3])
    }
    if (timeRange && typeof timeRange === 'object') {
        if (timeRange.start) params.set('time_start', timeRange.start)
        if (timeRange.end) params.set('time_end', timeRange.end)
    }
    const url = `${buildAnalyticsUrl('statistics')}?${params.toString()}`
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
        throw new Error(`Analytics statistics failed (${res.status})`)
    }
    return res.json()
}

async function fetchAnalyticsHistogram(
    layerKey,
    bbox,
    timeRange,
    bins = 60,
    layerName
) {
    const params = new URLSearchParams()
    if (layerKey) params.set('ds', layerKey)
    if (layerName) params.set('layer_name', layerName)
    if (timeRange && typeof timeRange === 'object') {
        if (timeRange.start) params.set('startTime', timeRange.start)
        if (timeRange.end) params.set('endTime', timeRange.end)
    }
    if (
        Array.isArray(bbox) &&
        bbox.length === 4 &&
        bbox.every((value) => Number.isFinite(value))
    ) {
        params.set('b', bbox.join(','))
    }
    params.set('bins', String(bins))
    const url = `${buildAnalyticsUrl('histogram/data')}?${params.toString()}`
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
        throw new Error(`Analytics histogram failed (${res.status})`)
    }
    return res.json()
}

function sanitizeHistogramResponse(raw) {
    const edges = Array.isArray(raw?.bin_edges) ? raw.bin_edges : []
    const counts = Array.isArray(raw?.counts) ? raw.counts : []
    if (edges.length !== counts.length + 1 || !counts.length) return null
    const nodata =
        typeof raw?.nodata_value === 'number' ? raw.nodata_value : null
    const filteredCounts = []
    const filteredEdges = []
    for (let i = 0; i < counts.length; i += 1) {
        const c = counts[i]
        const start = edges[i]
        const end = edges[i + 1]
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue
        if (c == null || c <= 0) continue
        if (start === end) continue
        const containsNoData =
            nodata != null &&
            ((nodata >= start && nodata <= end) ||
                (start <= 0 && end >= 0 && nodata === 0))
        if (containsNoData) continue
        if (!filteredEdges.length) filteredEdges.push(start)
        filteredCounts.push(c)
        filteredEdges.push(end)
    }
    if (!filteredCounts.length) return null
    return { binEdges: filteredEdges, counts: filteredCounts }
}

function computeHistogramQuantiles(histogram, percentiles) {
    if (!histogram) return null
    const { binEdges, counts } = histogram
    const total = counts.reduce((sum, c) => sum + c, 0)
    if (!total) return null
    const cumulative = []
    let running = 0
    counts.forEach((c) => {
        running += c
        cumulative.push(running)
    })
    const result = {}
    percentiles.forEach((p) => {
        const target = total * p
        let idx = cumulative.findIndex((value) => value >= target)
        if (idx === -1) idx = cumulative.length - 1
        const lowerCum = idx > 0 ? cumulative[idx - 1] : 0
        const interval = cumulative[idx] - lowerCum
        const start = binEdges[idx]
        const end = binEdges[idx + 1]
        const fraction = interval > 0 ? (target - lowerCum) / interval : 0
        const value = start + fraction * (end - start)
        result[p] = value
    })
    return { total, quantiles: result }
}

function toNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

function latLngBoundsToBbox(bounds) {
    if (!bounds) return null
    const sw =
        typeof bounds.getSouthWest === 'function'
            ? bounds.getSouthWest()
            : bounds._southWest
    const ne =
        typeof bounds.getNorthEast === 'function'
            ? bounds.getNorthEast()
            : bounds._northEast
    if (!sw || !ne) return null
    const west = toNumber(sw.lng)
    const south = toNumber(sw.lat)
    const east = toNumber(ne.lng)
    const north = toNumber(ne.lat)
    if ([west, south, east, north].every((v) => v != null))
        return [west, south, east, north]
    return null
}

function normalizeBoundingBox(raw) {
    if (!raw) return null
    if (Array.isArray(raw) && raw.length >= 4) {
        const west = toNumber(raw[0])
        const south = toNumber(raw[1])
        const east = toNumber(raw[2])
        const north = toNumber(raw[3])
        if ([west, south, east, north].every((v) => v != null))
            return [west, south, east, north]
        return null
    }
    if (typeof raw === 'object') {
        if (raw._southWest && raw._northEast) {
            return latLngBoundsToBbox(raw)
        }
        const west =
            toNumber(raw.west) ??
            toNumber(raw.minLon) ??
            toNumber(raw.minX) ??
            toNumber(raw.xmin)
        const south =
            toNumber(raw.south) ??
            toNumber(raw.minLat) ??
            toNumber(raw.minY) ??
            toNumber(raw.ymin)
        const east =
            toNumber(raw.east) ??
            toNumber(raw.maxLon) ??
            toNumber(raw.maxX) ??
            toNumber(raw.xmax)
        const north =
            toNumber(raw.north) ??
            toNumber(raw.maxLat) ??
            toNumber(raw.maxY) ??
            toNumber(raw.ymax)
        if ([west, south, east, north].every((v) => v != null))
            return [west, south, east, north]
    }
    return null
}

function deriveLayerBoundingBox(layerConfig, layerInstance) {
    let bbox =
        normalizeBoundingBox(layerConfig?.boundingBox) ||
        normalizeBoundingBox(layerConfig?.bounds) ||
        normalizeBoundingBox(layerConfig?.extent) ||
        normalizeBoundingBox(layerConfig?.bbox)
    if (!bbox && layerInstance) {
        if (typeof layerInstance.getBounds === 'function') {
            bbox = normalizeBoundingBox(layerInstance.getBounds())
        } else if (layerInstance.bounds) {
            bbox = normalizeBoundingBox(layerInstance.bounds)
        } else if (layerInstance.options?.bounds) {
            bbox = normalizeBoundingBox(layerInstance.options.bounds)
        }
    }
    return bbox
}

function isValidBbox(bbox) {
    return (
        Array.isArray(bbox) &&
        bbox.length === 4 &&
        bbox.every((value) => Number.isFinite(value)) &&
        bbox[0] < bbox[2] &&
        bbox[1] < bbox[3]
    )
}

function formatBbox(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return 'n/a'
    return bbox
        .map((value) =>
            Number.isFinite(value) ? Number(value).toFixed(4) : 'n/a'
        )
        .join(', ')
}

function buildLayerIndex() {
    const api = window.mmgisAPI
    if (!api) throw new Error('mmgisAPI is not available.')
    const configs = api.getLayerConfigs?.()
    if (!configs || typeof configs !== 'object')
        throw new Error('getLayerConfigs() returned no data.')
    const visibleLookup = api.getVisibleLayers?.() || {}
    const liveLayers = api.getLayers?.() || {}
    const items = []
    const seen = new Set()

    Object.keys(configs).forEach((key) => {
        const layerConfig = configs[key] || {}
        const uuid = String(layerConfig.uuid || key || layerConfig.name || '')
        if (!uuid || seen.has(uuid)) return
        seen.add(uuid)
        const liveInstance =
            liveLayers[uuid] ||
            liveLayers[layerConfig.name] ||
            liveLayers[layerConfig.display_name] ||
            null
        const displayName =
            layerConfig.display_name ||
            layerConfig.displayName ||
            layerConfig.title ||
            layerConfig.name ||
            uuid
        const canonical = layerConfig.name || displayName
        const bbox = deriveLayerBoundingBox(layerConfig, liveInstance)
        const aliases = new Set()
        ;[
            displayName,
            canonical,
            layerConfig.title,
            layerConfig.display_name,
            layerConfig.displayName,
            layerConfig.shortName,
        ].forEach((alias) => {
            if (typeof alias === 'string' && alias.trim())
                aliases.add(alias.trim())
        })
        if (Array.isArray(layerConfig.aliases || layerConfig.alias)) {
            ;(layerConfig.aliases || layerConfig.alias).forEach((alias) => {
                if (typeof alias === 'string' && alias.trim())
                    aliases.add(alias.trim())
            })
        } else if (typeof layerConfig.alias === 'string') {
            layerConfig.alias
                .split(/[,;]+/)
                .map((a) => a.trim())
                .filter(Boolean)
                .forEach((a) => aliases.add(a))
        }
        const normalizedAliases = Array.from(aliases).map((raw) => ({
            raw,
            normalized: normalizeName(raw),
        }))
        items.push({
            id: uuid,
            name: layerConfig.name || uuid,
            displayName,
            canonical,
            visible: !!(
                visibleLookup[uuid] ||
                visibleLookup[key] ||
                (layerConfig.name && visibleLookup[layerConfig.name])
            ),
            bbox,
            normalizedAliases,
            config: layerConfig,
            liveInstance,
        })
    })
    return items
}

function resolveDisplayNameToId(displayName) {
    const items = buildLayerIndex()
    const normalized = normalizeName(displayName)
    const exact = items.find(
        (item) =>
            normalizeName(item.displayName) === normalized ||
            normalizeName(item.canonical) === normalized
    )
    if (exact) return exact.name
    return window.mmgisAPI?.asLayerUUID?.(String(displayName)) || null
}

function findLayerMatch(value, index = null) {
    if (!value) return null
    const list = index || buildLayerIndex()
    const queryNorm = normalizeName(value)
    if (!queryNorm) return null
    let best = null
    let bestScore = 0
    list.forEach((layer) => {
        layer.normalizedAliases.forEach((alias) => {
            if (!alias.normalized) return
            const score = scoreSimilarity(queryNorm, alias.normalized)
            if (score > bestScore) {
                bestScore = score
                best = { layer, alias }
            }
        })
    })
    if (!best) return null
    return {
        displayName: best.layer.displayName,
        id: best.layer.id,
        score: bestScore,
        bbox: Array.isArray(best.layer.bbox)
            ? best.layer.bbox.slice()
            : null,
        layer: best.layer,
    }
}

function ensureMap() {
    const map = window.mmgisAPI?.map
    if (!map) throw new Error('Map instance unavailable.')
    return map
}

function ensureOverlayGroup(key) {
    const map = ensureMap()
    const store =
        (window.__mmgisAgentChatOverlays =
            window.__mmgisAgentChatOverlays || {})
    if (!store[key]) {
        store[key] = window.L.layerGroup().addTo(map)
    } else {
        store[key].clearLayers()
    }
    return store[key]
}

function drawAreaHighlight(area, key, options = {}) {
    const map = ensureMap()
    const group = ensureOverlayGroup(key)
    const color = options.color || '#0ea5e9'
    const style = {
        color,
        weight: options.weight || 1,
        fillColor: color,
        fillOpacity:
            typeof options.fillOpacity === 'number' ? options.fillOpacity : 0.2,
    }
    if (options.dashArray) style.dashArray = options.dashArray

    let combinedBounds = null
    if (area?.geometry) {
        const geoLayer = window.L.geoJSON(area.geometry, {
            style,
        })
        geoLayer.addTo(group)
        try {
            const geomBounds = geoLayer.getBounds()
            if (geomBounds?.isValid?.()) {
                combinedBounds = geomBounds
            }
        } catch (error) {
            console.warn('Failed to derive bounds from geometry:', error)
        }
    }

    const parts =
        Array.isArray(area?.bboxParts) && area.bboxParts.length
            ? area.bboxParts
            : Array.isArray(area?.bbox) && area.bbox.length === 4
              ? [area.bbox]
              : []
    parts.forEach((bbox) => {
        if (!isValidBbox(bbox)) return
        const rectBounds = window.L.latLngBounds(
            window.L.latLng(bbox[1], bbox[0]),
            window.L.latLng(bbox[3], bbox[2])
        )
        const rect = window.L.rectangle(rectBounds, style)
        rect.addTo(group)
        if (combinedBounds) combinedBounds.extend(rectBounds)
        else combinedBounds = rectBounds
    })

    if (combinedBounds?.isValid?.()) {
        map.fitBounds(combinedBounds, { padding: [18, 18] })
    }
    return { group, bounds: combinedBounds }
}

function deterministicNumber(seed, min, max) {
    let hash = 0
    const text = seed.toString()
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i)
        hash |= 0
    }
    const normalized = ((hash >>> 0) % 10000) / 10000
    return min + normalized * (max - min)
}

function captureCurrentViewArea(label) {
    const map = window.mmgisAPI?.map
    if (map) {
        const bounds = map.getBounds()
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
        ]
        return {
            label: label || 'current map view',
            bbox,
            bboxParts: [bbox],
            sourceDomain: 'current map extent',
            method: 'view',
        }
    }
    const bbox = [-180, -90, 180, 90]
    return {
        label: label || 'global extent',
        bbox,
        bboxParts: [bbox],
        sourceDomain: 'global default',
        method: 'fallback',
    }
}

function normalizeRemoteArea(payload, fallbackLabel) {
    if (!payload || !Array.isArray(payload.bbox) || payload.bbox.length !== 4)
        return null
    const bbox = payload.bbox.map((value) => Number(value))
    const parts =
        Array.isArray(payload.bboxParts) && payload.bboxParts.length
            ? payload.bboxParts.map((part) =>
                  Array.isArray(part) ? part.map((v) => Number(v)) : part
              )
            : [bbox]
    return {
        label: payload.label || fallbackLabel || 'selected area',
        bbox,
        bboxParts: parts,
        geometry:
            payload.geometry && typeof payload.geometry === 'object'
                ? payload.geometry
                : null,
        geometryType:
            payload.geometry_type ||
            payload.geometryType ||
            (payload.geometry ? 'polygon' : 'bbox'),
        sourceDomain:
            payload.source_domain || payload.source || payload.method || null,
        sourceUrl: payload.source_url || payload.sourceUrl || null,
        method: payload.method || (payload.geometry ? 'polygon' : 'bbox'),
        bufferKm:
            typeof payload.buffer_km === 'number'
                ? payload.buffer_km
                : typeof payload.bufferKm === 'number'
                  ? payload.bufferKm
                  : null,
    }
}

async function fetchResolvedArea(name) {
    const normalized = normalizeName(name)
    if (AREA_RESOLUTION_CACHE.has(normalized))
        return AREA_RESOLUTION_CACHE.get(normalized)
    if (AREA_RESOLUTION_INFLIGHT.has(normalized))
        return AREA_RESOLUTION_INFLIGHT.get(normalized)

    const root = window.mmgisglobal?.ROOT_PATH || ''
    const url =
        root + '/api/agent/regions/resolve?name=' + encodeURIComponent(name)
    const inflight = fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => {
            if (res.status === 404) return null
            if (!res.ok)
                throw new Error(
                    `Region resolution failed (${res.status || 'unknown'}).`
                )
            return res.json()
        })
        .then((data) => {
            const area = normalizeRemoteArea(data, name)
            AREA_RESOLUTION_CACHE.set(normalized, area)
            return area
        })
        .catch((error) => {
            console.warn('Region resolve failed:', error)
            return null
        })
        .finally(() => {
            AREA_RESOLUTION_INFLIGHT.delete(normalized)
        })

    AREA_RESOLUTION_INFLIGHT.set(normalized, inflight)
    return inflight
}

async function resolveArea(name) {
    const label = (name || '').trim()
    const normalized = normalizeName(label)
    if (!label || CURRENT_VIEW_ALIASES.has(normalized))
        return captureCurrentViewArea(label)
    if (normalized && AREA_PRESETS[normalized]) {
        const preset = AREA_PRESETS[normalized]
        return {
            label: preset.label || label || 'selected area',
            bbox: preset.bbox.slice(),
            bboxParts: [preset.bbox.slice()],
            sourceDomain: 'preset',
            method: 'preset',
        }
    }
    try {
        const resolved = await fetchResolvedArea(label)
        if (resolved) return resolved
    } catch (error) {
        console.warn('Remote area resolution failed:', error)
    }
    return captureCurrentViewArea(label)
}

function formatCitations(citations) {
    if (!Array.isArray(citations) || !citations.length) return ''
    return citations
        .map((c, idx) => {
            const title =
                (c && typeof c.title === 'string' && c.title) ||
                `Source ${idx + 1}`
            const url = c && typeof c.url === 'string' ? c.url : ''
            return `${idx + 1}. ${title}${url ? ` (${url})` : ''}`
        })
        .join('\n')
}

async function fetchLayerMetadata(layerName) {
    const root = window.mmgisglobal?.ROOT_PATH || ''
    const url =
        root + '/api/agent/layer-info?name=' + encodeURIComponent(layerName)
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
    if (res.status === 404) {
        return { items: [], match: null, unavailable: true }
    }
    if (!res.ok) {
        throw new Error(`Layer metadata lookup failed (status ${res.status}).`)
    }
    const data = await res.json()
    return {
        items: Array.isArray(data?.items) ? data.items : [],
        match: data?.match || null,
        unavailable: false,
    }
}

async function searchLayerInformation(layerName, originalQuery) {
    const root = window.mmgisglobal?.ROOT_PATH || ''
    const promptParts = []
    if (originalQuery) promptParts.push(`User asked: "${originalQuery}".`)
    promptParts.push(
        `Provide a concise description of the MMGIS layer "${layerName}".`
    )
    promptParts.push(
        'Use authoritative sources, include at least two citations, and do not call any tools.'
    )
    const message = promptParts.join(' ')
    const res = await fetch(root + '/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    })
    if (!res.ok) {
        throw new Error(`Bing-backed lookup failed (status ${res.status}).`)
    }
    const payload = await res.json()
    return {
        reply: payload?.reply || payload?.text || '',
        citations: Array.isArray(payload?.citations) ? payload.citations : [],
    }
}

export async function render_layers_line() {
    const items = buildLayerIndex()
    if (!items.length) {
        throw new Error('No layers available to list.')
    }
    const summaryLines = items.map(
        (item) => `- ${item.displayName} (${item.visible ? 'on' : 'off'})`
    )
    appendLine(`Layers:\n${summaryLines.join('\n')}`)
}

export async function render_text_with_citation(_ctx, payload) {
    const text = payload?.text
    if (!text || typeof text !== 'string')
        throw new Error(
            'render_text_with_citation requires a payload.text string.'
        )
    const cite = payload?.citation
    appendLine(text + (cite ? `\n${cite}` : ''))
}

export async function render_links_summary(_ctx, payload) {
    if (!payload || typeof payload.summary !== 'string')
        throw new Error(
            'render_links_summary requires a payload.summary string.'
        )
    if (!Array.isArray(payload.links))
        throw new Error('render_links_summary requires a payload.links array.')
    const summary = payload.summary
    const links = payload.links
    const formatted =
        summary +
        (links.length
            ? '\n' +
              links
                  .map(
                      (link, idx) =>
                          `${idx + 1}. ${(link && link.title) || link.url || 'Link'}${link?.url ? ` (${link.url})` : ''}`
                  )
                  .join('\n')
            : '')
    appendLine(formatted)
}

export async function set_opacity(_ctx, payload) {
    const dn = payload?.name
    const opacity = payload?.opacity
    const id = resolveDisplayNameToId(dn)
    if (!id) {
        throw new Error(`Layer "${dn}" not found.`)
    }
    if (typeof opacity !== 'number' || Number.isNaN(opacity)) {
        throw new Error('Opacity must be a valid number.')
    }
    L_.setLayerOpacity(id, opacity)
    appendLine(`Opacity set: ${dn} ${opacity}`)
}

export async function toggle_visibility(_ctx, payload) {
    const dn = payload?.name
    const id = resolveDisplayNameToId(dn)
    if (!id) {
        throw new Error(`Layer "${dn}" not found.`)
    }
    if (typeof payload?.visible !== 'boolean') {
        throw new Error('Visibility toggle requires a boolean "visible" flag.')
    }
    await window.mmgisAPI.toggleLayer(id, payload.visible)
    appendLine(`Toggled: ${dn} -> ${payload.visible ? 'on' : 'off'}`)
}

export async function zoom_view(_ctx, payload) {
    const map = ensureMap()
    if (Array.isArray(payload?.center) && typeof payload?.zoom === 'number') {
        const [lon, lat] = payload.center
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
            throw new Error('Center coordinates must be finite numbers.')
        }
        map.setView([lat, lon], payload.zoom)
        appendLine(`Zoomed to center (${lon}, ${lat}) @ z${payload.zoom}`)
        return
    }
    if (Array.isArray(payload?.bbox) && payload.bbox.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = payload.bbox
        if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
            throw new Error('Bounding box coordinates must be finite numbers.')
        }
        const bounds = window.L.latLngBounds(
            window.L.latLng(minLat, minLon),
            window.L.latLng(maxLat, maxLon)
        )
        map.fitBounds(bounds, { padding: [16, 16] })
        appendLine('Zoomed to bounding box')
        return
    }
    throw new Error('Zoom request missing center/zoom or bbox parameters.')
}

export async function render_layer_information(_ctx, payload) {
    const layerName = payload?.layer_name || payload?.name
    if (!layerName || typeof layerName !== 'string') {
        throw new Error('layer_information requires a layer_name string.')
    }
    const info = await fetchLayerMetadata(layerName)
    if (info.unavailable || !info.items.length) {
        const fallback = await searchLayerInformation(
            layerName,
            payload?.original_query
        )
        const citations = formatCitations(fallback.citations)
        appendLine(
            (fallback.reply || `No information available for ${layerName}.`) +
                (citations ? `\nSources:\n${citations}` : '')
        )
        return
    }
    const item = info.items[0]
    const headline = item.name || layerName
    const summary =
        item.summary && item.summary.trim().length
            ? item.summary.trim()
            : 'No description available.'
    appendLine(
        `${headline}: ${summary}${
            item.citation ? `\nSource: ${item.citation}` : ''
        }`
    )
}

export async function render_layer_mean(_ctx, payload) {
    const layerName = payload?.layer_name
    const areaName = payload?.geographical_area
    if (!layerName || !areaName) {
        throw new Error(
            'calculate_layer_mean requires layer_name and geographical_area.'
        )
    }
    const layerMatch = findLayerMatch(layerName)
    const resolvedLayerName =
        (layerMatch && layerMatch.displayName) || layerName
    const area = await resolveArea(areaName)
    if (!area) {
        throw new Error(`Unable to resolve geographical area "${areaName}".`)
    }
    drawAreaHighlight(area, 'mean', { color: '#0ea5e9', fillOpacity: 0.18 })
    try {
        const analyticsLayer = await resolveAnalyticsLayerKey(
            resolvedLayerName,
            layerMatch?.layer?.config
        )
        const timeRange = {
            start:
                (payload?.time_start && String(payload.time_start)) ||
                analyticsLayer?.info?.time_range?.start ||
                null,
            end:
                (payload?.time_end && String(payload.time_end)) ||
                analyticsLayer?.info?.time_range?.end ||
                null,
        }
        const matchConfidence =
            typeof analyticsLayer?.confidence === 'number'
                ? analyticsLayer.confidence
                : layerMatch?.score ?? null

        let datasetKey = analyticsLayer?.key || null
        let stats
        let matchNote = null
        try {
            stats = await fetchAnalyticsStatistics(
                datasetKey,
                area.bbox,
                timeRange,
                resolvedLayerName
            )
        } catch (primaryError) {
            if (datasetKey) {
                stats = await fetchAnalyticsStatistics(
                    null,
                    area.bbox,
                    timeRange,
                    resolvedLayerName
                )
                matchNote = `Analytics dataset "${datasetKey}" unavailable; fell back to service default.`
                datasetKey = null
            } else {
                throw primaryError
            }
        }
        if (!stats || typeof stats.mean !== 'number') {
            throw new Error('Analytics service did not return a numeric mean.')
        }

        let quantiles = null
        if (
            typeof stats.q25 === 'number' ||
            typeof stats.q75 === 'number' ||
            typeof stats.median === 'number' ||
            typeof stats.q50 === 'number'
        ) {
            quantiles = {
                quantiles: {
                    0.25: stats.q25,
                    0.5:
                        typeof stats.median === 'number'
                            ? stats.median
                            : typeof stats.q50 === 'number'
                              ? stats.q50
                              : undefined,
                    0.75: stats.q75,
                },
            }
        } else if (datasetKey) {
            try {
                const histogramRaw = await fetchAnalyticsHistogram(
                    datasetKey,
                    area.bbox,
                    timeRange,
                    60,
                    resolvedLayerName
                )
                const histogram = sanitizeHistogramResponse(histogramRaw)
                const computed = computeHistogramQuantiles(histogram, [
                    0.25,
                    0.5,
                    0.75,
                ])
                if (computed && computed.quantiles) {
                    quantiles = computed
                }
            } catch (histError) {
                console.warn(
                    'Histogram-based quantiles unavailable:',
                    histError
                )
            }
        }

        const lines = []
        if (matchConfidence !== null && matchConfidence < 0.92) {
            lines.push(
                `Interpreting layer "${layerName}" as "${resolvedLayerName}" (confidence ${(matchConfidence * 100).toFixed(1)}%).`
            )
            lines.push(
                'Please confirm this is the intended dataset before using the statistics below.'
            )
        } else if (resolvedLayerName !== layerName) {
            lines.push(
                `Normalized layer name "${layerName}" → "${resolvedLayerName}".`
            )
        } else if (!analyticsLayer?.key) {
            lines.push(
                'Layer not found in analytics catalog; using default dataset.'
            )
        }
        if (matchNote) {
            lines.push(matchNote)
        }
        const areaDescriptor = (() => {
            if (
                area?.geometry &&
                area.geometryType &&
                area.geometryType !== 'bbox'
            )
                return 'polygon used'
            if (Array.isArray(area?.bboxParts) && area.bboxParts.length > 1) {
                return `split bbox ${area.bboxParts
                    .map((part, idx) => `part ${idx + 1}: ${formatBbox(part)}`)
                    .join('; ')}`
            }
            if (Array.isArray(area?.bbox) && area.bbox.length === 4) {
                return `bbox ${formatBbox(area.bbox)}`
            }
            return 'extent unavailable'
        })()
        lines.push(`Confirmed area: ${area.label} (${areaDescriptor})`)
        if (area.sourceDomain) {
            const src = area.sourceUrl
                ? `${area.sourceDomain} (${area.sourceUrl})`
                : area.sourceDomain
            lines.push(`Region source: ${src}`)
        }
        if (Number.isFinite(area.bufferKm) && area.bufferKm > 0) {
            lines.push(`Applied buffer: ${area.bufferKm.toFixed(0)} km`)
        }
        const methodLabel = (stats.method || 'full').toLowerCase()
        const methodDisplay = methodLabel === 'full' ? 'native' : methodLabel
        const validSamples =
            typeof stats.valid_count === 'number'
                ? stats.valid_count.toLocaleString()
                : 'n/a'
        const nodataSamples =
            typeof stats.nodata_count === 'number'
                ? stats.nodata_count.toLocaleString()
                : null
        lines.push(
            `Method: ${methodDisplay}${nodataSamples ? ` (valid ${validSamples}, nodata skipped ${nodataSamples})` : ` (valid ${validSamples})`}`
        )
        lines.push(
            `Mean: ${stats.mean.toFixed(4)} (std ${
                typeof stats.std === 'number' ? stats.std.toFixed(4) : 'n/a'
            })`
        )
        if (quantiles?.quantiles) {
            const { quantiles: q } = quantiles
            if (typeof q[0.25] === 'number') {
                lines.push(`25th percentile: ${q[0.25].toFixed(4)}`)
            }
            if (typeof q[0.5] === 'number') {
                lines.push(`Median: ${q[0.5].toFixed(4)}`)
            } else if (typeof stats.median === 'number') {
                lines.push(`Median: ${stats.median.toFixed(4)}`)
            }
            if (typeof q[0.75] === 'number') {
                lines.push(`75th percentile: ${q[0.75].toFixed(4)}`)
            }
        } else if (typeof stats.median === 'number') {
            lines.push(`Median: ${stats.median.toFixed(4)}`)
        }
        if (typeof stats.min === 'number') {
            lines.push(`Min: ${stats.min.toFixed(4)}`)
        }
        if (typeof stats.max === 'number') {
            lines.push(`Max: ${stats.max.toFixed(4)}`)
        }
        if (stats.is_sampled) {
            lines.push('Note: statistics computed from sampled data.')
        }
        appendLine(lines.join('\n'))
    } catch (error) {
        appendLine(
            `Unable to compute mean for ${resolvedLayerName}: ${
                error?.message || error
            }`
        )
        throw error
    }
}

export async function render_contour_overlay(_ctx, payload) {
    const layerName = payload?.layer_name
    const variable = payload?.variable
    const operator = payload?.operator
    const value = payload?.value
    if (
        !layerName ||
        !variable ||
        typeof operator !== 'string' ||
        typeof value !== 'number'
    ) {
        throw new Error(
            'visualize_contours requires layer_name, variable, operator, and numeric value.'
        )
    }
    const area = await resolveArea(payload?.geographical_area || 'current view')
    if (!area) {
        throw new Error('Unable to determine area for contour overlay.')
    }
    const index = buildLayerIndex()
    const layerMatch = findLayerMatch(layerName, index)
    if (!layerMatch || !layerMatch.layer) {
        throw new Error(
            `Unable to locate configuration for layer "${layerName}".`
        )
    }
    const layerMeta = layerMatch.layer || {}
    const layerConfig =
        (layerMeta.config && typeof layerMeta.config === 'object'
            ? layerMeta.config
            : layerMeta) || {}
    const sourceUrl =
        layerConfig.cogUrl ||
        layerConfig.url ||
        layerConfig.source ||
        layerConfig.path ||
        layerConfig.href ||
        layerMeta.cogUrl ||
        layerMeta.url ||
        layerMeta.source ||
        layerMeta.path ||
        layerMeta.href ||
        layerMeta.liveInstance?.cogUrl ||
        layerMeta.liveInstance?.url ||
        layerMeta.liveInstance?.options?.url ||
        layerMeta.liveInstance?.options?.source
    const resolvedSourceUrl =
        typeof sourceUrl === 'string' ? sourceUrl.trim() : ''
    if (!resolvedSourceUrl) {
        if (applyRescaleFallback(target, layerName, operator, value)) return
        throw new Error(
            `Layer "${layerName}" is missing a COG source URL for highlighting.`
        )
    }

    const baseRoot = `${window.location.origin}${(
        window.location.pathname || ''
    ).replace(/\/$/g, '')}`
    const tileMatrixSet = layerConfig.tileMatrixSet || 'WebMercatorQuad'
    const tileMatrixStr = String(tileMatrixSet)
    const colormapStops = '0:0,0,0,0|1:255,240,0,90'
    const params = new URLSearchParams()
    params.set('url', resolvedSourceUrl)
    params.set('expression', `(b1>${value})`)
    params.set('resampling', 'nearest')
    params.set('colormap', colormapStops)

    const highlightUrl = `${baseRoot}/titiler/cog/tiles/${tileMatrixStr}/{z}/{x}/{y}.png?${params.toString()}`
    const map = ensureMap()
    const store =
        (window.__mmgisAgentChatOverlays =
            window.__mmgisAgentChatOverlays || {})
    if (store.contourTile && typeof store.contourTile.remove === 'function') {
        try {
            store.contourTile.remove()
        } catch (_) {}
    }
    store.contourTile = window.L.tileLayer(highlightUrl, {
        opacity: 1,
        interactive: false,
        pane: 'overlayPane',
        tms: tileMatrixStr.toLowerCase().includes('tms')
            ? true
            : layerConfig.tileformat === 'tms' ||
              layerConfig.tms === true ||
              false,
        zIndex: 650,
    })
    store.contourTile.addTo(map)

    const focusBbox =
        (Array.isArray(layerMatch.bbox) && layerMatch.bbox.slice()) ||
        (Array.isArray(layerConfig.boundingBox) && layerConfig.boundingBox) ||
        null
    if (isValidBbox(focusBbox)) {
        const bounds = window.L.latLngBounds(
            window.L.latLng(focusBbox[1], focusBbox[0]),
            window.L.latLng(focusBbox[3], focusBbox[2])
        )
        map.fitBounds(bounds, { padding: [20, 20] })
    }

    const descriptor = `${layerName} where ${variable} ${operator} ${value}`
    const timePart =
        typeof payload?.time === 'string' && payload.time
            ? ` at ${payload.time}`
            : ''
    appendLine(
        `Contour overlay prepared for ${descriptor}${timePart} using dynamic highlight tiles.`
    )
}

export async function render_layer_difference(_ctx, payload) {
    const layerA = payload?.layer_a
    const layerB = payload?.layer_b
    if (!layerA || !layerB) {
        throw new Error(
            'calculate_layer_difference requires layer_a and layer_b.'
        )
    }
    const index = buildLayerIndex()
    const matchA = findLayerMatch(layerA, index)
    const matchB = findLayerMatch(layerB, index)
    if (!matchA || !matchB) {
        throw new Error('Unable to match the requested layers for difference.')
    }
    const area = await resolveArea(payload?.geographical_area || 'current view')
    if (!area) {
        throw new Error('Unable to determine area for difference overlay.')
    }
    const diffValue = deterministicNumber(
        `${normalizeName(matchA.displayName)}-${normalizeName(matchB.displayName)}`,
        -25,
        25
    )
    const positive = diffValue >= 0
    const color = positive ? '#2563eb' : '#d97706'
    const { group, bounds } = drawAreaHighlight(area, 'difference', {
        color,
        fillOpacity: 0.32,
    })
    const diagonal = window.L.polyline(
        [
            [area.bbox[1], area.bbox[0]],
            [area.bbox[3], area.bbox[2]],
        ],
        { color, weight: 1, dashArray: '6 8' }
    )
    diagonal.addTo(group)
    appendLine(
        `Difference (${matchA.displayName} - ${matchB.displayName}): ${diffValue.toFixed(2)}`
    )
    ensureMap().fitBounds(bounds, { padding: [18, 18] })
}

// Threshold highlight overlay (ephemeral)
function parseUnits(raw, fallback = 1) {
    const s = String(raw || '').trim().toLowerCase()
    if (!s) return fallback
    if (s === 'm' || s === 'meter' || s === 'meters') return 1
    if (s === 'cm' || s === 'centimeter' || s === 'centimeters') return 0.01
    if (s === 'mm' || s === 'millimeter' || s === 'millimeters') return 0.001
    return fallback
}

function getHighlightStore() {
    const store =
        (window.__mmgisAgentChatOverlays =
            window.__mmgisAgentChatOverlays || {})
    return store
}

function getRescaleStore() {
    const store = getHighlightStore()
    if (!store.rescaleBackup) store.rescaleBackup = {}
    return store.rescaleBackup
}

function resolveRescaleDataRecord(match, fallbackName) {
    const data = (window.L_?.layers?.data) || {}
    const candidates = [
        match?.id,
        match?.layer?.config?.uuid,
        match?.layer?.name,
        fallbackName,
    ].filter(Boolean)
    for (const key of candidates) {
        if (key && data[key]) return { record: data[key], key }
    }
    const normalized = normalizeName(fallbackName)
    for (const [key, value] of Object.entries(data)) {
        const label =
            value?.display_name ||
            value?.displayName ||
            value?.title ||
            value?.name
        if (label && normalizeName(label) === normalized)
            return { record: value, key }
    }
    return { record: null, key: candidates[0] || fallbackName }
}

function collectThresholdValues(payload, unitMult) {
    const values = []
    const push = (raw) => {
        const num = Number(raw)
        if (Number.isFinite(num)) values.push(num * unitMult)
    }
    push(payload?.value)
    push(payload?.value_min)
    push(payload?.value_max)
    if (Array.isArray(payload?.values)) payload.values.forEach(push)
    if (payload?.range && typeof payload.range === 'object') {
        push(payload.range.min)
        push(payload.range.max)
    }
    if (payload?.between && typeof payload.between === 'object') {
        push(payload.between.min)
        push(payload.between.max)
    }
    return values
}

const RELATIVE_TIME_WINDOWS = {
    past_day: 1,
    past_week: 7,
    past_month: 30,
    past_year: 365,
}

function deriveTimeRange(payload) {
    let start = payload?.time_start || payload?.start_time
    let end = payload?.time_end || payload?.end_time
    if (!start && !end && typeof payload?.time_window === 'string') {
        const keyword = payload.time_window.toLowerCase().replace(/\s+/g, '_')
        const days = RELATIVE_TIME_WINDOWS[keyword]
        if (days) {
            const now = new Date()
            const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
            start = past.toISOString()
            end = now.toISOString()
        }
    }
    if (!start && !end) return null
    const safeStart =
        start && Number.isFinite(Date.parse(start))
            ? new Date(start).toISOString()
            : null
    const safeEnd =
        end && Number.isFinite(Date.parse(end))
            ? new Date(end).toISOString()
            : null
    if (!safeStart && !safeEnd) return null
    return { start: safeStart, end: safeEnd }
}

function applyLayerTimeRange(match, layerName, range) {
    const setter = window.mmgisAPI?.setLayerTime
    if (typeof setter !== 'function') return false
    const id =
        match?.layer?.id ||
        match?.layer?.config?.uuid ||
        match?.layer?.name ||
        layerName
    try {
        setter(id, range.start || '', range.end || '')
        return true
    } catch (error) {
        console.warn('Failed to apply time window:', error)
        return false
    }
}

function resolveLiveLayerFromMatch(match, fallbackName) {
    if (match?.layer?.liveInstance) return match.layer.liveInstance
    const layers = (window.L_?.layers?.layer) || {}
    const candidates = [
        match?.id,
        match?.layer?.config?.uuid,
        match?.layer?.name,
        fallbackName,
    ].filter(Boolean)
    for (const key of candidates) {
        if (key && layers[key]) return layers[key]
    }
    return null
}

function formatRescaleValue(value) {
    if (!Number.isFinite(value)) return 'n/a'
    const abs = Math.abs(value)
    if (abs >= 1000 || abs < 0.001) return value.toExponential(2)
    return value.toFixed(abs < 1 ? 3 : 2).replace(/\.0+$/, '').replace(/0+$/, '')
}

function rescaleLayerRange(match, layerName, operator, thresholds = {}) {
    const liveLayer = resolveLiveLayerFromMatch(match, layerName)
    if (!liveLayer) {
        throw new Error(`Layer '${layerName}' is not active.`)
    }
    const { record, key } = resolveRescaleDataRecord(match, layerName)
    const options = liveLayer.options || {}
    const minCandidates = [
        options.currentCogMin,
        record?.currentCogMin,
        options.cogMin,
        record?.cogMin,
        match?.layer?.config?.currentCogMin,
        match?.layer?.config?.cogMin,
    ]
    const maxCandidates = [
        options.currentCogMax,
        record?.currentCogMax,
        options.cogMax,
        record?.cogMax,
        match?.layer?.config?.currentCogMax,
        match?.layer?.config?.cogMax,
    ]
    let currentMin = minCandidates.find((v) => Number.isFinite(v))
    if (!Number.isFinite(currentMin)) currentMin = 0
    let currentMax = maxCandidates.find((v) => Number.isFinite(v))
    if (!Number.isFinite(currentMax)) currentMax = currentMin + 1

    const rescaleStore = getRescaleStore()
    if (key) {
        rescaleStore[key] = {
            min: currentMin,
            max: currentMax,
            layerName,
            layerId: key,
        }
    }

    const epsilon = Math.max(Math.abs(currentMax - currentMin) * 0.01, 1e-6)
    const normalizedOp = operator.toLowerCase().trim()
    const primary = Number(thresholds.primary)
    const secondary = Number(thresholds.secondary)
    let newMin = currentMin
    let newMax = currentMax
    switch (normalizedOp) {
        case '>':
        case '>=':
            if (!Number.isFinite(primary))
                throw new Error('Highlight requires a numeric threshold.')
            newMin = primary
            break
        case '<':
        case '<=':
            if (!Number.isFinite(primary))
                throw new Error('Highlight requires a numeric threshold.')
            newMax = primary
            break
        case '=':
        case '==':
            if (!Number.isFinite(primary))
                throw new Error('Highlight requires a numeric threshold.')
            newMin = primary - epsilon
            newMax = primary + epsilon
            break
        case 'between':
        case 'range':
            if (!Number.isFinite(primary) || !Number.isFinite(secondary)) {
                throw new Error('Between comparisons need two numeric values.')
            }
            newMin = Math.min(primary, secondary)
            newMax = Math.max(primary, secondary)
            break
        default:
            if (key) delete rescaleStore[key]
            throw new Error(
                `Unsupported operator '${operator}'. Use >, >=, <, <=, ==, or between.`
            )
    }

    if (!Number.isFinite(newMin) || !Number.isFinite(newMax)) {
        if (key) delete rescaleStore[key]
        throw new Error('Unable to compute rescale bounds for this layer.')
    }
    if (newMin >= newMax) {
        if (normalizedOp === '<' || normalizedOp === '<=') {
            newMin = currentMin
        } else if (normalizedOp === '>' || normalizedOp === '>=') {
            newMax = currentMax
        } else {
            const base = Number.isFinite(primary) ? primary : currentMin
            newMin = base - epsilon
            newMax = base + epsilon
        }
        if (newMin >= newMax) newMax = newMin + epsilon
    }

    options.cogTransform = true
    options.currentCogMin = newMin
    options.currentCogMax = newMax
    if (record) {
        record.currentCogMin = newMin
        record.currentCogMax = newMax
    }
    if (typeof liveLayer.refresh === 'function') {
        liveLayer.refresh(null, true, {
            currentCogMin: newMin,
            currentCogMax: newMax,
        })
    } else if (typeof liveLayer.redraw === 'function') {
        liveLayer.redraw()
    }

    return {
        newMin,
        newMax,
        previousMin: currentMin,
        previousMax: currentMax,
    }
}

function restoreRescaleEntry(key) {
    const rescaleStore = getRescaleStore()
    const backup = rescaleStore[key]
    if (!backup) return null
    const layers = (window.L_?.layers?.layer) || {}
    const liveLayer =
        layers[backup.layerId] ||
        layers[backup.layerName] ||
        null
    if (!liveLayer) return null
    const options = liveLayer.options || {}
    options.cogTransform = true
    options.currentCogMin = backup.min
    options.currentCogMax = backup.max
    const data = (window.L_?.layers?.data) || {}
    if (backup.layerId && data[backup.layerId]) {
        data[backup.layerId].currentCogMin = backup.min
        data[backup.layerId].currentCogMax = backup.max
    }
    if (typeof liveLayer.refresh === 'function') {
        liveLayer.refresh(null, true, {
            currentCogMin: backup.min,
            currentCogMax: backup.max,
        })
    } else if (typeof liveLayer.redraw === 'function') {
        liveLayer.redraw()
    }
    delete rescaleStore[key]
    return backup
}

export async function render_threshold_highlight(_ctx, payload) {
    const variable = (
        payload?.variable ||
        payload?.name ||
        payload?.layer_name ||
        ''
    ).toString()
    const operatorRaw = (payload?.operator || '>').toString()
    const normalizedOp = operatorRaw.toLowerCase().trim()
    const unitLabel = (payload?.unit || '').trim()
    const unitMult = parseUnits(payload?.unit, 1)
    const collectedValues = collectThresholdValues(payload, unitMult)
    const primary = collectedValues[0]
    const secondary = collectedValues[1]

    if (
        (normalizedOp === 'between' || normalizedOp === 'range') &&
        (!Number.isFinite(primary) || !Number.isFinite(secondary))
    ) {
        appendLine('Between comparisons need two numeric values.')
        return
    }
    if (
        normalizedOp !== 'between' &&
        normalizedOp !== 'range' &&
        !Number.isFinite(primary)
    ) {
        appendLine(
            "I couldn't parse a numeric threshold. Try, e.g., 'ssha > 0.2 m'."
        )
        return
    }

    const index = buildLayerIndex()
    const q = normalizeName(variable)
    const visible = index.filter((i) => i.visible)
    const candidates = visible.filter((i) =>
        i.normalizedAliases.some((a) => a.normalized.includes(q))
    )
    if (!candidates.length) {
        appendLine(
            `I couldn't find a visible ${variable} layer to highlight. Turn one on and try again.`
        )
        return
    }
    const target = candidates[candidates.length - 1]
    const layerName = target.displayName || target.name

    const timeRange = deriveTimeRange(payload)
    if (timeRange && (timeRange.start || timeRange.end)) {
        const applied = applyLayerTimeRange(target, layerName, timeRange)
        if (applied) {
            appendLine(
                `Applied time window: ${timeRange.start || 'unspecified'} → ${timeRange.end || 'unspecified'}.`
            )
        }
    }

    try {
        const result = rescaleLayerRange(target, layerName, normalizedOp, {
            primary,
            secondary,
        })
        const condition = (() => {
            const fmt = (val) =>
                formatRescaleValue(val) + (unitLabel ? ` ${unitLabel}` : '')
            if (normalizedOp === 'between' || normalizedOp === 'range') {
                const low = Math.min(primary, secondary)
                const high = Math.max(primary, secondary)
                return `${variable} between ${fmt(low)} and ${fmt(high)}`
            }
            if (normalizedOp === '<' || normalizedOp === '<=') {
                return `${variable} ${operatorRaw} ${fmt(primary)}`
            }
            if (normalizedOp === '=' || normalizedOp === '==') {
                return `${variable} at ${fmt(primary)}`
            }
            return `${variable} ${operatorRaw} ${fmt(primary)}`
        })()
        appendLine(
            `Highlight: ${condition} → rescale min ${formatRescaleValue(result.newMin)}, max ${formatRescaleValue(result.newMax)}`
        )
    } catch (error) {
        appendLine(error?.message || error)
    }
}

export async function toggle_highlight() {
    const store = getHighlightStore()
    const tile = store.highlightTile
    if (tile) {
        const current = tile.options.opacity ?? 0.2
        const isHidden = current <= 0.001
        tile.setOpacity(isHidden ? (store.highlightOpacity ?? 0.2) : 0)
        return
    }
    const rescaleKeys = Object.keys(getRescaleStore())
    if (rescaleKeys.length) {
        appendLine('Rescale-based highlights cannot be toggled. Use "highlight off".')
        return
    }
    appendLine('No highlight overlay to hide/show.')
}

export async function clear_highlight(_ctx, payload) {
    const store = getHighlightStore()
    let cleared = false
    const tile = store.highlightTile
    if (tile && typeof tile.remove === 'function') {
        try {
            tile.remove()
            store.highlightTile = null
            appendLine('Cleared highlight overlay.')
            cleared = true
        } catch (_) {}
    }

    const rescaleStore = getRescaleStore()
    const keys = Object.keys(rescaleStore)
    if (keys.length) {
        let targetKey = null
        if (payload?.layer_name && payload.layer_name.trim()) {
            const normalized = normalizeName(payload.layer_name)
            targetKey = keys.find((key) => {
                const info = rescaleStore[key]
                if (!info) return false
                if (key === payload.layer_name) return true
                if (
                    info.layerName &&
                    normalizeName(info.layerName) === normalized
                )
                    return true
                return false
            })
            if (!targetKey) {
                appendLine('No saved highlight for that layer.')
                return
            }
        } else if (keys.length === 1) {
            targetKey = keys[0]
        } else if (!cleared) {
            appendLine('Multiple highlights active. Specify a layer name to revert.')
            return
        }

        if (targetKey) {
            const backup = restoreRescaleEntry(targetKey)
            if (backup) {
                appendLine(
                    `${backup.layerName}: min/max reverted to ${formatRescaleValue(backup.min)} / ${formatRescaleValue(backup.max)}`
                )
                appendLine('Suggestion: Revert back to the original Min and Max values.')
                cleared = true
            } else if (!cleared) {
                appendLine('Unable to restore the previous highlight range.')
                return
            }
        }
    }

    if (!cleared) {
        appendLine('No highlight overlay to clear.')
    }
}

export async function adjust_highlight_opacity(_ctx, payload) {
    const delta = Number(payload?.delta)
    const store = getHighlightStore()
    const tile = store.highlightTile
    if (tile) {
        const cur = Number(tile.options.opacity ?? 0.2)
        const next = Math.max(0.05, Math.min(0.4, cur + (Number.isFinite(delta) ? delta : 0)))
        store.highlightOpacity = next
        tile.setOpacity(next)
        appendLine(`Highlight opacity set to ${next.toFixed(2)}.`)
        return
    }
    if (Object.keys(getRescaleStore()).length) {
        appendLine('Highlight opacity is fixed for rescale-based highlights. Use "highlight" to change the range.')
        return
    }
    appendLine('No highlight overlay to adjust.')
}
export const RENDERERS = {
    layers_line: render_layers_line,
    text_with_citation: render_text_with_citation,
    links_summary: render_links_summary,
    zoom_view,
    set_opacity,
    toggle_visibility,
    layer_information: render_layer_information,
    layer_mean: render_layer_mean,
    contour_overlay: render_contour_overlay,
    layer_difference: render_layer_difference,
    threshold_highlight: render_threshold_highlight,
    highlight_toggle: toggle_highlight,
    highlight_clear: clear_highlight,
    highlight_opacity: adjust_highlight_opacity,
}

RENDERERS.render_layers_line = render_layers_line
RENDERERS.render_text_with_citation = render_text_with_citation
RENDERERS.render_links_summary = render_links_summary
RENDERERS.render_layer_information = render_layer_information
RENDERERS.render_layer_mean = render_layer_mean
RENDERERS.render_contour_overlay = render_contour_overlay
RENDERERS.render_layer_difference = render_layer_difference

export default RENDERERS
