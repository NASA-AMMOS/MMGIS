import $ from 'jquery'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Map_ from '../../Basics/Map_/Map_'
import turf from 'turf'

import calls from '../../../pre/calls'

var DrawTool = null
var Editing = {
    init: function (tool) {
        DrawTool = tool
        DrawTool.showContextMenu = Editing.showContextMenu
        DrawTool.getSnapGuides = Editing.getSnapGuides
        DrawTool.cmLayerDragOn = Editing.cmLayerDragOn
        DrawTool.cmLayerDragOff = Editing.cmLayerDragOff
        DrawTool.cmLayerDown = Editing.cmLayerDown
        DrawTool.cmLayerUp = Editing.cmLayerUp
        DrawTool.cmLayerMove = Editing.cmLayerMove
    },
    showContextMenu: function (
        x,
        y,
        layer,
        index,
        fileid,
        ctrl,
        displayOnly,
        isKind,
        kindLayerName
    ) {
        if (!DrawTool.open && !displayOnly) return

        DrawTool.lastContextLayerIndexFileId = {
            layer: layer,
            index: index,
            fileid: fileid,
        }
        //Don't treat the point drags and context menu clicks
        if (
            DrawTool.contextMenuLayer &&
            DrawTool.contextMenuLayer.justDragged
        ) {
            DrawTool.contextMenuLayer.justDragged = false
            return
        }

        //ctrl does lots. Here, if ctrl is pressed, check whether the layer is already selected.
        // If it is, remove it
        var deselecting = false
        if (ctrl) {
            for (var c in DrawTool.contextMenuLayers) {
                var cml = DrawTool.contextMenuLayers[c]
                if (
                    cml.l_i_f.layer == layer &&
                    cml.l_i_f.index == index &&
                    cml.l_i_f.fileid == fileid
                ) {
                    //already selected
                    $(
                        '#drawToolShapeLiItem_' + layer + '_' + index
                    ).removeClass('active')
                    $('#drawToolShapeLiItem_' + layer + '_' + index)
                        .find('.drawToolShapeLiItemCheck')
                        .removeClass('checked')
                    resetShape(c)
                    Map_.rmNotNull(cml.selectionLayer)
                    DrawTool.contextMenuLayers.splice(c, 1)
                    deselecting = true
                }
            }
        } else if (DrawTool.contextMenuLayer) {
            resetShape()
        }

        //store the last saved point position
        var currentPointLatLng = null
        //ctrl is for group selections. If no ctrl, reset group
        // or if a user uses ctrl to select the first shape
        var grouping = true

        if (!ctrl || !DrawTool.contextMenuLayer) {
            grouping = false
            //Turn off all selectLayers
            for (var c in DrawTool.contextMenuLayers)
                Map_.rmNotNull(DrawTool.contextMenuLayers[c].selectionLayer)
            DrawTool.contextMenuLayers = []
            DrawTool.contextMenuChanges.use = false
            DrawTool.contextMenuChanges.props.name = true
            DrawTool.contextMenuChanges.props.description = true
            DrawTool.contextMenuChanges.style.color = true
            DrawTool.contextMenuChanges.style.opacity = true
            DrawTool.contextMenuChanges.style.dashArray = true
            DrawTool.contextMenuChanges.style.weight = true
            DrawTool.contextMenuChanges.style.fillColor = true
            DrawTool.contextMenuChanges.style.fillOpacity = true
            DrawTool.contextMenuChanges.style.symbol = true
            DrawTool.contextMenuChanges.style.radius = true
            DrawTool.contextMenuChanges.style.width = true
            DrawTool.contextMenuChanges.style.length = true
            DrawTool.contextMenuChanges.style.lineCap = true
            DrawTool.contextMenuChanges.style.lineJoin = true
            DrawTool.contextMenuChanges.style.fontSize = true
        } else {
            grouping = true
            DrawTool.contextMenuChanges.use = true
            //Because we only want the changed properties applied to the group and not them all
            // ie. don't set all the fillColors to one color if it wasn't changed.
            DrawTool.contextMenuChanges.props.name = false
            DrawTool.contextMenuChanges.props.description = false
            DrawTool.contextMenuChanges.style.color = false
            DrawTool.contextMenuChanges.style.opacity = false
            DrawTool.contextMenuChanges.style.dashArray = false
            DrawTool.contextMenuChanges.style.weight = false
            DrawTool.contextMenuChanges.style.fillColor = false
            DrawTool.contextMenuChanges.style.fillOpacity = false
            DrawTool.contextMenuChanges.style.symbol = false
            DrawTool.contextMenuChanges.style.radius = false
            DrawTool.contextMenuChanges.style.width = false
            DrawTool.contextMenuChanges.style.length = false
            DrawTool.contextMenuChanges.style.lineCap = false
            DrawTool.contextMenuChanges.style.lineJoin = false
            DrawTool.contextMenuChanges.style.fontSize = false
        }

        var shape = layer
        if (index != null) shape = L_.layersGroup[shape][index]
        //Disable editing the previous drawing layer if it was being
        if (!displayOnly) {
            if (DrawTool.contextMenuLayer) {
                DrawTool.contextMenuLayer.resetGeoJSON()

                if (
                    typeof DrawTool.contextMenuLayer.disableEdit === 'function'
                ) {
                    DrawTool.contextMenuLayer.disableEdit()

                    if (DrawTool.contextMenuLayer.snapediting) {
                        DrawTool.contextMenuLayer.snapediting.disable()
                    }
                } else DrawTool.cmLayerDragOff()

                DrawTool.isEditing = false
            }
        }

        if (
            shape.hasOwnProperty('_layers') &&
            !(
                shape.hasOwnProperty('feature') &&
                shape.feature.properties.arrow == true
            )
        )
            DrawTool.contextMenuLayer =
                shape._layers[Object.keys(shape._layers)[0]]
        else {
            DrawTool.contextMenuLayer = shape
            currentPointLatLng = Object.assign(
                {},
                DrawTool.contextMenuLayer._latlng
            )
        }

        var featureType

        var hasStrokeColor = false
        var hasStrokeOpacity = false
        var hasStrokeStyle = false
        var hasStrokeWeight = false
        var hasFillColor = false
        var hasFillOpacity = false
        var hasSymbol = false
        var hasRadius = false
        var hasWidth = false
        var hasLength = false
        var hasLineCap = false
        var hasLineJoin = false
        var hasFontSize = false

        if (DrawTool.contextMenuLayer.feature.properties.arrow === true) {
            //Arrow
            featureType = 'arrow'

            hasStrokeColor = true
            hasStrokeOpacity = true
            hasStrokeStyle = true
            hasStrokeWeight = true
            hasFillColor = true
            hasFillOpacity = true
            hasRadius = true
            hasWidth = true
            hasLength = true
            hasLineCap = true
            hasLineJoin = true
        } else if (
            DrawTool.contextMenuLayer.feature.properties.annotation === true
        ) {
            //Annotation
            featureType = 'note'

            hasStrokeColor = true
            hasStrokeOpacity = true
            hasStrokeWeight = true
            hasFillColor = true
            hasFontSize = true
        } else if (
            DrawTool.contextMenuLayer.feature.geometry.type.toLowerCase() ===
            'point'
        ) {
            //Point
            featureType = 'point'

            hasStrokeColor = true
            hasStrokeOpacity = true
            hasStrokeStyle = true
            hasStrokeWeight = true
            hasFillColor = true
            hasFillOpacity = true
            hasSymbol = true
            hasRadius = true
        } else if (
            DrawTool.contextMenuLayer.feature.geometry.type.toLowerCase() ===
            'linestring'
        ) {
            //Line
            featureType = 'line'

            hasStrokeColor = true
            hasStrokeOpacity = true
            hasStrokeStyle = true
            hasStrokeWeight = true
            //hasLineCap = true
            //hasLineJoin = true
        } else {
            //Polygon
            featureType = 'polygon'

            hasStrokeColor = true
            hasStrokeOpacity = true
            hasStrokeStyle = true
            hasStrokeWeight = true
            hasFillColor = true
            hasFillOpacity = true
        }

        var hideStyle = false
        if (
            typeof DrawTool.contextMenuLayer.toGeoJSON !== 'function' &&
            featureType !== 'note'
        )
            hideStyle = true

        var properties, style, file

        if (!deselecting) {
            if (typeof DrawTool.contextMenuLayer.toGeoJSON === 'function')
                DrawTool.contextMenuLayerOriginalGeoJSON = DrawTool.contextMenuLayer.toGeoJSON()
            else
                DrawTool.contextMenuLayerOriginalGeoJSON =
                    DrawTool.contextMenuLayer.feature

            DrawTool.contextMenuLayerOriginalLatLngs = F_.getLatLngs(
                DrawTool.contextMenuLayer
            )

            properties = DrawTool.contextMenuLayer.feature.properties
            properties.style = properties.style || {}
            style = properties.style || {}
            let fallbackStyle = {}
            if (kindLayerName && L_.layersStyles[kindLayerName])
                fallbackStyle = L_.layersStyles[kindLayerName]
            //Set blank styles to
            style.color = style.color || fallbackStyle.color || 'black'
            style.opacity = style.opacity || fallbackStyle.opacity || '1'
            style.dashArray = style.dashArray || fallbackStyle.dashArray || ''
            style.weight = style.weight || fallbackStyle.weight || '4'
            style.fillColor =
                style.fillColor || fallbackStyle.fillColor || 'black'
            style.fillOpacity =
                style.fillOpacity || fallbackStyle.fillOpacity || '0.2'
            style.symbol = style.symbol || fallbackStyle.symbol || ''
            style.radius = style.radius || fallbackStyle.radius || ''

            file = DrawTool.getFileObjectWithId(fileid)

            var bbox = turf.bbox(DrawTool.contextMenuLayerOriginalGeoJSON)

            var bounds = [
                [bbox[1], bbox[0]],
                [bbox[3], bbox[2]],
            ]
            var sl
            if (bounds[0][0] == bounds[1][0] && bounds[0][1] == bounds[1][1]) {
                if (properties.annotation) {
                    bounds[0] = [bounds[0][1], bounds[0][0]]
                    sl = L.circleMarker(bounds[0], {
                        color: 'white',
                        fillOpacity: 0,
                        weight: 2,
                        dashArray: '5 5',
                        radius: 12,
                    })
                        .addTo(Map_.map)
                        .bringToBack()
                } else {
                    var radius =
                        (parseInt(properties.style.radius) +
                            parseInt(properties.style.weight) * 2) *
                        2
                    sl = L.circleMarker(bounds[0], {
                        color: 'white',
                        weight: 2,
                        fillOpacity: 0,
                        dashArray: '5 5',
                        radius: radius,
                    })
                        .addTo(Map_.map)
                        .bringToBack()
                }
            } else if (
                bounds[0][0] != Number.POSITIVE_INFINITY &&
                bounds[0][0] != Number.NEGATIVE_INFINITY
            ) {
                sl = L.rectangle(bounds, {
                    color: 'white',
                    weight: 2,
                    fillOpacity: 0,
                    dashArray: '5 5',
                })
                    .addTo(Map_.map)
                    .bringToBack()
            }

            var layersLayer = shape
            if (shape.hasOwnProperty('_layers'))
                layersLayer = shape._layers[Object.keys(shape._layers)[0]]
            DrawTool.contextMenuLayers.push({
                shape: shape,
                layer: layersLayer,
                properties: properties,
                style: style,
                file: file,
                l_i_f: { layer: layer, index: index, fileid: fileid },
                selectionLayer: sl,
            })

            //selecting up to 1
            if (DrawTool.contextMenuLayers.length == 1) {
                grouping = false
            }
        } else {
            if (DrawTool.contextMenuLayers.length > 0) {
                DrawTool.contextMenuLayer = DrawTool.contextMenuLayers[0].layer
                if (typeof DrawTool.contextMenuLayer.toGeoJSON === 'function')
                    DrawTool.contextMenuLayerOriginalGeoJSON = DrawTool.contextMenuLayer.toGeoJSON()
                else
                    DrawTool.contextMenuLayerOriginalGeoJSON =
                        DrawTool.contextMenuLayer.feature

                DrawTool.contextMenuLayerOriginalLatLngs = F_.getLatLngs(
                    DrawTool.contextMenuLayer
                )

                properties = DrawTool.contextMenuLayer.feature.properties
                properties.style = properties.style || {}
                style = properties.style || {}
                let fallbackStyle = {}
                if (kindLayerName && L_.layersStyles[kindLayerName])
                    fallbackStyle = L_.layersStyles[kindLayerName]
                //Set blank styles to
                style.color = style.color || fallbackStyle.color || 'black'
                style.opacity = style.opacity || fallbackStyle.opacity || '1'
                style.dashArray =
                    style.dashArray || fallbackStyle.dashArray || ''
                style.weight = style.weight || fallbackStyle.weight || '4'
                style.fillColor =
                    style.fillColor || fallbackStyle.fillColor || 'black'
                style.fillOpacity =
                    style.fillOpacity || fallbackStyle.fillOpacity || '0.2'
                style.symbol = style.symbol || fallbackStyle.symbol || ''
                style.radius = style.radius || fallbackStyle.radius || ''

                file = DrawTool.contextMenuLayers[0].file

                //deselected back down to 1
                if (DrawTool.contextMenuLayers.length == 1) {
                    grouping = false
                }
            } else {
                DrawTool.contextMenuLayer = null
            }
        }

        $('.drawToolContextMenu').remove()

        if (DrawTool.contextMenuLayer == null) return

        DrawTool.contextMenuLayer.resetGeoJSON = function () {
            if (typeof DrawTool.contextMenuLayer.editEnabled === 'function') {
                var reenableEdit = false
                if (typeof DrawTool.contextMenuLayer.editEnabled === 'function')
                    reenableEdit = DrawTool.contextMenuLayer.editEnabled()

                if (typeof DrawTool.contextMenuLayer.disableEdit === 'function')
                    DrawTool.contextMenuLayer.disableEdit()
                if (DrawTool.contextMenuLayer.snapediting) {
                    DrawTool.contextMenuLayer.snapediting.disable()
                }
                //Yay all the lat lngs are flipped
                //console.log( JSON.parse(JSON.stringify(coords)) )
                //console.log( JSON.parse(JSON.stringify(DrawTool.contextMenuLayerOriginalLatLngs) ) )
                DrawTool.contextMenuLayer.setLatLngs(
                    JSON.parse(
                        JSON.stringify(DrawTool.contextMenuLayerOriginalLatLngs)
                    )
                )
                //console.log( JSON.parse(JSON.stringify(DrawTool.contextMenuLayer.feature)) );

                if (
                    reenableEdit &&
                    typeof DrawTool.contextMenuLayer.enableEdit === 'function'
                )
                    DrawTool.contextMenuLayer.enableEdit()
            } else if (
                typeof DrawTool.contextMenuLayer.setLatLng === 'function'
            ) {
                DrawTool.contextMenuLayer.setLatLng(currentPointLatLng)
            }
        }

        var title = properties.name || 'No Name'
        var titleClass = ''
        var countClass = 'hide'
        var defaultName = title
        var deleteClass = ''
        if (DrawTool.contextMenuLayers.length > 1) {
            title = 'GROUP'
            titleClass = 'group'
            countClass = ''
            defaultName = ''
            deleteClass = 'hide'
        }
        var description = properties.description || ''
        var uuid = properties.uuid || ''

        var ownedByUser = true
        if (displayOnly) ownedByUser = false
        else {
            for (var i = 0; i < DrawTool.contextMenuLayers.length; i++) {
                if (
                    DrawTool.contextMenuLayers[i].file.file_owner == 'master' ||
                    (mmgisglobal.user !==
                        DrawTool.contextMenuLayers[i].file.file_owner &&
                        (DrawTool.contextMenuLayers[i].file.file_owner_group ==
                            null ||
                            (DrawTool.contextMenuLayers[i].file
                                .file_owner_group &&
                                F_.diff(
                                    DrawTool.contextMenuLayers[i].file
                                        .file_owner_group,
                                    DrawTool.userGroups
                                ).length == 0)))
                )
                    ownedByUser = false
            }
        }

        let isMaster =
            DrawTool.userGroups.indexOf('mmgis-group') != -1 &&
            DrawTool.contextMenuLayers[0].file.file_owner == 'group'

        var setOperations = DrawTool.getSetOperationsUI()

        // prettier-ignore
        var markup = [
    "<div class='drawToolContextMenu'>",
        "<div class='drawToolContextMenuDragHandle'></div>",
        "<div class='drawToolContextMenuColorGround'></div>",
        "<div class='drawToolContextMenuHeaderColor'></div>",
        "<div class='drawToolContextMenuBottomColor'></div>",

        "<div class='drawToolContextMenuHeader'>",
        "<div class='flexbetween'>",
            "<div class='flexbetween'>",
            "<div class='drawToolContextMenuHeaderName " + titleClass + "''>" + title + "</div>",
            "<div class='drawToolContextMenuHeaderCount " + countClass + "'>",
                "<span>x" + DrawTool.contextMenuLayers.length + "</span>", 
            "</div>",
            "</div>",
            "<div class='drawToolContextMenuHeaderClose'>",
            "<i class='mdi mdi-close mdi-18px'></i>",
            "</div>",
        "</div>",
        "<div class='drawToolContextMenuHeader1 flexbetween'>",
            "<div class='drawToolContextMenuHeaderOwner'>by <span>" + file.file_owner + "</span></div>",
            "<div class='drawToolContextMenuHeaderFile'>from<span>" + file.file_name + "</span></div>",
        "</div>",
        "</div>",

        "<div class='drawToolContextMenuTabBar'>",
            "<div class='drawToolContextMenuTabTitle'>Properties</div>",
            "<div class='drawToolContextMenuTabButtons'>",
                "<div class='drawToolContextMenuTabButton' tab='drawToolContextMenuTabProperties' title='Properties'>",
                    "<i class='mdi mdi-file-document-box mdi-24px'></i>",
                "</div>",
                (!displayOnly) ? "<div class='drawToolContextMenuTabButton' tab='drawToolContextMenuTabStyle' title='Style' style='display: " + ( (hideStyle) ? 'none' : 'inherit' ) + "'><i class='mdi mdi-palette mdi-24px'></i></div>" : "",
                (!displayOnly) ? "<div class='drawToolContextMenuTabButton'  tab='drawToolContextMenuTabSet' title='Set Operations'><i class='mdi mdi-vector-combine mdi-24px'></i></div>" : "",
            "</div>",
        "</div>",

        "<div class='drawToolContextMenuTabs'>",

            "<div class='drawToolContextMenuTab drawToolContextMenuTabProperties'>",
                "<div class='drawToolContextMenuProperties'>",
                    "<div class='drawToolContextMenuPropertiesName flexbetween'>",
                        "<div>Name</div>",
                        "<input id='drawToolContextMenuPropertiesName' type='text' value='" + defaultName + "'/>",
                    "</div>",
                    "<div class='drawToolContextMenuPropertiesDescription flexbetween'>",
                        "<div>Description</div>",
                        "<textarea id='drawToolContextMenuPropertiesDescription' rows='5'></textarea>",
                    "</div>",
                    (!displayOnly) ? ["<div class='drawToolContextMenuPropertiesReassignUUID flexbetween'>",
                        "<div id='drawToolContextMenuPropertiesReassignUUIDValue'>" + uuid + "</div>",
                        "<div id='drawToolContextMenuPropertiesReassignUUID' class='drawToolButton1'>Reassign</div>",
                    "</div>"].join('\n') : "",
                "</div>",
            "</div>",

            "<div class='drawToolContextMenuTab drawToolContextMenuTabStyle'>",
                "<div class='drawToolContextMenuStyle'>",
                
                "<div class='styleprop flexbetween' style='display: " + ( (hasFillColor) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Fill Color<div class='drawToolStyleHighlight'></div></div>",
                "<div class='flexbetween'>",
                    "<input id='drawToolContextMenuFillColorInput' class='styleInput' type='text' value='" + style.fillColor + "'/>",
                    "<div v='" + style.fillColor + "' pick='fillcolorpick' class='picker fillcolor stylevalue2' style='background: " + style.fillColor + "'></div>",
                "</div>",
                "</div>",
                "<div class='picking tall fillcolorpick styleColorPicker' style='display: " + ( (hasFillColor) ? 'flex' : 'none' ) + "'>",
                    "<div class='fillcolorcustom'><i class='mdi mdi-water mdi-18px'></i></div>",
                    "<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>",
                    "<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>","<div></div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasFillOpacity) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Fill Opacity<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.fillOpacity + "' pick='fillopacitypick' class='picker fillopacity stylevalue'>" + ( style.fillOpacity * 100 ) + '%' + "</div>",
                "</div>",
                "<div class='picking fillopacitypick styleOpacityPicker' style='display: " + ( (hasFillOpacity) ? 'flex' : 'none' ) + "'>",
                "<div value='0'>0%</div>",
                "<div value='0.1'>10%</div>",
                "<div value='0.2'>20%</div>",
                "<div value='0.4'>40%</div>",
                "<div value='0.6'>60%</div>",
                "<div value='0.8'>80%</div>",
                "<div value='1'>100%</div>",
                "</div>",


                "<div class='styleprop flexbetween' style='display: " + ( (hasStrokeColor) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Stroke Color<div class='drawToolStyleHighlight'></div></div>",
                "<div class='flexbetween'>",
                    "<input id='drawToolContextMenuStrokeColorInput' class='styleInput' type='text' value='" + style.color + "'/>",
                    "<div v='" + style.color + "' pick='strokecolorpick' class='picker strokecolor stylevalue2' style='background: " + style.color + "'></div>",
                "</div>",
                "</div>",
                "<div class='picking tall strokecolorpick styleColorPicker' style='display: " + ( (hasStrokeColor) ? 'flex' : 'none' ) + "'>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasStrokeOpacity) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Stroke Opacity<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.opacity + "' pick='strokeopacitypick' class='picker strokeopacity stylevalue'>" + ( style.opacity * 100 ) + '%' + "</div>",
                "</div>",
                "<div class='picking strokeopacitypick styleOpacityPicker' style='display: " + ( (hasStrokeOpacity) ? 'flex' : 'none' ) + "'>",
                "<div value='0'>0%</div>",
                "<div value='0.2'>20%</div>",
                "<div value='0.4'>40%</div>",
                "<div value='0.6'>60%</div>",
                "<div value='0.8'>80%</div>",
                "<div value='1'>100%</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasStrokeStyle) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Stroke Style<div class='drawToolStyleHighlight'></div></div>",
                "<div  v='" + style.dashArray + "' pick='strokestylepick' class='picker strokestyle stylevalue'><svg width='100%' height='100%'><line x1='0' y1='14' x2='50' y2='14' stroke='#222' stroke-width='4' stroke-dasharray='" + style.dashArray + "' /></svg></div>",
                "</div>",
                "<div class='picking strokestylepick strokeStylePicker column mediumsmall' style='display: " + ( (hasStrokeStyle) ? 'flex' : 'none' ) + "'>",
                "<div value=''><svg width='100%' height='100%'><line x1='0' y1='12' x2='310' y2='12' stroke='#222' stroke-width='4' /></svg></div>",
                "<div value='20'><svg width='100%' height='100%'><line x1='0' y1='12' x2='310' y2='12' stroke='#222' stroke-width='4' stroke-dasharray='20' /></svg></div>",
                "<div value='1 12'><svg width='100%' height='100%'><line x1='0' y1='12' x2='310' y2='12' stroke='#222' stroke-width='4' stroke-dasharray='1 4' /></svg></div>",
                "<div value='70 15 15 15'><svg width='100%' height='100%'><line x1='0' y1='12' x2='310' y2='12' stroke='#222' stroke-width='4' stroke-dasharray='70 15 15 15' /></svg></div>",
                "<div value='1 20 1 20 40 20'><svg width='100%' height='100%'><line x1='0' y1='12' x2='310' y2='12' stroke='#222' stroke-width='4' stroke-dasharray='1 20 1 20 40 20' /></svg></div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasStrokeWeight) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Stroke Weight<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.weight + "' pick='strokeweightpick' class='picker strokeweight stylevalue'><svg width='100%' height='100%'><line x1='0' y1='14' x2='50' y2='14' stroke='#222' stroke-width='" + style.weight + "' /></svg></div>",
                "</div>",
                "<div class='picking strokeweightpick strokeWeightPicker column medium' style='display: " + ( (hasStrokeWeight) ? 'flex' : 'none' ) + "'>",
                "<div value='0'>None</div>",
                "<div value='1'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='1' /></svg></div>",
                "<div value='2' style='display: " + ( (featureType == 'note') ? 'none' : 'inline' ) + ";'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='2' /></svg></div>",
                "<div value='4' style='display: " + ( (featureType == 'note') ? 'none' : 'inline' ) + ";'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='4' /></svg></div>",
                "<div value='8' style='display: " + ( (featureType == 'note') ? 'none' : 'inline' ) + ";'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='8' /></svg></div>",
                "<div value='12' style='display: " + ( (featureType == 'note') ? 'none' : 'inline' ) + ";'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='12' /></svg></div>",
                "<div value='16' style='display: " + ( (featureType == 'note') ? 'none' : 'inline' ) + ";'><svg width='100%' height='100%'><line x1='0' y1='10' x2='310' y2='10' stroke='#222' stroke-width='16' /></svg></div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasSymbol) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Symbol<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.symbol + "' pick='symbolpick' class='picker symbol stylevalue'>" + style.symbol + "</div>",
                "</div>",
                "<div class='picking symbolpick symbolPicker' style='display: " + ( (hasSymbol) ? 'flex' : 'none' ) + "'>",
                "<div>Circle</div>",
                "<div>Square</div>",
                "<div>Triangle</div>",
                "<div>Diamond</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasRadius) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Radius<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.radius + "' pick='radiuspick' class='picker radius stylevalue'>" + style.radius + "</div>",
                "</div>",
                "<div class='picking radiuspick radiusPicker' style='display: " + ( (hasRadius) ? 'flex' : 'none' ) + "'>",
                "<div>" + ( (featureType == 'arrow') ? '5' : '4' ) + "</div>",
                "<div>" + ( (featureType == 'arrow') ? '10' : '6' ) + "</div>",
                "<div>" + ( (featureType == 'arrow') ? '20' : '8' ) + "</div>",
                "<div>" + ( (featureType == 'arrow') ? '30' : '12' ) + "</div>",
                "<div>" + ( (featureType == 'arrow') ? '40' : '16' ) + "</div>",
                "<div>" + ( (featureType == 'arrow') ? '50' : '20' ) + "</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasWidth) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Width<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.width + "' pick='widthpick' class='picker width stylevalue'>" + style.width + "</div>",
                "</div>",
                "<div class='picking widthpick widthPicker' style='display: " + ( (hasWidth) ? 'flex' : 'none' ) + "'>",
                "<div>2</div>",
                "<div>4</div>",
                "<div>6</div>",
                "<div>8</div>",
                "<div>12</div>",
                "<div>16</div>",
                "<div>20</div>",
                "<div>26</div>",
                "<div>32</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasLength) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Length<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.length + "' pick='lengthpick' class='picker length stylevalue'>" + style.length + "</div>",
                "</div>",
                "<div class='picking lengthpick lengthPicker' style='display: " + ( (hasLength) ? 'flex' : 'none' ) + "'>",
                "<div>50</div>",
                "<div>100</div>",
                "<div>150</div>",
                "<div>200</div>",
                "<div>250</div>",
                "<div>Full</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasLineCap) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Line Cap<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.lineCap + "' pick='linecappick' class='picker linecap stylevalue'>" + style.lineCap + "</div>",
                "</div>",
                "<div class='picking linecappick lineCapPicker' style='display: " + ( (hasLineCap) ? 'flex' : 'none' ) + "'>",
                "<div>Round</div>",
                "<div>Square</div>",
                "<div>Butt</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasLineJoin) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Line Join<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + style.lineJoin + "' pick='linejoinpick' class='picker linejoin stylevalue'>" + style.lineJoin + "</div>",
                "</div>",
                "<div class='picking linejoinpick lineJoinPicker' style='display: " + ( (hasLineJoin) ? 'flex' : 'none' ) + "'>",
                "<div>Round</div>",
                "<div>Miter</div>",
                "<div>Bevel</div>",
                "</div>",

                "<div class='styleprop flexbetween' style='display: " + ( (hasFontSize) ? 'flex' : 'none' ) + "'>",
                "<div class='flexbetween'>Font Size<div class='drawToolStyleHighlight'></div></div>",
                "<div v='" + (style.fontSize || '18px') + "' pick='fontsizepick' class='picker fontsize stylevalue'>" + (style.fontSize || '18px') + "</div>",
                "</div>",
                "<div class='picking fontsizepick fontSizePicker' style='display: " + ( (hasFontSize) ? 'flex' : 'none' ) + "'>",
                "<div>14px</div>",
                "<div>18px</div>",
                "<div>24px</div>",
                "<div>32px</div>",
                "<div>42px</div>",
                "<div>54px</div>",
                "</div>",
            "</div>",
            "</div>",

            "<div class='drawToolContextMenuTab drawToolContextMenuTabSet'>",
                setOperations,
            "</div>",

        "</div>",


          "<div class='drawToolContextMenuSave'>",
            "<div class='reg drawToolContextMenuDelete drawToolButton1 " + deleteClass + "'>",
              "<i class='mdi mdi-delete mdi-18px' style='cursor: pointer;'></i>",
            "</div>",
            "<div class='reg drawToolContextMenuReset drawToolButton1'>Reset</div>",
            "<div class='reg drawToolContextMenuSaveChanges drawToolButton1'>Save All Changes</div>",
            "<div class='sure sureq'>",
              "<div>",
                "<i class='mdi mdi-delete mdi-24px'></i>",
                "<div>Delete this shape?</div>",
              "</div>",
            "</div>",
            "<div class='sure drawToolContextMenuDeleteYes drawToolButton1'>Yes</div>",
            "<div class='sure drawToolContextMenuDeleteNo drawToolButton1'>No</div>",
          "</div>",

        "</div>"
      ].join('\n');
        $('body').append(markup)

        DrawTool.addSetOperationsEvents()

        $('.drawToolContextMenu').css({
            right: x + 'px',
            top: y + 'px',
        })

        $('#drawToolContextMenuPropertiesDescription').text(description)

        //Remove if not an owner
        if (!ownedByUser) {
            $('.drawToolContextMenuStyleHeader').remove()
            $('.drawToolContextMenuStyle').remove()
            $('.drawToolContextMenuSave').remove()
        }

        //Draggable
        var offsetX = 0
        var offsetY = 0
        $('.drawToolContextMenuDragHandle').on('mousedown', function (e) {
            offsetX = e.offsetX
            offsetY = e.offsetY
            $('body').on('mousemove', contextDrag)
            $('body').on('mouseup', contextStopDrag)
        })
        function contextDrag(e) {
            //console.log( e );
            var left = e.pageX - offsetX
            left = Math.max(left, 260)
            left = Math.min(left, window.innerWidth - 290)

            var top = e.pageY - offsetY
            top = Math.max(top, 0)
            top = Math.min(top, window.innerHeight - 50)
            $('.drawToolContextMenu').css({
                left: left + 'px',
                top: top + 'px',
            })

            $('.drawToolContextMenuContents').css({
                maxHeight: 'calc( 100vh - 102px - ' + top + 'px)',
            })
        }
        function contextStopDrag() {
            $('body').off('mousemove', contextDrag)
            $('body').off('mouseup', contextStopDrag)
        }

        if (!displayOnly) {
            DrawTool.contextMenuLayer.off('editable:editing')
            DrawTool.contextMenuLayer.on(
                'editable:editing',
                updateSelectionLayer
            )
        }

        function updateSelectionLayer() {
            if (!DrawTool.contextMenuLayers[0].selectionLayer) return
            var radius =
                DrawTool.contextMenuLayers[0].selectionLayer.options.radius
            Map_.rmNotNull(DrawTool.contextMenuLayers[0].selectionLayer)
            if (typeof DrawTool.contextMenuLayer.toGeoJSON !== 'function')
                return
            var bbox = turf.bbox(DrawTool.contextMenuLayer.toGeoJSON())
            var bounds = [
                [bbox[1], bbox[0]],
                [bbox[3], bbox[2]],
            ]
            var sl
            if (bounds[0][0] == bounds[1][0] && bounds[0][1] == bounds[1][1])
                sl = L.circleMarker(bounds[0], {
                    color: 'white',
                    weight: 2,
                    fillOpacity: 0,
                    dashArray: '5 5',
                    radius: radius,
                })
                    .addTo(Map_.map)
                    .bringToBack()
            else {
                sl = L.rectangle(bounds, {
                    color: 'white',
                    weight: 2,
                    fillOpacity: 0,
                    dashArray: '5 5',
                })
                    .addTo(Map_.map)
                    .bringToBack()
            }

            var bounds = [
                [bbox[1], bbox[0]],
                [bbox[3], bbox[2]],
            ]
            DrawTool.contextMenuLayers[0].selectionLayer = sl
        }

        //RESET
        $('.drawToolContextMenuReset').on('click', function () {
            resetShape()
        })
        function resetShape(justThis) {
            for (var c in DrawTool.contextMenuLayers) {
                if (justThis != null) c = justThis
                var l = DrawTool.contextMenuLayers[c]
                if (
                    !displayOnly &&
                    l != null &&
                    l.hasOwnProperty('l_i_f') &&
                    L_.layersGroup[l.l_i_f.layer][l.l_i_f.index] != null
                ) {
                    //Properties
                    //Style
                    updateStrokeColor(l.properties.style.color, l.shape)
                    updateStrokeOpacity(l.properties.style.opacity, l.shape)
                    updateStrokeStyle(
                        l.properties.style.dashArray,
                        "<svg width='100%' height='100%'><line x1='0' y1='14' x2='50' y2='14' stroke='#222' stroke-width='4' stroke-dasharray='" +
                            (properties ? properties.style.dashArray : '') +
                            "' /></svg>",
                        l.shape
                    )
                    updateStrokeWeight(
                        l.properties.style.weight,
                        "<svg width='100%' height='100%'><line x1='0' y1='14' x2='50' y2='14' stroke='#222' stroke-width='" +
                            (properties ? properties.style.weight : 4) +
                            "' /></svg>",
                        l.shape,
                        l.properties.style
                    )
                    updateFillColor(
                        l.properties.style.fillColor,
                        l.shape,
                        l.properties.style
                    )
                    updateFillOpacity(l.properties.style.fillOpacity, l.shape)
                    updateSymbol(l.properties.style.symbol, l.shape)
                    updateRadius(l.properties.style.radius, l.shape)
                    updateWidth(l.properties.style.width, l.shape)

                    updateFontSize(l.properties.style.fontSize, l.shape)

                    if (justThis != null) break
                }
            }
            //Geometry
            if (
                !displayOnly &&
                l != null &&
                l.hasOwnProperty('l_i_f') &&
                L_.layersGroup[l.l_i_f.layer][l.l_i_f.index] != null &&
                l.properties.arrow == true
            ) {
                DrawTool.addArrowToMap(
                    l.l_i_f.layer,
                    l.shape.start,
                    l.shape.end,
                    l.properties.style,
                    l.shape.feature,
                    l.l_i_f.index
                )
            } else {
                DrawTool.contextMenuLayer.resetGeoJSON()
            }

            //Other
            DrawTool.contextMenuChanges.props.description = false
            DrawTool.contextMenuChanges.style.color = false
            DrawTool.contextMenuChanges.style.opacity = false
            DrawTool.contextMenuChanges.style.dashArray = false
            DrawTool.contextMenuChanges.style.weight = false
            DrawTool.contextMenuChanges.style.fillColor = false
            DrawTool.contextMenuChanges.style.fillOpacity = false
            DrawTool.contextMenuChanges.style.symbol = false
            DrawTool.contextMenuChanges.style.radius = false

            if (DrawTool.contextMenuLayers.length == 1) updateSelectionLayer()
        }

        //TABS
        $('.drawToolContextMenuTabButton').on('click', function () {
            $('.drawToolContextMenuTabButton.active').removeClass('active')
            $('.drawToolContextMenuTab.active').removeClass('active')
            $(this).addClass('active')
            $('.' + $(this).attr('tab')).addClass('active')
            $('.drawToolContextMenuTabTitle').text($(this).attr('title'))
            DrawTool.editPanelActiveTab = $(this).attr('tab')
            if (
                DrawTool.editPanelActiveTab ===
                'drawToolContextMenuTabTabThatShouldBeWider'
            ) {
                $('.drawToolContextMenu').css({ width: '800px' })
            } else {
                $('.drawToolContextMenu').css({ width: '340px' })
            }
            if (DrawTool.editPanelActiveTab !== 'drawToolContextMenuTabSet') {
                DrawTool.endSplitDrawing()
            }
        })

        //Maintain active tab type across openings
        DrawTool.editPanelActiveTab =
            DrawTool.editPanelActiveTab || 'drawToolContextMenuTabProperties'
        $(
            '.drawToolContextMenuTabButton[tab="' +
                DrawTool.editPanelActiveTab +
                '"]'
        ).click()

        //COLLAPSE
        $('.drawToolContextMenu .collapse').on('click', function () {
            var collapseThis = $('.' + $(this).attr('collapse'))
            collapseThis.toggleClass('collapsed')
        })

        //DELETE
        $('.drawToolContextMenuDelete').on('click', function () {
            $('.drawToolContextMenu .reg').css('display', 'none')
            $('.drawToolContextMenu .sure').css('display', 'block')
        })
        $('.drawToolContextMenuDeleteNo').on('click', function () {
            $('.drawToolContextMenu .sure').css('display', 'none')
            $('.drawToolContextMenu .reg').css('display', 'block')
        })
        $('.drawToolContextMenuDeleteYes').on('click', function () {
            var body = {
                file_id: fileid,
                id: properties._.id,
            }
            DrawTool.removeDrawing(body, function () {
                Map_.rmNotNull(DrawTool.contextMenuLayer)
                L_.layersGroup[DrawTool.lastContextLayerIndexFileId.layer][
                    DrawTool.lastContextLayerIndexFileId.index
                ] = null

                $('.drawToolContextMenuHeaderClose').click()
                $(
                    ".drawToolShapeLi[shape_id='" +
                        properties._.id +
                        "'][file_id='" +
                        fileid +
                        "']"
                ).remove()

                if (DrawTool.isReviewOpen) DrawTool.showReview()

                //Remove from globe
                var lif = DrawTool.lastContextLayerIndexFileId
                Globe_.removeVectorTileLayer(
                    'camptool_' + lif.layer + '_' + lif.index
                )
                DrawTool.populateShapes()
            })
        })

        //STYLES
        var badInputColor = 'rgba(255,0,0,0.5)'

        $('.drawToolContextMenu .styleprop .picker').on('click', function () {
            var elm = $('.' + $(this).attr('pick'))
            var open = elm.hasClass('open')
            //$('.drawToolContextMenu .styleprop').removeClass('open')
            //$('.drawToolContextMenu .picking').removeClass('open')
            if (!open) {
                $(this).parent().parent().addClass('open')
                elm.addClass('open')
            } else {
                $(this).parent().parent().removeClass('open')
                elm.removeClass('open')
            }
        })
        //STROKE COLOR
        $('.strokecolorpick').html(F_.makeColorGrid(11, 12))
        $('.strokecolorpick .colorgridsquare').on('click', function () {
            $('.strokecolorpick .colorgridsquare').removeClass('active')
            $(this).addClass('active')
            var v = $(this).css('background-color')
            updateStrokeColor(v)
        })
        function updateStrokeColor(v, layer) {
            DrawTool.contextMenuChanges.style.color = true

            $('.strokecolor').css('background-color', v)
            $('#drawToolContextMenuStrokeColorInput').val(v)
            $('.strokecolor').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ color: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ color: v })
                        else if (
                            DrawTool.contextMenuLayers[c].layer.feature &&
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties.annotation == true
                        ) {
                            var p =
                                DrawTool.contextMenuLayers[c].layer.feature
                                    .properties._
                            $(
                                '#DrawToolAnnotation_' + p.file_id + '_' + p.id
                            ).css(
                                'text-shadow',
                                F_.getTextShadowString(
                                    v,
                                    $('.strokeopacity').attr('v'),
                                    $('.strokeweight').attr('v')
                                )
                            )
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.color)
                $('.strokecolor')
                    .parent()
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.strokecolor')
                    .parent()
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.strokecolor')
                    .parent()
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.strokecolor').parent().prev().css('background', 'inherit')
        }
        $('#drawToolContextMenuStrokeColorInput').on('input', function () {
            var color = $(this).val()
            if (F_.validTextColour(color)) {
                $(this).css('background', 'white')
                updateStrokeColor(color)
            } else {
                $(this).css('background', badInputColor)
            }
        })
        //STROKE OPACITY
        $('.strokeopacitypick > div').on('click', function () {
            var v = $(this).attr('value')
            updateStrokeOpacity(v)
        })
        function updateStrokeOpacity(v, layer) {
            var t = v * 100 + '%'

            DrawTool.contextMenuChanges.style.opacity = true

            $('.strokeopacity').text(t)
            $('.strokeopacity').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ opacity: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ opacity: v })
                        else if (
                            DrawTool.contextMenuLayers[c].layer.feature &&
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties.annotation == true
                        ) {
                            var p =
                                DrawTool.contextMenuLayers[c].layer.feature
                                    .properties._
                            $(
                                '#DrawToolAnnotation_' + p.file_id + '_' + p.id
                            ).css(
                                'text-shadow',
                                F_.getTextShadowString(
                                    $('.strokecolor').attr('v'),
                                    v,
                                    $('.strokeweight').attr('v')
                                )
                            )
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.opacity)
                $('.strokeopacity')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.strokeopacity')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.strokeopacity')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.strokeopacity').prev().css('background', 'inherit')
        }
        //STROKE STYLE
        $('.strokestylepick > div').on('click', function () {
            var v = $(this).attr('value')
            var h = $(this).html()
            updateStrokeStyle(v, h)
        })
        function updateStrokeStyle(v, h, layer) {
            DrawTool.contextMenuChanges.style.dashArray = true

            $('.strokestyle').html(h)
            $('.strokestyle').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ dashArray: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ dashArray: v })
                        else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.dashArray)
                $('.strokestyle')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.strokestyle')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.strokestyle')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.strokestyle').prev().css('background', 'inherit')
        }
        //STROKE WEIGHT
        $('.strokeweightpick > div').on('click', function () {
            var v = $(this).attr('value')
            var h = $(this).html()
            updateStrokeWeight(v, h)
        })
        function updateStrokeWeight(v, h, layer, resetStyle) {
            DrawTool.contextMenuChanges.style.weight = true

            $('.strokeweight').html(h)
            $('.strokeweight').attr('v', v)

            v = parseInt(v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) {
                    layer.setStyle({ weight: v })
                } else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ weight: v })
                        else if (
                            DrawTool.contextMenuLayers[c].layer.feature &&
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties.annotation == true
                        ) {
                            var p =
                                DrawTool.contextMenuLayers[c].layer.feature
                                    .properties._
                            $(
                                '#DrawToolAnnotation_' + p.file_id + '_' + p.id
                            ).css(
                                'text-shadow',
                                F_.getTextShadowString(
                                    $('.strokecolor').attr('v'),
                                    $('.strokeopacity').attr('v'),
                                    v
                                )
                            )
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            } else if (resetStyle != null) {
                //Reset notes
                for (var c in DrawTool.contextMenuLayers) {
                    if (
                        DrawTool.contextMenuLayers[c].layer.feature &&
                        DrawTool.contextMenuLayers[c].layer.feature.properties
                            .annotation == true
                    ) {
                        var p =
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties._
                        $('#DrawToolAnnotation_' + p.file_id + '_' + p.id).css(
                            'text-shadow',
                            F_.getTextShadowString(
                                resetStyle.color,
                                resetStyle.opacity,
                                v
                            )
                        )
                    }
                }
            }

            if (properties && v != properties.style.weight)
                $('.strokeweight')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.strokeweight')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.strokeweight')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.strokeweight').prev().css('background', 'inherit')
        }
        //FILL COLOR

        $('.fillcolorpick').html(F_.makeColorGrid(11, 12))
        $('.fillcolorpick .colorgridsquare').on('click', function () {
            $('.fillcolorpick .colorgridsquare').removeClass('active')
            $(this).addClass('active')
            var v = $(this).css('background-color')
            updateFillColor(v)
        })
        function updateFillColor(v, layer, resetStyle) {
            DrawTool.contextMenuChanges.style.fillColor = true

            $('.fillcolor').css('background-color', v)
            $('.fillcolor').attr('v', v)
            $('#drawToolContextMenuFillColorInput').val(v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ fillColor: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ fillColor: v })
                        else if (
                            DrawTool.contextMenuLayers[c].layer.feature &&
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties.annotation == true
                        ) {
                            var p =
                                DrawTool.contextMenuLayers[c].layer.feature
                                    .properties._
                            $(
                                '#DrawToolAnnotation_' + p.file_id + '_' + p.id
                            ).css('color', v)
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            } else if (resetStyle != null) {
                //Reset notes
                for (var c in DrawTool.contextMenuLayers) {
                    if (
                        DrawTool.contextMenuLayers[c].layer.feature &&
                        DrawTool.contextMenuLayers[c].layer.feature.properties
                            .annotation == true
                    ) {
                        var p =
                            DrawTool.contextMenuLayers[c].layer.feature
                                .properties._
                        $('#DrawToolAnnotation_' + p.file_id + '_' + p.id).css(
                            'color',
                            resetStyle.fillColor
                        )
                    }
                }
            }

            if (properties && v != properties.style.fillColor)
                $('.fillcolor')
                    .parent()
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.fillcolor')
                    .parent()
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.fillcolor')
                    .parent()
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.fillcolor').parent().prev().css('background', 'inherit')
        }
        $('#drawToolContextMenuFillColorInput').on('input', function () {
            var color = $(this).val()
            if (F_.validTextColour(color)) {
                $(this).css('background', 'white')
                updateFillColor(color)
            } else {
                $(this).css('background', 'rgba(255,0,0,0.5)')
            }
        })
        //FILL OPACITY
        $('.fillopacitypick > div').on('click', function () {
            var v = $(this).attr('value')
            updateFillOpacity(v)
        })
        function updateFillOpacity(v, layer) {
            v = v || 0.2
            var t = v * 100 + '%'

            DrawTool.contextMenuChanges.style.fillOpacity = true

            $('.fillopacity').text(t)
            $('.fillopacity').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ fillOpacity: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ fillOpacity: v })
                        else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.fillOpacity)
                $('.fillopacity')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.fillopacity')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.fillopacity')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.fillopacity').prev().css('background', 'inherit')
        }
        //SYMBOL
        $('.symbolpick > div').on('click', function () {
            var v = $(this).text()
            updateSymbol(v)
        })
        function updateSymbol(v, layer) {
            $('.symbol').text(v)
            $('.symbol').attr('v', v)

            DrawTool.contextMenuChanges.style.symbol = true

            if (properties && v != properties.style.symbol)
                $('.symbol')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.symbol')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.symbol')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.symbol').prev().css('background', 'inherit')
        }
        //RADIUS
        $('.radiuspick > div').on('click', function () {
            var v = $(this).text()
            updateRadius(v)
        })
        function updateRadius(v, layer) {
            $('.radius').text(v)
            $('.radius').attr('v', v)

            DrawTool.contextMenuChanges.style.radius = true

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ radius: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ radius: v })
                        else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.radius)
                $('.radius')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.radius')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.radius')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.radius').prev().css('background', 'inherit')
        }
        //WIDTH
        $('.widthpick > div').on('click', function () {
            var v = $(this).text()
            updateWidth(v)
        })
        function updateWidth(v, layer) {
            if (v == null) return
            v = parseInt(v)

            DrawTool.contextMenuChanges.style.width = true

            $('.width').text(v)
            $('.width').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) layer.setStyle({ weight: v })
                else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function')
                            s.setStyle({ weight: v })
                        else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.width)
                $('.width')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.width')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.width').prev().css('background', DrawTool.highlightGradient)
            else $('.width').prev().css('background', 'inherit')
        }
        //LENGTH
        $('.lengthpick > div').on('click', function () {
            var v = $(this).text()
            updateLength(v)
        })
        function updateLength(v, layer) {
            if (v == null) return

            DrawTool.contextMenuChanges.style.length = true

            $('.length').text(v)
            $('.length').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) {
                } else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function') {
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.length)
                $('.length')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.length')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.length')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.length').prev().css('background', 'inherit')
        }
        //LINECAP
        $('.linecappick > div').on('click', function () {
            var v = $(this).text()
            updateLineCap(v)
        })
        function updateLineCap(v, layer) {
            if (v == null) return

            DrawTool.contextMenuChanges.style.lineCap = true

            $('.linecap').text(v)
            $('.linecap').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) {
                } else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function') {
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.lineCap)
                $('.linecap')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.linecap')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.linecap')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.linecap').prev().css('background', 'inherit')
        }
        //LINEJOIN
        $('.linejoinpick > div').on('click', function () {
            var v = $(this).text()
            updateLineJoin(v)
        })
        function updateLineJoin(v, layer) {
            if (v == null) return

            DrawTool.contextMenuChanges.style.lineJoin = true

            $('.linejoin').text(v)
            $('.linejoin').attr('v', v)

            if (!layer || (layer && typeof layer.setStyle === 'function')) {
                if (layer) {
                } else {
                    for (var c in DrawTool.contextMenuLayers) {
                        var s = DrawTool.contextMenuLayers[c].shape
                        if (typeof s.setStyle === 'function') {
                        } else {
                            //Arrow
                            var lif = DrawTool.contextMenuLayers[c].l_i_f
                            var style = Object.assign(
                                {},
                                s.feature.properties.style
                            )
                            style = setProperties({ style: style }).style
                            DrawTool.addArrowToMap(
                                lif.layer,
                                s.start,
                                s.end,
                                style,
                                s.feature,
                                lif.index
                            )
                        }
                    }
                }
            }

            if (properties && v != properties.style.lineJoin)
                $('.linejoin')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.linejoin')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.linejoin')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.linejoin').prev().css('background', 'inherit')
        }

        //FONTSIZE
        $('.fontsizepick > div').on('click', function () {
            var v = $(this).text()
            updateFontSize(v)
        })
        function updateFontSize(v, layer) {
            if (v == null) return

            DrawTool.contextMenuChanges.style.fontSize = true

            $('.fontsize').text(v)
            $('.fontsize').attr('v', v)

            for (var c in DrawTool.contextMenuLayers) {
                var s = DrawTool.contextMenuLayers[c].shape
                var p = s.feature.properties._
                $('#DrawToolAnnotation_' + p.file_id + '_' + p.id).css(
                    'font-size',
                    v
                )
            }

            if (properties && v != properties.style.fontSize)
                $('.fontsize')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', DrawTool.highlightColor)
            else
                $('.fontsize')
                    .parent()
                    .find('.drawToolStyleHighlight')
                    .css('background', 'inherit')

            //Group change
            if (!layer && DrawTool.contextMenuChanges.use)
                $('.fontsize')
                    .prev()
                    .css('background', DrawTool.highlightGradient)
            else $('.fontsize').prev().css('background', 'inherit')
        }

        //CLOSE
        $('.drawToolContextMenuHeaderClose').on('click', function () {
            if (DrawTool.contextMenuLayer && !displayOnly) {
                var elm = $(
                    '#drawToolShapeLiItem_' +
                        DrawTool.lastContextLayerIndexFileId.layer +
                        '_' +
                        DrawTool.lastContextLayerIndexFileId.index
                )
                $('.drawToolShapeLi').removeClass('active')
                elm.find('.drawToolShapeLiItemCheck').removeClass('checked')
                if (typeof DrawTool.contextMenuLayer.disableEdit === 'function')
                    DrawTool.contextMenuLayer.disableEdit()
                if (DrawTool.contextMenuLayer.snapediting) {
                    DrawTool.contextMenuLayer.snapediting.disable()
                } else DrawTool.cmLayerDragOff()
                DrawTool.isEditing = false
                resetShape()
            }

            for (var c in DrawTool.contextMenuLayers)
                Map_.rmNotNull(DrawTool.contextMenuLayers[c].selectionLayer)
            DrawTool.contextMenuLayers = []

            $('.drawToolContextMenu').animate(
                {
                    opacity: 0,
                },
                250,
                function () {
                    $('.drawToolContextMenu').remove()
                }
            )
        })

        //EDIT
        if (!grouping && !displayOnly) toggleEdit()
        function toggleEdit() {
            if (DrawTool.isEditing || !ownedByUser) {
                if (
                    typeof DrawTool.contextMenuLayer.disableEdit === 'function'
                ) {
                    DrawTool.contextMenuLayer.disableEdit()
                    if (DrawTool.contextMenuLayer.snapediting) {
                        DrawTool.contextMenuLayer.snapediting.disable()
                    }
                } else DrawTool.cmLayerDragOff()

                DrawTool.isEditing = false
                $(this).html('Edit')
            } else {
                if (
                    typeof DrawTool.contextMenuLayer.enableEdit === 'function'
                ) {
                    if (DrawTool.snapping) {
                        try {
                            DrawTool.contextMenuLayer.snapediting = new L.Handler.PolylineSnap(
                                Map_.map,
                                DrawTool.contextMenuLayer
                            )
                            var guides = DrawTool.getSnapGuides(
                                DrawTool.contextMenuLayer
                            )
                            for (var g = 0; g < guides.length; g++)
                                DrawTool.contextMenuLayer.snapediting.addGuideLayer(
                                    guides[g]
                                )

                            DrawTool.contextMenuLayer.snapediting._poly.options.editing = {}
                            DrawTool.contextMenuLayer.snapediting._poly.options.original = {}
                            DrawTool.contextMenuLayer.snapediting.enable()
                        } catch (e) {
                            console.log(e)
                            DrawTool.contextMenuLayer.enableEdit()
                        }
                    } else {
                        DrawTool.contextMenuLayer.enableEdit()
                    }
                } else {
                    DrawTool.cmLayerDragOn()
                }

                DrawTool.isEditing = true
                $(this).html('Stop Editing')
            }
        }

        //NAME
        $('#drawToolContextMenuPropertiesName').on('input', function () {
            var v = $(this).val()
            var c = $('.drawToolContextMenuHeaderName')
            c.text(v)
            if (v != properties.name) {
                DrawTool.contextMenuChanges.props.name = true
                c.css('color', 'rgb(127,255,0)')
                $(this).css('border-bottom', DrawTool.highlightBorder)
            } else {
                c.css('color', 'inherit')
                $(this).css('border-bottom', 'inherit')
            }
        })

        //DESCRIPTION
        $('#drawToolContextMenuPropertiesDescription').on('input', function () {
            var v = $(this).val()
            if (v != properties.description) {
                DrawTool.contextMenuChanges.props.description = true
                $(this).css('border-bottom', DrawTool.highlightBorder)
            } else {
                $(this).css('border-bottom', 'inherit')
            }
        })

        //REASSIGN UUID
        $('#drawToolContextMenuPropertiesReassignUUID').on(
            'click',
            function () {
                var reassign = prompt(
                    'Are you sure you want to reassign this shape to a new UUID? (y/n)\n' +
                        'If you change your mind soon afterwards, this action can be undone through history.'
                )

                if (
                    reassign != null &&
                    (reassign.toLowerCase() === 'y' ||
                        reassign.toLowerCase() === 'yes')
                ) {
                    calls.api(
                        'draw_edit',
                        {
                            feature_id: properties._.id,
                            file_id: fileid,
                            reassignUUID: true,
                        },
                        function (data) {
                            DrawTool.refreshFile(fileid, null, true, [
                                data.body.id,
                            ])

                            if (DrawTool.isReviewOpen) DrawTool.showReview()
                        },
                        function () {
                            $('.drawToolContextMenuSave').css(
                                'background',
                                '#ff2626'
                            )
                            setTimeout(function () {
                                $('.drawToolContextMenuSave').css(
                                    'background',
                                    'var(--color-a)'
                                )
                            }, 1500)
                        }
                    )
                }
            }
        )

        //SAVE
        $('.drawToolContextMenuSaveChanges').on('click', function () {
            if (!grouping) {
                //Then just a regular single save
                if (typeof DrawTool.contextMenuLayer.toGeoJSON === 'function')
                    DrawTool.contextMenuLayerOriginalGeoJSON = DrawTool.contextMenuLayer.toGeoJSON()
                else
                    DrawTool.contextMenuLayerOriginalGeoJSON =
                        DrawTool.contextMenuLayer.feature

                DrawTool.contextMenuLayerOriginalLatLngs = F_.getLatLngs(
                    DrawTool.contextMenuLayer
                )

                currentPointLatLng = Object.assign(
                    {},
                    DrawTool.contextMenuLayer._latlng
                )

                var newProperties = properties
                newProperties.style = properties.style || {}

                setProperties(newProperties)

                var newGeometry
                if (featureType != 'note' && featureType != 'arrow') {
                    newGeometry = DrawTool.contextMenuLayer.toGeoJSON().geometry
                    if (
                        newGeometry == null &&
                        DrawTool.contextMenuLayer.hasOwnProperty('_layers')
                    )
                        newGeometry = DrawTool.contextMenuLayer._layers
                            .getFirst()
                            .toGeoJSON().geometry
                } else if (featureType == 'note') {
                    newGeometry = {
                        type: 'Point',
                        coordinates: [
                            DrawTool.contextMenuLayer._latlng.lng,
                            DrawTool.contextMenuLayer._latlng.lat,
                        ],
                    }
                } else {
                    newGeometry = DrawTool.contextMenuLayer.feature.geometry
                }

                if (DrawTool.vars.demtilesets) {
                    F_.lnglatsToDemtileElevs(
                        newGeometry,
                        DrawTool.vars.demtilesets,
                        function (data) {
                            newGeometry = data
                            drawEdit()
                            //geoJSON = F_.geojsonAddSpatialProperties(geoJSON)
                        }
                    )
                } else {
                    drawEdit()
                }
                function drawEdit() {
                    calls.api(
                        'draw_edit',
                        {
                            feature_id: properties._.id,
                            file_id: fileid,
                            properties: JSON.stringify(newProperties),
                            geometry: JSON.stringify(newGeometry),
                        },
                        (function (
                            newProperties,
                            newGeometry,
                            featureType,
                            fileid
                        ) {
                            return function (data) {
                                DrawTool.refreshFile(
                                    fileid,
                                    null,
                                    true,
                                    [data.body.id],
                                    null,
                                    function () {
                                        $('.drawToolContextMenuSave').css(
                                            'background',
                                            '#26ff67'
                                        )
                                        setTimeout(function () {
                                            $('.drawToolContextMenuSave').css(
                                                'background',
                                                'var(--color-a)'
                                            )
                                        }, 1500)
                                    }
                                )

                                if (DrawTool.isReviewOpen) DrawTool.showReview()
                            }
                        })(newProperties, newGeometry, featureType, fileid),
                        function () {
                            $('.drawToolContextMenuSave').css(
                                'background',
                                '#ff2626'
                            )
                            setTimeout(function () {
                                $('.drawToolContextMenuSave').css(
                                    'background',
                                    'var(--color-a)'
                                )
                            }, 1500)
                        }
                    )
                }
            } else {
                var newSelectedFeatureIds = []
                editLoop(0)
                function editLoop(i) {
                    if (i >= DrawTool.contextMenuLayers.length) {
                        //Stop recursion
                        DrawTool.refreshFile(
                            fileid,
                            null,
                            true,
                            newSelectedFeatureIds
                        )
                    } else {
                        var l = DrawTool.contextMenuLayers[i]
                        if (!l.layer.hasOwnProperty('feature'))
                            l.layer.feature = l.shape.feature

                        var newProperties = l.layer.feature.properties
                        newProperties.style =
                            l.layer.feature.properties.style || {}

                        setProperties(newProperties)

                        calls.api(
                            'draw_edit',
                            {
                                feature_id: l.properties._.id,
                                file_id: l.file.id,
                                properties: JSON.stringify(newProperties),
                            },
                            (function (c, fileid, id, newProperties) {
                                return function (data) {
                                    $('.drawToolContextMenuSave').css(
                                        'background',
                                        '#26ff67'
                                    )
                                    setTimeout(function () {
                                        $('.drawToolContextMenuSave').css(
                                            'background',
                                            'var(--color-a)'
                                        )
                                    }, 1500)

                                    newSelectedFeatureIds.push(data.body.id)
                                    setTimeout(function () {
                                        editLoop(i + 1)
                                    }, 2)
                                }
                            })(l, l.file.id, l.properties._.id, newProperties),
                            function () {
                                $('.drawToolContextMenuSave').css(
                                    'background',
                                    '#ff2626'
                                )
                                setTimeout(function () {
                                    $('.drawToolContextMenuSave').css(
                                        'background',
                                        'var(--color-a)'
                                    )
                                }, 1500)
                            }
                        )
                    }
                }
            }
        })

        function setProperties(newProperties) {
            let force = false
            if (newProperties === true) {
                force = true
                newProperties = undefined
            }

            newProperties = newProperties || {}
            newProperties.style = newProperties.style || {}

            if (force || DrawTool.contextMenuChanges.props.name)
                newProperties.name =
                    $('#drawToolContextMenuPropertiesName').val() ||
                    properties.name
            if (force || DrawTool.contextMenuChanges.props.description)
                newProperties.description =
                    $('#drawToolContextMenuPropertiesDescription').val() ||
                    properties.description
            if (
                hasStrokeColor &&
                (force || DrawTool.contextMenuChanges.style.color)
            )
                newProperties.style.color = $(
                    '.drawToolContextMenu .strokecolor'
                ).attr('v')
            if (
                hasStrokeWeight &&
                (force || DrawTool.contextMenuChanges.style.weight)
            )
                newProperties.style.weight = parseInt(
                    $('.drawToolContextMenu .strokeweight').attr('v')
                )
            if (
                hasStrokeOpacity &&
                (force || DrawTool.contextMenuChanges.style.opacity)
            )
                newProperties.style.opacity = parseFloat(
                    $('.drawToolContextMenu .strokeopacity').attr('v')
                )
            if (
                hasStrokeStyle &&
                (force || DrawTool.contextMenuChanges.style.dashArray)
            )
                newProperties.style.dashArray = $(
                    '.drawToolContextMenu .strokestyle'
                ).attr('v')
            if (
                hasFillColor &&
                (force || DrawTool.contextMenuChanges.style.fillColor)
            )
                newProperties.style.fillColor = $(
                    '.drawToolContextMenu .fillcolor'
                ).attr('v')
            if (
                hasFillOpacity &&
                (force || DrawTool.contextMenuChanges.style.fillOpacity)
            )
                newProperties.style.fillOpacity = parseFloat(
                    $('.drawToolContextMenu .fillopacity').attr('v')
                )
            if (
                hasSymbol &&
                (force || DrawTool.contextMenuChanges.style.symbol)
            )
                newProperties.style.symbol = $(
                    '.drawToolContextMenu .symbol'
                ).attr('v')
            if (
                hasRadius &&
                (force || DrawTool.contextMenuChanges.style.radius)
            )
                newProperties.style.radius = parseInt(
                    $('.drawToolContextMenu .radius').attr('v')
                )
            if (hasWidth && (force || DrawTool.contextMenuChanges.style.width))
                newProperties.style.width = parseInt(
                    $('.drawToolContextMenu .width').attr('v')
                )
            if (
                hasLength &&
                (force || DrawTool.contextMenuChanges.style.length)
            )
                newProperties.style.length = $(
                    '.drawToolContextMenu .length'
                ).attr('v')
            if (
                hasLineCap &&
                (force || DrawTool.contextMenuChanges.style.lineCap)
            )
                newProperties.style.lineCap = $('.drawToolContextMenu .linecap')
                    .attr('v')
                    .toLowerCase()
            if (
                hasLineJoin &&
                (force || DrawTool.contextMenuChanges.style.lineJoin)
            )
                newProperties.style.lineJoin = $(
                    '.drawToolContextMenu .linejoin'
                )
                    .attr('v')
                    .toLowerCase()
            if (
                hasFontSize &&
                (force || DrawTool.contextMenuChanges.style.fontSize)
            )
                newProperties.style.fontSize = $(
                    '.drawToolContextMenu .fontsize'
                )
                    .attr('v')
                    .toLowerCase()
            return newProperties
        }
    },
    getSnapGuides: function (layer) {
        var guides = []
        for (var j = 0; j < DrawTool.filesOn.length; j++) {
            for (var e of L_.layersGroup['DrawTool_' + DrawTool.filesOn[j]])
                if (e != null) {
                    var l = e
                    if (l.hasOwnProperty('_layers'))
                        l = l._layers[Object.keys(l._layers)[0]]
                    //Ignore the same layer
                    if (l != layer) guides.push(e)
                }
        }
        return guides
    },
    cmLayerDragOn: function () {
        if (
            DrawTool.contextMenuLayer.hasOwnProperty('feature') &&
            DrawTool.contextMenuLayer.feature.hasOwnProperty('properties') &&
            DrawTool.contextMenuLayer.feature.properties.annotation == true
        ) {
            var p = DrawTool.contextMenuLayer.feature.properties._
            $('#DrawToolAnnotation_' + p.file_id + '_' + p.id).on(
                'mousedown',
                DrawTool.cmLayerDown
            )
        } else DrawTool.contextMenuLayer.on('mousedown', DrawTool.cmLayerDown)
        Map_.map.on('mouseup', DrawTool.cmLayerUp)
        Map_.map.on('mousemove', DrawTool.cmLayerMove)

        DrawTool.lastDragPoint = null

        DrawTool.contextMenuLayer.dragging = false
    },
    cmLayerDragOff: function () {
        if (
            DrawTool.contextMenuLayer.hasOwnProperty('feature') &&
            DrawTool.contextMenuLayer.feature.hasOwnProperty('properties') &&
            DrawTool.contextMenuLayer.feature.properties.annotation == true
        ) {
            var p = DrawTool.contextMenuLayer.feature.properties._
            $('#DrawToolAnnotation_' + p.file_id + '_' + p.id).off(
                'mousedown',
                DrawTool.cmLayerDown
            )
        } else if (typeof DrawTool.contextMenuLayer.off === 'function')
            DrawTool.contextMenuLayer.off('mousedown', DrawTool.cmLayerDown)
        Map_.map.off('mouseup', DrawTool.cmLayerUp)
        Map_.map.off('mousemove', DrawTool.cmLayerMove)

        DrawTool.contextMenuLayer.dragging = false
        Map_.map.dragging.enable()
    },
    cmLayerDown: function () {
        DrawTool.contextMenuLayer.dragging = true
        Map_.map.dragging.disable()
        Map_.rmNotNull(DrawTool.contextMenuLayers[0].selectionLayer)
    },
    cmLayerUp: function () {
        if (DrawTool.contextMenuLayer.dragging == true) {
            DrawTool.contextMenuLayer.dragging = false
            //So the layer itself can ignore the click to drag
            DrawTool.contextMenuLayer.justDragged = true
            Map_.map.dragging.enable()
            var radius =
                DrawTool.contextMenuLayers[0].selectionLayer.options.radius
            if (DrawTool.lastDragPoint) {
                DrawTool.contextMenuLayers[0].selectionLayer = L.circleMarker(
                    DrawTool.lastDragPoint,
                    {
                        color: 'white',
                        weight: 2,
                        fillOpacity: 0,
                        dashArray: '5 5',
                        radius: radius,
                    }
                )
                    .addTo(Map_.map)
                    .bringToBack()
            }
        }
    },
    cmLayerMove: function (e) {
        if (DrawTool.contextMenuLayer.dragging) {
            DrawTool.contextMenuLayer.setLatLng(e.latlng)
            DrawTool.lastDragPoint = e.latlng
        }
    },
}

export default Editing
