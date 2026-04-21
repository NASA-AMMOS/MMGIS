import React, { useEffect, useRef, useCallback } from 'react'
import useUIStore from '../store/uiStore'
import BottomBar from '../BottomBar'

function TopBar({ userInterface }) {
    const topBarLeftRef = useRef(null)
    const isMobile = useUIStore((s) => s.isMobile)
    const mobileTopSize = useUIStore((s) => s.mobileTopSize)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const toolsWrapperRawWidth = useUIStore((s) => s.toolsWrapperRawWidth)
    const mobileBottomBarInitialized = useRef(false)

    useEffect(() => {
        const el = topBarLeftRef.current
        if (el) {
            const handleWheel = (e) => {
                e.preventDefault()
                el.scrollLeft += e.deltaY
            }
            el.addEventListener('wheel', handleWheel, { passive: false })
            return () => el.removeEventListener('wheel', handleWheel)
        }
    }, [])

    // Initialize BottomBar inside topBarMenu's barBottom for mobile
    useEffect(() => {
        if (isMobile && userInterface && !mobileBottomBarInitialized.current) {
            BottomBar.init('barBottom', userInterface)
            mobileBottomBarInitialized.current = true
        }
    }, [isMobile, userInterface])

    const handleMenuClick = useCallback(() => {
        const barBottom = document.getElementById('barBottom')
        if (barBottom) {
            barBottom.style.display =
                barBottom.style.display === 'none' || !barBottom.style.display
                    ? 'flex'
                    : 'none'
        }
    }, [])

    // Compute TopBar styles reactively from store state instead of
    // the bridge imperatively setting marginLeft/width/paddingLeft via DOM.
    // When a tool panel is open, TopBar shifts right to make room.
    // When no tool panel is open, TopBar uses paddingLeft for the toolbar/logo.
    const TOOLBAR_WIDTH = 40
    const leftOffset = isMobile ? mobileTopSize : TOOLBAR_WIDTH
    const topBarStyle = {}
    if (isMobile) {
        topBarStyle.background = 'var(--color-a)'
    }
    if (toolPanelWidth > 0) {
        // Tool panel is open: shift TopBar right past toolbar + tool panel
        topBarStyle.paddingLeft = '0px'
        topBarStyle.marginLeft = (toolPanelWidth + leftOffset) + 'px'
        topBarStyle.width = `calc(100% - ${toolPanelWidth + leftOffset}px)`
    } else if (toolsWrapperRawWidth && toolsWrapperRawWidth !== 0) {
        // Bottom tools area has custom width (setToolWidth): adjust TopBar
        // to match jQuery UserInterfaceDefault_.js:984-1003
        if (toolsWrapperRawWidth === 'full') {
            topBarStyle.marginLeft = leftOffset + 'px'
            topBarStyle.width = `calc(100% - ${leftOffset}px)`
        } else {
            const newTopWidth = leftOffset + toolsWrapperRawWidth
            topBarStyle.marginLeft = newTopWidth + 'px'
            topBarStyle.width = `calc(100% - ${newTopWidth}px)`
        }
    } else {
        // No tool panel: use paddingLeft for toolbar offset
        topBarStyle.paddingLeft = isMobile ? '80px' : '40px'
    }

    return (
        <div id="topBar" style={topBarStyle}>
            {isMobile && (
                <div
                    id="topBarMenu"
                    onClick={handleMenuClick}
                >
                    <i className="mdi mdi-menu mdi-24px"></i>
                    <div
                        id="barBottom"
                        style={{
                            position: 'absolute',
                            width: '40px',
                            display: 'none',
                            flexFlow: 'column',
                            zIndex: 1005,
                        }}
                    ></div>
                </div>
            )}
            <div id="topBarLeft" className="hideScrollbar" ref={topBarLeftRef}>
                <div id="topBarMain">
                    <div id="topBarTitle">
                        <div id="topBarTitleName" tabIndex={200}>
                            {window.mmgisglobal.name}
                        </div>
                    </div>
                </div>
                <div id="topBarSecondary">
                    <div
                        className="mainDescription"
                        title="Go to active item"
                    ></div>
                    <div
                        className="mainInfo"
                        title="Go to featured item"
                    ></div>
                </div>
            </div>
            <div id="topBarRight">
                <div className="Search"></div>
            </div>
        </div>
    )
}

export default TopBar
