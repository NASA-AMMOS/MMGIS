/**
 * 3D Tiles layer type — globe layer config.
 *
 * A 3D Tiles set is globe-only: it has no 2D map renderer, so this config is
 * built purely from the layer's normal MMGIS config object.
 */
import L_ from '@basics/Layers_/Layers_'

export function toGlobeConfig(layerObj) {
    const s = layerObj

    return {
        name: s.name,
        path: L_.getUrl(s.type, s.url, s),
        opacity: L_.layers.opacity[s.name],
        maximumScreenSpaceError: s.maximumScreenSpaceError ?? 16,
        maximumMemoryUsage: s.maximumMemoryUsage ?? 512,
        heightOffset: s.heightOffset || 0,
        style: s.tileStyle || null,
    }
}

/**
 * A 3D Tiles set is expensive to load, so a hidden tileset stays loaded on the
 * globe and is hidden in place; `make` toggles it back on instead of rebuilding.
 */
export function onToggle(layerObj, gctx) {
    if (!gctx.visible) gctx.toggleLayer(layerObj.name, false)
}

/** Show a tileset that is already loaded on the globe, or build it. */
export function makeWith(layerObj, gctx, render) {
    if (gctx.hasLayer(layerObj.name))
        return gctx.toggleLayer(layerObj.name, true)
    return render(toGlobeConfig(layerObj), gctx)
}
