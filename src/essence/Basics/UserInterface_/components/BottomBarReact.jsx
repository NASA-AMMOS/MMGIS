import React, { useEffect, useRef, useCallback, useState } from 'react'
import useUIStore from '../store/uiStore'
import BottomBar from '../BottomBar'
import tippy from 'tippy.js'

/**
 * BottomBarReact replaces the jQuery-based BottomBar.init() with declarative
 * React JSX. Each button is rendered as a React element with onClick handlers
 * that delegate to BottomBar utility methods (which still use Modal, html2canvas,
 * hotkeys-js, etc.).
 *
 * Desktop: rendered by UserInterfaceLayout as absolute bottom-left sidebar
 * Mobile: rendered by TopBar inside the hamburger menu (#topBarMenu)
 */
function BottomBarReact({ userInterface }) {
    const isMobile = useUIStore((s) => s.isMobile)
    const [linkCopied, setLinkCopied] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [screenshotting, setScreenshotting] = useState(false)
    const infoOnRef = useRef(false)

    // Set BottomBar.UI_ when bridge becomes available
    useEffect(() => {
        if (userInterface && !BottomBar.UI_) {
            BottomBar.setUI(userInterface)
        }
    }, [userInterface])

    // Initialize tippy tooltips (desktop only)
    useEffect(() => {
        if (isMobile) return
        const tippyInstances = []
        const timer = setTimeout(() => {
            const tips = [
                ['#topBarLink', 'Copy Link'],
                ['#topBarScreenshot', 'Take Screenshot'],
                ['#topBarFullscreen', 'Fullscreen'],
                ['#bottomBarHotkeys', 'Hotkeys'],
                ['#bottomBarSettings', 'Settings'],
                ['#topBarInfo', 'Info'],
                ['#topBarHelp', 'Help'],
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
                } catch (e) {
                    // Element may not exist yet
                }
            })
        }, 100)
        return () => {
            clearTimeout(timer)
            tippyInstances.forEach((t) => {
                try {
                    t.destroy()
                } catch (e) {}
            })
        }
    }, [isMobile])

    // Listen for fullscreen change events to keep icon in sync
    useEffect(() => {
        const handler = () => {
            const inFS =
                document.fullscreenElement != null ||
                document.webkitFullscreenElement != null
            setIsFullscreen(inFS)
        }
        document.addEventListener('fullscreenchange', handler)
        document.addEventListener('webkitfullscreenchange', handler)
        return () => {
            document.removeEventListener('fullscreenchange', handler)
            document.removeEventListener('webkitfullscreenchange', handler)
        }
    }, [])

    const handleCopyLink = useCallback(() => {
        BottomBar.copyLink(() => {
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 3000)
        })
    }, [])

    const handleScreenshot = useCallback(() => {
        setScreenshotting(true)
        BottomBar.takeScreenshot(() => {
            setTimeout(() => setScreenshotting(false), 2000)
        })
    }, [])

    const handleFullscreen = useCallback(() => {
        BottomBar.fullscreen()
    }, [])

    const handleHotkeys = useCallback(() => {
        BottomBar.toggleHotkeys(true)
    }, [])

    const handleSettings = useCallback(() => {
        BottomBar.toggleSettings(true)
    }, [])

    const handleInfo = useCallback(() => {
        infoOnRef.current = !infoOnRef.current
        const viewerInfo = document.getElementById('viewer_Info')
        if (viewerInfo) {
            viewerInfo.style.display = infoOnRef.current ? 'inherit' : 'none'
        }
    }, [])

    const handleHelp = useCallback(() => {
        const viewerHelp = document.getElementById('viewer_Help')
        if (viewerHelp) {
            viewerHelp.style.display =
                viewerHelp.style.display === 'none' ? 'inherit' : 'none'
        }
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
              position: 'absolute',
              bottom: '0px',
              left: '0px',
              width: '40px',
              zIndex: 2004,
              background: 'var(--color-a)',
          }

    const buttonStyle = {
        padding: '5px 10px',
        width: '40px',
        height: '36px',
        lineHeight: '26px',
        cursor: 'pointer',
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

            {/* Screenshot */}
            <i
                id="topBarScreenshot"
                title="Screenshot"
                tabIndex={101}
                className="mmgisHoverBlue mdi mdi-camera mdi-18px"
                style={{
                    ...buttonStyle,
                    opacity: 0.8,
                    position: 'relative',
                }}
                onClick={handleScreenshot}
            >
                {screenshotting && (
                    <i
                        id="topBarScreenshotLoading"
                        title={
                            'Taking Screenshot...\nYou may need to permit multiple downloads in your browser.'
                        }
                        style={{
                            display: 'block',
                            borderRadius: '50%',
                            border: '8px solid #ffe100',
                            borderRightColor: 'transparent',
                            borderLeftColor: 'transparent',
                            position: 'relative',
                            top: '3px',
                            left: '-17px',
                            width: '20px',
                            height: '20px',
                            lineHeight: '26px',
                            color: '#d2b800',
                            cursor: 'pointer',
                            animationName: 'rotate-forever',
                            animationDuration: '2s',
                            animationIterationCount: 'infinite',
                            animationTimingFunction: 'linear',
                        }}
                    />
                )}
            </i>

            {/* Fullscreen */}
            <i
                id="topBarFullscreen"
                tabIndex={103}
                className={`mmgisHoverBlue mdi ${
                    isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'
                } mdi-18px`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                style={buttonStyle}
                onClick={handleFullscreen}
            />

            {/* Hotkeys */}
            <i
                id="bottomBarHotkeys"
                tabIndex={104}
                className="mmgisHoverBlue mdi mdi-keyboard mdi-18px"
                style={buttonStyle}
                onClick={handleHotkeys}
            />

            {/* Settings */}
            <i
                id="bottomBarSettings"
                tabIndex={104}
                className="mmgisHoverBlue mdi mdi-cog mdi-18px"
                style={buttonStyle}
                onClick={handleSettings}
            />

            {/* Info */}
            <i
                id="topBarInfo"
                title="Info"
                tabIndex={105}
                className="mmgisHoverBlue mdi mdi-information-outline mdi-18px"
                style={buttonStyle}
                onClick={handleInfo}
            />

            {/* Help */}
            <i
                id="topBarHelp"
                title="Help"
                tabIndex={106}
                className="mmgisHoverBlue mdi mdi-help mdi-18px"
                style={buttonStyle}
                onClick={handleHelp}
            />
        </div>
    )
}

export default BottomBarReact
