// Layers that were off (but already built) when a re-query request arrived
// would otherwise show cached data on their next turn-on
const staleLayers = new Set()
let subscribed = false

function ensureStaleReloadOnToggle(L_) {
    if (subscribed) return
    subscribed = true
    L_.subscribeOnLayerToggle('Layers_refresh', (layerName, isNowOn) => {
        if (isNowOn && staleLayers.has(layerName)) {
            staleLayers.delete(layerName)
            requeryLayers(L_, [layerName])
        }
    })
}

// Force-requery layers by display name or UUID, mirroring the polling loop in
// config.js: on layers reload now (preserving the active feature), off layers
// reload when next turned on.
export async function requeryLayers(L_, layerNames) {
    ensureStaleReloadOnToggle(L_)

    const uuids = [
        ...new Set(layerNames.map((name) => L_.asLayerUUID(name))),
    ].filter((name) => L_.layers.data[name])
    const names = uuids.filter((name) => L_.layers.on[name] === true)
    uuids
        .filter(
            (name) =>
                L_.layers.on[name] !== true && L_.layers.layer[name] !== false
        )
        .forEach((name) => staleLayers.add(name))
    if (names.length === 0) return

    let savedActiveFeature
    if (L_.activeFeature && names.includes(L_.activeFeature.layerName)) {
        savedActiveFeature = {
            layerName: L_.activeFeature.layerName,
            feature: JSON.parse(JSON.stringify(L_.activeFeature.feature)),
        }
    }

    await Promise.allSettled(
        names.map((name) => {
            const layer = L_.layers.data[name]
            if (layer.time && layer.time.enabled === true)
                return L_.TimeControl_.reloadLayer(
                    name,
                    false,
                    false,
                    true,
                    true
                )
            return L_.Map_.refreshLayer(layer, undefined, true)
        })
    )

    if (savedActiveFeature) {
        L_.selectFeature(
            savedActiveFeature.layerName,
            savedActiveFeature.feature
        )
    }
}
