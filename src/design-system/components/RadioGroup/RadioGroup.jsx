import React, { forwardRef } from 'react'
import styles from './RadioGroup.module.css'

const RadioGroup = forwardRef(function RadioGroup(
    { value, onValueChange, options, size = 'sm', className, ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={`${styles.group} ${styles[size] || ''} ${className || ''}`}
            role="radiogroup"
            {...props}
        >
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={value === opt.value}
                    className={`${styles.option} ${value === opt.value ? styles.active : ''}`}
                    onClick={() => onValueChange(opt.value)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
})

export default RadioGroup
