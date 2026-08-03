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
        _cache = require('../../../../pre/layertypes')
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
    /**
     * Declarative answers to the questions core must ask while iterating or
     * partitioning ALL layers, where calling a per-layer hook would be
     * backwards (core would have to call every layer to learn which ones to
     * call). Everything else is an operation on the type's renderer module.
     */
    /** True for a type that organizes the layer tree but draws nothing (header). */
    isStructural(typeId) {
        return this.capabilities(typeId).structural === true
    },
    /**
     * How this type participates in 2D map draw order:
     *   'raster'  ordered by z-index only (tile, data, vectortile)
     *   'overlay' ordered by insertion: must be removed and re-added
     *   false     not map-ordered (globe-only types, video, velocity)
     */
    mapStacking(typeId) {
        return this.capabilities(typeId).map?.stacking ?? false
    },
    /** True if reordering this type also needs a cache clear + redraw (image). */
    redrawsOnReorder(typeId) {
        return this.capabilities(typeId).map?.redrawOnReorder === true
    },
    /**
     * True if core waits for this type's map layer to finish loading before
     * the map counts as loaded. False for types that are never loaded on the 2D
     * map (globe-only) or that render progressively with no load event.
     */
    tracksMapLoad(typeId) {
        return this.capabilities(typeId).map?.tracksLoad !== false
    },
    /**
     * True if refreshing this type's data means rebuilding its map layer.
     * False for types that re-request in place (tile params) or hold no
     * fetched data at all.
     */
    refreshesByRemake(typeId) {
        return this.capabilities(typeId).map?.refreshByRemake === true
    },
    /**
     * Which TiTiler endpoint this type wants when its url is a STAC collection:
     * 'tiles' (raster tiles), 'terrain' (elevation tiles) or 'preview' (a single
     * image, the default).
     */
    stacEndpoint(typeId) {
        return this.capabilities(typeId).map?.stacEndpoint || 'preview'
    },
    /**
     * True if this type can report when data exists over time, which is what the
     * time bar's availability histogram is built from. Core must know this while
     * iterating every layer, before it involves any of them, so it is declared
     * (`capabilities.time.histogram`) rather than asked per layer.
     */
    providesTimeHistogram(typeId) {
        return this.capabilities(typeId).time?.histogram === true
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
