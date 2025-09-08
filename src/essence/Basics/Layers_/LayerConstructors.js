/**
 * Middleware between geojson and leaflet to extend and reconstruct new features
 */

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import LayerGeologic from './LayerGeologic/LayerGeologic'
import { parseExtendedGeoJSON, getCoordProperties } from './ExtendedGeoJSON'

import { centroid } from '@turf/turf'

let L = window.L

// Helper function to interpolate between two colors using RGB
function interpolateColor(color1, color2, factor) {
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
function interpolateMultipleColors(colorStops, value, minValue, maxValue) {
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
function hexToRgb(hex) {
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
function parseRgb(color) {
    if (!color || typeof color !== 'string') return null

    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) return null

    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
    }
}

// Helper function to parse CSS color strings to RGB using browser's built-in capability
function parseCSSColor(color) {
    if (!color || typeof color !== 'string') return null

    // Use a temporary element to parse the color
    const tempElem = document.createElement('div')
    tempElem.style.color = color

    // Append to body temporarily to get computed style
    document.body.appendChild(tempElem)
    const computedColor = window.getComputedStyle(tempElem).color
    document.body.removeChild(tempElem)

    // If the browser couldn't parse it, computed color will be empty
    if (!computedColor || computedColor === '') return null

    // Try to parse rgb() or rgba() format
    const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3]),
        }
    }

    return null
}

const tooltipProto = L.Tooltip.prototype
const tooltipProto_setPosition = tooltipProto._setPosition
L.Tooltip.include({
    _setPosition: function (pos) {
        if (this._source?.feature?.geometry.type === 'Point') {
            const offset = this.options.pointOffset || [0, 0]
            L.DomUtil.setPosition(this._container, {
                x: pos.x + offset[0],
                y: pos.y + offset[1],
            })
        } else tooltipProto_setPosition.call(this, pos)
    },
})

/**
 * Takes regular geojson and makes it fancy with annotations and arrows when applicable
 * @return leaflet geojson
 */
