import React, { forwardRef } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import styles from './Checkbox.module.css'

const Checkbox = forwardRef(function Checkbox(
    { checked, onCheckedChange, children, className, ...props },
    ref
) {
    return (
        <label className={`${styles.label} ${className || ''}`}>
            <BaseCheckbox.Root
                ref={ref}
                checked={checked}
                onCheckedChange={onCheckedChange}
                className={styles.root}
                {...props}
            >
                <BaseCheckbox.Indicator className={styles.indicator}>
                    <i className="mdi mdi-check mdi-14px" />
                </BaseCheckbox.Indicator>
            </BaseCheckbox.Root>
            {children && <span className={styles.text}>{children}</span>}
        </label>
    )
})

export default Checkbox
