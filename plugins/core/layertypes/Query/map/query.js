/**
 * Query layer type — map renderer.
 *
 * A `query` layer is a vector layer whose features are supplied at runtime
 * (e.g. by a tool) rather than fetched from a static GeoJSON URL. It is a thin
 * specialization of the Vector map renderer: it seeds an empty GeoJSON layer
 * (`useEmptyGeoJSON`) and does not participate in the Filtering lifecycle, so it
 * reuses Vector's shared builder and omits the make.after/make.afterCommit
 * filtering hooks. destroy rides core's default teardown.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import { makeVectorMap } from '@basics/Layers_/VectorLayerCore'

async function make(layerObj, ctx = {}) {
    await makeVectorMap(layerObj, ctx, {
        useEmptyGeoJSON: true,
        evenIfOff: false,
    })
}

export default {
    make,
}