export const constructVectorLayer = (
    geojson,
    layerObj,
    onEachFeatureDefault,
    Map_
) => {
    let col = layerObj.style.color
    if (layerObj.style.colorProp != null && layerObj.style.colorProp !== '')
        col = `prop:${layerObj.style.colorProp}`

    let opa = String(layerObj.style.opacity)
    if (layerObj.style.opacityProp != null && layerObj.style.opacityProp !== '')
        opa = `prop:${layerObj.style.opacityProp}`

    let wei = String(layerObj.style.weight)
    if (layerObj.style.weightProp != null && layerObj.style.weightProp !== '')
        wei = `prop:${layerObj.style.weightProp}`

    let fiC = layerObj.style.fillColor
    if (
        layerObj.style.fillColorProp != null &&
        layerObj.style.fillColorProp !== ''
    )
        fiC = `prop:${layerObj.style.fillColorProp}`

    let fiO = String(layerObj.style.fillOpacity)
    if (
        layerObj.style.fillOpacityProp != null &&
        layerObj.style.fillOpacityProp !== ''
    )
        fiO = `prop:${layerObj.style.fillOpacityProp}`

    let rad = String(layerObj.style.radius || layerObj.radius)
    if (rad === 'undefined') rad = '8'
    if (layerObj.style.radiusProp != null && layerObj.style.radiusProp !== '')
        rad = `prop:${layerObj.style.radiusProp}`

    let leafletLayerObject = {
        style: function (feature, preferredStyle) {
            if (preferredStyle) {
                col = preferredStyle.color != null ? preferredStyle.color : col
                opa =
                    preferredStyle.opacity != null
                        ? String(preferredStyle.opacity)
                        : opa
                wei =
                    preferredStyle.weight != null
                        ? String(preferredStyle.weight)
                        : wei
                fiC =
                    preferredStyle.fillColor != null
                        ? preferredStyle.fillColor
                        : fiC
                fiO =
                    preferredStyle.fillOpacity != null
                        ? String(preferredStyle.fillOpacity)
                        : fiO
                rad =
                    preferredStyle.radius != null
                        ? String(preferredStyle.radius)
                        : rad
            }

            // Check for legend-based property styling (takes priority over configured styles but not over feature.properties.style)
            const legendData = L_.layers.data[layerObj.name]?._legend
            if (legendData && Array.isArray(legendData)) {
                // Group legend entries by property name for gradient interpolation
                const propertyGroups = {}
                for (let legendEntry of legendData) {
                    if (
                        legendEntry.styleMatching &&
                        legendEntry.propertyName &&
                        legendEntry.propertyValue !== undefined
                    ) {
                        if (!propertyGroups[legendEntry.propertyName]) {
                            propertyGroups[legendEntry.propertyName] = []
                        }
                        propertyGroups[legendEntry.propertyName].push(
                            legendEntry
                        )
                    }
                }

                // Process each property group
                for (let propertyName in propertyGroups) {
                    const featureValue = feature.properties[propertyName]
                    const entries = propertyGroups[propertyName]

                    // Check if this should use continuous interpolation
                    const isNumericValue = typeof featureValue === 'number'

                    // Only get entries that are marked as continuous
                    const continuousEntries = entries.filter(
                        (entry) => entry.shape === 'continuous'
                    )

                    const numericEntries = continuousEntries
                        .map((entry) => ({
                            ...entry,
                            numericValue: parseFloat(entry.propertyValue),
                        }))
                        .filter((entry) => !isNaN(entry.numericValue))
                        .sort((a, b) => a.numericValue - b.numericValue)

                    const shouldUseContinuous =
                        isNumericValue && numericEntries.length >= 2

                    if (shouldUseContinuous) {
                        // Use gradient interpolation for continuous numeric values
                        // Find min and max values for normalization
                        const minValue = numericEntries[0].numericValue
                        const maxValue =
                            numericEntries[numericEntries.length - 1]
                                .numericValue

                        // Create color stops for fill colors
                        const fillColorStops = numericEntries
                            .filter((entry) => entry.color)
                            .map((entry) => ({
                                position:
                                    maxValue === minValue
                                        ? 0
                                        : (entry.numericValue - minValue) /
                                          (maxValue - minValue),
                                color: entry.color,
                            }))

                        // Create color stops for stroke colors
                        const strokeColorStops = numericEntries
                            .filter((entry) => entry.strokecolor || entry.color)
                            .map((entry) => ({
                                position:
                                    maxValue === minValue
                                        ? 0
                                        : (entry.numericValue - minValue) /
                                          (maxValue - minValue),
                                color: entry.strokecolor || entry.color,
                            }))

                        // Interpolate colors using the enhanced multi-color function
                        if (fillColorStops.length >= 1) {
                            const interpolatedFillColor =
                                fillColorStops.length === 1
                                    ? fillColorStops[0].color
                                    : interpolateMultipleColors(
                                          fillColorStops,
                                          featureValue,
                                          minValue,
                                          maxValue
                                      )

                            if (interpolatedFillColor) {
                                fiC = interpolatedFillColor
                            }
                        }

                        if (strokeColorStops.length >= 1) {
                            const interpolatedStrokeColor =
                                strokeColorStops.length === 1
                                    ? strokeColorStops[0].color
                                    : interpolateMultipleColors(
                                          strokeColorStops,
                                          featureValue,
                                          minValue,
                                          maxValue
                                      )

                            if (interpolatedStrokeColor) {
                                col = interpolatedStrokeColor
                            }
                        }

                        break // Found styling, stop processing other properties
                    } else {
                        // Use exact matching for discrete values (strings, booleans, or entries not marked as continuous)
                        let exactMatch = null
                        // Only check entries that are not marked as continuous
                        const discreteEntries = entries.filter(
                            (entry) => entry.shape !== 'continuous'
                        )

                        for (let entry of discreteEntries) {
                            let matches = false
                            if (
                                typeof featureValue === 'string' &&
                                typeof entry.propertyValue === 'string'
                            ) {
                                matches = featureValue === entry.propertyValue
                            } else if (
                                typeof featureValue === 'number' &&
                                !isNaN(parseFloat(entry.propertyValue))
                            ) {
                                matches =
                                    featureValue ===
                                    parseFloat(entry.propertyValue)
                            } else if (typeof featureValue === 'boolean') {
                                matches =
                                    featureValue ===
                                    (entry.propertyValue === 'true' ||
                                        entry.propertyValue === true)
                            } else {
                                matches =
                                    String(featureValue) ===
                                    String(entry.propertyValue)
                            }

                            if (matches) {
                                exactMatch = entry
                                break
                            }
                        }

                        if (exactMatch) {
                            if (exactMatch.color) {
                                fiC = exactMatch.color
                            }
                            if (exactMatch.strokecolor) {
                                col = exactMatch.strokecolor
                            }
                            if (exactMatch.color && !exactMatch.strokecolor) {
                                col = exactMatch.color
                            }
                            break // Found styling, stop processing other properties
                        }
                    }
                }
            }

            if (feature.properties.hasOwnProperty('style')) {
                let className = layerObj.uuid
                let layerName = layerObj.style.layerName
                layerObj.style = Object.assign({}, layerObj.style)
                layerObj.style = {
                    ...layerObj.style,
                    ...JSON.parse(JSON.stringify(feature.properties.style)),
                }

                if (className) layerObj.style.className = className
                if (layerName) layerObj.style.layerName = layerName
            } else {
                // Priority to prop, prop.color, then style color.
                var finalCol =
                    col != null && col.toLowerCase().substring(0, 4) === 'prop'
                        ? F_.parseColor(feature.properties[col.substring(5)]) ||
                          '#FFF'
                        : feature.style && feature.style.stroke != null
                        ? feature.style.stroke
                        : col
                var finalOpa =
                    opa != null && opa.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[opa.substring(5)] || '1'
                        : feature.style && feature.style.opacity != null
                        ? feature.style.opacity
                        : opa
                var finalWei =
                    wei != null && wei.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[wei.substring(5)] || '1'
                        : feature.style && feature.style.weight != null
                        ? feature.style.weight
                        : wei
                if (!isNaN(parseInt(finalWei))) finalWei = parseInt(finalWei)
                var finalFiC =
                    fiC != null && fiC.toLowerCase().substring(0, 4) === 'prop'
                        ? F_.parseColor(feature.properties[fiC.substring(5)]) ||
                          '#000'
                        : feature.style && feature.style.fill != null
                        ? feature.style.fill
                        : fiC
                var finalFiO =
                    fiO != null && fiO.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[fiO.substring(5)] || '1'
                        : feature.style && feature.style.fillopacity != null
                        ? feature.style.fillopacity
                        : fiO

                var finalRad =
                    rad != null && rad.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[rad.substring(5)] ||
                          layerObj.radius ||
                          '8'
                        : feature.style &&
                          feature.style.radius != null &&
                          feature.style.radius != 'undefined'
                        ? feature.style.radius
                        : rad
                if (!isNaN(parseInt(finalRad))) finalRad = parseInt(finalRad)

                // Check for radius property if radius=1 (default/prop:radius)

                var noPointerEventsClass =
                    feature.style && feature.style.nointeraction
                        ? ' noPointerEvents'
                        : ''

                layerObj.style.color = finalCol || '#FFF'
                layerObj.style.opacity = finalOpa === 'undefined' ? 1 : finalOpa
                layerObj.style.weight =
                    finalWei === 'undefined' ? '2' : finalWei
                layerObj.style.fillColor = finalFiC || '#FFF'
                layerObj.style.fillOpacity =
                    finalFiO === 'undefined' ? '1' : finalFiO

                layerObj.style.radius = finalRad || 8
            }
            if (
                noPointerEventsClass != null &&
                layerObj.style.className.indexOf(noPointerEventsClass) === -1
            )
                layerObj.style.className =
                    layerObj.style.className + noPointerEventsClass
            layerObj.style.metadata = geojson.metadata || {}

            if (
                feature.properties?.style?.geologic &&
                feature.properties.style.geologic.type === 'pattern' &&
                feature.geometry.type != null &&
                (feature.geometry.type.toLowerCase() === 'polygon' ||
                    feature.geometry.type.toLowerCase() === 'multipolygon') &&
                typeof LayerGeologic.getUrl === 'function'
            ) {
                const style = feature.properties.style
                const g = style.geologic

                layerObj.style.fillPattern = LayerGeologic.getFillPattern(
                    LayerGeologic.getUrl(
                        g.type,
                        LayerGeologic.getTag(g.tag, g.color)
                    ),
                    g.size,
                    g.fillColor
                        ? g.fillColor[0] === '#'
                            ? F_.hexToRGBA(
                                  g.fillColor,
                                  g.fillOpacity == null ? 1 : g.fillOpacity
                              )
                            : g.fillColor || 'none'
                        : 'none',
                    Map_.map
                )
            }
            return layerObj.style
        },
        onEachFeature: (function (layerObjName) {
            return onEachFeatureDefault
        })(layerObj.name),
    }

    let hasSublayers = false

    if (layerObj.hasOwnProperty('radius')) {
        let markerIcon = null
        if (
            layerObj.hasOwnProperty('variables') &&
            layerObj.variables.hasOwnProperty('markerIcon')
        ) {
            let markerIconOptions = F_.clone(layerObj.variables.markerIcon)
            if (
                markerIconOptions.iconUrl &&
                !F_.isUrlAbsolute(markerIconOptions.iconUrl)
            )
                markerIconOptions.iconUrl =
                    L_.missionPath + markerIconOptions.iconUrl
            if (
                markerIconOptions.shadowUrl &&
                !F_.isUrlAbsolute(markerIconOptions.shadowUrl)
            )
                markerIconOptions.shadowUrl =
                    L_.missionPath + markerIconOptions.shadowUrl

            markerIcon = new L.icon(markerIconOptions)
        }

        leafletLayerObject.pointToLayer = function (feature, latlong) {
            const featureStyle = leafletLayerObject.style(feature)
            let svg = ''
            let layer = null
            const pixelBuffer = featureStyle.weight || 0

            // Bearing Attachment
            let yaw = 0
            const bearingVar = F_.getIn(
                layerObj,
                'variables.markerAttachments.bearing'
            )
            if (
                bearingVar &&
                (bearingVar.enabled === true || bearingVar.enabled == null)
            ) {
                const unit = bearingVar.angleUnit || 'deg'
                const bearingProp = bearingVar.angleProp || false

                if (bearingProp !== false) {
                    yaw = parseFloat(F_.getIn(feature.properties, bearingProp))
                    if (unit === 'rad') {
                        yaw = yaw * (180 / Math.PI)
                    }
                    if (bearingVar.useCustomShape !== true)
                        layerObj.shape = 'directional-circle'
                }

                const markerXY = Map_.map.latLngToLayerPoint(latlong)
                const markerLatLong = Map_.map.containerPointToLatLng([
                    markerXY.x,
                    markerXY.y,
                ])
                const pixelBelowMarkerLatLong = Map_.map.containerPointToLatLng(
                    [markerXY.x, markerXY.y + 1]
                )
                yaw -= F_.bearingBetweenTwoLatLngs(
                    pixelBelowMarkerLatLong.lat,
                    pixelBelowMarkerLatLong.lng,
                    markerLatLong.lat,
                    markerLatLong.lng
                )
                yaw = -((360 - yaw) % 360)
            }

            // Use style.shapeProp
            let finalShape =
                layerObj.style.shapeIcon || layerObj.shape || 'none'

            if (
                layerObj.style.shapeProp != null &&
                layerObj.style.shapeProp != ''
            ) {
                const candidateShape = F_.getIn(
                    feature.properties,
                    layerObj.style.shapeProp,
                    null
                )
                if (candidateShape) finalShape = candidateShape
            }

            switch (finalShape) {
                case 'circle':
                    svg = [
                        `<svg style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<circle cx="12" cy="12" r="${12 - pixelBuffer}"/>`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'directional-circle':
                    svg = [
                        `<div style="height: 100%; width: 100%;transform: rotateZ(${yaw}deg); transform-origin: center;">`,
                        `<svg style="overflow: visible;" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,8L4.5,20.29L5.21,21L18.79,21L19.5,20.29L12,8Z" transform="translate(0 ${-(
                            12 -
                            pixelBuffer +
                            6
                        )})"fill="${
                            layerObj.variables?.markerAttachments?.bearing
                                ?.color || featureStyle.color
                        }" stroke-width="1"/>`,
                        `<circle cx="12" cy="12" r="${12 - pixelBuffer}"/>`,
                        `</svg>`,
                        `</div>`,
                    ].join('\n')
                    break
                case 'triangle':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M1,21H23L12,2Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'triangle-flipped':
                    svg = [
                        `<svg style="transform:rotate(180deg);" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M1,21H23L12,2Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'square':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<rect x="${pixelBuffer}" y="${pixelBuffer}" width="${
                            24 - pixelBuffer * 2
                        }" height="${24 - pixelBuffer * 2}"/>`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'diamond':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M19,12L12,22L5,12L12,2" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'pentagon':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,2.5L2,9.8L5.8,21.5H18.2L22,9.8L12,2.5Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'hexagon':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'star':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'plus':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M20 14H14V20H10V14H4V10H10V4H14V10H20V14Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'pin':
                    svg = [
                        `<svg viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'none':
                    layer = L.circleMarker(
                        latlong,
                        leafletLayerObject.style
                    ).setRadius(layerObj.style.radius || layerObj.radius || 8)
                    break
                default:
                    svg = [
                        `<div style="color: ${
                            featureStyle.fillColor
                        }; transform: scale(${
                            ((layerObj.style.radius || layerObj.radius || 8) *
                                2) /
                            24
                        }) rotate(${
                            (layerObj.style.shapeRotationOffset != null
                                ? parseFloat(layerObj.style.shapeRotationOffset)
                                : 0) + (yaw || 0)
                        }deg); ${
                            layerObj.style.weight != 0
                                ? `text-shadow:  
                            1px 1px 0px ${featureStyle.color}, 
                            -1px -1px 0px ${featureStyle.color}, 
                            1px -1px 0px ${featureStyle.color}, 
                            -1px 1px 0px ${featureStyle.color},

                            0px 1px 0px ${featureStyle.color}, 
                            -1px 0px 0px ${featureStyle.color}, 
                            0px -1px 0px ${featureStyle.color}, 
                            1px 0px 0px ${featureStyle.color}; `
                                : ''
                        }
                            display: block;
                            text-align: center;"
                            ><i class='mdi mdi-${finalShape.replace(
                                /[^a-zA-Z-]/g,
                                ''
                            )} mdi-24px'></i></div>`,
                    ]
            }

            if (markerIcon) {
                const markerOptions = {
                    icon: markerIcon,
                }
                if (yaw != null && yaw !== 0) markerOptions.rotationAngle = yaw
                if (markerIcon.options?.iconAnchor?.length >= 2)
                    markerOptions.rotationOrigin = `${markerIcon.options.iconAnchor[0]}px ${markerIcon.options.iconAnchor[1]}px`
                layer = L.marker(latlong, markerOptions)
            } else if (layer == null && svg != null) {
                layer = L.marker(latlong, {
                    icon: L.divIcon({
                        className: `leafletMarkerShape leafletMarkerShape_${F_.getSafeName(
                            layerObj.name
                        )} ${F_.getSafeName(layerObj.name)} leafletDivIcon`,
                        iconSize: [
                            (featureStyle.radius + pixelBuffer) * 2,
                            (featureStyle.radius + pixelBuffer) * 2,
                        ],
                        html: svg,
                    }),
                    bubblingMouseEvents: true,
                })
            }

            if (layer == null) return

            layer.options.layerName = layerObj.name
            return layer
        }
    }

    let layer
    if (F_.getIn(layerObj, 'variables.hideMainFeature') === true)
        layer = L.geoJson(F_.getBaseGeoJSON(), leafletLayerObject)
    else layer = L.geoJson(geojson, leafletLayerObject)

    if (geojson?.features?.length) layer._sourceGeoJSON = geojson
    else if (geojson && geojson.length > 0 && geojson[0].type === 'Feature')
        layer._sourceGeoJSON = F_.getBaseGeoJSON(geojson)
    else layer._sourceGeoJSON = F_.getBaseGeoJSON()

    layer._layerName = layerObj.name

    Object.keys(layer._layers).forEach((idx) => {
        let l = layer._layers[idx]
        const savedUseKeyAsName = l.useKeyAsName
        const savedOptions = l.options

        if (l.feature?.properties?.style?.geologic != null) {
            const geom = l.feature.geometry
            const style = l.feature?.properties?.style

            let made = false
            switch (l.feature?.properties?.style?.geologic.type) {
                case 'pattern':
                    // We can augment existing polygons for this so patterns are
                    // implemented above in the style object
                    made = false
                    break
                case 'linework':
                    if (geom.type.toLowerCase() === 'linestring') {
                        layer._layers[idx] = LayerGeologic.createLinework(
                            l.feature,
                            style
                        )
                        made = true
                    }
                    break
                case 'symbol':
                    if (geom.type.toLowerCase() === 'point') {
                        layer._layers[idx] = LayerGeologic.createSymbolMarker(
                            geom.coordinates[1],
                            geom.coordinates[0],
                            style
                        )
                        made = true
                    }
                    break
                default:
                    made = false
                    break
            }
            if (made) {
                layer._layers[idx].options.layerName = savedOptions.layerName
                layer._layers[idx].feature = l.feature
                layer._layers[idx].useKeyAsName = savedUseKeyAsName
                l.feature.style = l.feature.style || {}
                onEachFeatureDefault(l.feature, layer._layers[idx])
                if (layer._layers[idx]._layers) {
                    Object.keys(layer._layers[idx]._layers).forEach((idx2) => {
                        layer._layers[idx]._layers[idx2].options.layerName =
                            savedOptions.layerName
                        layer._layers[idx]._layers[idx2].feature = l.feature
                        layer._layers[idx]._layers[idx2].useKeyAsName =
                            savedUseKeyAsName

                        l.feature.style = l.feature.style || {}
                        onEachFeatureDefault(
                            l.feature,
                            layer._layers[idx]._layers[idx2]
                        )
                    })
                }
            }
        } else if (l.feature?.properties?.arrow === true) {
            const c = l.feature.geometry.coordinates
            const start = new L.LatLng(c[0][1], c[0][0])
            const end = new L.LatLng(c[1][1], c[1][0])

            layer._layers[idx] = L_.addArrowToMap(
                null,
                start,
                end,
                l.feature?.properties?.style,
                l.feature,
                idx,
                null,
                true
            )
            layer._layers[idx].useKeyAsName = savedUseKeyAsName
            layer._layers[idx].options = savedOptions
            layer._idx = idx
            layer._isArrow = true
            layer._layers[idx]._idx = idx
            layer._layers[idx]._isArrow = true
            Object.keys(layer._layers[idx]._layers).forEach((idx2) => {
                layer._layers[idx]._layers[idx2]._idx = idx
                layer._layers[idx]._layers[idx2]._isArrow = true
                layer._layers[idx]._layers[idx2].options.layerName =
                    savedOptions.layerName
                layer._layers[idx]._layers[idx2].feature = l.feature
                layer._layers[idx]._layers[idx2].useKeyAsName =
                    savedUseKeyAsName
                l.feature.style = l.feature.style || {}
                onEachFeatureDefault(
                    l.feature,
                    layer._layers[idx]._layers[idx2]
                )
            })
        } else if (l.feature?.properties?.annotation === true) {
            layer._layers[idx] = L_.createAnnotation(
                l.feature,
                'LayerAnnotation',
                layer._layers[idx].options.layerName,
                idx
            )
        }
    })

    return {
        layer: layer,
        sublayers: constructSublayers(
            geojson,
            layerObj,
            leafletLayerObject,
            layer
        ),
    }
}

