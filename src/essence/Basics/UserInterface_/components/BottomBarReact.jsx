import React, { useEffect } from 'react'
import BottomBar from '../BottomBar'

/**
 * BottomBarReact is a thin React wrapper around the existing jQuery-based
 * BottomBar module. It renders the container div and then delegates to
 * BottomBar.init() to build the jQuery DOM inside it.
 *
 * This preserves full backward compatibility with the existing BottomBar
 * behavior (copy link, screenshot, fullscreen, hotkeys, settings, info, help)
 * while allowing the React layout to manage the container positioning.
 */
function BottomBarReact({ userInterface }) {
    useEffect(() => {
        // Guard: BottomBar.init() may already have been called by
        // UserInterfaceBridge.fina() to fix the init→fina race condition.
        if (!BottomBar.UI_ && userInterface) {
            BottomBar.init('barBottom', userInterface)
        }
    }, [userInterface])

    return (
        <div
            id="barBottom"
            style={{
                display: 'flex',
                flexFlow: 'column',
                position: 'absolute',
                bottom: '0px',
                left: '0px',
                width: '40px',
                zIndex: 2004,
                background: 'var(--color-a)',
            }}
        ></div>
    )
}

export default BottomBarReact
