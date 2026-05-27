import React, { useCallback } from 'react'
import useShadeStore from '../store'

export default function ShadeOptions({ elmId }) {
    const vars = useShadeStore((s) => s.vars)
    const el = useShadeStore((s) => s.elements[elmId])
    const updateElement = useShadeStore((s) => s.updateElement)

    const handleChange = useCallback(
        (field, value) => {
            updateElement(elmId, { [field]: value, changed: true })
        },
        [elmId, updateElement]
    )

    if (!el) return null

    const allData =
        vars?.data?.map((d, i) => (
            <option key={i} value={i}>
                {d.name}
            </option>
        )) || []

    const allObservers =
        vars?.observers?.map((o, i) => (
            <option key={i} value={o.value}>
                {o.name}
            </option>
        )) || []

    return (
        <>
            <div className="vstOptionCompositeMode">
                <div title="How to composite shadows from multiple sources.">
                    Composite
                </div>
                <select
                    className="dropdown"
                    value={el.compositeMode}
                    onChange={(e) =>
                        handleChange('compositeMode', e.target.value)
                    }
                >
                    <option value="or">Shadow from Any (OR)</option>
                    <option value="and">Shadow from All (AND)</option>
                </select>
            </div>
            <div className="vstOptionIncludeSunEarth">
                <div title="Query for and show Sun and Earth az/el directional arrows">
                    Include{' '}
                    <span style={{ color: '#d2db58' }}>Sun</span> +{' '}
                    <span style={{ color: '#58dbb8' }}>Earth</span>
                </div>
                <select
                    className="dropdown"
                    value={el.includeSunEarth}
                    onChange={(e) =>
                        handleChange('includeSunEarth', e.target.value)
                    }
                >
                    <option value="false">False</option>
                    <option value="true">True</option>
                </select>
            </div>
            <div className="vstOptionHeading">Observer</div>
            {allObservers.length > 0 && (
                <>
                    <div className="vstOptionObserver">
                        <div title="Ground observer for time conversions">
                            Entity
                        </div>
                        <select
                            className="dropdown"
                            value={el.observer || ''}
                            onChange={(e) =>
                                handleChange('observer', e.target.value)
                            }
                        >
                            {allObservers}
                        </select>
                    </div>
                    <div className="vstOptionTimeSpecific">
                        <div title="Ground observer time">Time</div>
                        <div className="flexbetween">
                            <div className="vstClockIcon2">
                                <i className="mdi mdi-clock-outline mdi-18px" />
                            </div>
                            <input
                                type="text"
                                placeholder={
                                    vars?.observerTimePlaceholder || ''
                                }
                                defaultValue=""
                            />
                        </div>
                    </div>
                </>
            )}
            <div className="vstOptionHeight">
                <div title="Height above surface of source point.">Height</div>
                <div className="flexbetween">
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={el.height}
                        onChange={(e) =>
                            handleChange('height', parseFloat(e.target.value))
                        }
                    />
                    <div className="vstUnit smallFont">m</div>
                </div>
            </div>
            <div className="vstOptionHeading">Shaded Region Options</div>
            <div className="vstOptionOpacity">
                <div>Opacity</div>
                <input
                    className="slider2"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={el.opacity}
                    onChange={(e) =>
                        handleChange('opacity', parseFloat(e.target.value))
                    }
                />
            </div>
            <div className="vstOptionResolution">
                <div title="High or Ultra disables auto-regeneration.">
                    Resolution
                </div>
                <select
                    className="dropdown"
                    value={el.resolution}
                    onChange={(e) =>
                        handleChange('resolution', parseInt(e.target.value))
                    }
                >
                    <option value={0}>Low</option>
                    <option value={1}>Medium</option>
                    <option value={2}>High</option>
                    <option value={3}>Ultra</option>
                </select>
            </div>
            <div className="vstOptionData">
                <div title="Dataset to shade.">Elevation Map</div>
                <select
                    className="dropdown"
                    value={el.dataIndex}
                    onChange={(e) =>
                        handleChange('dataIndex', parseInt(e.target.value))
                    }
                >
                    {allData}
                </select>
            </div>
        </>
    )
}
