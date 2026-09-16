import F_ from '../../Formulae_/Formulae_'
import MapRenderer from '../../Map_/MapRenderer'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'
import LayerAttachmentRegistry from '../registry/LayerAttachmentRegistry'

import $ from 'jquery'

export function setStyle(L_, layer, newStyle) {
    try {
        layer.setStyle(newStyle)
    } catch (err) {}
}

export function setLayerOpacity(L_, name, newOpacity) {
    newOpacity = parseFloat(newOpacity)
    if (L_.Globe_) L_.Globe_.litho.setLayerOpacity(name, newOpacity)
    let l = L_.layers.layer[name]

    // Apply opacity on the 2D map through the layer type's map plugin.
    // Built-in types declare no setOpacity, so the core default runs
    // unchanged; a plugin may override `main` or wrap it via before/after.
    const rtOpacity = LayerTypeRegistry.get(L_.layers.data[name]?.type)
    LayerInterface.runSync(
        rtOpacity?.map,
        'setOpacity',
        [
            L_.layers.data[name],
            { ...MapRenderer.context(), name, opacity: newOpacity },
        ],
        {
            coreDefault: () => {
                if (l) {
                    if (l.options.initialFillOpacity == null)
                        l.options.initialFillOpacity =
                            L_.layers.data[name]?.style?.fillOpacity != null
                                ? parseFloat(
                                      L_.layers.data[name].style.fillOpacity
                                  )
                                : 1
                    try {
                        l.setOpacity(newOpacity)
                    } catch (error) {
                        l.setStyle({
                            opacity: newOpacity,
                            fillOpacity:
                                newOpacity * l.options.initialFillOpacity,
                        })
                    }
                    $(`.leafletMarkerShape_${F_.getSafeName(name)}`).css({
                        opacity: newOpacity,
                    })

                    // The layer's attachments follow its opacity. Most are a
                    // plain map layer, so the default below covers them; one
                    // that draws itself deliberately fainter than its host owns
                    // that in its `setOpacity`.
                    const attachments = L_.layers.attachments[name] || {}
                    for (let sub in attachments) {
                        const attachment = attachments[sub]
                        if (attachment === false || attachment.layer == null)
                            continue

                        LayerInterface.runSync(
                            LayerAttachmentRegistry.module(attachment.type),
                            'setOpacity',
                            [
                                attachment,
                                newOpacity,
                                {
                                    hostName: name,
                                    attachmentName: sub,
                                    source: 'host',
                                    hostFillOpacity:
                                        l.options.initialFillOpacity,
                                },
                            ],
                            {
                                coreDefault: () => {
                                    try {
                                        attachment.layer.setOpacity(newOpacity)
                                    } catch (error) {
                                        try {
                                            attachment.layer.setStyle({
                                                opacity: newOpacity,
                                                fillOpacity:
                                                    newOpacity *
                                                    l.options
                                                        .initialFillOpacity,
                                            })
                                        } catch (error2) {}
                                    }
                                },
                            }
                        )
                    }

                    try {
                        l.options.fillOpacity =
                            newOpacity * l.options.initialFillOpacity
                        l.options.opacity = newOpacity
                        l.options.style.fillOpacity =
                            newOpacity * l.options.initialFillOpacity
                        l.options.style.opacity = newOpacity
                    } catch (error) {
                        l.options.fillOpacity =
                            newOpacity * l.options.initialFillOpacity
                        l.options.opacity = newOpacity
                    }
                }
            },
        }
    )
    L_.layers.opacity[name] = newOpacity

    if (L_.activeFeature?.layer && L_.activeFeature.layerName === name) {
        L_.highlight(L_.activeFeature.layer)
    }
}

export function getLayerOpacity(L_, name) {
    var l = L_.layers.layer[name]

    if (l == null) return 0

    var opacity
    try {
        opacity = l.options?.style.opacity
    } catch (error) {
        opacity = l.options?.opacity
    }
    return opacity
}

export function setLayerFilter(L_, name, filter, value) {
    // Clear
    if (filter === 'clear') {
        L_.layers.filters[name] = {}
        if (L_.Globe_) {
            L_.Globe_.litho.setLayerFilterEffect(name, 'brightness', 1)
            L_.Globe_.litho.setLayerFilterEffect(name, 'contrast', 1)
            L_.Globe_.litho.setLayerFilterEffect(name, 'saturation', 1)
            L_.Globe_.litho.setLayerFilterEffect(name, 'blendCode', 0)
        }
    }
    // Create a filters object for the layer if one doesn't exist
    L_.layers.filters[name] = L_.layers.filters[name] || {}

    // Set the new filter (if it's not 'clear')
    if (filter !== 'clear') L_.layers.filters[name][filter] = value

    // Mappings because litho names things differently
    const lithoBlendMappings = ['none', 'overlay', 'color']
    const lithoFilterMappings = {
        brightness: 'brightness',
        contrast: 'contrast',
        saturate: 'saturation',
        saturation: 'saturation',
    }

    // Dynamic restyle on the 2D map is dispatched as `setStyle` through the
    // layer type's map plugin. Built-in types declare no setStyle, so the
    // core default (filter-effect application) runs unchanged.
    const rtStyle = LayerTypeRegistry.get(L_.layers.data[name]?.type)
    LayerInterface.runSync(
        rtStyle?.map,
        'setStyle',
        [
            L_.layers.data[name],
            {
                ...MapRenderer.context(),
                name,
                filter,
                value,
                filters: L_.layers.filters[name],
            },
        ],
        {
            coreDefault: () => {
                if (typeof L_.layers.layer[name].updateFilter === 'function') {
                    let filterArray = []
                    // Apply filter effects
                    for (let f in L_.layers.filters[name]) {
                        filterArray.push(f + ':' + L_.layers.filters[name][f])
                        // For Globe/litho
                        if (L_.Globe_) {
                            if (f === 'mix-blend-mode') {
                                L_.Globe_.litho.setLayerFilterEffect(
                                    name,
                                    'blendCode',
                                    lithoBlendMappings.indexOf(
                                        L_.layers.filters[name][f]
                                    )
                                )
                            } else {
                                L_.Globe_.litho.setLayerFilterEffect(
                                    name,
                                    lithoFilterMappings[f],
                                    parseFloat(L_.layers.filters[name][f])
                                )
                            }
                        }
                    }
                    // For Map
                    L_.layers.layer[name].updateFilter(filterArray)
                }
            },
        }
    )
}

