import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import calls from '../../../pre/calls'

import metricsGraphics from '../../../external/MetricsGraphics/metricsgraphics.min'

import ReactDOM from 'react-dom'
import React, { useState, useEffect, useRef } from 'react'

import { Line } from 'react-chartjs-2'
import * as zoom from 'chartjs-plugin-zoom'

import './MeasureTool.css'

// Hacky solution to exposing setState externally
let updateProfileData = function () {}
let toolLayer = []
let measureToolLayer = null
let clickedLatLngs = []
let distLineToMouse = null
let distMousePoint = null
let mode = 'segment'
let steps = 100
let profileData = []
let elevPoints = []
let profileDivId = 'measureToolProfile'
let rAm = 100 //roundAmount

const Measure = () => {
    const [profileData, setProfileData] = useState([])
    const refLine = useRef(null)

    useEffect(() => {
        updateProfileData = setProfileData
        // code to run on component mount
        Map_.map
            .on('click', MeasureTool.clickMap)
            .on('mousemove', MeasureTool.moveMap)
            .on('mouseout', MeasureTool.mouseOutMap)
        Globe_.globe
            .on('click', MeasureTool.clickGlobe)
            .on('mousemove', MeasureTool.moveGlobe)

        Viewer_.imageViewerMap.addHandler(
            'canvas-click',
            MeasureTool.clickViewer
        )
        Viewer_.imageViewer.style('cursor', 'default')
    }, [])

    return (
        <div className='MeasureTool'>
            <div id='measureLeft'>
                <div id='measureTop'>
                    <div id='measureTitle'>Measure</div>
                    <div id='measureIcons'>
                        <div
                            id='measureUndo'
                            title='Undo'
                            onClick={MeasureTool.undo}
                        >
                            <i className='mdi mdi-undo mdi-18px'></i>
                        </div>
                        <div
                            id='measureReset'
                            title='Reset'
                            onClick={MeasureTool.reset}
                        >
                            <i className='mdi mdi-refresh mdi-18px'></i>
                        </div>
                    </div>
                </div>
                <div id='measureMode'>
                    <div>Mode</div>
                    <select
                        className='dropdown'
                        defaultValue='segment'
                        onChange={MeasureTool.changeMode}
                    >
                        <option value='segment'>Segment</option>
                        <option value='continuous'>Continuous</option>
                    </select>
                </div>
                <div id='measureSamples'>
                    <div>Samples</div>
                    <select
                        className='dropdown'
                        defaultValue='100'
                        onChange={MeasureTool.changeSamples}
                    >
                        <option value='100'>100</option>
                        <option value='250'>250</option>
                        <option value='500'>500</option>
                        <option value='1000'>1000</option>
                        <option value='2000'>2000</option>
                    </select>
                </div>
            </div>
            <div id='measureGraph'>
                <Line
                    ref={refLine}
                    data={{
                        labels: MeasureTool.lastData.map((d) =>
                            parseInt(d[2], 10)
                        ),
                        //Array.from(Array(profileData.length).keys()),
                        datasets: [
                            {
                                label: 'Profile',
                                data: profileData,
                                backgroundColor: ['rgba(255, 90, 119, 0.2)'],
                                borderColor: ['rgba(255, 90, 119, 1)'],
                                borderWidth: 1,
                                fill: 'start',
                                pointRadius: 6,
                                pointHitRadius: 8,
                                pointBackgroundColor: 'rgba(0,0,0,0)',
                                pointBorderColor: 'rgba(0,0,0,0)',
                                pointHoverBackgroundColor: 'yellow',
                                pointHoverBorderColor: '#1f1f1f',
                            },
                        ],
                    }}
                    height={150}
                    options={{
                        maintainAspectRatio: false,
                        legend: {
                            display: false,
                        },
                        layout: {
                            padding: {
                                top: 16,
                                left: 4,
                                right: 4,
                                bottom: 0,
                            },
                        },
                        scales: {
                            yAxes: [
                                {
                                    gridLines: {
                                        color: 'rgba(255,255,255,0.05)',
                                    },
                                    ticks: {
                                        callback: function (
                                            value,
                                            index,
                                            values
                                        ) {
                                            return `${value}m`
                                        },
                                        lineHeight: 1.5,
                                    },
                                },
                            ],
                        },
                        tooltips: {
                            intersect: false,
                            mode: 'nearest',
                            titleAlign: 'center',
                            bodyAlign: 'center',
                            footerAlign: 'center',
                            callbacks: {
                                label: (item) => `${item.yLabel}m`,
                                title: (item) =>
                                    `${item[0].xLabel}m from start`,
                            },
                        },
                        onHover: (e, el) => {
                            if (el[0]) {
                                const d = MeasureTool.lastData[el[0]._index]
                                MeasureTool.makeFocusPoint(d[1], d[0], d[3])
                            }
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                        },
                        zoom: {
                            enabled: true,
                            mode: 'x',
                            speed: 1 / steps,
                            threshold: 0,
                            sensitivity: 0,
                        },
                    }}
                />
            </div>
            <div id='measureToolBar'>
                <div
                    id='measureReset'
                    title='Reset Graph'
                    onClick={() => {
                        if (refLine) refLine.current.chartInstance.resetZoom()
                    }}
                >
                    <i className='mdi mdi-restore mdi-18px'></i>
                </div>
                <div
                    id='measureDownload'
                    title='Download'
                    onClick={MeasureTool.download}
                >
                    <i className='mdi mdi-download mdi-18px'></i>
                </div>
            </div>
        </div>
    )
}

