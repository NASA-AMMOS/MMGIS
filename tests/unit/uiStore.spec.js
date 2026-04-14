import { test, expect } from '@playwright/test'
import {
    computePanelPercents,
    computePanelPixelsFromPercents,
    computeToolHeight,
    computeMapSplitMoveResult,
    computeGlobeSplitMoveResult,
    computeToolsSplitMoveResult,
    computeWindowResize,
} from '../../src/essence/Basics/UserInterface_/store/uiStoreMath.js'

/**
 * uiStoreMath Unit Tests
 * Testing pure computation functions extracted from the Zustand store.
 * These functions contain the core layout math for the React UI migration.
 */

// Helper: create a default state object matching uiStore defaults
function makeState(overrides = {}) {
    return {
        splitterSize: 0,
        splitterSizeHidden: 17,
        topSize: 40,
        toolHeightReserve: 40,
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
        ...overrides,
    }
}

test.describe('computePanelPercents', () => {
    test('returns default when mainWidth is 0', () => {
        const result = computePanelPercents(makeState())
        expect(result.viewer).toBe(0)
        expect(result.map).toBe(100)
        expect(result.globe).toBe(0)
    })

    test('returns correct percentages', () => {
        const state = makeState({
            mainWidth: 1000,
            pxIsViewer: 200,
            pxIsMap: 600,
            pxIsGlobe: 200,
            splitterSize: 0,
        })
        const result = computePanelPercents(state)
        expect(result.viewer).toBe(20)
        expect(result.globe).toBe(20)
        expect(result.map).toBe(60)
    })

    test('accounts for splitter size in viewer width', () => {
        const state = makeState({
            mainWidth: 1000,
            pxIsViewer: 195,
            pxIsMap: 600,
            pxIsGlobe: 200,
            splitterSize: 10,
        })
        const result = computePanelPercents(state)
        // adjustedPxIsViewer = 195 + 10/2 = 200
        expect(result.viewer).toBe(20)
    })
})

test.describe('computePanelPixelsFromPercents', () => {
    test('computes pixel widths from percentages', () => {
        const state = makeState({ mainWidth: 1000, splitterSize: 0 })
        const result = computePanelPixelsFromPercents(state, 20, 60, 20)

        expect(result.pxIsViewer).toBe(200)
        expect(result.pxIsGlobe).toBe(200)
        expect(result.pxIsMap).toBe(600)
    })

    test('returns null if percents do not sum to 100', () => {
        const state = makeState({ mainWidth: 1000 })
        const result = computePanelPixelsFromPercents(state, 20, 60, 10)
        expect(result).toBeNull()
    })

    test('returns null if viewer percent set when hasViewer is false', () => {
        const state = makeState({ mainWidth: 1000, hasViewer: false })
        const result = computePanelPixelsFromPercents(state, 20, 60, 20)
        expect(result).toBeNull()
    })

    test('returns null if globe percent set when hasGlobe is false', () => {
        const state = makeState({ mainWidth: 1000, hasGlobe: false })
        const result = computePanelPixelsFromPercents(state, 0, 80, 20)
        expect(result).toBeNull()
    })

    test('allows viewer=0 when hasViewer is false', () => {
        const state = makeState({ mainWidth: 1000, hasViewer: false, splitterSize: 0 })
        const result = computePanelPixelsFromPercents(state, 0, 100, 0)
        expect(result).not.toBeNull()
        expect(result.pxIsViewer).toBe(0)
        expect(result.pxIsMap).toBe(1000)
    })

    test('parses string percentages', () => {
        const state = makeState({ mainWidth: 1000, splitterSize: 0 })
        const result = computePanelPixelsFromPercents(state, '25', '50', '25')
        expect(result.pxIsViewer).toBe(250)
        expect(result.pxIsGlobe).toBe(250)
    })
})

