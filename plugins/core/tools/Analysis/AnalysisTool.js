import $ from 'jquery'
import * as d3 from 'd3'
import * as echarts from 'echarts'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

import Help from '@basics/UserInterface_/components/Help/Help'
import TimeControl from '@basics/TimeControl_/TimeControl'

import './AnalysisTool.css'

const helpKey = 'AnalysisTool'
const NODATA = 0

//Add the tool markup
// prettier-ignore
var markup = [
    "<div id='analysisTool'>",
        "<div id='analysisToolHeader' class='mmgisToolHeader'>",
            "<div id='filterAnalysis'>",
                "<div class='left'>",
                    '<div class="mmgisToolTitle">Analysis</div>',
                    Help.getComponent(helpKey),
                "</div>",
                "<div class='right'>",
                "</div>",
            "</div>",
        "</div>",
        "<div id='analysisToolContent'>",
            "<div id='analysisTopSections'>",
                "<div id='analysisTimeSection'>",
                "<div class='analysisSection'>",
                    "<div class='analysisTimeHeader'>",
                        "<div class='analysisSectionTitle'>Time Range</div>",
                        "<div class='analysisToggleOption' id='analysisDualTimeRangeCheckbox'>",
                            "<div class='checkboxcont'>",
                                "<div class='checkbox'></div>",
                            "</div>",
                            "<span>Compare Two Time Ranges</span>",
                        "</div>",
                    "</div>",
                    "<div id='analysisTimeInputsWrapper'>",
                        "<div class='analysisTimeInputs'>",
                            "<div class='analysisTimeRangeLabel' id='analysisTimeRange1Label'>Time Range 1</div>",
                            "<div class='analysisTimeInput'>",
                                "<div class='analysisClockIcon'><i class='mdi mdi-clock-outline mdi-14px'></i></div>",
                                "<label>Start:</label>",
                                "<div class='analysisTimeInputField'>",
                                    "<input id='analysisStartTime' type='text' placeholder='Start time' value=''>",
                                "</div>",
                            "</div>",
                            "<div class='analysisTimeInput'>",
                                "<div class='analysisClockIcon'><i class='mdi mdi-clock-outline mdi-14px'></i></div>",
                                "<label>End:</label>",
                                "<div class='analysisTimeInputField'>",
                                    "<input id='analysisEndTime' type='text' placeholder='End time' value=''>",
                                "</div>",
                            "</div>",
                        "</div>",
                        "<div class='analysisTimeInputs' id='analysisTimeRange2Inputs' style='display:none;'>",
                            "<div class='analysisTimeRangeLabel'>Time Range 2</div>",
                            "<div class='analysisTimeInput'>",
                                "<div class='analysisClockIcon'><i class='mdi mdi-clock-outline mdi-14px'></i></div>",
                                "<label>Start:</label>",
                                "<div class='analysisTimeInputField'>",
                                    "<input id='analysisStartTime2' type='text' placeholder='Start time' value=''>",
                                "</div>",
                            "</div>",
                            "<div class='analysisTimeInput'>",
                                "<div class='analysisClockIcon'><i class='mdi mdi-clock-outline mdi-14px'></i></div>",
                                "<label>End:</label>",
                                "<div class='analysisTimeInputField'>",
                                    "<input id='analysisEndTime2' type='text' placeholder='End time' value=''>",
                                "</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
            "</div>",
            "<div id='analysisGraphSection'>",
                "<div class='analysisSection'>",
                    "<div class='analysisSectionTitle'>Analysis</div>",
                    "<div id='analysisControls'>",
                        "<div class='analysisChartType'>",
                            "<label>Chart Type:</label>",
                            "<select id='analysisChartTypeSelect'>",
                                "<option value='timeseries' selected>Time Series</option>",
                                "<option value='histogram'>Histogram</option>",
                                "<option value='scatterplot'>Scatterplot</option>",
                            "</select>",
                        "</div>",
                        "<div class='analysisDataSelect'>",
                            "<label>Data Selection:</label>",
                            "<select id='analysisDataModeSelect'>",
                                "<option value='point'>Point</option>",
                                "<option value='vectorpoints'>Vector Points</option>",
                                "<option value='line'>Line</option>",
                                "<option value='bbox'>Box</option>",
                            "</select>",
                        "</div>",
                        "<div id='analysisDataSection'>",
                            "<div class='analysisDataModes'>",
                                "<div class='analysisDataRight'>",
                                    "<div id='analysisPointInputs' class='analysisInputGroup active'>",
                                        "<div class='analysisPointMessage'>",
                                            "<i class='mdi mdi-crosshairs-gps mdi-18px'></i>",
                                            "<span>Click on map to select a point</span>",
                                        "</div>",
                                        "<div class='analysisCoordInput'>",
                                            "<label>Lat:</label>",
                                            "<input id='analysisLat' type='number' step='any' placeholder='Latitude'>",
                                        "</div>",
                                        "<div class='analysisCoordInput'>",
                                            "<label>Lng:</label>",
                                            "<input id='analysisLng' type='number' step='any' placeholder='Longitude'>",
                                        "</div>",
                                    "</div>",
                                    "<div id='analysisBboxInputs' class='analysisInputGroup'>",
                                        "<div class='analysisBboxMessage'>",
                                            "<i class='mdi mdi-vector-square mdi-18px'></i>",
                                            "<span>Click and drag on map to draw bounding box</span>",
                                        "</div>",
                                        "<div class='analysisCoordInput analysisClearBbox'>",
                                            "<button id='analysisClearBboxBtn' class='analysisClearBtn' title='Clear Bounding Box'>",
                                                "<i class='mdi mdi-close'></i>",
                                            "</button>",
                                        "</div>",
                                    "</div>",
                                    "<div id='analysisLineInputs' class='analysisInputGroup'>",
                                        "<div class='analysisLineMessage'>",
                                            "<i class='mdi mdi-vector-line mdi-18px'></i>",
                                            "<span>Click twice on map to draw a line</span>",
                                        "</div>",
                                        "<input id='analysisLineStartLat' type='hidden'>",
                                        "<input id='analysisLineStartLng' type='hidden'>",
                                        "<input id='analysisLineEndLat' type='hidden'>",
                                        "<input id='analysisLineEndLng' type='hidden'>",
                                        "<div class='analysisCoordInput analysisClearLine'>",
                                            "<button id='analysisClearLineBtn' class='analysisClearBtn' title='Clear Line'>",
                                                "<i class='mdi mdi-close'></i>",
                                            "</button>",
                                        "</div>",
                                    "</div>",
                                    "<div id='analysisVectorPointsInputs' class='analysisInputGroup'>",
                                        "<div class='analysisVectorPointsMessage'>",
                                            "<i class='mdi mdi-vector-point mdi-18px'></i>",
                                            "<span>Click and drag on map to select vector points</span>",
                                        "</div>",
                                        "<div class='analysisVectorPointsInfo'>",
                                            "<span id='analysisVectorPointsCount'>0 points selected</span>",
                                        "</div>",
                                        "<div class='analysisCoordInput analysisClearBbox'>",
                                            "<button id='analysisClearVectorPointsBtn' class='analysisClearBtn' title='Clear Vector Points Selection'>",
                                                "<i class='mdi mdi-close'></i>",
                                            "</button>",
                                        "</div>",
                                    "</div>",
                                "</div>",
                            "</div>",
                            "<div id='analysisDrawingIndicator' class='analysisDrawingIndicator'>",
                                "<i class='mdi mdi-crosshairs-gps'></i>",
                                "<span>Click and drag to draw bounding box</span>",
                            "</div>",
                            "<div id='analysisLineDrawingIndicator' class='analysisDrawingIndicator'>",
                                "<i class='mdi mdi-vector-polyline'></i>",
                                "<span>Click two points on the map to draw a line segment</span>",
                            "</div>",
                            "<div id='analysisVectorPointsDrawingIndicator' class='analysisDrawingIndicator'>",
                                "<i class='mdi mdi-vector-square'></i>",
                                "<span>Click and drag to select vector points within bounding box</span>",
                            "</div>",
                        "</div>",
                        "<div class='analysisLayerSelect'>",
                            "<label>Layer:</label>",
                            "<div class='analysisLayerContainer'>",
                                "<select id='analysisLayerSelect'>",
                                    "<option value=''>Loading layers...</option>",
                                "</select>",
                                "<div id='analysisLayerTimeRange' class='analysisLayerSubtext'>No layer selected</div>",
                            "</div>",
                        "</div>",
                        "<div id='analysisLayerYContainer' class='analysisLayerSelect' style='display:none;'>",
                            "<label>Y-Axis Layer:</label>",
                            "<div class='analysisLayerContainer'>",
                                "<select id='analysisLayerSelectY'>",
                                    "<option value=''>Select Y-axis layer...</option>",
                                "</select>",
                            "</div>",
                        "</div>",
                        "<div class='analysisPropertySelect' style='display:none;'>",
                            "<label>Y-axis Property:</label>",
                            "<select id='analysisPropertySelect'>",
                                "<option value=''>Select a property...</option>",
                            "</select>",
                        "</div>",
                        "<div id='analysisBinsControl' class='analysisBinsControl' style='display:none;'>",
                            "<label>Bins:</label>",
                            "<input id='analysisBins' type='number' min='5' max='200' step='5' value='50' title='Number of histogram bins'>",
                        "</div>",
                        "<div id='analysisLineSubdivisionsControl' class='analysisBinsControl' style='display:none;'>",
                            "<label>Subdivisions:</label>",
                            "<input id='analysisLineSubdivisions' type='number' min='10' max='200' step='10' value='50' title='Number of points to sample along the line'>",
                        "</div>",
                        "</div>",
                        "<div id='analysisGenerateInline'>",
                            "<button id='analysisGenerateBtn' class='analysisBtn'>",
                                "<i class='mdi mdi-chart-line'></i>",
                                "<span>Generate Analysis</span>",
                            "</button>",
                        "</div>",
                    "</div>",
                    "<div id='analysisChartContainer'>",
                        "<div id='analysisChart'></div>",
                        "<div id='analysisPlaceholder' class='active'>",
                            "<div class='analysisPlaceholderText'>",
                                "<i class='mdi mdi-chart-line mdi-48px'></i>",
                                "<h3>Ready for Analysis</h3>",
                                "<p>Configure time range and data source above, then click Generate Analysis.</p>",
                            "</div>",
                        "</div>",
                        "<div id='analysisLoading'>",
                            "<div class='analysisLoadingSpinner'></div>",
                            "<p>Loading Analysis Data...</p>",
                        "</div>",
                        "<div id='analysisError'>",
                            "<div class='analysisErrorIcon'>",
                                "<i class='mdi mdi-alert-circle mdi-48px'></i>",
                            "</div>",
                            "<p id='analysisErrorMessage' style='font-size: 16px; line-height: 1.5; margin: 20px 0;'>An error occurred while generating the analysis.</p>",
                            "<button id='analysisRetryBtn' class='analysisBtn analysisBtn-secondary'>Retry</button>",
                        "</div>",
                        "<div id='analysisStatsPanel' class='analysisStatsPanel'></div>",
                    "</div>",
                "</div>",
            "</div>",
        "</div>",
    "</div>",
].join('\n')

