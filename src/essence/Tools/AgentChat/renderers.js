import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'

function appendLine(text) {
  const $tx = $('#agentChatTranscript')
  const div = $(`<div style='margin:4px 0;white-space:pre-wrap'></div>`).text(
    text
  )
  $tx.append(div)
  $tx.scrollTop($tx[0].scrollHeight)
}

function buildCatalog() {
  const confs = window.mmgisAPI.getLayerConfigs() || {}
  const visibles = window.mmgisAPI.getVisibleLayers() || {}
  const items = []
  for (const k of Object.keys(confs)) {
    const c = confs[k] || {}
    const displayName = c.display_name || c.displayName || c.name || c.title || k
    items.push({ id: k, name: c.name || k, displayName, visible: !!visibles[k] })
  }
  return items
}

function resolveDisplayNameToId(displayName) {
  const items = buildCatalog()
  const exact = items.find((i) => i.displayName === displayName)
  return exact ? exact.name : null
}

export async function render_layers_line() {
  const items = buildCatalog()
  if (items.length === 0) appendLine('Layers: (none)')
  else appendLine('Layers: ' + items.map((i) => `${i.displayName} (${i.visible ? 'on' : 'off'})`).join(', '))
}

export async function render_text_with_citation(_ctx, payload) {
  const text = payload?.text || 'MMGIS overview'
  const cite = payload?.citation
  appendLine(text + (cite ? `\n${cite}` : ''))
}

export async function render_links_summary(_ctx, payload) {
  const summary = payload?.summary || 'No summary.'
  const links = Array.isArray(payload?.links) ? payload.links : []
  appendLine(summary)
  links.forEach((l) => {
    const a = $(`<a target='_blank'></a>`).attr('href', l.url).text(l.title || l.url)
    const $tx = $('#agentChatTranscript')
    const div = $(`<div style='margin:2px 0'></div>`)
    div.append(a)
    $tx.append(div)
    $tx.scrollTop($tx[0].scrollHeight)
  })
}

export async function set_opacity(_ctx, payload) {
  const dn = payload?.name
  const o = payload?.opacity
  const id = resolveDisplayNameToId(dn)
  if (!id) {
    appendLine(`Couldn't find layer "${dn}". Try "list layers" first.`)
    return
  }
  const prev = L_.layers && L_.layers.opacity && L_.layers.opacity[id]
  if (typeof prev === 'number') {
    // optional: integrate with external undo stack if desired
  }
  L_.setLayerOpacity(id, o)
  appendLine(`Opacity set: ${dn} ${o}`)
}

export async function toggle_visibility(_ctx, payload) {
  const dn = payload?.name
  const id = resolveDisplayNameToId(dn)
  if (!id) {
    appendLine(`Couldn't find layer "${dn}". Try "list layers" first.`)
    return
  }
  await window.mmgisAPI.toggleLayer(id, !!payload?.visible)
  appendLine(`Toggled: ${dn} → ${payload?.visible ? 'on' : 'off'}`)
}

export async function zoom_view(_ctx, payload) {
  const m = window.mmgisAPI.map
  if (!m) return
  try {
    if (Array.isArray(payload?.center) && typeof payload?.zoom === 'number') {
      const [lon, lat] = payload.center
      // Fix bug: ensure lon,lat ordering and guard against NaN
      if (Number.isFinite(lon) && Number.isFinite(lat)) m.setView([lat, lon], payload.zoom)
      appendLine(`Zoomed to center (${lon}, ${lat}) @ z${payload.zoom}`)
      return
    }
    if (Array.isArray(payload?.bbox) && payload.bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = payload.bbox
      if ([minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
        const bounds = window.L.latLngBounds(
          window.L.latLng(minLat, minLon),
          window.L.latLng(maxLat, maxLon)
        )
        m.fitBounds(bounds, { padding: [16, 16] })
        appendLine('Zoomed to bounding box')
      }
      return
    }
  } catch (_) {}
}

export const RENDERERS = {
  render_layers_line,
  render_text_with_citation,
  render_links_summary,
  zoom_view,
  set_opacity,
  toggle_visibility,
}

export default RENDERERS


