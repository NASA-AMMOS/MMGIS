import $ from 'jquery'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

import './SegmentTool.css'

// Tool Markup
// prettier-ignore
const markup = [
    "<div id='segmentTool'>",
    " <div id='segmentToolHeader'>",
    "    <div class='left'>",
    "      <div id='segmentToolTitle'>Segment</div>",
    '    </div>',
    "    <div class='right'>",
    '    </div>',
    ' </div>',
    " <div id='segmentToolBody'>",
    "  <div id='segmentToolControls'>",
    "    <!-- Mode selector -->",
    "    <div id='segmentToolModeSelector'>",
    '      <label>Mode:</label>',
    "      <select id='segmentToolMode' class='dropy'>",
    "        <option value='text'>Text Prompt</option>",
    "        <option value='boxes'>Bounding Boxes</option>",
    "        <option value='points'>Point Prompts</option>",
    '      </select>',
    '    </div>',
    "    <div id='segmentToolModeDescription'>",
    '      Use natural language to describe features to segment (e.g., "rocks", "buildings").',
    '    </div>',
    '',
    '',
    '    <!-- Text mode input -->',
    "    <div id='segmentToolPromptContainer' data-mode='text'>",
    '      <label>Text Prompt:</label>',
    "      <input type='text' id='segmentToolPrompt' placeholder='e.g., buildings, rocks, roads' />",
    '    </div>',
    '',
    '    <!-- Boxes mode UI -->',
    "    <div id='segmentToolBoxesContainer' data-mode='boxes' style='display: none;'>",
    '      <label>Click map to draw bounding boxes</label>',
    "      <div id='segmentToolBoxesList'></div>",
    '    </div>',
    '',
    '    <!-- Points mode UI -->',
    "    <div id='segmentToolPointsContainer' data-mode='points' style='display: none;'>",
    '      <label>Click map to add points</label>',
    "      <div id='segmentToolPointLabelToggle'>",
    "        <button id='segmentToolForegroundBtn' class='active'>Foreground (+)</button>",
    "        <button id='segmentToolBackgroundBtn'>Background (-)</button>",
    '      </div>',
    "      <div id='segmentToolPointsList'></div>",
    '    </div>',
    '',
    "    <!-- Resolution selector -->",
    "    <div id='segmentToolResolutionSelector'>",
    '      <label>Resolution:</label>',
    "      <select id='segmentToolResolution' class='dropy'>",
    "        <option value='full'>Full</option>",
    "        <option value='medium' selected>Medium</option>",
    "        <option value='small'>Low</option>",
    '      </select>',
    '    </div>',
    '',
    "    <!-- Color palette -->",
    "    <div id='segmentToolColorPalette'>",
    '      <label>Result Color:</label>',
    "      <div id='segmentToolColorPaletteCircles'>",
    "        <div class='segmentToolColorCircle' data-color='#000000' style='background: #000000'></div>",
    "        <div class='segmentToolColorCircle' data-color='#FFFFFF' style='background: #FFFFFF'></div>",
    "        <div class='segmentToolColorCircle' data-color='#FF0000' style='background: #FF0000'></div>",
    "        <div class='segmentToolColorCircle active' data-color='#FF6B35' style='background: #FF6B35'></div>",
    "        <div class='segmentToolColorCircle' data-color='#FFFF00' style='background: #FFFF00'></div>",
    "        <div class='segmentToolColorCircle' data-color='#00FF00' style='background: #00FF00'></div>",
    "        <div class='segmentToolColorCircle' data-color='#00BFFF' style='background: #00BFFF'></div>",
    "        <div class='segmentToolColorCircle' data-color='#FF00FF' style='background: #FF00FF'></div>",
    "      </div>",
    '    </div>',
    '',
    "    <!-- Confidence threshold -->",
    "    <div id='segmentToolConfidenceSlider'>",
    '      <label>Confidence: <span id="segmentToolConfidenceValue"></span></label>',
    "      <input type='range' id='segmentToolConfidence' class='slider2' min='0' max='100' value='50' step='1' />",
    '    </div>',
    '',
    "    <div id='segmentToolButtons'>",
    "      <button id='segmentToolSubmit' class='segmentToolButton'>Submit</button>",
    "      <button id='segmentToolClear' class='segmentToolButton'>Clear Results</button>",
    '    </div>',
    "    <div id='segmentToolStatus'>",
    "      <div id='segmentToolStatusIcon' class='ready'><i class='mdi mdi-information-outline mdi-18px'></i></div>",
    "      <div id='segmentToolStatusText'>Ready</div>",
    '    </div>',
    '  </div>',
    "  <div id='segmentToolResults'>",
    "    <div id='segmentToolResultsTitle'>Results</div>",
    "    <div id='segmentToolResultsContent'>No segments yet</div>",
    '  </div>',
    " </div>",
    " <div id='segmentToolAttribution'>",
    "   Powered by <a href='https://github.com/facebookresearch/sam3/tree/main?tab=License-1-ov-file#readme' target='_blank'>SAM3</a>",
    ' </div>',
    '</div>',
].join('\n')

