import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'

/**
 * Gather intersecting features around a click point.
 * Extracted from Kinds.js useInfo() (lines 430-580).
 *
 * @param {object} ctx - InteractionContext
 * @returns {{ features: Array, featureLayers: Array }}
 */
export function gatherFeatures(ctx) {
    let features = []
    let featureLayers = []
    const { feature, layer, layerName, event: e } = ctx

    if (ctx.state.preFeatures == null) {
        if (
            e.latlng == null &&
            e.target &&
            e.target.feature &&
            e.target.feature.geometry &&
            e.target.feature.geometry.type &&
            e.target.feature.geometry.type.toLowerCase() === 'point'
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
                typeof L_.layers.layer[layerName].eachLayer !== 'function' &&
                layerName.indexOf('DrawTool_') !== 0
            ) {
                L_.layers.layer[layerName].eachLayer = function (cb) {
                    for (var v in this._vectorTiles) {
                        for (var l in this._vectorTiles[v]._layers) {
                            cb(this._vectorTiles[v]._layers[l])
                        }
                    }
                }
            }

            const mapRect = document
                .getElementById('map')
                .getBoundingClientRect()

            const wOffset = e.containerPoint?.x || mapRect.width / 2
            const hOffset = e.containerPoint?.y || mapRect.height / 2

            let nwLatLong = ctx.Map_.map.containerPointToLatLng([
                wOffset - 15,
                hOffset - 15,
            ])
            let seLatLong = ctx.Map_.map.containerPointToLatLng([
                wOffset + 15,
                hOffset + 15,
            ])
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
        features = ctx.state.preFeatures
    }

    return { features, featureLayers }
}
