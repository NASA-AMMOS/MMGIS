import $ from 'jquery'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Basics/UserInterface_/components/CursorInfo/CursorInfo'
import Toast from '../../Basics/UserInterface_/components/Toast/Toast'
import LocalFilterer from '../../services/LocalFilterer'
import Dropy from '../../../external/Dropy/dropy'
import Sortable from 'sortablejs'
import calls from '../../../pre/calls'

import './DrawTool_Shapes.css'

var DrawTool = null
var Shapes = {
    mode: 'onscreen', // 'onscreen' or 'all'
    pagination: {
        page: 0,
        rowsPerPage: 100, // Fixed page size
        totalCount: 0,
    },
    currentResults: null,
    currentFilter: null, // Store active filter for pagination (combined text + advanced)
    currentAdvancedFilter: null, // Store advanced filter separately
    currentTextFilter: null, // Store text filter separately
    currentFileIds: null, // Store active file IDs for pagination/sorting
    pendingSelection: null, // Store pending feature selection {fileId, featureId}
    sortBy: null,
    sortOrder: 'asc',
    sort: {
        property: null, // null means "None"
        direction: 'asc', // 'asc' or 'desc'
    },
    init: function (tool) {
        DrawTool = tool
        DrawTool.populateShapes = Shapes.populateShapes
        DrawTool.updateCopyTo = Shapes.updateCopyTo
        DrawTool.setSubmitButtonState = Shapes.setSubmitButtonState
        DrawTool.clearSelectionRestore = Shapes.clearSelectionRestore
    },
    clearSelectionRestore: function () {
        Shapes._selectionToRestore = null
    },
    populateShapes: function (fileId, selectedFeatureIds) {
        // Force hide tooltip when rebuilding features (in case it's showing a removed feature) (Fix #4)
        $('#drawToolMouseoverText').removeClass('active')

        // If in filtered mode with active filter, skip DOM rebuild (will be restored at end)
        // But still attach map layer handlers below for click functionality
        const skipDOMRebuild = Shapes.mode === 'all' && Shapes.currentFilter

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

        // Also capture selection in _selectionToRestore for consistency across modes
        if (!Shapes._selectionToRestore && !skipDOMRebuild) {
            const activeFeature = $('.drawToolShapeLi.active').first()
            if (activeFeature.length > 0) {
                Shapes._selectionToRestore = {
                    featureId:
                        activeFeature.attr('shape_id') ||
                        activeFeature.attr('feature_id'),
                    fileId: activeFeature.attr('file_id'),
                }
            }
        }

        //Populate shapes
        const fileIds = []
        if (!skipDOMRebuild) {
            $('#drawToolShapesFeaturesList *').remove()
        }
        for (var l in L_.layers.layer) {
            var s = l.split('_')
            var onId = s[1] != 'master' ? parseInt(s[1]) : s[1]
            if (s[0] == 'DrawTool' && DrawTool.filesOn.indexOf(onId) != -1) {
                var file = DrawTool.getFileObjectWithId(s[1])
                fileIds.push(onId)
                if (L_.layers.layer[l].length > 0) {
                    const headerLi = $('<li>')
                        .attr('class', 'drawToolShapesFeaturesListFileHeader')
                        .css({
                            background:
                                DrawTool.categoryStyles[file.intent].color,
                            color:
                                file.intent == 'campaign' ||
                                file.intent == 'campsite' ||
                                file.intent == 'trail' ||
                                file.intent == 'all'
                                    ? 'black'
                                    : 'white',
                        })
                        .html(file.file_name)
                    if (!skipDOMRebuild) {
                        $('#drawToolShapesFeaturesList').append(headerLi)
                    }
                }
                for (var i = 0; i < L_.layers.layer[l].length; i++) {
                    addShapeToList(
                        L_.layers.layer[l][i],
                        file,
                        l,
                        i,
                        s[1],
                        skipDOMRebuild
                    )
                }
            }
        }

        // Set up global map handler to hide tooltip when mouse moves over empty map areas (Fix #1)
        // Use namespaced event for easy cleanup, and check if not already bound
        if (!Shapes._globalTooltipHandlerBound) {
            Map_.map.off('mousemove.drawToolTooltip') // Remove any existing handler first
            Map_.map.on('mousemove.drawToolTooltip', function (e) {
                // Check if mouse is NOT over a feature (leaflet-interactive class is on vector features)
                if (
                    e.originalEvent &&
                    e.originalEvent.target &&
                    !e.originalEvent.target.closest('.leaflet-interactive')
                ) {
                    $('#drawToolMouseoverText').removeClass('active')
                }
            })
            Shapes._globalTooltipHandlerBound = true
        }

        // Store fileIds for sort/pagination handlers
        Shapes.currentFileIds = fileIds
        Shapes.filters = Shapes.filters || {
            values: [],
            valuesOrder: [], // Track order for drag & drop
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
            console.warn(
                `Shapes Filtering - Cannot find GeoJSON to filter on for file ids: ${fileIds}`,
                err
            )
            return
        }

        // Only fetch aggregations if fileIds have changed
        const fileIdsKey = fileIds.sort().join(',')
        const shouldFetchAggregations =
            !Shapes._cachedAggregationsFileIds ||
            Shapes._cachedAggregationsFileIds !== fileIdsKey

        if (shouldFetchAggregations) {
            Shapes._cachedAggregationsFileIds = fileIdsKey

            // Fetch aggregations from backend instead of using LocalFilterer
            Shapes.fetchAggregations(fileIds, (aggregations) => {
                Shapes.filters.aggs = aggregations

                // Continue with event attachment after aggregations load
                Shapes.attachEvents(fileIds)

                // Refresh autocomplete for any existing value rows with new aggregations
                $('.drawToolShapes_filtering_value').each(function () {
                    const idMatch = $(this)
                        .attr('id')
                        .match(/_(\d+)$/)
                    if (idMatch) {
                        const id = parseInt(idMatch[1])
                        Shapes.refreshValueAutocomplete(id)
                    }
                })

                // Start with one empty row added if none exist
                if (
                    $(
                        '#drawToolShapes_filtering_filters_list .drawToolShapes_filtering_value'
                    ).length === 0
                ) {
                    Shapes.addValue()
                }
            })
        } else {
            // Aggregations already cached, no need to refetch
        }

        $('#drawToolShapesFilterAdvanced').off('click')
        $('#drawToolShapesFilterAdvanced').on('click', function () {
            $('#drawToolShapesFilterAdvanced').toggleClass('on')
            $('#drawToolShapesFilterAdvancedDiv').toggleClass('on')
            if (!$('#drawToolShapesFilterAdvanced').hasClass('on')) {
                $(`#drawToolShapes_filtering_clear`).click()
            }
        })
        $('#drawToolShapesFilterClear').off('click')
        $('#drawToolShapesFilterClear').on('click', function () {
            $('#drawToolShapesFilter').val('')
            // Clear text filter
            Shapes.currentTextFilter = null

            // If advanced filter exists, apply it
            if (Shapes.currentAdvancedFilter) {
                Shapes.mode = 'all'
                Shapes.fetchAllFeatures(fileIds, Shapes.currentAdvancedFilter)
            } else {
                // No filters, return to onscreen mode
                Shapes.mode = 'onscreen'
                DrawTool.populateShapes()
            }
        })
        $('#drawToolShapesFilter').off('input')
        $('#drawToolShapesFilter').on('input', shapeFilter)
        shapeFilter()

        // Initialize Sort Controls
        Shapes.initializeSort()

        // Re-apply sort if there's an active sort state and we're in onscreen mode
        if (Shapes.sort.property != null && Shapes.mode === 'onscreen') {
            Shapes.applySort()
        }

        // Initialize Pagination
        Shapes.initPagination(fileIds)

        function shapeFilter() {
            var v = $('#drawToolShapesFilter').val()
            const textValue =
                v != null && v != '' && v.trim() !== '' ? v.trim() : null

            // Store text filter separately
            Shapes.currentTextFilter = textValue

            // Combine text filter with advanced filter
            let combinedFilter = null

            if (textValue && Shapes.currentAdvancedFilter) {
                // Both text and advanced filter: combine with AND
                const textFilter = `name+contains+string+${textValue}`
                combinedFilter = `${textFilter},and,${Shapes.currentAdvancedFilter}`
            } else if (textValue) {
                // Only text filter
                const textFilter = `name+contains+string+${textValue}`
                combinedFilter = textFilter
            } else if (Shapes.currentAdvancedFilter) {
                // Only advanced filter
                combinedFilter = Shapes.currentAdvancedFilter
            }

            if (combinedFilter) {
                // Has filter: Query server for all results
                Shapes.mode = 'all'
                Shapes.fetchAllFeatures(fileIds, combinedFilter)
            } else {
                // NO FILTER: Show onscreen features only
                Shapes.mode = 'onscreen'

                // Hide pagination
                $('#drawToolShapesPagination').hide()

                // Make sure all items are visible (don't repopulate to avoid recursion)
                $('.drawToolShapeLi').css('display', 'list-item')
                $('#drawToolShapesFilterCount').text('')
                $('#drawToolShapesFilterCount').css('padding-right', '0px')
            }
        }

        function addShapeToList(
            shape,
            file,
            layer,
            index,
            layerId,
            skipDOMRebuild
        ) {
            if (shape == null) return

            // Skip associated points - they are not independent features
            if (shape._isAssociatedPoint === true) return

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

            // Also check _selectionToRestore for consistency
            if (
                Shapes._selectionToRestore &&
                Shapes._selectionToRestore.featureId == properties._.id &&
                Shapes._selectionToRestore.fileId == file.id
            ) {
                activeClass = ' active'
            }

            const shapeLi = $('<li>')
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
            if (!skipDOMRebuild) {
                $('#drawToolShapesFeaturesList').append(shapeLi)
            }

            $('#drawToolShapeLiItem_' + layer + '_' + index)
                .find('.drawToolShapeLiItemB')
                .attr('title', properties.name || 'No Name')
                .text(properties.name || 'No Name')

            for (var elayer in f) {
                var e = f[elayer]

                // Skip associated points - they are not independently interactive
                if (e._isAssociatedPoint === true) continue

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
                                left:
                                    centerPx.x +
                                    20 +
                                    document
                                        .getElementById('mapScreen')
                                        .getBoundingClientRect().left,
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
                    // ALWAYS hide tooltip, even during drag (Fix #2)
                    $('#drawToolMouseoverText').removeClass('active')

                    // Skip other cleanup if dragging
                    if (
                        DrawTool.contextMenuLayer &&
                        DrawTool.contextMenuLayer.dragging
                    )
                        return

                    $('.drawToolShapeLi').removeClass('hovered')
                    $('.drawToolShapeLi .drawToolShapeLiItem').mouseleave()
                })
                e.off('click')
                e.on(
                    'click',
                    (function (layer, index, fileid, featureId) {
                        return function (event) {
                            if (DrawTool.activeContent != 'shapes')
                                DrawTool.showContent('shapes')

                            var ctrl = mmgisglobal.ctrlDown
                            // Try to find list item by layer/index (onscreen mode)
                            var elm = $(
                                '#drawToolShapeLiItem_' + layer + '_' + index
                            )

                            // If not found, try by file_id/feature_id (filtered mode)
                            if (elm.length === 0 && featureId) {
                                elm = $(
                                    `.drawToolShapeLi[file_id="${fileid}"][feature_id="${featureId}"]`
                                )
                            }

                            var intent = elm.attr('intent')

                            //No mismatched intents
                            if (
                                ctrl &&
                                DrawTool.lastShapeIntent !== intent &&
                                DrawTool.contextMenuLayer != null &&
                                DrawTool.contextMenuLayers.length > 0
                            ) {
                                Toast.warning('Grouped shapes must share intent.', 6000)
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
                    })(layer, index, file.id, properties._.id)
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

            // Defensive check: ensure layer and feature exist at this index
            if (!L_.layers.layer[layer] || !L_.layers.layer[layer][index]) {
                console.warn(
                    'DrawTool Shapes: Feature reference stale, ignoring hover'
                )
                return
            }

            var shape = L_.layers.layer[layer][index]

            if (typeof shape.setStyle === 'function')
                shape.setStyle({ color: '#7fff00' })
            else if (shape.hasOwnProperty('_layers')) {
                //Arrow
                var layers = shape._layers
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

            // Defensive check: ensure layer and feature exist at this index
            if (!L_.layers.layer[layer] || !L_.layers.layer[layer][index]) {
                console.warn(
                    'DrawTool Shapes: Feature reference stale, ignoring hover'
                )
                return
            }

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

            // Skip if this is a filtered list item (has feature_id instead of layer/index)
            if (!layer || !index) {
                return // Filtered items have their own handler
            }

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

        // Only auto-select if we actually built the DOM list
        if (
            !skipDOMRebuild &&
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
                } else {
                    console.warn(
                        '[DrawTool Shapes] Auto-select: Item not found in list'
                    )
                }
                mmgisglobal.ctrlDown = true
            }
            mmgisglobal.ctrlDown = false
        }

        // Restore selection if one was stored (add checked class)
        if (Shapes._selectionToRestore && !skipDOMRebuild) {
            const { featureId, fileId } = Shapes._selectionToRestore

            const itemToSelect = $(
                `.drawToolShapeLi[file_id="${fileId}"][shape_id="${featureId}"]`
            )
            if (itemToSelect.length > 0) {
                // Active class already added during creation, just add checked
                if (!itemToSelect.hasClass('active')) {
                    itemToSelect.addClass('active')
                }
                itemToSelect
                    .find('.drawToolShapeLiItemCheck')
                    .addClass('checked')
            } else {
            }

            // Clear the flag
            Shapes._selectionToRestore = null
        }

        // Apply pending selection if any (for onscreen mode)
        if (Shapes.pendingSelection) {
            const { fileId, featureId } = Shapes.pendingSelection
            Shapes.pendingSelection = null // Clear it

            // Select directly - no timing needed since DOM is already built
            const itemToSelect = $(
                `.drawToolShapeLi[file_id="${fileId}"][shape_id="${featureId}"]`
            )
            if (itemToSelect.length > 0) {
                itemToSelect.addClass('active')
                itemToSelect
                    .find('.drawToolShapeLiItemCheck')
                    .addClass('checked')
                // Select on map
                Shapes.selectFeatureOnMap(fileId, featureId)
            }
        }

        // Update mode message
        Shapes.updateModeMessage()

        // If we're in filtered mode, restore the filtered results
        // (populateShapes always rebuilds from onscreen features, so we need to restore the filter)
        if (Shapes.mode === 'all' && Shapes.currentFilter) {
            // Preserve which feature should be selected (if any)
            const activeFeature = $('.drawToolShapeLi.active').first()
            const featureIdToReselect =
                activeFeature.length > 0
                    ? activeFeature.attr('feature_id')
                    : null
            const fileIdToReselect =
                activeFeature.length > 0 ? activeFeature.attr('file_id') : null

            // Store selection for restoration AFTER fetchAllFeatures completes
            if (featureIdToReselect && fileIdToReselect) {
                Shapes._selectionToRestore = {
                    featureId: featureIdToReselect,
                    fileId: fileIdToReselect,
                }
            } else {
                Shapes._selectionToRestore = null
            }

            // Prevent redundant fetches - skip if already fetching or if list already matches filter
            const now = Date.now()
            const timeSinceLastCall = Shapes._lastFetchAllFeaturesCall
                ? now - Shapes._lastFetchAllFeaturesCall
                : Infinity

            // Check if list already shows filtered results (correct filter and has items)
            const listHasFilteredResults =
                $('.drawToolShapeLi[id^="drawToolShapeLiItem_all_"]').length > 0
            const filterMatches =
                Shapes._lastAppliedFilter === Shapes.currentFilter

            if (Shapes._isFetchingAllFeatures) {
                return
            }

            if (
                listHasFilteredResults &&
                filterMatches &&
                timeSinceLastCall < 2000
            ) {
                // Even though we're skipping the fetch, ensure selection is still highlighted
                if (featureIdToReselect && fileIdToReselect) {
                    const itemToSelect = $(
                        `.drawToolShapeLi[file_id="${fileIdToReselect}"][feature_id="${featureIdToReselect}"]`
                    )
                    if (itemToSelect.length > 0) {
                        // Ensure active class and checked class are present
                        if (!itemToSelect.hasClass('active')) {
                            itemToSelect.addClass('active')
                        }
                        const checkbox = itemToSelect.find(
                            '.drawToolShapeLiItemCheck'
                        )
                        if (!checkbox.hasClass('checked')) {
                            checkbox.addClass('checked')
                        }
                    }
                }
                return
            }

            Shapes._lastFetchAllFeaturesCall = now
            Shapes._lastAppliedFilter = Shapes.currentFilter
            Shapes._isFetchingAllFeatures = true

            requestAnimationFrame(() => {
                const fileIds = Object.keys(DrawTool.filesOn)
                    .map((idx) => DrawTool.filesOn[idx])
                    .filter((id) => id != null && id !== 'master')
                Shapes.fetchAllFeatures(fileIds, Shapes.currentFilter)
            })
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
        $('#drawToolShapesCopySelect').html(
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
                    const leadOption = $('<option>')
                        .attr('value', DrawTool.files[i].id)
                        .text(DrawTool.files[i].file_name + ' [Lead]')
                    $('#drawToolShapesCopySelect').append(leadOption)
                } else if (
                    (mmgisglobal.user == DrawTool.files[i].file_owner ||
                        isListEdit ||
                        isAllEdit) &&
                    filenames.indexOf(DrawTool.files[i].file_name) == -1 &&
                    intent == DrawTool.files[i].intent &&
                    DrawTool.files[i].hidden == '0'
                ) {
                    const fileOption = $('<option>')
                        .attr('value', DrawTool.files[i].id)
                        .text(DrawTool.files[i].file_name)
                    $('#drawToolShapesCopySelect').append(fileOption)
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
    encodeFilters: function (filterValues, valuesOrder) {
        if (!filterValues || filterValues.length === 0) return null

        // Sort by valuesOrder if provided (matching LayersTool pattern)
        let sortedValues = filterValues.filter(Boolean) // Remove nulls
        if (valuesOrder && valuesOrder.length > 0) {
            sortedValues.sort((a, b) => {
                return valuesOrder.indexOf(a.id) - valuesOrder.indexOf(b.id)
            })
        }

        const encoded = []
        sortedValues.forEach((v) => {
            if (v.isGroup) {
                encoded.push(v.op)
            } else {
                const op = v.op === ',' ? 'in' : v.op
                const value = v.value ? v.value.replaceAll(',', '$') : ''
                const encodedFilter = `${v.key}+${op}+${v.type}+${value}`
                encoded.push(encodedFilter)
            }
        })
        return encoded.join(',')
    },
    fetchAllFeatures: function (
        fileIds,
        filters,
        sortBy,
        sortOrder,
        page,
        rowsPerPage
    ) {
        if (!fileIds || fileIds.length === 0) {
            console.warn(
                '[DrawTool Shapes] No fileIds provided to fetchAllFeatures'
            )
            return
        }

        // Use provided parameters or defaults
        // If filters are explicitly provided, store them for pagination
        if (filters !== undefined) {
            Shapes.currentFilter = filters
        }
        filters =
            filters !== undefined
                ? filters
                : Shapes.currentFilter !== null
                  ? Shapes.currentFilter
                  : Shapes.encodeFilters(
                        Shapes.filters.values,
                        Shapes.filters.valuesOrder
                    )
        sortBy = sortBy !== undefined ? sortBy : Shapes.sortBy
        sortOrder = sortOrder !== undefined ? sortOrder : Shapes.sortOrder
        page = page !== undefined ? page : Shapes.pagination.page
        rowsPerPage =
            rowsPerPage !== undefined
                ? rowsPerPage
                : Shapes.pagination.rowsPerPage

        // Build request body
        const body = {
            id: JSON.stringify(fileIds.length === 1 ? fileIds[0] : fileIds),
            time: Math.floor(Date.now()),
            filters: filters,
            sortBy: sortBy,
            sortOrder: sortOrder,
            limit: rowsPerPage,
            offset: page * rowsPerPage,
            metadataOnly: false,
        }

        // Call backend API
        DrawTool.getFile(body, function (data) {
            if (data && data.geojson) {
                Shapes.currentResults = data.geojson
                Shapes.pagination.totalCount =
                    data.totalCount || data.geojson.features.length

                // Populate list from results
                Shapes.populateShapesFromResults(data.geojson.features, fileIds)

                // Update pagination UI
                Shapes.updatePaginationUI()

                // Update mode message
                Shapes.updateModeMessage()

                // Sync button states
                Shapes.syncSortButtonStates()
            } else {
                console.error(
                    '[DrawTool Shapes] No data or geojson in response:',
                    data
                )
                if (data && data.error) {
                    console.error(
                        '[DrawTool Shapes] Error from backend:',
                        data.error
                    )
                }
            }
        })
    },
    populateShapesFromResults: function (features, fileIds) {
        // Clear the fetching flag since we're now processing results
        Shapes._isFetchingAllFeatures = false

        // If there's no stored selection, preserve whatever is currently active
        // This ensures selection persists through any rebuild, not just from populateShapes
        if (!Shapes._selectionToRestore) {
            const activeFeature = $('.drawToolShapeLi.active').first()
            if (activeFeature.length > 0) {
                Shapes._selectionToRestore = {
                    featureId: activeFeature.attr('feature_id'),
                    fileId: activeFeature.attr('file_id'),
                }
            }
        }

        // Clear current list
        $('#drawToolShapesFeaturesList *').remove()

        // Find file objects
        const files = {}
        fileIds.forEach((fileId) => {
            files[fileId] = DrawTool.getFileObjectWithId(fileId)
        })

        // Add features to list (without file headers when in 'all' mode)
        features.forEach((feature, idx) => {
            const fileId = feature.properties._.file_id
            const file = files[fileId]
            if (!file) return

            const properties = feature.properties

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
                    file.id + "' feature_id='" + properties._.id + "'>",
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

            const shapeLi = $('<li>')
                .attr('id', 'drawToolShapeLiItem_all_' + idx)
                .attr('class', 'drawToolShapeLi')
                .attr('file_id', file.id)
                .attr('feature_id', properties._.id)
                .attr('shape_id', properties._.id) // Add for refreshFile auto-select compatibility
                .attr('file_owner', file.file_owner)
                .attr('file_name', file.file_name)
                .attr('intent', properties._.intent)
                .attr('shape_id', properties._.id)
                .html(markup)

            // If this is the item we're about to restore, add active class immediately
            // This prevents flickering by ensuring the item is never shown in an inactive state
            if (
                Shapes._selectionToRestore &&
                Shapes._selectionToRestore.featureId == properties._.id &&
                Shapes._selectionToRestore.fileId == file.id
            ) {
                shapeLi.addClass('active')
            }

            // Always append in filtered results handler
            $('#drawToolShapesFeaturesList').append(shapeLi)

            $('#drawToolShapeLiItem_all_' + idx)
                .find('.drawToolShapeLiItemB')
                .attr('title', properties.name || 'No Name')
                .text(properties.name || 'No Name')
        })

        // Attach click handlers
        $('.drawToolShapeLiItem').on('click', function (e) {
            const $item = $(this)
            const featureId = $item.attr('feature_id')
            const fileId = $item.attr('file_id')
            const $li = $item.parent() // The .drawToolShapeLi parent
            const intent = $li.attr('intent')

            // Get ctrl key state
            const ctrl = e.ctrlKey || e.metaKey

            // Clear all active if ctrl not held
            if (!ctrl) {
                $('.drawToolShapeLi').removeClass('active')
                $('.drawToolShapeLi')
                    .find('.drawToolShapeLiItemCheck')
                    .removeClass('checked')
            }

            // Add active class to clicked item
            $li.addClass('active')
            $li.find('.drawToolShapeLiItemCheck').addClass('checked')

            // Update last shape tracking
            DrawTool.lastShapeIntent = intent

            // Call the feature click handler to pan/select on map
            Shapes.handleFeatureClick(featureId, fileId)
        })

        // Restore selection if one was stored (from filter restoration flow)
        if (Shapes._selectionToRestore) {
            const { featureId, fileId } = Shapes._selectionToRestore
            Shapes._selectionToRestore = null // Clear it

            const itemToSelect = $(
                `.drawToolShapeLi[file_id="${fileId}"][feature_id="${featureId}"]`
            )
            if (itemToSelect.length > 0) {
                // Ensure active class is present (should already be from creation, but just in case)
                if (!itemToSelect.hasClass('active')) {
                    itemToSelect.addClass('active')
                }
                // Add checked class to checkbox (couldn't do this during creation)
                itemToSelect
                    .find('.drawToolShapeLiItemCheck')
                    .addClass('checked')
                // Select on map
                Shapes.selectFeatureOnMap(fileId, featureId)
            }
        }

        // Apply pending selection if any (from onscreen mode click flow)
        if (Shapes.pendingSelection) {
            const { fileId, featureId } = Shapes.pendingSelection
            Shapes.pendingSelection = null // Clear it

            // Select directly - no timing needed since DOM is already built
            const itemToSelect = $(
                `.drawToolShapeLi[file_id="${fileId}"][feature_id="${featureId}"]`
            )
            if (itemToSelect.length > 0) {
                itemToSelect.addClass('active')
                itemToSelect
                    .find('.drawToolShapeLiItemCheck')
                    .addClass('checked')
                // Select on map
                Shapes.selectFeatureOnMap(fileId, featureId)
            }
        }
    },
    handleFeatureClick: function (featureId, fileId) {
        // Check if feature is loaded on map
        let foundOnMap = false
        for (var l in L_.layers.layer) {
            var s = l.split('_')
            if (s[0] == 'DrawTool' && s[1] == fileId) {
                const layers = L_.layers.layer[l]
                for (let i = 0; i < layers.length; i++) {
                    const layer = layers[i]

                    // Skip null/undefined layers (sparse array handling)
                    if (!layer) continue

                    let feature = layer.feature
                    if (!feature && layer._layers) {
                        feature =
                            layer._layers[Object.keys(layer._layers)[0]].feature
                    }
                    if (feature && feature.properties._.id == featureId) {
                        foundOnMap = true
                        // Pan to feature
                        if (typeof layer.getBounds === 'function')
                            Map_.map.panTo(layer.getBounds().getCenter())
                        else if (layer.hasOwnProperty('_latlng'))
                            Map_.map.panTo(layer._latlng)

                        // Fire click event to select feature
                        if (layer.hasOwnProperty('_layers'))
                            layer._layers[
                                Object.keys(layer._layers)[0]
                            ].fireEvent('click')
                        else layer.fireEvent('click')

                        return
                    }
                }
            }
        }

        // Feature not on map - need to load it
        if (!foundOnMap) {
            // Fetch feature geometry
            const body = {
                id: JSON.stringify(parseInt(fileId)), // Convert string to number
                time: Math.floor(Date.now()),
                featureId: featureId,
                metadataOnly: false,
            }

            DrawTool.getFile(body, function (data) {
                if (data && data.geojson && data.geojson.features.length > 0) {
                    const feature = data.geojson.features[0]
                    // Calculate bounds
                    const bounds = L.geoJSON(feature).getBounds()

                    // Pan and zoom to feature
                    Map_.map.fitBounds(bounds)

                    // In 'all' mode (filtered), don't repopulate list to preserve filtered view
                    // In 'onscreen' mode, repopulate list as usual
                    const shouldPopulateShapes = Shapes.mode !== 'all'

                    setTimeout(() => {
                        if (shouldPopulateShapes) {
                            // Onscreen mode - use existing pending selection logic
                            Shapes.pendingSelection = {
                                fileId: parseInt(fileId),
                                featureId: featureId,
                            }
                            DrawTool.refreshFile(parseInt(fileId), null, true)
                        } else {
                            // All mode - wait for DynamicExtent to load the feature, then select it
                            // DynamicExtent has 300ms debounce, so wait a bit longer
                            setTimeout(() => {
                                Shapes.selectFeatureOnMap(
                                    parseInt(fileId),
                                    featureId
                                )
                            }, 400) // 300ms debounce + 100ms buffer
                        }
                    }, 500)
                } else {
                    console.warn(
                        '[DrawTool Shapes] No feature data returned from server'
                    )
                }
            })
        }
    },

    /**
     * Selects a feature on the map by finding its layer and firing a click event
     * Used when feature is loaded dynamically and we want to select it without rebuilding the list
     */
    selectFeatureOnMap: function (fileId, featureId) {
        // Find the feature layer and fire click event to select it
        for (var l in L_.layers.layer) {
            var s = l.split('_')
            if (s[0] == 'DrawTool' && s[1] == fileId) {
                const layers = L_.layers.layer[l]

                for (let i = 0; i < layers.length; i++) {
                    const layer = layers[i]
                    if (!layer) continue

                    let feature = layer.feature
                    if (!feature && layer._layers) {
                        feature =
                            layer._layers[Object.keys(layer._layers)[0]].feature
                    }

                    if (feature && feature.properties._.id == featureId) {
                        // Fire click event to select feature
                        if (layer.hasOwnProperty('_layers'))
                            layer._layers[
                                Object.keys(layer._layers)[0]
                            ].fireEvent('click')
                        else layer.fireEvent('click')
                        return
                    }
                }
            }
        }
    },
    updatePaginationUI: function () {
        // Only show pagination when in 'all' mode (filtering)
        if (Shapes.mode !== 'all') {
            $('#drawToolShapesPagination').hide()
            return
        }

        const totalCount = Shapes.pagination.totalCount
        const rowsPerPage = Shapes.pagination.rowsPerPage
        const page = Shapes.pagination.page

        // Show pagination if there are results
        if (totalCount > rowsPerPage) {
            $('#drawToolShapesPagination').show()
        } else {
            $('#drawToolShapesPagination').hide()
            return
        }

        // Update info text
        const start = page * rowsPerPage + 1
        const end = Math.min((page + 1) * rowsPerPage, totalCount)
        $('#drawToolPaginationInfo').text(`${start}-${end} of ${totalCount}`)

        // Update page input and total pages
        const totalPages = Math.ceil(totalCount / rowsPerPage)
        $('#drawToolPaginationPage').val(page + 1)

        // Update button states
        $('#drawToolPaginationPrev').prop('disabled', page === 0)
        $('#drawToolPaginationNext').prop('disabled', page >= totalPages - 1)
    },

    updateModeMessage: function () {
        const messageEl = $('#drawToolShapesModeMessage')

        if (Shapes.mode === 'onscreen') {
            // Check if any active file hit the 1k limit
            let anyTruncated = false
            if (DrawTool.dynamicExtent && DrawTool.dynamicExtent.truncated) {
                // DrawTool.filesOn is an array of file IDs
                for (let i = 0; i < DrawTool.filesOn.length; i++) {
                    const fileId = DrawTool.filesOn[i]
                    if (fileId && DrawTool.dynamicExtent.truncated[fileId]) {
                        anyTruncated = true
                        break
                    }
                }
            }

            let message =
                'Only listing on screen features. Submit a filter to see all filtered results.'
            if (anyTruncated) {
                message += ' Only showing top 1k features.'
            }

            messageEl.text(message)
            messageEl.css('display', 'block')

            // Set background to orange if truncated, otherwise use default
            if (anyTruncated) {
                messageEl.css('background', '#ff9800')
                messageEl.css('color', 'white')
            } else {
                messageEl.css('background', 'var(--color-a1)')
                messageEl.css('color', 'var(--color-a5)')
            }
        } else {
            // In 'all' mode: hide message (pagination info will show instead)
            messageEl.text('')
            messageEl.css('display', 'none')
        }
    },
    initPagination: function (fileIds) {
        // Previous button
        $('#drawToolPaginationPrev').off('click')
        $('#drawToolPaginationPrev').on('click', function () {
            if (Shapes.pagination.page > 0) {
                Shapes.pagination.page--
                Shapes.fetchAllFeatures(fileIds)
            }
        })

        // Next button
        $('#drawToolPaginationNext').off('click')
        $('#drawToolPaginationNext').on('click', function () {
            const totalPages = Math.ceil(
                Shapes.pagination.totalCount / Shapes.pagination.rowsPerPage
            )
            if (Shapes.pagination.page < totalPages - 1) {
                Shapes.pagination.page++
                Shapes.fetchAllFeatures(fileIds)
            }
        })

        // Page number input
        $('#drawToolPaginationPage').off('change')
        $('#drawToolPaginationPage').on('change', function () {
            let newPage = parseInt($(this).val()) - 1
            const totalPages = Math.ceil(
                Shapes.pagination.totalCount / Shapes.pagination.rowsPerPage
            )
            if (newPage >= 0 && newPage < totalPages) {
                Shapes.pagination.page = newPage
                Shapes.fetchAllFeatures(fileIds)
            } else {
                // Reset to current page
                $(this).val(Shapes.pagination.page + 1)
            }
        })
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
            `<li class='drawToolShapes_filtering_value' id='drawToolShapes_filtering_value_${id}'>`,
                `<div class='drawFilterDragHandle'><i class="mdi mdi-drag-vertical mdi-12px"></i></div>`,
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
            "</li>",
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

        Shapes.makeFilterListSortable()

        // Show footer iff value rows exist
        $('#drawToolShapes_filtering_footer').css(
            'display',
            Shapes.filters.values.length === 0 ? 'none' : 'flex'
        )
    },
    addGroup: function (group) {
        let id, op
        if (group) {
            id = group.id
            op = group.op
        } else {
            id = Shapes.filters.values.length
            op = 'OR' // Default to OR since AND is already the higher level op
        }

        // prettier-ignore
        const groupMarkup = [
            `<li class='drawToolShapes_filtering_group' id='drawToolShapes_filtering_group_${id}'>`,
                `<div>`,
                    `<div class='drawFilterDragHandle'><i class="mdi mdi-drag-vertical mdi-12px"></i></div>`,
                    "<div class='drawToolShapes_filtering_group_key'>Group</div>",
                    "<div class='drawToolShapes_filtering_group_operator'>",
                        `<div id='drawToolShapes_filtering_group_operator_${id}' class='drawToolShapes_filtering_group_operator_select op_${(op || 'AND').toLowerCase()}'></div>`,
                    '</div>',
                `</div>`,
                `<div id='drawToolShapes_filtering_group_clear_${id}' class='mmgisButton5 drawToolShapes_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>`,
            '</li>',
        ].join('\n')

        $('#drawToolShapes_filtering_filters_list').append(groupMarkup)

        if (group == null) {
            Shapes.filters.values.push({
                isGroup: true,
                id: id,
                op: op,
            })
        }

        Shapes.attachGroupEvents(id, { op: op })

        Shapes.makeFilterListSortable()

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
        // Add Group
        $('#drawToolShapes_filtering_add_group').off('click')
        $('#drawToolShapes_filtering_add_group').on('click', function () {
            Shapes.addGroup()
        })

        // Add Value
        $('#drawToolShapes_filtering_add_value').off('click')
        $('#drawToolShapes_filtering_add_value').on('click', function () {
            Shapes.addValue()
        })

        // Submit
        $(`#drawToolShapes_filtering_submit`).off('click')
        $(`#drawToolShapes_filtering_submit`).on('click', async () => {
            // Update valuesOrder based on current DOM order
            const valuesOrder = []
            $('#drawToolShapes_filtering_filters_list > li').each(function () {
                const idMatch = $(this)
                    .attr('id')
                    .match(/_(\d+)$/)
                if (idMatch) {
                    valuesOrder.push(parseInt(idMatch[1]))
                }
            })
            Shapes.filters.valuesOrder = valuesOrder

            Shapes.setSubmitButtonState(true)
            $(`#drawToolShapes_filtering_submit_loading`).addClass('active')
            $(`.drawToolContextMenuHeaderClose`).click()

            // Check if there are any filters
            const encodedFilters = Shapes.encodeFilters(
                Shapes.filters.values,
                Shapes.filters.valuesOrder
            )

            // Store advanced filter separately
            Shapes.currentAdvancedFilter = encodedFilters

            // Combine with text filter if one exists
            let combinedFilter = null
            if (Shapes.currentTextFilter && encodedFilters) {
                const textFilter = `name+contains+string+${Shapes.currentTextFilter}`
                combinedFilter = `${textFilter},and,${encodedFilters}`
            } else if (Shapes.currentTextFilter) {
                const textFilter = `name+contains+string+${Shapes.currentTextFilter}`
                combinedFilter = textFilter
            } else if (encodedFilters) {
                combinedFilter = encodedFilters
            }

            if (!combinedFilter) {
                // NO FILTER: Show onscreen features
                Shapes.mode = 'onscreen'

                fileIds.forEach((fileId) => {
                    const filter = {
                        values: [],
                        valuesOrder: [],
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
                Shapes.applySort()
            } else {
                // HAS FILTER: Query server
                Shapes.mode = 'all'
                Shapes.fetchAllFeatures(fileIds, combinedFilter)
            }

            $(`#drawToolShapes_filtering_submit_loading`).removeClass('active')
            Shapes.setSubmitButtonState(false)
        })

        // Clear
        $(`#drawToolShapes_filtering_clear`).off('click')
        $(`#drawToolShapes_filtering_clear`).on('click', async () => {
            $(`#drawToolShapes_filtering_submit_loading`).addClass('active')
            Shapes.setSubmitButtonState(true)

            // Clear value and group filter elements
            Shapes.filters.values = Shapes.filters.values.filter((v) => {
                if (v) {
                    if (v.isGroup === true)
                        $(`#drawToolShapes_filtering_group_${v.id}`).remove()
                    else $(`#drawToolShapes_filtering_value_${v.id}`).remove()
                }
                return false
            })
            Shapes.filters.valuesOrder = []

            $(`.drawToolContextMenuHeaderClose`).click()

            // Clear advanced filter
            Shapes.currentAdvancedFilter = null

            // Check if text filter exists
            if (Shapes.currentTextFilter) {
                // Keep in 'all' mode with just text filter
                Shapes.mode = 'all'
                const textFilter = `name+contains+string+${Shapes.currentTextFilter}`
                Shapes.fetchAllFeatures(fileIds, textFilter)
            } else {
                // No filters at all, return to onscreen mode
                Shapes.mode = 'onscreen'

                fileIds.forEach((fileId) => {
                    const filter = {
                        values: [],
                        valuesOrder: [],
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
                // Re-apply sort after clearing filter
                Shapes.applySort()
            }

            // Update mode message
            Shapes.updateModeMessage()

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
            const inputValue = $(this).val()
            const property = Shapes.filters.aggs[inputValue]
            if (property) {
                if (
                    Shapes.filters.values[id] &&
                    Shapes.filters.values[id].key !== inputValue
                ) {
                    Shapes.filters.values[id].key = inputValue
                    Shapes.filters.values[id].type = property.type
                    Shapes.updateValuesAutoComplete(id)
                    Shapes.setSubmitButtonState(true)
                }
                $(this).css('border', 'none')
            } else $(this).css('border', '1px solid red')
        })

        // Operator Dropdown
        elmId = `#drawToolShapes_filtering_value_operator_${id}`

        const ops = [
            '=',
            '!=',
            ',',
            '<',
            '>',
            '<=',
            '>=',
            'contains',
            'beginswith',
            'endswith',
            'isnull',
            'isnotnull',
        ]
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<i class='mdi mdi-equal mdi-18px' title='Equals'></i>`,
                    `<div title='Not Equals' style='font-family: monospace;'>!=</div>`,
                    `<div title='Comma-separated list' style='font-family: monospace;'>in</div>`,
                    `<i class='mdi mdi-less-than mdi-18px' title='Less than'></i>`,
                    `<i class='mdi mdi-greater-than mdi-18px' title='Greater than'></i>`,
                    `<i class='mdi mdi-less-than-or-equal mdi-18px' title='Less than or Equal'></i>`,
                    `<i class='mdi mdi-greater-than-or-equal mdi-18px' title='Greater than or Equal'></i>`,
                    `<i class='mdi mdi-contain mdi-18px' title='Contains'></i>`,
                    `<i class='mdi mdi-contain-start mdi-18px' title='Begins With'></i>`,
                    `<i class='mdi mdi-contain-end mdi-18px' title='Ends With'></i>`,
                    `<i class='mdi mdi-null mdi-18px' title='Is Null (No Value)'></i>`,
                    `<i class='mdi mdi-check-circle-outline mdi-18px' title='Is Not Null (Has Value)'></i>`,
                ],
                'op',
                opId,
                { fixedItemWidth: 30, hideChevron: true }
            )
        )
        Dropy.init($(elmId), function (idx) {
            Shapes.filters.values[id].op = ops[idx]
            // Hide/show value input based on operator
            Shapes.toggleValueInput(id, ops[idx])
            Shapes.setSubmitButtonState(true)
        })

        // Value AutoComplete
        Shapes.updateValuesAutoComplete(id)

        // Initialize value input visibility based on operator
        Shapes.toggleValueInput(id, ops[opId])
    },
    refreshValueAutocomplete: function (id) {
        // Refresh the property (key) autocomplete with updated aggregations
        const elmId = `#drawToolShapes_filtering_value_key_input_${id}`
        const arrayToSearch = Object.keys(Shapes.filters.aggs).sort((a, b) =>
            b.localeCompare(a)
        )

        // Destroy existing autocomplete and reinitialize
        $(elmId).autocomplete('dispose')
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

        // Also update the value autocomplete in case a key is already selected
        if (Shapes.filters.values[id] && Shapes.filters.values[id].key) {
            Shapes.updateValuesAutoComplete(id)
        }
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
    toggleValueInput: function (id, operator) {
        // Hide value input for null operators (they don't need a value)
        const valueInputId = `#drawToolShapes_filtering_value_value_input_${id}`
        const valueContainerId = `#drawToolShapes_filtering_value_value_${id}`

        if (operator === 'isnull' || operator === 'isnotnull') {
            // Hide value input for null checks
            $(valueInputId).prop('disabled', true).css('opacity', '0.3')
            $(valueInputId).val('') // Clear any existing value
            Shapes.filters.values[id].value = '' // Clear stored value
        } else {
            // Show value input for other operators
            $(valueInputId).prop('disabled', false).css('opacity', '1')
        }
    },
    attachGroupEvents: function (id, options) {
        options = options || {}

        let elmId

        // Clear
        elmId = `#drawToolShapes_filtering_group_clear_${id}`

        $(elmId).on('click', () => {
            // Clear group filter element
            for (let i = 0; i < Shapes.filters.values.length; i++) {
                if (Shapes.filters.values[i]?.isGroup) {
                    const vId = Shapes.filters.values[i]?.id
                    if (vId != null && vId === id) {
                        $(`#drawToolShapes_filtering_group_${vId}`).remove()
                        Shapes.filters.values[i] = null
                    }
                }
            }
            Shapes.setSubmitButtonState(true)
        })

        // Operator Dropdown
        elmId = `#drawToolShapes_filtering_group_operator_${id}`

        const ops = ['AND', 'OR', 'NOT_AND', 'NOT_OR']
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<div style='font-family: monospace;'>All Must Match (AND)</div>`,
                    `<div style='font-family: monospace;'>Any May Match (OR)</div>`,
                    `<div style='font-family: monospace;'>Not All May Match (NOT AND)</div>`,
                    `<div style='font-family: monospace;'>None Must Match (NOT OR)</div>`,
                ],
                'op',
                opId,
                { hideChevron: true }
            )
        )
        Dropy.init($(elmId), function (idx) {
            const newOp = ops[idx]
            Shapes.filters.values[id].op = newOp
            switch (newOp) {
                case 'AND':
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_and')
                    break
                case 'OR':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_or')
                    break
                case 'NOT_AND':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_not_and')
                    break
                case 'NOT_OR':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).addClass('op_not_or')
                    break
                default:
                    break
            }
            Shapes.setSubmitButtonState(true)
        })
    },
    makeFilterListSortable: function () {
        const listToSort = document.getElementById(
            'drawToolShapes_filtering_filters_list'
        )
        // Destroy existing sortable instance if it exists
        if (listToSort && listToSort.sortable) {
            listToSort.sortable.destroy()
        }
        if (listToSort) {
            listToSort.sortable = Sortable.create(listToSort, {
                animation: 150,
                easing: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
                handle: '.drawFilterDragHandle',
                onStart: () => {},
                onChange: () => {},
                onEnd: () => {
                    // Update valuesOrder based on new DOM order
                    const valuesOrder = []
                    $('#drawToolShapes_filtering_filters_list > li').each(
                        function () {
                            const idMatch = $(this)
                                .attr('id')
                                .match(/_(\d+)$/)
                            if (idMatch) {
                                valuesOrder.push(parseInt(idMatch[1]))
                            }
                        }
                    )
                    Shapes.filters.valuesOrder = valuesOrder
                    Shapes.setSubmitButtonState(true)
                },
            })
        }
    },
    initializeSort: function () {
        // Build property list from aggregations
        let properties = ['Unsorted']
        if (Shapes.filters.aggs) {
            const sortedProperties = Object.keys(Shapes.filters.aggs).sort()
            properties = properties.concat(sortedProperties)
        }

        // Populate property dropdown
        const currentProperty = Shapes.sort.property || 'Unsorted'
        const currentIndex = Math.max(properties.indexOf(currentProperty), 0)

        $('#drawToolShapesSortProperty').html(
            Dropy.construct(properties, 'sort', currentIndex, {
                openDown: true,
            })
        )

        // Initialize Dropy
        Dropy.init($('#drawToolShapesSortProperty'), function (idx) {
            const selectedProperty = properties[idx]
            const wasNull = Shapes.sort.property == null
            Shapes.sort.property =
                selectedProperty === 'Unsorted' ? null : selectedProperty

            // If switching back to Unsorted, repopulate to restore grouped order
            if (Shapes.sort.property == null && !wasNull) {
                // Remove active state from direction buttons
                $('.drawToolShapesSortButton').removeClass('active')
                // Clear backend sort state too
                Shapes.sortBy = null
                Shapes.sortOrder = 'asc'
                DrawTool.populateShapes()
            } else {
                Shapes.handleSortChange()
            }
        })

        // Attach direction button handlers
        $('#drawToolShapesSortAsc').off('click')
        $('#drawToolShapesSortAsc').on('click', function () {
            if (Shapes.sort.property == null) return

            Shapes.sort.direction = 'asc'
            $('.drawToolShapesSortButton').removeClass('active')
            $(this).addClass('active')
            Shapes.handleSortChange()
        })

        $('#drawToolShapesSortDesc').off('click')
        $('#drawToolShapesSortDesc').on('click', function () {
            if (Shapes.sort.property == null) return

            Shapes.sort.direction = 'desc'
            $('.drawToolShapesSortButton').removeClass('active')
            $(this).addClass('active')
            Shapes.handleSortChange()
        })

        // Update button states
        if (Shapes.sort.property == null) {
            $('.drawToolShapesSortButton')
                .removeClass('active')
                .addClass('disabled')
        } else {
            $('.drawToolShapesSortButton').removeClass('disabled')
            // Restore active state based on current sort direction
            if (Shapes.sort.direction === 'asc') {
                $('#drawToolShapesSortAsc').addClass('active')
                $('#drawToolShapesSortDesc').removeClass('active')
            } else if (Shapes.sort.direction === 'desc') {
                $('#drawToolShapesSortDesc').addClass('active')
                $('#drawToolShapesSortAsc').removeClass('active')
            }
        }
    },
    /**
     * Handle sort changes - dispatches to appropriate sorting mechanism
     * based on current mode
     */
    handleSortChange: function () {
        if (Shapes.mode === 'all') {
            // In 'all' mode (filtered), use backend sorting
            // Sync backend state with frontend state
            Shapes.sortBy = Shapes.sort.property
            Shapes.sortOrder = Shapes.sort.direction

            // Re-fetch with new sort parameters
            if (Shapes.currentFileIds) {
                Shapes.fetchAllFeatures(Shapes.currentFileIds)
            } else {
                console.warn(
                    '[DrawTool Shapes Sort] Cannot sort: currentFileIds is null'
                )
            }
        } else {
            // In 'onscreen' mode, use client-side sorting
            Shapes.applySort()
        }
    },
    applySort: function () {
        // Don't apply client-side sort in 'all' mode (backend handles it)
        if (Shapes.mode === 'all') {
            return
        }

        // If no property selected, show original order with headers
        if (Shapes.sort.property == null) {
            $('.drawToolShapesFeaturesListFileHeader').show()
            $('.drawToolShapesSortButton')
                .removeClass('active')
                .addClass('disabled')
            return
        }

        // Enable direction buttons
        $('.drawToolShapesSortButton').removeClass('disabled')

        // Hide file headers when sorting
        $('.drawToolShapesFeaturesListFileHeader').hide()

        // Get all shape list items
        const items = $('.drawToolShapeLi').detach().toArray()

        // Helper function to get property value from a list item
        const getPropertyValue = (item) => {
            const layer = $(item).attr('layer')
            const index = $(item).attr('index')
            const shape = L_.layers.layer[layer][index]

            if (!shape) return null

            let feature
            if (
                !shape.hasOwnProperty('feature') &&
                shape.hasOwnProperty('_layers')
            )
                feature = shape._layers[Object.keys(shape._layers)[0]].feature
            else feature = shape.feature

            if (!feature) return null

            // Get the property value
            let value
            if (Shapes.sort.property === 'geometry.type') {
                value = feature.geometry?.type
            } else {
                value = F_.getIn(feature.properties, Shapes.sort.property)
            }

            return value
        }

        // Sort items
        items.sort((a, b) => {
            const aVal = getPropertyValue(a)
            const bVal = getPropertyValue(b)

            // Handle null/undefined values (push to end)
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1

            // Check if values are date/time strings (ISO 8601 format)
            const isDateString = (val) => {
                if (typeof val !== 'string') return false
                // Match ISO 8601 patterns: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
                return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(val)
            }

            let comparison = 0

            // Try date comparison first
            if (isDateString(aVal) && isDateString(bVal)) {
                const aDate = new Date(aVal).getTime()
                const bDate = new Date(bVal).getTime()
                // If both parse to valid dates, use date comparison
                if (!isNaN(aDate) && !isNaN(bDate)) {
                    comparison = aDate - bDate
                } else {
                    // Fall back to string comparison if date parsing fails
                    comparison = String(aVal)
                        .toLowerCase()
                        .localeCompare(String(bVal).toLowerCase())
                }
            } else {
                // Determine if numeric
                const aNum = parseFloat(aVal)
                const bNum = parseFloat(bVal)
                const isNumeric = !isNaN(aNum) && !isNaN(bNum)

                if (isNumeric) {
                    comparison = aNum - bNum
                } else {
                    // String comparison
                    const aStr = String(aVal).toLowerCase()
                    const bStr = String(bVal).toLowerCase()
                    comparison = aStr.localeCompare(bStr)
                }
            }

            // Apply direction
            return Shapes.sort.direction === 'asc' ? comparison : -comparison
        })

        // Re-append sorted items
        const list = $('#drawToolShapesFeaturesList')
        items.forEach((item) => {
            list.append(item)
        })
    },

    syncSortButtonStates: function () {
        // Update button states based on current sort configuration
        if (Shapes.sort.property == null) {
            $('.drawToolShapesSortButton')
                .removeClass('active')
                .addClass('disabled')
        } else {
            $('.drawToolShapesSortButton').removeClass('disabled')
            // Restore active state based on current sort direction
            if (Shapes.sort.direction === 'asc') {
                $('#drawToolShapesSortAsc').addClass('active')
                $('#drawToolShapesSortDesc').removeClass('active')
            } else if (Shapes.sort.direction === 'desc') {
                $('#drawToolShapesSortDesc').addClass('active')
                $('#drawToolShapesSortAsc').removeClass('active')
            }
        }
    },
    fetchAggregations: function (fileIds, callback) {
        const body = {
            id: JSON.stringify(fileIds.length === 1 ? fileIds[0] : fileIds),
            time: Math.floor(Date.now()),
            limit: 500,
        }

        calls.api(
            'draw_aggregations',
            body,
            function (data) {
                if (data.status === 'success') {
                    callback(data.aggregations)
                } else {
                    callback({})
                }
            },
            function (error) {
                callback({})
            }
        )
    },
}

export default Shapes
