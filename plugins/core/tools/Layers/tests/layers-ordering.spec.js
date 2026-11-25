import { test, expect } from '@playwright/test'
import {
    applyLiveMove,
    descendantsOf,
    flatten,
    replay,
} from '../ordering.js'
const OWN_SUBTREE_BLOCKED_MESSAGE = "You can't drag a group into itself"
const LIGHT_BLOCKED_STATE_THEME = {
    '--color-a': '#ffffff',
    '--color-a1': '#e2e8f0',
    '--color-a1-5': '#edf2f7',
    '--color-a2': '#94a3b8',
    '--color-a5': '#334155',
    '--color-a6': '#1e293b',
    '--color-c': '#0284c7',
    '--color-f': '#0f172a',
    '--color-yellow': '#b45309',
}

async function loadMission(page) {
    await page.goto('/?mission=Reference-Mission')
    await page.waitForLoadState('networkidle', { timeout: 60000 })
    await page.waitForFunction(
        () =>
            !!(
                window.mmgisAPI &&
                window.mmgisAPI.map &&
                window.ToolController_?.getTool('LayersTool')?._debugFlat
            ),
        { timeout: 30000 }
    )
}

async function dragWithMouse(page, handle, target, targetFraction = 0.5) {
    const sourceBox = await handle.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) return false
    const x = sourceBox.x + sourceBox.width / 2
    const y = sourceBox.y + sourceBox.height / 2
    const dropY = targetBox.y + targetBox.height * targetFraction
    await page.mouse.move(x, y)
    await page.waitForTimeout(180)
    await page.mouse.down()
    await page.waitForTimeout(180)
    await page.mouse.move(x + 14, y, { steps: 5 })
    await page.waitForTimeout(180)
    for (let step = 1; step <= 45; step += 1) {
        await page.mouse.move(
            x + 14 * (1 - step / 45),
            y + ((dropY - y) * step) / 45
        )
        await page.waitForTimeout(12)
    }
    await page.waitForTimeout(250)
    await page.mouse.up()
    await page.waitForTimeout(350)
    return true
}

