import F_ from '../../Formulae_/Formulae_'
import Description from '../../UserInterface_/components/Description/Description'
import Attributions from '../../UserInterface_/components/Attributions/Attributions'
import MapRenderer from '../../Map_/MapRenderer'
import Filtering from '../Filtering/Filtering'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'

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

    const wasNeverOn = L_.layers.layer[s.name] === false

    let on //if on -> turn off //if off -> turn on
    if (L_.layers.on[s.name] === true) on = true
    else on = false

    await L_.toggleLayerHelper(
        s,
        on,
        ignoreToggleStateChange,
        null,
        skipOrderedBringToFront
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

    // Make new vector layer match time constraints
    if (
        wasNeverOn &&
        s.type === 'vector' &&
        s.time != null &&
        s.time.type === 'local' &&
        s.time.endProp != null &&
        s.controlled !== true
    ) {
        L_.timeFilterVectorLayer(
            s.name,
            new Date(s.time.start).getTime(),
            new Date(s.time.end).getTime()
        )
    }

    // Apply initial filters when layer is first turned on
    if (
        wasNeverOn &&
        s.type === 'vector' &&
        s.variables?.initialFilters &&
        s.variables.initialFilters.length > 0 &&
        Filtering.filters[s.name]
    ) {
        try {
            // Populate geojson from the now-loaded layer
            Filtering.filters[s.name].geojson =
                Filtering.filters[s.name].geojson ||
                L_.layers.layer[s.name].toGeoJSON(L_.GEOJSON_PRECISION)

            // Apply the initial filters
            Filtering.submit(s.name)
        } catch (err) {
            console.warn(
                `Filtering - Could not apply initial filters for layer: ${s.name}`,
                err
            )
        }
    }
}

