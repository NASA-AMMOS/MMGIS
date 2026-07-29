/**
 * Model layer type — Cesium globe renderer.
 *
 * Model rendering is not implemented for the Cesium engine (only LithoSphere
 * draws models today). This module makes that explicit: `add` warns and renders
 * nothing, matching the previous built-in behavior. Left as the seam where a
 * Cesium model implementation would live.
 *
 * gctx (cesium) = { engine, renderer, layers, requestRender, ... }
 */
function add() {
    console.warn('Model layers not yet supported for Cesium renderer')
}

export default {
    add,
}
