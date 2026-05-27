import React, { forwardRef } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import styles from './Button.module.css'

const Button = forwardRef(function Button(
    { variant = 'secondary', size = 'md', className, children, ...props },
    ref
) {
    return (
        <BaseButton
            ref={ref}
            className={`${styles.button} ${styles[variant] || ''} ${styles[size] || ''} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseButton>
    )
})

export default Button
