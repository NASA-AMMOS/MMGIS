import { test, expect } from '@playwright/test';

/**
 * E2E tests for Search functionality.
 *
 * Tests the React-based global search bar (.searchBar) which provides:
 * - Layer/group selection with search constructs
 * - Value suggestions from vector layers (toGeoJSON) and geodatasets (bulk_aggregations)
 * - Select mode (highlight/pan) and Filter mode (apply real filters)
 * - Wildcard pattern matching
 *
 * Skips gracefully when the Search component is not configured.
 */

test.describe('Search Functionality', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', () => {});

    const response = await page.goto('/?mission=Reference-Mission');

    // AUTH=local guard
    const isLoginPage = await page.locator('#loginModal, input[name="password"], form[action*="login"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isLoginPage) {
      test.skip(true, 'SKIP: AUTH=local mode — login page returned instead of app');
      return;
    }

    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.L_), {
      timeout: 30000,
    });
  });

  test('search bar is present', async ({ page }) => {
    const searchBar = page.locator('.searchBar');
    const visible = await searchBar.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    await expect(searchBar).toBeVisible();
  });

  test('search input accepts text', async ({ page }) => {
    const searchInput = page.locator('.searchCompactInput');
    const visible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    await searchInput.click();
    await searchInput.fill('Golden Gate');
    await page.waitForTimeout(1000);

    const value = await searchInput.inputValue();
    expect(value).toBe('Golden Gate');
  });

  test('clicking input opens the panel with layers', async ({ page }) => {
    const searchInput = page.locator('.searchCompactInput');
    const visible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    await searchInput.click();
    await page.waitForTimeout(500);

    const panel = page.locator('.searchUnifiedPanel');
    const panelVisible = await panel.isVisible({ timeout: 3000 }).catch(() => false);
    expect(panelVisible).toBeTruthy();

    // Should have layer items
    const layers = page.locator('.searchRegularLayerItem');
    const count = await layers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('search for nonexistent term shows empty state', async ({ page }) => {
    const searchInput = page.locator('.searchCompactInput');
    const visible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    // First select a layer to populate values
    await searchInput.click();
    const layers = page.locator('.searchRegularLayerItem');
    if (await layers.count() > 0) {
      await layers.first().click();
      await page.waitForTimeout(2000);
    }

    // Type a term that should not match anything
    await searchInput.fill('zzz_nonexistent_xyzzy_12345');
    await page.waitForTimeout(1000);

    // Verify no suggestion items appear
    const results = page.locator('.searchSuggestionItem');
    const resultCount = await results.count();
    expect(resultCount).toBe(0);

    // Empty state message should be visible
    const empty = page.locator('.searchUnifiedEmpty');
    const emptyVisible = await empty.isVisible().catch(() => false);
    if (emptyVisible) {
      const text = await empty.textContent();
      expect(text.toLowerCase()).toContain('no match');
    }
  });

});
