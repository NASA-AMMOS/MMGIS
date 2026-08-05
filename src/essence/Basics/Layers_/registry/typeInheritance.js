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

/**
 * A parent surface module with the child's operations over it.
 *
 * Per operation rather than per surface: declaring `config` to add a
 * `normalize` must not silently drop the parent's `expand`, since "write only
 * what differs" is the whole reason to extend. An operation is whatever the
 * child declared for that key — a bare function or a `{ before, main, after }`
 * phase object — so the child owns each operation it names and inherits the
 * rest.
 *
 * @param {*} parent - the parent's module for one surface
 * @param {*} own - the child's, if it declared one
 * @returns {*}
 */
export function mergeSurface(parent, own) {
    if (own === undefined) return parent
    if (!_isModule(parent) || !_isModule(own)) return own
    return { ...parent, ...own }
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
    ]))
        effective[surface] = mergeSurface(parent[surface], own?.[surface])

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
