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
import { asNumber, readProperty } from './dynamicStyle'
import {
    addDynamicStyleRule,
    compileLayerDynamicStyle,
    getDomainMode,
    getDynamicStyle,
    overrideDynamicStyleRule,
    removeDynamicStyleRule,
    setDynamicStyleOverride,
} from './layerDynamicStyle'

/** How long the map has to be still before a current-view domain re-measures. */
const SETTLE_MS = 250

/** Fired when a layer's dynamic style has been recompiled and repainted. */
export const RESTYLED_EVENT = 'mmgis-dynamic-style-restyled'

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
    const all = []
    leafletLayer.eachLayer((sublayer) => {
        if (sublayer?.feature == null) return
        all.push(sublayer.feature)
        if (bounds != null && !intersects(bounds, sublayer)) return
        features.push(sublayer.feature)
    })
    // A domain measured over nothing is no styling at all, so a layer panned
    // entirely off screen falls back to everything it holds.
    return features.length === 0 ? all : features
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

    // Nothing drawn is nothing to measure, and compiling over it would drop
    // the styling the layer already has.
    const features = domainFeatures(layerObj)
    if (features.length === 0) return false

    compileLayerDynamicStyle(layerObj, features)

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
    // The legend describes the resolver that just changed, and a pan or a late
    // arrival of statistics changes it with nobody having asked.
    document.dispatchEvent(
        new CustomEvent(RESTYLED_EVENT, { detail: { layer: layerObj.name } })
    )
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
    // Adding a layer again reloads it in place under Cesium, so it is not
    // removed first - a rebuild that failed would leave the globe without it.
    if (globe.rendererType === 'lithosphere') globe.removeLayer(layerObj.name)
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

/**
 * Restyle a layer just built, if its domain is the current view: it was
 * compiled over everything it holds, there being no drawn layer to measure in
 * view until now.
 *
 * @param {object} layerObj
 * @returns {boolean} whether it was restyled.
 */
export function restyleIfFollowingTheView(layerObj) {
    if (layerObj == null || getDynamicStyle(layerObj) == null) return false
    if (getDomainMode(layerObj) !== 'view') return false
    return restyleLayerDynamically(layerObj)
}

/** Geodataset layers whose statistics are being or have been fetched. */
const askedForFieldStats = {}

/** Forget which layers have been asked, so a remade layer asks again. */
export function forgetFieldStatsRequests() {
    for (const name in askedForFieldStats) delete askedForFieldStats[name]
}

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
            // Nothing stored for it: asking again on a remake is the only way
            // it can pick up statistics written after this page was loaded.
            if (stats == null) {
                delete askedForFieldStats[layerObj.name]
                return
            }
            layerObj._fieldStats = stats
            restyleLayerDynamically(layerObj)
        },
        (err) => {
            // A layer that failed to ask keeps colouring itself over what it
            // holds; it may ask again when it is next made.
            delete askedForFieldStats[layerObj.name]
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

/**
 * What a layer knows about the numbers a property takes: a geodataset's stored
 * statistics over every feature it has, or a measure of the features in hand
 * for anything else.
 *
 * @param {object} layerObj
 * @param {string} property
 * @returns {?{min: number, max: number, avg: number, stddev: number,
 *             count: number, nullCount: number, wholeDataset: boolean}}
 */
export function propertyStats(layerObj, property) {
    const stored = layerObj?._fieldStats?.[property]
    if (stored != null && asNumber(stored.min) != null)
        return {
            min: asNumber(stored.min),
            max: asNumber(stored.max),
            avg: asNumber(stored.avg),
            stddev: asNumber(stored.stddev),
            count: asNumber(stored.count),
            nullCount: asNumber(stored.nullCount),
            wholeDataset: true,
        }

    const features = loadedFeatures(layerObj)
    if (features.length === 0) return null

    let min = Infinity
    let max = -Infinity
    let sum = 0
    let sumsq = 0
    let count = 0
    for (const feature of features) {
        const value = asNumber(readProperty(feature?.properties, property))
        if (value == null) continue
        if (value < min) min = value
        if (value > max) max = value
        sum += value
        sumsq += value * value
        count += 1
    }
    if (count === 0) return null

    const avg = sum / count
    return {
        min,
        max,
        avg,
        stddev: Math.sqrt(Math.max(0, sumsq / count - avg * avg)),
        count,
        nullCount: features.length - count,
        wholeDataset: false,
    }
}

/** Every feature a layer holds, whatever its domain is measured over. */
function loadedFeatures(layerObj) {
    const Layers = L_()
    const leafletLayer = Layers.layers.layer[layerObj?.name]
    if (leafletLayer == null || typeof leafletLayer.eachLayer !== 'function')
        return []
    const features = []
    leafletLayer.eachLayer((sublayer) => {
        if (sublayer?.feature != null) features.push(sublayer.feature)
    })
    return features
}

/**
 * Change one of a layer's rules for this session and repaint it.
 *
 * @param {string|object} layer
 * @param {number} index
 * @param {object} patch
 * @returns {boolean}
 */
export function overrideDynamicStyleRuleOf(layer, index, patch) {
    return withLayer(layer, (layerObj) => {
        overrideDynamicStyleRule(layerObj, index, patch)
    })
}

/**
 * Add a session rule to a layer and repaint it.
 *
 * @param {string|object} layer
 * @param {object} [rule]
 * @returns {boolean}
 */
export function addDynamicStyleRuleTo(layer, rule) {
    return withLayer(layer, (layerObj) => {
        addDynamicStyleRule(layerObj, rule)
    })
}

/**
 * Drop one of a layer's session rules and repaint it.
 *
 * @param {string|object} layer
 * @param {number} index
 * @returns {boolean}
 */
export function removeDynamicStyleRuleFrom(layer, index) {
    return withLayer(layer, (layerObj) => {
        removeDynamicStyleRule(layerObj, index)
    })
}

function withLayer(layer, change) {
    const Layers = L_()
    const layerObj =
        typeof layer === 'string'
            ? Layers.layers.data[Layers.asLayerUUID(layer)]
            : layer
    if (layerObj == null) return false
    change(layerObj)
    return restyleLayerDynamically(layerObj)
}

const DynamicStyleRuntime = {
    RESTYLED_EVENT,
    addDynamicStyleRuleTo,
    domainFeatures,
    overrideDynamicStyleRuleOf,
    propertyStats,
    removeDynamicStyleRuleFrom,
    ensureFieldStats,
    forgetFieldStatsRequests,
    layersFollowingTheView,
    overrideDynamicStyle,
    restyleLayerDynamically,
    restyleLayerWhenSettled,
    restyleViewFollowingLayers,
}

export default DynamicStyleRuntime
