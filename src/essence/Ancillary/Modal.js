/**
 * Modal — React-based modal service.
 *
 * Renders through a lazily-mounted React tree. Each modal gets a backdrop
 * with a fade-in / fade-out transition (500 ms, matching the original jQuery
 * implementation). Exposes the same imperative API so existing callers
 * continue to work without changes:
 *
 *   Modal.set(content, onAddCallback, onRemoveCallback, modalId)
 *     - content can be an HTML string (legacy) or a React element
 *   Modal.remove(isImmediate, modalId)
 */
import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import styles from './Modal.module.css'

// ── Shared state store (singleton, subscribed to by ModalHost) ──────────

const _state = {
    modals: {},
    listeners: [],
}

function _notify() {
    _state.listeners.forEach((fn) => fn({ ..._state.modals }))
}

function _activeCount() {
    return Object.keys(_state.modals).filter(
        (k) => !_state.modals[k].closing
    ).length
}

function _applyBlur() {
    const mc = document.getElementById('main-container')
    if (mc) {
        const count = _activeCount()
        mc.style.filter = count > 0 ? `blur(${3 * count}px)` : ''
    }
}

// ── React components ────────────────────────────────────────────────────

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

    return (
        <>
            {Object.keys(modals).map((modalId) => {
                const m = modals[modalId]
                if (!m) return null
                return (
                    <ModalInstance
                        key={modalId}
                        modalId={modalId}
                        content={m.content}
                        closing={!!m.closing}
                    />
                )
            })}
        </>
    )
}

function ModalInstance({ modalId, content, closing }) {
    const wrapperRef = useRef(null)
    const isHtmlString = typeof content === 'string'
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true))
    }, [])

    useEffect(() => {
        if (closing) setVisible(false)
    }, [closing])

    const handleBackdropClick = (e) => {
        if (e.target === wrapperRef.current) {
            Modal.remove(false, modalId)
        }
    }

    return (
        <div
            ref={wrapperRef}
            className={`${styles.wrapper} ${visible ? styles.visible : ''}`}
            onClick={handleBackdropClick}
        >
            <div className={styles.popup}>
                {isHtmlString ? (
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                ) : (
                    content
                )}
            </div>
        </div>
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
     * @param {string|React.ReactElement} content — HTML string (legacy) or React element
     * @param {Function} [onAddCallback] — called after the modal renders (next tick)
     * @param {Function} [onRemoveCallback] — called when the modal is removed
     * @param {string|number} [modalId=0] — unique modal identifier for stacking
     */
    set: function (content, onAddCallback, onRemoveCallback, modalId) {
        modalId = modalId || 0
        _ensureMounted()

        Modal._onRemoveCallback[modalId] =
            typeof onRemoveCallback === 'function' ? onRemoveCallback : null

        _state.modals[modalId] = { content, closing: false }
        _notify()
        _applyBlur()

        if (typeof onAddCallback === 'function') {
            setTimeout(() => onAddCallback(`mmgisModal_${modalId}`), 50)
        }
    },

    /**
     * Close a modal.
     * @param {boolean} [isImmediate] — skip fade-out animation
     * @param {string|number} [modalId=0]
     */
    remove: function (isImmediate, modalId) {
        modalId = modalId || 0

        if (!_state.modals[modalId]) return

        if (typeof Modal._onRemoveCallback[modalId] === 'function')
            Modal._onRemoveCallback[modalId]()
        Modal._onRemoveCallback[modalId] = null

        _applyBlur()

        if (isImmediate) {
            delete _state.modals[modalId]
            _notify()
            _applyBlur()
        } else {
            _state.modals[modalId].closing = true
            _notify()
            _applyBlur()
            setTimeout(() => {
                delete _state.modals[modalId]
                _notify()
                _applyBlur()
            }, 500)
        }
    },
}

export default Modal
