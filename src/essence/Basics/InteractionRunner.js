/**
 * InteractionRunner — composable pipeline runner for layer interactions.
 *
 * Infrastructure interactions (select, cleanup_temp, etc.) run automatically
 * as preamble/postamble around the user-configured pipeline. Layer configs
 * only need to specify the variable part (e.g. ["info:open"]).
 *
 * @module InteractionRunner
 */

// Preamble: always runs before the user pipeline
const CLICK_PREAMBLE = ['select', 'cleanup_temp']

// Postamble: always runs after the user pipeline
const CLICK_POSTAMBLE = ['info:silent', 'viewer:update', 'search:url', 'event:notify']

// info:open is a superset of info:silent — suppress info:silent when present
const INFO_OPEN_SUPPRESSES = 'info:silent'
const INFO_OPEN_ID = 'info:open'

const DEFAULT_HOVER_PIPELINE = ['cursor:show']
const DEFAULT_MOUSEOUT_PIPELINE = ['cursor:hide']

/**
 * Variable-only click pipelines for each legacy "kind" string.
 * Infrastructure interactions are added automatically by runInteractions().
 */
const KIND_PIPELINES = {
    none: [],
    info: ['info:open'],
    waypoint: ['waypoint:image', 'waypoint:model'],
    chemistry_tool: ['chemistry:use'],
    draw_tool: ['draw:context_menu'],
    viewer_open: ['viewer:open_panel'],
}

/**
 * Translate a legacy "kind" string to an interactions config object.
 * Returns only the variable part — defaults are added by runInteractions().
 *
 * @param {string} kind
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
 * Build the full pipeline by wrapping user interactions with defaults.
 * For click events: preamble + userPipeline + postamble.
 * If the user pipeline contains info:open, info:silent is suppressed.
 * For hover/mouseout: defaults are the full pipeline (no wrapping needed).
 */
function buildFullPipeline(userIds, eventType) {
    if (eventType !== 'click') return userIds

    const hasInfoOpen = userIds.includes(INFO_OPEN_ID)
    const postamble = hasInfoOpen
        ? CLICK_POSTAMBLE.filter((id) => id !== INFO_OPEN_SUPPRESSES)
        : CLICK_POSTAMBLE

    return [...CLICK_PREAMBLE, ...userIds, ...postamble]
}

/**
 * Run an ordered pipeline of interaction handlers.
 * For click events, wraps the provided IDs with default preamble/postamble.
 *
 * @param {string[]} interactionIds - User-configured interaction IDs (variable part only)
 * @param {object} ctx - Shared InteractionContext object (must include eventType)
 * @param {object} [handlers] - Handler map (interactionId -> { use(ctx) }).
 *   When omitted, uses the generated interactionHandlers from src/pre/interactions.js.
 */
async function runInteractions(interactionIds, ctx, handlers) {
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

    const fullPipeline = buildFullPipeline(
        interactionIds,
        ctx.eventType || 'click'
    )

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

// Support both CommonJS (Node tests) and ES module (webpack) usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runInteractions,
        kindToInteractions,
        buildFullPipeline,
        KIND_PIPELINES,
        CLICK_PREAMBLE,
        CLICK_POSTAMBLE,
        DEFAULT_HOVER_PIPELINE,
        DEFAULT_MOUSEOUT_PIPELINE,
    }
}

export {
    runInteractions,
    kindToInteractions,
    buildFullPipeline,
    KIND_PIPELINES,
    CLICK_PREAMBLE,
    CLICK_POSTAMBLE,
    DEFAULT_HOVER_PIPELINE,
    DEFAULT_MOUSEOUT_PIPELINE,
}
