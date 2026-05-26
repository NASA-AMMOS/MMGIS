import toastManager from './toastManager'

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
const DEFAULT_DURATION = 3500

const Toast = {
    info(message, duration) {
        toastManager.add({
            title: message,
            type: 'info',
            duration: duration || DEFAULT_DURATION,
        })
    },
    success(message, duration) {
        toastManager.add({
            title: message,
            type: 'success',
            duration: duration || DEFAULT_DURATION,
        })
    },
    warning(message, duration) {
        toastManager.add({
            title: message,
            type: 'warning',
            duration: duration || DEFAULT_DURATION,
        })
    },
    error(message, duration) {
        toastManager.add({
            title: message,
            type: 'error',
            duration: duration || DEFAULT_DURATION,
        })
    },
    dismissAll() {
        const { toasts } = toastManager
        toasts.forEach((t) => toastManager.close(t.id))
    },
}

export default Toast
