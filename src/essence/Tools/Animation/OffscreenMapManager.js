/**
 * OffscreenMapManager
 *
 * Manages an offscreen Leaflet map instance for background animation generation.
 * This allows the AnimationTool to generate animations without interfering with
 * the user's main map interactions (panning, zooming, layer toggling).
 *
 * Architecture:
 * - Creates a hidden DOM container positioned offscreen
 * - Initializes an independent Leaflet map with matching projection from main map
 * - Maintains a "shadow" layer registry isolated from the global L_.layers
 * - Handles time updates without affecting global TimeControl state
 * - Provides canvas capture interface for frame generation
 *
 * @module OffscreenMapManager
 */

import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import F_ from '../../Basics/Formulae_/Formulae_'
import HTML2Canvas from 'html2canvas'

// Access Leaflet from global window object
const L = window.L

/**
 * OffscreenMapManager Class
 *
 * Manages lifecycle of an offscreen Leaflet map for animation frame capture.
 */
class OffscreenMapManager {
    /**
     * Create an OffscreenMapManager
     *
     * @param {L.Map} mainMap - Reference to the main Leaflet map instance
     * @param {Object} projection - Custom CRS/projection from window.mmgisglobal.customCRS
     * @param {Object} config - Mission configuration (L_.configData)
     */
    constructor(mainMap, projection, config) {
        this.mainMap = mainMap
        this.projection = projection
        this.config = config

        // Offscreen map instance
        this.leafletMap = null

        // Hidden DOM container
        this.container = null

        // Screen-aligned rectangle from main map
        this.screenRect = null

        // Stored view parameters (calculated once at initialization, never recalculated)
        this.storedCenter = null
        this.storedZoom = null

        // Shadow layer registry (isolated from global L_.layers)
        // Must match structure of L_.layers to avoid undefined errors
        this.layers = {
            data: {}, // Cloned layer configs by UUID
            layer: {}, // Leaflet layer instances by UUID
            on: {}, // Visibility state by UUID
            opacity: {}, // Opacity values by UUID
            attachments: {}, // Sublayers (labels, models, etc.) by UUID
            filters: {}, // CSS filters by UUID
            refreshFailed: {}, // Failed refresh tracking by UUID
            dataFlat: [], // Ordered array for z-index management
        }

        // State
        this.initialized = false
    }

    /**
     * Initialize the offscreen map
     *
     * Creates the hidden DOM container, initializes the Leaflet map with the same
     * projection as the main map, and sets the initial view to the animation bbox.
     *
     * @param {Object} bbox - Animation bounding box {north, south, east, west}
     * @param {number} width - Output width in pixels
     * @param {number} height - Output height in pixels
     * @param {Object} screenRect - Optional screen-aligned rectangle {x, y, width, height}
     * @returns {Promise<void>}
     */
    async initialize(bbox, width, height, screenRect = null) {
        if (this.initialized) {
            console.warn(
                'OffscreenMapManager already initialized. Call destroy() first.'
            )
            return
        }

        try {
            // Create hidden DOM container
            this._createContainer(width, height)

            // Initialize Leaflet map
            this._initializeLeafletMap()

            // Store screenRect for accurate positioning
            this.screenRect = screenRect

            // Set view to bbox
            this.setViewToBBox(bbox)

            this.initialized = true
        } catch (error) {
            console.error('Failed to initialize OffscreenMapManager:', error)
            this.destroy() // Cleanup on failure
            throw error
        }
    }

    /**
     * Create the hidden DOM container for the offscreen map
     *
     * The container must be in the DOM (not display: none) for Leaflet to render
     * properly, so we position it far offscreen instead.
     *
     * @private
     * @param {number} width - Container width in pixels
     * @param {number} height - Container height in pixels
     */
    _createContainer(width, height) {
        this.container = document.createElement('div')
        this.container.id = 'offscreen-map-container'

        // DEBUG: Make visible on screen for debugging (use outline instead of border to avoid capture)
        /*
        this.container.style.cssText = `
            position: fixed;
            right: 20px;
            top: 80px;
            width: ${width}px;
            height: ${height}px;
            outline: 3px solid red;
            z-index: 10000;
            background: white;
            overflow: hidden;
        `
        */

        // PRODUCTION: Hidden offscreen (uncomment this and remove DEBUG block above)

        this.container.style.cssText = `
            position: absolute;
            left: -10000px;
            top: 0;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            z-index: -9999;
        `

        // Create nested map div (Leaflet requires a container)
        const mapDiv = document.createElement('div')
        mapDiv.id = 'offscreen-map'
        mapDiv.style.cssText = `
            width: 100%;
            height: 100%;
        `
        this.container.appendChild(mapDiv)

        document.body.appendChild(this.container)
    }

