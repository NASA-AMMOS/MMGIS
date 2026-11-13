import { test, expect } from '@playwright/test'
import {
    applyLiveMove,
    descendantsOf,
    flatten,
    replay,
} from '../ordering.js'
const fs = require('fs')

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
    const path = process.env.LAYERS2_RANDOM_DRAG_PLAN_FILE
    if (path) {
        const supplied = JSON.parse(fs.readFileSync(path, 'utf8'))
        return Object.entries(supplied)
            .filter(([, result]) => Array.isArray(result.planned))
            .map(([seed, result]) => ({
                seed: Number(seed),
                planned: result.planned,
            }))
    }
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
                window.ToolController_?.getTool('LayersTool2')?._debugFlat
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
                label: 'header into own child area',
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
    return `#lt2-row-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

async function dragRowInfo(page, tool, label) {
    return page.evaluate(
        ({ toolName, requestedLabel }) => {
            let rows
            if (toolName === 'old') {
                rows = Array.from(
                    document.querySelectorAll('#layersToolList > li')
                ).map((element) => ({
                    key: element.getAttribute('name'),
                    name: element.getAttribute('name'),
                    type: element.getAttribute('type'),
                    depth: Number.parseInt(
                        element.getAttribute('depth') || '0',
                        10
                    ),
                    label:
                        element.querySelector('.layerName')?.getAttribute(
                            'title'
                        ) ||
                        element.querySelector('.title')?.textContent?.trim() ||
                        element.textContent.trim(),
                    collapsed: element.getAttribute('childrenon') === 'false',
                }))
            } else {
                const tool = window.ToolController_.getTool('LayersTool2')
                rows = tool._debugFlat().map((row) => {
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
                            element?.querySelector('.lt2-chevron')
                                ?.getAttribute('aria-label') ===
                            'Expand group',
                    }
                })
            }
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
        },
        { toolName: tool, requestedLabel: label }
    )
}

function orderingRow(page, tool, info) {
    return tool === 'old'
        ? page.locator(
              `#layersToolList > li[name="${info.name.replaceAll('"', '\\"')}"]`
          )
        : page.locator(orderingRowSelector(info.key))
}

async function revealDragRow(page, tool, label) {
    const info = await dragRowInfo(page, tool, label)
    if (!info) throw new Error(`${tool} drag row not found: ${label}`)
    for (const ancestor of info.ancestors) {
        if (!ancestor.collapsed) continue
        const row = orderingRow(page, tool, ancestor)
        await row.locator(tool === 'old' ? '.headerChevron' : '.lt2-chevron').click()
    }
    return dragRowInfo(page, tool, label)
}

async function expandLegacyHeaders(page) {
    await page.locator('#searchLayers > #expand').click()
    await page.evaluate(() => {
        const tool = window.ToolController_.getTool('LayersTool')
        Array.from(
            document.querySelectorAll('#layersToolList > li[type="header"]')
        )
            .sort(
                (a, b) =>
                    Number.parseInt(a.getAttribute('depth') || '0', 10) -
                    Number.parseInt(b.getAttribute('depth') || '0', 10)
            )
            .forEach((header) => {
                if (header.getAttribute('childrenon') === 'false')
                    tool.toggleHeader(header.id)
            })
    })
}

async function setDragHeaderExpanded(page, tool, label, expanded) {
    const info = await revealDragRow(page, tool, label)
    if (info.type !== 'header')
        throw new Error(`${label} is not a header`)
    const isExpanded = !info.collapsed
    if (isExpanded === expanded) return
    await orderingRow(page, tool, info)
        .locator(tool === 'old' ? '.headerChevron' : '.lt2-chevron')
        .click()
}

async function installLegacyDropCapture(page) {
    await page.evaluate(() => {
        const list = document.getElementById('layersToolList')
        const sortable =
            window.Sortable?.get?.(list) ||
            Object.getOwnPropertyNames(list || {})
                .map((property) => list[property])
                .find(
                    (candidate) =>
                        candidate?.el === list &&
                        typeof candidate.option === 'function'
                )
        if (!sortable) throw new Error('Legacy Layers Sortable was not found')
        if (window.__layersToolSortableCaptureSortable === sortable) return
        window.__layersToolSortableCaptureSortable = sortable
        const snapshot = () =>
            Array.from(list.querySelectorAll(':scope > li')).map((row) => ({
                id: row.id,
                name: row.getAttribute('name'),
                type: row.getAttribute('type'),
                depth: row.getAttribute('depth'),
                on: row.getAttribute('on'),
                childrenon: row.getAttribute('childrenon'),
                height: Number.parseFloat(
                    window.getComputedStyle(row).height
                ),
            }))
        const onStart = sortable.option('onStart')
        const onEnd = sortable.option('onEnd')
        sortable.option('onStart', function (event) {
            window.__layersToolSortableCapture = { pre: snapshot() }
            return onStart?.call(this, event)
        })
        sortable.option('onEnd', function (event) {
            const capture = window.__layersToolSortableCapture || {}
            capture.indices = {
                oldIndex: event.oldIndex,
                newIndex: event.newIndex,
            }
            try {
                return onEnd?.call(this, event)
            } finally {
                capture.post = snapshot()
                window.__layersToolSortableCapture = capture
            }
        })
    })
}

async function applyLiveOracleFromLegacyCapture(page, capture) {
    return page.evaluate((drop) => {
        const flat = drop.pre.map((row) => {
            const name = row.name || row.id.replace(/^header_/, '')
            return {
                key: row.name || row.id,
                name,
                type: row.type,
                depth: Number.parseInt(row.depth, 10),
                on: row.on !== 'false',
                height: row.height > 0 ? 1 : 0,
                childrenon: row.childrenon,
            }
        })
        const expanded = Object.fromEntries(
            drop.pre
                .filter((row) => row.type === 'header')
                .map((row) => [
                    row.name || row.id.replace(/^header_/, ''),
                    row.childrenon !== 'false',
                ])
        )
        expanded.searchHidden = new Set(
            drop.pre
                .filter((row) => row.height === 0)
                .map((row) => row.name || row.id)
        )
        return window.ToolController_
            .getTool('LayersTool2')
            ._debugApplyLiveMove(
                flat,
                drop.indices.oldIndex,
                drop.indices.newIndex,
                expanded
            )
    }, capture)
}

async function prepareDragPage(page, tool) {
    await loadMission(page)
    const flat = await page.evaluate(() =>
        window.ToolController_.getTool('LayersTool2')._debugFlat([])
    )
    await page.setViewportSize({
        width: 1500,
        height: Math.min(10000, Math.max(4800, flat.length * 44)),
    })
    if (tool === 'old') {
        await page.locator('#toolButtonLayers').click()
        await expandLegacyHeaders(page)
    } else {
        await page.locator('#toolButtonLayers2').click()
        await page.getByRole('button', { name: 'Expand all' }).click()
    }
    const imagery = await page.evaluate(() => {
        const layer = Object.values(window.L_.layers.data).find(
            (candidate) => candidate.display_name === 'ArcGIS World Imagery'
        )
        return layer
            ? { name: layer.name, on: window.L_.layers.on[layer.name] }
            : null
    })
    if (imagery?.on) {
        const row =
            tool === 'old'
                ? page.locator(
                      `#layersToolList > li[name="${imagery.name.replaceAll('"', '\\"')}"]`
                  )
                : page
                      .locator('.lt2-layerRow')
                      .filter({ hasText: 'ArcGIS World Imagery' })
                      .first()
        await row
            .locator(tool === 'old' ? '.checkbox' : '[role="checkbox"]')
            .first()
            .click()
        await page.waitForFunction(
            (name) => window.L_.layers.on[name] === false,
            imagery.name
        )
    }
    return page.evaluate(() => window.L_.configData.layers)
}

