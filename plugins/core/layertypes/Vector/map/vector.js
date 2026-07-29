/**
 * Vector layer type — map renderer.
 *
 * Renders a GeoJSON vector source on the 2D map. Everything engine-neutral lives
 * here: data capture (via LayerCapturer, which handles time-token replacement,
 * injectable params, dynamic-extent re-querying and geodatasets), GeoJSON
 * validation, and refresh bookkeeping. The actual engine layer is built through
 * the MapRenderer middleware's neutral `addVector` primitive rather than by
 * touching Leaflet directly; dynamic-extent view subscriptions go through
 * `MapRenderer.onViewChange`.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 *
 * Post-make lifecycle (two-phase, dispatched by Map_.makeLayer):
 *   afterMake   → Filtering.updateGeoJSON  (inside the make-lock)
 *   afterUnlock → Filtering.triggerFilter  (after the lock releases — triggerFilter
 *                 clears+repopulates the layer and bails while _layersBeingMade holds)
 *
 * The `query` layer type shares this builder via the named `makeVectorMap`
 * export (with an empty GeoJSON seed and no filtering hooks).
 */
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import { captureVector } from '@basics/Layers_/LayerCapturer'
import gjv from 'geojson-validation'

// Shared vector-map builder. `query` reuses this with { useEmptyGeoJSON: true,
// evenIfOff: false }.
export function makeVectorMap(layerObj, ctx = {}, opts = {}) {
    const {
        evenIfOff,
        forceGeoJSON,
        isRefresh = false,
        mapContext,
        resolvedUrl,
    } = ctx

    const mctx = MapRenderer.context(mapContext)
    const registry = mctx.layerRegistry

    return new Promise((resolve) => {
        if (forceGeoJSON) add(forceGeoJSON)
        else
            captureVector(
                layerObj,
                {
                    evenIfOff:
                        opts.evenIfOff != null ? opts.evenIfOff : evenIfOff,
                    useEmptyGeoJSON: opts.useEmptyGeoJSON,
                    resolvedUrl: resolvedUrl,
                },
                add,
                (f) => {
                    MapRenderer.onViewChange(mctx, f)
                    if (
                        layerObj.time?.enabled === true &&
                        layerObj.controlled !== true
                    )
                        L_.subscribeTimeChange(
                            `dynamicextent_${layerObj.name}`,
                            f
                        )
                    L_.subscribeOnSpecificLayerToggle(
                        `dynamicextent_${layerObj.name}`,
                        layerObj.name,
                        f
                    )
                }
            )

        function add(data, allowInvalid) {
            data = F_.parseIntoGeoJSON(data)

            let invalidGeoJSONTrace = gjv.valid(data, true)
            const allowableErrors = [
                `position must only contain numbers`,
                `coord_properties`,
            ]

            invalidGeoJSONTrace = invalidGeoJSONTrace.filter((t) => {
                if (typeof t !== 'string') return false
                for (let i = 0; i < allowableErrors.length; i++) {
                    if (t.toLowerCase().indexOf(allowableErrors[i]) != -1)
                        return false
                }
                return true
            })
            if (
                data == null ||
                data === 'off' ||
                (invalidGeoJSONTrace.length > 0 && allowInvalid !== true)
            ) {
                if (data != null && data != 'off') {
                    data = null
                    console.warn(
                        `ERROR: ${layerObj.display_name} has invalid GeoJSON!`,
                        invalidGeoJSONTrace
                    )
                }

                // For refresh operations, preserve the existing layer on failure
                // to prevent temporary network issues from marking the layer as
                // "layernotfound".
                if (isRefresh && data === null) {
                    const existingLayer = registry.layer[layerObj.name]
                    if (existingLayer != null && existingLayer !== false) {
                        console.warn(
                            `[${new Date().toISOString()}] Refresh failed for ${
                                layerObj.display_name
                            }, ` +
                                `keeping existing layer. Next refresh in ${
                                    layerObj.time?.refreshIntervalAmount || 60
                                }s`
                        )
                        registry.refreshFailed[layerObj.name] = true
                        document.dispatchEvent(
                            new CustomEvent('layerRefreshStatusChanged', {
                                detail: {
                                    layerName: layerObj.name,
                                    failed: true,
                                },
                            })
                        )
                        resolve()
                        return
                    }
                }

                L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
                registry.layer[layerObj.name] = data == null ? null : false
                L_.Map_.allLayersLoaded()
                resolve()
                return
            }

            MapRenderer.addVector(layerObj, { geojson: data, isRefresh }, mctx)

            resolve()
        }
    })
}

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
