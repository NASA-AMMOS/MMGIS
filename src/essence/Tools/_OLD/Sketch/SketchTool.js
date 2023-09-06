import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Login from '../../Ancillary/Login/Login'
import turf from 'turf'

// prettier-ignore
var markup = [
  "<div id='sketchTool' class='column mmgisScrollbar' style='display: inline-flex; white-space: nowrap; justify-content: flex-start; padding: 5px;'>",
    "<div style='width: 120px;'>",
      "<div>",
        "<select id='sketchToolDrawingIn' class='ui dropdown short w100'>",
        "</select>",
      "</div>",
      "<div>",
        "<div class='mmgisHoverContents' style='display: inline-flex; width: 100%; color: #777; justify-content: space-around; margin: 5px 0px 5px 0px;'>",
          "<div id='sketchToolUndo' style='margin-top:4px;'><i class='mdi mdi-undo mdi-24px'></i></div>",
          "<div id='sketchToolRefresh' style='margin-top:4px;'><i class='mdi mdi-refresh mdi-24px'></i></div>",
          "<div id='sketchToolDownload' style='margin-top:4px;'><i class='mdi mdi-download mdi-24px'></i></div>",
        "</div>",
        "<div id='sketchToolDrawDelete' class='mmgisRadioBarVertical'>",
          "<div id='sketchToolDrawMode' class='active' style='position: relative;'><i class='mdi mdi-gesture mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Draw</span></div>",
          "<div id='sketchToolEditMode' style='position: relative;'><i class='mdi mdi-vector-polyline mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Edit</span></div>",
          "<div id='sketchToolEraseMode' style='position: relative;'><i class='mdi mdi-eraser-variant mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Erase</span></div>",
          "<div id='sketchToolDeleteMode' style='position: relative;'><i class='mdi mdi-delete mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Delete</span></div>",
        "</div>",
      "</div>",
    "</div>",
    "<div id='sketchToolEditPanel' style='width: 245px; height: 180px;'>",
      "<div style='padding: 5px 5px;'>",
        "<dl style='margin: 0;'>",
          "<dt style='position: relative;'>",
            "<div class='ui action inverted input'>",
              "<input id='sketchToolEditName' type='text' placeholder='Name' style='padding: 2px 0px 6px 0px; font-size: 18px; background-color: transparent; color: white;' value=''></input>",
            "</div>",
            "<div id='sketchToolEditColor' style='position: absolute; top: 0px; right: 0px; background-color: white; width: 20px; height: 20px; margin: 3px 0px 7px 5px; cursor: pointer; transition: opacity 0.5s;'></div>",
          "</dt>",
          "<dt>",
            "<div class='ui action inverted input' style='width: 100%;'>",
              "<textarea id='sketchToolEditDescription' class='mmgisScrollbar' rows='7' placeholder='Description' style='resize: none; width: 100%; background-color: transparent; color: white;'></textarea>",
            "</div>",
          "</dt>",
          "<div id='sketchToolEditSpecifics' style='display: none;'>",
            "<dt style='text-align: center;'>",
              "<div id='sketchToolEditBack' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 6px 3px 3px 0px;'>Send to Back</div>",
              "<div id='sketchToolEditFront' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 6px 0px 3px 3px;'>Send to Front</div>",
            "</dt>",
            "<dt style='text-align: center;'>",
              "<div id='sketchToolEditSave' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 0px auto 0px auto;'>Save Changes</div>",
            "</dt>",
          "</div>",
        "</dl>",
      "</div>",
    "</div>",
    "<div id='sketchToolDrawPanel' style='width: 30px; height: 180px;'>",
      "<div id='sketchToolShape' class='mmgisRadioBarVertical' style='padding: 0 0 6px 2px; border-bottom: 1px solid rgba(119,119,119,0.47)'>",
        "<div id='sketchToolShapePoint' title='Point'><i class='mdi mdi-square mdi-24px' style='position: absolute; transform: scale(0.4);'></i></div>",
        "<div id='sketchToolShapeLine' title='Line'><i class='mdi mdi-vector-line mdi-24px' style='position: absolute;'></i></div>",
        "<div id='sketchToolShapePoly' class='active' title='Polygon'><i class='mdi mdi-vector-square mdi-24px' style='position: absolute;'></i></div>",
      "</div>",
      "<div id='sketchToolBehindInFront' class='mmgisRadioBarVertical' style='padding: 5px 0 0 2px;'>",
        "<div id='sketchToolInFront' title='Over'><i class='mdi mdi-brightness-3 mdi-24px mdi-rotate-270' style='position: absolute;'></i></div>",
        "<div id='sketchToolThrough' title='Through' class='active'><i class='mdi mdi-window-minimize mdi-24px' style='position: absolute;'></i></div>",
        "<div id='sketchToolBehind' title='Under'><i class='mdi mdi-brightness-3 mdi-24px mdi-rotate-90' style='position: absolute;'></i></div>",
      "</div>",
    "</div>",
  "</div>"
  ];

/* //Fun code for rainbowy layers
  var hue = 0;
  setInterval( function() {
    d3.select( '.leaflet-pane.leaflet-tile-pane > .leaflet-layer:last-child' )
    .style( 'filter', 'hue-rotate(' + hue + 'deg) saturate(10)' );
    hue += 5;
    hue = hue % 360;
  }, 15);
  */

