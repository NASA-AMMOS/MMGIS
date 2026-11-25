import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Identifier time-series panel in a real browser (#1159): the panel's DOM,
 * real ECharts charts in it, resizing, and that closing releases them.
 *
 * The panel modules are served as-is (they are plain ES modules) to a blank
 * page; ECharts comes from its own dist build. No MMGIS server is needed -
 * the layers, marker and fetcher are stand-ins.
 */

const ROOT = path.resolve(__dirname, '../..')
const ORIGIN = 'http://identifier-timeseries.test'
const TYPES = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
}

const PAGE = `<!doctype html><html><head>
<link rel="stylesheet" href="/plugins/core/tools/Identifier/IdentifierTimeSeries.css">
<script src="/node_modules/echarts/dist/echarts.min.js"></script>
</head><body style="margin:0">
<div id="splitscreens" style="position:absolute;inset:0;width:1000px;height:700px"></div>
</body></html>`

async function openHarness(page, { withReturnFocus = false } = {}) {
    await page.route(`${ORIGIN}/**`, async (route) => {
        const { pathname } = new URL(route.request().url())
        if (pathname === '/')
            return route.fulfill({ body: PAGE, contentType: 'text/html' })
        const file = path.join(ROOT, decodeURIComponent(pathname))
        if (!file.startsWith(ROOT) || !fs.existsSync(file))
            return route.fulfill({ status: 404, body: '' })
        route.fulfill({
            body: fs.readFileSync(file),
            contentType:
                TYPES[path.extname(file)] || 'application/octet-stream',
        })
    })
    await page.goto(`${ORIGIN}/`)
    await page.evaluate(async (withReturnFocus) => {
        // A focusable stand-in for the map container (where keyboard
        // selection starts and where focus returns on a keyboard close).
        const mapStandIn = document.createElement('div')
        mapStandIn.id = 'mapStandIn'
        mapStandIn.tabIndex = 0
        document.body.appendChild(mapStandIn)
        const panel =
            await import('/plugins/core/tools/Identifier/IdentifierTimeSeriesPanel.js')
        const chart =
            await import('/plugins/core/tools/Identifier/IdentifierTimeSeriesChart.js')
        const stac = (name, url) => ({
            type: 'tile',
            display_name: name,
            url,
            cogUnits: 'ppm m',
            time: {
                enabled: true,
                start: '2024-01-01T00:00:00Z',
                end: '2024-06-30T00:00:00Z',
            },
        })
        const h = {
            marker: { at: null, removed: 0 },
            fetches: [],
            layers: {
                data: {
                    ch4: stac('Methane', 'stac-collection:ch4'),
                    bare: stac('Bare spot', 'stac-collection:bare'),
                    down: stac('Down', 'stac-collection:down'),
                    roads: {
                        type: 'vector',
                        display_name: 'Roads',
                        url: 'r.geojson',
                        time: { enabled: true },
                    },
                    tiles: {
                        type: 'tile',
                        display_name: 'Basemap',
                        url: 'b/{z}/{x}/{y}.png',
                    },
                },
                on: {
                    ch4: true,
                    bare: true,
                    down: true,
                    roads: true,
                    tiles: true,
                },
            },
        }
        const pts = (lng) =>
            Array.from({ length: 12 }, (_, i) => ({
                time: Date.UTC(2024, 0, 1 + i * 7),
                value: i === 4 ? null : lng * 10 + i,
                itemId: `item${i}`,
                range: null,
            }))
        h.marker.place = (lng, lat) => (h.marker.at = [lng, lat])
        h.marker.remove = () => {
            h.marker.at = null
            h.marker.removed++
        }
        h.controller = panel.createTimeSeriesController({
            getLayers: () => h.layers,
            fetchSeries: async ({ layerUUID, lng }) => {
                h.fetches.push(layerUUID)
                // a test can set the answer for a layer
                if (h.responses && h.responses[layerUUID])
                    return h.responses[layerUUID](lng)
                if (layerUUID === 'bare')
                    return {
                        status: 'empty',
                        message:
                            'No acquisitions cover this point in the selected time range.',
                    }
                if (layerUUID === 'down')
                    return {
                        status: 'error',
                        message:
                            "Couldn't read acquisition times from the STAC API (HTTP 502).",
                    }
                return {
                    status: 'ok',
                    notes: ['1 item returned no reading here.'],
                    series: [{ name: 'b1', units: 'ppm m', points: pts(lng) }],
                }
            },
            marker: h.marker,
            view: panel.createPanelView({
                document,
                getParent: () => document.getElementById('splitscreens'),
                createChart: (el, option) =>
                    chart.createTimeSeriesChart(el, option, {
                        echarts: window.echarts,
                    }),
                getReturnFocus: withReturnFocus
                    ? () => document.getElementById('mapStandIn')
                    : undefined,
            }),
        })
        h.chartEl = () =>
            document.querySelector(
                '#identifierTimeSeriesPanel [data-layer="ch4"] .identifierTimeSeriesPanel_chart'
            )
        h.instance = () =>
            h.chartEl()
                ? window.echarts.getInstanceByDom(h.chartEl())
                : undefined
        window.__h = h
    }, withReturnFocus)
}

