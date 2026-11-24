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
    createLimiter,
    snapshotLayerQuery,
    TIME_SERIES_LIMITS,
} from './IdentifierTimeSeries.js'
import {
    buildChartOption,
    buildReadingsTable,
    describeChart,
} from './IdentifierTimeSeriesChart.js'

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
 *   bound to fetch/location; receives { query, layerUUID, lng, lat, signal,
 *   run } where query is the layer's snapshot and run the shared limiter
 * @param {{ place(lng, lat, mapLng), remove() }} deps.marker
 * @param {object} deps.view - see createPanelView
 * @param {Function} [deps.AbortController]
 * @param {number} [deps.requestConcurrency] - per point selection, all layers
 */
export function createTimeSeriesController(deps) {
    const guard = createRequestGuard(deps.AbortController)
    const cache = new Map()
    let point = null
    let open = false
    let refreshQueued = false

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

        // One concurrency budget for everything this selection asks for,
        // shared by every layer charted here.
        const run = createLimiter(
            deps.requestConcurrency ?? TIME_SERIES_LIMITS.requestConcurrency
        )
        const { lng, lat } = point
        return Promise.all(
            eligible.map(({ uuid, layer }) => {
                // Everything below - cache key, requests, labels - reads this
                // snapshot, never the live layer, which may change while the
                // requests are out.
                const query = snapshotLayerQuery(layer)
                const key = cacheKey(uuid, query, lng, lat)
                if (cache.has(key)) {
                    const hit = cache.get(key)
                    remember(key, hit)
                    deps.view.renderResult(uuid, hit)
                    return null
                }
                return Promise.resolve()
                    .then(() =>
                        deps.fetchSeries({
                            query,
                            layerUUID: uuid,
                            lng,
                            lat,
                            signal: token.signal,
                            run,
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

    // Whether a click here should open the panel at all.
    const wantsClick = () => listActiveLayers(deps.getLayers()).anyTimeEnabled

    const controller = {
        /**
         * Select (or move to) a point and chart it.
         * @param {number} lng - normalised to -180..180; the queries use it
         * @param {number} lat
         * @param {object} [options]
         * @param {number} [options.mapLng] - the longitude in the map's world
         *   copy that was clicked, for the map marker only
         * @param {boolean} [options.fromKeyboard] - focus the panel
         */
        selectPoint(lng, lat, options = {}) {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
            if (!wantsClick()) return false
            point = { lng, lat }
            const mapLng = Number.isFinite(options.mapLng)
                ? options.mapLng
                : lng
            deps.marker.place(lng, lat, mapLng)
            if (!open) {
                deps.view.open({ focus: options.fromKeyboard === true })
                open = true
            } else if (options.fromKeyboard) deps.view.focus?.()
            load()
            return true
        },
        /** Re-chart the current point (time window or layers changed). */
        refresh() {
            if (open && point) load()
        },
        /**
         * A layer's query inputs changed (expression, bands, time window).
         * Changes made together - in one task - re-chart once; the request
         * guard drops whatever the previous load still has in flight.
         */
        queryChanged() {
            if (!open || !point || refreshQueued) return
            refreshQueued = true
            Promise.resolve().then(() => {
                refreshQueued = false
                controller.refresh()
            })
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
 * that can be charted, and the reason for those that can't.
 *
 * Layers that can't be charted sit in a "Not charted (N)" disclosure: closed
 * while at least one chart is shown, open when nothing could be charted.
 * Each chart has an accessible name and a readings table (dates, values,
 * acquisition ids and gap reasons) behind its own disclosure.
 *
 * @param {object} deps
 * @param {Document} deps.document
 * @param {() => HTMLElement} deps.getParent - where the panel mounts
 * @param {(el, option) => { setOption, resize, dispose }} deps.createChart
 * @param {() => HTMLElement|null} [deps.getReturnFocus] - where focus goes
 *   when the panel is closed from the keyboard
 */
export function createPanelView(deps) {
    const doc = deps.document
    let root = null
    let closeHandler = null
    const charts = new Map()
    // Open/closed as the person last set "Not charted" themselves (null:
    // they haven't). Kept across re-renders, which rebuild the element.
    let notChartedChoice = null
    let pending = 0

    const disposeCharts = () => {
        charts.forEach((c) => c.dispose())
        charts.clear()
    }

    const notChartedOpen = () => {
        const d = root?.querySelector('.identifierTimeSeriesPanel_unsupported')
        if (!d || notChartedChoice != null) return
        // Hidden behind its summary while anything is charted; shown when
        // nothing is (or will be).
        d.open = charts.size === 0 && pending === 0
    }

    const closeFromPanel = (viaKeyboard) => {
        const back = viaKeyboard ? deps.getReturnFocus?.() : null
        if (closeHandler) closeHandler()
        if (back && typeof back.focus === 'function') back.focus()
    }

    const view = {
        onClose(fn) {
            closeHandler = fn
        },
        open(options = {}) {
            if (root) return
            root = doc.createElement('section')
            root.id = 'identifierTimeSeriesPanel'
            root.className = 'identifierTimeSeriesPanel'
            root.setAttribute(
                'aria-labelledby',
                'identifierTimeSeriesPanel_title'
            )
            root.innerHTML = [
                '<div class="identifierTimeSeriesPanel_header">',
                '<h2 class="identifierTimeSeriesPanel_title" id="identifierTimeSeriesPanel_title" tabindex="-1">Time Series</h2>',
                '<div class="identifierTimeSeriesPanel_coords" aria-label="Selected point"></div>',
                '<button type="button" class="identifierTimeSeriesPanel_close" title="Close" aria-label="Close time series"><i class="mdi mdi-close mdi-14px" aria-hidden="true"></i></button>',
                '</div>',
                '<div class="identifierTimeSeriesPanel_live" role="status" aria-live="polite"></div>',
                '<div class="identifierTimeSeriesPanel_body"></div>',
            ].join('')
            const closeBtn = root.querySelector(
                '.identifierTimeSeriesPanel_close'
            )
            closeBtn.addEventListener('click', (e) =>
                // detail 0: activated with Enter/Space rather than a pointer
                closeFromPanel(e.detail === 0)
            )
            root.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation()
                    closeFromPanel(true)
                }
            })
            // The panel floats over the map: keep its clicks, wheel and keys
            // off it.
            ;[
                'click',
                'dblclick',
                'mousedown',
                'mouseup',
                'wheel',
                'contextmenu',
                'keydown',
            ].forEach((ev) =>
                root.addEventListener(ev, (e) => e.stopPropagation())
            )
            deps.getParent().appendChild(root)
            if (options.focus) view.focus()
        },
        focus() {
            root?.querySelector('.identifierTimeSeriesPanel_title')?.focus()
        },
        render(point, eligible, unsupported) {
            if (!root) return
            disposeCharts()
            pending = eligible.length
            root.querySelector(
                '.identifierTimeSeriesPanel_coords'
            ).textContent = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            root.querySelector('.identifierTimeSeriesPanel_live').textContent =
                eligible.length > 0
                    ? `Loading time series at ${point.lat.toFixed(
                          5
                      )}, ${point.lng.toFixed(5)}.`
                    : 'No active layer can be charted here.'
            const body = root.querySelector('.identifierTimeSeriesPanel_body')
            const parts = eligible.map(
                (e) =>
                    `<div class="identifierTimeSeriesPanel_layer" data-layer="${escapeHtml(
                        e.uuid
                    )}">` +
                    `<h3 class="identifierTimeSeriesPanel_layerName">${escapeHtml(
                        e.name
                    )}</h3>` +
                    `<div class="identifierTimeSeriesPanel_status">Loading time series…</div>` +
                    `<div class="identifierTimeSeriesPanel_incomplete" role="note" hidden></div>` +
                    `<div class="identifierTimeSeriesPanel_chart"></div>` +
                    `<ul class="identifierTimeSeriesPanel_notes"></ul>` +
                    `<details class="identifierTimeSeriesPanel_readings" hidden><summary>Readings table</summary><div class="identifierTimeSeriesPanel_tableWrap"></div></details>` +
                    `</div>`
            )
            if (eligible.length === 0)
                parts.push(
                    '<div class="identifierTimeSeriesPanel_empty">No active layer can be charted here.</div>'
                )
            if (unsupported.length > 0)
                parts.push(
                    '<details class="identifierTimeSeriesPanel_unsupported">' +
                        `<summary class="identifierTimeSeriesPanel_subtitle">Not charted (${unsupported.length})</summary><ul>` +
                        unsupported
                            .map(
                                (u) =>
                                    `<li data-layer="${escapeHtml(u.uuid)}"><span>${escapeHtml(
                                        u.name
                                    )}</span>: ${escapeHtml(u.reason)}</li>`
                            )
                            .join('') +
                        '</ul></details>'
                )
            body.innerHTML = parts.join('')
            const d = root.querySelector(
                '.identifierTimeSeriesPanel_unsupported'
            )
            if (d) {
                d.open =
                    notChartedChoice != null
                        ? notChartedChoice
                        : eligible.length === 0
                // A toggle by the person (not by us) is theirs to keep: a
                // summary click (pointer, Enter or Space) flips it.
                d.querySelector('summary').addEventListener('click', () => {
                    notChartedChoice = !d.open
                })
            }
        },
        renderResult(uuid, result) {
            if (!root) return
            const section = [
                ...root.querySelectorAll('.identifierTimeSeriesPanel_layer'),
            ].find((el) => el.getAttribute('data-layer') === uuid)
            if (!section) return
            const q = (c) =>
                section.querySelector(`.identifierTimeSeriesPanel_${c}`)
            const status = q('status')
            const chartEl = q('chart')
            const notes = q('notes')
            const incomplete = q('incomplete')
            const readings = q('readings')
            if (charts.has(uuid)) {
                charts.get(uuid).dispose()
                charts.delete(uuid)
            }
            if (section.dataset.settled !== 'true') {
                section.dataset.settled = 'true'
                pending = Math.max(0, pending - 1)
            }
            notes.innerHTML = (result.notes || [])
                .map((n) => `<li>${escapeHtml(n)}</li>`)
                .join('')
            const reasons = result.incomplete || []
            incomplete.hidden = reasons.length === 0
            incomplete.textContent =
                reasons.length > 0
                    ? `History may be incomplete: ${reasons.join('; ')}.`
                    : ''
            const name = section.querySelector(
                '.identifierTimeSeriesPanel_layerName'
            ).textContent
            if (result.status === 'ok') {
                status.textContent = ''
                status.style.display = 'none'
                chartEl.classList.add('identifierTimeSeriesPanel_chart--on')
                chartEl.setAttribute('role', 'img')
                chartEl.setAttribute(
                    'aria-label',
                    describeChart(result.series, name)
                )
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
                const table = buildReadingsTable(result.series)
                readings.hidden = false
                readings.querySelector('summary').textContent =
                    `Readings table (${table.rows.length})`
                readings.querySelector(
                    '.identifierTimeSeriesPanel_tableWrap'
                ).innerHTML =
                    `<table><caption>${escapeHtml(name)} readings at the selected point</caption>` +
                    `<thead><tr>${table.columns
                        .map((c) => `<th scope="col">${escapeHtml(c)}</th>`)
                        .join('')}</tr></thead><tbody>` +
                    table.rows
                        .map(
                            (r) =>
                                `<tr>${r
                                    .map((c, i) =>
                                        i === 0
                                            ? `<th scope="row">${escapeHtml(c)}</th>`
                                            : `<td>${escapeHtml(c)}</td>`
                                    )
                                    .join('')}</tr>`
                        )
                        .join('') +
                    '</tbody></table>'
            } else {
                status.style.display = ''
                status.textContent = result.message || 'No data.'
                status.classList.toggle(
                    'identifierTimeSeriesPanel_status--error',
                    result.status === 'error'
                )
                chartEl.classList.remove('identifierTimeSeriesPanel_chart--on')
                chartEl.removeAttribute('role')
                chartEl.removeAttribute('aria-label')
                readings.hidden = true
            }
            if (pending === 0)
                root.querySelector(
                    '.identifierTimeSeriesPanel_live'
                ).textContent =
                    charts.size > 0
                        ? `Time series ready: ${charts.size} chart${charts.size === 1 ? '' : 's'}.`
                        : 'No time series could be charted here.'
            notChartedOpen()
        },
        close() {
            disposeCharts()
            if (root && root.parentNode) root.parentNode.removeChild(root)
            root = null
            pending = 0
            // A new panel starts from the defaults.
            notChartedChoice = null
        },
    }
    return view
}
