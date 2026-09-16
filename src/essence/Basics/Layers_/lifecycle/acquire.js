/**
 * Acquire another configured layer's data — the supported way for a plugin to
 * use a layer of the mission as an input.
 *
 * A feature's second input is often already a layer: a wind field to sample, a
 * network to snap to, a set of stations to join against. Reading the *rendered*
 * layer is not supported and won't be (an off layer has rendered nothing, a
 * dynamic layer holds only the current viewport, a vector-tile layer has no
 * feature collection at all, and there is no invalidation contract) — but the
 * *data* is a different thing, and this is it: whatever the layer's type does to
 * acquire, done headlessly.
 *
 * The layer is not turned on, nothing is drawn, no rendered state is exposed,
 * and the layer's own live acquisition is untouched. A dynamic-extent layer is
 * acquired whole rather than bound to the viewport, and a layer with no feature
 * collection to give resolves to null.
 *
 * It is handed to plugins as `ctx.acquire(layerName)` — in interactions,
 * attachments and a layer type's own `source.fetch`.
 *
 * @param {string} layerName  A layer's display name or uuid.
 * @returns {Promise<object|null>} GeoJSON, or null if it cannot be acquired.
 */
export default async function acquire(layerName) {
    // Required lazily, as refresh.js is: plugin dispatch paths must stay
    // importable without the whole singleton graph behind them.
    const { acquireLayer } = require('../capture/LayerCapturer')
    return acquireLayer(layerName)
}
