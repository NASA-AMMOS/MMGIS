/**
 * Vector layer type — LithoSphere globe renderer.
 *
 * `make` receives the layer's normal MMGIS config object, builds the globe layer
 * config from the map layer's GeoJSON (shared with the Cesium module) and picks
 * the LithoSphere layerer:
 *
 * The per-engine escape hatch predicted by the Vector slice: LithoSphere's
 * 'vector' layerer only draws points and lines and throws on polygon geometry,
 * while its 'clamped' layerer draws polygons (draped on terrain) plus lines and
 * points. So polygon-containing vector layers (and the default 'clamped'
 * variant) are routed to LithoSphere's 'clamped' layerer instead of crashing.
 *
 * Remove/toggle/opacity are handled natively by LithoSphere (by layer name) and
 * short-circuit in GlobeRenderer before reaching the registry, so this module
 * only needs make/render.
 *
 * gctx (lithosphere) = { engine, renderer, layers, clampToGround,
 *                        geojsonHasPolygons }
 */
import { isClamped, toGlobeConfig } from '../config'

function make(layerObj, gctx) {
    const layerConfig = toGlobeConfig(layerObj)
    if (layerConfig == null) return
    return render(layerConfig, { ...gctx, clampToGround: isClamped(layerObj) })
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    let lithoType = 'vector'
    if (gctx.clampToGround || gctx.geojsonHasPolygons(layerConfig?.geojson)) {
        lithoType = 'clamped'
    }
    return gctx.renderer.addLayer(lithoType, layerConfig)
}

export default {
    make,
    render,
}
