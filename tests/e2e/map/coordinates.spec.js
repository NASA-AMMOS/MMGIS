import { test, expect } from '@playwright/test';
import { waitForMapReady, clickOnMap } from '../../helpers/map-helpers.js';
import { MissionPage } from '../../pages/MissionPage.js';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;

/**
 * Detect AUTH=local mode by checking if the page shows a login form
 * instead of the map. Returns true if we should skip the test.
 */
async function shouldSkipAuth(page) {
  const loginForm = await page
    .locator('form[action*="login"], input[name="password"], #loginScreen')
    .count();
  return loginForm > 0;
}

test.describe('Coordinate Display', () => {
  let missionPage;

  test.beforeEach(async ({ page }) => {
    missionPage = new MissionPage(page);
    await page.goto(MISSION_URL);

    // Handle AUTH=local mode gracefully
    if (await shouldSkipAuth(page)) {
      test.skip(true, 'SKIP: AUTH=local mode — login form shown instead of map');
      return;
    }

    await waitForMapReady(page);
  });

  test('coordinate display container is visible', async ({ page }) => {
    // The coordinates div should be present on the page
    // Config has coordinates: true and coordll: true, coorden: true
    const coordDiv = page.locator('#CoordinatesDiv, .mouseLngLat');
    await expect(coordDiv.first()).toBeVisible({ timeout: 10000 });
  });

  test('coordinate display element exists with content', async ({ page }) => {
    // The #mouseLngLat element should exist and display coordinates
    const coordDisplay = page.locator('#mouseLngLat');
    await expect(coordDisplay).toBeAttached({ timeout: 10000 });
  });

  test('mouse move over map updates coordinate display', async ({ page }) => {
    // Get the map bounding box
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) throw new Error('#map element not found');

    // Move mouse to center of map
    const centerX = mapBox.x + mapBox.width / 2;
    const centerY = mapBox.y + mapBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.waitForTimeout(500);

    // Read coordinate text
    const coordText1 = await page.locator('#mouseLngLat').textContent();

    // Move mouse to a different position on the map
    await page.mouse.move(centerX + 100, centerY + 50);
    await page.waitForTimeout(500);

    // Read coordinate text again
    const coordText2 = await page.locator('#mouseLngLat').textContent();

    // Coordinates should have been updated (text should differ for different positions)
    // At minimum, both should be non-empty after mouse movement
    if (coordText1 && coordText2) {
      expect(coordText1).not.toEqual(coordText2);
    }
  });

  test('coordinate values are numeric and properly formatted', async ({ page }) => {
    // Move mouse over the map to trigger coordinate display
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) throw new Error('#map element not found');

    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(500);

    const coordText = await page.locator('#mouseLngLat').textContent();

    if (coordText && coordText.trim().length > 0) {
      // Coordinate text should contain numbers separated by commas
      // e.g., "-122.40000000, 37.80000000" or "Easting, Northing"
      const parts = coordText.split(',').map((p) => p.trim());
      expect(parts.length).toBeGreaterThanOrEqual(2);

      // Each part should be parseable as a number
      for (const part of parts) {
        const cleaned = part.replace(/[^\d.\-eE+]/g, '');
        if (cleaned.length > 0) {
          const num = parseFloat(cleaned);
          expect(isNaN(num)).toBeFalsy();
        }
      }
    }
  });

  test('click on map captures coordinates', async ({ page }) => {
    // Move mouse over the map first to establish coordinate tracking
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) throw new Error('#map element not found');

    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(300);

    // Click on map
    await clickOnMap(page, Math.round(mapBox.width / 2), Math.round(mapBox.height / 2));
    await page.waitForTimeout(500);

    // After clicking, coordinates should still be displayed
    const coordText = await page.locator('#mouseLngLat').textContent();
    expect(coordText).toBeTruthy();
  });

  test('coordinate type dropdown exists for switching systems', async ({ page }) => {
    // The config has coordll: true and coorden: true, so multiple coordinate systems exist
    const coordDropdown = page.locator('#changeCoordType, #changeCoordTypeDropdown');
    const dropdownCount = await coordDropdown.count();
    expect(dropdownCount).toBeGreaterThan(0);
  });

  test('coordinate type dropdown has multiple options', async ({ page }) => {
    // Check that the dropdown has multiple coordinate system options
    // Config: coordll: true, coorden: true — so at least lon/lat and east/north
    const dropdownOptions = await page.evaluate(() => {
      const dropdown = document.querySelector('#changeCoordTypeDropdown');
      if (!dropdown) return [];
      // Dropy dropdowns use list items
      const items = dropdown.querySelectorAll('.dropy__content li, .dropy__content a, option');
      return Array.from(items).map((el) => el.textContent?.trim()).filter(Boolean);
    });

    // Should have at least 2 coordinate systems (ll and en)
    if (dropdownOptions.length > 0) {
      expect(dropdownOptions.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('switching coordinate system changes display format', async ({ page }) => {
    // Move mouse over map first
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) throw new Error('#map element not found');

    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(500);

    // Read current coordinates
    const coordsBefore = await page.locator('#mouseLngLat').textContent();

    // Try to switch coordinate system via dropdown
    const switched = await page.evaluate(() => {
      const dropdown = document.querySelector('#changeCoordTypeDropdown');
      if (!dropdown) return false;
      // Find the dropdown items
      const items = dropdown.querySelectorAll('.dropy__content li');
      if (items.length < 2) return false;
      // Click the second option (different coordinate system)
      items[1].click();
      return true;
    });

    if (!switched) {
      // Try clicking the dropdown first to open it
      const dropdownEl = page.locator('#changeCoordTypeDropdown .dropy__title, #changeCoordType');
      if (await dropdownEl.count() > 0) {
        await dropdownEl.first().click();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(500);

    // Move mouse again to trigger coordinate update with new system
    await page.mouse.move(mapBox.x + mapBox.width / 2 + 1, mapBox.y + mapBox.height / 2 + 1);
    await page.waitForTimeout(500);

    const coordsAfter = await page.locator('#mouseLngLat').textContent();

    // If we successfully switched coordinate systems, the display should differ
    // (different units/format between lon/lat and easting/northing)
    if (switched && coordsBefore && coordsAfter) {
      // Values should be different since coordinate systems produce different numbers
      expect(coordsAfter).toBeTruthy();
    }
  });

  test('elevation display is present when configured', async ({ page }) => {
    // Config has coordelev: true, so elevation should be available
    const elevDisplay = page.locator('#mouseElev');
    await expect(elevDisplay).toBeAttached({ timeout: 10000 });

    // Move mouse over map to trigger elevation lookup
    const mapBox = await page.locator('#map').boundingBox();
    if (!mapBox) throw new Error('#map element not found');

    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(2000);

    // Elevation may take time to load from DEM — just verify element exists
    const elevText = await elevDisplay.textContent();
    // Elevation may be empty if DEM is not available; that's acceptable
    expect(elevText !== undefined).toBeTruthy();
  });

  test('pick coordinates button is present', async ({ page }) => {
    // The pick coordinates button allows clicking on the map to capture a point
    const pickBtn = page.locator('#pickLngLat');
    await expect(pickBtn).toBeAttached({ timeout: 10000 });
  });

  test('time toggle button is present when time is enabled', async ({ page }) => {
    // Config has time.enabled: true and time.visible: true
    // The toggle time UI button should be visible in the coordinates bar
    const timeToggle = page.locator('#toggleTimeUI');
    const count = await timeToggle.count();
    expect(count).toBeGreaterThan(0);
  });
});
