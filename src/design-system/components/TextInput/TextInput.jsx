import React, { forwardRef } from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import styles from './TextInput.module.css'

const TextInput = forwardRef(function TextInput(
    { className, ...props },
    ref
) {
    return (
        <BaseInput
            ref={ref}
            className={`${styles.input} ${className || ''}`}
            {...props}
        />
    )
})

export default TextInput
