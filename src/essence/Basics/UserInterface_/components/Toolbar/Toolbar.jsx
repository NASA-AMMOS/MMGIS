import React, { useEffect, useCallback, useState } from 'react'
import useUIStore from '../../store/uiStore'
import F_ from '../../../Formulae_/Formulae_'
import BottomBarReact from '../BottomBar/BottomBarReact'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'

import styles from './Toolbar.module.css'

/**
 * MobileCoordButton — renders a coordinate toggle button in the mobile toolbar.
 * Replaces the jQuery-constructed coordSelect div from ToolController_.init().
 */
function MobileCoordButton() {
    const [isActive, setIsActive] = useState(false)
    const activeToolName = useUIStore((s) => s.activeToolName)

    // When another tool opens, deactivate coords
    useEffect(() => {
        if (activeToolName && activeToolName !== 'CoordinatesTool' && isActive) {
            const L_ = require('../../../Layers_/Layers_').default
            L_.Coordinates.destroy()
            setIsActive(false)
        }
    }, [activeToolName]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = useCallback(() => {
        const ToolController_ =
            require('../../../ToolController_/ToolController_').default
        const L_ = require('../../../Layers_/Layers_').default

        // Button active/inactive styling is driven by React state (isActive)
        // and activeToolName in the store — no imperative DOM toggling needed.

        if (!isActive) {
            // Close any active tool first and cancel deferred cleanup
            ToolController_.closeActiveTool()
            if (ToolController_._pendingCloseTool) {
                ToolController_._pendingCloseTool.destroy()
                ToolController_._pendingCloseTool = null
            }
            ++ToolController_._closeSeq

            L_.Coordinates.initialize()
            L_.Coordinates.init()
            ToolController_.setToolHeight(L_.Coordinates.height)
            ToolController_.setToolWidth()
            ToolController_.activeToolName = 'CoordinatesTool'
            useUIStore.getState().setActiveToolName('CoordinatesTool')
            L_.Coordinates.make()
            setIsActive(true)
        } else {
            ToolController_.setToolHeight(0)
            ToolController_.setToolWidth()
            L_.Coordinates.destroy()
            ToolController_.activeToolName = null
            useUIStore.getState().setActiveToolName(null)
            setIsActive(false)
        }

        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.paddingLeft = '34px'
            topBar.style.marginLeft = '0px'
            topBar.style.width = '100%'
        }
    }, [isActive])

    return (
        <div
            id="coordinatesDiv"
            className={'toolButton' + (isActive ? ' toolButtonActive' : '')}
            style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
            onClick={handleClick}
        >
            <i
                className="mdi mdi-target mdi-18px"
                style={{ cursor: 'pointer', lineHeight: '40px' }}
            />
        </div>
    )
}

/**
 * MobileTimeUIToggle — toggle button that moves #timeUI in/out of #tools.
 * TimeUI.init() stages the mobile markup in a hidden #timeUIMobileStaging div.
 * This button moves it into #tools (opening the tool panel) or back (closing).
 */
