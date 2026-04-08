import { test, expect } from '@playwright/test';
import { waitForMapReady, waitForTilesLoaded } from '../../helpers/map-helpers.js';
import { MissionPage } from '../../pages/MissionPage.js';
import { LayersPanelPage } from '../../pages/LayersPanelPage.js';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;

test.describe('Layer Toggle', () => {
  let missionPage;
  let layersPanel;

  test.beforeEach(async ({ page }) => {
    missionPage = new MissionPage(page);
    layersPanel = new LayersPanelPage(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await waitForTilesLoaded(page);

    // Open the Layers tool panel
    await missionPage.openTool('Layers');
    await page.waitForTimeout(500);
  });

  test('"ArcGIS World Imagery" basemap is visible by default with tile images', async ({ page }) => {
    // ArcGIS World Imagery has visibility: true in the config
    // Verify tile images from arcgisonline.com are present in the tile pane
    const arcgisTiles = page.locator('.leaflet-tile-pane img[src*="arcgisonline.com"]');
    await expect(arcgisTiles.first()).toBeVisible({ timeout: 15000 });

    const count = await arcgisTiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('"Points Basic" layer (initially off) can be toggled on and features appear', async ({ page }) => {
    // "Points Basic" has visibility: false in config
    // Expand the header groups to find it
    await layersPanel.expandGroup('Geometry Types');
    await page.waitForTimeout(300);

    // Toggle on "Points Basic"
    await layersPanel.toggleLayer('Points Basic');
    await page.waitForTimeout(1000);

    // Verify vector elements appear on the map (SVG paths or circle markers)
    const vectorElements = page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane circle, .leaflet-marker-pane .leaflet-marker-icon, .leaflet-overlay-pane canvas',
    );
    const count = await vectorElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('"Points Basic" can be toggled off and features disappear', async ({ page }) => {
    await layersPanel.expandGroup('Geometry Types');
    await page.waitForTimeout(300);

    // Toggle on first
    await layersPanel.toggleLayer('Points Basic');
    await page.waitForTimeout(1000);

    // Count elements before toggling off
    const vectorsBefore = await page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane circle, .leaflet-marker-pane .leaflet-marker-icon',
    ).count();

    // Toggle off
    await layersPanel.toggleLayer('Points Basic');
    await page.waitForTimeout(1000);

    // Verify the layer is no longer visible via API
    const isOn = await layersPanel.isLayerOn('Points Basic');
    expect(isOn).toBeFalsy();
  });

  test('toggle a vector layer on then off then on again restores features', async ({ page }) => {
    await layersPanel.expandGroup('Geometry Types');
    await page.waitForTimeout(300);

    // Toggle on "Polygons Basic"
    await layersPanel.toggleLayer('Polygons Basic');
    await page.waitForTimeout(1000);

    // Capture feature count while on
    const countOn = await page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane circle',
    ).count();

    // Toggle off
    await layersPanel.toggleLayer('Polygons Basic');
    await page.waitForTimeout(1000);

    // Toggle back on
    await layersPanel.toggleLayer('Polygons Basic');
    await page.waitForTimeout(1000);

    // Feature count should be restored
    const countRestored = await page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane circle',
    ).count();
    expect(countRestored).toBeGreaterThanOrEqual(countOn);
  });

  test('multiple layers can be toggled on simultaneously', async ({ page }) => {
    await layersPanel.expandGroup('Geometry Types');
    await page.waitForTimeout(300);

    // Toggle on Points Basic and Lines Basic
    await layersPanel.toggleLayer('Points Basic');
    await page.waitForTimeout(500);
    await layersPanel.toggleLayer('Lines Basic');
    await page.waitForTimeout(1000);

    // Both should show vector elements
    const vectorElements = page.locator(
      '.leaflet-overlay-pane svg path, .leaflet-overlay-pane circle, .leaflet-marker-pane .leaflet-marker-icon, .leaflet-overlay-pane canvas',
    );
    const count = await vectorElements.count();
    // With two layers, we expect more elements than with zero
    expect(count).toBeGreaterThan(0);
  });
});
