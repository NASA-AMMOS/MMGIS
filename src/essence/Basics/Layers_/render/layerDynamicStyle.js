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
    collectCategories,
    collectValues,
    compileRules,
    isUsableRule,
    propertyTypeOf,
    resolverOf,
    rulePropertyPath,
} from './dynamicStyle'

/**
 * What a viewer has changed about a layer's dynamic style for this session —
 * a different property to colour by, a different ramp, a domain stretched over
 * the current view instead of the whole dataset. Kept on the layer rather than
 * written anywhere: it is a way of looking at the data, not a configuration of
 * it, and it is gone on reload.
 *
 * `rules` replaces the configured rules outright - it is what the LayersTool
 * writes once a viewer edits, adds or removes one. `property`, `attribute`,
 * `range`, `ramp`, `discrete`, `bins` and `stops` are a shorthand for the same
 * thing on the first rule. `domain` applies to all, since "stretch this layer
 * over what I'm looking at" is about the layer.
 *
 * @param {object} layerObj
 * @param {object|null} override  Merged into any existing one; null clears it.
 * @returns {object|null} the override now in effect.
 */
export function setDynamicStyleOverride(layerObj, override) {
    if (layerObj == null) return null
    if (override == null) {
        layerObj._dynamicStyleOverride = null
        return null
    }
    layerObj._dynamicStyleOverride = Object.assign(
        {},
        layerObj._dynamicStyleOverride,
        override
    )
    return layerObj._dynamicStyleOverride
}

/**
 * @param {object} layerObj
 * @returns {object|null}
 */
export function getDynamicStyleOverride(layerObj) {
    return layerObj?._dynamicStyleOverride || null
}

/**
 * Which end of the Whole dataset / Current view toggle a layer is at. One
 * setting for the whole layer - what it was configured with, or what a viewer
 * has since chosen. Its rules follow it rather than the other way around.
 *
 * @param {object} layerObj
 * @returns {'dataset'|'view'}
 */
export function getDomainMode(layerObj) {
    const override = getDynamicStyleOverride(layerObj)
    if (override && override.domain) return override.domain
    return layerObj?.variables?.dynamicStyle?.domain === 'view'
        ? 'view'
        : 'dataset'
}

/** The rules a viewer is looking at, before the domain toggle is applied. */
function overriddenRules(rules, override) {
    if (override == null) return rules
    if (Array.isArray(override.rules)) return override.rules
    // The shorthand: the first rule, as the panel wrote it before rules could
    // be added or removed.
    return rules.map((rule, index) => {
        if (index !== 0) return rule
        const next = Object.assign({}, rule)
        if (override.property) next.property = override.property
        if (override.propertyType) next.propertyType = override.propertyType
        if (override.stat) next.stat = override.stat
        if (override.attribute) next.attribute = override.attribute
        if (override.range) next.range = override.range
        if (override.ramp) next.ramp = override.ramp
        if (override.discrete != null) next.discrete = override.discrete
        if (override.bins != null) next.bins = override.bins
        // Boundaries belong to a bin count: dropping them when it changes is
        // what makes an even split the thing you fall back to.
        if (override.stops !== undefined) next.stops = override.stops
        return next
    })
}

/** A scale whose ends were typed rather than measured. */
function isPinnedDomain(domain) {
    return domain?.source === 'literal'
}

function withOverride(dynamicStyle, override, mode) {
    const rules = overriddenRules(dynamicStyle.rules, override).map((rule) => {
        const next = Object.assign({}, rule)
        // A scale pinned to typed numbers is not measured over anything, so
        // the toggle leaves it alone.
        if (isPinnedDomain(next.domain)) return next
        // The layer's toggle says where an unpinned scale is measured, so a
        // rule follows it. 'loaded' is the toggle's own source: a rule that
        // carries it from an older configuration is measured over the whole
        // dataset instead.
        if (mode === 'view')
            next.domain = Object.assign({}, next.domain, { source: 'loaded' })
        else if (next.domain?.source === 'loaded')
            next.domain = Object.assign({}, next.domain, { source: 'auto' })
        return next
    })
    return Object.assign({}, dynamicStyle, { rules })
}

/**
 * A layer's dynamic style configuration as it is currently being viewed —
 * what it was configured with, plus any session override — or null if it has
 * none enabled.
 *
 * @param {object} layerObj
 * @returns {object|null}
 */
export function getDynamicStyle(layerObj) {
    const dynamicStyle = layerObj?.variables?.dynamicStyle
    if (dynamicStyle == null || dynamicStyle.enabled !== true) return null
    if (!Array.isArray(dynamicStyle.rules)) return null
    const overridden = withOverride(
        dynamicStyle,
        getDynamicStyleOverride(layerObj),
        getDomainMode(layerObj)
    )
    return overridden.rules.some(isUsableRule) ? overridden : null
}

