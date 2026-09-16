import L_ from '@basics/Layers_/Layers_'
import LocalFilterer from '@essence/services/LocalFilterer'
import GeodatasetFilterer from '@basics/Layers_/Filtering/GeodatasetFilterer'

/**
 * The vector filtering strategy. Vector features are held client-side, so
 * filtering is local — except for a geodataset-backed layer that only holds the
 * features currently in view, whose aggregations and filtering must come from
 * the server.
 *
 * @module Vector/filter
 */

/** True when the layer's features live on the server rather than in the layer. */
function isServerBacked(layerObj) {
    return (
        layerObj?.url?.startsWith('geodatasets:') === true &&
        layerObj?.variables?.getFeaturePropertiesOnClick === true
    )
}

/**
 * `filter.getAggregations` — the per-property value/range summary the filter UI
 * builds its inputs from.
 *
 * @param {string} layerName
 * @param {Object} filters  This layer's filter state; a local vector layer
 *                          caches its GeoJSON here.
 * @param {Object} [ctx]
 * @param {boolean} [ctx.refresh]  Re-read the layer's features rather than
 *   reusing the cached GeoJSON (a dynamic-extent layer's visible features
 *   changed).
 * @returns {Promise<Object>} aggregations keyed by property
 */
async function getAggregations(layerName, filters = {}, ctx = {}) {
    const layerObj = L_.layers.data[layerName]
    if (isServerBacked(layerObj))
        return GeodatasetFilterer.getAggregations(layerName)

    try {
        filters.geojson =
            ctx.refresh === true
                ? L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                : filters.geojson ||
                  L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
    } catch (err) {
        console.warn(
            `Filtering - Cannot find GeoJSON to filter on for layer: ${layerName}`
        )
        return null
    }
    return LocalFilterer.getAggregations(filters.geojson, layerName)
}

/**
 * `filter.filter` — apply the layer's filter state to the layer.
 *
 * @param {string} layerName
 * @param {Object} filters
 * @param {Object} [ctx]
 * @param {string} [ctx.source]  What asked for the filter; a filter triggered
 *   by core rather than by the user is skipped when the server already applied
 *   it (see below).
 */
async function filter(layerName, filters, ctx = {}) {
    const layerObj = L_.layers.data[layerName]

    // A geodataset layer that already carries an encoded filter was filtered
    // server-side during capture. Re-applying the same filter locally is
    // redundant and flashes the layer (clear + re-add the same data).
    if (
        ctx.source === 'trigger' &&
        layerObj?._filterEncoded?.filters &&
        layerObj?.url?.toLowerCase().startsWith('geodatasets:')
    )
        return

    if (isServerBacked(layerObj)) GeodatasetFilterer.filter(layerName, filters)
    else LocalFilterer.filter(layerName, filters)
}

export default {
    getAggregations,
    filter,
}
