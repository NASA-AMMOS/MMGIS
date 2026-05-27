import React, { useCallback } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'

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
        ShadeTool.shadeSweep(sweepStart, sweepEnd, sweepStep)
    }, [sweepStart, sweepEnd, sweepStep])

    return (
        <div id="vstSweepSection">
            <div className="vstOptionHeading">Time-Range Sweep</div>
            <div className="vstSweepRow">
                <div>Start</div>
                <input
                    type="text"
                    placeholder="YYYY-MM-DDTHH:MM:SSZ"
                    value={sweepStart}
                    onChange={(e) =>
                        setSweepField('sweepStart', e.target.value)
                    }
                />
            </div>
            <div className="vstSweepRow">
                <div>End</div>
                <input
                    type="text"
                    placeholder="YYYY-MM-DDTHH:MM:SSZ"
                    value={sweepEnd}
                    onChange={(e) =>
                        setSweepField('sweepEnd', e.target.value)
                    }
                />
            </div>
            <div className="vstSweepRow">
                <div>Step (min)</div>
                <input
                    type="number"
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
                <div
                    className="vstSweepBtn"
                    title="Run time-range sweep"
                    onClick={handleSweep}
                >
                    <i className="mdi mdi-play-box-outline mdi-14px" /> Sweep
                </div>
                <span id="vstSweepProgress">{sweepProgress}</span>
            </div>
            <div className="vstSweepPlayback">
                <div
                    id="vstSweepStepBack"
                    title="Step back"
                    onClick={() => ShadeTool.sweepStepBack()}
                >
                    <i className="mdi mdi-skip-previous mdi-18px" />
                </div>
                <div
                    id="vstSweepPlayBtn"
                    title="Play/Pause"
                    onClick={() => ShadeTool.sweepPlay()}
                >
                    <i
                        className={
                            'mdi mdi-14px ' +
                            (sweepPlaying ? 'mdi-pause' : 'mdi-play')
                        }
                    />
                </div>
                <div
                    id="vstSweepStepFwd"
                    title="Step forward"
                    onClick={() => ShadeTool.sweepStepForward()}
                >
                    <i className="mdi mdi-skip-next mdi-18px" />
                </div>
                <input
                    type="range"
                    id="vstSweepSpeed"
                    min="100"
                    max="2000"
                    step="100"
                    value={sweepPlaySpeed}
                    onChange={(e) => {
                        const speed = parseInt(e.target.value)
                        setSweepField('sweepPlaySpeed', speed)
                        ShadeTool.updateSweepSpeed(speed)
                    }}
                />
                <span id="vstSweepFrameLabel" />
            </div>
        </div>
    )
}
