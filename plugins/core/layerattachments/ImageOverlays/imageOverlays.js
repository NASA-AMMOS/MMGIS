/**
 * Image-overlays attachment — images georeferenced onto the 2D map at the host
 * layer's point features, rotated by a bearing property.
 *
 * Visibility rides core's default (added to and removed from the map), but
 * opacity and z-index have to be applied to the overlay elements themselves.
 */

import $ from 'jquery'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

const L = window.L

const imageOverlays = (geojson, layerObj, leafletLayerObject, config) => {
    // IMAGE
    const imageVar = config

    if (imageVar && (imageVar.enabled === true || imageVar.enabled == null)) {
        const imageShow = F_.getIn(imageVar, 'show', 'click')
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
                        imageVar,
                        'path',
                        'public/images/rovers/PerseveranceTopDown.png'
                    )
                    const pathProp = F_.getIn(imageVar, 'pathProp', null)

                    // Figure out image path (same logic as model attachments)
                    let imagePath = null
                    if (!path && pathProp) {
                        imagePath = F_.getIn(feature.properties, pathProp, null)
                    } else {
                        imagePath = pathProp
                            ? F_.getIn(feature.properties, pathProp, path)
                            : path
                    }
                    // Prepend mission path for relative URLs (matches model attachment behavior)
                    if (
                        imagePath &&
                        !F_.isUrlAbsolute(imagePath) &&
                        !imagePath.startsWith('public')
                    )
                        imagePath = L_.missionPath + imagePath

                    let imageSettings = {
                        image: imagePath,
                        widthMeters: F_.getIn(imageVar, 'widthMeters', 2.6924),
                        widthPixels: F_.getIn(imageVar, 'widthPixels', 420),
                        heightPixels: F_.getIn(imageVar, 'heightPixels', 600),
                        angleProp: F_.getIn(imageVar, 'angleProp', 'yaw_rad'),
                        angleUnit: F_.getIn(imageVar, 'angleUnit', 'rad'),
                        show: F_.getIn(imageVar, 'show', 'click'),
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

/**
 * The overlays are DOM images rather than a styled map layer, so their opacity
 * is set on the elements. They carry their own opacity independent of their
 * host's, so only their own slider (`source === 'attachment'`) moves it.
 */
function setOpacity(attachment, opacity, ctx = {}) {
    if (ctx.source !== 'attachment') return
    $(`.image_overlays_${ctx.hostName}`).css({ opacity })
}

/**
 * The overlays are their own map layer rather than part of the host's, so once
 * core has rebuilt them from the host's new data they have to be put back where
 * they sit in the layer order.
 */
const syncData = {
    after(attachment, ctx = {}) {
        if (ctx.onlyClear) return
        attachment.layer?.setZIndex?.(ctx.zIndex)
    },
}

export default {
    make: (ctx) =>
        imageOverlays(
            ctx.geojson,
            ctx.layerObj,
            ctx.leafletLayerObject,
            ctx.config
        ),
    setOpacity,
    syncData,
}
