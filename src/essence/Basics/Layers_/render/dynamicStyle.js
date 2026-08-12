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

/** The statistics a geodataset reports for each group of features. */
export const GROUP_STATS = ['avg', 'min', 'max', 'sum', 'stddev']
export const DEFAULT_GROUP_STAT = 'avg'

/**
 * Where a rule reads its value from: the feature's own property, or the
 * statistics of the group the feature belongs to.
 *
 * @param {object} rule
 * @returns {'properties'|'stats'}
 */
export function propertyTypeOf(rule) {
    return rule?.propertyType === 'stats' ? 'stats' : 'properties'
}

/**
 * The path a rule reads. A rule styling by a group statistic is written as a
 * field and a statistic rather than as the path they make, so a viewer can
 * swap the average for the maximum without retyping anything.
 *
 * @param {object} rule
 * @returns {string} a property name or dotted path.
 */
export function rulePropertyPath(rule) {
    const property = rule?.property
    if (typeof property !== 'string' || property === '') return ''
    if (propertyTypeOf(rule) !== 'stats') return property
    return `_.stats.${property}.${ruleStatOf(rule)}`
}

/**
 * The statistic a group-statistic rule styles by.
 *
 * @param {object} rule
 * @returns {string}
 */
export function ruleStatOf(rule) {
    const stat = rule?.stat
    return GROUP_STATS.includes(stat) ? stat : DEFAULT_GROUP_STAT
}

/**
 * What to call the thing a rule styles by, for a legend or a settings panel.
 *
 * @param {object} rule
 * @returns {string}
 */
export function rulePropertyLabel(rule) {
    if (propertyTypeOf(rule) !== 'stats') return rule?.property || ''
    return `${rule.property} (group ${ruleStatOf(rule)})`
}

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
 * A dot is both a step down and a legal character in a key - a geodataset files
 * a nested field's group statistics under the whole name, `_.stats['meta.depth']`
 * - so each step takes the longest key that is actually there.
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
    return descend(properties, property.split('.'))
}

function descend(value, segments) {
    if (segments.length === 0) return value === undefined ? null : value
    if (value == null || typeof value !== 'object') return null
    for (let take = segments.length; take >= 1; take--) {
        const key = segments.slice(0, take).join('.')
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue
        const read = descend(value[key], segments.slice(take))
        if (read !== null) return read
    }
    return null
}

/**
 * A rule's ramp as `{ position, color }` stops: a named matplotlib colormap
 * sampled evenly, a list of colours spaced evenly, or a list of stops that say
 * where they sit - which is how a converted legend keeps colours pinned to the
 * values they were drawn at.
 *
 * @param {string|string[]|Array<{position: number, color: string}>} ramp
 * @param {boolean} [reverse]
 * @returns {Array<{position: number, color: string}>}
 */
