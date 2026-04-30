import React, { useState, useRef, useCallback, useEffect, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

function Tooltip({ content, placement = 'right', delay = 200, children, className }) {
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const timerRef = useRef(null)
    const popupRef = useRef(null)

    const updatePosition = useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const gap = 6

        let top, left
        switch (placement) {
            case 'top':
                top = rect.top - gap
                left = rect.left + rect.width / 2
                break
            case 'bottom':
                top = rect.bottom + gap
                left = rect.left + rect.width / 2
                break
            case 'left':
                top = rect.top + rect.height / 2
                left = rect.left - gap
                break
            case 'right':
            default:
                top = rect.top + rect.height / 2
                left = rect.right + gap
                break
        }
        setCoords({ top, left })
    }, [placement])

    const show = useCallback(() => {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            updatePosition()
            setVisible(true)
        }, delay)
    }, [delay, updatePosition])

    const hide = useCallback(() => {
        clearTimeout(timerRef.current)
        setVisible(false)
    }, [])

    useEffect(() => {
        return () => clearTimeout(timerRef.current)
    }, [])

    // Adjust popup position after it renders so we can measure it
    useEffect(() => {
        if (visible && popupRef.current) {
            const popup = popupRef.current
            const rect = popup.getBoundingClientRect()
            if (placement === 'top' || placement === 'bottom') {
                popup.style.marginLeft = `${-rect.width / 2}px`
            }
            if (placement === 'top') {
                popup.style.marginTop = `${-rect.height}px`
            }
            if (placement === 'left') {
                popup.style.marginLeft = `${-rect.width}px`
                popup.style.marginTop = `${-rect.height / 2}px`
            }
            if (placement === 'right') {
                popup.style.marginTop = `${-rect.height / 2}px`
            }
        }
    }, [visible, coords, placement])

    if (!content) return children

    const child = React.Children.only(children)
    const trigger = cloneElement(child, {
        ref: (node) => {
            triggerRef.current = node
            const { ref } = child
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
        },
        onMouseEnter: (e) => {
            show()
            child.props.onMouseEnter?.(e)
        },
        onMouseLeave: (e) => {
            hide()
            child.props.onMouseLeave?.(e)
        },
        onFocus: (e) => {
            show()
            child.props.onFocus?.(e)
        },
        onBlur: (e) => {
            hide()
            child.props.onBlur?.(e)
        },
    })

    return (
        <>
            {trigger}
            {visible && createPortal(
                <div
                    ref={popupRef}
                    className={`${styles.popup} ${className || ''}`}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                    }}
                    role="tooltip"
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    )
}

export default Tooltip
