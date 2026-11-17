import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import useUIStore from '@basics/UserInterface_/store/uiStore'
import useSightlineStore from './store'
import calls from '@pre/calls'
import Toast from '@design/components/Toast/Toast'
import tippy from 'tippy.js'

import SightlineTool from './SightlineTool'
import SightlineTool_Horizon from './SightlineTool_Horizon'
import SightlineTool_Visibility from './SightlineTool_Visibility'

const GRAPH_CONTAINER_ID = 'sightlineGraphContainer'
const HORIZON_CANVAS_ID = 'sightlineHorizonCanvas'
// Visibility timeline is now div-based (no canvas)
const AZIMUTH_LINE_ID = 'sightlineAzimuthLineOverlay'
const SOURCE_AZIMUTH_OVERLAY_ID = 'sightlineSourceAzimuthOverlay'
const HOVER_LINE_ID = 'sightlineHorizonHoverLine'

let _horizonCache = null // { lat, lng, profile: [[az,el],...] }
let _activeElmId = null
let _graphOpen = false
const _visFetchInFlight = {} // { [elmId]: true } dedupe visibility fetches
let _activeView = null // 'combined' | null
let _animFrameId = null
// Layout state cached for mouse→azimuth conversion
let _hPad = null
let _hPlotW = 0
// Callback registered by SightlineTool for bidirectional scrubbing
let _onScrubCallback = null
// Dragging state for time slider
let _isDragging = false
let _resizeObserver = null
let _resizeTimeout = null
let _windowResizeHandler = null
let _storeUnsubscribe = null
let _graphPlayInterval = null
let _graphPlayFast = false
let _mapMoveHandler = null

