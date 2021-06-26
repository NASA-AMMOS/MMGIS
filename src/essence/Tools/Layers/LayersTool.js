import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'

import DataShaders from '../../Ancillary/DataShaders'

import './LayersTool.css'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
        "<div id='layersTool'>",
            "<div id='layersToolHeader'>",
                "<div id='filterLayers'>",
                    "<div class='left'>",
                        '<div id="title">Layers</div>',
                    "</div>",
                    "<div class='right'>",
                        '<div class="vector on" type="vector" title="Hide/Show Vector Layers"><i class="mdi mdi-vector-square mdi-18px"></i></div>',
                        '<div class="tile on" type="tile" title="Hide/Show Raster Layers"><i class="mdi mdi-map-outline mdi-18px"></i></div>',
                        '<div class="data on" type="data" title="Hide/Show Data Layers"><i class="mdi mdi-file-table mdi-18px"></i></div>',
                        '<div class="model on" type="model" title="Hide/Show Model Layers"><i class="mdi mdi-cube-outline mdi-18px"></i></div>',
                        '<div class="visible" type="visible" title="Hide/Show Off Layers"><i class="mdi mdi-eye mdi-18px"></i></div>',
                    "</div>",
                "</div>",
                "<div id='searchLayers'>",
                    "<input type='text' placeholder='Search Layers' />",
                    '<i class="mdi mdi-magnify mdi-18px"></i>',
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

