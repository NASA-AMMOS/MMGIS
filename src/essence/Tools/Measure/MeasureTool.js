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

import { render, unmountComponentAtNode } from 'react-dom'
import React, { useState, useEffect, useRef } from 'react'

import { Chart } from 'chart.js'
import { Line } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import * as moment from 'moment'

import './MeasureTool.css'

// Zoom isn't working nicely. Keep off
//Chart.register(zoomPlugin)

// Hacky solution to exposing setState externally
let updateProfileData = function () {}
let triggerRefresh = function () {}

let measureToolLayer = null
let clickedLatLngs = []
let distLineToMouse = null
let distMousePoint = null
let distDisplayUnit = 'meters'
const availableModes = ['segment', 'continuous', 'continuous_color']
let mode = 'segment'
let steps = 100
const LOS = {
    on: false,
    observerHeight: 2,
    targetHeight: 0,
}
let profileData = []
let elevPoints = []
let profileDivId = 'measureToolProfile'
let rAm = 100 //roundAmount
let globeMouseDownXY = {}
let _refreshCounter = 0
let _observerXY = { x: 0, y: 0, index: 0 }

const Measure = () => {
    const [profileData, setProfileData] = useState([])
    const [refresh, setRefresh] = useState(_refreshCounter)
    const refLine = useRef(null)

    useEffect(() => {
        updateProfileData = (d) => {
            MeasureTool.uniformData = uniform(d)
            setProfileData(d)
        }
        triggerRefresh = () => {
            _refreshCounter += 1
            setRefresh(_refreshCounter)
        }
        // code to run on component mount
        Map_.map
            .on('click', MeasureTool.clickMap)
            .on('mousemove', MeasureTool.moveMap)
            .on('mouseout', MeasureTool.mouseOutMap)

        if (L_.hasGlobe) {
            const globeCont = Globe_.litho.getContainer()
            globeCont.addEventListener(
                'mousedown',
                MeasureTool.mouseDownGlobe,
                false
            )
            globeCont.addEventListener('mouseup', MeasureTool.clickGlobe, false)
            globeCont.addEventListener(
                'mousemove',
                MeasureTool.moveGlobe,
                false
            )
            globeCont.addEventListener(
                'mouseout',
                MeasureTool.mouseOutMap,
                false
            )
        }

        Viewer_.imageViewerMap.addHandler(
            'canvas-click',
            MeasureTool.clickViewer
        )
        Viewer_.imageViewer.style('cursor', 'default')
    }, [])

    useEffect(() => {
        // Set observer dot
        if (refLine && LOS.on && profileData.length > 0) {
            const chartArea = refLine.current.chartArea
            const yScale = refLine.current.scales.y
            _observerXY.x = _observerXY.x || chartArea.left
            _observerXY.y = F_.linearScale(
                [yScale.min, yScale.max],
                [chartArea.bottom, chartArea.top],
                profileData[_observerXY.index] + LOS.observerHeight
            )

            $('#measureSVGObserver')
                .attr('cx', _observerXY.x)
                .attr('cy', _observerXY.y)
                .attr('r', 4)
                .attr('fill', 'var(--color-green2)')
                .attr('stroke', 'black')
        }
    }, [profileData, refresh])

    const dems = MeasureTool.getDems()

    // Compute line of sight for each segment and then merge back together
    recomputeLineOfSight()

    return (
        <div
            className='MeasureTool'
            onMouseLeave={() => {
                MeasureTool.clearInfo()
            }}
        >
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
                {dems.length > 1 && (
                    <div id='measureDem'>
                        <div title='Digital Elevation Model'>Dataset</div>
                        <select
                            className='dropdown'
                            defaultValue={dems[0].path}
                            onChange={MeasureTool.changeDem}
                        >
                            {dems.map((l, idx) => (
                                <option key={idx} value={idx}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div id='measureMode'>
                    <div>Mode</div>
                    <select
                        className='dropdown'
                        defaultValue={mode}
                        onChange={MeasureTool.changeMode}
                    >
                        <option value='segment'>Segment</option>
                        <option value='continuous'>Continuous</option>
                        <option value='continuous_color'>
                            Continuous Color
                        </option>
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
                <div id='measureUnit'>
                    <div>Unit</div>
                    <select
                        className='dropdown'
                        defaultValue='meters'
                        onChange={MeasureTool.changeDistDisplayUnit}
                    >
                        <option value='meters'>M</option>
                        <option value='kilometers'>KM</option>
                    </select>
                </div>
                <div id='measureLOS'>
                    <div>Line of Sight</div>
                    <div className='mmgis-checkbox small'>
                        <input
                            type='checkbox'
                            defaultChecked={LOS.on}
                            id='measureLOSCheck'
                            onChange={MeasureTool.changeLOS}
                        />
                        <label htmlFor='measureLOSCheck'></label>
                    </div>
                </div>
                <div id='measureObserverHeight'>
                    <div>&nbsp;&nbsp;&nbsp;Observer Height</div>
                    <div className='flexbetween'>
                        <input
                            type='number'
                            min={0}
                            step={1}
                            defaultValue={LOS.observerHeight}
                            placeholder={0}
                            id='measureObserverHeightInput'
                            onChange={MeasureTool.changeLOSObserverHeight}
                        />
                        <div className='measureToolInputUnit'>m</div>
                    </div>
                </div>
                <div id='measureTargetHeight'>
                    <div>&nbsp;&nbsp;&nbsp;Target Height</div>
                    <div className='flexbetween'>
                        <input
                            type='number'
                            min={0}
                            step={1}
                            defaultValue={LOS.targetHeight}
                            placeholder={0}
                            id='measureTargetHeightInput'
                            onChange={MeasureTool.changeLOSTargetHeight}
                        />
                        <div className='measureToolInputUnit'>m</div>
                    </div>
                </div>
                <div id='measureSpeed'>
                    <div>Travel Speed</div>
                    <div className='flexbetween'>
                        <input
                            type='number'
                            min={0}
                            defaultValue={0}
                            placeholder={0}
                            id='measureSpeedInput'
                            onChange={MeasureTool.changeSpeed}
                        />

                        <select
                            className='dropdown'
                            defaultValue='100'
                            onChange={MeasureTool.changeSpeedUnit}
                        >
                            <option value='m/s'>m/s</option>
                            <option value='km/h'>km/h</option>
                            <option value='mph'>mph</option>
                            <option value='kt'>knots</option>
                            <option value='ft/s'>ft/s</option>
                        </select>
                    </div>
                </div>
            </div>
            <div
                id='measureGraph'
                onMouseLeave={() => {
                    MeasureTool.clearFocusPoint()

                    $('#measureVerticalCursor').css({
                        opacity: 0,
                    })

                    $('#measureSVGLine').attr('stroke', 'rgba(0,0,0,0)')
                    if (!LOS.on)
                        $('#measureSVGObserver')
                            .attr('fill', 'rgba(0,0,0,0)')
                            .attr('stroke', 'rgba(0,0,0,0)')
                }}
            >
                <Line
                    ref={refLine}
                    data={{
                        labels: MeasureTool.uniformData.map((uD) => {
                            const d = MeasureTool.lastData[uD.index]
                            const xAxes = parseInt(d[2], 10)
                            return distDisplayUnit === 'kilometers'
                                ? (xAxes / 1000).toFixed(2)
                                : xAxes
                        }),
                        datasets: [
                            {
                                label: 'Profile',
                                data: MeasureTool.uniformData.map((d) => d.y),
                                segment: {
                                    backgroundColor: (ctx) => {
                                        if (
                                            LOS.on &&
                                            MeasureTool.lineOfSight[
                                                MeasureTool.uniformData[
                                                    ctx.p1DataIndex
                                                ].index
                                            ] === 0
                                        )
                                            return 'black'
                                        const i =
                                            MeasureTool.datasetMapping[
                                                MeasureTool.uniformData[
                                                    ctx.p0DataIndex
                                                ].index
                                            ] - 1
                                        if (mode === 'continuous_color') {
                                            return MeasureTool.getColor(i, 0.4)
                                        } else
                                            return i % 2 === 0
                                                ? 'rgba(255, 0, 47, 0.4)'
                                                : 'rgba(255, 80, 112, 0.4)'
                                    },
                                    borderColor: (ctx) => {
                                        let alpha = 1
                                        if (
                                            LOS.on &&
                                            MeasureTool.lineOfSight[
                                                MeasureTool.uniformData[
                                                    ctx.p1DataIndex
                                                ].index
                                            ] === 0
                                        )
                                            alpha = 0.75
                                        const i =
                                            MeasureTool.datasetMapping[
                                                MeasureTool.uniformData[
                                                    ctx.p0DataIndex
                                                ].index
                                            ] - 1
                                        if (mode === 'continuous_color')
                                            return MeasureTool.getColor(
                                                i,
                                                alpha
                                            )
                                        else
                                            return i % 2
                                                ? `rgba(255, 80, 112, ${alpha})`
                                                : `rgba(255, 0, 47, ${alpha})`
                                    },
                                },
                                spanGaps: false,
                                borderWidth: 1,
                                fill: 'start',
                                pointRadius: 0,
                                pointHitRadius: 0,
                                pointBackgroundColor: 'rgba(0,0,0,0)',
                                pointBorderColor: 'rgba(0,0,0,0)',
                                pointHoverBackgroundColor: 'yellow',
                                pointHoverBorderColor: '#1f1f1f',
                            },
                        ],
                    }}
                    height={150}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false,
                            },
                            tooltip: {
                                enabled: false,
                            },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    mode: 'x',
                                },
                                zoom: {
                                    wheel: {
                                        enabled: true,
                                        speed: 1 / steps,
                                    },
                                    limits: {
                                        x: 'original',
                                    },
                                    mode: 'x',
                                },
                            },
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
                            x: {
                                type: 'linear',
                                min: 0,
                                max:
                                    MeasureTool.lastData.length > 1
                                        ? parseInt(
                                              MeasureTool.lastData[
                                                  MeasureTool.lastData.length -
                                                      1
                                              ][2]
                                          ) *
                                          (distDisplayUnit === 'kilometers'
                                              ? 0.001
                                              : 1)
                                        : 1,
                                ticks: {
                                    autoSkip: false,
                                    stepSize: getIdealXAxisStepSize(),
                                    callback: function (value, index, values) {
                                        if (distDisplayUnit === 'kilometers') {
                                            return value.toFixed(2) + 'km'
                                        }
                                        return value + 'm'
                                    },
                                },
                            },
                            y: {
                                grid: {
                                    color: 'rgba(255,255,255,0.05)',
                                },
                                ticks: {
                                    callback: function (value, index, values) {
                                        return `${value}m`
                                    },
                                    lineHeight: 1.5,
                                },
                            },
                        },
                        onHover: (e, el) => {
                            let d
                            let visible = '--'
                            if (
                                refLine &&
                                e.x != null &&
                                MeasureTool.uniformData.length > 2
                            ) {
                                const chartArea = refLine.current.chartArea
                                const yScale = refLine.current.scales.y
                                let bestIndex =
                                    MeasureTool.uniformData[
                                        Math.round(
                                            F_.linearScale(
                                                [
                                                    chartArea.left,
                                                    chartArea.right,
                                                ],
                                                [0, profileData.length],
                                                e.x
                                            )
                                        )
                                    ]
                                if (bestIndex != null)
                                    bestIndex = bestIndex.index
                                else return

                                $('#measureVerticalCursor').css({
                                    left: `${e.x}px`,
                                    height: `${chartArea.bottom}px`,
                                    opacity: 1,
                                })
                                if (
                                    bestIndex >= 0 &&
                                    bestIndex < MeasureTool.lastData.length
                                ) {
                                    d = MeasureTool.lastData[bestIndex]
                                    if (LOS.on) {
                                        if (
                                            MeasureTool.lineOfSight[
                                                bestIndex
                                            ] === 0
                                        )
                                            visible = false
                                        else visible = true
                                    }
                                    MeasureTool.makeFocusPoint(d[1], d[0], d[4])
                                }

                                if (LOS.on && profileData.length > 0) {
                                    _observerXY.index =
                                        Math.floor(bestIndex / steps) * steps
                                    // Observer
                                    _observerXY.x = F_.linearScale(
                                        [0, profileData.length],
                                        [chartArea.left, chartArea.right],
                                        _observerXY.index
                                    )
                                    _observerXY.y = F_.linearScale(
                                        [yScale.min, yScale.max],
                                        [chartArea.bottom, chartArea.top],
                                        profileData[_observerXY.index] +
                                            LOS.observerHeight
                                    )
                                    $('#measureSVGObserver')
                                        .attr('cx', _observerXY.x)
                                        .attr('cy', _observerXY.y)
                                        .attr('r', 4)
                                        .attr('fill', 'var(--color-green2)')
                                        .attr('stroke', 'black')

                                    // Line
                                    const yPos = F_.linearScale(
                                        [yScale.min, yScale.max],
                                        [chartArea.bottom, chartArea.top],
                                        profileData[bestIndex] +
                                            LOS.targetHeight
                                    )
                                    $('#measureSVGLine')
                                        .attr('x1', _observerXY.x)
                                        .attr('y1', _observerXY.y)
                                        .attr('x2', e.x)
                                        .attr('y2', yPos)
                                        .attr(
                                            'stroke',
                                            visible
                                                ? 'var(--color-a7)'
                                                : 'var(--color-a2)'
                                        )
                                } else {
                                    $('#measureSVGLine').attr(
                                        'stroke',
                                        'rgba(0,0,0,0)'
                                    )
                                }
                            }

                            if (d) {
                                $('#measureInfoLng > div:last-child')
                                    .text(`${d[0].toFixed(6)}°`)
                                    .css({ opacity: 1 })

                                $('#measureInfoLat > div:last-child')
                                    .text(`${d[1].toFixed(6)}°`)
                                    .css({ opacity: 1 })

                                $('#measureInfoElev > div:last-child')
                                    .text(
                                        d[4] != null
                                            ? `${d[4].toFixed(3)}m`
                                            : 'No Data'
                                    )
                                    .css({ opacity: 1 })

                                const text2d =
                                    distDisplayUnit === 'kilometers'
                                        ? `${(d[2] / 1000).toFixed(2)}km`
                                        : `${d[2].toFixed(3)}m`
                                $('#measureInfo2d > div:last-child')
                                    .text(text2d)
                                    .css({ opacity: 1 })

                                const text3d =
                                    distDisplayUnit === 'kilometers'
                                        ? `${(d[3] / 1000).toFixed(2)}km`
                                        : `${d[3].toFixed(3)}m`

                                $('#measureInfo3d > div:last-child')
                                    .text(text3d)
                                    .css({ opacity: 1 })

                                $('#measureInfoVis > div:last-child')
                                    .text(
                                        `${
                                            LOS.on
                                                ? visible
                                                    ? 'TRUE'
                                                    : 'FALSE'
                                                : 'N/A'
                                        }`
                                    )
                                    .css({ opacity: 1 })

                                $('#measureInfoSpeed > div:last-child')
                                    .text(
                                        MeasureTool.speed != null &&
                                            MeasureTool.speed != 0
                                            ? `${MeasureTool.speed}${MeasureTool.speedUnit}`
                                            : 'N/A'
                                    )
                                    .css({ opacity: 1 })

                                $('#measureInfoArrives > div:last-child')
                                    .text(
                                        MeasureTool.speed != null &&
                                            MeasureTool.speed != 0
                                            ? getArrivesStringFromDistance(d[2])
                                            : 'N/A'
                                    )
                                    .css({ opacity: 1 })
                            }
                        },
                    }}
                />
                <svg id='measureSVGOverlay'>
                    <line
                        id='measureSVGLine'
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={0}
                        stroke='rgba(0,0,0,0)'
                        strokeWidth={1}
                        strokeDasharray='10 3'
                    />
                    <circle
                        id='measureSVGObserver'
                        cx={0}
                        cy={0}
                        r={0}
                        stroke='rgba(0,0,0,0)'
                        strokeWidth={1}
                        fill='rgba(0,0,0,0)'
                    />
                </svg>
                <div id='measureVerticalCursor'></div>
            </div>
            <div id='measureInfo'>
                <div id='measureInfoLng' className='measure-info-elm'>
                    <div>Longitude</div>
                    <div>--</div>
                </div>
                <div id='measureInfoLat' className='measure-info-elm'>
                    <div>Latitude</div>
                    <div>--</div>
                </div>
                <div id='measureInfoElev' className='measure-info-elm'>
                    <div>Elevation</div>
                    <div>--</div>
                </div>
                <div id='measureInfo2d' className='measure-info-elm'>
                    <div>2D Distance</div>
                    <div>--</div>
                </div>
                <div id='measureInfo3d' className='measure-info-elm'>
                    <div>3D Distance</div>
                    <div>--</div>
                </div>
                <div id='measureInfoVis' className='measure-info-elm'>
                    <div>Visible</div>
                    <div>--</div>
                </div>
                <div id='measureInfoSpeed' className='measure-info-elm'>
                    <div>Speed</div>
                    <div>--</div>
                </div>
                <div id='measureInfoArrives' className='measure-info-elm'>
                    <div>Arrives in</div>
                    <div>--</div>
                </div>
            </div>
            <div id='measureToolBar'>
                <div
                    id='measureReset'
                    title='Reset Graph'
                    onClick={() => {
                        // Zooming not working nicely, see register above
                        //if (refLine) refLine.current.chartInstance.resetZoom()
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
    height: 243,
    width: 'full',
    disableLayerInteractions: true,
    vars: {},
    data: [],
    lineOfSight: [],
    lastData: [],
    uniformData: [],
    mapFocusMarker: null,
    dems: [],
    activeDemIdx: 0,
    speed: null,
    speedUnit: 'm/s',
    colorRamp: [
        '#e60049',
        '#0bb4ff',
        '#50e991',
        '#e6d800',
        '#9b19f5',
        '#ffa300',
        '#dc0ab4',
        '#b3d4ff',
        '#00bfa0',
        '#f0cccc',
        //Same as above but with +25% lightness (mostly)
        '#ff6696',
        '#8adcff',
        '#bff7d7',
        '#fff566',
        '#d093fb',
        '#ffd080',
        '#f86ddf',
        '#ffffff',
        '#3dffdf',
        '#cc5200',
    ],
    init: function () {},
    make: function () {
        Map_.rmNotNull(measureToolLayer)
        MeasureTool.data = []
        MeasureTool.lastData = []
        MeasureTool.datasetMapping = []
        MeasureTool.uniformData = []
        distDisplayUnit = 'meters'
        steps = 100

        //Get tool variables
        this.vars = JSON.parse(JSON.stringify(L_.getToolVars('measure', true)))
        this.vars.layerDems = this.vars.layerDems || {}

        const standardLayerDems = {}
        Object.keys(this.vars.layerDems).forEach((layerName) => {
            standardLayerDems[L_.asLayerUUID(layerName)] = [
                this.vars.layerDems[layerName],
            ]
        })
        this.vars.layerDems = standardLayerDems

        if (this.vars.__layers) {
            Object.keys(this.vars.__layers).forEach((layerName) => {
                const layer = this.vars.__layers[layerName]
                if (layer.layerDems) {
                    this.vars.layerDems[layerName] = (
                        this.vars.layerDems[layerName] || []
                    ).concat(layer.layerDems)
                }
            })
        }

        if (
            this.vars.defaultMode &&
            availableModes.includes(this.vars.defaultMode)
        )
            mode = this.vars.defaultMode
        else mode = 'segment'

        this.dems = MeasureTool.getDems()
        this.activeDemIdx = 0

        render(<Measure />, document.getElementById('tools'))
    },
    destroy: function () {
        unmountComponentAtNode(document.getElementById('tools'))

        Map_.map
            .off('click', MeasureTool.clickMap)
            .off('mousemove', MeasureTool.moveMap)
            .off('mouseout', MeasureTool.mouseOutMap)

        if (L_.hasGlobe) {
            const globeCont = Globe_.litho.getContainer()
            globeCont.removeEventListener(
                'mousedown',
                MeasureTool.mouseDownGlobe,
                false
            )
            globeCont.removeEventListener(
                'mouseup',
                MeasureTool.clickGlobe,
                false
            )
            globeCont.removeEventListener(
                'mousemove',
                MeasureTool.moveGlobe,
                false
            )
            globeCont.removeEventListener(
                'mouseout',
                MeasureTool.mouseOutMap,
                false
            )
        }

        Viewer_.imageViewerMap.removeHandler(
            'canvas-click',
            MeasureTool.clickViewer
        )
        $('#map').css({ cursor: 'grab' })
        Viewer_.imageViewer.style('cursor', 'map')

        Map_.rmNotNull(distLineToMouse)
        Map_.rmNotNull(distMousePoint)
        Map_.rmNotNull(measureToolLayer)

        Globe_.litho.removeLayer('_measure')
        Globe_.litho.removeLayer('_measurePoint')
        Globe_.litho.removeLayer('_measurePolyline')

        CursorInfo.hide()

        MeasureTool.clearFocusPoint()
    },
    getDems: function () {
        const onlyShowDemIfLayerOn =
            this.vars.onlyShowDemIfLayerOn == null
                ? true
                : this.vars.onlyShowDemIfLayerOn
                ? true
                : false

        let dems = []
        if (MeasureTool.vars.dem)
            dems.push({ name: 'Main', path: MeasureTool.vars.dem })
        if (MeasureTool.vars.layerDems)
            for (let name in MeasureTool.vars.layerDems) {
                MeasureTool.vars.layerDems[name].forEach((item) => {
                    if (!onlyShowDemIfLayerOn || L_.layers.on[name]) {
                        if (typeof item === 'string') {
                            dems.push({
                                name: L_.layers.data[name]?.display_name,
                                path: item,
                            })
                        } else {
                            dems.push({
                                name:
                                    item.name ||
                                    L_.layers.data[name]?.display_name,
                                path: item.url,
                            })
                        }
                    }
                })
            }
        if (dems.length === 0)
            dems.push({ name: 'Misconfigured', path: 'none' })

        return dems
    },
    clickMap: function (e) {
        if (mode === 'segment' && clickedLatLngs.length >= 2) {
            clickedLatLngs = []
            profileData = []
            updateProfileData(profileData)
            MeasureTool.data = []
            MeasureTool.lastData = []
            MeasureTool.uniformData = []
            MeasureTool.datasetMapping = []
            MeasureTool.clearFocusPoint()
            Map_.rmNotNull(distLineToMouse)
            Map_.rmNotNull(distMousePoint)
        }
        CursorInfo.hide()
        MeasureTool.clearFocusPoint()

        var xy = { x: e.latlng.lat, y: e.latlng.lng }
        clickedLatLngs.push(xy)

        makeMeasureToolLayer()
        makeProfile()
    },
    moveMap: function (e) {
        if (
            mode === 'continuous' ||
            mode === 'continuous_color' ||
            clickedLatLngs.length === 1
        )
            makeGhostLine(e.latlng.lng, e.latlng.lat)
    },
    mouseOutMap: function (e) {
        if (distLineToMouse != null) {
            Map_.map.removeLayer(distLineToMouse)
            Globe_.litho.removeLayer('_measure')
            distLineToMouse = null
        }
        if (distMousePoint != null) {
            Map_.map.removeLayer(distMousePoint)
            distMousePoint = null
        }
        CursorInfo.hide()
    },
    mouseDownGlobe: function (e) {
        globeMouseDownXY = { x: e.x, y: e.y }
    },
    clickGlobe: function (e) {
        // Make sure the click isn't a drag
        if (
            Math.abs(globeMouseDownXY.x - e.x) > 3 ||
            Math.abs(globeMouseDownXY.y - e.y) > 3
        )
            return
        if (mode === 'segment' && clickedLatLngs.length >= 2) {
            clickedLatLngs = []
            profileData = []
            updateProfileData(profileData)
            MeasureTool.data = []
            MeasureTool.lastData = []
            MeasureTool.clearFocusPoint()
            Map_.rmNotNull(distLineToMouse)
            Map_.rmNotNull(distMousePoint)
        }
        CursorInfo.hide()
        MeasureTool.clearFocusPoint()

        var xy = { x: Globe_.litho.mouse.lat, y: Globe_.litho.mouse.lng }
        clickedLatLngs.push(xy)

        makeMeasureToolLayer()
        makeProfile()
    },
    moveGlobe: function (e) {
        if (
            (mode === 'continuous' ||
                mode === 'continuous_color' ||
                clickedLatLngs.length === 1) &&
            Globe_.litho.mouse.lng != null &&
            Globe_.litho.mouse.lat != null
        ) {
            makeGhostLine(Globe_.litho.mouse.lng, Globe_.litho.mouse.lat)
        }
    },
    clickViewer: function (e) {
        // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
        var viewportPoint = Viewer_.imageViewerMap.viewport.pointFromPixel(
            e.position
        )
        // Convert from viewport coordinates to image coordinates.
        var xy =
            Viewer_.imageViewerMap.viewport.viewportToImageCoordinates(
                viewportPoint
            )
        xy.x = parseInt(xy.x)
        xy.y = parseInt(xy.y)
        makeBandProfile(xy)
    },
    makeFocusPoint(lat, lng, z) {
        MeasureTool.clearFocusPoint()
        MeasureTool.mapFocusMarker = new L.circleMarker([lat, lng], {
            fillColor: 'yellow',
            fillOpacity: 1,
            color: '#0f0f0f',
            weight: 2,
        })
            .setRadius(6)
            .addTo(Map_.map)
        Globe_.litho.addLayer(
            'vector',
            {
                name: '_measurePoint',
                id: '_measurePoint',
                on: true,
                opacity: 1,
                order: 2,
                minZoom: 0,
                maxZoom: 30,
                style: {
                    default: {
                        fillColor: 'yellow',
                        color: '#000',
                        weight: 2,
                        radius: 8,
                    },
                },
                geojson: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [[lng, lat, 2 + z]],
                            },
                        },
                    ],
                },
            },
            1
        )
    },
    clearFocusPoint() {
        Map_.rmNotNull(MeasureTool.mapFocusMarker)
        Globe_.litho.removeLayer('_measurePoint')
    },
    undo: function (e) {
        clickedLatLngs.pop()
        if (profileData.length - steps >= 0)
            profileData = profileData.slice(0, profileData.length - steps)

        if (MeasureTool.data.length - steps >= 0)
            MeasureTool.data = MeasureTool.data.slice(
                0,
                MeasureTool.data.length - steps
            )
        // Twice because we also want to replace the last last data seg
        if (MeasureTool.data.length - steps >= 0)
            MeasureTool.data = MeasureTool.data.slice(
                0,
                MeasureTool.data.length - steps
            )

        makeMeasureToolLayer()
        Globe_.litho.removeLayer('_measure')
        Globe_.litho.removeLayer('_measurePoint')
        Globe_.litho.removeLayer('_measurePolyline')

        MeasureTool.clearFocusPoint()
        MeasureTool.clearInfo()

        makeProfile()
    },
    reset: function () {
        clickedLatLngs = []
        profileData = []
        MeasureTool.data = []
        MeasureTool.lastData = []
        MeasureTool.uniformData = []
        MeasureTool.datasetMapping = []
        //distDisplayUnit = 'meters'

        Map_.rmNotNull(distLineToMouse)
        Map_.rmNotNull(distMousePoint)
        Map_.rmNotNull(measureToolLayer)
        Globe_.litho.removeLayer('_measure')
        Globe_.litho.removeLayer('_measurePoint')
        Globe_.litho.removeLayer('_measurePolyline')

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
        MeasureTool.clearInfo()

        updateProfileData([])
    },
    changeDem: function (e) {
        MeasureTool.activeDemIdx = parseInt(e.target.value)
        // Won't requery all continuous segments again
        if (mode !== 'segment') MeasureTool.reset()
        makeProfile()
    },
    changeMode: function (e) {
        MeasureTool.reset()
        mode = e.target.value || 'segment'
    },
    changeSamples: function (e) {
        if (clickedLatLngs.length > 2) {
            MeasureTool.reset()
        }
        steps = parseInt(e.target.value, 10) || 100
        makeProfile()
    },
    changeDistDisplayUnit: function (e) {
        MeasureTool.reset()
        distDisplayUnit = e.target.value
    },
    changeLOS: function (e) {
        LOS.on = e.target.checked
        if (!LOS.on) {
            $('#measureSVGLine').attr('stroke', 'rgba(0,0,0,0)')
            $('#measureSVGObserver')
                .attr('fill', 'rgba(0,0,0,0)')
                .attr('stroke', 'rgba(0,0,0,0)')
        }
        triggerRefresh()
        makeMeasureToolLayer()
    },
    changeLOSObserverHeight: function (e) {
        LOS.observerHeight = parseFloat(e.target.value || 0)
        if (LOS.on) {
            triggerRefresh()
            makeMeasureToolLayer()
        }
    },
    changeLOSTargetHeight: function (e) {
        LOS.targetHeight = parseFloat(e.target.value || 0)
        if (LOS.on) {
            triggerRefresh()
            makeMeasureToolLayer()
        }
    },
    changeSpeed: function (e) {
        MeasureTool.speed = e.target.value
    },
    changeSpeedUnit: function (e) {
        MeasureTool.speedUnit = e.target.value
    },
    clearInfo: function () {
        $('#measureInfoLng > div:last-child').css({ opacity: 0 })
        $('#measureInfoLat > div:last-child').css({ opacity: 0 })
        $('#measureInfoElev > div:last-child').css({ opacity: 0 })
        $('#measureInfo2d > div:last-child').css({ opacity: 0 })
        $('#measureInfo3d > div:last-child').css({ opacity: 0 })
        $('#measureInfoVis > div:last-child').css({ opacity: 0 })
        $('#measureInfoSpeed > div:last-child').css({ opacity: 0 })
        $('#measureInfoArrives > div:last-child').css({ opacity: 0 })
    },
    download: function (e) {
        const header = [
            'longitude',
            'latitude',
            'distance',
            'distance_3d',
            'elevation',
        ]
        const data = JSON.parse(JSON.stringify(MeasureTool.lastData))
        if (L_.Coordinates.mainType != 'll') {
            const coordState = L_.Coordinates.states[L_.Coordinates.mainType]
            header[0] = coordState.names[0]
            header[1] = coordState.names[1]

            data.forEach((d) => {
                const converted = L_.Coordinates.convertLngLat(d[0], d[1])
                d[0] = converted[0]
                d[1] = converted[1]
            })
        }

        F_.downloadArrayAsCSV(header, data, 'profiledata')
    },
    getColor: function (idx, alpha) {
        if (alpha != null) {
            const rgb = F_.hexToRGB(
                MeasureTool.colorRamp[idx % MeasureTool.colorRamp.length] ||
                    '#FFFFFF'
            ) || { r: 255, g: 255, b: 255 }
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
        } else
            return (
                MeasureTool.colorRamp[idx % MeasureTool.colorRamp.length] ||
                '#FFFFFF'
            )
    },
}

