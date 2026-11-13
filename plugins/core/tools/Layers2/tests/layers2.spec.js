import { test, expect, devices } from '@playwright/test'
const fs = require('fs')
const axeSource = require.resolve('axe-core')
const LIGHT_DEFAULT_THEME = {
    '--color-a-5': '#f8fafc',
    '--color-a': '#ffffff',
    '--color-accent-active': '#dbeafe',
    '--color-a1': '#e2e8f0',
    '--color-a1-5': '#edf2f7',
    '--color-a2': '#94a3b8',
    '--color-a3': '#64748b',
    '--color-a4': '#475569',
    '--color-a5': '#334155',
    '--color-a6': '#1e293b',
    '--color-a7': '#0f172a',
    '--color-b': '#94a3b8',
    '--color-c': '#0284c7',
    '--color-c2': '#0369a1',
    '--color-d': '#f1f5f9',
    '--color-e': '#e2e8f0',
    '--color-f': '#0f172a',
    '--color-h': '#b45309',
    '--color-g': '#f8fafc',
    '--color-i': '#e2e8f0',
    '--color-j': '#e2e8f0',
    '--color-k': '#ffffff',
    '--color-l': '#0f172a',
    '--color-m': '#475569',
    '--color-n': '#f1f5f9',
    '--color-o': '#0369a1',
    '--color-p': '#64748b',
    '--color-m1': '#edf2f7',
    '--color-m2': '#f1f5f9',
    '--color-m3': '#f8fafc',
    '--color-mh': '#b45309',
    '--color-mw': '#1e293b',
    '--color-mw2': '#334155',
    '--color-shadow': 'rgba(0, 0, 0, 0.08)',
}

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

