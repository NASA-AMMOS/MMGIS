import React from 'react'
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import styles from './Collapsible.module.css'

function Collapsible({ open, onOpenChange, children, className, ...props }) {
    return (
        <BaseCollapsible.Root
            open={open}
            onOpenChange={onOpenChange}
            className={`${styles.root} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseCollapsible.Root>
    )
}

function CollapsibleTrigger({ children, className, ...props }) {
    return (
        <BaseCollapsible.Trigger
            className={`${styles.trigger} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseCollapsible.Trigger>
    )
}

function CollapsibleContent({ children, className, ...props }) {
    return (
        <BaseCollapsible.Panel
            className={`${styles.panel} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseCollapsible.Panel>
    )
}

Collapsible.Trigger = CollapsibleTrigger
Collapsible.Content = CollapsibleContent

export default Collapsible
