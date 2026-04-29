import React from 'react'
import { Menu } from '@base-ui-components/react/menu'
import styles from './Dropdown.module.css'

function Dropdown({ trigger, children, align = 'end', className, ...props }) {
    return (
        <Menu.Root {...props}>
            <Menu.Trigger render={trigger}>
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner align={align} sideOffset={8}>
                    <Menu.Popup className={styles.popup}>
                        {children}
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    )
}

function DropdownItem({ children, className, ...props }) {
    return (
        <Menu.Item
            className={`${styles.item} ${className || ''}`}
            {...props}
        >
            {children}
        </Menu.Item>
    )
}

Dropdown.Item = DropdownItem

export default Dropdown
