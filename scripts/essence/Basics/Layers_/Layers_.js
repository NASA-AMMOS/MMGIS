//Holds all layer data
define(['Formulae_', 'Description', 'Search'], function (
    F_,
    Description,
    Search
) {
    var L_ = {
        url: window.location.href,
        mission: null,
        missionPath: null,
        missionsList: [],
        recentMissions: [],
        site: null,
        view: null,
        radius: null,
        masterdb: false,
        Viewer_: null,
        Map_: null,
        Globe_: null,
        UserInterface_: null,
        tools: null,
        //The full, unchanged data
        configData: null,
        //The full layer object
        layers: null, //was fullData
        //Name -> layer objects
        layersNamed: {}, //was namedLayersData
        //Name -> leaflet layer
        layersGroup: {}, //was mainLayerGroup
        //Index -> layer name
        layersOrdered: [], //was mainLayerOrder
        //Index -> layerName (an unchanging layersOrdered)
        layersOrderedFixed: [], //was fixedLayerOrder
        //Name -> original index
        layersIndex: {},
        //Index -> had loaded (T/F) (same index as orderedLayers)
        layersLoaded: [], //was layersloaded
        //Name -> style
        layersStyles: {}, //was layerStyles
        //Name -> legendurl
        layersLegends: {}, //was layerLegends
        //Name -> legendData
        layersLegendsData: {},
        //Name -> layer expanded in layers tab (T/F)
        expandArray: {},
        //Index -> layer object
        layersData: [],
        //Name => layer object
        layersDataByName: {},
        //Index -> level (0, 1, 2 ... )
        indentArray: [],
        //Name -> is toggled (T/F)
        toggledArray: {},
        //Name -> layer visible because header expanded (T/F)
        expanded: {},
        //Name -> layer opacity ( 0 to 1 )
        opacityArray: {},
        //Name -> filter value array
        layerFilters: {},
        //Name -> parent
        layersParent: {},
        //FUTURES
        FUTURES: {
            site: null,
            viewerImg: null,
            mapView: null,
            globeView: null,
            globeCamera: null,
            panelPercents: null,
        },
        //URL search strings
        searchStrings: null,
        //URL search file
        searchFile: null,
        toolsLoaded: false,
        addedfiles: {}, //filename -> null (not null if added)
        lastActivePoint: {
            layerName: null,
            lat: null,
            lon: null,
        },
        mapAndGlobeLinked: false,
        init: function (configData, missionsList, urlOnLayers) {
            parseConfig(configData, urlOnLayers)
            L_.missionsList = missionsList
        },
        clear: function () {
            L_.mission = null
            L_.missionPath = null
            L_.missionsList = []
            L_.site = null
            L_.view = null
            L_.radius = null
            L_.masterdb = false
            L_.Viewer_ = null
            L_.Map_ = null
            L_.Globe_ = null
            L_.UserInterface_ = null
            L_.tools = null
            L_.configData = null
            L_.layers = null
            L_.layersNamed = {}
            L_.layersGroup = {}
            L_.layersOrdered = []
            L_.layersOrderedFixed = []
            L_.layersIndex = {}
            L_.layersLoaded = []
            L_.layersStyles = {}
            L_.layersLegends = {}
            L_.layersLegendsData = {}
            L_.expandArray = {}
            L_.layersData = []
            L_.layersDataByName = {}
            L_.indentArray = []
            L_.toggledArray = {}
            L_.expanded = {}
            L_.opacityArray = {}
            L_.layerFilters = {}
            L_.layersParent = {}
            L_.FUTURES = {
                site: null,
                mapView: null,
                globeView: null,
                globeCamera: null,
                panelPercents: null,
                activePoint: null,
            }
            L_.searchStrings = null
            L_.searchFile = null
            L_.toolsLoaded = false
            L_.lastActivePoint = {
                layerName: null,
                lat: null,
                lon: null,
            }
        },
        fina: function (viewer_, map_, globe_, userinterface_) {
            this.Viewer_ = viewer_
            this.Map_ = map_
            this.Globe_ = globe_
            this.UserInterface_ = userinterface_
        },
        fullyLoaded: function () {
            this.selectPoint(this.FUTURES.activePoint)

            Search.init('.Search', L_, this.Viewer_, this.Map_, this.Globe_)
            Description.updateInfo()
        },
        setSite: function (newSite, newView, dontSetGlobe) {
            if (newSite != undefined && newSite != null) {
                this.site = newSite
                if (newView != null) {
                    this.view = newView

                    L_.Map_.resetView(newView)
                    if (!dontSetGlobe && L_.hasGlobe) {
                        L_.Globe_.setCenter(newView)
                    }
                }
            } else console.log('Failure updating to new site')
        },
        //Takes in config layer obj
        //Toggles a layer on and off and accounts for sublayers
        //Takes in a config layer object
        toggleLayer: function (s) {
            var on //if on -> turn off //if off -> turn on
            if (L_.toggledArray[s.name] == true) on = true
            else on = false
            if (s.type != 'header') {
                if (on) {
                    if (L_.Map_.map.hasLayer(L_.layersGroup[s.name])) {
                        L_.Map_.map.removeLayer(L_.layersGroup[s.name])
                    }
                    if (s.type == 'tile') {
                        L_.Globe_.removeTileLayer(s.name)
                    } else {
                        L_.Globe_.toggleLayer(s.name, false)
                    }
                } else {
                    if (L_.layersGroup[s.name]) {
                        L_.Map_.map.addLayer(L_.layersGroup[s.name])
                        L_.layersGroup[s.name].setZIndex(
                            L_.layersOrdered.length +
                                1 -
                                L_.layersOrdered.indexOf(s.name)
                        )
                    }
                    if (s.type == 'tile') {
                        var layerUrl = s.url
                        if (!F_.isUrlAbsolute(layerUrl))
                            layerUrl = L_.missionPath + layerUrl
                        var demUrl = s.demtileurl
                        if (!F_.isUrlAbsolute(demUrl))
                            demUrl = L_.missionPath + demUrl
                        if (
                            s.demtileurl == undefined ||
                            s.demtileurl.length == 0
                        )
                            demUrl = undefined
                        L_.Globe_.addTileLayer({
                            name: s.name,
                            order: L_.layersIndex[s.name],
                            on: L_.opacityArray[s.name],
                            path: layerUrl,
                            demPath: demUrl,
                            opacity: L_.opacityArray[s.name],
                            minZoom: s.minZoom,
                            maxZoom: s.maxNativeZoom,
                            boundingBox: s.boundingBox,
                        })
                    } else {
                        L_.Globe_.toggleLayer(s.name, true)
                    }
                }
            }

            if (on) L_.toggledArray[s.name] = false
            if (!on) L_.toggledArray[s.name] = true

            var sNext = getSublayers(s)
            if (sNext != 0) toggleSubRecur(sNext, on)

            function toggleSubRecur(r, on) {
                for (var i = 0; i < r.length; i++) {
                    //( if it doesn't have it ) or ( if it has it and it's true )
                    if (
                        !r[i].hasOwnProperty('togglesWithHeader') ||
                        (r[i].hasOwnProperty('togglesWithHeader') &&
                            r[i].togglesWithHeader)
                    ) {
                        if (r[i].type != 'header') {
                            if (on) {
                                if (
                                    L_.Map_.map.hasLayer(
                                        L_.layersGroup[r[i].name]
                                    )
                                ) {
                                    L_.Map_.map.removeLayer(
                                        L_.layersGroup[r[i].name]
                                    )
                                }
                                if (r[i].type == 'tile') {
                                    L_.Globe_.removeTileLayer(r[i].name)
                                } else {
                                    L_.Globe_.toggleLayer(r[i].name, true)
                                }
                                L_.toggledArray[r[i].name] = false
                            } else {
                                if (L_.layersGroup[r[i].name]) {
                                    L_.Map_.map.addLayer(
                                        L_.layersGroup[r[i].name]
                                    )
                                    if (r[i].type == 'vector') {
                                        L_.Map_.orderedBringToFront()
                                    }
                                    L_.layersGroup[r[i].name].setZIndex(
                                        L_.layersOrdered.length +
                                            1 -
                                            L_.layersOrdered.indexOf(r[i].name)
                                    )
                                }
                                if (r[i].type == 'tile') {
                                    var layerUrl = r[i].url
                                    if (!F_.isUrlAbsolute(layerUrl))
                                        layerUrl = L_.missionPath + layerUrl
                                    var demUrl = s.demtileurl
                                    if (!F_.isUrlAbsolute(demUrl))
                                        demUrl = L_.missionPath + demUrl
                                    if (s.demtileurl == undefined)
                                        demUrl = undefined
                                    L_.Globe_.addTileLayer({
                                        name: r[i].name,
                                        order: L_.layersIndex[r[i].name],
                                        on: L_.opacityArray[r[i].name],
                                        path: layerUrl,
                                        demPath: demUrl,
                                        opacity: L_.opacityArray[r[i].name],
                                        minZoom: r[i].minZoom,
                                        maxZoom: r[i].maxNativeZoom,
                                        boundingBox: r[i].boundingBox,
                                    })
                                } else {
                                    L_.Globe_.toggleLayer(r[i].name, false)
                                }
                                L_.toggledArray[r[i].name] = true
                            }
                        } else {
                            if (on) L_.toggledArray[r[i].name] = false
                            else L_.toggledArray[r[i].name] = true
                        }
                        var rNext = getSublayers(r[i])
                        if (rNext != 0) toggleSubRecur(rNext, on)
                    }
                }
            }
            function getSublayers(d) {
                if (d.hasOwnProperty('sublayers')) return d.sublayers
                else return 0
            }
            if (!on && s.type == 'vector') {
                L_.Map_.orderedBringToFront()
            }
        },
        disableAllBut: function (name, skipDisabling) {
            if (L_.layersNamed.hasOwnProperty(name)) {
                var l
                if (skipDisabling !== true) {
                    for (var i = 0; i < L_.layersData.length; i++) {
                        l = L_.layersData[i]
                        if (L_.toggledArray[l.name] == true) {
                            L_.toggleLayer(l)
                        }
                    }
                }
                for (var i = 0; i < L_.layersData.length; i++) {
                    l = L_.layersData[i]
                    if (L_.toggledArray[l.name] == false) {
                        if (l.name == name) L_.toggleLayer(l)
                    }
                    if (L_.toggledArray['Mars Overview'] == false) {
                        if (l.name == 'Mars Overview') L_.toggleLayer(l)
                    }
                }
            }
        },
        //Simply if visibility was set as true in the json,
        // add the layer
        addVisible: function (map_) {
            var map = map_
            if (map == null) {
                if (L_.Map_ == null) {
                    console.warn('Null addVisible')
                    return
                }
                map = L.Map_.map
            } else {
                map = map.map
            }
            for (var i = L_.layersData.length - 1; i >= 0; i--) {
                if (L_.toggledArray[L_.layersData[i].name] == true) {
                    if (L_.layersGroup[L_.layersData[i].name]) {
                        try {
                            map.addLayer(L_.layersGroup[L_.layersData[i].name])
                        } catch (e) {
                            console.warn(
                                'Warning: Failed to add layer to map: ' +
                                    L_.layersData[i].name
                            )
                        }
                    }
                    if (L_.layersData[i].type == 'tile') {
                        var s = L_.layersData[i]
                        var layerUrl = s.url
                        if (!F_.isUrlAbsolute(layerUrl))
                            layerUrl = L_.missionPath + layerUrl
                        var demUrl = s.demtileurl
                        if (!F_.isUrlAbsolute(demUrl))
                            demUrl = L_.missionPath + demUrl
                        if (s.demtileurl == undefined) demUrl = undefined
                        L_.Globe_.addTileLayer({
                            name: s.name,
                            order: L_.layersIndex[s.name],
                            on: L_.opacityArray[s.name],
                            path: layerUrl,
                            demPath: demUrl,
                            opacity: L_.opacityArray[s.name],
                            minZoom: s.minZoom,
                            maxZoom: s.maxNativeZoom,
                            boundingBox: s.boundingBox,
                        })
                    }
                }
            }
        },
        setLayerOpacity: function (name, newOpacity) {
            if (L_.Globe_) L_.Globe_.setLayerOpacity(name, newOpacity)
            var l = L_.layersGroup[name]
            if (l) {
                try {
                    l.setOpacity(newOpacity)
                } catch (error) {
                    l.setStyle({ opacity: newOpacity, fillOpacity: newOpacity })
                }
                try {
                    l.options.fillOpacity = newOpacity
                    l.options.opacity = newOpacity
                    l.options.style.fillOpacity = newOpacity
                    l.options.style.opacity = newOpacity
                } catch (error) {
                    l.options.fillOpacity = newOpacity
                    l.options.opacity = newOpacity
                }
            }
            L_.opacityArray[name] = newOpacity
        },
        getLayerOpacity: function (name) {
            var l = L_.layersGroup[name]

            if (l == null) return 0

            var opacity
            try {
                opacity = l.options.style.opacity
            } catch (error) {
                opacity = l.options.opacity
            }
            return opacity
        },
        setLayerFilter: function (name, filter, value) {
            if (filter == 'clear') L_.layerFilters[name] = {}
            L_.layerFilters[name] = L_.layerFilters[name] || {}
            L_.layerFilters[name][filter] = value
            if (typeof L_.layersGroup[name].updateFilter === 'function') {
                var filterArray = []
                for (var f in L_.layerFilters[name]) {
                    filterArray.push(f + ':' + L_.layerFilters[name][f])
                }
                L_.layersGroup[name].updateFilter(filterArray)
            }
        },
        resetLayerFills: function () {
            for (key in this.layersGroup) {
                if (
                    this.layersNamed[key] &&
                    (this.layersNamed[key].type == 'point' ||
                        (key.toLowerCase().indexOf('draw') == -1 &&
                            this.layersNamed[key].type == 'vector'))
                ) {
                    if (
                        this.layersGroup.hasOwnProperty(key) &&
                        this.layersGroup[key] != undefined &&
                        this.layersStyles.hasOwnProperty(key) &&
                        this.layersStyles[key] != undefined &&
                        this.layersStyles[key].hasOwnProperty('fillColor')
                    ) {
                        var fillColor = this.layersStyles[key].fillColor
                        this.layersGroup[key].eachLayer(function (layer) {
                            var opacity = layer.options.opacity
                            var fillOpacity = layer.options.fillOpacity
                            var weight = layer.options.weight
                            L_.layersGroup[key].resetStyle(layer)
                            layer.setStyle({
                                opacity: opacity,
                                fillOpacity: fillOpacity,
                                fillColor: layer.options.fillColor || fillColor,
                                weight: weight,
                            })
                        })
                    }
                }
            }
        },
        home() {
            L_.Map_.resetView(L_.configData.msv.view)
            L_.Globe_.setCenter(L_.configData.msv.view)
        },
        hasTool: function (toolName) {
            for (var i = 0; i < L_.tools.length; i++) {
                if (
                    L_.tools[i].hasOwnProperty('name') &&
                    L_.tools[i].name.toLowerCase() == toolName
                )
                    return true
            }
            return false
        },
        getToolVars: function (toolName) {
            for (var i = 0; i < L_.tools.length; i++) {
                if (
                    L_.tools[i].hasOwnProperty('name') &&
                    L_.tools[i].name.toLowerCase() == toolName &&
                    L_.tools[i].hasOwnProperty('variables')
                ) {
                    return L_.tools[i].variables
                }
            }
            console.warn(
                'Warning: Tried to get Tool: ' +
                    toolName +
                    "'s config variables and failed."
            )
            return {}
        },
        /**
         * @param {object} layer - leaflet layer object
         */
        setLastActivePoint: function (layer) {
            var layerName = layer.hasOwnProperty('options')
                ? layer.options.layerName
                : null
            var lat = layer.hasOwnProperty('_latlng') ? layer._latlng.lat : null
            var lon = layer.hasOwnProperty('_latlng') ? layer._latlng.lng : null

            if (layerName != null && lat != null && layerName != null) {
                L_.lastActivePoint = {
                    layerName: layerName,
                    lat: lat,
                    lon: lon,
                }
            } else {
                L_.lastActivePoint = {
                    layerName: null,
                    lat: null,
                    lon: null,
                }
            }
        },
        /**
         * @param {object} - activePoint { layerName: , lat: lon: }
         * @returns {bool} - true only if successful
         */
        selectPoint(activePoint) {
            if (
                activePoint &&
                activePoint.layerName != null &&
                activePoint.lat != null &&
                activePoint.lon != null
            ) {
                if (L_.layersGroup.hasOwnProperty(activePoint.layerName)) {
                    let g = L_.layersGroup[activePoint.layerName]._layers
                    for (let l in g) {
                        if (
                            g[l]._latlng.lat == activePoint.lat &&
                            g[l]._latlng.lng == activePoint.lon
                        ) {
                            g[l].fireEvent('click')
                            if (activePoint.view == 'go') {
                                let newView = []
                                if (g[l]._latlng) {
                                    newView = [
                                        g[l]._latlng.lat,
                                        g[l]._latlng.lng,
                                        activePoint.zoom ||
                                            L_.Map_.mapScaleZoom ||
                                            L_.Map_.map.getZoom(),
                                    ]
                                } else if (g[l]._latlngs) {
                                    let lat = 0,
                                        lng = 0
                                    let llflat = g[l]._latlngs.flat(Infinity)
                                    for (let ll of llflat) {
                                        lat += ll.lat
                                        lng += ll.lng
                                    }
                                    newView = [
                                        lat / llflat.length,
                                        lng / llflat.length,
                                        activePoint.zoom ||
                                            L_.Map_.mapScaleZoom ||
                                            L_.Map_.map.getZoom(),
                                    ]
                                }

                                L_.Map_.resetView(newView)
                                if (L_.hasGlobe) {
                                    L_.Globe_.setCenter(newView)
                                }
                            }
                            return true
                        }
                    }
                }
            } else if (
                activePoint &&
                activePoint.layerName != null &&
                activePoint.key != null &&
                activePoint.value != null
            ) {
                if (L_.layersGroup.hasOwnProperty(activePoint.layerName)) {
                    let g = L_.layersGroup[activePoint.layerName]._layers
                    for (let l in g) {
                        if (g[l] && g[l].feature && g[l].feature.properties) {
                            if (
                                F_.getIn(
                                    g[l].feature.properties,
                                    activePoint.key.split('.')
                                ) == activePoint.value
                            ) {
                                g[l].fireEvent('click')
                                if (activePoint.view == 'go') {
                                    let newView = []
                                    if (g[l]._latlng) {
                                        newView = [
                                            g[l]._latlng.lat,
                                            g[l]._latlng.lng,
                                            activePoint.zoom ||
                                                L_.Map_.mapScaleZoom ||
                                                L_.Map_.map.getZoom(),
                                        ]
                                    } else if (g[l]._latlngs) {
                                        let lat = 0,
                                            lng = 0
                                        let llflat = g[l]._latlngs.flat(
                                            Infinity
                                        )
                                        for (let ll of llflat) {
                                            lat += ll.lat
                                            lng += ll.lng
                                        }
                                        newView = [
                                            lat / llflat.length,
                                            lng / llflat.length,
                                            activePoint.zoom ||
                                                L_.Map_.mapScaleZoom ||
                                                L_.Map_.map.getZoom(),
                                        ]
                                    }

                                    L_.Map_.resetView(newView)
                                    if (L_.hasGlobe) {
                                        L_.Globe_.setCenter(newView)
                                    }
                                }
                                return true
                            }
                        }
                    }
                }
            }
            return false
        },
    }

    //Takes in a configData object and does a depth-first search through its
    // layers and sets L_ variables
    function parseConfig(configData, urlOnLayers) {
        //Create parsed configData
        L_.configData = configData

        //find zero resolution
        if (
            L_.configData.projection &&
            L_.configData.projection.resunitsperpixel &&
            L_.configData.projection.reszoomlevel
        ) {
            var baseRes =
                L_.configData.projection.resunitsperpixel *
                Math.pow(2, L_.configData.projection.reszoomlevel)
            var res = []
            for (var i = 0; i < 32; i++) {
                res.push(baseRes / Math.pow(2, i))
            }
            L_.configData.projection.res = res
        }
        //Make bounds and origin floats
        if (L_.configData.projection && L_.configData.projection.bounds) {
            for (var i in L_.configData.projection.bounds)
                L_.configData.projection.bounds[i] = parseFloat(
                    L_.configData.projection.bounds[i]
                )
        }
        if (L_.configData.projection && L_.configData.projection.origin) {
            for (var i in L_.configData.projection.origin)
                L_.configData.projection.origin[i] = parseFloat(
                    L_.configData.projection.origin[i]
                )
        }

        L_.mission = L_.configData.msv.mission
        L_.recentMissions.unshift(L_.mission)
        L_.missionPath = 'Missions/' + L_.configData.msv.mission + '/'
        L_.site = L_.configData.msv.site

        L_.view = [
            parseFloat(L_.configData.msv.view[0]),
            parseFloat(L_.configData.msv.view[1]),
            parseInt(L_.configData.msv.view[2]),
        ]
        if (isNaN(L_.view[0])) L_.view[0] = 0
        if (isNaN(L_.view[1])) L_.view[1] = 0
        if (isNaN(L_.view[2])) L_.view[2] = 0

        L_.radius = L_.configData.msv.radius
        L_.masterdb = L_.configData.msv.masterdb || false

        L_.tools = L_.configData.tools

        L_.hasMap = L_.configData.panels.indexOf('map') > -1
        L_.hasMap = true //Should always have map;
        L_.hasViewer = L_.configData.panels.indexOf('viewer') > -1
        L_.hasGlobe = L_.configData.panels.indexOf('globe') > -1
        //We only care about the layers now
        var layers = L_.configData.layers
        //Create parsed layers
        L_.layers = layers

        //Begin recursively going through those layers
        expandLayers(layers, 0, null)

        function expandLayers(d, level, prevName) {
            //Iterate over each layer
            for (var i = 0; i < d.length; i++) {
                //Create parsed layers named
                L_.layersNamed[d[i].name] = d[i]
                //Save the prevName for easy tracing back
                L_.layersParent[d[i].name] = prevName
                //Save the i
                L_.layersIndex[d[i].name] = i

                //Check if it's not a header and thus an actual layer with data
                if (d[i].type != 'header') {
                    //Create parsed layers ordered
                    L_.layersOrdered.push(d[i].name)
                    //Create parsed layers loaded
                    if (d[i].type != 'data' && d[i].type != 'model')
                        //No load checking for model since it's globe only
                        L_.layersLoaded.push(false)
                    else L_.layersLoaded.push(true)
                    //Create parsed layers styles
                    L_.layersStyles[d[i].name] = d[i].style
                    //Create parsed layers legends
                    L_.layersLegends[d[i].name] = d[i].legend

                    //relative or full path?
                    var legendPath = L_.layersLegends[d[i].name]
                    if (legendPath != undefined) {
                        if (!F_.isUrlAbsolute(legendPath))
                            legendPath = L_.missionPath + legendPath
                        $.get(
                            legendPath,
                            (function (name) {
                                return function (data) {
                                    data = F_.csvToJSON(data)
                                    L_.layersLegendsData[name] = data
                                }
                            })(d[i].name)
                        )
                    }
                    //Create parsed expand array
                    L_.expandArray[d[i].name] = true
                    //Create parsed expanded
                    L_.expanded[d[i].name] = false
                } else {
                    //If it is a header, keep it closed
                    //Create parsed expand array
                    L_.expandArray[d[i].name] = false
                    //Create parsed expanded
                    L_.expanded[d[i].name] = true
                }

                //Create parsed layers data
                L_.layersData.push(d[i])
                //And by name
                L_.layersDataByName[d[i].name] = d[i]
                //Create parsed indent array
                L_.indentArray.push(level)
                //Create parsed toggled array based on config layer visibility
                L_.toggledArray[d[i].name] =
                    d[i].visibility == undefined ? true : d[i].visibility

                //Create parsed opacity array
                let io = d[i].initialOpacity
                L_.opacityArray[d[i].name] =
                    io == null || io < 0 || io > 1 ? 1 : io

                //Set visibility if we have all the on layers listed in the url
                if (urlOnLayers) {
                    //this is null if we've no url layers
                    if (urlOnLayers.onLayers.hasOwnProperty(d[i].name)) {
                        L_.toggledArray[d[i].name] = true
                        L_.opacityArray[d[i].name] =
                            urlOnLayers.onLayers[d[i].name].opacity || 1
                    } else if (urlOnLayers.method == 'replace')
                        L_.toggledArray[d[i].name] = false
                }
                //Get the current layers sublayers (returns 0 if none)
                var dNext = getSublayers(d[i])
                //If they are sublayers, call this function again and move up a level
                if (dNext != 0) {
                    expandLayers(dNext, level + 1, d[i].name)
                }
            }

            //Save the order of the layers
            L_.layersOrderedFixed = L_.layersOrdered
        }
        //Get the current layers sublayers (returns 0 if none)
        function getSublayers(d) {
            //If object d has a sublayers property, return it
            if (d.hasOwnProperty('sublayers')) {
                return d.sublayers
            }
            //Otherwise return 0
            return 0
        }
    }

    return L_
})
