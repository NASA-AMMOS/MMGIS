import useUIStore from './store/uiStore'
import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

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
        // Mobile uses topSize 50 (desktop uses 40)
        if (val) {
            useUIStore.setState({ topSize: 50, mobileTopSize: 50, toolHeightReserve: 50 })
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
        // In React mode, layout is rendered by React components.
        // This is a no-op - React handles mounting via UserInterfaceLayout.
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
        // Clamp width to [minToolWidth, half viewport] matching deleted
        // UserInterfaceDefault_.js:760-765 bounds checking
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
        const coordsDiv = document.getElementById('CoordinatesDiv')
        if (coordsDiv) coordsDiv.style.right = width + 'px'
        useUIStore.getState().setRightPanelWidth(width)
        // Splitscreens dimensions are recaptured by ResizeObserver
        const rightPanel = document.getElementById('uiRightPanel')
        if (rightPanel) {
            rightPanel.style.display = 'inherit'
            rightPanel.style.width = width + 'px'
        }
        UserInterfaceBridge.rightPanelOpen = true
    },

    closeRightPanel: function () {
        if (UserInterfaceBridge.rightPanelOpen == null) return
        const coordsDiv = document.getElementById('CoordinatesDiv')
        if (coordsDiv) coordsDiv.style.right = '0px'
        useUIStore.getState().setRightPanelWidth(0)
        // Splitscreens dimensions are recaptured by ResizeObserver
        const rightPanel = document.getElementById('uiRightPanel')
        if (rightPanel) {
            rightPanel.style.display = 'none'
            rightPanel.style.width = '0'
        }
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

        this.minimalist(true)

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

        // Set UI reference so BottomBar utility methods can access it.
        // DOM construction is now handled by BottomBarReact.jsx.
        if (!BottomBar.UI_) {
            BottomBar.setUI(this)
        }

        // Visibility toggles from config
        const look = l_.configData.look || {}
        if (look.copylink != null) {
            const el = document.getElementById('topBarLink')
            if (el) el.style.display = look.copylink ? 'inherit' : 'none'
        }
        if (look.screenshot != null) {
            const el = document.getElementById('topBarScreenshot')
            if (el) el.style.display = look.screenshot ? 'inherit' : 'none'
        }
        if (look.fullscreen != null) {
            const el = document.getElementById('topBarFullscreen')
            if (el) el.style.display = look.fullscreen ? 'inherit' : 'none'
        }
        if (look.settings != null) {
            const el = document.getElementById('bottomBarSettings')
            if (el) el.style.display = look.settings ? 'inherit' : 'none'
        }

        if (look.info != null && look.infourl != null && look.infourl !== '') {
            const el = document.getElementById('topBarInfo')
            if (el) el.style.display = look.info ? 'inherit' : 'none'
        } else {
            const el = document.getElementById('topBarInfo')
            if (el) el.style.display = 'none'
        }

        if (look.help != null && look.helpurl != null && look.helpurl !== '') {
            const el = document.getElementById('topBarHelp')
            if (el) el.style.display = look.help ? 'inherit' : 'none'
        } else {
            const el = document.getElementById('topBarHelp')
            if (el) el.style.display = 'none'
        }

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

        // Mobile-specific fina behavior
        if (this.isMobile) {
            const mobileTools = ['Layers', 'Legend', 'Info']

            // Position mapToolBar at top under topbar (contains scalebar)
            const mapToolBar = document.getElementById('mapToolBar')
            if (mapToolBar) {
                mapToolBar.style.top = '48px'
                mapToolBar.style.bottom = 'auto'
            }
            // Position compass at bottom
            const compass = document.getElementById('mmgis-map-compass')
            if (compass) compass.style.bottom = '60px'

            // Remove the cursor info
            const cursorInfo = document.getElementById('cursorInfo')
            if (cursorInfo) cursorInfo.remove()

            // Mobile tool filtering is now handled by Toolbar.jsx which
            // reads isMobile from the store and only renders mobileTools.
            // Store the mobile tools list so Toolbar can filter.
            useUIStore.setState({ mobileTools: mobileTools })

            // Remove the coordinates div and timeUI (redrawn as tools on mobile)
            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) coordsDiv.remove()
            const timeUI = document.getElementById('timeUI')
            if (timeUI) timeUI.remove()

            // Zoom in if needed
            if (l_.configData.msv && 'mapZoomMobileInit' in l_.configData.msv) {
                const zoom = l_.configData.msv.mapZoomMobileInit || map_.map.getZoom()
                map_.map.setZoom(zoom)
            }
        }

        BottomBar.fina()
        this.show()

        // Auto-open default tool if configured
        // (matches UserInterfaceDefault_.js:1251-1258)
        if (l_.configData.look && l_.configData.look.defaultToolEnabled) {
            if (l_.configData.look.defaultTool && l_.configData.look.defaultTool !== 'None') {
                const defaultToolBtn = document.getElementById(`toolButton${l_.configData.look.defaultTool}`)
                if (defaultToolBtn) {
                    defaultToolBtn.click()
                }
            }
        }
    },

    updateLayerUpdateButton: function (type) {
        if (UserInterfaceBridge.layerUpdatedControl) {
            UserInterfaceBridge.removeLayerUpdateButton()
        }
        if (Map_) {
            UserInterfaceBridge.layerUpdatedControl = new LayerUpdatedControl({
                position: 'topright',
                type,
            })
            UserInterfaceBridge.layerUpdatedControl.addTo(Map_.map)
        }
    },

    removeLayerUpdateButton: function () {
        if (UserInterfaceBridge.layerUpdatedControl && Map_) {
            UserInterfaceBridge.layerUpdatedControl.remove(Map_.map)
            UserInterfaceBridge.layerUpdatedControl = null
        }
    },
}

export default UserInterfaceBridge