test.describe('Identifier time-series panel (browser)', () => {
    test('a click opens a panel with a chart, empty and error states, and reasons', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(10, 20))
        const panel = page.locator('#identifierTimeSeriesPanel')
        await expect(panel).toBeVisible()
        await expect(
            panel.locator('.identifierTimeSeriesPanel_coords')
        ).toHaveText('20.00000, 10.00000')

        const ch4 = panel.locator('[data-layer="ch4"]')
        await expect(
            ch4.locator('.identifierTimeSeriesPanel_layerName')
        ).toHaveText('Methane')
        await expect(ch4.locator('canvas')).toHaveCount(1)
        await expect(
            ch4.locator('.identifierTimeSeriesPanel_notes li')
        ).toHaveText('1 item returned no reading here.')

        await expect(
            panel.locator(
                '[data-layer="bare"] .identifierTimeSeriesPanel_status'
            )
        ).toHaveText(/No acquisitions/)
        await expect(panel.locator('[data-layer="bare"] canvas')).toHaveCount(0)
        const down = panel.locator(
            '[data-layer="down"] .identifierTimeSeriesPanel_status'
        )
        await expect(down).toHaveText(/HTTP 502/)
        await expect(down).toHaveClass(
            /identifierTimeSeriesPanel_status--error/
        )

        const unsupported = panel.locator(
            '.identifierTimeSeriesPanel_unsupported li'
        )
        await expect(unsupported).toHaveText([
            'Roads: Vector layer: features carry no raster measurements to chart.',
            'Basemap: Pre-rendered tiles: colours only, no numeric source values.',
        ])
        // A chart is shown, so the reasons sit behind a closed disclosure:
        // its summary is visible and counts them; the reasons are not.
        const notCharted = panel.locator(
            'details.identifierTimeSeriesPanel_unsupported'
        )
        await expect(notCharted).toBeVisible()
        await expect(notCharted.locator('summary')).toHaveText(
            'Not charted (2)'
        )
        expect(await notCharted.evaluate((d) => d.open)).toBe(false)
        await expect(unsupported.first()).toBeHidden()

        // the chart holds every observation, the nodata one as a gap
        const data = await page.evaluate(() =>
            window.__h
                .instance()
                .getOption()
                .series[0].data.map((d) => d.value[1])
        )
        expect(data).toHaveLength(12)
        expect(data[4]).toBeNull()
        expect(await page.evaluate(() => window.__h.marker.at)).toEqual([
            10, 20,
        ])
    })

    test('Not charted: open when nothing is charted, collapsed when a chart is', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = false
            window.__h.controller.selectPoint(10, 20)
        })
        const notCharted = page.locator(
            'details.identifierTimeSeriesPanel_unsupported'
        )
        const reasons = notCharted.locator('li')
        // No chart (bare: empty, down: error): reasons shown by default.
        await expect(
            page.locator(
                '[data-layer="down"] .identifierTimeSeriesPanel_status'
            )
        ).toHaveText(/HTTP 502/)
        await expect(
            page.locator('#identifierTimeSeriesPanel canvas')
        ).toHaveCount(0)
        await expect.poll(() => notCharted.evaluate((d) => d.open)).toBe(true)
        await expect(reasons.first()).toBeVisible()

        // A chart appears: the reasons fold away behind "Not charted (N)".
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = true
            window.__h.controller.refresh()
        })
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        await expect(notCharted.locator('summary')).toHaveText(
            'Not charted (2)'
        )
        expect(await notCharted.evaluate((d) => d.open)).toBe(false)
        await expect(reasons.first()).toBeHidden()

        // ...and are a keyboard press away.
        await notCharted.locator('summary').focus()
        await page.keyboard.press('Enter')
        await expect(reasons.first()).toBeVisible()
        await expect(reasons).toHaveText([
            'Roads: Vector layer: features carry no raster measurements to chart.',
            'Basemap: Pre-rendered tiles: colours only, no numeric source values.',
        ])

        // Nothing chartable again: shown again by default on a new render
        // unless the person opened/closed it themselves (they did: kept).
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = false
            window.__h.controller.refresh()
        })
        await expect.poll(() => notCharted.evaluate((d) => d.open)).toBe(true)
    })

    test('readings table, chart name and status are available to assistive tech', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        const ch4 = page.locator('[data-layer="ch4"]')
        await expect(ch4.locator('canvas')).toHaveCount(1)

        // the panel is a labelled region with a heading per layer
        const panel = page.locator('#identifierTimeSeriesPanel')
        await expect(panel).toHaveAttribute(
            'aria-labelledby',
            'identifierTimeSeriesPanel_title'
        )
        await expect(
            page.getByRole('heading', { name: 'Methane' })
        ).toBeVisible()

        // the chart canvas has an accessible name summarising it
        const img = ch4.getByRole('img')
        await expect(img).toHaveAttribute(
            'aria-label',
            /Methane: 12 acquisitions from 2024-01-01 00:00:00 UTC to 2024-03-18 00:00:00 UTC, 11 readings with a value/
        )

        // the readings, one row per acquisition with its id and gap reason
        const table = ch4.locator('details.identifierTimeSeriesPanel_readings')
        await expect(table.locator('summary')).toHaveText('Readings table (12)')
        await table.locator('summary').click()
        const rows = table.locator('tbody tr')
        await expect(rows).toHaveCount(12)
        await expect(table.locator('thead th')).toHaveText([
            'Acquired (UTC)',
            'Acquisition ID',
            'b1 (ppm m)',
        ])
        await expect(rows.nth(0).locator('th, td')).toHaveText([
            '2024-01-01 00:00:00 UTC',
            'item0',
            '10',
        ])
        await expect(rows.nth(4).locator('th, td')).toHaveText([
            '2024-01-29 00:00:00 UTC',
            'item4',
            'no data',
        ])
        await expect(table.locator('caption')).toHaveText(
            'Methane readings at the selected point'
        )

        // a polite live region says when the charts are ready
        await expect(page.getByRole('status')).toHaveText(
            'Time series ready: 1 chart.'
        )
    })

    test('keyboard: Escape and the close button close and return focus', async ({
        page,
    }) => {
        await openHarness(page, { withReturnFocus: true })
        await page.evaluate(() =>
            window.__h.controller.selectPoint(1, 2, { fromKeyboard: true })
        )
        // opened from the keyboard: focus moves to the panel's heading
        await expect(
            page.locator('#identifierTimeSeriesPanel_title')
        ).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0)
        await expect(page.locator('#mapStandIn')).toBeFocused()
        expect(await page.evaluate(() => window.__h.marker.at)).toBeNull()

        await page.evaluate(() =>
            window.__h.controller.selectPoint(1, 2, { fromKeyboard: true })
        )
        const close = page.getByRole('button', { name: 'Close time series' })
        await close.focus()
        await page.keyboard.press('Enter')
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0)
        await expect(page.locator('#mapStandIn')).toBeFocused()
    })

    test('a pointer close leaves focus alone and Escape does not reach the map', async ({
        page,
    }) => {
        await openHarness(page, { withReturnFocus: true })
        await page.evaluate(() => {
            window.__mapKeys = 0
            document
                .getElementById('splitscreens')
                .addEventListener('keydown', () => window.__mapKeys++)
            window.__h.controller.selectPoint(1, 2)
        })
        // opened by a pointer click: focus is not moved
        await expect(
            page.locator('#identifierTimeSeriesPanel_title')
        ).not.toBeFocused()
        await page.locator('#identifierTimeSeriesPanel_title').focus()
        await page.keyboard.press('Escape')
        expect(await page.evaluate(() => window.__mapKeys)).toBe(0)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await page.getByRole('button', { name: 'Close time series' }).click()
        await expect(page.locator('#mapStandIn')).not.toBeFocused()
    })

    test('another click moves the marker and replaces the chart', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        const first = await page.evaluate(() => {
            window.__first = window.__h.instance()
            return window.__first.getOption().series[0].data[0].value[1]
        })
        expect(first).toBe(10)

        await page.evaluate(() => window.__h.controller.selectPoint(3, 4))
        await expect(
            page.locator('.identifierTimeSeriesPanel_coords')
        ).toHaveText('4.00000, 3.00000')
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(1)
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        const r = await page.evaluate(() => ({
            oldDisposed: window.__first.isDisposed(),
            v: window.__h.instance().getOption().series[0].data[0].value[1],
            marker: window.__h.marker.at,
        }))
        expect(r).toEqual({ oldDisposed: true, v: 30, marker: [3, 4] })
    })

    test("the chart follows its panel's size", async ({ page }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        const before = await page.evaluate(() =>
            window.__h.instance().getWidth()
        )
        await page.evaluate(() => {
            document.getElementById('identifierTimeSeriesPanel').style.width =
                '600px'
        })
        await expect
            .poll(() => page.evaluate(() => window.__h.instance().getWidth()))
            .toBeGreaterThan(before + 150)
    })

    test('the close button removes the panel, marker and charts', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        await page.evaluate(() => (window.__inst = window.__h.instance()))
        await page.locator('.identifierTimeSeriesPanel_close').click()
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0)
        const r = await page.evaluate(() => ({
            disposed: window.__inst.isDisposed(),
            marker: window.__h.marker.at,
            open: window.__h.controller.isOpen(),
        }))
        expect(r).toEqual({ disposed: true, marker: null, open: false })
        // the next click opens it again
        await page.evaluate(() => window.__h.controller.selectPoint(5, 5))
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(1)
    })

    test('clicks inside the panel do not reach the map under it', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => {
            window.__mapClicks = 0
            document
                .getElementById('splitscreens')
                .addEventListener('click', () => window.__mapClicks++)
            window.__h.controller.selectPoint(1, 2)
        })
        await page
            .locator('.identifierTimeSeriesPanel_layerName')
            .first()
            .click()
        expect(await page.evaluate(() => window.__mapClicks)).toBe(0)
    })

    test('mousedown/mouseup inside the panel still reach document-level listeners', async ({
        page,
    }) => {
        // the app closes menus and dropdowns on a mousedown outside them
        // (Search, colour pickers) and ends drags on a mouseup anywhere
        // (tool-panel resize, sliders): a press or release over this panel
        // must not be hidden from them. Clicks still stop at the panel.
        await openHarness(page)
        await page.evaluate(() => {
            window.__doc = { down: 0, up: 0 }
            document.addEventListener('mousedown', () => window.__doc.down++)
            document.addEventListener('mouseup', () => window.__doc.up++)
            window.__splitClicks = 0
            document
                .getElementById('splitscreens')
                .addEventListener('click', () => window.__splitClicks++)
            window.__h.controller.selectPoint(1, 2)
        })
        await page
            .locator('.identifierTimeSeriesPanel_layerName')
            .first()
            .click()
        expect(await page.evaluate(() => window.__doc)).toEqual({
            down: 1,
            up: 1,
        })
        expect(await page.evaluate(() => window.__splitClicks)).toBe(0)
        // a drag that started elsewhere and is released over the panel ends
        const title = await page
            .locator('.identifierTimeSeriesPanel_title')
            .boundingBox()
        await page.mouse.move(5, 650)
        await page.mouse.down()
        await page.mouse.move(title.x + 5, title.y + 5)
        await page.mouse.up()
        expect(await page.evaluate(() => window.__doc.up)).toBe(2)
    })

    test('destroy (Identifier turned off) leaves nothing behind', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        await page.evaluate(() => {
            window.__inst = window.__h.instance()
            window.__h.controller.destroy()
        })
        await expect(page.locator('#identifierTimeSeriesPanel')).toHaveCount(0)
        expect(await page.evaluate(() => window.__inst.isDisposed())).toBe(true)
        expect(await page.evaluate(() => window.__h.marker.at)).toBeNull()
    })

    test('names are escaped into the panel, not parsed as markup', async ({
        page,
    }) => {
        await openHarness(page)
        await page.evaluate(() => {
            window.__h.layers.data.roads.display_name =
                '<img src=x onerror="window.__xss=1">'
            window.__h.controller.selectPoint(1, 2)
        })
        await expect(
            page.locator('.identifierTimeSeriesPanel_unsupported li').first()
        ).toContainText('<img src=x')
        expect(await page.evaluate(() => window.__xss)).toBeUndefined()
    })
})