let AnalysisTool = {
    height: 0,
    width: 650,
    vars: {},
    MMGISInterface: null,
    currentMode: 'point',
    mapClickHandler: null,
    activeFeatureWatcher: null,
    chartInstance: null,
    resizeHandler: null,
    resizeObserver: null,
    //apiBaseUrl: `${window.location.origin}${(window.location.pathname || '').replace(/\/$/g, '')}/frozon_api`,
    apiBaseUrl: '', // Set in initialize() from tool configuration
    // Layer management
    availableLayers: {},
    selectedLayer: null,
    selectedLayerY: null,
    defaultLayer: null,
    pointMarker: null,
    // Dual time range state
    dualTimeRangeEnabled: false,
    // Bbox drawing state
    isDrawingBbox: false,
    bboxDrawing: {
        isDown: false,
        startLatLng: null,
        tempRectangle: null,
        drawingHandlers: {},
        screenRect: null, // { x, y, width, height } in container pixels
        projectedBounds: null, // { xmin, ymin, xmax, ymax } in easting/northing
    },
    // Line drawing state
    isDrawingLine: false,
    lineDrawing: {
        points: [],
        polyline: null,
        markers: [],
    },
    // Vector points selection state
    vectorPointsDrawing: {
        isDown: false,
        startLatLng: null,
        tempRectangle: null,
        drawingHandlers: {},
        screenRect: null, // { x, y, width, height } in container pixels
        selectedPoints: [], // Array of {id, lat, lon, properties, layerId} objects
        markers: [], // Visual markers for selected points
    },
    initialize: function () {
        //Get tool variables
        const toolVars = L_.getToolVars('analysis') || {}
        this.vars = {
            apiBaseUrl: toolVars.apiBaseUrl || ''
        }

        // Update the apiBaseUrl with configured value
        this.apiBaseUrl = this.vars.apiBaseUrl

        // Validate that URL is configured
        if (!this.apiBaseUrl) {
            console.warn('Analysis Tool: API Base URL not configured. Please configure it in the mission settings.')
        }
    },
    finalize: function () {
        // Any finalization logic can go here
    },
    make: function (t, fromInit) {
        this.MMGISInterface = new interfaceWithMMGIS(fromInit)
    },
    destroy: function () {
        // Clean up all map handlers and drawing state
        this.cleanupMapHandlers()
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
    setHeader: function () {},
    timeChange: function () {
        // Called when TimeControl changes - update our time inputs
        $('#analysisStartTime').val(TimeControl.getStartTime())
        $('#analysisEndTime').val(TimeControl.getEndTime())
    },
    setMode: function (mode) {
        this.currentMode = mode

        // Update dropdown value
        $('#analysisDataModeSelect').val(mode)

        // Update input group visibility
        $('.analysisInputGroup').removeClass('active')
        if (mode === 'point') {
            $('#analysisPointInputs').addClass('active')
        } else if (mode === 'bbox') {
            $('#analysisBboxInputs').addClass('active')
        } else if (mode === 'line') {
            $('#analysisLineInputs').addClass('active')
        } else if (mode === 'vectorpoints') {
            $('#analysisVectorPointsInputs').addClass('active')
        }

        // Update drawing indicator visibility
        $('#analysisDrawingIndicator').toggle(mode === 'bbox')
        $('#analysisLineDrawingIndicator').toggle(mode === 'line')
        $('#analysisVectorPointsDrawingIndicator').toggle(
            mode === 'vectorpoints'
        )

        // Show/hide subdivisions control for line mode with scatterplot chart type
        const chartType = $('#analysisChartTypeSelect').val()
        if (mode === 'line' && chartType === 'scatterplot') {
            $('#analysisLineSubdivisionsControl').show()
        } else {
            $('#analysisLineSubdivisionsControl').hide()
        }

        // Handle map interactions based on mode
        this.setupMapInteraction(mode)
    },
    setupMapInteraction: function (mode) {
        // Clean up previous handlers
        this.cleanupMapHandlers()

        if (mode === 'point') {
            this.mapClickHandler = function (e) {
                $('#analysisLng').val(e.latlng.lng.toFixed(6))
                $('#analysisLat').val(e.latlng.lat.toFixed(6))

                // Remove previous point marker if it exists
                if (this.pointMarker) {
                    Map_.map.removeLayer(this.pointMarker)
                }

                // Add new orange point marker
                this.pointMarker = L.circleMarker(
                    [e.latlng.lat, e.latlng.lng],
                    {
                        color: '#000000',
                        fillColor: '#ff0000',
                        fillOpacity: 1,
                        radius: 6,
                        weight: 2,
                        opacity: 1,
                    }
                ).addTo(Map_.map)

                // Update button state
                AnalysisTool.updateGenerateButtonState()
            }.bind(this)
            Map_.map.on('click', this.mapClickHandler)
        } else if (mode === 'bbox') {
            this.setupBboxDrawing()
        } else if (mode === 'line') {
            this.setupLineDrawing()
        } else if (mode === 'vectorpoints') {
            this.setupVectorPointsBboxDrawing()
        }
    },

    cleanupMapHandlers: function () {
        // Clean up point click handler
        if (this.mapClickHandler) {
            Map_.map.off('click', this.mapClickHandler)
            this.mapClickHandler = null
        }

        // Clean up point marker
        if (this.pointMarker) {
            Map_.map.removeLayer(this.pointMarker)
            this.pointMarker = null
        }

        // Clean up bbox drawing handlers
        this.cleanupBboxDrawing()

        // Clean up line drawing handlers
        this.cleanupLineDrawing()

        // Clean up vector points drawing handlers
        this.cleanupVectorPointsDrawing()
    },

    setupBboxDrawing: function () {
        const map = Map_.map
        const mapContainer = map.getContainer()

        // Disable map interactions that would interfere with drawing
        map.dragging.disable()
        map.doubleClickZoom.disable()
        if (map.boxZoom) map.boxZoom.disable()
        if (map.keyboard) map.keyboard.disable()

        // Set up bbox drawing handlers using DOM events for better control
        this.bboxDrawing.drawingHandlers = {
            mousedown: this.onBboxMouseDown.bind(this),
            mousemove: this.onBboxMouseMove.bind(this),
            mouseup: this.onBboxMouseUp.bind(this),
            mouseleave: this.onBboxMouseUp.bind(this), // Treat mouse leave as mouse up
        }

        // Add DOM event listeners to map container
        mapContainer.addEventListener(
            'mousedown',
            this.bboxDrawing.drawingHandlers.mousedown
        )
        mapContainer.addEventListener(
            'mousemove',
            this.bboxDrawing.drawingHandlers.mousemove
        )
        mapContainer.addEventListener(
            'mouseup',
            this.bboxDrawing.drawingHandlers.mouseup
        )
        mapContainer.addEventListener(
            'mouseleave',
            this.bboxDrawing.drawingHandlers.mouseleave
        )

        // Change cursor to crosshair to indicate drawing mode
        mapContainer.style.cursor = 'crosshair'

        // Show drawing indicator and visual feedback
        $('#analysisDrawingIndicator').addClass('active')
        $('.analysisRadioOption[data-mode="bbox"]').addClass('drawing')

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    cleanupBboxDrawing: function () {
        const map = Map_.map
        const mapContainer = map.getContainer()

        // Remove DOM event handlers
        if (this.bboxDrawing.drawingHandlers) {
            mapContainer.removeEventListener(
                'mousedown',
                this.bboxDrawing.drawingHandlers.mousedown
            )
            mapContainer.removeEventListener(
                'mousemove',
                this.bboxDrawing.drawingHandlers.mousemove
            )
            mapContainer.removeEventListener(
                'mouseup',
                this.bboxDrawing.drawingHandlers.mouseup
            )
            mapContainer.removeEventListener(
                'mouseleave',
                this.bboxDrawing.drawingHandlers.mouseleave
            )
            this.bboxDrawing.drawingHandlers = {}
        }

        // Re-enable map interactions
        map.dragging.enable()
        map.doubleClickZoom.enable()
        if (map.boxZoom) map.boxZoom.enable()
        if (map.keyboard) map.keyboard.enable()

        // Remove temporary rectangle if it exists
        if (this.bboxDrawing.tempRectangle) {
            map.removeLayer(this.bboxDrawing.tempRectangle)
            this.bboxDrawing.tempRectangle = null
        }

        // Reset drawing state
        this.bboxDrawing.isDown = false
        this.bboxDrawing.startLatLng = null
        this.isDrawingBbox = false

        // Reset cursor
        mapContainer.style.cursor = ''

        // Hide drawing indicator and remove visual feedback
        $('#analysisDrawingIndicator').removeClass('active')
        $('.analysisRadioOption[data-mode="bbox"]').removeClass('drawing')

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    // Line drawing setup
    setupLineDrawing: function () {
        this.isDrawingLine = true
        this.lineDrawing.points = []
        this.clearLineFromMap()

        // Set up map click handler to add points to line
        this.mapClickHandler = function (e) {
            // If we already have 2 points, clear and start fresh
            if (this.lineDrawing.points.length >= 2) {
                this.clearLineFromMap()
                this.lineDrawing.points = []
            }

            const latlng = [e.latlng.lat, e.latlng.lng]
            this.lineDrawing.points.push(latlng)

            // Add marker for this point
            const marker = L.circleMarker(latlng, {
                color: '#000000',
                fillColor: '#ff0000',
                fillOpacity: 1,
                radius: 6,
                weight: 2,
            }).addTo(Map_.map)
            this.lineDrawing.markers.push(marker)

            // Auto-finish after 2 points
            if (this.lineDrawing.points.length === 2) {
                // Create polyline
                this.lineDrawing.polyline = L.polyline(
                    this.lineDrawing.points,
                    {
                        color: '#ff0000',
                        weight: 4,
                        opacity: 1,
                    }
                ).addTo(Map_.map)

                // Populate input fields with line coordinates
                $('#analysisLineStartLat').val(this.lineDrawing.points[0][0])
                $('#analysisLineStartLng').val(this.lineDrawing.points[0][1])
                $('#analysisLineEndLat').val(this.lineDrawing.points[1][0])
                $('#analysisLineEndLng').val(this.lineDrawing.points[1][1])

                // Update button state
                this.updateGenerateButtonState()

                // Line is complete - next click will start a new line
                // Keep the click handler active so user can immediately draw another line
            }
        }.bind(this)

        Map_.map.on('click', this.mapClickHandler)
    },

    finishLine: function () {
        if (this.lineDrawing.points.length < 2) {
            return
        }

        // Disable drawing
        this.isDrawingLine = false
        if (this.mapClickHandler) {
            Map_.map.off('click', this.mapClickHandler)
            this.mapClickHandler = null
        }

        // Hide the drawing indicator
        $('#analysisLineDrawingIndicator').hide()

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    clearLine: function () {
        this.clearLineFromMap()

        // Fully reset line drawing state
        this.lineDrawing.points = []
        this.lineDrawing.polyline = null
        this.lineDrawing.markers = []

        // Re-enable drawing if in line mode
        if (this.currentMode === 'line') {
            this.setupLineDrawing()
        }
    },

    clearLineFromMap: function () {
        // Remove polyline
        if (this.lineDrawing.polyline) {
            Map_.map.removeLayer(this.lineDrawing.polyline)
            this.lineDrawing.polyline = null
        }

        // Remove all markers
        this.lineDrawing.markers.forEach((marker) => {
            Map_.map.removeLayer(marker)
        })
        this.lineDrawing.markers = []

        // Clear input fields
        $('#analysisLineStartLat').val('')
        $('#analysisLineStartLng').val('')
        $('#analysisLineEndLat').val('')
        $('#analysisLineEndLng').val('')

        // Update button state
        this.updateGenerateButtonState()
    },

    cleanupLineDrawing: function () {
        this.isDrawingLine = false
        this.clearLineFromMap()
        this.lineDrawing.points = []

        // Remove event handlers
        if (this.mapClickHandler) {
            Map_.map.off('click', this.mapClickHandler)
            this.mapClickHandler = null
        }
    },

    // Vector Points Selection Methods
    setupVectorPointsBboxDrawing: function () {
        const map = Map_.map
        const mapContainer = map.getContainer()

        // Disable map interactions that would interfere with drawing
        map.dragging.disable()
        map.doubleClickZoom.disable()
        if (map.boxZoom) map.boxZoom.disable()
        if (map.keyboard) map.keyboard.disable()

        // Set up vector points drawing handlers using DOM events
        this.vectorPointsDrawing.drawingHandlers = {
            mousedown: this.onVectorPointsMouseDown.bind(this),
            mousemove: this.onVectorPointsMouseMove.bind(this),
            mouseup: this.onVectorPointsMouseUp.bind(this),
            mouseleave: this.onVectorPointsMouseUp.bind(this),
        }

        // Add DOM event listeners to map container
        mapContainer.addEventListener(
            'mousedown',
            this.vectorPointsDrawing.drawingHandlers.mousedown
        )
        mapContainer.addEventListener(
            'mousemove',
            this.vectorPointsDrawing.drawingHandlers.mousemove
        )
        mapContainer.addEventListener(
            'mouseup',
            this.vectorPointsDrawing.drawingHandlers.mouseup
        )
        mapContainer.addEventListener(
            'mouseleave',
            this.vectorPointsDrawing.drawingHandlers.mouseleave
        )

        // Change cursor to crosshair
        mapContainer.style.cursor = 'crosshair'

        // Show drawing indicator
        $('#analysisVectorPointsDrawingIndicator').addClass('active')
        $('.analysisRadioOption[data-mode="vectorpoints"]').addClass('drawing')
    },

    onVectorPointsMouseDown: function (e) {
        if (this.currentMode !== 'vectorpoints') return

        e.preventDefault()
        e.stopPropagation()

        const map = Map_.map
        const containerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        this.vectorPointsDrawing.isDown = true
        // Store container point (screen coordinates) instead of converting to lat/lng
        this.vectorPointsDrawing.startLatLng = containerPoint // Note: variable name is misleading but keep for consistency

        // Remove any existing temporary rectangle
        if (this.vectorPointsDrawing.tempRectangle) {
            map.removeLayer(this.vectorPointsDrawing.tempRectangle)
            this.vectorPointsDrawing.tempRectangle = null
        }
    },

    onVectorPointsMouseMove: function (e) {
        if (!this.vectorPointsDrawing.isDown) return
        if (this.currentMode !== 'vectorpoints') return

        const map = Map_.map

        // Get current container point
        const currentContainerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        const startPoint = this.vectorPointsDrawing.startLatLng // Actually a container point

        // Calculate screen rectangle bounds
        const minX = Math.min(startPoint.x, currentContainerPoint.x)
        const maxX = Math.max(startPoint.x, currentContainerPoint.x)
        const minY = Math.min(startPoint.y, currentContainerPoint.y)
        const maxY = Math.max(startPoint.y, currentContainerPoint.y)

        const screenRect = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }

        // Clear previous temporary rectangle
        if (this.vectorPointsDrawing.tempRectangle) {
            map.removeLayer(this.vectorPointsDrawing.tempRectangle)
        }

        // Create screen-aligned rectangle (temporary)
        this.vectorPointsDrawing.tempRectangle =
            this.createScreenAlignedBboxPolygon(
                screenRect,
                true // isTemporary
            ).addTo(map)
    },

    onVectorPointsMouseUp: function (e) {
        if (!this.vectorPointsDrawing.isDown) return
        if (this.currentMode !== 'vectorpoints') return

        const map = Map_.map

        // Get final container point
        const endContainerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        const startPoint = this.vectorPointsDrawing.startLatLng // Actually a container point

        // Calculate final screen rectangle
        const minX = Math.min(startPoint.x, endContainerPoint.x)
        const maxX = Math.max(startPoint.x, endContainerPoint.x)
        const minY = Math.min(startPoint.y, endContainerPoint.y)
        const maxY = Math.max(startPoint.y, endContainerPoint.y)

        // Ensure minimum size
        if (Math.abs(maxX - minX) < 5 || Math.abs(maxY - minY) < 5) {
            // Too small, don't complete
            if (this.vectorPointsDrawing.tempRectangle) {
                map.removeLayer(this.vectorPointsDrawing.tempRectangle)
                this.vectorPointsDrawing.tempRectangle = null
            }
            this.vectorPointsDrawing.isDown = false
            this.vectorPointsDrawing.startLatLng = null
            map.getContainer().style.cursor = this.originalCursor || ''
            return
        }

        const screenRect = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }

        // Store screen rectangle for future use
        this.vectorPointsDrawing.screenRect = screenRect

        // Convert screen corners to lat/lng for point selection
        const topLeft = map.containerPointToLatLng({ x: minX, y: minY })
        const bottomRight = map.containerPointToLatLng({ x: maxX, y: maxY })

        const minLat = Math.min(topLeft.lat, bottomRight.lat)
        const maxLat = Math.max(topLeft.lat, bottomRight.lat)
        const minLng = Math.min(topLeft.lng, bottomRight.lng)
        const maxLng = Math.max(topLeft.lng, bottomRight.lng)

        // Update input fields (keep these for now)
        $('#analysisVPMinLat').val(minLat.toFixed(6))
        $('#analysisVPMinLng').val(minLng.toFixed(6))
        $('#analysisVPMaxLat').val(maxLat.toFixed(6))
        $('#analysisVPMaxLng').val(maxLng.toFixed(6))

        // Clear temporary rectangle
        if (this.vectorPointsDrawing.tempRectangle) {
            map.removeLayer(this.vectorPointsDrawing.tempRectangle)
            this.vectorPointsDrawing.tempRectangle = null
        }

        // Create final screen-aligned rectangle
        this.vectorPointsDrawing.tempRectangle =
            this.createScreenAlignedBboxPolygon(
                screenRect,
                false // not temporary
            ).addTo(map)

        // Perform vector point selection
        this.selectVectorPointsInBbox(minLat, minLng, maxLat, maxLng)

        // Clean up
        this.vectorPointsDrawing.isDown = false
        this.vectorPointsDrawing.startLatLng = null
        map.getContainer().style.cursor = this.originalCursor || ''

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    cleanupVectorPointsDrawing: function () {
        const map = Map_.map
        const mapContainer = map.getContainer()

        // Remove DOM event handlers
        if (this.vectorPointsDrawing.drawingHandlers) {
            mapContainer.removeEventListener(
                'mousedown',
                this.vectorPointsDrawing.drawingHandlers.mousedown
            )
            mapContainer.removeEventListener(
                'mousemove',
                this.vectorPointsDrawing.drawingHandlers.mousemove
            )
            mapContainer.removeEventListener(
                'mouseup',
                this.vectorPointsDrawing.drawingHandlers.mouseup
            )
            mapContainer.removeEventListener(
                'mouseleave',
                this.vectorPointsDrawing.drawingHandlers.mouseleave
            )
            this.vectorPointsDrawing.drawingHandlers = {}
        }

        // Re-enable map interactions
        map.dragging.enable()
        map.doubleClickZoom.enable()
        if (map.boxZoom) map.boxZoom.enable()
        if (map.keyboard) map.keyboard.enable()

        // Remove temporary rectangle
        if (this.vectorPointsDrawing.tempRectangle) {
            map.removeLayer(this.vectorPointsDrawing.tempRectangle)
            this.vectorPointsDrawing.tempRectangle = null
        }

        // Remove markers
        this.clearVectorPointMarkers()

        // Reset drawing state
        this.vectorPointsDrawing.isDown = false
        this.vectorPointsDrawing.startLatLng = null
        this.vectorPointsDrawing.selectedPoints = []

        // Reset cursor
        mapContainer.style.cursor = ''

        // Hide drawing indicator
        $('#analysisVectorPointsDrawingIndicator').removeClass('active')
        $('.analysisRadioOption[data-mode="vectorpoints"]').removeClass(
            'drawing'
        )
    },

    clearVectorPointMarkers: function () {
        // Remove all markers from the map
        this.vectorPointsDrawing.markers.forEach((marker) => {
            Map_.map.removeLayer(marker)
        })
        this.vectorPointsDrawing.markers = []
    },

    clearVectorPointsSelection: function () {
        // Clear markers
        this.clearVectorPointMarkers()

        // Remove rectangle
        if (this.vectorPointsDrawing.tempRectangle) {
            Map_.map.removeLayer(this.vectorPointsDrawing.tempRectangle)
            this.vectorPointsDrawing.tempRectangle = null
        }

        // Clear screen rectangle
        this.vectorPointsDrawing.screenRect = null

        // Clear selected points
        this.vectorPointsDrawing.selectedPoints = []

        // Clear input fields
        $('#analysisVPMinLat').val('')
        $('#analysisVPMinLng').val('')
        $('#analysisVPMaxLat').val('')
        $('#analysisVPMaxLng').val('')

        // Update count display
        $('#analysisVectorPointsCount').text('0 points selected')

        // Re-enable drawing if in vector points mode
        if (this.currentMode === 'vectorpoints') {
            this.setupVectorPointsBboxDrawing()
        }

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    selectVectorPointsInBbox: function (minLat, minLng, maxLat, maxLng) {
        // Clear previous selection
        this.vectorPointsDrawing.selectedPoints = []
        this.clearVectorPointMarkers()

        let totalPointsFound = 0

        // Iterate through all visible vector layers
        if (L_.layers && L_.layers.layer) {
            Object.keys(L_.layers.layer).forEach((layerName) => {
                // Check if layer is visible (opacity > 0)
                const opacity = L_.layers.opacity[layerName]
                if (opacity === undefined || opacity <= 0) {
                    return // Skip invisible layers
                }

                const layer = L_.layers.layer[layerName]
                if (!layer) return

                // Check if layer has eachLayer method (vector layer)
                if (typeof layer.eachLayer === 'function') {
                    layer.eachLayer((feature) => {
                        // Check if this is a point feature
                        let latlng = null

                        // Try to get latlng for point features
                        if (typeof feature.getLatLng === 'function') {
                            latlng = feature.getLatLng()
                        } else if (
                            feature.feature &&
                            feature.feature.geometry &&
                            feature.feature.geometry.type === 'Point'
                        ) {
                            // Handle GeoJSON point features
                            const coords = feature.feature.geometry.coordinates
                            latlng = L.latLng(coords[1], coords[0]) // GeoJSON is [lng, lat]
                        }

                        // If we have a valid point, check if it's within bbox
                        if (latlng) {
                            const lat = latlng.lat
                            const lng = latlng.lng

                            if (
                                lat >= minLat &&
                                lat <= maxLat &&
                                lng >= minLng &&
                                lng <= maxLng
                            ) {
                                // Point is within bounding box
                                const id = `${lat.toFixed(6)}_${lng.toFixed(6)}`
                                this.vectorPointsDrawing.selectedPoints.push({
                                    id: id,
                                    lat: lat,
                                    lon: lng,
                                    properties:
                                        feature.feature?.properties || {}, // Capture GeoJSON properties
                                    layerId: layer.options?.id || layerName, // Capture layer ID
                                })

                                // Add visual marker for selected point
                                const marker = L.circleMarker([lat, lng], {
                                    color: '#ff0000',
                                    fillColor: '#ff0000',
                                    fillOpacity: 0.6,
                                    radius: 3,
                                    weight: 1,
                                    opacity: 1,
                                }).addTo(Map_.map)

                                this.vectorPointsDrawing.markers.push(marker)
                                totalPointsFound++
                            }
                        }
                    })
                }

                // Handle vector tiles (different structure)
                if (layer._vectorTiles) {
                    for (const tileKey in layer._vectorTiles) {
                        const tile = layer._vectorTiles[tileKey]
                        if (tile._layers) {
                            for (const layerKey in tile._layers) {
                                const tileLayer = tile._layers[layerKey]
                                let latlng = null

                                if (typeof tileLayer.getLatLng === 'function') {
                                    latlng = tileLayer.getLatLng()
                                } else if (
                                    tileLayer.feature &&
                                    tileLayer.feature.geometry &&
                                    tileLayer.feature.geometry.type === 'Point'
                                ) {
                                    const coords =
                                        tileLayer.feature.geometry.coordinates
                                    latlng = L.latLng(coords[1], coords[0])
                                }

                                if (latlng) {
                                    const lat = latlng.lat
                                    const lng = latlng.lng

                                    if (
                                        lat >= minLat &&
                                        lat <= maxLat &&
                                        lng >= minLng &&
                                        lng <= maxLng
                                    ) {
                                        const id = `${lat.toFixed(
                                            6
                                        )}_${lng.toFixed(6)}`
                                        // Check if not already added
                                        const exists =
                                            this.vectorPointsDrawing.selectedPoints.some(
                                                (p) => p.id === id
                                            )
                                        if (!exists) {
                                            this.vectorPointsDrawing.selectedPoints.push(
                                                {
                                                    id: id,
                                                    lat: lat,
                                                    lon: lng,
                                                    properties:
                                                        tileLayer.feature
                                                            ?.properties || {}, // Capture vector tile properties
                                                    layerId:
                                                        layer.id || layerName, // Capture layer ID
                                                }
                                            )

                                            const marker = L.circleMarker(
                                                [lat, lng],
                                                {
                                                    color: '#ff0000',
                                                    fillColor: '#ff0000',
                                                    fillOpacity: 0.6,
                                                    radius: 3,
                                                    weight: 1,
                                                    opacity: 1,
                                                }
                                            ).addTo(Map_.map)

                                            this.vectorPointsDrawing.markers.push(
                                                marker
                                            )
                                            totalPointsFound++
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
        }

        // Update UI with count
        $('#analysisVectorPointsCount').text(
            `${totalPointsFound} point${
                totalPointsFound !== 1 ? 's' : ''
            } selected`
        )

        // Populate property selector if in scatterplot mode with vector points
        const chartType = $('#analysisChartTypeSelect').val()
        const dataSelection = $('#analysisDataModeSelect').val()
        if (
            chartType === 'scatterplot' &&
            dataSelection === 'vectorpoints' &&
            totalPointsFound > 0
        ) {
            this.populatePropertySelector()
        }

        // Update button state
        AnalysisTool.updateGenerateButtonState()

        return this.vectorPointsDrawing.selectedPoints
    },

    onBboxMouseDown: function (e) {
        if (this.currentMode !== 'bbox') return

        // Prevent default behavior
        e.preventDefault()
        e.stopPropagation()

        // Get container point (screen coordinates)
        const map = Map_.map
        const containerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        this.bboxDrawing.isDown = true
        this.bboxDrawing.startLatLng = containerPoint // Store screen coordinates instead of lat/lng
        this.isDrawingBbox = true

        // Remove any existing temporary rectangle
        if (this.bboxDrawing.tempRectangle) {
            map.removeLayer(this.bboxDrawing.tempRectangle)
            this.bboxDrawing.tempRectangle = null
        }
    },

    onBboxMouseMove: function (e) {
        if (
            this.currentMode !== 'bbox' ||
            !this.bboxDrawing.isDown ||
            !this.bboxDrawing.startLatLng
        )
            return

        // Get current container point (screen coordinates)
        const map = Map_.map
        const currentContainerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        const startPoint = this.bboxDrawing.startLatLng

        // Calculate screen rectangle bounds
        const minX = Math.min(startPoint.x, currentContainerPoint.x)
        const maxX = Math.max(startPoint.x, currentContainerPoint.x)
        const minY = Math.min(startPoint.y, currentContainerPoint.y)
        const maxY = Math.max(startPoint.y, currentContainerPoint.y)

        const screenRect = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }

        // Remove previous temporary rectangle
        if (this.bboxDrawing.tempRectangle) {
            map.removeLayer(this.bboxDrawing.tempRectangle)
        }

        // Create screen-aligned rectangle for visual feedback
        this.bboxDrawing.tempRectangle = this.createScreenAlignedBboxPolygon(
            screenRect,
            true // pass true for temporary styling
        ).addTo(map)
    },

    onBboxMouseUp: function (e) {
        if (
            this.currentMode !== 'bbox' ||
            !this.bboxDrawing.isDown ||
            !this.bboxDrawing.startLatLng
        )
            return

        // Get end container point (screen coordinates)
        const map = Map_.map
        const endContainerPoint = L.point(
            e.clientX - map.getContainer().getBoundingClientRect().left,
            e.clientY - map.getContainer().getBoundingClientRect().top
        )

        const startPoint = this.bboxDrawing.startLatLng

        // Calculate final screen rectangle bounds
        const minX = Math.min(startPoint.x, endContainerPoint.x)
        const maxX = Math.max(startPoint.x, endContainerPoint.x)
        const minY = Math.min(startPoint.y, endContainerPoint.y)
        const maxY = Math.max(startPoint.y, endContainerPoint.y)

        // Only update if we have a meaningful rectangle (not just a click)
        const widthDiff = Math.abs(maxX - minX)
        const heightDiff = Math.abs(maxY - minY)

        if (widthDiff > 5 || heightDiff > 5) {
            // Minimum size threshold (5 pixels)
            // Store final screen rectangle
            const screenRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            }
            this.bboxDrawing.screenRect = screenRect

            // Convert screen corners to lat/lng
            const topLeft = map.containerPointToLatLng({ x: minX, y: minY })
            const bottomRight = map.containerPointToLatLng({
                x: maxX,
                y: maxY,
            })

            // Convert to easting/northing using proj4
            const topLeftProj = this.convertLatLngToProjected(
                topLeft.lat,
                topLeft.lng
            )
            const bottomRightProj = this.convertLatLngToProjected(
                bottomRight.lat,
                bottomRight.lng
            )

            // Store in state (not in input fields)
            this.bboxDrawing.projectedBounds = {
                xmin: Math.min(topLeftProj.x, bottomRightProj.x),
                ymin: Math.min(topLeftProj.y, bottomRightProj.y),
                xmax: Math.max(topLeftProj.x, bottomRightProj.x),
                ymax: Math.max(topLeftProj.y, bottomRightProj.y),
            }

            // Remove temporary rectangle and create final rectangle
            if (this.bboxDrawing.tempRectangle) {
                map.removeLayer(this.bboxDrawing.tempRectangle)
            }

            // Create screen-aligned rectangle for final bbox
            this.bboxDrawing.tempRectangle =
                this.createScreenAlignedBboxPolygon(screenRect).addTo(map)
        } else {
            // Just a click, remove temporary rectangle
            if (this.bboxDrawing.tempRectangle) {
                map.removeLayer(this.bboxDrawing.tempRectangle)
                this.bboxDrawing.tempRectangle = null
            }
        }

        // Reset drawing state
        this.bboxDrawing.isDown = false
        this.bboxDrawing.startLatLng = null
        this.isDrawingBbox = false

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    clearBboxRectangle: function () {
        // Remove existing rectangle if any
        if (this.bboxDrawing.tempRectangle) {
            Map_.map.removeLayer(this.bboxDrawing.tempRectangle)
            this.bboxDrawing.tempRectangle = null
        }

        // Clear state
        this.bboxDrawing.screenRect = null
        this.bboxDrawing.projectedBounds = null

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    },

    // updateBboxRectangle: Removed - no longer needed after conversion to screen-aligned rectangles

    createScreenAlignedBboxPolygon: function (screenRect, isTemporary = false) {
        const map = Map_.map
        const { x, y, width, height } = screenRect

        // Convert 4 screen corners to lat/lng
        const topLeft = map.containerPointToLatLng({ x: x, y: y })
        const topRight = map.containerPointToLatLng({ x: x + width, y: y })
        const bottomRight = map.containerPointToLatLng({
            x: x + width,
            y: y + height,
        })
        const bottomLeft = map.containerPointToLatLng({ x: x, y: y + height })

        // Create 4-sided polygon (screen-aligned rectangle)
        return L.polygon(
            [
                [topLeft.lat, topLeft.lng],
                [topRight.lat, topRight.lng],
                [bottomRight.lat, bottomRight.lng],
                [bottomLeft.lat, bottomLeft.lng],
            ],
            {
                color: '#ff6600',
                weight: 3,
                fillColor: '#ff0000',
                fillOpacity: isTemporary ? 0.1 : 0.1,
                dashArray: isTemporary ? '5, 5' : null,
            }
        )
    },

    // Chart Management Functions
    initializeChart: function () {
        if (this.chartInstance) {
            this.chartInstance.dispose()
        }

        const chartDom = document.getElementById('analysisChart')

        // Ensure the container is visible and has proper dimensions
        const container = document.getElementById('analysisChartContainer')
        if (container) {
            // Force container to be visible for proper size calculation
            container.style.display = 'block'
        }

        // Wait a moment for the container to be properly rendered
        setTimeout(() => {
            // Initialize with explicit sizing and custom theme
            this.chartInstance = echarts.init(chartDom, null, {
                width: chartDom.offsetWidth || 616,
                height: chartDom.offsetHeight || 500,
                renderer: 'canvas',
            })

            // Add resize observer for responsive behavior
            this.setupChartResize()
        }, 50)

        return this.chartInstance
    },

    setupChartResize: function () {
        // Remove existing resize handler if any
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler)
        }

        // Create new resize handler
        this.resizeHandler = () => {
            if (this.chartInstance) {
                // Use a small delay to ensure the container has finished resizing
                setTimeout(() => {
                    this.chartInstance.resize()
                }, 100)
            }
        }

        // Listen for window resize events
        window.addEventListener('resize', this.resizeHandler)

        // Also setup ResizeObserver if available for more precise container size changes
        if (window.ResizeObserver) {
            const chartDom = document.getElementById('analysisChart')
            if (chartDom && !this.resizeObserver) {
                this.resizeObserver = new ResizeObserver(() => {
                    if (this.chartInstance) {
                        this.chartInstance.resize()
                    }
                })
                this.resizeObserver.observe(chartDom.parentElement)
            }
        }
    },

    showChartState: function (state) {
        $('#analysisChartContainer > div').removeClass('active')
        $(
            `#analysis${state.charAt(0).toUpperCase() + state.slice(1)}`
        ).addClass('active')
    },

    // Layer Management Functions
    fetchLayers: async function () {
        try {
            const response = await this.makeApiCall('/layers')
            this.availableLayers = response.layers || {}
            this.defaultLayer =
                response.default_layer || Object.keys(this.availableLayers)[0]

            this.populateLayerDropdown()
            this.selectLayer(this.defaultLayer)

            return response
        } catch (error) {
            console.error('Failed to fetch layers:', error)
            $('#analysisLayerSelect').html(
                '<option value="">Error loading layers</option>'
            )
            throw error
        }
    },

    populateLayerDropdown: function () {
        const dropdown = $('#analysisLayerSelect')
        dropdown.empty()

        if (Object.keys(this.availableLayers).length === 0) {
            dropdown.append('<option value="">No layers available</option>')
            return
        }

        // Add layers to dropdown
        Object.keys(this.availableLayers).forEach((layerName) => {
            const isDefault = layerName === this.defaultLayer
            dropdown.append(
                `<option value="${layerName}" ${
                    isDefault ? 'selected' : ''
                }>${layerName}</option>`
            )
        })
    },

    filterDataSelectionOptions: function (chartType) {
        // Define compatibility matrix
        const compatibility = {
            timeseries: ['point', 'bbox'],
            histogram: ['bbox'],
            scatterplot: ['point', 'vectorpoints', 'line', 'bbox'],
        }

        const validModes = compatibility[chartType] || []

        // Show/hide dropdown options based on compatibility
        $('#analysisDataModeSelect option').each(function () {
            const mode = $(this).val()
            if (validModes.includes(mode)) {
                $(this).show()
            } else {
                $(this).hide()
            }
        })

        // If current selection is invalid, select first valid option
        const currentMode = $('#analysisDataModeSelect').val()

        if (!validModes.includes(currentMode)) {
            // Auto-select first valid mode if available
            if (validModes.length > 0) {
                const firstValidMode = validModes[0]
                this.setMode(firstValidMode)
            }
        }
    },

    populatePropertySelector: function () {
        const propertiesSet = new Set()

        // Collect all unique property keys from selected points
        this.vectorPointsDrawing.selectedPoints.forEach((point) => {
            if (point.properties) {
                Object.keys(point.properties).forEach((key) => {
                    propertiesSet.add(key)
                })
            }
        })

        // Populate dropdown
        const $select = $('#analysisPropertySelect')
        $select.empty()
        $select.append('<option value="">Select a property...</option>')

        Array.from(propertiesSet)
            .sort()
            .forEach((prop) => {
                $select.append(`<option value="${prop}">${prop}</option>`)
            })
    },

    updateGenerateButtonState: function () {
        const chartType = $('#analysisChartTypeSelect').val()
        const dataMode = $('#analysisDataModeSelect').val()
        const generateBtn = $('#analysisGenerateBtn')

        let isValid = true

        // Check if chart type and data mode are selected
        if (!chartType || !dataMode) {
            isValid = false
        }

        // Check if line coordinates are filled for line mode
        if (isValid && dataMode === 'line') {
            const startLat = $('#analysisLineStartLat').val()
            const startLng = $('#analysisLineStartLng').val()
            const endLat = $('#analysisLineEndLat').val()
            const endLng = $('#analysisLineEndLng').val()

            if (!startLat || !startLng || !endLat || !endLng) {
                isValid = false
            }
        }

        // For scatterplot mode, check additional requirements
        if (isValid && chartType === 'scatterplot') {
            // All scatterplot modes need X-axis layer
            if (!this.selectedLayer) {
                isValid = false
            }

            if (dataMode === 'vectorpoints') {
                // Vector points mode: need property selector OR second layer
                const selectedProperty = $('#analysisPropertySelect').val()
                if (!selectedProperty && !this.selectedLayerY) {
                    isValid = false
                }
            } else {
                // Other scatterplot modes need second layer
                if (!this.selectedLayerY) {
                    isValid = false
                }
            }
        }

        if (isValid && dataMode === 'point') {
            if ($('#analysisLat').val() == '' || $('#analysisLng').val() == '')
                isValid = false
        } else if (isValid && dataMode === 'vectorpoints') {
            if (
                $('#analysisVPMaxLat').val() == '' ||
                $('#analysisVPMinLng').val() == '' ||
                $('#analysisVPMaxLng').val() == '' ||
                $('#analysisVPMinLat').val() == ''
            )
                isValid = false
        } else if (isValid && dataMode === 'line') {
        } else if (isValid && dataMode === 'bbox') {
            // Check if projected bounds exist (instead of input fields)
            if (!this.bboxDrawing.projectedBounds) isValid = false
        }

        // Update button state
        if (isValid) {
            generateBtn.prop('disabled', false).removeClass('disabled')
        } else {
            generateBtn.prop('disabled', true).addClass('disabled')
        }
    },

    selectLayer: function (layerName) {
        if (!layerName || !this.availableLayers[layerName]) {
            console.warn('Invalid layer name:', layerName)
            return
        }

        this.selectedLayer = layerName
        const layerInfo = this.availableLayers[layerName]

        // Update layer info display
        this.updateLayerInfoDisplay(layerInfo)

        // Update dropdown selection
        $('#analysisLayerSelect').val(layerName)
    },

    updateLayerInfoDisplay: function (layerInfo) {
        // Update time range
        const timeRange = layerInfo.time_range
        const startDate = new Date(timeRange.start).toLocaleDateString()
        const endDate = new Date(timeRange.end).toLocaleDateString()
        $('#analysisLayerTimeRange').text(`${startDate} - ${endDate}`)

        // Update dimensions
        const dimensions = `${layerInfo.shape.join(
            ' × '
        )} (${layerInfo.dimensions.join(', ')})`
        $('#analysisLayerDimensions').text(dimensions)

        // Update EPSG
        $('#analysisLayerEPSG').text(`EPSG:${layerInfo.epsg}`)
    },

    getDetailedProjectedBounds: async function (projectedBounds, epsg) {
        // This would create a detailed boundary by sampling points along the edges
        // and converting them to lat/lng. For now, we'll create a simple approximation

        const points = []
        const numPoints = 20 // Points per side

        // This is a simplified version - ideally we'd make API calls to convert
        // individual projected points to geographic coordinates

        // For polar stereographic, approximate the curved boundary
        // In a real implementation, you'd want to:
        // 1. Sample points along each edge of the projected rectangle
        // 2. Convert each point from projected to geographic coordinates
        // 3. Return the resulting polygon

        // For now, return null to use the simple rectangle fallback
        return null
    },

    // API Service Functions
    makeApiCall: async function (
        endpoint,
        params = {},
        method = 'GET',
        body = null
    ) {
        let baseUrl = this.apiBaseUrl

        // Ensure baseUrl doesn't end with slash and endpoint starts with slash for proper joining
        baseUrl = baseUrl.replace(/\/$/, '')
        if (!endpoint.startsWith('/')) {
            endpoint = '/' + endpoint
        }

        // Construct full URL by concatenating base + endpoint
        const fullUrl = baseUrl + endpoint
        const url = new URL(fullUrl)

        // For GET requests, add parameters to URL
        if (method === 'GET') {
            Object.keys(params).forEach((key) => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key])
                }
            })
        }

        try {
            const fetchOptions = {
                method: method,
            }

            // For POST requests, merge params into body
            if (method === 'POST') {
                // Merge params into body for POST requests
                const postBody = body ? { ...body, ...params } : params

                fetchOptions.headers = {
                    'Content-Type': 'application/json',
                }
                fetchOptions.body = JSON.stringify(postBody)
            }

            const response = await fetch(url.toString(), fetchOptions)
            if (!response.ok) {
                // Try to parse error response to get detail message
                try {
                    const errorData = await response.json()
                    if (errorData.detail) {
                        // Extract user-friendly message from detail
                        let errorMsg = errorData.detail

                        // Simplify common error messages
                        if (errorMsg.includes('outside data bounds')) {
                            errorMsg =
                                'Point is outside dataset bounds. Please select a location within the data coverage area.'
                        } else if (
                            errorMsg.includes('outside dataset time coverage')
                        ) {
                            errorMsg =
                                'Selected time range is outside dataset time coverage.'
                        } else if (
                            errorMsg.includes(
                                'does not intersect with dataset or time'
                            )
                        ) {
                            errorMsg =
                                'Selected area does not intersect with dataset bounds or time range.'
                        } else if (
                            errorMsg.includes('does not intersect with dataset')
                        ) {
                            errorMsg =
                                'Selected area does not intersect with dataset bounds.'
                        }

                        throw new Error(errorMsg)
                    }
                } catch (parseError) {
                    // If JSON parsing fails, fall back to generic error
                    if (
                        parseError.message &&
                        !parseError.message.includes('Unexpected')
                    ) {
                        throw parseError // Re-throw if it's our custom error
                    }
                }
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                )
            }
            const jsonData = await response.json()

            // Check if response contains an error field
            if (jsonData.error) {
                throw new Error(jsonData.error)
            }

            return jsonData
        } catch (error) {
            console.error('API call failed:', error)
            throw error
        }
    },

    /**
     * Convert lat/lng to projected coordinates using MMGIS custom CRS.
     * Uses window.mmgisglobal.customCRS.project() for coordinate transformation.
     *
     * @param {number} lat - Latitude (EPSG:4326)
     * @param {number} lng - Longitude (EPSG:4326)
     * @returns {Object} {x: number, y: number} - Projected coordinates
     */
    convertLatLngToProjected: function (lat, lng) {
        if (!window.mmgisglobal || !window.mmgisglobal.customCRS) {
            console.warn(
                'MMGIS customCRS not available, using lat/lng directly'
            )
            return { x: lng, y: lat }
        }

        const projected = window.mmgisglobal.customCRS.project({
            lat: lat,
            lng: lng,
        })
        return {
            x: projected.x,
            y: projected.y,
        }
    },

    // Helper method to sample points in a grid within a bounding box
    samplePointsInBbox: function (
        minLat,
        minLng,
        maxLat,
        maxLng,
        totalPoints = 100
    ) {
        const points = []
        const gridSize = Math.ceil(Math.sqrt(totalPoints))
        const latStep = (maxLat - minLat) / (gridSize - 1)
        const lngStep = (maxLng - minLng) / (gridSize - 1)

        let id = 0
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const lat = minLat + i * latStep
                const lon = minLng + j * lngStep
                points.push({
                    id: `bbox_${id}`,
                    lat: lat,
                    lon: lon,
                })
                id++
            }
        }

        return points
    },

    // Helper method to transform batch API response to time series format
    transformBatchResponseToTimeSeries: function (batchResponse, datasetName) {
        // The batch response has structure: { datasets: { datasetName: [{ id, value, lat, lon, x, y }] } }
        // Extract the specified dataset by name, or first dataset if name not found
        const ids = []
        const values = []

        if (batchResponse && batchResponse.datasets) {
            let dataArray = null

            // Try to get the dataset by name first
            if (datasetName && batchResponse.datasets[datasetName]) {
                dataArray = batchResponse.datasets[datasetName]
            } else {
                // Fallback: get first dataset regardless of name
                const datasetArrays = Object.values(batchResponse.datasets)
                if (datasetArrays.length > 0) {
                    dataArray = datasetArrays[0]
                }
            }

            if (dataArray) {
                // Extract id-value pairs from the dataset array
                for (const item of dataArray) {
                    if (
                        item.id !== undefined &&
                        item.value !== null &&
                        item.value !== undefined
                    ) {
                        ids.push(item.id)
                        values.push(item.value)
                    }
                }
            }
        }

        return {
            ids: ids,
            values: values,
        }
    },

    extractPropertyValues: function (selectedPoints, propertyName) {
        const ids = []
        const values = []

        selectedPoints.forEach((point) => {
            // Skip points without the property or with null/undefined values
            if (
                point.properties &&
                point.properties[propertyName] !== null &&
                point.properties[propertyName] !== undefined
            ) {
                const value = parseFloat(point.properties[propertyName])

                // Only include if value is a valid number
                if (!isNaN(value)) {
                    ids.push(point.id)
                    values.push(value)
                }
            }
        })

        return { ids, values }
    },

    // Helper method to subdivide a line into evenly-spaced points
    subdivideLineToPoints: function (linePoints, numSubdivisions = 50) {
        if (linePoints.length < 2) {
            throw new Error('Line must have at least 2 points')
        }

        const points = []

        // Calculate cumulative distances along the line
        const segments = []
        let totalDistance = 0

        for (let i = 0; i < linePoints.length - 1; i++) {
            const p1 = linePoints[i]
            const p2 = linePoints[i + 1]

            // Validate that points have valid coordinates
            if (!p1 || p1.length < 2 || !p2 || p2.length < 2) {
                console.warn('Invalid point in line:', p1, p2)
                continue
            }

            const distance = this.haversineDistance(p1[0], p1[1], p2[0], p2[1])
            segments.push({
                start: p1,
                end: p2,
                distance: distance,
                cumulativeStart: totalDistance,
                cumulativeEnd: totalDistance + distance,
            })
            totalDistance += distance
        }

        // Check if we have valid segments
        if (segments.length === 0 || totalDistance === 0) {
            throw new Error('Line has no valid segments with non-zero distance')
        }

        // Divide total distance into equal intervals
        const interval = totalDistance / (numSubdivisions - 1)

        // Generate points at regular intervals
        for (let i = 0; i < numSubdivisions; i++) {
            const targetDistance = i * interval

            // Find which segment this point falls in
            const segment = segments.find(
                (s) =>
                    targetDistance >= s.cumulativeStart &&
                    targetDistance <= s.cumulativeEnd
            )

            if (segment) {
                // Calculate fractional position within segment
                const segmentProgress =
                    segment.distance > 0
                        ? (targetDistance - segment.cumulativeStart) /
                          segment.distance
                        : 0
                const lat =
                    segment.start[0] +
                    (segment.end[0] - segment.start[0]) * segmentProgress
                const lon =
                    segment.start[1] +
                    (segment.end[1] - segment.start[1]) * segmentProgress

                points.push({
                    id: `line_${i}`,
                    lat: lat,
                    lon: lon,
                })
            }
        }

        return points
    },

    // Haversine distance calculation (in meters)
    haversineDistance: function (lat1, lon1, lat2, lon2) {
        const R = 6371000 // Earth's radius in meters
        const toRad = (deg) => (deg * Math.PI) / 180

        const dLat = toRad(lat2 - lat1)
        const dLon = toRad(lon2 - lon1)
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c
    },

    // Analysis Functions
    generateAnalysis: async function () {
        try {
            this.showChartState('loading')

            const chartType = $('#analysisChartTypeSelect').val()
            const startTime = $('#analysisStartTime').val()
            const endTime = $('#analysisEndTime').val()

            if (!startTime || !endTime) {
                throw new Error('Please set both start and end times')
            }

            if (this.currentMode === 'point') {
                await this.generatePointAnalysis(chartType, startTime, endTime)
            } else if (this.currentMode === 'bbox') {
                await this.generateBboxAnalysis(chartType, startTime, endTime)
            } else if (this.currentMode === 'line') {
                await this.generateLineAnalysis(chartType, startTime, endTime)
            } else if (this.currentMode === 'vectorpoints') {
                await this.generateVectorPointsAnalysis(
                    chartType,
                    startTime,
                    endTime
                )
            }
        } catch (error) {
            // Clear stats panel if error occurred during histogram generation
            const chartType = $('#analysisChartTypeSelect').val()
            this.showError(error.message, chartType === 'histogram')
        }
    },

    generatePointAnalysis: async function (chartType, startTime, endTime) {
        const lat = parseFloat($('#analysisLat').val())
        const lng = parseFloat($('#analysisLng').val())

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error(
                'Please set valid latitude and longitude coordinates'
            )
        }

        // Convert to projected coordinates
        const projected = this.convertLatLngToProjected(lat, lng)

        if (chartType === 'timeseries') {
            const data = await this.makeApiCall('/timeseries/projected', {
                x: projected.x,
                y: projected.y,
                startTime: startTime,
                endTime: endTime,
                layer: this.selectedLayer,
            })
            this.createTimeSeriesChart(
                data,
                `${this.selectedLayer} Time Series at (${lat.toFixed(
                    4
                )}, ${lng.toFixed(4)})`
            )
        } else if (chartType === 'histogram') {
            // Histogram not supported in point mode
            throw new Error(
                'Histogram chart type is not supported for Point Mode.'
            )
        } else if (chartType === 'scatterplot') {
            // Validate second layer is selected
            if (!this.selectedLayerY) {
                throw new Error('Please select a second layer for Y-axis')
            }

            // Check if dual time range mode is enabled
            if (this.dualTimeRangeEnabled) {
                // Get second time range values
                const startTime2 = $('#analysisStartTime2').val()
                const endTime2 = $('#analysisEndTime2').val()

                if (!startTime2 || !endTime2) {
                    throw new Error(
                        'Please set both start and end times for Time Range 2'
                    )
                }

                // Make four parallel API calls for both time ranges
                try {
                    const [dataX1, dataY1, dataX2, dataY2] = await Promise.all([
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime,
                            endTime: endTime,
                            layer: this.selectedLayer,
                        }),
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime,
                            endTime: endTime,
                            layer: this.selectedLayerY,
                        }),
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime2,
                            endTime: endTime2,
                            layer: this.selectedLayer,
                        }),
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime2,
                            endTime: endTime2,
                            layer: this.selectedLayerY,
                        }),
                    ])

                    // Filter data by time ranges
                    const dataX1Filtered = this.filterDataByTimeRange(
                        dataX1,
                        startTime,
                        endTime
                    )
                    const dataY1Filtered = this.filterDataByTimeRange(
                        dataY1,
                        startTime,
                        endTime
                    )
                    const dataX2Filtered = this.filterDataByTimeRange(
                        dataX2,
                        startTime2,
                        endTime2
                    )
                    const dataY2Filtered = this.filterDataByTimeRange(
                        dataY2,
                        startTime2,
                        endTime2
                    )

                    // Create dual time range scatterplot
                    this.createDualTimeRangeScatterplot(
                        dataX1Filtered,
                        dataY1Filtered,
                        dataX2Filtered,
                        dataY2Filtered,
                        this.selectedLayer,
                        this.selectedLayerY,
                        `Scatterplot at (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                        null,
                        startTime,
                        endTime,
                        startTime2,
                        endTime2
                    )
                } catch (error) {
                    if (error.message.includes('404')) {
                        throw new Error(
                            'One or both layers not found. Please check layer selection.'
                        )
                    } else {
                        throw new Error(
                            `Failed to fetch data for scatterplot: ${error.message}`
                        )
                    }
                }
            } else {
                // Single time range mode - original behavior
                try {
                    const [dataX, dataY] = await Promise.all([
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime,
                            endTime: endTime,
                            layer: this.selectedLayer,
                        }),
                        this.makeApiCall('/timeseries/projected', {
                            x: projected.x,
                            y: projected.y,
                            startTime: startTime,
                            endTime: endTime,
                            layer: this.selectedLayerY,
                        }),
                    ])

                    // Create scatterplot with both datasets
                    this.createScatterplotChart(
                        dataX,
                        dataY,
                        this.selectedLayer,
                        this.selectedLayerY,
                        `Scatterplot at (${lat.toFixed(4)}, ${lng.toFixed(4)})`
                    )
                } catch (error) {
                    // Handle API errors
                    if (error.message.includes('404')) {
                        throw new Error(
                            'One or both layers not found. Please check layer selection.'
                        )
                    } else {
                        throw new Error(
                            `Failed to fetch data for scatterplot: ${error.message}`
                        )
                    }
                }
            }
        }
    },

    generateBboxAnalysis: async function (chartType, startTime, endTime) {
        // Get projected bounds from state
        if (!this.bboxDrawing.projectedBounds) {
            throw new Error('Please draw a bounding box on the map')
        }

        const { xmin, ymin, xmax, ymax } = this.bboxDrawing.projectedBounds

        // For display purposes and scatterplot sampling, we need lat/lng bounds
        // Convert the screen rectangle corners back to lat/lng
        const map = Map_.map
        const screenRect = this.bboxDrawing.screenRect

        let minLat, minLng, maxLat, maxLng
        if (screenRect) {
            // Convert screen corners to lat/lng
            const topLeft = map.containerPointToLatLng({
                x: screenRect.x,
                y: screenRect.y,
            })
            const bottomRight = map.containerPointToLatLng({
                x: screenRect.x + screenRect.width,
                y: screenRect.y + screenRect.height,
            })
            minLat = Math.min(topLeft.lat, bottomRight.lat)
            maxLat = Math.max(topLeft.lat, bottomRight.lat)
            minLng = Math.min(topLeft.lng, bottomRight.lng)
            maxLng = Math.max(topLeft.lng, bottomRight.lng)
        }

        const minProj = { x: xmin, y: ymin }
        const maxProj = { x: xmax, y: ymax }

        if (chartType === 'timeseries') {
            const data = await this.makeApiCall('/timeseries/projected', {
                xmin: minProj.x,
                ymin: minProj.y,
                xmax: maxProj.x,
                ymax: maxProj.y,
                startTime: startTime,
                endTime: endTime,
                layer: this.selectedLayer,
                stats: 'mean,min,max,std',
                area_weighted: true,
            })
            this.createSpatialTimeSeriesChart(
                data,
                `Spatial Time Series (Easting: ${xmin.toFixed(
                    0
                )}-${xmax.toFixed(0)}, Northing: ${ymin.toFixed(
                    0
                )}-${ymax.toFixed(0)})`
            )
        } else if (chartType === 'histogram') {
            const bins = parseInt($('#analysisBins').val()) || 50

            if (this.dualTimeRangeEnabled) {
                // Get second time range values
                const startTime2 = $('#analysisStartTime2').val()
                const endTime2 = $('#analysisEndTime2').val()

                if (!startTime2 || !endTime2) {
                    throw new Error(
                        'Please set both start and end times for Time Range 2'
                    )
                }

                // Make two parallel API calls using projected coordinates
                const [data1, data2] = await Promise.all([
                    this.makeApiCall('/histogram/projected', {
                        ds: this.selectedLayer || 'default',
                        startTime,
                        endTime,
                        xmin: minProj.x,
                        ymin: minProj.y,
                        xmax: maxProj.x,
                        ymax: maxProj.y,
                        bins: bins,
                    }),
                    this.makeApiCall('/histogram/projected', {
                        ds: this.selectedLayer || 'default',
                        startTime: startTime2,
                        endTime: endTime2,
                        xmin: minProj.x,
                        ymin: minProj.y,
                        xmax: maxProj.x,
                        ymax: maxProj.y,
                        bins: bins,
                    }),
                ])

                this.createDualTimeRangeHistogramChart(
                    data1,
                    data2,
                    `Histogram for Bounding Box (${minLat.toFixed(
                        2
                    )},${minLng.toFixed(2)} - ${maxLat.toFixed(
                        2
                    )},${maxLng.toFixed(2)})`,
                    startTime,
                    endTime,
                    startTime2,
                    endTime2
                )
            } else {
                // Single time range mode - use projected coordinates
                const data = await this.makeApiCall('/histogram/projected', {
                    ds: this.selectedLayer || 'default',
                    startTime,
                    endTime,
                    xmin: minProj.x,
                    ymin: minProj.y,
                    xmax: maxProj.x,
                    ymax: maxProj.y,
                    bins: bins,
                })
                this.createHistogramChart(data, `Histogram for Bounding Box`)
            }
        } else if (chartType === 'scatterplot') {
            // Scatterplot requires two layers
            if (!this.selectedLayer || !this.selectedLayerY) {
                throw new Error(
                    'Scatterplot requires two layers. Please select both X and Y layers.'
                )
            }

            // Sample points within the bounding box
            const sampledPoints = this.samplePointsInBbox(
                minLat,
                minLng,
                maxLat,
                maxLng,
                500 // Sample 500 points
            )

            if (this.dualTimeRangeEnabled) {
                // Get second time range values
                const startTime2 = $('#analysisStartTime2').val()
                const endTime2 = $('#analysisEndTime2').val()

                if (!startTime2 || !endTime2) {
                    throw new Error(
                        'Please set both start and end times for Time Range 2'
                    )
                }

                // Convert sampled points to projected coordinates
                const projectedPoints = sampledPoints.map((p) => {
                    const projected = this.convertLatLngToProjected(
                        p.lat,
                        p.lon
                    )
                    return {
                        id: p.id,
                        x: projected.x,
                        y: projected.y,
                    }
                })

                // Query both layers for both time ranges
                const [batchData1, batchData2] = await Promise.all([
                    this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer, this.selectedLayerY],
                            startTime: startTime,
                            endTime: endTime,
                        },
                        'POST'
                    ),
                    this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer, this.selectedLayerY],
                            startTime: startTime2,
                            endTime: endTime2,
                        },
                        'POST'
                    ),
                ])

                // Transform batch responses
                const transformedDataX1 =
                    this.transformBatchResponseToTimeSeries(
                        batchData1,
                        this.selectedLayer
                    )
                const transformedDataY1 =
                    this.transformBatchResponseToTimeSeries(
                        batchData1,
                        this.selectedLayerY
                    )
                const transformedDataX2 =
                    this.transformBatchResponseToTimeSeries(
                        batchData2,
                        this.selectedLayer
                    )
                const transformedDataY2 =
                    this.transformBatchResponseToTimeSeries(
                        batchData2,
                        this.selectedLayerY
                    )

                this.createDualTimeRangeScatterplot(
                    transformedDataX1,
                    transformedDataY1,
                    transformedDataX2,
                    transformedDataY2,
                    this.selectedLayer,
                    this.selectedLayerY,
                    `${this.selectedLayer} vs ${this.selectedLayerY}`,
                    `(${minLat.toFixed(2)},${minLng.toFixed(
                        2
                    )} - ${maxLat.toFixed(2)},${maxLng.toFixed(2)})`,
                    startTime,
                    endTime,
                    startTime2,
                    endTime2
                )
            } else {
                // Single time range mode - original behavior
                // Convert sampled points to projected coordinates
                const projectedPoints = sampledPoints.map((p) => {
                    const projected = this.convertLatLngToProjected(
                        p.lat,
                        p.lon
                    )
                    return {
                        id: p.id,
                        x: projected.x,
                        y: projected.y,
                    }
                })

                // Query both layers in a single batch call
                const batchData = await this.makeApiCall(
                    '/timeseries/batch',
                    {
                        points: projectedPoints,
                        datasets: [this.selectedLayer, this.selectedLayerY],
                        startTime: startTime,
                        endTime: endTime,
                    },
                    'POST'
                )

                // Transform batch response to match expected format for createScatterplotChart
                const transformedDataX =
                    this.transformBatchResponseToTimeSeries(
                        batchData,
                        this.selectedLayer
                    )
                const transformedDataY =
                    this.transformBatchResponseToTimeSeries(
                        batchData,
                        this.selectedLayerY
                    )

                this.createScatterplotChart(
                    transformedDataX,
                    transformedDataY,
                    this.selectedLayer,
                    this.selectedLayerY,
                    `Scatterplot for Bounding Box (${minLat.toFixed(
                        2
                    )},${minLng.toFixed(2)} - ${maxLat.toFixed(
                        2
                    )},${maxLng.toFixed(2)})`
                )
            }
        }
    },

    generateLineAnalysis: async function (chartType, startTime, endTime) {
        // Get line coordinates from input fields
        const startLat = parseFloat($('#analysisLineStartLat').val())
        const startLng = parseFloat($('#analysisLineStartLng').val())
        const endLat = parseFloat($('#analysisLineEndLat').val())
        const endLng = parseFloat($('#analysisLineEndLng').val())

        // Validate coordinates
        if (
            isNaN(startLat) ||
            isNaN(startLng) ||
            isNaN(endLat) ||
            isNaN(endLng)
        ) {
            throw new Error(
                'Please enter valid line coordinates or draw a line on the map.'
            )
        }

        // Create line points array from input fields
        const linePoints = [
            [startLat, startLng],
            [endLat, endLng],
        ]

        // For scatterplot, need two layers
        if (chartType === 'scatterplot') {
            if (!this.selectedLayer || !this.selectedLayerY) {
                throw new Error(
                    'Scatterplot requires two layers. Please select both X and Y layers.'
                )
            }

            // Get number of subdivisions from input
            const numSubdivisions =
                parseInt($('#analysisLineSubdivisions').val()) || 50

            // Subdivide the line into evenly-spaced points
            const sampledPoints = this.subdivideLineToPoints(
                linePoints,
                numSubdivisions
            )

            if (this.dualTimeRangeEnabled) {
                // Get second time range values
                const startTime2 = $('#analysisStartTime2').val()
                const endTime2 = $('#analysisEndTime2').val()

                if (!startTime2 || !endTime2) {
                    throw new Error(
                        'Please set both start and end times for Time Range 2'
                    )
                }

                // Convert sampled points to projected coordinates
                const projectedPoints = sampledPoints.map((p) => {
                    const projected = this.convertLatLngToProjected(
                        p.lat,
                        p.lon
                    )
                    return {
                        id: p.id,
                        x: projected.x,
                        y: projected.y,
                    }
                })

                // Query both layers for both time ranges
                const [batchData1, batchData2] = await Promise.all([
                    this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer, this.selectedLayerY],
                            startTime: startTime,
                            endTime: endTime,
                        },
                        'POST'
                    ),
                    this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer, this.selectedLayerY],
                            startTime: startTime2,
                            endTime: endTime2,
                        },
                        'POST'
                    ),
                ])

                // Transform batch responses
                const transformedDataX1 =
                    this.transformBatchResponseToTimeSeries(
                        batchData1,
                        this.selectedLayer
                    )
                const transformedDataY1 =
                    this.transformBatchResponseToTimeSeries(
                        batchData1,
                        this.selectedLayerY
                    )
                const transformedDataX2 =
                    this.transformBatchResponseToTimeSeries(
                        batchData2,
                        this.selectedLayer
                    )
                const transformedDataY2 =
                    this.transformBatchResponseToTimeSeries(
                        batchData2,
                        this.selectedLayerY
                    )

                this.createDualTimeRangeScatterplot(
                    transformedDataX1,
                    transformedDataY1,
                    transformedDataX2,
                    transformedDataY2,
                    this.selectedLayer,
                    this.selectedLayerY,
                    `Scatterplot along Line (${numSubdivisions} points)`,
                    null,
                    startTime,
                    endTime,
                    startTime2,
                    endTime2
                )
            } else {
                // Single time range mode - original behavior
                // Convert sampled points to projected coordinates
                const projectedPoints = sampledPoints.map((p) => {
                    const projected = this.convertLatLngToProjected(
                        p.lat,
                        p.lon
                    )
                    return {
                        id: p.id,
                        x: projected.x,
                        y: projected.y,
                    }
                })

                // Query both layers in a single batch call
                const batchData = await this.makeApiCall(
                    '/timeseries/batch',
                    {
                        points: projectedPoints,
                        datasets: [this.selectedLayer, this.selectedLayerY],
                        startTime: startTime,
                        endTime: endTime,
                    },
                    'POST'
                )

                // Transform batch response to match expected format for createScatterplotChart
                const transformedDataX =
                    this.transformBatchResponseToTimeSeries(
                        batchData,
                        this.selectedLayer
                    )
                const transformedDataY =
                    this.transformBatchResponseToTimeSeries(
                        batchData,
                        this.selectedLayerY
                    )

                this.createScatterplotChart(
                    transformedDataX,
                    transformedDataY,
                    this.selectedLayer,
                    this.selectedLayerY,
                    `Scatterplot along Line (${numSubdivisions} points)`
                )
            }
        } else {
            throw new Error(
                'Only scatterplot chart type is currently supported for line analysis.'
            )
        }
    },

    generateVectorPointsAnalysis: async function (
        chartType,
        startTime,
        endTime
    ) {
        // Check if we have selected points
        if (
            !this.vectorPointsDrawing.selectedPoints ||
            this.vectorPointsDrawing.selectedPoints.length === 0
        ) {
            throw new Error(
                'No vector points selected. Please draw a bounding box to select vector points first.'
            )
        }

        const numPoints = this.vectorPointsDrawing.selectedPoints.length

        // Currently only scatterplot and timeseries are supported
        if (chartType === 'scatterplot') {
            // Check if using property values (Y-axis) or second layer
            const selectedProperty = $('#analysisPropertySelect').val()

            if (!this.selectedLayer) {
                throw new Error('Please select a layer for X-axis.')
            }

            // Validate Y-axis source
            if (selectedProperty) {
                // Using property values for Y-axis
                if (!selectedProperty) {
                    throw new Error(
                        'Please select a GeoJSON property for Y-axis'
                    )
                }
            } else {
                // Using second layer for Y-axis
                if (!this.selectedLayerY) {
                    throw new Error('Please select a second layer for Y-axis')
                }
            }

            if (this.dualTimeRangeEnabled) {
                // Get second time range values
                const startTime2 = $('#analysisStartTime2').val()
                const endTime2 = $('#analysisEndTime2').val()

                if (!startTime2 || !endTime2) {
                    throw new Error(
                        'Please set both start and end times for Time Range 2'
                    )
                }

                if (selectedProperty) {
                    // Using property for Y-axis: query only X-axis layer for both time ranges
                    // Convert vector points to projected coordinates
                    const projectedPoints =
                        this.vectorPointsDrawing.selectedPoints.map((p) => {
                            const projected = this.convertLatLngToProjected(
                                p.lat,
                                p.lon
                            )
                            return {
                                id: p.id,
                                x: projected.x,
                                y: projected.y,
                            }
                        })

                    const [batchData1, batchData2] = await Promise.all([
                        this.makeApiCall(
                            '/timeseries/batch',
                            {
                                points: projectedPoints,
                                datasets: [this.selectedLayer],
                                startTime: startTime,
                                endTime: endTime,
                            },
                            'POST'
                        ),
                        this.makeApiCall(
                            '/timeseries/batch',
                            {
                                points: projectedPoints,
                                datasets: [this.selectedLayer],
                                startTime: startTime2,
                                endTime: endTime2,
                            },
                            'POST'
                        ),
                    ])

                    const transformedDataX1 =
                        this.transformBatchResponseToTimeSeries(
                            batchData1,
                            this.selectedLayer
                        )
                    const transformedDataX2 =
                        this.transformBatchResponseToTimeSeries(
                            batchData2,
                            this.selectedLayer
                        )
                    const transformedDataY = this.extractPropertyValues(
                        this.vectorPointsDrawing.selectedPoints,
                        selectedProperty
                    )

                    this.createDualTimeRangeScatterplot(
                        transformedDataX1,
                        transformedDataY,
                        transformedDataX2,
                        transformedDataY,
                        this.selectedLayer,
                        selectedProperty,
                        `Vector Points: ${this.selectedLayer} vs ${selectedProperty}`,
                        null,
                        startTime,
                        endTime,
                        startTime2,
                        endTime2
                    )
                } else {
                    // Using second layer for Y-axis: query both layers for both time ranges
                    // Convert vector points to projected coordinates
                    const projectedPoints =
                        this.vectorPointsDrawing.selectedPoints.map((p) => {
                            const projected = this.convertLatLngToProjected(
                                p.lat,
                                p.lon
                            )
                            return {
                                id: p.id,
                                x: projected.x,
                                y: projected.y,
                            }
                        })

                    const [batchData1, batchData2] = await Promise.all([
                        this.makeApiCall(
                            '/timeseries/batch',
                            {
                                points: projectedPoints,
                                datasets: [
                                    this.selectedLayer,
                                    this.selectedLayerY,
                                ],
                                startTime: startTime,
                                endTime: endTime,
                            },
                            'POST'
                        ),
                        this.makeApiCall(
                            '/timeseries/batch',
                            {
                                points: projectedPoints,
                                datasets: [
                                    this.selectedLayer,
                                    this.selectedLayerY,
                                ],
                                startTime: startTime2,
                                endTime: endTime2,
                            },
                            'POST'
                        ),
                    ])

                    const transformedDataX1 =
                        this.transformBatchResponseToTimeSeries(
                            batchData1,
                            this.selectedLayer
                        )
                    const transformedDataY1 =
                        this.transformBatchResponseToTimeSeries(
                            batchData1,
                            this.selectedLayerY
                        )
                    const transformedDataX2 =
                        this.transformBatchResponseToTimeSeries(
                            batchData2,
                            this.selectedLayer
                        )
                    const transformedDataY2 =
                        this.transformBatchResponseToTimeSeries(
                            batchData2,
                            this.selectedLayerY
                        )

                    this.createDualTimeRangeScatterplot(
                        transformedDataX1,
                        transformedDataY1,
                        transformedDataX2,
                        transformedDataY2,
                        this.selectedLayer,
                        this.selectedLayerY,
                        `Scatterplot for Vector Points (${numPoints} points)`,
                        null,
                        startTime,
                        endTime,
                        startTime2,
                        endTime2
                    )
                }
            } else {
                // Single time range mode
                if (selectedProperty) {
                    // Using property for Y-axis: query only X-axis layer
                    // Convert vector points to projected coordinates
                    const projectedPoints =
                        this.vectorPointsDrawing.selectedPoints.map((p) => {
                            const projected = this.convertLatLngToProjected(
                                p.lat,
                                p.lon
                            )
                            return {
                                id: p.id,
                                x: projected.x,
                                y: projected.y,
                            }
                        })

                    const batchData = await this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer],
                            startTime: startTime,
                            endTime: endTime,
                        },
                        'POST'
                    )

                    const transformedDataX =
                        this.transformBatchResponseToTimeSeries(
                            batchData,
                            this.selectedLayer
                        )
                    const transformedDataY = this.extractPropertyValues(
                        this.vectorPointsDrawing.selectedPoints,
                        selectedProperty
                    )

                    this.createScatterplotChart(
                        transformedDataX,
                        transformedDataY,
                        this.selectedLayer,
                        selectedProperty,
                        `Vector Points: ${this.selectedLayer} vs ${selectedProperty}`
                    )
                } else {
                    // Using second layer for Y-axis: query both layers
                    // Convert vector points to projected coordinates
                    const projectedPoints =
                        this.vectorPointsDrawing.selectedPoints.map((p) => {
                            const projected = this.convertLatLngToProjected(
                                p.lat,
                                p.lon
                            )
                            return {
                                id: p.id,
                                x: projected.x,
                                y: projected.y,
                            }
                        })

                    const batchData = await this.makeApiCall(
                        '/timeseries/batch',
                        {
                            points: projectedPoints,
                            datasets: [this.selectedLayer, this.selectedLayerY],
                            startTime: startTime,
                            endTime: endTime,
                        },
                        'POST'
                    )

                    const transformedDataX =
                        this.transformBatchResponseToTimeSeries(
                            batchData,
                            this.selectedLayer
                        )
                    const transformedDataY =
                        this.transformBatchResponseToTimeSeries(
                            batchData,
                            this.selectedLayerY
                        )

                    this.createScatterplotChart(
                        transformedDataX,
                        transformedDataY,
                        this.selectedLayer,
                        this.selectedLayerY,
                        `Scatterplot for Vector Points (${numPoints} points)`
                    )
                }
            }
        } else if (chartType === 'timeseries') {
            // For time series, we'll query the batch endpoint and show aggregated data
            if (!this.selectedLayer) {
                throw new Error('Please select a layer for analysis.')
            }

            // Convert vector points to projected coordinates
            const projectedPoints = this.vectorPointsDrawing.selectedPoints.map(
                (p) => {
                    const projected = this.convertLatLngToProjected(
                        p.lat,
                        p.lon
                    )
                    return {
                        id: p.id,
                        x: projected.x,
                        y: projected.y,
                    }
                }
            )

            const batchData = await this.makeApiCall(
                '/timeseries/batch',
                {
                    points: projectedPoints,
                    datasets: [this.selectedLayer],
                },
                'POST'
            )

            // Transform batch response to time series format
            const transformedData = this.transformBatchResponseToTimeSeries(
                batchData,
                this.selectedLayer
            )

            // For now, create a simple display - could be enhanced to show aggregated statistics
            // This will show the distribution of values across selected points
            this.createTimeSeriesChart(
                transformedData,
                `Data for Vector Points (${numPoints} points)`
            )
        } else {
            throw new Error(
                `Chart type "${chartType}" is not supported for vector points mode. Please use scatterplot or timeseries.`
            )
        }
    },

    // Helper method to filter time series data by time range
    filterDataByTimeRange: function (data, startTime, endTime) {
        if (!data || !data.times || !data.values) {
            return data
        }

        const startDate = new Date(startTime).getTime()
        const endDate = new Date(endTime).getTime()

        const filteredIndices = []
        for (let i = 0; i < data.times.length; i++) {
            const timeDate = new Date(data.times[i]).getTime()
            if (timeDate >= startDate && timeDate <= endDate) {
                filteredIndices.push(i)
            }
        }

        return {
            times: filteredIndices.map((i) => data.times[i]),
            values: filteredIndices.map((i) => data.values[i]),
        }
    },

    // Create dual time range scatterplot with two colored datasets
    createDualTimeRangeScatterplot: function (
        dataX1,
        dataY1,
        dataX2,
        dataY2,
        layerXName,
        layerYName,
        title,
        subtitle,
        startTime1,
        endTime1,
        startTime2,
        endTime2
    ) {
        // Format date strings for display
        const formatDate = (dateStr) => {
            const date = new Date(dateStr)
            return date.toISOString().split('T')[0] // YYYY-MM-DD
        }

        const timeRange1Label = `${formatDate(startTime1)} to ${formatDate(
            endTime1
        )}`
        const timeRange2Label = `${formatDate(startTime2)} to ${formatDate(
            endTime2
        )}`

        // Match data points for time range 1 (blue)
        const pairedData1 = []
        const matchType1 = dataX1.ids ? 'id' : 'time'

        if (matchType1 === 'id') {
            // ID-based matching for batch queries
            for (let i = 0; i < dataX1.ids.length; i++) {
                const idX = dataX1.ids[i]
                const valueX = dataX1.values[i]

                // Skip NODATA values
                if (valueX === 0) continue

                // Find matching Y value
                const yIndex = dataY1.ids.findIndex((id) => id === idX)
                if (yIndex !== -1) {
                    const valueY = dataY1.values[yIndex]
                    if (valueY !== 0) {
                        pairedData1.push({
                            value: [valueX, valueY],
                            id: idX,
                            x: valueX,
                            y: valueY,
                        })
                    }
                }
            }
        } else {
            // Time-based matching for regular time series
            for (let i = 0; i < dataX1.times.length; i++) {
                const timeX = new Date(dataX1.times[i]).getTime()
                const valueX = dataX1.values[i]

                if (valueX === 0) continue

                for (let j = 0; j < dataY1.times.length; j++) {
                    const timeY = new Date(dataY1.times[j]).getTime()
                    const valueY = dataY1.values[j]

                    if (valueY !== 0 && Math.abs(timeX - timeY) < 1000) {
                        pairedData1.push({
                            value: [valueX, valueY],
                            time: dataX1.times[i],
                            x: valueX,
                            y: valueY,
                        })
                        break
                    }
                }
            }
        }

        // Match data points for time range 2 (orange)
        const pairedData2 = []
        const matchType2 = dataX2.ids ? 'id' : 'time'

        if (matchType2 === 'id') {
            for (let i = 0; i < dataX2.ids.length; i++) {
                const idX = dataX2.ids[i]
                const valueX = dataX2.values[i]

                if (valueX === 0) continue

                const yIndex = dataY2.ids.findIndex((id) => id === idX)
                if (yIndex !== -1) {
                    const valueY = dataY2.values[yIndex]
                    if (valueY !== 0) {
                        pairedData2.push({
                            value: [valueX, valueY],
                            id: idX,
                            x: valueX,
                            y: valueY,
                        })
                    }
                }
            }
        } else {
            for (let i = 0; i < dataX2.times.length; i++) {
                const timeX = new Date(dataX2.times[i]).getTime()
                const valueX = dataX2.values[i]

                if (valueX === 0) continue

                for (let j = 0; j < dataY2.times.length; j++) {
                    const timeY = new Date(dataY2.times[j]).getTime()
                    const valueY = dataY2.values[j]

                    if (valueY !== 0 && Math.abs(timeX - timeY) < 1000) {
                        pairedData2.push({
                            value: [valueX, valueY],
                            time: dataX2.times[i],
                            x: valueX,
                            y: valueY,
                        })
                        break
                    }
                }
            }
        }

        // Check if we have enough data
        if (pairedData1.length < 2 && pairedData2.length < 2) {
            throw new Error(
                'Not enough matching data points to create scatterplot. Need at least 2 points in at least one time range.'
            )
        }

        // Calculate regressions for both datasets
        const regression1 =
            pairedData1.length >= 2
                ? this.calculateScatterRegression(pairedData1)
                : null
        const regression2 =
            pairedData2.length >= 2
                ? this.calculateScatterRegression(pairedData2)
                : null

        // Build series array
        const series = []

        // Time Range 1 data points (blue)
        if (pairedData1.length > 0) {
            series.push({
                name: `Time Range 1 (${pairedData1.length} pts)`,
                type: 'scatter',
                data: pairedData1,
                symbolSize: 4,
                itemStyle: {
                    color: '#70a7ff',
                    opacity: 0.7,
                    borderColor: '#5094ff',
                    borderWidth: 1,
                },
                emphasis: {
                    itemStyle: {
                        color: '#90c0ff',
                        opacity: 1,
                        shadowBlur: 10,
                        shadowColor: 'rgba(112, 167, 255, 0.5)',
                    },
                },
            })

            // Time Range 1 trend line (blue dashed)
            if (regression1 && regression1.linePoints) {
                series.push({
                    name: `Trend 1 (R² = ${regression1.rSquared.toFixed(2)})`,
                    type: 'line',
                    data: regression1.linePoints,
                    lineStyle: {
                        color: '#70a7ff',
                        width: 2,
                        type: 'dashed',
                        opacity: 0.8,
                    },
                    symbol: 'none',
                    symbolSize: 0,
                    itemStyle: { opacity: 0 },
                    animation: false,
                })
            }
        }

        // Time Range 2 data points (orange)
        if (pairedData2.length > 0) {
            series.push({
                name: `Time Range 2 (${pairedData2.length} pts)`,
                type: 'scatter',
                data: pairedData2,
                symbolSize: 4,
                itemStyle: {
                    color: '#ff8c42',
                    opacity: 0.7,
                    borderColor: '#ff7420',
                    borderWidth: 1,
                },
                emphasis: {
                    itemStyle: {
                        color: '#ffaa70',
                        opacity: 1,
                        shadowBlur: 10,
                        shadowColor: 'rgba(255, 140, 66, 0.5)',
                    },
                },
            })

            // Time Range 2 trend line (orange dashed)
            if (regression2 && regression2.linePoints) {
                series.push({
                    name: `Trend 2 (R² = ${regression2.rSquared.toFixed(2)})`,
                    type: 'line',
                    data: regression2.linePoints,
                    lineStyle: {
                        color: '#ff8c42',
                        width: 2,
                        type: 'dashed',
                        opacity: 0.8,
                    },
                    symbol: 'none',
                    symbolSize: 0,
                    itemStyle: { opacity: 0 },
                    animation: false,
                })
            }
        }

        // Build subtitle with both R² values
        subtitle = subtitle != null ? `${subtitle}\n` : ''
        subtitle += `Blue: ${timeRange1Label}`
        if (regression1) {
            subtitle += ` (R² = ${regression1.rSquared.toFixed(3)})`
        }
        subtitle += `\nOrange: ${timeRange2Label}`
        if (regression2) {
            subtitle += ` (R² = ${regression2.rSquared.toFixed(3)})`
        }

        // Create ECharts configuration
        const option = {
            title: {
                text: title,
                subtext: subtitle,
                left: 'center',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'normal',
                },
                subtextStyle: {
                    color: '#aaaaaa',
                    fontSize: 11,
                    lineHeight: 16,
                },
            },
            tooltip: {
                trigger: 'item',
                formatter: function (params) {
                    if (params.seriesType === 'scatter') {
                        const data = params.data
                        let tooltip = ''
                        if (data.x !== null && data.x !== undefined) {
                            tooltip += `${layerXName}: ${data.x.toFixed(
                                4
                            )}<br/>`
                        }
                        if (data.y !== null && data.y !== undefined) {
                            tooltip += `${layerYName}: ${data.y.toFixed(4)}`
                        }
                        if (data.id) {
                            tooltip += `<br/>ID: ${data.id}`
                        }
                        if (data.time) {
                            tooltip += `<br/>Time: ${data.time}`
                        }
                        return tooltip
                    }
                    return params.seriesName
                },
                backgroundColor: 'rgba(50,50,50,0.95)',
                borderColor: '#777',
                borderWidth: 1,
                textStyle: {
                    color: '#fff',
                    fontSize: 12,
                },
            },
            legend: {
                data: series.map((s) => s.name),
                top: 80,
                textStyle: {
                    color: '#cccccc',
                    fontSize: 11,
                },
            },
            grid: {
                left: '10%',
                right: '5%',
                bottom: '8%',
                top: 120,
                containLabel: true,
            },
            xAxis: {
                type: 'value',
                name: layerXName,
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: {
                    color: '#ffffff',
                    fontSize: 13,
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: {
                        color: '#555555',
                    },
                },
                splitLine: {
                    lineStyle: {
                        color: '#333333',
                        type: 'dashed',
                    },
                },
            },
            yAxis: {
                type: 'value',
                name: layerYName,
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    color: '#ffffff',
                    fontSize: 13,
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: {
                        color: '#555555',
                    },
                },
                splitLine: {
                    lineStyle: {
                        color: '#333333',
                        type: 'dashed',
                    },
                },
            },
            series: series,
        }

        // Dispose previous chart if it exists
        if (this.chartInstance) {
            this.chartInstance.dispose()
        }

        // Create new chart with explicit dimensions
        const chartDom = document.getElementById('analysisChart')
        this.chartInstance = echarts.init(chartDom, null, {
            width: chartDom.offsetWidth || 616,
            height: chartDom.offsetHeight || 500,
            renderer: 'canvas',
        })
        this.chartInstance.setOption(option)

        // Show chart
        this.showChartState('chart')

        //console.log( `Dual time range scatterplot created: ${pairedData1.length} points (T1), ${pairedData2.length} points (T2)`)
    },

    // Utility Functions
    calculateLinearRegression: function (xValues, yValues) {
        if (xValues.length !== yValues.length || xValues.length < 2) {
            return null
        }

        const n = xValues.length
        let sumX = 0,
            sumY = 0,
            sumXY = 0,
            sumXX = 0

        for (let i = 0; i < n; i++) {
            const x = i // Use index as x value for time series
            const y = yValues[i]
            sumX += x
            sumY += y
            sumXY += x * y
            sumXX += x * x
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
        const intercept = (sumY - slope * sumX) / n

        // Generate regression line points
        const regressionPoints = []
        for (let i = 0; i < n; i++) {
            regressionPoints.push(slope * i + intercept)
        }

        return {
            slope,
            intercept,
            points: regressionPoints,
        }
    },

    calculateScatterRegression: function (pairedData) {
        if (pairedData.length < 2) return null

        const xValues = pairedData.map((d) => d.x)
        const yValues = pairedData.map((d) => d.y)

        // Calculate means
        const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length
        const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length

        // Calculate slope and intercept
        let numerator = 0,
            denominator = 0,
            ssTotal = 0,
            ssResidual = 0

        for (let i = 0; i < xValues.length; i++) {
            numerator += (xValues[i] - xMean) * (yValues[i] - yMean)
            denominator += (xValues[i] - xMean) ** 2
            ssTotal += (yValues[i] - yMean) ** 2
        }

        const slope = numerator / denominator
        const intercept = yMean - slope * xMean

        // Calculate R²
        for (let i = 0; i < xValues.length; i++) {
            const predicted = slope * xValues[i] + intercept
            ssResidual += (yValues[i] - predicted) ** 2
        }

        const r2 = 1 - ssResidual / ssTotal

        // Generate line points for the full range
        const xMin = Math.min(...xValues)
        const xMax = Math.max(...xValues)
        const linePoints = [
            { value: [xMin, slope * xMin + intercept] },
            { value: [xMax, slope * xMax + intercept] },
        ]

        return { slope, intercept, rSquared: r2, linePoints }
    },

    // Chart Creation Functions
    createTimeSeriesChart: function (data, title) {
        this.initializeChart()

        // Check if data is empty
        if (
            !data.times ||
            !data.values ||
            data.times.length === 0 ||
            data.values.length === 0
        ) {
            throw new Error(
                'No time series data found for this location and time range. Try selecting a different location or time range.'
            )
        }

        // Filter out NODATA values while keeping times and values synchronized
        const filteredData = {
            times: [],
            values: [],
        }

        for (let i = 0; i < data.values.length; i++) {
            if (data.values[i] !== NODATA) {
                filteredData.times.push(data.times[i])
                filteredData.values.push(data.values[i])
            }
        }

        // Calculate regression line
        const regression = this.calculateLinearRegression(
            filteredData.times,
            filteredData.values
        )

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: title,
                left: 'center',
                top: '5%',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                textStyle: { color: '#ffffff' },
                borderColor: '#70a7ff',
                borderWidth: 1,
            },
            grid: {
                left: '8%',
                right: '5%',
                bottom: '8%',
                top: '15%',
                containLabel: true,
                backgroundColor: 'transparent',
            },
            xAxis: {
                type: 'category',
                data: filteredData.times,
                axisLabel: {
                    rotate: 45,
                    color: '#cccccc',
                    fontSize: 11,
                    margin: 8,
                    formatter: function (value, index) {
                        // Parse the timestamp and format it nicely
                        const date = new Date(value)
                        const totalLabels = filteredData.times.length

                        // Show fewer labels for large datasets
                        if (totalLabels > 20) {
                            // Show every nth label based on dataset size
                            const step = Math.ceil(totalLabels / 10)
                            if (index % step !== 0) return ''
                        }

                        // Format based on time range
                        if (totalLabels <= 7) {
                            // Few points - show full date and time
                            return date.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })
                        } else if (totalLabels <= 30) {
                            // Medium range - show date only
                            return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                            })
                        } else {
                            // Many points - show month/year or just dates
                            return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                            })
                        }
                    },
                    interval: 0, // Show all labels (formatter will handle filtering)
                },
                axisLine: {
                    lineStyle: { color: '#555555', width: 1 },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#555555' },
                    show: true,
                },
            },
            yAxis: {
                type: 'value',
                name: data.unit || 'Value',
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 12,
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#555555', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: { color: '#333333', width: 1, type: 'dashed' },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#555555' },
                    show: true,
                },
            },
            series: [
                {
                    name: 'Value',
                    type: 'line',
                    data: filteredData.values,
                    lineStyle: {
                        color: '#70a7ff',
                        width: 2,
                        shadowColor: 'rgba(112, 167, 255, 0.3)',
                        shadowBlur: 4,
                    },
                    itemStyle: {
                        color: '#70a7ff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                    },
                    symbol: 'circle',
                    symbolSize: 8,
                    connectNulls: false,
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 8,
                            shadowColor: 'rgba(112, 167, 255, 0.6)',
                        },
                    },
                },
                ...(regression
                    ? [
                          {
                              name: 'Trend Line',
                              type: 'line',
                              data: regression.points,
                              lineStyle: {
                                  color: '#ff6b6b',
                                  width: 2,
                                  type: 'dashed',
                                  opacity: 0.8,
                              },
                              itemStyle: {
                                  color: '#ff6b6b',
                                  opacity: 0,
                              },
                              symbol: 'none',
                              smooth: false,
                              connectNulls: false,
                              animation: false,
                          },
                      ]
                    : []),
            ],
        }

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    createSpatialTimeSeriesChart: function (data, title) {
        this.initializeChart()

        // Filter out NODATA values from all data arrays
        const filteredData = data.data.filter(
            (d) => d.mean !== NODATA && d.min !== NODATA && d.max !== NODATA
        )

        const times = filteredData.map((d) => d.time)
        const means = filteredData.map((d) => d.mean)
        const mins = filteredData.map((d) => d.min)
        const maxs = filteredData.map((d) => d.max)

        // Calculate regression lines for each series
        const meanRegression = this.calculateLinearRegression(times, means)
        const minRegression = this.calculateLinearRegression(times, mins)
        const maxRegression = this.calculateLinearRegression(times, maxs)

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: title,
                left: 'center',
                top: '5%',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                textStyle: { color: '#ffffff' },
                borderColor: '#70a7ff',
                borderWidth: 1,
            },
            legend: {
                data: ['Mean', ...(meanRegression ? ['Mean Trend'] : [])],
                textStyle: { color: '#cccccc', fontSize: 12 },
                top: '12%',
            },
            grid: {
                left: '8%',
                right: '5%',
                bottom: '15%',
                top: '20%',
                containLabel: true,
                backgroundColor: 'transparent',
            },
            xAxis: {
                type: 'category',
                data: times,
                axisLabel: {
                    rotate: 45,
                    color: '#cccccc',
                    fontSize: 11,
                    margin: 8,
                    formatter: function (value, index) {
                        const date = new Date(value)
                        const totalLabels = times.length

                        // Show fewer labels for large datasets
                        if (totalLabels > 20) {
                            const step = Math.ceil(totalLabels / 10)
                            if (index % step !== 0) return ''
                        }

                        // Format based on time range
                        if (totalLabels <= 7) {
                            return date.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })
                        } else {
                            return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                            })
                        }
                    },
                    interval: 0,
                },
                axisLine: {
                    lineStyle: { color: '#555555', width: 1 },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#555555' },
                    show: true,
                },
            },
            yAxis: {
                type: 'value',
                name: 'Value',
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 12,
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#555555', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: { color: '#333333', width: 1, type: 'dashed' },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#555555' },
                    show: true,
                },
            },
            series: [
                {
                    name: 'Mean',
                    type: 'line',
                    data: means,
                    lineStyle: {
                        color: '#70a7ff',
                        width: 2,
                        shadowColor: 'rgba(112, 167, 255, 0.3)',
                        shadowBlur: 4,
                    },
                    itemStyle: {
                        color: '#70a7ff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                    },
                    symbol: 'circle',
                    symbolSize: 6,
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 8,
                            shadowColor: 'rgba(112, 167, 255, 0.6)',
                        },
                    },
                },
                ...(meanRegression
                    ? [
                          {
                              name: 'Mean Trend',
                              type: 'line',
                              data: meanRegression.points,
                              lineStyle: {
                                  color: '#ff6b6b',
                                  width: 2,
                                  type: 'dashed',
                                  opacity: 0.8,
                              },
                              itemStyle: {
                                  color: '#ff6b6b',
                                  opacity: 0,
                              },
                              symbol: 'none',
                              smooth: false,
                              connectNulls: false,
                              animation: false,
                          },
                      ]
                    : []),
            ],
        }

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    createStatisticsChart: function (data, title) {
        this.initializeChart()

        const stats = ['mean', 'std', 'min', 'max', 'median'].filter(
            (key) =>
                data[key] !== null &&
                data[key] !== undefined &&
                data[key] !== NODATA
        )
        const values = stats.map((key) => ({
            name: key.toUpperCase(),
            value: data[key],
        }))

        const option = {
            title: {
                text: title,
                left: 'center',
                textStyle: { color: 'var(--color-a)' },
            },
            tooltip: { trigger: 'item', formatter: '{b}: {c}' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: stats.map((s) => s.toUpperCase()),
                axisLabel: { color: 'var(--color-a)' },
                axisLine: { lineStyle: { color: 'var(--color-a3)' } },
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: 'var(--color-a)' },
                axisLine: { lineStyle: { color: 'var(--color-a3)' } },
                splitLine: { lineStyle: { color: 'var(--color-a3)' } },
            },
            series: [
                {
                    type: 'bar',
                    data: values,
                    itemStyle: {
                        color: function (params) {
                            const colors = [
                                'var(--color-a7)',
                                'var(--color-a5)',
                                'var(--color-a4)',
                                'var(--color-a6)',
                                'var(--color-a8)',
                            ]
                            return colors[params.dataIndex % colors.length]
                        },
                    },
                },
            ],
        }

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    createHistogramChart: function (data, title) {
        this.initializeChart()

        // Check for empty/error data
        if (
            !data.counts ||
            data.counts.length === 0 ||
            (data.statistics && data.statistics.count === 0)
        ) {
            throw new Error(data.error || 'No valid data in specified range')
        }

        // Filter out NODATA values and bins containing 0 (nodata value)
        const filteredIndices = []
        const filteredCounts = []

        for (let i = 0; i < data.counts.length; i++) {
            // Skip if count is NODATA/null, or if the bin contains the value 0
            const binStart = data.bin_edges[i]
            const binEnd = data.bin_edges[i + 1]
            const binContainsZero = binStart <= 0 && binEnd >= 0

            if (
                data.counts[i] !== NODATA &&
                data.counts[i] !== null &&
                !binContainsZero
            ) {
                filteredIndices.push(i)
                filteredCounts.push(data.counts[i])
            }
        }

        const filteredBinEdges = filteredIndices.map((i) => data.bin_edges[i])
        filteredBinEdges.push(
            data.bin_edges[filteredIndices[filteredIndices.length - 1] + 1]
        ) // Add the last edge

        const binCenters = filteredBinEdges
            .slice(0, -1)
            .map((edge, i) => (edge + filteredBinEdges[i + 1]) / 2)

        // Recalculate statistics excluding 0 values
        // Backend statistics include 0s, so we need to recalculate
        const totalCount = filteredCounts.reduce((sum, c) => sum + c, 0)

        // Calculate weighted mean and std from histogram data (excluding zeros)
        let weightedSum = 0
        let weightedSumSq = 0
        for (let i = 0; i < binCenters.length; i++) {
            weightedSum += binCenters[i] * filteredCounts[i]
            weightedSumSq += binCenters[i] * binCenters[i] * filteredCounts[i]
        }
        const mean = weightedSum / totalCount
        const variance = weightedSumSq / totalCount - mean * mean
        const std = Math.sqrt(variance)

        // Calculate percentiles from counts and bin edges (excluding zeros)
        const percentiles = this.calculatePercentilesFromHistogram(
            binCenters,
            filteredCounts,
            totalCount
        )

        // Use calculated median from percentiles
        const median = percentiles.p50 ? parseFloat(percentiles.p50) : mean

        // Create statistics object with recalculated values
        const stats = {
            mean: mean,
            median: median,
            std: std,
            min: Math.min(
                ...binCenters.map((c, i) =>
                    filteredCounts[i] > 0 ? c : Infinity
                )
            ),
            max: Math.max(
                ...binCenters.map((c, i) =>
                    filteredCounts[i] > 0 ? c : -Infinity
                )
            ),
            count: totalCount,
        }

        // Prepare mark lines for percentiles and statistics with staggered label positions
        const markLines = []

        // Add percentile markers with staggered vertical positions to avoid overlap
        if (percentiles.p25 !== null) {
            markLines.push({
                xAxis: percentiles.p25,
                lineStyle: { color: '#FFA726', width: 2, type: 'dashed' },
                label: {
                    formatter: 'Q1',
                    position: 'insideEndTop',
                    color: '#FFA726',
                    fontSize: 10,
                    distance: 5,
                },
            })
        }

        if (percentiles.p50 !== null) {
            markLines.push({
                xAxis: percentiles.p50,
                lineStyle: { color: '#66BB6A', width: 2, type: 'solid' },
                label: {
                    formatter: 'Median',
                    position: 'insideEndTop',
                    color: '#66BB6A',
                    fontSize: 10,
                    distance: 5,
                },
            })
        }

        if (percentiles.p75 !== null) {
            markLines.push({
                xAxis: percentiles.p75,
                lineStyle: { color: '#FFA726', width: 2, type: 'dashed' },
                label: {
                    formatter: 'Q3',
                    position: 'insideEndTop',
                    color: '#FFA726',
                    fontSize: 10,
                    distance: 5,
                },
            })
        }

        // Add mean marker - find closest bin center
        if (mean !== null && mean !== undefined) {
            // Find the closest bin center to the mean
            let closestBinIndex = 0
            let minDistance = Math.abs(binCenters[0] - mean)

            for (let i = 1; i < binCenters.length; i++) {
                const distance = Math.abs(binCenters[i] - mean)
                if (distance < minDistance) {
                    minDistance = distance
                    closestBinIndex = i
                }
            }

            markLines.push({
                xAxis: binCenters[closestBinIndex].toFixed(2),
                lineStyle: { color: '#EF5350', width: 2, type: 'solid' },
                label: {
                    formatter: 'Mean',
                    position: 'insideEndTop',
                    color: '#EF5350',
                    fontSize: 10,
                    distance: 5,
                },
            })
        }

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: title,
                left: 'center',
                top: '5%',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'var(--color-j)',
                textStyle: { color: '#ffffff', fontSize: 12 },
                borderColor: 'var(--color-a)',
                borderWidth: 2,
                padding: 10,
                formatter: function (params) {
                    if (!params || params.length === 0) return ''

                    // Get the bin value from x-axis
                    const binValue = params[0].name

                    let result = `<strong>Value: ${binValue}</strong><br/>`
                    result += '<hr style="margin: 5px 0; border-color: #555;"/>'

                    params.forEach((param) => {
                        if (param.seriesName === 'Distribution') {
                            const frequency = param.value
                            const percentage = (
                                (frequency / totalCount) *
                                100
                            ).toFixed(2)
                            result += `${
                                param.marker
                            } <strong>Frequency:</strong> ${frequency.toLocaleString()}<br/>`
                            result += `&nbsp;&nbsp;&nbsp;<span style="color: #aaa;">Percentage: ${percentage}%</span><br/>`
                        } else if (param.seriesName === 'Normal Curve') {
                            result += `${
                                param.marker
                            } <strong>Normal Dist:</strong> ${parseFloat(
                                param.value
                            ).toFixed(1)}<br/>`
                        }
                    })

                    return result
                },
            },
            legend: {
                data: ['Distribution'],
                textStyle: { color: '#cccccc', fontSize: 12 },
                top: '12%',
            },
            grid: {
                left: '4%',
                right: '0%',
                bottom: '7%',
                top: '25%',
                containLabel: true,
                backgroundColor: 'transparent',
            },
            xAxis: {
                type: 'category',
                data: binCenters.map((c) => c.toFixed(2)),
                name: 'Value',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                    rotate: 45,
                    formatter: function (value, index) {
                        // Show fewer labels for many bins
                        const totalLabels = binCenters.length
                        if (totalLabels > 30) {
                            const step = Math.ceil(totalLabels / 15)
                            if (index % step !== 0) return ''
                        }
                        return value
                    },
                },
                axisLine: {
                    lineStyle: { color: '#777777', width: 1 },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#777777' },
                    show: true,
                },
            },
            yAxis: {
                type: 'value',
                name: 'Frequency',
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#777777', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: { color: '#444444', width: 1, type: 'dashed' },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#777777' },
                    show: true,
                },
            },
            series: [
                {
                    name: 'Distribution',
                    type: 'bar',
                    data: filteredCounts,
                    itemStyle: {
                        color: '#70a7ff',
                        borderColor: '#5094ff',
                        borderWidth: 0,
                    },
                    barWidth: '85%',
                    markLine: {
                        symbol: 'none',
                        data: markLines,
                        animation: false,
                    },
                    emphasis: {
                        itemStyle: {
                            color: '#90c0ff',
                            shadowBlur: 10,
                            shadowColor: 'rgba(112, 167, 255, 0.5)',
                        },
                    },
                },
            ],
        }

        // Display statistics in separate panel
        this.displayHistogramStats(stats, totalCount, true)

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    createDualTimeRangeHistogramChart: function (
        data1,
        data2,
        title,
        startTime1,
        endTime1,
        startTime2,
        endTime2
    ) {
        this.initializeChart()

        // Check for empty/error data in both datasets
        if (
            !data1.counts ||
            data1.counts.length === 0 ||
            (data1.statistics && data1.statistics.count === 0)
        ) {
            throw new Error(data1.error || 'No valid data in Time Range 1')
        }
        if (
            !data2.counts ||
            data2.counts.length === 0 ||
            (data2.statistics && data2.statistics.count === 0)
        ) {
            throw new Error(data2.error || 'No valid data in Time Range 2')
        }

        // Ensure both datasets have the same bin edges
        if (data1.bin_edges.length !== data2.bin_edges.length) {
            throw new Error('Time ranges have different bin configurations')
        }

        // Filter out NODATA values and bins containing 0
        const filteredData1 = { bins: [], counts: [] }
        const filteredData2 = { bins: [], counts: [] }

        for (let i = 0; i < data1.counts.length; i++) {
            const binStart = data1.bin_edges[i]
            const binEnd = data1.bin_edges[i + 1]
            const binContainsZero = binStart <= 0 && binEnd >= 0

            if (
                data1.counts[i] !== NODATA &&
                data1.counts[i] !== null &&
                !binContainsZero
            ) {
                const binCenter = (binStart + binEnd) / 2
                filteredData1.bins.push(binCenter)
                filteredData1.counts.push(data1.counts[i])
                filteredData2.counts.push(data2.counts[i] || 0)
            }
        }

        // Format date strings for legend
        const formatDate = (dateStr) => {
            const date = new Date(dateStr)
            return date.toISOString().split('T')[0] // YYYY-MM-DD
        }

        const timeRange1Label = `${formatDate(startTime1)} to ${formatDate(
            endTime1
        )}`
        const timeRange2Label = `${formatDate(startTime2)} to ${formatDate(
            endTime2
        )}`

        // Create ECharts configuration with two bar series
        const option = {
            backgroundColor: 'transparent',
            title: {
                text: title,
                subtext: `Blue: ${timeRange1Label}\nOrange: ${timeRange2Label}`,
                left: 'center',
                top: '5%',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                },
                subtextStyle: {
                    color: '#aaaaaa',
                    fontSize: 11,
                    lineHeight: 16,
                },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'var(--color-j)',
                textStyle: { color: '#ffffff', fontSize: 12 },
                borderColor: 'var(--color-a)',
                borderWidth: 2,
                padding: 10,
                formatter: function (params) {
                    if (!params || params.length === 0) return ''

                    const binValue = params[0].name
                    let result = `<strong>Value: ${binValue}</strong><br/>`
                    result += '<hr style="margin: 5px 0; border-color: #555;"/>'

                    params.forEach((param) => {
                        const frequency = param.value
                        result += `${param.marker} <strong>${
                            param.seriesName
                        }:</strong> ${frequency.toLocaleString()}<br/>`
                    })

                    return result
                },
            },
            legend: {
                data: [`Time Range 1`, `Time Range 2`],
                textStyle: { color: '#cccccc', fontSize: 12 },
                top: 90,
            },
            grid: {
                left: '4%',
                right: '0%',
                bottom: '8%',
                top: 120,
                containLabel: true,
                backgroundColor: 'transparent',
            },
            xAxis: {
                type: 'category',
                data: filteredData1.bins.map((c) => c.toFixed(2)),
                name: 'Value',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                    rotate: 45,
                    formatter: function (value, index) {
                        const totalLabels = filteredData1.bins.length
                        if (totalLabels > 30) {
                            const step = Math.ceil(totalLabels / 15)
                            if (index % step !== 0) return ''
                        }
                        return value
                    },
                },
                axisLine: {
                    lineStyle: { color: '#777777', width: 1 },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#777777' },
                    show: true,
                },
            },
            yAxis: {
                type: 'value',
                name: 'Frequency',
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#777777', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: { color: '#444444', width: 1, type: 'dashed' },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#777777' },
                    show: true,
                },
            },
            series: [
                {
                    name: 'Time Range 1',
                    type: 'bar',
                    data: filteredData1.counts,
                    itemStyle: {
                        color: '#70a7ff',
                        borderColor: '#5094ff',
                        borderWidth: 0,
                    },
                    barWidth: '40%',
                    barGap: '10%',
                    emphasis: {
                        itemStyle: {
                            color: '#90c0ff',
                            shadowBlur: 10,
                            shadowColor: 'rgba(112, 167, 255, 0.5)',
                        },
                    },
                },
                {
                    name: 'Time Range 2',
                    type: 'bar',
                    data: filteredData2.counts,
                    itemStyle: {
                        color: '#ff8c42',
                        borderColor: '#ff7420',
                        borderWidth: 0,
                    },
                    barWidth: '40%',
                    emphasis: {
                        itemStyle: {
                            color: '#ffaa70',
                            shadowBlur: 10,
                            shadowColor: 'rgba(255, 140, 66, 0.5)',
                        },
                    },
                },
            ],
        }

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    createScatterplotChart: function (
        dataX,
        dataY,
        layerXName,
        layerYName,
        title
    ) {
        this.initializeChart()

        // Match data by ID (for batch queries) or by timestamp (for regular time series)
        const pairedData = []
        const unmatchedItems = []

        // Check if we have IDs (batch query) or times (regular time series)
        const hasIds = dataX.ids && dataX.ids.length > 0
        const hasTimes = dataX.times && dataX.times.length > 0
        const dataLength = hasIds
            ? dataX.ids.length
            : hasTimes
              ? dataX.times.length
              : 0

        if (hasIds) {
            // Match by ID (for line/bbox scatterplots)
            for (let i = 0; i < dataX.ids.length; i++) {
                const idX = dataX.ids[i]
                const valueX = dataX.values[i]

                // Skip NODATA values
                if (valueX === NODATA || valueX === null) continue

                // Find matching ID in dataY
                const matchIndex = dataY.ids.findIndex((idY) => idY === idX)

                if (matchIndex !== -1) {
                    const valueY = dataY.values[matchIndex]
                    if (valueY !== NODATA && valueY !== null) {
                        pairedData.push({
                            value: [valueX, valueY],
                            id: idX,
                            x: valueX,
                            y: valueY,
                        })
                    }
                } else {
                    unmatchedItems.push(idX)
                }
            }

            // Warn if many IDs didn't match
            if (unmatchedItems.length > dataX.ids.length * 0.2) {
                //console.warn(`${unmatchedItems.length} IDs couldn't be matched between layers`)
            }
        } else if (hasTimes) {
            // Match by timestamp (for regular point time series scatterplots)
            for (let i = 0; i < dataX.times.length; i++) {
                const timeX = dataX.times[i]
                const valueX = dataX.values[i]

                // Skip NODATA values
                if (valueX === NODATA || valueX === null) continue

                // Find matching timestamp in dataY (exact or within 1 second tolerance)
                const matchIndex = dataY.times.findIndex((timeY) => {
                    const diff = Math.abs(new Date(timeX) - new Date(timeY))
                    return diff < 1000 // 1 second tolerance
                })

                if (matchIndex !== -1) {
                    const valueY = dataY.values[matchIndex]
                    if (valueY !== NODATA && valueY !== null) {
                        pairedData.push({
                            value: [valueX, valueY],
                            time: timeX,
                            x: valueX,
                            y: valueY,
                        })
                    }
                } else {
                    unmatchedItems.push(timeX)
                }
            }

            // Warn if many timestamps didn't match
            if (unmatchedItems.length > dataX.times.length * 0.2) {
                console.warn(
                    `${unmatchedItems.length} timestamps couldn't be matched between layers`
                )
            }
        }

        // Check if we have enough data
        if (pairedData.length < 2) {
            throw new Error(
                `Not enough matching data points between the two layers. Need at least 2 matching ${
                    hasIds ? 'IDs' : 'timestamps'
                }.`
            )
        }

        // Calculate linear regression and R²
        const regression = this.calculateScatterRegression(pairedData)

        // Create ECharts configuration
        const option = {
            backgroundColor: 'transparent',
            title: {
                text: title,
                subtext: `${layerXName} vs ${layerYName}${
                    regression
                        ? ` (R² = ${regression.rSquared.toFixed(3)})`
                        : ''
                }`,
                left: 'center',
                top: '2%',
                textStyle: {
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                },
                subtextStyle: { color: '#cccccc', fontSize: 12 },
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                textStyle: { color: '#ffffff' },
                borderColor: '#70a7ff',
                borderWidth: 1,
                formatter: function (params) {
                    if (params.componentType === 'series' && params.data) {
                        let label = ''
                        if (params.data.time) {
                            const date = new Date(params.data.time)
                            label = `${
                                params.marker
                            } ${date.toLocaleString()}<br/>`
                        } else if (params.data.id) {
                            label = `${params.marker} Point: ${params.data.id}<br/>`
                        }
                        let tooltip = label
                        if (
                            params.data.x !== null &&
                            params.data.x !== undefined
                        ) {
                            tooltip += `${layerXName}: ${params.data.x.toFixed(
                                3
                            )}<br/>`
                        }
                        if (
                            params.data.y !== null &&
                            params.data.y !== undefined
                        ) {
                            tooltip += `${layerYName}: ${params.data.y.toFixed(
                                3
                            )}`
                        }
                        return tooltip
                    }
                    return ''
                },
            },
            legend: {
                data: ['Data Points', ...(regression ? ['Trend Line'] : [])],
                textStyle: { color: '#cccccc', fontSize: 12 },
                top: '13%',
            },
            grid: {
                left: '10%',
                right: '5%',
                bottom: '10%',
                top: '22%',
                containLabel: true,
            },
            xAxis: {
                type: 'value',
                name: layerXName,
                nameLocation: 'middle',
                nameGap: 35,
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#666666', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: {
                        color: '#444444',
                        width: 1,
                        type: 'dashed',
                    },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#666666' },
                    show: true,
                },
            },
            yAxis: {
                type: 'value',
                name: layerYName,
                nameLocation: 'middle',
                nameGap: 50,
                nameRotate: 90,
                nameTextStyle: {
                    color: '#cccccc',
                    fontSize: 13,
                    fontWeight: 'bold',
                },
                axisLabel: {
                    color: '#cccccc',
                    fontSize: 11,
                },
                axisLine: {
                    lineStyle: { color: '#666666', width: 1 },
                    show: true,
                },
                splitLine: {
                    lineStyle: {
                        color: '#444444',
                        width: 1,
                        type: 'dashed',
                    },
                    show: true,
                },
                axisTick: {
                    lineStyle: { color: '#666666' },
                    show: true,
                },
            },
            series: [
                {
                    name: 'Data Points',
                    type: 'scatter',
                    data: pairedData,
                    symbolSize: 4,
                    itemStyle: {
                        color: '#70a7ff',
                        opacity: 0.7,
                        borderColor: '#5094ff',
                        borderWidth: 1,
                    },
                    emphasis: {
                        itemStyle: {
                            color: '#90c0ff',
                            opacity: 1,
                            shadowBlur: 10,
                            shadowColor: 'rgba(112, 167, 255, 0.5)',
                        },
                    },
                },
                ...(regression
                    ? [
                          {
                              name: 'Trend Line',
                              type: 'line',
                              data: regression.linePoints,
                              lineStyle: {
                                  color: '#ff6b6b',
                                  width: 2,
                                  type: 'dashed',
                                  opacity: 0.8,
                              },
                              itemStyle: {
                                  color: '#ff6b6b',
                                  opacity: 0,
                              },
                              symbol: 'none',
                              animation: false,
                              smooth: false,
                          },
                      ]
                    : []),
            ],
        }

        // Wait for chart initialization then set option
        setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.setOption(option)
                this.showChartState('chart')
            }
        }, 100)
    },

    calculatePercentilesFromHistogram: function (
        binCenters,
        counts,
        totalCount
    ) {
        // Calculate cumulative distribution
        const cumulative = []
        let sum = 0
        for (let i = 0; i < counts.length; i++) {
            sum += counts[i]
            cumulative.push(sum)
        }

        // Find percentile values
        const findPercentile = (p) => {
            const target = totalCount * p
            for (let i = 0; i < cumulative.length; i++) {
                if (cumulative[i] >= target) {
                    return binCenters[i].toFixed(2)
                }
            }
            return null
        }

        return {
            p25: findPercentile(0.25),
            p50: findPercentile(0.5),
            p75: findPercentile(0.75),
        }
    },

    calculateNormalDistribution: function (
        binCenters,
        mean,
        std,
        totalCount,
        binWidth
    ) {
        if (!mean || !std || std === 0) {
            return []
        }

        const normalCurve = []
        const scaleFactor = totalCount * binWidth // Scale to match histogram area

        for (let i = 0; i < binCenters.length; i++) {
            const x = binCenters[i]
            const z = (x - mean) / std
            const y =
                (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z)
            normalCurve.push((y * scaleFactor).toFixed(1))
        }

        return normalCurve
    },

    displayHistogramStats: function (
        stats,
        totalCount,
        excludingZeros = false
    ) {
        if (!stats || Object.keys(stats).length === 0) {
            $('#analysisStatsPanel').hide()
            return
        }

        let html = '<div class="analysisStatsTitle">'
        if (excludingZeros) {
            html +=
                'Statistics <span class="analysisStatsNote">(excluding 0 values)</span>'
        } else {
            html += 'Statistics'
        }
        html += '</div>'

        html += '<div class="analysisStatsGrid">'

        if (stats.mean !== null && stats.mean !== undefined) {
            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Mean:</span>'
            html += `<span class="analysisStatValue">${stats.mean.toFixed(
                3
            )}</span>`
            html += '</div>'
        }

        if (stats.median !== null && stats.median !== undefined) {
            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Median:</span>'
            html += `<span class="analysisStatValue">${stats.median.toFixed(
                3
            )}</span>`
            html += '</div>'
        }

        if (stats.std !== null && stats.std !== undefined) {
            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Std Dev:</span>'
            html += `<span class="analysisStatValue">${stats.std.toFixed(
                3
            )}</span>`
            html += '</div>'
        }

        if (
            stats.min !== null &&
            stats.min !== undefined &&
            stats.max !== null &&
            stats.max !== undefined
        ) {
            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Min:</span>'
            html += `<span class="analysisStatValue">${stats.min.toFixed(
                2
            )}</span>`
            html += '</div>'

            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Max:</span>'
            html += `<span class="analysisStatValue">${stats.max.toFixed(
                2
            )}</span>`
            html += '</div>'
        }

        if (totalCount) {
            html += '<div class="analysisStatItem">'
            html += '<span class="analysisStatLabel">Samples:</span>'
            html += `<span class="analysisStatValue">${totalCount.toLocaleString()}</span>`
            html += '</div>'
        }

        html += '</div>'

        $('#analysisStatsPanel').html(html).show()
    },

    showError: function (message, clearStats = false) {
        $('#analysisErrorMessage').text(message)
        if (clearStats) {
            $('#analysisStatsPanel').empty().hide() // Clear and hide statistics panel
        }
        this.showChartState('error')
    },
}

