/**
 * VectorTile layer type — globe layer config.
 *
 * Only extruded vector tile layers are drawn on the globe (flat vector tiles
 * are a 2D-map rendering); `isRenderable` answers that for both engines.
 */
import L_ from '@basics/Layers_/Layers_'

export function isRenderable(layerObj) {
    return layerObj.extrudeEnabled === true
}

export function toGlobeConfig(layerObj) {
    const s = layerObj

    return {
        name: s.name,
        path: L_.getUrl(s.type, s.url, s),
        opacity: L_.layers.opacity[s.name],
        vtLayer:
            s.extrudeVtLayer ||
            (s.style?.vtLayer ? Object.keys(s.style.vtLayer)[0] : 'building'),
        extrudeHeightProperty: s.extrudeHeightProperty || 'render_height',
        extrudeDefaultHeight: s.extrudeDefaultHeight ?? 0,
        extrudeBaseProperty: s.extrudeBaseProperty || null,
        extrudeColor: s.extrudeColor || '#cccccc',
        extrudeOverrideFeatureColor: s.extrudeOverrideFeatureColor || false,
        extrudeOpacity: s.extrudeOpacity ?? 0.9,
        minZoom: s.minZoom,
        maxZoom: s.maxNativeZoom,
    }
}

/**
 * Extruded geometry is expensive to build, so it stays loaded on the globe and
 * is hidden in place; `make` toggles it back on instead of rebuilding it.
 */
export function onToggle(layerObj, gctx) {
    if (gctx.visible) return
    if (isRenderable(layerObj)) gctx.toggleLayer(layerObj.name, false)
    else gctx.removeLayer(layerObj.name)
}

/** Show extruded tiles already on the globe, or build them. */
export function makeWith(layerObj, gctx, render) {
    if (!isRenderable(layerObj)) return
    if (gctx.hasLayer(layerObj.name))
        return gctx.toggleLayer(layerObj.name, true)
    return render(toGlobeConfig(layerObj), gctx)
}
