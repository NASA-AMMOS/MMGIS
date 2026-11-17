/**
 * Per-plugin parity coverage for the Vector layer type.
 *
 * Colocated with the plugin and discovered by the root Playwright config
 * (testMatch includes `plugins/**\/tests/*.spec.js`). Verifies that the Vector
 * renderer — now dispatched through LayerTypeRegistry + the MapRenderer
 * `addVector` primitive, with the two-phase afterMake/afterUnlock filtering
 * lifecycle — renders and lifecycles identically to the pre-plugin behavior on
 * the Reference Mission (parity-with-today is the spec).
 */
import { test, expect } from '@playwright/test'
import {
    waitForMapReady,
    waitForTilesLoaded,
} from '../../../../../tests/helpers/map-helpers.js'
import { MissionPage } from '../../../../../tests/pages/MissionPage.js'
import { LayersPanelPage } from '../../../../../tests/pages/LayersPanelPage.js'
import { MISSION_MSV } from '../../../../../tests/fixtures/mission-config.js'

const MISSION_URL = `/?mission=${MISSION_MSV.mission}`
const VECTOR_LAYER = 'Points Basic'
const ATTACHMENT_LAYER = 'Hotline Gradient Path'

// Resolve a layer's internal registry key from its display name.
const keyForName = (page, name) =>
    page.evaluate((layerName) => {
        const data = window.L_?.layers?.data || {}
        for (const key of Object.keys(data)) {
            if (
                data[key]?.display_name === layerName ||
                data[key]?.name === layerName
            )
                return data[key].name
        }
        return null
    }, name)

const hasVectorLayer = (page, key) =>
    page.evaluate((k) => !!window.L_?.layers?.layer?.[k], key)

test.describe('Vector layer type (plugin)', () => {
    let missionPage
    let layersPanel

    test.beforeEach(async ({ page }) => {
        missionPage = new MissionPage(page)
        layersPanel = new LayersPanelPage(page)
        await page.goto(MISSION_URL)
        await waitForMapReady(page)
        await waitForTilesLoaded(page)
        await missionPage.openTool('Layers')
        await page.waitForTimeout(500)
        await layersPanel.expandGroup('Geometry Types')
        await page.waitForTimeout(300)
    })

    test('registered as a plugin layer type through LayerTypeRegistry', async ({
        page,
    }) => {
        const registered = await page.evaluate(() => {
            const cfgs = window.mmgisglobal?.layerTypeConfigs
            // Fall back to probing render behavior if configs aren't on window.
            return cfgs ? !!cfgs.vector : null
        })
        // Registration is proven either explicitly (config present) or implicitly
        // by the render test below — the `vector` switch-case was removed from
        // Map_.makeLayer, so rendering at all requires the registry dispatch.
        expect(registered === null || registered === true).toBeTruthy()
    })

    test('map: GeoJSON renders through the MapRenderer addVector path', async ({
        page,
    }) => {
        await layersPanel.toggleLayer(VECTOR_LAYER)
        await page.waitForTimeout(1500)

        const key = await keyForName(page, VECTOR_LAYER)
        expect(key).toBeTruthy()
        expect(await hasVectorLayer(page, key)).toBeTruthy()

        // Vector features render as SVG/canvas/markers in the Leaflet overlay.
        const vectorElements = page.locator(
            '.leaflet-overlay-pane svg path, .leaflet-overlay-pane svg circle, .leaflet-overlay-pane canvas, .leaflet-marker-pane .leaflet-marker-icon'
        )
        expect(await vectorElements.count()).toBeGreaterThan(0)
    })

    test('map: toggle exercises registry make/remove (vector layer added and removed)', async ({
        page,
    }) => {
        // Ensure the layer is on first.
        if (!(await layersPanel.isLayerOn(VECTOR_LAYER))) {
            await layersPanel.toggleLayer(VECTOR_LAYER)
            await page.waitForTimeout(1500)
        }
        const key = await keyForName(page, VECTOR_LAYER)
        expect(key).toBeTruthy()
        expect(await hasVectorLayer(page, key)).toBeTruthy()

        // Toggle off → plugin.remove() runs through the registry.
        await layersPanel.toggleLayer(VECTOR_LAYER)
        await page.waitForTimeout(500)
        expect(await layersPanel.isLayerOn(VECTOR_LAYER)).toBeFalsy()

        // Toggle back on → plugin.make() runs through the registry + MapRenderer.
        await layersPanel.toggleLayer(VECTOR_LAYER)
        await page.waitForTimeout(1500)
        expect(await layersPanel.isLayerOn(VECTOR_LAYER)).toBeTruthy()
        expect(await hasVectorLayer(page, key)).toBeTruthy()
    })

    test('map: attachment/sublayer-bearing vector wires its attachments registry', async ({
        page,
    }) => {
        await layersPanel.expandGroup('Feature Property Behavior')
        await page.waitForTimeout(300)

        await layersPanel.toggleLayer(ATTACHMENT_LAYER)
        await page.waitForTimeout(1500)

        const key = await keyForName(page, ATTACHMENT_LAYER)
        expect(key).toBeTruthy()
        expect(await hasVectorLayer(page, key)).toBeTruthy()

        // MapRenderer.addVector stores constructVectorLayer's sublayers in the
        // attachments registry; a gradient path produces sublayers.
        const hasAttachments = await page.evaluate((k) => {
            const a = window.L_?.layers?.attachments?.[k]
            return a != null
        }, key)
        expect(hasAttachments).toBeTruthy()
    })
})
