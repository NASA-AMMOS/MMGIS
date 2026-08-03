/**
 * VectorTile layer type — Cesium globe renderer.
 *
 * Owns all Cesium-specific vector-tile content: MVT layer construction (with
 * optional 3D building extrusion) via CesiumMVTLayer, plus per-layer
 * removal/visibility/opacity. GlobeRenderer stays the middleware — it owns the
 * shared `_layers` registry and the generic cleanup/render-request around these
 * calls, and dispatches here through LayerTypeRegistry.
 *
 * gctx (cesium) = { engine, renderer, layers, requestRender, ... }
 */
import CesiumMVTLayer from '@basics/Globe_/CesiumMVTLayer'
import { makeWith, onToggle } from '../config'

function make(layerObj, gctx) {
    return makeWith(layerObj, gctx, render)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
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
        minZoom: layerConfig.minZoom,
        maxZoom: layerConfig.maxZoom,
        opacity: layerConfig.opacity,
    })

    layers[layerConfig.name] = {
        type: 'vectortile',
        mvtLayer: mvtLayer,
        visible: true,
    }
}

// Engine-specific teardown only; GlobeRenderer performs the generic `_layers`
// cleanup and render request.
function destroy(name, gctx) {
    const layerInfo = gctx.layers[name]
    if (layerInfo) layerInfo.mvtLayer.destroy()
}

function setVisibility(name, visible, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.mvtLayer.setVisible(visible)
    layerInfo.visible = visible
}

function setOpacity(name, opacity, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.mvtLayer.setOpacity(opacity)
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
