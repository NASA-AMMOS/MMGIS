import React, { forwardRef } from 'react'
import styles from './Select.module.css'

const Select = forwardRef(function Select(
    { value, onValueChange, options, placeholder, className, ...props },
    ref
) {
    return (
        <select
            ref={ref}
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
            className={`${styles.trigger} ${className || ''}`}
            {...props}
        >
            {placeholder && (
                <option value="" disabled>
                    {placeholder}
                </option>
            )}
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
})

export default Select
