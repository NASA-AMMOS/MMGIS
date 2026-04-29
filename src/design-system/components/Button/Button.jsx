import React from 'react'
import { Button as BaseButton } from '@base-ui-components/react/button'
import styles from './Button.module.css'

function Button({ variant = 'secondary', size = 'md', className, children, ...props }) {
    return (
        <BaseButton
            className={`${styles.button} ${styles[variant] || ''} ${styles[size] || ''} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseButton>
    )
}

export default Button
