/**
 * 3D Tiles layer type — LithoSphere globe renderer.
 *
 * LithoSphere provides a native 3D Tiles layerer, so the only 3dtiles-specific
 * seam on this engine is `add`. The by-name lifecycle ops stay generic in
 * GlobeRenderer.
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers }
 */
function add(layerConfig, gctx) {
    return gctx.renderer.addLayer('3dtiles', layerConfig)
}

export default {
    add,
}