let MeasureTool = {
    height: 150,
    width: 'full',
    disableLayerInteractions: true,
    vars: {},
    lastData: [],
    mapFocusMarker: null,
    init: function () {},
    make: function () {
        //Get tool variables
        this.vars = L_.getToolVars('measure')

        ReactDOM.render(<Measure />, document.getElementById('tools'))
    },
    destroy: function () {
        ReactDOM.unmountComponentAtNode(document.getElementById('tools'))

        Map_.map
            .off('click', MeasureTool.clickMap)
            .off('mousemove', MeasureTool.moveMap)
            .off('mouseout', MeasureTool.mouseOutMap)

        Globe_.globe
            .off('click', MeasureTool.clickGlobe)
            .off('mousemove', MeasureTool.moveGlobe)

        Viewer_.imageViewerMap.removeHandler(
            'canvas-click',
            MeasureTool.clickViewer
        )
        $('#map').css({ cursor: 'grab' })
        Viewer_.imageViewer.style('cursor', 'map')

        Map_.rmNotNull(distLineToMouse)
        Map_.rmNotNull(distMousePoint)
        Map_.rmNotNull(measureToolLayer)

        Globe_.removeVectorLayer('measure')
        Globe_.removeVectorLayer('MeasureToolGlobeFocusMarker')

        CursorInfo.hide()

        MeasureTool.clearFocusPoint()
    },
    clickMap: function (e) {
        if (mode === 'segment' && clickedLatLngs.length >= 2)
            clickedLatLngs = []

        var xy = { x: e.latlng.lat, y: e.latlng.lng }
        clickedLatLngs.push(xy)

        makeMeasureToolLayer()
        makeProfile()
    },
    moveMap: function (e) {
        if (mode === 'continuous') makeGhostLine(e.latlng.lng, e.latlng.lat)
    },
    mouseOutMap: function (e) {
        if (distLineToMouse != null) {
            Map_.map.removeLayer(distLineToMouse)
            distLineToMouse = null
        }
        if (distMousePoint != null) {
            Map_.map.removeLayer(distMousePoint)
            distMousePoint = null
        }
        CursorInfo.hide()
    },
    clickGlobe: function (e) {
        if (mode === 'segment' && clickedLatLngs.length >= 2)
            clickedLatLngs = []

        var xy = { x: Globe_.mouseLngLat.Lat, y: Globe_.mouseLngLat.Lng }
        clickedLatLngs.push(xy)

        makeMeasureToolLayer()
        makeProfile()
    },
    moveGlobe: function (e) {
        if (
            mode === 'continuous' &&
            Globe_.mouseLngLat.Lng != null &&
            Globe_.mouseLngLat.Lat != null
        ) {
            makeGhostLine(Globe_.mouseLngLat.Lng, Globe_.mouseLngLat.Lat)
        }
    },
    clickViewer: function (e) {
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
    },
    makeFocusPoint(lng, lat, z) {
        MeasureTool.clearFocusPoint()
        MeasureTool.mapFocusMarker = new L.circleMarker([lat, lng], {
            fillColor: 'yellow',
            fillOpacity: 1,
            color: '#0f0f0f',
            weight: 2,
        })
            .setRadius(6)
            .addTo(Map_.map)
        Globe_.addVectorLayer(
            {
                name: 'MeasureToolGlobeFocusMarker',
                id: 'MeasureToolGlobeFocusMarker',
                on: true,
                style: {
                    fillColor: 'yellow',
                    color: '#000',
                },
                geometry: [[lat, lng, z]],
            },
            1
        )
    },
    clearFocusPoint() {
        Map_.rmNotNull(MeasureTool.mapFocusMarker)
    },
    undo: function (e) {
        clickedLatLngs.pop()
        if (profileData.length - steps >= 0)
            profileData = profileData.slice(0, profileData.length - steps)
        //0 -> 0, 1 -> 0, 2 -> 1, 3 -> 2, 4 -> 3
        try {
        } catch (e) {}

        makeMeasureToolLayer()
        Globe_.removeVectorLayer('measure')
        Globe_.removeVectorLayer('measurePoint')

        MeasureTool.clearFocusPoint()

        makeProfile()
    },
    reset: function () {
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

        MeasureTool.clearFocusPoint()

        updateProfileData([])
    },
    changeMode: function (e) {
        MeasureTool.reset()
        mode = e.target.value || 'segment'
    },
    changeSamples: function (e) {
        steps = parseInt(e.target.value, 10) || 100
        makeProfile()
    },
    download: function (e) {
        F_.downloadArrayAsCSV(
            ['latitude', 'longitude', 'distance', 'elevation'],
            MeasureTool.lastData,
            'profiledata'
        )
    },
}

