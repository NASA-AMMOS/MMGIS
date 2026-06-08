import React, { forwardRef } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import styles from './IconTextButton.module.css'

const IconTextButton = forwardRef(function IconTextButton(
    { icon, children, size = 'md', active, className, ...props },
    ref
) {
    return (
        <BaseButton
            ref={ref}
            className={`${styles.root} ${styles[size] || ''} ${active ? styles.active : ''} ${className || ''}`}
            {...props}
        >
            {icon && <span className={styles.icon}>{icon}</span>}
            {children && <span className={styles.label}>{children}</span>}
        </BaseButton>
    )
})

export default IconTextButton