function MobileTimeUIToggle() {
    const [isActive, setIsActive] = useState(false)
    const [hasTime, setHasTime] = useState(false)
    const activeToolName = useUIStore((s) => s.activeToolName)

    useEffect(() => {
        try {
            const L_ = require('../../../Layers_/Layers_').default
            if (L_.configData.time && L_.configData.time.enabled === true) {
                setHasTime(true)
            }
        } catch (e) {
            // L_ not available yet
        }
    }, [])

    // When another tool opens, rescue #timeUI back to staging before
    // the new tool's make() clears #tools
    useEffect(() => {
        if (activeToolName && activeToolName !== 'MobileTimeUI' && isActive) {
            const timeUI = document.getElementById('timeUI')
            const staging = document.getElementById('timeUIMobileStaging')
            if (timeUI && staging) {
                staging.appendChild(timeUI)
            }
            useUIStore.getState().setTimeUIActive(false)
            setIsActive(false)
        }
    }, [activeToolName]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = useCallback(() => {
        const $ = require('jquery')
        const L_ = require('../../../Layers_/Layers_').default
        const ToolController_ =
            require('../../../ToolController_/ToolController_').default

        if (!isActive) {
            // Close any active tool first and cancel deferred cleanup
            ToolController_.closeActiveTool()
            if (ToolController_._pendingCloseTool) {
                ToolController_._pendingCloseTool.destroy()
                ToolController_._pendingCloseTool = null
            }
            ++ToolController_._closeSeq
            ToolController_.activeToolName = 'MobileTimeUI'
            useUIStore.getState().setActiveToolName('MobileTimeUI')

            // Move #timeUI from staging into #tools
            const timeUI = document.getElementById('timeUI')
            const toolsContainer = document.getElementById('tools')
            if (timeUI && toolsContainer) {
                toolsContainer.innerHTML = ''
                toolsContainer.appendChild(timeUI)
                timeUI.style.display = ''
                $('#timeUI').addClass('active expanded')
                $('#mmgisTimeUIExpandedContent').addClass('show')
            } else if (toolsContainer) {
                // #timeUI was destroyed by some unexpected path. Best-effort
                // recovery: re-initialize TimeUI from scratch. Remove the old
                // global popover divs first so the second init() doesn't end
                // up with duplicate-id elements on <body>. After init() puts
                // the new #timeUI into #timeUIMobileStaging, move it into
                // #tools and call fina() so date pickers and button click
                // handlers are wired up (init() alone leaves them dormant).
                // The primary rescues in ToolController_.makeTool() and
                // Coordinates.js should make this branch unreachable in
                // normal use; some delegated body/document handlers will be
                // duplicated here, which is acceptable for a degraded path.
                toolsContainer.innerHTML = ''
                $('#timeUIPlayPopover_global').remove()
                $('#timeUIQuickSelectPopover_global').remove()
                const TimeUI =
                    require('../../../TimeControl_/TimeUI').default
                TimeUI.init(TimeUI.timeChange, true)
                const freshTimeUI = document.getElementById('timeUI')
                if (freshTimeUI) {
                    toolsContainer.appendChild(freshTimeUI)
                    freshTimeUI.style.display = ''
                    $('#timeUI').addClass('active expanded')
                    $('#mmgisTimeUIExpandedContent').addClass('show')
                    TimeUI.fina()
                }
            }

            // Open the tool panel (217px matches TimeUI.height for mobile)
            ToolController_.setToolHeight(217)
            ToolController_.setToolWidth()

            useUIStore.getState().setTimeUIActive(true)
            useUIStore.getState().setTimeUIExpanded(true)
            Object.keys(L_._onTimeUIToggleSubscriptions).forEach((k) => {
                L_._onTimeUIToggleSubscriptions[k](true)
            })
            setIsActive(true)
        } else {
            // Move #timeUI back to staging
            const timeUI = document.getElementById('timeUI')
            const staging = document.getElementById('timeUIMobileStaging')
            if (timeUI && staging) {
                staging.appendChild(timeUI)
                $('#timeUI').removeClass('active')
            }

            // Close the tool panel
            ToolController_.setToolHeight(0)
            ToolController_.setToolWidth()
            ToolController_.activeToolName = null
            useUIStore.getState().setActiveToolName(null)

            useUIStore.getState().setTimeUIActive(false)
            Object.keys(L_._onTimeUIToggleSubscriptions).forEach((k) => {
                L_._onTimeUIToggleSubscriptions[k](false)
            })
            setIsActive(false)
        }
    }, [isActive])

    if (!hasTime) return null

    return (
        <div
            className={'toolButton' + (isActive ? ' toolButtonActive' : '')}
            style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
                float: 'right',
                flexShrink: 0,
            }}
            onClick={handleClick}
            title="Toggle Time UI"
        >
            <i className="mdi mdi-clock-outline mdi-18px" style={{ lineHeight: '40px' }} />
        </div>
    )
}

/**
 * MobileExtraButtons — conditionally renders time and coordinate toggle
 * buttons in the mobile toolbar.
 */
function MobileExtraButtons() {
    const [configChecked, setConfigChecked] = useState(false)
    const [showCoords, setShowCoords] = useState(false)

    useEffect(() => {
        try {
            const L_ = require('../../../Layers_/Layers_').default
            if (
                L_.configData.coordinates &&
                (L_.configData.coordinates.coordll === true ||
                    L_.configData.coordinates.coorden === true)
            ) {
                setShowCoords(true)
            }
        } catch (e) {
            // L_ not available yet
        }
        setConfigChecked(true)
    }, [])

    if (!configChecked) return null

    return (
        <>
            {showCoords && <MobileCoordButton />}
            <MobileTimeUIToggle />
        </>
    )
}

/**
 * ToolButton — a single toolbar button rendered in React.
 * Replaces the jQuery-constructed toolButton divs from ToolController_.init().
 */
