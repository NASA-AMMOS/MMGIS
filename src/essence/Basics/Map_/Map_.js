import $ from 'jquery'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import LayerTypeRegistry from '../Layers_/registry/LayerTypeRegistry'
import LayerAttachmentRegistry from '../Layers_/registry/LayerAttachmentRegistry'
import LayerInterface from '../Layers_/interface/LayerInterface'
import Viewer_ from '../Viewer_/Viewer_'
import Globe_ from '../Globe_/Globe_'
import ToolController_ from '../ToolController_/ToolController_'
import CursorInfo from '../UserInterface_/components/CursorInfo/CursorInfo'
import Description from '../UserInterface_/components/Description/Description'
import QueryURL from '../../services/QueryURL'
import MetadataCapturer from '../Layers_/capture/MetadataCapturer.js'
import {
    runInteractions,
    resolveLayerInteractions,
} from '../InteractionRunner/InteractionRunner'
import TimeControl from '../TimeControl_/TimeControl'

let L = window.L

// --- Per-layer fade control ---
// Leaflet's tile fade is map-level (_fadeAnimated). Time-enabled tile/raster
// layers should never fade (instant tile swap on pan or time change).
// All other tile layers fade normally.
// Strategy: patch _tileReady to check a per-layer _noFade flag.
;(function patchPerLayerFade() {
    const origTileReady = L.GridLayer.prototype._tileReady
    L.GridLayer.prototype._tileReady = function (coords, err, tile) {
        if (this._noFade && this._map) {
            const wasFade = this._map._fadeAnimated
            this._map._fadeAnimated = false
            origTileReady.call(this, coords, err, tile)
            this._map._fadeAnimated = wasFade
            return
        }
        return origTileReady.call(this, coords, err, tile)
    }
})()

let essenceFina = function () {}

