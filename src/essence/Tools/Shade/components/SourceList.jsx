import React, { useCallback } from 'react'
import useShadeStore, { MULTI_SOURCE_COLORS, buildSourcesList } from '../store'

export default function SourceList({ elmId }) {
    const vars = useShadeStore((s) => s.vars)
    const el = useShadeStore((s) => s.elements[elmId])
    const toggleSourceSelection = useShadeStore(
        (s) => s.toggleSourceSelection
    )

    const sourcesList = buildSourcesList(vars)
    const selected = el?.selectedSourceIndices || []

    const handleToggle = useCallback(
        (index) => {
            toggleSourceSelection(elmId, index)
        },
        [elmId, toggleSourceSelection]
    )

    return (
        <div className="vstOptionTarget">
            <div
                title='Orbiter or body that is the source of "light". Select one or more.'
            >
                <span style={{ color: 'var(--color-p0)' }}>Entity</span>
            </div>
            <div className="vstSourceList">
                {sourcesList.map((src, i) => {
                    const color =
                        MULTI_SOURCE_COLORS[i % MULTI_SOURCE_COLORS.length]
                    const isOn = selected.includes(i)
                    return (
                        <div
                            key={i}
                            className="vstSourceItem"
                            data-value={src.value}
                            data-index={i}
                            onClick={() => handleToggle(i)}
                        >
                            <div
                                className={
                                    'vstSourceCheck' + (isOn ? ' on' : '')
                                }
                            />
                            <span
                                className="vstSourceSwatch"
                                style={{
                                    background: `rgb(${color.r},${color.g},${color.b})`,
                                }}
                            />
                            <span>{src.name}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
