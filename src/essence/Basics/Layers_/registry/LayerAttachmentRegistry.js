/**
 * LayerAttachmentRegistry — runtime accessor for layer-attachment plugins.
 *
 * Layer attachments are host-scoped sub-renderables (labels, pairings,
 * models, image overlays, path gradients, …). They are discovered from
 * `plugins/core/layerattachments/` and emitted as the generated
 * `src/pre/layerattachments.js`. This module mirrors LayerTypeRegistry and is
 * the single runtime entry point for attachment render/lifecycle dispatch.
 *
 * Generated shape (src/pre/layerattachments.js):
 *   layerAttachmentModules  = { [attachmentId]: { map, globe: { … }, … } }
 *   layerAttachmentConfigs  = { [attachmentId]: <manifest> }
 *   layerAttachmentSettings = { [attachmentId]: <parsed settings.json> }
 *
 * @module LayerAttachmentRegistry
 */

let _cache = null

function _load() {
    if (_cache) return _cache
    try {
        _cache = require('../../../../pre/layerattachments')
    } catch (e) {
        console.warn(
            'LayerAttachmentRegistry: could not load generated layerattachments.js',
            e
        )
        _cache = {}
    }
    return _cache
}

const LayerAttachmentRegistry = {
    /** Renderer modules for an attachment. */
    get(attachmentId) {
        return _load().layerAttachmentModules?.[attachmentId]
    },
    /**
     * The attachment's operation module.
     *
     * An attachment is one renderable that may straddle both engines (an
     * uncertainty ellipse is a map overlay AND two globe layers), so unlike a
     * layer type it declares a single module (`paths.plugin`) rather than one
     * per surface.
     */
    module(attachmentId) {
        const mods = _load().layerAttachmentModules?.[attachmentId]
        return mods?.plugin || null
    },
    /** True if this attachment draws anything on the 2D map at all. */
    rendersOnMap(attachmentId) {
        return this.capabilities(attachmentId).renderers?.map !== false
    },
    /** Full plugin manifest for an attachment. */
    getConfig(attachmentId) {
        return _load().layerAttachmentConfigs?.[attachmentId]
    },
    /** Declarative runtime-settings schema (parsed settings.json), if any. */
    getSettings(attachmentId) {
        return _load().layerAttachmentSettings?.[attachmentId]
    },
    /** Declared capabilities object for an attachment. */
    capabilities(attachmentId) {
        return _load().layerAttachmentConfigs?.[attachmentId]?.capabilities || {}
    },
    /** True if a plugin owns this attachment id. */
    has(attachmentId) {
        return !!_load().layerAttachmentModules?.[attachmentId]
    },
    /** Attachment ids applicable to a given host layer type. */
    forLayerType(layerType) {
        const configs = _load().layerAttachmentConfigs || {}
        return Object.keys(configs).filter((id) => {
            const applicable = configs[id].applicableLayerTypes
            return !applicable || applicable.includes(layerType)
        })
    },
    /** All registered manifests, keyed by attachmentId. */
    all() {
        return _load().layerAttachmentConfigs || {}
    },
}

export default LayerAttachmentRegistry
