/**
 * dynamicStyleRuntime — restyle a layer without remaking it.
 *
 * The dynamic style is compiled when a layer is made, but two things change it
 * while the layer is on the map: a viewer switching what it's coloured by, and
 * a domain stretched over the current view rather than the whole dataset, which
 * moves every time the map does. Both only change the resolver — the features,
 * their geometry and everything else about the layer are the same — so this
 * recompiles and repaints instead of re-acquiring the data.
 *
 * @module dynamicStyleRuntime
 */

import calls from '../../../../pre/calls'
import {
    compileLayerDynamicStyle,
    getDomainMode,
    getDynamicStyle,
    setDynamicStyleOverride,
} from './layerDynamicStyle'

/** How long the map has to be still before a current-view domain re-measures. */
const SETTLE_MS = 250

/** Layers whose restyle is waiting for the map to settle, name → timeout id. */
const pending = {}

function L_() {
    // Required lazily: the singleton graph pulls in jQuery and the whole map,
    // and this module is imported by things that must stay unit-testable.
    return require('../Layers_').default
}

/**
 * The features a layer's domain is measured over: everything it has loaded, or
 * only what is in view when it is stretched over the current view.
 *
 * A geodataset with `dynamicExtent` has already been narrowed to the viewport
 * by the server, so for it the two are nearly the same — the difference is felt
 * by an ordinary layer holding a whole file.
 *
 * @param {object} layerObj
 * @returns {Array<object>} GeoJSON features.
 */
export function domainFeatures(layerObj) {
    const Layers = L_()
    const leafletLayer = Layers.layers.layer[layerObj?.name]
    if (leafletLayer == null || typeof leafletLayer.eachLayer !== 'function')
        return []

    const inViewOnly = getDomainMode(layerObj) === 'view'
    const bounds =
        inViewOnly && Layers.Map_?.map ? Layers.Map_.map.getBounds() : null

    const features = []
    leafletLayer.eachLayer((sublayer) => {
        if (sublayer?.feature == null) return
        if (bounds != null && !intersects(bounds, sublayer)) return
        features.push(sublayer.feature)
    })
    return features
}

function intersects(bounds, sublayer) {
    if (typeof sublayer.getBounds === 'function')
        return bounds.intersects(sublayer.getBounds())
    if (typeof sublayer.getLatLng === 'function')
        return bounds.contains(sublayer.getLatLng())
    return true
}

/**
 * Recompile a layer's dynamic style over the features its domain should be
 * measured on, and repaint what is already drawn.
 *
 * @param {string|object} layer  A layer name or an `L_.layers.data` entry.
 * @returns {boolean} whether anything was restyled.
 */
export function restyleLayerDynamically(layer) {
    const Layers = L_()
    const layerObj =
        typeof layer === 'string'
            ? Layers.layers.data[Layers.asLayerUUID(layer)]
            : layer
    if (layerObj == null || getDynamicStyle(layerObj) == null) return false

    compileLayerDynamicStyle(layerObj, domainFeatures(layerObj))

    // The style function reads the resolver off the layer, so resetting each
    // feature to it is the whole repaint.
    const leafletLayer = Layers.layers.layer[layerObj.name]
    if (leafletLayer != null && typeof leafletLayer.eachLayer === 'function') {
        leafletLayer.eachLayer((sublayer) => {
            if (sublayer?.feature == null) return
            try {
                leafletLayer.resetStyle(sublayer)
            } catch (err) {
                // A marker with an icon has no path style to reset; it keeps
                // the look it was made with until the layer is.
            }
        })
    }

    restyleGlobe(layerObj)
    return true
}

/**
 * The globe holds a styled copy of the GeoJSON rather than a live view of it,
 * so it is rebuilt from the new resolver. Only when the globe is up and the
 * layer is on it — otherwise it will be built with the new style anyway.
 */
