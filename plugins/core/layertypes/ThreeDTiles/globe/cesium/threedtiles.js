/**
 * 3D Tiles layer type — Cesium globe renderer.
 *
 * Owns all Cesium-specific 3D Tiles content: tileset loading (with duplicate
 * guard, height offset, style and opacity), plus per-layer removal/visibility/
 * opacity. GlobeRenderer stays the middleware — it owns the shared `_layers`
 * registry, the in-progress-load bookkeeping (handed in via gctx), and the
 * generic cleanup/render-request around these calls.
 *
 * gctx (cesium) = { engine, renderer, layers, requestRender, loadingLayers, ... }
 */
import * as Cesium from 'cesium'

async function make(layerConfig, gctx) {
    const { renderer, layers, loadingLayers } = gctx
    const { name } = layerConfig

    // Prevent duplicate loads
    if (loadingLayers[name]) return
    loadingLayers[name] = true

    try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(layerConfig.path, {
            maximumScreenSpaceError: layerConfig.maximumScreenSpaceError ?? 16,
            maximumMemoryUsage: layerConfig.maximumMemoryUsage ?? 512,
        })

        delete loadingLayers[name]

        renderer.scene.primitives.add(tileset)

        // Apply height offset if specified
        if (layerConfig.heightOffset) {
            const offset = new Cesium.Cartesian3(0, 0, layerConfig.heightOffset)
            const modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    offset,
                    Cesium.Quaternion.IDENTITY,
                    new Cesium.Cartesian3(1, 1, 1)
                )
            // Apply relative to the tileset's root transform
            tileset.modelMatrix = Cesium.Matrix4.multiply(
                tileset.modelMatrix,
                modelMatrix,
                new Cesium.Matrix4()
            )
        }

        // Apply 3D Tiles styling if specified
        if (layerConfig.style) {
            tileset.style = new Cesium.Cesium3DTileStyle(layerConfig.style)
        }

        // Apply opacity
        if (layerConfig.opacity !== undefined && layerConfig.opacity < 1.0) {
            tileset.style = new Cesium.Cesium3DTileStyle({
                ...(layerConfig.style || {}),
                color: `color("white", ${layerConfig.opacity})`,
            })
        }

        layers[name] = {
            type: '3dtiles',
            tileset: tileset,
            visible: true,
            opacity: layerConfig.opacity ?? 1.0,
            styleConfig: layerConfig.style || null,
        }
    } catch (err) {
        delete loadingLayers[name]
        console.error(`Failed to load 3D Tiles layer "${name}":`, err)
    }
}

// Engine-specific teardown only; GlobeRenderer performs the generic `_layers`
// cleanup and render request.
function destroy(name, gctx) {
    const layerInfo = gctx.layers[name]
    if (layerInfo) gctx.renderer.scene.primitives.remove(layerInfo.tileset)
}

function setVisibility(name, visible, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.tileset.show = visible
    layerInfo.visible = visible
}

function setOpacity(name, opacity, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.opacity = opacity
    // Apply opacity via style color alpha
    const styleObj = layerInfo.styleConfig ? { ...layerInfo.styleConfig } : {}
    if (opacity < 1.0) {
        styleObj.color = `color("white", ${opacity})`
    }
    layerInfo.tileset.style = new Cesium.Cesium3DTileStyle(styleObj)
    gctx.requestRender()
}

export default {
    make,
    destroy,
    setVisibility,
    setOpacity,
}
