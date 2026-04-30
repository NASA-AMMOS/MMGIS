import React, { forwardRef } from 'react'
import { Button as BaseButton } from '@base-ui-components/react/button'
import styles from './IconButton.module.css'

const IconButton = forwardRef(function IconButton({ size = 'md', active, className, children, ...props }, ref) {
    return (
        <BaseButton
            ref={ref}
            className={`${styles.iconButton} ${styles[size] || ''} ${active ? styles.active : ''} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseButton>
    )
})

export default IconButton
