/**
 * Pure computation functions for the UI store.
 * Extracted from uiStore.js so they can be tested independently
 * without requiring zustand imports.
 */

/**
 * The extent the panels divide between them.
 *
 * Side by side that is the full width. Stacked it is NOT the full height: the
 * mobile toolbar and the bottom floating bar sit over the bottom of
 * #splitscreens, and `stackedBottom` is where the panels actually have to stop.
 *
 * Every stacked measurement has to agree on this. When the percent math used
 * `mainHeight` while ViewerPanel/MapPanel/Splitter laid out against
 * `stackedBottom`, opening a horizontal tool (Info is `height: mapRect.height *
 * 0.5`) shrank the anchor without shrinking the viewer — so a viewer sized to
 * half of `mainHeight` was positioned at `stackedBottom - pxIsViewer`, which
 * went NEGATIVE. The viewer slid up under the top bar and the map was squeezed
 * to nothing, which read as "the panel is covering the viewer".
 */
export function panelTotal(state) {
    return isStacked(state) ? stackedBottom(state) : state.mainWidth
}

/**
 * Compute panel percents from pixel sizes.
 *
 * The inverse of `computePanelPixelsFromPercents`, and it has to divide by the
 * same total or the two are not inverses. It used `mainWidth` unconditionally
 * — correct side by side, meaningless stacked, where the sizes are heights.
 */
export function computePanelPercents(state) {
    const total = panelTotal(state)
    if (!total || total <= 0) return { viewer: 0, map: 100, globe: 0 }
    const adjustedPxIsViewer = state.pxIsViewer + state.splitterSize / 2
    const vp = (adjustedPxIsViewer / total) * 100
    const gp = (state.pxIsGlobe / total) * 100
    const mp = 100 - vp - gp
    return { viewer: vp, map: mp, globe: gp }
}

/**
 * Compute pixel sizes from panel percents. Returns null if invalid.
 */
export function computePanelPixelsFromPercents(state, viewerPercent, mapPercent, globePercent) {
    viewerPercent = parseFloat(viewerPercent)
    mapPercent = parseFloat(mapPercent)
    globePercent = parseFloat(globePercent)

    if (!state.hasViewer && viewerPercent !== 0) return null
    if (!state.hasGlobe && globePercent !== 0) return null
    if (Math.abs(viewerPercent + mapPercent + globePercent - 100) > 0.001) return null

    // Stacked (mobile) puts the viewer under the map instead of beside it, so
    // the panel sizes are heights and divide the stacked extent rather than
    // mainWidth. See panelTotal — stacked, that is `stackedBottom`, not the
    // full `mainHeight`.
    const total = panelTotal(state)
    const pxIsViewer = total * (viewerPercent / 100) - state.splitterSize / 2
    const pxIsGlobe = total * (globePercent / 100)
    const pxIsMap = total - pxIsViewer - pxIsGlobe

    return { pxIsViewer, pxIsMap, pxIsGlobe }
}

/**
 * Whether the viewer stacks under the map rather than sitting beside it.
 *
 * A side-by-side split is unusable on a phone: the viewer takes most of the
 * width and leaves the map a strip. Stacking is mobile-only, and only when
 * there is no globe — a three-way stack has the same problem vertically.
 */
export function isStacked(state) {
    return state.isMobile === true && state.hasViewer === true && state.hasGlobe !== true
}

/**
 * Drag math for the stacked splitter, which runs horizontally along the top
 * edge of the viewer. Dragging up grows the viewer.
 */
/** The mobile toolbar's height, matching `#toolbar` in Toolbar.jsx. */
export const MOBILE_TOOLBAR_HEIGHT = 40

/**
 * The y the stacked arrangement is anchored to — the bottom of #splitscreens,
 * less whatever is floating over the bottom of it.
 *
 * Two separate things land there on a phone, and neither is subtracted from
 * `mainHeight`:
 *
 *   - **The mobile toolbar.** `#toolbar` is a *sibling* of `#splitscreens`,
 *     absolutely positioned at `bottom: pxIsTools` and 40px tall, so it covers
 *     the bottom `pxIsTools + 40` of the panel area. On desktop the same
 *     toolbar is a left column and `SplitScreens` does subtract its width —
 *     the vertical case was simply never the same shape.
 *   - **The bottom floating bar.** A *child* of `#splitscreens`, so it cannot
 *     be subtracted from the container's height without chasing its own tail;
 *     the panels stop above it instead. `pxBottomBar` is measured from the bar
 *     rather than derived from `pxIsTools`, because a live time bar shows it
 *     with no horizontal tool open, and it carries padding and a 12px margin
 *     that `pxIsTools` knows nothing about.
 *
 * `max`, not a sum: the toolbar's `bottom: pxIsTools` offset and the bar's
 * `#toolsWrapper` describe the same strip of screen, so adding them would
 * reserve it twice and leave a gap.
 *
 * Floating over a *map* is fine and deliberate — occluding a corner of a map
 * costs nothing. Floating over the viewer is not: its controls live on its
 * edges, and its image is the thing being looked at.
 *
 * Every stacked anchor goes through here — ViewerPanel, Splitter, MapPanel and
 * the drag math below. They are only consistent while they share one
 * definition; two of them disagreeing shows up as a splitter that jumps out
 * from under the finger.
 */
