// A query Tool that communicates with a PostGIS data on the back-end. By this
// tool users are enable to query over geographical database and narrow down their
// exploration on this type of datasets.

// In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import turf from 'turf'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div style='position: absolute; width: 100%;'>",
      "<div style='margin: 3px; text-align: left; border-bottom-style: solid; border-bottom-color: #b36b00; border-bottom-width: 1px;'>",
        "The Query Tool",
      "</div>",
      "<div style='display: flex; margin: 1px; text-align: left; border-bottom-style: solid; border-bottom-color: #b36b00; border-bottom-width: 1px;'>",
        "<div id='queryToolInstList_LeftArrow' class='mmgisButton' style='margin: -1px 0 1px 1px;'><i class='mdi mdi-chevron-left mdi-24px'></i></div>",
        "<div id='queryToolInstList' class='mmgisRadioBar3' style='display: flex; overflow: hidden; width: 100%'>","</div>",
        "<div id='queryToolInstList_RightArrow' class='mmgisButton' style='margin: -1px 2px 1px 0;'><i class='mdi mdi-chevron-right mdi-24px'></i></div>",
      "</div>",

      "<div id='material_list' style='display: flex; margin: 1px; text-align: left;'>",
        "<div id='queryToolMatList_LeftArrow' class='mmgisButton' style='margin: -1px 0 1px 1px;'><i class='mdi mdi-chevron-left mdi-24px'></i></div>",
        "<div id='queryToolMatList' class='mmgisRadioBar3' style='display: flex; overflow: hidden; width: 100%'>","</div>",
        "<div id='queryToolMatList_RightArrow' class='mmgisButton' style='margin: -1px 2px 1px 0;'><i class='mdi mdi-chevron-right mdi-24px'></i></div>",
      "</div>",
      "<div class='mmgisScrollbar'id='queryToolMatInfo' style='border-style: solid; border-color: #b36b00; border-width: 1px; height: 200px; width: 100%; overflow: auto;'></div>",
      "<div class='mmgisHoverContents' style='padding: 9px; border-style: solid; border-color: #b36b00; border-width: 1px; display: inline-flex; height: 50px; width: 100%; color: #777; justify-content: space-around; margin: 5px 0px 5px 0px;'>",
        "<div id='queryTool_seeData' class='mmgisButton' style='height: 30px; margin: 0px 2px 1px 0;' title='See result'> <a href='#' id='queryTool_GeoJson_result_link'> See Result </a> </div>",
        "<div id='queryTool_saveQuery'></div>",
        "<div id='queryTool_loadQuery'></div>",
        "<div id='queryTool_runQuery' class='mmgisButton' style='height: 30px; margin: 0px -1px 1px 0;' title='Run query'><i class='mdi mdi-step-forward mdi-24px'></i></div>",
      "</div>",
    "</div>"
  ].join('\n');

