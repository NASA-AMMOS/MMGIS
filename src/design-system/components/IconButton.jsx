import React from 'react'
import { Button as BaseButton } from '@base-ui-components/react/button'
import styles from './IconButton.module.css'

function IconButton({ size = 'md', active, className, children, ...props }) {
    return (
        <BaseButton
            className={`${styles.iconButton} ${styles[size] || ''} ${active ? styles.active : ''} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseButton>
    )
}

export default IconButton
