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

const useUIStore = create((set, get) => ({
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

    // Container dimensions
    mainWidth: 0,
    mainHeight: 0,

    // Panel availability
    hasViewer: true,
    hasMap: true,
    hasGlobe: true,

    // Tool panel
    toolPanelWidth: 0,

    // Tool width (bottom tools area width, set by ToolController/tools)
    toolsWrapperCSSWidth: '0%',

    // UI state
    helpOn: true,
    isMobile: false,
    mobileTopSize: 50,

    // TimeUI state (synced from DOM via MutationObserver)
    timeUIActive: false,
    timeUIExpanded: false,

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

    setVisibility: (key, value) =>
        set((state) => ({
            visibility: { ...state.visibility, [key]: value },
        })),

    setIsMobile: (val) => set({ isMobile: val }),

    setTimeUIActive: (val) => set({ timeUIActive: val }),
    setTimeUIExpanded: (val) => set({ timeUIExpanded: val }),

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

        // Trigger resize for imperative map/globe/viewer
        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()

        // Sync Globe to Map on first open
        if (wasGlobeClosed && isGlobeOpening && current._Globe) {
            if (!current._Globe.hasBeenOpened) {
                current._Globe.hasBeenOpened = true
                if (current._L && current._L.FUTURES.globeView == null) {
                    setTimeout(() => {
                        current._Globe.syncToMapCenter()
                    }, 100)
                }
            }
        }
    },

    setToolHeight: (pxHeight, shouldntAnimate) => {
        set({ pxIsTools: computeToolHeight(get(), pxHeight) })
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
        if (newWidth === 'full') {
            cssWidth = `calc(100vw - ${TOOLBAR_WIDTH}px)`
        } else {
            cssWidth = newWidth + 'px'
        }
        set({ toolsWrapperCSSWidth: cssWidth })
    },

    // Splitter drag math: map splitter
    computeMapSplitMove: (clientX) => {
        const result = computeMapSplitMoveResult(get(), clientX)
        set(result)

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Splitter drag math: globe splitter
    computeGlobeSplitMove: (clientX) => {
        const result = computeGlobeSplitMoveResult(get(), clientX)
        set(result)

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Splitter drag math: tools splitter
    computeToolsSplitMove: (clientY) => {
        set({ pxIsTools: computeToolsSplitMoveResult(get(), clientY) })

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Window resize handler
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

        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },
}))

export default useUIStore
