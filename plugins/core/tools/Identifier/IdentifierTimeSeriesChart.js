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

import {
    parseIdentifierValue,
    STAC_VALUE_FORMAT,
    formatStacReading,
} from './IdentifierValueFormat.js'

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
    unresolved: 'not read',
    invalid: 'invalid value',
}

/** A gap's label for a point's status (nodata if unspecified). */
export function gapLabel(status) {
    return GAP_LABELS[status] || GAP_LABELS.nodata
}

/**
 * A value for display, written exactly as the Identifier's hover readout
 * writes a STAC reading (IdentifierValueFormat), so one reading reads the
 * same in both places.
 */
export function formatValue(value) {
    if (value == null || !Number.isFinite(value)) return 'no data'
    return String(
        parseIdentifierValue(
            value,
            STAC_VALUE_FORMAT.sigfigs,
            STAC_VALUE_FORMAT.scalefactor
        )
    )
}

/**
 * A point's reading as words: its value with its unit appended verbatim, as
 * the hover readout writes it (formatStacReading), or why it has none.
 */
export function describeReading(point, units) {
    if (point.value == null) return gapLabel(point.status)
    return formatStacReading(point.value, units)
}

/** A unit for a heading or axis title: its text without padding. */
const unitLabel = (units) => (units || '').trim()

/**
 * When an acquisition was, in UTC: its range (two instants) if it has one,
 * else its time. The one formatter behind the table, the tooltip and the
 * chart's accessible name.
 */
export function describeWhen(point) {
    return point.range
        ? `${formatUtc(point.range[0])} – ${formatUtc(point.range[1])}`
        : formatUtc(point.time)
}

/**
 * Readings as a table, one row per acquisition (item), oldest first, with a
 * column per band - what the chart shows, for screen readers and keyboard
 * users, and for anyone who wants the numbers.
 * @returns {{ columns: string[], rows: string[][] }}
 */
export function buildReadingsTable(series) {
    const columns = ['Acquired (UTC)', 'Acquisition ID'].concat(
        series.map((s) =>
            unitLabel(s.units) ? `${s.name} (${unitLabel(s.units)})` : s.name
        )
    )
    const rows = []
    const first = series[0]
    if (!first) return { columns, rows }
    first.points.forEach((p, i) => {
        rows.push(
            [describeWhen(p), p.itemId].concat(
                series.map((s) => {
                    const q = s.points[i]
                    return q ? describeReading(q, '') : ''
                })
            )
        )
    })
    return { columns, rows }
}

/** A short spoken summary of a chart, for its accessible name. */
export function describeChart(series, layerName) {
    const pts = series[0]?.points || []
    const withValue = series.reduce(
        (n, s) => n + s.points.filter((p) => p.value != null).length,
        0
    )
    if (pts.length === 0) return `${layerName}: no acquisitions`
    return (
        `${layerName}: ${pts.length} acquisition${pts.length === 1 ? '' : 's'} ` +
        `from ${formatUtc(pts[0].time)} to ${formatUtc(
            pts[pts.length - 1].time
        )}, ${withValue} reading${withValue === 1 ? '' : 's'} with a value. ` +
        'The readings are listed in the table below the chart.'
    )
}

/**
 * The tooltip at one point on the time axis. Several acquisitions can share
 * that instant, and ECharts then passes every series' reading for every one
 * of them, so the readings are grouped by acquisition: each group names its
 * item (and its time range, when it has one) and shows only its own values.
 */
export function formatTooltip(params, series) {
    const list = Array.isArray(params) ? params : [params]
    if (list.length === 0) return ''
    const groups = new Map()
    for (const p of list) {
        const d = p.data || {}
        const key = d.itemId ?? `#${p.dataIndex}`
        if (!groups.has(key)) groups.set(key, { data: d, rows: [] })
        const s = series[p.seriesIndex] || {}
        const shown = describeReading(
            { value: d.value?.[1], status: d.status },
            s.units
        )
        groups
            .get(key)
            .rows.push(
                `${p.marker || ''}${escapeHtml(p.seriesName)}: <b>${escapeHtml(
                    shown
                )}</b>`
            )
    }
    const firstData = list[0].data || {}
    const parts = []
    const allRanged = [...groups.values()].every((g) => g.data.range)
    if (!allRanged)
        parts.push(
            `<div style="font-size:11px">${formatUtc(firstData.value?.[0])}</div>`
        )
    for (const [key, g] of groups) {
        const head = []
        if (g.data.itemId != null)
            head.push(
                `<div style="font-size:10px;opacity:.7">${escapeHtml(
                    g.data.itemId
                )}</div>`
            )
        if (g.data.range)
            head.push(
                `<div style="font-size:11px">${escapeHtml(
                    describeWhen(g.data)
                )}</div>`
            )
        parts.push(
            `<div class="identifierTimeSeriesTooltip_item" data-item="${escapeHtml(
                String(key)
            )}">${head.join('')}${g.rows.join('<br/>')}</div>`
        )
    }
    return parts.join('')
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
    const units = [...new Set(series.map((s) => unitLabel(s.units)))]
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
        // STAC times are UTC instants: draw the time axis in UTC, as the
        // tooltip and readings table write them, whatever the browser's zone.
        useUTC: true,
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
            formatter: (params) => formatTooltip(params, series),
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
            // Isolated valid readings surrounded by gaps have no line
            // segments. Without symbols a sparse history looks empty.
            showSymbol:
                pointCount <= 200 || s.points.some((p) => p.value == null),
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
