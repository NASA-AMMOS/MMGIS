import $ from 'jquery'

export function _refreshAnnotationEvents(L_) {
    // Add annotation click events since onEachFeatureDefault doesn't apply to popups
    $('.mmgisAnnotation').off('click')
    $('.mmgisAnnotation').on('click', function () {
        const layerName = $(this).attr('layerId')
        const layerCode = $(this).attr('layer')
        const layer = L_.layers.layer[layerName]._layers[layerCode]
        L_.Map_.featureDefaultClick(layer.feature, layer, {
            latlng: layer._latlng,
        })
    })
}

// If opacity is null, reinforces opacities
export function setSublayerOpacity(L_, layerName, sublayerName, opacity) {
    layerName = L_.asLayerUUID(layerName)

    const sublayers = L_.layers.attachments[layerName] || {}
    const sublayer = sublayers[sublayerName]

    if (opacity == null) opacity = sublayer?.opacity

    if (sublayer && sublayer.opacity != null) {
        sublayer.opacity = opacity
        switch (sublayer.type) {
            case 'image_overlays':
                $(`.${sublayer.type}_${layerName}`).css({
                    opacity: opacity,
                })
                break
            default:
                break
        }
    }
}

export function toggleSublayer(L_, layerName, sublayerName) {
    layerName = L_.asLayerUUID(layerName)

    const sublayers = L_.layers.attachments[layerName] || {}
    const sublayer = sublayers[sublayerName]
    if (sublayer) {
        if (sublayer.on === true) {
            switch (sublayer.type) {
                case 'model':
                    L_.Globe_.litho.removeLayer(sublayer.layerId)
                    break
                case 'uncertainty_ellipses':
                    L_.Globe_.litho.removeLayer(sublayer.curtainLayerId)
                    L_.Globe_.litho.removeLayer(sublayer.clampedLayerId)
                    L_.Map_.rmNotNull(sublayer.layer)
                    break
                case 'path_gradient':
                    L_.Map_.rmNotNull(sublayer.layer)
                    L_.removeGradientPolyline(sublayer)
                    break
                case 'labels':
                case 'pairings':
                    sublayer.layer.off()
                    break
                default:
                    L_.Map_.rmNotNull(sublayer.layer)
                    break
            }
            sublayer.on = false
        } else {
            switch (sublayer.type) {
                case 'model':
                    L_.Globe_.litho.addLayer('model', sublayer.modelOptions)
                    break
                case 'uncertainty_ellipses':
                    L_.Globe_.litho.addLayer(
                        'curtain',
                        sublayer.curtainOptions
                    )
                    L_.Globe_.litho.addLayer(
                        'clamped',
                        sublayer.clampedOptions
                    )
                    L_.Map_.map.addLayer(sublayer.layer)
                    sublayer.layer.setZIndex(
                        L_._layersOrdered.length +
                            1 -
                            L_._layersOrdered.indexOf(layerName)
                    )
                    break
                case 'path_gradient':
                    L_.Map_.map.addLayer(sublayer.layer)
                    sublayer.layer.setZIndex(
                        L_._layersOrdered.length +
                            1 -
                            L_._layersOrdered.indexOf(layerName)
                    )
                    L_.addGradientPolyline(sublayer)
                    break
                case 'labels':
                case 'pairings':
                    sublayer.layer.on(false, sublayer.layer)
                    break
                default:
                    L_.Map_.map.addLayer(sublayer.layer)
                    sublayer.layer.setZIndex(
                        L_._layersOrdered.length +
                            1 -
                            L_._layersOrdered.indexOf(layerName)
                    )
                    L_.setSublayerOpacity(layerName, sublayerName)
                    break
            }
            sublayer.on = true
        }
    }
}

