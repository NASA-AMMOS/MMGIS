import React, { useEffect, useCallback, useState } from 'react'
import useUIStore from '../store/uiStore'
import BottomBar from '../BottomBar'
import IconButton from '../../../../design-system/components/IconButton'
import Tooltip from '../../../../design-system/components/Tooltip'

import styles from './BottomBarReact.module.css'

/**
 * BottomBarReact — bottom toolbar buttons (About + Copy Link).
 * All other actions (Screenshot, Fullscreen, Hotkeys, Settings) are in TopBar kebab menu.
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

    const handleAbout = useCallback(() => {
        BottomBar.showAboutModal()
    }, [])

    const containerStyle = isMobile
        ? {
              position: 'absolute',
              width: '40px',
              display: 'none',
              flexFlow: 'column',
              zIndex: 1005,
          }
        : {
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

            {isMobile ? (
                <IconButton
                    id="bottomBarAbout"
                    size="lg"
                    className={styles.barButton}
                    tabIndex={105}
                    onClick={handleAbout}
                >
                    <i className="mdi mdi-information-outline mdi-18px" />
                </IconButton>
            ) : (
                <Tooltip content="About" placement="right">
                    <IconButton
                        id="bottomBarAbout"
                        size="lg"
                        className={styles.barButton}
                        tabIndex={105}
                        onClick={handleAbout}
                    >
                        <i className="mdi mdi-information-outline mdi-18px" />
                    </IconButton>
                </Tooltip>
            )}
        </div>
    )
}

export default BottomBarReact
