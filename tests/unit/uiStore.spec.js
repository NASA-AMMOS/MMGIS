import { test, expect } from '@playwright/test'

/**
 * uiStore Unit Tests
 * Testing Zustand store for React UI state management
 *
 * Note: We test the store logic as pure functions since the Zustand store
 * uses getState()/setState() which work outside of React.
 */

// Dynamic import helper (store is ESM)
let useUIStore
test.beforeAll(async () => {
    const mod = await import(
        '../../src/essence/Basics/UserInterface_/store/uiStore.js'
    )
    useUIStore = mod.default
})

test.beforeEach(() => {
    // Reset store to defaults before each test
    useUIStore.setState({
        splitterSize: 0,
        splitterSizeHidden: 17,
        topSize: 40,
        fullSizeViews: false,
        pxIsViewer: 0,
        pxIsMap: 0,
        pxIsGlobe: 0,
        pxIsTools: 0,
        pxIsToolsInit: 0,
        mainWidth: 0,
        mainHeight: 0,
        hasViewer: true,
        hasMap: true,
        hasGlobe: true,
        toolPanelWidth: 0,
        helpOn: true,
        isMobile: false,
        layoutReady: false,
        visibility: {
            topbar: true,
            toolbars: true,
            scalebar: true,
            coordinates: true,
            graticule: true,
            miscellaneous: true,
        },
        _Viewer: null,
        _Map: null,
        _Globe: null,
        _L: null,
    })
})

test.describe('uiStore - Initial State', () => {
    test('has correct default values', () => {
        const state = useUIStore.getState()

        expect(state.splitterSize).toBe(0)
        expect(state.splitterSizeHidden).toBe(17)
        expect(state.topSize).toBe(40)
        expect(state.pxIsViewer).toBe(0)
        expect(state.pxIsMap).toBe(0)
        expect(state.pxIsGlobe).toBe(0)
        expect(state.pxIsTools).toBe(0)
        expect(state.mainWidth).toBe(0)
        expect(state.mainHeight).toBe(0)
        expect(state.hasViewer).toBe(true)
        expect(state.hasMap).toBe(true)
        expect(state.hasGlobe).toBe(true)
        expect(state.toolPanelWidth).toBe(0)
        expect(state.layoutReady).toBe(false)
        expect(state.isMobile).toBe(false)
    })

    test('has correct default visibility settings', () => {
        const state = useUIStore.getState()

        expect(state.visibility.topbar).toBe(true)
        expect(state.visibility.toolbars).toBe(true)
        expect(state.visibility.scalebar).toBe(true)
        expect(state.visibility.coordinates).toBe(true)
        expect(state.visibility.graticule).toBe(true)
        expect(state.visibility.miscellaneous).toBe(true)
    })
})

test.describe('uiStore - Actions', () => {
    test('setLayoutReady updates layoutReady flag', () => {
        useUIStore.getState().setLayoutReady(true)
        expect(useUIStore.getState().layoutReady).toBe(true)

        useUIStore.getState().setLayoutReady(false)
        expect(useUIStore.getState().layoutReady).toBe(false)
    })

    test('setMainDimensions updates mainWidth and mainHeight', () => {
        useUIStore.getState().setMainDimensions(1200, 800)

        const state = useUIStore.getState()
        expect(state.mainWidth).toBe(1200)
        expect(state.mainHeight).toBe(800)
    })

    test('setHasViewer updates hasViewer', () => {
        useUIStore.getState().setHasViewer(false)
        expect(useUIStore.getState().hasViewer).toBe(false)
    })

    test('setHasGlobe updates hasGlobe', () => {
        useUIStore.getState().setHasGlobe(false)
        expect(useUIStore.getState().hasGlobe).toBe(false)
    })

    test('setTopSize updates topSize', () => {
        useUIStore.getState().setTopSize(60)
        expect(useUIStore.getState().topSize).toBe(60)
    })

    test('setVisibility updates individual visibility keys', () => {
        useUIStore.getState().setVisibility('topbar', false)
        expect(useUIStore.getState().visibility.topbar).toBe(false)
        expect(useUIStore.getState().visibility.toolbars).toBe(true) // others unchanged
    })

    test('setPxIsTools updates pxIsTools', () => {
        useUIStore.getState().setPxIsTools(200)
        expect(useUIStore.getState().pxIsTools).toBe(200)
    })

    test('setToolPanelWidth updates toolPanelWidth', () => {
        useUIStore.getState().setToolPanelWidth(350)
        expect(useUIStore.getState().toolPanelWidth).toBe(350)
    })
})

test.describe('uiStore - Tool Panel', () => {
    test('openToolPanel sets width', () => {
        useUIStore.getState().openToolPanel(300)
        expect(useUIStore.getState().toolPanelWidth).toBe(300)
    })

    test('closeToolPanel sets width to 0', () => {
        useUIStore.getState().openToolPanel(300)
        useUIStore.getState().closeToolPanel()
        expect(useUIStore.getState().toolPanelWidth).toBe(0)
    })
})

