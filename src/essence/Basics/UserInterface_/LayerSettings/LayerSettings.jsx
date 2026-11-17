import React, { useState } from 'react'
import { Button, IconButton, Tooltip, Slider } from '@design/components'
import './LayerSettings.css'

export function LayerSettingsSection({
    id,
    label,
    children,
    resettable = true,
    onReset,
    defaultOpen = true,
}) {
    const [open, setOpen] = useState(defaultOpen)
    const contentId = `layer-settings-${id}-content`
    return (
        <section className="layerSettingsSection" data-section={id}>
            <div className="layerSettingsSectionHeader">
                <h3 className="layerSettingsSectionHeading">
                    <button
                        id={`layer-settings-${id}-toggle`}
                        type="button"
                        className="layerSettingsSectionToggle"
                        aria-expanded={open}
                        aria-controls={contentId}
                        onClick={() => setOpen((previous) => !previous)}
                    >
                        <i
                            className={`mdi mdi-chevron-right ${open ? 'layerSettingsOpen' : ''}`}
                        />
                        <span>{label}</span>
                    </button>
                </h3>
                {resettable && (
                    <Tooltip content={`Reset ${label}`}>
                        <IconButton
                            size="sm"
                            aria-label={`Reset ${label}`}
                            onClick={onReset}
                        >
                            <i className="mdi mdi-restore mdi-16px" />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
            {open && (
                <div id={contentId} className="layerSettingsSectionBody">{children}</div>
            )}
        </section>
    )
}

export function LayerSettingsSlider({
    label,
    value,
    min = 0,
    max = 1,
    step = 0.01,
    unit = '',
    defaultValue = min,
    onChange,
}) {
    const numeric = Number(value)
    const current = Number.isFinite(numeric) ? numeric : defaultValue
    const changed = Math.abs(current - defaultValue) > step / 2
    return (
        <div className="layerSettingsSlider">
            <div className="layerSettingsSliderLabel">
                <span>{label}</span>
                <span className="layerSettingsSliderValue">
                    {current.toFixed(step < 0.1 ? 2 : 1)}
                    {unit}
                    {changed && (
                        <i
                            className="layerSettingsChangedDot"
                            title="Changed from default"
                        />
                    )}
                </span>
            </div>
            <Slider
                value={current}
                min={min}
                max={max}
                step={step}
                aria-label={label}
                onKeyDown={(event) => {
                    if (event.key !== 'PageUp' && event.key !== 'PageDown') return
                    event.preventDefault()
                    const direction = event.key === 'PageUp' ? 1 : -1
                    onChange(
                        Math.max(min, Math.min(max, current + direction * 0.1))
                    )
                }}
                onValueChange={(next) =>
                    onChange(Array.isArray(next) ? next[0] : next)
                }
            />
        </div>
    )
}

export function LayerSettingsStatusBanner({
    kind,
    message,
    onRetry,
}) {
    const failed = kind === 'failed'
    return (
        <div
            className={`layerSettingsStatusBanner ${failed ? 'layerSettingsStatusError' : 'layerSettingsStatusWarning'}`}
            role={failed ? 'alert' : 'status'}
        >
            <i
                className={`mdi mdi-${failed ? 'alert-circle' : 'cloud-alert'} mdi-16px`}
            />
            <span>{message}</span>
            <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
            </Button>
        </div>
    )
}
