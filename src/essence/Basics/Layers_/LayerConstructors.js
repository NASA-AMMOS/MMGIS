/**
 * Middleware between geojson and leaflet to extend and reconstruct new features
 */

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import LayerGeologic from './LayerGeologic/LayerGeologic'
import { parseExtendedGeoJSON, getCoordProperties } from './ExtendedGeoJSON'

let L = window.L
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
    let opa = String(layerObj.style.opacity)
    let wei = String(layerObj.style.weight)
    let fiC = layerObj.style.fillColor
    let fiO = String(layerObj.style.fillOpacity)
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
            }

            if (feature.properties.hasOwnProperty('style')) {
                let className = layerObj.style.className
                let layerName = layerObj.style.layerName
                layerObj.style = JSON.parse(
                    JSON.stringify(feature.properties.style)
                )
                if (className) layerObj.style.className = className
                if (layerName) layerObj.style.layerName = layerName
            } else {
                // Priority to prop, prop.color, then style color.
                var finalCol =
                    col.toLowerCase().substring(0, 4) === 'prop'
                        ? F_.parseColor(feature.properties[col.substring(5)]) ||
                          '#FFF'
                        : feature.style && feature.style.stroke != null
                        ? feature.style.stroke
                        : col
                var finalOpa =
                    opa.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[opa.substring(5)] || '1'
                        : feature.style && feature.style.opacity != null
                        ? feature.style.opacity
                        : opa
                var finalWei =
                    wei.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[wei.substring(5)] || '1'
                        : feature.style && feature.style.weight != null
                        ? feature.style.weight
                        : wei
                if (!isNaN(parseInt(finalWei))) finalWei = parseInt(finalWei)
                var finalFiC =
                    fiC.toLowerCase().substring(0, 4) === 'prop'
                        ? F_.parseColor(feature.properties[fiC.substring(5)]) ||
                          '#000'
                        : feature.style && feature.style.fill != null
                        ? feature.style.fill
                        : fiC
                var finalFiO =
                    fiO.toLowerCase().substring(0, 4) === 'prop'
                        ? feature.properties[fiO.substring(5)] || '1'
                        : feature.style && feature.style.fillopacity != null
                        ? feature.style.fillopacity
                        : fiO

                // Check for radius property if radius=1 (default/prop:radius)
                layerObj.style.radius =
                    layerObj.radius == 1
                        ? parseFloat(feature.properties['radius'])
                        : layerObj.radius

                if (preferredStyle && preferredStyle.radius != null)
                    layerObj.style.radius = preferredStyle.radius

                var noPointerEventsClass =
                    feature.style && feature.style.nointeraction
                        ? ' noPointerEvents'
                        : ''

                layerObj.style.color = finalCol
                layerObj.style.opacity = finalOpa
                layerObj.style.weight = finalWei
                layerObj.style.fillColor = finalFiC
                layerObj.style.fillOpacity = finalFiO
            }
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
            if (bearingVar) {
                const unit = bearingVar.angleUnit || 'deg'
                const bearingProp = bearingVar.angleProp || false

                if (bearingProp !== false) {
                    yaw = parseFloat(F_.getIn(feature.properties, bearingProp))
                    if (unit === 'rad') {
                        yaw = yaw * (180 / Math.PI)
                    }
                    layerObj.shape = 'directional_circle'
                }
            }

            switch (layerObj.shape) {
                case 'circle':
                    svg = [
                        `<svg style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<circle cx="12" cy="12" r="${12 - pixelBuffer}"/>`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'directional_circle':
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
                default:
                    layer = L.circleMarker(
                        latlong,
                        leafletLayerObject.style
                    ).setRadius(layerObj.radius)
                    break
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
                        className: `leafletMarkerShape leafletMarkerShape_${layerObj.name
                            .replace(/\s/g, '')
                            .toLowerCase()} ${layerObj.name
                            .replace(/\s/g, '')
                            .toLowerCase()} leafletDivIcon`,
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
    if (F_.getIn(layerObj, 'variables.hideMainFeature') === true) {
        layer = L.geoJson(F_.getBaseGeoJSON(), leafletLayerObject)
        layer._sourceGeoJSON = F_.getBaseGeoJSON()
    } else {
        layer = L.geoJson(geojson, leafletLayerObject)
        if (geojson?.features) layer._sourceGeoJSON = geojson
        else if (geojson && geojson.length > 0 && geojson[0].type === 'Feature')
            layer._sourceGeoJSON = F_.getBaseGeoJSON(geojson)
        else layer._sourceGeoJSON = F_.getBaseGeoJSON()
    }
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
                l.feature
            )
            layer._layers[idx].useKeyAsName = savedUseKeyAsName
            layer._layers[idx].options = savedOptions
            Object.keys(layer._layers[idx]._layers).forEach((idx2) => {
                layer._layers[idx]._layers[idx2].options.layerName =
                    savedOptions.layerName
                layer._layers[idx]._layers[idx2].feature = l.feature
                layer._layers[idx]._layers[idx2].useKeyAsName =
                    savedUseKeyAsName
                l.feature.style = l.feature.style || {}
                l.feature.style.noclick = true
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
        sublayers: constructSublayers(geojson, layerObj, leafletLayerObject),
    }
}

export const constructSublayers = (geojson, layerObj, leafletLayerObject) => {
    // note: sublayer ordering here does denote render order (bottom on top).
    const sublayers = {
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

    if (uncertaintyVar) {
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
        })

        curtainUncertaintyOptions = {
            name: `markerAttachmentUncertainty_${layerObj.name}Curtain`,
            on: true,
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
            on: true,
            order: -9999,
            opacity: 1,
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

                uncertaintyEllipse = F_.toEllipse(
                    latlong,
                    {
                        x: F_.getIn(
                            feature.properties,
                            uncertaintyVar.xAxisProp,
                            1
                        ),
                        y: F_.getIn(
                            feature.properties,
                            uncertaintyVar.yAxisProp,
                            1
                        ),
                    },
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
        return curtainUncertaintyOptions
            ? {
                  on:
                      uncertaintyVar.initialVisibility != null
                          ? uncertaintyVar.initialVisibility
                          : true,
                  type: 'uncertainty_ellipses',
                  curtainLayerId: curtainUncertaintyOptions.name,
                  curtainOptions: curtainUncertaintyOptions,
                  clampedLayerId: clampedUncertaintyOptions.name,
                  clampedOptions: clampedUncertaintyOptions,
                  geojson: geojson,
                  layer: L.geoJson(
                      geojson,
                      leafletLayerObjectUncertaintyEllipse
                  ),
                  title: 'Renders elliptical buffers about point features based on X and Y uncertainty properties.',
              }
            : false
    } else return false
}

const imageOverlays = (geojson, layerObj, leafletLayerObject) => {
    // IMAGE
    const imageVar = F_.getIn(layerObj, 'variables.markerAttachments.image')

    if (imageVar) {
        const imageShow = F_.getIn(
            layerObj,
            'variables.markerAttachments.image.show',
            'click'
        )
        let leafletLayerObjectImageOverlay

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
                    if (imageSettings.angleProp === 'deg')
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
                            opacity: 1,
                            clip: anchors,
                        }),
                    ])
                },
            }
        return imageShow === 'always'
            ? {
                  on:
                      imageVar.initialVisibility != null
                          ? imageVar.initialVisibility
                          : true,
                  layer: L.geoJson(geojson, leafletLayerObjectImageOverlay),
                  title: 'Map rendered image overlays.',
              }
            : false
    } else return false
}

