/**
 * IdentifierTimeSeriesPanel.js
 *
 * Click-for-time-series for the Identifier (#1159): owns the selected point,
 * its marker, the panel and its charts, and the requests behind them.
 *
 * Everything outside this file is passed in - the layers, the marker, the
 * panel view and the fetcher - so the click/refresh/close lifecycle (and its
 * races) is testable on its own, and IdentifierTool only wires it up.
 */
import {
    classifyLayer,
    createRequestGuard,
    cacheKey,
} from './IdentifierTimeSeries.js'
import { buildChartOption } from './IdentifierTimeSeriesChart.js'

const CACHE_SIZE = 24

/**
 * Active layers, split into what can be charted and what can't (with why).
 * Header layers and layers that are off are not listed.
 *
 * @param {object} layers - { data: {uuid: layer}, on: {uuid: bool} }
 * @param {(uuid: string) => boolean} hasIdentifierDataSource
 */
export function listActiveLayers(
    layers,
    hasIdentifierDataSource = () => false
) {
    const eligible = []
    const unsupported = []
    let anyTimeEnabled = false
    const on = layers?.on || {}
    const data = layers?.data || {}
    for (const uuid of Object.keys(on)) {
        if (on[uuid] !== true || !data[uuid]) continue
        const layer = data[uuid]
        const c = classifyLayer(layer, {
            hasIdentifierDataSource: hasIdentifierDataSource(uuid),
        })
        if (!c) continue
        if (layer.time?.enabled === true) anyTimeEnabled = true
        const name = layer.display_name || layer.name || uuid
        if (c.eligible) eligible.push({ uuid, name, layer })
        else unsupported.push({ uuid, name, reason: c.reason })
    }
    return { eligible, unsupported, anyTimeEnabled }
}

/**
 * @param {object} deps
 * @param {() => object} deps.getLayers - { data, on }
 * @param {(uuid) => object|undefined} [deps.getIdentifierConfig]
 * @param {(args) => Promise<object>} deps.fetchSeries - fetchLayerTimeSeries
 *   bound to fetch/location (receives { layer, lng, lat, signal, identifierConfig })
 * @param {{ place(lng, lat), remove() }} deps.marker
 * @param {object} deps.view - see createPanelView
 * @param {Function} [deps.AbortController]
 */
export function createTimeSeriesController(deps) {
    const guard = createRequestGuard(deps.AbortController)
    const cache = new Map()
    let point = null
    let open = false

    const getConfig = (uuid) => deps.getIdentifierConfig?.(uuid)
    const remember = (key, result) => {
        cache.delete(key)
        cache.set(key, result)
        while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value)
    }

    function load() {
        if (!point) return
        const token = guard.begin()
        const { eligible, unsupported } = listActiveLayers(
            deps.getLayers(),
            (uuid) => getConfig(uuid)?.url != null && getConfig(uuid).url !== ''
        )
        deps.view.render(point, eligible, unsupported)

        const { lng, lat } = point
        return Promise.all(
            eligible.map(({ uuid, layer }) => {
                const key = cacheKey(uuid, layer, lng, lat, getConfig(uuid))
                if (cache.has(key)) {
                    const hit = cache.get(key)
                    remember(key, hit)
                    deps.view.renderResult(uuid, hit)
                    return null
                }
                return Promise.resolve()
                    .then(() =>
                        deps.fetchSeries({
                            layer,
                            layerUUID: uuid,
                            lng,
                            lat,
                            signal: token.signal,
                            identifierConfig: getConfig(uuid),
                        })
                    )
                    .then((result) => {
                        if (!token.isCurrent()) return
                        // Failures aren't kept, so the next click retries.
                        if (result.status !== 'error') remember(key, result)
                        deps.view.renderResult(uuid, result)
                    })
                    .catch((e) => {
                        if (!token.isCurrent() || e?.name === 'AbortError')
                            return
                        deps.view.renderResult(uuid, {
                            status: 'error',
                            message: `Time series failed: ${e?.message || e}`,
                        })
                    })
            })
        )
    }

    const controller = {
        /** Whether a click here should open the panel at all. */
        wantsClick() {
            return listActiveLayers(deps.getLayers()).anyTimeEnabled
        },
        /** Select (or move to) a point and chart it. */
        selectPoint(lng, lat) {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
            if (!controller.wantsClick()) return false
            point = { lng, lat }
            deps.marker.place(lng, lat)
            if (!open) {
                deps.view.open()
                open = true
            }
            load()
            return true
        },
        /** Re-chart the current point (time window or layers changed). */
        refresh() {
            if (open && point) load()
        },
        close() {
            guard.cancel()
            point = null
            deps.marker.remove()
            if (open) deps.view.close()
            open = false
        },
        destroy() {
            controller.close()
            cache.clear()
        },
        isOpen: () => open,
        getPoint: () => (point ? { ...point } : null),
        _cacheSize: () => cache.size,
    }
    deps.view.onClose?.(() => controller.close())
    return controller
}

const escapeHtml = (s) =>
    String(s).replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c]
    )

/** Chart colours taken from the theme's CSS variables, when present. */
function readTheme(doc, el) {
    try {
        const css = doc.defaultView.getComputedStyle(el)
        const v = (name) => css.getPropertyValue(name).trim()
        const theme = {}
        if (v('--color-f')) theme.text = v('--color-f')
        if (v('--color-a5')) theme.axis = v('--color-a5')
        if (v('--color-a2')) theme.grid = v('--color-a2')
        return theme
    } catch (e) {
        return {}
    }
}

