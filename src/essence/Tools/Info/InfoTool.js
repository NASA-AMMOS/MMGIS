import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import { Kinds } from '../../../pre/tools'
import Dropy from '../../../external/Dropy/dropy'

import Datasets from '../../Ancillary/Datasets'
import Help from '../../Ancillary/Help'
import ConfirmationModal from '../../Ancillary/ConfirmationModal'

import tippy from 'tippy.js'

import './InfoTool.css'

const helpKey = 'InfoTool'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div id='infoTool'>",
        "<div id='infoToolHeader'>",
            "<div class='left'>",
                "<div id='infoToolTitle'>Info</div>",
                Help.getComponent(helpKey),
                "<div id='infoToolEquiv' title='Number of overlapping features'></div>",
            "</div>",
            "<div class='right'>",
                "<div id='infoToolUnhideAll' title='Reshow All Hidden Features'>",
                    "<i class='mdi mdi-eye-check mdi-18px'></i>",
                "</div>",
                "<div id='infoToolHide' title='Hide/Show Feature'>",
                    "<i class='mdi mdi-eye mdi-18px'></i>",
                "</div>",
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
            "<div id='infoToolShowHidden' title='Toggle Hidden Properties'>",
                "<i class='mdi mdi-book-outline mdi-18px'></i>",
            "</div>",
        "</div>",
        "<div id='infoToolSelectedDataset'>",
            "<div id='infoToolSelectedDatasetDropdown'></div>",
        "</div>",
        "<div id='infoToolContent'>",
            "<ul id='infoToolData'></ul>",
            "<div id='infoToolNoneSelected'>No feature selected</div>",
        "</div>",
    "</div>"
].join('\n');

