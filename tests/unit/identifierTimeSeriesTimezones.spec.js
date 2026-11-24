import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Acquisition times read the same whatever the system timezone (#1159).
 *
 * The parser runs in a real browser set to each timezone below, including a
 * date that is in daylight saving time there and zones with half- and
 * quarter-hour offsets. Every accepted input must give the same instant
 * everywhere; times without a zone - which JavaScript would read in local
 * time - must be rejected everywhere.
 */

const ROOT = path.resolve(__dirname, '../..')
const ORIGIN = 'http://identifier-tz.test'

const ACCEPTED = {
    '2024-07-15T12:00:00Z': Date.UTC(2024, 6, 15, 12),
    '2024-07-15T12:00:00.250Z': Date.UTC(2024, 6, 15, 12, 0, 0, 250),
    '2024-07-15T12:00:00-05:00': Date.UTC(2024, 6, 15, 17),
    '2024-07-15T12:00:00+05:45': Date.UTC(2024, 6, 15, 6, 15),
    '2024-03-10T08:30:00Z': Date.UTC(2024, 2, 10, 8, 30), // US DST change
    '2024-02-29T00:00:00Z': Date.UTC(2024, 1, 29),
    '2024-07-15': Date.UTC(2024, 6, 15),
}
const REJECTED = [
    '2024-07-15T12:00:00',
    '2024-07-15 12:00:00',
    '2024-02-31T00:00:00Z',
    '2023-02-29T00:00:00Z',
]

// Each zone's Date#getTimezoneOffset() on 2024-07-15 (minutes, UTC - local),
// to prove the browser really ran in it.
const ZONES = {
    UTC: 0,
    'America/Chicago': 300, // CDT, UTC-5
    'Asia/Kolkata': -330, // UTC+5:30
    'Asia/Kathmandu': -345, // UTC+5:45
    'Pacific/Kiritimati': -840, // UTC+14
}

for (const [timezoneId, offset] of Object.entries(ZONES)) {
    test.describe(`parseIsoTime in ${timezoneId}`, () => {
        test.use({ timezoneId })

        test('the same instants, and the same rejections', async ({ page }) => {
            await page.route(`${ORIGIN}/**`, (route) => {
                const { pathname } = new URL(route.request().url())
                if (pathname === '/')
                    return route.fulfill({
                        body: '<!doctype html><html><body></body></html>',
                        contentType: 'text/html',
                    })
                const file = path.join(ROOT, decodeURIComponent(pathname))
                if (!file.startsWith(ROOT) || !fs.existsSync(file))
                    return route.fulfill({ status: 404, body: '' })
                route.fulfill({
                    body: fs.readFileSync(file),
                    contentType: 'text/javascript',
                })
            })
            await page.goto(`${ORIGIN}/`)
            const r = await page.evaluate(
                async ([accepted, rejected]) => {
                    const m =
                        await import('/plugins/core/tools/Identifier/IdentifierTimeSeries.js')
                    return {
                        offset: new Date(
                            Date.UTC(2024, 6, 15, 12)
                        ).getTimezoneOffset(),
                        accepted: Object.fromEntries(
                            accepted.map((v) => [v, m.parseIsoTime(v)])
                        ),
                        rejected: rejected.map((v) => m.parseIsoTime(v)),
                        // what Date.parse would have said for a zoneless time
                        naive: Date.parse('2024-07-15T12:00:00'),
                    }
                },
                [Object.keys(ACCEPTED), REJECTED]
            )
            expect(r.offset).toBe(offset)
            expect(r.accepted).toEqual(ACCEPTED)
            expect(r.rejected).toEqual(REJECTED.map(() => null))
            // Date.parse reads a zoneless time locally: this is why it is
            // rejected. Outside UTC it lands somewhere other than 12:00Z.
            if (timezoneId !== 'UTC')
                expect(r.naive).not.toBe(Date.UTC(2024, 6, 15, 12))
        })
    })
}

/**
 * The chart itself (PR #1171 review): real ECharts, our chart option, in
 * browsers set to different zones. useUTC puts the axis ticks at UTC times,
 * so the labels, the tooltip and the readings table are the same everywhere
 * and match the acquisition instants exactly.
 */
test('the chart axis, tooltip and table read the same in every timezone', async ({
    browser,
}) => {
    const zones = [
        'UTC',
        'America/Los_Angeles',
        'America/Chicago',
        'Asia/Kathmandu',
        'Pacific/Kiritimati',
    ]
    const seen = {}
    for (const timezoneId of zones) {
        const context = await browser.newContext({ timezoneId })
        const page = await context.newPage()
        await page.route(`${ORIGIN}/**`, (route) => {
            const { pathname } = new URL(route.request().url())
            if (pathname === '/')
                return route.fulfill({
                    body: '<!doctype html><html><body><div id="c" style="width:640px;height:240px"></div><script src="/node_modules/echarts/dist/echarts.min.js"></script></body></html>',
                    contentType: 'text/html',
                })
            const file = path.join(ROOT, decodeURIComponent(pathname))
            if (!file.startsWith(ROOT) || !fs.existsSync(file))
                return route.fulfill({ status: 404, body: '' })
            route.fulfill({
                body: fs.readFileSync(file),
                contentType: 'text/javascript',
            })
        })
        await page.goto(`${ORIGIN}/`)
        seen[timezoneId] = await page.evaluate(async () => {
            const m =
                await import('/plugins/core/tools/Identifier/IdentifierTimeSeriesChart.js')
            // acquisitions an hour either side of UTC midnight, around a
            // US DST change, and two sharing one instant
            const t = [
                Date.UTC(2024, 2, 9, 23, 0, 0),
                Date.UTC(2024, 2, 10, 1, 0, 0),
                Date.UTC(2024, 2, 10, 9, 30, 0),
                Date.UTC(2024, 2, 10, 9, 30, 0),
                Date.UTC(2024, 2, 11, 6, 0, 0),
            ]
            const series = [
                {
                    name: 'b1',
                    units: 'ppm',
                    points: t.map((time, i) => ({
                        time,
                        value: i === 2 ? null : 10 + i,
                        status: i === 2 ? 'nodata' : 'ok',
                        itemId: `scene-${i}`,
                        range: null,
                    })),
                },
            ]
            const el = document.getElementById('c')
            const chart = window.echarts.init(el)
            chart.setOption(m.buildChartOption(series))
            const labels = []
            chart
                .getZr()
                .storage.getDisplayList()
                .forEach((e) => {
                    if (e.style && typeof e.style.text === 'string')
                        labels.push(e.style.text)
                })
            let tip = null
            const opt = chart.getOption()
            opt.tooltip[0].formatter = (p) => {
                tip = m.formatTooltip(p, series)
                return tip
            }
            chart.setOption({ tooltip: opt.tooltip })
            const px = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
                t[3],
                13,
            ])
            chart.dispatchAction({ type: 'showTip', x: px[0], y: px[1] })
            return {
                offset: new Date(Date.UTC(2024, 6, 1)).getTimezoneOffset(),
                labels,
                tip,
                table: m.buildReadingsTable(series).rows.map((r) => r[0]),
            }
        })
        await context.close()
    }
    // the zones really differed
    expect(seen['America/Los_Angeles'].offset).toBe(420)
    expect(seen['Pacific/Kiritimati'].offset).toBe(-840)
    const base = seen.UTC
    // UTC day boundaries on the axis: Mar 10 and Mar 11 begin at 00:00 UTC
    expect(base.labels).toEqual(expect.arrayContaining(['10', '11']))
    expect(base.tip).toContain('2024-03-10 09:30:00 UTC')
    expect(base.tip).toContain('scene-2')
    expect(base.tip).toContain('scene-3')
    expect(base.table).toEqual([
        '2024-03-09 23:00:00 UTC',
        '2024-03-10 01:00:00 UTC',
        '2024-03-10 09:30:00 UTC',
        '2024-03-10 09:30:00 UTC',
        '2024-03-11 06:00:00 UTC',
    ])
    for (const z of zones) {
        expect(seen[z].labels, z).toEqual(base.labels)
        expect(seen[z].tip, z).toEqual(base.tip)
        expect(seen[z].table, z).toEqual(base.table)
    }
})
