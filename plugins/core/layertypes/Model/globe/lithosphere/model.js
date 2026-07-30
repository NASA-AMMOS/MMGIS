/**
 * Model layer type — LithoSphere globe renderer.
 *
 * LithoSphere provides a native model layerer, so the only model-specific seam
 * on this engine is `add` (mapping the MMGIS type to the 'model' layerer). The
 * by-name lifecycle ops stay generic in GlobeRenderer.
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers }
 */
function make(layerConfig, gctx) {
    return gctx.renderer.addLayer('model', layerConfig)
}

export default {
    make,
}