var SketchTool = {
    height: 192,
    width: 407,
    widths: [132, 377, 407],
    vars: null,
    drawVarDemtilesets: null,
    drawVarColorLegend: null,
    drawingPoly: null,
    drawingPolyPoints: null,
    drawing: null,
    everyN: null,
    everyNCounter: null,
    speState: null,
    speColor: null,
    speColorInitial: null,
    speName: null,
    speDesc: null,
    speGeojsonPolygonFile: null,
    allFiles: {},
    isDBfile: null,
    lastDBData: null,
    speGeoJSONPolys: null,
    removed: null,
    canErase: null,
    point_line_poly: null,
    draw_erase_edit_delete: null,
    previousCursor: null,
    maxNumberOfUndos: null,
    undoFeatures: null,
    undoFeaturesToDelete: null,
    siteDrawings: null,
    lastClickedFeature: null,
    lastClickedLayer: null,
    lastEditedGeometry: null,
    hasBeenEdited: false,
    closedColor: null,
    closedName: null,
    closedDesc: null,
    MMWebGISInterface: null,
    initialize: function () {
        //get tool variables
        this.vars = L_.getToolVars('sketch')

        this.drawVarDemtilesets = this.vars.demtilesets

        if (this.drawVarDemtilesets != null) {
            //Add relative path prefix
            for (d in this.drawVarDemtilesets) {
                this.drawVarDemtilesets[
                    '../../../Missions/' + L_.mission + '/' + d
                ] = this.drawVarDemtilesets[d]
                delete this.drawVarDemtilesets[d]
            }
        }

        this.drawVarColorLegend = this.vars.colorlegend

        this.colorIndexInitial = -1
        //Get initial active color
        for (i in this.drawVarColorLegend) {
            if (
                this.drawVarColorLegend[i].hasOwnProperty('active') &&
                this.drawVarColorLegend[i].active == true
            ) {
                this.speColorInitial = this.drawVarColorLegend[i].color
                this.colorIndexInitial = i
            }
        }
        if (this.speColorInitial == null && this.drawVarColorLegend[0])
            this.speColorInitial = this.drawVarColorLegend[0].color

        markup = markup.join('\n')
    },
    /**
    * @param {string} domId - optional
      @param {number} baseWidth - optional
    */
    make: function (domId, baseWidth) {
        if (baseWidth !== undefined) {
            this.width += baseWidth
            for (var i = 0; i < this.widths.length; i++) {
                this.widths[i] += baseWidth
            }
        }

        this.drawingPolyPoints = ''
        this.drawing = false
        //Place a polygon point everyN mousemove events
        this.everyN = 4
        this.everyNCounter = 0
        this.speState = 'through'
        this.speColor = this.closedColor || this.speColorInitial
        this.speName = this.closedName || ''
        this.speDesc = this.closedDesc || ''
        this.speGeojsonPolygonFile =
            'Missions/' +
            L_.mission +
            '/Drawn/' +
            L_.site +
            '_speDrawings.geojson'
        this.isDBfile = false
        //Slightly different functions if it's the end of SVGPolyEraser's life
        this.removed = false
        //Only let user erase once
        this.canErase = false
        //can be "point", "line", "poly"
        this.point_line_poly = 'point'
        //can be "draw", "erase", or "delete"
        this.draw_erase_delete = 'draw'
        //save previous map cursor to return to it when tool closes
        this.previousCursor = d3.select('#map').style('cursor')

        this.maxNumberOfUndos = 20
        //These are multidimensional arrays. Arrays of the groups of last changed features.
        //[[add,add,add],[add,add,add],[null],[add,add]]
        this.undoFeatures = []
        //[[del,del,null],[del,del,del],[del],[del,null]]
        this.undoFeaturesToDelete = []

        this.siteDrawings = L_.site + ' Drawings'

        if (L_.site == '') this.siteDrawings = 'Drawings'

        if (Map_.map.hasLayer(L_.layers.layer[SketchTool.siteDrawings])) {
            Map_.map.removeLayer(L_.layers.layer[SketchTool.siteDrawings])
        }

        this.MMWebGISInterface = new interfaceWithMMWebGIS(domId)
    },
    destroy: function (domId) {
        d3.select(domId).empty()
        if (this.MMWebGISInterface !== null) {
            SketchTool.removed = true
            SketchTool.closedColor = SketchTool.speColor
            SketchTool.closedName = $('#sketchToolEditName').val()
            SketchTool.closedDesc = $('#sketchToolEditDescription').val()
            this.MMWebGISInterface.separateFromMMWebGIS()
            for (f in SketchTool.allFiles) {
                reloadSPEPolys(f, false)
            }
        }
    },
    setDrawingFile: function (file, isDB) {
        SketchTool.isDBfile = isDB
        SketchTool.speGeojsonPolygonFile = file
        if (!SketchTool.allFiles.hasOwnProperty(file))
            SketchTool.allFiles[file] = isDB

        for (f in SketchTool.allFiles) {
            var currentFile = f == SketchTool.speGeojsonPolygonFile
            var currentUseOpacity = true
            if (currentFile && SketchTool.draw_erase_edit_delete == 'edit') {
                currentUseOpacity = false
            }
            reloadSPEPolys(f, !currentFile, currentUseOpacity)
        }
    },
}