export const constructSublayers = (
    geojson,
    layerObj,
    leafletLayerObject,
    layer
) => {
    // note: sublayer ordering here does denote render order (bottom on top).
    const sublayers = {
        labels: false,
        pairings: pairings(geojson, layerObj, leafletLayerObject),
        uncertainty_ellipses: uncertaintyEllipses(
            geojson,
            layerObj,
            leafletLayerObject
        ),
        image_overlays: imageOverlays(geojson, layerObj, leafletLayerObject),
        models: models(geojson, layerObj, leafletLayerObject),
        coordinate_markers: coordinateMarkers(
            geojson,
            layerObj,
            leafletLayerObject
        ),
        path_gradient: pathGradient(geojson, layerObj, leafletLayerObject),
    }
    // We want this to show up first in the list and also want labels for other sublayers too
    sublayers.labels = labels(
        geojson,
        layerObj,
        leafletLayerObject,
        layer,
        sublayers
    )

    const sublayerArray = []
    for (let s in sublayers) {
        if (sublayers[s] !== false) {
            sublayers[s].sublayerType = s
            sublayerArray.push(sublayers[s])
        }
    }

    if (sublayerArray.length > 0) return sublayers
    return false
}

// ======= SUBLAYER FUNCTIONS ============
const labels = (geojson, layerObj, leafletLayerObject, layer, sublayers) => {
    //LABELS
    const labelsVar = F_.getIn(layerObj, 'variables.layerAttachments.labels')

    if (
        labelsVar &&
        (labelsVar.enabled === true || labelsVar.enabled == null)
    ) {
        let theme = ['solid'].includes(labelsVar.theme)
            ? labelsVar.theme
            : 'default'

        let size = ['large'].includes(labelsVar.size)
            ? labelsVar.size
            : 'default'

        let yOffset
        if (theme === 'solid' && size === 'default') yOffset = -11
        else if (theme === 'solid' && size === 'large') yOffset = -12
        else if (theme === 'default' && size === 'default') yOffset = -9
        else if (theme === 'default' && size === 'large') yOffset = -11

        // specify tooltip options
        const customOptions = {
            className: `mmgisFeatureLabel mmgisLabelTheme-${theme} mmgisLabelSize-${size}`,
            permanent: true,
            direction: 'top',
            opacity: 1,
            offset: [0, -yOffset + 6],
            pointOffset: [0, yOffset],
        }

        const mainDropdownProps = tooltipBuilder(layer)
        if (sublayers?.coordinate_markers?.layer) {
            const coordMarkerDropdownProps = tooltipBuilder(
                sublayers?.coordinate_markers?.layer,
                mainDropdownProps.dropdownValue
            )

            mainDropdownProps.dropdown = F_.removeDuplicatesInArray(
                mainDropdownProps.dropdown.concat(
                    coordMarkerDropdownProps.dropdown
                )
            )

            mainDropdownProps.dropdownValue =
                mainDropdownProps.dropdownValue ||
                coordMarkerDropdownProps.dropdownValue
        }

        function tooltipBuilder(leafletLayer, dropdownValue) {
            let dropdownProps = {
                dropdown: [],
                dropdownValue: null,
            }
            leafletLayer.eachLayer((l) => {
                if (
                    !l.feature.properties.arrow === true &&
                    !l.feature.properties.annotation === true
                ) {
                    dropdownProps.dropdown = Object.keys(l.feature.properties)
                    dropdownProps.dropdownValue =
                        dropdownValue != null ? dropdownValue : l.useKeyAsName

                    const value =
                        l.feature.properties[dropdownProps.dropdownValue]
                    let xOffset = 1

                    if (l.feature?.geometry?.type === 'Point')
                        xOffset +=
                            (layerObj.style?.radius || 0) +
                            (layerObj.style?.weight || 0) * 2

                    customOptions.pointOffset[0] = xOffset
                    if (labelsVar.initialVisibility === true)
                        l.bindTooltip(
                            `<div class='mmgisFeatureLabelContent'>${value}</div>`,
                            customOptions
                        )
                }
            })

            return dropdownProps
        }

        layer.dropdown = mainDropdownProps.dropdown
        layer.dropdownValue = mainDropdownProps.dropdownValue
        layer.dropdownFunc = (layerName, subName, Map_, prop) => {
            const sublayer = L_.layers.attachments[layerName][subName]
            layer.dropdownValue = prop
            if (sublayer.on) layer.on()
        }

        layer.off = () => {
            const tooltipLayersOff = (leafletLayer, subname) => {
                leafletLayer.eachLayer((l) => {
                    if (l._tooltip) {
                        l.closeTooltip()
                        l.unbindTooltip()
                    }
                })

                const name = `labels_${layer._layerName}_${
                    subname || 'main'
                }`.replace(/ /g, '_')
                L_.Globe_.litho.removeLayer(name)
            }
            tooltipLayersOff(layer)
            if (sublayers?.coordinate_markers?.layer)
                tooltipLayersOff(
                    sublayers?.coordinate_markers?.layer,
                    'coordinate_markers'
                )
        }
        layer.on = (firstTime) => {
            const tooltipLayersOn = (leafletLayer, subname) => {
                leafletLayer.eachLayer((l) => {
                    if (
                        !l.feature.properties.arrow === true &&
                        !l.feature.properties.annotation === true
                    ) {
                        const value = l.feature.properties[layer.dropdownValue]
                        const content = `<div class='mmgisFeatureLabelContent'>${value}</div>`
                        if (l._tooltip) l._tooltip.setContent(content)
                        else {
                            let xOffset = 1
                            if (l.feature?.geometry?.type === 'Point')
                                xOffset +=
                                    (layerObj.style?.radius || 0) +
                                    (layerObj.style?.weight || 0) * 2

                            customOptions.pointOffset[0] = xOffset
                            l.bindTooltip(content, customOptions)
                        }
                        l.openTooltip()
                    }
                })
                const setForGlobe = () => {
                    const globeLabels = []
                    leafletLayer.eachLayer((l) => {
                        if (
                            !l.feature.properties.arrow === true &&
                            !l.feature.properties.annotation === true &&
                            l._tooltip?._latlng?.lng != null
                        ) {
                            const value =
                                l.feature.properties[layer.dropdownValue]
                            const globeLabel = {
                                type: 'Feature',
                            }
                            globeLabel.properties = {
                                annotation: true,
                                name: value,
                            }
                            globeLabel.geometry = {
                                type: 'Point',
                                coordinates: [
                                    l._tooltip._latlng.lng,
                                    l._tooltip._latlng.lat,
                                    l._tooltip._latlng.alt,
                                ],
                            }
                            globeLabels.push(globeLabel)
                        }
                    })

                    const name = `labels_${layer._layerName}_${
                        subname || 'main'
                    }`.replace(/ /g, '_')
                    if (L_.Globe_) {
                        L_.Globe_.litho.removeLayer(name)
                        L_.Globe_.litho.addLayer('vector', {
                            name: name,
                            on: true,
                            // GeoJSON or path to geojson
                            // [lng, lat, elev?]
                            geojson: {
                                type: 'FeatureCollection',
                                features: globeLabels,
                            },
                            style: {
                                letPropertiesStyleOverride: true,
                                default: {
                                    color: 'rgb(0, 0, 0)',
                                    fillColor: 'rgb(255, 255, 255)',
                                    fillOpacity: 1,
                                    weight: 2,
                                    fontSize:
                                        size === 'large' ? '18px' : '16px',
                                    elevOffset: 4,
                                },
                            },
                            opacity: 1,
                        })
                    }
                }

                // Short timeout since initial tooltip placement computation can take a bit
                setTimeout(() => {
                    setForGlobe()
                }, 1500)
            }

            tooltipLayersOn(layer)
            if (sublayers?.coordinate_markers?.layer)
                tooltipLayersOn(
                    sublayers?.coordinate_markers?.layer,
                    'coordinate_markers'
                )
        }

        if (labelsVar.initialVisibility === true) layer.on(true)

        layer.addDataEnhanced = function (geojson, layerName, subName) {
            this.addData(geojson)
            if (L_.layers.attachments[layerName][subName].on) this.on()
        }

        return {
            on: L_.layers.attachments[layerObj.name]?.labels
                ? L_.layers.attachments[layerObj.name]?.labels.on
                : labelsVar.initialVisibility != null
                ? labelsVar.initialVisibility
                : true,
            type: 'labels',
            geojson: geojson,
            layer: layer,
            title: 'Feature Labels',
            minZoom: 0,
            maxZoom: 100,
        }
    } else return false
}

