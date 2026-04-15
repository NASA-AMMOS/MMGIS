import LithoSphere from 'lithosphere'
import * as Cesium from 'cesium'
import { utcFormat } from 'd3-time-format'
import 'cesium/Source/Widgets/widgets.css'
import LayerUtils from '../Layers_/LayerUtils'
import {
    interpolateMultipleColors,
    buildColorStops,
    rgbToHex,
} from '../Layers_/gradientUtils'
import { getCoordProperties } from '../Layers_/ExtendedGeoJSON'
import F_ from '../Formulae_/Formulae_'

/**
 * GlobeRenderer - Abstraction wrapper for 3D globe rendering engines
 *
 * Provides a unified interface for both LithoSphere and CesiumJS renderers.
 * Allows site admins to configure which renderer to use via panelSettings.
 */
class GlobeRenderer {
    constructor(containerId, config, rendererType = 'lithosphere') {
        this.rendererType = rendererType
        this.containerId = containerId
        this.config = config
        this.renderer = null
        // Earth's circumference in meters (Web Mercator standard)
        this.EARTH_CIRCUMFERENCE = 40075017

        // Initialize the appropriate renderer
        if (rendererType === 'cesium') {
            this._initCesium()
        } else {
            this._initLithoSphere()
        }
    }

    /**
     * Request a scene render (needed when requestRenderMode is true).
     * Call after any state change (layer add/remove/toggle, style update, etc.).
     */
    _requestRender() {
        if (
            this.rendererType === 'cesium' &&
            this.renderer &&
            this.renderer.scene
        ) {
            this.renderer.scene.requestRender()
        }
    }

    /**
     * Convert Leaflet zoom level to Cesium camera height
     * Uses exponential formula: height = Earth_circumference / 2^zoom
     * @param {number} zoom - Leaflet zoom level (0-22)
     * @returns {number} Camera height in meters
     */
    _zoomToHeight(zoom) {
        return this.EARTH_CIRCUMFERENCE / Math.pow(2, zoom)
    }

    /**
     * Convert Cesium camera height to Leaflet zoom level
     * Uses logarithmic formula: zoom = log2(Earth_circumference / height)
     * @param {number} height - Camera height in meters
     * @returns {number} Leaflet-equivalent zoom level
     */
    _heightToZoom(height) {
        return Math.log2(this.EARTH_CIRCUMFERENCE / height)
    }

    /**
     * Initialize LithoSphere renderer
     */
    _initLithoSphere() {
        this.renderer = new LithoSphere(this.containerId, this.config)
        // Expose LithoSphere-specific properties that MMGIS uses
        this.controls = this.renderer.controls
        this.projection = this.renderer.projection
        this._ = this.renderer._
        this.options = this.renderer.options
        this.mouse = this.renderer.mouse

        // Track active feature for LithoSphere highlighting
        this._lithoActiveFeature = null
    }

