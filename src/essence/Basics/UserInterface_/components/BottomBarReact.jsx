import React, { useEffect, useRef } from 'react'
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
    const initialized = useRef(false)

    useEffect(() => {
        if (!initialized.current && userInterface) {
            BottomBar.init('barBottom', userInterface)
            initialized.current = true
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
