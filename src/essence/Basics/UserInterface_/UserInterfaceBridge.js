import useUIStore from './store/uiStore'
import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

var Viewer_ = null
var Map_ = null
var Globe_ = null

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

    // jQuery element references (null in React mode - components manage their own DOM)
    topBar: null,
    topBarRight: null,
    splitscreens: null,
    vmgScreen: null,
    viewerScreen: null,
    viewerToolBar: null,
    viewerSplit: null,
    mapScreen: null,
    mapToolBar: null,
    mapTopBar: null,
    mapSplit: null,
    mapSplitInner: null,
    globeScreen: null,
    globeToolBar: null,
    globeSplit: null,
    globeSplitInner: null,
    tScreen: null,
    toolsScreen: null,
    toolsSplit: null,
    toolbar: null,
    toolPanel: null,
    toolPanelDrag: null,
    barBottom: null,
    toolbarLogo: null,
    dataLoadingSpinner: null,
    rightPanel: null,
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
        const el = document.getElementById('splitscreens')
        if (el) {
            useUIStore.getState().handleWindowResize(
                el.offsetWidth,
                el.offsetHeight
            )
        }
    },

    openToolPanel: function (width) {
        const isMobile = useUIStore.getState().isMobile
        const panelEl = document.getElementById('toolPanel')
        if (panelEl) panelEl.innerHTML = ''
        useUIStore.getState().openToolPanel(width)

        // Update TopBar offset (mobile uses topSize for left offset, desktop uses 40)
        const leftOffset = isMobile ? useUIStore.getState().mobileTopSize : 40
        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.paddingLeft = '0px'
            topBar.style.marginLeft = (width + leftOffset) + 'px'
            topBar.style.width = `calc(100% - ${width + leftOffset}px)`
        }

        // Also update splitscreens dimensions after tool panel opens
        setTimeout(() => {
            const el = document.getElementById('splitscreens')
            if (el) {
                useUIStore.setState({
                    mainWidth: el.offsetWidth,
                    mainHeight: el.offsetHeight,
                })
                const pp = useUIStore.getState().getPanelPercents()
                useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
            }
        }, 250)
    },

    resizeToolPanel: function (width) {
        const isMobile = useUIStore.getState().isMobile
        const leftOffset = isMobile ? useUIStore.getState().mobileTopSize : 40
        useUIStore.getState().openToolPanel(width)

        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.paddingLeft = '0px'
            topBar.style.marginLeft = (width + leftOffset) + 'px'
            topBar.style.width = `calc(100% - ${width + leftOffset}px)`
        }

        setTimeout(() => {
            const el = document.getElementById('splitscreens')
            if (el) {
                useUIStore.setState({
                    mainWidth: el.offsetWidth,
                    mainHeight: el.offsetHeight,
                })
                const pp = useUIStore.getState().getPanelPercents()
                useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
            }
        }, 250)
    },

    closeToolPanel: function () {
        const panelEl = document.getElementById('toolPanel')
        if (panelEl) panelEl.innerHTML = ''
        useUIStore.getState().closeToolPanel()
        // Reset TopBar to full width (matches jQuery closeToolPanel behavior)
        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.paddingLeft = useUIStore.getState().isMobile ? '80px' : '40px'
            topBar.style.marginLeft = '0px'
            topBar.style.width = '100%'
        }
        // In mobile, reset toolbar box-shadow
        if (useUIStore.getState().isMobile) {
            const toolbar = document.getElementById('toolbar')
            if (toolbar) toolbar.style.boxShadow = 'none'
        }
        setTimeout(() => {
            const el = document.getElementById('splitscreens')
            if (el) {
                useUIStore.setState({
                    mainWidth: el.offsetWidth,
                    mainHeight: el.offsetHeight,
                })
                const pp = useUIStore.getState().getPanelPercents()
                useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
            }
        }, 250)
    },

    setToolHeight: function (pxHeight, shouldntAnimate) {
        useUIStore.getState().setToolHeight(pxHeight, shouldntAnimate)

        const pxIsTools = useUIStore.getState().pxIsTools
        const isMobile = useUIStore.getState().isMobile

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
            const mainHeight = useUIStore.getState().mainHeight
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
            // (important for pan-to-feature centering)
            // Call immediately for responsiveness, then again after the
            // 400ms CSS transition completes for final accuracy
            const invalidateSizes = () => {
                if (Map_ != null && Map_.map) {
                    Map_.map.invalidateSize()
                }
                if (Viewer_ != null && Viewer_.invalidateSize) {
                    Viewer_.invalidateSize()
                }
                if (Globe_ != null && Globe_.litho) {
                    Globe_.litho.invalidateSize()
                }
            }
            invalidateSizes()
            setTimeout(invalidateSizes, 420)
        } else {
            // Desktop: reposition non-React DOM elements that sit above the tools area
            // (matches jQuery UserInterfaceDefault_.js:876-933)
            let timeUIActive = false
            let timeUIExpanded = false
            const timeUIEl = document.getElementById('timeUI')
            if (timeUIEl) {
                timeUIActive = timeUIEl.classList.contains('active')
                timeUIExpanded = timeUIEl.classList.contains('expanded')
            }
            const timeUIHeight = timeUIActive ? (timeUIExpanded ? 145 : 40) : 0

            const mapToolBar = document.getElementById('mapToolBar')
            if (mapToolBar) {
                mapToolBar.style.bottom = (pxIsTools + timeUIHeight) + 'px'
            }

            const scaleFactor = document.querySelector('.leaflet-control-scalefactor')
            if (scaleFactor) {
                scaleFactor.style.bottom = (pxIsTools + 28 + (timeUIActive ? timeUIHeight - 40 : 0)) + 'px'
            }

            const attributions = document.getElementById('mmgis-attributions')
            if (attributions) {
                attributions.style.bottom = (pxIsTools + (timeUIActive ? timeUIHeight - 40 : 0)) + 'px'
            }

            const compass = document.getElementById('mmgis-map-compass')
            if (compass) {
                if (!attributions || attributions.textContent.trim().length === 0) {
                    compass.style.bottom = (pxIsTools + 38 + (timeUIActive ? timeUIHeight - 40 : 0)) + 'px'
                } else {
                    compass.style.bottom = (pxIsTools + 58 + (timeUIActive ? timeUIHeight - 40 : 0)) + 'px'
                }
            }

            const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right')
            if (leafletBottomRight) {
                leafletBottomRight.style.bottom = (pxIsTools + timeUIHeight) + 'px'
            }

            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) {
                coordsDiv.style.bottom = (pxIsTools + timeUIHeight) + 'px'
            }

            if (timeUIEl) {
                timeUIEl.style.bottom = (pxIsTools + (timeUIActive ? 0 : timeUIExpanded ? -148 : -40)) + 'px'
            }
        }
    },

    setToolWidth: function (newWidth, alignment) {
        const isMobile = useUIStore.getState().isMobile
        useUIStore.getState().setToolWidth(newWidth)

        if (isMobile) {
            // Mobile: toolbar is at bottom, use its width for offset
            const toolbarEl = document.getElementById('toolbar')
            const toolbarWidth = toolbarEl ? toolbarEl.offsetWidth : 0
            let newTopWidth = toolbarWidth
            if (newWidth !== 'full') {
                newTopWidth = toolbarWidth + newWidth
            }
            const topBar = document.getElementById('topBar')
            if (topBar) {
                topBar.style.marginLeft = newTopWidth + 'px'
                topBar.style.width = `calc(100% - ${newTopWidth}px)`
            }
        } else {
            // Desktop: fixed 40px toolbar
            const TOOLBAR_WIDTH = 40
            let newTopWidth = TOOLBAR_WIDTH
            if (newWidth !== 'full') {
                newTopWidth = TOOLBAR_WIDTH + newWidth
            }
            const topBar = document.getElementById('topBar')
            if (topBar) {
                topBar.style.marginLeft = newTopWidth + 'px'
                topBar.style.width = `calc(100% - ${newTopWidth}px)`
            }
        }
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
        // Update store so React manages main-container width
        useUIStore.getState().setRightPanelWidth(width)

        setTimeout(() => {
            const el = document.getElementById('splitscreens')
            if (el) {
                useUIStore.setState({ mainWidth: el.offsetWidth })
                const pp = useUIStore.getState().getPanelPercents()
                useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
            }
        }, 0)
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
        // Update store so React manages main-container width
        useUIStore.getState().setRightPanelWidth(0)

        setTimeout(() => {
            const el = document.getElementById('splitscreens')
            if (el) {
                useUIStore.setState({ mainWidth: el.offsetWidth })
                const pp = useUIStore.getState().getPanelPercents()
                useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
            }
        }, 0)
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

        if (look.info != null && look.infourl !== '') {
            const el = document.getElementById('topBarInfo')
            if (el) el.style.display = look.info ? 'inherit' : 'none'
        } else {
            const el = document.getElementById('topBarInfo')
            if (el) el.style.display = 'none'
        }

        if (look.help != null && look.helpurl !== '') {
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
