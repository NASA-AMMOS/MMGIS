import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import { IconButton, InputWithUnit, ProgressButton, Slider } from '../../../../design-system/components'

const SPEED_NORMAL = 500
const SPEED_FAST = 150

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
    const sweepPlaySpeed = useShadeStore((s) => s.sweepPlaySpeed)
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const sweepGrids = useShadeStore((s) => s.sweepGrids)
    const setSweepField = useShadeStore((s) => s.setSweepField)

    const totalFrames = useMemo(
        () => (sweepGrids ? sweepGrids.length : 0),
        [sweepGrids]
    )

    const [expanded, setExpanded] = useState(false)

    // Sync sweep start/end with TimeUI on mount and on time changes
    useEffect(() => {
        function syncFromTimeUI() {
            const mode = getTimeUIMode()
            const currentTime = TimeControl.getTime()
            const startTime = TimeControl.getStartTime()
            const endTime = TimeControl.getEndTime()

            if (mode === 'Point') {
                // Point mode: only update start time with current time
                if (currentTime) setSweepField('sweepStart', currentTime)
            } else {
                // Range mode: start = startTime, end = endTime
                if (startTime) setSweepField('sweepStart', startTime)
                if (endTime) setSweepField('sweepEnd', endTime)
            }
        }

        // Initial sync
        syncFromTimeUI()

        // Subscribe to time changes
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
        ShadeTool.sweepShowFrame(useShadeStore.getState().activeElmId)
    }, [setSweepField])

    return (
        <div className="vstSweepSection">
            <div
                className="vstSweepHeader"
                onClick={() => setExpanded(!expanded)}
            >
                <i
                    className={`mdi mdi-12px ${
                        expanded ? 'mdi-chevron-down' : 'mdi-chevron-right'
                    }`}
                />
                <span>Time-Range Sweep</span>
                {sweepProgress && (
                    <span className="vstSweepProgress">{sweepProgress}</span>
                )}
            </div>
            {expanded && (
                <div className="vstSweepBody">
                    {/* Start time — own row */}
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
                    {/* End time — own row */}
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
                    {/* Step row */}
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
                    {/* Full-width Sweep button */}
                    <ProgressButton
                        active={!!(sweepStart && sweepEnd && sweepStep) && (!sweepProgress || sweepProgress.startsWith('Done'))}
                        loading={!!sweepProgress && !sweepProgress.startsWith('Done')}
                        progress={sweepProgressPct || 0}
                        onClick={handleSweep}
                        className="vstSweepButton"
                    >
                        Sweep
                    </ProgressButton>
                    {/* Playback controls container */}
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
                </div>
            )}
        </div>
    )
}
