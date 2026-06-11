import React, { forwardRef } from 'react'
import styles from './ProgressButton.module.css'

const ProgressButton = forwardRef(function ProgressButton(
    {
        children,
        active = false,
        loading = false,
        progress = 0,
        indeterminate = false,
        className,
        ...props
    },
    ref
) {
    const isIndeterminate = loading && (indeterminate || progress <= 0)
    const cls = [
        styles.root,
        active && !loading ? styles.active : '',
        loading ? styles.loading : '',
        isIndeterminate ? styles.indeterminate : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button ref={ref} className={cls} disabled={!active || loading} {...props}>
            {loading && !isIndeterminate && (
                <span
                    className={styles.fill}
                    style={{ width: progress + '%' }}
                />
            )}
            {isIndeterminate && (
                <span className={styles.indeterminateFill} />
            )}
            <span className={styles.label}>
                {loading
                    ? isIndeterminate
                        ? children
                        : `${children} ${Math.round(progress)}%`
                    : children}
            </span>
        </button>
    )
})

export default ProgressButton
