// See https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf for viewshedding algorithm

//Capture all dem tiles at resolution 32, 64, 128 or 256 for current extent
//Send data to viewshedder

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import DataShaders from '../../Ancillary/DataShaders'
import Help from '../../Ancillary/Help'

import arc from '../../../external/Arc/arc'
import '../../../external/ColorPicker/jqColorPicker'
import '../../../external/PNG/zlib'
import '../../../external/PNG/png'

import ViewshedTool_Manager from './ViewshedTool_Manager'
import ViewshedTool_Algorithm from './ViewshedTool_Algorithm'

import './ViewshedTool.css'

const helpKey = 'ViewshedTool'

// prettier-ignore
let markup = [
    "<div id='viewshedTool'>",
        "<div id='vstHeader'>",
            "<div>",
                "<div style='display: flex;'>",
                    "<div id='vstTitle'>Viewshed</div>",
                    Help.getComponent(helpKey),
                "</div>",
                "<div id='vstNew'>",
                    "<div>New</div>",
                    "<i class='mdi mdi-plus mdi-18px'></i>",
                "</div>",
            "</div>",
            "<div>",
                "<div id='vstToggleAll' class='checkbox on'></div>",
                "<div class='vstLabel'>Toggle All</div>",
            "</div>",
        "</div>",
        "<div id='vstContent'>",
            "<ul id='vstViewsheds'>",
            "</ul>",
        "</div>",
    "</div>"
].join('\n');

