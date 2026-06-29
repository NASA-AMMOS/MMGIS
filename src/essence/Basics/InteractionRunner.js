/**
 * InteractionRunner — composable pipeline runner for layer interactions.
 *
 * This module provides the core runtime for the interactions plugin type:
 * - kindToInteractions(): translates legacy "kind" strings to interaction pipelines
 * - runInteractions(): executes an ordered list of interaction handlers
 *
 * @module InteractionRunner
 */

/**
 * Default click pipelines for each legacy "kind" string.
 * Each pipeline is an ordered array of interaction IDs.
 */
const KIND_PIPELINES = {
    none: [
        'select',
        'cleanup_temp',
        'info:silent',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
    info: [
        'select',
        'cleanup_temp',
        'info:open',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
    waypoint: [
        'select',
        'cleanup_temp',
        'waypoint:image',
        'waypoint:model',
        'info:silent',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
    chemistry_tool: [
        'select',
        'cleanup_temp',
        'chemistry:use',
        'info:silent',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
    draw_tool: [
        'select',
        'cleanup_temp',
        'draw:context_menu',
        'info:silent',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
    viewer_open: [
        'select',
        'cleanup_temp',
        'info:silent',
        'viewer:open_panel',
        'viewer:update',
        'search:url',
        'event:notify',
    ],
}

const DEFAULT_HOVER_PIPELINE = ['cursor:show']
const DEFAULT_MOUSEOUT_PIPELINE = ['cursor:hide']

/**
 * Translate a legacy "kind" string to an interactions config object.
 *
 * @param {string} kind - Legacy kind string (e.g. "waypoint", "info", "none")
 * @returns {{ click: string[], hover: string[], mouseout: string[] }}
 */
function kindToInteractions(kind) {
    return {
        click: KIND_PIPELINES[kind] || KIND_PIPELINES.none,
        hover: DEFAULT_HOVER_PIPELINE,
        mouseout: DEFAULT_MOUSEOUT_PIPELINE,
    }
}

/**
 * Run an ordered pipeline of interaction handlers.
 *
 * @param {string[]} interactionIds - Ordered list of interaction IDs
 * @param {object} ctx - Shared InteractionContext object
 * @param {object} [handlers] - Handler map (interactionId → { use(ctx) }).
 *   When omitted, uses the generated interactionHandlers from src/pre/interactions.js.
 */
async function runInteractions(interactionIds, ctx, handlers) {
    // Lazy-load the generated handler map when not explicitly provided.
    // This allows unit tests to pass mock handlers without importing
    // the webpack-dependent generated file.
    if (handlers === undefined) {
        try {
            const generated = require('../../pre/interactions')
            handlers = generated.interactionHandlers
        } catch (e) {
            console.warn(
                'InteractionRunner: could not load generated interactions.js',
                e
            )
            handlers = {}
        }
    }

    for (const id of interactionIds) {
        const handler = handlers[id]
        if (!handler) {
            console.warn(`Unknown interaction '${id}', skipping`)
            continue
        }
        await handler.use(ctx)
        if (ctx.stop) break
    }
}

// Support both CommonJS (Node tests) and ES module (webpack) usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runInteractions, kindToInteractions, KIND_PIPELINES }
}

export { runInteractions, kindToInteractions, KIND_PIPELINES }
