import F_ from '../../Formulae_/Formulae_'
import Description from '../../UserInterface_/components/Description/Description'
import Attributions from '../../UserInterface_/components/Attributions/Attributions'
import MapRenderer from '../../Map_/MapRenderer'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'
import LayerAttachmentRegistry from '../registry/LayerAttachmentRegistry'

import $ from 'jquery'

//Takes in config layer obj
//Toggles a layer on and off and accounts for sublayers
//Takes in a config layer object
export async function toggleLayer(
    L_,
    s,
    skipOrderedBringToFront,
    ignoreToggleStateChange
) {
    if (s == null) return

    let on //if on -> turn off //if off -> turn on
    if (L_.layers.on[s.name] === true) on = true
    else on = false

    await L_.toggleLayerHelper(
        s,
        on,
        ignoreToggleStateChange,
        null,
        skipOrderedBringToFront,
        'toggleLayer'
    )

    Object.keys(L_._onLayerToggleSubscriptions).forEach((k) => {
        L_._onLayerToggleSubscriptions[k](s.name, !on)
    })

    Object.keys(L_._onSpecificLayerToggleSubscriptions).forEach((k) => {
        const subs = L_._onSpecificLayerToggleSubscriptions[k]
        if (subs.layer === s.name) subs.func(s.name, !on)
    })

    // Always reupdate layer infos at the end to keep them in sync
    Description.updateInfo()

    // Update attributions display
    if (typeof Attributions !== 'undefined' && Attributions.update) {
        Attributions.update()
    }

    // Deselect active feature if its layer is being turned off
    if (L_.activeFeature && L_.activeFeature.layerName === s.name && on) {
        L_.setActiveFeature(null)
    }
}

// An attachment can take over its host layer's globe rendering: a
// path_gradient draws the host's geometry itself, and adding the host on top
// would show its default billboards as white artifacts. Becomes an attachment
// capability once layer attachments are plugins.
// An attachment may BE its host's geometry drawn differently on the globe (a
// path gradient is the host line, recolored), in which case the host must not
// also be drawn there. The attachment declares that
// (capabilities.globe.suppressesHost).
function globeSuppressingAttachments(L_, layerObj) {
    const attachments = L_.layers.attachments[layerObj.name] || {}
    return Object.keys(attachments).filter(
        (sub) =>
            attachments[sub] &&
            LayerAttachmentRegistry.capabilities(attachments[sub].type).globe
                ?.suppressesHost === true
    )
}

function hasGlobeSuppressingAttachment(L_, layerObj) {
    return globeSuppressingAttachments(L_, layerObj).length > 0
}

