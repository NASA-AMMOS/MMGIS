/**
 * Shared gradient utility functions for both 2D (Leaflet) and 3D (Cesium) gradient polylines.
 */

// Helper function to interpolate between two colors using RGB
export function interpolateColor(color1, color2, factor) {
    if (!color1 || !color2) return color1 || color2

    // Ensure factor is between 0 and 1
    factor = Math.max(0, Math.min(1, factor))

    // Convert colors to RGB if they're hex
    const rgb1 = hexToRgb(color1) || parseRgb(color1) || parseCSSColor(color1)
    const rgb2 = hexToRgb(color2) || parseRgb(color2) || parseCSSColor(color2)

    if (!rgb1 || !rgb2) return color1 // Fallback if color parsing fails

    // Interpolate each RGB component
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor)
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor)
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor)

    return `rgb(${r}, ${g}, ${b})`
}

// Enhanced function to interpolate between multiple colors using color stops
export function interpolateMultipleColors(
    colorStops,
    value,
    minValue,
    maxValue
) {
    if (!colorStops || colorStops.length === 0) return null
    if (colorStops.length === 1) return colorStops[0].color

    // Normalize the value to 0-1 range
    const normalizedValue =
        maxValue === minValue ? 0 : (value - minValue) / (maxValue - minValue)

    // Clamp the normalized value
    const clampedValue = Math.max(0, Math.min(1, normalizedValue))

    // If we're at the extremes, return the boundary colors
    if (clampedValue === 0) return colorStops[0].color
    if (clampedValue === 1) return colorStops[colorStops.length - 1].color

    // Find the two color stops that bracket our value
    for (let i = 0; i < colorStops.length - 1; i++) {
        const currentStop = colorStops[i]
        const nextStop = colorStops[i + 1]

        if (
            clampedValue >= currentStop.position &&
            clampedValue <= nextStop.position
        ) {
            // Calculate the local factor between these two stops
            const stopRange = nextStop.position - currentStop.position
            const localFactor =
                stopRange === 0
                    ? 0
                    : (clampedValue - currentStop.position) / stopRange

            // Interpolate between the two colors
            return interpolateColor(
                currentStop.color,
                nextStop.color,
                localFactor
            )
        }
    }

    // Fallback (shouldn't reach here)
    return colorStops[colorStops.length - 1].color
}

// Helper function to convert hex color to RGB
export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null

    // Remove # if present
    hex = hex.replace('#', '')

    // Handle 3-character hex
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('')
    }

    if (hex.length !== 6) return null

    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
}

// Helper function to parse rgb() color strings
export function parseRgb(color) {
    if (!color || typeof color !== 'string') return null

    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) return null

    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
    }
}

// Cache for parseCSSColor — avoids repeated DOM mutations for the same color string
const _parseCSSColorCache = new Map()

// Helper function to parse CSS color strings to RGB using browser's built-in capability
export function parseCSSColor(color) {
    if (!color || typeof color !== 'string') return null

    if (_parseCSSColorCache.has(color)) return _parseCSSColorCache.get(color)

    // Use a temporary element to parse the color
    const tempElem = document.createElement('div')
    tempElem.style.color = color

    // If the browser rejected the value it leaves style.color empty — bail early
    if (!tempElem.style.color) {
        _parseCSSColorCache.set(color, null)
        return null
    }

    // Append to body temporarily to get computed style
    document.body.appendChild(tempElem)
    const computedColor = window.getComputedStyle(tempElem).color
    document.body.removeChild(tempElem)

    // Try to parse rgb() or rgba() format
    const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    const result = rgbMatch
        ? {
              r: parseInt(rgbMatch[1]),
              g: parseInt(rgbMatch[2]),
              b: parseInt(rgbMatch[3]),
          }
        : null

    _parseCSSColorCache.set(color, result)
    return result
}

/**
 * Build a stepped color ramp from an array of color strings.
 * Returns an array of { position, color } objects normalized from 0 to 1.
 */
export function buildColorStops(colorRamp) {
    if (!colorRamp || colorRamp.length === 0) return []
    if (colorRamp.length === 1)
        return [{ position: 0, color: colorRamp[0] }]

    return colorRamp.map((color, idx) => ({
        position: idx / (colorRamp.length - 1),
        color: color,
    }))
}

/**
 * Escape a string for safe inclusion in HTML (prevents XSS from GeoJSON values).
 */
export function escapeHtml(str) {
    if (str == null) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * Find the closest point on line segment [a→b] to point p.
 * Coordinates are treated as flat (lng/lat in degrees) — accurate enough for hover.
 *
 * @param {number} px,py  - query point (lng, lat)
 * @param {number} ax,ay  - segment start
 * @param {number} bx,by  - segment end
 * @returns {{ t: number, dist: number }}
 *   t    ∈ [0,1]  parametric position along the segment (0 = a, 1 = b)
 *   dist          Euclidean distance in degrees from p to the closest point
 */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
        return { t: 0, dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2) }
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx
    const cy = ay + t * dy
    return { t, dist: Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) }
}

/**
 * Convert an RGB string like "rgb(r, g, b)" to a hex string like "#rrggbb".
 */
export function rgbToHex(rgbString) {
    if (!rgbString || typeof rgbString !== 'string') return rgbString

    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) return rgbString

    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])

    return (
        '#' +
        ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    )
}