//
function interfaceWithMMGIS(fromInit) {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    var tools = d3.select('#toolPanel')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    if (fromInit) tools.style('display', 'none')
    //Add the markup to tools or do it manually
    tools.html(markup)

    Help.finalize(helpKey)

    // Initialize time inputs with current TimeControl values
    $('#analysisStartTime').val(TimeControl.getStartTime())
    $('#analysisEndTime').val(TimeControl.getEndTime())

    // Set up time input event handlers for bidirectional sync
    $('#analysisStartTime').on('change', function () {
        const startTime = $(this).val()
        const endTime = TimeControl.getEndTime()
        try {
            // Validate time format
            if (startTime && new Date(startTime).toISOString()) {
                TimeControl.setTime(startTime, endTime)
            } else {
                throw new Error('Invalid time format')
            }
        } catch (e) {
            console.warn('Invalid start time format:', startTime)
            // Reset to current value on error
            $(this).val(TimeControl.getStartTime())
        }
    })

    $('#analysisEndTime').on('change', function () {
        const startTime = TimeControl.getStartTime()
        const endTime = $(this).val()
        try {
            // Validate time format
            if (endTime && new Date(endTime).toISOString()) {
                TimeControl.setTime(startTime, endTime)
            } else {
                throw new Error('Invalid time format')
            }
        } catch (e) {
            console.warn('Invalid end time format:', endTime)
            // Reset to current value on error
            $(this).val(TimeControl.getEndTime())
        }
    })

    // Set up dual time range toggle handler
    $('#analysisDualTimeRangeCheckbox').on('click', function () {
        AnalysisTool.dualTimeRangeEnabled = !AnalysisTool.dualTimeRangeEnabled

        // Toggle checkbox visual state
        $(this).find('.checkbox').toggleClass('on')

        // Show/hide second time range inputs
        if (AnalysisTool.dualTimeRangeEnabled) {
            $('#analysisTimeRange2Inputs').show()
            // Initialize with default values if empty
            if (!$('#analysisStartTime2').val()) {
                $('#analysisStartTime2').val(TimeControl.getStartTime())
            }
            if (!$('#analysisEndTime2').val()) {
                $('#analysisEndTime2').val(TimeControl.getEndTime())
            }
        } else {
            $('#analysisTimeRange2Inputs').hide()
        }
    })

    // Set up time range 2 input event handlers
    $('#analysisStartTime2, #analysisEndTime2').on('change', function () {
        const value = $(this).val()
        try {
            // Validate time format
            if (value && new Date(value).toISOString()) {
                // Valid time, no action needed (not synced with TimeControl)
            } else {
                throw new Error('Invalid time format')
            }
        } catch (e) {
            console.warn('Invalid time format:', value)
            // Reset to current value on error
            $(this).val(TimeControl.getEndTime())
        }
    })

    // Set up data mode selection handler
    $('#analysisDataModeSelect').on('change', function () {
        const mode = $(this).val()
        AnalysisTool.setMode(mode)

        // Show/hide property selector vs Y-axis layer selector based on mode
        const chartType = $('#analysisChartTypeSelect').val()
        if (chartType === 'scatterplot') {
            if (mode === 'vectorpoints') {
                // Vector points: show property selector, hide Y-axis layer
                $('#analysisLayerYContainer').hide()
                $('.analysisPropertySelect').show()

                // Populate property selector if points are selected
                if (
                    AnalysisTool.vectorPointsDrawing.selectedPoints.length > 0
                ) {
                    AnalysisTool.populatePropertySelector()
                }
            } else {
                // Other modes: show Y-axis layer selector, hide property selector
                $('.analysisPropertySelect').hide()
                $('#analysisLayerYContainer').show()

                // Populate Y-axis layer dropdown if not already done
                if ($('#analysisLayerSelectY option').length <= 1) {
                    const dropdown = $('#analysisLayerSelectY')
                    dropdown.empty()
                    dropdown.append(
                        '<option value="">Select Y-axis layer...</option>'
                    )
                    Object.keys(AnalysisTool.availableLayers).forEach(
                        (layerName) => {
                            dropdown.append(
                                `<option value="${layerName}">${layerName}</option>`
                            )
                        }
                    )
                }
            }
        }

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up coordinate input handlers for manual entry (point mode)
    $('#analysisLng, #analysisLat').on('change', function () {
        const lng = parseFloat($('#analysisLng').val())
        const lat = parseFloat($('#analysisLat').val())
        if (!isNaN(lng) && !isNaN(lat)) {
            // Valid coordinates entered manually

            // Remove previous point marker if it exists
            if (AnalysisTool.pointMarker) {
                Map_.map.removeLayer(AnalysisTool.pointMarker)
            }

            // Add new orange point marker for manually entered coordinates
            AnalysisTool.pointMarker = L.circleMarker([lat, lng], {
                color: '#000000',
                fillColor: '#ff0000',
                fillOpacity: 1,
                radius: 6,
                weight: 2,
                opacity: 1,
            }).addTo(Map_.map)
        }
    })

    // Bbox input handlers removed - bbox is now drawn on map only

    // Set up Generate Analysis button
    $('#analysisGenerateBtn').on('click', function () {
        AnalysisTool.generateAnalysis()
    })

    // Set up Retry button
    $('#analysisRetryBtn').on('click', function () {
        AnalysisTool.generateAnalysis()
    })

    // Set up Layer selection change handler
    $('#analysisLayerSelect').on('change', function () {
        const selectedLayer = $(this).val()
        if (selectedLayer) {
            AnalysisTool.selectLayer(selectedLayer)
        }
    })

    // Set up Y-Axis Layer selection change handler (for scatterplot)
    $('#analysisLayerSelectY').on('change', function () {
        AnalysisTool.selectedLayerY = $(this).val()
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up Chart Type selection change handler to show/hide controls
    $('#analysisChartTypeSelect').on('change', function () {
        const chartType = $(this).val()

        if (!chartType) {
            // Hide data section if no chart type
            $('#analysisDataSection').hide()
            return
        }

        // Show data section and filter dropdown options based on chart type
        $('#analysisDataSection').show()
        AnalysisTool.filterDataSelectionOptions(chartType)

        // Clear stats panel when switching chart types (to prevent histogram stats from showing on non-histogram charts)
        $('#analysisStatsPanel').empty().hide()

        // Show/hide chart-specific controls
        if (chartType === 'histogram') {
            $('#analysisBinsControl').show()
            $('#analysisLineSubdivisionsControl').hide()
            $('#analysisLayerYContainer').hide()
            $('.analysisPropertySelect').hide()
        } else if (chartType === 'scatterplot') {
            $('#analysisBinsControl').hide()
            // Show subdivisions control if line mode is selected
            const currentMode = $('#analysisDataModeSelect').val()
            if (currentMode === 'line') {
                $('#analysisLineSubdivisionsControl').show()
            } else {
                $('#analysisLineSubdivisionsControl').hide()
            }
            // Y-axis layer or property selector will be shown based on data selection mode
            // Check current mode to show appropriate selector
            if (currentMode === 'vectorpoints') {
                $('#analysisLayerYContainer').hide()
                $('.analysisPropertySelect').show()
                if (
                    AnalysisTool.vectorPointsDrawing.selectedPoints.length > 0
                ) {
                    AnalysisTool.populatePropertySelector()
                }
            } else {
                $('#analysisLayerYContainer').show()
                $('.analysisPropertySelect').hide()

                // Populate Y-axis layer dropdown if not already done
                if ($('#analysisLayerSelectY option').length <= 1) {
                    const dropdown = $('#analysisLayerSelectY')
                    dropdown.empty()
                    dropdown.append(
                        '<option value="">Select Y-axis layer...</option>'
                    )
                    Object.keys(AnalysisTool.availableLayers).forEach(
                        (layerName) => {
                            dropdown.append(
                                `<option value="${layerName}">${layerName}</option>`
                            )
                        }
                    )
                }
            }
        } else {
            $('#analysisBinsControl').hide()
            $('#analysisLineSubdivisionsControl').hide()
            $('#analysisLayerYContainer').hide()
            $('.analysisPropertySelect').hide()
        }

        // Update button state
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up Clear Bbox button
    $('#analysisClearBboxBtn').on('click', function () {
        AnalysisTool.clearBboxRectangle()
        // Update button state
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up Clear Vector Points button
    $('#analysisClearVectorPointsBtn').on('click', function () {
        AnalysisTool.clearVectorPointsSelection()
        // Update button state
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up Clear Line button
    $('#analysisClearLineBtn').on('click', function () {
        AnalysisTool.clearLineFromMap()
    })

    // Set up Line input change handlers
    $(
        '#analysisLineStartLat, #analysisLineStartLng, #analysisLineEndLat, #analysisLineEndLng'
    ).on('input', function () {
        AnalysisTool.updateGenerateButtonState()
    })

    // Set up Property selector change handler
    $('#analysisPropertySelect').on('change', function () {
        AnalysisTool.updateGenerateButtonState()
    })

    // Initialize with default mode
    AnalysisTool.setMode('point')

    // Initialize chart type to trigger data section and button state
    const defaultChartType = $('#analysisChartTypeSelect').val()
    if (defaultChartType) {
        $('#analysisDataSection').show()
        AnalysisTool.filterDataSelectionOptions(defaultChartType)
        AnalysisTool.updateGenerateButtonState()
    }

    // Subscribe to TimeControl changes like SightlineTool does
    TimeControl.subscribe('AnalysisTool', (t) => {
        AnalysisTool.timeChange()
    })

    // Initialize layers
    AnalysisTool.fetchLayers().catch((error) => {
        console.error('Failed to initialize layers:', error)
    })

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        // Clean up all map handlers (including bbox drawing)
        AnalysisTool.cleanupMapHandlers()

        // Clean up chart instance
        if (AnalysisTool.chartInstance) {
            AnalysisTool.chartInstance.dispose()
            AnalysisTool.chartInstance = null
        }

        // Clean up resize handlers
        if (AnalysisTool.resizeHandler) {
            window.removeEventListener('resize', AnalysisTool.resizeHandler)
            AnalysisTool.resizeHandler = null
        }

        if (AnalysisTool.resizeObserver) {
            AnalysisTool.resizeObserver.disconnect()
            AnalysisTool.resizeObserver = null
        }

        // Unsubscribe from TimeControl
        TimeControl.unsubscribe('AnalysisTool')
    }
}

//Other functions

export default AnalysisTool