export async function toggleLayerHelper(
    L_,
    s,
    on,
    ignoreToggleStateChange,
    globeOnly,
    skipOrderedBringToFront,
    source
) {
    // Facts about this toggle, handed to the layer type's `setVisibility` and
    // `onToggle` ops so type-specific follow-up work lives in the type.
    // `on` is the PREVIOUS state, so the layer ends up visible when !on.
    const toggleCtx = {
        name: s.name,
        visible: !on,
        wasNeverOn: L_.layers.layer[s.name] === false,
        hadToMake: false,
        globeOnly: globeOnly === true,
        source: source || 'toggleLayerHelper',
        ignoreToggleStateChange: ignoreToggleStateChange === true,
        skipOrderedBringToFront: skipOrderedBringToFront === true,
    }
    // One-time-on work (initial filters, local time windows) belongs to a full
    // user-facing toggle only; internal visibility changes (tree restore,
    // geojson reload) must not re-trigger it.
    toggleCtx.firstTimeOn =
        toggleCtx.wasNeverOn &&
        toggleCtx.visible &&
        toggleCtx.source === 'toggleLayer'

    if (!LayerTypeRegistry.isStructural(s.type)) {
        if (on) {
            if (
                L_.Map_.map.hasLayer(L_.layers.layer[s.name]) &&
                globeOnly != true
            ) {
                // Only close DrawTool Edit Panel if this is a user-initiated toggle, not a refresh
                if (!ignoreToggleStateChange) {
                    try {
                        $('.drawToolContextMenuHeaderClose').click()
                    } catch (err) {}
                }
                // Hide the primary layer on the 2D map via the type's map
                // plugin (setVisibility). Built-ins declare none, so the
                // core default (remove from map) runs unchanged.
                LayerInterface.runSync(
                    LayerTypeRegistry.get(s.type)?.map,
                    'setVisibility',
                    [s, { ...MapRenderer.context(), ...toggleCtx }],
                    {
                        coreDefault: () =>
                            L_.Map_.rmNotNull(L_.layers.layer[s.name]),
                    }
                )
                if (L_.layers.attachments[s.name]) {
                    for (let sub in L_.layers.attachments[s.name])
                        L_.setAttachmentVisibility(s.name, sub, false)
                }
            }
            // Hide on the 3D globe. Whether the globe layer is removed or kept
            // loaded and hidden is the type's globe `onToggle` decision.
            L_.Globe_.litho.onLayerToggle(s, false)
        } else {
            // Turning on: build the 2D map layer if it was never made. A
            // globe-only type (model, 3dtiles) has no map renderer to make.
            if (
                L_.layers.layer[s.name] === false &&
                globeOnly != true &&
                LayerInterface.hasOp(LayerTypeRegistry.get(s.type)?.map, 'make')
            ) {
                await L_.Map_.makeLayer(s, true, null, null, true)
                Description.updateInfo()
                toggleCtx.hadToMake = true
            }

            if (L_.layers.layer[s.name] && globeOnly != true) {
                if (L_.layers.attachments[s.name]) {
                    for (let sub in L_.layers.attachments[s.name]) {
                        if (L_.layers.attachments[s.name][sub].on)
                            L_.setAttachmentVisibility(s.name, sub, true, {
                                order: true,
                            })
                    }
                }

                if (!toggleCtx.hadToMake) {
                    // Refresh annotation popups
                    if (L_.layers.layer[s.name]._layers)
                        Object.keys(L_.layers.layer[s.name]._layers).forEach(
                            (key) => {
                                const l = L_.layers.layer[s.name]._layers[key]
                                if (l._isAnnotation) {
                                    L_.layers.layer[s.name]._layers[key] =
                                        L_.createAnnotation(
                                            l._annotationParams.feature,
                                            l._annotationParams.className,
                                            l._annotationParams.layerId,
                                            l._annotationParams.id1
                                        )
                                }
                            }
                        )
                }

                // Show the primary layer on the 2D map via the type's map
                // plugin (setVisibility). Most built-ins declare none, so the
                // core default (add to map + z-order) runs unchanged.
                await LayerInterface.run(
                    LayerTypeRegistry.get(s.type)?.map,
                    'setVisibility',
                    [s, { ...MapRenderer.context(), ...toggleCtx }],
                    {
                        coreDefault: () => {
                            L_.Map_.map.addLayer(L_.layers.layer[s.name])
                            L_.layers.layer[s.name].setZIndex(
                                L_._layersOrdered.length +
                                    1 -
                                    L_._layersOrdered.indexOf(s.name)
                            )
                        },
                    }
                )
            }

            // Show on the 3D globe: the type's globe plugin builds its own
            // engine config from this layer's config object.
            if (!hasGlobeSuppressingAttachment(L_, s)) {
                await L_.Globe_.litho.addLayerFor(s)
            } else if (toggleCtx.hadToMake) {
                // On first-time toggle the attachment-processing block above
                // was skipped because the layer didn't exist yet. Defer the
                // heavy Cesium geometry build so the UI isn't blocked.
                for (const sub of globeSuppressingAttachments(L_, s)) {
                    if (L_.layers.attachments[s.name][sub].on !== true) continue
                    setTimeout(() => {
                        L_.setAttachmentVisibility(s.name, sub, true, {
                            globeOnly: true,
                        })
                    }, 0)
                }
            }
        }
    }

    if (globeOnly != true && !ignoreToggleStateChange) {
        if (on) L_.layers.on[s.name] = false
        if (!on) L_.layers.on[s.name] = true
    }

    // The toggle is done and core's bookkeeping is settled: let the layer type
    // do its own follow-up work (re-ordering, opacity refresh, first-time-on
    // filtering). No core default — most types need nothing.
    LayerInterface.runSync(LayerTypeRegistry.get(s.type)?.map, 'onToggle', [
        s,
        { ...MapRenderer.context(), ...toggleCtx },
    ])

    // Attachments elsewhere may draw from this layer (pairings), so they get
    // told too — whatever this layer's type is.
    if (globeOnly != true)
        L_.notifyAttachmentsOfPeerToggle(s.name, toggleCtx.visible)

    if (globeOnly != true) {
        L_._refreshAnnotationEvents()

        // Toggling rereveals hidden features, so make sure they stay hidden
        if (L_.toggledOffFeatures && L_.toggledOffFeatures.length > 0) {
            L_.toggledOffFeatures.forEach((f) => {
                L_.toggleFeature(f, false)
            })
        }
    }
}

