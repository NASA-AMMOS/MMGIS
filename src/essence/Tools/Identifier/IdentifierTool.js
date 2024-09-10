//Finds the tile png under the mouse of all active tile layers
//Draws those tiles their owns canvases and get the appropriate pixel value
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import calls from '../../../pre/calls'

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
    justification: 'left',
    vars: {},
    initialize: function () {
        //Get tool variables and UI adjustments
        this.justification = L_.getToolVars('identifier')['justification']
        var toolContent = d3.select('#toolSeparated_Identifier')
        var toolController = d3.select('#toolcontroller_sepdiv')
        if (this.justification === 'right') {
            toolController.style('top', '110px')
            toolController.style('left', null)
            toolController.style('right', '5px')
            toolContent.style('left', null)
            toolContent.style('right', '0px')
        } else if (
            this.justification !== L_.getToolVars('legend')['justification']
        ) {
            toolController.clone(false).attr('id', 'toolcontroller_sepdiv_left')
            $('#toolSeparated_Identifier').appendTo(
                '#toolcontroller_sepdiv_left'
            )
            toolController.style('top', '40px')
            toolController.style('left', '5px')
            toolController.style('right', null)
        }
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
        this.varsRaw = L_.getToolVars('identifier', true)
        this.vars = {
            data: {},
        }
        Object.keys(this.varsRaw).forEach((layerName) => {
            if (layerName != '__layers')
                this.vars.data[L_.asLayerUUID(layerName)] = {
                    data: [this.varsRaw[layerName]],
                }
        })

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
        this.made = false
    },
    fillURLParameters: function (url, layerUUID) {
        if (IdentifierTool.vars.data?.[layerUUID]?.data?.[0]) {
            const layerTimeFormat = d3.utcFormat(
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
        }, 5)
    },
    idPixelGlobe: function (e) {
        if (Globe_.litho.mouse)
            IdentifierTool.idPixel(e, [
                Globe_.litho.mouse.lng,
                Globe_.litho.mouse.lat,
                Globe_.litho.zoom,
            ])
    },
    //lnglatzoom is [lng,lat,zoom]
    //if trueValue is true, query the data layer for the value, else us the legend if possible
    idPixel: function (e, lnglatzoom, trueValue, selfish) {
        trueValue = trueValue || false
        clearTimeout(IdentifierTool.mousemoveTimeout)

        //Find out the urls of the active tile layers
        IdentifierTool.activeLayerNames = []
        IdentifierTool.activeLayerURLs = []
        IdentifierTool.zoomLevels = []
        IdentifierTool.tileFormats = []
        for (let n in L_.layers.on) {
            if (L_.layers.on[n] == true) {
                //We only want the tile layers
                if (L_.layers.data[n].type == 'tile') {
                    let url = L_.getUrl(
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
            var activeZ =
                IdentifierTool.activeTiles[i] && IdentifierTool.activeTiles[i].z
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
            var px = Math.round((ax % 1) * (IdentifierTool.tileImageWidth - 1))
            var py = Math.round((ay % 1) * (IdentifierTool.tileImageWidth - 1))

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
                //update active tile
                //TODO: Capitalize previous comment
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

        //Output the data somehow
        var htmlInfoString =
            "<ul style='list-style-type: none; padding: 0; margin: 0;'>"
        var value
        var liEls = []
        var colorString
        for (var i = 0; i < IdentifierTool.imageData.length; i++) {
            colorString = 'transparent'
            value = ''
            liEls.push('')

            var pxRGBA = { r: 0, g: 0, b: 0, a: 0 }
            if (IdentifierTool.imageData[i]) {
                pxRGBA = IdentifierTool.getPixel(
                    IdentifierTool.imageData[i],
                    IdentifierTool.pxXYs[i].x,
                    IdentifierTool.pxXYs[i].y
                )
            }
            //Oh IdentifierTool is the same as X != undefined
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
                            queryDataValue(
                                d.url,
                                lnglatzoom[0],
                                lnglatzoom[1],
                                d.bands,
                                IdentifierTool.activeLayerNames[i],
                                (function (pxRGBA, i, j) {
                                    return function (value) {
                                        const d2 =
                                            IdentifierTool.vars.data[
                                                IdentifierTool.activeLayerNames[
                                                    i
                                                ]
                                            ].data[j]
                                        var htmlValues = ''
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
                                        var cnt = 0
                                        for (var v in value) {
                                            var unit = d2.unit || ''
                                            if (
                                                d2.units &&
                                                d2.units.constructor ===
                                                    Array &&
                                                d2.units[cnt]
                                            ) {
                                                unit = d2.units[cnt]
                                            }
                                            var valueParsed =
                                                parseValue(
                                                    value[v][1],
                                                    d2.sigfigs,
                                                    d2.scalefactor
                                                ) +
                                                '' +
                                                unit

                                            if (value.length > 1) {
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
                                        $(
                                            `#identifierToolIdPixelCursorInfo_${i}_${j}`
                                        ).html(htmlValues)
                                    }
                                })(pxRGBA, i, j)
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
            htmlInfoString + liEls.join('') + '</ul>',
            null,
            false,
            null,
            null,
            null,
            true,
            null,
            true
        )

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
        var tools = d3.select('#tools')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('class', 'center aligned ui padded grid')
            .style('height', '100%')
        //Add the markup to tools or do it manually
        //tools.html( markup );
    }

    //Add event functions and whatnot
    var previousCursor = d3.select('#map').style('cursor')
    d3.select('#map').style('cursor', 'crosshair')

    Map_.map.on('mousemove', IdentifierTool.idPixelMap)
    if (L_.hasGlobe) {
        Globe_.litho
            .getContainer()
            .addEventListener('mousemove', IdentifierTool.idPixelGlobe, false)
        //Globe_.shouldRaycastSprites = false

        Globe_.litho.getContainer().style.cursor = 'crosshair'
    }

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.

    var newActive = $('#toolcontroller_sepdiv #' + 'Identifier' + 'Tool')
    newActive.addClass('active').css({
        color: ToolController_.activeColor,
    })
    newActive.parent().css({
        background: ToolController_.activeBG,
    })

    function separateFromMMWebGIS() {
        CursorInfo.hide()
        Map_.map.off('mousemove', IdentifierTool.idPixelMap)
        //Globe_.shouldRaycastSprites = true
        if (L_.hasGlobe) {
            Globe_.litho.getContainer().style.cursor = 'default'
            Globe_.litho
                .getContainer()
                .removeEventListener('mousemove', IdentifierTool.idPixelGlobe)
        }

        if (IdentifierTool.targetId === 'toolContentSeparated_Identifier') {
            d3.select('#map').style('cursor', 'grab')
            let tools = d3.select(
                IdentifierTool.targetId
                    ? `#${IdentifierTool.targetId}`
                    : '#toolPanel'
            )
            tools.style('background', 'var(--color-k)')
            //Clear it
            tools.selectAll('*').remove()
            var prevActive = $(
                '#toolcontroller_sepdiv #' + 'Identifier' + 'Tool'
            )
            prevActive.removeClass('active').css({
                color: ToolController_.defaultColor,
                background: 'none',
            })
            prevActive.parent().css({
                background: 'none',
            })
        } else {
            d3.select('#map').style('cursor', previousCursor)
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

function queryDataValue(url, lng, lat, numBands, layerUUID, callback) {
    numBands = numBands || 1
    var dataPath
    if (url.startsWith('/vsicurl/')) {
        dataPath = url
    } else {
        dataPath = 'Missions/' + L_.mission + '/' + url
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
            data = data.replace(/none/gi, 'null')
            if (data.length > 2) {
                data = JSON.parse(data)
                if (typeof callback === 'function') callback(data)
            }
        },
        function () {
            console.warn('IdentifierTool: Failed to query bands.')
        }
    )
}

export default IdentifierTool