// Draws a thin faint line to the center of features from other layers that are connected to this layer
const pairings = (geojson, layerObj, leafletLayerObject) => {
    //PAIRINGS
    const pairingsVar = F_.getIn(
        layerObj,
        'variables.layerAttachments.pairings'
    )

    if (
        pairingsVar &&
        (pairingsVar.enabled === true || pairingsVar.enabled == null)
    ) {
        const layers = (pairingsVar.layers || []).map((l) => L_.asLayerUUID(l))

        const pairProp = pairingsVar.pairProp
        const layersAzProp = pairingsVar.layersAzProp
        const layersElProp = pairingsVar.layersElProp
        const style = pairingsVar.style || {}
        const styleObject = {
            style: {
                ...{
                    weight: 2,
                    color: 'yellow',
                    opacity: 0.35,
                },
                ...style,
            },
        }

        if (layers.length === 0 || pairProp == null) {
            console.warn(
                `Layer '${layerObj.name}' has badly formed 'pairings' attachments object. Missing 'layers' or 'pairProp'.`
            )
            return
        }

        const getPairingLayer = (dontCalculate, forceGeojson) => {
            const pairingLineFeatures = []
            if (forceGeojson) geojson = forceGeojson
            if (!dontCalculate)
                geojson.features.forEach((f) => {
                    const featureCenter = centroid(f).geometry.coordinates
                    const pairValue = F_.getIn(
                        f.properties,
                        pairProp,
                        '___null'
                    )

                    layers.forEach((layerName) => {
                        if (
                            L_.layers.layer[layerName] &&
                            L_.layers.layer[layerName]._sourceGeoJSON &&
                            L_.layers.on[layerName] === true
                        ) {
                            L_.layers.layer[
                                layerName
                            ]._sourceGeoJSON.features.forEach((pairFeature) => {
                                if (
                                    F_.getIn(
                                        pairFeature.properties,
                                        pairProp,
                                        null
                                    ) === pairValue
                                ) {
                                    const pairFeatureCenter =
                                        centroid(pairFeature).geometry
                                            .coordinates

                                    pairingLineFeatures.push({
                                        type: 'Feature',
                                        properties: {},
                                        geometry: {
                                            type: 'LineString',
                                            coordinates: [
                                                featureCenter,
                                                pairFeatureCenter,
                                            ],
                                        },
                                    })
                                }
                            })
                        }
                    })
                })

            let layer = L.geoJson(pairingLineFeatures, styleObject)

            layer.on = (firstTime, sublayerLayer) => {
                const layerMain =
                    L_.layers.attachments?.[layerObj.name]?.pairings?.layer
                if (layerMain == null) return

                layerMain.off()
                // For checking whether we can use the previous layer instead of recreating
                const constructedFromLayers = []
                layers.forEach((layerName) => {
                    if (
                        L_.layers.layer[layerName] &&
                        L_.layers.layer[layerName]._sourceGeoJSON &&
                        L_.layers.on[layerName] === true
                    ) {
                        constructedFromLayers.push(layerName)
                    }
                })
                const constructedTag = constructedFromLayers.join('__')

                // Check if "", since if it is, no need to add anything
                if (constructedTag.length > 0) {
                    if (
                        sublayerLayer == null ||
                        constructedTag !== layerMain.constructedTag
                    ) {
                        L_.layers.attachments[layerObj.name].pairings.layer =
                            getPairingLayer()
                        L_.layers.attachments[
                            layerObj.name
                        ].pairings.layer.constructedTag = constructedTag
                        if (sublayerLayer)
                            sublayerLayer =
                                L_.layers.attachments[layerObj.name].pairings
                                    .layer
                    }
                    L_.Map_.map.addLayer(layerMain)
                    layerMain.setZIndex(
                        L_._layersOrdered.length +
                            1 -
                            L_._layersOrdered.indexOf(layerObj.name)
                    )
                }
            }
            layer.off = () => {
                const layerMain =
                    L_.layers.attachments?.[layerObj.name]?.pairings?.layer
                if (layerMain == null) return

                L_.Map_.rmNotNull(layerMain)
            }
            return layer
        }

        // Doesn't matter if Map isn't attached to Layers for the first time
        if (L_.Map_) {
            L_.Map_.rmNotNull(
                L_.layers.attachments?.[layerObj.name]?.pairings?.layer
            )
        }
        const layer = getPairingLayer(true)

        layer.addDataEnhanced = function (geojson, layerName, subName, Map_) {
            Map_.rmNotNull(L_.layers.attachments[layerName][subName].layer)
            L_.layers.attachments[layerName][subName].geojson = geojson
            L_.layers.attachments[layerName][subName].layer = getPairingLayer(
                false,
                geojson
            )
            Map_.map.addLayer(L_.layers.attachments[layerName][subName].layer) //
        }

        return {
            on: L_.layers.attachments[layerObj.name]?.pairings
                ? L_.layers.attachments[layerObj.name]?.pairings.on
                : pairingsVar.initialVisibility != null
                ? pairingsVar.initialVisibility
                : true,
            pairedLayers: layers,
            pairProp: pairProp,
            layersAzProp: layersAzProp,
            layersElProp: layersElProp,
            originOffsetOrder: pairingsVar.originOffsetOrder,
            type: 'pairings',
            geojson: geojson,
            layer: layer,
            title: 'Feature Pairings',
            minZoom: 0,
            maxZoom: 100,
        }
    } else {
        return false
    }
}

