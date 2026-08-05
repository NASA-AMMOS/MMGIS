/**
 * How a layer type's declared attachments become a layer's attachment config.
 *
 * A feature is often a layer type plus an attachment plus an interaction, and
 * the type is the plugin that knows what the attachment should be — so it
 * declares `capabilities.defaultAttachments`, the mirror of the
 * `capabilities.defaultInteractions` it already had. The merge rules are shared
 * with interactions and live in `declaredConfig`.
 *
 * @module attachmentDefaults
 */

import { declaredConfigFor, mergeDeclaredConfig } from './declaredConfig'

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
    return declaredConfigFor(capabilities?.defaultAttachments, attachmentId)
}

/**
 * A layer's own attachment settings on top of what its type declared.
 *
 * @param {object|null} own - the layer's subtree at the attachment's configPath
 * @param {object|null} declared - the type's declared settings
 * @returns {object|null}
 */
export function resolveAttachmentConfig(own, declared) {
    return mergeDeclaredConfig(own, declared)
}
