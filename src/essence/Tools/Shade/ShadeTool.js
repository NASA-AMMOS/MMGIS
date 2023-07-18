// See https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf for shadeding algorithm

//Capture all dem tiles at resolution 32, 64, 128 or 256 for current extent
//Send data to shadeder

import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import DataShaders from '../../Ancillary/DataShaders'

import arc from '../../../external/Arc/arc'
import '../../../external/ColorPicker/jqColorPicker'
import '../../../external/PNG/zlib'
import '../../../external/PNG/png'

import ShadeTool_Manager from './ShadeTool_Manager'
import ShaderTool_Algorithm from './ShadeTool_Algorithm'

import './ShadeTool.css'

// prettier-ignore
let markup = [
    "<div id='shadeTool'>",
        "<div id='vstHeader'>",
            "<div>",
                "<div id='vstTitle'>Shade</div>",
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
            "<ul id='vstShades'>",
            "</ul>",
        "</div>",
    "</div>"
].join('\n');

let ShadeTool = {
    height: 0,
    width: 250,
    vars: null,
    shadeTimeout: null,
    shadeElmCount: 0,
    activeElmId: null,
    tags: {},
    firstOpen: true,
    showTileEdges: false,
    lastShadesUl: null,
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
        this.vars = L_.getToolVars('shade')

        if (this.vars && this.vars.__noVars !== true) {
            if (this.vars.data == null)
                console.warn(
                    'ShadeTool: variables object does not contain key "data"!'
                )
            else if (this.vars.data.length == null)
                console.warn(
                    'ShadeTool: variables object "data" is not an array!'
                )
            else if (this.vars.data.length == 0)
                console.warn('ShadeTool: variables object "data" is empty!')
        }

        if (L_.FUTURES.tools) {
            for (let t of L_.FUTURES.tools) {
                let tUrl = t.split('$')
                if (tUrl[0] == 'ShadeTool') {
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
                            this.shade(null, i, null, initObj)
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
                    if (tUrl[0] == 'ShadeTool') {
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
            // Otherwise make an initial default shade
            if (this.firstOpen) this.makeNewElm()
            this.firstOpen = false
        }

        // No fading in tiles while the shade tool is active because it interferes
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

        $('#vstShades li').each((i, elm) => {
            const id = $(elm).attr('shadeId')

            let o = ShadeTool.getShadeOptions(id)

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
        $('#shadeTool .vstRegen').addClass('changed')
        $('#vstShades li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            // prettier-ignore
            if (
                    ShadeTool.tags[id] != null && // already generated
                    $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                    $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdatePanCutoff
                ) {
                    ShadeTool.setSource(null, null, id)
                }
        })
    },
    toggleAll: function () {
        $('#vstToggleAll').toggleClass('on')

        const isOn = $('#vstToggleAll').hasClass('on')

        $('#vstShades li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            if (
                (isOn &&
                    !$(
                        '#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox'
                    ).hasClass('on')) ||
                (!isOn &&
                    $(
                        '#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox'
                    ).hasClass('on'))
            ) {
                $(
                    '#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox'
                ).click()
            }
        })
    },
    makeNewElm: function (initObj, forcedId) {
        const id = forcedId != null ? forcedId : ShadeTool.shadeElmCount

        initObj = initObj || {}

        initObj = {
            name: initObj.name || `Shade ${id}`,
            on: initObj.on || false,
            dataIndex: initObj.dataIndex != null ? initObj.dataIndex : 0,
            color:
                initObj.color != null
                    ? F_.rgbObjToStr(initObj.color)
                    : F_.rgbObjToStr(
                          ShadeTool.shedColors[id % ShadeTool.shedColors.length]
                      ),
            colorObj:
                initObj.color != null
                    ? initObj.color
                    : ShadeTool.shedColors[id % ShadeTool.shedColors.length],
            opacity: initObj.opacity != null ? initObj.opacity : 0.6,
            resolution: initObj.resolution != null ? initObj.resolution : 1,
            invert: initObj.invert != null ? initObj.invert : 0,
            targetHeight:
                initObj.targetHeight != null ? initObj.targetHeight : 0,
            height: initObj.height != null ? initObj.height : 2,
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
            ShadeTool.vars &&
            ShadeTool.vars.data &&
            ShadeTool.vars.data.length > 0
        ) {
            allData = ShadeTool.vars.data
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
            ShadeTool.vars &&
            ShadeTool.vars.cameraPresets &&
            ShadeTool.vars.cameraPresets.length > 0
        ) {
            allCameraPresets = ShadeTool.vars.cameraPresets
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
                "<li id='vstId_" + id + "' shadeId='" + id + "'>",
                    "<div class='vstLoading'></div>",
                    "<div class='vstShadeHeader'>",
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
                            "<div class='vstShade3D' vstId='" + id + "' title='3D Shade'>",
                                "<i class='mdi mdi-video-3d mdi-24px'></i>",
                            "</div>",
                            "<div class='vstShadeTune' vstId='" + id + "' title='Options'>",
                                "<i class='mdi mdi-tune mdi-18px'></i>",
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div class='vstShadeContents' style='border-left: 6px solid " + initObj.color + ";'>",
                        "<div class='vstOptionData'>",
                            "<div title='Dataset to shade.'>Data</div>",
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
                        "<div class='vstShadeBar'>",
                            "<div class='vstDelete' title='Delete'>",
                                "<i class='mdi mdi-delete mdi-18px'></i>",
                            "</div>",
                            "<div class='vstSave' title='Save'>",
                                "<i class='mdi mdi-content-save mdi-18px'></i>",
                            "</div>",
                            "<div class='vstShadeClone' vstId='" + id + "' title='Clone Shade'>",
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

        $('#vstShades').append(markup)

        $('#vstShades #vstId_' + id + ' .activator').on(
            'click',
            (function (id) {
                return function () {
                    ShadeTool.setActiveElmId(id)
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox'
                    ).toggleClass('on')
                    const isOn = $(
                        '#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox'
                    ).hasClass('on')
                    const layerName = 'shade' + id
                    if (isOn) {
                        if (L_.layers.layer[layerName])
                            Map_.map.addLayer(L_.layers.layer[layerName])
                        if (ShadeTool.shedMarkers[id])
                            Map_.map.addLayer(ShadeTool.shedMarkers[id])
                        if (ShadeTool.shedWedges[id])
                            Map_.map.addLayer(ShadeTool.shedWedges[id])
                    } else {
                        Map_.rmNotNull(L_.layers.layer[layerName])
                        Map_.rmNotNull(ShadeTool.shedMarkers[id])
                        Map_.rmNotNull(ShadeTool.shedWedges[id])
                    }
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstShadeTune').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstShades #vstId_' + id + ' .vstShadeContents'
                    ).toggleClass('open')
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstShade3D').on(
            'click',
            (function (id) {
                return function () {
                    ShadeTool.matchGlobe(id)
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstShadeClone').on(
            'click',
            (function (id) {
                return function () {
                    let opts = ShadeTool.getShadeOptions(id, true)
                    opts.name = null
                    ShadeTool.makeNewElm(opts)
                    ShadeTool.setActiveElmId(parseInt(id) + 1)
                    ShadeTool.setSource()
                }
            })(id)
        )

        // Changes
        $('#vstShades #vstId_' + id + ' .vstOptionData select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionOpacity input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                        ) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionResolution select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionInvert select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    // prettier-ignore
                    if( $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionCameraPresets select').on(
            'change',
            (function (id) {
                return function () {
                    let val = $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val()
                    if (val >= 0 && ShadeTool.vars.cameraPresets) {
                        $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                            'changed'
                        )
                        let preset = ShadeTool.vars.cameraPresets[val]
                        if (preset.height != null)
                            // prettier-ignore
                            $('#vstShades #vstId_' + id + ' .vstOptionHeight input').val(preset.height)
                        if (preset.azCenter != null)
                            // prettier-ignore
                            $('#vstShades #vstId_' + id + ' .vstOptionCenterAzimuth input').val(preset.azCenter)
                        if (preset.azFOV != null)
                            // prettier-ignore
                            $('#vstShades #vstId_' + id + ' .vstOptionFOVAzimuth input').val(preset.azFOV)
                        if (preset.elCenter != null)
                            // prettier-ignore
                            $('#vstShades #vstId_' + id + ' .vstOptionCenterElevation input').val(preset.elCenter)
                        if (preset.elFOV != null)
                            // prettier-ignore
                            $('#vstShades #vstId_' + id + ' .vstOptionFOVElevation input').val(preset.elFOV)

                        //prettier-ignore
                        if (
                                $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                                $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                            ) {
                                ShadeTool.setActiveElmId(id)
                                ShadeTool.setSource()
                            }
                    }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionTargetHeight input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    // prettier-ignore
                    if( $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionHeight input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    // prettier-ignore
                    if( $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionCenterAzimuth input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                        ) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionFOVAzimuth input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    //prettier-ignore
                    if (
                            $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                        ) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionCenterElevation input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    //prettier-ignore
                    if (
                            $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                        ) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionFOVElevation input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionCameraPresets select'
                    ).val('-1')
                    //prettier-ignore
                    if (
                            $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff
                        ) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionLatitude input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionLongitude input').on(
            'input',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstRegen').on(
            'click',
            (function (id) {
                return function () {
                    if (
                        $('#vstShades #vstId_' + id + ' .vstRegen').hasClass(
                            'changed'
                        )
                    ) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstDelete').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstShades #vstId_' + id + ' .vstDeleteSure'
                    ).toggleClass('on')
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstDeleteSureNo').on(
            'click',
            (function (id) {
                return function () {
                    $(
                        '#vstShades #vstId_' + id + ' .vstDeleteSure'
                    ).removeClass('on')
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstDeleteSureYes').on(
            'click',
            (function (id) {
                return function () {
                    ShadeTool.delete(id)
                }
            })(id)
        )

        $('#vstShades #vstId_' + id + ' .vstSave').on(
            'click',
            (function (id) {
                return function () {
                    ShadeTool.save(id)
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
                $('#vstId_' + id + ' .vstShadeContents').css({
                    'border-left': '6px solid ' + bg,
                })
                $('#vstShades #vstId_' + id + ' .vstRegen').addClass('changed')
                $('#vstId_' + id + ' .vstColorbox').attr(
                    'color',
                    JSON.stringify(this.color.colors.RND.rgb)
                )
                // prettier-ignore
                if( $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                        $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
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

        ShadeTool.setActiveElmId(id)

        if (forcedId == null) ShadeTool.shadeElmCount++
        else
            ShadeTool.shadeElmCount =
                Math.max(forcedId, ShadeTool.shadeElmCount) + 1
    },
    setActiveElmId: function (activeId) {
        $('#vstShades li .activator').removeClass('on')
        $('#vstShades #vstId_' + activeId + ' .activator').addClass('on')
        ShadeTool.activeElmId = activeId
    },
    setSource: function (e, ignoreMarker, idOverride) {
        let id = idOverride != null ? idOverride : ShadeTool.activeElmId

        //Ignore if the id is bad (never create or had been deleted)
        if ($('#vstShades #vstId_' + id).length == 0) return
        let source
        if (e && e.latlng)
            source = {
                lng: e.latlng.lng,
                lat: e.latlng.lat,
            }
        ShadeTool.shade(source, id, ignoreMarker)
    },
    shade: function (source, activeElmId, ignoreMarker, initObj) {
        if (activeElmId == null) return

        let options = initObj || ShadeTool.getShadeOptions(activeElmId)

        if (source == null) {
            source = {
                lng: parseFloat(options.longitude),
                lat: parseFloat(options.latitude),
            }
        }

        // ==VtoS-Change-Start==================
        //Find center of map
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        const centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])

        source = {
            lng: parseFloat(centerLatLng.lng),
            lat: parseFloat(centerLatLng.lat),
        }
        // ==VtoS-Change-End====================

        if (source.lng == null || source.lat == null) return

        //redrawWedge
        Map_.rmNotNull(ShadeTool.shedWedges[activeElmId])
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

            ShadeTool.shedWedges[activeElmId] = L.layerGroup([
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

            let shadeIcon = L.icon({
                iconUrl: canvas.toDataURL(),
                iconSize: [canvas.width, canvas.height],
                iconAnchor: [canvas.width / 2, canvas.height / 2],
                popupAnchor: [-3, -76],
                shadowSize: [68, 95],
                shadowAnchor: [22, 94],
            })

            Map_.rmNotNull(ShadeTool.shedMarkers[activeElmId])
            ShadeTool.shedMarkers[activeElmId] = new L.marker(
                [source.lat, source.lng],
                {
                    icon: shadeIcon,
                    draggable: true,
                }
            ).addTo(Map_.map)

            ShadeTool.shedMarkers[activeElmId].on(
                'mouseover',
                (function (activeElmId) {
                    return function (e) {
                        const name = $(
                            '#vstShades #vstId_' +
                                activeElmId +
                                ' .vstShadeHeader input'
                        ).val()
                        CursorInfo.update(name, null, false)
                    }
                })(activeElmId)
            )
            ShadeTool.shedMarkers[activeElmId].on(
                'mouseout',
                (function (activeElmId) {
                    return function (e) {
                        CursorInfo.hide()
                    }
                })(activeElmId)
            )

            if (options.resolution <= ShadeTool.dynamicUpdateResCutoff) {
                ShadeTool.shedMarkers[activeElmId].on(
                    'drag',
                    (function (activeElmId) {
                        return function (e) {
                            ShadeTool.setActiveElmId(activeElmId)
                            ShadeTool.setSource(
                                { latlng: e.target.getLatLng() },
                                true
                            )
                        }
                    })(activeElmId)
                )
            } else {
                ShadeTool.shedMarkers[activeElmId].on(
                    'dragend',
                    (function (activeElmId) {
                        return function (e) {
                            ShadeTool.setActiveElmId(activeElmId)
                            ShadeTool.setSource({
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
                : ShadeTool.shedColors[
                      activeElmId % ShadeTool.shedColors.length
                  ].a

        $(
            '#vstShades #vstId_' + activeElmId + ' .vstOptionLongitude input'
        ).val(source.lng.toFixed(8))
        $('#vstShades #vstId_' + activeElmId + ' .vstOptionLatitude input').val(
            source.lat.toFixed(8)
        )

        source.height =
            options.height.length > 0 || !isNaN(options.height)
                ? parseFloat(options.height)
                : 2

        options.resolution = parseInt(options.resolution) || 0

        // Make a unique tag for the viewport
        const b = Map_.map.getBounds()

        let dataLayer = ShadeTool.vars.data[options.dataIndex]

        ShadeTool.tags[activeElmId] =
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

        ShadeTool_Manager.gather(
            ShadeTool.tags[activeElmId],
            dataLayer,
            options.resolution,
            source,
            options,
            ShadeTool.vars,
            function (progress) {
                $('#vstShades #vstId_' + activeElmId + ' .vstLoading')
                    .css({ width: progress + '%' })
                    .addClass('on')
                $('#vstShades #vstId_' + activeElmId + ' .vstRegen span').css({
                    width: progress + '%',
                })
                $('#vstShades #vstId_' + activeElmId + ' .vstRegen div').text(
                    'Regenerating: ' + parseInt(progress + 1) + '%'
                )
            },
            function (data) {
                $(
                    '#vstShades #vstId_' + activeElmId + ' .vstLoading'
                ).removeClass('on')
                $('#vstShades #vstId_' + activeElmId + ' .vstRegen span').css({
                    width: '0%',
                })
                $('#vstShades #vstId_' + activeElmId + ' .vstRegen div').text(
                    'Regenerate'
                )
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
                                if (ShadeTool.showTileEdges && isEdge)
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
                ShadeTool.canvases[activeElmId] = dlc
                makeDataLayer(dl, activeElmId, dlc)

                $(
                    '#vstShades #vstId_' + activeElmId + ' .vstRegen'
                ).removeClass('changed')
            }
        )

        function makeDataLayer(layerUrl, activeElmId, dlc) {
            let layerName = 'shade' + activeElmId

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
                '#vstShades #vstId_' +
                    activeElmId +
                    ' .vstShadeHeader .checkbox'
            ).addClass('on')
            Map_.map.addLayer(L_.layers.layer[layerName])

            Globe_.litho.removeLayer(layerName)
        }
    },
    getShadeOptions: function (elmId, nextColor) {
        return {
            name: $(
                '#vstShades #vstId_' + elmId + ' .vstShadeHeader input'
            ).val(),
            on: $(
                '#vstShades #vstId_' + elmId + ' .vstShadeHeader .checkbox'
            ).hasClass('on'),
            dataIndex: parseInt(
                $('#vstShades #vstId_' + elmId + ' .vstOptionData select').val()
            ),
            color: JSON.parse(
                nextColor
                    ? JSON.stringify(
                          ShadeTool.shedColors[
                              (ShadeTool.shadeElmCount + 1) %
                                  ShadeTool.shedColors.length
                          ]
                      )
                    : $('#vstId_' + elmId + ' .vstColorbox').attr('color') ||
                          JSON.stringify(
                              ShadeTool.shedColors[
                                  elmId % ShadeTool.shedColors.length
                              ]
                          )
            ),
            opacity: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionOpacity input'
            ).val(),
            resolution: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionResolution select'
            ).val(),
            invert: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionInvert select'
            ).val(),
            targetHeight: parseFloat(
                $(
                    '#vstShades #vstId_' +
                        elmId +
                        ' .vstOptionTargetHeight input'
                ).val() || 0
            ),
            height: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionHeight input'
            ).val(),
            centerAzimuth:
                parseFloat(
                    $(
                        '#vstShades #vstId_' +
                            elmId +
                            ' .vstOptionCenterAzimuth input'
                    ).val()
                ) % 360,
            FOVAzimuth: parseFloat(
                $(
                    '#vstShades #vstId_' + elmId + ' .vstOptionFOVAzimuth input'
                ).val()
            ),
            centerElevation:
                parseFloat(
                    $(
                        '#vstShades #vstId_' +
                            elmId +
                            ' .vstOptionCenterElevation input'
                    ).val()
                ) % 180,
            FOVElevation: parseFloat(
                $(
                    '#vstShades #vstId_' +
                        elmId +
                        ' .vstOptionFOVElevation input'
                ).val()
            ),
            latitude: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionLatitude input'
            ).val(),
            longitude: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionLongitude input'
            ).val(),
        }
    },
    delete: function (activeElmId) {
        $('#vstId_' + activeElmId).remove()
        Map_.rmNotNull(L_.layers.layer['shade' + activeElmId])
        Map_.rmNotNull(ShadeTool.shedMarkers[activeElmId])
        Map_.rmNotNull(ShadeTool.shedWedges[activeElmId])
        L_.layers.layer['shade' + activeElmId] = null
        ShadeTool.shedMarkers[activeElmId] = null
        ShadeTool.shedWedges[activeElmId] = null
        ShadeTool.canvases[activeElmId] = null
    },
    save: function (activeElmId) {
        const tag = ShadeTool.tags[activeElmId]
        const d = ShadeTool_Manager.getData(tag)

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
                type: 'mmgis_shade',
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
            '#vstShades #vstId_' + activeElmId + ' .vstShadeHeader input'
        ).val()
        F_.downloadObject(
            ascContent,
            'mmgis_shade_' +
                (vsName != null ? vsName.replace(/\W/g, '') : 'none'),
            '.asc'
        )
    },
    matchGlobe: function (id) {
        if (L_.hasGlobe) {
            let options = {
                height: $(
                    '#vstShades #vstId_' + id + ' .vstOptionHeight input'
                ).val(),
                centerAzimuth:
                    parseFloat(
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionCenterAzimuth input'
                        ).val()
                    ) % 360,
                FOVAzimuth: parseFloat(
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionFOVAzimuth input'
                    ).val()
                ),
                centerElevation:
                    parseFloat(
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionCenterElevation input'
                        ).val()
                    ) % 180,
                FOVElevation: parseFloat(
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionFOVElevation input'
                    ).val()
                ),
                latitude: $(
                    '#vstShades #vstId_' + id + ' .vstOptionLatitude input'
                ).val(),
                longitude: $(
                    '#vstShades #vstId_' + id + ' .vstOptionLongitude input'
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

            const layerName = 'ShadeTool_' + id
            Globe_.litho.removeLayer(layerName)
            Globe_.litho.addLayer('clamped', {
                name: layerName,
                opacity: 1,
                preDrawn: true,
                data: ShadeTool.canvases[id],
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

    if (!ShadeTool.firstOpen && ShadeTool.lastShadesUl != null) {
        for (let id in ShadeTool.lastShadesUl) {
            ShadeTool.makeNewElm(ShadeTool.lastShadesUl[id], id)
        }
    }

    $('#vstNew').on('click', ShadeTool.makeNewElm)
    $('#vstToggleAll').on('click', ShadeTool.toggleAll)
    Map_.map.on('click', ShadeTool.setSource)
    Map_.map.on('moveend', ShadeTool.panEnd)

    //Add event functions and whatnot

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        ShadeTool.lastShadesUl = {}
        $('#vstShades li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            ShadeTool.lastShadesUl[id] = ShadeTool.getShadeOptions(id)
        })

        $('#vstNew').off('click', ShadeTool.makeNewElm)
        $('#vstToggleAll').off('click', ShadeTool.toggleAll)
        Map_.map.off('click', ShadeTool.setSource)
        Map_.map.off('moveend', ShadeTool.panEnd)
    }
}

export default ShadeTool
