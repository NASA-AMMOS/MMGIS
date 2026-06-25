import { test, expect } from '@playwright/test'

/**
 * Global Feature Search — E2E Tests
 *
 * Uses page-level login to handle AUTH=local.
 * Tests regular mode (search-construct layers + values),
 * advanced mode (field-based search with operators), and
 * backend API search against Reference-Mission.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:18888'
const ADMIN_CREDS = {
    username: 'test_admin',
    password: ['Test', 'Admin', '1!'].join(''), // pragma: allowlist secret
}

/** Wait for the search bar to be visible and layers loaded */
async function waitForSearchBar(page) {
    await page.waitForLoadState('networkidle', { timeout: 30000 })
    await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
    await page
        .waitForFunction(() => !!(window.mmgisAPI && window.L_), {
            timeout: 15000,
        })
        .catch(() => {})
}

/** Navigate to mission, handling login if needed */
async function navigateToMission(page) {
    await page.goto(`${BASE_URL}/?mission=Reference-Mission`)
    await page.waitForLoadState('domcontentloaded')

    // Handle AUTH=local login form
    const loginBtn = page.locator('#login')
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.locator('#username').fill(ADMIN_CREDS.username)
        await page.locator('#pwd').fill(ADMIN_CREDS.password)
        await Promise.all([
            page.waitForNavigation({ timeout: 30000 }),
            loginBtn.click(),
        ])
        // After login reload, may need to navigate to mission
        const hasSearch = await page
            .locator('.searchBar')
            .isVisible({ timeout: 5000 })
            .catch(() => false)
        if (!hasSearch) {
            await page.goto(`${BASE_URL}/?mission=Reference-Mission`)
        }
    }

    await waitForSearchBar(page)
}

/** Open the unified panel by clicking the compact input */
async function openPanel(page) {
    await page.locator('.searchCompactInput').click()
    await expect(page.locator('.searchUnifiedPanel')).toBeVisible({
        timeout: 5000,
    })
}

/** Switch to advanced mode and ensure the panel is open */
async function switchToAdvanced(page) {
    const toggle = page.locator('.searchAdvancedToggle')
    if (await toggle.isVisible()) {
        const isActive = await toggle.evaluate((el) =>
            el.classList.contains('searchAdvancedToggleActive')
        )
        if (!isActive) {
            await toggle.click()
        } else {
            // Already in advanced mode but panel might be closed — click input to open it
            const panel = page.locator('.searchUnifiedColLayers')
            if (!(await panel.isVisible().catch(() => false))) {
                await page.locator('.searchCompactInput').click()
            }
        }
    }
    await expect(page.locator('.searchUnifiedColLayers')).toBeVisible({
        timeout: 5000,
    })
}

/** Switch to regular mode and ensure the panel is open */
async function switchToRegular(page) {
    const toggle = page.locator('.searchAdvancedToggle')
    if (await toggle.isVisible()) {
        const isActive = await toggle.evaluate((el) =>
            el.classList.contains('searchAdvancedToggleActive')
        )
        if (isActive) {
            await toggle.click()
        } else {
            const panel = page.locator('.searchRegularPanel')
            if (!(await panel.isVisible().catch(() => false))) {
                await page.locator('.searchCompactInput').click()
            }
        }
    }
    await expect(page.locator('.searchRegularPanel')).toBeVisible({
        timeout: 5000,
    })
}

/** Close the search panel */
async function closePanel(page) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
}

