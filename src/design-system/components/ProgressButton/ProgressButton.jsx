import React, { forwardRef } from 'react'
import styles from './ProgressButton.module.css'

const ProgressButton = forwardRef(function ProgressButton(
    {
        children,
        active = false,
        loading = false,
        progress = 0,
        className,
        ...props
    },
    ref
) {
    const cls = [
        styles.root,
        active && !loading ? styles.active : '',
        loading ? styles.loading : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button ref={ref} className={cls} disabled={!active || loading} {...props}>
            {loading && (
                <span
                    className={styles.fill}
                    style={{ width: progress + '%' }}
                />
            )}
            <span className={styles.label}>
                {loading ? `${Math.round(progress)}%` : children}
            </span>
        </button>
    )
})

export default ProgressButton
