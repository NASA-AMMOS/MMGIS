import React, { useEffect, useRef } from 'react'
import $ from 'jquery'
import { Checkbox, Select, TextInput } from '@design/components'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import {
    COLOR_ATTRIBUTES,
    DEFAULT_ATTRIBUTE,
    GROUP_STATS,
    STYLE_ATTRIBUTES,
    attributeOf,
    formatValue,
    rulePropertyLabel,
    rulePropertyPath,
    ruleStatOf,
} from '@basics/Layers_/render/dynamicStyle'
import { propertyStats } from '@basics/Layers_/render/dynamicStyleRuntime'
import {
    getDomainMode,
    getViewedRules,
    overrideDynamicStyleRule,
    setDynamicStyleOverride,
} from '@basics/Layers_/render/layerDynamicStyle'
import { restyleLayerDynamically } from '@basics/Layers_/render/dynamicStyleRuntime'
import { LayerSettingsSlider } from '@basics/UserInterface_/LayerSettings/LayerSettings'
import DynamicStyleRamp from '../../tools/Layers/components/DynamicStyleRamp'
import './settings.css'

function FilterSettings({ layer }) {
    const host = useRef(null)
    useEffect(() => {
        if (!host.current || !Filtering.isFilterable(layer.name)) return
        let disposed = false
        Filtering.make($(host.current), layer.name)
            .then(() => {
            if (disposed && Filtering.current.layerName === layer.name)
                Filtering.destroy()
            })
            .catch(() => {})
        return () => {
            disposed = true
            if (Filtering.current.layerName === layer.name)
                Filtering.destroy()
        }
    }, [layer.name])
    return <div className="lt2-typeSettingsFilter" ref={host} />
}

