import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'

function appendLine(text) {
    // Prefer the chat tool's append hook so content persists in history
    if (typeof window.__mmgisAgentChatAppend === 'function') {
        window.__mmgisAgentChatAppend(String(text))
        return
    }
    // Fallback: best-effort DOM append if hook is unavailable
    const $tx = $('#agentChatTranscript')
    if (!$tx.length) throw new Error('Agent chat transcript element not found.')
    const div = $(`<div style='margin:4px 0;white-space:pre-wrap'></div>`).text(
        String(text)
    )
    $tx.append(div)
    $tx.scrollTop($tx[0].scrollHeight)
}

function buildCatalog() {
    const api = window.mmgisAPI
    if (!api) throw new Error('mmgisAPI is not available.')
    const configs = api.getLayerConfigs()
    if (!configs || typeof configs !== 'object')
        throw new Error('getLayerConfigs() returned no data.')
    const visibles = api.getVisibleLayers()
    if (!visibles || typeof visibles !== 'object')
        throw new Error('getVisibleLayers() returned no data.')
    const items = []
    for (const key of Object.keys(configs)) {
        const layer = configs[key] || {}
        const displayName =
            layer.display_name ||
            layer.displayName ||
            layer.name ||
            layer.title ||
            key
        items.push({
            id: key,
            name: layer.name || key,
            displayName,
            visible: !!visibles[key],
        })
    }
    return items
}

function resolveDisplayNameToId(displayName) {
    const items = buildCatalog()
    const exact = items.find((item) => item.displayName === displayName)
    return exact ? exact.name : null
}

export async function render_layers_line() {
    const items = buildCatalog()
    if (!items.length) {
        throw new Error('No layers available to list.')
    }
    const summary = items
        .map((item) => `${item.displayName} (${item.visible ? 'on' : 'off'})`)
        .join(', ')
    appendLine(`Layers: ${summary}`)
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
    const map = window.mmgisAPI.map
    if (!map) {
        throw new Error('Map instance unavailable.')
    }
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

export const RENDERERS = {
    // Keys match registry execution.ui.type values
    layers_line: render_layers_line,
    text_with_citation: render_text_with_citation,
    links_summary: render_links_summary,
    zoom_view,
    set_opacity,
    toggle_visibility,
}

export default RENDERERS
