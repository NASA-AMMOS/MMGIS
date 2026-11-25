/**
 * IdentifierValueFormat.js
 *
 * How the Identifier writes a raster value, shared by its hover readout and
 * its time-series charts so one reading reads the same in both (#1159).
 * Moved unchanged from the hover readout's inner parseValue.
 */

/**
 * What the hover readout shows for STAC/COG layers: two decimal places
 * (parseIdentifierValue's `sigfigs` is a toFixed digit count), unscaled, in
 * the layer's cogUnits.
 */
export const STAC_VALUE_FORMAT = Object.freeze({ sigfigs: 2, scalefactor: 1 })

/**
 * Round (and optionally scale) a raw value for display.
 * Strings and null pass through; values with up to five integer digits are
 * scaled and fixed to `sigfigs` decimals; exponent-form values are scaled
 * and written in exponent form.
 */
export function parseIdentifierValue(v, sigfigs, scalefactor) {
    var ed = 10
    if (typeof v === 'string') {
        return v
    }
    if (v == null) {
        return v
    } else if (v.toString().indexOf('e') != -1) {
        if (sigfigs != undefined) ed = sigfigs
        if (scalefactor != undefined) v = v * parseFloat(scalefactor)
        v = parseFloat(v)
        return v.toExponential(ed)
    } else {
        var decSplit = v.toString().split('.')
        var decPlacesBefore = decSplit[0] ? decSplit[0].length : 0
        var decPlacesAfter = decSplit[1] ? decSplit[1].length : 0
        if (decPlacesBefore <= 5) {
            if (scalefactor != undefined) v = v * parseFloat(scalefactor)
            if (sigfigs != undefined) v = v.toFixed(sigfigs)
        }
        v = parseFloat(v)
        if (decPlacesAfter >= ed) {
            v = v.toExponential(ed)
        }
        return parseFloat(v)
    }
}

/**
 * The unit of one band: the band's own entry when `units` is a list (one per
 * band), else `units` itself. Shared by the hover readout and the charts so a
 * band gets the same unit in both.
 */
export function unitForBand(units, band) {
    if (Array.isArray(units)) return units[band] ?? ''
    return units || ''
}

/**
 * A STAC/COG reading as the hover readout writes it: the formatted value with
 * the unit appended verbatim (a configured unit carries its own leading
 * space, e.g. ' m'), or "no data" for a masked/absent value.
 */
export function formatStacReading(value, unit) {
    if (value == null || (typeof value === 'number' && !Number.isFinite(value)))
        return 'no data'
    return `${parseIdentifierValue(
        value,
        STAC_VALUE_FORMAT.sigfigs,
        STAC_VALUE_FORMAT.scalefactor
    )}${unit || ''}`
}
