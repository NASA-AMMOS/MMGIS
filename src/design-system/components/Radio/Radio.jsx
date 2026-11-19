import React, { forwardRef } from 'react'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import styles from './Radio.module.css'

const Radio = forwardRef(function Radio(
    { value, onValueChange, options, className, ...props },
    ref
) {
    return (
        <BaseRadioGroup
            ref={ref}
            value={value}
            onValueChange={onValueChange}
            className={`${styles.group} ${className || ''}`}
            {...props}
        >
            {options.map((option) => (
                <label
                    key={option.value}
                    className={`${styles.option} ${option.disabled ? styles.disabled : ''}`}
                >
                    <BaseRadio.Root
                        className={styles.root}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        <BaseRadio.Indicator className={styles.indicator} />
                    </BaseRadio.Root>
                    <span className={styles.text}>{option.label}</span>
                </label>
            ))}
        </BaseRadioGroup>
    )
})

export default Radio