function recomputeLineOfSight() {
    MeasureTool.lineOfSight = []
    if (LOS.on) {
        F_.chunkArray(profileData, steps).forEach((chunk) => {
            MeasureTool.lineOfSight = MeasureTool.lineOfSight.concat(
                F_.lineOfSight1D(chunk, LOS.observerHeight, LOS.targetHeight)
            )
        })
    }
}

// Takes non-linear x-axis profileData and makes it fit linearly. (Only for display purposes)
function uniform(d) {
    const linearProfileData = []

    if (MeasureTool.lastData.length > 2 && d.length != 0) {
        const totalDistance =
            MeasureTool.lastData[MeasureTool.lastData.length - 1][2]
        const steps = MeasureTool.lastData.length
        const step = totalDistance / steps
        let workingDistance = 0

        let currentLastDataI = 1

        for (let i = 0; i < steps; i++) {
            while (
                MeasureTool.lastData[currentLastDataI][2] < workingDistance
            ) {
                currentLastDataI++
            }

            linearProfileData.push({
                y: yFromX(
                    {
                        x: MeasureTool.lastData[currentLastDataI - 1][2],
                        y: MeasureTool.lastData[currentLastDataI - 1][4],
                    },
                    {
                        x: MeasureTool.lastData[currentLastDataI][2],
                        y: MeasureTool.lastData[currentLastDataI][4],
                    },
                    workingDistance
                ),
                index: currentLastDataI - 1,
            })

            workingDistance += step
        }
    }
    return linearProfileData
}
function yFromX(point1, point2, x) {
    const gradient = (point2.y - point1.y) / (point2.x - point1.x)
    const intercept = point1.y - gradient * point1.x
    return gradient * x + intercept
}

