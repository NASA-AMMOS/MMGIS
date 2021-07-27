import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Login from '../../Ancillary/Login/Login'
import CursorInfo from '../../Ancillary/CursorInfo'
import { Kinds } from '../../../pre/tools'
import Dropy from '../../../external/Dropy/dropy'

import './InfoTool.css'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
        "<div id='infoTool'>",
            "<div id='infoToolHeader'>",
                "<div class='left'>",
                    "<div id='infoToolTitle'>Info</div>",
                    "<div id='infoToolEquiv' title='Number of overlapping features'></div>",
                "</div>",
                "<div class='right'>",
                    "<div id='infoToolDownload' title='Copy Feature to Clipboard'>",
                        "<i class='mdi mdi-clipboard-outline mdi-18px'></i>",
                    "</div>",
                    "<div id='infoToolLocate' title='Locate on Map'>",
                        "<i class='mdi mdi-crosshairs-gps mdi-18px'></i>",
                    "</div>",
                "</div>",
            "</div>",
            "<div id='infoToolSelected'>",
                "<div id='infoToolSelectedDropdown'></div>",
            "</div>",
            "<div id='infoToolFilter'>",
                "<input type='text' placeholder='Filter'>",
                "<i class='mdi mdi-filter-variant mdi-18px'></i>",
                "<div  id='infoToolShowHidden' title='Toggle Hidden Properties'>",
                    "<i class='mdi mdi-eye-off mdi-18px'></i>",
                "</div>",
            "</div>",
            "<div id='infoToolContent'>",
                "<ul id='infoToolData'></ul>",
                "<div id='infoToolNoneSelected'>No feature selected</div>",
            "</div>",
        "</div>"
    ].join('\n');

