/**
 * Vector layer type — LithoSphere globe renderer.
 *
 * The per-engine escape hatch predicted by the Vector slice: LithoSphere's
 * 'vector' layerer only draws points and lines and throws on polygon geometry,
 * while its 'clamped' layerer draws polygons (draped on terrain) plus lines and
 * points. So polygon-containing vector layers (and the explicit 'clamped'
 * variant) are routed to LithoSphere's 'clamped' layerer instead of crashing.
 *
 * Remove/toggle/opacity are handled natively by LithoSphere (by layer name) and
 * short-circuit in GlobeRenderer before reaching the registry, so this module
 * only needs add().
 *
 * gctx (lithosphere) = { engine, renderer, layers, clampToGround,
 *                        geojsonHasPolygons }
 */
function make(layerConfig, gctx) {
    let lithoType = 'vector'
    if (gctx.clampToGround || gctx.geojsonHasPolygons(layerConfig?.geojson)) {
        lithoType = 'clamped'
    }
    return gctx.renderer.addLayer(lithoType, layerConfig)
}

export default {
    make,
}
