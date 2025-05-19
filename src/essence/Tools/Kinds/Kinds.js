import $ from 'jquery'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import TC_ from '../../Basics/ToolController_/ToolController_'

var Kinds = {
    use(
        kind,
        Map_,
        feature,
        layer,
        layerName,
        propImages,
        e,
        additional,
        preFeatures,
        lastFeatureLayers
    ) {
        L_.setActiveFeature(layer)

        if (typeof kind !== 'string') return

        let layerVar = {}
        if (L_.layers.data[layer.options.layerName])
            layerVar = L_.layers.data[layer.options.layerName].variables || {}

        // Remove temp layers
        Map_.rmNotNull(Map_.tempOverlayImage)
        L_.Globe_.litho.removeLayer('markerAttachmentTempModel')

        switch (kind.toLowerCase()) {
            case 'info':
                useInfo(true)
                break
            case 'waypoint':
                // Add image overlay
                const imageVar = F_.getIn(
                    layerVar,
                    'markerAttachments.image',
                    false
                )
                if (
                    imageVar &&
                    (imageVar.enabled === true || imageVar.enabled == null)
                ) {
                    const path = F_.getIn(
                        layerVar,
                        'markerAttachments.image.path',
                        'public/images/rovers/PerseveranceTopDown.png'
                    )
                    let roverSettings = {
                        image: F_.getIn(
                            layer.feature.properties,
                            F_.getIn(
                                layerVar,
                                'markerAttachments.image.pathProp',
                                path
                            ),
                            path
                        ),
                        widthMeters: F_.getIn(
                            layerVar,
                            'markerAttachments.image.widthMeters',
                            2.6924
                        ),
                        widthPixels: F_.getIn(
                            layerVar,
                            'markerAttachments.image.widthPixels',
                            420
                        ),
                        heightPixels: F_.getIn(
                            layerVar,
                            'markerAttachments.image.heightPixels',
                            600
                        ),
                        angleProp: F_.getIn(
                            layerVar,
                            'markerAttachments.image.angleProp',
                            'yaw_rad'
                        ),
                        angleUnit: F_.getIn(
                            layerVar,
                            'markerAttachments.image.angleUnit',
                            'rad'
                        ),
                        show: F_.getIn(
                            layerVar,
                            'markerAttachments.image.show',
                            'click'
                        ),
                    }
                    if (
                        !F_.isUrlAbsolute(roverSettings.image) &&
                        !roverSettings.image.startsWith('public')
                    )
                        roverSettings.image =
                            L_.missionPath + roverSettings.image
                    if (roverSettings.image && roverSettings.show === 'click') {
                        //Make rover image curiosity
                        let wm = parseFloat(roverSettings.widthMeters)
                        let w = parseFloat(roverSettings.widthPixels)
                        let h = parseFloat(roverSettings.heightPixels)
                        let lngM = F_.metersToDegrees(wm) / 2
                        let latM = lngM * (h / w)
                        let center = [layer._latlng.lng, layer._latlng.lat]
                        let angle = -F_.getIn(
                            layer.feature.properties,
                            roverSettings.angleProp,
                            0
                        )
                        if (roverSettings.angleProp === 'deg')
                            angle = angle * (Math.PI / 180)

                        var topLeft = F_.rotatePoint(
                            {
                                y: layer._latlng.lat + latM,
                                x: layer._latlng.lng - lngM,
                            },
                            center,
                            angle
                        )
                        var topRight = F_.rotatePoint(
                            {
                                y: layer._latlng.lat + latM,
                                x: layer._latlng.lng + lngM,
                            },
                            center,
                            angle
                        )
                        var bottomRight = F_.rotatePoint(
                            {
                                y: layer._latlng.lat - latM,
                                x: layer._latlng.lng + lngM,
                            },
                            center,
                            angle
                        )
                        var bottomLeft = F_.rotatePoint(
                            {
                                y: layer._latlng.lat - latM,
                                x: layer._latlng.lng - lngM,
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

                        try {
                            Map_.tempOverlayImage = L.imageTransform(
                                roverSettings.image,
                                anchors,
                                { opacity: 1, clip: anchors }
                            )
                            Map_.tempOverlayImage.addTo(Map_.map).bringToBack()
                        } catch (err) {}
                    }
                }

                // Add model to globe
                const modelVar = F_.getIn(
                    layerVar,
                    'markerAttachments.model',
                    false
                )
                if (
                    modelVar &&
                    (modelVar.enabled === true || modelVar.enabled == null)
                ) {
                    const path = F_.getIn(
                        layerVar,
                        'markerAttachments.model.path',
                        null
                    )
                    let modelSettings = {
                        model: F_.getIn(
                            layer.feature.properties,
                            F_.getIn(
                                layerVar,
                                'markerAttachments.model.pathProp',
                                path
                            ),
                            path
                        ),
                        mtlPath: F_.getIn(
                            layerVar,
                            'markerAttachments.model.mtlPath',
                            null
                        ),
                        yawProp: F_.getIn(
                            layerVar,
                            'markerAttachments.model.yawProp',
                            0
                        ),
                        yawUnit: F_.getIn(
                            layerVar,
                            'markerAttachments.model.yawUnit',
                            'rad'
                        ),
                        invertYaw: F_.getIn(
                            layerVar,
                            'markerAttachments.model.invertYaw',
                            false
                        ),
                        pitchProp: F_.getIn(
                            layerVar,
                            'markerAttachments.model.pitchProp',
                            0
                        ),
                        pitchUnit: F_.getIn(
                            layerVar,
                            'markerAttachments.model.pitchUnit',
                            'rad'
                        ),
                        invertPitch: F_.getIn(
                            layerVar,
                            'markerAttachments.model.invertPitch',
                            false
                        ),
                        rollProp: F_.getIn(
                            layerVar,
                            'markerAttachments.model.rollProp',
                            0
                        ),
                        rollUnit: F_.getIn(
                            layerVar,
                            'markerAttachments.model.rollUnit',
                            'rad'
                        ),
                        invertRoll: F_.getIn(
                            layerVar,
                            'markerAttachments.model.invertRoll',
                            false
                        ),
                        elevationProp: F_.getIn(
                            layerVar,
                            'markerAttachments.model.elevationProp',
                            0
                        ),
                        scaleProp: F_.getIn(
                            layerVar,
                            'markerAttachments.model.scaleProp',
                            1
                        ),
                        show: F_.getIn(
                            layerVar,
                            'markerAttachments.model.show',
                            'click'
                        ),
                    }

                    if (modelSettings.model && modelSettings.show === 'click') {
                        if (
                            !F_.isUrlAbsolute(modelSettings.image) &&
                            !modelSettings.model.startsWith('public')
                        )
                            modelSettings.model =
                                L_.missionPath + modelSettings.model
                        const rotation = {
                            y:
                                typeof modelSettings.yawProp === 'number'
                                    ? modelSettings.yawProp
                                    : F_.getIn(
                                          layer.feature.properties,
                                          modelSettings.yawProp,
                                          0
                                      ),
                            x:
                                typeof modelSettings.pitchProp === 'number'
                                    ? modelSettings.pitchProp
                                    : F_.getIn(
                                          layer.feature.properties,
                                          modelSettings.pitchProp,
                                          0
                                      ),
                            z:
                                typeof modelSettings.rollProp === 'number'
                                    ? modelSettings.rollProp
                                    : F_.getIn(
                                          layer.feature.properties,
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

                        L_.Globe_.litho.addLayer('model', {
                            name: 'markerAttachmentTempModel',
                            order: 99999,
                            on: true,
                            path: modelSettings.model,
                            mtlPath: modelSettings.mtlPath,
                            opacity: 1,
                            position: {
                                longitude: layer._latlng.lng || 0,
                                latitude: layer._latlng.lat || 0,
                                elevation:
                                    typeof modelSettings.elevationProp ===
                                    'number'
                                        ? modelSettings.elevationProp
                                        : F_.getIn(
                                              layer.feature.properties,
                                              modelSettings.elevationProp,
                                              0
                                          ),
                            },
                            scale:
                                typeof modelSettings.scaleProp === 'number'
                                    ? modelSettings.scaleProp
                                    : F_.getIn(
                                          layer.feature.properties,
                                          modelSettings.scaleProp,
                                          1
                                      ),
                            rotation: rotation,
                        })
                    }
                }

                useInfo(false)
                break
            case 'chemistry_tool':
                TC_.getTool('ChemistryTool').use(layer)

                useInfo(false)
                break
            case 'draw_tool':
                TC_.getTool('DrawTool').showContextMenu(
                    0,
                    0,
                    { feature: feature },
                    null,
                    'master',
                    false,
                    true,
                    true,
                    layerName
                )
                useInfo(false)
                break
            default:
                useInfo(false)
                return
        }
        function useInfo(open) {
            let features = []
            let featureLayers = []
            if (preFeatures == null) {
                if (
                    e.latlng == null &&
                    e.target &&
                    e.target.feature &&
                    e.target.feature.geometry &&
                    e.target.feature.geometry.type &&
                    e.target.feature.geometry.type.toLowerCase() == 'point'
                ) {
                    e.latlng = {
                        lng: e.target.feature.geometry.coordinates[0],
                        lat: e.target.feature.geometry.coordinates[1],
                    }
                } else if (e.latlng == null && e.target && e.target._latlng) {
                    e.latlng = e.target._latlng
                } else if (e.latlng == null && e.target && e.target._latlngs) {
                    const len = e.target._latlngs.length
                    let lat = 0
                    let lng = 0
                    e.target._latlngs.forEach((coord) => {
                        lat += coord.lat
                        lng += coord.lng
                    })
                    e.latlng = { lat: lat / len, lng: lng / len }
                }

                if (e.latlng && e.latlng.lng != null && e.latlng.lat != null) {
                    if (
                        typeof L_.layers.layer[layerName].eachLayer !==
                            'function' &&
                        layerName.indexOf('DrawTool_') != 0
                    ) {
                        L_.layers.layer[layerName].eachLayer = function (cb) {
                            for (var v in this._vectorTiles) {
                                for (var l in this._vectorTiles[v]._layers) {
                                    cb(this._vectorTiles[v]._layers[l])
                                }
                            }
                        }
                    }

                    // To better intersect points on click we're going to buffer out a small bounding box
                    const mapRect = document
                        .getElementById('map')
                        .getBoundingClientRect()

                    const wOffset = e.containerPoint?.x || mapRect.width / 2
                    const hOffset = e.containerPoint?.y || mapRect.height / 2

                    let nwLatLong = Map_.map.containerPointToLatLng([
                        wOffset - 15,
                        hOffset - 15,
                    ])
                    let seLatLong = Map_.map.containerPointToLatLng([
                        wOffset + 15,
                        hOffset + 15,
                    ])
                    // If we didn't have a container click point, buffer out e.latlng
                    if (e.containerPoint == null) {
                        const lngDif =
                            Math.abs(nwLatLong.lng - seLatLong.lng) / 2
                        const latDif =
                            Math.abs(nwLatLong.lat - seLatLong.lat) / 2
                        nwLatLong = {
                            lng: e.latlng.lng - lngDif,
                            lat: e.latlng.lat - latDif,
                        }
                        seLatLong = {
                            lng: e.latlng.lng + lngDif,
                            lat: e.latlng.lat + latDif,
                        }
                    }

                    // Find all the intersected points and polygons of the click
                    Object.keys(L_.layers.layer).forEach((lName) => {
                        if (
                            (L_.layers.on[lName] &&
                                (L_.layers.data[lName].type === 'vector' ||
                                    L_.layers.data[lName].type === 'query') &&
                                L_.layers.layer[lName]) ||
                            (lName.indexOf('DrawTool_') === 0 &&
                                L_.layers.layer[lName]?.[0]?._map != null)
                        ) {
                            features = features.concat(
                                L.leafletPip
                                    .pointInLayer(
                                        [e.latlng.lng, e.latlng.lat],
                                        L_.layers.layer[lName]
                                    )
                                    .concat(
                                        F_.pointsInPoint(
                                            [e.latlng.lng, e.latlng.lat],
                                            L_.layers.layer[lName],
                                            [
                                                nwLatLong.lng,
                                                seLatLong.lng,
                                                nwLatLong.lat,
                                                seLatLong.lat,
                                            ]
                                        )
                                    )
                                    .reverse()
                            )
                        }
                    })

                    if (features[0] == null) features = [feature]
                    else {
                        const swapFeatures = []
                        features.forEach((f) => {
                            if (
                                typeof f.type === 'string' &&
                                f.type.toLowerCase() === 'feature'
                            )
                                swapFeatures.push(f)
                            else if (
                                f.feature &&
                                typeof f.feature.type === 'string' &&
                                f.feature.type.toLowerCase() === 'feature'
                            )
                                swapFeatures.push(f.feature)
                        })
                        featureLayers = features
                        features = swapFeatures
                    }
                }
            } else {
                features = preFeatures
            }

            let ell = { latlng: null }
            if (e.latlng != null)
                ell.latlng = JSON.parse(JSON.stringify(e.latlng))

            TC_.getTool('InfoTool').use(
                layer,
                layerName,
                features,
                {
                    useKeyAsName: layer.useKeyAsName,
                },
                null,
                open,
                ell,
                additional,
                lastFeatureLayers || featureLayers
            )
        }
    },
}

export default Kinds
