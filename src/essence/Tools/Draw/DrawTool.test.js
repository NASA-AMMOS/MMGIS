import $ from 'jquery'
import F_ from '../../Basics/Formulae_/Formulae_'
import TC_ from '../../Basics/ToolController_/ToolController_'
import Test_ from '../../Basics/Test_/Test_'
import L_ from '../../Basics/Layers_/Layers_'
import calls from '../../../pre/calls'

var Test = {
    tool: null,
    toolName: 'DrawTool',
    done: 0,
    subtests: 0,
    subtestRunning: false,
    timeout: 1000,
    reset: function () {
        TC_.closeActiveTool()
        mmgisglobal.test = true
        TC_.makeTool(this.toolName)
    },
    run: function (callback) {
        Test.reset()
        Test.tool = TC_.getTool(Test.toolName)
        Test.done = 0
        Test.subtests = 0

        //Set total
        var total = 0
        for (var i = 0; i < Test.tests.length; i++) {
            total += Test.tests[i].subtests
        }
        Test_.results.total = total

        nextTest()

        function c(message, pass, isHeader) {
            callback(Test.toolName, message, pass, isHeader)
            Test.subtests--
            if (Test.subtests === 0) {
                //skip ahead
                //if (Test.done === 0) Test.done = 39
                //else Test.done++
                Test.done++
                if (Test.done < Test.tests.length) nextTest()
                else {
                    //Done with test
                    TC_.closeActiveTool()

                    mmgisglobal.test = false
                }
            }
        }

        function nextTest() {
            Test.subtests = Test.tests[Test.done].subtests

            try {
                callback(Test.toolName, Test.tests[Test.done].name, true, true)
                Test.tests[Test.done].test(c)
            } catch (e) {
                console.log('Caught Testing Error:', e)
                c(e, false)
            }
        }
    },
    tests: [
        {
            name: 'Testing tables clear',
            subtests: 1,
            test: function (c) {
                calls.api(
                    'clear_test',
                    {},
                    function (d) {
                        c('Tables clear', d.status === 'success')
                    },
                    function () {
                        c("Tables don't clear", false)
                    }
                )
            },
        },
        {
            name: 'Check that we can get available files',
            subtests: 1,
            test: function (c) {
                Test.tool.getFiles(
                    function () {
                        c('Gets files from server', Test.tool.files != null)
                    },
                    function () {
                        c('Gets files from server', false)
                    }
                )
            },
        },
        {
            name: 'Check that we can add files',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Test File',
                    intent: 'all',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass =
                                    Test.tool.files[5] &&
                                    Test.tool.files[5].file_name === 'Test File'
                                c('Can make new files', pass)
                            },
                            function () {
                                c('Can make new files', false)
                            }
                        )
                    },
                    function () {
                        c('Can make new files', false)
                    }
                )
            },
        },
        {
            name: 'Check that we can alter files',
            subtests: 3,
            test: function (c) {
                var body = {
                    id: 6,
                    file_name: 'Test File Altered',
                    file_description: 'Description Altered',
                    public: 1,
                }
                Test.tool.changeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var f = Test.tool.files[5]
                                c(
                                    'Can alter file name',
                                    f.file_name === 'Test File Altered'
                                )
                                c(
                                    'Can alter file description',
                                    f.file_description === 'Description Altered'
                                )
                                c('Can alter file publicity', f.public === '1')
                            },
                            function () {
                                c('Can alter file name', false)
                                c('Can alter file description', false)
                                c('Can alter file publicity', false)
                            }
                        )
                    },
                    function () {
                        c('Can alter file name', false)
                        c('Can alter file description', false)
                        c('Can alter file publicity', false)
                    }
                )
            },
        },
        {
            name: 'Check that we can remove files',
            subtests: 1,
            test: function (c) {
                var body = {
                    id: 6,
                }
                Test.tool.removeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                c(
                                    'Can remove files',
                                    Test.tool.files.length === 5
                                )
                            },
                            function () {
                                c('Can remove files', false)
                            }
                        )
                    },
                    function () {
                        c('Can remove files', false)
                    }
                )
            },
        },
        {
            name: 'Check whether tabs work',
            subtests: 3,
            test: function (c) {
                c(
                    'Begins on Draw tab',
                    $('#drawToolDraw').css('display') != 'none'
                )

                Test.tool.showContent('shapes')
                c(
                    'Switches to Shapes tab',
                    $('#drawToolShapes').css('display') != 'none'
                )

                Test.tool.showContent('history')
                c(
                    'Switches to History tab',
                    $('#drawToolHistory').css('display') != 'none'
                )
            },
        },
        {
            name: 'Can reach initial drawing state',
            subtests: 5,
            test: function (c) {
                //Ignore lnglats_to_demtile_elevs in tests
                Test.tool.vars.demtilesets = null

                Test.tool.showContent('draw')
                c(
                    'Switches to Draw tab',
                    $('#drawToolDraw').css('display') != 'none'
                )

                $('#drawToolDrawFilesNewName').val('Test Drawings')
                c(
                    'Sets filename',
                    $('#drawToolDrawFilesNewName').val() == 'Test Drawings'
                )

                $('#drawToolDrawFilesNewDiv select').val('all')
                c(
                    'Sets intent',
                    $('#drawToolDrawFilesNewDiv select').val() == 'all'
                )

                $('#drawToolDrawFilesNew').click()
                setTimeout(function () {
                    c(
                        'Makes file for drawing',
                        $('#drawToolDrawFilesList').children().length == 1
                    )

                    $(
                        '#drawToolDrawFilesList > li:first-child .drawToolFileSelector'
                    ).click()
                    setTimeout(function () {
                        c(
                            'File can be selected',
                            $(
                                '#drawToolDrawFilesList > li:first-child'
                            ).hasClass('checked')
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        //Check that drawing polygons works
        {
            name: 'Polygon drawing',
            subtests: 2,
            test: function (c) {
                $('.drawToolDrawingTypePolygon').click()
                c(
                    'Switches to polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )
                var oldLength = L_.layers.layer['DrawTool_7'].length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.polygon.move()
                Test.tool.drawing.polygon.shape._latlngs = [
                    { lat: -4, lng: 137 },
                    { lat: -4, lng: 138 },
                    { lat: -5, lng: 137 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a polygon',
                        L_.layers.layer['DrawTool_7'].length == oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Line drawing',
            subtests: 2,
            test: function (c) {
                $('.drawToolDrawingTypeLine').click()
                c(
                    'Switches to line drawing',
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                var oldLength = F_.noNullLength(L_.layers.layer['DrawTool_7'])
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.line.move()
                Test.tool.drawing.line.shape._latlngs = [
                    { lat: -5, lng: 137.5 },
                    { lat: -4.5, lng: 137.5 },
                    { lat: -5, lng: 138 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a line',
                        F_.noNullLength(L_.layers.layer['DrawTool_7']) ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Point drawing',
            subtests: 2,
            test: function (c) {
                $('.drawToolDrawingTypePoint').click()
                c(
                    'Switches to point drawing',
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )

                var oldLength = F_.noNullLength(L_.layers.layer['DrawTool_7'])
                Test.tool.drawing.point.shape = { lat: -5, lng: 138 }
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a point',
                        F_.noNullLength(L_.layers.layer['DrawTool_7']) ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Text drawing',
            subtests: 2,
            test: function (c) {
                $('.drawToolDrawingTypeText').click()
                c(
                    'Switches to text drawing',
                    $('.drawToolDrawingTypeText').hasClass('active')
                )

                var oldLength = F_.noNullLength(L_.layers.layer['DrawTool_7'])
                Test.tool.drawing.annotation.shape = {
                    lat: -4.5,
                    lng: 137.5,
                }
                Test_.mapEvent('draw:drawstop')
                $('#DrawTool_ActiveAnnotation').val('Test Text')
                $('#DrawTool_ActiveAnnotation_Save').click()
                setTimeout(function () {
                    c(
                        'Draws and saves text',
                        F_.noNullLength(L_.layers.layer['DrawTool_7']) ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Arrow drawing',
            subtests: 2,
            test: function (c) {
                $('.drawToolDrawingTypeArrow').click()
                c(
                    'Switches to arrow drawing',
                    $('.drawToolDrawingTypeArrow').hasClass('active')
                )

                var oldLength = F_.noNullLength(L_.layers.layer['DrawTool_7'])
                Test.tool.drawing.arrow.start({
                    latlng: { lat: -4.5, lng: 137.5 },
                })
                Test.tool.drawing.arrow.stop({
                    latlng: { lat: -4.25, lng: 137.75 },
                })
                setTimeout(function () {
                    c(
                        'Draws and saves arrows',
                        F_.noNullLength(L_.layers.layer['DrawTool_7']) ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Polygon editing',
            subtests: 13,
            test: function (c) {
                Test.tool.showContent('shapes')

                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                $('#drawToolContextMenuPropertiesName').val('Polygon Changed')
                $('#drawToolContextMenuPropertiesDescription').text(
                    'Description Changed'
                )
                //$('.drawToolContextMenuStyleHeader i').click()
                $('.drawToolContextMenu .strokecolor').attr(
                    'v',
                    'rgb(255,255,255)'
                )
                $('.drawToolContextMenu .strokeopacity').attr('v', '0.5')
                $('.drawToolContextMenu .strokestyle').attr('v', '20')
                $('.drawToolContextMenu .strokeweight').attr('v', '8')
                $('.drawToolContextMenu .fillcolor').attr('v', 'rgb(0,0,0)')
                $('.drawToolContextMenu .fillopacity').attr('v', '0.5')
                //$( '.drawToolContextMenu .radius' ).attr( 'v', '10' )
                //Test.tool.contextMenuLayer.feature.geometry.coordinates[0][1][1] = 136
                Test.tool.contextMenuLayer._latlngs[0][1].lng = 136

                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    var f = Test.tool.contextMenuLayer.feature
                    var coords = f.geometry.coordinates
                    var p = f.properties
                    c('Edits name', p.name === 'Polygon Changed')
                    c(
                        'Edits description',
                        p.description === 'Description Changed'
                    )
                    c(
                        'Edits stroke color',
                        p.style.color === 'rgb(255,255,255)'
                    )
                    c('Edits stroke opacity', p.style.opacity === 0.5)
                    c('Edits stroke style', p.style.dashArray === '20')
                    c('Edits stroke weight', p.style.weight === 8)
                    c('Edits fill color', p.style.fillColor === 'rgb(0,0,0)')
                    c('Edits fill opacity', p.style.fillOpacity === 0.5)
                    c('Edits geometry', coords[0][1][0] === 136)

                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                    ).click()
                    c(
                        'Reopens context menu',
                        $('.drawToolContextMenu').length != null &&
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2)'
                            ).hasClass('active')
                    )
                    $('.drawToolContextMenuDelete').click()
                    $('.drawToolContextMenuDeleteYes').click()
                    setTimeout(function () {
                        c(
                            'Deletes polygon',
                            L_.layers.layer['DrawTool_7'][0] == null
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Line editing',
            subtests: 11,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                $('#drawToolContextMenuPropertiesName').val('Line Changed')
                $('#drawToolContextMenuPropertiesDescription').text(
                    'Description Changed'
                )
                $('.drawToolContextMenuStyleHeader i').click()
                $('.drawToolContextMenu .strokecolor').attr(
                    'v',
                    'rgb(255,255,255)'
                )
                $('.drawToolContextMenu .strokeopacity').attr('v', '0.5')
                $('.drawToolContextMenu .strokestyle').attr('v', '20')
                $('.drawToolContextMenu .strokeweight').attr('v', '8')

                //Test.tool.contextMenuLayer.feature.geometry.coordinates[0][0] = 136
                Test.tool.contextMenuLayer._latlngs[0].lng = 136
                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    var f = Test.tool.contextMenuLayer.feature
                    var coords = f.geometry.coordinates
                    var p = f.properties
                    c('Edits name', p.name === 'Line Changed')
                    c(
                        'Edits description',
                        p.description === 'Description Changed'
                    )
                    c(
                        'Edits stroke color',
                        p.style.color === 'rgb(255,255,255)'
                    )
                    c('Edits stroke opacity', p.style.opacity === 0.5)
                    c('Edits stroke style', p.style.dashArray === '20')
                    c('Edits stroke weight', p.style.weight === 8)

                    c('Edits geometry', coords[0][0] === 136)

                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                    ).click()
                    c(
                        'Reopens context menu',
                        $('.drawToolContextMenu').length != null &&
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2)'
                            ).hasClass('active')
                    )
                    $('.drawToolContextMenuDelete').click()
                    $('.drawToolContextMenuDeleteYes').click()
                    setTimeout(function () {
                        c(
                            'Deletes line',
                            L_.layers.layer['DrawTool_7'][1] == null
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Point editing',
            subtests: 13,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                $('#drawToolContextMenuPropertiesName').val('Point Changed')
                $('#drawToolContextMenuPropertiesDescription').text(
                    'Description Changed'
                )
                $('.drawToolContextMenuStyleHeader i').click()
                $('.drawToolContextMenu .strokecolor').attr(
                    'v',
                    'rgb(255,255,255)'
                )
                $('.drawToolContextMenu .strokeopacity').attr('v', '0.5')
                $('.drawToolContextMenu .strokestyle').attr('v', '20')
                $('.drawToolContextMenu .strokeweight').attr('v', 8)
                $('.drawToolContextMenu .fillcolor').attr('v', 'rgb(0,0,0)')
                $('.drawToolContextMenu .fillopacity').attr('v', 0.5)
                $('.drawToolContextMenu .radius').attr('v', 10)

                //Test.tool.contextMenuLayer.feature.geometry.coordinates = [-5,136]
                Test.tool.contextMenuLayer._latlng.lat = -5
                Test.tool.contextMenuLayer._latlng.lng = 136

                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    var f = Test.tool.contextMenuLayer.feature
                    var coords = f.geometry.coordinates
                    var p = f.properties
                    c('Edits name', p.name === 'Point Changed')
                    c(
                        'Edits description',
                        p.description === 'Description Changed'
                    )
                    c(
                        'Edits stroke color',
                        p.style.color === 'rgb(255,255,255)'
                    )
                    c('Edits stroke opacity', p.style.opacity === 0.5)
                    c('Edits stroke style', p.style.dashArray === '20')
                    c('Edits stroke weight', p.style.weight === 8)
                    c('Edits fill color', p.style.fillColor === 'rgb(0,0,0)')
                    c('Edits fill opacity', p.style.fillOpacity === 0.5)

                    c('Edits geometry', coords[1] === -5 && coords[0] === 136)

                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                    ).click()
                    c(
                        'Reopens context menu',
                        $('.drawToolContextMenu').length != null &&
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2)'
                            ).hasClass('active')
                    )
                    $('.drawToolContextMenuDelete').click()
                    $('.drawToolContextMenuDeleteYes').click()
                    setTimeout(function () {
                        c(
                            'Deletes point',
                            L_.layers.layer['DrawTool_7'][2] == null
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Text editing',
            subtests: 13,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                $('#drawToolContextMenuPropertiesName').val('Text Changed')
                $('#drawToolContextMenuPropertiesDescription').text(
                    'Description Changed'
                )
                $('.drawToolContextMenu .strokecolor').attr(
                    'v',
                    'rgb(255,255,255)'
                )
                $('.drawToolContextMenu .strokeopacity').attr('v', '0.5')
                $('.drawToolContextMenu .strokeweight').attr('v', 1)
                $('.drawToolContextMenu .fillcolor').attr('v', 'rgb(0,0,0)')
                $('.drawToolContextMenu .fillopacity').attr('v', 0.5)
                $('.drawToolContextMenu .fontsize').attr('v', '24px')
                Test.tool.contextMenuChanges.style.fontSize = true
                /*Test.tool.contextMenuLayer.feature.geometry.coordinates = [
                        -4.5,
                        136,
                    ]*/
                Test.tool.contextMenuLayer._latlng.lng = 136
                Test.tool.contextMenuLayer._latlng.lat = -4.5
                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    //var coords = Test.tool.contextMenuLayer._latlng
                    var f = Test.tool.contextMenuLayer.feature
                    var coords = f.geometry.coordinates

                    var p = Test.tool.contextMenuLayer.feature.properties

                    c('Edits name', p.name === 'Text Changed')
                    c(
                        'Edits description',
                        p.description === 'Description Changed'
                    )

                    c(
                        'Edits stroke color',
                        p.style.color === 'rgb(255,255,255)'
                    )
                    c('Edits stroke opacity', p.style.opacity === 0.5)
                    c('Edits stroke weight', p.style.weight === 1)
                    c('Edits fill color', p.style.fillColor === 'rgb(0,0,0)')
                    c('Edits fill opacity', p.style.opacity === 0.5)
                    c('Edits font size', p.style.fontSize === '24px')

                    c('Edits geometry', coords[1] === -4.5 && coords[0] === 136)

                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                    ).click()
                    c(
                        'Reopens context menu',
                        $('.drawToolContextMenu').length != null &&
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2)'
                            ).hasClass('active')
                    )
                    $('.drawToolContextMenuDelete').click()
                    $('.drawToolContextMenuDeleteYes').click()
                    setTimeout(function () {
                        c(
                            'Deletes text',
                            L_.layers.layer['DrawTool_7'][3] == null
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Arrow editing',
            subtests: 12,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                $('#drawToolContextMenuPropertiesName').val('Arrow Changed')
                $('#drawToolContextMenuPropertiesDescription').text(
                    'Description Changed'
                )
                $('.drawToolContextMenuStyleHeader i').click()
                $('.drawToolContextMenu .strokecolor').attr(
                    'v',
                    'rgb(255,255,255)'
                )
                $('.drawToolContextMenu .strokestyle').attr('v', '8 8')
                $('.drawToolContextMenu .strokeweight').attr('v', 2)
                $('.drawToolContextMenu .fillcolor').attr('v', 'rgb(0,0,0)')
                $('.drawToolContextMenu .radius').attr('v', 10)
                $('.drawToolContextMenu .width').attr('v', 2)
                $('.drawToolContextMenu .length').attr('v', 10)

                //We flip these just because
                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    var f = Test.tool.contextMenuLayer.feature
                    var p = f.properties
                    c('Edits name', p.name === 'Arrow Changed')
                    c(
                        'Edits description',
                        p.description === 'Description Changed'
                    )
                    c(
                        'Edits stroke color',
                        p.style.color === 'rgb(255,255,255)'
                    )
                    c('Edits stroke style', p.style.dashArray === '8 8')
                    c('Edits stroke weight', p.style.weight === 2)
                    c('Edits fill color', p.style.fillColor === 'rgb(0,0,0)')
                    c('Edits width', p.style.width === 2)
                    c('Edits length', p.style.length === '10')

                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                    ).click()
                    c(
                        'Reopens context menu',
                        $('.drawToolContextMenu').length != null &&
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2)'
                            ).hasClass('active')
                    )
                    $('.drawToolContextMenuDelete').click()
                    $('.drawToolContextMenuDeleteYes').click()
                    setTimeout(function () {
                        c(
                            'Deletes arrow',
                            L_.layers.layer['DrawTool_7'][4] == null
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Can make different intent files',
            subtests: 2,
            test: function (c) {
                Test.tool.showContent('draw')
                c(
                    'Switches to Draw tab',
                    $('#drawToolDraw').css('display') != 'none'
                )

                var body = {
                    file_name: 'Test ROI',
                    intent: 'roi',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        body = {
                            file_name: 'Test Trail',
                            intent: 'trail',
                        }
                        Test.tool.makeFile(
                            body,
                            function () {
                                Test.tool.getFiles(
                                    function () {
                                        var pass1 =
                                            Test.tool.files[1] &&
                                            Test.tool.files[1].file_name ===
                                                'Test ROI'
                                        var pass2 =
                                            Test.tool.files[4] &&
                                            Test.tool.files[4].file_name ===
                                                'Test Trail'
                                        c(
                                            'Can make different files',
                                            pass1 && pass2
                                        )
                                        Test.tool.populateFiles()
                                    },
                                    function () {
                                        c('Can make different files', false)
                                    }
                                )
                            },
                            function () {
                                c('Can make different files', false)
                            }
                        )
                    },
                    function () {
                        c('Can make different files', false)
                    }
                )
            },
        },
        {
            name: 'Can edit file information',
            subtests: 5,
            test: function (c) {
                setTimeout(function () {
                    $(
                        '#drawToolDrawFilesList > li:nth-child(2) .drawToolFileEdit'
                    ).click()
                    c(
                        'Can open file popup',
                        $('.mmgisModal .drawToolFileEditOn').css('display') !=
                            'none'
                    )

                    $('.mmgisModal .drawToolFileNameInput').val(
                        'Test Trail Altered'
                    )
                    $('.mmgisModal .drawToolFileDesc').text(
                        'Description Altered'
                    )
                    $('.mmgisModal #drawToolFileEditOnPublicityDropdown').val(
                        'private'
                    )
                    $('.mmgisModal .drawToolFileSave').click()

                    setTimeout(function () {
                        $(
                            '#drawToolDrawFilesList > li:nth-child(2) .drawToolFileEdit'
                        ).click()

                        c(
                            'File name updates',
                            $(
                                '#drawToolDrawFilesList > li:nth-child(2) .drawToolFileName'
                            ).text() === 'Test Trail Altered'
                        )
                        c(
                            'File name input updates',
                            $('.mmgisModal .drawToolFileNameInput').val() ===
                                'Test Trail Altered'
                        )
                        c(
                            'File description updates',
                            $('.mmgisModal .drawToolFileDesc').text() ===
                                'Description Altered'
                        )
                        c(
                            'File publicity updates',
                            $(
                                '.mmgisModal #drawToolFileEditOnPublicityDropdown'
                            ).val() == 'private'
                        )

                        $('.mmgisModal .drawToolFileCancel').click()
                    }, Test.timeout * 3)
                }, Test.timeout)
            },
        },
        {
            name: 'Can filter files',
            subtests: 3,
            test: function (c) {
                var count = 0

                //On
                $('#drawToolDrawSortDiv > div[type="on"]').click()
                setTimeout(function () {
                    count = 0
                    $('#drawToolDrawFilesList > li').each(function () {
                        if ($(this).css('height') != '0px') count++
                    })
                    c('Filters on', count === 1)

                    //Public
                    $('#drawToolDrawSortDiv > div[type="on"]').click()
                    $('#drawToolDrawSortDiv > div[type="public"]').click()
                    setTimeout(function () {
                        count = 0
                        $('#drawToolDrawFilesList > li').each(function () {
                            if ($(this).css('height') != '0px') count++
                        })
                        c('Filters public', count === 2)

                        //Name
                        $('#drawToolDrawSortDiv > div[type="public"]').click()
                        $('#drawToolDrawFilter').val('ra').trigger('input')
                        setTimeout(function () {
                            count = 0
                            $('#drawToolDrawFilesList > li').each(function () {
                                if ($(this).css('height') != '0px') count++
                            })
                            c('Filters name', count === 2)
                        }, Test.timeout)
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Recognize on layers',
            subtests: 1,
            test: function (c) {
                TC_.closeActiveTool()
                TC_.makeTool(Test.toolName)

                setTimeout(function () {
                    var count = 0
                    $('#drawToolDrawSortDiv > div[type="on"]').click()

                    setTimeout(function () {
                        count = 0
                        $('#drawToolDrawFilesList > li').each(function () {
                            if ($(this).css('height') != '0px') count++
                        })
                        c('Recognizes on layers', count === 1)
                        $('#drawToolDrawSortDiv > div[type="on"]').click()
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Add roi file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent ROI',
                    intent: 'roi',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent ROI'
                                    )
                                        pass = true
                                }
                                c('Added roi file', pass)
                            },
                            function () {
                                c('Added roi file', false)
                            }
                        )
                    },
                    function () {
                        c('Added roi file', false)
                    }
                )
            },
        },
        {
            name: 'Add campaign file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent Campaign',
                    intent: 'campaign',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent Campaign'
                                    )
                                        pass = true
                                }
                                c('Added campaign file', pass)
                            },
                            function () {
                                c('Added campaign file', false)
                            }
                        )
                    },
                    function () {
                        c('Added campaign file', false)
                    }
                )
            },
        },
        {
            name: 'Add campsite file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent Campsite',
                    intent: 'campsite',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent Campsite'
                                    )
                                        pass = true
                                }
                                c('Added campsite file', pass)
                            },
                            function () {
                                c('Added campsite file', false)
                            }
                        )
                    },
                    function () {
                        c('Added campsite file', false)
                    }
                )
            },
        },
        {
            name: 'Add trail file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent Trail',
                    intent: 'trail',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent Trail'
                                    )
                                        pass = true
                                }
                                c('Added trail file', pass)
                            },
                            function () {
                                c('Added trail file', false)
                            }
                        )
                    },
                    function () {
                        c('Added trail file', false)
                    }
                )
            },
        },
        {
            name: 'Add signpost file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent Signpost',
                    intent: 'signpost',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent Signpost'
                                    )
                                        pass = true
                                }
                                c('Added signpost file', pass)
                            },
                            function () {
                                c('Added signpost file', false)
                            }
                        )
                    },
                    function () {
                        c('Added signpost file', false)
                    }
                )
            },
        },
        {
            name: 'Add map file',
            subtests: 1,
            test: function (c) {
                var body = {
                    file_name: 'Intent Map',
                    intent: 'all',
                }
                Test.tool.makeFile(
                    body,
                    function () {
                        Test.tool.getFiles(
                            function () {
                                var pass = false
                                for (var i in Test.tool.files) {
                                    if (
                                        Test.tool.files[i].file_name ===
                                        'Intent Map'
                                    )
                                        pass = true
                                }
                                c('Added map', pass)
                            },
                            function () {
                                c('Added map file', false)
                            }
                        )
                    },
                    function () {
                        c('Added map file', false)
                    }
                )
            },
        },
        {
            name: 'Check roi shape restrictions',
            subtests: 4,
            test: function (c) {
                Test.tool.populateFiles()

                setTimeout(function () {
                    $(
                        '.drawToolDrawFilesListElem[file_name="Intent ROI"] .drawToolFileName'
                    ).click()
                    c(
                        'Sets to polygon drawing',
                        $('.drawToolDrawingTypePolygon').hasClass('active')
                    )

                    $('.drawToolDrawingTypeLine').click()
                    c(
                        "Can't switch to line drawing",
                        $('.drawToolDrawingTypePolygon').hasClass('active')
                    )

                    $('.drawToolDrawingTypePoint').click()
                    c(
                        "Can't switch to point drawing",
                        $('.drawToolDrawingTypePolygon').hasClass('active')
                    )

                    $('.drawToolDrawingTypeText').click()
                    c(
                        "Can't switch to text drawing",
                        $('.drawToolDrawingTypePolygon').hasClass('active')
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Check campaign shape restrictions',
            subtests: 4,
            test: function (c) {
                $(
                    '.drawToolDrawFilesListElem[file_name="Intent Campaign"] .drawToolFileName'
                ).click()
                c(
                    'Sets to polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypeLine').click()
                c(
                    "Can't switch to line drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypePoint').click()
                c(
                    "Can't switch to point drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypeText').click()
                c(
                    "Can't switch to text drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )
            },
        },
        {
            name: 'Check campsite shape restrictions',
            subtests: 4,
            test: function (c) {
                $(
                    '.drawToolDrawFilesListElem[file_name="Intent Campsite"] .drawToolFileName'
                ).click()
                c(
                    'Sets to polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypeLine').click()
                c(
                    "Can't switch to line drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypePoint').click()
                c(
                    "Can't switch to point drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypeText').click()
                c(
                    "Can't switch to text drawing",
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )
            },
        },
        {
            name: 'Check trail shape restrictions',
            subtests: 4,
            test: function (c) {
                $(
                    '.drawToolDrawFilesListElem[file_name="Intent Trail"] .drawToolFileName'
                ).click()
                c(
                    'Sets to line drawing',
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                $('.drawToolDrawingTypePolygon').click()
                c(
                    "Can't switch to polygon drawing",
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                $('.drawToolDrawingTypePoint').click()
                c(
                    "Can't switch to point drawing",
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                $('.drawToolDrawingTypeText').click()
                c(
                    "Can't switch to text drawing",
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )
            },
        },
        {
            name: 'Check signpost shape restrictions',
            subtests: 4,
            test: function (c) {
                $(
                    '.drawToolDrawFilesListElem[file_name="Intent Signpost"] .drawToolFileName'
                ).click()
                c(
                    'Sets to point drawing',
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )

                $('.drawToolDrawingTypePolygon').click()
                c(
                    "Can't switch to polygon drawing",
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )

                $('.drawToolDrawingTypeLine').click()
                c(
                    "Can't switch to line drawing",
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )

                $('.drawToolDrawingTypeText').click()
                c(
                    "Can't switch to text drawing",
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )
            },
        },
        {
            name: 'Check no map shape restrictions',
            subtests: 4,
            test: function (c) {
                $(
                    '.drawToolDrawFilesListElem[file_name="Intent Map"] .drawToolFileName'
                ).click()
                c(
                    'Sets to polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                $('.drawToolDrawingTypeLine').click()
                c(
                    'Can switch to line drawing',
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                $('.drawToolDrawingTypePoint').click()
                c(
                    'Can switch to point drawing',
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )

                $('.drawToolDrawingTypeText').click()
                c(
                    'Can switch to text drawing',
                    $('.drawToolDrawingTypeText').hasClass('active')
                )
            },
        },
        {
            name: 'Can draw polygons over, under and through',
            subtests: 6,
            test: function (c) {
                var fileId = $(
                    '.drawToolDrawFilesListElem[file_name="Intent Map"]'
                ).attr('file_id')
                var layerId = 'DrawTool_' + fileId

                $('.drawToolDrawingTypePolygon').click()

                $("#drawToolDrawSettingsTier > div[value='off']").click()
                c(
                    'Switches to off mode',
                    $("#drawToolDrawSettingsTier > div[value='off']").hasClass(
                        'active'
                    )
                )

                var oldLength = L_.layers.layer[layerId].length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.polygon.move()
                Test.tool.drawing.polygon.shape._latlngs = [
                    { lat: -4, lng: 138 },
                    { lat: -4, lng: 137 },
                    { lat: -5, lng: 137 },
                    { lat: -5, lng: 138 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws polygon off',
                        L_.layers.layer[layerId].length == oldLength + 1
                    )

                    $("#drawToolDrawSettingsTier > div[value='over']").click()
                    c(
                        'Switches to over mode',
                        $(
                            "#drawToolDrawSettingsTier > div[value='over']"
                        ).hasClass('active')
                    )

                    oldLength = L_.layers.layer[layerId].filter(Boolean).length
                    Test_.mapEvent('click')
                    Test_.fireEvent('mousemove', 300, 300)
                    Test.tool.drawing.polygon.move()
                    Test.tool.drawing.polygon.shape._latlngs = [
                        { lat: -4.25, lng: 137.75 },
                        { lat: -4.25, lng: 137.25 },
                        { lat: -4.75, lng: 137.25 },
                        { lat: -4.75, lng: 137.75 },
                    ]
                    Test_.mapEvent('draw:drawstop')
                    setTimeout(function () {
                        c(
                            'Draws polygon over',
                            L_.layers.layer[layerId].filter(Boolean).length ==
                                oldLength + 1
                        )

                        $(
                            "#drawToolDrawSettingsTier > div[value='under']"
                        ).click()
                        c(
                            'Switches to under mode',
                            $(
                                "#drawToolDrawSettingsTier > div[value='under']"
                            ).hasClass('active')
                        )

                        oldLength =
                            L_.layers.layer[layerId].filter(Boolean).length
                        Test_.mapEvent('click')
                        Test_.fireEvent('mousemove', 300, 300)
                        Test.tool.drawing.polygon.move()
                        Test.tool.drawing.polygon.shape._latlngs = [
                            { lat: -4.5, lng: 139 },
                            { lat: -4.5, lng: 137.5 },
                            { lat: -6, lng: 137.5 },
                            { lat: -6, lng: 139 },
                        ]
                        Test_.mapEvent('draw:drawstop')
                        setTimeout(function () {
                            c(
                                'Draws polygon under',
                                L_.layers.layer[layerId].filter(Boolean)
                                    .length ==
                                    oldLength + 1
                            )
                        }, Test.timeout * 2)
                    }, Test.timeout * 2)
                }, Test.timeout * 2)
            },
        },
        {
            name: 'Prepare state for group testing',
            subtests: 3,
            test: function (c) {
                var fileId = $(
                    '.drawToolDrawFilesListElem[file_name="Intent Map"]'
                ).attr('file_id')
                var layerId = 'DrawTool_' + fileId

                $('.drawToolDrawingTypeLine').click()
                c(
                    'Switch to line drawing',
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )

                var oldLength = L_.layers.layer[layerId].filter(Boolean).length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.line.move()
                Test.tool.drawing.line.shape._latlngs = [
                    { lat: -5, lng: 137.5 },
                    { lat: -4.5, lng: 137.5 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draw and save a line',
                        L_.layers.layer[layerId].filter(Boolean).length ==
                            oldLength + 1
                    )

                    Test.tool.refreshFile(15, null, true)
                    setTimeout(function () {
                        Test.tool.showContent('shapes')
                        c(
                            'Switch to Shapes tab',
                            $('#drawToolShapes').css('display') != 'none'
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Check group selecting',
            subtests: 11,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(3) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )
                c(
                    'Not a group',
                    !$('.drawToolContextMenuHeaderName').hasClass('group')
                )
                $('.drawToolContextMenuHeaderCount > span').text() === 'x2'

                mmgisglobal.shiftDown = true
                $('#drawToolShapesFeaturesList > li:nth-child(5) > div').click()
                c(
                    'Select range of features with shift',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    ) &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(4)'
                        ).hasClass('active') &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(5)'
                        ).hasClass('active')
                )

                c(
                    'Group context menu',
                    $('.drawToolContextMenuHeaderCount > span').text() === 'x3'
                )
                mmgisglobal.shiftDown = false

                $('#drawToolShapesFeaturesList > li:nth-child(3) > div').click()
                mmgisglobal.ctrlDown = true
                $('#drawToolShapesFeaturesList > li:nth-child(5) > div').click()
                c(
                    'Add to group of features with ctrl',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    ) &&
                        !$(
                            '#drawToolShapesFeaturesList > li:nth-child(4)'
                        ).hasClass('active') &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(5)'
                        ).hasClass('active')
                )
                c(
                    'Group context menu',
                    $('.drawToolContextMenuHeaderCount > span').text() === 'x2'
                )
                mmgisglobal.ctrlDown = false

                $('#drawToolShapesFeaturesList > li:nth-child(3) > div').click()
                mmgisglobal.shiftDown = true
                $('#drawToolShapesFeaturesList > li:nth-child(6) > div').click()
                c(
                    'Select range of features with shift leaves out mismatched intents',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    ) &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(4)'
                        ).hasClass('active') &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(5)'
                        ).hasClass('active') &&
                        !$(
                            '#drawToolShapesFeaturesList > li:nth-child(6)'
                        ).hasClass('active')
                )
                c(
                    'Group context menu',
                    $('.drawToolContextMenuHeaderCount > span').text() === 'x3'
                )
                mmgisglobal.shiftDown = false

                $('#drawToolShapesFeaturesList > li:nth-child(3) > div').click()
                mmgisglobal.ctrlDown = true
                $('#drawToolShapesFeaturesList > li:nth-child(6) > div').click()
                c(
                    'Add to group of features with ctrl ignores mismatched intents',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    ) &&
                        !$(
                            '#drawToolShapesFeaturesList > li:nth-child(6)'
                        ).hasClass('active')
                )
                c(
                    'Not a group',
                    !$('.drawToolContextMenuHeaderName').hasClass('group')
                )
                mmgisglobal.ctrlDown = false
            },
        },
        {
            name: 'Check group copying shapes',
            subtests: 2,
            test: function (c) {
                mmgisglobal.ctrlDown = false
                mmgisglobal.shiftDown = false
                $('#drawToolShapesFeaturesList > li:nth-child(3) > div').click()
                mmgisglobal.shiftDown = true
                $('#drawToolShapesFeaturesList > li:nth-child(5) > div').click()
                c(
                    'Selected range of features with shift',
                    $('#drawToolShapesFeaturesList > li:nth-child(3)').hasClass(
                        'active'
                    ) &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(4)'
                        ).hasClass('active') &&
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(5)'
                        ).hasClass('active')
                )
                mmgisglobal.shiftDown = false

                Test.tool.copyFileId = 7
                $('#drawToolShapesCopyGo').click()
                setTimeout(function () {
                    c(
                        'Copies shapes to other files',
                        $('#drawToolShapesFeaturesList').children().length === 9
                    )
                }, Test.timeout * 3)
            },
        },
        {
            name: 'Merging Polygons',
            subtests: 3,
            test: function (c) {
                Test.tool.showContent('draw')
                setTimeout(function () {
                    $(
                        '#drawToolDrawFilesList > li:last-child .drawToolFileSelector'
                    ).click()
                    let layerId = 'DrawTool_7'
                    let oldLength =
                        L_.layers.layer[layerId].filter(Boolean).length
                    Test_.mapEvent('click')
                    Test_.fireEvent('mousemove', 300, 300)
                    Test.tool.drawing.polygon.move()
                    Test.tool.drawing.polygon.shape._latlngs = [
                        { lat: -5, lng: 140 },
                        { lat: -5, lng: 138 },
                        { lat: -7, lng: 138 },
                        { lat: -7, lng: 140 },
                    ]
                    Test_.mapEvent('draw:drawstop')
                    setTimeout(function () {
                        c(
                            'Draws a new polygon for merging',
                            L_.layers.layer[layerId].filter(Boolean).length ==
                                oldLength + 1
                        )
                        Test.tool.showContent('draw')
                        setTimeout(function () {
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(2) > div'
                            ).click()
                            mmgisglobal.ctrlDown = true
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(4) > div'
                            ).click()

                            c(
                                'Group context menu',
                                $(
                                    '.drawToolContextMenuHeaderCount > span'
                                ).text() === 'x2'
                            )
                            mmgisglobal.ctrlDown = false
                            $(
                                `.drawToolContextMenuTabButton[tab='drawToolContextMenuTabSetOperations']`
                            ).click()
                            $(
                                '.drawToolContextMenuTabSOMerge > ul > li:last-child > div:last-child'
                            ).addClass('on')
                            $('.drawToolContextMenuTabSOMergeMerge').click()
                            setTimeout(function () {
                                c(
                                    'Merged to one polygon',
                                    $(
                                        '.drawToolContextMenuHeaderCount > span'
                                    ).text() === 'x1'
                                )
                            }, Test.timeout * 2)
                        }, Test.timeout)
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Prepare state for Lead testing',
            subtests: 1,
            test: function (c) {
                $(
                    '#drawToolDrawFilesListMaster .drawToolDrawFilesListElem[file_id="1"] .drawToolFileSelector'
                ).click()
                $('.drawToolFileCheckbox.on').each(function () {
                    $(this).click()
                })
                //Remember: you can't turn off the file you're drawing in so ROI will stay on
                c(
                    'Turns all files off',
                    $('.drawToolFileCheckbox.on').length === 1
                )
            },
        },
        {
            name: 'Lead can draw ROIs',
            subtests: 2,
            test: function (c) {
                c(
                    'Starts on polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )

                var oldLength =
                    L_.layers.layer['DrawTool_1'].filter(Boolean).length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.polygon.move()
                Test.tool.drawing.polygon.shape._latlngs = [
                    { lat: -4, lng: 138 },
                    { lat: -4, lng: 137 },
                    { lat: -5, lng: 137 },
                    { lat: -5, lng: 138 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a Lead ROI',
                        L_.layers.layer['DrawTool_1'].filter(Boolean).length ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Lead can draw Campaigns',
            subtests: 3,
            test: function (c) {
                $(
                    '#drawToolDrawFilesListMaster .drawToolDrawFilesListElem[file_id="2"] .drawToolFileSelector'
                ).click()
                c(
                    'Starts on polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )
                var oldLength =
                    L_.layers.layer['DrawTool_2'].filter(Boolean).length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.polygon.move()
                Test.tool.drawing.polygon.shape._latlngs = [
                    { lat: -4.25, lng: 137.5 },
                    { lat: -4.25, lng: 137.1 },
                    { lat: -4.5, lng: 137.1 },
                    { lat: -4.5, lng: 137.5 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a Lead Campaign',
                        L_.layers.layer['DrawTool_2'].filter(Boolean).length ==
                            oldLength + 1
                    )

                    Test_.mapEvent('click')
                    Test_.fireEvent('mousemove', 300, 300)
                    Test.tool.drawing.polygon.move()
                    Test.tool.drawing.polygon.shape._latlngs = [
                        { lat: -4.25, lng: 136.5 },
                        { lat: -4.25, lng: 136.1 },
                        { lat: -4.5, lng: 136.1 },
                        { lat: -4.5, lng: 136.5 },
                    ]
                    Test_.mapEvent('draw:drawstop')
                    setTimeout(function () {
                        c(
                            'Draws and saves another Lead Campaign',
                            L_.layers.layer['DrawTool_2'].filter(Boolean)
                                .length ==
                                oldLength + 2
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Lead can draw Campsites',
            subtests: 2,
            test: function (c) {
                $(
                    '#drawToolDrawFilesListMaster .drawToolDrawFilesListElem[file_id="3"] .drawToolFileSelector'
                ).click()
                c(
                    'Starts on polygon drawing',
                    $('.drawToolDrawingTypePolygon').hasClass('active')
                )
                var oldLength =
                    L_.layers.layer['DrawTool_3'].filter(Boolean).length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.polygon.move()
                Test.tool.drawing.polygon.shape._latlngs = [
                    { lat: -4.4, lng: 137.6 },
                    { lat: -4.4, lng: 137.4 },
                    { lat: -4.6, lng: 137.4 },
                    { lat: -4.6, lng: 137.6 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a Lead Campsite',
                        L_.layers.layer['DrawTool_3'].filter(Boolean).length ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Lead can draw Trails',
            subtests: 2,
            test: function (c) {
                $(
                    '#drawToolDrawFilesListMaster .drawToolDrawFilesListElem[file_id="4"] .drawToolFileSelector'
                ).click()
                c(
                    'Starts on line drawing',
                    $('.drawToolDrawingTypeLine').hasClass('active')
                )
                var oldLength =
                    L_.layers.layer['DrawTool_4'].filter(Boolean).length
                Test_.mapEvent('click')
                Test_.fireEvent('mousemove', 300, 300)
                Test.tool.drawing.line.move()
                Test.tool.drawing.line.shape._latlngs = [
                    { lat: -4.7, lng: 136.8 },
                    { lat: -4.7, lng: 138.2 },
                ]
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a Lead Trail',
                        L_.layers.layer['DrawTool_4'].filter(Boolean).length ==
                            oldLength + 1
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Lead can draw Signposts',
            subtests: 3,
            test: function (c) {
                $(
                    '#drawToolDrawFilesListMaster .drawToolDrawFilesListElem[file_id="5"] .drawToolFileSelector'
                ).click()
                c(
                    'Starts on point drawing',
                    $('.drawToolDrawingTypePoint').hasClass('active')
                )
                var oldLength =
                    L_.layers.layer['DrawTool_5'].filter(Boolean).length
                Test.tool.drawing.point.shape = { lat: -4.45, lng: 137.45 }
                Test_.mapEvent('draw:drawstop')
                setTimeout(function () {
                    c(
                        'Draws and saves a Lead Signpost',
                        L_.layers.layer['DrawTool_5'].filter(Boolean).length ==
                            oldLength + 1
                    )

                    Test.tool.drawing.point.shape = {
                        lat: -4.45,
                        lng: 136.45,
                    }
                    Test_.mapEvent('draw:drawstop')
                    setTimeout(function () {
                        c(
                            'Draws and saves another Lead Signpost',
                            L_.layers.layer['DrawTool_5'].filter(Boolean)
                                .length ==
                                oldLength + 2
                        )
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Lead Reviews and finds errors',
            subtests: 1,
            test: function (c) {
                $('.drawToolMasterReview').click()

                setTimeout(function () {
                    c(
                        'Finds seven errors',
                        $('#drawToolReviewContent li > div.error').length === 7
                    )
                }, Test.timeout * 3)
            },
        },
        {
            name: 'Lead Review fixes errors (part 1)',
            subtests: 3,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(4) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(4)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )

                Test.tool.contextMenuLayer._latlngs[0][0].lng = 137.75
                Test.tool.contextMenuLayer._latlngs[0][2].lat = -4.75
                Test.tool.contextMenuLayer._latlngs[0][3].lat = -4.75
                Test.tool.contextMenuLayer._latlngs[0][3].lng = 137.75

                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    c(
                        'Finds five errors',
                        $('#drawToolReviewContent li > div.error').length === 5
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Lead Review fixes errors (part 2)',
            subtests: 3,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()
                c(
                    'Highlights editing feature',
                    $('#drawToolShapesFeaturesList > li:nth-child(2)').hasClass(
                        'active'
                    )
                )
                c(
                    'Context menu opened',
                    $('.drawToolContextMenu').length != null
                )
                Test.tool.contextMenuLayer._latlngs[0][1].lng = 136
                Test.tool.contextMenuLayer._latlngs[0][2].lng = 136

                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    c(
                        'Finds four errors',
                        $('#drawToolReviewContent li > div.error').length === 4
                    )
                }, Test.timeout)
            },
        },
        {
            name: 'Lead Review fixes errors (part 3)',
            subtests: 1,
            test: function (c) {
                $('#drawToolShapesFeaturesList > li:nth-child(2) > div').click()

                $('#drawToolContextMenuPropertiesName').val('Polygon 1')

                $('.drawToolContextMenuSaveChanges').click()
                $('.drawToolContextMenuHeaderClose').click()

                setTimeout(function () {
                    $(
                        '#drawToolShapesFeaturesList > li:nth-child(4) > div'
                    ).click()

                    $('#drawToolContextMenuPropertiesName').val('Polygon 2')

                    $('.drawToolContextMenuSaveChanges').click()
                    $('.drawToolContextMenuHeaderClose').click()

                    setTimeout(function () {
                        $(
                            '#drawToolShapesFeaturesList > li:nth-child(5) > div'
                        ).click()

                        $('#drawToolContextMenuPropertiesName').val('Polygon 3')

                        $('.drawToolContextMenuSaveChanges').click()
                        $('.drawToolContextMenuHeaderClose').click()

                        setTimeout(function () {
                            $(
                                '#drawToolShapesFeaturesList > li:nth-child(11) > div'
                            ).click()

                            $('#drawToolContextMenuPropertiesName').val(
                                'Point 6'
                            )

                            $('.drawToolContextMenuSaveChanges').click()
                            $('.drawToolContextMenuHeaderClose').click()

                            setTimeout(function () {
                                c(
                                    'Finds no errors',
                                    $('#drawToolReviewContent li > div.error')
                                        .length === 0
                                )
                            }, Test.timeout * 2)
                        }, Test.timeout)
                    }, Test.timeout)
                }, Test.timeout)
            },
        },
        {
            name: 'Lead Publishes',
            subtests: 3,
            test: function (c) {
                $('#drawToolReviewPublish').click()

                setTimeout(function () {
                    Test.tool.showContent('draw')
                    setTimeout(function () {
                        c(
                            'Switches to Draw tab',
                            $('#drawToolDraw').css('display') != 'none'
                        )

                        $('.drawToolFileMasterCheckbox').click()
                        c(
                            'All files are off',
                            $('.drawToolFileCheckbox.on').length === 0
                        )

                        $('.drawToolDrawPublishedCheckbox').click()
                        setTimeout(function () {
                            Test.tool.showContent('shapes')
                            c(
                                'Published',
                                $('#drawToolShapesFeaturesList > li').length ===
                                    11
                            )
                            $('#drawToolReviewTopbarClose').click()
                        }, Test.timeout)
                    }, Test.timeout)
                }, Test.timeout * 3)
            },
        },
    ],
}

export default Test