test.describe('computeToolHeight', () => {
    test('sets numeric height directly', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 200)).toBe(200)
    })

    test('"full" fills available height', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 'full')).toBe(800 - 10 - 40)
    })

    test('"half" fills half available height', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 'half')).toBe(
            parseInt(0.5 * (800 - 10 - 40))
        )
    })

    test('"threefourths" fills 3/4 available height', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 'threefourths')).toBe(
            parseInt(0.75 * (800 - 10 - 40))
        )
    })

    test('clamps to minimum', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 40, topSize: 40 })
        expect(computeToolHeight(state, 1)).toBe(40 / 4)
    })

    test('clamps to maximum', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 9999)).toBe(800 - 10)
    })

    test('0 returns 0', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 40 })
        expect(computeToolHeight(state, 0)).toBe(0)
    })

    test('"full" uses toolHeightReserve even when topSize is 0 (minimalist mode)', () => {
        const state = makeState({ mainHeight: 800, splitterSize: 10, topSize: 0, toolHeightReserve: 40 })
        // Should reserve 40px even though topSize is 0
        expect(computeToolHeight(state, 'full')).toBe(800 - 10 - 40)
    })
})

test.describe('computeMapSplitMoveResult', () => {
    test('computes new panel sizes from mouse position', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            pxIsViewer: 300,
            pxIsMap: 500,
            pxIsGlobe: 200,
        })

        const result = computeMapSplitMoveResult(state, 540)

        expect(result.pxIsViewer).toBeGreaterThanOrEqual(0)
        expect(result.pxIsMap).toBeGreaterThanOrEqual(0)
        expect(result.pxIsGlobe).toBeGreaterThanOrEqual(0)
    })

    test('clamps viewer to 0 at left edge', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            pxIsViewer: 300,
            pxIsMap: 500,
            pxIsGlobe: 200,
        })

        const result = computeMapSplitMoveResult(state, 42)
        expect(result.pxIsViewer).toBe(0)
    })

    test('accounts for tool panel width offset', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 300,
            pxIsViewer: 200,
            pxIsMap: 500,
            pxIsGlobe: 300,
        })

        const result = computeMapSplitMoveResult(state, 540)
        expect(result.pxIsViewer).toBeGreaterThanOrEqual(0)
    })

    test('mobile mode: no 40px toolbar offset', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            pxIsViewer: 300,
            pxIsMap: 500,
            pxIsGlobe: 200,
            isMobile: true,
        })
        // With isMobile=true, toolbar left offset is 0 instead of 40
        // clientX=540: x = 540 - 10 - 0 - 0 = 530
        const result = computeMapSplitMoveResult(state, 540)
        expect(result.pxIsViewer).toBeGreaterThanOrEqual(0)
        expect(result.pxIsMap).toBeGreaterThanOrEqual(0)

        // Compare with desktop (isMobile=false): desktop subtracts 40 more
        const desktopState = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            pxIsViewer: 300,
            pxIsMap: 500,
            pxIsGlobe: 200,
            isMobile: false,
        })
        const desktopResult = computeMapSplitMoveResult(desktopState, 540)
        // Mobile viewer should be 40px wider than desktop for same clientX
        expect(result.pxIsViewer).toBe(desktopResult.pxIsViewer + 40)
    })
})

