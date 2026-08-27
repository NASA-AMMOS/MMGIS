/**
 * The stacked (mobile) panel layout: viewer under the map, both above the
 * bottom chrome.
 *
 * Every stacked measurement has to agree on the extent the panels divide. When
 * the percent math divided `mainHeight` while ViewerPanel, MapPanel, Splitter
 * and the drag math all laid out against `stackedBottom()`, the two disagreed
 * by exactly the height of the bottom chrome — and the failure was invisible
 * until a horizontal tool was open, because with no tool open the two are
 * equal.
 *
 * WHAT IT LOOKED LIKE: open Info on a phone (a horizontal tool, `height:
 * mapRect.height * 0.5`) then tap a feature with imagery. The viewer was sized
 * to half of `mainHeight` but positioned at `stackedBottom - pxIsViewer`, so
 * its top went NEGATIVE — it slid up under the top bar while the map collapsed
 * to zero, and the tool panel (inside #bottomFloatingBar, z-index 1500) painted
 * over what was left of a viewer that has no z-index at all. It read as "the
 * Info panel is covering the image".
 *
 * These are pure functions on a plain state object, so none of this needs a
 * store, a DOM or a browser.
 */

import { test, expect } from '@playwright/test'
import {
    computePanelPercents,
    computePanelPixelsFromPercents,
    computeStackedReflow,
    computeToolViewerExclusion,
    isStacked,
    panelTotal,
    stackedBottom,
    MOBILE_TOOLBAR_HEIGHT,
} from '../../src/essence/Basics/UserInterface_/store/uiStoreMath.js'

/** A phone with the viewer available and no globe — the stacked case. */
function mobileState(over = {}) {
    return {
        isMobile: true,
        hasViewer: true,
        hasGlobe: false,
        toolbarVisible: true,
        mainWidth: 440,
        mainHeight: 800,
        splitterSize: 0,
        pxIsViewer: 0,
        pxIsMap: 800,
        pxIsGlobe: 0,
        pxIsTools: 0,
        pxBottomBar: 0,
        stackedViewerRestore: 0,
        ...over,
    }
}

/** A desktop layout — side by side, divides width. */
function desktopState(over = {}) {
    return mobileState({ isMobile: false, ...over })
}

test('stacked only on a phone, with a viewer and no globe', () => {
    expect(isStacked(mobileState())).toBe(true)
    expect(isStacked(mobileState({ isMobile: false }))).toBe(false)
    expect(isStacked(mobileState({ hasViewer: false }))).toBe(false)
    // A three-way stack has the same problem vertically that a side-by-side
    // split has horizontally, so a globe opts out.
    expect(isStacked(mobileState({ hasGlobe: true }))).toBe(false)
})

test('panelTotal is the width side by side and the stacked extent stacked', () => {
    expect(panelTotal(desktopState())).toBe(440)
    // No bottom chrome but the toolbar: 800 - (0 + 40).
    expect(panelTotal(mobileState())).toBe(800 - MOBILE_TOOLBAR_HEIGHT)
})

test('the percent math divides the same extent the layout anchors to', () => {
    // This is the whole bug in one assertion. With a horizontal tool open,
    // panelTotal must be stackedBottom — not mainHeight.
    const state = mobileState({ pxIsTools: 380 })
    expect(panelTotal(state)).toBe(stackedBottom(state))
    expect(panelTotal(state)).toBeLessThan(state.mainHeight)
})

test('a viewer opened over an open tool still fits above the chrome', () => {
    // Info open at half the screen, then a feature with imagery is tapped and
    // openViewerPanel() splits the remaining percent in half.
    const state = mobileState({ pxIsTools: 380 })
    const px = computePanelPixelsFromPercents(state, 50, 50, 0)

    const bottom = stackedBottom(state)
    // The regression: pxIsViewer used to be 0.5 * 800 = 400 against a bottom of
    // 380, putting the viewer's top at -20.
    expect(px.pxIsViewer).toBeLessThanOrEqual(bottom)
    const viewerTop = bottom - px.pxIsViewer
    expect(viewerTop).toBeGreaterThanOrEqual(0)

    // And the map keeps the rest, never a negative height. This is MapPanel's
    // own expression for the stacked case.
    const mapHeight = bottom - px.pxIsViewer - state.splitterSize
    expect(mapHeight).toBeGreaterThanOrEqual(0)
})

test('percents and pixels are inverses of each other when stacked', () => {
    // computePanelPercents used to divide by mainWidth unconditionally, so on a
    // phone the round trip did not come back to where it started.
    const state = mobileState({ pxIsTools: 120 })
    const px = computePanelPixelsFromPercents(state, 40, 60, 0)
    const back = computePanelPercents({ ...state, ...px })
    expect(back.viewer).toBeCloseTo(40, 6)
    expect(back.map).toBeCloseTo(60, 6)
})

