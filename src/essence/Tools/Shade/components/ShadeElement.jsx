import React, { useCallback, useMemo, useRef } from 'react'
import useShadeStore, { buildSourcesList, MULTI_SOURCE_COLORS } from '../store'
import ShadeResults from './ShadeResults'
import ExportBar from './ExportBar'
import ShadeTool from '../ShadeTool'
import {
    Button,
    IconButton,
    Collapsible,
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
        updateElement(elmId, { on: !el?.on })
    }, [elmId, el?.on, updateElement])

    const handleExpandToggle = useCallback(() => {
        updateElement(elmId, { expanded: !el?.expanded })
        setActiveElmId(elmId)
    }, [elmId, el?.expanded, updateElement, setActiveElmId])

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

    const colorInputRef = useRef(null)

    const handleColorClick = useCallback(() => {
        colorInputRef.current?.click()
    }, [])

    const handleColorChange = useCallback(
        (e) => {
            const hex = e.target.value
            const r = parseInt(hex.slice(1, 3), 16)
            const g = parseInt(hex.slice(3, 5), 16)
            const b = parseInt(hex.slice(5, 7), 16)
            updateElement(elmId, { color: { r, g, b }, changed: true })
        },
        [elmId, updateElement]
    )

    if (!el) return null

    const colorHex = el
        ? `#${el.color.r.toString(16).padStart(2, '0')}${el.color.g.toString(16).padStart(2, '0')}${el.color.b.toString(16).padStart(2, '0')}`
        : '#000000'

    const isCustom =
        sourcesList[el.sourceIndex] &&
        (sourcesList[el.sourceIndex].value === false ||
            sourcesList[el.sourceIndex].value === 'false')

    return (
        <div className="vstShadeItem" data-shade-id={elmId}>
            <div className="vstLoading" style={{ opacity: el.loading ? 1 : 0, width: el.loadingProgress + '%' }} />
            <div className="vstShadeHeader">
                <div className="vstShadeHeaderLeft">
                    <div
                        className="vstColorSwatch"
                        style={{ background: rgbStr(el.color), cursor: 'pointer' }}
                        onClick={handleColorClick}
                        title="Click to change color"
                    >
                        <input
                            ref={colorInputRef}
                            type="color"
                            value={colorHex}
                            onChange={handleColorChange}
                            className="vstColorInput"
                        />
                    </div>
                    <IconButton
                        size="sm"
                        active={el.on}
                        onClick={handleToggle}
                        title="Toggle On/Off"
                    >
                        <i
                            className={`mdi mdi-14px ${
                                el.on
                                    ? 'mdi-eye'
                                    : 'mdi-eye-off-outline'
                            }`}
                        />
                    </IconButton>
                    <span className="vstShadeName">{el.name}</span>
                </div>
                <div className="vstShadeHeaderRight">
                    <IconButton
                        size="sm"
                        active={el.expanded}
                        onClick={handleExpandToggle}
                        title="Settings"
                    >
                        <i className="mdi mdi-tune mdi-14px" />
                    </IconButton>
                </div>
            </div>
            <Collapsible open={el.expanded} onOpenChange={handleExpandToggle}>
                <Collapsible.Content>
                    <div
                        className="vstShadeBody"
                        style={{ borderLeft: `4px solid ${rgbStr(el.color)}` }}
                    >
                        <div className="vstOptionRow">
                            <div className="vstOptionLabel" title='Orbiter or body that is the source of "light".'>
                                Source
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
                                    <div className="vstInputGroup">
                                        <input
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
                                        />
                                        <span className="vstInputUnit">&deg;</span>
                                    </div>
                                </div>
                                <div className="vstOptionRow">
                                    <div className="vstOptionLabel">Elevation</div>
                                    <div className="vstInputGroup">
                                        <input
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
                                        />
                                        <span className="vstInputUnit">&deg;</span>
                                    </div>
                                </div>
                                <div className="vstOptionRow">
                                    <div className="vstOptionLabel">Range</div>
                                    <div className="vstInputGroup">
                                        <input
                                            type="number"
                                            disabled
                                            value={
                                                isNaN(el.customRange)
                                                    ? ''
                                                    : el.customRange
                                            }
                                        />
                                        <span className="vstInputUnit">km</span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="vstSectionLabel">Settings</div>

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
                            <div className="vstInputGroup">
                                <input
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
                                />
                                <span className="vstInputUnit">m</span>
                            </div>
                        </div>
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

                        <ShadeResults elmId={elmId} />

                        <div className="vstSectionLabel">Download</div>
                        <ExportBar elmId={elmId} />

                        <div className="vstShadeActions">
                            <IconButton
                                size="sm"
                                onClick={handleDelete}
                                title="Delete"
                            >
                                <i className="mdi mdi-delete mdi-14px" />
                            </IconButton>
                            <IconButton
                                size="sm"
                                onClick={handleClone}
                                title="Clone"
                            >
                                <i className="mdi mdi-plus-circle-multiple-outline mdi-14px" />
                            </IconButton>
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
                </Collapsible.Content>
            </Collapsible>
        </div>
    )
}
