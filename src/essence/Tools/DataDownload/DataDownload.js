//New Tool Template
import $ from 'jquery'
import * as d3 from 'd3'
import * as moment from 'moment'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Filtering from '../../Basics/Layers_/Filtering/Filtering'
import Help from '../../Ancillary/Help'
import TimeControl from '../../Ancillary/TimeControl'
import Dropy from '../../../external/Dropy/dropy'
import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'

import './DataDownload.css'

const helpKey = 'DataDownloadTool'

const drawStyle = {
    color: '#ff7800',
    dashArray: [3, 3],
    fillOpacity: 0.1,
    weight: 2,
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
                "<span class='downloadToolMidHeader'>Dataset Selection</span>",
            "</div>",
            '<div id="downloadToolLayerList" class="downloadToolControlRow expansive"></div>',
            '<div class="downloadToolControlRow">',
                "<span class='downloadToolMidHeader'>Subset Parameters</span>",
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-select-marker mdi-18px input-icon"></i>',
                "<input id='downloadAreaInput' type='text' placeholder='Selection area [-180,-90,180,90]' class='left-icon right-icon' />",
                '<i id="drawAreaBtn" class="mdi mdi-pencil-outline mdi-18px input-icon-right"></i>',
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-calendar-arrow-right mdi-18px input-icon"></i>',
                "<input id='downloadDateRangeStart' type='text' placeholder='Date Range' />",
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-calendar-arrow-left mdi-18px input-icon"></i>',
                "<input id='downloadDateRangeEnd' type='text' placeholder='Date Range' />",
            "</div>",
            '<div class="downloadToolControlRow">',
                '<i class="mdi mdi-file-document mdi-18px input-icon"></i>',
                "<input id='filenameMatch' type='text' placeholder='Filename filter ex: *.hdf' />",
            "</div>",
            "<div id='dataDownload_footer'>",
                "<div id='dataDownload_submit' class='mmgisButton5'>",
                    "<div id='dataDownload_submit_loading'>",
                        "<div></div>",
                    "</div>",
                    "<div id='dataDownload_submit_text'>Submit Subset Request</div>",
                    "<i class='mdi mdi-arrow-right mdi-18px'></i>",
                "</div>",
            "</div>",
        "</div>",
        "<div id='dataDownloadToolContent'>",
        "</div>",
    `</div>`
].join('\n');

// TODO - why is the styling so weird?!

