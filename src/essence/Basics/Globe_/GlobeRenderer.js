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
    }

    /**
     * Initialize Cesium renderer
     */
    _initCesium() {
        // Use imported Cesium module

        const cesiumContainer = document.getElementById(this.containerId)

        // Create Cesium viewer with configuration
        this.renderer = new Cesium.Viewer(cesiumContainer, {
            // Initial view
            ...(this.config.initialCamera && {
                camera: {
                    destination: Cesium.Cartesian3.fromDegrees(
                        this.config.initialView.lng,
                        this.config.initialView.lat,
                        this.config.initialView.zoom * 100000 // Convert zoom to height
                    )
                }
            }),

            // UI controls
            homeButton: true,
            navigationHelpButton: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            geocoder: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            vrButton: false,

            // Performance
            requestRenderMode: false,
            maximumRenderTimeChange: Infinity,
        })

        // Store layer references
        this._layers = new Map()

        // Set up initial view if no camera specified
        if (!this.config.initialCamera && this.config.initialView) {
            this.renderer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(
                    this.config.initialView.lng,
                    this.config.initialView.lat,
                    this.config.initialView.zoom * 100000
                )
            })
        }

        // Mock controls object for compatibility
        this.controls = {
            home: {},
            exaggerate: {},
            observe: {},
            walk: {},
            compass: {},
            navigation: {},
            coordinates: {},
            link: {}
        }

        // Mock properties for compatibility
        this.projection = {}
        this._ = {}
        this.options = {}
        this.mouse = { lng: 0, lat: 0 }
    }

    /**
     * Add a layer to the globe
     * @param {string} type - Layer type: 'tile', 'vector', 'clamped', 'curtain', 'model'
     * @param {object} layerConfig - Layer configuration
     */
    addLayer(type, layerConfig) {
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
            // Add raster tile layer
            const imageryProvider = new Cesium.UrlTemplateImageryProvider({
                url: this._convertTileUrl(layerConfig.path, layerConfig.format),
                maximumLevel: layerConfig.maxZoom || 18,
                minimumLevel: layerConfig.minZoom || 0,
            })

            const layer = this.renderer.imageryLayers.addImageryProvider(imageryProvider)
            layer.alpha = layerConfig.opacity !== undefined ? layerConfig.opacity : 1.0

            this._layers.set(name, {
                type: 'tile',
                layer: layer,
                visible: true
            })

        } else if (type === 'vector' || type === 'clamped') {
            // Add vector layer from GeoJSON
            const dataSource = Cesium.GeoJsonDataSource.load(layerConfig.geojson, {
                clampToGround: true,
                stroke: Cesium.Color.fromCssColorString(layerConfig.style?.color || '#ffffff'),
                strokeWidth: layerConfig.style?.weight || 2,
                fill: Cesium.Color.fromCssColorString(layerConfig.style?.fillColor || '#ffffff').withAlpha(
                    layerConfig.style?.fillOpacity || 0.5
                )
            })

            dataSource.then((ds) => {
                this.renderer.dataSources.add(ds)

                // Handle click events
                if (layerConfig.onClick) {
                    const handler = new Cesium.ScreenSpaceEventHandler(this.renderer.scene.canvas)
                    handler.setInputAction((click) => {
                        const pickedObject = this.renderer.scene.pick(click.position)
                        if (Cesium.defined(pickedObject) && pickedObject.id) {
                            const entity = pickedObject.id
                            const cartographic = Cesium.Cartographic.fromCartesian(
                                entity.position.getValue(Cesium.JulianDate.now())
                            )
                            const lng = Cesium.Math.toDegrees(cartographic.longitude)
                            const lat = Cesium.Math.toDegrees(cartographic.latitude)
                            layerConfig.onClick(entity.properties, [lng, lat], name)
                        }
                    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
                }

                this._layers.set(name, {
                    type: 'vector',
                    dataSource: ds,
                    visible: true
                })
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
            const layerInfo = this._layers.get(name)
            if (layerInfo) {
                if (layerInfo.type === 'tile') {
                    this.renderer.imageryLayers.remove(layerInfo.layer)
                } else if (layerInfo.type === 'vector') {
                    this.renderer.dataSources.remove(layerInfo.dataSource)
                }
                this._layers.delete(name)
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
            const layerInfo = this._layers.get(name)
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
            return this._layers.has(name)
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
                zoom: center.height / 100000 // Convert height to approximate zoom
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
                [lat, lng, zoom] = view
            } else {
                ({ lng, lat, zoom } = view)
            }

            this.renderer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(lng, lat, zoom * 100000)
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
            const layerInfo = this._layers.get(name)
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
            console.warn('Layer ordering not yet fully supported for Cesium renderer')
        }
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
            console.warn('setLayerSpecificOptions not yet supported for Cesium renderer')
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
            // Cesium controls are handled differently
            // Return a mock control object for compatibility
            return {}
        }
    }
}

export default GlobeRenderer
