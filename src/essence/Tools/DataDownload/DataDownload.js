//New Tool Template
import $ from 'jquery'
import * as d3 from 'd3'
import * as moment from 'moment'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Help from '../../Ancillary/Help'
import TimeControl from '../../Ancillary/TimeControl'
import Dropy from '../../../external/Dropy/dropy'
import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'

import './DataDownload.css'

const helpKey = 'DataDownloadTool'

const drawStyle = {
    color: '#ff7800',
    dashArray: [3, 3],
    fillOpacity: 0.05,
    weight: 1,
}

//Add the tool markup if you want to do it this way
// prettier-ignore
const markup = [
    `<div id='dataDownloadTool'>`,
        "<div id='dataDownloadToolHeader'>",
            "<div class='left'>",
                '<div id="dataDownloadToolTitle">Data Download</div>',
                Help.getComponent(helpKey),
            "</div>",
            "<div class='right'>",
            "</div>",
        "</div>",
        "<div id='dataDownloadToolControls'>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-layers mdi-18px input-icon"></i>',
                "<div id='dataDownloadToolSelectedDropdown' class='ui dropdown short'></div>",
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-select-marker mdi-18px input-icon"></i>',
                "<input id='downloadAreaInput' type='text' placeholder='Selection area [-180,-90,180,90]' class='left-icon right-icon' />",
                '<i id="drawAreaBtn" class="mdi mdi-pencil-outline mdi-18px input-icon-right"></i>',
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-calendar-arrow-right mdi-18px input-icon"></i>',
                "<input id='downloadDateRange' type='text' placeholder='Date Range' />",
            "</div>",
            "<div id='dataDownload_footer'>",
                "<div id='dataDownload_submit' class='mmgisButton5'>",
                    "<div id='dataDownload_submit_loading'>",
                        "<div></div>",
                    "</div>",
                    "<div id='dataDownload_submit_text'>Submit</div>",
                    "<i class='mdi mdi-arrow-right mdi-18px'></i>",
                "</div>",
            "</div>",
        "</div>",
        "<div id='dataDownloadToolContent'>",
        "</div>",
    `</div>`
].join('\n');

