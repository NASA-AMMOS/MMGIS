import { test, expect } from '@playwright/test'
import {
    applyLiveMove,
    descendantsOf,
    flatten,
    replay,
} from '../ordering.js'
const fs = require('fs')
const path = require('path')
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
const legacyOrderingFixture = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, 'fixtures', 'legacy-ordering.json'),
        'utf8'
    )
)

const DEFAULT_SEEDED_DRAGS = {
    11: [
        {
            source: 'OSM Buildings',
            target: 'Feature Property Styling',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Annotations',
            target: 'Feature Property Styling',
            position: 'into',
            targetState: 'expanded',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Feature Property Styling',
            target: 'Raster Layers',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Arrows',
            target: 'Vector Layers',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Points Styled',
            target: 'Image - Curiosity thumbnail',
            position: 'below',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Geometry Types',
            target: 'Feature Property Styling',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Raster Layers',
        },
        {
            source: 'Lines Basic',
            target: 'Polygons Basic',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Polygons Basic',
            target: 'Annotations',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
    ],
    33: [
        {
            source: 'Feature Property Styling',
            target: 'Raster Layers',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Points Basic',
            target: 'Vector Layers',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Points Styled',
            target: 'Image - Curiosity thumbnail',
            position: 'below',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Geometry Types',
            target: 'Feature Property Styling',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Raster Layers',
        },
        {
            source: 'Lines Styled',
            target: 'Lines Basic',
            position: 'below',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Points Styled',
            target: 'Lines Styled',
            position: 'below',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'OSM Buildings',
            target: 'Geometry Types',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Points Styled',
            target: 'Geometry Types',
            position: 'into',
            targetState: 'expanded',
            toggle: 'Raster Layers',
        },
    ],
    88: [
        {
            source: 'Points Styled',
            target: 'Annotations',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'OSM Buildings',
            target: 'Geometry Types',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Polygons Basic',
            target: 'Geometry Types',
            position: 'into',
            targetState: 'expanded',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Feature Property Styling',
            target: 'Raster Layers',
            position: 'above',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Arrows',
            target: 'Vector Layers',
            position: 'above',
            toggle: 'Raster Layers',
        },
        {
            source: 'Annotations',
            target: 'Image - Curiosity thumbnail',
            position: 'below',
            toggle: 'Feature Property Behavior',
        },
        {
            source: 'Geometry Types',
            target: 'Feature Property Styling',
            position: 'below',
            targetState: 'collapsed',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Lines Basic',
            target: 'Points Basic',
            position: 'below',
            toggle: 'Vector Tile Layers',
        },
        {
            source: 'Lines Basic',
            target: 'Lines Styled',
            position: 'above',
            toggle: 'Raster Layers',
        },
        {
            source: 'Points Basic',
            target: 'Velocity - Sample particles',
            position: 'below',
            toggle: 'Raster Layers',
        },
    ],
}

function seededDragPlans() {
    return Object.entries(DEFAULT_SEEDED_DRAGS).map(([seed, planned]) => ({
        seed: Number(seed),
        planned,
    }))
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

function makeHistories(flat) {
    const n = flat.length
    const parentAt = (index) => {
        const depth = flat[index]?.depth || 0
        for (let i = index - 1; i >= 0; i -= 1) {
            if (flat[i].type === 'header' && flat[i].depth === depth - 1)
                return i
        }
        return null
    }
    const headerDescendants = (index) => {
        const header = flat[index]
        return flat
            .map((row, rowIndex) => ({ row, rowIndex }))
            .filter(
                ({ row, rowIndex }) =>
                    rowIndex > index && row.depth > header.depth
            )
            .map(({ rowIndex }) => rowIndex)
            .slice(
                0,
                flat
                    .slice(index + 1)
                    .findIndex((row) => row.depth <= header.depth) < 0
                    ? undefined
                    : flat
                          .slice(index + 1)
                          .findIndex((row) => row.depth <= header.depth)
            )
    }
    const leaves = flat
        .map((row, index) => ({ ...row, index }))
        .filter((row) => row.type !== 'header')
    const headers = flat
        .map((row, index) => ({ ...row, index }))
        .filter((row) => row.type === 'header')
    const groupWithSiblings = leaves.find((row) =>
        leaves.some(
            (candidate) =>
                candidate.index > row.index &&
                parentAt(candidate.index) === parentAt(row.index)
        )
    )
    const sibling = groupWithSiblings
        ? leaves.find(
              (row) =>
                  row.index > groupWithSiblings.index &&
                  parentAt(row.index) === parentAt(groupWithSiblings.index)
          )
        : null
    const rootHeader = headers.find((row) => row.depth === 0)
    const nestedHeader = headers.find((row) => row.depth > 0)
    const expandedHeader = headers.find(
        (row) => headerDescendants(row.index).length > 0
    )
    const collapsedHeader = expandedHeader || rootHeader
    const outsideLeaf = leaves.find(
        (leaf) =>
            collapsedHeader &&
            (leaf.index < collapsedHeader.index ||
                !headerDescendants(collapsedHeader.index).includes(leaf.index))
    )
    const groupLeaf = leaves.find((row) => row.depth > 0)
    const history = (oldIndex, newIndex, afterHeader = 0) => [
        [oldIndex, newIndex, afterHeader],
    ]

    const handPicked = []
    if (groupWithSiblings && sibling)
        handPicked.push(history(groupWithSiblings.index, sibling.index))
    if (leaves.length > 1) {
        handPicked.push(history(leaves.at(-1).index, 0))
        handPicked.push(history(leaves[0].index, n - 1))
    }
    if (outsideLeaf && expandedHeader)
        handPicked.push(
            history(outsideLeaf.index, expandedHeader.index + 1, 2)
        )
    if (outsideLeaf && collapsedHeader)
        handPicked.push(
            history(outsideLeaf.index, collapsedHeader.index + 1, 1)
        )
    if (rootHeader) {
        handPicked.push(history(rootHeader.index, 0))
        handPicked.push(history(rootHeader.index, n - 1))
        handPicked.push(history(rootHeader.index, rootHeader.index + 1))
    }
    if (nestedHeader)
        handPicked.push(history(nestedHeader.index, 0))
    if (nestedHeader && nestedHeader.index < n - 1)
        handPicked.push(history(nestedHeader.index, n - 1))
    if (groupLeaf) handPicked.push(history(groupLeaf.index, 0))
    if (groupWithSiblings && sibling)
        handPicked.push([
            [groupWithSiblings.index, sibling.index, 0],
            [sibling.index, 0, 0],
            [0, n - 1, 1],
        ])

    let seed = 0x5eed1234
    const random = (max) => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed % max
    }
    const randomHistories = Array.from({ length: 40 }, () =>
        Array.from({ length: 1 + random(5) }, () => [
            random(n),
            random(n),
            random(3),
        ])
    )
    return [...handPicked, ...randomHistories]
}

function makeDragScenarios(flat) {
    const headerChildren = (index) => {
        const header = flat[index]
        return flat
            .map((row, rowIndex) => ({ row, rowIndex }))
            .filter(
                ({ row, rowIndex }) =>
                    rowIndex > index &&
                    row.depth > header.depth &&
                    flat
                        .slice(index + 1, rowIndex)
                        .every((between) => between.depth > header.depth)
            )
            .map(({ rowIndex }) => rowIndex)
    }
    const parent = (index) => {
        for (let i = index - 1; i >= 0; i -= 1) {
            if (
                flat[i].type === 'header' &&
                flat[i].depth === flat[index].depth - 1
            )
                return i
        }
        return -1
    }
    const leaves = flat
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.type !== 'header')
    const headers = flat
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.type === 'header')
    const siblingPair = leaves.find(({ index }) =>
        leaves.some(
            (candidate) =>
                candidate.index > index && parent(candidate.index) === parent(index)
        )
    )
    const siblingTarget = siblingPair
        ? leaves.find(
              ({ index }) =>
                  index > siblingPair.index &&
                  parent(index) === parent(siblingPair.index)
          )
        : null
    const headerWithChildren =
        headers.find(
            ({ row, index }) =>
                row.depth > 0 && headerChildren(index).length > 0
        ) ||
        headers.find(({ index }) => headerChildren(index).length > 0)
    const rootHeader = headers.find(({ row }) => row.depth === 0)
    const externalLeaf = leaves.find(
        ({ index }) =>
            headerWithChildren &&
            !headerChildren(headerWithChildren.index).includes(index)
    )
    const firstHeaderLeaf = headerWithChildren
        ? headerChildren(headerWithChildren.index).find(
              (index) => flat[index].type !== 'header'
          )
        : null
    const otherHeader = headers.find(
        ({ index }) =>
            headerWithChildren && index !== headerWithChildren.index
    )
    const nestedLeaf = leaves.find(({ row }) => row.depth > 0)
    const scenarios = []
    if (siblingPair && siblingTarget)
        scenarios.push({
            label: 'within group',
            from: siblingPair.index,
            to: siblingTarget.index,
        })
    if (externalLeaf && firstHeaderLeaf != null)
        scenarios.push({
            label: 'into expanded header',
            from: externalLeaf.index,
            to: firstHeaderLeaf,
        })
    if (externalLeaf && headerWithChildren)
        scenarios.push({
            label: 'after collapsed header',
            from: externalLeaf.index,
            to: headerWithChildren.index,
            collapseTarget: true,
        })
    if (headerWithChildren && otherHeader)
        scenarios.push({
            label: 'expanded header with children',
            from: headerWithChildren.index,
            to: otherHeader.index,
        })
    if (headerWithChildren && otherHeader)
        scenarios.push({
            label: 'collapsed header',
            from: headerWithChildren.index,
            to: otherHeader.index,
            collapseSource: true,
        })
    if (headerWithChildren) {
        const child = headerChildren(headerWithChildren.index).find(
            (index) => flat[index].type !== 'header'
        )
        if (child != null)
            scenarios.push({
                label: 'header into own contents',
                from: headerWithChildren.index,
                to: child,
            })
    }
    if (nestedLeaf && rootHeader)
        scenarios.push({
            label: 'layer to depth zero',
            from: nestedLeaf.index,
            to: rootHeader.index,
        })
    const geometryTypes = flat.findIndex(
        (row) =>
            row.type === 'header' &&
            row.displayName === 'Geometry Types'
    )
    const osmBuildings = flat.findIndex(
        (row) =>
            row.type !== 'header' &&
            row.displayName === 'OSM Buildings'
    )
    if (geometryTypes >= 0 && osmBuildings >= 0)
        scenarios.push({
            label: 'OSM Buildings onto collapsed Geometry Types',
            from: osmBuildings,
            to: geometryTypes,
            collapseTarget: true,
        })
    return scenarios
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

