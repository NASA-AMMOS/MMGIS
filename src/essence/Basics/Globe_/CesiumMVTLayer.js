import * as Cesium from 'cesium'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'

/**
 * CesiumMVTLayer - Manages loading, decoding, and rendering MVT (Mapbox Vector Tile)
 * data as extruded 3D polygons in a Cesium viewer.
 *
 * Handles tile lifecycle: determines visible tiles from camera position,
 * fetches .pbf tiles, decodes them, creates extruded Cesium polygon primitives,
 * and evicts tiles that leave the view.
 */
class CesiumMVTLayer {
    /**
     * @param {Cesium.Viewer} viewer - Cesium viewer instance
     * @param {object} config
     * @param {string} config.name - Layer name
     * @param {string} config.url - MVT URL template with {z}/{x}/{y} placeholders
     * @param {string} config.vtLayer - Name of the sublayer within the MVT to render (e.g., "building")
     * @param {string} [config.extrudeHeightProperty] - Feature property containing height in meters
     * @param {number} [config.extrudeDefaultHeight=10] - Fallback height when property is missing
     * @param {string} [config.extrudeBaseProperty] - Feature property for base height (min_height)
     * @param {string} [config.extrudeColor="#cccccc"] - CSS color for extruded polygons
     * @param {number} [config.extrudeOpacity=0.9] - Fill opacity for extruded polygons
     * @param {number} [config.minZoom=13] - Minimum zoom level to start loading tiles
     * @param {number} [config.maxZoom=15] - Zoom level at which to fetch tiles (max native)
     * @param {number} [config.opacity=1.0] - Overall layer opacity
     */
    constructor(viewer, config) {
        this.viewer = viewer
        this.name = config.name
        this.url = config.url
        this.vtLayer = config.vtLayer || 'building'
        this.extrudeHeightProperty = config.extrudeHeightProperty || 'render_height'
        this.extrudeDefaultHeight = config.extrudeDefaultHeight ?? 0
        this.extrudeBaseProperty = config.extrudeBaseProperty || null
        this.extrudeColor = config.extrudeColor || '#cccccc'
        this.extrudeOverrideFeatureColor =
            config.extrudeOverrideFeatureColor || false
        this.extrudeOpacity = config.extrudeOpacity ?? 0.9
        this.minZoom = config.minZoom ?? 13
        this.maxZoom = config.maxZoom ?? 15
        this.opacity = config.opacity ?? 1.0

        // Earth circumference for zoom<->height conversion
        this._EARTH_CIRCUMFERENCE = 40075017

        // Track loaded tiles: key "z/x/y" -> { primitiveCollection, abortController }
        this._loadedTiles = {}

        // Track in-flight fetches to cancel on rapid camera moves
        this._pendingFetches = {}

        // Tile update throttle
        this._updateTimeout = null
        this._UPDATE_DELAY_MS = 200

        // Root primitive collection for this layer
        this._primitiveCollection = new Cesium.PrimitiveCollection()
        this.viewer.scene.primitives.add(this._primitiveCollection)

        // Visibility
        this._visible = true

        // Bind camera listener
        this._onCameraChange = this._onCameraChange.bind(this)
        this.viewer.camera.changed.addEventListener(this._onCameraChange)
        this.viewer.camera.percentageChanged = 0.1

        // Initial load
        this._onCameraChange()
    }

    /**
     * Camera change handler — throttled tile update
     */
    _onCameraChange() {
        if (this._updateTimeout) clearTimeout(this._updateTimeout)
        this._updateTimeout = setTimeout(() => {
            this._updateTiles()
        }, this._UPDATE_DELAY_MS)
    }

    /**
     * Convert Cesium camera height to approximate Leaflet zoom level
     */
    _heightToZoom(height) {
        return Math.log2(this._EARTH_CIRCUMFERENCE / Math.max(height, 1))
    }

