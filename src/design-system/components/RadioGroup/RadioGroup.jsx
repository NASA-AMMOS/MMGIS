import React, { forwardRef } from 'react'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import styles from './RadioGroup.module.css'

const RadioGroup = forwardRef(function RadioGroup(
    {
        value,
        onValueChange,
        options,
        size = 'sm',
        variant,
        className,
        ...props
    },
    ref
) {
    return (
        <BaseRadioGroup
            ref={ref}
            value={value}
            onValueChange={(nextValue) => onValueChange(nextValue)}
            className={`${styles.group} ${styles[size] || ''} ${variant === 'segmented' ? styles.segmented : ''} ${className || ''}`}
            {...props}
        >
            {options.map((opt) => (
                <BaseRadio.Root
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={`${styles.option} ${value === opt.value ? styles.active : ''}`}
                >
                    {opt.label}
                </BaseRadio.Root>
            ))}
        </BaseRadioGroup>
    )
})

export default RadioGroup
