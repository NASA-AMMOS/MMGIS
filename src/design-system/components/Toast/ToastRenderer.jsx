import React from 'react'
import { Toast } from '@base-ui/react/toast'
import { toastManager } from './Toast'

const viewportStyle = {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
    maxWidth: '90vw',
}

const baseToastStyle = {
    borderRadius: '8px',
    width: 'auto',
    maxWidth: '100%',
    lineHeight: '1.4em',
    fontSize: '13px',
    backgroundColor: 'var(--color-a)',
    border: '1px solid var(--color-a1)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '8px 20px',
    color: 'var(--color-f)',
    display: 'flex',
    alignItems: 'center',
    cursor: 'default',
    pointerEvents: 'auto',
}

const variantBorder = {
    info: '3px solid var(--color-mmgis)',
    success: '3px solid #4caf50',
    warning: '3px solid #ff9800',
    error: '3px solid var(--color-r1)',
}

function ToastList() {
    const { toasts } = Toast.useToastManager()
    return toasts.map((toast) => {
        const type = toast.data?.type
        const style = type && variantBorder[type]
            ? { ...baseToastStyle, borderLeft: variantBorder[type] }
            : baseToastStyle
        return (
            <Toast.Root key={toast.id} toast={toast} style={style}>
                <Toast.Content>
                    <Toast.Title />
                </Toast.Content>
            </Toast.Root>
        )
    })
}

export default function ToastRenderer() {
    return (
        <Toast.Provider toastManager={toastManager}>
            <Toast.Portal>
                <Toast.Viewport style={viewportStyle}>
                    <ToastList />
                </Toast.Viewport>
            </Toast.Portal>
        </Toast.Provider>
    )
}
