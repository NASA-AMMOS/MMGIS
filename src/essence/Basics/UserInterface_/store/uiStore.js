import { create } from 'zustand'
import {
    computePanelPercents,
    computePanelPixelsFromPercents,
    computeToolHeight,
    computeMapSplitMoveResult,
    computeGlobeSplitMoveResult,
    computeToolsSplitMoveResult,
    computeWindowResize,
    computeStackedSplitMove,
    computeStackedReflow,
    computeToolViewerExclusion,
    isStacked,
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
    // Vertical space the bottom floating bar occupies, measured from the bar,
    // 0 when it is hidden. Read by every stacked-layout anchor via
    // stackedBottom() in uiStoreMath.
    pxBottomBar: 0,
    toolNativeHeight: 0,
    // The viewer percent a horizontal tool displaced, so closing the tool can
    // put it back. 0 when the viewer was not open. See
    // computeToolViewerExclusion.
    stackedViewerRestore: 0,

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
    mobileTopSize: 40,

    // TimeUI state (synced from DOM via MutationObserver)
    timeUIActive: false,
    timeUIExpanded: false,

    // Drag state (disable CSS transitions during splitter drag)
    isDraggingSplitter: false,

    // Layout ready flag for essence.js integration
    layoutReady: false,

    // Visibility of main container (toggled by show/hide)
    visible: false,

    // Modal blur (number of active modals, drives blur on #main-container)
    modalBlurCount: 0,
    setModalBlurCount: (count) => set({ modalBlurCount: count }),

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
        searchbar: true,
    },

    // Config look flags (set by UserInterfaceBridge.fina from mission config)
    lookConfig: {},
    setLookConfig: (config) => set({ lookConfig: config }),

    // ToolController toolbar state (synced from ToolController_.init)
    toolsList: [],          // Array of tool config objects { name, icon, js, separatedTool, variables, ... }
    activeToolName: null,   // Name of the currently active toolbar tool (e.g. 'LayersTool')
    toolsLoaded: false,     // True after ToolController_ has initialized all tool modules
    mobileTools: [],        // Array of tool names shown on mobile (e.g. ['Layers', 'Legend', 'Info'])

    // Separated tools (Legend, Identifier, etc.)
    separatedToolsList: [],       // Tool config objects where separatedTool is true or "custom" (resolved from the manifest)
    activeSeparatedTools: [],     // Array of active separated tool module names (e.g. ['LegendTool'])
    setSeparatedToolsList: (tools) => set({ separatedToolsList: tools }),
    setActiveSeparatedTools: (tools) => set({ activeSeparatedTools: tools }),
    addActiveSeparatedTool: (toolModuleName) =>
        set((state) => ({
            activeSeparatedTools: state.activeSeparatedTools.includes(toolModuleName)
                ? state.activeSeparatedTools
                : [...state.activeSeparatedTools, toolModuleName],
        })),
    removeActiveSeparatedTool: (toolModuleName) =>
        set((state) => ({
            activeSeparatedTools: state.activeSeparatedTools.filter(
                (t) => t !== toolModuleName
            ),
        })),
    toggleSeparatedTool: (toolModuleName) =>
        set((state) => ({
            activeSeparatedTools: state.activeSeparatedTools.includes(toolModuleName)
                ? state.activeSeparatedTools.filter((t) => t !== toolModuleName)
                : [...state.activeSeparatedTools, toolModuleName],
        })),

    // Status indicator (reload / websocket disconnected / layer update)
    // type: null | 'RELOAD' | 'ADD_LAYER' | 'DISCONNECTED'
    statusIndicator: null,
    setStatusIndicator: (type) => set({ statusIndicator: type }),

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
    setPxBottomBar: (val) =>
        set((s) => {
            if (s.pxBottomBar === val) return s
            // Moves stackedBottom without going through setToolHeight (a live
            // time bar shows the floating bar with no tool open), so the viewer
            // has to be re-measured against the new extent here too.
            const next = { ...s, pxBottomBar: val }
            const reflow = computeStackedReflow(s, next)
            return reflow ? { pxBottomBar: val, ...reflow } : { pxBottomBar: val }
        }),

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
        let state = get()

        // The other half of the tool/viewer exclusion (setToolHeight has the
        // first). Tapping a feature with imagery fires InfoOpen and
        // viewer:open_panel in the same main phase, so without this the viewer
        // opens UNDER a tool panel that is painting over it. Closing the tool
        // first also frees the height the viewer is about to be measured
        // against, which is why the state is re-read afterwards.
        if (
            isStacked(state) &&
            parseFloat(viewerPercent) > 0 &&
            state.pxIsTools > 0
        ) {
            // Lazily required: ToolController_ imports this store, so a
            // top-level import would be a cycle. Same pattern as Toolbar.jsx.
            const ToolController_ =
                require('../../ToolController_/ToolController_').default
            ToolController_.closeActiveTool()
            state = get()
            // closeActiveTool remembers the viewer it thinks it displaced; this
            // open supersedes that, and leaving it set would have the NEXT tool
            // close restore a stale size over what the user just chose.
            if (state.stackedViewerRestore !== 0) {
                set({ stackedViewerRestore: 0 })
                state = get()
            }
        }

        const result = computePanelPixelsFromPercents(state, viewerPercent, mapPercent, globePercent)
        if (!result) return

        const wasGlobeClosed = state.pxIsGlobe === 0
        const isGlobeOpening = parseFloat(globePercent) > 0

        set({ pxIsViewer: result.pxIsViewer, pxIsMap: result.pxIsMap, pxIsGlobe: result.pxIsGlobe })

        // invalidateSize is handled automatically by ResizeObservers on each
        // panel component (MapPanel, ViewerPanel, GlobePanel). The observers
        // fire after layout but before paint, eliminating the visible "jerk"
        // that the previous setTimeout(0) approach caused.

        const wasMapOpen = state.pxIsMap > 0

        // The globe opens onto what the map is showing: it can't have been
        // moved while it was closed, so the map is where the user was looking.
        if (wasGlobeClosed && isGlobeOpening) {
            setTimeout(() => {
                const current = get()
                if (current._Globe) {
                    const first = !current._Globe.hasBeenOpened
                    if (first) {
                        current._Globe.hasBeenOpened = true
                        current._Globe.init()
                    }
                    // Not when a link asked for a particular globe view, nor
                    // from a layout whose map was closed and so is stale.
                    if (
                        wasMapOpen &&
                        current._L &&
                        current._L.FUTURES.globeView == null
                    ) {
                        setTimeout(
                            () => current._Globe.syncToMapCenter(),
                            first ? 100 : 0
                        )
                    }
                }
                // Always invalidateSize when globe opens, even if already initialized
                if (current._Globe && current._Globe.litho) {
                    requestAnimationFrame(() => {
                        current._Globe.litho.invalidateSize()
                    })
                }
            }, 0)
        }
    },

    setToolHeight: (pxHeight, shouldntAnimate) => {
        const state = get()
        const h = computeToolHeight(state, pxHeight)
        const nativeH = typeof pxHeight === 'number' ? pxHeight : h

        // Stacked, a horizontal tool and the viewer are mutually exclusive —
        // they are both bottom-anchored and both want half the screen. Computed
        // from the PRE-change state (it needs the viewer size the tool is about
        // to displace), applied together with it.
        const exclusion = computeToolViewerExclusion(state, h)

        set({ pxIsTools: h, toolNativeHeight: nativeH, ...(exclusion || {}) })

        // The tool just moved stackedBottom, so any viewer still open was sized
        // against an extent that no longer exists. Skipped when the exclusion
        // above already set the viewer, which is the common case.
        if (!exclusion) {
            const reflow = computeStackedReflow(state, get())
            if (reflow) set(reflow)
        }
    },

    openToolPanel: (width) => {
        set({ toolPanelWidth: width })
    },

    closeToolPanel: () => {
        set({ toolPanelWidth: 0 })
    },

    openRightPanel: (width) => {
        set({ rightPanelWidth: width })
    },

    closeRightPanel: () => {
        set({ rightPanelWidth: 0 })
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
    computeMapSplitMove: (clientX, clientY) => {
        const state = get()
        // Stacked (mobile) drags vertically — the splitter is a horizontal bar
        // along the top of the viewer, so the pointer's Y is what matters.
        if (isStacked(state)) set(computeStackedSplitMove(state, clientY))
        else set(computeMapSplitMoveResult(state, clientX))
    },

    /** True when the viewer is stacked under the map (mobile). */
    isStackedLayout: () => isStacked(get()),

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
