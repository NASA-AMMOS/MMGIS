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
