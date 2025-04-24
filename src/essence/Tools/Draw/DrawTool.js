import DrawTool_Drawing from './DrawTool_Drawing'
import DrawTool_Editing from './DrawTool_Editing'
import DrawTool_Files from './DrawTool_Files'
import DrawTool_History from './DrawTool_History'
import DrawTool_Publish from './DrawTool_Publish'
import DrawTool_Shapes from './DrawTool_Shapes'
import DrawTool_FileModal from './DrawTool_FileModal'
import DrawTool_Templater from './DrawTool_Templater'

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Description from '../../Ancillary/Description'
import TimeControl from '../../Ancillary/TimeControl'
import { Kinds } from '../../../pre/tools'
import turf from 'turf'

import calls from '../../../pre/calls'

import './DrawTool.css'

import tippy from 'tippy.js'
import hotkeys from 'hotkeys-js'

// Plugins
import DrawTool_Geologic from './Plugins/Geologic/DrawTool_Geologic'
import DrawTool_SetOperations from './Plugins/SetOperations/DrawTool_SetOperations'
// Plugins OFF
//const DrawTool_Geologic = null
const DrawTool_MTTTT = null
//const DrawTool_SetOperations = null
const DrawTool_ScienceIntent = null

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
          "<div>Draw</div>",
        "</div>",
        "<div type='shapes' class='drawToolNavButton' title='Features'>",
          "<i class='mdi mdi-shape mdi-18px'></i>",
          "<div>Features</div>",
        "</div>",
        "<div type='history' class='drawToolNavButton' title='History'>",
          "<i id='drawToolHistoryButton' class='mdi mdi-history mdi-18px'></i>",
          "<div>History</div>",
        "</div>",
      "</div>",
      "<div id='drawToolContents'>",
        
        "<div id='drawToolDraw'>",
          "<div id='drawToolDrawShapes'>",
            //"<div id='drawToolDrawingInIndicator'>Choose a file to draw in</div>",
            "<div id='drawToolDrawingCont'>",
                "<div id='drawToolDrawingTypeDiv'>",
                    "<div class='drawToolDrawingTypePolygon' draw='polygon' title='Polygon'><i class='mdi mdi-vector-polygon mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypeCircle' draw='circle' title='Circle'><i class='mdi mdi-vector-circle mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypeRectangle' draw='rectangle' title='Rectangle'><i class='mdi mdi-vector-rectangle mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypeLine' draw='line' title='Line'><i class='mdi mdi-vector-line mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypePoint' draw='point' title='Point'><i class='mdi mdi-square-medium-outline mdi-24px'></i></div>",
                    "<div class='drawToolDrawingTypeText' draw='text' title='Text'><i class='mdi mdi-format-text mdi-18px'></i></div>",
                    "<div class='drawToolDrawingTypeArrow' draw='arrow' title='Arrow'><i class='mdi mdi-arrow-top-right mdi-18px'></i></div>",
                "</div>",
                "<div id='drawToolDrawingSettingsToggle' title='Draw Settings'><i class='mdi mdi-cog mdi-18px'></i></div>",
            "</div>",
            "<div id='drawToolDrawSettings'>",
                "<div id='drawToolDrawSettingsBody'>",
                    "<ul>",
                        "<li>",
                            "<div title='Clip drawing of existing shapes'>Draw Clipping</div>",
                            "<div id='drawToolDrawSettingsTier' class='drawToolRadio'>",
                                "<div value='over'>Over</div>",
                                "<div value='under'>Under</div>",
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
                        "<li>",
                            "<div title='Force radius in meters when drawing circles'>Circle Radius</div>",
                            "<div id='drawToolDrawSettingsCircle' class='drawToolRadio'>",
                                "<div value='on'><span>On</span><input id='drawToolDrawSettingsCircleR' type='number' value='100'/></div>",
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
                "<div id='drawToolDrawGroupingDiv'>",
                    "<div type='folders' title='Group by Folder' class='active'><i class='mdi mdi-folder mdi-14px'></i></div>",
                    "<div type='tags' title='Group by Tag'><i class='mdi mdi-tag-text mdi-18px'></i></div>",
                    "<div type='author' title='Group by Author'><i class='mdi mdi-account-box-outline mdi-18px'></i></div>",
                    "<div type='alphabetical' title='Group Alphabetically'><i class='mdi mdi-alphabetical-variant mdi-18px'></i></div>",
                    "<div type='none' title='Files Ungrouped'><i class='mdi mdi-file-outline mdi-18px'></i></div>",
                "</div>",
                "<div id='drawToolDrawSortDiv'>",
                    "<div type='public' title='Public Only'><i class='mdi mdi-shield-outline mdi-14px'></i></div>",
                    "<div type='owned' title='Yours Only'><i class='mdi mdi-account mdi-18px'></i></div>",
                    "<div type='on' title='On Only'><i class='mdi mdi-eye mdi-18px'></i></div>",
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
                                "<div class='drawToolMasterHeaderChevron'><i class='mdi mdi-folder-star mdi-18px'></i></div>",
                                "<div>Lead Maps</div>",
                            "</div>",
                            "<div class='drawToolMasterHeaderLeftRight'>",
                                "<div class='drawToolMasterReview'>Review</div>",
                            "</div>",
                        "</div>",
                        "<div class='drawToolFileMasterCheckbox'></div>",
                    "</div>",
                "</div>",
                "<ul id='drawToolDrawFilesListMaster' class='mmgisScrollbar2'>",
                "</ul>",
              "</div>",
              "<ul id='drawToolDrawFilesList' class='mmgisScrollbar2'>",
              "</ul>",
              "<div id='drawToolFilesLoadingSpinner'>",
                "<svg class='mmgis-spinner1' viewbox='0 0 50 50'>",
                    "<circle class='path' cx='25' cy='25' r='20' fill='none' stroke-width='5' />",
                "</svg>",
            "</div>",
            "</div>",
          "</div>",
          
          "<div id='drawToolDrawFilesNewDiv'>",
                //"<input id='drawToolDrawFilesNewName' type='text' placeholder='New File' />",
                /*
                "<select>",
                    "<option id='drawToolNewFileAll' value='all'>Map</option>",
                    "<option id='drawToolNewFileROI' value='roi'>ROI</option>",
                    "<option id='drawToolNewFileCampaign' value='campaign'>Campaign</option>",
                    "<option id='drawToolNewFileCampsite' value='campsite'>Campsite</option>",
                    "<option id='drawToolNewFileTrail' value='trail'>Trail</option>",
                    "<option id='drawToolNewFileSignpost' value='signpost'>Signpost</option>",
                    //"<option value='note'>Note</option>",
                "</select>",
                */
                "<div id='drawToolDrawFilesNewUpload'><div>UPLOAD</div><div><i class='mdi mdi-upload mdi-18px'></i></div></div>",
                "<div id='drawToolDrawFilesNew'><div>CREATE</div><div><i class='mdi mdi-plus mdi-18px'></i></div></div>",
            "</div>",
        "</div>",

        "<div id='drawToolShapes'>",
          "<div id='drawToolShapesFilterDiv'>",
            "<div id='drawToolShapesFilterAdvanced'><i class='mdi mdi-filter mdi-18px'></i></div>",
            "<input id='drawToolShapesFilter' type='text' placeholder='Filter Shapes' />",
            "<div id='drawToolShapesFilterClear'><i class='mdi mdi-close mdi-18px'></i></div>",
            "<div id='drawToolShapesFilterCount'></div>",
          "</div>",
          "<div id='drawToolShapesFilterAdvancedDiv'>",
            "<div id='drawToolShapes_filtering'>",
                "<div id='drawToolShapes_filtering_header'>",
                    "<div id='drawToolShapes_filtering_title_left'>",
                        "<div id='drawToolShapes_filtering_title'>Advanced Filter</div>",
                    "</div>",
                    "<div id='drawToolShapes_filtering_adds'>",
                        "<div id='drawToolShapes_filtering_add_value' class='mmgisButton5' title='Add New Key-Value Filter'><div>Add</div><i class='mdi mdi-plus mdi-18px'></i></div>",
                    "</div>",
                "</div>",
                "<div id='drawToolShapes_filtering_filters'>",
                    "<ul id='drawToolShapes_filtering_filters_list'></ul>",
                "</div>",
                `<div id='drawToolShapes_filtering_footer'>`,
                    "<div id='drawToolShapes_filtering_clear' class='mmgisButton5'><div>Clear Filter</div></div>",
                    "<div id='drawToolShapes_filtering_submit' class='mmgisButton5'><div id='drawToolShapes_filtering_submit_loading'><div></div></div><div id='drawToolShapes_filtering_submit_text'>Submit</div><i class='mdi mdi-arrow-right mdi-18px'></i></div>",
                "</div>",
            "</div>",
          "</div>",
          "<div id='drawToolDrawShapesList' class='mmgisScrollbar2'>",
            "<ul id='drawToolShapesFeaturesList' class='unselectable'>",
            "</ul>",
          "</div>",
          "<div id='drawToolShapesCopyDiv'>",
            "<div>Copy to</div>",
            "<div id='drawToolShapesCopyDropdown'></div>",
            "<div id='drawToolShapesCopyGo'>GO</div>",
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
    width: 260,
    vars: {},
    plugins: {},
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
    _firstGetFiles: null,
    filesOn: [],
    allTags: {}, //<tag>: count, ...
    tags: [],
    labelsOn: [],
    fileGeoJSONFeatures: {},
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
    highlightColor: 'rgb(255, 221, 92)',
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
        'roi',
        'campaign',
        'campsite',
        'all',
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
            fillOpacity: 0.6,
        },
        polygon: {
            color: 'rgb(255, 255, 255)',
            radius: 2,
            fillColor: 'rgb(255, 255, 255)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6,
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
            radius: 20, //used as arrowhead limb pixel length
            fillColor: 'rgb(255, 255, 255)',
            width: 4, //width of line
            length: 'Full', //length of line body
            weight: 4, //outline
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
        DrawTool._firstGetFiles = null

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
            if (this.vars.intents[5])
                this.intentNameMapping.all = this.vars.intents[5]
        }

        //Bring in other scripts
        DrawTool_Drawing.init(DrawTool)
        DrawTool_Editing.init(DrawTool)
        DrawTool_Files.init(DrawTool)
        DrawTool_History.init(DrawTool)
        DrawTool_Publish.init(DrawTool)
        DrawTool_Shapes.init(DrawTool)

        // Plugins
        if (DrawTool_Geologic) DrawTool_Geologic.init(DrawTool)
        if (DrawTool_MTTTT) DrawTool_MTTTT.init(DrawTool)
        if (DrawTool_ScienceIntent) DrawTool_ScienceIntent.init(DrawTool)
        if (DrawTool_SetOperations) DrawTool_SetOperations.init(DrawTool)

        //Turn on files from url
        let hadDrawLayersOn = false
        if (L_.FUTURES.tools) {
            for (let t of L_.FUTURES.tools) {
                const tUrl = t.split('$')
                if (tUrl[0] == 'DrawTool') {
                    const tUrl2 = tUrl[1].split('-')
                    //fileson
                    const fileIds = tUrl2[0].split('.')
                    let finishedFileIdsCount = 0
                    for (let f of fileIds) {
                        this.toggleFile(
                            parseInt(f),
                            null,
                            null,
                            null,
                            null,
                            () => {
                                finishedFileIdsCount++
                                if (finishedFileIdsCount >= fileIds.length) {
                                    // We want to make sure that users of the javascript api can still hit drawing files if
                                    // they were deeplinked to but the tool was never opened/maked
                                    if (hadDrawLayersOn) {
                                        DrawTool.getFiles(function () {
                                            //Populate masterFilesIds
                                            DrawTool.masterFileIds = []
                                            for (var f in DrawTool.files) {
                                                if (DrawTool.files[f].is_master)
                                                    DrawTool.masterFileIds.push(
                                                        DrawTool.files[f].id
                                                    )
                                            }

                                            DrawTool.destroy()
                                        })
                                    }
                                }
                            }
                        )
                    }
                    hadDrawLayersOn = true

                    // default filters
                    const filtersOn = tUrl2[1]
                    if (filtersOn != null) {
                        window._toolStates = window._toolStates || {}
                        window._toolStates.draw = window._toolStates.draw || {}
                        window._toolStates.draw.filter =
                            window._toolStates.draw.filter || {}

                        window._toolStates.draw.filter.public =
                            filtersOn[0] == '1'
                        window._toolStates.draw.filter.owned =
                            filtersOn[1] == '1'
                        window._toolStates.draw.filter.on = filtersOn[2] == '1'
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
    },
    destroy: function () {
        if (this.MMGISInterface) this.MMGISInterface.separateFromMMGIS()

        for (var l in L_.layers.layer) {
            var s = l.split('_')
            var onId = s[1] != 'master' ? parseInt(s[1]) : s[1]

            if (s[0] == 'DrawTool' && DrawTool.filesOn.indexOf(onId) != -1) {
                for (var i = 0; i < L_.layers.layer[l].length; i++) {
                    var f = L_.layers.layer[l][i]

                    if (!f) continue

                    if (
                        !f.hasOwnProperty('feature') &&
                        f.hasOwnProperty('_layers')
                    ) {
                        // If it's a non point layer
                        f = f._layers[Object.keys(f._layers)[0]]
                    }

                    var properties = f.feature.properties

                    if (f.hasOwnProperty('_layers')) f = f._layers
                    else f = { layer: f }

                    for (let elayer in f) {
                        let e = f[elayer]

                        e.off('click')
                        e.on(
                            'click',
                            (function (l) {
                                return function (d) {
                                    if (
                                        ToolController_.activeTool &&
                                        ToolController_.activeTool
                                            .disableLayerInteractions === true
                                    )
                                        return

                                    let layer = d.target
                                    let found = false
                                    if (!d.target.hasOwnProperty('feature')) {
                                        for (var _l in L_.layers.layer) {
                                            if (!_l.startsWith('DrawTool_'))
                                                continue

                                            for (var x in L_.layers.layer[l]) {
                                                var childLayer =
                                                    L_.layers.layer[l][x]
                                                if ('hasLayer' in childLayer) {
                                                    if (
                                                        childLayer.hasOwnProperty(
                                                            'feature'
                                                        ) &&
                                                        childLayer.feature
                                                            ?.properties
                                                            ?.arrow &&
                                                        childLayer.hasLayer(
                                                            d.target
                                                        )
                                                    ) {
                                                        // This is the parent layer of the arrow
                                                        layer = childLayer
                                                        found = true
                                                        break
                                                    }
                                                }
                                            }
                                            if (found) break
                                        }
                                    }

                                    L_.setLastActiveFeature(layer)
                                    L_.resetLayerFills()
                                    L_.highlight(layer)
                                    Map_.activeLayer = layer
                                    if (Map_.activeLayer)
                                        L_.Map_._justSetActiveLayer = true
                                    Description.updatePoint(Map_.activeLayer)

                                    Kinds.use(
                                        'none',
                                        Map_,
                                        layer.feature,
                                        layer,
                                        l,
                                        null,
                                        d
                                    )
                                    Viewer_.changeImages(layer.feature, layer)
                                    Globe_.highlight(
                                        Globe_.findSpriteObject(
                                            layer.options.layerName,
                                            layer.feature.properties.name
                                        ),
                                        false
                                    )
                                    Viewer_.highlight(layer)
                                }
                            })(l)
                        )
                        //Add a mouseover event to the layer
                        e.off('mouseover')
                        e.on(
                            'mouseover',
                            (function (l) {
                                return function (d) {
                                    let name
                                    // If the DrawTool layer that is hovered is an arrow, the parent arrow layer knows the name
                                    if (!d.target.hasOwnProperty('feature')) {
                                        for (var _l in L_.layers.layer) {
                                            if (!_l.startsWith('DrawTool_')) {
                                                continue
                                            }

                                            for (var x in L_.layers.layer[l]) {
                                                var layer =
                                                    L_.layers.layer[l][x]
                                                if ('hasLayer' in layer) {
                                                    if (
                                                        layer.hasOwnProperty(
                                                            'feature'
                                                        ) &&
                                                        layer.feature
                                                            ?.properties
                                                            ?.arrow &&
                                                        layer.hasLayer(d.target)
                                                    ) {
                                                        name =
                                                            layer.feature
                                                                .properties.name
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        name = d.target.feature.properties.name
                                    }

                                    //Make it turn on CursorInfo and show name and value
                                    CursorInfo.update(
                                        'Name: ' + name,
                                        null,
                                        false
                                    )
                                }
                            })(l)
                        )
                        //Add a mouseout event
                        e.off('mouseout')
                        e.on('mouseout', function () {
                            //Make it turn off CursorInfo
                            CursorInfo.hide()
                        })
                    }
                }
            }
        }
    },
    getUrlString: function () {
        // Structure is fileOnId.fileOnId.fileOnId,filtersOnBinary
        const publicFilterOn = $(
            `#drawToolDrawSortDiv > [type="public"]`
        ).hasClass('active')
            ? 1
            : 0
        const yoursOnlyFilterOn = $(
            `#drawToolDrawSortDiv > [type="owned"]`
        ).hasClass('active')
            ? 1
            : 0
        const onFilterOn = $(`#drawToolDrawSortDiv > [type="on"]`).hasClass(
            'active'
        )
            ? 1
            : 0
        return (
            this.filesOn.toString().replace(/,/g, '.') +
            `-${publicFilterOn}${yoursOnlyFilterOn}${onFilterOn}`
        )
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

                if (DrawTool.filesOn.length > 0) {
                    // This brings back all of the DrawTools mouse interactions
                    DrawTool.getFiles(function () {
                        DrawTool.populateFiles()
                        DrawTool.populateShapes()

                        //Populate masterFilesIds
                        DrawTool.masterFileIds = []
                        for (var f in DrawTool.files) {
                            if (DrawTool.files[f].is_master)
                                DrawTool.masterFileIds.push(
                                    DrawTool.files[f].id
                                )
                        }
                    })
                }

                $('#drawToolDraw').css('display', 'flex')
                break
            case 'shapes':
                DrawTool.lastShapeIntent = null
                $('#drawToolShapesCopyDropdown *').remove()
                DrawTool.endDrawing()
                DrawTool.populateShapes()
                $('#drawToolShapes').css('display', 'flex')
                DrawTool.setSubmitButtonState(true)
                break
            case 'history':
                $('.drawToolContextMenuHeaderClose').click()
                DrawTool.endDrawing()
                DrawTool.populateHistory()
                $('#drawToolHistory').css('display', 'flex')
                break
            default:
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
    getAllTags(all) {
        let tags = []
        for (var i = 0; i < DrawTool.files.length; i++) {
            tags = tags.concat(
                DrawTool.getTagsFoldersFromFileDescription(
                    DrawTool.files[i],
                    true,
                    'all',
                    all ? 'all' : 'tags'
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
    getTagsFoldersFromFileDescription(file, noDefaults, only, withTypePrefix) {
        const file_name = file.file_name
        const file_description = file.file_description
        const file_owner = file.file_owner

        const tagFolders = {
            tags: [],
            folders: [],
            efolders: [],
            author: [],
            alphabetical: [],
        }
        if (typeof file_description !== 'string') return []

        const tags = file_description.match(/~#([^\s])+/g) || []
        const uniqueTags = [...tags]
        // remove '#'s
        tagFolders.tags = uniqueTags.map((t) => t.substring(2)) || []

        const folders = file_description.match(/~@([^\s])+/g) || []
        const uniqueFolders = [...folders]
        // remove '@'s
        tagFolders.folders = uniqueFolders.map((t) => t.substring(2)) || []

        const efolders = file_description.match(/~\^([^\s])+/g) || []
        const uniqueEFolders = [...efolders]
        // remove '^'s
        tagFolders.efolders = uniqueEFolders.map((t) => t.substring(2)) || []

        // At least one folder
        if (noDefaults !== true) {
            if (tagFolders.tags.length === 0) tagFolders.tags = ['untagged']
            if (tagFolders.folders.length === 0)
                tagFolders.folders = ['unassigned']

            tagFolders.alphabetical = ['a' + file_name.toLowerCase()[0]]
            tagFolders.author = [file_owner]
        }

        // Sort all alphabetically
        tagFolders.tags.sort(function (a, b) {
            return a.length - b.length
        })
        tagFolders.folders.sort(function (a, b) {
            return a.length - b.length
        })
        tagFolders.efolders.sort(function (a, b) {
            return a.length - b.length
        })

        if (withTypePrefix) {
            tagFolders.tags = tagFolders.tags.map((t) => `tag:${t}`)
            tagFolders.folders = tagFolders.folders.map((t) => `folder:${t}`)
            tagFolders.efolders = tagFolders.efolders.map(
                (t) => `elevated-folder:${t}`
            )
        }
        if (only) {
            if (tagFolders[only]) return tagFolders[only]
            return []
                .concat(tagFolders.tags)
                .concat(tagFolders.folders)
                .concat(tagFolders.efolders)
        }
        return tagFolders
    },
    stripTagsFromDescription(file_description) {
        if (typeof file_description !== 'string') return ''
        return file_description
            .replaceAll(/~#([^\s])+/g, '')
            .replaceAll(/~@([^\s])+/g, '')
            .replaceAll(/~\^([^\s])+/g, '')
            .trimStart()
            .trimEnd()
    },
    getFiles: function (callback) {
        // setLoading
        if (DrawTool._firstGetFiles !== true) {
            $(`#drawToolFilesLoadingSpinner`).addClass('on')
            DrawTool._firstGetFiles = true
        }
        calls.api(
            'files_getfiles',
            {},
            function (data) {
                if (data && data.body) {
                    //sort files by intent and then alphabetically by name within intent
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

                    // Add tags and folders
                    for (let i = 0; i < DrawTool.files.length; i++) {
                        DrawTool.files[i].file_description =
                            DrawTool.files[i].file_description || ''
                        DrawTool.files[i]._tagFolders =
                            DrawTool.getTagsFoldersFromFileDescription(
                                DrawTool.files[i]
                            )
                    }
                    DrawTool.allTags = DrawTool.getAllTags(true)
                    DrawTool.tags = Object.keys(DrawTool.allTags)
                }
                if (typeof callback === 'function') callback()

                // endLoading
                $(`#drawToolFilesLoadingSpinner`).removeClass('on')
            },
            function (data) {
                if (data && data.message == 'User is not logged in.') {
                    $('#drawToolNotLoggedIn').css('display', 'inherit')
                }
                // endLoading
                $(`#drawToolFilesLoadingSpinner`).removeClass('on')
            }
        )
    },
    makeFile: function (body, callback) {
        const filename = body.file_name
        calls.api(
            'files_make',
            body,
            function (data) {
                if (data.status === 'success') {
                    DrawTool.getFiles(() => {
                        callback(data.body.file_id)
                        CursorInfo.update(
                            `Successfully made new file: ${filename}`,
                            4000,
                            false,
                            { x: 305, y: 6 },
                            '#009eff',
                            'white',
                            null,
                            true
                        )
                    })
                } else
                    CursorInfo.update(
                        'Failed to add file.',
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
            },
            function () {
                CursorInfo.update(
                    'Failed to add file.',
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
            }
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
    addDrawing: async function (body, callback, failure) {
        // Add template property defaults
        const file = DrawTool.getFileObjectWithId(body.file_id)
        if (file?.template?.template && body?.properties) {
            let newProps = JSON.parse(body.properties)
            const templateDefaults =
                await DrawTool_Templater.getTemplateDefaults(
                    file?.template?.template,
                    L_.layers.layer[`DrawTool_${body.file_id}`],
                    body
                )

            newProps = { ...newProps, ...templateDefaults }
            body.properties = JSON.stringify(newProps)
        }

        if (body.file_id == null) {
            CursorInfo.update(
                'No file chosen. Please select or make a file for drawings.',
                6000,
                true,
                { x: 305, y: 6 },
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
                    CursorInfo.update(message, 6000, true, { x: 305, y: 6 })
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
    enforceTemplate(geojson, templateObj, force) {
        if (templateObj == null || templateObj.template == null) return geojson
        const templateEnforcedFeatures = []
        geojson.features.forEach((f) => {
            const newF = JSON.parse(JSON.stringify(f))
            if (force) {
                newF.properties = newF.properties || {}
                const forcedTemplateProperties = {}
                templateObj.template.forEach((t) => {
                    if (!newF.properties.hasOwnProperty([t.field]))
                        forcedTemplateProperties[t.field] = t.default
                    else
                        forcedTemplateProperties[t.field] =
                            newF.properties[t.field]
                })
                newF.properties = forcedTemplateProperties
            } else {
                newF.properties = newF.properties || {}
                templateObj.template.forEach((t) => {
                    if (!newF.properties.hasOwnProperty([t.field]))
                        newF.properties[t.field] = t.default
                })
            }
            templateEnforcedFeatures.push(newF)
        })
        geojson.features = templateEnforcedFeatures
        return geojson
    },
    _isFeatureTemporallyVisible(feature, startField, endField) {
        if (DrawTool.timeToggledOn !== true) return true
        const startTime = F_.removeTimeZoneOffset(
            new Date(L_.TimeControl_.getStartTime()).getTime()
        )
        const endTime = F_.removeTimeZoneOffset(
            new Date(L_.TimeControl_.getEndTime()).getTime()
        )

        let startTimeValue = false
        if (startField)
            startTimeValue = F_.getIn(feature.properties, startField, 0)
        let endTimeValue = false
        if (endField)
            endTimeValue = F_.getIn(feature.properties, endField, false)

        // No prop, won't show
        if (endTimeValue === false) return false
        else if (
            typeof endTimeValue === 'string' &&
            endTimeValue.indexOf('T') != -1
        )
            endTimeValue += 'Z'

        if (startTimeValue === false) {
            //Single Point in time, just compare end times
            let endDate = new Date(endTimeValue)
            if (endDate === 'Invalid Date') return false

            endDate = endDate.getTime()
            if (endDate <= endTime && endDate >= startTime) return true
            return false
        } else {
            if (
                typeof startTimeValue === 'string' &&
                startTimeValue.indexOf('T') != -1
            )
                startTimeValue += 'Z'
            // Then we have a range
            let startDate = new Date(startTimeValue)
            let endDate = new Date(endTimeValue)

            // Bad prop value, won't show
            if (startDate === 'Invalid Date' || endDate === 'Invalid Date')
                return false

            startDate = startDate.getTime()
            endDate = endDate.getTime()
            if (endTime < startDate) return false
            if (startTime > endDate) return false

            return true
        }
    },
    timeFilterDrawingLayer(fileId) {
        if (L_.layers.layer[`DrawTool_${fileId}`]) {
            DrawTool.setSubmitButtonState(true)
            const file = DrawTool.getFileObjectWithId(fileId)

            let startField
            let endField
            if (file?.template?.template) {
                file.template.template.forEach((t) => {
                    if (startField == null && t.isStart === true)
                        startField = t.field
                    if (endField == null && t.isEnd === true) endField = t.field
                })
            }
            L_.layers.layer[`DrawTool_${fileId}`].forEach((l, index) => {
                if (l == null) return
                if (l.feature == null) {
                    if (l._layers) {
                        Object.keys(l._layers).forEach((l2) => {
                            l2 = l._layers[l2]
                            if (l2.feature) {
                                const isVisible =
                                    DrawTool._isFeatureTemporallyVisible(
                                        l2.feature,
                                        startField,
                                        endField
                                    )

                                if (l2.savedOptions == null)
                                    l2.savedOptions = {
                                        opacity: l2.options.opacity,
                                        fillOpacity: l2.options.fillOpacity,
                                    }

                                l2.temporallyHidden = !isVisible
                                if (l2.temporallyHidden)
                                    $(
                                        `#drawToolShapeLiItem_DrawTool_${fileId}_${index}`
                                    ).addClass('temporallyHidden')
                                else
                                    $(
                                        `#drawToolShapeLiItem_DrawTool_${fileId}_${index}`
                                    ).removeClass('temporallyHidden')
                                if (l2.temporallyHidden) {
                                    l2.setStyle({
                                        opacity: 0,
                                        fillOpacity: 0,
                                    })
                                    if (l2._path?.style)
                                        l2._path.style.pointerEvents = 'none'
                                } else if (l2.savedOptions) {
                                    l2.setStyle({
                                        opacity: l2.savedOptions.opacity,
                                        fillOpacity:
                                            l2.savedOptions.fillOpacity,
                                    })
                                    if (l2._path?.style)
                                        l2._path.style.pointerEvents = 'all'
                                }
                            }
                        })
                    }
                } else {
                    const isVisible = DrawTool._isFeatureTemporallyVisible(
                        l.feature,
                        startField,
                        endField
                    )
                    if (l.savedOptions == null)
                        l.savedOptions = {
                            opacity: l.options.opacity,
                            fillOpacity: l.options.fillOpacity,
                        }

                    l.temporallyHidden = !isVisible
                    if (l.temporallyHidden)
                        $(
                            `#drawToolShapeLiItem_DrawTool_${fileId}_${index}`
                        ).addClass('temporallyHidden')
                    else
                        $(
                            `#drawToolShapeLiItem_DrawTool_${fileId}_${index}`
                        ).removeClass('temporallyHidden')
                    if (l.setStyle) {
                        if (l.temporallyHidden) {
                            l.setStyle({
                                opacity: 0,
                                fillOpacity: 0,
                            })
                            if (l._path?.style)
                                l._path.style.pointerEvents = 'none'
                        } else if (l.savedOptions) {
                            l.setStyle({
                                opacity: l.savedOptions.opacity,
                                fillOpacity: l.savedOptions.fillOpacity,
                            })
                            if (l._path?.style)
                                l._path.style.pointerEvents = 'all'
                        }
                    }
                }
            })
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
    tools.style('background', 'var(--color-k)')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')

    //Add the markup to tools or do it manually
    tools.html(markup)

    // Set default Public filter state
    if (window._toolStates?.draw?.filter?.public != null) {
        if (window._toolStates.draw.filter.public === true)
            $(`#drawToolDrawSortDiv > [type="public"]`).addClass('active')
    } else if (DrawTool.vars.defaultPublicFilter === true) {
        $(`#drawToolDrawSortDiv > [type="public"]`).addClass('active')
    }
    // Set default Yours Only filter state
    if (window._toolStates?.draw?.filter?.owned != null) {
        if (window._toolStates.draw.filter.owned === true)
            $(`#drawToolDrawSortDiv > [type="owned"]`).addClass('active')
    } else if (DrawTool.vars.defaultYoursOnlyFilter !== false) {
        $(`#drawToolDrawSortDiv > [type="owned"]`).addClass('active')
    }
    // Set default On filter state
    if (window._toolStates?.draw?.filter?.on != null) {
        if (window._toolStates.draw.filter.on === true)
            $(`#drawToolDrawSortDiv > [type="on"]`).addClass('active')
    } else if (DrawTool.vars.defaultOnFilter === true) {
        $(`#drawToolDrawSortDiv > [type="on"]`).addClass('active')
    }

    // Set defaultDrawClipping if any
    $(
        `#drawToolDrawSettingsTier > [value="${
            ['over', 'under', 'off'].includes(DrawTool.vars.defaultDrawClipping)
                ? DrawTool.vars.defaultDrawClipping
                : 'under'
        }"]`
    ).addClass('active')

    // Add time indicator
    if (L_.configData?.time?.enabled === true) {
        // prettier-ignore
        $('body').append([
            `<div id="DrawTool_TimeToggle">`,
                `<div>Temporal Drawings</div>`,
                `<div class="mmgisToggleSwitch">`,
                    `<input type="checkbox" id="DrawTool_TimeToggle_switch"/>`,
                    `<label for="DrawTool_TimeToggle_switch">Toggle</label>`,
                `</div>`,
            `</div>`
        ].join('\n'))
        $('#DrawTool_TimeToggle').css(
            'display',
            $('#toggleTimeUI.active').length > 0 ? 'flex' : 'none'
        )

        $('#DrawTool_TimeToggle_switch').on('input', function (e) {
            // Toggle edit panel off
            $('.drawToolContextMenuHeaderClose').click()
            DrawTool.timeToggledOn = $(this).is(':checked')
            DrawTool.filesOn.forEach((fileId) => {
                DrawTool.timeFilterDrawingLayer(fileId)
            })
        })
        L_.subscribeTimeChange('DrawTool', (times) => {
            DrawTool.filesOn.forEach((fileId) => {
                DrawTool.timeFilterDrawingLayer(fileId)
            })
        })
        L_.subscribeOnTimeUIToggle('DrawTool', (active) => {
            $('#DrawTool_TimeToggle').css('display', active ? 'flex' : 'none')
        })
        tippy('#DrawTool_TimeToggle', {
            content:
                'Only display drawings whose templated dates fall within the current time window.',
            placement: 'bottom',
            theme: 'blue',
            maxWidth: 700,
        })
    }

    tippy('#drawToolDrawFilesNew', {
        content: 'New File',
        placement: 'right',
        theme: 'blue',
    })
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

    $('#drawToolDrawSettingsCircle > div').on('click', function () {
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

    $('#drawToolDrawFilesNewUpload').on('click', function () {
        DrawTool_FileModal.newFileModal(DrawTool, function () {
            $('#drawToolFileUpload > input').click()
        })
    })
    //Adding a new file
    $('#drawToolDrawFilesNew').on('click', function () {
        DrawTool_FileModal.newFileModal(DrawTool)
    })

    //Copy shapes
    $('#drawToolShapesCopyGo').on('click', function () {
        if (DrawTool.copyFileId == null) {
            CursorInfo.update(
                'Please select a file to copy shapes to.',
                6000,
                true,
                { x: 305, y: 6 },
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
        var copiedSI = 0
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
                    var shape = L_.layers.layer[layer][index]

                    let fromFileId = $(elm).attr('file_id')
                    let fromFile = DrawTool.getFileObjectWithId(fromFileId)

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

                    var fileObj = DrawTool.getFileObjectWithId(file_id)
                    var toFileIntent = fileObj.intent

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
                        fromFile: fromFile,
                        toFile: fileObj,
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
                    ) {
                        DrawTool.refreshFile(copyBodies[0].file_id, null, true)
                    }
                    if (copiedSI < numToCopy) {
                        CursorInfo.update(
                            'Warning: only ' +
                                copiedSI +
                                '/' +
                                numToCopy +
                                ' science intents were copied over.',
                            6000,
                            true,
                            { x: 305, y: 6 },
                            '#e9ff26',
                            'black'
                        )
                    }
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
                    DrawTool.drawOver(copyBodies[i], 'off', function (body) {
                        copied++
                        if (
                            DrawTool.plugins?.ScienceIntent?.custom
                                ?.getFileFK &&
                            DrawTool.plugins?.ScienceIntent?.custom
                                ?.copyScienceIntent
                        ) {
                            let fromFK = null
                            fromFK =
                                DrawTool.getFileFK(copyBodies[i].fromFile) +
                                body.tag
                            let toFK = null
                            toFK =
                                DrawTool.getFileFK(copyBodies[i].toFile) +
                                body.uuid

                            // Now copy intent
                            DrawTool.copyScienceIntent(
                                fromFK,
                                toFK,
                                function () {
                                    copiedSI++
                                    $('#drawToolShapesCopyMessageDiv').text(
                                        'Copied ' +
                                            copied +
                                            '/' +
                                            numToCopy +
                                            ' into ' +
                                            filename
                                    )
                                    copyLoop(i + 1)
                                },
                                function () {
                                    $('#drawToolShapesCopyMessageDiv').text(
                                        'Copied ' +
                                            copied +
                                            '/' +
                                            numToCopy +
                                            ' into ' +
                                            filename
                                    )
                                    copyLoop(i + 1)
                                }
                            )
                        } else {
                            $('#drawToolShapesCopyMessageDiv').text(
                                'Copied ' +
                                    copied +
                                    '/' +
                                    numToCopy +
                                    ' into ' +
                                    filename
                            )
                            copyLoop(i + 1)
                        }
                    })
                }
            }
        } else {
            CursorInfo.update(
                'Please select shapes to copy.',
                6000,
                true,
                { x: 305, y: 6 },
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

    // Toggle on and off last file
    hotkeys(`alt+1`, { keyUp: true, keyDown: false }, (e, handler) => {
        if (e.repeat) return
        if (DrawTool.lastToggledFileId != null) {
            if (DrawTool.filesOn.indexOf(DrawTool.lastToggledFileId) != -1)
                $(
                    '.drawToolFileCheckbox[file_id="' +
                        DrawTool.lastToggledFileId +
                        '" ]'
                ).removeClass('on')
            else
                $(
                    '.drawToolFileCheckbox[file_id="' +
                        DrawTool.lastToggledFileId +
                        '" ]'
                ).addClass('on')
            DrawTool.toggleFile(
                DrawTool.lastToggledFileId,
                null,
                true,
                null,
                true
            )
        }
    })

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        hotkeys.unbind(`alt+1`)
        DrawTool.endDrawing()
        $('.drawToolContextMenuHeaderClose').click()
        L_.unsubscribeTimeChange('DrawTool')
        L_.unsubscribeOnTimeUIToggle('DrawTool')
        $('#DrawTool_TimeToggle').remove()
        DrawTool.open = false
    }
}

export default DrawTool
