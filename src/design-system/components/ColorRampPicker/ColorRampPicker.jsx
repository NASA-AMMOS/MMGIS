import React, { forwardRef, useMemo, useRef, useState, useEffect } from 'react'
import styles from './ColorRampPicker.module.css'

function buildDiscreteBlocks(colors, bins) {
    if (!colors || colors.length === 0) return []
    const n = colors.length - 1
    const count = bins || colors.length
    const blocks = []
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : (i + 0.5) / count
        const ci = Math.min(Math.floor(t * n), n)
        const c = colors[ci]
        if (!c) continue
        const r = Math.round(c[0] * 255)
        const g = Math.round(c[1] * 255)
        const b = Math.round(c[2] * 255)
        const isBlack = r === 0 && g === 0 && b === 0
        blocks.push({ r, g, b, isBlack })
    }
    return blocks
}

const CHECKERBOARD_BG =
    'linear-gradient(45deg, #555 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #555 75%), ' +
    'linear-gradient(45deg, transparent 75%, #555 75%), ' +
    'linear-gradient(45deg, #555 25%, #999 25%)'

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
            blocks: buildDiscreteBlocks(r.colors, r.bins),
            isTransparentRamp: r.name === 'shadow',
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
                <SwatchBar blocks={selected?.blocks} isTransparent={selected?.isTransparentRamp} />
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
                            <SwatchBar blocks={r.blocks} isTransparent={r.isTransparentRamp} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
})

function SwatchBar({ blocks, isTransparent }) {
    if (!blocks || blocks.length === 0) return null
    const displayBlocks = isTransparent ? [blocks[blocks.length - 1]] : blocks
    return (
        <div className={styles.swatchBar}>
            {isTransparent && (
                <div
                    className={styles.swatchBlock}
                    style={{
                        backgroundImage: CHECKERBOARD_BG,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 0, -4px -4px, 4px 4px',
                        flex: 1,
                    }}
                />
            )}
            {displayBlocks.map((b, i) => (
                <div
                    key={i}
                    className={styles.swatchBlock}
                    style={{
                        background: `rgb(${b.r},${b.g},${b.b})`,
                        flex: 1,
                    }}
                />
            ))}
        </div>
    )
}

export default ColorRampPicker