let Map_ = {
    //Our main leaflet map variable
    map: null,
    toolbar: null,
    tempOverlayImage: null,
    activeLayer: null,
    allLayersLoadedPassed: false,
    player: { arrow: null, lookat: null },
    //Initialize a map based on a config file
    init: function (essenceFinal) {
        essenceFina = essenceFinal

        //Repair Leaflet and plugin incongruities
        L.DomEvent._fakeStop = L.DomEvent.fakeStop

        //var fakeStop = L.DomEvent.fakeStop || L.DomEvent._fakeStop || stop;?
        /*
            var xhr = new XMLHttpRequest();
            try {
              xhr.open("GET", 'Missions/MTTT/Layers/TEMP/M2020_EDL_bufpoints_3m_geo/12/2929/1834.pbf');
              xhr.responseType = "arraybuffer";
              xhr.onerror = function() {
                console.log("Network error")
              };
              xhr.onload = function() {
                if (xhr.status === 200) {
                    var data = new Pbf(new Uint8Array(xhr.response)).readFields(readData, {});

                    console.log( data )

                    function readData(tag, data, pbf) {
                        if (tag === 1) data.name = pbf.readString();
                        else if (tag === 2) data.version = pbf.readVarint();
                        //else if (tag === 3) data.layer = pbf.readMessage(readLayer, {});
                    }
                    function readLayer(tag, layer, pbf) {
                        if (tag === 1) layer.name = pbf.readString();
                        else if (tag === 3) layer.size = pbf.readVarint();
                    }
                }
                else console.log(xhr.statusText);
                
              };
              xhr.send();
            } catch (err) {
              console.log(err.message)
            }
            */

        var hasZoomControl = false
        if (L_.configData.look && L_.configData.look.zoomcontrol)
            hasZoomControl = true

        Map_.mapScaleZoom = L_.configData.msv.mapscale || null

        if (this.map != null) this.map.remove()

        let shouldFade = true

        let maxBounds = null
        if (
            !isNaN(L_.configData.msv.maxBoundsTopLeftLat) &&
            !isNaN(L_.configData.msv.maxBoundsTopLeftLng) &&
            !isNaN(L_.configData.msv.maxBoundsBottomRightLat) &&
            !isNaN(L_.configData.msv.maxBoundsBottomRightLng) &&
            !(
                L_.configData.msv.maxBoundsTopLeftLat === 0 &&
                L_.configData.msv.maxBoundsTopLeftLng === 0 &&
                L_.configData.msv.maxBoundsBottomRightLat === 0 &&
                L_.configData.msv.maxBoundsBottomRightLng === 0
            )
        ) {
            maxBounds = [
                [
                    L_.configData.msv.maxBoundsTopLeftLat,
                    L_.configData.msv.maxBoundsTopLeftLng,
                ],
                [
                    L_.configData.msv.maxBoundsBottomRightLat,
                    L_.configData.msv.maxBoundsBottomRightLng,
                ],
            ]
        }

        if (
            L_.configData.projection &&
            L_.configData.projection.custom === true
        ) {
            var cp = L_.configData.projection
            //console.log(cp)

            // Calculate resolutions array from zoom level and units per pixel
            var resolutions = []
            var baseResolution = parseFloat(cp.resunitsperpixel)
            var zoomLevel = parseInt(cp.reszoomlevel) || 0

            // Generate resolutions for zoom levels (typically 0-20)
            for (var i = 0; i <= 20; i++) {
                var zoomDiff = i - zoomLevel
                var resolution = baseResolution / Math.pow(2, zoomDiff)
                resolutions.push(resolution)
            }

            var crs = new L.Proj.CRS(
                Number.isFinite(parseInt(cp.epsg[0]))
                    ? `EPSG:${cp.epsg}`
                    : cp.epsg,
                cp.proj,
                {
                    origin: [
                        parseFloat(cp.origin[0]),
                        parseFloat(cp.origin[1]),
                    ],
                    resolutions: resolutions,
                    bounds: L.bounds(
                        [parseFloat(cp.bounds[0]), parseFloat(cp.bounds[1])],
                        [parseFloat(cp.bounds[2]), parseFloat(cp.bounds[3])]
                    ),
                },
                parseFloat(L_.configData.msv.radius.major)
            )
            crs.projString = cp.proj

            this.map = L.map('map', {
                zoomControl: hasZoomControl,
                editable: true,
                keyboard: false,
                crs: crs,
                zoomDelta: 0.05,
                zoomSnap: 0,
                fadeAnimation: shouldFade,
                //wheelPxPerZoomLevel: 500,
                worldCopyJump: L_.configData.msv.worldCopyJump || false,
                maxBounds,
            })

            window.mmgisglobal.customCRS = crs
        } else {
            //Make the empty map and turn off zoom controls
            this.map = L.map('map', {
                zoomControl: hasZoomControl,
                editable: true,
                keyboard: false,
                fadeAnimation: shouldFade,
                //crs: crs,
                //zoomDelta: 0.05,
                //zoomSnap: 0,
                //wheelPxPerZoomLevel: 500,
                worldCopyJump: L_.configData.msv.worldCopyJump || false,
                maxBounds,
            })
            // Default CRS

            const projString = `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${F_.radiusOfPlanetMajor} +b=${F_.radiusOfPlanetMinor} +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`
            window.mmgisglobal.customCRS = new L.Proj.CRS(
                'EPSG:3857',
                projString,
                null,
                F_.radiusOfPlanetMajor
            )
            window.mmgisglobal.customCRS.projString = projString
        }

        if (this.map.zoomControl) this.map.zoomControl.setPosition('topright')

        // Home button on zoom controls (resets to configured initial view)
        var HomeControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function () {
                var container = L.DomUtil.create(
                    'div',
                    'leaflet-control-zoom leaflet-bar leaflet-control'
                )
                var btn = L.DomUtil.create(
                    'a',
                    'leaflet-control-zoom-home',
                    container
                )
                btn.innerHTML =
                    '<i class="mdi mdi-home-variant-outline" style="font-size:16px;line-height:30px;"></i>'
                btn.href = '#'
                btn.title = 'Reset View'
                btn.setAttribute('role', 'button')
                btn.setAttribute('aria-label', 'Reset View')
                L.DomEvent.disableClickPropagation(btn)
                L.DomEvent.on(btn, 'click', function (e) {
                    L.DomEvent.preventDefault(e)
                    Map_.resetView(L_.view)
                })
                return container
            },
        })
        this.map.addControl(new HomeControl())

        if (Map_.mapScaleZoom) {
            L.control
                .scalefactor({
                    radius: parseInt(L_.configData.msv.radius.major),
                    mapScaleZoom: Map_.mapScaleZoom,
                })
                .addTo(this.map)
        }

        //Initialize the view to that set in config
        if (L_.FUTURES.mapView != null) {
            this.resetView(L_.FUTURES.mapView)
            if (L_.FUTURES.centerPin != null) {
                this._centerPin = new L.circleMarker(
                    [L_.FUTURES.mapView[0], L_.FUTURES.mapView[1]],
                    {
                        fillColor: '#000',
                        fillOpacity: 0,
                        color: 'lime',
                        weight: 2,
                    }
                )
                    .setRadius(4)
                    .addTo(this.map)
                if (
                    L_.FUTURES.centerPin.length > 0 &&
                    L_.FUTURES.centerPin != 'true'
                ) {
                    this._centerPin.on('mouseover', function () {
                        CursorInfo.update(L_.FUTURES.centerPin, null, false)
                    })
                    this._centerPin.on('mouseout', function () {
                        CursorInfo.hide()
                    })
                }
            }
        } else {
            this.resetView(L_.view)
        }

        //Remove attribution
        $('.leaflet-control-attribution').remove()

        // Expose Map_ on L_ early so that AJAX callbacks from makeLayers
        // can safely access L_.Map_.map (e.g. getZoom()) before L_.fina() runs.
        L_.Map_ = this

        //Make our layers
        makeLayers(L_.layers.dataFlat)

        //Just in case we have no layers
        allLayersLoaded()

        //Add a graticule
        if (L_.configData.look && L_.configData.look.graticule == true) {
            this.toggleGraticule(true)
        }

        //When done zooming, hide the things you're too far out to see/reveal the things you're close enough to see
        this.map.on('zoomend', function () {
            L_.enforceVisibilityCutoffs()

            // Set all zoom elements
            $('.map-autoset-zoom').text(Map_.map.getZoom())
        })

        if (Globe_.controls.link) {
            this.map.on('move', (e) => {
                const c = this.map.getCenter()
                Globe_.controls.link.linkMove(c.lng, c.lat)
            })
            this.map.on('mousemove', (e) => {
                Globe_.controls.link.linkMouseMove(e.latlng.lng, e.latlng.lat)
            })
            this.map.on('mouseout', (e) => {
                Globe_.controls.link.linkMouseOut()
            })
        }

        // Clear the selected feature if clicking on the map where there are no features
        Map_.map.addEventListener('click', clearOnMapClick)

        //Build the toolbar
        buildToolBar()

        //Set the time for any time enabled layers
        TimeControl.updateLayersTime()
    },
    toggleGraticule: function (on) {
        if (on)
            this.graticule = L.latlngGraticule({
                showLabel: true,
                color: 'rgba(255,255,255,0.75)',
                weight: 1,
                zoomInterval: [
                    { start: 2, end: 3, interval: 40 },
                    { start: 4, end: 5, interval: 20 },
                    { start: 6, end: 7, interval: 10 },
                    { start: 8, end: 9, interval: 5 },
                    { start: 10, end: 11, interval: 0.4 },
                    { start: 12, end: 13, interval: 0.2 },
                    { start: 14, end: 15, interval: 0.1 },
                    { start: 16, end: 17, interval: 0.01 },
                    { start: 18, end: 19, interval: 0.005 },
                    { start: 20, end: 21, interval: 0.0025 },
                    { start: 21, end: 30, interval: 0.00125 },
                ],
            }).addTo(Map_.map)
        else {
            this.rmNotNull(this.graticule)
            this.graticule = null
        }
    },
    clear: function () {
        this.map.eachLayer(function (layer) {
            Map_.map.removeLayer(layer)
        })

        this.toolbar = null
        this.tempOverlayImage = null
        this.activeLayer = null
        this.allLayersLoadedPassed = false
        this.player = { arrow: null, lookat: null }
    },
    setZoomToMapScale() {
        this.map.setZoom(this.mapScaleZoom)
    },
    //Focuses the map on [lat, lon, zoom]
    resetView: function (latlonzoom, stopNextMove) {
        //Uses Leaflet's setView
        var lat = parseFloat(latlonzoom[0])
        if (isNaN(lat)) lat = 0
        var lon = parseFloat(latlonzoom[1])
        if (isNaN(lon)) lon = 0
        var zoom = parseInt(latlonzoom[2])
        if (zoom == null || isNaN(zoom))
            zoom =
                this.map.getZoom() ||
                L_.configData.msv.mapscale ||
                L_.configData.msv.view[2]
        this.map.setView([lat, lon], zoom)
        this.map.invalidateSize()
    },
    //returns true if the map has the layer
    hasLayer: function (layername) {
        if (L_.layers.layer[layername]) {
            return Map_.map.hasLayer(L_.layers.layer[layername])
        }
        return false
    },
    //adds a temp tile layer to the map
    tempTileLayer: null,
    changeTempTileLayer: function (url) {
        this.removeTempTileLayer()
        this.tempTileLayer = L.tileLayer(url, {
            minZoom: 0,
            maxZoom: 25,
            maxNativeZoom: 25,
            tms: true, //!!!
            noWrap: true,
            continuousWorld: true,
            reuseTiles: true,
        }).addTo(this.map)
    },
    //removes that layer
    removeTempTileLayer: function () {
        this.rmNotNull(this.tempTileLayer)
    },
    //Removes the map layer if it isn't null
    rmNotNull: function (layer) {
        if (layer != null) {
            this.map.removeLayer(layer)
            layer = null
        }
    },
    //Redraws all layers, starting with the bottom one
    orderedBringToFront: function () {
        // An 'overlay' type is ordered by insertion, so it has to be removed
        // and re-added in order; a 'raster' type only needs its z-index reset.
        // Which one a type is, is declared (capabilities.map.stacking) rather
        // than asked of the layer — core partitions every layer here before it
        // touches any of them.
        let hasIndex = []
        let hasIndexRaster = []

        for (let i = L_._layersOrdered.length - 1; i >= 0; i--) {
            if (Map_.hasLayer(L_._layersOrdered[i])) {
                if (L_.layers.data[L_._layersOrdered[i]]) {
                    const stacking = LayerTypeRegistry.mapStacking(
                        L_.layers.data[L_._layersOrdered[i]].type
                    )
                    if (stacking === 'overlay') {
                        if (L_.layers.attachments[L_._layersOrdered[i]]) {
                            for (let s in L_.layers.attachments[
                                L_._layersOrdered[i]
                            ]) {
                                Map_.rmNotNull(
                                    L_.layers.attachments[L_._layersOrdered[i]][
                                        s
                                    ].layer
                                )
                            }
                        }
                        Map_.map.removeLayer(
                            L_.layers.layer[L_._layersOrdered[i]]
                        )
                        hasIndex.push(i)
                    } else if (stacking === 'raster') {
                        hasIndexRaster.push(i)
                    }
                }
            }
        }

        // First only vectors and images
        for (let i = 0; i < hasIndex.length; i++) {
            if (L_.layers.attachments[L_._layersOrdered[hasIndex[i]]]) {
                for (let s in L_.layers.attachments[
                    L_._layersOrdered[hasIndex[i]]
                ]) {
                    if (
                        L_.layers.attachments[L_._layersOrdered[hasIndex[i]]][s]
                            .on
                    ) {
                        // Only attachments that draw on the 2D map take part
                        // in map ordering.
                        if (
                            LayerAttachmentRegistry.rendersOnMap(
                                L_.layers.attachments[
                                    L_._layersOrdered[hasIndex[i]]
                                ][s].type
                            )
                        ) {
                            Map_.map.addLayer(
                                L_.layers.attachments[
                                    L_._layersOrdered[hasIndex[i]]
                                ][s].layer
                            )
                        }
                    }
                }
            }

            Map_.map.addLayer(L_.layers.layer[L_._layersOrdered[hasIndex[i]]])

            // Some overlay types (image) also need their z-index reset and
            // their tiles redrawn after being re-added.
            if (
                LayerTypeRegistry.redrawsOnReorder(
                    L_.layers.data[L_._layersOrdered[hasIndex[i]]].type
                )
            ) {
                L_.layers.layer[L_._layersOrdered[hasIndex[i]]].setZIndex(
                    L_._layersOrdered.length +
                        1 -
                        L_._layersOrdered.indexOf(
                            L_._layersOrdered[hasIndex[i]]
                        )
                )
                L_.layers.layer[L_._layersOrdered[hasIndex[i]]].clearCache()
                L_.layers.layer[L_._layersOrdered[hasIndex[i]]].redraw()
            }
        }

        L_.enforceVisibilityCutoffs()

        // Now only rasters
        // They're separate because its better to only change the raster z-index
        for (let i = 0; i < hasIndexRaster.length; i++) {
            L_.layers.layer[L_._layersOrdered[hasIndexRaster[i]]].setZIndex(
                L_._layersOrdered.length +
                    1 -
                    L_._layersOrdered.indexOf(
                        L_._layersOrdered[hasIndexRaster[i]]
                    )
            )
        }

        // Now bring any Drawn layers back to the front:
        Object.keys(L_.layers.layer).forEach((key) => {
            if (
                key.startsWith('DrawTool_') &&
                Array.isArray(L_.layers.layer[key])
            ) {
                L_.layers.layer[key].forEach((l) => {
                    try {
                        l.bringToFront()
                    } catch (err) {}
                })
            }
        })
    },
    refreshLayer: async function (
        layerObj,
        cb,
        skipOrderedBringToFront,
        stopLoops,
        resolvedUrl
    ) {
        // If it's a dynamic extent layer, just re-call its function
        const dynamicExtentKey = `dynamicextent_${layerObj.name}`
        const dynamicGeodatasetKey = `dynamicgeodataset_${layerObj.name}` // For velocity layers

        const subscription =
            L_._onSpecificLayerToggleSubscriptions[dynamicExtentKey] ||
            L_._onSpecificLayerToggleSubscriptions[dynamicGeodatasetKey]

        if (subscription != null) {
            if (L_.layers.on[layerObj.name]) {
                const layerData = L_.layers.data[layerObj.name]

                // Always bypass threshold for explicit refreshLayer() calls
                // (refresh intervals, time changes, manual API calls)
                // Pan/zoom events call the callback directly, not via refreshLayer
                if (layerData) {
                    layerData._ignoreDynamicExtentMoveThreshold = true
                }

                subscription.func(layerObj.name)
            }

            if (typeof cb === 'function') cb()
            return true
        }

        // We need to find and remove all points on the map that belong to the layer
        // Not sure if there is a cleaner way of doing this
        for (var i = L_._layersOrdered.length - 1; i >= 0; i--) {
            if (
                L_.layers.data[L_._layersOrdered[i]] &&
                LayerTypeRegistry.refreshesByRemake(
                    L_.layers.data[L_._layersOrdered[i]].type
                ) &&
                L_.layers.data[L_._layersOrdered[i]].name == layerObj.name
            ) {
                // Original
                if (L_._layersBeingMade[layerObj.name] !== true) {
                    L_.layers.on[layerObj.name] = true

                    // Pass `resolvedUrl` through to makeLayer instead of
                    // mutating `layerObj.url`. Mutation leaked the resolved
                    // URL to any concurrent code reading `layer.url` during
                    // the async makeLayer window (most importantly to a
                    // second TimeControl.reloadLayer() call that would then
                    // capture the *resolved* URL as its "template" and
                    // corrupt the placeholders for every subsequent reload).
                    await makeLayer(
                        layerObj,
                        true,
                        null,
                        null,
                        null,
                        stopLoops,
                        true,
                        null,
                        resolvedUrl
                    )
                    L_.addVisible(Map_, [layerObj.name])

                    L_.enforceVisibilityCutoffs()
                } else {
                    // A reload of this same layer is already in flight.
                    // Instead of silently dropping this request (causing
                    // "gaps" where dynamically-appearing data fails to
                    // show up), coalesce it into a single pending queued
                    // reload that fires after the in-flight one finishes.
                    // The queue uses one slot per layer name — duplicate
                    // queued reloads coalesce automatically.
                    L_._layerReloadQueue = L_._layerReloadQueue || {}
                    L_._layerReloadQueue[layerObj.name] = {
                        layerObj,
                        cb,
                        skipOrderedBringToFront,
                        stopLoops,
                        resolvedUrl,
                    }
                    return true
                }
                if (typeof cb === 'function') cb()
                return true
            }
        }
    },
    setPlayerArrow(lng, lat, rot) {
        var playerMapArrowOffsets = [
            [0.06, 0],
            [-0.04, 0.04],
            [-0.02, 0],
            [-0.04, -0.04],
        ]
        var playerMapArrowPolygon = []

        if (Map_.map.hasLayer(Map_.player.arrow))
            Map_.map.removeLayer(Map_.player.arrow)
        var scalar = 512 / Math.pow(2, Map_.map.getZoom())
        var rotatedOffsets
        for (var i = 0; i < playerMapArrowOffsets.length; i++) {
            rotatedOffsets = F_.rotatePoint(
                {
                    x: playerMapArrowOffsets[i][0],
                    y: playerMapArrowOffsets[i][1],
                },
                [0, 0],
                -rot
            )
            playerMapArrowPolygon.push([
                lat + scalar * rotatedOffsets.x,
                lng + scalar * rotatedOffsets.y,
            ])
        }
        Map_.player.arrow = L.polygon(playerMapArrowPolygon, {
            color: 'lime',
            opacity: 1,
            lineJoin: 'miter',
            weight: 2,
        }).addTo(Map_.map)
    },
    setPlayerLookat(lng, lat) {
        if (Map_.map.hasLayer(Map_.player.lookat))
            Map_.map.removeLayer(Map_.player.lookat)
        if (lat && lng) {
            Map_.player.lookat = new L.circleMarker([lat, lng], {
                fillColor: 'lime',
                fillOpacity: 0.75,
                color: 'lime',
                opacity: 1,
                weight: 2,
            })
                .setRadius(5)
                .addTo(Map_.map)
        }
    },
    hidePlayer(hideArrow, hideLookat) {
        if (hideArrow !== false && Map_.map.hasLayer(Map_.player.arrow))
            Map_.map.removeLayer(Map_.player.arrow)
        if (hideLookat !== false && Map_.map.hasLayer(Map_.player.lookat))
            Map_.map.removeLayer(Map_.player.lookat)
    },
    getScreenDiagonalInMeters() {
        let bb = document.getElementById('map').getBoundingClientRect()
        let nwLatLng = Map_.map.containerPointToLatLng([0, 0])
        let seLatLng = Map_.map.containerPointToLatLng([bb.width, bb.height])
        return F_.lngLatDistBetween(
            nwLatLng.lng,
            nwLatLng.lat,
            seLatLng.lng,
            seLatLng.lat
        )
    },
    getCurrentTileXYZs() {
        const bounds = Map_.map.getBounds()
        const zoom = Map_.map.getZoom()

        const min = Map_.map
                .project(bounds.getNorthWest(), zoom)
                .divideBy(256)
                .floor(),
            max = Map_.map
                .project(bounds.getSouthEast(), zoom)
                .divideBy(256)
                .floor(),
            xyzs = [],
            mod = Math.pow(2, zoom)

        for (var i = min.x; i <= max.x; i++) {
            for (var j = min.y; j <= max.y; j++) {
                var x = ((i % mod) + mod) % mod
                var y = ((j % mod) + mod) % mod
                var coords = new L.Point(x, y)
                coords.z = zoom
                xyzs.push(coords)
            }
        }

        return xyzs
    },
    makeLayer: makeLayer,
    makeLayers: makeLayers,
    allLayersLoaded: allLayersLoaded,
}

