/**
 * dynamicStyle — style a feature from one of its properties.
 *
 * A layer's `variables.dynamicStyle` says "colour by depth", "widen by
 * confidence": a property, an attribute to drive, and how to get from the one
 * to the other (a colour ramp, a numeric range, or a value→style table). This
 * module turns that declaration into a function of a feature's properties, and
 * knows nothing about Leaflet, the globe, or where the features came from — a
 * geodataset and a plain .geojson are the same to it.
 *
 * The rule is compiled once per layer rather than consulted per feature, since
 * resolving a ramp and a domain for every feature of a 50k-feature layer is the
 * expensive way to arrive at the same answer.
 *
 * @module dynamicStyle
 */

import {
    data as colormapData,
    evaluate_cmap,
} from '@external/js-colormaps/js-colormaps.js'

import F_ from '../../Formulae_/Formulae_'
import { buildColorStops, interpolateMultipleColors } from './gradientUtils'

/** Attributes whose value is a colour. */
export const COLOR_ATTRIBUTES = ['fillColor', 'color']

/** Attributes whose value is a number. */
export const NUMERIC_ATTRIBUTES = ['fillOpacity', 'opacity', 'weight', 'radius']

/** Every attribute a rule may drive. */
export const STYLE_ATTRIBUTES = [...COLOR_ATTRIBUTES, ...NUMERIC_ATTRIBUTES]

/** What a rule drives, and with what, when it doesn't say. */
export const DEFAULT_ATTRIBUTE = 'fillColor'
export const DEFAULT_RAMP = 'viridis'

/**
 * The attribute a rule drives. A rule that names none colours the fill, which
 * is what "style by this property" almost always means and what the
 * configuration form offers first.
 *
 * @param {object} rule
 * @returns {string}
 */
export function attributeOf(rule) {
    const attribute = rule == null ? null : rule.attribute
    return attribute == null || attribute === '' ? DEFAULT_ATTRIBUTE : attribute
}

/** How many points a named colormap is sampled at to become colour stops. */
const RAMP_SAMPLES = 16

/**
 * A property's value as a number, or null if it isn't one.
 *
 * Deliberately stricter than parseFloat: '2024-01-15' and '1.2.3' are strings
 * that happen to start with digits, not the numbers 2024 and 1.2. Same grammar
 * the geodataset field statistics use, so a field summarized as numeric there
 * is styleable here.
 *
 * @param {*} value
 * @returns {number|null}
 */
export function asNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) return null
    const num = Number(trimmed)
    return Number.isFinite(num) ? num : null
}

/**
 * Read a possibly nested property, e.g. 'meta.reading.value'.
 *
 * @param {object} properties  A feature's properties.
 * @param {string} property    A property name or dotted path.
 * @returns {*} the value, or null.
 */
export function readProperty(properties, property) {
    if (properties == null || typeof property !== 'string' || property === '')
        return null
    if (property.indexOf('.') === -1) {
        const value = properties[property]
        return value === undefined ? null : value
    }
    return F_.getIn(properties, property.split('.'), null)
}

/**
 * A rule's ramp as `{ position, color }` stops: either the colours it lists, or
 * a named matplotlib colormap sampled evenly.
 *
 * @param {string|string[]} ramp
 * @param {boolean} [reverse]
 * @returns {Array<{position: number, color: string}>}
 */
export function rampStops(ramp, reverse) {
    if (Array.isArray(ramp)) {
        const colors = ramp.filter((c) => typeof c === 'string' && c !== '')
        if (colors.length === 0) return []
        return buildColorStops(reverse ? [...colors].reverse() : colors)
    }
    if (typeof ramp !== 'string' || !(ramp in colormapData)) return []
    const colors = []
    for (let i = 0; i < RAMP_SAMPLES; i++) {
        const [r, g, b] = evaluate_cmap(i / (RAMP_SAMPLES - 1), ramp, false)
        colors.push(`rgb(${r},${g},${b})`)
    }
    return buildColorStops(reverse ? colors.reverse() : colors)
}

/**
 * The numeric extent a rule is stretched over.
 *
 * `min`/`max` on the rule always win. Otherwise the source decides where the
 * numbers come from: a geodataset's stored field statistics (the whole dataset,
 * however little of it is loaded), the values in hand, or a mean-centered
 * window that ignores a single wild outlier. 'auto' prefers field statistics
 * when the layer has them, so a plain .geojson needs no configuration to work.
 *
 * @param {object} rule
 * @param {object} [context]
 * @param {object} [context.fieldStats]  fieldName → { min, max, avg, stddev }.
 * @param {number[]} [context.values]    The values in hand, already numeric.
 * @returns {{min: number, max: number}|null}
 */