const uncertaintyEllipses = (geojson, layerObj, leafletLayerObject) => {
    //UNCERTAINTY
    const uncertaintyVar = F_.getIn(
        layerObj,
        'variables.markerAttachments.uncertainty'
    )
    let uncertaintyStyle
    let curtainUncertaintyOptions
    let clampedUncertaintyOptions
    let leafletLayerObjectUncertaintyEllipse

    if (
        uncertaintyVar &&
        (uncertaintyVar.enabled === true || uncertaintyVar.enabled == null)
    ) {
        let existingOn = null
        let existingOpacity =
            uncertaintyVar.initialOpacity != null
                ? uncertaintyVar.initialOpacity
                : 1
        if (L_.layers.attachments[L_.asLayerUUID(layerObj.name)]) {
            existingOn =
                L_.layers.attachments[L_.asLayerUUID(layerObj.name)]
                    .uncertainty_ellipses.on
            existingOpacity = L_.layers.opacity[layerObj.name]
        }

        const isOn =
            existingOn != null
                ? existingOn
                : uncertaintyVar.initialVisibility != null
                ? uncertaintyVar.initialVisibility
                : true

        uncertaintyStyle = {
            fillOpacity: uncertaintyVar.fillOpacity || 0.25,
            fillColor: uncertaintyVar.color || 'white',
            color: uncertaintyVar.strokeColor || 'black',
            weight: uncertaintyVar.weight || 1,
            opacity: uncertaintyVar.opacity || 0.8,
            className: 'noPointerEventsImportant',
        }
        // For Globe Curtains
        const uncertaintyEllipseFeatures = []
        const depth3d = uncertaintyVar.depth3d || 2
        geojson.features.forEach((f) => {
            let uncertaintyAngle = parseFloat(
                F_.getIn(f.properties, uncertaintyVar.angleProp, 0)
            )
            if (uncertaintyVar.angleUnit === 'rad')
                uncertaintyAngle = uncertaintyAngle * (180 / Math.PI)

            if (f.geometry.type === 'Point') {
                const feature = F_.toEllipse(
                    {
                        lat: f.geometry.coordinates[1],
                        lng: f.geometry.coordinates[0],
                    },
                    {
                        x: F_.getIn(f.properties, uncertaintyVar.xAxisProp, 1),
                        y: F_.getIn(f.properties, uncertaintyVar.yAxisProp, 1),
                    },
                    window.mmgisglobal.customCRS,
                    {
                        units: uncertaintyVar.axisUnits || 'meters',
                        steps: 32,
                        angle: uncertaintyAngle,
                    }
                )
                if (feature) {
                    for (
                        let i = 0;
                        i < feature.geometry.coordinates[0].length;
                        i++
                    ) {
                        feature.geometry.coordinates[0][i][2] =
                            f.geometry.coordinates[2] + depth3d
                    }
                    uncertaintyEllipseFeatures.push(feature)
                }
            }
        })

        curtainUncertaintyOptions = {
            name: `markerAttachmentUncertainty_${layerObj.name}Curtain`,
            on: isOn,
            opacity: uncertaintyVar.opacity3d || 0.5,
            imageColor:
                uncertaintyVar.color3d || uncertaintyVar.color || '#FFFF00',
            depth: depth3d + 1,
            geojson: {
                type: 'FeatureCollection',
                features: uncertaintyEllipseFeatures,
            },
        }
        clampedUncertaintyOptions = {
            name: `markerAttachmentUncertainty_${layerObj.name}Clamped`,
            on: isOn,
            order: -9999,
            opacity: existingOpacity,
            minZoom: 0,
            maxZoom: 100,
            geojson: {
                type: 'FeatureCollection',
                features: uncertaintyEllipseFeatures,
            },
            style: {
                default: uncertaintyStyle,
            },
        }

        // For Leaflet
        leafletLayerObjectUncertaintyEllipse = {
            pointToLayer: (feature, latlong) => {
                // Marker Attachment Uncertainty
                let uncertaintyEllipse
                let uncertaintyAngle = parseFloat(
                    F_.getIn(feature.properties, uncertaintyVar.angleProp, 0)
                )
                if (uncertaintyVar.angleUnit === 'rad')
                    uncertaintyAngle = uncertaintyAngle * (180 / Math.PI)

                const xy = {
                    x: F_.getIn(
                        feature.properties,
                        uncertaintyVar.xAxisProp,
                        false
                    ),
                    y: F_.getIn(
                        feature.properties,
                        uncertaintyVar.yAxisProp,
                        false
                    ),
                }
                if (xy.x === false && xy.y === false) return null

                uncertaintyEllipse = F_.toEllipse(
                    latlong,
                    xy,
                    window.mmgisglobal.customCRS,
                    {
                        units: uncertaintyVar.axisUnits || 'meters',
                        steps: 32,
                        angle: uncertaintyAngle,
                    }
                )

                uncertaintyEllipse = L.geoJSON(uncertaintyEllipse, {
                    style: uncertaintyStyle,
                })
                return uncertaintyEllipse
            },
        }

        const layer = L.geoJson(geojson, leafletLayerObjectUncertaintyEllipse)
        layer.customClearLayers = function (layerName, subName) {
            const sublayer = L_.layers.attachments[layerName][subName]
            L_.Globe_.litho.removeLayer(sublayer.curtainLayerId)
            L_.Globe_.litho.removeLayer(sublayer.clampedLayerId)
        }

        return curtainUncertaintyOptions
            ? {
                  on: isOn,
                  type: 'uncertainty_ellipses',
                  curtainLayerId: curtainUncertaintyOptions.name,
                  curtainOptions: curtainUncertaintyOptions,
                  clampedLayerId: clampedUncertaintyOptions.name,
                  clampedOptions: clampedUncertaintyOptions,
                  geojson: geojson,
                  layer: layer,
                  title: 'Renders elliptical buffers about point features based on X and Y uncertainty properties.',
              }
            : false
    } else return false
}