//Takes an array of layer objects and makes them map layers
function makeLayers(layersObj) {
    //Make each layer (backwards to maintain draw order)
    for (var i = layersObj.length - 1; i >= 0; i--) {
        makeLayer(layersObj[i])
    }
}
//Takes the layer object and makes it a map layer
async function makeLayer(
    layerObj,
    evenIfOff,
    forceGeoJSON,
    id,
    forceMake,
    stopLoops,
    isRefresh = false,
    targetMapContext = null,
    resolvedUrl = null
) {
    // Default to main map context for backward compatibility
    const mapContext = targetMapContext || {
        map: Map_.map,
        layerRegistry: L_.layers,
        default: true,
    }
    return new Promise(async (resolve, reject) => {
        const layerName = L_.asLayerUUID(layerObj.name)
        // Use map-specific lock if available, otherwise fall back to global lock
        const lockRegistry =
            mapContext.layerRegistry._layersBeingMade || L_._layersBeingMade
        if (forceMake !== true && lockRegistry[layerName] === true) {
            console.error(
                `ERROR - makeLayer: Cannot make layer ${layerObj.display_name}/${layerObj.name} as it's already being made!`
            )
            resolve(false)
            return
        } else {
            lockRegistry[layerName] = true
        }

        // Wrap the layer-builder dispatch in try/finally so the lock is
        // ALWAYS released (and any queued reload drained) even if one of
        // the per-type builders throws. Otherwise the lock would stay
        // pinned at `true` and every subsequent refreshLayer call for
        // this layer would queue against a permanently-locked entry that
        // never drains — silently breaking all future reloads.
        // Frozen map renderer context shared across the plugin's make /
        // afterMake / afterUnlock lifecycle hooks below.
        const rt = LayerTypeRegistry.get(layerObj.type)
        const pluginCtx = {
            evenIfOff,
            forceGeoJSON,
            isRefresh,
            mapContext,
            resolvedUrl,
        }
        // Resolve the map `make` phases once. `make` is dispatched by phase
        // (rather than LayerInterface.run) because its lifecycle straddles the
        // make-lock: before/main/after run inside the lock here, while
        // afterCommit must run in the finally block after the lock releases.
        // The `after`/`afterCommit` phases are also gated on `stopLoops`.
        const makeMain =
            rt && rt.map
                ? LayerInterface.getPhase(rt.map, 'make', 'main')
                : null
        let madeSuccessfully = true
        try {
            //Decide what kind of layer it is
            //Structural layers (headers) hold no data and are never made
            if (!LayerTypeRegistry.isStructural(layerObj.type)) {
                // Layer-type plugins own their map renderer. Every built-in type
                // is plugin-backed and dispatched through the registry with the
                // frozen renderer context — one real path per type, no per-type
                // branching in core.
                if (makeMain) {
                    const makeBefore = LayerInterface.getPhase(
                        rt.map,
                        'make',
                        'before'
                    )
                    const makeAfter = LayerInterface.getPhase(
                        rt.map,
                        'make',
                        'after'
                    )
                    if (makeBefore) await makeBefore(layerObj, pluginCtx)
                    await makeMain(layerObj, pluginCtx)
                    // Post-make hook inside the lock (e.g. vector rebuilds its
                    // filtering GeoJSON). Gated on stopLoops.
                    if (makeAfter && stopLoops !== true)
                        await makeAfter(layerObj, pluginCtx)
                } else if (rt) {
                    // A registered type with no map renderer is globe-only
                    // (e.g. model, 3dtiles). Nothing to draw on the 2D map;
                    // mark it loaded so allLayersLoaded() can resolve.
                    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] =
                        true
                    allLayersLoaded()
                } else {
                    console.warn('Unknown layer type: ' + layerObj.type)
                }
            }
        } catch (err) {
            madeSuccessfully = false
            console.error(
                `ERROR - makeLayer: failed to make layer ${layerObj.display_name}/${layerObj.name}`,
                err
            )
        } finally {
            // release hold on layer (use same registry as above)
            lockRegistry[layerName] = false

            // Trigger filter AFTER releasing the lock — triggerFilter may call
            // LocalFilterer.filter which does clearVectorLayer + updateVectorLayer.
            // updateVectorLayer checks _layersBeingMade and bails if the lock is
            // still held, which would leave the layer empty (cleared but not
            // repopulated). Moving this here ensures the lock is free.
            try {
                const afterCommit =
                    rt && rt.map
                        ? LayerInterface.getPhase(rt.map, 'make', 'afterCommit')
                        : null
                if (madeSuccessfully && stopLoops !== true && afterCommit) {
                    await afterCommit(layerObj, pluginCtx)
                }
            } catch (filterErr) {
                console.warn(
                    'WARNING - make.afterCommit hook failed for',
                    layerObj.name,
                    filterErr
                )
            }

            // Drain any queued reload request for this layer that arrived
            // while the lock was held. We dequeue exactly one entry — the
            // queue coalesces by layer name so newer queued requests have
            // already replaced older ones. Fire-and-forget: the queued
            // caller's Promise has already resolved with `true`, so we
            // don't need to wait or propagate this result.
            //
            // CRITICAL: this MUST run in finally — otherwise an exception
            // inside the switch above would leave the queue holding a
            // stale entry that the next caller would re-queue against,
            // permanently blocking reloads for this layer.
            L_._layerReloadQueue = L_._layerReloadQueue || {}
            if (L_._layerReloadQueue[layerObj.name]) {
                const queued = L_._layerReloadQueue[layerObj.name]
                delete L_._layerReloadQueue[layerObj.name]
                // Use setTimeout 0 so the current resolve() chain unwinds
                // first — this prevents stack growth if multiple reloads
                // are queued back-to-back, and gives any awaiting code in
                // the original caller a chance to see makeLayer's result
                // before the next reload begins.
                setTimeout(() => {
                    Map_.refreshLayer(
                        queued.layerObj,
                        queued.cb,
                        queued.skipOrderedBringToFront,
                        queued.stopLoops,
                        queued.resolvedUrl
                    )
                }, 0)
            }

            resolve(madeSuccessfully)
        }
    })
}