function orderingRowSelector(key) {
    return `#lt-row-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

async function dragRowInfo(page, label) {
    return page.evaluate((requestedLabel) => {
        const rows = window.ToolController_
            .getTool('LayersTool')
            ._debugFlat()
            .map((row) => {
                const element = Array.from(
                    document.querySelectorAll('[data-row-id]')
                ).find(
                    (candidate) =>
                        candidate.getAttribute('data-row-id') === row.key
                )
                return {
                    key: row.key,
                    name: row.name,
                    type: row.type,
                    depth: row.depth,
                    label: row.displayName || row.name,
                    collapsed:
                        element?.querySelector('.lt-chevron')
                            ?.getAttribute('aria-label') ===
                        'Expand group',
                }
            })
        const index = rows.findIndex(
            (row) =>
                row.label === requestedLabel ||
                row.name === requestedLabel
        )
        if (index < 0) return null
        const ancestors = []
        let depth = rows[index].depth
        for (let i = index - 1; i >= 0; i -= 1) {
            if (rows[i].type === 'header' && rows[i].depth < depth) {
                ancestors.push(rows[i])
                depth = rows[i].depth
            }
        }
        return {
            ...rows[index],
            index,
            ancestors: ancestors.reverse(),
        }
    }, label)
}

function orderingRow(page, info) {
    return page.locator(orderingRowSelector(info.key))
}

async function revealDragRow(page, label) {
    const info = await dragRowInfo(page, label)
    if (!info) throw new Error(`Layers row not found: ${label}`)
    for (const ancestor of info.ancestors) {
        if (!ancestor.collapsed) continue
        await orderingRow(page, ancestor).locator('.lt-chevron').click()
    }
    return dragRowInfo(page, label)
}

async function setDragHeaderExpanded(page, label, expanded) {
    const info = await revealDragRow(page, label)
    if (info.type !== 'header')
        throw new Error(`${label} is not a header`)
    const isExpanded = !info.collapsed
    if (isExpanded === expanded) return
    await orderingRow(page, info).locator('.lt-chevron').click()
}

async function prepareDragPage(page) {
    await loadMission(page)
    const flat = await page.evaluate(() =>
        window.ToolController_.getTool('LayersTool')._debugFlat([])
    )
    await page.setViewportSize({
        width: 1500,
        height: Math.min(10000, Math.max(4800, flat.length * 44)),
    })
    await page.locator('#toolButtonLayers').click()
    await page.getByRole('button', { name: 'Expand all' }).click()
    const imagery = await page.evaluate(() => {
        const layer = Object.values(window.L_.layers.data).find(
            (candidate) => candidate.display_name === 'ArcGIS World Imagery'
        )
        return layer
            ? { name: layer.name, on: window.L_.layers.on[layer.name] }
            : null
    })
    if (imagery?.on) {
        const row = orderingRow(
            page,
            await dragRowInfo(page, 'ArcGIS World Imagery')
        )
        await row.locator('[role="checkbox"]').first().click()
        await page.waitForFunction(
            (name) => window.L_.layers.on[name] === false,
            imagery.name
        )
    }
    return flat
}

async function dragPageState(page) {
    return page.evaluate(() => {
        const tool = window.ToolController_.getTool('LayersTool')
        const flat = tool._debugFlat()
        const namesByKey = new Map(
            flat.map((row) => [row.key, row.displayName])
        )
        const renderedRows = Array.from(
            document.querySelectorAll('#layersTool [role="treeitem"]')
        )
        return {
            flat: flat.map(({ name, type, depth }) => ({
                name,
                type,
                depth,
            })),
            keyedFlat: flat.map(({ key, depth }) => ({ key, depth })),
            visibility: renderedRows.map((row) => ({
                key:
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt-row-/, ''),
                name: namesByKey.get(
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt-row-/, '')
                ),
                height: row.getBoundingClientRect().height,
                expanded: row.getAttribute('aria-expanded'),
            })),
            dom: renderedRows.map((row) => ({
                key:
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt-row-/, ''),
                depth: Number(row.getAttribute('aria-level')) - 1,
            })),
            order: window.L_._layersOrdered.slice(),
            history: tool.orderingHistory || [],
        }
    })
}
test.describe('LayersTool ordering behavior', () => {
    async function affectedRows(page, names) {
        return page.evaluate((expectedNames) => {
            const matchingNames = new Set(expectedNames)
            return window.ToolController_
                .getTool('LayersTool')
                ._debugFlat()
                .filter((row) =>
                    matchingNames.has(row.displayName || row.name)
                )
                .map((row) => ({
                    name: row.displayName || row.name,
                    depth: row.depth,
                }))
        }, names)
    }

    async function historyTriples(page) {
        return page.evaluate(() =>
            window.ToolController_
                .getTool('LayersTool')
                .orderingHistory.map((entry) => entry.slice(0, 3))
        )
    }

    async function performInlineDrop(page, {
        source,
        target,
        sourceExpanded,
        targetExpanded,
        targetFraction = 0.5,
    }) {
        await prepareDragPage(page)
        if (sourceExpanded !== undefined)
            await setDragHeaderExpanded(page, source, sourceExpanded)
        if (targetExpanded !== undefined)
            await setDragHeaderExpanded(page, target, targetExpanded)
        const sourceInfo = await revealDragRow(page, source)
        const targetInfo = await revealDragRow(page, target)
        return dragWithMouse(
            page,
            orderingRow(page, sourceInfo).locator('.lt-drag'),
            orderingRow(page, targetInfo),
            targetFraction
        )
    }

    const liveCases = [
        {
            title: 'within group',
            source: 'Points Basic',
            target: 'Lines Basic',
            history: [5, 6, 0],
            rows: [
                ['Geometry Types', 2],
                ['Lines Basic', 3],
                ['Points Basic', 3],
                ['Polygons Basic', 3],
            ],
        },
        {
            title: 'into an expanded header',
            source: 'Points Basic',
            target: 'OSM Buildings',
            history: [5, 2, 2],
            rows: [
                ['Vector Tile Layers', 1],
                ['Points Basic', 2],
                ['OSM Buildings', 2],
                ['📄 GeoJSON Data Features', 1],
                ['Geometry Types', 2],
                ['Lines Basic', 3],
            ],
        },
        {
            title: 'after a collapsed header',
            source: 'Points Basic',
            target: 'Vector Tile Layers',
            targetExpanded: false,
            history: [5, 1, 2],
            rows: [
                ['Vector Layers', 0],
                ['Points Basic', 1],
                ['Vector Tile Layers', 1],
                ['OSM Buildings', 2],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            title: 'onto a collapsed header',
            source: 'OSM Buildings',
            target: 'Geometry Types',
            targetExpanded: false,
            history: [2, 4, 1],
            rows: [
                ['Geometry Types', 2],
                ['Points Basic', 3],
                ['Lines Basic', 3],
                ['Polygons Basic', 3],
                ['Arrows', 3],
                ['Annotations', 3],
                ['OSM Buildings', 2],
                ['Feature Property Styling', 2],
            ],
        },
        {
            title: 'expanded header with children',
            source: 'Vector Tile Layers',
            target: 'Vector Layers',
            sourceExpanded: true,
            history: [1, 0, 0],
            rows: [
                ['Vector Tile Layers', 0],
                ['OSM Buildings', 1],
                ['Vector Layers', 0],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            title: 'collapsed header',
            source: 'Vector Tile Layers',
            target: 'Vector Layers',
            sourceExpanded: false,
            history: [1, 0, 0],
            rows: [
                ['Vector Tile Layers', 0],
                ['OSM Buildings', 1],
                ['Vector Layers', 0],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            title: 'header into its own contents',
            source: 'Vector Tile Layers',
            target: 'OSM Buildings',
            blocked: true,
            rows: [
                ['Vector Layers', 0],
                ['Vector Tile Layers', 1],
                ['OSM Buildings', 2],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            title: 'layer to depth zero',
            source: 'OSM Buildings',
            target: 'Vector Layers',
            history: [2, 0, 0],
            rows: [
                ['OSM Buildings', 0],
                ['Vector Layers', 0],
                ['Vector Tile Layers', 1],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
    ]

    for (const scenario of liveCases) {
        test(`ordering: inline live — ${scenario.title}`, async ({ page }) => {
            await prepareDragPage(page)
            if (scenario.sourceExpanded !== undefined)
                await setDragHeaderExpanded(
                    page,
                    scenario.source,
                    scenario.sourceExpanded
                )
            if (scenario.targetExpanded !== undefined)
                await setDragHeaderExpanded(
                    page,
                    scenario.target,
                    scenario.targetExpanded
                )
            const before = await dragPageState(page)
            const source = await revealDragRow(page, scenario.source)
            const target = await revealDragRow(page, scenario.target)
            await dragWithMouse(
                page,
                orderingRow(page, source).locator('.lt-drag'),
                orderingRow(page, target)
            )

            expect(
                await affectedRows(
                    page,
                    scenario.rows.map(([name]) => name)
                )
            ).toEqual(
                scenario.rows.map(([name, depth]) => ({ name, depth }))
            )

            if (scenario.blocked) {
                const result = await dragPageState(page)
                expect(result.flat).toEqual(before.flat)
                expect(result.keyedFlat).toEqual(before.keyedFlat)
                expect(result.order).toEqual(before.order)
                expect(await historyTriples(page)).toEqual(
                    before.history.map((entry) => entry.slice(0, 3))
                )
                await expect(page.locator('.lt-dropBlockedStatus')).toHaveText(
                    OWN_SUBTREE_BLOCKED_MESSAGE
                )
            } else {
                expect((await historyTriples(page)).at(-1)).toEqual(
                    scenario.history
                )
            }
        })
    }

    const collapsedCases = [
        {
            title: 'source and target collapsed',
            sourceExpanded: false,
            targetExpanded: false,
            history: [3, 57, 1],
            rows: [
                ['Filter Tab', 2],
                ['📄 GeoJSON Data Features', 2],
                ['Geometry Types', 3],
            ],
        },
        {
            title: 'source expanded, target collapsed',
            sourceExpanded: true,
            targetExpanded: false,
            history: [3, 57, 1],
            rows: [
                ['Filter Tab', 2],
                ['📄 GeoJSON Data Features', 2],
                ['Geometry Types', 3],
            ],
        },
        {
            title: 'source collapsed, target expanded',
            sourceExpanded: false,
            targetExpanded: true,
            history: [3, 57, 2],
            rows: [
                ['Filter Tab', 2],
                ['📄 GeoJSON Data Features', 3],
                ['Geometry Types', 4],
            ],
        },
        {
            title: 'second collapsed header pair',
            source: 'Geometry Types',
            sourceExpanded: false,
            targetExpanded: false,
            history: [4, 57, 1],
            rows: [
                ['Filter Tab', 2],
                ['Geometry Types', 2],
                ['Points Basic', 3],
            ],
        },
    ]

    for (const scenario of collapsedCases) {
        test(`ordering: inline collapsed — ${scenario.title}`, async ({
            page,
        }) => {
            const source = scenario.source || '📄 GeoJSON Data Features'
            await prepareDragPage(page)
            await setDragHeaderExpanded(page, source, scenario.sourceExpanded)
            await setDragHeaderExpanded(
                page,
                'Filter Tab',
                scenario.targetExpanded
            )
            const sourceInfo = await revealDragRow(page, source)
            const targetInfo = await revealDragRow(page, 'Filter Tab')
            await dragWithMouse(
                page,
                orderingRow(page, sourceInfo).locator('.lt-drag'),
                orderingRow(page, targetInfo),
                0.8
            )
            expect(
                await affectedRows(
                    page,
                    scenario.rows.map(([name]) => name)
                )
            ).toEqual(
                scenario.rows.map(([name, depth]) => ({ name, depth }))
            )
            expect((await historyTriples(page)).at(-1)).toEqual(
                scenario.history
            )
        })
    }

    test('ordering: inline bottom drop', async ({ page }) => {
        await performInlineDrop(page, {
            source: 'Points Basic',
            target: 'Velocity - Sample particles',
            targetFraction: 0.8,
        })
        expect(
            await affectedRows(page, [
                'Velocity - Sample particles',
                'Points Basic',
            ])
        ).toEqual([
            { name: 'Velocity - Sample particles', depth: 1 },
            { name: 'Points Basic', depth: 1 },
        ])
        expect((await historyTriples(page)).at(-1)).toEqual([5, 101, 0])
    })

    const urlCases = [
        {
            history: [[5, 6, 0]],
            rows: [
                ['Geometry Types', 2],
                ['Lines Basic', 3],
                ['Points Basic', 3],
                ['Polygons Basic', 3],
            ],
        },
        {
            history: [[101, 0, 0]],
            rows: [
                ['Velocity - Sample particles', 0],
                ['Vector Layers', 0],
                ['Vector Tile Layers', 1],
            ],
        },
        {
            history: [[1, 0, 0]],
            rows: [
                ['Vector Tile Layers', 0],
                ['OSM Buildings', 1],
                ['Vector Layers', 0],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            history: [[2, 0, 0]],
            rows: [
                ['OSM Buildings', 0],
                ['Vector Layers', 0],
                ['Vector Tile Layers', 1],
                ['📄 GeoJSON Data Features', 1],
            ],
        },
        {
            history: [[5, 2, 2]],
            rows: [
                ['Vector Tile Layers', 1],
                ['Points Basic', 2],
                ['OSM Buildings', 2],
                ['📄 GeoJSON Data Features', 1],
                ['Geometry Types', 2],
                ['Lines Basic', 3],
            ],
        },
    ]

    for (const scenario of urlCases) {
        test(`ordering: inline URL — ${scenario.history
            .map((entry) => entry.join('-'))
            .join('.')}`, async ({ page }) => {
            const encoded = scenario.history
                .map((entry) => entry.join('-'))
                .join('.')
            const toolUrl = `LayersTool$${encoded}`
            await page.goto(
                `/?mission=Reference-Mission&panePercents=0%2C0%2C100&tools=${encodeURIComponent(toolUrl)}`
            )
            await page.waitForLoadState('networkidle', { timeout: 60000 })
            await page.waitForFunction(
                () => !!window.ToolController_?.getTool('LayersTool')?._debugFlat
            )
            expect(
                await affectedRows(
                    page,
                    scenario.rows.map(([name]) => name)
                )
            ).toEqual(
                scenario.rows.map(([name, depth]) => ({ name, depth }))
            )
            expect(await historyTriples(page)).toEqual(scenario.history)
        })
    }

    test('keeps LayersTool ordering usable after a globe reorder error', async ({
        page,
    }) => {
        test.setTimeout(60000)
        const pageErrors = []
        const consoleErrors = []
        page.on('pageerror', (error) =>
            pageErrors.push(error.stack || error.message)
        )
        page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text())
        })
        await loadMission(page)
        const flat = await page.evaluate(() =>
            window.ToolController_.getTool('LayersTool')._debugFlat([])
        )
        await page.setViewportSize({
            width: 1500,
            height: Math.min(10000, Math.max(4800, flat.length * 44)),
        })
        await page.locator('#toolButtonLayers').click()
        await page.getByRole('button', { name: 'Expand all' }).click()
        const imagery = await page.evaluate(() => {
            const layer = Object.values(window.L_.layers.data).find(
                (candidate) =>
                    candidate.display_name === 'ArcGIS World Imagery'
            )
            return layer
                ? { name: layer.name, on: window.L_.layers.on[layer.name] }
                : null
        })
        expect(imagery).not.toBeNull()
        if (!imagery.on) {
            await page
                .locator('.lt-layerRow')
                .filter({ hasText: 'ArcGIS World Imagery' })
                .first()
                .locator('[role="checkbox"]')
                .first()
                .click()
            await page.waitForFunction(
                (name) => window.L_.layers.on[name] === true,
                imagery.name
            )
        }

        const dragAndCheck = async (sourceLabel, targetLabel, fraction) => {
            const sourceInfo = await revealDragRow(
                page,
                sourceLabel
            )
            const targetInfo = await revealDragRow(
                page,
                targetLabel
            )
            const source = orderingRow(page, sourceInfo)
            const target = orderingRow(page, targetInfo)
            const historyLength = await page.evaluate(
                () =>
                    window.ToolController_.getTool('LayersTool')
                        .orderingHistory.length
            )
            await dragWithMouse(
                page,
                source.locator('.lt-drag'),
                target,
                fraction
            )
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            window.ToolController_.getTool('LayersTool')
                                .orderingHistory.length
                    )
                )
                .toBe(historyLength + 1)
            await expect(
                page.getByRole('tree', { name: 'Layers' })
            ).toHaveAttribute('data-active-drag-id', '')
            const state = await page.evaluate(() => {
                const flat = window.ToolController_
                    .getTool('LayersTool')
                    ._debugFlat()
                return {
                    flat: flat.map(({ name, type, depth }) => ({
                        name,
                        type,
                        depth,
                    })),
                    order: window.L_._layersOrdered.slice(),
                    history: window.ToolController_.getTool('LayersTool')
                        .orderingHistory,
                }
            })
            expect(state.order).toEqual(
                state.flat
                    .filter((row) => row.type !== 'header')
                    .map((row) => row.name)
            )
            return state
        }

        const first = await dragAndCheck(
            'Points Basic',
            'Velocity - Sample particles',
            0.8
        )
        const second = await dragAndCheck(
            'Points Basic',
            'Velocity - Sample particles',
            0.2
        )
        expect(second.history).toHaveLength(first.history.length + 1)
        expect(
            pageErrors.filter((error) => /DeveloperError|destroyed/i.test(error))
        ).toHaveLength(0)
        console.log(
            `Globe reorder error evidence: ${JSON.stringify({
                pageErrors,
                consoleErrors: consoleErrors.filter((text) =>
                    /LayersTool failed to synchronize map order|DeveloperError|destroyed/i.test(
                        text
                    )
                ),
                history: second.history,
                orderConsistent: true,
            })}`
        )
    })

    test('keeps scroll position after a pointer reorder', async ({ page }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        await page.getByRole('button', { name: 'Expand all' }).click()

        const scroll = page.locator('#layersTool .lt-scroll')
        await scroll.evaluate((element) => {
            element.scrollTop = Math.min(
                500,
                element.scrollHeight - element.clientHeight
            )
        })
        await page.waitForTimeout(100)
        const visibleRows = await scroll.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            return Array.from(
                element.querySelectorAll('.lt-layerRow')
            )
                .map((row) => {
                    const rect = row.getBoundingClientRect()
                    return {
                        id: row.getAttribute('data-row-id'),
                        top: rect.top,
                        bottom: rect.bottom,
                        height: rect.height,
                    }
                })
                .filter(
                    (row) =>
                        row.bottom > bounds.top + row.height &&
                        row.top < bounds.bottom - row.height
                )
        })
        expect(visibleRows.length).toBeGreaterThan(8)

        const source = visibleRows[2]
        const target = visibleRows[6]
        const sourceRow = page.locator(orderingRowSelector(source.id))
        const targetRow = page.locator(orderingRowSelector(target.id))
        const scrollTopBefore = await scroll.evaluate(
            (element) => element.scrollTop
        )
        const rowHeight = source.height
        const historyLength = await page.evaluate(
            () =>
                window.ToolController_.getTool('LayersTool').orderingHistory
                    .length
        )

        await dragWithMouse(
            page,
            sourceRow.locator('.lt-drag'),
            targetRow,
            0.8
        )
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(historyLength + 1)

        const scrollTopAfter = await scroll.evaluate(
            (element) => element.scrollTop
        )
        expect(
            Math.abs(scrollTopAfter - scrollTopBefore)
        ).toBeLessThanOrEqual(rowHeight * 2)

        const movedRow = page.locator(orderingRowSelector(source.id))
        const isVisible = await movedRow.evaluate((row) => {
            const bounds = row.closest('.lt-scroll').getBoundingClientRect()
            const rect = row.getBoundingClientRect()
            return rect.bottom > bounds.top && rect.top < bounds.bottom
        })
        expect(isVisible).toBe(true)
    })

    test('blocks dragging a group into its own subtree', async ({ page }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        await page.getByRole('button', { name: 'Expand all' }).click()

        const ids = await page.evaluate(() => {
            const flat = window.ToolController_
                .getTool('LayersTool')
                ._debugFlat()
            const header = flat.find(
                (row) => row.displayName === 'TiTiler Tile Layers'
            )
            const child = flat.find(
                (row) => row.displayName === 'EMIT Methane Mosaicked'
            )
            const scroll = document.querySelector('#layersTool .lt-scroll')
            const headerIndex = flat.findIndex((row) => row.key === header.key)
            scroll.scrollTop = Math.max(
                0,
                headerIndex * 31 - scroll.clientHeight / 2
            )
            return { header: header.key, child: child.key }
        })
        const source = page.locator(orderingRowSelector(ids.header))
        const target = page.locator(orderingRowSelector(ids.child))
        const handle = source.locator('.lt-drag')
        await expect(source).toBeVisible()
        await expect(target).toBeVisible()

        const snapshot = async () =>
            page.evaluate(() => {
                const tool = window.ToolController_.getTool('LayersTool')
                return {
                    flat: tool
                        ._debugFlat()
                        .map(({ key, depth }) => ({ key, depth })),
                    history: tool.orderingHistory.map((entry) => entry.slice()),
                    order: window.L_._layersOrdered.slice(),
                }
            })
        const before = await snapshot()
        await page.evaluate(() => {
            const layers = window.L_
            const original = layers.reorderLayers
            window.__layersReorderSpy = { original, calls: 0 }
            layers.reorderLayers = function (...args) {
                window.__layersReorderSpy.calls += 1
                return original.apply(this, args)
            }
        })

        for (const theme of ['dark', 'light']) {
            if (theme === 'light') {
                await page.waitForTimeout(3100)
                await page.evaluate((variables) => {
                    Object.entries(variables).forEach(([name, value]) =>
                        document.documentElement.style.setProperty(name, value)
                    )
                }, LIGHT_BLOCKED_STATE_THEME)
            }

            const sourceBox = await handle.boundingBox()
            const targetBox = await target.boundingBox()
            expect(sourceBox).not.toBeNull()
            expect(targetBox).not.toBeNull()
            const startX = sourceBox.x + sourceBox.width / 2
            const startY = sourceBox.y + sourceBox.height / 2
            const targetX = targetBox.x + targetBox.width / 2
            const targetY = targetBox.y + targetBox.height / 2
            await page.mouse.move(startX, startY)
            await page.waitForTimeout(120)
            await page.mouse.down()
            await page.waitForTimeout(120)
            await page.mouse.move(startX + 14, startY, { steps: 6 })
            await page.mouse.move(targetX, targetY, { steps: 28 })
            await expect(page.locator('.lt-dropBlockedStatus')).toHaveText(
                OWN_SUBTREE_BLOCKED_MESSAGE
            )
            await expect(page.locator('#layersTool .lt-scroll')).toHaveClass(
                /lt-dropBlocked/
            )
            await page.screenshot({
                path: `/home/ubuntu/work/lt-shots/audit3/${theme}-own-subtree-blocked-mid-drag.png`,
            })
            await page.evaluate(() => {
                const scroll = document.querySelector('#layersTool .lt-scroll')
                window.__blockedDropFocus = document.activeElement
                window.__blockedDropScrollTop = scroll.scrollTop
            })
            await page.mouse.up()
            await expect(page.locator('.lt-dropBlockedStatus')).toHaveText(
                OWN_SUBTREE_BLOCKED_MESSAGE
            )
            await expect(page.locator('.lt-toast')).toHaveText(
                OWN_SUBTREE_BLOCKED_MESSAGE
            )
            await expect.poll(snapshot).toEqual(before)
            expect(
                await page.evaluate(
                    () =>
                        document.activeElement === window.__blockedDropFocus &&
                        document.querySelector('#layersTool .lt-scroll')
                            .scrollTop === window.__blockedDropScrollTop
                )
            ).toBe(true)
        }

        expect(
            await page.evaluate(() => window.__layersReorderSpy.calls)
        ).toBe(0)
        await page.evaluate(() => {
            window.L_.reorderLayers = window.__layersReorderSpy.original
            delete window.__layersReorderSpy
        })
    })

    test('allows a header with children to move outside its subtree', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        await page.getByRole('button', { name: 'Expand all' }).click()
        await page.evaluate(() => {
            const flat = window.ToolController_
                .getTool('LayersTool')
                ._debugFlat()
            const index = flat.findIndex(
                (row) => row.displayName === 'TiTiler Tile Layers'
            )
            const scroll = document.querySelector('#layersTool .lt-scroll')
            scroll.scrollTop = Math.max(0, index * 31 - scroll.clientHeight / 2)
        })
        await page.waitForTimeout(120)
        const header = await dragRowInfo(page, 'TiTiler Tile Layers')
        const targetInfo = await dragRowInfo(page, 'Basemaps')
        const source = orderingRow(page, header)
        const target = orderingRow(page, targetInfo)
        await source.scrollIntoViewIfNeeded()
        await target.scrollIntoViewIfNeeded()
        const before = await page.evaluate(() => ({
            flat: window.ToolController_
                .getTool('LayersTool')
                ._debugFlat()
                .map(({ key, depth }) => ({ key, depth })),
            history: window.ToolController_.getTool('LayersTool')
                .orderingHistory.length,
        }))

        await dragWithMouse(page, source.locator('.lt-drag'), target, 0.8)

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(before.history + 1)
        expect(
            await page.evaluate(() =>
                window.ToolController_
                    .getTool('LayersTool')
                    ._debugFlat()
                    .map(({ key, depth }) => ({ key, depth }))
            )
        ).not.toEqual(before.flat)
        await expect(page.locator('.lt-dropBlockedStatus')).toHaveCount(0)
    })

    test('Alt+Down moves an expanded header past its whole subtree', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        const tree = page.getByRole('tree', { name: 'Layers' })
        await expect(tree).toBeVisible()
        await page.getByRole('button', { name: 'Expand all' }).click()

        const configLayers = await page.evaluate(
            () => window.L_.configData.layers
        )
        const flat = flatten(configLayers)
        const headerIndex = flat.findIndex((row, index) => {
            if (row.type !== 'header') return false
            const descendants = descendantsOf(flat, index)
            const targetIndex = index + descendants.length + 1
            return (
                descendants.some((descendant) => descendant.type === 'header') &&
                targetIndex < flat.length
            )
        })
        expect(headerIndex).toBeGreaterThanOrEqual(0)
        const targetIndex =
            headerIndex + descendantsOf(flat, headerIndex).length + 1
        const expandedMap = Object.fromEntries(
            flat
                .filter((row) => row.type === 'header')
                .map((row) => [row.name, true])
        )
        const liveMove = applyLiveMove(
            flat,
            headerIndex,
            targetIndex,
            expandedMap
        )
        const expectedFlat = replay(flat, [liveMove.entry]).flat
        const headerKey = flat[headerIndex].key
        const headerRowId = `lt-row-${headerKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`

        await tree.focus()
        await expect
            .poll(() => tree.getAttribute('aria-activedescendant'))
            .not.toBeNull()
        for (let attempt = 0; attempt < flat.length; attempt += 1) {
            if (
                (await tree.getAttribute('aria-activedescendant')) ===
                headerRowId
            )
                break
            await page.keyboard.press('ArrowDown')
        }
        await expect(tree).toHaveAttribute(
            'aria-activedescendant',
            headerRowId
        )
        await page.keyboard.press('Alt+ArrowDown')

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(1)
        const actual = await page.evaluate(() => {
            const tool = window.ToolController_.getTool('LayersTool')
            const flat = tool._debugFlat()
            return {
                history: tool.orderingHistory,
                flat: flat.map(({ key, depth }) => ({ key, depth })),
                order: window.L_._layersOrdered.slice(),
            }
        })
        expect(actual.history).toEqual([liveMove.entry])
        expect(actual.flat).toEqual(
            expectedFlat.map(({ key, depth }) => ({ key, depth }))
        )
        expect(actual.order).toEqual(
            expectedFlat
                .filter((row) => row.type !== 'header')
                .map((row) => row.name)
        )
    })

    test('Alt+Up on the first row does not change ordering or show a toast', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        const tree = page.getByRole('tree', { name: 'Layers' })
        await expect(tree).toBeVisible()
        await tree.focus()
        await page.keyboard.press('Home')
        const before = await page.evaluate(() => ({
            history: window.ToolController_.getTool('LayersTool')
                .orderingHistory,
            order: window.L_._layersOrdered.slice(),
        }))
        await page.keyboard.press('Alt+ArrowUp')
        await page.waitForTimeout(100)
        const after = await page.evaluate(() => ({
            history: window.ToolController_.getTool('LayersTool')
                .orderingHistory,
            order: window.L_._layersOrdered.slice(),
        }))
        expect(after).toEqual(before)
        await expect(page.locator('.lt-toast')).toHaveCount(0)
    })

    test('repeats keyboard and mouse moves, undoes twice, and preserves config', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        const tree = page.getByRole('tree', { name: 'Layers' })
        await expect(tree).toBeVisible()
        await page.getByRole('button', { name: 'Expand all' }).click()
        const before = await page.evaluate(() =>
            JSON.stringify(window.L_.configData.layers)
        )
        await tree.focus()
        await page.keyboard.press('Alt+ArrowDown')
        await page.keyboard.press('Alt+ArrowDown')
        await page.keyboard.press('Alt+ArrowDown')
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(3)

        const layerRows = page.locator('.lt-layerRow')
        await expect(layerRows.nth(1)).toBeVisible()
        const dragHandle = await layerRows.nth(0).locator('.lt-drag').boundingBox()
        const target = await layerRows.nth(1).boundingBox()
        await page.mouse.move(
            dragHandle.x + dragHandle.width / 2,
            dragHandle.y + dragHandle.height / 2
        )
        await page.mouse.down()
        await page.mouse.move(dragHandle.x + dragHandle.width / 2 + 4, dragHandle.y + 6)
        await page.mouse.move(
            target.x + target.width / 2,
            target.y + target.height / 2,
            { steps: 10 }
        )
        await page.mouse.up()
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(4)
        await page.getByRole('button', { name: 'Undo' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                    )
                )
            .toBe(3)
        await page.getByRole('button', { name: 'Undo' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(2)
        expect(
            await page.evaluate(() =>
                JSON.stringify(window.L_.configData.layers)
            )
        ).toBe(before)
    })


})
