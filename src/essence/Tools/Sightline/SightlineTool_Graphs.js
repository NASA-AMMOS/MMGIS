import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import useUIStore from '../../Basics/UserInterface_/store/uiStore'
import useSightlineStore from './store'
import calls from '../../../pre/calls'
import Toast from '../../../design-system/components/Toast/Toast'

const GRAPH_CONTAINER_ID = 'sightlineGraphContainer'
const HORIZON_CANVAS_ID = 'sightlineHorizonCanvas'
// Visibility timeline is now div-based (no canvas)
const AZIMUTH_LINE_ID = 'sightlineAzimuthLineOverlay'
const SOURCE_AZIMUTH_OVERLAY_ID = 'sightlineSourceAzimuthOverlay'
const HOVER_LINE_ID = 'sightlineHorizonHoverLine'

let _horizonCache = null // { lat, lng, profile: [[az,el],...] }
let _activeElmId = null
let _graphOpen = false
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

        SightlineTool_Graphs.removeAzimuthLine()
        SightlineTool_Graphs._removeSourceAzimuthLines()

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

        const closeBtn = document.createElement('div')
        closeBtn.className = 'sightlineGraphClose'
        closeBtn.innerHTML = '<i class="mdi mdi-close mdi-18px"></i>'
        closeBtn.title = 'Close graph'
        closeBtn.onclick = () => SightlineTool_Graphs.close()
        container.appendChild(closeBtn)

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
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        if (!el) return

        const vars = store.vars
        if (!vars?.dem) {
            Toast.warning('No DEM configured for horizon profile.', 4000)
            return
        }

        let demUrl = vars.dem
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl

        // Prefer sweep center when available; fall back to map center
        const ed = store.sweepElData[elmId]
        let lat, lng
        if (ed?.sweepCenter) {
            lat = ed.sweepCenter.lat
            lng = ed.sweepCenter.lng
        } else {
            const mapRect = document.getElementById('map').getBoundingClientRect()
            const wOffset = mapRect.width / 2
            const hOffset = mapRect.height / 2
            const centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])
            lat = parseFloat(centerLatLng.lat)
            lng = parseFloat(centerLatLng.lng)
        }
        const height = !isNaN(parseFloat(el.height)) ? parseFloat(el.height) : 2

        if (
            _horizonCache &&
            _horizonCache.lat === lat &&
            _horizonCache.lng === lng &&
            _horizonCache.height === height
        ) {
            SightlineTool_Graphs._drawHorizonCanvas(
                _horizonCache.profile,
                elmId
            )
            SightlineTool_Graphs.drawVisibilityTimeline(elmId)
            return
        }

        const useCurvature = vars.hasOwnProperty('curvature') ? vars.curvature : true
        const horizonParams = {
            path: demUrl,
            lat: lat,
            lng: lng,
            observerHeight: height,
            numAzimuths: 360,
            maxRadius: 50000,
            minSkipRadius: 50,
        }
        if (useCurvature) {
            horizonParams.planetRadius = F_.radiusOfPlanetMajor
        }

        calls.api(
            'gethorizonprofile',
            horizonParams,
            function (data) {
                let parsed = data
                if (typeof data === 'string') {
                    try {
                        parsed = JSON.parse(data)
                    } catch (e) {
                        Toast.error('Failed to parse horizon profile.', 4000)
                        return
                    }
                }
                if (parsed.error) {
                    Toast.error(
                        'Horizon profile error: ' +
                            (parsed.message || 'unknown'),
                        4000
                    )
                    return
                }
                const profile = parsed.horizonProfile || []
                _horizonCache = { lat, lng, height, profile }
                SightlineTool_Graphs._drawHorizonCanvas(profile, elmId)
                // Redraw visibility timeline now that the horizon profile is available
                SightlineTool_Graphs.drawVisibilityTimeline(elmId)
            },
            function () {
                Toast.error('Failed to fetch horizon profile.', 4000)
            }
        )
    },

    _drawHorizonCanvas(profile, elmId) {
        const canvas = document.getElementById(HORIZON_CANVAS_ID)
        if (!canvas) return

        const store = useSightlineStore.getState()
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.parentElement.getBoundingClientRect()
        const w = Math.floor(rect.width)
        const h = Math.floor(rect.height - 24) // minus title
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)

        const pad = { top: 20, right: 0, bottom: 10, left: 45 }
        const plotW = w - pad.left - pad.right
        const plotH = h - pad.top - pad.bottom

        _hPad = pad
        _hPlotW = plotW

        if (plotW <= 0 || plotH <= 0) return

        // Elevation range: bottom is exactly 5° below the min horizon point
        let minHorizon = 0, maxEl = 0
        for (let i = 0; i < profile.length; i++) {
            const el = profile[i][1]
            if (el < minHorizon) minHorizon = el
            if (el > maxEl) maxEl = el
        }
        // Include trajectory elevations only for the top bound
        const linkedElmsForRange = _getLinkedHorizonElms(store, elmId)
        for (const le of linkedElmsForRange) {
            const ed = store.sweepElData[le.id]
            if (!ed?.results) continue
            for (const r of ed.results) {
                if (r.elevation != null && r.elevation > maxEl) maxEl = r.elevation
            }
        }
        maxEl = Math.max(maxEl + 5, 10)
        const minEl = minHorizon - 5
        const elRange = maxEl - minEl

        // Theme-responsive colors
        const rootStyle = getComputedStyle(document.documentElement)
        const bgColor = rootStyle.getPropertyValue('--color-a').trim() || '#1d1f20'
        const textColor = rootStyle.getPropertyValue('--color-f').trim() || '#e1e1e1'
        const mutedColor = rootStyle.getPropertyValue('--color-a4').trim() || '#949a9e'
        // Detect light mode: if background is light (rough heuristic)
        const isLight = (() => {
            const c = bgColor.replace('#', '')
            if (c.length === 6) {
                const r = parseInt(c.substring(0, 2), 16)
                const g = parseInt(c.substring(2, 4), 16)
                const b = parseInt(c.substring(4, 6), 16)
                return (r + g + b) / 3 > 128
            }
            return false
        })()
        const gridAlpha = isLight ? 0.12 : 0.1
        const gridBrightAlpha = isLight ? 0.3 : 0.25
        const zeroLineAlpha = isLight ? 0.35 : 0.3

        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, w, h)

        // Grid — north-centered: display -180..+180
        ctx.strokeStyle = `rgba(${isLight ? '0,0,0' : '255,255,255'},${gridAlpha})`
        ctx.lineWidth = 1
        const azTicks = [-180, -135, -90, -45, 0, 45, 90, 135, 180]
        const azLabels = ['180°S', '225°SW', '270°W', '315°NW', '0°N', '45°NE', '90°E', '135°SE', '180°S']
        for (let i = 0; i < azTicks.length; i++) {
            const x = pad.left + ((azTicks[i] + 180) / 360) * plotW
            ctx.beginPath()
            ctx.moveTo(x, pad.top)
            ctx.lineTo(x, pad.top + plotH)
            ctx.stroke()
        }
        // Center line (North) — slightly brighter
        const northX = pad.left + 0.5 * plotW
        ctx.strokeStyle = `rgba(${isLight ? '0,0,0' : '255,255,255'},${gridBrightAlpha})`
        ctx.beginPath()
        ctx.moveTo(northX, pad.top)
        ctx.lineTo(northX, pad.top + plotH)
        ctx.stroke()

        ctx.strokeStyle = `rgba(${isLight ? '0,0,0' : '255,255,255'},${gridAlpha})`
        const elStep = _niceStep(elRange, 5)
        let elTick = Math.ceil(minEl / elStep) * elStep
        while (elTick <= maxEl) {
            const y = pad.top + plotH - ((elTick - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.moveTo(pad.left, y)
            ctx.lineTo(pad.left + plotW, y)
            ctx.stroke()
            elTick += elStep
        }

        // 0° elevation line
        const zeroY = pad.top + plotH - ((0 - minEl) / elRange) * plotH
        ctx.strokeStyle = `rgba(${isLight ? '0,0,0' : '255,255,255'},${zeroLineAlpha})`
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(pad.left, zeroY)
        ctx.lineTo(pad.left + plotW, zeroY)
        ctx.stroke()
        ctx.setLineDash([])

        // Reorder profile for north-centered display
        // Each entry: [displayAz, elevation, distanceMeters]
        const reordered = []
        for (let i = 0; i < profile.length; i++) {
            const az = profile[i][0]
            const displayAz = _azToDisplay(az)
            reordered.push([displayAz, profile[i][1], profile[i][2] || 0])
        }
        reordered.sort((a, b) => a[0] - b[0])

        // Gather all linked elements that share center/time/step for multi-arc display
        const linkedElms = _getLinkedHorizonElms(store, elmId)

        // Draw ALL source trajectories BEHIND the terrain fill
        for (const le of linkedElms) {
            SightlineTool_Graphs._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, false
            )
        }

        // Filled terrain silhouette with distance-based fog
        // Closer horizon = more opaque, farther = more transparent (log scale)
        const fillBottom = h
        const maxOpacity = isLight ? 0.7 : 0.95
        const minOpacity = isLight ? 0.03 : 0.05
        const fillR = isLight ? 160 : 90
        const fillG = isLight ? 120 : 62
        const fillB = isLight ? 70 : 35
        // Find max distance for normalization (log scale)
        let maxDist = 0
        for (let i = 0; i < reordered.length; i++) {
            if (reordered[i][2] > maxDist) maxDist = reordered[i][2]
        }
        const hasDistData = maxDist > 0
        if (!hasDistData) {
            // No distance data — fall back to uniform fill
            ctx.beginPath()
            ctx.moveTo(pad.left, fillBottom)
            for (let i = 0; i < reordered.length; i++) {
                const x = pad.left + ((reordered[i][0] + 180) / 360) * plotW
                const y = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
                ctx.lineTo(x, y)
            }
            ctx.lineTo(pad.left + plotW, fillBottom)
            ctx.closePath()
            ctx.fillStyle = `rgba(${fillR},${fillG},${fillB},${maxOpacity})`
            ctx.fill()
        } else {
            // Draw per-strip fills with distance-based opacity
            const logMax = Math.log(maxDist + 1)
            for (let i = 0; i < reordered.length; i++) {
                const x0 = pad.left + ((reordered[i][0] + 180) / 360) * plotW
                const yTop = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
                // Strip extends to the next point (or edge)
                let x1
                if (i < reordered.length - 1) {
                    x1 = pad.left + ((reordered[i + 1][0] + 180) / 360) * plotW
                } else {
                    x1 = pad.left + plotW
                }
                const stripW = x1 - x0
                if (stripW <= 0) continue

                const dist = reordered[i][2]
                // Log-scale: close=1.0, far=0.0
                const t = dist > 0 ? Math.log(dist + 1) / logMax : 0
                const opacity = maxOpacity - t * (maxOpacity - minOpacity)

                ctx.fillStyle = `rgba(${fillR},${fillG},${fillB},${opacity.toFixed(3)})`
                ctx.fillRect(x0, yTop, stripW, fillBottom - yTop)
            }
        }

        // Horizon outline
        ctx.beginPath()
        for (let i = 0; i < reordered.length; i++) {
            const x = pad.left + ((reordered[i][0] + 180) / 360) * plotW
            const y = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = '#b8956a'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Draw current frame markers ON TOP of terrain for all linked elements
        for (const le of linkedElms) {
            SightlineTool_Graphs._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, true
            )
        }

        // Elevation tick labels only (no azimuth x-axis labels)
        ctx.fillStyle = mutedColor
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        elTick = Math.ceil(minEl / elStep) * elStep
        while (elTick <= maxEl) {
            const y = pad.top + plotH - ((elTick - minEl) / elRange) * plotH
            ctx.fillText(elTick.toFixed(0) + '°', pad.left - 4, y + 3)
            elTick += elStep
        }

        // Elevation axis title
        ctx.fillStyle = mutedColor
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.save()
        ctx.translate(19, pad.top + plotH / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText('Elevation (°)', 0, 0)
        ctx.restore()

        // North arrow at top center (upward-pointing)
        const northArrowX = northX
        const northArrowY = pad.top - 2
        ctx.fillStyle = textColor
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        // Upward-pointing triangle (more gap between triangle and N)
        ctx.beginPath()
        ctx.moveTo(northArrowX, northArrowY - 20)
        ctx.lineTo(northArrowX - 4, northArrowY - 14)
        ctx.lineTo(northArrowX + 4, northArrowY - 14)
        ctx.closePath()
        ctx.fill()
        ctx.fillText('N', northArrowX, northArrowY)
    },

    _drawSourceTrajectory(ctx, elmId, color, pad, plotW, plotH, minEl, elRange, markerOnly) {
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[elmId]
        if (!ed?.results || ed.results.length === 0) return

        const results = ed.results
        const playIndex = store.sweepPlayIndex

        // If color is very dark (e.g. black for element 0), brighten for visibility
        const brightness = color.r + color.g + color.b
        const c = brightness < 100
            ? { r: Math.min(color.r + 120, 255), g: Math.min(color.g + 120, 255), b: Math.min(color.b + 120, 255) }
            : color
        const lineColor = `rgb(${c.r},${c.g},${c.b})`
        const dotColor = `rgba(${c.r},${c.g},${c.b},0.4)`
        const markerColor = `rgb(${Math.min(c.r + 60, 255)},${Math.min(c.g + 60, 255)},${Math.min(c.b + 60, 255)})`

        if (!markerOnly) {
            // Draw trajectory arc (break line at azimuth wrap-around)
            ctx.beginPath()
            ctx.strokeStyle = lineColor
            ctx.lineWidth = 2
            let started = false
            let prevDisplayAz = null
            for (let i = 0; i < results.length; i++) {
                const az = results[i].azimuth
                const el = results[i].elevation
                if (az == null || el == null) continue
                const displayAz = _azToDisplay(az)
                const x = _azToPlotX(az, pad, plotW)
                const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
                if (!started) {
                    ctx.moveTo(x, y)
                    started = true
                } else if (prevDisplayAz != null && Math.abs(displayAz - prevDisplayAz) > 180) {
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(x, y)
                } else {
                    ctx.lineTo(x, y)
                }
                prevDisplayAz = displayAz
            }
            ctx.stroke()

            // Trajectory dots
            ctx.fillStyle = dotColor
            for (let i = 0; i < results.length; i++) {
                const az = results[i].azimuth
                const el = results[i].elevation
                if (az == null || el == null) continue
                const x = _azToPlotX(az, pad, plotW)
                const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
                ctx.beginPath()
                ctx.arc(x, y, 2, 0, Math.PI * 2)
                ctx.fill()
            }
            return
        }

        // Current frame marker (drawn on top of terrain)
        const cur = results[playIndex]
        if (cur && cur.azimuth != null && cur.elevation != null) {
            const x = _azToPlotX(cur.azimuth, pad, plotW)
            const y = pad.top + plotH - ((cur.elevation - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.fillStyle = markerColor
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1.5
            ctx.stroke()
        }


    },

    drawVisibilityTimeline(elmId) {
        const wrap = document.getElementById('sightlineVisibilityWrap')
        if (!wrap) return

        const store = useSightlineStore.getState()
        const { included: elms, excludedCount } = _getFilteredVisibilityElms(store, elmId)
        if (elms.length === 0) return

        const profile = _horizonCache?.profile
        const playIndex = store.sweepPlayIndex

        // Show/update info message if some elements are excluded
        SightlineTool_Graphs._updateExcludedInfo(excludedCount)

        // Clear previous content
        wrap.innerHTML = ''

        // Reference results for frame count / time labels (use first element)
        const refResults = elms[0].ed.results
        const frameCount = refResults.length
        if (frameCount === 0) return

        // Build a row for each sightline element
        elms.forEach(({ id, el, ed }) => {
            const results = ed.results
            const sources = store.getSelectedSources(id)
            const srcName = sources?.[0]?.name || el.name || 'Source'
            const rawColor = el.color
            // Brighten dark colors for visibility on dark backgrounds
            const brightness = rawColor.r + rawColor.g + rawColor.b
            const color = brightness < 100
                ? { r: Math.min(rawColor.r + 120, 255), g: Math.min(rawColor.g + 120, 255), b: Math.min(rawColor.b + 120, 255) }
                : rawColor
            const colorStr = `rgb(${color.r},${color.g},${color.b})`
            const visibleColor = `rgba(${Math.min(color.r + 40, 255)},${Math.min(color.g + 40, 255)},${Math.min(color.b + 40, 255)},0.85)`
            // Detect light/dark theme for the "not occluded" gray
            const visBg = getComputedStyle(document.documentElement).getPropertyValue('--color-a').trim() || '#1d1f20'
            const visIsLight = (() => {
                const c = visBg.replace('#', '')
                if (c.length === 6) {
                    const r = parseInt(c.substring(0, 2), 16)
                    const g = parseInt(c.substring(2, 4), 16)
                    const b = parseInt(c.substring(4, 6), 16)
                    return (r + g + b) / 3 > 128
                }
                return false
            })()
            const occludedColor = visIsLight ? 'rgba(240,240,240,0.7)' : 'rgba(60,60,60,0.5)'

            // Compute visibility from sightmap grid center pixel
            const segments = []
            for (let i = 0; i < results.length; i++) {
                segments.push(!!results[i].centerVisible)
            }

            const row = document.createElement('div')
            row.className = 'sightlineVisRow'

            const label = document.createElement('div')
            label.className = 'sightlineVisLabel'
            label.style.color = colorStr
            label.innerHTML = `${srcName} <span class="sightlineVisLabelSuffix">Visibility</span>`
            label.title = srcName + ' Visibility'
            row.appendChild(label)

            const bar = document.createElement('div')
            bar.className = 'sightlineVisBar'

            // Collect contiguous runs
            const runs = []
            let runStart = 0
            for (let i = 1; i <= segments.length; i++) {
                if (i < segments.length && segments[i] === segments[runStart]) continue
                runs.push({ start: runStart, end: i, visible: segments[runStart] })
                runStart = i
            }

            // Render runs with gradient fade only on the trailing (right) edge
            for (let ri = 0; ri < runs.length; ri++) {
                const run = runs[ri]
                const span = document.createElement('div')
                span.className = 'sightlineVisSegment'
                const pctStart = (run.start / frameCount) * 100
                const pctWidth = ((run.end - run.start) / frameCount) * 100
                span.style.left = pctStart + '%'
                span.style.width = pctWidth + '%'

                // Conservative: no gradient transitions — uncertain regions are occluded
                const thisColor = run.visible ? visibleColor : occludedColor
                span.style.background = thisColor
                bar.appendChild(span)
            }

            row.appendChild(bar)
            wrap.appendChild(row)
        })

        // Red time slider overlay
        if (playIndex >= 0 && playIndex < frameCount) {
            let slider = document.getElementById('sightlineVisSlider')
            if (!slider) {
                slider = document.createElement('div')
                slider.id = 'sightlineVisSlider'
                slider.className = 'sightlineVisSlider'
            }
            // Position using actual bar element bounds for exact alignment
            const firstBar = wrap.querySelector('.sightlineVisBar')
            if (firstBar) {
                const wrapRect = wrap.getBoundingClientRect()
                const barRect = firstBar.getBoundingClientRect()
                const barLeft = barRect.left - wrapRect.left
                const barWidth = barRect.width
                const frac = frameCount > 1 ? playIndex / (frameCount - 1) : 0.5
                const px = barLeft + frac * barWidth
                slider.style.left = px + 'px'
            }
            wrap.appendChild(slider)
        }

        // Time labels — align margin to actual bar position
        const timeContainer = document.getElementById('sightlineVisTimeLabels')
        const firstBarEl = wrap.querySelector('.sightlineVisBar')
        if (timeContainer && firstBarEl) {
            const wrapRect = wrap.getBoundingClientRect()
            const barLeftOffset = firstBarEl.getBoundingClientRect().left - wrapRect.left
            timeContainer.style.marginLeft = barLeftOffset + 'px'
        }
        SightlineTool_Graphs._drawVisTimeLabels(refResults)
    },

    _drawVisTimeLabels(results) {
        const container = document.getElementById('sightlineVisTimeLabels')
        if (!container || !results || results.length === 0) return
        container.innerHTML = ''

        // Determine if year is constant
        const years = new Set()
        for (const r of results) {
            if (r.time) {
                try { years.add(new Date(r.time).getUTCFullYear()) } catch {}
            }
        }
        const omitYear = years.size <= 1

        // Place ticks at evenly-spaced visual positions (0%–100%) and map
        // each position back to the nearest frame index for its time label.
        // This avoids coordinate-system drift between ticks and bar segments.
        const rect = container.getBoundingClientRect()
        const labelW = 90 // approximate width per label
        const numTicks = Math.max(2, Math.floor(rect.width / labelW))
        const last = results.length - 1

        for (let t = 0; t < numTicks; t++) {
            const pct = numTicks > 1 ? (t / (numTicks - 1)) * 100 : 0
            const frameIdx = numTicks > 1 ? Math.round((t / (numTicks - 1)) * last) : 0
            const time = results[frameIdx]?.time
            if (!time) continue
            const tick = document.createElement('div')
            tick.className = 'sightlineVisTimeTick'
            tick.style.left = pct + '%'
            tick.innerHTML = `<div class="sightlineVisTimeTickLine"></div><div class="sightlineVisTimeTickText">${_formatSmartTimeLabel(time, omitYear)}</div>`
            container.appendChild(tick)
        }
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
