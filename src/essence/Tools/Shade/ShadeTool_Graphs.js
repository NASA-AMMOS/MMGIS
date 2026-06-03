import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import useUIStore from '../../Basics/UserInterface_/store/uiStore'
import useShadeStore from './store'
import calls from '../../../pre/calls'
import Toast from '../../../design-system/components/Toast/Toast'

const GRAPH_CONTAINER_ID = 'shadeGraphContainer'
const HORIZON_CANVAS_ID = 'shadeHorizonCanvas'
// Visibility timeline is now div-based (no canvas)
const AZIMUTH_LINE_ID = 'shadeAzimuthLineOverlay'
const HOVER_LINE_ID = 'shadeHorizonHoverLine'

let _horizonCache = null // { lat, lng, profile: [[az,el],...] }
let _activeElmId = null
let _graphOpen = false
let _activeView = null // 'combined' | null
let _animFrameId = null
// Layout state cached for mouse→azimuth conversion
let _hPad = null
let _hPlotW = 0
// Callback registered by ShadeTool for bidirectional scrubbing
let _onScrubCallback = null
// Dragging state for time slider
let _isDragging = false
let _resizeObserver = null
let _resizeTimeout = null
let _windowResizeHandler = null
let _storeUnsubscribe = null
let _graphPlayInterval = null

