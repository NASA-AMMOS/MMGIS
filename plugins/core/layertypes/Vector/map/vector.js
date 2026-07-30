/**
 * Vector layer type — map renderer.
 *
 * Renders a GeoJSON vector source on the 2D map. The engine-neutral build logic
 * (data capture via LayerCapturer — time-token replacement, injectable params,
 * dynamic-extent re-querying, geodatasets — GeoJSON validation, and the
 * MapRenderer.addVector call) lives in core (`commons/vector.makeVectorMap`) so
 * it can be shared with the `query` plugin without one plugin importing another.
 * This module owns only the vector-specific two-phase filtering lifecycle.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 *
 * make lifecycle (nested phases, dispatched by Map_.makeLayer):
 *   make.main        → build the vector layer (commons/vector.makeVectorMap)
 *   make.after       → Filtering.updateGeoJSON  (inside the make-lock)
 *   make.afterCommit → Filtering.triggerFilter  (after the lock releases —
 *                      triggerFilter clears+repopulates the layer and bails
 *                      while _layersBeingMade holds)
 *
 * destroy is omitted: core's default teardown (generic Leaflet removal) covers
 * vector layers, so there is no vector-specific teardown to implement.
 */
import Filtering from '@basics/Layers_/Filtering/Filtering'
import { makeVectorMap } from '@basics/Layers_/commons/vector'

export default {
    make: {
        async main(layerObj, ctx = {}) {
            await makeVectorMap(layerObj, ctx)
        },
        // Inside make-lock: rebuild the working GeoJSON used by filtering.
        after(layerObj) {
            Filtering.updateGeoJSON(layerObj.name)
        },
        // After make-lock releases: apply active filters. triggerFilter clears
        // + repopulates the vector layer and bails if _layersBeingMade is still
        // held, so it MUST run after the lock frees.
        afterCommit(layerObj) {
            Filtering.triggerFilter(layerObj.name)
        },
    },
}
