/**
 * dynamicStyleLegend — describe a layer's dynamic style as legend entries.
 *
 * The legend does not decide anything here: every swatch is coloured by asking
 * the layer's own compiled resolver what a value looks like, so the legend and
 * the map cannot disagree, and the numbers shown are the domain the features
 * were actually coloured over (`avg ± 2σ`, a geodataset's whole-dataset extent,
 * whatever is in view) rather than a re-reading of the configuration.
 *
 * @module dynamicStyleLegend
 */

import {
    COLOR_ATTRIBUTES,
    binEdges,
    compileRules,
    formatValue,
} from '../render/dynamicStyle'
import {
    getDynamicStyle,
    getLayerDynamicStyleRules,
} from '../render/layerDynamicStyle'

// Swatches sampled across a continuous ramp. Enough to look smooth; the
// LegendTool thins the labels to what fits.
const RAMP_SWATCHES = 9

// A rule that widens lines or fades them has no colour to vary, so its
// swatches vary the same way the features do instead - and being drawn one
// per sample rather than as a gradient, a handful is all that reads.
const NUMERIC_SWATCHES = 5

/** How a numeric attribute is shown, and what it says about a swatch. */
const NUMERIC_SWATCHES_BY_ATTRIBUTE = {
    weight: { label: 'Weight', shape: 'rect' },
    radius: { label: 'Radius', shape: 'circle' },
    opacity: { label: 'Opacity', shape: 'rect' },
    fillOpacity: { label: 'Fill Opacity', shape: 'square' },
}

/** The widest a swatch may be drawn, in px. */
const SWATCH_MAX = 18

/** The colour a non-colour rule's swatches are drawn in. */
function baseColorOf(layerObj) {
    const style = layerObj?.style || {}
    return style.fillColor || style.color || '#c0c0c0'
}

/**
 * A swatch showing what a numeric attribute's value looks like: a line of that
 * weight, a circle of that radius, a swatch at that opacity.
 */
function numericSwatch(attribute, value, color) {
    const shape = NUMERIC_SWATCHES_BY_ATTRIBUTE[attribute].shape
    const entry = { shape, color, strokecolor: color }
    if (attribute === 'weight')
        entry.swatchHeight = Math.min(SWATCH_MAX, Math.max(1, value))
    else if (attribute === 'radius')
        entry.swatchSize = Math.min(SWATCH_MAX, Math.max(2, value * 2))
    else entry.swatchOpacity = Math.min(1, Math.max(0, value))
    return entry
}

/**
 * A numeric-attribute rule's swatches. Same domain, same resolver and the same
 * bin edges the colour case uses; only what a swatch varies differs.
 */
function entriesForNumericAttributeRule(compiledRule, baseColor) {
    const { rule, attribute, categorical, mappings, domain, resolve } =
        compiledRule

    if (categorical) {
        const byValue = new Map()
        for (const mapping of mappings) {
            if (mapping == null || mapping.value === undefined) continue
            const value = resolve(mapping.value)
            if (value == null) continue
            byValue.set(
                String(mapping.value),
                Object.assign(numericSwatch(attribute, value, baseColor), {
                    value: mapping.label || String(mapping.value),
                })
            )
        }
        return [...byValue.values()]
    }

    if (domain == null) return []

    if (rule.discrete) {
        const bins = Math.max(1, Math.round(Number(rule.bins) || 5))
        return binEdges(domain, bins, rule.stops)
            .map((edge) => {
                const middle = (edge.min + edge.max) / 2
                return Object.assign(
                    numericSwatch(attribute, resolve(middle), baseColor),
                    {
                        value: `${formatValue(edge.min)} – ${formatValue(
                            edge.max
                        )}`,
                    }
                )
            })
            .reverse()
    }

    const entries = []
    for (let i = 0; i < NUMERIC_SWATCHES; i++) {
        const at =
            domain.min +
            ((domain.max - domain.min) * i) / (NUMERIC_SWATCHES - 1)
        entries.push(
            Object.assign(numericSwatch(attribute, resolve(at), baseColor), {
                value: formatValue(at),
            })
        )
    }
    return entries.reverse()
}