//Interfacing with MMWebGIS UI
function interfaceWithMMWebGIS(domId) {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }

    var elemId = '#tools'
    if (typeof domId === 'string') elemId = domId
    var tools = d3.select(elemId)
    tools.selectAll('*').remove()
    tools = tools
        .append('div')
        .attr('class', 'ui padded grid mmgisScrollbar')
        .style('height', '100%')
    tools.html(markup)

    //make drawing in file dropdown
    SketchTool.allFiles = []

    d3.select('#sketchToolDrawingIn')
        .append('option')
        .attr('value', SketchTool.speGeojsonPolygonFile)
        .attr('isDB', false)
        .html(SketchTool.siteDrawings + ' [SITE]')
    SketchTool.allFiles[SketchTool.speGeojsonPolygonFile] = false
    //only show logged in user's added files
    for (l in L_.addedfiles) {
        if (L_.addedfiles[l]['username'] == Login.username) {
            d3.select('#sketchToolDrawingIn')
                .append('option')
                .attr('value', l)
                .attr('isDB', true)
                .html(
                    L_.addedfiles[l]['name'] +
                        ' [' +
                        L_.addedfiles[l]['username'] +
                        ']'
                )
            SketchTool.allFiles[l] = true
        }
    }

    $('#sketchToolDrawingIn').dropdown({
        onChange: function (val) {
            var optionSelected = $('option:selected', this)
            SketchTool.isDBfile = optionSelected.attr('isDB') == 'true'
            SketchTool.speGeojsonPolygonFile = val

            for (f in SketchTool.allFiles) {
                var currentFile = f == SketchTool.speGeojsonPolygonFile
                var currentUseOpacity = true
                if (
                    currentFile &&
                    SketchTool.draw_erase_edit_delete == 'edit'
                ) {
                    currentUseOpacity = false
                }
                reloadSPEPolys(f, !currentFile, currentUseOpacity)
            }
        },
        direction: 'upward',
    })

    $('.mmgisRadioBarVertical#sketchToolShape div').click(function () {
        $('.mmgisRadioBarVertical#sketchToolShape div').removeClass('active')
        $(this).addClass('active')
    })
    $('.mmgisRadioBarVertical#sketchToolDrawDelete div').click(function () {
        $('.mmgisRadioBarVertical#sketchToolDrawDelete div').removeClass(
            'active'
        )
        $(this).addClass('active')
    })
    $('.mmgisRadioBarVertical#sketchToolBehindInFront div').click(function () {
        $('.mmgisRadioBarVertical#sketchToolBehindInFront div').removeClass(
            'active'
        )
        $(this).addClass('active')
    })
    $('.mmgisColorBar#sketchToolColorBar button').click(function () {
        $(this).siblings().removeClass('active')
        $(this).addClass('active')
    })

    //Turn site drawing layer on if it's off
    if (L_.layers.on[SketchTool.siteDrawings] == false) {
        L_.toggleLayer(L_.layers.data[SketchTool.siteDrawings])
    }
    //Intializations
    var optionValue

    optionValue = $('#sketchTool #sketchToolBehindInFront .active').attr('id')
    if (optionValue == 'sketchToolBehind') SketchTool.speState = 'under'
    else if (optionValue == 'sketchToolThrough') SketchTool.speState = 'through'
    else speState = 'infront'

    optionValue = $('#sketchTool #sketchToolShape .active').attr('id')
    if (optionValue == 'sketchToolShapePoint') {
        SketchTool.point_line_poly = 'point'
        $('#sketchTool #sketchToolBehindInFront').addClass('off')
    } else if (optionValue == 'sketchToolShapeLine') {
        SketchTool.point_line_poly = 'line'
        $('#sketchTool #sketchToolBehindInFront').addClass('off')
    } else {
        SketchTool.point_line_poly = 'poly'
        $('#sketchTool #sketchToolBehindInFront').removeClass('off')
    }

    optionValue = $('#sketchTool #sketchToolDrawDelete .active').attr('id')
    if (optionValue == 'sketchToolDrawMode') {
        SketchTool.draw_erase_edit_delete = 'draw'
        d3.select('#map').style('cursor', 'default')
        for (f in SketchTool.allFiles) {
            reloadSPEPolys(f, true)
        }
        Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
    } else if (optionValue == 'sketchToolEraseMode') {
        SketchTool.draw_erase_edit_delete = 'erase'
        d3.select('#map').style('cursor', 'default')
        for (f in SketchTool.allFiles) {
            reloadSPEPolys(f, true)
        }
        Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
    } else if (optionValue == 'sketchToolEditMode') {
        SketchTool.draw_erase_edit_delete = 'edit'
        d3.select('#map').style('cursor', 'default')
        for (f in SketchTool.allFiles) {
            reloadSPEPolys(f, false)
        }
        Map_.map.off('click', speOnClick).off('mousemove', speOnMove)
    } else {
        SketchTool.draw_erase_edit_delete = 'delete'
        d3.select('#map').style('cursor', 'alias')
        for (f in SketchTool.allFiles) {
            reloadSPEPolys(f, true)
        }
        Map_.map.off('click', speOnClick).off('mousemove', speOnMove)
    }

    if (SketchTool.closedColor !== null) {
        $('#sketchToolEditColor').css('background-color', SketchTool.speColor)
        $('#sketchToolEditName').val(SketchTool.closedName)
        $('#sketchToolEditDescription').val(SketchTool.closedDesc)
    } else {
        SketchTool.speColor = SketchTool.speColorInitial
        $('#sketchToolEditColor').css('background-color', SketchTool.speColor)

        if (SketchTool.colorIndexInitial !== -1) {
            $('#sketchToolEditName').val(
                SketchTool.drawVarColorLegend[SketchTool.colorIndexInitial].name
            )
            $('#sketchToolEditDescription').val(
                SketchTool.drawVarColorLegend[SketchTool.colorIndexInitial]
                    .value
            )
        }
    }

    //update input name
    optionValue = $('#sketchTool #sketchToolColorBar .active p').text()
    $('#sketchTool #sketchToolInputName').val(optionValue)

    //update input desc
    optionValue = $('#sketchTool #sketchToolColorBar .active').val()
    $('#sketchTool #sketchToolInputDescription').val(optionValue)

    ///Popuply things
    //function popupEvent( e ) {

    var nameChanged = false
    var descriptionChanged = false
    var colorChanged = false

    var colorOpen = false
    var colorTrans = false

    $('#sketchToolEditColor').click(function () {
        if (!colorTrans) {
            colorOpen = !colorOpen
            if (colorOpen) {
                if (SketchTool.drawVarColorLegend != null) {
                    var width =
                        ($('#sketchToolEditColor').parent().width() - 30) /
                        SketchTool.drawVarColorLegend.length

                    colorTrans = true
                    $('#sketchToolEditName').fadeOut(400, 'swing', function () {
                        $('#sketchToolEditName').hide()
                        $('#sketchToolEditColors').remove()
                        $('#sketchToolEditColor')
                            .parent()
                            .append(
                                "<div id='sketchToolEditColors' style='display: inline-flex; opacity: 0;'></div>"
                            )
                        for (
                            var i = 0;
                            i < SketchTool.drawVarColorLegend.length;
                            i++
                        ) {
                            $('#sketchToolEditColors').append(
                                "<div id='sketchToolEditColors_" +
                                    i +
                                    "' style='background-color: " +
                                    SketchTool.drawVarColorLegend[i].color +
                                    '; width: ' +
                                    width +
                                    "px; height: 20px; margin: 2.6px 0px 6px 0px; cursor: pointer; opacity: 0.8;'></div>"
                            )
                            $('#sketchToolEditColors_' + i).click(
                                (function (i) {
                                    return function () {
                                        if (
                                            SketchTool.draw_erase_edit_delete ==
                                            'edit'
                                        ) {
                                            var defaultColor =
                                                SketchTool.lastClickedFeature
                                                    .properties.fill
                                            if (
                                                F_.rgb2hex(
                                                    $(this).css(
                                                        'background-color'
                                                    )
                                                ) != defaultColor
                                            ) {
                                                $('#sketchToolEditSave').css({
                                                    'border-color': '#33cc66',
                                                    color: '#26d962',
                                                })
                                                colorChanged = true
                                            } else {
                                                colorChanged = false
                                                resetSaveColor()
                                            }
                                        } else {
                                            SketchTool.speColor = F_.rgb2hex(
                                                $(this).css('background-color')
                                            )
                                        }
                                        $('#sketchToolEditColor').css({
                                            'background-color':
                                                $(this).css('background-color'),
                                        })
                                        $('#sketchToolEditName').val(
                                            SketchTool.drawVarColorLegend[i]
                                                .name
                                        )
                                        $('#sketchToolEditDescription').val(
                                            SketchTool.drawVarColorLegend[i]
                                                .value
                                        )
                                        $('#sketchToolEditColor').click()
                                        CursorInfo.hide()
                                    }
                                })(i)
                            )
                            $('#sketchToolEditColors_' + i).mouseenter(
                                (function (i) {
                                    return function () {
                                        CursorInfo.update(
                                            SketchTool.drawVarColorLegend[i]
                                                .name
                                        )
                                    }
                                })(i)
                            )
                            $('#sketchToolEditColors_' + i).mouseleave(
                                (function (i) {
                                    return function () {
                                        CursorInfo.hide(true)
                                    }
                                })(i)
                            )
                            $('#sketchToolEditColors_' + i).hover(
                                function () {
                                    $(this).css({ opacity: '1' })
                                },
                                function () {
                                    $(this).css({ opacity: '0.8' })
                                }
                            )
                        }
                        $('#sketchToolEditColors').animate(
                            { opacity: '1' },
                            400,
                            function () {
                                colorTrans = false
                            }
                        )
                    })
                }
            } else {
                colorTrans = true
                $('#sketchToolEditColors').fadeOut(400, 'swing', function () {
                    $('#sketchToolEditColors').remove()
                    $('#sketchToolEditName').fadeIn(400, 'swing', function () {
                        colorTrans = false
                    })
                })
            }
        }
    })
    $('#sketchToolEditColor').hover(
        function () {
            $(this).css({ opacity: '0.7' })
        },
        function () {
            $(this).css({ opacity: '1' })
        }
    )

    $('#sketchToolEditBack').click(function () {
        writetoPolygonGeoJSON('move', SketchTool.lastClickedFeature, 'back')
    })

    $('#sketchToolEditFront').click(function () {
        writetoPolygonGeoJSON('move', SketchTool.lastClickedFeature, 'front')
    })

    $('#sketchToolEditName').on('input', function () {
        if (SketchTool.draw_erase_edit_delete == 'edit') {
            var defaultName = SketchTool.lastClickedFeature.properties.name
            if ($(this).val() != defaultName) {
                $('#sketchToolEditSave').css({
                    'border-color': '#33cc66',
                    color: '#26d962',
                })
                nameChanged = true
            } else {
                nameChanged = false
                resetSaveColor()
            }
        }
    })
    $('#sketchToolEditDescription').on('input', function () {
        if (SketchTool.draw_erase_edit_delete == 'edit') {
            var defaultDescription =
                SketchTool.lastClickedFeature.properties.description
            if ($(this).val() != defaultDescription) {
                $('#sketchToolEditSave').css({
                    'border-color': '#33cc66',
                    color: '#26d962',
                })
                descriptionChanged = true
            } else {
                descriptionChanged = false
                resetSaveColor()
            }
        }
    })
    function resetSaveColor() {
        if (
            !(
                nameChanged ||
                descriptionChanged ||
                colorChanged ||
                SketchTool.hasBeenEdited
            )
        ) {
            $('#sketchToolEditSave').css({
                'border-color': '#666',
                color: '#999',
            })
        }
    }

    $('#sketchToolEditSave').click(function () {
        if (
            nameChanged ||
            descriptionChanged ||
            colorChanged ||
            SketchTool.hasBeenEdited
        ) {
            editSave(SketchTool.lastClickedFeature)
        }
    })

    SketchTool.updateEditPanel = function () {
        $('#sketchToolEditName').prop(
            'value',
            SketchTool.lastClickedFeature.properties.name
        )
        $('#sketchToolEditColor').css(
            'background-color',
            SketchTool.lastClickedFeature.properties.fill
        )
        $('#sketchToolEditDescription').prop(
            'value',
            SketchTool.lastClickedFeature.properties.description
        )
    }

    //Events
    function _dt00() {
        SketchTool.point_line_poly = 'point'
        $('#sketchTool #sketchToolBehindInFront').addClass('off')
    }
    $('#sketchTool  #sketchToolShapePoint').click(_dt00)

    function _dt01() {
        SketchTool.point_line_poly = 'line'
        $('#sketchTool #sketchToolBehindInFront').addClass('off')
    }
    $('#sketchTool  #sketchToolShapeLine').click(_dt01)

    function _dt02() {
        SketchTool.point_line_poly = 'poly'
        $('#sketchTool #sketchToolBehindInFront').removeClass('off')
    }
    $('#sketchTool  #sketchToolShapePoly').click(_dt02)

    //Draw Erase Edit Delete
    function _dt0() {
        if (SketchTool.draw_erase_edit_delete != 'draw') {
            //if switching mode
            var draw_erase_deleteOLD = SketchTool.draw_erase_edit_delete
            SketchTool.draw_erase_edit_delete = 'draw'
            d3.select('#map').style('cursor', 'default')
            UserInterface_.setToolWidth(SketchTool.widths[2])
            $('#sketchTool #sketchToolEditPanel').css('display', 'block')
            setTimeout(function () {
                $('#sketchTool #sketchToolDrawPanel').css('display', 'block')
            }, 400)
            $('#sketchTool #sketchToolEditSpecifics').css('display', 'none')
            $('#sketchTool #sketchToolEditDescription').prop('rows', '7')
            if (draw_erase_deleteOLD != 'erase') {
                reloadSPEPolys(SketchTool.speGeojsonPolygonFile, true)
                Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
            }
            SketchTool.speName = ''
            SketchTool.speDesc = ''
            $('#sketchTool #sketchToolEditName').prop(
                'value',
                SketchTool.speName
            )
            $('#sketchTool #sketchToolEditDescription').prop(
                'value',
                SketchTool.speDesc
            )

            $('#sketchTool #sketchToolShape').removeClass('disabled')
            $('#sketchTool #sketchToolBehindInFront').removeClass('disabled')
            $('#sketchTool #sketchToolShape').removeClass('off')
            if (SketchTool.point_line_poly == 'poly')
                $('#sketchTool #sketchToolBehindInFront').removeClass('off')
        }
    }
    $('#sketchTool  #sketchToolDrawMode').click(_dt0)

    function _dt1() {
        if (SketchTool.draw_erase_edit_delete != 'erase') {
            //if switching mode
            var draw_erase_deleteOLD = SketchTool.draw_erase_edit_delete
            SketchTool.draw_erase_edit_delete = 'erase'
            d3.select('#map').style('cursor', 'default')
            UserInterface_.setToolWidth(SketchTool.widths[0])
            $('#sketchTool #sketchToolEditPanel').css('display', 'none')
            $('#sketchTool #sketchToolDrawPanel').css('display', 'none')
            if (draw_erase_deleteOLD != 'draw') {
                reloadSPEPolys(SketchTool.speGeojsonPolygonFile, true)
                Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
            }

            $('#sketchTool #sketchToolShapePoint').removeClass('active')
            $('#sketchTool #sketchToolShapeLine').removeClass('active')
            $('#sketchTool #sketchToolShapePoly').addClass('active')
            $('#sketchTool #sketchToolShape').removeClass('off')
            $('#sketchTool #sketchToolShape').addClass('disabled')
            SketchTool.point_line_poly = 'poly'

            $('#sketchTool #sketchToolBehind').removeClass('active')
            $('#sketchTool #sketchToolThrough').addClass('active')
            $('#sketchTool #sketchToolInFront').removeClass('active')
            $('#sketchTool #sketchToolBehindInFront').removeClass('off')
            $('#sketchTool #sketchToolBehindInFront').addClass('disabled')
            SketchTool.speState = 'through'
        }
    }
    $('#sketchTool  #sketchToolEraseMode').click(_dt1)

    function _dt11() {
        if (SketchTool.draw_erase_edit_delete != 'edit') {
            //if switching mode
            SketchTool.draw_erase_edit_delete = 'edit'
            d3.select('#map').style('cursor', 'default')
            UserInterface_.setToolWidth(SketchTool.widths[0])
            $('#sketchTool #sketchToolEditPanel').css('display', 'none')
            $('#sketchTool #sketchToolDrawPanel').css('display', 'none')
            $('#sketchTool #sketchToolEditSpecifics').css('display', 'inherit')
            $('#sketchTool #sketchToolEditDescription').prop('rows', '4')
            reloadSPEPolys(SketchTool.speGeojsonPolygonFile, false, false)
            Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

            SketchTool.speName = ''
            SketchTool.speDesc = ''
            $('#sketchTool #sketchToolEditName').prop(
                'value',
                SketchTool.speName
            )
            $('#sketchTool #sketchToolEditDescription').prop(
                'value',
                SketchTool.speDesc
            )

            $('#sketchTool #sketchToolShape').addClass('off')
            $('#sketchTool #sketchToolBehindInFront').addClass('off')
        }
    }
    $('#sketchTool  #sketchToolEditMode').click(_dt11)

    function _dt2() {
        if (SketchTool.draw_erase_edit_delete != 'delete') {
            //if switching mode
            SketchTool.draw_erase_edit_delete = 'delete'
            d3.select('#map').style('cursor', 'alias')
            UserInterface_.setToolWidth(SketchTool.widths[0])
            $('#sketchTool #sketchToolEditPanel').css('display', 'none')
            $('#sketchTool #sketchToolDrawPanel').css('display', 'none')
            reloadSPEPolys(SketchTool.speGeojsonPolygonFile, false)
            Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

            $('#sketchTool #sketchToolShape').addClass('off')
            $('#sketchTool #sketchToolBehindInFront').addClass('off')
        }
    }
    $('#sketchTool  #sketchToolDeleteMode').click(_dt2)

    function _dt3() {
        SketchTool.speColor = F_.rgb2hex($(this).css('background-color'))
        //update input name
        $('#sketchTool #sketchToolInputName').val($(this).find('p').text())

        //update input desc
        optionValue = $('#sketchTool #sketchToolColorBar .active').val()
        $('#sketchTool #sketchToolInputDescription').val(optionValue)
    }
    $('#sketchTool #sketchToolColorBar button').click(_dt3)

    function _dt4() {
        SketchTool.speState = 'under'
    }
    $('#sketchTool  #sketchToolBehind').click(_dt4)

    function _dt5() {
        SketchTool.speState = 'through'
    }
    $('#sketchTool  #sketchToolThrough').click(_dt5)

    function _dt50() {
        SketchTool.speState = 'infront'
    }
    $('#sketchTool  #sketchToolInFront').click(_dt50)

    function _dt6() {
        undo()
    }
    $('#sketchTool  #sketchToolUndo').click(_dt6)

    function _dt60() {
        for (f in SketchTool.allFiles) {
            var currentFile = f == SketchTool.speGeojsonPolygonFile
            var currentUseOpacity = true
            if (currentFile && SketchTool.draw_erase_edit_delete == 'edit') {
                currentUseOpacity = false
            }
            reloadSPEPolys(f, !currentFile, currentUseOpacity)
        }
    }
    $('#sketchTool  #sketchToolRefresh').click(_dt60)

    function _dt7() {
        if (SketchTool.isDBfile) {
            var w = window.open()
            w.document.write(JSON.stringify(SketchTool.lastDBData))
        } else {
            window.open(
                SketchTool.speGeojsonPolygonFile +
                    '?nocache=' +
                    new Date().getTime()
            )
        }
    }
    $('#sketchTool  #sketchToolDownload').click(_dt7)

    //description more expand to textarea
    $('#sketchTool #sketchToolInputDescriptionMore').css({
        'border-bottom-right-radius': '2px',
        'border-top-right-radius': '2px',
        margin: '8px 8px 8px 0px',
        padding: '0px 0px 0px 0px',
    })
    function _dt8() {
        var descriptionContent = $(
            '#sketchTool #sketchToolInputDescription'
        ).val()
    }
    $('#sketchTool #sketchToolInputDescriptionMore').click(_dt8)

    function separateFromMMWebGIS() {
        Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

        d3.select('#map').style('cursor', SketchTool.previousCursor)
    }
}

