/**
 * Model layer type — globe layer config.
 *
 * A model is globe-only: it has no 2D map renderer, so this config is built
 * purely from the layer's normal MMGIS config object.
 */
import L_ from '@basics/Layers_/Layers_'

export function toGlobeConfig(layerObj) {
    const s = layerObj

    return {
        name: s.name,
        order: L_._layersOrdered,
        on: true,
        path: L_.getUrl(s.type, s.url, s),
        opacity: L_.layers.opacity[s.name],
        position: {
            longitude: s.position?.longitude || 0,
            latitude: s.position?.latitude || 0,
            elevation: s.position?.elevation || 0,
        },
        scale: s.scale || 1,
        rotation: {
            // y-up is away from planet center. x is pitch, y is yaw, z is roll
            x: s.rotation?.x || 0,
            y: s.rotation?.y || 0,
            z: s.rotation?.z || 0,
        },
    }
}

/**
 * Models are expensive to parse, so a hidden model stays loaded on the globe and
 * is hidden in place; `make` toggles it back on instead of rebuilding it.
 */
export function onToggle(layerObj, gctx) {
    if (!gctx.visible) gctx.toggleLayer(layerObj.name, false)
}

/** Show a model that is already loaded on the globe, or build it. */
export function makeWith(layerObj, gctx, render) {
    if (gctx.hasLayer(layerObj.name))
        return gctx.toggleLayer(layerObj.name, true)
    return render(toGlobeConfig(layerObj), gctx)
}
