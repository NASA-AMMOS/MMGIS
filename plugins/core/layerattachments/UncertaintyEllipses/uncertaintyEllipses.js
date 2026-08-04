/**
 * Uncertainty-ellipses attachment — elliptical buffers about point features
 * sized from X/Y uncertainty properties: an overlay on the 2D map plus a
 * curtain and a clamped surface on the globe, which is why one visibility
 * change means three engine layers.
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

const L = window.L

const uncertaintyEllipses = (geojson, layerObj, leafletLayerObject, config) => {
    //UNCERTAINTY
    const uncertaintyVar = config
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
            minZoom: layerObj.minZoom != null ? layerObj.minZoom : 0,
            maxZoom: layerObj.maxZoom != null ? layerObj.maxZoom : 100,
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

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) {
        L_.Globe_.litho.addLayer('curtain', attachment.curtainOptions)
        L_.Globe_.litho.addLayer('clamped', attachment.clampedOptions)
        L_.Map_.map.addLayer(attachment.layer)
        ctx.applyOrder()
    } else {
        L_.Globe_.litho.removeLayer(attachment.curtainLayerId)
        L_.Globe_.litho.removeLayer(attachment.clampedLayerId)
        L_.Map_.rmNotNull(attachment.layer)
    }
}

/**
 * The ellipses are drawn deliberately fainter than the features they surround,
 * so they take their host's opacity scaled by their own stroke/fill factors
 * rather than matching it.
 */
function setOpacity(attachment, opacity, ctx = {}) {
    try {
        attachment.layer.setStyle({
            opacity: opacity * 0.8,
            fillOpacity: opacity * (ctx.hostFillOpacity ?? 1) * 0.25,
        })
    } catch (e) {}
}

/**
 * The map overlay is rebuilt from the host's new data by core's default, but the
 * two globe layers are ours and have to be taken down first — the next
 * make/toggle re-adds them.
 */
const syncData = {
    before(attachment) {
        if (!L_.Globe_?.litho) return
        L_.Globe_.litho.removeLayer(attachment.curtainLayerId)
        L_.Globe_.litho.removeLayer(attachment.clampedLayerId)
    },
}

export default {
    make: (ctx) =>
        uncertaintyEllipses(
            ctx.geojson,
            ctx.layerObj,
            ctx.leafletLayerObject,
            ctx.config
        ),
    setVisibility,
    setOpacity,
    syncData,
}
