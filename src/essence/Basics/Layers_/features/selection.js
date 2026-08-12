import F_ from '../../Formulae_/Formulae_'
import Description from '../../UserInterface_/components/Description/Description'
import ToolController_ from '../../ToolController_/ToolController_'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'
import { featureIdentity } from './identity'

import $ from 'jquery'

export function setActiveFeature(L_, layer) {
    if (layer && layer.feature && layer.options?.layerName)
        L_.activeFeature = {
            feature: layer.feature,
            layerName: layer.options.layerName,
            layer: layer,
        }
    else L_.activeFeature = null

    L_.setLastActiveFeature(layer)
    L_.resetLayerFills()
    L_.highlight(layer)
    L_.Map_.activeLayer = layer

    if (L_.Map_.activeLayer) L_.Map_._justSetActiveLayer = true

    Description.updatePoint(L_.Map_.activeLayer)

    if (layer) {
        const props = layer.feature?.properties || layer.properties || {}

        // Highlight the feature in Globe
        if (
            L_.Globe_ &&
            L_.Globe_.highlight &&
            layer.feature &&
            layer.options?.layerName
        ) {
            L_.Globe_.highlight(layer.options.layerName, layer.feature)
        }

        L_.Viewer_.highlight(layer)
    }

    ToolController_.notifyActiveTool('setActiveFeature', L_.activeFeature)

    if (!L_.activeFeature) {
        L_.clearVectorLayerInfo()
    }
}

export function highlight(L_, layer, forceColor) {
    if (layer == null) return
    const color =
        forceColor ||
        (L_.configData.look && L_.configData.look.highlightcolor) ||
        'red'
    try {
        if (
            layer.feature?.properties?.annotation === true &&
            layer._container
        ) {
            // Annotation
            $(layer._container)
                .find('.mmgisAnnotation')
                .css('color', 'lime')
        } else if (layer.feature?.properties?.arrow === true) {
            // Arrow
            $(`.LayerArrow_${layer._idx}.mmgisArrowOutline`).css(
                'stroke',
                color
            )
        } else {
            const savedOptions = JSON.parse(JSON.stringify(layer.options))
            layer.setStyle({
                color: color,
                stroke: color,
                weight: 4,
            })
            layer.options = savedOptions

            // For some odd reason sometimes the first style does not work
            // This makes sure it does
            setTimeout(() => {
                const savedOptions2 = JSON.parse(
                    JSON.stringify(layer.options)
                )
                if (
                    layer.options.color != color &&
                    layer.options.stroke != color
                ) {
                    layer.setStyle({
                        color: color,
                        stroke: color,
                        weight: 4,
                    })
                    layer.options = savedOptions2
                }
            }, 100)
        }
    } catch (err) {
        if (layer._icon)
            layer._icon.style.filter = `drop-shadow(${color}  2px 0px 0px) drop-shadow(${color}  -2px 0px 0px) drop-shadow(${color}  0px 2px 0px) drop-shadow(${color} 0px -2px 0px)`
    }
    try {
        //layer.bringToFront()
    } catch (err) {}
}

export function getFirstCoordinate(L_, geometry) {
    // Extract the first coordinate from a geometry to use as label anchor
    if (!geometry || !geometry.coordinates) return null

    let coords = geometry.coordinates
    const type = geometry.type

    switch (type) {
        case 'Point':
            // [lng, lat]
            return L.latLng(coords[1], coords[0])
        case 'LineString':
            // [[lng, lat], ...]
            return L.latLng(coords[0][1], coords[0][0])
        case 'Polygon':
            // [[[lng, lat], ...], ...]
            return L.latLng(coords[0][0][1], coords[0][0][0])
        case 'MultiLineString':
            // [[[lng, lat], ...], ...]
            return L.latLng(coords[0][0][1], coords[0][0][0])
        case 'MultiPolygon':
            // [[[[lng, lat], ...], ...], ...]
            return L.latLng(coords[0][0][0][1], coords[0][0][0][0])
        default:
            return null
    }
}

/**
 * @param {object} layer - leaflet layer object
 */
