import L_ from '@basics/Layers_/Layers_'
import ESFilterer from '@basics/Layers_/Filtering/ESFilterer'

/**
 * The query filtering strategy: a query layer holds no data of its own, so both
 * the aggregations and the filtering are answered by the search service the
 * layer is configured against (Elasticsearch by default).
 *
 * @module Query/filter
 */

/** The search-service connection this layer filters against. */
function serviceConfig(layerObj) {
    if (layerObj?.query == null) return {}
    return {
        endpoint: layerObj.query.endpoint,
        type: layerObj.query.type || 'elasticsearch',
        ...(layerObj.variables ? layerObj.variables.query || {} : {}),
    }
}

/** `filter.getAggregations` — asked of the search service. */
async function getAggregations(layerName) {
    return ESFilterer.getAggregations(
        layerName,
        serviceConfig(L_.layers.data[layerName])
    )
}

/** `filter.filter` — the search service re-queries with the filter applied. */
async function filter(layerName, filters) {
    return ESFilterer.filter(
        layerName,
        filters,
        serviceConfig(L_.layers.data[layerName])
    )
}

export default {
    getAggregations,
    filter,
}