    /**
     * Determine which tiles are visible and load/evict accordingly
     */
    _updateTiles() {
        if (!this._visible) return

        const camera = this.viewer.camera
        const cartographic = camera.positionCartographic
        const height = cartographic.height
        const zoom = Math.floor(this._heightToZoom(height))

        // Clamp to configured zoom range
        if (zoom < this.minZoom) {
            // Too far out — remove all tiles
            this._evictAllTiles()
            return
        }

        const tileZoom = Math.min(zoom, this.maxZoom)

        // Get view rectangle
        const rect = this.viewer.camera.computeViewRectangle(
            this.viewer.scene.globe.ellipsoid
        )
        if (!rect) return

        const west = Cesium.Math.toDegrees(rect.west)
        const south = Cesium.Math.toDegrees(rect.south)
        const east = Cesium.Math.toDegrees(rect.east)
        const north = Cesium.Math.toDegrees(rect.north)

        // Calculate tile range for the visible area
        const tileRange = this._getTileRange(west, south, east, north, tileZoom)

        // Cap the number of tiles to prevent overload
        const MAX_TILES = 64
        const totalTiles =
            (tileRange.maxX - tileRange.minX + 1) *
            (tileRange.maxY - tileRange.minY + 1)
        if (totalTiles > MAX_TILES) {
            // Too many tiles — skip update, user needs to zoom in
            return
        }

        // Build set of tiles that should be visible
        const neededTiles = new Set()
        for (let x = tileRange.minX; x <= tileRange.maxX; x++) {
            for (let y = tileRange.minY; y <= tileRange.maxY; y++) {
                neededTiles.add(`${tileZoom}/${x}/${y}`)
            }
        }

        // Evict tiles no longer needed
        for (const key in this._loadedTiles) {
            if (!neededTiles.has(key)) {
                this._evictTile(key)
            }
        }

        // Cancel pending fetches for tiles no longer needed
        for (const key in this._pendingFetches) {
            if (!neededTiles.has(key)) {
                this._pendingFetches[key].abort()
                delete this._pendingFetches[key]
            }
        }

        // Load new tiles
        for (const key of neededTiles) {
            if (!this._loadedTiles[key] && !this._pendingFetches[key]) {
                const [z, x, y] = key.split('/').map(Number)
                this._loadTile(z, x, y)
            }
        }
    }

    /**
     * Convert lng/lat bounds to tile x/y range at a given zoom
     */
    _getTileRange(west, south, east, north, zoom) {
        const n = Math.pow(2, zoom)
        return {
            minX: Math.max(0, Math.floor(((west + 180) / 360) * n)),
            maxX: Math.min(n - 1, Math.floor(((east + 180) / 360) * n)),
            minY: Math.max(
                0,
                Math.floor(
                    ((1 -
                        Math.log(
                            Math.tan((north * Math.PI) / 180) +
                                1 / Math.cos((north * Math.PI) / 180)
                        ) /
                            Math.PI) /
                        2) *
                        n
                )
            ),
            maxY: Math.min(
                n - 1,
                Math.floor(
                    ((1 -
                        Math.log(
                            Math.tan((south * Math.PI) / 180) +
                                1 / Math.cos((south * Math.PI) / 180)
                        ) /
                            Math.PI) /
                        2) *
                        n
                )
            ),
        }
    }

    /**
     * Fetch and decode a single MVT tile, then create extruded primitives
     */
    async _loadTile(z, x, y) {
        const key = `${z}/${x}/${y}`
        const abortController = new AbortController()
        this._pendingFetches[key] = abortController

        const url = this.url
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y)

        try {
            const response = await fetch(url, {
                signal: abortController.signal,
            })

            // Clean up pending tracker
            delete this._pendingFetches[key]

            if (!response.ok) return

            const arrayBuffer = await response.arrayBuffer()

            // Detect gzip (magic bytes 0x1f, 0x8b) and decompress if needed
            let tileData = arrayBuffer
            const bytes = new Uint8Array(arrayBuffer)
            if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
                const ds = new DecompressionStream('gzip')
                const writer = ds.writable.getWriter()
                writer.write(arrayBuffer)
                writer.close()
                const reader = ds.readable.getReader()
                const chunks = []
                let done = false
                while (!done) {
                    const result = await reader.read()
                    if (result.value) chunks.push(result.value)
                    done = result.done
                }
                const totalLength = chunks.reduce(
                    (sum, chunk) => sum + chunk.byteLength,
                    0
                )
                const decompressed = new Uint8Array(totalLength)
                let offset = 0
                for (const chunk of chunks) {
                    decompressed.set(new Uint8Array(chunk.buffer || chunk), offset)
                    offset += chunk.byteLength
                }
                tileData = decompressed.buffer
            }

            // Skip empty tiles
            if (tileData.byteLength === 0) return

            const tile = new VectorTile(new Pbf(tileData))

            // Extract the target sublayer
            const layer = tile.layers[this.vtLayer]
            if (!layer || layer.length === 0) {
                // Log available layers once for debugging
                if (!this._loggedLayers && Object.keys(tile.layers).length > 0) {
                    console.warn(
                        `CesiumMVTLayer "${this.name}": sublayer "${this.vtLayer}" not found. Available:`,
                        Object.keys(tile.layers)
                    )
                    this._loggedLayers = true
                }
                return
            }

            // Calculate tile bounds for coordinate conversion
            const tileBounds = this._tileBounds(z, x, y)

            // Create geometry instances for batched rendering
            const geometryInstances = []

