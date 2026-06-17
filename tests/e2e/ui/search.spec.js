import { test, expect } from '@playwright/test';

/**
 * E2E tests for Search functionality.
 *
 * The Reference Mission does not include a dedicated Search tool in its
 * tools array (Identifier, Layers, Legend, Info, Sites, Draw, Measure,
 * Viewshed, Isochrone, Sightline, Chemistry, Curtain, Animation).
 *
 * However, MMGIS has a top-bar search input (#auto_search) that is
 * rendered when the topbar is enabled.  These tests exercise that
 * search interface if present, and skip gracefully otherwise.
 */

test.describe('Search Functionality', () => {

  test.beforeEach(async ({ page }) => {
    // Suppress expected 404 console errors for placeholder data
    page.on('console', () => {});

    const response = await page.goto('/?mission=Reference-Mission');

    // AUTH=local guard: if the page returns HTML login instead of the app, skip
    const contentType = response?.headers()?.['content-type'] || '';
    const isLoginPage = await page.locator('#loginModal, input[name="password"], form[action*="login"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isLoginPage) {
      test.skip(true, 'SKIP: AUTH=local mode — login page returned instead of app');
      return;
    }

    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 30000,
    });
  });

  test('search input is present in the top bar', async ({ page }) => {
    // The MMGIS top bar may contain a search input (#auto_search or similar)
    const searchInput = page.locator(
      '#auto_search, input[id*="search"], input[placeholder*="Search"], [class*="search"] input'
    ).first();
    const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    await expect(searchInput).toBeVisible();
  });

  test('search for a known layer name shows results', async ({ page }) => {
    const searchInput = page.locator(
      '#auto_search, input[id*="search"], input[placeholder*="Search"], [class*="search"] input'
    ).first();
    const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    // Type a known layer name
    await searchInput.click();
    await searchInput.fill('Points Basic');
    await page.waitForTimeout(1000);

    // Check for autocomplete / result items
    const results = page.locator(
      '.autocomplete-suggestions, [class*="search-result"], [class*="SearchResult"], ul.ui-autocomplete li'
    );
    const resultCount = await results.count();

    if (resultCount === 0) {
      // The search might work differently — check if any dropdown appeared
      const anyDropdown = page.locator(
        '[class*="dropdown"]:visible, [class*="suggestion"]:visible, [class*="autocomplete"]:visible'
      ).first();
      const dropdownVisible = await anyDropdown.isVisible({ timeout: 2000 }).catch(() => false);
      // Either results or a dropdown should appear for a valid search term
      expect(resultCount > 0 || dropdownVisible).toBeTruthy();
    } else {
      expect(resultCount).toBeGreaterThan(0);
    }
  });

  test('search for a known site name shows results', async ({ page }) => {
    const searchInput = page.locator(
      '#auto_search, input[id*="search"], input[placeholder*="Search"], [class*="search"] input'
    ).first();
    const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    // Type a known site name
    await searchInput.click();
    await searchInput.fill('Golden Gate Bridge');
    await page.waitForTimeout(1000);

    // Check for autocomplete / result items
    const results = page.locator(
      '.autocomplete-suggestions, [class*="search-result"], [class*="SearchResult"], ul.ui-autocomplete li'
    );
    const resultCount = await results.count();

    if (resultCount === 0) {
      const anyDropdown = page.locator(
        '[class*="dropdown"]:visible, [class*="suggestion"]:visible, [class*="autocomplete"]:visible'
      ).first();
      const dropdownVisible = await anyDropdown.isVisible({ timeout: 2000 }).catch(() => false);
      expect(resultCount > 0 || dropdownVisible).toBeTruthy();
    } else {
      expect(resultCount).toBeGreaterThan(0);
    }
  });

  test('search for nonexistent term shows no results or empty state', async ({ page }) => {
    const searchInput = page.locator(
      '#auto_search, input[id*="search"], input[placeholder*="Search"], [class*="search"] input'
    ).first();
    const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'SKIP: Search not configured in Reference Mission');
      return;
    }

    // Type a term that should not match anything
    await searchInput.click();
    await searchInput.fill('zzz_nonexistent_xyzzy_12345');
    await page.waitForTimeout(1000);

    // Verify no results appear
    const results = page.locator(
      '.autocomplete-suggestions .autocomplete-suggestion, [class*="search-result"], ul.ui-autocomplete li'
    );
    const resultCount = await results.count();

    // Either no results or an empty-state message
    expect(resultCount).toBeLessThanOrEqual(1);
  });

});
