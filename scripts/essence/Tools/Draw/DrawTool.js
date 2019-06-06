//requires:
//turf.js
//leaflet.js with var map
//jquery.js
//d3.js
//write_to_polygon_geojson.php
//uses clone(obj) to clone an object
//uses a noPointerEvents class to signify a css pointer-events: "none"
define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'Globe_',
    'Map_',
    'Viewer_',
    'UserInterface_',
    'CursorInfo',
    'Login',
    'turf',
], function(
    $,
    d3,
    F_,
    L_,
    Globe_,
    Map_,
    Viewer_,
    UserInterface_,
    CursorInfo,
    Login,
    turf
) {
    // prettier-ignore
    var markup = [
  "<div id='drawTool' class='column mmgisScrollbar' style='display: inline-flex; white-space: nowrap; justify-content: flex-start; padding: 5px;'>",
    "<div style='width: 120px;'>",
      "<div>",
        "<select id='drawToolDrawingIn' class='ui dropdown short w100'>",
        "</select>",
      "</div>",
      "<div>",
        "<div class='mmgisHoverContents' style='display: inline-flex; width: 100%; color: #777; justify-content: space-around; margin: 5px 0px 5px 0px;'>",
          "<div id='drawToolUndo' style='margin-top:4px;'><i class='mdi mdi-undo mdi-24px'></i></div>",
          "<div id='drawToolRefresh' style='margin-top:4px;'><i class='mdi mdi-refresh mdi-24px'></i></div>",
          "<div id='drawToolDownload' style='margin-top:4px;'><i class='mdi mdi-download mdi-24px'></i></div>",
        "</div>",
        "<div id='drawToolDrawDelete' class='mmgisRadioBarVertical'>",
          "<div id='drawToolDrawMode' class='active' style='position: relative;'><i class='mdi mdi-gesture mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Draw</span></div>",
          "<div id='drawToolEditMode' style='position: relative;'><i class='mdi mdi-vector-polyline mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Edit</span></div>",
          "<div id='drawToolEraseMode' style='position: relative;'><i class='mdi mdi-eraser-variant mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Erase</span></div>",
          "<div id='drawToolDeleteMode' style='position: relative;'><i class='mdi mdi-delete mdi-24px' style='position: absolute;'></i><span style='padding-left: 24px;'>Delete</span></div>",
        "</div>",
      "</div>",
    "</div>",
    "<div id='drawToolEditPanel' style='width: 245px; height: 180px;'>",
      "<div style='padding: 5px 5px;'>",
        "<dl style='margin: 0;'>",
          "<dt style='position: relative;'>",
            "<div class='ui action inverted input'>",
              "<input id='drawToolEditName' type='text' placeholder='Name' style='padding: 2px 0px 6px 0px; font-size: 18px; background-color: transparent; color: white;' value=''></input>",
            "</div>",
            "<div id='drawToolEditColor' style='position: absolute; top: 0px; right: 0px; background-color: white; width: 20px; height: 20px; margin: 3px 0px 7px 5px; cursor: pointer; transition: opacity 0.5s;'></div>",
          "</dt>",
          "<dt>",
            "<div class='ui action inverted input' style='width: 100%;'>",
              "<textarea id='drawToolEditDescription' class='mmgisScrollbar' rows='7' placeholder='Description' style='resize: none; width: 100%; background-color: transparent; color: white;'></textarea>",
            "</div>",
          "</dt>",
          "<div id='drawToolEditSpecifics' style='display: none;'>",
            "<dt style='text-align: center;'>",
              "<div id='drawToolEditBack' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 6px 3px 3px 0px;'>Send to Back</div>",
              "<div id='drawToolEditFront' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 6px 0px 3px 3px;'>Send to Front</div>",
            "</dt>",
            "<dt style='text-align: center;'>",
              "<div id='drawToolEditSave' class='mmgisButton2' style='height: 24px; line-height: 24px; margin: 0px auto 0px auto;'>Save Changes</div>",
            "</dt>",
          "</div>",
        "</dl>",
      "</div>",
    "</div>",
    "<div id='drawToolDrawPanel' style='width: 30px; height: 180px;'>",
      "<div id='drawToolShape' class='mmgisRadioBarVertical' style='padding: 0 0 6px 2px; border-bottom: 1px solid rgba(119,119,119,0.47)'>",
        "<div id='drawToolShapePoint' title='Point'><i class='mdi mdi-square mdi-24px' style='position: absolute; transform: scale(0.4);'></i></div>",
        "<div id='drawToolShapeLine' title='Line'><i class='mdi mdi-vector-line mdi-24px' style='position: absolute;'></i></div>",
        "<div id='drawToolShapePoly' class='active' title='Polygon'><i class='mdi mdi-vector-square mdi-24px' style='position: absolute;'></i></div>",
      "</div>",
      "<div id='drawToolBehindInFront' class='mmgisRadioBarVertical' style='padding: 5px 0 0 2px;'>",
        "<div id='drawToolInFront' title='Over'><i class='mdi mdi-brightness-3 mdi-24px mdi-rotate-270' style='position: absolute;'></i></div>",
        "<div id='drawToolThrough' title='Through' class='active'><i class='mdi mdi-window-minimize mdi-24px' style='position: absolute;'></i></div>",
        "<div id='drawToolBehind' title='Under'><i class='mdi mdi-brightness-3 mdi-24px mdi-rotate-90' style='position: absolute;'></i></div>",
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

    var DrawTool = {
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
        init: function() {
            //get tool variables
            this.vars = L_.getToolVars('draw')

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
            if (this.speColorInitial == null)
                this.speColorInitial = this.drawVarColorLegend[0].color

            markup = markup.join('\n')
        },
        /**
    * @param {string} domId - optional
      @param {number} baseWidth - optional
    */
        make: function(domId, baseWidth) {
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

            if (Map_.map.hasLayer(L_.layersGroup[DrawTool.siteDrawings])) {
                Map_.map.removeLayer(L_.layersGroup[DrawTool.siteDrawings])
            }

            this.MMWebGISInterface = new interfaceWithMMWebGIS(domId)
        },
        destroy: function(domId) {
            d3.select(domId).empty()
            if (this.MMWebGISInterface !== null) {
                DrawTool.removed = true
                DrawTool.closedColor = DrawTool.speColor
                DrawTool.closedName = $('#drawToolEditName').val()
                DrawTool.closedDesc = $('#drawToolEditDescription').val()
                this.MMWebGISInterface.separateFromMMWebGIS()
                for (f in DrawTool.allFiles) {
                    reloadSPEPolys(f, false)
                }
            }
        },
        setDrawingFile: function(file, isDB) {
            DrawTool.isDBfile = isDB
            DrawTool.speGeojsonPolygonFile = file
            if (!DrawTool.allFiles.hasOwnProperty(file))
                DrawTool.allFiles[file] = isDB

            for (f in DrawTool.allFiles) {
                var currentFile = f == DrawTool.speGeojsonPolygonFile
                var currentUseOpacity = true
                if (currentFile && DrawTool.draw_erase_edit_delete == 'edit') {
                    currentUseOpacity = false
                }
                reloadSPEPolys(f, !currentFile, currentUseOpacity)
            }
        },
    }

    //Interfacing with MMWebGIS UI
    function interfaceWithMMWebGIS(domId) {
        this.separateFromMMWebGIS = function() {
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
        DrawTool.allFiles = []

        d3.select('#drawToolDrawingIn')
            .append('option')
            .attr('value', DrawTool.speGeojsonPolygonFile)
            .attr('isDB', false)
            .html(DrawTool.siteDrawings + ' [SITE]')
        DrawTool.allFiles[DrawTool.speGeojsonPolygonFile] = false
        //only show logged in user's added files
        for (l in L_.addedfiles) {
            if (L_.addedfiles[l]['username'] == Login.username) {
                d3.select('#drawToolDrawingIn')
                    .append('option')
                    .attr('value', l)
                    .attr('isDB', true)
                    .html(
                        L_.addedfiles[l]['name'] +
                            ' [' +
                            L_.addedfiles[l]['username'] +
                            ']'
                    )
                DrawTool.allFiles[l] = true
            }
        }

        $('#drawToolDrawingIn').dropdown({
            onChange: function(val) {
                var optionSelected = $('option:selected', this)
                DrawTool.isDBfile = optionSelected.attr('isDB') == 'true'
                DrawTool.speGeojsonPolygonFile = val

                for (f in DrawTool.allFiles) {
                    var currentFile = f == DrawTool.speGeojsonPolygonFile
                    var currentUseOpacity = true
                    if (
                        currentFile &&
                        DrawTool.draw_erase_edit_delete == 'edit'
                    ) {
                        currentUseOpacity = false
                    }
                    reloadSPEPolys(f, !currentFile, currentUseOpacity)
                }
            },
            direction: 'upward',
        })

        $('.mmgisRadioBarVertical#drawToolShape div').click(function() {
            $('.mmgisRadioBarVertical#drawToolShape div').removeClass('active')
            $(this).addClass('active')
        })
        $('.mmgisRadioBarVertical#drawToolDrawDelete div').click(function() {
            $('.mmgisRadioBarVertical#drawToolDrawDelete div').removeClass(
                'active'
            )
            $(this).addClass('active')
        })
        $('.mmgisRadioBarVertical#drawToolBehindInFront div').click(function() {
            $('.mmgisRadioBarVertical#drawToolBehindInFront div').removeClass(
                'active'
            )
            $(this).addClass('active')
        })
        $('.mmgisColorBar#drawToolColorBar button').click(function() {
            $(this)
                .siblings()
                .removeClass('active')
            $(this).addClass('active')
        })

        //Turn site drawing layer on if it's off
        if (L_.toggledArray[DrawTool.siteDrawings] == false) {
            L_.toggleLayer(L_.layersNamed[DrawTool.siteDrawings])
        }
        //Intializations
        var optionValue

        optionValue = $('#drawTool #drawToolBehindInFront .active').attr('id')
        if (optionValue == 'drawToolBehind') DrawTool.speState = 'under'
        else if (optionValue == 'drawToolThrough') DrawTool.speState = 'through'
        else speState = 'infront'

        optionValue = $('#drawTool #drawToolShape .active').attr('id')
        if (optionValue == 'drawToolShapePoint') {
            DrawTool.point_line_poly = 'point'
            $('#drawTool #drawToolBehindInFront').addClass('off')
        } else if (optionValue == 'drawToolShapeLine') {
            DrawTool.point_line_poly = 'line'
            $('#drawTool #drawToolBehindInFront').addClass('off')
        } else {
            DrawTool.point_line_poly = 'poly'
            $('#drawTool #drawToolBehindInFront').removeClass('off')
        }

        optionValue = $('#drawTool #drawToolDrawDelete .active').attr('id')
        if (optionValue == 'drawToolDrawMode') {
            DrawTool.draw_erase_edit_delete = 'draw'
            d3.select('#map').style('cursor', 'default')
            for (f in DrawTool.allFiles) {
                reloadSPEPolys(f, true)
            }
            Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
        } else if (optionValue == 'drawToolEraseMode') {
            DrawTool.draw_erase_edit_delete = 'erase'
            d3.select('#map').style('cursor', 'default')
            for (f in DrawTool.allFiles) {
                reloadSPEPolys(f, true)
            }
            Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
        } else if (optionValue == 'drawToolEditMode') {
            DrawTool.draw_erase_edit_delete = 'edit'
            d3.select('#map').style('cursor', 'default')
            for (f in DrawTool.allFiles) {
                reloadSPEPolys(f, false)
            }
            Map_.map.off('click', speOnClick).off('mousemove', speOnMove)
        } else {
            DrawTool.draw_erase_edit_delete = 'delete'
            d3.select('#map').style('cursor', 'alias')
            for (f in DrawTool.allFiles) {
                reloadSPEPolys(f, true)
            }
            Map_.map.off('click', speOnClick).off('mousemove', speOnMove)
        }

        if (DrawTool.closedColor !== null) {
            $('#drawToolEditColor').css('background-color', DrawTool.speColor)
            $('#drawToolEditName').val(DrawTool.closedName)
            $('#drawToolEditDescription').val(DrawTool.closedDesc)
        } else {
            DrawTool.speColor = DrawTool.speColorInitial
            $('#drawToolEditColor').css('background-color', DrawTool.speColor)

            if (DrawTool.colorIndexInitial !== -1) {
                $('#drawToolEditName').val(
                    DrawTool.drawVarColorLegend[DrawTool.colorIndexInitial].name
                )
                $('#drawToolEditDescription').val(
                    DrawTool.drawVarColorLegend[DrawTool.colorIndexInitial]
                        .value
                )
            }
        }

        //update input name
        optionValue = $('#drawTool #drawToolColorBar .active p').text()
        $('#drawTool #drawToolInputName').val(optionValue)

        //update input desc
        optionValue = $('#drawTool #drawToolColorBar .active').val()
        $('#drawTool #drawToolInputDescription').val(optionValue)

        ///Popuply things
        //function popupEvent( e ) {

        var nameChanged = false
        var descriptionChanged = false
        var colorChanged = false

        var colorOpen = false
        var colorTrans = false

        $('#drawToolEditColor').click(function() {
            if (!colorTrans) {
                colorOpen = !colorOpen
                if (colorOpen) {
                    if (DrawTool.drawVarColorLegend != null) {
                        var width =
                            ($('#drawToolEditColor')
                                .parent()
                                .width() -
                                30) /
                            DrawTool.drawVarColorLegend.length

                        colorTrans = true
                        $('#drawToolEditName').fadeOut(
                            400,
                            'swing',
                            function() {
                                $('#drawToolEditName').hide()
                                $('#drawToolEditColors').remove()
                                $('#drawToolEditColor')
                                    .parent()
                                    .append(
                                        "<div id='drawToolEditColors' style='display: inline-flex; opacity: 0;'></div>"
                                    )
                                for (
                                    var i = 0;
                                    i < DrawTool.drawVarColorLegend.length;
                                    i++
                                ) {
                                    $('#drawToolEditColors').append(
                                        "<div id='drawToolEditColors_" +
                                            i +
                                            "' style='background-color: " +
                                            DrawTool.drawVarColorLegend[i]
                                                .color +
                                            '; width: ' +
                                            width +
                                            "px; height: 20px; margin: 2.6px 0px 6px 0px; cursor: pointer; opacity: 0.8;'></div>"
                                    )
                                    $('#drawToolEditColors_' + i).click(
                                        (function(i) {
                                            return function() {
                                                if (
                                                    DrawTool.draw_erase_edit_delete ==
                                                    'edit'
                                                ) {
                                                    var defaultColor =
                                                        DrawTool
                                                            .lastClickedFeature
                                                            .properties.fill
                                                    if (
                                                        F_.rgb2hex(
                                                            $(this).css(
                                                                'background-color'
                                                            )
                                                        ) != defaultColor
                                                    ) {
                                                        $(
                                                            '#drawToolEditSave'
                                                        ).css({
                                                            'border-color':
                                                                '#33cc66',
                                                            color: '#26d962',
                                                        })
                                                        colorChanged = true
                                                    } else {
                                                        colorChanged = false
                                                        resetSaveColor()
                                                    }
                                                } else {
                                                    DrawTool.speColor = F_.rgb2hex(
                                                        $(this).css(
                                                            'background-color'
                                                        )
                                                    )
                                                }
                                                $('#drawToolEditColor').css({
                                                    'background-color': $(
                                                        this
                                                    ).css('background-color'),
                                                })
                                                $('#drawToolEditName').val(
                                                    DrawTool.drawVarColorLegend[
                                                        i
                                                    ].name
                                                )
                                                $(
                                                    '#drawToolEditDescription'
                                                ).val(
                                                    DrawTool.drawVarColorLegend[
                                                        i
                                                    ].value
                                                )
                                                $('#drawToolEditColor').click()
                                                CursorInfo.hide()
                                            }
                                        })(i)
                                    )
                                    $('#drawToolEditColors_' + i).mouseenter(
                                        (function(i) {
                                            return function() {
                                                CursorInfo.update(
                                                    DrawTool.drawVarColorLegend[
                                                        i
                                                    ].name
                                                )
                                            }
                                        })(i)
                                    )
                                    $('#drawToolEditColors_' + i).mouseleave(
                                        (function(i) {
                                            return function() {
                                                CursorInfo.hide(true)
                                            }
                                        })(i)
                                    )
                                    $('#drawToolEditColors_' + i).hover(
                                        function() {
                                            $(this).css({ opacity: '1' })
                                        },
                                        function() {
                                            $(this).css({ opacity: '0.8' })
                                        }
                                    )
                                }
                                $('#drawToolEditColors').animate(
                                    { opacity: '1' },
                                    400,
                                    function() {
                                        colorTrans = false
                                    }
                                )
                            }
                        )
                    }
                } else {
                    colorTrans = true
                    $('#drawToolEditColors').fadeOut(400, 'swing', function() {
                        $('#drawToolEditColors').remove()
                        $('#drawToolEditName').fadeIn(400, 'swing', function() {
                            colorTrans = false
                        })
                    })
                }
            }
        })
        $('#drawToolEditColor').hover(
            function() {
                $(this).css({ opacity: '0.7' })
            },
            function() {
                $(this).css({ opacity: '1' })
            }
        )

        $('#drawToolEditBack').click(function() {
            writetoPolygonGeoJSON('move', DrawTool.lastClickedFeature, 'back')
        })

        $('#drawToolEditFront').click(function() {
            writetoPolygonGeoJSON('move', DrawTool.lastClickedFeature, 'front')
        })

        $('#drawToolEditName').on('input', function() {
            if (DrawTool.draw_erase_edit_delete == 'edit') {
                var defaultName = DrawTool.lastClickedFeature.properties.name
                if ($(this).val() != defaultName) {
                    $('#drawToolEditSave').css({
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
        $('#drawToolEditDescription').on('input', function() {
            if (DrawTool.draw_erase_edit_delete == 'edit') {
                var defaultDescription =
                    DrawTool.lastClickedFeature.properties.description
                if ($(this).val() != defaultDescription) {
                    $('#drawToolEditSave').css({
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
                    DrawTool.hasBeenEdited
                )
            ) {
                $('#drawToolEditSave').css({
                    'border-color': '#666',
                    color: '#999',
                })
            }
        }

        $('#drawToolEditSave').click(function() {
            if (
                nameChanged ||
                descriptionChanged ||
                colorChanged ||
                DrawTool.hasBeenEdited
            ) {
                editSave(DrawTool.lastClickedFeature)
            }
        })

        DrawTool.updateEditPanel = function() {
            $('#drawToolEditName').prop(
                'value',
                DrawTool.lastClickedFeature.properties.name
            )
            $('#drawToolEditColor').css(
                'background-color',
                DrawTool.lastClickedFeature.properties.fill
            )
            $('#drawToolEditDescription').prop(
                'value',
                DrawTool.lastClickedFeature.properties.description
            )
        }

        //Events
        function _dt00() {
            DrawTool.point_line_poly = 'point'
            $('#drawTool #drawToolBehindInFront').addClass('off')
        }
        $('#drawTool  #drawToolShapePoint').click(_dt00)

        function _dt01() {
            DrawTool.point_line_poly = 'line'
            $('#drawTool #drawToolBehindInFront').addClass('off')
        }
        $('#drawTool  #drawToolShapeLine').click(_dt01)

        function _dt02() {
            DrawTool.point_line_poly = 'poly'
            $('#drawTool #drawToolBehindInFront').removeClass('off')
        }
        $('#drawTool  #drawToolShapePoly').click(_dt02)

        //Draw Erase Edit Delete
        function _dt0() {
            if (DrawTool.draw_erase_edit_delete != 'draw') {
                //if switching mode
                var draw_erase_deleteOLD = DrawTool.draw_erase_edit_delete
                DrawTool.draw_erase_edit_delete = 'draw'
                d3.select('#map').style('cursor', 'default')
                UserInterface_.setToolWidth(DrawTool.widths[2])
                $('#drawTool #drawToolEditPanel').css('display', 'block')
                setTimeout(function() {
                    $('#drawTool #drawToolDrawPanel').css('display', 'block')
                }, 400)
                $('#drawTool #drawToolEditSpecifics').css('display', 'none')
                $('#drawTool #drawToolEditDescription').prop('rows', '7')
                if (draw_erase_deleteOLD != 'erase') {
                    reloadSPEPolys(DrawTool.speGeojsonPolygonFile, true)
                    Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
                }
                DrawTool.speName = ''
                DrawTool.speDesc = ''
                $('#drawTool #drawToolEditName').prop('value', DrawTool.speName)
                $('#drawTool #drawToolEditDescription').prop(
                    'value',
                    DrawTool.speDesc
                )

                $('#drawTool #drawToolShape').removeClass('disabled')
                $('#drawTool #drawToolBehindInFront').removeClass('disabled')
                $('#drawTool #drawToolShape').removeClass('off')
                if (DrawTool.point_line_poly == 'poly')
                    $('#drawTool #drawToolBehindInFront').removeClass('off')
            }
        }
        $('#drawTool  #drawToolDrawMode').click(_dt0)

        function _dt1() {
            if (DrawTool.draw_erase_edit_delete != 'erase') {
                //if switching mode
                var draw_erase_deleteOLD = DrawTool.draw_erase_edit_delete
                DrawTool.draw_erase_edit_delete = 'erase'
                d3.select('#map').style('cursor', 'default')
                UserInterface_.setToolWidth(DrawTool.widths[0])
                $('#drawTool #drawToolEditPanel').css('display', 'none')
                $('#drawTool #drawToolDrawPanel').css('display', 'none')
                if (draw_erase_deleteOLD != 'draw') {
                    reloadSPEPolys(DrawTool.speGeojsonPolygonFile, true)
                    Map_.map.on('click', speOnClick).on('mousemove', speOnMove)
                }

                $('#drawTool #drawToolShapePoint').removeClass('active')
                $('#drawTool #drawToolShapeLine').removeClass('active')
                $('#drawTool #drawToolShapePoly').addClass('active')
                $('#drawTool #drawToolShape').removeClass('off')
                $('#drawTool #drawToolShape').addClass('disabled')
                DrawTool.point_line_poly = 'poly'

                $('#drawTool #drawToolBehind').removeClass('active')
                $('#drawTool #drawToolThrough').addClass('active')
                $('#drawTool #drawToolInFront').removeClass('active')
                $('#drawTool #drawToolBehindInFront').removeClass('off')
                $('#drawTool #drawToolBehindInFront').addClass('disabled')
                DrawTool.speState = 'through'
            }
        }
        $('#drawTool  #drawToolEraseMode').click(_dt1)

        function _dt11() {
            if (DrawTool.draw_erase_edit_delete != 'edit') {
                //if switching mode
                DrawTool.draw_erase_edit_delete = 'edit'
                d3.select('#map').style('cursor', 'default')
                UserInterface_.setToolWidth(DrawTool.widths[0])
                $('#drawTool #drawToolEditPanel').css('display', 'none')
                $('#drawTool #drawToolDrawPanel').css('display', 'none')
                $('#drawTool #drawToolEditSpecifics').css('display', 'inherit')
                $('#drawTool #drawToolEditDescription').prop('rows', '4')
                reloadSPEPolys(DrawTool.speGeojsonPolygonFile, false, false)
                Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

                DrawTool.speName = ''
                DrawTool.speDesc = ''
                $('#drawTool #drawToolEditName').prop('value', DrawTool.speName)
                $('#drawTool #drawToolEditDescription').prop(
                    'value',
                    DrawTool.speDesc
                )

                $('#drawTool #drawToolShape').addClass('off')
                $('#drawTool #drawToolBehindInFront').addClass('off')
            }
        }
        $('#drawTool  #drawToolEditMode').click(_dt11)

        function _dt2() {
            if (DrawTool.draw_erase_edit_delete != 'delete') {
                //if switching mode
                DrawTool.draw_erase_edit_delete = 'delete'
                d3.select('#map').style('cursor', 'alias')
                UserInterface_.setToolWidth(DrawTool.widths[0])
                $('#drawTool #drawToolEditPanel').css('display', 'none')
                $('#drawTool #drawToolDrawPanel').css('display', 'none')
                reloadSPEPolys(DrawTool.speGeojsonPolygonFile, false)
                Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

                $('#drawTool #drawToolShape').addClass('off')
                $('#drawTool #drawToolBehindInFront').addClass('off')
            }
        }
        $('#drawTool  #drawToolDeleteMode').click(_dt2)

        function _dt3() {
            DrawTool.speColor = F_.rgb2hex($(this).css('background-color'))
            //update input name
            $('#drawTool #drawToolInputName').val(
                $(this)
                    .find('p')
                    .text()
            )

            //update input desc
            optionValue = $('#drawTool #drawToolColorBar .active').val()
            $('#drawTool #drawToolInputDescription').val(optionValue)
        }
        $('#drawTool #drawToolColorBar button').click(_dt3)

        function _dt4() {
            DrawTool.speState = 'under'
        }
        $('#drawTool  #drawToolBehind').click(_dt4)

        function _dt5() {
            DrawTool.speState = 'through'
        }
        $('#drawTool  #drawToolThrough').click(_dt5)

        function _dt50() {
            DrawTool.speState = 'infront'
        }
        $('#drawTool  #drawToolInFront').click(_dt50)

        function _dt6() {
            undo()
        }
        $('#drawTool  #drawToolUndo').click(_dt6)

        function _dt60() {
            for (f in DrawTool.allFiles) {
                var currentFile = f == DrawTool.speGeojsonPolygonFile
                var currentUseOpacity = true
                if (currentFile && DrawTool.draw_erase_edit_delete == 'edit') {
                    currentUseOpacity = false
                }
                reloadSPEPolys(f, !currentFile, currentUseOpacity)
            }
        }
        $('#drawTool  #drawToolRefresh').click(_dt60)

        function _dt7() {
            if (DrawTool.isDBfile) {
                var w = window.open()
                w.document.write(JSON.stringify(DrawTool.lastDBData))
            } else {
                window.open(
                    DrawTool.speGeojsonPolygonFile +
                        '?nocache=' +
                        new Date().getTime()
                )
            }
        }
        $('#drawTool  #drawToolDownload').click(_dt7)

        //description more expand to textarea
        $('#drawTool #drawToolInputDescriptionMore').css({
            'border-bottom-right-radius': '2px',
            'border-top-right-radius': '2px',
            margin: '8px 8px 8px 0px',
            padding: '0px 0px 0px 0px',
        })
        function _dt8() {
            var descriptionContent = $(
                '#drawTool #drawToolInputDescription'
            ).val()
        }
        $('#drawTool #drawToolInputDescriptionMore').click(_dt8)

        function separateFromMMWebGIS() {
            Map_.map.off('click', speOnClick).off('mousemove', speOnMove)

            d3.select('#map').style('cursor', DrawTool.previousCursor)
        }
    }

    //This is often used merely to add and remove pointerevents
    //It'd be nice to have a function for just adding/removing pointer events for a specific layer
    function reloadSPEPolys(geojsonFile, noPointerEvents, useOpacity) {
        var pointerEvents = 'none'
        DrawTool.hasBeenEdited = false
        $('#drawToolEditSave').css({ 'border-color': '#666', color: '#999' })
        DrawTool.lastEditedGeometry = null

        if (!noPointerEvents) pointerEvents = null
        if (DrawTool.draw_erase_edit_delete == 'delete' || DrawTool.removed)
            pointerEvents = null
        if (typeof useOpacity == 'undefined') {
            useOpacity = true
        }
        var isDB = DrawTool.isDBfile
        if (DrawTool.allFiles.hasOwnProperty(geojsonFile)) {
            isDB = DrawTool.allFiles[geojsonFile]
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
                success: function(data) {
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
                    DrawTool.lastDBData = data

                    if (
                        Map_.map.hasLayer(L_.addedfiles[geojsonFile]['layer'])
                    ) {
                        Map_.map.removeLayer(
                            L_.addedfiles[geojsonFile]['layer']
                        )
                    }

                    //sort data so point features are always on top of lines and lines always on top of polygons
                    F_.sortGeoJSONFeatures(data)

                    DrawTool.speGeoJSONPolys = data.features

                    L_.addedfiles[geojsonFile]['layer'] = L.geoJson(data, {
                        style: function(feature) {
                            var fopacity = feature.properties.opacity || 1
                            var ffill = feature.properties.fill || 'black'
                            var ffillOpacity =
                                feature.properties.fillOpacity || 1
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
                        pointToLayer: function(feature, latlng) {
                            return L.circleMarker(latlng)
                        },
                        onEachFeature: function(feature, layer) {
                            if (DrawTool.removed) {
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
                                DrawTool.draw_erase_edit_delete == 'edit'
                            ) {
                                layer.on('click', function() {
                                    UserInterface_.setToolWidth(
                                        DrawTool.widths[1]
                                    )
                                    $('#drawTool #drawToolEditPanel').css(
                                        'display',
                                        'block'
                                    )

                                    if (!layer.hasBeenEdited) {
                                        DrawTool.hasBeenEdited = false
                                        $('#drawToolEditSave').css({
                                            'border-color': '#666',
                                            color: '#999',
                                        })
                                    } else {
                                        DrawTool.hasBeenEdited = true
                                        $('#drawToolEditSave').css({
                                            'border-color': '#33cc66',
                                            color: '#26d962',
                                        })
                                    }
                                    DrawTool.lastEditedGeometry = layer.toGeoJSON().geometry
                                    DrawTool.lastClickedFeature = feature
                                    if (DrawTool.lastClickedLayer)
                                        DrawTool.lastClickedLayer.disableEdit()
                                    DrawTool.lastClickedLayer = layer
                                    DrawTool.lastClickedLayer.enableEdit()
                                    DrawTool.updateEditPanel()

                                    L_.layersGroup[
                                        DrawTool.siteDrawings
                                    ].eachLayer(function(l) {
                                        L_.layersGroup[
                                            DrawTool.siteDrawings
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
                                layer.on('editable:editing', function(e) {
                                    DrawTool.hasBeenEdited = true
                                    layer.hasBeenEdited = true
                                    $('#drawToolEditSave').css({
                                        'border-color': '#33cc66',
                                        color: '#26d962',
                                    })
                                    DrawTool.lastEditedGeometry = layer.toGeoJSON().geometry
                                    layer.setStyle({ color: 'blue', weight: 4 })
                                })
                                layer.on('mouseover', function(e) {
                                    this.setStyle({ color: 'white', weight: 6 })
                                })
                                layer.on('mouseout', function(e) {
                                    L_.addedfiles[geojsonFile][
                                        'layer'
                                    ].eachLayer(function(l) {
                                        L_.addedfiles[geojsonFile][
                                            'layer'
                                        ].resetStyle(l)
                                        if (l.hasBeenEdited) {
                                            if (
                                                l != DrawTool.lastClickedLayer
                                            ) {
                                                l.setStyle({
                                                    color: 'red',
                                                    weight: 6,
                                                })
                                            } else if (
                                                l == DrawTool.lastClickedLayer
                                            ) {
                                                l.setStyle({
                                                    color: 'blue',
                                                    weight: 4,
                                                })
                                            }
                                        }
                                    })
                                })
                            } else if (
                                DrawTool.draw_erase_edit_delete == 'delete'
                            ) {
                                layer.on('click', function() {
                                    deleteFeature(feature)
                                })
                            }
                        },
                    })
                    L_.addedfiles[geojsonFile]['layer'].addTo(Map_.map)
                    if (!DrawTool.removed) {
                        Globe_.removeVectorTileLayer(
                            'addedfiles_' + geojsonFile
                        )
                        Globe_.addVectorTileLayer({
                            id: 'addedfiles_' + geojsonFile,
                            layers: L_.addedfiles[geojsonFile]['layer']._layers,
                        })
                    }
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    L_.addedfiles[geojsonFile] = null
                    CursorInfo.update('Failed to get file data.', 2500, true)
                },
            })
        } else {
            $.getJSON(geojsonFile, { _: new Date().getTime() }, function(data) {
                if (Map_.map.hasLayer(L_.layersGroup[DrawTool.siteDrawings])) {
                    Map_.map.removeLayer(L_.layersGroup[DrawTool.siteDrawings])
                }
                //sort data so point features are always on top of lines and lines always on top of polygons
                F_.sortGeoJSONFeatures(data)

                DrawTool.speGeoJSONPolys = data.features
                //var pointerEvents = null; if(noPointerEvents) pointerEvents = "none";
                L_.layersGroup[DrawTool.siteDrawings] = L.geoJson(data, {
                    style: function(feature) {
                        return {
                            color: 'black',
                            radius: 6,
                            opacity: useOpacity
                                ? feature.properties.opacity
                                : 1,
                            fillColor: feature.properties.fill,
                            fillOpacity: 0.3 /*(useOpacity) ? feature.properties.fillOpacity : 1*/,
                            color: feature.properties.stroke,
                            weight: feature.properties.weight,
                            className: 'spePolygonLayer',
                            pointerEvents: pointerEvents,
                        }
                    },
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng)
                    },
                    onEachFeature: function(feature, layer) {
                        if (DrawTool.removed) {
                            var desc = feature.properties.description
                            if (desc) desc = desc.replace(/\n/g, '<br />')
                            var list =
                                '<dl><dt><b>' +
                                feature.properties.name +
                                '</b></dt><dt>' +
                                desc +
                                '</dt></dl>'
                            layer.bindPopup(list)
                        } else if (DrawTool.draw_erase_edit_delete == 'edit') {
                            layer.on('click', function() {
                                UserInterface_.setToolWidth(DrawTool.widths[1])
                                $('#drawTool #drawToolEditPanel').css(
                                    'display',
                                    'block'
                                )

                                if (!layer.hasBeenEdited) {
                                    DrawTool.hasBeenEdited = false
                                    $('#drawToolEditSave').css({
                                        'border-color': '#666',
                                        color: '#999',
                                    })
                                } else {
                                    DrawTool.hasBeenEdited = true
                                    $('#drawToolEditSave').css({
                                        'border-color': '#33cc66',
                                        color: '#26d962',
                                    })
                                }
                                DrawTool.lastEditedGeometry = layer.toGeoJSON().geometry
                                DrawTool.lastClickedFeature = feature
                                if (DrawTool.lastClickedLayer)
                                    DrawTool.lastClickedLayer.disableEdit()
                                DrawTool.lastClickedLayer = layer
                                DrawTool.lastClickedLayer.enableEdit()
                                DrawTool.updateEditPanel()

                                L_.layersGroup[DrawTool.siteDrawings].eachLayer(
                                    function(l) {
                                        L_.layersGroup[
                                            DrawTool.siteDrawings
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
                            layer.on('editable:editing', function(e) {
                                DrawTool.hasBeenEdited = true
                                layer.hasBeenEdited = true
                                $('#drawToolEditSave').css({
                                    'border-color': '#33cc66',
                                    color: '#26d962',
                                })
                                DrawTool.lastEditedGeometry = layer.toGeoJSON().geometry
                                layer.setStyle({ color: 'blue', weight: 4 })
                            })
                            layer.on('mouseover', function(e) {
                                this.setStyle({ color: 'white', weight: 6 })
                            })
                            layer.on('mouseout', function(e) {
                                L_.layersGroup[DrawTool.siteDrawings].eachLayer(
                                    function(l) {
                                        L_.layersGroup[
                                            DrawTool.siteDrawings
                                        ].resetStyle(l)
                                        if (l.hasBeenEdited) {
                                            if (
                                                l != DrawTool.lastClickedLayer
                                            ) {
                                                l.setStyle({
                                                    color: 'red',
                                                    weight: 6,
                                                })
                                            } else if (
                                                l == DrawTool.lastClickedLayer
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
                            DrawTool.draw_erase_edit_delete == 'delete'
                        ) {
                            layer.on('click', function() {
                                deleteFeature(feature)
                            })
                        }
                    },
                })

                if (L_.toggledArray[DrawTool.siteDrawings] == true) {
                    L_.layersGroup[DrawTool.siteDrawings].addTo(Map_.map)
                    if (!DrawTool.removed) {
                        Globe_.removeVectorTileLayer('drawtool_sitedrawings')
                        Globe_.addVectorTileLayer({
                            id: 'drawtool_sitedrawings',
                            layers:
                                L_.layersGroup[DrawTool.siteDrawings]._layers,
                        })
                    }
                }
            })
        }
    }

    function resetLayerStyles() {
        for (f in DrawTool.allFiles) {
        }
    }

    //Only called upon save in edit popup. So just safely read the values from that box.
    function editSave(feature) {
        var editedFeature = F_.clone(feature)
        editedFeature.properties.name = $('#drawToolEditName').val()
        editedFeature.properties.description = $(
            '#drawToolEditDescription'
        ).val()
        if (DrawTool.lastEditedGeometry != null)
            editedFeature.geometry = DrawTool.lastEditedGeometry
        var newColor = F_.rgb2hex(
            $('#drawToolEditColor').css('background-color')
        )
        editedFeature.properties.fill = newColor
        if (editedFeature.geometry.type.toLowerCase() == 'multilinestring') {
            editedFeature.properties.stroke = newColor
        }
        DrawTool.lastEditedGeometry = null
        editedFeature = F_.geojsonAddSpatialProperties(editedFeature)
        writetoPolygonGeoJSON('replace', feature, editedFeature)
    }

    function speOnClick(e) {
        switch (DrawTool.point_line_poly) {
            case 'point':
                DrawTool.drawingPolyPoints = e.latlng.lat + ',' + e.latlng.lng
                DrawTool.speName = $('#drawTool #drawToolEditName').val()
                DrawTool.speDesc = $('#drawTool #drawToolEditDescription').val()
                var drawnPolygon = drawingPolyPointsToGeoJSON(
                    DrawTool.drawingPolyPoints,
                    'Point',
                    DrawTool.speColor,
                    DrawTool.speName,
                    DrawTool.speDesc,
                    function(geojson) {
                        noEraseDraw(geojson)
                    }
                )
                break
            case 'line':
                DrawTool.drawing = !DrawTool.drawing

                if (DrawTool.drawing) {
                    //just entrered into draw state
                    DrawTool.drawingPolyPoints =
                        e.latlng.lat + ',' + e.latlng.lng
                } else {
                    //exit draw state so finalize
                    if (DrawTool.drawingPoly != undefined) {
                        Map_.map.removeLayer(DrawTool.drawingPoly)
                        DrawTool.drawingPoly = null
                    }
                    DrawTool.speName = $('#drawTool #drawToolEditName').val()
                    DrawTool.speDesc = $(
                        '#drawTool #drawToolEditDescription'
                    ).val()
                    var drawnPolygon = drawingPolyPointsToGeoJSON(
                        DrawTool.drawingPolyPoints,
                        'MultiLineString',
                        DrawTool.speColor,
                        DrawTool.speName,
                        DrawTool.speDesc,
                        function(geojson) {
                            noEraseDraw(geojson)
                        }
                    )
                }
                break
            case 'poly':
                DrawTool.drawing = !DrawTool.drawing

                if (DrawTool.drawing) {
                    //just entrered into draw state
                    DrawTool.drawingPolyPoints =
                        e.latlng.lat + ',' + e.latlng.lng
                } else {
                    //exit draw state so finalize
                    if (DrawTool.drawingPoly != undefined) {
                        Map_.map.removeLayer(DrawTool.drawingPoly)
                        DrawTool.drawingPoly = null
                    }
                    DrawTool.speName = $('#drawTool #drawToolEditName').val()
                    DrawTool.speDesc = $(
                        '#drawTool #drawToolEditDescription'
                    ).val()
                    var drawnPolygon = drawingPolyPointsToGeoJSON(
                        DrawTool.drawingPolyPoints,
                        'Polygon',
                        DrawTool.speColor,
                        DrawTool.speName,
                        DrawTool.speDesc,
                        function(geojson) {
                            var selfIntersections = turf.kinks(geojson)
                            if (selfIntersections.features.length == 0) {
                                //Add elevation data

                                switch (DrawTool.speState.toLowerCase()) {
                                    case 'under':
                                        eraseUnderlap(
                                            geojson,
                                            DrawTool.speGeoJSONPolys
                                        )
                                        break
                                    case 'through':
                                        eraseOverlap(
                                            geojson,
                                            DrawTool.speGeoJSONPolys
                                        )
                                        break
                                    case 'infront':
                                        noEraseDraw(geojson)
                                        break
                                }
                                DrawTool.canErase = true
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
                        DrawTool.point_line_poly
                )
        }
    }
    function speOnMove(e) {
        if (DrawTool.everyNCounter == DrawTool.everyN) {
            if (DrawTool.drawing) {
                if (DrawTool.point_line_poly == 'line') {
                    DrawTool.drawingPolyPoints +=
                        ' ' + e.latlng.lat + ',' + e.latlng.lng
                    if (DrawTool.drawingPoly != undefined) {
                        Map_.map.removeLayer(DrawTool.drawingPoly)
                        DrawTool.drawingPoly = null
                    }

                    DrawTool.drawingPoly = new L.polyline(
                        pointStrToArr(DrawTool.drawingPolyPoints, false, true),
                        {
                            opacity: 1,
                            color: DrawTool.speColor,
                            weight: 5,
                            smoothFactor: 0,
                            className: 'noPointerEvents',
                        }
                    ).addTo(Map_.map)
                } else if (DrawTool.point_line_poly == 'poly') {
                    DrawTool.drawingPolyPoints +=
                        ' ' + e.latlng.lat + ',' + e.latlng.lng
                    if (DrawTool.drawingPoly != undefined) {
                        Map_.map.removeLayer(DrawTool.drawingPoly)
                        DrawTool.drawingPoly = null
                    }

                    DrawTool.drawingPoly = new L.polygon(
                        pointStrToArr(DrawTool.drawingPolyPoints, true, true),
                        {
                            fillColor:
                                DrawTool.draw_erase_edit_delete == 'erase'
                                    ? 'white'
                                    : DrawTool.speColor,
                            opacity: 1,
                            fillOpacity: 0.3,
                            color:
                                DrawTool.draw_erase_edit_delete == 'erase'
                                    ? 'black'
                                    : 'blue',
                            weight: 2,
                            smoothFactor: 0,
                            className: 'noPointerEvents',
                        }
                    ).addTo(Map_.map)
                }
            }
            DrawTool.everyNCounter = 0
        }
        DrawTool.everyNCounter++
    }

    function drawingPolyPointsToGeoJSON(
        dpp,
        type,
        color,
        name,
        desc,
        callback
    ) {
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

        if (DrawTool.drawVarDemtilesets) {
            F_.lnglatsToDemtileElevs(
                geoJSON.geometry,
                DrawTool.drawVarDemtilesets,
                function(data) {
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
        return [
            parseFloat(pointStrArrComma[1]),
            parseFloat(pointStrArrComma[0]),
        ]
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
                geoJSONPolys[i].geometry.type
                    .toLowerCase()
                    .includes('polygon') &&
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
        if (DrawTool.draw_erase_edit_delete == 'draw') {
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
        for (
            var i = 0;
            i < geoJSONPolys.length && reshapedDrawnPoly != null;
            i++
        ) {
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
                    'Warning! DrawTool: unknown writetoPolygonGeoJSON mode: ' +
                        mode
                )
                return
        }

        writetpg()

        function writetpg() {
            $.ajax({
                type: 'POST',
                url: 'scripts/essence/Tools/Draw/write_to_polygon_geojson.php',
                data: {
                    mode: mode,
                    feature: JSON.stringify(feature),
                    featuretodelete: JSON.stringify(featuretodelete),
                    replacing: JSON.stringify(replacing),
                    replacer: JSON.stringify(replacer),
                    moving: JSON.stringify(moving),
                    movingTo: movingTo,
                    filename: '../../../../' + DrawTool.speGeojsonPolygonFile,
                    rawfilename: DrawTool.speGeojsonPolygonFile,
                    mission: L_.mission,
                    isDBFile: DrawTool.isDBfile,
                    master: L_.masterdb,
                },
                success: function(data) {
                    switch (mode) {
                        case 'adddel':
                            if (parm1.length <= 0) {
                                reloadSPEPolys(
                                    DrawTool.speGeojsonPolygonFile,
                                    true
                                )
                            } else {
                                writetoPolygonGeoJSON('adddel', parm1, parm2)
                            }
                            break
                        case 'replace':
                            reloadSPEPolys(
                                DrawTool.speGeojsonPolygonFile,
                                false,
                                false
                            )
                            break
                        case 'move':
                            reloadSPEPolys(
                                DrawTool.speGeojsonPolygonFile,
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
        if (DrawTool.canErase) {
            //only allow erasing of last drawn shape
            var featurestodelete = []
            var features = []
            featurestodelete.push(
                DrawTool.speGeoJSONPolys[speGeoJSONPolys.length - 1]
            )
            features.push(null)
            writetoPolygonGeoJSON('adddel', features, featurestodelete)
            DrawTool.canErase = false
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
        DrawTool.undoFeatures.push(F_.clone(features))
        DrawTool.undoFeaturesToDelete.push(F_.clone(featurestodelete))
        while (DrawTool.undoFeatures.length > DrawTool.maxNumberOfUndos) {
            DrawTool.undoFeatures.shift()
            DrawTool.undoFeaturesToDelete.shift()
        }
    }

    function undo() {
        if (
            DrawTool.undoFeatures.length > 0 &&
            DrawTool.undoFeaturesToDelete.length > 0
        ) {
            var featurestodelete = []
            var features = []
            featurestodelete = DrawTool.undoFeatures.pop()
            features = DrawTool.undoFeaturesToDelete.pop()

            writetoPolygonGeoJSON('adddel', features, featurestodelete)
        }
    }

    function doBoundingBoxesIntersect(a, b) {
        return a[1] <= b[3] && a[3] >= b[1] && a[0] <= b[2] && a[2] >= b[0]
    }

    DrawTool.init()

    return DrawTool
})