function makeMeasureToolLayer() {
    Map_.rmNotNull(measureToolLayer)

    var pointsAndPathArr = []
    var polylinePoints = []
    var temp
    for (var i = 0; i < clickedLatLngs.length; i++) {
        temp = new L.circleMarker([clickedLatLngs[i].x, clickedLatLngs[i].y], {
            fillColor: i == 0 ? 'lime' : 'black',
            fillOpacity: 1,
            color: i == 0 ? 'black' : 'white',
            weight: 2,
        }).setRadius(i == 0 ? 6 : 4)
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
    pointsAndPathArr.unshift(
        new L.Polyline(polylinePoints, { color: '#ff3333', weight: 4 })
    )
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
            success: function (data) {
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

                for (let i = 0; i < MeasureTool.lastData.length; i++) {
                    let distance = 0
                    if (i > 0 && i < MeasureTool.lastData.length) {
                        distance = F_.lngLatDistBetween(
                            MeasureTool.lastData[i][1],
                            MeasureTool.lastData[i][0],
                            MeasureTool.lastData[0][1],
                            MeasureTool.lastData[0][0]
                        )
                        if (F_.dam) distance = F_.metersToDegrees(distance)
                    }
                    MeasureTool.lastData[i].splice(2, 0, distance)
                }

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

                updateProfileData(profileData)

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
        success: function (data) {
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
                xax_format: function (d) {
                    return d + ' nm'
                },
                y_label: 'I/F',
                x_accessor: 'Wavelength',
                y_accessor: 'Value',
            })
            //ugly hack to reopen chart path
            $('.mg-main-line').each(function (idx) {
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
                (totalDistToIndex(clickedLatLngs.length) + roundedDist) * rAm
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
                scaleLat = d3
                    .scaleLinear()
                    .domain([segmentLengths[j], segmentLengths[j + 1]])
                    .range([pts[j][0].x, pts[j][1].x])
                scaleLng = d3
                    .scaleLinear()
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

MeasureTool.init()

export default MeasureTool