const SegmentTool = {
    height: 0,
    width: 300,
    MMGISInterface: null,
    vars: {},
    overlayLayer: null,
    capturedBounds: null,
    canvasWidth: 0,
    canvasHeight: 0,
    canvasScale: 1,
    currentMode: 'text',
    currentResolution: 'medium',
    capturedCanvas: null,
    polling_ms: 5000,
    drawingHandler: null,
    boxes: [],
    boxLayers: [],
    points: [],
    pointLabels: [],
    pointMarkers: [],
    currentPointLabel: 1,
    resultColor: '#FF6B35', // User-selected color for result polygons
    confidenceThreshold: 0.5, // User-selected confidence threshold

    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()

        // Get configuration variables
        const toolVars = L_.getToolVars('segmenttool') || {}
        this.vars = {
            sam3_server_url:
                toolVars.sam3_server_url || 'http://localhost:8115',
            confidence_threshold: toolVars.confidence_threshold || 0.5,
            default_timeout: toolVars.default_timeout || 600000,
        }
    },

    destroy: function () {
        // Clean up mode handlers first (disables drawing, removes event listeners)
        if (this.MMGISInterface && this.MMGISInterface.cleanupModeHandlers) {
            this.MMGISInterface.cleanupModeHandlers()
        }

        // Clear overlay and canvas
        this.clearOverlay()
        this.capturedCanvas = null

        // Clear mode data and remove layers
        this.boxes = []
        this.boxLayers.forEach((l) => Map_.map.removeLayer(l))
        this.boxLayers = []
        this.points = []
        this.pointLabels = []
        this.pointMarkers.forEach((m) => Map_.map.removeLayer(m))
        this.pointMarkers = []

        // Ensure map dragging is re-enabled
        if (Map_.map && Map_.map.dragging) {
            Map_.map.dragging.enable()
        }

        // Finally separate from MMGIS
        this.MMGISInterface.separateFromMMGIS()
    },

    getUrlString: function () {
        return ''
    },

    clearOverlay: function () {
        if (this.overlayLayer && Map_.map.hasLayer(this.overlayLayer)) {
            Map_.map.removeLayer(this.overlayLayer)
        }
        this.overlayLayer = null
    },
}