export function rampStops(ramp, reverse) {
    if (Array.isArray(ramp)) {
        const placed = ramp
            .filter(
                (stop) =>
                    stop != null &&
                    typeof stop === 'object' &&
                    typeof stop.color === 'string' &&
                    stop.color !== '' &&
                    asNumber(stop.position) != null
            )
            .map((stop) => ({
                position: Math.min(1, Math.max(0, asNumber(stop.position))),
                color: stop.color,
            }))
        if (placed.length > 0) {
            const stops = reverse
                ? placed.map((stop) => ({
                      position: 1 - stop.position,
                      color: stop.color,
                  }))
                : placed
            return stops.sort((a, b) => a.position - b.position)
        }
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
    const source = configured.source || 'auto'
    // Only a literal domain is bounded by what was typed; a rule switched to
    // another source keeps those numbers in its config, and honouring them
    // would pin a scale the form no longer shows.
    const literal = source === 'literal' || configured.source == null
    const min = literal ? asNumber(configured.min) : null
    const max = literal ? asNumber(configured.max) : null
    if (min != null && max != null) return min > max ? null : { min, max }

    const ctx = context || {}
    const fieldStat = ctx.fieldStats ? ctx.fieldStats[rule.property] : null
    // A field's statistics describe its individual values; a group statistic
    // is a different number, bounded by them rather than equal to them.
    const isGroupStat = propertyTypeOf(rule) === 'stats'
    const dataset = isGroupStat
        ? groupStatDomain(fieldStat, ruleStatOf(rule))
        : statsDomain(fieldStat)
    // A mean-centered window needs the field's own moments, which say nothing
    // about how its groups are spread.
    const stat = isGroupStat ? null : fieldStat

    let resolved = null
    if (source === 'stddev') resolved = sigmaDomain(rule, stat, ctx.values)
    else if (source === 'fieldStats')
        resolved = dataset || valuesDomain(ctx.values)
    else if (source === 'loaded') resolved = valuesDomain(ctx.values)
    else resolved = dataset || valuesDomain(ctx.values)

    // Nothing measured is no styling at all, so a rule with nothing in hand
    // yet borrows its field's own extent rather than vanishing.
    if (resolved == null) resolved = dataset || statsDomain(fieldStat)
    if (resolved == null) return null
    // A half-configured domain pins one end and lets the other be discovered.
    const domain = {
        min: min != null ? min : resolved.min,
        max: max != null ? max : resolved.max,
    }
    // A pinned end past the discovered one describes no scale, as a typed pair
    // the wrong way round doesn't.
    return domain.min > domain.max ? null : domain
}

/**
 * What a group statistic can be over a whole dataset: an average, min or max
 * lies inside the field's own extent, a spread is at widest half of it, and a
 * sum is bounded by nothing knowable here.
 *
 * @param {?object} stat  A field's stored statistics.
 * @param {string} groupStat
 * @returns {{min: number, max: number}|null}
 */
export function groupStatDomain(stat, groupStat) {
    const extent = statsDomain(stat)
    if (extent == null) return null
    if (groupStat === 'sum') return null
    if (groupStat === 'stddev')
        return { min: 0, max: (extent.max - extent.min) / 2 }
    return extent
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
 * More distinct values than a legend can say anything with: past this a field
 * is an identifier rather than a category, and deriving a mapping for it would
 * paint noise.
 */
const MAX_DERIVED_CATEGORIES = 24

/**
 * The distinct values a non-numeric property takes across some features — what
 * a categorical mapping is derived from when a rule was aimed at a text field
 * without one being written.
 *
 * @param {Array<object>} features  GeoJSON features.
 * @param {string} property
 * @returns {string[]} sorted, or empty if there are too many to be categories.
 */
export function collectCategories(features, property) {
    if (!Array.isArray(features)) return []
    const values = new Set()
    for (const feature of features) {
        const raw = readProperty(feature?.properties, property)
        if (raw == null || typeof raw === 'object') continue
        const value = String(raw)
        if (value === '') continue
        values.add(value)
        if (values.size > MAX_DERIVED_CATEGORIES) return []
    }
    return [...values].sort()
}

/**
 * Whether a rule maps values one by one rather than stretching a scale over
 * them: written as categorical, or aimed at a property whose values aren't
 * numbers.
 *
 * @param {object} rule
 * @param {object} [context]  A single rule's context.
 * @returns {boolean}
 */
export function isCategoricalRule(rule, context) {
    if (rule?.type === 'categorical') return true
    if (context == null) return false
    const values = context.values
    if (Array.isArray(values) && values.length > 0) return false
    return Array.isArray(context.categories) && context.categories.length > 0
}

/**
 * A mapping for each value in hand, spread evenly across the rule's ramp or
 * range — what a rule aimed at a text field styles by until one is written.
 */
function derivedMappings(rule, categories, isColor) {
    if (!Array.isArray(categories) || categories.length === 0) return null
    const at = (i) =>
        categories.length === 1 ? 0 : i / (categories.length - 1)

    if (isColor) {
        const stops = rampStops(rule.ramp || DEFAULT_RAMP, rule.reverse)
        if (stops.length === 0) return null
        return categories.map((value, i) => ({
            value,
            color: interpolateMultipleColors(stops, at(i), 0, 1),
        }))
    }

    const range = Array.isArray(rule.range) ? rule.range : []
    const low = asNumber(range[0])
    const high = asNumber(range[1])
    if (low == null || high == null) return null
    return categories.map((value, i) => ({
        value,
        to: low + at(i) * (high - low),
    }))
}

/**
 * The mappings a categorical rule styles by: the written ones, or ones derived
 * from the values in hand.
 *
 * @param {object} rule
 * @param {object} [context]
 * @returns {Array<object>}
 */
export function ruleMappings(rule, context) {
    const written = Array.isArray(rule?.mappings) ? rule.mappings : []
    if (written.length > 0) return written
    const isColor = COLOR_ATTRIBUTES.includes(attributeOf(rule))
    return derivedMappings(rule, context?.categories, isColor) || []
}

/**
 * A discrete rule's bin boundaries as fractions of the domain, or null for the
 * even split. A rule may move them - "most of my readings are shallow, so give
 * the first bin a tenth of the scale" - and anything that doesn't describe
 * `bins` bins in strictly increasing order inside (0, 1) is ignored rather than
 * half-applied, which is also how a stale set survives a change of bin count.
 *
 * @param {*} stops
 * @param {number} bins
 * @returns {number[]|null}
 */
export function normalizeStops(stops, bins) {
    if (!Array.isArray(stops) || !bins || stops.length !== bins - 1) return null
    const normalized = []
    let previous = 0
    for (const stop of stops) {
        const num = asNumber(stop)
        if (num == null || num <= previous || num >= 1) return null
        normalized.push(num)
        previous = num
    }
    return normalized
}

/** Which bin a 0-to-1 position falls in. */
function binIndexOf(t, bins, stops) {
    if (stops == null) return Math.min(bins - 1, Math.floor(t * bins))
    for (let i = 0; i < stops.length; i++) if (t < stops[i]) return i
    return bins - 1
}

/**
 * Where a value sits in the domain, 0 to 1 — snapped to the middle of its bin
 * when the rule is discrete, so a bin is one flat colour rather than a gradient.
 *
 * Moving a boundary changes which values fall in a bin, not what colour the bin
 * is: bin *n* keeps the colour an even split would have given it, so widening a
 * bin doesn't silently recolour the ones beside it.
 */
function positionOf(value, domain, bins, stops) {
    const span = domain.max - domain.min
    const t = span === 0 ? 0 : (value - domain.min) / span
    const clamped = Math.max(0, Math.min(1, t))
    if (!bins || bins < 1) return clamped
    return (binIndexOf(clamped, bins, stops) + 0.5) / bins
}

/**
 * The bin edges a discrete rule divides its domain into — what the legend
 * labels its swatches with.
 *
 * @param {{min: number, max: number}} domain
 * @param {number} bins
 * @param {number[]} [stops]  Boundaries as fractions; see {@link normalizeStops}.
 * @returns {Array<{min: number, max: number}>}
 */
export function binEdges(domain, bins, stops) {
    if (domain == null || !bins || bins < 1) return []
    const span = domain.max - domain.min
    const fractions = normalizeStops(stops, bins)
    const at = (i) =>
        domain.min + span * (fractions ? fractions[i - 1] : i / bins)
    const edges = []
    for (let i = 0; i < bins; i++)
        edges.push({
            min: i === 0 ? domain.min : at(i),
            max: i === bins - 1 ? domain.max : at(i + 1),
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
    // A rule switched off is configuration, not styling.
    if (rule.enabled === false) return false
    if (typeof rule.property !== 'string' || rule.property === '') return false
    if (!STYLE_ATTRIBUTES.includes(attributeOf(rule))) return false
    return true
}

/**
 * The attributes a rule can still style once aimed at them: a value table of
 * colours has no weight to give, while a numeric rule takes a ramp or a range.
 *
 * @param {object} rule
 * @returns {string[]}
 */
export function styleableAttributes(rule) {
    if (rule == null || rule.type !== 'categorical') return STYLE_ATTRIBUTES
    const mappings = Array.isArray(rule.mappings) ? rule.mappings : []
    const colored = mappings.some(
        (mapping) => typeof mapping?.color === 'string' && mapping.color !== ''
    )
    const numeric = mappings.some((mapping) => asNumber(mapping?.to) != null)
    if (colored && !numeric) return COLOR_ATTRIBUTES
    if (numeric && !colored) return NUMERIC_ATTRIBUTES
    return STYLE_ATTRIBUTES
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

    if (isCategoricalRule(rule, context)) {
        const table = new Map()
        for (const mapping of ruleMappings(rule, context)) {
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
    const binStops = normalizeStops(rule.stops, bins)

    if (isColor) {
        const stops = rampStops(rule.ramp || DEFAULT_RAMP, rule.reverse)
        if (stops.length === 0) return null
        return (raw) => {
            const num = asNumber(raw)
            if (num == null) return nullValue
            const t = positionOf(num, domain, bins, binStops)
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
        return low + positionOf(num, domain, bins, binStops) * (high - low)
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
            property: rulePropertyPath(rule),
            label: rulePropertyLabel(rule),
            categorical: isCategoricalRule(rule, ruleContext),
            mappings: ruleMappings(rule, ruleContext),
            domain: isCategoricalRule(rule, ruleContext)
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
    const categories = context.categories
    return {
        fieldStats: context.fieldStats,
        values: values[rulePropertyPath(rule)],
        categories:
            categories == null || Array.isArray(categories)
                ? categories
                : categories[rulePropertyPath(rule)],
    }
}

const DynamicStyle = {
    COLOR_ATTRIBUTES,
    GROUP_STATS,
    NUMERIC_ATTRIBUTES,
    STYLE_ATTRIBUTES,
    asNumber,
    attributeOf,
    propertyTypeOf,
    rulePropertyLabel,
    rulePropertyPath,
    ruleStatOf,
    binEdges,
    collectCategories,
    collectValues,
    compileDynamicStyle,
    compileRules,
    resolverOf,
    isCategoricalRule,
    isUsableRule,
    ruleMappings,
    normalizeStops,
    rampStops,
    readProperty,
    resolveDomain,
    styleableAttributes,
}

export default DynamicStyle
