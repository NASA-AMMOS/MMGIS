import $ from 'jquery'
import LayerInterface from '../interface/LayerInterface'
import LayerAttachmentRegistry from '../registry/LayerAttachmentRegistry'

/**
 * Show or hide one of a layer's attachments.
 *
 * What "show" means is the attachment's own business — a label layer draws
 * itself, a model is a globe layer, uncertainty ellipses are three engine
 * layers at once — so the attachment plugin owns it and core's default (add to
 * / remove from the 2D map) covers the plain case.
 *
 * @param {string} hostName          UUID name of the layer the attachment hangs off.
 * @param {string} attachmentName    Key of the attachment on that layer.
 * @param {boolean} visible
 * @param {Object} [opts]
 * @param {boolean} [opts.order]     Reassert the attachment's z-index after showing.
 * @param {boolean} [opts.opacity]   Reapply the attachment's opacity after showing.
 */
export function setAttachmentVisibility(
    L_,
    hostName,
    attachmentName,
    visible,
    opts = {}
) {
    const attachment = L_.layers.attachments[hostName]?.[attachmentName]
    if (!attachment) return

    const ctx = {
        hostName,
        attachmentName,
        visible,
        globeOnly: opts.globeOnly === true,
        // Both are no-ops unless the caller asked for them: initial visibility
        // deliberately neither reorders nor re-applies opacity.
        applyOrder: () => {
            if (opts.order !== true) return
            if (typeof attachment.layer?.setZIndex !== 'function') return
            attachment.layer.setZIndex(
                L_._layersOrdered.length +
                    1 -
                    L_._layersOrdered.indexOf(hostName)
            )
        },
        applyOpacity: () => {
            if (opts.opacity !== true) return
            L_.setSublayerOpacity(hostName, attachmentName)
        },
    }

    LayerInterface.runSync(
        LayerAttachmentRegistry.module(attachment.type),
        'setVisibility',
        [attachment, ctx],
        {
            coreDefault: () => {
                if (!visible) {
                    L_.Map_.rmNotNull(attachment.layer)
                    return
                }
                L_.Map_.map.addLayer(attachment.layer)
                ctx.applyOrder()
                ctx.applyOpacity()
            },
        }
    )
}

export function _refreshAnnotationEvents(L_) {
    // Add annotation click events since onEachFeatureDefault doesn't apply to popups
    $('.mmgisAnnotation').off('click')
    $('.mmgisAnnotation').on('click', function () {
        const layerName = $(this).attr('layerId')
        const layerCode = $(this).attr('layer')
        const layer = L_.layers.layer[layerName]._layers[layerCode]
        L_.Map_.featureDefaultClick(layer.feature, layer, {
            latlng: layer._latlng,
        })
    })
}

// If opacity is null, reinforces opacities
export function setSublayerOpacity(L_, layerName, sublayerName, opacity) {
    layerName = L_.asLayerUUID(layerName)

    const sublayers = L_.layers.attachments[layerName] || {}
    const sublayer = sublayers[sublayerName]

    if (opacity == null) opacity = sublayer?.opacity

    if (sublayer && sublayer.opacity != null) {
        sublayer.opacity = opacity
        // Most attachments are a map layer whose own opacity was already set
        // with the host's; only those drawing outside one (image overlays are
        // DOM elements) need to do something here.
        LayerInterface.runSync(
            LayerAttachmentRegistry.module(sublayer.type),
            'setOpacity',
            [
                sublayer,
                opacity,
                {
                    hostName: layerName,
                    attachmentName: sublayerName,
                    source: 'attachment',
                },
            ]
        )
    }
}

export function toggleSublayer(L_, layerName, sublayerName) {
    layerName = L_.asLayerUUID(layerName)

    const sublayers = L_.layers.attachments[layerName] || {}
    const sublayer = sublayers[sublayerName]
    if (sublayer) {
        const visible = sublayer.on !== true
        setAttachmentVisibility(L_, layerName, sublayerName, visible, {
            order: true,
            opacity: true,
        })
        sublayer.on = visible
    }
}