export function setLastActiveFeature(L_, layer) {
    let layerName, lat, lon, key, value
    if (layer) {
        layerName = layer.hasOwnProperty('options')
            ? layer.options.layerName
            : null
        lat = layer.hasOwnProperty('_latlng') ? layer._latlng.lat : null
        lon = layer.hasOwnProperty('_latlng') ? layer._latlng.lng : null

        if (L_.layers.data[layerName]?.variables?.useKeyAsId) {
            key = L_.layers.data[layerName].variables.useKeyAsId

            value = F_.getIn(layer.feature.properties, key)
        }
    }

    if (layerName != null && key != null && value != null) {
        L_.lastActiveFeature = {
            layerName: layerName,
            lat: null,
            lon: null,
            key: key,
            value: value,
        }
    } else if (layerName != null && lat != null && lon != null) {
        L_.lastActiveFeature = {
            layerName: layerName,
            lat: lat,
            lon: lon,
            key: null,
            value: null,
        }
    }
}

// relation and field are optional
// relation is null, -1, or 1
// if relation is 1 it'll select the next feature, -1 the previous
// if field is null, relation is relative to initial geojson order
// otherwise sort by field first
export function selectFeature(L_, layerName, feature, relation, field) {
    // Helper function to round coordinates to match GEOJSON_PRECISION
    const roundCoordinates = (coords, precision) => {
        if (typeof coords[0] === 'number') {
            // Single coordinate pair [lng, lat]
            return coords.map((c) => parseFloat(c.toFixed(precision)))
        } else {
            // Nested array of coordinates
            return coords.map((c) => roundCoordinates(c, precision))
        }
    }

    const roundGeometry = (geometry) => {
        if (!geometry || !geometry.coordinates) return geometry
        const rounded = JSON.parse(JSON.stringify(geometry))
        rounded.coordinates = roundCoordinates(
            rounded.coordinates,
            L_.GEOJSON_PRECISION
        )
        return rounded
    }

    let f = JSON.parse(JSON.stringify(feature))
    layerName = L_.asLayerUUID(layerName)
    const layer = L_.layers.layer[layerName]

    // If relation is a feature, override feature
    if (typeof relation === 'object' && relation.type != null) {
        f = relation
        relation = 0
    }

    if (layer) {
        const layers = layer._layers
        const layerKeys = Object.keys(layers)

        const featureWithout_ = JSON.parse(JSON.stringify(f))
        if (featureWithout_.properties?._ != null)
            delete featureWithout_.properties._
        if (featureWithout_.properties?._dataset != null)
            delete featureWithout_.properties._dataset
        if (featureWithout_.properties?._geodataset != null)
            delete featureWithout_.properties._geodataset
        if (featureWithout_.properties?.feature_id != null)
            delete featureWithout_.properties.feature_id
        // How a feature looks is not what it is: the globe is handed a copy with
        // a dynamic style resolved onto properties.style, which the 2D feature
        // it came from doesn't carry.
        if (featureWithout_.properties?.style != null)
            delete featureWithout_.properties.style

        for (let i = 0; i < layerKeys.length; i++) {
            const l = layerKeys[i]
            const layerFeature = layers[l].feature

            // Fast path: match by id when both features have one of the same
            // kind. Geodataset layers with _source have reduced properties
            // that won't match the full search result via JSON.stringify.
            // The search API stores the id in properties._.idx while the GET
            // endpoint stores it in properties.feature_id - two different
            // numberings, so a match across them would name another feature.
            const layerFid = featureIdentity(layerFeature.properties)
            const inputFid = featureIdentity(f.properties)
            if (
                layerFid != null &&
                inputFid != null &&
                layerFid === inputFid
            ) {
                if (layers[layerKeys[i + (relation || 0)]] != null) {
                    if (
                        L_.Globe_ &&
                        L_.Globe_.litho &&
                        L_.Globe_.litho._justSelectedFromMap !== undefined
                    ) {
                        L_.Globe_.litho._justSelectedFromMap = true
                        if (L_.Globe_.litho._justSelectedTimeout)
                            clearTimeout(
                                L_.Globe_.litho._justSelectedTimeout
                            )
                        L_.Globe_.litho._justSelectedTimeout = setTimeout(
                            () => {
                                L_.Globe_.litho._justSelectedFromMap = false
                            },
                            500
                        )
                    }
                    if (L_.Globe_ && L_.Globe_.highlight)
                        L_.Globe_.highlight(layerName, f)
                    layers[layerKeys[i + (relation || 0)]].fireEvent(
                        'click'
                    )
                }
                return
            }

            const lfeatureWithout_ = JSON.parse(
                JSON.stringify(layerFeature)
            )
            if (lfeatureWithout_.properties?._ != null)
                delete lfeatureWithout_.properties._
            if (lfeatureWithout_.properties?._dataset != null)
                delete lfeatureWithout_.properties._dataset
            if (lfeatureWithout_.properties?._geodataset != null)
                delete lfeatureWithout_.properties._geodataset
            if (lfeatureWithout_.properties?.feature_id != null)
                delete lfeatureWithout_.properties.feature_id
            if (lfeatureWithout_.properties?.style != null)
                delete lfeatureWithout_.properties.style

            // Round both geometries to GEOJSON_PRECISION before comparing
            // This accounts for precision differences between Cesium (which receives
            // precision-reduced GeoJSON) and Leaflet (which has full precision)
            const roundedClickedGeometry = roundGeometry(f.geometry)
            const roundedLayerGeometry = roundGeometry(
                layerFeature.geometry
            )

            const geometryMatch = F_.isEqual(
                roundedLayerGeometry,
                roundedClickedGeometry,
                true
            )
            const propertiesMatch = F_.isEqual(
                lfeatureWithout_.properties,
                featureWithout_.properties,
                true
            )

            if (geometryMatch && propertiesMatch) {
                if (layers[layerKeys[i + (relation || 0)]] != null) {
                    // Set flag to prevent Globe click handler from firing
                    if (
                        L_.Globe_ &&
                        L_.Globe_.litho &&
                        L_.Globe_.litho._justSelectedFromMap !== undefined
                    ) {
                        L_.Globe_.litho._justSelectedFromMap = true
                        // Clear flag after short delay
                        if (L_.Globe_.litho._justSelectedTimeout) {
                            clearTimeout(
                                L_.Globe_.litho._justSelectedTimeout
                            )
                        }
                        L_.Globe_.litho._justSelectedTimeout = setTimeout(
                            () => {
                                L_.Globe_.litho._justSelectedFromMap = false
                            },
                            500
                        )
                    }

                    // Highlight the feature in Globe
                    if (L_.Globe_ && L_.Globe_.highlight) {
                        L_.Globe_.highlight(layerName, f)
                    }
                    layers[layerKeys[i + (relation || 0)]].fireEvent(
                        'click'
                    )
                }
                return
            }
        }
    }
}

