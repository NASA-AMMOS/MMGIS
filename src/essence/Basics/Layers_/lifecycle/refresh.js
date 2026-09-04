/**
 * Re-acquire a layer's data — the supported way for a plugin to see a change it
 * just made.
 *
 * A plugin that writes to its own backend (or otherwise changes what the
 * layer's source would return) needs the layer reloaded, and had no contract
 * for it: the only route was `L_.Map_.refreshLayer(layerObj, cb,
 * skipOrderedBringToFront, stopLoops, resolvedUrl)`, an internal whose
 * positional parameters mean nothing to a plugin author. This is that one call,
 * named, taking a layer name or the layer object a plugin already holds.
 *
 * It is handed to plugins as `ctx.refreshLayer()` (interactions, attachments),
 * and lands in a `source`-backed type as a `fetch` with `ctx.trigger ===
 * 'refresh'` — the same acquisition every other trigger goes through, so the
 * extent, staleness and rendering coordination stay core's.
 *
 * @param {string|object} layer  A layer name, or an `L_.layers.data` entry.
 * @returns {Promise<boolean>} whether a refresh was started.
 */
export default async function refreshLayer(layer) {
    // Required lazily: this is called from plugin dispatch paths that must stay
    // importable without the whole singleton graph (and its jQuery) behind them.
    const L_ = require('../Layers_').default

    const layerObj =
        typeof layer === 'string'
            ? L_.layers.data[L_.asLayerUUID(layer)]
            : layer
    if (layerObj == null) {
        console.warn(
            `refreshLayer: no layer '${typeof layer === 'string' ? layer : layer?.name}'.`
        )
        return false
    }

    const refresh = L_.Map_?.refreshLayer
    if (typeof refresh !== 'function') return false
    await refresh(layerObj)
    return true
}

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
