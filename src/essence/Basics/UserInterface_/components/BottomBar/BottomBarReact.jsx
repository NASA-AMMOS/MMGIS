import React, { useEffect, useCallback, useState } from 'react'
import useUIStore from '../../store/uiStore'
import BottomBar from '../../BottomBar'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'

import styles from './BottomBarReact.module.css'

/**
 * BottomBarReact — bottom toolbar buttons (Copy Link, Screenshot, Fullscreen).
 * About is in the TopBar kebab menu.
 *
 * Desktop: rendered inside Toolbar.jsx at the bottom (via flex margin-top: auto)
 * Mobile: rendered by TopBar inside the hamburger menu (#topBarMenu)
 */
function BottomBarReact({ userInterface }) {
    const isMobile = useUIStore((s) => s.isMobile)
    const lookConfig = useUIStore((s) => s.lookConfig)
    const [linkCopied, setLinkCopied] = useState(false)

    useEffect(() => {
        if (userInterface && !BottomBar.UI_) {
            BottomBar.setUI(userInterface)
        }
    }, [userInterface])

    const handleCopyLink = useCallback(() => {
        BottomBar.copyLink(() => {
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 3000)
        })
    }, [])

    const handleScreenshot = useCallback(() => {
        BottomBar.takeScreenshot()
    }, [])

    const handleFullscreen = useCallback(() => {
        BottomBar.fullscreen()
    }, [])

    const containerStyle = {
        display: 'flex',
        flexFlow: 'column',
        marginTop: 'auto',
    }

    return (
        <div id="barBottom" className={styles.barBottom} style={containerStyle}>
            {lookConfig.copylink !== false && (
                isMobile ? (
                    <IconButton
                        id="topBarLink"
                        size="lg"
                        className={styles.barButton}
                        tabIndex={100}
                        onClick={handleCopyLink}
                        style={linkCopied ? { color: 'var(--color-green)' } : undefined}
                    >
                        <i className={`mdi ${linkCopied ? 'mdi-check-bold' : 'mdi-open-in-new'} mdi-18px`} />
                    </IconButton>
                ) : (
                    <Tooltip content="Copy Link" placement="right">
                        <IconButton
                            id="topBarLink"
                            size="lg"
                            className={styles.barButton}
                            tabIndex={100}
                            onClick={handleCopyLink}
                            style={linkCopied ? { color: 'var(--color-green)' } : undefined}
                        >
                            <i className={`mdi ${linkCopied ? 'mdi-check-bold' : 'mdi-open-in-new'} mdi-18px`} />
                        </IconButton>
                    </Tooltip>
                )
            )}

            {lookConfig.screenshot !== false && (
                isMobile ? (
                    <IconButton
                        id="topBarScreenshot"
                        size="lg"
                        className={styles.barButton}
                        tabIndex={101}
                        onClick={handleScreenshot}
                    >
                        <i className="mdi mdi-camera mdi-18px" />
                    </IconButton>
                ) : (
                    <Tooltip content="Screenshot" placement="right">
                        <IconButton
                            id="topBarScreenshot"
                            size="lg"
                            className={styles.barButton}
                            tabIndex={101}
                            onClick={handleScreenshot}
                        >
                            <i className="mdi mdi-camera mdi-18px" />
                        </IconButton>
                    </Tooltip>
                )
            )}

            {lookConfig.fullscreen !== false && (
                isMobile ? (
                    <IconButton
                        id="topBarFullscreen"
                        size="lg"
                        className={styles.barButton}
                        tabIndex={102}
                        onClick={handleFullscreen}
                    >
                        <i className="mdi mdi-fullscreen mdi-18px" />
                    </IconButton>
                ) : (
                    <Tooltip content="Fullscreen" placement="right">
                        <IconButton
                            id="topBarFullscreen"
                            size="lg"
                            className={styles.barButton}
                            tabIndex={102}
                            onClick={handleFullscreen}
                        >
                            <i className="mdi mdi-fullscreen mdi-18px" />
                        </IconButton>
                    </Tooltip>
                )
            )}
        </div>
    )
}

export default BottomBarReact
