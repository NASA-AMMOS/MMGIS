/**
 * __Name__ layer type — map renderer.
 *
 * Ops run before → main → after (make also has afterCommit); a bare function is
 * shorthand for { main }. Unimplemented ops fall back to core defaults, so write
 * only what differs. See plugins/core/layertypes/README.md.
 */
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    // const L = mctx.raw // engine-specific escape hatch (Leaflet namespace)

    // TODO: construct the layer and assign it to
    // L_.layers.layer[layerObj.name], then mark it loaded.
    void mctx

    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
    L_.Map_.allLayersLoaded()
}

function destroy(layerObj) {
    // TODO: remove the layer from the map and clean up references.
    void layerObj
}

/*
 * The rest of the vocabulary, with the default each one replaces. Uncomment only
 * where the default is wrong — an empty implementation silently overrides a
 * working one.
 *
 * load(layerObj, ctx)           data is (re)acquired: initial make, refresh
 *                               interval, time requery, extent reload. Default:
 *                               none — types that fetch inside make don't need it.
 * setOpacity(layerObj, o, ctx)  Default: the engine's uniform applier (Leaflet
 * setVisibility(layerObj, ctx)  and LithoSphere have one; Cesium does not).
 * setStyle(layerObj, ctx)       restyle / render params changed. Default: no-op.
 * timeChange(layerObj, ctx)     the time bar moved. Default: reload the layer.
 *
 * Non-render surfaces are separate modules declared in plugin.json `modules`:
 * config (expand/normalize/resolveUrl), filter (getAggregations/filter),
 * time (format/applyTimeParams).
 */
export default {
    make,
    destroy,
}
