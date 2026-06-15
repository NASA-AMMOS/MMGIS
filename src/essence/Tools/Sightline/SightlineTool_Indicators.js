import F_ from '../../Basics/Formulae_/Formulae_'
import { MULTI_SOURCE_COLORS } from './store'

const sunColor = '#d2db58'
const earthColor = '#58dbb8'

const SightlineTool_Indicators = {
    updateRAEIndicators(rae, sightlineId, allResults) {
        const size = 160
        const sizeInner = 144
        const origin = { x: size / 2, y: size / 2 }

        const indicatorEl = document.getElementById(
            `sightlineTool_indicators_${sightlineId}`
        )
        if (indicatorEl) {
            indicatorEl.style.borderBottom = rae.error
                ? '3px solid var(--color-red)'
                : ''
        }

        // Azimuth
        const azValueEl = document.getElementById(
            `sightlineTool_azValue_${sightlineId}`
        )
        if (azValueEl) {
            azValueEl.textContent = rae.error
                ? 'Az: Error'
                : 'Az: ' + rae.azimuth.toFixed(2) + '\u00B0'
        }
        const cAz = document.getElementById(
            `sightlineTool_az_${sightlineId}`
        )
        if (!cAz) return
        cAz.width = size
        cAz.height = size
        const ctxAz = cAz.getContext('2d')

        ctxAz.clearRect(0, 0, cAz.width, cAz.height)

        ctxAz.beginPath()
        ctxAz.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxAz.fillStyle = '#3a3e40'
        ctxAz.fill()
        ctxAz.strokeStyle = 'rgba(255,255,255,0.3)'
        ctxAz.lineWidth = 2
        ctxAz.stroke()

        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(origin.x, size - (size - sizeInner) / 2)
        ctxAz.lineTo(origin.x, (size - sizeInner) / 2)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(255,255,255,0.2)'
        ctxAz.stroke()

        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(size - (size - sizeInner) / 2, origin.y)
        ctxAz.lineTo((size - sizeInner) / 2, origin.y)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(255,255,255,0.2)'
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
                SightlineTool_Indicators.drawAzAngleGuideOnCanvas(
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
                SightlineTool_Indicators.drawAzAngleGuideOnCanvas(
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
            SightlineTool_Indicators.drawAzAngleGuideOnCanvas(
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
                    SightlineTool_Indicators.drawAzAngleGuideOnCanvas(
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
            `sightlineTool_elValue_${sightlineId}`
        )
        if (elValueEl) {
            elValueEl.textContent = rae.error
                ? 'El: Error'
                : 'El: ' + rae.elevation.toFixed(2) + '\u00B0'
        }
        const cEl = document.getElementById(
            `sightlineTool_el_${sightlineId}`
        )
        if (!cEl) return
        cEl.width = size
        cEl.height = size
        const ctxEl = cEl.getContext('2d')

        ctxEl.clearRect(0, 0, cEl.width, cEl.height)

        ctxEl.beginPath()
        ctxEl.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxEl.fillStyle = '#3a3e40'
        ctxEl.fill()
        ctxEl.strokeStyle = 'rgba(255,255,255,0.3)'
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
        ctxEl.strokeStyle = 'rgba(255,255,255,0.2)'
        ctxEl.stroke()

        if (rae.error != true) {
            if (rae.ancillary?.sun_el) {
                SightlineTool_Indicators.drawElAngleGuideOnCanvas(
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
                SightlineTool_Indicators.drawElAngleGuideOnCanvas(
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

            SightlineTool_Indicators.drawElAngleGuideOnCanvas(
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
            ctx.fillStyle = '#3a3e40'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'
            ctx.lineWidth = 1
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(origin.x, size - (size - sizeInner) / 2)
            ctx.lineTo(origin.x, (size - sizeInner) / 2)
            ctx.lineWidth = 0.5
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(size - (size - sizeInner) / 2, origin.y)
            ctx.lineTo((size - sizeInner) / 2, origin.y)
            ctx.lineWidth = 0.5
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'
            ctx.stroke()

            if (rae && rae.azimuth != null) {
                ctx.font = '11px Arial'
                ctx.fillStyle = 'rgba(255,255,255,0.8)'
                ctx.textAlign = 'center'
                ctx.fillText('N', size / 2, (size - sizeInner) * 1.2 + 3)

                SightlineTool_Indicators.drawAzAngleGuideOnCanvas(
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
            ctx.fillStyle = '#3a3e40'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'
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
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'
            ctx.stroke()

            if (rae && rae.elevation != null) {
                let azGreaterThan180 = false
                if (rae.azimuth != null) {
                    let az = rae.azimuth
                    if (az < 0) az += 360
                    azGreaterThan180 = az > 180
                }
                SightlineTool_Indicators.drawElAngleGuideOnCanvas(
                    ctx, origin, sizeInner,
                    rae.elevation,
                    { azGreaterThan180, angleGuide: true, color: '#dbb658', lineWidth: 2, arrowSize: 2, guideLineWidth: 1, tipInset: 5, innerInset: 12 }
                )
            }
        }
    },

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

        function azel2xy(az, el) {
            const elClamped = Math.max(0, Math.min(90, el))
            const dist = ((90 - elClamped) / 90) * r
            const azRad = (az - 90) * (Math.PI / 180)
            return {
                x: cx + dist * Math.cos(azRad),
                y: cy + dist * Math.sin(azRad),
            }
        }

        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.fillStyle = '#3a3e40'
        ctx.fill()

        const skyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        skyGrad.addColorStop(0, 'rgba(8, 40, 80, 0.6)')
        skyGrad.addColorStop(1, 'rgba(30, 80, 130, 0.3)')
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.fillStyle = skyGrad
        ctx.fill()

        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.stroke()

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

        const cardinalColor = getComputedStyle(document.documentElement).getPropertyValue('--color-f').trim() || 'rgba(255,255,255,0.7)'
        ctx.font = '22px Arial'
        ctx.fillStyle = cardinalColor
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

        ctx.font = '18px Arial'
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (const elDeg of [30, 60]) {
            const ringR = ((90 - elDeg) / 90) * r
            ctx.fillText(elDeg + '°', cx + 2, cy - ringR)
        }

        if (!results || results.length === 0) return

        const validResults = results.filter(
            (r) => r && r.azimuth != null && r.elevation != null
        )
        if (validResults.length === 0) return

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

        ctx.beginPath()
        first = true
        for (let i = 0; i < results.length; i++) {
            const pt = results[i]
            if (!pt || pt.azimuth == null || pt.elevation == null) continue
            if (pt.elevation < 0) {
                const p = azel2xy(pt.azimuth, 0)
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

        const cur = results[currentIdx]
        if (cur && cur.azimuth != null && cur.elevation != null) {
            const cp = azel2xy(cur.azimuth, cur.elevation)
            const glow = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 16)
            glow.addColorStop(0, 'rgba(219, 182, 88, 0.6)')
            glow.addColorStop(1, 'rgba(219, 182, 88, 0)')
            ctx.beginPath()
            ctx.arc(cp.x, cp.y, 16, 0, 2 * Math.PI)
            ctx.fillStyle = glow
            ctx.fill()

            ctx.beginPath()
            ctx.arc(cp.x, cp.y, 7, 0, 2 * Math.PI)
            ctx.fillStyle = '#dbb658'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'
            ctx.lineWidth = 2
            ctx.stroke()

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
}

export default SightlineTool_Indicators
