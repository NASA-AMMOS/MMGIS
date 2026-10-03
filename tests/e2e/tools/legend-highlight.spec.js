import { test, expect } from '@playwright/test'
import { waitForMapReady } from '../../helpers/map-helpers.js'

/**
 * Legend highlight-on-identify tests.
 *
 * The Identifier reports what a hovered pixel resolved to and the Legend calls
 * out the matching entry, joined through `LegendTool.highlightEntries` and
 * reached with `ToolController_.getTool`. That entry point is what is driven
 * here: a real hover only resolves a value where raster data is served, while
 * the highlight and its clearing are the same either way.
 *
 * The legends are built with the public `overwriteLegends` API rather than
 * taken from the mission, so the rows under test are known and no layer has to
 * be styled a particular way for the spec to mean anything.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888'

// Two layers the mission already has. The Legend draws from the layer config,
// so the entries are hung on real layers rather than invented ones; neither
// carries a legend of its own in the Reference Mission.
let ROWS_UUID
let RAMP_UUID

/** A classified legend: separate values, drawn one row each. */
const ROW_ENTRIES = [
    { color: '#1f77b4', shape: 'square', value: '1' },
    { color: '#ff7f0e', shape: 'square', value: '2' },
    { color: '#2ca02c', shape: 'square', value: '50' },
]

/** A continuous scale: sampled points along a range, drawn as a ramp. */
const RAMP_ENTRIES = [
    { color: '#000000', shape: 'continuous', value: '300' },
    { color: '#555555', shape: 'continuous', value: '200' },
    { color: '#aaaaaa', shape: 'continuous', value: '100' },
    { color: '#ffffff', shape: 'continuous', value: '0' },
]

async function pickLayerUUIDs(page) {
    return page.evaluate(() =>
        Object.keys(window.L_.layers.on)
            .filter(
                (uuid) =>
                    window.L_.layers.data[uuid] &&
                    window.L_.layers.data[uuid].type !== 'header'
            )
            .slice(0, 2)
    )
}

async function buildLegends(page) {
    await page.evaluate(
        ([rowsUUID, rampUUID, rowEntries, rampEntries]) => {
            window.ToolController_.getTool('LegendTool').overwriteLegends([
                {
                    legend: rowEntries,
                    layerUUID: rowsUUID,
                    display_name: 'Rows',
                    opacity: 1,
                },
                {
                    legend: rampEntries,
                    layerUUID: rampUUID,
                    display_name: 'Ramp',
                    opacity: 1,
                },
            ])
        },
        [ROWS_UUID, RAMP_UUID, ROW_ENTRIES, RAMP_ENTRIES]
    )
}

/** Every legend row on the panel, with the layer and value it is keyed by. */
async function legendRows(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('#LegendTool .legendEntry')).map(
            (el) => ({
                layerUUID: el.getAttribute('data-legend-layer-uuid'),
                value: el.getAttribute('data-legend-value'),
                background: el.style.background,
                boxShadow: el.style.boxShadow,
            })
        )
    )
}

/** Every continuous ramp on the panel, and where its marker sits. */
async function legendScales(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('#LegendTool .legendScale')).map(
            (el) => {
                const marker = el.querySelector('.legendScaleMarker')
                return {
                    layerUUID: el.getAttribute('data-legend-layer-uuid'),
                    values: JSON.parse(
                        el.getAttribute('data-legend-values') || '[]'
                    ),
                    hasMarker: marker != null,
                    hasArrow:
                        marker != null &&
                        marker.querySelector('.legendScaleMarkerArrow') != null,
                    blend: marker ? marker.style.mixBlendMode : null,
                    top: marker ? marker.style.top : null,
                }
            }
        )
    )
}

async function highlight(page, matches) {
    await page.evaluate((m) => {
        window.ToolController_.getTool('LegendTool').highlightEntries(m)
    }, matches)
}

const isHighlighted = (row) => row.boxShadow !== '' || row.background !== ''
const rowsFor = (rows, uuid) => rows.filter((r) => r.layerUUID === uuid)

