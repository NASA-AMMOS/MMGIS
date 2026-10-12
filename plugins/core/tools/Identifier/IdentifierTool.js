//Finds the tile png under the mouse of all active tile layers
//Draws those tiles their owns canvases and get the appropriate pixel value
import $ from 'jquery'
import { utcFormat } from 'd3-time-format'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import Globe_ from '@basics/Globe_/Globe_'
import ToolController_ from '@basics/ToolController_/ToolController_'
import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'
import calls from '@pre/calls'
import {
    parseExternalStacUrl,
    formatStacBidx,
    normalizeTitilerExpression,
} from '@basics/Layers_/LayerUtils'

//Add the tool markup if you want to do it this way
var markup = [].join('\n')

var IdentifierTool = {
    height: -1,
    tileImageWidth: null,
    activeTiles: null,
    currentTiles: null,
    pxXYs: null,
    activeLayerNames: null,
    activeLayerURLs: null,
    zoomLevels: null,
    images: null,
    imageData: null,
    MMWebGISInterface: null,
    mousemoveTimeout: null,
    mousemoveTimeoutMap: null,
    targetId: null,
    made: false,

    vars: {},
    initialize: function () {
        //Get tool variables

    },
    make: function (targetId) {
        this.targetId = targetId
        this.MMWebGISInterface = new interfaceWithMMWebGIS()
        this.activeLayerNames = []

        L_.subscribeOnLayerToggle('IdentifierTool', () => {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()
        })

        this.made = true

        L_.subscribeOnLayerToggle('IdentifierTool', () => {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()
        })

        this.made = true

        //Get tool variables
        this.varsRaw = L_.getToolVars('identifier', true) || {}
        this.vars = {
            data: {},
        }
        Object.keys(this.varsRaw).forEach((layerName) => {
            if (layerName != 'layers' && layerName != '__layers')
                this.vars.data[L_.asLayerUUID(layerName)] = {
                    data: [this.varsRaw[layerName]],
                }
        })

        if (this.varsRaw.layers) {
            this.varsRaw.layers.forEach((layer) => {
                this.vars.data[L_.asLayerUUID(layer.name)] = { data: [layer] }
            })
        }
        if (this.varsRaw.__layers) {
            Object.keys(this.varsRaw.__layers).forEach((layerName) => {
                const layer = this.varsRaw.__layers[layerName]
                if (layer.data) {
                    this.vars.data[layerName] = layer
                }
            })
        }

        //Probably always 256
        this.tileImageWidth = 256
        //x y and zoom of mousedover tile
        this.activeTiles = []
        this.currentTiles = []
        this.pxXYs = []

        //All relatable through indices
        this.activeLayerNames = []
        this.activeLayerURLs = []
        //Okay. No more using active tile z. Why? Because if you're passed the native
        // max zoom you get nothing. So save the native max zooms.
        this.zoomLevels = []
        this.images = []
        this.imageData = []
    },
    destroy: function () {
        this.MMWebGISInterface.separateFromMMWebGIS()
        this.targetId = null
        L_.unsubscribeOnLayerToggle('IdentifierTool')
        delete L_._toolCopyables.IdentifierTool
        // Turning the Identifier off shouldn't leave the legend lit up.
        IdentifierTool.resetLegendMatches()
        this.highlightInLegend()
        this.made = false
    },
    fillURLParameters: function (url, layerUUID) {
        if (IdentifierTool.vars.data?.[layerUUID]?.data?.[0]) {
            const layerTimeFormat = utcFormat(
                IdentifierTool.vars.data[layerUUID].data[0].timeFormat
            )

            let filledURL = url
            filledURL = filledURL
                .replace(
                    /{starttime}/g,
                    layerTimeFormat(
                        Date.parse(L_.layers.data[layerUUID].time.start)
                    )
                )
                .replace(
                    /{endtime}/g,
                    layerTimeFormat(
                        Date.parse(L_.layers.data[layerUUID].time.end)
                    )
                )

            return filledURL
        } else return url
    },
    //From: https://github.com/mrdoob/three.js/issues/758 mrdoob
    getImageData: function (image) {
        if (image.width == 0) return
        var canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height

        var context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)

        return context.getImageData(0, 0, image.width, image.height)
    },
    getPixel: function (imagedata, x, y) {
        var position = (x + imagedata.width * y) * 4,
            data = imagedata.data
        return {
            r: data[position],
            g: data[position + 1],
            b: data[position + 2],
            a: data[position + 3],
        }
    },
    idPixelMap: function (e) {
        clearTimeout(IdentifierTool.mousemoveTimeoutMap)
        IdentifierTool.mousemoveTimeoutMap = setTimeout(function () {
            IdentifierTool.idPixel(e, [
                e.latlng.lng,
                e.latlng.lat,
                Map_.map.getZoom(),
            ])
        }, 400)
    },
    idPixelGlobe: function (e) {
        if (Globe_.litho.mouse)
            IdentifierTool.idPixel(e, [
                Globe_.litho.mouse.lng,
                Globe_.litho.mouse.lat,
                Globe_.litho.zoom,
            ])
    },
    clearCursor: function (e) {
        clearTimeout(IdentifierTool.mousemoveTimeout)
        clearTimeout(IdentifierTool.mousemoveTimeoutMap)
        CursorInfo.hide()
        IdentifierTool.resetLegendMatches()
        IdentifierTool.highlightInLegend()
    },
    // Mirror what the cursor resolved onto the Legend tool. Optional call:
    // a mission may enable either tool without the other.
    highlightInLegend: function () {
        const numbers = IdentifierTool.legendMatches || {}
        const labels = IdentifierTool.legendLabelMatches || {}
        const layerUUIDs = new Set(
            Object.keys(numbers).concat(Object.keys(labels))
        )
        const matches = []
        layerUUIDs.forEach((layerUUID) => {
            // The number first, then the colour-matched label.
            const candidates = []
            if (numbers[layerUUID] != null) candidates.push(numbers[layerUUID])
            if (labels[layerUUID] != null) candidates.push(labels[layerUUID])
            if (candidates.length > 0)
                matches.push({ layerUUID: layerUUID, value: candidates })
        })
        ToolController_.getTool('LegendTool').highlightEntries?.(matches)
    },
    // Bumping the generation makes any read still in flight drop itself.
    resetLegendMatches: function () {
        IdentifierTool.legendMatches = {}
        IdentifierTool.legendLabelMatches = {}
        IdentifierTool.hoverGeneration =
            (IdentifierTool.hoverGeneration || 0) + 1
    },
    //lnglatzoom is [lng,lat,zoom]
    //if trueValue is true, query the data layer for the value, else us the legend if possible
    idPixel: function (e, lnglatzoom, trueValue, selfish) {
        trueValue = trueValue || false
        // A COG/STAC layer flips trueValue on below, so the flag cannot say
        // whether this call starts a hover or refines one.
        const startsNewHover = trueValue === false
        clearTimeout(IdentifierTool.mousemoveTimeout)

        //Find out the urls of the active tile layers
        IdentifierTool.activeLayerNames = []
        IdentifierTool.activeLayerURLs = []
        IdentifierTool.zoomLevels = []
        IdentifierTool.tileFormats = []
        //IdentifierTool.imageData = []

        for (let n in L_.layers.on) {
            if (L_.layers.on[n] == true) {
                //We only want the tile and image layers
                if (
                    L_.layers.data[n].type == 'tile' ||
                    L_.layers.data[n].type == 'image'
                ) {
                    let url =
                        L_.layers.data[n].url.indexOf('stac-collection:') ===
                            0 || L_.layers.data[n].url.indexOf('COG:') === 0
                            ? L_.layers.data[n].url
                            : L_.getUrl(
                                  L_.layers.data[n].type,
                                  L_.layers.data[n].url,
                                  L_.layers.data[n]
                              )
                    IdentifierTool.activeLayerURLs.push(url)
                    IdentifierTool.activeLayerNames.push(n)
                    IdentifierTool.zoomLevels.push(
                        L_.layers.data[n].maxNativeZoom
                    )
                    IdentifierTool.tileFormats.push(
                        L_.layers.data[n].tileformat || 'tms'
                    )
                }
            }
        }

        //get the xyz and images of those layers
        for (var i = 0; i < IdentifierTool.activeLayerURLs.length; i++) {
            if (
                IdentifierTool.activeLayerURLs[i].indexOf(
                    'stac-collection:'
                ) === 0 ||
                IdentifierTool.activeLayerURLs[i].indexOf('COG:') === 0 ||
                L_.layers.data[IdentifierTool.activeLayerNames[i]].type ===
                    'image'
            ) {
                IdentifierTool.imageData[i] = false
                trueValue = true
            } else {
                var activeZ =
                    IdentifierTool.activeTiles[i] &&
                    IdentifierTool.activeTiles[i].z
                        ? IdentifierTool.activeTiles[i].z
                        : IdentifierTool.zoomLevels[i]
                var az = Math.min(activeZ, IdentifierTool.zoomLevels[i])
                var ax = F_.lon2tileUnfloored(lnglatzoom[0], az)
                var ay = F_.lat2tileUnfloored(lnglatzoom[1], az)
                var tz = az
                var tx = Math.floor(ax)
                var ty = Math.floor(ay)
                //Invert y
                if (IdentifierTool.tileFormats[i] == 'tms')
                    ty = Math.pow(2, tz) - 1 - ty

                IdentifierTool.currentTiles[i] = { x: tx, y: ty, z: tz }
                //Default activeTiles if none;
                if (!IdentifierTool.activeTiles[i])
                    IdentifierTool.activeTiles[i] = { x: 0, y: 0, z: -1 }

                //pixel on canvas. decimal part * imageWidth
                var px = Math.round(
                    (ax % 1) * (IdentifierTool.tileImageWidth - 1)
                )
                var py = Math.round(
                    (ay % 1) * (IdentifierTool.tileImageWidth - 1)
                )

                IdentifierTool.pxXYs[i] = { x: px, y: py }

                //Tile mouse is over has changed so update the image on our canvas
                if (
                    IdentifierTool.currentTiles[i].x !=
                        IdentifierTool.activeTiles[i].x ||
                    IdentifierTool.currentTiles[i].y !=
                        IdentifierTool.activeTiles[i].y ||
                    IdentifierTool.currentTiles[i].z !=
                        IdentifierTool.activeTiles[i].z
                ) {
                    //Update active tile
                    IdentifierTool.activeTiles[i].x =
                        IdentifierTool.currentTiles[i].x
                    IdentifierTool.activeTiles[i].y =
                        IdentifierTool.currentTiles[i].y
                    IdentifierTool.activeTiles[i].z =
                        IdentifierTool.currentTiles[i].z

                    IdentifierTool.images[i] = new Image()
                    IdentifierTool.images[i].onload = (function (i) {
                        return function () {
                            IdentifierTool.imageData[i] =
                                IdentifierTool.getImageData(
                                    IdentifierTool.images[i]
                                )
                        }
                    })(i)
                    IdentifierTool.images[i].onerror = (function (i) {
                        return function () {
                            IdentifierTool.imageData[i] = false
                        }
                    })(i)
                    IdentifierTool.images[i].setAttribute('crossOrigin', '')

                    IdentifierTool.images[i].src = (
                        IdentifierTool.activeLayerURLs[i] + ''
                    )
                        .replaceAll('{z}', tz)
                        .replaceAll('{x}', tx)
                        .replaceAll('{y}', ty)
                }
            }
        }

        //Output the data somehow
        var value
        var liEls = []
        var colorString
        let copyableValues = {}
        // Only a new hover starts a new set; the true-value pass refines it.
        if (startsNewHover) IdentifierTool.resetLegendMatches()
        const hoverGeneration = IdentifierTool.hoverGeneration
        // The legend is republished once no read is outstanding.
        let pendingValueReads = 0
        for (var i = 0; i < IdentifierTool.imageData.length; i++) {
            colorString = 'transparent'
            value = ''
            liEls.push('')

            var pxRGBA = { r: 0, g: 0, b: 0, a: 255 }
            if (IdentifierTool.imageData[i]) {
                pxRGBA = IdentifierTool.getPixel(
                    IdentifierTool.imageData[i],
                    IdentifierTool.pxXYs[i].x,
                    IdentifierTool.pxXYs[i].y
                )
            }

            //Oh IdentifierTool is the same as X != undefined
            if (
                IdentifierTool.activeLayerURLs[i] != null &&
                (IdentifierTool.activeLayerURLs[i].startsWith(
                    'stac-collection:'
                ) ||
                    IdentifierTool.activeLayerURLs[i].startsWith('COG:') ||
                    L_.layers.data[IdentifierTool.activeLayerNames[i]].type ===
                        'image')
            ) {
                IdentifierTool.vars.data[IdentifierTool.activeLayerNames[i]] =
                    IdentifierTool.vars.data[
                        IdentifierTool.activeLayerNames[i]
                    ] || {}
                IdentifierTool.vars.data[
                    IdentifierTool.activeLayerNames[i]
                ].data = [
                    {
                        url: IdentifierTool.activeLayerURLs[i],
                        bands: 1,
                        units:
                            L_.layers.data[IdentifierTool.activeLayerNames[i]]
                                .cogUnits || '',
                        sigfigs: 2,
                        scalefactor: 1,
                    },
                ]
            }
            if (
                IdentifierTool.vars.data[IdentifierTool.activeLayerNames[i]]
                    ?.data
            ) {
                const data =
                    IdentifierTool.vars.data[IdentifierTool.activeLayerNames[i]]
                for (let j = 0; j < data.data.length; j++) {
                    const d = data.data[j]
                    if (pxRGBA) {
                        if (trueValue) {
                            pendingValueReads++
                            queryDataValue(
                                d.url,
                                lnglatzoom[0],
                                lnglatzoom[1],
                                d.bands,
                                IdentifierTool.activeLayerNames[i],
                                (function (
                                    pxRGBA,
                                    i,
                                    j,
                                    layerUUID,
                                    hoverGeneration
                                ) {
                                    return function (value) {
                                        // Drop a read that outlived its hover.
                                        if (
                                            hoverGeneration !==
                                            IdentifierTool.hoverGeneration
                                        )
                                            return

                                        pendingValueReads--

                                        // A failed read says nothing about the
                                        // pixel, so leave the readout as drawn.
                                        if (value == null) {
                                            if (pendingValueReads <= 0)
                                                IdentifierTool.highlightInLegend()
                                            return
                                        }

                                        const d2 =
                                            IdentifierTool.vars.data[layerUUID]
                                                .data[j]

                                        let htmlValues = ''
                                        // first empty it
                                        $(
                                            `#identifierToolIdPixelCursorInfo_${i}_${j}`
                                        ).html(
                                            [
                                                '<div style="width: 100%; height: 22px; display: flex; justify-content: space-between;">',
                                                '<div></div>',
                                                '<div style="width: calc(100% - 2px); margin: 4px 2px 4px 0px; background: var(--color-a1);">&nbsp;</div>',
                                                '</div>',
                                            ].join('')
                                        )
                                        let cnt = 0
                                        for (let v in value) {
                                            let unit = d2.units || ''
                                            if (
                                                d2.units &&
                                                d2.units.constructor ===
                                                    Array &&
                                                d2.units[cnt]
                                            ) {
                                                unit = d2.units[cnt]
                                            }
                                            let valueParsed =
                                                parseValue(
                                                    value[v][1],
                                                    d2.sigfigs,
                                                    d2.scalefactor
                                                ) +
                                                '' +
                                                unit

                                            if (
                                                value.length > 1 ||
                                                value[v][2] != null
                                            ) {
                                                htmlValues +=
                                                    '<div style="display: flex; justify-content: space-between;"><div style="margin-right: 15px; color: var(--color-a5); font-size: 12px;">' +
                                                    value[v][0] +
                                                    '</div><div style="color: var(--color-a6); font-size: 14px;">' +
                                                    valueParsed +
                                                    '</div></div>'
                                            } else {
                                                htmlValues +=
                                                    '<div style="display: flex; justify-content: space-between;"><div style="color: var(--color-a6); font-size: 16px;">' +
                                                    valueParsed +
                                                    '</div></div>'
                                            }
                                            cnt++
                                        }
                                        copyableValues[
                                            `${
                                                d.name ||
                                                L_.layers.data[layerUUID]
                                                    .display_name
                                            }`
                                        ] = value
                                        L_._toolCopyables.IdentifierTool = {
                                            title: 'Copy Last Identified Values',
                                            copyable: {
                                                lng: lnglatzoom[0],
                                                lat: lnglatzoom[1],
                                                identified: copyableValues,
                                            },
                                        }
                                        $(
                                            `#identifierToolIdPixelCursorInfo_${i}_${j}`
                                        ).html(htmlValues)

                                        if (cnt > 0 && value[0] != null) {
                                            // Nodata arrives as [null], which
                                            // coerces to 0 if left wrapped.
                                            const raw = Array.isArray(
                                                value[0][1]
                                            )
                                                ? value[0][1][0]
                                                : value[0][1]
                                            if (raw != null) {
                                                const numeric = parseFloat(
                                                    parseValue(
                                                        raw,
                                                        d2.sigfigs,
                                                        d2.scalefactor
                                                    )
                                                )
                                                if (!isNaN(numeric)) {
                                                    IdentifierTool.legendMatches[
                                                        layerUUID
                                                    ] = numeric
                                                }
                                            }
                                        }
                                        if (pendingValueReads <= 0) {
                                            IdentifierTool.highlightInLegend()
                                        }

                                        $('#cursorInfo ul').css({
                                            width: '',
                                            height: '',
                                        })
                                    }
                                })(
                                    pxRGBA,
                                    i,
                                    j,
                                    IdentifierTool.activeLayerNames[i],
                                    hoverGeneration
                                )
                            )
                        } else {
                            if (
                                L_.layers.data[
                                    IdentifierTool.activeLayerNames[i]
                                ]?._legend
                            ) {
                                value = bestMatchInLegend(
                                    pxRGBA,
                                    L_.layers.data[
                                        IdentifierTool.activeLayerNames[i]
                                    ]._legend
                                )
                                if (value != null && value !== '') {
                                    IdentifierTool.legendLabelMatches[
                                        IdentifierTool.activeLayerNames[i]
                                    ] = value
                                }
                            }
                        }
                        colorString =
                            'rgba(' +
                            pxRGBA.r +
                            ',' +
                            pxRGBA.g +
                            ',' +
                            pxRGBA.b +
                            ',' +
                            pxRGBA.a / 255 +
                            ')'
                    }

                    // prettier-ignore
                    liEls.push(
                    [`<li style="padding: 4px 9px; border-top: ${liEls.length === 1 ? 'none' : '1px solid var(--color-a2)'};">`,
                        `<div style="display: flex;">`,
                            `<div style='width: 14px; height: 14px; margin-right: 8px; margin-top: 2px; background: ${colorString};'></div>`,
                            `<div style="letter-spacing: 0.5px; white-space: nowrap;">`,
                                d.name ||
                                    L_.layers.data[
                                        IdentifierTool.activeLayerNames[i]
                                    ].display_name,
                            `</div>`,
                        `</div>`,
                        `<div id='identifierToolIdPixelCursorInfo_${i}_${j}' style='padding-left: 20px;'>`,
                        
                            (trueValue || value == null || value == '') ? [
                                '<div style="width: 100%; height: 22px; display: flex; justify-content: space-between;">',
                                    '<div></div>',
                                    '<div style="width: calc(100% - 2px); margin: 4px 2px 4px 0px; background: var(--color-a1);">&nbsp;</div>',
                                '</div>'].join('') : value,
                                
                        `</div>`,
                    '</li>',
                    ].join('')
                )
                }
            }
        }

        CursorInfo.update(
            `<ul style='list-style-type: none; padding: 0; margin: 0; width:${
                $('#cursorInfo').width() ? $('#cursorInfo').width() + 'px' : ''
            }; height:${
                $('#cursorInfo').height()
                    ? $('#cursorInfo').height() + 'px'
                    : ''
            };'>${liEls.join('')}</ul>`,
            null,
            false,
            null,
            null,
            null,
            true,
            null,
            true
        )

        if (pendingValueReads <= 0) IdentifierTool.highlightInLegend()

        if (!trueValue && !selfish) {
            IdentifierTool.mousemoveTimeout = setTimeout(function () {
                IdentifierTool.idPixel(e, lnglatzoom, true, true)
            }, 150)
        }

        function parseValue(v, sigfigs, scalefactor) {
            var ed = 10
            if (typeof v === 'string') {
                return v
            }
            if (v == null) {
                return v
            } else if (v.toString().indexOf('e') != -1) {
                if (sigfigs != undefined) ed = sigfigs
                if (scalefactor != undefined) v = v * parseFloat(scalefactor)
                v = parseFloat(v)
                return v.toExponential(ed)
            } else {
                var decSplit = v.toString().split('.')
                var decPlacesBefore = decSplit[0] ? decSplit[0].length : 0
                var decPlacesAfter = decSplit[1] ? decSplit[1].length : 0
                if (decPlacesBefore <= 5) {
                    if (scalefactor != undefined)
                        v = v * parseFloat(scalefactor)
                    if (sigfigs != undefined) v = v.toFixed(sigfigs)
                }
                v = parseFloat(v)
                if (decPlacesAfter >= ed) {
                    v = v.toExponential(ed)
                }
                return parseFloat(v)
            }
        }
    },
}

