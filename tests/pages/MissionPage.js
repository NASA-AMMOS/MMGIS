/**
 * Page Object Model for the main MMGIS map view.
 *
 * Provides helpers for navigating to a mission, waiting for the Leaflet map
 * to initialise, querying map state (center, zoom, visible layers), and
 * performing basic map interactions (click, pan).
 */
export class MissionPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;

    /** Locator for the Leaflet map container. */
    this.mapContainer = page.locator('#map');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Navigate to the mission landing page.
   *
   * @param {string} [mission='Reference-Mission'] - Mission name query param.
   */
  async goto(mission = 'Reference-Mission') {
    await this.page.goto(`/?mission=${mission}`);
  }

  // ---------------------------------------------------------------------------
  // Readiness helpers
  // ---------------------------------------------------------------------------

  /**
   * Wait until the map is fully ready:
   *  1. Network is idle (no outstanding requests).
   *  2. `window.mmgisAPI.map` exists (Leaflet map initialised).
   *
   * @param {object}  [options]
   * @param {number}  [options.timeout=60000] - Maximum wait time in ms.
   */
  async waitForMapReady({ timeout = 60000 } = {}) {
    await this.page.waitForLoadState('networkidle', { timeout });
    await this.page.waitForFunction(
      () => !!(window.mmgisAPI && window.mmgisAPI.map),
      { timeout },
    );
  }

  // ---------------------------------------------------------------------------
  // Map state queries
  // ---------------------------------------------------------------------------

  /**
   * Return the current map centre as `{ lat, lng }`.
   *
   * @returns {Promise<{ lat: number, lng: number }>}
   */
  async getMapCenter() {
    return this.page.evaluate(() => {
      const center = window.mmgisAPI.map.getCenter();
      return { lat: center.lat, lng: center.lng };
    });
  }

  /**
   * Return the current map zoom level.
   *
   * @returns {Promise<number>}
   */
  async getMapZoom() {
    return this.page.evaluate(() => window.mmgisAPI.map.getZoom());
  }

  /**
   * Return the names of all layers currently visible on the map.
   * Attempts `mmgisAPI` first; falls back to DOM inspection.
   *
   * @returns {Promise<string[]>}
   */
  async getVisibleLayers() {
    return this.page.evaluate(() => {
      // Prefer the API when available
      if (window.mmgisAPI && typeof window.mmgisAPI.getVisibleLayers === 'function') {
        return window.mmgisAPI.getVisibleLayers().map((l) => l.name || l);
      }

      // Fallback: inspect the Layers panel DOM for checked items
      const items = document.querySelectorAll(
        '.LayersTool .layer-name.checked, .LayersTool input[type="checkbox"]:checked',
      );
      return Array.from(items).map((el) => el.textContent?.trim() || '');
    });
  }

  // ---------------------------------------------------------------------------
  // Toolbar / Tool helpers
  // ---------------------------------------------------------------------------

  /**
   * Open a tool by clicking its toolbar button.
   *
   * @param {string} name - Tool name (matched via `[title*="${name}"]`).
   */
  async openTool(name) {
    const toolBtn = this.page.locator(`[title*="${name}"]`).first();
    await toolBtn.click();
  }

  /**
   * Check whether a tool button is present in the DOM.
   *
   * @param {string} name - Tool name.
   * @returns {Promise<boolean>}
   */
  async isToolVisible(name) {
    const count = await this.page.locator(`[title*="${name}"]`).count();
    return count > 0;
  }

  // ---------------------------------------------------------------------------
  // Map interactions
  // ---------------------------------------------------------------------------

  /**
   * Click at the given pixel coordinates on the map container.
   *
   * @param {number} x - X pixel offset relative to the map element.
   * @param {number} y - Y pixel offset relative to the map element.
   */
  async clickOnMap(x, y) {
    await this.mapContainer.click({ position: { x, y } });
  }

  /**
   * Pan the map by simulating a drag gesture.
   *
   * @param {number} dx - Horizontal pixel distance to drag.
   * @param {number} dy - Vertical pixel distance to drag.
   */
  async panMap(dx, dy) {
    const box = await this.mapContainer.boundingBox();
    if (!box) throw new Error('Map container not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + dx, startY + dy, { steps: 10 });
    await this.page.mouse.up();
  }
}
