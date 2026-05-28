import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'
import SweepCard from './SweepCard'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import { IconButton, InputWithUnit, ProgressButton, RadioGroup, Slider } from '../../../../design-system/components'

const SPEED_NORMAL = 500
const SPEED_FAST = 150

const VIEW_MODE_OPTIONS = [
    { label: 'Composite', value: 'composite' },
    { label: 'Playback', value: 'playback' },
]

function getTimeUIMode() {
    if (!TimeUI.modes) return 'Range'
    return TimeUI.modes[TimeUI.modeIndex] || 'Range'
}

export default function SweepSection() {
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const sweepProgress = useShadeStore((s) => s.sweepProgress)
    const sweepProgressPct = useShadeStore((s) => s.sweepProgressPct)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const sweepViewMode = useShadeStore((s) => s.sweepViewMode)
    const sweepStale = useShadeStore((s) => s.sweepStale)
    const sweepElData = useShadeStore((s) => s.sweepElData)
    const sweepCardOrder = useShadeStore((s) => s.sweepCardOrder)
    const elements = useShadeStore((s) => s.elements)
    const setSweepField = useShadeStore((s) => s.setSweepField)
    const setSweepCardOrder = useShadeStore((s) => s.setSweepCardOrder)

    const dragItemRef = useRef(null)

    const totalFrames = useMemo(() => {
        for (const id in sweepElData) {
            if (sweepElData[id]?.grids?.length > 0) return sweepElData[id].grids.length
        }
        return 0
    }, [sweepElData])

    const hasSweepData = useMemo(() => {
        return !sweepStale && Object.keys(sweepElData).some((id) => sweepElData[id]?.heatmap != null)
    }, [sweepElData, sweepStale])

    // Card IDs: only elements that have sweep data, in the user's chosen order
    const cardIds = useMemo(() => {
        const withData = new Set(
            Object.keys(sweepElData)
                .filter((id) => sweepElData[id]?.heatmap != null || sweepElData[id]?.grids?.length > 0)
                .map(Number)
        )
        // Preserve order, filter to those with data
        const ordered = (sweepCardOrder || []).filter((id) => withData.has(id))
        // Add any missing (newly swept) at the end
        withData.forEach((id) => {
            if (!ordered.includes(id)) ordered.push(id)
        })
        return ordered
    }, [sweepElData, sweepCardOrder])

    useEffect(() => {
        function syncFromTimeUI() {
            const mode = getTimeUIMode()
            const currentTime = TimeControl.getTime()
            const startTime = TimeControl.getStartTime()
            const endTime = TimeControl.getEndTime()

            if (mode === 'Point') {
                if (currentTime) setSweepField('sweepStart', currentTime)
            } else {
                if (startTime) setSweepField('sweepStart', startTime)
                if (endTime) setSweepField('sweepEnd', endTime)
            }
        }

        syncFromTimeUI()

        TimeControl.subscribe('ShadeTool_Sweep', (t) => {
            const mode = getTimeUIMode()
            if (mode === 'Point') {
                if (t.currentTime) setSweepField('sweepStart', t.currentTime)
            } else {
                if (t.startTime) setSweepField('sweepStart', t.startTime)
                if (t.endTime) setSweepField('sweepEnd', t.endTime)
            }
        })

        return () => {
            TimeControl.unsubscribe('ShadeTool_Sweep')
        }
    }, [setSweepField])

    const handleSweep = useCallback(() => {
        if (!sweepStart || !sweepEnd || !sweepStep) return
        ShadeTool.shadeSweepAll(sweepStart, sweepEnd, sweepStep)
    }, [sweepStart, sweepEnd, sweepStep])

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

    const handleViewModeChange = useCallback((mode) => {
        const store = useShadeStore.getState()
        if (mode === 'playback') {
            ShadeTool.sweepShowAllFrames()
        } else {
            ShadeTool.sweepShowComposite(store.activeElmId)
        }
    }, [])

    // Drag-to-reorder handlers
    const handleDragStart = useCallback((e, elmId) => {
        dragItemRef.current = elmId
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }, [])

    const handleDrop = useCallback((e, targetId) => {
        e.preventDefault()
        const draggedId = dragItemRef.current
        if (draggedId == null || draggedId === targetId) return
        const order = [...(useShadeStore.getState().sweepCardOrder || [])]
        const fromIdx = order.indexOf(draggedId)
        const toIdx = order.indexOf(targetId)
        if (fromIdx < 0 || toIdx < 0) return
        order.splice(fromIdx, 1)
        order.splice(toIdx, 0, draggedId)
        setSweepCardOrder(order)
        ShadeTool.reorderSweepLayers(order)
        dragItemRef.current = null
    }, [setSweepCardOrder])

    return (
        <div className="vstSweepSection">
            <div className="vstSweepBody">
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Start Time</div>
                    <input
                        type="text"
                        className="vstSweepInput"
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        value={sweepStart}
                        onChange={(e) =>
                            setSweepField('sweepStart', e.target.value)
                        }
                    />
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">End Time</div>
                    <input
                        type="text"
                        className="vstSweepInput"
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        value={sweepEnd}
                        onChange={(e) =>
                            setSweepField('sweepEnd', e.target.value)
                        }
                    />
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Step Size</div>
                    <InputWithUnit
                        unit="min"
                        type="number"
                        min="1"
                        step="1"
                        value={sweepStep}
                        onChange={(e) =>
                            setSweepField(
                                'sweepStep',
                                parseFloat(e.target.value)
                            )
                        }
                        className="vstSweepField"
                    />
                </div>
                <ProgressButton
                    active={!!(sweepStart && sweepEnd && sweepStep) && (!sweepProgress || sweepProgress.startsWith('Done'))}
                    loading={!!sweepProgress && !sweepProgress.startsWith('Done')}
                    progress={sweepProgressPct || 0}
                    onClick={handleSweep}
                    className="vstSweepButton"
                >
                    Sweep
                </ProgressButton>
                {sweepProgress && (
                    <div className="vstSweepProgressLabel">{sweepProgress}</div>
                )}

                {sweepStale && Object.keys(sweepElData).some((id) => sweepElData[id]?.heatmap) && (
                    <div className="vstSweepStaleMsg">
                        <i className="mdi mdi-alert-outline mdi-14px" />
                        <span>Viewport changed — re-run sweep to update results</span>
                    </div>
                )}

                {/* View mode toggle (only after sweep data exists) */}
                {hasSweepData && (
                    <div className="vstSweepViewRow">
                        <div className="vstOptionLabel">View</div>
                        <RadioGroup
                            value={sweepViewMode}
                            onValueChange={handleViewModeChange}
                            options={VIEW_MODE_OPTIONS}
                        />
                    </div>
                )}

                {/* Per-element sweep cards */}
                {hasSweepData && cardIds.length > 0 && (
                    <div className="vstSweepCards">
                        {cardIds.map((id) => (
                            <SweepCard
                                key={id}
                                elmId={id}
                                mode={sweepViewMode}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            />
                        ))}
                    </div>
                )}

                {/* Playback controls (only in playback mode) */}
                {hasSweepData && sweepViewMode === 'playback' && (
                    <div className="vstSweepControlsWrap">
                        <div className="vstSweepPlaybarRow">
                            <div className="vstSweepPlaybar">
                                <IconButton
                                    size="sm"
                                    title="Step back"
                                    onClick={() => ShadeTool.sweepStepBack()}
                                >
                                    <i className="mdi mdi-skip-previous mdi-14px" />
                                </IconButton>
                                {sweepPlaying ? (
                                    <IconButton
                                        size="sm"
                                        title="Pause"
                                        onClick={handlePause}
                                    >
                                        <i className="mdi mdi-pause mdi-14px" />
                                    </IconButton>
                                ) : (
                                    <>
                                        <IconButton
                                            size="sm"
                                            title="Play"
                                            onClick={handlePlayNormal}
                                        >
                                            <i className="mdi mdi-play mdi-14px" />
                                        </IconButton>
                                        <IconButton
                                            size="sm"
                                            title="Play fast"
                                            onClick={handlePlayFast}
                                        >
                                            <i className="mdi mdi-fast-forward mdi-14px" />
                                        </IconButton>
                                    </>
                                )}
                                <IconButton
                                    size="sm"
                                    title="Step forward"
                                    onClick={() => ShadeTool.sweepStepForward()}
                                >
                                    <i className="mdi mdi-skip-next mdi-14px" />
                                </IconButton>
                            </div>
                            <div className="vstSweepFrameLabel">
                                <span id="vstSweepFrameLabel" />
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
                    </div>
                )}
            </div>
        </div>
    )
}
