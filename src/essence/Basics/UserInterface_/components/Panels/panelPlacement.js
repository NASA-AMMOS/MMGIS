/**
 * panelPlacement — where a floating tool panel sits once it has been dragged
 * or resized, kept inside the area it floats over and remembered per browser.
 *
 * Kept free of React and the DOM so it can be unit tested.
 *
 * @module panelPlacement
 */

/** localStorage key the placements are remembered under. */
export const STORAGE_KEY = 'mmgis.separatedTools.placement'

/** The gap kept between a panel and the edge of its area, in px. */
export const EDGE_GAP = 4

/** How much of a panel must stay reachable at the bottom: its header. */
export const HEADER_HEIGHT = 40

/** The smallest a panel may be resized to, in px. */
export const MIN_WIDTH = 180
export const MIN_HEIGHT = 80

const finite = (n) => typeof n === 'number' && isFinite(n)

/**
 * A placement with only the fields that are usable numbers, or null if none
 * are. `x`/`y` are the panel's top-left in viewport px and are kept only as a
 * pair; `w`/`h` are its size.
 *
 * @param {*} placement
 * @returns {{x?: number, y?: number, w?: number, h?: number}|null}
 */
export function normalizePlacement(placement) {
    if (placement == null || typeof placement !== 'object') return null
    const out = {}
    if (finite(placement.x) && finite(placement.y)) {
        out.x = Math.round(placement.x)
        out.y = Math.round(placement.y)
    }
    if (finite(placement.w) && placement.w > 0)
        out.w = Math.max(MIN_WIDTH, Math.round(placement.w))
    if (finite(placement.h) && placement.h > 0)
        out.h = Math.max(MIN_HEIGHT, Math.round(placement.h))
    return Object.keys(out).length > 0 ? out : null
}

/** True if the panel has been dragged out of the row it starts in. */
export function isFloating(placement) {
    return placement != null && finite(placement.x) && finite(placement.y)
}

/**
 * Move a placement back inside an area. The whole panel is kept inside
 * side-to-side; top-to-bottom only its header has to be, so a tall panel can
 * be parked low and still be dragged back.
 *
 * @param {{x: number, y: number, w?: number}} placement
 * @param {{left: number, top: number, right: number, bottom: number}} area
 * @param {number} [width] - the panel's current width when `w` isn't set
 * @returns {object} a copy of `placement` with `x` and `y` clamped
 */
export function clampPlacement(placement, area, width) {
    if (!isFloating(placement) || area == null) return placement
    const w = finite(placement.w) ? placement.w : finite(width) ? width : 0
    const minX = area.left + EDGE_GAP
    const maxX = Math.max(minX, area.right - w - EDGE_GAP)
    const minY = area.top + EDGE_GAP
    const maxY = Math.max(minY, area.bottom - HEADER_HEIGHT - EDGE_GAP)
    return Object.assign({}, placement, {
        x: Math.round(Math.min(Math.max(placement.x, minX), maxX)),
        y: Math.round(Math.min(Math.max(placement.y, minY), maxY)),
    })
}

/**
 * The tallest a floating panel may be where it sits: down to the bottom of
 * its area and no further.
 *
 * @param {{y: number}} placement
 * @param {{bottom: number}} area
 * @returns {number} px
 */
export function maxHeightAt(placement, area) {
    if (!isFloating(placement) || area == null) return MIN_HEIGHT
    return Math.max(MIN_HEIGHT, Math.round(area.bottom - placement.y - EDGE_GAP))
}

/**
 * Read the remembered placements. Anything unreadable is nothing remembered.
 *
 * @param {{getItem: function}} [storage] - defaults to localStorage
 * @returns {Object<string, object>} tool name → placement
 */
export function loadPlacements(storage) {
    try {
        const store =
            storage || (typeof localStorage !== 'undefined' ? localStorage : null)
        const parsed = JSON.parse(store?.getItem(STORAGE_KEY) || '{}')
        if (parsed == null || typeof parsed !== 'object') return {}
        const placements = {}
        Object.keys(parsed).forEach((name) => {
            const placement = normalizePlacement(parsed[name])
            if (placement != null) placements[name] = placement
        })
        return placements
    } catch (e) {
        return {}
    }
}

/**
 * Remember the placements. A browser that refuses storage just forgets them.
 *
 * @param {Object<string, object>} placements
 * @param {{setItem: function}} [storage] - defaults to localStorage
 */
export function savePlacements(placements, storage) {
    try {
        const store =
            storage || (typeof localStorage !== 'undefined' ? localStorage : null)
        store?.setItem(STORAGE_KEY, JSON.stringify(placements || {}))
    } catch (e) {
        // Private windows and blocked site data: nothing to do about it.
    }
}

const PanelPlacement = {
    STORAGE_KEY,
    normalizePlacement,
    isFloating,
    clampPlacement,
    maxHeightAt,
    loadPlacements,
    savePlacements,
}

export default PanelPlacement
