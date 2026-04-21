import useUIStore from './store/uiStore'
import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

var Viewer_ = null
var Map_ = null
var Globe_ = null

// Centralized function that repositions all non-React bottom elements
// based on pxIsTools and TimeUI state. Called by a store subscription
// whenever any of these values change, ensuring consistent positioning
// regardless of what triggered the change (tool open, TimeUI toggle,
// TimeUI expand, etc.).
// Uses the _updateBottomUIHeight math (177px for expanded) as the
// authoritative source, rather than the jQuery setToolHeight (145px).
function _repositionBottomElements() {
    const state = useUIStore.getState()
    const { pxIsTools, isMobile, timeUIActive, timeUIExpanded } = state

    if (isMobile) {
        // Mobile: reposition toolbar, coordinates, timeUI above tools
        // (matches jQuery UserInterfaceMobile_.js:908-916)
        const coordsDiv = document.getElementById('CoordinatesDiv')
        if (coordsDiv) {
            coordsDiv.style.transition = 'bottom 0.4s ease-out'
            coordsDiv.style.bottom = pxIsTools + 'px'
        }
        const timeUIEl = document.getElementById('timeUI')
        if (timeUIEl) {
            timeUIEl.style.transition = 'bottom 0.4s ease-out'
            timeUIEl.style.bottom = pxIsTools + 'px'
        }
        const toolbar = document.getElementById('toolbar')
        if (toolbar) {
            toolbar.style.bottom = pxIsTools + 'px'
        }

        // Resize the map to fit the remaining screen space
        // (matches jQuery UserInterfaceMobile_.js:967-978)
        const mainHeight = state.mainHeight
        const mapScreen = document.getElementById('mapScreen')
        if (mapScreen) {
            mapScreen.style.transition = 'height 0.4s ease-out'
            mapScreen.style.height = (mainHeight - pxIsTools) + 'px'
        }
        const mapSplit = document.getElementById('mapSplit')
        if (mapSplit) {
            mapSplit.style.transition = 'height 0.4s ease-out'
            mapSplit.style.height = (mainHeight - pxIsTools) + 'px'
        }
        // Invalidate map size so Leaflet recalculates its viewport
        const invalidateSizes = () => {
            if (Map_ != null && Map_.map) Map_.map.invalidateSize()
            if (Viewer_ != null && Viewer_.invalidateSize) Viewer_.invalidateSize()
            if (Globe_ != null && Globe_.litho) Globe_.litho.invalidateSize()
        }
        invalidateSizes()
        setTimeout(invalidateSizes, 420)
    } else {
        // Desktop: use _updateBottomUIHeight math (177px for expanded)
        // as the single authoritative positioning source.
        // timeUIHeight: full height of TimeUI when active
        //   - expanded (via chevron or defaultExpanded): 177px
        //   - not expanded: 40px
        //   - inactive: 0px
        const timeUIHeight = timeUIActive
            ? (timeUIExpanded ? 177 : 40)
            : 0
        // newBottom: what bottom-positioned elements should use
        // When TimeUI is active, this is timeUIHeight.
        // When inactive, elements sit at 0 (above tools area only).
        const newBottom = timeUIActive ? timeUIHeight : 0

        const mapToolBar = document.getElementById('mapToolBar')
        if (mapToolBar) {
            mapToolBar.style.bottom = (pxIsTools + newBottom) + 'px'
        }

        // Scalebar and attributions sit just above the tools area,
        // not above the full TimeUI (matches _updateBottomUIHeight
        // which sets attributions bottom to just pxIsTools)
        const attributions = document.getElementById('mmgis-attributions')
        if (attributions) {
            attributions.style.bottom = pxIsTools + 'px'
        }

        const scaleFactor = document.querySelector('.leaflet-control-scalefactor')
        if (scaleFactor) {
            scaleFactor.style.bottom = (pxIsTools + 28) + 'px'
        }

        const compass = document.getElementById('mmgis-map-compass')
        if (compass) {
            if (!attributions || attributions.textContent.trim().length === 0) {
                compass.style.bottom = (pxIsTools + 38) + 'px'
            } else {
                compass.style.bottom = (pxIsTools + 58) + 'px'
            }
        }

        const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right')
        if (leafletBottomRight) {
            leafletBottomRight.style.bottom = (pxIsTools + newBottom) + 'px'
        }

        const coordsDiv = document.getElementById('CoordinatesDiv')
        if (coordsDiv) {
            coordsDiv.style.bottom = (pxIsTools + newBottom) + 'px'
        }

        const timeUIEl = document.getElementById('timeUI')
        if (timeUIEl) {
            timeUIEl.style.bottom = pxIsTools + 'px'
        }
    }
}

// Subscribe to store changes: reposition whenever pxIsTools or TimeUI state changes
let _prevPxIsTools = 0
let _prevTimeUIActive = false
let _prevTimeUIExpanded = false
let _prevIsMobile = false
useUIStore.subscribe((state) => {
    if (
        state.pxIsTools !== _prevPxIsTools ||
        state.timeUIActive !== _prevTimeUIActive ||
        state.timeUIExpanded !== _prevTimeUIExpanded ||
        state.isMobile !== _prevIsMobile
    ) {
        _prevPxIsTools = state.pxIsTools
        _prevTimeUIActive = state.timeUIActive
        _prevTimeUIExpanded = state.timeUIExpanded
        _prevIsMobile = state.isMobile
        _repositionBottomElements()
    }
})

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
            useUIStore.setState({ topSize: 0 })
            const logo = document.getElementById('mmgislogo')
            if (logo) logo.style.display = 'inherit'

            // Mobile-specific minimalist adjustments
            if (useUIStore.getState().isMobile) {
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

        // Ensure BottomBar is initialized before calling changeUIVisibility.
        // Due to React effect timing, the async bridge import in UserInterfaceLayout
        // may not have resolved yet, so BottomBarReact's useEffect hasn't called
        // BottomBar.init(). We call it here imperatively to guarantee init→fina order.
        if (!BottomBar.UI_) {
            BottomBar.init('barBottom', this)
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

            // Remove toolbar buttons that aren't mobile features
            if (ToolController_.tools) {
                ToolController_.tools
                    .map((i) => i.name)
                    .forEach((tool) => {
                        if (!mobileTools.includes(tool)) {
                            const btn = document.getElementById('toolButton' + tool)
                            if (btn) btn.remove()
                        }
                    })
            }

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