const SightlineTool_Graphs = {
    isOpen() {
        return _graphOpen
    },

    getActiveElmId() {
        return _activeElmId
    },

    getActiveView() {
        return _activeView
    },

    open(elmId) {
        _activeElmId = elmId
        _activeView = 'combined'
        _graphOpen = true

        // Height: horizon chart + visibility rows + time controls + padding
        const store = useSightlineStore.getState()
        const visCount = _getFilteredVisibilityElms(store, elmId).included.length
        const visHeight = Math.max(40, visCount * 24 + 30)
        useUIStore.getState().setToolHeight(250 + visHeight)

        setTimeout(() => {
            SightlineTool_Graphs._buildContainer()
            SightlineTool_Graphs.fetchAndDrawHorizon(elmId)
            SightlineTool_Graphs.drawVisibilityTimeline(elmId)
            SightlineTool_Graphs._updateSourceAzimuthLines()
        }, 50)

        if (!_mapMoveHandler) {
            _mapMoveHandler = () => { SightlineTool_Graphs._updateSourceAzimuthLines() }
            Map_.map.on('move', _mapMoveHandler)
        }
    },

    close() {
        _graphOpen = false
        _activeElmId = null
        _activeView = null
        _horizonCache = null

        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId)
            _animFrameId = null
        }
        if (_graphPlayInterval) {
            clearInterval(_graphPlayInterval)
            _graphPlayInterval = null
        }
        _graphPlayFast = false
        if (_resizeObserver) {
            _resizeObserver.disconnect()
            _resizeObserver = null
        }
        if (_windowResizeHandler) {
            window.removeEventListener('resize', _windowResizeHandler)
            _windowResizeHandler = null
        }
        if (_storeUnsubscribe) {
            _storeUnsubscribe()
            _storeUnsubscribe = null
        }
        if (_mapMoveHandler) {
            Map_.map.off('move', _mapMoveHandler)
            _mapMoveHandler = null
        }

        SightlineTool_Graphs.removeAzimuthLine()
        SightlineTool_Graphs._removeSourceAzimuthLines()
        SightlineTool_Horizon.setPolygonEnabled(false)
        SightlineTool_Horizon.removePolygon()

        const container = document.getElementById(GRAPH_CONTAINER_ID)
        if (container) container.remove()

        useUIStore.getState().setToolHeight(0)
    },

    toggle(elmId) {
        if (_graphOpen && _activeElmId === elmId) {
            SightlineTool_Graphs.close()
        } else {
            SightlineTool_Graphs.open(elmId)
        }
    },

    cleanup() {
        if (_graphOpen) SightlineTool_Graphs.close()
    },

    removeAzimuthLine() {
        const el = document.getElementById(AZIMUTH_LINE_ID)
        if (el) el.remove()
    },

    _showAzimuthLine(azDeg) {
        const mapEl = document.getElementById('map')
        if (!mapEl) return

        const store = useSightlineStore.getState()
        const mapRect = mapEl.getBoundingClientRect()

        const ed = _activeElmId != null ? store.sweepElData[_activeElmId] : null
        let centerLatLng
        if (ed?.sweepCenter) {
            centerLatLng = ed.sweepCenter
        } else {
            centerLatLng = Map_.map.containerPointToLatLng(
                [mapRect.width / 2, mapRect.height / 2]
            )
        }

        const centerPt = Map_.map.latLngToContainerPoint(centerLatLng)
        const end = _azimuthEndpoint(centerLatLng, centerPt, azDeg, mapRect)
        if (!end) return

        let overlay = document.getElementById(AZIMUTH_LINE_ID)
        if (!overlay) {
            overlay = document.createElement('div')
            overlay.id = AZIMUTH_LINE_ID
            overlay.className = 'sightlineAzimuthLine'
            overlay.style.width = mapRect.width + 'px'
            overlay.style.height = mapRect.height + 'px'
            overlay.style.top = '0'
            overlay.style.left = '0'
            mapEl.appendChild(overlay)
        }

        overlay.innerHTML =
            `<svg viewBox="0 0 ${mapRect.width} ${mapRect.height}">` +
            `<line x1="${centerPt.x}" y1="${centerPt.y}" x2="${end.x}" y2="${end.y}" ` +
            `stroke="#ffdd44" stroke-width="2.5" stroke-dasharray="8,4" />` +
            `</svg>`
    },

    /** Draw persistent colored azimuth lines for each sightline element at the current frame */
    _updateSourceAzimuthLines() {
        if (!_graphOpen || _activeElmId == null) {
            SightlineTool_Graphs._removeSourceAzimuthLines()
            return
        }

        const mapEl = document.getElementById('map')
        if (!mapEl) return

        const store = useSightlineStore.getState()
        const mapRect = mapEl.getBoundingClientRect()
        const { included: elms } = _getFilteredVisibilityElms(store, _activeElmId)
        if (elms.length === 0) return

        const primaryEd = store.sweepElData[_activeElmId]
        let centerLatLng
        if (primaryEd?.sweepCenter) {
            centerLatLng = primaryEd.sweepCenter
        } else {
            centerLatLng = Map_.map.containerPointToLatLng(
                [mapRect.width / 2, mapRect.height / 2]
            )
        }

        const centerPt = Map_.map.latLngToContainerPoint(centerLatLng)
        const playIndex = store.sweepPlayIndex

        let lines = ''
        for (const { id, el, ed } of elms) {
            const r = ed.results?.[playIndex]
            if (!r || r.azimuth == null) continue

            const brightness = el.color.r + el.color.g + el.color.b
            const c = brightness < 100
                ? { r: Math.min(el.color.r + 120, 255), g: Math.min(el.color.g + 120, 255), b: Math.min(el.color.b + 120, 255) }
                : el.color
            const colorStr = `rgb(${c.r},${c.g},${c.b})`

            const end = _azimuthEndpoint(centerLatLng, centerPt, r.azimuth, mapRect)
            if (!end) continue

            lines += `<line x1="${centerPt.x}" y1="${centerPt.y}" x2="${end.x}" y2="${end.y}" ` +
                `stroke="${colorStr}" stroke-width="3.5" stroke-dasharray="8,5" opacity="0.85" />`
        }

        let overlay = document.getElementById(SOURCE_AZIMUTH_OVERLAY_ID)
        if (!overlay) {
            overlay = document.createElement('div')
            overlay.id = SOURCE_AZIMUTH_OVERLAY_ID
            overlay.className = 'sightlineAzimuthLine'
            overlay.style.width = mapRect.width + 'px'
            overlay.style.height = mapRect.height + 'px'
            overlay.style.top = '0'
            overlay.style.left = '0'
            mapEl.appendChild(overlay)
        }
        overlay.style.width = mapRect.width + 'px'
        overlay.style.height = mapRect.height + 'px'
        overlay.innerHTML = `<svg viewBox="0 0 ${mapRect.width} ${mapRect.height}">${lines}</svg>`
    },

    _removeSourceAzimuthLines() {
        const el = document.getElementById(SOURCE_AZIMUTH_OVERLAY_ID)
        if (el) el.remove()
    },

    _buildContainer() {
        let container = document.getElementById(GRAPH_CONTAINER_ID)
        if (container) container.remove()

        const tools = document.getElementById('tools')
        if (!tools) return

        container = document.createElement('div')
        container.id = GRAPH_CONTAINER_ID
        container.className = 'sightlineGraphContainer'

        // --- Header bar with title and horizon range slider ---
        const header = document.createElement('div')
        header.className = 'sightlineGraphHeader'

        const title = document.createElement('span')
        title.className = 'sightlineGraphTitle'
        title.textContent = 'Sightline Graphs'
        header.appendChild(title)

        // Dual-handle log-scale range slider for horizon lookup distance
        const rangeWrap = document.createElement('div')
        rangeWrap.className = 'sightlineHorizonRangeWrap'
        rangeWrap.innerHTML = `
            <span class="sightlineHorizonRangeLabel" id="sightlineHorizonRangeLabel">Range:</span>
            <span class="sightlineHorizonRangeValue" id="sightlineHorizonMinLabel">1m</span>
            <div class="sightlineHorizonRangeTrack" id="sightlineHorizonRangeTrack">
                <div class="sightlineHorizonRangeFill" id="sightlineHorizonRangeFill"></div>
                <div class="sightlineHorizonRangeHandle" id="sightlineHorizonMinHandle" data-handle="min"></div>
                <div class="sightlineHorizonRangeHandle" id="sightlineHorizonMaxHandle" data-handle="max"></div>
            </div>
            <span class="sightlineHorizonRangeValue" id="sightlineHorizonMaxLabel">250km</span>
        `
        header.appendChild(rangeWrap)

        const polygonWrap = document.createElement('div')
        polygonWrap.className = 'sightlineHorizonPolygonToggle'
        polygonWrap.innerHTML = `
            <span class="sightlineHorizonPolygonLabel">Horizon Polygon:</span>
            <div class="mmgis-checkbox"><input type="checkbox" id="sightlineHorizonPolygonCb"/><label for="sightlineHorizonPolygonCb"></label></div>
        `
        header.appendChild(polygonWrap)

        // Temporal sampling-rate selector for the visibility timeline.
        // 1x = one dedicated visibility ray per sweep timestep; Nx computes
        // N samples per timestep for a smoother visibility chart.
        const samplingWrap = document.createElement('div')
        samplingWrap.className = 'sightlineVisSamplingWrap'
        const curRate = useSightlineStore.getState().sweepVisSamplingRate || 1
        const rateOptions = [1, 2, 4, 8, 16, 32, 64, 128, 256]
        samplingWrap.innerHTML = `
            <span class="sightlineVisSamplingLabel">Visibility Sampling:</span>
            <select class="sightlineVisSamplingSelect" id="sightlineVisSamplingSelect">
                ${rateOptions.map((r) => `<option value="${r}"${r === curRate ? ' selected' : ''}>${r}x</option>`).join('')}
            </select>
        `
        header.appendChild(samplingWrap)

        setTimeout(() => {
            const cb = document.getElementById('sightlineHorizonPolygonCb')
            if (cb) {
                cb.checked = false
                cb.addEventListener('change', () => {
                    SightlineTool_Horizon.setPolygonEnabled(cb.checked)
                })
            }
            const polyLabel = polygonWrap.querySelector('.sightlineHorizonPolygonLabel')
            if (polyLabel) {
                tippy(polyLabel, {
                    content: 'Toggle a polygon on the map showing the horizon profile outline',
                    placement: 'bottom',
                    theme: 'blue',
                    maxWidth: 260,
                })
            }
            const samplingSel = document.getElementById('sightlineVisSamplingSelect')
            if (samplingSel) {
                samplingSel.addEventListener('change', () => {
                    const rate = parseInt(samplingSel.value, 10) || 1
                    useSightlineStore.getState().setSweepField('sweepVisSamplingRate', rate)
                    SightlineTool_Graphs._ensureVisibilityData(_activeElmId, true)
                })
            }
            const samplingLabel = samplingWrap.querySelector('.sightlineVisSamplingLabel')
            if (samplingLabel) {
                tippy(samplingLabel, {
                    content: 'Temporal sampling of the visibility timeline: 1x is one native-resolution ray per sweep timestep; higher rates compute intermediate samples for a smoother chart',
                    placement: 'bottom',
                    theme: 'blue',
                    maxWidth: 300,
                })
            }
        }, 0)

        const closeBtn = document.createElement('div')
        closeBtn.className = 'sightlineGraphClose'
        closeBtn.innerHTML = '<i class="mdi mdi-close mdi-18px"></i>'
        closeBtn.title = 'Close graph'
        closeBtn.onclick = () => SightlineTool_Graphs.close()
        header.appendChild(closeBtn)

        container.appendChild(header)

        // Initialize range slider logic
        setTimeout(() => SightlineTool_Graphs._initHorizonRangeSlider(), 0)

        // --- Info banner (hidden by default, shown when elements are excluded) ---
        const infoBanner = document.createElement('div')
        infoBanner.id = 'sightlineGraphExcludedInfo'
        infoBanner.className = 'sightlineGraphExcludedInfo'
        infoBanner.style.display = 'none'
        container.appendChild(infoBanner)

        // --- Horizon panel ---
        const hPanel = document.createElement('div')
        hPanel.className = 'sightlineGraphPanel'
        hPanel.style.flex = '1 1 0'
        hPanel.style.minHeight = '0'
        const canvas = document.createElement('canvas')
        canvas.id = HORIZON_CANVAS_ID
        canvas.className = 'sightlineGraphCanvas'
        hPanel.appendChild(canvas)
        container.appendChild(hPanel)

        canvas.addEventListener('mousemove', SightlineTool_Graphs._onHorizonMouseMove)
        canvas.addEventListener('mouseleave', SightlineTool_Graphs._onHorizonMouseLeave)

        // --- Visibility panel ---
        const vPanel = document.createElement('div')
        vPanel.className = 'sightlineGraphPanel sightlineVisPanel'

        const visWrap = document.createElement('div')
        visWrap.id = 'sightlineVisibilityWrap'
        visWrap.className = 'sightlineVisWrap'
        vPanel.appendChild(visWrap)
        const timeRow = document.createElement('div')
        timeRow.id = 'sightlineVisTimeLabels'
        timeRow.className = 'sightlineVisTimeLabels'
        vPanel.appendChild(timeRow)
        container.appendChild(vPanel)

        visWrap.addEventListener('mousedown', SightlineTool_Graphs._onVisibilityMouseDown)
        visWrap.addEventListener('mousemove', SightlineTool_Graphs._onVisibilityMouseMove)
        visWrap.addEventListener('mouseup', SightlineTool_Graphs._onVisibilityMouseUp)
        visWrap.addEventListener('mouseleave', SightlineTool_Graphs._onVisibilityMouseLeave)

        // --- Time controls bar ---
        const controls = document.createElement('div')
        controls.className = 'sightlineGraphTimeControls'
        controls.innerHTML = `
            <button class="sightlineGraphPlayBtn" id="sightlineGraphStepBack" title="Step back"><i class="mdi mdi-skip-previous mdi-18px"></i></button>
            <button class="sightlineGraphPlayBtn" id="sightlineGraphPlayPause" title="Play/Pause"><i class="mdi mdi-play mdi-18px"></i></button>
            <button class="sightlineGraphPlayBtn" id="sightlineGraphPlayFast" title="Fast forward"><i class="mdi mdi-fast-forward mdi-18px"></i></button>
            <button class="sightlineGraphPlayBtn" id="sightlineGraphStepFwd" title="Step forward"><i class="mdi mdi-skip-next mdi-18px"></i></button>
            <input type="range" class="sightlineGraphTimeSlider" id="sightlineGraphTimeSlider" min="0" max="1" step="1" value="0" />
            <span class="sightlineGraphTimeLabel" id="sightlineGraphTimeLabel"></span>
        `
        container.appendChild(controls)

        tools.appendChild(container)

        // Wire up time controls
        setTimeout(() => SightlineTool_Graphs._initHorizonTimeControls(), 0)

        // Redraw handler for resize events
        const _scheduleRedraw = () => {
            if (!_graphOpen || !_activeElmId) return
            if (_resizeTimeout) clearTimeout(_resizeTimeout)
            _resizeTimeout = setTimeout(() => {
                // Use fetchAndDrawHorizon which handles both cached and
                // uncached (e.g. invalidated by moveend) cases.
                // It also redraws the visibility timeline after the
                // profile is available.
                SightlineTool_Graphs.fetchAndDrawHorizon(_activeElmId)
            }, 60)
        }

        // ResizeObserver on container
        if (_resizeObserver) _resizeObserver.disconnect()
        _resizeObserver = new ResizeObserver(_scheduleRedraw)
        _resizeObserver.observe(container)

        // Window resize listener
        if (_windowResizeHandler) window.removeEventListener('resize', _windowResizeHandler)
        _windowResizeHandler = _scheduleRedraw
        window.addEventListener('resize', _windowResizeHandler)

        // Subscribe to uiStore pxIsTools changes (splitter drag)
        if (_storeUnsubscribe) _storeUnsubscribe()
        let _lastPxIsTools = useUIStore.getState().pxIsTools
        _storeUnsubscribe = useUIStore.subscribe((state) => {
            if (state.pxIsTools !== _lastPxIsTools) {
                _lastPxIsTools = state.pxIsTools
                _scheduleRedraw()
            }
        })
    },

    registerScrubCallback(cb) {
        _onScrubCallback = cb
    },

    _scrubToFrame(frameIndex) {
        const store = useSightlineStore.getState()
        store.setSweepField('sweepPlayIndex', frameIndex)
        if (_onScrubCallback) _onScrubCallback()
    },

    _onHorizonMouseMove(e) {
        if (!_hPad || _hPlotW <= 0) return
        const canvas = e.target
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const frac = (mouseX - _hPad.left) / _hPlotW
        if (frac < 0 || frac > 1) {
            SightlineTool_Graphs.removeAzimuthLine()
            SightlineTool_Graphs._hideHoverLine()
            SightlineTool_Graphs._hideHorizonTooltip()
            return
        }
        const displayAz = -180 + frac * 360
        let trueAz = displayAz
        if (trueAz < 0) trueAz += 360
        SightlineTool_Graphs._showAzimuthLine(trueAz)
        SightlineTool_Graphs._showHoverLine(mouseX)
        SightlineTool_Graphs._showHorizonTooltip(trueAz, mouseX, mouseY)
    },

    _onHorizonMouseLeave() {
        SightlineTool_Graphs.removeAzimuthLine()
        SightlineTool_Graphs._hideHoverLine()
        SightlineTool_Graphs._hideHorizonTooltip()
    },

    _initHorizonTimeControls() {
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[_activeElmId]
        const frameCount = ed?.results?.length || 0

        const slider = document.getElementById('sightlineGraphTimeSlider')
        const label = document.getElementById('sightlineGraphTimeLabel')
        const playBtn = document.getElementById('sightlineGraphPlayPause')
        const fastBtn = document.getElementById('sightlineGraphPlayFast')
        const stepBack = document.getElementById('sightlineGraphStepBack')
        const stepFwd = document.getElementById('sightlineGraphStepFwd')

        if (!slider) return

        slider.max = Math.max(frameCount - 1, 0)
        slider.value = store.sweepPlayIndex

        // Update label
        SightlineTool_Graphs._updateTimeLabel()

        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.value)
            SightlineTool_Graphs._scrubToFrame(idx)
        })

        stepBack.addEventListener('click', () => {
            const s = useSightlineStore.getState()
            const fc = s.sweepElData[_activeElmId]?.results?.length || 0
            if (fc === 0) return
            const idx = (s.sweepPlayIndex - 1 + fc) % fc
            SightlineTool_Graphs._scrubToFrame(idx)
        })

        stepFwd.addEventListener('click', () => {
            const s = useSightlineStore.getState()
            const fc = s.sweepElData[_activeElmId]?.results?.length || 0
            if (fc === 0) return
            const idx = (s.sweepPlayIndex + 1) % fc
            SightlineTool_Graphs._scrubToFrame(idx)
        })

        function _startPlayback() {
            const speed = useSightlineStore.getState().sweepPlaySpeed || 500
            const interval = _graphPlayFast ? Math.max(speed / 4, 50) : speed
            _graphPlayInterval = setInterval(() => {
                const s = useSightlineStore.getState()
                const fc = s.sweepElData[_activeElmId]?.results?.length || 0
                if (fc === 0) return
                const idx = (s.sweepPlayIndex + 1) % fc
                SightlineTool_Graphs._scrubToFrame(idx)
            }, interval)
        }

        playBtn.addEventListener('click', () => {
            if (_graphPlayInterval) {
                clearInterval(_graphPlayInterval)
                _graphPlayInterval = null
                _graphPlayFast = false
                playBtn.innerHTML = '<i class="mdi mdi-play mdi-18px"></i>'
                fastBtn.classList.remove('sightlineGraphPlayBtnActive')
            } else {
                playBtn.innerHTML = '<i class="mdi mdi-pause mdi-18px"></i>'
                _startPlayback()
            }
        })

        fastBtn.addEventListener('click', () => {
            _graphPlayFast = !_graphPlayFast
            fastBtn.classList.toggle('sightlineGraphPlayBtnActive', _graphPlayFast)
            // If currently playing, restart with new speed
            if (_graphPlayInterval) {
                clearInterval(_graphPlayInterval)
                _startPlayback()
            } else {
                // Start playing fast
                playBtn.innerHTML = '<i class="mdi mdi-pause mdi-18px"></i>'
                _startPlayback()
            }
        })
    },

    _updateTimeLabel() {
        const label = document.getElementById('sightlineGraphTimeLabel')
        const slider = document.getElementById('sightlineGraphTimeSlider')
        if (!label || !slider) return
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[_activeElmId]
        if (!ed?.results) return
        const idx = store.sweepPlayIndex
        slider.value = idx
        const t = ed.results[idx]?.time
        label.textContent = t ? _formatTimeLabel(t) : ''
    },

    _showHoverLine(x) {
        const canvas = document.getElementById(HORIZON_CANVAS_ID)
        if (!canvas) return
        let line = document.getElementById(HOVER_LINE_ID)
        if (!line) {
            line = document.createElement('div')
            line.id = HOVER_LINE_ID
            line.className = 'sightlineHorizonHoverLine'
            canvas.parentElement.appendChild(line)
        }
        line.style.left = x + 'px'
        line.style.display = 'block'
    },

    _hideHoverLine() {
        const line = document.getElementById(HOVER_LINE_ID)
        if (line) line.style.display = 'none'
    },

    _showHorizonTooltip(trueAz, mouseX, mouseY) {
        const profile = _horizonCache?.profile
        if (!profile || profile.length === 0) return
        // Find closest azimuth in profile
        const step = 360.0 / profile.length
        let idx = Math.round(trueAz / step) % profile.length
        if (idx < 0) idx += profile.length
        const el = profile[idx][1]
        const dist = profile[idx][2] || 0
        // Format distance
        let distStr
        if (dist >= 1000) distStr = (dist / 1000).toFixed(2) + ' km'
        else distStr = Math.round(dist) + ' m'
        const azStr = trueAz.toFixed(1) + '°'
        const elStr = el.toFixed(1) + '°'

        const canvas = document.getElementById(HORIZON_CANVAS_ID)
        if (!canvas) return
        let tip = document.getElementById('sightlineHorizonTooltip')
        if (!tip) {
            tip = document.createElement('div')
            tip.id = 'sightlineHorizonTooltip'
            tip.className = 'sightlineHorizonTooltip'
            canvas.parentElement.appendChild(tip)
        }
        tip.textContent = `Az: ${azStr}  El: ${elStr}  Dist: ${distStr}`
        // Position above cursor
        tip.style.left = mouseX + 'px'
        tip.style.top = (mouseY - 28) + 'px'
        tip.style.display = 'block'
    },

    _hideHorizonTooltip() {
        const tip = document.getElementById('sightlineHorizonTooltip')
        if (tip) tip.style.display = 'none'
    },

    // --- Dual-handle log-scale range slider for horizon distance ---
    // Log scale: min range 1m–1000m, max range 5000m–250000m
    _HORIZON_LOG_MIN: Math.log(1),       // ln(1) = 0
    _HORIZON_LOG_MAX: Math.log(250000),  // ln(250000) ≈ 12.43
    _horizonMinDist: 1,      // default 1m
    _horizonMaxDist: 250000, // default 250km

    _logToMeters(frac) {
        const logMin = SightlineTool_Graphs._HORIZON_LOG_MIN
        const logMax = SightlineTool_Graphs._HORIZON_LOG_MAX
        return Math.exp(logMin + frac * (logMax - logMin))
    },

    _metersToFrac(meters) {
        const logMin = SightlineTool_Graphs._HORIZON_LOG_MIN
        const logMax = SightlineTool_Graphs._HORIZON_LOG_MAX
        return (Math.log(meters) - logMin) / (logMax - logMin)
    },

    _formatDist(m) {
        if (m >= 1000) return (m / 1000).toFixed(m >= 10000 ? 0 : 1) + 'km'
        return Math.round(m) + 'm'
    },

    _initHorizonRangeSlider() {
        const track = document.getElementById('sightlineHorizonRangeTrack')
        if (!track) return

        const minHandle = document.getElementById('sightlineHorizonMinHandle')
        const maxHandle = document.getElementById('sightlineHorizonMaxHandle')
        const fill = document.getElementById('sightlineHorizonRangeFill')
        const minLabel = document.getElementById('sightlineHorizonMinLabel')
        const maxLabel = document.getElementById('sightlineHorizonMaxLabel')

        let dragging = null

        const updatePositions = () => {
            const minFrac = SightlineTool_Graphs._metersToFrac(SightlineTool_Graphs._horizonMinDist)
            const maxFrac = SightlineTool_Graphs._metersToFrac(SightlineTool_Graphs._horizonMaxDist)
            minHandle.style.left = (minFrac * 100) + '%'
            maxHandle.style.left = (maxFrac * 100) + '%'
            fill.style.left = (minFrac * 100) + '%'
            fill.style.width = ((maxFrac - minFrac) * 100) + '%'
            minLabel.textContent = SightlineTool_Graphs._formatDist(SightlineTool_Graphs._horizonMinDist)
            maxLabel.textContent = SightlineTool_Graphs._formatDist(SightlineTool_Graphs._horizonMaxDist)
        }

        const onMove = (e) => {
            if (!dragging) return
            const rect = track.getBoundingClientRect()
            let frac = (e.clientX - rect.left) / rect.width
            frac = Math.max(0, Math.min(1, frac))
            const meters = SightlineTool_Graphs._logToMeters(frac)

            if (dragging === 'min') {
                SightlineTool_Graphs._horizonMinDist = Math.min(meters, SightlineTool_Graphs._horizonMaxDist * 0.5)
            } else {
                SightlineTool_Graphs._horizonMaxDist = Math.max(meters, SightlineTool_Graphs._horizonMinDist * 2)
            }
            updatePositions()
        }

        const onUp = () => {
            if (!dragging) return
            dragging = null
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            // Invalidate and refetch with new distances
            SightlineTool_Graphs.invalidateAndRefetch()
        }

        const onDown = (e) => {
            dragging = e.target.dataset.handle
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
            e.preventDefault()
        }

        minHandle.addEventListener('mousedown', onDown)
        maxHandle.addEventListener('mousedown', onDown)

        updatePositions()

        // Tippy tooltip on the "Horizon:" label
        const label = document.getElementById('sightlineHorizonRangeLabel')
        if (label) {
            tippy(label, {
                content: 'Min/max distance for the horizon profile ray march. The left handle sets how close terrain is sampled (skip nearby clutter) and the right handle sets how far rays search for the skyline.',
                placement: 'bottom',
                theme: 'blue',
                maxWidth: 260,
            })
        }
    },

    _onVisibilityMouseDown(e) {
        _isDragging = true
        SightlineTool_Graphs._scrubFromVisibilityX(e)
    },

    _onVisibilityMouseMove(e) {
        if (_isDragging) {
            SightlineTool_Graphs._scrubFromVisibilityX(e)
        }
    },

    _onVisibilityMouseUp() {
        _isDragging = false
    },

    _onVisibilityMouseLeave() {
        _isDragging = false
    },

    _scrubFromVisibilityX(e) {
        const wrap = document.getElementById('sightlineVisibilityWrap')
        if (!wrap) return
        const store = useSightlineStore.getState()
        // Use the first element with results to determine frame count
        const { included: elms } = _getFilteredVisibilityElms(store, _activeElmId)
        if (elms.length === 0) return
        const frameCount = elms[0].ed.results.length
        if (frameCount === 0) return

        const rect = wrap.getBoundingClientRect()
        // Measure the actual bar offset for responsive alignment
        const firstBar = wrap.querySelector('.sightlineVisBar')
        if (!firstBar) return
        const barLeft = firstBar.getBoundingClientRect().left - rect.left
        const barAreaW = firstBar.getBoundingClientRect().width
        const mouseX = e.clientX - rect.left - barLeft
        if (barAreaW <= 0) return

        const frac = mouseX / barAreaW
        if (frac < 0 || frac > 1) return
        const frameIndex = Math.round(frac * (frameCount - 1))
        SightlineTool_Graphs._scrubToFrame(Math.max(0, Math.min(frameIndex, frameCount - 1)))
    },

    fetchAndDrawHorizon(elmId) {
        SightlineTool_Horizon.fetchAndDraw(elmId, {
            getMinDist: () => SightlineTool_Graphs._horizonMinDist,
            getMaxDist: () => SightlineTool_Graphs._horizonMaxDist,
            onDone: () => {
                _horizonCache = SightlineTool_Horizon.getCache()
                _hPad = SightlineTool_Horizon.getLayoutPad()
                _hPlotW = SightlineTool_Horizon.getLayoutPlotW()
                SightlineTool_Graphs.drawVisibilityTimeline(elmId)
            },
        })
    },

    _drawHorizonCanvas(profile, elmId) {
        SightlineTool_Horizon.draw(profile, elmId)
        _hPad = SightlineTool_Horizon.getLayoutPad()
        _hPlotW = SightlineTool_Horizon.getLayoutPlotW()
    },

    drawVisibilityTimeline(elmId) {
        const id = elmId != null ? elmId : _activeElmId
        SightlineTool_Graphs._ensureVisibilityData(id, false)
        // If a fetch was just started, render blank (not stale) until it lands.
        const loading = Object.keys(_visFetchInFlight).length > 0
        SightlineTool_Visibility.draw(id, { blankVisible: loading })
    },

    // Fetch the dedicated native-resolution visibility series for every element
    // shown in the timeline whose cached series is missing or stale (wrong
    // sampling rate / range). Redraws as each element's data arrives. Fetches
    // are deduped via _visFetchInFlight so repeated draw calls are cheap.
    _ensureVisibilityData(elmId, force) {
        const id = elmId != null ? elmId : _activeElmId
        if (id == null) return
        const store = useSightlineStore.getState()
        const rate = store.sweepVisSamplingRate || 1
        const maxDist = SightlineTool_Graphs._horizonMaxDist
        const minDist = SightlineTool_Graphs._horizonMinDist
        const { included } = _getFilteredVisibilityElms(store, id)
        for (const { id: eid } of included) {
            const ed = store.sweepElData[eid]
            const cached = ed?.visResults
            const fresh = cached && cached.samplingRate === rate &&
                cached.baseStart === ed.results[0]?.time &&
                cached.baseCount === ed.results.length &&
                cached.maxDist === maxDist && cached.minDist === minDist
            if (fresh && !force) continue
            if (_visFetchInFlight[eid]) continue
            SightlineTool_Graphs._fetchVisibilityFor(eid, rate, maxDist, minDist)
        }
    },

    // Toggle the subtle indeterminate loading sweep on the visibility timeline
    // whenever any element's series is being fetched.
    _updateVisLoadingIndicator() {
        const wrap = document.getElementById('sightlineVisibilityWrap')
        if (!wrap) return
        const anyInFlight = Object.keys(_visFetchInFlight).length > 0
        wrap.classList.toggle('sightlineVisLoading', anyInFlight)
    },

    _fetchVisibilityFor(eid, rate, maxDist, minDist) {
        _visFetchInFlight[eid] = true
        SightlineTool_Graphs._updateVisLoadingIndicator()
        // Render the timeline as if nothing were visible while loading, so
        // stale visibility runs aren't shown under the loading sweep.
        SightlineTool_Visibility.draw(_activeElmId, { blankVisible: true })
        SightlineTool.fetchVisibilitySeries(eid, rate, maxDist, minDist, (ok) => {
            delete _visFetchInFlight[eid]
            SightlineTool_Graphs._updateVisLoadingIndicator()
            if (!_graphOpen) return
            // Only re-check freshness on success: the series was stored (and
            // rate/range may have changed mid-flight, warranting a superseding
            // fetch). On failure, redraw the fallback but do NOT re-ensure —
            // that would refetch the same failing params in an infinite loop.
            if (ok) SightlineTool_Graphs._ensureVisibilityData(_activeElmId, false)
            SightlineTool_Visibility.draw(_activeElmId)
        })
    },

    updatePlaybackFrame(elmId) {
        if (!_graphOpen) return
        const effectiveId = elmId != null ? elmId : _activeElmId
        if (effectiveId == null) return

        // Re-sync the time slider max in case a new sweep changed the frame count
        const slider = document.getElementById('sightlineGraphTimeSlider')
        if (slider) {
            const store = useSightlineStore.getState()
            const ed = store.sweepElData[effectiveId]
            const fc = ed?.results?.length || 0
            slider.max = Math.max(fc - 1, 0)
        }

        if (_animFrameId) cancelAnimationFrame(_animFrameId)
        _animFrameId = requestAnimationFrame(() => {
            // Always route through fetchAndDrawHorizon — it validates the
            // cache against the current sweep center and refetches if stale.
            SightlineTool_Graphs.fetchAndDrawHorizon(effectiveId)
            SightlineTool_Graphs._updateTimeLabel()
            SightlineTool_Graphs._updateSourceAzimuthLines()
            _animFrameId = null
        })
    },

    invalidateHorizonCache() {
        _horizonCache = null
    },

    invalidateAndRefetch() {
        _horizonCache = null
        if (_graphOpen && _activeElmId != null) {
            SightlineTool_Graphs.fetchAndDrawHorizon(_activeElmId)
        }
    },

    _updateExcludedInfo(excludedCount) {
        const el = document.getElementById('sightlineGraphExcludedInfo')
        if (!el) return
        if (excludedCount > 0) {
            el.innerHTML = `<i class="mdi mdi-information-outline"></i> ${excludedCount} sightline map${excludedCount > 1 ? 's' : ''} excluded (different center or time range)`
            el.style.display = ''
        } else {
            el.style.display = 'none'
        }
    },
}

