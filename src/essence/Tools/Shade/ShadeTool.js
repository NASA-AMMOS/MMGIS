import React from 'react'
import { createRoot } from 'react-dom/client'
import { utcFormat } from 'd3-time-format'

import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Toast from '../../../design-system/components/Toast/Toast'
import DataShaders from '../../services/DataShaders'
import TimeControl from '../../Basics/TimeControl_/TimeControl'

import calls from '../../../pre/calls'

import ShadeTool_Manager from './ShadeTool_Manager'
import ShaderTool_Algorithm from './ShadeTool_Algorithm'

import useShadeStore, { MULTI_SOURCE_COLORS } from './store'
import ShadePanel from './components/ShadePanel'

import './ShadeTool.css'

const sunColor = '#d2db58'
const earthColor = '#58dbb8'

let ShadeTool = {
    height: 0,
    width: 260,
    _root: null,
    _sweepPlayTimer: null,

    initialize: function () {
        const vars = L_.getToolVars('shade')
        useShadeStore.getState().setVars(vars)

        if (vars && vars.__noVars !== true) {
            if (vars.data == null)
                console.warn(
                    'ShadeTool: variables object does not contain key "data"!'
                )
            else if (vars.data.length == null)
                console.warn(
                    'ShadeTool: variables object "data" is not an array!'
                )
            else if (vars.data.length == 0)
                console.warn('ShadeTool: variables object "data" is empty!')
        }
    },

    make: function () {
        const store = useShadeStore.getState()
        const vars = store.vars

        const rawTime = ShadeTool.parseToUTCTime(TimeControl.getEndTime())
        store.setSweepField('rawTime', rawTime)
        store.setSweepField(
            'utcTime',
            ShadeTool.parseToUTCTime(TimeControl.getEndTime(), true)
        )

        if (Object.keys(store.elements).length === 0) {
            store.addElement()
        }

        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        ShadeTool._root = createRoot(toolPanel)
        ShadeTool._root.render(<ShadePanel />)

        Map_.map.on('click', ShadeTool._onMapClick)
        Map_.map.on('moveend', ShadeTool._onPanEnd)
        TimeControl.subscribe('ShadeTool', (t) => {
            const raw = ShadeTool.parseToUTCTime(t.currentTime)
            useShadeStore.getState().setSweepField('rawTime', raw)
            useShadeStore.getState().setSweepField(
                'utcTime',
                ShadeTool.parseToUTCTime(t.currentTime, true)
            )
            ShadeTool._onTimeChange(raw)
        })
    },

    destroy: function () {
        if (ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
        }
        Map_.map.off('click', ShadeTool._onMapClick)
        Map_.map.off('moveend', ShadeTool._onPanEnd)
        TimeControl.unsubscribe('ShadeTool')

        if (ShadeTool._root) {
            ShadeTool._root.unmount()
            ShadeTool._root = null
        }

        // Clean up map layers
        const store = useShadeStore.getState()
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['shade' + id])
            Map_.rmNotNull(store.shedMarkers[id])
        }
    },

    // === Map Event Handlers ===

    _onMapClick: function (e) {
        if (e && e.latlng) {
            const store = useShadeStore.getState()
            ShadeTool.shade(
                { lng: e.latlng.lng, lat: e.latlng.lat },
                store.activeElmId
            )
        }
    },

    _onPanEnd: function () {
        const store = useShadeStore.getState()
        const el = store.elements[store.activeElmId]
        if (el && el.resolution <= store.vars?.dynamicUpdateResCutoff) {
            ShadeTool.shade(null, store.activeElmId)
        }
    },

    _onTimeChange: function (rawTime) {
        const store = useShadeStore.getState()
        const el = store.elements[store.activeElmId]
        if (el && el.resolution <= 1) {
            ShadeTool.shade(null, store.activeElmId)
        }
    },

    // === Core Shade Computation ===

    shade: function (source, activeElmId, ignoreMarker, initObj) {
        if (activeElmId == null) return

        const store = useShadeStore.getState()
        const el = store.elements[activeElmId]
        if (!el) return

        let options = initObj || store.getShadeOptions(activeElmId)
        if (!options) return

        // Find center of map
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])

        if (store.indicatorLastDragPoint)
            centerLatLng = store.indicatorLastDragPoint

        source = {
            lng: parseFloat(centerLatLng.lng),
            lat: parseFloat(centerLatLng.lat),
        }

        if (source.lng == null || source.lat == null) return

        options.color.a =
            options.opacity != null
                ? parseInt(options.opacity * 255)
                : 192

        source.height =
            !isNaN(options.height) ? parseFloat(options.height) : 2

        options.resolution = parseInt(options.resolution) || 0

        const b = Map_.map.getBounds()
        const vars = store.vars
        let dataLayer = vars.data[options.dataIndex]

        const selectedTargets = options.targets || []
        if (selectedTargets.length === 0) {
            Toast.warning('Select at least one source entity.', 6000)
            return
        }
        const hasCustom = selectedTargets.some((t) => t.value === false || t.value === 'false')
        let customAz, customEl, customRange
        if (hasCustom) {
            customAz = el.customAz
            customEl = el.customEl
            customRange = el.customRange
            if (isNaN(customAz) || isNaN(customEl) || isNaN(customRange)) {
                Toast.warning(
                    'Azimuth, Elevation and Range need to be set when using Custom Az/El source.',
                    6000
                )
                return
            }
        }

        const targetKeys = selectedTargets.map((t) => t.value).join('_')
        const shadeTag =
            activeElmId +
            'd' + dataLayer.name.replace(/ /g, '_') +
            'r' + options.resolution +
            'n' + b._northEast.lat +
            'e' + b._northEast.lng +
            's' + b._southWest.lat +
            'w' + b._southWest.lng +
            'g' + targetKeys +
            't' + options.time.replace(/ /g, '_')

        if (hasCustom) {
            store.tags[activeElmId] =
                shadeTag + `A${customAz}E${customEl}R${customRange}`
        } else {
            store.tags[activeElmId] = shadeTag
        }

        let obsRefFrame, obsBody
        if (vars?.observers) {
            for (let i = 0; i < vars.observers.length; i++) {
                if (vars.observers[i].value === options.observer) {
                    obsRefFrame = vars.observers[i].frame
                    obsBody = vars.observers[i].body
                    break
                } else if (options.observer == null) {
                    obsRefFrame = vars.observers[0].frame
                    obsBody = vars.observers[0].body
                    break
                }
            }
        }

        let demUrl = vars.dem
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl

        store.updateElement(activeElmId, {
            regenerating: true,
            loading: true,
            loadingProgress: 0,
        })

        calls.api(
            'getbands',
            {
                type: 'band',
                x: source.lat,
                y: source.lng,
                xyorll: 'll',
                bands: '[[1,1]]',
                path: demUrl,
            },
            function (data) {
                if (data[0] && data[0][1] != null) {
                    const centerHeight = data[0][1]
                    const ll2aerllPromises = selectedTargets.map((tgt) => {
                        return new Promise((resolve) => {
                            const tgtIsCustom =
                                tgt.value === false || tgt.value === 'false'
                            calls.api(
                                'll2aerll',
                                {
                                    lng: source.lng,
                                    lat: source.lat,
                                    height: centerHeight,
                                    target: tgt.value,
                                    time: options.time + ' UTC',
                                    obsRefFrame,
                                    obsBody,
                                    includeSunEarth: 'false',
                                    isCustom: tgtIsCustom,
                                    customAz: tgtIsCustom ? customAz : undefined,
                                    customEl: tgtIsCustom ? customEl : undefined,
                                    customRange: tgtIsCustom
                                        ? customRange
                                        : undefined,
                                },
                                function (s) {
                                    resolve({ ...s, _sourceTarget: tgt })
                                },
                                function () {
                                    resolve({ error: true, _sourceTarget: tgt })
                                }
                            )
                        })
                    })

                    Promise.all(ll2aerllPromises).then((results) => {
                        ShadeTool.updateRAEIndicators(
                            results[0],
                            activeElmId,
                            results
                        )

                        const validResults = results.filter((s) => !s.error)
                        if (validResults.length === 0) {
                            const msg =
                                results[0].message?.indexOf('INSUFFDATA') >= 0
                                    ? 'Insufficient SPICE kernels for this source entity and time period.'
                                    : 'LatLng to AzEl Error'
                            Toast.error(msg, 6000)
                            useShadeStore
                                .getState()
                                .updateElement(activeElmId, {
                                    regenerating: false,
                                    loading: false,
                                })
                            return
                        }

                        const primary = validResults[0]
                        useShadeStore
                            .getState()
                            .updateElement(activeElmId, {
                                raeResults: {
                                    az: primary.azimuth.toFixed(3) + '\u00B0',
                                    el: primary.elevation.toFixed(3) + '\u00B0',
                                    range:
                                        primary.range.toFixed(3) + 'km',
                                },
                                allResults: results,
                            })

                        const targetSources = validResults.map((s) => ({
                            lat: s.latitude,
                            lng: s.longitude,
                            altitude: s.horizontal_altitude,
                            az: s.azimuth,
                            el: s.elevation,
                            range: s.range,
                            _sourceTarget: s._sourceTarget,
                        }))

                        keepGoing(targetSources)
                    })
                }
            },
            function () {
                console.warn(
                    'ShadeTool: Failed to query center elevation.'
                )
                useShadeStore.getState().updateElement(activeElmId, {
                    regenerating: false,
                    loading: false,
                })
            }
        )

        function keepGoing(targetSources) {
            const currentTag = useShadeStore.getState().tags[activeElmId]

            ShadeTool_Manager.gatherTiles(
                currentTag,
                dataLayer,
                options.resolution,
                source,
                options,
                vars,
                function (progress) {
                    useShadeStore.getState().updateElement(activeElmId, {
                        loadingProgress: progress,
                        loading: true,
                    })
                },
                function (data) {
                    const resultGrids = targetSources.map((ts) =>
                        ShadeTool_Manager.computeShade(
                            currentTag,
                            ts,
                            options
                        )
                    )

                    const compositedResult =
                        resultGrids.length === 1
                            ? resultGrids[0]
                            : ShaderTool_Algorithm.compositeResults(
                                  resultGrids,
                                  options.compositeMode || 'or'
                              )

                    data.result = compositedResult

                    ShadeTool.renderResultToMap(
                        data,
                        compositedResult,
                        options,
                        activeElmId
                    )

                    const currentStore = useShadeStore.getState()
                    currentStore.lastData = data
                    currentStore.lastResultGrid = compositedResult
                    currentStore.lastOptions = options

                    currentStore.updateElement(activeElmId, {
                        regenerating: false,
                        loading: false,
                        changed: false,
                        loadingProgress: 0,
                    })
                }
            )
        }
    },

    deleteElement: function (elmId) {
        const store = useShadeStore.getState()
        Map_.rmNotNull(L_.layers.layer['shade' + elmId])
        Map_.rmNotNull(store.shedMarkers[elmId])
        delete store.canvases[elmId]
        delete store.tags[elmId]
        store.removeElement(elmId)
    },

    // === Rendering ===

    makeDataLayer: function (layerUrl, activeElmId) {
        const layerName = 'shade' + activeElmId

        Map_.rmNotNull(L_.layers.layer[layerName])

        L_.layers.layer[layerName] = L.tileLayer.gl({
            options: {
                tms: false,
                className: 'nofade',
                maxNativeZoom: Map_.map.getZoom(),
                maxZoom: 30,
            },
            fragmentShader: DataShaders['image'].frag,
            tileUrls: [layerUrl],
            uniforms: {},
            tileUrlsAsDataUrls: true,
        })
        L_.layers.layer[layerName]._noFade = true
        L_.layers.layer[layerName].setZIndex(1000)
        Map_.map.addLayer(L_.layers.layer[layerName])

        Globe_.litho.removeLayer(layerName)
    },

    renderResultToMap: function (data, resultGrid, options, activeElmId) {
        let c = document.createElement('canvas')
        const res = data.tileResolution * Math.pow(2, data.resolution)
        c.width = res
        c.height = res
        let ctx = c.getContext('2d')
        let cImgData = ctx.createImageData(res, res)
        let cData = cImgData.data

        let dl = {}
        let dlc = {}

        for (let j = 0; j <= data.outputTopLeftTile.h; j++) {
            for (let i = 0; i <= data.outputTopLeftTile.w; i++) {
                const z = data.outputTopLeftTile.z
                const x = data.outputTopLeftTile.x + i
                const y = data.outputTopLeftTile.y + j

                dl[z] = dl[z] || {}
                dl[z][Math.floor(x)] = dl[z][Math.floor(x)] || {}
                dlc[z] = dlc[z] || {}
                dlc[z][Math.floor(x)] = dlc[z][Math.floor(x)] || {}

                const tileRow =
                    (y -
                        Math.floor(data.outputTopLeftTile.y) -
                        (Math.abs(data.outputTopLeftTile.y) % 1) * 2) *
                    res
                const tileCol =
                    (x -
                        Math.floor(data.outputTopLeftTile.x) -
                        (Math.abs(data.outputTopLeftTile.x) % 1) * 2) *
                    res

                let px = 0
                let val = null
                for (let p = 0; p < cData.length; p += 4) {
                    val = resultGrid[tileRow + Math.floor(px / res)]
                    if (val != null) {
                        val = val[tileCol + (px % res)]
                        let cl
                        switch (val) {
                            case 0:
                                cl =
                                    options.invert == 0
                                        ? { r: 0, g: 0, b: 0, a: 0 }
                                        : options.color
                                break
                            case 1:
                                cl =
                                    options.invert == 0
                                        ? options.color
                                        : { r: 0, g: 0, b: 0, a: 0 }
                                break
                            case 2:
                                cl =
                                    options.invert == 0
                                        ? options.color
                                        : { r: 0, g: 0, b: 0, a: 0 }
                                break
                            case 3:
                                cl = { r: 0, g: 255, b: 0, a: 0 }
                                break
                            case 8:
                                cl = { r: 0, g: 0, b: 0, a: 0 }
                                break
                            case 9:
                                cl = { r: 255, g: 0, b: 0, a: 35 }
                                break
                            default:
                                cl = { r: 0, g: 0, b: 0, a: 0 }
                        }
                        cData[p] = cl.r
                        cData[p + 1] = cl.g
                        cData[p + 2] = cl.b
                        cData[p + 3] = cl.a
                    } else {
                        cData[p] = 0
                        cData[p + 1] = 0
                        cData[p + 2] = 0
                        cData[p + 3] = 0
                    }
                    px++
                }
                ctx.putImageData(cImgData, 0, 0)
                dl[z][Math.floor(x)][Math.floor(y)] = c.toDataURL()
                dlc[z][Math.floor(x)][Math.floor(y)] = F_.cloneCanvas(c)
            }
        }
        useShadeStore.getState().canvases[activeElmId] = dlc
        ShadeTool.makeDataLayer(dl, activeElmId)
    },

    renderHeatmapToMap: function (data, heatmap, activeElmId) {
        let c = document.createElement('canvas')
        const res = data.tileResolution * Math.pow(2, data.resolution)
        c.width = res
        c.height = res
        let ctx = c.getContext('2d')
        let cImgData = ctx.createImageData(res, res)
        let cData = cImgData.data

        let dl = {}
        let dlc = {}

        for (let j = 0; j <= data.outputTopLeftTile.h; j++) {
            for (let i = 0; i <= data.outputTopLeftTile.w; i++) {
                const z = data.outputTopLeftTile.z
                const x = data.outputTopLeftTile.x + i
                const y = data.outputTopLeftTile.y + j

                dl[z] = dl[z] || {}
                dl[z][Math.floor(x)] = dl[z][Math.floor(x)] || {}
                dlc[z] = dlc[z] || {}
                dlc[z][Math.floor(x)] = dlc[z][Math.floor(x)] || {}

                const tileRow =
                    (y -
                        Math.floor(data.outputTopLeftTile.y) -
                        (Math.abs(data.outputTopLeftTile.y) % 1) * 2) *
                    res
                const tileCol =
                    (x -
                        Math.floor(data.outputTopLeftTile.x) -
                        (Math.abs(data.outputTopLeftTile.x) % 1) * 2) *
                    res

                let px = 0
                for (let p = 0; p < cData.length; p += 4) {
                    const row = heatmap[tileRow + Math.floor(px / res)]
                    if (row != null) {
                        const frac = row[tileCol + (px % res)]
                        if (frac < 0) {
                            cData[p] = 0
                            cData[p + 1] = 0
                            cData[p + 2] = 0
                            cData[p + 3] = 0
                        } else {
                            cData[p] = Math.round(255 * (1 - frac))
                            cData[p + 1] = Math.round(255 * frac)
                            cData[p + 2] = 0
                            cData[p + 3] = 160
                        }
                    } else {
                        cData[p] = 0
                        cData[p + 1] = 0
                        cData[p + 2] = 0
                        cData[p + 3] = 0
                    }
                    px++
                }
                ctx.putImageData(cImgData, 0, 0)
                dl[z][Math.floor(x)][Math.floor(y)] = c.toDataURL()
                dlc[z][Math.floor(x)][Math.floor(y)] = F_.cloneCanvas(c)
            }
        }
        useShadeStore.getState().canvases[activeElmId] = dlc
        ShadeTool.makeDataLayer(dl, activeElmId)
    },

    // === Time-Range Sweep ===

    shadeSweep: function (startTime, endTime, stepMinutes) {
        const store = useShadeStore.getState()
        const activeElmId = store.activeElmId
        if (activeElmId == null) return

        if (ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        }

        const options = store.getShadeOptions(activeElmId)
        const selectedTargets = options.targets || []
        if (selectedTargets.length === 0) {
            Toast.warning('Select at least one source entity for sweep.', 6000)
            return
        }

        const startMs = new Date(startTime).getTime()
        const endMs = new Date(endTime).getTime()
        if (isNaN(startMs) || isNaN(endMs) || startMs > endMs) {
            Toast.warning('Invalid time range for sweep.', 6000)
            return
        }

        if (stepMinutes <= 0) {
            Toast.warning('Step must be a positive number.', 6000)
            return
        }

        const stepMs = stepMinutes * 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs) {
            timestamps.push(new Date(t).toISOString())
        }

        if (timestamps.length > 500) {
            Toast.warning(
                'Too many timesteps (max 500). Increase step size.',
                6000
            )
            return
        }

        options.color.a =
            options.opacity != null ? parseInt(options.opacity * 255) : 192
        options.resolution = parseInt(options.resolution) || 0

        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])
        if (store.indicatorLastDragPoint)
            centerLatLng = store.indicatorLastDragPoint

        const source = {
            lng: parseFloat(centerLatLng.lng),
            lat: parseFloat(centerLatLng.lat),
        }
        source.height = !isNaN(options.height)
            ? parseFloat(options.height)
            : 2

        const b = Map_.map.getBounds()
        const vars = store.vars
        const dataLayer = vars.data[options.dataIndex]

        const shadeTag =
            activeElmId +
            'd' + dataLayer.name.replace(/ /g, '_') +
            'r' + options.resolution +
            'n' + b._northEast.lat +
            'e' + b._northEast.lng +
            's' + b._southWest.lat +
            'w' + b._southWest.lng +
            'sweep_' + startMs + '_' + endMs

        ShadeTool_Manager.data[shadeTag] = null

        let obsRefFrame, obsBody
        if (vars?.observers) {
            for (let i = 0; i < vars.observers.length; i++) {
                if (vars.observers[i].value === options.observer) {
                    obsRefFrame = vars.observers[i].frame
                    obsBody = vars.observers[i].body
                    break
                } else if (options.observer == null) {
                    obsRefFrame = vars.observers[0].frame
                    obsBody = vars.observers[0].body
                    break
                }
            }
        }

        let demUrl = vars.dem
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl

        store.setSweepField('sweepProgress', 'Loading tiles...')

        calls.api(
            'getbands',
            {
                x: source.lat,
                y: source.lng,
                xyorll: 'll',
                bands: '[[1,1]]',
                path: demUrl,
            },
            function (bandData) {
                const centerHeight =
                    bandData?.[0]?.[1] != null
                        ? bandData[0][1]
                        : source.height

                ShadeTool_Manager.gatherTiles(
                    shadeTag,
                    dataLayer,
                    options.resolution,
                    source,
                    options,
                    vars,
                    function (progress) {
                        useShadeStore
                            .getState()
                            .setSweepField(
                                'sweepProgress',
                                'Tiles: ' + parseInt(progress) + '%'
                            )
                    },
                    function (data) {
                        const sweepResults = []
                        const sweepGrids = []
                        let completed = 0
                        const total = timestamps.length
                        const BATCH_SIZE = 4

                        function processBatch(batchStart) {
                            const batchEnd = Math.min(
                                batchStart + BATCH_SIZE,
                                total
                            )
                            const batchPromises = []

                            for (let ti = batchStart; ti < batchEnd; ti++) {
                                const ts = timestamps[ti]
                                const timeStr =
                                    ShadeTool.parseToUTCTime(ts)

                                const tsPromise = new Promise((resolveTs) => {
                                    const targetPromises =
                                        selectedTargets.map(
                                            (tgt) =>
                                                new Promise(
                                                    (resolveTarget) => {
                                                        calls.api(
                                                            'll2aerll',
                                                            {
                                                                lng: source.lng,
                                                                lat: source.lat,
                                                                height: centerHeight,
                                                                target: tgt.value,
                                                                time:
                                                                    timeStr +
                                                                    ' UTC',
                                                                obsRefFrame,
                                                                obsBody,
                                                                includeSunEarth:
                                                                    'false',
                                                                isCustom: false,
                                                            },
                                                            function (s) {
                                                                resolveTarget(s)
                                                            },
                                                            function () {
                                                                resolveTarget({
                                                                    error: true,
                                                                })
                                                            }
                                                        )
                                                    }
                                                )
                                        )

                                    Promise.all(targetPromises).then(
                                        (targetResults) => {
                                            const validTargets =
                                                targetResults.filter(
                                                    (s) => !s.error
                                                )
                                            if (validTargets.length > 0) {
                                                const grids =
                                                    validTargets.map((s) =>
                                                        ShadeTool_Manager.computeShade(
                                                            shadeTag,
                                                            {
                                                                lat: s.latitude,
                                                                lng: s.longitude,
                                                                altitude:
                                                                    s.horizontal_altitude,
                                                                az: s.azimuth,
                                                                el: s.elevation,
                                                                range: s.range,
                                                            },
                                                            options
                                                        )
                                                    )
                                                const compositedGrid =
                                                    grids.length === 1
                                                        ? grids[0]
                                                        : ShaderTool_Algorithm.compositeResults(
                                                              grids,
                                                              options.compositeMode ||
                                                                  'or'
                                                          )

                                                let visCount = 0
                                                let totalCells = 0
                                                for (
                                                    let y = 0;
                                                    y <
                                                    compositedGrid.length;
                                                    y++
                                                ) {
                                                    for (
                                                        let x = 0;
                                                        x <
                                                        compositedGrid[y]
                                                            .length;
                                                        x++
                                                    ) {
                                                        if (
                                                            compositedGrid[y][
                                                                x
                                                            ] !== 9
                                                        ) {
                                                            totalCells++
                                                            if (
                                                                compositedGrid[
                                                                    y
                                                                ][x] === 1 ||
                                                                compositedGrid[
                                                                    y
                                                                ][x] === 2
                                                            )
                                                                visCount++
                                                        }
                                                    }
                                                }
                                                const primary =
                                                    validTargets[0]
                                                resolveTs({
                                                    time: ts,
                                                    visibilityPct:
                                                        totalCells > 0
                                                            ? (
                                                                  (visCount /
                                                                      totalCells) *
                                                                  100
                                                              ).toFixed(2)
                                                            : 0,
                                                    azimuth: primary.azimuth,
                                                    elevation:
                                                        primary.elevation,
                                                    range: primary.range,
                                                    grid: compositedGrid,
                                                })
                                            } else {
                                                resolveTs({
                                                    time: ts,
                                                    visibilityPct: 0,
                                                    azimuth: 0,
                                                    elevation: 0,
                                                    range: 0,
                                                    grid: null,
                                                })
                                            }
                                        }
                                    )
                                })
                                batchPromises.push(tsPromise)
                            }

                            Promise.all(batchPromises).then((batchResults) => {
                                batchResults.forEach((r) => {
                                    sweepResults.push({
                                        time: r.time,
                                        visibilityPct: r.visibilityPct,
                                        azimuth: r.azimuth,
                                        elevation: r.elevation,
                                        range: r.range,
                                    })
                                    sweepGrids.push(r.grid || null)
                                })
                                completed += batchResults.length

                                const currentStore =
                                    useShadeStore.getState()
                                currentStore.setSweepField(
                                    'sweepProgress',
                                    'Sweep: ' +
                                        parseInt(
                                            (completed / total) * 100
                                        ) +
                                        '%'
                                )

                                if (completed >= total) {
                                    currentStore.setSweepField(
                                        'sweepResults',
                                        sweepResults
                                    )
                                    currentStore.setSweepField(
                                        'sweepGrids',
                                        sweepGrids
                                    )
                                    currentStore.setSweepField(
                                        'sweepPlayIndex',
                                        0
                                    )
                                    currentStore.lastData = data
                                    currentStore.lastOptions = options
                                    currentStore.setSweepField(
                                        'sweepProgress',
                                        'Done (' + total + ' steps)'
                                    )
                                    Toast.success(
                                        'Sweep complete. ' +
                                            total +
                                            ' timesteps processed.',
                                        4000
                                    )

                                    if (sweepGrids.length > 0) {
                                        const heatmap =
                                            ShaderTool_Algorithm.cumulativeVisibility(
                                                sweepGrids
                                            )
                                        ShadeTool.renderHeatmapToMap(
                                            data,
                                            heatmap,
                                            activeElmId
                                        )
                                    }
                                } else {
                                    processBatch(batchEnd)
                                }
                            })
                        }

                        processBatch(0)
                    }
                )
            },
            function () {
                Toast.error(
                    'Failed to query terrain elevation for sweep.',
                    6000
                )
                useShadeStore
                    .getState()
                    .setSweepField('sweepProgress', '')
            }
        )
    },

    shadeSweepAll: function (startTime, endTime, stepMinutes) {
        const store = useShadeStore.getState()
        const activeIds = Object.keys(store.elements).filter(
            (id) => store.elements[id].on
        )
        if (activeIds.length === 0) {
            Toast.warning('Enable at least one shade map for sweep.', 6000)
            return
        }
        activeIds.forEach((id) => {
            store.setActiveElmId(parseInt(id))
            ShadeTool.shadeSweep(startTime, endTime, stepMinutes)
        })
    },

    // === Sweep Playback ===

    sweepPlay: function () {
        const store = useShadeStore.getState()
        if (!store.sweepGrids || store.sweepGrids.length === 0) return

        if (store.sweepPlaying) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        } else {
            store.setSweepField('sweepPlaying', true)
            ShadeTool._sweepPlayTimer = setInterval(function () {
                const s = useShadeStore.getState()
                const nextIdx =
                    (s.sweepPlayIndex + 1) % s.sweepGrids.length
                s.setSweepField('sweepPlayIndex', nextIdx)
                ShadeTool.sweepShowFrame(s.activeElmId)
            }, store.sweepPlaySpeed)
        }
    },

    sweepStepForward: function () {
        const store = useShadeStore.getState()
        if (!store.sweepGrids || store.sweepGrids.length === 0) return
        const nextIdx =
            (store.sweepPlayIndex + 1) % store.sweepGrids.length
        store.setSweepField('sweepPlayIndex', nextIdx)
        ShadeTool.sweepShowFrame(store.activeElmId)
    },

    sweepStepBack: function () {
        const store = useShadeStore.getState()
        if (!store.sweepGrids || store.sweepGrids.length === 0) return
        const nextIdx =
            (store.sweepPlayIndex - 1 + store.sweepGrids.length) %
            store.sweepGrids.length
        store.setSweepField('sweepPlayIndex', nextIdx)
        ShadeTool.sweepShowFrame(store.activeElmId)
    },

    sweepShowFrame: function (activeElmId) {
        const store = useShadeStore.getState()
        const idx = store.sweepPlayIndex
        const grid = store.sweepGrids[idx]
        const data = store.lastData
        const options = store.lastOptions

        if (!grid || !data || !options) return

        ShadeTool.renderResultToMap(data, grid, options, activeElmId)

        const label = store.sweepResults?.[idx]?.time || ''
        const frameLabel = document.getElementById('vstSweepFrameLabel')
        if (frameLabel) frameLabel.textContent = label
    },

    updateSweepSpeed: function (speed) {
        const store = useShadeStore.getState()
        if (store.sweepPlaying && ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = setInterval(function () {
                const s = useShadeStore.getState()
                const nextIdx =
                    (s.sweepPlayIndex + 1) % s.sweepGrids.length
                s.setSweepField('sweepPlayIndex', nextIdx)
                ShadeTool.sweepShowFrame(s.activeElmId)
            }, speed)
        }
    },

    // === Export ===

    exportPNG: function (elmId) {
        const dlc = useShadeStore.getState().canvases[elmId]
        if (!dlc) {
            Toast.warning('No shade map to export. Generate first.', 6000)
            return
        }
        let allCanvases = []
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity
        let tileSize = 0

        for (let z in dlc) {
            for (let x in dlc[z]) {
                for (let y in dlc[z][x]) {
                    const cx = parseInt(x)
                    const cy = parseInt(y)
                    if (cx < minX) minX = cx
                    if (cx > maxX) maxX = cx
                    if (cy < minY) minY = cy
                    if (cy > maxY) maxY = cy
                    allCanvases.push({ x: cx, y: cy, canvas: dlc[z][x][y] })
                    if (dlc[z][x][y].width > tileSize)
                        tileSize = dlc[z][x][y].width
                }
            }
        }

        if (allCanvases.length === 0) return

        const cols = maxX - minX + 1
        const rows = maxY - minY + 1
        const compositeCanvas = document.createElement('canvas')
        compositeCanvas.width = cols * tileSize
        compositeCanvas.height = rows * tileSize
        const compositeCtx = compositeCanvas.getContext('2d')

        allCanvases.forEach((tc) => {
            compositeCtx.drawImage(
                tc.canvas,
                (tc.x - minX) * tileSize,
                (tc.y - minY) * tileSize
            )
        })

        compositeCanvas.toBlob(function (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('download', 'shade_map.png')
            link.setAttribute('href', url)
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        })
    },

    exportCSV: function () {
        const store = useShadeStore.getState()
        if (!store.sweepResults || store.sweepResults.length === 0) {
            Toast.warning(
                'No sweep results to export. Run a time sweep first.',
                6000
            )
            return
        }
        const headers = [
            'time',
            'visibility_pct',
            'azimuth',
            'elevation',
            'range',
        ]
        const rows = store.sweepResults.map((r) => [
            r.time,
            r.visibilityPct,
            r.azimuth,
            r.elevation,
            r.range,
        ])
        F_.downloadArrayAsCSV(headers, rows, 'shade_sweep_results')
    },

    exportGeoJSON: function (elmId) {
        const store = useShadeStore.getState()
        const data = store.lastData
        const resultGrid = store.lastResultGrid
        if (!data || !resultGrid) {
            Toast.warning(
                'No shade results to export. Generate first.',
                6000
            )
            return
        }

        const features = []
        const tileRes = data.tileResolution
        const topLeft = data.topLeftTile
        const zoom = topLeft.z

        for (let y = 0; y < resultGrid.length; y++) {
            for (let x = 0; x < resultGrid[y].length; x++) {
                const val = resultGrid[y][x]
                if (val === 9 || val === 8) continue

                const tileX = topLeft.x + x / tileRes
                const tileY = topLeft.y + y / tileRes
                const ll = Globe_.litho.projection.tileXYZ2LatLng(
                    tileX,
                    tileY,
                    zoom
                )
                const ll2 = Globe_.litho.projection.tileXYZ2LatLng(
                    tileX + 1 / tileRes,
                    tileY + 1 / tileRes,
                    zoom
                )

                features.push({
                    type: 'Feature',
                    properties: {
                        visibility:
                            val === 1 || val === 2 ? 'visible' : 'shadowed',
                        value: val,
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [ll.lng, ll.lat],
                                [ll2.lng, ll.lat],
                                [ll2.lng, ll2.lat],
                                [ll.lng, ll2.lat],
                                [ll.lng, ll.lat],
                            ],
                        ],
                    },
                })
            }
        }

        F_.downloadObject(
            { type: 'FeatureCollection', features },
            'shade_map',
            '.geojson'
        )
    },

    exportReport: function (elmId) {
        const store = useShadeStore.getState()
        const options = store.getShadeOptions(elmId)
        const el = store.elements[elmId]
        const report = {
            parameters: {
                sources: (options?.targets || []).map((t) => t.value),
                compositeMode: options?.compositeMode,
                time: options?.time,
                observer: options?.observer,
                resolution: options?.resolution,
                height: options?.height,
                dataIndex: options?.dataIndex,
            },
            results: {
                azimuth: el?.raeResults?.az || '--',
                elevation: el?.raeResults?.el || '--',
                range: el?.raeResults?.range || '--',
            },
            sweep:
                store.sweepResults?.length > 0 ? store.sweepResults : null,
        }
        F_.downloadObject(report, 'shade_report', '.json')
    },

    // === RAE Indicators (preserved exactly from ShadeTool) ===

    updateRAEIndicators(rae, shadeId, allResults) {
        const size = 240
        const sizeInner = 220
        const origin = { x: size / 2, y: size / 2 }

        const indicatorEl = document.querySelector(
            `#vstId_${shadeId} #shadeTool_indicators`
        )
        if (indicatorEl) {
            indicatorEl.style.borderBottom = rae.error
                ? '3px solid var(--color-red)'
                : 'none'
        }

        // Azimuth
        const azValueEl = document.querySelector(
            `#vstId_${shadeId} #shadeTool_azValue`
        )
        if (azValueEl) {
            azValueEl.textContent = rae.error
                ? 'Error'
                : rae.azimuth.toFixed(2) + '\u00B0'
        }
        const cAz = document.querySelector(
            `#vstId_${shadeId} #shadeTool_az`
        )
        if (!cAz) return
        cAz.width = size
        cAz.height = size
        const ctxAz = cAz.getContext('2d')

        ctxAz.clearRect(0, 0, cAz.width, cAz.height)

        ctxAz.beginPath()
        ctxAz.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxAz.fillStyle = 'rgba(255,255,255,0.1)'
        ctxAz.fill()
        ctxAz.strokeStyle = 'black'
        ctxAz.lineWidth = 2
        ctxAz.stroke()

        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(origin.x, size - (size - sizeInner) / 2)
        ctxAz.lineTo(origin.x, (size - sizeInner) / 2)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxAz.stroke()

        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(size - (size - sizeInner) / 2, origin.y)
        ctxAz.lineTo((size - sizeInner) / 2, origin.y)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxAz.stroke()

        let azGreaterThan180
        let sunAzGreaterThan180
        let earthAzGreaterThan180
        if (rae.error != true) {
            ctxAz.font = '20px Arial'
            ctxAz.fillStyle = 'rgba(255,255,255,0.7)'
            ctxAz.textAlign = 'center'
            ctxAz.fillText('N', size / 2, (size - sizeInner) * 1.5)

            if (rae.ancillary?.sun_az) {
                let azim = rae.ancillary.sun_az
                if (azim < 0) azim += 360
                sunAzGreaterThan180 = azim > 180
                azim = azim * (Math.PI / 180)
                ShadeTool.drawAzAngleGuideOnCanvas(
                    ctxAz,
                    origin,
                    sizeInner,
                    rae.ancillary.sun_az,
                    azim,
                    { color: sunColor, shortenPx: 40 }
                )
            }
            if (rae.ancillary?.earth_az) {
                let azim = rae.ancillary.earth_az
                if (azim < 0) azim += 360
                earthAzGreaterThan180 = azim > 180
                azim = azim * (Math.PI / 180)
                ShadeTool.drawAzAngleGuideOnCanvas(
                    ctxAz,
                    origin,
                    sizeInner,
                    rae.ancillary.earth_az,
                    azim,
                    { color: earthColor, shortenPx: 60 }
                )
            }
            let azim = rae.azimuth
            if (azim < 0) azim += 360
            azGreaterThan180 = azim > 180
            azim = azim * (Math.PI / 180)
            ShadeTool.drawAzAngleGuideOnCanvas(
                ctxAz,
                origin,
                sizeInner,
                rae.azimuth,
                azim,
                {
                    angleGuide: true,
                    color:
                        rae.ancillary?.sun_el || rae.ancillary?.earth_el
                            ? '#dbb658'
                            : 'yellow',
                }
            )

            if (allResults && allResults.length > 1) {
                for (let si = 1; si < allResults.length; si++) {
                    const sr = allResults[si]
                    if (sr.error || sr.azimuth == null) continue
                    let srAz = sr.azimuth
                    if (srAz < 0) srAz += 360
                    const srAzRad = srAz * (Math.PI / 180)
                    const srcColor =
                        MULTI_SOURCE_COLORS[
                            (sr._sourceTarget?.index || si) %
                                MULTI_SOURCE_COLORS.length
                        ]
                    ShadeTool.drawAzAngleGuideOnCanvas(
                        ctxAz,
                        origin,
                        sizeInner,
                        sr.azimuth,
                        srAzRad,
                        {
                            color: `rgb(${srcColor.r},${srcColor.g},${srcColor.b})`,
                            shortenPx: 20 + si * 10,
                        }
                    )
                }
            }
        }

        // Elevation
        const elValueEl = document.querySelector(
            `#vstId_${shadeId} #shadeTool_elValue`
        )
        if (elValueEl) {
            elValueEl.textContent = rae.error
                ? 'Error'
                : rae.elevation.toFixed(2) + '\u00B0'
        }
        const cEl = document.querySelector(
            `#vstId_${shadeId} #shadeTool_el`
        )
        if (!cEl) return
        cEl.width = size
        cEl.height = size
        const ctxEl = cEl.getContext('2d')

        ctxEl.clearRect(0, 0, cEl.width, cEl.height)

        ctxEl.beginPath()
        ctxEl.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxEl.fillStyle = 'rgba(255,255,255,0.1)'
        ctxEl.fill()
        ctxEl.strokeStyle = 'black'
        ctxEl.lineWidth = 2
        ctxEl.stroke()

        ctxEl.beginPath()
        ctxEl.moveTo(origin.x, origin.y)
        ctxEl.arc(origin.x, origin.y, sizeInner / 2, 0, Math.PI, true)
        const sky = ctxEl.createLinearGradient(0, 0, 0, sizeInner / 2)
        sky.addColorStop(
            0,
            rae.error
                ? 'rgba(210, 0, 0, 0.25)'
                : 'rgba(8, 174, 234, 0.25)'
        )
        sky.addColorStop(
            1,
            rae.error
                ? 'rgba(255, 92, 92, 0.25)'
                : 'rgba(255, 255, 255, 0.25)'
        )
        ctxEl.fillStyle = sky
        ctxEl.fill()

        ctxEl.beginPath()
        ctxEl.beginPath()
        ctxEl.moveTo(origin.x, size - (size - sizeInner) / 2)
        ctxEl.lineTo(origin.x, (size - sizeInner) / 2)
        ctxEl.lineWidth = 1
        ctxEl.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxEl.stroke()

        if (rae.error != true) {
            if (rae.ancillary?.sun_el) {
                ShadeTool.drawElAngleGuideOnCanvas(
                    ctxEl,
                    origin,
                    sizeInner,
                    rae.ancillary.sun_el,
                    {
                        azGreaterThan180: sunAzGreaterThan180,
                        color: sunColor,
                        shortenPx: 40,
                    }
                )
            }
            if (rae.ancillary?.earth_el) {
                ShadeTool.drawElAngleGuideOnCanvas(
                    ctxEl,
                    origin,
                    sizeInner,
                    rae.ancillary.earth_el,
                    {
                        azGreaterThan180: earthAzGreaterThan180,
                        color: earthColor,
                        shortenPx: 60,
                    }
                )
            }

            ShadeTool.drawElAngleGuideOnCanvas(
                ctxEl,
                origin,
                sizeInner,
                rae.elevation,
                {
                    azGreaterThan180: azGreaterThan180,
                    angleGuide: true,
                    color:
                        rae.ancillary?.sun_el || rae.ancillary?.earth_el
                            ? '#dbb658'
                            : 'yellow',
                }
            )
        }
    },

    drawAzAngleGuideOnCanvas(ctx, origin, sizeInner, angle, angle2, options) {
        options = options || {}
        if (options.angleGuide) {
            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)
            ctx.arc(
                origin.x,
                origin.y,
                sizeInner / 8,
                -90 * (Math.PI / 180),
                angle2 - 90 * (Math.PI / 180)
            )
            ctx.lineWidth = 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        const endAzPt = F_.rotatePoint(
            {
                x: origin.x,
                y:
                    origin.y -
                    sizeInner / 2 +
                    10 +
                    (options.shortenPx || 0),
            },
            [origin.x, origin.y],
            angle * (Math.PI / 180)
        )

        ctx.beginPath()
        ctx.beginPath()
        ctx.moveTo(origin.x, origin.y)
        ctx.lineTo(endAzPt.x, endAzPt.y)
        ctx.lineWidth = 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        const endAzPtInner = F_.rotatePoint(
            {
                x: origin.x,
                y:
                    origin.y -
                    sizeInner / 2 +
                    20 +
                    (options.shortenPx || 0),
            },
            [origin.x, origin.y],
            angle * (Math.PI / 180)
        )
        F_.canvasDrawArrow(
            ctx,
            endAzPtInner.x,
            endAzPtInner.y,
            endAzPt.x,
            endAzPt.y,
            4,
            options.color || 'yellow'
        )
    },

    drawElAngleGuideOnCanvas(ctx, origin, sizeInner, angle, options) {
        options = options || {}
        if (options.angleGuide) {
            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)
            let elev = angle
            let ccw = true
            if (elev < 0) ccw = false
            let startAngle = 0
            if (options.azGreaterThan180) {
                startAngle = Math.PI
                ccw = !ccw
                elev = -elev - 180
            }
            elev = -elev * (Math.PI / 180)
            ctx.arc(origin.x, origin.y, sizeInner / 4, startAngle, elev, ccw)
            ctx.lineWidth = 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        let sign = -1
        let offset = 0
        if (options.azGreaterThan180) {
            sign = 1
            offset = 180
        }

        const endElPt = F_.rotatePoint(
            {
                x:
                    origin.x +
                    sizeInner / 2 -
                    10 -
                    (options.shortenPx || 0),
                y: origin.y,
            },
            [origin.x, origin.y],
            sign * (offset + angle) * (Math.PI / 180)
        )

        ctx.beginPath()
        ctx.beginPath()
        ctx.moveTo(origin.x, origin.y)
        ctx.lineTo(endElPt.x, endElPt.y)
        ctx.lineWidth = 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        const endElPtInner = F_.rotatePoint(
            {
                x:
                    origin.x +
                    sizeInner / 2 -
                    20 -
                    (options.shortenPx || 0),
                y: origin.y,
            },
            [origin.x, origin.y],
            sign * (offset + angle) * (Math.PI / 180)
        )
        F_.canvasDrawArrow(
            ctx,
            endElPtInner.x,
            endElPtInner.y,
            endElPt.x,
            endElPt.y,
            4,
            options.color || 'yellow'
        )
    },

    // === Utility ===

    parseToUTCTime(time, formatted) {
        const vars = useShadeStore.getState().vars
        if (formatted && vars?.utcTimeFormat) {
            const tF = utcFormat(vars.utcTimeFormat)
            return tF(Date.parse(time))
        }
        return (
            time.substring(0, 4) +
            ' ' +
            F_.monthNumberToName(
                parseInt(time.substring(5, 7)) - 1
            ).toUpperCase() +
            ' ' +
            time.substring(8, 10) +
            ' ' +
            time.substring(11, 19)
        )
    },

    // Imperative getters for backward compatibility
    getShadeOptions: (elmId) => useShadeStore.getState().getShadeOptions(elmId),
    getSelectedSources: (elmId) =>
        useShadeStore.getState().getSelectedSources(elmId),
}

export default ShadeTool
