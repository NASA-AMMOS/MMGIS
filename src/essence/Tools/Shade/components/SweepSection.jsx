import React, { useCallback, useState } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'
import { Button, IconButton, Slider } from '../../../../design-system/components'

export default function SweepSection() {
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const sweepProgress = useShadeStore((s) => s.sweepProgress)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepPlaySpeed = useShadeStore((s) => s.sweepPlaySpeed)
    const setSweepField = useShadeStore((s) => s.setSweepField)

    const [expanded, setExpanded] = useState(false)

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
                    <div className="vstSweepTimeRow">
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="Start"
                            value={sweepStart}
                            onChange={(e) =>
                                setSweepField('sweepStart', e.target.value)
                            }
                            title="Start time (YYYY-MM-DDTHH:MM:SSZ)"
                        />
                        <input
                            type="text"
                            className="vstSweepInput"
                            placeholder="End"
                            value={sweepEnd}
                            onChange={(e) =>
                                setSweepField('sweepEnd', e.target.value)
                            }
                            title="End time (YYYY-MM-DDTHH:MM:SSZ)"
                        />
                    </div>
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
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSweep}
                            title="Run time-range sweep on all active shade maps"
                        >
                            Sweep
                        </Button>
                    </div>
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
                        <span id="vstSweepFrameLabel" className="vstSweepFrameLabel" />
                    </div>
                </div>
            )}
        </div>
    )
}