            for (let i = 0; i < layer.length; i++) {
                const feature = layer.feature(i)

                // Only process polygons
                if (feature.type !== 3) continue

                const geojson = feature.toGeoJSON(x, y, z)
                const props = feature.properties

                // Get height from properties
                let extrudeHeight = this.extrudeDefaultHeight
                if (
                    this.extrudeHeightProperty &&
                    props[this.extrudeHeightProperty] != null
                ) {
                    const h = parseFloat(props[this.extrudeHeightProperty])
                    if (!isNaN(h) && h > 0) extrudeHeight = h
                }

                // Skip features with no effective height
                if (extrudeHeight <= 0) continue

                // Get base height if configured
                let baseHeight = 0
                if (
                    this.extrudeBaseProperty &&
                    props[this.extrudeBaseProperty] != null
                ) {
                    const b = parseFloat(props[this.extrudeBaseProperty])
                    if (!isNaN(b)) baseHeight = b
                }

                // Convert GeoJSON polygon coordinates to Cesium positions
                const coordinates = geojson.geometry.coordinates
                if (!coordinates || coordinates.length === 0) continue

                // Handle MultiPolygon and Polygon
                const polygons =
                    geojson.geometry.type === 'MultiPolygon'
                        ? coordinates
                        : [coordinates]

                for (const polygon of polygons) {
                    // Use the outer ring (first ring)
                    const ring = polygon[0]
                    if (!ring || ring.length < 4) continue

                    const positions = []
                    for (const coord of ring) {
                        positions.push(coord[0], coord[1])
                    }

                    try {
                        const instance = new Cesium.GeometryInstance({
                            geometry: new Cesium.PolygonGeometry({
                                polygonHierarchy: new Cesium.PolygonHierarchy(
                                    Cesium.Cartesian3.fromDegreesArray(
                                        positions
                                    )
                                ),
                                extrudedHeight: baseHeight + extrudeHeight,
                                height: baseHeight,
                            }),
                            attributes: {
                                color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                    this._getFeatureColor(props)
                                ),
                            },
                        })
                        geometryInstances.push(instance)
                    } catch (e) {
                        // Skip invalid geometry
                    }
                }
            }

            if (geometryInstances.length === 0) return

            // Create a single batched primitive for all buildings in this tile
            const primitive = new Cesium.Primitive({
                geometryInstances: geometryInstances,
                appearance: new Cesium.PerInstanceColorAppearance({
                    closed: true,
                    flat: false, // Enable normal-based shading (directional lighting)
                    translucent: this.extrudeOpacity * this.opacity < 1.0,
                }),
                shadows: Cesium.ShadowMode.CAST_ONLY,
                asynchronous: true, // Don't block rendering while compiling
            })

            this._primitiveCollection.add(primitive)

            this._loadedTiles[key] = {
                primitive: primitive,
            }
        } catch (err) {
            delete this._pendingFetches[key]
            if (err.name !== 'AbortError') {
                console.warn(`CesiumMVTLayer: failed to load tile ${key}:`, err)
            }
        }
    }

    /**
     * Get the color for a building feature.
     * Uses the feature's own colour property if available, otherwise falls back
     * to the configured extrudeColor.
     */
    _getFeatureColor(props) {
        const alpha = this.extrudeOpacity * this.opacity

        // Try per-feature color from tile data (OpenMapTiles 'colour' property)
        // unless the user has opted to override with a uniform color
        if (!this.extrudeOverrideFeatureColor && props.colour) {
            try {
                return Cesium.Color.fromCssColorString(props.colour).withAlpha(alpha)
            } catch (e) {
                // Invalid color string, fall through
            }
        }

        return Cesium.Color.fromCssColorString(this.extrudeColor).withAlpha(alpha)
    }

    /**
     * Get tile bounds in degrees
     */
    _tileBounds(z, x, y) {
        const n = Math.pow(2, z)
        const west = (x / n) * 360 - 180
        const east = ((x + 1) / n) * 360 - 180
        const north =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
        const south =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) /
            Math.PI
        return { west, south, east, north }
    }

    /**
     * Remove a single tile's primitives
     */
    _evictTile(key) {
        const tileData = this._loadedTiles[key]
        if (tileData) {
            this._primitiveCollection.remove(tileData.primitive)
            delete this._loadedTiles[key]
        }
    }

    /**
     * Remove all loaded tiles
     */
    _evictAllTiles() {
        for (const key in this._loadedTiles) {
            this._evictTile(key)
        }
        // Cancel pending fetches
        for (const key in this._pendingFetches) {
            this._pendingFetches[key].abort()
            delete this._pendingFetches[key]
        }
    }

    /**
     * Set layer visibility
     */
    setVisible(visible) {
        this._visible = visible
        this._primitiveCollection.show = visible
        if (visible) {
            this._updateTiles()
        }
    }

    /**
     * Set layer opacity — rebuilds all tile primitives with new alpha
     */
    setOpacity(opacity) {
        this.opacity = opacity
        // Opacity change requires rebuilding primitives (color attributes are baked in)
        // For simplicity, evict all and let them reload
        const wasVisible = this._visible
        this._evictAllTiles()
        if (wasVisible) {
            this._updateTiles()
        }
    }

    /**
     * Clean up everything — call when removing the layer
     */
    destroy() {
        this.viewer.camera.changed.removeEventListener(this._onCameraChange)
        if (this._updateTimeout) clearTimeout(this._updateTimeout)
        this._evictAllTiles()
        this.viewer.scene.primitives.remove(this._primitiveCollection)
    }
}

export default CesiumMVTLayer
