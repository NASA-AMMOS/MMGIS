import { test, expect } from '@playwright/test'

async function openLayers2(page) {
    await page.goto('/?mission=Reference-Mission')
    await page.waitForLoadState('networkidle', { timeout: 60000 })
    await page.waitForFunction(
        () => !!(window.mmgisAPI && window.mmgisAPI.map),
        { timeout: 30000 }
    )
    await page.locator('#toolButtonLayers2').click()
    await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
}

test.describe('LayersTool2', () => {
    test('opens, closes, and reopens with its list state intact', async ({
        page,
    }) => {
        await openLayers2(page)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill('points')
        await page.waitForTimeout(200)
        await expect(search).toHaveValue('points')

        await page.evaluate(() =>
            window.ToolController_.closeActiveTool()
        )
        await page.locator('#toolButtonLayers2').click()
        await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
        await expect(
            page.getByRole('textbox', { name: 'Search layers' })
        ).toHaveValue('points')
    })

    test('search is case-insensitive and safe for regex metacharacters', async ({
        page,
    }) => {
        await openLayers2(page)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill('[')
        await page.waitForTimeout(200)
        await expect(page.getByText(/No layers match/)).toBeVisible()
        await search.fill('(')
        await page.waitForTimeout(200)
        await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
        await search.fill('POINTS')
        await page.waitForTimeout(200)
        await expect(
            page.getByRole('treeitem').filter({ hasText: /Points Basic/i })
        ).toBeVisible()
    })

    test('toggles visible and filtered layer views', async ({ page }) => {
        await openLayers2(page)
        const visible = page.getByRole('button', {
            name: 'Show only visible layers',
        })
        const filtered = page.getByRole('button', {
            name: 'Show only filtered layers',
        })
        await visible.click()
        await expect(visible).toHaveAttribute('aria-pressed', 'true')
        await filtered.click()
        await expect(filtered).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByText('Clear filters')).toBeVisible()
    })

    test('keyboard navigation opens settings and Escape returns to the tree', async ({
        page,
    }) => {
        await openLayers2(page)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill('Points Basic')
        await page.waitForTimeout(180)
        const tree = page.getByRole('tree', { name: 'Layers' })
        await tree.focus()
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const isLayerRow = await page.evaluate(() => {
                const treeElement = document.querySelector('[role="tree"]')
                const activeId = treeElement?.getAttribute(
                    'aria-activedescendant'
                )
                return !!document
                    .getElementById(activeId)
                    ?.querySelector('.lt2-layerRow')
            })
            if (isLayerRow) break
            await page.keyboard.press('ArrowDown')
        }
        await page.keyboard.press('Enter')
        await expect(page.locator('.lt2-settings')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(tree).toBeVisible()
    })

    test('keyboard reorder round-trips its URL history', async ({ page }) => {
        await openLayers2(page)
        const tree = page.getByRole('tree', { name: 'Layers' })
        await tree.focus()
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Alt+ArrowDown')
        await expect(page.getByText(/Moved .* below/)).toBeVisible()

        const result = await page.evaluate(() => {
            const tool = window.ToolController_.getTool('LayersTool2')
            const originalHistory = tool.orderingHistory
            const originalTools = window.L_.FUTURES?.tools
            const expected = originalHistory.map((entry) => [...entry])
            try {
                const encoded = tool.getUrlString()
                const otherTools = (originalTools || []).filter(
                    (entry) => !String(entry).startsWith('LayersTool2$')
                )
                window.L_.FUTURES.tools = [
                    ...otherTools,
                    `LayersTool2$${encoded}`,
                ]
                tool.orderingHistory = []
                tool.finalize()
                return {
                    encoded,
                    expected,
                    actual: tool.orderingHistory,
                }
            } finally {
                tool.orderingHistory = originalHistory
                window.L_.FUTURES.tools = originalTools
            }
        })
        expect(result.encoded).toMatch(/^\d+-\d+-\d+(?:\.\d+-\d+-\d+)*$/)
        expect(result.actual).toEqual(result.expected)
    })

    test('header checkbox mutes on descendants and restores those layers', async ({
        page,
    }) => {
        await openLayers2(page)
        const { groupName, visibleBefore } = await page.evaluate(() => {
            const childrenOf = (header) => {
                const leaves = []
                const visit = (nodes) =>
                    (nodes || []).forEach((node) =>
                        node.type === 'header'
                            ? visit(node.sublayers)
                            : leaves.push(node)
                    )
                visit(header?.sublayers)
                return leaves
            }
            const header = (window.L_.configData.layers || []).find(
                (node) =>
                    node.type === 'header' &&
                    childrenOf(node).some(
                        (layer) => window.L_.layers.on[layer.name]
                    )
            )
            return {
                groupName: header?.display_name || header?.name,
                visibleBefore: childrenOf(header).filter(
                    (layer) => window.L_.layers.on[layer.name]
                ).map((layer) => layer.name),
            }
        })
        test.skip(!groupName, 'No header with visible descendants in mission')
        const header = page
            .locator('.lt2-headerRow')
            .filter({ hasText: groupName })
            .first()
        await header.getByRole('checkbox').first().click()
        await expect(header.getByText(/muted/i)).toBeVisible()
        await header.getByRole('checkbox').first().click()
        const visibleAfter = await page.evaluate((names) => {
            const on = window.L_.layers.on
            return names.filter((name) => on[name])
        }, visibleBefore)
        expect(visibleAfter.sort()).toEqual(visibleBefore.sort())
    })

    test('opens settings for each configured layer type', async ({ page }) => {
        await openLayers2(page)
        const types = await page.evaluate(() => {
            const found = {}
            const visit = (nodes) =>
                (nodes || []).forEach((node) => {
                    if (node.type === 'header') visit(node.sublayers)
                    else if (
                        ['vector', 'vectortile', 'tile', 'data', 'video', 'image', 'velocity', 'model', 'query'].includes(node.type) &&
                        !found[node.type]
                    )
                        found[node.type] = node.display_name || node.name
                })
            visit(window.L_.configData.layers)
            return found
        })
        const search = page.getByRole('textbox', { name: 'Search layers' })
        for (const name of Object.values(types)) {
            await search.fill(name)
            await page.waitForTimeout(180)
            const row = page.locator('.lt2-layerRow').filter({ hasText: name }).first()
            await expect(row).toBeVisible()
            await row.locator('.lt2-title').click()
            await expect(page.locator('.lt2-settings')).toBeVisible()
            await expect(page.locator('.lt2-settings')).toContainText('Display')
            await page.keyboard.press('Escape')
            await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
        }
    })

    test('keeps COG rescale values scoped to each layer', async ({ page }) => {
        await openLayers2(page)
        const cogLayers = await page.evaluate(() => {
            const names = []
            const visit = (nodes) =>
                (nodes || []).forEach((node) => {
                    if (node.type === 'header') visit(node.sublayers)
                    else if (
                        node.type === 'tile' &&
                        (node.cogTransform === true ||
                            node.url?.startsWith('COG:') ||
                            node.url?.startsWith('stac-collection:'))
                    )
                        names.push(node.display_name || node.name)
                })
            visit(window.L_.configData.layers)
            return names.slice(0, 2)
        })
        test.skip(cogLayers.length < 2, 'Reference Mission has fewer than two COG layers')

        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill(cogLayers[0])
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: cogLayers[0] })
            .first()
            .locator('.lt2-title')
            .click()
        const firstMinimum = page.getByRole('spinbutton', {
            name: /Rescale minimum/,
        })
        await firstMinimum.fill('123.5')
        await page.keyboard.press('Escape')

        await search.fill(cogLayers[1])
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: cogLayers[1] })
            .first()
            .locator('.lt2-title')
            .click()
        await expect(
            page.getByRole('spinbutton', { name: /Rescale minimum/ })
        ).not.toHaveValue('123.5')
    })

    test('shows failed-layer status and an inline export error', async ({
        page,
    }) => {
        await openLayers2(page)
        const layerName = await page.evaluate(() => {
            const layer = Object.values(window.L_.layers.data).find(
                (candidate) => candidate.type === 'tile'
            )
            if (!layer) return null
            layer.error = 'LayersTool2 test failure'
            document.dispatchEvent(new Event('layerRefreshStatusChanged'))
            return layer.display_name || layer.name
        })
        test.skip(!layerName, 'Reference Mission has no tile layer')
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill(layerName)
        await page.waitForTimeout(180)
        const row = page.locator('.lt2-layerRow').filter({ hasText: layerName })
        await expect(row.locator('.lt2-statusError')).toBeVisible()
        await row.locator('.lt2-title').click()
        await expect(page.locator('.layerSettingsStatusBanner')).toBeVisible()
        await page.getByRole('button', { name: /Download data/ }).click()
        await expect(page.locator('.lt2-inlineError')).toContainText(
            'does not expose exportable'
        )
    })

    test('uses 44 pixel rows at mobile viewport widths', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await openLayers2(page)
        const row = page.locator('.lt2-virtualRow').first()
        await expect(row).toBeVisible()
        expect(await row.evaluate((element) => element.getBoundingClientRect().height)).toBe(44)
    })

    test('virtualizes a 600 layer tree', async ({ page }) => {
        await page.goto('/?mission=Reference-Mission')
        await page.waitForLoadState('networkidle', { timeout: 60000 })
        await page.waitForFunction(
            () => !!(window.mmgisAPI && window.mmgisAPI.map),
            { timeout: 30000 }
        )
        await page.evaluate(() => {
            const original = window.L_.configData.layers
            const layers = Array.from({ length: 600 }, (_, index) => ({
                name: `Layers2 virtual ${index}`,
                display_name: `Layers2 virtual ${index}`,
                type: 'vector',
                tags: [],
                description: '',
            }))
            window.L_.configData.layers = [
                ...original,
                {
                    name: 'Layers2 virtualization test',
                    type: 'header',
                    expanded: true,
                    sublayers: layers,
                },
            ]
        })
        const openDuration = await page.evaluate(
            () =>
                new Promise((resolve) => {
                    const started = performance.now()
                    const check = () => {
                        if (document.querySelector('[role="tree"]')) {
                            resolve(performance.now() - started)
                            return
                        }
                        requestAnimationFrame(check)
                    }
                    document.getElementById('toolButtonLayers2').click()
                    check()
                })
        )
        expect(openDuration).toBeLessThan(500)
        await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
        expect(await page.locator('.lt2-virtualRow').count()).toBeLessThan(80)
    })
})