function restyleGlobe(layerObj) {
    const Layers = L_()
    const globe = Layers.Globe_?.litho
    if (globe == null || typeof globe.hasLayer !== 'function') return
    if (!globe.hasLayer(layerObj.name)) return
    globe.removeLayer(layerObj.name)
    const added = globe.addLayerFor(layerObj)
    if (added && typeof added.catch === 'function')
        added.catch((err) =>
            console.warn(
                `restyleLayerDynamically: globe redraw of '${layerObj.name}' failed.`,
                err
            )
        )
}

/**
 * Restyle once the map stops moving.
 *
 * A pan over a `dynamicExtent` geodataset moves the domain twice — the bounds
 * change and then new features arrive — and a drag fires continuously, so the
 * restyle is coalesced into one at the end rather than run per event.
 *
 * @param {string|object} layer
 */
export function restyleLayerWhenSettled(layer) {
    const Layers = L_()
    const name = typeof layer === 'string' ? layer : layer?.name
    if (name == null) return
    if (pending[name] != null) clearTimeout(pending[name])
    pending[name] = setTimeout(() => {
        delete pending[name]
        restyleLayerDynamically(Layers.layers.data[name] || layer)
    }, SETTLE_MS)
}

/**
 * Every on layer whose domain follows the current view. What a map movement
 * has to restyle, and nothing else.
 *
 * @returns {Array<object>}
 */
export function layersFollowingTheView() {
    const Layers = L_()
    const following = []
    for (const name in Layers.layers.data) {
        const layerObj = Layers.layers.data[name]
        if (!Layers.layers.on[name]) continue
        if (getDynamicStyle(layerObj) == null) continue
        if (getDomainMode(layerObj) !== 'view') continue
        following.push(layerObj)
    }
    return following
}

/** Restyle everything stretched over the current view, once the map settles. */
export function restyleViewFollowingLayers() {
    layersFollowingTheView().forEach(restyleLayerWhenSettled)
}

/** Geodataset layers whose statistics have been asked for, name → true. */
const askedForFieldStats = {}

/**
 * A geodataset knows the min, max and spread of every numeric field over all
 * of its features, including the ones this view never loaded — the only way a
 * `dynamicExtent` layer's colours can mean the same thing wherever you are. It
 * is fetched once per layer and the layer restyled with it.
 *
 * A layer that isn't a geodataset needs nothing: its whole-dataset domain is
 * measured over the features it holds, which are all of them.
 *
 * @param {object} layerObj
 */
export function ensureFieldStats(layerObj) {
    if (layerObj == null || getDynamicStyle(layerObj) == null) return
    if (askedForFieldStats[layerObj.name]) return
    const url = layerObj.url || ''
    if (url.split(':')[0] !== 'geodatasets') return
    const geodataset = url.split(':')[1]
    if (!geodataset) return

    askedForFieldStats[layerObj.name] = true
    calls.api(
        'geodatasets_schema',
        { layers: geodataset },
        (data) => {
            const stats = data?.field_stats?.[geodataset]
            if (stats == null) return
            layerObj._fieldStats = stats
            restyleLayerDynamically(layerObj)
        },
        (err) => {
            console.warn(
                `Dynamic style: '${layerObj.name}' has no dataset-wide statistics to stretch its scale over.`,
                err?.message
            )
        }
    )
}

/**
 * Change how a layer is styled for this session and repaint it.
 *
 * @param {string|object} layer
 * @param {object} override  See `setDynamicStyleOverride`.
 * @returns {boolean} whether anything was restyled.
 */
export function overrideDynamicStyle(layer, override) {
    const Layers = L_()
    const layerObj =
        typeof layer === 'string'
            ? Layers.layers.data[Layers.asLayerUUID(layer)]
            : layer
    if (layerObj == null) return false
    setDynamicStyleOverride(layerObj, override)
    return restyleLayerDynamically(layerObj)
}

const DynamicStyleRuntime = {
    domainFeatures,
    ensureFieldStats,
    layersFollowingTheView,
    overrideDynamicStyle,
    restyleLayerDynamically,
    restyleLayerWhenSettled,
    restyleViewFollowingLayers,
}

export default DynamicStyleRuntime
