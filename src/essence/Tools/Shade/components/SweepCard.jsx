import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import useShadeStore, { buildSourcesList } from '../store'
import ShadeTool from '../ShadeTool'
import { ColorRampPicker, Slider } from '../../../../design-system/components'

function CardLegend({ rampName, discrete, visiblePct, fitToData, minFrac, maxFrac }) {
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
    // In fit-to-data mode, map the raw % to the fitted gradient position
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

export default function SweepCard({ elmId, mode, onDragStart, onDragOver, onDrop }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const vars = useShadeStore((s) => s.vars)
    const ed = useShadeStore((s) => s.sweepElData[elmId])
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const setSweepElField = useShadeStore((s) => s.setSweepElField)
    const cardRef = useRef(null)
    const handleRef = useRef(null)
    const isDraggingRef = useRef(false)

    const sourcesList = useMemo(() => buildSourcesList(vars), [vars])

    const sourceName = useMemo(() => {
        if (!el) return ''
        const src = sourcesList[el.sourceIndex]
        return src ? src.name : 'Custom'
    }, [el, sourcesList])

    const observerName = useMemo(() => {
        if (!el || !el.observer) return ''
        const obs = (vars?.observers || []).find((o) => o.value === el.observer)
        return obs ? obs.name : el.observer
    }, [el, vars])

    const sweepDiscrete = useShadeStore((s) => s.sweepDiscrete)
    const sweepFitToData = useShadeStore((s) => s.sweepFitToData)
    const opacity = ed?.opacity != null ? ed.opacity : 1
    const colorRamp = ed?.colorRamp || 'shadow'
    const discrete = sweepDiscrete || false

    const currentResult = useMemo(() => {
        if (mode !== 'playback' || !ed?.results) return null
        return ed.results[sweepPlayIndex] || null
    }, [mode, ed, sweepPlayIndex])

    const hoverFrac = ed?.hoverFrac
    const hoverPct = useMemo(() => {
        if (hoverFrac == null || !Number.isFinite(hoverFrac)) return null
        return hoverFrac * 100
    }, [hoverFrac])

    // Draw mini az/el canvases when playback result changes
    const azCanvasId = `sweepMiniAz_${elmId}`
    const elCanvasId = `sweepMiniEl_${elmId}`
    useEffect(() => {
        if (mode !== 'playback' || !currentResult) return
        ShadeTool.drawMiniRAEIndicators(azCanvasId, elCanvasId, currentResult)
    }, [mode, currentResult, azCanvasId, elCanvasId])

    // Draw sky dome polar plot
    const skyDomeId = `sweepSkyDome_${elmId}`
    useEffect(() => {
        if (mode !== 'playback' || !ed?.results || ed.results.length === 0) return
        ShadeTool.drawSkyDome(skyDomeId, ed.results, sweepPlayIndex)
    }, [mode, ed?.results, sweepPlayIndex, skyDomeId])

    // Drag from handle only — use mousedown on handle to allow next dragstart
    const handleHandleMouseDown = useCallback(() => {
        isDraggingRef.current = true
    }, [])

    const handleCardDragStart = useCallback((e) => {
        if (!isDraggingRef.current) {
            e.preventDefault()
            return
        }
        // Create a clone for drag image to lock visual to Y axis
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect()
            e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, 10)
        }
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(e, elmId)
    }, [elmId, onDragStart])

    const handleCardDragEnd = useCallback(() => {
        isDraggingRef.current = false
    }, [])

    const handleOpacityChange = useCallback((val) => {
        setSweepElField(elmId, 'opacity', val)
        ShadeTool.applySweepOpacity(elmId)
    }, [elmId, setSweepElField])

    const handleColorRampChange = useCallback((value) => {
        setSweepElField(elmId, 'colorRamp', value)
        setTimeout(() => {
            const ed2 = useShadeStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                ShadeTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField])


    if (!el || !ed) return null

    return (
        <div
            ref={cardRef}
            className="vstSweepCard"
            draggable
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, elmId)}
        >
            <div className="vstSweepCardHeader">
                <div className="vstSweepCardIdentity">
                    <span className="vstSweepCardSource">{sourceName}{observerName ? (' / ' + observerName) : ''}</span>
                </div>
                <div
                    ref={handleRef}
                    className="vstSweepCardDragHandle"
                    onMouseDown={handleHandleMouseDown}
                >
                    <i className="mdi mdi-drag-vertical mdi-14px" />
                </div>
            </div>

            {mode === 'composite' && (
                <div className="vstSweepCardBody">
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Color Ramp</div>
                        <div style={{ width: 145 }}>
                            <ColorRampPicker
                                value={colorRamp}
                                onValueChange={handleColorRampChange}
                                ramps={ShadeTool.getSweepColorRamps()}
                            />
                        </div>
                    </div>
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Opacity</div>
                        <div style={{ width: 145 }}>
                            <Slider
                                value={opacity}
                                onValueChange={handleOpacityChange}
                                min={0}
                                max={1}
                                step={0.05}
                                suffix="%"
                                formatValue={(v) => Math.round(v * 100)}
                            />
                        </div>
                    </div>
                    <CardLegend rampName={colorRamp} discrete={discrete} visiblePct={hoverPct} fitToData={sweepFitToData} minFrac={ed?.minFrac ?? 0} maxFrac={ed?.maxFrac ?? 1} />
                </div>
            )}

            {mode === 'playback' && (
                <div className="vstSweepCardBody">
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Opacity</div>
                        <div style={{ width: 145 }}>
                            <Slider
                                value={opacity}
                                onValueChange={handleOpacityChange}
                                min={0}
                                max={1}
                                step={0.05}
                                suffix="%"
                                formatValue={(v) => Math.round(v * 100)}
                            />
                        </div>
                    </div>
                    {ed?.results && ed.results.length > 0 && (
                        <div className="vstSweepCardSkyDome">
                            <canvas id={skyDomeId} width="140" height="140" />
                        </div>
                    )}
                    {currentResult && (
                        <div className="vstSweepCardMiniIndicators">
                            <div className="vstSweepCardMiniIndicator">
                                <div className="vstSweepCardMiniLabel">Az: {currentResult.azimuth?.toFixed(1)}°</div>
                                <canvas id={azCanvasId} width="80" height="80" />
                            </div>
                            <div className="vstSweepCardMiniIndicator">
                                <div className="vstSweepCardMiniLabel">El: {currentResult.elevation?.toFixed(1)}°</div>
                                <canvas id={elCanvasId} width="80" height="80" />
                            </div>
                        </div>
                    )}
                    {currentResult && (
                        <div className="vstSweepCardPlaybackInfo">
                            <span>Visible: {currentResult.visibilityPct}%</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
