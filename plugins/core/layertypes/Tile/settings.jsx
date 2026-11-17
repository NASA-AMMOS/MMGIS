import React, { useEffect, useRef, useState } from 'react'
import { Button, ColorRampPicker, Select, TextInput } from '@design/components'
import {
    LayerSettingsSlider,
} from '@basics/UserInterface_/LayerSettings/LayerSettings'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import ToolController_ from '@basics/ToolController_/ToolController_'
import {
    data as colormapData,
    evaluate_cmap,
} from '@external/js-colormaps/js-colormaps.js'
import './settings.css'

const BLEND_MODES = [
    'unset',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
]

const RAMP_NAMES = Object.keys(colormapData)
    .filter((name) => /^[a-z]/i.test(name))
    .sort()

function isCog(layer) {
    const renderer = L_.layers.layer?.[layer.name]
    if (layer.type === 'image')
        return (
            layer.cogTransform === true &&
            typeof layer.url === 'string' &&
            renderer?.georasters?.[0]?.numberOfRasters === 1 &&
            typeof renderer.updateColors === 'function'
        )
    if (layer.type === 'velocity') return layer.kind === 'streamlines'
    return (
        layer.type === 'tile' &&
        layer.cogTransform === true &&
        (layer.url?.startsWith('COG:') ||
            layer.url?.startsWith('stac-collection:'))
    )
}

function ramps() {
    return RAMP_NAMES.map((name) => ({
        name,
        colors: Array.from({ length: 16 }, (_, index) => {
            const [r, g, b] = evaluate_cmap(index / 15, name, false)
            return [r / 255, g / 255, b / 255]
        }),
    }))
}

const COLOR_RAMPS = ramps()
const cogDefaults = new WeakMap()

function defaultsFor(layer) {
    if (!cogDefaults.has(layer))
        cogDefaults.set(layer, {
            colorMap: layer.cogColormap,
            expression: layer.cogExpression,
        })
    return cogDefaults.get(layer)
}

function colorTableEntries(table) {
    if (typeof table === 'string') {
        try {
            table = JSON.parse(table)
        } catch (error) {
            return []
        }
    }
    if (Array.isArray(table))
        return table
            .filter((entry) => Array.isArray(entry) && Array.isArray(entry[1]))
            .map((entry) => ({
                label: Array.isArray(entry[0])
                    ? `${entry[0][0]} – ${entry[0][1]}`
                    : '',
                color: entry[1],
            }))
    if (table && typeof table === 'object')
        return Object.keys(table)
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .filter((key) => Array.isArray(table[key]))
            .map((key) => ({ label: key, color: table[key] }))
    return []
}

function rampGradient(name) {
    const reverse = name.endsWith('_r') || name.endsWith('-r')
    const mapName = reverse ? name.slice(0, -2) : name
    const colors = Array.from({ length: 17 }, (_, index) => {
        const position = (reverse ? 16 - index : index) / 16
        const [r, g, b] = evaluate_cmap(position, mapName, false)
        return `rgb(${r},${g},${b}) ${Math.round((index / 16) * 100)}%`
    })
    return `linear-gradient(90deg, ${colors.join(',')})`
}