export function resolveDomain(rule, context) {
    if (rule == null) return null
    const configured = rule.domain || {}
    const min = asNumber(configured.min)
    const max = asNumber(configured.max)
    if (min != null && max != null) return min > max ? null : { min, max }

    const ctx = context || {}
    const stat = ctx.fieldStats ? ctx.fieldStats[rule.property] : null
    const source = configured.source || 'auto'

    let resolved = null
    if (source === 'stddev') resolved = sigmaDomain(rule, stat, ctx.values)
    else if (source === 'fieldStats') resolved = statsDomain(stat)
    else if (source === 'loaded') resolved = valuesDomain(ctx.values)
    else resolved = statsDomain(stat) || valuesDomain(ctx.values)

    if (resolved == null) return null
    // A half-configured domain pins one end and lets the other be discovered.
    return {
        min: min != null ? min : resolved.min,
        max: max != null ? max : resolved.max,
    }
}

function statsDomain(stat) {
    if (stat == null) return null
    const min = asNumber(stat.min)
    const max = asNumber(stat.max)
    if (min == null || max == null) return null
    return { min, max }
}

function valuesDomain(values) {
    if (!Array.isArray(values) || values.length === 0) return null
    let min = Infinity
    let max = -Infinity
    for (const value of values) {
        const num = asNumber(value)
        if (num == null) continue
        if (num < min) min = num
        if (num > max) max = num
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    return { min, max }
}

/**
 * avg ± sigma·stddev, clamped to the data's own extent so the ramp never
 * describes values that aren't there. Geodatasets carry avg/stddev already;
 * for every other layer they're computed from the values in hand.
 */
function sigmaDomain(rule, stat, values) {
    const sigma = asNumber((rule.domain || {}).sigma) || 2
    const extent = statsDomain(stat) || valuesDomain(values)
    if (extent == null) return null

    let avg = stat ? asNumber(stat.avg) : null
    let stddev = stat ? asNumber(stat.stddev) : null
    if (avg == null || stddev == null) {
        const moments = momentsOf(values)
        if (moments == null) return extent
        avg = moments.avg
        stddev = moments.stddev
    }
    if (stddev === 0) return extent

    return {
        min: Math.max(extent.min, avg - sigma * stddev),
        max: Math.min(extent.max, avg + sigma * stddev),
    }
}

function momentsOf(values) {
    if (!Array.isArray(values) || values.length === 0) return null
    let sum = 0
    let sumsq = 0
    let count = 0
    for (const value of values) {
        const num = asNumber(value)
        if (num == null) continue
        sum += num
        sumsq += num * num
        count += 1
    }
    if (count === 0) return null
    const avg = sum / count
    return { avg, stddev: Math.sqrt(Math.max(0, sumsq / count - avg * avg)) }
}

/**
 * Every numeric value a property takes across some features — what a domain is
 * computed from when there are no stored statistics to read.
 *
 * @param {Array<object>} features  GeoJSON features.
 * @param {string} property
 * @returns {number[]}
 */
export function collectValues(features, property) {
    if (!Array.isArray(features)) return []
    const values = []
    for (const feature of features) {
        const num = asNumber(readProperty(feature?.properties, property))
        if (num != null) values.push(num)
    }
    return values
}

/**
 * Where a value sits in the domain, 0 to 1 — snapped to the middle of its bin
 * when the rule is discrete, so a bin is one flat colour rather than a gradient.
 */
function positionOf(value, domain, bins) {
    const span = domain.max - domain.min
    const t = span === 0 ? 0 : (value - domain.min) / span
    const clamped = Math.max(0, Math.min(1, t))
    if (!bins || bins < 1) return clamped
    const index = Math.min(bins - 1, Math.floor(clamped * bins))
    return (index + 0.5) / bins
}

/**
 * The bin edges a discrete rule divides its domain into — what the legend
 * labels its swatches with.
 *
 * @param {{min: number, max: number}} domain
 * @param {number} bins
 * @returns {Array<{min: number, max: number}>}
 */
export function binEdges(domain, bins) {
    if (domain == null || !bins || bins < 1) return []
    const step = (domain.max - domain.min) / bins
    const edges = []
    for (let i = 0; i < bins; i++)
        edges.push({
            min: domain.min + i * step,
            max: domain.min + (i + 1) * step,
        })
    return edges
}

/**
 * True for a rule this module can act on. A rule missing its property or naming
 * an attribute we don't drive is ignored rather than treated as an error, so a
 * half-filled form leaves the layer looking configured.
 *
 * @param {object} rule
 * @returns {boolean}
 */
export function isUsableRule(rule) {
    if (rule == null || typeof rule !== 'object') return false
    if (typeof rule.property !== 'string' || rule.property === '') return false
    if (!STYLE_ATTRIBUTES.includes(attributeOf(rule))) return false
    if (rule.type === 'categorical') return Array.isArray(rule.mappings)
    return true
}

function mappedValue(mapping, isColor) {
    return isColor ? mapping.color : asNumber(mapping.to)
}

/**
 * Compile one rule into `value → styled value`, or null if it can't produce
 * anything (an unusable rule, or a numeric rule with no resolvable domain).
 */
function compileRule(rule, context) {
    const isColor = COLOR_ATTRIBUTES.includes(attributeOf(rule))
    const fallback = isColor ? rule.fallbackValue : asNumber(rule.fallbackValue)
    const nullValue = isColor ? rule.nullValue : asNumber(rule.nullValue)

    if (rule.type === 'categorical') {
        const table = new Map()
        for (const mapping of rule.mappings) {
            if (mapping == null || mapping.value === undefined) continue
            const value = mappedValue(mapping, isColor)
            if (value == null || value === '') continue
            table.set(String(mapping.value), value)
        }
        if (table.size === 0) return null
        return (raw) => {
            if (raw == null) return nullValue
            const match = table.get(String(raw))
            return match === undefined ? fallback : match
        }
    }

    const domain = resolveDomain(rule, context)
    if (domain == null) return null
    const bins = rule.discrete
        ? Math.max(1, Math.round(asNumber(rule.bins) || 5))
        : 0

    if (isColor) {
        const stops = rampStops(rule.ramp || DEFAULT_RAMP, rule.reverse)
        if (stops.length === 0) return null
        return (raw) => {
            const num = asNumber(raw)
            if (num == null) return nullValue
            const t = positionOf(num, domain, bins)
            return interpolateMultipleColors(stops, t, 0, 1)
        }
    }

    const range = Array.isArray(rule.range) ? rule.range : []
    const low = asNumber(range[0])
    const high = asNumber(range[1])
    if (low == null || high == null) return null
    return (raw) => {
        const num = asNumber(raw)
        if (num == null) return nullValue
        return low + positionOf(num, domain, bins) * (high - low)
    }
}

/**
 * Compile each of a layer's rules, dropping the ones that can't produce
 * anything. The legend draws from these rather than from a second
 * interpretation of the configuration, so it can only ever show the scale the
 * features are actually coloured by — `domain` is the one the resolver used,
 * not a re-derivation of it.
 *
 * @param {object} dynamicStyle  A layer's `variables.dynamicStyle`.
 * @param {object} [context]     See {@link resolveDomain}.
 * @returns {Array<{rule: object, attribute: string, property: string,
 *                  domain: ?{min: number, max: number},
 *                  resolve: function(*): *}>}
 */
export function compileRules(dynamicStyle, context) {
    if (dynamicStyle == null || dynamicStyle.enabled !== true) return []
    if (!Array.isArray(dynamicStyle.rules)) return []

    const compiled = []
    for (const rule of dynamicStyle.rules) {
        if (!isUsableRule(rule)) continue
        const ruleContext = contextFor(rule, context)
        const resolve = compileRule(rule, ruleContext)
        if (resolve == null) continue
        compiled.push({
            rule,
            attribute: attributeOf(rule),
            property: rule.property,
            domain:
                rule.type === 'categorical'
                    ? null
                    : resolveDomain(rule, ruleContext),
            resolve,
        })
    }
    return compiled
}

/**
 * Compile a layer's `variables.dynamicStyle` into a function of a feature's
 * properties, returning the attributes it sets — or null when the layer has no
 * usable rule, which callers read as "style this the ordinary way".
 *
 * Rules each own one attribute and are applied in order, so colouring by depth
 * and widening by confidence compose without any precedence to reason about.
 *
 * @param {object} dynamicStyle  A layer's `variables.dynamicStyle`.
 * @param {object} [context]     See {@link resolveDomain}. `fieldStats` may be
 *                               given per property; `values` are the values of
 *                               the rule's own property.
 * @returns {(function(object): object|null)|null}
 */
export function compileDynamicStyle(dynamicStyle, context) {
    return resolverOf(compileRules(dynamicStyle, context))
}

/**
 * The feature-styling function of already-compiled rules.
 *
 * @param {Array<object>} compiled  From {@link compileRules}.
 * @returns {(function(object): object|null)|null}
 */
export function resolverOf(compiled) {
    if (!Array.isArray(compiled) || compiled.length === 0) return null

    return (properties) => {
        let style = null
        for (const { attribute, property, resolve } of compiled) {
            const value = resolve(readProperty(properties, property))
            if (value == null || value === '') continue
            if (style == null) style = {}
            style[attribute] = value
        }
        return style
    }
}

/**
 * A single rule's context. `values` are per-property, so a caller styling by
 * two properties can pass a map of them rather than pre-slicing.
 */
function contextFor(rule, context) {
    if (context == null) return context
    const values = context.values
    if (values == null || Array.isArray(values)) return context
    return { fieldStats: context.fieldStats, values: values[rule.property] }
}

const DynamicStyle = {
    COLOR_ATTRIBUTES,
    NUMERIC_ATTRIBUTES,
    STYLE_ATTRIBUTES,
    asNumber,
    attributeOf,
    binEdges,
    collectValues,
    compileDynamicStyle,
    compileRules,
    resolverOf,
    isUsableRule,
    rampStops,
    readProperty,
    resolveDomain,
}

export default DynamicStyle
