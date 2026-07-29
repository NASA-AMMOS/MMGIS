/**
 * VectorTile layer type — LithoSphere globe renderer.
 *
 * LithoSphere is itself a per-type dispatcher: `litho.addLayer(type, cfg)` and
 * the by-name lifecycle ops are type-agnostic and stay generic in
 * GlobeRenderer. The only vectortile-specific seam here is `add` (mapping the
 * MMGIS type to the LithoSphere 'vectortile' layerer).
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers }
 */
function add(layerConfig, gctx) {
    return gctx.renderer.addLayer('vectortile', layerConfig)
}

export default {
    add,
}
