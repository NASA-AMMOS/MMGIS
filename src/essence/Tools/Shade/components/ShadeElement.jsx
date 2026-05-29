import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useShadeStore, { buildSourcesList, MULTI_SOURCE_COLORS } from '../store'
import ShadeResults from './ShadeResults'
import ShadeTool from '../ShadeTool'
import L_ from '../../../Basics/Layers_/Layers_'
import {
    Button,
    Checkbox,
    Collapsible,
    IconButton,
    Dropdown,
    InputWithUnit,
    ProgressButton,
    Select,
    Slider,
    Tooltip,
} from '../../../../design-system/components'

function rgbStr(c) {
    return `rgb(${c.r},${c.g},${c.b})`
}

export default function ShadeElement({ elmId }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const vars = useShadeStore((s) => s.vars)
    const updateElement = useShadeStore((s) => s.updateElement)
    const removeElement = useShadeStore((s) => s.removeElement)
    const setActiveElmId = useShadeStore((s) => s.setActiveElmId)

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

    const handleToggle = useCallback(() => {
        const newOn = !el?.on
        updateElement(elmId, { on: newOn })
        ShadeTool.toggleElementVisibility(elmId, newOn)
    }, [elmId, el?.on, updateElement])

    const handleChange = useCallback(
        (field, value) => {
            updateElement(elmId, { [field]: value, changed: true })
        },
        [elmId, updateElement]
    )

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

    // Auto-generate when settings change
    useEffect(() => {
        if (!el?.changed || el?.regenerating) return
        const timer = setTimeout(() => {
            setActiveElmId(elmId)
            ShadeTool.shade(null, elmId)
        }, 300)
        return () => clearTimeout(timer)
    }, [elmId, el?.changed, el?.regenerating, setActiveElmId])

    const handleGenerate = useCallback(() => {
        if (!el?.changed || el?.regenerating) return
        setActiveElmId(elmId)
        ShadeTool.shade(null, elmId)
    }, [elmId, el?.changed, el?.regenerating, setActiveElmId])

    const handleDelete = useCallback(() => {
        ShadeTool.deleteElement(elmId)
    }, [elmId])


    const [sourceOpen, setSourceOpen] = useState(true)
    const [displayOpen, setDisplayOpen] = useState(false)
    const [resultsOpen, setResultsOpen] = useState(false)

    const [colorPickerOpen, setColorPickerOpen] = useState(false)
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

    const handleColorSelect = useCallback(
        (color) => {
            updateElement(elmId, { color: { ...color }, changed: true })
            setColorPickerOpen(false)
        },
        [elmId, updateElement]
    )

    if (!el) return null

    const isCustom =
        sourcesList[el.sourceIndex] &&
        (sourcesList[el.sourceIndex].value === false ||
            sourcesList[el.sourceIndex].value === 'false')

    return (
        <div className="vstShadeItem" data-shade-id={elmId}>
            <div className="vstShadeHeader">
                <div className="vstShadeHeaderLeft">
                    <Checkbox
                        checked={el.on}
                        onCheckedChange={handleToggle}
                    />
                </div>
                <div className="vstShadeHeaderCenter">
                    <Dropdown
                        align="start"
                        trigger={
                            <IconButton size="sm" title="Export shade map">
                                <i className="mdi mdi-download mdi-18px" />
                            </IconButton>
                        }
                    >
                        <Dropdown.Item onClick={() => ShadeTool.exportPNG(elmId)}>
                            <i className="mdi mdi-image mdi-14px" /> Shade Map (PNG)
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => ShadeTool.exportCSV(elmId)}>
                            <i className="mdi mdi-file-delimited mdi-14px" /> Sweep Results (CSV)
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => ShadeTool.exportGeoJSON(elmId)}>
                            <i className="mdi mdi-map mdi-14px" /> Shade Map (GeoJSON)
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => ShadeTool.exportReport(elmId)}>
                            <i className="mdi mdi-code-json mdi-14px" /> Report (JSON)
                        </Dropdown.Item>
                    </Dropdown>
                </div>
                <div className="vstShadeHeaderRight">
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
                            <div className="vstOptionRow">
                                <div className="vstOptionLabel" title='Orbiter or body that is the source of "light".'>
                                    Entity
                                </div>
                                <Select
                                    value={String(el.sourceIndex)}
                                    onValueChange={(v) =>
                                        handleChange('sourceIndex', parseInt(v))
                                    }
                                    options={sourceOptions}
                                    className="vstSelect"
                                />
                            </div>
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

                {/* — Results — */}
                <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
                    <Collapsible.Trigger className="vstGroupHeader vstGroupToggle">
                        <i className={`mdi mdi-chevron-right mdi-14px vstGroupChevron ${resultsOpen ? 'vstGroupChevronOpen' : ''}`} />
                        Results
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <div className="vstGroupContent">
                            <ShadeResults elmId={elmId} />
                        </div>
                    </Collapsible.Content>
                </Collapsible>

                {/* — Actions — */}
                <div className="vstShadeActions">
                    <ProgressButton
                        active={el.changed}
                        loading={el.regenerating}
                        progress={el.loadingProgress || 0}
                        onClick={handleGenerate}
                    >
                        Generate
                    </ProgressButton>
                </div>
            </div>
        </div>
    )
}