test.describe('finding B - acquisitions without a usable value', () => {
    // every acquisition is a gap, each for its own reason
    const ALL_GAPS = {
        status: 'empty',
        kind: 'all-gaps',
        message: 'No usable values could be read at this point.',
        notes: [],
        incomplete: [],
        series: [
            {
                name: 'b1',
                units: 'ppm m',
                points: [
                    {
                        time: Date.UTC(2024, 0, 2),
                        value: null,
                        status: 'nodata',
                        itemId: 'g-nodata',
                        range: null,
                    },
                    {
                        time: Date.UTC(2024, 0, 9),
                        value: null,
                        status: 'missing',
                        itemId: 'g-missing',
                        range: null,
                    },
                    {
                        time: Date.UTC(2024, 0, 16),
                        value: null,
                        status: 'invalid',
                        itemId: 'g-invalid',
                        range: null,
                    },
                ],
            },
        ],
    }
    const NONE = {
        status: 'empty',
        kind: 'no-acquisitions',
        message: 'No acquisitions cover this point in the selected time range.',
        notes: [],
        incomplete: [],
    }
    const section = (page, uuid) =>
        page.locator(`#identifierTimeSeriesPanel [data-layer="${uuid}"]`)

    async function only(page, responses) {
        await page.evaluate((r) => {
            const h = window.__h
            h.layers.on = { ch4: true }
            h.responses = Object.fromEntries(
                Object.entries(r).map(([k, v]) => [k, () => v])
            )
        }, responses)
    }

    test('an all-gap history: no chart, a message, and a readings table with every acquisition and its reason', async ({
        page,
    }) => {
        await openHarness(page)
        await only(page, { ch4: ALL_GAPS })
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        const s = section(page, 'ch4')
        await expect(s.locator('.identifierTimeSeriesPanel_status')).toHaveText(
            'No usable values could be read at this point.'
        )
        // no line is drawn, and nothing claims to be a chart
        await expect(s.locator('canvas')).toHaveCount(0)
        await expect(s.locator('[role="img"]')).toHaveCount(0)
        // the table is shown, opened, and lists each acquisition
        const details = s.locator('details.identifierTimeSeriesPanel_readings')
        await expect(details).toBeVisible()
        await expect(details).toHaveJSProperty('open', true)
        await expect(details.locator('summary')).toHaveText(
            'Readings table (3)'
        )
        const rows = await details
            .locator('tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) => [...tr.children].map((c) => c.textContent))
            )
        expect(rows).toEqual([
            ['2024-01-02 00:00:00 UTC', 'g-nodata', 'no data'],
            ['2024-01-09 00:00:00 UTC', 'g-missing', 'no reading'],
            ['2024-01-16 00:00:00 UTC', 'g-invalid', 'invalid value'],
        ])
        // and is reachable by keyboard: Tab reaches its summary
        await page.locator('.identifierTimeSeriesPanel_title').focus()
        let reached = false
        for (let i = 0; i < 15 && !reached; i++) {
            await page.keyboard.press('Tab')
            reached = await details
                .locator('summary')
                .evaluate((el) => el === document.activeElement)
        }
        expect(reached).toBe(true)
        // every column - the reasons included - fits in view, however long
        // the STAC item ids are (no sideways scrolling to find the value)
        const fit = await details.evaluate((d) => {
            const wrap = d.querySelector('.identifierTimeSeriesPanel_tableWrap')
            const right = wrap.getBoundingClientRect().right
            return [...d.querySelectorAll('tr')].map(
                (tr) =>
                    tr.lastElementChild.getBoundingClientRect().right - right
            )
        })
        for (const over of fit) expect(over).toBeLessThanOrEqual(1)
        // the caption names it for assistive tech
        await expect(details.locator('caption')).toContainText(
            'readings at the selected point'
        )
    })

    test('STAC item ids and band names reach the readings table as text, not markup', async ({
        page,
    }) => {
        await openHarness(page)
        const evil = '<img src=x onerror="window.__xss=1">'
        await only(page, {
            ch4: {
                ...ALL_GAPS,
                series: [
                    {
                        ...ALL_GAPS.series[0],
                        name: evil,
                        points: [
                            { ...ALL_GAPS.series[0].points[0], itemId: evil },
                        ],
                    },
                ],
            },
        })
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        const details = section(page, 'ch4').locator(
            'details.identifierTimeSeriesPanel_readings'
        )
        await expect(details.locator('tbody td').first()).toHaveText(evil)
        await expect(details.locator('thead th').last()).toHaveText(
            `${evil} (ppm m)`
        )
        await expect(details.locator('img')).toHaveCount(0)
        expect(await page.evaluate(() => window.__xss)).toBeUndefined()
    })

    test('real-length STAC item ids wrap; times and values stay in view', async ({
        page,
    }) => {
        await openHarness(page)
        const long = (n) =>
            `EMIT_L2B_CH4ENH_002_20240130T2047${n}_2403014_00${n}`
        await only(page, {
            ch4: {
                status: 'ok',
                notes: [],
                incomplete: [],
                series: [
                    {
                        name: 'b1',
                        units: 'ppm',
                        points: [0, 1, 2].map((i) => ({
                            time: Date.UTC(2024, 0, 30, 20, 47, i),
                            value: i === 1 ? null : 240 + i,
                            status: i === 1 ? 'nodata' : 'ok',
                            itemId: long(i),
                            range: null,
                        })),
                    },
                ],
            },
        })
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        const details = section(page, 'ch4').locator(
            'details.identifierTimeSeriesPanel_readings'
        )
        await details.locator('summary').click()
        const cells = await details.evaluate((d) => {
            const wrap = d.querySelector('.identifierTimeSeriesPanel_tableWrap')
            const right = wrap.getBoundingClientRect().right
            return [...d.querySelectorAll('tbody tr')].map((tr) => ({
                over: tr.lastElementChild.getBoundingClientRect().right - right,
                text: tr.lastElementChild.textContent,
                // times and values are kept on one line
                nowrap: [tr.firstElementChild, tr.lastElementChild].every(
                    (c) => getComputedStyle(c).whiteSpace === 'nowrap'
                ),
            }))
        })
        expect(cells.map((c) => c.text)).toEqual(['240', 'no data', '242'])
        for (const c of cells) {
            expect(c.over).toBeLessThanOrEqual(1)
            expect(c.nowrap).toBe(true)
        }
        // the whole id is still there, as text
        await expect(details.locator('tbody td').first()).toHaveText(long(0))
    })

    test('no acquisitions: the message only, no table', async ({ page }) => {
        await openHarness(page)
        await only(page, { ch4: NONE })
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        const s = section(page, 'ch4')
        await expect(s.locator('.identifierTimeSeriesPanel_status')).toHaveText(
            'No acquisitions cover this point in the selected time range.'
        )
        await expect(
            s.locator('details.identifierTimeSeriesPanel_readings')
        ).toBeHidden()
    })

    test('moving between a chart, an all-gap history and no acquisitions redraws each correctly', async ({
        page,
    }) => {
        await openHarness(page)
        // lng 1: chart; lng 2: all gaps; lng 3: nothing
        await page.evaluate(
            ([gaps, none]) => {
                const h = window.__h
                h.layers.on = { ch4: true }
                h.responses = {
                    ch4: (lng) =>
                        lng === 2
                            ? gaps
                            : lng === 3
                              ? none
                              : {
                                    status: 'ok',
                                    notes: [],
                                    incomplete: [],
                                    series: [
                                        {
                                            name: 'b1',
                                            units: 'ppm m',
                                            points: [
                                                {
                                                    time: Date.UTC(2024, 0, 2),
                                                    value: 5,
                                                    status: 'ok',
                                                    itemId: 'v1',
                                                    range: null,
                                                },
                                                {
                                                    time: Date.UTC(2024, 0, 9),
                                                    value: null,
                                                    status: 'nodata',
                                                    itemId: 'v2',
                                                    range: null,
                                                },
                                                {
                                                    time: Date.UTC(2024, 0, 16),
                                                    value: 7,
                                                    status: 'ok',
                                                    itemId: 'v3',
                                                    range: null,
                                                },
                                            ],
                                        },
                                    ],
                                },
                }
            },
            [ALL_GAPS, NONE]
        )
        const s = section(page, 'ch4')
        const details = s.locator('details.identifierTimeSeriesPanel_readings')
        const cells = () =>
            details
                .locator('tbody tr')
                .evaluateAll((trs) =>
                    trs.map((tr) => [...tr.children].map((c) => c.textContent))
                )

        // mixed: a chart, the gap kept as a gap in the table
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(s.locator('canvas')).toHaveCount(1)
        expect(await cells()).toEqual([
            ['2024-01-02 00:00:00 UTC', 'v1', '5'],
            ['2024-01-09 00:00:00 UTC', 'v2', 'no data'],
            ['2024-01-16 00:00:00 UTC', 'v3', '7'],
        ])
        // the line has a real gap there, not a 0
        const data = await page.evaluate(() => {
            const el = document.querySelector(
                '#identifierTimeSeriesPanel [data-layer="ch4"] .identifierTimeSeriesPanel_chart'
            )
            return window.echarts
                .getInstanceByDom(el)
                .getOption()
                .series[0].data.map((d) => d.value[1])
        })
        expect(data).toEqual([5, null, 7])

        // all gaps: the chart goes, the table stays with the new rows
        await page.evaluate(() => window.__h.controller.selectPoint(2, 2))
        await expect(s.locator('canvas')).toHaveCount(0)
        await expect(details).toBeVisible()
        expect((await cells()).map((r) => r[1])).toEqual([
            'g-nodata',
            'g-missing',
            'g-invalid',
        ])

        // nothing: no table left over from the last point
        await page.evaluate(() => window.__h.controller.selectPoint(3, 2))
        await expect(s.locator('.identifierTimeSeriesPanel_status')).toHaveText(
            'No acquisitions cover this point in the selected time range.'
        )
        await expect(details).toBeHidden()

        // and back to a chart
        await page.evaluate(() => window.__h.controller.selectPoint(1, 2))
        await expect(s.locator('canvas')).toHaveCount(1)
        expect(await page.evaluate(() => window.__h.controller.isOpen())).toBe(
            true
        )
    })
})