test.describe('computeGlobeSplitMoveResult', () => {
    test('computes new panel sizes from mouse position', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            hasViewer: true,
            pxIsViewer: 200,
            pxIsMap: 500,
            pxIsGlobe: 300,
        })

        const result = computeGlobeSplitMoveResult(state, 750)

        expect(result.pxIsViewer).toBeGreaterThanOrEqual(0)
        expect(result.pxIsMap).toBeGreaterThanOrEqual(0)
        expect(result.pxIsGlobe).toBeGreaterThanOrEqual(0)
    })

    test('clamps globe to 0 at right edge', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            hasViewer: true,
            pxIsViewer: 200,
            pxIsMap: 500,
            pxIsGlobe: 300,
        })

        const result = computeGlobeSplitMoveResult(state, 1055)
        expect(result.pxIsGlobe).toBe(0)
    })

    test('handles hasViewer false (no splitter offset)', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            hasViewer: false,
            pxIsViewer: 0,
            pxIsMap: 700,
            pxIsGlobe: 300,
        })

        const result = computeGlobeSplitMoveResult(state, 750)
        expect(result.pxIsGlobe).toBeGreaterThanOrEqual(0)
    })

    test('mobile mode: no 40px toolbar offset', () => {
        const state = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            hasViewer: true,
            pxIsViewer: 200,
            pxIsMap: 500,
            pxIsGlobe: 300,
            isMobile: true,
        })
        // With isMobile=true, toolbar left offset is 0 instead of 40
        const result = computeGlobeSplitMoveResult(state, 750)
        expect(result.pxIsGlobe).toBeGreaterThanOrEqual(0)

        // Compare with desktop: globe should be 40px smaller for same clientX
        const desktopState = makeState({
            mainWidth: 1000,
            splitterSize: 10,
            toolPanelWidth: 0,
            hasViewer: true,
            pxIsViewer: 200,
            pxIsMap: 500,
            pxIsGlobe: 300,
            isMobile: false,
        })
        const desktopResult = computeGlobeSplitMoveResult(desktopState, 750)
        // Mobile globe should be 40px smaller (because x is 40 larger)
        expect(result.pxIsGlobe).toBe(desktopResult.pxIsGlobe - 40)
    })
})

test.describe('computeToolsSplitMoveResult', () => {
    test('computes pxIsTools from mouse Y position', () => {
        const state = makeState({
            mainHeight: 800,
            splitterSize: 10,
            topSize: 40,
        })

        const result = computeToolsSplitMoveResult(state, 500)
        expect(result).toBeGreaterThanOrEqual(10 / 4)
        expect(result).toBeLessThanOrEqual(800 - 10 - 40)
    })

    test('clamps to minimum when dragged to bottom', () => {
        const state = makeState({
            mainHeight: 800,
            splitterSize: 10,
            topSize: 40,
        })

        const result = computeToolsSplitMoveResult(state, 900)
        expect(result).toBe(10 / 4)
    })

    test('clamps to maximum when dragged to top', () => {
        const state = makeState({
            mainHeight: 800,
            splitterSize: 10,
            topSize: 40,
        })

        const result = computeToolsSplitMoveResult(state, -100)
        expect(result).toBe(800 - (10 + 40))
    })
})

test.describe('computeWindowResize', () => {
    test('scales panels proportionally', () => {
        const state = makeState({
            mainWidth: 1000,
            mainHeight: 800,
            pxIsViewer: 200,
            pxIsMap: 600,
            pxIsGlobe: 200,
            splitterSize: 0,
        })

        const result = computeWindowResize(state, 1200, 900)

        expect(result.pxIsViewer + result.pxIsMap + result.pxIsGlobe).toBeCloseTo(1200, 0)
    })

    test('handles initial zero width', () => {
        const state = makeState({
            mainWidth: 0,
            mainHeight: 0,
            pxIsViewer: 0,
            pxIsMap: 0,
            pxIsGlobe: 0,
        })

        const result = computeWindowResize(state, 1000, 800)
        expect(result.pxIsViewer + result.pxIsMap + result.pxIsGlobe).toBe(1000)
    })

    test('preserves relative proportions', () => {
        const state = makeState({
            mainWidth: 1000,
            mainHeight: 800,
            pxIsViewer: 250,
            pxIsMap: 500,
            pxIsGlobe: 250,
            splitterSize: 0,
        })

        const result = computeWindowResize(state, 2000, 800)

        expect(result.pxIsViewer).toBeCloseTo(500, 0)
        expect(result.pxIsGlobe).toBeCloseTo(500, 0)
    })
})
