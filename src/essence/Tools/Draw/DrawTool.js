import DrawTool_Drawing from './DrawTool_Drawing'
import DrawTool_Editing from './DrawTool_Editing'
import DrawTool_Files from './DrawTool_Files'
import DrawTool_History from './DrawTool_History'
import DrawTool_SetOperations from './DrawTool_SetOperations'
import DrawTool_Publish from './DrawTool_Publish'
import DrawTool_Shapes from './DrawTool_Shapes'

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'
import turf from 'turf'
import shp from '../../../external/shpjs/shapefile'
import shpwrite from '../../../external/SHPWrite/shpwrite'

import calls from '../../../pre/calls'

import './DrawTool.css'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div id='drawTool' style='width: 100%;'>",
      "<div id='drawToolNotLoggedIn'>",
        "<div>Please log in before drawing</div>",
      "</div>",
      "<div id='drawToolNav'>",
        "<div type='draw' id='drawToolNavButtonDraw' class='drawToolNavButton' title='Draw'>",
          "<i class='mdi mdi-lead-pencil mdi-18px'></i>",
        "</div>",
        "<div type='shapes' class='drawToolNavButton' title='Features'>",
          "<i class='mdi mdi-shape mdi-18px'></i>",
        "</div>",
        "<div type='history' class='drawToolNavButton' title='History'>",
          "<i id='drawToolHistoryButton' class='mdi mdi-history mdi-18px'></i>",
        "</div>",
      "</div>",
      "<div id='drawToolContents'>",
        
        "<div id='drawToolDraw'>",
          "<div id='drawToolDrawShapes'>",
            "<div id='drawToolDrawFilesNewDiv'>",
                "<div id='drawToolFileUpload'>",
                    "<i class='mdi mdi-upload mdi-18px'></i>",
                    "<input title='Upload' type=file accept='.json, .geojson, .shp, .dbf' multiple>",
                "</div>",
                "<input id='drawToolDrawFilesNewName' type='text' placeholder='New File' />",
                "<select>",
                    "<option id='drawToolNewFileAll' value='all'>Map</option>",
                    "<option id='drawToolNewFileROI' value='roi'>ROI</option>",
                    "<option id='drawToolNewFileCampaign' value='campaign'>Campaign</option>",
                    "<option id='drawToolNewFileCampsite' value='campsite'>Campsite</option>",
                    "<option id='drawToolNewFileTrail' value='trail'>Trail</option>",
                    "<option id='drawToolNewFileSignpost' value='signpost'>Signpost</option>",
                    //"<option value='note'>Note</option>",
                "</select>",
                "<i id='drawToolDrawFilesNew' title='Make new file' class='mdi mdi-plus mdi-18px'></i>",
                "<div id='drawToolDrawFilesNewLoading'><div></div></div>",
            "</div>",
            //"<div id='drawToolDrawingInIndicator'>Choose a file to draw in</div>",
            "<div id='drawToolDrawingCont'>",
                "<div id='drawToolDrawingTypeDiv'>",
                    "<div class='drawToolDrawingTypePolygon' draw='polygon' title='Polygon'><i class='mdi mdi-vector-square mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypeLine' draw='line' title='Line'><i class='mdi mdi-vector-line mdi-24px'></i></div>",
                    "<div class='drawToolDrawingTypePoint' draw='point' title='Point'><i class='mdi mdi-square-medium-outline mdi-24px'></i></div>",
                    "<div class='drawToolDrawingTypeText' draw='text' title='Text'><i class='mdi mdi-format-text mdi-24px'></i></div>",
                    "<div class='drawToolDrawingTypeArrow' draw='arrow' title='Arrow'><i class='mdi mdi-arrow-top-right mdi-24px'></i></div>",
                "</div>",
                "<div id='drawToolDrawingSettingsToggle' title='Draw Settings'><i class='mdi mdi-settings mdi-18px'></i></div>",
            "</div>",
            "<div id='drawToolDrawSettings'>",
                "<div id='drawToolDrawSettingsBody'>",
                    "<ul>",
                        "<li>",
                            "<div title='Clip drawing or existing shapes'>Draw Clipping</div>",
                            "<div id='drawToolDrawSettingsTier' class='drawToolRadio'>",
                                "<div value='over'>Over</div>",
                                "<div class='active' value='under'>Under</div>",
                                "<div value='off'>Off</div>",
                            "</div>",
                        "</li>",
                        "<li>",
                            "<div title='Auto vertex spacing or click to add'>Draw Resolution</div>",
                            "<div id='drawToolDrawSettingsMode' class='drawToolRadio'>",
                                "<div value='on'><span>On</span><input id='drawToolDrawSettingsModeVertexRes' type='number' step='1' value='10'/></div>",
                                "<div class='active' value='off'>Off</div>",
                            "</div>",
                        "</li>",
                        "<li>",
                            "<div title='Enable snapping in edit mode'>Edit Snapping</div>",
                            "<div id='drawToolDrawSnapMode' class='drawToolRadio'>",
                                "<div value='on'>On</div>",
                                "<div class='active' value='off'>Off</div>",
                            "</div>",
                        "</li>",
                    "</ul>",
                "</div>",
            "</div>",
            /*
            "<div id='drawToolDrawIntentFilterDiv'>",
              "<div intent='roi' tooltip='Region of Interest'>R</div>",
              "<div intent='campaign' tooltip='Campaign'>C</div>",
              "<div intent='campsite' tooltip='Campsite'>C</div>",
              "<div intent='trail' tooltip='Trail'>T</div>",
              "<div intent='signpost' tooltip='Signpost'>S</div>",
              //"<div intent='note' tooltip='Note'>N</div>",
              "<div intent='all' tooltip='Map'>M</div>",
            "</div>",
            */
            "<div id='drawToolDrawFilterDivToolTip'></div>",
            "<div id='drawToolDrawFilterDiv2'>",
              //"<div id='drawToolDrawFilterCount'></div>",
              //"<div id='drawToolDrawFilterDiv'>",
              "<div id='drawToolDrawFilterByTagAutocomplete'>",
                "<div id='drawToolDrawFilterByTagAutocompleteClose' title='Close tags'></div>",
                "<div id='drawToolDrawFilterByTagAutocompleteHeading'>",
                    "<div id='drawToolDrawFilterByTagAutocompleteTitle'>#Tags</div>",
                    "<select id='drawToolDrawFilterByTagAutocompleteSort' class='ui dropdown dropdown_2 unsetMaxWidth'>",
                        `<option value='relevance' selected>Relevance</option>`,
                        `<option value='alphabetical'>Alphabetical</option>`,
                        `<option value='count'>Count</option>`,
                    "</select>",
                "</div>",
                "<ul id='drawToolDrawFilterByTagAutocompleteList'>",
                "</ul>",
              "</div>",
              `<input id='drawToolDrawFilter' type='text' placeholder='Filter Files' autocomplete='off' title="Filter over a file's name, author and description.\nUse '#{tag}' to search over keywords."/>`,
              "<div id='drawToolDrawFilterClear'><i class='mdi mdi-close mdi-18px'></i></div>",
              //"</div>",
                /*
                "<div class='drawToolFilterDropdown'>",
                    "<input type='checkbox' id='checkbox-toggle'>",
                    "<label for='checkbox-toggle'><i class='mdi mdi-dots-vertical mdi-18px'></i></label>",
                    "<ul>",
                        "<li intent='roi'><div id='drawToolFilterDropdownROI'>Regions of Interest</div><div class='drawToolFilterCheckbox'></div></li>",
                        "<li intent='campaign'><div id='drawToolFilterDropdownCampaign'>Campaigns</div><div class='drawToolFilterCheckbox'></div></li>",
                        "<li intent='campsite'><div id='drawToolFilterDropdownCampsite'>Campsites</div><div class='drawToolFilterCheckbox'></div></li>",
                        "<li intent='trail'><div id='drawToolFilterDropdownTrail'>Trails</div><div class='drawToolFilterCheckbox'></div></li>",
                        "<li intent='signpost'><div id='drawToolFilterDropdownSignpost'>Signposts</div><div class='drawToolFilterCheckbox'></div></li>",
                        "<li intent='all'><div id='drawToolFilterDropdownAll'>Maps</div><div class='drawToolFilterCheckbox'></div></li>",
                    "</ul>",
                "</div>",
                */
            "</div>",
            
            "<div id='drawToolDrawFilterOptions'>",
                "<div id='drawToolDrawFilterByTag' title='Filter by Tag'><i class='mdi mdi-tag-text mdi-18px'></i></div>",
                "<div id='drawToolDrawSortDiv'>",
                    "<div type='public' title='Public Only'><i class='mdi mdi-shield-outline mdi-14px'></i></div>",
                    "<div type='owned' title='Yours Only' class='active'><i class='mdi mdi-account mdi-18px'></i></div>",
                    "<div type='on' title='On Only'><i class='mdi mdi-eye mdi-18px'></i></div>",
                    //"<div><i class='mdi mdi-account-tie mdi-18px'></i></div>",
                "</div>",
            "</div>",
          "</div>",
          "<div id='drawToolDrawFiles'>",
            "<div id='drawToolDrawFilesContent'>",
                "<div id='drawToolDrawPublished'>",
                    "<div class='flexbetween'>",
                        "<div>Latest Map</div>",
                        "<div class='drawToolDrawPublishedCheckbox'></div>",
                    "</div>",
                "</div>",
              "<div id='drawToolMaster'>",
                "<div id='drawToolMasterHeader'>",
                    "<div class='flexbetween'>",
                        "<div class='drawToolMasterHeaderLeft'>",
                            "<div class='drawToolMasterHeaderLeftLeft'>",
                                "<div class='drawToolMasterHeaderIntent'></div>",
                                "<div class='drawToolMasterHeaderChevron'><i class='mdi mdi-chevron-right mdi-24px'></i></div>",
                                "<div>Lead Maps</div>",
                            "</div>",
                            "<div class='drawToolMasterHeaderLeftRight'>",
                                "<div class='drawToolMasterReview'>Review</div>",
                            "</div>",
                        "</div>",
                        "<div class='drawToolFileMasterCheckbox'></div>",
                    "</div>",
                "</div>",
                "<ul id='drawToolDrawFilesListMaster' class='mmgisScrollbar'>",
                "</ul>",
              "</div>",
              "<ul id='drawToolDrawFilesList' class='mmgisScrollbar'>",
              "</ul>",
            "</div>",
          "</div>",
        "</div>",

        "<div id='drawToolShapes'>",
          "<div id='drawToolShapesFilterDiv'>",
            "<input id='drawToolShapesFilter' type='text' placeholder='Filter Shapes' />",
            "<div id='drawToolShapesFilterClear'><i id='drawToolDrawFilesNew' class='mdi mdi-close mdi-18px'></i></div>",
            "<div id='drawToolShapesFilterCount'></div>",
          "</div>",
          "<div id='drawToolDrawShapesList' class='mmgisScrollbar'>",
            "<ul id='drawToolShapesFeaturesList' class='unselectable'>",
            "</ul>",
          "</div>",
          "<div id='drawToolShapesCopyDiv'>",
            "<div>Copy to</div>",
            "<div id='drawToolShapesCopyDropdown'></div>",
            "<div id='drawToolShapesCopyGo'>Go</div>",
          "</div>",
          "<div id='drawToolShapesCopyMessageDiv'></div>",
        "</div>",
        
        "<div id='drawToolHistory'>",
          "<div id='drawToolHistoryFile'></div>",
          "<div id='drawToolHistoryContent'>",
            "<div id='drawToolHistoryToolbar'>",
              "<input id='drawToolHistoryTime' />",
              "<div id='drawToolHistoryNow'>Now</div>",
            "</div>",
            "<div id='drawToolHistoryViewer'>",
              "<div id='drawToolHistorySequence'>",
                "<div id='drawToolHistorySave'>",
                  "Nothing to Undo",
                "</div>",
                "<div id='drawToolHistorySequenceList'>",
                  "<ul></ul>",
                "</div>",
              "</div>",
            "</div>",
          "</div>",
        "</div>",
      
      "</div>",
      "<div id='drawToolEdit'>",
      "</div>",
      "<div id='drawToolMouseoverText'>",
      "</div>",
    "</div>"
  ].join('\n');

