import { create } from 'zustand'
import {
    computePanelPercents,
    computePanelPixelsFromPercents,
    computeToolHeight,
    computeMapSplitMoveResult,
    computeGlobeSplitMoveResult,
    computeToolsSplitMoveResult,
    computeWindowResize,
} from './uiStoreMath'
import { applyTheme } from '../../../../design-system/applyTheme'

const useUIStore = create((set, get) => ({
    // Theme
    themeName: 'Dark Default',
    setTheme: (name) => {
        set({ themeName: name })
        applyTheme(name)
    },

    // Layout dimensions
    splitterSize: 0,
    splitterSizeHidden: 17,
    topSize: 40,
    toolHeightReserve: 40,
    fullSizeViews: false,

    // Panel pixel sizes
    pxIsViewer: 0,
    pxIsMap: 0,
    pxIsGlobe: 0,
    pxIsTools: 0,
    pxIsToolsInit: 0,
    toolNativeHeight: 0,

    // Container dimensions
    mainWidth: 0,
    mainHeight: 0,

    // Panel availability
    hasViewer: true,
    hasMap: true,
    hasGlobe: true,

    // Tool panel
    toolPanelWidth: 0,
    toolPanelDragVisible: false,

    // Tool width (bottom tools area width, set by ToolController/tools)
    toolsWrapperCSSWidth: '0%',
    toolsWrapperRawWidth: 0, // numeric px width for TopBar offset calculation

    // UI state
    helpOn: true,
    toolbarVisible: true,
    isMobile: false,
    mobileTopSize: 50,

    // TimeUI state (synced from DOM via MutationObserver)
    timeUIActive: false,
    timeUIExpanded: false,

    // Drag state (disable CSS transitions during splitter drag)
    isDraggingSplitter: false,

    // Layout ready flag for essence.js integration
    layoutReady: false,

    // Visibility of main container (toggled by show/hide)
    visible: false,

    // Right panel width offset (for openRightPanel/closeRightPanel)
    rightPanelWidth: 0,

    // Visibility settings (for BottomBar changeUIVisibility)
    visibility: {
        topbar: true,
        toolbars: true,
        scalebar: true,
        coordinates: true,
        graticule: true,
        miscellaneous: true,
    },

    // Config look flags (set by UserInterfaceBridge.fina from mission config)
    lookConfig: {},
    setLookConfig: (config) => set({ lookConfig: config }),

    // ToolController toolbar state (synced from ToolController_.init)
    toolsList: [],          // Array of tool config objects { name, icon, js, separatedTool, variables, ... }
    activeToolName: null,   // Name of the currently active toolbar tool (e.g. 'LayersTool')
    toolsLoaded: false,     // True after ToolController_ has initialized all tool modules
    mobileTools: [],        // Array of tool names shown on mobile (e.g. ['Layers', 'Legend', 'Info'])

    // References to imperative modules (set during fina)
    _Viewer: null,
    _Map: null,
    _Globe: null,
    _L: null,

    // Actions
    setLayoutReady: (ready) => set({ layoutReady: ready }),
    setVisible: (val) => set({ visible: val }),
    setRightPanelWidth: (val) => set({ rightPanelWidth: val }),

    setRefs: (L_, Viewer_, Map_, Globe_) =>
        set({ _L: L_, _Viewer: Viewer_, _Map: Map_, _Globe: Globe_ }),

    setHasViewer: (val) => set({ hasViewer: val }),
    setHasGlobe: (val) => set({ hasGlobe: val }),

    setMainDimensions: (width, height) =>
        set({ mainWidth: width, mainHeight: height }),

    setPxIsTools: (val) => set({ pxIsTools: val }),

    setToolPanelWidth: (width) => set({ toolPanelWidth: width }),
    setToolPanelDragVisible: (val) => set({ toolPanelDragVisible: val }),

    setVisibility: (key, value) =>
        set((state) => ({
            visibility: { ...state.visibility, [key]: value },
        })),

    setIsMobile: (val) => set({ isMobile: val }),
    setToolbarVisible: (val) => set({ toolbarVisible: val }),

    setTimeUIActive: (val) => set({ timeUIActive: val }),
    setTimeUIExpanded: (val) => set({ timeUIExpanded: val }),

    setToolsList: (tools) => set({ toolsList: tools }),
    setActiveToolName: (name) => set({ activeToolName: name }),
    setToolsLoaded: (val) => set({ toolsLoaded: val }),

    setTopSize: (val) => set({ topSize: val }),

    setPanelPixels: (viewer, map, globe) =>
        set({ pxIsViewer: viewer, pxIsMap: map, pxIsGlobe: globe }),

    getPanelPercents: () => {
        return computePanelPercents(get())
    },

    setPanelPercents: (viewerPercent, mapPercent, globePercent) => {
        const state = get()
        const result = computePanelPixelsFromPercents(state, viewerPercent, mapPercent, globePercent)
        if (!result) return

        const wasGlobeClosed = state.pxIsGlobe === 0
        const isGlobeOpening = parseFloat(globePercent) > 0

        set({ pxIsViewer: result.pxIsViewer, pxIsMap: result.pxIsMap, pxIsGlobe: result.pxIsGlobe })

        // invalidateSize is handled automatically by ResizeObservers on each
        // panel component (MapPanel, ViewerPanel, GlobePanel). The observers
        // fire after layout but before paint, eliminating the visible "jerk"
        // that the previous setTimeout(0) approach caused.

        // Sync Globe to Map on first open
        if (wasGlobeClosed && isGlobeOpening) {
            setTimeout(() => {
                const current = get()
                if (current._Globe && !current._Globe.hasBeenOpened) {
                    current._Globe.hasBeenOpened = true
                    if (current._L && current._L.FUTURES.globeView == null) {
                        setTimeout(() => {
                            current._Globe.syncToMapCenter()
                        }, 100)
                    }
                }
            }, 0)
        }
    },

    setToolHeight: (pxHeight, shouldntAnimate) => {
        const h = computeToolHeight(get(), pxHeight)
        const nativeH = typeof pxHeight === 'number' ? pxHeight : h
        set({ pxIsTools: h, toolNativeHeight: nativeH })
    },

    openToolPanel: (width) => {
        set({ toolPanelWidth: width })
    },

    closeToolPanel: () => {
        set({ toolPanelWidth: 0 })
    },

    setToolWidth: (newWidth) => {
        const isMobile = get().isMobile
        // Mobile: toolbar is at bottom, no left sidebar offset; Desktop: 40px
        const TOOLBAR_WIDTH = isMobile ? 0 : 40
        let cssWidth
        let rawWidth
        if (newWidth === 'full') {
            cssWidth = `calc(100vw - ${TOOLBAR_WIDTH}px)`
            rawWidth = 'full'
        } else {
            cssWidth = newWidth + 'px'
            rawWidth = newWidth
        }
        set({ toolsWrapperCSSWidth: cssWidth, toolsWrapperRawWidth: rawWidth })
    },

    // Splitter drag math: map splitter
    // invalidateSize handled by ResizeObservers on panel components
    computeMapSplitMove: (clientX) => {
        set(computeMapSplitMoveResult(get(), clientX))
    },

    // Splitter drag math: globe splitter
    computeGlobeSplitMove: (clientX) => {
        set(computeGlobeSplitMoveResult(get(), clientX))
    },

    // Splitter drag math: tools splitter
    computeToolsSplitMove: (clientY) => {
        set({ pxIsTools: computeToolsSplitMoveResult(get(), clientY) })
    },

    // Window resize handler
    // invalidateSize handled by ResizeObservers on panel components
    handleWindowResize: (newWidth, newHeight) => {
        const panels = computeWindowResize(get(), newWidth, newHeight)

        set({
            mainWidth: newWidth,
            mainHeight: newHeight,
            ...panels,
        })

        // Don't let tools exceed max
        const current = get()
        const reserve = current.toolHeightReserve != null ? current.toolHeightReserve : current.topSize
        if (
            current.pxIsTools >
            newHeight - current.splitterSize - reserve
        ) {
            current.setToolHeight('full', true)
        }
    },
}))

export default useUIStore
