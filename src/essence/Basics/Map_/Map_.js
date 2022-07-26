import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import { captureVector } from '../Layers_/LayerCapturer'
import {
    constructVectorLayer,
    constructSublayers,
} from '../Layers_/LayerConstructors'
import Viewer_ from '../Viewer_/Viewer_'
import Globe_ from '../Globe_/Globe_'
import ToolController_ from '../ToolController_/ToolController_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Description from '../../Ancillary/Description'
import QueryURL from '../../Ancillary/QueryURL'
import { Kinds } from '../../../pre/tools'
import DataShaders from '../../Ancillary/DataShaders'
import calls from '../../../pre/calls'
import TimeControl from '../../Ancillary/TimeControl'
let L = window.L

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

        if (
            L_.configData.projection &&
            L_.configData.projection.custom == true
        ) {
            var cp = L_.configData.projection
            //console.log(cp)
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
                    resolutions: cp.res,
                    bounds: L.bounds(
                        [parseFloat(cp.bounds[0]), parseFloat(cp.bounds[1])],
                        [parseFloat(cp.bounds[2]), parseFloat(cp.bounds[3])]
                    ),
                },
                parseFloat(L_.configData.msv.radius.major)
            )

            this.map = L.map('map', {
                zoomControl: hasZoomControl,
                editable: true,
                crs: crs,
                zoomDelta: 0.05,
                zoomSnap: 0,
                fadeAnimation: shouldFade,
                //wheelPxPerZoomLevel: 500,
            })

            window.mmgisglobal.customCRS = crs
        } else {
            //Make the empty map and turn off zoom controls
            this.map = L.map('map', {
                zoomControl: hasZoomControl,
                editable: true,
                fadeAnimation: shouldFade,
                //crs: crs,
                //zoomDelta: 0.05,
                //zoomSnap: 0,
                //wheelPxPerZoomLevel: 500,
            })

            // Default CRS
            window.mmgisglobal.customCRS = new L.Proj.CRS(
                'EPSG:3857',
                `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${F_.radiusOfPlanetMajor} +b=${F_.radiusOfPlanetMinor} +towgs84=0,0,0,0,0,0,0 +units=m +no_defs `
            )
        }

        if (this.map.zoomControl) this.map.zoomControl.setPosition('topright')

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
        d3.select('.leaflet-control-attribution').remove()

        //Make our layers
        makeLayers(L_.layersData)

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
        if (L_.layersGroup[layername]) {
            return Map_.map.hasLayer(L_.layersGroup[layername])
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
    //Removes the map layer if it isnt null
    rmNotNull: function (layer) {
        if (layer != null) {
            this.map.removeLayer(layer)
            layer = null
        }
    },
    //Redraws all layers, starting with the bottom one
    orderedBringToFront: function () {
        let hasIndex = []
        let hasIndexRaster = []

        for (let i = L_.layersOrdered.length - 1; i >= 0; i--) {
            if (Map_.hasLayer(L_.layersOrdered[i])) {
                if (L_.layersNamed[L_.layersOrdered[i]]) {
                    if (L_.layersNamed[L_.layersOrdered[i]].type === 'vector') {
                        if (L_.layersGroupSublayers[L_.layersOrdered[i]]) {
                            for (let s in L_.layersGroupSublayers[
                                L_.layersOrdered[i]
                            ]) {
                                Map_.rmNotNull(
                                    L_.layersGroupSublayers[
                                        L_.layersOrdered[i]
                                    ][s].layer
                                )
                            }
                        }
                        Map_.map.removeLayer(
                            L_.layersGroup[L_.layersOrdered[i]]
                        )
                        hasIndex.push(i)
                    } else if (
                        L_.layersNamed[L_.layersOrdered[i]].type === 'tile' ||
                        L_.layersNamed[L_.layersOrdered[i]].type === 'data'
                    ) {
                        hasIndexRaster.push(i)
                    }
                }
            }
        }

        // First only vectors
        for (let i = 0; i < hasIndex.length; i++) {
            if (L_.layersGroupSublayers[L_.layersOrdered[hasIndex[i]]]) {
                for (let s in L_.layersGroupSublayers[
                    L_.layersOrdered[hasIndex[i]]
                ]) {
                    if (
                        L_.layersGroupSublayers[L_.layersOrdered[hasIndex[i]]][
                            s
                        ].on
                    ) {
                        if (
                            L_.layersGroupSublayers[
                                L_.layersOrdered[hasIndex[i]]
                            ][s].type !== 'model'
                        )
                            Map_.map.addLayer(
                                L_.layersGroupSublayers[
                                    L_.layersOrdered[hasIndex[i]]
                                ][s].layer
                            )
                    }
                }
            }
            Map_.map.addLayer(L_.layersGroup[L_.layersOrdered[hasIndex[i]]])
        }

        L_.enforceVisibilityCutoffs()

        // Now only rasters
        // They're separate because its better to only change the raster z-index
        for (let i = 0; i < hasIndexRaster.length; i++) {
            L_.layersGroup[L_.layersOrdered[hasIndexRaster[i]]].setZIndex(
                L_.layersOrdered.length +
                    1 -
                    L_.layersOrdered.indexOf(
                        L_.layersOrdered[hasIndexRaster[i]]
                    )
            )
        }
    },
    refreshLayer: async function (layerObj) {
        // We need to find and remove all points on the map that belong to the layer
        // Not sure if there is a cleaner way of doing this
        for (var i = L_.layersOrdered.length - 1; i >= 0; i--) {
            if (
                L_.layersNamed[L_.layersOrdered[i]] &&
                L_.layersNamed[L_.layersOrdered[i]].type == 'vector' &&
                L_.layersNamed[L_.layersOrdered[i]].name == layerObj.name
            ) {
                const wasOn = L_.toggledArray[layerObj.name]
                if (wasOn) L_.toggleLayer(L_.layersNamed[layerObj.name]) // turn off if on
                // fake on
                L_.toggledArray[layerObj.name] = true
                await makeLayer(layerObj, true)
                L_.addVisible(Map_, [layerObj.name])

                // turn off if was off
                if (wasOn) L_.toggledArray[layerObj.name] = false
                L_.toggleLayer(L_.layersNamed[layerObj.name]) // turn back on/off

                L_.enforceVisibilityCutoffs()
                return
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
}

//Specific internal functions likely only to be used once
function getLayersChosenNamePropVal(feature, layer) {
    //These are what you'd think they'd be (Name could be thought of as key)
    var propertyName, propertyValue
    var foundThroughVariables = false
    if (
        layer.hasOwnProperty('options') &&
        layer.options.hasOwnProperty('layerName')
    ) {
        var l = L_.layersNamed[layer.options.layerName]
        if (
            l.hasOwnProperty('variables') &&
            l.variables.hasOwnProperty('useKeyAsName')
        ) {
            propertyName = l.variables['useKeyAsName']
            if (feature.properties.hasOwnProperty(propertyName)) {
                propertyValue = F_.getIn(feature.properties, propertyName)
                if (propertyValue != null) foundThroughVariables = true
            }
        }
    }
    // Use first key
    if (!foundThroughVariables) {
        for (var key in feature.properties) {
            //Store the current feature's key
            propertyName = key
            //Be certain we have that key in the feature
            if (feature.properties.hasOwnProperty(key)) {
                //Store the current feature's value
                propertyValue = feature.properties[key]
                //Break out of for loop since we're done
                break
            }
        }
    }
    return { name: propertyName, value: propertyValue }
}

//Takes an array of layer objects and makes them map layers
function makeLayers(layersObj) {
    //Make each layer (backwards to maintain draw order)
    for (var i = layersObj.length - 1; i >= 0; i--) {
        makeLayer(layersObj[i])
    }
}
//Takes the layer object and makes it a map layer
async function makeLayer(layerObj, evenIfOff) {
    //Decide what kind of layer it is
    //Headers do not need to be made
    if (layerObj.type != 'header') {
        //Simply call the appropriate function for each layer type
        switch (layerObj.type) {
            case 'vector':
                await makeVectorLayer(evenIfOff)
                break
            case 'tile':
                makeTileLayer()
                break
            case 'vectortile':
                makeVectorTileLayer()
                break
            case 'query':
                await makeVectorLayer(false, true)
                break
            case 'data':
                makeDataLayer()
                break
            case 'model':
                //Globe only
                makeModelLayer()
                break
            default:
                console.warn('Unknown layer type: ' + layerObj.type)
        }
    }

    //Default is onclick show full properties and onhover show 1st property
    Map_.onEachFeatureDefault = onEachFeatureDefault
    function onEachFeatureDefault(feature, layer) {
        var pv = getLayersChosenNamePropVal(feature, layer)

        layer['useKeyAsName'] = pv.name
        if (
            layer.hasOwnProperty('options') &&
            layer.options.hasOwnProperty('layerName')
        ) {
            L_.layersNamed[layer.options.layerName].useKeyAsName = pv.name
        }

        if (
            pv.hasOwnProperty('name') &&
            pv.name != null &&
            typeof pv.name === 'string'
        ) {
            var propertyName = pv.name.capitalizeFirstLetter()
            var propertyValue = pv.value

            //Add a mouseover event to the layer
            layer.on('mouseover', function () {
                //Make it turn on CursorInfo and show name and value
                CursorInfo.update(
                    propertyName + ': ' + propertyValue,
                    null,
                    false
                )
            })
            //Add a mouseout event
            layer.on('mouseout', function () {
                //Make it turn off CursorInfo
                CursorInfo.hide()
            })
        }

        if (
            !(
                feature.style &&
                feature.style.hasOwnProperty('noclick') &&
                feature.style.noclick
            )
        ) {
            //Add a click event to send the data to the info tab
            layer.on('click', function (e) {
                if (
                    ToolController_.activeTool &&
                    ToolController_.activeTool.disableLayerInteractions === true
                )
                    return

                //Query dataset links if possible and add that data to the feature's properties
                if (
                    layer.options.layerName &&
                    L_.layersNamed[layer.options.layerName] &&
                    L_.layersNamed[layer.options.layerName].variables &&
                    L_.layersNamed[layer.options.layerName].variables
                        .datasetLinks
                ) {
                    const dl =
                        L_.layersNamed[layer.options.layerName].variables
                            .datasetLinks
                    let dlFilled = dl
                    for (let i = 0; i < dlFilled.length; i++) {
                        dlFilled[i].search = F_.getIn(
                            layer.feature.properties,
                            dlFilled[i].prop.split('.')
                        )
                    }

                    calls.api(
                        'datasets_get',
                        {
                            queries: JSON.stringify(dlFilled),
                        },
                        function (data) {
                            const d = data.body
                            for (let i = 0; i < d.length; i++) {
                                if (d[i].type == 'images') {
                                    layer.feature.properties.images =
                                        layer.feature.properties.images || []
                                    for (
                                        let j = 0;
                                        j < d[i].results.length;
                                        j++
                                    ) {
                                        layer.feature.properties.images.push(
                                            d[i].results[j]
                                        )
                                    }
                                    //remove duplicates
                                    layer.feature.properties.images =
                                        F_.removeDuplicatesInArrayOfObjects(
                                            layer.feature.properties.images
                                        )
                                } else {
                                    layer.feature.properties._data =
                                        d[i].results
                                }
                            }
                            keepGoing()
                        },
                        function (data) {
                            keepGoing()
                        }
                    )
                } else {
                    keepGoing()
                }

                function keepGoing() {
                    //View images
                    var propImages = propertiesToImages(
                        feature.properties,
                        layer.options.metadata
                            ? layer.options.metadata.base_url || ''
                            : ''
                    )

                    Kinds.use(
                        L_.layersNamed[layerObj.name].kind,
                        Map_,
                        feature,
                        layer,
                        layer.options.layerName,
                        propImages,
                        e
                    )

                    //update url
                    if (layer != null && layer.hasOwnProperty('options')) {
                        var keyAsName
                        if (layer.hasOwnProperty('useKeyAsName')) {
                            keyAsName =
                                layer.feature.properties[layer.useKeyAsName]
                        } else {
                            keyAsName = layer.feature.properties[0]
                        }
                    }

                    Viewer_.changeImages(propImages, feature)
                    for (var i in propImages) {
                        if (propImages[i].type == 'radargram') {
                            //Globe_.radargram( layer.options.layerName, feature.geometry, propImages[i].url, propImages[i].length, propImages[i].depth );
                            break
                        }
                    }

                    //figure out how to construct searchStr in URL. For example: a ChemCam target can sometime
                    //be searched by "target sol", or it can be searched by "sol target" depending on config file.
                    var searchToolVars = L_.getToolVars('search')
                    var searchfields = {}
                    if (searchToolVars.hasOwnProperty('searchfields')) {
                        for (var layerfield in searchToolVars.searchfields) {
                            var fieldString =
                                searchToolVars.searchfields[layerfield]
                            fieldString = fieldString.split(')')
                            for (var i = 0; i < fieldString.length; i++) {
                                fieldString[i] = fieldString[i].split('(')
                                var li = fieldString[i][0].lastIndexOf(' ')
                                if (li != -1) {
                                    fieldString[i][0] = fieldString[
                                        i
                                    ][0].substring(li + 1)
                                }
                            }
                            fieldString.pop()
                            //0 is function, 1 is parameter
                            searchfields[layerfield] = fieldString
                        }
                    }

                    var str = ''
                    if (searchfields.hasOwnProperty(layer.options.layerName)) {
                        var sf = searchfields[layer.options.layerName] //sf for search field
                        for (var i = 0; i < sf.length; i++) {
                            str += sf[i][1]
                            str += ' '
                        }
                    }
                    str = str.substring(0, str.length - 1)

                    var searchFieldTokens = str.split(' ')
                    var searchStr

                    if (searchFieldTokens.length == 2) {
                        if (
                            searchFieldTokens[0].toLowerCase() ==
                            layer.useKeyAsName.toLowerCase()
                        ) {
                            searchStr =
                                keyAsName + ' ' + layer.feature.properties.Sol
                        } else {
                            searchStr =
                                layer.feature.properties.Sol + ' ' + keyAsName
                        }
                    }

                    QueryURL.writeSearchURL(
                        [searchStr],
                        layer.options.layerName
                    )
                }
            })
        }
    }

    //Pretty much like makePointLayer but without the pointToLayer stuff
    async function makeVectorLayer(evenIfOff, useEmptyGeoJSON) {
        return new Promise((resolve, reject) => {
            captureVector(
                layerObj,
                { evenIfOff: evenIfOff, useEmptyGeoJSON: useEmptyGeoJSON },
                add
            )

            function add(data) {
                if (data == null || data === 'off') {
                    L_.layersLoaded[
                        L_.layersOrdered.indexOf(layerObj.name)
                    ] = true
                    L_.layersGroup[layerObj.name] = data == null ? null : false
                    allLayersLoaded()
                    resolve()
                    return
                }

                layerObj.style = layerObj.style || {}
                layerObj.style.layerName = layerObj.name

                layerObj.style.opacity = L_.opacityArray[layerObj.name]
                //layerObj.style.fillOpacity = L_.opacityArray[layerObj.name]

                L_.layersGroupSublayers[layerObj.name] = constructSublayers(
                    data,
                    layerObj
                )
                L_.layersGroup[layerObj.name] = constructVectorLayer(
                    data,
                    layerObj,
                    onEachFeatureDefault,
                    Map_
                )

                d3.selectAll(
                    '.' + layerObj.name.replace(/\s/g, '').toLowerCase()
                ).data(data.features)
                L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
                allLayersLoaded()

                resolve()
            }
        })
    }

    function makeTileLayer() {
        var layerUrl = layerObj.url
        if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl
        var bb = null
        if (layerObj.hasOwnProperty('boundingBox')) {
            bb = L.latLngBounds(
                L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
                L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
            )
        }

        var tileFormat = 'tms'
        // For backward compatibility with the .tms option
        if (typeof layerObj.tileformat === 'undefined') {
            tileFormat =
                typeof layerObj.tms === 'undefined' ? true : layerObj.tms
            tileFormat = tileFormat ? 'tms' : 'wmts'
        } else tileFormat = layerObj.tileformat

        L_.layersGroup[layerObj.name] = L.tileLayer.colorFilter(layerUrl, {
            minZoom: layerObj.minZoom,
            maxZoom: layerObj.maxZoom,
            maxNativeZoom: layerObj.maxNativeZoom,
            tileFormat: tileFormat,
            tms: tileFormat === 'tms',
            //noWrap: true,
            continuousWorld: true,
            reuseTiles: true,
            bounds: bb,
            time: typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
            starttime:
                typeof layerObj.time === 'undefined' ? '' : layerObj.time.start,
            endtime:
                typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
        })

        L_.setLayerOpacity(layerObj.name, L_.opacityArray[layerObj.name])

        L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
        allLayersLoaded()
    }

    function makeVectorTileLayer() {
        var layerUrl = layerObj.url
        if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl

        let urlSplit = layerObj.url.split(':')

        if (
            urlSplit[0].toLowerCase() === 'geodatasets' &&
            urlSplit[1] != null
        ) {
            layerUrl =
                '/API/geodatasets/get?layer=' +
                urlSplit[1] +
                '&type=mvt&x={x}&y={y}&z={z}'
        }

        var bb = null
        if (layerObj.hasOwnProperty('boundingBox')) {
            bb = L.latLngBounds(
                L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
                L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
            )
        }

        var clearHighlight = function () {
            for (let l of Object.keys(L_.layersNamed)) {
                if (L_.layersGroup[l]) {
                    var highlight = L_.layersGroup[l].highlight
                    if (highlight) {
                        L_.layersGroup[l].resetFeatureStyle(highlight)
                    }
                    L_.layersGroup[l].highlight = null
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

                        Kinds.use(
                            L_.layersNamed[layerName].kind,
                            Map_,
                            L_.layersGroup[layerName].activeFeatures[0],
                            layer,
                            layerName,
                            null,
                            ell
                        )

                        ToolController_.getTool('InfoTool').use(
                            layer,
                            layerName,
                            L_.layersGroup[layerName].activeFeatures,
                            null,
                            null,
                            null,
                            ell
                        )
                        L_.layersGroup[layerName].activeFeatures = []
                    }
                })(layer, layerName, e),
                100
            )
        }

        var vectorTileOptions = {
            layerName: layerObj.name,
            rendererFactory: L.canvas.tile,
            vectorTileLayerStyles: layerObj.style.vtLayer || {},
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

        L_.layersGroup[layerObj.name] = L.vectorGrid
            .protobuf(layerUrl, vectorTileOptions)
            .on('click', function (e) {
                let layerName = e.sourceTarget._layerName
                let vtId = L_.layersGroup[layerName].vtId
                clearHighlight()
                L_.layersGroup[layerName].highlight = e.layer.properties[vtId]

                L_.layersGroup[layerName].setFeatureStyle(
                    L_.layersGroup[layerName].highlight,
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
                L_.layersGroup[layerName].activeFeatures =
                    L_.layersGroup[layerName].activeFeatures || []
                L_.layersGroup[layerName].activeFeatures.push({
                    type: 'Feature',
                    properties: e.layer.properties,
                    geometry: {},
                })

                Map_.activeLayer = e.sourceTarget._layer
                if (Map_.activeLayer) L_.Map_._justSetActiveLayer = true

                let p = e.sourceTarget._point

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
                        L_.layersGroup[layerName].activeFeatures.push({
                            type: 'Feature',
                            properties:
                                e.layer._renderer._features[i].feature
                                    .properties,
                            geometry: {},
                        })
                    }
                }

                timedSelect(e.sourceTarget._layer, layerName, e)

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

        L_.layersGroup[layerObj.name].vtId = layerObj.style.vtId
        L_.layersGroup[layerObj.name].vtKey = layerObj.style.vtKey

        L_.setLayerOpacity(layerObj.name, L_.opacityArray[layerObj.name])

        L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
        allLayersLoaded()
    }

    function makeModelLayer() {
        L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
        allLayersLoaded()
    }

    function makeDataLayer() {
        let layerUrl = layerObj.demtileurl
        if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl

        let bb = null
        if (layerObj.hasOwnProperty('boundingBox')) {
            bb = L.latLngBounds(
                L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
                L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
            )
        }

        const shader = F_.getIn(layerObj, 'variables.shader') || {}
        const shaderType = shader.type || 'image'

        var uniforms = {}
        for (let i = 0; i < DataShaders[shaderType].settings.length; i++) {
            uniforms[DataShaders[shaderType].settings[i].parameter] =
                DataShaders[shaderType].settings[i].value
        }

        L_.layersGroup[layerObj.name] = L.tileLayer.gl({
            options: {
                tms: true,
                bounds: bb,
            },
            fragmentShader: DataShaders[shaderType].frag,
            tileUrls: [layerUrl],
            pixelPerfect: true,
            uniforms: uniforms,
        })

        if (DataShaders[shaderType].attachImmediateEvents) {
            DataShaders[shaderType].attachImmediateEvents(layerObj.name, shader)
        }

        L_.setLayerOpacity(layerObj.name, L_.opacityArray[layerObj.name])

        L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
        allLayersLoaded()
    }
}

//Because some layers load faster than others, check to see if
// all our layers were loaded before moving on
function allLayersLoaded() {
    if (!Map_.allLayersLoadedPassed) {
        //Only continues if all layers have been loaded
        for (var i = 0; i < L_.layersLoaded.length; i++) {
            if (L_.layersLoaded[i] == false) {
                return
            }
        }
        Map_.allLayersLoadedPassed = true

        //Then do these
        essenceFina()
        L_.addVisible(Map_)
        L_.enforceVisibilityCutoffs()

        //OTHER TEMPORARY TEST STUFF THINGS
    }
}

function propertiesToImages(props, baseUrl) {
    baseUrl = baseUrl || ''
    var images = []
    //Use "images" key first
    if (props.hasOwnProperty('images')) {
        for (var i = 0; i < props.images.length; i++) {
            if (props.images[i].url) {
                var url = baseUrl + props.images[i].url
                if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
                if (props.images[i].isModel) {
                    images.push({
                        url: url,
                        texture: props.images[i].texture,
                        name:
                            (props.images[i].name ||
                                props.images[i].url.match(/([^\/]*)\/*$/)[1]) +
                            ' [Model]',
                        type: 'model',
                        isPanoramic: false,
                        isModel: true,
                        values: props.images[i].values || {},
                        master: props.images[i].master,
                    })
                } else {
                    if (props.images[i].isPanoramic) {
                        images.push({
                            ...props.images[i],
                            url: url,
                            name:
                                (props.images[i].name ||
                                    props.images[i].url.match(
                                        /([^\/]*)\/*$/
                                    )[1]) + ' [Panoramic]',
                            type: 'photosphere',
                            isPanoramic: true,
                            isModel: false,
                            values: props.images[i].values || {},
                            master: props.images[i].master,
                        })
                    }
                    images.push({
                        url: url,
                        name:
                            props.images[i].name ||
                            props.images[i].url.match(/([^\/]*)\/*$/)[1],
                        type: props.images[i].type || 'image',
                        isPanoramic: false,
                        isModel: false,
                        values: props.images[i].values || {},
                        master: props.images[i].master,
                    })
                }
            }
        }
    }
    //If there isn't one, search all string valued props for image urls
    else {
        for (var p in props) {
            if (
                typeof props[p] === 'string' &&
                props[p].toLowerCase().match(/\.(jpeg|jpg|gif|png|xml)$/) !=
                    null
            ) {
                var url = props[p]
                if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
                images.push({
                    url: url,
                    name: p,
                    isPanoramic: false,
                    isModel: false,
                })
            }
            if (
                typeof props[p] === 'string' &&
                (props[p].toLowerCase().match(/\.(obj)$/) != null ||
                    props[p].toLowerCase().match(/\.(dae)$/) != null)
            ) {
                var url = props[p]
                if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
                images.push({
                    url: url,
                    name: p,
                    isPanoramic: false,
                    isModel: true,
                })
            }
        }
    }

    return images
}

function buildToolBar() {
    d3.select('#mapToolBar').html('')

    Map_.toolBar = d3
        .select('#mapToolBar')
        .append('div')
        .attr('class', 'row childpointerevents')
        .style('height', '100%')
    Map_.toolBar
        .append('div')
        .attr('id', 'scaleBarBounds')
        .style('width', '270px')
        .style('height', '36px')
        .append('svg')
        .attr('id', 'scaleBar')
        .attr('width', '270px')
        .attr('height', '36px')
}

function clearOnMapClick(event) {
    if (Map_._justSetActiveLayer) {
        Map_._justSetActiveLayer = false
        return
    }
    // Skip if there is no actively selected feature
    if (!Map_.activeLayer) {
        return
    }

    if ('latlng' in event) {
        // Position of clicked element
        const latlng = event.latlng

        let found = false
        // For all MMGIS layers
        for (let key in L_.layersGroup) {
            if (L_.layersGroup[key] === false || L_.layersGroup[key] == null)
                continue
            let layers

            // Layers can be a LayerGroup or an array of LayerGroup
            if ('getLayers' in L_.layersGroup[key]) {
                layers = L_.layersGroup[key].getLayers()
            }

            if (Array.isArray(L_.layersGroup[key])) {
                layers = L_.layersGroup[key]
            }

            for (let k in layers) {
                const layer = layers[k]
                if (!layer) continue
                if ('getLayers' in layer) {
                    const _layer = layer.getLayers()
                    for (let x in _layer) {
                        found = checkBounds(_layer[x])
                        if (found) break
                    }
                } else {
                    found = checkBounds(layer)
                }

                if (found) break
            }

            if (found) {
                // If a clicked feature is found, break out early because MMGIS can only select
                // a single feature at a time (i.e. no group select)
                break
            }

            function checkBounds(layer) {
                if (layer.feature.geometry.type.toLowerCase() === 'polygon') {
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