var DrawTool = {
    height: 0,
    width: 250,
    vars: {},
    //host: window.location.hostname,
    open: true,
    userGroups: [],
    defaultColor: '#999',
    hoverColor: '#000',
    activeColor: '#fff',
    activeBG: 'var(--color-a)',
    files: {},
    activeContent: 'draw',
    intentType: null,
    currentFileId: null,
    filesOn: [],
    allTags: {}, //<tag>: count, ...
    tags: [],
    labelsOn: [],
    palettes: [
        [
            '#26a8ff',
            '#26ff3f',
            '#fff726',
            '#ff2626',
            '#dc26ff',
            '#4626ff',
            '#00538a',
            '#008a10',
            '#8a8500',
            '#8a0000',
            '#73008a',
            '#15008a',
        ],
    ],
    isEditing: false,
    copyFileId: null,
    copyFilename: null,
    lastShapeIndex: null,
    lastShapeIntent: null, //so that shapes can only be grouped by intent
    lastContextLayerIndexFileId: {},
    highlightColor: 'rgb(41, 20, 8)',
    highlightBorder: '2px solid rgb(38, 255, 103)',
    highlightGradient: 'linear-gradient( to left, #26ff67, rgb(127,255,0) )',
    noteIcon: null,
    contextMenuLayer: null,
    contextMenuLayers: [],
    contextMenuChanges: {
        use: false,
        props: {},
        style: {},
    },
    snapping: false,
    timeInHistory: null,
    isReviewOpen: false,
    masterFileIds: [],
    MMGISInterface: null,
    intents: [
        'roi',
        'campaign',
        'campsite',
        'trail',
        'signpost',
        'note',
        'all',
    ],
    intentOrder: [
        'all',
        'roi',
        'campaign',
        'campsite',
        'trail',
        'signpost',
        'note',
        'master',
    ], //how to maintain layer orders (first on bottom)
    intentNameMapping: {
        all: 'Map',
        roi: 'L1 Polygon',
        campaign: 'L2 Polygon',
        campsite: 'L3 Polygon',
        trail: 'Line',
        signpost: 'Point',
        note: 'Note',
        master: 'master',
    },
    defaultStyle: {
        color: 'rgb(255, 255, 255)',
        opacity: 1,
        fillColor: 'rgb(0, 0, 0)',
        fillOpacity: 0.4,
        weight: 2,
        radius: 4,
    },
    categoryStyles: {
        roi: {
            color: 'rgb(190, 38, 51)',
            opacity: 1,
            fillColor: 'rgb(190, 38, 51)',
            fillOpacity: 0.2,
            weight: 2,
        },
        campaign: {
            color: 'rgb(235, 137, 49)',
            opacity: 1,
            fillColor: 'rgb(235, 137, 49)',
            fillOpacity: 0.2,
            weight: 2,
        },
        campsite: {
            color: 'rgb(247, 226, 107)',
            opacity: 1,
            fillColor: 'rgb(247, 226, 107)',
            fillOpacity: 0.2,
            weight: 2,
        },
        trail: {
            color: 'rgb(163, 206, 39)',
            weight: 5,
            fillColor: 'rgb(163, 206, 39)',
            opacity: 1,
        },
        signpost: {
            color: 'rgb(39, 146, 206)',
            radius: 6,
            fillColor: 'rgb(39, 146, 206)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.4,
        },
        note: {
            color: 'rgb(0, 0, 0)',
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fontSize: '18px',
        },

        all: {
            color: 'rgb(255, 255, 255)',
            radius: 2,
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
        },
        polygon: {
            color: 'rgb(255, 255, 255)',
            radius: 2,
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
        },
        line: {
            color: 'rgb(255, 255, 255)',
            radius: 2,
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
        },
        point: {
            color: 'rgb(255, 255, 255)',
            radius: 6,
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.4,
        },
        text: {
            color: 'rgb(0, 0, 0)',
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fontSize: '18px',
        },
        arrow: {
            color: 'rgb(0, 0, 0)',
            radius: 30, //used as arrowhead limb pixel length
            fillColor: 'rgb(255, 255, 255)',
            width: 8, //width of line
            length: 'Full', //length of line body
            weight: 2, //outline
            opacity: 1,
            fillOpacity: 1,
            dashArray: '',
            lineCap: 'round', //'round' | 'butt' | 'square'
            lineJoin: 'miter', //'bevel' | 'bevel' | 'miter'
        },
        master: {
            color: '#fff',
        },
    },
    initialize: function () {
        this.vars = L_.getToolVars('draw')

        //Set up intent mapping if any
        // This just maps the internal intent names to whatever is configured
        if (this.vars.intents) {
            if (this.vars.intents[0])
                this.intentNameMapping.roi = this.vars.intents[0]
            if (this.vars.intents[1])
                this.intentNameMapping.campaign = this.vars.intents[1]
            if (this.vars.intents[2])
                this.intentNameMapping.campsite = this.vars.intents[2]
            if (this.vars.intents[3])
                this.intentNameMapping.trail = this.vars.intents[3]
            if (this.vars.intents[4])
                this.intentNameMapping.signpost = this.vars.intents[4]
        }

        //Bring in other scripts
        DrawTool_Drawing.init(DrawTool)
        DrawTool_Editing.init(DrawTool)
        DrawTool_Files.init(DrawTool)
        DrawTool_History.init(DrawTool)
        DrawTool_SetOperations.init(DrawTool)
        DrawTool_Publish.init(DrawTool)
        DrawTool_Shapes.init(DrawTool)

        //Turn on files from url
        if (L_.FUTURES.tools) {
            for (var t of L_.FUTURES.tools) {
                var tUrl = t.split('$')
                if (tUrl[0] == 'DrawTool') {
                    var fileIds = tUrl[1].split('.')
                    for (var f of fileIds) {
                        this.toggleFile(parseInt(f))
                    }
                    break
                }
            }
        }
    },
    make: function () {
        DrawTool.open = true
        DrawTool.files = {}
        DrawTool.activeContent = 'draw'
        DrawTool.intentType = null
        DrawTool.currentFileId = null
        //DrawTool.filesOn = [];
        DrawTool.isEditing = false

        $('.drawToolContextMenuHeaderClose').click()

        DrawTool.contextMenuLayers = []
        DrawTool.copyFileId = null
        DrawTool.copyFilename = null
        DrawTool.lastShapeIndex = null
        DrawTool.lastShapeIntent = null
        DrawTool.lastContextLayerIndexFileId = {}
        DrawTool.timeInHistory = null

        var Icon = L.Icon.extend({
            options: {
                iconSize: [16, 37],
                iconAnchor: [8, 18],
                popupAnchor: [8, 18],
            },
        })
        DrawTool.noteIcon = new Icon({
            iconUrl: 'public/images/icons/beamcursor.png',
        })

        DrawTool.userGroups = []
        if (
            typeof mmgisglobal.groups === 'object' &&
            mmgisglobal.groups !== null
        ) {
            DrawTool.userGroups = mmgisglobal.groups
        }

        this.MMGISInterface = new interfaceWithMMGIS()
        //Start on the draw tab
        $('#drawToolNavButtonDraw').click()

        DrawTool.getFiles(function () {
            DrawTool.setDrawing(true)
            DrawTool.populateFiles()

            //Populate masterFilesIds
            DrawTool.masterFileIds = []
            for (var f in DrawTool.files) {
                if (DrawTool.files[f].is_master)
                    DrawTool.masterFileIds.push(DrawTool.files[f].id)
            }
        })

        $('#drawToolDrawPublished > div').on('click', function () {
            $(this).toggleClass('on')
            DrawTool.toggleFile('master', null, true, true)
        })

        if (DrawTool.userGroups.indexOf('mmgis-group') == -1) {
            $('.drawToolMasterReview').remove()
        } else {
            $('.drawToolMasterReview').on('click', function () {
                DrawTool.showReview()
            })
        }

        $('#drawToolDrawSnapMode > div').on('click', function () {
            var value = $(this).attr('value')
            DrawTool.snapping = value === 'on' ? true : false

            $(this).parent().find('div').removeClass('active')
            $(this).addClass('active')
        })
        //Upload
        $('#drawToolFileUpload > input').on('change', function (evt) {
            $('#drawToolDrawFilesNewLoading').css('opacity', '1')
            $('#drawToolFileUpload > i').css('color', '#1169d3')

            var files = evt.target.files // FileList object

            // use the 1st file from the list
            var f = files[0]
            var ext = F_.getExtension(f.name).toLowerCase()
            switch (ext) {
                case 'shp':
                case 'dbf':
                    var shpFile
                    var dbfFile
                    for (var i = 0; i < files.length; i++) {
                        if (
                            F_.getExtension(files[i].name).toLowerCase() ==
                            'shp'
                        )
                            shpFile = files[i]
                        if (
                            F_.getExtension(files[i].name).toLowerCase() ==
                            'dbf'
                        )
                            dbfFile = files[i]
                    }
                    if (shpFile && dbfFile) {
                        var shpBuffer
                        var dbfBuffer

                        var readerSHP = new FileReader()
                        readerSHP.onload = function (e) {
                            shpBuffer = e.target.result
                            var readerDBF = new FileReader()
                            readerDBF.onload = function (e) {
                                dbfBuffer = e.target.result
                                bothLoaded()
                            }
                            readerDBF.readAsArrayBuffer(dbfFile)
                        }
                        readerSHP.readAsArrayBuffer(shpFile)

                        function bothLoaded() {
                            var featureArray = []
                            shp.open(shpBuffer, dbfBuffer)
                                .then((source) =>
                                    source.read().then(function log(result) {
                                        if (result.done) {
                                            var geojsonResult = F_.getBaseGeoJSON()
                                            geojsonResult.features = featureArray
                                            var body = {
                                                file_name: f.name,
                                                intent: 'all',
                                                geojson: JSON.stringify(
                                                    geojsonResult
                                                ),
                                            }
                                            DrawTool.makeFile(
                                                body,
                                                function () {
                                                    DrawTool.populateFiles()
                                                    endLoad()
                                                }
                                            )
                                            return
                                        }

                                        featureArray.push(
                                            F_.geoJSONFeatureMetersToDegrees(
                                                result.value
                                            )
                                        )
                                        return source.read().then(log)
                                    })
                                )
                                .catch((error) => {
                                    endLoad()
                                })
                        }
                    } else {
                        CIU('Warning! FileManager - missing .shp or .dbf')
                    }
                    break
                case 'geojson':
                    var reader = new FileReader()
                    // Closure to capture the file information.

                    reader.onload = (function (file) {
                        return function (e) {
                            var body = {
                                file_name: file.name,
                                intent: 'all',
                                geojson: e.target.result,
                            }
                            DrawTool.makeFile(body, function () {
                                DrawTool.populateFiles()
                                endLoad()
                            })
                        }
                    })(f)

                    // Read in the image file as a data URL.
                    reader.readAsText(f)
                    break
                default:
                    CIU(
                        'Only .json, .geojson and .shp (with .dbf) files may be uploaded'
                    )
            }

            function endLoad() {
                $('#drawToolDrawFilesNewLoading').css('opacity', '0')
                $('#drawToolFileUpload > i').css('color', 'unset')
            }
            function CIU(message) {
                CursorInfo.update(
                    message,
                    6000,
                    true,
                    { x: 295, y: 6 },
                    '#e9ff26',
                    'black'
                )
                endLoad()
            }
        })
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return this.filesOn.toString().replace(/,/g, '.')
    },
    showContent: function (type) {
        //Go to back to latest history after leaving history
        if (DrawTool.activeContent === 'history' && type !== 'history')
            DrawTool.refreshFile(DrawTool.currentFileId, null, true)

        DrawTool.activeContent = type
        $('.drawToolNavButton.active').removeClass('active')
        $('#drawToolNav [type="' + type + '"]').addClass('active')

        $('#drawToolContents > div').css('display', 'none')

        switch (type) {
            case 'draw':
                $('.drawToolContextMenuHeaderClose').click()
                DrawTool.setDrawing()
                $('#drawToolDraw').css('display', 'flex')
                break
            case 'shapes':
                DrawTool.lastShapeIntent = null
                $('#drawToolShapesCopyDropdown *').remove()
                DrawTool.endDrawing()
                DrawTool.populateShapes()
                $('#drawToolShapes').css('display', 'inherit')
                break
            case 'history':
                $('.drawToolContextMenuHeaderClose').click()
                DrawTool.endDrawing()
                DrawTool.populateHistory()
                $('#drawToolHistory').css('display', 'flex')
                break
        }
    },
    getInnerLayers(obj, n) {
        var innerLayers = obj
        for (var i = 0; i < n; i++) {
            if (innerLayers.hasOwnProperty('_layers'))
                innerLayers = innerLayers._layers.getFirst()
        }
        return innerLayers
    },
    getFileObjectWithId(id) {
        if (id === 'master')
            return {
                id: 'master',
                public: '0',
                intent: 'master',
                file_owner: 'master',
                file_name: 'published',
            }
        id = parseInt(id)
        for (var i = 0; i < DrawTool.files.length; i++) {
            if (DrawTool.files[i].id == id) return DrawTool.files[i]
        }
    },
    // Return in pinned then last modified order
    getAllTags() {
        let tags = []
        for (var i = 0; i < DrawTool.files.length; i++) {
            tags = tags.concat(
                DrawTool.getTagsFromFileDescription(
                    DrawTool.files[i].file_description
                ).map((t) => {
                    return {
                        tag: t,
                        modified: Date.parse(DrawTool.files[i].updated_on),
                    }
                })
            )
        }
        tags = tags.sort((a, b) => a.modified - b.modified)
        tags = tags.map((t) => t.tag)

        if (DrawTool.vars.preferredTags)
            tags = DrawTool.vars.preferredTags.concat(tags.reverse())
        else tags = tags.reverse()

        let allTags = {}
        tags.forEach((tag) => {
            if (allTags[tag] != null) allTags[tag] = allTags[tag] + 1
            else
                allTags[tag] =
                    DrawTool.vars.preferredTags &&
                    DrawTool.vars.preferredTags.includes(tag)
                        ? 0
                        : 1
        })
        return allTags
    },
    getTagsFromFileDescription(file_description) {
        if (typeof file_description !== 'string') return []
        const tags = file_description.match(/#\w*/g) || []
        const uniqueTags = [...tags]
        // remove '#'s
        return uniqueTags.map((t) => t.substring(1))
    },
    stripTagsFromDescription(file_description) {
        if (typeof file_description !== 'string') return ''
        return file_description.replaceAll(/#\w*/g, '').trimStart().trimEnd()
    },
    getFiles: function (callback) {
        calls.api(
            'files_getfiles',
            {},
            function (data) {
                if (data) {
                    //sort files by intent and the alphabetically by name within intent
                    //sort alphabetically first
                    data.body.sort(F_.dynamicSort('-file_name'))
                    var sortedBody = []

                    for (var i = 0; i < DrawTool.intents.length; i++) {
                        for (var j = data.body.length - 1; j >= 0; j--) {
                            if (data.body[j].intent == DrawTool.intents[i]) {
                                sortedBody.push(data.body[j])
                                data.body.splice(j, 1)
                            }
                        }
                    }
                    DrawTool.files = sortedBody

                    DrawTool.allTags = DrawTool.getAllTags()
                    DrawTool.tags = Object.keys(DrawTool.allTags)
                }
                if (typeof callback === 'function') callback()
            },
            function (data) {
                if (data.message == 'User is not logged in.') {
                    $('#drawToolNotLoggedIn').css('display', 'inherit')
                }
            }
        )
    },
    makeFile: function (body, callback) {
        calls.api(
            'files_make',
            body,
            function (data) {
                DrawTool.getFiles(callback)
            },
            function () {}
        )
    },
    getFile: function (body, callback) {
        calls.api(
            'files_getfile',
            body,
            function (data) {
                if (typeof callback === 'function')
                    callback(data ? data.body : null)
            },
            function () {}
        )
    },
    changeFile: function (body, callback, failure) {
        calls.api(
            'files_change',
            body,
            function (data) {
                if (typeof callback === 'function') callback(data.body)
            },
            function () {
                if (typeof failure === 'function') failure()
            }
        )
    },
    removeFile: function (body, callback, failureCallback) {
        calls.api(
            'files_remove',
            body,
            function (data) {
                if (typeof callback === 'function') callback(data.body)
            },
            function (data) {
                if (typeof failureCallback === 'function') failureCallback()
            }
        )
    },
    compileFile: function (body, callback) {
        calls.api(
            'files_compile',
            body,
            function (data) {
                if (typeof callback === 'function') callback(data)
            },
            function () {}
        )
    },
    getHistoryFile: function (fileId, successCallback, failureCallback) {
        calls.api(
            'files_gethistory',
            { id: fileId },
            function (data) {
                if (typeof successCallback === 'function')
                    successCallback(data.body)
            },
            function () {
                if (typeof failureCallback === 'function') failureCallback()
            }
        )
    },
    addDrawing: function (body, callback, failure) {
        if (body.file_id == null) {
            CursorInfo.update(
                'No file chosen. Please select or make a file for drawings.',
                6000,
                true,
                { x: 295, y: 6 },
                '#e9ff26',
                'black'
            )
            if (typeof failure === 'function') failure()
            return
        }
        if (DrawTool.vars.demtilesets) {
            F_.lnglatsToDemtileElevs(
                JSON.parse(body.geometry),
                DrawTool.vars.demtilesets,
                function (data) {
                    body.geometry = JSON.stringify(data)
                    add()
                    //geoJSON = F_.geojsonAddSpatialProperties(geoJSON)
                }
            )
        } else {
            add()
        }
        function add() {
            calls.api(
                'draw_add',
                body,
                function (data) {
                    if (DrawTool.isReviewOpen) DrawTool.showReview(false)
                    if (typeof callback === 'function') callback(data.body)
                },
                function (err) {
                    let message = err ? err.message : 'Server Failure'
                    CursorInfo.update(message, 6000, true, { x: 295, y: 6 })
                    if (typeof failure === 'function') failure()
                }
            )
        }
    },
    removeDrawing: function (body, callback, failureCallback) {
        calls.api(
            'draw_remove',
            body,
            function (data) {
                if (typeof callback === 'function') callback(data.body)
            },
            function () {
                if (typeof failureCallback === 'function') failureCallback()
            }
        )
    },
    undo: function (body, callback, failure) {
        calls.api(
            'draw_undo',
            body,
            function (data) {
                if (typeof callback === 'function') callback(data.body)
            },
            function () {
                if (typeof failure === 'function') failure()
            }
        )
    },
    prettyIntent: function (intent) {
        return (DrawTool.intentNameMapping[intent] || intent) + 's'
    },
    expandPointprops(geojson) {
        for (var i = 0; i < geojson.features.length; i++) {
            if (
                geojson.features[i].geometry.type.toLowerCase() ==
                    'linestring' &&
                geojson.features[i].properties.hasOwnProperty('pointprops')
            ) {
                let masterI = i

                let pp = geojson.features[i].properties.pointprops
                delete geojson.features[i].properties.pointprops

                geojson.features[i].properties.group = masterI

                for (
                    var j = 0;
                    j < geojson.features[masterI].geometry.coordinates.length;
                    j++
                ) {
                    var feature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates:
                                geojson.features[masterI].geometry.coordinates[
                                    j
                                ],
                        },
                        properties: {
                            group: masterI,
                        },
                    }
                    var len = pp.order.length
                    for (var k = 0; k < len; k++) {
                        feature.properties[pp.order[k]] = pp.props[j * len + k]
                    }
                    geojson.features.splice(i + 1, 0, feature)
                    i++
                }
            }
        }
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    //MMGIS should always have a div with id 'tools'
    var tools = d3.select('#toolPanel')
    tools.style('background', 'var(--color-g)')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    //Add the markup to tools or do it manually
    tools.html(markup)
    //Force intent mappings
    $('#drawToolNewFileAll').html(DrawTool.intentNameMapping.all)
    $('#drawToolNewFileROI').html(DrawTool.intentNameMapping.roi)
    $('#drawToolNewFileCampaign').html(DrawTool.intentNameMapping.campaign)
    $('#drawToolNewFileCampsite').html(DrawTool.intentNameMapping.campsite)
    $('#drawToolNewFileTrail').html(DrawTool.intentNameMapping.trail)
    $('#drawToolNewFileSignpost').html(DrawTool.intentNameMapping.signpost)
    $('#drawToolFilterDropdownAll').html(DrawTool.intentNameMapping.all + 's')
    $('#drawToolFilterDropdownROI').html(DrawTool.intentNameMapping.roi + 's')
    $('#drawToolFilterDropdownCampaign').html(
        DrawTool.intentNameMapping.campaign + 's'
    )
    $('#drawToolFilterDropdownCampsite').html(
        DrawTool.intentNameMapping.campsite + 's'
    )
    $('#drawToolFilterDropdownTrail').html(
        DrawTool.intentNameMapping.trail + 's'
    )
    $('#drawToolFilterDropdownSignpost').html(
        DrawTool.intentNameMapping.signpost + 's'
    )

    if (F_.getBrowser() == 'firefox')
        $('#drawToolDrawFiles').css('max-height', 'calc(100vh - 313px)')

    $('#drawToolDrawingSettingsToggle').on('click', function () {
        $('#drawToolDrawingSettingsToggle').toggleClass('active')
        $('#drawToolDrawSettings').toggleClass('active')
    })

    $('#drawToolDrawSettingsTier > div').on('click', function () {
        $(this).parent().find('div').removeClass('active')
        $(this).addClass('active')
    })

    $('#drawToolDrawSettingsMode > div').on('click', function () {
        $(this).parent().find('div').removeClass('active')
        $(this).addClass('active')
    })

    //Set master checkbox on if all the master files are on
    if (
        DrawTool.filesOn.indexOf(1) != -1 &&
        DrawTool.filesOn.indexOf(2) != -1 &&
        DrawTool.filesOn.indexOf(3) != -1 &&
        DrawTool.filesOn.indexOf(4) != -1 &&
        DrawTool.filesOn.indexOf(5) != -1
    ) {
        $('.drawToolFileMasterCheckbox').addClass('on')
    }

    //Switching Nav tabs
    $('.drawToolNavButton').on('click', function () {
        DrawTool.showContent($(this).attr('type'))
    })

    //Switching draw intent
    $('#drawToolShapesWrapper > div').on('click', function () {
        if ($(this).hasClass('active')) {
            if (!$(this).hasClass('open')) {
                $('#drawToolShapesWrapper').css(
                    'background',
                    'rgb(38, 168, 255)'
                )
                $('#drawToolShapesWrapper').css('height', '100%')
            } else {
                $('#drawToolShapesWrapper').css('background', 'rgba(0,0,0,0)')
                $('#drawToolShapesWrapper').css('height', 'auto')
            }

            $('#drawToolShapesWrapper > div').toggleClass('open')
        } else {
            $('#drawToolShapesWrapper > div').removeClass('open')
            $('#drawToolShapesWrapper > div.active').removeClass('active')
            $(this).addClass('active')
            var intent = $(this).attr('type')

            if (DrawTool.intentType != intent) {
                DrawTool.intentType = intent
                DrawTool.setDrawing(true)
                DrawTool.populateFiles()
            }

            $('#drawToolShapesWrapper').css('background', 'rgba(0,0,0,0)')
            $('#drawToolShapesWrapper').css('height', 'auto')
        }
    })

    //Submit on enter
    $('#drawToolDrawFilesNewName').keypress(function (e) {
        if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
            //enter
            $('#drawToolDrawFilesNewName').blur()
            $('#drawToolDrawFilesNew').click()
            return false
        } else return true
    })

    //Adding a new file
    $('#drawToolDrawFilesNew').on('click', function () {
        var val = $('#drawToolDrawFilesNewName').val()
        var intent = $('#drawToolDrawFilesNewDiv > select').val()
        if (val == null || val == '') {
            CursorInfo.update(
                'Please enter a file name.',
                6000,
                true,
                { x: 295, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }
        if (/[&\'\"<>]/g.test(val)) {
            CursorInfo.update(
                'Invalid file name.',
                6000,
                true,
                { x: 295, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }
        var body = {
            file_name: val || 'New File',
            intent: intent,
        }
        DrawTool.makeFile(body, function () {
            DrawTool.populateFiles()

            $('#drawToolDrawFilesNewName').val('')
        })
    })

    //Copy shapes
    $('#drawToolShapesCopyGo').on('click', function () {
        if (DrawTool.copyFileId == null) {
            CursorInfo.update(
                'Please select a file to copy shapes to.',
                6000,
                true,
                { x: 295, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }
        //First check that all the selected intents match
        //We don't allow copying of varied intent shapes
        var intents = []
        $('.drawToolShapeLi').each(function (i, elm) {
            if ($(elm).hasClass('active')) {
                intents.push($(elm).attr('intent'))
            }
        })

        var files_i = F_.objectArrayIndexOfKeyWithValue(
            DrawTool.files,
            'id',
            parseInt(DrawTool.copyFileId)
        )
        var filename = files_i !== -1 ? DrawTool.files[files_i].file_name : null
        var numToCopy = intents.length
        var copied = 0
        var elmArray = []

        //Check all intents match
        var commonIntents = F_.identicalElements(intents)
        if (commonIntents) {
            $('#drawToolShapesCopyMessageDiv').text(
                'Copied ' + copied + '/' + numToCopy + ' into ' + filename
            )
            $('#drawToolShapesCopyMessageDiv').css({
                opacity: 1,
                'pointer-events': 'inherit',
            })

            var copyBodies = []
            $('.drawToolShapeLi').each(function (i, elm) {
                if ($(elm).hasClass('active')) {
                    var layer = $(elm).attr('layer')
                    var index = $(elm).attr('index')
                    var shape = L_.layersGroup[layer][index]

                    elmArray.push({ l: layer, i: index })

                    var feature
                    if (
                        (!shape.feature ||
                            (shape.feature &&
                                shape.feature.properties.arrow != true)) &&
                        shape.hasOwnProperty('_layers')
                    )
                        feature = JSON.parse(
                            JSON.stringify(
                                shape._layers[Object.keys(shape._layers)[0]]
                                    .feature
                            )
                        )
                    else feature = JSON.parse(JSON.stringify(shape.feature))

                    var file_id = DrawTool.copyFileId
                    var intent = $(elm).attr('intent')
                    var properties = feature.properties
                    delete properties._
                    var geometry = feature.geometry

                    var toFileIntent = DrawTool.getFileObjectWithId(file_id)
                        .intent

                    if (intent == 'polygon') {
                        if (
                            toFileIntent == 'roi' ||
                            toFileIntent == 'campaign' ||
                            toFileIntent == 'campsite'
                        )
                            intent = toFileIntent
                    } else if (intent == 'line') {
                        if (toFileIntent == 'trail') intent = toFileIntent
                    } else if (intent == 'point') {
                        if (toFileIntent == 'signpost') intent = toFileIntent
                    }

                    copyBodies.push({
                        file_id: file_id,
                        intent: intent,
                        shape: {
                            type: 'Feature',
                            properties: properties,
                            geometry: geometry,
                        },
                    })
                }
            })

            if (copyBodies.length > 0) copyLoop(0)
            function copyLoop(i) {
                //Stop recursion
                if (i >= copyBodies.length) {
                    // Only refresh if already on
                    if (
                        DrawTool.filesOn.indexOf(
                            parseInt(copyBodies[0].file_id)
                        ) != -1
                    )
                        DrawTool.refreshFile(copyBodies[0].file_id, null, true)
                    if (copied >= numToCopy) {
                        //rehighlight each shapeli
                        for (var s in elmArray) {
                            $(
                                '#drawToolShapeLiItem_' +
                                    elmArray[s].l +
                                    '_' +
                                    elmArray[s].i
                            ).addClass('active')
                        }
                        setTimeout(function () {
                            $('#drawToolShapesCopyMessageDiv').css({
                                opacity: 0,
                                'pointer-events': 'none',
                            })
                        }, 2000)
                    }
                } else {
                    DrawTool.drawOver(copyBodies[i], 'off', function () {
                        copied++
                        $('#drawToolShapesCopyMessageDiv').text(
                            'Copied ' +
                                copied +
                                '/' +
                                numToCopy +
                                ' into ' +
                                filename
                        )
                        copyLoop(i + 1)
                    })
                }
            }
        } else {
            CursorInfo.update(
                'Please select shapes to copy.',
                6000,
                true,
                { x: 295, y: 6 },
                '#e9ff26',
                'black'
            )
        }
    })

    //HISTORY
    $('#drawToolHistorySave').on('click', function () {
        if (
            DrawTool.currentFileId == null ||
            DrawTool.timeInHistory == null ||
            !$(this).hasClass('active')
        )
            return
        DrawTool.undo(
            {
                file_id: DrawTool.currentFileId,
                undo_time: DrawTool.timeInHistory,
            },
            function () {
                DrawTool.populateHistory()
            },
            function () {
                console.log('History save failed')
            }
        )
    })

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        DrawTool.endDrawing()
        $('.drawToolContextMenuHeaderClose').click()
        DrawTool.open = false
    }
}

export default DrawTool
