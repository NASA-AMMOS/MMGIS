import React, { forwardRef, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './ColorRampPicker.module.css'

// Build a CSS linear-gradient string from a color ramp.
// For the sightline ramp, alpha goes from 0 (left / 0% visible) to 1 (right / 100% visible)
// so prominent color denotes line-of-sight.
function buildGradient(colors, isSightline, hasAlpha) {
    if (!colors || colors.length === 0) return 'transparent'
    const n = colors.length - 1
    const steps = 32
    const stops = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        // Interpolate color
        const scaled = t * n
        const lo = Math.min(Math.floor(scaled), n)
        const hi = Math.min(lo + 1, n)
        const f = scaled - lo
        const r = Math.round((colors[lo][0] + (colors[hi][0] - colors[lo][0]) * f) * 255)
        const g = Math.round((colors[lo][1] + (colors[hi][1] - colors[lo][1]) * f) * 255)
        const b = Math.round((colors[lo][2] + (colors[hi][2] - colors[lo][2]) * f) * 255)
        let a = 1
        if (isSightline) {
            a = t
        } else if (hasAlpha && colors[lo].length > 3) {
            const aLo = colors[lo][3] != null ? colors[lo][3] : 1
            const aHi = colors[hi][3] != null ? colors[hi][3] : 1
            a = aLo + (aHi - aLo) * f
        }
        stops.push(`rgba(${r},${g},${b},${a.toFixed(2)}) ${(t * 100).toFixed(1)}%`)
    }
    return `linear-gradient(to right, ${stops.join(', ')})`
}

const CHECKERBOARD_BG =
    'linear-gradient(45deg, #555 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #555 75%), ' +
    'linear-gradient(45deg, transparent 75%, #555 75%), ' +
    'linear-gradient(45deg, #555 25%, #999 25%)'

/**
 * @param {object} props
 * @param {boolean} [props.portal]  Draw the list over the page instead of
 *   inside the picker - for a picker that sits in a panel that clips what
 *   overflows it, where the list would otherwise be cut off.
 */
const ColorRampPicker = forwardRef(function ColorRampPicker(
    { value, onValueChange, ramps, className, portal, ...props },
    ref
) {
    const [open, setOpen] = useState(false)
    const [anchor, setAnchor] = useState(null)
    const containerRef = useRef(null)
    const popupRef = useRef(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e) {
            const inPicker = containerRef.current?.contains(e.target)
            const inPopup = popupRef.current?.contains(e.target)
            if (!inPicker && !inPopup) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    function toggle() {
        if (!open && portal && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setAnchor({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
            })
        }
        setOpen(!open)
    }

    const rampEntries = useMemo(() => {
        if (!ramps) return []
        return ramps.map((r) => {
            const isSightline = r.name === 'sightline'
            const hasAlpha = !!r.hasAlpha || isSightline
            return {
                name: r.name,
                gradient: buildGradient(r.colors, isSightline, hasAlpha),
                hasAlpha,
            }
        })
    }, [ramps])

    const selected = rampEntries.find((r) => r.name === value) || rampEntries[0]

    const list = (
        <div
            ref={popupRef}
            className={styles.popup}
            style={
                portal && anchor
                    ? { position: 'fixed', ...anchor, marginTop: 0 }
                    : undefined
            }
        >
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
                    <SwatchBar gradient={r.gradient} hasAlpha={r.hasAlpha} />
                </button>
            ))}
        </div>
    )

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
                onClick={toggle}
            >
                <SwatchBar gradient={selected?.gradient} hasAlpha={selected?.hasAlpha} />
                <i className="mdi mdi-chevron-down mdi-14px" style={{ flexShrink: 0, color: 'var(--color-a3)' }} />
            </button>
            {open && (portal ? createPortal(list, document.body) : list)}
        </div>
    )
})

function SwatchBar({ gradient, hasAlpha }) {
    if (!gradient) return null
    return (
        <div className={styles.swatchBar}>
            {hasAlpha && (
                <div
                    className={styles.swatchBlock}
                    style={{
                        backgroundImage: CHECKERBOARD_BG,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 0, -4px -4px, 4px 4px',
                        position: 'absolute',
                        inset: 0,
                    }}
                />
            )}
            <div
                className={styles.swatchBlock}
                style={{
                    backgroundImage: gradient,
                    position: hasAlpha ? 'relative' : undefined,
                    flex: 1,
                }}
            />
        </div>
    )
}

export default ColorRampPicker
