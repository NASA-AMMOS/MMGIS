/**
 * Page Object Model for the MMGIS toolbar.
 *
 * Provides helpers for opening, closing, and inspecting tools in the
 * left-hand toolbar.
 */
export class ToolbarPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;

    /** Locator for the toolbar container. */
    this.toolbar = page.locator('#toolbar, [class*="Toolbar"]').first();
  }

  // ---------------------------------------------------------------------------
  // Tool interactions
  // ---------------------------------------------------------------------------

  /**
   * Open (activate) a tool by clicking its toolbar button.
   *
   * @param {string} name - Tool name (matched via title or text content).
   */
  async openTool(name) {
    // MMGIS toolbar buttons use id="toolButton{Name}" — no title attributes
    const btn = this.page.locator(
      `#toolButton${name}, #toolButtonSeparated_${name}`,
    ).first();
    await btn.click();

    // Allow panel animation / content to settle
    await this.page.waitForTimeout(300);
  }

  /**
   * Close (deactivate) a tool.
   *
   * Clicks the same toolbar button again to toggle the tool off, or
   * clicks a dedicated close button inside the tool panel.
   *
   * @param {string} name - Tool name.
   */
  async closeTool(name) {
    // First try a dedicated close button within the tool's panel
    const closeBtn = this.page.locator(
      `[class*="${name}"] [class*="close"], [class*="${name}"] button[aria-label="close"]`,
    ).first();

    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Toggle the toolbar button again
      const btn = this.page.locator(
        `#toolButton${name}, #toolButtonSeparated_${name}`,
      ).first();
      await btn.click();
    }

    await this.page.waitForTimeout(300);
  }

  /**
   * Check whether a tool is currently open (its panel is visible).
   *
   * @param {string}  name - Tool name.
   * @returns {Promise<boolean>}
   */
  async isToolOpen(name) {
    // A tool is considered "open" when its toolbar button has an active class
    // or when the corresponding panel/container is visible in the DOM.
    const isActive = await this.page.evaluate((toolName) => {
      // MMGIS uses #toolButton{Name} for toolbar button containers
      const btn = document.querySelector(`#toolButton${toolName}`) ||
                  document.querySelector(`#toolButtonSeparated_${toolName}`);
      if (btn) {
        if (
          btn.classList.contains('active') ||
          btn.classList.contains('toolButtonActive') ||
          btn.getAttribute('aria-pressed') === 'true'
        ) {
          return true;
        }
      }
      return false;
    }, name);

    if (isActive) return true;

    // Fallback: check if the tool panel container is visible
    const panel = this.page.locator(
      `[class*="${name}Tool"], [class*="${name.toLowerCase()}"]`,
    ).first();
    return panel.isVisible({ timeout: 500 }).catch(() => false);
  }
}
