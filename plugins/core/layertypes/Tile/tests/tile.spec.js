/**
 * Per-plugin parity coverage for the Tile layer type.
 *
 * Colocated with the plugin and discovered by the root Playwright config
 * (testMatch includes `plugins/**\/tests/*.spec.js`). Verifies that the Tile
 * renderer — now dispatched through LayerTypeRegistry and the MapRenderer
 * middleware — renders and lifecycles identically to the pre-plugin behavior on
 * the Reference Mission (parity-with-today is the spec).
 */
import { test, expect } from '@playwright/test'
import {
    waitForMapReady,
    waitForTilesLoaded,
} from '../../../../../tests/helpers/map-helpers.js'
import { LayersPanelPage } from '../../../../../tests/pages/LayersPanelPage.js'
import { MISSION_MSV } from '../../../../../tests/fixtures/mission-config.js'

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`
const TILE_LAYER = 'ArcGIS World Imagery'

test.describe('Tile layer type (plugin)', () => {
    let layersPanel

    test.beforeEach(async ({ page }) => {
        layersPanel = new LayersPanelPage(page)
        await page.goto(MISSION_URL)
        await waitForMapReady(page)
        await waitForTilesLoaded(page)
    })

    test('map: URL-based tiles load through the MapRenderer plugin path', async ({
        page,
    }) => {
        const arcgisTiles = page.locator(
            '.leaflet-tile-pane img[src*="arcgisonline.com"]'
        )
        await expect(arcgisTiles.first()).toBeVisible({ timeout: 15000 })
        expect(await arcgisTiles.count()).toBeGreaterThan(0)

        const firstSrc = await arcgisTiles.first().getAttribute('src')
        expect(firstSrc).toContain(
            'server.arcgisonline.com/ArcGIS/rest/services/World_Imagery'
        )
    })

    test('map: toggle exercises registry make/remove (Leaflet layer added and removed)', async ({
        page,
    }) => {
        // Resolve the internal layer key + confirm a Leaflet layer is registered.
        const keyForName = async () =>
            page.evaluate((name) => {
                const data = window.L_?.layers?.data || {}
                for (const key of Object.keys(data)) {
                    if (
                        data[key]?.display_name === name ||
                        data[key]?.name === name
                    )
                        return data[key].name
                }
                return null
            }, TILE_LAYER)

        const hasLeafletLayer = async (key) =>
            page.evaluate(
                (k) => !!window.L_?.layers?.layer?.[k],
                key
            )

        const key = await keyForName()
        expect(key).toBeTruthy()
        expect(await hasLeafletLayer(key)).toBeTruthy()

        // Toggle off → plugin.remove() runs through the registry.
        await layersPanel.toggleLayer(TILE_LAYER)
        await page.waitForTimeout(500)
        expect(await layersPanel.isLayerOn(TILE_LAYER)).toBeFalsy()

        // Toggle back on → plugin.make() runs through the registry + MapRenderer.
        await layersPanel.toggleLayer(TILE_LAYER)
        await page.waitForTimeout(1500)
        expect(await layersPanel.isLayerOn(TILE_LAYER)).toBeTruthy()
        expect(await hasLeafletLayer(key)).toBeTruthy()

        const arcgisTiles = page.locator(
            '.leaflet-tile-pane img[src*="arcgisonline.com"]'
        )
        await expect(arcgisTiles.first()).toBeVisible({ timeout: 15000 })
    })
})