export function disableAllBut(L_, siteName, skipDisabling) {
    if (L_.layers.data.hasOwnProperty(siteName)) {
        let l
        if (skipDisabling !== true) {
            for (let i = 0; i < L_.layers.dataFlat.length; i++) {
                l = L_.layers.dataFlat[i]
                if (L_.layers.on[l.name] == true) {
                    if (l.name != 'Mars Overview') L_.toggleLayer(l)
                }
                if (L_.layers.on['Mars Overview'] === false) {
                    if (l.name === 'Mars Overview') L_.toggleLayer(l)
                }
            }
        }

        for (let n in L_._layersParent) {
            if (L_._layersParent[n] === siteName && L_.layers.data[n]) {
                l = L_.layers.data[n]
                if (
                    l.visibility === true && // initial visibility
                    L_.layers.on[l.name] === false
                ) {
                    L_.toggleLayer(l)
                }
            }
        }
    }
}

// Simply if visibility was set as true in the json,
// add the layer
// onlyTheseLayers: ['array', 'of', 'layer', 'names']
export function addVisible(L_, map_, onlyTheseLayers) {
    var map = map_
    if (map == null) {
        if (L_.Map_ == null) {
            console.warn("Can't addVisible layers before Map_ is initialized.")
            return
        }
        map = L_.Map_.map
    } else {
        map = map.map
    }
    for (var i = L_.layers.dataFlat.length - 1; i >= 0; i--) {
        if (
            (onlyTheseLayers == null ||
                onlyTheseLayers.includes(L_.layers.dataFlat[i].name)) &&
            L_.layers.on[L_.layers.dataFlat[i].name] === true &&
            // Either it has something on the map to add, or it is a
            // globe-only type (no map renderer) that still needs adding there.
            (L_.layers.layer[L_.layers.dataFlat[i].name] != null ||
                (!LayerTypeRegistry.rendersOnMap(L_.layers.dataFlat[i].type) &&
                    !LayerTypeRegistry.isStructural(
                        L_.layers.dataFlat[i].type
                    )))
        ) {
            // Add Map layers
            if (L_.layers.layer[L_.layers.dataFlat[i].name]) {
                try {
                    const hostName = L_.layers.dataFlat[i].name
                    for (const sub in L_.layers.attachments[hostName] || {}) {
                        if (L_.layers.attachments[hostName][sub].on)
                            L_.setAttachmentVisibility(hostName, sub, true)
                    }
                    map.addLayer(L_.layers.layer[L_.layers.dataFlat[i].name])

                    // Same post-toggle hook as a user toggle, flagged as the
                    // initial-visibility path so a type can tell them apart.
                    const initialLayerObj = L_.layers.dataFlat[i]
                    LayerInterface.runSync(
                        LayerTypeRegistry.get(initialLayerObj.type)?.map,
                        'onToggle',
                        [
                            initialLayerObj,
                            {
                                ...MapRenderer.context(),
                                name: initialLayerObj.name,
                                visible: true,
                                wasNeverOn: false,
                                firstTimeOn: false,
                                hadToMake: false,
                                globeOnly: false,
                                source: 'addVisible',
                            },
                        ]
                    )
                } catch (e) {
                    console.log(e)
                    console.warn(
                        'Warning: Failed to add layer to map: ' +
                            L_.layers.dataFlat[i].name
                    )
                }
            }

            const s = L_.layers.dataFlat[i]

            // Raster-stacked types are ordered by z-index (rather than by pane
            // insertion), so their z-index has to be set explicitly at start —
            // element order is not their order.
            if (
                LayerTypeRegistry.capabilities(s.type).map?.stacking ===
                'raster'
            ) {
                L_.layers.layer[s.name].setZIndex(
                    L_._layersOrdered.length +
                        1 -
                        L_._layersOrdered.indexOf(s.name)
                )
            }

            // Add Globe layers: the type's globe plugin builds its own engine
            // config from this layer's config object.
            if (!hasGlobeSuppressingAttachment(L_, s)) {
                L_.Globe_.litho.addLayerFor(s)
            }
        }
    }

    L_._refreshAnnotationEvents()
}

