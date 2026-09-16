/**
 * legendHighlight — which legend entry a value read off the map belongs to.
 *
 * @module legendHighlight
 */

import { splitValueUnits } from './legendValueUnits.js'

// `10 - 20`, `10 – 20`, `10 — 20`, with optional units after.
const RANGE =
    /^(-?[0-9][0-9.,]*(?:[eE][-+]?[0-9]+)?)\s*[-–—]\s*(-?[0-9][0-9.,]*(?:[eE][-+]?[0-9]+)?)\s*(.*)$/

/**
 * The number a label carries, without its units. Returns null for a label that
 * is not a number.
 *
 * @param {*} value
 * @returns {number|null}
 */
export function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null
    if (value == null) return null
    const n = parseFloat(splitValueUnits(String(value)).number.replace(/,/g, ''))
    return isFinite(n) ? n : null
}

/**
 * The span a bin label names, as [lower, upper], or null if it names one value.
 *
 * @param {*} value
 * @returns {Array<number>|null}
 */
export function parseRange(value) {
    if (value == null) return null
    const match = String(value).trim().match(RANGE)
    if (!match) return null
    // A leftover number means this was never a span: 2026-09-16 reads as one.
    if (/^[-–—0-9]/.test(match[3].trim())) return null
    const lower = parseFloat(match[1].replace(/,/g, ''))
    const upper = parseFloat(match[2].replace(/,/g, ''))
    if (!isFinite(lower) || !isFinite(upper)) return null
    return lower <= upper ? [lower, upper] : [upper, lower]
}

// What an entry is matched on numerically: the value the layer is styled by
// when it is recorded, else the label.
function entryNumber(entry) {
    if (entry.propertyValue != null && entry.propertyValue !== '')
        return toNumber(entry.propertyValue)
    return toNumber(entry.label)
}

/**
 * Which of `entries` the value belongs to, or -1.
 *
 * Tries the label itself, then the bin whose span contains the value. Only a
 * ramp goes on to the nearest band: its labels are sampled points along a
 * continuum, so a reading between two of them still belongs to one. Discrete
 * rows are unrelated values that happen to be numbers, and nearest would light
 * whichever row a reading happened to sit closest to.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries
 * @param {*} value
 * @param {boolean} allowNearest - true for a ramp, false for discrete rows.
 * @returns {number}
 */
export function resolveEntryIndex(entries, value, allowNearest) {
    if (!Array.isArray(entries) || entries.length === 0) return -1

    const exact = entries.findIndex((entry) => entry.label === String(value))
    if (exact >= 0) return exact

    const target = toNumber(value)
    if (target == null) return -1

    // Bounds are inclusive, so a reading on a seam takes the lower bin.
    const contained = entries.findIndex((entry) => {
        const range = parseRange(entry.propertyValue) || parseRange(entry.label)
        return range != null && target >= range[0] && target <= range[1]
    })
    if (contained >= 0) return contained

    if (!allowNearest) return -1

    let best = -1
    let bestDistance = Infinity
    entries.forEach((entry, i) => {
        const n = entryNumber(entry)
        if (n == null) return
        const distance = Math.abs(n - target)
        if (distance < bestDistance) {
            bestDistance = distance
            best = i
        }
    })
    return best
}

/**
 * The first of `candidates` this legend can place, or -1. The Identifier
 * reports both the number it read and the label its colour matched, since a
 * legend may only be able to speak to one of them.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries
 * @param {Array<*>} candidates
 * @param {boolean} allowNearest
 * @returns {number}
 */
export function resolveCandidateIndex(entries, candidates, allowNearest) {
    if (!Array.isArray(candidates)) return -1
    for (let i = 0; i < candidates.length; i++) {
        const index = resolveEntryIndex(entries, candidates[i], allowNearest)
        if (index >= 0) return index
    }
    return -1
}

const LegendHighlight = {
    toNumber,
    parseRange,
    resolveEntryIndex,
    resolveCandidateIndex,
}

export default LegendHighlight