function getIdealXAxisStepSize() {
    let stepSize = 0.1

    if (MeasureTool.lastData.length >= 2) {
        const totalDistance =
            MeasureTool.lastData[MeasureTool.lastData.length - 1][2]

        if (totalDistance > 1) stepSize = 0.2
        if (totalDistance > 10) stepSize = 1
        if (totalDistance > 50) stepSize = 2
        if (totalDistance > 100) stepSize = 10
        if (totalDistance > 500) stepSize = 20
        if (totalDistance > 1000) stepSize = 100
        if (totalDistance > 5000) stepSize = 200
        if (totalDistance > 10000) stepSize = 1000
        if (totalDistance > 50000) stepSize = 2000
        if (totalDistance > 100000) stepSize = 10000
        if (totalDistance > 500000) stepSize = 20000
        if (totalDistance > 1000000) stepSize = 100000
        if (totalDistance > 5000000) stepSize = 200000
        if (totalDistance > 10000000) stepSize = 1000000
        if (totalDistance > 50000000) stepSize = 2000000
        if (totalDistance > 100000000) stepSize = 1000000
        if (totalDistance > 500000000) stepSize = 2000000
    }
    return stepSize
}

function makeMeasureToolLayer() {
    Map_.rmNotNull(measureToolLayer)

    var pointsAndPathArr = []
    var polylinePoints = []
    var temp
    for (var i = 0; i < clickedLatLngs.length; i++) {
        temp = new L.circleMarker([clickedLatLngs[i].x, clickedLatLngs[i].y], {
            fillColor: i == 0 ? 'var(--color-green2)' : 'black',
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
            var roundedTotalDist =
                Math.round(totalDistToIndex(i + 1) * rAm) / rAm
            var distAzimuth =
                Math.round(
                    F_.bearingBetweenTwoLatLngs(
                        clickedLatLngs[0].x,
                        clickedLatLngs[0].y,
                        clickedLatLngs[i].x,
                        clickedLatLngs[i].y
                    ) * rAm
                ) / rAm
            if (distAzimuth < 0) distAzimuth = 360 + distAzimuth //Map to 0 to 360 degrees
            if (i == clickedLatLngs.length - 1) {
                let dist = roundedTotalDist
                let distUnit = 'm'

                let timeToArrival = ''
                if (MeasureTool.speed != null && MeasureTool.speed != 0) {
                    timeToArrival = ` | Arrives in ${getArrivesStringFromDistance(
                        dist
                    )} (at ${MeasureTool.speed}${MeasureTool.speedUnit})`
                }
                if (distDisplayUnit == 'kilometers') {
                    dist = (roundedTotalDist / 1000).toFixed(2)
                    distUnit = 'km'
                }
                temp.bindTooltip(
                    `${dist}${distUnit} | ${distAzimuth}&deg;${timeToArrival}`,
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

    const segments = []
    recomputeLineOfSight()
    if (LOS.on && MeasureTool.lineOfSight.length > 0) {
        let currentVis = MeasureTool.lineOfSight[0]
        F_.chunkArray(MeasureTool.lineOfSight, steps).forEach(
            (chunk, chunkIdx) => {
                let startIdx = 0
                let endIdx = 0
                chunk.forEach((visible, idx) => {
                    const chunkOffset = chunkIdx * steps
                    if (idx === 0) currentVis = visible

                    if (visible != currentVis || idx === chunk.length - 1) {
                        // draw previous
                        segments.push(
                            new L.Polyline(
                                [
                                    {
                                        lat: MeasureTool.lastData[
                                            startIdx + chunkOffset
                                        ][1],
                                        lng: MeasureTool.lastData[
                                            startIdx + chunkOffset
                                        ][0],
                                    },
                                    {
                                        lat: MeasureTool.lastData[
                                            endIdx + chunkOffset
                                        ][1],
                                        lng: MeasureTool.lastData[
                                            endIdx + chunkOffset
                                        ][0],
                                    },
                                ],
                                {
                                    color:
                                        currentVis === 0
                                            ? 'black'
                                            : mode === 'continuous_color'
                                            ? MeasureTool.getColor(chunkIdx)
                                            : mode === 'continuous'
                                            ? (chunkIdx + 1) % 2
                                                ? '#ff002f'
                                                : '#ff5070'
                                            : '#ff002f',
                                    weight: 3,
                                }
                            )
                        )

                        currentVis = visible
                        startIdx = idx
                        endIdx++
                    } else {
                        endIdx++
                    }
                })
            }
        )
    } else {
        for (let i = 1; i < polylinePoints.length; i++) {
            segments.push(
                new L.Polyline([polylinePoints[i - 1], polylinePoints[i]], {
                    color:
                        mode === 'continuous_color'
                            ? MeasureTool.getColor(i - 1)
                            : mode === 'continuous'
                            ? i % 2
                                ? '#ff002f'
                                : '#ff5070'
                            : '#ff002f',
                    weight: 3,
                })
            )
        }
    }

    pointsAndPathArr.unshift(...segments)
    measureToolLayer = L.featureGroup(pointsAndPathArr).addTo(Map_.map)

    makeGlobePolyline(polylinePoints)
}
function makeProfile() {
    var numOfPts = clickedLatLngs.length
    const path = MeasureTool.dems[MeasureTool.activeDemIdx].path
    if (numOfPts > 1 && path && path != 'none' && path != 'undefined') {
        // enable remote access via GDAL Virtual File Systems /vsi* prefix
        let pathDEM
        if (path.startsWith('/vsi')) pathDEM = path
        else pathDEM = 'Missions/' + L_.mission + '/' + path

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
                    // Fake a no data line between them then
                    data = [
                        [elevPoints[0].y, elevPoints[0].x, 0],
                        [elevPoints[1].y, elevPoints[1].x, 0],
                    ]
                }

                if (mode === 'segment') MeasureTool.data = F_.clone(data)
                else {
                    MeasureTool.data = MeasureTool.data || []
                    MeasureTool.data = MeasureTool.data.concat(F_.clone(data))
                }

                MeasureTool.lastData = F_.clone(MeasureTool.data)
                MeasureTool.datasetMapping = MeasureTool.datasetMapping || []
                MeasureTool.datasetMapping = MeasureTool.datasetMapping.concat(
                    new Array(steps).fill(numOfPts - 1)
                )

                let currentDataset = 0
                let currentDatasetStart = 0
                let lastDistance = 0
                let lastDistance3d = 0
                let currentDatasetDistanceStart = 0

                for (let i = 0; i < MeasureTool.lastData.length; i++) {
                    let distance = 0
                    let distance3d = 0
                    if (MeasureTool.datasetMapping[i] - 1 !== currentDataset) {
                        currentDataset = MeasureTool.datasetMapping[i] - 1
                        currentDatasetStart = i
                        currentDatasetDistanceStart = lastDistance
                    }
                    if (i > 0 && i < MeasureTool.lastData.length) {
                        distance =
                            F_.lngLatDistBetween(
                                MeasureTool.lastData[i][0],
                                MeasureTool.lastData[i][1],
                                MeasureTool.lastData[currentDatasetStart][0],
                                MeasureTool.lastData[currentDatasetStart][1]
                            ) + currentDatasetDistanceStart
                        // Pythag theorem
                        // Calculates the hypotenuse between each sample point
                        // 2d distance is one leg and elevation difference is the second leg
                        // 4 in lastData[i - 1] because we're shifting the distances to 2 and 3
                        distance3d = Math.sqrt(
                            Math.pow(
                                F_.lngLatDistBetween(
                                    MeasureTool.lastData[i][0],
                                    MeasureTool.lastData[i][1],
                                    MeasureTool.lastData[i - 1][0],
                                    MeasureTool.lastData[i - 1][1]
                                ),
                                2
                            ) +
                                Math.pow(
                                    Math.abs(
                                        MeasureTool.lastData[i][2] -
                                            MeasureTool.lastData[i - 1][4]
                                    ),
                                    2
                                )
                        )
                        distance3d += lastDistance3d

                        lastDistance3d = distance3d
                    }
                    lastDistance = distance
                    MeasureTool.lastData[i].splice(2, 0, distance)
                    MeasureTool.lastData[i].splice(3, 0, distance3d)
                }

                profileData = []
                for (var i = 0; i < MeasureTool.data.length; i++) {
                    profileData.push(MeasureTool.data[i][2])
                }
                //profileData = profileData.concat(data);
                //var latestDistPerStep = latLongDistBetween(elevPoints[0].y, elevPoints[0].x, elevPoints[1].y, elevPoints[1].x) / steps;
                //var usedData = profileData
                //if(profileMode == "slope") {
                //  usedData = elevsToSlope
                //var multiplyElev = MeasureTool.vars.multiplyelev || 1
                updateProfileData(profileData)

                Globe_.litho.removeLayer('_measurePoint')

                makeMeasureToolLayer()
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

        var distAzimuth =
            Math.round(
                F_.bearingBetweenTwoLatLngs(
                    clickedLatLngs[0].x,
                    clickedLatLngs[0].y,
                    lat,
                    lng
                ) * rAm
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

        Globe_.litho.removeLayer('_measure')

        Globe_.litho.addLayer(
            'vector',
            {
                name: '_measure',
                id: '_measure',
                on: true,
                order: 2,
                opacity: 1,
                minZoom: 0,
                maxZoom: 30,
                style: {
                    default: {
                        fillColor: 'white',
                        weight: 5,
                    },
                },
                geojson: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [
                                        endDC['y'],
                                        endDC['x'],
                                        3 +
                                            Globe_.litho.getElevationAtLngLat(
                                                endDC['y'],
                                                endDC['x']
                                            ),
                                    ],
                                    [
                                        lng,
                                        lat,
                                        3 +
                                            Globe_.litho.getElevationAtLngLat(
                                                lng,
                                                lat
                                            ),
                                    ],
                                ],
                            },
                        },
                    ],
                },
            },
            null,
            1
        )
        //distMousePoint.bindTooltip("" + roundedTotalDist + "m\n (+" + roundedDist + "m) " + distAzimuth + "&deg;",
        //  {permanent: true, direction: 'right', className: "distLabel", className: "noPointerEvents", offset: [15,-15]})
        //distMousePoint.addTo(Map_.map);

        let distTotal = roundedTotalDist
        let dist = roundedDist
        let distUnit = 'm'

        let timeToArrivalTotal = ''
        let timeToArrival = ''
        if (MeasureTool.speed != null && MeasureTool.speed != 0) {
            timeToArrival = `<span style="font-size: 12px; font-weight: unset; color: var(--color-a5); letter-spacing: 1px;"> (+${getArrivesStringFromDistance(
                dist
            )})</span>`
            timeToArrivalTotal = `
<span style="font-size: 13px; font-weight: unset; color: var(--color-h); letter-spacing: 1px;">Arrives in: ${getArrivesStringFromDistance(
                distTotal
            )}</span>`
        }
        if (distDisplayUnit == 'kilometers') {
            distTotal = (roundedTotalDist / 1000).toFixed(2)
            dist = (roundedDist / 1000).toFixed(2)
            distUnit = 'km'
        }
        CursorInfo.update(
            `Distance: ${distTotal}${distUnit} ${
                mode === 'continuous'
                    ? `<span style="font-size: 12px; font-weight: unset; color: var(--color-a5); letter-spacing: 1px;">(+${dist}${distUnit})</span>`
                    : ''
            }
<span style="font-size: 14px; font-weight: unset; color: var(--color-a6); ">Angle${
                mode === 'continuous' ? ' (from start)' : ''
            }: ${distAzimuth}&deg;</span>${timeToArrivalTotal}${
                mode === 'continuous' ? timeToArrival : ''
            }`,
            null,
            false,
            null,
            null,
            null,
            true
        )
    }
}

