import React from 'react'
import { createRoot } from 'react-dom/client'
import { utcFormat } from 'd3-time-format'

import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Toast from '../../../design-system/components/Toast/Toast'

import TimeControl from '../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../Basics/TimeControl_/TimeUI'

import calls from '../../../pre/calls'
import {
    data as colormapData,
    evaluate_cmap,
} from '../../../external/js-colormaps/js-colormaps.js'

import HTML2Canvas from 'html2canvas'
import gifshot from 'gifshot'

import SightlineTool_Algorithm from './SightlineTool_Algorithm'
import SightlineTool_Graphs from './SightlineTool_Graphs'
import SightlineTool_Export from './SightlineTool_Export'
import SightlineTool_Indicators from './SightlineTool_Indicators'

import useSightlineStore, { MULTI_SOURCE_COLORS } from './store'
import SightlinePanel from './components/SightlinePanel'

import './SightlineTool.css'

const sunColor = '#d2db58'
const earthColor = '#58dbb8'

// Decode zlib-compressed base64 grid (gridB64z) into a 2D array
function _decodeGridB64z(b64str, rows, cols) {
    const binStr = atob(b64str)
    const bytes = new Uint8Array(binStr.length)
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i)
    // Inflate using DecompressionStream (web standard)
    const ds = new DecompressionStream('deflate')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()
    const chunks = []
    let totalLen = 0
    const readAll = async () => {
        writer.write(bytes)
        writer.close()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            totalLen += value.length
        }
        const flat = new Uint8Array(totalLen)
        let off = 0
        for (const c of chunks) { flat.set(c, off); off += c.length }
        return flat
    }
    return readAll().then((flat) => {
        const grid = []
        for (let y = 0; y < rows; y++) {
            const row = new Array(cols)
            const base = y * cols
            for (let x = 0; x < cols; x++) row[x] = flat[base + x]
            grid.push(row)
        }
        return { grid, flat }
    })
}

// Apply XOR delta to reconstruct a frame from its predecessor
function _applyDelta(prevFlat, deltaFlat) {
    const result = new Uint8Array(prevFlat.length)
    for (let i = 0; i < result.length; i++) result[i] = prevFlat[i] ^ deltaFlat[i]
    return result
}

// Convert flat Uint8Array to 2D grid
function _flatToGrid(flat, rows, cols) {
    const grid = []
    for (let y = 0; y < rows; y++) {
        const row = new Array(cols)
        const base = y * cols
        for (let x = 0; x < cols; x++) row[x] = flat[base + x]
        grid.push(row)
    }
    return grid
}

let _compositeHoverRaf = null
let _timeChangeDebounce = null

// Per-element sweep run IDs and progress tracking so multiple sweeps can run simultaneously.
const _sweepRunIds = {}     // elmId → runId
const _highWaterPcts = {}   // elmId → highest pct seen
const _lastFlushTimes = {}  // elmId → performance.now()
function _flushSweepProgress(elmId, pct, msg, force) {
    if (elmId == null) return
    // Monotonic: never let displayed percentage go backwards
    const hw = _highWaterPcts[elmId] || 0
    if (pct < hw && !force) pct = hw
    if (pct > hw) _highWaterPcts[elmId] = pct
    const now = performance.now()
    const lastFlush = _lastFlushTimes[elmId] || 0
    if (force || now - lastFlush >= 50) {
        _lastFlushTimes[elmId] = now
        const s = useSightlineStore.getState()
        if (msg !== undefined && msg !== null) s.setSweepField('sweepProgress', msg)
        s.setSweepField('sweepProgressPct', pct)
        s.updateElement(elmId, { loadingProgress: pct })
    }
}

// Returns true if the mission uses a custom projected CRS (polar stereo, etc.)
// so that the map CRS matches the DEM CRS.
function _isCustomProjectedCRS() {
    return (
        L_.configData &&
        L_.configData.projection &&
        L_.configData.projection.custom === true
    )
}

// Returns [xmin, ymin, xmax, ymax] in projected CRS coordinates, or null.
// Samples all 4 container corners so polar/rotated CRS get a correct
// projected-space envelope (getBounds lat/lng box is wrong for those).
// Only returns bounds when the map uses a custom projected CRS matching the DEM.
function _getViewportProjBounds() {
    if (!_isCustomProjectedCRS()) return null
    const map = Map_.map
    if (!map) return null
    const crs = map.options.crs || window.mmgisglobal?.customCRS
    if (!crs || typeof crs.project !== 'function') return null
    const size = map.getSize()
    const corners = [
        [0, 0],
        [size.x, 0],
        [size.x, size.y],
        [0, size.y],
    ]
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
    for (const [cx, cy] of corners) {
        const ll = map.containerPointToLatLng([cx, cy])
        const p = crs.project(ll)
        if (p.x < xmin) xmin = p.x
        if (p.y < ymin) ymin = p.y
        if (p.x > xmax) xmax = p.x
        if (p.y > ymax) ymax = p.y
    }
    if (!isFinite(xmin) || !isFinite(ymin) || !isFinite(xmax) || !isFinite(ymax))
        return null
    return [xmin, ymin, xmax, ymax]
}

// Creates an L.imageOverlay positioned via projected NW/SE corners.
// In polar/rotated CRS, L.latLngBounds normalises by min/max lat/lng,
// which shuffles corners and mispositions the overlay.  This helper
// overrides _reset so pixel position is computed from the projected
// NW (xmin, ymax) and SE (xmax, ymin) directly.
function _projImageOverlay(url, projBounds, options) {
    const crs = Map_.map.options.crs
    const nwLL = crs.unproject(L.point(projBounds[0], projBounds[3]))
    const seLL = crs.unproject(L.point(projBounds[2], projBounds[1]))
    const overlay = L.imageOverlay(url, L.latLngBounds(nwLL, seLL), options)
    overlay._reset = function () {
        const img = this._image
        if (!img || !this._map) return
        const nw = this._map.latLngToLayerPoint(nwLL)
        const se = this._map.latLngToLayerPoint(seLL)
        const b = new L.Bounds(nw, se)
        const sz = b.getSize()
        L.DomUtil.setPosition(img, b.min)
        img.style.width = sz.x + 'px'
        img.style.height = sz.y + 'px'
    }
    // Override zoom animation to use the same projected corners,
    // otherwise the default _animateZoom reads the normalised
    // L.latLngBounds and the overlay jumps during zoom transitions.
    overlay._animateZoom = function (e) {
        const img = this._image
        if (!img || !this._map) return
        const scale = this._map.getZoomScale(e.zoom)
        const nw = this._map._latLngToNewLayerPoint(nwLL, e.zoom, e.center)
        L.DomUtil.setTransform(img, nw, scale)
    }
    return overlay
}