//This is often used merely to add and remove pointerevents
//It'd be nice to have a function for just adding/removing pointer events for a specific layer
function reloadSPEPolys(geojsonFile, noPointerEvents, useOpacity) {
    var pointerEvents = 'none'
    SketchTool.hasBeenEdited = false
    $('#sketchToolEditSave').css({ 'border-color': '#666', color: '#999' })
    SketchTool.lastEditedGeometry = null

    if (!noPointerEvents) pointerEvents = null
    if (SketchTool.draw_erase_edit_delete == 'delete' || SketchTool.removed)
        pointerEvents = null
    if (typeof useOpacity == 'undefined') {
        useOpacity = true
    }
    var isDB = SketchTool.isDBfile
    if (SketchTool.allFiles.hasOwnProperty(geojsonFile)) {
        isDB = SketchTool.allFiles[geojsonFile]
    }

    if (isDB) {
        $.ajax({
            type: 'POST',
            url: 'scripts/essence/Tools/FileManager/getfiledata.php',
            data: {
                master: L_.masterdb,
                mission: L_.mission,
                filename: geojsonFile,
            },
            success: function (data) {
                if (data.length < 3) {
                    CursorInfo.update('No file data found.', 2500, true)
                    return
                }
                //fine
                data = JSON.parse(JSON.parse(data))
                if (data.hasOwnProperty('Features')) {
                    data.features = data.Features
                    delete data.Features
                }
                SketchTool.lastDBData = data

                if (Map_.map.hasLayer(L_.addedfiles[geojsonFile]['layer'])) {
                    Map_.map.removeLayer(L_.addedfiles[geojsonFile]['layer'])
                }

                //sort data so point features are always on top of lines and lines always on top of polygons
                F_.sortGeoJSONFeatures(data)

                SketchTool.speGeoJSONPolys = data.features

                L_.addedfiles[geojsonFile]['layer'] = L.geoJson(data, {
                    style: function (feature) {
                        var fopacity = feature.properties.opacity || 1
                        var ffill = feature.properties.fill || 'black'
                        var ffillOpacity = feature.properties.fillOpacity || 1
                        var fstroke = feature.properties.stroke || 'black'
                        var fweight = feature.properties.weight || 3

                        return {
                            color: 'black',
                            radius: 6,
                            opacity: useOpacity ? fopacity : 1,
                            fillColor: ffill,
                            fillOpacity: useOpacity ? ffillOpacity : 1,
                            color: fstroke,
                            weight: fweight,
                            className: 'spePolygonLayer',
                            pointerEvents: pointerEvents,
                        }
                    },
                    pointToLayer: function (feature, latlng) {
                        return L.circleMarker(latlng)
                    },
                    onEachFeature: function (feature, layer) {
                        if (SketchTool.removed) {
                            var desc = feature.properties.description
                            if (desc) desc = desc.replace(/\n/g, '<br />')
                            var list =
                                '<dl><dt><b>' +
                                feature.properties.name +
                                '</b></dt><dt>' +
                                desc +
                                "</dt><hr style='border: 1px solid #666; margin-bottom: 2px;'><dt style='color: #888; font-size: 14px;'><i>" +
                                L_.addedfiles[geojsonFile]['name'] +
                                "</i></dt><dt style='color: #888; font-size: 12px; text-align: right;'>–<i>" +
                                L_.addedfiles[geojsonFile]['username'] +
                                '</i></dt></dl>'
                            layer.bindPopup(list)
                        } else if (
                            SketchTool.draw_erase_edit_delete == 'edit'
                        ) {
                            layer.on('click', function () {
                                UserInterface_.setToolWidth(
                                    SketchTool.widths[1]
                                )
                                $('#sketchTool #sketchToolEditPanel').css(
                                    'display',
                                    'block'
                                )

                                if (!layer.hasBeenEdited) {
                                    SketchTool.hasBeenEdited = false
                                    $('#sketchToolEditSave').css({
                                        'border-color': '#666',
                                        color: '#999',
                                    })
                                } else {
                                    SketchTool.hasBeenEdited = true
                                    $('#sketchToolEditSave').css({
                                        'border-color': '#33cc66',
                                        color: '#26d962',
                                    })
                                }
                                SketchTool.lastEditedGeometry =
                                    layer.toGeoJSON().geometry
                                SketchTool.lastClickedFeature = feature
                                if (SketchTool.lastClickedLayer)
                                    SketchTool.lastClickedLayer.disableEdit()
                                SketchTool.lastClickedLayer = layer
                                SketchTool.lastClickedLayer.enableEdit()
                                SketchTool.updateEditPanel()

                                L_.layers.layer[
                                    SketchTool.siteDrawings
                                ].eachLayer(function (l) {
                                    L_.layers.layer[
                                        SketchTool.siteDrawings
                                    ].resetStyle(l)
                                    if (l.hasBeenEdited) {
                                        l.setStyle({
                                            color: 'red',
                                            weight: 6,
                                        })
                                    }
                                })
                                layer.setStyle({
                                    color: 'white',
                                    weight: 6,
                                })
                            })
                            layer.on('editable:editing', function (e) {
                                SketchTool.hasBeenEdited = true
                                layer.hasBeenEdited = true
                                $('#sketchToolEditSave').css({
                                    'border-color': '#33cc66',
                                    color: '#26d962',
                                })
                                SketchTool.lastEditedGeometry =
                                    layer.toGeoJSON().geometry
                                layer.setStyle({ color: 'blue', weight: 4 })
                            })
                            layer.on('mouseover', function (e) {
                                this.setStyle({ color: 'white', weight: 6 })
                            })
                            layer.on('mouseout', function (e) {
                                L_.addedfiles[geojsonFile]['layer'].eachLayer(
                                    function (l) {
                                        L_.addedfiles[geojsonFile][
                                            'layer'
                                        ].resetStyle(l)
                                        if (l.hasBeenEdited) {
                                            if (
                                                l != SketchTool.lastClickedLayer
                                            ) {
                                                l.setStyle({
                                                    color: 'red',
                                                    weight: 6,
                                                })
                                            } else if (
                                                l == SketchTool.lastClickedLayer
                                            ) {
                                                l.setStyle({
                                                    color: 'blue',
                                                    weight: 4,
                                                })
                                            }
                                        }
                                    }
                                )
                            })
                        } else if (
                            SketchTool.draw_erase_edit_delete == 'delete'
                        ) {
                            layer.on('click', function () {
                                deleteFeature(feature)
                            })
                        }
                    },
                })
                L_.addedfiles[geojsonFile]['layer'].addTo(Map_.map)
                if (!SketchTool.removed) {
                    Globe_.removeVectorTileLayer('addedfiles_' + geojsonFile)
                    Globe_.addVectorTileLayer({
                        id: 'addedfiles_' + geojsonFile,
                        layers: L_.addedfiles[geojsonFile]['layer']._layers,
                    })
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                L_.addedfiles[geojsonFile] = null
                CursorInfo.update('Failed to get file data.', 2500, true)
            },
        })
    } else {
        $.getJSON(geojsonFile, { _: new Date().getTime() }, function (data) {
            if (Map_.map.hasLayer(L_.layers.layer[SketchTool.siteDrawings])) {
                Map_.map.removeLayer(L_.layers.layer[SketchTool.siteDrawings])
            }
            //sort data so point features are always on top of lines and lines always on top of polygons
            F_.sortGeoJSONFeatures(data)

            SketchTool.speGeoJSONPolys = data.features
            //var pointerEvents = null; if(noPointerEvents) pointerEvents = "none";
            L_.layers.layer[SketchTool.siteDrawings] = L.geoJson(data, {
                style: function (feature) {
                    return {
                        color: 'black',
                        radius: 6,
                        opacity: useOpacity ? feature.properties.opacity : 1,
                        fillColor: feature.properties.fill,
                        fillOpacity: 0.3 /*(useOpacity) ? feature.properties.fillOpacity : 1*/,
                        color: feature.properties.stroke,
                        weight: feature.properties.weight,
                        className: 'spePolygonLayer',
                        pointerEvents: pointerEvents,
                    }
                },
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng)
                },
                onEachFeature: function (feature, layer) {
                    if (SketchTool.removed) {
                        var desc = feature.properties.description
                        if (desc) desc = desc.replace(/\n/g, '<br />')
                        var list =
                            '<dl><dt><b>' +
                            feature.properties.name +
                            '</b></dt><dt>' +
                            desc +
                            '</dt></dl>'
                        layer.bindPopup(list)
                    } else if (SketchTool.draw_erase_edit_delete == 'edit') {
                        layer.on('click', function () {
                            UserInterface_.setToolWidth(SketchTool.widths[1])
                            $('#sketchTool #sketchToolEditPanel').css(
                                'display',
                                'block'
                            )

                            if (!layer.hasBeenEdited) {
                                SketchTool.hasBeenEdited = false
                                $('#sketchToolEditSave').css({
                                    'border-color': '#666',
                                    color: '#999',
                                })
                            } else {
                                SketchTool.hasBeenEdited = true
                                $('#sketchToolEditSave').css({
                                    'border-color': '#33cc66',
                                    color: '#26d962',
                                })
                            }
                            SketchTool.lastEditedGeometry =
                                layer.toGeoJSON().geometry
                            SketchTool.lastClickedFeature = feature
                            if (SketchTool.lastClickedLayer)
                                SketchTool.lastClickedLayer.disableEdit()
                            SketchTool.lastClickedLayer = layer
                            SketchTool.lastClickedLayer.enableEdit()
                            SketchTool.updateEditPanel()

                            L_.layers.layer[SketchTool.siteDrawings].eachLayer(
                                function (l) {
                                    L_.layers.layer[
                                        SketchTool.siteDrawings
                                    ].resetStyle(l)
                                    if (l.hasBeenEdited) {
                                        l.setStyle({
                                            color: 'red',
                                            weight: 6,
                                        })
                                    }
                                }
                            )
                            layer.setStyle({ color: 'white', weight: 6 })
                        })
                        layer.on('editable:editing', function (e) {
                            SketchTool.hasBeenEdited = true
                            layer.hasBeenEdited = true
                            $('#sketchToolEditSave').css({
                                'border-color': '#33cc66',
                                color: '#26d962',
                            })
                            SketchTool.lastEditedGeometry =
                                layer.toGeoJSON().geometry
                            layer.setStyle({ color: 'blue', weight: 4 })
                        })
                        layer.on('mouseover', function (e) {
                            this.setStyle({ color: 'white', weight: 6 })
                        })
                        layer.on('mouseout', function (e) {
                            L_.layers.layer[SketchTool.siteDrawings].eachLayer(
                                function (l) {
                                    L_.layers.layer[
                                        SketchTool.siteDrawings
                                    ].resetStyle(l)
                                    if (l.hasBeenEdited) {
                                        if (l != SketchTool.lastClickedLayer) {
                                            l.setStyle({
                                                color: 'red',
                                                weight: 6,
                                            })
                                        } else if (
                                            l == SketchTool.lastClickedLayer
                                        ) {
                                            l.setStyle({
                                                color: 'blue',
                                                weight: 4,
                                            })
                                        }
                                    }
                                }
                            )
                        })
                    } else if (SketchTool.draw_erase_edit_delete == 'delete') {
                        layer.on('click', function () {
                            deleteFeature(feature)
                        })
                    }
                },
            })

            if (L_.layers.on[SketchTool.siteDrawings] == true) {
                L_.layers.layer[SketchTool.siteDrawings].addTo(Map_.map)
                if (!SketchTool.removed) {
                    Globe_.removeVectorTileLayer('drawtool_sitedrawings')
                    Globe_.addVectorTileLayer({
                        id: 'drawtool_sitedrawings',
                        layers: L_.layers.layer[SketchTool.siteDrawings]
                            ._layers,
                    })
                }
            }
        })
    }
}

