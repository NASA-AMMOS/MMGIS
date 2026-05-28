import React, { useCallback, useEffect, useState } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import { Button, IconButton, Slider } from '../../../../design-system/components'

function getTimeUIMode() {
    if (!TimeUI.modes) return 'Range'
    return TimeUI.modes[TimeUI.modeIndex] || 'Range'
}

export default function SweepSection() {
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const sweepProgress = useShadeStore((s) => s.sweepProgress)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepPlaySpeed = useShadeStore((s) => s.sweepPlaySpeed)
    const setSweepField = useShadeStore((s) => s.setSweepField)

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
                    <div className="vstSweepTimeRowSingle">
                        <label className="vstSweepTimeLabel">Start</label>
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="Start time"
                            value={sweepStart}
                            onChange={(e) =>
                                setSweepField('sweepStart', e.target.value)
                            }
                            title="Start time (YYYY-MM-DDTHH:MM:SSZ)"
                        />
                    </div>
                    {/* End time — own row */}
                    <div className="vstSweepTimeRowSingle">
                        <label className="vstSweepTimeLabel">End</label>
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="End time"
                            value={sweepEnd}
                            onChange={(e) =>
                                setSweepField('sweepEnd', e.target.value)
                            }
                            title="End time (YYYY-MM-DDTHH:MM:SSZ)"
                        />
                    </div>
                    {/* Step row */}
                    <div className="vstSweepStepRow">
                        <div className="vstSweepStepLabel">Step</div>
                        <input
                            type="number"
                            className="vstSweepStepInput"
                            value={sweepStep}
                            min="1"
                            step="1"
                            onChange={(e) =>
                                setSweepField(
                                    'sweepStep',
                                    parseFloat(e.target.value)
                                )
                            }
                        />
                        <span className="vstSweepStepUnit">min</span>
                    </div>
                    {/* Full-width Sweep button */}
                    <Button
                        variant="primary"
                        size="md"
                        className="vstSweepButton"
                        onClick={handleSweep}
                        title="Run time-range sweep on all active shade maps"
                    >
                        Sweep
                    </Button>
                    {/* Full-width timeline playbar */}
                    <div className="vstSweepPlaybar">
                        <IconButton
                            size="sm"
                            title="Step back"
                            onClick={() => ShadeTool.sweepStepBack()}
                        >
                            <i className="mdi mdi-skip-previous mdi-14px" />
                        </IconButton>
                        <IconButton
                            size="sm"
                            title="Play/Pause"
                            onClick={() => ShadeTool.sweepPlay()}
                        >
                            <i
                                className={`mdi mdi-14px ${
                                    sweepPlaying ? 'mdi-pause' : 'mdi-play'
                                }`}
                            />
                        </IconButton>
                        <IconButton
                            size="sm"
                            title="Step forward"
                            onClick={() => ShadeTool.sweepStepForward()}
                        >
                            <i className="mdi mdi-skip-next mdi-14px" />
                        </IconButton>
                        <div className="vstSweepSpeedWrap">
                            <Slider
                                value={sweepPlaySpeed}
                                onValueChange={(v) => {
                                    setSweepField('sweepPlaySpeed', v)
                                    ShadeTool.updateSweepSpeed(v)
                                }}
                                min={100}
                                max={2000}
                                step={100}
                            />
                        </div>
                    </div>
                    {/* Full-width timeline indicator */}
                    <div className="vstSweepIndicator">
                        <span
                            id="vstSweepFrameLabel"
                            className="vstSweepFrameLabel"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