// Make a layer's sublayer match the layers data again
export async function syncSublayerData(L_, layerName, onlyClear) {
    layerName = L_.asLayerUUID(layerName)

    if (
        L_.layers.layer[layerName] == null ||
        L_.layers.layer[layerName] == false
    )
        return

    try {
        let geojson = L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
        if (L_.layers.layer[layerName]._sourceGeoJSON)
            geojson = L_.layers.layer[layerName]._sourceGeoJSON

        // Now try the sublayers (if any)
        const subUpdateLayers = L_.layers.attachments[layerName]

        if (subUpdateLayers) {
            for (let sub in subUpdateLayers) {
                const attachment = subUpdateLayers[sub]
                if (attachment === false || attachment.layer == null) continue

                const ctx = {
                    hostName: layerName,
                    attachmentName: sub,
                    layerObj: L_.layers.data[layerName],
                    // Its settings, same as `make` got them: without these an
                    // attachment either stashes them itself or redraws with
                    // defaults, silently.
                    config: LayerAttachmentRegistry.configFor(
                        attachment.type,
                        L_.layers.data[layerName]
                    ),
                    geojson,
                    onlyClear: onlyClear === true,
                    zIndex:
                        L_._layersOrdered.length +
                        1 -
                        L_._layersOrdered.indexOf(layerName),
                }

                // The host's data changed: rebuild the attachment from it.
                // Core's default covers any attachment whose layer takes
                // GeoJSON; anything an attachment draws outside that layer is
                // its own to clear and restate.
                LayerInterface.runSync(
                    LayerAttachmentRegistry.module(attachment.type),
                    'syncData',
                    [attachment, ctx],
                    {
                        coreDefault: () => {
                            attachment.layer.clearLayers()
                            if (ctx.onlyClear) return
                            if (
                                typeof attachment.layer.addDataEnhanced ===
                                'function'
                            )
                                attachment.layer.addDataEnhanced(
                                    geojson,
                                    layerName,
                                    sub,
                                    L_.Map_
                                )
                            else if (
                                typeof attachment.layer.addData === 'function'
                            )
                                attachment.layer.addData(geojson)
                        },
                    }
                )
            }
        }
    } catch (e) {
        console.log(e)
        console.warn(
            'Warning: Failed to update sublayers of layer: ' + layerName
        )
    }

    await L_.globeLithoLayerHelper(L_.layers.data[layerName], onlyClear)
}

/**
 * Where a feature's related features from other layers sit relative to it.
 *
 * Relating features across layers is an attachment's business (pairings), so
 * core asks the host's attachments rather than knowing what a relation is. The
 * first attachment that answers wins.
 *
 * @param {string} hostName    UUID name of the layer the feature belongs to.
 * @param {Object} feature     The feature to relate from.
 * @param {Object} [ctx]       Passed through to the attachment (`originOffset`).
 * @returns {{origin: number[], layerNames: string[], peers: Object[]}|false}
 */
export function getPeerFeatures(L_, hostName, feature, ctx = {}) {
    const attachments = L_.layers.attachments[hostName] || {}
    for (const id of LayerAttachmentRegistry.withOp('peerFeaturesFor')) {
        const attachment = attachments[LayerAttachmentRegistry.sublayerKey(id)]
        if (!attachment) continue
        const result = LayerInterface.runSync(
            LayerAttachmentRegistry.module(id),
            'peerFeaturesFor',
            [attachment, { ...ctx, hostName, feature }]
        )
        if (result) return result
    }
    return false
}

/**
 * How this host's attachments change the way it draws one of its own features.
 *
 * Not every attachment is a sublayer: some have nothing to add to the map and
 * instead decorate their host (a bearing turns its markers to face a heading).
 * They have no built instance to dispatch through, so core asks the attachments
 * the host's config enables, as it draws, and merges what they answer.
 *
 * @param {Object} layerObj  The host layer's config.
 * @param {Object} feature   The feature being drawn.
 * @param {Object} [ctx]     Engine-side context (`latlong`, `featureStyle`).
 * @returns {Object|null}    Merged decoration (`yaw`, `shape`, `color`, …).
 */
export function decorateFeature(L_, layerObj, feature, ctx = {}) {
    const ids = LayerAttachmentRegistry.forLayerType(layerObj?.type).filter(
        (id) =>
            LayerInterface.hasOp(
                LayerAttachmentRegistry.module(id),
                'decorateFeature'
            ) && LayerAttachmentRegistry.isEnabledOn(id, layerObj)
    )
    if (ids.length === 0) return null

    let decoration = null
    ids.forEach((id) => {
        const result = LayerInterface.runSync(
            LayerAttachmentRegistry.module(id),
            'decorateFeature',
            [
                {
                    ...ctx,
                    layerObj,
                    feature,
                    config: LayerAttachmentRegistry.configFor(id, layerObj),
                },
            ]
        )
        if (result) decoration = { ...(decoration || {}), ...result }
    })
    return decoration
}

/**
 * Draw what an attachment shows for a single, selected feature.
 *
 * An attachment can be configured to appear only for the feature the user
 * clicked (`show: 'click'`) rather than for every feature at once. What it
 * draws then is still its own to decide — core only says which feature.
 *
 * @param {string} attachmentId  The attachment being asked.
 * @param {Object} layerObj      The host layer's config.
 * @param {Object} feature       The selected feature.
 * @param {Object} [ctx]         `latlng` of the selection.
 */
