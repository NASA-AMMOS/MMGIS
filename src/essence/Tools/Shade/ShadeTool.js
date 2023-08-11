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
import TimeControl from '../../Ancillary/TimeControl'

import arc from '../../../external/Arc/arc'
import '../../../external/ColorPicker/jqColorPicker'
import '../../../external/PNG/zlib'
import '../../../external/PNG/png'
import calls from '../../../pre/calls'

import ShadeTool_Manager from './ShadeTool_Manager'
import ShaderTool_Algorithm from './ShadeTool_Algorithm'

import './ShadeTool.css'

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
    shedColors: [{ r: 0, g: 0, b: 0, a: 192 }],
    shedMarkers: {},
    canvases: {},
    dynamicUpdateResCutoff: 2,
    dynamicUpdatePanCutoff: 2,
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
                                height: parseFloat(p[7]),
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
                                    height: p[7],
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
                `${o.opacity}+${o.resolution}+${o.height};`
        })

        return urlString
    },
    timeChange: function (time) {
        $('#shadeTool .vstRegen').addClass('changed')
        $('#vstShades li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            $('.vstOptionTime input').val(time)
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
            target: initObj.target != null ? initObj.target : 0,
            height: initObj.height != null ? initObj.height : 0,
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
                            "<div class='vstShadeTune' vstId='" + id + "' title='Options'>",
                                "<i class='mdi mdi-tune mdi-18px'></i>",
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div class='vstShadeContents' style='border-left: 6px solid " + initObj.color + ";'>",
                        "<div class='vstOptionData'>",
                            "<div title='Dataset to shade.'>Elevation Map</div>",
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
                        "<div class='vstOptionTarget'>",
                            `<div title='Orbiter or body that is the source of "light".'>Source Entity</div>`,
                            "<select class='dropdown'>",
                                "<option value='MRO' " + (initObj.target == 0 ? 'selected' : '') + ">MRO</option>",
                                "<option value='MVN' " + (initObj.target == 1 ? 'selected' : '') + ">MVN</option>",
                                "<option value='ODY' " + (initObj.target == 2 ? 'selected' : '') + ">ODY</option>",
                                "<option value='SUN' " + (initObj.target == 3 ? 'selected' : '') + ">The Sun</option>",
                                "<option value='TGO' " + (initObj.target == 4 ? 'selected' : '') + ">TGO</option>",
                            "</select>",
                        "</div>",
                        "<div class='vstOptionHeight'>",
                            "<div title='Height above surface of source point.'>Observer Height</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' step='1' value='" + initObj.height + "' default='2'>",
                                "<div class='vstUnit smallFont'>m</div>",
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
                    
                        "<div id='shadeTool_indicators'>",
                            "<div>",
                                "<div>Azimuth</div>",
                                "<canvas id='shadeTool_az'></canvas>",
                                "<div id='shadeTool_azValue'></div>",
                            "</div>",
                            "<div>",
                                "<div>Elevation</div>",
                                "<canvas id='shadeTool_el'></canvas>",
                                "<div id='shadeTool_elValue'></div>",
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
                    } else {
                        Map_.rmNotNull(L_.layers.layer[layerName])
                        Map_.rmNotNull(ShadeTool.shedMarkers[id])
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
            'change',
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
        $('#vstShades #vstId_' + id + ' .vstOptionTarget select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
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
                    // prettier-ignore
                    if( $('#vstShades #vstId_' + id + ' .vstShadeHeader .checkbox').hasClass('on') &&
                            $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                            ShadeTool.setActiveElmId(id)
                            ShadeTool.setSource()
                        }
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

        options.color.a =
            options.opacity != null
                ? parseInt(options.opacity * 255)
                : ShadeTool.shedColors[
                      activeElmId % ShadeTool.shedColors.length
                  ].a

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
            b._southWest.lng +
            't' +
            options.time.replace(/ /g, '_')

        let demUrl = ShadeTool.vars.dem
        if (!F_.isUrlAbsolute(demUrl)) demUrl = L_.missionPath + demUrl
        calls.api(
            'getbands',
            {
                type: 'band',
                x: source.lat,
                y: source.lng,
                xyorll: 'll',
                bands: '[[1,1]]',
                path: demUrl,
            },
            function (data) {
                //Convert python's Nones to nulls
                data = data.replace(/none/gi, 'null')
                if (data.length > 2) {
                    data = JSON.parse(data)
                    if (data[0] && data[0][1] != null) {
                        calls.api(
                            'll2aerll',
                            {
                                lng: source.lng,
                                lat: source.lat,
                                height: data[0][1],
                                target: options.target,
                                time: options.time,
                            },
                            function (s) {
                                s = JSON.parse(s)
                                ShadeTool.updateRAEIndicators(s, activeElmId)
                                if (s.error) {
                                    CursorInfo.update(
                                        s.message || 'LatLng to AzEl Error',
                                        6000,
                                        true,
                                        { x: 305, y: 6 },
                                        '#e9ff26',
                                        'black'
                                    )
                                } else {
                                    keepGoing({
                                        lat: s.latitude,
                                        lng: s.longitude,
                                        altitude: s.horizontal_altitude,
                                        az: s.azimuth,
                                        el: s.elevation,
                                        range: s.range,
                                    })
                                }
                            },
                            function (e) {
                                console.log('e', e)
                            }
                        )
                    }
                }
            },
            function () {
                console.warn('ShadeTool: Failed to query center elevation.')
            }
        )

        function keepGoing(targetSource) {
            ShadeTool_Manager.gather(
                ShadeTool.tags[activeElmId],
                dataLayer,
                options.resolution,
                source,
                targetSource,
                options,
                ShadeTool.vars,
                function (progress) {
                    $('#vstShades #vstId_' + activeElmId + ' .vstLoading')
                        .css({ width: progress + '%' })
                        .addClass('on')
                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen span'
                    ).css({
                        width: progress + '%',
                    })
                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen div'
                    ).text('Regenerating: ' + parseInt(progress + 1) + '%')
                },
                function (data) {
                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstLoading'
                    ).removeClass('on')
                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen span'
                    ).css({
                        width: '0%',
                    })
                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen div'
                    ).text('Regenerate')
                    // We'll use a single canvas for all tiles for capturing
                    // their dataURLs
                    let c = document.createElement('canvas')
                    const res =
                        data.tileResolution * Math.pow(2, data.resolution)
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
                                    (Math.abs(data.outputTopLeftTile.y) % 1) *
                                        2) *
                                res

                            const tileCol =
                                (x -
                                    Math.floor(data.outputTopLeftTile.x) -
                                    (Math.abs(data.outputTopLeftTile.x) % 1) *
                                        2) *
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
                                val =
                                    data.result[tileRow + Math.floor(px / res)]
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
                            dlc[z][Math.floor(x)][Math.floor(y)] =
                                F_.cloneCanvas(c)
                        }
                    }
                    ShadeTool.canvases[activeElmId] = dlc
                    makeDataLayer(dl, activeElmId, dlc)

                    $(
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen'
                    ).removeClass('changed')
                }
            )
        }

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
            invert: 1,
            targetHeight: 0,
            target: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionTarget select'
            ).val(),
            height: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionHeight input'
            ).val(),
            time: $('.vstOptionTime input').val(),
        }
    },
    delete: function (activeElmId) {
        $('#vstId_' + activeElmId).remove()
        Map_.rmNotNull(L_.layers.layer['shade' + activeElmId])
        Map_.rmNotNull(ShadeTool.shedMarkers[activeElmId])
        L_.layers.layer['shade' + activeElmId] = null
        ShadeTool.shedMarkers[activeElmId] = null
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
    // Update Range Azimuth Elevation indicators
    updateRAEIndicators(rae, shadeId) {
        const size = 240
        const sizeInner = 220
        const origin = { x: size / 2, y: size / 2 }

        // Azimuth ===================
        $(`#vstId_${shadeId} #shadeTool_azValue`).text(
            rae.error ? 'Error' : rae.azimuth.toFixed(2) + '°'
        )
        const cAz = document.querySelector(`#vstId_${shadeId} #shadeTool_az`)
        cAz.width = size
        cAz.height = size
        const ctxAz = cAz.getContext('2d')

        ctxAz.clearRect(0, 0, cAz.width, cAz.height)

        // Outer circle
        ctxAz.beginPath()
        ctxAz.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxAz.fillStyle = 'rgba(255,255,255,0.1)'
        ctxAz.fill()
        ctxAz.strokeStyle = 'black'
        ctxAz.lineWidth = 2
        ctxAz.stroke()

        // Vertical line
        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(origin.x, size - (size - sizeInner) / 2)
        ctxAz.lineTo(origin.x, (size - sizeInner) / 2)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxAz.stroke()
        // Horizontal line
        ctxAz.beginPath()
        ctxAz.beginPath()
        ctxAz.moveTo(size - (size - sizeInner) / 2, origin.y)
        ctxAz.lineTo((size - sizeInner) / 2, origin.y)
        ctxAz.lineWidth = 1
        ctxAz.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxAz.stroke()

        let azGreaterThan180
        if (rae.error != true) {
            // Angle guide
            ctxAz.beginPath()
            ctxAz.moveTo(origin.x, origin.y)
            let azim = rae.azimuth
            if (azim < 0) azim += 360
            azGreaterThan180 = azim > 180
            azim = azim * (Math.PI / 180)
            ctxAz.arc(
                origin.x,
                origin.y,
                sizeInner / 8,
                -90 * (Math.PI / 180),
                azim - 90 * (Math.PI / 180)
            )
            ctxAz.lineWidth = 2
            ctxAz.strokeStyle = '#08ea58'
            ctxAz.stroke()

            // North indicator
            ctxAz.font = '20px Arial'
            ctxAz.fillStyle = 'rgba(255,255,255,0.7)'
            ctxAz.textAlign = 'center'
            ctxAz.fillText('N', size / 2, (size - sizeInner) * 1.5)

            // Angle line
            const endAzPt = F_.rotatePoint(
                { x: origin.x, y: origin.y - sizeInner / 2 + 10 },
                [origin.x, origin.y],
                rae.azimuth * (Math.PI / 180)
            )

            ctxAz.beginPath()
            ctxAz.beginPath()
            ctxAz.moveTo(origin.x, origin.y)
            ctxAz.lineTo(endAzPt.x, endAzPt.y)
            ctxAz.lineWidth = 6
            ctxAz.strokeStyle = 'yellow'
            ctxAz.stroke()

            // Angle Arrow
            const endAzPtInner = F_.rotatePoint(
                { x: origin.x, y: origin.y - sizeInner / 2 + 20 },
                [origin.x, origin.y],
                rae.azimuth * (Math.PI / 180)
            )
            F_.canvasDrawArrow(
                ctxAz,
                endAzPtInner.x,
                endAzPtInner.y,
                endAzPt.x,
                endAzPt.y,
                4,
                'yellow'
            )
        }

        // El ========================
        $(`#vstId_${shadeId} #shadeTool_elValue`).text(
            rae.error ? 'Error' : rae.elevation.toFixed(2) + '°'
        )
        const cEl = document.querySelector(`#vstId_${shadeId} #shadeTool_el`)
        cEl.width = size
        cEl.height = size
        const ctxEl = cEl.getContext('2d')

        ctxEl.clearRect(0, 0, cEl.width, cEl.height)

        // Outer circle
        ctxEl.beginPath()
        ctxEl.arc(size / 2, size / 2, sizeInner / 2, 0, 2 * Math.PI)
        ctxEl.fillStyle = 'rgba(255,255,255,0.1)'
        ctxEl.fill()
        ctxEl.strokeStyle = 'black'
        ctxEl.lineWidth = 2
        ctxEl.stroke()

        // sky
        ctxEl.beginPath()
        ctxEl.moveTo(origin.x, origin.y)
        ctxEl.arc(origin.x, origin.y, sizeInner / 2, 0, Math.PI, true)
        const sky = ctxEl.createLinearGradient(0, 0, 0, sizeInner / 2)
        sky.addColorStop(
            0,
            rae.error ? 'rgba(210, 0, 0, 0.25)' : 'rgba(8, 174, 234, 0.25)'
        )
        sky.addColorStop(
            1,
            rae.error ? 'rgba(255, 92, 92, 0.25)' : 'rgba(255, 255, 255, 0.25)'
        )
        ctxEl.fillStyle = sky
        ctxEl.fill()

        // Vertical line
        ctxEl.beginPath()
        ctxEl.beginPath()
        ctxEl.moveTo(origin.x, size - (size - sizeInner) / 2)
        ctxEl.lineTo(origin.x, (size - sizeInner) / 2)
        ctxEl.lineWidth = 1
        ctxEl.strokeStyle = 'rgba(0,0,0,0.9)'
        ctxEl.stroke()

        if (rae.error != true) {
            // Angle guide
            ctxEl.beginPath()
            ctxEl.moveTo(origin.x, origin.y)
            let elev = rae.elevation
            let ccw = true
            if (elev < 0) {
                ccw = false
            }
            let startAngle = 0
            if (azGreaterThan180) {
                startAngle = Math.PI
                ccw = !ccw
                elev = -elev - 180
            }
            elev = -elev * (Math.PI / 180)
            ctxEl.arc(origin.x, origin.y, sizeInner / 4, startAngle, elev, ccw)
            ctxEl.lineWidth = 2
            ctxEl.strokeStyle = '#08ea58'
            ctxEl.stroke()

            let sign = -1
            let offset = 0
            if (azGreaterThan180) {
                sign = 1
                offset = 180
            }

            // Angle line
            const endElPt = F_.rotatePoint(
                { x: origin.x + sizeInner / 2 - 10, y: origin.y },
                [origin.x, origin.y],
                sign * (offset + rae.elevation) * (Math.PI / 180)
            )

            ctxEl.beginPath()
            ctxEl.beginPath()
            ctxEl.moveTo(origin.x, origin.y)
            ctxEl.lineTo(endElPt.x, endElPt.y)
            ctxEl.lineWidth = 6
            ctxEl.strokeStyle = 'yellow'
            ctxEl.stroke()

            // Angle Arrow
            const endElPtInner = F_.rotatePoint(
                { x: origin.x + sizeInner / 2 - 20, y: origin.y },
                [origin.x, origin.y],
                sign * (offset + rae.elevation) * (Math.PI / 180)
            )
            F_.canvasDrawArrow(
                ctxEl,
                endElPtInner.x,
                endElPtInner.y,
                endElPt.x,
                endElPt.y,
                4,
                'yellow'
            )
        }
    },
    parseToTDBTime(time) {
        //'2023-06-28T03:15:20.883Z' -> '2023 JUL 16 03:56:00 TDB'
        return (
            time.substring(0, 4) +
            ' ' +
            F_.monthNumberToName(
                parseInt(time.substring(5, 7)) - 1
            ).toUpperCase() +
            ' ' +
            time.substring(8, 10) +
            ' ' +
            time.substring(11, 19) +
            ' TDB'
        )
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

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
                "<div class='vstOptionTime'>",
                    "<div class='flexbetween'>",
                        `<input type='text' value='${ShadeTool.parseToTDBTime(TimeControl.getEndTime())}'>`,
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

    TimeControl.subscribe('ShadeTool', (t) => {
        ShadeTool.timeChange(ShadeTool.parseToTDBTime(t.currentTime))
    })

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

        TimeControl.unsubscribe('ShadeTool')
    }
}

export default ShadeTool