let QueryTool = {
    height: 350,
    width: 600,
    widths: [600, 1150],
    MMGISInterface: null,
    material: { name: '', lower_bound: 0, upper_bound: 0 },
    drawnLayers: {},
    inputs: {},
    settings: {},
    make: function (TC_) {
        this.T_ = TC_
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },

    Draw: {
        everyNCounter: 0, // Counts mousemove
        everyN: 5, // Every n mousemoves draw
        drawing: true, // Set to true after first click on map, and false on last click when drawing
        drawingType: 'none', // Type of drawing, point, line and polygon
        drawingPolyPoints: '', // Temp str for storing stringed lat lngs
        drawingPoly: undefined, // The leaflet layer for the drawing
        speColor: '#619', // Color
        firstDrawing: true,
        speDesc: '',
        speName: '',
        _initialPoint: {},
        _radiusPoints: [], // Circle center point
        lastDivParent: null,
        sec: null,
        startClick: function (e) {
            // Notify the user to click on the drawing icon
            if (QueryTool.Draw.drawingType === 'none') {
                CursorInfo.update('Click on drawing icon!', 3000, true)
            }

            // Get the center point of the circle
            QueryTool._initialPoint = e.latlng
            QueryTool.Draw._radiusPoints = []

            // If drawing type is circle buffer
            if (QueryTool.Draw.drawingType === 'point') {
                QueryTool.Draw._radiusPoints.push(e.latlng)
            }

            Map_.map.off('click', QueryTool.Draw.startClick)
            Map_.map.on('click', QueryTool.Draw.endClick)
            let inputID = QueryTool.Draw.lastDivParent.attr('id') + '-input'
            Map_.map.on('mousemove', function (e) {
                QueryTool.Draw.doDrawing(e, inputID)
            })

            QueryTool.Draw.drawing = true

            d3.select('#map').style('cursor', 'crosshair')

            if (!QueryTool.Draw.drawing) {
                Map_.rmNotNull(QueryTool.Draw.thisDrawing)
            }
        },

        endClick: function (e) {
            Map_.map.on('click', QueryTool.Draw.startClick)

            Map_.map.off('mousemove', QueryTool.Draw.doDrawing)

            QueryTool.Draw.drawing = false
            QueryTool.Draw.firstDrawing = true

            // Store the selected area in the QueryTool.Draw._radiusPoints object
            if (QueryTool.Draw.drawingType === 'point') {
                QueryTool.Draw._radiusPoints.push(e.latlng)
            }

            if (
                QueryTool.Draw.drawingType === 'line' ||
                QueryTool.Draw.drawingType === 'polygon' ||
                QueryTool.Draw.drawingType === 'rectangle'
            ) {
                QueryTool.drawnLayers[
                    QueryTool.Draw.sec[QueryTool.Draw.sec.length - 4]
                ] = QueryTool.Draw.drawingPoly._latlngs
            }

            d3.select('#map').style('cursor', '')
        },

        // This funcrion is called from draw polygon section.
        // The functionality of this function is not still completed.
        // ToDo: needs to be implemented the wat that can work properly
        // for drawing line, rectangle or there is a need for drawing
        // a circle.(it is not part of this code yet.)

        doDrawing: function (e, id, radius) {
            let thisDrawing = QueryTool.Draw

            if (
                thisDrawing.everyNCounter === thisDrawing.everyN ||
                radius != null
            ) {
                // If the drawing mode is true, start drawing
                if (thisDrawing.drawing) {
                    // console.log( 'Drawing type is: ', thisDrawing.drawingType );
                    // Initialize the array with starting point
                    if (thisDrawing.firstDrawing)
                        thisDrawing.drawingPolyPoints =
                            e.latlng.lat + ',' + e.latlng.lng
                    thisDrawing.firstDrawing = false

                    if (thisDrawing.drawingType === 'point') {
                        Map_.rmNotNull(L_.layers.layer['QueryToolPointBuffer'])

                        if (radius == null) {
                            radius = F_.lngLatDistBetween(
                                e.latlng.lng,
                                e.latlng.lat,
                                QueryTool._initialPoint.lng,
                                QueryTool._initialPoint.lat
                            )
                            $('#' + id).val(radius.toFixed(3))
                        }

                        radius *= F_.getEarthToPlanetRatio()

                        thisDrawing.drawingPoly = L_.layers.layer[
                            'QueryToolPointBuffer'
                        ] = L.geoJson(
                            {
                                type: 'FeatureCollection',
                                features: [
                                    turf.circle(
                                        [
                                            QueryTool._initialPoint.lng,
                                            QueryTool._initialPoint.lat,
                                        ],
                                        radius,
                                        { steps: 128, units: 'meters' }
                                    ),
                                    {
                                        type: 'Feature',
                                        properties: {},
                                        geometry: {
                                            type: 'Point',
                                            coordinates: [
                                                QueryTool._initialPoint.lng,
                                                QueryTool._initialPoint.lat,
                                            ],
                                        },
                                    },
                                ],
                            },
                            {
                                style: function (feature) {
                                    return {
                                        fillColor: thisDrawing.speColor,
                                        opacity: 1,
                                        fillOpacity: 0.3,
                                        color: 'blue',
                                        weight: 2,
                                        smoothFactor: 0,
                                        className: 'noPointerEvents',
                                    }
                                },
                                pointToLayer: function (feature, latlong) {
                                    return L.circleMarker(latlong).setRadius(1)
                                },
                            }
                        ).addTo(Map_.map)
                    } else if (thisDrawing.drawingType === 'line') {
                        thisDrawing.drawingPolyPoints +=
                            ' ' + e.latlng.lat + ',' + e.latlng.lng
                        if (thisDrawing.drawingPoly !== undefined) {
                            Map_.map.removeLayer(thisDrawing.drawingPoly)
                            thisDrawing.drawingPoly = null
                        }

                        thisDrawing.drawingPoly = new L.polyline(
                            QueryTool.pointStrToArr(
                                thisDrawing.drawingPolyPoints,
                                false,
                                true,
                                'line'
                            ),
                            {
                                opacity: 1,
                                color: thisDrawing.speColor,
                                weight: 3,
                                smoothFactor: 0,
                                className: 'noPointerEvents',
                            }
                        ).addTo(Map_.map)
                    } else if (thisDrawing.drawingType === 'rectangle') {
                        thisDrawing.drawingPolyPoints +=
                            ' ' + e.latlng.lat + ',' + e.latlng.lng

                        if (thisDrawing.drawingPoly !== undefined) {
                            Map_.map.removeLayer(thisDrawing.drawingPoly)
                            thisDrawing.drawingPoly = null
                        }

                        thisDrawing.drawingPoly = new L.rectangle(
                            QueryTool.pointStrToArr(
                                thisDrawing.drawingPolyPoints,
                                false,
                                true,
                                'rectangle'
                            ),
                            {
                                fillColor: thisDrawing.speColor,
                                opacity: 1,
                                fillOpacity: 0.3,
                                color: 'blue',
                                weight: 2,
                                smoothFactor: 0,
                                className: 'noPointerEvents',
                            }
                        ).addTo(Map_.map)
                    } else if (thisDrawing.drawingType === 'polygon') {
                        thisDrawing.drawingPolyPoints +=
                            ' ' + e.latlng.lat + ',' + e.latlng.lng

                        if (thisDrawing.drawingPoly !== undefined) {
                            Map_.map.removeLayer(thisDrawing.drawingPoly)
                            thisDrawing.drawingPoly = null
                        }

                        thisDrawing.drawingPoly = new L.polygon(
                            QueryTool.pointStrToArr(
                                thisDrawing.drawingPolyPoints,
                                true,
                                true,
                                'polygon'
                            ),
                            {
                                fillColor: thisDrawing.speColor,
                                opacity: 1,
                                fillOpacity: 0.3,
                                color: 'blue',
                                weight: 2,
                                smoothFactor: 0,
                                className: 'noPointerEvents',
                            }
                        ).addTo(Map_.map)
                    }
                }
                thisDrawing.everyNCounter = 0
            }
            thisDrawing.everyNCounter++
        },
    },

    pointStrToArr: function (pointStr, close, latlng, shapeType) {
        let pointArr = []
        let pointStrArrComma, firstCoordinates, lastCoordinates

        let pointStrArr = pointStr.split(' ')

        if (shapeType === 'rectangle') {
            firstCoordinates = pointStrArr[0].split(',')
            lastCoordinates = pointStrArr[pointStrArr.length - 1].split(',')

            if (latlng) {
                pointArr.push([
                    parseFloat(firstCoordinates[0]),
                    parseFloat(firstCoordinates[1]),
                ])
                pointArr.push([
                    parseFloat(lastCoordinates[0]),
                    parseFloat(lastCoordinates[1]),
                ])
            } else {
                pointArr.push([
                    parseFloat(firstCoordinates[1]),
                    parseFloat(firstCoordinates[0]),
                ])
                pointArr.push([
                    parseFloat(lastCoordinates[1]),
                    parseFloat(lastCoordinates[0]),
                ])
            }
        } else {
            for (let i = 0; i < pointStrArr.length; i++) {
                pointStrArrComma = pointStrArr[i].split(',')
                if (latlng)
                    pointArr.push([
                        parseFloat(pointStrArrComma[0]),
                        parseFloat(pointStrArrComma[1]),
                    ])
                else
                    pointArr.push([
                        parseFloat(pointStrArrComma[1]),
                        parseFloat(pointStrArrComma[0]),
                    ])
            }
        }
        if (close) pointArr.push(pointArr[0]) //close the polygon
        return pointArr
    },

    singlePointStrToArr: function (pointStr) {
        var pointStrArrComma = pointStr.split(',')
        return [
            parseFloat(pointStrArrComma[1]),
            parseFloat(pointStrArrComma[0]),
        ]
    },
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    //MMGIS should always have a div with id 'tools'
    var tools = d3.select('#tools')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools
        .append('div')
        .attr('class', 'center aligned ui padded grid')
        .style('height', '100%')
    //Add the markup to tools or do it manually
    tools.html(markup)

    //Add event functions and whatnot
    $('#queryTool_GeoJson_result_link').on('click', function () {
        // Open a new window and load the final result
        w = window.open()
        w.document.write(JSON.stringify(QueryTool.finalResult))
    })

    // Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}

    var decodedCookie = decodeURIComponent(document.cookie)
    var cookies = decodedCookie.split(';')
    var userData = cookies[0].split('=')
    userData = JSON.parse(userData[1])

    let userId = userData.id
    let token = userData.tkn

    // This baseURL can be change to actual miplmmgis server address
    let baseURL = 'http://localhost:3000/apis/'

    if (userId && token) {
        /**
         * The following is the implementation of Ajax GET request to fetch
         * all the instruments that we have in the database. The following
         * URL is the API address for having that list.
         */

        let selected_mat_id = -1
        let inst = undefined
        let selectedItem = undefined
        let itemType = undefined
        let params = undefined

        $.ajax({
            url: baseURL + 'instList',
            crossOrigin: true,
            type: 'GET',
            xhrFields: { withCredentials: false },
            accept: 'application/json',
            dataType: 'json',
            success: function (data) {
                if (data.length > 0) {
                    // Now need to make the instruments list
                    for (d in data) {
                        // Creating instrument div section by appending to the parent div section
                        d3.select('#queryToolInstList')
                            .append('div')
                            .attr('id', 'queryToolInstList_' + d)
                            .attr('class', d == 0 ? 'active' : '')
                            .style('margin', '-1px 0 1px 0')
                            .text(data[d].inst_type)
                    }
                    $('.mmgisRadioBar3#queryToolInstList div').click(
                        function () {
                            $(
                                '.mmgisRadioBar3#queryToolInstList div'
                            ).removeClass('active')
                            $(this).addClass('active')
                        }
                    )

                    $('#queryToolInstList div').click(function () {
                        // Clean up the lists after fetching for new data
                        $('#material_list #queryToolMatList *').remove()

                        inst = $(this).text()

                        // Ajax call to get the materials list for a particular instrument
                        $.ajax({
                            url: baseURL + 'inst=' + inst.toLowerCase(),
                            crossOrigin: true,
                            type: 'GET',
                            xhrFields: { withCredentials: false },
                            accept: 'application/json',
                            dataType: 'json',
                            success: function (data) {
                                params = data
                                // If the data is available then make the list
                                if (data.length > 0) {
                                    // Append Geom button to the beginning of the list
                                    d3.select('#queryToolMatList')
                                        .append('div')
                                        .attr(
                                            'id',
                                            'queryToolMats-' +
                                                inst.toLowerCase() +
                                                '-geom'
                                        )
                                        .style('margin', '-1px 0 1px 0')
                                        .text('Geom')

                                    for (d in data) {
                                        d3.select('#queryToolMatList')
                                            .append('div')
                                            .attr(
                                                'id',
                                                'queryToolMats-' +
                                                    inst.toLowerCase() +
                                                    '-' +
                                                    data[d].column_name
                                            )
                                            .attr(
                                                'class',
                                                d == 1 ? 'active' : ''
                                            )
                                            .style('margin', '-1px 0 1px 0')
                                            .text(data[d].column_name)
                                    }
                                }

                                $('.mmgisRadioBar3#queryToolMatList div').click(
                                    function () {
                                        $(
                                            '.mmgisRadioBar3#queryToolMatList div'
                                        ).removeClass('active')
                                        $(this).addClass('active')

                                        selectedItem = $(this).text()
                                        selected_mat_id += 1

                                        // Create the geometry operators component
                                        if (selectedItem === 'Geom') {
                                            $('#loadedQueries').remove()

                                            // Set the item type
                                            itemType = 'g'
                                            // Create geom component for each material
                                            d3.select('#queryToolMatInfo')
                                                .append('div')
                                                .attr(
                                                    'id',
                                                    inst.toLowerCase() +
                                                        '-' +
                                                        selectedItem.toLowerCase() +
                                                        '-' +
                                                        itemType +
                                                        '-' +
                                                        selected_mat_id
                                                )
                                                .style('display', 'flex')
                                                .style('border-style', 'solid')
                                                .style(
                                                    'border-color',
                                                    '#0c3534'
                                                )
                                                .style('border-width', '1px')
                                                .style('height', '55px')
                                                .style('width', '100%')
                                                .style(
                                                    'background-color',
                                                    '#030215'
                                                )

                                            // Create geom component for each material
                                            createGeometryComponent(
                                                inst.toLowerCase(),
                                                selectedItem.toLowerCase(),
                                                itemType,
                                                selected_mat_id
                                            )
                                        } else {
                                            // Run another ajax to get informantion about this material and append it to the list
                                            let matURL =
                                                baseURL +
                                                'inst=' +
                                                inst.toLowerCase() +
                                                '/data_min_avg_max&mat=' +
                                                selectedItem

                                            $.ajax({
                                                url: matURL,
                                                crossOrigin: true,
                                                type: 'GET',
                                                xhrFields: {
                                                    withCredentials: false,
                                                },
                                                accept: 'application/json',
                                                dataType: 'json',
                                                success: function (result) {
                                                    // Check whether the data "d" is numerical type
                                                    if (
                                                        typeof result.data[0][
                                                            selectedItem
                                                        ] === 'number'
                                                    ) {
                                                        $(
                                                            '#loadedQueries'
                                                        ).remove()

                                                        // Set the item type
                                                        itemType = 'n'

                                                        // Set width and height values for SVG component
                                                        let w = 340,
                                                            h = 30

                                                        // Get the desired numerical data from bins
                                                        let data = result.bins
                                                        let dataset = []

                                                        let maxValue =
                                                                result.max,
                                                            minValue =
                                                                result.min,
                                                            median =
                                                                result.median,
                                                            avgerage =
                                                                result.avg

                                                        // Find the minimum and maximum of the values
                                                        let max = data.reduce(
                                                            function (a, b) {
                                                                return Math.max(
                                                                    a,
                                                                    b
                                                                )
                                                            }
                                                        )

                                                        let min = data.reduce(
                                                            function (a, b) {
                                                                return Math.min(
                                                                    a,
                                                                    b
                                                                )
                                                            }
                                                        )

                                                        let medianIndex =
                                                            result.medIndx

                                                        for (
                                                            let i = 0;
                                                            i < data.length;
                                                            i++
                                                        ) {
                                                            dataset.push({
                                                                x: i,
                                                                y:
                                                                    (parseFloat(
                                                                        data[i]
                                                                    ) -
                                                                        min) /
                                                                    (max - min),
                                                            })
                                                        }

                                                        // Create information component for each selected item/material
                                                        d3.select(
                                                            '#queryToolMatInfo'
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'display',
                                                                'flex'
                                                            )
                                                            .style(
                                                                'border-style',
                                                                'solid'
                                                            )
                                                            .style(
                                                                'border-color',
                                                                '#0c3534'
                                                            )
                                                            .style(
                                                                'border-width',
                                                                '1px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '55px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '100%'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#030215'
                                                            )

                                                        // Addind the name of used instrument to the component
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'inst-name-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'width',
                                                                '50px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '20px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '16px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-12px'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '12px'
                                                            )
                                                            .style(
                                                                'text-align',
                                                                'center'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#5a4402'
                                                            )
                                                            .style(
                                                                'transform',
                                                                'rotate(-90deg)'
                                                            )
                                                            .text(
                                                                inst.toUpperCase()
                                                            )

                                                        // Adding name of the selected item/material
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'mat-name-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .attr(
                                                                'title',
                                                                selectedItem
                                                            )
                                                            .style(
                                                                'width',
                                                                '65px'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '12px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '5px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-12px'
                                                            )
                                                            .style(
                                                                'text-overflow',
                                                                'ellipsis'
                                                            )
                                                            .style(
                                                                'white-space',
                                                                'nowrap'
                                                            )
                                                            .style(
                                                                'overflow-x',
                                                                'hidden'
                                                            )
                                                            .text(selectedItem)

                                                        // Adding input sections for min value for left side of slider
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'mat-stats-min-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'width',
                                                                '25px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '36px'
                                                            )
                                                            .append('input')
                                                            .attr(
                                                                'id',
                                                                'mat-stats-min-input-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .attr(
                                                                'type',
                                                                'text'
                                                            )
                                                            .attr(
                                                                'value',
                                                                minValue
                                                            )
                                                            .attr(
                                                                'title',
                                                                'minimum value'
                                                            )
                                                            .style(
                                                                'width',
                                                                '110%'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#030215'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'border',
                                                                'none'
                                                            )

                                                        // Create div section for graph and sliders
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'mat-stats-info-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'height',
                                                                '60px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '340px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-30px'
                                                            )

                                                        // Create div section for sliders =======================================================
                                                        d3.select(
                                                            '#mat-stats-info-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'sliders-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'position',
                                                                'relative'
                                                            )
                                                            .style(
                                                                'top',
                                                                '25px'
                                                            )

                                                        // Setting up two thumbs slider
                                                        $(
                                                            '#sliders-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        ).slider({
                                                            animate: 'fast',
                                                            range: true,
                                                            min: minValue,
                                                            max: maxValue,
                                                            steps: 0.001, // Have more smooth sliding and get the digits after point
                                                            values: [
                                                                minValue / 1000,
                                                                maxValue * 1000,
                                                            ], // Force the slider thumbs to be in min and max positions
                                                            // JavaScript Closure, ** don't remove "event" argument from function **
                                                            slide: (function (
                                                                selectedItem,
                                                                selected_mat_id
                                                            ) {
                                                                return function (
                                                                    event,
                                                                    ui
                                                                ) {
                                                                    // Set min and max value for sliders and push them to be on each end
                                                                    $(
                                                                        '#sliders-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).slider(
                                                                        'option',
                                                                        'min',
                                                                        minValue *
                                                                            1000
                                                                    )
                                                                    $(
                                                                        '#sliders-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).slider(
                                                                        'option',
                                                                        'max',
                                                                        maxValue *
                                                                            1000
                                                                    )

                                                                    $(
                                                                        '#left-slider-input-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).val(
                                                                        ui
                                                                            .values[0] /
                                                                            1000
                                                                    )
                                                                    $(
                                                                        '#right-slider-input-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).val(
                                                                        ui
                                                                            .values[1] /
                                                                            1000
                                                                    )
                                                                }
                                                            })(
                                                                selectedItem,
                                                                selected_mat_id
                                                            ),
                                                        })

                                                        // Set ids for each thumbnail of the slider
                                                        $(
                                                            '#sliders-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id +
                                                                ' .ui-slider-handle'
                                                        ).attr(
                                                            'id',
                                                            'left-slider-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )

                                                        $(
                                                            '#sliders-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id +
                                                                ' .ui-slider-handle:last-child'
                                                        ).attr(
                                                            'id',
                                                            'right-slider-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )

                                                        $(
                                                            '#sliders-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        ).addClass(
                                                            'mmgisMultirange'
                                                        )

                                                        // Append input box to each thumbnail
                                                        // Left slider
                                                        d3.select(
                                                            '#left-slider-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('input')
                                                            .attr(
                                                                'type',
                                                                'text'
                                                            )
                                                            .attr(
                                                                'id',
                                                                'left-slider-input-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .attr(
                                                                'value',
                                                                minValue
                                                            ) // Fill in the input box with min value
                                                            .style(
                                                                'width',
                                                                '30px'
                                                            )
                                                            .style(
                                                                'border',
                                                                'none'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-15px'
                                                            )

                                                        // Right slider
                                                        d3.select(
                                                            '#right-slider-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('input')
                                                            .attr(
                                                                'type',
                                                                'text'
                                                            )
                                                            .attr(
                                                                'id',
                                                                'right-slider-input-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .attr(
                                                                'value',
                                                                maxValue
                                                            ) // Fill in the input box with max value
                                                            .style(
                                                                'width',
                                                                '30px'
                                                            )
                                                            .style(
                                                                'border',
                                                                'none'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-15px'
                                                            )

                                                        // Adding graph to the multi slider component ==============================================================
                                                        // Use the margin convention
                                                        let margin = {
                                                                top: 5,
                                                                right: 10,
                                                                bottom: 1,
                                                                left: 10,
                                                            },
                                                            width =
                                                                w -
                                                                margin.left -
                                                                margin.right, // Use the section's width
                                                            height =
                                                                h -
                                                                margin.top -
                                                                margin.bottom // Use the section's height

                                                        // Set the ranges
                                                        let x = d3
                                                            .scaleLinear()
                                                            .range([0, width])
                                                        let y = d3
                                                            .scaleLinear()
                                                            .range([height, 0])

                                                        let svg = d3
                                                            .select(
                                                                '#mat-stats-info-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .append('svg')
                                                            .attr(
                                                                'width',
                                                                width +
                                                                    margin.left +
                                                                    margin.right
                                                            )
                                                            .attr(
                                                                'height',
                                                                height +
                                                                    margin.top +
                                                                    margin.bottom
                                                            )
                                                            .attr(
                                                                'id',
                                                                'mat-graph-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .append('g')
                                                            .attr(
                                                                'transform',
                                                                'translate(' +
                                                                    margin.left +
                                                                    ',' +
                                                                    margin.top +
                                                                    ')'
                                                            )

                                                        $(
                                                            '#mat-graph-' +
                                                                selectedItem +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .css(
                                                                'bottom',
                                                                '13px'
                                                            )
                                                            .css(
                                                                'position',
                                                                'relative'
                                                            )

                                                        // Format the data
                                                        dataset.forEach(
                                                            function (d) {
                                                                d.x = +d.x
                                                                d.y = +d.y
                                                            }
                                                        )

                                                        // Scale the range of the data
                                                        x.domain(
                                                            d3.extent([
                                                                0,
                                                                dataset.length,
                                                            ])
                                                        )
                                                        y.domain([
                                                            0,
                                                            d3.max(
                                                                dataset,
                                                                function (d) {
                                                                    return d.y
                                                                }
                                                            ),
                                                        ])

                                                        // define the area
                                                        let area = d3
                                                            .area()
                                                            .x(function (d) {
                                                                return x(d.x)
                                                            })
                                                            .y0(h)
                                                            .y1(function (d) {
                                                                return y(d.y)
                                                            })

                                                        // define the line
                                                        let lineGen = d3
                                                            .line()
                                                            .x(function (d) {
                                                                return x(d.x)
                                                            })
                                                            .y(function (d) {
                                                                return y(d.y)
                                                            })
                                                            .curve(
                                                                d3.curveMonotoneX
                                                            )

                                                        // add the area
                                                        svg.append('path')
                                                            .data([dataset])
                                                            .attr(
                                                                'class',
                                                                'area'
                                                            )
                                                            .attr('d', area)

                                                        $('.area').css(
                                                            'fill',
                                                            '#ff960f61'
                                                        )

                                                        // Add the valueline path.
                                                        svg.append('path')
                                                            .data([dataset])
                                                            .attr(
                                                                'class',
                                                                'line_graph'
                                                            )
                                                            .attr('d', lineGen)

                                                        $('.line_graph').css(
                                                            'stroke',
                                                            '#e68a00'
                                                        )

                                                        // Draw a vertical line on the graph for median value
                                                        let medData = [
                                                            {
                                                                x: medianIndex,
                                                                y: max - 0.05,
                                                            },
                                                            {
                                                                x: medianIndex,
                                                                y: 0,
                                                            },
                                                        ]

                                                        // Format the data
                                                        medData.forEach(
                                                            function (d) {
                                                                d.x = +d.x
                                                                d.y = +d.y
                                                            }
                                                        )

                                                        svg.append('path')
                                                            .data([medData])
                                                            .attr(
                                                                'class',
                                                                'med_line'
                                                            )
                                                            .attr('d', lineGen)

                                                        $('.med_line')
                                                            .css(
                                                                'stroke',
                                                                'yellow'
                                                            )
                                                            .css(
                                                                'stroke-dasharray',
                                                                '3,3'
                                                            )

                                                        /**
                                                         * This part of the code is commented out intentionally
                                                         * and it activates the X and Y axis for the graph for checking
                                                         * */
                                                        // Add the X Axis
                                                        // svg.append("g")
                                                        //     .attr("transform", "translate(0," + height + ")")
                                                        //     .attr('class', 'x_axis')
                                                        //     .call(d3.axisBottom(x));

                                                        // Add the Y Axis
                                                        // svg.append("g")
                                                        //     .attr('class', 'y_axis')
                                                        //     .call(d3.axisLeft(y));

                                                        $('.x_axis line').css(
                                                            'stroke',
                                                            '#999966'
                                                        )
                                                        $('.x_axis path').css(
                                                            'stroke',
                                                            '#999966'
                                                        )
                                                        $('.x_axis text').css(
                                                            'fill',
                                                            '#999966'
                                                        )

                                                        // Create lines for slider thumbnail at the begining ==============================================================
                                                        $(function () {
                                                            // find min value on the left side of the graph
                                                            let min_X =
                                                                (parseFloat(
                                                                    $(
                                                                        '#left-slider-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).css(
                                                                        'left'
                                                                    )
                                                                ) /
                                                                    320) *
                                                                    40 +
                                                                1.55

                                                            // Min line data
                                                            let minData = [
                                                                {
                                                                    x: 0,
                                                                    y:
                                                                        max -
                                                                        0.05,
                                                                },
                                                                {
                                                                    x: min_X,
                                                                    y: -1,
                                                                },
                                                            ]

                                                            d3.select(
                                                                '#mat-graph-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                                .append('path')
                                                                .data([minData])
                                                                .attr(
                                                                    'class',
                                                                    'min_line'
                                                                )
                                                                .attr(
                                                                    'id',
                                                                    'min-line-' +
                                                                        selectedItem +
                                                                        '-' +
                                                                        selected_mat_id
                                                                )
                                                                .attr(
                                                                    'd',
                                                                    lineGen
                                                                )

                                                            $('.min_line').css(
                                                                'stroke',
                                                                '#dea26d'
                                                            )

                                                            // find max value on the rigth side of the graph
                                                            let max_X =
                                                                (parseFloat(
                                                                    $(
                                                                        '#right-slider-' +
                                                                            selectedItem +
                                                                            '-' +
                                                                            selected_mat_id
                                                                    ).css(
                                                                        'left'
                                                                    )
                                                                ) /
                                                                    320) *
                                                                    40 +
                                                                1.55

                                                            // Max line data
                                                            let maxData = [
                                                                {
                                                                    x: 0,
                                                                    y:
                                                                        max -
                                                                        0.05,
                                                                },
                                                                {
                                                                    x: max_X,
                                                                    y: -1,
                                                                },
                                                            ]

                                                            d3.select(
                                                                '#mat-graph-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                                .append('path')
                                                                .data([maxData])
                                                                .attr(
                                                                    'class',
                                                                    'max_line'
                                                                )
                                                                .attr(
                                                                    'id',
                                                                    'max-line-' +
                                                                        selectedItem +
                                                                        '-' +
                                                                        selected_mat_id
                                                                )
                                                                .attr(
                                                                    'd',
                                                                    lineGen
                                                                )

                                                            $('.max_line').css(
                                                                'stroke',
                                                                '#dea26d'
                                                            )
                                                        })

                                                        // Move the minimum and maximum lines with the slider thumbnails whenever they move.
                                                        $(
                                                            '.ui-slider-handle'
                                                        ).click(function () {
                                                            // Get the id of the slider and split it to find the left or right slider
                                                            let SId = $(this)
                                                                .attr('id')
                                                                .split('-')

                                                            if (
                                                                SId.indexOf(
                                                                    'right'
                                                                ) > -1
                                                            ) {
                                                                $(
                                                                    '#right-slider-' +
                                                                        SId[
                                                                            SId.length -
                                                                                2
                                                                        ] +
                                                                        '-' +
                                                                        SId[
                                                                            SId.length -
                                                                                1
                                                                        ]
                                                                ).mousedown(
                                                                    function () {
                                                                        $(
                                                                            '#mat-stats-info-' +
                                                                                SId[
                                                                                    SId.length -
                                                                                        2
                                                                                ] +
                                                                                '-' +
                                                                                SId[
                                                                                    SId.length -
                                                                                        1
                                                                                ]
                                                                        ).on(
                                                                            'mousemove',
                                                                            function () {
                                                                                // Remove the previous line if exists
                                                                                $(
                                                                                    '#max-line-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                2
                                                                                        ] +
                                                                                        '-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                1
                                                                                        ]
                                                                                ).remove()

                                                                                // find max value on the rigth side of the graph
                                                                                let max_X =
                                                                                    (parseFloat(
                                                                                        $(
                                                                                            '#right-slider-' +
                                                                                                SId[
                                                                                                    SId.length -
                                                                                                        2
                                                                                                ] +
                                                                                                '-' +
                                                                                                SId[
                                                                                                    SId.length -
                                                                                                        1
                                                                                                ]
                                                                                        ).css(
                                                                                            'left'
                                                                                        )
                                                                                    ) /
                                                                                        320) *
                                                                                        40 +
                                                                                    1.55

                                                                                // Max line data
                                                                                let maxData =
                                                                                    [
                                                                                        {
                                                                                            x: 0,
                                                                                            y:
                                                                                                max -
                                                                                                0.05,
                                                                                        },
                                                                                        {
                                                                                            x: max_X,
                                                                                            y: -1,
                                                                                        },
                                                                                    ]

                                                                                d3.select(
                                                                                    '#mat-graph-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                2
                                                                                        ] +
                                                                                        '-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                1
                                                                                        ]
                                                                                )
                                                                                    .append(
                                                                                        'path'
                                                                                    )
                                                                                    .data(
                                                                                        [
                                                                                            maxData,
                                                                                        ]
                                                                                    )
                                                                                    .attr(
                                                                                        'class',
                                                                                        'max_line'
                                                                                    )
                                                                                    .attr(
                                                                                        'id',
                                                                                        'max-line-' +
                                                                                            SId[
                                                                                                SId.length -
                                                                                                    2
                                                                                            ] +
                                                                                            '-' +
                                                                                            SId[
                                                                                                SId.length -
                                                                                                    1
                                                                                            ]
                                                                                    )
                                                                                    .attr(
                                                                                        'd',
                                                                                        lineGen
                                                                                    )

                                                                                $(
                                                                                    '.max_line'
                                                                                ).css(
                                                                                    'stroke',
                                                                                    '#dea26d'
                                                                                )
                                                                            }
                                                                        )
                                                                    }
                                                                )
                                                            }

                                                            if (
                                                                SId.indexOf(
                                                                    'left'
                                                                ) > -1
                                                            ) {
                                                                $(
                                                                    '#left-slider-' +
                                                                        SId[
                                                                            SId.length -
                                                                                2
                                                                        ] +
                                                                        '-' +
                                                                        SId[
                                                                            SId.length -
                                                                                1
                                                                        ]
                                                                ).mousedown(
                                                                    function () {
                                                                        $(
                                                                            '#mat-stats-info-' +
                                                                                SId[
                                                                                    SId.length -
                                                                                        2
                                                                                ] +
                                                                                '-' +
                                                                                SId[
                                                                                    SId.length -
                                                                                        1
                                                                                ]
                                                                        ).on(
                                                                            'mousemove',
                                                                            function () {
                                                                                // Remove the previous line if exists
                                                                                $(
                                                                                    '#min-line-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                2
                                                                                        ] +
                                                                                        '-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                1
                                                                                        ]
                                                                                ).remove()

                                                                                // find min value on the left side of the graph
                                                                                let min_X =
                                                                                    (parseFloat(
                                                                                        $(
                                                                                            '#left-slider-' +
                                                                                                SId[
                                                                                                    SId.length -
                                                                                                        2
                                                                                                ] +
                                                                                                '-' +
                                                                                                SId[
                                                                                                    SId.length -
                                                                                                        1
                                                                                                ]
                                                                                        ).css(
                                                                                            'left'
                                                                                        )
                                                                                    ) /
                                                                                        320) *
                                                                                        40 +
                                                                                    1.55

                                                                                // Min line data
                                                                                let minData =
                                                                                    [
                                                                                        {
                                                                                            x: 0,
                                                                                            y:
                                                                                                max -
                                                                                                0.05,
                                                                                        },
                                                                                        {
                                                                                            x: min_X,
                                                                                            y: -1,
                                                                                        },
                                                                                    ]

                                                                                d3.select(
                                                                                    '#mat-graph-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                2
                                                                                        ] +
                                                                                        '-' +
                                                                                        SId[
                                                                                            SId.length -
                                                                                                1
                                                                                        ]
                                                                                )
                                                                                    .append(
                                                                                        'path'
                                                                                    )
                                                                                    .data(
                                                                                        [
                                                                                            minData,
                                                                                        ]
                                                                                    )
                                                                                    .attr(
                                                                                        'class',
                                                                                        'min_line'
                                                                                    )
                                                                                    .attr(
                                                                                        'id',
                                                                                        'min-line-' +
                                                                                            SId[
                                                                                                SId.length -
                                                                                                    2
                                                                                            ] +
                                                                                            '-' +
                                                                                            SId[
                                                                                                SId.length -
                                                                                                    1
                                                                                            ]
                                                                                    )
                                                                                    .attr(
                                                                                        'd',
                                                                                        lineGen
                                                                                    )

                                                                                $(
                                                                                    '.min_line'
                                                                                ).css(
                                                                                    'stroke',
                                                                                    '#dea26d'
                                                                                )
                                                                            }
                                                                        )
                                                                    }
                                                                )
                                                            }
                                                        })

                                                        // Adding input sections for max value of slider ==============================================================
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'mat-stats-max-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '36px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-20px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '25px'
                                                            )
                                                            .append('input')
                                                            .attr(
                                                                'id',
                                                                'mat-stats-max-input-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .attr(
                                                                'type',
                                                                'text'
                                                            )
                                                            .attr(
                                                                'title',
                                                                'maximum value'
                                                            )
                                                            .attr(
                                                                'value',
                                                                maxValue
                                                            )
                                                            .style(
                                                                'width',
                                                                '110%'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-10px'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#030215'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '10px'
                                                            )
                                                            .style(
                                                                'border',
                                                                'none'
                                                            )

                                                        // ========================================= AND/OR sliding switch ====================================
                                                        // Add the "AND" and "OR" slider for each selected item/material
                                                        createAndOrSliderSwitch(
                                                            inst.toLowerCase(),
                                                            selectedItem,
                                                            itemType,
                                                            selected_mat_id
                                                        )

                                                        // Add remove/close button =============================================================================
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-close-' +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'position',
                                                                'relative'
                                                            )
                                                            .style(
                                                                'left',
                                                                '5px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '15px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '15px'
                                                            )
                                                            .style(
                                                                'margin',
                                                                '2px'
                                                            )
                                                            .append('i')
                                                            .attr(
                                                                'class',
                                                                'mdi mdi-close-circle-outline mdi-22px'
                                                            )
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-close-button-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'color',
                                                                'red'
                                                            )
                                                    }

                                                    // Now if the type of retrieved data from database is string
                                                    if (
                                                        typeof result.data[0][
                                                            selectedItem
                                                        ] === 'string'
                                                    ) {
                                                        $(
                                                            '#loadedQueries'
                                                        ).remove()
                                                        // Set the selected item type
                                                        itemType = 's'

                                                        // Create information component for selected item/material
                                                        d3.select(
                                                            '#queryToolMatInfo'
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'display',
                                                                'flex'
                                                            )
                                                            .style(
                                                                'border-style',
                                                                'solid'
                                                            )
                                                            .style(
                                                                'border-color',
                                                                '#0c3534'
                                                            )
                                                            .style(
                                                                'border-width',
                                                                '1px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '55px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '100%'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#030215'
                                                            )

                                                        // Addind the name of used instrument to the component
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                'inst-name-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'width',
                                                                '50px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '20px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '16px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-12px'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '12px'
                                                            )
                                                            .style(
                                                                'text-align',
                                                                'center'
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#5a4402'
                                                            )
                                                            .style(
                                                                'transform',
                                                                'rotate(-90deg)'
                                                            )
                                                            .text(
                                                                inst.toUpperCase()
                                                            )

                                                        // Adding name of the selected item/material
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-mat_name-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'width',
                                                                '100px'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '12px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '5px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-11px'
                                                            )
                                                            .style(
                                                                'text-overflow',
                                                                'ellipsis'
                                                            )
                                                            .style(
                                                                'white-space',
                                                                'nowrap'
                                                            )
                                                            .style(
                                                                'overflow-x',
                                                                'hidden'
                                                            )
                                                            .text(selectedItem)

                                                        // Create div section for input element
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-mat-info-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'height',
                                                                '55px'
                                                            )
                                                            .style(
                                                                'margin-left',
                                                                '-30px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '335px'
                                                            )

                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-mat-info-' +
                                                                selected_mat_id
                                                        )
                                                            .append('input')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-mat_inputs-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'background-color',
                                                                '#6b4000'
                                                            )
                                                            .style(
                                                                'border',
                                                                'none'
                                                            )
                                                            .style(
                                                                'width',
                                                                '90%'
                                                            )
                                                            .style(
                                                                'height',
                                                                '30px'
                                                            )
                                                            .style(
                                                                'padding',
                                                                '5px'
                                                            )
                                                            .style(
                                                                'font-size',
                                                                '14px'
                                                            )
                                                            .style(
                                                                'margin-top',
                                                                '11px'
                                                            )

                                                        // The following code block removes duplicate items from an array
                                                        $(function () {
                                                            let availableInputs =
                                                                []

                                                            // Remove duplicate elements in the array
                                                            $.each(
                                                                result.data,
                                                                function (
                                                                    i,
                                                                    el
                                                                ) {
                                                                    if (
                                                                        $.inArray(
                                                                            el[
                                                                                selectedItem
                                                                            ],
                                                                            availableInputs
                                                                        ) === -1
                                                                    )
                                                                        availableInputs.push(
                                                                            el[
                                                                                selectedItem
                                                                            ]
                                                                        )
                                                                }
                                                            )

                                                            // Create an autocomplete list
                                                            $(
                                                                '#' +
                                                                    inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-mat_inputs-' +
                                                                    selected_mat_id
                                                            ).autocomplete({
                                                                source: availableInputs,
                                                                minLength: 2,
                                                            })
                                                        })

                                                        // ========================================= AND/OR ===============================================
                                                        // add the "AND" and "OR" checkbox for each selected material
                                                        createAndOrSliderSwitch(
                                                            inst.toLowerCase(),
                                                            selectedItem,
                                                            itemType,
                                                            selected_mat_id
                                                        )

                                                        // Adding remove/close button ==================================================================
                                                        d3.select(
                                                            '#' +
                                                                inst.toLowerCase() +
                                                                '-' +
                                                                selectedItem +
                                                                '-' +
                                                                itemType +
                                                                '-' +
                                                                selected_mat_id
                                                        )
                                                            .append('div')
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-close-' +
                                                                    '-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'position',
                                                                'relative'
                                                            )
                                                            .style(
                                                                'left',
                                                                '5px'
                                                            )
                                                            .style(
                                                                'width',
                                                                '15px'
                                                            )
                                                            .style(
                                                                'height',
                                                                '15px'
                                                            )
                                                            .style(
                                                                'margin',
                                                                '2px'
                                                            )
                                                            .append('i')
                                                            .attr(
                                                                'class',
                                                                'mdi mdi-close-circle-outline mdi-22px'
                                                            )
                                                            .attr(
                                                                'id',
                                                                inst.toLowerCase() +
                                                                    '-' +
                                                                    selectedItem +
                                                                    '-' +
                                                                    itemType +
                                                                    '-close-button-' +
                                                                    selected_mat_id
                                                            )
                                                            .style(
                                                                'color',
                                                                'red'
                                                            )
                                                    }
                                                },
                                                error: function (xhr, status) {
                                                    alert(
                                                        'API server is not responding!'
                                                    )
                                                    console.log(
                                                        'XHR Object:',
                                                        xhr,
                                                        'Status:',
                                                        status
                                                    )
                                                },
                                            })
                                        }
                                    }
                                )
                            },
                            error: function (xhr, status) {
                                alert('API server is not responding!')
                                console.log(
                                    'XHR Object:',
                                    xhr,
                                    'Status:',
                                    status
                                )
                            },
                        })
                    })
                } else {
                    console.log('Data is not available for this area yet!')
                }
            },
            error: function (xhr, status) {
                alert('API server is not responding!')
                console.log('XHR Object:', xhr, 'Status:', status)
            },
        })

        /**
         * Keeping Track of mouse actions on the Query tool interface
         * to detect the close action for each component. And also, change
         * the value of inputs in the multislider component.
         */
        $(document).ready(function () {
            $('#queryToolMatInfo').click((event) => {
                let sec = event.target.id.split('-') // sec[sec.length-2]--> material and sec[sec.length-1]--> id

                let selectedButton = event.target
                let divParent = $(selectedButton).parent()
                let id = sec[sec.length - 4]

                if (sec.indexOf('mat_inputs') > -1) {
                    d3.select('.ui-autocomplete')
                        .style('overflow-y', '')
                        .style('overflow-x', 'hidden')
                        .style('height', '100px')
                }

                // Capture the geometry operator activities
                // whenever it is clicked.
                if (sec.indexOf('button') > -1 && sec.indexOf('geom') > -1) {
                    if (
                        sec.indexOf('adjust') > -1 ||
                        sec.indexOf('line') > -1 ||
                        sec.indexOf('polygon') > -1 ||
                        sec.indexOf('rectangle') > -1 ||
                        sec.indexOf('intersection') > -1 ||
                        sec.indexOf('vertical') >
                            -1 /* Indicating the elevation icon */
                    ) {
                        toggleGeometryButtons(selectedButton)
                    }
                }

                // Capture the action of cancel button of the geometry operator
                if (sec.indexOf('cancel') > -1 && sec.indexOf('geom') > -1) {
                    // Remove the final query result if exists
                    if (
                        L_.addedfiles.hasOwnProperty('_QueryToolResult') &&
                        L_.addedfiles['_QueryToolResult'].hasOwnProperty(0)
                    ) {
                        Map_.map.removeLayer(
                            L_.addedfiles['_QueryToolResult'][0]
                        )
                    }

                    // Remove everything from this component
                    $(
                        '#' + sec[0] + '-geom-g-' + sec[sec.length - 3] + ' *'
                    ).remove()
                    QueryTool.Draw.drawingType = 'none'
                    d3.select('#map').style('cursor', '')

                    // remove the drawn layer if exists
                    if (sec[sec.length - 1] === 'adjust') {
                        QueryTool.Draw._radiusPoints = []
                        Map_.rmNotNull(L_.layers.layer['QueryToolPointBuffer'])
                    }

                    if (
                        sec[sec.length - 1] === 'line' ||
                        sec[sec.length - 1] === 'rectangle' ||
                        sec[sec.length - 1] === 'polygon'
                    ) {
                        if (QueryTool.Draw.drawingPoly !== undefined) {
                            Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                        }
                    }

                    if (sec[sec.length - 1] === 'intersection') {
                        Map_.rmNotNull(L_.addedfiles['_selected_layer_'][0])

                        if (QueryTool.Draw.drawingPoly !== undefined) {
                            Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                        }
                    }

                    // Create the geometry operator again with same ints name and id
                    createGeometryComponent(
                        sec[0],
                        'geom',
                        'g',
                        sec[sec.length - 3]
                    )
                }

                // Second level of drawing tool
                if (sec.indexOf('geom') > -1 && sec.indexOf('geomIcons') > -1) {
                    if (
                        sec.indexOf('layer') > -1 &&
                        sec.indexOf('selection') > -1
                    ) {
                        d3.select('#' + event.target.id).on(
                            'change',
                            function () {
                                loadSelectedLayer(event.target.id)
                            }
                        )
                    }

                    if (sec.indexOf('drawing') > -1) {
                        QueryTool.Draw.drawingType = sec[sec.length - 1]

                        if (sec.indexOf('adjust') > -1) {
                            QueryTool.Draw.drawingType = 'point'
                        }

                        // Change the background color of the selected botton except the first icon
                        divParent
                            .children('i:gt(1)')
                            .css('background', '#5a4402')
                        $(selectedButton).css('background', '#CA7305')

                        QueryTool.Draw.lastDivParent = divParent
                        QueryTool.Draw.sec = sec
                        // switch to drawing mode
                        Map_.map.off('click', QueryTool.Draw.startClick)
                        Map_.map.off('click', QueryTool.Draw.endClick)
                        Map_.map.on('click', QueryTool.Draw.startClick)
                    }

                    if (sec.indexOf('delete') > -1) {
                        // Change the drawing type to none
                        QueryTool.Draw.drawingType = 'none'

                        // Change the background color of the selected botton except the first icon
                        divParent
                            .children('i:gt(0)')
                            .css('background', '#5a4402')
                        $(selectedButton).css('background', '#CA7305')

                        if (QueryTool.Draw.drawingPoly !== undefined) {
                            Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                        }
                    }
                }

                // Remove sections by clicking on close button
                if (sec.indexOf('close') > -1) {
                    if (sec.indexOf('load') > -1) {
                        let loadedQueryID = '#loadQuery-load-' + sec[2]
                        $(loadedQueryID).remove()

                        // Remove the final result from query execution
                        if (
                            L_.addedfiles.hasOwnProperty('_QueryToolResult') &&
                            L_.addedfiles['_QueryToolResult'].hasOwnProperty(0)
                        ) {
                            Map_.map.removeLayer(
                                L_.addedfiles['_QueryToolResult'][0]
                            )
                        }

                        // Remove the drawn layer
                        if (QueryTool.Draw.drawingPoly !== undefined) {
                            Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                        }
                    }

                    if (sec.indexOf('geom') > -1) {
                        let removedSection =
                            '#' + sec[0] + '-geom-g-' + sec[sec.length - 1]
                        $(removedSection).remove()

                        // Remove the final result query
                        if (
                            L_.addedfiles.hasOwnProperty('_QueryToolResult') &&
                            L_.addedfiles['_QueryToolResult'].hasOwnProperty(0)
                        ) {
                            Map_.map.removeLayer(
                                L_.addedfiles['_QueryToolResult'][0]
                            )
                        }

                        // Remove the drawn shape
                        if (QueryTool.Draw.drawingPoly !== undefined) {
                            Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                        }
                    } else {
                        let removedSection =
                            '#' +
                            sec[0] +
                            '-' +
                            sec[1] +
                            '-' +
                            sec[2] +
                            '-' +
                            sec[sec.length - 1]
                        $(removedSection).remove()
                    }
                }

                // Update the value of min or max inputs
                if (sec.indexOf('range') > -1) {
                    $(
                        '.multirange.ghost#mat-sliders-range-' +
                            sec[sec.length - 2] +
                            '-' +
                            sec[sec.length - 1]
                    ).click(function () {
                        let maxInputVal = $(
                            '.multirange.original#mat-sliders-range-' +
                                sec[sec.length - 2] +
                                '-' +
                                sec[sec.length - 1]
                        )
                            .val()
                            .split(',')
                            .map(Number)[1]
                        $(
                            '#mat-stats-max-input-' +
                                sec[sec.length - 2] +
                                '-' +
                                sec[sec.length - 1]
                        ).val(maxInputVal)
                    })
                    $(
                        '.multirange.original#mat-sliders-range-' +
                            sec[sec.length - 2] +
                            '-' +
                            sec[sec.length - 1]
                    ).click(function () {
                        let minInputVal = $(this)
                            .val()
                            .split(',')
                            .map(Number)[0]
                        $(
                            '#mat-stats-min-input-' +
                                sec[sec.length - 2] +
                                '-' +
                                sec[sec.length - 1]
                        ).val(minInputVal)
                    })
                }
            })
        })

        /**
         * A function to go to the next level of drawing
         * modes in the geometry operator component.
         * @param {*} selectedButton
         */
        function toggleGeometryButtons(selectedButton) {
            let divParent = $(selectedButton).parent()
            let parentID = divParent[0].id
            let selectedItemID = selectedButton.id

            //Get the selected button class
            let iconClass = selectedButton.getAttribute('class')

            // get the icon type
            let iconType = iconClass.split(' ')
            iconType = iconType[1].split('-')
            iconType = iconType[iconType.length - 1]

            // Get the instrument name and component ID
            let divParts = parentID.split('-')
            let instName = divParts[0]
            let instID = divParts[divParts.length - 1]

            QueryTool.settings[instID] = {}

            // Remove other buttons
            $('#' + divParent[0].id + ' *').remove()

            // Create new component here
            // If icon type is elevation to choose a range from that
            if (iconType === 'vertical') {
                // Indicating the elevation icon
                // Put the selected button back with different background color
                d3.select('#' + parentID)
                    .append('i')
                    .attr('class', iconClass)
                    .attr('id', instName + '-geom-' + iconType + '-' + instID)
                    .attr('title', iconType)
                    .style('border-color', '#d8850c')
                    .style('border-style', 'solid')
                    .style('border-width', '1px')
                    .style('width', '15%')
                    .style('height', '100%')
                    .style('margin', '5px')
                    .style('background-color', '#5a2702')
                    .style('padding', '12px 7px 4px 7px')
                    .style('position', 'relative')
                    .style('bottom', '0px')

                // A Ajax call to get the elevation of all targets from database
                $.ajax({
                    url: baseURL + 'all_targets_elev/',
                    type: 'GET',
                    dataType: 'json',
                    contentType: 'application/json',
                    statusCode: {
                        404: function () {
                            alert('page not found')
                        },
                    },
                    success: function (received) {
                        // If there is no data
                        if (!received) {
                            console.log(
                                'There is no received data from back-end!'
                            )
                        } else {
                            let dp = received.data_points
                            let elevations = []
                            for (let r in dp) {
                                elevations.push({
                                    x: dp[r].BinIndex,
                                    y: dp[r].NumOfPoints / received.totalPoints,
                                })
                            }

                            // Define data in this scope
                            // let elevations = received.data_points;
                            let minElev = Math.floor(received.min_elev)
                            let maxElev = Math.floor(received.max_elev)

                            // Create D3 graph module here
                            // Create div section for graph and sliders for elevation
                            d3.select('#' + parentID)
                                .append('div')
                                .attr(
                                    'id',
                                    instName + '-geom-elevation-info-' + instID
                                )
                                .style('position', 'relative')
                                .style('height', '54px')
                                .style('width', '190px')
                                .style('top', '-41px')
                                .style('left', '45px')

                            // Generating the elevation graph here
                            // Set width and height values for SVG component
                            let elev_w = 210,
                                elev_h = 30
                            // Adding graph to the multi slider component ==============================================================
                            // Use the margin convention
                            let margin = {
                                    top: 5,
                                    right: 10,
                                    bottom: 1,
                                    left: 15,
                                },
                                width = elev_w - margin.left - margin.right, // Use the section's width
                                height = elev_h - margin.top - margin.bottom // Use the section's height

                            // Set the ranges
                            let x = d3.scaleLinear().range([0, width])
                            let y = d3.scaleLinear().range([height, 0])

                            let svg = d3
                                .select(
                                    '#' +
                                        instName +
                                        '-geom-elevation-info-' +
                                        instID
                                )
                                .append('svg')
                                .attr(
                                    'width',
                                    width + margin.left + margin.right
                                )
                                .attr(
                                    'height',
                                    height + margin.top + margin.bottom
                                )
                                .attr(
                                    'id',
                                    'elev-graph-' + instName + '-' + instID
                                )
                                .append('g')
                                .attr(
                                    'transform',
                                    'translate(' +
                                        margin.left +
                                        ',' +
                                        margin.top +
                                        ')'
                                )

                            $('#elev-graph-' + instName + '-' + instID)
                                .css('bottom', '-1px')
                                .css('position', 'relative')

                            // Scale the range of the data
                            x.domain(d3.extent([0, elevations.length]))
                            y.domain([
                                0,
                                d3.max(elevations, function (d) {
                                    return d.y
                                }),
                            ])

                            // define the line
                            let lineGen = d3
                                .line()
                                .x(function (d) {
                                    return x(d.x)
                                })
                                .y(function (d) {
                                    return y(d.y)
                                })
                                .curve(d3.curveMonotoneX)

                            // Add the valueline path.
                            svg.append('path')
                                .data([elevations])
                                .attr('class', 'elev_line_graph')
                                .attr('d', lineGen)

                            $('.elev_line_graph').css('stroke', '#e68a00')
                            // End of elevation graph ===============================================================

                            // Create div section for sliders =======================================================
                            d3.select(
                                '#' +
                                    instName +
                                    '-geom-elevation-info-' +
                                    instID
                            )
                                .append('div')
                                .attr(
                                    'id',
                                    'elev-sliders-' + instName + '-' + instID
                                )
                                .style('position', 'relative')
                                .style('left', '5px')
                                .style('top', '-13px')

                            // Setting up two thumbs slider
                            $(
                                '#elev-sliders-' + instName + '-' + instID
                            ).slider({
                                animate: 'fast',
                                range: true,
                                min: minElev,
                                max: maxElev,
                                steps: 1, // Have more smooth sliding and get the digits after point
                                values: [minElev, maxElev], // Force the slider thumbs to be in min and max positions
                                // JavaScript Closure, ** don't remove "event" argument from function **
                                slide: (function (instName, instID) {
                                    return function (event, ui) {
                                        // Set min and max value for sliders and push them to be on each end
                                        $(
                                            '#elev-left-slider-input-' +
                                                instName +
                                                '-' +
                                                instID
                                        ).val(ui.values[0])
                                        $(
                                            '#elev-right-slider-input-' +
                                                instName +
                                                '-' +
                                                instID
                                        ).val(ui.values[1])
                                    }
                                })(instName, instID),
                            })

                            // Set ids for each thumbnail of the slider
                            $(
                                '#elev-sliders-' +
                                    instName +
                                    '-' +
                                    instID +
                                    ' .ui-slider-handle'
                            ).attr(
                                'id',
                                'elev-left-slider-' + instName + '-' + instID
                            )

                            $(
                                '#elev-sliders-' +
                                    instName +
                                    '-' +
                                    instID +
                                    ' .ui-slider-handle:last-child'
                            ).attr(
                                'id',
                                'elev-right-slider-' + instName + '-' + instID
                            )

                            $(
                                '#elev-sliders-' + instName + '-' + instID
                            ).addClass('mmgisMultirange_elev')

                            // Append input box to each thumbnail
                            // Left slider
                            d3.select(
                                '#elev-left-slider-' + instName + '-' + instID
                            )
                                .append('input')
                                .attr('type', 'text')
                                .attr(
                                    'id',
                                    'elev-left-slider-input-' +
                                        instName +
                                        '-' +
                                        instID
                                )
                                .attr('value', minElev) // Fill in the input box with min value
                                .style('width', '30px')
                                .style('border', 'none')
                                .style('font-size', '8px')
                                .style('margin-top', '10px')
                                .style('margin-left', '-15px')

                            // Right slider
                            d3.select(
                                '#elev-right-slider-' + instName + '-' + instID
                            )
                                .append('input')
                                .attr('type', 'text')
                                .attr(
                                    'id',
                                    'elev-right-slider-input-' +
                                        instName +
                                        '-' +
                                        instID
                                )
                                .attr('value', maxElev) // Fill in the input box with max value
                                .style('width', '30px')
                                .style('border', 'none')
                                .style('font-size', '8px')
                                .style('margin-top', '10px')
                                .style('margin-left', '-15px')

                            // End of sliders ===============================================================

                            // define the area under the graph
                            let area = d3
                                .area()
                                .x(function (d) {
                                    return x(d.x)
                                })
                                .y0(elev_h)
                                .y1(function (d) {
                                    return y(d.y)
                                })

                            // add the area to the svg graph
                            svg.append('path')
                                .data([elevations])
                                .attr('class', 'area')
                                .attr('d', area)

                            $('.area').css('fill', '#ff960f61')

                            // Append back button to reset to the previous status
                            d3.select('#' + parentID)
                                .append('button')
                                .attr('type', 'button')
                                .attr('id', parentID + '-cancel-' + iconType)
                                .style('width', '65px')
                                .style('height', '34px')
                                .style('border-color', '#d8850c')
                                .style('border-style', 'solid')
                                .style('border-width', '1px')
                                .style('margin-left', '255px')
                                .style('background-color', '#5a4402')
                                .style('text-align', 'center')
                                .style('position', 'relative')
                                .style('padding', '5px')
                                .style('bottom', '84px')
                                .text('Back')
                        }
                    },
                    error: function (xhr, status) {
                        alert('API server is not responding!')
                        console.log('XHR Object:', xhr, 'Status:', status)
                    },
                })
            }
            // If icon type is intersection
            else if (iconType === 'intersection') {
                // Put the selected button back with different background color
                createSelectedButton(
                    parentID,
                    instName,
                    instID,
                    iconClass,
                    iconType
                )

                // Name of the layers should come from database
                // Ajax call to get the name of all layers
                $.ajax({
                    url: baseURL + '/all_layers/',
                    type: 'GET',
                    dataType: 'json',
                    contentType: 'application/json',
                    // data: JSON.stringify(query_data),
                    success: function (layers) {
                        if (!layers) {
                            console.log('There is no result for the layers!')
                        } else {
                            // Put the icon back into the component
                            d3.select('#' + parentID)
                                .append('i')
                                .attr('class', 'mdi mdi-lead-pencil mdi-24px')
                                .attr('id', parentID + '-drawing-tool-polygon')
                                .attr('title', 'Draw a polygon')
                                .style('border-color', '#d8850c')
                                .style('border-style', 'solid')
                                .style('border-width', '1px')
                                .style('margin-left', '5px')
                                .style('background-color', '#5a4402')
                                .style('padding', '12px 32px 4px 32px')
                                .style('position', 'relative')
                                .style('bottom', '4px')

                            d3.select('#' + parentID)
                                .append('select')
                                .attr('id', parentID + '-layer-selection')
                                .attr('title', 'Select a layer')
                                .style('border-color', '#d8850c')
                                .style('border-style', 'solid')
                                .style('width', '25%')
                                .style('height', '33px')
                                .style('margin-left', '10px')
                                .style('background-color', '#5a4402')
                                .style('position', 'relative')
                                .style('bottom', '8px')
                                .selectAll('option')
                                .data(layers)
                                .enter()
                                .append('option')
                                .attr('value', function (d) {
                                    return d.layer_type
                                })
                                .text(function (d) {
                                    return d.layer_name
                                })

                            // Initialization: Load the first layer on the map
                            loadSelectedLayer(parentID, instID)

                            // Append back button to reset to the previous status
                            createBackButton(parentID, iconType)
                        }
                    },
                    error: function (xhr, status) {
                        console.log('XHR Object:', xhr, 'Status:', status)
                    },
                })
            }
            // If the icon type is polygon or rectangle
            else if (iconType === 'polygon' || iconType === 'rectangle') {
                // Put the selected button back with different background color
                createSelectedButton(
                    parentID,
                    instName,
                    instID,
                    iconClass,
                    iconType
                )

                d3.select('#' + parentID)
                    .append('i')
                    .attr('class', 'mdi mdi-lead-pencil mdi-24px')
                    .attr('id', parentID + '-drawing-tool-' + iconType)
                    .attr('title', 'Draw a shape')
                    .style('border-color', '#d8850c')
                    .style('border-style', 'solid')
                    .style('border-width', '1px')
                    .style('margin-left', '5px')
                    .style('background-color', '#5a4402')
                    .style('padding', '12px 32px 4px 32px')
                    // .style('padding', '12px 7px 4px 7px')  // previous configuration with edit and submit botton
                    .style('position', 'relative')
                    .style('bottom', '4px')

                // This part of the code is left intentionally if there is a need to set back the initial configurations
                // d3.select('#' + parentID)
                //   .append('i').attr('class', 'mdi mdi-square-edit-outline mdi-24px')
                //   .attr('id', parentID + '-edit-tool-' + iconType)
                //   .attr('title', 'Edit a drawing')
                //   .style('border-color', '#d8850c')
                //   .style('border-style', 'solid')
                //   .style('border-width', '1px')
                //   .style('width','15%')
                //   .style('height', '100%')
                //   .style('margin-left', '10px')
                //   .style('background-color', '#5a4402')
                //   .style('padding', '12px 7px 4px 7px')
                //   .style('position','relative')
                //   .style('bottom', '4px');

                // d3.select('#' + parentID)
                //   .append('i').attr('class', 'mdi mdi-check-all mdi-24px')
                //   .attr('id', parentID + '-submit-tool-' + iconType)
                //   .attr('title', 'Submit a drawing')
                //   .style('border-color', '#d8850c')
                //   .style('border-style', 'solid')
                //   .style('border-width', '1px')
                //   .style('width','15%')
                //   .style('height', '100%')
                //   .style('margin-left', '10px')
                //   .style('background-color', '#5a4402')
                //   .style('padding', '12px 7px 4px 7px')
                //   .style('position','relative')
                //   .style('bottom', '4px');

                d3.select('#' + parentID)
                    .append('i')
                    .attr('class', 'mdi mdi-delete mdi-24px')
                    .attr('id', parentID + '-delete-tool-' + iconType)
                    .attr('title', 'Delete a shape')
                    .style('border-color', '#d8850c')
                    .style('border-style', 'solid')
                    .style('border-width', '1px')
                    .style('margin-left', '10px')
                    .style('background-color', '#5a4402')
                    .style('padding', '12px 32px 4px 32px')
                    // .style('padding', '12px 7px 4px 7px')  // previous configuration with edit and submit botton
                    .style('position', 'relative')
                    .style('bottom', '4px')

                // Append back button to reset to the previous status
                createBackButton(parentID, iconType)
            }
            // Otherwise, if the icon is other types
            else {
                // Put the selected button back with different background color
                createSelectedButton(
                    parentID,
                    instName,
                    instID,
                    iconClass,
                    iconType
                )

                if (iconType === 'line' || iconType === 'adjust') {
                    $('#' + parentID + '-input')
                        .css('width', '140px')
                        .css('margin-right', '0px')

                    // Add the drawing button/tool
                    d3.select('#' + parentID)
                        .append('i')
                        .attr('class', 'mdi mdi-lead-pencil mdi-24px')
                        .attr('id', parentID + '-drawing-tool-' + iconType)
                        .attr('title', 'Draw a shape')
                        .style('border-color', '#d8850c')
                        .style('border-style', 'solid')
                        .style('border-width', '1px')
                        .style('width', '15%')
                        .style('height', '100%')
                        .style('margin-left', '5px')
                        .style('background-color', '#5a4402')
                        .style('padding', '12px 7px 4px 7px')
                        .style('position', 'relative')
                        .style('bottom', '4px')
                }

                // Append proper input based on the selected button
                d3.select('#' + parentID)
                    .append('input')
                    .attr('id', parentID + '-input')
                    .attr('type', 'number')
                    .attr('min', 0)
                    .attr('placeholder', function () {
                        let type = iconType
                        switch (type) {
                            case 'adjust':
                                return 'Radius for circle (m)'
                            case 'line':
                                return 'Distance from line (m)'
                            default:
                                return ''
                        }
                    })
                    .style('background-color', '#6b4000')
                    .style('padding', '5px')
                    .style('border', 'none')
                    .style('margin-right', '4px')
                    .style('margin-left', '4px')

                    .style('width', '142px')
                    .style('height', '33px')
                    .style('font-size', '14px')
                    .style('position', 'relative')
                    .style('bottom', '7px')
                    .style('left', '5px')

                if (iconType === 'adjust') {
                    $('#' + parentID + '-input').on('input', function () {
                        QueryTool.Draw.drawing = true
                        QueryTool.Draw.firstDrawing = false
                        QueryTool.Draw.drawingType = 'point'
                        QueryTool.Draw.doDrawing(null, null, +$(this).val())
                        QueryTool.Draw.drawing = false
                        QueryTool.Draw.firstDrawing = true
                    })
                }

                // Append back button to reset to the previous status
                createBackButton(parentID, iconType)
            }
        }

        // A function to create the selected button
        function createSelectedButton(
            P_ID,
            Inst_Name,
            Inst_ID,
            Icon_Class,
            Icon_Type
        ) {
            // Put the selected button back with different background color
            d3.select('#' + P_ID)
                .append('i')
                .attr('class', Icon_Class)
                .attr('id', Inst_Name + '-geom-' + Icon_Type + '-' + Inst_ID)
                .attr('title', Icon_Type)
                .style('border-color', '#d8850c')
                .style('border-style', 'solid')
                .style('border-width', '1px')
                .style('width', '15%')
                .style('height', '100%')
                .style('margin', '5px')
                .style('background-color', '#5a2702')
                .style('padding', '12px 7px 4px 7px')
                .style('position', 'relative')
                .style('bottom', '4px')
        }

        // A function to create the Back button
        function createBackButton(Parent_ID, Icon_Type) {
            d3.select('#' + Parent_ID)
                .append('button')
                .attr('type', 'button')
                .attr('id', Parent_ID + '-cancel-' + Icon_Type)
                .style('width', '65px')
                .style('height', '34px')
                .style('border-color', '#d8850c')
                .style('border-style', 'solid')
                .style('border-width', '1px')
                .style('margin-left', '10px')
                .style('background-color', '#5a4402')
                .style('text-align', 'center')
                .style('position', 'relative')
                .style('padding', '5px')
                .style('bottom', '8px')
                .text('Back')
        }

        /**
         * This function loads a selected layer on top of the map.
         * The layers can be waypoints, terrain, traverse or etc.
         * @param {*} Parent_ID
         */
        function loadSelectedLayer(Parent_ID, inst_Id) {
            let selectLayer = $('#' + Parent_ID + ' option:selected').text()

            $.ajax({
                url: baseURL + '/layer=' + selectLayer,
                type: 'GET',
                dataType: 'json',
                contentType: 'application/json',
                success: function (S_layer) {
                    if (!S_layer) {
                        console.log('There is no result for the layers!')
                    } else {
                        addLayerToMap('_selected_layer_', 0, S_layer)
                    }
                },
                error: function (xhr, status) {
                    console.log('XHR Object:', xhr, 'Status:', status)
                },
            })
        }

        /**
         * The following function will create a geometry operators
         * component whenever it is called.
         * @param {*} inst_name,item_name,inst_id
         */
        function createGeometryComponent(
            inst_name,
            item_name,
            item_type,
            inst_id
        ) {
            // Addind the name of used instrument to the geom component
            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    'inst-name-' + inst_name + '-' + item_name + '-' + inst_id
                )
                .style('width', '50px')
                .style('height', '20px')
                .style('margin-top', '16px')
                .style('margin-left', '-12px')
                .style('font-size', '12px')
                .style('text-align', 'center')
                .style('background-color', '#5a4402')
                .style('transform', 'rotate(-90deg)')
                .text(inst_name.toUpperCase())

            // Create geom name
            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    'geom-name-' + inst_name + '-' + item_name + '-' + inst_id
                )
                .style('width', '50px')
                .style('margin-left', '-12px')
                .style('margin-top', '5px')
                .style('font-size', '12px')
                .text('Geom')

            // Append spatial operator icons to this div section
            let spatialIcons = [
                { name: 'arrow-expand-vertical', title: 'Elevation range' },
                { name: 'adjust', title: 'Circle buffer' },
                { name: 'vector-line', title: 'Line buffer' },
                { name: 'vector-intersection', title: 'Intersection' },
                { name: 'vector-polygon', title: 'Polygon area' },
                { name: 'vector-rectangle', title: 'Rectangle area' },
            ]

            // Create a group div section to add the geometry operators
            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr('id', inst_name + '-geom-geomIcons-group-' + inst_id)
                .style('width', '356px')
                .style('top', '10px')
                .style('left', '12px')
                .style('position', 'relative')
                .style('padding-top', '7px')

            // Adding the geometry geometry operator icons to the group-div section
            spatialIcons.forEach(function (icon) {
                d3.select('#' + inst_name + '-geom-geomIcons-group-' + inst_id)
                    .append('i')
                    .attr('class', 'mdi mdi-' + icon.name + ' mdi-24px')
                    .attr(
                        'id',
                        inst_name +
                            '-' +
                            icon.name +
                            '-button-' +
                            item_name +
                            '-' +
                            inst_id
                    )
                    .attr('title', icon.title)
                    .style('border-color', '#d8850c')
                    .style('border-style', 'solid')
                    .style('border-width', '1px')
                    .style('margin-top', '2px')
                    .style('width', '15%')
                    .style('height', '100%')
                    .style('margin', '5px')
                    .style('background-color', '#5a4402')
                    .style('padding', '12px 7px 4px 7px')
            })

            // Adding AND/OR operator to the Geom components
            // ========================================= AND/OR sliding switch ====================================
            createAndOrSliderSwitch(inst_name, item_name, item_type, inst_id)

            // Adding the close button to the component
            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    inst_name +
                        '-' +
                        item_name +
                        '-' +
                        item_type +
                        '-remove-button-' +
                        '-' +
                        inst_id
                )
                .style('position', 'relative')
                .style('left', '6px')
                .style('top', '2px')
                .append('i')
                .attr('class', 'mdi mdi-close-circle-outline mdi-22px')
                .attr(
                    'id',
                    inst_name +
                        '-' +
                        item_name +
                        '-' +
                        item_type +
                        '-close-button-' +
                        inst_id
                )
                .style('color', 'red')
        }

        /**
         * A function for creating the sliding switch
         * @param {*} inst_name,item_name,inst_id
         * */
        function createAndOrSliderSwitch(
            inst_name,
            item_name,
            item_type,
            inst_id
        ) {
            // add the "AND" and "OR" checkbox for each selected material
            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    inst_name + '-' + item_name + '-slider-AND-' + inst_id
                )
                .style('width', '30px')
                .style('height', '100%')
                .style('padding-top', '19px')
                .style('padding-left', '3px')
                .text('AND')

            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    inst_name + '-' + item_name + '-slider-ANDOR-' + inst_id
                )
                .style('width', '50px')
                .style('height', '100%')

            d3.select(
                '#' + inst_name + '-' + item_name + '-slider-ANDOR-' + inst_id
            )
                .append('div')
                .attr(
                    'id',
                    inst_name + '-' + item_name + '-slider-switch-' + inst_id
                )
                .attr('class', 'slidecontainer')
                .append('input')
                .attr(
                    'id',
                    inst_name +
                        '-' +
                        item_name +
                        '-slider-switch-input-' +
                        inst_id
                )
                .attr('type', 'range')
                .attr('class', 'slider')
                .attr('min', '0')
                .attr('max', '1')
                .attr('value', '0')
                .style('width', '100%')
                .style('margin', '5px')

            d3.select(
                '#' +
                    inst_name +
                    '-' +
                    item_name +
                    '-' +
                    item_type +
                    '-' +
                    inst_id
            )
                .append('div')
                .attr(
                    'id',
                    inst_name + '-' + item_name + '-slider-OR-' + inst_id
                )
                .style('width', '30px')
                .style('height', '100%')
                .style('padding-top', '19px')
                .style('padding-left', '8px')
                .text('OR')
        }

        /**
         * This part of the code is for scrolling to the left and
         * right of the instruments list.
         * */
        // Implementation of right arrow in instruments list
        $('#queryToolInstList_RightArrow').click(function () {
            event.preventDefault()
            $('#queryToolInstList').animate(
                {
                    scrollLeft: '+=200px',
                },
                'slow'
            )
        })

        // Implementation of right arrow in instruments list
        $('#queryToolInstList_LeftArrow').click(function () {
            event.preventDefault()
            $('#queryToolInstList').animate(
                {
                    scrollLeft: '-=200px',
                },
                'slow'
            )
        })

        /**
         * This part of the code is for scrolling to the left and
         * right of the materials list of any instrument.
         * */
        // Implementation of right arrow in materials list
        $('#queryToolMatList_RightArrow').click(function () {
            event.preventDefault()
            $('#queryToolMatList').animate(
                {
                    scrollLeft: '+=200px',
                },
                'slow'
            )
        })

        // Implementation of right arrow in materials list
        $('#queryToolMatList_LeftArrow').click(function () {
            event.preventDefault()
            $('#queryToolMatList').animate(
                {
                    scrollLeft: '-=200px',
                },
                'slow'
            )
        })

        /**
         * This part of the code keeps track of the run_query, save_query and
         * load_query buttons and whenever any of those buttons is clicked then
         * reads all the information from "queryToolMatInfo" section and sends
         * back this data to the back-end which is the API application with
         * appropriate router method.
         */
        $(document).ready(function () {
            // // Set a flag for running the query tool to make sure all the
            // // required fields are properly filled out.
            let storeQuery = false

            let dataQueryForStore

            // If run query button is clicked
            $('#queryTool_runQuery').click(function () {
                // Set a flag for running the query tool to make sure all the
                // required fields are properly filled out.
                let runQuery = false

                // Get all the components in the queryToolMatInfo section
                let children_0 = $('#queryToolMatInfo').children()
                if (children_0.length === 0) {
                    // This should be a pop-up window showing the following message
                    alert(
                        'The query tool list is empty, there is nothing to run!'
                    )
                } else {
                    let query_data = {
                        parameters: params,
                        components: [],
                        description: '',
                    }
                    // Create a description for the query
                    let queryDesc = ''

                    Array.prototype.forEach.call(children_0, (children_1) => {
                        let parent_id = children_1.id
                        let id_parts = parent_id.split('-')

                        let inst = id_parts[0],
                            item = id_parts[1],
                            item_type = id_parts[2],
                            id = id_parts[3]
                        // Get the and/or inputs
                        let and_or_id =
                            inst + '-' + item + '-slider-switch-input-' + id
                        let AndOrValue =
                            $('#' + and_or_id).val() === '1' ? 'OR' : 'AND'

                        if (item_type === 'g') {
                            // Get the id of the geometry operator
                            let geometryIconID = $(
                                '#' + inst + '-geom-geomIcons-group-' + id
                            )
                                .children('i')
                                .attr('id')
                            let geomOpID = geometryIconID.split('-')
                            let geomOpType = geomOpID[2]

                            // Set appropriate word to elevation operator
                            if (geomOpType === 'vertical')
                                geomOpType = 'elevation'

                            let GeomOpData, elevInput

                            switch (geomOpType) {
                                // Implement the new elevation option here
                                case 'elevation':
                                    elevInput = function () {
                                        // setting lower range and upper range of elevation inputs
                                        let lr = $(
                                            '#elev-left-slider-input-' +
                                                inst +
                                                '-' +
                                                id
                                        ).val()
                                        let ur = $(
                                            '#elev-right-slider-input-' +
                                                inst +
                                                '-' +
                                                id
                                        ).val()
                                        if (lr === '' || ur === '') {
                                            // Set the query run flag to false
                                            runQuery = false
                                            $(
                                                '#elev-left-slider-input-' +
                                                    inst +
                                                    '-' +
                                                    id
                                            ).css('border', '1px solid red')
                                            $(
                                                '#elev-right-slider-input-' +
                                                    inst +
                                                    '-' +
                                                    id
                                            ).css('border', '1px solid red')
                                        } else {
                                            // Set the query run flag to true
                                            runQuery = true
                                            $(
                                                '#elev-left-slider-input-' +
                                                    inst +
                                                    '-' +
                                                    id
                                            ).css('border', 'none')
                                            $(
                                                '#elev-right-slider-input-' +
                                                    inst +
                                                    '-' +
                                                    id
                                            ).css('border', 'none')
                                            return [lr, ur]
                                        }
                                    }

                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'elevation',
                                        and_or: AndOrValue,
                                        input: elevInput(),
                                        // No coordinates for this geometry operator
                                        coordinates: [],
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:elev(' +
                                        elevInput() +
                                        ') ' +
                                        AndOrValue +
                                        ' '

                                    break

                                case 'adjust': // A circle buffer
                                    let radiusInput = function () {
                                        let input = $(
                                            '#' +
                                                inst +
                                                '-geom-geomIcons-group-' +
                                                id +
                                                '-input'
                                        ).val()
                                        if (input === '' || isNaN(input)) {
                                            // Set the query run flag to false
                                            runQuery = false

                                            $(
                                                '#' +
                                                    inst +
                                                    '-geom-geomIcons-group-' +
                                                    id +
                                                    '-input'
                                            ).css('border', '2px solid red')
                                        } else {
                                            // Set the query run flag to true
                                            runQuery = true

                                            $(
                                                '#' +
                                                    inst +
                                                    '-geom-geomIcons-group-' +
                                                    id +
                                                    '-input'
                                            ).css('border', 'none')
                                            return input
                                        }
                                    }

                                    let pointCoords = function () {
                                        // console.log(QueryTool.Draw._radiusPoints);
                                        // console.log(QueryTool.drawingPoly = L_.layers.layer['QueryToolPointBuffer']);
                                        if (
                                            QueryTool.Draw._radiusPoints[0] !==
                                            undefined
                                        ) {
                                            // Set the query run flag to true
                                            runQuery = true
                                            return {
                                                lng: QueryTool.Draw
                                                    ._radiusPoints[0].lng,
                                                lat: QueryTool.Draw
                                                    ._radiusPoints[0].lat,
                                            }
                                        } else {
                                            // Set the query run flag to false
                                            runQuery = false
                                            alert('Locate a point on the map!')
                                        }
                                    }

                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'circle_buffer',
                                        and_or: AndOrValue,
                                        input: radiusInput(), // Circle radius
                                        // coordinates for center of the redius
                                        coordinates: pointCoords(),
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:circleBuff:radius:' +
                                        radiusInput() +
                                        ':center' +
                                        JSON.stringify(pointCoords()) +
                                        ' ' +
                                        AndOrValue +
                                        ' '

                                    break

                                case 'line': // A line buffer
                                    let lineDistInput = function () {
                                        let input = $(
                                            '#' +
                                                inst +
                                                '-geom-geomIcons-group-' +
                                                id +
                                                '-input'
                                        ).val()
                                        if (input === '' || isNaN(input)) {
                                            // Set the query run flag to false
                                            runQuery = false

                                            $(
                                                '#' +
                                                    inst +
                                                    '-geom-geomIcons-group-' +
                                                    id +
                                                    '-input'
                                            ).css('border', '2px solid red')
                                        } else {
                                            // Set the query run flag to true
                                            runQuery = true

                                            $(
                                                '#' +
                                                    inst +
                                                    '-geom-geomIcons-group-' +
                                                    id +
                                                    '-input'
                                            ).css('border', 'none')
                                            return input
                                        }
                                    }

                                    let lineCoords = function () {
                                        if (
                                            QueryTool.drawnLayers[id] !==
                                            undefined
                                        ) {
                                            // Set the query run flag to true
                                            runQuery = true
                                            return QueryTool.Draw.drawingPoly
                                                ._latlngs
                                        } else {
                                            // Set the query run flag to false
                                            runQuery = false
                                            alert('Draw a line on the map!')
                                        }
                                    }

                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'line_buffer',
                                        and_or: AndOrValue,
                                        input: lineDistInput(), // A distance from a the drawn line
                                        // coordinates for the drawn line
                                        coordinates: lineCoords(),
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:lineBuff:dist:' +
                                        lineDistInput() +
                                        ':coords:' +
                                        JSON.stringify(lineCoords()) +
                                        ' ' +
                                        AndOrValue +
                                        ' '

                                    break

                                case 'intersection':
                                    let intersectCoords = function () {
                                        if (
                                            QueryTool.drawnLayers[id] !==
                                            undefined
                                        ) {
                                            // Set the query run flag to true
                                            runQuery = true
                                            return QueryTool.drawnLayers[id][0]
                                        } else {
                                            // Set the query run flag to false
                                            runQuery = false
                                            alert(
                                                'You need to draw a polygon on the map!'
                                            )
                                        }
                                    }

                                    // Get the selected layer for intersection operation
                                    let selectedID =
                                        '#' +
                                        inst +
                                        '-geom-geomIcons-group-' +
                                        id +
                                        '-layer-selection'
                                    let selectLayer = $(
                                        selectedID + ' option:selected'
                                    ).text()
                                    let layerType = $(
                                        selectedID + ' option:selected'
                                    ).val()

                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'intersection',
                                        and_or: AndOrValue,
                                        input: [selectLayer, layerType], // In this case is a selected layer
                                        // coordinates for drawn polygons which in this case is a polygon
                                        coordinates: intersectCoords(),
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:intersect:layer:' +
                                        selectLayer +
                                        ':polygon:coords:' +
                                        intersectCoords() +
                                        ' ' +
                                        AndOrValue +
                                        ' '

                                    break

                                case 'polygon':
                                    let polyCoords = function () {
                                        if (
                                            QueryTool.drawnLayers[id] !==
                                            undefined
                                        ) {
                                            // Set the query run flag to true
                                            runQuery = true
                                            return QueryTool.drawnLayers[id][0]
                                        } else {
                                            // Set the query run flag to false
                                            runQuery = false
                                            alert(
                                                'You need to draw a polygon on the map!'
                                            )
                                        }
                                    }
                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'polygon',
                                        and_or: AndOrValue,
                                        input: '',
                                        // Get coordinates for the selected polygon area
                                        coordinates: polyCoords(),
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:polygon:coords:' +
                                        JSON.stringify(polyCoords()) +
                                        ' ' +
                                        AndOrValue +
                                        ' '

                                    break

                                case 'rectangle':
                                    let recCoords = function () {
                                        if (
                                            QueryTool.drawnLayers[id] !==
                                            undefined
                                        ) {
                                            // Set the query run flag to true
                                            runQuery = true
                                            return QueryTool.drawnLayers[id][0]
                                        } else {
                                            // Set the query run flag to false
                                            runQuery = false
                                            alert(
                                                'You need to draw a rectangle on the map!'
                                            )
                                        }
                                    }
                                    GeomOpData = {
                                        id: id,
                                        instrument: inst,
                                        comp_type: 'G',
                                        item: item,
                                        geomOp: 'rectangle',
                                        and_or: AndOrValue,
                                        input: '',
                                        // Get coordinates for the selected rectangle area
                                        coordinates: recCoords(), // Coordinates are requ
                                    }

                                    queryDesc +=
                                        inst.toUpperCase() +
                                        ':geom:rectangle:coords:' +
                                        JSON.stringify(recCoords()) +
                                        ' ' +
                                        AndOrValue +
                                        ' '

                                    break

                                default:
                                    // Set the query run flag to false
                                    runQuery = false
                                    alert(
                                        'You have not selected any geometry operation for componet: ' +
                                            id
                                    )
                                    break
                            }
                            query_data.components.push(GeomOpData)
                        } else if (item_type === 's') {
                            let strInput = function () {
                                let input = $(
                                    '#' +
                                        inst +
                                        '-' +
                                        item +
                                        '-mat_inputs-' +
                                        id
                                ).val()

                                if (input === '' || input === undefined) {
                                    // Set the query run flag to false
                                    runQuery = false
                                    $(
                                        '#' +
                                            inst +
                                            '-' +
                                            item +
                                            '-mat_inputs-' +
                                            id
                                    ).css('border', '1px solid red')
                                } else {
                                    // Set the query run flag to true
                                    runQuery = true
                                    $(
                                        '#' +
                                            inst +
                                            '-' +
                                            item +
                                            '-mat_inputs-' +
                                            id
                                    ).css('border', 'none')
                                    return input
                                }
                            }

                            query_data.components.push({
                                id: id,
                                instrument: inst,
                                comp_type: 'S',
                                item: item,
                                geomOp: '',
                                and_or: AndOrValue,
                                // Get the selected area
                                input: strInput(),
                                coordinates: [],
                            })

                            queryDesc +=
                                inst.toUpperCase() +
                                ':parameter:' +
                                item +
                                ':' +
                                strInput() +
                                ' ' +
                                AndOrValue +
                                ' '
                        } else {
                            let sliderInputRange = function () {
                                // setting lower range and upper range of inputs
                                let lr = $(
                                    '#left-slider-input-' + item + '-' + id
                                ).val()
                                let ur = $(
                                    '#right-slider-input-' + item + '-' + id
                                ).val()
                                if (lr === '' || ur === '') {
                                    // Set the query run flag to false
                                    runQuery = false
                                    $(
                                        '#left-slider-input-' + item + '-' + id
                                    ).css('border', '1px solid red')
                                    $(
                                        '#right-slider-input-' + item + '-' + id
                                    ).css('border', '1px solid red')
                                } else {
                                    // Set the query run flag to true
                                    runQuery = true
                                    $(
                                        '#left-slider-input-' + item + '-' + id
                                    ).css('border', 'none')
                                    $(
                                        '#right-slider-input-' + item + '-' + id
                                    ).css('border', 'none')
                                    return [lr, ur]
                                }
                            }

                            query_data.components.push({
                                id: id,
                                instrument: inst,
                                comp_type: 'N',
                                item: item,
                                geomOp: '',
                                and_or: AndOrValue,
                                // Get the selected area
                                input: sliderInputRange(),
                                coordinates: [],
                            })

                            queryDesc +=
                                inst.toUpperCase() +
                                ':parameter:' +
                                item +
                                '(' +
                                sliderInputRange() +
                                ') ' +
                                AndOrValue +
                                ' '
                        }
                    })

                    // Removing the last AND/OR word from the end of the string
                    let lastWordIndex =
                        queryDesc.lastIndexOf('OR') === queryDesc.length - 3
                            ? queryDesc.length - 3
                            : queryDesc.length - 4
                    query_data.description = queryDesc.substring(
                        0,
                        lastWordIndex
                    )

                    // if everything is fine then send the query data back to the API application
                    if (runQuery === true) {
                        // console.log("Run query is true!");
                        let op = 'run'
                        let Qname = 'none'
                        // Create a POST request and see how it works in case of posting JSON
                        // object and SQL injection possibility
                        $.ajax({
                            url:
                                baseURL +
                                'uid=' +
                                userId +
                                '/tkn=' +
                                token +
                                '/final_query_submit/op=' +
                                op +
                                '/q_name=' +
                                Qname,
                            type: 'POST',
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify(query_data),
                            success: function (finalResult) {
                                if (
                                    L_.addedfiles.hasOwnProperty(
                                        '_QueryToolResult'
                                    ) &&
                                    L_.addedfiles[
                                        '_QueryToolResult'
                                    ].hasOwnProperty(0)
                                ) {
                                    Map_.map.removeLayer(
                                        L_.addedfiles['_QueryToolResult'][0]
                                    )
                                }

                                if (!finalResult.features) {
                                    CursorInfo.update(
                                        'No results found for this search.',
                                        3000,
                                        true
                                    )
                                } else {
                                    // Set the storeQuery to true for saving the query on the database
                                    storeQuery = true
                                    runQuery = false
                                    dataQueryForStore = query_data
                                    addLayerToMap(
                                        '_QueryToolResult',
                                        0,
                                        finalResult
                                    )
                                }
                                QueryTool.finalResult = finalResult
                            },
                            error: function (xhr, status) {
                                console.log(
                                    'XHR Object:',
                                    xhr,
                                    'Status:',
                                    status
                                )
                            },
                        })
                    }
                    // Otherwise warn the user about issues
                    else {
                        alert('Oops!, the query tool is not ready yet!')
                    }
                }
            })

            // If save qury button is clicked
            $('#queryTool_saveQuery').on('click', (event) => {
                let idParts = event.target.id.split('_')

                let op = 'save'
                if (storeQuery === false) {
                    alert(
                        'Please first run the tool to see if there is result for this query, then save the query.'
                    )
                }

                // Save the executed query
                if (idParts.indexOf('save') > -1 && storeQuery === true) {
                    // Check if there is a defined name for this query
                    let query_name = $('#queryTool_saveQuery_input_name').val()

                    if (query_name === '') {
                        CursorInfo.update(
                            'Enter a name for this query',
                            3000,
                            true
                        )
                        $('#queryTool_saveQuery_input_name').css(
                            'border',
                            '2px solid red'
                        )
                    } else {
                        $('#queryTool_saveQuery_input_name').css(
                            'border',
                            'none'
                        )

                        $.ajax({
                            url:
                                baseURL +
                                'uid=' +
                                userId +
                                '/tkn=' +
                                token +
                                '/final_query_submit/op=' +
                                op +
                                '/q_name=' +
                                query_name,
                            type: 'POST',
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify(dataQueryForStore),
                            success: function (data) {
                                if (data === true) {
                                    // Set to initial status
                                    storeQuery = false
                                    alert('Succesfully saved the query!!!')
                                    loadQueryNames()
                                }
                            },
                            error: function (xhr, status) {
                                console.log(
                                    'XHR Object:',
                                    xhr,
                                    'Status:',
                                    status
                                )
                            },
                        })
                    }
                }
            })
        })

        // Save_query div section
        d3.select('#queryTool_saveQuery')
            .style('margin-top', '0px')
            .style('margin-left', '-2px')
            .style('width', '200px')
            .style('height', '30px')
            .style('color', 'white')
            .style('font-size', '12px')
            .style('padding', '6px')
            .style('background-color', '#111')
            .style('border', '1px solid #666')
            .text('Save query:')

        d3.select('#queryTool_saveQuery')
            .append('div')
            .attr('id', 'queryTool_saveQuery_div_input_name')
            .style('width', '100px')
            .style('height', '20px')
            .style('margin-top', '-21px')
            .style('margin-left', '63px')

        d3.select('#queryTool_saveQuery_div_input_name')
            .append('input')
            .attr('id', 'queryTool_saveQuery_input_name')
            .style('border', 'none')
            .style('background-color', '#666')
            .style('padding', '4px')
            .style('width', '100%')
            .style('height', '100%')

        d3.select('#queryTool_saveQuery_div_input_name')
            .append('div')
            .style('margin-top', '-20px')
            .style('margin-left', '100px')
            .style('color', '#999')
            .style('width', '25px')
            .style('height', '100%')
            .style('padding', '1px')
            .append('i')
            .attr('class', 'mdi mdi-content-save-outline mdi-24px')
            .attr('title', 'Save query')
            .attr('id', 'queryTool_saveQuery_save_button')
            .style('width', '100%')
            .style('height', '100%')

        // Load_query div section
        d3.select('#queryTool_loadQuery')
            .style('margin-top', '0px')
            .style('background-color', '#111')
            .style('border', '1px solid #666')
            .style('width', '180px')
            .style('height', '30px')
            .style('color', 'white')
            .style('font-size', '12px')
            .style('padding', '6px')
            .style('background-color', '#111')
            .style('border', '1px solid #666')
            .text('Load query:')

        d3.select('#queryTool_loadQuery')
            .append('div')
            .attr('id', 'queryTool_loadQuery_div_select_name')
            .style('width', '80px')
            .style('height', '20px')
            .style('margin-top', '-21px')
            .style('margin-left', '65px')

        loadQueryNames()
    } else {
        alert(' Not a valid user! ')
        console.log('There is no user with this credential!')
    }

    function loadQueryNames() {
        // First remove the select section
        $('#queryTool_loadQuery_div_select_name *').remove()

        // A ajax call to get all the query name that are associated with this user
        $.ajax({
            url:
                baseURL +
                'uid=' +
                userId +
                '/tkn=' +
                token +
                '/get_query_names/',
            type: 'GET',
            dataType: 'json',
            contentType: 'application/json',
            success: function (data) {
                if (data.length !== 0) {
                    d3.select('#queryTool_loadQuery_div_select_name')
                        .append('select')
                        .attr('id', 'queryTool_loadQuery_select_name')
                        .attr('title', 'Select a query')
                        .style('border-style', 'solid')
                        .style('background-color', '#666')
                        .style('padding', '4px')
                        .style('width', '100%')
                        .style('height', '100%')
                        .selectAll('option')
                        .data(data)
                        .enter()
                        .append('option')
                        .attr('value', function (d) {
                            return d.id
                        })
                        .text(function (d) {
                            return d.name
                        })

                    d3.select('#queryTool_loadQuery_div_select_name')
                        .append('div')
                        .style('margin-top', '-20px')
                        .style('margin-left', '80px')
                        .style('color', '#999')
                        .style('width', '25px')
                        .style('height', '100%')
                        .style('padding', '1px')
                        .append('i')
                        .attr('class', 'mdi mdi-download mdi-24px')
                        .attr('id', 'queryTool_loadQuery_load_button')
                        .attr('title', 'Load a query')
                        .style('width', '100%')
                        .style('height', '100%')
                } else {
                    d3.select('#queryTool_loadQuery_div_select_name')
                        .append('div')
                        .style('width', '90px')
                        .style('margin-top', '2px')
                        .style('margin-left', '8px')
                        .append('blink')
                        .style('color', 'red')
                        .text('No name found!')
                }
            },
            error: function (xhr, status) {
                console.log('XHR Object:', xhr, 'Status:', status)
            },
        })
    }

    // A function to load a selected query and create the load section
    $('#queryTool_loadQuery').click((event) => {
        let sec = event.target.id.split('_')

        if (sec.indexOf('load') > -1) {
            // Clean up the queryToolMatInfo div section
            $('#queryToolMatInfo *').remove()

            // Now load the selected query from database
            let selectQuery_id = $(
                '#queryTool_loadQuery_select_name option:selected'
            ).val()

            d3.select('#queryToolMatInfo')
                .append('div')
                .attr('id', 'loadedQueries')
                .style('width', '100%')
                .style('height', '100%')

            d3.select('#loadedQueries')
                .append('div')
                .attr('id', 'loadQuery-load-' + selectQuery_id)
                .style('width', '100%')
                .style('height', '100%')
                .style('background-color', '#030215')
                .style('border', '1px solid #0c3534')

            // Add close button to this div section ==================================================================
            d3.select('#loadQuery-load-' + selectQuery_id)
                .append('div')
                .attr('id', 'loadQuery-load-' + selectQuery_id + '-close-')
                .style('position', 'relative')
                .style('left', '547px')
                .style('width', '15px')
                .style('height', '15px')
                .style('margin', '2px')
                .append('i')
                .attr('class', 'mdi mdi-close-circle-outline mdi-22px')
                .attr(
                    'id',
                    'loadQuery-load-' + selectQuery_id + '-close-button'
                )
                .style('color', 'red')

            // An Ajax call; Get the query from database and create the info section for the query
            $.ajax({
                url:
                    baseURL +
                    'uid=' +
                    userId +
                    '/tkn=' +
                    token +
                    '/get_query/qid=' +
                    selectQuery_id,
                type: 'GET',
                dataType: 'json',
                contentType: 'application/json',
                success: function (data) {
                    d3.select('#loadQuery-load-' + selectQuery_id)
                        .append('div')
                        .attr('id', 'loadQuery-queryInfo-' + selectQuery_id)
                        .style('margin-left', '5px')
                        .style('margin-top', '-15px')
                        .style('padding', '5px')
                        .style('background-color', '#030215')
                        .style('width', '557px')
                        .style('height', '30px')
                        .style('border-bottom', '1px solid #b36b00')
                        .style('text-align', 'center')
                        .style('color', '#666')
                        .append('span')
                        .style('margin-left', '5px')
                        .text('Query Name: ' + data.name)
                        .append('span')
                        .style('margin-left', '20px')
                        .text(
                            ' Saved On: ' +
                                data.executed_on.substring(
                                    0,
                                    data.executed_on.indexOf('T')
                                )
                        )

                    let didWhile = false
                    let descriptionLength
                    let endIndex
                    let div
                    let subid = 0
                    while (
                        data.description.indexOf('polygon') > -1 ||
                        data.description.indexOf('rectangle') > -1 ||
                        data.description.indexOf('line') > -1
                    ) {
                        didWhile = true

                        let isExpanded = false
                        descriptionLength = data.description.length

                        let startIndex = data.description.indexOf('[') + 1
                        endIndex = data.description.substr(1).indexOf(']') + 1

                        let coordsStr = data.description.substring(
                            startIndex,
                            endIndex
                        )

                        coordsStr = JSON.stringify(
                            JSON.parse('[' + coordsStr + ']').map(function (v) {
                                return {
                                    lat: v.lat.toFixed(8),
                                    lng: v.lng.toFixed(8),
                                }
                            })
                        )
                            .substr(1)
                            .slice(0, -1)

                        if (!div) {
                            div = d3
                                .select('#loadQuery-load-' + selectQuery_id)
                                .append('div')
                                .attr(
                                    'id',
                                    'loadQuery-queryText-' + selectQuery_id
                                )
                                .attr('class', 'mmgisScrollbar')
                                .style('margin-left', '5px')
                                .style('margin-top', '5px')
                                .style('width', '557px')
                                .style('height', '115px')
                                .style('padding', '5px')
                                .style('background-color', '#030215')
                                .style('border', '1px solid #b36b00')
                                .style('overflow', 'auto')
                                .style('font-size', '12px')
                                .style(
                                    'font-family',
                                    '"Lucida Console", Monaco, monospace'
                                )
                        }
                        div.append('span').text(
                            data.description.substring(0, startIndex)
                        )

                        div.append('span')
                            .attr(
                                'id',
                                'loadQuery-queryText-expandCoords-' +
                                    selectQuery_id +
                                    '-' +
                                    subid
                            )
                            .text(' + ')
                            .on('mouseover', function () {
                                d3.select(this).style('cursor', 'pointer')
                            })
                            .on(
                                'click',
                                (function (subid) {
                                    return function () {
                                        if (isExpanded === false) {
                                            d3.select(
                                                '#loadQuery-queryText-expandCoords-' +
                                                    selectQuery_id +
                                                    '-' +
                                                    subid
                                            ).text(' - ')

                                            d3.select(
                                                '#loadQuery-queryText-expandCoords-' +
                                                    selectQuery_id +
                                                    '-' +
                                                    subid
                                            )
                                                .append('div')
                                                .style(
                                                    'border-left',
                                                    '1px solid #b36b00'
                                                )
                                                .style('margin-left', '35px')
                                                .style('margin-top', '5px')
                                                .style('padding-left', '10px')
                                                .text(coordsStr)
                                            isExpanded = true
                                        } else {
                                            isExpanded = false
                                            $(
                                                '#loadQuery-queryText-expandCoords-' +
                                                    selectQuery_id +
                                                    '-' +
                                                    subid +
                                                    ' *'
                                            ).remove()
                                            d3.select(
                                                '#loadQuery-queryText-expandCoords-' +
                                                    selectQuery_id +
                                                    '-' +
                                                    subid
                                            ).text(' + ')
                                        }
                                    }
                                })(subid)
                            )
                        data.description = data.description.substring(
                            endIndex,
                            descriptionLength
                        )

                        subid += 1
                    }
                    if (didWhile) {
                        d3.select('#loadQuery-queryText-' + selectQuery_id)
                            .append('span')
                            .text(
                                ']' +
                                    data.description.substring(
                                        endIndex,
                                        descriptionLength
                                    )
                            )
                    } else {
                        d3.select('#loadQuery-load-' + selectQuery_id)
                            .append('div')
                            .attr('id', 'loadQuery-queryText-' + selectQuery_id)
                            .attr('class', 'mmgisScrollbar')
                            .style('margin-left', '5px')
                            .style('margin-top', '5px')
                            .style('width', '557px')
                            .style('height', '115px')
                            .style('padding', '5px')
                            .style('background-color', '#030215')
                            .style('border', '1px solid #b36b00')
                            .style('overflow', 'auto')
                            .style('font-size', '12px')
                            .style(
                                'font-family',
                                '"Lucida Console", Monaco, monospace'
                            )
                            .text(data.description)
                    }

                    d3.select('#loadQuery-load-' + selectQuery_id)
                        .append('div')
                        .attr('id', 'loadQuery-queryExe-' + selectQuery_id)
                        .style('margin-left', '5px')
                        .style('margin-top', '4px')
                        .style('padding', '5px')
                        .style('background-color', '#231717')
                        .style('width', '557px')
                        .style('height', '35px')
                        .style('border', '1px solid #b36b00')

                    d3.select('#loadQuery-queryExe-' + selectQuery_id)
                        .append('div')
                        .attr(
                            'id',
                            '#loadQuery-queryExe-' +
                                selectQuery_id +
                                '-runQuery'
                        )
                        .style('width', '90px')
                        .style('height', '25px')
                        .style('margin-top', '-1px')
                        .style('margin-left', '456px')
                        .style('padding', '2px')
                        .style('font-size', '13px')
                        .style('text-align', 'center')
                        .style('border', '1px solid #d8850c')
                        .style('background-color', '#5a4402')
                        .text('Run Query')
                        .on('mouseover', function () {
                            d3.select(this).style('cursor', 'pointer')
                        })
                        .on('click', function () {
                            // Remove drawn layer if exists
                            if (QueryTool.Draw.drawingPoly !== undefined) {
                                Map_.map.removeLayer(QueryTool.Draw.drawingPoly)
                            }

                            $.ajax({
                                url:
                                    baseURL +
                                    'uid=' +
                                    userId +
                                    '/tkn=' +
                                    token +
                                    '/run_loaded_query',
                                type: 'POST',
                                dataType: 'json',
                                contentType: 'application/json',
                                data: JSON.stringify({ query: data.query }),
                                success: function (data) {
                                    addLayerToMap('_QueryToolResult', 0, data)
                                    QueryTool.finalResult = data
                                },
                                error: function (xhr, status) {
                                    console.log(
                                        'XHR Object:',
                                        xhr,
                                        'Status:',
                                        status
                                    )
                                },
                            })
                        })

                    d3.select('#loadQuery-queryExe-' + selectQuery_id)
                        .append('div')
                        .attr(
                            'id',
                            '#loadQuery-queryExe-' +
                                selectQuery_id +
                                '-deleteQuery'
                        )
                        .style('width', '90px')
                        .style('height', '25px')
                        .style('margin-top', '-25px')
                        .style('padding', '2px')
                        .style('color', '#ff5e00')
                        .style('text-align', 'center')
                        .style('border', '1px solid #d8850c')
                        .style('background-color', '#5a4402')
                        .text('Delete Query')
                        .on('mouseover', function () {
                            d3.select(this).style('cursor', 'pointer')
                        })
                        .on('click', function () {
                            $.ajax({
                                url:
                                    baseURL +
                                    'uid=' +
                                    userId +
                                    '/tkn=' +
                                    token +
                                    '/rmq/id=' +
                                    selectQuery_id,
                                type: 'GET',
                                dataType: 'json',
                                contentType: 'application/json',
                                success: function () {
                                    alert('The query is removed from database!')
                                    $(
                                        '#loadQuery-load-' + selectQuery_id
                                    ).remove()
                                    loadQueryNames()
                                },
                                error: function (xhr, status) {
                                    console.log(
                                        'XHR Object:',
                                        xhr,
                                        'Status:',
                                        status
                                    )
                                },
                            })
                        })
                },
                error: function (xhr, status) {
                    console.log('XHR Object:', xhr, 'Status:', status)
                },
            })
        }
    })
}

//This function basically adds a layer to the map
function addLayerToMap(name, id, geojson) {
    if (
        L_.addedfiles.hasOwnProperty(name) &&
        L_.addedfiles[name].hasOwnProperty(id)
    ) {
        Map_.map.removeLayer(L_.addedfiles[name][id])
    }

    if (!L_.addedfiles.hasOwnProperty(name)) L_.addedfiles[name] = []
    L_.addedfiles[name][id] = L.geoJson(geojson, {
        style: function (feature) {
            var props = feature.properties
            if (!props) props = {}

            return {
                color: 'yellow',
                radius: 6,
                opacity: props.opacity || 1,
                fillColor: props.fill || 'yellow',
                fillOpacity: props.fillOpacity || 1,
                color: props.stroke || 'crimson',
                weight: props.weight || 2,
                pointerEvents: null,
            }
        },
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng)
        },
        onEachFeature: function (feature, layer) {
            var props = feature.properties
            if (!props) props = {}

            var list = JSON.stringify(props)
            layer.bindPopup('Target Name: ' + props.target_plan)
        },
    })
    L_.addedfiles[name][id].addTo(Map_.map)
}

export default QueryTool
