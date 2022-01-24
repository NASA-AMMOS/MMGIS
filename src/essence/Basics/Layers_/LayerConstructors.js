/**
 * Middleware between geojson and leaflet to extend and reconstruct new features
 */

import $ from 'jquery'
import * as d3 from 'd3'
import { ellipse } from '@turf/turf'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'

let L = window.L
/**
 * Takes regular geojson and makes it fancy with annotations and arrows when applicable
 * @return leaflet geojson
 */
export const constructVectorLayer = (
    geojson,
    layerObj,
    onEachFeatureDefault
) => {
    let col = layerObj.style.color
    let opa = String(layerObj.style.opacity)
    let wei = String(layerObj.style.weight)
    let fiC = layerObj.style.fillColor
    let fiO = String(layerObj.style.fillOpacity)
    let leafletLayerObject = {
        style: function (feature) {
            if (feature.properties.hasOwnProperty('style')) {
                let className = layerObj.style.className
                let layerName = layerObj.style.layerName
                layerObj.style = JSON.parse(
                    JSON.stringify(feature.properties.style)
                )

                layerObj.style.className = className
                layerObj.style.layerName = layerName
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
                if (!isNaN(parseInt(wei))) finalWei = parseInt(wei)
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
                        `<div style="transform: rotateZ(${yaw}deg); transform-origin: center;">`,
                        `<svg style="height=100%;width=100%;overflow: visible;" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
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
                        `<svg style="height=100%px;width=100%px" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M1,21H23L12,2Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'triangle-flipped':
                    svg = [
                        `<svg style="height=100%px;width=100%px;transform:rotate(180deg);" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M1,21H23L12,2Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'square':
                    svg = [
                        `<svg style="width=100%;height=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<rect x="${pixelBuffer}" y="${pixelBuffer}" width="${
                            24 - pixelBuffer * 2
                        }" height="${24 - pixelBuffer * 2}"/>`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'diamond':
                    svg = [
                        `<svg  style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M19,12L12,22L5,12L12,2" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'pentagon':
                    svg = [
                        `<svg  style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,2.5L2,9.8L5.8,21.5H18.2L22,9.8L12,2.5Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'hexagon':
                    svg = [
                        `<svg  style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'star':
                    svg = [
                        `<svg style="height=100%;width=100%"  viewBox="0 0 24 24" fill="${featureStyle.fillColor}" stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'plus':
                    svg = [
                        `<svg style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
                        `<path d="M20 14H14V20H10V14H4V10H10V4H14V10H20V14Z" />`,
                        `</svg>`,
                    ].join('\n')
                    break
                case 'pin':
                    svg = [
                        `<svg style="height=100%;width=100%" viewBox="0 0 24 24" fill="${featureStyle.fillColor} "stroke="${featureStyle.color}" stroke-width="${featureStyle.weight}">`,
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
                            .toLowerCase()}`,
                        iconSize: [
                            (featureStyle.radius + pixelBuffer) * 2,
                            (featureStyle.radius + pixelBuffer) * 2,
                        ],
                        html: svg,
                    }),
                })
            }

            if (layer == null) return

            layer.options.layerName = layerObj.name
            return layer
        }
    }

    const layer = L.geoJson(geojson, leafletLayerObject)

    Object.keys(layer._layers).forEach((idx) => {
        let l = layer._layers[idx]
        const savedUseKeyAsName = l.useKeyAsName
        const savedOptions = l.options
        if (l.feature?.properties?.arrow === true) {
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

    return layer
}

export const constructSublayers = (geojson, layerObj) => {
    //UNCERTAINTY
    const uncertaintyVar = F_.getIn(
        layerObj,
        'variables.markerAttachments.uncertainty'
    )
    const leafletLayerObjectUncertaintyEllipse = {
        pointToLayer: (feature, latlong) => {
            // Marker Attachment Uncertainty
            let uncertaintyEllipse
            let uncertaintyAngle = parseFloat(
                F_.getIn(feature.properties, uncertaintyVar.angleProp, 0)
            )
            if (uncertaintyVar.angleUnit === 'rad')
                uncertaintyAngle = uncertaintyAngle * (180 / Math.PI)

            uncertaintyEllipse = ellipse(
                [latlong.lng, latlong.lat],
                F_.getIn(
                    feature.properties,
                    uncertaintyVar.xAxisProp,
                    Math.random() + 0.5
                ),
                F_.getIn(
                    feature.properties,
                    uncertaintyVar.yAxisProp,
                    Math.random() + 1
                ),
                {
                    units: uncertaintyVar.axisUnits || 'meters',
                    steps: 32,
                    angle: uncertaintyAngle,
                }
            )
            uncertaintyEllipse = L.geoJSON(uncertaintyEllipse, {
                style: {
                    fillOpacity: 0.25,
                    fillColor: uncertaintyVar.color || 'white',
                    color: 'black',
                    weight: 1,
                    opacity: 0.8,
                    className: 'noPointerEventsImportant',
                },
            })
            return uncertaintyEllipse
        },
    }
    // IMAGE
    const imageVar = F_.getIn(layerObj, 'variables.markerAttachments.image')
    const imageShow = F_.getIn(
        layerObj,
        'variables.markerAttachments.image.show',
        'click'
    )
    const leafletLayerObjectImageOverlay = {
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
            let wm = parseFloat(imageSettings.widthMeters)
            let w = parseFloat(imageSettings.widthPixels)
            let h = parseFloat(imageSettings.heightPixels)
            let lngM = F_.metersToDegrees(wm) / 2
            let latM = lngM * (h / w)
            let center = [latlong.lng, latlong.lat]
            let angle = -F_.getIn(
                feature.properties,
                imageSettings.angleProp,
                0
            )
            if (imageSettings.angleProp === 'deg')
                angle = angle * (Math.PI / 180)

            var topLeft = F_.rotatePoint(
                {
                    y: latlong.lat + latM,
                    x: latlong.lng - lngM,
                },
                center,
                angle
            )
            var topRight = F_.rotatePoint(
                {
                    y: latlong.lat + latM,
                    x: latlong.lng + lngM,
                },
                center,
                angle
            )
            var bottomRight = F_.rotatePoint(
                {
                    y: latlong.lat - latM,
                    x: latlong.lng + lngM,
                },
                center,
                angle
            )
            var bottomLeft = F_.rotatePoint(
                {
                    y: latlong.lat - latM,
                    x: latlong.lng - lngM,
                },
                center,
                angle
            )

            var anchors = [
                [topLeft.y, topLeft.x],
                [topRight.y, topRight.x],
                [bottomRight.y, bottomRight.x],
                [bottomLeft.y, bottomLeft.x],
            ]
            return L.layerGroup([
                L.imageTransform(imageSettings.image, anchors, {
                    opacity: 1,
                    clip: anchors,
                }),
            ])
        },
    }

    // MODEL
    const modelVar = F_.getIn(layerObj, 'variables.markerAttachments.model')
    const modelShow = F_.getIn(modelVar, 'show', 'click')
    const modelPositions = []
    const modelRotations = []
    const modelScales = []

    const modelSettings = {
        model: F_.getIn(modelVar, 'path', null),
        mtlPath: F_.getIn(modelVar, 'mtlPath', null),
        yawProp: F_.getIn(modelVar, 'yawProp', 0),
        yawUnit: F_.getIn(modelVar, 'yawUnit', 'rad'),
        invertYaw: F_.getIn(modelVar, 'invertYaw', false),
        pitchProp: F_.getIn(modelVar, 'pitchProp', 0),
        pitchUnit: F_.getIn(modelVar, 'pitchUnit', 'rad'),
        invertPitch: F_.getIn(modelVar, 'invertPitch', false),
        rollProp: F_.getIn(modelVar, 'rollProp', 0),
        rollUnit: F_.getIn(modelVar, 'rollUnit', 'rad'),
        invertRoll: F_.getIn(modelVar, 'invertRoll', false),
        elevationProp: F_.getIn(modelVar, 'elevationProp', 0),
        scaleProp: F_.getIn(modelVar, 'scaleProp', 1),
        show: F_.getIn(modelVar, 'show', 'click'),
        onlyLastN: F_.getIn(modelVar, 'onlyLastN', false),
    }
    let modelOptions

    if (modelSettings.model && modelSettings.show === 'always') {
        if (
            !F_.isUrlAbsolute(modelSettings.model) &&
            !modelSettings.model.startsWith('public')
        )
            modelSettings.model = L_.missionPath + modelSettings.model

        geojson.features.forEach((f, idx) => {
            if (typeof modelSettings.onlyLastN === 'number') {
                if (idx < geojson.features.length - modelSettings.onlyLastN)
                    return
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
                            : F_.getIn(f.properties, modelSettings.yawProp, 0),
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
                            : F_.getIn(f.properties, modelSettings.rollProp, 0),
                }
                if (modelSettings.yawUnit === 'deg') rotation.y *= Math.PI / 180
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

    const sublayers = {
        uncertainty_ellipses: uncertaintyVar
            ? {
                  on:
                      uncertaintyVar.initialVisibility != null
                          ? uncertaintyVar.initialVisibility
                          : true,
                  layer: L.geoJson(
                      geojson,
                      leafletLayerObjectUncertaintyEllipse
                  ),
              }
            : false,
        image_overlays:
            imageVar && imageShow === 'always'
                ? {
                      on:
                          imageVar.initialVisibility != null
                              ? imageVar.initialVisibility
                              : true,
                      layer: L.geoJson(geojson, leafletLayerObjectImageOverlay),
                  }
                : false,
        models:
            modelVar && modelShow === 'always' && modelOptions
                ? {
                      on:
                          modelVar.initialVisibility != null
                              ? modelVar.initialVisibility
                              : true,
                      type: 'model',
                      layerId: modelOptions.name,
                      modelOptions: modelOptions,
                  }
                : false,
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
