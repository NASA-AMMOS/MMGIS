import React, { useEffect, useCallback, useState } from 'react'
import useUIStore from '../store/uiStore'
import BottomBar from '../BottomBar'
import tippy from 'tippy.js'

import './BottomBarReact.module.css'

/**
 * BottomBarReact — bottom toolbar buttons (About + Copy Link).
 * All other actions (Screenshot, Fullscreen, Hotkeys, Settings) are in TopBar kebab menu.
 *
 * Desktop: rendered inside Toolbar.jsx at the bottom (via flex margin-top: auto)
 * Mobile: rendered by TopBar inside the hamburger menu (#topBarMenu)
 */
function BottomBarReact({ userInterface }) {
    const isMobile = useUIStore((s) => s.isMobile)
    const [linkCopied, setLinkCopied] = useState(false)

    useEffect(() => {
        if (userInterface && !BottomBar.UI_) {
            BottomBar.setUI(userInterface)
        }
    }, [userInterface])

    useEffect(() => {
        if (isMobile) return
        const tippyInstances = []
        const timer = setTimeout(() => {
            const tips = [
                ['#bottomBarAbout', 'About'],
                ['#topBarLink', 'Copy Link'],
            ]
            tips.forEach(([sel, content]) => {
                try {
                    const instances = tippy(sel, {
                        content,
                        placement: 'right',
                        theme: 'blue',
                    })
                    if (Array.isArray(instances))
                        tippyInstances.push(...instances)
                    else if (instances) tippyInstances.push(instances)
                } catch (e) {}
            })
        }, 100)
        return () => {
            clearTimeout(timer)
            tippyInstances.forEach((t) => {
                try { t.destroy() } catch (e) {}
            })
        }
    }, [isMobile])

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

    const buttonStyle = {
        padding: '8px 10px',
        width: '40px',
        height: '36px',
        lineHeight: '20px',
        cursor: 'pointer',
        textAlign: 'center',
    }

    return (
        <div id="barBottom" style={containerStyle}>
            {/* Copy Link */}
            <i
                id="topBarLink"
                tabIndex={100}
                className={`mmgisHoverBlue mdi ${
                    linkCopied ? 'mdi-check-bold' : 'mdi-open-in-new'
                } mdi-18px`}
                style={{
                    ...buttonStyle,
                    color: linkCopied ? 'var(--color-green)' : undefined,
                }}
                onClick={handleCopyLink}
            />

            {/* About (info icon) — below copy link */}
            <i
                id="bottomBarAbout"
                title="About"
                tabIndex={105}
                className="mmgisHoverBlue mdi mdi-information-outline mdi-18px"
                style={buttonStyle}
                onClick={handleAbout}
            />
        </div>
    )
}

export default BottomBarReact
