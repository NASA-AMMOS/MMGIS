import React, { useEffect, useRef } from 'react'
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
    const bridgeRef = useRef(null)

    useEffect(() => {
        // Import bridge lazily to avoid circular deps
        import('../UserInterfaceBridge').then((mod) => {
            bridgeRef.current = mod.default
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

    return (
        <div
            id="main-container"
            ref={containerRef}
            style={{
                opacity: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <TopBar />
            <Toolbar />
            <ToolPanel />
            <SplitScreens />
            <BottomBarReact userInterface={bridgeRef.current} />
            <div
                id="uiRightPanel"
                style={{
                    display: 'none',
                    position: 'absolute',
                    right: '0px',
                    top: '0px',
                    height: '100%',
                    width: '0px',
                    zIndex: 2000,
                }}
            ></div>
        </div>
    )
}

export default UserInterfaceLayout
