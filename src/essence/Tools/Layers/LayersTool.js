import $ from 'jquery'
import * as d3 from 'd3'
import Sortable from 'sortablejs'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'

import DataShaders from '../../Ancillary/DataShaders'
import LayerInfoModal from './LayerInfoModal/LayerInfoModal'
import Filtering from '../../Basics/Layers_/Filtering/Filtering'
import Help from '../../Ancillary/Help'
import CursorInfo from '../../Ancillary/CursorInfo'

import LegendTool from '../Legend/LegendTool.js'

import tippy from 'tippy.js'
import 'markjs'
import calls from '../../../pre/calls'
import * as tokml from '@maphubs/tokml'
import shpwrite from '@mapbox/shp-write'

import {
    evaluate_cmap,
    data as colormapData,
} from '../../../external/js-colormaps/js-colormaps.js'

import './LayersTool.css'

const helpKey = 'LayersTool'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div id='layersTool'>",
        "<div id='layersToolHeader'>",
            "<div id='filterLayers'>",
                "<div class='left'>",
                    '<div id="title">Layers</div>',
                    Help.getComponent(helpKey),
                "</div>",
                "<div class='right'>",
                    '<div class="vector" type="vector" title="Hide/Show Vector Layers"><i class="mdi mdi-vector-square mdi-18px"></i></div>',
                    '<div class="vectortile" type="vectortile" title="Hide/Show VectorTile Layers"><i class="mdi mdi-grid mdi-18px"></i></div>',
                    '<div class="tile" type="tile" title="Hide/Show Raster Layers"><i class="mdi mdi-map-outline mdi-18px"></i></div>',
                    '<div class="query" type="query" title="Hide/Show Query Layers"><i class="mdi mdi-binoculars mdi-18px"></i></div>',
                    '<div class="data" type="data" title="Hide/Show Data Layers"><i class="mdi mdi-file-table mdi-18px"></i></div>',
                    '<div class="model" type="model" title="Hide/Show Model Layers"><i class="mdi mdi-cube-outline mdi-18px"></i></div>',
                    '<div class="visible" type="visible" title="Hide/Show Off Layers"><i class="mdi mdi-eye mdi-18px"></i></div>',
                "</div>",
            "</div>",
            "<div id='searchLayers'>",
                '<i class="mdi mdi-magnify mdi-18px"></i>',
                "<input type='text' placeholder='Search Layers (# for tags)' />",
                '<div id="clear"><i class="mdi mdi-close mdi-18px"></i></div>',
                '<div id="expand"><i class="mdi mdi-arrow-expand-vertical mdi-18px"></i></div>',
                '<div id="collapse"><i class="mdi mdi-arrow-collapse-vertical mdi-18px"></i></div>',
            "</div>",
        "</div>",
        "<div id='layersToolContent'>",
            "<ul id='layersToolList'>",
            "</ul>",
        "</div>",
    "</div>",
].join('\n')

// These layers are a bit different and we need to account for that.
// Either they have no map data or not initial data
const quasiLayers = ['model', 'query']
const DEPTH_SIZE = 13
const INDENT_COLOR = 'var(--color-a)'

// The default color ramp used for image layer types
const IMAGE_DEFAULT_COLOR_RAMP = 'binary'

// The default color ramp used for tile layer types
const TILE_DEFAULT_COLOR_RAMP = 'viridis'

// The default color ramp used for velocity layer types
const VELOCITY_DEFAULT_COLOR_RAMP = 'rdylbu_r'

