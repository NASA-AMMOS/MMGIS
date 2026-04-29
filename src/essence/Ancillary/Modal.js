/**
 * Modal — React-based modal service using the design-system Modal (Base UI Dialog).
 *
 * Renders through a React tree with the design-system Modal component (which wraps
 * Base UI Dialog). Exposes the same imperative API so existing jQuery callers
 * (tools, BottomBar, etc.) continue to work without changes:
 *
 *   Modal.set(content, onAddCallback, onRemoveCallback, modalId)
 *     - content can be an HTML string (legacy) or a React element (new callers)
 *   Modal.remove(isImmediate, modalId)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog } from '@base-ui-components/react/dialog'

import styles from './Modal.module.css'

// ── Shared state store (singleton, subscribed to by ModalHost) ──────────

const _state = {
    modals: {},
    listeners: [],
}

function _notify() {
    _state.listeners.forEach((fn) => fn({ ..._state.modals }))
}

// ── React component that renders all active modals ──────────────────────

function ModalHost() {
    const [modals, setModals] = useState(() => ({ ..._state.modals }))

    useEffect(() => {
        const listener = (m) => setModals(m)
        _state.listeners.push(listener)
        setModals({ ..._state.modals })
        return () => {
            _state.listeners = _state.listeners.filter((l) => l !== listener)
        }
    }, [])

    const ids = Object.keys(modals)

    useEffect(() => {
        const mc = document.getElementById('main-container')
        if (mc) {
            mc.style.filter = ids.length > 0 ? `blur(${3 * ids.length}px)` : ''
        }
    }, [ids.length])

    return (
        <>
            {ids.map((modalId) => {
                const m = modals[modalId]
                if (!m) return null
                return (
                    <ModalInstance
                        key={modalId}
                        modalId={modalId}
                        content={m.content}
                    />
                )
            })}
        </>
    )
}

function ModalInstance({ modalId, content }) {
    const contentRef = useRef(null)
    const isHtmlString = typeof content === 'string'

    const handleOpenChange = useCallback(
        (open) => {
            if (!open) {
                Modal.remove(false, modalId)
            }
        },
        [modalId]
    )

    return (
        <Dialog.Root open={true} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Backdrop className={styles.backdrop} />
                <Dialog.Popup className={styles.popup}>
                    <Dialog.Close className={styles.close}>
                        <i className="mdi mdi-close mdi-24px" />
                    </Dialog.Close>
                    {isHtmlString ? (
                        <div
                            ref={contentRef}
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    ) : (
                        content
                    )}
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

// ── Imperative API (backwards-compatible) ───────────────────────────────

let _root = null
let _container = null

function _ensureMounted() {
    if (_root) return
    _container = document.createElement('div')
    _container.id = 'mmgisModalRoot'
    document.body.appendChild(_container)
    _root = createRoot(_container)
    _root.render(<ModalHost />)
}

const Modal = {
    _onRemoveCallback: {},

    /**
     * Open a modal.
     * @param {string|React.ReactElement} content - HTML string (legacy) or React element
     * @param {Function} [onAddCallback] - Called after the modal renders (next tick)
     * @param {Function} [onRemoveCallback] - Called when the modal is removed
     * @param {string|number} [modalId=0] - Unique modal identifier for stacking
     */
    set: function (content, onAddCallback, onRemoveCallback, modalId) {
        modalId = modalId || 0
        _ensureMounted()

        Modal._onRemoveCallback[modalId] =
            typeof onRemoveCallback === 'function' ? onRemoveCallback : null

        _state.modals[modalId] = { content }
        _notify()

        if (typeof onAddCallback === 'function') {
            setTimeout(() => onAddCallback(`mmgisModal_${modalId}`), 50)
        }
    },

    /**
     * Close a modal.
     * @param {boolean} [isImmediate] - Skip fade-out animation
     * @param {string|number} [modalId=0]
     */
    remove: function (isImmediate, modalId) {
        modalId = modalId || 0

        if (typeof Modal._onRemoveCallback[modalId] === 'function')
            Modal._onRemoveCallback[modalId]()
        Modal._onRemoveCallback[modalId] = null

        delete _state.modals[modalId]
        _notify()

        const mc = document.getElementById('main-container')
        if (mc) {
            const count = Object.keys(_state.modals).length
            mc.style.filter = count > 0 ? `blur(${3 * count}px)` : ''
        }
    },
}

export default Modal