/** Convert true azimuth (0..360) to display azimuth (-180..+180) with 0° at center */
function _azToDisplay(az) {
    let a = az
    if (a < 0) a += 360
    return a > 180 ? a - 360 : a
}

/**
 * Forward geodesic on a sphere: from (lat, lng) move along geographic
 * azimuth `azDeg` (CW from north) by `distDeg` angular degrees.
 * Returns { lat, lng } in degrees.
 */
function _destinationPoint(lat, lng, azDeg, distDeg) {
    const toRad = Math.PI / 180
    const toDeg = 180 / Math.PI
    const lat1 = lat * toRad
    const lng1 = lng * toRad
    const az = azDeg * toRad
    const d = distDeg * toRad
    const sinLat1 = Math.sin(lat1)
    const cosLat1 = Math.cos(lat1)
    const sinD = Math.sin(d)
    const cosD = Math.cos(d)
    const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(az))
    const lng2 = lng1 + Math.atan2(
        Math.sin(az) * sinD * cosLat1,
        cosD - sinLat1 * Math.sin(lat2)
    )
    return { lat: lat2 * toDeg, lng: lng2 * toDeg }
}

/**
 * Compute the screen endpoint for an azimuth line from `centerLatLng`.
 * Projects a destination point along `azDeg` and extends to the map edge.
 */