export function stackedBottom(state) {
    const floatingBar = state.pxBottomBar || 0
    const toolbar =
        state.isMobile === true && state.toolbarVisible !== false
            ? (state.pxIsTools || 0) + MOBILE_TOOLBAR_HEIGHT
            : 0
    return state.mainHeight - Math.max(floatingBar, toolbar)
}

/**
 * Re-derive the stacked panel pixels for the space now available.
 *
 * `stackedBottom` moves whenever the bottom chrome does — a horizontal tool
 * opening or closing, the time bar appearing. The percents are what the user
 * chose; the pixels are only ever a rendering of them against the current
 * extent. Without this the viewer keeps a pixel height measured against an
 * extent that no longer exists, and either overlaps the chrome or leaves a gap.
 *
 * Takes BOTH states, and that is the whole subtlety: the share to preserve has
 * to be read against the extent it was chosen in, then applied to the new one.
 * Deriving the percent from `next` alone reads the same pixels against the same
 * total it is about to be multiplied by, so it returns the pixels unchanged —
 * a reflow that silently does nothing.
 *
 * Returns null when there is nothing to do, so callers can skip the `set`.
 */
export function computeStackedReflow(prev, next) {
    if (!isStacked(next)) return null
    if (next.pxIsViewer <= 0) return null

    const prevTotal = panelTotal(prev)
    const nextTotal = panelTotal(next)
    if (prevTotal <= 0 || nextTotal <= 0) return null
    if (prevTotal === nextTotal) return null

    const share = (prev.pxIsViewer + prev.splitterSize / 2) / prevTotal
    return computePanelPixelsFromPercents(next, share * 100, 100 - share * 100, 0)
}

/**
 * How a horizontal tool and the stacked viewer share a phone screen: they do
 * not.
 *
 * Both are bottom-anchored and both want about half the height, so open
 * together they leave the map nothing and each other a sliver — and the tool,
 * being inside `#bottomFloatingBar` (z-index 1500) rather than `#splitscreens`
 * (z-index auto), simply paints over the viewer. Tapping a feature with
 * imagery does open both: `InfoOpen` and `viewer:open_panel` are both
 * main-phase interactions.
 *
 * So the newcomer displaces the incumbent, and the incumbent's size is
 * remembered so closing the tool puts the viewer back the way it was. That
 * makes the existing Info button a toggle between a feature's properties and
 * its image, which is the thing a field user actually wants to alternate
 * between, with no new control.
 *
 * Only stacked, and only for tools with a height — a side-panel tool on
 * desktop shares no edge with the viewer and must be left alone.
 */
export function computeToolViewerExclusion(state, newPxIsTools) {
    if (!isStacked(state)) return null

    const toolOpening = newPxIsTools > 0
    const viewerOpen = state.pxIsViewer > 0

    if (toolOpening && viewerOpen) {
        // Remember the PERCENT, not the pixels: the extent it was measured
        // against is exactly what is about to change.
        const percents = computePanelPercents(state)
        return {
            stackedViewerRestore: percents.viewer,
            pxIsViewer: 0,
            // Against the extent as it will be with the tool open, not the one
            // being left behind.
            pxIsMap: panelTotal({ ...state, pxIsTools: newPxIsTools }),
            pxIsGlobe: 0,
        }
    }

    if (!toolOpening && !viewerOpen && state.stackedViewerRestore > 0) {
        // The tool is closing and the viewer it displaced has not been reopened
        // by anything else. Restore against the extent as it will be once the
        // tool is gone, which is why this is computed with pxIsTools already 0.
        const after = { ...state, pxIsTools: 0 }
        const restored = computePanelPixelsFromPercents(
            after,
            state.stackedViewerRestore,
            100 - state.stackedViewerRestore,
            0
        )
        if (!restored) return { stackedViewerRestore: 0 }
        return { stackedViewerRestore: 0, ...restored }
    }

    return null
}

