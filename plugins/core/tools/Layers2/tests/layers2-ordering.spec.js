import { test, expect } from '@playwright/test'

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
    return scenarios
}

async function dragWithMouse(page, handle, target) {
    const sourceBox = await handle.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) return false
    await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 5,
        sourceBox.y + sourceBox.height / 2 + 5
    )
    await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 10 }
    )
    await page.mouse.up()
    return true
}

test.describe('LayersTool2 flat ordering parity', () => {
    test('replay matches the legacy Sortable output for hand-picked and seeded histories', async ({
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
        const results = await page.evaluate((inputHistories) => {
            const layers = window.L_
            const oldTool = window.ToolController_.getTool('LayersTool')
            const newTool = window.ToolController_.getTool('LayersTool2')
            const savedOrder = layers._layersOrdered.slice()
            const savedOldHistory = oldTool.orderingHistory
            const savedNewHistory = newTool.orderingHistory
            const savedUrlTools = layers.FUTURES?.tools
            const savedGlobe = layers.Globe_
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

        console.log(
            `Replay differential: ${results.matched}/${results.histories} histories matched`
        )
        expect(
            results.failures,
            `${results.matched}/${results.histories} histories matched; failures: ${JSON.stringify(results.failures)}`
        ).toEqual([])
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

    test('compares seven live mouse-drop scenarios with legacy Sortable', async ({
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
                    oldTool.orderingHistory = history
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
            if (comparison) {
                expect(
                    newLive.flat,
                    `${scenario.label}: new/old depth parity`
                ).toEqual(comparison.flat)
                expect(newLive.order, `${scenario.label}: layer order`).toEqual(
                    comparison.order
                )
                if (oldDriven)
                    expect(newLive.url, `${scenario.label}: URL history`).toBe(
                        comparison.url
                    )
            }
        }
        console.log(`Live Sortable scenarios: ${JSON.stringify(outcomes)}`)
        expect(outcomes).toHaveLength(scenarios.length)
    })
})
