import { Toast as BaseToast } from '@base-ui/react/toast'

/**
 * Toast utility for displaying notification messages.
 *
 * Variants:
 *   Toast.info(message, duration)    — blue left-border
 *   Toast.success(message, duration) — green left-border
 *   Toast.warning(message, duration) — amber left-border
 *   Toast.error(message, duration)   — red left-border
 *
 * Default duration is 3500ms.
 */
export const toastManager = BaseToast.createToastManager()

const DEFAULT_DURATION = 3500
const activeIds = new Set()

const Toast = {
    info(message, duration) {
        const id = toastManager.add({
            title: message,
            type: 'info',
            duration: duration || DEFAULT_DURATION,
        })
        activeIds.add(id)
    },
    success(message, duration) {
        const id = toastManager.add({
            title: message,
            type: 'success',
            duration: duration || DEFAULT_DURATION,
        })
        activeIds.add(id)
    },
    warning(message, duration) {
        const id = toastManager.add({
            title: message,
            type: 'warning',
            duration: duration || DEFAULT_DURATION,
        })
        activeIds.add(id)
    },
    error(message, duration) {
        const id = toastManager.add({
            title: message,
            type: 'error',
            duration: duration || DEFAULT_DURATION,
        })
        activeIds.add(id)
    },
    dismissAll() {
        activeIds.forEach((id) => toastManager.close(id))
        activeIds.clear()
    },
}

export default Toast
