import React from 'react'
import styles from './Toggle.module.css'

function Toggle({ pressed, onPressedChange, children, className, ...props }) {
    return (
        <button
            role="switch"
            aria-checked={pressed}
            className={`${styles.toggle} ${pressed ? styles.active : ''} ${className || ''}`}
            onClick={() => onPressedChange && onPressedChange(!pressed)}
            {...props}
        >
            {children}
        </button>
    )
}

function ToggleGroup({ children, className, ...props }) {
    return (
        <div
            role="group"
            className={`${styles.group} ${className || ''}`}
            {...props}
        >
            {children}
        </div>
    )
}

Toggle.Group = ToggleGroup

export default Toggle