export function makeFeatureAttachment(
    L_,
    attachmentId,
    layerObj,
    feature,
    ctx = {}
) {
    if (!LayerAttachmentRegistry.isEnabledOn(attachmentId, layerObj)) return
    LayerInterface.runSync(
        LayerAttachmentRegistry.module(attachmentId),
        'makeForFeature',
        [
            {
                ...ctx,
                layerObj,
                feature,
                config: LayerAttachmentRegistry.configFor(
                    attachmentId,
                    layerObj
                ),
            },
        ]
    )
}

/**
 * Nothing is selected anymore: take down whatever the attachments drew for the
 * feature that was. Deselection isn't tied to the layer that was selected, so
 * every attachment that draws per-feature is told.
 */
export function clearFeatureAttachments(L_) {
    LayerAttachmentRegistry.withOp('clearForFeature').forEach((id) => {
        LayerInterface.runSync(
            LayerAttachmentRegistry.module(id),
            'clearForFeature',
            [{}]
        )
    })
}

/**
 * What this host's attachments add to the style it is drawn with on the globe.
 *
 * The globe engine draws some decorations itself given their settings, so the
 * attachment contributes the settings rather than geometry.
 *
 * @param {Object} layerObj  The host layer's config.
 * @returns {Object}         Merged into the globe config's `style`.
 */
export function attachmentGlobeStyle(L_, layerObj) {
    const style = {}
    LayerAttachmentRegistry.forLayerType(layerObj?.type).forEach((id) => {
        if (!LayerAttachmentRegistry.isEnabledOn(id, layerObj)) return
        const result = LayerInterface.runSync(
            LayerAttachmentRegistry.module(id),
            'globeStyle',
            [
                {
                    layerObj,
                    config: LayerAttachmentRegistry.configFor(id, layerObj),
                },
            ]
        )
        if (result) Object.assign(style, result)
    })
    return style
}

/**
 * An attachment's settings changed while it was already built.
 *
 * `syncData` covers new *data*; this covers new *configuration* — an operator
 * retuning a gradient's ramp or a label's property would otherwise see nothing
 * until the layer was rebuilt. Core writes the new settings into the host's live
 * config object at the attachment's declared `configPath` (so everything that
 * reads settings, including the attachment itself, sees them) and then tells the
 * attachment. Its default is the blunt but always-correct one: rebuild the host.
 *
 * @param {string} layerName     UUID name of the host layer.
 * @param {string} attachmentId  The attachment whose settings changed.
 * @param {Object} config        The attachment's new settings subtree.
 */
export function setAttachmentConfig(L_, layerName, attachmentId, config) {
    layerName = L_.asLayerUUID(layerName)
    const layerObj = L_.layers.data[layerName]
    const path = LayerAttachmentRegistry.configPath(attachmentId)
    if (layerObj == null || path == null) return

    const prevConfig = LayerAttachmentRegistry.configFor(attachmentId, layerObj)
    const keys = path.split('.')
    let node = layerObj
    for (const key of keys.slice(0, -1)) {
        if (node[key] == null || typeof node[key] !== 'object') node[key] = {}
        node = node[key]
    }
    node[keys[keys.length - 1]] = config

    LayerInterface.runSync(
        LayerAttachmentRegistry.module(attachmentId),
        'onConfigChange',
        [
            {
                hostName: layerName,
                attachmentName:
                    LayerAttachmentRegistry.sublayerKey(attachmentId),
                layerObj,
                config,
                prevConfig,
                attachment:
                    L_.layers.attachments[layerName]?.[
                        LayerAttachmentRegistry.sublayerKey(attachmentId)
                    ] || null,
            },
        ],
        {
            // Nothing cheaper is guaranteed to be right: settings can change
            // what an attachment builds, not only how it looks.
            coreDefault: () => L_.Map_?.refreshLayer?.(layerObj),
        }
    )
}

/**
 * A layer was toggled: tell every other layer's attachments about it.
 *
 * Some attachments draw from layers other than their host (pairings connect
 * features across layers), so they have to be told when one of those layers
 * comes or goes. Core doesn't know which attachments care or which layers each
 * one watches — it notifies those declaring `onPeerToggle` and they decide.
 *
 * @param {string} layerName  UUID name of the layer that was toggled.
 * @param {boolean} on        Its new visibility.
 */
export function notifyAttachmentsOfPeerToggle(L_, layerName, on) {
    const interested = LayerAttachmentRegistry.withOp('onPeerToggle')
    if (interested.length === 0) return

    Object.keys(L_.layers.attachments).forEach((hostName) => {
        if (!L_.layers.on[hostName]) return
        const attachments = L_.layers.attachments[hostName] || {}
        interested.forEach((id) => {
            const attachment =
                attachments[LayerAttachmentRegistry.sublayerKey(id)]
            if (!attachment) return
            LayerInterface.runSync(
                LayerAttachmentRegistry.module(id),
                'onPeerToggle',
                [attachment, { hostName, layerName, on }]
            )
        })
    })
}