const imageOverlays = (geojson, layerObj, leafletLayerObject) => {
    // IMAGE
    const imageVar = F_.getIn(layerObj, 'variables.markerAttachments.image')

    if (imageVar && (imageVar.enabled === true || imageVar.enabled == null)) {
        const imageShow = F_.getIn(
            layerObj,
            'variables.markerAttachments.image.show',
            'click'
        )
        let leafletLayerObjectImageOverlay

        let existingOn = null
        let existingOpacity =
            imageVar.initialOpacity != null ? imageVar.initialOpacity : 1
        if (L_.layers.attachments[L_.asLayerUUID(layerObj.name)]) {
            existingOn =
                L_.layers.attachments[L_.asLayerUUID(layerObj.name)]
                    .image_overlays.on
            existingOpacity =
                L_.layers.attachments[L_.asLayerUUID(layerObj.name)]
                    .image_overlays.opacity
        }

        const isOn =
            existingOn != null
                ? existingOn
                : imageVar.initialVisibility != null
                ? imageVar.initialVisibility
                : true

        if (imageVar && imageShow === 'always')
            leafletLayerObjectImageOverlay = {
                pointToLayer: (feature, latlong) => {
                    const path = F_.getIn(
                        layerObj,
                        'variables.markerAttachments.image.path',
                        'public/images/rovers/PerseveranceTopDown.png'
                    )
                    let imageSettings = {
                        image: F_.getIn(
                            feature.properties,
                            F_.getIn(
                                layerObj,
                                'variables.markerAttachments.image.pathProp',
                                path
                            ),
                            path
                        ),
                        widthMeters: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.widthMeters',
                            2.6924
                        ),
                        widthPixels: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.widthPixels',
                            420
                        ),
                        heightPixels: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.heightPixels',
                            600
                        ),
                        angleProp: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.angleProp',
                            'yaw_rad'
                        ),
                        angleUnit: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.angleUnit',
                            'rad'
                        ),
                        show: F_.getIn(
                            layerObj,
                            'variables.markerAttachments.image.show',
                            'click'
                        ),
                    }
                    const wm = parseFloat(imageSettings.widthMeters)
                    const w = parseFloat(imageSettings.widthPixels)
                    const h = parseFloat(imageSettings.heightPixels)
                    let angle = -F_.getIn(
                        feature.properties,
                        imageSettings.angleProp,
                        0
                    )
                    if (imageSettings.angleUnit === 'deg')
                        angle = angle * (Math.PI / 180)

                    const crs = window.mmgisglobal.customCRS
                    const centerEN = crs.project(latlong)
                    const center = [centerEN.x, centerEN.y]
                    const xM = wm / 2
                    const yM = (wm * (h / w)) / 2
                    const topLeft = crs.unproject(
                        F_.rotatePoint(
                            {
                                y: centerEN.y + yM,
                                x: centerEN.x - xM,
                            },
                            center,
                            angle
                        )
                    )

                    const topRight = crs.unproject(
                        F_.rotatePoint(
                            {
                                y: centerEN.y + yM,
                                x: centerEN.x + xM,
                            },
                            center,
                            angle
                        )
                    )

                    const bottomRight = crs.unproject(
                        F_.rotatePoint(
                            {
                                y: centerEN.y - yM,
                                x: centerEN.x + xM,
                            },
                            center,
                            angle
                        )
                    )

                    const bottomLeft = crs.unproject(
                        F_.rotatePoint(
                            {
                                y: centerEN.y - yM,
                                x: centerEN.x - xM,
                            },
                            center,
                            angle
                        )
                    )

                    const anchors = [
                        [topLeft.lat, topLeft.lng],
                        [topRight.lat, topRight.lng],
                        [bottomRight.lat, bottomRight.lng],
                        [bottomLeft.lat, bottomLeft.lng],
                    ]

                    return L.layerGroup([
                        L.imageTransform(imageSettings.image, anchors, {
                            opacity: existingOpacity,
                            clip: anchors,
                            id: `${layerObj.name}_${imageSettings.image}`,
                            layerName: layerObj.name,
                        }),
                    ])
                },
            }

        return imageShow === 'always'
            ? {
                  on: isOn,
                  type: 'image_overlays',
                  opacity: existingOpacity,
                  layer: L.geoJson(geojson, leafletLayerObjectImageOverlay),
                  title: 'Map rendered image overlays.',
              }
            : false
    } else return false
}