export function resetLayerFills(L_, onlyThisLayerName) {
    // Regular Layers
    for (let key in L_.layers.layer) {
        const s = key.split('_')
        const onId = s[1] != 'master' ? parseInt(s[1]) : s[1]

        if (onlyThisLayerName != null && onlyThisLayerName !== key) continue

        if (
            (L_.layers.layer[key] &&
                L_.layers.data[key] &&
                key.toLowerCase().indexOf('draw') === -1 &&
                LayerTypeRegistry.hasFeatureStyling(
                    L_.layers.data[key].type
                )) ||
            (s[0] === 'DrawTool' && !Number.isNaN(onId))
        ) {
            if (
                L_.layers.layer.hasOwnProperty(key) &&
                L_.layers.layer[key] != undefined &&
                L_.layers.data.hasOwnProperty(key) &&
                L_.layers.data[key].style != undefined
            ) {
                L_.layers.layer[key].eachLayer((layer) => {
                    const savedOptions = layer.options
                    const savedUseKeyAsName = layer.useKeyAsName

                    let fillColor = L_.layers.data[key].style.fillColor
                    let color = L_.layers.data[key].style.color
                    let opacity = layer.options.opacity
                    let fillOpacity = layer.options.fillOpacity
                    let weight = layer.options.weight

                    if (layer._isAnnotation) {
                        // Annotation
                        if (layer._container)
                            $(layer._container)
                                .find('.mmgisAnnotation')
                                .css(
                                    'color',
                                    layer.feature?.properties?.style
                                        ?.fillColor ||
                                        layer.options?.fillColor ||
                                        fillColor ||
                                        'white'
                                )
                    } else if (layer._isArrow) {
                        // Arrow
                        $(`.LayerArrow_${layer._idx}.mmgisArrowOutline`).css(
                            'stroke',
                            ''
                        )
                    } else {
                        L_.layers.layer[key].resetStyle(layer)
                    }

                    try {
                        layer.setStyle({
                            opacity: opacity,
                            fillOpacity: fillOpacity,
                            fillColor: layer.options.fillColor || fillColor,
                            weight: parseInt(weight),
                            color: layer.options.color || color,
                            stroke: layer.options.color || color,
                        })
                    } catch (err) {
                        if (layer._icon) layer._icon.style.filter = ''
                    }
                    layer.options = savedOptions
                    layer.useKeyAsName = savedUseKeyAsName
                })
            } else if (s[0] === 'DrawTool') {
                for (let k in L_.layers.layer[key]) {
                    if (!L_.layers.layer[key][k]) continue
                    if ('getLayers' in L_.layers.layer[key][k]) {
                        let layer = L_.layers.layer[key][k]
                        if (!layer?.feature?.properties?.arrow) {
                            // Polygons and lines
                            layer.eachLayer(function (l) {
                                setLayerStyle(l)
                            })
                        } else {
                            // Arrow
                            let layers = L_.layers.layer[key][k]._layers
                            const style =
                                L_.layers.layer[key][k].feature.properties.style
                            const color = style.color
                            layers[Object.keys(layers)[0]].setStyle({
                                color,
                            })
                            layers[Object.keys(layers)[1]].setStyle({
                                color,
                            })
                        }
                    } else if (
                        L_.layers.layer[key][k].feature?.properties?.annotation
                    ) {
                        // Annotation
                        let layer = L_.layers.layer[key][k]
                        let id =
                            '#DrawToolAnnotation_' +
                            layer.feature.properties._.file_id +
                            '_' +
                            layer.feature.properties._.id
                        $(id).css(
                            'color',
                            layer.feature.properties.style.fillColor
                        )
                    } else if ('feature' in L_.layers.layer[key][k]) {
                        // Points (that are not annotations)
                        let layer = L_.layers.layer[key][k]
                        setLayerStyle(layer)
                    }
                }

                function setLayerStyle(layer) {
                    const style = layer.feature.properties.style

                    const geoColor = F_.getIn(style, 'geologic.color', null)
                    const color =
                        geoColor != null
                            ? F_.colorCodeToColor(geoColor)
                            : style.color

                    if (typeof layer.setStyle === 'function')
                        layer.setStyle({
                            color: color,
                            stroke: color,
                        })
                    else if (layer._icon?.style) {
                        layer._icon.style.filter = 'unset'
                    }
                }
            }
        }
    }

    // Attachments that draw their host's features again (coordinate markers)
    // were highlighted alongside them, so they get told to restyle too. An
    // attachment with nothing to restore declares no `setStyle`.
    for (let hostName in L_.layers.attachments) {
        const attachments = L_.layers.attachments[hostName] || {}
        for (let attachmentName in attachments) {
            const attachment = attachments[attachmentName]
            if (!attachment) continue
            LayerInterface.runSync(
                LayerAttachmentRegistry.module(attachment.type),
                'setStyle',
                [attachment, { hostName, attachmentName, reason: 'resetFills' }]
            )
        }
    }
}
