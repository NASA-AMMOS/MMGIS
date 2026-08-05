/**
 * How a layer type's declared attachments become a layer's attachment config.
 *
 * A feature is often a layer type plus an attachment plus an interaction, and
 * the type is the plugin that knows what the attachment should be — so it
 * declares `capabilities.defaultAttachments`, the mirror of the
 * `capabilities.defaultInteractions` it already had. Kept here, free of the
 * registries' generated imports, so the resolution rules are testable on their
 * own.
 *
 * @module attachmentDefaults
 */

/**
 * The settings a type declares for one attachment, or null if it declares none.
 *
 * The declaration is an object per attachment rather than a list of ids because
 * "this type comes with rings" is only useful if it can also say how big they
 * are; `{}` means "on, with the attachment's own defaults".
 *
 * @param {object} capabilities - the type's resolved capabilities
 * @param {string} attachmentId
 * @returns {object|null}
 */
export function declaredAttachmentConfig(capabilities, attachmentId) {
    const declared = capabilities?.defaultAttachments
    if (declared == null || typeof declared !== 'object') return null
    const config = declared[attachmentId]
    return config != null && typeof config === 'object' && !Array.isArray(config)
        ? config
        : null
}

/**
 * Whether a layer's field is empty rather than answered.
 *
 * Configure writes `''` into a row an admin never filled in, which would
 * otherwise beat the type's declared value and leave the attachment with no
 * property name at all. `false` and `0` are answers, so only nullish and the
 * empty string count as empty.
 *
 * @param {*} value
 * @returns {boolean}
 */
function _isEmpty(value) {
    return value == null || value === ''
}

/**
 * A layer's own attachment settings on top of what its type declared.
 *
 * Field by field, so an admin changing one thing doesn't lose the rest of what
 * the type came with — and so a layer can opt out of a type's attachment with
 * nothing but `enabled: false`.
 *
 * @param {object|null} own - the layer's subtree at the attachment's configPath
 * @param {object|null} declared - the type's declared settings
 * @returns {object|null}
 */
export function resolveAttachmentConfig(own, declared) {
    if (declared == null) return own == null ? null : own
    if (own == null) return { ...declared }

    const answered = Object.fromEntries(
        Object.entries(own).filter(
            ([key, value]) => !(_isEmpty(value) && key in declared)
        )
    )
    return { ...declared, ...answered }
}
