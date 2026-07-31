/**
 * VectorTile layer type — map renderer.
 *
 * Renders Mapbox Vector Tiles (MVT/PBF) on the 2D map via L.vectorGrid
 * (or the simplified variant for dense extrusion tiles). Feature interactions
 * (click → metadata capture + interaction pipeline, hover → cursor info) are
 * engine-neutral MMGIS logic and live here; the Leaflet VectorGrid construction
 * rides through the MapRenderer escape hatch (`mctx.raw`).
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import L_ from '@basics/Layers_/Layers_'
import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import MapRenderer from '@basics/Map_/MapRenderer'
import MetadataCapturer from '@basics/Layers_/capture/MetadataCapturer.js'
import {
    runInteractions,
    resolveLayerInteractions,
} from '@basics/InteractionRunner/InteractionRunner'
import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'
import './SimplifiedVectorGrid'

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const L = mctx.raw
    const Map_ = L_.Map_

    let layerUrl = L_.getUrl(layerObj.type, layerObj.url, layerObj)

    let urlSplit = layerObj.url.split(':')

    if (urlSplit[0].toLowerCase() === 'geodatasets' && urlSplit[1] != null) {
        layerUrl =
            `${window.mmgisglobal.ROOT_PATH || ''}/api/geodatasets/get?layer=${
                urlSplit[1]
            }` + '&type=mvt&x={x}&y={y}&z={z}'
    }

    var clearHighlight = function () {
        for (let l of Object.keys(L_.layers.data)) {
            if (L_.layers.layer[l]) {
                var highlight = L_.layers.layer[l].highlight
                if (highlight) {
                    L_.layers.layer[l].resetFeatureStyle(highlight)
                }
                L_.layers.layer[l].highlight = null
            }
        }
    }
    var timedSelectTimeout = null
    var timedSelect = function (layer, layerName, e) {
        clearTimeout(timedSelectTimeout)
        timedSelectTimeout = setTimeout(
            (function (layer, layerName, e) {
                return function () {
                    let ell = { latlng: null }
                    if (e.latlng != null)
                        ell.latlng = JSON.parse(JSON.stringify(e.latlng))
                    MetadataCapturer.populateMetadata(layer, async () => {
                        const layerData = L_.layers.data[layerName]
                        const pipeline = resolveLayerInteractions(
                            layerData,
                            undefined,
                            LayerTypeRegistry.capabilities(layerData.type)
                                .defaultInteractions
                        ).click

                        Map_.rmNotNull(Map_.tempOverlayImage)
                        L_.Globe_.litho.removeLayer('markerAttachmentTempModel')

                        const ctx = {
                            Map_,
                            feature:
                                L_.layers.layer[layerName].activeFeatures[0],
                            layer,
                            layerName,
                            layerData,
                            layerVar: layerData.variables || {},
                            event: ell,
                            eventType: 'click',
                            additional: null,
                            stop: false,
                            state: {
                                preFeatures:
                                    L_.layers.layer[layerName].activeFeatures,
                            },
                        }

                        await runInteractions(pipeline, ctx)
                        L_.layers.layer[layerName].activeFeatures = []
                    })
                }
            })(layer, layerName, e),
            100
        )
    }

    // Hide sublayers not explicitly listed in vtLayer styles.
    // Without this, L.vectorGrid renders all sublayers with default blue styling.
    const vtLayerStyles = layerObj.style.vtLayer || {}
    const resolvedVtLayerStyles = new Proxy(vtLayerStyles, {
        get(target, prop) {
            if (prop in target) return target[prop]
            return {
                fill: false,
                stroke: false,
                weight: 0,
                fillOpacity: 0,
                opacity: 0,
            }
        },
        has() {
            return true
        },
    })

    var vectorTileOptions = {
        layerName: layerObj.name,
        rendererFactory: L.svg.tile,
        vectorTileLayerStyles: resolvedVtLayerStyles,
        interactive: true,
        minZoom: layerObj.minZoom,
        maxZoom: layerObj.maxZoom,
        maxNativeZoom: layerObj.maxNativeZoom,
        getFeatureId: (function (vtId) {
            return function (f) {
                if (
                    f.properties.properties &&
                    typeof f.properties.properties === 'string'
                ) {
                    f.properties = JSON.parse(f.properties.properties)
                }
                return f.properties[vtId]
            }
        })(layerObj.style.vtId),
    }

    // For extrusion-enabled layers (e.g., OSM buildings), use the simplified
    // variant with a moderate tolerance to reduce polygon vertex counts. This
    // significantly improves 2D rendering performance for dense tiles.
    if (layerObj.extrudeEnabled && layerObj.simplifyTolerance !== 0) {
        vectorTileOptions.simplifyTolerance = layerObj.simplifyTolerance ?? 4
    }

    const vectorGridFactory =
        vectorTileOptions.simplifyTolerance > 0
            ? L.simplifiedVectorGrid.protobuf
            : L.vectorGrid.protobuf

    L_.layers.layer[layerObj.name] = vectorGridFactory(
        layerUrl,
        vectorTileOptions
    )
        .on('click', function (e, b, x) {
            let layerName = e.target.options.layerName
            let vtId = L_.layers.layer[layerName].vtId
            clearHighlight()
            L_.layers.layer[layerName].highlight = e.layer.properties[vtId]

            L_.layers.layer[layerName].setFeatureStyle(
                L_.layers.layer[layerName].highlight,
                {
                    weight: 2,
                    color: 'red',
                    opacity: 1,
                    fillColor: 'red',
                    fill: true,
                    radius: 4,
                    fillOpacity: 1,
                }
            )
            L_.layers.layer[layerName].activeFeatures =
                L_.layers.layer[layerName].activeFeatures || []
            L_.layers.layer[layerName].activeFeatures.push({
                type: 'Feature',
                properties: e.layer.properties,
                geometry: {},
            })

            Map_.activeLayer = e.layer
            if (Map_.activeLayer) L_.Map_._justSetActiveLayer = true

            let p = e.sourceTarget._point

            if (p) {
                for (var i in e.layer._renderer._features) {
                    if (
                        e.layer._renderer._features[i].feature._pxBounds.min
                            .x <= p.x &&
                        e.layer._renderer._features[i].feature._pxBounds.max
                            .x >= p.x &&
                        e.layer._renderer._features[i].feature._pxBounds.min
                            .y <= p.y &&
                        e.layer._renderer._features[i].feature._pxBounds.max
                            .y >= p.y &&
                        e.layer._renderer._features[i].feature.properties[
                            vtId
                        ] != e.layer.properties[vtId]
                    ) {
                        L_.layers.layer[layerName].activeFeatures.push({
                            type: 'Feature',
                            properties:
                                e.layer._renderer._features[i].feature
                                    .properties,
                            geometry: {},
                        })
                    }
                }
            }

            timedSelect(e.layer, layerName, e)

            L.DomEvent.stop(e)
        })
        .on(
            'mouseover',
            (function (vtKey) {
                return function (e, a, b, c) {
                    if (vtKey != null)
                        CursorInfo.update(
                            vtKey + ': ' + e.layer.properties[vtKey],
                            null,
                            false
                        )
                }
            })(layerObj.style.vtKey)
        )
        .on('mouseout', function () {
            CursorInfo.hide()
        })

    L_.layers.layer[layerObj.name].vtId = layerObj.style.vtId
    L_.layers.layer[layerObj.name].vtKey = layerObj.style.vtKey

    L_.setLayerOpacity(layerObj.name, L_.layers.opacity[layerObj.name])

    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
    L_.Map_.allLayersLoaded()
}

export default {
    make,
}
