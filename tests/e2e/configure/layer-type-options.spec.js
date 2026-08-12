import { test, expect } from '@playwright/test';

/**
 * E2E test for the layer modal's Layer Type control.
 *
 * The control is a row in the *selected* type's own manifest, so listing the
 * types literally there made core the arbiter of which types exist: a plugin
 * type could be authored, validated, activated and registered, and then never
 * be selectable by an admin. The row asks the registry instead
 * (`optionsFrom: "layerTypes"`), which is what this asserts — with a fixture
 * type served in place of the generated registry, since the registry is a
 * static JSON file and a plugin need not be installed to stand in for one.
 */

const FIXTURE_TYPE = 'fixturekind';

test.describe('Configure CMS — layer type options', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const LAYER = 'Points Basic';

  /** Serve the layer type registry with a plugin type added. */
  async function serveFixtureType(page) {
    await page.route('**/configure/public/layerTypeConfigs.json', async (route) => {
      const response = await route.fetch();
      let registry = {};
      try {
        registry = JSON.parse(await response.text());
      } catch {
        /* an empty registry is still enough for the fixture */
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...registry,
          [FIXTURE_TYPE]: {
            manifest: {
              name: 'Fixture Kind',
              type: 'layertype',
              typeId: FIXTURE_TYPE,
              extends: 'vector',
            },
          },
        }),
      });
    });
  }

  test('a registered plugin type is selectable as a layer type', async ({ page }) => {
    await serveFixtureType(page);

    await page.request.post(`${baseURL}/api/users/login`, {
      data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
    });
    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    const mission = page.locator('text="Reference-Mission"').first();
    if (!(await mission.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Reference-Mission not visible (auth or missing mission)');
      return;
    }
    await mission.click();
    await page.getByRole('tab', { name: /^Layers$/i }).click();

    // Forced past the hover-only "add layer here" control, which overlaps the
    // row it would insert above.
    await page.locator(`text="${LAYER}"`).first().click({ force: true });
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    await modal
      .locator('[role="combobox"], [role="button"]')
      .filter({ hasText: /^VECTOR$/i })
      .first()
      .click();
    const options = page.getByRole('option');
    await expect(options.filter({ hasText: /^vector$/i }).first()).toBeVisible();
    await expect(
      options.filter({ hasText: new RegExp(`^${FIXTURE_TYPE}$`, 'i') }).first(),
    ).toBeVisible();
  });
});
