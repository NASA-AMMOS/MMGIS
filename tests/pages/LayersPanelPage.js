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

    /** Locator for the Layers panel root element (rendered inside #toolPanel). */
    this.panel = page.locator('#layersTool, #toolPanel').first();
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
    // MMGIS uses jQuery event handlers for layer checkboxes, which don't fire
    // from Playwright's native click events. Instead, we call L_.toggleLayer()
    // directly via page.evaluate() to toggle the layer's internal state.
    // Wrapped in try/catch because some layers (e.g. with filters) may throw
    // if internal subsystems aren't fully initialised.
    const toggled = await this.page.evaluate(async (layerName) => {
      const data = window.L_?.layers?.data;
      if (!data) return false;
      for (const key of Object.keys(data)) {
        if (
          data[key]?.display_name === layerName ||
          data[key]?.name === layerName
        ) {
          try {
            await window.L_.toggleLayer(data[key]);
          } catch (e) {
            // Some layers throw during toggle (e.g. updateFilter not initialised)
            // but the layer state may still have been toggled
          }
          return true;
        }
      }
      return false;
    }, name);
    await this.page.waitForTimeout(300);
    return toggled;
  }

  /**
   * Check whether a specific layer is currently turned on (visible).
   *
   * @param {string} name - Layer display name.
   * @returns {Promise<boolean>}
   */
  async isLayerOn(name) {
    // Check the internal L_.layers.on state, which is the source of truth.
    // CSS classes may not update when toggling via L_.toggleLayer().
    return this.page.evaluate((layerName) => {
      const data = window.L_?.layers?.data;
      const on = window.L_?.layers?.on;
      if (!data || !on) return false;
      for (const key of Object.keys(data)) {
        if (
          data[key]?.display_name === layerName ||
          data[key]?.name === layerName
        ) {
          return !!on[key];
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
    // MMGIS uses .layersToolHeader containers with .title children for groups
    const group = this.panel
      .locator('.layersToolHeader, [class*="header"], [class*="group"]')
      .filter({ hasText: name })
      .first();

    const exists = await group.count();
    if (exists === 0) return; // group not found, skip silently

    // Only expand if not already expanded
    const isExpanded = await group.evaluate((el) => {
      return (
        el.classList.contains('expanded') ||
        el.classList.contains('open') ||
        el.classList.contains('on') ||
        el.getAttribute('aria-expanded') === 'true'
      );
    }).catch(() => false);

    if (!isExpanded) {
      await group.click();
      await this.page.waitForTimeout(300);
    }
  }
}