const DataDownload = {
    height: 0,
    width: 315,
    MMGISInterface: null,
    downloadEnabledLayers: [],
    selectedLayers: {},
    selectedLayerIdx: 0,
    currBounds: null,
    currDrawing: null,
    dateRangeTempus: null,
    areaSelectionLayer: null,
    use: function () {
        //Add event functions and whatnot
        Help.finalize(helpKey)

        // TODO - filter out only those layers that can be downloaded
        // this.downloadEnabledLayers = L_.configData.layers.filter(
        //     (l) =>
        //         l.type === 'query' ||
        //         (l.type === 'tile' && l?.variables?.downloadURL)
        // )
        const getActive = (layerList) => {
            return layerList.reduce((acc, l) => {
                if (l.type === 'header') {
                    return acc.concat(getActive(l.sublayers))
                } else if (L_.layers.on[l.name]) {
                    acc.push(l)
                }
                return acc
            }, [])
        }
        DataDownload.downloadEnabledLayers = getActive(L_.configData.layers)

        // init layer selection
        const dataSelects = DataDownload.downloadEnabledLayers
            .map((l) => {
                let nodeArr = [
                    '<div on="true" depth="0"  style="margin-bottom: 1px;">',
                    `<div class="title dataDownloadLayerSelect" layer="${l.name}">`,
                    '<div class="checkboxcont">',
                    `<div class="checkbox ${
                        DataDownload.selectedLayers[l.name] ? 'on' : 'off'
                    }"></div>`,
                    '</div>',
                    `<div class="layerName" title="${l.display_name}">`,
                    l.display_name,
                    '</div>',
                ]

                const shouldFilter = ['vector', 'query'].includes(l.type)
                if (shouldFilter) {
                    nodeArr = nodeArr.concat([
                        "<div class='hover-right'>",
                        `<div title="Filter" class="gears dataDownloadLayerFilterBtn" stype="${l.type}" layer="${l.name}">`,
                        '<i class="mdi mdi-filter mdi-18px" name="layerfilter"></i>',
                        '</div>',
                        '</div>',
                        '</div>',
                        `<div id='dataDownloadLayerFilter__${F_.getSafeName(
                            l.name
                        )}' class='dataDownloadLayerFilter'></div>`,
                        '</div>',
                    ])
                } else {
                    nodeArr = nodeArr.concat(['</div>', '</div>'])
                }

                return nodeArr.join('\n')
            })
            .join('\n')
        $('#downloadToolLayerList').html(dataSelects)

        $('.dataDownloadLayerSelect').on('click', (e) => {
            const t = e.delegateTarget
            const lname = t.getAttribute('layer')
            DataDownload.selectedLayers[lname] =
                !!!DataDownload.selectedLayers[lname]
            const cb = $(t).find('.checkbox')
            if (DataDownload.selectedLayers[lname]) {
                cb.addClass('on')
                cb.removeClass('off')
            } else {
                cb.addClass('off')
                cb.removeClass('on')
            }
        })

        $('.dataDownloadLayerFilterBtn').on('click', async (e) => {
            e.stopPropagation() // prevent the filter from deselecting the layer
            const t = e.delegateTarget
            const lname = t.getAttribute('layer')
            const layer = DataDownload.downloadEnabledLayers.find(
                (l) => l.name === lname
            )
            if (layer) {
                const filterContainer = $(
                    `#dataDownloadLayerFilter__${F_.getSafeName(lname)}`
                )
                const wasOn = filterContainer.hasClass('gears_on')
                filterContainer.removeClass('gears_on')
                Filtering.destroy()
                if (!wasOn) {
                    filterContainer.addClass('gears_on')
                    if (!L_.layers.on[lname]) {
                        await L_.toggleLayer(layer)
                    }
                    Filtering.make(filterContainer, lname)
                }
            } else {
                console.warn(`Could not resolve layer: ${lname}`)
            }
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
            promptTimeOnDateChangeTransitionDelay: 200,
        }

        DataDownload.dateRangeTempusStart = new TempusDominus(
            document.getElementById('downloadDateRangeStart'),
            dateOptions
        )
        DataDownload.dateRangeTempusEnd = new TempusDominus(
            document.getElementById('downloadDateRangeEnd'),
            dateOptions
        )
        DataDownload.dateRangeTempusStart.dates.formatInput = function (date) {
            return moment(date).format('MM/DD/yyyy, hh:mm A')
        }
        DataDownload.dateRangeTempusEnd.dates.formatInput = function (date) {
            return moment(date).format('MM/DD/yyyy, hh:mm A')
        }
        DataDownload.dateRangeTempusStart.dates.setValue(
            DataDownload.dateRangeTempusStart.dates.parseInput(
                TimeControl.timeUI.addOffset(TimeControl.startTime)
            )
        )
        DataDownload.dateRangeTempusEnd.dates.setValue(
            DataDownload.dateRangeTempusEnd.dates.parseInput(
                TimeControl.timeUI.addOffset(TimeControl.endTime)
            )
        )

        const updateFromTempus = () => {
            if (DataDownload.updateToggle) {
                const cStart = moment(TimeControl.startTime)
                const cEnd = moment(TimeControl.endTime)
                const start = moment(
                    DataDownload.dateRangeTempusStart.dates.getFirst()[0]
                )
                const end = moment(
                    DataDownload.dateRangeTempusEnd.dates.getFirst()[0]
                )

                if (!cStart.isSame(start) || !cEnd.isSame(end)) {
                    TimeControl.setTime(
                        `${start.format('YYYY-MM-DDThh:mm')}Z`,
                        `${end.format('YYYY-MM-DDThh:mm')}Z`
                    )
                }
            }
            DataDownload.updateToggle = true
        }

        DataDownload.dateRangeTempusStart.subscribe(
            Namespace.events.change,
            (e) => {
                updateFromTempus()
                DataDownload.enableDownload()
            }
        )
        DataDownload.dateRangeTempusEnd.subscribe(
            Namespace.events.change,
            (e) => {
                updateFromTempus()
                DataDownload.enableDownload()
            }
        )

        TimeControl.subscribe('dataDownloadInputSub', (times) => {
            const { startTime, endTime } = times
            const cStart = moment(TimeControl.timeUI.addOffset(startTime))
            const cEnd = moment(TimeControl.timeUI.addOffset(endTime))
            const start = moment(
                DataDownload.dateRangeTempusStart.dates.getFirst()[0]
            )
            const end = moment(
                DataDownload.dateRangeTempusEnd.dates.getFirst()[0]
            )

            if (!cStart.isSame(start)) {
                DataDownload.updateToggle = false
                DataDownload.dateRangeTempusStart.dates.setValue(
                    DataDownload.dateRangeTempusStart.dates.parseInput(
                        cStart.toDate()
                    )
                )
            }

            if (!cEnd.isSame(end)) {
                DataDownload.updateToggle = false
                DataDownload.dateRangeTempusEnd.dates.setValue(
                    DataDownload.dateRangeTempusEnd.dates.parseInput(
                        cEnd.toDate()
                    )
                )
            }
        })

        // Listen for submitting a download query
        $('#dataDownload_submit').on('click', () => {
            // get date params
            const start = `${moment(
                DataDownload.dateRangeTempusStart.dates.getFirst()[0]
            ).format('YYYY-MM-DDThh:mm')}Z`
            const end = `${moment(
                DataDownload.dateRangeTempusEnd.dates.getFirst()[0]
            ).format('YYYY-MM-DDThh:mm')}Z`

            // get bbox params
            const min_lon = DataDownload.currBounds.getWest()
            const min_lat = DataDownload.currBounds.getSouth()
            const max_lon = DataDownload.currBounds.getEast()
            const max_lat = DataDownload.currBounds.getNorth()

            // get layer selection
            const mapLayers = []
            const dataLayers = []
            for (let lname in DataDownload.selectedLayers) {
                if (DataDownload.selectedLayers[lname]) {
                    mapLayers.push(L_.layers.layer[lname])
                    dataLayers.push(L_.layers.data[lname])
                }
            }

            // get filename filter
            let filenameFilter = document.getElementById('filenameMatch').value

            console.log('layers', dataLayers)

            // extract download links from selected layers
            const filteredFeatures = {}
            let directDownloads = []
            const formattedDownloads = []
            dataLayers.forEach((dl, i) => {
                // these layers may be pre-filtered, need to check features against bbox
                if (['vector', 'query'].includes(dl.type)) {
                    const ml = mapLayers[i]
                    filteredFeatures[dl.name] = []
                    ml.eachLayer((lfeat) => {
                        if (
                            lfeat
                                .getBounds()
                                .intersects(DataDownload.currBounds)
                        ) {
                            filteredFeatures[dl.name].push(lfeat.feature)
                            directDownloads = directDownloads.concat(
                                F_.getFeatureDownloadLinks(
                                    lfeat.feature,
                                    dl
                                ).reduce((acc, l) => {
                                    if (filenameFilter !== '') {
                                        // hacky fake glob match
                                        if (filenameFilter.startsWith('*')) {
                                            filenameFilter = `.${filenameFilter}`
                                        }
                                        const reg = new RegExp(
                                            filenameFilter,
                                            'ig'
                                        )
                                        if (reg.test(l.link)) {
                                            acc.push(l.link)
                                        }
                                    } else {
                                        acc.push(l.link)
                                    }
                                    return acc
                                }, [])
                            )
                        }
                    })
                } else if (dl.variables?.tools?.dataDownload?.urls) {
                    // use the configured URL template to format a download query
                    // TODO - fallback to URL template specified in the tool (not layer) config
                    dl.variables.tools.dataDownload.urls.forEach((turl) => {
                        const url = turl.url_template
                            .replace('{min_datetime}', start)
                            .replace('{max_datetime}', end)
                            .replace('{min_lon}', min_lon)
                            .replace('{max_lon}', max_lon)
                            .replace('{min_lat}', min_lat)
                            .replace('{max_lat}', max_lat)
                        formattedDownloads.push(url)
                    })
                }
            })

            console.log('filteredFeatures', filteredFeatures)
            console.log('formattedDownloads', formattedDownloads)
            console.log('directDownloads', directDownloads)

            // TODO - download files, fetch data and save it to a file, print out a cURL command, or something

            // Create a blob of the data
            // var fileToSave = new Blob([strung], {
            //     type: `application/${downloadType || 'json'}`,
            //     name: fileName,
            // })
            // // Save the file //from FileSaver
            // saveAs(fileToSave, fileName)
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
    enableDownload: function () {
        // TODO - check that at least one dataset is selected
        if (DataDownload.areaSelectionLayer) {
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
        DataDownload.dateRangeTempusStart.dispose()
        DataDownload.dateRangeTempusEnd.dispose()
    },
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.cleanup()
        this.MMGISInterface.separateFromMMGIS()
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
