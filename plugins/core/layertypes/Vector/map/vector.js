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
 *
 * onToggle owns everything vector needs once a toggle has settled: pairings,
 * pane re-ordering, opacity refresh and — on the first turn-on only — the local
 * time window and any configured initial filters.
 */
import L_ from '@basics/Layers_/Layers_'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import { makeVectorMap } from '@basics/Layers_/commons/vector'

// Constrain a freshly-made layer to the current local time window.
function applyLocalTimeWindow(layerObj, opts = {}) {
    if (
        layerObj.time == null ||
        layerObj.time.type !== 'local' ||
        layerObj.time.endProp == null ||
        (layerObj.controlled === true && opts.evenIfControlled !== true)
    )
        return

    L_.timeFilterVectorLayer(
        layerObj.name,
        new Date(layerObj.time.start).getTime(),
        new Date(layerObj.time.end).getTime()
    )
}

// Apply `variables.initialFilters` the first time the layer is turned on.
function applyInitialFilters(layerObj) {
    const name = layerObj.name
    if (
        !layerObj.variables?.initialFilters?.length ||
        !Filtering.filters[name]
    )
        return

    try {
        // Populate geojson from the now-loaded layer
        Filtering.filters[name].geojson =
            Filtering.filters[name].geojson ||
            L_.layers.layer[name].toGeoJSON(L_.GEOJSON_PRECISION)

        Filtering.submit(name)
    } catch (err) {
        console.warn(
            `Filtering - Could not apply initial filters for layer: ${name}`,
            err
        )
    }
}

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
    onToggle(layerObj, ctx = {}) {
        // Initial visibility: the layer was never toggled, the map is still
        // settling and ordering is applied wholesale afterwards — only the
        // (deferred) opacity refresh applies.
        if (ctx.source === 'addVisible') {
            const name = layerObj.name
            setTimeout(() => {
                L_.setLayerOpacity(name, L_.layers.opacity[name])
            }, 300)
            return
        }

        if (!ctx.globeOnly) {
            L_._updatePairings(layerObj.name, ctx.visible)

            // Vector layers live in a Leaflet pane, so showing one puts it on
            // top of the stack — re-assert the configured draw order.
            if (ctx.visible && !ctx.skipOrderedBringToFront)
                L_.Map_.orderedBringToFront()
        }

        if (ctx.firstTimeOn) {
            applyLocalTimeWindow(layerObj)
            applyInitialFilters(layerObj)
        }

        L_.setLayerOpacity(layerObj.name, L_.layers.opacity[layerObj.name])
    },
    /**
     * A vector layer whose features each carry their own time can be filtered
     * to the new time window client-side instead of refetching — unless the
     * caller forced a requery, in which case core reloads and the window is
     * re-applied once the new features have landed.
     */
    timeChange(layerObj, ctx = {}) {
        const isLocallyTimed =
            layerObj.time?.type === 'local' && layerObj.time?.endProp != null
        const mayAct =
            ctx.evenIfControlled === true || layerObj.controlled !== true

        if (isLocallyTimed && ctx.forceRequery !== true) {
            if (mayAct)
                applyLocalTimeWindow(layerObj, {
                    evenIfControlled: ctx.evenIfControlled,
                })
            return
        }

        return ctx.reload({
            afterLoad: () => {
                if (
                    layerObj.time?.enabled === true &&
                    isLocallyTimed &&
                    ctx.forceRequery === true &&
                    mayAct
                )
                    applyLocalTimeWindow(layerObj, {
                        evenIfControlled: ctx.evenIfControlled,
                    })
            },
        })
    },
}
