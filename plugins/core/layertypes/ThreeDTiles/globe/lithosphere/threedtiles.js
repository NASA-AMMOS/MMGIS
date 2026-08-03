/**
 * 3D Tiles layer type — LithoSphere globe renderer.
 *
 * `make` receives the layer's normal MMGIS config object and hands the globe
 * layer config to LithoSphere's native 3D Tiles layerer. A loaded tileset is
 * toggled rather than rebuilt, which is also why `onToggle` hides it in place
 * instead of removing it.
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers, hasLayer,
 *                        toggleLayer }
 */
import { makeWith, onToggle } from '../config'

function make(layerObj, gctx) {
    return makeWith(layerObj, gctx, render)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    return gctx.renderer.addLayer('3dtiles', layerConfig)
}

export default {
    make,
    onToggle,
    render,
}
