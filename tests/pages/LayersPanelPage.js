/**
 * Page Object Model for the Layers tool panel in MMGIS.
 *
 * Provides helpers for toggling layer visibility, checking layer state,
 * adjusting opacity, and expanding layer groups.
 */
export class LayersPanelPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;

    /** Locator for the Layers panel root element. */
    this.panel = page.locator('[class*="LayersTool"], #layersTool').first();
  }

  // ---------------------------------------------------------------------------
  // Layer visibility
  // ---------------------------------------------------------------------------

  /**
   * Toggle a layer on or off by clicking its checkbox / visibility control.
   *
   * @param {string} name - Layer display name.
   */
  async toggleLayer(name) {
    // Find the layer row by its name text, then click its checkbox or toggle
    const layerRow = this.panel
      .locator(`[class*="layer"], li, .checkbox-container`)
      .filter({ hasText: name })
      .first();

    const checkbox = layerRow.locator(
      'input[type="checkbox"], [class*="checkbox"], [class*="toggle"], [class*="visibility"]',
    ).first();

    await checkbox.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Check whether a specific layer is currently turned on (visible).
   *
   * @param {string} name - Layer display name.
   * @returns {Promise<boolean>}
   */
  async isLayerOn(name) {
    return this.page.evaluate((layerName) => {
      // Prefer the mmgisAPI if available
      if (window.mmgisAPI && typeof window.mmgisAPI.getVisibleLayers === 'function') {
        const visible = window.mmgisAPI.getVisibleLayers();
        return visible.some((l) => (l.name || l) === layerName);
      }

      // Fallback: inspect checkbox state in DOM
      const rows = document.querySelectorAll(
        '[class*="LayersTool"] [class*="layer"], [class*="LayersTool"] li',
      );
      for (const row of rows) {
        if (row.textContent?.includes(layerName)) {
          const cb = row.querySelector('input[type="checkbox"]');
          if (cb) return cb.checked;
          // Check for an "on" class
          return row.classList.contains('on') || row.classList.contains('checked');
        }
      }
      return false;
    }, name);
  }

  // ---------------------------------------------------------------------------
  // Opacity
  // ---------------------------------------------------------------------------

  /**
   * Set the opacity for a layer via its slider control.
   *
   * @param {string} name  - Layer display name.
   * @param {number} value - Opacity value between 0 and 1.
   */
  async setOpacity(name, value) {
    const layerRow = this.panel
      .locator(`[class*="layer"], li`)
      .filter({ hasText: name })
      .first();

    const slider = layerRow.locator(
      'input[type="range"], [class*="opacity"], [class*="slider"]',
    ).first();

    await slider.fill(String(value));
    await this.page.waitForTimeout(200);
  }

  // ---------------------------------------------------------------------------
  // Layer groups
  // ---------------------------------------------------------------------------

  /**
   * Expand a layer group / header in the layers panel.
   *
   * @param {string} name - Group header display name.
   */
  async expandGroup(name) {
    const group = this.panel
      .locator('[class*="header"], [class*="group"]')
      .filter({ hasText: name })
      .first();

    // Only expand if not already expanded
    const isExpanded = await group.evaluate((el) => {
      return (
        el.classList.contains('expanded') ||
        el.classList.contains('open') ||
        el.getAttribute('aria-expanded') === 'true'
      );
    }).catch(() => false);

    if (!isExpanded) {
      await group.click();
      await this.page.waitForTimeout(300);
    }
  }
}
