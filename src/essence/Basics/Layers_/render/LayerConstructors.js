/**
 * Middleware between geojson and leaflet to extend and reconstruct new features
 */

import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import LayerGeologic from '../LayerGeologic/LayerGeologic'
import LayerAttachmentRegistry from '../registry/LayerAttachmentRegistry'
import LayerInterface from '../interface/LayerInterface'
import refreshLayer from '../lifecycle/refresh'
import acquire from '../lifecycle/acquire'
import {
    compileLayerDynamicStyle,
    getLayerDynamicStyleResolver,
} from './layerDynamicStyle'
import { ensureFieldStats } from './dynamicStyleRuntime'

let L = window.L

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

    // Snapshot the original style so it can be restored on every feature call
    const _originalStyle = layerObj.style

    // Compiled once here rather than per feature: a rule's ramp and domain are
    // the same for every feature of the layer. The resolver is then read off
    // the layer at style time rather than closed over, so recompiling it (a
    // ramp switched at runtime, a domain restretched to the current view) takes
    // effect on a restyle instead of needing the layer remade.
    compileLayerDynamicStyle(layerObj, geojson?.features)
    // A geodataset's whole-dataset domain lives on the server; asking for it
    // restyles the layer when it arrives.
    ensureFieldStats(layerObj)

    let leafletLayerObject = {
        style: function (feature, preferredStyle) {
            // Restore to original before applying per-feature overrides so
            // mutations from a previous feature don't bleed into this one
            layerObj.style = Object.assign({}, _originalStyle)
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

                // Styling from data: wins over the configured style and the
                // `*Prop` fields above, loses to feature.properties.style.
                const dynamicStyle = getLayerDynamicStyleResolver(layerObj)
                if (dynamicStyle != null) {
                    const dynamic = dynamicStyle(feature.properties)
                    if (dynamic != null) Object.assign(layerObj.style, dynamic)
                }
            }
            if (
                noPointerEventsClass != null &&
                layerObj.style.className.indexOf(noPointerEventsClass) === -1
            )
                layerObj.style.className =
                    layerObj.style.className + noPointerEventsClass

            // Add animation class if animation is enabled
            var animationClass = ''
            if (
                layerObj.style.animation &&
                layerObj.style.animation !== 'none'
            ) {
                animationClass = ' mmgis-vector-' + layerObj.style.animation
            }
            if (
                animationClass !== '' &&
                layerObj.style.className.indexOf(animationClass) === -1
            ) {
                layerObj.style.className =
                    layerObj.style.className + animationClass
            }

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
            } else {
                // Clear fillPattern if feature doesn't have a geologic pattern
                layerObj.style.fillPattern = null
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

            // An attachment may draw nothing of its own and instead change how
            // its host draws this marker (a bearing turns it to face a
            // heading). Core asks and applies what comes back.
            const decoration = L_.decorateFeature(layerObj, feature, {
                latlong,
                featureStyle,
            })
            const yaw = decoration?.yaw || 0
            if (decoration?.shape) layerObj.shape = decoration.shape

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
                            decoration?.color || featureStyle.color
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
                    const circleMarkerStyle = leafletLayerObject.style(feature)
                    layer = L.circleMarker(
                        latlong,
                        circleMarkerStyle
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
                // Determine animation class
                let animationClass = ''
                if (
                    layerObj.style.animation &&
                    layerObj.style.animation !== 'none'
                ) {
                    animationClass = ' mmgis-vector-' + layerObj.style.animation
                }

                layer = L.marker(latlong, {
                    icon: L.divIcon({
                        className: `leafletMarkerShape leafletMarkerShape_${F_.getSafeName(
                            layerObj.name
                        )} ${F_.getSafeName(
                            layerObj.name
                        )} leafletDivIcon${animationClass}`,
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

/**
 * Build the host layer's attachments by asking each attachment plugin to make
 * itself. Core neither knows what an attachment is nor which ones exist: the
 * registry answers which attachments apply to this host's type, in which order
 * (that order is also their render order, bottom on top), and which of them
 * need their siblings and so must be built last.
 */
export const constructSublayers = (
    geojson,
    layerObj,
    leafletLayerObject,
    layer
) => {
    const applicable = LayerAttachmentRegistry.orderedFor(layerObj.type)
    // Whether the host asked for an attachment is the same question for all of
    // them, so core answers it from the declared `configPath` and a plugin's
    // `make` is only ever called for a host that wants it.
    const ids = applicable.filter((id) =>
        LayerAttachmentRegistry.isEnabledOn(id, layerObj)
    )
    const hostCtx = {
        geojson,
        layerObj,
        leafletLayerObject,
        hostLayer: layer,
        // An attachment that changes what the host's source would return (by
        // writing to its own backend, say) asks for the host to be re-acquired
        // with this rather than with Map_'s internals.
        refreshLayer: () => refreshLayer(layerObj),
        // And may need a second layer of the mission as an input: its data,
        // acquired headlessly, never another layer's rendered state.
        acquire,
    }

    // Seed the keys in declared order first: an attachment built later must
    // still be listed in its declared position.
    const sublayers = {}
    applicable.forEach((id) => {
        sublayers[LayerAttachmentRegistry.sublayerKey(id)] = false
    })

    const makeAttachment = (id, siblings) => {
        const ctx = {
            ...hostCtx,
            config: LayerAttachmentRegistry.configFor(id, layerObj),
        }
        if (siblings) ctx.siblings = siblings
        return (
            LayerInterface.runSync(
                LayerAttachmentRegistry.module(id),
                'make',
                [ctx],
                { coreDefault: () => false }
            ) || false
        )
    }

    const deferred = []
    ids.forEach((id) => {
        if (LayerAttachmentRegistry.buildsAfterSiblings(id)) deferred.push(id)
        else
            sublayers[LayerAttachmentRegistry.sublayerKey(id)] =
                makeAttachment(id)
    })
    deferred.forEach((id) => {
        sublayers[LayerAttachmentRegistry.sublayerKey(id)] = makeAttachment(
            id,
            sublayers
        )
    })

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