//
function interfaceWithMMWebGIS() {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }

    //MMWebGIS should always have a div with id 'tools'
    if (IdentifierTool.targetId !== 'toolContentSeparated_Identifier') {
        const toolsContainer = $('#tools')
        //Clear it
        toolsContainer.empty()
        //Add a semantic container
        const tools = $('<div>')
            .attr('class', 'center aligned ui padded grid')
            .css('height', '100%')
        toolsContainer.append(tools)
        //Add the markup to tools or do it manually
        //tools.html( markup );
    }

    //Add event functions and whatnot
    var previousCursor = $('#map').css('cursor')
    $('#map').css('cursor', 'crosshair')

    Map_.map.on('mousemove', IdentifierTool.idPixelMap)
    Map_.map.on('mouseout', IdentifierTool.clearCursor)
    if (L_.hasGlobe) {
        Globe_.litho
            .getContainer()
            .addEventListener('mousemove', IdentifierTool.idPixelGlobe, false)
        Globe_.litho
            .getContainer()
            .addEventListener('mouseout', IdentifierTool.clearCursor, false)
        //Globe_.shouldRaycastSprites = false

        Globe_.litho.getContainer().style.cursor = 'crosshair'
    }

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.

    // Active styling is now handled reactively by SepToolButton in Toolbar.jsx

    function separateFromMMWebGIS() {
        CursorInfo.hide()
        Map_.map.off('mousemove', IdentifierTool.idPixelMap)
        Map_.map.off('mouseout', IdentifierTool.clearCursor)
        //Globe_.shouldRaycastSprites = true
        if (L_.hasGlobe) {
            Globe_.litho.getContainer().style.cursor = 'default'
            Globe_.litho
                .getContainer()
                .removeEventListener('mousemove', IdentifierTool.idPixelGlobe)
            Globe_.litho
                .getContainer()
                .removeEventListener('mousemove', IdentifierTool.clearCursor)
        }

        if (IdentifierTool.targetId === 'toolContentSeparated_Identifier') {
            $('#map').css('cursor', 'grab')
            const tools = $(
                IdentifierTool.targetId
                    ? `#${IdentifierTool.targetId}`
                    : '#toolPanel'
            )
            tools.css('background', 'transparent')
            //Clear it
            tools.empty()
            // Active styling is now handled reactively by SepToolButton in Toolbar.jsx
        } else {
            $('#map').css('cursor', previousCursor)
        }
    }
}