test.describe('uiStore - Panel Sizing', () => {
    test('setPanelPixels sets viewer/map/globe widths', () => {
        useUIStore.getState().setPanelPixels(200, 600, 200)

        const state = useUIStore.getState()
        expect(state.pxIsViewer).toBe(200)
        expect(state.pxIsMap).toBe(600)
        expect(state.pxIsGlobe).toBe(200)
    })

    test('getPanelPercents returns correct percentages', () => {
        useUIStore.setState({ mainWidth: 1000, pxIsViewer: 200, pxIsMap: 600, pxIsGlobe: 200, splitterSize: 0 })

        const percents = useUIStore.getState().getPanelPercents()
        expect(percents.viewer).toBe(20)
        expect(percents.map).toBe(80)
        expect(percents.globe).toBe(20)
    })

    test('getPanelPercents returns default when mainWidth is 0', () => {
        const percents = useUIStore.getState().getPanelPercents()
        expect(percents.viewer).toBe(0)
        expect(percents.map).toBe(100)
        expect(percents.globe).toBe(0)
    })

    test('setPanelPercents computes pixel widths from percentages', () => {
        useUIStore.setState({ mainWidth: 1000, splitterSize: 0 })
        useUIStore.getState().setPanelPercents(20, 60, 20)

        const state = useUIStore.getState()
        expect(state.pxIsViewer).toBe(200)
        expect(state.pxIsGlobe).toBe(200)
        expect(state.pxIsMap).toBe(600)
    })

    test('setPanelPercents rejects if percents do not sum to 100', () => {
        useUIStore.setState({ mainWidth: 1000, pxIsViewer: 0, pxIsMap: 1000, pxIsGlobe: 0 })
        useUIStore.getState().setPanelPercents(20, 60, 10) // sum = 90

        // Should not have changed
        const state = useUIStore.getState()
        expect(state.pxIsMap).toBe(1000)
    })

    test('setPanelPercents rejects viewer percent when hasViewer is false', () => {
        useUIStore.setState({ mainWidth: 1000, hasViewer: false, pxIsMap: 1000 })
        useUIStore.getState().setPanelPercents(20, 60, 20)

        // Should not have changed
        expect(useUIStore.getState().pxIsMap).toBe(1000)
    })

    test('setPanelPercents rejects globe percent when hasGlobe is false', () => {
        useUIStore.setState({ mainWidth: 1000, hasGlobe: false, pxIsMap: 1000 })
        useUIStore.getState().setPanelPercents(0, 80, 20)

        // Should not have changed
        expect(useUIStore.getState().pxIsMap).toBe(1000)
    })
})

test.describe('uiStore - setToolHeight', () => {
    test('sets numeric height directly', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        useUIStore.getState().setToolHeight(200)

        expect(useUIStore.getState().pxIsTools).toBe(200)
    })

    test('"full" fills available height', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        useUIStore.getState().setToolHeight('full')

        expect(useUIStore.getState().pxIsTools).toBe(800 - 10 - 40)
    })

    test('"half" fills half available height', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        useUIStore.getState().setToolHeight('half')

        expect(useUIStore.getState().pxIsTools).toBe(
            parseInt(0.5 * (800 - 10 - 40))
        )
    })

    test('"threefourths" fills 3/4 available height', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        useUIStore.getState().setToolHeight('threefourths')

        expect(useUIStore.getState().pxIsTools).toBe(
            parseInt(0.75 * (800 - 10 - 40))
        )
    })

    test('clamps to minimum', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 40, topSize: 40 })
        useUIStore.getState().setToolHeight(1) // below min

        expect(useUIStore.getState().pxIsTools).toBe(40 / 4)
    })

    test('clamps to maximum', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        useUIStore.getState().setToolHeight(9999) // above max

        expect(useUIStore.getState().pxIsTools).toBe(800 - 10)
    })

    test('0 sets pxIsTools to 0', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40, pxIsTools: 200 })
        useUIStore.getState().setToolHeight(0)

        expect(useUIStore.getState().pxIsTools).toBe(0)
    })
})

