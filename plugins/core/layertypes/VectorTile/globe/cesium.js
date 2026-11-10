/**
 * VectorTile layer type — Cesium globe renderer.
 *
 * Owns all Cesium-specific vector-tile content: extruded layers become 3D
 * primitives via CesiumMVTLayer, flat ones become imagery painted from the
 * tiles (./imagery), plus per-layer removal/visibility/opacity. GlobeRenderer
 * stays the middleware — it owns the shared `_layers` registry and the generic
 * cleanup/render-request around these calls, and dispatches here through
 * LayerTypeRegistry. Imagery entries carry `kind: 'imagery'`, so GlobeRenderer
 * orders them with the other raster layers.
 *
 * gctx (cesium) = { engine, renderer, layers, requestRender, utils, ... }
 */
import * as Cesium from 'cesium'
import CesiumMVTLayer from '@basics/Globe_/CesiumMVTLayer'
import { makeVectorTileImageryProvider } from './imagery'
import { makeWith, onToggle } from './layerConfig'

function make(layerObj, gctx) {
    return makeWith(layerObj, gctx, render)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    if (layerConfig.extruded) renderExtruded(layerConfig, gctx)
    else renderImagery(layerConfig, gctx)
}

function renderExtruded(layerConfig, gctx) {
    const { renderer, layers } = gctx

    const mvtLayer = new CesiumMVTLayer(renderer, {
        name: layerConfig.name,
        url: layerConfig.path,
        vtLayer: layerConfig.vtLayer,
        extrudeHeightProperty: layerConfig.extrudeHeightProperty,
        extrudeDefaultHeight: layerConfig.extrudeDefaultHeight,
        extrudeBaseProperty: layerConfig.extrudeBaseProperty,
        extrudeColor: layerConfig.extrudeColor,
        extrudeOpacity: layerConfig.extrudeOpacity,
        resolveStyle: layerConfig.resolveStyle,
        minZoom: layerConfig.minZoom,
        maxZoom: layerConfig.maxZoom,
        opacity: layerConfig.opacity,
    })

    layers[layerConfig.name] = {
        type: 'vectortile',
        kind: 'mvt',
        mvtLayer: mvtLayer,
        visible: true,
        styleSignature: layerConfig.styleSignature,
        restyle: () => mvtLayer.restyle(),
    }
}

function imageryProviderFor(layerConfig) {
    return makeVectorTileImageryProvider(layerConfig.layerObj, {
        url: layerConfig.path,
        minZoom: layerConfig.minZoom,
        maxZoom: layerConfig.maxZoom,
    })
}

function renderImagery(layerConfig, gctx) {
    const { renderer, layers } = gctx
    const { name } = layerConfig

    const layer = renderer.imageryLayers.addImageryProvider(
        imageryProviderFor(layerConfig),
        gctx.utils.calculateImageryIndex(name, layerConfig.order)
    )
    layer.alpha = layerConfig.opacity !== undefined ? layerConfig.opacity : 1.0

    const layerInfo = {
        type: 'vectortile',
        kind: 'imagery',
        layer: layer,
        visible: true,
        order: layerConfig.order,
        styleSignature: layerConfig.styleSignature,
        // Tiles are painted once, so a new style means new tiles: swap in a
        // fresh provider where the old one was.
        restyle: () => {
            const old = layerInfo.layer
            const index = renderer.imageryLayers.indexOf(old)
            const next = new Cesium.ImageryLayer(
                imageryProviderFor(layerConfig),
                { alpha: old.alpha, show: old.show }
            )
            if (index >= 0) {
                renderer.imageryLayers.remove(old)
                renderer.imageryLayers.add(next, index)
            }
            layerInfo.layer = next
            gctx.requestRender()
        },
    }
    layers[name] = layerInfo
    gctx.requestRender()
}

// Engine-specific teardown only; GlobeRenderer performs the generic `_layers`
// cleanup and render request.
function destroy(name, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    if (layerInfo.kind === 'imagery')
        gctx.renderer.imageryLayers.remove(layerInfo.layer)
    else layerInfo.mvtLayer.destroy()
}

// Imagery is re-added at its ordered position when turned back on, since
// Cesium drops removed imagery from the collection.
function setVisibility(name, visible, gctx) {
    const { renderer } = gctx
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return

    if (layerInfo.kind !== 'imagery') layerInfo.mvtLayer.setVisible(visible)
    else if (visible && !layerInfo.visible) {
        if (renderer.imageryLayers.contains(layerInfo.layer))
            renderer.imageryLayers.remove(layerInfo.layer, false)
        const index = gctx.utils.calculateImageryIndex(name, layerInfo.order)
        renderer.imageryLayers.add(layerInfo.layer, index)
    } else if (!visible && layerInfo.visible)
        renderer.imageryLayers.remove(layerInfo.layer, false)

    layerInfo.visible = visible
}

function setOpacity(name, opacity, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    if (layerInfo.kind === 'imagery') layerInfo.layer.alpha = opacity
    else layerInfo.mvtLayer.setOpacity(opacity)
    gctx.requestRender()
}

export default {
    make,
    onToggle,
    render,
    destroy,
    setVisibility,
    setOpacity,
}