function refreshCog(layer) {
    const renderer = L_.layers.layer[layer.name]
    if (!renderer) return
    if (layer.type === 'image' && renderer.updateColors) {
        const minimum = layer.currentCogMin ?? layer.cogMin ?? 0
        const maximum = layer.currentCogMax ?? layer.cogMax ?? 255
        const configuredMap = layer.cogColormap || 'binary'
        const reverse =
            configuredMap.endsWith('_r') || configuredMap.endsWith('-r')
        const colorMap = reverse
            ? configuredMap.slice(0, -2)
            : configuredMap
        const noData = renderer.options?.georaster?.noDataValue
        const fillMinMax = layer.variables?.image?.fillMinMax === true
        renderer.clearCache?.()
        renderer.updateColors((values) => {
            const normalized = (values[0] - minimum) / (maximum - minimum)
            if (values[0] === noData)
                return layer.variables?.hideNoDataValue ? null : [0, 0, 0]
            if (normalized < 0 || normalized > 1) {
                if (!fillMinMax) return null
                return evaluate_cmap(
                    Math.max(0, Math.min(1, normalized)),
                    colorMap,
                    reverse
                )
            }
            return evaluate_cmap(normalized, colorMap, reverse)
        })
    } else if (layer.type === 'velocity') {
        renderer.options.minVelocity =
            layer.currentCogMin ?? layer.variables?.streamlines?.minVelocity
        renderer.options.maxVelocity =
            layer.currentCogMax ?? layer.variables?.streamlines?.maxVelocity
        Map_.map?.removeLayer(renderer)
        renderer.addTo?.(Map_.map)
    } else {
        renderer.refresh?.(null, true, {
            currentCogMin: layer.currentCogMin,
            currentCogMax: layer.currentCogMax,
            currentCogExpression: layer.currentCogExpression,
            cogColormap: layer.cogColormap,
        })
    }
    L_.Globe_?.litho?.updateLayerCogParameters?.(layer.name, {
        currentCogMin: layer.currentCogMin,
        currentCogMax: layer.currentCogMax,
        currentCogExpression: layer.currentCogExpression,
        cogColormap: layer.cogColormap,
    })
    ToolController_.getTool('LayersTool2')?.populateCogScale?.(layer.name)
}

function DisplaySettings({ layer, api }) {
    const filters = L_.layers.filters[layer.name] || {}
    const getFilter = (key, fallback) =>
        Number(filters[key] ?? layer.style?.[key] ?? fallback)
    return (
        <div className="lt2-typeSettingsList">
            <LayerSettingsSlider
                label="Brightness"
                value={getFilter('brightness', 1)}
                max={3}
                step={0.05}
                defaultValue={layer.style?.brightness ?? 1}
                onChange={(value) => api.setTileFilter('brightness', value)}
            />
            <LayerSettingsSlider
                label="Contrast"
                value={getFilter('contrast', 1)}
                max={4}
                step={0.05}
                defaultValue={layer.style?.contrast ?? 1}
                onChange={(value) => api.setTileFilter('contrast', value)}
            />
            <LayerSettingsSlider
                label="Saturation"
                value={getFilter('saturate', layer.style?.saturation ?? 1)}
                max={4}
                step={0.05}
                defaultValue={layer.style?.saturation ?? 1}
                onChange={(value) => api.setTileFilter('saturate', value)}
            />
            <div className="lt2-typeSettingsField">
                <span>Blend</span>
                <Select
                    aria-label="Blend mode"
                    value={filters['mix-blend-mode'] || layer.style?.blend || 'unset'}
                    options={BLEND_MODES.map((value) => ({
                        value,
                    label: value === 'unset' ? 'none' : value,
                    }))}
                    onValueChange={(value) => api.setBlend(value)}
                />
            </div>
        </div>
    )
}