var LayersTool = {
    height: 0,
    width: 350,
    vars: {},
    MMGISInterface: null,
    orderingHistory: [],
    _maxDepth: 0,
    initialize: function () {
        //Get tool variables
        this.vars = L_.getToolVars('layers')

        // set custom width
        if (this.vars.width) {
            this.width = this.vars.width
        }
    },
    finalize: function () {
        //Order layers from url
        if (L_.FUTURES.tools) {
            for (let t of L_.FUTURES.tools) {
                const tUrl = t.split('$')
                if (tUrl[0] === 'LayersTool') {
                    LayersTool.orderingHistory = []
                    const orderHistory = tUrl[1].split('.')
                    orderHistory.forEach((o) => {
                        const oSplit = o.split('-')
                        LayersTool.orderingHistory.push([
                            parseInt(oSplit[0]),
                            parseInt(oSplit[1]),
                            parseInt(oSplit[2]),
                        ])
                    })
                    break
                }
            }
        }
        if (LayersTool.orderingHistory.length > 0) {
            LayersTool.make(null, true)
            LayersTool.destroy()
        }
    },
    make: function (t, fromInit) {
        this.MMGISInterface = new interfaceWithMMGIS(fromInit)
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        if (LayersTool.orderingHistory.length === 0) return ''
        return LayersTool.orderingHistory
            .map((hist) => `${hist[0]}-${hist[1]}-${hist[2]}`)
            .join('.')
    },
    setHeader: function () {},
    toggleHeader: function (elmIndex) {
        var found = false
        var done = false
        var elmDepth = [0]
        var wasOn = [false]
        var currentHeaderIdx = 0

        $('#layersToolList > li').each(function () {
            if (done) return
            var t = $(this)
            if (t.attr('id') == elmIndex) {
                found = true
                elmDepth = [t.attr('depth')]
                wasOn = [t.attr('childrenon') == 'true']
                currentHeaderIdx = 0
                t.attr('childrenon', wasOn[currentHeaderIdx] ? 'false' : 'true')
                t.find('.headerChevron').toggleClass('mdi-chevron-right')
                t.find('.headerChevron').toggleClass('mdi-chevron-down')
            } else if (found) {
                if (t.attr('depth') <= elmDepth[currentHeaderIdx]) {
                    if (currentHeaderIdx <= 0) done = true
                    else {
                        while (t.attr('depth') <= elmDepth[currentHeaderIdx]) {
                            elmDepth.pop()
                            wasOn.pop()
                            currentHeaderIdx--

                            if (currentHeaderIdx < 0) {
                                done = true
                                break
                            }
                        }
                    }
                }
                if (!done) {
                    const nextDepth =
                        parseInt(t.attr('depth')) >
                        parseInt(elmDepth[currentHeaderIdx])

                    // Hide if collapsing whole group or not every header up to the point was false
                    if (
                        currentHeaderIdx === 0
                            ? wasOn[0] === true
                            : !wasOn.every((w) => w === false)
                    ) {
                        // hide
                        if (nextDepth) t.attr('on', 'false')
                        t.css('overflow', 'hidden')
                        t.css('height', '0')
                        t.css('margin-top', '0px')
                        t.css('margin-bottom', '0px')
                    } else {
                        // show
                        if (t.attr('on') == 'true' || nextDepth) {
                            t.css('height', 'auto')
                            t.css('margin-top', '1px')
                            t.css('margin-bottom', '1px')
                        }
                        if (nextDepth) t.attr('on', 'true')
                    }

                    if (t.attr('type') == 'header') {
                        const childrenon = t.attr('childrenon') == 'true'

                        // Only expand subheader if we're opening
                        elmDepth.push(t.attr('depth'))
                        wasOn.push(!childrenon)
                        currentHeaderIdx++

                        const chevron = t.find('.headerChevron')
                        if (childrenon) {
                            // arrow down
                            if (chevron.hasClass('mdi-chevron-right'))
                                chevron.removeClass('mdi-chevron-right')
                            if (!chevron.hasClass('mdi-chevron-down'))
                                chevron.addClass('mdi-chevron-down')
                        } else {
                            // arrow right
                            if (chevron.hasClass('mdi-chevron-down'))
                                chevron.removeClass('mdi-chevron-down')
                            if (!chevron.hasClass('mdi-chevron-right'))
                                chevron.addClass('mdi-chevron-right')
                        }
                    }
                }
            }
        })
    },
    populateCogScale: function (layerName) {
        let layer = L_.asLayerUUID(layerName)
        let units = ''
        layer = L_.layers.data[layer]
        if (L_.layers.layer[layer.name] === null) return

        if (
            !layer.url.startsWith('stac-collection:') &&
            !layer.url.startsWith('COG:') &&
            layer.type !== 'image' &&
            layer.type !== 'velocity'
        )
            return
        if (
            layer.cogTransform !== true &&
            (layer.url.startsWith('stac-collection:') ||
                layer.url.startsWith('COG:') ||
                layer.type === 'image')
        )
            return
        if (
            layer.type === 'image' &&
            L_.layers.layer[layer.name].hasOwnProperty('georasters') &&
            L_.layers.layer[layer.name].georasters[0].numberOfRasters !== 1
        )
            return
        // set units to proper unit property
        if (layer.type === 'velocity') {
            if (layer.kind === 'particles') {
                units = layer.variables?.particles?.units ?? ''
            } else {
                units = layer.variables?.streamlines?.units ?? ''
            }
        } else {
            units = layer.cogUnits
        }

        const dynamicLegendConf = []
        const imgElement = document.getElementById(
            `titlerCogColormapImage_${L_.asLayerUUID(layerName)}`
        )
        const canvasElement = document.createElement('canvas')
        document.body.appendChild(canvasElement)
        canvasElement.style.display = 'none'
        canvasElement.width = 256
        canvasElement.height = 1
        const context = canvasElement.getContext('2d')
        if (imgElement && layer.type === 'tile') {
            context.drawImage(imgElement, 0, 0, 256, 1, 0, 0, 256, 1)
        }

        const min =
            layer.currentCogMin == null
                ? layer.cogMin == null
                    ? layer.variables?.streamlines?.minVelocity
                    : layer.cogMin
                : layer.currentCogMin
        const max =
            layer.currentCogMax == null
                ? layer.cogMax == null
                    ? layer.variables?.streamlines?.maxVelocity
                    : layer.cogMax
                : layer.currentCogMax

        for (let i = 0; i < 9; i++) {
            let value =
                Math.round(F_.linearScale([0, 8], [min, max], i) * 100) / 100
            let label = `${
                Math.round(F_.linearScale([0, 8], [min, max], i) * 100) / 100
            }${units || ''}`
            if (i !== 0 && i !== 8) {
                // Match all id
                $(`[id=tileCogLegend_${i}]`).html(label)
            }

            let color
            if (imgElement && layer.type === 'tile') {
                const c = context.getImageData(
                    parseInt((255 / 9) * i),
                    0,
                    1,
                    1
                ).data
                color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`
            } else if (
                layer.type === 'image' ||
                layer.type === 'velocity' ||
                !imgElement
            ) {
                const layerColormap = ['tile', 'image'].includes(layer.type)
                    ? layer.cogColormap
                    : layer?.variables?.streamlines?.colorScale
                let { colormap, reverse } = LayersTool.findJSColormap(
                    layer,
                    layerColormap
                )

                let scaledPixelValue
                if (min !== undefined && max !== undefined) {
                    // scale from 0 - 1
                    const range = max - min
                    scaledPixelValue = (value - min) / range
                    if (!(0 <= scaledPixelValue && scaledPixelValue <= 1)) {
                        if (scaledPixelValue <= 0) {
                            scaledPixelValue = 0
                        } else if (scaledPixelValue >= 1.0) {
                            scaledPixelValue = 1
                        }
                    }
                } else {
                    // If cog transform option is not turned on,
                    scaledPixelValue = i / 9
                    label = ''
                }

                const hex = evaluate_cmap(scaledPixelValue, colormap, reverse)
                const rgb = hex.join(',')
                color = `rgb(${rgb})`
            }

            dynamicLegendConf.push({
                color,
                strokecolor: null,
                shape: 'continuous',
                value: label,
            })
        }
        document.body.removeChild(canvasElement)

        L_.layers.data[layer.name]._legend = dynamicLegendConf

        $('#tileCogColormapMapLines').empty()
        for (let i = 0; i < 9; i++) {
            $('#tileCogColormapMapLines').append(
                `<li style="height: ${(1 / 9) * 100}%;"></li>`
            )
        }

        $('.tilerescalecogmin').val(min)
        $('.tilerescalecogmax').val(max)
    },
    findJSColormap: function (layer, layerColormap) {
        if (!['image', 'tile', 'velocity'].includes(layer.type)) return

        let colormap
        // Default to predefined values if the layer's colormap value is invalid
        if (layer.type === 'image') {
            colormap = layerColormap || IMAGE_DEFAULT_COLOR_RAMP
        } else if (layer.type === 'tile') {
            colormap = layerColormap || TILE_DEFAULT_COLOR_RAMP
        } else if (layer.type === 'velocity') {
            colormap = layerColormap || VELOCITY_DEFAULT_COLOR_RAMP
        }

        // js-colormaps data object only contains the non reversed color so we need to track if the color is reversed
        let reverse = false
        if (colormap.toLowerCase().endsWith('_r')) {
            colormap = colormap.substring(0, colormap.length - 2)
            reverse = true
        }

        let index = Object.keys(colormapData).findIndex((v) => {
            return v.toLowerCase() === colormap.toLowerCase()
        })

        if (index > -1) {
            colormap = Object.keys(colormapData)[index]
        }
        return { reverse, colormap }
    },
}

//
function interfaceWithMMGIS(fromInit) {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    var tools = d3.select('#toolPanel')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    if (fromInit) tools.style('display', 'none')
    //Add the markup to tools or do it manually
    tools.html(markup)

    Help.finalize(helpKey)

    let headerI = 0

    LayersTool._maxDepth = 0

    //This is where the layers list is created in the tool panel.
    depthTraversal(L_.configData.layers, {}, 0)

    function depthTraversal(node, parent, depth) {
        LayersTool._maxDepth = Math.max(LayersTool._maxDepth, depth)
        for (var i = 0; i < node.length; i++) {
            let currentOpacity
            let currentBrightness
            let currentContrast
            let currentSaturation
            let currentBlend
            //Build layerExport
            var layerExport
            switch (node[i].type) {
                case 'vector':
                case 'query':
                    // prettier-ignore
                    layerExport = [
                        /*
                        '<ul>',
                            L_.Coordinates.mainType != 'll' ? ['<li>',
                                '<div class="layersToolExportGeoJSON">',
                                    `<div>Export GeoJSON (${L_.Coordinates.getMainTypeName()})</div>`,
                                '</div>',
                            '</li>'].join('\n') : '',
                            '<li>',
                                '<div class="layersToolExportSourceGeoJSON">',
                                    `<div>Export GeoJSON ${L_.Coordinates.mainType != 'll' ? '(lonlat)' : '' }</div>`,
                                '</div>',
                            '</li>',
                            L_.Coordinates.mainType != 'll' ? ['<li>',
                                '<div class="layersToolExportKML">',
                                    `<div>Export KML (${L_.Coordinates.getMainTypeName()})</div>`,
                                '</div>',
                            '</li>'].join('\n') : '',
                            '<li>',
                                '<div class="layersToolExportSourceKML">',
                                    `<div>Export KML ${L_.Coordinates.mainType != 'll' ? '(lonlat)' : '' }</div>`,
                                '</div>',
                            '</li>',
                        '</ul>',
                        */
                        '<ul>',
                            `<li class="layersToolExport">`,
                                `<div><i class='mdi mdi-download mdi-14px'></i><div>Export</div></div>`,
                                '<div>',
                                    '<div>Format</div>',
                                    '<select class="layersToolExportFormat dropdown">',
                                        '<option value="geojson" selected>GeoJSON</option>',
                                        '<option value="kml">KML</option>',
                                        '<option value="shp">SHP</option>',
                                    '</select>',
                                '</div>',
                                node[i]?.variables?.dynamicExtent === true ? ['<div>',
                                    '<div>Extent</div>',
                                    '<select class="layersToolExportExtent dropdown">',
                                        '<option value="local" selected>Current Extent</option>',
                                        (node[i]?.variables?.getFeaturePropertiesOnClick === true && node[i]?._lastGeodatasetRequestBody != null) ? '<option value="raw-extent" selected>Current Extent w/ Props</option>' : null,
                                        '<option value="raw">Entire File</option>',
                                    '</select>',
                                '</div>',].join('\n') : '',
                                L_.Coordinates.mainType != 'll' ? [
                                '<div>',
                                    '<div>Coords</div>',
                                    '<select class="layersToolExportCoords dropdown">',
                                        '<option value="source" selected>Source Coordinates</option>',
                                        `<option value="${L_.Coordinates.mainType}">Converted (${L_.Coordinates.mainType})</option>`,
                                    '</select>',
                                '</div>'] .join('\n') : '',
                                '<div><div class="layersToolExportGo mmgisButton5">Export</div></div>',
                            `</li>`,
                        '</ul>',
                    ].join('\n')
                    break
                case 'data':
                case 'tile':
                    layerExport = ''
                    // Add download URL for raster layers
                    if (node[i].hasOwnProperty('variables')) {
                        if (node[i].variables.hasOwnProperty('downloadURL')) {
                            layerExport = [
                                '<ul>',
                                '<li>',
                                '<div class="layersToolExportSourceGeoJSON">',
                                `<div><a href="` +
                                    node[i].variables.downloadURL +
                                    `" target="_blank">Download Data</a></div>`,
                                '</div>',
                                '</li>',
                                '</ul>',
                            ].join('\n')
                        }
                    }
                    break
                default:
                    layerExport = ''
            }

            // Build timeDisplay
            var timeDisplay = ''
            if (node[i].time != null) {
                if (node[i].time.enabled == true) {
                    // prettier-ignore
                    timeDisplay = [
                        '<ul>',
                            '<li class="layerTimeTitle">',
                                '<div>Time</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                '<div>Start Time</div>',
                                '<label class="starttime ' +
                                    F_.getSafeName(node[i].name) +
                                    '">' +
                                    node[i].time.start +
                                    '</label>',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                '<div>End Time</div>',
                                '<label class="endtime ' +
                                    F_.getSafeName(node[i].name) +
                                    '">' +
                                    node[i].time.end +
                                    '</label>',
                                '</div>',
                            '</li>',
                            (
                                node[i].time.refreshIntervalEnabled === true
                            ) ? 
                            [
                            '<li>',
                                '<div>',
                                '<div>Auto-Refreshes Every</div>',
                                '<label class="autoRefreshInterval ' +
                                    F_.getSafeName(node[i].name) +
                                    '">' +
                                    (node[i].time.refreshIntervalAmount || 60) +
                                    ' Seconds</label>',
                                '</div>',
                            '</li>'
                            ].join('\n')
                            : null,
                        '</ul>',
                    ].join('\n')
                }
            }

            //Build settings object
            var settings
            let additionalSettings = ''
            switch (node[i].type) {
                case 'vector':
                case 'vectortile':
                    settings = getVectorLayerSettings(node[i].name)
                    break
                case 'tile':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.layers.opacity[node[i].name]

                    currentBrightness =
                        node[i]?.style?.brightness != null
                            ? node[i].style.brightness
                            : 1
                    const defaultBrightness = currentBrightness
                    currentContrast =
                        node[i]?.style?.contrast != null
                            ? node[i].style.contrast
                            : 1
                    const defaultContrast = currentContrast
                    currentSaturation =
                        node[i]?.style?.saturation != null
                            ? node[i].style.saturation
                            : 1
                    const defaultSaturation = currentSaturation
                    currentBlend =
                        node[i]?.style?.blend != null
                            ? node[i].style.blend
                            : 'none'
                    const defaultBlend = currentBlend

                    if (L_.layers.filters[node[i].name]) {
                        let f = L_.layers.filters[node[i].name]

                        currentBrightness =
                            f['brightness'] == null
                                ? currentBrightness
                                : parseFloat(f['brightness'])
                        currentContrast =
                            f['contrast'] == null
                                ? currentContrast
                                : parseFloat(f['contrast'])
                        currentSaturation =
                            f['saturate'] == null
                                ? currentSaturation
                                : parseFloat(f['saturate'])
                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? currentBlend
                                : f['mix-blend-mode']
                    }

                    additionalSettings = ''
                    if (
                        node[i].cogTransform === true &&
                        typeof node[i].url === 'string' &&
                        (node[i].url.split(':')[0] === 'stac-collection' ||
                            node[i].url.split(':')[0] === 'COG')
                    ) {
                        if (window.mmgisglobal.WITH_TITILER === 'true') {
                            // prettier-ignore
                            additionalSettings = [
                                `<img id="titlerCogColormapImage_${node[i].name}" src="${window.location.origin}${(
                                            window.location.pathname || ''
                                        ).replace(/\/$/g, '')}/titiler/colorMaps/${node[i].cogColormap}?format=png"></img>`,
                            ].join('\n')
                        } else {
                            let { colormap, reverse } =
                                LayersTool.findJSColormap(
                                    node[i],
                                    node[i].cogColormap
                                )

                            additionalSettings = colormapData[
                                colormap
                            ].colors.map((hex) => {
                                let rgb = hex
                                    .map((v) => {
                                        return Math.floor(v * 255)
                                    })
                                    .join(',')
                                return `<div style="background: rgb(${rgb}); width: 20px; height: 100%; margin: 0px; flex-grow: 1;"></div>`
                            })

                            if (reverse === true) {
                                additionalSettings.reverse()
                            }

                            additionalSettings = [
                                '<div id="titlerCogColormapCSS">',
                                additionalSettings.join('\n'),
                                '</div>',
                            ].join('\n')
                        }

                        // prettier-ignore
                        additionalSettings = [
                            '<div class="layerSettingsTitle">',
                                '<div>COG Settings</div>',
                                `<div class="resetCog" title="Reset COG Settings" layername="${node[i].name}">`,
                                    '<i class="mdi mdi-restore mdi-18px"></i>',
                                '</div>',
                            '</div>',
                            `<li class="tileCogMin">`,
                                '<div>',
                                    '<div>Rescale Min Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmin' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="min" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMin : node[i].cogMin}" default="0">`,
                                        node[i].cogUnits != null ? `<div class='tileCogUnits'>${node[i].cogUnits}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<li id="tileCogLegend_1" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_2" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_3" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_4" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_5" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_6" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_7" class="tileCogLegend">-</li>',
                            `<li class="tileCogMax">`,
                                '<div>',
                                    '<div>Rescale Max Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmax' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="max" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMax : node[i].cogMax}" default="255">`,
                                        node[i].cogUnits != null ? `<div class='tileCogUnits'>${node[i].cogUnits}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<div class="tileCogColor">',
                                `<li class="tileCogColormap">`,
                                    `<div class="tileCogColormapMap">`,
                                        additionalSettings,
                                        `<ul id="tileCogColormapMapLines"></ul>`,
                                    `</div>`,
                                '</li>',
                            '</div>'
                        ].join('\n')
                    }
                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.layers.opacity[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Brightness</div>',
                                        '<input class="tilefilterslider slider2" filter="brightness" unit="%" layername="' + node[i].name + '" type="range" min="0" max="3" step="0.05" value="' + currentBrightness + '" default="' + defaultBrightness + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Contrast</div>',
                                    '<input class="tilefilterslider slider2" filter="contrast" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentContrast + '" default="' + defaultContrast + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Saturation</div>',
                                    '<input class="tilefilterslider slider2" filter="saturate" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentSaturation + '" default="' + defaultSaturation + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Blend</div>',
                                    '<select class="tileblender dropdown" layername="' + node[i].name + '" defaultBlend="' + defaultBlend + '">',
                                        '<option value="unset"' + (currentBlend == 'none' ? ' selected' : '') + '>None</option>',
                                        '<option value="color"' + (currentBlend == 'color' ? ' selected' : '') + '>Color</option>',
                                        //'<option value="color-burn">Color Burn</option>',
                                        //'<option value="color-dodge">Color Dodge</option>',
                                        //'<option value="darken">Darken</option>',
                                        //'<option value="difference">Difference</option>',
                                        //'<option value="exclusion">Exclusion</option>',
                                        //'<option value="hard-light">Hard Light</option>',
                                        //'<option value="hue">Hue</option>',
                                        //'<option value="lighten">Lighten</option>',
                                        //'<option value="luminosity">Luminosity</option>',
                                        //'<option value="multiply">Multiply</option>',
                                        '<option value="overlay"' + (currentBlend == 'overlay' ? ' selected' : '') + '>Overlay</option>',
                                        //'<option value="saturation">Saturation</option>',
                                        //'<option value="screen">Screen</option>',
                                        //'<option value="soft-light" ' + (currentBlend == 'soft-light' ? ' selected' : '') + '>Soft Light</option>',
                                    '</select>',
                                '</div>',
                            '</li>',
                            additionalSettings,
                            /*
                            '<li>',
                                '<div>',
                                    '<div>Hue</div>',
                                    '<input class="tilefilterslider slider2" filter="hue-rotate"  unit="deg" layername="' + node[i].name + '" type="range" min="0" max="3.60" step="0.1" value="0" default="0">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Invert</div>',
                                    '<input class="tilefilterslider slider2" filter="invert"  unit="%" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.05" value="0" default="0">',
                                '</div>',
                            '</li>',
                            */
                        '</ul>'
                    ].join('\n')
                    break
                case 'data':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.layers.opacity[node[i].name]

                    currentBlend = 'none'
                    if (L_.layers.filters[node[i].name]) {
                        let f = L_.layers.filters[node[i].name]

                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? 'none'
                                : f['mix-blend-mode']
                    }

                    additionalSettings = ''
                    const shader = F_.getIn(node[i], 'variables.shader')

                    if (shader && DataShaders[shader.type]) {
                        // prettier-ignore
                        additionalSettings = [
                            DataShaders[shader.type].getHTML(node[i].name, shader)
                        ].join('\n')
                    }

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.layers.opacity[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Blend</div>',
                                    '<select class="tileblender dropdown" layername="' + node[i].name + '">',
                                        '<option value="unset"' + (currentBlend == 'none' ? ' selected' : '') + '>None</option>',
                                        '<option value="color"' + (currentBlend == 'color' ? ' selected' : '') + '>Color</option>',
                                        '<option value="overlay"' + (currentBlend == 'overlay' ? ' selected' : '') + '>Overlay</option>',
                                    '</select>',
                                '</div>',
                            '</li>',
                            additionalSettings,
                        '</ul>'
                    ].join('\n')
                    break
                case 'model':
                case 'query':
                case 'velocity':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.layers.opacity[node[i].name]

                    if (node[i].kind === 'streamlines') {
                        if (window.mmgisglobal.WITH_TITILER === 'true') {
                            // prettier-ignore
                            additionalSettings = [
                                `<img id="titlerCogColormapImage_${node[i].name}" src="${window.location.origin}${(
                                            window.location.pathname || ''
                                        ).replace(/\/$/g, '')}/titiler/colorMaps/${node[i].variables?.streamlines?.colorScale?.toLowerCase() || 'rdylbu_r'}?format=png"></img>`,
                            ].join('\n')
                        } else {
                            let { colormap, reverse } =
                                LayersTool.findJSColormap(
                                    node[i],
                                    node[i].variables?.streamlines?.colorScale
                                )

                            additionalSettings = colormapData[
                                colormap
                            ].colors.map((hex) => {
                                let rgb = hex
                                    .map((v) => {
                                        return Math.floor(v * 255)
                                    })
                                    .join(',')
                                return `<div style="background: rgb(${rgb}); width: 20px; height: 100%; margin: 0px; flex-grow: 1;"></div>`
                            })

                            if (reverse === true) {
                                additionalSettings.reverse()
                            }

                            additionalSettings = [
                                '<div id="titlerCogColormapCSS">',
                                additionalSettings.join('\n'),
                                '</div>',
                            ].join('\n')
                        }

                        // prettier-ignore
                        additionalSettings = [
                            '<div class="layerSettingsTitle">',
                                '<div>Color Settings</div>',
                                `<div class="resetCog" title="Reset Color Settings" layername="${node[i].name}">`,
                                    '<i class="mdi mdi-restore mdi-18px"></i>',
                                '</div>',
                            '</div>',
                            `<li class="tileCogMin">`,
                                '<div>',
                                    '<div>Rescale Min Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmin' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="min" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMin : node[i].variables?.streamlines?.minVelocity}" default="0">`,
                                        node[i].variables?.streamlines?.units != null ? `<div class='tileCogUnits'>${node[i].variables?.streamlines?.units}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<li id="tileCogLegend_1" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_2" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_3" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_4" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_5" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_6" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_7" class="tileCogLegend">-</li>',
                            `<li class="tileCogMax">`,
                                '<div>',
                                    '<div>Rescale Max Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmax' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="max" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMax : node[i].variables?.streamlines?.maxVelocity}" default="255">`,
                                        node[i].variables?.streamlines?.units != null ? `<div class='tileCogUnits'>${node[i].variables?.streamlines?.units}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<div class="tileCogColor">',
                                `<li class="tileCogColormap">`,
                                    `<div class="tileCogColormapMap">`,
                                        additionalSettings,
                                        `<ul id="tileCogColormapMapLines"></ul>`,
                                    `</div>`,
                                '</li>',
                            '</div>'
                        ].join('\n')
                    }

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.layers.opacity[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            additionalSettings,
                    ].join('\n')
                    break
                case 'image':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.layers.opacity[node[i].name]

                    if (
                        node[i].cogTransform === true &&
                        typeof node[i].url === 'string' &&
                        L_.layers.layer[node[i].name].georasters &&
                        L_.layers.layer[node[i].name].georasters[0]
                            .numberOfRasters === 1
                    ) {
                        if (window.mmgisglobal.WITH_TITILER === 'true') {
                            // prettier-ignore
                            additionalSettings = [
                                `<img id="titlerCogColormapImage_${node[i].name}" src="${window.location.origin}${(
                                            window.location.pathname || ''
                                        ).replace(/\/$/g, '')}/titiler/colorMaps/${node[i].cogColormap}?format=png"></img>`,
                            ].join('\n')
                        } else {
                            let { colormap, reverse } =
                                LayersTool.findJSColormap(
                                    node[i],
                                    node[i].cogColormap
                                )

                            additionalSettings = colormapData[
                                colormap
                            ].colors.map((hex) => {
                                let rgb = hex
                                    .map((v) => {
                                        return Math.floor(v * 255)
                                    })
                                    .join(',')
                                return `<div style="background: rgb(${rgb}); width: 20px; height: 100%; margin: 0px; flex-grow: 1;"></div>`
                            })

                            if (reverse === true) {
                                additionalSettings.reverse()
                            }

                            additionalSettings = [
                                '<div id="titlerCogColormapCSS">',
                                additionalSettings.join('\n'),
                                '</div>',
                            ].join('\n')
                        }

                        // prettier-ignore
                        additionalSettings = [
                            '<div class="layerSettingsTitle">',
                                '<div>COG Settings</div>',
                                `<div class="resetCog" title="Reset COG Settings" layername="${node[i].name}">`,
                                    '<i class="mdi mdi-restore mdi-18px"></i>',
                                '</div>',
                            '</div>',
                            `<li class="tileCogMin">`,
                                '<div>',
                                    '<div>Rescale Min Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmin' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="min" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMin : node[i].cogMin}" default="0">`,
                                        node[i].cogUnits != null ? `<div class='tileCogUnits'>${node[i].cogUnits}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<li id="tileCogLegend_1" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_2" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_3" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_4" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_5" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_6" class="tileCogLegend">-</li>',
                            '<li id="tileCogLegend_7" class="tileCogLegend">-</li>',
                            `<li class="tileCogMax">`,
                                '<div>',
                                    '<div>Rescale Max Value</div>',
                                    '<div>',
                                        `<input class='tilerescalecogmax' style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${node[i].name}" parameter="max" type="number" value="${node[i].currentCogMin != null ? node[i].currentCogMax : node[i].cogMax}" default="255">`,
                                        node[i].cogUnits != null ? `<div class='tileCogUnits'>${node[i].cogUnits}</div>`: '',
                                    '</div>',
                                '</div>',
                            '</li>',
                            '<div class="tileCogColor">',
                                `<li class="tileCogColormap">`,
                                    `<div class="tileCogColormapMap">`,
                                        additionalSettings,
                                        `<ul id="tileCogColormapMapLines"></ul>`,
                                    `</div>`,
                                '</li>',
                            '</div>'
                        ].join('\n')
                    }

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.layers.opacity[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            additionalSettings,
                    ]

                    /*
                    let min = null, max = null
                    if (node[i].variables && node[i].variables.image) {
                        min = node[i].variables.image.defaults[1].min
                        max = node[i].variables.image.defaults[1].max
                        if (min !== null && max !== null) {
                            settings = [
                                    settings.join('\n'),
                                    '<li>',
                                        '<div>',
                                            '<div>Min</div>',
                                            '<div>',
                                                '<div v="' + (min || "0") + "," + (max || "255") + '" pick="imagerangepick" class="picker imagerange stylevalue" style="float: right;">' + (min || "0") + " ➝ " + (max || "255") + '</div>',
                                                '<div class="picking imagerangepick small visibilityRangePicker" style="display: true">',
                                                    '<div id="image-slider-range-' + node[i].name + '" class="svelteSlider" style="width: 130px; overflow: hidden; margin-right: -5px; height: 100%;"></div>',
                                                '</div>',
                                            '</div>',
                                        '</div>',
                                    '</li>',
                            ]
                        }
                    }
*/
                    settings = [settings.join('\n'), '</ul>'].join('\n')
                    break
                default:
                    settings = ''
            }

            //Build and add layer object
            switch (node[i].type) {
                case 'header':
                    // prettier-ignore
                    $('#layersToolList').append(
                        [
                            `<li class="layersToolHeader" id="header_${headerI}" name="${node[i].name}" type="${node[i].type}" depth="${depth}" childrenon="true" style="margin-bottom: 1px;">`,
                                `<div class="title" id="headerstart" style="border-left: ${depth * DEPTH_SIZE}px solid ${INDENT_COLOR};">`,
                                    '<div class="layersToolColor ' + node[i].type + '">',
                                        '<i class="mdi mdi-drag-vertical mdi-12px"></i>',
                                    '</div>',
                                    '<div>',
                                        '<i class="headerChevron mdi mdi-chevron-down mdi-24px"></i>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].display_name}">`,
                                        node[i].display_name,
                                    '</div>',
                                    '<div class="layerCount">',
                                        (node[i].sublayers ? node[i].sublayers.length : '0'),
                                    '</div>',
                                    '<div title="Information" class="LayersToolInfo" id="layerinfo' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-information-outline mdi-18px" name="layerinfo"></i>',
                                    '</div>',
                                    `<div class="headerPowerState ${'on'}" title="Toggle all on inner-layers on or off.">`,
                                        '<i class="mdi mdi-power-off mdi-18px"></i>',
                                    '</div>',
                                '</div>',
                            '</li>',
                        ].join('\n'))
                    headerI++
                    break
                default:
                    // prettier-ignore
                    $('#layersToolList').append(
                        [
                            '<li id="LayersTool' + F_.getSafeName(node[i].name) + '" class="' + ((!quasiLayers.includes(node[i].type) && L_.layers.layer[node[i].name] == null) ? 'layernotfound' : '') + '" type="' + node[i].type + '" on="true" depth="' + depth + '" name="' + node[i].name + '" parent="' + parent.name + '"  style="margin-bottom: 1px;">',
                                `<div class="title" id="layerstart${F_.getSafeName(node[i].name)}" style="border-left: ${depth * DEPTH_SIZE}px solid ${INDENT_COLOR};">`,
                                    '<div class="layersToolColor ' + node[i].type + '">',
                                        '<i class="mdi mdi-drag-vertical mdi-12px"></i>',
                                    '</div>',
                                    '<div class="checkboxcont">',
                                        '<div class="checkbox ' + (L_.layers.on[node[i].name] ? 'on' : 'off') + '"></div>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].display_name}">`,
                                        node[i].display_name,
                                    '</div>',
                                    node[i].type === 'vector' ?
                                    ['<div class="reload" title="Reload Layer">',
                                        '<i class="mdi mdi-refresh mdi-18px"></i>',
                                    '</div>'].join('\n')
                                    : null,
                                    (layerExport != '') ? ['<div title="Download" class="layerDownload" id="layerexport' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-download mdi-18px" name="layerexport"></i>',
                                    '</div>'].join('\n') : '',
                                    '<div title="Settings" class="gears" id="layersettings' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-tune mdi-18px" name="layersettings"></i>',
                                    '</div>',
                                    '<div title="Locate" class="locate" id="layerlocate' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-crosshairs-gps mdi-18px" name="layerlocate"></i>',
                                    '</div>',
                                    '<div title="Information" class="LayersToolInfo" id="layerinfo' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-information-outline mdi-18px" name="layerinfo"></i>',
                                    '</div>',
                                    (timeDisplay != '') ? ['<div class="time" id="timesettings' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-clock mdi-18px" name="timesettings" style="color:' + node[i].time.status + '"></i>',
                                    '</div>'].join('\n') : '',
                                '</div>',
                                '<div class="layerExport ' + node[i].type + '">',
                                    layerExport,
                                '</div>',
                                '<div class="timeDisplay settings ' + node[i].type + '">',
                                    timeDisplay,
                                '</div>',
                                '<div class="settings settingsmain' + node[i].type + '">',
                                    '<div class="layerSettingsTitle">',
                                        '<div>Layer Settings</div>',
                                        '<div class="reset" title="Reset Settings">',
                                            '<i class="mdi mdi-restore mdi-18px"></i>',
                                        '</div>',
                                    '</div>',
                                    settings,
                                '</div>',
                            '</li>',
                        ].join('\n')
                    )

                    //Attach DataShader events
                    if (node[i].type === 'data') {
                        const shader = F_.getIn(node[i], 'variables.shader')
                        if (
                            shader &&
                            DataShaders[shader.type] &&
                            typeof DataShaders[shader.type].attachEvents ===
                                'function'
                        )
                            DataShaders[shader.type].attachEvents(
                                node[i].name,
                                shader
                            )
                    }

                    // Populate the legends for tile (COG), image, and velocity layers
                    if (
                        (['image', 'tile'].includes(node[i].type) &&
                            node[i].cogTransform) ||
                        node[i].type === 'velocity'
                    ) {
                        LayersTool.populateCogScale(node[i].name)
                    }

                    break
            }

            if (node[i].sublayers)
                depthTraversal(node[i].sublayers, node[0], depth + 1)
        }
    }

    async function toggleLayer(checkbox) {
        if (checkbox.hasClass('loading')) {
            console.warn(
                'LayersTool - Cannot toggle layer that is still loading.'
            )
            return
        }

        let li = checkbox.parent().parent().parent()
        if (li.attr('type') !== 'header') {
            const layerName = li.attr('name')

            checkbox.addClass('loading')
            L_.setGlobalLoading(layerName)
            await L_.toggleLayer(L_.layers.data[layerName])
            checkbox.removeClass('loading')
            L_.setGlobalLoaded(layerName)

            if (
                quasiLayers.includes(li.attr('type')) ||
                L_.layers.layer[layerName]
            )
                checkbox.toggleClass('on')
            else if (
                !quasiLayers.includes(li.attr('type')) &&
                L_.layers.layer[layerName] == null
            )
                li.addClass('layernotfound')

            if (checkbox.hasClass('on')) {
                if (
                    L_.layers.attachments[layerName] &&
                    Object.keys(L_.layers.attachments[layerName]).length > 0 &&
                    !$(
                        `#LayersTool${F_.getSafeName(
                            layerName
                        )} .sublayerHeading`
                    ).length
                ) {
                    // refresh settings
                    const mainSettings = $(
                        `#LayersTool${F_.getSafeName(
                            layerName
                        )} > .settingsmainvector`
                    )
                    if (mainSettings) {
                        mainSettings.html(getVectorLayerSettings(layerName))
                        setSublayerEvents()
                    }
                }
            }

            // Dispatch `layerVisibilityChange` event
            let _event = new CustomEvent('layerVisibilityChange', {
                detail: {
                    layer: L_.layers.data[layerName],
                    layerName,
                    visible: L_.layers.on[layerName],
                },
            })
            document.dispatchEvent(_event)
        }
    }
    //Add event functions and whatnot
    //Makes layers clickable on and off
    $('#layersToolList > li > .title .checkbox').on('click', function () {
        // First, find all parents header (if any), and set power state to on again
        const elm = $(this).parent().parent().parent()
        const elmIdx = $('#layersToolList > li').index(elm)
        const elmDepth = parseInt(elm.attr('depth'))
        // We need exactly one depth for each depth above elmDepth to 0
        const depthsChecklist = {}
        const listLis = $('#layersToolList').children('li').get()
        $(listLis.reverse()).each(function (idx, item) {
            idx = listLis.length - 1 - idx
            if (idx < elmIdx && $(item).attr('type') === 'header') {
                const depth = parseInt($(item).attr('depth'))
                if (depth < elmDepth && depthsChecklist[depth] == null) {
                    depthsChecklist[depth] = true
                    // Switch power state
                    $(item).find('.headerPowerState').addClass('on')
                    $(item).find('.headerPowerState i').removeClass('mdi-power')
                    $(item)
                        .find('.headerPowerState i')
                        .addClass('mdi-power-off')
                }
            }
        })

        // Then toggle as normal
        toggleLayer($(this))
    })

    setSublayerEvents()

    // Collapse header
    $('.layersToolHeader').on('click', function () {
        LayersTool.toggleHeader($(this).attr('id'))
    })
    // Toggle between all-off and previous-on states
    // Power state switches back to on if any inner layer is toggled (done elsewhere)
    $('.headerPowerState').on('click', function (e) {
        e.stopPropagation()

        const wasOn = $(this).hasClass('on')
        const headElm = $(this).parent().parent()
        const name = headElm.attr('name')
        const elmIdx = $('#layersToolList > li').index(headElm)
        const elmDepth = parseInt(headElm.attr('depth'))

        if (wasOn) {
            // Then turn off
            LayersTool._header_states = LayersTool._header_states || {}
            LayersTool._header_states[name] = []
            // Iterate every layer below
            let stillUnder = true
            $('#layersToolList')
                .children('li')
                .each(function (idx, item) {
                    if (idx > elmIdx) {
                        if (stillUnder && $(item).attr('depth') > elmDepth) {
                            // Save state and then turn off
                            if (
                                L_.layers.on[$(item).attr('name')] &&
                                $(item).attr('type') !== 'header'
                            ) {
                                LayersTool._header_states[name].push(
                                    $(item).attr('name')
                                )
                                toggleLayer($(item).find('.title .checkbox'))
                            }
                        } else {
                            stillUnder = false
                        }
                    }
                })
            // Finally switch power state
            $(this).removeClass('on')
            $(this).find('i').removeClass('mdi-power-off')
            $(this).find('i').addClass('mdi-power')
        } else {
            // Then turn on
            if (LayersTool._header_states && LayersTool._header_states[name]) {
                LayersTool._header_states[name].forEach((layerName) => {
                    toggleLayer(
                        $(
                            `#LayersTool${F_.getSafeName(
                                layerName
                            )} .title .checkbox`
                        )
                    )
                })
            }

            // Finally switch power state
            $(this).addClass('on')
            $(this).find('i').removeClass('mdi-power')
            $(this).find('i').addClass('mdi-power-off')
        }
    })

    //Enables the export dialogue box
    $('.layerName, .layerDownload').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('download_on')
        $('.layerDownload').parent().parent().removeClass('download_on')
        $('.gears').parent().parent().removeClass('gears_on')
        if (!wasOn) li.addClass('download_on')
    })
    //Enables the setting dialogue box
    $('.layerName, .gears').on('click', async function () {
        const li = $(this).parent().parent()
        const type = li.attr('type')
        const layerName = li.attr('name')
        if (type === 'header') return

        const wasOn = li.hasClass('gears_on')
        $('.layerDownload').parent().parent().removeClass('download_on')
        $('.gears').parent().parent().removeClass('gears_on')
        if (!wasOn) li.addClass('gears_on')

        //Support Filtering 1
        if (['vector', 'query'].includes(type)) {
            Filtering.destroy()
        }

        // Turn layer on if off
        const checkbox = $(this).parent().find('.checkboxcont .checkbox')
        if (!checkbox.hasClass('on')) await toggleLayer(checkbox)

        //Support Filtering 2
        if (!wasOn) {
            if (['vector', 'query'].includes(type)) {
                if (!wasOn) Filtering.make($(this).parent().parent(), layerName)
            }
        }

        LayersTool.populateCogScale(layerName)
        LegendTool.refreshLegends()
    })

    // Locates/zooms to fill extent of layer
    $('#layersTool .locate').on('click', function (e) {
        e.stopPropagation()
        const layerName = $(this).attr('layername')
        const data = L_.layers.data[layerName]
        const layer = L_.layers.layer[layerName]

        if (!data || !layer) {
            CursorInfo.update(
                'Unable to locate layer.',
                4000,
                true,
                { x: 395, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }

        if (L_.layers.on[layerName] !== true) {
            CursorInfo.update(
                'Please turn the layer on before locating.',
                4000,
                true,
                { x: 395, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }

        try {
            if (typeof layer.getBounds === 'function') {
                Map_.map.fitBounds(layer.getBounds())
            } else if (data.boundingBox) {
                Map_.map.fitBounds([
                    [data.boundingBox[1], data.boundingBox[0]],
                    [data.boundingBox[3], data.boundingBox[2]],
                ])
            } else {
                CursorInfo.update(
                    'Unable to locate layer.',
                    4000,
                    true,
                    { x: 395, y: 6 },
                    '#e9ff26',
                    'black'
                )
                return
            }
        } catch (err) {
            CursorInfo.update(
                'Unable to locate layer.',
                4000,
                true,
                { x: 385, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }
    })
    //Enables the time dialogue box
    $('.LayersToolInfo').on('click', function (e) {
        e.stopPropagation()
        const layerName = $(this).attr('layername')
        LayerInfoModal.open(layerName)
    })
    //Enables the time dialogue box
    $('.layerName, .time').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('time_on')
        $('.time').parent().parent().removeClass('time_on')
        if (!wasOn) li.addClass('time_on')
    })

    $('.layersToolExportGo').on('click', function () {
        const li = $(this).parent().parent().parent().parent().parent()

        const layerUUID = li.attr('name')
        const layerData = L_.layers.data[layerUUID] || {}
        const layerDisplayName = layerData.display_name || layerUUID

        let format = li.find('.layersToolExportFormat')
        if (format) format = format.val() || 'geojson'
        else format = 'geojson'
        let extent = li.find('.layersToolExportExtent')
        if (extent) extent = extent.val() || 'local'
        else extent = 'local'
        let coords = li.find('.layersToolExportCoords')
        if (coords) coords = coords.val() || 'source'
        else coords = 'source'

        if (L_.layers.layer[layerUUID] === false) {
            CursorInfo.update(
                'Please turn layer on before exporting.',
                6000,
                true,
                { x: 385, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }

        const download = (geojson) => {
            let filename = layerDisplayName

            if (coords != 'source')
                geojson = L_.convertGeoJSONLngLatsToPrimaryCoordinates(geojson)

            switch (format) {
                case 'geojson':
                    F_.downloadObject(geojson, filename, '.geojson')
                    break
                case 'kml':
                    const kml = tokml(
                        F_.geoJSONForceSimpleStyleSpec(
                            geojson,
                            true,
                            L_.layers.data[layerUUID]?.style,
                            layerData.useKeyAsName
                        ),
                        {
                            name: layerData.useKeyAsName || false,
                            description: 'Generated by MMGIS',
                            timestamp:
                                layerData.time?.enabled === true
                                    ? layerData.time.endProp || null
                                    : null,
                            simplestyle: true,
                        }
                    )
                    F_.downloadObject(kml, filename, '.kml', 'xml')
                    break
                case 'shp':
                    const folder = filename

                    calls.api(
                        'proj42wkt',
                        {
                            proj4: window.mmgisglobal.customCRS.projString,
                        },
                        (data) => {
                            shpwrite
                                .zip(geojson, {
                                    outputType: 'blob',
                                    prj: data,
                                })
                                .then((content) => {
                                    saveAs(content, `${folder}.zip`)
                                })
                        },
                        function (err) {
                            CursorInfo.update(
                                `Failed to generate shapefile's .prj.`,
                                6000,
                                true,
                                { x: 385, y: 6 },
                                '#e9ff26',
                                'black'
                            )
                        }
                    )
                    break
                default:
            }
        }

        const urlSplitRaw = (layerData.url || '').split(':')
        const urlSplit = (layerData.url || '').toLowerCase().split(':')

        if (extent === 'raw') {
            if (urlSplit[0] === 'geodatasets') {
                calls.api(
                    'geodatasets_get',
                    {
                        layer: urlSplitRaw[1],
                        type: 'geojson',
                    },
                    (data) => {
                        download(data.body)
                    },
                    (data) => {
                        CursorInfo.update(
                            `Failed to download ${layerDisplayName}.`,
                            6000,
                            true,
                            { x: 385, y: 6 },
                            '#e9ff26',
                            'black'
                        )
                        console.warn(
                            'ERROR: ' +
                                data.status +
                                ' in LayersTool geodatasets_get:' +
                                layerDisplayName +
                                ' /// ' +
                                data.message
                        )
                        return
                    }
                )
            } else {
                let layerUrl = L_.getUrl(
                    layerData.type,
                    layerData.url,
                    layerData
                )
                $.getJSON(layerUrl, function (data) {
                    if (data.hasOwnProperty('Features')) {
                        data.features = data.Features
                        delete data.Features
                    }

                    download(data)
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    //Tell the console council about what happened
                    console.warn(
                        'ERROR! ' +
                            textStatus +
                            ' in ' +
                            layerUrl +
                            ' /// ' +
                            errorThrown
                    )
                })
            }
        } else if (extent == 'raw-extent') {
            const body = JSON.parse(
                JSON.stringify(layerData._lastGeodatasetRequestBody)
            )

            if (body._source != null) {
                delete body._source
            }
            if (body.noDuplicates != null) {
                delete body.noDuplicates
            }

            calls.api(
                'geodatasets_get',
                body,
                (data) => {
                    download(data)
                },
                (data) => {
                    CursorInfo.update(
                        `Failed to download ${layerDisplayName}.`,
                        6000,
                        true,
                        { x: 385, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    console.warn(
                        'ERROR: ' +
                            data.status +
                            ' in LayersTool geodatasets_get:' +
                            layerDisplayName +
                            ' /// ' +
                            data.message
                    )
                    return
                }
            )
        } else {
            let geojson = L_.layers.layer[layerUUID].toGeoJSON(
                L_.GEOJSON_PRECISION
            )
            download(geojson)
        }
    })

    //Refresh settings
    $('.reload').on('click', function () {
        const li = $(this).parent().parent()
        let layer = li.attr('name')
        layer = L_.asLayerUUID(layer)
        layer = L_.layers.data[layer]
        if (L_.layers.layer[layer.name] === null) return

        if (layer.type === 'tile') {
        } else {
            if (layer.controlled !== true)
                try {
                    Map_.refreshLayer(layer)
                } catch (err) {}
        }
    })

    //Refresh settings
    $('.reset').on('click', function () {
        const li = $(this).parent().parent().parent()

        L_.setLayerOpacity(li.attr('name'), 1)
        li.find('.transparencyslider').val(1)

        L_.setLayerFilter(li.attr('name'), 'clear')

        li.find('.tilefilterslider').each(function () {
            $(this).val($(this).attr('default'))
        })

        let defaultBlend =
            li.find('.tileblender').attr('defaultBlend') || 'unset'
        if (defaultBlend == 'none') defaultBlend = 'unset'
        li.find('.tileblender').val(defaultBlend)
    })

    $('.resetCog').on('click', function () {
        let layer = $(this).attr('layername')
        layer = L_.asLayerUUID(layer)
        layer = L_.layers.data[layer]

        if (L_.layers.layer[layer.name] === null) return

        layer.currentCogMin = layer.cogMin
        layer.currentCogMax = layer.cogMax

        $(this)
            .parent()
            .parent()
            .find('.tilerescalecogmin')
            .val(layer.currentCogMin)
        $(this)
            .parent()
            .parent()
            .find('.tilerescalecogmax')
            .val(layer.currentCogMax)

        if (layer.type === 'tile') {
            L_.layers.layer[layer.name].refresh(null, true, {
                currentCogMin: layer.currentCogMin,
                currentCogMax: layer.currentCogMax,
            })
        } else if (layer.type === 'image') {
            // TODO FIXME DOUBLE CHECK
            updateImageRange(
                layer.name,
                layer.currentCogMin == null
                    ? layer.cogMin || 0
                    : layer.currentCogMin,
                layer.currentCogMax == null
                    ? layer.cogMax || 255
                    : layer.currentCogMax
            )
        }

        LayersTool.populateCogScale(layer.name)
        LegendTool.refreshLegends()
    })

    //Applies slider values to map layers
    $('.tilefilterslider').on('input', function () {
        var val = $(this).val()
        L_.setLayerFilter(
            $(this).attr('layername'),
            $(this).attr('filter'),
            $(this).val()
        )
        $(this)
            .parent()
            .find('span')
            .text(parseInt(val * 100) + $(this).attr('unit'))
    })

    $('.tileblender').on('change', function () {
        L_.setLayerFilter(
            $(this).attr('layername'),
            'mix-blend-mode',
            $(this).val()
        )
    })

    $('.tilerescalecogmin').on('change', function () {
        let layer = $(this).attr('layername')
        layer = L_.asLayerUUID(layer)
        layer = L_.layers.data[layer]
        if (L_.layers.layer[layer.name] === null) return
        layer.currentCogMin = Math.min(
            parseFloat($(this).val()),
            layer.currentCogMax == null
                ? layer.cogMax || 255
                : layer.currentCogMax
        )
        $('.tilerescalecogmin').val(layer.currentCogMin)

        if (layer.type === 'tile') {
            L_.layers.layer[layer.name].refresh(null, true, {
                currentCogMin: layer.currentCogMin,
            })
        } else if (layer.type === 'image') {
            updateImageRange(
                layer.name,
                layer.currentCogMin,
                layer.currentCogMax == null
                    ? layer.cogMax || 255
                    : layer.currentCogMax
            )
        } else if (layer.type === 'velocity') {
            updateVelocityRange(
                layer.name,
                layer.currentCogMin,
                layer.currentCogMax == null
                    ? layer.cogMax || 255
                    : layer.currentCogMax
            )
        }

        LayersTool.populateCogScale(layer.name)
        LegendTool.refreshLegends()
    })
    $('.tilerescalecogmax').on('change', function () {
        let layer = $(this).attr('layername')
        layer = L_.asLayerUUID(layer)
        layer = L_.layers.data[layer]
        if (L_.layers.layer[layer.name] === null) return
        layer.currentCogMax = Math.max(
            parseFloat($(this).val()),
            layer.currentCogMin == null
                ? layer.cogMin || 0
                : layer.currentCogMin
        )
        $('.tilerescalecogmax').val(layer.currentCogMax)
        if (layer.type === 'tile') {
            L_.layers.layer[layer.name].refresh(null, true, {
                currentCogMax: layer.currentCogMax,
            })
        } else if (layer.type === 'image') {
            updateImageRange(
                layer.name,
                layer.currentCogMin == null
                    ? layer.cogMin || 0
                    : layer.currentCogMin,
                layer.currentCogMax
            )
        } else if (layer.type === 'velocity') {
            updateVelocityRange(
                layer.name,
                layer.currentCogMin == null
                    ? layer.cogMin || 0
                    : layer.currentCogMin,
                layer.currentCogMax
            )
        }
        LayersTool.populateCogScale(layer.name)
        LegendTool.refreshLegends()
    })

    let tags = []
    Object.keys(L_.layers.data).forEach((l) => {
        if (L_.layers.data[l].tags) tags = tags.concat(L_.layers.data[l].tags)
    })
    // Remove duplicates, nulls and ""
    tags = tags.filter((c, idx) => {
        if (c == null || c === '') return false
        return tags.indexOf(c) === idx
    })

    $('#searchLayers > input').autocomplete({
        lookup: tags,
        lookupLimit: 400,
        minChars: 1,
        transformResult: function (response, originalQuery) {
            response.suggestions = []
            if (originalQuery[0] === '#') {
                const queryWithoutHash = originalQuery.substring(1)

                tags.forEach((tag) => {
                    if (
                        queryWithoutHash === '' ||
                        tag.toLowerCase().indexOf(queryWithoutHash) != -1
                    ) {
                        response.suggestions.push({ value: tag, data: null })
                    }
                })
            }
            return response
        },
        onSelect: function (event) {
            $('#searchLayers > input')
                .val(`#${event.value}`)
                .trigger('input')
                .trigger('blur')
        },
    })

    tippy('#searchLayers > input', {
        content:
            'Search layers by Name and Description. Prefix with # to search over tags.',
        placement: 'right',
        theme: 'blue',
    })

    $('#searchLayers > input').on('input', function () {
        $('#searchLayers > #expand').click()
        const filterString = $(this).val().toLowerCase()

        if (filterString == null || filterString == '')
            $('#searchLayers > #clear').removeClass('shown')
        else $('#searchLayers > #clear').addClass('shown')

        markAll()
        function getThats() {
            let thats = []
            $('#layersToolList > li').each(function () {
                if ($(this).attr('type') != 'header') {
                    if (filterString == null || filterString == '') {
                        $(this).css('height', 'auto')
                        $(this).css('margin-top', '1px')
                        $(this).css('margin-bottom', '1px')
                        //Mark
                        $(this).unmark()
                    } else {
                        thats.push(this)
                    }
                }
            })
            return thats
        }

        function markAll() {
            let thats = getThats()
            //look through name and highlight
            thats.forEach((that) => {
                $(that).unmark({
                    done: function () {
                        $(that).markRegExp(new RegExp(filterString, 'i'), {
                            done: function () {
                                if ($(that).find('mark').length == 0) {
                                    $(that).css('height', 0)
                                    $(that).css('margin-top', '0px')
                                    $(that).css('margin-bottom', '0px')
                                } else {
                                    $(that).css('height', 'auto')
                                    $(that).css('margin-top', '1px')
                                    $(that).css('margin-bottom', '1px')
                                }
                            },
                        })
                    },
                })

                const layerName = $(that).attr('name')
                const layerObj = L_.layers.data[layerName]

                if (layerObj) {
                    //Look at description
                    if (
                        layerObj.description &&
                        layerObj.description.indexOf(filterString) != -1
                    ) {
                        $(that).css('height', 'auto')
                        $(that).css('margin-top', '1px')
                        $(that).css('margin-bottom', '1px')
                    }
                    //look at tag
                    if (layerObj.tags) {
                        const filterStringWords = filterString.split(' ')
                        filterStringWords.forEach((word) => {
                            if (word[0] === '#') {
                                const filterTag = word.substring(1)
                                for (let i = 0; i < layerObj.tags.length; i++) {
                                    if (
                                        layerObj.tags[i]
                                            .toLowerCase()
                                            .indexOf(filterTag) != -1
                                    ) {
                                        $(that).css('height', 'auto')
                                        $(that).css('margin-top', '1px')
                                        $(that).css('margin-bottom', '1px')
                                        break
                                    }
                                }
                            }
                        })
                    }
                }
            })
        }
    })
    $('#searchLayers > #clear').on('click', function () {
        $('#searchLayers > input').val('').trigger('input')
    })
    $('#searchLayers > #expand').on('click', function () {
        $('#layersToolList > li').each(function () {
            if (
                $(this).attr('type') == 'header' &&
                $(this).attr('childrenon') == 'false'
            ) {
                LayersTool.toggleHeader($(this).attr('id'))
            }
        })
    })

    $('#searchLayers > #collapse').on('click', function () {
        // Collapse deepest first
        for (let depth = LayersTool._maxDepth; depth >= 0; depth--) {
            $(`#layersToolList > li[type="header"][depth="${depth}"]`).each(
                function () {
                    if (
                        $(this).attr('type') == 'header' &&
                        $(this).attr('childrenon') == 'true'
                    ) {
                        LayersTool.toggleHeader($(this).attr('id'))
                    }
                }
            )
        }
    })

    $('#filterLayers .right > div').on('click', function () {
        $(this).toggleClass('on')
        var isOn = $(this).hasClass('on')
        var type = $(this).attr('type')
        const ons = {
            vector: $('#filterLayers .right > .vector').hasClass('on'),
            vectortile: $('#filterLayers .right > .vectortile').hasClass('on'),
            tile: $('#filterLayers .right > .tile').hasClass('on'),
            query: $('#filterLayers .right > .query').hasClass('on'),
            data: $('#filterLayers .right > .data').hasClass('on'),
            model: $('#filterLayers .right > .model').hasClass('on'),
            visible: $('#filterLayers .right > .visible').hasClass('on'),
        }
        $('#layersToolList > li').each(function () {
            if ($(this).attr('type') !== 'header') {
                if (type === 'visible') {
                    var layerOn = $(this).find('.checkbox').hasClass('on')
                    if (isOn) {
                        if (layerOn) $(this).removeClass('forceOff2')
                        else $(this).addClass('forceOff2')
                    } else $(this).removeClass('forceOff2')
                } else {
                    if (
                        !ons.vector &&
                        !ons.vectortile &&
                        !ons.tile &&
                        !ons.query &&
                        !ons.data &&
                        !ons.model
                    )
                        $(this).removeClass('forceOff')
                    else {
                        const liType = $(this).attr('type')
                        if (ons[liType]) $(this).removeClass('forceOff')
                        else $(this).addClass('forceOff')
                    }
                }
            }
        })
    })

    // Make it all sortable
    function sortOnStart(e) {
        const type = $(e.item).attr('type')
        LayersTool._drag_oldDepth = parseInt($(e.item).attr('depth'))
        const oldIdx = e.oldIndex

        LayersTool._drag_lisToMoveUnderHeader = []
        if (type === 'header') {
            let stillUnder = true
            $('#layersToolList')
                .children('li')
                .each(function (idx, item) {
                    if (idx > oldIdx) {
                        if (
                            stillUnder &&
                            $(item).attr('depth') > LayersTool._drag_oldDepth
                        )
                            LayersTool._drag_lisToMoveUnderHeader.push(item)
                        else {
                            stillUnder = false
                        }
                    }
                })
        }
    }
    function sortOnChange(e) {
        // In here we want to change the indentation of our dragged layer to match
        // the indentation of the layer above (on none if at top)
        LayersTool._drag_newDepth = 0
        LayersTool._drag_headerState = 0
        if (e.newIndex > 0) {
            // We need to look for the next VISIBLE above element
            let aboveElm
            let upIdx = e.newIndex
            if (e.downward === true) upIdx++

            while (upIdx >= 0) {
                aboveElm = $(`#layersToolList > li:nth-child(${upIdx})`)
                if (aboveElm.attr('on') !== 'false') upIdx = 0
                upIdx--
            }
            if (aboveElm.length > 0) {
                LayersTool._drag_newDepth = parseInt(aboveElm.attr('depth'))
                const type = aboveElm.attr('type')

                if (
                    (e.afterHeader === 0 &&
                        aboveElm.attr('childrenon') === 'false') ||
                    (e.afterHeader === 1 &&
                        aboveElm.attr('childrenon') === 'true')
                ) {
                    // toggle header because it's in the opposite state than history requires
                    LayersTool.toggleHeader(aboveElm.attr('id'))
                }

                if (type === 'header') {
                    if (aboveElm.attr('childrenon') === 'true') {
                        LayersTool._drag_newDepth++
                        LayersTool._drag_headerState = 2
                    } else {
                        LayersTool._drag_headerState = 1
                    }
                }
            }
        }

        // If header and open, depth++
        $(e.item).attr('depth', LayersTool._drag_newDepth)
        $(e.item)
            .find('.title')
            .css({
                'border-left': `${
                    LayersTool._drag_newDepth * DEPTH_SIZE
                }px solid ${INDENT_COLOR}`,
            })

        return true
    }
    function sortOnEnd(e) {
        const type = $(e.item).attr('type')
        // Sortable will place before all hidden layers, we want it always to be after
        // Move to the end of all hidden / on="false" layers
        let downIdx = e.newIndex + 1
        let keepGoing = true
        let nextElm
        let afterElm
        const totalLayers = $(`#layersToolList > li`).length

        nextElm = $(`#layersToolList > li:nth-child(${e.newIndex})`)
        if (
            nextElm.attr('type') === 'header' &&
            nextElm.attr('childrenon') === 'false'
        ) {
            downIdx++
        }
        while (e.newIndex > 0 && keepGoing) {
            nextElm = $(`#layersToolList > li:nth-child(${downIdx})`)
            if (nextElm.length > 0) {
                if (
                    downIdx >= totalLayers ||
                    parseInt(nextElm.css('height')) > 0
                ) {
                    afterElm = $(
                        `#layersToolList > li:nth-child(${
                            downIdx + (downIdx >= totalLayers ? 0 : -1)
                        })`
                    )
                    keepGoing = false
                } else {
                    downIdx++
                }
            } else {
                keepGoing = false
            }
        }
        if (afterElm) {
            $(e.item).insertAfter(afterElm)
        } else $(`#layersToolList`).prepend($(e.item))

        if (type === 'header') {
            // If a header was moved, now move everything under it along with it
            // If a user drags a header into its own contents, nothing must happen
            // Inner layers must shift depth along with header depth
            if (LayersTool._drag_lisToMoveUnderHeader.length > 0) {
                let curItem = e.item
                LayersTool._drag_lisToMoveUnderHeader.forEach((item) => {
                    let depth = parseInt($(item).attr('depth'))
                    depth +=
                        LayersTool._drag_newDepth - LayersTool._drag_oldDepth
                    $(item).insertAfter($(curItem))
                    $(item).attr('depth', depth)
                    $(item)
                        .find('.title')
                        .css({
                            'border-left': `${
                                depth * DEPTH_SIZE
                            }px solid ${INDENT_COLOR}`,
                        })
                    curItem = item
                })
            }
        }
        if (e.ignoreHistory !== true)
            LayersTool.orderingHistory.push([
                e.oldIndex,
                e.newIndex,
                LayersTool._drag_headerState,
            ])
        if (e.ignoreFinalOrder !== true) {
            // Set reorder in data model
            const newLayersOrdered = []
            $('#layersToolList')
                .children('li')
                .each(function () {
                    if (
                        $(this).attr('type') !== 'header' &&
                        $(this).attr('name') != null
                    )
                        newLayersOrdered.push($(this).attr('name'))
                })
            L_.reorderLayers(newLayersOrdered)
        }
    }

    LayersTool.orderingHistory.forEach((hist, idx) => {
        const oldIdx = hist[0]
        const newIdx = hist[1]
        const afterHeader = hist[2]
        const upward = oldIdx > newIdx
        const item = $(`#layersToolList > li:nth-child(${oldIdx + 1})`)
        sortOnStart({ item: item, oldIndex: oldIdx })
        sortOnChange({
            item: item,
            oldIndex: oldIdx,
            newIndex: newIdx + (upward ? 0 : 1),
            afterHeader: afterHeader,
        })
        sortOnEnd({
            item: item,
            oldIndex: oldIdx,
            newIndex: newIdx + (upward ? 0 : 1),
            ignoreHistory: true,
            ignoreFinalOrder: fromInit
                ? idx !== LayersTool.orderingHistory.length - 1
                : true,
        })
    })

    const listToSort = document.getElementById('layersToolList')
    Sortable.create(listToSort, {
        animation: 150,
        easing: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
        handle: '.layersToolColor',
        onStart: sortOnStart,
        onChange: sortOnChange,
        onEnd: sortOnEnd,
    })

    //Start collapsed
    if (LayersTool.vars.expanded !== true)
        $('#searchLayers > #collapse').click()

    // Sublayer things

    function getVectorLayerSettings(layerName) {
        let currentOpacity = L_.getLayerOpacity(layerName)
        if (currentOpacity == null)
            currentOpacity = L_.layers.opacity[layerName]

        // prettier-ignore
        return [
                '<ul>',
                    '<li>',
                        '<div>',
                            '<div>Opacity</div>',
                                '<input class="transparencyslider slider2" layername="' + layerName + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.layers.opacity[layerName] + '">',
                            '</div>',
                            L_.layers.attachments[layerName] ? `<div class="sublayerHeading">Composite Layers</div>` : null,
                            L_.layers.attachments[layerName] ? Object.keys(L_.layers.attachments[layerName]).map(function(s) {
                                return L_.layers.attachments[layerName][s] === false ? '' : [
                                    '<div class="sublayer">',
                                        `<div title="${L_.layers.attachments[layerName][s].title || ''}">${F_.prettifyName(s)}</div>`,
                                        '<div style="display: flex;">',
                                            L_.layers.attachments[layerName][s].layer?.dropdown ? [
                                                `<select class="dropdown sublayerDropdown" layername="${layerName}" sublayername="${s}">`,
                                                    L_.layers.attachments[layerName][s].layer?.dropdown.map((d) =>
                                                        `<option value="${d}"${(d === L_.layers.attachments[layerName][s].layer?.dropdownValue  ? ' selected' : '')}>${d}</option>`
                                                    ).join('\n'),
                                                '</select>'
                                            ].join('\n') : null,
                                            L_.layers.attachments[layerName][s].opacity != null ? `<input class="sublayeropacityslider slider2" layername="${layerName}" sublayername="${s}" type="range" min="0" max="1" step="0.01" value="${L_.layers.attachments[layerName][s].opacity}" style="width: 76px;"></input>` : null,
                                            '<div class="checkboxcont">',
                                                `<div class="checkbox small ${(L_.layers.attachments[layerName][s].on ? 'on' : 'off')}" layername="${layerName}" sublayername="${s}" style="margin: 7px 0px 7px 10px;"></div>`,
                                            '</div>',
                                        '</div>',
                                    '</div>'
                                ].join('\n')
                            }).join('\n') : null,
                        '</div>',
                    '</li>',
                '</ul>',
            ].join('\n')
    }

    function updateImageRange(layerName, vMin, vMax) {
        const layer = L_.layers.layer[layerName]
        const layerData = L_.layers.data[layerName]
        if (vMin == null || vMax == null) return

        const imageInfo = F_.getIn(L_.layers.data[layerName], 'variables.image')

        layer.currentCogMin = vMin
        layer.currentCogMax = vMax

        $('.imagerange.stylevalue').text(vMin + ' ➝ ' + vMax)
        $('.imagerange.stylevalue').attr('v', vMin + ',' + vMax)
        var range = vMax - vMin

        var { colormap, reverse } = LayersTool.findJSColormap(
            layerData,
            layerData.cogColormap
        )

        let pixelValuesToColorFn = (values) => {
            let georaster = layer.options.georaster
            var pixelValue = values[0] // single band

            // don't return a color
            if (georaster.noDataValue && georaster.noDataValue === pixelValue) {
                return null
            }
            // scale from 0 - 1
            var scaledPixelValue = (pixelValue - vMin) / range
            if (!(scaledPixelValue >= 0 && scaledPixelValue <= 1)) {
                if (imageInfo && imageInfo.fillMinMax) {
                    if (scaledPixelValue <= 0) {
                        scaledPixelValue = 0
                    } else if (scaledPixelValue >= 1.0) {
                        scaledPixelValue = 1
                    }
                } else {
                    return null
                }
            }

            return evaluate_cmap(
                scaledPixelValue,
                colormap || IMAGE_DEFAULT_COLOR_RAMP,
                reverse
            )
        }

        // Clear the cache so when zooming in/out, the old pixel colors are not cached
        layer.clearCache()
        layer.updateColors(pixelValuesToColorFn)
    }

    function updateVelocityRange(layerName, vMin, vMax) {
        const layer = L_.layers.layer[layerName]
        const layerData = L_.layers.data[layerName]
        if (vMin == null || vMax == null) return

        layer.options.minVelocity = vMin
        layer.options.maxVelocity = vMax
        // Need to remove and re-add layer to refresh colors
        Map_.map.removeLayer(layer)
        layer.addTo(Map_.map)
    }

    function setSublayerEvents() {
        //Applies slider values to map layers
        $('.transparencyslider').off('input')
        $('.transparencyslider').on('input', function () {
            const texttransp = $(this).val()
            L_.setLayerOpacity($(this).attr('layername'), texttransp)
            $(this)
                .parent()
                .find('span')
                .text(parseInt(texttransp * 100) + '%')
        })

        $('#layersToolList > li > .settings .sublayer .dropdown').off('change')
        $('#layersToolList > li > .settings .sublayer .dropdown').on(
            'change',
            function () {
                const layerName = $(this).attr('layername')
                const sublayerName = $(this).attr('sublayername')
                $(this).val()

                if (
                    L_.layers.attachments[layerName] &&
                    L_.layers.attachments[layerName][sublayerName]
                ) {
                    const l = L_.layers.attachments[layerName][sublayerName]
                    l.layer.dropdownFunc(
                        layerName,
                        sublayerName,
                        Map_,
                        $(this).val()
                    )
                }
            }
        )

        $(
            '#layersToolList > li > .settings .sublayer .sublayeropacityslider'
        ).off('input')
        $(
            '#layersToolList > li > .settings .sublayer .sublayeropacityslider'
        ).on('input', function () {
            const opacity = parseFloat($(this).val())
            const layerName = $(this).attr('layername')
            const sublayerName = $(this).attr('sublayername')
            L_.setSublayerOpacity(layerName, sublayerName, opacity)
        })
        //Makes sublayers clickable on and off
        $('#layersToolList > li > .settings .sublayer .checkbox').off('click')
        $('#layersToolList > li > .settings .sublayer .checkbox').on(
            'click',
            async function () {
                const layerName = $(this).attr('layername')
                const sublayerName = $(this).attr('sublayername')

                await L_.toggleSublayer(layerName, sublayerName)

                if (
                    L_.layers.attachments[layerName] &&
                    L_.layers.attachments[layerName][sublayerName]
                ) {
                    if (L_.layers.attachments[layerName][sublayerName].on)
                        $(this).addClass('on')
                    else $(this).removeClass('on')
                }
            }
        )
    }

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default LayersTool
