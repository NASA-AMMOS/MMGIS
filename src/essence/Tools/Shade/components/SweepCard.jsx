import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import useShadeStore, { buildSourcesList } from '../store'
import ShadeTool from '../ShadeTool'
import CardLegend from './CardLegend'
import { ColorRampPicker, Slider } from '../../../../design-system/components'

export default function SweepCard({ elmId, mode, onDragStart, onDragOver, onDragEnd, onDrop, isDropTarget }) {
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
        if (onDragEnd) onDragEnd()
    }, [onDragEnd])

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
            className={`vstSweepCard${isDropTarget ? ' vstDropTarget' : ''}`}
            draggable
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onDragOver={(e) => onDragOver(e, elmId)}
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
                <div className="vstSweepCardIdentity">
                    <span className="vstSweepCardSource">{sourceName}</span>
                    {observerName && <span className="vstSweepCardObserver">{' / '}{observerName}</span>}
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
                                ramps={ShadeTool.getSweepColorRamps(el?.color)}
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
                    <CardLegend rampName={colorRamp} discrete={discrete} visiblePct={hoverPct} fitToData={sweepFitToData} minFrac={ed?.minFrac ?? 0} maxFrac={ed?.maxFrac ?? 1} elmColor={el?.color} />
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

                </div>
            )}
        </div>
    )
}
