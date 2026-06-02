import React, { useRef, useCallback, useState, useEffect } from 'react'
import ShadeTool from '../ShadeTool'

function getDefaultStops(bins) {
    const stops = []
    for (let i = 1; i < bins; i++) {
        stops.push(i / bins)
    }
    return stops
}

export default function CardLegend({ rampName, discrete, visiblePct, fitToData, minFrac, maxFrac, colorStops, onColorStopsChange, onColorStopsReset }) {
    const isShadowRamp = rampName === 'shadow'
    const allRamps = ShadeTool.getSweepColorRamps()
    const rampDef = allRamps.find((r) => r.name === rampName) || allRamps[0]
    const colors = rampDef.colors
    const bins = rampDef.bins || colors.length
    const barRef = useRef(null)
    const localStopsRef = useRef(null)
    const [draggingIdx, setDraggingIdx] = useState(null)
    const [localStops, setLocalStops] = useState(null)

    const baseStops = discrete && colorStops && colorStops.length === bins - 1
        ? colorStops
        : getDefaultStops(bins)

    // Use local stops during drag for visual preview, committed stops otherwise
    const stops = localStops || baseStops

    const isCustom = discrete && colorStops && colorStops.length === bins - 1 &&
        JSON.stringify(colorStops.map(s => s.toFixed(4))) !== JSON.stringify(getDefaultStops(bins).map(s => s.toFixed(4)))

    const gradientStops = []
    const useFullAlpha = fitToData || discrete
    if (discrete) {
        for (let i = 0; i < bins; i++) {
            const tStart = i === 0 ? 0 : stops[i - 1]
            const tEnd = i === bins - 1 ? 1 : stops[i]
            const binCenter = (tStart + tEnd) / 2
            const alphaFrac = bins > 1 ? i / (bins - 1) : 0
            const cl = ShadeTool.evalColor(colors, binCenter, true, bins)
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

    const handleMouseDown = useCallback((e, idx) => {
        e.preventDefault()
        e.stopPropagation()
        const initial = [...stops]
        localStopsRef.current = initial
        setLocalStops(initial)
        setDraggingIdx(idx)
    }, [stops])

    useEffect(() => {
        if (draggingIdx == null) return
        const handleMove = (e) => {
            if (!barRef.current) return
            const rect = barRef.current.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            setLocalStops((prev) => {
                if (!prev) return prev
                const newStops = [...prev]
                const minGap = 0.02
                const lo = draggingIdx === 0 ? minGap : newStops[draggingIdx - 1] + minGap
                const hi = draggingIdx === newStops.length - 1 ? 1 - minGap : newStops[draggingIdx + 1] - minGap
                newStops[draggingIdx] = Math.max(lo, Math.min(hi, x))
                localStopsRef.current = newStops
                return newStops
            })
        }
        const handleUp = () => {
            const finalStops = localStopsRef.current
            setDraggingIdx(null)
            setLocalStops(null)
            localStopsRef.current = null
            if (finalStops && onColorStopsChange) {
                setTimeout(() => onColorStopsChange(finalStops), 0)
            }
        }
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
        return () => {
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
        }
    }, [draggingIdx, onColorStopsChange])

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
            <div className="vstSweepLegendBarWrap" ref={barRef}>
                <div className="vstSweepLegendBar">
                    <div className="vstSweepLegendGradient" style={{
                        background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
                    }} />
                </div>
                {discrete && onColorStopsChange && stops.map((s, idx) => (
                    <div
                        key={idx}
                        className={`vstSweepLegendStop${draggingIdx === idx ? ' dragging' : ''}`}
                        style={{ left: `${s * 100}%` }}
                        onMouseDown={(e) => handleMouseDown(e, idx)}
                    >
                        <span className="vstSweepLegendStopLabel">{Math.round(s * 100)}%</span>
                    </div>
                ))}
                {hasPct && (
                    <div className="vstSweepLegendIndicator" style={{ left: `${indicatorPos}%` }}>
                        <div className="vstSweepLegendIndicatorLine" />
                        <div className="vstSweepLegendIndicatorLabel">{pctVal.toFixed(1)}%</div>
                    </div>
                )}
            </div>
            <div className="vstSweepLegendLabels">
                <span>{fitToData ? `${(minFrac * 100).toFixed(0)}%` : '0%'}</span>
                <span>
                    {fitToData ? '% Visible (fitted)' : '% Visible'}
                    {discrete && isCustom && onColorStopsReset && (
                        <i
                            className="mdi mdi-refresh mdi-12px vstSweepLegendReset"
                            title="Reset color stops to default positions"
                            onClick={onColorStopsReset}
                        />
                    )}
                </span>
                <span>{fitToData ? `${(maxFrac * 100).toFixed(0)}%` : '100%'}</span>
            </div>
        </div>
    )
}

export { getDefaultStops }
