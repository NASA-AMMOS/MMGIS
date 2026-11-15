/**
 * IdentifierTimeSeriesChart.js
 *
 * One ECharts line chart of a layer's history at a point (#1159). Time runs
 * along x; each band (or the expression) is a series in its units on y.
 * Nodata is a gap in the line, and says "no data" in the tooltip.
 *
 * `buildChartOption` is pure. `createTimeSeriesChart` owns an ECharts
 * instance and its resize observer, and `dispose()` releases both.
 */

const pad = (n) => String(n).padStart(2, '0')

/** UTC, to the second: what STAC datetimes are given in. */
export function formatUtc(ms) {
    const d = new Date(ms)
    if (!Number.isFinite(d.getTime())) return ''
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
            d.getUTCSeconds()
        )} UTC`
    )
}

/** Why a point has no value, as the tooltip says it. */
const GAP_LABELS = {
    nodata: 'no data',
    missing: 'no reading',
    invalid: 'invalid value',
}

/** A gap's label for a point's status (nodata if unspecified). */
export function gapLabel(status) {
    return GAP_LABELS[status] || GAP_LABELS.nodata
}

/** A value for display: up to `sigfigs` decimals, trailing zeros dropped. */
export function formatValue(value, sigfigs = 4) {
    if (value == null) return 'no data'
    if (!Number.isFinite(value)) return 'no data'
    const abs = Math.abs(value)
    if (abs !== 0 && (abs >= 1e7 || abs < 1e-4)) return value.toExponential(3)
    return String(Number.parseFloat(value.toFixed(sigfigs)))
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

/** A y-axis title: the units if every series shares them. */
export function axisUnits(series) {
    const units = [...new Set(series.map((s) => s.units || ''))]
    return units.length === 1 ? units[0] : ''
}

/**
 * The ECharts option for one layer's series.
 * @param {Array} series - from IdentifierTimeSeries.buildSeries
 * @param {object} [opts]
 * @param {string} [opts.measurementLabel] - e.g. the band expression
 * @param {object} [opts.theme] - { text, axis, grid } colours
 */
export function buildChartOption(series, opts = {}) {
    const theme = {
        text: '#d0d0d0',
        axis: '#8a8a8a',
        grid: 'rgba(255,255,255,0.08)',
        ...(opts.theme || {}),
    }
    const units = axisUnits(series)
    const yName = [opts.measurementLabel, units ? `(${units})` : '']
        .filter(Boolean)
        .join(' ')
    const multi = series.length > 1
    const pointCount = Math.max(0, ...series.map((s) => s.points.length))

    return {
        animation: false,
        textStyle: { color: theme.text, fontSize: 11 },
        grid: { left: 52, right: 14, top: multi ? 30 : 22, bottom: 40 },
        legend: multi
            ? {
                  top: 0,
                  type: 'scroll',
                  textStyle: { color: theme.text, fontSize: 11 },
              }
            : undefined,
        tooltip: {
            trigger: 'axis',
            confine: true,
            formatter: (params) => {
                const list = Array.isArray(params) ? params : [params]
                if (list.length === 0) return ''
                const first = list[0].data || {}
                const when = first.range
                    ? `${escapeHtml(first.range[0])} – ${escapeHtml(first.range[1])}`
                    : formatUtc(first.value?.[0])
                const rows = list.map((p) => {
                    const s = series[p.seriesIndex] || {}
                    const v = p.data?.value?.[1]
                    const u =
                        v == null || !s.units ? '' : ` ${escapeHtml(s.units)}`
                    const shown =
                        v == null ? gapLabel(p.data?.status) : formatValue(v)
                    return `${p.marker || ''}${escapeHtml(p.seriesName)}: <b>${escapeHtml(
                        shown
                    )}${u}</b>`
                })
                return [
                    `<div style="font-size:11px">${when}</div>`,
                    ...rows,
                    first.itemId
                        ? `<div style="font-size:10px;opacity:.7">${escapeHtml(
                              first.itemId
                          )}</div>`
                        : '',
                ].join('<br/>')
            },
        },
        xAxis: {
            type: 'time',
            axisLine: { lineStyle: { color: theme.axis } },
            axisLabel: { color: theme.text, hideOverlap: true },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            name: yName,
            nameTextStyle: { color: theme.text, align: 'left' },
            scale: true,
            axisLine: { show: true, lineStyle: { color: theme.axis } },
            axisLabel: { color: theme.text },
            splitLine: { lineStyle: { color: theme.grid } },
        },
        series: series.map((s) => ({
            name: s.name,
            type: 'line',
            // Gaps at nodata; no line drawn through them.
            connectNulls: false,
            showSymbol: pointCount <= 200,
            symbolSize: 5,
            data: s.points.map((p) => ({
                value: [p.time, p.value],
                status: p.status,
                itemId: p.itemId,
                range: p.range,
            })),
        })),
    }
}

/**
 * Mount a chart.
 *
 * @param {HTMLElement|null} container
 * @param {object} option - from buildChartOption
 * @param {object} deps
 * @param {object} deps.echarts - the echarts module (or echarts/core with
 *   the line chart, components and a renderer registered)
 * @param {object} [deps.initOptions] - passed to echarts.init
 * @param {Function} [deps.ResizeObserver]
 * @returns {{ instance, setOption(o), resize(size?), dispose() }}
 */
export function createTimeSeriesChart(container, option, deps) {
    const { echarts } = deps
    const RO =
        deps.ResizeObserver !== undefined
            ? deps.ResizeObserver
            : typeof ResizeObserver !== 'undefined'
              ? ResizeObserver
              : null
    let instance = echarts.init(container, null, deps.initOptions || {})
    instance.setOption(option)

    let observer = null
    let windowHandler = null
    const resize = (size) => {
        if (instance && !instance.isDisposed()) instance.resize(size)
    }
    if (RO && container) {
        observer = new RO(() => resize())
        observer.observe(container)
    } else if (typeof window !== 'undefined' && container) {
        windowHandler = () => resize()
        window.addEventListener('resize', windowHandler)
    }

    return {
        get instance() {
            return instance
        },
        setOption(o) {
            if (instance && !instance.isDisposed()) instance.setOption(o, true)
        },
        resize,
        dispose() {
            if (observer) observer.disconnect()
            observer = null
            if (windowHandler)
                window.removeEventListener('resize', windowHandler)
            windowHandler = null
            if (instance && !instance.isDisposed()) instance.dispose()
            instance = null
        },
    }
}
