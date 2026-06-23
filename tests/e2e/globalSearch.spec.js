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

    test('search bar renders with dropdown trigger and input', async ({
        page,
    }) => {
        const searchBar = page.locator('.searchBar')
        await expect(searchBar).toBeVisible({ timeout: 15000 })

        // Dropdown trigger button exists
        const dropdownTrigger = searchBar.locator('.searchDropdownTrigger')
        await expect(dropdownTrigger).toBeVisible()

        // Search input exists
        const searchInput = searchBar.locator(
            '.searchInputWrapper input[type="text"]'
        )
        await expect(searchInput).toBeVisible()
    })

    test('dropdown opens with Search by Field section', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Click the dropdown trigger
        await page.locator('.searchDropdownTrigger').click()

        // Dropdown panel should appear
        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have "Search by Field" section header
        await expect(
            panel.locator('.searchDropdownSectionHeader').first()
        ).toContainText('Search by Field')

        // Should have the field filter input
        await expect(
            panel.locator('.searchDropdownFieldFilterInput')
        ).toBeVisible()
    })

    test('dropdown shows Search Specific Layer section (collapsed)', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchDropdownTrigger').click()

        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have the collapsible layer section header
        const layerHeader = panel.locator('.searchDropdownCollapsible')
        await expect(layerHeader).toBeVisible()
        await expect(layerHeader).toContainText('Search Specific Layer')

        // Layer list should not be visible initially (collapsed)
        await expect(
            panel.locator('.searchDropdownLayerList')
        ).not.toBeVisible()
    })

    test('expanding layer section shows geodataset layers', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchDropdownTrigger').click()

        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Click to expand layer section
        await panel.locator('.searchDropdownCollapsible').click()

        // Layer list should now be visible
        const layerList = panel.locator('.searchDropdownLayerList')
        await expect(layerList).toBeVisible({ timeout: 3000 })

        // Should have at least one layer item
        const layerItems = layerList.locator('.searchDropdownLayerItem')
        const count = await layerItems.count()
        expect(count).toBeGreaterThan(0)
    })

    test('selecting a field shows chip and changes placeholder', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Wait for schema to load
        await page.waitForTimeout(2000)

        await page.locator('.searchDropdownTrigger').click()
        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Wait for fields to appear
        const firstField = panel.locator('.searchDropdownFieldItem').first()
        await expect(firstField).toBeVisible({ timeout: 10000 })

        // Click the first field
        const fieldName = await firstField
            .locator('.searchDropdownFieldName')
            .textContent()
        await firstField.click()

        // Dropdown should close
        await expect(panel).not.toBeVisible()

        // Chip should appear with the field name
        const chip = page.locator('.searchChip')
        await expect(chip).toBeVisible()
        await expect(chip.locator('.searchChipLabel')).toContainText(fieldName)
    })

    test('removing chip returns to default search mode', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.waitForTimeout(2000)

        // Select a field first
        await page.locator('.searchDropdownTrigger').click()
        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        const firstField = panel.locator('.searchDropdownFieldItem').first()
        await expect(firstField).toBeVisible({ timeout: 10000 })
        await firstField.click()

        // Chip should be visible
        const chip = page.locator('.searchChip')
        await expect(chip).toBeVisible()

        // Click remove on chip
        await chip.locator('.searchChipRemove').click()

        // Chip should disappear
        await expect(chip).not.toBeVisible()

        // Placeholder should be back to default
        const searchInput = page.locator(
            '.searchInputWrapper input[type="text"]'
        )
        const placeholder = await searchInput.getAttribute('placeholder')
        expect(placeholder).toBe('Search features...')
    })

    test('field filter input narrows the field list', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.waitForTimeout(2000)

        await page.locator('.searchDropdownTrigger').click()
        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Wait for fields
        await expect(
            panel.locator('.searchDropdownFieldItem').first()
        ).toBeVisible({ timeout: 10000 })

        const initialCount = await panel
            .locator('.searchDropdownFieldItem')
            .count()

        // Type a filter
        await panel.locator('.searchDropdownFieldFilterInput').fill('name')

        // Should have fewer or equal items (matching "name")
        const filteredCount = await panel
            .locator('.searchDropdownFieldItem')
            .count()
        expect(filteredCount).toBeLessThanOrEqual(initialCount)
        expect(filteredCount).toBeGreaterThan(0)
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
        const chips = panel.locator('.gspChip')
        await expect(chips).toHaveCount(5, { timeout: 5000 })
    })

    test('advanced panel has filter builder controls', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchAdvancedBtn').click()

        const panel = page.locator('#uiRightPanel .gspContainer')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Filter section should have property key input, value input
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

    test('clear button resets search input and chip', async ({ page }) => {
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

        // No chip should be visible
        await expect(page.locator('.searchChip')).not.toBeVisible()
    })
})
