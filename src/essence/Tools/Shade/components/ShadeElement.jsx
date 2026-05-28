import React, { useCallback, useMemo, useState } from 'react'
import useShadeStore, { buildSourcesList, MULTI_SOURCE_COLORS } from '../store'
import ShadeResults from './ShadeResults'
import ShadeTool from '../ShadeTool'
import {
    Button,
    IconButton,
    Dropdown,
    InputWithUnit,
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

    const handleGenerate = useCallback(() => {
        if (!el?.changed || el?.regenerating) return
        setActiveElmId(elmId)
        ShadeTool.shade(null, elmId)
    }, [elmId, el?.changed, el?.regenerating, setActiveElmId])

    const handleDelete = useCallback(() => {
        ShadeTool.deleteElement(elmId)
    }, [elmId])

    const handleClone = useCallback(() => {
        const store = useShadeStore.getState()
        const opts = store.getShadeOptions(elmId)
        store.addElement(null, {
            name: null,
            on: false,
            dataIndex: opts.dataIndex,
            color: { ...el.color },
            opacity: el.opacity,
            resolution: el.resolution,
            height: el.height,
            sourceIndex: el.sourceIndex,
        })
    }, [elmId, el])

    const [colorPickerOpen, setColorPickerOpen] = useState(false)

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
            <div className="vstLoading" style={{ opacity: el.loading ? 1 : 0, width: el.loadingProgress + '%' }} />
            <div className="vstShadeHeader">
                <div className="vstShadeHeaderLeft">
                    <Tooltip content="Change color">
                        <div className="vstColorSwatchWrap">
                            <div
                                className="vstColorSwatch"
                                style={{ background: rgbStr(el.color) }}
                                onClick={() => setColorPickerOpen(!colorPickerOpen)}
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
                    </Tooltip>
                    <Tooltip content={el.on ? 'Hide shade map' : 'Show shade map'}>
                        <IconButton
                            size="sm"
                            active={el.on}
                            onClick={handleToggle}
                        >
                            <i
                                className={`mdi mdi-18px ${
                                    el.on
                                        ? 'mdi-eye'
                                        : 'mdi-eye-off-outline'
                                }`}
                            />
                        </IconButton>
                    </Tooltip>
                </div>
                <div className="vstShadeHeaderRight">
                    {el.changed && !el.regenerating && (
                        <Tooltip content="Regenerate shade map">
                            <IconButton
                                size="sm"
                                onClick={handleGenerate}
                                className="vstRegenIcon"
                            >
                                <i className="mdi mdi-refresh mdi-18px" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {el.regenerating && (
                        <span className="vstRegenProgress">
                            {Math.round(el.loadingProgress)}%
                        </span>
                    )}
                    <Tooltip content="Delete shade map">
                        <IconButton
                            size="sm"
                            onClick={handleDelete}
                            className="vstDeleteBtn"
                        >
                            <i className="mdi mdi-delete mdi-18px" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip content="Clone shade map">
                        <IconButton
                            size="sm"
                            onClick={handleClone}
                        >
                            <i className="mdi mdi-content-copy mdi-18px" />
                        </IconButton>
                    </Tooltip>
                    <Dropdown
                        align="end"
                        trigger={
                            <IconButton size="sm">
                                <i className="mdi mdi-download mdi-18px" />
                            </IconButton>
                        }
                    >
                        <Dropdown.Item onClick={() => ShadeTool.exportPNG(elmId)}>
                            <i className="mdi mdi-image mdi-14px" /> Shade Map (PNG)
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => ShadeTool.exportCSV()}>
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
            </div>
            <div className="vstShadeBody">
                {/* — Source — */}
                <div className="vstGroupHeader">Source</div>
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

                {/* — Display — */}
                <div className="vstGroupHeader">Display</div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Opacity</div>
                    <div className="vstSliderWrap">
                        <Slider
                            value={el.opacity}
                            onValueChange={(v) =>
                                handleChange('opacity', v)
                            }
                            min={0}
                            max={1}
                            step={0.01}
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
                <div className="vstOptionRow">
                    <div className="vstOptionLabel" title="Dataset to shade.">
                        Elevation Map
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

                {/* — Results — */}
                <div className="vstGroupHeader">Results</div>
                <ShadeResults elmId={elmId} />

                {/* — Actions — */}
                <div className="vstShadeActions">
                    <Button
                        variant={el.changed ? 'primary' : 'secondary'}
                        size="sm"
                        className="vstGenerate"
                        onClick={handleGenerate}
                        disabled={!el.changed || el.regenerating}
                    >
                        {el.regenerating
                            ? `${Math.round(el.loadingProgress)}%`
                            : 'Generate'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