async function performSeededDrag(page, tool, planned) {
    const spec = { ...planned }
    if (spec.toggle) {
        await revealDragRow(page, tool, spec.toggle)
        const toggleInfo = await dragRowInfo(page, tool, spec.toggle)
        await orderingRow(page, tool, toggleInfo)
            .locator(tool === 'old' ? '.headerChevron' : '.lt2-chevron')
            .click()
    }
    if (spec.targetState)
        await setDragHeaderExpanded(
            page,
            tool,
            spec.target,
            spec.targetState === 'expanded'
        )
    const targetInfo = await revealDragRow(page, tool, spec.target)
    const sourceInfo = await dragRowInfo(page, tool, spec.source)
    if (!sourceInfo) throw new Error(`${tool} drag row not found: ${spec.source}`)
    if (
        spec.targetState === 'collapsed' &&
        sourceInfo.index > targetInfo.index &&
        sourceInfo.depth > targetInfo.depth
    ) {
        const between = await page.evaluate(
            ({ toolName, start, end, depth }) => {
                const rows =
                    toolName === 'old'
                        ? Array.from(
                              document.querySelectorAll(
                                  '#layersToolList > li'
                              )
                          ).map((element) => ({
                              depth: Number.parseInt(
                                  element.getAttribute('depth') || '0',
                                  10
                              ),
                          }))
                        : window.ToolController_
                              .getTool('LayersTool2')
                              ._debugFlat()
                              .map((row) => ({ depth: row.depth }))
                return rows
                    .slice(start + 1, end)
                    .every((row) => row.depth > depth)
            },
            {
                toolName: tool,
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
    const source = await revealDragRow(page, tool, spec.source)
    const target = await revealDragRow(page, tool, spec.target)
    const sourceRow = orderingRow(page, tool, source)
    const targetRow = orderingRow(page, tool, target)
    const handle = sourceRow.locator(
        tool === 'old' ? '.layersToolColor' : '.lt2-drag'
    )
    await handle.scrollIntoViewIfNeeded()
    await targetRow.scrollIntoViewIfNeeded()
    const fraction = spec.position === 'above' ? 0.2 : 0.8
    if (tool === 'old') await installLegacyDropCapture(page)
    await dragWithMouse(page, handle, targetRow, fraction)
    return spec
}

async function dragPageState(page, tool) {
    return page.evaluate((toolName) => {
        if (toolName === 'old') {
            const tool = window.ToolController_.getTool('LayersTool')
            const rows = Array.from(
                document.querySelectorAll('#layersToolList > li')
            )
            return {
                flat: rows.map((row) => ({
                    name: row.getAttribute('name'),
                    type: row.getAttribute('type'),
                    depth: Number.parseInt(row.getAttribute('depth'), 10),
                })),
                visibility: rows.map((row) => ({
                    name: row.getAttribute('name'),
                    height: Number.parseFloat(
                        window.getComputedStyle(row).height
                    ),
                    on: row.getAttribute('on'),
                    expanded: row.getAttribute('childrenon'),
                })),
                order: window.L_._layersOrdered.slice(),
                history: tool.orderingHistory || [],
            }
        }
        const tool = window.ToolController_.getTool('LayersTool2')
        const flat = tool._debugFlat()
        const namesByKey = new Map(
            flat.map((row) => [row.key, row.displayName])
        )
        const renderedRows = Array.from(
            document.querySelectorAll('#layersTool2 [role="treeitem"]')
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
                    ) || row.id.replace(/^lt2-row-/, ''),
                name: namesByKey.get(
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt2-row-/, '')
                ),
                height: row.getBoundingClientRect().height,
                expanded: row.getAttribute('aria-expanded'),
            })),
            dom: renderedRows.map((row) => ({
                key:
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt2-row-/, ''),
                depth: Number(row.getAttribute('aria-level')) - 1,
            })),
            order: window.L_._layersOrdered.slice(),
            history: tool.orderingHistory || [],
        }
    }, tool)
}
test.describe('LayersTool2 flat ordering parity', () => {
    test('preserves legacy triple replay and translated URL compatibility for 52 histories', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers').click()
        await page.waitForSelector('#layersToolList > li')
        await page.evaluate(() =>
            window.ToolController_.closeActiveTool()
        )
        const baseFlat = await page.evaluate(() =>
            window.ToolController_.getTool('LayersTool2')._debugFlat([])
        )
        expect(baseFlat.length).toBeGreaterThan(2)
        const histories = makeHistories(baseFlat)
        expect(
            histories.every((history) =>
                history.every((entry) => entry.length === 3)
            )
        ).toBe(true)
        const results = await page.evaluate((inputHistories) => {
            const layers = window.L_
            const oldTool = window.ToolController_.getTool('LayersTool')
            const newTool = window.ToolController_.getTool('LayersTool2')
            const savedOrder = layers._layersOrdered.slice()
            const savedOldHistory = oldTool.orderingHistory
            const savedNewHistory = newTool.orderingHistory
            const savedUrlTools = layers.FUTURES?.tools
            const savedGlobe = layers.Globe_
            // Cesium mutates imagery-layer instances while sorting. Keep the
            // replay differential isolated; startup ordering is tested with
            // the live globe in its own fresh page below.
            layers.Globe_ = null
            const failures = []
            const rows = () =>
                Array.from(
                    document.querySelectorAll('#layersToolList > li')
                ).map((element) => ({
                    name: element.getAttribute('name'),
                    type: element.getAttribute('type'),
                    depth: Number.parseInt(element.getAttribute('depth'), 10),
                }))
            try {
                inputHistories.forEach((history, historyIndex) => {
                    let oldResult
                    let oldError = false
                    layers._layersOrdered = savedOrder.slice()
                    oldTool.orderingHistory = history.map((entry) => entry.slice())
                    try {
                        oldTool.make(null, true)
                        oldResult = {
                            flat: rows(),
                            order: layers._layersOrdered.slice(),
                        }
                    } catch (error) {
                        oldError = true
                        oldResult = {
                            error: String(error.stack || error),
                        }
                    } finally {
                        try {
                            oldTool.destroy()
                        } catch (error) {
                            void error
                        }
                    }

                    layers._layersOrdered = savedOrder.slice()
                    let newResult
                    let newError = false
                    try {
                        const encoded = history
                            .map((entry) => entry.join('-'))
                            .join('.')
                        layers.FUTURES.tools = [
                            ...(savedUrlTools || []).filter(
                                (value) =>
                                    !String(value).startsWith('LayersTool2$')
                            ),
                            `LayersTool2$${encoded}`,
                        ]
                        newTool.finalize()
                        newResult = {
                            flat: newTool
                                ._debugFlat()
                                .map(({ name, type, depth }) => ({
                                    name,
                                    type,
                                    depth,
                                })),
                            order: layers._layersOrdered.slice(),
                        }
                    } catch (error) {
                        newError = true
                        newResult = {
                            error: String(error.stack || error),
                        }
                    }

                    if (oldError !== newError) {
                        failures.push({
                            historyIndex,
                            history,
                            oldError: oldResult.error,
                            newError: newResult.error,
                        })
                    } else if (
                        !oldError &&
                        (JSON.stringify(oldResult.flat) !==
                            JSON.stringify(newResult.flat) ||
                            JSON.stringify(oldResult.order) !==
                                JSON.stringify(newResult.order))
                    ) {
                        failures.push({
                            historyIndex,
                            history,
                            old: oldResult,
                            next: newResult,
                        })
                    }
                })
                return {
                    histories: inputHistories.length,
                    matched: inputHistories.length - failures.length,
                    failures,
                }
            } finally {
                try {
                    oldTool.destroy()
                } catch (error) {
                    void error
                }
                oldTool.orderingHistory = savedOldHistory
                newTool.orderingHistory = savedNewHistory
                layers.FUTURES.tools = savedUrlTools
                layers.Globe_ = savedGlobe
                layers._layersOrdered = savedOrder
            }
        }, histories)

        const differences = results.failures.map((failure) => {
            const oldRows = failure.old?.flat || []
            const nextRows = failure.next?.flat || []
            const firstDivergingRow = oldRows.findIndex(
                (row, index) =>
                    JSON.stringify(row) !== JSON.stringify(nextRows[index])
            )
            return {
                historyIndex: failure.historyIndex,
                history: failure.history,
                firstDivergingRow:
                    firstDivergingRow < 0 ? null : firstDivergingRow,
                oldRowsAtDifference:
                    firstDivergingRow < 0
                        ? []
                        : oldRows.slice(firstDivergingRow, firstDivergingRow + 3),
                layers2RowsAtDifference:
                    firstDivergingRow < 0
                        ? []
                        : nextRows.slice(
                              firstDivergingRow,
                              firstDivergingRow + 3
                          ),
                downwardMoves: (failure.history || []).filter(
                    ([oldIndex, newIndex]) => newIndex > oldIndex
                ),
            }
        })
        console.log(
            `Legacy triple replay: ${JSON.stringify({
                matched: results.matched,
                histories: results.histories,
                differences,
                note: '3-tuples replay with the legacy pre-move Sortable index compensation.',
            })}`
        )
        expect(results.histories).toBe(histories.length)
        expect(results.failures).toEqual([])
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

    test('matches legacy live Sortable for an exact bottom drop', async ({
        page,
    }) => {
        test.setTimeout(180000)
        const prepareTool = async (tool) => {
            await loadMission(page)
            const flat = await page.evaluate(() =>
                window.ToolController_.getTool('LayersTool2')._debugFlat([])
            )
            await page.setViewportSize({
                width: 1500,
                height: Math.min(10000, Math.max(1600, flat.length * 44)),
            })
            if (tool === 'old') {
                await page.locator('#toolButtonLayers').click()
                await expandLegacyHeaders(page)
            } else {
                await page.locator('#toolButtonLayers2').click()
                await page.getByRole('button', { name: 'Expand all' }).click()
            }
            const imagery = await page.evaluate(() => {
                const layer = Object.values(window.L_.layers.data).find(
                    (candidate) =>
                        candidate.display_name === 'ArcGIS World Imagery'
                )
                return layer
                    ? { name: layer.name, on: window.L_.layers.on[layer.name] }
                    : null
            })
            if (imagery?.on) {
                const row =
                    tool === 'old'
                        ? page.locator(
                              `#layersToolList > li[name="${imagery.name}"]`
                          )
                        : page
                              .locator('.lt2-layerRow')
                              .filter({ hasText: 'ArcGIS World Imagery' })
                              .first()
                await row
                    .locator(
                        tool === 'old' ? '.checkbox' : '[role="checkbox"]'
                    )
                    .first()
                    .click()
                await page.waitForFunction(
                    (name) => window.L_.layers.on[name] === false,
                    imagery.name
                )
            }
            return flat
        }

        const oldBase = await prepareTool('old')
        const oldNames = await page.evaluate(() => {
            const layerName = (label) =>
                Object.values(window.L_.layers.data).find(
                    (layer) => layer.display_name === label
                ).name
            return {
                source: layerName('Points Basic'),
                target: layerName('Velocity - Sample particles'),
            }
        })
        const oldSource = page.locator(
            `#layersToolList > li[name="${oldNames.source}"]`
        )
        const oldTarget = page.locator(
            `#layersToolList > li[name="${oldNames.target}"]`
        )
        const oldHandle = oldSource.locator('.layersToolColor')
        await dragWithMouse(page, oldHandle, oldTarget, 0.8)
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory.length
                )
            )
            .toBe(1)
        const oldResult = await page.evaluate(() => ({
            flat: Array.from(
                document.querySelectorAll('#layersToolList > li')
            ).map((row) => ({
                name: row.getAttribute('name'),
                type: row.getAttribute('type'),
                depth: Number.parseInt(row.getAttribute('depth'), 10),
            })),
            order: window.L_._layersOrdered.slice(),
            history: window.ToolController_.getTool('LayersTool').orderingHistory,
        }))

        const newBase = await prepareTool('new')
        expect(newBase.map(({ name }) => name)).toEqual(
            oldBase.map(({ name }) => name)
        )
        const newRows = await page.evaluate(() => {
            const flat = window.ToolController_
                .getTool('LayersTool2')
                ._debugFlat()
            return {
                source: flat.find(
                    (row) => row.displayName === 'Points Basic'
                ),
                target: flat.find(
                    (row) =>
                        row.displayName === 'Velocity - Sample particles'
                ),
            }
        })
        const rowSelector = (key) =>
            `#lt2-row-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`
        const newSource = page.locator(rowSelector(newRows.source.key))
        const newTarget = page.locator(rowSelector(newRows.target.key))
        const newHandle = newSource.locator('.lt2-drag')
        await dragWithMouse(page, newHandle, newTarget, 0.8)
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool2')
                            .orderingHistory.length
                )
            )
            .toBe(1)
        const newResult = await page.evaluate(() => ({
            flat: window.ToolController_
                .getTool('LayersTool2')
                ._debugFlat()
                .map(({ name, type, depth }) => ({ name, type, depth })),
            keyedFlat: window.ToolController_
                .getTool('LayersTool2')
                ._debugFlat()
                .map(({ key, depth }) => ({ id: key, depth })),
            order: window.L_._layersOrdered.slice(),
            history: window.ToolController_.getTool('LayersTool2').orderingHistory,
            dom: Array.from(
                document.querySelectorAll('#layersTool2 [role="treeitem"]')
            ).map((row) => ({
                id:
                    row.querySelector('[data-row-id]')?.getAttribute(
                        'data-row-id'
                    ) || row.id.replace(/^lt2-row-/, ''),
                depth: Number(row.getAttribute('aria-level')) - 1,
            })),
        }))
        expect(newResult.history.map((entry) => entry.slice(0, 3))).toEqual(
            oldResult.history
        )
        expect(newResult.history[0]).toHaveLength(5)
        expect(newResult.flat).toEqual(oldResult.flat)
        expect(newResult.order).toEqual(oldResult.order)
        expect(newResult.order).toEqual(
            newResult.flat
                .filter((row) => row.type !== 'header')
                .map((row) => row.name)
        )
        expect(newResult.dom).toEqual(newResult.keyedFlat)
        console.log(
            `Exact bottom drop: ${JSON.stringify({
                legacyHistory: oldResult.history,
                layers2History: newResult.history,
                legacyMovedIndex: oldResult.flat.findIndex(
                    (row) => row.name === oldNames.source
                ),
                layers2MovedIndex: newResult.flat.findIndex(
                    (row) => row.name === oldNames.source
                ),
                legacyLastRow: oldResult.flat.at(-1)?.name,
                layers2LastRow: newResult.flat.at(-1)?.name,
            })}`
        )
    })

    test('matches legacy collapsed-header placement and its controls', async ({
        page,
    }) => {
        test.setTimeout(300000)
        const oldPage = await page.context().newPage()
        const newPage = await page.context().newPage()
        const cases = [
            {
                label: 'seed-120 both collapsed',
                source: '📄 GeoJSON Data Features',
                sourceExpanded: false,
                targetExpanded: false,
                sourceIndex: 3,
                targetIndex: 57,
                finalIndex: 34,
                finalDepth: 2,
                headerState: 1,
            },
            {
                label: 'source expanded',
                source: '📄 GeoJSON Data Features',
                sourceExpanded: true,
                targetExpanded: false,
                sourceIndex: 3,
                targetIndex: 57,
                finalIndex: 34,
                finalDepth: 2,
                headerState: 1,
            },
            {
                label: 'target expanded',
                source: '📄 GeoJSON Data Features',
                sourceExpanded: false,
                targetExpanded: true,
                sourceIndex: 3,
                targetIndex: 57,
                finalIndex: 33,
                finalDepth: 3,
                headerState: 2,
            },
            {
                label: 'other collapsed pair',
                source: 'Geometry Types',
                sourceExpanded: false,
                targetExpanded: false,
                sourceIndex: 4,
                targetIndex: 57,
                finalIndex: 53,
                finalDepth: 2,
                headerState: 1,
            },
        ]

        try {
            for (const scenario of cases) {
                await prepareDragPage(oldPage, 'old')
                await prepareDragPage(newPage, 'new')
                if (scenario.source === 'Geometry Types') {
                    await setDragHeaderExpanded(
                        oldPage,
                        'old',
                        '📄 GeoJSON Data Features',
                        true
                    )
                    await setDragHeaderExpanded(
                        newPage,
                        'new',
                        '📄 GeoJSON Data Features',
                        true
                    )
                }
                await setDragHeaderExpanded(
                    oldPage,
                    'old',
                    scenario.source,
                    scenario.sourceExpanded
                )
                await setDragHeaderExpanded(
                    newPage,
                    'new',
                    scenario.source,
                    scenario.sourceExpanded
                )
                await setDragHeaderExpanded(
                    oldPage,
                    'old',
                    'Filter Tab',
                    scenario.targetExpanded
                )
                await setDragHeaderExpanded(
                    newPage,
                    'new',
                    'Filter Tab',
                    scenario.targetExpanded
                )

                const sourceName = (await dragRowInfo(
                    oldPage,
                    'old',
                    scenario.source
                ))?.name
                const oldSpec = await performSeededDrag(oldPage, 'old', {
                    source: scenario.source,
                    target: 'Filter Tab',
                    position: 'below',
                })
                await performSeededDrag(newPage, 'new', oldSpec)

                const legacyDrop = await oldPage.evaluate(
                    () => window.__layersToolSortableCapture
                )
                const oldState = await dragPageState(oldPage, 'old')
                const newState = await dragPageState(newPage, 'new')
                const oldMovedIndex = oldState.flat.findIndex(
                    (row) => row.name === sourceName
                )
                const newMovedIndex = newState.flat.findIndex(
                    (row) => row.name === sourceName
                )
                const oracle = await applyLiveOracleFromLegacyCapture(
                    oldPage,
                    legacyDrop
                )
                const legacyPost = legacyDrop.post.map((row) => ({
                    name: row.name || row.id.replace(/^header_/, ''),
                    type: row.type,
                    depth: Number.parseInt(row.depth, 10),
                }))
                const unrelatedDepthTwoRows = legacyDrop.pre.filter(
                    (row, index) =>
                        index > scenario.targetIndex &&
                        Number.parseInt(row.depth, 10) === 2
                )

                expect(legacyDrop.indices).toEqual({
                    oldIndex: scenario.sourceIndex,
                    newIndex: scenario.targetIndex,
                })
                expect(unrelatedDepthTwoRows.length).toBeGreaterThan(0)
                for (const row of unrelatedDepthTwoRows)
                    expect(row.height).toBeGreaterThan(0)
                expect(oldMovedIndex, scenario.label).toBe(
                    scenario.finalIndex
                )
                expect(newMovedIndex, scenario.label).toBe(
                    scenario.finalIndex
                )
                expect(oldState.flat).toEqual(newState.flat)
                expect(oldState.order).toEqual(newState.order)
                expect(newState.history.at(-1)).toEqual([
                    scenario.sourceIndex,
                    scenario.targetIndex,
                    scenario.headerState,
                    scenario.finalIndex,
                    scenario.finalDepth,
                ])
                expect(newState.history.at(-1).slice(0, 3)).toEqual(
                    oldState.history.at(-1)
                )
                expect(
                    oracle.flat.map(({ name, type, depth }) => ({
                        name,
                        type,
                        depth,
                    }))
                ).toEqual(legacyPost)
                console.log(
                    `Collapsed-header control ${scenario.label}: ${JSON.stringify({
                        legacyHistory: oldState.history,
                        layers2History: newState.history,
                        finalIndex: newMovedIndex,
                        finalDepth: newState.flat[newMovedIndex].depth,
                    })}`
                )
            }
        } finally {
            await oldPage.close()
            await newPage.close()
        }
    })

    test('matches seeded real-mouse drags against legacy live Sortable', async ({
        page,
    }) => {
        test.setTimeout(1200000)
        const newPage = await page.context().newPage()
        const seedResults = []
        const indexMapping = { matched: 0, total: 0, failures: [] }
        const liveAlgorithm = { matched: 0, total: 0, failures: [] }
        try {
            for (const { seed, planned } of seededDragPlans()) {
                const divergences = []
                const oldConfig = await prepareDragPage(page, 'old')
                const newConfig = await prepareDragPage(newPage, 'new')
                expect(
                    flatten(newConfig).map(({ name, type, depth }) => ({
                        name,
                        type,
                        depth,
                    }))
                ).toEqual(
                    flatten(oldConfig).map(({ name, type, depth }) => ({
                        name,
                        type,
                        depth,
                    }))
                )
                console.log(`Seeded live-drag parity seed ${seed}: ${planned.length} steps`)
                for (const [index, spec] of planned.entries()) {
                    const legacySpec = await performSeededDrag(
                        page,
                        'old',
                        spec
                    )
                    const layers2Spec = await performSeededDrag(
                        newPage,
                        'new',
                        legacySpec
                    )
                    const sameDrag =
                        JSON.stringify(layers2Spec) ===
                        JSON.stringify(legacySpec)
                    const legacyDrop = await page.evaluate(
                        () => window.__layersToolSortableCapture
                    )
                    const oldState = await dragPageState(page, 'old')
                    const newState = await dragPageState(newPage, 'new')
                    const applyLiveOracle =
                        await applyLiveOracleFromLegacyCapture(
                            page,
                            legacyDrop
                        )
                    const layers2Entry = newState.history.at(-1)
                    const legacyPost = legacyDrop.post.map((row) => ({
                        name:
                            row.name ||
                            row.id.replace(/^header_/, ''),
                        type: row.type,
                        depth: Number.parseInt(row.depth, 10),
                    }))
                    const indexMappingMatches =
                        legacyDrop?.indices?.oldIndex === layers2Entry?.[0] &&
                        legacyDrop?.indices?.newIndex === layers2Entry?.[1]
                    const liveAlgorithmMatches =
                        JSON.stringify(
                            applyLiveOracle.flat?.map(
                                ({ name, type, depth }) => ({
                                    name,
                                    type,
                                    depth,
                                })
                            )
                        ) === JSON.stringify(legacyPost)
                    indexMapping.total += 1
                    liveAlgorithm.total += 1
                    if (indexMappingMatches) indexMapping.matched += 1
                    else
                        indexMapping.failures.push({
                            seed,
                            step: index + 1,
                            sortableIndices: legacyDrop?.indices,
                            layers2Indices: layers2Entry?.slice(0, 2),
                        })
                    if (liveAlgorithmMatches) liveAlgorithm.matched += 1
                    else
                        liveAlgorithm.failures.push({
                            seed,
                            step: index + 1,
                            indices: legacyDrop?.indices,
                            capture: legacyDrop,
                            predicted: applyLiveOracle.flat,
                            legacy: oldState.flat,
                        })
                    const movedName = flatten(newConfig).find(
                        ({ node }) => node.display_name === spec.source
                    )?.name
                    console.log(
                        `Seed ${seed}, step ${index + 1} (${spec.source} -> ${spec.target}): ${JSON.stringify({
                            oldHistory: oldState.history,
                            layers2History: newState.history,
                            oldMovedIndex: oldState.flat.findIndex(
                                (row) => row.name === movedName
                            ),
                            layers2MovedIndex: newState.flat.findIndex(
                                (row) => row.name === movedName
                            ),
                        })}`
                    )
                    const firstDifferentRow = newState.flat.findIndex(
                        (row, rowIndex) =>
                            JSON.stringify(row) !==
                            JSON.stringify(oldState.flat[rowIndex])
                    )
                    let rowHeightEvidence = null
                    if (firstDifferentRow >= 0) {
                        const from = Math.max(0, firstDifferentRow - 2)
                        const to = firstDifferentRow + 8
                        const nearbyNames = oldState.flat
                            .slice(from, to)
                            .map((row) => row.name)
                        const newHeights = new Map(
                            newState.visibility.map((row) => [
                                row.name,
                                row,
                            ])
                        )
                        rowHeightEvidence = {
                            old: oldState.visibility.filter((row) =>
                                nearbyNames.includes(row.name)
                            ),
                            layers2: nearbyNames.map(
                                    (name) =>
                                        newHeights.get(name) || {
                                            name,
                                            height: 0,
                                            expanded: null,
                                        }
                                ),
                        }
                    }
                    const matching = {
                        sameDrag,
                        orderAndDepth:
                            JSON.stringify(newState.flat) ===
                            JSON.stringify(oldState.flat),
                        mapOrder:
                            JSON.stringify(newState.order) ===
                            JSON.stringify(oldState.order),
                        history:
                            JSON.stringify(
                                newState.history.map((entry) =>
                                    entry.slice(0, 3)
                                )
                            ) === JSON.stringify(oldState.history),
                            historyLength:
                                oldState.history.length === index + 1 &&
                                newState.history.length === index + 1,
                            sortableIndices: indexMappingMatches,
                            liveAlgorithm: liveAlgorithmMatches,
                        }
                    if (Object.values(matching).some((value) => !value)) {
                        const divergence = {
                            seed,
                            step: index + 1,
                            drag: { old: legacySpec, layers2: layers2Spec },
                            histories: {
                                old: oldState.history,
                                layers2: newState.history,
                            },
                            oldMovedIndex: oldState.flat.findIndex(
                                (row) => row.name === movedName
                            ),
                            layers2MovedIndex: newState.flat.findIndex(
                                (row) => row.name === movedName
                            ),
                            matching,
                            rowHeightEvidence,
                            legacyDrop,
                            layers2Indices: layers2Entry?.slice(0, 2),
                            applyLiveOracle,
                        }
                        if (divergences.length === 0)
                            console.log(
                                `Seed ${seed}, step ${index + 1} first divergence: ${JSON.stringify(divergence)}`
                            )
                        divergences.push(divergence)
                    }
                    const expectedReplay = replay(
                        flatten(newConfig),
                        newState.history
                    ).flat
                    const replayMatchesLive =
                        JSON.stringify(newState.flat) ===
                        JSON.stringify(
                            expectedReplay.map(({ name, type, depth }) => ({
                            name,
                            type,
                            depth,
                            }))
                        )
                    const modelIndex = new Map(
                        expectedReplay.map((row, rowIndex) => [
                            row.key,
                            { rowIndex, depth: row.depth },
                        ])
                    )
                    let renderedDepthsMatch = true
                    const visibleIndexes = newState.dom.map((row) => {
                        if (modelIndex.get(row.key)?.depth !== row.depth)
                            renderedDepthsMatch = false
                        return modelIndex.get(row.key)?.rowIndex
                    })
                    const renderedRowsOrdered =
                        JSON.stringify(visibleIndexes) ===
                        JSON.stringify(
                            visibleIndexes.slice().sort((a, b) => a - b)
                        )
                    if (!replayMatchesLive || !renderedDepthsMatch || !renderedRowsOrdered)
                        divergences.push({
                            seed,
                            step: index + 1,
                            replayMatchesLive,
                            renderedDepthsMatch,
                            renderedRowsOrdered,
                        })
                }
                const shared = await newPage.evaluate(() => {
                    const tool =
                        window.ToolController_.getTool('LayersTool2')
                    const history = tool.orderingHistory.map((entry) => [
                        ...entry,
                    ])
                    const flat = tool._debugFlat().map(
                        ({ name, type, depth }) => ({ name, type, depth })
                    )
                    const order = window.L_._layersOrdered.slice()
                    const encoded = tool.getUrlString()
                    const previousTools = window.L_.FUTURES?.tools
                    const otherTools = (previousTools || []).filter(
                        (entry) => !String(entry).startsWith('LayersTool2$')
                    )
                    window.L_.FUTURES.tools = [
                        ...otherTools,
                        `LayersTool2$${encoded}`,
                    ]
                    tool.orderingHistory = []
                    tool.finalize()
                    const replayed = {
                        flat: tool._debugFlat().map(
                            ({ name, type, depth }) => ({ name, type, depth })
                        ),
                        order: window.L_._layersOrdered.slice(),
                    }
                    tool.orderingHistory = history
                    window.L_.FUTURES.tools = previousTools
                    return { encoded, flat, order, replayed, history }
                })
                expect(shared.encoded).toMatch(/^\d+-\d+-\d+-\d+-\d+/)
                const selfConsistent =
                    JSON.stringify(shared.replayed) ===
                    JSON.stringify({
                        flat: shared.flat,
                        order: shared.order,
                    })
                const shareUrl = new URL(newPage.url())
                shareUrl.searchParams.set('mission', 'Reference-Mission')
                shareUrl.searchParams.set('panePercents', '0,0,100')
                shareUrl.searchParams.set(
                    'tools',
                    `LayersTool2$${shared.encoded}`
                )
                await newPage.goto(shareUrl.toString())
                await newPage.waitForLoadState('networkidle', {
                    timeout: 60000,
                })
                await newPage.waitForFunction(
                    ({ encoded, historyLength }) => {
                        const tool =
                            window.ToolController_?.getTool('LayersTool2')
                        return (
                            tool?.getUrlString?.() === encoded &&
                            tool.orderingHistory?.length === historyLength
                        )
                    },
                    {
                        encoded: shared.encoded,
                        historyLength: shared.history.length,
                    },
                    { timeout: 30000 }
                )
                const reloaded = await newPage.evaluate(() => {
                    const tool =
                        window.ToolController_.getTool('LayersTool2')
                    return {
                        flat: tool._debugFlat().map(
                            ({ name, type, depth }) => ({ name, type, depth })
                        ),
                        order: window.L_._layersOrdered.slice(),
                        history: tool.orderingHistory.map((entry) => [
                            ...entry,
                        ]),
                    }
                })
                const urlReloadMatchesLive =
                    JSON.stringify(reloaded) ===
                    JSON.stringify({
                        flat: shared.flat,
                        order: shared.order,
                        history: shared.history,
                    })
                seedResults.push({
                    seed,
                    steps: planned.length,
                    matching:
                        divergences.length === 0 &&
                        selfConsistent &&
                        urlReloadMatchesLive,
                    selfConsistent: selfConsistent && urlReloadMatchesLive,
                    urlReloadMatchesLive,
                    indexMappingMatches: divergences.every(
                        ({ matching }) => matching?.sortableIndices !== false
                    ),
                    liveAlgorithmMatches: divergences.every(
                        ({ matching }) => matching?.liveAlgorithm !== false
                    ),
                    firstDivergence: divergences[0] || null,
                })
                console.log(
                    `Seed ${seed} result: ${JSON.stringify(seedResults.at(-1))}`
                )
            }
            console.log(
                `Seeded drop oracle totals: ${JSON.stringify({
                    indexMapping: {
                        matched: indexMapping.matched,
                        total: indexMapping.total,
                        failures: indexMapping.failures,
                    },
                    liveAlgorithm: {
                        matched: liveAlgorithm.matched,
                        total: liveAlgorithm.total,
                        failures: liveAlgorithm.failures,
                    },
                })}`
            )
            expect(indexMapping.matched, 'Sortable index mappings').toBe(
                indexMapping.total
            )
            expect(liveAlgorithm.matched, 'legacy live algorithm oracle').toBe(
                liveAlgorithm.total
            )
            expect(seedResults, 'all eight seeded drags match live and replay').toEqual(
                seededDragPlans().map(({ seed, planned }) => ({
                    seed,
                    steps: planned.length,
                    matching: true,
                    selfConsistent: true,
                    urlReloadMatchesLive: true,
                    indexMappingMatches: true,
                    liveAlgorithmMatches: true,
                    firstDivergence: null,
                }))
            )
        } finally {
            await newPage.close()
        }
    })

    test('keeps LayersTool2 ordering usable after a globe reorder error', async ({
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
            window.ToolController_.getTool('LayersTool2')._debugFlat([])
        )
        await page.setViewportSize({
            width: 1500,
            height: Math.min(10000, Math.max(4800, flat.length * 44)),
        })
        await page.locator('#toolButtonLayers2').click()
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
                .locator('.lt2-layerRow')
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
                'new',
                sourceLabel
            )
            const targetInfo = await revealDragRow(
                page,
                'new',
                targetLabel
            )
            const source = orderingRow(page, 'new', sourceInfo)
            const target = orderingRow(page, 'new', targetInfo)
            const historyLength = await page.evaluate(
                () =>
                    window.ToolController_.getTool('LayersTool2')
                        .orderingHistory.length
            )
            await dragWithMouse(
                page,
                source.locator('.lt2-drag'),
                target,
                fraction
            )
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            window.ToolController_.getTool('LayersTool2')
                                .orderingHistory.length
                    )
                )
                .toBe(historyLength + 1)
            await expect(
                page.getByRole('tree', { name: 'Layers' })
            ).toHaveAttribute('data-active-drag-id', '')
            const state = await page.evaluate(() => {
                const flat = window.ToolController_
                    .getTool('LayersTool2')
                    ._debugFlat()
                return {
                    flat: flat.map(({ name, type, depth }) => ({
                        name,
                        type,
                        depth,
                    })),
                    order: window.L_._layersOrdered.slice(),
                    history: window.ToolController_.getTool('LayersTool2')
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
                    /LayersTool2 failed to synchronize map order|DeveloperError|destroyed/i.test(
                        text
                    )
                ),
                history: second.history,
                orderConsistent: true,
            })}`
        )
    })

    test('loads translated legacy triple URL ordering at startup with the globe active', async ({
        page,
    }) => {
        const pageErrors = []
        page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))
        await loadMission(page)
        const history = [[5, 2, 2]]
        const legacyState = await page.evaluate((entries) => {
            const oldTool = window.ToolController_.getTool('LayersTool')
            const savedOrder = window.L_._layersOrdered.slice()
            const savedHistory = oldTool.orderingHistory
            const savedGlobe = window.L_.Globe_
            window.L_.Globe_ = null
            oldTool.orderingHistory = entries.map((entry) => entry.slice())
            try {
                oldTool.make(null, true)
                return {
                    flat: Array.from(
                        document.querySelectorAll('#layersToolList > li')
                    ).map((row) => ({
                        name: row.getAttribute('name'),
                        type: row.getAttribute('type'),
                        depth: Number.parseInt(
                            row.getAttribute('depth') || '0',
                            10
                        ),
                    })),
                    order: window.L_._layersOrdered.slice(),
                }
            } finally {
                try {
                    oldTool.destroy()
                } catch (error) {
                    void error
                }
                oldTool.orderingHistory = savedHistory
                window.L_._layersOrdered = savedOrder
                window.L_.Globe_ = savedGlobe
            }
        }, history)
        const encodedHistory = history.map((entry) => entry.join('-')).join('.')
        const legacyToolsUrl = `LayersTool$${encodedHistory}`
        const translatedToolsUrl = legacyToolsUrl.replace(
            'LayersTool$',
            'LayersTool2$'
        )
        pageErrors.length = 0
        await page.goto(
            `/?mission=Reference-Mission&panePercents=0%2C0%2C100&tools=${encodeURIComponent(translatedToolsUrl)}`
        )
        await page.waitForLoadState('networkidle', { timeout: 60000 })
        await page.waitForFunction(
            (toolUrl) =>
                window.L_?.FUTURES?.tools?.some((entry) =>
                    String(entry) === toolUrl
                ) && window.L_?.Globe_?.litho,
            translatedToolsUrl,
            { timeout: 30000 }
        )
        const startup = await page.evaluate(() => ({
            order: window.L_._layersOrdered.slice(),
            flat: window.ToolController_
                .getTool('LayersTool2')
                ._debugFlat()
                .map(({ name, type, depth }) => ({ name, type, depth })),
            tools: window.L_.FUTURES.tools,
            globeRenderer: window.L_.Globe_?.litho?.rendererType,
            globeActive: [...document.querySelectorAll('button[role="switch"]')].some(
                (button) =>
                    button.textContent.trim() === 'Globe' &&
                    button.getAttribute('aria-checked') === 'true'
            ),
            toolOpen: Boolean(document.getElementById('layersTool2')),
        }))

        expect(pageErrors).toEqual([])
        expect(startup.tools).toContain(translatedToolsUrl)
        expect(startup.flat).toEqual(legacyState.flat)
        expect(startup.order).toEqual(legacyState.order)
        expect(startup.globeRenderer).toBeTruthy()
        expect(startup.globeActive).toBe(true)
        expect(startup.toolOpen).toBe(false)
    })

    test('Alt+Down moves an expanded header past its whole subtree', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers2').click()
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
        const headerRowId = `lt2-row-${headerKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`

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
                        window.ToolController_.getTool('LayersTool2')
                            .orderingHistory.length
                )
            )
            .toBe(1)
        const actual = await page.evaluate(() => {
            const tool = window.ToolController_.getTool('LayersTool2')
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
        await page.locator('#toolButtonLayers2').click()
        const tree = page.getByRole('tree', { name: 'Layers' })
        await expect(tree).toBeVisible()
        await tree.focus()
        await page.keyboard.press('Home')
        const before = await page.evaluate(() => ({
            history: window.ToolController_.getTool('LayersTool2')
                .orderingHistory,
            order: window.L_._layersOrdered.slice(),
        }))
        await page.keyboard.press('Alt+ArrowUp')
        await page.waitForTimeout(100)
        const after = await page.evaluate(() => ({
            history: window.ToolController_.getTool('LayersTool2')
                .orderingHistory,
            order: window.L_._layersOrdered.slice(),
        }))
        expect(after).toEqual(before)
        await expect(page.locator('.lt2-toast')).toHaveCount(0)
    })

    test('repeats keyboard and mouse moves, undoes twice, and preserves config', async ({
        page,
    }) => {
        await loadMission(page)
        await page.locator('#toolButtonLayers2').click()
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
                        window.ToolController_.getTool('LayersTool2')
                            .orderingHistory.length
                )
            )
            .toBe(3)

        const layerRows = page.locator('.lt2-layerRow')
        await expect(layerRows.nth(1)).toBeVisible()
        const dragHandle = await layerRows.nth(0).locator('.lt2-drag').boundingBox()
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
                        window.ToolController_.getTool('LayersTool2')
                            .orderingHistory.length
                )
            )
            .toBe(4)
        await page.getByRole('button', { name: 'Undo' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool2')
                            .orderingHistory.length
                    )
                )
            .toBe(3)
        await page.getByRole('button', { name: 'Undo' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool2')
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

    test('compares live mouse-drop scenarios with legacy Sortable', async ({
        page,
    }) => {
        test.setTimeout(300000)
        await loadMission(page)
        const baseFlat = await page.evaluate(() =>
            window.ToolController_.getTool('LayersTool2')._debugFlat([])
        )
        await page.setViewportSize({
            width: 1280,
            height: Math.min(10000, Math.max(1600, baseFlat.length * 44)),
        })
        const scenarios = makeDragScenarios(baseFlat)
        const outcomes = []
        for (const scenario of scenarios) {
            console.log(`Live drag scenario: ${scenario.label}`)
            await page.goto('/?mission=Reference-Mission')
            await page.waitForLoadState('networkidle', { timeout: 60000 })
            await page.waitForFunction(() => !!window.L_?.layers?.data)
            await page.locator('#toolButtonLayers').click()
            await page.locator('#layersToolList > li').first().waitFor()
            const oldTool = await page.evaluate(() => {
                const tool = window.ToolController_.getTool('LayersTool')
                tool.orderingHistory = []
                document
                    .querySelectorAll('#layersToolList > li[type="header"]')
                    .forEach((header) => {
                        if (header.getAttribute('childrenon') === 'false')
                            tool.toggleHeader(header.id)
                    })
                return true
            })
            expect(oldTool).toBeTruthy()
            const fromName = baseFlat[scenario.from].name
            const toName = baseFlat[scenario.to].name
            const fromOld = page.locator(
                `#layersToolList > li[name="${fromName}"]`
            )
            const toOld = page.locator(
                `#layersToolList > li[name="${toName}"]`
            )
            if (scenario.collapseTarget || scenario.collapseSource) {
                await page.evaluate((index) => {
                    const row = document.querySelector(
                        `#layersToolList > li:nth-child(${index + 1})`
                    )
                    if (row?.getAttribute('type') === 'header') {
                        window.ToolController_.getTool('LayersTool').toggleHeader(
                            row.id
                        )
                    }
                }, scenario.collapseTarget ? scenario.to : scenario.from)
            }
            const oldHandle = fromOld.locator('.layersToolColor')
            await installLegacyDropCapture(page)
            await oldHandle.dragTo(toOld, { steps: 80 }).catch(() => {})
            let oldHistory = await page.evaluate(
                () =>
                    window.ToolController_.getTool('LayersTool').orderingHistory
            )
            if (!oldHistory.length) {
                await dragWithMouse(page, oldHandle, toOld)
                oldHistory = await page.evaluate(
                    () =>
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory
                )
            }
            if (!oldHistory.length) {
                const forceFallback = await page.evaluate(() => {
                    const sortable = window.Sortable?.get?.(
                        document.getElementById('layersToolList')
                    )
                    if (!sortable) return false
                    sortable.option('forceFallback', true)
                    return true
                })
                if (forceFallback) {
                    await dragWithMouse(page, oldHandle, toOld)
                    oldHistory = await page.evaluate(
                        () =>
                            window.ToolController_.getTool('LayersTool')
                                .orderingHistory
                    )
                }
            }
            const oldDropCapture = await page.evaluate(
                () => window.__layersToolSortableCapture
            )
            const oldDriven = oldHistory.length > 0
            const oldLive = oldDriven
                ? await page.evaluate(() => ({
                      flat: Array.from(
                          document.querySelectorAll('#layersToolList > li')
                      ).map((row) => ({
                          name: row.getAttribute('name'),
                          type: row.getAttribute('type'),
                          depth: Number.parseInt(row.getAttribute('depth'), 10),
                      })),
                      order: window.L_._layersOrdered.slice(),
                      url: window.ToolController_.getTool('LayersTool')
                          .getUrlString(),
                      history:
                          window.ToolController_.getTool('LayersTool')
                              .orderingHistory,
                  }))
                : null
            const screenshotSlug = scenario.label.replaceAll(' ', '-')
            if (
                oldDriven &&
                ['into expanded header', 'expanded header with children'].includes(
                    scenario.label
                )
            )
                await page.screenshot({
                    path: `/home/ubuntu/work/lt2-shots/v3/reorder-${screenshotSlug}-old.png`,
                })
            await page.evaluate(() =>
                window.ToolController_.closeActiveTool()
            )
            await page.evaluate(() => {
                const tool = window.ToolController_.getTool('LayersTool2')
                tool.orderingHistory = []
            })
            await page.locator('#toolButtonLayers2').click()
            await page.getByRole('button', { name: 'Expand all' }).click()
            const rowSelector = (key) =>
                `#lt2-row-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`
            const newFrom = page.locator(rowSelector(baseFlat[scenario.from].key))
            const newTo = page.locator(rowSelector(baseFlat[scenario.to].key))
            if (scenario.collapseTarget || scenario.collapseSource) {
                const collapseId = baseFlat[
                    scenario.collapseTarget ? scenario.to : scenario.from
                ].key
                await page
                    .locator(`[data-row-id="${collapseId}"] .lt2-chevron`)
                    .click()
            }
            await newFrom.scrollIntoViewIfNeeded()
            await newTo.scrollIntoViewIfNeeded()
            const newHandle = newFrom.locator('.lt2-drag')
            await newHandle.dragTo(newTo, { steps: 80 }).catch(() => {})
            let newHistory = await page.evaluate(
                () =>
                    window.ToolController_.getTool('LayersTool2')
                        .orderingHistory
            )
            if (!newHistory.length)
                await dragWithMouse(page, newHandle, newTo)
            newHistory = await page.evaluate(
                () =>
                    window.ToolController_.getTool('LayersTool2')
                        .orderingHistory
            )
            let newLive = await page.evaluate(() => ({
                flat: window.ToolController_
                    .getTool('LayersTool2')
                    ._debugFlat()
                    .map(({ name, type, depth }) => ({ name, type, depth })),
                order: window.L_._layersOrdered.slice(),
                url: window.ToolController_.getTool('LayersTool2').getUrlString(),
            }))
            let comparison = oldLive
            if (!oldDriven) {
                await page.evaluate((history) => {
                    window.ToolController_.closeActiveTool()
                    window.L_._layersOrdered = window.L_._layersOrdered.slice()
                    const oldTool = window.ToolController_.getTool('LayersTool')
                    oldTool.orderingHistory = history.map((entry) =>
                        entry.slice(0, 3)
                    )
                    oldTool.make(null, true)
                }, newHistory)
                comparison = await page.evaluate(() => ({
                    flat: Array.from(
                        document.querySelectorAll('#layersToolList > li')
                    ).map((row) => ({
                        name: row.getAttribute('name'),
                        type: row.getAttribute('type'),
                        depth: Number.parseInt(row.getAttribute('depth'), 10),
                    })),
                    order: window.L_._layersOrdered.slice(),
                    url: window.ToolController_.getTool('LayersTool')
                        .getUrlString(),
                    history:
                        window.ToolController_.getTool('LayersTool')
                            .orderingHistory,
                }))
                if (
                    ['into expanded header', 'expanded header with children'].includes(
                        scenario.label
                    )
                )
                    await page.screenshot({
                        path: `/home/ubuntu/work/lt2-shots/v3/reorder-${screenshotSlug}-old.png`,
                    })
            }
            if (
                ['into expanded header', 'expanded header with children'].includes(
                    scenario.label
                )
            )
                await page.screenshot({
                    path: `/home/ubuntu/work/lt2-shots/v3/reorder-${screenshotSlug}-new.png`,
                })
            outcomes.push({
                scenario: scenario.label,
                oldSortableDriven: oldDriven,
                compared: !!comparison,
                history: newHistory,
            })
            console.log(
                `${scenario.label}: Sortable=${oldDriven}, old history=${JSON.stringify(oldHistory)}, new history=${JSON.stringify(newHistory)}`
            )
            if (
                scenario.label ===
                'OSM Buildings onto collapsed Geometry Types'
            ) {
                const flatRows = baseFlat.map(
                    ({ key, name, type, depth }) => ({
                        key,
                        name,
                        type,
                        depth,
                    })
                )
                const expanded = Object.fromEntries(
                    flatRows
                        .filter((row) => row.type === 'header')
                        .map((row) => [row.name, true])
                )
                expanded[flatRows[scenario.to].name] = false
                const simulated = applyLiveMove(
                    flatRows,
                    scenario.from,
                    scenario.to,
                    expanded
                ).flat
                const applyLiveOracle = oldDropCapture?.indices
                    ? await applyLiveOracleFromLegacyCapture(
                          page,
                          oldDropCapture
                      )
                    : null
                const oracleMatchesLegacy =
                    JSON.stringify(
                        applyLiveOracle?.flat?.map(
                            ({ name, type, depth }) => ({
                                name,
                                type,
                                depth,
                            })
                        )
                    ) === JSON.stringify(comparison?.flat)
                const summarize = (rows) => {
                    const index = rows.findIndex(
                        (row) => row.name === flatRows[scenario.from].name
                    )
                    return {
                        index,
                        rows: rows
                            .slice(Math.max(0, index - 2), index + 3)
                            .map(({ name, type, depth }) => ({
                                name,
                                type,
                                depth,
                            })),
                    }
                }
                console.log(
                    `Collapsed-header placement: ${JSON.stringify({
                        old: summarize(comparison?.flat || []),
                        layers2: summarize(newLive.flat),
                        applyLiveMove: summarize(simulated),
                        sortableIndices: oldDropCapture?.indices,
                        oracleMatchesLegacy,
                        capture: oldDropCapture,
                    })}`
                )
            }
            if (comparison) {
                expect(
                    newLive.order,
                    `${scenario.label}: map order matches the derived tree order`
                ).toEqual(
                    newLive.flat
                        .filter((row) => row.type !== 'header')
                        .map((row) => row.name)
                )
                expect(
                    newLive.flat,
                    `${scenario.label}: new/old depth parity`
                ).toEqual(comparison.flat)
                expect(newLive.order, `${scenario.label}: layer order`).toEqual(
                    comparison.order
                )
                expect(
                    newHistory.every((entry) => entry.length === 5),
                    `${scenario.label}: Layers2 records resolved placements`
                ).toBe(true)
                expect(
                    newHistory.map((entry) => entry.slice(0, 3)),
                    `${scenario.label}: legacy history fields`
                ).toEqual(comparison.history)
            }
        }
        console.log(`Live Sortable scenarios: ${JSON.stringify(outcomes)}`)
        expect(outcomes).toHaveLength(scenarios.length)
        const collapsedGeometryDrop = outcomes.find(
            (outcome) =>
                outcome.scenario ===
                'OSM Buildings onto collapsed Geometry Types'
        )
        expect(
            collapsedGeometryDrop?.oldSortableDriven,
            'the exact collapsed Geometry Types drop must exercise legacy Sortable'
        ).toBe(true)
    })
})