export async function toggleLayerHelper(
    L_,
    s,
    on,
    ignoreToggleStateChange,
    globeOnly,
    skipOrderedBringToFront
) {
    if (s.type !== 'header') {
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
                    [
                        s,
                        {
                            ...MapRenderer.context(),
                            name: s.name,
                            visible: false,
                        },
                    ],
                    {
                        coreDefault: () =>
                            L_.Map_.rmNotNull(L_.layers.layer[s.name]),
                    }
                )
                if (L_.layers.attachments[s.name]) {
                    for (let sub in L_.layers.attachments[s.name]) {
                        switch (L_.layers.attachments[s.name][sub].type) {
                            case 'model':
                                L_.Globe_.litho.removeLayer(
                                    L_.layers.attachments[s.name][sub]
                                        .layerId
                                )
                                break
                            case 'uncertainty_ellipses':
                                L_.Globe_.litho.removeLayer(
                                    L_.layers.attachments[s.name][sub]
                                        .curtainLayerId
                                )
                                L_.Globe_.litho.removeLayer(
                                    L_.layers.attachments[s.name][sub]
                                        .clampedLayerId
                                )
                                L_.Map_.rmNotNull(
                                    L_.layers.attachments[s.name][sub].layer
                                )
                                break
                            case 'path_gradient':
                                L_.Map_.rmNotNull(
                                    L_.layers.attachments[s.name][sub].layer
                                )
                                L_.removeGradientPolyline(
                                    L_.layers.attachments[s.name][sub]
                                )
                                break
                            case 'labels':
                            case 'pairings':
                                L_.layers.attachments[s.name][
                                    sub
                                ].layer.off()
                                break
                            default:
                                L_.Map_.rmNotNull(
                                    L_.layers.attachments[s.name][sub].layer
                                )
                                break
                        }
                    }
                }
            }
            if (
                s.type === 'model' ||
                s.type === '3dtiles' ||
                (s.type === 'vectortile' && s.extrudeEnabled)
            ) {
                L_.Globe_.litho.toggleLayer(s.name, false)
            } else L_.Globe_.litho.removeLayer(s.name)
        } else {
            if (
                L_.layers.layer[s.name] &&
                globeOnly != true &&
                s.type !== 'velocity'
            ) {
                if (L_.layers.attachments[s.name]) {
                    for (let sub in L_.layers.attachments[s.name]) {
                        if (L_.layers.attachments[s.name][sub].on) {
                            switch (
                                L_.layers.attachments[s.name][sub].type
                            ) {
                                case 'model':
                                    L_.Globe_.litho.addLayer(
                                        'model',
                                        L_.layers.attachments[s.name][sub]
                                            .modelOptions
                                    )
                                    break
                                case 'uncertainty_ellipses':
                                    L_.Globe_.litho.addLayer(
                                        'curtain',
                                        L_.layers.attachments[s.name][sub]
                                            .curtainOptions
                                    )
                                    L_.Globe_.litho.addLayer(
                                        'clamped',
                                        L_.layers.attachments[s.name][sub]
                                            .clampedOptions
                                    )
                                    L_.Map_.map.addLayer(
                                        L_.layers.attachments[s.name][sub]
                                            .layer
                                    )
                                    L_.layers.attachments[s.name][
                                        sub
                                    ].layer.setZIndex(
                                        L_._layersOrdered.length +
                                            1 -
                                            L_._layersOrdered.indexOf(
                                                s.name
                                            )
                                    )
                                    break
                                case 'path_gradient':
                                    L_.Map_.map.addLayer(
                                        L_.layers.attachments[s.name][sub]
                                            .layer
                                    )
                                    L_.layers.attachments[s.name][
                                        sub
                                    ].layer.setZIndex(
                                        L_._layersOrdered.length +
                                            1 -
                                            L_._layersOrdered.indexOf(
                                                s.name
                                            )
                                    )
                                    L_.addGradientPolyline(
                                        L_.layers.attachments[s.name][sub]
                                    )
                                    break
                                case 'labels':
                                case 'pairings':
                                    if (
                                        L_.layers.attachments[s.name][sub]
                                            .layer
                                    )
                                        L_.layers.attachments[s.name][
                                            sub
                                        ].layer.on(
                                            false,
                                            L_.layers.attachments[s.name][
                                                sub
                                            ].layer
                                        )
                                    break
                                default:
                                    L_.Map_.map.addLayer(
                                        L_.layers.attachments[s.name][sub]
                                            .layer
                                    )
                                    L_.layers.attachments[s.name][
                                        sub
                                    ].layer.setZIndex(
                                        L_._layersOrdered.length +
                                            1 -
                                            L_._layersOrdered.indexOf(
                                                s.name
                                            )
                                    )
                                    break
                            }
                        }
                    }
                }

                // Show the primary layer on the 2D map via the type's map
                // plugin (setVisibility). Built-ins declare none, so the
                // core default (add to map + z-order) runs unchanged.
                LayerInterface.runSync(
                    LayerTypeRegistry.get(s.type)?.map,
                    'setVisibility',
                    [
                        s,
                        {
                            ...MapRenderer.context(),
                            name: s.name,
                            visible: true,
                        },
                    ],
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

            if (s.type === 'tile') {
                let layerUrl = L_.getUrl(s.type, s.url, s)
                let demUrl = L_.getUrl(s.type, s.demtileurl, s)
                if (s.demtileurl == undefined || s.demtileurl.length == 0)
                    demUrl = undefined

                // Detect splitColonType from original URL
                let splitColonType = undefined
                if (s.url && typeof s.url === 'string') {
                    const lowerUrl = s.url.toLowerCase()
                    if (lowerUrl.startsWith('stac-collection:')) {
                        splitColonType = 'stac-collection'
                    } else if (lowerUrl.startsWith('cog:')) {
                        splitColonType = 'COG'
                    }
                }

                L_.Globe_.litho.addLayer('tile', {
                    name: s.name,
                    order: L_._layersOrdered,
                    on: L_.layers.opacity[s.name],
                    format: s.tileformat || 'tms',
                    formatOptions: {},
                    demFormat: s.tileformat || 'tms',
                    demFormatOptions: {
                        correctSeams: s.tileformat === 'wms',
                        wmsParams: {},
                    },
                    parser: s.demparser || null,
                    path: layerUrl,
                    demPath: demUrl,
                    opacity: L_.layers.opacity[s.name],
                    minZoom: s.minZoom,
                    maxZoom: s.maxNativeZoom,
                    //boundingBox: s.boundingBox,
                    time: s.time,
                    // COG parameters for TiTiler layers
                    splitColonType: splitColonType,
                    cogTransform: s.cogTransform,
                    cogMin: s.cogMin,
                    cogMax: s.cogMax,
                    currentCogMin: s.currentCogMin,
                    currentCogMax: s.currentCogMax,
                    cogColormap: s.cogColormap,
                    cogExpression: s.cogExpression,
                    currentCogExpression: s.currentCogExpression,
                })
            } else if (s.type === 'vectortile' && s.extrudeEnabled) {
                if (L_.Globe_.litho.hasLayer(s.name)) {
                    L_.Globe_.litho.toggleLayer(s.name, true)
                } else {
                    let vtUrl = L_.getUrl(s.type, s.url, s)
                    L_.Globe_.litho.addLayer('vectortile', {
                        name: s.name,
                        path: vtUrl,
                        opacity: L_.layers.opacity[s.name],
                        vtLayer:
                            s.extrudeVtLayer ||
                            (s.style?.vtLayer
                                ? Object.keys(s.style.vtLayer)[0]
                                : 'building'),
                        extrudeHeightProperty:
                            s.extrudeHeightProperty || 'render_height',
                        extrudeDefaultHeight: s.extrudeDefaultHeight ?? 0,
                        extrudeBaseProperty: s.extrudeBaseProperty || null,
                        extrudeColor: s.extrudeColor || '#cccccc',
                        extrudeOverrideFeatureColor:
                            s.extrudeOverrideFeatureColor || false,
                        extrudeOpacity: s.extrudeOpacity ?? 0.9,
                        minZoom: s.minZoom,
                        maxZoom: s.maxNativeZoom,
                    })
                }
            } else if (s.type === 'data') {
            } else if (s.type === 'model') {
                if (L_.Globe_.litho.hasLayer(s.name)) {
                    L_.Globe_.litho.toggleLayer(s.name, true)
                } else {
                    let modelUrl = s.url
                    if (!F_.isUrlAbsolute(modelUrl))
                        modelUrl = L_.missionPath + modelUrl
                    L_.Globe_.litho.addLayer('model', {
                        name: s.name,
                        order: 1,
                        on: true,
                        path: modelUrl,
                        opacity: s.initialOpacity,
                        position: {
                            longitude: s.position?.longitude || 0,
                            latitude: s.position?.latitude || 0,
                            elevation: s.position?.elevation || 0,
                        },
                        scale: s.scale || 1,
                        rotation: {
                            // y-up is away from planet center. x is pitch, y is yaw, z is roll
                            x: s.rotation?.x || 0,
                            y: s.rotation?.y || 0,
                            z: s.rotation?.z || 0,
                        },
                    })
                }
            } else if (s.type === 'velocity') {
                if (['streamlines', 'particles'].includes(s.kind)) {
                    L_.Map_.rmNotNull(L_.layers.layer[s.name])
                }
                await L_.Map_.makeLayer(s, true, null, null, true)
                Description.updateInfo()
                L_.Map_.map.addLayer(L_.layers.layer[s.name])
                L_.layers.layer[s.name].setZIndex(
                    L_._layersOrdered.length +
                        1 -
                        L_._layersOrdered.indexOf(s.name)
                )
            } else {
                let hadToMake = false
                if (
                    L_.layers.layer[s.name] === false &&
                    globeOnly != true
                ) {
                    await L_.Map_.makeLayer(s, true, null, null, true)
                    Description.updateInfo()
                    hadToMake = true
                }
                if (L_.layers.layer[s.name]) {
                    if (globeOnly != true) {
                        if (!hadToMake) {
                            // Refresh annotation popups
                            if (L_.layers.layer[s.name]._layers)
                                Object.keys(
                                    L_.layers.layer[s.name]._layers
                                ).forEach((key) => {
                                    const l =
                                        L_.layers.layer[s.name]._layers[key]
                                    if (l._isAnnotation) {
                                        L_.layers.layer[s.name]._layers[
                                            key
                                        ] = L_.createAnnotation(
                                            l._annotationParams.feature,
                                            l._annotationParams.className,
                                            l._annotationParams.layerId,
                                            l._annotationParams.id1
                                        )
                                    }
                                })
                        }
                        L_.Map_.map.addLayer(L_.layers.layer[s.name])
                        L_.layers.layer[s.name].setZIndex(
                            L_._layersOrdered.length +
                                1 -
                                L_._layersOrdered.indexOf(s.name)
                        )
                    }

                    if (s.type === 'image') {
                        if (
                            L_.layers.layer[s.name].options
                                .pixelValuesToColorFn &&
                            L_.layers.layer[s.name].options
                                .pixelValuesToColorFn !== null
                        ) {
                            L_.layers.layer[s.name].clearCache()
                            L_.layers.layer[s.name].updateColors(
                                L_.layers.layer[s.name].options
                                    .pixelValuesToColorFn
                            )
                            // Redraw the layer or the image will not refresh again unless zooming in/out
                            L_.layers.layer[s.name].redraw()
                        }
                    }

                    if (s.type === 'vector') {
                        // Skip adding the parent vector layer to the 3D
                        // globe when it has a path_gradient attachment —
                        // the gradient polyline already renders the data
                        // and the default billboards would show as white
                        // artifacts.
                        let hasGradientAttachment = false
                        if (L_.layers.attachments[s.name]) {
                            for (const sub in L_.layers.attachments[
                                s.name
                            ]) {
                                if (
                                    L_.layers.attachments[s.name][sub]
                                        .type === 'path_gradient'
                                ) {
                                    hasGradientAttachment = true
                                    break
                                }
                            }
                        }
                        if (!hasGradientAttachment) {
                            L_.Globe_.litho.addLayer(
                                s.layer3dType || 'clamped',
                                {
                                    name: s.name,
                                    order: L_._layersOrdered, // Since higher order in litho is on top
                                    on: L_.layers.opacity[s.name]
                                        ? true
                                        : false,
                                    geojson: L_.layers.layer[
                                        s.name
                                    ].toGeoJSON(L_.GEOJSON_PRECISION),
                                    onClick: (feature, lnglat, layer) => {
                                        this.selectFeature(
                                            layer.name,
                                            feature
                                        )
                                    },
                                    useKeyAsHoverName: s.useKeyAsName,
                                    style: {
                                        // Prefer feature[f].properties.style values
                                        letPropertiesStyleOverride: true, // default false
                                        default: {
                                            fillColor: s.style.fillColor, //Use only rgb and hex. No css color names
                                            fillOpacity: parseFloat(
                                                s.style.fillOpacity
                                            ),
                                            color: s.style.color,
                                            weight: s.style.weight,
                                            radius: s.radius,
                                        },
                                        bearing:
                                            (s.variables?.markerAttachments
                                                ?.bearing &&
                                                s.variables
                                                    ?.markerAttachments
                                                    ?.bearing.enabled ==
                                                    null) ||
                                            s.variables?.markerAttachments
                                                ?.bearing?.enabled === true
                                                ? s.variables
                                                      .markerAttachments
                                                      .bearing
                                                : null,
                                    },
                                    opacity: L_.layers.opacity[s.name],
                                    minZoom:
                                        s.visibilitycutoff > 0
                                            ? s.visibilitycutoff
                                            : 0,
                                    maxZoom:
                                        s.visibilitycutoff < 0
                                            ? s.visibilitycutoff
                                            : 100,
                                }
                            )
                        } else if (
                            hadToMake &&
                            L_.layers.attachments[s.name]
                        ) {
                            // On first-time toggle the attachment-processing block
                            // (lines ~450-568) was skipped because the layer didn't
                            // exist yet. Defer the heavy Cesium geometry build so the
                            // UI isn't blocked on initial toggle.
                            for (const sub in L_.layers.attachments[
                                s.name
                            ]) {
                                const att =
                                    L_.layers.attachments[s.name][sub]
                                if (
                                    att.type === 'path_gradient' &&
                                    att.on &&
                                    att.cesiumGradientOptions
                                ) {
                                    setTimeout(() => {
                                        L_.addGradientPolyline(att)
                                    }, 0)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (globeOnly != true) {
        if (!ignoreToggleStateChange) {
            if (on) L_.layers.on[s.name] = false
            if (!on) L_.layers.on[s.name] = true
        }

        if (s.type === 'vector') L_._updatePairings(s.name, !on)

        if (
            !on &&
            s.type === 'vector' &&
            skipOrderedBringToFront !== true
        ) {
            L_.Map_.orderedBringToFront()
        }
        L_._refreshAnnotationEvents()

        // Toggling rereveals hidden features, so make sure they stay hidden
        if (L_.toggledOffFeatures && L_.toggledOffFeatures.length > 0) {
            L_.toggledOffFeatures.forEach((f) => {
                L_.toggleFeature(f, false)
            })
        }
    }
    // Refresh opacity
    if (s.type === 'vector') {
        L_.setLayerOpacity(s.name, L_.layers.opacity[s.name])
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
            console.warn(
                "Can't addVisible layers before Map_ is initialized."
            )
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
            (L_.layers.dataFlat[i].type === 'model' ||
                L_.layers.dataFlat[i].type === '3dtiles' ||
                L_.layers.layer[L_.layers.dataFlat[i].name] != null)
        ) {
            // Add Map layers
            if (L_.layers.layer[L_.layers.dataFlat[i].name]) {
                try {
                    if (L_.layers.attachments[L_.layers.dataFlat[i].name]) {
                        for (let s in L_.layers.attachments[
                            L_.layers.dataFlat[i].name
                        ]) {
                            const sublayer =
                                L_.layers.attachments[
                                    L_.layers.dataFlat[i].name
                                ][s]
                            if (sublayer.on) {
                                switch (sublayer.type) {
                                    case 'model':
                                        L_.Globe_.litho.addLayer(
                                            'model',
                                            sublayer.modelOptions
                                        )
                                        break
                                    case 'uncertainty_ellipses':
                                        L_.Globe_.litho.addLayer(
                                            'curtain',
                                            sublayer.curtainOptions
                                        )
                                        L_.Globe_.litho.addLayer(
                                            'clamped',
                                            sublayer.clampedOptions
                                        )
                                        map.addLayer(sublayer.layer)
                                        break
                                    case 'path_gradient':
                                        map.addLayer(sublayer.layer)
                                        L_.addGradientPolyline(sublayer)
                                        break
                                    case 'labels':
                                    case 'pairings':
                                        if (sublayer.layer)
                                            sublayer.layer.on(
                                                false,
                                                sublayer.layer
                                            )
                                        break
                                    default:
                                        map.addLayer(sublayer.layer)
                                        break
                                }
                            }
                        }
                    }
                    map.addLayer(
                        L_.layers.layer[L_.layers.dataFlat[i].name]
                    )

                    // Ensure video layers start muted when added to map
                    if (L_.layers.dataFlat[i].type === 'video') {
                        const videoLayer =
                            L_.layers.layer[L_.layers.dataFlat[i].name]
                        if (videoLayer && videoLayer.getElement) {
                            const videoElement = videoLayer.getElement()
                            if (videoElement) {
                                videoElement.muted = true
                                videoElement.setAttribute('muted', 'true')
                            }
                        }
                    }
                    // Refresh opacity
                    if (L_.layers.dataFlat[i].type === 'vector') {
                        const lname = L_.layers.dataFlat[i].name
                        setTimeout(() => {
                            L_.setLayerOpacity(
                                lname,
                                L_.layers.opacity[lname]
                            )
                        }, 300)
                    }
                } catch (e) {
                    console.log(e)
                    console.warn(
                        'Warning: Failed to add layer to map: ' +
                            L_.layers.dataFlat[i].name
                    )
                }
            }

            // Add Globe layers
            const s = L_.layers.dataFlat[i]
            // Use getUrl to properly transform STAC URLs and handle COG prefix
            let layerUrl = L_.getUrl('tile', s.url, s)
            if (
                s.type === 'tile' ||
                s.type === 'data' ||
                s.type === 'vectortile'
            ) {
                // Make sure all tile layers follow z-index order at start instead of element order
                L_.layers.layer[s.name].setZIndex(
                    L_._layersOrdered.length +
                        1 -
                        L_._layersOrdered.indexOf(s.name)
                )

                let demUrl = s.demtileurl
                if (!F_.isUrlAbsolute(demUrl))
                    demUrl = L_.missionPath + demUrl
                if (s.demtileurl == undefined) demUrl = undefined

                // Detect splitColonType from original URL
                let splitColonType = undefined
                if (s.url && typeof s.url === 'string') {
                    const lowerUrl = s.url.toLowerCase()
                    if (lowerUrl.startsWith('stac-collection:')) {
                        splitColonType = 'stac-collection'
                    } else if (lowerUrl.startsWith('cog:')) {
                        splitColonType = 'COG'
                    }
                }

                if (s.type === 'tile')
                    L_.Globe_.litho.addLayer('tile', {
                        name: s.name,
                        order: L_._layersOrdered,
                        on: L_.layers.opacity[s.name],
                        format: s.tileformat || 'tms',
                        formatOptions: {},
                        demFormat: s.tileformat || 'tms',
                        demFormatOptions: {
                            correctSeams: s.tileformat === 'wms',
                            wmsParams: {},
                        },
                        parser: s.demparser || null,
                        path: layerUrl,
                        demPath: demUrl,
                        opacity: L_.layers.opacity[s.name],
                        minZoom: s.minZoom,
                        maxZoom: s.maxNativeZoom,
                        //boundingBox: s.boundingBox,
                        time: s.time,
                        // COG parameters for TiTiler layers
                        splitColonType: splitColonType,
                        cogTransform: s.cogTransform,
                        cogMin: s.cogMin,
                        cogMax: s.cogMax,
                        currentCogMin: s.currentCogMin,
                        currentCogMax: s.currentCogMax,
                        cogColormap: s.cogColormap,
                        cogExpression: s.cogExpression,
                        currentCogExpression: s.currentCogExpression,
                    })
                else if (s.type === 'vectortile' && s.extrudeEnabled)
                    L_.Globe_.litho.addLayer('vectortile', {
                        name: s.name,
                        path: layerUrl,
                        opacity: L_.layers.opacity[s.name],
                        vtLayer:
                            s.extrudeVtLayer ||
                            (s.style?.vtLayer
                                ? Object.keys(s.style.vtLayer)[0]
                                : 'building'),
                        extrudeHeightProperty:
                            s.extrudeHeightProperty || 'render_height',
                        extrudeDefaultHeight: s.extrudeDefaultHeight ?? 0,
                        extrudeBaseProperty: s.extrudeBaseProperty || null,
                        extrudeColor: s.extrudeColor || '#cccccc',
                        extrudeOverrideFeatureColor:
                            s.extrudeOverrideFeatureColor || false,
                        extrudeOpacity: s.extrudeOpacity ?? 0.9,
                        minZoom: s.minZoom,
                        maxZoom: s.maxNativeZoom,
                    })
            } else if (s.type === 'model') {
                L_.Globe_.litho.addLayer('model', {
                    name: s.name,
                    order: L_._layersOrdered,
                    on: true,
                    path: layerUrl,
                    opacity: L_.layers.opacity[s.name],
                    position: {
                        longitude: s.position?.longitude || 0,
                        latitude: s.position?.latitude || 0,
                        elevation: s.position?.elevation || 0,
                    },
                    scale: s.scale || 1,
                    rotation: {
                        // y-up is away from planet center. x is pitch, y is yaw, z is roll
                        x: s.rotation?.x || 0,
                        y: s.rotation?.y || 0,
                        z: s.rotation?.z || 0,
                    },
                })
            } else if (s.type === '3dtiles') {
                L_.Globe_.litho.addLayer('3dtiles', {
                    name: s.name,
                    path: layerUrl,
                    opacity: L_.layers.opacity[s.name],
                    maximumScreenSpaceError:
                        s.maximumScreenSpaceError ?? 16,
                    maximumMemoryUsage: s.maximumMemoryUsage ?? 512,
                    heightOffset: s.heightOffset || 0,
                    style: s.tileStyle || null,
                })
            } else if (s.type != 'header') {
                // Skip parent vector layer in 3D when a path_gradient
                // attachment handles the rendering (avoids duplicate
                // white billboard artifacts).
                let hasGradientAttachment2 = false
                if (s.type === 'vector' && L_.layers.attachments[s.name]) {
                    for (const sub in L_.layers.attachments[s.name]) {
                        if (
                            L_.layers.attachments[s.name][sub].type ===
                            'path_gradient'
                        ) {
                            hasGradientAttachment2 = true
                            break
                        }
                    }
                }
                if (
                    !hasGradientAttachment2 &&
                    typeof L_.layers.layer[s.name].toGeoJSON === 'function'
                )
                    L_.Globe_.litho.addLayer(
                        s.type == 'vector'
                            ? s.layer3dType || 'clamped'
                            : s.type,
                        {
                            name: s.name,
                            order: L_._layersOrdered, // Since higher order in litho is on top
                            on: L_.layers.opacity[s.name] ? true : false,
                            geojson: L_.layers.layer[s.name].toGeoJSON(
                                L_.GEOJSON_PRECISION
                            ),
                            onClick: (feature, lnglat, layer) => {
                                this.selectFeature(layer.name, feature)
                            },
                            useKeyAsHoverName: s.useKeyAsName,
                            style: {
                                // Prefer feature[f].properties.style values
                                letPropertiesStyleOverride: true, // default false
                                default: {
                                    fillColor: s.style?.fillColor, //Use only rgb and hex. No css color names
                                    fillOpacity: parseFloat(
                                        s.style?.fillOpacity
                                    ),
                                    color: s.style?.color,
                                    weight: s.style?.weight,
                                    radius: s.radius,
                                },
                                bearing:
                                    (s.variables?.markerAttachments
                                        ?.bearing &&
                                        s.variables?.markerAttachments
                                            ?.bearing.enabled == null) ||
                                    s.variables?.markerAttachments?.bearing
                                        ?.enabled === true
                                        ? s.variables.markerAttachments
                                              .bearing
                                        : null,
                            },
                            opacity: L_.layers.opacity[s.name],
                            minZoom:
                                s.visibilitycutoff > 0
                                    ? s.visibilitycutoff
                                    : null,
                            maxZoom:
                                s.visibilitycutoff < 0
                                    ? s.visibilitycutoff
                                    : null,
                        }
                    )
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

        if (layerObj == null && layerDisplayName.includes('DrawTool'))
            layerObj = {
                type: 'vector',
            }

        if (layer && layer.length == null) layer = [layer]

        // vector, loaded and on
        if (
            layerObj != null &&
            layerObj.type === 'vector' &&
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
                    const sublayer =
                        L_.layers.attachments[layerName][subName]
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
                        const wasZoomVisible =
                            sublayer._zoomVisible !== false
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