    /**
     * Initialize the Leaflet map with matching configuration from main map
     *
     * Uses the EXACT SAME CRS as the main map to ensure consistent rendering.
     * Disables all interactions since this is for rendering only.
     *
     * @private
     */
    _initializeLeafletMap() {
        // Use the EXACT SAME CRS as the main map
        // This ensures consistency whether it's default EPSG3857 or custom projection
        const crs = this.mainMap.options.crs

        // Map options matching main map but with interactions disabled
        const mapOptions = {
            crs: crs,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false,
            zoomAnimation: false,
            fadeAnimation: false,
            editable: false,
            worldCopyJump: this.config?.msv?.worldCopyJump || false,
        }

        // Copy zoom settings from main map to ensure consistent scale
        if (this.mainMap.options.zoomDelta !== undefined) {
            mapOptions.zoomDelta = this.mainMap.options.zoomDelta
        }
        if (this.mainMap.options.zoomSnap !== undefined) {
            mapOptions.zoomSnap = this.mainMap.options.zoomSnap
        }

        // Add maxBounds if configured on main map
        if (this.mainMap.options.maxBounds) {
            mapOptions.maxBounds = this.mainMap.options.maxBounds
        }

        // Initialize Leaflet map
        this.leafletMap = L.map('offscreen-map', mapOptions)
    }

    /**
     * Set the map view to match the animation bounding box
     *
     * IMPORTANT: This method calculates and stores view parameters on first call,
     * then reuses those stored values on subsequent calls. This prevents the offscreen
     * map from following the main map if the user pans during animation generation.
     *
     * @param {Object} bbox - Bounding box {north, south, east, west}
     * @param {boolean} forceRecalculate - Force recalculation (default: false, uses stored values)
     */
    setViewToBBox(bbox, forceRecalculate = false) {
        if (!this.leafletMap) {
            console.warn('Cannot set view: Leaflet map not initialized')
            return
        }

        // If we have stored view parameters and not forcing recalculation, use them
        if (this.storedCenter && this.storedZoom && !forceRecalculate) {
            this.leafletMap.setView(this.storedCenter, this.storedZoom, {
                animate: false,
            })
            return
        }

        // Calculate view parameters (only done once during initialization)
        const mainZoom = this.mainMap.getZoom()
        let calculatedCenter = null

        // Use screenRect center if available (works for any CRS, not just custom projections)
        // This ensures the offscreen map matches the exact view of the main map
        if (this.screenRect) {
            // Calculate the geographic center from the screen rectangle on the main map
            const centerX = this.screenRect.x + this.screenRect.width / 2
            const centerY = this.screenRect.y + this.screenRect.height / 2
            calculatedCenter = this.mainMap.containerPointToLatLng({
                x: centerX,
                y: centerY,
            })
        } else {
            // Fallback: use fitBounds (for when screenRect is not available)
            const bounds = L.latLngBounds(
                L.latLng(bbox.south, bbox.west),
                L.latLng(bbox.north, bbox.east)
            )

            this.leafletMap.fitBounds(bounds, {
                padding: [0, 0],
                animate: false,
                maxZoom: mainZoom,
            })

            calculatedCenter = this.leafletMap.getCenter()
        }

        // Store the calculated parameters for reuse
        this.storedCenter = calculatedCenter
        this.storedZoom = mainZoom

        // Apply the view
        this.leafletMap.setView(this.storedCenter, this.storedZoom, {
            animate: false,
        })
    }