async function applyRecordedDropOracle(page, capture) {
    return page.evaluate((drop) => {
        const flat = drop.pre.map((row) => ({
            key: row.name,
            name: row.name,
            type: row.type,
            depth: Number.parseInt(row.depth, 10),
            on: row.on !== 'false',
            height: row.height > 0 ? 1 : 0,
            childrenon: row.childrenon,
        }))
        const expanded = Object.fromEntries(
            drop.pre
                .filter((row) => row.type === 'header')
                .map((row) => [row.name, row.childrenon !== 'false'])
        )
        expanded.searchHidden = new Set(
            drop.pre
                .filter((row) => row.height === 0)
                .map((row) => row.name)
        )
        return window.ToolController_
            .getTool('LayersTool')
            ._debugApplyLiveMove(
                flat,
                drop.indices.oldIndex,
                drop.indices.newIndex,
                expanded
            )
    }, capture)
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

async function performSeededDrag(page, planned) {
    const spec = { ...planned }
    if (spec.toggle) {
        const toggleInfo = await revealDragRow(page, spec.toggle)
        await orderingRow(page, toggleInfo).locator('.lt-chevron').click()
    }
    if (spec.targetState)
        await setDragHeaderExpanded(
            page,
            spec.target,
            spec.targetState === 'expanded'
        )
    const targetInfo = await revealDragRow(page, spec.target)
    const sourceInfo = await dragRowInfo(page, spec.source)
    if (!sourceInfo) throw new Error(`Layers row not found: ${spec.source}`)
    if (
        spec.targetState === 'collapsed' &&
        sourceInfo.index > targetInfo.index &&
        sourceInfo.depth > targetInfo.depth
    ) {
        const between = await page.evaluate(
            ({ start, end, depth }) =>
                window.ToolController_
                    .getTool('LayersTool')
                    ._debugFlat()
                    .slice(start + 1, end)
                    .every((row) => row.depth > depth),
            {
                start: targetInfo.index,
                end: sourceInfo.index,
                depth: targetInfo.depth,
            }
        )
        if (between) {
            spec.source = 'Points Basic'
            spec.target = 'Velocity - Sample particles'
            spec.position = 'below'
        }
    }
    const source = await revealDragRow(page, spec.source)
    const target = await revealDragRow(page, spec.target)
    const sourceRow = orderingRow(page, source)
    const targetRow = orderingRow(page, target)
    const handle = sourceRow.locator('.lt-drag')
    await handle.scrollIntoViewIfNeeded()
    await targetRow.scrollIntoViewIfNeeded()
    const fraction = spec.position === 'above' ? 0.2 : 0.8
    await dragWithMouse(page, handle, targetRow, fraction)
    return spec
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
test.describe('LayersTool flat ordering parity', () => {
    test('replays the 52 recorded triple URL histories', async ({ page }) => {
        const expected = legacyOrderingFixture.urlHistories
        await loadMission(page)
        const baseFlat = await page.evaluate(() =>
            window.ToolController_.getTool('LayersTool')._debugFlat([])
        )
        const baseSnapshot = baseFlat.map(({ name, type, depth }) => ({
            name,
            type,
            depth,
        }))
        expect(baseSnapshot).toEqual(expected.baseFlat)
        const histories = makeHistories(baseFlat)
        expect(histories).toEqual(
            expected.cases.map(({ inputHistory }) => inputHistory)
        )

        const results = await page.evaluate((inputHistories) => {
            const layers = window.L_
            const tool = window.ToolController_.getTool('LayersTool')
            const savedOrder = layers._layersOrdered.slice()
            const savedHistory = tool.orderingHistory
            const savedUrlTools = layers.FUTURES?.tools
            const savedGlobe = layers.Globe_
            layers.Globe_ = null
            try {
                return inputHistories.map((history) => {
                    layers._layersOrdered = savedOrder.slice()
                    const encoded = history
                        .map((entry) => entry.join('-'))
                        .join('.')
                    layers.FUTURES.tools = [
                        ...(savedUrlTools || []).filter(
                            (value) =>
                                !String(value).startsWith('LayersTool$')
                        ),
                        `LayersTool$${encoded}`,
                    ]
                    tool.finalize()
                    return {
                        flat: tool
                            ._debugFlat()
                            .map(({ name, type, depth }) => ({
                                name,
                                type,
                                depth,
                            })),
                        _layersOrdered: layers._layersOrdered.slice(),
                        historyTriples: tool.orderingHistory.map((entry) =>
                            entry.slice(0, 3)
                        ),
                    }
                })
            } finally {
                tool.orderingHistory = savedHistory
                layers.FUTURES.tools = savedUrlTools
                layers.Globe_ = savedGlobe
                layers._layersOrdered = savedOrder
            }
        }, histories)

        results.forEach((result, index) => {
            const expectedCase = expected.cases[index]
            expect(result.flat, `history ${index}`).toEqual(expectedCase.flat)
            expect(result._layersOrdered, `history ${index}`).toEqual(
                expectedCase._layersOrdered
            )
            expect(result.historyTriples, `history ${index}`).toEqual(
                expectedCase.historyTriples
            )
            expect(
                expectedCase.historyTriples.every((entry) => entry.length === 3)
            ).toBe(true)
        })
        console.log(
            `Recorded URL histories: ${JSON.stringify({
                matched: results.length,
                histories: expected.cases.length,
            })}`
        )
    })

    test('replays legacy triples followed by resolved moves in order', async ({
        page,
    }) => {
        await loadMission(page)
        const config = await page.evaluate(() => window.L_.configData.layers)
        const flat = flatten(config)
        const oldIndex = flat.findLastIndex(
            (row) => row.type !== 'header'
        )
        const legacyEntry = [oldIndex, 0, 0]
        const afterLegacy = replay(flat, [legacyEntry]).flat
        const newOldIndex = 2
        const newIndex = afterLegacy.length - 1
        const expandedMap = Object.fromEntries(
            afterLegacy
                .filter((row) => row.type === 'header')
                .map((row) => [row.name, true])
        )
        const resolved = applyLiveMove(
            afterLegacy,
            newOldIndex,
            newIndex,
            expandedMap
        )
        const mixed = replay(flat, [legacyEntry, resolved.entry]).flat

        expect(resolved.entry).toHaveLength(5)
        expect(
            mixed.map(({ name, type, depth }) => ({ name, type, depth }))
        ).toEqual(
            resolved.flat.map(({ name, type, depth }) => ({
                name,
                type,
                depth,
            }))
        )
    })

    test('matches the recorded exact bottom drop', async ({ page }) => {
        const expected = legacyOrderingFixture.exactBottomDrop
        const baseFlat = await prepareDragPage(page)
        expect(
            baseFlat.map(({ name, type, depth }) => ({ name, type, depth }))
        ).toEqual(expected.baseFlat)

        const source = await dragRowInfo(page, expected.sourceDisplayName)
        const target = await dragRowInfo(page, expected.targetDisplayName)
        await dragWithMouse(
            page,
            orderingRow(page, source).locator('.lt-drag'),
            orderingRow(page, target),
            0.8
        )
        const result = await dragPageState(page)
        expect(result.flat).toEqual(expected.result.flat)
        expect(result.order).toEqual(expected.result._layersOrdered)
        expect(result.history.map((entry) => entry.slice(0, 3))).toEqual(
            expected.result.historyTriples
        )
        expect(result.history[0]).toHaveLength(5)
        expect(result.order).toEqual(
            result.flat
                .filter((row) => row.type !== 'header')
                .map((row) => row.name)
        )
        expect(result.dom).toEqual(
            result.keyedFlat.map(({ key, depth }) => ({ key, depth }))
        )
        expect(result.flat.at(-1).name).toBe(source.name)
    })

    test('matches the recorded collapsed-header placements', async ({
        page,
    }) => {
        test.setTimeout(300000)
        const expectedCases = legacyOrderingFixture.collapsedHeaderCases
        for (const expected of expectedCases) {
            const scenario = expected.scenario
            const baseFlat = await prepareDragPage(page)
            expect(
                baseFlat.map(({ name, type, depth }) => ({
                    name,
                    type,
                    depth,
                }))
            ).toEqual(legacyOrderingFixture.urlHistories.baseFlat)
            await setDragHeaderExpanded(
                page,
                scenario.source,
                scenario.sourceExpanded
            )
            await setDragHeaderExpanded(
                page,
                'Filter Tab',
                scenario.targetExpanded
            )

            await performSeededDrag(page, {
                source: scenario.source,
                target: 'Filter Tab',
                position: 'below',
            })
            const result = await dragPageState(page)
            const oracle = await applyRecordedDropOracle(
                page,
                expected.sortableCapture
            )
            const oracleFlat = oracle.flat.map(({ name, type, depth }) => ({
                name,
                type,
                depth,
            }))

            expect(expected.sortableCapture.indices).toEqual({
                oldIndex: scenario.sourceIndex,
                newIndex: scenario.targetIndex,
            })
            expect(result.flat, scenario.label).toEqual(expected.flat)
            expect(result.order, scenario.label).toEqual(
                expected._layersOrdered
            )
            expect(result.history.map((entry) => entry.slice(0, 3))).toEqual(
                expected.historyTriples
            )
            expect(result.history.at(-1)).toEqual([
                scenario.sourceIndex,
                scenario.targetIndex,
                scenario.headerState,
                scenario.finalIndex,
                scenario.finalDepth,
            ])
            expect(oracleFlat, scenario.label).toEqual(expected.flat)
        }
        console.log(
            `Recorded collapsed-header cases: ${expectedCases.length} matched`
        )
    })

    test('matches seeded real-mouse drags with recorded legacy results', async ({
        page,
    }) => {
        test.setTimeout(900000)
        const seeds = legacyOrderingFixture.seededDrags
        let totalSteps = 0
        for (const expectedSeed of seeds) {
            const baseFlat = await prepareDragPage(page)
            expect(
                baseFlat.map(({ name, type, depth }) => ({
                    name,
                    type,
                    depth,
                }))
            ).toEqual(expectedSeed.baseFlat)
            expect(
                seededDragPlans().find(({ seed }) => seed === expectedSeed.seed)
                    ?.planned
            ).toEqual(expectedSeed.planned)

            for (const expectedStep of expectedSeed.steps) {
                await performSeededDrag(page, expectedStep.drag)
                const result = await dragPageState(page)
                const actualHistoryTriples = result.history.map((entry) =>
                    entry.slice(0, 3)
                )
                const oracle = await applyRecordedDropOracle(
                    page,
                    expectedStep.sortableCapture
                )
                const oracleFlat = oracle.flat.map(
                    ({ name, type, depth }) => ({ name, type, depth })
                )
                const indices = expectedStep.sortableCapture.indices

                expect(result.flat, `seed ${expectedSeed.seed}, step ${expectedStep.step}`).toEqual(
                    expectedStep.flat
                )
                expect(result.order).toEqual(expectedStep._layersOrdered)
                expect(actualHistoryTriples).toEqual(
                    expectedStep.historyTriples
                )
                expect(result.history.at(-1)).toHaveLength(5)
                expect(result.history.at(-1).slice(0, 2)).toEqual([
                    indices.oldIndex,
                    indices.newIndex,
                ])
                expect(oracleFlat).toEqual(expectedStep.flat)
                totalSteps += 1
            }

            const finalExpected = expectedSeed.steps.at(-1)
            const encodedHistory = await page.evaluate(() =>
                window.ToolController_.getTool('LayersTool').getUrlString()
            )
            expect(encodedHistory).toMatch(/^\d+-\d+-\d+-\d+-\d+/)
            const shareUrl = new URL(page.url())
            shareUrl.searchParams.set('mission', 'Reference-Mission')
            shareUrl.searchParams.set('panePercents', '0,0,100')
            shareUrl.searchParams.set('tools', `LayersTool$${encodedHistory}`)
            await page.goto(shareUrl.toString())
            await page.waitForLoadState('networkidle', { timeout: 60000 })
            await page.waitForFunction(
                (historyLength) =>
                    window.ToolController_?.getTool('LayersTool')
                        ?.orderingHistory?.length === historyLength,
                finalExpected.historyTriples.length,
                { timeout: 30000 }
            )
            const reloaded = await dragPageState(page)
            expect(reloaded.flat).toEqual(finalExpected.flat)
            expect(reloaded.order).toEqual(finalExpected._layersOrdered)
            expect(
                reloaded.history.map((entry) => entry.slice(0, 3))
            ).toEqual(finalExpected.historyTriples)
        }
        console.log(
            `Recorded seeded mouse drops: ${JSON.stringify({ seeds: seeds.length, drops: totalSteps })}`
        )
    })

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

    test('loads recorded translated triple URL ordering with the globe active', async ({
        page,
    }) => {
        const expected = legacyOrderingFixture.translatedGlobeUrl
        const pageErrors = []
        page.on('pageerror', (error) =>
            pageErrors.push(error.stack || error.message)
        )
        await loadMission(page)
        const encodedHistory = expected.historyTriples
            .map((entry) => entry.join('-'))
            .join('.')
        const translatedToolsUrl = `LayersTool$${encodedHistory}`
        pageErrors.length = 0
        await page.goto(
            `/?mission=Reference-Mission&panePercents=0%2C0%2C100&tools=${encodeURIComponent(translatedToolsUrl)}`
        )
        await page.waitForLoadState('networkidle', { timeout: 60000 })
        await page.waitForFunction(
            (toolUrl) =>
                window.L_?.FUTURES?.tools?.some(
                    (entry) => String(entry) === toolUrl
                ) && window.L_?.Globe_?.litho,
            translatedToolsUrl,
            { timeout: 30000 }
        )
        const startup = await page.evaluate(() => ({
            order: window.L_._layersOrdered.slice(),
            flat: window.ToolController_
                .getTool('LayersTool')
                ._debugFlat()
                .map(({ name, type, depth }) => ({ name, type, depth })),
            tools: window.L_.FUTURES.tools,
            globeRenderer: window.L_.Globe_?.litho?.rendererType,
            globeActive: [...document.querySelectorAll('button[role="switch"]')].some(
                (button) =>
                    button.textContent.trim() === 'Globe' &&
                    button.getAttribute('aria-checked') === 'true'
            ),
            toolOpen: Boolean(document.getElementById('layersTool')),
        }))

        expect(pageErrors).toEqual([])
        expect(startup.tools).toContain(translatedToolsUrl)
        expect(startup.flat).toEqual(expected.flat)
        expect(startup.order).toEqual(expected._layersOrdered)
        expect(startup.globeRenderer).toBeTruthy()
        expect(startup.globeActive).toBe(true)
        expect(startup.toolOpen).toBe(false)
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

    test('compares live mouse-drop scenarios with recorded results', async ({
        page,
    }) => {
        test.setTimeout(300000)
        const expectedCases = legacyOrderingFixture.liveMouseDropScenarios
        let matchingDrops = 0
        let intentionalRefusals = 0
        const scenarioBase = await prepareDragPage(page)
        expect(
            makeDragScenarios(scenarioBase).map(
                ({ label, from, to, collapseTarget, collapseSource }) => ({
                    label,
                    from,
                    to,
                    ...(collapseTarget ? { collapseTarget } : {}),
                    ...(collapseSource ? { collapseSource } : {}),
                })
            )
        ).toEqual(expectedCases.map(({ scenario }) => scenario))

        for (const expected of expectedCases) {
            const baseFlat = await prepareDragPage(page)
            expect(
                baseFlat.map(({ name, type, depth }) => ({
                    name,
                    type,
                    depth,
                }))
            ).toEqual(expected.baseFlat)
            const scenario = expected.scenario
            const sourceLabel = baseFlat[scenario.from].displayName
            const targetLabel = baseFlat[scenario.to].displayName
            const source = await dragRowInfo(page, sourceLabel)
            const target = await dragRowInfo(page, targetLabel)
            if (scenario.collapseTarget)
                await setDragHeaderExpanded(page, targetLabel, false)
            if (scenario.collapseSource)
                await setDragHeaderExpanded(page, sourceLabel, false)

            const before = await dragPageState(page)
            await dragWithMouse(
                page,
                orderingRow(page, source).locator('.lt-drag'),
                orderingRow(page, target)
            )
            const result = await dragPageState(page)
            const oracle = await applyRecordedDropOracle(
                page,
                expected.sortableCapture
            )
            const oracleFlat = oracle.flat.map(({ name, type, depth }) => ({
                name,
                type,
                depth,
            }))
            const isOwnSubtree = scenario.label === 'header into own contents'

            if (isOwnSubtree) {
                // Intentional divergence: LayersTool refuses self-subtree drops.
                expect(expected.legacyResult.historyTriples.length).toBeGreaterThan(0)
                expect(result.flat).toEqual(before.flat)
                expect(result.order).toEqual(before.order)
                expect(result.history).toEqual(before.history)
                await expect(page.locator('.lt-dropBlockedStatus')).toHaveText(
                    OWN_SUBTREE_BLOCKED_MESSAGE
                )
                intentionalRefusals += 1
                continue
            }

            expect(result.flat, scenario.label).toEqual(
                expected.legacyResult.flat
            )
            expect(result.order, scenario.label).toEqual(
                expected.legacyResult._layersOrdered
            )
            expect(
                result.history.map((entry) => entry.slice(0, 3)),
                scenario.label
            ).toEqual(expected.historyTriples)
            expect(result.history.at(-1)).toHaveLength(5)
            expect(oracleFlat, `${scenario.label} oracle`).toEqual(
                expected.legacyResult.flat
            )
            matchingDrops += 1
        }

        expect(matchingDrops).toBe(7)
        expect(intentionalRefusals).toBe(1)
        console.log(
            `Recorded live mouse drops: ${JSON.stringify({ matchingDrops, intentionalRefusals })}`
        )
    })

})
