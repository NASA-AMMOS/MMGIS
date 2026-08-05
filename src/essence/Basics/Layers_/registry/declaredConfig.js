/**
 * Merging a layer's own plugin settings over what its layer type declared.
 *
 * A feature is often a layer type plus an attachment plus an interaction, and
 * the type is the plugin that knows how the other two should be configured — so
 * it declares `capabilities.defaultAttachments` / `defaultInteractions`, and
 * core resolves those into each plugin's own `configPath`. Both families merge
 * by the same rules, which live here, free of the registries' generated
 * imports, so they are testable on their own.
 *
 * @module declaredConfig
 */

/**
 * Whether a layer's field is empty rather than answered.
 *
 * Configure writes `''` into a row an admin never filled in, which would
 * otherwise beat the type's declared value and leave the plugin with no
 * property name at all. `false` and `0` are answers, so only nullish and the
 * empty string count as empty.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isEmptyField(value) {
    return value == null || value === ''
}

/**
 * The settings a type declares for one plugin, or null if it declares none.
 *
 * @param {*} declared - the whole `defaultAttachments`/`defaultInteractions`-style map
 * @param {string} id
 * @returns {object|null}
 */
export function declaredConfigFor(declared, id) {
    if (declared == null || typeof declared !== 'object') return null
    return asConfig(declared[id])
}

/** A declaration is settings only if it is a plain object; `{}` is valid. */
export function asConfig(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null
}

// The value at a dotted path on a layer, or undefined. Local rather than F_'s
// so this module stays importable without the map's globals.
function _getIn(obj, path) {
    return path
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/**
 * A declared value that is a reference to a field of the host layer.
 *
 * A type declares its attachment's and interaction's settings because it is the
 * plugin that knows them — but some of them are the admin's answer on this
 * layer, not a constant the manifest can hold (which property holds the wind
 * speed, say). `"$variables.windStation.speedProp"` reads that field of the
 * layer, so the fact is configured once, on the type's own form, and the type
 * still owns which of its fields the other plugin gets. `"$$literal"` is an
 * escape for a value that really does start with a `$`.
 *
 * A reference the layer can't answer drops its key entirely, so the plugin's own
 * `const { speedProp = 'speed' } = ctx.config || {}` still applies — which an
 * explicit null would defeat.
 */
function _resolveValue(value, layerObj) {
    if (Array.isArray(value))
        return value.map((entry) => _resolveValue(entry, layerObj))
    if (asConfig(value) != null) return resolveDeclaredReferences(value, layerObj)
    if (typeof value !== 'string' || !value.startsWith('$')) return value
    if (value.startsWith('$$')) return value.slice(1)
    return _getIn(layerObj, value.slice(1))
}

/**
 * A type's declared settings with its `$`-references read off the host layer.
 *
 * @param {object|null} declared
 * @param {object|null} layerObj
 * @returns {object|null}
 */
export function resolveDeclaredReferences(declared, layerObj) {
    if (asConfig(declared) == null) return declared
    return Object.fromEntries(
        Object.entries(declared)
            .map(([key, value]) => [key, _resolveValue(value, layerObj)])
            .filter(([, value]) => value !== undefined)
    )
}

/**
 * A layer's own settings on top of what its type declared.
 *
 * Field by field, so an admin changing one thing doesn't lose the rest of what
 * the type came with — and so a layer can opt out of a type's attachment with
 * nothing but `enabled: false`.
 *
 * @param {object|null} own - the layer's subtree at the plugin's configPath
 * @param {object|null} declared - the type's declared settings
 * @returns {object|null}
 */
export function mergeDeclaredConfig(own, declared) {
    if (declared == null) return own == null ? null : own
    if (own == null) return { ...declared }

    const answered = Object.fromEntries(
        Object.entries(own).filter(
            ([key, value]) => !(isEmptyField(value) && key in declared)
        )
    )
    return { ...declared, ...answered }
}
