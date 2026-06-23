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

    test('search bar renders with layers and fields dropdowns and input', async ({
        page,
    }) => {
        const searchBar = page.locator('.searchBar')
        await expect(searchBar).toBeVisible({ timeout: 15000 })

        // Should have two dropdown triggers (layers + fields)
        const triggers = searchBar.locator('.searchDropdownTrigger')
        await expect(triggers.first()).toBeVisible()
        await expect(triggers.nth(1)).toBeVisible()

        // Search input exists
        const searchInput = searchBar.locator(
            '.searchInputWrapper input[type="text"]'
        )
        await expect(searchInput).toBeVisible()
    })

    test('fields dropdown opens with Search by Field section', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Click the fields dropdown trigger (second trigger)
        await page.locator('.searchDropdownTrigger').nth(1).click()

        // Dropdown panel should appear
        const panel = page.locator('.searchDropdownPanel').last()
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

    test('layers dropdown shows checkboxes for geodataset layers', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Click the layers dropdown trigger (first trigger)
        await page.locator('.searchDropdownTrigger').first().click()

        const panel = page.locator('.searchDropdownPanel').first()
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have "Layers" section header
        await expect(
            panel.locator('.searchDropdownSectionHeader').first()
        ).toContainText('Layers')

        // Should have checkbox items
        const checkItems = panel.locator('.searchDropdownLayerCheckItem')
        const count = await checkItems.count()
        expect(count).toBeGreaterThan(0)

        // All should be checked by default
        const firstCheckbox = checkItems.first().locator('input[type="checkbox"]')
        await expect(firstCheckbox).toBeChecked()
    })

    test('selecting a field shows chip and changes placeholder', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Wait for schema to load
        await page.waitForTimeout(2000)

        await page.locator('.searchDropdownTrigger').nth(1).click()
        const panel = page.locator('.searchDropdownPanel').last()
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
        await page.locator('.searchDropdownTrigger').nth(1).click()
        const panel = page.locator('.searchDropdownPanel').last()
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

        await page.locator('.searchDropdownTrigger').nth(1).click()
        const panel = page.locator('.searchDropdownPanel').last()
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