/**
 * The panel: a floating card listing each active layer - a chart for those
 * that can be charted, and a one-line reason for those that can't.
 *
 * @param {object} deps
 * @param {Document} deps.document
 * @param {() => HTMLElement} deps.getParent - where the panel mounts
 * @param {(el, option) => { setOption, resize, dispose }} deps.createChart
 */
export function createPanelView(deps) {
    const doc = deps.document
    let root = null
    let closeHandler = null
    const charts = new Map()

    const disposeCharts = () => {
        charts.forEach((c) => c.dispose())
        charts.clear()
    }

    const view = {
        onClose(fn) {
            closeHandler = fn
        },
        open() {
            if (root) return
            root = doc.createElement('div')
            root.id = 'identifierTimeSeriesPanel'
            root.className = 'identifierTimeSeriesPanel'
            root.setAttribute('role', 'dialog')
            root.setAttribute('aria-label', 'Identifier time series')
            root.innerHTML = [
                '<div class="identifierTimeSeriesPanel_header">',
                '<div class="identifierTimeSeriesPanel_title">Time Series</div>',
                '<div class="identifierTimeSeriesPanel_coords"></div>',
                '<button type="button" class="identifierTimeSeriesPanel_close" title="Close" aria-label="Close time series"><i class="mdi mdi-close mdi-14px"></i></button>',
                '</div>',
                '<div class="identifierTimeSeriesPanel_body"></div>',
            ].join('')
            root.querySelector(
                '.identifierTimeSeriesPanel_close'
            ).addEventListener('click', () => closeHandler && closeHandler())
            // The panel floats over the map: keep its clicks and wheel off it.
            ;[
                'click',
                'dblclick',
                'mousedown',
                'mouseup',
                'wheel',
                'contextmenu',
            ].forEach((ev) =>
                root.addEventListener(ev, (e) => e.stopPropagation())
            )
            deps.getParent().appendChild(root)
        },
        render(point, eligible, unsupported) {
            if (!root) return
            disposeCharts()
            root.querySelector(
                '.identifierTimeSeriesPanel_coords'
            ).textContent = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            const body = root.querySelector('.identifierTimeSeriesPanel_body')
            const parts = eligible.map(
                (e) =>
                    `<div class="identifierTimeSeriesPanel_layer" data-layer="${escapeHtml(
                        e.uuid
                    )}">` +
                    `<div class="identifierTimeSeriesPanel_layerName">${escapeHtml(
                        e.name
                    )}</div>` +
                    `<div class="identifierTimeSeriesPanel_status">Loading time series…</div>` +
                    `<div class="identifierTimeSeriesPanel_chart"></div>` +
                    `<ul class="identifierTimeSeriesPanel_notes"></ul>` +
                    `</div>`
            )
            if (eligible.length === 0)
                parts.push(
                    '<div class="identifierTimeSeriesPanel_empty">No active layer can be charted here.</div>'
                )
            if (unsupported.length > 0)
                parts.push(
                    '<div class="identifierTimeSeriesPanel_unsupported">' +
                        '<div class="identifierTimeSeriesPanel_subtitle">Not charted</div><ul>' +
                        unsupported
                            .map(
                                (u) =>
                                    `<li data-layer="${escapeHtml(u.uuid)}"><span>${escapeHtml(
                                        u.name
                                    )}</span>: ${escapeHtml(u.reason)}</li>`
                            )
                            .join('') +
                        '</ul></div>'
                )
            body.innerHTML = parts.join('')
        },
        renderResult(uuid, result) {
            if (!root) return
            const section = [
                ...root.querySelectorAll('.identifierTimeSeriesPanel_layer'),
            ].find((el) => el.getAttribute('data-layer') === uuid)
            if (!section) return
            const status = section.querySelector(
                '.identifierTimeSeriesPanel_status'
            )
            const chartEl = section.querySelector(
                '.identifierTimeSeriesPanel_chart'
            )
            const notes = section.querySelector(
                '.identifierTimeSeriesPanel_notes'
            )
            if (charts.has(uuid)) {
                charts.get(uuid).dispose()
                charts.delete(uuid)
            }
            notes.innerHTML = (result.notes || [])
                .map((n) => `<li>${escapeHtml(n)}</li>`)
                .join('')
            if (result.status === 'ok') {
                status.textContent = ''
                status.style.display = 'none'
                chartEl.classList.add('identifierTimeSeriesPanel_chart--on')
                charts.set(
                    uuid,
                    deps.createChart(
                        chartEl,
                        buildChartOption(result.series, {
                            measurementLabel: result.expression || '',
                            theme: readTheme(doc, root),
                        })
                    )
                )
            } else {
                status.style.display = ''
                status.textContent = result.message || 'No data.'
                status.classList.toggle(
                    'identifierTimeSeriesPanel_status--error',
                    result.status === 'error'
                )
                chartEl.classList.remove('identifierTimeSeriesPanel_chart--on')
            }
        },
        close() {
            disposeCharts()
            if (root && root.parentNode) root.parentNode.removeChild(root)
            root = null
        },
        isOpen: () => root != null,
        _chartCount: () => charts.size,
    }
    return view
}
