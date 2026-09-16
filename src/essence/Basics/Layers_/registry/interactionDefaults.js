/**
 * How a layer type's declared interactions become pipeline ids and settings.
 *
 * `capabilities.defaultInteractions` accepts two forms per event, so a type that
 * ships an interaction can also say how it should be configured — the mirror of
 * `defaultAttachments`:
 *
 *   "defaultInteractions": {
 *       "click": ["identify:popup"],                              // ids only
 *       "hover": { "wind:report": { "speedProp": "windSpeed" } }   // with settings
 *   }
 *
 * Object key order is the pipeline order, exactly as the array's is. Settings
 * are resolved into the interaction's own `configPath` (layer settings on top)
 * by the InteractionRunner, so an interaction reads `ctx.config` and never knows
 * which of the two wrote it.
 *
 * @module interactionDefaults
 */

import {
    asConfig,
    mergeDeclaredConfig,
    resolveDeclaredReferences,
} from './declaredConfig'

/**
 * Split a `defaultInteractions` declaration into pipeline ids and settings.
 *
 * @param {*} declared - the type's `capabilities.defaultInteractions`
 * @returns {{ids: object|null, settings: object}} ids keyed by event, settings by
 *   interaction id. `ids` is null when the type declares none, which is what
 *   `resolveLayerInteractions` treats as "no type defaults at all".
 */
export function normalizeDefaultInteractions(declared) {
    if (asConfig(declared) == null) return { ids: null, settings: {} }

    const ids = {}
    const settings = {}
    for (const [event, forEvent] of Object.entries(declared)) {
        if (Array.isArray(forEvent)) {
            ids[event] = forEvent.filter((id) => typeof id === 'string')
            continue
        }
        if (asConfig(forEvent) == null) {
            ids[event] = []
            continue
        }
        ids[event] = Object.keys(forEvent)
        for (const [id, config] of Object.entries(forEvent)) {
            const valid = asConfig(config)
            if (valid != null) settings[id] = valid
        }
    }
    return { ids, settings }
}

/**
 * An interaction's effective settings: the layer's own over the type's declared.
 *
 * A declared value may be a `$`-reference to a field of the layer
 * (`"$variables.windStation.speedProp"`), read off the layer being interacted
 * with, so a fact the admin answers on the type's own form isn't typed again.
 *
 * @param {object|null} own - the layer's subtree at the interaction's configPath
 * @param {object|null} declared - what the layer's type declared for this id
 * @param {object|null} [layerObj] - the layer, for `$`-references
 * @returns {object|null}
 */
export function resolveInteractionConfig(own, declared, layerObj) {
    return mergeDeclaredConfig(
        own,
        resolveDeclaredReferences(asConfig(declared), layerObj)
    )
}