export function computeStackedSplitMove(state, y) {
    const bottom = stackedBottom(state)
    let pxIsViewer = bottom - y - state.splitterSize / 2
    if (pxIsViewer < 0) pxIsViewer = 0
    const max = bottom - state.splitterSize * 2
    if (pxIsViewer > max) pxIsViewer = max
    return {
        pxIsViewer,
        pxIsMap: state.mainHeight - pxIsViewer,
        pxIsGlobe: 0,
    }
}

/**
 * Compute tool height from a height descriptor or numeric value.
 * Returns the clamped pxIsTools value.
 */
export function computeToolHeight(state, pxHeight) {
    let newPxIsTools
    const reserve = state.toolHeightReserve != null ? state.toolHeightReserve : state.topSize

    if (pxHeight === 'full') {
        newPxIsTools = state.mainHeight - state.splitterSize - reserve
    } else if (pxHeight === 'threefourths') {
        newPxIsTools = parseInt(
            0.75 * (state.mainHeight - state.splitterSize - reserve)
        )
    } else if (pxHeight === 'half') {
        newPxIsTools = parseInt(
            0.5 * (state.mainHeight - state.splitterSize - reserve)
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

    return newPxIsTools
}

/**
 * Compute map splitter move. Returns new panel pixel sizes.
 */
export function computeMapSplitMoveResult(state, clientX) {
    // Guard: if viewer is disabled, don't allow dragging the map splitter
    if (!state.hasViewer) return { pxIsViewer: state.pxIsViewer, pxIsMap: state.pxIsMap, pxIsGlobe: state.pxIsGlobe }

    // Mobile: toolbar is at bottom, no left offset; Desktop: 40px left toolbar
    const toolbarLeftOffset = state.isMobile ? 0 : 40
    let x = clientX - state.splitterSize - toolbarLeftOffset

    if (x >= state.mainWidth - 5) x = state.mainWidth
    else if (x <= 5) x = 0

    let pxIsViewer = x - state.splitterSize / 2
    let pxIsMap =
        state.mainWidth - x + state.splitterSize / 2 - state.pxIsGlobe
    let pxIsGlobe = state.mainWidth - pxIsViewer - pxIsMap

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

    return { pxIsViewer, pxIsMap, pxIsGlobe }
}

/**
 * Compute globe splitter move. Returns new panel pixel sizes.
 */
export function computeGlobeSplitMoveResult(state, clientX) {
    // Guard: if globe is disabled, don't allow dragging the globe splitter
    if (!state.hasGlobe) return { pxIsViewer: state.pxIsViewer, pxIsMap: state.pxIsMap, pxIsGlobe: state.pxIsGlobe }

    // Mobile: toolbar is at bottom, no left offset; Desktop: 40px left toolbar
    const toolbarLeftOffset = state.isMobile ? 0 : 40
    let x = clientX - toolbarLeftOffset

    if (state.hasViewer !== false) {
        x -= state.splitterSize
    }

    if (x >= state.mainWidth - 5) x = state.mainWidth
    else if (x <= 5) x = 0

    let pxIsGlobe = state.mainWidth - x - state.splitterSize / 2
    let pxIsMap = x - state.pxIsViewer + state.splitterSize / 2
    let pxIsViewer = state.mainWidth - pxIsGlobe - pxIsMap

    if (pxIsGlobe <= 0) {
        pxIsGlobe = 0
        pxIsMap = state.mainWidth - state.pxIsViewer
    }
    if (pxIsMap < state.splitterSize * 2) {
        pxIsMap = state.splitterSize * 2
        pxIsViewer = state.mainWidth - pxIsGlobe - pxIsMap
    }
    if (pxIsGlobe > state.mainWidth - state.splitterSize * 2) {
        pxIsGlobe = state.mainWidth - state.splitterSize * 2
        pxIsViewer = 0
        pxIsMap = state.splitterSize * 2
    }

    return { pxIsViewer, pxIsMap, pxIsGlobe }
}

/**
 * Compute tools splitter move. Returns clamped pxIsTools.
 */
export function computeToolsSplitMoveResult(state, clientY) {
    let pxIsTools = state.mainHeight - clientY + state.splitterSize / 4
    const reserve = state.toolHeightReserve != null ? state.toolHeightReserve : state.topSize
    const minHeight = Math.max(state.toolNativeHeight || 0, state.splitterSize / 4)

    if (pxIsTools < minHeight) {
        pxIsTools = minHeight
    }
    if (
        pxIsTools >
        state.mainHeight - (state.splitterSize + reserve)
    ) {
        pxIsTools =
            state.mainHeight - (state.splitterSize + reserve)
    }

    return pxIsTools
}

/**
 * Compute window resize panel scaling. Returns new panel sizes.
 */
export function computeWindowResize(state, newWidth, newHeight) {
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

    return { pxIsViewer, pxIsMap, pxIsGlobe }
}
