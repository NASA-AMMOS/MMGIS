import $ from 'jquery'
import F_ from '../../../../Basics/Formulae_/Formulae_'
import L_ from '../../../../Basics/Layers_/Layers_'
import LayerGeologic from '../../../../Basics/Layers_/LayerGeologic/LayerGeologic'
import Map_ from '../../../../Basics/Map_/Map_'
import Dropy from '../../../../../external/Dropy/dropy'

import './DrawTool_Geologic.css'

let DrawTool = null
const Geologic = {
    active: false,
    activeColor: null,
    activeDef: null,
    currentType: null,
    currentLayerType: null,
    currentGroupIdx: 0,
    previewSize: 159,
    // Useful to see a mapping of chars to geologic symbols, otherwise false
    fontKey: false,
    colors: [],
    patternCodes: ['K', 'C', 'M', 'R', 'B', 'DO'],
    patternColors: [],
    fillColorScheme: [
        'none',
        '#000000',
        '#ffffff',
        '#c50f0f',
        '#c56a0f',
        '#c5c50f',
        '#6ac50f',
        '#0fc50f',
        '#0fc56a',
        '#0fc5c5',
        '#0f6ac5',
        '#0f0fc5',
        '#6a0fc5',
        '#c50fc5',
        '#c50f6a',
        '#c43541',
        '#11495c',
        '#87b051',
        '#dbb658',
        '#9be0c0',
        '#8f8f82',
        '#191921',
        '#78b1c2',
        '#454f4b',
        '#f7ec88',
        '#ebdcc1',
        '#75351e',
    ],
    optionValues: {},
    invalidFeature: false,
    _initialPatterns: [],
    _lineworkReplacedLayer: [],
    _lineworkReplacementLayer: [],
    _symbolReplacedLayer: [],
    _symbolReplacementLayer: [],
    init: function (tool) {
        DrawTool = tool

        DrawTool.plugins.Geologic = {
            getUI: Geologic.getGeologicUI,
            addEvents: Geologic.addGeologicEvents,
            clear: Geologic.clearGeologic,
            custom: {
                getProperties: Geologic.getGeologicProperties,
                resetGeologic: Geologic.resetGeologic,
            },
        }

        // Make dropdown colors
        Geologic.colors = []
        F_.colorCodes.forEach((code) => {
            let color
            if (code === 'DO')
                color =
                    'linear-gradient(45deg, #FFFFFF 0%, #FFFFFF 50%, #000000 50%, #000000 100%);'
            else color = F_.colorCodeToColor(code)
            Geologic.colors.push(
                `<div class='geologicColor' style='background: ${color};' color='${code}'></div>`
            )
        })

        // Make pattern specific dropdown colors (limited set since hard to recolor)
        Geologic.patternColors = []
        Geologic.patternCodes.forEach((code) => {
            let color
            if (code === 'DO')
                color =
                    'linear-gradient(45deg, #FFFFFF 0%, #FFFFFF 50%, #000000 50%, #000000 100%);'
            else color = F_.colorCodeToColor(code)
            Geologic.patternColors.push(
                `<div class='geologicColor' style='background: ${color};' color='${code}'></div>`
            )
        })

        Geologic.fillColors = []
        Geologic.fillColorScheme.forEach((color) => {
            Geologic.fillColors.push(
                `<div class='geologicColor' style='background: ${color};' fillColor='${color}'></div>`
            )
        })
    },
    clearGeologic: function () {
        Map_.rmNotNull(Geologic._symbolReplacedLayer)
        Map_.rmNotNull(Geologic._symbolReplacementLayer)
    },
    setCurrentTypes: function () {
        // Figure out the current layer type
        // Group editing works only if all shapes are of the same type
        Geologic.currentGroupIdx = 0
        Geologic.currentLayerType = null
        Geologic.invalidFeature = false
        const styles = []
        for (let c in DrawTool.contextMenuLayers) {
            styles.push(
                DrawTool.contextMenuLayers[c].properties?.style?.geologic
            )
            const layerType = F_.getIn(
                DrawTool.contextMenuLayers[c],
                'layer.feature.geometry.type',
                null
            )

            // Return no UI if arrow or note
            if (
                F_.getIn(
                    DrawTool.contextMenuLayers[c],
                    'properties.annotation',
                    null
                ) === true ||
                F_.getIn(
                    DrawTool.contextMenuLayers[c],
                    'properties.arrow',
                    null
                ) === true
            )
                Geologic.invalidFeature = true

            if (
                Geologic.currentLayerType == null ||
                Geologic.currentLayerType === layerType
            )
                Geologic.currentLayerType = layerType
            else Geologic.currentLayerType = false
        }

        // Set the geologic type based on the layer type
        if (Geologic.currentLayerType) {
            Geologic.currentLayerType = Geologic.currentLayerType.toLowerCase()
            if (Geologic.currentLayerType.includes('polygon'))
                Geologic.currentType = 'pattern'
            else if (Geologic.currentLayerType.includes('line'))
                Geologic.currentType = 'linework'
            else if (Geologic.currentLayerType.includes('point'))
                Geologic.currentType = 'symbol'
            else Geologic.currentType = null
        }

        Geologic._initialPatterns = []
        if (Geologic.currentType === 'pattern') {
            for (let c in DrawTool.contextMenuLayers) {
                Geologic._initialPatterns[c] =
                    DrawTool.contextMenuLayers[c].layer?.options?.fillPattern ||
                    undefined
            }
        }

        // Use first shape's style as the main one
        Geologic.active = false
        Geologic.optionValues = {
            color: Geologic.currentType === 'pattern' ? 'K' : 'W',
            fillColor: 'none',
            fillOpacity: 0.5,
            size: 1,
            rotation: 0,
            repetition: 200,
            position: 'left',
        }
        styles.forEach((s) => {
            if (s != null) {
                Geologic.active = s.tag
                Geologic.activeColor = s.color || Geologic.optionValues.color
                Geologic.optionValues = {
                    color: Geologic.activeColor,
                    fillColor: s.fillColor || Geologic.optionValues.fillColor,
                    fillOpacity:
                        s.fillOpacity || Geologic.optionValues.fillOpacity,
                    size: parseFloat(s.size || Geologic.optionValues.size),
                    rotation: parseInt(s.rot || Geologic.optionValues.rotation),
                    repetition: parseInt(
                        s.rep || Geologic.optionValues.repetition
                    ),
                    position: s.pos || Geologic.optionValues.position,
                }
                return
            }
        })
    },
    getGeologicUI: function () {
        Geologic.setCurrentTypes()

        if (Geologic.invalidFeature) {
            return "<div id='geologicUnsupported'>This feature does not support geologic symbologies.</div>"
        }

        const previewType = Geologic.currentType === 'symbol' ? 'box' : 'row'
        Geologic.previewSize = Geologic.currentType === 'symbol' ? 74 : 159

        const tag = LayerGeologic.getTag(Geologic.active, Geologic.activeColor)

        // FOR DEV: Build a key -> font map
        const tempFontKey = []
        if (Geologic.fontKey)
            for (var i = 0; i < 500; ++i)
                tempFontKey.push(
                    ` ${String.fromCharCode(i)}:<span>${String.fromCharCode(
                        i
                    )}</span> `
                )

        // Restrict available options
        const displayOpts = {
            color: true, // always visible
            fillColor: false,
            fillOpacity: false,
            size: true, // always visible
            rotation: false,
            repetition: false,
            position: false,
        }
        switch (Geologic.currentType) {
            case 'pattern':
                displayOpts.fillColor = true
                displayOpts.fillOpacity = true
                break
            case 'linework':
                displayOpts.repetition = true
                displayOpts.position = true
                break
            case 'symbol':
                displayOpts.rotation = true
                break
            default:
                break
        }

        // prettier-ignore
        return [
            "<div id='drawToolContextMenuGeologic'>",
                "<div id='geologicTabs'>",
                    "<div class='geologicTab'>",
                        "<div class='geologicTabLeft'>",
                            "<div class='geologicTabSelected' id='geologicTabSelected'>",
                               Geologic.getPreview(Geologic.currentType, tag, true),
                            "</div>",
                        "</div>",
                        "<div class='geologicTabRight'>",
                            "<div class='geologicTabTop'>",
                                "<div class='geologicTabNameTitle'>",
                                    `<div class='geologicTabName'>${tag || 'None'}</div>`,
                                    `<div class='geologicTabTitle'>${Geologic.currentType}</div>`,
                                "</div>",
                                "<div class='geologicTabDesc'>No Description</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='geologicOptions'>",
                    `<div class='geologicOption${displayOpts.color ? '' : ' geologicHidden'}' id='geologicOptionColor'>`,
                        "<div>Color</div>",
                        `<div>${Dropy.construct(Geologic.currentType === 'pattern' ? Geologic.patternColors : Geologic.colors, null, Math.max(0, F_.colorCodes.indexOf(Geologic.optionValues.color)))}</div>`,
                    "</div>",
                    `<div class='geologicOption${displayOpts.fillColor ? '' : ' geologicHidden'}' id='geologicOptionFillColor'>`,
                        "<div>Back Color</div>",
                        `<div>${Dropy.construct(Geologic.fillColors, null, Math.max(0, Geologic.fillColorScheme.indexOf(Geologic.optionValues.fillColor)))}</div>`,
                    "</div>",
                    `<div class='geologicOption${displayOpts.fillOpacity ? '' : ' geologicHidden'}' id='geologicOptionFillOpacity'>`,
                        "<div>Back Opacity</div>",
                        "<div class='flexbetween'>",
                            `<div id='geologicOptionFillOpacityLabel' class='geologicSliderLabel'>(${Geologic.optionValues.fillOpacity * 100}%)</div>`,
                            `<input id='geologicOptionFillOpacityInput' class='slider2 lighter' type='range' min='0' max='100' step='10' value='${Geologic.optionValues.fillOpacity * 100}'/>`,
                        "</div>",
                    "</div>",
                    `<div class='geologicOption${displayOpts.size ? '' : ' geologicHidden'}' id='geologicOptionSize'>`,
                        "<div>Size</div>",
                        "<div class='flexbetween'>",
                            `<div id='geologicOptionSizeLabel' class='geologicSliderLabel'>(${Geologic.optionValues.size * 100}%)</div>`,
                            `<input id='geologicOptionSizeInput' class='slider2 lighter' type='range' min='25' max='200' step='25' value='${Geologic.optionValues.size * 100}'/>`,
                        "</div>",
                    "</div>",
                    `<div class='geologicOption${displayOpts.rotation ? '' : ' geologicHidden'}' id='geologicOptionRotation'>`,
                        "<div>Rotation</div>",
                        "<div class='flexbetween'>",
                            `<div id='geologicOptionRotationLabel' class='geologicSliderLabel'>(${Geologic.optionValues.rotation}deg)</div>`,
                            `<input id='geologicOptionRotationInput' class='slider2 lighter' type='range' min='0' max='360' step='1' value='${Geologic.optionValues.rotation}'/>`,
                        "</div>",
                    "</div>",
                    `<div class='geologicOption${displayOpts.repetition ? '' : ' geologicHidden'}' id='geologicOptionRepetition'>`,
                        "<div>Repetition</div>",
                        "<div class='flexbetween'>",
                            `<div id='geologicOptionRepetitionLabel' class='geologicSliderLabel'>(${Geologic.optionValues.repetition}px)</div>`,
                            `<input id='geologicOptionRepetitionInput' class='slider2 lighter' type='range' min='20' max='600' step='1' value='${Geologic.optionValues.repetition}'/>`,
                        "</div>",
                    "</div>",
                    `<div class='geologicOption${displayOpts.position ? '' : ' geologicHidden'}' id='geologicOptionPosition'>`,
                        "<div>Position</div>",
                        "<div>",
                            "<select id='geologicOptionPositionInput' class='dropdown'>",
                                `<option value='left'${Geologic.optionValues.position === 'left' ? ' selected': ''}>Left</option>`,
                                `<option value='center'${Geologic.optionValues.position === 'center' ? ' selected': ''}>Center</option>`,
                                `<option value='right'${Geologic.optionValues.position === 'right' ? ' selected': ''}>Right</option>`,
                            "</select>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='geologicSelector'>",
                    `<div id='geologicElements' class='geologicPreview_${previewType}'></div>`,
                "</div>",
                Geologic.fontKey ?
                `<div id='geologicTempFontKey'>${tempFontKey.join('\n')}</div>` : null,
            "</div>",
        ].join('\n')
    },
    addGeologicEvents: function () {
        if (Geologic.invalidFeature) return

        $('.geologicTab').on('click', function () {
            Geologic.populateElements($(this).attr('type'))
        })

        Geologic.populateElements()

        for (var l of DrawTool.contextMenuLayers) {
            if (typeof l.layer.disableEdit === 'function') {
                l.layer.disableEdit()
            }
        }

        $('#geologicSelector').css({
            height: `calc(100% - 125px - ${
                $('#geologicOptions').height() || 0
            }px)`,
        })

        Dropy.init($('#geologicOptionColor > div:last-child'), function (idx) {
            Geologic.activeColor =
                Geologic.currentType === 'pattern'
                    ? Geologic.patternCodes[idx]
                    : F_.colorCodes[idx]
            Geologic.optionValues.color = Geologic.activeColor
            Geologic.populateElements()

            Geologic.updateLayer()
        })

        Dropy.init(
            $('#geologicOptionFillColor > div:last-child'),
            function (idx) {
                Geologic.optionValues.fillColor = Geologic.fillColorScheme[idx]

                Geologic.updateLayer()
            }
        )
        $('#geologicOptionFillOpacityInput').on('input', function () {
            Geologic.optionValues.fillOpacity = parseFloat($(this).val() / 100)
            $('#geologicOptionFillOpacityLabel').html(`(${$(this).val()}%)`)

            Geologic.updateLayer()
        })
        $('#geologicOptionSizeInput').on('input', function () {
            Geologic.optionValues.size = parseFloat($(this).val() / 100)
            $('#geologicOptionSizeLabel').html(`(${$(this).val()}%)`)

            Geologic.updateLayer()
        })
        $('#geologicOptionRotationInput').on('input', function () {
            Geologic.optionValues.rotation = parseInt($(this).val())
            $('#geologicOptionRotationLabel').html(`(${$(this).val()}deg)`)

            Geologic.updateLayer()
        })

        $('#geologicOptionRepetitionInput').on('input', function () {
            Geologic.optionValues.repetition = parseInt($(this).val())
            $('#geologicOptionRepetitionLabel').html(`(${$(this).val()}px)`)

            Geologic.updateLayer()
        })

        $('#geologicOptionPositionInput').on('input', function () {
            Geologic.optionValues.position = $(this).val()

            Geologic.updateLayer()
        })
    },
    populateElements: function (type) {
        if (type) Geologic.currentType = type
        else type = Geologic.currentType

        const groups = LayerGeologic.getDefinitionGroups(type)

        const groupElms = []

        const groupCategories = []
        groups.forEach((g) => {
            groupCategories.push(F_.prettifyName(g.category))
        })
        const group = groups[Geologic.currentGroupIdx]

        const contents = [
            [
                `<div class='geologicElement' type='${type}' tag='null'>`,
                `<div class='geologicNone'>None</div>`,
                `</div>`,
            ].join('\n'),
        ]

        const activeTag = LayerGeologic.getTag(
            Geologic.active,
            Geologic.activeColor
        )

        for (let d in group.definitions) {
            let color = Geologic.currentType === 'pattern' ? 'K' : 'W'

            if (group.definitions[d].colors?.[0] === false) color = false

            if (
                group.definitions[d].colors &&
                group.definitions[d].colors.includes(Geologic.activeColor)
            )
                color = Geologic.activeColor

            const tag = LayerGeologic.getTag(
                d,
                color,
                Geologic.active,
                Geologic.activeColor
            )

            let croppedTag = tag.split('_')
            croppedTag = croppedTag[croppedTag.length - 1]
            // prettier-ignore
            contents.push([
                    `<div class='geologicElement${activeTag === tag ? ' active' : ''}' type='${type}' tag='${tag}' code='${d}' color='${color}'>`,
                        Geologic.getPreview(type,tag),
                        `<div>${croppedTag}</div>`,
                    `</div>`,
                ].join('\n'))
        }
        // prettier-ignore
        groupElms.push(
            [
                "<div class='geologicGroup'>",
                    "<div class='geologicGroupHeader'>",
                        `<div class='geologicGroupHeaderTitle'>${Dropy.construct(groupCategories, 'Categories...', Geologic.currentGroupIdx)}</div>`,
                        `<div class='geologicGroupHeaderSubtitle'>${F_.prettifyName(group.title)}</div>`,
                    "</div>",
                    "<div class='geologicGroupContentWrapper'>",
                        "<div class='geologicGroupContents'>",
                            contents.join('\n'),
                        "</div>",
                    "</div>",
                "</div>"
            ].join('\n')
        )

        // prettier-ignore
        const markup = [
            "<div>",
                groupElms.join('\n'),
            "</div>"
        ].join('\n')

        $('#geologicElements').empty()
        $('#geologicElements').html(markup)
        $('.geologicElement').on('click', function () {
            const code = $(this).attr('code')
            const color = $(this).attr('color')
            Geologic.setActive(code, color)
        })

        Dropy.init($('.geologicGroupHeaderTitle'), function (idx) {
            Geologic.currentGroupIdx = idx
            Geologic.populateElements()
        })
    },
    setActive: function (code, color) {
        if (code === 'null' || code == null || code === false)
            Geologic.active = false
        else Geologic.active = code
        Geologic.activeColor = color

        const def = LayerGeologic.getDefinition(
            Geologic.currentType,
            Geologic.active
        )

        Geologic.activeDef = def

        $('.geologicTabName').text(Geologic.active || 'None')
        $('.geologicTabTitle').text(Geologic.currentType)
        $('.geologicTabDesc').text(
            def == null ? 'No Description' : def.description
        )

        const tag = LayerGeologic.getTag(Geologic.active, Geologic.activeColor)

        $(`#geologicTabSelected`).html(
            Geologic.getPreview(Geologic.currentType, tag, true)
        )

        Geologic.lockUpdateLayer = true

        Geologic.optionValues.size = 100
        $('#geologicOptionSizeInput').val(Geologic.optionValues.size)
        $('#geologicOptionSizeInput').trigger('input')

        if (def?.style?.symbols?.[0]) {
            Geologic.optionValues.rotation = 0
            $('#geologicOptionRotationInput').val(
                Geologic.optionValues.rotation
            )
            $('#geologicOptionRotationInput').trigger('input')

            Geologic.optionValues.repetition = parseInt(
                def.style.symbols[0].rep || Geologic.optionValues.repetition
            )
            $('#geologicOptionRepetitionInput').val(
                Geologic.optionValues.repetition
            )
            $('#geologicOptionRepetitionInput').trigger('input')

            Geologic.optionValues.position =
                def.style.symbols[0].pos || Geologic.optionValues.position

            if (Geologic.optionValues.position === 'center') {
                $("#geologicOptionPositionInput > option[value='left']").prop(
                    'disabled',
                    true
                )
                $("#geologicOptionPositionInput > option[value='center']").prop(
                    'disabled',
                    false
                )
                $("#geologicOptionPositionInput > option[value='right']").prop(
                    'disabled',
                    true
                )
            } else {
                $("#geologicOptionPositionInput > option[value='left']").prop(
                    'disabled',
                    false
                )
                $("#geologicOptionPositionInput > option[value='center']").prop(
                    'disabled',
                    true
                )
                $("#geologicOptionPositionInput > option[value='right']").prop(
                    'disabled',
                    false
                )
            }
            $('#geologicOptionPositionInput').val(
                Geologic.optionValues.position
            )
            $('#geologicOptionPositionInput').trigger('input')
        }
        Geologic.lockUpdateLayer = false

        Geologic.updateLayer(def)

        // Now set active groupElement

        $('.geologicElement.active').removeClass('active')
        $(`.geologicElement[tag="${tag}"]`).addClass('active')
    },
    getPreview: function (type, tag, isMain) {
        if (tag == null) return null
        const def = LayerGeologic.getDefinition(type, tag)

        const pSize = isMain ? 100 : Geologic.previewSize

        switch (type) {
            case 'linework':
                let symbols = null
                let line = null
                let hasWhite = false
                let weight = 3
                const w = isMain ? 100 : 344
                const h = isMain ? 100 : 40
                if (def?.style?.symbols) {
                    const dups = isMain ? 1 : 2
                    weight = def.style.weight || weight
                    symbols = def.style.symbols
                        .map((s, idx) => {
                            //if (s.color.toLowerCase() === 'w') hasWhite = true
                            let color = F_.colorCodeToColor(
                                Geologic.optionValues.color
                            )
                            if (s.color && s.color.toLowerCase() === 'w') {
                                color = 'black'
                            }
                            return new Array(dups)
                                .fill(0)
                                .map(
                                    (s2, idx2) =>
                                        `<text x="${
                                            (w * (idx * dups + idx2 + 1)) /
                                                (def.style.symbols.length *
                                                    dups +
                                                    1) -
                                            s.size / 2
                                        }" y="${
                                            h / 2 +
                                            Math.floor(weight / 2) +
                                            (s.pos === 'left'
                                                ? s.size
                                                : s.pos === 'right'
                                                ? 0
                                                : s.size / 2)
                                        }" style="font-family: ${
                                            s.set
                                        }; font-size: ${
                                            s.size
                                        }px; transform-origin: center; transform: rotateZ(180deg); fill: ${color};">${
                                            s.key
                                        }</text>`
                                )
                                .join('\n')
                        })
                        .join('\n')
                }
                if (def?.style) {
                    line = `<line x1="0" y1="${h / 2}" x2="${w}" y2="${
                        h / 2
                    }" stroke="${def?.style.color || 'black'}" stroke-width="${
                        def.style.weight
                    }" stroke-dashArray="${def.style.dashArray}" />`
                }
                return [
                    `<svg viewBox="0 0 ${w} ${h}" style="background: ${
                        hasWhite ? 'black' : 'unset'
                    };">`,
                    symbols,
                    line,
                    `</svg>`,
                ].join('\n')
            case 'symbol':
                if (def?.style?.symbol)
                    return `<div style='color: black; font-size: ${
                        isMain ? 72 : 56
                    }px; line-height: ${pSize}px; text-align: center; font-family: ${
                        def.style.symbol.set
                    }; width: ${pSize}px; height: ${pSize};'>${
                        def.style.symbol.key
                    }</div>`
                return "<div class='geologicNone geologicNoneTall'>None</div>"
            default:
                const url = LayerGeologic.getUrl(type, tag)
                return url
                    ? `<div style='background-image: url(${url}); background-size: ${Geologic.previewSize}px ${Geologic.previewSize}px;'></div>`
                    : "<div class='geologicNone geologicNoneTall'>None</div>"
        }
    },
    resetGeologic: function () {
        if (Geologic.currentType === 'pattern') {
            for (let c in DrawTool.contextMenuLayers) {
                const s = DrawTool.contextMenuLayers[c].shape
                if (typeof s.setStyle === 'function') {
                    s.setStyle({
                        fillPattern: Geologic._initialPatterns[c],
                    })
                }
            }
        }

        Geologic._lineworkReplacedLayer.forEach((l) => {
            l.addTo(Map_.map)
        })
        Geologic._lineworkReplacedLayer = []
        Geologic._lineworkReplacementLayer.forEach((l) => {
            Map_.rmNotNull(l)
        })
        Geologic._lineworkReplacementLayer = []

        Geologic._symbolReplacedLayer.forEach((l) => {
            l.addTo(Map_.map)
        })
        Geologic._symbolReplacedLayer = []
        Geologic._symbolReplacementLayer.forEach((l) => {
            Map_.rmNotNull(l)
        })
        Geologic._symbolReplacementLayer = []
    },
    updateLayer: function (def) {
        if (Geologic.lockUpdateLayer) return

        def =
            def ||
            LayerGeologic.getDefinition(Geologic.currentType, Geologic.active)

        if (def == null) {
            switch (Geologic.currentType) {
                case 'pattern':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function') {
                            s.setStyle({ fillPattern: undefined })
                        }
                    }
                    break
                case 'linework':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape

                        Map_.rmNotNull(Geologic._lineworkReplacedLayer[c])

                        Geologic._lineworkReplacedLayer[c] = s
                        Map_.rmNotNull(Geologic._lineworkReplacedLayer[c])
                        delete s.feature.properties.style.geologic

                        Map_.rmNotNull(Geologic._lineworkReplacementLayer[c])
                        Geologic._lineworkReplacementLayer[c] =
                            LayerGeologic.createLinework(
                                s.feature,
                                s.feature.properties.style
                            ).addTo(Map_.map)
                    }
                    break
                case 'symbol':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape

                        Map_.rmNotNull(Geologic._symbolReplacedLayer[c])

                        Geologic._symbolReplacedLayer[c] = s
                        Map_.rmNotNull(Geologic._symbolReplacedLayer[c])

                        delete s.feature.properties.style.geologic

                        Map_.rmNotNull(Geologic._symbolReplacementLayer[c])
                        Geologic._symbolReplacementLayer[c] =
                            LayerGeologic.createSymbolMarker(
                                s.feature.geometry.coordinates[1],
                                s.feature.geometry.coordinates[0],
                                s.feature.properties.style
                            ).addTo(Map_.map)
                    }
                    break
                default:
                    break
            }
        } else {
            switch (Geologic.currentType) {
                case 'pattern':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape

                        if (typeof s.setStyle === 'function') {
                            let color = Geologic.activeColor

                            if (!(def.colors && def.colors.includes(color)))
                                color = 'K'

                            const tag = LayerGeologic.getTag(
                                Geologic.active,
                                color
                            )
                            if (tag) {
                                const fillImage = LayerGeologic.getFillPattern(
                                    LayerGeologic.getUrl(
                                        Geologic.currentType,
                                        tag
                                    ),
                                    Geologic.optionValues.size,
                                    Geologic.optionValues.fillColor[0] === '#'
                                        ? F_.hexToRGBA(
                                              Geologic.optionValues.fillColor,
                                              Geologic.optionValues.fillOpacity
                                          )
                                        : 'none',
                                    L_.Map_.map
                                )
                                s.setStyle({ fillPattern: fillImage })
                            } else s.setStyle({ fillPattern: undefined })
                        }
                    }
                    break
                case 'linework':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape
                        Geologic._lineworkReplacedLayer[c] = s
                        Map_.rmNotNull(Geologic._lineworkReplacedLayer[c])

                        const geologicStyle = Geologic.getGeologicProperties(
                            s.feature.properties.style
                        )
                        if (geologicStyle)
                            s.feature.properties.style.geologic = geologicStyle
                        else if (s.feature.properties.style.geologic)
                            delete s.feature.properties.style.geologic

                        s.feature.properties.style.dashArray =
                            def.style.dashArray || ''
                        s.feature.properties.style.weight =
                            def.style.weight ||
                            s.feature.properties.style.weight

                        Map_.rmNotNull(Geologic._lineworkReplacementLayer[c])
                        Geologic._lineworkReplacementLayer[c] =
                            LayerGeologic.createLinework(
                                s.feature,
                                s.feature.properties.style
                            ).addTo(Map_.map)
                    }
                    break
                case 'symbol':
                    for (let c in DrawTool.contextMenuLayers) {
                        const s = DrawTool.contextMenuLayers[c].shape

                        // Symbols are harder because circleMarkers and symbolMarkers can't
                        // easily go back and forth
                        // The final redraw will set everything straight again, but
                        // here we're going to hide the current marker and show a temporary
                        // marker in its place. This way i
                        Geologic._symbolReplacedLayer[c] = s
                        Map_.rmNotNull(Geologic._symbolReplacedLayer[c])

                        const geologicStyle = Geologic.getGeologicProperties(
                            s.feature.properties.style
                        )
                        if (geologicStyle)
                            s.feature.properties.style.geologic = geologicStyle
                        else if (s.feature.properties.style.geologic)
                            delete s.feature.properties.style.geologic

                        Map_.rmNotNull(Geologic._symbolReplacementLayer[c])
                        Geologic._symbolReplacementLayer[c] =
                            LayerGeologic.createSymbolMarker(
                                s.feature.geometry.coordinates[1],
                                s.feature.geometry.coordinates[0],
                                s.feature.properties.style
                            ).addTo(Map_.map)
                    }
                    break
                default:
                    break
            }
        }
    },
    getGeologicProperties: function (props) {
        let style = {}

        if (Geologic.active != null && Geologic.currentType != null) {
            if (Geologic.active === false) {
                return false
            }
            switch (Geologic.currentType) {
                case 'pattern':
                    style = {
                        type: 'pattern',
                        tag: Geologic.active,
                        color: Geologic.optionValues.color,
                        size: Geologic.optionValues.size,
                        fillColor: Geologic.optionValues.fillColor,
                        fillOpacity: Geologic.optionValues.fillOpacity,
                    }
                    break
                case 'linework':
                    style = {
                        type: 'linework',
                        tag: Geologic.active,
                        color: Geologic.optionValues.color,
                        size: Geologic.optionValues.size,
                        rep: Geologic.optionValues.repetition,
                        pos: Geologic.optionValues.position,
                        dashArray: Geologic.activeDef?.style?.dashArray,
                        weight: Geologic.activeDef?.style?.weight,
                    }
                    break
                case 'symbol':
                    style = {
                        type: 'symbol',
                        tag: Geologic.active,
                        color: Geologic.optionValues.color,
                        size: Geologic.optionValues.size,
                        rot: Geologic.optionValues.rotation,
                    }
                    break
                default:
                    break
            }
        } else {
            style = props?.geologic || false
        }

        return style
    },
}

export default Geologic