function interfaceWithMMGIS() {
    // Tool initialization
    const tools = $('#toolPanel')
    tools.css('background', 'transparent')
    tools.empty()
    tools.html('<div style="height: 100%">' + markup + '</div>')

    // Set default confidence indicator
    $('#segmentToolConfidenceValue').text(
        `>${SegmentTool.confidenceThreshold.toFixed(2)}`
    )
    $('#segmentToolConfidence').val(SegmentTool.confidenceThreshold * 100)

    // Event handlers
    setupEventHandlers()

    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    this.cleanupModeHandlers = function () {
        cleanupModeHandlers()
    }

    function setupEventHandlers() {
        // Submit button click
        $('#segmentToolSubmit').on('click', handleSubmit)

        // Clear button click
        $('#segmentToolClear').on('click', () => {
            // Clear results overlay
            SegmentTool.clearOverlay()

            // Clear mode-specific data
            if (SegmentTool.currentMode === 'boxes') {
                SegmentTool.boxes = []
                SegmentTool.boxLayers.forEach((l) => Map_.map.removeLayer(l))
                SegmentTool.boxLayers = []
                updateBoxesList()

                // Properly cleanup and reinitialize to avoid duplicate event listeners
                cleanupBoxesMode()
                initializeBoxesMode()
            } else if (SegmentTool.currentMode === 'points') {
                SegmentTool.points = []
                SegmentTool.pointLabels = []
                SegmentTool.pointMarkers.forEach((m) => Map_.map.removeLayer(m))
                SegmentTool.pointMarkers = []
                updatePointsList()
            }

            updateStatus('Ready', 'ready')
            $('#segmentToolResultsContent').text('No segments yet')
        })

        // Enter key in prompt field
        $('#segmentToolPrompt').on('keypress', (e) => {
            if (e.which === 13) {
                // Enter key
                handleSubmit()
            }
        })

        // Mode change handler
        $('#segmentToolMode').on('change', handleModeChange)

        // Resolution change handler
        $('#segmentToolResolution').on('change', function () {
            SegmentTool.currentResolution = $(this).val()
        })

        // Color palette handler
        $('.segmentToolColorCircle').on('click', function () {
            const color = $(this).attr('data-color')

            // Update active state
            $('.segmentToolColorCircle').removeClass('active')
            $(this).addClass('active')

            // Update stored color
            SegmentTool.resultColor = color

            // Re-style existing overlay if present
            if (SegmentTool.overlayLayer) {
                SegmentTool.overlayLayer.setStyle({
                    color: color,
                    fillColor: color,
                })
            }
        })

        // Confidence slider handler
        $('#segmentToolConfidence').on('input', function () {
            const value = $(this).val() / 100 // Convert 0-100 to 0.0-1.0
            SegmentTool.confidenceThreshold = value
            $('#segmentToolConfidenceValue').text(`>${value.toFixed(2)}`)
        })

        // Point label toggle handlers
        $('#segmentToolForegroundBtn').on('click', () => {
            SegmentTool.currentPointLabel = 1
            $('#segmentToolForegroundBtn').addClass('active')
            $('#segmentToolBackgroundBtn').removeClass('active')
        })

        $('#segmentToolBackgroundBtn').on('click', () => {
            SegmentTool.currentPointLabel = 0
            $('#segmentToolBackgroundBtn').addClass('active')
            $('#segmentToolForegroundBtn').removeClass('active')
        })
    }

    function handleModeChange() {
        const newMode = $('#segmentToolMode').val()
        SegmentTool.currentMode = newMode

        // Update mode description
        const descriptions = {
            text: 'Use natural language to describe features to segment (e.g., "rocks", "buildings").',
            boxes: 'Draw bounding boxes on the map to define, by example, regions to segment.',
            points: 'Click points on the map to foreground regions to segment and background others.',
        }
        $('#segmentToolModeDescription').text(descriptions[newMode])

        // Hide all mode containers
        $('#segmentToolPromptContainer').hide()
        $('#segmentToolBoxesContainer').hide()
        $('#segmentToolPointsContainer').hide()

        // Show selected mode container
        $(`[data-mode="${newMode}"]`).show()

        // Clean up any active handlers
        cleanupModeHandlers()

        // Initialize new mode
        initializeMode(newMode)
    }

    function handleSubmit() {
        const mode = SegmentTool.currentMode

        // Validation based on mode
        if (mode === 'text') {
            const prompt = $('#segmentToolPrompt').val().trim()
            if (!prompt) {
                updateStatus('Error: Please enter a prompt', 'error')
                return
            }
        } else if (mode === 'boxes') {
            if (SegmentTool.boxes.length === 0) {
                updateStatus('Error: Please draw at least one box', 'error')
                return
            }
        } else if (mode === 'points') {
            if (SegmentTool.points.length === 0) {
                updateStatus('Error: Please click at least one point', 'error')
                return
            }
        }

        // Check if any tile layers are visible
        const visibleTileLayers = getVisibleTileLayers()
        if (visibleTileLayers.length === 0) {
            updateStatus('Error: No tile layers visible', 'error')
            return
        }

        // Capture canvas if not already captured (or force re-capture for text mode)
        updateStatus('Capturing tiles...', 'loading')

        const capturePromise =
            mode === 'text' || !SegmentTool.capturedCanvas
                ? captureTilesToCanvas()
                : Promise.resolve(SegmentTool.capturedCanvas)

        capturePromise
            .then((canvas) => {
                updateStatus('Uploading to SAM3...', 'loading')

                // Build params based on mode
                let params = {}
                if (mode === 'text') {
                    params.prompt = $('#segmentToolPrompt').val().trim()
                } else if (mode === 'boxes') {
                    // Transform lat/lng boxes to canvas pixel coordinates
                    params.boxes = SegmentTool.boxes.map((box) => {
                        const nw = transformLatLngToPixels(box.nw)
                        const se = transformLatLngToPixels(box.se)
                        return [nw.x, nw.y, se.x, se.y]
                    })
                } else if (mode === 'points') {
                    // Transform lat/lng points to canvas pixel coordinates
                    params.point_coords = SegmentTool.points.map((latLng) => {
                        const pixel = transformLatLngToPixels(latLng)
                        return [pixel.x, pixel.y]
                    })
                    params.point_labels = SegmentTool.pointLabels
                }

                return submitToSAM3(canvas, mode, params)
            })
            .then((taskId) => {
                updateStatus(
                    'Processing (this may take a minute)...',
                    'loading'
                )
                return pollForResult(taskId)
            })
            .then((result) => {
                if (!result || !result.geojson) {
                    throw new Error('Invalid result from SAM3')
                }
                updateStatus('Transforming coordinates...', 'loading')
                return transformPixelsToLatLng(result.geojson)
            })
            .then((geojson) => {
                updateStatus('Displaying results...', 'loading')
                displayPolygonsOnMap(geojson)
                const count = geojson.features.length
                updateStatus(
                    `Success: ${count} segment${count !== 1 ? 's' : ''} found`,
                    'success'
                )
            })
            .catch((err) => {
                console.error('SegmentTool error:', err)
                updateStatus(`Error: ${err.message}`, 'error')
            })
    }

    function getVisibleTileLayers() {
        const tileLayers = []

        for (let uuid in L_.layers.on) {
            if (L_.layers.on[uuid] === true) {
                const layerData = L_.layers.data[uuid]

                // Only process tile layers (not vector, model, etc.)
                if (layerData.type === 'tile') {
                    tileLayers.push({
                        uuid: uuid,
                        name: layerData.name,
                        url: L_.getUrl(
                            layerData.type,
                            layerData.url,
                            layerData
                        ),
                        maxNativeZoom: layerData.maxNativeZoom,
                        tileformat: layerData.tileformat || 'tms',
                    })
                }
            }
        }

        return tileLayers
    }

    function captureTilesToCanvas() {
        return new Promise((resolve, reject) => {
            const tileLayers = getVisibleTileLayers()

            if (tileLayers.length === 0) {
                reject(new Error('No visible tile layers'))
                return
            }

            // Get all visible tile coordinates
            const tileCoords = Map_.getCurrentTileXYZs()

            if (tileCoords.length === 0) {
                reject(new Error('No tiles in view'))
                return
            }

            // Calculate canvas dimensions based on tile grid
            const tileSize = 256
            const minX = Math.min(...tileCoords.map((t) => t.x))
            const maxX = Math.max(...tileCoords.map((t) => t.x))
            const minY = Math.min(...tileCoords.map((t) => t.y))
            const maxY = Math.max(...tileCoords.map((t) => t.y))

            // Use the actual tile zoom (integer), not fractional map zoom
            const tileZoom = tileCoords[0].z

            // Store tile grid bounds for coordinate transformation
            // Calculate geographic bounds of the tile grid
            SegmentTool.capturedBounds = {
                tileZoom: tileZoom,
                minX: minX,
                maxX: maxX,
                minY: minY,
                maxY: maxY,
                tileSize: tileSize,
            }

            SegmentTool.canvasWidth = (maxX - minX + 1) * tileSize
            SegmentTool.canvasHeight = (maxY - minY + 1) * tileSize

            // Create canvas
            const canvas = document.createElement('canvas')
            canvas.width = SegmentTool.canvasWidth
            canvas.height = SegmentTool.canvasHeight
            const ctx = canvas.getContext('2d')

            // Fill with white background
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Track loading progress
            let loadedCount = 0
            const totalImages = tileCoords.length * tileLayers.length

            // Load all tiles from all layers
            tileLayers.forEach((layer, layerIdx) => {
                tileCoords.forEach((coord, tileIdx) => {
                    const image = new Image()
                    image.crossOrigin = 'anonymous'

                    image.onload = function () {
                        // Calculate position on canvas
                        const canvasX = (coord.x - minX) * tileSize
                        const canvasY = (coord.y - minY) * tileSize

                        // Draw tile (with alpha blending for multiple layers)
                        if (tileLayers.length > 1) {
                            ctx.globalAlpha = 1.0 / tileLayers.length
                        }
                        ctx.drawImage(
                            image,
                            canvasX,
                            canvasY,
                            tileSize,
                            tileSize
                        )
                        ctx.globalAlpha = 1.0

                        loadedCount++

                        // All tiles loaded
                        if (loadedCount === totalImages) {
                            SegmentTool.capturedCanvas = canvas
                            resolve(canvas)
                        }
                    }

                    image.onerror = function () {
                        console.warn(
                            `Failed to load tile: ${layer.name} at ${coord.z}/${coord.x}/${coord.y}`
                        )
                        loadedCount++

                        // Continue even if some tiles fail
                        if (loadedCount === totalImages) {
                            SegmentTool.capturedCanvas = canvas
                            resolve(canvas)
                        }
                    }

                    // Build tile URL
                    let tileUrl = layer.url
                        .replace('{z}', coord.z)
                        .replace('{x}', coord.x)
                        .replace('{y}', coord.y)

                    // Handle TMS format (inverted Y)
                    if (layer.tileformat === 'tms') {
                        const tmsY = Math.pow(2, coord.z) - 1 - coord.y
                        tileUrl = layer.url
                            .replace('{z}', coord.z)
                            .replace('{x}', coord.x)
                            .replace('{y}', tmsY)
                    }

                    image.src = tileUrl
                })
            })

            // Timeout after 30 seconds
            setTimeout(() => {
                if (loadedCount < totalImages) {
                    console.warn(
                        `Timeout: Only loaded ${loadedCount}/${totalImages} tiles`
                    )
                    if (loadedCount > 0) {
                        SegmentTool.capturedCanvas = canvas
                        resolve(canvas)
                    } else {
                        reject(new Error('Timeout loading tiles'))
                    }
                }
            }, 30000)
        })
    }

    function resizeCanvas(canvas, resolution) {
        // If full resolution, return original canvas unchanged
        if (resolution === 'full') {
            return { canvas: canvas, scale: 1 }
        }

        // Determine target size based on resolution
        const targetSize = resolution === 'medium' ? 1024 : 512
        const longestDimension = Math.max(canvas.width, canvas.height)

        // No resize needed if already smaller than target
        if (longestDimension <= targetSize) {
            return { canvas: canvas, scale: 1 }
        }

        // Calculate new dimensions maintaining aspect ratio
        const scale = targetSize / longestDimension
        const newWidth = Math.round(canvas.width * scale)
        const newHeight = Math.round(canvas.height * scale)

        // Create new canvas with resized dimensions
        const resizedCanvas = document.createElement('canvas')
        resizedCanvas.width = newWidth
        resizedCanvas.height = newHeight

        const ctx = resizedCanvas.getContext('2d')
        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Draw original canvas scaled to new size
        ctx.drawImage(canvas, 0, 0, newWidth, newHeight)

        return { canvas: resizedCanvas, scale: scale }
    }

    function submitToSAM3(canvas, mode, params) {
        return new Promise((resolve, reject) => {
            // Determine endpoint based on mode
            const endpoints = {
                text: '/api/v1/segment/text',
                boxes: '/api/v1/segment/boxes', // Future
                points: '/api/v1/segment/points', // Future
            }

            const endpoint = endpoints[mode]
            if (!endpoint) {
                reject(new Error(`Unknown mode: ${mode}`))
                return
            }

            // Resize canvas based on resolution setting
            const { canvas: resizedCanvas, scale } = resizeCanvas(
                canvas,
                SegmentTool.currentResolution
            )

            // Store scale factor for coordinate transformation later
            SegmentTool.canvasScale = scale

            // Scale coordinates if canvas was resized (for boxes and points modes)
            if (scale !== 1) {
                if (mode === 'boxes' && params.boxes) {
                    params.boxes = params.boxes.map((box) =>
                        box.map((coord) => Math.round(coord * scale))
                    )
                } else if (mode === 'points' && params.point_coords) {
                    params.point_coords = params.point_coords.map((coord) => [
                        Math.round(coord[0] * scale),
                        Math.round(coord[1] * scale),
                    ])
                }
            }

            // Convert canvas to blob
            resizedCanvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to convert canvas to image'))
                    return
                }

                // Create FormData
                const formData = new FormData()
                formData.append('file', blob, 'map_capture.jpg')

                // Build data payload based on mode
                let data = {
                    confidence_threshold: SegmentTool.confidenceThreshold,
                }

                if (mode === 'text') {
                    data.prompt = params.prompt
                } else if (mode === 'boxes') {
                    data.boxes = params.boxes // [[xmin,ymin,xmax,ymax], ...]
                } else if (mode === 'points') {
                    data.point_coords = params.point_coords // [[x,y], ...]
                    data.point_labels = params.point_labels // [1, 0, 1, ...]
                }

                formData.append('data', JSON.stringify(data))

                // Submit to SAM3 API
                const url = `${SegmentTool.vars.sam3_server_url}${endpoint}`

                fetch(url, {
                    method: 'POST',
                    body: formData,
                })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(
                                `SAM3 API error: ${response.status} ${response.statusText}`
                            )
                        }
                        return response.json()
                    })
                    .then((data) => {
                        if (!data.task_id) {
                            throw new Error('SAM3 API did not return task_id')
                        }
                        resolve(data.task_id)
                    })
                    .catch((err) => {
                        reject(
                            new Error(
                                `Failed to submit to SAM3: ${err.message}`
                            )
                        )
                    })
            }, 'image/jpeg')
        })
    }

    function pollForResult(taskId) {
        return new Promise((resolve, reject) => {
            const statusUrl = `${SegmentTool.vars.sam3_server_url}/api/v1/tasks/${taskId}`
            const resultUrl = `${SegmentTool.vars.sam3_server_url}/api/v1/tasks/${taskId}/result`
            const startTime = Date.now()

            function pollStatus() {
                // Check timeout
                if (Date.now() - startTime > SegmentTool.vars.default_timeout) {
                    reject(new Error('Timeout waiting for SAM3 result'))
                    return
                }

                // Poll the status endpoint (without /result)
                fetch(statusUrl)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Poll error: ${response.status}`)
                        }
                        return response.json()
                    })
                    .then((statusData) => {
                        if (
                            statusData.status === 'SUCCESS' &&
                            statusData.ready
                        ) {
                            // Task completed, now fetch the result
                            fetchResult()
                        } else if (statusData.status === 'FAILURE') {
                            reject(new Error('SAM3 processing failed'))
                        } else {
                            // Still processing (PENDING or PROCESSING), poll again in 2 seconds
                            setTimeout(pollStatus, SegmentTool.polling_ms)
                        }
                    })
                    .catch((err) => {
                        reject(new Error(`Polling failed: ${err.message}`))
                    })
            }

            function fetchResult() {
                fetch(resultUrl)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(
                                `Result fetch error: ${response.status}`
                            )
                        }
                        return response.json()
                    })
                    .then((resultData) => {
                        if (resultData.success && resultData.geojson) {
                            resolve(resultData)
                        } else if (resultData.error) {
                            reject(
                                new Error(
                                    `SAM3 result error: ${resultData.error}`
                                )
                            )
                        } else {
                            reject(new Error('Invalid result data'))
                        }
                    })
                    .catch((err) => {
                        reject(
                            new Error(`Failed to fetch result: ${err.message}`)
                        )
                    })
            }

            // Start polling
            pollStatus()
        })
    }

    function transformPixelsToLatLng(geojson) {
        if (!SegmentTool.capturedBounds || !geojson || !geojson.features) {
            throw new Error('Invalid data for coordinate transformation')
        }

        const { tileZoom, minX, maxX, minY, maxY, tileSize } =
            SegmentTool.capturedBounds
        const canvasWidth = SegmentTool.canvasWidth
        const canvasHeight = SegmentTool.canvasHeight

        // Calculate pixel coordinates of the tile grid at tile zoom level
        // Tiles are in pixel space: tile (x,y) starts at pixel (x*256, y*256)
        const nwPixel = L.point(minX * tileSize, minY * tileSize)
        const sePixel = L.point((maxX + 1) * tileSize, (maxY + 1) * tileSize)

        // Transform function for a single coordinate
        function transformCoord(pixelCoord) {
            // pixelCoord is [x, y] in resized canvas space
            // Scale back to original canvas space if canvas was resized
            const scaledX = pixelCoord[0] / SegmentTool.canvasScale
            const scaledY = pixelCoord[1] / SegmentTool.canvasScale

            // Map to tile pixel space
            const tilePixelX = nwPixel.x + scaledX
            const tilePixelY = nwPixel.y + scaledY

            // Unproject from tile pixel space to lat/lng at tile zoom
            const latLng = Map_.map.unproject(
                [tilePixelX, tilePixelY],
                tileZoom
            )

            // Return as [lng, lat] for GeoJSON
            return [latLng.lng, latLng.lat]
        }

        // Deep clone and transform the GeoJSON
        const transformedGeoJSON = JSON.parse(JSON.stringify(geojson))

        transformedGeoJSON.features.forEach((feature) => {
            if (feature.geometry.type === 'Polygon') {
                feature.geometry.coordinates = feature.geometry.coordinates.map(
                    (ring) => ring.map((coord) => transformCoord(coord))
                )
            } else if (feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates = feature.geometry.coordinates.map(
                    (polygon) =>
                        polygon.map((ring) =>
                            ring.map((coord) => transformCoord(coord))
                        )
                )
            }
        })

        return transformedGeoJSON
    }

    function transformLatLngToPixels(latLng) {
        const { tileZoom, minX, minY, tileSize } = SegmentTool.capturedBounds

        // Calculate northwest pixel of tile grid
        const nwPixel = L.point(minX * tileSize, minY * tileSize)

        // Project lat/lng to tile pixel space at tile zoom
        const tilePixel = Map_.map.project(latLng, tileZoom)

        // Convert to canvas space (0,0 = canvas top-left)
        const canvasX = tilePixel.x - nwPixel.x
        const canvasY = tilePixel.y - nwPixel.y

        return { x: canvasX, y: canvasY }
    }

    function displayPolygonsOnMap(geojson) {
        // Clear previous overlay
        SegmentTool.clearOverlay()

        if (!geojson || !geojson.features || geojson.features.length === 0) {
            $('#segmentToolResultsContent').text('No segments detected')
            return
        }

        // Create Leaflet GeoJSON layer with user-selected color
        SegmentTool.overlayLayer = L.geoJSON(geojson, {
            style: function (feature) {
                // Use user-selected color for both border and fill
                const userColor = SegmentTool.resultColor
                return {
                    color: userColor,
                    weight: 2,
                    opacity: 0.8,
                    fillColor: userColor,
                    fillOpacity: 0.3,
                }
            },
            onEachFeature: function (feature, layer) {
                // Add popup with confidence score if available
                if (
                    feature.properties &&
                    feature.properties.confidence !== undefined
                ) {
                    const confidence = (
                        feature.properties.confidence * 100
                    ).toFixed(1)
                    layer.bindPopup(`
                        <div>
                            <strong>Confidence:</strong> ${confidence}%<br>
                            <strong>Object ID:</strong> ${
                                feature.properties.object_id || 'N/A'
                            }
                        </div>
                    `)
                }
            },
        })

        // Add to map
        SegmentTool.overlayLayer.addTo(Map_.map)

        // Update results panel
        const count = geojson.features.length
        const avgConfidence =
            geojson.features.length > 0
                ? (
                      (geojson.features.reduce(
                          (sum, f) => sum + (f.properties?.confidence || 0),
                          0
                      ) /
                          geojson.features.length) *
                      100
                  ).toFixed(1)
                : 0

        $('#segmentToolResultsContent').html(`
            <div><strong>${count}</strong> polygon${
            count !== 1 ? 's' : ''
        } detected</div>
            <div>Average confidence: <strong>${avgConfidence}%</strong></div>
            <div style="margin-top: 8px; font-size: 11px;">Click polygons for details</div>
        `)
    }

    function updateStatus(message, state) {
        $('#segmentToolStatusText').text(message)

        const icon = $('#segmentToolStatusIcon')
        icon.removeClass('loading success error ready')

        switch (state) {
            case 'loading':
                icon.addClass('loading')
                icon.html('<span class="segmentToolSpinner"></span>')
                $('#segmentToolSubmit').prop('disabled', true)
                break
            case 'success':
                icon.addClass('success')
                icon.html("<i class='mdi mdi-check-bold mdi-18px'></i>")
                $('#segmentToolSubmit').prop('disabled', false)
                break
            case 'error':
                icon.addClass('error')
                icon.html("<i class='mdi mdi-alert-outline mdi-18px'></i>")
                $('#segmentToolSubmit').prop('disabled', false)
                break
            case 'ready':
            default:
                icon.addClass('ready')
                icon.html(
                    "<i class='mdi mdi-information-outline mdi-18px'></i>"
                )
                $('#segmentToolSubmit').prop('disabled', false)
                break
        }
    }

    // Boxes mode functions
    function initializeBoxesMode() {
        // Initialize Leaflet rectangle drawing with distinct style from results
        SegmentTool.drawingHandler = new L.Draw.Rectangle(Map_.map, {
            shapeOptions: {
                color: '#2bff00',
                weight: 3,
                opacity: 1,
                fillColor: '#2bff00',
                fillOpacity: 0.1, // Very transparent (vs 0.3 for results)
                dashArray: '2, 4', // Dashed line
            },
        })

        SegmentTool.drawingHandler.enable()

        // Listen for rectangle creation
        Map_.map.on('draw:created', handleBoxDrawn)

        updateStatus('Click and drag on map to draw bounding box', 'ready')
    }

    function handleBoxDrawn(e) {
        const layer = e.layer
        const bounds = layer.getBounds()

        // Store lat/lng bounds (will transform to pixels on submit)
        const box = {
            nw: bounds.getNorthWest(),
            se: bounds.getSouthEast(),
        }
        SegmentTool.boxes.push(box)

        // Keep layer for display
        layer.addTo(Map_.map)
        SegmentTool.boxLayers.push(layer)

        // Update UI list
        updateBoxesList()

        // Properly disable old handler and reset map state before recreating
        if (SegmentTool.drawingHandler) {
            SegmentTool.drawingHandler.disable()
            // Ensure map dragging is re-enabled before creating new handler
            Map_.map.dragging.enable()
        }

        // Recreate and re-enable drawing handler for next box
        // (the new handler will disable map dragging when enabled)
        SegmentTool.drawingHandler = new L.Draw.Rectangle(Map_.map, {
            shapeOptions: {
                color: '#2bff00',
                weight: 3,
                opacity: 1,
                fillColor: '#2bff00',
                fillOpacity: 0.1, // Very transparent (vs 0.3 for results)
                dashArray: '2, 4', // Dashed line
            },
        })
        SegmentTool.drawingHandler.enable()
    }

    function updateBoxesList() {
        const html = SegmentTool.boxes
            .map(
                (box, i) => `
            <div class='segmentToolBoxItem'>
                Box ${i + 1}
                <button class='segmentToolRemoveBox' data-index='${i}'>×</button>
            </div>
        `
            )
            .join('')

        $('#segmentToolBoxesList').html(html || '<div>No boxes drawn yet</div>')

        // Add remove handlers
        $('.segmentToolRemoveBox').on('click', function () {
            const index = $(this).attr('data-index')
            removeBox(parseInt(index))
        })
    }

    function removeBox(index) {
        // Remove from arrays
        SegmentTool.boxes.splice(index, 1)

        // Remove layer from map
        const layer = SegmentTool.boxLayers.splice(index, 1)[0]
        Map_.map.removeLayer(layer)

        // Update UI
        updateBoxesList()
    }

    function cleanupBoxesMode() {
        // Disable drawing
        if (SegmentTool.drawingHandler) {
            SegmentTool.drawingHandler.disable()
            SegmentTool.drawingHandler = null
        }

        // Remove event listener
        Map_.map.off('draw:created', handleBoxDrawn)
    }

    // Points mode functions
    function initializePointsMode() {
        // Enable map clicking
        Map_.map.on('click', handlePointClick)

        updateStatus('Click map to add points (foreground/background)', 'ready')
    }

    function handlePointClick(e) {
        const latLng = e.latlng

        // Store lat/lng (will transform to pixels on submit)
        SegmentTool.points.push(latLng)
        SegmentTool.pointLabels.push(SegmentTool.currentPointLabel)

        // Create marker
        const color =
            SegmentTool.currentPointLabel === 1 ? '#00FF00' : '#FF0000'
        const marker = L.circleMarker(latLng, {
            radius: 6,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2,
        }).addTo(Map_.map)

        SegmentTool.pointMarkers.push(marker)

        // Update UI list
        updatePointsList()
    }

    function updatePointsList() {
        const html = SegmentTool.points
            .map((pt, i) => {
                const label =
                    SegmentTool.pointLabels[i] === 1
                        ? 'Foreground'
                        : 'Background'
                const color =
                    SegmentTool.pointLabels[i] === 1 ? '#00FF00' : '#FF0000'
                return `
                <div class='segmentToolPointItem' style='border-left: 3px solid ${color}'>
                    Point ${i + 1}: ${label}
                    <button class='segmentToolRemovePoint' data-index='${i}'>×</button>
                </div>
            `
            })
            .join('')

        $('#segmentToolPointsList').html(
            html || '<div>No points added yet</div>'
        )

        // Add remove handlers
        $('.segmentToolRemovePoint').on('click', function () {
            const index = $(this).attr('data-index')
            removePoint(parseInt(index))
        })
    }

    function removePoint(index) {
        // Remove from arrays
        SegmentTool.points.splice(index, 1)
        SegmentTool.pointLabels.splice(index, 1)

        // Remove marker from map
        const marker = SegmentTool.pointMarkers.splice(index, 1)[0]
        Map_.map.removeLayer(marker)

        // Update UI
        updatePointsList()
    }

    function cleanupPointsMode() {
        // Remove click handler
        Map_.map.off('click', handlePointClick)
    }

    // Mode helper functions
    function initializeMode(mode) {
        if (mode === 'boxes') {
            initializeBoxesMode()
        } else if (mode === 'points') {
            initializePointsMode()
        } else {
            // Text mode - no special initialization
            updateStatus('Ready', 'ready')
        }
    }

    function cleanupModeHandlers() {
        cleanupBoxesMode()
        cleanupPointsMode()
    }

    function separateFromMMGIS() {
        $('#segmentToolSubmit').off('click')
        $('#segmentToolClear').off('click')
        $('#segmentToolPrompt').off('keypress')
    }
}

export default SegmentTool