var LayersTool = {
    height: 0,
    width: 250,
    vars: {},
    MMGISInterface: null,
    make: function () {
        //Get tool variables
        this.vars = L_.getToolVars('measure')
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
    setHeader: function () {},
    toggleHeader: function (elmIndex) {
        var found = false
        var done = false
        var elmDepth = 0
        var wasOn = false
        $('#layersToolList > li').each(function () {
            if (done) return
            var t = $(this)
            if (t.attr('id') == elmIndex) {
                found = true
                elmDepth = t.attr('depth')
                wasOn = t.attr('childrenon') == 'true'
                t.attr('childrenon', wasOn ? 'false' : 'true')
                t.find('.headerChevron').toggleClass('mdi-menu-right')
                t.find('.headerChevron').toggleClass('mdi-menu-down')
            } else if (found) {
                if (t.attr('type') == 'header' && t.attr('depth') <= elmDepth) {
                    done = true
                } else if (t.attr('depth') <= elmDepth) {
                    done = true
                } else {
                    var nextDepth =
                        parseInt(t.attr('depth')) == parseInt(elmDepth) + 1

                    if (wasOn) {
                        if (nextDepth) t.attr('on', 'false')
                        t.css('overflow', 'hidden')
                        t.css('height', wasOn ? '0' : 'auto')
                        t.css('margin-top', wasOn ? '0px' : '1px')
                        t.css('margin-bottom', wasOn ? '0px' : '1px')
                    } else {
                        if (t.attr('on') == 'true' || nextDepth) {
                            t.css('height', 'auto')
                            t.css('margin-top', '1px')
                            t.css('margin-bottom', '1px')
                        }
                        if (nextDepth) t.attr('on', 'true')
                    }
                }
            }
        })
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    var tools = d3.select('#toolPanel')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    //Add the markup to tools or do it manually
    tools.html(markup)

    let headerI = 0

    //This is where the layers list is created in the tool panel.
    depthTraversal(L_.layers, {}, 0)
    //console.log(L_.layers)

    function depthTraversal(node, parent, depth) {
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
                    // prettier-ignore
                    layerExport = [
                            '<ul>',
                                '<li>',
                                    '<div class="layersToolExportGeoJSON">',
                                        '<div>Export as GeoJSON</div>',
                                    '</div>',
                                '</li>',
                            '</ul>',
                        ].join('\n')
                    break
                default:
                    layerExport = ''
            }

            // Build timeDisplay
            var timeDisplay = ''
            if (node[i].time != null) {
                if (node[i].time.enabled == true) {
                    timeDisplay = [
                        '<ul>',
                        '<li>',
                        '<div>',
                        '<div>Start Time</div>',
                        '<label class="starttime ' +
                            node[i].name.replace(/\s/g, '') +
                            '">' +
                            node[i].time.start +
                            '</label>',
                        '</div>',
                        '</li>',
                        '<li>',
                        '<div>',
                        '<div>End Time</div>',
                        '<label class="endtime ' +
                            node[i].name.replace(/\s/g, '') +
                            '">' +
                            node[i].time.end +
                            '</label>',
                        '</div>',
                        '</li>',
                        '</ul>',
                    ].join('\n')
                }
            }

            //Build settings object
            var settings
            switch (node[i].type) {
                case 'vector':
                case 'vectortile':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.opacityArray[node[i].name]
                    // prettier-ignore
                    settings = [
                                '<ul>',
                                    '<li>',
                                        '<div>',
                                            '<div>Opacity</div>',
                                                '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                            '</div>',
                                        '</div>',
                                    '</li>',
                                '</ul>',
                            ].join('\n')
                    break
                case 'tile':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.opacityArray[node[i].name]

                    currentBrightness = 1
                    currentContrast = 1
                    currentSaturation = 1
                    currentBlend = 'none'
                    if (L_.layerFilters[node[i].name]) {
                        let f = L_.layerFilters[node[i].name]

                        currentBrightness =
                            f['brightness'] == null
                                ? 1
                                : parseFloat(f['brightness'])
                        currentContrast =
                            f['contrast'] == null
                                ? 1
                                : parseFloat(f['contrast'])
                        currentSaturation =
                            f['saturate'] == null
                                ? 1
                                : parseFloat(f['saturate'])
                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? 'none'
                                : f['mix-blend-mode']
                    }

                    // prettier-ignore
                    settings = [
                            '<ul>',
                                '<li>',
                                    '<div>',
                                        '<div>Opacity</div>',
                                        '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                    '</div>',
                                '</li>',
                                '<li>',
                                    '<div>',
                                        '<div>Brightness</div>',
                                            '<input class="tilefilterslider slider2" filter="brightness" unit="%" layername="' + node[i].name + '" type="range" min="0" max="3" step="0.05" value="' + currentBrightness + '" default="1">',
                                    '</div>',
                                '</li>',
                                '<li>',
                                    '<div>',
                                        '<div>Contrast</div>',
                                        '<input class="tilefilterslider slider2" filter="contrast" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentContrast + '" default="1">',
                                    '</div>',
                                '</li>',
                                '<li>',
                                    '<div>',
                                        '<div>Saturation</div>',
                                        '<input class="tilefilterslider slider2" filter="saturate" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentSaturation + '" default="1">',
                                    '</div>',
                                '</li>',
                                '<li>',
                                    '<div>',
                                        '<div>Blend</div>',
                                        '<select class="tileblender dropdown" layername="' + node[i].name + '">',
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
                        currentOpacity = L_.opacityArray[node[i].name]

                    currentBlend = 'none'
                    if (L_.layerFilters[node[i].name]) {
                        let f = L_.layerFilters[node[i].name]

                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? 'none'
                                : f['mix-blend-mode']
                    }

                    let additionalSettings = ''
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
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
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
                    // prettier-ignore
                    settings = [
                                '<ul>',
                                    '<li>vectortransparency</li>',
                                '</ul>',
                            ].join('\n')
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
                            '<li class="layersToolHeader" id="header_' + headerI + '" type="' + node[i].type + '" depth="' + depth + '" childrenon="true" style="margin-left: ' + depth * 17 + 'px;">' +
                                '<div class="title" id="headerstart">' +
                                    '<div class="layersToolColor ' + node[i].type + '"></div>',
                                    '<div>',
                                        '<i class="headerChevron mdi mdi-menu-down mdi-24px"></i>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].name}">` +
                                        node[i].name,
                                    '</div>',
                                    '<div class="layerCount">' +
                                        (node[i].sublayers ? node[i].sublayers.length : '0'),
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
                            '<li id="LayersTool' + node[i].name.replace(/\s/g, "") + '" class="' + ((L_.layersGroup[node[i].name] == null) ? 'layernotfound' : '') + '" type="' + node[i].type + '" on="true" depth="' + depth + '" name="' + node[i].name + '" parent="' + parent.name + '" style="margin-left: ' + (depth * 16) + 'px;">',
                                '<div class="title" id="layerstart' + node[i].name.replace(/\s/g, "") + '">',
                                    '<div class="layersToolColor ' + node[i].type + '"></div>',
                                    '<div class="checkboxcont">',
                                        '<div class="checkbox ' + (L_.toggledArray[node[i].name] ? 'on' : 'off') + '"></div>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].name}">`,
                                        node[i].name,
                                    '</div>',
                                    '<div class="reset">',
                                        '<i class="mdi mdi-refresh mdi-18px"></i>',
                                    '</div>',
                                    (layerExport != '') ? ['<div class="layerDownload" id="layerexport' + node[i].name.replace(/\s/g, "") + '" stype="' + node[i].type + '" layername="' + node[i].name.replace(/\s/g, "") + '">',
                                        '<i class="mdi mdi-download mdi-18px" name="layerexport"></i>',
                                    '</div>'].join('\n') : '',
                                    (timeDisplay != '') ? ['<div class="time" id="timesettings' + node[i].name.replace(/\s/g, "") + '" stype="' + node[i].type + '" layername="' + node[i].name.replace(/\s/g, "") + '">',
                                        '<i class="mdi mdi-clock mdi-18px" name="timesettings" style="color:' + node[i].time.status + '"></i>',
                                    '</div>'].join('\n') : '',
                                    '<div class="gears" id="layersettings' + node[i].name.replace(/\s/g, "") + '" stype="' + node[i].type + '" layername="' + node[i].name.replace(/\s/g, "") + '">',
                                        '<i class="mdi mdi-tune mdi-18px" name="layersettings"></i>',
                                    '</div>',
                                '</div>',
                                '<div class="layerExport ' + node[i].type + '">',
                                    layerExport,
                                '</div>',
                                '<div class="timeDisplay settings ' + node[i].type + '">',
                                    timeDisplay,
                                '</div>',
                                '<div class="settings ' + node[i].type + '">',
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
                    break
            }

            if (node[i].sublayers)
                depthTraversal(node[i].sublayers, node[0], depth + 1)
        }
    }

    //Add event functions and whatnot
    //Makes layers clickable on and off
    $('#layersToolList > li > .title .checkbox').on('click', function () {
        let li = $(this).parent().parent().parent()
        if (li.attr('type') != 'header') {
            $(this).toggleClass('on')
            L_.toggleLayer(L_.layersNamed[li.attr('name')])
        }
    })

    //Collapse header
    $('.layersToolHeader').on('click', function () {
        LayersTool.toggleHeader($(this).attr('id'))
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
    $('.layerName, .gears').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('gears_on')
        $('.layerDownload').parent().parent().removeClass('download_on')
        $('.gears').parent().parent().removeClass('gears_on')
        if (!wasOn) li.addClass('gears_on')
    })
    //Enables the time dialogue box
    $('.layerName, .time').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('time_on')
        $('.time').parent().parent().removeClass('time_on')
        if (!wasOn) li.addClass('time_on')
    })

    //Export GeoJSON
    $('.layersToolExportGeoJSON').on('click', function () {
        var li = $(this).parent().parent().parent().parent()

        let layerName = li.attr('name')
        F_.downloadObject(
            L_.layersGroup[layerName].toGeoJSON(),
            layerName,
            '.geojson'
        )
    })

    //Refresh settings
    $('.reset').on('click', function () {
        var li = $(this).parent().parent()

        L_.setLayerOpacity(li.attr('name'), 1)
        li.find('.transparencyslider').val(1)

        L_.setLayerFilter(li.attr('name'), 'clear')

        li.find('.tilefilterslider').each(function () {
            $(this).val($(this).attr('default'))
        })

        li.find('.tileblender').val('unset')
    })

    //Applies slider values to map layers
    $('.transparencyslider').on('input', function () {
        var texttransp = $(this).val()
        L_.setLayerOpacity($(this).attr('layername'), texttransp)
        $(this)
            .parent()
            .find('span')
            .text(parseInt(texttransp * 100) + '%')
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

    $('#searchLayers > input').on('input', function () {
        $('#searchLayers > #expand').click()
        var input = $(this).val().toLowerCase()
        $('#layersToolList > li').each(function () {
            if ($(this).attr('type') != 'header') {
                if (input == '') {
                    if ($(this).attr('on') == 'true') {
                        $(this).css('height', 'auto')
                        $(this).css('margin-top', '1px')
                        $(this).css('margin-bottom', '1px')
                    } else {
                        $(this).css('height', 0)
                        $(this).css('margin-top', '0px')
                        $(this).css('margin-bottom', '0px')
                    }
                } else {
                    if (
                        $(this).attr('name').toLowerCase().indexOf(input) != -1
                    ) {
                        $(this).css('height', 'auto')
                        $(this).css('margin-top', '1px')
                        $(this).css('margin-bottom', '1px')
                    } else {
                        $(this).css('height', 0)
                        $(this).css('margin-top', '0px')
                        $(this).css('margin-bottom', '0px')
                    }
                }
            }
        })
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
        $('#layersToolList > li').each(function () {
            if (
                $(this).attr('type') == 'header' &&
                $(this).attr('childrenon') == 'true'
            ) {
                LayersTool.toggleHeader($(this).attr('id'))
            }
        })
    })

    //Start collapsed
    if (LayersTool.vars.expanded !== true)
        $('#searchLayers > #collapse').click()

    $('#filterLayers .right > div').on('click', function () {
        $(this).toggleClass('on')
        var isOn = $(this).hasClass('on')
        var type = $(this).attr('type')
        $('#layersToolList > li').each(function () {
            if (type == 'visible') {
                if ($(this).attr('type') != 'header') {
                    var layerOn = $(this).find('.checkbox').hasClass('on')
                    if (isOn) {
                        if (layerOn) $(this).removeClass('forceOff2')
                        else $(this).addClass('forceOff2')
                    } else $(this).removeClass('forceOff2')
                }
            } else if ($(this).attr('type') == type) {
                if (isOn) $(this).removeClass('forceOff')
                else $(this).addClass('forceOff')
            }
        })
    })

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default LayersTool
