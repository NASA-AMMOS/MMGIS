import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSightlineStore, { buildSourcesList, buildDemsList, MULTI_SOURCE_COLORS } from '../store'
import SightlineResults from './SightlineResults'
import CardLegend, { getDefaultStops } from './CardLegend'
import SightlineTool from '../SightlineTool'
import SightlineTool_Graphs from '../SightlineTool_Graphs'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import {
    Checkbox,
    Collapsible,
    ColorRampPicker,
    IconButton,
    IconTextButton,
    InputWithUnit,
    ProgressButton,
    Select,
    Slider,
    Tabs,
    Tooltip,
} from '@design/components'

function rgbStr(c) {
    return `rgb(${c.r},${c.g},${c.b})`
}

const MODE_TABS = [
    { value: 'static', label: 'Static' },
    { value: 'composite', label: 'Composite' },
    { value: 'playback', label: 'Playback' },
]

const COLOR_MODE_OPTIONS = [
    { label: 'Continuous', value: 'continuous' },
    { label: 'Discrete', value: 'discrete' },
]

const FIT_MODE_OPTIONS = [
    { label: 'Absolute (0–100%)', value: 'absolute' },
    { label: 'Fit to data', value: 'fit' },
]

// Resolution scale relative to the viewport DEM extent. Lower = faster, coarser.
const RESOLUTION_OPTIONS = [
    { value: '1', label: '1×' },
    { value: '0.5', label: '0.5×' },
    { value: '0.25', label: '0.25× (Default)' },
    { value: '0.125', label: '0.125×' },
]

// Format a meters-per-pixel value for display.
function fmtMpp(m) {
    if (!Number.isFinite(m)) return ''
    if (m >= 100) return Math.round(m) + ' m/px'
    if (m >= 10) return m.toFixed(1) + ' m/px'
    if (m >= 1) return m.toFixed(2) + ' m/px'
    return m.toFixed(3) + ' m/px'
}

const EXPORT_OPTIONS_STATIC = [
    { value: 'png', label: 'Sightline Map (PNG)' },
    { value: 'csv', label: 'Results (CSV)' },
    { value: 'grid', label: 'Sightline Grid (TXT)' },
]
const EXPORT_OPTIONS_PLAYBACK = [
    { value: 'png', label: 'Sightline Map (GIF)' },
]

