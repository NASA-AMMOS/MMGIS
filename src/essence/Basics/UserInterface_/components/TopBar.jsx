import React, { useState, useEffect, useRef, useCallback } from 'react'
import useUIStore from '../store/uiStore'
import BottomBar from '../BottomBar'
import BottomBarReact from './BottomBarReact'

import './TopBar.css'

function TopBar({ userInterface }) {
    const topBarLeftRef = useRef(null)
    const isMobile = useUIStore((s) => s.isMobile)
    const mobileTopSize = useUIStore((s) => s.mobileTopSize)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const toolsWrapperRawWidth = useUIStore((s) => s.toolsWrapperRawWidth)

    const [viewerOpen, setViewerOpen] = useState(false)
    const [mapOpen, setMapOpen] = useState(true)
    const [globeOpen, setGlobeOpen] = useState(false)
    const [username, setUsername] = useState(null)
    const [showUserCard, setShowUserCard] = useState(false)
    const userCardRef = useRef(null)
    const userBtnRef = useRef(null)
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)

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

    // Sync panel open states from store
    useEffect(() => {
        const unsub = useUIStore.subscribe((state) => {
            setViewerOpen(state.pxIsViewer > 0)
            setMapOpen(state.pxIsMap > 0)
            setGlobeOpen(state.pxIsGlobe > 0)
        })
        // Initial sync
        const s = useUIStore.getState()
        setViewerOpen(s.pxIsViewer > 0)
        setMapOpen(s.pxIsMap > 0)
        setGlobeOpen(s.pxIsGlobe > 0)
        return unsub
    }, [])

    // Sync user login state
    useEffect(() => {
        function syncUser() {
            if (window.mmgisglobal && window.mmgisglobal.user && window.mmgisglobal.user !== 'guest') {
                setUsername(window.mmgisglobal.user)
            } else {
                setUsername(null)
            }
        }
        syncUser()
        const interval = setInterval(syncUser, 2000)
        return () => clearInterval(interval)
    }, [])

    // Hide the jQuery #loginDiv since we handle user UI in React now
    useEffect(() => {
        const loginDiv = document.getElementById('loginDiv')
        if (loginDiv) loginDiv.style.display = 'none'
        return () => {
            if (loginDiv) loginDiv.style.display = ''
        }
    }, [])

    // Close user card and menu when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                userCardRef.current && !userCardRef.current.contains(e.target) &&
                userBtnRef.current && !userBtnRef.current.contains(e.target)
            ) {
                setShowUserCard(false)
            }
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                menuBtnRef.current && !menuBtnRef.current.contains(e.target)
            ) {
                setShowMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleMenuClick = useCallback(() => {
        const barBottom = document.getElementById('barBottom')
        if (barBottom) {
            barBottom.style.display =
                barBottom.style.display === 'none' || !barBottom.style.display
                    ? 'flex'
                    : 'none'
        }
    }, [])

    const handleToggleViewer = useCallback(() => {
        if (userInterface && userInterface.setPanelPercents) {
            const pp = userInterface.getPanelPercents()
            const newState = !(useUIStore.getState().pxIsViewer > 0)
            if (newState) {
                const globeAmt = pp.globe > 0 ? 33 : 0
                const mapAmt = 100 - 33 - globeAmt
                userInterface.setPanelPercents(33, mapAmt, globeAmt)
            } else {
                if (pp.map > 0 && pp.globe > 0) {
                    userInterface.setPanelPercents(0, pp.map + pp.viewer / 2, pp.globe + pp.viewer / 2)
                } else if (pp.map > 0) {
                    userInterface.setPanelPercents(0, pp.map + pp.viewer, 0)
                } else if (pp.globe > 0) {
                    userInterface.setPanelPercents(0, 0, pp.globe + pp.viewer)
                } else {
                    userInterface.setPanelPercents(0, 100, 0)
                }
            }
        }
    }, [userInterface])

    const handleToggleMap = useCallback(() => {
        if (userInterface && userInterface.setPanelPercents) {
            const pp = userInterface.getPanelPercents()
            const newState = !(useUIStore.getState().pxIsMap > 0)
            if (newState) {
                if (pp.viewer > 0 && pp.globe > 0) {
                    userInterface.setPanelPercents(pp.viewer / 2, 50, pp.globe / 2)
                } else if (pp.viewer > 0) {
                    userInterface.setPanelPercents(pp.viewer / 2, 50, 0)
                } else if (pp.globe > 0) {
                    userInterface.setPanelPercents(0, 50, pp.globe / 2)
                } else {
                    userInterface.setPanelPercents(0, 100, 0)
                }
            } else {
                if (pp.viewer > 0 || pp.globe > 0) {
                    if (pp.viewer > 0 && pp.globe > 0) {
                        userInterface.setPanelPercents(pp.viewer + pp.map / 2, 0, pp.globe + pp.map / 2)
                    } else if (pp.viewer > 0) {
                        userInterface.setPanelPercents(pp.viewer + pp.map, 0, 0)
                    } else {
                        userInterface.setPanelPercents(0, 0, pp.globe + pp.map)
                    }
                }
            }
        }
    }, [userInterface])

    const handleToggleGlobe = useCallback(async () => {
        if (userInterface && userInterface.setPanelPercents) {
            const Globe_ = require('../../Globe_/Globe_').default
            if (Globe_._isInitializing) return
            const newState = !(useUIStore.getState().pxIsGlobe > 0)
            if (!Globe_._initialized) {
                Globe_._isInitializing = true
                try {
                    await Globe_.lazyInit()
                } finally {
                    Globe_._isInitializing = false
                }
            }
            const pp = userInterface.getPanelPercents()
            if (newState) {
                const viewerAmt = pp.viewer > 0 ? 33 : 0
                const mapAmt = 100 - 33 - viewerAmt
                userInterface.setPanelPercents(viewerAmt, mapAmt, 33)
            } else {
                if (pp.map > 0 && pp.viewer > 0) {
                    userInterface.setPanelPercents(pp.viewer + pp.globe / 2, pp.map + pp.globe / 2, 0)
                } else if (pp.map > 0) {
                    userInterface.setPanelPercents(0, pp.map + pp.globe, 0)
                } else if (pp.viewer > 0) {
                    userInterface.setPanelPercents(pp.viewer + pp.globe, 0, 0)
                } else {
                    userInterface.setPanelPercents(0, 100, 0)
                }
            }
        }
    }, [userInterface])

    const handleLogout = useCallback(() => {
        setShowUserCard(false)
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

    const handleSignIn = useCallback(() => {
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

    // Compute TopBar styles reactively from store state
    const TOOLBAR_WIDTH = 40
    const leftOffset = isMobile ? mobileTopSize : TOOLBAR_WIDTH
    const topBarStyle = {
        transition: 'margin-left 0.2s ease-out, width 0.2s ease-out, padding-left 0.2s ease-out',
    }
    if (isMobile) {
        topBarStyle.background = 'var(--color-a)'
    }
    if (toolPanelWidth > 0) {
        topBarStyle.paddingLeft = '0px'
        topBarStyle.marginLeft = (toolPanelWidth + leftOffset) + 'px'
        topBarStyle.width = `calc(100% - ${toolPanelWidth + leftOffset}px)`
    } else if (toolsWrapperRawWidth && toolsWrapperRawWidth !== 0 && toolsWrapperRawWidth !== 'full') {
        const newTopWidth = leftOffset + toolsWrapperRawWidth
        topBarStyle.marginLeft = newTopWidth + 'px'
        topBarStyle.width = `calc(100% - ${newTopWidth}px)`
    } else {
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
                    <BottomBarReact userInterface={userInterface} />
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

            {/* Panel toggles + user area + kebab menu */}
            {!isMobile && (
                <div className="topbar-react-overlay">
                    <div className="topbar-panel-toggles">
                        <button
                            className={'topbar-toggle-btn' + (viewerOpen ? ' active' : '')}
                            onClick={handleToggleViewer}
                            title="Toggle Viewer panel"
                        >
                            Viewer
                        </button>
                        <button
                            className={'topbar-toggle-btn' + (mapOpen ? ' active' : '')}
                            onClick={handleToggleMap}
                            title="Toggle Map panel"
                        >
                            Map
                        </button>
                        <button
                            className={'topbar-toggle-btn' + (globeOpen ? ' active' : '')}
                            onClick={handleToggleGlobe}
                            title="Toggle Globe panel"
                        >
                            Globe
                        </button>
                    </div>

                    {/* User account area */}
                    <div className="topbar-user-area">
                        {username ? (
                            <div className="topbar-user-wrapper">
                                <div
                                    ref={userBtnRef}
                                    className="topbar-user-avatar"
                                    onClick={() => setShowUserCard(!showUserCard)}
                                    title={username}
                                >
                                    {username[0].toUpperCase()}
                                </div>
                                {showUserCard && (
                                    <div ref={userCardRef} className="topbar-user-card">
                                        <div className="topbar-user-card-name">{username}</div>
                                        <div className="topbar-user-card-divider" />
                                        <div className="topbar-user-card-action" onClick={handleLogout}>
                                            <i className="mdi mdi-logout" style={{ marginRight: 6, fontSize: 14 }} />
                                            Logout
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                className="topbar-signin-btn"
                                onClick={handleSignIn}
                                title="Sign In"
                            >
                                <i className="mdi mdi-login" style={{ fontSize: 16 }} />
                            </div>
                        )}
                    </div>

                    {/* Right menu (kebab) */}
                    <div className="topbar-menu-wrapper">
                        <div
                            ref={menuBtnRef}
                            className="topbar-menu-btn"
                            onClick={() => setShowMenu(!showMenu)}
                            title="Menu"
                        >
                            <i className="mdi mdi-dots-vertical" style={{ fontSize: 20 }} />
                        </div>
                        {showMenu && (
                            <div ref={menuRef} className="topbar-menu-dropdown">
                                <div className="topbar-menu-item"
                                    onClick={() => { BottomBar.copyLink(); setShowMenu(false) }}>
                                    <i className="mdi mdi-open-in-new" style={{ marginRight: 8, fontSize: 14 }} />
                                    Copy Link
                                </div>
                                <div className="topbar-menu-item"
                                    onClick={() => { BottomBar.takeScreenshot(); setShowMenu(false) }}>
                                    <i className="mdi mdi-camera" style={{ marginRight: 8, fontSize: 14 }} />
                                    Screenshot
                                </div>
                                <div className="topbar-menu-item"
                                    onClick={() => { BottomBar.fullscreen(); setShowMenu(false) }}>
                                    <i className="mdi mdi-fullscreen" style={{ marginRight: 8, fontSize: 14 }} />
                                    Fullscreen
                                </div>
                                <div className="topbar-menu-item"
                                    onClick={() => { BottomBar.toggleHotkeys(true); setShowMenu(false) }}>
                                    <i className="mdi mdi-keyboard" style={{ marginRight: 8, fontSize: 14 }} />
                                    Keyboard Shortcuts
                                </div>
                                <div className="topbar-menu-item"
                                    onClick={() => { BottomBar.toggleSettings(true); setShowMenu(false) }}>
                                    <i className="mdi mdi-cog" style={{ marginRight: 8, fontSize: 14 }} />
                                    Settings
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default TopBar
