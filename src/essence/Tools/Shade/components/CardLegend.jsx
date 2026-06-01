import React from 'react'
import ShadeTool from '../ShadeTool'

export default function CardLegend({ rampName, discrete, visiblePct, fitToData, minFrac, maxFrac }) {
    const isShadowRamp = rampName === 'shadow'
    const allRamps = ShadeTool.getSweepColorRamps()
    const rampDef = allRamps.find((r) => r.name === rampName) || allRamps[0]
    const colors = rampDef.colors
    const bins = rampDef.bins || colors.length
    const gradientStops = []
    const useFullAlpha = fitToData || discrete
    if (discrete) {
        for (let i = 0; i < bins; i++) {
            const tStart = i / bins
            const tEnd = (i + 1) / bins
            const alphaFrac = bins > 1 ? i / (bins - 1) : 0
            const cl = ShadeTool.evalColor(colors, (i + 0.5) / bins, true, bins)
            const r = Math.round(cl[0] * 255)
            const g = Math.round(cl[1] * 255)
            const b = Math.round(cl[2] * 255)
            const a = isShadowRamp ? (1 - alphaFrac) : 1
            gradientStops.push(`rgba(${r},${g},${b},${a.toFixed(2)}) ${(tStart * 100).toFixed(1)}%`)
            gradientStops.push(`rgba(${r},${g},${b},${a.toFixed(2)}) ${(tEnd * 100).toFixed(1)}%`)
        }
    } else {
        const steps = 64
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const cl = ShadeTool.evalColor(colors, t, false, bins)
            const r = Math.round(cl[0] * 255)
            const g = Math.round(cl[1] * 255)
            const b = Math.round(cl[2] * 255)
            const a = isShadowRamp
                ? (useFullAlpha ? (1 - t) : ((1 - t) * 200 + 55) / 255)
                : 1
            gradientStops.push(`rgba(${r},${g},${b},${a.toFixed(2)}) ${(t * 100).toFixed(1)}%`)
        }
    }
    const hasPct = visiblePct != null && Number.isFinite(parseFloat(visiblePct))
    const pctVal = hasPct ? parseFloat(visiblePct) : 0
    const indicatorPos = (() => {
        if (!hasPct) return 0
        const rawFrac = pctVal / 100
        if (fitToData && maxFrac > minFrac) {
            return Math.max(0, Math.min(100, ((rawFrac - minFrac) / (maxFrac - minFrac)) * 100))
        }
        return pctVal
    })()
    return (
        <div className="vstSweepCardLegend">
            <div className="vstSweepLegendBarWrap">
                <div className="vstSweepLegendBar">
                    <div className="vstSweepLegendGradient" style={{
                        background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
                    }} />
                </div>
                {hasPct && (
                    <div className="vstSweepLegendIndicator" style={{ left: `${indicatorPos}%` }}>
                        <div className="vstSweepLegendIndicatorLine" />
                        <div className="vstSweepLegendIndicatorLabel">{pctVal.toFixed(1)}%</div>
                    </div>
                )}
            </div>
            <div className="vstSweepLegendLabels">
                <span>{fitToData ? `${(minFrac * 100).toFixed(0)}%` : '0%'}</span>
                <span>{fitToData ? '% Visible (fitted)' : '% Visible'}</span>
                <span>{fitToData ? `${(maxFrac * 100).toFixed(0)}%` : '100%'}</span>
            </div>
        </div>
    )
}
