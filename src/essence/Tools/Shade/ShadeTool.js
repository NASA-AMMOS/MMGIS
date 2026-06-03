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
import TimeUI from '../../Basics/TimeControl_/TimeUI'

import calls from '../../../pre/calls'
import {
    data as colormapData,
    evaluate_cmap,
} from '../../../external/js-colormaps/js-colormaps.js'

import ShadeTool_Manager from './ShadeTool_Manager'
import ShaderTool_Algorithm from './ShadeTool_Algorithm'
import ShadeTool_Graphs from './ShadeTool_Graphs'

import useShadeStore, { MULTI_SOURCE_COLORS } from './store'
import ShadePanel from './components/ShadePanel'

import './ShadeTool.css'

const sunColor = '#d2db58'
const earthColor = '#58dbb8'

let _compositeHoverRaf = null
let _timeChangeDebounce = null

let ShadeTool = {
    height: 0,
    width: 280,
    _root: null,
    _sweepPlayTimer: null,
    _sweepRunId: 0,

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
        // sweepStart/sweepEnd initialization is handled by ShadePanel's useEffect on mount

        if (Object.keys(store.elements).length === 0) {
            store.addElement()
        }

        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        ShadeTool._root = createRoot(toolPanel)
        ShadeTool._root.render(<ShadePanel />)

        // Add center crosshair overlay
        ShadeTool._addCenterCrosshair()

        // Register graph scrub callback for bidirectional sync
        ShadeTool_Graphs.registerScrubCallback(() => {
            ShadeTool.sweepShowAllFrames()
        })

        Map_.map.on('click', ShadeTool._onMapClick)
        Map_.map.on('moveend', ShadeTool._onPanEnd)
        Map_.map.on('mousemove', ShadeTool._onCompositeHover)
        Map_.map.on('mouseout', ShadeTool._onCompositeHoverEnd)

        TimeControl.subscribe('ShadeTool', (t) => {
            const raw = ShadeTool.parseToUTCTime(t.currentTime)
            const store = useShadeStore.getState()
            store.setSweepField('rawTime', raw)
            store.setSweepField(
                'utcTime',
                ShadeTool.parseToUTCTime(t.currentTime, true)
            )
            // sweepStart/sweepEnd sync is handled by ShadePanel's TimeControl subscription
            ShadeTool._onTimeChange(raw)
        })
    },

    destroy: function () {
        if (ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
        }
        if (_compositeHoverRaf) {
            cancelAnimationFrame(_compositeHoverRaf)
            _compositeHoverRaf = null
        }
        if (_timeChangeDebounce) {
            clearTimeout(_timeChangeDebounce)
            _timeChangeDebounce = null
        }
        Map_.map.off('click', ShadeTool._onMapClick)
        Map_.map.off('moveend', ShadeTool._onPanEnd)
        Map_.map.off('mousemove', ShadeTool._onCompositeHover)
        Map_.map.off('mouseout', ShadeTool._onCompositeHoverEnd)

        TimeControl.unsubscribe('ShadeTool')

        // Remove center crosshair
        ShadeTool._removeCenterCrosshair()

        // Close bottom bar graphs
        ShadeTool_Graphs.cleanup()

        // Remove TimeUI indicators
        TimeUI.removeIndicator(null, 'shadetool')

        if (ShadeTool._root) {
            ShadeTool._root.unmount()
            ShadeTool._root = null
        }

        // Clean up map layers and caches
        ShadeTool._cachedLayers = {}
        const store = useShadeStore.getState()
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['shade' + id])
            Map_.rmNotNull(store.shedMarkers[id])
        }
    },

    // === Center Crosshair ===

    _addCenterCrosshair() {
        if (document.getElementById('shadeCenterCrosshair')) return
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        const ch = document.createElement('div')
        ch.id = 'shadeCenterCrosshair'
        ch.className = 'shadeCenterCrosshair'
        ch.innerHTML = '<div class="shadeCrosshairH"></div><div class="shadeCrosshairV"></div>'
        mapEl.appendChild(ch)
        Map_.map.on('move', ShadeTool._updateCrosshairPosition)
    },

    _removeCenterCrosshair() {
        const ch = document.getElementById('shadeCenterCrosshair')
        if (ch) ch.remove()
        Map_.map.off('move', ShadeTool._updateCrosshairPosition)
        ShadeTool_Graphs.removeAzimuthLine()
    },

    _updateCrosshairPosition() {
        const ch = document.getElementById('shadeCenterCrosshair')
        if (!ch) return
        const store = useShadeStore.getState()
        // Find sweep center from active element
        const activeId = store.activeElmId
        const ed = activeId != null ? store.sweepElData[activeId] : null
        if (ed?.sweepCenter) {
            const pt = Map_.map.latLngToContainerPoint(ed.sweepCenter)
            ch.style.left = pt.x + 'px'
            ch.style.top = pt.y + 'px'
        } else {
            const mapEl = document.getElementById('map')
            if (mapEl) {
                ch.style.left = '50%'
                ch.style.top = '50%'
            }
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

        // Invalidate horizon profile cache on pan
        ShadeTool_Graphs.invalidateHorizonCache()

        // Invalidate sweep results and layer cache when viewport changes
        if (store.hasSweepData() && !store.sweepStale) {
            store.setSweepField('sweepStale', true)
            ShadeTool._cachedLayers = {}
            for (const id in store.sweepElData) {
                store.setSweepElField(parseInt(id), 'hoverFrac', null)
            }
            // Stop playback if running
            if (ShadeTool._sweepPlayTimer) {
                clearInterval(ShadeTool._sweepPlayTimer)
                ShadeTool._sweepPlayTimer = null
                store.setSweepField('sweepPlaying', false)
            }
            // Remove the heatmap/atlas layer from the map for static elements only;
            // composite/playback keep their (stale) layer visible until user re-sweeps
            for (const id in store.elements) {
                const el = store.elements[id]
                if (el && (el.shadeMode === 'composite' || el.shadeMode === 'playback')) continue
                Map_.rmNotNull(L_.layers.layer['shade' + id])
                L_.layers.layer['shade' + id] = null
            }
        }

        for (const id in store.elements) {
            const el = store.elements[id]
            if (!el) continue
            // Composite/playback: don't auto-regenerate — just re-enable sweep button
            if (el.shadeMode === 'composite' || el.shadeMode === 'playback') continue
            if (el.resolution <= (store.vars?.dynamicUpdateResCutoff ?? 1)) {
                ShadeTool.shade(null, parseInt(id))
            } else {
                store.updateElement(parseInt(id), { changed: true, lastError: false })
            }
        }
    },

    _onCompositeHover: function (e) {
        if (_compositeHoverRaf) return
        const lat = e.latlng.lat
        const lng = e.latlng.lng
        _compositeHoverRaf = requestAnimationFrame(() => {
            _compositeHoverRaf = null
            const store = useShadeStore.getState()

            for (const id in store.sweepElData) {
                const ed = store.sweepElData[id]
                const el = store.elements[id]
                if (!ed?.heatmap || !ed?.lastData || el?.shadeMode !== 'composite') continue
                const data = ed.lastData
                const heatmap = ed.heatmap
                const tileRes = data.tileResolution
                const topLeft = data.topLeftTile
                const zoom = topLeft.z

                const tile = Globe_.litho.projection.latLngZ2TileXYZ(lat, lng, zoom, true)
                const col = Math.floor((tile.x - topLeft.x) * tileRes)
                const row = Math.floor((tile.y - topLeft.y) * tileRes)

                if (row < 0 || col < 0 || row >= heatmap.length || !heatmap[row] || col >= heatmap[row].length) {
                    store.setSweepElField(parseInt(id), 'hoverFrac', null)
                    continue
                }

                const frac = heatmap[row][col]
                if (frac == null || frac < 0 || !Number.isFinite(frac)) {
                    store.setSweepElField(parseInt(id), 'hoverFrac', null)
                } else {
                    store.setSweepElField(parseInt(id), 'hoverFrac', frac)
                }
            }
        })
    },

    _onCompositeHoverEnd: function () {
        const store = useShadeStore.getState()
        for (const id in store.sweepElData) {
            store.setSweepElField(parseInt(id), 'hoverFrac', null)
        }
    },

    _onTimeChange: function (rawTime) {
        if (_timeChangeDebounce) clearTimeout(_timeChangeDebounce)
        _timeChangeDebounce = setTimeout(() => {
            const store = useShadeStore.getState()
            for (const id in store.elements) {
                const el = store.elements[id]
                if (!el) continue
                if (el.resolution <= 1) {
                    ShadeTool.shade(null, parseInt(id))
                } else {
                    store.updateElement(parseInt(id), { changed: true, lastError: false })
                }
            }
        }, 300)
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

        // Always render pixels at full alpha; CSS setOpacity controls visual opacity
        options.color.a = 255

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
                                    lastError: true,
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
                                raeRaw: results[0],
                                raeAllResults: results,
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
                } else {
                    console.warn(
                        'ShadeTool: getbands returned null elevation data.'
                    )
                    useShadeStore.getState().updateElement(activeElmId, {
                        regenerating: false,
                        loading: false,
                        lastError: true,
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
                    lastError: true,
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
                    // Also store per-element for correct export
                    currentStore.updateElement(activeElmId, {
                        lastData: data,
                        lastResultGrid: compositedResult,
                    })

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

    toggleElementVisibility: function (elmId, on) {
        const layerName = 'shade' + elmId
        const layer = L_.layers.layer[layerName]
        if (!layer) return
        if (on) {
            if (!Map_.map.hasLayer(layer)) Map_.map.addLayer(layer)
        } else {
            if (Map_.map.hasLayer(layer)) Map_.map.removeLayer(layer)
        }
    },

    // Switch a single element between static/composite/playback display
    // Per-element cached layers: { [elmId]: { composite: layer, playback: layer } }
    _cachedLayers: {},

    switchElementMode: function (elmId, mode) {
        const store = useShadeStore.getState()
        const el = store.elements[elmId]
        if (!el) return
        const layerName = 'shade' + elmId

        // Remove existing layer from the map (clear previous mode's render)
        if (L_.layers.layer[layerName]) {
            Map_.map.removeLayer(L_.layers.layer[layerName])
            L_.layers.layer[layerName] = null
        }
        // Also remove via Globe_ in case it was added as a litho layer
        try { Globe_.litho.removeLayer(layerName) } catch (e) { /* ignore */ }
    },

    // Show regular shade map layers, remove sweep layers from map
    showShademapLayers: function () {
        const store = useShadeStore.getState()
        for (const id in store.elements) {
            const el = store.elements[id]
            if (el?.on && el?.lastData && el?.lastResultGrid) {
                const options = store.getShadeOptions(parseInt(id))
                options.color.a = 255
                ShadeTool.renderResultToMap(el.lastData, el.lastResultGrid, options, parseInt(id))
            }
        }
    },

    // Show sweep layers (composite heatmaps), remove regular shade layers from map
    showSweepLayers: function () {
        const store = useShadeStore.getState()
        // Remove all regular shade layers first
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['shade' + id])
            L_.layers.layer['shade' + id] = null
        }
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.heatmap && ed?.lastData) {
                ShadeTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
            }
        }
    },

    // Remove all shade/sweep layers from the map
    clearAllShadeLayers: function () {
        const store = useShadeStore.getState()
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['shade' + id])
            L_.layers.layer['shade' + id] = null
            delete ShadeTool._cachedLayers[id]
        }
    },

    deleteElement: function (elmId) {
        const store = useShadeStore.getState()
        Map_.rmNotNull(L_.layers.layer['shade' + elmId])
        Map_.rmNotNull(store.shedMarkers[elmId])
        delete store.canvases[elmId]
        delete store.tags[elmId]
        delete ShadeTool._cachedLayers[elmId]
        store.removeElement(elmId)
    },

    // === Rendering ===

    makeDataLayer: function (layerUrl, activeElmId) {
        const layerName = 'shade' + activeElmId

        // Invalidate cached layer for current mode since we're creating a new one
        if (ShadeTool._cachedLayers[activeElmId]) {
            const el = useShadeStore.getState().elements[activeElmId]
            if (el) delete ShadeTool._cachedLayers[activeElmId][el.shadeMode]
        }

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
        const store = useShadeStore.getState()
        store.updateElement(activeElmId, { on: true })
        const el = store.elements[activeElmId]
        if (el && el.opacity != null) {
            L_.layers.layer[layerName].setOpacity(el.opacity)
        }

        Globe_.litho.removeLayer(layerName)
    },

    renderResultToTileData: function (data, resultGrid, options) {
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
        return { dl, dlc }
    },

    renderResultToMap: function (data, resultGrid, options, activeElmId) {
        const { dl, dlc } = ShadeTool.renderResultToTileData(
            data,
            resultGrid,
            options
        )
        useShadeStore.getState().canvases[activeElmId] = dlc
        ShadeTool.makeDataLayer(dl, activeElmId)
    },

    // Lightweight version for atlas building — only returns canvas objects
    // without calling toDataURL() or cloneCanvas() (avoids expensive PNG encoding)
    _renderFrameCanvases: function (data, resultGrid, options) {
        const res = data.tileResolution * Math.pow(2, data.resolution)
        let c = document.createElement('canvas')
        c.width = res
        c.height = res
        let ctx = c.getContext('2d')
        let cImgData = ctx.createImageData(res, res)
        let cData = cImgData.data

        let canvases = {}

        for (let j = 0; j <= data.outputTopLeftTile.h; j++) {
            for (let i = 0; i <= data.outputTopLeftTile.w; i++) {
                const z = data.outputTopLeftTile.z
                const x = Math.floor(data.outputTopLeftTile.x + i)
                const y = Math.floor(data.outputTopLeftTile.y + j)

                canvases[z] = canvases[z] || {}
                canvases[z][x] = canvases[z][x] || {}

                const tileRow =
                    (data.outputTopLeftTile.y + j -
                        Math.floor(data.outputTopLeftTile.y) -
                        (Math.abs(data.outputTopLeftTile.y) % 1) * 2) *
                    res
                const tileCol =
                    (data.outputTopLeftTile.x + i -
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
                                cl = options.invert == 0
                                    ? { r: 0, g: 0, b: 0, a: 0 }
                                    : options.color
                                break
                            case 1:
                            case 2:
                                cl = options.invert == 0
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
                // Clone canvas without toDataURL — just copy pixel data
                const clone = document.createElement('canvas')
                clone.width = res
                clone.height = res
                clone.getContext('2d').drawImage(c, 0, 0)
                canvases[z][x][y] = clone
            }
        }
        return canvases
    },

    // Returns the list of available sweep color ramp definitions.
    // Each entry: { name, label, colors (0-1 RGB arrays), reverse, bins }
    // 'shadow' is always present. Additional ramps come from the tool's
    // config variable "sweepColorRamps" which references js-colormaps names.
    getSweepColorRamps: function () {
        const vars = useShadeStore.getState().vars || {}
        const configured = vars.sweepColorRamps || [
            { name: 'viridis' },
            { name: 'plasma' },
            { name: 'Greys' },
            { name: 'RdYlGn_r' },
        ]

        const ramps = [{
            name: 'shadow',
            label: 'Shadow',
            colors: Array.from({ length: 64 }, () => [0.0, 0.0, 0.0]),
            reverse: false,
            bins: 2,
        }]

        for (const cfg of configured) {
            const rawName = cfg.name || cfg
            let cmapName = rawName
            let reverse = false
            if (cmapName.toLowerCase().endsWith('_r')) {
                cmapName = cmapName.substring(0, cmapName.length - 2)
                reverse = true
            }
            const cmapKey = Object.keys(colormapData).find(
                (k) => k.toLowerCase() === cmapName.toLowerCase()
            )
            if (!cmapKey) continue
            const entry = colormapData[cmapKey]
            let colors = entry.colors
            if (reverse) colors = [...colors].reverse()
            ramps.push({
                name: rawName,
                label: cfg.label || rawName,
                colors: colors,
                reverse: false,
                bins: Math.min(cfg.bins || 6, 12),
            })
        }
        return ramps
    },

    // Evaluate a color from a ramp at position t [0..1].
    // In discrete mode, snaps to one of `bins` equal-width bins.
    evalColor: function (colors, t, discrete, bins) {
        if (!colors || colors.length === 0) return [0, 0, 0]
        const tc = Math.max(0, Math.min(1, t))
        const n = colors.length - 1
        if (discrete && bins > 0) {
            const binIdx = Math.min(Math.floor(tc * bins), bins - 1)
            const binCenter = (binIdx + 0.5) / bins
            const ci = Math.min(Math.floor(binCenter * n), n)
            return colors[ci]
        }
        const scaled = tc * n
        const lo = Math.min(Math.floor(scaled), n)
        const hi = Math.min(lo + 1, n)
        const f = scaled - lo
        return [
            colors[lo][0] + (colors[hi][0] - colors[lo][0]) * f,
            colors[lo][1] + (colors[hi][1] - colors[lo][1]) * f,
            colors[lo][2] + (colors[hi][2] - colors[lo][2]) * f,
        ]
    },

    // Evaluate color in discrete mode using custom stops for bin boundaries.
    // Falls back to equal-width bins if stops are null/invalid.
    evalColorWithStops: function (colors, t, bins, stops) {
        if (!colors || colors.length === 0) return [0, 0, 0]
        const tc = Math.max(0, Math.min(1, t))
        const n = colors.length - 1
        const binIdx = ShadeTool.getBinForValue(tc, stops, bins)
        const binCenter = (binIdx + 0.5) / bins
        const ci = Math.min(Math.floor(binCenter * n), n)
        return colors[ci]
    },

    // Find which bin a value t falls into given custom stops [s0, s1, ..., sN-2]
    // Returns bin index 0..bins-1
    getBinForValue: function (t, stops, bins) {
        if (!stops || stops.length !== bins - 1) {
            return Math.min(Math.floor(Math.max(0, Math.min(1, t)) * bins), bins - 1)
        }
        const tc = Math.max(0, Math.min(1, t))
        for (let i = 0; i < stops.length; i++) {
            if (tc < stops[i]) return i
        }
        return bins - 1
    },

    renderHeatmapToMap: function (data, heatmap, activeElmId) {
        const store = useShadeStore.getState()
        const ed = store.sweepElData[activeElmId]
        const rampName = ed?.colorRamp || 'shadow'
        const discrete = store.sweepDiscrete || false
        const fitToData = store.sweepFitToData !== false
        const allRamps = ShadeTool.getSweepColorRamps()
        const rampDef = allRamps.find((r) => r.name === rampName) || allRamps[0]
        const colors = rampDef.colors
        const bins = rampDef.bins || colors.length
        const isShadowRamp = rampName === 'shadow'
        const colorStops = discrete ? (ed?.colorStops || null) : null

        const elMinFrac = ed?.minFrac != null ? ed.minFrac : 0
        const elMaxFrac = ed?.maxFrac != null ? ed.maxFrac : 1
        const fracRange = elMaxFrac - elMinFrac

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
                        let frac = row[tileCol + (px % res)]
                        if (frac == null || frac < 0 || !Number.isFinite(frac)) {
                            cData[p] = 0
                            cData[p + 1] = 0
                            cData[p + 2] = 0
                            cData[p + 3] = 0
                        } else {
                            const colorFrac = fitToData && fracRange > 0
                                ? Math.max(0, Math.min(1, (frac - elMinFrac) / fracRange))
                                : frac
                            // In discrete mode, snap to bin using custom stops if provided
                            let alphaFrac = colorFrac
                            let binIdx = 0
                            if (discrete && bins > 0) {
                                binIdx = ShadeTool.getBinForValue(colorFrac, colorStops, bins)
                                alphaFrac = bins > 1 ? binIdx / (bins - 1) : 0
                            }
                            const cl = discrete
                                ? ShadeTool.evalColorWithStops(colors, colorFrac, bins, colorStops)
                                : ShadeTool.evalColor(colors, colorFrac, false, bins)
                            cData[p] = Math.round(cl[0] * 255)
                            cData[p + 1] = Math.round(cl[1] * 255)
                            cData[p + 2] = Math.round(cl[2] * 255)
                            if (isShadowRamp) {
                                cData[p + 3] = (fitToData || discrete)
                                    ? Math.round((1 - alphaFrac) * 255)
                                    : Math.round((1 - alphaFrac) * 200 + 55)
                            } else {
                                cData[p + 3] = 255
                            }
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
        ShadeTool.applySweepOpacity(activeElmId)
    },

    refreshHeatmap: function (activeElmId) {
        const store = useShadeStore.getState()
        if (activeElmId != null) {
            const ed = store.sweepElData[activeElmId]
            if (ed?.heatmap && ed?.lastData) {
                ShadeTool.renderHeatmapToMap(ed.lastData, ed.heatmap, activeElmId)
            }
        } else {
            for (const id in store.sweepElData) {
                const ed = store.sweepElData[id]
                if (ed?.heatmap && ed?.lastData) {
                    ShadeTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
                }
            }
        }
    },

    reorderSweepLayers: function (orderedIds) {
        const len = orderedIds.length
        orderedIds.forEach((id, i) => {
            const layerName = 'shade' + id
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setZIndex === 'function') {
                layer.setZIndex(1000 + (len - 1 - i))
            }
        })
    },

    reorderShadeLayers: function (orderedIds) {
        const len = orderedIds.length
        orderedIds.forEach((id, i) => {
            const layerName = 'shade' + id
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setZIndex === 'function') {
                layer.setZIndex(1000 + (len - 1 - i))
            }
        })
    },

    refreshAllHeatmaps: function () {
        const store = useShadeStore.getState()
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.heatmap && ed?.lastData) {
                ShadeTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
            }
        }
    },

    applySweepOpacity: function (activeElmId) {
        const store = useShadeStore.getState()
        const ed = store.sweepElData[activeElmId]
        const opacity = ed?.opacity != null ? ed.opacity : 1
        const layerName = 'shade' + activeElmId
        const layer = L_.layers.layer[layerName]
        if (layer && typeof layer.setOpacity === 'function') {
            layer.setOpacity(opacity)
        }
    },

    // Fragment shader for atlas-based sweep playback.
    // Samples from a grid atlas texture using frameIndex to compute UV offset.
    // atlasScaleS/T account for the content region within the POT texture.
    _sweepAtlasShader: [
        'void main(void) {',
        '    float col = mod(frameIndex, atlasCols);',
        '    float row = floor(frameIndex / atlasCols);',
        '    vec2 frameUV = vec2(',
        '        (col + vTextureCoords.s) / atlasCols * atlasScaleS,',
        '        (row + vTextureCoords.t) / atlasRows * atlasScaleT',
        '    );',
        '    gl_FragColor = texture2D(uTexture0, frameUV);',
        '}',
    ].join('\n'),

    _nextPow2: function (v) {
        v--
        v |= v >> 1; v |= v >> 2; v |= v >> 4
        v |= v >> 8; v |= v >> 16
        return v + 1
    },

    buildSweepAtlas: function (data, sweepGrids, options, activeElmId, onDone) {
        const res = data.tileResolution * Math.pow(2, data.resolution)
        const numFrames = sweepGrids.length
        const atlasCols = Math.ceil(Math.sqrt(numFrames))
        const atlasRows = Math.ceil(numFrames / atlasCols)

        const contentW = res * atlasCols
        const contentH = res * atlasRows
        const atlasW = ShadeTool._nextPow2(contentW)
        const atlasH = ShadeTool._nextPow2(contentH)

        const store = useShadeStore.getState()
        store.setSweepField('sweepProgress', 'Building atlas...')
        store.setSweepField('sweepProgressPct', 55)

        // Build list of tiles to process
        const tilesToProcess = []
        for (let j = 0; j <= data.outputTopLeftTile.h; j++) {
            for (let i = 0; i <= data.outputTopLeftTile.w; i++) {
                tilesToProcess.push({ i, j })
            }
        }

        // For each tile: render ALL frames directly into the atlas ImageData
        // using putImageData at the correct offset. This avoids creating
        // intermediate canvases (previously 512+ allocations + drawImage clones).
        const atlasDl = {}
        let tileIdx = 0

        function processTile() {
            if (tileIdx >= tilesToProcess.length) {
                finalizeAtlas()
                return
            }

            const { i, j } = tilesToProcess[tileIdx]
            const z = data.outputTopLeftTile.z
            const x = Math.floor(data.outputTopLeftTile.x + i)
            const y = Math.floor(data.outputTopLeftTile.y + j)

            const tileRow =
                (data.outputTopLeftTile.y + j -
                    Math.floor(data.outputTopLeftTile.y) -
                    (Math.abs(data.outputTopLeftTile.y) % 1) * 2) * res
            const tileCol =
                (data.outputTopLeftTile.x + i -
                    Math.floor(data.outputTopLeftTile.x) -
                    (Math.abs(data.outputTopLeftTile.x) % 1) * 2) * res

            const atlas = document.createElement('canvas')
            atlas.width = atlasW
            atlas.height = atlasH
            const actx = atlas.getContext('2d')
            // Reusable ImageData for putImageData (avoids per-frame allocation)
            const tileImgData = actx.createImageData(res, res)
            const tileImgBuf = tileImgData.data

            // Process frames in chunks within this tile
            let frameIdx = 0
            const FRAME_CHUNK = 16

            // Pre-compute color values to avoid object allocation in hot loop
            const colorR = options.color ? options.color.r : 0
            const colorG = options.color ? options.color.g : 0
            const colorB = options.color ? options.color.b : 0
            const colorA = options.color ? options.color.a : 0
            const isInvert = options.invert == 0

            function renderFramesForTile() {
                const end = Math.min(frameIdx + FRAME_CHUNK, numFrames)
                for (; frameIdx < end; frameIdx++) {
                    const resultGrid = sweepGrids[frameIdx]
                    if (resultGrid == null) continue

                    // Render this frame's pixels for this tile directly
                    // Optimized: no object allocation per pixel, inline color writes
                    let px = 0
                    const bufLen = tileImgBuf.length
                    for (let p = 0; p < bufLen; p += 4) {
                        const gridRow = resultGrid[tileRow + ((px / res) | 0)]
                        const val = gridRow != null ? gridRow[tileCol + (px % res)] : null
                        if (val === 1 || val === 2) {
                            if (isInvert) {
                                tileImgBuf[p] = colorR
                                tileImgBuf[p + 1] = colorG
                                tileImgBuf[p + 2] = colorB
                                tileImgBuf[p + 3] = colorA
                            } else {
                                tileImgBuf[p] = 0; tileImgBuf[p + 1] = 0
                                tileImgBuf[p + 2] = 0; tileImgBuf[p + 3] = 0
                            }
                        } else if (val === 0) {
                            if (isInvert) {
                                tileImgBuf[p] = 0; tileImgBuf[p + 1] = 0
                                tileImgBuf[p + 2] = 0; tileImgBuf[p + 3] = 0
                            } else {
                                tileImgBuf[p] = colorR
                                tileImgBuf[p + 1] = colorG
                                tileImgBuf[p + 2] = colorB
                                tileImgBuf[p + 3] = colorA
                            }
                        } else if (val === 9) {
                            tileImgBuf[p] = 255; tileImgBuf[p + 1] = 0
                            tileImgBuf[p + 2] = 0; tileImgBuf[p + 3] = 35
                        } else {
                            tileImgBuf[p] = 0; tileImgBuf[p + 1] = 0
                            tileImgBuf[p + 2] = 0; tileImgBuf[p + 3] = 0
                        }
                        px++
                    }

                    // Place into atlas at correct frame position
                    // putImageData copies — safe to reuse tileImgData
                    const col = frameIdx % atlasCols
                    const row2 = Math.floor(frameIdx / atlasCols)
                    actx.putImageData(tileImgData, col * res, row2 * res)
                }

                if (frameIdx < numFrames) {
                    // Yield between frame chunks — update progress
                    const totalWork = tilesToProcess.length * numFrames
                    const doneWork = tileIdx * numFrames + frameIdx
                    const pct = 55 + Math.round((doneWork / totalWork) * 35)
                    useShadeStore.getState().setSweepField(
                        'sweepProgress',
                        'Building atlas: ' + Math.round((doneWork / totalWork) * 100) + '%'
                    )
                    useShadeStore.getState().setSweepField('sweepProgressPct', pct)
                    requestAnimationFrame(renderFramesForTile)
                } else {
                    // All frames rendered for this tile — encode to dataURL
                    atlasDl[z] = atlasDl[z] || {}
                    atlasDl[z][x] = atlasDl[z][x] || {}
                    atlasDl[z][x][y] = atlas.toDataURL()

                    tileIdx++
                    const pct = 55 + Math.round((tileIdx / tilesToProcess.length) * 40)
                    useShadeStore.getState().setSweepField(
                        'sweepProgress',
                        'Building atlas: tile ' + tileIdx + '/' + tilesToProcess.length
                    )
                    useShadeStore.getState().setSweepField('sweepProgressPct', Math.min(pct, 95))
                    requestAnimationFrame(processTile)
                }
            }

            renderFramesForTile()
        }

        function finalizeAtlas() {
            useShadeStore.getState().setSweepElField(activeElmId, 'atlas', {
                dl: atlasDl,
                atlasCols: atlasCols,
                atlasRows: atlasRows,
                atlasScaleS: contentW / atlasW,
                atlasScaleT: contentH / atlasH,
            })
            useShadeStore.getState().setSweepField('sweepProgress', '')
            useShadeStore.getState().setSweepField('sweepProgressPct', 100)
            if (typeof onDone === 'function') onDone()
        }

        processTile()
    },

    makeSweepLayer: function (atlasDl, activeElmId, atlasCols, atlasRows, atlasScaleS, atlasScaleT) {
        const layerName = 'shade' + activeElmId

        // Invalidate cached playback layer since we're creating a new one
        if (ShadeTool._cachedLayers[activeElmId]) {
            delete ShadeTool._cachedLayers[activeElmId]['playback']
        }

        Map_.rmNotNull(L_.layers.layer[layerName])

        L_.layers.layer[layerName] = L.tileLayer.gl({
            options: {
                tms: false,
                className: 'nofade',
                maxNativeZoom: Map_.map.getZoom(),
                maxZoom: 30,
            },
            fragmentShader: ShadeTool._sweepAtlasShader,
            tileUrls: [atlasDl],
            uniforms: {
                frameIndex: 0,
                atlasCols: atlasCols,
                atlasRows: atlasRows,
                atlasScaleS: atlasScaleS != null ? atlasScaleS : 1,
                atlasScaleT: atlasScaleT != null ? atlasScaleT : 1,
            },
            tileUrlsAsDataUrls: true,
        })
        L_.layers.layer[layerName]._noFade = true
        L_.layers.layer[layerName].setZIndex(1000)
        Map_.map.addLayer(L_.layers.layer[layerName])
        useShadeStore.getState().updateElement(activeElmId, { on: true })

        Globe_.litho.removeLayer(layerName)
    },

    // === Time-Range Sweep ===

    cancelSweep: function () {
        ShadeTool._sweepRunId++
        const store = useShadeStore.getState()
        store.setSweepField('sweepProgress', '')
        store.setSweepField('sweepProgressPct', 0)
        Toast.info('Sweep cancelled.', 3000)
    },

    shadeSweep: function (startTime, endTime, stepMinutes, onComplete) {
        const sweepRunId = ShadeTool._sweepRunId
        const store = useShadeStore.getState()
        const activeElmId = store.activeElmId
        if (activeElmId == null) { if (onComplete) onComplete(); return }

        if (ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        }

        const options = store.getShadeOptions(activeElmId)
        const selectedTargets = options.targets || []
        if (selectedTargets.length === 0) {
            Toast.warning('Select at least one source entity for sweep.', 6000)
            if (onComplete) onComplete()
            return
        }

        const startMs = new Date(startTime).getTime()
        const endMs = new Date(endTime).getTime()
        if (isNaN(startMs) || isNaN(endMs) || startMs > endMs) {
            Toast.warning('Invalid time range for sweep.', 6000)
            if (onComplete) onComplete()
            return
        }

        if (stepMinutes <= 0) {
            Toast.warning('Step must be a positive number.', 6000)
            if (onComplete) onComplete()
            return
        }

        const stepMs = stepMinutes * 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs) {
            timestamps.push(new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'))
        }

        if (timestamps.length > 512) {
            Toast.warning(
                'Too many timesteps (max 512). Increase step size.',
                6000
            )
            if (onComplete) onComplete()
            return
        }

        // Always render pixels at full alpha; CSS setOpacity controls visual opacity
        options.color.a = 255
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

        const curElm = store.sweepCurrentElm || 1
        const totElms = store.sweepTotalElms || 1
        const pfx = totElms > 1 ? ('Shade ' + curElm + ' of ' + totElms + ': ') : ''
        store.setSweepField('sweepProgress', pfx + 'Loading tiles...')
        store.setSweepField('sweepProgressPct', ((curElm - 1) / totElms) * 100)

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
                        const s = useShadeStore.getState()
                        const ce = s.sweepCurrentElm || 1
                        const te = s.sweepTotalElms || 1
                        const p = te > 1 ? ('Shade ' + ce + ' of ' + te + ': ') : ''
                        s.setSweepField('sweepProgress', p + 'Tiles: ' + parseInt(progress) + '%')
                    },
                    function (data) {
                        const sweepResults = []
                        const sweepGrids = []
                        const total = timestamps.length

                        // Build UTC time strings for all timestamps
                        const timeStrs = timestamps.map((ts) =>
                            ShadeTool.parseToUTCTime(ts) + ' UTC'
                        )

                        // Fetch all target positions in bulk (one call per target, all times)
                        const currentStore0 = useShadeStore.getState()
                        const curElm0 = currentStore0.sweepCurrentElm || 1
                        const totElms0 = currentStore0.sweepTotalElms || 1
                        const prefix0 = totElms0 > 1 ? ('Shade ' + curElm0 + ' of ' + totElms0 + ': ') : ''
                        currentStore0.setSweepField('sweepProgress', prefix0 + 'Computing positions...')

                        const targetBulkPromises = selectedTargets.map(
                            (tgt) =>
                                new Promise((resolve) => {
                                    calls.api(
                                        'll2aerll_bulk',
                                        {
                                            lng: source.lng,
                                            lat: source.lat,
                                            height: centerHeight,
                                            target: tgt.value,
                                            times: timeStrs,
                                            obsRefFrame,
                                            obsBody,
                                            includeSunEarth: store.elements[activeElmId]?.shadeMode === 'playback' ? 'true' : 'false',
                                            isCustom: 'false',
                                        },
                                        function (results) {
                                            resolve(Array.isArray(results) ? results : [])
                                        },
                                        function () {
                                            resolve([])
                                        }
                                    )
                                })
                        )

                        Promise.all(targetBulkPromises).then((allTargetResults) => {
                            if (sweepRunId !== ShadeTool._sweepRunId) return

                            // Process timesteps in small batches, yielding to the
                            // event loop between batches so the UI stays responsive
                            const CHUNK = 4
                            let ti = 0

                            function processChunk() {
                                if (sweepRunId !== ShadeTool._sweepRunId) return
                                const chunkEnd = Math.min(ti + CHUNK, total)
                                for (; ti < chunkEnd; ti++) {
                                    const ts = timestamps[ti]

                                    const validTargets = []
                                    for (let tgtIdx = 0; tgtIdx < allTargetResults.length; tgtIdx++) {
                                        const r = allTargetResults[tgtIdx][ti]
                                        if (r && !r.error) validTargets.push(r)
                                    }

                                    if (validTargets.length > 0) {
                                        const grids = validTargets.map((s) =>
                                            ShadeTool_Manager.computeShade(
                                                shadeTag,
                                                {
                                                    lat: s.latitude,
                                                    lng: s.longitude,
                                                    altitude: s.horizontal_altitude,
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
                                                      options.compositeMode || 'or'
                                                  )

                                        let visCount = 0
                                        let totalCells = 0
                                        for (let y = 0; y < compositedGrid.length; y++) {
                                            for (let x = 0; x < compositedGrid[y].length; x++) {
                                                if (compositedGrid[y][x] !== 9) {
                                                    totalCells++
                                                    if (compositedGrid[y][x] === 1 || compositedGrid[y][x] === 2)
                                                        visCount++
                                                }
                                            }
                                        }
                                        const primary = validTargets[0]
                                        sweepResults.push({
                                            time: ts,
                                            visibilityPct: totalCells > 0
                                                ? ((visCount / totalCells) * 100).toFixed(2)
                                                : 0,
                                            azimuth: primary.azimuth,
                                            elevation: primary.elevation,
                                            range: primary.range,
                                            ancillary: primary.ancillary || null,
                                        })
                                        sweepGrids.push(compositedGrid)
                                    } else {
                                        sweepResults.push({
                                            time: ts,
                                            visibilityPct: 0,
                                            azimuth: 0,
                                            elevation: 0,
                                            range: 0,
                                        })
                                        sweepGrids.push(null)
                                    }
                                }

                                // Update progress after each chunk
                                // processChunk is 0-50% of overall; atlas build is 50-100%
                                const currentStore = useShadeStore.getState()
                                const curElm = currentStore.sweepCurrentElm || 1
                                const totElms = currentStore.sweepTotalElms || 1
                                const elmPct = (ti / total) * 100
                                const overallPct = ((curElm - 1) / totElms) * 100 + ((elmPct * 0.5) / totElms)
                                const prefix = totElms > 1 ? ('Shade ' + curElm + ' of ' + totElms + ': ') : ''
                                currentStore.setSweepField(
                                    'sweepProgress',
                                    prefix + 'Computing shade ' + ti + '/' + total
                                )
                                currentStore.setSweepField(
                                    'sweepProgressPct',
                                    overallPct
                                )
                                if (ti < total) {
                                    requestAnimationFrame(processChunk)
                                    return
                                }

                                finalizeSweep()
                            }

                            function finalizeSweep() {
                                const currentStoreF = useShadeStore.getState()
                                currentStoreF.setSweepElField(activeElmId, 'results', sweepResults)
                                currentStoreF.setSweepElField(activeElmId, 'grids', sweepGrids)
                                currentStoreF.setSweepField('sweepPlayIndex', 0)
                                currentStoreF.setSweepElField(activeElmId, 'lastData', data)
                                currentStoreF.setSweepElField(activeElmId, 'lastOptions', options)
                                currentStoreF.setSweepElField(activeElmId, 'sweepCenter', {
                                    lat: source.lat,
                                    lng: source.lng,
                                })

                                currentStoreF.setSweepField('sweepProgress', 'Computing heatmap...')
                                currentStoreF.setSweepField('sweepProgressPct', 50)

                                // Yield to let progress update paint, then compute heatmap
                                setTimeout(function () {
                                    const storeH = useShadeStore.getState()

                                    // Compute heatmap (used by composite mode and as data for playback)
                                    if (sweepGrids.length > 0) {
                                        const heatmap = ShaderTool_Algorithm.cumulativeVisibility(sweepGrids)
                                        const border = 2
                                        let minFrac = 1, maxFrac = 0
                                        for (let r = border; r < heatmap.length - border; r++) {
                                            const row = heatmap[r]
                                            if (!row) continue
                                            for (let c = border; c < row.length - border; c++) {
                                                const f = row[c]
                                                if (f == null || f < 0 || !Number.isFinite(f)) continue
                                                if (f < minFrac) minFrac = f
                                                if (f > maxFrac) maxFrac = f
                                            }
                                        }
                                        if (minFrac > maxFrac) { minFrac = 0; maxFrac = 1 }
                                        storeH.setSweepElField(activeElmId, 'minFrac', minFrac)
                                        storeH.setSweepElField(activeElmId, 'maxFrac', maxFrac)
                                        storeH.setSweepElField(activeElmId, 'heatmap', heatmap)

                                        // Only render composite heatmap layer if element is in composite mode
                                        const activeEl = storeH.elements[activeElmId]
                                        if (activeEl?.shadeMode === 'composite') {
                                            storeH.setSweepField('sweepViewMode', 'composite')
                                            ShadeTool.renderHeatmapToMap(data, heatmap, activeElmId)
                                        }
                                    }

                                    // Mark sweep as complete — clear sweepStale in case
                                    // renderHeatmapToMap triggered a moveend event
                                    storeH.setSweepField('sweepStale', false)
                                    const curElmF = storeH.sweepCurrentElm || 1
                                    const totElmsF = storeH.sweepTotalElms || 1
                                    if (typeof onComplete === 'function') onComplete()

                                    // Build atlas only for playback mode (expensive at high frame counts)
                                    const activeElAtlas = storeH.elements[activeElmId]
                                    if (activeElAtlas?.shadeMode === 'playback') {
                                        ShadeTool.buildSweepAtlas(data, sweepGrids, options, activeElmId, function () {
                                            ShadeTool.sweepShowAllFrames()
                                            if (totElmsF > 1) {
                                                Toast.success('Shade ' + curElmF + ' of ' + totElmsF + ': ' + total + ' timesteps processed.', 3000)
                                            } else {
                                                Toast.success('Sweep complete. ' + total + ' timesteps processed.', 4000)
                                            }
                                        })
                                    } else {
                                        storeH.setSweepField('sweepProgress', '')
                                        storeH.setSweepField('sweepProgressPct', 100)
                                        if (totElmsF > 1) {
                                            Toast.success('Shade ' + curElmF + ' of ' + totElmsF + ': ' + total + ' timesteps processed.', 3000)
                                        } else {
                                            Toast.success('Sweep complete. ' + total + ' timesteps processed.', 4000)
                                        }
                                    }
                                }, 0)
                            }

                            processChunk()
                        })
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
                useShadeStore
                    .getState()
                    .setSweepField('sweepProgressPct', 0)
                if (typeof onComplete === 'function') onComplete()
            }
        )
    },

    // Single-element sweep triggered from an element's Generate button
    shadeSweepElement: function (elmId) {
        const store = useShadeStore.getState()
        const startTime = store.sweepStart
        const endTime = store.sweepEnd
        const stepMinutes = store.sweepStep
        if (!startTime || !endTime || !stepMinutes) {
            Toast.warning('Set sweep Start Time, End Time and Step Size.', 6000)
            return
        }
        ShadeTool._sweepRunId++
        store.setSweepField('sweepStale', false)
        store.setActiveElmId(elmId)
        store.setSweepField('sweepTotalElms', 1)
        store.setSweepField('sweepCurrentElm', 1)
        // Initialize card order for this element
        const existingOrder = store.sweepCardOrder || []
        if (!existingOrder.includes(elmId)) {
            store.setSweepCardOrder([...existingOrder, elmId])
        }
        // Remove existing shade layer and invalidate cached layers for this element
        delete ShadeTool._cachedLayers[elmId]
        Map_.rmNotNull(L_.layers.layer['shade' + elmId])
        L_.layers.layer['shade' + elmId] = null
        store.updateElement(elmId, { regenerating: true, loadingProgress: 0, sweepProgress: 'Starting...' })
        ShadeTool.shadeSweep(startTime, endTime, stepMinutes, function () {
            const s = useShadeStore.getState()
            s.updateElement(elmId, { regenerating: false, loadingProgress: 0, changed: false, sweepProgress: '' })
        })
    },

    shadeSweepAll: function (startTime, endTime, stepMinutes) {
        ShadeTool._sweepRunId++
        const runId = ShadeTool._sweepRunId
        const store = useShadeStore.getState()
        store.setSweepField('sweepStale', false)

        // Clear existing shade map layers and old sweep layers from the map
        ShadeTool.clearAllShadeLayers()

        const activeIds = Object.keys(store.elements).filter(
            (id) => store.elements[id].on
        )
        if (activeIds.length === 0) {
            Toast.warning('Enable at least one shade map for sweep.', 6000)
            return
        }
        // Initialize card order — preserve existing order for known ids, append new ones
        const existingOrder = store.sweepCardOrder || []
        const existingSet = new Set(existingOrder.map(String))
        const newOrder = existingOrder.filter((id) => activeIds.includes(String(id)))
        activeIds.forEach((id) => {
            if (!existingSet.has(String(id))) newOrder.push(parseInt(id))
        })
        store.setSweepCardOrder(newOrder.map(Number))
        store.setSweepField('sweepTotalElms', activeIds.length)
        store.setSweepField('sweepCurrentElm', 0)

        // Serialize sweeps to avoid concurrent writes to shared sweep state
        let idx = 0
        function runNext() {
            if (runId !== ShadeTool._sweepRunId) return
            if (idx >= activeIds.length) {
                const s = useShadeStore.getState()
                s.setSweepField('sweepProgress', 'Done (' + activeIds.length + ' shade maps)')
                s.setSweepField('sweepProgressPct', 100)
                return
            }
            const id = parseInt(activeIds[idx])
            idx++
            const s = useShadeStore.getState()
            s.setSweepField('sweepCurrentElm', idx)
            s.setActiveElmId(id)
            ShadeTool.shadeSweep(startTime, endTime, stepMinutes, runNext)
        }
        runNext()
    },

    // === Sweep Playback ===

    sweepPlay: function () {
        const store = useShadeStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return

        if (store.sweepPlaying) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        } else {
            store.setSweepField('sweepPlaying', true)
            ShadeTool._sweepPlayTimer = setInterval(function () {
                const s = useShadeStore.getState()
                const fc = s.getSweepFrameCount()
                if (fc === 0) return
                const nextIdx = (s.sweepPlayIndex + 1) % fc
                s.setSweepField('sweepPlayIndex', nextIdx)
                ShadeTool.sweepShowAllFrames()
            }, store.sweepPlaySpeed)
        }
    },

    sweepStepForward: function () {
        const store = useShadeStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return
        const nextIdx = (store.sweepPlayIndex + 1) % frameCount
        store.setSweepField('sweepPlayIndex', nextIdx)
        ShadeTool.sweepShowAllFrames()
    },

    sweepStepBack: function () {
        const store = useShadeStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return
        const nextIdx = (store.sweepPlayIndex - 1 + frameCount) % frameCount
        store.setSweepField('sweepPlayIndex', nextIdx)
        ShadeTool.sweepShowAllFrames()
    },

    sweepShowAllFrames: function () {
        const store = useShadeStore.getState()
        store.setSweepField('sweepViewMode', 'playback')
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            const el = store.elements[id]
            if (ed?.grids?.length > 0 && el?.shadeMode === 'playback') {
                ShadeTool.sweepShowFrame(parseInt(id))
            }
        }
        // Show time label per element
        const idx = store.sweepPlayIndex
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.results?.[idx]?.time) {
                const frameLabel = document.getElementById('vstSweepFrameLabel_' + id)
                if (frameLabel) frameLabel.textContent = ed.results[idx].time.replace(/\.\d{3}Z$/, 'Z')
            }
        }

        // Update bottom bar graphs
        ShadeTool_Graphs.updatePlaybackFrame(ShadeTool_Graphs.getActiveElmId())

        // Update TimeUI indicator for the current playback time
        ShadeTool._updateTimeUIIndicator()
    },

    sweepShowFrame: function (activeElmId) {
        const store = useShadeStore.getState()
        const ed = store.sweepElData[activeElmId]
        const idx = (ed?.playbackLinked === false) ? (ed?.localPlayIndex || 0) : store.sweepPlayIndex
        const layerName = 'shade' + activeElmId
        const layer = L_.layers.layer[layerName]

        if (!ed?.atlas) return

        // Lazy-create the atlas layer on first playback frame.
        if (!layer || !layer._uniformLocations || !layer._uniformLocations.frameIndex) {
            const atlas = ed.atlas
            ShadeTool.makeSweepLayer(
                atlas.dl, activeElmId, atlas.atlasCols, atlas.atlasRows,
                atlas.atlasScaleS, atlas.atlasScaleT
            )
            const newLayer = L_.layers.layer[layerName]
            if (newLayer) {
                newLayer.setUniform('frameIndex', idx)
                newLayer.once('load', function () {
                    newLayer.reRender()
                })
                ShadeTool.applySweepOpacity(activeElmId)
            }
        } else {
            layer.setUniform('frameIndex', idx)
            layer.reRender()
        }
    },

    sweepShowComposite: function (activeElmId) {
        const store = useShadeStore.getState()
        store.setSweepField('sweepViewMode', 'composite')
        // Render composite heatmap for ALL elements with sweep data
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.heatmap && ed?.lastData) {
                ShadeTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
            }
        }
    },

    updateSweepSpeed: function (speed) {
        const store = useShadeStore.getState()
        if (store.sweepPlaying && ShadeTool._sweepPlayTimer) {
            clearInterval(ShadeTool._sweepPlayTimer)
            ShadeTool._sweepPlayTimer = setInterval(function () {
                const s = useShadeStore.getState()
                const fc = s.getSweepFrameCount()
                if (fc === 0) return
                const nextIdx = (s.sweepPlayIndex + 1) % fc
                s.setSweepField('sweepPlayIndex', nextIdx)
                ShadeTool.sweepShowAllFrames()
            }, speed)
        }
    },

    _updateTimeUIIndicator: function () {
        const store = useShadeStore.getState()
        const idx = store.sweepPlayIndex
        // Find the first element with sweep results to get the current time
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.results?.[idx]?.time) {
                TimeUI.addIndicator('shadetool-playback', 'shadetool', '#e53935', ed.results[idx].time)
                return
            }
        }
    },

    // === Export ===

    _buildExportName: function (elmId, suffix) {
        const store = useShadeStore.getState()
        const el = store.elements[elmId]
        const options = store.getShadeOptions(elmId)
        const parts = ['shade']
        if (options?.targets?.[0]?.name) parts.push(options.targets[0].name.replace(/\s+/g, '-'))
        if (el?.observer) parts.push(el.observer.replace(/\s+/g, '-'))
        if (store.rawTime) parts.push(store.rawTime.replace(/[:\s]/g, '').replace(/\.\d{3}Z$/, 'Z'))
        if (suffix) parts.push(suffix)
        return parts.join('_').replace(/[^a-zA-Z0-9_\-\.]/g, '')
    },

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

        const fileName = ShadeTool._buildExportName(elmId, 'map') + '.png'
        compositeCanvas.toBlob(function (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('download', fileName)
            link.setAttribute('href', url)
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        })
    },

    exportCSV: function (elmId) {
        const store = useShadeStore.getState()
        const el = store.elements[elmId]
        let results = null
        if (elmId != null && store.sweepElData[elmId]?.results?.length > 0) {
            results = store.sweepElData[elmId].results
        } else {
            for (const id in store.sweepElData) {
                if (store.sweepElData[id]?.results?.length > 0) {
                    results = store.sweepElData[id].results
                    break
                }
            }
        }
        if (!results || results.length === 0) {
            Toast.warning(
                'No sweep results to export. Run a time sweep first.',
                6000
            )
            return
        }

        // Get lat/lng of the source point
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])
        if (store.indicatorLastDragPoint) centerLatLng = store.indicatorLastDragPoint
        const lat = parseFloat(centerLatLng.lat).toFixed(6)
        const lng = parseFloat(centerLatLng.lng).toFixed(6)

        const headers = [
            'time',
            'lat',
            'lng',
            'visibility_pct',
            'azimuth',
            'elevation',
            'range',
        ]
        const rows = results.map((r) => [
            r.time,
            lat,
            lng,
            r.visibilityPct,
            r.azimuth,
            r.elevation,
            r.range,
        ])
        const fileName = ShadeTool._buildExportName(elmId, 'sweep')
        F_.downloadArrayAsCSV(headers, rows, fileName)
    },

    exportGrid: function (elmId) {
        const store = useShadeStore.getState()
        const el = store.elements[elmId]

        // Use heatmap grid if available (composite/playback), else static grid
        let grid = store.sweepElData[elmId]?.heatmap
        let isHeatmap = true
        if (!grid) {
            grid = el?.lastResultGrid
            isHeatmap = false
        }
        if (!grid || grid.length === 0) {
            Toast.warning('No shade grid to export. Generate first.', 6000)
            return
        }

        // Build header with grid dimensions and metadata
        const lines = []
        lines.push('# Shade Grid Export')
        lines.push('# Rows: ' + grid.length + ', Cols: ' + (grid[0]?.length || 0))
        if (isHeatmap) {
            lines.push('# Values: fractional visibility (0.0 = always shadowed, 1.0 = always visible)')
        } else {
            lines.push('# Values: 0=shadowed, 1=visible(sun), 2=visible(earth), 8=no-DEM, 9=out-of-bounds')
        }
        const options = store.getShadeOptions(elmId)
        if (options?.targets?.[0]?.name) lines.push('# Source: ' + options.targets[0].name)
        if (el?.observer) lines.push('# Observer: ' + el.observer)
        if (store.rawTime) lines.push('# Time: ' + store.rawTime)
        if (store.sweepStart && store.sweepEnd) {
            lines.push('# Sweep: ' + store.sweepStart + ' to ' + store.sweepEnd)
        }
        lines.push('')

        // Write grid rows
        for (let y = 0; y < grid.length; y++) {
            const row = grid[y]
            if (!row) {
                lines.push('')
                continue
            }
            const vals = []
            for (let x = 0; x < row.length; x++) {
                const v = row[x]
                if (v == null) vals.push('-')
                else if (isHeatmap) vals.push(v.toFixed(3))
                else vals.push(String(v))
            }
            lines.push(vals.join(' '))
        }

        const text = lines.join('\n')
        const fileName = ShadeTool._buildExportName(elmId, 'grid') + '.txt'
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('download', fileName)
        link.setAttribute('href', url)
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    },

    convertUTCToObserver: function (utcTime, observerValue, callback) {
        const store = useShadeStore.getState()
        const observers = store.vars?.observers || []
        let body = null
        for (let i = 0; i < observers.length; i++) {
            if (observers[i].value === observerValue) {
                body = observers[i].body
                break
            }
        }
        if (!body || !observerValue) {
            if (callback) callback(null)
            return
        }
        calls.api(
            'chronice',
            { body, target: observerValue, from: 'utc', time: utcTime },
            function (s) {
                if (s.error) {
                    if (callback) callback(null)
                } else {
                    if (callback) callback(s.result)
                }
            },
            function () { if (callback) callback(null) }
        )
    },

    convertObserverToUTC: function (localTime, observerValue, callback) {
        const store = useShadeStore.getState()
        const observers = store.vars?.observers || []
        let body = null
        for (let i = 0; i < observers.length; i++) {
            if (observers[i].value === observerValue) {
                body = observers[i].body
                break
            }
        }
        if (!body || !observerValue) {
            if (callback) callback(null)
            return
        }
        calls.api(
            'chronice',
            { body, target: observerValue, from: 'lmst', time: localTime },
            function (s) {
                if (s.error) {
                    if (callback) callback(null)
                } else {
                    if (callback) callback(s.result)
                }
            },
            function () { if (callback) callback(null) }
        )
    },

    // === RAE Indicators (preserved exactly from ShadeTool) ===

    updateRAEIndicators(rae, shadeId, allResults) {
        const size = 160
        const sizeInner = 144
        const origin = { x: size / 2, y: size / 2 }

        const indicatorEl = document.getElementById(
            `shadeTool_indicators_${shadeId}`
        )
        if (indicatorEl) {
            indicatorEl.style.borderBottom = rae.error
                ? '3px solid var(--color-red)'
                : ''
        }

        // Azimuth
        const azValueEl = document.getElementById(
            `shadeTool_azValue_${shadeId}`
        )
        if (azValueEl) {
            azValueEl.textContent = rae.error
                ? 'Az: Error'
                : 'Az: ' + rae.azimuth.toFixed(2) + '\u00B0'
        }
        const cAz = document.getElementById(
            `shadeTool_az_${shadeId}`
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
        const elValueEl = document.getElementById(
            `shadeTool_elValue_${shadeId}`
        )
        if (elValueEl) {
            elValueEl.textContent = rae.error
                ? 'El: Error'
                : 'El: ' + rae.elevation.toFixed(2) + '\u00B0'
        }
        const cEl = document.getElementById(
            `shadeTool_el_${shadeId}`
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
            ctx.lineWidth = options.guideLineWidth || 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        const tipInset = options.tipInset || 10
        const innerInset = options.innerInset || 20
        const endAzPt = F_.rotatePoint(
            {
                x: origin.x,
                y:
                    origin.y -
                    sizeInner / 2 +
                    tipInset +
                    (options.shortenPx || 0),
            },
            [origin.x, origin.y],
            angle * (Math.PI / 180)
        )

        ctx.beginPath()
        ctx.beginPath()
        ctx.moveTo(origin.x, origin.y)
        ctx.lineTo(endAzPt.x, endAzPt.y)
        ctx.lineWidth = options.lineWidth || 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        const endAzPtInner = F_.rotatePoint(
            {
                x: origin.x,
                y:
                    origin.y -
                    sizeInner / 2 +
                    innerInset +
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
            options.arrowSize || 4,
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
            ctx.lineWidth = options.guideLineWidth || 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        let sign = -1
        let offset = 0
        if (options.azGreaterThan180) {
            sign = 1
            offset = 180
        }

        const tipInset = options.tipInset || 10
        const innerInset = options.innerInset || 20
        const endElPt = F_.rotatePoint(
            {
                x:
                    origin.x +
                    sizeInner / 2 -
                    tipInset -
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
        ctx.lineWidth = options.lineWidth || 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        const endElPtInner = F_.rotatePoint(
            {
                x:
                    origin.x +
                    sizeInner / 2 -
                    innerInset -
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
            options.arrowSize || 4,
            options.color || 'yellow'
        )
    },

    drawMiniRAEIndicators(azCanvasId, elCanvasId, rae) {
        const size = 80
        const sizeInner = 70
        const origin = { x: size / 2, y: size / 2 }

        // Azimuth
        const cAz = document.getElementById(azCanvasId)
        if (cAz) {
            cAz.width = size
            cAz.height = size
            const ctx = cAz.getContext('2d')
            ctx.clearRect(0, 0, size, size)

            ctx.beginPath()
            ctx.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(255,255,255,0.1)'
            ctx.fill()
            ctx.strokeStyle = 'black'
            ctx.lineWidth = 1
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(origin.x, size - (size - sizeInner) / 2)
            ctx.lineTo(origin.x, (size - sizeInner) / 2)
            ctx.lineWidth = 0.5
            ctx.strokeStyle = 'rgba(0,0,0,0.9)'
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(size - (size - sizeInner) / 2, origin.y)
            ctx.lineTo((size - sizeInner) / 2, origin.y)
            ctx.lineWidth = 0.5
            ctx.strokeStyle = 'rgba(0,0,0,0.9)'
            ctx.stroke()

            if (rae && rae.azimuth != null) {
                ctx.font = '11px Arial'
                ctx.fillStyle = 'rgba(255,255,255,0.8)'
                ctx.textAlign = 'center'
                ctx.fillText('N', size / 2, (size - sizeInner) * 1.2 + 3)

                ShadeTool.drawAzAngleGuideOnCanvas(
                    ctx, origin, sizeInner,
                    rae.azimuth,
                    rae.azimuth * (Math.PI / 180),
                    { angleGuide: true, color: '#dbb658', lineWidth: 2, arrowSize: 2, guideLineWidth: 1, tipInset: 5, innerInset: 12 }
                )
            }
        }

        // Elevation
        const cEl = document.getElementById(elCanvasId)
        if (cEl) {
            cEl.width = size
            cEl.height = size
            const ctx = cEl.getContext('2d')
            ctx.clearRect(0, 0, size, size)

            ctx.beginPath()
            ctx.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(255,255,255,0.1)'
            ctx.fill()
            ctx.strokeStyle = 'black'
            ctx.lineWidth = 1
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)
            ctx.arc(origin.x, origin.y, sizeInner / 2, 0, Math.PI, true)
            const sky = ctx.createLinearGradient(0, 0, 0, sizeInner / 2)
            sky.addColorStop(0, 'rgba(8, 174, 234, 0.25)')
            sky.addColorStop(1, 'rgba(255, 255, 255, 0.25)')
            ctx.fillStyle = sky
            ctx.fill()

            ctx.beginPath()
            ctx.moveTo(origin.x, size - (size - sizeInner) / 2)
            ctx.lineTo(origin.x, (size - sizeInner) / 2)
            ctx.lineWidth = 0.5
            ctx.strokeStyle = 'rgba(0,0,0,0.9)'
            ctx.stroke()

            if (rae && rae.elevation != null) {
                let azGreaterThan180 = false
                if (rae.azimuth != null) {
                    let az = rae.azimuth
                    if (az < 0) az += 360
                    azGreaterThan180 = az > 180
                }
                ShadeTool.drawElAngleGuideOnCanvas(
                    ctx, origin, sizeInner,
                    rae.elevation,
                    { azGreaterThan180, angleGuide: true, color: '#dbb658', lineWidth: 2, arrowSize: 2, guideLineWidth: 1, tipInset: 5, innerInset: 12 }
                )
            }
        }
    },

    /**
     * Draw a sky dome polar plot on a canvas.
     * Center = zenith (90° el), edge = horizon (0° el).
     * Azimuth runs clockwise from north (top).
     * @param {string} canvasId - DOM id of the canvas element
     * @param {Array} results - full sweep results array [{azimuth, elevation, ...}, ...]
     * @param {number} currentIdx - index into results for the current frame
     */
    drawSkyDome(canvasId, results, currentIdx) {
        const c = document.getElementById(canvasId)
        if (!c) return

        const size = 360
        const pad = 30
        const r = (size - pad * 2) / 2
        const cx = size / 2
        const cy = size / 2

        c.width = size
        c.height = size
        const ctx = c.getContext('2d')
        ctx.clearRect(0, 0, size, size)

        // Helper: az/el → canvas x,y
        // az: degrees clockwise from north, el: degrees above horizon
        function azel2xy(az, el) {
            const elClamped = Math.max(0, Math.min(90, el))
            const dist = ((90 - elClamped) / 90) * r
            const azRad = (az - 90) * (Math.PI / 180) // -90 so north=top
            return {
                x: cx + dist * Math.cos(azRad),
                y: cy + dist * Math.sin(azRad),
            }
        }

        // Sky gradient background (dark blue center/zenith, lighter at horizon)
        const skyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        skyGrad.addColorStop(0, 'rgba(8, 40, 80, 0.6)')
        skyGrad.addColorStop(1, 'rgba(30, 80, 130, 0.3)')
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.fillStyle = skyGrad
        ctx.fill()

        // Horizon circle
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Elevation rings (30°, 60°)
        for (const elDeg of [30, 60]) {
            const ringR = ((90 - elDeg) / 90) * r
            ctx.beginPath()
            ctx.arc(cx, cy, ringR, 0, 2 * Math.PI)
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 6])
            ctx.stroke()
            ctx.setLineDash([])
        }

        // Cardinal direction lines (N-S, E-W)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy - r)
        ctx.lineTo(cx, cy + r)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - r, cy)
        ctx.lineTo(cx + r, cy)
        ctx.stroke()

        // Cardinal labels
        ctx.font = '22px Arial'
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText('N', cx, cy - r - 3)
        ctx.textBaseline = 'top'
        ctx.fillText('S', cx, cy + r + 3)
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText('E', cx + r + 4, cy)
        ctx.textAlign = 'right'
        ctx.fillText('W', cx - r - 4, cy)

        // Elevation labels
        ctx.font = '18px Arial'
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (const elDeg of [30, 60]) {
            const ringR = ((90 - elDeg) / 90) * r
            ctx.fillText(elDeg + '°', cx + 2, cy - ringR)
        }

        if (!results || results.length === 0) return

        // Filter valid results (those with az/el data, el >= 0 means above horizon)
        const validResults = results.filter(
            (r) => r && r.azimuth != null && r.elevation != null
        )
        if (validResults.length === 0) return

        // Draw the full sweep path
        ctx.beginPath()
        let first = true
        for (let i = 0; i < results.length; i++) {
            const pt = results[i]
            if (!pt || pt.azimuth == null || pt.elevation == null) continue
            const p = azel2xy(pt.azimuth, pt.elevation)
            if (first) {
                ctx.moveTo(p.x, p.y)
                first = false
            } else {
                ctx.lineTo(p.x, p.y)
            }
        }
        ctx.strokeStyle = 'rgba(219, 182, 88, 0.5)'
        ctx.lineWidth = 3
        ctx.stroke()

        // Draw below-horizon portions with dashed style
        ctx.beginPath()
        first = true
        for (let i = 0; i < results.length; i++) {
            const pt = results[i]
            if (!pt || pt.azimuth == null || pt.elevation == null) continue
            if (pt.elevation < 0) {
                const p = azel2xy(pt.azimuth, 0) // clamp to horizon
                if (first) {
                    ctx.moveTo(p.x, p.y)
                    first = false
                } else {
                    ctx.lineTo(p.x, p.y)
                }
            } else {
                first = true
            }
        }
        if (!first) {
            ctx.strokeStyle = 'rgba(219, 182, 88, 0.25)'
            ctx.lineWidth = 2
            ctx.setLineDash([4, 6])
            ctx.stroke()
            ctx.setLineDash([])
        }

        // Draw small dots along the path at intervals
        const dotInterval = Math.max(1, Math.floor(results.length / 20))
        for (let i = 0; i < results.length; i += dotInterval) {
            const pt = results[i]
            if (!pt || pt.azimuth == null || pt.elevation == null) continue
            if (pt.elevation < 0) continue
            const p = azel2xy(pt.azimuth, pt.elevation)
            ctx.beginPath()
            ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(219, 182, 88, 0.4)'
            ctx.fill()
        }

        // Start marker (small green circle)
        const startPt = results[0]
        if (startPt && startPt.azimuth != null && startPt.elevation != null && startPt.elevation >= 0) {
            const sp = azel2xy(startPt.azimuth, startPt.elevation)
            ctx.beginPath()
            ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(100, 220, 100, 0.8)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 1
            ctx.stroke()
        }

        // End marker (small red circle)
        const endPt = results[results.length - 1]
        if (endPt && endPt.azimuth != null && endPt.elevation != null && endPt.elevation >= 0) {
            const ep = azel2xy(endPt.azimuth, endPt.elevation)
            ctx.beginPath()
            ctx.arc(ep.x, ep.y, 6, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(220, 100, 100, 0.8)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 1
            ctx.stroke()
        }

        // Current position (larger bright dot)
        const cur = results[currentIdx]
        if (cur && cur.azimuth != null && cur.elevation != null) {
            const cp = azel2xy(cur.azimuth, cur.elevation)
            // Glow effect
            const glow = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 16)
            glow.addColorStop(0, 'rgba(219, 182, 88, 0.6)')
            glow.addColorStop(1, 'rgba(219, 182, 88, 0)')
            ctx.beginPath()
            ctx.arc(cp.x, cp.y, 16, 0, 2 * Math.PI)
            ctx.fillStyle = glow
            ctx.fill()

            // Solid dot
            ctx.beginPath()
            ctx.arc(cp.x, cp.y, 7, 0, 2 * Math.PI)
            ctx.fillStyle = '#dbb658'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'
            ctx.lineWidth = 2
            ctx.stroke()

            // Label with current az/el
            if (cur.elevation >= 0) {
                ctx.font = '20px Arial'
                ctx.fillStyle = 'rgba(255,255,255,0.9)'
                ctx.textAlign = 'left'
                ctx.textBaseline = 'bottom'
                ctx.fillText(
                    cur.azimuth.toFixed(0) + '° / ' + cur.elevation.toFixed(0) + '°',
                    cp.x + 12, cp.y - 4
                )
            }
        }
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
