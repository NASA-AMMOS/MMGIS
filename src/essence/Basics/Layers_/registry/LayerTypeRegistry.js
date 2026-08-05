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
 *
 * @module LayerTypeRegistry
 */

import { mergeSurfaces } from './typeInheritance'
import { normalizeDefaultInteractions } from './interactionDefaults'

let _cache = null
const _resolved = { modules: {}, capabilities: {}, interactions: {} }

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

/**
 * The surfaces a type may implement, in the shape dispatch code expects.
 *
 * A plugin may declare them as separate modules (`modules.map`,
 * `modules.config`, …) or as one `module` exporting the same keys — a 30-line
 * layer type should not need six files. The single module is flattened here so
 * neither shape is visible to callers.
 */
function _ownModules(typeId) {
    const mods = _load().layerTypeModules?.[typeId]
    if (mods == null) return null
    if (mods.module == null) return mods

    const single = mods.module.default || mods.module
    return {
        ...single,
        // Per-surface modules still win where a plugin mixes both shapes.
        ...Object.fromEntries(
            Object.entries(mods).filter(([key]) => key !== 'module')
        ),
        globe: { ...(single.globe || {}), ...(mods.globe || {}) },
    }
}

/**
 * `extends: "<typeId>"` — inherit every surface this type doesn't define from
 * one parent ("a tile whose url comes from elsewhere", "a vector that filters
 * differently"). Deliberately one level: a chain of layer types is a
 * refactoring hazard for no demonstrated need, and one level already removes
 * the fork-the-parent problem it exists to solve.
 */
function _effectiveModules(typeId) {
    if (typeId == null) return null
    if (_resolved.modules[typeId] !== undefined)
        return _resolved.modules[typeId]

    const own = _ownModules(typeId)
    const parentId = _load().layerTypeConfigs?.[typeId]?.extends
    const parent = parentId != null ? _ownModules(parentId) : null

    const effective = parent != null ? mergeSurfaces(parent, own) : own

    _resolved.modules[typeId] = effective || null
    return _resolved.modules[typeId]
}

const LayerTypeRegistry = {
    /** Renderer modules for a type: { map, globe: { cesium, lithosphere }, … } */
    get(typeId) {
        return _effectiveModules(typeId)
    },
    /** Per-engine globe renderer module for a type, e.g. getGlobe('tile','cesium'). */
    getGlobe(typeId, engine) {
        return _effectiveModules(typeId)?.globe?.[engine]
    },
    /** Full plugin manifest for a type. */
    getConfig(typeId) {
        return _load().layerTypeConfigs?.[typeId]
    },
    /**
     * Declared capabilities object for a type (renderers, time, filtering…),
     * with an `extends` parent's capabilities as the base so an inheriting type
     * only declares what differs.
     */
    capabilities(typeId) {
        if (_resolved.capabilities[typeId] !== undefined)
            return _resolved.capabilities[typeId]

        const config = _load().layerTypeConfigs?.[typeId]
        const own = config?.capabilities || {}
        const parent =
            config?.extends != null
                ? _load().layerTypeConfigs?.[config.extends]?.capabilities || {}
                : {}

        const merged = { ...parent, ...own }
        // One level into each group too, so overriding map.styling doesn't drop
        // an inherited map.stacking.
        for (const key of Object.keys(own)) {
            if (
                own[key] != null &&
                typeof own[key] === 'object' &&
                !Array.isArray(own[key]) &&
                parent[key] != null &&
                typeof parent[key] === 'object' &&
                !Array.isArray(parent[key])
            )
                merged[key] = { ...parent[key], ...own[key] }
        }

        _resolved.capabilities[typeId] = merged
        return merged
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
    /** True if this type has a 2D map renderer at all. */
    rendersOnMap(typeId) {
        return this.capabilities(typeId).renderers?.map !== false
    },
    /** True if this type has a 3D globe renderer at all. */
    rendersOnGlobe(typeId) {
        return this.capabilities(typeId).renderers?.globe !== false
    },
    /**
     * True if this type draws individually selectable features, i.e. a click on
     * the map may hit one of them. Core asks this while walking every on-screen
     * layer looking for what was clicked, so it is declared
     * (`capabilities.map.picking`) rather than asked per layer.
     */
    hasFeaturePicking(typeId) {
        return this.capabilities(typeId).map?.picking === true
    },
    /**
     * True if this type's individual features carry their own style, so core may
     * restyle them (selection highlight, filter dimming). Declared
     * (`capabilities.map.styling`) because core partitions all layers first.
     */
    hasFeatureStyling(typeId) {
        return this.capabilities(typeId).map?.styling === true
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
    /**
     * The interactions this type comes with, as pipeline ids per event plus the
     * settings it declared for them (`{ ids, settings }`). A type may declare
     * either form — `"click": ["identify:popup"]` or
     * `"click": { "wind:report": { "speedProp": "windSpeed" } }` — and callers
     * see the same shape either way.
     */
    defaultInteractions(typeId) {
        if (_resolved.interactions[typeId] !== undefined)
            return _resolved.interactions[typeId]

        _resolved.interactions[typeId] = normalizeDefaultInteractions(
            this.capabilities(typeId).defaultInteractions
        )
        return _resolved.interactions[typeId]
    },
    /** True if a plugin owns this type id. */
    has(typeId) {
        return !!_load().layerTypeModules?.[typeId]
    },
    /** The type this one inherits its undeclared surfaces from, if any. */
    parentOf(typeId) {
        return _load().layerTypeConfigs?.[typeId]?.extends ?? null
    },
    /**
     * This type and the one it extends, for anything matching a declared list of
     * layer types (interaction and attachment applicability): a custom type that
     * extends vector counts as vector wherever such a list is checked.
     */
    typeChain(typeId) {
        if (typeId == null) return []
        const parent = this.parentOf(typeId)
        return parent != null ? [typeId, parent] : [typeId]
    },
    /** All registered manifests, keyed by typeId. */
    all() {
        return _load().layerTypeConfigs || {}
    },
}

export default LayerTypeRegistry