/**
 * @param {object} - activePoint { layerUUID: , lat: lon: }
 * @returns {bool} - true only if successful
 */
export function selectPoint(L_, activePoint) {
    if (activePoint == null) return false
    // Backward pre-uuid compatibility
    activePoint.layerUUID = L_.asLayerUUID(
        activePoint.layerUUID || activePoint.layerName
    )

    if (
        activePoint.layerUUID != null &&
        activePoint.lat != null &&
        activePoint.lon != null
    ) {
        if (L_.layers.layer.hasOwnProperty(activePoint.layerUUID)) {
            let g = L_.layers.layer[activePoint.layerUUID]._layers
            for (let l in g) {
                if (
                    g[l]?.feature?.geometry?.type &&
                    g[l].feature.geometry.type.toLowerCase() === 'point' &&
                    g[l]._latlng.lat == activePoint.lat &&
                    g[l]._latlng.lng == activePoint.lon
                ) {
                    g[l].fireEvent('click')
                    L_._selectPointViewHelper(activePoint, g[l])
                    return true
                }
            }
        }
    } else if (
        activePoint.layerUUID != null &&
        activePoint.key != null &&
        activePoint.value != null
    ) {
        if (L_.layers.layer.hasOwnProperty(activePoint.layerUUID)) {
            let g = L_.layers.layer[activePoint.layerUUID]._layers
            for (let l in g) {
                if (g[l] && g[l].feature && g[l].feature.properties) {
                    if (
                        F_.getIn(
                            g[l].feature.properties,
                            activePoint.key.split('.')
                        ) == activePoint.value
                    ) {
                        g[l].fireEvent('click')
                        L_._selectPointViewHelper(activePoint, g[l])
                        return true
                    }
                }
            }
        }
    } else if (
        activePoint.layerUUID != null &&
        activePoint.layerId != null
    ) {
        if (L_.layers.layer.hasOwnProperty(activePoint.layerUUID)) {
            let g = L_.layers.layer[activePoint.layerUUID]._layers
            const l = activePoint.layerId
            if (g[l] != null) {
                g[l].fireEvent('click')
                L_._selectPointViewHelper(activePoint, g[l])
                return true
            }
        }
    }
    return false
}

