import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import useUIStore from '../store/uiStore'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import SplitScreens from './SplitScreens'
import ToolPanel from './ToolPanel'
import BottomBarReact from './BottomBarReact'

import '../UserInterfaceDefault_.css'
import '../BottomBar.css'

function UserInterfaceLayout() {
    const containerRef = useRef(null)
    const [bridge, setBridge] = useState(null)
    const visible = useUIStore((s) => s.visible)
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)

    useEffect(() => {
        // Import bridge lazily to avoid circular deps
        import('../UserInterfaceBridge').then((mod) => {
            setBridge(mod.default)
        })
    }, [])

    useEffect(() => {
        // Mark layout as ready for essence.js
        useUIStore.getState().setLayoutReady(true)

        return () => {
            useUIStore.getState().setLayoutReady(false)
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
            <TopBar />
            <Toolbar />
            <ToolPanel />
            <SplitScreens />
            <BottomBarReact userInterface={bridge} />
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
