define([
    'Layers_',
    'Formulae_',
    'leaflet',
    'leafletPip',
    'leafletImageTransform',
    'proj4leaflet',
    'leafletEditable',
    'leafletHotline',
    'leafletCorridor',
    'Viewer_',
    'Globe_',
    'ToolController_',
    'd3',
    'CursorInfo',
    'Description',
    'QueryURL',
], function(
    L_,
    F_,
    L,
    leafletPip,
    leafletImageTransform,
    proj4leaflet,
    leafletEditable,
    leafletHotline,
    leafletCorridor,
    Viewer_,
    Globe_,
    ToolController_,
    d3,
    CursorInfo,
    Description,
    QueryURL
) {
    essenceFina = function() {}

    var Map_ = {
        //Our main leaflet map variable
        map: null,
        toolbar: null,
        tempOverlayImage: null,
        activeLayer: null,
        allLayersLoadedPassed: false,
        player: { arrow: null, lookat: null },
        //Initialize a map based on a config file
        init: function(essenceFinal) {
            essenceFina = essenceFinal

            var hasZoomControl = false
            if (L_.configData.look && L_.configData.look.zoomcontrol)
                hasZoomControl = true

            if (this.map != null) this.map.remove()
            if (
                L_.configData.projection &&
                L_.configData.projection.custom == true
            ) {
                var cp = L_.configData.projection
                //console.log( cp );
                var crs = new L.Proj.CRS(
                    'EPSG:' + cp.epsg,
                    cp.proj,
                    {
                        origin: [
                            parseFloat(cp.origin[0]),
                            parseFloat(cp.origin[1]),
                        ],
                        resolutions: cp.res,
                        bounds: L.bounds(
                            [
                                parseFloat(cp.bounds[0]),
                                parseFloat(cp.bounds[1]),
                            ],
                            [parseFloat(cp.bounds[2]), parseFloat(cp.bounds[3])]
                        ),
                    },
                    L_.configData.msv.radius.major
                )
                this.map = L.map('map', {
                    zoomControl: hasZoomControl,
                    editable: true,
                    crs: crs,
                })
            } else {
                //Make the empty map and turn off zoom controls
                this.map = L.map('map', {
                    zoomControl: hasZoomControl,
                    editable: true,
                })
            }
            if (this.map.zoomControl)
                this.map.zoomControl.setPosition('topright')

            //Initialize the view to that set in config
            if (L_.FUTURES.mapView != null) {
                this.resetView(L_.FUTURES.mapView)
            } else {
                this.resetView(L_.view)
            }
            //Remove attribution
            d3.select('.leaflet-control-attribution').remove()

            //Make our layers
            makeLayers(L_.layersData)

            //Just in case wehave no layers
            allLayersLoaded()

            /*
            //Add a graticule
            if (L_.configData.look && L_.configData.look.graticule == true) {
                L.latlngGraticule({
                    showLabel: true,
                    color: '#aaa',
                    weight: 1,
                    zoomInterval: [
                        { start: 2, end: 3, interval: 60 },
                        { start: 4, end: 5, interval: 30 },
                        { start: 6, end: 7, interval: 10 },
                        { start: 8, end: 9, interval: 5 },
                        { start: 10, end: 11, interval: 1 },
                        { start: 12, end: 13, interval: 0.5 },
                        { start: 14, end: 15, interval: 0.1 },
                        { start: 16, end: 17, interval: 0.02 },
                        { start: 18, end: 19, interval: 0.005 },
                    ],
                }).addTo(Map_.map)
            }
            */

            //When done zooming, hide the things you're too far out to see/reveal the things you're close enough to see
            this.map.on('zoomend', function() {
                enforceVisibilityCutoffs()
            })

            Map_.map.on('move', function(e) {
                if (L_.mapAndGlobeLinked || mmgisglobal.ctrlDown) {
                    if (L_.Globe_ != null) {
                        var c = Map_.map.getCenter()
                        L_.Globe_.setCenter([c.lat, c.lng])
                    }
                }
            })
            Map_.map.on('mousemove', function(e) {
                if (L_.mapAndGlobeLinked || mmgisglobal.ctrlDown) {
                    if (L_.Globe_ != null) L_.Globe_.setLink(e.latlng)
                }
            })
            Map_.map.on('mouseout', function(e) {
                if (L_.Globe_ != null) L_.Globe_.setLink('off')
            })

            //Build the toolbar
            buildToolBar()
        },
        clear: function() {
            this.map.eachLayer(function(layer) {
                Map_.map.removeLayer(layer)
            })

            this.toolbar = null
            this.tempOverlayImage = null
            this.activeLayer = null
            this.allLayersLoadedPassed = false
            this.player = { arrow: null, lookat: null }
        },
        //Focuses the map on [lat, lon, zoom]
        resetView: function(latlonzoom, stopNextMove) {
            //Uses Leaflet's setView
            var lat = parseFloat(latlonzoom[0])
            if (isNaN(lat)) lat = 0
            var lon = parseFloat(latlonzoom[1])
            if (isNaN(lon)) lon = 0
            var zoom = parseInt(latlonzoom[2])
            if (isNaN(zoom)) zoom = this.map.getZoom()
            this.map.setView([lat, lon], zoom)
            this.map.invalidateSize()
        },
        //returns true if the map has the layer
        hasLayer: function(layername) {
            if (L_.layersGroup[layername]) {
                return Map_.map.hasLayer(L_.layersGroup[layername])
            }
            return false
        },
        //adds a temp tile layer to the map
        tempTileLayer: null,
        changeTempTileLayer: function(url) {
            this.removeTempTileLayer()
            this.tempTileLayer = L.tileLayer(url, {
                minZoom: 0,
                maxZoom: 25,
                maxNativeZoom: 25,
                tms: true,
                noWrap: true,
                continuousWorld: true,
                reuseTiles: true,
            }).addTo(this.map)
        },
        //removes that layer
        removeTempTileLayer: function() {
            this.rmNotNull(this.tempTileLayer)
        },
        //Removes the map layer if it isnt null
        rmNotNull: function(layer) {
            if (layer != null) {
                this.map.removeLayer(layer)
                layer = null
            }
        },
        //Redraws all layers, starting with the bottom one
        orderedBringToFront: function() {
            var hasIndex = []
            for (var i = L_.layersOrdered.length - 1; i >= 0; i--) {
                if (Map_.hasLayer(L_.layersOrdered[i])) {
                    Map_.map.removeLayer(L_.layersGroup[L_.layersOrdered[i]])
                    hasIndex.push(i)
                }
            }
            for (var i = 0; i < hasIndex.length; i++) {
                Map_.map.addLayer(L_.layersGroup[L_.layersOrdered[hasIndex[i]]])
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
                    propertyValue = feature.properties[propertyName]
                    foundThroughVariables = true
                }
            }
        }
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
        //Make each layer (backwards to mantain draw order)
        for (var i = layersObj.length - 1; i >= 0; i--) {
            makeLayer(layersObj[i])
        }
    }
    //Takes the layer object and makes it a map layer
    function makeLayer(layerObj) {
        //Decide what kind of layer it is
        //Headers do not need to be made
        if (layerObj.type != 'header') {
            //Simply call the appropriate function for each layer type
            switch (layerObj.type) {
                case 'vector':
                    makeVectorLayer()
                    break
                case 'point':
                    makeVectorLayer() //makePointLayer(); //DEATH TO POINT
                    break
                case 'tile':
                    makeTileLayer()
                    break
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
            var propertyName = pv.name.capitalizeFirstLetter()
            var propertyValue = pv.value

            //Add a mouseover event to the layer
            layer.on('mouseover', function() {
                //Make it turn on CursorInfo and show name and value
                CursorInfo.update(
                    propertyName + ': ' + propertyValue,
                    null,
                    false
                )
            })
            //Add a mouseout event
            layer.on('mouseout', function() {
                //Make it turn off CursorInfo
                CursorInfo.hide()
            })

            if (
                !(
                    feature.style &&
                    feature.style.hasOwnProperty('noclick') &&
                    feature.style.noclick
                )
            ) {
                //Add a click event to send the data to the info tab
                layer.on('click', function(e) {
                    L_.setLastActivePoint(layer)
                    L_.resetLayerFills()
                    layer.setStyle({ fillColor: 'red' })
                    layer.bringToFront()
                    Map_.activeLayer = layer
                    Description.updatePoint(Map_.activeLayer)
                    ToolController_.getTool('InfoTool').use(feature)
                    ToolController_.getTool('ChemistryTool').use(layer)
                    Globe_.highlight(
                        Globe_.findSpriteObject(
                            layer.options.layerName,
                            layer.feature.properties[layer.useKeyAsName]
                        ),
                        false
                    )
                    Viewer_.highlight(layer)

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

                    //View images
                    var propImages = propertiesToImages(
                        feature.properties,
                        layer.options.metadata.base_url || ''
                    )
                    Viewer_.changeImages(propImages)
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
                    } else {
                        console.warn(
                            "Cannot parse search field keys. Please check to make sure Search Tool's " +
                                'configuration is correct, or contact admin.'
                        )
                    }

                    QueryURL.writeSearchURL(
                        [searchStr],
                        layer.options.layerName
                    )
                })
            }
        }

        //Pretty much like makePointLayer but without the pointToLayer stuff
        function makeVectorLayer() {
            var layerUrl = layerObj.url
            if (!F_.isUrlAbsolute(layerUrl))
                layerUrl = L_.missionPath + layerUrl
            $.getJSON(layerUrl + '?nocache=' + new Date().getTime(), function(
                data
            ) {
                layerObj.style.layerName = layerObj.name

                layerObj.style.opacity = L_.opacityArray[layerObj.name]
                layerObj.style.fillOpacity = L_.opacityArray[layerObj.name]

                var col = layerObj.style.color
                var opa = String(layerObj.style.opacity)
                var wei = String(layerObj.style.weight)
                var fiC = layerObj.style.fillColor
                var fiO = String(layerObj.style.fillOpacity)

                var leafletLayerObject = {
                    style: function(feature) {
                        // Priority to prop, prop.color, then style color.
                        var finalCol =
                            col.toLowerCase().substring(0, 4) == 'prop'
                                ? feature.properties[col.substring(5)] || '#FFF'
                                : feature.style && feature.style.stroke
                                ? feature.style.stroke
                                : col
                        var finalOpa =
                            opa.toLowerCase().substring(0, 4) == 'prop'
                                ? feature.properties[opa.substring(5)] || '1'
                                : feature.style && feature.style.opacity
                                ? feature.style.opacity
                                : opa
                        var finalWei =
                            wei.toLowerCase().substring(0, 4) == 'prop'
                                ? feature.properties[wei.substring(5)] || '1'
                                : feature.style && feature.style.weight
                                ? feature.style.weight
                                : wei
                        var finalFiC =
                            fiC.toLowerCase().substring(0, 4) == 'prop'
                                ? feature.properties[fiC.substring(5)] || '#000'
                                : feature.style && feature.style.fill
                                ? feature.style.fill
                                : fiC
                        var finalFiO =
                            fiO.toLowerCase().substring(0, 4) == 'prop'
                                ? feature.properties[fiO.substring(5)] || '1'
                                : feature.style && feature.style.fillopacity
                                ? feature.style.fillopacity
                                : fiO

                        var noPointerEventsClass =
                            feature.style && feature.style.nointeraction
                                ? ' noPointerEvents'
                                : ''

                        layerObj.style.color = finalCol
                        layerObj.style.opacity = finalOpa
                        layerObj.style.weight = finalWei
                        layerObj.style.fillColor = finalFiC
                        layerObj.style.fillOpacity = finalFiO
                        layerObj.style.className =
                            layerObj.style.className + noPointerEventsClass
                        layerObj.style.metadata = data.metadata || {}

                        return layerObj.style
                    },
                    onEachFeature: onEachFeatureDefault,
                }
                if (layerObj.hasOwnProperty('radius')) {
                    leafletLayerObject.pointToLayer = function(
                        feature,
                        latlong
                    ) {
                        //We use leaflet's circlemarker for this
                        return L.circleMarker(
                            latlong,
                            leafletLayerObject.style
                        ).setRadius(layerObj.radius)
                    }
                }

                //Set up any custom layer interactions
                //Currently MSL specific
                switch (layerObj.name) {
                    //If it's Waypoints
                    case 'Waypoints':
                        //Use this custom layer object
                        leafletLayerObject = {
                            //Same style
                            style: layerObj.style,
                            //Different onEachFeature
                            onEachFeature: function(feature, layer) {
                                var pv = getLayersChosenNamePropVal(
                                    feature,
                                    layer
                                )
                                layer['useKeyAsName'] = pv.name
                                if (
                                    layer.hasOwnProperty('options') &&
                                    layer.options.hasOwnProperty('layerName')
                                ) {
                                    L_.layersNamed[
                                        layer.options.layerName
                                    ].useKeyAsName = pv.name
                                }
                                var propertyName = pv.name.capitalizeFirstLetter()
                                var propertyValue = pv.value

                                //Add a mouseover event to the layer
                                layer.on('mouseover', function() {
                                    //Make it turn on CursorInfo and show name and value
                                    CursorInfo.update(
                                        propertyName + ': ' + propertyValue,
                                        null,
                                        false
                                    )
                                })
                                layer.on('mouseout', function() {
                                    CursorInfo.hide()
                                })
                                //Add a click event to send the data to the info tab
                                layer.on('click', function() {
                                    L_.setLastActivePoint(layer)
                                    //highlight
                                    L_.resetLayerFills()
                                    layer.setStyle({ fillColor: 'red' })

                                    //Make rover image curiosity
                                    Map_.rmNotNull(Map_.tempOverlayImage)
                                    //256 x 338, 256 is 2.8m
                                    var wm = 2.8
                                    var w = 256
                                    var h = 338
                                    var lngM = F_.metersToDegrees(wm) / 2
                                    var latM = lngM * (h / w)
                                    var center = [
                                        layer._latlng.lng,
                                        layer._latlng.lat,
                                    ]
                                    var angle = -layer.feature.properties
                                        .yaw_rad
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
                                        'resources/RoverImages/CuriosityTopDownOrthoSmall.png',
                                        anchors,
                                        { opacity: 1, clip: anchors }
                                    )
                                    Map_.tempOverlayImage
                                        .addTo(Map_.map)
                                        .bringToBack()

                                    //View images
                                    var propImages = propertiesToImages(
                                        feature.properties,
                                        ''
                                    )
                                    //Add mosaic to imageViewer
                                    var d = feature.properties
                                    var ivSol = '0000' + parseInt(d.sol)
                                    ivSol = ivSol.substr(ivSol.length - 4)
                                    var ivSite = '0000' + parseInt(d.site)
                                    ivSite = ivSite.substr(ivSite.length - 3)
                                    var ivPos = '0000' + parseInt(d.pos)
                                    ivPos = ivPos.substr(ivPos.length - 4)
                                    propImages.unshift({
                                        url:
                                            'Missions/' +
                                            L_.mission +
                                            '/' +
                                            'Data/Mosaics/N_L000_' +
                                            ivSol +
                                            '_ILT' +
                                            ivSite +
                                            'CYL_S_' +
                                            ivPos +
                                            '_UNCORM1.jpg',
                                        name:
                                            ivSol + '_' + ivSite + '_' + ivPos,
                                        isPanoramic: true,
                                    })

                                    Viewer_.changeImages(propImages)
                                    //Viewer_.changeImages( propertiesToImages( feature.properties ) );
                                    Map_.activeLayer = layer
                                    Description.updatePoint(Map_.activeLayer)
                                    ToolController_.getTool('InfoTool').use(
                                        feature
                                    )
                                    Globe_.highlight(
                                        Globe_.findSpriteObject(
                                            layer.options.layerName,
                                            layer.feature.properties[
                                                layer.useKeyAsName
                                            ]
                                        ),
                                        false
                                    )

                                    //update url
                                    if (
                                        layer != null &&
                                        layer.hasOwnProperty('options')
                                    ) {
                                        var keyAsName
                                        if (
                                            layer.hasOwnProperty('useKeyAsName')
                                        ) {
                                            keyAsName =
                                                layer.feature.properties[
                                                    layer.useKeyAsName
                                                ]
                                        } else {
                                            keyAsName =
                                                layer.feature.properties[0]
                                        }
                                    }

                                    if (
                                        typeof keyAsName == 'string' &&
                                        keyAsName.indexOf('_') > -1
                                    ) {
                                        var nameTokens = keyAsName.split('_')
                                        var tmpStr = ''
                                        for (
                                            var i = 0;
                                            i < nameTokens.length;
                                            i++
                                        ) {
                                            tmpStr += nameTokens[i] + ' '
                                        }

                                        keyAsName = tmpStr
                                    }

                                    QueryURL.writeSearchURL(
                                        [keyAsName],
                                        layer.options.layerName
                                    )
                                })
                            },
                            //Same point to layer
                            pointToLayer: function(feature, latlong) {
                                return L.circleMarker(
                                    latlong,
                                    layerObj.style
                                ).setRadius(layerObj.radius || 0)
                            },
                        }
                        break
                    case 'HiRISE':
                    case 'THEMIS':
                        leafletLayerObject = {
                            //Same style
                            style: layerObj.style,
                            //Different onEachFeature
                            onEachFeature: (function(layerObj) {
                                return function(feature, layer) {
                                    //Show Sol instead of first property
                                    layer.on('mouseover', function() {
                                        CursorInfo.update(
                                            'Path: ' + feature.properties.path,
                                            null,
                                            false
                                        )
                                    })
                                    layer.on('mouseout', function() {
                                        CursorInfo.hide()
                                    })
                                    //Add a click event to send the data to the info tab
                                    layer.on('click', function(e) {
                                        var features = leafletPip.pointInLayer(
                                            [e.latlng.lng, e.latlng.lat],
                                            L_.layersGroup[layerObj.name]
                                        )
                                        var variables = null
                                        if (
                                            layerObj.hasOwnProperty('variables')
                                        )
                                            variables = layerObj.variables
                                        Map_.activeLayer = layer
                                        Description.updatePoint(
                                            Map_.activeLayer
                                        )
                                        ToolController_.getTool('InfoTool').use(
                                            features,
                                            variables
                                        )

                                        //update url
                                        if (
                                            layer != null &&
                                            layer.hasOwnProperty('options')
                                        ) {
                                            var keyAsName
                                            if (
                                                layer.hasOwnProperty(
                                                    'useKeyAsName'
                                                )
                                            ) {
                                                keyAsName =
                                                    layer.feature.properties[
                                                        layer.useKeyAsName
                                                    ]
                                            } else {
                                                keyAsName =
                                                    layer.feature.properties[0]
                                            }
                                        }

                                        QueryURL.writeSearchURL(
                                            [keyAsName],
                                            layer.options.layerName
                                        )
                                    })
                                }
                            })(layerObj),
                        }
                        break
                }

                //If it's a drawing layer
                if (layerObj.name.toLowerCase().indexOf('draw') != -1) {
                    F_.sortGeoJSONFeatures(data)

                    leafletLayerObject = {
                        style: function(feature) {
                            return {
                                color: 'black',
                                radius: 6,
                                opacity: feature.properties.opacity,
                                fillColor: feature.properties.fill,
                                fillOpacity: feature.properties.fillOpacity,
                                color: feature.properties.stroke,
                                weight: feature.properties.weight,
                                className: 'spePolygonLayer',
                            }
                        },
                        pointToLayer: function(feature, latlng) {
                            return L.circleMarker(latlng)
                        },
                        /*
              style: function ( feature ) {
                  return {
                    color: "black",
                    opacity: 1,
                    weight: 2,
                    fillColor: feature.properties.fill,
                    fillOpacity: 0.3,
                    className: "spePolygonLayer"
                  };
              },*/
                        onEachFeature: function(feature, layer) {
                            var desc = feature.properties.description
                            if (desc) desc = desc.replace(/\n/g, '<br />')
                            var list =
                                '<dl><dt><b>' +
                                feature.properties.name +
                                '</b></dt><dt>' +
                                desc +
                                '</dt></dl>'
                            layer.bindPopup(list)
                        },
                    }
                }
                L_.layersGroup[layerObj.name] = L.geoJson(
                    data,
                    leafletLayerObject
                )

                d3.selectAll(
                    '.' + layerObj.name.replace(/\s/g, '').toLowerCase()
                ).data(data.features)
                L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
                allLayersLoaded()
            }).error(function(jqXHR, textStatus, errorThrown) {
                //Tell the console council about what happened
                console.warn(
                    'ERROR! ' +
                        textStatus +
                        ' in ' +
                        layerObj.url +
                        ' /// ' +
                        errorThrown
                )
                //Say that this layer was loaded, albeit erroneously
                L_.layersLoaded[L_.layersOrdered.indexOf(layerObj.name)] = true
                //Check again to see if all layers have loaded
                allLayersLoaded()
            })
        }

        function makeTileLayer() {
            var layerUrl = layerObj.url
            if (!F_.isUrlAbsolute(layerUrl))
                layerUrl = L_.missionPath + layerUrl
            var bb = null
            if (layerObj.hasOwnProperty('boundingBox')) {
                bb = L.latLngBounds(
                    L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
                    L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
                )
            }
            L_.layersGroup[layerObj.name] = L.tileLayer(layerUrl, {
                minZoom: layerObj.minZoom,
                maxZoom: layerObj.maxZoom,
                maxNativeZoom: layerObj.maxNativeZoom,
                tms: true,
                noWrap: true,
                continuousWorld: true,
                reuseTiles: true,
                bounds: bb,
            })

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
            enforceVisibilityCutoffs()
        }
    }

    //This would be better moved to Layers_
    function enforceVisibilityCutoffs() {
        var settingsEnforceVC = true //We don't have setting yet
        var layerElements
        var names = Object.keys(L_.layersNamed)
        var vc = 0
        for (var i = 0; i < names.length; i++) {
            layerElements = d3.selectAll(
                '.' + names[i].replace(/\s/g, '').toLowerCase()
            )
            if (
                L_.layersGroup[names[i]] != undefined &&
                Map_.map.hasLayer(L_.layersGroup[names[i]]) &&
                L_.layersNamed[names[i]].hasOwnProperty('visibilitycutoff')
            ) {
                vc = L_.layersNamed[names[i]].visibilitycutoff
                if (vc > 0) {
                    if (Map_.map.getZoom() < vc && settingsEnforceVC) {
                        layerElements.attr('display', 'none')
                    } else {
                        layerElements.attr('display', 'inherit')
                    }
                } else {
                    if (
                        Map_.map.getZoom() > Math.abs(vc) &&
                        settingsEnforceVC
                    ) {
                        layerElements.attr('display', 'none')
                    } else {
                        layerElements.attr('display', 'inherit')
                    }
                }
            }
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
                    if (props.images[i].type == 'photosphere') {
                        images.push({
                            url: url,
                            name:
                                props.images[i].url.match(/([^\/]*)\/*$/)[1] +
                                '[Panoramic]',
                            type: props.images[i].type || 'image',
                            isPanoramic: true,
                            isModel: false,
                            values: props.images[i].values || {},
                            master: props.images[i].master,
                        })
                    }
                    images.push({
                        url: url,
                        name: props.images[i].url.match(/([^\/]*)\/*$/)[1],
                        type: props.images[i].type || 'image',
                        isPanoramic: false,
                        isModel: false,
                        values: props.images[i].values || {},
                        master: props.images[i].master,
                    })
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
                    ( props[p].toLowerCase().match(/\.(obj)$/) != null || 
                      props[p].toLowerCase().match(/\.(dae)$/) != null 
                    )
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
            .attr('class', 'ui padded grid')
            .append('div')
            .attr('class', 'row childpointerevents')
            //.style( 'justify-content', 'flex-end' )
            .style('padding', '0px 9px 9px 0px')
        Map_.toolBar
            .append('div')
            .attr('id', 'scaleBarBounds')
            .attr('width', '270px')
            .attr('height', '48px')
            .append('svg')
            .attr('id', 'scaleBar')
            .attr('width', '270px')
            .attr('height', '48px')
    }

    return Map_
})
