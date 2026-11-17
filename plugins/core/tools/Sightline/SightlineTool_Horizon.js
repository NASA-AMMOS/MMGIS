import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import useSightlineStore, { buildDemsList } from './store'
import calls from '@pre/calls'
import Toast from '@design/components/Toast/Toast'

const HORIZON_CANVAS_ID = 'sightlineHorizonCanvas'
const HOVER_LINE_ID = 'sightlineHorizonHoverLine'

// Layout state cached for mouse→azimuth conversion
let _hPad = null
let _hPlotW = 0
let _horizonCache = null
let _horizonPolygon = null
let _polygonEnabled = false
let _pendingProfile = null
let _drawRetryFrame = null
let _drawRetryCount = 0
let _lastDrawParentH = null

const SightlineTool_Horizon = {
    getCache() {
        return _horizonCache
    },

    invalidateCache() {
        _horizonCache = null
    },

    getLayoutPad() {
        return _hPad
    },

    getLayoutPlotW() {
        return _hPlotW
    },

    removePolygon() {
        if (_horizonPolygon) {
            Map_.map.removeLayer(_horizonPolygon)
            _horizonPolygon = null
        }
    },

    setPolygonEnabled(enabled) {
        _polygonEnabled = enabled
        if (enabled && _pendingProfile) {
            SightlineTool_Horizon._updatePolygon(_pendingProfile)
        } else if (!enabled) {
            SightlineTool_Horizon.removePolygon()
        }
    },

    _updatePolygon(profile) {
        _pendingProfile = profile
        SightlineTool_Horizon.removePolygon()

        if (!_polygonEnabled) return
        if (!profile || profile.length === 0 || !_horizonCache) return

        const R = F_.radiusOfPlanetMajor
        if (!R || R <= 0) return

        const cLat = _horizonCache.lat
        const cLng = _horizonCache.lng
        const toRad = Math.PI / 180
        const toDeg = 180 / Math.PI

        const latlngs = []
        for (let i = 0; i < profile.length; i++) {
            const az = profile[i][0]
            const dist = profile[i][2] || 0
            if (dist <= 0) continue
            const distDeg = (dist / R) * toDeg
            const lat1 = cLat * toRad
            const lng1 = cLng * toRad
            const azRad = az * toRad
            const d = distDeg * toRad
            const sinLat1 = Math.sin(lat1)
            const cosLat1 = Math.cos(lat1)
            const sinD = Math.sin(d)
            const cosD = Math.cos(d)
            const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(azRad))
            const lng2 = lng1 + Math.atan2(
                Math.sin(azRad) * sinD * cosLat1,
                cosD - sinLat1 * Math.sin(lat2)
            )
            latlngs.push([lat2 * toDeg, lng2 * toDeg])
        }

        if (latlngs.length < 3) return

        _horizonPolygon = L.polygon(latlngs, {
            color: 'rgba(255, 255, 255, 0.6)',
            weight: 3,
            fillColor: 'rgba(255, 255, 255, 0.12)',
            fillOpacity: 1,
            interactive: false,
        })
        Map_.map.addLayer(_horizonPolygon)
    },

    onMouseMove(e, opts) {
        if (!_hPad || _hPlotW <= 0) return
        const canvas = e.target
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const frac = (mouseX - _hPad.left) / _hPlotW
        if (frac < 0 || frac > 1) {
            if (opts.onLeave) opts.onLeave()
            SightlineTool_Horizon._hideHoverLine()
            SightlineTool_Horizon._hideTooltip()
            return
        }
        const displayAz = -180 + frac * 360
        let trueAz = displayAz
        if (trueAz < 0) trueAz += 360
        if (opts.onAzimuth) opts.onAzimuth(trueAz)
        SightlineTool_Horizon._showHoverLine(mouseX)
        SightlineTool_Horizon._showTooltip(trueAz, mouseX, mouseY)
    },

    onMouseLeave(opts) {
        if (opts.onLeave) opts.onLeave()
        SightlineTool_Horizon._hideHoverLine()
        SightlineTool_Horizon._hideTooltip()
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

    _showTooltip(trueAz, mouseX, mouseY) {
        const profile = _horizonCache?.profile
        if (!profile || profile.length === 0) return
        const step = 360.0 / profile.length
        let idx = Math.round(trueAz / step) % profile.length
        if (idx < 0) idx += profile.length
        const el = profile[idx][1]
        const dist = profile[idx][2] || 0
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
        tip.style.left = mouseX + 'px'
        tip.style.top = (mouseY - 28) + 'px'
        tip.style.display = 'block'
    },

    _hideTooltip() {
        const tip = document.getElementById('sightlineHorizonTooltip')
        if (tip) tip.style.display = 'none'
    },

    fetchAndDraw(elmId, opts) {
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        if (!el) return

        // Resolve the element's selected DEM (multi-DEM list, or legacy single dem)
        const dems = buildDemsList(store.vars)
        let demUrl = dems.length > 0
            ? (dems[el.demIndex != null ? el.demIndex : 0] || dems[0]).path
            : store.vars?.dem
        if (!demUrl) {
            Toast.warning('No DEM configured for horizon profile.', 4000)
            return
        }
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl

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

        const minDist = opts.getMinDist()
        const maxDist = opts.getMaxDist()

        if (
            _horizonCache &&
            _horizonCache.demUrl === demUrl &&
            _horizonCache.lat === lat &&
            _horizonCache.lng === lng &&
            _horizonCache.height === height &&
            _horizonCache.minDist === minDist &&
            _horizonCache.maxDist === maxDist
        ) {
            SightlineTool_Horizon.draw(_horizonCache.profile, elmId)
            if (opts.onDone) opts.onDone()
            return
        }

        const useCurvature = store.vars?.hasOwnProperty('curvature') ? store.vars.curvature : true
        const horizonParams = {
            path: demUrl,
            lat: lat,
            lng: lng,
            observerHeight: height,
            numAzimuths: 360,
            maxRadius: maxDist,
            minSkipRadius: minDist,
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
                        'Horizon profile error: ' + (parsed.message || 'unknown'),
                        4000
                    )
                    return
                }
                const profile = parsed.horizonProfile || []
                _horizonCache = { demUrl, lat, lng, height, profile, minDist, maxDist }
                SightlineTool_Horizon.draw(profile, elmId)
                if (opts.onDone) opts.onDone()
            },
            function () {
                Toast.error('Failed to fetch horizon profile.', 4000)
            }
        )
    },

    draw(profile, elmId) {
        const canvas = document.getElementById(HORIZON_CANVAS_ID)
        if (!canvas) return

        // When the graphs panel is (re)opening, the horizon canvas lives in a
        // flex child whose height keeps changing for a few frames while the
        // panel and its sibling rows lay out. Sizing the canvas during that
        // transient commits it to a too-small height that is never corrected
        // (e.g. closing then immediately reopening the panel leaves the profile
        // blank). Retry on subsequent frames until the parent height is both
        // usable and stable across two consecutive frames before committing.
        const parentRect = canvas.parentElement.getBoundingClientRect()
        const usableH = parentRect.height - 24
        const stable =
            _lastDrawParentH != null &&
            Math.abs(parentRect.height - _lastDrawParentH) < 1
        if (
            (parentRect.width <= 0 || usableH <= 0 || !stable) &&
            (_drawRetryCount || 0) < 30
        ) {
            _lastDrawParentH = parentRect.height
            if (_drawRetryFrame) cancelAnimationFrame(_drawRetryFrame)
            _drawRetryCount = (_drawRetryCount || 0) + 1
            _drawRetryFrame = requestAnimationFrame(() => {
                SightlineTool_Horizon.draw(profile, elmId)
            })
            return
        }
        _drawRetryCount = 0
        _lastDrawParentH = null

        SightlineTool_Horizon._updatePolygon(profile)

        const store = useSightlineStore.getState()
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

        const pad = { top: 20, right: 0, bottom: 10, left: 45 }
        const plotW = w - pad.left - pad.right
        const plotH = h - pad.top - pad.bottom

        _hPad = pad
        _hPlotW = plotW

        if (plotW <= 0 || plotH <= 0) return

        // Elevation range
        let minHorizon = 0, maxEl = 0
        for (let i = 0; i < profile.length; i++) {
            const el = profile[i][1]
            if (el < minHorizon) minHorizon = el
            if (el > maxEl) maxEl = el
        }
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

        // Grid
        ctx.strokeStyle = `rgba(${isLight ? '0,0,0' : '255,255,255'},${gridAlpha})`
        ctx.lineWidth = 1
        const azTicks = [-180, -135, -90, -45, 0, 45, 90, 135, 180]
        for (let i = 0; i < azTicks.length; i++) {
            const x = pad.left + ((azTicks[i] + 180) / 360) * plotW
            ctx.beginPath()
            ctx.moveTo(x, pad.top)
            ctx.lineTo(x, pad.top + plotH)
            ctx.stroke()
        }
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
        const reordered = []
        for (let i = 0; i < profile.length; i++) {
            const az = profile[i][0]
            const displayAz = _azToDisplay(az)
            reordered.push([displayAz, profile[i][1], profile[i][2] || 0])
        }
        reordered.sort((a, b) => a[0] - b[0])

        // Linked elements for multi-arc display
        const linkedElms = _getLinkedHorizonElms(store, elmId)

        // Draw source trajectories behind terrain
        for (const le of linkedElms) {
            SightlineTool_Horizon._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, false
            )
        }

        // Filled terrain silhouette with distance-based fog
        const fillBottom = h
        const maxOpacity = isLight ? 0.7 : 0.95
        const minOpacity = isLight ? 0.03 : 0.05
        const fillR = isLight ? 160 : 90
        const fillG = isLight ? 120 : 62
        const fillB = isLight ? 70 : 35
        let maxDist = 0
        for (let i = 0; i < reordered.length; i++) {
            if (reordered[i][2] > maxDist) maxDist = reordered[i][2]
        }
        const hasDistData = maxDist > 0
        if (!hasDistData) {
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
            const logMax = Math.log(maxDist + 1)
            for (let i = 0; i < reordered.length; i++) {
                const x0 = pad.left + ((reordered[i][0] + 180) / 360) * plotW
                const yTop = pad.top + plotH - ((reordered[i][1] - minEl) / elRange) * plotH
                let x1
                if (i < reordered.length - 1) {
                    x1 = pad.left + ((reordered[i + 1][0] + 180) / 360) * plotW
                } else {
                    x1 = pad.left + plotW
                }
                const stripW = x1 - x0
                if (stripW <= 0) continue

                const dist = reordered[i][2]
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

        // Draw current frame markers on top
        for (const le of linkedElms) {
            SightlineTool_Horizon._drawSourceTrajectory(
                ctx, le.id, le.color, pad, plotW, plotH, minEl, elRange, true
            )
        }

        // Elevation tick labels
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

        // North arrow
        const northArrowX = northX
        const northArrowY = pad.top - 2
        ctx.fillStyle = textColor
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
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

        const brightness = color.r + color.g + color.b
        const c = brightness < 100
            ? { r: Math.min(color.r + 120, 255), g: Math.min(color.g + 120, 255), b: Math.min(color.b + 120, 255) }
            : color
        const lineColor = `rgb(${c.r},${c.g},${c.b})`
        const dotColor = `rgba(${c.r},${c.g},${c.b},0.4)`
        const markerColor = `rgb(${Math.min(c.r + 60, 255)},${Math.min(c.g + 60, 255)},${Math.min(c.b + 60, 255)})`

        if (!markerOnly) {
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

        // Current frame marker
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
}

// --- Helper functions ---

function _azToDisplay(az) {
    let a = az
    if (a < 0) a += 360
    return a > 180 ? a - 360 : a
}

function _azToPlotX(az, pad, plotW) {
    const d = _azToDisplay(az)
    return pad.left + ((d + 180) / 360) * plotW
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

        if (numId === primaryElmId) {
            out.push({ id: numId, color: el.color })
            continue
        }

        if (primaryCenter && ed.sweepCenter) {
            if (Math.abs(primaryCenter.lat - ed.sweepCenter.lat) > 0.0001 ||
                Math.abs(primaryCenter.lng - ed.sweepCenter.lng) > 0.0001) continue
        }

        const otherStart = ed.results[0]?.time
        const otherStep = ed.results.length > 1 ? ed.results[1]?.time : null
        if (primaryStart !== otherStart) continue
        if (primaryStep !== otherStep) continue
        if (ed.results.length !== primaryEd.results.length) continue

        out.push({ id: numId, color: el.color })
    }

    if (out.length === 0) {
        out.push({ id: primaryElmId, color: primaryEl.color })
    }

    return out
}

export default SightlineTool_Horizon
