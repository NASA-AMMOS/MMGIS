import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useShadeStore, { buildSourcesList, MULTI_SOURCE_COLORS } from '../store'
import ShadeResults from './ShadeResults'
import CardLegend, { getDefaultStops } from './CardLegend'
import ShadeTool from '../ShadeTool'
import ShadeTool_Graphs from '../ShadeTool_Graphs'
import L_ from '../../../Basics/Layers_/Layers_'
import {
    Button,
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
} from '../../../../design-system/components'

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

const EXPORT_OPTIONS = [
    { value: 'png', label: 'Shade Map (PNG)' },
    { value: 'csv', label: 'Sweep Results (CSV)' },
    { value: 'grid', label: 'Shade Grid (TXT)' },
]

export default function ShadeElement({ elmId, onDragStart, onDragOver, onDragEnd, onDrop, isDropTarget }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const vars = useShadeStore((s) => s.vars)
    const updateElement = useShadeStore((s) => s.updateElement)
    const removeElement = useShadeStore((s) => s.removeElement)
    const setActiveElmId = useShadeStore((s) => s.setActiveElmId)
    const ed = useShadeStore((s) => s.sweepElData[elmId])
    const sweepPlayIndex = useShadeStore((s) => s.sweepPlayIndex)
    const sweepPlaying = useShadeStore((s) => s.sweepPlaying)
    const sweepDiscrete = useShadeStore((s) => s.sweepDiscrete)
    const sweepFitToData = useShadeStore((s) => s.sweepFitToData)
    const setSweepElField = useShadeStore((s) => s.setSweepElField)
    const setSweepField = useShadeStore((s) => s.setSweepField)
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)

    const sourcesList = useMemo(() => buildSourcesList(vars), [vars])

    const sourceOptions = useMemo(
        () =>
            sourcesList.map((s, i) => ({
                value: String(i),
                label: s.name,
            })),
        [sourcesList]
    )

    const dataOptions = useMemo(
        () =>
            (vars?.data || []).map((d, i) => ({
                value: String(i),
                label: d.name,
            })),
        [vars]
    )

    const observerOptions = useMemo(
        () =>
            (vars?.observers || []).map((o) => ({
                value: o.value,
                label: o.name,
            })),
        [vars]
    )

    const resolutionOptions = useMemo(
        () => [
            { value: '0', label: 'Low' },
            { value: '1', label: 'Medium' },
            { value: '2', label: 'High' },
            { value: '3', label: 'Ultra' },
        ],
        []
    )

    const shadeMode = el?.shadeMode || 'static'

    const handleToggle = useCallback(() => {
        const newOn = !el?.on
        updateElement(elmId, { on: newOn })
        ShadeTool.toggleElementVisibility(elmId, newOn)
    }, [elmId, el?.on, updateElement])

    const handleChange = useCallback(
        (field, value) => {
            updateElement(elmId, { [field]: value, changed: true, lastError: false })
        },
        [elmId, updateElement]
    )

    const handleModeChange = useCallback((mode) => {
        ShadeTool.switchElementMode(elmId, mode)
        updateElement(elmId, { shadeMode: mode })
        setResultsOpen(false)
    }, [elmId, updateElement])

    const handleOpacityChange = useCallback(
        (value) => {
            updateElement(elmId, { opacity: value })
            const layerName = 'shade' + elmId
            const layer = L_.layers.layer[layerName]
            if (layer && typeof layer.setOpacity === 'function') {
                layer.setOpacity(value)
            }
        },
        [elmId, updateElement]
    )

    // Auto-generate when settings change (static mode only)
    useEffect(() => {
        if (shadeMode !== 'static') return
        if (!el?.changed || el?.regenerating || el?.lastError) return
        const timer = setTimeout(() => {
            setActiveElmId(elmId)
            ShadeTool.shade(null, elmId)
        }, 300)
        return () => clearTimeout(timer)
    }, [elmId, el?.changed, el?.regenerating, el?.lastError, shadeMode, setActiveElmId])

    const handleGenerate = useCallback(() => {
        if (el?.regenerating) return
        if (shadeMode === 'static') {
            if (!el?.changed) return
            setActiveElmId(elmId)
            ShadeTool.shade(null, elmId)
        } else {
            setActiveElmId(elmId)
            ShadeTool.shadeSweepElement(elmId)
        }
    }, [elmId, el?.changed, el?.regenerating, shadeMode, setActiveElmId])

    const handleDelete = useCallback(() => {
        ShadeTool.deleteElement(elmId)
    }, [elmId])

    const cardRef = useRef(null)
    const handleRef = useRef(null)
    const isDraggingRef = useRef(false)

    const [sourceOpen, setSourceOpen] = useState(false)
    const [displayOpen, setDisplayOpen] = useState(false)
    const [resultsOpen, setResultsOpen] = useState(shadeMode === 'static')

    const [colorPickerOpen, setColorPickerOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState('png')
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
            ShadeTool.convertUTCToObserver(sweepStart, observer, (result) => {
                setObsStartTime(result || sweepStart)
            })
        }
        if (sweepEnd) {
            ShadeTool.convertUTCToObserver(sweepEnd, observer, (result) => {
                setObsEndTime(result || sweepEnd)
            })
        }
    }, [sweepStart, sweepEnd, observer, observerOptions.length])

    const handleObsStartBlur = useCallback(() => {
        if (!obsStartTime || !observer) return
        ShadeTool.convertObserverToUTC(obsStartTime, observer, (result) => {
            if (result) {
                const utc = result.replace(' ', 'T').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z').replace(/\.\d{3}Z$/, 'Z')
                setSweepField('sweepStart', utc)
            }
        })
    }, [obsStartTime, observer, setSweepField])

    const handleObsEndBlur = useCallback(() => {
        if (!obsEndTime || !observer) return
        ShadeTool.convertObserverToUTC(obsEndTime, observer, (result) => {
            if (result) {
                const utc = result.replace(' ', 'T').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z').replace(/\.\d{3}Z$/, 'Z')
                setSweepField('sweepEnd', utc)
            }
        })
    }, [obsEndTime, observer, setSweepField])

    const handleColorSelect = useCallback(
        (color) => {
            updateElement(elmId, { color: { ...color }, changed: true, lastError: false })
            setColorPickerOpen(false)
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
    const sweepOpacity = ed?.opacity != null ? ed.opacity : 1
    const sweepColorRamp = ed?.colorRamp || 'shadow'
    const discrete = sweepDiscrete || false

    const handleSweepOpacityChange = useCallback((val) => {
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

    const SPEED_NORMAL = 500
    const SPEED_FAST = 150

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

    const effectivePlayIndex = sweepPlayIndex

    const handleTimelineScrub = useCallback((v) => {
        setSweepField('sweepPlayIndex', v)
        ShadeTool.sweepShowAllFrames()
    }, [setSweepField])

    const handleExport = useCallback((id, format) => {
        try {
            switch (format) {
                case 'png': ShadeTool.exportPNG(id); break
                case 'csv': ShadeTool.exportCSV(id); break
                case 'grid': ShadeTool.exportGrid(id); break
                default: ShadeTool.exportPNG(id); break
            }
        } catch (e) {
            console.error('Export failed:', e)
        }
    }, [])

    const handleDiscreteChange = useCallback((val) => {
        setSweepField('sweepDiscrete', val === 'discrete')
        setTimeout(() => ShadeTool.refreshHeatmap(), 0)
    }, [setSweepField])

    const handleFitModeChange = useCallback((val) => {
        setSweepField('sweepFitToData', val === 'fit')
        setTimeout(() => ShadeTool.refreshHeatmap(), 0)
    }, [setSweepField])

    const handleColorStopsChange = useCallback((newStops) => {
        setSweepElField(elmId, 'colorStops', newStops)
        setTimeout(() => {
            const ed2 = useShadeStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                ShadeTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField])

    const handleColorStopsReset = useCallback(() => {
        const allRamps = ShadeTool.getSweepColorRamps()
        const rampDef = allRamps.find((r) => r.name === (ed?.colorRamp || 'shadow')) || allRamps[0]
        const bins = rampDef.bins || rampDef.colors.length
        setSweepElField(elmId, 'colorStops', getDefaultStops(bins))
        setTimeout(() => {
            const ed2 = useShadeStore.getState().sweepElData[elmId]
            if (ed2?.heatmap && ed2?.lastData) {
                ShadeTool.renderHeatmapToMap(ed2.lastData, ed2.heatmap, elmId)
            }
        }, 0)
    }, [elmId, setSweepElField, ed?.colorRamp])

    const hoverFrac = ed?.hoverFrac
    const hoverPct = useMemo(() => {
        if (hoverFrac == null || !Number.isFinite(hoverFrac)) return null
        return hoverFrac * 100
    }, [hoverFrac])

    const currentResult = useMemo(() => {
        if (shadeMode !== 'playback' || !ed?.results || !ed?.atlas) return null
        return ed.results[effectivePlayIndex] || null
    }, [shadeMode, ed, effectivePlayIndex])

    // Draw mini az/el canvases when playback result changes
    const azCanvasId = `sweepMiniAz_${elmId}`
    const elCanvasId = `sweepMiniEl_${elmId}`
    useEffect(() => {
        if (shadeMode !== 'playback' || !currentResult || !resultsOpen) return
        ShadeTool.drawMiniRAEIndicators(azCanvasId, elCanvasId, currentResult)
    }, [shadeMode, currentResult, azCanvasId, elCanvasId, resultsOpen])

    // Draw sky dome polar plot
    const skyDomeId = `sweepSkyDome_${elmId}`
    useEffect(() => {
        if (shadeMode !== 'playback' || !ed?.results || !ed?.atlas || ed.results.length === 0 || !resultsOpen) return
        ShadeTool.drawSkyDome(skyDomeId, ed.results, effectivePlayIndex)
    }, [shadeMode, ed?.results, ed?.atlas, effectivePlayIndex, skyDomeId, resultsOpen])

    // Auto-open Results when sweep completes for non-static modes.
    // Deps intentionally exclude shadeMode so that merely switching modes
    // (which doesn't change data) won't re-open the section with stale data.
    useEffect(() => {
        if (el?.regenerating || resultsOpen) return
        if (!ed?.results || ed.results.length === 0) return
        if (shadeMode === 'playback' && ed?.grids && ed.grids.length > 0) {
            setResultsOpen(true)
        } else if (shadeMode === 'composite' && ed?.atlas) {
            setResultsOpen(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ed?.results, ed?.grids, ed?.atlas, el?.regenerating])

    if (!el) return null

    const isCustom =
        sourcesList[el.sourceIndex] &&
        (sourcesList[el.sourceIndex].value === false ||
            sourcesList[el.sourceIndex].value === 'false')

    const generateActive = shadeMode === 'static' ? el.changed : true
    const generateLabel = shadeMode === 'static' ? 'Generate' : 'Sweep'

    return (
        <div
            ref={cardRef}
            className={`vstShadeItem${isDropTarget ? ' vstDropTarget' : ''}`}
            data-shade-id={elmId}
            style={{ borderLeft: `3px solid ${rgbStr(el.color)}` }}
            draggable
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onDragOver={(e) => onDragOver && onDragOver(e, elmId)}
            onDrop={(e) => onDrop && onDrop(e, elmId)}
        >
            <div className="vstShadeHeader">
                <div className="vstShadeHeaderLeft">
                    <Checkbox
                        checked={el.on}
                        onCheckedChange={handleToggle}
                    />
                </div>
                <div className="vstShadeHeaderCenter">
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
                <div className="vstShadeHeaderRight">
                    <div
                        ref={handleRef}
                        className="vstShadeDragHandle"
                        onMouseDown={handleHandleMouseDown}
                    >
                        <i className="mdi mdi-drag-vertical mdi-14px" />
                    </div>
                    <Tooltip content="Remove shade map">
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
            <div className="vstShadeBody">
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
                                                />
                                            </div>
                                            <div className="vstOptionRow">
                                                <div className="vstOptionLabel vstObsTimeLabel" title="Observer local end time">
                                                    <i className="mdi mdi-clock-outline mdi-14px" /> End
                                                </div>
                                                <input
                                                    type="text"
                                                    className="vstSweepInput"
                                                    placeholder={vars?.observerTimePlaceholder || ''}
                                                    value={obsEndTime}
                                                    onChange={(e) => setObsEndTime(e.target.value)}
                                                    onBlur={handleObsEndBlur}
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
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel" title="Dataset to shade.">
                                    DEM
                                </div>
                                <Select
                                    value={String(el.dataIndex)}
                                    onValueChange={(v) =>
                                        handleChange('dataIndex', parseInt(v))
                                    }
                                    options={dataOptions}
                                    className="vstSelect"
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
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel" title="High or Ultra disables auto-regeneration.">
                                    Resolution
                                </div>
                                <Select
                                    value={String(el.resolution)}
                                    onValueChange={(v) =>
                                        handleChange('resolution', parseInt(v))
                                    }
                                    options={resolutionOptions}
                                    className="vstSelect"
                                />
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
                        value={shadeMode}
                        onValueChange={handleModeChange}
                        tabs={MODE_TABS}
                        size="xs"
                    />
                </div>

                {/* — Actions (always visible) — */}
                <div className="vstShadeActions">
                    <ProgressButton
                        active={generateActive}
                        loading={el.regenerating}
                        progress={el.loadingProgress || 0}
                        onClick={handleGenerate}
                    >
                        {generateLabel}
                    </ProgressButton>
                </div>

                {/* — Results (collapsible, controlled by Run header) — */}
                {resultsOpen && !el.regenerating && (
                        <div className="vstGroupContent">
                            {shadeMode === 'static' && (
                                <ShadeResults elmId={elmId} />
                            )}

                            {shadeMode === 'composite' && ed && (
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
                                                ramps={ShadeTool.getSweepColorRamps()}
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
                                    />
                                </div>
                            )}

                            {shadeMode === 'playback' && ed && (
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
                                                <IconButton size="md" title="Step back" onClick={() => ShadeTool.sweepStepBack()}>
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
                                                <IconButton size="md" title="Step forward" onClick={() => ShadeTool.sweepStepForward()}>
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
                                                active={ShadeTool_Graphs.isOpen() && ShadeTool_Graphs.getActiveElmId() === elmId}
                                                title="Toggle Horizon + Visibility charts"
                                                onClick={() => ShadeTool_Graphs.toggle(elmId)}
                                                icon={<i className="mdi mdi-chart-areaspline" />}
                                                style={{ width: '100%', justifyContent: 'center' }}
                                            >
                                                Charts
                                            </IconTextButton>
                                        </div>
                                    )}
                                </div>
                            )}


                            {((shadeMode === 'static' && el?.raeResults) || ((shadeMode === 'composite' || shadeMode === 'playback') && ed)) && (
                                <div className="vstResultsExport vstOptionRow">
                                    <div className="vstOptionLabel">Export</div>
                                    <div className="vstExportControls">
                                        <div style={{ width: 145 }}>
                                            <Select
                                                value={exportFormat}
                                                onValueChange={setExportFormat}
                                                options={EXPORT_OPTIONS}
                                            />
                                        </div>
                                        <IconButton size="sm" title="Download" onClick={() => handleExport(elmId, exportFormat)}>
                                            <i className="mdi mdi-download mdi-18px" />
                                        </IconButton>
                                    </div>
                                </div>
                            )}
                        </div>
                )}
            </div>
        </div>
    )
}