    /**
     * Build a single layer on the offscreen map
     *
     * Clones the layer configuration and constructs it using Map_.makeLayer().
     * The layer is stored in the shadow registry instead of the global L_.layers.
     *
     * @param {Object} layerConfig - Layer configuration object from L_.layers.data
     * @param {boolean} evenIfOff - Whether to build the layer even if not visible
     * @returns {Promise<L.Layer|null>} - The constructed Leaflet layer or null
     */
    async buildLayer(layerConfig, evenIfOff = false) {
        if (!this.leafletMap) {
            console.warn('Cannot build layer: Leaflet map not initialized')
            return null
        }

        try {
            // Clone layer config (deep copy to avoid mutations)
            const clonedConfig = JSON.parse(JSON.stringify(layerConfig))

            // Create map context pointing to offscreen registry
            const mapContext = {
                map: this.leafletMap,
                layerRegistry: this.layers,
            }

            // Call Map_.makeLayer with offscreen context
            if (typeof Map_.makeLayer !== 'function') {
                throw new Error('Map_.makeLayer is not available')
            }

            await Map_.makeLayer(
                clonedConfig,
                evenIfOff,
                null, // forceGeoJSON
                null, // id
                null, // forceMake
                null, // stopLoops
                false, // isRefresh
                mapContext // NEW: targetMapContext for offscreen rendering
            )

            // Get the constructed layer from shadow registry
            const layer = this.layers.layer[clonedConfig.name]

            if (layer) {

                // Store config in shadow registry
                this.layers.data[clonedConfig.name] = clonedConfig
                this.layers.dataFlat.push(clonedConfig)
                this.layers.on[clonedConfig.name] = true
                this.layers.opacity[clonedConfig.name] =
                    layerConfig.opacity || 1

                // Check if layer is actually on the map
                if (!this.leafletMap.hasLayer(layer)) {
                    console.warn(
                        `⚠️ Layer ${clonedConfig.name} was built but is NOT on the map!`
                    )
                }
            } else {
                console.warn(
                    `❌ Layer construction returned null: ${clonedConfig.name}`
                )
            }

            return layer
        } catch (error) {
            console.error(`Failed to build layer ${layerConfig.name}:`, error)
            return null
        }
    }

    /**
     * Build all currently visible layers from the main map
     *
     * Iterates through L_.layers.on to find visible layers and builds each one
     * on the offscreen map.
     *
     * @returns {Promise<void>}
     */
    async buildVisibleLayers() {
        if (!this.leafletMap) {
            console.warn('Cannot build layers: Leaflet map not initialized')
            return
        }

        // Get list of visible layers from main map
        const visibleLayerNames = Object.keys(L_.layers.on).filter(
            (name) => L_.layers.on[name] === true
        )

        // Build each visible layer
        for (const layerName of visibleLayerNames) {
            const layerConfig = L_.layers.data[layerName]

            if (!layerConfig) {
                console.warn(`Layer config not found for: ${layerName}`)
                continue
            }

            await this.buildLayer(layerConfig, false)
        }

        // Apply layer ordering (z-index)
        this._reorderLayers()
    }

    /**
     * Reorder layers on the offscreen map to match main map z-index
     *
     * Uses the same logic as Map_.orderedBringToFront to ensure proper layer ordering.
     * Vector layers are removed and re-added in order.
     * Tile/raster layers use setZIndex with calculated values.
     *
     * @private
     */
    _reorderLayers() {
        // Use L_._layersOrdered for the canonical layer order
        if (!window.L_ || !window.L_._layersOrdered) {
            console.warn(
                'L_._layersOrdered not available, using simple ordering'
            )
            // Fallback to simple ordering
            this.layers.dataFlat.forEach((layerConfig) => {
                const layer = this.layers.layer[layerConfig.name]
                if (layer && layer.bringToFront) {
                    layer.bringToFront()
                }
            })
            return
        }

        const layersOrdered = window.L_._layersOrdered
        const hasIndex = []
        const hasIndexRaster = []

        // Identify which layers need reordering
        // Go through in reverse order (bottom to top)
        for (let i = layersOrdered.length - 1; i >= 0; i--) {
            const layerName = layersOrdered[i]
            const layer = this.layers.layer[layerName]
            const layerConfig = this.layers.data[layerName]

            if (!layer || !layerConfig || !this.leafletMap.hasLayer(layer)) {
                continue
            }

            if (layerConfig.type === 'vector' || layerConfig.type === 'image') {
                // Remove vector and image layers (will be re-added in order)
                this.leafletMap.removeLayer(layer)
                hasIndex.push(i)
            } else if (
                layerConfig.type === 'tile' ||
                layerConfig.type === 'data'
            ) {
                // Track raster layers for z-index adjustment
                hasIndexRaster.push(i)
            }
        }

        // Re-add vector and image layers in correct order (bottom to top)
        for (let i = 0; i < hasIndex.length; i++) {
            const layerName = layersOrdered[hasIndex[i]]
            const layer = this.layers.layer[layerName]
            const layerConfig = this.layers.data[layerName]

            if (layer && layerConfig) {
                // Add layer back to map
                this.leafletMap.addLayer(layer)

                // If image layer, set z-index and redraw
                if (layerConfig.type === 'image') {
                    const zIndex =
                        layersOrdered.length +
                        1 -
                        layersOrdered.indexOf(layerName)
                    if (layer.setZIndex) {
                        layer.setZIndex(zIndex)
                    }
                    if (layer.clearCache) layer.clearCache()
                    if (layer.redraw) layer.redraw()
                }
            }
        }

        // Set z-index for tile/raster layers
        for (let i = 0; i < hasIndexRaster.length; i++) {
            const layerName = layersOrdered[hasIndexRaster[i]]
            const layer = this.layers.layer[layerName]

            if (layer && layer.setZIndex) {
                const zIndex =
                    layersOrdered.length + 1 - layersOrdered.indexOf(layerName)
                layer.setZIndex(zIndex)
            }
        }
    }