function getArrivesStringFromDistance(dist, abbreviated) {
    let speed = F_.speedToMetersPerSeconds(
        MeasureTool.speed,
        MeasureTool.speedUnit
    )
    let duration = moment.duration((dist / speed) * 1000)
    let dDays = duration.get('days')
    let dHrs = duration.get('hours')
    let dMins = duration.get('minutes')
    let dSecs = duration.get('seconds')

    if (dDays === 0) {
        if (dHrs === 0) {
            if (dMins === 0) {
                return `${dSecs}s`
            }
            return `${dMins}m ${dSecs}s`
        }
        return `${dHrs}h ${dMins}m ${dSecs}s`
    }
    return `${dDays}D ${dHrs}h ${dMins}m ${dSecs}s`
}

function totalDistToIndex(l) {
    var totalDistance = 0
    for (var i = 1; i < l; i++) {
        //Sum up segment distance
        totalDistance += F_.lngLatDistBetween(
            clickedLatLngs[i].y,
            clickedLatLngs[i].x,
            clickedLatLngs[i - 1].y,
            clickedLatLngs[i - 1].x
        )

        //using actual latlng as meters:
        //totalDistance += Math.sqrt(Math.pow(clickedLatLngs[i].x - clickedLatLngs[i-1].x, 2) + Math.pow(clickedLatLngs[i].y - clickedLatLngs[i-1].y, 2));
    }
    return totalDistance
}

function makeGlobePolyline(polylinePoints) {
    const features = []
    for (let i = 1; i < polylinePoints.length; i++) {
        features.push({
            type: 'Feature',
            properties: {
                color:
                    mode === 'continuous_color'
                        ? MeasureTool.getColor(i - 1)
                        : mode === 'continuous'
                        ? i % 2
                            ? '#ff002f'
                            : '#ff5070'
                        : '#ff002f',
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [polylinePoints[i - 1].lng, polylinePoints[i - 1].lat],
                    [polylinePoints[i].lng, polylinePoints[i].lat],
                ],
            },
        })
    }
    if (L_.hasGlobe) {
        const globeBCR =
            Globe_.litho.getContainer()?.getBoundingClientRect() || {}
        if (globeBCR.width > 0)
            Globe_.litho.addLayer('clamped', {
                name: '_measurePolyline',
                id: '_measurePolyline',
                on: true,
                order: 10,
                opacity: 1,
                minZoom: 0,
                maxZoom: 30,
                style: {
                    default: {
                        weight: 3,
                        color: 'prop=color',
                    },
                },
                geojson: {
                    type: 'FeatureCollection',
                    features: features,
                },
            })
    }
}

MeasureTool.init()

export default MeasureTool
