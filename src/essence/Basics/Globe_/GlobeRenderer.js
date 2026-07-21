import LithoSphere from 'lithosphere'
import Projection_ from './Projection_'
import * as Cesium from 'cesium'
import { utcFormat } from 'd3-time-format'
import 'cesium/Source/Widgets/widgets.css'
import LayerUtils from '../Layers_/LayerUtils'
import CesiumMVTLayer from './CesiumMVTLayer'
import {
    interpolateMultipleColors,
    buildColorStops,
    closestPointOnSegment,
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

            // Prevent default Cesium ion imagery/terrain requests
            baseLayer: false,
            terrain: undefined,

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

        // Enable sun-based directional lighting for 3D shading on buildings
        this.renderer.scene.globe.enableLighting = true

        // Pin sun to a fixed angle for consistent, aesthetically good shadows.
        // Summer solstice at 10am EDT (14:00 UTC) — high sun from the southeast
        // gives clear wall differentiation without harsh top-down flattening.
        this.renderer.clock.currentTime = Cesium.JulianDate.fromDate(
            new Date('2026-06-21T14:00:00Z')
        )
        this.renderer.clock.shouldAnimate = false

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

        // Build a real projection so tools (Viewshed, Sightline) work with any CRS
        this.projection = Projection_.buildFromConfig(this.config)
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

        // Set up gradient-point hover tooltip
        this._setupGradientHoverHandler()
    }

    /**
     * Set up terrain provider for Cesium.
     * Uses Mapzen Terrarium tiles as default, can be overridden with demFallback config.
     *
     * Performance: tiles are downscaled from 256×256 to _terrainGridSize (default 32)
     * before parsing — 64× fewer pixels and far less GPU geometry.  Each tile gets
     * its own small OffscreenCanvas (32×32 ≈ 4KB) so fetches decode in parallel.
     */
    async _setupTerrainProvider() {
        if (this.rendererType !== 'cesium') return

        // ── Shared terrain infrastructure ──
        // Grid size for the heightmap Cesium receives (downscaled from 256 source).
        // 32 gives ~1K samples per tile — enough detail for terrain shape at
        // planetary-science zoom levels while keeping parse + GPU cost very low.
        this._terrainGridSize = 32

        // Max native zoom for Terrarium tiles (AWS elevation-tiles-prod).
        // Beyond this level the server returns 404, so we fetch the tile
        // at this level that covers the same area instead of returning
        // empty heights (which makes the terrain go flat).
        this._terrainMaxNativeZoom = 15

        // Check for demFallback configuration
        const demFallback = this.config.demFallback

        if (demFallback && demFallback.demPath) {
            await this._setTerrainFromConfig(demFallback)
        } else {
            await this._setMapzenTerrariumTerrain()
        }
    }

    /**
     * Fetch a terrain PNG tile, downscale it, and parse RGB→heights.
     * Shared by both Terrarium and custom DEM providers.
     *
     * @param {string} url - Tile URL
     * @param {string} parserType - 'terrarium' | 'mapbox' | 'rgba'
     * @param {boolean} cropBuffer - Whether to crop 1px buffer ring (TerrainRGB/mapbox)
     * @param {Float64Array} emptyHeights - Pre-allocated empty array for failures
     * @param {object} [srcRegion] - Optional sub-region of the source image to use
     *   {sx, sy, sw, sh} in source-pixel coordinates.  Used when over-zooming
     *   to extract only the quadrant that matches the requested tile.
     * @returns {Float64Array} Parsed height grid (gridSize × gridSize)
     */
    async _fetchAndParseTerrainTile(url, parserType, cropBuffer, emptyHeights, srcRegion) {
        const response = await fetch(url)
        if (!response.ok || response.status !== 200) return emptyHeights

        const blob = await response.blob()
        // Disable color space conversion — even a 1-unit shift in R
        // causes a 256m height jump in Terrarium encoding (R*256+G+B/256-32768)
        const imageBitmap = await createImageBitmap(blob, {
            colorSpaceConversion: 'none',
        })

        const gridSize = this._terrainGridSize

        // Per-tile canvas so multiple tiles can decode in parallel.
        // At 32×32 each canvas is ~4KB — negligible compared to the
        // PNG fetch that preceded it.
        const canvas = new OffscreenCanvas(gridSize, gridSize)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.imageSmoothingEnabled = false

        // Draw the relevant portion of the source tile into the grid canvas.
        // srcRegion is set when over-zooming beyond the tileset's max native
        // zoom — it selects the quadrant of the lower-zoom tile that covers
        // the requested area.  cropBuffer trims a 1px buffer ring for
        // TerrainRGB/Mapbox tiles.  Otherwise the full image is used.
        if (srcRegion) {
            ctx.drawImage(
                imageBitmap,
                srcRegion.sx, srcRegion.sy, srcRegion.sw, srcRegion.sh,
                0, 0,
                gridSize, gridSize
            )
        } else if (cropBuffer) {
            ctx.drawImage(
                imageBitmap,
                1, 1,
                imageBitmap.width - 2, imageBitmap.height - 2,
                0, 0,
                gridSize, gridSize
            )
        } else {
            ctx.drawImage(imageBitmap, 0, 0, gridSize, gridSize)
        }

        const terrainRGB = ctx.getImageData(0, 0, gridSize, gridSize).data
        const heightMap = new Float64Array(gridSize * gridSize)

        if (parserType === 'terrarium') {
            for (let i = 0; i < heightMap.length; i++) {
                const R = terrainRGB[i * 4]
                const G = terrainRGB[i * 4 + 1]
                const B = terrainRGB[i * 4 + 2]
                heightMap[i] = R * 256 + G + B / 256 - 32768
            }
        } else if (parserType === 'mapbox' || parserType === 'rgba') {
            for (let i = 0; i < heightMap.length; i++) {
                const R = terrainRGB[i * 4]
                const G = terrainRGB[i * 4 + 1]
                const B = terrainRGB[i * 4 + 2]
                const A = terrainRGB[i * 4 + 3]
                heightMap[i] =
                    A === 0
                        ? 0
                        : -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
            }
        } else {
            // Unknown parser type — default to Terrarium
            for (let i = 0; i < heightMap.length; i++) {
                const R = terrainRGB[i * 4]
                const G = terrainRGB[i * 4 + 1]
                const B = terrainRGB[i * 4 + 2]
                heightMap[i] = R * 256 + G + B / 256 - 32768
            }
        }

        return heightMap
    }

    /**
     * Set terrain provider for Cesium using Mapzen Terrarium tiles.
     * Uses CustomHeightmapTerrainProvider with async tile loading.
     *
     * Performance: Source tiles are 256×256 PNG but we downscale to
     * TERRAIN_GRID_SIZE (default 32) before parsing. This reduces
     * per-tile pixel work from 65K to ~1K and produces far less GPU
     * geometry while Cesium bilinearly interpolates between samples.
     * Each tile gets its own small OffscreenCanvas (32×32 ≈ 4 KB) so
     * fetches decode in parallel without contention.
     */
    async _setMapzenTerrariumTerrain() {
        if (this.rendererType !== 'cesium') return

        const gridSize = this._terrainGridSize
        const EMPTY_HEIGHTS = new Float64Array(gridSize * gridSize)

        this.renderer.terrainProvider =
            new Cesium.CustomHeightmapTerrainProvider({
                width: gridSize,
                height: gridSize,
                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                callback: async (x, y, level) => {
                    if (level < 4) return EMPTY_HEIGHTS

                    // Clamp to max native zoom — fetch the
                    // lower-zoom tile and extract only the sub-region
                    // that corresponds to the requested tile.
                    let fetchLevel = level
                    let fetchX = x
                    let fetchY = y
                    let srcRegion = null
                    if (level > this._terrainMaxNativeZoom) {
                        const shift = level - this._terrainMaxNativeZoom
                        fetchLevel = this._terrainMaxNativeZoom
                        fetchX = x >> shift
                        fetchY = y >> shift
                        // Identify which sub-tile within the source tile
                        const subTiles = 1 << shift
                        const subX = x - (fetchX << shift)
                        const subY = y - (fetchY << shift)
                        const srcTileSize = 256 // source PNG is 256×256
                        const regionSize = srcTileSize / subTiles
                        srcRegion = {
                            sx: subX * regionSize,
                            sy: subY * regionSize,
                            sw: regionSize,
                            sh: regionSize,
                        }
                    }

                    try {
                        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${fetchLevel}/${fetchX}/${fetchY}.png`
                        return await this._fetchAndParseTerrainTile(
                            url, 'terrarium', false, EMPTY_HEIGHTS, srcRegion
                        )
                    } catch (error) {
                        // Silently fail and return empty heights for missing/invalid tiles
                    }
                    return EMPTY_HEIGHTS
                },
            })

        this._currentTerrainProvider = 'terrarium'
    }

    /**
     * Set terrain from demFallback configuration.
     * Supports multiple parser types: terrarium, mapbox, rgba (TerrainRGB).
     * Uses the same downscale + shared canvas pipeline as _setMapzenTerrariumTerrain.
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

        const gridSize = this._terrainGridSize
        const EMPTY_HEIGHTS = new Float64Array(gridSize * gridSize)
        const parserType = demConfig.parserType || 'rgba'
        const cropBuffer = parserType === 'mapbox' || parserType === 'rgba'

        this.renderer.terrainProvider =
            new Cesium.CustomHeightmapTerrainProvider({
                width: gridSize,
                height: gridSize,
                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                callback: async (x, y, level) => {
                    if (level < 4) return EMPTY_HEIGHTS

                    try {
                        const tileY = demConfig.format === 'tms'
                            ? Math.pow(2, level) - 1 - y
                            : y
                        const url = demConfig.demPath
                            .replace('{z}', level)
                            .replace('{x}', x)
                            .replace('{y}', tileY)
                            .replace('{level}', level)

                        return await this._fetchAndParseTerrainTile(
                            url, parserType, cropBuffer, EMPTY_HEIGHTS
                        )
                    } catch (error) {
                        // Silently fail and return empty heights for missing/invalid tiles
                    }
                    return EMPTY_HEIGHTS
                },
            })

        this._currentTerrainProvider = 'custom'
    }

    /**
     * Add a layer to the globe
     * @param {string} type - Layer type: 'tile', 'vector', 'clamped', 'curtain', 'model'
     * @param {object} layerConfig - Layer configuration
     */
    addLayer(type, layerConfig) {
        if (type === 'gradient_polyline') {
            if (this.rendererType === 'cesium') {
                return this._addCesiumGradientPolyline(layerConfig)
            }
            // LithoSphere 1.6.0+: map to 'gradient' layer type
            return this._addLithoSphereGradient(layerConfig)
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
        } else if (type === 'vectortile') {
            // MVT vector tile layer with optional 3D extrusion
            const mvtLayer = new CesiumMVTLayer(this.renderer, {
                name: layerConfig.name,
                url: layerConfig.path,
                vtLayer: layerConfig.vtLayer,
                extrudeHeightProperty: layerConfig.extrudeHeightProperty,
                extrudeDefaultHeight: layerConfig.extrudeDefaultHeight,
                extrudeBaseProperty: layerConfig.extrudeBaseProperty,
                extrudeColor: layerConfig.extrudeColor,
                extrudeOpacity: layerConfig.extrudeOpacity,
                minZoom: layerConfig.minZoom,
                maxZoom: layerConfig.maxZoom,
                opacity: layerConfig.opacity,
            })

            this._layers[layerConfig.name] = {
                type: 'vectortile',
                mvtLayer: mvtLayer,
                visible: true,
            }
        } else if (type === '3dtiles') {
            // 3D Tiles layer (e.g., OSM Buildings, photogrammetry, point clouds)
            this._add3DTilesLayer(layerConfig)
        } else if (type === 'model') {
            // Model layers not implemented for core features
            console.warn('Model layers not yet supported for Cesium renderer')
        } else if (type === 'curtain') {
            // Curtain layers not implemented for core features
            console.warn('Curtain layers not yet supported for Cesium renderer')
        }
    }

    /**
     * Add a Cesium 3D Tiles layer
     * @param {object} layerConfig - Layer configuration
     * @param {string} layerConfig.name - Layer name
     * @param {string} layerConfig.path - URL to tileset.json
     * @param {number} [layerConfig.opacity] - Opacity (0-1)
     * @param {number} [layerConfig.maximumScreenSpaceError] - LOD quality (lower = higher quality, default 16)
     * @param {object} [layerConfig.style] - Cesium3DTileStyle definition
     * @param {number} [layerConfig.heightOffset] - Vertical offset in meters
     */
    async _add3DTilesLayer(layerConfig) {
        const { name } = layerConfig

        // Prevent duplicate loads
        if (this._loadingLayers[name]) return
        this._loadingLayers[name] = true

        try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(
                layerConfig.path,
                {
                    maximumScreenSpaceError:
                        layerConfig.maximumScreenSpaceError ?? 16,
                    maximumMemoryUsage: layerConfig.maximumMemoryUsage ?? 512,
                }
            )

            delete this._loadingLayers[name]

            this.renderer.scene.primitives.add(tileset)

            // Apply height offset if specified
            if (layerConfig.heightOffset) {
                const offset = new Cesium.Cartesian3(
                    0,
                    0,
                    layerConfig.heightOffset
                )
                const modelMatrix =
                    Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                        offset,
                        Cesium.Quaternion.IDENTITY,
                        new Cesium.Cartesian3(1, 1, 1)
                    )
                // Apply relative to the tileset's root transform
                tileset.modelMatrix = Cesium.Matrix4.multiply(
                    tileset.modelMatrix,
                    modelMatrix,
                    new Cesium.Matrix4()
                )
            }

            // Apply 3D Tiles styling if specified
            if (layerConfig.style) {
                tileset.style = new Cesium.Cesium3DTileStyle(layerConfig.style)
            }

            // Apply opacity
            if (
                layerConfig.opacity !== undefined &&
                layerConfig.opacity < 1.0
            ) {
                tileset.style = new Cesium.Cesium3DTileStyle({
                    ...(layerConfig.style || {}),
                    color: `color("white", ${layerConfig.opacity})`,
                })
            }

            this._layers[name] = {
                type: '3dtiles',
                tileset: tileset,
                visible: true,
                opacity: layerConfig.opacity ?? 1.0,
                styleConfig: layerConfig.style || null,
            }
        } catch (err) {
            delete this._loadingLayers[name]
            console.error(`Failed to load 3D Tiles layer "${name}":`, err)
        }
    }

    /**
     * Add a gradient polyline layer to Cesium using the Primitive API.
     *
     * Builds ONE PolylineGeometry per continuous path with per-vertex
     * colors.  For a 24K-point dataset this produces a single draw
     * call instead of tens of thousands of Entity objects or
     * GeometryInstances.
     *
     * Hover tooltips use a spatial grid index for O(1) nearest-vertex
     * lookup — no point entities are created.
     *
     * @param {object} layerConfig - { name, geojson, gradientSettings, layerObj }
     * @returns {string} Layer name used as ID for removal
     */
    _addLithoSphereGradient(layerConfig) {
        const layerName = `${layerConfig.name}_gradient`

        // Remove existing gradient layer with that name if present
        this.renderer.removeLayer(layerName)

        const lithoConfig = {
            name: layerName,
            on: true,
            opacity: 1,
            geojson: layerConfig.geojson,
            gradientSettings: layerConfig.gradientSettings,
        }

        this.renderer.addLayer('gradient', lithoConfig)

        return layerName
    }

    _addCesiumGradientPolyline(layerConfig) {
        const { name, geojson, gradientSettings } = layerConfig
        const layerName = `${name}_gradient`

        // Remove existing gradient layer if present
        if (this._layers[layerName]) {
            this._removeCesiumGradientPolyline(layerName)
        }

        const colorStops = buildColorStops(gradientSettings.colorRamp)
        const weight = gradientSettings.weight || 4

        // Register the layer entry immediately so the caller gets the ID back
        // synchronously.  All heavy work (vertex collection + geometry build)
        // runs inside _buildCesiumGradientAsync with a per-frame time budget so
        // the UI is never blocked.
        const gridRes = 0.01
        const buildId = Symbol()
        this._layers[layerName] = {
            type: 'gradient_polyline',
            primitive: null,
            visible: true,
            hoverSegments: [],
            segmentGrid: {},
            gridRes,
            _buildId: buildId,
        }

        this._buildCesiumGradientAsync(
            layerName, buildId, geojson, gradientSettings, colorStops, weight, gridRes
        )

        return layerName
    }

    /**
     * Async builder for gradient polyline geometry.
     * Both Phase 1 (vertex collection) and Phase 2 (Cesium geometry build)
     * run here so the main thread is never blocked.  A per-frame time budget
     * (FRAME_BUDGET_MS) is used instead of fixed chunk sizes: we check
     * performance.now() every CHECK_INTERVAL iterations and yield via
     * requestAnimationFrame whenever we've used the budget.  This adapts to
     * the machine's speed and guarantees ≤FRAME_BUDGET_MS of blocking per
     * frame regardless of dataset size.
     *
     * buildId is a Symbol stamped on the layer entry at creation time —
     * if it no longer matches when we resume after a yield, the layer was
     * removed or replaced and this build should abort.
     */
    async _buildCesiumGradientAsync(
        layerName, buildId, geojson, gradientSettings, colorStops, weight, gridRes
    ) {
        const isStale = () =>
            this._layers[layerName]?._buildId !== buildId

        // Time-budget yielding: yield to the browser via rAF whenever we've
        // spent FRAME_BUDGET_MS in the current frame.  CHECK_INTERVAL controls
        // how often we check the clock (every N iterations); smaller = lower
        // peak blocking but slightly more overhead.
        const FRAME_BUDGET_MS = 10
        const CHECK_INTERVAL = 100
        let frameDeadline = performance.now() + FRAME_BUDGET_MS
        const yieldIfNeeded = () => {
            if (performance.now() < frameDeadline) return Promise.resolve()
            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    frameDeadline = performance.now() + FRAME_BUDGET_MS
                    resolve()
                })
            })
        }

        // ── Phase 1: Collect all vertices with property values ──
        const colorWithProp = gradientSettings.colorWithProp
        const allPaths = []
        let min = Infinity
        let max = -Infinity

        if (gradientSettings.connectAllPoints) {
            const points = []
            for (let fi = 0; fi < geojson.features.length; fi++) {
                if (fi % CHECK_INTERVAL === 0) {
                    await yieldIfNeeded()
                    if (isStale()) return
                }
                const feature = geojson.features[fi]
                if (feature.geometry.type.toLowerCase() === 'point') {
                    const coords = feature.geometry.coordinates
                    const value = F_.getIn(feature.properties, colorWithProp, 0)
                    if (min > value) min = value
                    if (max < value) max = value
                    points.push({
                        lng: coords[0], lat: coords[1],
                        elev: coords[2] || 0, value,
                        props: feature.properties,
                    })
                }
            }
            if (points.length >= 2) allPaths.push(points)
        } else {
            for (let fi = 0; fi < geojson.features.length; fi++) {
                if (fi % CHECK_INTERVAL === 0) {
                    await yieldIfNeeded()
                    if (isStale()) return
                }
                const feature = geojson.features[fi]
                const paths = []
                let path = []
                let prevParentIndex = null

                F_.coordinateDepthTraversal(
                    feature.geometry.coordinates,
                    (array, _path) => {
                        const splitPath = _path.split('.')
                        let parentIndex = null
                        if (splitPath.length >= 2) {
                            parentIndex = splitPath[splitPath.length - 2]
                            if (prevParentIndex != null && parentIndex != prevParentIndex) {
                                paths.push(path)
                                path = []
                            }
                        }
                        const props = getCoordProperties(geojson, feature, array)
                        const value = F_.getIn(props, colorWithProp, 0)
                        if (min > value) min = value
                        if (max < value) max = value
                        path.push({
                            lng: array[0], lat: array[1],
                            elev: array[2] || 0, value, props,
                        })
                        prevParentIndex = parentIndex
                    }
                )
                if (path.length > 0) paths.push(path)
                paths.forEach((p) => { if (p.length >= 2) allPaths.push(p) })
            }
        }

        if (min === 0 && max === 0) max = 1
        if (isStale()) return

        // ── Phase 2: Build Cesium geometry + hover data ──
        // Memoize color by exact value — gradient data often has many repeated
        // readings (quantized sensor values, integer speeds, etc.).
        // Parse rgb(r,g,b) directly into a Cesium.Color to skip the
        // rgbToHex → fromCssColorString string round-trip.
        const colorCache = new Map()
        const colorForValue = (v) => {
            if (colorCache.has(v)) return colorCache.get(v)
            const c = interpolateMultipleColors(colorStops, v, min, max)
            let color
            if (c) {
                const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/)
                color = m
                    ? new Cesium.Color(+m[1] / 255, +m[2] / 255, +m[3] / 255, 1.0)
                    : (Cesium.Color.fromCssColorString(c) ?? Cesium.Color.WHITE)
            } else {
                color = Cesium.Color.WHITE
            }
            colorCache.set(v, color)
            return color
        }

        const geometryInstances = []
        const hoverSegments = []

        for (const pts of allPaths) {
            const positions = []
            const colors = []

            for (let i = 0; i < pts.length; i++) {
                if (i % CHECK_INTERVAL === 0) {
                    await yieldIfNeeded()
                    if (isStale()) return
                }
                const p = pts[i]
                positions.push(Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.elev))
                colors.push(colorForValue(p.value))
            }

            if (positions.length >= 2) {
                geometryInstances.push(
                    new Cesium.GeometryInstance({
                        geometry: new Cesium.PolylineGeometry({
                            positions,
                            colors,
                            colorsPerVertex: true,
                            width: weight,
                        }),
                    })
                )
            }

            for (let i = 0; i < pts.length - 1; i++) {
                if (i % CHECK_INTERVAL === 0) {
                    await yieldIfNeeded()
                    if (isStale()) return
                }
                const p1 = pts[i], p2 = pts[i + 1]
                hoverSegments.push({
                    lng1: p1.lng, lat1: p1.lat, elev1: p1.elev || 0,
                    lng2: p2.lng, lat2: p2.lat, elev2: p2.elev || 0,
                })
            }
        }

        if (isStale()) return

        // ── Build spatial grid ──
        // Register each segment at evenly-spaced sample points (every 2 cells).
        // The caller (setGradientHoverPoint) checks a 3×3 neighbourhood, so any
        // query point within 1 cell of a sample finds the segment.  Steps are
        // capped at 12 per segment so worst-case cost is O(12N), not O(N × span²).
        const segmentGrid = {}
        for (let idx = 0; idx < hoverSegments.length; idx++) {
            if (idx % CHECK_INTERVAL === 0) {
                await yieldIfNeeded()
                if (isStale()) return
            }
            const seg = hoverSegments[idx]
            const gx1 = Math.floor(seg.lng1 / gridRes)
            const gy1 = Math.floor(seg.lat1 / gridRes)
            const gx2 = Math.floor(seg.lng2 / gridRes)
            const gy2 = Math.floor(seg.lat2 / gridRes)
            const span = Math.max(Math.abs(gx2 - gx1), Math.abs(gy2 - gy1))
            const steps = Math.min(12, Math.max(1, Math.ceil(span / 2)))
            const seenCells = new Set()
            for (let s = 0; s <= steps; s++) {
                const t = s / steps
                const gx = Math.floor((seg.lng1 + t * (seg.lng2 - seg.lng1)) / gridRes)
                const gy = Math.floor((seg.lat1 + t * (seg.lat2 - seg.lat1)) / gridRes)
                const key = `${gx},${gy}`
                if (seenCells.has(key)) continue
                seenCells.add(key)
                if (!segmentGrid[key]) segmentGrid[key] = []
                segmentGrid[key].push(idx)
            }
        }

        // ── Create Primitive ──
        // asynchronous:true compiles geometry in a Web Worker.
        // pollReady drives the compilation under requestRenderMode:true.
        let primitive = null
        if (geometryInstances.length > 0) {
            primitive = new Cesium.Primitive({
                geometryInstances,
                appearance: new Cesium.PolylineColorAppearance(),
                asynchronous: true,
            })
            this.renderer.scene.primitives.add(primitive)

            const pollReady = () => {
                if (primitive.isDestroyed()) return
                this._requestRender()
                if (!primitive.ready) requestAnimationFrame(pollReady)
            }
            requestAnimationFrame(pollReady)
        }

        // Fill in the layer entry that was registered synchronously
        if (isStale()) {
            // A newer build superseded this one — discard our primitive
            if (primitive) this.renderer.scene.primitives.remove(primitive)
            return
        }
        this._layers[layerName].primitive = primitive
        this._layers[layerName].hoverSegments = hoverSegments
        this._layers[layerName].segmentGrid = segmentGrid
    }

    /**
     * Remove a gradient polyline layer from Cesium
     * @param {string} layerName - Layer name (with _gradient suffix)
     */
    _removeCesiumGradientPolyline(layerName) {
        const layerInfo = this._layers[layerName]
        if (layerInfo && layerInfo.type === 'gradient_polyline') {
            if (layerInfo.primitive) {
                this.renderer.scene.primitives.remove(layerInfo.primitive)
            }
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
        this._requestRender()
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
        this._requestRender()
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
                } else if (layerInfo.type === 'vectortile') {
                    layerInfo.mvtLayer.destroy()
                } else if (layerInfo.type === '3dtiles') {
                    this.renderer.scene.primitives.remove(layerInfo.tileset)
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
        } else if (layerInfo.type === 'gradient_polyline') {
            if (layerInfo.primitive) {
                layerInfo.primitive.show = visible
            }
            layerInfo.visible = visible
        } else if (layerInfo.type === 'vector') {
            layerInfo.dataSource.show = visible
            layerInfo.visible = visible
        } else if (layerInfo.type === 'vectortile') {
            layerInfo.mvtLayer.setVisible(visible)
            layerInfo.visible = visible
        } else if (layerInfo.type === '3dtiles') {
            layerInfo.tileset.show = visible
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
            const c = this.renderer.getCenter()
            return {
                lng: c.lng,
                lat: c.lat,
                zoom: this.renderer.zoom,
            }
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
     * How much the camera is looking across the surface rather than straight
     * down, as a fraction: 0 = nadir (top-down), 1 = looking parallel to the
     * ground (toward the horizon). Used to widen the dynamic-extent bbox so
     * features toward the horizon are still queried when the view is tilted.
     * @returns {number} tilt fraction in [0, 1]
     */
    getViewTiltFraction() {
        try {
            if (this.rendererType === 'lithosphere') {
                const controls = this.renderer?._?.cameras?.orbit?.controls
                if (!controls || typeof controls.getPolarAngle !== 'function')
                    return 0
                // OrbitControls polar angle: 0 at nadir, maxPolarAngle (PI/2)
                // when looking along the surface.
                const max = controls.maxPolarAngle || Math.PI / 2
                return Math.max(0, Math.min(1, controls.getPolarAngle() / max))
            } else {
                const pitch = this.renderer?.camera?.pitch
                if (pitch == null) return 0
                // Cesium pitch: -PI/2 at nadir, 0 at the horizon.
                return Math.max(
                    0,
                    Math.min(1, 1 - Math.abs(pitch) / (Math.PI / 2))
                )
            }
        } catch (e) {
            return 0
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
            } else if (layerInfo && layerInfo.type === 'vectortile') {
                layerInfo.mvtLayer.setOpacity(opacity)
                this._requestRender()
            } else if (layerInfo && layerInfo.type === '3dtiles') {
                layerInfo.opacity = opacity
                // Apply opacity via style color alpha
                const styleObj = layerInfo.styleConfig
                    ? { ...layerInfo.styleConfig }
                    : {}
                if (opacity < 1.0) {
                    styleObj.color = `color("white", ${opacity})`
                }
                layerInfo.tileset.style = new Cesium.Cesium3DTileStyle(
                    styleObj
                )
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
     * Create the gradient-polyline hover dot primitive.
     * Hover detection is driven by the 2D map; call setGradientHoverPoint /
     * clearGradientHoverPoint to show/hide the dot from outside.
     */
    _setupGradientHoverHandler() {
        if (this.rendererType !== 'cesium') return

        const scene = this.renderer.scene
        const hoverDotCollection = new Cesium.PointPrimitiveCollection()
        const hoverDot = hoverDotCollection.add({
            show: false,
            pixelSize: 10,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            position: Cesium.Cartesian3.ZERO,
        })
        scene.primitives.add(hoverDotCollection)
        this._gradientHoverDotCollection = hoverDotCollection
        this._gradientHoverDot = hoverDot
    }

    /**
     * Position the 3D gradient hover dot at the closest point on any visible
     * gradient_polyline layer to the given lat/lng.  The correct elevation is
     * resolved from the 3D segment data so the dot lands on the spiral.
     * Called from the 2D (Leaflet) mousemove handler.
     */
    setGradientHoverPoint(lng, lat) {
        if (this.rendererType !== 'cesium' || !this._gradientHoverDot) return

        // Find the 3D segment whose projection onto (lng, lat) is closest,
        // so we can read the correct interpolated elevation for the dot.
        let bestDist = Infinity
        let bestLng = lng
        let bestLat = lat
        let bestElev = 0

        for (const lName in this._layers) {
            const li = this._layers[lName]
            if (li.type !== 'gradient_polyline' || !li.visible) continue
            const { hoverSegments, segmentGrid, gridRes } = li
            if (!hoverSegments || !segmentGrid) continue

            const gx = Math.floor(lng / gridRes)
            const gy = Math.floor(lat / gridRes)
            const seen = new Set()

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const bucket = segmentGrid[`${gx + dx},${gy + dy}`]
                    if (!bucket) continue
                    for (let k = 0; k < bucket.length; k++) {
                        const idx = bucket[k]
                        if (seen.has(idx)) continue
                        seen.add(idx)
                        const seg = hoverSegments[idx]
                        const { t, dist } = closestPointOnSegment(
                            lng, lat, seg.lng1, seg.lat1, seg.lng2, seg.lat2
                        )
                        if (dist < bestDist) {
                            bestDist = dist
                            bestLng = seg.lng1 + t * (seg.lng2 - seg.lng1)
                            bestLat = seg.lat1 + t * (seg.lat2 - seg.lat1)
                            bestElev =
                                (seg.elev1 || 0) +
                                t * ((seg.elev2 || 0) - (seg.elev1 || 0))
                        }
                    }
                }
            }
        }

        if (bestDist === Infinity) {
            this._gradientHoverDot.show = false
            this._requestRender()
            return
        }

        this._gradientHoverDot.position = Cesium.Cartesian3.fromDegrees(
            bestLng, bestLat, bestElev
        )
        this._gradientHoverDot.show = true
        this._requestRender()
    }

    /**
     * Hide the 3D gradient hover dot.
     * Called from the 2D (Leaflet) mousemove / mouseout handler.
     */
    clearGradientHoverPoint() {
        if (this.rendererType !== 'cesium' || !this._gradientHoverDot) return
        if (!this._gradientHoverDot.show) return
        this._gradientHoverDot.show = false
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
     * @param {string} position - Control corner (e.g., 'TopRight', 'BottomRight')
     */
    addControl(id, control, options, position) {
        if (this.rendererType === 'lithosphere') {
            return this.renderer.addControl(id, control, options, position)
        } else {
            // Handle special controls for Cesium
            if (id === 'mmgisLithoLink') {
                return this._setupCesiumLinkControl(options)
            }
            if (id === 'mmgisLithoCoords') {
                return this._setupCesiumCoordsControl(options)
            }
            // Return a mock control object for other controls
            return {}
        }
    }

    /**
     * Wire up the Cesium mouse-move handler that drives the coordinate display.
     * Calls options.onChange(lng, lat, elev) on every mouse-move over the globe,
     * and onChange(null, null, null) when the pointer leaves the canvas.
     */
    _setupCesiumCoordsControl(options) {
        if (!options || !options.onChange) return {}

        const viewer = this.renderer
        const scene = viewer.scene
        const canvas = scene.canvas

        const handler = new Cesium.ScreenSpaceEventHandler(canvas)

        let rafPending = false
        handler.setInputAction((movement) => {
            if (rafPending) return
            rafPending = true
            requestAnimationFrame(() => {
                rafPending = false
                const cartesian = viewer.camera.pickEllipsoid(
                    movement.endPosition,
                    scene.globe.ellipsoid
                )
                if (cartesian) {
                    const carto = Cesium.Cartographic.fromCartesian(cartesian)
                    const lng = Cesium.Math.toDegrees(carto.longitude)
                    const lat = Cesium.Math.toDegrees(carto.latitude)
                    // Try to get the terrain elevation at this position.
                    // scene.sampleHeight samples the currently-rendered tiles
                    // synchronously; it returns undefined if tiles aren't loaded yet.
                    let elev = null
                    try {
                        const h = scene.sampleHeight(carto)
                        if (h != null && isFinite(h)) elev = h
                    } catch (_) { /* terrain not available */ }
                    options.onChange(lng, lat, elev)
                } else {
                    options.onChange(null, null, null)
                }
            })
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

        canvas.addEventListener('mouseout', () => {
            options.onChange(null, null, null)
        })

        return { _handler: handler }
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
        controlsDiv.setAttribute('id', '_cesium_controls_topright')
        controlsDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
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
            width: 30px;
            height: 30px;
            background: var(--color-a);
            border-radius: 3px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            color: var(--color-f);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: all;
            transition: background 0.2s;
        `

        // Use SVG instead of MDI icons (matches LithoSphere)
        button.innerHTML = `
            <svg style="width:18px; height:18px; color: var(--color-f);" viewBox="0 0 24 24">
                <path fill="currentColor" d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z" />
            </svg>
        `

        // Add hover effect
        button.addEventListener('mouseenter', () => {
            if (!linkControl._isLinked) {
                const svg = button.querySelector('svg')
                if (svg) svg.style.color = 'var(--color-mmgis)'
            }
        })
        button.addEventListener('mouseleave', () => {
            if (!linkControl._isLinked) {
                const svg = button.querySelector('svg')
                if (svg) svg.style.color = 'var(--color-f)'
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
                        // Inactive state: themed background, themed icon
                        this._buttonElement.style.background = 'var(--color-a)'
                        svg.style.color = 'var(--color-f)'
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
