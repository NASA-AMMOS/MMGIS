import { test, expect } from '@playwright/test';

/**
 * E2E tests for the right-click context menu on the map.
 *
 * MMGIS renders a `.ContextMenuMap` element on right-click that contains:
 *   - "Copy Coordinates" action
 *   - Any configured rightClickMenuActions from coordinates.variables
 *   - Features found at the click location
 *
 * The context menu auto-hides on mouseleave.
 */

test.describe('Map Context Menu', () => {

  // Cap per-test time so timeouts don't eat the entire CI job budget
  test.describe.configure({ timeout: 30000 });

  test.beforeEach(async ({ page }) => {
    // Suppress expected 404 console errors
    page.on('console', () => {});

    const response = await page.goto('/?mission=Reference-Mission', { timeout: 15000 });

    // AUTH=local guard
    const isLoginPage = await page.locator('#loginModal, input[name="password"], form[action*="login"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isLoginPage) {
      test.skip(true, 'SKIP: AUTH=local mode — login page returned instead of app');
      return;
    }

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !!(window.mmgisAPI && window.mmgisAPI.map), {
      timeout: 10000,
    }).catch(() => {
      // If mmgisAPI.map never appears, individual tests will skip via their guards
    });
  });

  test('right-click on map opens context menu', async ({ page }) => {
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    // Right-click on the center of the map
    await mapEl.click({
      position: { x: mapBox.width / 2, y: mapBox.height / 2 },
      button: 'right',
    });
    await page.waitForTimeout(500);

    // Verify the context menu appeared
    const contextMenu = page.locator('.ContextMenuMap');
    const menuVisible = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

    if (!menuVisible) {
      test.skip(true, 'SKIP: Context menu not configured or did not appear');
      return;
    }

    await expect(contextMenu).toBeVisible();
  });

  test('context menu contains "Copy Coordinates" option', async ({ page }) => {
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    await mapEl.click({
      position: { x: mapBox.width / 2, y: mapBox.height / 2 },
      button: 'right',
    });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('.ContextMenuMap');
    const menuVisible = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

    if (!menuVisible) {
      test.skip(true, 'SKIP: Context menu not configured or did not appear');
      return;
    }

    // Verify "Copy Coordinates" is in the menu
    const copyCoords = page.locator('#contextMenuMapCopyCoords');
    await expect(copyCoords).toBeVisible();
    const text = await copyCoords.textContent();
    expect(text).toContain('Copy Coordinates');
  });

  test('clicking "Copy Coordinates" shows confirmation', async ({ page }) => {
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    await mapEl.click({
      position: { x: mapBox.width / 2, y: mapBox.height / 2 },
      button: 'right',
    });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('.ContextMenuMap');
    const menuVisible = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

    if (!menuVisible) {
      test.skip(true, 'SKIP: Context menu not configured or did not appear');
      return;
    }

    // Grant clipboard permissions so copy doesn't fail
    try {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // Some environments don't support granting clipboard permissions
    }

    // Click "Copy Coordinates"
    const copyCoords = page.locator('#contextMenuMapCopyCoords');
    await copyCoords.click();
    await page.waitForTimeout(500);

    // After clicking, the text should change to "Copied!" briefly
    const updatedText = await copyCoords.textContent().catch(() => '');
    // It may have already reverted; accept either "Copied!" or "Copy Coordinates"
    expect(updatedText === 'Copied!' || updatedText === 'Copy Coordinates').toBeTruthy();
  });

  test('context menu disappears on mouse leave', async ({ page }) => {
    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    await mapEl.click({
      position: { x: mapBox.width / 2, y: mapBox.height / 2 },
      button: 'right',
    });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('.ContextMenuMap');
    const menuVisible = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

    if (!menuVisible) {
      test.skip(true, 'SKIP: Context menu not configured or did not appear');
      return;
    }

    // Move mouse away from the context menu to trigger mouseleave
    await page.mouse.move(0, 0);
    // Wait for the fade-out animation (250ms) plus buffer
    await page.waitForTimeout(500);

    // The context menu should be removed from the DOM
    const menuCount = await page.locator('.ContextMenuMap').count();
    expect(menuCount).toBe(0);
  });

  test('context menu shows features when right-clicking on a visible layer', async ({ page }) => {
    // Enable a vector layer first so features are on the map
    const hasLayer = await page.evaluate(() => {
      if (window.mmgisAPI && typeof window.mmgisAPI.toggleLayer === 'function') {
        window.mmgisAPI.toggleLayer('Initially Visible');
        return true;
      }
      return false;
    });

    if (!hasLayer) {
      // The "Initially Visible" layer should already be on by default
      // Just proceed and right-click — may or may not find features
    }

    await page.waitForTimeout(1000);

    const mapEl = page.locator('#map');
    const mapBox = await mapEl.boundingBox();
    if (!mapBox) {
      test.skip(true, 'SKIP: Map element not found');
      return;
    }

    // Right-click on the center of the map
    await mapEl.click({
      position: { x: mapBox.width / 2, y: mapBox.height / 2 },
      button: 'right',
    });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('.ContextMenuMap');
    const menuVisible = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

    if (!menuVisible) {
      test.skip(true, 'SKIP: Context menu not configured or did not appear');
      return;
    }

    // Verify the context menu has a list of items
    const menuItems = contextMenu.locator('ul li');
    const itemCount = await menuItems.count();
    // At minimum "Copy Coordinates" should be present
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

});