function _azimuthEndpoint(centerLatLng, centerPt, azDeg, mapRect) {
    const dest = _destinationPoint(
        centerLatLng.lat, centerLatLng.lng, azDeg, 1.0
    )
    const destPt = Map_.map.latLngToContainerPoint(dest)
    const dx = destPt.x - centerPt.x
    const dy = destPt.y - centerPt.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.5) return null
    const lineLen = Math.max(mapRect.width, mapRect.height)
    return { x: centerPt.x + (dx / len) * lineLen,
             y: centerPt.y + (dy / len) * lineLen }
}

/** Convert true azimuth to plot x position (north-centered) */
function _azToPlotX(az, pad, plotW) {
    const d = _azToDisplay(az)
    return pad.left + ((d + 180) / 360) * plotW
}

function _interpolateHorizon(profile, azDeg) {
    if (!profile || profile.length === 0) return 0
    const n = profile.length
    const azStep = 360.0 / n

    let idx = azDeg / azStep
    const i0 = Math.floor(idx) % n
    const i1 = (i0 + 1) % n
    const frac = idx - Math.floor(idx)

    return profile[i0][1] * (1 - frac) + profile[i1][1] * frac
}

function _formatTimeLabel(timeStr) {
    if (!timeStr) return ''
    // Full ISO time (matching vstSweepFrameLabel format)
    return timeStr.replace(/\.\d{3}Z$/, 'Z').replace(' UTC', '')
}