const ShadeTool_Graphs = {
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
        const store = useShadeStore.getState()
        const visCount = _getAllVisibilityElms(store).length
        const visHeight = Math.max(40, visCount * 24 + 30)
        useUIStore.getState().setToolHeight(250 + visHeight)

        setTimeout(() => {
            ShadeTool_Graphs._buildContainer()
            ShadeTool_Graphs.fetchAndDrawHorizon(elmId)
            ShadeTool_Graphs.drawVisibilityTimeline(elmId)
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

        ShadeTool_Graphs.removeAzimuthLine()

        const container = document.getElementById(GRAPH_CONTAINER_ID)
        if (container) container.remove()

        useUIStore.getState().setToolHeight(0)
    },

    toggle(elmId) {
        if (_graphOpen && _activeElmId === elmId) {
            ShadeTool_Graphs.close()
        } else {
            ShadeTool_Graphs.open(elmId)
        }
    },

    cleanup() {
        if (_graphOpen) ShadeTool_Graphs.close()
    },

    removeAzimuthLine() {
        const el = document.getElementById(AZIMUTH_LINE_ID)
        if (el) el.remove()
    },

    _showAzimuthLine(azDeg) {
        const mapEl = document.getElementById('map')
        if (!mapEl) return

        const store = useShadeStore.getState()
        const mapRect = mapEl.getBoundingClientRect()

        // Use sweep-time center if available
        const ed = _activeElmId != null ? store.sweepElData[_activeElmId] : null
        let centerPx
        if (ed?.sweepCenter) {
            const pt = Map_.map.latLngToContainerPoint(ed.sweepCenter)
            centerPx = { x: pt.x, y: pt.y }
        } else if (store.indicatorLastDragPoint) {
            const pt = Map_.map.latLngToContainerPoint(store.indicatorLastDragPoint)
            centerPx = { x: pt.x, y: pt.y }
        } else {
            centerPx = { x: mapRect.width / 2, y: mapRect.height / 2 }
        }

        const lineLen = Math.max(mapRect.width, mapRect.height)
        const rad = azDeg * (Math.PI / 180)
        const ex = centerPx.x + Math.sin(rad) * lineLen
        const ey = centerPx.y - Math.cos(rad) * lineLen

        let overlay = document.getElementById(AZIMUTH_LINE_ID)
        if (!overlay) {
            overlay = document.createElement('div')
            overlay.id = AZIMUTH_LINE_ID
            overlay.className = 'shadeAzimuthLine'
            overlay.style.width = mapRect.width + 'px'
            overlay.style.height = mapRect.height + 'px'
            overlay.style.top = '0'
            overlay.style.left = '0'
            mapEl.appendChild(overlay)
        }

        overlay.innerHTML =
            `<svg viewBox="0 0 ${mapRect.width} ${mapRect.height}">` +
            `<line x1="${centerPx.x}" y1="${centerPx.y}" x2="${ex}" y2="${ey}" ` +
            `stroke="#ffdd44" stroke-width="2.5" stroke-dasharray="8,4" />` +
            `</svg>`
    },

    _buildContainer() {
        let container = document.getElementById(GRAPH_CONTAINER_ID)
        if (container) container.remove()

        const tools = document.getElementById('tools')
        if (!tools) return

        container = document.createElement('div')
        container.id = GRAPH_CONTAINER_ID
        container.className = 'shadeGraphContainer'

        const closeBtn = document.createElement('div')
        closeBtn.className = 'shadeGraphClose'
        closeBtn.innerHTML = '<i class="mdi mdi-close mdi-18px"></i>'
        closeBtn.title = 'Close graph'
        closeBtn.onclick = () => ShadeTool_Graphs.close()
        container.appendChild(closeBtn)

        // --- Horizon panel ---
        const hPanel = document.createElement('div')
        hPanel.className = 'shadeGraphPanel'
        hPanel.style.flex = '1 1 0'
        hPanel.style.minHeight = '0'
        const canvas = document.createElement('canvas')
        canvas.id = HORIZON_CANVAS_ID
        canvas.className = 'shadeGraphCanvas'
        hPanel.appendChild(canvas)
        container.appendChild(hPanel)

        canvas.addEventListener('mousemove', ShadeTool_Graphs._onHorizonMouseMove)
        canvas.addEventListener('mouseleave', ShadeTool_Graphs._onHorizonMouseLeave)

        // --- Visibility panel ---
        const vPanel = document.createElement('div')
        vPanel.className = 'shadeGraphPanel shadeVisPanel'

        const visWrap = document.createElement('div')
        visWrap.id = 'shadeVisibilityWrap'
        visWrap.className = 'shadeVisWrap'
        vPanel.appendChild(visWrap)
        const timeRow = document.createElement('div')
        timeRow.id = 'shadeVisTimeLabels'
        timeRow.className = 'shadeVisTimeLabels'
        vPanel.appendChild(timeRow)
        container.appendChild(vPanel)

        visWrap.addEventListener('mousedown', ShadeTool_Graphs._onVisibilityMouseDown)
        visWrap.addEventListener('mousemove', ShadeTool_Graphs._onVisibilityMouseMove)
        visWrap.addEventListener('mouseup', ShadeTool_Graphs._onVisibilityMouseUp)
        visWrap.addEventListener('mouseleave', ShadeTool_Graphs._onVisibilityMouseLeave)

        // --- Time controls bar ---
        const controls = document.createElement('div')
        controls.className = 'shadeGraphTimeControls'
        controls.innerHTML = `
            <button class="shadeGraphPlayBtn" id="shadeGraphStepBack" title="Step back"><i class="mdi mdi-skip-previous mdi-18px"></i></button>
            <button class="shadeGraphPlayBtn" id="shadeGraphPlayPause" title="Play/Pause"><i class="mdi mdi-play mdi-18px"></i></button>
            <button class="shadeGraphPlayBtn" id="shadeGraphStepFwd" title="Step forward"><i class="mdi mdi-skip-next mdi-18px"></i></button>
            <input type="range" class="shadeGraphTimeSlider" id="shadeGraphTimeSlider" min="0" max="1" step="1" value="0" />
            <span class="shadeGraphTimeLabel" id="shadeGraphTimeLabel"></span>
        `
        container.appendChild(controls)

        tools.appendChild(container)

        // Wire up time controls
        setTimeout(() => ShadeTool_Graphs._initHorizonTimeControls(), 0)

        // Redraw handler for resize events
        const _scheduleRedraw = () => {
            if (!_graphOpen || !_activeElmId) return
            if (_resizeTimeout) clearTimeout(_resizeTimeout)
            _resizeTimeout = setTimeout(() => {
                if (_horizonCache) {
                    ShadeTool_Graphs._drawHorizonCanvas(_horizonCache.profile, _activeElmId)
                }
                ShadeTool_Graphs.drawVisibilityTimeline(_activeElmId)
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
        const store = useShadeStore.getState()
        store.setSweepField('sweepPlayIndex', frameIndex)
        if (_onScrubCallback) _onScrubCallback()
        // Update time label + slider position
        ShadeTool_Graphs._updateTimeLabel()
        // Redraw both charts to reflect new frame
        if (_horizonCache) {
            ShadeTool_Graphs._drawHorizonCanvas(_horizonCache.profile, _activeElmId)
        }
        ShadeTool_Graphs.drawVisibilityTimeline(_activeElmId)
    },

    _onHorizonMouseMove(e) {
        if (!_hPad || _hPlotW <= 0) return
        const canvas = e.target
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const frac = (mouseX - _hPad.left) / _hPlotW
        if (frac < 0 || frac > 1) {
            ShadeTool_Graphs.removeAzimuthLine()
            ShadeTool_Graphs._hideHoverLine()
            return
        }
        const displayAz = -180 + frac * 360
        let trueAz = displayAz
        if (trueAz < 0) trueAz += 360
        ShadeTool_Graphs._showAzimuthLine(trueAz)
        ShadeTool_Graphs._showHoverLine(mouseX)
    },

    _onHorizonMouseLeave() {
        ShadeTool_Graphs.removeAzimuthLine()
        ShadeTool_Graphs._hideHoverLine()
    },

    _initHorizonTimeControls() {
        const store = useShadeStore.getState()
        const ed = store.sweepElData[_activeElmId]
        const frameCount = ed?.results?.length || 0

        const slider = document.getElementById('shadeGraphTimeSlider')
        const label = document.getElementById('shadeGraphTimeLabel')
        const playBtn = document.getElementById('shadeGraphPlayPause')
        const stepBack = document.getElementById('shadeGraphStepBack')
        const stepFwd = document.getElementById('shadeGraphStepFwd')

        if (!slider) return

        slider.max = Math.max(frameCount - 1, 0)
        slider.value = store.sweepPlayIndex

        // Update label
        ShadeTool_Graphs._updateTimeLabel()

        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.value)
            ShadeTool_Graphs._scrubToFrame(idx)
        })

        stepBack.addEventListener('click', () => {
            const s = useShadeStore.getState()
            const fc = s.sweepElData[_activeElmId]?.results?.length || 0
            if (fc === 0) return
            const idx = (s.sweepPlayIndex - 1 + fc) % fc
            ShadeTool_Graphs._scrubToFrame(idx)
        })

        stepFwd.addEventListener('click', () => {
            const s = useShadeStore.getState()
            const fc = s.sweepElData[_activeElmId]?.results?.length || 0
            if (fc === 0) return
            const idx = (s.sweepPlayIndex + 1) % fc
            ShadeTool_Graphs._scrubToFrame(idx)
        })

        playBtn.addEventListener('click', () => {
            if (_graphPlayInterval) {
                clearInterval(_graphPlayInterval)
                _graphPlayInterval = null
                playBtn.innerHTML = '<i class="mdi mdi-play mdi-18px"></i>'
            } else {
                playBtn.innerHTML = '<i class="mdi mdi-pause mdi-18px"></i>'
                const speed = useShadeStore.getState().sweepPlaySpeed || 500
                _graphPlayInterval = setInterval(() => {
                    const s = useShadeStore.getState()
                    const fc = s.sweepElData[_activeElmId]?.results?.length || 0
                    if (fc === 0) return
                    const idx = (s.sweepPlayIndex + 1) % fc
                    ShadeTool_Graphs._scrubToFrame(idx)
                }, speed)
            }
        })
    },

    _updateTimeLabel() {
        const label = document.getElementById('shadeGraphTimeLabel')
        const slider = document.getElementById('shadeGraphTimeSlider')
        if (!label || !slider) return
        const store = useShadeStore.getState()
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
            line.className = 'shadeHorizonHoverLine'
            canvas.parentElement.appendChild(line)
        }
        line.style.left = x + 'px'
        line.style.display = 'block'
    },

    _hideHoverLine() {
        const line = document.getElementById(HOVER_LINE_ID)
        if (line) line.style.display = 'none'
    },

    _onVisibilityMouseDown(e) {
        _isDragging = true
        ShadeTool_Graphs._scrubFromVisibilityX(e)
    },

    _onVisibilityMouseMove(e) {
        if (_isDragging) {
            ShadeTool_Graphs._scrubFromVisibilityX(e)
        }
    },

    _onVisibilityMouseUp() {
        _isDragging = false
    },

    _onVisibilityMouseLeave() {
        _isDragging = false
    },

    _scrubFromVisibilityX(e) {
        const wrap = document.getElementById('shadeVisibilityWrap')
        if (!wrap) return
        const store = useShadeStore.getState()
        // Use the first element with results to determine frame count
        const elms = _getAllVisibilityElms(store)
        if (elms.length === 0) return
        const frameCount = elms[0].ed.results.length
        if (frameCount === 0) return

        const rect = wrap.getBoundingClientRect()
        // The bars start after the label column
        const labelCol = 124
        const barAreaW = rect.width - labelCol
        const mouseX = e.clientX - rect.left - labelCol
        if (barAreaW <= 0) return

        const frac = mouseX / barAreaW
        if (frac < 0 || frac > 1) return
        const frameIndex = Math.round(frac * (frameCount - 1))
        ShadeTool_Graphs._scrubToFrame(Math.max(0, Math.min(frameIndex, frameCount - 1)))
    },

    fetchAndDrawHorizon(elmId) {
        const store = useShadeStore.getState()
        const el = store.elements[elmId]
        if (!el) return

        const vars = store.vars
        if (!vars?.dem) {
            Toast.warning('No DEM configured for horizon profile.', 4000)
            return
        }

        let demUrl = vars.dem
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl

        // Use the sweep-time observer center (not current map center)
        const ed = store.sweepElData[elmId]
        let lat, lng
        if (ed?.sweepCenter) {
            lat = ed.sweepCenter.lat
            lng = ed.sweepCenter.lng
        } else {
            const mapRect = document.getElementById('map').getBoundingClientRect()
            const wOffset = mapRect.width / 2
            const hOffset = mapRect.height / 2
            let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])
            if (store.indicatorLastDragPoint)
                centerLatLng = store.indicatorLastDragPoint
            lat = parseFloat(centerLatLng.lat)
            lng = parseFloat(centerLatLng.lng)
        }
        const height = !isNaN(parseFloat(el.height)) ? parseFloat(el.height) : 2

        if (
            _horizonCache &&
            _horizonCache.lat === lat &&
            _horizonCache.lng === lng
        ) {
            ShadeTool_Graphs._drawHorizonCanvas(
                _horizonCache.profile,
                elmId
            )
            return
        }

        calls.api(
            'gethorizonprofile',
            {
                path: demUrl,
                lat: lat,
                lng: lng,
                observerHeight: height,
                numAzimuths: 360,
                maxRadius: 5000,
            },
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
                _horizonCache = { lat, lng, profile }
                ShadeTool_Graphs._drawHorizonCanvas(profile, elmId)
            },
            function () {
                Toast.error('Failed to fetch horizon profile.', 4000)
            }
        )
    },

    _drawHorizonCanvas(profile, elmId) {
        const canvas = document.getElementById(HORIZON_CANVAS_ID)
        if (!canvas) return

        const store = useShadeStore.getState()
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

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.fillRect(0, 0, w, h)

        // Grid — north-centered: display -180..+180
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
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
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.beginPath()
        ctx.moveTo(northX, pad.top)
        ctx.lineTo(northX, pad.top + plotH)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
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
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(pad.left, zeroY)
        ctx.lineTo(pad.left + plotW, zeroY)
        ctx.stroke()
        ctx.setLineDash([])

        // Reorder profile for north-centered display
        const reordered = []
        for (let i = 0; i < profile.length; i++) {
            const az = profile[i][0]
            const displayAz = _azToDisplay(az)
            reordered.push([displayAz, profile[i][1]])
        }
        reordered.sort((a, b) => a[0] - b[0])

        // Gather all linked elements that share center/time/step for multi-arc display
        const linkedElms = _getLinkedHorizonElms(store, elmId)

        // Draw ALL source trajectories BEHIND the terrain fill
        for (const le of linkedElms) {
            ShadeTool_Graphs._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, false
            )
        }

        // Filled terrain silhouette (brown, fairly opaque to cover trajectory below horizon)
        // Extend fill all the way to the bottom of the canvas so arcs below horizon are covered
        const fillBottom = h
        ctx.beginPath()
        ctx.moveTo(pad.left, fillBottom)
        for (let i = 0; i < reordered.length; i++) {
            const x = pad.left + ((reordered[i][0] + 180) / 360) * plotW
            const y = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
            ctx.lineTo(x, y)
        }
        ctx.lineTo(pad.left + plotW, fillBottom)
        ctx.closePath()
        ctx.fillStyle = 'rgba(90,62,35,0.8)'
        ctx.fill()

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
            ShadeTool_Graphs._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, true
            )
        }

        // Elevation tick labels only (no azimuth x-axis labels)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        elTick = Math.ceil(minEl / elStep) * elStep
        while (elTick <= maxEl) {
            const y = pad.top + plotH - ((elTick - minEl) / elRange) * plotH
            ctx.fillText(elTick.toFixed(0) + '°', pad.left - 4, y + 3)
            elTick += elStep
        }

        // Elevation axis title
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
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
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
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
        const store = useShadeStore.getState()
        const ed = store.sweepElData[elmId]
        if (!ed?.results || ed.results.length === 0) return

        const results = ed.results
        const playIndex = (ed.playbackLinked === false)
            ? (ed.localPlayIndex || 0)
            : store.sweepPlayIndex

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
        const wrap = document.getElementById('shadeVisibilityWrap')
        if (!wrap) return

        const store = useShadeStore.getState()
        const elms = _getAllVisibilityElms(store)
        if (elms.length === 0) return

        const profile = _horizonCache?.profile
        const playIndex = store.sweepPlayIndex

        // Clear previous content
        wrap.innerHTML = ''

        // Reference results for frame count / time labels (use first element)
        const refResults = elms[0].ed.results
        const frameCount = refResults.length
        if (frameCount === 0) return

        // Build a row for each shade element
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
            const occludedColor = 'rgba(60,60,60,0.5)'

            // Compute visibility using the horizon profile (terrain-aware)
            const segments = []
            for (let i = 0; i < results.length; i++) {
                const r = results[i]
                let visible = false
                if (profile && r.azimuth != null && r.elevation != null) {
                    let az = r.azimuth
                    if (az < 0) az += 360
                    const horizEl = _interpolateHorizon(profile, az)
                    visible = r.elevation > horizEl
                }
                segments.push(visible)
            }

            const row = document.createElement('div')
            row.className = 'shadeVisRow'

            const label = document.createElement('div')
            label.className = 'shadeVisLabel'
            label.style.color = colorStr
            label.innerHTML = `${srcName} <span class="shadeVisLabelSuffix">Occultations</span>`
            label.title = srcName + ' Occultations'
            row.appendChild(label)

            const bar = document.createElement('div')
            bar.className = 'shadeVisBar'

            // Collect contiguous runs
            const runs = []
            let runStart = 0
            for (let i = 1; i <= segments.length; i++) {
                if (i < segments.length && segments[i] === segments[runStart]) continue
                runs.push({ start: runStart, end: i, visible: segments[runStart] })
                runStart = i
            }

            // Render runs with gradient transitions at boundaries
            for (let ri = 0; ri < runs.length; ri++) {
                const run = runs[ri]
                const span = document.createElement('div')
                span.className = 'shadeVisSegment'
                const pctStart = (run.start / frameCount) * 100
                const pctWidth = ((run.end - run.start) / frameCount) * 100
                span.style.left = pctStart + '%'
                span.style.width = pctWidth + '%'

                const thisColor = run.visible ? occludedColor : visibleColor
                const prevDiff = ri > 0 && runs[ri - 1].visible !== run.visible
                const nextDiff = ri < runs.length - 1 && runs[ri + 1].visible !== run.visible
                const prevColor = prevDiff
                    ? (runs[ri - 1].visible ? occludedColor : visibleColor)
                    : thisColor
                const nextColor = nextDiff
                    ? (runs[ri + 1].visible ? occludedColor : visibleColor)
                    : thisColor

                if (prevDiff || nextDiff) {
                    // Gradient fade over ~20% of the segment at each transition edge
                    const fadeIn = prevDiff ? 20 : 0
                    const fadeOut = nextDiff ? 80 : 100
                    span.style.background = `linear-gradient(to right, ${prevColor} 0%, ${thisColor} ${fadeIn}%, ${thisColor} ${fadeOut}%, ${nextColor} 100%)`
                } else {
                    span.style.background = thisColor
                }
                bar.appendChild(span)
            }

            row.appendChild(bar)
            wrap.appendChild(row)
        })

        // Red time slider overlay
        if (playIndex >= 0 && playIndex < frameCount) {
            let slider = document.getElementById('shadeVisSlider')
            if (!slider) {
                slider = document.createElement('div')
                slider.id = 'shadeVisSlider'
                slider.className = 'shadeVisSlider'
            }
            // Position using actual bar element bounds for exact alignment
            const firstBar = wrap.querySelector('.shadeVisBar')
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

        // Time labels
        ShadeTool_Graphs._drawVisTimeLabels(refResults)
    },

    _drawVisTimeLabels(results) {
        const container = document.getElementById('shadeVisTimeLabels')
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

        // Calculate how many labels fit
        const rect = container.getBoundingClientRect()
        const labelW = 90 // approximate width per label
        const maxLabels = Math.max(2, Math.floor(rect.width / labelW))
        const step = Math.max(1, Math.floor(results.length / maxLabels))

        for (let i = 0; i < results.length; i += step) {
            const t = results[i].time
            if (!t) continue
            const pct = (i / results.length) * 100
            const tick = document.createElement('div')
            tick.className = 'shadeVisTimeTick'
            tick.style.left = pct + '%'
            tick.innerHTML = `<div class="shadeVisTimeTickLine"></div><div class="shadeVisTimeTickText">${_formatSmartTimeLabel(t, omitYear)}</div>`
            container.appendChild(tick)
        }
    },

    updatePlaybackFrame(elmId) {
        if (!_graphOpen) return
        const effectiveId = elmId != null ? elmId : _activeElmId
        if (effectiveId == null) return

        if (_animFrameId) cancelAnimationFrame(_animFrameId)
        _animFrameId = requestAnimationFrame(() => {
            if (_horizonCache) {
                ShadeTool_Graphs._drawHorizonCanvas(
                    _horizonCache.profile,
                    effectiveId
                )
            }
            ShadeTool_Graphs.drawVisibilityTimeline(effectiveId)
            ShadeTool_Graphs._updateTimeLabel()
            _animFrameId = null
        })
    },

    invalidateHorizonCache() {
        _horizonCache = null
    },
}

/** Convert true azimuth (0..360) to display azimuth (-180..+180) with 0° at center */
function _azToDisplay(az) {
    let a = az
    if (a < 0) a += 360
    return a > 180 ? a - 360 : a
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
        const mon = d.toLocaleString('en', { month: 'short' })
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

        if (ed.playbackLinked === false) continue

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

/** Gather all elements that have sweep results for the visibility timeline */
function _getAllVisibilityElms(store) {
    const out = []
    const order = store.elementOrder || []
    for (const id of order) {
        const el = store.elements[id]
        const ed = store.sweepElData[id]
        if (el && ed?.results && ed.results.length > 0) {
            out.push({ id, el, ed })
        }
    }
    // If no order, iterate keys
    if (out.length === 0) {
        for (const id in store.elements) {
            const el = store.elements[id]
            const ed = store.sweepElData[id]
            if (el && ed?.results && ed.results.length > 0) {
                out.push({ id: parseInt(id), el, ed })
            }
        }
    }
    return out
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

export default ShadeTool_Graphs
