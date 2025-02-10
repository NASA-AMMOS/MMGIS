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
import Help from '../../Ancillary/Help'

import '../../../external/ColorPicker/jqColorPicker'
import '../../../external/PNG/zlib'
import '../../../external/PNG/png'

import calls from '../../../pre/calls'

import ShadeTool_Manager from './ShadeTool_Manager'
import ShaderTool_Algorithm from './ShadeTool_Algorithm'

import './ShadeTool.css'

const helpKey = 'ShadeTool'

let ShadeTool = {
    height: 0,
    width: 260,
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
    dynamicUpdateResCutoff: 1,
    dynamicUpdatePanCutoff: 1,
    MMGISInterface: null,
    tempSheet: null,
    tempIndicatorPoint: null,
    indicatorLastDragPoint: null,
    tempIndicatorPointStyle: {
        fillColor: '#000',
        fillOpacity: 0,
        color: 'lime',
        weight: 3,
    },
    sunColor: '#d2db58',
    earthColor: '#58dbb8',
    _lastConvertedMs: '000',
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

        ShadeTool.indicatorLastDragPoint = null

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

        // Initial Query
        $('#vstShades #vstId_0 .vstRegen').click()
        ShadeTool.updateObserverSpecificTime(0)
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
        if (this.tempSheet) this.tempSheet.remove()
    },
    getUrlString: function () {
        let urlString = ''

        $('#vstShades > li').each((i, elm) => {
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
    timeChange: function () {
        $('#shadeTool .vstRegen').addClass('changed')
        $('#vstShades > li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            $('.vstOptionTime input').val(
                ShadeTool.parseToUTCTime(TimeControl.getEndTime(), true)
            )
            const rawTime = ShadeTool.parseToUTCTime(TimeControl.getEndTime())
            $('.vstOptionTime input').attr('raw', rawTime)
            $('.vstOptionTime input').attr('title', rawTime)
            ShadeTool.updateObserverSpecificTime(id)
            // prettier-ignore
            if (
                ShadeTool.tags[id] != null && // already generated
                $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdatePanCutoff
            ) {
                ShadeTool.setSource(null, null, id)
            }
        })
    },
    panEnd: function () {
        ShadeTool.indicatorLastDragPoint = null
        $('#shadeTool .vstRegen').addClass('changed')
        $('#vstShades > li').each((i, elm) => {
            const id = $(elm).attr('shadeId')
            // prettier-ignore
            if (
                ShadeTool.tags[id] != null && // already generated
                $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdatePanCutoff
            ) {
                ShadeTool.setSource(null, null, id)
            }
        })
    },
    toggleAll: function () {
        $('#vstToggleAll').toggleClass('on')

        const isOn = $('#vstToggleAll').hasClass('on')

        $('#vstShades > li').each((i, elm) => {
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
            opacity: initObj.opacity != null ? initObj.opacity : 0.75,
            includeSunEarth:
                initObj.includeSunEarth != null
                    ? initObj.includeSunEarth
                    : 'false',
            resolution: initObj.resolution != null ? initObj.resolution : 1,
            target: initObj.target != null ? initObj.target : 0,
            height:
                initObj.height != null
                    ? initObj.height
                    : ShadeTool.vars.defaultHeight || 0,
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

        let allSources = ''
        let sourcesList = [
            {
                name: 'Custom',
                value: false,
            },
        ]
        if (
            ShadeTool.vars &&
            ShadeTool.vars.sources &&
            ShadeTool.vars.sources.length > 0
        ) {
            sourcesList = ShadeTool.vars.sources.concat(sourcesList)
        }
        allSources = sourcesList
            .map(
                (c, i) =>
                    "<option value='" +
                    c.value +
                    "' " +
                    (i === 0 ? 'selected' : '') +
                    '>' +
                    c.name +
                    '</option>'
            )
            .join('\n')

        let allObservers = ''
        if (
            ShadeTool.vars &&
            ShadeTool.vars.observers &&
            ShadeTool.vars.observers.length > 0
        ) {
            allObservers = ShadeTool.vars.observers
                .map((c, i) => {
                    if (c.value != null && c.name != null)
                        return (
                            "<option value='" +
                            c.value +
                            "' " +
                            (i === 0 ? 'selected' : '') +
                            '>' +
                            c.name +
                            '</option>'
                        )
                })
                .join('\n')
        }

        // prettier-ignore
        let markup = [
                "<li id='vstId_" + id + "' shadeId='" + id + "'>",
                    "<div class='vstShadeContents'>",
                        "<div class='vstLoading'></div>",
                        `<div class='vstOptionHeading'>Source</div>`,
                        "<div class='vstOptionTarget'>",
                            `<div title='Orbiter or body that is the source of "light".'><span style='color: var(--color-p0);'>Entity</span></div>`,
                            "<select class='dropdown'>",
                                allSources,
                            "</select>",
                        "</div>",
                        "<div class='vstOptionIncludeSunEarth'>",
                            `<div title='Query for and show Sun and Earth az/el directional arrows'>Include <span style='color: ${ShadeTool.sunColor};'>Sun</span> + <span style='color: ${ShadeTool.earthColor};'>Earth</span></div>`,
                            "<select class='dropdown'>",
                                "<option value='false' " + (initObj.includeSunEarth == 'false' ? 'selected' : '') + ">False</option>",
                                "<option value='true' " + (initObj.includeSunEarth != 'false' ? 'selected' : '') + ">True</option>",
                            "</select>",
                        "</div>",
                        `<div class='vstOptionHeading'>Observer</div>`,
                        allObservers.length != 0 ? [
                            "<div class='vstOptionObserver'>",
                                `<div title='Ground observer for time conversions'>Entity</div>`,
                                "<select class='dropdown'>",
                                    allObservers,
                                "</select>",
                            "</div>",
                            "<div class='vstOptionTimeSpecific'>",
                                `<div title='Ground observer time'>Time</div>`,
                                "<div class='flexbetween'>",
                                    `<div class='vstClockIcon2'><i class='mdi mdi-clock-outline mdi-18px'></i></div>`,
                                    `<input type='text' placeholder='${ShadeTool.vars.observerTimePlaceholder || ''}' value='${TimeControl.getEndTime()}'>`,
                                "</div>",
                            "</div>",
                        ].join('\n') : null,
                        "<div class='vstOptionHeight'>",
                            "<div title='Height above surface of source point.'>Height</div>",
                            "<div class='flexbetween'>",
                                "<input type='number' min='0' step='1' value='" + initObj.height + "' default='2'>",
                                "<div class='vstUnit smallFont'>m</div>",
                            "</div>",
                        "</div>",
                        `<div class='vstOptionHeading'>Shaded Region Options</div>`,
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
                        "<div class='vstOptionData'>",
                            "<div title='Dataset to shade.'>Elevation Map</div>",
                            "<select class='dropdown'>",
                                allData,
                            "</select>",
                        "</div>",
                        "<div class='vstShadeBar'>",
                            "<div class='vstRegen changed'>",
                                "<div>Generate</div>",
                                "<span></span>",
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div id='shadeTool_results'>",
                        "<div id='shadeTool_results_title'>Results</div>",
                        "<div id='shadeTool_results_outputs'>",
                            "<ul>",
                                "<li>",
                                    "<div>Azimuth</div>",
                                    "<div id='shadeTool_results_outputs_az'></div>",
                                    "<div class='flexbetween' id='shadeTool_results_outputs_az_input_wrap' style='display: none;'>",
                                        "<input id='shadeTool_results_outputs_az_input' type='number' min='0' max='360'></input>",
                                        "<div class='vstUnit smallFont'>&deg;</div>",
                                    "</div>",
                                "</li>",
                                "<li>",
                                    "<div>Elevation</div>",
                                    "<div id='shadeTool_results_outputs_el'></div>",
                                    "<div class='flexbetween' id='shadeTool_results_outputs_el_input_wrap' style='display: none;'>",
                                        "<input id='shadeTool_results_outputs_el_input' type='number' min='-90' max='90'></input>",
                                        "<div class='vstUnit smallFont'>&deg;</div>",
                                    "</div>",
                                "</li>",
                                "<li>",
                                    "<div>Range</div>",
                                    "<div id='shadeTool_results_outputs_range'></div>",
                                    "<div class='flexbetween' id='shadeTool_results_outputs_range_input_wrap' style='display: none;'>",
                                        "<input id='shadeTool_results_outputs_range_input' type='number' disabled></input>",
                                        "<div class='vstUnit smallFont'>km</div>",
                                    "</div>",
                                "</li>",
                                /*
                                "<li>",
                                    "<div>Longitude</div>",
                                    "<div id='shadeTool_results_outputs_lng'></div>",
                                "</li>",
                                "<li>",
                                    "<div>Latitude</div>",
                                    "<div id='shadeTool_results_outputs_lat'></div>",
                                "</li>",
                                */
                            "</ul>",
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
        $('.vstOptionTime input').on(
            'change',
            (function (id) {
                return function () {
                    let time = $(this).val()
                    if (ShadeTool.vars.utcTimeFormat) {
                        const parseTime = d3.utcParse(
                            ShadeTool.vars.utcTimeFormat
                        )
                        time = parseTime(time).toISOString()
                    } else {
                        time += 'Z'
                    }

                    let isValid = false
                    try {
                        new Date(time).toISOString()
                        isValid = true
                    } catch {}
                    if (isValid) {
                        TimeControl.setTime(TimeControl.getStartTime(), time)
                        ShadeTool.updateObserverSpecificTime(id)
                    } else {
                        CursorInfo.update(
                            'Invalid Time Entered',
                            6000,
                            true,
                            { x: 296, y: -5 },
                            '#e9ff26',
                            'black'
                        )
                    }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionTimeSpecific input').on(
            'change',
            (function (id) {
                return function () {
                    ShadeTool.updateFromObserverSpecificTime(id)
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
                    if (
                        $(
                            `#vstShades #vstId_${id} .vstOptionResolution select`
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }
            })(id)
        )
        $('#vstShades #vstId_' + id + ' .vstOptionIncludeSunEarth select').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    if (
                        $(
                            `#vstShades #vstId_${id} .vstOptionResolution select`
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
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
                    const val = $(
                        '#vstShades #vstId_' + id + ' .vstOptionTarget select'
                    ).val()
                    if (val === 'false') {
                        $('#shadeTool_results_outputs_az').css({
                            display: 'none',
                        })
                        $('#shadeTool_results_outputs_az_input_wrap').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_az_input').val(
                            parseFloat(
                                $('#shadeTool_results_outputs_az').text()
                            )
                        )
                        $('#shadeTool_results_outputs_el').css({
                            display: 'none',
                        })
                        $('#shadeTool_results_outputs_el_input_wrap').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_el_input').val(
                            parseFloat(
                                $('#shadeTool_results_outputs_el').text()
                            )
                        )
                        $('#shadeTool_results_outputs_range').css({
                            display: 'none',
                        })
                        $('#shadeTool_results_outputs_range_input_wrap').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_range_input').val(
                            parseFloat(
                                100000 //$('#shadeTool_results_outputs_range').text()
                            )
                        )
                    } else {
                        $('#shadeTool_results_outputs_az').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_az_input_wrap').css({
                            display: 'none',
                        })
                        $('#shadeTool_results_outputs_el').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_el_input_wrap').css({
                            display: 'none',
                        })
                        $('#shadeTool_results_outputs_range').css({
                            display: 'inherit',
                        })
                        $('#shadeTool_results_outputs_range_input_wrap').css({
                            display: 'none',
                        })
                    }
                    if (
                        $(
                            `#vstShades #vstId_${id} .vstOptionResolution select`
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }
            })(id)
        )
        $('#shadeTool_results_outputs_az_input').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    if (
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionResolution select'
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }
            })(id)
        )
        $('#shadeTool_results_outputs_el_input').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    if (
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionResolution select'
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }
            })(id)
        )
        $('#shadeTool_results_outputs_range_input').on(
            'change',
            (function (id) {
                return function () {
                    $('#vstShades #vstId_' + id + ' .vstRegen').addClass(
                        'changed'
                    )
                    if (
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionResolution select'
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
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
                    if (
                        $(
                            '#vstShades #vstId_' +
                                id +
                                ' .vstOptionResolution select'
                        ).val() <= ShadeTool.dynamicUpdateResCutoff
                    ) {
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

        $('#vstId_' + id + '_color').colorPicker({
            opacity: false,
            renderCallback: function (elm, toggled) {
                const bg = elm._css.backgroundColor.replace('NaN', 1)
                $('#vstId_' + id + '_color').css({
                    background: bg,
                })
                $('#vstShades #vstId_' + id + ' .vstRegen').addClass('changed')
                $('#vstId_' + id + '_color').attr(
                    'color',
                    JSON.stringify(this.color.colors.RND.rgb)
                )
                clearTimeout(ShadeTool._colorTimeout)
                ShadeTool._colorTimeout = setTimeout(() => {
                    // prettier-ignore
                    if( $('#vstShades #vstId_' + id + ' .vstOptionResolution select').val() <= ShadeTool.dynamicUpdateResCutoff) {
                        ShadeTool.setActiveElmId(id)
                        ShadeTool.setSource()
                    }
                }, 500)
            },
        })

        $('#vstId_' + id + '_color').css({
            'background-color': initObj.color,
        })

        ShadeTool.setActiveElmId(id)

        if (forcedId == null) ShadeTool.shadeElmCount++
        else
            ShadeTool.shadeElmCount =
                Math.max(forcedId, ShadeTool.shadeElmCount) + 1
    },
    setActiveElmId: function (activeId) {
        $('#vstShades > li .activator').removeClass('on')
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
    updateObserverSpecificTime: function (id) {
        id = id || 0

        const options = ShadeTool.getShadeOptions(id)
        let body
        if (ShadeTool.vars?.observers) {
            for (let i = 0; i < ShadeTool.vars.observers.length; i++) {
                if ((ShadeTool.vars.observers[i].value = options.observer)) {
                    body = ShadeTool.vars.observers[i].body
                }
            }
        }

        if (body == null || options.observer == null) return

        calls.api(
            'chronice',
            {
                body: body,
                target: options.observer,
                from: 'utc',
                time: TimeControl.getEndTime().replace(
                    '.000Z',
                    `.${ShadeTool._lastConvertedMs}Z`
                ),
            },
            function (s) {
                if (s.error) {
                    CursorInfo.update(
                        "Cannot Convert to Observer's Time",
                        6000,
                        true,
                        { x: 296, y: -5 },
                        '#e9ff26',
                        'black'
                    )
                } else {
                    $(
                        '#vstShades #vstId_' +
                            id +
                            ' .vstOptionTimeSpecific input'
                    ).val(s.result)
                }
            }
        )
    },
    updateFromObserverSpecificTime: function (id) {
        id = id || 0

        const options = ShadeTool.getShadeOptions(id)
        let body
        if (ShadeTool.vars?.observers) {
            for (let i = 0; i < ShadeTool.vars.observers.length; i++) {
                if ((ShadeTool.vars.observers[i].value = options.observer)) {
                    body = ShadeTool.vars.observers[i].body
                }
            }
        }

        if (body == null || options.observer == null) return

        calls.api(
            'chronice',
            {
                body: body,
                target: options.observer,
                from: 'lmst',
                time: $(
                    '#vstShades #vstId_' + id + ' .vstOptionTimeSpecific input'
                ).val(),
            },
            function (s) {
                try {
                    s = JSON.parse(s)
                } catch {
                    CursorInfo.update(
                        'Failure Processing Inputted Time',
                        6000,
                        true,
                        { x: 296, y: -5 },
                        '#e9ff26',
                        'black'
                    )
                    return
                }
                if (s.error) {
                    CursorInfo.update(
                        'Cannot Process Inputted Time',
                        6000,
                        true,
                        { x: 296, y: -5 },
                        '#e9ff26',
                        'black'
                    )
                } else {
                    ShadeTool._lastConvertedMs = s.result.split('.')[1] || '000'
                    TimeControl.setTime(
                        TimeControl.getStartTime(),
                        s.result.replace(' ', 'T') + 'Z'
                    )
                }
            }
        )
    },
    shade: function (source, activeElmId, ignoreMarker, initObj) {
        if (activeElmId == null) return

        let options = initObj || ShadeTool.getShadeOptions(activeElmId)
        // ==VtoS-Change-Start==================
        //Find center of map
        const mapRect = document.getElementById('map').getBoundingClientRect()
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2
        let centerLatLng = Map_.map.containerPointToLatLng([wOffset, hOffset])

        if (ShadeTool.indicatorLastDragPoint)
            centerLatLng = ShadeTool.indicatorLastDragPoint

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

        const isCustom = options.target === 'false'
        let customAz, customEl, customRange
        if (isCustom) {
            customAz = parseFloat(
                $('#shadeTool_results_outputs_az_input').val()
            )
            customEl = parseFloat(
                $('#shadeTool_results_outputs_el_input').val()
            )
            customRange = parseFloat(
                $('#shadeTool_results_outputs_range_input').val()
            )
            if (isNaN(customAz) || isNaN(customEl) || isNaN(customRange)) {
                CursorInfo.update(
                    'Azimuth, Elevation and Range need to be set when using Custom Az/El source.',
                    6000,
                    true,
                    { x: 296, y: -5 },
                    '#e9ff26',
                    'black'
                )
                return
            }
        }

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
            'g' +
            options.target +
            't' +
            options.time.replace(/ /g, '_')

        // Custom source needs azimuth, elevation and range part of id to make it unique
        if (isCustom)
            ShadeTool.tags[
                activeElmId
            ] += `A${customAz}E${customEl}R${customRange}`

        //
        let obsRefFrame
        let obsBody
        if (ShadeTool.vars?.observers) {
            for (let i = 0; i < ShadeTool.vars.observers.length; i++) {
                if ((ShadeTool.vars.observers[i].value = options.observer)) {
                    obsRefFrame = ShadeTool.vars.observers[i].frame
                    obsBody = ShadeTool.vars.observers[i].body
                } else if (options.observer == null) {
                    // If no observer, pick first
                    obsRefFrame = ShadeTool.vars.observers[0].frame
                    obsBody = ShadeTool.vars.observers[0].body
                    break
                }
            }
        }

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
                if (data[0] && data[0][1] != null) {
                    calls.api(
                        'll2aerll',
                        {
                            lng: source.lng,
                            lat: source.lat,
                            height: data[0][1],
                            target: options.target,
                            time: options.time + ' UTC',
                            obsRefFrame: obsRefFrame,
                            obsBody: obsBody,
                            includeSunEarth: options.includeSunEarth,
                            isCustom: isCustom,
                            customAz,
                            customEl,
                            customRange,
                        },
                        function (s) {
                            /*
                            Map_.rmNotNull(ShadeTool.tempIndicatorPoint)
                            ShadeTool.tempIndicatorPoint =
                                new L.circleMarker(
                                    [source.lat, source.lng],
                                    ShadeTool.tempIndicatorPointStyle
                                )
                                    .setRadius(4)
                                    .addTo(Map_.map)
                                    .bringToFront()

                            ShadeTool.indicatorDragOn()
                            */

                            ShadeTool.updateRAEIndicators(s, activeElmId)
                            // CLear result outputs
                            $('#shadeTool_results_outputs_az').text('--')
                            $('#shadeTool_results_outputs_el').text('--')
                            $('#shadeTool_results_outputs_range').text('--')
                            //$('#shadeTool_results_outputs_lng').text('--')
                            //$('#shadeTool_results_outputs_lat').text('--')

                            if (s.message && s.message.indexOf('INSUFFDATA'))
                                s.message =
                                    'Insufficient SPICE kernels for this source entity and time period.'
                            if (s.error) {
                                CursorInfo.update(
                                    s.message || 'LatLng to AzEl Error',
                                    6000,
                                    true,
                                    { x: 296, y: -5 },
                                    '#e9ff26',
                                    'black'
                                )
                            } else {
                                // Update result outputs
                                $('#shadeTool_results_outputs_az').text(
                                    s.azimuth.toFixed(3) + '°'
                                )
                                $('#shadeTool_results_outputs_el').text(
                                    s.elevation.toFixed(3) + '°'
                                )
                                $('#shadeTool_results_outputs_range').text(
                                    s.range.toFixed(3) + 'km'
                                )
                                /*
                                    $('#shadeTool_results_outputs_lng').text(
                                        s.longitude.toFixed(8) + '°'
                                    )
                                    $('#shadeTool_results_outputs_lat').text(
                                        s.latitude.toFixed(8) + '°'
                                    )
                                    */

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
                            $(
                                '#vstShades #vstId_' +
                                    activeElmId +
                                    ' .vstRegen'
                            ).removeClass('regening')
                        }
                    )
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
                        '#vstShades #vstId_' + activeElmId + ' .vstRegen'
                    ).addClass('regening')
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
                    ).removeClass('regening')

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
                    : $('#vstId_' + elmId + '_color').attr('color') ||
                          JSON.stringify(
                              ShadeTool.shedColors[
                                  elmId % ShadeTool.shedColors.length
                              ]
                          )
            ),
            opacity: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionOpacity input'
            ).val(),
            includeSunEarth: $(
                '#vstShades #vstId_' +
                    elmId +
                    ' .vstOptionIncludeSunEarth select'
            ).val(),
            resolution: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionResolution select'
            ).val(),
            invert: 1,
            target: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionTarget select'
            ).val(),
            targetHeight: parseFloat(
                $(
                    '#vstShades #vstId_' + elmId + ' .vstOptionHeight input'
                ).val()
            ),
            observer: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionObserver select'
            ).val(),
            height: $(
                '#vstShades #vstId_' + elmId + ' .vstOptionHeight input'
            ).val(),
            time: $('.vstOptionTime input').attr('raw'),
        }
    },
    // Update Range Azimuth Elevation indicators
    updateRAEIndicators(rae, shadeId) {
        const size = 240
        const sizeInner = 220
        const origin = { x: size / 2, y: size / 2 }

        $(`#vstId_${shadeId} #shadeTool_indicators`).css({
            borderBottom: rae.error ? '3px solid var(--color-red)' : 'none',
        })

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
        let sunAzGreaterThan180
        let earthAzGreaterThan180
        if (rae.error != true) {
            // North indicator
            ctxAz.font = '20px Arial'
            ctxAz.fillStyle = 'rgba(255,255,255,0.7)'
            ctxAz.textAlign = 'center'
            ctxAz.fillText('N', size / 2, (size - sizeInner) * 1.5)

            if (rae.ancillary?.sun_az) {
                let azim = rae.ancillary.sun_az
                if (azim < 0) azim += 360
                sunAzGreaterThan180 = azim > 180
                azim = azim * (Math.PI / 180)
                ShadeTool.drawAzAngleGuideOnCanvas(
                    ctxAz,
                    origin,
                    sizeInner,
                    rae.ancillary.sun_az,
                    azim,
                    {
                        color: ShadeTool.sunColor,
                        shortenPx: 40,
                    }
                )
            }
            if (rae.ancillary?.earth_az) {
                let azim = rae.ancillary.earth_az
                if (azim < 0) azim += 360
                earthAzGreaterThan180 = azim > 180
                azim = azim * (Math.PI / 180)
                ShadeTool.drawAzAngleGuideOnCanvas(
                    ctxAz,
                    origin,
                    sizeInner,
                    rae.ancillary.earth_az,
                    azim,
                    {
                        color: ShadeTool.earthColor,
                        shortenPx: 60,
                    }
                )
            }
            let azim = rae.azimuth
            if (azim < 0) azim += 360
            azGreaterThan180 = azim > 180
            azim = azim * (Math.PI / 180)
            ShadeTool.drawAzAngleGuideOnCanvas(
                ctxAz,
                origin,
                sizeInner,
                rae.azimuth,
                azim,
                {
                    angleGuide: true,
                    color:
                        rae.ancillary?.sun_el || rae.ancillary?.earth_el
                            ? '#dbb658'
                            : 'yellow',
                }
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
            if (rae.ancillary?.sun_el) {
                ShadeTool.drawElAngleGuideOnCanvas(
                    ctxEl,
                    origin,
                    sizeInner,
                    rae.ancillary.sun_el,
                    {
                        azGreaterThan180: sunAzGreaterThan180,
                        color: ShadeTool.sunColor,
                        shortenPx: 40,
                    }
                )
            }
            if (rae.ancillary?.earth_el) {
                ShadeTool.drawElAngleGuideOnCanvas(
                    ctxEl,
                    origin,
                    sizeInner,
                    rae.ancillary.earth_el,
                    {
                        azGreaterThan180: earthAzGreaterThan180,
                        color: ShadeTool.earthColor,
                        shortenPx: 60,
                    }
                )
            }

            ShadeTool.drawElAngleGuideOnCanvas(
                ctxEl,
                origin,
                sizeInner,
                rae.elevation,
                {
                    azGreaterThan180: azGreaterThan180,
                    angleGuide: true,
                    color:
                        rae.ancillary?.sun_el || rae.ancillary?.earth_el
                            ? '#dbb658'
                            : 'yellow',
                }
            )
        }
    },
    drawAzAngleGuideOnCanvas(ctx, origin, sizeInner, angle, angle2, options) {
        options = options || {}
        // Angle guide
        if (options.angleGuide) {
            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)

            ctx.arc(
                origin.x,
                origin.y,
                sizeInner / 8,
                -90 * (Math.PI / 180),
                angle2 - 90 * (Math.PI / 180)
            )
            ctx.lineWidth = 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        // Angle line
        const endAzPt = F_.rotatePoint(
            {
                x: origin.x,
                y: origin.y - sizeInner / 2 + 10 + (options.shortenPx || 0),
            },
            [origin.x, origin.y],
            angle * (Math.PI / 180)
        )

        ctx.beginPath()
        ctx.beginPath()
        ctx.moveTo(origin.x, origin.y)
        ctx.lineTo(endAzPt.x, endAzPt.y)
        ctx.lineWidth = 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        // Angle Arrow
        const endAzPtInner = F_.rotatePoint(
            {
                x: origin.x,
                y: origin.y - sizeInner / 2 + 20 + (options.shortenPx || 0),
            },
            [origin.x, origin.y],
            angle * (Math.PI / 180)
        )
        F_.canvasDrawArrow(
            ctx,
            endAzPtInner.x,
            endAzPtInner.y,
            endAzPt.x,
            endAzPt.y,
            4,
            options.color || 'yellow'
        )
    },
    drawElAngleGuideOnCanvas(ctx, origin, sizeInner, angle, options) {
        options = options || {}
        // Angle guide
        if (options.angleGuide) {
            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)
            let elev = angle
            let ccw = true
            if (elev < 0) {
                ccw = false
            }
            let startAngle = 0
            if (options.azGreaterThan180) {
                startAngle = Math.PI
                ccw = !ccw
                elev = -elev - 180
            }
            elev = -elev * (Math.PI / 180)
            ctx.arc(origin.x, origin.y, sizeInner / 4, startAngle, elev, ccw)
            ctx.lineWidth = 2
            ctx.strokeStyle = '#eeeeee'
            ctx.stroke()
        }

        let sign = -1
        let offset = 0
        if (options.azGreaterThan180) {
            sign = 1
            offset = 180
        }

        // Angle line
        const endElPt = F_.rotatePoint(
            {
                x: origin.x + sizeInner / 2 - 10 - (options.shortenPx || 0),
                y: origin.y,
            },
            [origin.x, origin.y],
            sign * (offset + angle) * (Math.PI / 180)
        )

        ctx.beginPath()
        ctx.beginPath()
        ctx.moveTo(origin.x, origin.y)
        ctx.lineTo(endElPt.x, endElPt.y)
        ctx.lineWidth = 6
        ctx.strokeStyle = options.color || 'yellow'
        ctx.stroke()

        // Angle Arrow
        const endElPtInner = F_.rotatePoint(
            {
                x: origin.x + sizeInner / 2 - 20 - (options.shortenPx || 0),
                y: origin.y,
            },
            [origin.x, origin.y],
            sign * (offset + angle) * (Math.PI / 180)
        )
        F_.canvasDrawArrow(
            ctx,
            endElPtInner.x,
            endElPtInner.y,
            endElPt.x,
            endElPt.y,
            4,
            options.color || 'yellow'
        )
    },
    parseToUTCTime(time, formatted) {
        if (formatted && ShadeTool.vars.utcTimeFormat) {
            const tF = d3.utcFormat(ShadeTool.vars.utcTimeFormat)
            return tF(Date.parse(time))
        }
        //'2023-06-28T03:15:20.883Z' -> '2023 JUL 16 03:56:00'
        return (
            time.substring(0, 4) +
            ' ' +
            F_.monthNumberToName(
                parseInt(time.substring(5, 7)) - 1
            ).toUpperCase() +
            ' ' +
            time.substring(8, 10) +
            ' ' +
            time.substring(11, 19)
        )
    },
    delete: function (activeElmId) {
        Map_.rmNotNull(L_.layers.layer['shade' + activeElmId])
        L_.layers.layer['shade' + activeElmId] = null
        ShadeTool.canvases[activeElmId] = null
    },
    indicatorDragOn: function () {
        ShadeTool.tempIndicatorPoint.on(
            'mousedown',
            ShadeTool.indicatorDragDown
        )
        Map_.map.on('mouseup', ShadeTool.indicatorDragUp)
        Map_.map.on('mousemove', ShadeTool.indicatorDragMove)
    },
    indicatorDragOff: function () {
        ShadeTool.tempIndicatorPoint.off('mousedown', DrawTool.cmLayerDown)
        Map_.map.off('mouseup', DrawTool.cmLayerUp)
        Map_.map.off('mousemove', DrawTool.cmLayerMove)

        ShadeTool.tempIndicatorPoint.dragging = false
        Map_.map.dragging.enable()
    },
    indicatorDragDown: function () {
        ShadeTool.tempIndicatorPoint.dragging = true
        Map_.map.dragging.disable()
    },
    indicatorDragUp: function () {
        if (ShadeTool.tempIndicatorPoint.dragging == true) {
            ShadeTool.tempIndicatorPoint.dragging = false
            //So the layer itself can ignore the click to drag
            ShadeTool.tempIndicatorPoint.justDragged = true
            Map_.map.dragging.enable()
            if (DrawTool.indicatorLastDragPoint) {
                Map_.rmNotNull(ShadeTool.tempIndicatorPoint)
            }
        }
    },
    indicatorDragMove: function (e) {
        if (ShadeTool.tempIndicatorPoint.dragging) {
            ShadeTool.tempIndicatorPoint.setLatLng(e.latlng)
            ShadeTool.indicatorLastDragPoint = e.latlng
        }
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    if (TimeControl.enabled != true) {
        console.error('ERROR: ShadeTool - Time must be enabled.')
        return
    }

    const rawTime = ShadeTool.parseToUTCTime(TimeControl.getEndTime())
    // prettier-ignore
    let markup = [
        "<div id='shadeTool'>",
            "<div id='vstHeader'>",
                "<div>",
                    "<div>",
                        "<div id='vstTitle'>Shade</div>",
                        Help.getComponent(helpKey),
                    "</div>",
                "</div>",
                "<div class='vstOptionTime'>",
                    "<div class='flexbetween'>",
                        `<div class='vstClockIcon'><i class='mdi mdi-clock-outline mdi-18px'></i></div>`,
                        `<input type='text' value='${ShadeTool.parseToUTCTime(TimeControl.getEndTime(), true)}' raw='${rawTime}' title='${rawTime}'>`,
                    "</div>",
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

    Help.finalize(helpKey)

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
        ShadeTool.timeChange(ShadeTool.parseToUTCTime(t.currentTime))
    })

    //Add event functions and whatnot

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        Map_.rmNotNull(ShadeTool.tempIndicatorPoint)
        ShadeTool.delete(0)
        ShadeTool.lastShadesUl = {}
        $('#vstShades > li').each((i, elm) => {
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
