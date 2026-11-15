import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Identifier click guard with real Leaflet and real mouse clicks (#1159).
 *
 * The Identifier stays on while toolbar tools come and go, so its map-click
 * handler must leave alone clicks a tool or a feature is using - and those
 * still have to reach their own handlers. Tools are stood in for by objects
 * that register handlers exactly as the real ones do (Measure sets
 * disableLayerInteractions and listens on the map; Sightline/Viewshed listen
 * with a method; Draw and Animation keep the handler in a nested object).
 */

const ROOT = path.resolve(__dirname, '../..')
const ORIGIN = 'http://identifier-guard.test'
const TYPES = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
}

const PAGE = `<!doctype html><html><head>
<link rel="stylesheet" href="/node_modules/leaflet/dist/leaflet.css">
<script src="/node_modules/leaflet/dist/leaflet.js"></script>
</head><body style="margin:0">
<div id="map" style="width:800px;height:600px"></div>
</body></html>`

async function openHarness(page, { preferCanvas = false } = {}) {
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
    await page.evaluate(async (preferCanvas) => {
        const guard =
            await import('/plugins/core/tools/Identifier/IdentifierClickGuard.js')
        const map = window.L.map('map', { preferCanvas }).setView([0, 0], 5)
        const h = {
            map,
            activeTool: null,
            charted: [],
            toolClicks: 0,
            featureClicks: 0,
        }
        // The Identifier's handler, registered first as it is when the
        // Identifier opens before a toolbar tool.
        h.identifierClick = (e) => {
            if (shouldChart(e)) h.charted.push([e.latlng.lng, e.latlng.lat])
        }
        const shouldChart = (e) =>
            guard.shouldChartMapClick(e, { activeTool: h.activeTool, map })
        map.on('click', h.identifierClick)

        // A clickable feature, as Map_.onEachFeatureDefault wires one.
        h.feature = window.L.geoJSON(
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [4, -2],
                            [8, -2],
                            [8, 2],
                            [4, 2],
                            [4, -2],
                        ],
                    ],
                },
            },
            {
                onEachFeature: (f, layer) =>
                    layer.on('click', () => h.featureClicks++),
            }
        ).addTo(map)

        const onToolClick = () => h.toolClicks++
        h.tools = {
            // Measure: sets the flag and listens with a method of its own
            measure: { disableLayerInteractions: true, clickMap: onToolClick },
            // Sightline: a method of its own on the map
            sightline: { _onMapClick: onToolClick },
            // Animation: handler kept in a plain object
            animation: { drawingHandlers: { click: onToolClick } },
            // Viewshed: a method of its own on the map
            viewshed: { setSource: onToolClick },
            // Draw: handler two levels down, only while drawing
            draw: { drawing: { polygon: { start: onToolClick } } },
        }
        // An unrelated listener, as MMGIS's own clearOnMapClick
        h.unrelatedClicks = 0
        map.on('click', () => h.unrelatedClicks++)
        h.open = (name) => {
            h.activeTool = h.tools[name]
            const t = h.activeTool
            const fn =
                t.clickMap ||
                t._onMapClick ||
                t.setSource ||
                t.drawingHandlers?.click ||
                t.drawing?.polygon?.start
            map.on('click', fn)
            h.close = () => {
                map.off('click', fn)
                h.activeTool = null
            }
        }
        window.__h = h
    }, preferCanvas)
    // The canvas renderer draws (and can hit-test) on an animation frame.
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                window.__h.map.whenReady(() =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
            )
    )
    await page.waitForFunction(() => {
        const layer = window.__h.feature.getLayers()[0]
        return !!(layer && layer._pxBounds && layer._pxBounds.isValid())
    })
}

// Screen points: an empty part of the map, and inside the feature.
async function points(page) {
    const box = await page.locator('#map').boundingBox()
    const at = (lng, lat) =>
        page.evaluate(
            ([lng, lat]) => window.__h.map.latLngToContainerPoint([lat, lng]),
            [lng, lat]
        )
    const empty = await at(-6, 0)
    const feature = await at(6, 0)
    return {
        empty: { x: box.x + empty.x, y: box.y + empty.y },
        feature: { x: box.x + feature.x, y: box.y + feature.y },
    }
}

const state = (page) =>
    page.evaluate(() => ({
        charted: window.__h.charted.length,
        toolClicks: window.__h.toolClicks,
        featureClicks: window.__h.featureClicks,
    }))