function entriesForNumericRule(compiledRule) {
    const { rule, domain, resolve } = compiledRule
    if (domain == null) return []

    if (rule.discrete) {
        const bins = Math.max(1, Math.round(Number(rule.bins) || 5))
        return binEdges(domain, bins, rule.stops)
            .map((edge) => {
                const middle = (edge.min + edge.max) / 2
                return {
                    shape: 'discreet',
                    color: resolve(middle),
                    value: `${formatValue(edge.min)} – ${formatValue(
                        edge.max
                    )}`,
                }
            })
            .reverse()
    }

    const entries = []
    for (let i = 0; i < RAMP_SWATCHES; i++) {
        const value =
            domain.min + ((domain.max - domain.min) * i) / (RAMP_SWATCHES - 1)
        entries.push({
            shape: 'continuous',
            color: resolve(value),
            value: formatValue(value),
        })
    }
    // Highest value first: a vertical legend reads top-down, and the tool
    // reverses it itself when drawn horizontally.
    return entries.reverse()
}

function entriesForCategoricalRule(compiledRule) {
    const { mappings, resolve } = compiledRule
    // Two mappings of the same value: the resolver keeps the later one, so the
    // legend labels the later one too.
    const byValue = new Map()
    for (const mapping of mappings) {
        if (mapping == null || mapping.value === undefined) continue
        const key = String(mapping.value)
        const color = resolve(mapping.value)
        if (color == null || color === '') continue
        byValue.set(key, {
            shape: 'square',
            color: color,
            strokecolor: color,
            value: mapping.label || key,
        })
    }
    return [...byValue.values()]
}

/**
 * A layer's dynamic style as legend entries, titled by the property each scale
 * describes.
 *
 * A rule that drives a colour is drawn as coloured swatches; one that widens
 * lines or fades them varies its swatches the same way, so a weight or an
 * opacity scale is as readable as a ramp. The entries are built fresh for each
 * draw and belong to the caller; nothing is stored on the layer.
 *
 * @param {object} layerObj
 * @returns {Array<object>} possibly empty
 */
export function dynamicStyleLegendEntries(layerObj) {
    if (getDynamicStyle(layerObj) == null) return []

    let rules = getLayerDynamicStyleRules(layerObj)
    if (rules.length === 0) {
        // The layer hasn't been drawn yet (or is off): describe it from the
        // configuration alone, into a local the renderers never read.
        rules = compileRules(getDynamicStyle(layerObj), {
            fieldStats: layerObj._fieldStats,
            values: {},
        })
    }

    const baseColor = baseColorOf(layerObj)
    const entries = []
    for (const compiledRule of rules) {
        const isColor = COLOR_ATTRIBUTES.includes(compiledRule.attribute)
        if (
            !isColor &&
            NUMERIC_SWATCHES_BY_ATTRIBUTE[compiledRule.attribute] == null
        )
            continue
        const ruleEntries = !isColor
            ? entriesForNumericAttributeRule(compiledRule, baseColor)
            : compiledRule.categorical
              ? entriesForCategoricalRule(compiledRule)
              : entriesForNumericRule(compiledRule)
        if (ruleEntries.length === 0) continue
        // Two rules on the same property are two different scales, so the
        // attribute is named as well as the property.
        ruleEntries[0].scaleTitle = isColor
            ? compiledRule.label || compiledRule.property
            : `${compiledRule.label || compiledRule.property} (${
                  NUMERIC_SWATCHES_BY_ATTRIBUTE[compiledRule.attribute].label
              })`
        entries.push(...ruleEntries)
    }
    return entries
}

const DynamicStyleLegend = { dynamicStyleLegendEntries }

export default DynamicStyleLegend