function resetLayerStyles() {
    for (f in SketchTool.allFiles) {
    }
}

//Only called upon save in edit popup. So just safely read the values from that box.
function editSave(feature) {
    var editedFeature = F_.clone(feature)
    editedFeature.properties.name = $('#sketchToolEditName').val()
    editedFeature.properties.description = $('#sketchToolEditDescription').val()
    if (SketchTool.lastEditedGeometry != null)
        editedFeature.geometry = SketchTool.lastEditedGeometry
    var newColor = F_.rgb2hex($('#sketchToolEditColor').css('background-color'))
    editedFeature.properties.fill = newColor
    if (editedFeature.geometry.type.toLowerCase() == 'multilinestring') {
        editedFeature.properties.stroke = newColor
    }
    SketchTool.lastEditedGeometry = null
    editedFeature = F_.geojsonAddSpatialProperties(editedFeature)
    writetoPolygonGeoJSON('replace', feature, editedFeature)
}

function speOnClick(e) {
    switch (SketchTool.point_line_poly) {
        case 'point':
            SketchTool.drawingPolyPoints = e.latlng.lat + ',' + e.latlng.lng
            SketchTool.speName = $('#sketchTool #sketchToolEditName').val()
            SketchTool.speDesc = $(
                '#sketchTool #sketchToolEditDescription'
            ).val()
            var drawnPolygon = drawingPolyPointsToGeoJSON(
                SketchTool.drawingPolyPoints,
                'Point',
                SketchTool.speColor,
                SketchTool.speName,
                SketchTool.speDesc,
                function (geojson) {
                    noEraseDraw(geojson)
                }
            )
            break
        case 'line':
            SketchTool.drawing = !SketchTool.drawing

            if (SketchTool.drawing) {
                //just entrered into draw state
                SketchTool.drawingPolyPoints = e.latlng.lat + ',' + e.latlng.lng
            } else {
                //exit draw state so finalize
                if (SketchTool.drawingPoly != undefined) {
                    Map_.map.removeLayer(SketchTool.drawingPoly)
                    SketchTool.drawingPoly = null
                }
                SketchTool.speName = $('#sketchTool #sketchToolEditName').val()
                SketchTool.speDesc = $(
                    '#sketchTool #sketchToolEditDescription'
                ).val()
                var drawnPolygon = drawingPolyPointsToGeoJSON(
                    SketchTool.drawingPolyPoints,
                    'MultiLineString',
                    SketchTool.speColor,
                    SketchTool.speName,
                    SketchTool.speDesc,
                    function (geojson) {
                        noEraseDraw(geojson)
                    }
                )
            }
            break
        case 'poly':
            SketchTool.drawing = !SketchTool.drawing

            if (SketchTool.drawing) {
                //just entrered into draw state
                SketchTool.drawingPolyPoints = e.latlng.lat + ',' + e.latlng.lng
            } else {
                //exit draw state so finalize
                if (SketchTool.drawingPoly != undefined) {
                    Map_.map.removeLayer(SketchTool.drawingPoly)
                    SketchTool.drawingPoly = null
                }
                SketchTool.speName = $('#sketchTool #sketchToolEditName').val()
                SketchTool.speDesc = $(
                    '#sketchTool #sketchToolEditDescription'
                ).val()
                var drawnPolygon = drawingPolyPointsToGeoJSON(
                    SketchTool.drawingPolyPoints,
                    'Polygon',
                    SketchTool.speColor,
                    SketchTool.speName,
                    SketchTool.speDesc,
                    function (geojson) {
                        var selfIntersections = turf.kinks(geojson)
                        if (selfIntersections.features.length == 0) {
                            //Add elevation data

                            switch (SketchTool.speState.toLowerCase()) {
                                case 'under':
                                    eraseUnderlap(
                                        geojson,
                                        SketchTool.speGeoJSONPolys
                                    )
                                    break
                                case 'through':
                                    eraseOverlap(
                                        geojson,
                                        SketchTool.speGeoJSONPolys
                                    )
                                    break
                                case 'infront':
                                    noEraseDraw(geojson)
                                    break
                            }
                            SketchTool.canErase = true
                        } else {
                            CursorInfo.update(
                                'ERROR: Self Intersection.',
                                2500,
                                true
                            )
                        }
                    }
                )
            }
            break
        default:
            console.warn(
                'Warning! Draw Tool - unknown drawing shape: ' +
                    SketchTool.point_line_poly
            )
    }
}
function speOnMove(e) {
    if (SketchTool.everyNCounter == SketchTool.everyN) {
        if (SketchTool.drawing) {
            if (SketchTool.point_line_poly == 'line') {
                SketchTool.drawingPolyPoints +=
                    ' ' + e.latlng.lat + ',' + e.latlng.lng
                if (SketchTool.drawingPoly != undefined) {
                    Map_.map.removeLayer(SketchTool.drawingPoly)
                    SketchTool.drawingPoly = null
                }

                SketchTool.drawingPoly = new L.polyline(
                    pointStrToArr(SketchTool.drawingPolyPoints, false, true),
                    {
                        opacity: 1,
                        color: SketchTool.speColor,
                        weight: 5,
                        smoothFactor: 0,
                        className: 'noPointerEvents',
                    }
                ).addTo(Map_.map)
            } else if (SketchTool.point_line_poly == 'poly') {
                SketchTool.drawingPolyPoints +=
                    ' ' + e.latlng.lat + ',' + e.latlng.lng
                if (SketchTool.drawingPoly != undefined) {
                    Map_.map.removeLayer(SketchTool.drawingPoly)
                    SketchTool.drawingPoly = null
                }

                SketchTool.drawingPoly = new L.polygon(
                    pointStrToArr(SketchTool.drawingPolyPoints, true, true),
                    {
                        fillColor:
                            SketchTool.draw_erase_edit_delete == 'erase'
                                ? 'white'
                                : SketchTool.speColor,
                        opacity: 1,
                        fillOpacity: 0.3,
                        color:
                            SketchTool.draw_erase_edit_delete == 'erase'
                                ? 'black'
                                : 'blue',
                        weight: 2,
                        smoothFactor: 0,
                        className: 'noPointerEvents',
                    }
                ).addTo(Map_.map)
            }
        }
        SketchTool.everyNCounter = 0
    }
    SketchTool.everyNCounter++
}

