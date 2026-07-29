/**
 * Vector layer type — map renderer.
 *
 * Renders a GeoJSON vector source on the 2D map. The engine-neutral build logic
 * (data capture via LayerCapturer — time-token replacement, injectable params,
 * dynamic-extent re-querying, geodatasets — GeoJSON validation, and the
 * MapRenderer.addVector call) lives in core (`VectorLayerCore.makeVectorMap`) so
 * it can be shared with the `query` plugin without one plugin importing another.
 * This module owns only the vector-specific two-phase filtering lifecycle.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 *
 * Post-make lifecycle (two-phase, dispatched by Map_.makeLayer):
 *   afterMake   → Filtering.updateGeoJSON  (inside the make-lock)
 *   afterUnlock → Filtering.triggerFilter  (after the lock releases — triggerFilter
 *                 clears+repopulates the layer and bails while _layersBeingMade holds)
 */
import MapRenderer from '@basics/Map_/MapRenderer'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import { makeVectorMap } from '@basics/Layers_/VectorLayerCore'

async function make(layerObj, ctx = {}) {
    await makeVectorMap(layerObj, ctx)
}

// Phase 1 (inside make-lock): rebuild the working GeoJSON used by filtering.
function afterMake(layerObj) {
    Filtering.updateGeoJSON(layerObj.name)
}

// Phase 2 (after make-lock releases): apply active filters. triggerFilter
// clears + repopulates the vector layer and bails if _layersBeingMade is still
// held, so it MUST run after the lock frees.
function afterUnlock(layerObj) {
    Filtering.triggerFilter(layerObj.name)
}

function remove(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    MapRenderer.removeLayer(layerObj, mctx)
}

export default {
    make,
    afterMake,
    afterUnlock,
    remove,
}
