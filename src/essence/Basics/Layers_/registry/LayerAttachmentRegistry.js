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

import F_ from '../../Formulae_/Formulae_'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from './LayerTypeRegistry'

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
        return (
            _load().layerAttachmentConfigs?.[attachmentId]?.capabilities || {}
        )
    },
    /** True if a plugin owns this attachment id. */
    has(attachmentId) {
        return !!_load().layerAttachmentModules?.[attachmentId]
    },
    /**
     * Attachment ids applicable to a given host layer type.
     *
     * An attachment that names its hosts also applies to a type that `extends`
     * one of them: a type inheriting vector's surfaces would otherwise inherit
     * its filtering and picking but silently lose its labels and pairings.
     */
    forLayerType(layerType) {
        const configs = _load().layerAttachmentConfigs || {}
        const parentType = LayerTypeRegistry.parentOf(layerType)
        return Object.keys(configs).filter((id) => {
            const applicable = configs[id].applicableLayerTypes
            return (
                !applicable ||
                applicable.includes(layerType) ||
                (parentType != null && applicable.includes(parentType))
            )
        })
    },
    /**
     * Where in a host layer's config this attachment is configured, e.g.
     * `variables.markerAttachments.image`. Declared rather than inferred: an
     * attachment's id, its storage key and its config key are all allowed to
     * differ (`image_overlays` is configured as `markerAttachments.image`), and
     * everything that has to find an attachment's settings — core, the plugin
     * itself, the Configure page — needs the same answer.
     */
    configPath(attachmentId) {
        return this.getConfig(attachmentId)?.configPath || null
    },
    /** This attachment's slice of a host layer's config, if it has one. */
    configFor(attachmentId, layerObj) {
        const path = this.configPath(attachmentId)
        if (path == null || layerObj == null) return null
        return F_.getIn(layerObj, path, null)
    },
    /**
     * Whether a host layer asks for this attachment at all. Configured but
     * without `enabled` counts as enabled — the key's presence is the request.
     */
    isEnabledOn(attachmentId, layerObj) {
        const config = this.configFor(attachmentId, layerObj)
        if (config == null) return false
        return config.enabled === true || config.enabled == null
    },
    /**
     * True if this attachment is a renderable of its own, rather than a change
     * to how its host draws itself (a bearing turns its host's markers and has
     * nothing to add to the host's list of attachments).
     */
    buildsSublayer(attachmentId) {
        return this.capabilities(attachmentId).host?.decoratesHost !== true
    },
    /**
     * Attachment ids applicable to a host layer type, in the order they are
     * built and listed on the host. That order is also their render order
     * (bottom on top), which is why it is declared rather than incidental.
     */
    orderedFor(layerType) {
        return this.forLayerType(layerType)
            .filter((id) => this.buildsSublayer(id))
            .sort((a, b) => {
                const oa = this.capabilities(a).host?.order
                const ob = this.capabilities(b).host?.order
                return (
                    (oa == null ? Infinity : oa) -
                        (ob == null ? Infinity : ob) || a.localeCompare(b)
                )
            })
    },
    /**
     * The key this attachment is stored under on its host
     * (`L_.layers.attachments[host][key]`). Defaults to the attachmentId; an
     * attachment declares `capabilities.host.sublayerKey` only where the two
     * legitimately differ (`model` is stored as `models`).
     */
    sublayerKey(attachmentId) {
        return this.capabilities(attachmentId).host?.sublayerKey || attachmentId
    },
    /**
     * True if this attachment decorates its siblings and so must be built after
     * them — it is handed what has been built so far as `ctx.siblings`.
     */
    buildsAfterSiblings(attachmentId) {
        return (
            this.capabilities(attachmentId).host?.buildsAfterSiblings === true
        )
    },
    /** Attachment ids whose module declares `opName`. */
    withOp(opName) {
        const mods = _load().layerAttachmentModules || {}
        return Object.keys(mods).filter((id) =>
            LayerInterface.hasOp(mods[id]?.plugin, opName)
        )
    },
    /** All registered manifests, keyed by attachmentId. */
    all() {
        return _load().layerAttachmentConfigs || {}
    },
}

export default LayerAttachmentRegistry