/**
 * The rules a layer is being viewed with: the configured ones, or the session
 * ones once a viewer has changed them. What the LayersTool draws its controls
 * from and writes back to.
 *
 * @param {object} layerObj
 * @returns {Array<object>}
 */
export function getViewedRules(layerObj) {
    const configured = layerObj?.variables?.dynamicStyle?.rules
    if (!Array.isArray(configured)) return []
    return overriddenRules(configured, getDynamicStyleOverride(layerObj))
}

/**
 * Change one of a layer's rules for this session, by index.
 *
 * The whole set is written rather than a patch of the one: a viewer who adds
 * or removes a rule has a set that no longer lines up with the configured one,
 * so an index into the configuration would mean the wrong rule.
 *
 * @param {object} layerObj
 * @param {number} index
 * @param {object} patch
 * @returns {object|null} the override now in effect.
 */
export function overrideDynamicStyleRule(layerObj, index, patch) {
    const rules = getViewedRules(layerObj).map((rule, i) =>
        i === index ? Object.assign({}, rule, patch) : rule
    )
    return setDynamicStyleOverride(layerObj, { rules })
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
    // A rule styling by group statistics wants none of them: that value is
    // summarized by the endpoint rather than carried on the feature.
    return dynamicStyle.rules
        .filter(
            (rule) => isUsableRule(rule) && propertyTypeOf(rule) !== 'stats'
        )
        .map((rule) => rule.property)
}

/**
 * The geodataset fields a layer wants per-group statistics for: the ones an
 * admin named, plus the ones its rules style by — a rule set to style by a
 * field's group statistics asks for them itself rather than needing the field
 * listed twice.
 *
 * @param {object} layerObj
 * @returns {string[]}
 */
export function getStatsFields(layerObj) {
    const fields = []
    const configured = layerObj?.variables?.statsFields
    const listed =
        typeof configured === 'string'
            ? configured.split(',')
            : Array.isArray(configured)
              ? configured
              : []
    for (const field of listed) {
        const trimmed = String(field).trim()
        if (trimmed !== '' && fields.indexOf(trimmed) === -1)
            fields.push(trimmed)
    }

    // Rules of a switched-off dynamic style summarize nothing: only the fields
    // an admin listed outright are wanted then.
    const rules =
        getDynamicStyle(layerObj) == null
            ? []
            : getViewedRules(layerObj).filter((rule) => rule?.enabled !== false)
    for (const rule of rules) {
        // Either written as a rule that styles by statistics, or typed as the
        // path one reads - both ask for the same field.
        const field =
            propertyTypeOf(rule) === 'stats'
                ? rule.property
                : (/^_\.stats\.(.+)\.[^.]+$/.exec(rule?.property || '') ||
                      [])[1]
        if (
            typeof field === 'string' &&
            field !== '' &&
            fields.indexOf(field) === -1
        )
            fields.push(field)
    }
    return fields
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
    const categories = {}
    dynamicStyle.rules.filter(isUsableRule).forEach((rule) => {
        const path = rulePropertyPath(rule)
        if (values[path] !== undefined) return
        values[path] = collectValues(features, path)
        // A property with no numbers in it is styled value by value, so its
        // distinct values are what a mapping is derived from.
        categories[path] =
            values[path].length === 0 ? collectCategories(features, path) : []
    })

    const compiled = compileRules(dynamicStyle, {
        fieldStats: layerObj._fieldStats,
        values: values,
        categories: categories,
    })
    const resolver = resolverOf(compiled)
    // Silently losing every style is the hardest thing to diagnose about a rule,
    // so a rule that was configured but produced nothing says which one it was.
    dynamicStyle.rules
        .filter(
            (rule) =>
                isUsableRule(rule) && !compiled.some((c) => c.rule === rule)
        )
        .forEach((rule) =>
            console.warn(
                `Dynamic style: '${layerObj.name}' has no values for '${rulePropertyPath(
                    rule
                )}', so that rule styles nothing.`
            )
        )
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
                style: Object.assign({}, dynamic, properties?.style),
            }),
        })
    })
    return Object.assign({}, geojson, { features })
}

const LayerDynamicStyle = {
    applyDynamicStyleToGeoJSON,
    compileLayerDynamicStyle,
    getDomainMode,
    getDynamicStyle,
    getDynamicStyleOverride,
    getDynamicStyleProps,
    getLayerDynamicStyleResolver,
    getLayerDynamicStyleRules,
    getStatsFields,
    getViewedRules,
    overrideDynamicStyleRule,
    setDynamicStyleOverride,
}

export default LayerDynamicStyle