function ToolButton({ tool, index, isMobile, isActive, onToolClick }) {
    const button = (
        <div
            id={'toolButton' + tool.name}
            className={'toolButton' + (isActive ? ' toolButtonActive' : '')}
            tabIndex={index + 1}
            style={{
                width: isMobile ? '40px' : '34px',
                height: isMobile ? '100%' : '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                lineHeight: isMobile ? '40px' : '34px',
                margin: isMobile ? undefined : '1px 0',
                borderRadius: isMobile ? undefined : '8px',
                verticalAlign: 'middle',
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
            onClick={() => onToolClick(tool, index)}
        >
            <i
                id={tool.name + 'Tool'}
                className={'mdi mdi-' + tool.icon + ' mdi-18px'}
                style={{ cursor: 'pointer' }}
            />
        </div>
    )

    if (isMobile) return button

    return (
        <Tooltip content={tool.name} placement="right">
            {button}
        </Tooltip>
    )
}

/**
 * SepToolButton — a single separated tool button in the toolbar.
 */
function SepToolButton({ tool, isActive }) {
    const handleClick = useCallback(() => {
        const ToolController_ =
            require('../../../ToolController_/ToolController_').default
        const toolModuleName = tool.name + 'Tool'
        // Tool modules are lazy-loaded — resolve the module first so
        // that we have its `make`/`destroy` methods available. Calling
        // `ensureToolLoaded` against an already-loaded module is a
        // cheap no-op (returns the cached module).
        ToolController_.ensureToolLoaded(toolModuleName).then((tM) => {
            if (!tM) return

            if (tM.made === false) {
                tM.make(`toolContentSeparated_${tool.name}`)
                ToolController_.activeSeparatedTools.push(toolModuleName)
                useUIStore.getState().addActiveSeparatedTool(toolModuleName)
            } else {
                tM.destroy()
                ToolController_.activeSeparatedTools =
                    ToolController_.activeSeparatedTools.filter(
                        (a) => a !== toolModuleName
                    )
                useUIStore
                    .getState()
                    .removeActiveSeparatedTool(toolModuleName)
            }
            document.dispatchEvent(
                new CustomEvent('toggleSeparatedTool', {
                    detail: { toggledToolName: tool.js, visible: tM.made },
                })
            )
        })
    }, [tool])

    const button = (
        <div
            id={`toolButtonSeparated_${tool.name}`}
            className={'toolButton toolSep' + (isActive ? ' active' : '')}
            style={{
                width: '100%',
                height: '36px',
                display: 'inline-block',
                textAlign: 'center',
                lineHeight: '36px',
                verticalAlign: 'middle',
                cursor: 'pointer',
                transition: 'all 0.15s',
                color: isActive ? 'var(--color-c)' : 'var(--color-a3)',
                background: isActive ? 'var(--color-accent-active)' : 'none',
            }}
            onClick={handleClick}
        >
            <i
                id={`sepIcon_${tool.name}Tool`}
                className={`mdi mdi-${tool.icon} mdi-18px`}
                style={{ cursor: 'pointer' }}
            />
        </div>
    )

    return (
        <Tooltip content={tool.name} placement="right">
            {button}
        </Tooltip>
    )
}

/**
 * SepToolsSection — renders the divider + all separated tool buttons below
 * the main toolbar buttons.
 */
function SepToolsSection() {
    const separatedToolsList = useUIStore((s) => s.separatedToolsList)
    const activeSeparatedTools = useUIStore((s) => s.activeSeparatedTools)

    if (!separatedToolsList || separatedToolsList.length === 0) return null

    // Sort: Legend first
    const sorted = [...separatedToolsList].sort((a, b) => {
        if (a.name === 'Legend') return -1
        if (b.name === 'Legend') return 1
        return 0
    })

    return (
        <div id="toolcontroller_sepdiv">
            <div
                className="toolSepDivider"
                style={{
                    width: '26px',
                    height: '1px',
                    margin: '4px auto',
                    background: 'var(--color-a1)',
                }}
            />
            {sorted.map((tool) => (
                <SepToolButton
                    key={tool.name}
                    tool={tool}
                    isActive={activeSeparatedTools.includes(tool.name + 'Tool')}
                />
            ))}
        </div>
    )
}

function Toolbar({ userInterface }) {
    const isMobile = useUIStore((s) => s.isMobile)
    const topSize = useUIStore((s) => s.topSize)
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const toolbarVisible = useUIStore((s) => s.toolbarVisible)
    const toolsList = useUIStore((s) => s.toolsList)
    const activeToolName = useUIStore((s) => s.activeToolName)
    const toolsLoaded = useUIStore((s) => s.toolsLoaded)
    const mobileTools = useUIStore((s) => s.mobileTools)

    const handleToolClick = useCallback((tool, index) => {
        // Delegate to ToolController_ which manages tool lifecycle.
        // Use require to avoid circular dependency.
        const ToolController_ =
            require('../../../ToolController_/ToolController_').default
        const toolModuleName = ToolController_.toolModuleNames[index]

        // Button active/inactive styling is driven entirely by the store's
        // activeToolName field. ToolButton reads isActive from the store
        // and applies color/background reactively — no imperative DOM
        // class toggling needed.

        // `makeTool` is async (lazy module load); wait until the tool
        // is actually made before syncing state/dispatching events so
        // listeners see the correct activeTool/activeToolName.
        Promise.resolve(ToolController_.makeTool(toolModuleName, index)).then(
            () => {
                useUIStore
                    .getState()
                    .setActiveToolName(ToolController_.activeToolName)

                document.dispatchEvent(
                    new CustomEvent('toolChange', {
                        detail: {
                            activeTool: ToolController_.activeTool,
                            activeToolName: ToolController_.activeToolName,
                        },
                    })
                )
            }
        )
    }, [])

    // Filter tools for display:
    // - Desktop: exclude separated tools (they render in SeparatedTools.jsx)
    // - Mobile: only show tools in the mobileTools list
    const toolbarTools = toolsList.filter((t) => {
        if (isMobile) {
            return mobileTools.length === 0 || mobileTools.includes(t.name)
        }
        return !t.separatedTool
    })

    return (
        <>
            <div
                id="toolbar"
                style={isMobile ? {
                    boxShadow: '0px -3px 3px 0px rgba(0, 0, 0, 0.3)',
                    height: '40px',
                    paddingTop: '0px',
                    background: 'var(--color-a)',
                    bottom: (pxIsTools || 0) + 'px',
                    width: '100%',
                    zIndex: 2006,
                    transition: 'bottom 0.3s ease-out',
                    display: toolbarVisible ? 'inherit' : 'none',
                } : {
                    width: toolbarVisible ? '40px' : '0px',
                    background: 'var(--color-a)',
                    borderRight: toolbarVisible ? '1px solid var(--color-a1)' : 'none',
                    top: topSize + 'px',
                    height: `calc(100% - ${topSize}px)`,
                    zIndex: 2006,
                    display: toolbarVisible ? 'flex' : 'none',
                    flexDirection: 'column',
                }}
            >
                {toolsLoaded && (
                    <div
                        id="toolbarTools"
                        style={{ height: '100%' }}
                    >
                        <div
                            id="toolcontroller_incdiv"
                            className={`sixteen wide column ${styles.toolcontrollerIncdiv}`}
                            style={{
                                transition: 'all 0.25s ease-in',
                                pointerEvents: 'auto',
                                opacity: 1,
                                paddingBottom: isMobile ? '0px' : '8px',
                                overflowY: isMobile ? 'hidden' : undefined,
                            }}
                        >
                            {toolbarTools.map((tool) => {
                                // Find the real index in the full toolsList
                                // for ToolController_.toolModuleNames lookup
                                const realIndex = toolsList.indexOf(tool)
                                return (
                                    <ToolButton
                                        key={tool.name}
                                        tool={tool}
                                        index={realIndex}
                                        isMobile={isMobile}
                                        isActive={activeToolName === tool.js}
                                        onToolClick={handleToolClick}
                                    />
                                )
                            })}
                            {isMobile && <MobileExtraButtons />}
                        </div>
                        {!isMobile && <SepToolsSection />}
                    </div>
                )}
                {!isMobile && <BottomBarReact userInterface={userInterface} />}
            </div>
            <div
                id="mmgislogo"
                style={{
                    display: 'inherit',
                    padding: '9px 6px',
                    cursor: 'pointer',
                    width: '40px',
                    height: '40px',
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    zIndex: 2005,
                    imageRendering: 'pixelated',
                    borderRight: '1px solid var(--color-a1)',
                }}
                onClick={F_.toHostForceLanding}
                dangerouslySetInnerHTML={{
                    __html: `<svg width="27" height="27" viewBox="0 0 231 137" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.222266 9.21339C-0.277832 14.7126 0.222266 133.713 0.222266 133.713H26.2223V45.7134C26.2223 45.7134 100.722 127.712 106.222 132.713C109.171 135.395 112.12 136.782 115.222 136.645C118.325 136.782 121.274 135.395 124.222 132.713C129.722 127.712 204.222 45.7134 204.222 45.7134V133.713H230.222C230.222 133.713 230.722 14.7126 230.222 9.21339C229.722 3.71413 218.222 -3.28766 210.222 1.71339C202.222 6.71444 115.222 104.713 115.222 104.713C115.222 104.713 28.2224 6.71444 20.2223 1.71339C12.2222 -3.28766 0.722363 3.71413 0.222266 9.21339Z" fill="#08AEEA"></path>
</svg>`,
                }}
            ></div>
            <div
                id="dataLoadingSpinner"
                style={{
                    opacity: 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: 'none',
                    width: '40px',
                    height: '40px',
                    background: 'var(--color-a)',
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    zIndex: 2005,
                }}
            >
                <div
                    className="mmgis-spinner2"
                    style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                    }}
                ></div>
            </div>
        </>
    )
}

export default Toolbar
