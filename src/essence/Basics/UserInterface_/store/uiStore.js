import create from 'zustand'

const useUIStore = create((set, get) => ({
    // Layout dimensions
    splitterSize: 0,
    splitterSizeHidden: 17,
    topSize: 40,
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

    // UI state
    helpOn: true,
    isMobile: false,

    // Layout ready flag for essence.js integration
    layoutReady: false,

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

    setTopSize: (val) => set({ topSize: val }),

    setPanelPixels: (viewer, map, globe) =>
        set({ pxIsViewer: viewer, pxIsMap: map, pxIsGlobe: globe }),

    getPanelPercents: () => {
        const state = get()
        if (state.mainWidth === 0) return { viewer: 0, map: 100, globe: 0 }
        const adjustedPxIsViewer =
            state.pxIsViewer + state.splitterSize / 2
        const vp = (adjustedPxIsViewer / state.mainWidth) * 100
        const gp = (state.pxIsGlobe / state.mainWidth) * 100
        const mp = 100 - vp - gp
        return { viewer: vp, map: mp, globe: gp }
    },

    setPanelPercents: (viewerPercent, mapPercent, globePercent) => {
        const state = get()
        viewerPercent = parseFloat(viewerPercent)
        mapPercent = parseFloat(mapPercent)
        globePercent = parseFloat(globePercent)

        if (!state.hasViewer && viewerPercent !== 0) return
        if (!state.hasGlobe && globePercent !== 0) return
        if (viewerPercent + mapPercent + globePercent !== 100) return

        const wasGlobeClosed = state.pxIsGlobe === 0
        const isGlobeOpening = globePercent > 0

        const pxIsViewer =
            state.mainWidth * (viewerPercent / 100) - state.splitterSize / 2
        const pxIsGlobe = state.mainWidth * (globePercent / 100)
        const pxIsMap = state.mainWidth - pxIsViewer - pxIsGlobe

        set({ pxIsViewer, pxIsMap, pxIsGlobe })

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
        const state = get()
        let newPxIsTools

        if (pxHeight === 'full') {
            newPxIsTools =
                state.mainHeight - state.splitterSize - state.topSize
        } else if (pxHeight === 'threefourths') {
            newPxIsTools = parseInt(
                0.75 * (state.mainHeight - state.splitterSize - state.topSize)
            )
        } else if (pxHeight === 'half') {
            newPxIsTools = parseInt(
                0.5 * (state.mainHeight - state.splitterSize - state.topSize)
            )
        } else {
            newPxIsTools = pxHeight
        }

        if (newPxIsTools < state.splitterSize / 4) {
            newPxIsTools = state.splitterSize / 4
        }
        if (newPxIsTools > state.mainHeight - state.splitterSize) {
            newPxIsTools = state.mainHeight - state.splitterSize
        }
        if (pxHeight === 0) {
            newPxIsTools = 0
        }

        set({ pxIsTools: newPxIsTools })
    },

    openToolPanel: (width) => {
        set({ toolPanelWidth: width })
    },

    closeToolPanel: () => {
        set({ toolPanelWidth: 0 })
    },

    // Splitter drag math: map splitter
    computeMapSplitMove: (clientX) => {
        const state = get()
        let x = clientX - state.splitterSize - 40 - state.toolPanelWidth

        if (x >= state.mainWidth - 5) x = state.mainWidth
        else if (x <= 5) x = 0

        let pxIsViewer = x - state.splitterSize / 2
        let pxIsMap =
            state.mainWidth - x + state.splitterSize / 2 - state.pxIsGlobe
        let pxIsGlobe =
            state.mainWidth - pxIsViewer - pxIsMap

        if (pxIsViewer < 0) {
            pxIsViewer = 0
            pxIsMap = state.mainWidth - state.pxIsGlobe
        }
        if (pxIsViewer > state.mainWidth - state.splitterSize * 2) {
            pxIsViewer = state.mainWidth - state.splitterSize * 2
        }
        if (pxIsGlobe <= 0) pxIsGlobe = 0
        if (pxIsMap < state.splitterSize * 2) {
            pxIsMap = state.splitterSize * 2
            pxIsGlobe = state.mainWidth - pxIsViewer - pxIsMap
        }
        if (pxIsMap > state.mainWidth) pxIsMap = state.mainWidth

        set({ pxIsViewer, pxIsMap, pxIsGlobe })

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Splitter drag math: globe splitter
    computeGlobeSplitMove: (clientX) => {
        const state = get()
        let x = clientX - 40 - state.toolPanelWidth

        if (state.hasViewer !== false) {
            x -= state.splitterSize
        }

        if (x >= state.mainWidth - 5) x = state.mainWidth
        else if (x <= 5) x = 0

        let pxIsGlobe =
            state.mainWidth - x - state.splitterSize / 2
        let pxIsMap =
            x - state.pxIsViewer + state.splitterSize / 2
        let pxIsViewer =
            state.mainWidth - pxIsGlobe - pxIsMap

        if (pxIsGlobe <= 0) {
            pxIsGlobe = 0
            pxIsMap = state.mainWidth - state.pxIsViewer
        }
        if (pxIsMap < state.splitterSize * 2) {
            pxIsMap = state.splitterSize * 2
            pxIsViewer =
                state.mainWidth - pxIsGlobe - pxIsMap
        }
        if (pxIsGlobe > state.mainWidth - state.splitterSize * 2) {
            pxIsGlobe = state.mainWidth - state.splitterSize * 2
            pxIsViewer = 0
            pxIsMap = state.splitterSize * 2
        }

        set({ pxIsViewer, pxIsMap, pxIsGlobe })

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Splitter drag math: tools splitter
    computeToolsSplitMove: (clientY) => {
        const state = get()
        let pxIsTools =
            state.mainHeight - clientY + state.splitterSize / 4

        if (pxIsTools < state.splitterSize / 4) {
            pxIsTools = state.splitterSize / 4
        }
        if (
            pxIsTools >
            state.mainHeight - (state.splitterSize + state.topSize)
        ) {
            pxIsTools =
                state.mainHeight - (state.splitterSize + state.topSize)
        }

        set({ pxIsTools })

        const current = get()
        if (current._Viewer) current._Viewer.invalidateSize()
        if (current._Map && current._Map.map) current._Map.map.invalidateSize()
        if (current._Globe && current._Globe.litho)
            current._Globe.litho.invalidateSize()
    },

    // Window resize handler
    handleWindowResize: (newWidth, newHeight) => {
        const state = get()
        const oldWidth = state.mainWidth

        let pxIsViewer = state.pxIsViewer
        let pxIsMap = state.pxIsMap
        let pxIsGlobe = state.pxIsGlobe

        if (oldWidth > 0) {
            if (pxIsViewer !== state.splitterSize)
                pxIsViewer = (pxIsViewer / oldWidth) * newWidth
            if (pxIsMap !== state.splitterSize)
                pxIsMap = (pxIsMap / oldWidth) * newWidth
            if (pxIsGlobe !== state.splitterSize)
                pxIsGlobe = (pxIsGlobe / oldWidth) * newWidth
        }

        // Resize widest panel so sum equals screen width
        const widest = Math.max(pxIsViewer, pxIsMap, pxIsGlobe)
        if (pxIsMap === widest)
            pxIsMap = newWidth - pxIsViewer - pxIsGlobe
        else if (pxIsViewer === widest)
            pxIsViewer = newWidth - pxIsMap - pxIsGlobe
        else if (pxIsGlobe === widest)
            pxIsGlobe = newWidth - pxIsViewer - pxIsMap

        set({
            mainWidth: newWidth,
            mainHeight: newHeight,
            pxIsViewer,
            pxIsMap,
            pxIsGlobe,
        })

        // Don't let tools exceed max
        const current = get()
        if (
            current.pxIsTools >
            newHeight - current.splitterSize - current.topSize
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
