import M from 'materialize-css'

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
        M.toast({
            html: message,
            displayLength: duration || DEFAULT_DURATION,
            classes: 'mmgisToast info',
        })
    },
    success(message, duration) {
        M.toast({
            html: message,
            displayLength: duration || DEFAULT_DURATION,
            classes: 'mmgisToast success',
        })
    },
    warning(message, duration) {
        M.toast({
            html: message,
            displayLength: duration || DEFAULT_DURATION,
            classes: 'mmgisToast warning',
        })
    },
    error(message, duration) {
        M.toast({
            html: message,
            displayLength: duration || DEFAULT_DURATION,
            classes: 'mmgisToast failure',
        })
    },
    dismissAll() {
        M.Toast.dismissAll()
    },
}

export default Toast
