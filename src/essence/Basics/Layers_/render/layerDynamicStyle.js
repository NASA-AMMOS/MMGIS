/**
 * layerDynamicStyle — a layer's dynamic style, compiled and cached.
 *
 * The resolver in `dynamicStyle.js` is pure and knows nothing about layers.
 * This is where a layer's config, its loaded features and (for a geodataset)
 * its stored field statistics are gathered into the context that resolver
 * needs, once per layer rather than once per feature. 2D styling, the globe
 * clone and the legend all read the result, so they cannot disagree about what
 * colour a value is.
 *
 * @module layerDynamicStyle
 */

import {
    collectValues,
    compileRules,
    isUsableRule,
    resolverOf,
} from './dynamicStyle'

/**
 * A layer's dynamic style configuration, or null if it has none enabled.
 *
 * @param {object} layerObj
 * @returns {object|null}
 */
export function getDynamicStyle(layerObj) {
    const dynamicStyle = layerObj?.variables?.dynamicStyle
    if (dynamicStyle == null || dynamicStyle.enabled !== true) return null
    if (!Array.isArray(dynamicStyle.rules)) return null
    return dynamicStyle.rules.some(isUsableRule) ? dynamicStyle : null
}

/**
 * The properties a layer's rules style by — the fields it can't be styled
 * without, so a layer that only requests some of its properties knows to ask
 * for these too.
 *
 * @param {object} layerObj
 * @returns {string[]}
 */
export function getDynamicStyleProps(layerObj) {
    const dynamicStyle = getDynamicStyle(layerObj)
    if (dynamicStyle == null) return []
    return dynamicStyle.rules.filter(isUsableRule).map((rule) => rule.property)
}

/**
 * Compile a layer's rules against the features it currently holds, caching the
 * result on the layer for the renderers and the legend to share.
 *
 * `features` are the ones the domain is measured over when it isn't coming from
 * stored statistics — every loaded feature normally, or only those in view when
 * the layer is set to stretch its ramp over the current view.
 *
 * @param {object} layerObj
 * @param {Array<object>} [features]
 * @returns {(function(object): object|null)|null}
 */
export function compileLayerDynamicStyle(layerObj, features) {
    if (layerObj == null) return null
    const dynamicStyle = getDynamicStyle(layerObj)
    if (dynamicStyle == null) {
        layerObj._dynamicStyleRules = null
        layerObj._dynamicStyleResolver = null
        return null
    }

    const values = {}
    dynamicStyle.rules.filter(isUsableRule).forEach((rule) => {
        if (values[rule.property] === undefined)
            values[rule.property] = collectValues(features, rule.property)
    })

    const compiled = compileRules(dynamicStyle, {
        fieldStats: layerObj._fieldStats,
        values: values,
    })
    const resolver = resolverOf(compiled)
    layerObj._dynamicStyleRules = resolver == null ? null : compiled
    layerObj._dynamicStyleResolver = resolver
    return resolver
}

/**
 * The rules a layer is currently styled by — each with the domain it resolved
 * to and the function that styles a value. What the legend describes, so it
 * describes the map rather than the configuration.
 *
 * @param {object} layerObj
 * @returns {Array<object>}
 */
export function getLayerDynamicStyleRules(layerObj) {
    return layerObj?._dynamicStyleRules || []
}

/**
 * The compiled resolver a layer is currently styled by, without recompiling —
 * what the legend draws from, so it describes what the map actually shows.
 *
 * @param {object} layerObj
 * @returns {(function(object): object|null)|null}
 */
export function getLayerDynamicStyleResolver(layerObj) {
    return layerObj?._dynamicStyleResolver || null
}

/**
 * Write a layer's dynamic style into a GeoJSON's features as
 * `properties.style`, which is what the globe renderers read.
 *
 * The features are copied rather than styled in place: the map's own features
 * are what Draw, export and filtering work with, and they must keep whatever
 * `properties.style` they were given. A feature that already has one keeps it —
 * same precedence as in 2D.
 *
 * @param {object} layerObj
 * @param {object} geojson  A FeatureCollection, typically a `toGeoJSON()` clone.
 * @returns {object} the same GeoJSON when the layer has no dynamic style, or a
 *                   copy whose features carry it.
 */
export function applyDynamicStyleToGeoJSON(layerObj, geojson) {
    if (geojson == null || !Array.isArray(geojson.features)) return geojson
    const resolve =
        getLayerDynamicStyleResolver(layerObj) ||
        compileLayerDynamicStyle(layerObj, geojson.features)
    if (resolve == null) return geojson

    const features = geojson.features.map((feature) => {
        const properties = feature?.properties
        const dynamic = resolve(properties)
        if (dynamic == null) return feature
        return Object.assign({}, feature, {
            properties: Object.assign({}, properties, {
                style: Object.assign({}, dynamic, properties.style),
            }),
        })
    })
    return Object.assign({}, geojson, { features })
}

const LayerDynamicStyle = {
    applyDynamicStyleToGeoJSON,
    compileLayerDynamicStyle,
    getDynamicStyle,
    getDynamicStyleProps,
    getLayerDynamicStyleResolver,
    getLayerDynamicStyleRules,
}

export default LayerDynamicStyle
