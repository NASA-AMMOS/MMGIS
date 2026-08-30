/**
 * Pure rules for the feature-navigation candidate list.
 *
 * Kept out of `Description.js` because that module pulls in jQuery, tippy and
 * a stylesheet the moment it is imported, so nothing in it can be unit tested.
 * These are plain functions over GeoJSON features.
 */

/** A representative lat/lng for any geometry: points as-is, others bbox-centre. */
export function navPoint(feature) {
    const g = feature && feature.geometry
    if (!g || !g.coordinates) return null
    if (g.type === 'Point') {
        const c = g.coordinates
        return typeof c[0] === 'number' ? { lng: c[0], lat: c[1] } : null
    }
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    const walk = (c) => {
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
            if (c[0] < minLng) minLng = c[0]
            if (c[0] > maxLng) maxLng = c[0]
            if (c[1] < minLat) minLat = c[1]
            if (c[1] > maxLat) maxLat = c[1]
            return
        }
        for (let i = 0; i < c.length; i++) if (c[i]) walk(c[i])
    }
    try { walk(g.coordinates) } catch (e) { return null }
    if (minLng === Infinity) return null
    return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 }
}

/**
 * Raster-scan comparator: rows south to north, west to east within a row.
 *
 * Latitudes are banded into rows because GPS positions are never exactly equal
 * — without banding every feature is its own row and the scan collapses into a
 * plain latitude sort, which zig-zags across the map and does not read as
 * "next along". `rowHeight` comes from the visible span, so the banding tracks
 * zoom instead of being a magic constant.
 */
export function navSpatialCompare(a, b, rowHeight) {
    const pa = navPoint(a)
    const pb = navPoint(b)
    if (!pa && !pb) return 0
    if (!pa) return 1
    if (!pb) return -1
    const h = rowHeight > 0 ? rowHeight : Number.MIN_VALUE
    const rowA = Math.floor(pa.lat / h)
    const rowB = Math.floor(pb.lat / h)
    if (rowA !== rowB) return rowA - rowB
    return pa.lng - pb.lng
}

/** Is the feature stepping is measured from still in the candidate list? */
export function navAnchorInList(features, currentIdx) {
    if (!features) return false
    for (let i = 0; i < features.length; i++) {
        if (features[i] && features[i].properties?._?.id === currentIdx)
            return true
    }
    return false
}

/**
 * Where stepping lands when the anchor is NOT in the candidate list.
 *
 * A view-scoped list is a function of the map extent, so panning away from the
 * selected feature drops it out of its own list. Without an entry point the
 * index walk finds nothing to step from and both directions resolve to 0:
 *
 * WHAT IT LOOKED LIKE: open a photo, pan the map to another cluster of photos,
 * and both stepping arrows are dead — greyed out over a screen full of
 * features that are plainly there. The only way back was to tap a marker.
 *
 * `features` is already ordered in the direction of travel when a sort was
 * applied (the comparators take a sign from `direction`), so its head is the
 * first feature you would reach going that way. In default order it is always
 * ascending by index, so "previous" enters the view from the far end.
 */
export function navEntryFeature(features, direction, sortedFields) {
    if (!features || features.length === 0) return null
    if (sortedFields) return features[0]
    return direction === 'previous'
        ? features[features.length - 1]
        : features[0]
}
