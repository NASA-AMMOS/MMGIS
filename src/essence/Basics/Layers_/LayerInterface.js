/**
 * LayerInterface — the layer-type plugin renderer contract + dispatcher.
 *
 * Every built-in layer type is plugin-backed. A plugin exposes one renderer
 * module per surface it supports:
 *   - map:   plugins/core/layertypes/<Type>/map/<type>.js
 *   - globe: plugins/core/layertypes/<Type>/globe/<engine>/<type>.js
 *
 * Both surfaces speak the SAME operation vocabulary (7 canonical operations),
 * so a plugin author learns one interface and it reads identically on map and
 * globe. Only the core defaults differ per surface.
 *
 * ── Operations (identical on map & globe) ────────────────────────────────
 *   load          acquire/produce the layer's data (async). Runs every time
 *                 data is (re)acquired: initial make, refresh interval, time
 *                 requery, dynamic-extent reload — NOT once-per-layer.
 *   make          build the engine layer from data + register it. REQUIRED.
 *   destroy       tear the layer down. Optional — core provides a default.
 *   setOpacity    apply opacity. Optional — core owns the policy; a plugin
 *                 supplies an applicator only where the engine lacks a uniform
 *                 opacity primitive (e.g. Cesium imagery-alpha vs entity-show).
 *   setVisibility show/hide. Optional — same ownership rule as setOpacity.
 *   setStyle      dynamic restyle / render-param change (color maps, rescale,
 *                 feature styles, COG params). Usually no core default.
 *   timeChange    react to the time bar moving. Core default = reload; a plugin
 *                 may override to update the existing layer in place. The ctx
 *                 carries `currentTime` (see Map_/GlobeRenderer dispatch).
 *
 * ── Phases (every operation) ─────────────────────────────────────────────
 *   before → main → after
 *   `main` is the operation body; providing `main` replaces the core default.
 *   `before`/`after` always wrap whatever runs in `main` (plugin or default).
 *   `make` additionally has `afterCommit`, which runs AFTER the make-lock
 *   releases (see Map_.makeLayer) — used by Vector to trigger filtering, which
 *   bails while the lock is held.
 *
 * ── Shorthand ────────────────────────────────────────────────────────────
 *   A bare function is sugar for `{ main: fn }`:
 *       export default { make(layerObj, ctx) { … } }
 *   is identical to
 *       export default { make: { main(layerObj, ctx) { … } } }
 *   so the 95% one-line case stays a one-liner; opt into phases only when
 *   needed.
 *
 * @typedef {Object} LayerTypeOperation
 * @property {Function} [before]      Runs before `main`/core default.
 * @property {Function} [main]        Operation body; replaces the core default.
 * @property {Function} [after]       Runs after `main`/core default.
 * @property {Function} [afterCommit] make-only: runs after the make-lock frees.
 *
 * @typedef {(Function|LayerTypeOperation)} LayerTypeOpDef
 *
 * @typedef {Object} LayerTypeModule
 * @property {LayerTypeOpDef} [load]
 * @property {LayerTypeOpDef} make               REQUIRED.
 * @property {LayerTypeOpDef} [destroy]
 * @property {LayerTypeOpDef} [setOpacity]
 * @property {LayerTypeOpDef} [setVisibility]
 * @property {LayerTypeOpDef} [setStyle]
 * @property {LayerTypeOpDef} [timeChange]
 *
 * @module LayerInterface
 */

/** Canonical operation names, in lifecycle order. */
export const LAYER_OPS = [
    'load',
    'make',
    'destroy',
    'setOpacity',
    'setVisibility',
    'setStyle',
    'timeChange',
]

/** Phase names valid on every operation. */
export const OP_PHASES = ['before', 'main', 'after']

/** `make` alone gets a post-lock phase (see Map_.makeLayer). */
export const MAKE_EXTRA_PHASES = ['afterCommit']

/**
 * Normalize an operation definition (bare fn OR phase object) into a plain
 * phase object. `null`/`undefined` → null. A bare function becomes `{ main }`.
 * @param {LayerTypeOpDef} def
 * @returns {LayerTypeOperation|null}
 */
export function normalizeOp(def) {
    if (def == null) return null
    if (typeof def === 'function') return { main: def }
    if (typeof def === 'object') return def
    return null
}

/**
 * Resolve a single phase function for an op on a surface module.
 * @param {LayerTypeModule} surfaceModule  A map module or a globe-engine module.
 * @param {string} opName
 * @param {string} phaseName
 * @returns {Function|null}
 */
export function getPhase(surfaceModule, opName, phaseName) {
    if (!surfaceModule) return null
    const op = normalizeOp(surfaceModule[opName])
    const fn = op && op[phaseName]
    return typeof fn === 'function' ? fn : null
}

/** True if the module defines any part of `opName`. */
export function hasOp(surfaceModule, opName) {
    return !!(surfaceModule && normalizeOp(surfaceModule[opName]))
}

/**
 * Run an operation's `before → (main ?? coreDefault) → after` pipeline.
 *
 * `make`'s `afterCommit` is deliberately NOT run here: it must fire after the
 * caller's make-lock releases, so Map_.makeLayer drives that phase itself via
 * getPhase(). All other ops are fully handled by this runner.
 *
 * @param {LayerTypeModule} surfaceModule
 * @param {string} opName
 * @param {Array} args              Arguments spread into each phase function.
 * @param {Object} [opts]
 * @param {Function} [opts.coreDefault]  Fallback used when no plugin `main`.
 * @returns {Promise<*>}            The result of `main`/coreDefault.
 */
export async function run(surfaceModule, opName, args = [], opts = {}) {
    const before = getPhase(surfaceModule, opName, 'before')
    const main = getPhase(surfaceModule, opName, 'main')
    const after = getPhase(surfaceModule, opName, 'after')

    if (before) await before(...args)

    let result
    if (main) result = await main(...args)
    else if (typeof opts.coreDefault === 'function')
        result = await opts.coreDefault(...args)

    if (after) await after(...args)

    return result
}

/**
 * Synchronous variant of {@link run}.
 *
 * Both engines run their layer operations synchronously (Leaflet always; Cesium
 * /LithoSphere add/remove/show/opacity are synchronous scene mutations), and
 * callers rely on deterministic ordering: they read state right after dispatch
 * (map setLayerOpacity) or perform core bookkeeping right after (GlobeRenderer
 * deletes its layer record after `destroy`). The async `run` defers `main` onto
 * a microtask whenever a `before` phase exists, which would reorder `main` after
 * that core cleanup. `runSync` runs `before → (main ?? coreDefault) → after`
 * inline so `main` is never deferred. A phase may still return a Promise for its
 * own async work; like the pre-existing globe dispatch we don't await it.
 *
 * @param {LayerTypeModule} surfaceModule
 * @param {string} opName
 * @param {Array} args
 * @param {Object} [opts]
 * @param {Function} [opts.coreDefault]  Fallback used when no plugin `main`.
 * @returns {*}                          The result of `main`/coreDefault.
 */
export function runSync(surfaceModule, opName, args = [], opts = {}) {
    const before = getPhase(surfaceModule, opName, 'before')
    const main = getPhase(surfaceModule, opName, 'main')
    const after = getPhase(surfaceModule, opName, 'after')

    if (before) before(...args)

    let result
    if (main) result = main(...args)
    else if (typeof opts.coreDefault === 'function')
        result = opts.coreDefault(...args)

    if (after) after(...args)

    return result
}

export default {
    LAYER_OPS,
    OP_PHASES,
    MAKE_EXTRA_PHASES,
    normalizeOp,
    getPhase,
    hasOp,
    run,
    runSync,
}
