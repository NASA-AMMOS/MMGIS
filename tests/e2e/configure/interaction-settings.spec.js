import { test, expect } from '@playwright/test';

/**
 * E2E test for an interaction's settings form.
 *
 * An interaction manifest may declare `config.rows`, which Configure renders
 * with Maker on that interaction's card in a layer's Interactions tab, writing
 * beneath the manifest's `configPath`. No core interaction has per-layer
 * settings, so the surface is exercised here with a fixture interaction served
 * in place of the generated registry — the registry is a static JSON file, so
 * a plugin does not have to be installed to stand in for one.
 *
 * The reopen at the end is the regression that matters: closing a layer modal
 * rebuilds the layer from the fields its layer type's tabs declare, which
 * silently dropped settings that come from an interaction's manifest instead.
 */

const FIXTURE = {
  FixtureSonify: {
    name: 'Fixture Sonify',
    type: 'interaction',
    interactionId: 'fixture:sonify',
    description: 'Fixture interaction used to exercise interaction settings.',
    applicableLayerTypes: ['vector', 'vectortile', 'query'],
    applicableEvents: ['click'],
    phase: 'main',
    configPath: 'variables.interactions.fixtureSonify',
    config: {
      rows: [
        {
          components: [
            {
              type: 'text',
              field: 'variables.interactions.fixtureSonify.property',
              name: 'Sonified Property',
              width: 6,
            },
            {
              type: 'number',
              field: 'variables.interactions.fixtureSonify.hz',
              name: 'Base Hz',
              width: 3,
              default: 440,
            },
          ],
        },
      ],
    },
  },
};

test.describe('Configure CMS — interaction settings', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
  const LAYER = 'Points Basic';

  /**
   * Serve the interaction registry with the fixture interaction added, so the
   * page sees it exactly as it would a plugin's manifest.
   */
  async function serveFixtureInteraction(page) {
    await page.route('**/configure/public/interactionConfigs.json', async (route) => {
      const response = await route.fetch();
      let registry = {};
      try {
        registry = JSON.parse(await response.text());
      } catch {
        /* an empty registry is still enough for the fixture */
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ...registry, ...FIXTURE }),
      });
    });
  }

  async function openLayersTab(page) {
    await page.request.post(`${baseURL}/api/users/login`, {
      data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
    });

    await page.goto('/configure');
    await page.waitForLoadState('networkidle');

    const mission = page.locator('text="Reference-Mission"').first();
    if (!(await mission.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'SKIP: Reference-Mission not visible (auth or missing mission)');
      return false;
    }
    await mission.click();

    await page.getByRole('tab', { name: /^Layers$/i }).click();
    return true;
  }

  async function openInteractionsTab(page) {
    // Forced past the hover-only "add layer here" control, which overlaps the
    // row it would insert above.
    await page.locator(`text="${LAYER}"`).first().click({ force: true });
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: /^Interactions$/i }).click();
    return modal;
  }

  test('an interaction with config.rows is configured on its own card', async ({ page }) => {
    await serveFixtureInteraction(page);
    if (!(await openLayersTab(page))) return;

    let modal = await openInteractionsTab(page);

    // Only a custom pipeline can be added to, and the fixture is not in any
    // Kind preset.
    await modal.getByRole('button', { name: /Customize pipeline/i }).click();
    await modal.getByLabel('Add interaction').fill('Fixture Sonify');
    await page.getByRole('option', { name: /Fixture Sonify/ }).click();
    await modal.getByRole('button', { name: /^Add$/i }).click();

    // The card carries the settings, and nothing else does: an interaction
    // without a `configPath` has no form.
    const settings = modal.getByRole('button', {
      name: /Show Fixture Sonify settings/i,
    });
    await expect(settings).toBeVisible();
    await expect(
      modal.getByRole('button', { name: /Select settings/i }),
    ).toHaveCount(0);

    // The rows are Maker's, rendered from the manifest.
    await settings.click();
    await expect(modal.getByLabel('Sonified Property')).toBeVisible();
    await modal.getByLabel('Sonified Property').fill('elevation');
    await modal.getByLabel('Base Hz').fill('523');

    // Closing the modal trims a layer to the fields its tabs declare — an
    // interaction's settings are declared by the interaction instead.
    await page.getByRole('button', { name: /^Done$/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    modal = await openInteractionsTab(page);
    await modal.getByRole('button', { name: /Show Fixture Sonify settings/i }).click();
    await expect(modal.getByLabel('Sonified Property')).toHaveValue('elevation');
    await expect(modal.getByLabel('Base Hz')).toHaveValue('523');
  });
});
