import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import ShadeTool from '../ShadeTool'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton, InputWithUnit, Slider } from '../../../../design-system/components'

const helpKey = 'ShadeTool'

const SPEED_NORMAL = 500
const SPEED_FAST = 150

function fmtUTC(t) {
    if (!t) return t
    return t.replace(/\.\d{3}Z$/, 'Z').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z')
}

function getTimeUIMode() {
    if (!TimeUI.modes) return 'Range'
    return TimeUI.modes[TimeUI.modeIndex] || 'Range'
}

export default function ShadePanel() {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const utcTime = useShadeStore((s) => s.utcTime)
    const addElement = useShadeStore((s) => s.addElement)
    const elementOrder = useShadeStore((s) => s.elementOrder)
    const setElementOrder = useShadeStore((s) => s.setElementOrder)
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const sweepElData = useShadeStore((s) => s.sweepElData)
    const sweepStale = useShadeStore((s) => s.sweepStale)
    const setSweepField = useShadeStore((s) => s.setSweepField)

    const dragItemRef = useRef(null)
    const [dropTargetId, setDropTargetId] = useState(null)

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    // Sync sweep times from TimeControl
    useEffect(() => {
        function syncFromTimeUI() {
            const mode = getTimeUIMode()
            const currentTime = TimeControl.getTime()
            const startTime = TimeControl.getStartTime()
            const endTime = TimeControl.getEndTime()
            if (mode === 'Point') {
                if (currentTime) setSweepField('sweepStart', fmtUTC(currentTime))
            } else {
                if (startTime) setSweepField('sweepStart', fmtUTC(startTime))
                if (endTime) setSweepField('sweepEnd', fmtUTC(endTime))
            }
        }
        syncFromTimeUI()
        TimeControl.subscribe('ShadeTool_Sweep', (t) => {
            const mode = getTimeUIMode()
            if (mode === 'Point') {
                if (t.currentTime) setSweepField('sweepStart', fmtUTC(t.currentTime))
            } else {
                if (t.startTime) setSweepField('sweepStart', fmtUTC(t.startTime))
                if (t.endTime) setSweepField('sweepEnd', fmtUTC(t.endTime))
            }
        })
        return () => {
            TimeControl.unsubscribe('ShadeTool_Sweep')
        }
    }, [setSweepField])

    const handleNew = useCallback(() => {
        const newId = addElement()
        setTimeout(() => ShadeTool.shade(null, newId), 0)
    }, [addElement])

    const elementIds = useMemo(() => {
        const allIds = Object.keys(elements).map(Number)
        const ordered = (elementOrder || []).filter((id) => allIds.includes(id))
        allIds.forEach((id) => {
            if (!ordered.includes(id)) ordered.push(id)
        })
        return ordered
    }, [elements, elementOrder])

    // Check if at least one element has been swept
    const hasSweepData = useMemo(() => {
        return !sweepStale && Object.keys(sweepElData).some((id) => sweepElData[id]?.heatmap != null)
    }, [sweepElData, sweepStale])

    // Check if any element is in composite/playback mode (to show sweep time inputs)
    const hasAnySweepMode = useMemo(() => {
        return Object.values(elements).some((el) => el.shadeMode === 'composite' || el.shadeMode === 'playback')
    }, [elements])

    const totalFrames = useMemo(() => {
        for (const id in sweepElData) {
            if (sweepElData[id]?.grids?.length > 0) return sweepElData[id].grids.length
        }
        return 0
    }, [sweepElData])

    // Drag reorder
    const handleElDragStart = useCallback((e, elmId) => {
        dragItemRef.current = elmId
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const handleElDragOver = useCallback((e, targetId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragItemRef.current != null && targetId !== dragItemRef.current) {
            setDropTargetId(targetId)
        }
    }, [])

    const handleElDragEnd = useCallback(() => {
        setDropTargetId(null)
    }, [])

    const handleElDrop = useCallback((e, targetId) => {
        e.preventDefault()
        setDropTargetId(null)
        const draggedId = dragItemRef.current
        if (draggedId == null || draggedId === targetId) return
        const order = [...elementIds]
        const fromIdx = order.indexOf(draggedId)
        const toIdx = order.indexOf(targetId)
        if (fromIdx < 0 || toIdx < 0) return
        order.splice(fromIdx, 1)
        order.splice(toIdx, 0, draggedId)
        setElementOrder(order)
        ShadeTool.reorderShadeLayers(order)
        dragItemRef.current = null
    }, [elementIds, setElementOrder])

    // Playback controls
    const handlePlayNormal = useCallback(() => {
        setSweepField('sweepPlaySpeed', SPEED_NORMAL)
        ShadeTool.updateSweepSpeed(SPEED_NORMAL)
        if (!useShadeStore.getState().sweepPlaying) ShadeTool.sweepPlay()
    }, [setSweepField])

    const handlePlayFast = useCallback(() => {
        setSweepField('sweepPlaySpeed', SPEED_FAST)
        ShadeTool.updateSweepSpeed(SPEED_FAST)
        if (!useShadeStore.getState().sweepPlaying) ShadeTool.sweepPlay()
    }, [setSweepField])

    const handlePause = useCallback(() => {
        if (useShadeStore.getState().sweepPlaying) ShadeTool.sweepPlay()
    }, [])

    const handleTimelineScrub = useCallback((v) => {
        setSweepField('sweepPlayIndex', v)
        ShadeTool.sweepShowAllFrames()
    }, [setSweepField])

    if (!TimeControl.enabled) {
        return (
            <div id="shadeTool">
                <div className="vstTimeDisabled">
                    The Shade Tool requires that Time be enabled by the
                    administrators.
                </div>
            </div>
        )
    }

    return (
        <div id="shadeTool">
            <div className="vstHeader">
                <div className="vstHeaderTop">
                    <div className="vstHeaderLeft">
                        <div className="vstTitle">Shade</div>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: Help.getComponent(helpKey),
                            }}
                        />
                    </div>
                    <IconButton
                        size="sm"
                        onClick={() => ToolController_.closeActiveTool()}
                        title="Close"
                        className="vstClose"
                    >
                        <i className="mdi mdi-close mdi-18px" />
                    </IconButton>
                </div>
            </div>
            <div className="vstBinaryLegend">
                <div className="vstBinaryLegendItem">
                    <div className="vstBinaryLegendSwatch vstBinaryLegendInShadow" />
                    <span>In Shadow <span className="vstBinaryLegendMuted">Filled</span></span>
                </div>
                <div className="vstBinaryLegendItem">
                    <div className="vstBinaryLegendSwatch vstBinaryLegendNotVisible" />
                    <span>Source Visible <span className="vstBinaryLegendMuted">Empty</span></span>
                </div>
            </div>

            {/* Time section — always shows UTC time, plus sweep params when any element uses sweep */}
            <div className="vstTime">
                <div className="vstClockIcon">
                    <i className="mdi mdi-clock-outline mdi-14px" />
                </div>
                <span>{utcTime}</span>
            </div>
            {hasAnySweepMode && (
                <div className="vstSweepBody">
                    <div className="vstOptionRow">
                        <div className="vstOptionLabel">Start Time</div>
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="YYYY-MM-DDTHH:MM:SSZ"
                            value={sweepStart}
                            onChange={(e) => setSweepField('sweepStart', e.target.value)}
                        />
                    </div>
                    <div className="vstOptionRow">
                        <div className="vstOptionLabel">End Time</div>
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="YYYY-MM-DDTHH:MM:SSZ"
                            value={sweepEnd}
                            onChange={(e) => setSweepField('sweepEnd', e.target.value)}
                        />
                    </div>
                    <div className="vstOptionRow">
                        <div className="vstOptionLabel">Step Size</div>
                        <InputWithUnit
                            unit="min"
                            type="number"
                            min="1"
                            step="1"
                            value={sweepStep || ''}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                setSweepField('sweepStep', Number.isFinite(v) ? v : '')
                            }}
                            className="vstSweepField"
                        />
                    </div>
                </div>
            )}

            {/* Element cards */}
            <div className="vstContent">
                {elementIds.map((id) => (
                    <ShadeElement
                        key={id}
                        elmId={id}
                        onDragStart={handleElDragStart}
                        onDragOver={handleElDragOver}
                        onDragEnd={handleElDragEnd}
                        onDrop={handleElDrop}
                        isDropTarget={dropTargetId === id}
                    />
                ))}
                <div className="vstNewBtnWrap">
                    <Button
                        className="vstNewBtn"
                        onClick={handleNew}
                    >
                        <i className="mdi mdi-plus mdi-18px" />
                        New
                    </Button>
                </div>
            </div>

            {/* Sweep controls — only when at least one element has sweep data */}
            {hasSweepData && (
                <div className="vstSweepCardsSection">
                    <div className="vstSweepControlsWrap">
                        <div className="vstSweepPlaybarRow">
                            <div className="vstSweepPlaybar">
                                <IconButton
                                    size="md"
                                    title="Step back"
                                    onClick={() => ShadeTool.sweepStepBack()}
                                >
                                    <i className="mdi mdi-skip-previous mdi-18px" />
                                </IconButton>
                                {sweepPlaying ? (
                                    <IconButton
                                        size="md"
                                        title="Pause"
                                        onClick={handlePause}
                                    >
                                        <i className="mdi mdi-pause mdi-18px" />
                                    </IconButton>
                                ) : (
                                    <>
                                        <IconButton
                                            size="md"
                                            title="Play"
                                            onClick={handlePlayNormal}
                                        >
                                            <i className="mdi mdi-play mdi-18px" />
                                        </IconButton>
                                        <IconButton
                                            size="md"
                                            title="Play fast"
                                            onClick={handlePlayFast}
                                        >
                                            <i className="mdi mdi-fast-forward mdi-18px" />
                                        </IconButton>
                                    </>
                                )}
                                <IconButton
                                    size="md"
                                    title="Step forward"
                                    onClick={() => ShadeTool.sweepStepForward()}
                                >
                                    <i className="mdi mdi-skip-next mdi-18px" />
                                </IconButton>
                            </div>
                        </div>
                        {totalFrames > 0 && (
                            <div className="vstSweepTimeline">
                                <Slider
                                    value={sweepPlayIndex}
                                    onValueChange={handleTimelineScrub}
                                    min={0}
                                    max={Math.max(totalFrames - 1, 1)}
                                    step={1}
                                />
                            </div>
                        )}
                        <div className="vstSweepFrameLabel">
                            <span id="vstSweepFrameLabel" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
