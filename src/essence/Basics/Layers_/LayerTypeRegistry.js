/**
 * LayerTypeRegistry — runtime accessor for layer-type plugins.
 *
 * All layer types are discovered from `plugins/core/layertypes/` at
 * startup/build (see API/updateTools.js → updateLayerTypes) and emitted as the
 * generated `src/pre/layertypes.js`. This module is the single runtime entry
 * point that map/globe dispatch code uses to resolve a `layerObj.type` to its
 * renderer implementation and declared capabilities — it contains zero
 * hardcoded type ids.
 *
 * Generated shape (src/pre/layertypes.js):
 *   layerTypeModules  = { [typeId]: { map, globe: { cesium, lithosphere }, … } }
 *   layerTypeConfigs  = { [typeId]: <manifest> }
 *   layerTypeSettings = { [typeId]: <parsed settings.json> }
 *
 * @module LayerTypeRegistry
 */

let _cache = null

function _load() {
    if (_cache) return _cache
    try {
        _cache = require('../../../pre/layertypes')
    } catch (e) {
        console.warn(
            'LayerTypeRegistry: could not load generated layertypes.js',
            e
        )
        _cache = {}
    }
    return _cache
}

const LayerTypeRegistry = {
    /** Renderer modules for a type: { map, globe: { cesium, lithosphere }, … } */
    get(typeId) {
        return _load().layerTypeModules?.[typeId]
    },
    /** Per-engine globe renderer module for a type, e.g. getGlobe('tile','cesium'). */
    getGlobe(typeId, engine) {
        return _load().layerTypeModules?.[typeId]?.globe?.[engine]
    },
    /** Full plugin manifest for a type. */
    getConfig(typeId) {
        return _load().layerTypeConfigs?.[typeId]
    },
    /** Declarative runtime-settings schema (parsed settings.json), if any. */
    getSettings(typeId) {
        return _load().layerTypeSettings?.[typeId]
    },
    /** Declared capabilities object for a type (renderers, time, filtering…). */
    capabilities(typeId) {
        return _load().layerTypeConfigs?.[typeId]?.capabilities || {}
    },
    /** True if a plugin owns this type id. */
    has(typeId) {
        return !!_load().layerTypeModules?.[typeId]
    },
    /** All registered manifests, keyed by typeId. */
    all() {
        return _load().layerTypeConfigs || {}
    },
}

export default LayerTypeRegistry
