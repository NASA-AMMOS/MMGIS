import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import useUIStore from '../../Basics/UserInterface_/store/uiStore'
import useShadeStore from './store'
import calls from '../../../pre/calls'
import Toast from '../../../design-system/components/Toast/Toast'

const GRAPH_CONTAINER_ID = 'shadeGraphContainer'
const HORIZON_CANVAS_ID = 'shadeHorizonCanvas'
const VISIBILITY_CANVAS_ID = 'shadeVisibilityCanvas'
const AZIMUTH_LINE_ID = 'shadeAzimuthLineOverlay'
const HOVER_LINE_ID = 'shadeHorizonHoverLine'

let _horizonCache = null // { lat, lng, profile: [[az,el],...] }
let _activeElmId = null
let _graphOpen = false
let _activeView = null // 'horizon' | 'visibility'
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

    openHorizon(elmId) {
        _activeElmId = elmId
        _activeView = 'horizon'
        _graphOpen = true

        useUIStore.getState().setToolHeight(250)

        setTimeout(() => {
            ShadeTool_Graphs._buildContainer('horizon')
            ShadeTool_Graphs.fetchAndDrawHorizon(elmId)
        }, 50)
    },

    openVisibility(elmId) {
        _activeElmId = elmId
        _activeView = 'visibility'
        _graphOpen = true

        useUIStore.getState().setToolHeight(85)

        setTimeout(() => {
            ShadeTool_Graphs._buildContainer('visibility')
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
        if (_resizeObserver) {
            _resizeObserver.disconnect()
            _resizeObserver = null
        }

        ShadeTool_Graphs.removeAzimuthLine()

        const container = document.getElementById(GRAPH_CONTAINER_ID)
        if (container) container.remove()

        useUIStore.getState().setToolHeight(0)
    },

    toggleHorizon(elmId) {
        if (_graphOpen && _activeView === 'horizon' && _activeElmId === elmId) {
            ShadeTool_Graphs.close()
        } else {
            ShadeTool_Graphs.openHorizon(elmId)
        }
    },

    toggleVisibility(elmId) {
        if (_graphOpen && _activeView === 'visibility' && _activeElmId === elmId) {
            ShadeTool_Graphs.close()
        } else {
            ShadeTool_Graphs.openVisibility(elmId)
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
        const cx = mapRect.width / 2
        const cy = mapRect.height / 2

        let centerPx = { x: cx, y: cy }
        if (store.indicatorLastDragPoint) {
            const pt = Map_.map.latLngToContainerPoint(store.indicatorLastDragPoint)
            centerPx = { x: pt.x, y: pt.y }
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

    _buildContainer(view) {
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

        if (view === 'horizon') {
            const panel = document.createElement('div')
            panel.className = 'shadeGraphPanel'
            const title = document.createElement('div')
            title.className = 'shadeGraphTitle'
            title.textContent = 'Horizon Profile'
            panel.appendChild(title)
            const canvas = document.createElement('canvas')
            canvas.id = HORIZON_CANVAS_ID
            canvas.className = 'shadeGraphCanvas'
            panel.appendChild(canvas)
            container.appendChild(panel)

            // Time controls bar below chart
            const controls = document.createElement('div')
            controls.className = 'shadeGraphTimeControls'
            controls.innerHTML = `
                <button class="shadeGraphPlayBtn" id="shadeGraphStepBack" title="Step back"><i class="mdi mdi-skip-previous mdi-14px"></i></button>
                <button class="shadeGraphPlayBtn" id="shadeGraphPlayPause" title="Play/Pause"><i class="mdi mdi-play mdi-14px"></i></button>
                <button class="shadeGraphPlayBtn" id="shadeGraphStepFwd" title="Step forward"><i class="mdi mdi-skip-next mdi-14px"></i></button>
                <input type="range" class="shadeGraphTimeSlider" id="shadeGraphTimeSlider" min="0" max="1" step="1" value="0" />
                <span class="shadeGraphTimeLabel" id="shadeGraphTimeLabel"></span>
            `
            container.appendChild(controls)

            canvas.addEventListener('mousemove', ShadeTool_Graphs._onHorizonMouseMove)
            canvas.addEventListener('mouseleave', ShadeTool_Graphs._onHorizonMouseLeave)

            // Wire up time controls
            setTimeout(() => ShadeTool_Graphs._initHorizonTimeControls(), 0)
        } else {
            const panel = document.createElement('div')
            panel.className = 'shadeGraphPanel'
            const title = document.createElement('div')
            title.className = 'shadeGraphTitle'
            title.id = 'shadeVisibilityTitle'
            title.textContent = 'Visibility Timeline'
            panel.appendChild(title)
            const canvas = document.createElement('canvas')
            canvas.id = VISIBILITY_CANVAS_ID
            canvas.className = 'shadeGraphCanvas'
            panel.appendChild(canvas)
            container.appendChild(panel)

            canvas.addEventListener('mousedown', ShadeTool_Graphs._onVisibilityMouseDown)
            canvas.addEventListener('mousemove', ShadeTool_Graphs._onVisibilityMouseMove)
            canvas.addEventListener('mouseup', ShadeTool_Graphs._onVisibilityMouseUp)
            canvas.addEventListener('mouseleave', ShadeTool_Graphs._onVisibilityMouseLeave)
        }

        tools.appendChild(container)

        // Observe container resize to redraw graphs responsively
        if (_resizeObserver) _resizeObserver.disconnect()
        _resizeObserver = new ResizeObserver(() => {
            if (!_graphOpen || !_activeElmId) return
            if (_resizeTimeout) clearTimeout(_resizeTimeout)
            _resizeTimeout = setTimeout(() => {
                if (_activeView === 'horizon' && _horizonCache) {
                    ShadeTool_Graphs._drawHorizonCanvas(_horizonCache.profile, _activeElmId)
                } else if (_activeView === 'visibility') {
                    ShadeTool_Graphs.drawVisibilityTimeline(_activeElmId)
                }
            }, 50)
        })
        _resizeObserver.observe(container)
    },

    registerScrubCallback(cb) {
        _onScrubCallback = cb
    },

    _scrubToFrame(frameIndex) {
        const store = useShadeStore.getState()
        store.setSweepField('sweepPlayIndex', frameIndex)
        if (_onScrubCallback) _onScrubCallback()
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

        let playInterval = null
        playBtn.addEventListener('click', () => {
            if (playInterval) {
                clearInterval(playInterval)
                playInterval = null
                playBtn.innerHTML = '<i class="mdi mdi-play mdi-14px"></i>'
            } else {
                playBtn.innerHTML = '<i class="mdi mdi-pause mdi-14px"></i>'
                const speed = useShadeStore.getState().sweepPlaySpeed || 500
                playInterval = setInterval(() => {
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
        const canvas = document.getElementById(VISIBILITY_CANVAS_ID)
        if (!canvas) return
        const store = useShadeStore.getState()
        const ed = store.sweepElData[_activeElmId]
        if (!ed?.results || ed.results.length === 0) return

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const w = Math.floor(rect.width)
        const pad = { top: 16, right: 20, bottom: 36, left: 45 }
        const plotW = w - pad.left - pad.right
        if (plotW <= 0) return

        const frac = (mouseX - pad.left) / plotW
        if (frac < 0 || frac > 1) return
        const frameIndex = Math.round(frac * (ed.results.length - 1))
        ShadeTool_Graphs._scrubToFrame(Math.max(0, Math.min(frameIndex, ed.results.length - 1)))
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

        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])
        if (store.indicatorLastDragPoint)
            centerLatLng = store.indicatorLastDragPoint

        const lat = parseFloat(centerLatLng.lat)
        const lng = parseFloat(centerLatLng.lng)
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

        const pad = { top: 20, right: 20, bottom: 30, left: 45 }
        const plotW = w - pad.left - pad.right
        const plotH = h - pad.top - pad.bottom

        _hPad = pad
        _hPlotW = plotW

        if (plotW <= 0 || plotH <= 0) return

        // Auto-fit elevation range to data
        let minEl = 0, maxEl = 0
        for (let i = 0; i < profile.length; i++) {
            const el = profile[i][1]
            if (el < minEl) minEl = el
            if (el > maxEl) maxEl = el
        }
        maxEl = Math.max(maxEl + 5, 10)
        minEl = Math.min(minEl - 2, -5)
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

        // Filled terrain silhouette
        ctx.beginPath()
        ctx.moveTo(pad.left, pad.top + plotH)
        for (let i = 0; i < reordered.length; i++) {
            const x = pad.left + ((reordered[i][0] + 180) / 360) * plotW
            const y = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
            ctx.lineTo(x, y)
        }
        ctx.lineTo(pad.left + plotW, pad.top + plotH)
        ctx.closePath()
        ctx.fillStyle = 'rgba(139,119,101,0.5)'
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

        // Source trajectory overlay
        ShadeTool_Graphs._drawSourceTrajectory(
            ctx, elmId, pad, plotW, plotH, minEl, elRange
        )

        // Axis tick labels
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        for (let i = 0; i < azTicks.length; i++) {
            const x = pad.left + ((azTicks[i] + 180) / 360) * plotW
            ctx.fillText(azLabels[i], x, h - 5)
        }
        ctx.textAlign = 'right'
        elTick = Math.ceil(minEl / elStep) * elStep
        while (elTick <= maxEl) {
            const y = pad.top + plotH - ((elTick - minEl) / elRange) * plotH
            ctx.fillText(elTick.toFixed(0) + '°', pad.left - 4, y + 3)
            elTick += elStep
        }

        // Axis titles
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Azimuth', pad.left + plotW / 2, h - 0)
        ctx.save()
        ctx.translate(12, pad.top + plotH / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText('Elevation (°)', 0, 0)
        ctx.restore()
    },

    _drawSourceTrajectory(ctx, elmId, pad, plotW, plotH, minEl, elRange) {
        const store = useShadeStore.getState()
        const ed = store.sweepElData[elmId]
        if (!ed?.results || ed.results.length === 0) return

        const results = ed.results
        const playIndex = (ed.playbackLinked === false)
            ? (ed.localPlayIndex || 0)
            : store.sweepPlayIndex

        // Draw trajectory arc
        ctx.beginPath()
        ctx.strokeStyle = '#dbb658'
        ctx.lineWidth = 2
        let started = false
        for (let i = 0; i < results.length; i++) {
            const az = results[i].azimuth
            const el = results[i].elevation
            if (az == null || el == null) continue
            const x = _azToPlotX(az, pad, plotW)
            const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
            if (!started) {
                ctx.moveTo(x, y)
                started = true
            } else {
                ctx.lineTo(x, y)
            }
        }
        ctx.stroke()

        // Trajectory dots
        ctx.fillStyle = 'rgba(219,182,88,0.4)'
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

        // Current frame marker
        const cur = results[playIndex]
        if (cur && cur.azimuth != null && cur.elevation != null) {
            const x = _azToPlotX(cur.azimuth, pad, plotW)
            const y = pad.top + plotH - ((cur.elevation - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.fillStyle = '#ffdd44'
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1.5
            ctx.stroke()
        }


    },

    drawVisibilityTimeline(elmId) {
        const canvas = document.getElementById(VISIBILITY_CANVAS_ID)
        if (!canvas) return

        const store = useShadeStore.getState()
        const ed = store.sweepElData[elmId]
        if (!ed?.results || ed.results.length === 0) return

        // Update title with source name
        const el = store.elements[elmId]
        const titleEl = document.getElementById('shadeVisibilityTitle')
        if (titleEl && el) {
            const sources = store.getSelectedSources(elmId)
            const srcName = sources?.[0]?.name || 'Source'
            titleEl.textContent = srcName + ' Visibility Timeline'
        }

        const results = ed.results
        const profile = _horizonCache?.profile

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.parentElement.getBoundingClientRect()
        const w = Math.floor(rect.width)
        const h = Math.floor(rect.height - 24)
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)

        const pad = { top: 16, right: 20, bottom: 36, left: 45 }
        const plotW = w - pad.left - pad.right
        const plotH = h - pad.top - pad.bottom

        if (plotW <= 0 || plotH <= 0) return

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.fillRect(0, 0, w, h)

        const playIndex = (ed.playbackLinked === false)
            ? (ed.localPlayIndex || 0)
            : store.sweepPlayIndex

        // Compute visibility segments
        const segments = []
        for (let i = 0; i < results.length; i++) {
            const r = results[i]
            let visible = true

            if (profile && r.azimuth != null && r.elevation != null) {
                let az = r.azimuth
                if (az < 0) az += 360
                const horizEl = _interpolateHorizon(profile, az)
                visible = r.elevation > horizEl
            } else if (r.visibilityPct != null) {
                visible = parseFloat(r.visibilityPct) > 50
            }
            segments.push(visible)
        }

        const barH = Math.min(plotH * 0.5, 40)
        const barY = pad.top + (plotH - barH) / 2

        // Draw segments
        const segW = plotW / results.length
        for (let i = 0; i < segments.length; i++) {
            const x = pad.left + i * segW
            ctx.fillStyle = segments[i]
                ? 'rgba(76,175,80,0.85)'
                : 'rgba(60,60,60,0.85)'
            ctx.fillRect(x, barY, Math.ceil(segW) + 1, barH)
        }

        // Bar border
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
        ctx.strokeRect(pad.left, barY, plotW, barH)

        // Time labels
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        const labelCount = Math.min(results.length, Math.floor(plotW / 80))
        const labelStep = Math.max(1, Math.floor(results.length / labelCount))
        for (let i = 0; i < results.length; i += labelStep) {
            const t = results[i].time
            if (!t) continue
            const x = pad.left + (i + 0.5) * segW
            const label = _formatTimeLabel(t)
            ctx.save()
            ctx.translate(x, barY + barH + 12)
            ctx.rotate(-Math.PI / 6)
            ctx.fillText(label, 0, 0)
            ctx.restore()
        }

        // Legend
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(76,175,80,0.85)'
        ctx.fillRect(pad.left, h - 14, 10, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText('Visible', pad.left + 14, h - 5)
        ctx.fillStyle = 'rgba(60,60,60,0.85)'
        ctx.fillRect(pad.left + 70, h - 14, 10, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText('Occluded', pad.left + 84, h - 5)

        // Red time slider
        if (playIndex >= 0 && playIndex < results.length) {
            const cx = pad.left + (playIndex + 0.5) * segW
            ctx.save()
            ctx.strokeStyle = '#e53935'
            ctx.lineWidth = 2
            ctx.setLineDash([])
            ctx.beginPath()
            ctx.moveTo(cx, pad.top)
            ctx.lineTo(cx, pad.top + plotH)
            ctx.stroke()
            // Slider handle (triangle at top)
            ctx.fillStyle = '#e53935'
            ctx.beginPath()
            ctx.moveTo(cx - 5, pad.top)
            ctx.lineTo(cx + 5, pad.top)
            ctx.lineTo(cx, pad.top + 7)
            ctx.closePath()
            ctx.fill()
            ctx.restore()

            // Cursor time label
            const curTime = results[playIndex].time
            if (curTime) {
                ctx.fillStyle = '#e53935'
                ctx.font = '10px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(
                    _formatTimeLabel(curTime),
                    cx,
                    pad.top - 4
                )
            }
        }
    },

    updatePlaybackFrame(elmId) {
        if (!_graphOpen) return
        const effectiveId = elmId != null ? elmId : _activeElmId
        if (effectiveId == null) return

        if (_animFrameId) cancelAnimationFrame(_animFrameId)
        _animFrameId = requestAnimationFrame(() => {
            if (_activeView === 'horizon' && _horizonCache) {
                ShadeTool_Graphs._drawHorizonCanvas(
                    _horizonCache.profile,
                    effectiveId
                )
                ShadeTool_Graphs._updateTimeLabel()
            } else if (_activeView === 'visibility') {
                ShadeTool_Graphs.drawVisibilityTimeline(effectiveId)
            }
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
    const cleaned = timeStr.replace(' UTC', '').replace(/\.\d{3}Z$/, 'Z')
    const parts = cleaned.split('T')
    if (parts.length === 2) return parts[1].replace('Z', '')
    return cleaned
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
