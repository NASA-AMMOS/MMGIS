import React from 'react'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import styles from './Menu.module.css'

function Menu({ trigger, align = 'end', children }) {
    return (
        <BaseMenu.Root>
            <BaseMenu.Trigger render={trigger} />
            <BaseMenu.Portal>
                <BaseMenu.Positioner
                    className={styles.positioner}
                    side="bottom"
                    align={align}
                    sideOffset={4}
                >
                    <BaseMenu.Popup className={styles.popup}>
                        {children}
                    </BaseMenu.Popup>
                </BaseMenu.Positioner>
            </BaseMenu.Portal>
        </BaseMenu.Root>
    )
}

function MenuItem({ children, className, danger, ...props }) {
    return (
        <BaseMenu.Item
            className={`${styles.item} ${danger ? styles.danger : ''} ${className || ''}`}
            {...props}
        >
            {children}
        </BaseMenu.Item>
    )
}

Menu.Item = MenuItem

export default Menu
