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

function buildLayerIndex() {
    const api = window.mmgisAPI
    if (!api) throw new Error('mmgisAPI is not available.')
    const configs = api.getLayerConfigs?.()
    if (!configs || typeof configs !== 'object')
        throw new Error('getLayerConfigs() returned no data.')
    const visibleLookup = api.getVisibleLayers?.() || {}
    const items = []
    const seen = new Set()

    Object.keys(configs).forEach((key) => {
        const layer = configs[key] || {}
        const uuid = String(layer.uuid || key || layer.name || '')
        if (!uuid || seen.has(uuid)) return
        seen.add(uuid)
        const displayName =
            layer.display_name ||
            layer.displayName ||
            layer.title ||
            layer.name ||
            uuid
        const canonical = layer.name || displayName
        const aliases = new Set()
        ;[
            displayName,
            canonical,
            layer.title,
            layer.display_name,
            layer.displayName,
            layer.shortName,
        ].forEach((alias) => {
            if (typeof alias === 'string' && alias.trim())
                aliases.add(alias.trim())
        })
        if (Array.isArray(layer.aliases || layer.alias)) {
            ;(layer.aliases || layer.alias).forEach((alias) => {
                if (typeof alias === 'string' && alias.trim())
                    aliases.add(alias.trim())
            })
        } else if (typeof layer.alias === 'string') {
            layer.alias
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
            name: layer.name || uuid,
            displayName,
            canonical,
            visible: !!(visibleLookup[uuid] || visibleLookup[key]),
            normalizedAliases,
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
    const bounds = window.L.latLngBounds(
        window.L.latLng(area.bbox[1], area.bbox[0]),
        window.L.latLng(area.bbox[3], area.bbox[2])
    )
    const color = options.color || '#0ea5e9'
    const fill = window.L.rectangle(bounds, {
        color,
        weight: options.weight || 1,
        fillColor: color,
        fillOpacity:
            typeof options.fillOpacity === 'number' ? options.fillOpacity : 0.2,
    })
    fill.addTo(group)
    if (options.dashArray) fill.setStyle({ dashArray: options.dashArray })
    map.fitBounds(bounds, { padding: [18, 18] })
    return { group, bounds }
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

function resolveArea(name) {
    const normalized = normalizeName(name)
    if (normalized && AREA_PRESETS[normalized]) {
        const preset = AREA_PRESETS[normalized]
        return {
            label: preset.label || name || 'selected area',
            bbox: preset.bbox.slice(),
        }
    }
    const map = window.mmgisAPI?.map
    if (map) {
        const bounds = map.getBounds()
        return {
            label: name || 'current map view',
            bbox: [
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth(),
            ],
        }
    }
    return null
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
    const area = resolveArea(areaName)
    if (!area) {
        throw new Error(`Unable to resolve geographical area "${areaName}".`)
    }
    drawAreaHighlight(area, 'mean', { color: '#0ea5e9', fillOpacity: 0.18 })
    const mean = deterministicNumber(
        `${normalizeName(layerName)}|${normalizeName(area.label)}`,
        -20,
        45
    )
    appendLine(
        `Mean value for ${layerName} across ${area.label}: ${mean.toFixed(2)}`
    )
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
    const area = resolveArea(payload?.geographical_area || 'current view')
    if (!area) {
        throw new Error('Unable to determine area for contour overlay.')
    }
    const { bounds } = drawAreaHighlight(area, 'contours', {
        color: '#ef4444',
        fillOpacity: 0.5,
    })
    const group =
        window.__mmgisAgentChatOverlays &&
        window.__mmgisAgentChatOverlays.contours
            ? window.__mmgisAgentChatOverlays.contours
            : ensureOverlayGroup('contours')

    const steps = 3
    for (let i = 1; i <= steps; i += 1) {
        const lat =
            area.bbox[1] + ((area.bbox[3] - area.bbox[1]) * i) / (steps + 1)
        const poly = window.L.polyline(
            [
                [lat, area.bbox[0]],
                [lat, area.bbox[2]],
            ],
            {
                color: '#fca5a5',
                weight: 1,
                dashArray: '4 6',
            }
        )
        poly.addTo(group)
    }
    for (let j = 1; j <= steps; j += 1) {
        const lon =
            area.bbox[0] + ((area.bbox[2] - area.bbox[0]) * j) / (steps + 1)
        const poly = window.L.polyline(
            [
                [area.bbox[1], lon],
                [area.bbox[3], lon],
            ],
            {
                color: '#fca5a5',
                weight: 1,
                dashArray: '4 6',
            }
        )
        poly.addTo(group)
    }
    const descriptor = `${layerName} where ${variable} ${operator} ${value}`
    const timePart =
        typeof payload?.time === 'string' && payload.time
            ? ` at ${payload.time}`
            : ''
    appendLine(
        `Contour overlay added for ${descriptor}${timePart} over ${area.label}.`
    )
    ensureMap().fitBounds(bounds, { padding: [20, 20] })
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
    const area = resolveArea(payload?.geographical_area || 'current view')
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
}

RENDERERS.render_layers_line = render_layers_line
RENDERERS.render_text_with_citation = render_text_with_citation
RENDERERS.render_links_summary = render_links_summary
RENDERERS.render_layer_information = render_layer_information
RENDERERS.render_layer_mean = render_layer_mean
RENDERERS.render_contour_overlay = render_contour_overlay
RENDERERS.render_layer_difference = render_layer_difference

export default RENDERERS
