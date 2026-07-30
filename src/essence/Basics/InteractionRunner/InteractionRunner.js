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
    }
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
 * `typeDefaults` come from the layer type's `capabilities.defaultInteractions`
 * and are passed in by the caller (which owns the LayerTypeRegistry) so this
 * module stays dependency-free.
 *
 * @param {object} layerData
 * @param {object} [config] - Override config (for testing)
 * @param {object} [typeDefaults] - Layer-type default interactions, e.g.
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
 * @param {string[]} userIds - User-configured interaction IDs
 * @param {string} eventType - Event type (click, hover, mouseout)
 * @param {object} [config] - Override config (for testing)
 */
function buildFullPipeline(userIds, eventType, config) {
    if (!config) config = _defaultConfig()

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
        return [...config.clickPreamble, ...userIds, ...postamble]
    }

    if (eventType === 'hover') {
        return [...config.hoverDefaults, ...userIds]
    }

    if (eventType === 'mouseout') {
        return [...config.mouseoutDefaults, ...userIds]
    }

    return userIds
}

/**
 * Run an ordered pipeline of interaction handlers.
 * For click events, wraps the provided IDs with default preamble/postamble.
 *
 * @param {string[]} interactionIds - User-configured interaction IDs (variable part)
 * @param {object} ctx - Shared InteractionContext object (must include eventType)
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
        ? buildFullPipeline(interactionIds, ctx.eventType || 'click', config)
        : interactionIds

    for (const id of fullPipeline) {
        const handler = handlers[id]
        if (!handler) {
            console.warn(`Unknown interaction '${id}', skipping`)
            continue
        }
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
        _resetCache,
    }
}

export {
    runInteractions,
    kindToInteractions,
    resolveLayerInteractions,
    buildFullPipeline,
    _resetCache,
}