// Add a Cesium gradient-polyline primitive for an attachment, tracking the
// in-flight build so a teardown that races ahead of it can't orphan the
// primitive. GlobeRenderer.addLayer resolves asynchronously, so a layer
// toggled off (or re-added) before the build finishes would otherwise leave
// a stale primitive on the globe with no way to remove it.
export function addGradientPolyline(L_, attachment) {
    if (!attachment || !attachment.cesiumGradientOptions) return
    if (!L_.Globe_ || !L_.Globe_.litho) return
    attachment._gradientWantsOn = true
    const gen = (attachment._gradientGen =
        (attachment._gradientGen || 0) + 1)
    L_.Globe_.litho
        .addLayer('gradient_polyline', attachment.cesiumGradientOptions)
        .then((id) => {
            // Turned off (or superseded by a newer add) while building —
            // discard this primitive instead of leaving it orphaned.
            if (
                attachment._gradientGen !== gen ||
                !attachment._gradientWantsOn
            ) {
                L_.Globe_.litho.removeLayer(id)
                return
            }
            attachment.cesiumLayerId = id
        })
        .catch((e) => {
            console.warn('Failed to add 3D gradient polyline:', e)
        })
}

// Remove an attachment's Cesium gradient-polyline primitive and cancel any
// in-flight add (see addGradientPolyline) so it can't reappear afterwards.
export function removeGradientPolyline(L_, attachment) {
    if (!attachment) return
    attachment._gradientWantsOn = false
    attachment._gradientGen = (attachment._gradientGen || 0) + 1
    if (attachment.cesiumLayerId && L_.Globe_ && L_.Globe_.litho) {
        L_.Globe_.litho.removeLayer(attachment.cesiumLayerId)
        attachment.cesiumLayerId = null
    }
}

// Make a layer's sublayer match the layers data again
export async function syncSublayerData(L_, layerName, onlyClear) {
    layerName = L_.asLayerUUID(layerName)

    if (
        L_.layers.layer[layerName] == null ||
        L_.layers.layer[layerName] == false
    )
        return

    try {
        let geojson = L_.layers.layer[layerName].toGeoJSON(
            L_.GEOJSON_PRECISION
        )
        if (L_.layers.layer[layerName]._sourceGeoJSON)
            geojson = L_.layers.layer[layerName]._sourceGeoJSON

        // Now try the sublayers (if any)
        const subUpdateLayers = L_.layers.attachments[layerName]

        if (subUpdateLayers) {
            for (let sub in subUpdateLayers) {
                if (
                    subUpdateLayers[sub] !== false &&
                    subUpdateLayers[sub].layer != null
                ) {
                    subUpdateLayers[sub].layer.clearLayers()
                    if (
                        typeof subUpdateLayers[sub].layer
                            .customClearLayers === 'function'
                    ) {
                        subUpdateLayers[sub].layer.customClearLayers(
                            layerName,
                            sub
                        )
                    }

                    if (!onlyClear) {
                        if (
                            typeof subUpdateLayers[sub].layer
                                .addDataEnhanced === 'function'
                        ) {
                            subUpdateLayers[sub].layer.addDataEnhanced(
                                geojson,
                                layerName,
                                sub,
                                L_.Map_
                            )
                        } else if (
                            typeof subUpdateLayers[sub].layer.addData ===
                            'function'
                        ) {
                            subUpdateLayers[sub].layer.addData(geojson)
                        }

                        if (sub === 'image_overlays') {
                            subUpdateLayers[sub].layer.setZIndex(
                                L_._layersOrdered.length +
                                    1 -
                                    L_._layersOrdered.indexOf(layerName)
                            )
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log(e)
        console.warn(
            'Warning: Failed to update sublayers of layer: ' + layerName
        )
    }

    await L_.globeLithoLayerHelper(L_.layers.data[layerName], onlyClear)
}

export function _updatePairings(L_, layerName, on) {
    Object.keys(L_.layers.layer).forEach((name) => {
        if (
            L_.layers.on[name] &&
            L_.layers.attachments[name] &&
            L_.layers.attachments[name].pairings &&
            L_.layers.attachments[name].pairings.on &&
            L_.layers.attachments[name].pairings.pairedLayers.includes(
                layerName
            )
        ) {
            L_.layers.attachments[name].pairings.layer.on(
                false,
                L_.layers.attachments[name].pairings.layer
            )
        }
    })
}
