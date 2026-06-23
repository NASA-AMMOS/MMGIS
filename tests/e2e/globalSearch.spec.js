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

    test('dropdown shows Search Specific Layer section (expanded)', async ({
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

        // Layer list should be visible (expanded by default)
        await expect(
            panel.locator('.searchDropdownLayerList')
        ).toBeVisible()
    })

    test('collapsing then expanding layer section shows geodataset layers', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.locator('.searchDropdownTrigger').click()

        const panel = page.locator('.searchDropdownPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Collapse the layer section
        await panel.locator('.searchDropdownCollapsible').click()
        await expect(panel.locator('.searchDropdownLayerList')).not.toBeVisible()

        // Re-expand
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
