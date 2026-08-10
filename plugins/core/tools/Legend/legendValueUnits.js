/**
 * legendValueUnits — split a legend label into its number and its units.
 *
 * @module legendValueUnits
 */

// A number, with an exponent if it has one: the exponent belongs to the number,
// not to whatever unit follows it, so `1.8e10 km` is 1.8e10 of km.
const NUMBER_THEN_UNITS = /^([0-9.,\-\s]+(?:[eE][-+]?[0-9]+)?)(.*)$/

/**
 * A label's number and units. A label that does not start with a number is all
 * number and no units, so it is never partly hidden.
 *
 * @param {*} value
 * @returns {{ number: string, units: string }}
 */
export function splitValueUnits(value) {
    const text = String(value == null ? '' : value).trim()
    const match = text.match(NUMBER_THEN_UNITS)
    if (!match) return { number: text, units: '' }
    return { number: match[1].trim(), units: match[2].trim() }
}

/**
 * The units every label shares, if they all share one. Labels that disagree
 * have no common units, so nothing is taken off them.
 *
 * @param {Array<*>} values
 * @returns {{ number: string, units: string }}
 */
export function extractUnits(values) {
    if (!Array.isArray(values) || values.length === 0)
        return { number: '', units: '' }
    const first = splitValueUnits(values[0])
    const shared = values.every(
        (value) => splitValueUnits(value).units === first.units
    )
    return shared ? first : { number: first.number, units: '' }
}

const LegendValueUnits = { splitValueUnits, extractUnits }

export default LegendValueUnits