export function toggleFeature(L_, layer, on) {
    const display = on ? 'inherit' : 'none'
    layer._hidden = !on
    let layers = [layer]

    if (layer.hasOwnProperty('_layers')) {
        // Arrow
        const innerLayers = layer._layers
        Object.keys(innerLayers).forEach((k) => {
            layers.push(innerLayers[k])
        })
    }

    if (layer._isArrow) {
        $(`.LayerArrow_${layer._idx}`).css('display', display)
    }

    layers.forEach((l) => {
        if (l._path) {
            l._path.style.display = display
        }
        if (l._container) {
            l._container.style.display = display
        }
        if (l._icon) {
            l._icon.style.display = display
        }
    })
    L_.toggledOffFeatures = L_.toggledOffFeatures || []
    const tofIdx = L_.toggledOffFeatures.indexOf(layer)

    if (layer._hidden && tofIdx === -1) L_.toggledOffFeatures.push(layer)
    else if (!layer._hidden && tofIdx >= 0) {
        L_.toggledOffFeatures.splice(tofIdx, 1)
    }
}

export function unhideAllFeatures(L_) {
    if (L_.toggledOffFeatures) {
        for (let i = L_.toggledOffFeatures.length - 1; i >= 0; i--)
            L_.toggleFeature(L_.toggledOffFeatures[i], true)
    }
    L_.Map_.orderedBringToFront()
    L_.setActiveFeature(L_.activeFeature?.layer)
    L_._refreshAnnotationEvents()
}

/**
 *
 * @param {string[]} forceLayerNames - Enforce visibilities per layer
 */
export function enforceVisibilityCutoffs(L_, forceLayerNames) {
    const layerNames = forceLayerNames || Object.keys(L_.layers.layer)

    layerNames.forEach((layerName) => {
        const layerDisplayName = layerName
        layerName = L_.asLayerUUID(layerName)
        let layerObj = L_.layers.data[layerName]
        let layer = L_.layers.layer[layerName]

        // Draw layers are core-owned features with no layer config of their own.
        const isDrawLayer =
            layerObj == null && layerDisplayName.includes('DrawTool')
        if (isDrawLayer) layerObj = {}

        if (layer && layer.length == null) layer = [layer]

        // Per-feature zoom cutoffs only mean something for a type whose
        // features are individually addressable, and only once it is on the map.
        if (
            layerObj != null &&
            (isDrawLayer ||
                LayerTypeRegistry.hasFeatureStyling(layerObj.type)) &&
            layer &&
            (L_.layers.data[layerName]
                ? L_.Map_.map.hasLayer(L_.layers.layer[layerName])
                : true)
        ) {
            let minZoom = null
            let maxZoom = null
            if (
                layerObj.hasOwnProperty('minZoom') ||
                layerObj.hasOwnProperty('maxZoom')
            ) {
                minZoom = layerObj.minZoom != null ? layerObj.minZoom : null
                maxZoom = layerObj.maxZoom != null ? layerObj.maxZoom : null
            } else if (layerObj.hasOwnProperty('visibilitycutoff')) {
                // Backwards compatibility
                minZoom =
                    layerObj.visibilitycutoff > 0
                        ? layerObj.visibilitycutoff
                        : null
                maxZoom =
                    layerObj.visibilitycutoff < 0
                        ? layerObj.visibilitycutoff
                        : null
            }

            minZoom = minZoom != null ? minZoom : 0
            maxZoom = maxZoom != null ? maxZoom : 100

            for (let i = 0; i < layer.length; i++) {
                if (layer[i]) {
                    if (layer[i].feature) {
                        L_._setVisibilityCutoffInternal(
                            layer[i],
                            minZoom,
                            maxZoom
                        )
                        // If this is a LayerGroup with a feature (like arrows),
                        // don't process children separately - they're handled as a unit
                        if (
                            layer[i]._layers &&
                            Object.keys(layer[i]._layers).length > 0
                        ) {
                            continue
                        }
                    }
                    if (layer[i]._layers)
                        for (let layerId in layer[i]._layers) {
                            L_._setVisibilityCutoffInternal(
                                layer[i]._layers[layerId],
                                minZoom,
                                maxZoom
                            )
                        }
                }
            }

            // Enforce zoom constraints on sublayer attachments (labels, pairings, etc.)
            if (L_.layers.attachments[layerName]) {
                const currentZoom = L_.Map_.map.getZoom()
                for (let subName in L_.layers.attachments[layerName]) {
                    const sublayer = L_.layers.attachments[layerName][subName]
                    if (
                        sublayer &&
                        sublayer.minZoom != null &&
                        sublayer.maxZoom != null
                    ) {
                        const sublayerMinZoom = sublayer.minZoom
                        const sublayerMaxZoom = sublayer.maxZoom
                        const isInRange = F_.isInZoomRange(
                            sublayerMinZoom,
                            sublayerMaxZoom,
                            currentZoom
                        )

                        // Store the actual zoom visibility state separately from user preference
                        const wasZoomVisible = sublayer._zoomVisible !== false
                        sublayer._zoomVisible = isInRange

                        // Only show/hide if user has enabled this sublayer and zoom visibility changed
                        if (sublayer.on === true) {
                            if (isInRange && !wasZoomVisible) {
                                // Sublayer entered zoom range - show it
                                if (
                                    sublayer.layer &&
                                    typeof sublayer.layer.on === 'function'
                                ) {
                                    sublayer.layer.on()
                                }
                            } else if (!isInRange && wasZoomVisible) {
                                // Sublayer exited zoom range - hide it
                                if (
                                    sublayer.layer &&
                                    typeof sublayer.layer.off === 'function'
                                ) {
                                    sublayer.layer.off()
                                }
                            }
                        }
                    }
                }
            }
        }
    })
}

