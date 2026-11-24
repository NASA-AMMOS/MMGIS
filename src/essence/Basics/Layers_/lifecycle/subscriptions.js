export function subscribeTimeChange(L_, fid, func) {
    if (typeof func === 'function') L_._timeChangeSubscriptions[fid] = func
}

export function unsubscribeTimeChange(L_, fid) {
    if (L_._timeChangeSubscriptions[fid] != null)
        delete L_._timeChangeSubscriptions[fid]
}

export function subscribeTimeLayerReloadFinish(L_, fid, func) {
    if (typeof func === 'function')
        L_._timeLayerReloadFinishSubscriptions[fid] = func
}

export function unsubscribeTimeLayerReloadFinish(L_, fid) {
    if (L_._timeLayerReloadFinishSubscriptions[fid] != null)
        delete L_._timeLayerReloadFinishSubscriptions[fid]
}

export function subscribeOnTimeUIToggle(L_, fid, func) {
    if (typeof func === 'function')
        L_._onTimeUIToggleSubscriptions[fid] = func
}

export function unsubscribeOnTimeUIToggle(L_, fid) {
    if (L_._onTimeUIToggleSubscriptions[fid] != null)
        delete L_._onTimeUIToggleSubscriptions[fid]
}

export function subscribeOnLayerToggle(L_, fid, func) {
    if (typeof func === 'function')
        L_._onLayerToggleSubscriptions[fid] = func
}

export function unsubscribeOnLayerToggle(L_, fid) {
    if (L_._onLayerToggleSubscriptions[fid] != null)
        delete L_._onLayerToggleSubscriptions[fid]
}

export function subscribeOnSpecificLayerToggle(L_, fid, layerId, func) {
    if (typeof func === 'function')
        L_._onSpecificLayerToggleSubscriptions[fid] = {
            layer: layerId,
            func: func,
        }
}

export function unsubscribeOnSpecificLayerToggle(L_, fid) {
    if (L_._onSpecificLayerToggleSubscriptions[fid] != null)
        delete L_._onSpecificLayerToggleSubscriptions[fid]
}

// A layer's raster query inputs changed (its band expression, or its time
// window set directly). Anything holding results read with the old inputs -
// the Identifier's pinned time series - can re-read them.
export function subscribeOnLayerQueryChange(L_, fid, func) {
    if (typeof func === 'function')
        L_._onLayerQueryChangeSubscriptions[fid] = func
}

export function unsubscribeOnLayerQueryChange(L_, fid) {
    if (L_._onLayerQueryChangeSubscriptions[fid] != null)
        delete L_._onLayerQueryChangeSubscriptions[fid]
}

export function layerQueryChanged(L_, layerUUID) {
    Object.keys(L_._onLayerQueryChangeSubscriptions).forEach((k) => {
        try {
            L_._onLayerQueryChangeSubscriptions[k](layerUUID)
        } catch (err) {
            console.warn(`Layer query change subscriber '${k}' failed:`, err)
        }
    })
}
