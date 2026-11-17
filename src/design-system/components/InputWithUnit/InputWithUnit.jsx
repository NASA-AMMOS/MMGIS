import React, { forwardRef } from 'react'
import styles from './InputWithUnit.module.css'

const InputWithUnit = forwardRef(function InputWithUnit(
    { unit, className, ...inputProps },
    ref
) {
    return (
        <div className={`${styles.wrapper} ${className || ''}`}>
            <input ref={ref} className={styles.input} {...inputProps} />
            <span className={styles.unit}>{unit}</span>
        </div>
    )
})

export default InputWithUnit
