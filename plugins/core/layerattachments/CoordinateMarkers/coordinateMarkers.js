/**
 * Coordinate-markers attachment — a marker at every coordinate pair of every
 * one of the host layer's features.
 *
 * Beyond building itself and being restyled with its host it is an ordinary map
 * layer, so core's defaults (add/remove from the map, set opacity on the layer)
 * are already right.
 */

import F_ from '@basics/Formulae_/Formulae_'
import { parseExtendedGeoJSON } from '@basics/Layers_/render/ExtendedGeoJSON'

const L = window.L

const coordinateMarkers = (geojson, layerObj, leafletLayerObject) => {
    // COORDINATE MARKERS
    const coordMarkerVar = F_.getIn(
        layerObj,
        'variables.coordinateAttachments.marker'
    )

    if (
        coordMarkerVar &&
        (coordMarkerVar.enabled === true || coordMarkerVar.enabled == null)
    ) {
        const coordMarkerSettings = {
            initialVisibility: F_.getIn(
                coordMarkerVar,
                'initialVisibility',
                true
            ),
            opacity: F_.getIn(coordMarkerVar, 'opacity', null),
            color: F_.getIn(coordMarkerVar, 'color', null),
            weight: F_.getIn(coordMarkerVar, 'weight', null),
            fillColor: F_.getIn(coordMarkerVar, 'fillColor', null),
            fillOpacity: F_.getIn(coordMarkerVar, 'fillOpacity', null),
            radius: F_.getIn(coordMarkerVar, 'radius', null),
        }

        const leafletLayerObjectCoordinateMarkers = {
            onEachFeature: leafletLayerObject.onEachFeature,
            pointToLayer: leafletLayerObject.pointToLayer,
            style: function (feature) {
                const style = leafletLayerObject.style(
                    feature,
                    coordMarkerSettings
                )
                feature._style = style
                return feature._style
            },
        }

        const layer = L.geoJson(
            parseExtendedGeoJSON(geojson, ['coord_properties']),
            leafletLayerObjectCoordinateMarkers
        )
        layer.addDataEnhanced = function (geojson) {
            this.addData(parseExtendedGeoJSON(geojson, ['coord_properties']))
        }

        return {
            on:
                coordMarkerVar.initialVisibility != null
                    ? coordMarkerVar.initialVisibility
                    : true,
            type: 'coordinate_markers',
            geojson: geojson,
            layer: layer,
            title: 'Markers rendered at every coordinate pair of every feature.',
        }
    } else return false
}

/**
 * The markers are the host's own coordinates drawn again, so they get
 * highlighted with the host's features and have to be restored with them.
 * Each marker's feature carries the style it was built with.
 */
function setStyle(attachment) {
    for (let id in attachment.layer?._layers || {}) {
        const marker = attachment.layer._layers[id]
        try {
            marker.setStyle(marker.feature._style)
        } catch (err) {}
    }
}

export default {
    make: (ctx) =>
        coordinateMarkers(ctx.geojson, ctx.layerObj, ctx.leafletLayerObject),
    setStyle,
}