const models = (geojson, layerObj, leafletLayerObject) => {
    // MODEL
    const modelVar = F_.getIn(layerObj, 'variables.markerAttachments.model')

    if (modelVar) {
        const modelShow = F_.getIn(modelVar, 'show', 'click')
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
                if (!modelSettings.model && modelSettings.pathProp) {
                    modelSettings.model = F_.getIn(
                        f.properties,
                        modelSettings.pathProp,
                        null
                    )
                    if (
                        modelSettings.model &&
                        !F_.isUrlAbsolute(modelSettings.model) &&
                        !modelSettings.model.startsWith('public')
                    )
                        modelSettings.model =
                            L_.missionPath + modelSettings.model
                }
                if (modelSettings.model == null) return

                // Figure out mtl path if any
                if (modelSettings.mtlPath || modelSettings.mtlProp) {
                    if (modelSettings.mtlPath == null)
                        modelSettings.mtlPath = F_.getIn(
                            f.properties,
                            modelSettings.mtlProp,
                            null
                        )
                    if (
                        modelSettings.mtlPath &&
                        !F_.isUrlAbsolute(modelSettings.mtlPath) &&
                        !modelSettings.mtlPath.startsWith('public')
                    )
                        modelSettings.mtlPath =
                            L_.missionPath + modelSettings.mtlPath
                }

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
                path: modelSettings.model,
                mtlPath: modelSettings.mtlPath,
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

    if (coordMarkerVar) {
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
        if (pathGradientVar) {
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
                paths.push(path)
            })

            if (min === 0 && max === 0) max = 1

            const hotlines = []
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

            const layer = L.layerGroup(hotlines)
            layer.addDataEnhanced = function (
                geojson,
                layerName,
                subName,
                Map_,
                overrideColorWithProp
            ) {
                Map_.rmNotNull(
                    L_.layersGroupSublayers[layerName][subName].layer
                )
                L_.layersGroupSublayers[layerName][subName].layer = getLayer(
                    geojson,
                    L_.layersGroupSublayers[layerName][subName].layer.layerObj,
                    overrideColorWithProp
                )
                Map_.map.addLayer(
                    L_.layersGroupSublayers[layerName][subName].layer
                )
            }
            layer.dropdown = pathGradientSettings.dropdownColorWithProp
            layer.dropdownValue = pathGradientSettings.colorWithProp
            layer.dropdownFunc = function (layerName, subName, Map_, prop) {
                const l = L_.layersGroupSublayers[layerName][subName]
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