function CogSettings({ layer, resetToken }) {
    const initial = defaultsFor(layer)
    const [expression, setExpression] = useState(
        layer.currentCogExpression || layer.cogExpression || ''
    )
    const reset = useRef(resetToken)
    useEffect(() => {
        setExpression(layer.currentCogExpression || layer.cogExpression || '')
        if (reset.current === resetToken) return
        reset.current = resetToken
        layer.currentCogMin = layer.cogMin
        layer.currentCogMax = layer.cogMax
        layer.currentCogExpression = initial.expression || null
        layer.cogColormap = initial.colorMap
        refreshCog(layer)
    }, [layer, resetToken, initial])

    const minimum =
        layer.currentCogMin ??
        layer.cogMin ??
        layer.variables?.streamlines?.minVelocity ??
        0
    const maximum =
        layer.currentCogMax ??
        layer.cogMax ??
        layer.variables?.streamlines?.maxVelocity ??
        255
    const updateRange = (key, value) => {
        const number = Number(value)
        if (!Number.isFinite(number)) return
        if (key === 'min')
            layer.currentCogMin = Math.min(number, layer.currentCogMax ?? maximum)
        else
            layer.currentCogMax = Math.max(number, layer.currentCogMin ?? minimum)
        refreshCog(layer)
    }
    const colormap =
        layer.cogColormap && RAMP_NAMES.includes(
            layer.cogColormap.replace(/[_-]r$/, '')
        )
            ? layer.cogColormap
            : 'viridis'
    const colorTable = colorTableEntries(layer.cogColormapJson)
    return (
        <div className="lt2-typeSettingsList">
            <div className="lt2-typeSettingsCogLegend">
                <div>Applied rescale: {minimum} — {maximum} {layer.cogUnits || ''}</div>
                {colorTable.length > 0 ? (
                    <div className="lt2-typeSettingsColorTable" aria-label="Custom color table legend">
                        {colorTable.map(({ label, color }, index) => (
                            <div className="lt2-typeSettingsColorEntry" key={`${label}-${index}`} title={label}>
                                <span
                                    style={{
                                        backgroundColor: `rgba(${color[0] || 0},${color[1] || 0},${color[2] || 0},${color[3] == null ? 1 : color[3] / 255})`,
                                    }}
                                />
                                {label && <small>{label}</small>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        className="lt2-typeSettingsLegendRamp"
                        style={{ background: rampGradient(colormap) }}
                        role="img"
                        aria-label={`${colormap} colormap legend`}
                    />
                )}
            </div>
            <div className="lt2-typeSettingsField">
                <span>Color ramp</span>
                <ColorRampPicker
                    value={colormap}
                    ramps={COLOR_RAMPS}
                    portal
                    showNames
                    aria-label="Color ramp"
                    onValueChange={(value) => {
                        layer.cogColormap = value
                        refreshCog(layer)
                    }}
                />
            </div>
            <label className="lt2-typeSettingsField">
                <span>Rescale minimum</span>
                <span className="lt2-typeSettingsInputUnit">
                    <TextInput
                        type="number"
                        value={minimum}
                        onChange={(event) =>
                            updateRange('min', event.target.value)
                        }
                    />
                    {layer.cogUnits}
                </span>
            </label>
            <label className="lt2-typeSettingsField">
                <span>Rescale maximum</span>
                <span className="lt2-typeSettingsInputUnit">
                    <TextInput
                        type="number"
                        value={maximum}
                        onChange={(event) =>
                            updateRange('max', event.target.value)
                        }
                    />
                    {layer.cogUnits}
                </span>
            </label>
            {layer.cogExpressionEditable === true && (
                <div className="lt2-typeSettingsExpression">
                    <label htmlFor={`lt2-expression-${layer.name}`}>
                        Band math expression
                    </label>
                    <TextInput
                        id={`lt2-expression-${layer.name}`}
                        value={expression}
                        placeholder="e.g., b1*2 or (b1+b2)/2"
                        onChange={(event) => setExpression(event.target.value)}
                    />
                    <div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                layer.currentCogExpression = expression.trim()
                                refreshCog(layer)
                            }}
                        >
                            Apply
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setExpression(initial.expression || '')
                                layer.currentCogExpression =
                                    initial.expression || null
                                layer.cogColormap = initial.colorMap
                                refreshCog(layer)
                            }}
                        >
                            Reset expression
                        </Button>
                    </div>
                </div>
            )}
            <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                    layer.currentCogMin = layer.cogMin
                    layer.currentCogMax = layer.cogMax
                    layer.currentCogExpression = initial.expression || null
                    layer.cogColormap = initial.colorMap
                    setExpression(initial.expression || '')
                    refreshCog(layer)
                }}
            >
                Reset COG
            </Button>
        </div>
    )
}

export default {
    sections(layer) {
        const sections = []
        if (layer.type !== 'image')
            sections.push({
                id: 'tile-display',
                label: 'Display filters',
                order: 10,
                Component: DisplaySettings,
            })
        if (isCog(layer))
            sections.push({
                id: 'cog',
                label: 'COG',
                order: 20,
                Component: CogSettings,
            })
        return sections
    },
    actions: () => [],
    status: (layer) => {
        const rendering = L_.layers.layer[layer.name]
        return rendering === false
            ? { kind: 'loading', message: 'Loading tile layer' }
            : null
    },
}