test.describe('uiStore - Splitter Drag Math', () => {
    test.describe('computeMapSplitMove', () => {
        test('moves map splitter and updates panels', () => {
            useUIStore.setState({
                mainWidth: 1000,
                splitterSize: 10,
                toolPanelWidth: 0,
                pxIsViewer: 300,
                pxIsMap: 500,
                pxIsGlobe: 200,
            })

            useUIStore.getState().computeMapSplitMove(540) // clientX

            const state = useUIStore.getState()
            expect(state.pxIsViewer).toBeGreaterThanOrEqual(0)
            expect(state.pxIsMap).toBeGreaterThanOrEqual(0)
            expect(state.pxIsGlobe).toBeGreaterThanOrEqual(0)
        })

        test('clamps viewer to 0 at left edge', () => {
            useUIStore.setState({
                mainWidth: 1000,
                splitterSize: 10,
                toolPanelWidth: 0,
                pxIsViewer: 300,
                pxIsMap: 500,
                pxIsGlobe: 200,
            })

            useUIStore.getState().computeMapSplitMove(42) // near left edge

            expect(useUIStore.getState().pxIsViewer).toBe(0)
        })
    })

    test.describe('computeGlobeSplitMove', () => {
        test('moves globe splitter and updates panels', () => {
            useUIStore.setState({
                mainWidth: 1000,
                splitterSize: 10,
                toolPanelWidth: 0,
                hasViewer: true,
                pxIsViewer: 200,
                pxIsMap: 500,
                pxIsGlobe: 300,
            })

            useUIStore.getState().computeGlobeSplitMove(750)

            const state = useUIStore.getState()
            expect(state.pxIsViewer).toBeGreaterThanOrEqual(0)
            expect(state.pxIsMap).toBeGreaterThanOrEqual(0)
            expect(state.pxIsGlobe).toBeGreaterThanOrEqual(0)
        })

        test('clamps globe to 0 at right edge', () => {
            useUIStore.setState({
                mainWidth: 1000,
                splitterSize: 10,
                toolPanelWidth: 0,
                hasViewer: true,
                pxIsViewer: 200,
                pxIsMap: 500,
                pxIsGlobe: 300,
            })

            useUIStore.getState().computeGlobeSplitMove(1055) // near right edge

            expect(useUIStore.getState().pxIsGlobe).toBe(0)
        })
    })

    test.describe('computeToolsSplitMove', () => {
        test('moves tools splitter and clamps to bounds', () => {
            useUIStore.setState({
                mainHeight: 800,
                splitterSize: 10,
                topSize: 40,
            })

            useUIStore.getState().computeToolsSplitMove(500)

            const state = useUIStore.getState()
            expect(state.pxIsTools).toBeGreaterThanOrEqual(10 / 4)
            expect(state.pxIsTools).toBeLessThanOrEqual(800 - 10 - 40)
        })

        test('clamps to minimum when dragged to bottom', () => {
            useUIStore.setState({
                mainHeight: 800,
                splitterSize: 10,
                topSize: 40,
            })

            useUIStore.getState().computeToolsSplitMove(900) // below screen

            expect(useUIStore.getState().pxIsTools).toBe(10 / 4)
        })

        test('clamps to maximum when dragged to top', () => {
            useUIStore.setState({
                mainHeight: 800,
                splitterSize: 10,
                topSize: 40,
            })

            useUIStore.getState().computeToolsSplitMove(-100) // above screen

            expect(useUIStore.getState().pxIsTools).toBe(800 - (10 + 40))
        })
    })
})

test.describe('uiStore - Window Resize', () => {
    test('handleWindowResize updates dimensions and scales panels', () => {
        useUIStore.setState({
            mainWidth: 1000,
            mainHeight: 800,
            pxIsViewer: 200,
            pxIsMap: 600,
            pxIsGlobe: 200,
            splitterSize: 0,
        })

        useUIStore.getState().handleWindowResize(1200, 900)

        const state = useUIStore.getState()
        expect(state.mainWidth).toBe(1200)
        expect(state.mainHeight).toBe(900)
        // Panels should scale proportionally
        expect(state.pxIsViewer + state.pxIsMap + state.pxIsGlobe).toBeCloseTo(
            1200,
            0
        )
    })

    test('handleWindowResize handles initial zero width', () => {
        useUIStore.setState({
            mainWidth: 0,
            mainHeight: 0,
            pxIsViewer: 0,
            pxIsMap: 0,
            pxIsGlobe: 0,
        })

        useUIStore.getState().handleWindowResize(1000, 800)

        const state = useUIStore.getState()
        expect(state.mainWidth).toBe(1000)
        expect(state.mainHeight).toBe(800)
    })
})

test.describe('uiStore - setRefs', () => {
    test('stores references to imperative modules', () => {
        const mockL = { tools: {} }
        const mockViewer = { invalidateSize: () => {} }
        const mockMap = { map: { invalidateSize: () => {} } }
        const mockGlobe = { litho: { invalidateSize: () => {} } }

        useUIStore.getState().setRefs(mockL, mockViewer, mockMap, mockGlobe)

        const state = useUIStore.getState()
        expect(state._L).toBe(mockL)
        expect(state._Viewer).toBe(mockViewer)
        expect(state._Map).toBe(mockMap)
        expect(state._Globe).toBe(mockGlobe)
    })
})
