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

import { COLOR_ATTRIBUTES, binEdges } from './dynamicStyle'
import {
    compileLayerDynamicStyle,
    getDynamicStyle,
    getLayerDynamicStyleRules,
} from './layerDynamicStyle'

// Swatches sampled across a continuous ramp. Enough to look smooth; the
// LegendTool thins the labels to what fits.
const RAMP_SWATCHES = 9

/**
 * A number short enough to sit beside a swatch: significant digits rather than
 * fixed decimals, so 0.0021 and 21000 are both readable.
 *
 * @param {number} value
 * @returns {string}
 */
export function formatValue(value) {
    if (!Number.isFinite(value)) return ''
    if (value === 0) return '0'
    const magnitude = Math.abs(value)
    if (magnitude >= 1e6 || magnitude < 1e-3)
        return value.toExponential(1).replace('e+', 'e')
    const decimals = magnitude >= 100 ? 0 : magnitude >= 1 ? 1 : 3
    return String(parseFloat(value.toFixed(decimals)))
}

function entriesForNumericRule(compiledRule) {
    const { rule, domain, resolve } = compiledRule
    if (domain == null) return []

    if (rule.discrete) {
        const bins = Math.max(1, Math.round(Number(rule.bins) || 5))
        return binEdges(domain, bins)
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
    const { rule, resolve } = compiledRule
    // Two mappings of the same value: the resolver keeps the later one, so the
    // legend labels the later one too.
    const byValue = new Map()
    for (const mapping of rule.mappings) {
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
 * Only rules that drive a colour are drawn — a rule that widens lines by
 * confidence has nothing a swatch can show. The entries are built fresh for
 * each draw and belong to the caller; nothing is stored on the layer.
 *
 * @param {object} layerObj
 * @returns {Array<object>} possibly empty
 */
export function dynamicStyleLegendEntries(layerObj) {
    if (getDynamicStyle(layerObj) == null) return []

    let rules = getLayerDynamicStyleRules(layerObj)
    if (rules.length === 0) {
        // The layer hasn't been drawn yet (or is off): describe it from the
        // configuration alone, which is all the domain it can have anyway.
        compileLayerDynamicStyle(layerObj, [])
        rules = getLayerDynamicStyleRules(layerObj)
    }

    const entries = []
    for (const compiledRule of rules) {
        if (!COLOR_ATTRIBUTES.includes(compiledRule.attribute)) continue
        const ruleEntries =
            compiledRule.rule.type === 'categorical'
                ? entriesForCategoricalRule(compiledRule)
                : entriesForNumericRule(compiledRule)
        if (ruleEntries.length === 0) continue
        ruleEntries[0].scaleTitle = compiledRule.property
        entries.push(...ruleEntries)
    }
    return entries
}

const DynamicStyleLegend = {
    dynamicStyleLegendEntries,
    formatValue,
}

export default DynamicStyleLegend
