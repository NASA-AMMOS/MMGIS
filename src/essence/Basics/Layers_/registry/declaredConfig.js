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
