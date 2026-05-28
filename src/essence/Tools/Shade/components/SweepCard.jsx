import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import useShadeStore, { buildSourcesList } from '../store'
import ShadeTool from '../ShadeTool'
import { ColorRampPicker, RadioGroup, Slider } from '../../../../design-system/components'

const COLOR_MODE_OPTIONS = [
    { label: 'Continuous', value: 'continuous' },
    { label: 'Discrete', value: 'discrete' },
]

function rgbStr(c) {
    return `rgb(${c.r},${c.g},${c.b})`
}

function CardLegend({ rampName, discrete, visiblePct }) {
    const isShadowRamp = rampName === 'shadow'
    const allRamps = ShadeTool.getSweepColorRamps()
    const rampDef = allRamps.find((r) => r.name === rampName) || allRamps[0]
    const colors = rampDef.colors
    const bins = rampDef.bins || colors.length
    const gradientStops = []
    if (discrete) {
        for (let i = 0; i < bins; i++) {
            const tStart = i / bins
            const tEnd = (i + 1) / bins
            const tMid = (i + 0.5) / bins
            const cl = ShadeTool.evalColor(colors, tMid, true, bins)
            const r = Math.round(cl[0] * 255)
            const g = Math.round(cl[1] * 255)
            const b = Math.round(cl[2] * 255)
            const a = isShadowRamp ? ((1 - tMid) * 200 + 55) / 255 : 1
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
            const a = isShadowRamp ? ((1 - t) * 200 + 55) / 255 : 1
            gradientStops.push(`rgba(${r},${g},${b},${a.toFixed(2)}) ${(t * 100).toFixed(1)}%`)
        }
    }
    const hasPct = visiblePct != null && Number.isFinite(parseFloat(visiblePct))
    const pctVal = hasPct ? parseFloat(visiblePct) : 0
    return (
        <div className="vstSweepCardLegend">
            <div className="vstSweepLegendBarWrap">
                <div className="vstSweepLegendBar" style={{
                    background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
                }} />
                {hasPct && (
                    <div className="vstSweepLegendIndicator" style={{ left: `${pctVal}%` }}>
                        <div className="vstSweepLegendIndicatorLine" />
                        <div className="vstSweepLegendIndicatorLabel">{pctVal.toFixed(1)}%</div>
                    </div>
                )}
            </div>
            <div className="vstSweepLegendLabels">
                <span>0%</span>
                <span>% Visible</span>
                <span>100%</span>
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

    const colorStr = useMemo(() => (el ? rgbStr(el.color) : '#000'), [el])

    const opacity = ed?.opacity != null ? ed.opacity : 1
    const colorRamp = ed?.colorRamp || 'shadow'
    const discrete = ed?.discrete || false

    const currentResult = useMemo(() => {
        if (mode !== 'playback' || !ed?.results) return null
        return ed.results[sweepPlayIndex] || null
    }, [mode, ed, sweepPlayIndex])

    const avgVisiblePct = useMemo(() => {
        if (mode !== 'composite' || !ed?.heatmap) return null
        let sum = 0
        let count = 0
        for (let r = 0; r < ed.heatmap.length; r++) {
            const row = ed.heatmap[r]
            if (!row) continue
            for (let c = 0; c < row.length; c++) {
                const v = row[c]
                if (v != null && v >= 0 && Number.isFinite(v)) {
                    sum += v
                    count++
                }
            }
        }
        return count > 0 ? (sum / count) * 100 : null
    }, [mode, ed])

    // Draw mini az/el canvases when playback result changes
    const azCanvasId = `sweepMiniAz_${elmId}`
    const elCanvasId = `sweepMiniEl_${elmId}`
    useEffect(() => {
        if (mode !== 'playback' || !currentResult) return
        ShadeTool.drawMiniRAEIndicators(azCanvasId, elCanvasId, currentResult)
    }, [mode, currentResult, azCanvasId, elCanvasId])

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

    const handleColorModeChange = useCallback((modeVal) => {
        const isDiscrete = modeVal === 'discrete'
        setSweepElField(elmId, 'discrete', isDiscrete)
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
                <div
                    ref={handleRef}
                    className="vstSweepCardDragHandle"
                    onMouseDown={handleHandleMouseDown}
                >
                    <i className="mdi mdi-drag-vertical mdi-14px" />
                </div>
                <div className="vstSweepCardColor" style={{ background: colorStr }} />
                <div className="vstSweepCardIdentity">
                    <span className="vstSweepCardSource">{sourceName}</span>
                    {observerName && <span className="vstSweepCardObserver">{observerName}</span>}
                </div>
            </div>

            {mode === 'composite' && (
                <div className="vstSweepCardBody">
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Color Ramp</div>
                        <ColorRampPicker
                            value={colorRamp}
                            onValueChange={handleColorRampChange}
                            ramps={ShadeTool.getSweepColorRamps()}
                        />
                    </div>
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Mode</div>
                        <RadioGroup
                            value={discrete ? 'discrete' : 'continuous'}
                            onValueChange={handleColorModeChange}
                            options={COLOR_MODE_OPTIONS}
                        />
                    </div>
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Opacity</div>
                        <div className="vstOpacitySlider">
                            <Slider
                                value={opacity}
                                onValueChange={handleOpacityChange}
                                min={0}
                                max={1}
                                step={0.05}
                            />
                            <span className="vstOpacityValue">{Math.round(opacity * 100)}%</span>
                        </div>
                    </div>
                    <CardLegend rampName={colorRamp} discrete={discrete} visiblePct={avgVisiblePct} />
                </div>
            )}

            {mode === 'playback' && (
                <div className="vstSweepCardBody">
                    <div className="vstOptionRow vstSweepCardRow">
                        <div className="vstOptionLabel">Opacity</div>
                        <div className="vstOpacitySlider">
                            <Slider
                                value={opacity}
                                onValueChange={handleOpacityChange}
                                min={0}
                                max={1}
                                step={0.05}
                            />
                            <span className="vstOpacityValue">{Math.round(opacity * 100)}%</span>
                        </div>
                    </div>
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
