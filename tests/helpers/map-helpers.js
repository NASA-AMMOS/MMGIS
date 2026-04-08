/**
 * Map interaction helpers for MMGIS Playwright tests.
 *
 * Standalone functions that operate on a Playwright `Page` instance.
 * They mirror common operations from the MissionPage POM but can be
 * used in any test without instantiating a page object.
 */

/**
 * Wait until the Leaflet map is fully initialised.
 *
 * 1. Waits for `networkidle`.
 * 2. Polls `window.mmgisAPI.map` until it exists.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object}  [options]
 * @param {number}  [options.timeout=60000] - Maximum wait in ms.
 */
export async function waitForMapReady(page, { timeout = 60000 } = {}) {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForFunction(
    () => !!(window.mmgisAPI && window.mmgisAPI.map),
    { timeout },
  );
}

/**
 * Wait for map tile images to finish loading inside `.leaflet-tile-pane`.
 *
 * Polls until every `<img>` element in the tile pane reports `complete`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object}  [options]
 * @param {number}  [options.timeout=30000] - Maximum wait in ms.
 */
export async function waitForTilesLoaded(page, { timeout = 30000 } = {}) {
  await page.waitForFunction(
    () => {
      const pane = document.querySelector('.leaflet-tile-pane');
      if (!pane) return false;
      const imgs = pane.querySelectorAll('img');
      if (imgs.length === 0) return false;
      return Array.from(imgs).every((img) => img.complete);
    },
    { timeout },
  );
}

/**
 * Return the current map centre as `{ lat, lng }`.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function getMapCenter(page) {
  return page.evaluate(() => {
    const center = window.mmgisAPI.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
}

/**
 * Return the current map zoom level.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getMapZoom(page) {
  return page.evaluate(() => window.mmgisAPI.map.getZoom());
}

/**
 * Click at the given pixel coordinates on the `#map` element.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} x - X pixel offset relative to the map element.
 * @param {number} y - Y pixel offset relative to the map element.
 */
export async function clickOnMap(page, x, y) {
  await page.locator('#map').click({ position: { x, y } });
}

/**
 * Pan the map by simulating a mouse drag.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} dx - Horizontal pixel distance.
 * @param {number} dy - Vertical pixel distance.
 */
export async function panMap(page, dx, dy) {
  const map = page.locator('#map');
  const box = await map.boundingBox();
  if (!box) throw new Error('#map element not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
}

/**
 * Return the names of all currently visible layers.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function getVisibleLayers(page) {
  return page.evaluate(() => {
    if (window.mmgisAPI && typeof window.mmgisAPI.getVisibleLayers === 'function') {
      return window.mmgisAPI.getVisibleLayers().map((l) => l.name || l);
    }

    // Fallback: inspect DOM
    const items = document.querySelectorAll(
      '.LayersTool .layer-name.checked, .LayersTool input[type="checkbox"]:checked',
    );
    return Array.from(items).map((el) => el.textContent?.trim() || '');
  });
}
