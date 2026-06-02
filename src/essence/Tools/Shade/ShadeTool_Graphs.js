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

let _horizonCache = null // { lat, lng, profile: [[az,el],...] }
let _activeElmId = null
let _graphOpen = false
let _animFrameId = null

const ShadeTool_Graphs = {
    isOpen() {
        return _graphOpen
    },

    getActiveElmId() {
        return _activeElmId
    },

    open(elmId) {
        _activeElmId = elmId
        _graphOpen = true

        useUIStore.getState().setToolHeight(250)

        setTimeout(() => {
            ShadeTool_Graphs._buildContainer()
            ShadeTool_Graphs.fetchAndDrawHorizon(elmId)
            ShadeTool_Graphs.drawVisibilityTimeline(elmId)
        }, 50)
    },

    close() {
        _graphOpen = false
        _activeElmId = null
        _horizonCache = null

        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId)
            _animFrameId = null
        }

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
        closeBtn.title = 'Close graphs'
        closeBtn.onclick = () => ShadeTool_Graphs.close()
        container.appendChild(closeBtn)

        // Horizon Profile panel
        const hPanel = document.createElement('div')
        hPanel.className = 'shadeGraphPanel'
        const hTitle = document.createElement('div')
        hTitle.className = 'shadeGraphTitle'
        hTitle.textContent = 'Horizon Profile'
        hPanel.appendChild(hTitle)
        const hCanvas = document.createElement('canvas')
        hCanvas.id = HORIZON_CANVAS_ID
        hCanvas.className = 'shadeGraphCanvas'
        hPanel.appendChild(hCanvas)
        container.appendChild(hPanel)

        // Visibility Timeline panel
        const vPanel = document.createElement('div')
        vPanel.className = 'shadeGraphPanel'
        const vTitle = document.createElement('div')
        vTitle.className = 'shadeGraphTitle'
        vTitle.id = 'shadeVisibilityTitle'
        vTitle.textContent = 'Visibility Timeline'
        vPanel.appendChild(vTitle)
        const vCanvas = document.createElement('canvas')
        vCanvas.id = VISIBILITY_CANVAS_ID
        vCanvas.className = 'shadeGraphCanvas'
        vPanel.appendChild(vCanvas)
        container.appendChild(vPanel)

        tools.appendChild(container)
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
                ShadeTool_Graphs.drawVisibilityTimeline(elmId)
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

        if (plotW <= 0 || plotH <= 0) return

        // Data ranges
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

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1
        const azTicks = [0, 45, 90, 135, 180, 225, 270, 315, 360]
        for (let i = 0; i < azTicks.length; i++) {
            const x = pad.left + (azTicks[i] / 360) * plotW
            ctx.beginPath()
            ctx.moveTo(x, pad.top)
            ctx.lineTo(x, pad.top + plotH)
            ctx.stroke()
        }
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

        // Filled terrain silhouette
        ctx.beginPath()
        ctx.moveTo(pad.left, pad.top + plotH)
        for (let i = 0; i < profile.length; i++) {
            const x = pad.left + (profile[i][0] / 360) * plotW
            const y =
                pad.top + plotH - ((profile[i][1] - minEl) / elRange) * plotH
            if (i === 0) ctx.lineTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.lineTo(pad.left + plotW, pad.top + plotH)
        ctx.closePath()
        ctx.fillStyle = 'rgba(139,119,101,0.5)'
        ctx.fill()

        // Horizon outline
        ctx.beginPath()
        for (let i = 0; i < profile.length; i++) {
            const x = pad.left + (profile[i][0] / 360) * plotW
            const y =
                pad.top + plotH - ((profile[i][1] - minEl) / elRange) * plotH
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = '#b8956a'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Source trajectory overlay
        ShadeTool_Graphs._drawSourceTrajectory(
            ctx,
            elmId,
            pad,
            plotW,
            plotH,
            minEl,
            elRange
        )

        // Axes labels
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        for (let i = 0; i < azTicks.length; i++) {
            const x = pad.left + (azTicks[i] / 360) * plotW
            ctx.fillText(azTicks[i] + '°', x, h - 5)
        }
        ctx.textAlign = 'right'
        elTick = Math.ceil(minEl / elStep) * elStep
        while (elTick <= maxEl) {
            const y = pad.top + plotH - ((elTick - minEl) / elRange) * plotH
            ctx.fillText(elTick.toFixed(0) + '°', pad.left - 4, y + 3)
            elTick += elStep
        }

        // Axis labels
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
            const x = pad.left + ((az < 0 ? az + 360 : az) / 360) * plotW
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
            const x = pad.left + ((az < 0 ? az + 360 : az) / 360) * plotW
            const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 2, 0, Math.PI * 2)
            ctx.fill()
        }

        // Current frame marker
        const cur = results[playIndex]
        if (cur && cur.azimuth != null && cur.elevation != null) {
            const x =
                pad.left +
                ((cur.azimuth < 0 ? cur.azimuth + 360 : cur.azimuth) / 360) *
                    plotW
            const y =
                pad.top +
                plotH -
                ((cur.elevation - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.fillStyle = '#ffdd44'
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1.5
            ctx.stroke()
        }

        // Sun trajectory (from ancillary if available)
        ShadeTool_Graphs._drawAncillaryTrajectory(
            ctx, results, 'sun_az', 'sun_el',
            pad, plotW, plotH, minEl, elRange,
            '#d2db58', playIndex
        )
        // Earth trajectory
        ShadeTool_Graphs._drawAncillaryTrajectory(
            ctx, results, 'earth_az', 'earth_el',
            pad, plotW, plotH, minEl, elRange,
            '#58dbb8', playIndex
        )
    },

    _drawAncillaryTrajectory(
        ctx, results, azKey, elKey,
        pad, plotW, plotH, minEl, elRange,
        color, playIndex
    ) {
        const hasAncillary = results.some(
            (r) => r.ancillary && r.ancillary[azKey] != null
        )
        if (!hasAncillary) return

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.5
        ctx.lineWidth = 1.5
        let started = false
        for (let i = 0; i < results.length; i++) {
            const anc = results[i].ancillary
            if (!anc || anc[azKey] == null) continue
            let az = anc[azKey]
            if (az < 0) az += 360
            const el = anc[elKey]
            const x = pad.left + (az / 360) * plotW
            const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
            if (!started) {
                ctx.moveTo(x, y)
                started = true
            } else {
                ctx.lineTo(x, y)
            }
        }
        ctx.stroke()
        ctx.globalAlpha = 1.0

        // Current marker
        const cur = results[playIndex]
        if (cur?.ancillary && cur.ancillary[azKey] != null) {
            let az = cur.ancillary[azKey]
            if (az < 0) az += 360
            const el = cur.ancillary[elKey]
            const x = pad.left + (az / 360) * plotW
            const y = pad.top + plotH - ((el - minEl) / elRange) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 4, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.globalAlpha = 0.8
            ctx.fill()
            ctx.globalAlpha = 1.0
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

        const pad = { top: 20, right: 20, bottom: 40, left: 45 }
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

        const barH = Math.min(plotH * 0.4, 40)
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

        // Playback cursor
        if (playIndex >= 0 && playIndex < results.length) {
            const cx = pad.left + (playIndex + 0.5) * segW
            ctx.strokeStyle = '#ffdd44'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(cx, pad.top)
            ctx.lineTo(cx, pad.top + plotH)
            ctx.stroke()

            // Cursor time label
            const curTime = results[playIndex].time
            if (curTime) {
                ctx.fillStyle = '#ffdd44'
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
            if (_horizonCache) {
                ShadeTool_Graphs._drawHorizonCanvas(
                    _horizonCache.profile,
                    effectiveId
                )
            }
            ShadeTool_Graphs.drawVisibilityTimeline(effectiveId)
            _animFrameId = null
        })
    },

    invalidateHorizonCache() {
        _horizonCache = null
    },
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