/** Smart time label: omit year if constant across all times, omit seconds/microseconds */
function _formatSmartTimeLabel(timeStr, omitYear) {
    if (!timeStr) return ''
    try {
        const d = new Date(timeStr)
        if (isNaN(d.getTime())) return timeStr
        const mon = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
        const day = d.getUTCDate()
        const hr = String(d.getUTCHours()).padStart(2, '0')
        const min = String(d.getUTCMinutes()).padStart(2, '0')
        if (omitYear) {
            return `${mon} ${day} ${hr}:${min}`
        }
        return `${mon} ${day}, ${d.getUTCFullYear()} ${hr}:${min}`
    } catch {
        return timeStr
    }
}

/** Gather linked elements that share same center/time/step for multi-arc horizon display */
function _getLinkedHorizonElms(store, primaryElmId) {
    const primaryEd = store.sweepElData[primaryElmId]
    const primaryEl = store.elements[primaryElmId]
    if (!primaryEd?.results || !primaryEl) {
        return [{ id: primaryElmId, color: primaryEl?.color || { r: 219, g: 182, b: 88 } }]
    }

    const out = []
    const primaryCenter = primaryEd.sweepCenter
    const primaryStart = primaryEd.results[0]?.time
    const primaryStep = primaryEd.results.length > 1
        ? primaryEd.results[1]?.time
        : null

    for (const id in store.elements) {
        const numId = parseInt(id)
        const el = store.elements[numId]
        const ed = store.sweepElData[numId]
        if (!el || !ed?.results || ed.results.length === 0) continue

        // Check if linked and sharing center/time/step
        if (numId === primaryElmId) {
            out.push({ id: numId, color: el.color })
            continue
        }

        // Compare sweep center
        if (primaryCenter && ed.sweepCenter) {
            if (Math.abs(primaryCenter.lat - ed.sweepCenter.lat) > 0.0001 ||
                Math.abs(primaryCenter.lng - ed.sweepCenter.lng) > 0.0001) continue
        }

        // Compare start time and step
        const otherStart = ed.results[0]?.time
        const otherStep = ed.results.length > 1 ? ed.results[1]?.time : null
        if (primaryStart !== otherStart) continue
        if (primaryStep !== otherStep) continue
        if (ed.results.length !== primaryEd.results.length) continue

        out.push({ id: numId, color: el.color })
    }

    // If only the primary was found, ensure it's returned with a distinctive color
    if (out.length === 0) {
        out.push({ id: primaryElmId, color: primaryEl.color })
    }

    return out
}

