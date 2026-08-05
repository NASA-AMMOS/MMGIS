/**
 * How an `extends` layer type's surfaces combine with its parent's.
 *
 * Kept out of LayerTypeRegistry, which pulls in the generated registries, so
 * the inheritance rules are testable on their own.
 *
 * @module typeInheritance
 */

function _isModule(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** A bare function is sugar for `{ main: fn }` (as LayerInterface has it). */
function _phases(op) {
    if (typeof op === 'function') return { main: op }
    return _isModule(op) ? op : null
}

/** The child's function, handed the parent's as one extra last argument. */
function _withInherited(childFn, parentFn) {
    return function (...args) {
        const inherited = (...override) =>
            typeof parentFn === 'function'
                ? parentFn(...(override.length > 0 ? override : args))
                : undefined
        return childFn(...args, inherited)
    }
}

/**
 * One operation the child redeclared, over the parent's.
 *
 * Phases combine (declaring `main` keeps the parent's `after`), and each phase
 * the child wrote is handed the parent's implementation of that same phase as a
 * last argument, so overriding can extend rather than only replace:
 *
 *     normalize(layerObj, ctx, inherited) {
 *         inherited()               // the parent's normalize, same arguments
 *         layerObj.mine = true
 *     }
 *
 * `inherited(...args)` calls with your arguments unless you pass your own, and
 * is a no-op returning `undefined` when the parent has nothing for that phase —
 * so a child needn't know whether its parent implemented it.
 *
 * @param {*} parentOp
 * @param {*} childOp
 * @returns {*}
 */
export function inheritOp(parentOp, childOp) {
    const parent = _phases(parentOp) || {}

    // A bare function stays a bare function unless the parent had phases
    // around it to keep — an operation's shape is otherwise the child's.
    if (typeof childOp === 'function') {
        const wrapped = _withInherited(childOp, parent.main)
        const otherPhases = Object.keys(parent).filter((p) => p !== 'main')
        return otherPhases.length > 0
            ? { ...parent, main: wrapped }
            : wrapped
    }
    if (!_isModule(childOp)) return childOp

    const merged = { ...parent }
    for (const [phase, fn] of Object.entries(childOp)) {
        merged[phase] =
            typeof fn === 'function' ? _withInherited(fn, parent[phase]) : fn
    }
    return merged
}

/**
 * A parent surface module with the child's operations over it.
 *
 * Per operation rather than per surface: declaring `config` to add a
 * `normalize` must not silently drop the parent's `expand`, since "write only
 * what differs" is the whole reason to extend. Each operation the child does
 * name is combined with the parent's by {@link inheritOp}, which keeps the
 * phases the child didn't write and hands it the parent's implementation.
 *
 * @param {*} parent - the parent's module for one surface
 * @param {*} own - the child's, if it declared one
 * @returns {*}
 */
export function mergeSurface(parent, own) {
    if (own === undefined) return parent
    if (!_isModule(parent) || !_isModule(own)) return own

    const merged = { ...parent, ...own }
    // Every operation the child declares is wrapped, including one the parent
    // doesn't have: `inherited()` is then a no-op, so a child needn't know
    // which of its parent's operations exist to call one safely.
    for (const op of Object.keys(own)) merged[op] = inheritOp(parent[op], own[op])
    return merged
}

/**
 * A child type's effective surfaces: everything its parent has, with its own
 * operations over it. `globe` is keyed by engine, so it merges one level deeper.
 *
 * @param {object|null} parent - the parent's own modules, by surface
 * @param {object|null} own - the child's own modules, by surface
 * @returns {object|null}
 */
export function mergeSurfaces(parent, own) {
    if (parent == null) return own == null ? null : own
    const effective = {}
    for (const surface of new Set([
        ...Object.keys(parent),
        ...Object.keys(own || {}),
    ])) {
        // `globe` is a map of engines rather than a surface module; it is
        // merged an engine at a time below.
        if (surface === 'globe') continue
        effective[surface] = mergeSurface(parent[surface], own?.[surface])
    }

    if (_isModule(parent.globe) || _isModule(own?.globe)) {
        effective.globe = {}
        for (const engine of new Set([
            ...Object.keys(parent.globe || {}),
            ...Object.keys(own?.globe || {}),
        ]))
            effective.globe[engine] = mergeSurface(
                parent.globe?.[engine],
                own?.globe?.[engine]
            )
    }
    return effective
}
