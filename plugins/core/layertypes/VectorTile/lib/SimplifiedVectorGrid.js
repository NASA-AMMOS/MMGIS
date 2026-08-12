/**
 * SimplifiedVectorGrid — extends L.VectorGrid.Protobuf to apply Douglas-Peucker
 * polyline simplification to polygon geometries after decoding, before rendering.
 *
 * Why this exists
 * ---------------
 * MVT tiles from sources like OpenStreetMap buildings contain thousands of
 * polygons per tile, each with many vertices describing curved edges, steps,
 * bay windows, and other detail that's invisible at typical map zoom levels.
 * Rendering every one of those vertices through Leaflet's SVG layer is
 * expensive — each extra vertex is an extra `L` command in an SVG path and
 * another point in the DOM render tree.  Douglas-Peucker collapses runs of
 * near-collinear points into straight segments, typically removing 50–80% of
 * the vertices in a building footprint with no perceptible visual change.
 *
 * The Douglas-Peucker algorithm
 * -----------------------------
 * Given a polyline and a tolerance ε, the algorithm recursively finds the
 * point farthest from the straight line between the first and last points:
 *
 *   1. Always keep the endpoints.
 *   2. For each segment A→B on the stack, compute the perpendicular distance
 *      from every interior point to the line A–B.
 *   3. If the farthest point P is closer than ε, discard everything between
 *      A and B — the whole run is "flat enough" to approximate as A→B.
 *   4. Otherwise, keep P and recurse on A→P and P→B.
 *
 * The output is the subset of points that preserves the polyline's shape to
 * within ε.  Running time is O(n log n) on average, O(n²) worst-case.
 *
 * Our implementation uses an explicit stack instead of recursion so it can't
 * overflow on large rings, and squares the tolerance once so the inner loop
 * can compare squared distances (skipping the sqrt in the distance formula).
 *
 * Tolerance guidance
 * ------------------
 * Units are MVT tile-local coordinates.  The standard MVT extent is 4096, so
 * a tile covers 0–4095 on each axis regardless of its geographic size.  A
 * tolerance of 2 means "collapse points within 2/4096 of a tile width of
 * each other" — at zoom 14 (~2.4 km wide), that's roughly 1.2 meters.
 *
 *   - 0:   no simplification
 *   - 1–2: barely visible change, moderate speedup
 *   - 3–5: slight rounding of corners, large speedup
 *   - 8+:  visible simplification at high zoom
 *
 * Usage
 * -----
 *   L.simplifiedVectorGrid.protobuf(url, {
 *     ...standardVectorGridOptions,
 *     simplifyTolerance: 2,
 *   })
 *
 * When `simplifyTolerance` is 0 or unset, the subclass falls through to the
 * stock L.VectorGrid.Protobuf behavior — no simplification, no overhead.
 */
// Leaflet is loaded globally via src/external/Leaflet/leaflet1.5.1 in src/index.js.
// Use window.L instead of importing from 'leaflet' (not an npm dep here).
const L = window.L

/**
 * Douglas-Peucker polyline simplification.  See the file header for the
 * high-level description.  Returns a new array containing the subset of the
 * input points that preserves the polyline's shape within `tolerance`.
 * The first and last points are always preserved.
 */
function douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points

    // Compare squared distances throughout so we never need Math.sqrt
    const sqTolerance = tolerance * tolerance

    // keep[i] === 1 means we're retaining points[i] in the output
    const keep = new Uint8Array(points.length)
    keep[0] = 1
    keep[points.length - 1] = 1

    // Each stack entry is a [first, last] range of the input still being
    // examined.  We start with the full polyline and subdivide as we find
    // vertices farther than the tolerance from the current approximation.
    const stack = [[0, points.length - 1]]
    while (stack.length > 0) {
        const [first, last] = stack.pop()

        // Find the interior point farthest from the straight segment first→last
        let maxDist = 0
        let maxIdx = 0
        const ax = points[first][0]
        const ay = points[first][1]
        const bx = points[last][0]
        const by = points[last][1]
        const dx = bx - ax
        const dy = by - ay
        const segLenSq = dx * dx + dy * dy

        for (let i = first + 1; i < last; i++) {
            const px = points[i][0]
            const py = points[i][1]
            let sqDist
            if (segLenSq === 0) {
                // Degenerate case: first and last coincide — distance is just
                // from the point to that shared position
                const ex = px - ax
                const ey = py - ay
                sqDist = ex * ex + ey * ey
            } else {
                // Project P onto segment A→B, clamp to [0, 1] so we measure
                // perpendicular distance to the segment (not the infinite line)
                let t = ((px - ax) * dx + (py - ay) * dy) / segLenSq
                if (t < 0) t = 0
                else if (t > 1) t = 1
                const cx = ax + t * dx
                const cy = ay + t * dy
                const ex = px - cx
                const ey = py - cy
                sqDist = ex * ex + ey * ey
            }
            if (sqDist > maxDist) {
                maxDist = sqDist
                maxIdx = i
            }
        }

        // If the farthest interior point is beyond the tolerance, we can't
        // approximate this stretch as a single segment — keep that point and
        // recursively simplify the two halves it splits the range into.
        // If every interior point is within tolerance, discard them all.
        if (maxDist > sqTolerance) {
            keep[maxIdx] = 1
            stack.push([first, maxIdx])
            stack.push([maxIdx, last])
        }
    }

    // Collect the kept points in their original order
    const result = []
    for (let i = 0; i < points.length; i++) {
        if (keep[i]) result.push(points[i])
    }
    return result
}

/**
 * Simplify an MVT feature's geometry in place. Geometry is an array of rings,
 * each a list of [x, y] points.
 */
function simplifyFeatureGeometry(feature, tolerance) {
    if (feature.type !== 3) return // only simplify polygons (MVT type 3)
    const rings = feature.geometry
    if (!rings) return
    for (let i = 0; i < rings.length; i++) {
        const simplified = douglasPeucker(rings[i], tolerance)
        // A valid polygon ring needs at least 4 points (closed). Skip simplification
        // results that degenerate below that.
        if (simplified.length >= 4) rings[i] = simplified
    }
}

const SimplifiedVectorGridProtobuf = L.VectorGrid.Protobuf.extend({
    options: {
        simplifyTolerance: 0, // no simplification by default
    },

    _getVectorTilePromise: function (coords) {
        const tolerance = this.options.simplifyTolerance
        const basePromise = L.VectorGrid.Protobuf.prototype._getVectorTilePromise.call(
            this,
            coords
        )
        if (!tolerance || tolerance <= 0) return basePromise

        return basePromise.then((json) => {
            for (const layerName in json.layers) {
                const features = json.layers[layerName].features
                if (!features) continue
                for (let i = 0; i < features.length; i++) {
                    simplifyFeatureGeometry(features[i], tolerance)
                }
            }
            return json
        })
    },
})

L.VectorGrid.SimplifiedProtobuf = SimplifiedVectorGridProtobuf
L.simplifiedVectorGrid = L.simplifiedVectorGrid || {}
L.simplifiedVectorGrid.protobuf = function (url, options) {
    return new SimplifiedVectorGridProtobuf(url, options)
}

export default SimplifiedVectorGridProtobuf