//Other functions

function bestMatchInLegend(rgba, legendData) {
    var bestMatch = ''
    //Empty string if invisible value
    if (rgba.a == 0) return bestMatch

    var bestHeuristic = Infinity
    var l, h, r
    for (var i = 0; i < legendData.length; i++) {
        if (legendData[i].color.length > 0) {
            r = F_.rgb2hex(legendData[i].color)
            l = F_.hexToRGB(r[0] == '#' ? r : legendData[i].color)
            h =
                Math.abs(rgba.r - l.r) +
                Math.abs(rgba.g - l.g) +
                Math.abs(rgba.b - l.b)
            if (h < bestHeuristic) {
                bestHeuristic = h
                bestMatch = legendData[i].value
            }
        }
    }
    return bestMatch
}

/**
 * Parse STAC URL to extract base URL and collection name
 * Uses LayerUtils.parseExternalStacUrl for consistent parsing logic
 */
function parseStacUrl(url) {
    const afterColon = url.substring(url.indexOf(':') + 1)

    if (afterColon.includes('://')) {
        // External format - use LayerUtils function
        return parseExternalStacUrl(afterColon)
    } else {
        // Local format
        const origin = window.location.origin
        const pathname = (window.location.pathname || '').replace(/\/$/g, '')
        const baseUrl = mmgisglobal.NODE_ENV === 'development'
            ? 'http://localhost:8888'
            : `${origin}${pathname}`
        const collectionName = afterColon.split('?')[0].trim()

        return { baseUrl: `${baseUrl}/titilerpgstac`, collectionName }
    }
}