async function getLayer(page, label, type) {
    const layer = await page.evaluate(
        ({ searchLabel, layerType }) => {
            const found = Object.values(window.L_.layers.data).find(
                (candidate) =>
                    (candidate.display_name === searchLabel ||
                        candidate.name === searchLabel) &&
                    (!layerType || candidate.type === layerType)
            )
            return found
                ? {
                      name: found.name,
                      label: found.display_name || found.name,
                  }
                : null
        },
        { searchLabel: label, layerType: type }
    )
    expect(layer, `Layer ${label} (${type || 'any type'}) is configured`).not.toBeNull()
    return layer
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

    test('LayerInfo closes locally and restores focus to either launcher', async ({
        page,
    }) => {
        await openLayers2(page)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill('Points Basic')
        await page.waitForTimeout(180)

        const rowInfo = page
            .locator('.lt2-headerRow')
            .filter({ hasText: 'Geometry Types' })
            .locator('button.lt2-status')
        await rowInfo.focus()
        await rowInfo.click()
        const dialog = page.getByRole('dialog', { name: 'Information' })
        await expect(dialog).toBeVisible()
        await expect(dialog).toHaveAttribute('aria-modal', 'true')
        await page.keyboard.press('Escape')
        await expect
            .poll(() =>
                page.evaluate(
                    () => !document.getElementById('LayerInfoModal')
                )
            )
            .toBe(true)
        await expect
            .poll(() =>
                rowInfo.evaluate(
                    (element) => element === document.activeElement
                )
            )
            .toBe(true)
        await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()

        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: 'Points Basic' })
            .first()
            .locator('.lt2-title')
            .click()
        const settingsInfo = page.getByRole('button', {
            name: 'Layer information',
        })
        await settingsInfo.focus()
        await settingsInfo.click()
        await expect(dialog).toBeVisible()
        await page.locator('#LayerInfoModalClose').click()
        await expect
            .poll(() =>
                page.evaluate(
                    () => !document.getElementById('LayerInfoModal')
                )
            )
            .toBe(true)
        await expect
            .poll(() =>
                settingsInfo.evaluate(
                    (element) => element === document.activeElement
                )
            )
            .toBe(true)
    })

    test('keyboard reorder round-trips its URL history', async ({ page }) => {
        await openLayers2(page)
        const tree = page.getByRole('tree', { name: 'Layers' })
        await page.getByRole('button', { name: 'Expand all' }).click()
        const movableLayer = await page.evaluate(() => {
            const flat = window.ToolController_
                .getTool('LayersTool2')
                ._debugFlat([])
            for (let index = 0; index < flat.length - 1; index += 1) {
                const current = flat[index]
                const next = flat[index + 1]
                if (
                    current.type !== 'header' &&
                    next.type !== 'header' &&
                    current.depth === next.depth
                )
                    return current.displayName
            }
            return null
        })
        expect(movableLayer, 'Reference Mission has movable sibling layers').not.toBeNull()
        await tree.focus()
        let activeName = ''
        for (let attempt = 0; attempt < 200; attempt += 1) {
            activeName = await page.evaluate(() => {
                const activeId = document
                    .querySelector('[role="tree"]')
                    ?.getAttribute('aria-activedescendant')
                return document
                    .getElementById(activeId)
                    ?.querySelector('.lt2-name')
                    ?.textContent?.trim()
            })
            if (activeName === movableLayer) break
            await page.keyboard.press('ArrowDown')
        }
        expect(activeName).toBe(movableLayer)
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
        const { groupName, headerName, visibleBefore } = await page.evaluate(() => {
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
                headerName: header?.name,
                visibleBefore: childrenOf(header).filter(
                    (layer) => window.L_.layers.on[layer.name]
                ).map((layer) => layer.name),
            }
        })
        test.skip(!groupName, 'No header with visible descendants in mission')
        await page.evaluate(() => {
            window.__layers2HeaderEvents = []
            window.__layers2HeaderListener = (event) =>
                window.__layers2HeaderEvents.push(event.detail)
            window.mmgisAPI.addEventListener(
                'layersToolHeaderStateChange',
                window.__layers2HeaderListener
            )
        })
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
        const headerEvents = await page.evaluate(
            () => window.__layers2HeaderEvents
        )
        const legacyHeaderId = `header_${headerName}`.split('_')[1]
        expect(headerEvents).toEqual([
            { header_id: legacyHeaderId, onState: false },
            { header_id: legacyHeaderId, onState: true },
        ])
    })

    test('bulk header expansion emits state events only for changed headers', async ({
        page,
    }) => {
        await openLayers2(page)
        const expected = await page.evaluate(() => {
            const headers = []
            const defaultExpanded =
                window.L_.getToolVars('layers2')?.expanded === true
            const visit = (nodes) =>
                (nodes || []).forEach((node) => {
                    if (node.type === 'header') {
                        headers.push({
                            name: node.name,
                            expanded:
                                node.expanded ?? defaultExpanded,
                        })
                        visit(node.sublayers)
                    }
                })
            visit(window.L_.configData.layers)
            window.__layers2HeaderEvents = []
            document.addEventListener('layersToolHeaderStateChange', (event) =>
                window.__layers2HeaderEvents.push(event.detail)
            )
            return headers
        })
        await page.getByRole('button', { name: 'Expand all' }).click()
        await page.evaluate(() => {
            window.__layers2HeaderEvents = []
        })
        await page.getByRole('button', { name: 'Collapse all' }).click()
        const collapseEvents = await page.evaluate(
            () => window.__layers2HeaderEvents
        )
        expect(collapseEvents).toEqual(
            expected.map((header) => ({
                header_id: `header_${header.name}`.split('_')[1],
                onState: false,
            }))
        )

        await page.evaluate(() => {
            window.__layers2HeaderEvents = []
        })
        await page.getByRole('button', { name: 'Restore default expansion' }).click()
        const restoreEvents = await page.evaluate(
            () => window.__layers2HeaderEvents
        )
        expect(restoreEvents).toEqual(
            expected
                .filter((header) => header.expanded)
                .map((header) => ({
                    header_id: `header_${header.name}`.split('_')[1],
                    onState: true,
                }))
        )
    })

    test('preserves the legacy setHeader and toggleHeader API', async ({
        page,
    }) => {
        await openLayers2(page)
        const headerInfo = await page.evaluate(() => {
            const header = (window.L_.configData.layers || []).find(
                (node) => node.type === 'header'
            )
            return header && {
                name: header.name,
                displayName: header.display_name || header.name,
            }
        })
        test.skip(!headerInfo, 'Reference Mission has no header')
        const header = page
            .getByRole('treeitem')
            .filter({ hasText: headerInfo.displayName })
            .first()
        const initialExpanded = (await header.getAttribute('aria-expanded')) === 'true'
        await page.evaluate((name) => {
            const tool = window.ToolController_.getTool('LayersTool2')
            window.__layers2HeaderEvents = []
            window.__layers2HeaderListener = (event) =>
                window.__layers2HeaderEvents.push(event.detail)
            window.mmgisAPI.addEventListener(
                'layersToolHeaderStateChange',
                window.__layers2HeaderListener
            )
            tool.setHeader(`header_${name}`)
            tool.toggleHeader(`header_${name}`)
        }, headerInfo.name)
        await expect(header).toHaveAttribute(
            'aria-expanded',
            String(!initialExpanded)
        )
        const headerEvents = await page.evaluate(
            () => window.__layers2HeaderEvents
        )
        expect(headerEvents).toEqual([
            {
                header_id: `header_${headerInfo.name}`.split('_')[1],
                onState: !initialExpanded,
            },
        ])
    })

    test('settings visibility follows layer toggles and opening an off layer turns it on', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await getLayer(page, 'Points Basic', 'vector')
        await page.evaluate(async (name) => {
            const item = window.L_.layers.data[name]
            if (!window.L_.layers.on[name]) await window.L_.toggleLayer(item)
        }, layer.name)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill(layer.label)
        await page.waitForTimeout(180)
        let row = page.locator('.lt2-layerRow').filter({ hasText: layer.label }).first()
        await row.locator('.lt2-title').click()
        const visible = page.getByRole('checkbox', { name: 'Visible' })
        await expect(visible).toBeChecked()
        await page.evaluate(async (name) => {
            await window.L_.toggleLayer(window.L_.layers.data[name])
        }, layer.name)
        await expect(visible).not.toBeChecked()
        await page.getByRole('button', { name: 'Back to layers' }).click()
        row = page.locator('.lt2-layerRow').filter({ hasText: layer.label }).first()
        await row.locator('.lt2-title').click()
        await expect(visible).toBeChecked()
        expect(
            await page.evaluate((name) => window.L_.layers.on[name], layer.name)
        ).toBe(true)
    })

    test('mmgisAPI.toggleLayer updates the visible checkbox while Layers2 is open', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await getLayer(page, 'Points Basic', 'vector')
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layer.label)
        await page.waitForTimeout(180)
        const row = page.locator('.lt2-layerRow').filter({ hasText: layer.label }).first()
        const visible = row.getByRole('checkbox')
        const target = !(await visible.isChecked())
        await page.evaluate(
            async ({ name, on }) => window.mmgisAPI.toggleLayer(name, on),
            { name: layer.name, on: target }
        )
        if (target) await expect(visible).toBeChecked()
        else await expect(visible).not.toBeChecked()
    })

    test('vector-like rows use one geometry glyph and no type icon', async ({
        page,
    }) => {
        await openLayers2(page)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill('Points Basic')
        await page.waitForTimeout(180)
        const row = page.locator('.lt2-layerRow').filter({ hasText: 'Points Basic' }).first()
        await expect(row.locator('.lt2-glyph')).toHaveCount(1)
        await expect(row.locator('.lt2-typeIcon')).toHaveCount(0)
        await expect(row.locator('.lt2-glyph')).toHaveClass(
            /lt2-glyph-(point|line|polygon)/
        )
    })

    test('Vector Filter mounts the legacy controls and filters Points Basic', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await getLayer(page, 'Points Basic', 'vector')
        const layerName = layer.name
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layer.label)
        await page.waitForTimeout(180)
        await page.locator('.lt2-layerRow').filter({ hasText: layer.label }).first().locator('.lt2-title').click()
        const filter = page.locator('#layersTool_filtering')
        await expect(filter).toBeVisible()
        await expect(filter.locator('.layersTool_filtering_value_key_input')).toBeVisible()
        await expect(filter.locator('.layersTool_filtering_value_operator_select')).toBeVisible()
        await expect(filter.locator('.layersTool_filtering_value_value_input')).toBeVisible()
        await expect(filter.locator('#layersTool_filtering_add_value')).toBeVisible()
        await expect(filter.locator('#layersTool_filtering_add_group')).toBeVisible()
        await expect(filter.locator('#layersTool_filtering_submit')).toBeVisible()
        await expect(filter.locator('#layersTool_filtering_count')).toBeVisible()
        await expect(filter.locator('#helpModal_LayersTool-Filtering')).toBeVisible()

        const condition = await page.evaluate((name) => {
            const geojson = window.L_.layers.layer[name].toGeoJSON()
            const features = geojson.features || []
            for (const key of Object.keys(features[0]?.properties || {})) {
                const values = new Map()
                for (const feature of features) {
                    const value = feature.properties?.[key]
                    if (value != null) values.set(value, (values.get(value) || 0) + 1)
                }
                const match = [...values].find(([, count]) => count < features.length)
                if (match) return { key, value: match[0], total: features.length }
            }
            return null
        }, layerName)
        expect(condition).not.toBeNull()
        const before = await page.evaluate(
            (name) => window.L_.layers.layer[name].toGeoJSON().features.length,
            layerName
        )
        const keyInput = filter.locator('.layersTool_filtering_value_key_input').first()
        await keyInput.fill(condition.key)
        await keyInput.press('Tab')
        const valueInput = filter.locator('.layersTool_filtering_value_value_input').first()
        await valueInput.fill(String(condition.value))
        await valueInput.press('Tab')
        await filter.locator('#layersTool_filtering_submit').click()
        await expect
            .poll(() =>
                page.evaluate(
                    (name) => window.L_.layers.layer[name].toGeoJSON().features.length,
                    layerName
                )
            )
            .toBeLessThan(before)
        const after = await page.evaluate(
            (name) => window.L_.layers.layer[name].toGeoJSON().features.length,
            layerName
        )
        await expect(filter.locator('#layersTool_filtering_count')).toHaveText(
            `(${after}/${before})`
        )
        await page.evaluate((name) => {
            document.dispatchEvent(
                new CustomEvent('layersTool2LayerDataLoaded', {
                    detail: { layerName: name },
                })
            )
        }, layerName)
        await expect(
            filter.locator('.layersTool_filtering_value_key_input').first()
        ).toHaveValue(condition.key)
        await expect(
            filter.locator('.layersTool_filtering_value_value_input').first()
        ).toHaveValue(String(condition.value))
        await filter.locator('#layersTool_filtering_add_group').click()
        await expect(
            filter.locator('.layersTool_filtering_group_operator_select')
        ).toBeVisible()
        await page.getByRole('button', { name: 'Back to layers' }).click()
        const row = page.locator('.lt2-layerRow').filter({ hasText: layer.label }).first()
        await expect(row.locator('.lt2-statusFiltered')).toBeVisible()
        const filtered = page.getByRole('button', {
            name: 'Show only filtered layers',
        })
        await filtered.click()
        await expect(row).toBeVisible()
        await filtered.click()

        await row.locator('.lt2-title').click()
        const reopenedFilter = page.locator('#layersTool_filtering')
        await reopenedFilter.locator('#layersTool_filtering_clear').click()
        await expect
            .poll(() =>
                page.evaluate(
                    (name) => window.L_.layers.layer[name].toGeoJSON().features.length,
                    layerName
                )
            )
            .toBe(before)
        await page.getByRole('button', { name: 'Back to layers' }).click()
        await expect(row.locator('.lt2-statusFiltered')).toHaveCount(0)
    })

    test('shared Filtering cleanup preserves the legacy Layers filter lifecycle', async ({
        page,
    }) => {
        const pageErrors = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/?mission=Reference-Mission')
        await page.waitForLoadState('networkidle', { timeout: 60000 })
        await page.waitForFunction(
            () => !!(window.mmgisAPI && window.mmgisAPI.map),
            { timeout: 30000 }
        )
        const layer = await getLayer(page, 'Points Basic', 'vector')
        await page.locator('#toolButtonLayers').click()
        const row = page
            .locator('#layersToolList > li')
            .filter({ hasText: layer.label })
            .first()
        await expect(row).toBeVisible()
        await row.locator('.gears').click()
        const filter = page.locator('#layersTool_filtering')
        await expect(filter).toBeVisible()
        const initialWidth = await filter.evaluate(
            (element) => element.getBoundingClientRect().width
        )

        await filter.locator('#layersTool_filtering_add_value').click()
        await expect(
            filter.locator('#layerTool_filtering_filters_list > li')
        ).toHaveCount(2)
        await filter.locator('#layersTool_filtering_submit').click()
        await expect(filter.locator('#layersTool_filtering_submit_text')).toContainText(
            'Submitted'
        )
        await filter.locator('#layerTool_filtering_filters_spatial_draw').click()
        await expect(
            filter.locator('#layerTool_filtering_filters_spatial')
        ).toHaveClass(/drawing/)
        await page.mouse.click(800, 400)
        await filter.locator('#layersTool_filtering_clear').click()
        await expect(
            filter.locator('#layerTool_filtering_filters_spatial')
        ).not.toHaveClass(/drawing|drawn/)

        await page.evaluate(() => window.ToolController_.closeActiveTool())
        await page.locator('#toolButtonLayers').click()
        const reopenedRow = page
            .locator('#layersToolList > li')
            .filter({ hasText: layer.label })
            .first()
        await reopenedRow.locator('.gears').click()
        const reopenedFilter = page.locator('#layersTool_filtering')
        await expect(reopenedFilter).toBeVisible()
        await expect(reopenedFilter).toHaveJSProperty(
            'offsetWidth',
            initialWidth
        )
        expect(pageErrors).toEqual([])
    })

    test('TouchSensor reorders a layer on iPhone 13 touch emulation', async ({
        browser,
    }) => {
        const context = await browser.newContext({ ...devices['iPhone 13'] })
        const page = await context.newPage()
        const pageErrors = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await openLayers2(page)
        await page.getByRole('button', { name: 'Expand all' }).click()
        const source = page
            .locator('.lt2-layerRow')
            .filter({ hasText: 'Points Basic' })
            .first()
        const target = page
            .locator('.lt2-layerRow')
            .filter({ hasText: 'Lines Basic' })
            .first()
        await source.scrollIntoViewIfNeeded()
        await target.scrollIntoViewIfNeeded()
        const before = await page.evaluate(() =>
            window.ToolController_.getTool('LayersTool2')
                ._debugFlat()
                .filter((row) => !row.type || row.type !== 'header')
                .map((row) => row.name)
        )
        const sourceBox = await source.locator('.lt2-drag').boundingBox()
        const targetBox = await target.boundingBox()
        expect(sourceBox).not.toBeNull()
        expect(targetBox).not.toBeNull()
        const cdp = await context.newCDPSession(page)
        const x = sourceBox.x + sourceBox.width / 2
        const y = sourceBox.y + sourceBox.height / 2
        const targetX = targetBox.x + targetBox.width / 2
        const targetY = targetBox.y + targetBox.height / 2
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ id: 1, x, y }],
        })
        await page.waitForTimeout(250)
        for (let step = 1; step <= 8; step += 1) {
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [
                    {
                        id: 1,
                        x: x + ((targetX - x) * step) / 8,
                        y: y + ((targetY - y) * step) / 8,
                    },
                ],
            })
            await page.waitForTimeout(40)
        }
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
        })
        await expect
            .poll(() =>
                page.evaluate(() =>
                    window.ToolController_.getTool('LayersTool2')
                        ._debugFlat()
                        .filter((row) => !row.type || row.type !== 'header')
                        .map((row) => row.name)
                )
            )
            .not.toEqual(before)
        expect(pageErrors).toEqual([])
        await context.close()
    })

    test('isolates throwing plugin sections and reports rejected actions', async ({
        page,
    }) => {
        await openLayers2(page)
        await page.evaluate(() => {
            window.__layersTool2TestPluginRegistry = {
                vector: {
                    sections: [
                        {
                            id: 'injected-throw',
                            label: 'Injected throwing section',
                            Component: () => {
                                throw new Error('Injected section failure')
                            },
                        },
                    ],
                    actions: [
                        {
                            id: 'injected-reject',
                            label: 'Reject test action',
                            onClick: () =>
                                Promise.reject(
                                    new Error('Injected action rejection')
                                ),
                        },
                    ],
                },
            }
        })
        await page
            .getByRole('textbox', { name: 'Search layers' })
            .fill('Points Basic')
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: 'Points Basic' })
            .first()
            .locator('.lt2-title')
            .click()
        const settings = page.locator('.lt2-settings')
        await expect(settings.locator('[data-section="display"]')).toBeVisible()
        await expect(
            settings.locator('[data-section="injected-throw"] [role="alert"]')
        ).toContainText('Injected section failure')
        await settings.getByRole('button', { name: 'Reject test action' }).click()
        await expect(
            settings
                .locator('.lt2-inlineError')
                .filter({ hasText: 'Injected action rejection' })
        ).toBeVisible()
        await expect(
            page.locator('.mmgisToastRoot').getByText(
                'Injected action rejection'
            )
        ).toBeVisible()
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
        for (const [type, name] of Object.entries(types)) {
            await search.fill(name)
            await page.waitForTimeout(180)
            const row = page.locator('.lt2-layerRow').filter({ hasText: name }).first()
            await expect(row).toBeVisible()
            await row.locator('.lt2-title').click()
            await expect(page.locator('.lt2-settings')).toBeVisible()
            await expect(page.locator('.lt2-settings')).toContainText('Display')
            if (type === 'tile' || type === 'data')
                await expect(page.locator('.lt2-settings')).toContainText('Opacity')
            await page.keyboard.press('Escape')
            await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
        }
    })

    test('local image and velocity fixtures render on the map', async ({
        page,
    }) => {
        await openLayers2(page)
        const fixtures = await page.evaluate(() => {
            const layers = Object.values(window.L_.layers.data)
            return ['image', 'velocity'].map(
                (type) => {
                    const layer = layers.find((item) => item.type === type)
                    return layer
                        ? { name: layer.name, label: layer.display_name || layer.name }
                        : null
                }
            )
        })
        expect(fixtures.every(Boolean), 'Image and velocity fixtures exist').toBe(true)
        for (const fixture of fixtures) {
            await page.evaluate(
                async (layerName) => window.mmgisAPI.toggleLayer(layerName, true),
                fixture.name
            )
            await expect
                .poll(() =>
                    page.evaluate(
                        (name) =>
                            Boolean(
                                window.L_.Map_.map.hasLayer(
                                    window.L_.layers.layer[name]
                                )
                            ),
                        fixture.name
                    )
                )
                .toBe(true)
        }
    })

    test('video playback controls play, pause, mute, and scrub the fixture', async ({
        page,
    }) => {
        await openLayers2(page)
        const video = await page.evaluate(() => {
            const layer = Object.values(window.L_.layers.data).find(
                (candidate) => candidate.type === 'video'
            )
            return layer
                ? { name: layer.name, label: layer.display_name || layer.name }
                : null
        })
        expect(video, 'Reference Mission has a video fixture').not.toBeNull()
        await page.evaluate((name) => {
            window.L_.layers.filters[name] = {
                ...(window.L_.layers.filters[name] || {}),
                brightness: 0,
                contrast: 0,
                saturate: 0,
            }
        }, video.name)
        await page.getByRole('textbox', { name: 'Search layers' }).fill(video.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: video.label })
            .first()
            .locator('.lt2-title')
            .click()
        const play = page.getByRole('button', { name: 'Play video' })
        await expect(play).toBeVisible()
        await play.click()
        await expect(
            page.getByRole('button', { name: 'Pause video' })
        ).toBeVisible()
        await page.getByRole('button', { name: 'Pause video' }).click()
        await expect(play).toBeVisible()
        const mediaState = await page.evaluate((name) => {
            const videoElement = window.L_.layers.layer[name].getElement()
            return {
                paused: videoElement.paused,
                time: videoElement.currentTime,
            }
        }, video.name)
        await page.getByRole('button', { name: 'Restart video' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    (name) =>
                        window.L_.layers.layer[name].getElement().currentTime,
                    video.name
                )
            )
            .toBe(0)
        expect(mediaState).toMatchObject({ paused: true })
        await expect
            .poll(() =>
                page.evaluate(
                    (name) =>
                        window.L_.layers.layer[name].getElement().paused,
                    video.name
                )
            )
            .toBe(true)
        await page.getByRole('button', { name: 'Play video' }).click()
        await expect(
            page.getByRole('button', { name: 'Pause video' })
        ).toBeVisible()
        await page.getByRole('button', { name: 'Restart video' }).click()
        await expect
            .poll(() =>
                page.evaluate(
                    (name) =>
                        window.L_.layers.layer[name].getElement().paused,
                    video.name
                )
            )
            .toBe(false)
        await page.getByRole('button', { name: 'Pause video' }).click()
        await expect(play).toBeVisible()
        const mute = page.locator('.lt2-videoControls button').nth(2)
        const previousMuteLabel = await mute.getAttribute('aria-label')
        expect(['Mute video', 'Unmute video']).toContain(previousMuteLabel)
        await mute.click()
        await expect(mute).toHaveAttribute(
            'aria-label',
            previousMuteLabel === 'Mute video' ? 'Unmute video' : 'Mute video'
        )
        const scrub = page.locator('.lt2-videoScrub input[type="range"]').first()
        await expect(
            page.getByRole('slider', { name: 'Brightness' })
        ).toHaveValue('0')
        await expect(
            page.getByRole('slider', { name: 'Contrast' })
        ).toHaveValue('0')
        await expect(
            page.getByRole('slider', { name: 'Saturation' })
        ).toHaveValue('0')
        await scrub.focus()
        await scrub.press('ArrowRight')
        await expect
            .poll(() =>
                page.evaluate(
                    (layerName) =>
                        window.L_.layers.layer[layerName]
                            .getElement()
                            .currentTime,
                    video.name
                )
            )
            .toBeGreaterThan(0)
    })

    test('dynamic style and statistics render for a configured vector layer', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await page.evaluate(() => {
            const visit = (nodes) => {
                for (const node of nodes || []) {
                    if (node.type === 'header') {
                        const nested = visit(node.sublayers)
                        if (nested) return nested
                    } else if (
                        node.type === 'vector' &&
                        node.variables?.dynamicStyle?.enabled === true
                    )
                        return { name: node.name, label: node.display_name || node.name }
                }
                return null
            }
            return visit(window.L_.configData.layers)
        })
        expect(layer, 'Reference Mission has a dynamic-style vector layer').not.toBeNull()
        await page.evaluate((name) => {
            const rule =
                window.L_.layers.data[name].variables.dynamicStyle.rules[0]
            rule.attribute = 'radius'
            delete rule.range
        }, layer.name)
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layer.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: layer.label })
            .first()
            .locator('.lt2-title')
            .click()
        const settings = page.locator('.lt2-settings')
        const dynamicStyle = settings.locator('[data-section="dynamic-style"]')
        await expect(dynamicStyle).toBeVisible()
        await expect(dynamicStyle.locator('.lt2-typeSettingsRule')).toHaveCount(3)
        const radiusRange = dynamicStyle.locator(
            '.lt2-typeSettingsRange input'
        )
        await expect(radiusRange.nth(0)).toHaveValue('3')
        await expect(radiusRange.nth(1)).toHaveValue('12')
        const statistics = settings.locator('[data-section="statistics"]')
        await expect(statistics).toBeVisible()
        const statsRow = statistics.locator('.lt2-typeSettingsStats').first()
        await expect(statsRow).toBeVisible()
        const previousStats = await statsRow.textContent()
        await page.evaluate((name) => {
            const layer = window.L_.layers.data[name]
            const replacement = {
                min: 98765,
                max: 98766,
                avg: 98765.5,
                stddev: 0.5,
                count: 12,
                nullCount: 0,
            }
            layer._fieldStats = { ...(layer._fieldStats || {}) }
            for (const rule of layer.variables.dynamicStyle.rules || []) {
                const property =
                    rule.propertyPath || rule.property || rule.key || rule.field
                if (typeof property === 'string')
                    layer._fieldStats[property] = replacement
            }
            document.dispatchEvent(
                new CustomEvent('mmgis-dynamic-style-restyled', {
                    detail: { layer: name },
                })
            )
        }, layer.name)
        await expect
            .poll(() => statsRow.textContent())
            .not.toBe(previousStats)
    })

    test('Data blend supports the legacy None, Color, and Overlay values', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await page.evaluate(() => {
            const configured = Object.values(window.L_.layers.data).find(
                (candidate) => candidate.type === 'data'
            )
            return configured
                ? {
                      name: configured.name,
                      label: configured.display_name || configured.name,
                  }
                : null
        })
        expect(layer, 'Reference Mission has a data layer').not.toBeNull()
        await page
            .getByRole('textbox', { name: 'Search layers' })
            .fill(layer.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: layer.label })
            .first()
            .locator('.lt2-title')
            .click()
        const blend = page.getByRole('combobox', { name: 'Blend mode' })
        await expect(blend).toBeVisible()
        await expect(
            page.locator('.lt2-settings [data-section="display"]')
        ).toHaveCount(1)
        await expect(
            page.getByRole('heading', { name: 'Display' })
        ).toHaveCount(1)
        for (const [label, value] of [
            ['Color', 'color'],
            ['Overlay', 'overlay'],
            ['None', 'unset'],
        ]) {
            await blend.click()
            await page.getByRole('option', { name: label }).click()
            await expect
                .poll(() =>
                    page.evaluate(
                        (name) =>
                            window.L_.layers.filters[name]?.['mix-blend-mode'],
                        layer.name
                    )
                )
                .toBe(value)
            await expect(blend).toContainText(label)
        }
    })

    test('Data shader variants render and Reset restores the shader controls', async ({
        page,
    }) => {
        await openLayers2(page)
        const layers = await page.evaluate(() => {
            const found = []
            const visit = (nodes) =>
                (nodes || []).forEach((node) => {
                    if (node.type === 'header') visit(node.sublayers)
                    else if (
                        node.type === 'data' &&
                        node.variables?.shader?.type
                    )
                        found.push({
                            name: node.display_name || node.name,
                            layerName: node.name,
                            shader: node.variables.shader.type,
                            shaderConfig: JSON.parse(
                                JSON.stringify(node.variables.shader)
                            ),
                        })
                })
            visit(window.L_.configData.layers)
            return found
        })
        test.skip(!layers.length, 'Reference Mission has no data shader layers')
        const search = page.getByRole('textbox', { name: 'Search layers' })
        for (const layer of layers) {
            await search.fill(layer.name)
            await page.waitForTimeout(180)
            await page
                .locator('.lt2-layerRow')
                .filter({ hasText: layer.name })
                .first()
                .locator('.lt2-title')
                .click()
            const settings = page.locator('.lt2-settings')
            await expect(settings.locator('[data-section="data-shader"]')).toBeVisible()
            if (layer.shader === 'colorize') {
                const control = settings.locator('.lt2-dataShaderSettings select').first()
                const original = await control.inputValue()
                await control.selectOption(original === 'true' ? 'false' : 'true')
                await settings.getByRole('button', { name: 'Reset Data shader' }).click()
                await expect(control).toHaveValue(original)
            }
            await page.evaluate((name) => {
                window.L_.layers.data[name].variables.shader.__layers2Test = true
            }, layer.layerName)
            await settings.getByRole('button', { name: 'Reset Data shader' }).click()
            await expect
                .poll(() =>
                    page.evaluate(
                        (name) => window.L_.layers.data[name].variables.shader,
                        layer.layerName
                    )
                )
                .toEqual(layer.shaderConfig)
            await page.keyboard.press('Escape')
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
        await page.getByRole('button', { name: 'Back to layers' }).click()

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

    test('Escape closes an open COG ramp without closing its settings', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await page.evaluate(() => {
            const candidate = Object.values(window.L_.layers.data).find(
                (item) =>
                    item.type === 'tile' &&
                    item.cogTransform === true &&
                    /^(COG|stac-collection):/i.test(item.url || '')
            )
            return candidate
                ? {
                      name: candidate.name,
                      label: candidate.display_name || candidate.name,
                  }
                : null
        })
        expect(layer, 'Reference Mission has a COG layer').not.toBeNull()

        await page
            .getByRole('textbox', { name: 'Search layers' })
            .fill(layer.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: layer.label })
            .first()
            .locator('.lt2-title')
            .click()
        await expect(page.locator('.lt2-settings')).toBeVisible()

        const trigger = page.locator(
            '.lt2-settings [aria-label^="Color ramp:"]'
        )
        await expect(trigger).toBeVisible()
        await trigger.click()
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        const rampName = (await trigger.getAttribute('aria-label')).replace(
            /^Color ramp:\s*/,
            ''
        )
        const rampOption = page.getByRole('button', {
            name: rampName,
            exact: true,
        })
        await expect(rampOption).toBeVisible()

        await page.keyboard.press('Escape')
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('.lt2-settings')).toBeVisible()
        await expect(trigger).toBeFocused()
        await expect(rampOption).toHaveCount(0)

        await page.keyboard.press('Escape')
        await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible()
    })

    test('Reset all restores display, tile filter, and COG defaults', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await page.evaluate(() => {
            const layer = Object.values(window.L_.layers.data).find(
                (candidate) =>
                    candidate.type === 'tile' &&
                    (candidate.sourceType === 'COG' ||
                        candidate.cogTransform === true ||
                        candidate.url?.startsWith('COG:'))
            )
            return layer
                ? { name: layer.name, label: layer.display_name || layer.name }
                : null
        })
        expect(layer, 'Reference Mission has a configured COG tile').not.toBeNull()
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layer.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: layer.label })
            .first()
            .locator('.lt2-title')
            .click()
        await page.evaluate((layerName) => {
            window.L_.setLayerOpacity(layerName, 0.37)
            window.L_.layers.filters[layerName] = {
                ...(window.L_.layers.filters[layerName] || {}),
                brightness: 0.42,
            }
            const layer = window.L_.layers.data[layerName]
            layer.currentCogMin = Number(layer.cogMin || 0) + 5
        }, layer.name)
        await page.getByRole('button', { name: 'Reset all settings' }).click()
        await expect
            .poll(() =>
                page.evaluate((layerName) => {
                    const layer = window.L_.layers.data[layerName]
                    return [
                        window.L_.layers.opacity[layerName],
                        window.L_.layers.filters[layerName]?.brightness,
                        layer.currentCogMin,
                        layer.cogMin,
                    ]
                }, layer.name)
            )
            .toEqual([
                1,
                undefined,
                await page.evaluate(
                    (layerName) => window.L_.layers.data[layerName].cogMin,
                    layer.name
                ),
                await page.evaluate(
                    (layerName) => window.L_.layers.data[layerName].cogMin,
                    layer.name
                ),
            ])
    })

    test('shows failed-layer status and an inline error for a supported vector export', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await getLayer(page, 'Points Basic', 'vector')
        await page.evaluate((name) => {
            window.L_.layers.data[name].error = 'LayersTool2 test failure'
            document.dispatchEvent(new Event('layerRefreshStatusChanged'))
        }, layer.name)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill(layer.label)
        await page.waitForTimeout(180)
        const row = page.locator('.lt2-layerRow').filter({ hasText: layer.label })
        await expect(row.locator('.lt2-statusError')).toBeVisible()
        await row.locator('.lt2-title').click()
        await expect(page.locator('.layerSettingsStatusBanner')).toBeVisible()
        await page.evaluate((name) => {
            window.L_.layers.layer[name] = false
        }, layer.name)
        await page.getByRole('button', { name: /Download data/ }).click()
        await expect(page.locator('.lt2-inlineError')).toContainText(
            'does not expose exportable'
            )
    })

    test('composite attachment controls reflect their backing state', async ({
        page,
    }) => {
        await openLayers2(page)
        const composite = await getLayer(page, 'Points Basic', 'vector')
        await page.evaluate(
            async (layerName) =>
                window.mmgisAPI.toggleLayer(layerName, true),
            composite.name
        )
        await page.evaluate((layerName) => {
            const name = '__layers2TestComposite'
            const attachment = {
                title: 'Layers2 test attachment',
                on: false,
                opacity: 0.5,
                layer: {
                    dropdown: ['First field', 'Second field'],
                    dropdownValue: 'First field',
                    dropdownFunc: () => {},
                },
            }
            window.L_.layers.attachments =
                window.L_.layers.attachments || {}
            window.L_.layers.attachments[layerName] = {
                ...(window.L_.layers.attachments[layerName] || {}),
                [name]: attachment,
            }
            window.L_.toggleSublayer = async (hostName, attachmentName) => {
                const current =
                    window.L_.layers.attachments[hostName][attachmentName]
                current.on = !current.on
            }
            window.L_.setSublayerOpacity = (
                hostName,
                attachmentName,
                opacity
            ) => {
                window.L_.layers.attachments[hostName][attachmentName].opacity =
                    opacity
            }
        }, composite.name)
        await page
            .getByRole('textbox', { name: 'Search layers' })
            .fill(composite.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: composite.label })
            .first()
            .locator('.lt2-title')
            .click()
        const section = page.locator('[data-section="composite"]')
        await expect(section).toBeVisible()
        const card = section
            .locator('.lt2-typeSettingsComposite')
            .filter({ hasText: 'Layers2 test attachment' })
            .first()
        const toggle = card.getByRole('checkbox', {
            name: 'Toggle Layers2 test attachment',
        })
        await expect(toggle).toBeVisible()
        await toggle.click()
        const attachmentState = () =>
            page.evaluate((layerName) => {
                const attachment =
                    window.L_.layers.attachments[layerName][
                        '__layers2TestComposite'
                    ]
                return {
                    on: attachment.on,
                    opacity: attachment.opacity,
                    dropdownValue: attachment.layer.dropdownValue,
                }
            }, composite.name)
        await expect
            .poll(() => attachmentState())
            .toMatchObject({ on: true })
        await expect(toggle).toHaveAttribute('aria-checked', 'true')

        const dropdown = card.getByRole('combobox', {
            name: 'Layers2 test attachment field',
        })
        await dropdown.click()
        await page.getByRole('option', { name: 'Second field' }).click()
        await expect
            .poll(() => attachmentState())
            .toMatchObject({ dropdownValue: 'Second field' })
        await expect(dropdown).toContainText('Second field')

        const opacity = card.getByRole('slider', { name: 'Opacity' })
        await opacity.focus()
        await opacity.press('ArrowRight')
        const changedOpacity = await page
            .waitForFunction(
                (layerName) =>
                    window.L_.layers.attachments[layerName][
                        '__layers2TestComposite'
                    ].opacity !== 0.5,
                composite.name
            )
            .then(() => attachmentState())
        await expect(opacity).toHaveValue(String(changedOpacity.opacity))
    })

    test('does not show GeoJSON export on raster layer types', async ({
        page,
    }) => {
        await openLayers2(page)
        const layers = await page.evaluate(() =>
            ['tile', 'data', 'image']
                .map((type) => {
                    const layer = Object.values(window.L_.layers.data).find(
                        (candidate) => candidate.type === type
                    )
                    return layer
                        ? {
                              name: layer.name,
                              label: layer.display_name || layer.name,
                              type: layer.type,
                              hasDownloadURL: !!layer.variables?.downloadURL,
                          }
                        : null
                })
                .filter(Boolean)
        )
        const search = page.getByRole('textbox', { name: 'Search layers' })
        for (const layer of layers) {
            await search.fill(layer.label)
            await page.waitForTimeout(100)
            await page
                .locator('.lt2-layerRow')
                .filter({ hasText: layer.label })
                .first()
                .locator('.lt2-title')
                .click()
            await expect(
                page.getByRole('region', {
                    name: `${layer.label} settings`,
                })
            ).toBeVisible()
            const hasLegacySourceDownload =
                ['tile', 'data'].includes(layer.type) && layer.hasDownloadURL
            if (hasLegacySourceDownload) {
                await expect(page.locator('[data-section="export"]')).toBeVisible()
                await expect(page.getByText('Download Data')).toBeVisible()
                await expect(page.getByRole('combobox', { name: 'Export format' })).toHaveCount(0)
            } else {
                await expect(page.locator('[data-section="export"]')).toHaveCount(0)
            }
            await page.getByRole('button', { name: 'Back to layers' }).click()
        }
    })

    test('passes GEOJSON_PRECISION to local GeoJSON export', async ({
        page,
    }) => {
        await openLayers2(page)
        const layer = await getLayer(page, 'Points Basic', 'vector')
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layer.label)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: layer.label })
            .first()
            .locator('.lt2-title')
            .click()
        await page.evaluate((name) => {
            const mapLayer = window.L_.layers.layer[name]
            mapLayer.toGeoJSON = (precision) => {
                window.__layers2ExportPrecision = precision
                return {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [-122.123456789, 37.123456789],
                            },
                            properties: {},
                        },
                    ],
                }
            }
        }, layer.name)
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Download data' }).click()
        const download = await downloadPromise
        const exported = JSON.parse(
            await fs.promises.readFile(await download.path(), 'utf8')
        )
        expect(
            await page.evaluate(() => window.__layers2ExportPrecision)
        ).toBe(await page.evaluate(() => window.L_.GEOJSON_PRECISION))
        expect(exported.features[0].geometry.coordinates).toEqual([
            -122.123456789,
            37.123456789,
        ])
    })

    test('uses 44 pixel rows at mobile viewport widths', async ({ page }) => {
        await openLayers2(page)
        await page.setViewportSize({ width: 390, height: 844 })
        await page.evaluate(() => {
            window.L_.UserInterface_.isMobile = true
        })
        await page.getByRole('textbox', { name: 'Search layers' }).fill('points')
        const row = page.locator('.lt2-virtualRow').first()
        await expect(row).toBeVisible()
        await expect
            .poll(() => row.evaluate((element) => element.getBoundingClientRect().height))
            .toBe(44)
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

    test('keeps the large-list scroll position and focus across settings', async ({
        page,
    }) => {
        await page.goto('/?mission=Reference-Mission')
        await page.waitForLoadState('networkidle', { timeout: 60000 })
        await page.waitForFunction(
            () => !!(window.mmgisAPI && window.mmgisAPI.map),
            { timeout: 30000 }
        )
        await page.evaluate(() => {
            const original = window.L_.configData.layers
            const layers = Array.from({ length: 600 }, (_, index) => ({
                name: `Layers2 focus ${index}`,
                display_name: `Layers2 focus ${index}`,
                type: 'vector',
                tags: [],
            }))
            window.L_.configData.layers = [
                ...original,
                {
                    name: 'Layers2 focus test',
                    type: 'header',
                    expanded: true,
                    sublayers: layers,
                },
            ]
            document.getElementById('toolButtonLayers2').click()
        })
        const tree = page.getByRole('tree', { name: 'Layers' })
        await expect(tree).toBeVisible()
        const row = page.getByRole('treeitem').filter({
            hasText: 'Layers2 focus 500',
        })
        await tree.evaluate((element) => {
            element.scrollTop = 580 * 31
        })
        await expect(row).toBeVisible()
        await row.scrollIntoViewIfNeeded()
        const scrollTop = await tree.evaluate((element) => element.scrollTop)
        await row.locator('.lt2-title').click()
        await expect(page.locator('.lt2-settings')).toBeVisible()
        await page.getByRole('button', { name: 'Back to layers' }).click()
        await expect(tree).toBeVisible()
        await expect(row).toBeVisible()
        expect(await tree.evaluate((element) => element.scrollTop)).toBe(scrollTop)
        await expect(tree).toHaveAttribute(
            'aria-activedescendant',
            await row.getAttribute('id')
        )
        await row.locator('.lt2-title').click()
        await expect(page.locator('.lt2-settings')).toBeVisible()
    })

    test('has no serious or critical axe violations on list and settings pages in both themes', async ({
        page,
    }) => {
        await openLayers2(page)
        await page.addScriptTag({ path: axeSource })
        const themeVariables = Object.keys(LIGHT_DEFAULT_THEME)
        const originalTheme = await page.evaluate((names) => {
            const style = document.documentElement.style
            return Object.fromEntries(
                names.map((name) => [
                    name,
                    {
                        value: style.getPropertyValue(name),
                        priority: style.getPropertyPriority(name),
                    },
                ])
            )
        }, themeVariables)
        const darkBackground = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
                .getPropertyValue('--color-a')
                .trim()
        )
        const setTheme = async (themeName) =>
            page.evaluate(
                ({ name, lightTheme, variables, original }) => {
                    const style = document.documentElement.style
                    variables.forEach((variable) => {
                        if (name === 'Light Default') {
                            style.setProperty(variable, lightTheme[variable])
                            return
                        }
                        const previous = original[variable]
                        if (previous.value)
                            style.setProperty(
                                variable,
                                previous.value,
                                previous.priority
                            )
                        else style.removeProperty(variable)
                    })
                },
                {
                    name: themeName,
                    lightTheme: LIGHT_DEFAULT_THEME,
                    variables: themeVariables,
                    original: originalTheme,
                }
            )
        const audit = async (theme, surface) => {
            const workaround = await page.addStyleTag({
                content: '* { mix-blend-mode: normal !important; }',
            })
            let result
            try {
                result = await page.evaluate(async () => {
                    const root = document.querySelector('#layersTool2')
                    const results = await window.axe.run(root)
                    const violations = results.violations
                        .filter((violation) =>
                            ['serious', 'critical'].includes(violation.impact)
                        )
                        .map(({ id, impact, description, nodes }) => ({
                            id,
                            impact,
                            description,
                            targets: nodes.map((node) => node.target),
                        }))
                    return {
                        violations,
                        serious: violations
                            .filter((violation) => violation.impact === 'serious')
                            .reduce(
                                (count, violation) =>
                                    count + violation.targets.length,
                                0
                            ),
                        critical: violations
                            .filter((violation) => violation.impact === 'critical')
                            .reduce(
                                (count, violation) =>
                                    count + violation.targets.length,
                                0
                            ),
                    }
                })
            } finally {
                await workaround.evaluate((style) => style.remove())
            }
            console.log(
                `Axe ${theme} ${surface}: ${result.serious} serious, ${result.critical} critical`
            )
            expect(
                result.violations,
                `Axe violations on ${surface} in ${theme}`
            ).toEqual([])
        }

        const surfaces = await page.evaluate(() => {
            const layers = Object.values(window.L_.layers.data)
            const find = (predicate) => layers.find(predicate)
            const label = (layer) =>
                layer ? layer.display_name || layer.name : null
            const vector = find(
                (layer) =>
                    layer.type === 'vector' &&
                    /points basic/i.test(label(layer) || '')
            )
            const cog = find(
                (layer) =>
                    layer.type === 'tile' &&
                    layer.cogTransform === true &&
                    /^(COG|stac-collection):/i.test(layer.url || '')
            )
            const video = find((layer) => layer.type === 'video')
            const data =
                find(
                    (layer) =>
                        layer.type === 'data' &&
                        /elev/i.test(label(layer) || '')
                ) || find((layer) => layer.type === 'data')
            return [
                ['Vector', vector],
                ['COG', cog],
                ['Video', video],
                ['Data', data],
            ].map(([surface, layer]) => ({
                surface,
                label: label(layer),
            }))
        })
        expect(
            surfaces.map(({ label }) => Boolean(label)),
            'Reference Mission has Vector, COG, Video, and Data fixtures'
        ).toEqual([true, true, true, true])

        for (const theme of ['Dark Default', 'Light Default']) {
            await setTheme(theme)
            const search = page.getByRole('textbox', { name: 'Search layers' })
            await search.fill('')
            await page.waitForTimeout(180)
            await audit(theme, 'list')

            await search.fill('Points Basic')
            await page.waitForTimeout(180)
            await audit(theme, 'searched list')

            for (const surface of surfaces) {
                await search.fill(surface.label)
                await page.waitForTimeout(180)
                await page
                    .locator('.lt2-layerRow')
                    .filter({ hasText: surface.label })
                    .first()
                    .locator('.lt2-title')
                    .click()
                await expect(page.locator('.lt2-settings')).toBeVisible()
                await audit(theme, surface.surface)
                await page.getByRole('button', { name: 'Back to layers' }).click()
            }
        }
        console.log(`Dark Default root background: ${darkBackground}`)
    })
})
