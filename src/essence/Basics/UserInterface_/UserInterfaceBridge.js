import useUIStore from './store/uiStore'
import BottomBar from './BottomBar'
// LayerUpdatedControl is no longer used as a Leaflet control;
// status indicators now render in the TopBar via uiStore.statusIndicator
import { applyTheme } from '../../../design-system/applyTheme'
import { initThemeApplier, refreshThemeDOM } from '../../../design-system/themeApplier'

var Viewer_ = null
var Map_ = null
var Globe_ = null

// Bottom-element positioning is now handled by the React component
// BottomElementPositioner.jsx (mounted in UserInterfaceLayout.jsx).
// It subscribes to pxIsTools, timeUIActive, timeUIExpanded, and isMobile
// via useEffect, replacing the raw useUIStore.subscribe() call that was here.

const UserInterfaceBridge = {
    _isMobile: false,
    get isMobile() {
        return this._isMobile
    },
    set isMobile(val) {
        this._isMobile = val
        useUIStore.getState().setIsMobile(!!val)
        // Mobile uses topSize 40 (same as desktop)
        if (val) {
            useUIStore.setState({ topSize: 40, mobileTopSize: 40, toolHeightReserve: 40 })
        }
    },

    // Remaining imperative references (used by external consumers)
    rightPanelOpen: null,
    layerUpdatedControl: null,

    get splitterSize() {
        return useUIStore.getState().splitterSize
    },
    get splitterSizeHidden() {
        return useUIStore.getState().splitterSizeHidden
    },
    get topSize() {
        return useUIStore.getState().topSize
    },
    set topSize(val) {
        useUIStore.getState().setTopSize(val)
    },
    get fullSizeViews() {
        return useUIStore.getState().fullSizeViews
    },
    get pxIsViewer() {
        return useUIStore.getState().pxIsViewer
    },
    set pxIsViewer(val) {
        const state = useUIStore.getState()
        useUIStore.setState({ pxIsViewer: val })
    },
    get pxIsMap() {
        return useUIStore.getState().pxIsMap
    },
    set pxIsMap(val) {
        useUIStore.setState({ pxIsMap: val })
    },
    get pxIsGlobe() {
        return useUIStore.getState().pxIsGlobe
    },
    set pxIsGlobe(val) {
        useUIStore.setState({ pxIsGlobe: val })
    },
    get pxIsTools() {
        return useUIStore.getState().pxIsTools
    },
    set pxIsTools(val) {
        useUIStore.setState({ pxIsTools: val })
    },
    get pxIsToolsInit() {
        return useUIStore.getState().pxIsToolsInit
    },
    get mainWidth() {
        return useUIStore.getState().mainWidth
    },
    set mainWidth(val) {
        useUIStore.setState({ mainWidth: val })
    },
    get mainHeight() {
        return useUIStore.getState().mainHeight
    },
    set mainHeight(val) {
        useUIStore.setState({ mainHeight: val })
    },
    get hasViewer() {
        return useUIStore.getState().hasViewer
    },
    set hasViewer(val) {
        useUIStore.getState().setHasViewer(val)
    },
    get hasMap() {
        return useUIStore.getState().hasMap
    },
    get hasGlobe() {
        return useUIStore.getState().hasGlobe
    },
    set hasGlobe(val) {
        useUIStore.getState().setHasGlobe(val)
    },
    get helpOn() {
        return useUIStore.getState().helpOn
    },

    init: function () {
        // Apply default theme on init
        applyTheme(useUIStore.getState().themeName)
        // Start the imperative theme applier for jQuery-managed elements
        initThemeApplier()
    },

    hide: function () {
        useUIStore.getState().setVisible(false)
    },

    show: function () {
        useUIStore.getState().setVisible(true)
    },

    resize: function () {
        // No-op: ResizeObserver in SplitScreens.jsx handles dimension recapture
    },

    openToolPanel: function (width) {
        const panelEl = document.getElementById('toolPanel')
        if (panelEl) panelEl.innerHTML = ''
        useUIStore.getState().openToolPanel(width)
        // TopBar styles are now computed reactively by TopBar.jsx
        // Splitscreens dimensions are recaptured by ResizeObserver in SplitScreens.jsx
    },

    resizeToolPanel: function (width) {
        // Clamp width to [minToolWidth, half viewport]
        const ToolController_ =
            require('../ToolController_/ToolController_').default
        const activeTool = ToolController_.getTool(ToolController_.activeToolName)
        const minWidth = (activeTool && activeTool.width) || 300
        width = Math.max(Math.min(width, window.innerWidth / 2), minWidth)
        useUIStore.getState().openToolPanel(width)
        // TopBar styles are now computed reactively by TopBar.jsx
        // Splitscreens dimensions are recaptured by ResizeObserver in SplitScreens.jsx
    },

    closeToolPanel: function () {
        const panelEl = document.getElementById('toolPanel')
        if (panelEl) panelEl.innerHTML = ''
        useUIStore.getState().closeToolPanel()
        // TopBar styles are now computed reactively by TopBar.jsx
        // Splitscreens dimensions are recaptured by ResizeObserver in SplitScreens.jsx
    },

    setToolHeight: function (pxHeight, shouldntAnimate) {
        // Just update the store — the store subscription in _repositionBottomElements
        // handles all DOM repositioning automatically when pxIsTools changes.
        useUIStore.getState().setToolHeight(pxHeight, shouldntAnimate)
    },

    setToolWidth: function (newWidth, alignment) {
        useUIStore.getState().setToolWidth(newWidth)
        // TopBar styles are now computed reactively by TopBar.jsx
    },

    getPanelPercents: function () {
        return useUIStore.getState().getPanelPercents()
    },

    setPanelPercents: function (viewerPercent, mapPercent, globePercent) {
        useUIStore.getState().setPanelPercents(
            viewerPercent,
            mapPercent,
            globePercent
        )
    },

    openViewerPanel: function () {
        var pp = this.getPanelPercents()
        if (pp.map === 0) {
            this.setPanelPercents(
                pp.viewer + pp.globe / 2,
                0,
                pp.globe - pp.globe / 2
            )
        } else {
            this.setPanelPercents(
                pp.viewer + pp.map / 2,
                pp.map - pp.map / 2,
                pp.globe
            )
        }
    },

    openRightPanel: function (width) {
        if (UserInterfaceBridge.rightPanelOpen != null) return
        useUIStore.getState().openRightPanel(width)
        UserInterfaceBridge.rightPanelOpen = true
    },

    closeRightPanel: function () {
        if (UserInterfaceBridge.rightPanelOpen == null) return
        useUIStore.getState().closeRightPanel()
        UserInterfaceBridge.rightPanelOpen = null
    },

    minimalist: function (is) {
        if (is) {
            // In the old jQuery code, minimalist() set splitscreens CSS
            // to top:0/height:100% while keeping topSize=40. The splitscreens
            // container rendered behind the TopBar (which has higher z-index).
            // In React, topSize drives both TopBar layout and SplitScreens
            // offset, so we set topSize=0 and also toolHeightReserve=0 for
            // desktop so computeToolHeight('full') uses the full container
            // height (the TopBar overlaps via z-index, not via reserved space).
            const isMobile = useUIStore.getState().isMobile
            useUIStore.setState({
                topSize: 0,
                toolHeightReserve: isMobile ? useUIStore.getState().mobileTopSize : 0,
            })
            const logo = document.getElementById('mmgislogo')
            if (logo) logo.style.display = 'inherit'

            // Mobile-specific minimalist adjustments
            if (isMobile) {
                const toolbar = document.getElementById('toolbar')
                if (toolbar) {
                    toolbar.style.bottom = '0px'
                    toolbar.style.height = useUIStore.getState().mobileTopSize + 'px'
                    toolbar.style.paddingTop = '0px'
                }
            }
        }
    },

    fullHide: function (is) {
        // Toggle visibility of key elements
        const display = is ? 'none' : ''
        const els = {
            topBar: is ? 'none' : 'flex',
            mapSplit: is ? 'none' : 'flex',
            globeSplit: is ? 'none' : 'flex',
            toolbar: is ? 'none' : 'inherit',
            toolsWrapper: is ? 'none' : 'inherit',
        }
        Object.entries(els).forEach(([id, d]) => {
            const el = document.getElementById(id)
            if (el) el.style.display = d
        })
        document.querySelectorAll('.mouseLngLat').forEach((el) => {
            el.style.display = is ? 'none' : 'flex'
        })
    },

    fina: function (l_, viewer_, map_, globe_) {
        const ToolController_ =
            require('../ToolController_/ToolController_').default
        ToolController_.init(l_.tools)
        ToolController_.fina(this)
        Viewer_ = viewer_
        Map_ = map_
        this.Map_ = map_
        Globe_ = globe_
        this.hasViewer = l_.hasViewer
        this.hasGlobe = l_.hasGlobe

        useUIStore.getState().setRefs(l_, viewer_, map_, globe_)
        useUIStore.getState().setHasViewer(l_.hasViewer)
        useUIStore.getState().setHasGlobe(l_.hasGlobe)

        const topBarTitleName = document.getElementById('topBarTitleName')
        if (topBarTitleName) {
            topBarTitleName.addEventListener('click', l_.home)
        }

        // Apply configured default panel widths
        if (l_.configData.panels && l_.configData.panels.defaultWidths) {
            const dw = l_.configData.panels.defaultWidths
            const viewer = dw.viewer != null ? dw.viewer : 0
            const map = dw.map != null ? dw.map : 100
            const globe = dw.globe != null ? dw.globe : 0
            if (viewer + map + globe === 100) {
                this.setPanelPercents(viewer, map, globe)
            }
        }

        // Deeplinks override config defaults
        if (l_.FUTURES.panelPercents != null)
            this.setPanelPercents(
                l_.FUTURES.panelPercents[0],
                l_.FUTURES.panelPercents[1],
                l_.FUTURES.panelPercents[2]
            )

        // minimalist() removed — splitscreens, toolbar, and toolPanel now use
        // their default positioning (below topBar, beside toolbar) so they
        // never underlap. Matches PR #47.

        if (l_.configData.look) {
            if (
                l_.configData.look.pagename == null ||
                l_.configData.look.pagename === ''
            ) {
                if (topBarTitleName)
                    topBarTitleName.style.display = 'none'
            } else {
                if (topBarTitleName)
                    topBarTitleName.textContent = l_.configData.look.pagename
            }
        }

        // Theme is already applied by Stylize.js (which also applies
        // individual color overrides on top). Don't re-apply here or
        // the individual overrides would be clobbered.

        // Set UI reference so BottomBar utility methods can access it.
        // DOM construction is now handled by BottomBarReact.jsx.
        if (!BottomBar.UI_) {
            BottomBar.setUI(this)
        }

        // Visibility toggles from config
        const look = l_.configData.look || {}

        // Store look config in Zustand so React components (TopBar, BottomBarReact)
        // can conditionally render based on mission configuration.
        useUIStore.getState().setLookConfig(look)

        // copylink visibility (BottomBarReact reads from lookConfig)
        // screenshot, fullscreen, settings visibility (TopBar reads from lookConfig)

        if (look.topbar === false)
            BottomBar.changeUIVisibility('topbar', false)
        if (look.toolbar === false)
            BottomBar.changeUIVisibility('toolbars', false)
        if (look.scalebar === false)
            BottomBar.changeUIVisibility('scalebar', false)
        if (look.coordinates === false)
            BottomBar.changeUIVisibility('coordinates', false)
        if (look.miscellaneous === false)
            BottomBar.changeUIVisibility('miscellaneous', false)
        if (look.searchbar === false)
            BottomBar.changeUIVisibility('searchbar', false)

        // Mobile-specific fina behavior
        if (this.isMobile) {
            const mobileTools = ['Layers', 'Legend', 'Info', 'Analysis']

            // Keep mapToolBar and compass in default desktop position (bottom-left)

            // Remove the cursor info
            const cursorInfo = document.getElementById('cursorInfo')
            if (cursorInfo) cursorInfo.remove()

            // Mobile tool filtering is now handled by Toolbar.jsx which
            // reads isMobile from the store and only renders mobileTools.
            // Store the mobile tools list so Toolbar can filter.
            useUIStore.setState({ mobileTools: mobileTools })

            // Remove the coordinates div (redrawn as a tool on mobile)
            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) coordsDiv.remove()
            // #timeUI is staged in a hidden container by TimeUI.init() on mobile;
            // MobileTimeUIToggle handles moving it into #tools when toggled.

            // Zoom in if needed
            if (l_.configData.msv && 'mapZoomMobileInit' in l_.configData.msv) {
                const zoom = l_.configData.msv.mapZoomMobileInit || map_.map.getZoom()
                map_.map.setZoom(zoom)
            }
        }

        BottomBar.fina()
        this.show()

        // Auto-open default tool if configured
        // Deferred to allow React toolbar to render first
        if (l_.configData.look && l_.configData.look.defaultToolEnabled) {
            if (l_.configData.look.defaultTool && l_.configData.look.defaultTool !== 'None') {
                requestAnimationFrame(() => {
                    const defaultToolBtn = document.getElementById(`toolButton${l_.configData.look.defaultTool}`)
                    if (defaultToolBtn) {
                        defaultToolBtn.click()
                    }
                })
            }
        }
    },

    updateLayerUpdateButton: function (type) {
        useUIStore.getState().setStatusIndicator(type)
    },

    removeLayerUpdateButton: function () {
        useUIStore.getState().setStatusIndicator(null)
    },
}

export default UserInterfaceBridge