function drawingPolyPointsToGeoJSON(dpp, type, color, name, desc, callback) {
    var isPoint = type.toLowerCase() == 'point'
    var isLine = type.toLowerCase() == 'line'
    var isPolygon = type.toLowerCase() == 'polygon'

    var geoJSON = {
        type: 'Feature',
        properties: {
            name: name,
            description: desc,
            fill: color,
            fillOpacity: isPolygon ? 0.3 : isLine ? 0.7 : 0.9,
            opacity: isLine ? 0.6 : 0.9,
            stroke: isPolygon || isPoint ? 'black' : color,
            weight: isPolygon ? 2 : isPoint ? 3 : 4,
        },
        geometry: {
            type: type,
            coordinates: isPoint
                ? singlePointStrToArr(dpp)
                : [pointStrToArr(dpp, isPolygon, false)],
        },
    }
    geoJSON.properties['boundingbox'] = turf.bbox(geoJSON)

    if (SketchTool.drawVarDemtilesets) {
        F_.lnglatsToDemtileElevs(
            geoJSON.geometry,
            SketchTool.drawVarDemtilesets,
            function (data) {
                geoJSON.geometry = data
                geoJSON = F_.geojsonAddSpatialProperties(geoJSON)
                callback(geoJSON)
            }
        )
    } else {
        callback(geoJSON)
    }
}