    /**
     * Update time-enabled layers without touching global TimeControl
     *
     * @param {Date} timestamp - The timestamp for the current frame
     * @returns {Promise<void>}
     */
    async updateTimeForLayers(timestamp) {
        const timeString = timestamp.toISOString()
        let vectorLayersRebuilt = false

        for (const layerName in this.layers.layer) {
            const layerConfig = this.layers.data[layerName]
            const layer = this.layers.layer[layerName]

            if (layerConfig.time && layerConfig.time.enabled) {
                if (layerConfig.type === 'tile') {
                    // Update tile layer URL with time parameter
                    const newUrl = this._replaceTimeTokens(
                        layerConfig.url,
                        timeString
                    )
                    layer.setUrl(newUrl)

                    // Wait for tiles to load
                    await this._waitForLayerLoad(layer, 5000)
                } else if (layerConfig.type === 'vector') {
                    // Vector layers with time need to be rebuilt with new URL
                    // Remove old layer
                    if (this.leafletMap.hasLayer(layer)) {
                        this.leafletMap.removeLayer(layer)
                    }

                    // Update URL with time tokens
                    const updatedConfig = JSON.parse(
                        JSON.stringify(layerConfig)
                    )
                    updatedConfig.url = this._replaceTimeTokens(
                        updatedConfig.url,
                        timeString
                    )

                    // Rebuild the layer
                    await this.buildLayer(updatedConfig, true)
                    vectorLayersRebuilt = true
                }
            }
        }

        // Reorder layers if any vector layers were rebuilt
        if (vectorLayersRebuilt) {
            this._reorderLayers()
        }
    }

    /**
     * Replace time tokens in URL string
     *
     * Simplified version of TimeControl's time replacement logic.
     * Supports common patterns like {time}, {starttime}, {endtime}.
     *
     * @private
     * @param {string} url - The URL template with time tokens
     * @param {string} timeString - ISO timestamp string
     * @returns {string} - URL with replaced time tokens
     */
    _replaceTimeTokens(url, timeString) {
        if (!url) return url

        // Replace common time tokens
        let newUrl = url
        newUrl = newUrl.replace(/\{time\}/gi, timeString)
        newUrl = newUrl.replace(/\{starttime\}/gi, timeString)
        newUrl = newUrl.replace(/\{endtime\}/gi, timeString)

        return newUrl
    }