test('percents and pixels stay inverses side by side', () => {
    const state = desktopState()
    const px = computePanelPixelsFromPercents(state, 30, 70, 0)
    const back = computePanelPercents({ ...state, ...px })
    expect(back.viewer).toBeCloseTo(30, 6)
    expect(back.map).toBeCloseTo(70, 6)
})

test('a zero extent reports a closed viewer rather than dividing by zero', () => {
    // The bottom chrome can briefly claim everything mid-animation.
    const state = mobileState({ pxIsTools: 10000 })
    expect(panelTotal(state)).toBeLessThanOrEqual(0)
    expect(computePanelPercents(state)).toEqual({ viewer: 0, map: 100, globe: 0 })
})

test('opening a tool displaces an open viewer and remembers its size', () => {
    const state = mobileState({ pxIsViewer: 380, pxIsMap: 380 })
    const out = computeToolViewerExclusion(state, 380)

    expect(out.pxIsViewer).toBe(0)
    // A percent, not pixels — the extent it was measured against is exactly
    // what the tool is about to change.
    expect(out.stackedViewerRestore).toBeCloseTo(
        (380 / stackedBottom(state)) * 100,
        6
    )
})

test('closing the tool puts the viewer back where it was', () => {
    const opened = mobileState({ pxIsViewer: 380, pxIsMap: 380 })
    const displaced = computeToolViewerExclusion(opened, 380)

    // The tool is now closing: pxIsTools is already 0 when this runs.
    const closing = mobileState({
        pxIsTools: 0,
        pxIsViewer: 0,
        stackedViewerRestore: displaced.stackedViewerRestore,
    })
    const restored = computeToolViewerExclusion(closing, 0)

    expect(restored.pxIsViewer).toBeCloseTo(380, 6)
    // Cleared, or the NEXT tool close would restore a stale size over whatever
    // the user has chosen since.
    expect(restored.stackedViewerRestore).toBe(0)
})

test('closing a tool does not resurrect a viewer that was never displaced', () => {
    const state = mobileState({ pxIsTools: 0, pxIsViewer: 0 })
    expect(computeToolViewerExclusion(state, 0)).toBeNull()
})

test('closing a tool leaves a viewer the user reopened alone', () => {
    // stackedViewerRestore is cleared when the viewer is opened directly, so a
    // close must not overwrite the size the user just chose.
    const state = mobileState({
        pxIsTools: 0,
        pxIsViewer: 200,
        stackedViewerRestore: 0,
    })
    expect(computeToolViewerExclusion(state, 0)).toBeNull()
})

test('exclusion is stacked-only — a side panel shares no edge with the viewer', () => {
    const state = desktopState({ pxIsViewer: 300 })
    expect(computeToolViewerExclusion(state, 400)).toBeNull()
})

test('the viewer is re-measured when the bottom chrome moves under it', () => {
    // A live time bar shows the floating bar with no tool open, which moves
    // stackedBottom without going through setToolHeight.
    const before = mobileState({ pxIsViewer: 380, pxIsMap: 380 })
    const percentBefore = computePanelPercents(before).viewer

    const after = { ...before, pxBottomBar: 100 }
    const reflow = computeStackedReflow(before, after)

    expect(reflow).not.toBeNull()
    expect(reflow.pxIsViewer).toBeLessThan(before.pxIsViewer)
    // It keeps the share the user chose, measured against the new extent.
    expect(
        computePanelPercents({ ...after, ...reflow }).viewer
    ).toBeCloseTo(percentBefore, 6)
    // And still fits.
    expect(reflow.pxIsViewer).toBeLessThanOrEqual(stackedBottom(after))
})

test('nothing to reflow when the viewer is closed', () => {
    const closed = mobileState({ pxIsViewer: 0 })
    expect(computeStackedReflow(closed, { ...closed, pxBottomBar: 100 })).toBeNull()
    const desk = desktopState({ pxIsViewer: 300 })
    expect(computeStackedReflow(desk, { ...desk, pxBottomBar: 100 })).toBeNull()
})

test('a reflow against an unchanged extent is skipped, not recomputed', () => {
    // The trap this helper was written into: deriving the share from the NEW
    // state alone divides and re-multiplies by the same total, so it returns
    // the pixels unchanged and the reflow silently does nothing. Same-extent
    // must report "nothing to do" rather than a no-op set.
    const state = mobileState({ pxIsViewer: 380, pxIsMap: 380 })
    expect(computeStackedReflow(state, { ...state })).toBeNull()
})
