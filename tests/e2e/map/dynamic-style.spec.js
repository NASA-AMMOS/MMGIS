import { test, expect } from '@playwright/test';
import { waitForMapReady } from '../../helpers/map-helpers.js';
import { MissionPage } from '../../pages/MissionPage.js';
import { LayersPanelPage } from '../../pages/LayersPanelPage.js';
import { MISSION_MSV } from '../../fixtures/mission-config.js';

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`;
const LAYER = 'Dynamic Style';

/**
 * The Reference Mission's "Dynamic Style" layer is a flat GeoJSON - no
 * geodataset - whose fillColor ramps over `depth_m` and whose weight ramps
 * over `confidence`. These tests cover what that is supposed to produce: a
 * spread of colours rather than one, a runtime restyle from the LayersTool
 * that doesn't touch the configuration, and a legend that shows the scale the
 * features are actually drawn with.
 */
test.describe('Dynamic vector styling', () => {
  let missionPage;
  let layersPanel;

  /** Every feature's fill, in layer order. */
  const fills = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('path.dynamicstyle')).map((p) =>
        p.getAttribute('fill'),
      ),
    );

  test.beforeEach(async ({ page, request }) => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
    const listRes = await request.get(`${baseURL}/api/configure/missions`);
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.missions || !listData.missions.includes(MISSION_MSV.mission)) {
      test.skip(true, 'SKIP: Reference-Mission not available in this CI mode');
      return;
    }

    missionPage = new MissionPage(page);
    layersPanel = new LayersPanelPage(page);

    await page.goto(MISSION_URL);
    await waitForMapReady(page);
    await missionPage.openTool('Layers');
    await layersPanel.toggleLayer(LAYER);
    await page.waitForTimeout(1000);

    // The runtime controls are built when a layer's settings are opened, from
    // the features it holds at that moment.
    await page.evaluate((name) => {
      const li = Array.from(
        document.querySelectorAll('#layersToolList > li'),
      ).find((el) => {
        const key = el.getAttribute('name');
        const data = window.L_.layers.data[key];
        return data?.display_name === name || data?.name === name;
      });
      li?.querySelector('.gears')?.click();
    }, LAYER);
    await page.waitForTimeout(500);
  });

  test('features are coloured by their data, not by one configured colour', async ({ page }) => {
    const colors = await fills(page);
    expect(colors.length).toBeGreaterThan(1);
    expect(new Set(colors).size).toBeGreaterThan(1);

    // The configured fillColor is what a feature would get with no rule.
    expect(colors.every((c) => c === '#888888')).toBeFalsy();
  });

  test('a feature missing the property gets the rule\'s null colour', async ({ page }) => {
    const colors = await fills(page);
    expect(colors).toContain('#666666');
  });

  test('weight comes from a second rule over a different property', async ({ page }) => {
    const weights = await page.evaluate(() =>
      Array.from(document.querySelectorAll('path.dynamicstyle')).map((p) =>
        parseFloat(p.getAttribute('stroke-width')),
      ),
    );
    expect(new Set(weights).size).toBeGreaterThan(1);
    for (const w of weights) {
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(6);
    }
  });

  test('switching the ramp in the LayersTool repaints without changing the configuration', async ({ page }) => {
    const before = await fills(page);

    // The ramp is chosen from rendered gradients, so there is nothing to type:
    // open the picker and take a different swatch.
    const picker = page.locator('.dynamicStyleRampMount button');
    await picker.first().click();
    await page.waitForTimeout(200);
    await picker.nth(3).click();
    await page.waitForTimeout(500);

    const after = await fills(page);
    expect(after).not.toEqual(before);

    // Session-only: the mission's configured rule is untouched.
    const configuredRamp = await page.evaluate((name) => {
      const data = window.L_.layers.data;
      const key = Object.keys(data).find(
        (k) => data[k]?.display_name === name || data[k]?.name === name,
      );
      return data[key]?.variables?.dynamicStyle?.rules?.[0]?.ramp;
    }, LAYER);
    expect(configuredRamp).toBe('viridis');
  });

  test('binning the scale collapses the colours into that many groups', async ({ page }) => {
    await page.locator('.dynamicStyleBins').fill('2');
    await page.waitForTimeout(500);

    const colors = await fills(page);
    // Two bins, plus the null colour for the feature with no value.
    expect(new Set(colors).size).toBeLessThanOrEqual(3);
  });

  test('dragging a bin boundary re-splits the scale without changing the colours', async ({ page }) => {
    await page.locator('.dynamicStyleBins').fill('2');
    await page.waitForTimeout(500);
    const before = await fills(page);

    const bar = page.locator('.dynamicStyleStopBar');
    const stop = page.locator('.dynamicStyleStop').first();
    const box = await bar.boundingBox();
    const stopBox = await stop.boundingBox();
    await page.mouse.move(stopBox.x + stopBox.width / 2, stopBox.y + stopBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, stopBox.y + stopBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const after = await fills(page);
    // A wider first bin swallows features the second one had; the palette is
    // the same two colours either way.
    expect(after).not.toEqual(before);
    expect(new Set(after.concat(before)).size).toEqual(new Set(before).size);
  });

  test('the legend shows the scale the features are drawn with', async ({ page }) => {
    await missionPage.openTool('Legend');
    await page.waitForTimeout(1000);

    const legend = page.locator('#legendTool, #toolPanel').first();
    await expect(legend).toContainText('Dynamic Style');
    await expect(legend).toContainText('depth_m');
  });
});
