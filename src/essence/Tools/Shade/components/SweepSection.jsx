import React, { useCallback } from 'react'
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

    const handleSweep = useCallback(() => {
        if (!sweepStart || !sweepEnd || !sweepStep) return
        ShadeTool.shadeSweepAll(sweepStart, sweepEnd, sweepStep)
    }, [sweepStart, sweepEnd, sweepStep])

    return (
        <div className="vstSweepSection">
            <div className="vstSectionLabel">Time-Range Sweep</div>
            <div className="vstOptionRow">
                <div className="vstOptionLabel">Start</div>
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
                <div className="vstOptionLabel">End</div>
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
                <div className="vstOptionLabel">Step (min)</div>
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
            </div>
            <div className="vstSweepControls">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSweep}
                    title="Run time-range sweep on all active shade maps"
                >
                    <i className="mdi mdi-play-box-outline mdi-12px" /> Sweep All
                </Button>
                <span className="vstSweepProgress">{sweepProgress}</span>
            </div>
            <div className="vstSweepPlayback">
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
    )
}
