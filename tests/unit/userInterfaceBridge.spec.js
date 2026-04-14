import { test, expect } from '@playwright/test'

/**
 * UserInterfaceBridge Unit Tests
 * Testing the imperative bridge that delegates to the Zustand store
 */

let useUIStore
let UserInterfaceBridge

test.beforeAll(async () => {
    const storeMod = await import(
        '../../src/essence/Basics/UserInterface_/store/uiStore.js'
    )
    useUIStore = storeMod.default

    const bridgeMod = await import(
        '../../src/essence/Basics/UserInterface_/UserInterfaceBridge.js'
    )
    UserInterfaceBridge = bridgeMod.default
})

test.beforeEach(() => {
    // Reset store to defaults
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

test.describe('UserInterfaceBridge - Property Getters', () => {
    test('splitterSize reads from store', () => {
        useUIStore.setState({ splitterSize: 10 })
        expect(UserInterfaceBridge.splitterSize).toBe(10)
    })

    test('splitterSizeHidden reads from store', () => {
        expect(UserInterfaceBridge.splitterSizeHidden).toBe(17)
    })

    test('topSize reads from store', () => {
        expect(UserInterfaceBridge.topSize).toBe(40)
    })

    test('topSize setter writes to store', () => {
        UserInterfaceBridge.topSize = 60
        expect(useUIStore.getState().topSize).toBe(60)
    })

    test('pxIsViewer reads from store', () => {
        useUIStore.setState({ pxIsViewer: 300 })
        expect(UserInterfaceBridge.pxIsViewer).toBe(300)
    })

    test('pxIsViewer setter writes to store', () => {
        UserInterfaceBridge.pxIsViewer = 400
        expect(useUIStore.getState().pxIsViewer).toBe(400)
    })

    test('pxIsMap reads from store', () => {
        useUIStore.setState({ pxIsMap: 500 })
        expect(UserInterfaceBridge.pxIsMap).toBe(500)
    })

    test('pxIsGlobe reads from store', () => {
        useUIStore.setState({ pxIsGlobe: 200 })
        expect(UserInterfaceBridge.pxIsGlobe).toBe(200)
    })

    test('pxIsTools reads from store', () => {
        useUIStore.setState({ pxIsTools: 150 })
        expect(UserInterfaceBridge.pxIsTools).toBe(150)
    })

    test('mainWidth reads from store', () => {
        useUIStore.setState({ mainWidth: 1280 })
        expect(UserInterfaceBridge.mainWidth).toBe(1280)
    })

    test('mainHeight reads from store', () => {
        useUIStore.setState({ mainHeight: 720 })
        expect(UserInterfaceBridge.mainHeight).toBe(720)
    })

    test('hasViewer reads from store', () => {
        expect(UserInterfaceBridge.hasViewer).toBe(true)
        useUIStore.setState({ hasViewer: false })
        expect(UserInterfaceBridge.hasViewer).toBe(false)
    })

    test('hasMap reads from store', () => {
        expect(UserInterfaceBridge.hasMap).toBe(true)
    })

    test('hasGlobe reads from store', () => {
        expect(UserInterfaceBridge.hasGlobe).toBe(true)
    })

    test('helpOn reads from store', () => {
        expect(UserInterfaceBridge.helpOn).toBe(true)
    })
})

test.describe('UserInterfaceBridge - Methods', () => {
    test('init is a no-op (does not throw)', () => {
        expect(() => UserInterfaceBridge.init()).not.toThrow()
    })

    test('setToolHeight delegates to store', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        UserInterfaceBridge.setToolHeight(200)
        expect(useUIStore.getState().pxIsTools).toBe(200)
    })

    test('setToolHeight "full" delegates to store', () => {
        useUIStore.setState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        UserInterfaceBridge.setToolHeight('full')
        expect(useUIStore.getState().pxIsTools).toBe(800 - 10 - 40)
    })

    test('getPanelPercents delegates to store', () => {
        useUIStore.setState({
            mainWidth: 1000,
            pxIsViewer: 200,
            pxIsMap: 600,
            pxIsGlobe: 200,
            splitterSize: 0,
        })

        const percents = UserInterfaceBridge.getPanelPercents()
        expect(percents.viewer).toBe(20)
        expect(percents.globe).toBe(20)
    })

    test('setPanelPercents delegates to store', () => {
        useUIStore.setState({ mainWidth: 1000, splitterSize: 0 })
        UserInterfaceBridge.setPanelPercents(25, 50, 25)

        const state = useUIStore.getState()
        expect(state.pxIsViewer).toBe(250)
        expect(state.pxIsGlobe).toBe(250)
    })

    test('minimalist sets topSize to 0', () => {
        UserInterfaceBridge.minimalist(true)
        expect(useUIStore.getState().topSize).toBe(0)
    })

    test('openViewerPanel adjusts panel percents', () => {
        useUIStore.setState({
            mainWidth: 1000,
            splitterSize: 0,
            pxIsViewer: 0,
            pxIsMap: 800,
            pxIsGlobe: 200,
        })

        UserInterfaceBridge.openViewerPanel()

        const state = useUIStore.getState()
        expect(state.pxIsViewer).toBeGreaterThan(0)
    })
})

test.describe('UserInterfaceBridge - Setters', () => {
    test('hasViewer setter writes to store', () => {
        UserInterfaceBridge.hasViewer = false
        expect(useUIStore.getState().hasViewer).toBe(false)
    })

    test('hasGlobe setter writes to store', () => {
        UserInterfaceBridge.hasGlobe = false
        expect(useUIStore.getState().hasGlobe).toBe(false)
    })

    test('pxIsTools setter writes to store', () => {
        UserInterfaceBridge.pxIsTools = 300
        expect(useUIStore.getState().pxIsTools).toBe(300)
    })

    test('mainWidth setter writes to store', () => {
        UserInterfaceBridge.mainWidth = 1920
        expect(useUIStore.getState().mainWidth).toBe(1920)
    })

    test('mainHeight setter writes to store', () => {
        UserInterfaceBridge.mainHeight = 1080
        expect(useUIStore.getState().mainHeight).toBe(1080)
    })
})
