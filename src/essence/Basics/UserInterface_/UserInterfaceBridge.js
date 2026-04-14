import useUIStore from './store/uiStore'
import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

var Viewer_ = null
var Map_ = null
var Globe_ = null

const UserInterfaceBridge = {
    isMobile: false,

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
        useUIStore.getState().openToolPanel(width)
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
        useUIStore.getState().openToolPanel(width)
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
        useUIStore.getState().closeToolPanel()
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
    },

    setToolWidth: function (newWidth, alignment) {
        const TOOLBAR_WIDTH = 40
        useUIStore.getState().setToolWidth(newWidth)

        // Also update TopBar margin/width to match jQuery behavior
        let newTopWidth = TOOLBAR_WIDTH
        if (newWidth !== 'full') {
            newTopWidth = TOOLBAR_WIDTH + newWidth
        }
        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.marginLeft = newTopWidth + 'px'
            topBar.style.width = `calc(100% - ${newTopWidth}px)`
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
        const coordsDiv = document.getElementById('CoordinatesDiv')
        if (coordsDiv) coordsDiv.style.right = width + 'px'
        const mainContainer = document.getElementById('main-container')
        if (mainContainer) mainContainer.style.width = `calc(100% - ${width}px)`

        const el = document.getElementById('splitscreens')
        if (el) {
            useUIStore.setState({ mainWidth: el.offsetWidth })
            const pp = useUIStore.getState().getPanelPercents()
            useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
        }
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
        const mainContainer = document.getElementById('main-container')
        if (mainContainer) mainContainer.style.width = '100%'

        const el = document.getElementById('splitscreens')
        if (el) {
            useUIStore.setState({ mainWidth: el.offsetWidth })
            const pp = useUIStore.getState().getPanelPercents()
            useUIStore.getState().setPanelPercents(pp.viewer, pp.map, pp.globe)
        }
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