    /**
     * Wait for a layer to finish loading tiles
     *
     * @private
     * @param {L.Layer} layer - The Leaflet layer to wait for
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<void>}
     */
    _waitForLayerLoad(layer, timeout = 5000) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                console.warn('Layer load timeout reached')
                resolve()
            }, timeout)

            layer.once('load', () => {
                clearTimeout(timer)
                resolve()
            })

            // Also resolve immediately if already loaded
            if (layer._loaded || !layer._loading) {
                clearTimeout(timer)
                resolve()
            }
        })
    }

    /**
     * Capture a frame from the offscreen map
     *
     * Updates time-enabled layers, ensures correct view, and captures the map
     * using HTML2Canvas.
     *
     * @param {Object} bbox - Animation bounding box {north, south, east, west}
     * @param {Date} timestamp - The timestamp for this frame
     * @returns {Promise<HTMLCanvasElement>} - Canvas containing the captured frame
     */
    async captureFrame(bbox, timestamp) {
        if (!this.leafletMap) {
            throw new Error('Cannot capture frame: Leaflet map not initialized')
        }

        try {
            // Update time for all time-enabled layers
            await this.updateTimeForLayers(timestamp)

            // Ensure map view matches bbox (in case it drifted)
            this.setViewToBBox(bbox)

            // Wait a bit for Leaflet to render (asynchronous rendering)
            await new Promise((resolve) => setTimeout(resolve, 100))

            // Capture using HTML2Canvas
            const canvas = await HTML2Canvas(this.container, {
                allowTaint: true,
                useCORS: true,
                logging: false,
                backgroundColor: null,
                width: this.container.offsetWidth,
                height: this.container.offsetHeight,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0,
                windowWidth: this.container.offsetWidth,
                windowHeight: this.container.offsetHeight,

                onclone: function (e) {
                    // Fix svg layer shift
                    const originalSVG = document.body.querySelectorAll(
                        '#offscreen-map-container .leaflet-overlay-pane > svg'
                    )
                    const copySVG = e.body.querySelectorAll(
                        '#offscreen-map-container .leaflet-overlay-pane > svg'
                    )
                    copySVG.forEach((copyEle, i) => {
                        const attribute = originalSVG
                            .item(i)
                            .getAttribute('style')
                        const parentElement = copyEle.parentElement
                        parentElement.removeChild(copyEle)
                        const temp = document.createElement('div')
                        temp.appendChild(copyEle)
                        parentElement.appendChild(temp)
                        temp.setAttribute('style', attribute)
                        copyEle.removeAttribute('style')
                    })

                    // Fix tile layer z-indices
                    const originalZ = document.body.querySelectorAll(
                        '#offscreen-map-container .leaflet-tile-pane > div.leaflet-layer'
                    )
                    const copyZ = e.body.querySelectorAll(
                        '#offscreen-map-container .leaflet-tile-pane > div.leaflet-layer'
                    )
                    copyZ.forEach((copyEle, i) => {
                        const attribute = originalZ
                            .item(i)
                            .getAttribute('style')
                        copyEle.setAttribute('style', attribute)
                    })
                },
            })

            // Since the offscreen container was sized to match the drawn bbox dimensions
            // (screenRect.width × screenRect.height), and the view was set to show the bbox,
            // the entire captured canvas already represents the correct extent.
            // No cropping needed - just return the canvas.

            // DEBUG: Display the canvas at bottom right for debugging
            this._displayDebugCanvas(canvas, 'Captured Canvas')

            return canvas
        } catch (error) {
            console.error('Failed to capture frame from offscreen map:', error)
            throw error
        }
    }

    /**
     * Display a canvas in the AnimationTool debug preview
     *
     * @private
     * @param {HTMLCanvasElement} canvas - Canvas to display
     * @param {string} label - Label for the canvas
     */
    _displayDebugCanvas(canvas, label) {
        const debugPreview = document.getElementById('animationDebugPreview')
        const debugCanvas = document.getElementById('animationDebugCanvas')
        const debugInfo = document.getElementById('animationDebugInfo')

        if (!debugPreview || !debugCanvas || !debugInfo) {
            return // Elements not ready yet
        }

        // Show the preview section
        debugPreview.style.display = 'block'

        // Update the canvas
        debugCanvas.width = canvas.width
        debugCanvas.height = canvas.height
        const ctx = debugCanvas.getContext('2d')
        ctx.drawImage(canvas, 0, 0)

        // Update info
        debugInfo.textContent = `${canvas.width} × ${canvas.height}px`
    }

    /**
     * Render a scale bar onto a canvas
     *
     * Draws a metric scale bar in the bottom left corner of the canvas,
     * similar to the ScaleBar.js implementation but rendered directly to canvas.
     *
     * @param {HTMLCanvasElement} canvas - Canvas to draw scale bar on
     * @returns {HTMLCanvasElement} - The same canvas with scale bar rendered
     */
    renderScaleBarOnCanvas(canvas) {
        // Create a NEW canvas and copy the input to it
        // This ensures we have full control and don't modify the original
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = canvas.width
        outputCanvas.height = canvas.height
        const ctx = outputCanvas.getContext('2d')

        // Copy the input canvas
        ctx.drawImage(canvas, 0, 0)

        // Get map center for distance calculation
        const mapCenter = this.leafletMap.getCenter()
        const zoom = this.leafletMap.getZoom()

        // Calculate scale bar width in pixels (aim for about 1/4 of canvas width, max 250px)
        const barLength = Math.min(250, canvas.width / 4)

        // Find coordinates at map center and at another point a bit right
        const centerPoint = this.leafletMap.latLngToContainerPoint(mapCenter)
        const rightPoint = [centerPoint.x + barLength, centerPoint.y]
        const rightLatLng = this.leafletMap.containerPointToLatLng(rightPoint)

        // Calculate actual distance using F_.lngLatDistBetween (same as ScaleBar.js)
        let distance = F_.lngLatDistBetween(
            mapCenter.lng,
            mapCenter.lat,
            rightLatLng.lng,
            rightLatLng.lat
        )

        // Round distance to a nice number
        let roundedDist = distance
        let unit = 'm'
        if (distance > 1000) {
            roundedDist = Math.round(distance / 1000)
            unit = 'km'
        } else if (distance < 1) {
            roundedDist = Math.round(distance * 100)
            unit = 'cm'
        } else {
            roundedDist = Math.round(distance)
        }

        // Adjust bar length based on rounded distance
        const adjustedBarLength =
            barLength *
            (roundedDist /
                (unit === 'km'
                    ? distance / 1000
                    : unit === 'cm'
                      ? distance * 100
                      : distance))

        // Position scale bar in bottom left corner
        const padding = 20
        const barX = padding
        const barY = canvas.height - padding - 10
        const barHeight = 10

        // Draw simple bracket shape (left + bottom + right borders)
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.beginPath()
        // Left vertical line
        ctx.moveTo(barX, barY)
        ctx.lineTo(barX, barY + barHeight)
        // Bottom horizontal line
        ctx.lineTo(barX + adjustedBarLength, barY + barHeight)
        // Right vertical line
        ctx.lineTo(barX + adjustedBarLength, barY)
        ctx.stroke()

        // Draw text labels with subtle black outline for visibility
        ctx.font = 'bold 14px Arial, sans-serif'
        ctx.textBaseline = 'bottom'

        // Draw "0" at start (left-aligned)
        ctx.textAlign = 'left'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.strokeText('0', barX, barY - 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText('0', barX, barY - 2)

        // Draw distance at end (right-aligned)
        ctx.textAlign = 'right'
        const endLabel = `${roundedDist} ${unit}`
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.strokeText(endLabel, barX + adjustedBarLength, barY - 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(endLabel, barX + adjustedBarLength, barY - 2)

        return outputCanvas
    }

    /**
     * Resize the offscreen map container
     *
     * Useful if the animation bbox or output dimensions change.
     *
     * @param {number} width - New width in pixels
     * @param {number} height - New height in pixels
     */
    resize(width, height) {
        if (!this.container) {
            console.warn('Cannot resize: Container not initialized')
            return
        }

        this.container.style.width = `${width}px`
        this.container.style.height = `${height}px`

        if (this.leafletMap) {
            this.leafletMap.invalidateSize()
        }
    }

    /**
     * Destroy the offscreen map and cleanup resources
     *
     * Removes all layers, destroys the Leaflet map, removes the DOM container,
     * and nulls all references.
     */
    destroy() {
        // Remove all layers from map
        if (this.leafletMap) {
            this.leafletMap.eachLayer((layer) => {
                this.leafletMap.removeLayer(layer)
            })

            // Destroy Leaflet map
            this.leafletMap.remove()
            this.leafletMap = null
        }

        // Remove container from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container)
            this.container = null
        }

        // Clear shadow registry
        this.layers = {
            data: {},
            layer: {},
            on: {},
            opacity: {},
            attachments: {},
            filters: {},
            refreshFailed: {},
            dataFlat: [],
        }

        // Clear stored view parameters
        this.storedCenter = null
        this.storedZoom = null
        this.screenRect = null

        this.initialized = false
    }
}

export default OffscreenMapManager
