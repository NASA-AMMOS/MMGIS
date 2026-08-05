/**
 * InteractionRunner — composable pipeline runner for layer interactions.
 *
 * All configuration (preamble, postamble, suppression, kind mappings) is
 * read from the generated src/pre/interactions.js at runtime. This module
 * contains zero hardcoded interaction IDs — everything is data-driven
 * from plugin.json manifests via updateInteractions().
 *
 * @module InteractionRunner
 */

import { resolveInteractionConfig } from '../Layers_/registry/interactionDefaults'
import refreshLayer from '../Layers_/lifecycle/refresh'
import acquire from '../Layers_/lifecycle/acquire'

let _cachedModule = null

function _loadGenerated() {
    if (_cachedModule) return _cachedModule
    try {
        _cachedModule = require('../../../pre/interactions')
    } catch (e) {
        console.warn(
            'InteractionRunner: could not load generated interactions.js',
            e
        )
        _cachedModule = {}
    }
    return _cachedModule
}

function _defaultConfig() {
    const gen = _loadGenerated()
    return {
        clickPreamble: gen.CLICK_PREAMBLE || [],
        clickPostamble: gen.CLICK_POSTAMBLE || [],
        hoverDefaults: gen.HOVER_DEFAULTS || [],
        mouseoutDefaults: gen.MOUSEOUT_DEFAULTS || [],
        suppressionMap: gen.SUPPRESSION_MAP || {},
        kindPipelines: gen.KIND_PIPELINES || {},
        applicableLayerTypes: gen.APPLICABLE_LAYER_TYPES || {},
        configPaths: gen.INTERACTION_CONFIG_PATHS || {},
    }
}

// The value at a dotted path, or null.
function _getIn(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? null : o[k]), obj)
}

/**
 * An interaction's own settings on the layer being interacted with.
 *
 * An interaction that declares `configPath` (`variables.interactions.sonify`)
 * is configured per layer like an attachment is, so core reads that subtree and
 * hands it over as `ctx.config` — the plugin needn't know where its settings
 * live, and nothing else has to guess either.
 *
 * A layer type that ships an interaction may also declare that interaction's
 * settings (`capabilities.defaultInteractions.<event>.<id>`), which the caller
 * passes as `ctx.typeInteractionConfigs`: the type knows the property names it
 * just fetched, and the layer's own settings sit on top of them field by field.
 */
function configForInteraction(id, ctx, config) {
    const path = config?.configPaths?.[id]
    const own = path == null ? null : (_getIn(ctx?.layerData, path) ?? null)
    return resolveInteractionConfig(
        own,
        ctx?.typeInteractionConfigs?.[id],
        ctx?.layerData
    )
}

/**
 * Drop interactions that don't apply to the layer being interacted with.
 *
 * `applicableLayerTypes` is a manifest declaration, so it is enforced here
 * rather than trusted: a mission config (or a `kind` preset, or a type's
 * `defaultInteractions`) can name an interaction the interaction itself says it
 * doesn't handle, and running it anyway means a plugin written for vector
 * features gets handed, say, a tile layer.
 *
 * Applicability is inherited: a type that `extends` vector is applicable
 * wherever vector is, or it would inherit vector's surfaces while silently
 * losing its interactions. The caller passes the chain because this module
 * stays free of the layer registries.
 *
 * @param {string[]} ids
 * @param {string[]} [layerTypeChain] - [type, parentType?]; omitted ⇒ no filtering
 * @param {object} config
 * @returns {string[]}
 */
function filterApplicable(ids, layerTypeChain, config) {
    if (!Array.isArray(layerTypeChain) || layerTypeChain.length === 0) return ids
    return ids.filter((id) => {
        const applicable = config.applicableLayerTypes?.[id]
        if (!applicable) return true
        if (layerTypeChain.some((t) => applicable.includes(t))) return true
        console.warn(
            `Interaction '${id}' is not applicable to layer type '${layerTypeChain[0]}' (it declares ${applicable.join(
                ', '
            )}), skipping`
        )
        return false
    })
}

/**
 * Translate a legacy "kind" string to an interactions config object.
 * Returns only the variable part — defaults are added by runInteractions().
 *
 * @param {string} kind
 * @param {object} [config] - Override config (for testing)
 * @returns {{ click: string[], hover: string[], mouseout: string[] }}
 */
function kindToInteractions(kind, config) {
    if (!config) config = _defaultConfig()
    return {
        click: config.kindPipelines[kind] || [],
        hover: [],
        mouseout: [],
    }
}

/**
 * Resolve a layer's event pipelines.
 *
 * Precedence (lowest → highest): layer-type manifest default interactions →
 * the legacy per-layer `kind` pipeline → the layer's explicit `interactions`.
 * `typeDefaults` are the ids from the layer type's
 * `capabilities.defaultInteractions` — `LayerTypeRegistry.defaultInteractions()`
 * normalizes the two manifest forms and the caller passes the `ids` half, so
 * this module never reads a manifest itself. Its `settings` half rides on
 * `ctx.typeInteractionConfigs` instead (see `configForInteraction`).
 *
 * @param {object} layerData
 * @param {object} [config] - Override config (for testing)
 * @param {object} [typeDefaults] - Layer-type default interaction ids, e.g.
 *   { click: string[], hover: string[], mouseout: string[] }
 * @returns {{ click: string[], hover: string[], mouseout: string[] }}
 */
