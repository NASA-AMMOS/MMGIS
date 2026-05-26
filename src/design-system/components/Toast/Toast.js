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

function addToast(options) {
    const timeout = options.timeout || DEFAULT_DURATION
    const id = toastManager.add(options)
    activeIds.add(id)
    setTimeout(() => activeIds.delete(id), timeout + 500)
    return id
}

const Toast = {
    info(message, duration) {
        addToast({ title: message, type: 'info', timeout: duration || DEFAULT_DURATION })
    },
    success(message, duration) {
        addToast({ title: message, type: 'success', timeout: duration || DEFAULT_DURATION })
    },
    warning(message, duration) {
        addToast({ title: message, type: 'warning', timeout: duration || DEFAULT_DURATION })
    },
    error(message, duration) {
        addToast({ title: message, type: 'error', timeout: duration || DEFAULT_DURATION })
    },
    dismissAll() {
        activeIds.forEach((id) => toastManager.close(id))
        activeIds.clear()
    },
}

export default Toast
