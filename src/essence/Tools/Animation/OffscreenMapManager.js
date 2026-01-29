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

        // Shadow layer registry (isolated from global L_.layers)
        // Must match structure of L_.layers to avoid undefined errors
        this.layers = {
            data: {},           // Cloned layer configs by UUID
            layer: {},          // Leaflet layer instances by UUID
            on: {},             // Visibility state by UUID
            opacity: {},        // Opacity values by UUID
            attachments: {},    // Sublayers (labels, models, etc.) by UUID
            filters: {},        // CSS filters by UUID
            refreshFailed: {},  // Failed refresh tracking by UUID
            dataFlat: []        // Ordered array for z-index management
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
     * @returns {Promise<void>}
     */
    async initialize(bbox, width, height) {
        if (this.initialized) {
            console.warn('OffscreenMapManager already initialized. Call destroy() first.')
            return
        }

        try {
            // Create hidden DOM container
            this._createContainer(width, height)

            // Initialize Leaflet map
            this._initializeLeafletMap()

            // Set view to bbox
            this.setViewToBBox(bbox)

            this.initialized = true
            console.log('OffscreenMapManager initialized', { width, height, bbox })
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
        this.container.style.cssText = `
            position: fixed;
            right: 20px;
            top: 80px;
            width: ${width}px;
            height: ${height}px;
            outline: 3px solid red;
            z-index: 10000;
            background: white;
        `

        // PRODUCTION: Hidden offscreen (uncomment this and remove DEBUG block above)
        /*
        this.container.style.cssText = `
            position: absolute;
            left: -10000px;
            top: 0;
            width: ${width}px;
            height: ${height}px;
            visibility: hidden;
            z-index: -9999;
        `
        */

        // Create nested map div (Leaflet requires a container)
        const mapDiv = document.createElement('div')
        mapDiv.id = 'offscreen-map'
        mapDiv.style.cssText = `
            width: 100%;
            height: 100%;
        `
        this.container.appendChild(mapDiv)

        document.body.appendChild(this.container)
        console.log('Offscreen container created:', { width, height })
    }

    /**
     * Initialize the Leaflet map with matching configuration from main map
     *
     * Clones the CRS/projection and map options to ensure consistent rendering.
     * Disables all interactions since this is for rendering only.
     *
     * @private
     */
    _initializeLeafletMap() {
        // Determine CRS to use
        let crs = L.CRS.EPSG3857 // Default

        if (this.projection) {
            // Use custom projection from main map
            crs = this.projection
            console.log('Using custom projection for offscreen map:', crs)
        }

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
            worldCopyJump: this.config?.msv?.worldCopyJump || false
        }

        // Add maxBounds if configured on main map
        if (this.mainMap.options.maxBounds) {
            mapOptions.maxBounds = this.mainMap.options.maxBounds
        }

        // Initialize Leaflet map
        this.leafletMap = L.map('offscreen-map', mapOptions)

        console.log('Offscreen Leaflet map initialized')
    }

    /**
     * Set the map view to match the animation bounding box
     *
     * @param {Object} bbox - Bounding box {north, south, east, west}
     */
    setViewToBBox(bbox) {
        if (!this.leafletMap) {
            console.warn('Cannot set view: Leaflet map not initialized')
            return
        }

        // Calculate bbox center
        const bboxCenter = [
            (bbox.north + bbox.south) / 2,
            (bbox.east + bbox.west) / 2
        ]

        // Use the main map's zoom (so scale matches)
        const mainZoom = this.mainMap.getZoom()

        // Center the offscreen map on the bbox center at the same zoom as main map
        this.leafletMap.setView(bboxCenter, mainZoom, { animate: false })

        console.log('Offscreen map view set to bbox center:', {
            center: bboxCenter,
            zoom: mainZoom,
            bbox: bbox
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
                layerRegistry: this.layers
            }

            console.log(`🎨 [OFFSCREEN] Building layer: ${clonedConfig.name} (type: ${clonedConfig.type})`)

            // Call Map_.makeLayer with offscreen context
            if (typeof Map_.makeLayer !== 'function') {
                throw new Error('Map_.makeLayer is not available')
            }

            console.log(`🔧 [OFFSCREEN] Calling Map_.makeLayer for ${clonedConfig.name}`)
            await Map_.makeLayer(
                clonedConfig,
                evenIfOff,
                null,  // forceGeoJSON
                null,  // id
                null,  // forceMake
                null,  // stopLoops
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
                this.layers.opacity[clonedConfig.name] = layerConfig.opacity || 1

                console.log(`✅ [OFFSCREEN] Layer built successfully: ${clonedConfig.name}`, layer)

                // Check if layer is actually on the map
                if (this.leafletMap.hasLayer(layer)) {
                    console.log(`✅ [OFFSCREEN] Layer ${clonedConfig.name} is on the map`)
                } else {
                    console.warn(`⚠️ [OFFSCREEN] Layer ${clonedConfig.name} was built but is NOT on the map!`)
                }
            } else {
                console.warn(`❌ [OFFSCREEN] Layer construction returned null: ${clonedConfig.name}`)
            }

            return layer
        } catch (error) {
            console.error(`❌ [OFFSCREEN] Failed to build layer ${layerConfig.name}:`, error)
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

        console.log('Building visible layers on offscreen map...')

        // Get list of visible layers from main map
        const visibleLayerNames = Object.keys(L_.layers.on).filter(
            name => L_.layers.on[name] === true
        )

        console.log(`Found ${visibleLayerNames.length} visible layers:`, visibleLayerNames)

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

        console.log('Visible layers built on offscreen map')
    }

    /**
     * Reorder layers on the offscreen map to match main map z-index
     *
     * @private
     */
    _reorderLayers() {
        // Bring layers to front in order (matches Map_.orderedBringToFront logic)
        this.layers.dataFlat.forEach((layerConfig) => {
            const layer = this.layers.layer[layerConfig.name]
            if (layer && layer.bringToFront) {
                layer.bringToFront()
            }
        })
    }

    /**
     * Update time-enabled layers without touching global TimeControl
     *
     * @param {Date} timestamp - The timestamp for the current frame
     * @returns {Promise<void>}
     */
    async updateTimeForLayers(timestamp) {
        const timeString = timestamp.toISOString()

        console.log('Updating time for offscreen layers:', timeString)

        for (const layerName in this.layers.layer) {
            const layerConfig = this.layers.data[layerName]
            const layer = this.layers.layer[layerName]

            if (layerConfig.time && layerConfig.time.enabled) {
                console.log(`Updating time for layer: ${layerName}`)

                if (layerConfig.type === 'tile') {
                    // Update tile layer URL with time parameter
                    const newUrl = this._replaceTimeTokens(layerConfig.url, timeString)
                    layer.setUrl(newUrl)

                    // Wait for tiles to load
                    await this._waitForLayerLoad(layer, 5000)
                } else if (layerConfig.type === 'vector') {
                    // Vector layers with time may need re-fetching
                    // This is more complex and may be implemented later
                    if (!this._vectorTimeWarnings) this._vectorTimeWarnings = new Set()
                    if (!this._vectorTimeWarnings.has(layerName)) {
                        console.warn(`⚠️ Time-enabled vector layers not yet fully supported: ${layerName}`)
                        this._vectorTimeWarnings.add(layerName)
                    }
                }
            }
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
            await new Promise(resolve => setTimeout(resolve, 100))

            // Capture using HTML2Canvas
            const canvas = await HTML2Canvas(this.container, {
                allowTaint: true,
                useCORS: true,
                logging: false,
                backgroundColor: null,
                width: this.container.offsetWidth,
                height: this.container.offsetHeight,
                onclone: (clonedDoc) => {
                    // Fix SVG layer positioning (from AnimationTool.js captureMapFrame)
                    const originalSVG = this.container.querySelectorAll('svg.leaflet-zoom-animated')
                    const copySVG = clonedDoc.body.querySelectorAll('svg.leaflet-zoom-animated')
                    copySVG.forEach((copyEle, i) => {
                        const attribute = originalSVG.item(i)?.getAttribute('style')
                        if (attribute) {
                            const parentElement = copyEle.parentElement
                            parentElement.removeChild(copyEle)
                            const temp = document.createElement('div')
                            temp.appendChild(copyEle)
                            parentElement.appendChild(temp)
                            temp.setAttribute('style', attribute)
                            copyEle.removeAttribute('style')
                        }
                    })

                    // Fix tile layer z-indices
                    const originalZ = this.container.querySelectorAll('.leaflet-tile-pane > div.leaflet-layer')
                    const copyZ = clonedDoc.body.querySelectorAll('.leaflet-tile-pane > div.leaflet-layer')
                    copyZ.forEach((copyEle, i) => {
                        const attribute = originalZ.item(i)?.getAttribute('style')
                        if (attribute) {
                            copyEle.setAttribute('style', attribute)
                        }
                    })
                }
            })

            // Create a NEW canvas and copy HTML2Canvas result to it
            // This ensures we have full control over the canvas
            const finalCanvas = document.createElement('canvas')
            finalCanvas.width = canvas.width
            finalCanvas.height = canvas.height
            const finalCtx = finalCanvas.getContext('2d')

            // Copy the HTML2Canvas result
            finalCtx.drawImage(canvas, 0, 0)

            console.log('Frame captured from offscreen map, copied to new canvas')
            return finalCanvas
        } catch (error) {
            console.error('Failed to capture frame from offscreen map:', error)
            throw error
        }
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
        const adjustedBarLength = barLength * (roundedDist / (unit === 'km' ? distance / 1000 : unit === 'cm' ? distance * 100 : distance))

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

        console.log('Offscreen map resized:', { width, height })
    }

    /**
     * Destroy the offscreen map and cleanup resources
     *
     * Removes all layers, destroys the Leaflet map, removes the DOM container,
     * and nulls all references.
     */
    destroy() {
        console.log('Destroying OffscreenMapManager...')

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
            dataFlat: []
        }

        this.initialized = false

        console.log('OffscreenMapManager destroyed')
    }
}

export default OffscreenMapManager
