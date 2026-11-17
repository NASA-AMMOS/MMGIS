/**
 * Page Object Model for the MMGIS /configure admin interface.
 *
 * Provides helpers for navigating to the configure panel, creating and
 * deleting missions, and switching between configuration tabs.
 */
export class ConfigurePage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Navigate to the /configure admin page.
   */
  async goto() {
    await this.page.goto('/configure');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------------------------------------------------------------------------
  // Mission management
  // ---------------------------------------------------------------------------

  /**
   * Create a new mission via the configure UI.
   *
   * @param {string} name - Name for the new mission.
   */
  async createMission(name) {
    // Click the "New Mission" / add button
    const newBtn = this.page.locator('button, [class*="new"], [class*="add"]')
      .filter({ hasText: /new|add|create/i })
      .first();
    await newBtn.click();

    // Fill in the mission name
    const nameInput = this.page.locator('input[placeholder*="mission" i], input[name*="mission" i]').first();
    await nameInput.fill(name);

    // Submit / confirm
    const submitBtn = this.page.locator('button')
      .filter({ hasText: /create|save|ok|submit/i })
      .first();
    await submitBtn.click();

    // Wait for navigation or confirmation
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete a mission by name via the configure UI.
   *
   * @param {string} name - Name of the mission to delete.
   */
  async deleteMission(name) {
    // Locate the mission entry in the sidebar / list
    const missionEntry = this.page.locator(`text="${name}"`).first();
    await missionEntry.click();

    // Click the delete action
    const deleteBtn = this.page.locator('button, [class*="delete"]')
      .filter({ hasText: /delete|remove/i })
      .first();
    await deleteBtn.click();

    // Confirm the deletion dialog if present
    const confirmBtn = this.page.locator('button')
      .filter({ hasText: /confirm|yes|ok|delete/i })
      .first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  // ---------------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------------

  /**
   * Open a specific configuration tab by name.
   *
   * @param {string} name - Tab label (e.g. "Layers", "Tools", "Look").
   */
  async openTab(name) {
    const tab = this.page.locator(`[role="tab"], .tab, [class*="tab"]`)
      .filter({ hasText: new RegExp(name, 'i') })
      .first();
    await tab.click();
    await this.page.waitForLoadState('networkidle');
  }
}