var InfoTool = {
    height: 0,
    width: 250,
    currentLayer: null,
    currentLayerName: null,
    info: null,
    variables: null,
    activeFeatureI: null,
    filterString: '',
    hiddenShown: false,
    hiddenRootFields: ['_', 'style', 'images'],
    vars: {},
    MMGISInterface: null,
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
    //We might get multiple features if vector layers overlap
    use: function (
        currentLayer,
        currentLayerName,
        features,
        variables,
        activeI,
        open,
        initialEvent,
        additional
    ) {
        let toolActive = $('#InfoTool').hasClass('active')

        if (!open && toolActive) open = true

        //In the very least, update the info
        if (open && !toolActive) {
            $('#InfoTool').click()
        }

        if (additional && additional.idx) activeI = additional.idx

        if (currentLayer != null && currentLayerName != null) {
            this.currentLayer = currentLayer
            this.currentLayerName = currentLayerName
            this.info = features
            this.variables = variables
            let activeIndex = activeI
            if (activeI == null) {
                let foundI = this.findFeature(currentLayer, features)
                activeIndex = foundI != -1 ? foundI : 0
            }
            this.activeFeatureI = activeIndex
            this.initialEvent = initialEvent
        }

        if (open != true) return
        //MMGIS should always have a div with id 'tools'
        var tools = d3.select('#toolPanel')
        tools.style('background', 'var(--color-k)')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools.append('div').style('height', '100%')
        //Add the markup to tools or do it manually
        tools.html(markup)

        if (this.info == null || this.info.length == 0) {
            $('#infoToolHeader > .right').css('display', 'none')
            $('#infoToolSelected').css('display', 'none')
            $('#infoToolFilter').css('display', 'none')
            $('#infoToolNoneSelected').css('display', 'block')
            return
        }

        $('#infoToolHeader > .right').css('display', 'inherit')
        $('#infoToolSelected').css('display', 'inherit')
        $('#infoToolFilter').css('display', 'inherit')
        $('#infoToolNoneSelected').css('display', 'none')

        // Update number of equivalent features
        if (this.info.length > 1) {
            $('#infoToolEquiv').text(`${this.info.length}`)
            $('#infoToolEquiv').css('display', 'block')
        } else {
            $('#infoToolEquiv').text(`1`)
            $('#infoToolEquiv').css('display', 'none')
        }

        // Populate Dropdown
        let nameItems = []
        for (let i = 0; i < this.info.length; i++) {
            if (!this.info[i].properties) {
                if (this.info[i].feature) this.info[i] = this.info[i].feature
            }
            let name =
                this.info[i].properties[Object.keys(this.info[i].properties)[0]]
            if (
                this.variables &&
                this.variables.useKeyAsName &&
                this.info[i].properties.hasOwnProperty(
                    this.variables.useKeyAsName
                )
            )
                name = this.info[i].properties[this.variables.useKeyAsName]

            nameItems.push(name)
        }

        $('#infoToolSelectedDropdown').html(
            Dropy.construct(
                nameItems,
                `Feature${
                    this.info.length > 1 ? `s (${this.info.length})` : ''
                }`,
                this.activeFeatureI
            )
        )
        Dropy.init($('#infoToolSelectedDropdown'), function (idx) {
            let e = JSON.parse(JSON.stringify(InfoTool.initialEvent))
            Kinds.use(
                L_.layersNamed[InfoTool.currentLayerName].kind,
                Map_,
                InfoTool.info[idx],
                InfoTool.currentLayer,
                InfoTool.currentLayerName,
                null,
                e,
                { idx: idx },
                InfoTool.info
            )
        })

        InfoTool.createInfo()

        // Add button/icon/filter events

        // Copy to Clipboard
        $('#infoToolDownload').on('click', function () {
            F_.copyToClipboard(
                JSON.stringify(InfoTool.info[InfoTool.activeFeatureI], null, 2)
            )
            const icon = $(this).find('i')
            icon.removeClass('mdi-clipboard-outline')
            icon.addClass('mdi-check-bold')
            icon.css('color', 'var(--color-green)')
            setTimeout(() => {
                icon.removeClass('mdi-check-bold')
                icon.css('color', 'inherit')
                icon.addClass('mdi-clipboard-outline')
            }, 3000)
        })

        // Locate
        $('#infoToolLocate').on('click', function () {
            if (typeof InfoTool.currentLayer.getBounds === 'function')
                Map_.map.fitBounds(InfoTool.currentLayer.getBounds())
            else Map_.map.panTo(InfoTool.currentLayer._latlng)
        })

        // Filter
        $('#infoToolFilter > input').on('input', function () {
            InfoTool.filterString = $(this).val()
            InfoTool.filterList()
        })

        // Toggle hidden
        $('#infoToolShowHidden').on('click', function () {
            InfoTool.hiddenShown = !InfoTool.hiddenShown
            $(this).find('i').toggleClass('mdi-eye-off')
            $(this).find('i').toggleClass('mdi-eye')
            InfoTool.createInfo()
        })
    },
    createInfo: function () {
        $('#infoToolData').empty()
        // Fill out Info
        const depthMultiplier = 10

        let lastWasAHeader = false
        if (
            this.info[this.activeFeatureI].geometry.type.toLowerCase() ===
            'point'
        )
            depthTraversal(
                {
                    Coordinates: {
                        Longitude:
                            this.info[this.activeFeatureI].geometry
                                .coordinates[0],
                        Latitude:
                            this.info[this.activeFeatureI].geometry
                                .coordinates[1],
                        Elevation:
                            this.info[this.activeFeatureI].geometry
                                .coordinates[2] || 'unk',
                    },
                },
                [],
                0
            )

        let props = JSON.parse(
            JSON.stringify(this.info[this.activeFeatureI].properties)
        )
        if (!InfoTool.hiddenShown) {
            InfoTool.hiddenRootFields.forEach((element) => {
                delete props[element]
            })
        }
        const geometryType =
            this.info[this.activeFeatureI].geometry.type.toLowerCase()
        if (geometryType === 'linestring' || geometryType === 'multilinestring')
            props.Metrics = {
                Length: F_.getFeatureLength(
                    this.info[this.activeFeatureI],
                    true
                ),
            }
        else if (geometryType === 'polygon')
            props.Metrics = {
                Perimeter: F_.getFeatureLength(
                    this.info[this.activeFeatureI],
                    true
                ),
                Area: F_.getFeatureArea(this.info[this.activeFeatureI], true),
            }

        depthTraversal(
            props,
            0,
            [],
            this.vars.sortAlphabetically === false ? false : true
        )

        function depthTraversal(node, depth, path, sort) {
            path = path || []

            const keys = Object.keys(node)
            if (sort) keys.sort()

            let type = 'infoTool_property'
            if (InfoTool.hiddenRootFields.indexOf(path[0]) != -1)
                type = 'infoTool_hidden'
            else if (path[0] == 'Coordinates') type = 'infoTool_geometry'
            else if (path[0] == 'Metrics') type = 'infoTool_metrics'

            for (var i = 0; i < keys.length; i++) {
                if (path.length == 0) {
                    if (InfoTool.hiddenRootFields.indexOf(keys[i]) != -1)
                        type = 'infoTool_hidden'
                    else if (keys[i] == 'Coordinates')
                        type = 'infoTool_geometry'
                    else if (keys[i] == 'Metrics') type = 'infoTool_metrics'
                    else type = 'infoTool_property'
                }

                if (
                    typeof node[keys[i]] === 'object' &&
                    node[keys[i]] !== null
                ) {
                    // prettier-ignore
                    $('#infoToolData').append(
                        [
                            `<li class="${type}" style="margin-left: ${depth * depthMultiplier}px;" depth=${depth}>`,
                                '<div>',
                                    `${keys[i]}`,
                                '</div>',
                                '<div>',
                                '</div>',
                            '</li>'
                        ].join('\n'))
                    if (
                        !Array.isArray(node[keys[i]]) ||
                        node[keys[i]].length > 0
                    )
                        lastWasAHeader = true
                    depthTraversal(
                        node[keys[i]],
                        depth + 1,
                        path.concat([keys[i]])
                    )
                } else {
                    // prettier-ignore
                    $('#infoToolData').append(
                        [
                            `<li class="${type}"  style="margin-left: ${depth * depthMultiplier}px;" depth=${depth}>`,
                                '<div>',
                                    `${keys[i]}:`,
                                '</div>',
                                '<div>',
                                    node[keys[i]],
                                '</div>',
                            '</li>'
                        ].join('\n'))
                    lastWasAHeader = false
                }
            }
        }

        $('#infoToolData li').on('click', function () {
            $(this).toggleClass('expand')
        })

        $('#infoToolFilter > input').val(InfoTool.filterString)
        if (InfoTool.filterString.length > 0) {
            InfoTool.filterList()
        }
    },
    findFeature: function (l, featureArray) {
        if (l.feature && featureArray) {
            let f = JSON.stringify(l.feature)
            for (let i = 0; i < featureArray.length; i++) {
                if (JSON.stringify(featureArray[i]) == f) {
                    return i
                }
            }
        }
        return -1
    },
    filterList: function () {
        const filterString = InfoTool.filterString.toLowerCase()
        $('#infoToolData > li').each(function (idx) {
            let show = false
            $(this)
                .find('div')
                .each(function (idx2) {
                    if (
                        $(this).text().toLowerCase().indexOf(filterString) != -1
                    )
                        show = true
                })
            if (filterString == null || filterString.length == 0) show = true
            $(this).css('display', show ? 'flex' : 'none')

            const currentDepth = parseInt($(this).attr('depth'))
            // Show all parents too even if they don't match
            if (show && currentDepth != 0) {
                let hit0 = false
                $(this)
                    .prevAll()
                    .each(function (idx3) {
                        if (
                            parseInt($(this).attr('depth')) < currentDepth &&
                            !hit0
                        )
                            $(this).css('display', 'flex')
                        if (!hit0 && $(this).attr('depth') == 0) hit0 = true
                    })
            }
        })
    },
    clearInfo: function () {
        this.currentLayer = null
        this.currentLayerName = null
        this.info = null
        this.variables = null
        this.activeFeatureI = null

        // Clear the InfoTools data
        $('#infoToolData').empty()
        $('#infoToolHeader > .right').css('display', 'none')
        $('#infoToolSelected').css('display', 'none')
        $('#infoToolFilter').css('display', 'none')
        $('#infoToolNoneSelected').css('display', 'block')
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    InfoTool.vars = L_.getToolVars('info')

    //Add event functions and whatnot
    InfoTool.use(
        null,
        null,
        InfoTool.info,
        InfoTool.variables,
        null,
        true,
        null
    )

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default InfoTool
