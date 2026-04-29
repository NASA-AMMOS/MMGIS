import React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip'
import styles from './Tooltip.module.css'

function Tooltip({ content, placement = 'right', delay = 200, children, className, ...props }) {
    return (
        <BaseTooltip.Root {...props}>
            <BaseTooltip.Trigger render={children} delay={delay}>
            </BaseTooltip.Trigger>
            <BaseTooltip.Portal>
                <BaseTooltip.Positioner side={placement} sideOffset={6}>
                    <BaseTooltip.Popup className={`${styles.popup} ${className || ''}`}>
                        {content}
                    </BaseTooltip.Popup>
                </BaseTooltip.Positioner>
            </BaseTooltip.Portal>
        </BaseTooltip.Root>
    )
}

export default Tooltip
