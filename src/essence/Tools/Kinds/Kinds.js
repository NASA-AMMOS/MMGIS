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
        preFeatures
    ) {
        if (typeof kind !== 'string') return

        const layerVar = L_.layersNamed[layer.options.layerName].variables

        switch (kind.toLowerCase()) {
            case 'info':
                useInfo(true)
                break
            case 'waypoint':
                let roverSettings = {
                    image: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.image',
                        'public/images/rovers/PerseveranceTopDown.png'
                    ),
                    widthMeters: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.widthMeters',
                        2.6924
                    ),
                    widthPixels: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.widthPixels',
                        420
                    ),
                    heightPixels: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.heightPixels',
                        600
                    ),
                    angleProp: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.angleProp',
                        'yaw_rad'
                    ),
                    angleUnit: F_.getIn(
                        layerVar,
                        'markerAttachments.rover.angleUnit',
                        'rad'
                    ),
                }
                //Make rover image curiosity
                Map_.rmNotNull(Map_.tempOverlayImage)
                //256 x 338, 256 is 2.8m
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
                        typeof L_.layersGroup[layerName].eachLayer !==
                        'function'
                    ) {
                        L_.layersGroup[layerName].eachLayer = function (cb) {
                            for (var v in this._vectorTiles) {
                                for (var l in this._vectorTiles[v]._layers) {
                                    cb(this._vectorTiles[v]._layers[l])
                                }
                            }
                        }
                    }
                    features = L.leafletPip
                        .pointInLayer(
                            [e.latlng.lng, e.latlng.lat],
                            L_.layersGroup[layerName]
                        )
                        .concat(
                            F_.pointsInPoint(
                                [e.latlng.lng, e.latlng.lat],
                                L_.layersGroup[layerName]
                            )
                        )
                        .reverse()

                    if (features[0] == null || features[0].properties == null)
                        features = [feature]
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
                additional
            )
        }
    },
}

export default Kinds