function resolveLayerInteractions(layerData, config, typeDefaults) {
    const legacy = kindToInteractions(layerData.kind || 'none', config)
    let base = legacy
    if (typeDefaults) {
        base = { click: [], hover: [], mouseout: [], ...typeDefaults }
        // A non-empty legacy kind pipeline is more specific than a type-wide
        // default, so it wins per event; empty legacy events keep the default.
        for (const ev of ['click', 'hover', 'mouseout']) {
            if (legacy[ev] && legacy[ev].length) base[ev] = legacy[ev]
        }
    }
    return layerData.interactions
        ? { ...base, ...layerData.interactions }
        : base
}

/**
 * Build the full pipeline by wrapping user interactions with defaults.
 * For click: preamble + userPipeline + postamble (with suppression).
 * For hover/mouseout: defaults + userPipeline.
 * Other event types pass through without wrapping.
 *
 * Interactions that declare `applicableLayerTypes` are dropped when the layer's
 * type (or the type it extends) isn't among them — including from the preamble
 * and postamble, which are otherwise always applied.
 *
 * @param {string[]} userIds - User-configured interaction IDs
 * @param {string} eventType - Event type (click, hover, mouseout)
 * @param {object} [config] - Override config (for testing)
 * @param {string[]} [layerTypeChain] - [type, parentType?]; omitted ⇒ no filtering
 */
function buildFullPipeline(userIds, eventType, config, layerTypeChain) {
    if (!config) config = _defaultConfig()
    const applicable = (ids) => filterApplicable(ids, layerTypeChain, config)

    if (eventType === 'click') {
        const toSuppress = new Set()
        for (const id of userIds) {
            const suppresses = config.suppressionMap[id]
            if (suppresses) {
                for (const s of suppresses) toSuppress.add(s)
            }
        }
        const postamble =
            toSuppress.size > 0
                ? config.clickPostamble.filter((id) => !toSuppress.has(id))
                : config.clickPostamble
        return applicable([
            ...config.clickPreamble,
            ...userIds,
            ...postamble,
        ])
    }

    if (eventType === 'hover') {
        return applicable([...config.hoverDefaults, ...userIds])
    }

    if (eventType === 'mouseout') {
        return applicable([...config.mouseoutDefaults, ...userIds])
    }

    return applicable(userIds)
}

/**
 * Run an ordered pipeline of interaction handlers.
 * For click events, wraps the provided IDs with default preamble/postamble.
 *
 * @param {string[]} interactionIds - User-configured interaction IDs (variable part)
 * @param {object} ctx - Shared InteractionContext object (must include eventType).
 *   `ctx.layerTypeChain` ([type, parentType?]) enables applicability filtering.
 * @param {object} [options] - Handler map OR { handlers, config } for testing.
 *   When omitted, loads from the generated src/pre/interactions.js.
 */
async function runInteractions(interactionIds, ctx, options) {
    let handlers, config

    if (!options) {
        // Production: load everything from the generated file
        const gen = _loadGenerated()
        handlers = gen.interactionHandlers || {}
        config = _defaultConfig()
    } else if (options.handlers) {
        // Test mode: explicit handlers + config
        handlers = options.handlers
        config = options.config || {
            clickPreamble: [],
            clickPostamble: [],
            hoverDefaults: [],
            mouseoutDefaults: [],
            suppressionMap: {},
            kindPipelines: {},
        }
    } else {
        // Legacy: plain handlers map, no wrapping
        handlers = options
        config = null
    }

    const fullPipeline = config
        ? buildFullPipeline(
              interactionIds,
              ctx.eventType || 'click',
              config,
              ctx.layerTypeChain
          )
        : interactionIds

    // Every interaction may ask for its layer to be re-acquired (it may have
    // just written to the backend the layer reads from), without knowing
    // `Map_.refreshLayer`'s internal signature.
    if (typeof ctx.refreshLayer !== 'function')
        ctx.refreshLayer = () => refreshLayer(ctx.layerData || ctx.layerName)

    // And may need a second layer of the mission as an input — its data, not
    // its rendered state.
    if (typeof ctx.acquire !== 'function') ctx.acquire = acquire

    for (const id of fullPipeline) {
        const handler = handlers[id]
        if (!handler) {
            console.warn(`Unknown interaction '${id}', skipping`)
            continue
        }
        // Set unconditionally: the ctx is shared down the pipeline, so an
        // interaction with no settings of its own must not be handed the
        // previous interaction's.
        if (config) ctx.config = configForInteraction(id, ctx, config)
        await handler.use(ctx)
        if (ctx.stop) break
    }
}

// For tests: reset the cached module to force reload
function _resetCache() {
    _cachedModule = null
}

// Support both CommonJS (Node tests) and ES module (webpack) usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runInteractions,
        kindToInteractions,
        resolveLayerInteractions,
        buildFullPipeline,
        filterApplicable,
        configForInteraction,
        _resetCache,
    }
}

export {
    runInteractions,
    kindToInteractions,
    resolveLayerInteractions,
    buildFullPipeline,
    filterApplicable,
    configForInteraction,
    _resetCache,
}