    /**
     * Initialize Cesium renderer
     */
    _initCesium() {
        const cesiumContainer = document.getElementById(this.containerId)

        // Create Cesium viewer with configuration
        this.renderer = new Cesium.Viewer(cesiumContainer, {
            // Initial view
            ...(this.config.initialView && {
                camera: {
                    destination: Cesium.Cartesian3.fromDegrees(
                        this.config.initialView.lng,
                        this.config.initialView.lat,
                        this._zoomToHeight(this.config.initialView.zoom) // Convert zoom to height
                    ),
                },
            }),

            // UI controls
            homeButton: false,
            navigationHelpButton: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            geocoder: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: false, // Disable Cesium's info box (using MMGIS InfoTool instead)
            selectionIndicator: false,

            // Performance — only render when something changes
            requestRenderMode: true,
            maximumRenderTimeChange: Infinity,
        })

        // Store layer references
        this._layers = {}

        // Track in-progress layer loads to prevent duplicates
        this._loadingLayers = {}

        // Event loop prevention flag (similar to Map_._justSetActiveLayer)
        this._justSelectedFromMap = false
        this._justSelectedTimeout = null

        // Track highlighted entity for selection sync
        this._highlightedEntity = null
        this._originalEntityStyle = null

        // Set up initial view if no camera specified
        if (!this.config.initialCamera && this.config.initialView) {
            this.renderer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(
                    this.config.initialView.lng,
                    this.config.initialView.lat,
                    this._zoomToHeight(this.config.initialView.zoom)
                ),
            })
        }

        // Set up terrain provider
        this._setupTerrainProvider()

        // Mock controls object for compatibility
        this.controls = {
            home: {},
            exaggerate: {},
            observe: {},
            walk: {},
            compass: {},
            navigation: {},
            coordinates: {},
            link: {},
        }

        // Mock properties for compatibility
        this.projection = {}
        this._ = {}
        this.options = {}
        this.mouse = { lng: 0, lat: 0 }

        // Disable expensive scene subsystems not needed for planetary science
        const scene = this.renderer.scene
        scene.fog.enabled = false
        scene.globe.showGroundAtmosphere = false
        scene.skyAtmosphere.show = false
        scene.sun.show = false
        scene.moon.show = false

        // Create control container AFTER Cesium viewer is initialized
        this._createCesiumControlContainer()

        // Create single global click handler for all layers
        this._setupGlobalClickHandler()
    }

    /**
     * Set up terrain provider for Cesium.
     * Uses Mapzen Terrarium tiles as default, can be overridden with demFallback config.
     *
     * Performance architecture:
     *  - Worker pool (4 workers) handles fetch + decode + parse + TIN generation off main thread
     *  - RTIN (martini) generates adaptive meshes (~2-3K vertices vs 65K regular grid)
     *  - QuantizedMeshTerrainData feeds TIN directly to Cesium (no main-thread mesh generation)
     *  - LRU tile cache avoids re-processing tiles the camera has already seen
     *  - In-flight deduplication prevents duplicate requests for the same tile
     *  - Zoom cap at level 10 limits exponential tile growth
     *  - Concurrency limiter (max 6 in-flight fetches) prevents network saturation
     */
    async _setupTerrainProvider() {
        if (this.rendererType !== 'cesium') return

        // ── Shared terrain infrastructure ──
        this._terrainTileSize = 256
        this._terrainMaxMeshError = 5.0 // meters -- controls TIN quality vs vertex count

        // LRU tile cache (key -> worker result object)
        this._terrainCache = new Map()
        this._terrainCacheMax = 512

        // In-flight request deduplication (key -> Promise)
        this._terrainInflight = new Map()

        // Maximum zoom level -- higher zooms reuse this level's data.
        this._terrainMaxLevel = 10

        // Tiling scheme (shared across all terrain methods)
        this._terrainTilingScheme = new Cesium.WebMercatorTilingScheme()

        // ── Worker pool (4 workers for parallel fetch+decode+parse+TIN) ──
        this._terrainWorkerPool = []
        this._terrainWorkerCallbacks = new Map()
        this._terrainWorkerNextId = 0
        this._terrainWorkerRoundRobin = 0

        const POOL_SIZE = 4
        for (let i = 0; i < POOL_SIZE; i++) {
            const worker = new Worker(
                new URL('./terrainWorker.js', import.meta.url)
            )
            worker.onmessage = (e) => {
                const { id, empty } = e.data
                const cb = this._terrainWorkerCallbacks.get(id)
                if (cb) {
                    this._terrainWorkerCallbacks.delete(id)
                    this._terrainActiveCount--
                    this._drainTerrainQueue()
                    cb.resolve(empty ? null : e.data)
                }
            }
            this._terrainWorkerPool.push(worker)
        }

        // ── Concurrency limiter (max 6 in-flight worker tasks) ──
        this._terrainMaxConcurrent = 6
        this._terrainActiveCount = 0
        this._terrainQueue = []

        // Check for demFallback configuration
        const demFallback = this.config.demFallback

        if (demFallback && demFallback.demPath) {
            await this._setTerrainFromConfig(demFallback)
        } else {
            await this._setMapzenTerrariumTerrain()
        }
    }

    /**
     * Dispatch a tile to the next available worker in the pool.
     * Workers handle the full pipeline: fetch -> decode -> parse -> TIN mesh generation.
     */
    _dispatchToWorkerPool(url, parserType, cropBuffer, tileSize, maxMeshError) {
        return new Promise((resolve) => {
            const id = this._terrainWorkerNextId++
            const msg = { id, url, parserType, cropBuffer, tileSize, maxMeshError }
            this._terrainWorkerCallbacks.set(id, { resolve })

            if (this._terrainActiveCount < this._terrainMaxConcurrent) {
                this._terrainActiveCount++
                const workerIdx =
                    this._terrainWorkerRoundRobin++ %
                    this._terrainWorkerPool.length
                this._terrainWorkerPool[workerIdx].postMessage(msg)
            } else {
                this._terrainQueue.push({ id, msg })
            }
        })
    }

    /**
     * Drain queued terrain requests when concurrency slots free up.
     */
    _drainTerrainQueue() {
        while (
            this._terrainQueue.length > 0 &&
            this._terrainActiveCount < this._terrainMaxConcurrent
        ) {
            const { msg } = this._terrainQueue.shift()
            this._terrainActiveCount++
            const workerIdx =
                this._terrainWorkerRoundRobin++ %
                this._terrainWorkerPool.length
            this._terrainWorkerPool[workerIdx].postMessage(msg)
        }
    }

    /**
     * LRU cache get -- moves the accessed key to the end (most-recently-used).
     */
    _terrainCacheGet(key) {
        if (!this._terrainCache.has(key)) return undefined
        const value = this._terrainCache.get(key)
        this._terrainCache.delete(key)
        this._terrainCache.set(key, value)
        return value
    }

    /**
     * LRU cache set -- evicts the oldest entry when the cache is full.
     */
    _terrainCacheSet(key, value) {
        if (this._terrainCache.has(key)) {
            this._terrainCache.delete(key)
        } else if (this._terrainCache.size >= this._terrainCacheMax) {
            const oldest = this._terrainCache.keys().next().value
            this._terrainCache.delete(oldest)
        }
        this._terrainCache.set(key, value)
    }

    /**
     * Fetch a tile via the worker pool (fetch + decode + parse + TIN).
     * Returns a Promise resolving to the worker result (or null on failure).
     * Handles cache, dedup, and zoom capping.
     */
    _fetchTinTile(url, cacheKey, parserType, cropBuffer) {
        // 1. Cache hit
        const cached = this._terrainCacheGet(cacheKey)
        if (cached) return Promise.resolve(cached)

        // 2. Deduplication
        if (this._terrainInflight.has(cacheKey)) {
            return this._terrainInflight.get(cacheKey)
        }

        // 3. Dispatch to worker pool
        const promise = this._dispatchToWorkerPool(
            url,
            parserType,
            cropBuffer,
            this._terrainTileSize,
            this._terrainMaxMeshError
        ).then((result) => {
            this._terrainInflight.delete(cacheKey)
            if (result) {
                this._terrainCacheSet(cacheKey, result)
            }
            return result
        })

        this._terrainInflight.set(cacheKey, promise)
        return promise
    }

    /**
     * Convert worker TIN result to Cesium QuantizedMeshTerrainData.
     * This is the only terrain work done on the main thread -- it's lightweight
     * because the heavy lifting (fetch, decode, parse, mesh generation) happened in the worker.
     */
    _workerResultToTerrainData(result, x, y, level) {
        const rectangle = this._terrainTilingScheme.tileXYToRectangle(x, y, level)
        const { minimumHeight, maximumHeight } = result

        // Re-wrap transferred arrays (they arrive as plain ArrayBuffers after transfer)
        const quantizedVertices =
            result.quantizedVertices instanceof Uint16Array
                ? result.quantizedVertices
                : new Uint16Array(result.quantizedVertices)
        const triangleIndices =
            result.triangles instanceof Uint32Array
                ? result.triangles
                : new Uint32Array(result.triangles)

        // Use Uint16Array indices if possible (vertex count <= 65535)
        const numVerts = quantizedVertices.length / 3
        const indices =
            numVerts <= 65535
                ? new Uint16Array(triangleIndices)
                : triangleIndices

        // Compute bounding sphere and horizon occlusion point
        const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(
            rectangle,
            Cesium.Ellipsoid.WGS84,
            maximumHeight
        )
        const center = Cesium.Rectangle.center(rectangle)
        const centerCartesian = Cesium.Cartographic.toCartesian(
            new Cesium.Cartographic(center.longitude, center.latitude, maximumHeight)
        )

        return new Cesium.QuantizedMeshTerrainData({
            quantizedVertices,
            indices,
            minimumHeight,
            maximumHeight,
            boundingSphere,
            horizonOcclusionPoint: centerCartesian,
            westIndices: new Uint16Array(result.westIndices),
            southIndices: new Uint16Array(result.southIndices),
            eastIndices: new Uint16Array(result.eastIndices),
            northIndices: new Uint16Array(result.northIndices),
        })
    }

    /**
     * Create a custom TerrainProvider that generates TIN meshes via the worker pool.
     * Returns QuantizedMeshTerrainData (~2-3K vertices) instead of heightmap grids (65K).
     */
    _createTinTerrainProvider(urlBuilder, parserType, cropBuffer) {
        const self = this
        const tilingScheme = this._terrainTilingScheme
        const maxLevel = this._terrainMaxLevel

        // Cesium's TerrainProvider interface -- implemented as a plain object
        // that Cesium duck-types (same pattern as CustomHeightmapTerrainProvider).
        const provider = {
            _tilingScheme: tilingScheme,
            _ready: true,
            _readyPromise: Promise.resolve(true),
            _errorEvent: new Cesium.Event(),

            get tilingScheme() { return this._tilingScheme },
            get ready() { return this._ready },
            get readyPromise() { return this._readyPromise },
            get errorEvent() { return this._errorEvent },
            get credit() { return undefined },
            get hasWaterMask() { return false },
            get hasVertexNormals() { return false },
            get availability() { return undefined },

            getLevelMaximumGeometricError(level) {
                // Approximate: Cesium's default formula
                const levelZeroMaximumGeometricError =
                    Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
                        tilingScheme.ellipsoid,
                        65, // effective vertex grid
                        tilingScheme.getNumberOfXTilesAtLevel(0)
                    )
                return levelZeroMaximumGeometricError / (1 << level)
            },

            getTileDataAvailable(_x, _y, _level) {
                return undefined // unknown -- let Cesium try
            },

            loadTileDataAvailability(_x, _y, _level) {
                return undefined
            },

            requestTileGeometry(x, y, level, _request) {
                if (level < 4) {
                    // Return a flat tile at low zoom levels
                    return Promise.resolve(
                        new Cesium.HeightmapTerrainData({
                            buffer: new Float32Array(16 * 16),
                            width: 16,
                            height: 16,
                        })
                    )
                }

                // Zoom cap -- reuse parent tile at higher zooms
                const effectiveLevel = Math.min(level, maxLevel)
                const scale = Math.pow(2, level - effectiveLevel)
                const effectiveX = Math.floor(x / scale)
                const effectiveY = Math.floor(y / scale)

                const { url, cacheKey } = urlBuilder(
                    effectiveX,
                    effectiveY,
                    effectiveLevel
                )

                return self
                    ._fetchTinTile(url, cacheKey, parserType, cropBuffer)
                    .then((result) => {
                        if (!result) {
                            // Failed tile -- return flat
                            return new Cesium.HeightmapTerrainData({
                                buffer: new Float32Array(16 * 16),
                                width: 16,
                                height: 16,
                            })
                        }
                        return self._workerResultToTerrainData(
                            result,
                            x,
                            y,
                            level
                        )
                    })
            },
        }

        return provider
    }

    /**
     * Set terrain provider for Cesium using Mapzen Terrarium tiles.
     * Generates adaptive TIN meshes via RTIN (martini) in web workers.
     */
    async _setMapzenTerrariumTerrain() {
        if (this.rendererType !== 'cesium') return

        const urlBuilder = (x, y, level) => ({
            url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${level}/${x}/${y}.png`,
            cacheKey: `terrarium/${level}/${x}/${y}`,
        })

        this.renderer.terrainProvider = this._createTinTerrainProvider(
            urlBuilder,
            'terrarium',
            false
        )

        this._currentTerrainProvider = 'terrarium'
    }

    /**
     * Set terrain from demFallback configuration.
     * Supports multiple parser types: terrarium, mapbox, rgba (TerrainRGB).
     * Generates adaptive TIN meshes via RTIN (martini) in web workers.
     */
    async _setTerrainFromConfig(demConfig) {
        if (this.rendererType !== 'cesium') return

        if (!demConfig.demPath || demConfig.demPath === 'default') {
            await this._setMapzenTerrariumTerrain()
            return
        }

        // If the demPath is a raw file (no {z}/{x}/{y} tile placeholders),
        // it can't be used as a tile endpoint — fall back to Terrarium.
        const hasTilePlaceholders =
            demConfig.demPath.includes('{z}') ||
            demConfig.demPath.includes('{x}') ||
            demConfig.demPath.includes('{y}') ||
            demConfig.demPath.includes('{level}')
        if (!hasTilePlaceholders) {
            console.warn(
                `[GlobeRenderer] demFallbackPath "${demConfig.demPath}" has no tile ` +
                `placeholders ({z}/{x}/{y}) — falling back to Mapzen Terrarium terrain.`
            )
            await this._setMapzenTerrariumTerrain()
            return
        }

        const parserType = demConfig.parserType || 'rgba'
        const cropBuffer = parserType === 'mapbox' || parserType === 'rgba'

        const urlBuilder = (x, y, level) => {
            const tileY =
                demConfig.format === 'tms'
                    ? Math.pow(2, level) - 1 - y
                    : y
            return {
                url: demConfig.demPath
                    .replace('{z}', level)
                    .replace('{x}', x)
                    .replace('{y}', tileY)
                    .replace('{level}', level),
                cacheKey: `custom/${level}/${x}/${y}`,
            }
        }

        this.renderer.terrainProvider = this._createTinTerrainProvider(
            urlBuilder,
            parserType,
            cropBuffer
        )

        this._currentTerrainProvider = 'custom'
    }

    /**
     * Add a layer to the globe
     * @param {string} type - Layer type: 'tile', 'vector', 'clamped', 'curtain', 'model'
     * @param {object} layerConfig - Layer configuration
     */
    addLayer(type, layerConfig) {
        if (type === 'gradient_polyline') {
            // Gradient polylines are only supported by the Cesium renderer
            if (this.rendererType !== 'lithosphere') {
                return this._addCesiumGradientPolyline(layerConfig)
            }
            return null
        }
        if (this.rendererType === 'lithosphere') {
            return this.renderer.addLayer(type, layerConfig)
        } else {
            return this._addCesiumLayer(type, layerConfig)
        }
    }

    /**
     * Add a layer to Cesium
     */
    _addCesiumLayer(type, layerConfig) {
        const { name } = layerConfig

        if (type === 'tile') {
            // Extract time configuration (matches structure from Layers_.js)
            // layerConfig.time contains: { enabled, start, end, customTimes, format, ... }
            const timeConfig = layerConfig.time
                ? {
                      enabled: layerConfig.time.enabled || false,
                      start: layerConfig.time.start || null,
                      end: layerConfig.time.end || null,
                      customTimes: layerConfig.time.customTimes || null,
                      format: layerConfig.time.format || null,
                      originalUrl: layerConfig.path, // Store original template
                  }
                : null

            // Replace time parameters in URL if time is enabled
            let processedUrl = timeConfig?.enabled
                ? this._replaceTimeParameters(layerConfig.path, timeConfig)
                : layerConfig.path

            // Add TiTiler query parameters for COG/STAC layers
            processedUrl = this._buildTiTilerUrl(processedUrl, layerConfig)

            let imageryProvider

            // Check if this is a WMS layer
            if (layerConfig.format === 'wms') {
                // Parse WMS URL
                const { baseUrl, wmsParams } = this._parseWmsUrl(processedUrl)

                // Validate required LAYERS parameter
                if (!wmsParams.LAYERS) {
                    console.warn(
                        `WMS layer ${name} has no LAYERS parameter in URL: ${processedUrl}`
                    )
                }

                // Create WMS imagery provider
                imageryProvider = new Cesium.WebMapServiceImageryProvider({
                    url: baseUrl,
                    layers: wmsParams.LAYERS || '',
                    parameters: {
                        format: wmsParams.FORMAT || 'image/png',
                        transparent:
                            wmsParams.TRANSPARENT !== undefined
                                ? wmsParams.TRANSPARENT
                                : 'true',
                        version: wmsParams.VERSION || '1.1.1',
                        // Pass through other WMS params (STYLES, etc.)
                        ...Object.fromEntries(
                            Object.entries(wmsParams).filter(
                                ([key]) =>
                                    ![
                                        'SERVICE',
                                        'REQUEST',
                                        'LAYERS',
                                        'FORMAT',
                                        'TRANSPARENT',
                                        'VERSION',
                                        'SRS',
                                        'CRS',
                                    ].includes(key)
                            )
                        ),
                    },
                    enablePickFeatures: false,
                    maximumLevel: layerConfig.maxZoom || 18,
                    minimumLevel: layerConfig.minZoom || 0,
                })
            } else {
                // Use UrlTemplateImageryProvider for TMS/WMTS
                imageryProvider = new Cesium.UrlTemplateImageryProvider({
                    url: this._convertTileUrl(processedUrl, layerConfig.format),
                    maximumLevel: layerConfig.maxZoom || 18,
                    minimumLevel: layerConfig.minZoom || 0,
                })
            }

            // Add imagery provider (creates ImageryLayer wrapper)
            const layer =
                this.renderer.imageryLayers.addImageryProvider(imageryProvider)
            layer.alpha =
                layerConfig.opacity !== undefined ? layerConfig.opacity : 1.0

            // Store layer metadata including time config and COG config
            this._layers[name] = {
                type: 'tile',
                layer: layer,
                visible: true,
                timeConfig: timeConfig,
                format: layerConfig.format,
                maxZoom: layerConfig.maxZoom,
                minZoom: layerConfig.minZoom,
                opacity: layerConfig.opacity,
                order: layerConfig.order, // Store layer order for proper stacking
                // Store COG configuration for dynamic updates
                cogConfig: {
                    splitColonType: layerConfig.splitColonType,
                    cogTransform: layerConfig.cogTransform,
                    cogMin: layerConfig.cogMin,
                    cogMax: layerConfig.cogMax,
                    currentCogMin: layerConfig.currentCogMin,
                    currentCogMax: layerConfig.currentCogMax,
                    cogColormap: layerConfig.cogColormap,
                    cogExpression: layerConfig.cogExpression,
                    currentCogExpression: layerConfig.currentCogExpression,
                },
                originalUrl: layerConfig.path, // Store template URL for rebuilding
            }
            this._requestRender()
        } else if (type === 'vector' || type === 'clamped') {
            // Check if this layer is already being loaded (prevent duplicate async loads)
            if (this._loadingLayers[name]) {
                return
            }

            // Check if layer already exists and remove it first (prevents accumulation)
            const existingLayer = this._layers[name]
            if (existingLayer && existingLayer.type === 'vector') {
                this.renderer.dataSources.remove(existingLayer.dataSource)
            }

            // Mark as loading
            this._loadingLayers[name] = true

            // Add vector layer from GeoJSON
            // Extract default style (matches LithoSphere structure)
            const defaultStyle =
                layerConfig.style?.default || layerConfig.style || {}
            const letPropertiesOverride =
                layerConfig.style?.letPropertiesStyleOverride || false

            // Clone GeoJSON and inject internal IDs for fast lookups
            const geojsonWithIds = JSON.parse(
                JSON.stringify(layerConfig.geojson)
            )
            const featureMap = {}

            if (
                geojsonWithIds.features &&
                Array.isArray(geojsonWithIds.features)
            ) {
                geojsonWithIds.features.forEach((feature, index) => {
                    // Create internal ID: layerName_index
                    const internalId = `${name}_${index}`

                    // Store original feature (without injected ID)
                    featureMap[internalId] = layerConfig.geojson.features[index]

                    // Inject ID into cloned feature for Cesium
                    feature.id = internalId
                })
            }

            // Parse colors with fallbacks
            const strokeColor =
                Cesium.Color.fromCssColorString(
                    defaultStyle.color || '#ffffff'
                ) || Cesium.Color.WHITE
            const fillColor =
                Cesium.Color.fromCssColorString(
                    defaultStyle.fillColor || '#ffffff'
                ) || Cesium.Color.WHITE
            const fillOpacity = parseFloat(defaultStyle.fillOpacity)
            const fillWithAlpha = isNaN(fillOpacity)
                ? fillColor.withAlpha(0.5)
                : fillColor.withAlpha(fillOpacity)

            const dataSource = Cesium.GeoJsonDataSource.load(
                geojsonWithIds, // Use GeoJSON with injected IDs
                {
                    clampToGround: type === 'clamped', // Only clamp 'clamped' type, not 'vector'
                    stroke: strokeColor,
                    strokeWidth: defaultStyle.weight || 2,
                    fill: fillWithAlpha,
                    markerSize: defaultStyle.radius || 8,
                    markerColor: fillColor,
                }
            )

            dataSource.then((ds) => {
                // Clear loading flag
                delete this._loadingLayers[name]

                this.renderer.dataSources.add(ds)

                // Enable outlines on all polygon entities (disabled when clamped to terrain)
                ds.entities.values.forEach((entity) => {
                    if (entity.polygon) {
                        entity.polygon.outline = true
                    }
                })

                // Apply per-feature styles if enabled (matches LithoSphere behavior)
                if (letPropertiesOverride) {
                    ds.entities.values.forEach((entity) => {
                        const props = entity.properties
                        if (!props) return

                        // Try to get feature-specific style from properties
                        let featureStyle = null
                        try {
                            featureStyle = props.style?.getValue(
                                Cesium.JulianDate.now()
                            )
                        } catch (e) {
                            // If getValue fails, try direct access
                            featureStyle = props.style?._value || props.style
                        }

                        if (featureStyle) {
                            // Apply feature-specific styles to polygons
                            if (entity.polygon) {
                                if (featureStyle.fillColor) {
                                    const polygonFillColor =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.fillColor
                                        ) || Cesium.Color.WHITE
                                    const polygonOpacity =
                                        parseFloat(featureStyle.fillOpacity) !=
                                        null
                                            ? parseFloat(
                                                  featureStyle.fillOpacity
                                              )
                                            : parseFloat(
                                                  defaultStyle.fillOpacity
                                              ) || 0.5
                                    entity.polygon.material =
                                        polygonFillColor.withAlpha(
                                            polygonOpacity
                                        )
                                }
                                if (featureStyle.color) {
                                    const outlineColor =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.color
                                        )
                                    if (outlineColor) {
                                        entity.polygon.outlineColor =
                                            outlineColor
                                    }
                                }
                                if (featureStyle.weight != null) {
                                    entity.polygon.outlineWidth = parseFloat(
                                        featureStyle.weight
                                    )
                                }
                            }

                            // Apply feature-specific styles to polylines
                            if (entity.polyline) {
                                if (featureStyle.color) {
                                    const polylineColor =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.color
                                        )
                                    if (polylineColor) {
                                        entity.polyline.material = polylineColor
                                    }
                                }
                                if (featureStyle.weight != null) {
                                    entity.polyline.width = parseFloat(
                                        featureStyle.weight
                                    )
                                }
                            }

                            // Apply feature-specific styles to points
                            if (entity.point) {
                                if (featureStyle.radius != null) {
                                    entity.point.pixelSize = parseFloat(
                                        featureStyle.radius
                                    )
                                }
                                if (featureStyle.fillColor) {
                                    const pointColor =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.fillColor
                                        )
                                    if (pointColor) {
                                        entity.point.color = pointColor
                                    }
                                }
                            }

                            // Apply feature-specific styles to billboards (markers)
                            if (
                                entity.billboard &&
                                featureStyle.radius != null
                            ) {
                                entity.billboard.scale =
                                    parseFloat(featureStyle.radius) / 8 // Normalize to default size
                            }
                        }
                    })
                }

                // Store layer with onClick callback and feature mapping
                this._layers[name] = {
                    type: 'vector',
                    dataSource: ds,
                    visible: true,
                    onClick: layerConfig.onClick, // Store callback for global handler
                    featureMap: featureMap, // Store id→original feature mapping
                }
                this._requestRender()
            })
        } else if (type === 'gradient_polyline') {
            return this._addCesiumGradientPolyline(layerConfig)
        } else if (type === 'model') {
            // Model layers not implemented for core features
            console.warn('Model layers not yet supported for Cesium renderer')
        } else if (type === 'curtain') {
            // Curtain layers not implemented for core features
            console.warn('Curtain layers not yet supported for Cesium renderer')
        }
    }

    /**
     * Add a gradient polyline layer to Cesium.
     * Decomposes each LineString into per-segment colored polyline entities
     * using elevation from the 3rd coordinate and color from the chosen property
     * interpolated against the configured color ramp.
     * @param {object} layerConfig - { name, geojson, gradientSettings, layerObj }
     * @returns {string} Layer name used as ID for removal
     */
    _addCesiumGradientPolyline(layerConfig) {
        const { name, geojson, gradientSettings } = layerConfig
        const layerName = `${name}_gradient`

        // Remove existing gradient layer if present
        if (this._layers[layerName]) {
            this._removeCesiumGradientPolyline(layerName)
        }

        const colorWithProp = gradientSettings.colorWithProp
        const colorStops = buildColorStops(gradientSettings.colorRamp)
        const weight = gradientSettings.weight || 4

        // Collect all coordinate data with property values
        const segments = []
        let min = Infinity
        let max = -Infinity

        if (gradientSettings.connectAllPoints) {
            // Point features mode: collect [lng, lat, elevation, value] from each Point
            const points = []
            geojson.features.forEach((feature) => {
                if (
                    feature.geometry.type.toLowerCase() === 'point'
                ) {
                    const coords = feature.geometry.coordinates
                    const value = F_.getIn(
                        feature.properties,
                        colorWithProp,
                        0
                    )
                    if (min > value) min = value
                    if (max < value) max = value
                    points.push({
                        lng: coords[0],
                        lat: coords[1],
                        elev: coords[2] || 0,
                        value: value,
                    })
                }
            })
            // Build midpoint-to-midpoint segments from consecutive points
            if (points.length >= 2) {
                for (let i = 0; i < points.length; i++) {
                    const start =
                        i === 0
                            ? points[i]
                            : {
                                  lng: (points[i - 1].lng + points[i].lng) / 2,
                                  lat: (points[i - 1].lat + points[i].lat) / 2,
                                  elev: (points[i - 1].elev + points[i].elev) / 2,
                              }
                    const end =
                        i === points.length - 1
                            ? points[i]
                            : {
                                  lng: (points[i].lng + points[i + 1].lng) / 2,
                                  lat: (points[i].lat + points[i + 1].lat) / 2,
                                  elev: (points[i].elev + points[i + 1].elev) / 2,
                              }
                    if (start.lng === end.lng && start.lat === end.lat && start.elev === end.elev) continue
                    segments.push({
                        lng1: start.lng,
                        lat1: start.lat,
                        elev1: start.elev,
                        value: points[i].value,
                        lng2: end.lng,
                        lat2: end.lat,
                        elev2: end.elev,
                    })
                }
            }
        } else {
            // LineString/MultiLineString mode
            geojson.features.forEach((feature) => {
                const paths = []
                let path = []
                let prevParentIndex = null

                F_.coordinateDepthTraversal(
                    feature.geometry.coordinates,
                    (array, _path) => {
                        const splitPath = _path.split('.')
                        let parentIndex = null
                        if (splitPath.length >= 2) {
                            parentIndex =
                                splitPath[splitPath.length - 2]
                            if (
                                prevParentIndex != null &&
                                parentIndex != prevParentIndex
                            ) {
                                paths.push(path)
                                path = []
                            }
                        }
                        const props = getCoordProperties(
                            geojson,
                            feature,
                            array
                        )
                        const value = F_.getIn(
                            props,
                            colorWithProp,
                            0
                        )
                        if (min > value) min = value
                        if (max < value) max = value

                        path.push({
                            lng: array[0],
                            lat: array[1],
                            elev: array[2] || 0,
                            value: value,
                        })

                        prevParentIndex = parentIndex
                    }
                )
                if (path.length > 0) paths.push(path)

                // Build midpoint-to-midpoint segments so each vertex
                // P[i] owns the region from mid(P[i-1],P[i]) to mid(P[i],P[i+1]),
                // colored with P[i]'s value. This avoids misrepresenting data
                // by shifting color boundaries to midpoints between vertices.
                paths.forEach((p) => {
                    if (p.length < 2) return
                    for (let i = 0; i < p.length; i++) {
                        // Start point: midpoint with previous, or the vertex itself for first point
                        const start =
                            i === 0
                                ? p[i]
                                : {
                                      lng: (p[i - 1].lng + p[i].lng) / 2,
                                      lat: (p[i - 1].lat + p[i].lat) / 2,
                                      elev: (p[i - 1].elev + p[i].elev) / 2,
                                  }
                        // End point: midpoint with next, or the vertex itself for last point
                        const end =
                            i === p.length - 1
                                ? p[i]
                                : {
                                      lng: (p[i].lng + p[i + 1].lng) / 2,
                                      lat: (p[i].lat + p[i + 1].lat) / 2,
                                      elev: (p[i].elev + p[i + 1].elev) / 2,
                                  }
                        // Skip degenerate segments (first==last for single-point edges)
                        if (start.lng === end.lng && start.lat === end.lat && start.elev === end.elev) continue
                        segments.push({
                            lng1: start.lng,
                            lat1: start.lat,
                            elev1: start.elev,
                            value: p[i].value,
                            lng2: end.lng,
                            lat2: end.lat,
                            elev2: end.elev,
                        })
                    }
                })
            })
        }

        if (min === 0 && max === 0) max = 1

        // Create a CustomDataSource for all gradient segments
        const dataSource = new Cesium.CustomDataSource(layerName)

        segments.forEach((seg) => {
            let colorStr = interpolateMultipleColors(
                colorStops,
                seg.value,
                min,
                max
            )
            // Convert rgb() to hex for Cesium
            if (colorStr && colorStr.startsWith('rgb')) {
                colorStr = rgbToHex(colorStr)
            }
            const cesiumColor = colorStr
                ? Cesium.Color.fromCssColorString(colorStr)
                : Cesium.Color.WHITE

            dataSource.entities.add({
                polyline: {
                    positions:
                        Cesium.Cartesian3.fromDegreesArrayHeights([
                            seg.lng1,
                            seg.lat1,
                            seg.elev1,
                            seg.lng2,
                            seg.lat2,
                            seg.elev2,
                        ]),
                    material:
                        new Cesium.ColorMaterialProperty(cesiumColor),
                    width: weight,
                },
            })
        })

        // Add hoverable point entities at each vertex for value inspection
        const dropdownProps = gradientSettings.dropdownColorWithProp || []
        const allProps = dropdownProps.length > 0 ? dropdownProps : [colorWithProp]
        const addVertexPoints = (vertexList) => {
            vertexList.forEach((v) => {
                let descHtml = '<table style="font-size:13px">'
                allProps.forEach((prop) => {
                    const val = v.props ? F_.getIn(v.props, prop, '—') : v.value
                    descHtml += `<tr><td><b>${prop}</b></td><td>${val}</td></tr>`
                })
                descHtml += '</table>'
                let colorStr2 = interpolateMultipleColors(colorStops, v.value, min, max)
                if (colorStr2 && colorStr2.startsWith('rgb')) colorStr2 = rgbToHex(colorStr2)
                const ptColor = colorStr2 ? Cesium.Color.fromCssColorString(colorStr2) : Cesium.Color.WHITE
                dataSource.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(v.lng, v.lat, v.elev),
                    point: {
                        pixelSize: Math.max(weight + 2, 6),
                        color: ptColor,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1,
                    },
                    description: descHtml,
                })
            })
        }

        if (gradientSettings.connectAllPoints) {
            // vertices were collected in points array above scope — re-derive
            const vtx = []
            geojson.features.forEach((feature) => {
                if (feature.geometry.type.toLowerCase() === 'point') {
                    const coords = feature.geometry.coordinates
                    vtx.push({
                        lng: coords[0], lat: coords[1], elev: coords[2] || 0,
                        value: F_.getIn(feature.properties, colorWithProp, 0),
                        props: feature.properties,
                    })
                }
            })
            addVertexPoints(vtx)
        } else {
            geojson.features.forEach((feature) => {
                F_.coordinateDepthTraversal(
                    feature.geometry.coordinates,
                    (array) => {
                        const props = getCoordProperties(geojson, feature, array)
                        addVertexPoints([{
                            lng: array[0], lat: array[1], elev: array[2] || 0,
                            value: F_.getIn(props, colorWithProp, 0),
                            props: props,
                        }])
                    }
                )
            })
        }

        this.renderer.dataSources.add(dataSource)

        this._layers[layerName] = {
            type: 'gradient_polyline',
            dataSource: dataSource,
            visible: true,
        }

        this._requestRender()
        return layerName
    }

    /**
     * Remove a gradient polyline layer from Cesium
     * @param {string} layerName - Layer name (with _gradient suffix)
     */
    _removeCesiumGradientPolyline(layerName) {
        const layerInfo = this._layers[layerName]
        if (layerInfo && layerInfo.type === 'gradient_polyline') {
            this.renderer.dataSources.remove(layerInfo.dataSource)
            delete this._layers[layerName]
            this._requestRender()
        }
    }

    /**
     * Convert tile URL format from LithoSphere to Cesium
     */
    _convertTileUrl(path, format) {
        // TMS format: y origin at bottom
        // WMTS format: y origin at top
        if (format === 'tms') {
            // Cesium uses TMS by default
            return path
        } else {
            // For WMTS and other formats, may need URL transformation
            return path
        }
    }

    /**
     * Build complete TiTiler URL with query parameters for COG and STAC layers
     * @private
     * @param {string} baseUrl - Base URL template
     * @param {Object} layerConfig - Layer configuration with COG parameters
     * @returns {string} Complete URL with query parameters
     */
    _buildTiTilerUrl(baseUrl, layerConfig) {
        // Only process COG or STAC collection layers
        if (
            layerConfig.splitColonType !== 'COG' &&
            layerConfig.splitColonType !== 'stac-collection'
        ) {
            return baseUrl
        }

        // Build query parameters using shared function
        const queryParams = LayerUtils.buildTiTilerQueryParams({
            splitColonType: layerConfig.splitColonType,
            starttime: layerConfig.time?.start,
            endtime: layerConfig.time?.end,
            cogTransform: layerConfig.cogTransform,
            cogMin: layerConfig.cogMin,
            cogMax: layerConfig.cogMax,
            currentCogMin: layerConfig.currentCogMin,
            currentCogMax: layerConfig.currentCogMax,
            cogColormap: layerConfig.cogColormap,
            cogExpression: layerConfig.cogExpression,
            currentCogExpression: layerConfig.currentCogExpression,
        })

        // Append query parameters to URL
        if (queryParams) {
            const separator = baseUrl.indexOf('?') === -1 ? '?' : '&'
            return baseUrl + separator + queryParams
        }

        return baseUrl
    }

    /**
     * Calculate the correct index for a tile layer in the imageryLayers collection
     * based on the global layer ordering (L_._layersOrdered)
     */
    _calculateTileLayerIndex(layerName, orderedLayerNames) {
        if (!orderedLayerNames || !Array.isArray(orderedLayerNames)) {
            return undefined // Let Cesium add at default position (top)
        }

        // Get position in global order
        const globalIndex = orderedLayerNames.indexOf(layerName)
        if (globalIndex === -1) {
            return undefined // Layer not in order array
        }

        // Count how many tile layers should be BELOW this layer
        // (tile layers with lower index in orderedLayerNames)
        let tileBelowCount = 0
        for (let i = 0; i < globalIndex; i++) {
            const checkName = orderedLayerNames[i]
            const checkLayer = this._layers[checkName]
            // Only count visible tile layers
            if (
                checkLayer &&
                checkLayer.type === 'tile' &&
                checkLayer.visible
            ) {
                tileBelowCount++
            }
        }

        return tileBelowCount
    }

    /**
     * Parse WMS URL to extract base URL and parameters
     */
    _parseWmsUrl(url) {
        const urlSplit = url.split('?')
        const baseUrl = urlSplit[0]
        const queryString = urlSplit[1] || ''

        const wmsParams = {}
        if (queryString) {
            const urlParams = new URLSearchParams(queryString)
            for (const [key, value] of urlParams.entries()) {
                // WMS parameters are case-insensitive, store as uppercase
                wmsParams[key.toUpperCase()] = value
            }
        }

        return { baseUrl, wmsParams }
    }

    /**
     * Replace time parameters in URL with actual time values
     */
    _replaceTimeParameters(url, timeConfig) {
        if (!timeConfig || !timeConfig.enabled) return url

        // Create time formatter based on layer's time format
        // Default to ISO format if no format specified
        const timeFormat =
            timeConfig.format == null || timeConfig.format == ''
                ? utcFormat('%Y-%m-%dT%H:%M:%SZ')
                : utcFormat(timeConfig.format)

        let processedUrl = url

        // Replace {time} and {endtime} with formatted end time
        if (timeConfig.end) {
            const formattedEnd = timeFormat(Date.parse(timeConfig.end))
            processedUrl = processedUrl
                .replace(/{time}/g, formattedEnd)
                .replace(/{endtime}/g, formattedEnd)
        }

        // Replace {starttime} with formatted start time
        if (timeConfig.start) {
            const formattedStart = timeFormat(Date.parse(timeConfig.start))
            processedUrl = processedUrl.replace(/{starttime}/g, formattedStart)
        }

        // Replace {customtime.N}
        if (timeConfig.customTimes?.times) {
            for (let i = 0; i < timeConfig.customTimes.times.length; i++) {
                const regex = new RegExp(`\\{customtime\\.${i}\\}`, 'g')
                const formattedCustomTime = timeFormat(
                    Date.parse(timeConfig.customTimes.times[i])
                )
                processedUrl = processedUrl.replace(regex, formattedCustomTime)
            }
        }

        return processedUrl
    }

    /**
     * Update time parameters for a specific layer
     */
    updateLayerTime(layerName, startTime, endTime, customTimes) {
        const layerInfo = this._layers[layerName]
        if (
            !layerInfo ||
            !layerInfo.timeConfig ||
            !layerInfo.timeConfig.enabled
        ) {
            return
        }

        // Update time configuration
        layerInfo.timeConfig.start = startTime
        layerInfo.timeConfig.end = endTime
        layerInfo.timeConfig.customTimes = customTimes

        // Refresh the layer
        this._refreshTimeEnabledLayer(layerName)
    }

    /**
     * Update COG parameters for a layer and refresh
     * @param {string} layerName - Name of the layer to update
     * @param {Object} cogParams - COG parameters to update (partial update supported)
     */
    updateLayerCogParameters(layerName, cogParams) {
        const layerInfo = this._layers[layerName]

        // Validate layer exists and has COG config
        if (!layerInfo || layerInfo.type !== 'tile' || !layerInfo.cogConfig) {
            return
        }

        // Update COG parameters (merge with existing)
        Object.assign(layerInfo.cogConfig, cogParams)

        // Refresh the layer with new parameters
        this._refreshCogEnabledLayer(layerName)
    }

    /**
     * Refresh a COG-enabled layer by recreating imagery provider with updated parameters
     * @private
     * @param {string} layerName - Name of the layer to refresh
     */
    _refreshCogEnabledLayer(layerName) {
        const layerInfo = this._layers[layerName]

        // Only refresh Cesium tile layers
        if (
            this.rendererType !== 'cesium' ||
            !layerInfo ||
            layerInfo.type !== 'tile'
        ) {
            return
        }

        // Store current state
        const alpha = layerInfo.layer.alpha
        const show = layerInfo.layer.show
        const index = this.renderer.imageryLayers.indexOf(layerInfo.layer)

        // Remove old imagery layer
        this.renderer.imageryLayers.remove(layerInfo.layer)

        // Build URL with updated COG parameters
        let url = layerInfo.originalUrl

        // Apply time parameters if enabled
        if (layerInfo.timeConfig?.enabled) {
            url = this._replaceTimeParameters(url, layerInfo.timeConfig)
        }

        // Build complete URL with COG query parameters
        url = this._buildTiTilerUrl(url, {
            ...layerInfo.cogConfig,
            time: layerInfo.timeConfig,
        })

        // Create new imagery provider
        let newProvider

        if (layerInfo.format === 'wms') {
            const { baseUrl, wmsParams } = this._parseWmsUrl(url)
            newProvider = new Cesium.WebMapServiceImageryProvider({
                url: baseUrl,
                layers: wmsParams.LAYERS || '',
                parameters: wmsParams,
            })
        } else {
            newProvider = new Cesium.UrlTemplateImageryProvider({
                url: this._convertTileUrl(url, layerInfo.format),
                maximumLevel: layerInfo.maxZoom || 18,
                minimumLevel: layerInfo.minZoom || 0,
            })
        }

        // Add new imagery layer
        const newLayer =
            this.renderer.imageryLayers.addImageryProvider(newProvider)

        // Restore state
        newLayer.alpha = alpha
        newLayer.show = show

        // Restore layer order
        if (index >= 0) {
            const currentIndex = this.renderer.imageryLayers.indexOf(newLayer)
            if (currentIndex !== index) {
                this.renderer.imageryLayers.remove(newLayer, false)
                this.renderer.imageryLayers.add(newLayer, index)
            }
        }

        // Update reference
        layerInfo.layer = newLayer
    }

    /**
     * Refresh a time-enabled layer by recreating its imagery provider
     */
    _refreshTimeEnabledLayer(layerName) {
        const layerInfo = this._layers[layerName]

        if (
            this.rendererType !== 'cesium' ||
            layerInfo.type !== 'tile' ||
            !layerInfo.timeConfig?.enabled
        ) {
            return
        }

        // Store current state
        const alpha = layerInfo.layer.alpha
        const show = layerInfo.layer.show
        const index = this.renderer.imageryLayers.indexOf(layerInfo.layer)

        // Remove old layer
        this.renderer.imageryLayers.remove(layerInfo.layer)

        // Create new URL with updated time parameters
        let url = this._replaceTimeParameters(
            layerInfo.timeConfig.originalUrl,
            layerInfo.timeConfig
        )

        // Add COG parameters to preserve rescale/colormap/expression when time changes
        if (layerInfo.cogConfig) {
            url = this._buildTiTilerUrl(url, {
                ...layerInfo.cogConfig,
                time: layerInfo.timeConfig,
            })
        }

        let newProvider

        // Create appropriate provider based on format
        if (layerInfo.format === 'wms') {
            const { baseUrl, wmsParams } = this._parseWmsUrl(url)

            newProvider = new Cesium.WebMapServiceImageryProvider({
                url: baseUrl,
                layers: wmsParams.LAYERS || '',
                parameters: {
                    format: wmsParams.FORMAT || 'image/png',
                    transparent:
                        wmsParams.TRANSPARENT !== undefined
                            ? wmsParams.TRANSPARENT
                            : 'true',
                    version: wmsParams.VERSION || '1.1.1',
                    ...Object.fromEntries(
                        Object.entries(wmsParams).filter(
                            ([key]) =>
                                ![
                                    'SERVICE',
                                    'REQUEST',
                                    'LAYERS',
                                    'FORMAT',
                                    'TRANSPARENT',
                                    'VERSION',
                                    'SRS',
                                    'CRS',
                                ].includes(key)
                        )
                    ),
                },
                enablePickFeatures: false,
                maximumLevel: layerInfo.maxZoom || 18,
                minimumLevel: layerInfo.minZoom || 0,
            })
        } else {
            newProvider = new Cesium.UrlTemplateImageryProvider({
                url: this._convertTileUrl(url, layerInfo.format),
                maximumLevel: layerInfo.maxZoom || 18,
                minimumLevel: layerInfo.minZoom || 0,
            })
        }

        // Add new layer using addImageryProvider (returns ImageryLayer)
        const newLayer =
            this.renderer.imageryLayers.addImageryProvider(newProvider)
        newLayer.alpha = alpha
        newLayer.show = show

        // Move to correct position if not already there
        const currentIndex = this.renderer.imageryLayers.indexOf(newLayer)
        if (currentIndex !== index && index >= 0) {
            this.renderer.imageryLayers.remove(newLayer, false)
            this.renderer.imageryLayers.add(newLayer, index)
        }

        // Update reference
        layerInfo.layer = newLayer
    }

    /**
     * Update all time-enabled layers with new time values
     */
    updateAllTimeEnabledLayers(startTime, currentTime, endTime) {
        if (this.rendererType !== 'cesium') return

        // Access TimeControl if available
        const customTimes =
            typeof TimeControl !== 'undefined' ? TimeControl.customTimes : null

        for (const layerName in this._layers) {
            const layerInfo = this._layers[layerName]
            if (layerInfo.timeConfig?.enabled) {
                this.updateLayerTime(
                    layerName,
                    startTime,
                    currentTime,
                    customTimes
                )
            }
        }
    }

    /**
     * Remove a layer from the globe
     * @param {string} name - Layer name
     */
    removeLayer(name) {
        if (this.rendererType === 'lithosphere') {
            // Gradient polylines are Cesium-only; skip for LithoSphere
            if (this._layers && this._layers[name]?.type === 'gradient_polyline') return
            return this.renderer.removeLayer(name)
        } else {
            const layerInfo = this._layers[name]
            if (layerInfo) {
                if (layerInfo.type === 'tile') {
                    this.renderer.imageryLayers.remove(layerInfo.layer)
                } else if (layerInfo.type === 'gradient_polyline') {
                    this._removeCesiumGradientPolyline(name)
                    return
                } else if (layerInfo.type === 'vector') {
                    const removed = this.renderer.dataSources.remove(
                        layerInfo.dataSource
                    )
                }
                // Clean up feature mapping
                if (layerInfo.featureMap) {
                    delete layerInfo.featureMap
                }
                delete this._layers[name]
                this._requestRender()
            }
        }
    }

    /**
     * Toggle layer visibility
     * @param {string} name - Layer name
     * @param {boolean} visible - Visibility state
     */
    toggleLayer(name, visible) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.toggleLayer(name, visible)
        }

        const layerInfo = this._layers[name]
        if (!layerInfo) return

        if (layerInfo.type === 'tile') {
            if (visible && !layerInfo.visible) {
                // Turning layer ON - need to re-add at correct position

                // Calculate correct index based on layer order
                const correctIndex = this._calculateTileLayerIndex(
                    name,
                    layerInfo.order
                )

                // Remove if already in collection (shouldn't be, but safe)
                if (this.renderer.imageryLayers.contains(layerInfo.layer)) {
                    this.renderer.imageryLayers.remove(layerInfo.layer)
                }

                // Re-add at correct position
                const newLayer = this.renderer.imageryLayers.add(
                    layerInfo.layer,
                    correctIndex
                )

                // Update reference (in case Cesium creates a new wrapper)
                if (newLayer) layerInfo.layer = newLayer
            } else if (!visible && layerInfo.visible) {
                // Turning layer OFF - remove from collection
                this.renderer.imageryLayers.remove(layerInfo.layer)
            }

            layerInfo.visible = visible
        } else if (
            layerInfo.type === 'vector' ||
            layerInfo.type === 'gradient_polyline'
        ) {
            // Vector and gradient polyline layers use simple visibility toggle
            layerInfo.dataSource.show = visible
            layerInfo.visible = visible
        }
        this._requestRender()
    }

    /**
     * Check if layer exists
     * @param {string} name - Layer name
     */
    hasLayer(name) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.hasLayer(name)
        } else {
            return name in this._layers
        }
    }

    /**
     * Get current center view
     * @returns {object} { lng, lat, zoom }
     */
    getCenter() {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.getCenter()
        } else {
            const camera = this.renderer.camera
            const center = camera.positionCartographic

            return {
                lng: Cesium.Math.toDegrees(center.longitude),
                lat: Cesium.Math.toDegrees(center.latitude),
                zoom: this._heightToZoom(center.height), // Convert height to Leaflet zoom
            }
        }
    }

    /**
     * Set center view
     * @param {object|array} view - { lng, lat, zoom } or [lat, lng, zoom]
     */
    setCenter(view) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.setCenter(view)
        } else {
            let lng, lat, zoom

            if (Array.isArray(view)) {
                ;[lat, lng, zoom] = view
            } else {
                ;({ lng, lat, zoom } = view)
            }

            this.renderer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(
                    lng,
                    lat,
                    this._zoomToHeight(zoom)
                ),
            })
        }
    }

    /**
     * Set layer opacity
     * @param {string} name - Layer name
     * @param {number} opacity - Opacity value (0-1)
     */
    setLayerOpacity(name, opacity) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.setLayerOpacity(name, opacity)
        } else {
            const layerInfo = this._layers[name]
            if (layerInfo && layerInfo.type === 'tile') {
                layerInfo.layer.alpha = opacity
                this._requestRender()
            }
        }
    }

    /**
     * Set layer filter effects (brightness, contrast, etc.)
     * @param {string} name - Layer name
     * @param {string} filter - Filter type
     * @param {number} value - Filter value
     */
    setLayerFilterEffect(name, filter, value) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.setLayerFilterEffect(name, filter, value)
        } else {
            // Cesium doesn't have direct filter effects like this
            // Could be implemented with post-processing stages
            console.warn('Filter effects not yet supported for Cesium renderer')
        }
    }

    /**
     * Order layers
     * @param {array} orderedLayerNames - Array of layer names in order
     */
    orderLayers(orderedLayerNames) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.orderLayers(orderedLayerNames)
        }

        if (this.rendererType !== 'cesium') return

        // Update order reference for all layers
        for (const name in this._layers) {
            this._layers[name].order = orderedLayerNames
        }

        // Reorder all visible tile layers
        const visibleTileLayers = []

        // Collect all visible tile layers with their desired position
        for (const name of orderedLayerNames) {
            const layerInfo = this._layers[name]
            if (layerInfo && layerInfo.type === 'tile' && layerInfo.visible) {
                visibleTileLayers.push({ name, layerInfo })
            }
        }

        // Remove all tile layers from collection
        for (const { layerInfo } of visibleTileLayers) {
            this.renderer.imageryLayers.remove(layerInfo.layer)
        }

        // Re-add in correct order (bottom to top)
        for (let i = 0; i < visibleTileLayers.length; i++) {
            const { layerInfo } = visibleTileLayers[i]
            const newLayer = this.renderer.imageryLayers.add(layerInfo.layer, i)
            // Update reference
            if (newLayer) layerInfo.layer = newLayer
        }
        this._requestRender()
    }

    /**
     * Setup global click handler for Cesium (single handler for all layers)
     */
    _setupGlobalClickHandler() {
        if (this.rendererType !== 'cesium') return

        this._cesiumClickHandler = new Cesium.ScreenSpaceEventHandler(
            this.renderer.scene.canvas
        )

        this._cesiumClickHandler.setInputAction((click) => {
            // Check event loop prevention flag
            if (this._justSelectedFromMap) {
                return
            }

            const pickedObject = this.renderer.scene.pick(click.position)
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                const entity = pickedObject.id

                // Find which layer this entity belongs to
                for (const layerName of Object.keys(this._layers)) {
                    const layerInfo = this._layers[layerName]

                    if (layerInfo.type === 'vector' && layerInfo.dataSource) {
                        // Check if this dataSource contains the clicked entity
                        if (layerInfo.dataSource.entities.contains(entity)) {
                            // Found the layer - call its onClick callback
                            if (layerInfo.onClick && layerInfo.featureMap) {
                                // Get original feature using entity.id (instant O(1) lookup)
                                const originalFeature =
                                    layerInfo.featureMap[entity.id]

                                if (originalFeature) {
                                    // Get lng/lat from entity based on geometry type
                                    let lng, lat

                                    if (entity.position) {
                                        // Point feature with position
                                        const cartographic =
                                            Cesium.Cartographic.fromCartesian(
                                                entity.position.getValue(
                                                    Cesium.JulianDate.now()
                                                )
                                            )
                                        lng = Cesium.Math.toDegrees(
                                            cartographic.longitude
                                        )
                                        lat = Cesium.Math.toDegrees(
                                            cartographic.latitude
                                        )
                                    } else if (entity.polygon) {
                                        // Polygon - use click position
                                        const cartesian =
                                            this.renderer.camera.pickEllipsoid(
                                                click.position,
                                                this.renderer.scene.globe
                                                    .ellipsoid
                                            )
                                        if (cartesian) {
                                            const cartographic =
                                                Cesium.Cartographic.fromCartesian(
                                                    cartesian
                                                )
                                            lng = Cesium.Math.toDegrees(
                                                cartographic.longitude
                                            )
                                            lat = Cesium.Math.toDegrees(
                                                cartographic.latitude
                                            )
                                        }
                                    } else if (entity.polyline) {
                                        // Polyline - use click position
                                        const cartesian =
                                            this.renderer.camera.pickEllipsoid(
                                                click.position,
                                                this.renderer.scene.globe
                                                    .ellipsoid
                                            )
                                        if (cartesian) {
                                            const cartographic =
                                                Cesium.Cartographic.fromCartesian(
                                                    cartesian
                                                )
                                            lng = Cesium.Math.toDegrees(
                                                cartographic.longitude
                                            )
                                            lat = Cesium.Math.toDegrees(
                                                cartographic.latitude
                                            )
                                        }
                                    }

                                    if (lng != null && lat != null) {
                                        // Call onClick with ORIGINAL feature (no reconstruction needed!)
                                        layerInfo.onClick(
                                            originalFeature,
                                            [lng, lat],
                                            { name: layerName }
                                        )
                                    }
                                }
                            }
                            // Found and handled the layer, stop searching
                            break
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    }

    /**
     * Get elevation at a given lng/lat
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @returns {number} Elevation in meters
     */
    getElevationAtLngLat(lng, lat) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.getElevationAtLngLat(lng, lat)
        } else {
            // Cesium terrain sampling is async, return 0 for now
            return 0
        }
    }

    /**
     * Get cameras
     */
    getCameras() {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.getCameras()
        } else {
            // Return mock cameras for compatibility
            return {}
        }
    }

    /**
     * Get the renderer container element
     * @returns {HTMLElement} The container DOM element
     */
    getContainer() {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.getContainer()
        } else {
            // For Cesium, return the viewer's container
            return (
                this.renderer.container ||
                document.getElementById(this.containerId)
            )
        }
    }

    /**
     * Invalidate size (for resize handling)
     */
    invalidateSize() {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.invalidateSize()
        } else {
            // Cesium needs to resize after DOM updates complete
            // Use requestAnimationFrame to ensure layout has been applied
            requestAnimationFrame(() => {
                this.renderer.resize()
            })
        }
    }

    /**
     * Set layer-specific options
     */
    setLayerSpecificOptions(name, options) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.setLayerSpecificOptions(name, options)
        } else {
            console.warn(
                'setLayerSpecificOptions not yet supported for Cesium renderer'
            )
        }
    }

    /**
     * Add control to the globe
     * @param {string} id - Control ID
     * @param {object} control - Control object
     * @param {object} options - Control options
     */
    addControl(id, control, options) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.addControl(id, control, options)
        } else {
            // Handle special controls for Cesium
            if (id === 'mmgisLithoLink') {
                return this._setupCesiumLinkControl(options)
            }
            // Return a mock control object for other controls
            return {}
        }
    }

    /**
     * Create control container for Cesium UI controls
     * Matches LithoSphere's control container structure
     */
    _createCesiumControlContainer() {
        // Find the cesium-widget container that Cesium creates
        const cesiumWidget = document.querySelector('.cesium-widget')
        if (!cesiumWidget) {
            console.error('Cesium widget container not found')
            return
        }

        const controlsDiv = document.createElement('div')
        controlsDiv.setAttribute('id', '_cesium_controls_topleft')
        controlsDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 5px;
            pointer-events: none;
        `
        cesiumWidget.appendChild(controlsDiv)
        this._controlContainer = controlsDiv
    }

    /**
     * Create link button UI
     * Matches LithoSphere's link control styling
     */
    _createLinkButton(linkControl) {
        const button = document.createElement('div')
        button.setAttribute('id', '_cesium_control_link')
        button.style.cssText = `
            width: 26px;
            height: 26px;
            background: #1d1f20;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: all;
            transition: background 0.2s;
        `

        // Use SVG instead of MDI icons (matches LithoSphere)
        button.innerHTML = `
            <svg style="width:18px; height:18px; color: white;" viewBox="0 0 24 24">
                <path fill="currentColor" d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z" />
            </svg>
        `

        // Add hover effect
        button.addEventListener('mouseenter', () => {
            if (!linkControl._isLinked) {
                button.style.background = '#2d2f30'
            }
        })
        button.addEventListener('mouseleave', () => {
            if (!linkControl._isLinked) {
                button.style.background = '#1d1f20'
            }
        })

        // Add click handler
        button.addEventListener('click', () => {
            linkControl.toggleLink()
        })

        this._controlContainer.appendChild(button)
        linkControl._buttonElement = button
    }

    /**
     * Setup link control for Cesium to sync with map
     * @param {object} options - Control options with callbacks
     */
    _setupCesiumLinkControl(options) {
        const linkControl = {
            _isLinked: options.initiallyLinked || false,
            _linkPanned: false, // Flag to prevent feedback loops
            _linkPannedTimeout: null, // Timeout ID for clearing the flag
            _options: options,
            _moveEndListener: null,
            _mouseMoveListener: null,
            _mouseOutListener: null,
            _buttonElement: null,

            isLinked: function () {
                return this._isLinked
            },

            toggleLink: function () {
                this._isLinked = !this._isLinked
                this._updateButtonState()
                if (this._options.onToggle) {
                    this._options.onToggle(this._isLinked)
                }
            },

            setLinked: function (linked) {
                this._isLinked = linked
                this._updateButtonState()
                if (this._options.onToggle) {
                    this._options.onToggle(this._isLinked)
                }
            },

            _updateButtonState: function () {
                if (this._buttonElement) {
                    const svg = this._buttonElement.querySelector('svg')
                    if (this._isLinked) {
                        // Active state: yellow background, black icon
                        this._buttonElement.style.background = '#ffdd5c'
                        svg.style.color = 'black'
                    } else {
                        // Inactive state: dark background, white icon
                        this._buttonElement.style.background = '#1d1f20'
                        svg.style.color = 'white'
                    }
                }
            },
        }

        // Create the UI button
        this._createLinkButton(linkControl)

        // Initialize button state
        linkControl._updateButtonState()

        const viewer = this.renderer
        const scene = viewer.scene
        const canvas = scene.canvas

        // Track camera movement and call onMove when camera stops moving
        let cameraMoveTimeout = null
        const onCameraMove = () => {
            if (!linkControl._isLinked) return

            clearTimeout(cameraMoveTimeout)
            cameraMoveTimeout = setTimeout(() => {
                const center = this.getCenter()
                if (options.onMove) {
                    // Set flag before notifying Map to prevent feedback loop
                    linkControl._linkPanned = true
                    options.onMove(center.lng, center.lat, 0)
                    // Clear flag after 500ms (matches LithoSphere timing)
                    clearTimeout(linkControl._linkPannedTimeout)
                    linkControl._linkPannedTimeout = setTimeout(() => {
                        linkControl._linkPanned = false
                    }, 500)
                }
                if (options.onOrbitalUpdate) {
                    options.onOrbitalUpdate()
                }
            }, 100) // Debounce to avoid excessive calls
        }

        // Listen to camera move end
        linkControl._moveEndListener =
            viewer.camera.moveEnd.addEventListener(onCameraMove)

        // Track mouse movement over the globe
        const handler = new Cesium.ScreenSpaceEventHandler(canvas)

        let mouseMoveRafPending = false
        handler.setInputAction((movement) => {
            if (!linkControl._isLinked) return
            if (mouseMoveRafPending) return
            mouseMoveRafPending = true
            requestAnimationFrame(() => {
                mouseMoveRafPending = false
                const cartesian = viewer.camera.pickEllipsoid(
                    movement.endPosition,
                    scene.globe.ellipsoid
                )
                if (cartesian) {
                    const cartographic =
                        Cesium.Cartographic.fromCartesian(cartesian)
                    const lng = Cesium.Math.toDegrees(cartographic.longitude)
                    const lat = Cesium.Math.toDegrees(cartographic.latitude)

                    // Update mouse position
                    this.mouse.lng = lng
                    this.mouse.lat = lat

                    if (options.onMouseMove) {
                        options.onMouseMove(lng, lat)
                    }
                }
            })
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

        linkControl._mouseMoveListener = handler

        // Handle mouse leaving the canvas
        canvas.addEventListener('mouseout', () => {
            if (!linkControl._isLinked) return
            if (options.onMouseOut) {
                options.onMouseOut()
            }
        })

        // Store handler reference for cleanup
        linkControl._handler = handler

        // Add public API methods for Map to control Globe
        // These are called by Map_.js when the map moves or mouse events occur
        const self = this

        linkControl.linkMove = function (lng, lat) {
            // Called when the Map moves - update Globe view
            // Check flag to prevent feedback loop (skip if user just panned Globe)
            if (this._isLinked && !this._linkPanned) {
                self.setCenter({ lng, lat, zoom: self.getCenter().zoom })
            }
        }

        linkControl.linkMouseMove = function (lng, lat) {
            // Called when mouse moves over Map - could show indicator on Globe
            // For now, just a placeholder that matches LithoSphere's interface
            if (this._isLinked) {
                // Future: Could add a marker/indicator at this position on the Globe
            }
        }

        linkControl.linkMouseOut = function () {
            // Called when mouse leaves Map - remove any indicators
            if (this._isLinked) {
                // Future: Could remove marker/indicator from Globe
            }
        }

        return linkControl
    }

    /**
     * Highlight a feature (called from Map selection)
     * @param {string} layerName - Layer name
     * @param {object} feature - GeoJSON feature to highlight
     */
    highlightFeature(layerName, feature) {
        // Clear previous highlight
        this.clearHighlight()

        if (this.rendererType === 'lithosphere') {
            this._highlightFeatureLithoSphere(layerName, feature)
        } else {
            this._highlightFeatureCesium(layerName, feature)
        }
    }

    /**
     * Highlight feature in LithoSphere
     */
    _highlightFeatureLithoSphere(layerName, feature) {
        if (!this.renderer.layers) return

        // Try vector layers first
        const vectorLayers = this.renderer.layers.vector || []
        for (let i = 0; i < vectorLayers.length; i++) {
            const layer = vectorLayers[i]
            if (layer.name !== layerName) continue

            // Search through meshes for matching feature
            if (layer.meshes && layer.meshes.children) {
                for (let j = 0; j < layer.meshes.children.length; j++) {
                    const mesh = layer.meshes.children[j]
                    if (
                        mesh.feature &&
                        this._compareFeaturesForLitho(mesh.feature, feature)
                    ) {
                        // Found matching feature - set active flag
                        mesh.feature._active = true

                        // Store reference for clearing later
                        this._lithoActiveFeature = {
                            layerName: layerName,
                            type: 'vector',
                            obj: mesh,
                            feature: mesh.feature,
                        }

                        // Trigger restyle
                        if (mesh.restyle) {
                            mesh.restyle()
                        }
                        return
                    }
                }
            }
        }

        // Try clamped layers
        const clampedLayers = this.renderer.layers.clamped || []
        for (let i = 0; i < clampedLayers.length; i++) {
            const layer = clampedLayers[i]
            if (layer.name !== layerName) continue

            // Search through geojson features
            if (layer.geojson && layer.geojson.features) {
                for (let j = 0; j < layer.geojson.features.length; j++) {
                    const f = layer.geojson.features[j]
                    if (this._compareFeaturesForLitho(f, feature)) {
                        // Found matching feature - set active flag
                        f._active = true

                        // Store reference for clearing later
                        this._lithoActiveFeature = {
                            layerName: layerName,
                            type: 'clamped',
                            layer: layer,
                            feature: f,
                        }

                        // Trigger tile update for clamped layers
                        if (
                            this.renderer._ &&
                            this.renderer._.tiledWorld &&
                            typeof this.renderer._.tiledWorld
                                .updateClampedRasterForLayer === 'function'
                        ) {
                            // Update all tiles for this layer
                            this.renderer._.tiledWorld.updateAllRasters()
                        }
                        return
                    }
                }
            }
        }
    }

    /**
     * Highlight feature in Cesium
     */
    _highlightFeatureCesium(layerName, feature) {
        // Find the layer
        const layerInfo = this._layers[layerName]
        if (!layerInfo || layerInfo.type !== 'vector') {
            return
        }

        const dataSource = layerInfo.dataSource
        if (!dataSource || !layerInfo.featureMap) {
            return
        }

        // Find the internal ID for this feature (deep comparison - matches Layers_.js)
        let internalId = null
        for (const [id, storedFeature] of Object.entries(
            layerInfo.featureMap
        )) {
            // Compare geometry (handles deep cloned features)
            const geometryMatch = this._compareGeometry(
                storedFeature.geometry,
                feature.geometry
            )

            if (geometryMatch) {
                // Also compare properties to ensure correct match
                const propsMatch = this._compareFeatureProps(
                    storedFeature.properties,
                    feature.properties
                )

                if (propsMatch) {
                    internalId = id
                    break
                }
            }
        }

        if (internalId) {
            // Use ID to get entity instantly (O(1) lookup)
            const entity = dataSource.entities.getById(internalId)
            if (entity) {
                this._highlightEntity(entity)
            }
        }
    }

    /**
     * Extract GeoJSON geometry from Cesium entity
     */
    _extractGeometryFromEntity(entity) {
        // For polygon
        if (entity.polygon && entity.polygon.hierarchy) {
            try {
                const hierarchy = entity.polygon.hierarchy.getValue(
                    Cesium.JulianDate.now()
                )
                const positions = hierarchy.positions || []

                const coordinates = []
                for (let i = 0; i < positions.length; i++) {
                    const cartographic = Cesium.Cartographic.fromCartesian(
                        positions[i]
                    )
                    coordinates.push([
                        Cesium.Math.toDegrees(cartographic.longitude),
                        Cesium.Math.toDegrees(cartographic.latitude),
                    ])
                }

                // Close the polygon if not already closed
                if (
                    coordinates.length > 0 &&
                    (coordinates[0][0] !==
                        coordinates[coordinates.length - 1][0] ||
                        coordinates[0][1] !==
                            coordinates[coordinates.length - 1][1])
                ) {
                    coordinates.push([...coordinates[0]])
                }

                return {
                    type: 'Polygon',
                    coordinates: [coordinates],
                }
            } catch (e) {
                console.warn('Failed to extract polygon geometry', e)
            }
        }

        // For polyline
        if (entity.polyline && entity.polyline.positions) {
            try {
                const positions = entity.polyline.positions.getValue(
                    Cesium.JulianDate.now()
                )

                const coordinates = []
                for (let i = 0; i < positions.length; i++) {
                    const cartographic = Cesium.Cartographic.fromCartesian(
                        positions[i]
                    )
                    coordinates.push([
                        Cesium.Math.toDegrees(cartographic.longitude),
                        Cesium.Math.toDegrees(cartographic.latitude),
                    ])
                }

                return {
                    type: 'LineString',
                    coordinates: coordinates,
                }
            } catch (e) {
                console.warn('Failed to extract polyline geometry', e)
            }
        }

        // For point
        if (entity.position) {
            try {
                const position = entity.position.getValue(
                    Cesium.JulianDate.now()
                )
                const cartographic = Cesium.Cartographic.fromCartesian(position)

                return {
                    type: 'Point',
                    coordinates: [
                        Cesium.Math.toDegrees(cartographic.longitude),
                        Cesium.Math.toDegrees(cartographic.latitude),
                    ],
                }
            } catch (e) {
                console.warn('Failed to extract point geometry', e)
            }
        }

        // Fallback - return null geometry
        return null
    }

    /**
     * Round coordinates to specified precision
     * @param {Array} coords - Coordinate array (can be nested)
     * @param {number} precision - Number of decimal places
     * @returns {Array} Rounded coordinates
     */
    _roundCoordinates(coords, precision) {
        if (typeof coords[0] === 'number') {
            // Single coordinate pair [lng, lat]
            return coords.map((c) => parseFloat(c.toFixed(precision)))
        } else {
            // Nested array of coordinates
            return coords.map((c) => this._roundCoordinates(c, precision))
        }
    }

    /**
     * Round geometry coordinates to GEOJSON_PRECISION
     * @param {Object} geometry - GeoJSON geometry object
     * @returns {Object} Geometry with rounded coordinates
     */
    _roundGeometry(geometry) {
        if (!geometry || !geometry.coordinates) return geometry
        const rounded = JSON.parse(JSON.stringify(geometry))
        rounded.coordinates = this._roundCoordinates(rounded.coordinates, 10) // 10 = GEOJSON_PRECISION
        return rounded
    }

    /**
     * Compare two GeoJSON geometries with precision-aware comparison
     * Rounds coordinates to GEOJSON_PRECISION before comparing
     */
    _compareGeometry(geometry1, geometry2) {
        if (!geometry1 && !geometry2) return true
        if (!geometry1 || !geometry2) return false

        // Round both geometries to GEOJSON_PRECISION before comparing
        // This accounts for precision differences between Cesium (which receives
        // precision-reduced GeoJSON) and Leaflet (which has full precision)
        const rounded1 = this._roundGeometry(geometry1)
        const rounded2 = this._roundGeometry(geometry2)

        // Compare rounded geometries
        return JSON.stringify(rounded1) === JSON.stringify(rounded2)
    }

    /**
     * Compare feature properties (excluding internal metadata)
     * Matches Layers_.js selectFeature comparison (lines 2076-2098)
     */
    _compareFeatureProps(props1, props2) {
        if (!props1 && !props2) return true
        if (!props1 || !props2) return false

        // Clone and strip internal properties (matches Layers_.js pattern)
        const cleanProps1 = { ...props1 }
        const cleanProps2 = { ...props2 }

        // Remove internal properties that Layers_.js removes
        delete cleanProps1._
        delete cleanProps1._dataset
        delete cleanProps1._geodataset
        delete cleanProps1.feature_id

        delete cleanProps2._
        delete cleanProps2._dataset
        delete cleanProps2._geodataset
        delete cleanProps2.feature_id

        // Simple JSON stringify comparison
        return JSON.stringify(cleanProps1) === JSON.stringify(cleanProps2)
    }

    /**
     * Compare two features for LithoSphere (plain objects)
     */
    _compareFeaturesForLitho(feature1, feature2) {
        if (!feature1 || !feature2) return false
        if (!feature1.properties || !feature2.properties) return false

        // Get all property keys from both features
        const keys1 = Object.keys(feature1.properties)
        const keys2 = Object.keys(feature2.properties)

        // Filter out internal properties
        const filterInternal = (key) => {
            return (
                key !== '_' &&
                key !== '_dataset' &&
                key !== '_geodataset' &&
                key !== 'feature_id' &&
                key !== '_active' &&
                key !== '_highlighted'
            )
        }

        const filteredKeys1 = keys1.filter(filterInternal)
        const filteredKeys2 = keys2.filter(filterInternal)

        // Must have same number of properties
        if (filteredKeys1.length !== filteredKeys2.length) return false

        // Compare all property values
        for (const key of filteredKeys1) {
            if (feature1.properties[key] !== feature2.properties[key]) {
                return false
            }
        }

        return true
    }

    /**
     * Compare Cesium entity properties with GeoJSON feature properties
     */
    _compareFeatureProperties(entityProps, featureProps) {
        if (!entityProps || !featureProps) return false

        // Get entity property names
        const propNames = entityProps.propertyNames
        if (!propNames || propNames.length === 0) return false

        // Compare each property
        for (let i = 0; i < propNames.length; i++) {
            const propName = propNames[i]

            // Skip internal properties
            if (
                propName === '_' ||
                propName === '_dataset' ||
                propName === '_geodataset' ||
                propName === 'feature_id'
            ) {
                continue
            }

            try {
                const entityValue = entityProps[propName]?.getValue(
                    Cesium.JulianDate.now()
                )
                const featureValue = featureProps[propName]

                // If values don't match, not the same feature
                if (entityValue !== featureValue) {
                    return false
                }
            } catch (e) {
                // If we can't get the value, skip this property
                continue
            }
        }

        return true
    }

    /**
     * Apply red highlight to a Cesium entity
     */
    _highlightEntity(entity) {
        // Store reference to highlighted entity
        this._highlightedEntity = entity
        this._originalEntityStyle = {}

        // Apply red highlight based on entity type
        if (entity.polygon) {
            // Store original style
            this._originalEntityStyle.outlineColor = entity.polygon.outlineColor
            this._originalEntityStyle.outlineWidth = entity.polygon.outlineWidth

            // Apply red outline
            entity.polygon.outlineColor = Cesium.Color.RED
            entity.polygon.outlineWidth = 3
        }

        if (entity.polyline) {
            // Store original style
            this._originalEntityStyle.material = entity.polyline.material
            this._originalEntityStyle.width = entity.polyline.width

            // Apply red color
            entity.polyline.material = Cesium.Color.RED
            entity.polyline.width = 3
        }

        if (entity.point) {
            // Store original style
            this._originalEntityStyle.color = entity.point.color
            this._originalEntityStyle.outlineColor = entity.point.outlineColor
            this._originalEntityStyle.outlineWidth = entity.point.outlineWidth

            // Apply red color
            entity.point.color = Cesium.Color.RED
            entity.point.outlineColor = Cesium.Color.RED
            entity.point.outlineWidth = 2
        }

        if (entity.billboard) {
            // Store original style
            this._originalEntityStyle.color = entity.billboard.color

            // Apply red tint
            entity.billboard.color = Cesium.Color.RED
        }

        this._requestRender()
    }

    /**
     * Clear highlighted feature
     */
    clearHighlight() {
        if (this.rendererType === 'lithosphere') {
            this._clearHighlightLithoSphere()
        } else {
            this._clearHighlightCesium()
        }
    }

    /**
     * Clear highlight for LithoSphere
     */
    _clearHighlightLithoSphere() {
        if (!this._lithoActiveFeature) return

        const activeFeature = this._lithoActiveFeature

        // Clear the _active flag
        if (activeFeature.feature) {
            activeFeature.feature._active = false
        }

        // Trigger restyle based on type
        if (activeFeature.type === 'vector' && activeFeature.obj) {
            // Vector layer - call restyle on the mesh
            if (activeFeature.obj.restyle) {
                activeFeature.obj.restyle()
            }
        } else if (activeFeature.type === 'clamped' && activeFeature.layer) {
            // Clamped layer - update tiles
            if (this.renderer._ && this.renderer._.tiledWorld) {
                this.renderer._.tiledWorld.updateAllRasters()
            }
        }

        // Clear reference
        this._lithoActiveFeature = null
    }

    /**
     * Clear highlight for Cesium
     */
    _clearHighlightCesium() {
        if (!this._highlightedEntity) {
            return
        }

        const entity = this._highlightedEntity

        // Restore original styles
        if (entity.polygon && this._originalEntityStyle.outlineColor) {
            entity.polygon.outlineColor = this._originalEntityStyle.outlineColor
            entity.polygon.outlineWidth = this._originalEntityStyle.outlineWidth
        }

        if (entity.polyline && this._originalEntityStyle.material) {
            entity.polyline.material = this._originalEntityStyle.material
            entity.polyline.width = this._originalEntityStyle.width
        }

        if (entity.point && this._originalEntityStyle.color) {
            entity.point.color = this._originalEntityStyle.color
            entity.point.outlineColor = this._originalEntityStyle.outlineColor
            entity.point.outlineWidth = this._originalEntityStyle.outlineWidth
        }

        if (entity.billboard && this._originalEntityStyle.color) {
            entity.billboard.color = this._originalEntityStyle.color
        }

        // Clear references
        this._highlightedEntity = null
        this._originalEntityStyle = null

        this._requestRender()
    }
}

export default GlobeRenderer