const models = (geojson, layerObj, leafletLayerObject) => {
    // MODEL
    const modelVar = F_.getIn(layerObj, 'variables.markerAttachments.model')

    if (modelVar && (modelVar.enabled === true || modelVar.enabled == null)) {
        const modelShow = F_.getIn(modelVar, 'show', 'click')
        const modelPaths = []
        const modelMtlPaths = []
        const modelPositions = []
        const modelRotations = []
        const modelScales = []

        const modelSettings = {
            model: F_.getIn(modelVar, 'path', null),
            pathProp: F_.getIn(modelVar, 'pathProp', null),
            mtlPath: F_.getIn(modelVar, 'mtlPath', null),
            mtlProp: F_.getIn(modelVar, 'mtlProp', null),
            yawProp: F_.getIn(modelVar, 'yawProp', null),
            yawUnit: F_.getIn(modelVar, 'yawUnit', 'rad'),
            invertYaw: F_.getIn(modelVar, 'invertYaw', false),
            pitchProp: F_.getIn(modelVar, 'pitchProp', null),
            pitchUnit: F_.getIn(modelVar, 'pitchUnit', 'rad'),
            invertPitch: F_.getIn(modelVar, 'invertPitch', false),
            rollProp: F_.getIn(modelVar, 'rollProp', null),
            rollUnit: F_.getIn(modelVar, 'rollUnit', 'rad'),
            invertRoll: F_.getIn(modelVar, 'invertRoll', false),
            elevationProp: F_.getIn(modelVar, 'elevationProp', null),
            scaleProp: F_.getIn(modelVar, 'scaleProp', 1),
            show: F_.getIn(modelVar, 'show', 'click'),
            onlyLastN: F_.getIn(modelVar, 'onlyLastN', false),
        }

        let modelOptions
        if (
            (modelSettings.model || modelSettings.pathProp) &&
            modelSettings.show === 'always'
        ) {
            geojson.features.forEach((f, idx) => {
                if (typeof modelSettings.onlyLastN === 'number') {
                    if (idx < geojson.features.length - modelSettings.onlyLastN)
                        return
                }

                // Figure out model path
                let modelPath = null
                if (!modelSettings.model && modelSettings.pathProp) {
                    modelPath = F_.getIn(
                        f.properties,
                        modelSettings.pathProp,
                        null
                    )
                } else {
                    modelPath = modelSettings.model
                }
                if (
                    modelPath &&
                    !F_.isUrlAbsolute(modelPath) &&
                    !modelPath.startsWith('public')
                )
                    modelPath = L_.missionPath + modelPath
                modelPaths.push(modelPath)

                // Figure out mtl path if any
                let mtlPath = null
                if (!modelSettings.mtlPath && modelSettings.mtlProp) {
                    mtlPath = F_.getIn(
                        f.properties,
                        modelSettings.mtlProp,
                        null
                    )
                } else {
                    mtlPath = modelSettings.mtlPath
                }
                if (
                    mtlPath &&
                    !F_.isUrlAbsolute(mtlPath) &&
                    !mtlPath.startsWith('public')
                )
                    mtlPath = L_.missionPath + mtlPath
                modelMtlPaths.push(mtlPath)

                if (f.geometry.type.toLowerCase() === 'point') {
                    const coords = f.geometry.coordinates
                    const position = {
                        latitude: coords[1],
                        longitude: coords[0],
                        elevation:
                            typeof modelSettings.elevationProp === 'number'
                                ? modelSettings.elevationProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.elevationProp,
                                      coords[2]
                                  ),
                    }

                    const rotation = {
                        y:
                            typeof modelSettings.yawProp === 'number'
                                ? modelSettings.yawProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.yawProp,
                                      0
                                  ),
                        x:
                            typeof modelSettings.pitchProp === 'number'
                                ? modelSettings.pitchProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.pitchProp,
                                      0
                                  ),
                        z:
                            typeof modelSettings.rollProp === 'number'
                                ? modelSettings.rollProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.rollProp,
                                      0
                                  ),
                    }
                    if (modelSettings.yawUnit === 'deg')
                        rotation.y *= Math.PI / 180
                    if (modelSettings.invertYaw) rotation.y *= -1
                    if (modelSettings.pitchUnit === 'deg')
                        rotation.x *= Math.PI / 180
                    if (modelSettings.invertPitch) rotation.x *= -1
                    if (modelSettings.rollUnit === 'deg')
                        rotation.z *= Math.PI / 180
                    if (modelSettings.invertRoll) rotation.z *= -1

                    const scale =
                        typeof modelSettings.scaleProp === 'number'
                            ? modelSettings.scaleProp
                            : F_.getIn(f.properties, modelSettings.scaleProp, 1)
                    modelPositions.push(position)
                    modelRotations.push(rotation)
                    modelScales.push(scale)
                }
            })

            modelOptions = {
                name: `markerAttachmentModel_${layerObj.name}`,
                order: 99999,
                on: true,
                path: modelPaths,
                mtlPath: modelMtlPaths,
                opacity: 1,
                isArrayed: true,
                position: modelPositions,
                rotation: modelRotations,
                scale: modelScales,
            }
        }

        return modelShow === 'always' && modelOptions
            ? {
                  on:
                      modelVar.initialVisibility != null
                          ? modelVar.initialVisibility
                          : true,
                  type: 'model',
                  layerId: modelOptions.name,
                  modelOptions: modelOptions,
                  title: 'Associated 3D models for the Globe View.',
              }
            : false
    } else return false
}