export function _selectPointViewHelper(L_, activePoint, layer) {
    if (activePoint.view === 'go') {
        let newView = []
        if (layer._latlng) {
            newView = [
                layer._latlng.lat,
                layer._latlng.lng,
                activePoint.zoom ||
                    L_.Map_.mapScaleZoom ||
                    L_.Map_.map.getZoom(),
            ]
        } else if (layer._latlngs) {
            let lat = 0,
                lng = 0
            let llflat = layer._latlngs.flat(Infinity)
            for (let ll of llflat) {
                lat += ll.lat
                lng += ll.lng
            }
            newView = [
                lat / llflat.length,
                lng / llflat.length,
                parseInt(
                    activePoint.zoom ||
                        L_.Map_.mapScaleZoom ||
                        L_.Map_.map.getZoom()
                ),
            ]
        }
        setTimeout(() => {
            L_.Map_.resetView(newView)
        }, 50)
        if (L_.hasGlobe) {
            L_.Globe_.litho.setCenter(newView)
        }
    }
    setTimeout(() => {
        L_.setActiveFeature(layer)
    }, 300)
}

// Returns all feature at a leaflet map click
// e = {latlng: {lat, lng}, containerPoint?: {x, y}}
export function getFeaturesAtPoint(L_, e, fullLayers) {
    let features = []
    let correspondingLayerNames = []
    if (e.latlng && e.latlng.lng != null && e.latlng.lat != null) {
        // To better intersect points on click we're going to buffer out a small bounding box
        const mapRect = document
            .getElementById('map')
            .getBoundingClientRect()

        const wOffset = e.containerPoint?.x || mapRect.width / 2
        const hOffset = e.containerPoint?.y || mapRect.height / 2

        let nwLatLong = L_.Map_.map.containerPointToLatLng([
            wOffset - 15,
            hOffset - 15,
        ])
        let seLatLong = L_.Map_.map.containerPointToLatLng([
            wOffset + 15,
            hOffset + 15,
        ])
        // If we didn't have a container click point, buffer out e.latlng
        if (e.containerPoint == null) {
            const lngDif = Math.abs(nwLatLong.lng - seLatLong.lng) / 2
            const latDif = Math.abs(nwLatLong.lat - seLatLong.lat) / 2
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
                    LayerTypeRegistry.hasFeaturePicking(
                        L_.layers.data[lName].type
                    ) &&
                    L_.layers.layer[lName]) ||
                (lName.indexOf('DrawTool_') === 0 &&
                    L_.layers.layer[lName]?.[0]?._map != null)
            ) {
                const nextFeatures = L.leafletPip
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
                features = features.concat(nextFeatures)
                correspondingLayerNames = correspondingLayerNames.concat(
                    new Array(nextFeatures.length).fill().map(() => lName)
                )
            }
        })

        if (features[0] == null) features = []
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
                    swapFeatures.push(fullLayers ? f : f.feature)
            })
            features = swapFeatures
        }
    }
    return features
}
