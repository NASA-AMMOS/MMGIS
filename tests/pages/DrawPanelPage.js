/**
 * Page Object Model for the Draw tool panel in MMGIS.
 *
 * Provides helpers for creating draw files, selecting files, and drawing
 * point, line, and polygon features on the map.
 */
export class DrawPanelPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright Page instance.
   */
  constructor(page) {
    /** @type {import('@playwright/test').Page} */
    this.page = page;

    /** Locator for the Draw panel root element. */
    this.panel = page.locator('[class*="DrawTool"], #drawTool').first();

    /** Locator for the map container (used for drawing interactions). */
    this.mapContainer = page.locator('#map');
  }

  // ---------------------------------------------------------------------------
  // File management
  // ---------------------------------------------------------------------------

  /**
   * Create a new draw file.
   *
   * @param {string} name - Name for the new file.
   */
  async createFile(name) {
    const newBtn = this.panel
      .locator('button, [class*="new"], [class*="add"]')
      .filter({ hasText: /new|add|create/i })
      .first();
    await newBtn.click();

    const nameInput = this.panel
      .locator('input[placeholder*="name" i], input[type="text"]')
      .first();
    await nameInput.fill(name);

    const confirmBtn = this.panel
      .locator('button')
      .filter({ hasText: /create|save|ok|submit/i })
      .first();
    await confirmBtn.click();

    await this.page.waitForTimeout(500);
  }

  /**
   * Select an existing draw file from the file list.
   *
   * @param {string} name - File name to select.
   */
  async selectFile(name) {
    const file = this.panel
      .locator(`[class*="file"], li, option`)
      .filter({ hasText: name })
      .first();
    await file.click();

    await this.page.waitForTimeout(300);
  }

  // ---------------------------------------------------------------------------
  // Drawing features
  // ---------------------------------------------------------------------------

  /**
   * Draw a point feature at the given pixel coordinates on the map.
   *
   * @param {number} x - X pixel offset on the map.
   * @param {number} y - Y pixel offset on the map.
   */
  async drawPoint(x, y) {
    // Activate the point drawing mode
    const pointBtn = this.panel
      .locator('button, [class*="point"], [class*="marker"]')
      .filter({ hasText: /point|marker/i })
      .first();
    await pointBtn.click();

    // Click on the map at the specified coordinates
    await this.mapContainer.click({ position: { x, y } });
    await this.page.waitForTimeout(300);
  }

  /**
   * Draw a line feature through a series of pixel coordinate points.
   *
   * @param {Array<[number, number]>} points - Array of [x, y] pixel
   *   coordinate pairs.
   */
  async drawLine(points) {
    if (points.length < 2) {
      throw new Error('A line requires at least 2 points');
    }

    // Activate line drawing mode
    const lineBtn = this.panel
      .locator('button, [class*="line"], [class*="polyline"]')
      .filter({ hasText: /line|polyline/i })
      .first();
    await lineBtn.click();

    // Click each point on the map
    for (const [x, y] of points) {
      await this.mapContainer.click({ position: { x, y } });
      await this.page.waitForTimeout(150);
    }

    // Double-click the last point to finish
    const [lastX, lastY] = points[points.length - 1];
    await this.mapContainer.dblclick({ position: { x: lastX, y: lastY } });
    await this.page.waitForTimeout(300);
  }

  /**
   * Draw a polygon feature through a series of pixel coordinate points.
   * The polygon is auto-closed by double-clicking the last vertex.
   *
   * @param {Array<[number, number]>} points - Array of [x, y] pixel
   *   coordinate pairs (minimum 3).
   */
  async drawPolygon(points) {
    if (points.length < 3) {
      throw new Error('A polygon requires at least 3 points');
    }

    // Activate polygon drawing mode
    const polyBtn = this.panel
      .locator('button, [class*="polygon"]')
      .filter({ hasText: /polygon|area/i })
      .first();
    await polyBtn.click();

    // Click each vertex
    for (const [x, y] of points) {
      await this.mapContainer.click({ position: { x, y } });
      await this.page.waitForTimeout(150);
    }

    // Close the polygon by double-clicking the last point
    const [lastX, lastY] = points[points.length - 1];
    await this.mapContainer.dblclick({ position: { x: lastX, y: lastY } });
    await this.page.waitForTimeout(300);
  }

  // ---------------------------------------------------------------------------
  // Feature management
  // ---------------------------------------------------------------------------

  /**
   * Delete the currently selected feature.
   */
  async deleteFeature() {
    const deleteBtn = this.panel
      .locator('button, [class*="delete"], [class*="remove"]')
      .filter({ hasText: /delete|remove|trash/i })
      .first();
    await deleteBtn.click();

    // Confirm deletion if a dialog appears
    const confirmBtn = this.page
      .locator('button')
      .filter({ hasText: /confirm|yes|ok|delete/i })
      .first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await this.page.waitForTimeout(300);
  }
}
