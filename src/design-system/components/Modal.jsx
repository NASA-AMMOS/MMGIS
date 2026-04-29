import React from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import styles from './Modal.module.css'

function Modal({ open, onOpenChange, children, className, ...props }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange} {...props}>
            <Dialog.Portal>
                <Dialog.Backdrop className={styles.backdrop} />
                <Dialog.Popup className={`${styles.popup} ${className || ''}`}>
                    {children}
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

Modal.Title = function ModalTitle({ children, className, ...props }) {
    return (
        <Dialog.Title className={`${styles.title} ${className || ''}`} {...props}>
            {children}
        </Dialog.Title>
    )
}

Modal.Description = function ModalDescription({ children, className, ...props }) {
    return (
        <Dialog.Description className={`${styles.description} ${className || ''}`} {...props}>
            {children}
        </Dialog.Description>
    )
}

Modal.Close = function ModalClose({ children, className, ...props }) {
    return (
        <Dialog.Close className={`${styles.close} ${className || ''}`} {...props}>
            {children}
        </Dialog.Close>
    )
}

export default Modal