//Turn a string of 'x,y x,y x,y ...' into an array.
//pointStr is that string, close bool to complete loop, latlng is a bool (true if latlng, false if lnglat)
function pointStrToArr(pointStr, close, latlng) {
    var pointArr = []
    var pointStrArrComma

    var pointStrArr = pointStr.split(' ')
    for (var i = 0; i < pointStrArr.length; i++) {
        pointStrArrComma = pointStrArr[i].split(',')
        if (latlng)
            pointArr.push([
                parseFloat(pointStrArrComma[0]),
                parseFloat(pointStrArrComma[1]),
            ])
        else
            pointArr.push([
                parseFloat(pointStrArrComma[1]),
                parseFloat(pointStrArrComma[0]),
            ])
    }
    if (close) pointArr.push(pointArr[0]) //close the polygon
    return pointArr
}

function singlePointStrToArr(pointStr) {
    var pointStrArrComma = pointStr.split(',')
    return [parseFloat(pointStrArrComma[1]), parseFloat(pointStrArrComma[0])]
}

function noEraseDraw(drawnPoly) {
    //undo
    pushToUndoStack([drawnPoly])
    writetoPolygonGeoJSON('adddel', [drawnPoly])
}

function eraseOverlap(drawnPoly, geoJSONPolys) {
    var reshapedPoly
    var features = []
    var featurestodelete = []
    for (var i = 0; i < geoJSONPolys.length; i++) {
        if (
            geoJSONPolys[i].geometry.type.toLowerCase().includes('polygon') &&
            doBoundingBoxesIntersect(
                drawnPoly.properties.boundingbox,
                geoJSONPolys[i].properties.boundingbox
            )
        ) {
            try {
                reshapedPoly = turf.difference(geoJSONPolys[i], drawnPoly)
            } catch (error) {
                CursorInfo.update('ERROR: Topology.', 2500, true)
                return
            }

            //meaning drawnPoly completely covered geoJSONPolys[i] thus deleting it
            if (reshapedPoly == undefined) reshapedPoly = null

            features.push(reshapedPoly)
            featurestodelete.push(geoJSONPolys[i])
        }
    }
    if (SketchTool.draw_erase_edit_delete == 'draw') {
        features.push(drawnPoly)
    } else {
        features.push(null)
    }
    featurestodelete.push(null)

    //undo
    pushToUndoStack(features, featurestodelete)

    writetoPolygonGeoJSON('adddel', features, featurestodelete)
}
function eraseUnderlap(drawnPoly, geoJSONPolys) {
    var reshapedDrawnPoly = drawnPoly
    var features = []
    var featurestodelete = []
    for (var i = 0; i < geoJSONPolys.length && reshapedDrawnPoly != null; i++) {
        if (
            doBoundingBoxesIntersect(
                reshapedDrawnPoly.properties.boundingbox,
                geoJSONPolys[i].properties.boundingbox
            )
        ) {
            try {
                reshapedDrawnPoly = turf.difference(
                    reshapedDrawnPoly,
                    geoJSONPolys[i]
                )
            } catch (error) {
                CursorInfo.update('ERROR: Topology.', 2500, true)
                return
            }

            //meaning drawnPoly completely covered geoJSONPolys[i] thus deleting it
            if (reshapedDrawnPoly == undefined) reshapedDrawnPoly = null
        }
    }

    features.push(reshapedDrawnPoly)
    featurestodelete.push(null)

    //undo
    pushToUndoStack(features, featurestodelete)

    writetoPolygonGeoJSON('adddel', features, featurestodelete)
}