const DataDownload = {
    height: 0,
    width: 315,
    MMGISInterface: null,
    downloadEnabledLayers: [],
    selectedLayerIdx: 0,
    currBounds: null,
    currDrawing: null,
    dateRangeTempus: null,
    areaSelectionLayer: null,
    use: function () {
        //Add event functions and whatnot
        Help.finalize(helpKey)

        // filter out only those layers that can be downloaded
        // this.downloadEnabledLayers = L_.configData.layers.filter(
        //     (l) =>
        //         l.type === 'query' ||
        //         (l.type === 'tile' && l?.variables?.downloadURL)
        // )
        DataDownload.downloadEnabledLayers = L_.configData.layers

        // init layer selection
        const lnames = DataDownload.downloadEnabledLayers.map(
            (l) => l.display_name
        )
        $('#dataDownloadToolSelectedDropdown').html(
            Dropy.construct(lnames, 'Dataset', DataDownload.selectedLayerIdx)
        )
        Dropy.init($('#dataDownloadToolSelectedDropdown'), (idx) => {
            DataDownload.setSelectedIdx(idx)
        })

        // init change listener
        DataDownload.setSelectedArea(Map_.map.getBounds())
        $('#downloadAreaInput').on('change', () => {
            const subText = $('#downloadAreaInput').val()
            if (subText) {
                const bbox = subText.split(',').map((vStr, i) => {
                    const val = parseFloat(vStr)
                    // restrict values to [-180,-90,180,90]
                    if (i % 2 > 0) {
                        return Math.max(-90, Math.min(90, val))
                    }
                    return Math.max(-180, Math.min(180, val))
                })

                if (bbox.length === 4) {
                    const [minX, minY, maxX, maxY] = bbox
                    const bounds = L.latLngBounds([
                        [minY, minX],
                        [maxY, maxX],
                    ])

                    DataDownload.setSelectedArea(bounds)
                } else {
                    DataDownload.clearSelectedArea()
                }
            } else {
                DataDownload.clearSelectedArea()
            }
        })

        // init the area drawing
        $('#drawAreaBtn').on('click', () => {
            DataDownload.drawAreaStart()
        })

        // init date selectors
        const dateOptions = {
            dateRange: true,
            display: {
                viewMode: 'months',
                components: {
                    decades: true,
                    year: true,
                    month: true,
                    date: true,
                    hours: true,
                    minutes: false,
                    seconds: false,
                },
                buttons: {
                    today: false,
                    clear: false,
                    close: true,
                },
                theme: 'dark',
                icons: {
                    type: 'icons',
                    time: 'mdi mdi-clock-outline mdi-18px',
                    date: 'mdi mdi-calendar-outline mdi-18px',
                    up: 'mdi mdi-chevron-up mdi-18px',
                    down: 'mdi mdi-chevron-down mdi-18px',
                    previous: 'mdi mdi-chevron-left mdi-18px',
                    next: 'mdi mdi-chevron-right mdi-18px',
                    today: 'mdi mdi-calendar-today mdi-18px',
                    clear: 'mdi mdi-delete mdi-18px',
                    close: 'mdi mdi-check-bold mdi-18px',
                },
            },
            useCurrent: false,
            //promptTimeOnDateChange: true,
            promptTimeOnDateChangeTransitionDelay: 200,
        }

        DataDownload.dateRangeTempus = new TempusDominus(
            document.getElementById('downloadDateRange'),
            dateOptions
        )
        DataDownload.dateRangeTempus.dates.formatInput = function (date) {
            return moment(date).format('MM/DD/yyyy, hh:mm A')
        }
        const tempusDates = DataDownload.dateRangeTempus.dates
        tempusDates.setValue(tempusDates.parseInput(new Date(TimeControl.startTime)), 0)
        tempusDates.setValue(tempusDates.parseInput(new Date(TimeControl.endTime)), 1)

        DataDownload.dateRangeTempus.subscribe(Namespace.events.change, (e) => {
            DataDownload.enableDownload()
        })
        TimeControl.timeUI.startTempus.subscribe(Namespace.events.change, (e) => {
            tempusDates.setValue(tempusDates.parseInput(new Date(TimeControl.startTime)), 0)
        });
        TimeControl.timeUI.endTempus.subscribe(Namespace.events.change, (e) => {
            tempusDates.setValue(tempusDates.parseInput(new Date(TimeControl.endTime)), 1)
        });

        $('#dataDownload_submit').on('click', () => {
            const layer =
                DataDownload.downloadEnabledLayers[
                    DataDownload.selectedLayerIdx
                ]
            const renderedLayer = L_.layers.layer[layer.name]
            const dates = DataDownload.dateRangeTempus.dates.getFirst()
            if (renderedLayer) {
                // TODO start here and figure out how to get the download links
                console.log(layer, renderedLayer)
                const filteredItems = []
                renderedLayer.eachLayer((rl) => {
                    if (rl.getBounds().intersects(DataDownload.currBounds)) {
                        if (layer.time.enabled) {
                            const startProp = layer.time.startProp
                            const rlTime = new Date(
                                rl.feature.properties[startProp]
                            )
                            if (rlTime > dates[0] && rlTime < dates[1]) {
                                filteredItems.push(rl)
                            }
                        }
                    }
                })
                console.log(filteredItems)
            } else {
                console.warn('Could not find layer on map')
            }
        })

        DataDownload.enableDownload()
    },
    drawAreaStart: function () {
        DataDownload.drawAreaEnd()

        DataDownload.currDrawing = new L.Draw.Rectangle(Map_.map)
        DataDownload.currDrawing.setOptions({ shapeOptions: { ...drawStyle } })
        DataDownload.currDrawing.style = drawStyle
        DataDownload.currDrawing.enable()

        Map_.map.on('draw:created', DataDownload.drawAreaStop)
    },
    drawAreaEnd: function () {
        Map_.map.off('draw:created', DataDownload.drawAreaStop)
        if (typeof DataDownload.currDrawing?.disable === 'function') {
            DataDownload.currDrawing.disable()
        }
        DataDownload.currDrawing = null
    },
    drawAreaStop: function (ctx) {
        const bounds = ctx.layer._bounds
        DataDownload.setSelectedArea(bounds)

        DataDownload.drawAreaEnd()

        DataDownload.enableDownload()
    },
    setSelectedArea: function (bounds) {
        const minX = _round(bounds.getSouthWest().lng)
        const minY = _round(bounds.getSouthWest().lat)
        const maxX = _round(bounds.getNorthEast().lng)
        const maxY = _round(bounds.getNorthEast().lat)
        const bbox_str = `${minX}, ${minY}, ${maxX}, ${maxY}`

        $('#downloadAreaInput').val(bbox_str)

        if (DataDownload.areaSelectionLayer) {
            Map_.map.removeLayer(DataDownload.areaSelectionLayer)
        }
        DataDownload.areaSelectionLayer = null

        const layer = L.rectangle(bounds, { ...drawStyle, interactive: false })
        Map_.map.addLayer(layer)
        DataDownload.areaSelectionLayer = layer
        DataDownload.currBounds = bounds
    },
    clearSelectedArea: function () {
        if (DataDownload.areaSelectionLayer) {
            Map_.map.removeLayer(DataDownload.areaSelectionLayer)
        }
        DataDownload.areaSelectionLayer = null
        DataDownload.currBounds = null

        $('#downloadAreaInput').val('')

        DataDownload.enableDownload()
    },
    setSelectedIdx: function (idx) {
        DataDownload.selectedLayerIdx = idx
    },
    enableDownload: function () {
        if (
            DataDownload.downloadEnabledLayers[DataDownload.selectedLayerIdx] &&
            DataDownload.areaSelectionLayer &&
            DataDownload.dateRangeTempus.dates.getFirst().length === 2
        ) {
            $('#dataDownload_submit').addClass('ready')
        } else {
            $('#dataDownload_submit').removeClass('ready')
        }
    },
    cleanup: function () {
        if (DataDownload.areaSelectionLayer) {
            Map_.map.removeLayer(DataDownload.areaSelectionLayer)
        }
        DataDownload.areaSelectionLayer = null
        DataDownload.selectedLayerIdx = 0
        DataDownload.dateRangeTempus.dispose()
    },
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.cleanup()
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
}

function _round(num, prec = 4) {
    return Number(Math.round(num + 'e' + prec) + 'e-' + prec)
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    //MMGIS should always have a div with id 'toolPanel'
    let tools = d3.select('#toolPanel')
    tools.style('background', 'var(--color-k)')
    //Clear it
    tools.selectAll('*').remove()

    tools = tools.append('div').style('height', '100%')

    //Add the markup to tools or do it manually
    tools.html(markup)

    // Run the tool
    DataDownload.use()

    // Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default DataDownload