/** Gather elements whose sweep matches the primary element's center + time range.
 *  Returns { included: [...], excludedCount: number } */
function _getFilteredVisibilityElms(store, primaryElmId) {
    const primaryEd = store.sweepElData[primaryElmId]
    const primaryEl = store.elements[primaryElmId]
    const included = []
    let excludedCount = 0

    if (!primaryEd?.results || primaryEd.results.length === 0 || !primaryEl) {
        return { included, excludedCount }
    }

    const primaryCenter = primaryEd.sweepCenter
    const primaryStart = primaryEd.results[0]?.time
    const primaryStep = primaryEd.results.length > 1 ? primaryEd.results[1]?.time : null
    const primaryLen = primaryEd.results.length

    // Collect all elements with sweep results
    const allIds = store.elementOrder?.length > 0
        ? store.elementOrder
        : Object.keys(store.elements).map(Number)

    for (const id of allIds) {
        const numId = typeof id === 'number' ? id : parseInt(id)
        const el = store.elements[numId]
        const ed = store.sweepElData[numId]
        if (!el || !ed?.results || ed.results.length === 0) continue

        // Primary always included
        if (numId === primaryElmId) {
            included.push({ id: numId, el, ed })
            continue
        }

        // Check center match
        if (primaryCenter && ed.sweepCenter) {
            if (Math.abs(primaryCenter.lat - ed.sweepCenter.lat) > 0.0001 ||
                Math.abs(primaryCenter.lng - ed.sweepCenter.lng) > 0.0001) {
                excludedCount++
                continue
            }
        }

        // Check time range match
        const otherStart = ed.results[0]?.time
        const otherStep = ed.results.length > 1 ? ed.results[1]?.time : null
        if (primaryStart !== otherStart || primaryStep !== otherStep || ed.results.length !== primaryLen) {
            excludedCount++
            continue
        }

        included.push({ id: numId, el, ed })
    }

    return { included, excludedCount }
}

function _niceStep(range, targetTicks) {
    const rough = range / targetTicks
    const mag = Math.pow(10, Math.floor(Math.log10(rough)))
    const residual = rough / mag
    let nice
    if (residual <= 1.5) nice = 1
    else if (residual <= 3) nice = 2
    else if (residual <= 7) nice = 5
    else nice = 10
    return nice * mag
}

export default SightlineTool_Graphs