//Default is onclick show full properties and onhover show 1st property
Map_.onEachFeatureDefault = onEachFeatureDefault
function onEachFeatureDefault(feature, layer) {
    const pv = L_.getLayersChosenNamePropVal(feature, layer)

    layer['useKeyAsName'] = Object.keys(pv)[0]
    if (
        layer.hasOwnProperty('options') &&
        layer.options.hasOwnProperty('layerName')
    ) {
        L_.layers.data[layer.options.layerName].useKeyAsName =
            layer['useKeyAsName']
    }

    const layerData = L_.layers.data[layer.options?.layerName] || {}
    const typeInteractions = LayerTypeRegistry.defaultInteractions(
        layerData.type
    )
    const hooks = resolveLayerInteractions(
        layerData,
        undefined,
        typeInteractions.ids
    )
    // Lets the runner enforce each interaction's `applicableLayerTypes`.
    const layerTypeChain = LayerTypeRegistry.typeChain(layerData.type)

    if (typeof layer['useKeyAsName'] === 'string' && hooks.hover) {
        layer.on('mouseover', function (e) {
            const ctx = {
                Map_,
                feature,
                layer,
                layerName: layer.options.layerName,
                layerData,
                layerVar: layerData.variables || {},
                event: e,
                eventType: 'hover',
                layerTypeChain,
                typeInteractionConfigs: typeInteractions.settings,
                stop: false,
                state: {},
            }
            runInteractions(hooks.hover, ctx)
        })
    }
    if (typeof layer['useKeyAsName'] === 'string' && hooks.mouseout) {
        layer.on('mouseout', function (e) {
            const ctx = {
                Map_,
                feature,
                layer,
                layerName: layer.options.layerName,
                layerData,
                layerVar: layerData.variables || {},
                event: e,
                eventType: 'mouseout',
                layerTypeChain,
                typeInteractionConfigs: typeInteractions.settings,
                stop: false,
                state: {},
            }
            runInteractions(hooks.mouseout, ctx)
        })
    }

    if (!(
        feature.style &&
        feature.style.hasOwnProperty('noclick') &&
        feature.style.noclick
    )) {
        layer.on('click', (e) => {
            featureDefaultClick(feature, layer, e)
        })
    }
}

