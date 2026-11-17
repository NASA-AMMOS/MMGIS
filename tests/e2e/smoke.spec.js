import { test, expect } from '@playwright/test';

/**
 * Smoke tests for MMGIS application
 * Basic tests to verify the application loads and is functional
 */

test.describe('MMGIS Application - Smoke Tests', () => {

  test('application loads successfully', async ({ page, request }) => {
    // First verify the server is up
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const healthRes = await request.get(`${baseURL}/api/utils/healthcheck`);
    expect(healthRes.status()).toBe(200);

    // Check if Reference-Mission exists before navigating to it
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    // Navigate to the application
    await page.goto('/?mission=Reference-Mission');

    // Wait for the page to load (loading screen to disappear or main content to appear)
    // The loading screen has id="loadscreen"
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check that the page title contains MMGIS
    await expect(page).toHaveTitle(/MMGIS/i);
  });

  test('main container elements are present', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle');

    // Check for main application containers
    // Based on the codebase, the app should have these main elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // The page should have loaded content (not just loading screen)
    const hasContent = await page.evaluate(() => {
      return document.body.innerHTML.length > 1000;
    });
    expect(hasContent).toBeTruthy();
  });

  test('stylesheets load without errors', async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes('Reference-Mission')) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle');
    const sheetCount = await page.evaluate(() => document.styleSheets.length);
    expect(sheetCount).toBeGreaterThan(0);
  });
});