export function _setVisibilityCutoffInternal(L_, l, minZoom, maxZoom) {
    if (l._hidden === true) return

    let featureMinZoom = null
    let featureMaxZoom = null
    if (l.feature?.properties?.style?.minZoom != null)
        featureMinZoom = l.feature.properties.style.minZoom
    if (l.feature?.properties?.style?.maxZoom != null)
        featureMaxZoom = l.feature.properties.style.maxZoom

    const isVisible = F_.isInZoomRange(
        featureMinZoom != null ? featureMinZoom : minZoom,
        featureMaxZoom != null ? featureMaxZoom : maxZoom,
        L_.Map_.map.getZoom()
    )

    // For LayerGroups (like arrows), add/remove from map instead of setting display
    if (l._layers && Object.keys(l._layers).length > 0) {
        if (isVisible) {
            if (L_.Map_.map && !L_.Map_.map.hasLayer(l)) {
                L_.Map_.map.addLayer(l)
            }
        } else {
            if (L_.Map_.map && L_.Map_.map.hasLayer(l)) {
                L_.Map_.map.removeLayer(l)
            }
        }
        // Still handle tooltips for LayerGroups
        if (l._tooltip) {
            if (isVisible) {
                if (l._tooltip._container) {
                    l._tooltip._container.style.display = 'inherit'
                }
                if (l._tooltip.options.permanent && !l.isTooltipOpen()) {
                    l.openTooltip()
                }
            } else {
                if (l._tooltip._container) {
                    l._tooltip._container.style.display = 'none'
                }
                if (l.isTooltipOpen && l.isTooltipOpen()) {
                    l.closeTooltip()
                }
            }
        }
    } else {
        // For individual features, set display style
        if (isVisible) {
            if (l._path) l._path.style.display = 'inherit'
            if (l._container) l._container.style.display = 'inherit'
            if (l._icon) l._icon.style.display = 'inherit'

            // Show tooltip if it exists and was previously open
            if (l._tooltip) {
                if (l._tooltip._container) {
                    l._tooltip._container.style.display = 'inherit'
                }
                // Reopen tooltip if it was bound as permanent
                if (l._tooltip.options.permanent && !l.isTooltipOpen()) {
                    l.openTooltip()
                }
            }
        } else {
            if (l._path) l._path.style.display = 'none'
            if (l._container) l._container.style.display = 'none'
            if (l._icon) l._icon.style.display = 'none'

            // Hide tooltip if it exists
            if (l._tooltip) {
                if (l._tooltip._container) {
                    l._tooltip._container.style.display = 'none'
                }
                // Close tooltip if open
                if (l.isTooltipOpen && l.isTooltipOpen()) {
                    l.closeTooltip()
                }
            }
        }
    }
}
