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
            .locator('.lt2-headerRow')
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
        const layerName = 'Points Basic'
        await page.evaluate(async (name) => {
            const layer = window.L_.layers.data[name]
            if (layer && !window.L_.layers.on[name])
                await window.L_.toggleLayer(layer)
        }, layerName)
        const search = page.getByRole('textbox', { name: 'Search layers' })
        await search.fill(layerName)
        await page.waitForTimeout(180)
        let row = page.locator('.lt2-layerRow').filter({ hasText: layerName }).first()
        await row.locator('.lt2-title').click()
        const visible = page.getByRole('checkbox', { name: 'Visible' })
        await expect(visible).toBeChecked()
        await page.evaluate(async (name) => {
            await window.L_.toggleLayer(window.L_.layers.data[name])
        }, layerName)
        await expect(visible).not.toBeChecked()
        await page.keyboard.press('Escape')
        row = page.locator('.lt2-layerRow').filter({ hasText: layerName }).first()
        await row.locator('.lt2-title').click()
        await expect(visible).toBeChecked()
        expect(
            await page.evaluate((name) => window.L_.layers.on[name], layerName)
        ).toBe(true)
    })

    test('mmgisAPI.toggleLayer updates the visible checkbox while Layers2 is open', async ({
        page,
    }) => {
        await openLayers2(page)
        const layerName = 'Points Basic'
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layerName)
        await page.waitForTimeout(180)
        const row = page.locator('.lt2-layerRow').filter({ hasText: layerName }).first()
        const visible = row.getByRole('checkbox')
        const target = !(await visible.isChecked())
        await page.evaluate(
            async ({ name, on }) => window.mmgisAPI.toggleLayer(name, on),
            { name: layerName, on: target }
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
        const layerName = 'Points Basic'
        await page.getByRole('textbox', { name: 'Search layers' }).fill(layerName)
        await page.waitForTimeout(180)
        await page.locator('.lt2-layerRow').filter({ hasText: layerName }).first().locator('.lt2-title').click()
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
        const row = page.locator('.lt2-layerRow').filter({ hasText: layerName }).first()
        await expect(row.locator('.lt2-statusFiltered')).toBeVisible()
        const filtered = page.getByRole('button', {
            name: 'Show only filtered layers',
        })
        await filtered.click()
        await expect(row).toBeVisible()
        await filtered.click()

        await filter.locator('#layersTool_filtering_add_group').click()
        await expect(
            filter.locator('.layersTool_filtering_group_operator_select')
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
                (type) => layers.find((layer) => layer.type === type)?.name
            )
        })
        test.skip(fixtures.some((name) => !name), 'Image or velocity fixture is missing')
        for (const name of fixtures) {
            await page.evaluate(async (layerName) => {
                const layer = window.L_.layers.data[layerName]
                if (!window.L_.layers.on[layerName])
                    await window.L_.toggleLayer(layer)
            }, name)
            await expect
                .poll(() =>
                    page.evaluate(
                        (layerName) =>
                            Boolean(window.L_.layers.layer[layerName]),
                        name
                    )
                )
                .toBe(true)
        }
    })

    test('video playback controls play, pause, mute, and scrub the fixture', async ({
        page,
    }) => {
        await openLayers2(page)
        const name = await page.evaluate(
            () =>
                Object.values(window.L_.layers.data).find(
                    (layer) => layer.type === 'video'
                )?.name
        )
        test.skip(!name, 'Reference Mission has no video fixture')
        await page.getByRole('textbox', { name: 'Search layers' }).fill(name)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: name })
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
        await page.getByRole('button', { name: 'Mute video' }).click()
        await expect(
            page.getByRole('button', { name: 'Unmute video' })
        ).toBeVisible()
        const scrub = page.locator('.lt2-videoScrub [role="slider"]').first()
        await scrub.focus()
        await scrub.press('ArrowRight')
        await expect
            .poll(() =>
                page.evaluate(
                    (layerName) =>
                        window.L_.layers.layer[layerName]
                            .getElement()
                            .currentTime,
                    name
                )
            )
            .toBeGreaterThan(0)
    })

    test('dynamic style and statistics render for a configured vector layer', async ({
        page,
    }) => {
        await openLayers2(page)
        const name = await page.evaluate(() => {
            const visit = (nodes) => {
                for (const node of nodes || []) {
                    if (node.type === 'header') {
                        const nested = visit(node.sublayers)
                        if (nested) return nested
                    } else if (
                        node.type === 'vector' &&
                        node.variables?.dynamicStyle?.enabled === true
                    )
                        return node.name
                }
                return null
            }
            return visit(window.L_.configData.layers)
        })
        test.skip(!name, 'Reference Mission has no dynamic-style vector layer')
        await page.getByRole('textbox', { name: 'Search layers' }).fill(name)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: name })
            .first()
            .locator('.lt2-title')
            .click()
        const settings = page.locator('.lt2-settings')
        const dynamicStyle = settings.locator('[data-section="dynamic-style"]')
        await expect(dynamicStyle).toBeVisible()
        await expect(dynamicStyle.locator('.lt2-typeSettingsRule')).toHaveCount(3)
        await expect(settings.locator('[data-section="statistics"]')).toBeVisible()
        await expect(settings.locator('.lt2-typeSettingsStats').first()).toBeVisible()
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

    test('Reset all restores display, tile filter, and COG defaults', async ({
        page,
    }) => {
        await openLayers2(page)
        const name = await page.evaluate(() => {
            const layer = Object.values(window.L_.layers.data).find(
                (candidate) =>
                    candidate.type === 'tile' &&
                    (candidate.sourceType === 'COG' ||
                        candidate.cogTransform === true ||
                        candidate.url?.startsWith('COG:'))
            )
            return layer?.name
        })
        test.skip(!name, 'Reference Mission has no configured COG tile')
        await page.getByRole('textbox', { name: 'Search layers' }).fill(name)
        await page.waitForTimeout(180)
        await page
            .locator('.lt2-layerRow')
            .filter({ hasText: name })
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
        }, name)
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
                }, name)
            )
            .toEqual([
                1,
                undefined,
                await page.evaluate(
                    (layerName) => window.L_.layers.data[layerName].cogMin,
                    name
                ),
                await page.evaluate(
                    (layerName) => window.L_.layers.data[layerName].cogMin,
                    name
                ),
            ])
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

    test('captures LayersTool2 comparison screenshots', async ({ page }) => {
        await openLayers2(page)
        const names = await page.evaluate(() => {
            const layers = []
            const visit = (nodes) =>
                (nodes || []).forEach((node) => {
                    if (node.type === 'header') visit(node.sublayers)
                    else layers.push(node)
                })
            visit(window.L_.configData.layers)
            return {
                vector: layers.find((layer) => layer.name === 'Points Basic')?.name,
                raster: layers.find(
                    (layer) =>
                        layer.type === 'tile' && layer.cogColormapJson != null
                )?.name,
                basemap: layers.find(
                    (layer) =>
                        layer.type === 'tile' &&
                        /arcgisonline|arcgis/i.test(layer.url || '')
                )?.name,
                data: layers.find((layer) => layer.type === 'data')?.name,
                cog: layers.find(
                    (layer) =>
                        layer.type === 'tile' &&
                        layer.cogColormapJson != null
                )?.name,
                rampCog: layers.find(
                    (layer) =>
                        layer.type === 'tile' &&
                        layer.cogTransform === true &&
                        layer.cogColormapJson == null
                )?.name,
                expressionCog: layers.find(
                    (layer) =>
                        layer.type === 'tile' &&
                        layer.cogExpressionEditable === true
                )?.name,
                video: layers.find((layer) => layer.type === 'video')?.name,
                image: layers.find((layer) => layer.type === 'image')?.name,
                velocity: layers.find((layer) => layer.type === 'velocity')?.name,
            }
        })
        const captureRow = async (name, file) => {
            test.skip(!name, `No layer configured for ${file}`)
            const search = page.getByRole('textbox', { name: 'Search layers' })
            await search.fill(name)
            await page.waitForTimeout(180)
            const row = page.locator('.lt2-layerRow').filter({ hasText: name }).first()
            await expect(row).toBeVisible()
            await page.screenshot({
                path: `/home/ubuntu/work/lt2-shots/${file}`,
                fullPage: true,
            })
        }
        await captureRow(names.vector, 'list.png')
        await captureRow(names.raster, 'raster-preview.png')

        await page.evaluate(async (name) => {
            const layer = window.L_.layers.data[name]
            if (layer && !window.L_.layers.on[name])
                await window.mmgisAPI.toggleLayer(name, true)
        }, names.basemap)
        await page.getByRole('button', { name: 'Expand all' }).click()
        await page.getByRole('textbox', { name: 'Search layers' }).fill('')
        await page.waitForTimeout(220)
        const captureGroup = async (groupName, file) => {
            test.skip(!groupName, `No layer group configured for ${file}`)
            const index = await page.evaluate((name) => {
                const rows = []
                const visit = (nodes) =>
                    (nodes || []).forEach((node) => {
                        rows.push(node)
                        if (node.type === 'header') visit(node.sublayers)
                    })
                visit(window.L_.configData.layers)
                return rows.findIndex(
                    (node) => node.type === 'header' && node.name === name
                )
            }, groupName)
            await page.locator('.lt2-scroll').evaluate((element, rowIndex) => {
                element.scrollTop = rowIndex * 31
            }, index)
            await page.waitForTimeout(1200)
            const header = page
                .locator('.lt2-headerRow')
                .filter({ hasText: groupName })
                .first()
            await expect(header).toBeVisible()
            await page.screenshot({
                path: `/home/ubuntu/work/lt2-shots/${file}`,
                fullPage: true,
            })
        }
        await captureGroup('Basemaps', 'basemap-peek.png')
        await captureGroup('Raster Layers', 'raster-group.png')

        const openSettings = async (name, file) => {
            test.skip(!name, `No layer configured for ${file}`)
            const search = page.getByRole('textbox', { name: 'Search layers' })
            await search.fill(name)
            await page.waitForTimeout(180)
            await page
                .locator('.lt2-layerRow')
                .filter({ hasText: name })
                .first()
                .locator('.lt2-title')
                .click()
            await expect(page.locator('.lt2-settings')).toBeVisible()
            if (file === 'vector-settings.png')
                await expect(page.locator('#layersTool_filtering')).toBeVisible()
            if (file === 'tile-cog-settings.png') {
                const settings = page.locator('.lt2-settings')
                await expect(
                    settings.locator('[data-section="display"]')
                ).toContainText('Opacity')
                await expect(
                    settings.locator('[data-section="cog"] .lt2-typeSettingsCogLegend')
                ).toContainText('Applied rescale')
                await expect(
                    settings.locator('.lt2-typeSettingsColorTable')
                ).toBeVisible()
            }
            if (file === 'tile-js-colormap-settings.png')
                await expect(
                    page.locator('.lt2-settings .lt2-typeSettingsLegendRamp')
                ).toBeVisible()
            await page.screenshot({
                path: `/home/ubuntu/work/lt2-shots/${file}`,
                fullPage: true,
            })
            await page.keyboard.press('Escape')
        }
        await openSettings(names.vector, 'vector-settings.png')
        await openSettings(names.cog, 'tile-cog-settings.png')
        if (names.rampCog)
            await openSettings(names.rampCog, 'tile-js-colormap-settings.png')
        if (names.expressionCog) {
            await page
                .getByRole('textbox', { name: 'Search layers' })
                .fill(names.expressionCog)
            await page.waitForTimeout(180)
            await page
                .locator('.lt2-layerRow')
                .filter({ hasText: names.expressionCog })
                .first()
                .locator('.lt2-title')
                .click()
            const expression = page.getByRole('textbox', {
                name: 'Band math expression',
            })
            await expect(expression).toBeVisible()
            const original = await page.evaluate(
                (name) =>
                    window.L_.layers.data[name].currentCogExpression ||
                    window.L_.layers.data[name].cogExpression ||
                    '',
                names.expressionCog
            )
            await expression.fill('b1*2')
            await page
                .getByRole('button', { name: 'Apply', exact: true })
                .click()
            await expect
                .poll(() =>
                    page.evaluate(
                        (name) =>
                            window.L_.layers.data[name].currentCogExpression,
                        names.expressionCog
                    )
                )
                .toBe('b1*2')
            await page
                .getByRole('button', { name: 'Reset expression' })
                .click()
            await expect(expression).toHaveValue(original)
            await page.keyboard.press('Escape')
        }
        await openSettings(names.data, 'data-settings.png')
        await openSettings(names.video, 'video-settings.png')

        const captureMapLayer = async (name, file) => {
            test.skip(!name, `No layer configured for ${file}`)
            const search = page.getByRole('textbox', { name: 'Search layers' })
            await search.fill(name)
            await page.waitForTimeout(180)
            await page.evaluate(async (layerName) => {
                const layer = window.L_.layers.data[layerName]
                if (layer && !window.L_.layers.on[layerName])
                    await window.L_.toggleLayer(layer)
            }, name)
            await page.waitForTimeout(600)
            await page.screenshot({
                path: `/home/ubuntu/work/lt2-shots/${file}`,
                fullPage: true,
            })
        }
        await captureMapLayer(names.image, 'image-map.png')
        await captureMapLayer(names.velocity, 'velocity-map.png')
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
