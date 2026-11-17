import React, { forwardRef } from 'react'
import styles from './Switch.module.css'

const Switch = forwardRef(function Switch(
    { checked, onCheckedChange, size = 'sm', className, ...props },
    ref
) {
    return (
        <button
            ref={ref}
            role="switch"
            aria-checked={checked}
            className={`${styles.switch} ${styles[size]} ${checked ? styles.checked : ''} ${className || ''}`}
            onClick={() => onCheckedChange && onCheckedChange(!checked)}
            type="button"
            {...props}
        >
            <span className={styles.thumb} />
        </button>
    )
})

export default Switch
