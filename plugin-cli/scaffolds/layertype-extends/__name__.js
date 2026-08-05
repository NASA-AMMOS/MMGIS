/**
 * __Name__ layer type — extends `__parent__`.
 *
 * A single-module type: its keys are the *surfaces* it overrides, not renderer
 * operations. Everything it does not declare — drawing, picking, filtering, both
 * globes — is inherited from `__parent__` (one level, per surface).
 *
 * `source.fetch` is here because that is what a new data source usually is: the
 * request is yours, everything around it (the extent, debounce and settling,
 * the zoom gate, request staleness, clearing and updating the layer) stays
 * core's. See plugins/core/layertypes/README.md.
 */
async function fetch(layerObj, ctx) {
    // ctx.url    — the layer's url, time placeholders resolved ('' if none)
    // ctx.view   — the current extent, only when the layer sets
    //              `variables.dynamicExtent: true`; null otherwise
    // ctx.time   — { start, end, requery, … } for a time-enabled layer, else null
    // ctx.trigger — 'make' | 'view' | 'time'
    const res = await window.fetch(ctx.url, {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    // Return a FeatureCollection (a bare array is normalized), or null to leave
    // the layer as it is. The inherited renderer styles what you return, so
    // compute the properties the mission's `style` names with `prop-<name>`.
    void layerObj
    return res.json()
}

/*
 * The other surfaces, should this type differ in more than its data:
 *
 *   config: { expand, normalize, resolveUrl }  layer config in / url out
 *   filter: { getAggregations, filter }        what the FilterTool can offer
 *   time:   { format, applyTimeParams }        how time reaches the request
 *   legend: { derive }                         a legend that comes from the data
 *   map / globe                                a renderer, if you truly need one
 *                                              rather than the inherited draw
 */
const __Name__ = {
    source: { fetch },
}

export default __Name__
