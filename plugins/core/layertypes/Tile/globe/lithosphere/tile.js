/**
 * Tile layer type — LithoSphere globe renderer.
 *
 * LithoSphere is itself a per-type dispatcher: `litho.addLayer(type, cfg)` and
 * the by-name `removeLayer` / `toggleLayer` / `setLayerOpacity` / `orderLayers`
 * are type-agnostic. So the only tile-specific seam on this engine is `add`
 * (where an MMGIS layer type maps to a LithoSphere layerer name). Lifecycle ops
 * carry no tile-specific logic and stay generic in GlobeRenderer, which is why
 * this module intentionally implements only `add`.
 *
 * gctx (lithosphere) = { engine: 'lithosphere', renderer (LithoSphere), layers }
 */
function add(layerConfig, gctx) {
    return gctx.renderer.addLayer('tile', layerConfig)
}

export default {
    add,
}
