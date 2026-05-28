import React, { useCallback, useEffect, useMemo } from 'react'
import useShadeStore from '../store'
import ShadeTool from '../ShadeTool'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import { ColorRampPicker, IconButton, InputWithUnit, ProgressButton, RadioGroup, Slider } from '../../../../design-system/components'

const SPEED_NORMAL = 500
const SPEED_FAST = 150

const VIEW_MODE_OPTIONS = [
    { label: 'Composite', value: 'composite' },
    { label: 'Playback', value: 'playback' },
]

const COLOR_MODE_OPTIONS = [
    { label: 'Continuous', value: 'continuous' },
    { label: 'Discrete', value: 'discrete' },
]

function getTimeUIMode() {
    if (!TimeUI.modes) return 'Range'
    return TimeUI.modes[TimeUI.modeIndex] || 'Range'
}

function HeatmapLegend({ rampName, discrete }) {
    const hoverFrac = useShadeStore((s) => s.hoverFrac)
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
    const showIndicator = hoverFrac != null && Number.isFinite(hoverFrac) && hoverFrac >= 0
    const indicatorPct = showIndicator ? hoverFrac * 100 : 0
    return (
        <div className="vstSweepLegend">
            <div className="vstSweepLegendBarWrap">
                <div className="vstSweepLegendBar" style={{
                    background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
                }} />
                {showIndicator && (
                    <div className="vstSweepLegendIndicator" style={{ left: `${indicatorPct}%` }}>
                        <div className="vstSweepLegendIndicatorLine" />
                        <div className="vstSweepLegendIndicatorLabel">{(hoverFrac * 100).toFixed(1)}%</div>
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

export default function SweepSection() {
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const sweepProgress = useShadeStore((s) => s.sweepProgress)
    const sweepProgressPct = useShadeStore((s) => s.sweepProgressPct)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const sweepViewMode = useShadeStore((s) => s.sweepViewMode)
    const sweepColorRamp = useShadeStore((s) => s.sweepColorRamp)
    const sweepDiscrete = useShadeStore((s) => s.sweepDiscrete)
    const sweepStale = useShadeStore((s) => s.sweepStale)
    const sweepElData = useShadeStore((s) => s.sweepElData)
    const elements = useShadeStore((s) => s.elements)
    const setSweepField = useShadeStore((s) => s.setSweepField)
    const setSweepElField = useShadeStore((s) => s.setSweepElField)

    const totalFrames = useMemo(() => {
        for (const id in sweepElData) {
            if (sweepElData[id]?.grids?.length > 0) return sweepElData[id].grids.length
        }
        return 0
    }, [sweepElData])

    const hasSweepData = useMemo(() => {
        return !sweepStale && Object.keys(sweepElData).some((id) => sweepElData[id]?.heatmap != null)
    }, [sweepElData, sweepStale])

    

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

    const handleColorRampChange = useCallback((value) => {
        setSweepField('sweepColorRamp', value)
        setTimeout(() => {
            ShadeTool.refreshAllHeatmaps()
        }, 0)
    }, [setSweepField])

    const handleColorModeChange = useCallback((mode) => {
        const isDiscrete = mode === 'discrete'
        setSweepField('sweepDiscrete', isDiscrete)
        setTimeout(() => {
            ShadeTool.refreshAllHeatmaps()
        }, 0)
    }, [setSweepField])

    const handleOpacityChange = useCallback((elmId, val) => {
        setSweepElField(elmId, 'opacity', val)
        ShadeTool.applySweepOpacity(elmId)
    }, [setSweepElField])

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

                    {/* Composite settings (only in composite mode) */}
                    {hasSweepData && sweepViewMode === 'composite' && (
                        <div className="vstSweepCompositeSettings">
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel">Color Ramp</div>
                                <ColorRampPicker
                                    value={sweepColorRamp}
                                    onValueChange={handleColorRampChange}
                                    ramps={ShadeTool.getSweepColorRamps()}
                                />
                            </div>
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel">Mode</div>
                                <RadioGroup
                                    value={sweepDiscrete ? 'discrete' : 'continuous'}
                                    onValueChange={handleColorModeChange}
                                    options={COLOR_MODE_OPTIONS}
                                />
                            </div>
                            {Object.keys(sweepElData).filter((id) => sweepElData[id]?.heatmap).map((id) => {
                                const ed = sweepElData[id]
                                const elName = elements[id]?.name || `Shade ${id}`
                                const opacity = ed?.opacity != null ? ed.opacity : 1
                                return (
                                    <div className="vstOptionRow" key={id}>
                                        <div className="vstOptionLabel">{elName} Opacity</div>
                                        <div className="vstOpacitySlider">
                                            <Slider
                                                value={opacity}
                                                onValueChange={(val) => handleOpacityChange(parseInt(id), val)}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                            />
                                            <span className="vstOpacityValue">{Math.round(opacity * 100)}%</span>
                                        </div>
                                    </div>
                                )
                            })}
                            <HeatmapLegend rampName={sweepColorRamp} discrete={sweepDiscrete} />
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
                            {Object.keys(sweepElData).filter((id) => sweepElData[id]?.grids?.length > 0).map((id) => {
                                const ed = sweepElData[id]
                                const elName = elements[id]?.name || `Shade ${id}`
                                const opacity = ed?.opacity != null ? ed.opacity : 1
                                return (
                                    <div className="vstOptionRow" key={id}>
                                        <div className="vstOptionLabel">{elName} Opacity</div>
                                        <div className="vstOpacitySlider">
                                            <Slider
                                                value={opacity}
                                                onValueChange={(val) => handleOpacityChange(parseInt(id), val)}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                            />
                                            <span className="vstOpacityValue">{Math.round(opacity * 100)}%</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
