import React, { useState, useEffect, useRef, useCallback } from 'react'
import useUIStore from '../../store/uiStore'
import BottomBar from '../../BottomBar'
import BottomBarReact from '../BottomBar/BottomBarReact'
import Toggle from '../../../../../design-system/components/Toggle/Toggle'
import Dropdown from '../../../../../design-system/components/Dropdown/Dropdown'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal'
import Modal from '../Modal/Modal'

import styles from './TopBar.module.css'

const STATUS_CONFIG = {
    RELOAD: {
        icon: 'mdi-reload-alert',
        color: 'var(--color-h)',
        tooltip: 'Updates available — click to reload MMGIS',
    },
    ADD_LAYER: {
        icon: 'mdi-reload',
        color: 'var(--color-green)',
        tooltip: 'New layers available — click to update',
    },
    DISCONNECTED: {
        icon: 'mdi-alert-outline',
        color: 'var(--color-r1)',
        tooltip: 'WebSocket connection closed',
    },
}

function StatusIndicator() {
    const statusType = useUIStore((s) => s.statusIndicator)
    const config = statusType ? STATUS_CONFIG[statusType] : null

    const handleClick = useCallback(() => {
        if (!statusType) return
        if (statusType === 'RELOAD' || statusType === 'DISCONNECTED') {
            ConfirmationModal.prompt(
                'Do you want to reload MMGIS to receive new updates?',
                (isYes) => { if (isYes) location.reload() }
            )
        } else if (statusType === 'ADD_LAYER') {
            const L_ = require('../../../Layers_/Layers_').default
            const UserInterface_ = require('../../UserInterfaceBridge').default
            // Show the layer update modal via LayerUpdatedControl's modal logic
            let table = [
                '<table class="table" style="text-align: left;">',
                '<tr style="font-width: bold"><th style="column-width: 100px">Action</th><th>Layer name</th></tr>',
            ]
            const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
            for (let i in L_.addLayerQueue) {
                const { newLayerName, type } = L_.addLayerQueue[i]
                const typePrettify = type.split(/(?=[A-Z])/).map((e) => e.charAt(0).toUpperCase() + e.slice(1).toLowerCase())
                table.push(`<tr><td style="column-width: 100px">${esc(typePrettify.join(' '))}</td><td>${esc(newLayerName)}</td></tr>`)
            }
            table.push('</table>')
            const modalContent = [
                "<div id='mainSettingsModal'>",
                    "<div id='mainSettingsModalTitle'>",
                        "<div><i class='mdi mdi-reload mdi-18px'></i><div>Update map layers</div></div>",
                        "<div id='mainSettingsModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>",
                    "</div>",
                    "<div id='update-modal-content'>",
                        "<div class='update-modal-section'>",
                            "<div class='update-modal-section-title'>The following changes can be updated:</div>",
                            "<div class='update-modal-table-container'>",
                            ...table,
                            "</div>",
                            "<div id='update-modal-actions'>",
                                "<div class='update-modal-flex'>",
                                    "<div class='drawToolFileCancel drawToolButton1'>Cancel</div>",
                                    "<div class='drawToolFileSave drawToolButton1'>Update</div>",
                                "</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
            ].join('\n')

            Modal.set(modalContent, function () {
                const $ = require('jquery')
                $('.drawToolFileSave').on('click', function () {
                    Modal.remove()
                    L_.updateQueueLayers()
                    UserInterface_.removeLayerUpdateButton()
                })
                $('.drawToolFileCancel').on('click', function () { Modal.remove() })
                $('#mainSettingsModalClose').on('click', function () { Modal.remove() })
            }, function () {})
        }
    }, [statusType])

    return (
        <div
            className={styles.statusIndicator}
            style={{ opacity: config ? 1 : 0, pointerEvents: config ? 'auto' : 'none' }}
            onClick={handleClick}
            title={config ? config.tooltip : ''}
        >
            {config && (
                <Tooltip content={config.tooltip} placement="bottom">
                    <i
                        className={`mdi ${config.icon} mdi-18px`}
                        style={{ color: config.color }}
                    />
                </Tooltip>
            )}
        </div>
    )
}