function CompositeSettings({ layer }) {
    const attachments = L_.layers.attachments[layer.name] || {}
    const entries = Object.entries(attachments).filter(([, attachment]) =>
        Boolean(attachment)
    )
    if (entries.length === 0) return <div>No composite layers.</div>
    return (
        <div className="lt2-typeSettingsList">
            {entries.map(([name, attachment]) => (
                <div className="lt2-typeSettingsComposite" key={name}>
                    <div className="lt2-typeSettingsCompositeLine">
                        <span title={attachment.title || name}>
                            {attachment.title || name}
                        </span>
                        <Checkbox
                            checked={attachment.on === true}
                            onCheckedChange={() =>
                                L_.toggleSublayer(layer.name, name)
                            }
                            aria-label={`Toggle ${attachment.title || name}`}
                            showCheck
                        />
                    </div>
                    {attachment.layer?.dropdown && (
                        <Select
                            value={
                                attachment.layer.dropdownValue ||
                                attachment.layer.dropdown[0]
                            }
                            options={attachment.layer.dropdown.map((value) => ({
                                value,
                                label: value,
                            }))}
                            onValueChange={(value) =>
                                attachment.layer.dropdownFunc?.(
                                    layer.name,
                                    name,
                                    Map_,
                                    value
                                )
                            }
                        />
                    )}
                    {attachment.opacity != null && (
                        <LayerSettingsSlider
                            label="Opacity"
                            value={attachment.opacity}
                            onChange={(value) =>
                                L_.setSublayerOpacity(layer.name, name, value)
                            }
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

function DynamicStyleSettings({ layer, api, resetToken }) {
    const style = layer.variables?.dynamicStyle
    const rules = getViewedRules(layer)
    const reset = useRef(resetToken)
    useEffect(() => {
        if (reset.current === resetToken) return
        reset.current = resetToken
        setDynamicStyleOverride(layer, null)
        restyleLayerDynamically(layer)
        api.refresh()
    }, [resetToken, layer, api])
    if (style?.enabled !== true || !Array.isArray(style.rules)) return null

    const restyle = () => {
        restyleLayerDynamically(layer)
        api.refresh()
    }
    const setRule = (index, patch) => {
        overrideDynamicStyleRule(layer, index, patch)
        restyle()
    }
    const userSettable = style.userSettable !== false
    return (
        <div className="lt2-typeSettingsList">
            {userSettable && (
                <div className="lt2-typeSettingsField">
                    <span>Domain</span>
                    <Select
                        value={getDomainMode(layer)}
                        options={[
                            { value: 'dataset', label: 'Whole dataset' },
                            { value: 'view', label: 'Current view' },
                        ]}
                        onValueChange={(domain) => {
                            setDynamicStyleOverride(layer, { domain })
                            restyle()
                        }}
                    />
                </div>
            )}
            {rules.map((rule, index) => {
                const enabled = rule.enabled !== false
                const attribute = attributeOf(rule) || DEFAULT_ATTRIBUTE
                const range = Array.isArray(rule.range) ? rule.range : [0, 1]
                const stats = propertyStats(layer, rulePropertyPath(rule))
                return (
                    <div
                        className="lt2-typeSettingsRule"
                        key={`${rulePropertyPath(rule)}-${index}`}
                    >
                        <div className="lt2-typeSettingsCompositeLine">
                            <strong>{rulePropertyLabel(rule)}</strong>
                            {userSettable && (
                                <Checkbox
                                    checked={enabled}
                                    onCheckedChange={(checked) =>
                                        setRule(index, { enabled: checked })
                                    }
                                    aria-label={`Enable ${rulePropertyLabel(rule)} style rule`}
                                    showCheck
                                />
                            )}
                        </div>
                        {!userSettable || !enabled ? null : (
                            <>
                                {rule.propertyType === 'stats' && (
                                    <div className="lt2-typeSettingsField">
                                        <span>Statistic</span>
                                        <Select
                                            value={ruleStatOf(rule) || 'avg'}
                                            options={GROUP_STATS.map((value) => ({
                                                value,
                                                label: value,
                                            }))}
                                            onValueChange={(stat) =>
                                                setRule(index, { stat })
                                            }
                                        />
                                    </div>
                                )}
                                <div className="lt2-typeSettingsField">
                                    <span>Styles</span>
                                    <Select
                                        value={attribute}
                                        options={STYLE_ATTRIBUTES.map((value) => ({
                                            value,
                                            label: value,
                                        }))}
                                        onValueChange={(next) =>
                                            setRule(index, {
                                                attribute: next,
                                                ...(!COLOR_ATTRIBUTES.includes(next)
                                                    ? { range: [0, 1] }
                                                    : {}),
                                            })
                                        }
                                    />
                                </div>
                                {COLOR_ATTRIBUTES.includes(attribute) ? (
                                    <DynamicStyleRamp
                                        ramp={rule.ramp || 'viridis'}
                                        bins={rule.discrete ? rule.bins || 5 : 0}
                                        stops={rule.stops}
                                        domain={
                                            layer._dynamicStyleResolver?.rules?.[
                                                index
                                            ]?.domain
                                        }
                                        onChange={(patch) =>
                                            setRule(index, patch)
                                        }
                                    />
                                ) : (
                                    <div className="lt2-typeSettingsRange">
                                        <label>
                                            <span>From</span>
                                            <TextInput
                                                type="number"
                                                step="any"
                                                value={range[0]}
                                                onChange={(event) =>
                                                    setRule(index, {
                                                        range: [
                                                            Number(event.target.value),
                                                            range[1],
                                                        ],
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span>To</span>
                                            <TextInput
                                                type="number"
                                                step="any"
                                                value={range[1]}
                                                onChange={(event) =>
                                                    setRule(index, {
                                                        range: [
                                                            range[0],
                                                            Number(event.target.value),
                                                        ],
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                )}
                                {stats && (
                                    <div className="lt2-typeSettingsStats">
                                        <span>
                                            {stats.scope === 'dataset'
                                                ? 'Whole dataset'
                                                : 'Loaded features'}
                                        </span>
                                        <span>Min {formatValue(stats.min)}</span>
                                        <span>Max {formatValue(stats.max)}</span>
                                        <span>Avg {formatValue(stats.avg)}</span>
                                        <span>Std Dev {formatValue(stats.stddev)}</span>
                                        <span>Count {formatValue(stats.count)}</span>
                                        <span>Nulls {formatValue(stats.nullCount)}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function StatisticsSettings({ layer }) {
    const dynamicStyle = layer.variables?.dynamicStyle
    if (
        dynamicStyle?.enabled !== true ||
        dynamicStyle.showStats === false
    )
        return null
    const rules = getViewedRules(layer)
    const rows = rules
        .map((rule) => {
            const stats = propertyStats(layer, rulePropertyPath(rule))
            return stats ? { rule, stats } : null
        })
        .filter(Boolean)
    if (!rows.length) return <div>Statistics are not available yet.</div>
    return (
        <div className="lt2-typeSettingsList">
            {rows.map(({ rule, stats }, index) => (
                <div className="lt2-typeSettingsStats" key={`${rulePropertyPath(rule)}-${index}`}>
                    <strong>{rulePropertyLabel(rule)}</strong>
                    <span>
                        {stats.scope === 'dataset'
                            ? 'Whole dataset'
                            : 'Loaded features'}
                    </span>
                    <span>Min {formatValue(stats.min)}</span>
                    <span>Max {formatValue(stats.max)}</span>
                    <span>Average {formatValue(stats.avg)}</span>
                    <span>Std Dev {formatValue(stats.stddev)}</span>
                    <span>Count {formatValue(stats.count)}</span>
                    <span>Nulls {formatValue(stats.nullCount)}</span>
                </div>
            ))}
        </div>
    )
}

export default {
    sections(layer) {
        const attachments = L_.layers.attachments[layer.name] || {}
        const sections = []
        if (Filtering.isFilterable(layer.name))
            sections.push({
                id: 'filter',
                label: 'Filter',
                order: 10,
                Component: FilterSettings,
            })
        if (Object.values(attachments).some(Boolean))
            sections.push({
                id: 'composite',
                label: 'Composite layers',
                order: 20,
                Component: CompositeSettings,
            })
        if (
            layer.type === 'vector' &&
            layer.variables?.dynamicStyle?.enabled === true
        )
            sections.push(
                {
                    id: 'dynamic-style',
                    label: 'Dynamic style',
                    order: 30,
                    Component: DynamicStyleSettings,
                },
                {
                    id: 'statistics',
                    label: 'Statistics',
                    order: 40,
                    Component: StatisticsSettings,
                }
            )
        return sections
    },
    actions: () => [],
    status: (layer) =>
        layer._loading
            ? { kind: 'loading', message: 'Loading vector layer' }
            : null,
}
