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
    targetId: null,
    made: false,
    justification: 'left',
    vars: {},
    initialize: function () {
        //Get tool variables and UI adjustments
        this.justification = L_.getToolVars('identifier')['justification']
        var toolContent = d3.select('#toolSeparated_Identifier')
        toolContent.style('bottom', '2px')    
    },   
    make: function (targetId) {
        this.MMWebGISInterface = new interfaceWithMMWebGIS()
        this.targetId = targetId
        this.activeLayerNames = []

        L_.subscribeOnLayerToggle('IdentifierTool', () => {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()
        })

        this.made = true

        //Get tool variables
        this.varsRaw = L_.getToolVars('identifier')
        this.vars = {}
        Object.keys(this.varsRaw).forEach((layerName) => {
            this.vars[L_.asLayerUUID(layerName)] = this.varsRaw[layerName]
        })

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
        IdentifierTool.idPixel(e, [
            e.latlng.lng,
            e.latlng.lat,
            Map_.map.getZoom(),
        ])
    },
    idPixelGlobe: function (e) {
        IdentifierTool.idPixel(e, [
            Globe_.litho.mouse.lng,
            Globe_.litho.mouse.lat,
            Globe_.litho.zoom,
        ])
    },
    idValueMap: function (e) {
        IdentifierTool.idPixel(
            e,
            [e.latlng.lng, e.latlng.lat, Map_.map.getZoom()],
            true
        )
    },
    idValueGlobe: function (e) {
        IdentifierTool.idPixel(
            e,
            [Globe_.litho.mouse.lng, Globe_.litho.mouse.lat, Globe_.litho.zoom],
            true
        )
    },
    //lnglatzoom is [lng,lat,zoom]
    //if trueValue is true, query the data layer for the value, else us the legend if possible
    idPixel: function (e, lnglatzoom, trueValue) {
        trueValue = trueValue || false
        clearTimeout(IdentifierTool.mousemoveTimeout)

        //Find out the urls of the active tile layers
        IdentifierTool.activeLayerNames = []
        IdentifierTool.activeLayerURLs = []
        IdentifierTool.zoomLevels = []
        for (let n in L_.layers.on) {
            if (L_.layers.on[n] == true) {
                //We only want the tile layers
                if (L_.layers.data[n].type == 'tile') {
                    //Cut the {z}/{x}/{y}.png
                    var croppedUrl = L_.layers.data[n].url
                    croppedUrl = croppedUrl.substr(0, croppedUrl.length - 15)
                    if (!F_.isUrlAbsolute(croppedUrl))
                        croppedUrl = L_.missionPath + croppedUrl
                    IdentifierTool.activeLayerURLs.push(croppedUrl)
                    IdentifierTool.activeLayerNames.push(n)
                    IdentifierTool.zoomLevels.push(
                        L_.layers.data[n].maxNativeZoom
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
            var ty = Math.pow(2, tz) - 1 - ty

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

                IdentifierTool.images[i].src =
                    IdentifierTool.activeLayerURLs[i] +
                    tz +
                    '/' +
                    tx +
                    '/' +
                    ty +
                    '.png'
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
            if (pxRGBA) {
                if (
                    trueValue &&
                    IdentifierTool.vars[IdentifierTool.activeLayerNames[i]]
                ) {
                    queryDataValue(
                        IdentifierTool.vars[IdentifierTool.activeLayerNames[i]]
                            .url,
                        lnglatzoom[0],
                        lnglatzoom[1],
                        IdentifierTool.vars[IdentifierTool.activeLayerNames[i]]
                            .bands,
                        (function (pxRGBA, i) {
                            return function (value) {
                                var htmlValues = ''
                                var cnt = 0
                                for (var v in value) {
                                    var unit =
                                        IdentifierTool.vars[
                                            IdentifierTool.activeLayerNames[i]
                                        ].unit || ''
                                    if (
                                        IdentifierTool.vars[
                                            IdentifierTool.activeLayerNames[i]
                                        ].units &&
                                        IdentifierTool.vars[
                                            IdentifierTool.activeLayerNames[i]
                                        ].units.constructor === Array &&
                                        IdentifierTool.vars[
                                            IdentifierTool.activeLayerNames[i]
                                        ].units[cnt]
                                    ) {
                                        unit =
                                            IdentifierTool.vars[
                                                IdentifierTool.activeLayerNames[
                                                    i
                                                ]
                                            ].units[cnt]
                                    }
                                    var valueParsed =
                                        parseValue(
                                            value[v][1],
                                            IdentifierTool.vars[
                                                IdentifierTool.activeLayerNames[
                                                    i
                                                ]
                                            ].sigfigs
                                        ) +
                                        '' +
                                        unit
                                    htmlValues +=
                                        '<div style="display: flex; justify-content: space-between;"><div style="margin-right: 15px;">' +
                                        value[v][0] +
                                        '</div><div>' +
                                        valueParsed +
                                        '</div></div>'
                                    cnt++
                                }
                                $('#identifierToolIdPixelCursorInfo_' + i).html(
                                    htmlValues
                                )
                            }
                        })(pxRGBA, i)
                    )
                } else {
                    if (
                        L_.layers.data[IdentifierTool.activeLayerNames[i]]
                            ?._legend
                    ) {
                        value = bestMatchInLegend(
                            pxRGBA,
                            L_.layers.data[IdentifierTool.activeLayerNames[i]]
                                ._legend
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
            liEls[i] =
                "<li><div style='width: 14px; height: 14px; float: left; margin-right: 5px; margin-top: 1px; background: " +
                colorString +
                ";'></div>" +
                L_.layers.data[IdentifierTool.activeLayerNames[i]]
                    .display_name +
                "<div id='identifierToolIdPixelCursorInfo_" +
                i +
                "'  style='padding-left: 20px;'>" +
                value +
                '</div></li>'
        }
        CursorInfo.update(
            htmlInfoString + liEls.join('') + '</ul>',
            null,
            false,
            null,
            null,
            null,
            true
        )

        if (!trueValue) {
            IdentifierTool.mousemoveTimeout = setTimeout(function () {
                IdentifierTool.idPixel(e, lnglatzoom, true)
            }, 150)
        }

        function parseValue(v, sigfigs) {
            var ed = 4
            if (typeof v === 'string') {
                return v
            }
            if (v == null) {
                return v
            } else if (v.toString().indexOf('e') != -1) {
                if (sigfigs != undefined) ed = sigfigs
                v = parseFloat(v)
                return v.toExponential(ed)
            } else {
                var decSplit = v.toString().split('.')
                var decPlacesBefore = decSplit[0] ? decSplit[0].length : 0
                var decPlacesAfter = decSplit[1] ? decSplit[1].length : 0
                if (decPlacesBefore <= 5) {
                    if (sigfigs != undefined) v = v.toFixed(sigfigs)
                }
                v = parseFloat(v)
                if (sigfigs != undefined) ed = sigfigs
                if (decPlacesAfter >= ed) v = v.toExponential(ed)
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

    //Add event functions and whatnot
    d3.select('#map').style('cursor', 'crosshair')

    Map_.map.on('mousemove', IdentifierTool.idPixelMap)
    Globe_.litho
        .getContainer()
        .addEventListener('mousemove', IdentifierTool.idPixelGlobe, false)
    //Globe_.shouldRaycastSprites = false

    Globe_.litho.getContainer().style.cursor = 'crosshair'
    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.

    var newActive = $(
        '#toolcontroller_sepdiv #' +
            'Identifier' +
            'Tool'
    )
    newActive.addClass('active').css({
        color: ToolController_.activeColor,
    })
    newActive.parent().css({
        background: ToolController_.activeBG,
    })

    function separateFromMMWebGIS() {
        CursorInfo.hide()

        d3.select('#map').style('cursor', 'grab')

        //Globe_.shouldRaycastSprites = true
        Globe_.litho.getContainer().style.cursor = 'default'

        Map_.map.off('mousemove', IdentifierTool.idPixelMap)
        Globe_.litho
            .getContainer()
            .removeEventListener('mousemove', IdentifierTool.idPixelGlobe)

        let tools = d3.select(
            IdentifierTool.targetId ? `#${IdentifierTool.targetId}` : '#toolPanel'
        )
        tools.style('background', 'var(--color-k)')
        //Clear it
        tools.selectAll('*').remove()

        var prevActive = $(
            '#toolcontroller_sepdiv #' +
                'Identifier' +
                'Tool'
        )
        prevActive.removeClass('active').css({
            color: ToolController_.defaultColor,
            background: 'none',
        })
        prevActive.parent().css({
            background: 'none',
        })
    }
}

//Other functions

function bestMatchInLegend(rgba, legendData) {
    var bestMatch = ''
    //Empty string if invisible value
    if (rgba.a == 0) return bestMatch

    var bestHeuristic = Infinity
    var l, h
    for (var i = 0; i < legendData.length; i++) {
        if (legendData[i].color.length > 0) {
            l = F_.hexToRGB(legendData[i].color)
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

function queryDataValue(url, lng, lat, numBands, callback) {
    numBands = numBands || 1
    var dataPath
    if (url.startsWith("/vsicurl/")) {
        dataPath = url
    }
    else {
        dataPath = 'Missions/' + L_.mission + '/' + url
    }
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
        function (data) {
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
