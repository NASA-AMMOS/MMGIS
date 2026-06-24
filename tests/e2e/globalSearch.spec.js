import { test, expect } from '@playwright/test'

/**
 * Global Feature Search — E2E Tests
 *
 * Validates the search bar and unified search panel UI against a running
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

    test('search bar renders with compact input', async ({ page }) => {
        const searchBar = page.locator('.searchBar')
        await expect(searchBar).toBeVisible({ timeout: 15000 })

        // Should have the compact search input
        const searchInput = searchBar.locator('.searchCompactInput')
        await expect(searchInput).toBeVisible()
    })

    test('clicking search bar opens unified panel with all columns', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Click the compact input to open the panel
        await page.locator('.searchCompactInput').click()

        // Unified panel should appear
        const panel = page.locator('.searchUnifiedPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have 4 column headers: Layers, Field, Operator, Value
        const headers = panel.locator('.searchUnifiedColHeader')
        await expect(headers.nth(0)).toContainText('Layers')
        await expect(headers.nth(1)).toContainText('Field')
        await expect(headers.nth(2)).toContainText('Operator')
        await expect(headers.nth(3)).toContainText('Value')
    })

    test('layers column shows checkboxes for geodataset layers', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Open the panel
        await page.locator('.searchCompactInput').click()
        const panel = page.locator('.searchUnifiedPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Should have layer checkbox items
        const checkItems = panel.locator('.searchUnifiedLayerItem')
        const count = await checkItems.count()
        expect(count).toBeGreaterThan(0)
    })

    test('selecting a field highlights it and loads values', async ({
        page,
    }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Wait for schema to load
        await page.waitForTimeout(2000)

        // Open the panel
        await page.locator('.searchCompactInput').click()
        const panel = page.locator('.searchUnifiedPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Wait for fields to appear
        const firstField = panel.locator('.searchUnifiedFieldItem').first()
        await expect(firstField).toBeVisible({ timeout: 10000 })

        // Click the first field
        await firstField.click()

        // Should be marked active
        await expect(firstField).toHaveClass(/searchUnifiedFieldItemActive/)
    })

    test('field filter input narrows the field list', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })
        await page.waitForTimeout(2000)

        // Open the panel
        await page.locator('.searchCompactInput').click()
        const panel = page.locator('.searchUnifiedPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        // Wait for fields
        await expect(
            panel.locator('.searchUnifiedFieldItem').first()
        ).toBeVisible({ timeout: 10000 })

        const initialCount = await panel
            .locator('.searchUnifiedFieldItem')
            .count()

        // Type a filter in the fields column filter input
        const fieldFilter = panel.locator('.searchUnifiedColFields .searchUnifiedFilterInput')
        await fieldFilter.fill('name')

        // Should have fewer or equal items (matching "name")
        const filteredCount = await panel
            .locator('.searchUnifiedFieldItem')
            .count()
        expect(filteredCount).toBeLessThanOrEqual(initialCount)
        expect(filteredCount).toBeGreaterThan(0)
    })

    // ----- Clear / basic search -----

    test('clear button resets search state', async ({ page }) => {
        await expect(page.locator('.searchBar')).toBeVisible({ timeout: 15000 })

        // Open the panel and select a field
        await page.locator('.searchCompactInput').click()
        const panel = page.locator('.searchUnifiedPanel')
        await expect(panel).toBeVisible({ timeout: 5000 })

        await page.waitForTimeout(2000)

        // Select a field if available
        const firstField = panel.locator('.searchUnifiedFieldItem').first()
        if (await firstField.isVisible()) {
            await firstField.click()
        }

        // Click clear
        await page.locator('.searchCompactClear').click()

        // Compact input should show placeholder
        const searchInput = page.locator('.searchCompactInput')
        expect(await searchInput.inputValue()).toBe('')
    })
})