var InfoTool = {
    height: 0,
    width: 300,
    currentLayer: null,
    currentLayerName: null,
    info: null,
    variables: null,
    activeFeatureI: null,
    activeDatasetI: null,
    featureLayers: [],
    filterString: '',
    hiddenShown: false,
    featureHidden: false,
    hiddenRootFields: ['_', 'style', 'images', 'coord_properties'],
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
        additional,
        featureLayers
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
            if (this.currentLayer.options == null) {
                this.currentLayer.options = {}
            }
            if (this.currentLayer.options.layerName == null) {
                this.currentLayer.options.layerName = this.currentLayerName
            }
            this.info = features
            this.variables = variables
            let activeIndex = activeI
            if (activeI == null) {
                let foundI = this.findFeature(currentLayer, features)
                activeIndex = foundI != -1 ? foundI : 0
            }
            this.activeFeatureI = activeIndex
            this.activeDatasetI = 0
            this.initialEvent = initialEvent

            // Always highlight even if redundant

            // Maintain feature visibility state
            // Has to be on to click anyway
            InfoTool.featureHidden = false
            $('#infoToolHide > i').removeClass('mdi-eye-off')
            $('#infoToolHide > i').addClass('mdi-eye-on')
        }
        this.featureLayers = featureLayers || []

        if (open != true) return
        // MMGIS should always have a div with id 'tools'
        let tools = d3.select('#toolPanel')
        tools.style('background', 'var(--color-k)')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools.append('div').style('height', '100%')
        //Add the markup to tools or do it manually
        tools.html(markup)

        tippy('#infoToolSelected', {
            content: 'Select An Overlapping Feature',
            placement: 'right',
            theme: 'blue',
        })
        tippy('#infoToolSelectedDataset', {
            content: 'Select An Associated Dataset',
            placement: 'right',
            theme: 'blue',
        })

        Help.finalize(helpKey)

        $('#infoToolUnhideAll').css(
            'display',
            L_.toggledOffFeatures.length > 0 ? 'block' : 'none'
        )

        if (this.info == null || this.info.length == 0) {
            $('#infoToolHeader > .right').css('display', 'none')
            $('#infoToolSelected').css('display', 'none')
            $('#infoToolSelectedDataset').css('display', 'none')
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
            $('#infoToolEquiv').text(
                `${this.activeFeatureI + 1} of ${this.info.length}`
            )
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
            let key = this.variables
                ? this.variables.useKeyAsName || 'name'
                : 'name'

            if (
                !(
                    typeof this.info[i].properties[key] === 'string' ||
                    typeof this.info[i].properties[key] === 'number'
                )
            ) {
                const propKeys = Object.keys(this.info[i].properties)
                for (let j = 0; j < propKeys.length; j++) {
                    if (
                        typeof this.info[i].properties[propKeys[j]] ===
                            'string' ||
                        typeof this.info[i].properties[propKeys[j]] === 'number'
                    ) {
                        key = propKeys[j]
                        break
                    }
                }
            }
            const name =
                this.info[i].properties[key] != null
                    ? this.info[i].properties[key]
                    : 'Unk'

            nameItems.push(this.info.length > 1 ? `${i + 1}. ${name}` : name)
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
            Datasets.populateFromDataset(
                InfoTool.featureLayers[idx] || InfoTool.currentLayer,
                () => {
                    Kinds.use(
                        L_.layers.data[InfoTool.currentLayerName]?.kind || null,
                        Map_,
                        InfoTool.info[idx],
                        InfoTool.featureLayers[idx] || InfoTool.currentLayer,
                        InfoTool.currentLayerName,
                        null,
                        e,
                        { idx: idx },
                        InfoTool.info,
                        InfoTool.featureLayers[idx]
                            ? InfoTool.featureLayers
                            : null
                    )
                }
            )
        })

        InfoTool.createInfo()

        // Add button/icon/filter events

        // Copy to Clipboard
        $('#infoToolDownload').on('click', function () {
            const feature = L_.convertGeoJSONLngLatsToPrimaryCoordinates(
                InfoTool.info[InfoTool.activeFeatureI]
            )
            F_.copyToClipboard(JSON.stringify(feature, null, 2))

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
            try {
                if (typeof InfoTool.currentLayer.getBounds === 'function')
                    Map_.map.fitBounds(InfoTool.currentLayer.getBounds())
                else Map_.map.panTo(InfoTool.currentLayer._latlng)
            } catch (err) {}
        })

        // Unhide all hidden Features
        $('#infoToolUnhideAll').on('click', function () {
            ConfirmationModal.prompt(
                `You have hidden ${L_.toggledOffFeatures.length} feature(s).<br>Do you want to reveal them all?`,
                (proceed) => {
                    if (proceed) {
                        L_.unhideAllFeatures()
                        InfoTool.featureHidden = false
                        $('#infoToolHide > i').removeClass('mdi-eye-off')
                        $('#infoToolHide > i').addClass('mdi-eye')
                        if (L_.toggledOffFeatures)
                            $('#infoToolUnhideAll').css(
                                'display',
                                L_.toggledOffFeatures.length > 0
                                    ? 'block'
                                    : 'none'
                            )
                    }
                }
            )
        })

        // Hide/Show Feature
        $('#infoToolHide').on('click', function () {
            InfoTool.featureHidden = !InfoTool.featureHidden
            $(this).find('i').toggleClass('mdi-eye-off')
            $(this).find('i').toggleClass('mdi-eye')
            L_.toggleFeature(InfoTool.currentLayer, !InfoTool.featureHidden)
            if (L_.toggledOffFeatures)
                $('#infoToolUnhideAll').css(
                    'display',
                    L_.toggledOffFeatures.length > 0 ? 'block' : 'none'
                )
        })

        // Filter
        $('#infoToolFilter > input').on('input', function () {
            InfoTool.filterString = $(this).val()
            InfoTool.filterList()
        })

        // Toggle hidden
        $('#infoToolShowHidden').on('click', function () {
            InfoTool.hiddenShown = !InfoTool.hiddenShown
            $(this).find('i').toggleClass('mdi-book-outline')
            $(this).find('i').toggleClass('mdi-book-open-variant')
            InfoTool.createInfo()
        })
    },
    createInfo: function () {
        $('#infoToolData').empty()
        // Fill out Info
        const depthMultiplier = 10

        let lastWasAHeader = false

        const geometryType = this.info[this.activeFeatureI].geometry.type
            ? this.info[this.activeFeatureI].geometry.type.toLowerCase()
            : null
        if (geometryType === 'point') {
            const names = L_.Coordinates.states[L_.Coordinates.mainType].names

            // Convert coords to main coordinate type; if already lnglat, don't reconvert
            const coords =
                L_.Coordinates.mainType === 'll'
                    ? this.info[this.activeFeatureI].geometry.coordinates
                    : L_.Coordinates.convertLngLat(
                          this.info[this.activeFeatureI].geometry
                              .coordinates[0],
                          this.info[this.activeFeatureI].geometry
                              .coordinates[1],
                          null,
                          true
                      )

            depthTraversal(
                {
                    Coordinates: {
                        [names[0]]: coords[0],
                        [names[1]]: coords[1],
                        Elevation:
                            this.info[this.activeFeatureI].geometry
                                .coordinates[2] || 'unk',
                    },
                },
                [],
                0
            )
        }

        let props = JSON.parse(
            JSON.stringify(this.info[this.activeFeatureI].properties)
        )
        if (!InfoTool.hiddenShown) {
            InfoTool.hiddenRootFields.forEach((element) => {
                delete props[element]
            })
        }
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

        InfoTool.hasDataset = props._dataset != null
        if (InfoTool.hasDataset) {
            $('#infoToolSelectedDatasetDropdown').css('display', 'inherit')
            const datasetNames = []
            props._dataset.results.forEach((d) => {
                let name = F_.getIn(d, props._dataset.prop.split('.'))
                if (name != null)
                    datasetNames.push(
                        `${props._dataset.prop.split('.').slice(-1)}: ${name}`
                    )
            })
            $('#infoToolSelectedDatasetDropdown').html(
                Dropy.construct(
                    datasetNames,
                    `Dataset`,
                    InfoTool.activeDatasetI
                )
            )
            Dropy.init($('#infoToolSelectedDatasetDropdown'), function (idx) {
                InfoTool.activeDatasetI = idx
                InfoTool.createInfo()
            })

            props.Dataset = props._dataset.results[InfoTool.activeDatasetI]
        } else {
            $('#infoToolSelectedDatasetDropdown').css('display', 'none')
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
            else if (path[0] == '_dataset') return

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
                                    F_.isValidUrl(node[keys[i]]) ?
                                        `<a href="${node[keys[i]]}" target="_blank">${node[keys[i]]}</a><i class='mdi mdi-open-in-new mdi-14px' style='margin-left: 2px;'></i>`
                                        : node[keys[i]],
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
        $('#infoToolSelectedDataset').css('display', 'none')
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
        null,
        null,
        InfoTool.featureLayers
    )

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default InfoTool