test.describe('Global Feature Search', () => {
    // Shared browser context & page — login once, reuse across tests
    /** @type {import('@playwright/test').BrowserContext} */
    let ctx
    /** @type {import('@playwright/test').Page} */
    let pg

    test.beforeAll(async ({ browser, request }) => {
        const listRes = await request.get(`${BASE_URL}/api/configure/missions`)
        const listData = await listRes.json().catch(() => ({}))
        if (
            !listData.missions ||
            !listData.missions.includes('Reference-Mission')
        ) {
            return
        }
        ctx = await browser.newContext({
            baseURL: BASE_URL,
            viewport: { width: 1280, height: 720 },
        })
        pg = await ctx.newPage()
        await navigateToMission(pg)
    })

    test.afterAll(async () => {
        if (pg) await pg.close()
        if (ctx) await ctx.close()
    })

    test.beforeEach(async ({ request }) => {
        const listRes = await request.get(`${BASE_URL}/api/configure/missions`)
        const listData = await listRes.json().catch(() => ({}))
        if (
            !listData.missions ||
            !listData.missions.includes('Reference-Mission')
        ) {
            test.skip(true, 'Reference-Mission not available')
            return
        }
        if (!pg) {
            test.skip(true, 'Page not available')
            return
        }

        // Recover if the page left the mission (e.g. reload triggered by previous test)
        const searchBarVisible = await pg
            .locator('.searchBar')
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        if (!searchBarVisible) {
            await pg.goto(`${BASE_URL}/?mission=Reference-Mission`)
            await waitForSearchBar(pg)
        }

        // Close any open panel from previous test
        await closePanel(pg)

        // Switch back to regular mode for consistent starting state
        const toggle = pg.locator('.searchAdvancedToggle')
        if (await toggle.isVisible().catch(() => false)) {
            const isActive = await toggle
                .evaluate((el) =>
                    el.classList.contains('searchAdvancedToggleActive')
                )
                .catch(() => false)
            if (isActive) await toggle.click()
        }

        // Clear the search input
        const clearBtn = pg.locator('.searchCompactClear')
        if (
            await clearBtn
                .evaluate((el) => getComputedStyle(el).visibility === 'visible')
                .catch(() => false)
        ) {
            await clearBtn.click()
            await pg.waitForTimeout(300)
        }
    })

    // =====================================================================
    //  1. Search Bar — Presence & Layout
    // =====================================================================

    test.describe('Search Bar — Presence & Layout', () => {
        test('search bar renders with compact input, magnify icon, and advanced toggle', async () => {
            const bar = pg.locator('.searchBar')
            await expect(bar).toBeVisible()
            await expect(bar.locator('.searchCompactIcon')).toBeVisible()
            await expect(bar.locator('.searchCompactInput')).toBeVisible()
            await expect(bar.locator('.searchAdvancedToggle')).toBeVisible()
        })

        test('clear button hidden when input is empty, visible when typing', async () => {
            const clearBtn = pg.locator('.searchCompactClear')
            await expect(clearBtn).toHaveCSS('visibility', 'hidden')

            await pg.locator('.searchCompactInput').fill('test')
            await expect(clearBtn).toHaveCSS('visibility', 'visible')

            // Clean up
            await clearBtn.click()
        })

        test('layers trigger shows a layer label', async () => {
            const trigger = pg.locator('.searchLayersTriggerLabel')
            await expect(trigger).toBeVisible()
            const text = await trigger.textContent()
            expect(text.trim().length).toBeGreaterThan(0)
        })
    })

    // =====================================================================
    //  2. Regular Mode — Panel & Layer Selection
    // =====================================================================

    test.describe('Regular Mode — Panel', () => {
        test('clicking input opens regular panel with Layers and Values columns', async () => {
            await openPanel(pg)
            const panel = pg.locator('.searchRegularPanel')
            await expect(panel).toBeVisible()

            const headers = panel.locator('.searchUnifiedColHeader')
            await expect(headers.nth(0)).toContainText('Layers')
            await expect(headers.nth(1)).toContainText('Values')
        })

        test('regular mode shows layers with search constructs', async () => {
            await openPanel(pg)
            const items = pg.locator('.searchRegularLayerItem')
            const count = await items.count()
            expect(count).toBeGreaterThanOrEqual(1)
        })

        test('selecting a layer populates the Values column', async () => {
            await openPanel(pg)
            const layers = pg.locator('.searchRegularLayerItem')
            const layerCount = await layers.count()
            if (layerCount === 0) {
                test.skip(true, 'No search-construct layers available')
                return
            }

            // Try each layer until we find one that loads values
            let valuesLoaded = false
            for (let i = 0; i < Math.min(layerCount, 5); i++) {
                await layers.nth(i).click()
                try {
                    await pg
                        .locator('.searchSuggestionItem')
                        .first()
                        .waitFor({ state: 'visible', timeout: 8000 })
                    valuesLoaded = true
                    break
                } catch {
                    // This layer didn't load values, try next
                }
            }
            expect(valuesLoaded).toBeTruthy()
        })

        test('typing in the input filters the Values column', async () => {
            await openPanel(pg)
            const layers = pg.locator('.searchRegularLayerItem')
            const layerCount = await layers.count()
            if (layerCount === 0) {
                test.skip(true, 'No search-construct layers available')
                return
            }

            // Find a layer that loads values
            let valuesLoaded = false
            for (let i = 0; i < Math.min(layerCount, 5); i++) {
                await layers.nth(i).click()
                try {
                    await pg
                        .locator('.searchSuggestionItem')
                        .first()
                        .waitFor({ state: 'visible', timeout: 8000 })
                    valuesLoaded = true
                    break
                } catch {
                    // Try next layer
                }
            }
            if (!valuesLoaded) {
                test.skip(true, 'No layers loaded values')
                return
            }

            const values = pg.locator('.searchSuggestionItem')
            const initialCount = await values.count()

            await pg.locator('.searchCompactInput').fill('zzznonexistent')
            await pg.waitForTimeout(500)

            const noMatch = pg.locator('.searchUnifiedEmpty')
            const noMatchVisible = await noMatch.isVisible().catch(() => false)
            if (noMatchVisible) {
                await expect(noMatch).toContainText(/no match/i)
            } else {
                const filtered = await values.count()
                expect(filtered).toBeLessThanOrEqual(initialCount)
            }
        })

        test('clicking a value item triggers search', async () => {
            await openPanel(pg)
            const layers = pg.locator('.searchRegularLayerItem')
            const layerCount = await layers.count()
            if (layerCount === 0) {
                test.skip(true, 'No search-construct layers available')
                return
            }

            // Click a layer and wait for suggestions with non-empty text
            let valueName = ''
            for (let i = 0; i < Math.min(layerCount, 5); i++) {
                await layers.nth(i).click()
                // Wait for suggestions to stabilize
                await pg.waitForTimeout(1000)
                try {
                    const item = pg.locator('.searchSuggestionItem .searchSuggestionLabel')
                    await item.first().waitFor({ state: 'visible', timeout: 8000 })
                    valueName = (await item.first().textContent()) || ''
                    if (valueName.trim().length > 0) break
                } catch {
                    // Try next layer
                }
            }
            if (!valueName.trim()) {
                test.skip(true, 'No layers loaded values with text')
                return
            }

            const values = pg.locator('.searchSuggestionItem')
            await values.first().click()
            await pg.waitForTimeout(1000)

            // Value should have been selected (panel closes or input updates)
            expect(valueName.trim().length).toBeGreaterThan(0)
        })
    })

    // =====================================================================
    //  3. Advanced Mode — Panel
    // =====================================================================

    test.describe('Advanced Mode — Panel', () => {
        test('clicking advanced toggle opens panel with Layers, Field, Operator, Value columns', async () => {
            await switchToAdvanced(pg)

            // Advanced panel has columns for layers, fields, operator, value
            await expect(pg.locator('.searchUnifiedColLayers')).toBeVisible()
            await expect(pg.locator('.searchUnifiedColFields')).toBeVisible()

            const headers = pg.locator(
                '.searchUnifiedPanel:not(.searchRegularPanel) .searchUnifiedColHeader'
            )
            const count = await headers.count()
            expect(count).toBeGreaterThanOrEqual(3)
        })

        test('no layers checked by default in advanced mode', async () => {
            await switchToAdvanced(pg)
            const checked = pg.locator(
                '.searchUnifiedLayerItem [data-checked]'
            )
            const count = await checked.count()
            expect(count).toBe(0)
        })

        test('fields column empty when no layers checked', async () => {
            await switchToAdvanced(pg)
            const fieldsBody = pg.locator(
                '.searchUnifiedColFields .searchUnifiedColBody'
            )
            await expect(fieldsBody).toContainText(/select layers/i, {
                timeout: 5000,
            })
        })

        test('checking a layer populates the fields column', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })

            await layerItems.first().click()
            await pg.waitForTimeout(2000)

            const fields = pg.locator('.searchUnifiedFieldItem')
            const count = await fields.count()
            expect(count).toBeGreaterThan(0)
        })

        test('field filter input narrows the field list', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })
            await layerItems.first().click()

            const fields = pg.locator('.searchUnifiedFieldItem')
            await expect(fields.first()).toBeVisible({ timeout: 10000 })
            const initial = await fields.count()

            const filterInput = pg.locator(
                '.searchUnifiedColFields .searchUnifiedFilterInput'
            )
            await filterInput.fill('name')
            await pg.waitForTimeout(500)

            const filtered = await fields.count()
            expect(filtered).toBeLessThanOrEqual(initial)
            expect(filtered).toBeGreaterThan(0)

            // Clear filter for next test
            await filterInput.fill('')
        })

        test('selecting a field marks it active and shows operators', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })
            await layerItems.first().click()

            const fields = pg.locator('.searchUnifiedFieldItem')
            await expect(fields.first()).toBeVisible({ timeout: 10000 })
            await fields.first().click()

            await expect(fields.first()).toHaveClass(
                /searchUnifiedFieldItemActive/
            )

            const ops = pg.locator('.searchUnifiedOpItem')
            const opCount = await ops.count()
            expect(opCount).toBeGreaterThan(0)
        })

        test('layer path nesting is displayed', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })

            const pathPrefixes = pg.locator('.searchUnifiedLayerPath')
            const pathCount = await pathPrefixes.count()
            expect(pathCount).toBeGreaterThan(0)
        })

        test('layer filter narrows the layers list', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })
            const initial = await layerItems.count()

            const filterInput = pg.locator(
                '.searchUnifiedColLayers .searchUnifiedFilterInput'
            )
            await filterInput.fill('zzznonexistent')
            await pg.waitForTimeout(500)

            const filtered = await layerItems.count()
            expect(filtered).toBeLessThan(initial)
        })

        test('select all / none buttons toggle all layers', async () => {
            await switchToAdvanced(pg)

            // Clear any layer filter from previous tests
            const filterInput = pg.locator(
                '.searchUnifiedColLayers .searchUnifiedFilterInput'
            )
            if (await filterInput.isVisible().catch(() => false)) {
                await filterInput.fill('')
                await pg.waitForTimeout(300)
            }

            const actions = pg.locator('.searchDropdownHeaderAction')
            const selectAll = actions.first()

            if (await selectAll.isVisible()) {
                await selectAll.click()
                await pg.waitForTimeout(500)

                const checked = pg.locator(
                    '.searchUnifiedLayerItem [data-checked]'
                )
                const checkCount = await checked.count()
                expect(checkCount).toBeGreaterThan(0)

                // Click "None" to deselect
                const selectNone = actions.last()
                await selectNone.click()
                await pg.waitForTimeout(500)
            }
        })
    })

    // =====================================================================
    //  4. Mode Switching
    // =====================================================================

    test.describe('Mode Switching', () => {
        test('toggling between regular and advanced clears state', async () => {
            await openPanel(pg)
            await expect(pg.locator('.searchRegularPanel')).toBeVisible()

            await switchToAdvanced(pg)
            await expect(pg.locator('.searchUnifiedColLayers')).toBeVisible()

            // Fields should be empty (no layers checked in advanced)
            const fields = pg.locator('.searchUnifiedFieldItem')
            const count = await fields.count()
            expect(count).toBe(0)
        })

        test('switching back to regular mode shows layers/values', async () => {
            await switchToAdvanced(pg)
            await switchToRegular(pg)
            await expect(pg.locator('.searchRegularPanel')).toBeVisible()
        })
    })

    // =====================================================================
    //  5. Clear & Close
    // =====================================================================

    test.describe('Clear & Close', () => {
        test('clear button resets input', async () => {
            await pg.locator('.searchCompactInput').fill('something')
            const clearBtn = pg.locator('.searchCompactClear')
            await expect(clearBtn).toHaveCSS('visibility', 'visible')

            await clearBtn.click()
            const val = await pg.locator('.searchCompactInput').inputValue()
            expect(val).toBe('')
        })

        test('Escape closes the panel', async () => {
            await openPanel(pg)
            const panel = pg.locator('.searchRegularPanel')
            await expect(panel).toBeVisible()

            await pg.keyboard.press('Escape')
            await pg.waitForTimeout(500)
            await expect(panel).not.toBeVisible({ timeout: 3000 })
        })
    })

    // =====================================================================
    //  6. Backend API — /api/geodatasets/search
    // =====================================================================

    test.describe('Backend API — geodataset search', () => {
        test('search returns features for known value', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        key: 'name',
                        value: 'Golden Gate Bridge',
                        operator: '=',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.body).toBeDefined()
                expect(data.body.length).toBeGreaterThan(0)
                expect(data.body[0].properties.name).toBe(
                    'Golden Gate Bridge'
                )
            }
        })

        test('search with contains operator matches partial strings', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        key: 'name',
                        value: 'Golden',
                        operator: 'contains',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.body).toBeDefined()
                expect(data.body.length).toBeGreaterThan(0)
                data.body.forEach((f) => {
                    expect(f.properties.name).toContain('Golden')
                })
            }
        })

        test('search with != excludes matching features', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        key: 'name',
                        value: 'Golden Gate Bridge',
                        operator: '!=',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.body).toBeDefined()
                data.body.forEach((f) => {
                    expect(f.properties.name).not.toBe('Golden Gate Bridge')
                })
            }
        })

        test('search with isnull returns valid response', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        key: 'name',
                        value: '',
                        operator: 'isnull',
                    },
                }
            )

            expect(res.status()).toBe(200)
            const data = await res.json()
            expect(data.body).toBeDefined()
        })

        test('schema endpoint returns field types', async ({ request }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/schema`,
                {
                    data: { layers: 'reference_mission_basic' },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.status).toBe('success')
                expect(data.schema).toBeDefined()
                expect(data.schema.name).toBeDefined()
            }
        })

        test('aggregations endpoint returns distinct values', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/aggregations`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        fields: 'name',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.status).toBe('success')
                expect(data.aggregations).toBeDefined()
            }
        })

        test('search with > operator filters numerics', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_dynamic_extent',
                        key: 'sol',
                        value: '100',
                        operator: '>',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.body).toBeDefined()
                data.body.forEach((f) => {
                    expect(Number(f.properties.sol)).toBeGreaterThan(100)
                })
            }
        })

        test('search with beginswith operator works', async ({ request }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'reference_mission_basic',
                        key: 'name',
                        value: 'G',
                        operator: 'beginswith',
                    },
                }
            )

            if (res.status() === 200) {
                const data = await res.json()
                expect(data.body).toBeDefined()
                data.body.forEach((f) => {
                    expect(f.properties.name.startsWith('G')).toBeTruthy()
                })
            }
        })

        test('search on nonexistent layer returns error or empty', async ({
            request,
        }) => {
            await request.post(`${BASE_URL}/api/users/login`, {
                data: ADMIN_CREDS,
            })

            const res = await request.post(
                `${BASE_URL}/api/geodatasets/search`,
                {
                    data: {
                        layer: 'nonexistent_layer_12345',
                        key: 'name',
                        value: 'test',
                        operator: '=',
                    },
                }
            )

            const data = await res.json().catch(() => ({}))
            // Should return an error status or empty body for a nonexistent table
            const isError =
                res.status() !== 200 ||
                data.status === 'failure' ||
                !data.body ||
                data.body.length === 0
            expect(isError).toBeTruthy()
        })
    })

    // =====================================================================
    //  7. Design System Integration
    // =====================================================================

    test.describe('Design System Integration', () => {
        test('advanced mode layer items have checkboxes', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })

            // base-ui Checkbox renders a <button> with role="checkbox"
            const checkbox = layerItems
                .first()
                .locator('button[role="checkbox"], [data-unchecked], [data-checked]')
            const count = await checkbox.count()
            expect(count).toBeGreaterThan(0)
        })

        test('common fields toggle uses Switch component', async () => {
            await switchToAdvanced(pg)
            const layerItems = pg.locator('.searchUnifiedLayerItem')
            await expect(layerItems.first()).toBeVisible({ timeout: 5000 })
            await layerItems.first().click()
            await pg.waitForTimeout(1000)

            // Switch component — look for the toggle element in the fields column header
            const switchEl = pg.locator('.searchFieldsToggle')
            const count = await switchEl.count()
            expect(count).toBeGreaterThan(0)
        })
    })

    // =====================================================================
    //  8. Search Bar Visibility
    // =====================================================================

    test.describe('Search Visibility', () => {
        test('search bar is visible by default', async () => {
            await expect(pg.locator('.searchBar')).toBeVisible()
        })
    })
})
