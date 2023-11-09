import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'
import LocalFilterer from '../../Ancillary/LocalFilterer'
import Dropy from '../../../external/Dropy/dropy'

import './DrawTool_Shapes.css'

var DrawTool = null
var Shapes = {
    init: function (tool) {
        DrawTool = tool
        DrawTool.populateShapes = Shapes.populateShapes
        DrawTool.updateCopyTo = Shapes.updateCopyTo
    },
    populateShapes: function (fileId, selectedFeatureIds) {
        //If we get an array of fileIds, split them
        if (Array.isArray(fileId)) {
            /*
                for (var i = 0; i < fileId.length; i++) {
                    DrawTool.populateShapes(fileId[i], selectedFeatureIds)
                }
                return
            */
            fileId = 'master'
        }

        //Find all the active shapes on the last list so that repopulating doesn't change this
        var stillActive = []
        $('#drawToolShapesFeaturesList .drawToolShapeLi.active').each(
            function () {
                stillActive.push($(this).attr('id'))
            }
        )

        //Populate shapes
        const fileIds = []
        $('#drawToolShapesFeaturesList *').remove()
        for (var l in L_.layers.layer) {
            var s = l.split('_')
            var onId = s[1] != 'master' ? parseInt(s[1]) : s[1]
            if (s[0] == 'DrawTool' && DrawTool.filesOn.indexOf(onId) != -1) {
                var file = DrawTool.getFileObjectWithId(s[1])
                fileIds.push(onId)
                if (L_.layers.layer[l].length > 0)
                    d3.select('#drawToolShapesFeaturesList')
                        .append('li')
                        .attr('class', 'drawToolShapesFeaturesListFileHeader')
                        .style(
                            'background',
                            DrawTool.categoryStyles[file.intent].color
                        )
                        .style(
                            'color',
                            file.intent == 'campaign' ||
                                file.intent == 'campsite' ||
                                file.intent == 'trail' ||
                                file.intent == 'all'
                                ? 'black'
                                : 'white'
                        )
                        .html(file.file_name)
                for (var i = 0; i < L_.layers.layer[l].length; i++) {
                    addShapeToList(L_.layers.layer[l][i], file, l, i, s[1])
                }
            }
        }
        Shapes.filters = Shapes.filters || {
            values: [],
            geojson: null,
        }
        try {
            const mergedGeoJSON = F_.getBaseGeoJSON()
            fileIds.forEach((fileId) => {
                mergedGeoJSON.features = mergedGeoJSON.features.concat(
                    DrawTool.fileGeoJSONFeatures[fileId]
                )
            })
            Shapes.filters.geojson = mergedGeoJSON
        } catch (err) {
            console.log(err)
            console.warn(
                `Shapes Filtering - Cannot find GeoJSON to filter on for file ids: ${fileIds}`
            )
            return
        }
        Shapes.filters.aggs = LocalFilterer.getAggregations(
            Shapes.filters.geojson
        )
        Shapes.attachEvents(fileIds)
        // Start with one empty row added
        if (
            $(
                '#drawToolShapes_filtering_filters_list .drawToolShapes_filtering_value'
            ).length === 0
        )
            Shapes.addValue()

        $('#drawToolShapesFilterAdvanced').off('click')
        $('#drawToolShapesFilterAdvanced').on('click', function () {
            $('#drawToolShapesFilterAdvanced').toggleClass('on')
            $('#drawToolShapesFilterAdvancedDiv').toggleClass('on')
            if ($('#drawToolShapesFilterAdvancedDiv').hasClass('on'))
                $('#drawToolDrawShapesList').css('height', 'calc(100% - 265px)')
            else $('#drawToolDrawShapesList').css('height', 'calc(100% - 65px)')
            //shapeFilter()
        })
        $('#drawToolShapesFilterClear').off('click')
        $('#drawToolShapesFilterClear').on('click', function () {
            $('#drawToolShapesFilter').val('')
            shapeFilter()
        })
        $('#drawToolShapesFilter').off('input')
        $('#drawToolShapesFilter').on('input', shapeFilter)
        shapeFilter()
        function shapeFilter() {
            //filter over name, intent and id for now
            var on = 0
            var off = 0
            var v = $('#drawToolShapesFilter').val()

            if (v != null && v != '') v = v.toLowerCase()
            else {
                //not filtering
                $('.drawToolShapeLi').css('display', 'list-item')
                $('#drawToolShapesFilterCount').text('')
                $('#drawToolShapesFilterCount').css('padding-right', '0px')
                return
            }

            $('.drawToolShapeLi').each(function () {
                var l =
                    L_.layers.layer[$(this).attr('layer')][
                        $(this).attr('index')
                    ]
                if (l.feature == null && l.hasOwnProperty('_layers'))
                    l = l._layers[Object.keys(l._layers)[0]]

                var show = false
                if (l.feature) {
                    if (
                        l.feature.properties.name &&
                        l.feature.properties.name.toLowerCase().indexOf(v) != -1
                    )
                        show = true
                    if (
                        l.feature.properties.description &&
                        l.feature.properties.description
                            .toLowerCase()
                            .indexOf(v) != -1
                    )
                        show = true
                    if (
                        l.feature.properties._.intent &&
                        l.feature.properties._.intent
                            .toLowerCase()
                            .indexOf(v) != -1
                    )
                        show = true
                    if (l.feature.properties._.id.toString().indexOf(v) != -1)
                        show = true

                    const fileObj = DrawTool.getFileObjectWithId(
                        l.feature.properties._.file_id
                    )
                    if (
                        fileObj &&
                        fileObj.file_name != null &&
                        fileObj.file_name.toLowerCase().indexOf(v) != -1
                    )
                        show = true
                }

                if (show) {
                    $(this).css('display', 'list-item')
                    on++
                } else {
                    $(this).css('display', 'none')
                    off++
                }
            })

            $('#drawToolShapesFilterCount').text(on + '/' + (on + off))
            $('#drawToolShapesFilterCount').css('padding-right', '7px')
        }

        function addShapeToList(shape, file, layer, index, layerId) {
            if (shape == null) return

            var f = shape

            if (
                !shape.hasOwnProperty('feature') &&
                shape.hasOwnProperty('_layers')
            )
                //if it's a non point layer
                f = shape._layers[Object.keys(shape._layers)[0]]

            var properties = f.feature.properties

            if (f.hasOwnProperty('_layers')) f = f._layers
            else f = { layer: f }

            var shieldState = ''
            if (file.public == 1) shieldState = '-outline'

            var shapeType = ''
            if (properties._ && properties._.intent)
                switch (properties._.intent) {
                    case 'polygon':
                        shapeType = 'vector-square'
                        break
                    case 'line':
                        shapeType = 'vector-line'
                        break
                    case 'point':
                        shapeType = 'square-medium-outline'
                        break
                    case 'arrow':
                        shapeType = 'arrow-top-right'
                        shape.useKeyAsName = 'name'
                        shape.options.layerName = file.file_name
                        break
                    case 'text':
                        shapeType = 'format-text'
                        break
                    default:
                        shapeType = ''
                }

            var ownedByUser = false
            if (
                mmgisglobal.user == file.file_owner ||
                (file.file_owner_group &&
                    F_.diff(file.file_owner_group, DrawTool.userGroups).length >
                        0)
            )
                ownedByUser = true

            // prettier-ignore
            var markup = [
                "<div class='drawToolShapeLiItem flexbetween' file_id='" +
                    file.id + "' layer='" + layer + "' index='" + index + "'>",
                    "<div class='flexbetween'>",
                    "<div style='height: 100%; width: 7px; background: " + DrawTool.categoryStyles[file.intent].color + "'></div>",
                    "<div class='flexbetween' style='padding-left: 8px;'>",
                        "<div class='drawToolShapeLiItemB'>" + properties.name + "</div>",
                    "</div>",
                    "</div>",
                    "<div class='flexbetween' style='padding-right: 5px;'>",
                    shapeType != null ? ("<i class='mdi mdi-" + shapeType + " mdi-14px' style='opacity: 0.5; width: 18px;'></i>") : '',
                    "<i class='mdi mdi-shield" + shieldState + " mdi-14px' style='opacity: 0.25; width: 18px; display: " + ((shieldState == '') ? 'inherit' : 'none') + "'></i>",
                    "<i class='mdi" + ( (ownedByUser) ? ' mdi-account' : '' ) + " mdi-18px' style='opacity: 0.25; display: " + ( (ownedByUser) ? 'inherit' : 'none' ) + "'></i>",
                    "</div>",
                "</div>"
                ].join('\n');

            let shapeLiId = 'drawToolShapeLiItem_' + layer + '_' + index
            let activeClass = ''
            if (stillActive.indexOf(shapeLiId) != -1) activeClass = ' active'

            d3.select('#drawToolShapesFeaturesList')
                .append('li')
                .attr('id', 'drawToolShapeLiItem_' + layer + '_' + index)
                .attr('class', 'drawToolShapeLi' + activeClass)
                .attr('layer', layer)
                .attr('layer_id', layerId)
                .attr('index', index)
                .attr('file_id', file.id)
                .attr('file_owner', file.file_owner)
                .attr('file_name', file.file_name)
                .attr('intent', properties._.intent)
                .attr('shape_id', properties._.id)
                .html(markup)

            $('#drawToolShapeLiItem_' + layer + '_' + index)
                .find('.drawToolShapeLiItemB')
                .attr('title', properties.name || 'No Name')
                .text(properties.name || 'No Name')

            for (var elayer in f) {
                var e = f[elayer]

                var pUpfeature = e.feature
                if (e.feature == null && shape.feature != null)
                    pUpfeature = shape.feature

                // Save the file name as layerName property to use for the InfoTool display
                pUpfeature.properties.layerName = file.file_name
                e.options.layerName = file.file_name

                // Always use the name as the key for DrawTools layers
                e.useKeyAsName = 'name'

                // create popup contents
                var customPopup =
                    "<div class='drawToolLabelContent'>" +
                    pUpfeature.properties.name +
                    '</div>'

                // specify popup options
                var customOptions = {
                    autoPan: false,
                    autoClose: false,
                    closeButton: false,
                    closeOnClick: false,
                    //offset: L.Point(0,0),
                    className: 'drawToolLabel',
                }

                let p = DrawTool.removePopupsFromLayer(e)
                if (!p) e.bindPopup(customPopup, customOptions)

                e.off('mousemove')
                e.on(
                    'mousemove',
                    (function (layer, index) {
                        return function (event) {
                            if (
                                DrawTool.contextMenuLayer &&
                                DrawTool.contextMenuLayer.dragging
                            )
                                return
                            var l = L_.layers.layer[layer][index]
                            if (
                                !l.hasOwnProperty('feature') &&
                                l.hasOwnProperty('_layers')
                            )
                                l = l._layers[Object.keys(l._layers)[0]]
                            const p = l.feature.properties
                            var centerPx = event.containerPoint

                            let text = p.name

                            // Add length to hover text for lines if wanted
                            if (
                                DrawTool.vars.hoverLengthOnLines === true &&
                                l.feature &&
                                (l.feature.geometry.type.toLowerCase() ==
                                    'linestring' ||
                                    l.feature.geometry.type.toLowerCase() ==
                                        'multilinestring')
                            )
                                text = `${text} (${F_.getFeatureLength(
                                    l.feature,
                                    true
                                )})`

                            $('#drawToolMouseoverText').text(text)
                            $('#drawToolMouseoverText').addClass('active')
                            $('#drawToolMouseoverText').css({
                                top: centerPx.y,
                                left: centerPx.x + 310,
                            })
                        }
                    })(layer, index)
                )
                e.off('mouseover')
                e.on(
                    'mouseover',
                    (function (layer, index) {
                        return function () {
                            if (
                                DrawTool.contextMenuLayer &&
                                DrawTool.contextMenuLayer.dragging
                            )
                                return
                            $('.drawToolShapeLi').removeClass('hovered')
                            $(
                                '.drawToolShapeLi .drawToolShapeLiItem'
                            ).mouseleave()
                            $(
                                '#drawToolShapeLiItem_' + layer + '_' + index
                            ).addClass('hovered')
                            $(
                                '#drawToolShapeLiItem_' +
                                    layer +
                                    '_' +
                                    index +
                                    ' .drawToolShapeLiItem'
                            ).mouseenter()
                        }
                    })(layer, index)
                )
                e.off('mouseout')
                e.on('mouseout', function () {
                    if (
                        DrawTool.contextMenuLayer &&
                        DrawTool.contextMenuLayer.dragging
                    )
                        return
                    $('.drawToolShapeLi').removeClass('hovered')
                    $('.drawToolShapeLi .drawToolShapeLiItem').mouseleave()
                    $('#drawToolMouseoverText').removeClass('active')
                })
                e.off('click')
                e.on(
                    'click',
                    (function (layer, index, fileid) {
                        return function (event) {
                            if (DrawTool.activeContent != 'shapes')
                                DrawTool.showContent('shapes')

                            var ctrl = mmgisglobal.ctrlDown
                            var elm = $(
                                '#drawToolShapeLiItem_' + layer + '_' + index
                            )
                            var intent = elm.attr('intent')

                            //No mismatched intents
                            if (
                                ctrl &&
                                DrawTool.lastShapeIntent !== intent &&
                                DrawTool.contextMenuLayer != null &&
                                DrawTool.contextMenuLayers.length > 0
                            ) {
                                CursorInfo.update(
                                    'Grouped shapes must share intent.',
                                    6000,
                                    true,
                                    { x: 305, y: 6 },
                                    '#e9ff26',
                                    'black'
                                )
                                return
                            }

                            //if we click on a different feature we ignore drag
                            //This is so features can be selected after point drags
                            if (
                                DrawTool.contextMenuLayer &&
                                !(
                                    DrawTool.lastContextLayerIndexFileId
                                        .layer == layer &&
                                    DrawTool.lastContextLayerIndexFileId
                                        .index == index &&
                                    DrawTool.lastContextLayerIndexFileId
                                        .fileid == fileid
                                )
                            ) {
                                DrawTool.contextMenuLayer.justDragged = false
                            }
                            var liIndex = $(
                                '#drawToolShapesFeaturesList li'
                            ).index(elm)
                            if (
                                mmgisglobal.shiftDown &&
                                DrawTool.lastShapeIndex != null
                            ) {
                                var curI = liIndex
                                var curLi = elm
                                while (curI != DrawTool.lastShapeIndex) {
                                    if (
                                        !curLi.hasClass('active') &&
                                        DrawTool.lastShapeIntent ===
                                            curLi.attr('intent')
                                    ) {
                                        curLi.addClass('active')
                                        curLi
                                            .find('.drawToolShapeLiItemCheck')
                                            .addClass('checked')
                                        DrawTool.showContextMenu(
                                            0,
                                            0,
                                            curLi.attr('layer'),
                                            curLi.attr('index'),
                                            curLi.attr('file_id'),
                                            true
                                        )
                                    }
                                    if (liIndex > DrawTool.lastShapeIndex) {
                                        //activate upwards
                                        curI--
                                        curLi = curLi.prev()
                                    } else {
                                        //downwards
                                        curI++
                                        curLi = curLi.next()
                                    }
                                }
                                return
                            }
                            DrawTool.lastShapeIndex = liIndex
                            //Clear all active if ctrl not held or intent types differ
                            if (
                                !ctrl ||
                                (DrawTool.lastShapeIntent !== null &&
                                    DrawTool.lastShapeIntent !== intent)
                            ) {
                                $('.drawToolShapeLi').removeClass('active')
                                $('.drawToolShapeLi')
                                    .find('.drawToolShapeLiItemCheck')
                                    .removeClass('checked')
                            }
                            elm.addClass('active')
                            elm.find('.drawToolShapeLiItemCheck').addClass(
                                'checked'
                            )

                            var copyToIntent = intent
                            if (
                                copyToIntent == 'polygon' ||
                                copyToIntent == 'line' ||
                                copyToIntent == 'point' ||
                                copyToIntent == 'text' ||
                                copyToIntent == 'arrow'
                            )
                                copyToIntent = 'all'

                            DrawTool.updateCopyTo(copyToIntent, intent)

                            DrawTool.lastShapeIntent = intent

                            DrawTool.showContextMenu(
                                0,
                                0,
                                layer,
                                index,
                                fileid,
                                ctrl
                            )
                        }
                    })(layer, index, file.id)
                )
                $('body').off('keydown', Shapes.prevNext)
                $('body').on('keydown', Shapes.prevNext)
            }
        }

        //Hover li item to highlight shape
        $('.drawToolShapeLi').on('mouseenter', function () {
            if (DrawTool.activeContent === 'history') return
            var layer = $(this).find('.drawToolShapeLiItem').attr('layer')
            var index = $(this).find('.drawToolShapeLiItem').attr('index')

            if (typeof L_.layers.layer[layer][index].setStyle === 'function')
                L_.layers.layer[layer][index].setStyle({ color: '#7fff00' })
            else if (L_.layers.layer[layer][index].hasOwnProperty('_layers')) {
                //Arrow
                var layers = L_.layers.layer[layer][index]._layers
                layers[Object.keys(layers)[0]].setStyle({
                    color: '#7fff00',
                })
                layers[Object.keys(layers)[1]].setStyle({
                    color: '#7fff00',
                })
            } else {
                $(
                    '#DrawToolAnnotation_' +
                        $(this).attr('layer_id') +
                        '_' +
                        $(this).attr('shape_id')
                ).addClass('highlight')
            }
        })
        $('.drawToolShapeLi').on('mouseleave', function () {
            if (DrawTool.activeContent === 'history') return
            var layer = $(this).find('.drawToolShapeLiItem').attr('layer')
            var index = $(this).find('.drawToolShapeLiItem').attr('index')
            var shapeId = $(this).attr('shape_id')
            var shape = L_.layers.layer[layer][index]

            var style
            if (
                !shape.hasOwnProperty('feature') &&
                shape.hasOwnProperty('_layers')
            )
                style =
                    shape._layers[Object.keys(shape._layers)[0]].feature
                        .properties.style
            else style = shape.feature.properties.style
            if (style == null) style = shape.options

            let color = style.color

            // Keep the active feature highlighted after mouseleave
            if (Map_.activeLayer) {
                if (
                    typeof shape.setStyle === 'function' &&
                    ((shape.hasOwnProperty('_layers') &&
                        shape.hasLayer(Map_.activeLayer)) ||
                        Map_.activeLayer === shape)
                ) {
                    color =
                        (L_.configData.look &&
                            L_.configData.look.highlightcolor) ||
                        'red'
                } else if (
                    shape.hasOwnProperty('_layers') &&
                    Map_.activeLayer === shape
                ) {
                    color =
                        (L_.configData.look &&
                            L_.configData.look.highlightcolor) ||
                        'red'
                }
            }

            if (typeof shape.setStyle === 'function') shape.setStyle({ color })
            else if (shape.hasOwnProperty('_layers')) {
                //Arrow
                var layers = shape._layers

                if (shape.isLinework) {
                    const geoColor = F_.getIn(style, 'geologic.color', null)
                    color =
                        geoColor != null ? F_.colorCodeToColor(geoColor) : color
                }
                layers[Object.keys(layers)[0]].setStyle({ color })
                layers[Object.keys(layers)[1]].setStyle({ color })
            } else
                $(
                    '#DrawToolAnnotation_' +
                        $(this).attr('layer_id') +
                        '_' +
                        $(this).attr('shape_id')
                ).removeClass('highlight')
            if (Map_.activeLayer === l[i]) {
                $(
                    '#DrawToolAnnotation_' +
                        $(this).attr('layer_id') +
                        '_' +
                        $(this).attr('shape_id')
                ).addClass('hovered')
            }
        })
        $('.drawToolShapeLiItem').on('click', function (e) {
            var layer = $(this).attr('layer')
            var index = $(this).attr('index')
            var shape = L_.layers.layer[layer][index]
            if (!mmgisglobal.shiftDown) {
                if (typeof shape.getBounds === 'function')
                    Map_.map.panTo(shape.getBounds().getCenter())
                else if (shape.hasOwnProperty('_latlng'))
                    Map_.map.panTo(shape._latlng)
                else if (shape.hasOwnProperty('_layers')) {
                    //Arrow
                    var layers = shape._layers
                    var pos = DrawTool.getInnerLayers(
                        layers[Object.keys(layers)[1]],
                        3
                    )
                    if (pos) {
                        pos = pos._latlngs[1]
                        Map_.map.panTo(pos)
                    }
                }
            }

            if (shape.hasOwnProperty('_layers'))
                shape._layers[Object.keys(shape._layers)[0]].fireEvent('click')
            else shape.fireEvent('click')
        })

        if (
            fileId != null &&
            selectedFeatureIds != null &&
            !(selectedFeatureIds.length == 1 && selectedFeatureIds[0] == null)
        ) {
            mmgisglobal.ctrlDown = false
            for (var i = 0; i < selectedFeatureIds.length; i++) {
                var item = $(
                    '.drawToolShapeLi[file_id="' +
                        fileId +
                        '"][shape_id="' +
                        selectedFeatureIds[i] +
                        '"] > div'
                )
                if (item.length > 0) {
                    var shape =
                        L_.layers.layer[item.attr('layer')][item.attr('index')]
                    if (shape.hasOwnProperty('_layers'))
                        shape._layers[Object.keys(shape._layers)[0]].fireEvent(
                            'click'
                        )
                    else shape.fireEvent('click')
                }
                mmgisglobal.ctrlDown = true
            }
            mmgisglobal.ctrlDown = false
        }
    },
    updateCopyTo: function (intent, subintent) {
        //if( intent === DrawTool.lastShapeIntent ) return;
        //Update copy to dropdown
        var defaultOpt = 'File...'
        $('#drawToolShapesCopyDropdown *').remove()
        $('#drawToolShapesCopyDropdown').html(
            "<select id='drawToolShapesCopySelect' class='ui dropdown dropdown_1'></select>"
        )
        d3.select('#drawToolShapesCopySelect').html(
            "<option value='' disabled selected hidden>" +
                defaultOpt +
                '</option>'
        )

        if (intent) {
            //Don't allow copies to same file
            var filenames = []
            $('.drawToolShapeLi').each(function (i, elm) {
                if ($(elm).hasClass('active')) {
                    filenames.push($(elm).attr('file_name'))
                }
            })

            for (var i = 0; i < DrawTool.files.length; i++) {
                const file = DrawTool.files[i]
                let ownedByUser = false
                if (
                    mmgisglobal.user == file.file_owner ||
                    (file.file_owner_group &&
                        F_.diff(file.file_owner_group, DrawTool.userGroups)
                            .length > 0)
                )
                    ownedByUser = true
                const isListEdit =
                    file.public == '1' &&
                    file.publicity_type == 'list_edit' &&
                    typeof file.public_editors?.includes === 'function' &&
                    (file.public_editors.includes(mmgisglobal.user) ||
                        ownedByUser)
                const isAllEdit =
                    file.public == '1' && file.publicity_type == 'all_edit'
                //Lead Files
                if (
                    DrawTool.userGroups.indexOf('mmgis-group') != -1 &&
                    DrawTool.files[i].file_owner == 'group' &&
                    filenames.indexOf(DrawTool.files[i].file_name) == -1 &&
                    DrawTool.files[i].hidden == '0' &&
                    ((intent == 'all' &&
                        subintent == 'polygon' &&
                        (DrawTool.files[i].intent == 'roi' ||
                            DrawTool.files[i].intent == 'campaign' ||
                            DrawTool.files[i].intent == 'campsite')) ||
                        (intent == 'all' &&
                            subintent == 'line' &&
                            DrawTool.files[i].intent == 'trail') ||
                        (intent == 'all' &&
                            subintent == 'point' &&
                            DrawTool.files[i].intent == 'signpost') ||
                        intent == DrawTool.files[i].intent)
                ) {
                    d3.select('#drawToolShapesCopySelect')
                        .append('option')
                        .attr('value', DrawTool.files[i].id)
                        .text(DrawTool.files[i].file_name + ' [Lead]')
                } else if (
                    (mmgisglobal.user == DrawTool.files[i].file_owner ||
                        isListEdit ||
                        isAllEdit) &&
                    filenames.indexOf(DrawTool.files[i].file_name) == -1 &&
                    intent == DrawTool.files[i].intent &&
                    DrawTool.files[i].hidden == '0'
                ) {
                    d3.select('#drawToolShapesCopySelect')
                        .append('option')
                        .attr('value', DrawTool.files[i].id)
                        .text(DrawTool.files[i].file_name)
                }
            }
        }

        DrawTool.copyFileId = null
        $('#drawToolShapesCopySelect').on('change', function (e) {
            const val = $(this).val()
            const name = $(this).find('option:selected').text()
            DrawTool.copyFileId = val
            DrawTool.copyFilename = name
        })

        //$( '#drawToolShapesCopySelect' ).dropdown( 'set selected', DrawTool.copyFilename || defaultOpt );
    },
    prevNext: function (e) {
        let activeI = null
        let shapes = []
        $('.drawToolShapeLi').each(function (i) {
            if ($(this).hasClass('active')) activeI = i
            shapes.push($(this))
        })
        if (activeI != null) {
            if (e.which === 37) {
                // Up arrow
                if (shapes[activeI - 1])
                    shapes[activeI - 1].find('.drawToolShapeLiItem').click()
            } else if (e.which === 39) {
                // Down Arrow
                if (shapes[activeI + 1])
                    shapes[activeI + 1].find('.drawToolShapeLiItem').click()
            }
        }
    },
    //Shapes
    addValue: function (value) {
        let id, key, op, val
        if (value) {
            id = value.id
            key = value.key != null ? ` value='${value.key}'` : ''
            op = value.op
            val = value.value != null ? ` value='${value.value}'` : ''
        } else id = Shapes.filters.values.length

        // prettier-ignore
        const valueMarkup = [
            `<div class='drawToolShapes_filtering_value' id='drawToolShapes_filtering_value_${id}'>`,
                "<div class='drawToolShapes_filtering_value_key'>",
                    `<input id='drawToolShapes_filtering_value_key_input_${id}' class='drawToolShapes_filtering_value_key_input' spellcheck='false' type='text'${key} placeholder='Property...'></input>`,
                "</div>",
                "<div class='drawToolShapes_filtering_value_operator'>",
                    `<div id='drawToolShapes_filtering_value_operator_${id}' class='drawToolShapes_filtering_value_operator_select'></div>`,
                "</div>",
                "<div class='drawToolShapes_filtering_value_value'>",
                    `<input id='drawToolShapes_filtering_value_value_input_${id}' class='drawToolShapes_filtering_value_value_input' spellcheck='false' type='text'${val} placeholder='Value...'></input>`,
                    `<div class='drawToolShapes_filtering_value_value_type'>`,
                        `<i id='drawToolShapes_filtering_value_value_type_number_${id}' style='display: none;' class='mdi mdi-numeric mdi-18px'></i>`,
                        `<i id='drawToolShapes_filtering_value_value_type_string_${id}' style='display: none;'class='mdi mdi-alphabetical-variant mdi-18px'></i>`,
                    `</div>`,
                "</div>",
                `<div id='drawToolShapes_filtering_value_clear_${id}' class='mmgisButton5 drawToolShapes_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>`,
            "</div>",
        ].join('\n')

        $('#drawToolShapes_filtering_filters_list').append(valueMarkup)

        if (value == null) {
            Shapes.filters.values.push({
                id: id,
                type: null,
                key: null,
                op: '=',
                value: null,
            })
        }

        Shapes.attachValueEvents(id, { op: op })

        // Show footer iff value rows exist
        $('#drawToolShapes_filtering_footer').css(
            'display',
            Shapes.filters.values.length === 0 ? 'none' : 'flex'
        )
    },
    // To highlight the submit button to indicate a change's been made in the form
    setSubmitButtonState: function (active) {
        if (active) {
            $('#drawToolShapes_filtering_submit_text').text('Submit')
            $('#drawToolShapes_filtering_submit').addClass('active')
        } else if ($('#drawToolShapes_filtering_submit').hasClass('active')) {
            $('#drawToolShapes_filtering_submit_text').text('Submitted')
            $('#drawToolShapes_filtering_submit').removeClass('active')
        }
    },
    attachEvents: function (fileIds) {
        // Add Value
        $('#drawToolShapes_filtering_add_value').off('click')
        $('#drawToolShapes_filtering_add_value').on('click', function () {
            Shapes.addValue()
        })

        // Submit
        $(`#drawToolShapes_filtering_submit`).off('click')
        $(`#drawToolShapes_filtering_submit`).on('click', async () => {
            Shapes.setSubmitButtonState(true)
            $(`#drawToolShapes_filtering_submit_loading`).addClass('active')
            $(`.drawToolContextMenuHeaderClose`).click()

            fileIds.forEach((fileId) => {
                // Refilter to show all
                const filter = {
                    values: JSON.parse(JSON.stringify(Shapes.filters.values)),
                    geojson: {
                        type: 'FeatureCollection',
                        features: DrawTool.fileGeoJSONFeatures[fileId],
                    },
                    aggs: JSON.parse(JSON.stringify(Shapes.filters.aggs)),
                }
                LocalFilterer.filter(
                    `DrawTool_${fileId}`,
                    filter,
                    (filteredGeoJSON) => {
                        DrawTool.refreshFile(
                            fileId,
                            null,
                            true,
                            null,
                            null,
                            null,
                            filteredGeoJSON,
                            true
                        )
                    }
                )
            })
            $(`#drawToolShapes_filtering_submit_loading`).removeClass('active')
            Shapes.setSubmitButtonState(false)
        })

        // Clear
        $(`#drawToolShapes_filtering_clear`).off('click')
        $(`#drawToolShapes_filtering_clear`).on('click', async () => {
            $(`#drawToolShapes_filtering_submit_loading`).addClass('active')

            // Clear value filter elements
            Shapes.filters.values = Shapes.filters.values.filter((v) => {
                if (v) $(`#drawToolShapes_filtering_value_${v.id}`).remove()
                return false
            })

            $(`.drawToolContextMenuHeaderClose`).click()
            fileIds.forEach((fileId) => {
                console.log(Shapes.filters)
                // Refilter to show all
                const filter = {
                    values: JSON.parse(JSON.stringify(Shapes.filters.values)),
                    geojson: {
                        type: 'FeatureCollection',
                        features: DrawTool.fileGeoJSONFeatures[fileId],
                    },
                    aggs: JSON.parse(JSON.stringify(Shapes.filters.aggs)),
                }
                LocalFilterer.filter(
                    `DrawTool_${fileId}`,
                    filter,
                    (filteredGeoJSON) => {
                        DrawTool.refreshFile(
                            fileId,
                            null,
                            true,
                            null,
                            null,
                            null,
                            filteredGeoJSON,
                            true
                        )
                    }
                )
            })
            // Reset count
            $('#drawToolShapes_filtering_count').text('')

            Shapes.setSubmitButtonState(false)

            $(`#drawToolShapes_filtering_submit_loading`).removeClass('active')
        })
    },
    attachValueEvents: function (id, options) {
        options = options || {}

        let elmId

        // Expand input boxes on focus
        // Contract input boxes on blur
        elmId = `#drawToolShapes_filtering_value_key_input_${id}`
        $(elmId).on('focus', function () {
            $(this).parent().css('flex', '4 1')
        })
        $(elmId).on('blur', function () {
            $(this).parent().css('flex', '1 1')
        })
        elmId = `#drawToolShapes_filtering_value_value_input_${id}`
        $(elmId).on('focus', function () {
            $(this).parent().css('flex', '4 1')
        })
        $(elmId).on('blur', function () {
            $(this).parent().css('flex', '1 1')
        })
        // Clear
        elmId = `#drawToolShapes_filtering_value_clear_${id}`

        $(elmId).on('click', () => {
            // Clear value filter element
            for (let i = 0; i < Shapes.filters.values.length; i++) {
                const vId = Shapes.filters.values[i]?.id
                if (vId != null && vId === id) {
                    $(`#drawToolShapes_filtering_value_${vId}`).remove()
                    Shapes.filters.values[i] = null
                }
            }
            Shapes.setSubmitButtonState(true)
        })

        // Property Autocomplete
        elmId = `#drawToolShapes_filtering_value_key_input_${id}`

        let arrayToSearch = Object.keys(Shapes.filters.aggs)
        arrayToSearch = arrayToSearch.sort((a, b) => b.localeCompare(a))

        $(elmId).autocomplete({
            lookup: arrayToSearch,
            lookupLimit: 100,
            minChars: 0,
            transformResult: function (response, originalQuery) {
                let resultSuggestions = []
                $.map(response, function (jsonItem) {
                    if (typeof jsonItem != 'string') {
                        $.map(jsonItem, function (suggestionItem) {
                            resultSuggestions.push(suggestionItem)
                        })
                    }
                })
                resultSuggestions.sort(function (a, b) {
                    const aStart = String(a.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 },
                        bStart = String(b.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 }
                    if (aStart.index != bStart.index)
                        return aStart.index - bStart.index
                    else return a > b ? 1 : -1
                })
                response.suggestions = resultSuggestions
                return response
            },
            onSelect: function (event) {
                const property = Shapes.filters.aggs[event.value]
                Shapes.filters.values[id].type = property.type
                Shapes.filters.values[id].key = event.value
                Shapes.updateValuesAutoComplete(id)
                Shapes.setSubmitButtonState(true)
                $(this).css('border', 'none')
            },
        })

        $(elmId).on('blur', function (event) {
            const property = Shapes.filters.aggs[event.value || $(this).val()]
            if (property) {
                if (
                    Shapes.filters.values[id] &&
                    Shapes.filters.values[id].key !== event.value
                ) {
                    Shapes.filters.values[id].key = event.value
                    Shapes.filters.values[id].type = property.type
                    Shapes.updateValuesAutoComplete(id)
                    Shapes.setSubmitButtonState(true)
                }
                $(this).css('border', 'none')
            } else $(this).css('border', '1px solid red')
        })

        // Operator Dropdown
        elmId = `#drawToolShapes_filtering_value_operator_${id}`

        const ops = ['=', ',', '<', '>']
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<i class='mdi mdi-equal mdi-18px' title='Equals'></i>`,
                    `<div title='Comma-separated list' style='font-family: monospace;'>in</div>`,
                    `<i class='mdi mdi-less-than mdi-18px' title='Less than'></i>`,
                    `<i class='mdi mdi-greater-than mdi-18px' title='Greater than'></i>`,
                ],
                'op',
                opId,
                { openHorizontal: true, fixedItemWidth: 30, hideChevron: true }
            )
        )
        Dropy.init($(elmId), function (idx) {
            Shapes.filters.values[id].op = ops[idx]
            Shapes.setSubmitButtonState(true)
        })

        // Value AutoComplete
        Shapes.updateValuesAutoComplete(id)
    },
    updateValuesAutoComplete: function (id) {
        let elmId = `#drawToolShapes_filtering_value_value_input_${id}`
        let arrayToSearch = []
        if (
            Shapes.filters.values[id].key &&
            Shapes.filters.aggs[Shapes.filters.values[id].key]
        )
            arrayToSearch = Object.keys(
                Shapes.filters.aggs[Shapes.filters.values[id].key].aggs || {}
            )
        $(elmId).autocomplete({
            lookup: arrayToSearch,
            lookupLimit: 150,
            minChars: 0,
            transformResult: function (response, originalQuery) {
                let resultSuggestions = []
                $.map(response, function (jsonItem) {
                    if (typeof jsonItem != 'string') {
                        $.map(jsonItem, function (suggestionItem) {
                            resultSuggestions.push(suggestionItem)
                        })
                    }
                })
                resultSuggestions.sort(function (a, b) {
                    const aStart = String(a.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 },
                        bStart = String(b.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 }
                    if (aStart.index != bStart.index)
                        return aStart.index - bStart.index
                    else return a > b ? 1 : -1
                })
                response.suggestions = resultSuggestions
                return response
            },
            onSelect: function (event) {
                Shapes.filters.values[id].value = event.value
                Shapes.setSubmitButtonState(true)
            },
        })
        $(elmId).on('keyup', function (e) {
            Shapes.filters.values[id].value = $(this).val()
            Shapes.setSubmitButtonState(true)
        })

        $('.autocomplete-suggestions').css({
            'max-height': '300px',
            'border-top': 'none',
        })

        // Change type indicator icons too
        const numberElmId = `#drawToolShapes_filtering_value_value_type_number_${id}`
        const stringElmId = `#drawToolShapes_filtering_value_value_type_string_${id}`
        switch (Shapes.filters.values[id].type) {
            case 'number':
                $(numberElmId).css('display', 'inherit')
                $(stringElmId).css('display', 'none')
                break
            case 'string':
                $(stringElmId).css('display', 'inherit')
                $(numberElmId).css('display', 'none')
                break
            default:
                $(numberElmId).css('display', 'none')
                $(stringElmId).css('display', 'none')
                break
        }
    },
}

export default Shapes
