import { test, expect } from '@playwright/test'

/**
 * Global Feature Search — E2E Tests
 *
 * Validates the search bar and advanced search panel UI against a running
 * MMGIS instance with the Reference-Mission (which has 5 geodataset layers
 * configured with search variables).
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:18888'

test.describe('Global Feature Search', () => {
    test.beforeEach(async ({ page, request }) => {
        // Check if Reference-Mission exists before navigating
        const listRes = await request.get(`${BASE_URL}/api/configure/missions`)
        const listData = await listRes.json().catch(() => ({}))
        if (
            !listData.missions ||
            !listData.missions.includes('Reference-Mission')
        ) {
            test.skip(
                true,
                'SKIP: Reference-Mission not available in this CI mode'
            )
            return
        }
        await page.goto('/?mission=Reference-Mission')
        await page.waitForLoadState('networkidle', { timeout: 30000 })
    })

    // ----- Search bar presence -----

    test('search bar renders with layer dropdown and input', async ({
        page,
    }) => {
        const searchBar = page.locator('.searchBar')
        await expect(searchBar).toBeVisible({ timeout: 15000 })

        // Layer dropdown exists
        const layerSelect = searchBar.locator('.searchLayerSelect')
        await expect(layerSelect).toBeVisible()

        // Search input exists
        const searchInput = searchBar.locator('.searchInputWrapper input[type="text"]')
        await expect(searchInput).toBeVisible()
    })

    test('search bar has All Layers option in dropdown', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Open the layer dropdown
        const dropdownTrigger = page.locator(
            '.searchLayerSelect button[aria-expanded]'
        )
        await dropdownTrigger.click()

        // Check for "All Layers (Fields)" option
        const allLayersOption = page.locator('text=All Layers (Fields)')
        await expect(allLayersOption).toBeVisible({ timeout: 5000 })
    })

    test('search bar has geodataset layers in dropdown', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Open the layer dropdown
        const dropdownTrigger = page.locator(
            '.searchLayerSelect button[aria-expanded]'
        )
        await dropdownTrigger.click()

        // Check for at least one geodataset layer
        const basicLayer = page.locator('text=Geodatasets - Basic')
        await expect(basicLayer).toBeVisible({ timeout: 5000 })
    })

    // ----- Advanced Search panel -----

    test('advanced search button opens right panel', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Click the advanced search (filter icon) button
        const advancedBtn = page.locator('.searchAdvancedBtn')
        await advancedBtn.click()

        // The right panel should contain the GlobalSearchPanel
        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Header should say "Advanced Search"
        const title = panel.locator('.gspTitle')
        await expect(title).toHaveText('Advanced Search')
    })

    test('advanced panel shows layer chips', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have layer chips
        const chips = panel.locator('.gspLayerChip')
        await expect(chips).toHaveCount(5, { timeout: 5000 })
    })

    test('advanced panel has filter builder controls', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Filter section should have property key input, operator select, value input
        await expect(
            panel.locator('input[placeholder="Property key"]')
        ).toBeVisible()
        await expect(
            panel.locator('input[placeholder="Value"]')
        ).toBeVisible()

        // Add Filter and Add Group buttons
        await expect(panel.locator('text=Add Filter')).toBeVisible()
        await expect(panel.locator('text=Add Group')).toBeVisible()

        // Search button
        await expect(panel.locator('button:has-text("Search")')).toBeVisible()
    })

    test('close button closes advanced panel', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Click close button
        const closeBtn = panel.locator('.gspHeader button')
        await closeBtn.click()

        // Panel should be hidden
        await expect(panel).toBeHidden({ timeout: 5000 })
    })

    test('add filter row button creates new filter row', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Count initial filter rows
        const initialRows = await panel.locator('.gspFilterRow').count()

        // Click "Add Filter"
        await panel.locator('text=Add Filter').click()

        // Should have one more row
        const newRows = await panel.locator('.gspFilterRow').count()
        expect(newRows).toBe(initialRows + 1)
    })

    test('add group button creates group operator row', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Click "Add Group"
        await panel.locator('text=Add Group').click()

        // Should have a group row
        const groupRows = panel.locator('.gspFilterGroup')
        await expect(groupRows).toHaveCount(1, { timeout: 3000 })
    })

    // ----- Search execution -----

    test('search with filter returns results', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Enter a property key and value
        await panel
            .locator('input[placeholder="Property key"]')
            .first()
            .fill('name')
        await panel
            .locator('input[placeholder="Value"]')
            .first()
            .fill('Civic Center Plaza')

        // Click Search
        await panel.locator('button:has-text("Search")').click()

        // Wait for results to appear
        const resultsSection = panel.locator('.gspResults')
        await expect(resultsSection).toBeVisible({ timeout: 10000 })

        // Should have at least one result group or feature
        const resultItems = resultsSection.locator(
            '.gspResultGroup, .gspResultItem'
        )
        await expect(resultItems.first()).toBeVisible({ timeout: 10000 })
    })

    // ----- Clear / basic search -----

    test('clear button resets search input', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        const searchInput = page.locator(
            '.searchInputWrapper input[type="text"]'
        )
        await searchInput.fill('test query')
        expect(await searchInput.inputValue()).toBe('test query')

        // Click clear
        await page.locator('.searchClearBtn').click()

        // Input should be empty
        expect(await searchInput.inputValue()).toBe('')
    })
})
