/**
 * VectorTile layer type — LithoSphere globe renderer.
 *
 * `make` receives the layer's normal MMGIS config object: only extruded vector
 * tile layers are drawn on the globe, and an already-loaded one is toggled back
 * on rather than rebuilt (LithoSphere keeps extruded geometry, which is
 * expensive to rebuild). `onToggle` is the other half of that: hide in place
 * instead of removing.
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers, hasLayer,
 *                        toggleLayer, removeLayer }
 */
import { makeWith, onToggle } from '../config'

function make(layerObj, gctx) {
    return makeWith(layerObj, gctx, render)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    return gctx.renderer.addLayer('vectortile', layerConfig)
}

export default {
    make,
    onToggle,
    render,
}
