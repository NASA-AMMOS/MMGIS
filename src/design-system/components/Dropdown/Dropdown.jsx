import React, { useState, useRef, useEffect, useCallback, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import styles from './Dropdown.module.css'

function Dropdown({ trigger, children, align = 'end', className }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const popupRef = useRef(null)
    const [position, setPosition] = useState({ top: 0, left: 0 })

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        const top = rect.bottom + 4
        const left = align === 'end' ? rect.right : rect.left
        setPosition({ top, left })
    }, [align])

    const handleToggle = useCallback((e) => {
        e.stopPropagation()
        setOpen((prev) => {
            if (!prev) updatePosition()
            return !prev
        })
    }, [updatePosition])

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handleClick = (e) => {
            if (
                popupRef.current && !popupRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)
            ) {
                setOpen(false)
            }
        }
        const handleEsc = (e) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', handleClick, true)
        document.addEventListener('keydown', handleEsc)
        return () => {
            document.removeEventListener('mousedown', handleClick, true)
            document.removeEventListener('keydown', handleEsc)
        }
    }, [open])

    const triggerEl = cloneElement(trigger, {
        ref: (node) => {
            triggerRef.current = node
            const origRef = trigger.ref
            if (typeof origRef === 'function') origRef(node)
            else if (origRef) origRef.current = node
        },
        onClick: (e) => {
            handleToggle(e)
            trigger.props.onClick?.(e)
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
    })

    return (
        <>
            {triggerEl}
            {open && createPortal(
                <div
                    ref={popupRef}
                    className={`${styles.popup} ${className || ''}`}
                    style={{
                        position: 'fixed',
                        top: position.top,
                        ...(align === 'end'
                            ? { right: window.innerWidth - position.left }
                            : { left: position.left }),
                    }}
                    role="menu"
                >
                    {React.Children.map(children, (child) => {
                        if (!child) return null
                        if (child.type === DropdownItem) {
                            return cloneElement(child, {
                                _closeMenu: () => setOpen(false),
                            })
                        }
                        return child
                    })}
                </div>,
                document.body
            )}
        </>
    )
}

function DropdownItem({ children, className, onClick, _closeMenu, ...props }) {
    const handleClick = useCallback((e) => {
        onClick?.(e)
        _closeMenu?.()
    }, [onClick, _closeMenu])

    return (
        <div
            className={`${styles.item} ${className || ''}`}
            role="menuitem"
            tabIndex={-1}
            onClick={handleClick}
            {...props}
        >
            {children}
        </div>
    )
}

Dropdown.Item = DropdownItem

export default Dropdown