function TopBar({ userInterface }) {
    const topBarLeftRef = useRef(null)
    const isMobile = useUIStore((s) => s.isMobile)
    const lookConfig = useUIStore((s) => s.lookConfig)

    const [viewerOpen, setViewerOpen] = useState(false)
    const [mapOpen, setMapOpen] = useState(true)
    const [globeOpen, setGlobeOpen] = useState(false)
    const [username, setUsername] = useState(null)
    const userBtnRef = useRef(null)

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

    // Hide the jQuery #loginDiv and #loginoutButton since we handle user UI in React now
    useEffect(() => {
        const loginDiv = document.getElementById('loginDiv')
        if (loginDiv) loginDiv.style.display = 'none'
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.style.display = 'none'
        return () => {
            if (loginDiv) loginDiv.style.display = ''
            if (loginoutBtn) loginoutBtn.style.display = ''
        }
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

    const handleToggleGlobe = useCallback(() => {
        if (userInterface && userInterface.setPanelPercents) {
            const Globe_ = require('../../../Globe_/Globe_').default
            const newState = !(useUIStore.getState().pxIsGlobe > 0)
            if (newState && !Globe_.hasBeenOpened) {
                Globe_.init()
                Globe_.hasBeenOpened = true
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
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

    const handleSignIn = useCallback(() => {
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

    // TopBar stays full-width always — tool panel floats underneath it
    const topBarStyle = {}
    if (isMobile) {
        topBarStyle.background = 'var(--color-a)'
        topBarStyle.paddingLeft = '80px'
    } else {
        topBarStyle.paddingLeft = '40px'
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
                    <StatusIndicator />
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
                <div className={styles.reactOverlay}>
                    <Toggle.Group className={styles.panelToggles}>
                        <Tooltip content="Toggle Viewer panel" placement="bottom">
                            <Toggle
                                pressed={viewerOpen}
                                onPressedChange={handleToggleViewer}
                            >
                                Viewer
                            </Toggle>
                        </Tooltip>
                        <Tooltip content="Toggle Map panel" placement="bottom">
                            <Toggle
                                pressed={mapOpen}
                                onPressedChange={handleToggleMap}
                            >
                                Map
                            </Toggle>
                        </Tooltip>
                        <Tooltip content="Toggle Globe panel" placement="bottom">
                            <Toggle
                                pressed={globeOpen}
                                onPressedChange={handleToggleGlobe}
                            >
                                Globe
                            </Toggle>
                        </Tooltip>
                    </Toggle.Group>

                    {/* User account area — hidden when AUTH=off */}
                    {typeof window !== 'undefined' && window.mmgisglobal && window.mmgisglobal.AUTH !== 'off' && (
                        <div className={styles.userArea}>
                            {username ? (
                                <div className={styles.userWrapper}>
                                    <Dropdown
                                        trigger={
                                            <div
                                                ref={userBtnRef}
                                                className={styles.userAvatar}
                                                title={username}
                                            >
                                                {username[0].toUpperCase()}
                                            </div>
                                        }
                                    >
                                        <div className={styles.userCardName}>{username}</div>
                                        <div className={styles.userCardDivider} />
                                        <Dropdown.Item onClick={handleLogout}>
                                            <i className="mdi mdi-logout" style={{ marginRight: 6, fontSize: 14 }} />
                                            Logout
                                        </Dropdown.Item>
                                    </Dropdown>
                                </div>
                            ) : (
                                <IconButton
                                    onClick={handleSignIn}
                                >
                                    <i className="mdi mdi-login" style={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </div>
                    )}

                    {/* Right menu (kebab) */}
                    <Dropdown
                        trigger={
                            <IconButton className={styles.menuBtn}>
                                <i className="mdi mdi-dots-vertical" style={{ fontSize: 20 }} />
                            </IconButton>
                        }
                    >
                        {lookConfig.copylink !== false && (
                            <Dropdown.Item onClick={() => BottomBar.copyLink()}>
                                <i className="mdi mdi-open-in-new" style={{ marginRight: 8, fontSize: 14 }} />
                                Copy Link
                            </Dropdown.Item>
                        )}
                        {lookConfig.screenshot !== false && (
                            <Dropdown.Item onClick={() => BottomBar.takeScreenshot()}>
                                <i className="mdi mdi-camera" style={{ marginRight: 8, fontSize: 14 }} />
                                Screenshot
                            </Dropdown.Item>
                        )}
                        {lookConfig.fullscreen !== false && (
                            <Dropdown.Item onClick={() => BottomBar.fullscreen()}>
                                <i className="mdi mdi-fullscreen" style={{ marginRight: 8, fontSize: 14 }} />
                                Fullscreen
                            </Dropdown.Item>
                        )}
                        <Dropdown.Item onClick={() => BottomBar.toggleHotkeys(true)}>
                            <i className="mdi mdi-keyboard" style={{ marginRight: 8, fontSize: 14 }} />
                            Keyboard Shortcuts
                        </Dropdown.Item>
                        {lookConfig.settings !== false && (
                            <Dropdown.Item onClick={() => BottomBar.toggleSettings(true)}>
                                <i className="mdi mdi-cog" style={{ marginRight: 8, fontSize: 14 }} />
                                Settings
                            </Dropdown.Item>
                        )}
                    </Dropdown>
                </div>
            )}
        </div>
    )
}

export default TopBar