//mode strings are 'adddel', 'replace', 'move'
//  if 'adddel', parm 1 are the [features] to ADD and parm 2 are the [features] to DEL
//  if 'replace', parm 1 is REPLACED feature with parm 2 REPLACER feature
//  if 'move', parm 1 is feature to be MOVED to parm 2 string 'front' or 'back'
//features and featurestodelete are arrays of geojson features
//deletes featurestodelete[i] then adds features[i], if featurestodelete[i] == "null", nothing is deleted
function writetoPolygonGeoJSON(mode, parm1, parm2) {
    //, features, featurestodelete, orReplace, replaceThis, withThis, orMove, thisToThe, frontOrBack ) {
    //'adddel'
    var feature = null //[feature]
    var featuretodelete = null //[feature]
    //'replace'
    var replacing = null //feature
    var replacer = null //feature
    //'move'
    var moving = null //feature
    var movingTo = null //'front' or 'back'

    switch (mode) {
        case 'adddel':
            feature = parm1.shift()
            parm2 = parm2 || [null]
            featuretodelete = parm2.shift()
            break
        case 'replace':
            replacing = parm1
            replacer = parm2
            break
        case 'move':
            moving = parm1
            movingTo = parm2
            break
        default:
            console.warn(
                'Warning! SketchTool: unknown writetoPolygonGeoJSON mode: ' +
                    mode
            )
            return
    }

    writetpg()

    function writetpg() {
        $.ajax({
            type: 'POST',
            url: '/api/draw/write_to_polygon_geojson',
            data: {
                mode: mode,
                feature: JSON.stringify(feature),
                featuretodelete: JSON.stringify(featuretodelete),
                replacing: JSON.stringify(replacing),
                replacer: JSON.stringify(replacer),
                moving: JSON.stringify(moving),
                movingTo: movingTo,
                filename: '../../' + SketchTool.speGeojsonPolygonFile,
                rawfilename: SketchTool.speGeojsonPolygonFile,
                mission: L_.mission,
                isDBFile: SketchTool.isDBfile,
                master: L_.masterdb,
            },
            success: function (data) {
                switch (mode) {
                    case 'adddel':
                        if (parm1.length <= 0) {
                            reloadSPEPolys(
                                SketchTool.speGeojsonPolygonFile,
                                true
                            )
                        } else {
                            writetoPolygonGeoJSON('adddel', parm1, parm2)
                        }
                        break
                    case 'replace':
                        reloadSPEPolys(
                            SketchTool.speGeojsonPolygonFile,
                            false,
                            false
                        )
                        break
                    case 'move':
                        reloadSPEPolys(
                            SketchTool.speGeojsonPolygonFile,
                            false,
                            false
                        )
                        break
                }
            },
        })
    }
}

function eraseLast() {
    //erases last drawn polygon
    if (SketchTool.canErase) {
        //only allow erasing of last drawn shape
        var featurestodelete = []
        var features = []
        featurestodelete.push(
            SketchTool.speGeoJSONPolys[speGeoJSONPolys.length - 1]
        )
        features.push(null)
        writetoPolygonGeoJSON('adddel', features, featurestodelete)
        SketchTool.canErase = false
    }
}

function deleteFeature(feature) {
    var featurestodelete = []
    var features = []
    featurestodelete.push(feature)
    features.push(null)

    //undo
    pushToUndoStack(features, featurestodelete)

    writetoPolygonGeoJSON('adddel', features, featurestodelete)
}

function pushToUndoStack(features, featurestodelete) {
    featurestodelete = featurestodelete || [null]
    SketchTool.undoFeatures.push(F_.clone(features))
    SketchTool.undoFeaturesToDelete.push(F_.clone(featurestodelete))
    while (SketchTool.undoFeatures.length > SketchTool.maxNumberOfUndos) {
        SketchTool.undoFeatures.shift()
        SketchTool.undoFeaturesToDelete.shift()
    }
}

function undo() {
    if (
        SketchTool.undoFeatures.length > 0 &&
        SketchTool.undoFeaturesToDelete.length > 0
    ) {
        var featurestodelete = []
        var features = []
        featurestodelete = SketchTool.undoFeatures.pop()
        features = SketchTool.undoFeaturesToDelete.pop()

        writetoPolygonGeoJSON('adddel', features, featurestodelete)
    }
}

function doBoundingBoxesIntersect(a, b) {
    return a[1] <= b[3] && a[3] >= b[1] && a[0] <= b[2] && a[2] >= b[0]
}

export default SketchTool