let SightlineTool = {
    height: 0,
    width: 300,
    _root: null,
    _sweepPlayTimer: null,

    initialize: function () {
        const vars = L_.getToolVars('sightline')
        useSightlineStore.getState().setVars(vars)

        if (vars && vars.__noVars !== true) {
            if (!vars.dem)
                console.warn(
                    'SightlineTool: variables object does not contain key "dem"!'
                )
        }
    },

    make: function () {
        const store = useSightlineStore.getState()
        const vars = store.vars

        const rawTime = SightlineTool.parseToUTCTime(TimeControl.getEndTime())
        store.setSweepField('rawTime', rawTime)
        store.setSweepField(
            'utcTime',
            SightlineTool.parseToUTCTime(TimeControl.getEndTime(), true)
        )
        // sweepStart/sweepEnd initialization is handled by SightlinePanel's useEffect on mount

        if (Object.keys(store.elements).length === 0) {
            store.addElement()
        }

        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        SightlineTool._root = createRoot(toolPanel)
        SightlineTool._root.render(<SightlinePanel />)

        // Add center crosshair overlay
        SightlineTool._addCenterCrosshair()
        SightlineTool._addCenterDot()

        // Register graph scrub callback for bidirectional sync
        SightlineTool_Graphs.registerScrubCallback(() => {
            SightlineTool.sweepShowAllFrames()
        })

        Map_.map.on('click', SightlineTool._onMapClick)
        Map_.map.on('moveend', SightlineTool._onPanEnd)
        Map_.map.on('mousemove', SightlineTool._onCompositeHover)
        Map_.map.on('mouseout', SightlineTool._onCompositeHoverEnd)

        TimeControl.subscribe('SightlineTool', (t) => {
            const raw = SightlineTool.parseToUTCTime(t.currentTime)
            const store = useSightlineStore.getState()
            store.setSweepField('rawTime', raw)
            store.setSweepField(
                'utcTime',
                SightlineTool.parseToUTCTime(t.currentTime, true)
            )
            // sweepStart/sweepEnd sync is handled by SightlinePanel's TimeControl subscription
            SightlineTool._onTimeChange(raw)
        })
    },

    destroy: function () {
        if (SightlineTool._sweepPlayTimer) {
            clearInterval(SightlineTool._sweepPlayTimer)
            SightlineTool._sweepPlayTimer = null
        }
        if (_compositeHoverRaf) {
            cancelAnimationFrame(_compositeHoverRaf)
            _compositeHoverRaf = null
        }
        if (_timeChangeDebounce) {
            clearTimeout(_timeChangeDebounce)
            _timeChangeDebounce = null
        }
        Map_.map.off('click', SightlineTool._onMapClick)
        Map_.map.off('moveend', SightlineTool._onPanEnd)
        Map_.map.off('mousemove', SightlineTool._onCompositeHover)
        Map_.map.off('mouseout', SightlineTool._onCompositeHoverEnd)

        TimeControl.unsubscribe('SightlineTool')

        // Remove center crosshair and dot
        SightlineTool._removeCenterCrosshair()
        SightlineTool._removeCenterDot()

        // Close bottom bar graphs
        SightlineTool_Graphs.cleanup()

        // Remove TimeUI indicators
        TimeUI.removeIndicator(null, 'sightlinetool')

        if (SightlineTool._root) {
            SightlineTool._root.unmount()
            SightlineTool._root = null
        }

        // Clean up map layers and caches
        SightlineTool._cachedLayers = {}
        const store = useSightlineStore.getState()
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['sightline' + id])
            Map_.rmNotNull(store.shedMarkers[id])
        }
    },

    // === Center Crosshair ===

    _crosshairMarker: null,

    _addCenterCrosshair() {
        if (SightlineTool._crosshairMarker) return
        const icon = L.divIcon({
            className: 'sightlineCenterCrosshair',
            html: '<div class="sightlineCrosshairCircle"></div><div class="sightlineCrosshairN"></div><div class="sightlineCrosshairS"></div><div class="sightlineCrosshairE"></div><div class="sightlineCrosshairW"></div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        })
        SightlineTool._crosshairMarker = L.marker(Map_.map.getCenter(), {
            icon: icon,
            interactive: false,
            zIndexOffset: 10000
        }).addTo(Map_.map)
        Map_.map.on('move', SightlineTool._updateCrosshairPosition)
        SightlineTool._updateCrosshairPosition()
    },

    _removeCenterCrosshair() {
        if (SightlineTool._crosshairMarker) {
            Map_.map.removeLayer(SightlineTool._crosshairMarker)
            SightlineTool._crosshairMarker = null
        }
        Map_.map.off('move', SightlineTool._updateCrosshairPosition)
        SightlineTool_Graphs.removeAzimuthLine()
        SightlineTool_Graphs._removeSourceAzimuthLines()
    },

    _updateCrosshairPosition() {
        if (!SightlineTool._crosshairMarker) return
        const store = useSightlineStore.getState()
        const activeId = store.activeElmId
        const ed = activeId != null ? store.sweepElData[activeId] : null
        if (ed?.sweepCenter) {
            SightlineTool._crosshairMarker.setLatLng(ed.sweepCenter)
        } else {
            SightlineTool._crosshairMarker.setLatLng(Map_.map.getCenter())
        }
    },

    // === Center Dot (always at visible map center) ===

    _addCenterDot() {
        if (document.getElementById('sightlineCenterDot')) return
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        const dot = document.createElement('div')
        dot.id = 'sightlineCenterDot'
        dot.className = 'sightlineCenterDot'
        mapEl.appendChild(dot)
    },

    _removeCenterDot() {
        const dot = document.getElementById('sightlineCenterDot')
        if (dot) dot.remove()
    },

    // === Map Event Handlers ===

    _onMapClick: function (e) {
        if (e && e.latlng) {
            const store = useSightlineStore.getState()
            const el = store.elements[store.activeElmId]
            // Only run static sightline on click when in static mode
            if (el?.sightlineMode && el.sightlineMode !== 'static') return
            SightlineTool.sightline(
                { lng: e.latlng.lng, lat: e.latlng.lat },
                store.activeElmId
            )
        }
    },

    _onPanEnd: function () {
        const store = useSightlineStore.getState()

        // Invalidate and re-fetch horizon profile on pan — but only when
        // no sweep center is set (horizon is anchored to map center).
        const activeEd = store.activeElmId != null ? store.sweepElData[store.activeElmId] : null
        if (!activeEd?.sweepCenter) {
            SightlineTool_Graphs.invalidateAndRefetch()
        }

        // Invalidate sweep results and layer cache when viewport changes
        if (store.hasSweepData() && !store.sweepStale) {
            store.setSweepField('sweepStale', true)
            SightlineTool._cachedLayers = {}
            for (const id in store.sweepElData) {
                store.setSweepElField(parseInt(id), 'hoverFrac', null)
            }
            // Stop playback if running
            if (SightlineTool._sweepPlayTimer) {
                clearInterval(SightlineTool._sweepPlayTimer)
                SightlineTool._sweepPlayTimer = null
                store.setSweepField('sweepPlaying', false)
            }
            TimeUI.removeIndicator(null, 'sightlinetool')
            // Remove the heatmap/atlas layer from the map for static elements only;
            // composite/playback keep their (stale) layer visible until user re-sweeps
            for (const id in store.elements) {
                const el = store.elements[id]
                if (el && (el.sightlineMode === 'composite' || el.sightlineMode === 'playback')) continue
                Map_.rmNotNull(L_.layers.layer['sightline' + id])
                L_.layers.layer['sightline' + id] = null
            }
        }

        for (const id in store.elements) {
            const el = store.elements[id]
            if (!el) continue
            // Composite/playback: don't auto-regenerate — just re-enable sweep button
            if (el.sightlineMode === 'composite' || el.sightlineMode === 'playback') continue
            SightlineTool.sightline(null, parseInt(id))
        }
    },

    _onCompositeHover: function (e) {
        if (_compositeHoverRaf) return
        const latlng = e.latlng
        _compositeHoverRaf = requestAnimationFrame(() => {
            _compositeHoverRaf = null
            const store = useSightlineStore.getState()
            const isProj = _isCustomProjectedCRS()

            // In projected CRS, convert geographic latlng to projected coords
            let mouseX, mouseY
            if (isProj && Map_.map.options.crs && typeof Map_.map.options.crs.project === 'function') {
                const pt = Map_.map.options.crs.project(latlng)
                mouseX = pt.x
                mouseY = pt.y
            } else {
                mouseX = latlng.lng
                mouseY = latlng.lat
            }

            for (const id in store.sweepElData) {
                const ed = store.sweepElData[id]
                const el = store.elements[id]
                if (!ed?.heatmap || !ed?.lastData || el?.sightlineMode !== 'composite') continue
                const data = ed.lastData
                const heatmap = ed.heatmap

                const bounds = isProj && data._projBounds ? data._projBounds : data._bounds
                if (!bounds || bounds.length < 4) {
                    store.setSweepElField(parseInt(id), 'hoverFrac', null)
                    continue
                }

                const west = bounds[0], south = bounds[1], east = bounds[2], north = bounds[3]
                const rows = heatmap.length
                const cols = heatmap[0] ? heatmap[0].length : 0
                if (rows === 0 || cols === 0) {
                    store.setSweepElField(parseInt(id), 'hoverFrac', null)
                    continue
                }

                const col = Math.floor(((mouseX - west) / (east - west)) * cols)
                const row = Math.floor(((north - mouseY) / (north - south)) * rows)

                if (row < 0 || col < 0 || row >= rows || !heatmap[row] || col >= cols) {
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
        const store = useSightlineStore.getState()
        for (const id in store.sweepElData) {
            store.setSweepElField(parseInt(id), 'hoverFrac', null)
        }
    },

    _lastGeneratedTime: null,

    _onTimeChange: function (rawTime) {
        // Skip regeneration if the time hasn't actually changed
        if (rawTime === SightlineTool._lastGeneratedTime) return
        SightlineTool._lastGeneratedTime = rawTime
        if (_timeChangeDebounce) clearTimeout(_timeChangeDebounce)
        _timeChangeDebounce = setTimeout(() => {
            const store = useSightlineStore.getState()
            for (const id in store.elements) {
                const el = store.elements[id]
                if (!el) continue
                // Don't regenerate static sightline for composite/playback elements
                if (el.sightlineMode === 'composite' || el.sightlineMode === 'playback') continue
                SightlineTool.sightline(null, parseInt(id))
            }
        }, 300)
    },

    // === Core Sightline Computation ===

    sightline: function (source, activeElmId, ignoreMarker, initObj) {
        if (activeElmId == null) return

        const store = useSightlineStore.getState()
        const el = store.elements[activeElmId]
        if (!el) return

        let options = initObj || store.getSightlineOptions(activeElmId)
        if (!options) return

        // Find center of map
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])

        source = {
            lng: parseFloat(centerLatLng.lng),
            lat: parseFloat(centerLatLng.lat),
        }

        if (source.lng == null || source.lat == null) return

        // Always render pixels at full alpha; CSS setOpacity controls visual opacity
        options.color.a = 255

        source.height =
            !isNaN(options.height) ? parseFloat(options.height) : 2

        const vars = store.vars

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

        // Determine target for the sightmap request
        const primary = selectedTargets[0]
        const primaryIsCustom =
            primary.value === false || primary.value === 'false'

        const viewportBounds = _getViewportProjBounds()

        calls.api(
            'sightmap',
            {
                dem: demUrl,
                lat: source.lat,
                lng: source.lng,
                height: options.height || 0,
                target: primaryIsCustom ? 'CUSTOM' : primary.value,
                time: options.time + ' UTC',
                obsRefFrame,
                obsBody,
                planetRadius: F_.radiusOfPlanetMajor,
                maxOutputDim: SightlineTool._resolutionToMaxDim(activeElmId),
                isCustom: primaryIsCustom ? 'true' : 'false',
                customAz: primaryIsCustom ? customAz : 0,
                customEl: primaryIsCustom ? customEl : 0,
                viewportBounds: viewportBounds ? viewportBounds.join(',') : undefined,
                shadowReach: parseFloat(options.shadowReach) || 0,
            },
            function (result) {
                if (result.error) {
                    const msg =
                        (result.message || '').indexOf('INSUFFDATA') >= 0
                            ? 'Insufficient SPICE kernels for this source entity and time period.'
                            : 'Sightmap error: ' +
                              (result.message || 'Unknown')
                    Toast.error(msg, 6000)
                    useSightlineStore
                        .getState()
                        .updateElement(activeElmId, {
                            regenerating: false,
                            loading: false,
                            lastError: true,
                        })
                    return
                }

                const bounds = result.bounds
                const projBounds = result.projBounds || null

                // Update RAE indicators from backend-computed az/el
                const syntheticRae = {
                    azimuth: result.az,
                    elevation: result.el,
                    range: 0,
                }

                useSightlineStore.getState().updateElement(activeElmId, {
                    raeResults: {
                        az: result.az.toFixed(3) + '\u00B0',
                        el: result.el.toFixed(3) + '\u00B0',
                        range: '',
                    },
                    raeRaw: syntheticRae,
                    raeAllResults: [syntheticRae],
                })

                // Decode compressed binary grid
                _decodeGridB64z(result.gridB64z, result.rows, result.cols).then(({ grid }) => {

                const data = {
                    _bounds: bounds,
                    _projBounds: projBounds,
                    result: grid,
                    bottomLeftLatLng: {
                        lat: bounds[1],
                        lng: bounds[0],
                    },
                    cellSize:
                        grid[0] && grid[0].length > 1
                            ? (bounds[2] - bounds[0]) / grid[0].length
                            : 0,
                }

                SightlineTool.renderResultToMap(
                    data,
                    grid,
                    options,
                    activeElmId
                )

                const currentStore = useSightlineStore.getState()
                currentStore.lastData = data
                currentStore.lastResultGrid = grid
                currentStore.lastOptions = options
                // Store the observer position so azimuth indicator lines
                // compute _localNorthAngle from the correct location
                // (not the map center, which may be at the pole).
                currentStore.setSweepElField(activeElmId, 'sweepCenter', {
                    lat: source.lat,
                    lng: source.lng,
                })
                SightlineTool._updateCrosshairPosition()
                currentStore.updateElement(activeElmId, {
                    lastData: data,
                    lastResultGrid: grid,
                })
                currentStore.updateElement(activeElmId, {
                    regenerating: false,
                    loading: false,
                    changed: false,
                    loadingProgress: 0,
                })
                }) // end _decodeGridB64z.then
            },
            function (err) {
                const msg = (err && err.message) ? err.message : 'Sightmap request failed.'
                Toast.error(msg, 6000)
                useSightlineStore.getState().updateElement(activeElmId, {
                    regenerating: false,
                    loading: false,
                    lastError: true,
                })
            }
        )
    },

    toggleElementVisibility: function (elmId, on) {
        const layerName = 'sightline' + elmId
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
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        if (!el) return
        const layerName = 'sightline' + elmId

        // Remove existing layer from the map (clear previous mode's render)
        if (L_.layers.layer[layerName]) {
            Map_.map.removeLayer(L_.layers.layer[layerName])
            L_.layers.layer[layerName] = null
        }
        // Also remove via Globe_ in case it was added as a litho layer
        try { Globe_.litho.removeLayer(layerName) } catch (e) { /* ignore */ }

        // Clear the TimeUI playback indicator when leaving playback mode
        TimeUI.removeIndicator(null, 'sightlinetool')

        // Switching back to static: re-render cached result or mark for regen
        if (mode === 'static') {
            if (el.lastData && el.lastResultGrid) {
                const options = store.getSightlineOptions(elmId)
                options.color.a = 255
                SightlineTool.renderResultToMap(el.lastData, el.lastResultGrid, options, elmId)
            } else {
                store.updateElement(elmId, { changed: true })
            }
        }

        // Switch to composite: render cached heatmap if available (no re-sweep)
        if (mode === 'composite') {
            const ed = store.sweepElData[elmId]
            if (ed?.heatmap && ed?.lastData) {
                store.setSweepField('sweepViewMode', 'composite')
                SightlineTool.renderHeatmapToMap(ed.lastData, ed.heatmap, elmId)
            }
        }

        // Switch to playback: render cached frames if available (no re-sweep)
        if (mode === 'playback') {
            // Ensure sightlineMode is set before sweepShowAllFrames checks it
            store.updateElement(elmId, { sightlineMode: 'playback' })
            store.setSweepField('sweepViewMode', 'playback')
            const ed = store.sweepElData[elmId]
            if (ed?.frameImages && ed.frameImages.length > 0) {
                SightlineTool.sweepShowFrame(elmId)
            }
        }
    },

    // Remove all sightline/sweep layers from the map
    clearAllSightlineLayers: function () {
        const store = useSightlineStore.getState()
        for (const id in store.elements) {
            Map_.rmNotNull(L_.layers.layer['sightline' + id])
            L_.layers.layer['sightline' + id] = null
            delete SightlineTool._cachedLayers[id]
        }
    },

    deleteElement: function (elmId) {
        const store = useSightlineStore.getState()
        Map_.rmNotNull(L_.layers.layer['sightline' + elmId])
        Map_.rmNotNull(store.shedMarkers[elmId])
        delete store.canvases[elmId]
        delete store.tags[elmId]
        delete SightlineTool._cachedLayers[elmId]
        store.removeElement(elmId)
    },

    // === Rendering ===

    renderResultToMap: function (data, resultGrid, options, activeElmId) {
        SightlineTool.renderBackendSightmapToMap(
            resultGrid,
            data._bounds,
            data._projBounds,
            options,
            activeElmId
        )
    },

    renderBackendSightmapToMap: function (
        grid, bounds, projBounds, options, activeElmId
    ) {
        const layerName = 'sightline' + activeElmId
        const rows = grid.length
        const cols = grid[0] ? grid[0].length : 0
        if (rows === 0 || cols === 0) return

        // Invalidate cached layer for current mode
        if (SightlineTool._cachedLayers[activeElmId]) {
            const el = useSightlineStore.getState().elements[activeElmId]
            if (el)
                delete SightlineTool._cachedLayers[activeElmId][
                    el.sightlineMode
                ]
        }

        Map_.rmNotNull(L_.layers.layer[layerName])

        const c = document.createElement('canvas')
        c.width = cols
        c.height = rows
        const ctx = c.getContext('2d')
        const imgData = ctx.createImageData(cols, rows)
        const px = imgData.data

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const idx = (y * cols + x) * 4
                const val = grid[y][x]
                let cl
                switch (val) {
                    case 0:
                        cl =
                            options.invert == 0
                                ? { r: 0, g: 0, b: 0, a: 0 }
                                : options.color
                        break
                    case 1:
                    case 2:
                        cl =
                            options.invert == 0
                                ? options.color
                                : { r: 0, g: 0, b: 0, a: 0 }
                        break
                    default:
                        cl = { r: 0, g: 0, b: 0, a: 0 }
                }
                px[idx] = cl.r
                px[idx + 1] = cl.g
                px[idx + 2] = cl.b
                px[idx + 3] = cl.a
            }
        }
        ctx.putImageData(imgData, 0, 0)

        const overlayOpts = { className: 'nofade sightmap-pixelated', interactive: false }
        if (projBounds && _isCustomProjectedCRS() && Map_.map.options.crs && Map_.map.options.crs.unproject) {
            L_.layers.layer[layerName] = _projImageOverlay(
                c.toDataURL(), projBounds, overlayOpts
            )
        } else {
            const leafletBounds = [
                [bounds[1], bounds[0]], // SW
                [bounds[3], bounds[2]], // NE
            ]
            L_.layers.layer[layerName] = L.imageOverlay(
                c.toDataURL(), leafletBounds, overlayOpts
            )
        }
        L_.layers.layer[layerName].setZIndex(1000)
        Map_.map.addLayer(L_.layers.layer[layerName])

        const store = useSightlineStore.getState()
        store.updateElement(activeElmId, { on: true })
        const el = store.elements[activeElmId]
        if (el && el.opacity != null) {
            L_.layers.layer[layerName].setOpacity(el.opacity)
        }

        // Re-apply z-order so elements respect the panel drag order
        const allIds = Object.keys(store.elements).map(Number)
        const ordered = (store.elementOrder || []).filter((id) => allIds.includes(id))
        allIds.forEach((id) => { if (!ordered.includes(id)) ordered.push(id) })
        SightlineTool.reorderSightlineLayers(ordered)

        Globe_.litho.removeLayer(layerName)
    },

    // Returns the hardcoded list of available sweep color ramp definitions.
    // Each entry: { name, label, colors (0-1 RGB arrays), reverse, bins, hasAlpha? }
    // elmColor {r,g,b} is used for the element-color-based ramps.
    getSweepColorRamps: function (elmColor) {
        const cr = elmColor ? elmColor.r / 255 : 1.0
        const cg = elmColor ? elmColor.g / 255 : 0.7
        const cb = elmColor ? elmColor.b / 255 : 0.15

        const ramps = []

        // 1. [transparent, color]
        ramps.push({
            name: '_tc', label: 'Color',
            hasAlpha: true,
            colors: [[cr, cg, cb, 0], [cr, cg, cb, 1]],
            reverse: false, bins: 2,
        })

        // 2. [transparent, color, transparent]
        ramps.push({
            name: '_tct', label: 'Color Fade',
            hasAlpha: true,
            colors: [[cr, cg, cb, 0], [cr, cg, cb, 1], [cr, cg, cb, 0]],
            reverse: false, bins: 3,
        })

        // 3. Inferno
        const infernoColors = colormapData['inferno'] ? colormapData['inferno'].colors : []
        ramps.push({
            name: 'inferno', label: 'Inferno',
            colors: infernoColors,
            reverse: false, bins: 6,
        })

        // 4. Viridis
        const viridisColors = colormapData['viridis'] ? colormapData['viridis'].colors : []
        ramps.push({
            name: 'viridis', label: 'Viridis',
            colors: viridisColors,
            reverse: false, bins: 6,
        })

        // 5. Red to Green (through yellow) — RdYlGn
        const rdylgnColors = colormapData['RdYlGn'] ? colormapData['RdYlGn'].colors : []
        ramps.push({
            name: 'RdYlGn', label: 'Red → Green',
            colors: rdylgnColors,
            reverse: false, bins: 6,
        })

        // 6. Black to White (single gradient)
        ramps.push({
            name: 'BlackWhite', label: 'Black → White',
            colors: [[0, 0, 0], [1, 1, 1]],
            reverse: false, bins: 1,
        })

        return ramps
    },

    // Evaluate a color from a ramp at position t [0..1].
    // In discrete mode, snaps to one of `bins` equal-width bins.
    // Returns [r, g, b] or [r, g, b, a] if colors have a 4th component.
    evalColor: function (colors, t, discrete, bins) {
        if (!colors || colors.length === 0) return [0, 0, 0]
        const tc = Math.max(0, Math.min(1, t))
        const n = colors.length - 1
        if (discrete && bins > 0) {
            const binIdx = Math.min(Math.floor(tc * bins), bins - 1)
            const binCenter = (binIdx + 0.5) / bins
            const ci = Math.min(Math.round(binCenter * n), n)
            return colors[ci]
        }
        const scaled = tc * n
        const lo = Math.min(Math.floor(scaled), n)
        const hi = Math.min(lo + 1, n)
        const f = scaled - lo
        const result = [
            colors[lo][0] + (colors[hi][0] - colors[lo][0]) * f,
            colors[lo][1] + (colors[hi][1] - colors[lo][1]) * f,
            colors[lo][2] + (colors[hi][2] - colors[lo][2]) * f,
        ]
        if (colors[lo].length > 3) {
            result.push(colors[lo][3] + (colors[hi][3] - colors[lo][3]) * f)
        }
        return result
    },

    // Evaluate color in discrete mode using custom stops for bin boundaries.
    // Falls back to equal-width bins if stops are null/invalid.
    evalColorWithStops: function (colors, t, bins, stops) {
        if (!colors || colors.length === 0) return [0, 0, 0]
        const tc = Math.max(0, Math.min(1, t))
        const n = colors.length - 1
        const binIdx = SightlineTool.getBinForValue(tc, stops, bins)
        const binCenter = (binIdx + 0.5) / bins
        const ci = Math.min(Math.round(binCenter * n), n)
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
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[activeElmId]
        const el = store.elements[activeElmId]
        const rampName = ed?.colorRamp || 'sightline'
        const discrete = store.sweepDiscrete || false
        const fitToData = store.sweepFitToData !== false
        const allRamps = SightlineTool.getSweepColorRamps(el?.color)
        const rampDef = allRamps.find((r) => r.name === rampName) || allRamps[0]
        const colors = rampDef.colors
        const bins = rampDef.bins || colors.length
        const isSightlineRamp = rampName === 'sightline'
        const colorStops = discrete ? (ed?.colorStops || null) : null

        const elMinFrac = ed?.minFrac != null ? ed.minFrac : 0
        const elMaxFrac = ed?.maxFrac != null ? ed.maxFrac : 1
        const fracRange = elMaxFrac - elMinFrac

        const rows = heatmap.length
        const cols = heatmap[0] ? heatmap[0].length : 0
        if (rows === 0 || cols === 0) return

        const layerName = 'sightline' + activeElmId
        if (SightlineTool._cachedLayers[activeElmId]) {
            delete SightlineTool._cachedLayers[activeElmId]['composite']
        }
        Map_.rmNotNull(L_.layers.layer[layerName])

        const c = document.createElement('canvas')
        c.width = cols
        c.height = rows
        const ctx = c.getContext('2d')
        const imgData = ctx.createImageData(cols, rows)
        const px = imgData.data

        for (let y = 0; y < rows; y++) {
            const row = heatmap[y]
            for (let x = 0; x < cols; x++) {
                const idx = (y * cols + x) * 4
                if (row == null) {
                    px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                    continue
                }
                let frac = row[x]
                if (frac == null || frac < 0 || !Number.isFinite(frac)) {
                    px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                    continue
                }
                const colorFrac = fitToData && fracRange > 0
                    ? Math.max(0, Math.min(1, (frac - elMinFrac) / fracRange))
                    : frac
                let alphaFrac = colorFrac
                if (discrete && bins > 0) {
                    const binIdx = SightlineTool.getBinForValue(colorFrac, colorStops, bins)
                    alphaFrac = bins > 1 ? binIdx / (bins - 1) : 0
                }
                const cl = discrete
                    ? SightlineTool.evalColorWithStops(colors, colorFrac, bins, colorStops)
                    : SightlineTool.evalColor(colors, colorFrac, false, bins)
                px[idx] = Math.round(cl[0] * 255)
                px[idx + 1] = Math.round(cl[1] * 255)
                px[idx + 2] = Math.round(cl[2] * 255)
                if (isSightlineRamp) {
                    px[idx + 3] = (fitToData || discrete)
                        ? Math.round(alphaFrac * 255)
                        : Math.round(alphaFrac * 200 + 55)
                } else if (cl.length > 3) {
                    px[idx + 3] = Math.round(cl[3] * 255)
                } else {
                    px[idx + 3] = 255
                }
            }
        }
        ctx.putImageData(imgData, 0, 0)

        const bounds = data._bounds
        const projBounds = data._projBounds
        const heatOpts = { className: 'nofade sightmap-pixelated', interactive: false }
        if (projBounds && _isCustomProjectedCRS() && Map_.map.options.crs && Map_.map.options.crs.unproject) {
            L_.layers.layer[layerName] = _projImageOverlay(
                c.toDataURL(), projBounds, heatOpts
            )
        } else if (bounds) {
            L_.layers.layer[layerName] = L.imageOverlay(
                c.toDataURL(),
                [[bounds[1], bounds[0]], [bounds[3], bounds[2]]],
                heatOpts
            )
        } else {
            return
        }
        L_.layers.layer[layerName].addTo(Map_.map)
        SightlineTool.applySweepOpacity(activeElmId)
    },

    refreshHeatmap: function (activeElmId) {
        const store = useSightlineStore.getState()
        if (activeElmId != null) {
            const ed = store.sweepElData[activeElmId]
            if (ed?.heatmap && ed?.lastData) {
                SightlineTool.renderHeatmapToMap(ed.lastData, ed.heatmap, activeElmId)
            }
        } else {
            for (const id in store.sweepElData) {
                const ed = store.sweepElData[id]
                if (ed?.heatmap && ed?.lastData) {
                    SightlineTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
                }
            }
        }
    },

    reorderSweepLayers: function (orderedIds) {
        const len = orderedIds.length
        orderedIds.forEach((id, i) => {
            const layerName = 'sightline' + id
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setZIndex === 'function') {
                layer.setZIndex(1000 + (len - 1 - i))
            }
        })
    },

    reorderSightlineLayers: function (orderedIds) {
        const len = orderedIds.length
        orderedIds.forEach((id, i) => {
            const layerName = 'sightline' + id
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setZIndex === 'function') {
                layer.setZIndex(1000 + (len - 1 - i))
            }
        })
    },

    applySweepOpacity: function (activeElmId) {
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[activeElmId]
        const el = store.elements[activeElmId]
        const opacity = ed?.opacity != null ? ed.opacity : (el?.opacity != null ? el.opacity : 1)
        const layerName = 'sightline' + activeElmId
        const layer = L_.layers.layer[layerName]
        if (layer && typeof layer.setOpacity === 'function') {
            layer.setOpacity(opacity)
        }
    },

    buildSweepAtlas: function (data, sweepGrids, options, activeElmId, onDone) {
        const numFrames = sweepGrids.length
        const store = useSightlineStore.getState()
        store.setSweepField('sweepProgress', 'Building frames...')
        _flushSweepProgress(activeElmId, 55, undefined, true)

        const colorR = options.color ? options.color.r : 0
        const colorG = options.color ? options.color.g : 0
        const colorB = options.color ? options.color.b : 0
        const colorA = options.color ? options.color.a : 0
        const isInvert = options.invert == 0

        const frameImages = []
        let frameIdx = 0
        const CHUNK = 4

        function processChunk() {
            const end = Math.min(frameIdx + CHUNK, numFrames)
            for (; frameIdx < end; frameIdx++) {
                const grid = sweepGrids[frameIdx]
                if (grid == null) {
                    frameImages.push(null)
                    continue
                }
                const rows = grid.length
                const cols = grid[0] ? grid[0].length : 0
                const c = document.createElement('canvas')
                c.width = cols
                c.height = rows
                const ctx = c.getContext('2d')
                const imgData = ctx.createImageData(cols, rows)
                const px = imgData.data
                for (let y = 0; y < rows; y++) {
                    const row = grid[y]
                    for (let x = 0; x < cols; x++) {
                        const idx = (y * cols + x) * 4
                        const val = row ? row[x] : null
                        if (val === 1 || val === 2) {
                            if (isInvert) {
                                px[idx] = colorR; px[idx + 1] = colorG
                                px[idx + 2] = colorB; px[idx + 3] = colorA
                            } else {
                                px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                            }
                        } else if (val === 0) {
                            if (isInvert) {
                                px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                            } else {
                                px[idx] = colorR; px[idx + 1] = colorG
                                px[idx + 2] = colorB; px[idx + 3] = colorA
                            }
                        } else {
                            px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                        }
                    }
                }
                ctx.putImageData(imgData, 0, 0)
                frameImages.push(c.toDataURL())
            }

            const pct = 55 + Math.round((frameIdx / numFrames) * 40)
            _flushSweepProgress(activeElmId, Math.min(pct, 95), 'Building frames: ' + frameIdx + '/' + numFrames)

            if (frameIdx < numFrames) {
                requestAnimationFrame(processChunk)
            } else {
                useSightlineStore.getState().setSweepElField(activeElmId, 'frameImages', frameImages)
                useSightlineStore.getState().setSweepField('sweepProgress', '')
                _flushSweepProgress(activeElmId, 100, undefined, true)
                if (typeof onDone === 'function') onDone()
            }
        }
        processChunk()
    },

    // === Time-Range Sweep ===

    cancelSweep: function () {
        // Cancel all in-flight sweeps
        for (const id in _sweepRunIds) {
            _sweepRunIds[id] = (_sweepRunIds[id] || 0) + 1
        }
        SightlineTool._sweepAllRunId = (SightlineTool._sweepAllRunId || 0) + 1
        const store = useSightlineStore.getState()
        store.setSweepField('sweepProgress', '')
        // Reset all elements stuck in regenerating state
        for (const id in store.elements) {
            const numId = parseInt(id)
            _flushSweepProgress(numId, 0, undefined, true)
            if (store.elements[id]?.regenerating) {
                store.updateElement(numId, { regenerating: false, loading: false, loadingProgress: 0 })
            }
        }
        // Remove TimeUI playback indicator
        TimeUI.removeIndicator(null, 'sightlinetool')
        Toast.info('Sweep cancelled.', 3000)
    },

    sightlineSweep: function (startTime, endTime, stepMinutes, activeElmId, onComplete) {
        _highWaterPcts[activeElmId] = 0
        _sweepRunIds[activeElmId] = (_sweepRunIds[activeElmId] || 0) + 1
        const sweepRunId = _sweepRunIds[activeElmId]
        const store = useSightlineStore.getState()
        if (activeElmId == null) { if (onComplete) onComplete(); return }

        if (SightlineTool._sweepPlayTimer) {
            clearInterval(SightlineTool._sweepPlayTimer)
            SightlineTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        }
        // Clear stale TimeUI indicator from previous sweep
        TimeUI.removeIndicator(null, 'sightlinetool')

        const options = store.getSightlineOptions(activeElmId)
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

        const stepSeconds = stepMinutes * 60

        if (timestamps.length > 2048) {
            Toast.warning(
                'Too many timesteps (max 2048). Increase step size.',
                6000
            )
            if (onComplete) onComplete()
            return
        }

        // Always render pixels at full alpha; CSS setOpacity controls visual opacity
        options.color.a = 255
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])

        const source = {
            lng: parseFloat(centerLatLng.lng),
            lat: parseFloat(centerLatLng.lat),
        }
        source.height = !isNaN(options.height)
            ? parseFloat(options.height)
            : 2

        const vars = store.vars

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
        const pfx = totElms > 1 ? ('Sightline ' + curElm + ' of ' + totElms + ': ') : ''
        store.setSweepField('sweepProgress', pfx + 'Computing sightmaps (backend)...')
        _flushSweepProgress(activeElmId, ((curElm - 1) / totElms) * 100, undefined, true)

        // Determine primary target
        const primary = selectedTargets[0]
        const primaryIsCustom =
            primary.value === false || primary.value === 'false'

        const sweepMaxDim = SightlineTool._resolutionToMaxDim(activeElmId)
        const sweepViewportBounds = _getViewportProjBounds()

        // Send start/end/step instead of full timestamps array
        const batchStartTime = timestamps[0]
        const batchEndTime = timestamps[timestamps.length - 1]

        // Stream NDJSON batch response via fetch
        const rootPath = window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''
        const sightmapUrl = `${rootPath}api/sightline/sightmap`
        const bodyObj = {
            dem: demUrl,
            lat: source.lat,
            lng: source.lng,
            height: options.height || 0,
            target: primaryIsCustom ? 'CUSTOM' : primary.value,
            startTime: batchStartTime,
            endTime: batchEndTime,
            stepSeconds: stepSeconds,
            obsRefFrame,
            obsBody,
            planetRadius: F_.radiusOfPlanetMajor,
            maxOutputDim: sweepMaxDim,
            isCustom: primaryIsCustom ? 'true' : 'false',
            customAz: primaryIsCustom ? (el.customAz || 0) : 0,
            customEl: primaryIsCustom ? (el.customEl || 0) : 0,
            viewportBounds: sweepViewportBounds ? sweepViewportBounds.join(',') : undefined,
            shadowReach: parseFloat(options.shadowReach) || 0,
        }

        fetch(sightmapUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(bodyObj),
        }).then(async (response) => {
            if (!response.ok) {
                let errMsg = 'Sightmap batch request failed'
                try { const j = await response.json(); errMsg = j.message || errMsg } catch (_) {}
                throw new Error(errMsg)
            }

            // Parse NDJSON stream line by line
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            const frames = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()
                for (const line of lines) {
                    if (!line.trim()) continue
                    const frame = JSON.parse(line)
                    if (frame.error) throw new Error(frame.message || 'Batch frame error')
                    frames.push(frame)
                    _flushSweepProgress(activeElmId,
                        ((curElm - 1) / totElms) * 100 + ((frames.length / timestamps.length) * 40 / totElms),
                        'Computing ' + frames.length + '/' + timestamps.length + '...', false)
                }
            }
            if (buffer.trim()) {
                const frame = JSON.parse(buffer.trim())
                if (!frame.error) frames.push(frame)
            }

            if (sweepRunId !== _sweepRunIds[activeElmId]) return
            if (frames.length === 0) {
                Toast.error('Sightmap batch returned no results.', 6000)
                useSightlineStore.getState().setSweepField('sweepProgress', '')
                _flushSweepProgress(activeElmId, 0, undefined, true)
                if (typeof onComplete === 'function') onComplete()
                return
            }

            // Decode compressed grids: first frame full, rest are XOR deltas
            const batchResults = []
            let prevFlat = null
            for (let fi = 0; fi < frames.length; fi++) {
                const f = frames[fi]
                let grid, flat
                if (f.gridB64z) {
                    const decoded = await _decodeGridB64z(f.gridB64z, f.rows, f.cols)
                    grid = decoded.grid
                    flat = decoded.flat
                } else if (f.deltaB64z && prevFlat) {
                    const decoded = await _decodeGridB64z(f.deltaB64z, f.rows, f.cols)
                    flat = _applyDelta(prevFlat, decoded.flat)
                    grid = _flatToGrid(flat, f.rows, f.cols)
                } else {
                    batchResults.push(null)
                    continue
                }
                prevFlat = flat
                batchResults.push({ grid, az: f.az, el: f.el, bounds: f.bounds, projBounds: f.projBounds, rows: f.rows, cols: f.cols })
            }

            const sweepResults = []
            const sweepGrids = []
            const total = timestamps.length

            const firstResult = batchResults[0]
            if (!firstResult) {
                Toast.error('Sightmap batch returned no valid results.', 6000)
                useSightlineStore.getState().setSweepField('sweepProgress', '')
                _flushSweepProgress(activeElmId, 0, undefined, true)
                if (typeof onComplete === 'function') onComplete()
                return
            }
            const data = {
                _bounds: firstResult.bounds,
                _projBounds: firstResult.projBounds || null,
                result: firstResult.grid,
                bottomLeftLatLng: {
                    lat: firstResult.bounds[1],
                    lng: firstResult.bounds[0],
                },
                cellSize:
                    firstResult.grid[0] && firstResult.grid[0].length > 1
                        ? (firstResult.bounds[2] - firstResult.bounds[0]) / firstResult.grid[0].length
                        : 0,
            }

            // Compute observer pixel position in the grid
            let obsPixelRow = null
            let obsPixelCol = null
            const refGrid = firstResult.grid
            if (refGrid && refGrid.length > 0) {
                const gridRows = refGrid.length
                const gridCols = refGrid[0] ? refGrid[0].length : 0
                const pb = firstResult.projBounds
                const gb = firstResult.bounds
                if (pb && _isCustomProjectedCRS()) {
                    const crs = Map_.map?.options?.crs
                    if (crs && typeof crs.project === 'function') {
                        const obsProj = crs.project({ lng: source.lng, lat: source.lat })
                        obsPixelCol = Math.round(((obsProj.x - pb[0]) / (pb[2] - pb[0])) * (gridCols - 1))
                        obsPixelRow = Math.round(((pb[3] - obsProj.y) / (pb[3] - pb[1])) * (gridRows - 1))
                    }
                } else if (gb) {
                    obsPixelCol = Math.round(((source.lng - gb[0]) / (gb[2] - gb[0])) * (gridCols - 1))
                    obsPixelRow = Math.round(((gb[3] - source.lat) / (gb[3] - gb[1])) * (gridRows - 1))
                }
                if (obsPixelRow != null) obsPixelRow = Math.max(0, Math.min(obsPixelRow, gridRows - 1))
                if (obsPixelCol != null) obsPixelCol = Math.max(0, Math.min(obsPixelCol, gridCols - 1))
            }

            for (let ti = 0; ti < total; ti++) {
                const ts = timestamps[ti]
                const r = batchResults[ti]

                if (!r) {
                    sweepResults.push({
                        time: ts,
                        visibilityPct: 0,
                        centerVisible: false,
                        azimuth: 0,
                        elevation: 0,
                        range: 0,
                    })
                    sweepGrids.push(null)
                    continue
                }

                const grid = r.grid
                let visCount = 0
                let totalCells = 0
                for (let y = 0; y < grid.length; y++) {
                    for (let x = 0; x < grid[y].length; x++) {
                        if (grid[y][x] !== 9) {
                            totalCells++
                            if (grid[y][x] === 1 || grid[y][x] === 2)
                                visCount++
                        }
                    }
                }
                const oy = obsPixelRow != null ? obsPixelRow : Math.floor(grid.length / 2)
                const ox = obsPixelCol != null ? obsPixelCol : (grid[0] ? Math.floor(grid[0].length / 2) : 0)
                const obsVal = grid[oy]?.[ox]
                const centerVisible = obsVal === 1 || obsVal === 2

                sweepResults.push({
                    time: ts,
                    visibilityPct: totalCells > 0
                        ? ((visCount / totalCells) * 100).toFixed(2)
                        : 0,
                    centerVisible,
                    azimuth: r.az,
                    elevation: r.el,
                    range: 0,
                })
                sweepGrids.push(grid)
            }

            // Update progress
            const currentStore = useSightlineStore.getState()
            const curElm2 = currentStore.sweepCurrentElm || 1
            const totElms2 = currentStore.sweepTotalElms || 1
            _flushSweepProgress(activeElmId, ((curElm2 - 1) / totElms2) * 100 + (50 / totElms2), undefined, true)

            // Finalize sweep
            const currentStoreF = useSightlineStore.getState()
            currentStoreF.setSweepElField(activeElmId, 'results', sweepResults)
            currentStoreF.setSweepElField(activeElmId, 'grids', sweepGrids)
            currentStoreF.setSweepField('sweepPlayIndex', 0)
            currentStoreF.setSweepElField(activeElmId, 'lastData', data)
            currentStoreF.setSweepElField(activeElmId, 'lastOptions', options)
            currentStoreF.setSweepElField(activeElmId, 'sweepCenter', {
                lat: source.lat,
                lng: source.lng,
            })
            SightlineTool._updateCrosshairPosition()

            currentStoreF.setSweepField('sweepProgress', 'Computing heatmap...')
            _flushSweepProgress(activeElmId, 50, undefined, true)

            // Yield to let progress update paint, then compute heatmap
            setTimeout(function () {
                const storeH = useSightlineStore.getState()

                if (sweepGrids.length > 0) {
                    const heatmap = SightlineTool_Algorithm.cumulativeVisibility(sweepGrids)
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

                    const activeEl = storeH.elements[activeElmId]
                    if (activeEl?.sightlineMode === 'composite') {
                        storeH.setSweepField('sweepViewMode', 'composite')
                        SightlineTool.renderHeatmapToMap(data, heatmap, activeElmId)
                    }
                }

                storeH.setSweepField('sweepStale', false)
                const curElmF = storeH.sweepCurrentElm || 1
                const totElmsF = storeH.sweepTotalElms || 1

                SightlineTool.buildSweepAtlas(data, sweepGrids, options, activeElmId, function () {
                    const currentMode = useSightlineStore.getState().elements[activeElmId]?.sightlineMode
                    if (currentMode === 'playback') {
                        SightlineTool.sweepShowAllFrames()
                    }
                    if (typeof onComplete === 'function') onComplete()
                    storeH.setSweepField('sweepProgress', '')
                    _flushSweepProgress(activeElmId, 100, undefined, true)
                    if (totElmsF > 1) {
                        Toast.success('Sightline ' + curElmF + ' of ' + totElmsF + ': ' + total + ' timesteps processed.', 3000)
                    } else {
                        Toast.success('Sweep complete. ' + total + ' timesteps processed.', 4000)
                    }
                })
            }, 0)
        }).catch((err) => {
            const msg = (err && err.message) ? err.message : 'Sightmap sweep request failed.'
            Toast.error(msg, 6000)
            useSightlineStore
                .getState()
                .setSweepField('sweepProgress', '')
            _flushSweepProgress(activeElmId, 0, undefined, true)
            if (typeof onComplete === 'function') onComplete()
        })
    },

    // Single-element sweep triggered from an element's Generate button
    sightlineSweepElement: function (elmId) {
        const store = useSightlineStore.getState()
        const startTime = store.sweepStart
        const endTime = store.sweepEnd
        const stepMinutes = store.sweepStep
        if (!startTime || !endTime || !stepMinutes) {
            Toast.warning('Set sweep Start Time, End Time and Step Size.', 6000)
            return
        }
        store.setSweepField('sweepStale', false)
        store.setActiveElmId(elmId)
        store.setSweepField('sweepTotalElms', 1)
        store.setSweepField('sweepCurrentElm', 1)
        // Initialize card order for this element
        const existingOrder = store.sweepCardOrder || []
        if (!existingOrder.includes(elmId)) {
            store.setSweepCardOrder([...existingOrder, elmId])
        }
        // Remove existing sightline layer and invalidate cached layers for this element
        delete SightlineTool._cachedLayers[elmId]
        Map_.rmNotNull(L_.layers.layer['sightline' + elmId])
        L_.layers.layer['sightline' + elmId] = null
        store.updateElement(elmId, { regenerating: true, loadingProgress: 0, sweepProgress: 'Starting...' })
        SightlineTool.sightlineSweep(startTime, endTime, stepMinutes, elmId, function () {
            const s = useSightlineStore.getState()
            s.updateElement(elmId, { regenerating: false, loadingProgress: 0, changed: false, sweepProgress: '' })
        })
    },

    sightlineSweepAll: function (startTime, endTime, stepMinutes) {
        SightlineTool._sweepAllRunId = (SightlineTool._sweepAllRunId || 0) + 1
        const runId = SightlineTool._sweepAllRunId
        const store = useSightlineStore.getState()
        store.setSweepField('sweepStale', false)

        // Cancel and reset all elements' loading state from any previous sweep
        for (const id in store.elements) {
            const numId = parseInt(id)
            _sweepRunIds[numId] = (_sweepRunIds[numId] || 0) + 1
            store.updateElement(numId, { loading: false, regenerating: false, loadingProgress: 0 })
        }

        // Clear existing sightline map layers and old sweep layers from the map
        SightlineTool.clearAllSightlineLayers()

        const activeIds = Object.keys(store.elements).filter(
            (id) => store.elements[id].on
        )
        if (activeIds.length === 0) {
            Toast.warning('Enable at least one sightline map for sweep.', 6000)
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
            if (runId !== SightlineTool._sweepAllRunId) return
            if (idx >= activeIds.length) {
                const s = useSightlineStore.getState()
                s.setSweepField('sweepProgress', 'Done (' + activeIds.length + ' sightline maps)')
                return
            }
            const id = parseInt(activeIds[idx])
            idx++
            const s = useSightlineStore.getState()
            s.setSweepField('sweepCurrentElm', idx)
            s.setActiveElmId(id)
            s.updateElement(id, { regenerating: true, loadingProgress: 0 })
            SightlineTool.sightlineSweep(startTime, endTime, stepMinutes, id, function () {
                const s2 = useSightlineStore.getState()
                s2.updateElement(id, { regenerating: false, loadingProgress: 0 })
                runNext()
            })
        }
        runNext()
    },

    // === Sweep Playback ===

    sweepPlay: function () {
        const store = useSightlineStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return

        if (store.sweepPlaying) {
            clearInterval(SightlineTool._sweepPlayTimer)
            SightlineTool._sweepPlayTimer = null
            store.setSweepField('sweepPlaying', false)
        } else {
            store.setSweepField('sweepPlaying', true)
            SightlineTool._sweepPlayTimer = setInterval(function () {
                const s = useSightlineStore.getState()
                const fc = s.getSweepFrameCount()
                if (fc === 0) return
                const nextIdx = (s.sweepPlayIndex + 1) % fc
                s.setSweepField('sweepPlayIndex', nextIdx)
                SightlineTool.sweepShowAllFrames()
            }, store.sweepPlaySpeed)
        }
    },

    sweepStepForward: function () {
        const store = useSightlineStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return
        const nextIdx = (store.sweepPlayIndex + 1) % frameCount
        store.setSweepField('sweepPlayIndex', nextIdx)
        SightlineTool.sweepShowAllFrames()
    },

    sweepStepBack: function () {
        const store = useSightlineStore.getState()
        const frameCount = store.getSweepFrameCount()
        if (frameCount === 0) return
        const nextIdx = (store.sweepPlayIndex - 1 + frameCount) % frameCount
        store.setSweepField('sweepPlayIndex', nextIdx)
        SightlineTool.sweepShowAllFrames()
    },

    sweepShowAllFrames: function () {
        const store = useSightlineStore.getState()
        store.setSweepField('sweepViewMode', 'playback')
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            const el = store.elements[id]
            if (ed?.grids?.length > 0 && el?.sightlineMode === 'playback') {
                SightlineTool.sweepShowFrame(parseInt(id))
            }
        }
        // Re-apply z-ordering so earlier elements stay on top
        const cardOrder = store.sweepCardOrder || []
        if (cardOrder.length > 0) {
            SightlineTool.reorderSweepLayers(cardOrder)
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
        SightlineTool_Graphs.updatePlaybackFrame(SightlineTool_Graphs.getActiveElmId())

        // Update TimeUI indicator for the current playback time
        SightlineTool._updateTimeUIIndicator()
    },

    sweepShowFrame: function (activeElmId) {
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[activeElmId]
        const idx = store.sweepPlayIndex
        const layerName = 'sightline' + activeElmId

        if (!ed?.frameImages || !ed.frameImages[idx]) return

        const imgUrl = ed.frameImages[idx]
        const data = ed.lastData
        if (!data) return

        const bounds = data._bounds
        const projBounds = data._projBounds
        const frameOpts = { className: 'nofade sightmap-pixelated', interactive: false }

        const layer = L_.layers.layer[layerName]
        if (layer && layer instanceof L.ImageOverlay) {
            layer.setUrl(imgUrl)
        } else {
            Map_.rmNotNull(layer)
            if (projBounds && _isCustomProjectedCRS() && Map_.map.options.crs && Map_.map.options.crs.unproject) {
                L_.layers.layer[layerName] = _projImageOverlay(
                    imgUrl, projBounds, frameOpts
                )
            } else if (bounds) {
                L_.layers.layer[layerName] = L.imageOverlay(
                    imgUrl,
                    [[bounds[1], bounds[0]], [bounds[3], bounds[2]]],
                    frameOpts
                )
            } else {
                return
            }
            L_.layers.layer[layerName].addTo(Map_.map)
            const st = useSightlineStore.getState()
            st.updateElement(activeElmId, { on: true })
            // Inherit static-mode opacity as sweep default if not yet set
            const el = st.elements[activeElmId]
            if (ed.opacity == null && el?.opacity != null) {
                st.setSweepElField(activeElmId, 'opacity', el.opacity)
            }
        }
        SightlineTool.applySweepOpacity(activeElmId)
    },

    sweepShowComposite: function (activeElmId) {
        const store = useSightlineStore.getState()
        store.setSweepField('sweepViewMode', 'composite')
        // Render composite heatmap for ALL elements with sweep data
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.heatmap && ed?.lastData) {
                SightlineTool.renderHeatmapToMap(ed.lastData, ed.heatmap, parseInt(id))
            }
        }
        // Re-apply z-ordering so earlier elements stay on top
        const cardOrder = store.sweepCardOrder || []
        if (cardOrder.length > 0) {
            SightlineTool.reorderSweepLayers(cardOrder)
        }
    },

    updateSweepSpeed: function (speed) {
        const store = useSightlineStore.getState()
        if (store.sweepPlaying && SightlineTool._sweepPlayTimer) {
            clearInterval(SightlineTool._sweepPlayTimer)
            SightlineTool._sweepPlayTimer = setInterval(function () {
                const s = useSightlineStore.getState()
                const fc = s.getSweepFrameCount()
                if (fc === 0) return
                const nextIdx = (s.sweepPlayIndex + 1) % fc
                s.setSweepField('sweepPlayIndex', nextIdx)
                SightlineTool.sweepShowAllFrames()
            }, speed)
        }
    },

    _updateTimeUIIndicator: function () {
        const store = useSightlineStore.getState()
        const idx = store.sweepPlayIndex
        // Find the first element with sweep results to get the current time
        for (const id in store.sweepElData) {
            const ed = store.sweepElData[id]
            if (ed?.results?.[idx]?.time) {
                TimeUI.addIndicator('sightlinetool-playback', 'sightlinetool', '#e53935', ed.results[idx].time)
                return
            }
        }
    },

    // === Export (delegated to SightlineTool_Export) ===

    _buildExportName: function (elmId, suffix) {
        return SightlineTool_Export._buildExportName(elmId, suffix)
    },

    exportPNG: function (elmId) {
        SightlineTool_Export.exportPNG(elmId)
    },

    _exportPlaybackGIF: function (elmId) {
        SightlineTool_Export._exportPlaybackGIF(elmId)
    },

    exportGeoTIFF: function (elmId) {
        SightlineTool_Export.exportGeoTIFF(elmId)
    },

    exportGrid: function (elmId) {
        SightlineTool_Export.exportGrid(elmId)
    },

    _getObserverDef: function (observerValue) {
        const store = useSightlineStore.getState()
        const observers = store.vars?.observers || []
        for (let i = 0; i < observers.length; i++) {
            if (observers[i].value === observerValue) return observers[i]
        }
        return null
    },

    _getObserverLng: function () {
        const store = useSightlineStore.getState()
        const ed = store.activeElmId != null ? store.sweepElData[store.activeElmId] : null
        if (ed?.sweepCenter) return parseFloat(ed.sweepCenter.lng)
        const mapEl = document.getElementById('map')
        if (mapEl && Map_.map) {
            const rect = mapEl.getBoundingClientRect()
            const center = Map_.map.containerPointToLatLng([rect.width / 2, rect.height / 2])
            return parseFloat(center.lng)
        }
        return null
    },

    // Preserved sub-second precision from last observer→UTC conversion
    // so that UTC→observer round-trips don't lose a second.
    _lastConvertedMs: '000',

    convertUTCToObserver: function (utcTime, observerValue, callback) {
        const obs = SightlineTool._getObserverDef(observerValue)
        if (!obs?.body || !observerValue) {
            if (callback) callback(null)
            return
        }
        // Re-attach saved ms precision for exact round-trip
        let time = utcTime
        if (SightlineTool._lastConvertedMs !== '000' && time) {
            time = time.replace('.000Z', '.' + SightlineTool._lastConvertedMs + 'Z')
                       .replace(/(\d{2}:\d{2}:\d{2})Z$/, '$1.' + SightlineTool._lastConvertedMs + 'Z')
        }
        const params = { body: obs.body, target: observerValue, from: 'utc', time: time }
        if (obs.type === 'lsmt') {
            const lng = SightlineTool._getObserverLng()
            if (lng != null) params.lng = lng
        }
        calls.api(
            'chronice',
            params,
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
        const obs = SightlineTool._getObserverDef(observerValue)
        if (!obs?.body || !observerValue) {
            if (callback) callback(null)
            return
        }
        const params = { body: obs.body, target: observerValue, from: 'lmst', time: localTime }
        if (obs.type === 'lsmt') {
            const lng = SightlineTool._getObserverLng()
            if (lng != null) params.lng = lng
        }
        calls.api(
            'chronice',
            params,
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

    // === RAE Indicators (delegated to SightlineTool_Indicators) ===

    updateRAEIndicators(rae, sightlineId, allResults) {
        SightlineTool_Indicators.updateRAEIndicators(rae, sightlineId, allResults)
    },

    drawAzAngleGuideOnCanvas(ctx, origin, sizeInner, angle, angle2, options) {
        SightlineTool_Indicators.drawAzAngleGuideOnCanvas(ctx, origin, sizeInner, angle, angle2, options)
    },

    drawElAngleGuideOnCanvas(ctx, origin, sizeInner, angle, options) {
        SightlineTool_Indicators.drawElAngleGuideOnCanvas(ctx, origin, sizeInner, angle, options)
    },

    drawMiniRAEIndicators(azCanvasId, elCanvasId, rae) {
        SightlineTool_Indicators.drawMiniRAEIndicators(azCanvasId, elCanvasId, rae)
    },

    drawSkyDome(canvasId, results, currentIdx) {
        SightlineTool_Indicators.drawSkyDome(canvasId, results, currentIdx)
    },

    // === Utility ===

    /** Compute maxOutputDim from the active element's resolution scale
     *  and the current map viewport pixel dimensions.
     *  resolution=1 → native (maxOutputDim = viewport longest dim)
     *  resolution=0.5 → half, etc.
     *  @param {number} [elmId] - element id to read resolution from; falls back to activeElmId
     *  @returns {number} maxOutputDim
     */
    _resolutionToMaxDim(elmId) {
        const store = useSightlineStore.getState()
        const id = elmId != null ? elmId : store.activeElmId
        const el = store.elements[id]
        const scale = el?.resolution || 0.25
        const map = Map_.map
        if (!map) return Math.max(Math.round(800 * scale), 50)
        const size = map.getSize()
        const longestDim = Math.max(size.x || 800, size.y || 800)
        return Math.max(Math.round(longestDim * scale), 50)
    },

    parseToUTCTime(time, formatted) {
        const vars = useSightlineStore.getState().vars
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
    getSightlineOptions: (elmId) => useSightlineStore.getState().getSightlineOptions(elmId),
    getSelectedSources: (elmId) =>
        useSightlineStore.getState().getSelectedSources(elmId),
}

export default SightlineTool
