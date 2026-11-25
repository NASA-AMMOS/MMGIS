import React, { forwardRef } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import styles from './Checkbox.module.css'

const Checkbox = forwardRef(function Checkbox(
    {
        checked,
        indeterminate,
        onCheckedChange,
        children,
        className,
        showCheck,
        ...props
    },
    ref
) {
    return (
        <label className={`${styles.label} ${className || ''}`}>
            <BaseCheckbox.Root
                ref={ref}
                checked={checked}
                indeterminate={indeterminate}
                onCheckedChange={onCheckedChange}
                className={styles.root}
                {...props}
            >
                <BaseCheckbox.Indicator
                    className={
                        showCheck || indeterminate
                            ? styles.indicatorVisible
                            : styles.indicator
                    }
                >
                    <i
                        className={`mdi mdi-${indeterminate ? 'minus' : 'check'} mdi-14px`}
                    />
                </BaseCheckbox.Indicator>
            </BaseCheckbox.Root>
            {children && <span className={styles.text}>{children}</span>}
        </label>
    )
})

export default Checkbox
