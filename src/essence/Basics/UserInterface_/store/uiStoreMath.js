/**
 * Pure computation functions for the UI store.
 * Extracted from uiStore.js so they can be tested independently
 * without requiring zustand imports.
 */

/**
 * Compute panel percents from pixel sizes
 */
export function computePanelPercents(state) {
    if (state.mainWidth === 0) return { viewer: 0, map: 100, globe: 0 }
    const adjustedPxIsViewer = state.pxIsViewer + state.splitterSize / 2
    const vp = (adjustedPxIsViewer / state.mainWidth) * 100
    const gp = (state.pxIsGlobe / state.mainWidth) * 100
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
    if (viewerPercent + mapPercent + globePercent !== 100) return null

    const pxIsViewer =
        state.mainWidth * (viewerPercent / 100) - state.splitterSize / 2
    const pxIsGlobe = state.mainWidth * (globePercent / 100)
    const pxIsMap = state.mainWidth - pxIsViewer - pxIsGlobe

    return { pxIsViewer, pxIsMap, pxIsGlobe }
}

/**
 * Compute tool height from a height descriptor or numeric value.
 * Returns the clamped pxIsTools value.
 */
export function computeToolHeight(state, pxHeight) {
    let newPxIsTools

    if (pxHeight === 'full') {
        newPxIsTools = state.mainHeight - state.splitterSize - state.topSize
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

    return newPxIsTools
}

/**
 * Compute map splitter move. Returns new panel pixel sizes.
 */
export function computeMapSplitMoveResult(state, clientX) {
    let x = clientX - state.splitterSize - 40 - state.toolPanelWidth

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
    let x = clientX - 40 - state.toolPanelWidth

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