function queryDataValue(url, lng, lat, numBands, layerUUID, callback) {
    // Report exactly once on every route out; callers count outstanding reads.
    let didRespond = false
    const respond = (values) => {
        if (didRespond) return
        didRespond = true
        if (typeof callback === 'function') callback(values)
    }

    const processExpression = normalizeTitilerExpression

    numBands = numBands || 1
    var dataPath
    if (url != null && url.startsWith('stac-collection:')) {
        const parsed = parseStacUrl(url)
        if (!parsed) {
            console.error('Failed to parse STAC URL for Identifier query:', url)
            respond(null)
            return
        }

        const { baseUrl, collectionName } = parsed

        let timeParam = ''
        if (L_.layers.data[layerUUID].time?.enabled == true)
            timeParam = `&datetime=${L_.layers.data[layerUUID].time.start}/${L_.layers.data[layerUUID].time.end}`

        // Expression or Bands (titiler>=2: bands go inline as assets=asset|bidx=1,2)
        let expressionParam = ''
        let assetsParam = 'assets=asset'
        const layer = L_.layers.data[layerUUID]

        // Check currentCogExpression first (runtime value), then fall back to cogExpression (configured value)
        const expressionToUse =
            layer.currentCogExpression || layer.cogExpression
        if (expressionToUse && expressionToUse.trim() !== '') {
            const processedExpression = processExpression(expressionToUse)
            expressionParam = `&expression=${encodeURIComponent(processedExpression)}`
        } else {
            const bands = formatStacBidx(layer.cogBandsQuery)
            if (bands) assetsParam += `|bidx=${bands}`
        }

        fetch(
            `${baseUrl}/collections/${collectionName}/point/${lng},${lat}?${assetsParam}&items_limit=10${timeParam}${expressionParam}`,
            {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                },
            }
        )
            .then((res) => {
                if (res.status === 200) {
                    return res.json()
                }
            })
            .then((json) => {
                // titiler-pgstac>=3: { assets: [{ name: 'collection/item', values, band_names }] }
                if (json && Array.isArray(json.assets)) {
                    const values = []
                    json.assets.forEach((asset) => {
                        const itemName = (asset.name || '').split('/').pop()
                        asset.band_names.forEach((bandName, idx) => {
                            values.push([
                                `${itemName} - ${bandName}`,
                                [asset.values[idx]],
                                [bandName],
                            ])
                        })
                    })
                    respond(values)
                } else respond(null)
            })
            .catch((error) => {
                respond(null)
                console.error('Error querying STAC point:', error)
                if (error.message && error.message.toLowerCase().includes('cors')) {
                    console.error(
                        'CORS error - the external STAC server must allow requests from this origin.',
                        '\nRequired CORS headers on external server:',
                        '\n  Access-Control-Allow-Origin: *',
                        '\n  Access-Control-Allow-Methods: GET, OPTIONS'
                    )
                }
            })
        return
    } else if (url != null && url.startsWith('COG:')) {
        // Time
        let timeParam = ''
        if (L_.layers.data[layerUUID].time?.enabled == true)
            timeParam = `&datetime=${L_.layers.data[layerUUID].time.start}/${L_.layers.data[layerUUID].time.end}`

        // Expression or Bands
        let expressionParam = ''
        let bandsParam = ''
        const layer = L_.layers.data[layerUUID]

        // Check currentCogExpression first (runtime value), then fall back to cogExpression (configured value)
        const expressionToUse =
            layer.currentCogExpression || layer.cogExpression
        if (expressionToUse && expressionToUse.trim() !== '') {
            const processedExpression = processExpression(expressionToUse)
            expressionParam = `&expression=${encodeURIComponent(processedExpression)}`
        } else {
            // Fall back to bands if no expression
            let b = layer.cogBandsQuery || layer.cogBands
            if (b != null) {
                b.forEach((band) => {
                    if (band != null) bandsParam += `&bidx=${band}`
                })
            }
        }

        fetch(
            `${
                mmgisglobal.NODE_ENV === 'development'
                    ? 'http://localhost:8888'
                    : `${window.location.origin}${(
                          window.location.pathname || ''
                      ).replace(/\/$/g, '')}`
            }/titiler/cog/point/${lng},${lat}?url=${L_.getUrl(
                'tile',
                url
            )}${timeParam}${expressionParam}${bandsParam}`,
            {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                },
            }
        )
            .then((res) => {
                if (res.status === 200) {
                    return res.json()
                }
            })
            .then((json) => {
                if (json?.values) {
                    const values = []
                    json.values.forEach((val, idx) => {
                        values.push([json.band_names[idx], [val]])
                    })
                    respond(values)
                } else respond(null)
            })
            .catch((err) => {
                respond(null)
            })
        return
    } else if (url.startsWith('/vsicurl/') || url.startsWith('Missions/')) {
        dataPath = url
    } else {
        dataPath = L_.missionPath + url
    }

    dataPath = IdentifierTool.fillURLParameters(dataPath, layerUUID)

    calls.api(
        'getbands',
        {
            type: 'band',
            x: lat,
            y: lng,
            xyorll: 'll',
            bands: '[[1,' + numBands + ']]',
            path: dataPath,
        },
        (data) => {
            //Convert python's Nones to nulls
            if (typeof data === 'string') {
                data = data.replace(/none/gi, 'null')
                if (data.length > 2) {
                    try {
                        respond(JSON.parse(data))
                    } catch (e) {
                        console.warn(
                            'IdentifierTool: Could not parse band values.',
                            e
                        )
                        respond(null)
                    }
                } else respond(null)
                return
            }
            if (typeof data === 'object' && data != null && data.length > 0) {
                respond(data)
                return
            }
            respond(null)
        },
        function () {
            respond(null)
            console.warn('IdentifierTool: Failed to query bands.')
        }
    )
}

export default IdentifierTool
