define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'Globe_',
    'Map_',
    'Viewer_',
    'CursorInfo',
    'linechart',
    'metricsGraphics',
], function(
    $,
    d3,
    F_,
    L_,
    Globe_,
    Map_,
    Viewer_,
    CursorInfo,
    linechart,
    metricsGraphics
) {
    var toolLayer
    var toolLayerCurrent
    var measureToolLayer
    var clickedLatLngs
    var distLineToMouse
    var distLineToPoint
    var steps = 100
    var profileData
    var elevPoints
    var profileDivId = 'measureToolProfile'
    var rAm = 100 //roundAmount

    var MeasureTool = {
        height: 150,
        vars: {},
        lastData: [],
        init: function() {
            //this.vars = L_.getToolVars( 'measure' );
        },
        make: function() {
            toolLayer = []
            toolLayerCurrent = []
            measureToolLayer = null
            clickedLatLngs = []
            distLineToMouse = null
            distMousePoint = null
            profileData = []
            elevPoints = []

            //Get tool variables
            this.vars = L_.getToolVars('measure')

            var tools = d3.select('#tools')

            tools.selectAll('*').remove()
            tools = tools
                .append('div')
                .attr('class', 'ui padded grid')
                .style('padding', '5px')
                .style('overflow', 'hidden')
                .style('height', '100%')

            var buttonsDiv = tools
                .append('div')
                .attr('class', 'two wide column')
                .style('padding', '0px 7px 14px 7px')
                .style('text-align', 'center')
            var graphDiv = tools
                .append('div')
                .attr('class', 'fourteen wide column')
                .style('padding-top', '2px')
            buttonsDiv
                .append('div')
                .attr('id', 'measureToolNew')
                .attr('class', 'mmgisButton')
                .style('cursor', 'pointer')
                .style('width', '40%')
                .html('New')
            buttonsDiv
                .append('div')
                .attr('id', 'measureToolUndo')
                .attr('class', 'mmgisButton')
                .style('cursor', 'pointer')
                .style('width', '40%')
                .html('Undo')
            buttonsDiv
                .append('div')
                .style('width', '40%')
                .style('float', 'left')
                .html('Samples')
            buttonsDiv
                .append('input')
                .attr('id', 'measureToolSampleAmount')
                .attr('type', 'number')
                .attr('min', '2')
                .attr('step', '1')
                .attr('max', '500')
                .attr('value', '100')
                .style('width', '40%')
                .style('background', 'rgba(0, 0, 0, 0.25)')
                .style('border', 'none')
                .style('border-bottom', '1px solid rgba(255,255,255,0.25)')
                .style('text-align', 'right')
                .style('float', 'right')
                .style('margin-right', '15px')
                .style('padding', '0px 2px')
            buttonsDiv
                .append('div')
                .attr('id', 'measureToolDownload')
                .attr('class', 'mmgisButton')
                .style('cursor', 'pointer')
                .style('width', '61%')
                .html('Download')

            $('#measureToolSampleAmount').on('input', function(e) {
                steps = Math.min(parseInt(e.target.value), 500)
            })

            $('#measureToolDownload').on('click', downloadProfile)

            /*
      var mtRadio = buttonsDiv.append( 'div' )
        .attr( 'class', 'mmgisRadioBar measureTypeRadio' );
      mtRadio.append( 'div' ).attr( 'class', 'active' ).html( 'P' );
      mtRadio.append( 'div' ).html( 'L' );
      mtRadio.append( 'div' ).html( 'A' );
      $( '.mmgisRadioBar.measureTypeRadio div' ).click(function(){
        $( '.mmgisRadioBar.measureTypeRadio div' ).removeClass( 'active' );
        $(this).addClass( 'active' );
      });
      */

            graphDiv
                .append('div')
                .attr('id', profileDivId)
                .style('width', '100%')
                .style('height', '140px')

            d3.select('#' + profileDivId)
                .append('div')
                .style('text-align', 'center')
                .style('line-height', '140px')
                .style('font-size', '20px')
                .html('Click on the map!')

            Map_.map
                .on('click', measureOnClickMap)
                .on('mousemove', measureOnMoveMap)
                .on('mouseout', measureOnMouseOutMap)

            Globe_.globe
                .on('click', measureOnClickGlobe)
                .on('mousemove', measureOnMoveGlobe)

            Viewer_.imageViewerMap.addHandler(
                'canvas-click',
                measureOnClickViewer
            )
            Viewer_.imageViewer.style('cursor', 'default')

            d3.select('#measureToolNew').on('click', newDistanceTool)
            d3.select('#measureToolUndo').on('click', undoDistanceTool)

            d3.select('#map').style('cursor', 'default')
        },
        destroy: function() {
            Map_.map
                .off('click', measureOnClickMap)
                .off('mousemove', measureOnMoveMap)
                .off('mouseout', measureOnMouseOutMap)

            Globe_.globe
                .off('click', measureOnClickGlobe)
                .off('mousemove', measureOnMoveGlobe)

            Viewer_.imageViewerMap.removeHandler(
                'canvas-click',
                measureOnClickViewer
            )

            d3.select('#measureToolNew').on('click', null)
            d3.select('#measureToolUndo').on('click', null)
            d3.select('#map').style('cursor', 'grab')
            Viewer_.imageViewer.style('cursor', 'map')

            Map_.rmNotNull(distLineToMouse)
            Map_.rmNotNull(distMousePoint)
            Map_.rmNotNull(measureToolLayer)

            Globe_.removeVectorLayer('measure')
            Globe_.removeVectorLayer('measurePoint')

            CursorInfo.hide()
        },
    }

    function measureOnClickMap(e) {
        var xy = { x: e.latlng.lat, y: e.latlng.lng }

        clickedLatLngs.push(xy)
        makeMeasureToolLayer()
        makeProfile()
    }
    function measureOnMoveMap(e) {
        makeGhostLine(e.latlng.lng, e.latlng.lat)
    }
    function measureOnMouseOutMap(e) {
        if (distLineToMouse != null) {
            Map_.map.removeLayer(distLineToMouse)
            distLineToMouse = null
        }
        if (distMousePoint != null) {
            Map_.map.removeLayer(distMousePoint)
            distMousePoint = null
        }
        CursorInfo.hide()
    }

    function measureOnClickGlobe() {
        var xy = { x: Globe_.mouseLngLat.Lat, y: Globe_.mouseLngLat.Lng }
        clickedLatLngs.push(xy)
        makeMeasureToolLayer()
        makeProfile()
    }
    function measureOnMoveGlobe() {
        if (Globe_.mouseLngLat.Lng != null && Globe_.mouseLngLat.Lat != null) {
            makeGhostLine(Globe_.mouseLngLat.Lng, Globe_.mouseLngLat.Lat)
        }
    }

    function measureOnClickViewer(e) {
        // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
        var viewportPoint = Viewer_.imageViewerMap.viewport.pointFromPixel(
            e.position
        )
        // Convert from viewport coordinates to image coordinates.
        var xy = Viewer_.imageViewerMap.viewport.viewportToImageCoordinates(
            viewportPoint
        )
        xy.x = parseInt(xy.x)
        xy.y = parseInt(xy.y)
        makeBandProfile(xy)
    }

    function makeMeasureToolLayer() {
        Map_.rmNotNull(measureToolLayer)

        var pointsAndPathArr = []
        var polylinePoints = []
        var temp
        for (var i = 0; i < clickedLatLngs.length; i++) {
            temp = new L.circleMarker([
                clickedLatLngs[i].x,
                clickedLatLngs[i].y,
            ]).setRadius(3)
            if (i > 0) {
                var roundedDist =
                    Math.round(
                        F_.lngLatDistBetween(
                            clickedLatLngs[i].y,
                            clickedLatLngs[i].x,
                            clickedLatLngs[i - 1].y,
                            clickedLatLngs[i - 1].x
                        ) * rAm
                    ) / rAm
                if (F_.dam)
                    roundedDist =
                        Math.round(
                            F_.distanceFormula(
                                clickedLatLngs[i].y,
                                clickedLatLngs[i].x,
                                clickedLatLngs[i - 1].y,
                                clickedLatLngs[i - 1].x
                            ) * rAm
                        ) / rAm
                var roundedTotalDist =
                    Math.round(totalDistToIndex(i + 1) * rAm) / rAm
                var distAzimuth =
                    Math.round(
                        ((Math.atan2(
                            clickedLatLngs[i].y - clickedLatLngs[0].y,
                            clickedLatLngs[i].x - clickedLatLngs[0].x
                        ) *
                            180) /
                            Math.PI) *
                            rAm
                    ) / rAm
                if (distAzimuth < 0) distAzimuth = 360 + distAzimuth //Map to 0 to 360 degrees
                if (i == clickedLatLngs.length - 1) {
                    temp.bindTooltip(
                        '' + roundedTotalDist + 'm ' + distAzimuth + '&deg;',
                        {
                            permanent: true,
                            direction: 'right',
                            className: 'distLabel',
                            offset: [4, 0],
                        }
                    )
                }
            }
            pointsAndPathArr.push(temp)
            polylinePoints.push(
                new L.LatLng(clickedLatLngs[i].x, clickedLatLngs[i].y)
            )
        }
        pointsAndPathArr.push(new L.Polyline(polylinePoints, { color: 'red' }))
        measureToolLayer = L.featureGroup(pointsAndPathArr).addTo(Map_.map)
    }
    function makeProfile() {
        var numOfPts = clickedLatLngs.length
        if (numOfPts > 1 && MeasureTool.vars.dem) {
            var pathDEM = 'Missions/' + L_.mission + '/' + MeasureTool.vars.dem
            //elevPoints.push([{"x": clickedLatLngs[numOfPts - 2].x, "y": clickedLatLngs[numOfPts - 2].y}, {"x": clickedLatLngs[numOfPts - 1].x, "y": clickedLatLngs[numOfPts - 1].y}]);
            elevPoints = [
                {
                    x: clickedLatLngs[numOfPts - 2].x,
                    y: clickedLatLngs[numOfPts - 2].y,
                },
                {
                    x: clickedLatLngs[numOfPts - 1].x,
                    y: clickedLatLngs[numOfPts - 1].y,
                },
            ]
            var ePLast = elevPoints.length - 1
            linechart.loadingElevationChart(profileDivId)

            var axes = 'z'
            if (
                MeasureTool.vars.hasOwnProperty('axes') &&
                MeasureTool.vars.axes.toLowerCase() == 'xyz'
            ) {
                axes = 'xyz'
            }

            $.ajax({
                type: calls.getprofile.type,
                url: calls.getprofile.url,
                data: {
                    type: '2pts',
                    lat1: elevPoints[0].x,
                    lon1: elevPoints[0].y,
                    lat2: elevPoints[1].x,
                    lon2: elevPoints[1].y,
                    steps: steps,
                    path: calls.getprofile.pathprefix + pathDEM,
                    axes: axes,
                },
                success: function(data) {
                    d3.select('#' + profileDivId)
                        .selectAll('*')
                        .remove()
                    if (data.length < 3) {
                        console.warn(
                            'Warning: MeasureTool: No elevation data found in ' +
                                pathDEM
                        )
                        return
                    }
                    data = JSON.parse($.parseJSON(data))

                    MeasureTool.lastData = F_.clone(data)
                    var distance = 0
                    if (MeasureTool.lastData.length >= 2) {
                        distance = F_.lngLatDistBetween(
                            MeasureTool.lastData[0][0],
                            MeasureTool.lastData[0][1],
                            MeasureTool.lastData[1][0],
                            MeasureTool.lastData[1][1]
                        )
                        if (F_.dam) distance = F_.metersToDegrees(distance)
                    }

                    for (var i = 0; i < MeasureTool.lastData.length; i++)
                        MeasureTool.lastData[i].splice(2, 0, i * distance)

                    profileData = []
                    for (var i = 0; i < data.length; i++) {
                        profileData.push(data[i][2])
                    }
                    //profileData = profileData.concat(data);
                    //var latestDistPerStep = latLongDistBetween(elevPoints[0].y, elevPoints[0].x, elevPoints[1].y, elevPoints[1].x) / steps;
                    var usedData = profileData
                    //if(profileMode == "slope") {
                    //  usedData = elevsToSlope
                    var multiplyElev = MeasureTool.vars.multiplyelev || 1
                    linechart.makeElevationChart(
                        profileDivId,
                        usedData,
                        clickedLatLngs.length - 1,
                        elevPoints,
                        'map',
                        multiplyElev,
                        data
                    )
                    Globe_.addVectorLayer(
                        {
                            name: 'measure',
                            id: 'measure',
                            on: true,
                            geometry: { type: 'linestring', coordinates: data },
                            style: { color: '#F00' },
                        },
                        1
                    )
                    Globe_.removeVectorLayer('measurePoint')
                    //getCorrectedProfileData();
                    //isComplete = true;
                },
            })
        }
    }
    function makeBandProfile(xy) {
        linechart.loadingElevationChart(profileDivId)
        $.ajax({
            type: calls.getbands.type,
            url: calls.getbands.url,
            data: {
                type: 'band',
                path: Viewer_.masterImg,
                x: xy.x,
                y: xy.y,
                xyorll: 'xy',
                bands: '[[1,489]]',
            },
            success: function(data) {
                d3.select('#' + profileDivId)
                    .selectAll('*')
                    .remove()
                //Convert python's Nones to nulls
                data = data.replace(/none/gi, 'null')
                try {
                    data = JSON.parse($.parseJSON(data))
                } catch (e) {
                    console.warn('Failed to query image: ' + Viewer_.masterImg)
                    return
                }
                var newData = []
                for (var i = 0; i < data.length; i++) {
                    newData.push({ Wavelength: data[i][0], Value: data[i][1] })
                }
                metricsGraphics.data_graphic({
                    chart_type: 'line',
                    data: newData,
                    area: false,
                    missing_is_hidden: true,
                    interpolate: d3.curveLinearClosed,
                    full_height: true,
                    full_width: true,
                    left: 95,
                    right: 30,
                    top: 20,
                    target: document.getElementById(profileDivId),
                    x_label: 'Wavelength',
                    xax_format: function(d) {
                        return d + ' nm'
                    },
                    y_label: 'I/F',
                    x_accessor: 'Wavelength',
                    y_accessor: 'Value',
                })
                //ugly hack to reopen chart path
                $('.mg-main-line').each(function(idx) {
                    var path = $(this).attr('d')
                    if (path != null) {
                        path = path.replace(/z/gi, '')
                        $(this).attr('d', path)
                    }
                })
            },
        })
    }

    function makeGhostLine(lng, lat) {
        if (clickedLatLngs.length > 0) {
            if (distLineToMouse != null) {
                Map_.map.removeLayer(distLineToMouse)
                distLineToMouse = null
            }
            if (distMousePoint != null) {
                Map_.map.removeLayer(distMousePoint)
                distMousePoint = null
            }

            var i1 = clickedLatLngs.length - 1
            var endDC = clickedLatLngs[i1]

            //console.log(clickedLatLngs[i1].x + " " + clickedLatLngs[i1].y + " " + e.latlng.lat + " " + e.latlng.lng);
            var distAzimuth =
                Math.round(
                    ((Math.atan2(
                        lng - clickedLatLngs[0].y,
                        lat - clickedLatLngs[0].x
                    ) *
                        180) /
                        Math.PI) *
                        rAm
                ) / rAm
            if (distAzimuth < 0) distAzimuth = 360 + distAzimuth //Map to 0 to 360 degrees
            var roundedDist =
                Math.round(
                    F_.lngLatDistBetween(
                        clickedLatLngs[i1].y,
                        clickedLatLngs[i1].x,
                        lng,
                        lat
                    ) * rAm
                ) / rAm
            if (F_.dam)
                roundedDist =
                    Math.round(
                        F_.distanceFormula(
                            clickedLatLngs[i1].y,
                            clickedLatLngs[i1].x,
                            lng,
                            lat
                        ) * rAm
                    ) / rAm
            //using actual latlng as meters:
            //var roundedDist = Math.round(Math.sqrt(Math.pow(clickedLatLngs[i1].x - e.latlng.lat, 2) + Math.pow(clickedLatLngs[i1].y - e.latlng.lng, 2)) * 10)/10;
            var roundedTotalDist =
                Math.round(
                    (totalDistToIndex(clickedLatLngs.length) + roundedDist) *
                        rAm
                ) / rAm
            distLineToMouse = new L.Polyline(
                [new L.LatLng(endDC['x'], endDC['y']), { lat: lat, lng: lng }],
                {
                    className: 'noPointerEvents',
                    color: 'white',
                    dashArray: '3, 15',
                }
            ).addTo(Map_.map)
            distMousePoint = new L.circleMarker(
                { lat: lat, lng: lng },
                { className: 'noPointerEvents', color: 'red' }
            ).setRadius(3)
            //distMousePoint.bindTooltip("" + roundedTotalDist + "m\n (+" + roundedDist + "m) " + distAzimuth + "&deg;",
            //  {permanent: true, direction: 'right', className: "distLabel", className: "noPointerEvents", offset: [15,-15]})
            //distMousePoint.addTo(Map_.map);
            CursorInfo.update(
                '' +
                    roundedTotalDist +
                    'm\n (+' +
                    roundedDist +
                    'm) ' +
                    distAzimuth +
                    '&deg;',
                null,
                false
            )
        }
    }
    function undoDistanceTool() {
        clickedLatLngs.pop()
        if (profileData.length - steps >= 0)
            profileData = profileData.slice(0, profileData.length - steps)
        //0 -> 0, 1 -> 0, 2 -> 1, 3 -> 2, 4 -> 3
        try {
            linechart.loadingElevationChart(profileDivId)
            linechart.makeElevationChart(
                profileDivId,
                profileData,
                clickedLatLngs.length - 1,
                elevPoints,
                'map'
            )
        } catch (e) {}

        makeMeasureToolLayer()
        Globe_.removeVectorLayer('measure')
        Globe_.removeVectorLayer('measurePoint')
    }
    function newDistanceTool() {
        clickedLatLngs = []
        profileData = []

        Map_.rmNotNull(distLineToMouse)
        Map_.rmNotNull(distMousePoint)
        Map_.rmNotNull(measureToolLayer)
        Globe_.removeVectorLayer('measure')
        Globe_.removeVectorLayer('measurePoint')

        d3.select('#' + profileDivId)
            .selectAll('*')
            .remove()
        d3.select('#' + profileDivId)
            .append('div')
            .style('text-align', 'center')
            .style('line-height', '140px')
            .style('font-size', '20px')
            .html('Click on the map!')
    }

    function getCorrectedProfileData() {
        var pts = elevPoints
        var overheadLength = 0
        var segmentLengths = [] //summed

        //calculate total and segment lengths
        for (var i = 0; i < pts.length; i++) {
            segmentLengths[i] = overheadLength
            overheadLength += latLongDistBetween(
                pts[i][0].y,
                pts[i][0].x,
                pts[i][1].y,
                pts[i][1].x
            )
        }
        segmentLengths[segmentLengths.length] = overheadLength

        var newProfileData = []
        var distStep = overheadLength / steps
        var cur, scaleLat, scaleLng
        for (var i = 0; i < lineSteps; i++) {
            cur = i * distStep
            for (var j = 0; j < segmentLengths.length - 1; j++) {
                if (cur >= segmentLengths[j] && cur < segmentLengths[j + 1]) {
                    scaleLat = d3.scale
                        .linear()
                        .domain([segmentLengths[j], segmentLengths[j + 1]])
                        .range([pts[j][0].x, pts[j][1].x])
                    scaleLng = d3.scale
                        .linear()
                        .domain([segmentLengths[j], segmentLengths[j + 1]])
                        .range([pts[j][0].y, pts[j][1].y])
                    //newProfileData.push({"x": scaleLat(cur), "y": scaleLng(cur), "value": });
                }
            }
        }
    }

    function totalDistToIndex(l) {
        var totalDistance = 0
        for (var i = 1; i < l; i++) {
            //Sum up segement distance
            if (F_.dam) {
                totalDistance += F_.distanceFormula(
                    clickedLatLngs[i].y,
                    clickedLatLngs[i].x,
                    clickedLatLngs[i - 1].y,
                    clickedLatLngs[i - 1].x
                )
            } else {
                totalDistance += F_.lngLatDistBetween(
                    clickedLatLngs[i].y,
                    clickedLatLngs[i].x,
                    clickedLatLngs[i - 1].y,
                    clickedLatLngs[i - 1].x
                )
            }
            //using actual latlng as meters:
            //totalDistance += Math.sqrt(Math.pow(clickedLatLngs[i].x - clickedLatLngs[i-1].x, 2) + Math.pow(clickedLatLngs[i].y - clickedLatLngs[i-1].y, 2));
        }
        return totalDistance
    }
    function downloadProfile(e) {
        F_.downloadArrayAsCSV(
            ['X', 'Y', 'D', 'Z'],
            MeasureTool.lastData,
            'profiledata'
        )
    }
    MeasureTool.init()

    return MeasureTool
})
