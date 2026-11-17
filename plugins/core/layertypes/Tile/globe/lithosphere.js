/**
 * Tile layer type — LithoSphere globe renderer.
 *
 * `make` receives the layer's normal MMGIS config object and owns the whole
 * translation to this engine: build the globe layer config (shared with the
 * Cesium module) and hand it to LithoSphere's 'tile' layerer.
 *
 * LithoSphere is itself a per-type dispatcher: `litho.addLayer(type, cfg)` and
 * the by-name `removeLayer` / `toggleLayer` / `setLayerOpacity` / `orderLayers`
 * are type-agnostic, so no other lifecycle op carries tile-specific logic and
 * the rest stays generic in GlobeRenderer.
 *
 * gctx (lithosphere) = { engine: 'lithosphere', renderer (LithoSphere), layers }
 */
import { toGlobeConfig } from './layerConfig'

function make(layerObj, gctx) {
    return render(toGlobeConfig(layerObj), gctx)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    return gctx.renderer.addLayer('tile', layerConfig)
}

export default {
    make,
    render,
}
