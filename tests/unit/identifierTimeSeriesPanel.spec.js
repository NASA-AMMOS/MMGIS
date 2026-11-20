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

async function openHarness(page) {
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
    await page.evaluate(async () => {
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
    })
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
        await expect(
            panel.locator('.identifierTimeSeriesPanel_unsupported')
        ).toBeHidden()

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

    test('Not charted only appears when no chart is displayed', async ({ page }) => {
        await openHarness(page)
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = false
            window.__h.controller.selectPoint(10, 20)
        })
        const notCharted = page.locator('.identifierTimeSeriesPanel_unsupported')
        await expect(notCharted).toBeVisible()
        await expect(notCharted).toContainText('Not charted')
        await expect(page.locator('#identifierTimeSeriesPanel canvas')).toHaveCount(0)

        // When a real chart appears, the unsupported summary is hidden.
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = true
            window.__h.controller.refresh()
        })
        await expect(page.locator('[data-layer="ch4"] canvas')).toHaveCount(1)
        await expect(notCharted).toBeHidden()

        // It reappears after a refresh that cannot plot any chart.
        await page.evaluate(() => {
            window.__h.layers.on.ch4 = false
            window.__h.controller.refresh()
        })
        await expect(notCharted).toBeVisible()
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
