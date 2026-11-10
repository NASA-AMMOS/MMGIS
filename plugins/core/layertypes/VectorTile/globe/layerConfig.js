/**
 * VectorTile layer type — globe layer config.
 *
 * Extruded vector tile layers are drawn on either globe. Flat ones are drawn
 * on Cesium only, as imagery painted from the tiles; LithoSphere has no way
 * to draw them. `isRenderable` answers that per engine.
 */
import L_ from '@basics/Layers_/Layers_'
import { dynamicStyleSignature } from '@basics/Layers_/render/dynamicStyleRuntime'
import { featureProperties, geodatasetTileUrl } from '../source'

export function isRenderable(layerObj, engine) {
    return layerObj.extrudeEnabled === true || engine === 'cesium'
}

export function toGlobeConfig(layerObj) {
    const s = layerObj

    return {
        name: s.name,
        path: geodatasetTileUrl(s.url) ?? L_.getUrl(s.type, s.url, s),
        extruded: s.extrudeEnabled === true,
        // Flat tiles are painted from the layer's own styles.
        layerObj: s,
        order: L_._layersOrdered,
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
        // Read when each tile is built, so it is always the current style.
        resolveStyle: (properties) =>
            s._dynamicStyleResolver
                ? s._dynamicStyleResolver(featureProperties(properties))
                : null,
        styleSignature: dynamicStyleSignature(s),
        minZoom: s.minZoom,
        maxZoom: s.maxNativeZoom,
    }
}

/**
 * Globe content is expensive to build, so it stays loaded on the globe and
 * is hidden in place; `make` toggles it back on instead of rebuilding it.
 */
export function onToggle(layerObj, gctx) {
    if (gctx.visible) return
    if (isRenderable(layerObj, gctx.engine))
        gctx.toggleLayer(layerObj.name, false)
    else gctx.removeLayer(layerObj.name)
}

/**
 * Show tiles already on the globe, or build them. Tiles built before the
 * layer's dynamic style last changed are rebuilt with it - what a restyle asks
 * for by adding the layer again.
 */
export function makeWith(layerObj, gctx, render) {
    if (!isRenderable(layerObj, gctx.engine)) return
    if (gctx.hasLayer(layerObj.name)) {
        const built = gctx.layers?.[layerObj.name]
        const signature = dynamicStyleSignature(layerObj)
        if (built?.restyle && built.styleSignature !== signature) {
            built.styleSignature = signature
            built.restyle()
        }
        return gctx.toggleLayer(layerObj.name, true)
    }
    return render(toGlobeConfig(layerObj), gctx)
}