test.describe('Identifier click guard (real Leaflet)', () => {
    test('with no tool open, an empty-map click is charted', async ({
        page,
    }) => {
        await openHarness(page)
        const p = await points(page)
        await page.mouse.click(p.empty.x, p.empty.y)
        expect(await state(page)).toEqual({
            charted: 1,
            toolClicks: 0,
            featureClicks: 0,
        })
    })

    for (const tool of [
        'measure',
        'sightline',
        'viewshed',
        'animation',
        'draw',
    ]) {
        test(`${tool} open: the tool gets the click, the Identifier doesn't`, async ({
            page,
        }) => {
            await openHarness(page)
            const p = await points(page)
            await page.evaluate((t) => window.__h.open(t), tool)
            await page.mouse.click(p.empty.x, p.empty.y)
            expect(await state(page)).toEqual({
                charted: 0,
                toolClicks: 1,
                featureClicks: 0,
            })
            // closed again: clicks are the Identifier's
            await page.evaluate(() => window.__h.close())
            await page.mouse.click(p.empty.x, p.empty.y)
            expect(await state(page)).toEqual({
                charted: 1,
                toolClicks: 1,
                featureClicks: 0,
            })
        })
    }

    test('this Leaflet is 1.9.4 and listens(type, fn) answers per handler', async ({
        page,
    }) => {
        await openHarness(page)
        const r = await page.evaluate(async () => {
            const guard =
                await import('/plugins/core/tools/Identifier/IdentifierClickGuard.js')
            const map = window.__h.map
            const listens = (t, fn) => map.listens(t, fn)
            return {
                version: window.L.version,
                anything: map.listens('click'),
                identifier: map.listens('click', window.__h.identifierClick),
                notRegistered: map.listens('click', () => {}),
                specific: guard.listensIsHandlerSpecific(listens),
            }
        })
        expect(r).toEqual({
            version: '1.9.4',
            anything: true,
            identifier: true,
            notRegistered: false,
            specific: true,
        })
    })

    test('Draw open but idle: other listeners exist, the click still charts', async ({
        page,
    }) => {
        await openHarness(page)
        const p = await points(page)
        // Draw is the active tool, its start handler is not registered, and
        // two unrelated click listeners are (the Identifier's and another).
        await page.evaluate(() => {
            window.__h.activeTool = window.__h.tools.draw
        })
        await page.mouse.click(p.empty.x, p.empty.y)
        expect(await state(page)).toEqual({
            charted: 1,
            toolClicks: 0,
            featureClicks: 0,
        })
        expect(await page.evaluate(() => window.__h.unrelatedClicks)).toBe(1)
    })

    test('removing the Identifier leaves every other listener in place', async ({
        page,
    }) => {
        await openHarness(page)
        const p = await points(page)
        await page.evaluate(() => window.__h.open('sightline'))
        await page.evaluate(() =>
            window.__h.map.off('click', window.__h.identifierClick)
        )
        const r = await page.evaluate(() => ({
            identifier: window.__h.map.listens(
                'click',
                window.__h.identifierClick
            ),
            tool: window.__h.map.listens(
                'click',
                window.__h.tools.sightline._onMapClick
            ),
        }))
        expect(r).toEqual({ identifier: false, tool: true })
        await page.mouse.click(p.empty.x, p.empty.y)
        expect(await state(page)).toEqual({
            charted: 0,
            toolClicks: 1,
            featureClicks: 0,
        })
        expect(await page.evaluate(() => window.__h.unrelatedClicks)).toBe(1)
    })

    test('a feature click selects the feature and is not charted (SVG)', async ({
        page,
    }) => {
        await openHarness(page)
        const p = await points(page)
        await page.mouse.click(p.feature.x, p.feature.y)
        expect(await state(page)).toEqual({
            charted: 0,
            toolClicks: 0,
            featureClicks: 1,
        })
    })

    test('a feature click selects the feature and is not charted (canvas)', async ({
        page,
    }) => {
        await openHarness(page, { preferCanvas: true })
        const p = await points(page)
        await page.mouse.click(p.feature.x, p.feature.y)
        expect(await state(page)).toEqual({
            charted: 0,
            toolClicks: 0,
            featureClicks: 1,
        })
        // Past the double-click window, so this is a click, not a dblclick.
        await page.waitForTimeout(700)
        await page.mouse.click(p.empty.x, p.empty.y)
        await expect.poll(async () => (await state(page)).charted).toBe(1)
    })

    test('a drag is not a click', async ({ page }) => {
        await openHarness(page)
        const p = await points(page)
        await page.mouse.move(p.empty.x, p.empty.y)
        await page.mouse.down()
        await page.mouse.move(p.empty.x + 80, p.empty.y + 40, { steps: 5 })
        await page.mouse.up()
        expect((await state(page)).charted).toBe(0)
    })
})