Map_.featureDefaultClick = featureDefaultClick
function featureDefaultClick(feature, layer, e) {
    if (
        ToolController_.activeTool &&
        ToolController_.activeTool.disableLayerInteractions === true
    )
        return
    MetadataCapturer.populateMetadata(layer, async () => {
        const layerName = layer.options.layerName
        const layerData = L_.layers.data[layerName]
        const typeInteractions = LayerTypeRegistry.defaultInteractions(
            layerData.type
        )
        const pipeline = resolveLayerInteractions(
            layerData,
            undefined,
            typeInteractions.ids
        ).click

        L_.clearFeatureAttachments()

        const ctx = {
            Map_,
            feature,
            layer,
            layerName,
            layerData,
            layerVar: layerData.variables || {},
            event: e,
            eventType: 'click',
            layerTypeChain: LayerTypeRegistry.typeChain(layerData.type),
            typeInteractionConfigs: typeInteractions.settings,
            additional: null,
            stop: false,
            state: {},
        }

        await runInteractions(pipeline, ctx)
    })
}

//Because some layers load faster than others, check to see if
// all our layers were loaded before moving on
function allLayersLoaded() {
    if (!Map_.allLayersLoadedPassed) {
        //Only continues if all layers have been loaded
        for (var i = 0; i < L_._layersLoaded.length; i++) {
            if (L_._layersLoaded[i] == false) {
                return
            }
        }
        Map_.allLayersLoadedPassed = true

        //Then do these
        essenceFina()
        L_.addVisible(Map_)
        L_.enforceVisibilityCutoffs()

        ToolController_.finalizeTools()

        L_.loaded()
        //OTHER TEMPORARY TEST STUFF THINGS

        // displayOnStart for separated tools (e.g. Legend) is now handled
        // by ToolController_.finalizeTools() above — Map_ does not reference
        // specific tools.
    }
}

