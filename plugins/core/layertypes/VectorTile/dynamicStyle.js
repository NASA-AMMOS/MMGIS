/**
 * VectorTile layer type — dynamic style.
 *
 * A vector layer holds every feature, so its dynamic style is measured over
 * them and repainted by resetting each one. A vector tile layer holds only the
 * tiles near the view, decoded into symbolizers that are drawn once. This gives
 * the dynamic style runtime the same two things from tiles: the features a
 * domain is measured over, and a repaint of what is already drawn. Tiles drawn
 * later style themselves, since their style function reads the layer's current
 * resolver.
 *
 * @module VectorTile/dynamicStyle
 */

/**
 * Whether a layer is configured with a dynamic style. Not whether any rule is
 * on: a viewer can switch them all off and on again while the layer is drawn,
 * so it is drawn ready for them either way.
 *
 * @param {object} layerObj
 * @returns {boolean}
 */
export function hasDynamicStyle(layerObj) {
    const dynamicStyle = layerObj?.variables?.dynamicStyle
    return dynamicStyle?.enabled === true && Array.isArray(dynamicStyle.rules)
}

/** What a sublayer the configuration doesn't list is drawn with: nothing. */
const HIDDEN_STYLE = {
    fill: false,
    stroke: false,
    weight: 0,
    fillOpacity: 0,
    opacity: 0,
}

/**
 * The most features remembered per layer for a whole-dataset scale. A layer of
 * dense tiles (buildings, say) would otherwise grow without end as it is
 * explored; past this the scale is measured over the first ones seen.
 */
const MAX_REMEMBERED_FEATURES = 50000

/**
 * The sublayer each drawn feature belongs to. A symbolizer shares its
 * feature's properties object, so this is how a repaint knows which style
 * function a drawn feature takes. Only dynamically styled sublayers are kept.
 */
const sublayerOf = new WeakMap()

/** The Leaflet path options a layer's Style fields set. */
function configuredStyle(layerObj) {
    const style = { fill: true, stroke: true }
    for (const key of [
        'color',
        'opacity',
        'fillColor',
        'fillOpacity',
        'weight',
        'radius',
    ]) {
        if (layerObj.style?.[key] != null) style[key] = layerObj.style[key]
    }
    return style
}

/**
 * Remember a feature a whole-dataset scale is measured over. The tiles it came
 * from are let go as the view moves, so without this the scale would only ever
 * describe what is near the view.
 */
function remember(layerObj, properties) {
    if (layerObj._vtRememberedFeatures == null)
        layerObj._vtRememberedFeatures = new Map()
    const remembered = layerObj._vtRememberedFeatures
    if (remembered.size >= MAX_REMEMBERED_FEATURES) return
    // A feature cut across several tiles arrives once per tile; with an id
    // they are one feature, without one each piece counts.
    const vtId = layerObj.style?.vtId
    const key =
        vtId != null && properties[vtId] != null ? properties[vtId] : properties
    if (!remembered.has(key)) remembered.set(key, { properties })
}

/**
 * The style VectorGrid draws a sublayer's features with: its configured style,
 * with the layer's dynamic style over it once there is one.
 */
function dynamicStyleFunction(layerObj, sublayer, base) {
    return function (properties) {
        sublayerOf.set(properties, sublayer)
        remember(layerObj, properties)
        const dynamic = layerObj._dynamicStyleResolver?.(properties)
        return dynamic == null ? base : Object.assign({}, base, dynamic)
    }
}

/**
 * The `vectorTileLayerStyles` a layer is drawn with. Sublayers not listed in
 * `style.vtLayer` stay hidden, except that a dynamically styled layer listing
 * none styles every sublayer: there would be nothing to see otherwise.
 *
 * @param {object} layerObj
 * @returns {object}
 */
export function vectorTileStyles(layerObj) {
    const listed = layerObj.style?.vtLayer || {}
    const dynamic = hasDynamicStyle(layerObj)
    const styleAll = dynamic && Object.keys(listed).length === 0
    const functions = {}
    const styleOf = (sublayer) => {
        if (!dynamic) return listed[sublayer]
        if (!(sublayer in listed) && !styleAll) return undefined
        if (functions[sublayer] == null)
            functions[sublayer] = dynamicStyleFunction(
                layerObj,
                sublayer,
                listed[sublayer] || configuredStyle(layerObj)
            )
        return functions[sublayer]
    }
    return new Proxy(listed, {
        get(target, prop) {
            return styleOf(prop) ?? HIDDEN_STYLE
        },
        has() {
            return true
        },
    })
}

/**
 * Give a VectorGrid layer what the dynamic style runtime asks a tiled layer
 * for. `dynamicStyleFeatures(bounds)` is the features a scale is measured
 * over - those drawn in `bounds`, or every one remembered when `bounds` is
 * null - and `repaintDynamicStyle()` restyles the drawn ones.
 *
 * @param {object} gridLayer  The layer's L.VectorGrid.
 * @param {object} layerObj
 */
export function attachDynamicStyle(gridLayer, layerObj) {
    gridLayer.dynamicStyleFeatures = function (bounds) {
        if (bounds == null)
            return [...(layerObj._vtRememberedFeatures?.values() || [])]
        const features = []
        forEachDrawnFeature(gridLayer, (symbolizer, renderer) => {
            const tileBounds = gridLayer._tileCoordsToBounds(renderer.getCoord())
            if (bounds.intersects(tileBounds))
                features.push({ properties: symbolizer.properties })
        })
        return features
    }

    gridLayer.repaintDynamicStyle = function () {
        const styles = gridLayer.options.vectorTileLayerStyles
        const vtId = layerObj.style?.vtId
        forEachDrawnFeature(gridLayer, (symbolizer, renderer) => {
            // A highlighted feature keeps its highlight; it is restyled when
            // the highlight is cleared.
            const id = vtId != null ? symbolizer.properties[vtId] : undefined
            if (id != null && gridLayer._overriddenStyles?.[id]) return
            gridLayer._updateStyles(
                symbolizer,
                renderer,
                styles[sublayerOf.get(symbolizer.properties)]
            )
        })
    }
}

/** Each drawn feature of a dynamically styled sublayer, with its tile. */
function forEachDrawnFeature(gridLayer, callback) {
    for (const key in gridLayer._vectorTiles || {}) {
        const renderer = gridLayer._vectorTiles[key]
        for (const id in renderer._layers || {}) {
            const symbolizer = renderer._layers[id]
            if (symbolizer?.properties == null) continue
            if (!sublayerOf.has(symbolizer.properties)) continue
            callback(symbolizer, renderer)
        }
    }
}

const VectorTileDynamicStyle = {
    attachDynamicStyle,
    hasDynamicStyle,
    vectorTileStyles,
}

export default VectorTileDynamicStyle
