import React, { forwardRef } from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import styles from './Select.module.css'

const Select = forwardRef(function Select(
    { value, onValueChange, options, placeholder, className, ...props },
    ref
) {
    return (
        <BaseSelect.Root value={value} onValueChange={onValueChange} {...props}>
            <BaseSelect.Trigger
                ref={ref}
                className={`${styles.trigger} ${className || ''}`}
            >
                <BaseSelect.Value placeholder={placeholder || 'Select...'} />
                <BaseSelect.Icon className={styles.icon}>
                    <i className="mdi mdi-chevron-down mdi-14px" />
                </BaseSelect.Icon>
            </BaseSelect.Trigger>
            <BaseSelect.Portal>
                <BaseSelect.Positioner className={styles.positioner}>
                    <BaseSelect.Popup className={styles.popup}>
                        {options.map((opt) => (
                            <BaseSelect.Item
                                key={opt.value}
                                value={opt.value}
                                className={styles.option}
                            >
                                <BaseSelect.ItemIndicator className={styles.optionIndicator}>
                                    <i className="mdi mdi-check mdi-12px" />
                                </BaseSelect.ItemIndicator>
                                <BaseSelect.ItemText>
                                    {opt.label}
                                </BaseSelect.ItemText>
                            </BaseSelect.Item>
                        ))}
                    </BaseSelect.Popup>
                </BaseSelect.Positioner>
            </BaseSelect.Portal>
        </BaseSelect.Root>
    )
})

export default Select
