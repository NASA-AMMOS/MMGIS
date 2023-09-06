import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'

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
        $('#drawToolShapesFeaturesList *').remove()
        for (var l in L_.layers.layer) {
            var s = l.split('_')
            var onId = s[1] != 'master' ? parseInt(s[1]) : s[1]
            if (s[0] == 'DrawTool' && DrawTool.filesOn.indexOf(onId) != -1) {
                var file = DrawTool.getFileObjectWithId(s[1])
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
}

export default Shapes