const coordinateMarkers = (geojson, layerObj, leafletLayerObject) => {
    // COORDINATE MARKERS
    const coordMarkerVar = F_.getIn(
        layerObj,
        'variables.coordinateAttachments.marker'
    )

    if (
        coordMarkerVar &&
        (coordMarkerVar.enabled === true || coordMarkerVar.enabled == null)
    ) {
        const coordMarkerSettings = {
            initialVisibility: F_.getIn(
                coordMarkerVar,
                'initialVisibility',
                true
            ),
            opacity: F_.getIn(coordMarkerVar, 'opacity', null),
            color: F_.getIn(coordMarkerVar, 'color', null),
            weight: F_.getIn(coordMarkerVar, 'weight', null),
            fillColor: F_.getIn(coordMarkerVar, 'fillColor', null),
            fillOpacity: F_.getIn(coordMarkerVar, 'fillOpacity', null),
            radius: F_.getIn(coordMarkerVar, 'radius', null),
        }

        const leafletLayerObjectCoordinateMarkers = {
            onEachFeature: leafletLayerObject.onEachFeature,
            pointToLayer: leafletLayerObject.pointToLayer,
            style: function (feature) {
                const style = leafletLayerObject.style(
                    feature,
                    coordMarkerSettings
                )
                feature._style = style
                return feature._style
            },
        }

        const layer = L.geoJson(
            parseExtendedGeoJSON(geojson, ['coord_properties']),
            leafletLayerObjectCoordinateMarkers
        )
        layer.addDataEnhanced = function (geojson) {
            this.addData(parseExtendedGeoJSON(geojson, ['coord_properties']))
        }

        return {
            on:
                coordMarkerVar.initialVisibility != null
                    ? coordMarkerVar.initialVisibility
                    : true,
            type: 'coordinate_markers',
            geojson: geojson,
            layer: layer,
            title: 'Markers rendered at every coordinate pair of every feature.',
        }
    } else return false
}

const pathGradient = (geojson, layerObj, leafletLayerObject) => {
    function getLayer(geojson, layerObj, overrideColorWithProp) {
        // PATH GRADIENT
        const pathGradientVar = F_.getIn(
            layerObj,
            'variables.pathAttachments.gradient'
        )
        if (
            pathGradientVar &&
            (pathGradientVar.enabled === true ||
                pathGradientVar.enabled == null)
        ) {
            const pathGradientSettings = {
                initialVisibility: F_.getIn(
                    pathGradientVar,
                    'initialVisibility',
                    true
                ),
                colorWithProp:
                    overrideColorWithProp ||
                    F_.getIn(pathGradientVar, 'colorWithProp', null),
                dropdownColorWithProp: F_.getIn(
                    pathGradientVar,
                    'dropdownColorWithProp',
                    []
                ),
                colorRamp: F_.getIn(pathGradientVar, 'colorRamp', [
                    'lime',
                    'yellow',
                    'red',
                ]),
                weight: F_.getIn(pathGradientVar, 'weight', 4),
                connectAllPoints: F_.getIn(
                    pathGradientVar,
                    'connectAllPoints',
                    false
                ),
            }

            // check validity
            if (pathGradientSettings.colorWithProp == null) {
                console.warn(
                    'LayerConstructor - `pathAttachments.gradient` set but required `pathAttachments.gradient.colorWithProp` is unset.'
                )
                return false
            }

            // Add colorWithProps to dropdown if not already
            if (
                !pathGradientSettings.dropdownColorWithProp.includes(
                    pathGradientSettings.colorWithProp
                )
            )
                pathGradientSettings.dropdownColorWithProp.unshift(
                    pathGradientSettings.colorWithProp
                )

            // format colorRamp
            const steppedColorRamp = {}
            pathGradientSettings.colorRamp.forEach((color, idx) => {
                steppedColorRamp[
                    idx / (pathGradientSettings.colorRamp.length - 1)
                ] = color
            })

            const paths = []
            var min = Infinity
            var max = -Infinity
            var prevParentIndex = null
            geojson.features.forEach((feature) => {
                let path = []
                if (pathGradientSettings.connectAllPoints) {
                    if (feature.geometry.type.toLowerCase() === 'point') {
                        let value = F_.getIn(
                            feature.properties,
                            pathGradientSettings.colorWithProp,
                            0
                        )
                        if (min > value) min = value
                        if (max < value) max = value
                        path = [
                            feature.geometry.coordinates[1],
                            feature.geometry.coordinates[0],
                            value,
                        ]
                    }
                } else {
                    F_.coordinateDepthTraversal(
                        feature.geometry.coordinates,
                        (array, _path) => {
                            // Find breaks in the coordinate array to find sepearate features
                            const splitPath = _path.split('.')
                            let parentIndex = null
                            if (splitPath.length >= 2) {
                                parentIndex = splitPath[splitPath.length - 2]
                                if (
                                    prevParentIndex != null &&
                                    parentIndex != prevParentIndex
                                ) {
                                    paths.push(path)
                                    path = []
                                }
                            }
                            const value = F_.getIn(
                                getCoordProperties(geojson, feature, array),
                                pathGradientSettings.colorWithProp,
                                0
                            )
                            if (min > value) min = value
                            if (max < value) max = value

                            path.push([array[1], array[0], value])

                            // Save this for next run through
                            prevParentIndex = parentIndex
                        }
                    )
                }
                paths.push(path)
            })

            if (min === 0 && max === 0) max = 1

            const hotlines = []

            if (pathGradientSettings.connectAllPoints) {
                hotlines.push(
                    L.hotline(paths, {
                        min: min,
                        max: max,
                        palette: steppedColorRamp,
                        weight: pathGradientSettings.weight,
                    })
                )
            } else {
                paths.forEach((path) => {
                    if (path.length > 0)
                        hotlines.push(
                            L.hotline(path, {
                                min: min,
                                max: max,
                                palette: steppedColorRamp,
                                weight: pathGradientSettings.weight,
                            })
                        )
                })
            }

            const layer = L.layerGroup(hotlines)
            layer.addDataEnhanced = function (
                geojson,
                layerName,
                subName,
                Map_,
                overrideColorWithProp
            ) {
                Map_.rmNotNull(L_.layers.attachments[layerName][subName].layer)
                L_.layers.attachments[layerName][subName].layer = getLayer(
                    geojson,
                    L_.layers.attachments[layerName][subName].layer.layerObj,
                    overrideColorWithProp
                )
                Map_.map.addLayer(
                    L_.layers.attachments[layerName][subName].layer
                )
            }
            layer.dropdown = pathGradientSettings.dropdownColorWithProp
            layer.dropdownValue = pathGradientSettings.colorWithProp
            layer.dropdownFunc = function (layerName, subName, Map_, prop) {
                const l = L_.layers.attachments[layerName][subName]
                l.layer.addDataEnhanced(
                    l.geojson,
                    layerName,
                    subName,
                    Map_,
                    prop
                )
            }
            layer.layerObj = layerObj

            return layer
        } else return false
    }

    const layer = getLayer(geojson, layerObj)
    if (layer) {
        const pathGradientVar = F_.getIn(
            layerObj,
            'variables.pathAttachments.gradient'
        )

        return {
            on:
                pathGradientVar.initialVisibility != null
                    ? pathGradientVar.initialVisibility
                    : true,
            type: 'path_gradient',
            geojson: geojson,
            layer: layer,
            title: 'A colorful visualization of values along a path.\nPoint values from the specified feature property are min-max fit to a color ramp.',
        }
    } else return false
}