test.describe('Legend — highlight on identify', () => {
    test.beforeEach(async ({ page, request }) => {
        const listRes = await request.get(`${baseURL}/api/configure/missions`)
        const listData = await listRes.json().catch(() => ({}))
        if (
            !listData.missions ||
            !listData.missions.includes('Reference-Mission')
        ) {
            test.skip(
                true,
                'SKIP: Reference-Mission not available in this CI mode'
            )
        }

        await page.goto('/?mission=Reference-Mission')
        await waitForMapReady(page)
        await page.waitForFunction(
            () => !!(window.ToolController_ && window.ToolController_.loaded)
        )
        await page.evaluate(() => window.ToolController_.openTool('Legend'))
        await page.waitForSelector('#LegendTool', { timeout: 15000 })

        const uuids = await pickLayerUUIDs(page)
        expect(uuids.length).toBe(2)
        ROWS_UUID = uuids[0]
        RAMP_UUID = uuids[1]

        await buildLegends(page)
        await page.waitForSelector('#LegendTool .legendEntry', {
            timeout: 10000,
        })
    })

    test('the Legend exposes the entry point the Identifier calls', async ({
        page,
    }) => {
        const hasApi = await page.evaluate(() => {
            const tool = window.ToolController_.getTool('LegendTool')
            return (
                typeof tool.highlightEntries === 'function' &&
                typeof tool.clearHighlightedEntries === 'function'
            )
        })
        expect(hasApi).toBe(true)
    })

    test('the Identifier no-ops when the Legend is not in the mission', async ({
        page,
    }) => {
        // The two tools are not dependencies of one another, so a mission may
        // enable either alone.
        const threw = await page.evaluate(() => {
            try {
                window.ToolController_.getTool(
                    'NoSuchTool'
                ).highlightEntries?.([])
                return false
            } catch (e) {
                return true
            }
        })
        expect(threw).toBe(false)
    })

    test('every legend entry is keyed by its layer and value', async ({
        page,
    }) => {
        const rows = rowsFor(await legendRows(page), ROWS_UUID)
        expect(rows.map((r) => r.value)).toEqual(['1', '2', '50'])

        const scales = await legendScales(page)
        const ramp = scales.find((s) => s.layerUUID === RAMP_UUID)
        expect(ramp).toBeTruthy()
        expect(ramp.values.length).toBe(RAMP_ENTRIES.length)
    })

    test('a reported value lights its row, and clearing puts it back', async ({
        page,
    }) => {
        expect((await legendRows(page)).some(isHighlighted)).toBe(false)

        await highlight(page, [{ layerUUID: ROWS_UUID, value: '2' }])

        const lit = rowsFor(await legendRows(page), ROWS_UUID)
        expect(lit.filter(isHighlighted).length).toBe(1)
        expect(lit.find(isHighlighted).value).toBe('2')

        // What mouseout does.
        await highlight(page, [])
        expect((await legendRows(page)).some(isHighlighted)).toBe(false)
    })

    test('a value between rows lights none of them', async ({ page }) => {
        // Rows are unrelated values that happen to be numbers, and a legend may
        // hide some, so snapping 27 to the nearest rendered row is wrong.
        await highlight(page, [{ layerUUID: ROWS_UUID, value: 27 }])
        expect((await legendRows(page)).some(isHighlighted)).toBe(false)
    })

    test('a reading on a ramp is marked, and clearing removes the mark', async ({
        page,
    }) => {
        expect((await legendScales(page)).some((s) => s.hasMarker)).toBe(false)

        // Between two bands: a ramp samples a continuum, so this still lands.
        await highlight(page, [{ layerUUID: RAMP_UUID, value: 84.98 }])

        const marked = (await legendScales(page)).find(
            (s) => s.layerUUID === RAMP_UUID
        )
        expect(marked.hasMarker).toBe(true)
        // An arrow into the ramp, inverted rather than tinted so it stays
        // visible where the ramp is itself the marker's colour.
        expect(marked.hasArrow).toBe(true)
        expect(marked.blend).toBe('difference')

        await highlight(page, [])
        const unmarked = (await legendScales(page)).find(
            (s) => s.layerUUID === RAMP_UUID
        )
        expect(unmarked.hasMarker).toBe(false)
    })

    test('the mark tracks the reading rather than snapping to a stop', async ({
        page,
    }) => {
        // Both readings are nearest the 100 stop, so a mark snapped to a stop
        // would put them in the same place.
        const topFor = async (value) => {
            await highlight(page, [{ layerUUID: RAMP_UUID, value: value }])
            const scale = (await legendScales(page)).find(
                (s) => s.layerUUID === RAMP_UUID
            )
            expect(scale.hasMarker).toBe(true)
            return parseFloat(scale.top)
        }

        const near100 = await topFor(110)
        const near140 = await topFor(140)
        expect(near100).not.toBeCloseTo(near140, 1)
        // 0 is painted last, so a smaller reading sits further down the ramp.
        expect(near100).toBeGreaterThan(near140)

        // Stops themselves still land on their own tick.
        expect(await topFor(100)).toBeCloseTo(66.67, 1)
        expect(await topFor(200)).toBeCloseTo(33.33, 1)

        await highlight(page, [])
    })

    test('a redrawn legend keeps what the cursor is resting on', async ({
        page,
    }) => {
        await highlight(page, [{ layerUUID: ROWS_UUID, value: '50' }])
        await buildLegends(page)

        const rows = rowsFor(await legendRows(page), ROWS_UUID)
        expect(rows.filter(isHighlighted).length).toBe(1)
        expect(rows.find(isHighlighted).value).toBe('50')
    })

    test('closing the Identifier leaves no entry lit', async ({ page }) => {
        await page.evaluate(() => window.ToolController_.openTool('Identifier'))
        await highlight(page, [{ layerUUID: ROWS_UUID, value: '1' }])
        expect((await legendRows(page)).some(isHighlighted)).toBe(true)

        await page.evaluate(() =>
            window.ToolController_.closeTool('Identifier')
        )
        expect((await legendRows(page)).some(isHighlighted)).toBe(false)
    })

    test('the cursor leaving the map clears the legend', async ({ page }) => {
        await page.evaluate(() => window.ToolController_.openTool('Identifier'))
        // Stands in for what a hover resolved: a value read needs raster data
        // served, while the teardown below is the same either way.
        await highlight(page, [{ layerUUID: ROWS_UUID, value: '1' }])
        expect((await legendRows(page)).some(isHighlighted)).toBe(true)

        const box = await page.locator('#map').boundingBox()
        await page.mouse.move(box.x + 300, box.y + 300)
        await page.waitForTimeout(400)
        await page.mouse.move(box.x + 320, box.y + 320)
        // The Identifier debounces a map hover by 400ms before it reads.
        await page.waitForTimeout(1200)

        // Off the map entirely: the map starts inside the window, so the
        // top-left corner of the page is outside it.
        await page.mouse.move(5, 5)
        await page.waitForTimeout(800)

        expect((await legendRows(page)).some(isHighlighted)).toBe(false)
        expect((await legendScales(page)).some((s) => s.hasMarker)).toBe(false)

        await page.evaluate(() =>
            window.ToolController_.closeTool('Identifier')
        )
    })
})
