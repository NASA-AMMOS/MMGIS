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
 * Which of `entries` the value belongs to, or -1. Tries the label, then the
 * bin whose span contains the value, then - for a ramp only - the nearest.
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
 * The first of `candidates` this legend can place, or -1.
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

// Where the Legend ticks stop i of n. A lone stop has no scale to sit on, so
// it takes the middle rather than dividing by zero.
function tickPosition(count) {
    return count < 2 ? () => 0.5 : (i) => i / (count - 1)
}

/**
 * Where `value` sits along a ramp, as a fraction of its length, or null.
 *
 * A ramp ticks each of its `n` stops, stop i at i / (n - 1), so the ticks span
 * the whole bar. A reading between two stops is placed by interpolating
 * between their ticks; snapping to the nearest stop moves it by up to half a
 * band, which is what put the mark beside the Identifier's readout.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries - in paint order
 * @param {*} value
 * @returns {number|null}
 */
export function resolveScalePosition(entries, value) {
    if (!Array.isArray(entries) || entries.length === 0) return null
    const target = toNumber(value)
    if (target == null) return null

    const tick = tickPosition(entries.length)
    const stops = []
    entries.forEach((entry, i) => {
        const n = entryNumber(entry)
        if (n != null) stops.push({ i: i, value: n })
    })
    if (stops.length === 0) return null
    if (stops.length === 1) return tick(stops[0].i)

    for (let k = 0; k < stops.length - 1; k++) {
        const a = stops[k]
        const b = stops[k + 1]
        if (target < Math.min(a.value, b.value)) continue
        if (target > Math.max(a.value, b.value)) continue
        const span = b.value - a.value
        const fraction = span === 0 ? 0 : (target - a.value) / span
        return tick(a.i) + fraction * (tick(b.i) - tick(a.i))
    }

    // Off the end of the ramp: hold the mark on the stop it ran past.
    const first = stops[0]
    const last = stops[stops.length - 1]
    return Math.abs(target - first.value) <= Math.abs(target - last.value)
        ? tick(first.i)
        : tick(last.i)
}

/**
 * Where the first placeable of `candidates` sits along a ramp, or null. An
 * exact label wins, so a ramp labelled with text still lands on its band.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries - in paint order
 * @param {Array<*>} candidates
 * @returns {number|null}
 */
export function resolveCandidatePosition(entries, candidates) {
    if (!Array.isArray(entries) || entries.length === 0) return null
    if (!Array.isArray(candidates)) return null
    for (let i = 0; i < candidates.length; i++) {
        const exact = entries.findIndex(
            (entry) => entry.label === String(candidates[i])
        )
        if (exact >= 0) return tickPosition(entries.length)(exact)
        const position = resolveScalePosition(entries, candidates[i])
        if (position != null) return position
    }
    return null
}

const LegendHighlight = {
    toNumber,
    parseRange,
    resolveEntryIndex,
    resolveCandidateIndex,
    resolveScalePosition,
    resolveCandidatePosition,
}

export default LegendHighlight
