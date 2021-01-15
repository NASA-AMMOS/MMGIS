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

        switch (kind.toLowerCase()) {
            case 'info':
                useInfo(true)
                break
            case 'waypoint':
                //Make rover image curiosity
                Map_.rmNotNull(Map_.tempOverlayImage)
                //256 x 338, 256 is 2.8m
                var wm = 2.8
                var w = 256
                var h = 338
                var lngM = F_.metersToDegrees(wm) / 2
                var latM = lngM * (h / w)
                var center = [layer._latlng.lng, layer._latlng.lat]
                var angle = -layer.feature.properties.yaw_rad
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
                Map_.tempOverlayImage = L.imageTransform(
                    'public/images/rovers/CuriosityTopDownOrthoSmall.png',
                    anchors,
                    { opacity: 1, clip: anchors }
                )
                Map_.tempOverlayImage.addTo(Map_.map).bringToBack()

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