export default function SightlineElement({ elmId, onDragStart, onDragOver, onDragEnd, onDrop, isDropTarget, dropPosition }) {
    const el = useSightlineStore((s) => s.elements[elmId])
    const vars = useSightlineStore((s) => s.vars)
    const updateElement = useSightlineStore((s) => s.updateElement)
    const removeElement = useSightlineStore((s) => s.removeElement)
    const setActiveElmId = useSightlineStore((s) => s.setActiveElmId)
    const ed = useSightlineStore((s) => s.sweepElData[elmId])
    const sweepPlayIndex = useSightlineStore((s) => s.sweepPlayIndex)
    const sweepPlaying = useSightlineStore((s) => s.sweepPlaying)
    const sweepDiscrete = useSightlineStore((s) => s.sweepDiscrete)
    const sweepFitToData = useSightlineStore((s) => s.sweepFitToData)
    const setSweepElField = useSightlineStore((s) => s.setSweepElField)
    const setSweepField = useSightlineStore((s) => s.setSweepField)
    const sweepStart = useSightlineStore((s) => s.sweepStart)
    const sweepEnd = useSightlineStore((s) => s.sweepEnd)
    const exportProgress = useSightlineStore((s) => s.exportProgress)

    const sourcesList = useMemo(() => buildSourcesList(vars), [vars])

    const sourceOptions = useMemo(
        () =>
            sourcesList.map((s, i) => ({
                value: String(i),
                label: s.name,
            })),
        [sourcesList]
    )

    // Selectable DEMs (multi-DEM list, or the legacy single dem).
    const demsList = useMemo(() => buildDemsList(vars), [vars])
    const demOptions = useMemo(
        () => demsList.map((d, i) => ({ value: String(i), label: d.name })),
        [demsList]
    )
    const demIndex = el?.demIndex != null ? el.demIndex : 0

    // The selected DEM's native (dataset) resolution in meters-per-pixel:
    // config-provided value, else the value resolved from the backend.
    const nativeMpp = useMemo(() => {
        const dem = demsList[demIndex] || demsList[0]
        if (dem && Number.isFinite(dem.resolution) && dem.resolution > 0)
            return dem.resolution
        if (Number.isFinite(el?.nativeResolution) && el.nativeResolution > 0)
            return el.nativeResolution
        return null
    }, [demsList, demIndex, el?.nativeResolution])

    // Resolve the selected DEM's native resolution from the backend so it can
    // be shown to the user and used to cap the effective resolution.
    useEffect(() => {
        if (demsList.length === 0) return
        SightlineTool.fetchElementDemInfo(elmId)
    }, [elmId, demIndex, demsList])

    // Re-render the effective-resolution readout when the map viewport changes.
    const [viewportTick, setViewportTick] = useState(0)
    useEffect(() => {
        const map = Map_?.map
        if (!map) return
        const bump = () => setViewportTick((t) => t + 1)
        map.on('zoomend', bump)
        map.on('moveend', bump)
        return () => {
            map.off('zoomend', bump)
            map.off('moveend', bump)
        }
    }, [])

    // Effective working resolution (meters-per-pixel) for the current selection
    // and viewport: viewport ground extent / output grid dimension.
    // el.resolution, nativeMpp and viewportTick are intentional recompute triggers.
    const effectiveMpp = useMemo(
        () => SightlineTool.getEffectiveResolutionMpp(elmId),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [elmId, el?.resolution, nativeMpp, viewportTick]
    )

    const observerOptions = useMemo(
        () =>
            (vars?.observers || []).map((o) => ({
                value: o.value,
                label: o.name,
            })),
        [vars]
    )

    const sightlineMode = el?.sightlineMode || 'static'

    const handleToggle = useCallback(() => {
        const newOn = !el?.on
        updateElement(elmId, { on: newOn })
        SightlineTool.toggleElementVisibility(elmId, newOn)
    }, [elmId, el?.on, updateElement])

    const handleChange = useCallback(
        (field, value) => {
            updateElement(elmId, { [field]: value, changed: true, lastError: false })
        },
        [elmId, updateElement]
    )

    const handleModeChange = useCallback((mode) => {
        SightlineTool.switchElementMode(elmId, mode)
        updateElement(elmId, { sightlineMode: mode })
        // Keep results open if sweep data exists (switching modes shouldn't collapse)
        const ed = useSightlineStore.getState().sweepElData[elmId]
        if (!ed?.grids?.length && !ed?.heatmap) {
            setResultsOpen(false)
        }
    }, [elmId, updateElement])

    const handleOpacityChange = useCallback(
        (value) => {
            updateElement(elmId, { opacity: value })
            const layerName = 'sightline' + elmId
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setOpacity === 'function') {
                layer.setOpacity(value)
            }
        },
        [elmId, updateElement]
    )

    // Auto-generate when settings change (static mode only)
    useEffect(() => {
        if (sightlineMode !== 'static') return
        if (!el?.changed || el?.regenerating || el?.lastError) return
        const timer = setTimeout(() => {
            setActiveElmId(elmId)
            SightlineTool.sightline(null, elmId)
        }, 300)
        return () => clearTimeout(timer)
    }, [elmId, el?.changed, el?.regenerating, el?.lastError, sightlineMode, setActiveElmId])

    const handleGenerate = useCallback(() => {
        if (el?.regenerating) return
        if (sightlineMode === 'static') {
            if (!el?.changed) return
            setActiveElmId(elmId)
            SightlineTool.sightline(null, elmId)
        } else {
            setActiveElmId(elmId)
            SightlineTool.sightlineSweepElement(elmId)
        }
    }, [elmId, el?.changed, el?.regenerating, sightlineMode, setActiveElmId])

    const handleDelete = useCallback(() => {
        SightlineTool.deleteElement(elmId)
    }, [elmId])

    const cardRef = useRef(null)
    const handleRef = useRef(null)
    const isDraggingRef = useRef(false)

    const [sourceOpen, setSourceOpen] = useState(false)
    const [displayOpen, setDisplayOpen] = useState(false)
    const [resultsOpen, setResultsOpen] = useState(sightlineMode === 'static')

    const [colorPickerOpen, setColorPickerOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState('png')
    useEffect(() => { setExportFormat('png') }, [sightlineMode])
    const [obsStartTime, setObsStartTime] = useState('')
    const [obsEndTime, setObsEndTime] = useState('')
    const colorPickerRef = useRef(null)

    // Close color picker on outside click
    useEffect(() => {
        if (!colorPickerOpen) return
        const handleOutsideClick = (e) => {
            if (
                colorPickerRef.current &&
                !colorPickerRef.current.contains(e.target)
            ) {
                setColorPickerOpen(false)
            }
        }
        document.addEventListener('mousedown', handleOutsideClick, true)
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick, true)
        }
    }, [colorPickerOpen])

    // Convert UTC sweep times to observer-local times when they change
    const observer = el?.observer
    useEffect(() => {
        if (!observer || !observerOptions.length) return
        if (sweepStart) {
            SightlineTool.convertUTCToObserver(sweepStart, observer, (result) => {
                setObsStartTime(result || sweepStart)
            })
        }
        if (sweepEnd) {
            SightlineTool.convertUTCToObserver(sweepEnd, observer, (result) => {
                setObsEndTime(result || sweepEnd)
            })
        }
    }, [sweepStart, sweepEnd, observer, observerOptions.length])

    const handleObsStartBlur = useCallback(() => {
        if (!obsStartTime || !observer) return
        SightlineTool.convertObserverToUTC(obsStartTime, observer, (result) => {
            if (result) {
                // Save ms for exact round-trip, then strip for TimeControl
                SightlineTool._lastConvertedMs = (result.split('.')[1] || '000').replace(/[^0-9]/g, '') || '000'
                const utc = (result.replace(' ', 'T').replace(/\.\d+$/, '') + 'Z').replace(/ZZ$/, 'Z')
                SightlineTool.applySweepStartTime(utc)
            }
        })
    }, [obsStartTime, observer])

    const handleObsEndBlur = useCallback(() => {
        if (!obsEndTime || !observer) return
        SightlineTool.convertObserverToUTC(obsEndTime, observer, (result) => {
            if (result) {
                // Save ms for exact round-trip, then strip for TimeControl
                SightlineTool._lastConvertedMs = (result.split('.')[1] || '000').replace(/[^0-9]/g, '') || '000'
                const utc = (result.replace(' ', 'T').replace(/\.\d+$/, '') + 'Z').replace(/ZZ$/, 'Z')
                SightlineTool.applySweepEndTime(utc)
            }
        })
    }, [obsEndTime, observer])

    const handleColorSelect = useCallback(
        (color) => {
            updateElement(elmId, { color: { ...color }, changed: true, lastError: false })
            setColorPickerOpen(false)
            setTimeout(() => {
                const ed2 = useSightlineStore.getState().sweepElData[elmId]
                if (ed2?.heatmap && ed2?.lastData) {
                    SightlineTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
                }
            }, 0)
        },
        [elmId, updateElement]
    )

    const handleHandleMouseDown = useCallback(() => {
        isDraggingRef.current = true
    }, [])

    const handleCardDragStart = useCallback((e) => {
        if (!isDraggingRef.current) {
            e.preventDefault()
            return
        }
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect()
            e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, 10)
        }
        e.dataTransfer.effectAllowed = 'move'
        if (onDragStart) onDragStart(e, elmId)
    }, [elmId, onDragStart])

    const handleCardDragEnd = useCallback(() => {
        isDraggingRef.current = false
        if (onDragEnd) onDragEnd()
    }, [onDragEnd])

    // Sweep card handlers
    const sweepOpacity = ed?.opacity != null ? ed.opacity : (el?.opacity != null ? el.opacity : 1)
    const sweepColorRamp = ed?.colorRamp || 'sightline'
    const discrete = sweepDiscrete || false

    const handleSweepOpacityChange = useCallback((val) => {
        setSweepElField(elmId, 'opacity', val)
        SightlineTool.applySweepOpacity(elmId)
    }, [elmId, setSweepElField])

    const handleColorRampChange = useCallback((value) => {
        setSweepElField(elmId, 'colorRamp', value)
        setTimeout(() => {
            const ed2 = useSightlineStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                SightlineTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField])

    const SPEED_NORMAL = 500
    const SPEED_FAST = 150

    const handlePlayNormal = useCallback(() => {
        setSweepField('sweepPlaySpeed', SPEED_NORMAL)
        SightlineTool.updateSweepSpeed(SPEED_NORMAL)
        if (!useSightlineStore.getState().sweepPlaying) SightlineTool.sweepPlay()
    }, [setSweepField])

    const handlePlayFast = useCallback(() => {
        setSweepField('sweepPlaySpeed', SPEED_FAST)
        SightlineTool.updateSweepSpeed(SPEED_FAST)
        if (!useSightlineStore.getState().sweepPlaying) SightlineTool.sweepPlay()
    }, [setSweepField])

    const handlePause = useCallback(() => {
        if (useSightlineStore.getState().sweepPlaying) SightlineTool.sweepPlay()
    }, [])

    const effectivePlayIndex = sweepPlayIndex

    const handleTimelineScrub = useCallback((v) => {
        setSweepField('sweepPlayIndex', v)
        SightlineTool.sweepShowAllFrames()
    }, [setSweepField])

    const handleExport = useCallback((id, format) => {
        try {
            switch (format) {
                case 'png': SightlineTool.exportPNG(id); break
                case 'csv': SightlineTool.exportCSV(id); break
                case 'grid': SightlineTool.exportGrid(id); break
                default: SightlineTool.exportPNG(id); break
            }
        } catch (e) {
            console.error('Export failed:', e)
        }
    }, [])

    const handleDiscreteChange = useCallback((val) => {
        setSweepField('sweepDiscrete', val === 'discrete')
        setTimeout(() => SightlineTool.refreshHeatmap(), 0)
    }, [setSweepField])

    const handleFitModeChange = useCallback((val) => {
        setSweepField('sweepFitToData', val === 'fit')
        setTimeout(() => SightlineTool.refreshHeatmap(), 0)
    }, [setSweepField])

    const handleColorStopsChange = useCallback((newStops) => {
        setSweepElField(elmId, 'colorStops', newStops)
        setTimeout(() => {
            const ed2 = useSightlineStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                SightlineTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField])

    const handleColorStopsReset = useCallback(() => {
        const allRamps = SightlineTool.getSweepColorRamps(el?.color)
        const rampDef = allRamps.find((r) => r.name === (ed?.colorRamp || 'sightline')) || allRamps[0]
        const bins = rampDef.bins || rampDef.colors.length
        setSweepElField(elmId, 'colorStops', getDefaultStops(bins))
        setTimeout(() => {
            const ed2 = useSightlineStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                SightlineTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField, ed?.colorRamp])

    const hoverFrac = ed?.hoverFrac
    const hoverPct = useMemo(() => {
        if (hoverFrac == null || !Number.isFinite(hoverFrac)) return null
        return hoverFrac * 100
    }, [hoverFrac])

    const currentResult = useMemo(() => {
        if (sightlineMode !== 'playback' || !ed?.results || !ed?.frameImages) return null
        return ed.results[effectivePlayIndex] || null
    }, [sightlineMode, ed, effectivePlayIndex])

    // Draw mini az/el canvases when playback result changes
    const azCanvasId = `sweepMiniAz_${elmId}`
    const elCanvasId = `sweepMiniEl_${elmId}`
    useEffect(() => {
        if (sightlineMode !== 'playback' || !currentResult || !resultsOpen) return
        SightlineTool.drawMiniRAEIndicators(azCanvasId, elCanvasId, currentResult)
    }, [sightlineMode, currentResult, azCanvasId, elCanvasId, resultsOpen])

    // Draw sky dome polar plot
    const skyDomeId = `sweepSkyDome_${elmId}`
    useEffect(() => {
        if (sightlineMode !== 'playback' || !ed?.results || !ed?.frameImages || ed.results.length === 0 || !resultsOpen) return
        SightlineTool.drawSkyDome(skyDomeId, ed.results, effectivePlayIndex)
    }, [sightlineMode, ed?.results, ed?.frameImages, effectivePlayIndex, skyDomeId, resultsOpen])

    // Auto-open Results when sweep completes for non-static modes.
    // Deps intentionally exclude sightlineMode so that merely switching modes
    // (which doesn't change data) won't re-open the section with stale data.
    // Composite sweeps store results in el.lastResultGrid (via updateElement),
    // while playback sweeps store in sweepElData (ed.results/grids/atlas).
    useEffect(() => {
        if (el?.regenerating || resultsOpen) return
        if (sightlineMode === 'playback') {
            if (ed?.results?.length > 0 && ed?.grids?.length > 0) {
                setResultsOpen(true)
            }
        } else if (sightlineMode === 'composite') {
            if (el?.lastResultGrid) {
                setResultsOpen(true)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ed?.results, ed?.grids, ed?.frameImages, el?.regenerating, el?.lastResultGrid])

    if (!el) return null

    const isCustom =
        sourcesList[el.sourceIndex] &&
        (sourcesList[el.sourceIndex].value === false ||
            sourcesList[el.sourceIndex].value === 'false')

    const generateActive = sightlineMode === 'static' ? el.changed : true
    const generateLabel = sightlineMode === 'static'
        ? (el.regenerating ? 'Generating' : 'Generate')
        : (el.regenerating ? 'Sweeping' : 'Sweep')

    return (
        <div
            ref={cardRef}
            className={`vstSightlineItem${isDropTarget ? (dropPosition === 'below' ? ' vstDropTargetBelow' : ' vstDropTargetAbove') : ''}`}
            data-sightline-id={elmId}
            style={{ borderLeft: `3px solid ${rgbStr(el.color)}` }}
            draggable
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onDragOver={(e) => onDragOver && onDragOver(e, elmId)}
            onDrop={(e) => onDrop && onDrop(e, elmId)}
        >
            <div className="vstSightlineHeader">
                <div className="vstSightlineHeaderLeft">
                    <Checkbox
                        checked={el.on}
                        onCheckedChange={handleToggle}
                    />
                </div>
                <div className="vstSightlineHeaderCenter">
                    <div style={{ width: 145 }}>
                        <Select
                            value={String(el.sourceIndex)}
                            onValueChange={(v) =>
                                handleChange('sourceIndex', parseInt(v))
                            }
                            options={sourceOptions}
                            className="vstSelect"
                        />
                    </div>
                </div>
                <div className="vstSightlineHeaderRight">
                    <div
                        ref={handleRef}
                        className="vstSightlineDragHandle"
                        onMouseDown={handleHandleMouseDown}
                    >
                        <i className="mdi mdi-drag-vertical mdi-14px" />
                    </div>
                    <Tooltip content="Remove sightline map">
                        <IconButton
                            size="sm"
                            onClick={handleDelete}
                            className="vstDeleteBtn"
                        >
                            <i className="mdi mdi-close mdi-18px" />
                        </IconButton>
                    </Tooltip>
                </div>
            </div>
            <div className="vstSightlineBody">
                {/* — Source — */}
                <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
                    <Collapsible.Trigger className="vstGroupHeader vstGroupToggle">
                        <i className={`mdi mdi-chevron-right mdi-14px vstGroupChevron ${sourceOpen ? 'vstGroupChevronOpen' : ''}`} />
                        Source
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <div className="vstGroupContent">
                            {isCustom && (
                                <>
                                    <div className="vstOptionRow">
                                        <div className="vstOptionLabel">Azimuth</div>
                                        <InputWithUnit
                                            unit="°"
                                            type="number"
                                            min="0"
                                            max="360"
                                            value={isNaN(el.customAz) ? '' : el.customAz}
                                            onChange={(e) =>
                                                handleChange(
                                                    'customAz',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                            className="vstFieldInput"
                                        />
                                    </div>
                                    <div className="vstOptionRow">
                                        <div className="vstOptionLabel">Elevation</div>
                                        <InputWithUnit
                                            unit="°"
                                            type="number"
                                            min="-90"
                                            max="90"
                                            value={isNaN(el.customEl) ? '' : el.customEl}
                                            onChange={(e) =>
                                                handleChange(
                                                    'customEl',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                            className="vstFieldInput"
                                        />
                                    </div>
                                    <div className="vstOptionRow">
                                        <div className="vstOptionLabel">Range</div>
                                        <InputWithUnit
                                            unit="km"
                                            type="number"
                                            value={
                                                isNaN(el.customRange)
                                                    ? ''
                                                    : el.customRange
                                            }
                                            onChange={(e) =>
                                                handleChange(
                                                    'customRange',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                            className="vstFieldInput"
                                        />
                                    </div>
                                </>
                            )}
                            {observerOptions.length > 0 && (
                                <>
                                    <div className="vstOptionRow">
                                        <div className="vstOptionLabel" title="Ground observer for time conversions">
                                            Observer
                                        </div>
                                        <Select
                                            value={el.observer || ''}
                                            onValueChange={(v) =>
                                                handleChange('observer', v)
                                            }
                                            options={observerOptions}
                                            className="vstSelect"
                                        />
                                    </div>
                                    {el.observer && (
                                        <>
                                            {sightlineMode !== 'static' && (
                                                <div className="vstOptionRow">
                                                    <div className="vstOptionLabel vstObsTimeLabel" title="Observer local start time">
                                                        <i className="mdi mdi-clock-outline mdi-14px" /> Start
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="vstSweepInput"
                                                        placeholder={vars?.observerTimePlaceholder || ''}
                                                        value={obsStartTime}
                                                        onChange={(e) => setObsStartTime(e.target.value)}
                                                        onBlur={handleObsStartBlur}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleObsStartBlur() }}
                                                    />
                                                </div>
                                            )}
                                            <div className="vstOptionRow">
                                                <div className="vstOptionLabel vstObsTimeLabel" title="Observer local end time">
                                                    <i className="mdi mdi-clock-outline mdi-14px" /> {sightlineMode === 'static' ? 'Time' : 'End'}
                                                </div>
                                                <input
                                                    type="text"
                                                    className="vstSweepInput"
                                                    placeholder={vars?.observerTimePlaceholder || ''}
                                                    value={obsEndTime}
                                                    onChange={(e) => setObsEndTime(e.target.value)}
                                                    onBlur={handleObsEndBlur}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleObsEndBlur() }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel" title="Height above surface of source point.">
                                    Height
                                </div>
                                <InputWithUnit
                                    unit="m"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={el.height}
                                    onChange={(e) =>
                                        handleChange(
                                            'height',
                                            parseFloat(e.target.value)
                                        )
                                    }
                                    className="vstFieldInput"
                                />
                            </div>

                            {demOptions.length >= 1 && (
                                <>
                                    <div className="vstOptionRow">
                                        <div className="vstOptionLabel" title="DEM (terrain dataset) to analyze.">
                                            DEM
                                        </div>
                                        <Select
                                            value={String(demIndex)}
                                            onValueChange={(v) =>
                                                updateElement(elmId, {
                                                    demIndex: parseInt(v),
                                                    nativeResolution: null,
                                                    changed: true,
                                                    lastError: false,
                                                })
                                            }
                                            options={demOptions}
                                            className="vstSelect"
                                        />
                                    </div>
                                    {Number.isFinite(nativeMpp) && (
                                        <div className="vstOptionRow vstEffectiveResRow">
                                            <div className="vstOptionLabel" />
                                            <div className="vstEffectiveRes" title="The DEM's native (dataset) ground resolution.">
                                                Native: {fmtMpp(nativeMpp)}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="vstOptionRow">
                                <div
                                    className="vstOptionLabel"
                                    title="Resolution scale relative to viewport DEM extent. Lower = faster, coarser."
                                >
                                    Resolution
                                </div>
                                <Select
                                    value={String(el.resolution)}
                                    onValueChange={(v) =>
                                        handleChange('resolution', parseFloat(v))
                                    }
                                    options={RESOLUTION_OPTIONS}
                                    className="vstSelect"
                                />
                            </div>
                            {Number.isFinite(effectiveMpp) && (
                                <div className="vstOptionRow vstEffectiveResRow">
                                    <div className="vstOptionLabel" />
                                    <div className="vstEffectiveRes" title="Approximate working ground resolution at the current viewport and zoom (never finer than native).">
                                        ≈ {fmtMpp(effectiveMpp)}
                                    </div>
                                </div>
                            )}
                            <div className="vstOptionRow">
                                <Tooltip content="Extends the terrain loaded for shadow computation beyond the visible map area. Terrain within this radius is read at a lower resolution so that distant features (ridges, crater rims) can cast shadows into the viewport without slowing down the full-resolution computation. Set to 0 to use only the viewport extent.">
                                    <div className="vstOptionLabel" style={{ cursor: 'help' }}>Shadow Reach</div>
                                </Tooltip>
                                <InputWithUnit
                                    unit="km"
                                    type="number"
                                    min="0"
                                    step="5"
                                    placeholder="0"
                                    value={el.shadowReach || ''}
                                    onChange={(e) =>
                                        updateElement(elmId, {
                                            shadowReach: e.target.value,
                                        })
                                    }
                                    onBlur={() =>
                                        updateElement(elmId, {
                                            changed: true,
                                            lastError: false,
                                        })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.target.blur()
                                        }
                                    }}
                                    className="vstFieldInput"
                                />
                            </div>
                        </div>
                    </Collapsible.Content>
                </Collapsible>

                {/* — Display — */}
                <Collapsible open={displayOpen} onOpenChange={setDisplayOpen}>
                    <Collapsible.Trigger className="vstGroupHeader vstGroupToggle">
                        <i className={`mdi mdi-chevron-right mdi-14px vstGroupChevron ${displayOpen ? 'vstGroupChevronOpen' : ''}`} />
                        Display
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <div className="vstGroupContent">
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel">Color</div>
                                <div className="vstColorSwatchWrap" ref={colorPickerRef}>
                                    <div
                                        className="vstColorSwatch"
                                        style={{ background: rgbStr(el.color) }}
                                        onClick={() => setColorPickerOpen(!colorPickerOpen)}
                                        title="Change color"
                                    />
                                    {colorPickerOpen && (
                                        <div className="vstColorPalette">
                                            {MULTI_SOURCE_COLORS.map((c, i) => (
                                                <div
                                                    key={i}
                                                    className="vstColorOption"
                                                    style={{ background: rgbStr(c) }}
                                                    onClick={() => handleColorSelect(c)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel">Opacity</div>
                                <div style={{ width: 145 }}>
                                    <Slider
                                        value={el.opacity}
                                        onValueChange={handleOpacityChange}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        suffix="%"
                                        formatValue={(v) => Math.round(v * 100)}
                                    />
                                </div>
                            </div>
                        </div>
                    </Collapsible.Content>
                </Collapsible>

                {/* — Run section — */}
                <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
                    <Collapsible.Trigger className="vstGroupHeader vstGroupToggle">
                        <i className={`mdi mdi-chevron-right mdi-14px vstGroupChevron ${resultsOpen ? 'vstGroupChevronOpen' : ''}`} />
                        Run
                    </Collapsible.Trigger>
                </Collapsible>

                {/* — Mode (always visible) — */}
                <div className="vstModeRow">
                    <Tabs
                        value={sightlineMode}
                        onValueChange={handleModeChange}
                        tabs={MODE_TABS}
                        size="xs"
                    />
                </div>

                {/* — Actions (always visible) — */}
                <div className="vstSightlineActions">
                    <div className="vstSweepBtnWrap">
                        <ProgressButton
                            active={generateActive}
                            loading={el.regenerating}
                            progress={el.loadingProgress || 0}
                            onClick={handleGenerate}
                        >
                            {generateLabel}
                        </ProgressButton>
                        {sightlineMode !== 'static' && el.regenerating && (
                            <button
                                type="button"
                                className="vstCancelSweepX"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    SightlineTool.cancelSweepElement(elmId)
                                }}
                                title="Cancel the running sweep"
                                aria-label="Cancel sweep"
                            >
                                <i className="mdi mdi-close mdi-14px" />
                            </button>
                        )}
                    </div>
                </div>

                {/* — Results (collapsible, controlled by Run header) — */}
                {resultsOpen && !el.regenerating && (
                        <div className="vstGroupContent">
                            {sightlineMode === 'static' && (
                                <SightlineResults elmId={elmId} />
                            )}

                            {sightlineMode === 'composite' && ed && (
                                <div className="vstSweepCardBody">
                                    <div className="vstOptionRow vstSweepCardRow">
                                        <div className="vstOptionLabel">Mode</div>
                                        <div style={{ width: 145 }}>
                                            <Select
                                                value={sweepDiscrete ? 'discrete' : 'continuous'}
                                                onValueChange={handleDiscreteChange}
                                                options={COLOR_MODE_OPTIONS}
                                            />
                                        </div>
                                    </div>
                                    <div className="vstOptionRow vstSweepCardRow">
                                        <div className="vstOptionLabel">Range</div>
                                        <div style={{ width: 145 }}>
                                            <Select
                                                value={sweepFitToData ? 'fit' : 'absolute'}
                                                onValueChange={handleFitModeChange}
                                                options={FIT_MODE_OPTIONS}
                                            />
                                        </div>
                                    </div>
                                    <div className="vstOptionRow vstSweepCardRow">
                                        <div className="vstOptionLabel">Color Ramp</div>
                                        <div style={{ width: 145 }}>
                                            <ColorRampPicker
                                                value={sweepColorRamp}
                                                onValueChange={handleColorRampChange}
                                                ramps={SightlineTool.getSweepColorRamps(el?.color)}
                                            />
                                        </div>
                                    </div>
                                    <CardLegend
                                        rampName={sweepColorRamp}
                                        discrete={discrete}
                                        visiblePct={hoverPct}
                                        fitToData={sweepFitToData}
                                        minFrac={ed?.minFrac ?? 0}
                                        maxFrac={ed?.maxFrac ?? 1}
                                        colorStops={ed?.colorStops}
                                        onColorStopsChange={handleColorStopsChange}
                                        onColorStopsReset={handleColorStopsReset}
                                        elmColor={el?.color}
                                    />
                                </div>
                            )}

                            {sightlineMode === 'playback' && ed && (
                                <div className="vstSweepCardBody">
                                    {ed?.results && ed.results.length > 0 && (
                                        <div className="vstSweepCardSkyDome">
                                            <canvas id={skyDomeId} width="360" height="360" />
                                            {currentResult && (
                                                <div className="vstSweepCardMiniIndicators">
                                                    <div className="vstSweepCardMiniIndicator">
                                                        <div className="vstSweepCardMiniLabel">Az: {currentResult.azimuth?.toFixed(1)}°</div>
                                                        <canvas id={azCanvasId} width="50" height="50" />
                                                    </div>
                                                    <div className="vstSweepCardMiniIndicator">
                                                        <div className="vstSweepCardMiniLabel">El: {currentResult.elevation?.toFixed(1)}°</div>
                                                        <canvas id={elCanvasId} width="50" height="50" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="vstSweepControlsWrap vstSweepControlsInline">
                                        <div className="vstSweepPlaybarRow vstSweepPlaybarLeft">
                                            <div className="vstSweepPlaybar">
                                                <IconButton size="md" title="Step back" onClick={() => SightlineTool.sweepStepBack()}>
                                                    <i className="mdi mdi-skip-previous mdi-18px" />
                                                </IconButton>
                                                {sweepPlaying ? (
                                                    <IconButton size="md" title="Pause" onClick={handlePause}>
                                                        <i className="mdi mdi-pause mdi-18px" />
                                                    </IconButton>
                                                ) : (
                                                    <>
                                                        <IconButton size="md" title="Play" onClick={handlePlayNormal}>
                                                            <i className="mdi mdi-play mdi-18px" />
                                                        </IconButton>
                                                        <IconButton size="md" title="Play fast" onClick={handlePlayFast}>
                                                            <i className="mdi mdi-fast-forward mdi-18px" />
                                                        </IconButton>
                                                    </>
                                                )}
                                                <IconButton size="md" title="Step forward" onClick={() => SightlineTool.sweepStepForward()}>
                                                    <i className="mdi mdi-skip-next mdi-18px" />
                                                </IconButton>
                                            </div>
                                        </div>
                                        {ed.grids && ed.grids.length > 0 && (
                                            <div className="vstSweepTimeline">
                                                <Slider
                                                    value={effectivePlayIndex}
                                                    onValueChange={handleTimelineScrub}
                                                    min={0}
                                                    max={Math.max(ed.grids.length - 1, 1)}
                                                    step={1}
                                                />
                                            </div>
                                        )}
                                        <div className="vstSweepFrameLabel">
                                            <span id={`vstSweepFrameLabel_${elmId}`} />
                                        </div>
                                    </div>
                                    {ed?.results && ed.results.length > 0 && ed?.grids && (
                                        <div className="vstGraphButtons">
                                            <IconTextButton
                                                size="md"
                                                active={SightlineTool_Graphs.isOpen() && SightlineTool_Graphs.getActiveElmId() === elmId}
                                                title="Toggle Horizon + Visibility charts"
                                                onClick={() => SightlineTool_Graphs.toggle(elmId)}
                                                icon={<i className="mdi mdi-chart-areaspline" />}
                                                style={{ width: '100%', justifyContent: 'center', color: 'var(--color-a7)' }}
                                            >
                                                Charts
                                            </IconTextButton>
                                        </div>
                                    )}
                                </div>
                            )}


                            {((sightlineMode === 'static' && el?.raeResults) || ((sightlineMode === 'composite' || sightlineMode === 'playback') && ed)) && (
                                <div className="vstResultsExport vstOptionRow">
                                    <div className="vstOptionLabel">Export</div>
                                    <div className="vstExportControls">
                                        <div style={{ width: 145 }}>
                                            <Select
                                                value={exportFormat}
                                                onValueChange={setExportFormat}
                                                options={sightlineMode === 'playback' ? EXPORT_OPTIONS_PLAYBACK : EXPORT_OPTIONS_STATIC}
                                            />
                                        </div>
                                        {exportProgress != null ? (
                                            <span style={{ fontSize: 11, color: '#4fc3f7', minWidth: 36, textAlign: 'center' }}>{exportProgress}%</span>
                                        ) : (
                                            <IconButton size="sm" title="Download" onClick={() => handleExport(elmId, exportFormat)}>
                                                <i className="mdi mdi-download mdi-18px" />
                                            </IconButton>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                )}
            </div>
        </div>
    )
}
