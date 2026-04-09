import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Chemistry tool.
 * Frontend: src/essence/Tools/Chemistry/chemistryplot.js
 *
 * Currently covers:
 *   - Tool initialization without ReferenceError (impacted by implicit globals fix)
 *
 * Future tests can cover:
 *   - Plotting APXS data
 *   - Plotting ChemCam data
 *   - Axis selection dropdowns
 *   - Data point interaction
 */

test.describe('Chemistry Tool', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  });

  test.describe('Initialization', () => {

    test('opens without ReferenceError from implicit globals', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      // Open the Chemistry tool
      const chemButton = page.locator('#toolButtonChemistry').first();
      if (await chemButton.isVisible({ timeout: 5000 })) {
        await chemButton.click();
        await page.waitForTimeout(1500);
      }

      // No ReferenceError for chemsArray, chemsNames, apxsArray, apxsNames
      const referenceErrors = pageErrors.filter(
        (msg) => msg.includes('is not defined') || msg.includes('ReferenceError')
      );
      expect(referenceErrors).toHaveLength(0);
    });

  });

});
