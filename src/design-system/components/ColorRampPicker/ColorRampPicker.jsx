import React, { forwardRef, useMemo, useRef, useState, useEffect } from 'react'
import styles from './ColorRampPicker.module.css'

function buildGradient(colors, reverse) {
    if (!colors || colors.length === 0) return 'transparent'
    const steps = Math.min(colors.length, 64)
    const stops = []
    for (let i = 0; i < steps; i++) {
        const idx = reverse ? steps - 1 - i : i
        const c = colors[Math.floor((idx / (steps - 1)) * (colors.length - 1))]
        if (!c) continue
        const r = Math.round(c[0] * 255)
        const g = Math.round(c[1] * 255)
        const b = Math.round(c[2] * 255)
        stops.push(`rgb(${r},${g},${b}) ${((i / (steps - 1)) * 100).toFixed(1)}%`)
    }
    return `linear-gradient(to right, ${stops.join(', ')})`
}

const ColorRampPicker = forwardRef(function ColorRampPicker(
    { value, onValueChange, ramps, className, ...props },
    ref
) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    const rampEntries = useMemo(() => {
        if (!ramps) return []
        return ramps.map((r) => ({
            name: r.name,
            label: r.label || r.name,
            gradient: buildGradient(r.colors, r.reverse),
        }))
    }, [ramps])

    const selected = rampEntries.find((r) => r.name === value) || rampEntries[0]

    return (
        <div
            ref={(node) => {
                containerRef.current = node
                if (typeof ref === 'function') ref(node)
                else if (ref) ref.current = node
            }}
            className={`${styles.picker} ${className || ''}`}
            {...props}
        >
            <button
                type="button"
                className={styles.trigger}
                onClick={() => setOpen(!open)}
            >
                <div className={styles.swatch} style={{ background: selected?.gradient || 'transparent' }} />
                <span className={styles.label}>{selected?.label || 'Select...'}</span>
                <i className="mdi mdi-chevron-down mdi-14px" style={{ flexShrink: 0, color: 'var(--color-a3)' }} />
            </button>
            {open && (
                <div className={styles.popup}>
                    {rampEntries.map((r) => (
                        <button
                            key={r.name}
                            type="button"
                            className={`${styles.option} ${r.name === value ? styles.selected : ''}`}
                            onClick={() => {
                                onValueChange(r.name)
                                setOpen(false)
                            }}
                        >
                            <div className={styles.optionSwatch} style={{ background: r.gradient }} />
                            <span className={styles.optionLabel}>{r.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
})

export default ColorRampPicker
