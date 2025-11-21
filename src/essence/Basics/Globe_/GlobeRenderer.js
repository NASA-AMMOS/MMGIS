import LithoSphere from 'lithosphere'
import * as Cesium from 'cesium'
import 'cesium/Source/Widgets/widgets.css'

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
        this.CESIUM_ZOOM_RATIO = 1500000

        // Initialize the appropriate renderer
        if (rendererType === 'cesium') {
            this._initCesium()
        } else {
            this._initLithoSphere()
        }
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
            ...(this.config.initialCamera && {
                camera: {
                    destination: Cesium.Cartesian3.fromDegrees(
                        this.config.initialView.lng,
                        this.config.initialView.lat,
                        this.config.initialView.zoom * this.CESIUM_ZOOM_RATIO // Convert zoom to height
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

            // Performance
            requestRenderMode: false,
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
                    this.config.initialView.zoom * this.CESIUM_ZOOM_RATIO
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

        // Create control container AFTER Cesium viewer is initialized
        this._createCesiumControlContainer()

        // Create single global click handler for all layers
        this._setupGlobalClickHandler()
    }

    /**
     * Set up terrain provider for Cesium
     * Uses Mapzen Terrarium tiles as default, can be overridden with demFallback config
     */
    async _setupTerrainProvider() {
        if (this.rendererType !== 'cesium') return

        // Check for demFallback configuration
        const demFallback = this.config.demFallback

        if (demFallback && demFallback.demPath) {
            // Use configured fallback DEM
            await this._setTerrainFromConfig(demFallback)
        } else {
            // Use Mapzen Terrarium as default free terrain
            await this._setMapzenTerrariumTerrain()
        }
    }

    /**
     * Set terrain provider for Cesium using Mapzen Terrarium tiles
     * Uses CustomHeightmapTerrainProvider with async tile loading
     */
    async _setMapzenTerrariumTerrain() {
        if (this.rendererType !== 'cesium') return

        const tileSize = 256
        const EMPTY_HEIGHTS = new Float64Array(tileSize * tileSize)

        this.renderer.terrainProvider =
            new Cesium.CustomHeightmapTerrainProvider({
                width: tileSize,
                height: tileSize,
                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                callback: async (x, y, level) => {
                    // Skip very low zoom levels where tiles may not exist
                    if (level < 4) return EMPTY_HEIGHTS

                    try {
                        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${level}/${x}/${y}.png`
                        const response = await fetch(url)

                        if (response.ok && response.status === 200) {
                            // Extract the image and render it into an offscreen canvas
                            const blob = await response.blob()
                            const imageBitmap = await createImageBitmap(blob)
                            const canvas = new OffscreenCanvas(
                                tileSize,
                                tileSize
                            )
                            const ctx = canvas.getContext('2d')
                            ctx.imageSmoothingEnabled = false // No interpolation when downsizing

                            // Draw full image (Terrarium has no buffer ring, unlike TerrainRGB)
                            ctx.drawImage(imageBitmap, 0, 0, tileSize, tileSize)

                            // Get pixel data
                            const terrainRGB = ctx.getImageData(
                                0,
                                0,
                                tileSize,
                                tileSize
                            ).data

                            // Parse Terrarium pixels into Float64Array height-map
                            const heightMap = new Float64Array(
                                tileSize * tileSize
                            )
                            for (let i = 0; i < heightMap.length; i++) {
                                const R = terrainRGB[i * 4 + 0]
                                const G = terrainRGB[i * 4 + 1]
                                const B = terrainRGB[i * 4 + 2]
                                // Terrarium format: (R * 256 + G + B / 256) - 32768
                                heightMap[i] = R * 256 + G + B / 256 - 32768
                            }
                            return heightMap
                        }
                    } catch (error) {
                        // Silently fail and return empty heights for missing/invalid tiles
                    }
                    return EMPTY_HEIGHTS
                },
            })

        this._currentTerrainProvider = 'terrarium'
    }

    /**
     * Set terrain from demFallback configuration
     * Supports multiple parser types: terrarium, mapbox, rgba (TerrainRGB)
     */
    async _setTerrainFromConfig(demConfig) {
        if (this.rendererType !== 'cesium') return

        // Check if we should use custom DEM or fall back to Terrarium
        if (!demConfig.demPath || demConfig.demPath === 'default') {
            await this._setMapzenTerrariumTerrain()
            return
        }

        const tileSize = 256
        const EMPTY_HEIGHTS = new Float64Array(tileSize * tileSize)
        const parserType = demConfig.parserType || 'rgba'

        this.renderer.terrainProvider =
            new Cesium.CustomHeightmapTerrainProvider({
                width: tileSize,
                height: tileSize,
                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                callback: async (x, y, level) => {
                    // Skip very low zoom levels where tiles may not exist
                    if (level < 4) return EMPTY_HEIGHTS

                    try {
                        // Build URL from demConfig.demPath template
                        let url = demConfig.demPath
                            .replace('{z}', level)
                            .replace('{x}', x)
                            .replace('{y}', y)
                            .replace('{level}', level)

                        // Handle TMS format (flip Y coordinate)
                        if (demConfig.format === 'tms') {
                            const maxY = Math.pow(2, level) - 1
                            const tmsY = maxY - y
                            url = url.replace('{y}', tmsY)
                        }

                        const response = await fetch(url)

                        if (response.ok && response.status === 200) {
                            // Extract the image and render it into an offscreen canvas
                            const blob = await response.blob()
                            const imageBitmap = await createImageBitmap(blob)
                            const canvas = new OffscreenCanvas(
                                tileSize,
                                tileSize
                            )
                            const ctx = canvas.getContext('2d')
                            ctx.imageSmoothingEnabled = false

                            // Crop 1-pixel buffer for TerrainRGB/mapbox formats (not for terrarium)
                            if (
                                parserType === 'mapbox' ||
                                parserType === 'rgba'
                            ) {
                                // TerrainRGB has a 1-pixel buffer ring, crop it off
                                ctx.drawImage(
                                    imageBitmap,
                                    1,
                                    1,
                                    imageBitmap.width - 2,
                                    imageBitmap.height - 2,
                                    0,
                                    0,
                                    tileSize,
                                    tileSize
                                )
                            } else {
                                // Terrarium has no buffer, use full image
                                ctx.drawImage(
                                    imageBitmap,
                                    0,
                                    0,
                                    tileSize,
                                    tileSize
                                )
                            }

                            // Get pixel data
                            const terrainRGB = ctx.getImageData(
                                0,
                                0,
                                tileSize,
                                tileSize
                            ).data

                            // Parse pixels into Float64Array height-map based on parser type
                            const heightMap = new Float64Array(
                                tileSize * tileSize
                            )

                            if (parserType === 'terrarium') {
                                // Terrarium format: (R * 256 + G + B / 256) - 32768
                                for (let i = 0; i < heightMap.length; i++) {
                                    const R = terrainRGB[i * 4 + 0]
                                    const G = terrainRGB[i * 4 + 1]
                                    const B = terrainRGB[i * 4 + 2]
                                    heightMap[i] = R * 256 + G + B / 256 - 32768
                                }
                            } else if (
                                parserType === 'mapbox' ||
                                parserType === 'rgba'
                            ) {
                                // TerrainRGB/Mapbox format: -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
                                for (let i = 0; i < heightMap.length; i++) {
                                    const R = terrainRGB[i * 4 + 0]
                                    const G = terrainRGB[i * 4 + 1]
                                    const B = terrainRGB[i * 4 + 2]
                                    const A = terrainRGB[i * 4 + 3]
                                    // A === 0 means the data is garbage
                                    heightMap[i] =
                                        A === 0
                                            ? 0
                                            : -10000 +
                                              (R * 256 * 256 + G * 256 + B) *
                                                  0.1
                                }
                            } else {
                                // Unknown parser type, default to terrarium
                                for (let i = 0; i < heightMap.length; i++) {
                                    const R = terrainRGB[i * 4 + 0]
                                    const G = terrainRGB[i * 4 + 1]
                                    const B = terrainRGB[i * 4 + 2]
                                    heightMap[i] = R * 256 + G + B / 256 - 32768
                                }
                            }

                            return heightMap
                        }
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
        if (this.rendererType === 'lithosphere') {
            console.log(type, layerConfig)
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
            // Add raster tile layer
            const imageryProvider = new Cesium.UrlTemplateImageryProvider({
                url: this._convertTileUrl(layerConfig.path, layerConfig.format),
                maximumLevel: layerConfig.maxZoom || 18,
                minimumLevel: layerConfig.minZoom || 0,
            })

            const layer =
                this.renderer.imageryLayers.addImageryProvider(imageryProvider)
            layer.alpha =
                layerConfig.opacity !== undefined ? layerConfig.opacity : 1.0

            this._layers[name] = {
                type: 'tile',
                layer: layer,
                visible: true,
            }
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

            const dataSource = Cesium.GeoJsonDataSource.load(
                geojsonWithIds, // Use GeoJSON with injected IDs
                {
                    clampToGround: type === 'clamped', // Only clamp 'clamped' type, not 'vector'
                    stroke: Cesium.Color.fromCssColorString(
                        defaultStyle.color || '#ffffff'
                    ),
                    strokeWidth: defaultStyle.weight || 2,
                    fill: Cesium.Color.fromCssColorString(
                        defaultStyle.fillColor || '#ffffff'
                    ).withAlpha(parseFloat(defaultStyle.fillOpacity) || 0.5),
                    markerSize: defaultStyle.radius || 8,
                    markerColor: Cesium.Color.fromCssColorString(
                        defaultStyle.fillColor || '#ffffff'
                    ),
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
                                    entity.polygon.material =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.fillColor
                                        ).withAlpha(
                                            parseFloat(
                                                featureStyle.fillOpacity
                                            ) != null
                                                ? parseFloat(
                                                      featureStyle.fillOpacity
                                                  )
                                                : parseFloat(
                                                      defaultStyle.fillOpacity
                                                  ) || 0.5
                                        )
                                }
                                if (featureStyle.color) {
                                    entity.polygon.outlineColor =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.color
                                        )
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
                                    entity.polyline.material =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.color
                                        )
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
                                    entity.point.color =
                                        Cesium.Color.fromCssColorString(
                                            featureStyle.fillColor
                                        )
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
            })
        } else if (type === 'model') {
            // Model layers not implemented for core features
            console.warn('Model layers not yet supported for Cesium renderer')
        } else if (type === 'curtain') {
            // Curtain layers not implemented for core features
            console.warn('Curtain layers not yet supported for Cesium renderer')
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
        } else {
            const layerInfo = this._layers[name]
            if (layerInfo) {
                if (layerInfo.type === 'tile') {
                    layerInfo.layer.show = visible
                } else if (layerInfo.type === 'vector') {
                    layerInfo.dataSource.show = visible
                }
                layerInfo.visible = visible
            }
        }
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
                zoom: center.height / this.CESIUM_ZOOM_RATIO, // Convert height to approximate zoom
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
                    zoom * this.CESIUM_ZOOM_RATIO
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
        } else {
            // Reorder imagery layers in Cesium
            // This is more complex in Cesium as layer ordering is managed differently
            console.warn(
                'Layer ordering not yet fully supported for Cesium renderer'
            )
        }
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
            // Cesium handles resizing automatically via ResizeObserver
            // But we can force a resize check
            this.renderer.resize()
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

        handler.setInputAction((movement) => {
            if (!linkControl._isLinked) return

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
                        if (this.renderer._ && this.renderer._.tiledWorld) {
                            // Update all tiles for this layer
                            this.renderer._.tiledWorld.updateClampedRasterForLayer(
                                layerName
                            )
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
     * Compare two GeoJSON geometries (simple JSON comparison)
     * Matches Layers_.js F_.isEqual() with isSimple=true
     */
    _compareGeometry(geometry1, geometry2) {
        if (!geometry1 && !geometry2) return true
        if (!geometry1 || !geometry2) return false

        // Simple JSON stringify comparison (matches F_.isEqual with isSimple=true)
        return JSON.stringify(geometry1) === JSON.stringify(geometry2)
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
                this.renderer._.tiledWorld.updateClampedRasterForLayer(
                    activeFeature.layerName
                )
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
    }
}

export default GlobeRenderer