let ViewshedTool = {
    height: 0,
    width: 250,
    vars: null,
    viewshedTimeout: null,
    viewshedElmCount: 0,
    activeElmId: null,
    tags: {},
    firstOpen: true,
    showTileEdges: false,
    lastViewshedsUl: null,
    shedColors: [
        { r: 255, g: 255, b: 0, a: 128 },
        { r: 0, g: 255, b: 255, a: 128 },
        { r: 255, g: 0, b: 0, a: 128 },
        { r: 255, g: 0, b: 255, a: 128 },
        { r: 255, g: 255, b: 255, a: 128 },
        { r: 64, g: 64, b: 191, a: 128 },
    ],
    shedMarkers: {},
    shedWedges: {},
    canvases: {},
    dynamicUpdateResCutoff: 1,
    dynamicUpdatePanCutoff: 1,
    MMGISInterface: null,
    tempSheet: null,
    initialize: function () {
        this.vars = L_.getToolVars('viewshed')

        if (this.vars && this.vars.__noVars !== true) {
            if (this.vars.data == null)
                console.warn(
                    'ViewshedTool: variables object does not contain key "data"!'
                )
            else if (this.vars.data.length == null)
                console.warn(
                    'ViewshedTool: variables object "data" is not an array!'
                )
            else if (this.vars.data.length == 0)
                console.warn('ViewshedTool: variables object "data" is empty!')
        }

        if (L_.FUTURES.tools) {
            for (let t of L_.FUTURES.tools) {
                let tUrl = t.split('$')
                if (tUrl[0] == 'ViewshedTool') {
                    tUrl[1].split(';').forEach((elm, i) => {
                        if (elm.length > 0) {
                            let p = elm.split('+')
                            let initObj = {
                                name: p[0],
                                on: p[1],
                                dataIndex: parseInt(p[2]),
                                color: {
                                    r: parseInt(p[3].substr(0, 3)),
                                    g: parseInt(p[3].substr(3, 3)),
                                    b: parseInt(p[3].substr(6, 3)),
                                },
                                opacity: p[4],
                                resolution: p[5],
                                invert: p[6],
                                height: parseFloat(p[7]),
                                centerAzimuth: parseFloat(p[8]),
                                FOVAzimuth: parseFloat(p[9]),
                                centerElevation: parseFloat(p[10]),
                                FOVElevation: parseFloat(p[11]),
                                latitude: parseFloat(p[12]),
                                longitude: parseFloat(p[13]),
                            }
                            this.viewshed(null, i, null, initObj)
                        }
                    })
                }
            }
        }
    },
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()

        if (this.firstOpen) {
            // Turn on files from url if any
            if (L_.FUTURES.tools) {
                for (let t of L_.FUTURES.tools) {
                    let tUrl = t.split('$')
                    if (tUrl[0] == 'ViewshedTool') {
                        tUrl[1].split(';').forEach((elm, i) => {
                            if (elm.length > 0) {
                                let p = elm.split('+')
                                let initObj = {
                                    name: p[0],
                                    on: p[1],
                                    dataIndex: p[2],
                                    color: {
                                        r: parseInt(p[3].substr(0, 3)),
                                        g: parseInt(p[3].substr(3, 3)),
                                        b: parseInt(p[3].substr(6, 3)),
                                    },
                                    opacity: p[4],
                                    resolution: p[5],
                                    invert: p[6],
                                    height: p[7],
                                    centerAzimuth: p[8],
                                    FOVAzimuth: p[9],
                                    centerElevation: p[10],
                                    FOVElevation: p[11],
                                    latitude: p[12],
                                    longitude: p[13],
                                }
                                //this.delete(i)
                                this.makeNewElm(initObj)
                                this.firstOpen = false
                            }
                        })
                    }
                }
            }
            // Otherwise make an initial default viewshed
            if (this.firstOpen) this.makeNewElm()
            this.firstOpen = false
        }

        // No fading in tiles while the viewshed tool is active because it interferes
        this.tempSheet = $(
            '<style type="text/css">.leaflet-tile { opacity: 1 !important; }</style>'
        )
        $('html > head').append(this.tempSheet)
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
        if (this.tempSheet) this.tempSheet.remove()
    },
    getUrlString: function () {
        let urlString = ''

        $('#vstViewsheds li').each((i, elm) => {
            const id = $(elm).attr('viewshedId')

            let o = ViewshedTool.getViewshedOptions(id)

            urlString +=
                `${o.name}+${o.on}+${o.dataIndex}+` +
                `${F_.pad(o.color.r, 3)}${F_.pad(o.color.g, 3)}` +
                `${F_.pad(o.color.b, 3)}+` +
                `${o.opacity}+${o.resolution}+${o.invert}+${o.height}+${o.centerAzimuth}+` +
                `${o.FOVAzimuth}+${o.centerElevation}+${o.FOVElevation}+` +
                `${o.latitude}+${o.longitude};`
        })

        return urlString
    },
    panEnd: function () {
        $('#viewshedTool .vstRegen').addClass('changed')
        $('#vstViewsheds li').each((i, elm) => {
            const id = $(elm).attr('viewshedId')
            // prettier-ignore
            if (
                    ViewshedTool.tags[id] != null && // already generated
                    $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                    $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdatePanCutoff
                ) {
                    ViewshedTool.setSource(null, null, id)
                }
        })
    },
    toggleAll: function () {
        $('#vstToggleAll').toggleClass('on')

        const isOn = $('#vstToggleAll').hasClass('on')

        $('#vstViewsheds li').each((i, elm) => {
            const id = $(elm).attr('viewshedId')
            if (
                (isOn &&
                    !$(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstShedHeader .checkbox'
                    ).hasClass('on')) ||
                (!isOn &&
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstShedHeader .checkbox'
                    ).hasClass('on'))
            ) {
                $(
                    '#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox'
                ).click()
            }
        })
    },
    makeNewElm: function (initObj, forcedId) {
        const id = forcedId != null ? forcedId : ViewshedTool.viewshedElmCount

        initObj = initObj || {}

        initObj = {
            name: initObj.name || `Viewshed ${id}`,
            on: initObj.on || false,
            dataIndex: initObj.dataIndex != null ? initObj.dataIndex : 0,
            color:
                initObj.color != null
                    ? F_.rgbObjToStr(initObj.color)
                    : F_.rgbObjToStr(
                          ViewshedTool.shedColors[
                              id % ViewshedTool.shedColors.length
                          ]
                      ),
            colorObj:
                initObj.color != null
                    ? initObj.color
                    : ViewshedTool.shedColors[
                          id % ViewshedTool.shedColors.length
                      ],
            opacity: initObj.opacity != null ? initObj.opacity : 0.6,
            resolution: initObj.resolution != null ? initObj.resolution : 1,
            invert: initObj.invert != null ? initObj.invert : 0,
            targetHeight:
                initObj.targetHeight != null
                    ? initObj.targetHeight
                    : ViewshedTool?.vars?.defaultTargetHeight != null
                    ? ViewshedTool.vars.defaultTargetHeight
                    : 0,
            height:
                initObj.height != null
                    ? initObj.height
                    : ViewshedTool?.vars?.defaultObserverHeight != null
                    ? ViewshedTool.vars.defaultObserverHeight
                    : 2,
            centerAzimuth: initObj.centerAzimuth || 0,
            FOVAzimuth: initObj.FOVAzimuth != null ? initObj.FOVAzimuth : 360,
            centerElevation: initObj.centerElevation || 0,
            FOVElevation:
                initObj.FOVElevation != null ? initObj.FOVElevation : 180,
            latitude:
                initObj.latitude != null
                    ? initObj.latitude
                    : Map_.map.getCenter().lat,
            longitude:
                initObj.longitude != null
                    ? initObj.longitude
                    : Map_.map.getCenter().lng,
        }

        let allData = ''
        if (
            ViewshedTool.vars &&
            ViewshedTool.vars.data &&
            ViewshedTool.vars.data.length > 0
        ) {
            allData = ViewshedTool.vars.data
                .map(
                    (c, i) =>
                        "<option value='" +
                        i +
                        "' " +
                        (initObj.dataIndex == i ? 'selected' : '') +
                        '>' +
                        c.name +
                        '</option>'
                )
                .join('\n')
        }

        let allCameraPresets = ''
        if (
            ViewshedTool.vars &&
            ViewshedTool.vars.cameraPresets &&
            ViewshedTool.vars.cameraPresets.length > 0
        ) {
            allCameraPresets = ViewshedTool.vars.cameraPresets
                .map(
                    (c, i) =>
                        "<option value='" +
                        i +
                        "' " +
                        (initObj.customPrest == i ? 'selected' : '') +
                        '>' +
                        c.name +
                        '</option>'
                )
                .join('\n')
        }

        allCameraPresets =
            "<option value='-1' " +
            (initObj.customPreset == -1 ? 'selected' : '') +
            '>Custom</option>\n' +
            allCameraPresets

        // prettier-ignore
        let markup = [
                "<li id='vstId_" + id + "' viewshedId='" + id + "'>",
                    "<div class='vstLoading'></div>",
                    "<div class='vstShedHeader'>",
                        "<div>",
                            "<div class='vstColorbox' style='background: " + initObj.color + ";'></div>",
                            "<div class='checkbox on' title='Toggle On/Off'></div>",
                            "<div class='activator vstEditbox' title='Toggle Edit'>",
                                "<i class='off mdi mdi-checkbox-blank-circle-outline mdi-18px'></i>",
                                "<i class='on mdi mdi-circle-edit-outline mdi-18px'></i>",
                            "</div>",
                            "<input title='Rename' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' value='" + initObj.name + "'></input>",
                        "</div>",
                        "<div>",
                            "<div class='vstShed3D' vstId='" + id + "' title='3D Viewshed'>",
                                "<i class='mdi mdi-video-3d mdi-24px'></i>",
                            "</div>",
                            "<div class='vstShedTune' vstId='" + id + "' title='Options'>",
                                "<i class='mdi mdi-tune mdi-18px'></i>",
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div class='vstShedContents' style='border-left: 6px solid " + initObj.color + ";'>",
                        "<div class='vstOptionData'>",
                            "<div title='Dataset to viewshed.'>Data</div>",
                            "<select class='dropdown'>",
                                allData,
                            "</select>",
                        "</div>",
                        "<div class='vstOptionColor'>",
                            "<div>Color</div>",
                            "<div id='vstId_" + id + "_color'></div>",
                        "</div>",
                        "<div class='vstOptionOpacity'>",
                            "<div>Opacity</div>",
                            "<input class='slider2' type='range' min='0' max='1' step='0.01' value='" + initObj.opacity + "' default='0.5'>",
                        "</div>",
                        "<div class='vstOptionResolution'>",
                            "<div title='High or Ultra disables auto-regeneration.'>Resolution</div>",
                            "<select class='dropdown'>",
                                "<option value='0' " + (initObj.resolution == 0 ? 'selected' : '') + ">Low</option>",
                                "<option value='1' " + (initObj.resolution == 1 ? 'selected' : '') + ">Medium</option>",
                                "<option value='2' " + (initObj.resolution == 2 ? 'selected' : '') + ">High</option>",
                                "<option value='3' " + (initObj.resolution == 3 ? 'selected' : '') + ">Ultra</option>",
                            "</select>",
                        "</div>",
                        "<div class='vstOptionInvert'>",
                            "<div title='Inverts the shading. True shades hidden regions.'>Reverse</div>",
                            "<select class='dropdown'>",
                                "<option value='0' " + (initObj.invert == 0 ? 'selected' : '') + ">False</option>",
                                "<option value='1' " + (initObj.invert == 1 ? 'selected' : '') + ">True</option>",
                            "</select>",
                        "</div>",
                        "<div class='vstOptionCameraPresets'>",
                            "<div title='Modifies parameters below.'>Camera Presets</div>",
                            "<select class='dropdown'>",
                                allCameraPresets,
                            "</select>",
                        "</div>",
                        "<div class='vstOptionHeight'>",
                            "<div title='Height above surface of source point.'>Observer Height</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' step='1' value='" + initObj.height + "' default='2'>",
                                "<div class='vstUnit smallFont'>m</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionTargetHeight'>",
                            `<div title='Height above surface of target area.\n"Can I see the spot n meters above the surface here?"'>Target Height</div>`,
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' step='1' value='" + initObj.targetHeight + "' default='0'>",
                                "<div class='vstUnit smallFont'>m</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionFOVAzimuth'>",
                            "<div title='Horizontal field of view angle.'>FOV (Az)</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' max='360' step='1' value='" + initObj.FOVAzimuth + "' default='360'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionFOVElevation'>",
                            "<div title='Vertical field of view angle.'>FOV (El)</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' max='180' step='1' value='" + initObj.FOVElevation + "' default='180'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionCenterAzimuth'>",
                            "<div title='Clockwise-increasing and north-is-zero view rotation angle.'>Center Azimuth</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' step='6' value='" + initObj.centerAzimuth + "' default='0'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionCenterElevation'>",
                            "<div title='Upwards-increasing and horizon-is-zero view tilt angle.'>Center Elevation</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='-90' max='90' step='1' value='" + initObj.centerElevation + "' default='0'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionLatitude'>",
                            "<div>Latitude</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' max='180' step='1' value='" + initObj.latitude + "' default='0'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstOptionLongitude'>",
                            "<div>Longitude</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' max='180' step='1' value='" + initObj.longitude + "' default='0'>",
                                "<div class='vstUnit'>&deg;</div>",
                            "</div>",
                        "</div>",
                        "<div class='vstShedBar'>",
                            "<div class='vstDelete' title='Delete'>",
                                "<i class='mdi mdi-delete mdi-18px'></i>",
                            "</div>",
                            "<div class='vstSave' title='Save'>",
                                "<i class='mdi mdi-content-save mdi-18px'></i>",
                            "</div>",
                            "<div class='vstShedClone' vstId='" + id + "' title='Clone Viewshed'>",
                                "<i class='mdi mdi-plus-circle-multiple-outline mdi-18px'></i>",
                            "</div>",
                            "<div class='vstRegen changed'>",
                                "<div>Generate</div>",
                                "<span></span>",
                            "</div>",
                            "<div class='vstDeleteSure'>",
                                "<div class='vstDeleteSureYes' title='Yes, delete!'>",
                                    "<span>Yes</span>",
                                    "<i class='mdi mdi-delete mdi-18px'></i>",
                                "</div>",
                                '<div class="vstDeleteSureNo" title="No, keep.">',
                                    "<span>No</span>",
                                    "<i class='mdi mdi-close mdi-18px'></i>",
                                "</div>",
                                "<div>Are you sure?</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</li>"
            ].join('\n')

        $('#vstViewsheds').append(markup)

        $('#vstViewsheds #vstId_' + id + ' .activator').on(
            'click',
            (function (id) {
                return function () {
                    ViewshedTool.setActiveElmId(id)
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstShedHeader .checkbox'
                    ).toggleClass('on')
                    const isOn = $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstShedHeader .checkbox'
                    ).hasClass('on')
                    const layerName = 'viewshed' + id
                    if (isOn) {
                        if (L_.layers.layer[layerName])
                            Map_.map.addLayer(L_.layers.layer[layerName])
                        if (ViewshedTool.shedMarkers[id])
                            Map_.map.addLayer(ViewshedTool.shedMarkers[id])
                        if (ViewshedTool.shedWedges[id])
                            Map_.map.addLayer(ViewshedTool.shedWedges[id])
                    } else {
                        Map_.rmNotNull(L_.layers.layer[layerName])
                        Map_.rmNotNull(ViewshedTool.shedMarkers[id])
                        Map_.rmNotNull(ViewshedTool.shedWedges[id])
                    }
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstShedTune').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstViewsheds #vstId_' + id + ' .vstShedContents'
                    ).toggleClass('open')
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstShed3D').on(
            'click',
            (function (id) {
                return function () {
                    ViewshedTool.matchGlobe(id)
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstShedClone').on(
            'click',
            (function (id) {
                return function () {
                    let opts = ViewshedTool.getViewshedOptions(id, true)
                    opts.name = null
                    ViewshedTool.makeNewElm(opts)
                    ViewshedTool.setActiveElmId(parseInt(id) + 1)
                    ViewshedTool.setSource()
                }
            })(id)
        )

        // Changes
        $('#vstViewsheds #vstId_' + id + ' .vstOptionData select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionOpacity input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                        ) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionInvert select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    // prettier-ignore
                    if( $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionCameraPresets select').on(
            'change',
            (function (id) {
                return function () {
                    let val = $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val()
                    if (val >= 0 && ViewshedTool.vars.cameraPresets) {
                        $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                            'changed'
                        )
                        let preset = ViewshedTool.vars.cameraPresets[val]
                        if (preset.height != null)
                            // prettier-ignore
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionHeight input').val(preset.height)
                        if (preset.azCenter != null)
                            // prettier-ignore
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionCenterAzimuth input').val(preset.azCenter)
                        if (preset.azFOV != null)
                            // prettier-ignore
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionFOVAzimuth input').val(preset.azFOV)
                        if (preset.elCenter != null)
                            // prettier-ignore
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionCenterElevation input').val(preset.elCenter)
                        if (preset.elFOV != null)
                            // prettier-ignore
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionFOVElevation input').val(preset.elFOV)

                        //prettier-ignore
                        if (
                                $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                                $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                            ) {
                                ViewshedTool.setActiveElmId(id)
                                ViewshedTool.setSource()
                            }
                    }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionTargetHeight input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    // prettier-ignore
                    if( $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionHeight input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    // prettier-ignore
                    if( $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionCenterAzimuth input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                        ) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionFOVAzimuth input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    //prettier-ignore
                    if (
                            $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                        ) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionCenterElevation input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                        ) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionFOVElevation input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    //prettier-ignore
                    if (
                            $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                            $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff
                        ) {
                            ViewshedTool.setActiveElmId(id)
                            ViewshedTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionLatitude input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstViewsheds #vstId_' + id + ' .vstOptionLongitude input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstRegen').on(
            'click',
            (function (id) {
                return function () {
                    if (
                        $('#vstViewsheds #vstId_' + id + ' .vstRegen').hasClass(
                            'changed'
                        )
                    ) {
                        ViewshedTool.setActiveElmId(id)
                        ViewshedTool.setSource()
                    }
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstDelete').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstViewsheds #vstId_' + id + ' .vstDeleteSure'
                    ).toggleClass('on')
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstDeleteSureNo').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstViewsheds #vstId_' + id + ' .vstDeleteSure'
                    ).removeClass('on')
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstDeleteSureYes').on(
            'click',
            (function (id) {
                return function () {
                    ViewshedTool.delete(id)
                }
            })(id)
        )

        $('#vstViewsheds #vstId_' + id + ' .vstSave').on(
            'click',
            (function (id) {
                return function () {
                    ViewshedTool.save(id)
                }
            })(id)
        )

        $('#vstId_' + id + '_color').colorPicker({
            opacity: false,
            renderCallback: function (elm, toggled) {
                const bg = elm._css.backgroundColor.replace('NaN', 1)
                $('#vstId_' + id + ' .vstColorbox').css({
                    background: bg,
                })
                $('#vstId_' + id + '_color').css({
                    background: bg,
                })
                $('#vstId_' + id + ' .vstShedContents').css({
                    'border-left': '6px solid ' + bg,
                })
                $('#vstViewsheds #vstId_' + id + ' .vstRegen').addClass(
                    'changed'
                )
                $('#vstId_' + id + ' .vstColorbox').attr(
                    'color',
                    JSON.stringify(this.color.colors.RND.rgb)
                )
                // prettier-ignore
                if( $('#vstViewsheds #vstId_' + id + ' .vstShedHeader .checkbox').hasClass('on') &&
                        $('#vstViewsheds #vstId_' + id + ' .vstOptionResolution select').val() <= ViewshedTool.dynamicUpdateResCutoff) {
                        ViewshedTool.setActiveElmId(id)
                        ViewshedTool.setSource()
                    }
            },
        })

        $('#vstId_' + id + '_color').css({
            'background-color': initObj.color,
        })
        $('#vstId_' + id + ' .vstColorbox').attr(
            'color',
            JSON.stringify(initObj.colorObj)
        )

        ViewshedTool.setActiveElmId(id)

        if (forcedId == null) ViewshedTool.viewshedElmCount++
        else
            ViewshedTool.viewshedElmCount =
                Math.max(forcedId, ViewshedTool.viewshedElmCount) + 1
    },
    setActiveElmId: function (activeId) {
        $('#vstViewsheds li .activator').removeClass('on')
        $('#vstViewsheds #vstId_' + activeId + ' .activator').addClass('on')
        ViewshedTool.activeElmId = activeId
    },
    setSource: function (e, ignoreMarker, idOverride) {
        let id = idOverride != null ? idOverride : ViewshedTool.activeElmId

        //Ignore if the id is bad (never create or had been deleted)
        if ($('#vstViewsheds #vstId_' + id).length == 0) return
        let source
        if (e && e.latlng)
            source = {
                lng: e.latlng.lng,
                lat: e.latlng.lat,
            }
        ViewshedTool.viewshed(source, id, ignoreMarker)
    },
    viewshed: function (source, activeElmId, ignoreMarker, initObj) {
        if (activeElmId == null) return

        let options = initObj || ViewshedTool.getViewshedOptions(activeElmId)

        if (source == null) {
            source = {
                lng: parseFloat(options.longitude),
                lat: parseFloat(options.latitude),
            }
        }

        if (source.lng == null || source.lat == null) return

        //redrawWedge
        Map_.rmNotNull(ViewshedTool.shedWedges[activeElmId])
        if (options.FOVAzimuth < 360) {
            let start = [source.lat, source.lng]
            let end
            let rp
            let arcGenerator
            let distance = Map_.getScreenDiagonalInMeters()

            rp = F_.destinationFromBearing(
                start[0],
                start[1],
                parseFloat(options.centerAzimuth) -
                    parseFloat(options.FOVAzimuth) / 2,
                distance * 0.001
            )
            arcGenerator = new arc.GreatCircle(
                { x: start[1], y: start[0] },
                { x: rp[1], y: rp[0] }
            )
            let minLine = L.geoJSON(arcGenerator.Arc(100).json(), {
                style: function (feature) {
                    return {
                        color: 'black',
                        weight: 3,
                    }
                },
            })

            rp = F_.destinationFromBearing(
                start[0],
                start[1],
                parseFloat(options.centerAzimuth) +
                    parseFloat(options.FOVAzimuth) / 2,
                distance * 0.001
            )
            arcGenerator = new arc.GreatCircle(
                { x: start[1], y: start[0] },
                { x: rp[1], y: rp[0] }
            )
            let maxLine = L.geoJSON(arcGenerator.Arc(100).json(), {
                style: function (feature) {
                    return {
                        color: 'black',
                        weight: 3,
                    }
                },
            })

            ViewshedTool.shedWedges[activeElmId] = L.layerGroup([
                minLine,
                maxLine,
            ]).addTo(Map_.map)
        }

        if (ignoreMarker != true) {
            let canvas = document.createElement('canvas')
            canvas.width = 16
            canvas.height = 16
            let context = canvas.getContext('2d')

            const radius = 7
            const strokeWeight = 2

            context.fillStyle =
                'rgba(' +
                options.color.r +
                ',' +
                options.color.g +
                ',' +
                options.color.b +
                ',255)'

            context.strokeStyle = 'rgba(255,255,255,255)'
            context.beginPath()
            context.arc(
                canvas.width / 2,
                canvas.height / 2,
                radius,
                0,
                2 * Math.PI,
                false
            )

            context.fill()
            context.lineWidth = strokeWeight
            context.stroke()
            context.strokeStyle = 'rgba(0,0,0,255)'
            context.beginPath()
            context.arc(
                canvas.width / 2,
                canvas.height / 2,
                radius - strokeWeight,
                0,
                2 * Math.PI,
                false
            )

            context.fill()
            context.lineWidth = strokeWeight
            context.stroke()

            let viewshedIcon = L.icon({
                iconUrl: canvas.toDataURL(),
                iconSize: [canvas.width, canvas.height],
                iconAnchor: [canvas.width / 2, canvas.height / 2],
                popupAnchor: [-3, -76],
                shadowSize: [68, 95],
                shadowAnchor: [22, 94],
            })

            Map_.rmNotNull(ViewshedTool.shedMarkers[activeElmId])
            ViewshedTool.shedMarkers[activeElmId] = new L.marker(
                [source.lat, source.lng],
                {
                    icon: viewshedIcon,
                    draggable: true,
                }
            ).addTo(Map_.map)

            ViewshedTool.shedMarkers[activeElmId].on(
                'mouseover',
                (function (activeElmId) {
                    return function (e) {
                        const name = $(
                            '#vstViewsheds #vstId_' +
                                activeElmId +
                                ' .vstShedHeader input'
                        ).val()
                        CursorInfo.update(name, null, false)
                    }
                })(activeElmId)
            )
            ViewshedTool.shedMarkers[activeElmId].on(
                'mouseout',
                (function (activeElmId) {
                    return function (e) {
                        CursorInfo.hide()
                    }
                })(activeElmId)
            )

            if (options.resolution <= ViewshedTool.dynamicUpdateResCutoff) {
                ViewshedTool.shedMarkers[activeElmId].on(
                    'drag',
                    (function (activeElmId) {
                        return function (e) {
                            ViewshedTool.setActiveElmId(activeElmId)
                            ViewshedTool.setSource(
                                { latlng: e.target.getLatLng() },
                                true
                            )
                        }
                    })(activeElmId)
                )
            } else {
                ViewshedTool.shedMarkers[activeElmId].on(
                    'dragend',
                    (function (activeElmId) {
                        return function (e) {
                            ViewshedTool.setActiveElmId(activeElmId)
                            ViewshedTool.setSource({
                                latlng: e.target.getLatLng(),
                            })
                        }
                    })(activeElmId)
                )
            }
        }

        options.color.a =
            options.opacity != null
                ? parseInt(options.opacity * 255)
                : ViewshedTool.shedColors[
                      activeElmId % ViewshedTool.shedColors.length
                  ].a

        $(
            '#vstViewsheds #vstId_' + activeElmId + ' .vstOptionLongitude input'
        ).val(source.lng.toFixed(8))
        $(
            '#vstViewsheds #vstId_' + activeElmId + ' .vstOptionLatitude input'
        ).val(source.lat.toFixed(8))

        source.height =
            options.height.length > 0 || !isNaN(options.height)
                ? parseFloat(options.height)
                : 2

        options.resolution = parseInt(options.resolution) || 0

        // Make a unique tag for the viewport
        const b = Map_.map.getBounds()

        let dataLayer = ViewshedTool.vars.data[options.dataIndex]

        ViewshedTool.tags[activeElmId] =
            activeElmId +
            'd' +
            dataLayer.name.replace(/ /g, '_') +
            'r' +
            options.resolution +
            'n' +
            b._northEast.lat +
            'e' +
            b._northEast.lng +
            's' +
            b._southWest.lat +
            'w' +
            b._southWest.lng

        ViewshedTool_Manager.gather(
            ViewshedTool.tags[activeElmId],
            dataLayer,
            options.resolution,
            source,
            options,
            ViewshedTool.vars,
            function (progress) {
                $('#vstViewsheds #vstId_' + activeElmId + ' .vstLoading')
                    .css({ width: progress + '%' })
                    .addClass('on')
                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstRegen span'
                ).css({ width: progress + '%' })
                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstRegen div'
                ).text('Regenerating: ' + parseInt(progress + 1) + '%')
            },
            function (data) {
                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstLoading'
                ).removeClass('on')
                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstRegen span'
                ).css({ width: '0%' })
                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstRegen div'
                ).text('Regenerate')
                // We'll use a single canvas for all tiles for capturing
                // their dataURLs
                let c = document.createElement('canvas')
                const res = data.tileResolution * Math.pow(2, data.resolution)
                c.width = res
                c.height = res
                let ctx = c.getContext('2d')
                let cImgData = ctx.createImageData(res, res)
                let cData = cImgData.data

                let dl = {}
                let dlc = {}

                for (let j = 0; j <= data.outputTopLeftTile.h; j++) {
                    for (let i = 0; i <= data.outputTopLeftTile.w; i++) {
                        const z = data.outputTopLeftTile.z
                        const x = data.outputTopLeftTile.x + i
                        const y = data.outputTopLeftTile.y + j

                        const xO = data.outputTopLeftTile.x % 1 == 0
                        const yO = data.outputTopLeftTile.y % 1 == 0

                        dl[z] = dl[z] || {}
                        dl[z][Math.floor(x)] = dl[z][Math.floor(x)] || {}

                        dlc[z] = dlc[z] || {}
                        dlc[z][Math.floor(x)] = dlc[z][Math.floor(x)] || {}

                        const tileRow =
                            (y -
                                Math.floor(data.outputTopLeftTile.y) -
                                (Math.abs(data.outputTopLeftTile.y) % 1) * 2) *
                            res

                        const tileCol =
                            (x -
                                Math.floor(data.outputTopLeftTile.x) -
                                (Math.abs(data.outputTopLeftTile.x) % 1) * 2) *
                            res

                        // Draw canvas
                        let px = 0
                        let val = null
                        for (let p = 0; p < cData.length; p += 4) {
                            const isEdge =
                                p / 4 < res ||
                                p / 4 > cData.length - res - 1 ||
                                (p / 4) % res == 0 ||
                                (p / 4 + 1) % res == 0
                            val = data.result[tileRow + Math.floor(px / res)]
                            if (val != null) {
                                val = val[tileCol + (px % res)]
                                let c
                                switch (val) {
                                    case 0:
                                        c =
                                            options.invert == 0
                                                ? { r: 0, g: 0, b: 0, a: 0 }
                                                : options.color
                                        break
                                    case 1:
                                        c =
                                            options.invert == 0
                                                ? options.color
                                                : { r: 0, g: 0, b: 0, a: 0 }
                                        break
                                    case 2:
                                        c =
                                            options.invert == 0
                                                ? options.color
                                                : { r: 0, g: 0, b: 0, a: 0 }
                                        break
                                    case 3:
                                        c = { r: 0, g: 255, b: 0, a: 0 }
                                        break
                                    case 8:
                                        c = { r: 0, g: 0, b: 0, a: 0 }
                                        break
                                    case 9:
                                        c = { r: 255, g: 0, b: 0, a: 35 }
                                        break
                                    default:
                                        c = { r: 0, g: 0, b: 0, a: 0 }
                                }
                                if (ViewshedTool.showTileEdges && isEdge)
                                    c = { r: 255, g: 255, b: 255, a: 200 }

                                cData[p] = c.r
                                cData[p + 1] = c.g
                                cData[p + 2] = c.b
                                cData[p + 3] = c.a
                            } else {
                                cData[p] = 0
                                cData[p + 1] = 0
                                cData[p + 2] = 0
                                cData[p + 3] = 0
                            }
                            px++
                        }
                        ctx.putImageData(cImgData, 0, 0)
                        dl[z][Math.floor(x)][Math.floor(y)] = c.toDataURL()
                        dlc[z][Math.floor(x)][Math.floor(y)] = F_.cloneCanvas(c)
                    }
                }
                ViewshedTool.canvases[activeElmId] = dlc
                makeDataLayer(dl, activeElmId, dlc)

                $(
                    '#vstViewsheds #vstId_' + activeElmId + ' .vstRegen'
                ).removeClass('changed')
            }
        )

        function makeDataLayer(layerUrl, activeElmId, dlc) {
            let layerName = 'viewshed' + activeElmId

            Map_.rmNotNull(L_.layers.layer[layerName])

            let uniforms = {}

            L_.layers.layer[layerName] = L.tileLayer.gl({
                options: {
                    tms: false,
                    className: 'nofade',
                    maxNativeZoom: Map_.map.getZoom(),
                    maxZoom: 30,
                },
                fragmentShader: DataShaders['image'].frag,
                tileUrls: [layerUrl],
                uniforms: uniforms,
                tileUrlsAsDataUrls: true,
            })
            L_.layers.layer[layerName].setZIndex(1000)
            $(
                '#vstViewsheds #vstId_' +
                    activeElmId +
                    ' .vstShedHeader .checkbox'
            ).addClass('on')
            Map_.map.addLayer(L_.layers.layer[layerName])

            Globe_.litho.removeLayer(layerName)
        }
    },
    getViewshedOptions: function (elmId, nextColor) {
        return {
            name: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstShedHeader input'
            ).val(),
            on: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstShedHeader .checkbox'
            ).hasClass('on'),
            dataIndex: parseInt(
                $(
                    '#vstViewsheds #vstId_' + elmId + ' .vstOptionData select'
                ).val()
            ),
            color: JSON.parse(
                nextColor
                    ? JSON.stringify(
                          ViewshedTool.shedColors[
                              (ViewshedTool.viewshedElmCount + 1) %
                                  ViewshedTool.shedColors.length
                          ]
                      )
                    : $('#vstId_' + elmId + ' .vstColorbox').attr('color') ||
                          JSON.stringify(
                              ViewshedTool.shedColors[
                                  elmId % ViewshedTool.shedColors.length
                              ]
                          )
            ),
            opacity: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionOpacity input'
            ).val(),
            resolution: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionResolution select'
            ).val(),
            invert: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionInvert select'
            ).val(),
            targetHeight: parseFloat(
                $(
                    '#vstViewsheds #vstId_' +
                        elmId +
                        ' .vstOptionTargetHeight input'
                ).val() || 0
            ),
            height: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionHeight input'
            ).val(),
            centerAzimuth:
                parseFloat(
                    $(
                        '#vstViewsheds #vstId_' +
                            elmId +
                            ' .vstOptionCenterAzimuth input'
                    ).val()
                ) % 360,
            FOVAzimuth: parseFloat(
                $(
                    '#vstViewsheds #vstId_' +
                        elmId +
                        ' .vstOptionFOVAzimuth input'
                ).val()
            ),
            centerElevation:
                parseFloat(
                    $(
                        '#vstViewsheds #vstId_' +
                            elmId +
                            ' .vstOptionCenterElevation input'
                    ).val()
                ) % 180,
            FOVElevation: parseFloat(
                $(
                    '#vstViewsheds #vstId_' +
                        elmId +
                        ' .vstOptionFOVElevation input'
                ).val()
            ),
            latitude: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionLatitude input'
            ).val(),
            longitude: $(
                '#vstViewsheds #vstId_' + elmId + ' .vstOptionLongitude input'
            ).val(),
        }
    },
    delete: function (activeElmId) {
        $('#vstId_' + activeElmId).remove()
        Map_.rmNotNull(L_.layers.layer['viewshed' + activeElmId])
        Map_.rmNotNull(ViewshedTool.shedMarkers[activeElmId])
        Map_.rmNotNull(ViewshedTool.shedWedges[activeElmId])
        L_.layers.layer['viewshed' + activeElmId] = null
        ViewshedTool.shedMarkers[activeElmId] = null
        ViewshedTool.shedWedges[activeElmId] = null
        ViewshedTool.canvases[activeElmId] = null
    },
    save: function (activeElmId) {
        const tag = ViewshedTool.tags[activeElmId]
        const d = ViewshedTool_Manager.getData(tag)

        if (d == null) return

        // Turn result into one long space delimited string
        let strResult = []
        for (let y = 0; y < d.result.length; y++)
            strResult.push(d.result[y].join(' '))
        strResult = strResult.join(' ')

        let geojson = F_.getBaseGeoJSON()
        geojson.features.push({
            type: 'Feature',
            properties: {
                type: 'mmgis_viewshed',
                ncols: d.result[0].length,
                nrows: d.result.length,
                xllcorner: d.bottomLeftLatLng.lng,
                yllcorner: d.bottomLeftLatLng.lat,
                cellsize: d.cellSize,
                NODATA_value: 0,
                source_lng_deg: d.source.lng,
                source_lat_deg: d.source.lat,
                source_height_m: d.source.height,
                source_surface_height: d.source.surfaceHeight,
                data_layer_name: d.dataLayer.name,
                data_layer_url: d.dataLayer.demtileurl,
                key: {
                    0: 'hidden',
                    1: 'visible',
                    2: 'source',
                    9: 'nodata',
                },
            },
            geometry: {
                type: 'Point',
                coordinates: [d.source.lng, d.source.lat],
            },
        })

        let dataKey = '0=hidden,1=visible,2=source,9=nodata'

        // prettier-ignore
        let ascContent =
                'ncols ' + d.result[0].length + '\n' +
                'nrows ' + d.result.length  + '\n' +
                'xllcorner ' + d.bottomLeftLatLng.lng + '\n' +
                'yllcorner ' + d.bottomLeftLatLng.lat + '\n' +
                'cellsize ' + d.cellSize + '\n' +
                'NODATA_value 0\n' +
                strResult + '\n' +
                JSON.stringify(geojson) + '\n' +
                (L_.configData.projection ? L_.configData.projection.proj : 'missing_proj') + '\n' +
                dataKey

        let vsName = $(
            '#vstViewsheds #vstId_' + activeElmId + ' .vstShedHeader input'
        ).val()
        F_.downloadObject(
            ascContent,
            'mmgis_viewshed_' +
                (vsName != null ? vsName.replace(/\W/g, '') : 'none'),
            '.asc'
        )
    },
    matchGlobe: function (id) {
        if (L_.hasGlobe) {
            let options = {
                height: $(
                    '#vstViewsheds #vstId_' + id + ' .vstOptionHeight input'
                ).val(),
                centerAzimuth:
                    parseFloat(
                        $(
                            '#vstViewsheds #vstId_' +
                                id +
                                ' .vstOptionCenterAzimuth input'
                        ).val()
                    ) % 360,
                FOVAzimuth: parseFloat(
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionFOVAzimuth input'
                    ).val()
                ),
                centerElevation:
                    parseFloat(
                        $(
                            '#vstViewsheds #vstId_' +
                                id +
                                ' .vstOptionCenterElevation input'
                        ).val()
                    ) % 180,
                FOVElevation: parseFloat(
                    $(
                        '#vstViewsheds #vstId_' +
                            id +
                            ' .vstOptionFOVElevation input'
                    ).val()
                ),
                latitude: $(
                    '#vstViewsheds #vstId_' + id + ' .vstOptionLatitude input'
                ).val(),
                longitude: $(
                    '#vstViewsheds #vstId_' + id + ' .vstOptionLongitude input'
                ).val(),
            }

            let pp = L_.UserInterface_.getPanelPercents()

            if (pp.globe == 0)
                L_.UserInterface_.setPanelPercents(
                    pp.viewer - pp.viewer / 2,
                    pp.map - pp.map / 2,
                    50
                )

            let view = [
                parseFloat(options.latitude),
                parseFloat(options.longitude),
                Map_.map.getZoom(),
            ]
            Globe_.litho._.firstViewOverride = view
            Globe_.litho.setCenter(view, true)

            const layerName = 'ViewshedTool_' + id
            Globe_.litho.removeLayer(layerName)
            Globe_.litho.addLayer('clamped', {
                name: layerName,
                opacity: 1,
                preDrawn: true,
                data: ViewshedTool.canvases[id],
                on: true,
            })

            $('#Globe_WalkSettingsFovValueRaw').val(options.FOVAzimuth)
            $('#Globe_WalkSettingsFovValue').val(
                options.FOVAzimuth < 170 ? options.FOVAzimuth : 60
            )
            $('#Globe_WalkSettingsVerticalFovValue').val(options.FOVElevation)
            $('#Globe_WalkSettingsAzimuthValue').val(options.centerAzimuth)
            $('#Globe_WalkSettingsElevationValue').val(options.centerElevation)
            $('#Globe_WalkSettingsHeightValue').val(options.height)
            $('#Globe_WalkSettingsLatitudeValue').val(options.latitude)
            $('#Globe_WalkSettingsLongitudeValue').val(options.longitude)

            $('#Globe_WalkStand').addClass('highlightAnim1')

            if ($('#Globe_WalkSettingsPanel').css('display') == 'none')
                $('#Globe_WalkSettings').click()
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
    tools.style('background', 'var(--color-a1)')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    //Add the markup to tools or do it manually
    tools.html(markup)

    Help.finalize(helpKey)

    if (!ViewshedTool.firstOpen && ViewshedTool.lastViewshedsUl != null) {
        for (let id in ViewshedTool.lastViewshedsUl) {
            ViewshedTool.makeNewElm(ViewshedTool.lastViewshedsUl[id], id)
        }
    }

    $('#vstNew').on('click', ViewshedTool.makeNewElm)
    $('#vstToggleAll').on('click', ViewshedTool.toggleAll)
    Map_.map.on('click', ViewshedTool.setSource)
    Map_.map.on('moveend', ViewshedTool.panEnd)

    //Add event functions and whatnot

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        ViewshedTool.lastViewshedsUl = {}
        $('#vstViewsheds li').each((i, elm) => {
            const id = $(elm).attr('viewshedId')
            ViewshedTool.lastViewshedsUl[id] =
                ViewshedTool.getViewshedOptions(id)
        })

        $('#vstNew').off('click', ViewshedTool.makeNewElm)
        $('#vstToggleAll').off('click', ViewshedTool.toggleAll)
        Map_.map.off('click', ViewshedTool.setSource)
        Map_.map.off('moveend', ViewshedTool.panEnd)
    }
}

export default ViewshedTool
