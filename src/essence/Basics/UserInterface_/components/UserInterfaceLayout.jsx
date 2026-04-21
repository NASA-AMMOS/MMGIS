import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import useUIStore from '../store/uiStore'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import SplitScreens from './SplitScreens'
import ToolPanel from './ToolPanel'
import BottomBarReact from './BottomBarReact'

import '../BottomBar.css'

function UserInterfaceLayout() {
    const containerRef = useRef(null)
    const [bridge, setBridge] = useState(null)
    const visible = useUIStore((s) => s.visible)
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
    const isMobile = useUIStore((s) => s.isMobile)

    useEffect(() => {
        // Import bridge lazily to avoid circular deps
        import('../UserInterfaceBridge').then((mod) => {
            setBridge(mod.default)
        })
    }, [])

    // Dynamically import the correct CSS based on mobile/desktop mode
    useEffect(() => {
        if (isMobile) {
            import('../UserInterfaceMobile_.css')
        } else {
            import('../UserInterfaceDefault_.css')
        }
    }, [isMobile])

    useEffect(() => {
        // Initialize Login UI (creates login/logout button in #topBarRight).
        // Must run after layout mounts so #topBarRight exists in the DOM.
        // In the jQuery version this was called from UserInterfaceDefault_.init().
        import('../../../Ancillary/Login/Login').then((mod) => {
            const Login = mod.default || mod
            if (Login && typeof Login.init === 'function') {
                Login.init()
            }
        })

        // Mark layout as ready for essence.js
        useUIStore.getState().setLayoutReady(true)

        return () => {
            useUIStore.getState().setLayoutReady(false)
        }
    }, [])

    // MutationObserver: sync #timeUI class changes (active, expanded) to the store.
    // This is the single source of truth for TimeUI state in React mode —
    // no matter what jQuery code toggles these classes, the store stays in sync
    // and _repositionBottomElements() is called automatically via the subscription.
    useEffect(() => {
        let observer = null
        // Use a short poll to wait for #timeUI to appear in the DOM
        // (it's created by TimeUI.init() which runs after layout is ready)
        const intervalId = setInterval(() => {
            const timeUIEl = document.getElementById('timeUI')
            if (timeUIEl) {
                clearInterval(intervalId)
                // Sync initial state
                useUIStore.getState().setTimeUIActive(timeUIEl.classList.contains('active'))
                useUIStore.getState().setTimeUIExpanded(
                    timeUIEl.classList.contains('expanded') || timeUIEl.classList.contains('defaultExpanded')
                )
                // Watch for class attribute changes
                observer = new MutationObserver(() => {
                    useUIStore.getState().setTimeUIActive(timeUIEl.classList.contains('active'))
                    useUIStore.getState().setTimeUIExpanded(
                        timeUIEl.classList.contains('expanded') || timeUIEl.classList.contains('defaultExpanded')
                    )
                })
                observer.observe(timeUIEl, { attributes: true, attributeFilter: ['class'] })
            }
        }, 500)

        return () => {
            clearInterval(intervalId)
            if (observer) observer.disconnect()
        }
    }, [])

    // Keyboard tracking (Ctrl/Shift state for tools)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-focused')
            }
        }
        const handleMouseDown = () => {
            document.body.classList.remove('keyboard-focused')
        }
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handleMouseDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handleMouseDown)
        }
    }, [])

    return (<>
        <div
            id="main-container"
            ref={containerRef}
            style={{
                opacity: visible ? 1 : 0,
                filter: visible ? 'none' : 'blur(5px)',
                transition: visible ? 'opacity 1s, filter 0.3s ease-in-out' : 'none',
                width: rightPanelWidth > 0 ? `calc(100% - ${rightPanelWidth}px)` : '100%',
                height: '100vh',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <TopBar userInterface={bridge} />
            <Toolbar />
            <ToolPanel />
            <SplitScreens />
            {!isMobile && <BottomBarReact userInterface={bridge} />}
        </div>
        {ReactDOM.createPortal(
            <div
                id="uiRightPanel"
                style={{
                    display: 'none',
                    position: 'absolute',
                    right: '0px',
                    top: '0px',
                    height: '100vh',
                    width: '0px',
                    background: '#000',
                    zIndex: 2000,
                }}
            ></div>,
            document.body
        )}
    </>)
}

export default UserInterfaceLayout
