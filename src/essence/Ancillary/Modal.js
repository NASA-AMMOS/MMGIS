/**
 * Modal — React-based modal with backdrop.
 *
 * Exposes the same imperative API as the old jQuery version so that existing
 * callers (tools, BottomBar, etc.) continue to work without changes:
 *   Modal.set(html, onAddCallback, onRemoveCallback, modalId)
 *   Modal.remove(isImmediate, modalId)
 *
 * Internally renders a React tree into a lazily-created container div.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import './Modal.css'

// ── Shared state store (singleton, subscribed to by ModalHost) ──────────

const _state = {
    modals: {},       // { [modalId]: { html, onRemoveCallback } }
    listeners: [],
}

function _notify() {
    _state.listeners.forEach((fn) => fn({ ..._state.modals }))
}

// ── React component ─────────────────────────────────────────────────────

function ModalHost() {
    const [modals, setModals] = useState({})

    useEffect(() => {
        const listener = (m) => setModals(m)
        _state.listeners.push(listener)
        return () => {
            _state.listeners = _state.listeners.filter((l) => l !== listener)
        }
    }, [])

    const handleBackdropClick = useCallback((e, modalId) => {
        // Only close when clicking the backdrop itself, not inner content
        if (e.target === e.currentTarget) {
            Modal.remove(false, modalId)
        }
    }, [])

    const handleCloseClick = useCallback((e, modalId) => {
        e.stopPropagation()
        Modal.remove(false, modalId)
    }, [])

    const ids = Object.keys(modals)

    return (
        <>
            {ids.map((modalId) => {
                const m = modals[modalId]
                if (!m) return null
                return (
                    <ModalOverlay
                        key={modalId}
                        modalId={modalId}
                        html={m.html}
                        blurCount={ids.length}
                        onBackdropClick={handleBackdropClick}
                        onCloseClick={handleCloseClick}
                    />
                )
            })}
        </>
    )
}

function ModalOverlay({ modalId, html, blurCount, onBackdropClick, onCloseClick }) {
    const innerRef = useRef(null)
    const overlayRef = useRef(null)
    const id = `mmgisModal_${modalId}`

    // Fade in on mount
    useEffect(() => {
        const el = overlayRef.current
        if (el) {
            // Force reflow then animate
            el.style.opacity = '0'
            requestAnimationFrame(() => {
                el.style.transition = 'opacity 0.4s ease'
                el.style.opacity = '1'
            })
        }
    }, [])

    // Set innerHTML and call onAddCallback
    useEffect(() => {
        const el = innerRef.current
        if (el && html != null) {
            el.innerHTML = html
        }
    }, [html])

    // Apply blur to main-container
    useEffect(() => {
        const mc = document.getElementById('main-container')
        if (mc) mc.style.filter = `blur(${3 * blurCount}px)`
        return () => {
            const mc2 = document.getElementById('main-container')
            if (mc2) mc2.style.filter = ''
        }
    }, [blurCount])

    return (
        <div
            ref={overlayRef}
            id={id}
            className="mmgisModal dontCloseWhenClicked"
            onClick={(e) => {
                // Check if target is inside dontCloseWhenClicked
                if (!e.target.closest || !e.target.closest('.dontCloseWhenClicked') || e.target === e.currentTarget) {
                    onBackdropClick(e, modalId)
                }
            }}
        >
            <div
                id="mmgisModalClose"
                onClick={(e) => onCloseClick(e, modalId)}
            >
                <i className="mdi mdi-close mdi-24px" />
            </div>
            <div id="mmgisModalInner" ref={innerRef} />
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
    _activeModalIds: {},

    set: function (html, onAddCallback, onRemoveCallback, modalId) {
        modalId = modalId || 0
        _ensureMounted()

        Modal._activeModalIds[modalId] = true
        Modal._onRemoveCallback[modalId] = typeof onRemoveCallback === 'function' ? onRemoveCallback : null

        _state.modals[modalId] = { html, onRemoveCallback }
        _notify()

        // Call onAddCallback after React renders (next tick)
        if (typeof onAddCallback === 'function') {
            setTimeout(() => onAddCallback(`mmgisModal_${modalId}`), 50)
        }
    },

    remove: function (isImmediate, modalId) {
        modalId = modalId || 0
        const id = `mmgisModal_${modalId}`

        if (typeof Modal._onRemoveCallback[modalId] === 'function')
            Modal._onRemoveCallback[modalId]()
        Modal._onRemoveCallback[modalId] = null

        if (isImmediate) {
            delete _state.modals[modalId]
            delete Modal._activeModalIds[modalId]
            _notify()

            const mc = document.getElementById('main-container')
            if (mc) mc.style.filter = `blur(${3 * (Object.keys(Modal._activeModalIds).length)}px)`
        } else {
            // Fade out then remove
            const el = document.getElementById(id)
            if (el) {
                el.style.transition = 'opacity 0.4s ease'
                el.style.opacity = '0'
                setTimeout(() => {
                    delete _state.modals[modalId]
                    delete Modal._activeModalIds[modalId]
                    _notify()

                    const mc = document.getElementById('main-container')
                    if (mc) {
                        const count = Object.keys(Modal._activeModalIds).length
                        mc.style.filter = count > 0 ? `blur(${3 * count}px)` : ''
                    }
                }, 400)
            } else {
                delete _state.modals[modalId]
                delete Modal._activeModalIds[modalId]
                _notify()
            }
        }
    },
}

export default Modal