function buildToolBar() {
    $('#mapToolBar').html('')

    Map_.toolBar = $('<div>')
        .attr('class', 'row childpointerevents')
        .css('height', '100%')
    $('#mapToolBar').append(Map_.toolBar)

    const scaleBarBounds = $('<div>').attr('id', 'scaleBarBounds').css({
        width: '270px',
        height: '36px',
    })
    Map_.toolBar.append(scaleBarBounds)

    // Create SVG with proper namespace for D3 compatibility
    const scaleBarSvg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
    )
    scaleBarSvg.setAttribute('id', 'scaleBar')
    scaleBarSvg.setAttribute('width', '270px')
    scaleBarSvg.setAttribute('height', '36px')
    scaleBarBounds.append(scaleBarSvg)
}

function clearOnMapClick(event) {
    if (Map_._justSetActiveLayer) {
        Map_._justSetActiveLayer = false

        L_.setActiveFeature(null)

        let _event = new CustomEvent('newActiveFeature', {
            detail: {
                activeFeature: null,
            },
        })
        document.dispatchEvent(_event)
        return
    }
    // Skip if there is no actively selected feature
    if (!Map_.activeLayer) {
        L_.setActiveFeature(null)

        let _event = new CustomEvent('newActiveFeature', {
            detail: {
                activeFeature: null,
            },
        })
        document.dispatchEvent(_event)
        return
    }

    if ('latlng' in event) {
        // Position of clicked element
        const latlng = event.latlng

        let found = false
        // For all MMGIS layers
        for (let key in L_.layers.layer) {
            if (L_.layers.layer[key] === false || L_.layers.layer[key] == null)
                continue
            let layers

            // Layers can be a LayerGroup or an array of LayerGroup
            if ('getLayers' in L_.layers.layer[key]) {
                layers = L_.layers.layer[key].getLayers()
            }

            if (Array.isArray(L_.layers.layer[key])) {
                layers = L_.layers.layer[key]
            }

            for (let k in layers) {
                const layer = layers[k]
                if (!layer) continue
                if ('getLayers' in layer) {
                    const _layer = layer.getLayers()
                    for (let x in _layer) {
                        found = checkBounds(_layer[x])
                        // We should bubble down further for layers that have no fill, as it is possible
                        // for there to be layers with features under the transparent fill
                        if (found) {
                            if (layer.options.fill) {
                                break
                            } else {
                                found = false
                            }
                        }
                    }
                } else {
                    found = checkBounds(layer)
                    if (found) {
                        // We should bubble down further for layers that have no fill, as it is possible
                        // for there to be layers with features under the transparent fill
                        if (layer.options.fill) {
                            break
                        } else {
                            found = false
                        }
                    }
                }

                if (found) break
            }

            if (found) {
                // If a clicked feature is found, break out early because MMGIS can only select
                // a single feature at a time (i.e. no group select)
                break
            }

            function checkBounds(layer) {
                if (
                    layer.feature &&
                    layer.feature.geometry.type.toLowerCase() === 'polygon'
                ) {
                    if (
                        L.leafletPip.pointInLayer(
                            [latlng.lng, latlng.lat],
                            layer
                        ).length > 0
                    )
                        return true
                } else if ('getBounds' in layer) {
                    // Use the pixel bounds because longitude/latitude conversions for bounds
                    // may be odd in the case of polar projections
                    if (
                        layer._pxBounds &&
                        layer._pxBounds.contains(event.layerPoint)
                    ) {
                        return true
                    }
                } else if ('getLatLng' in layer) {
                    // A latlng is a latlng, regardless of the projection type
                    // WARNING: This is imperfect because the click latlng and marker center latlng
                    // can differ but still intersect
                    if (layer.getLatLng().equals(latlng)) {
                        return true
                    }
                }
                return false
            }
        }

        // If no feature was selected by this click event, clear the currently selected item
        if (!found) {
            L_.setActiveFeature(null)
        }
    }
}

export default Map_
