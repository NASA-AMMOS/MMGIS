import proj4 from 'proj4'
import L_ from '../Layers_/Layers_'
import F_ from '../Formulae_/Formulae_'

/**
 * Native MMGIS projection utility.
 *
 * Replicates the tile ↔ lat/lng conversions from LithoSphere's Projection
 * class so that tools like Viewshed and Sightline work regardless of the active
 * 3D renderer (LithoSphere *or* Cesium).
 *
 * Two code-paths:
 *   1. Standard Web Mercator (tileMapResource.proj == null)
 *   2. Custom CRS / polar   (tileMapResource.proj is a proj4 string)
 */

let _instance = null

class Projection_ {
    constructor(tileMapResource, trueTileResolution) {
        this.tileMapResource = tileMapResource || {
            bounds: null,
            origin: null,
            crsCode: 'EPSG:4326',
            proj: null,
            resunitsperpixel: null,
            reszoomlevel: null,
        }
        this.tileMapResource.crsCode =
            this.tileMapResource.crsCode || 'EPSG:4326'

        this.trueTileResolution = trueTileResolution || 256
        this.res = null
        this._proj4Instance = null

        // Build resolution table for custom CRS
        if (
            this.tileMapResource.resunitsperpixel != null &&
            this.tileMapResource.reszoomlevel != null
        ) {
            const baseRes =
                this.tileMapResource.resunitsperpixel *
                Math.pow(2, this.tileMapResource.reszoomlevel)
            this.res = []
            for (let i = 0; i < 32; i++) {
                this.res.push(baseRes / Math.pow(2, i))
            }
        }

        // Initialize proj4 for custom CRS
        if (this.tileMapResource.proj != null) {
            const code = this.tileMapResource.crsCode
            const projCode = Number.isFinite(parseInt(code[0]))
                ? `EPSG:${this.tileMapResource.epsg || code}`
                : code
            proj4.defs(projCode, this.tileMapResource.proj)
            this._proj4Instance = proj4(projCode)
        }
    }

    /**
     * Convert tile XYZ to lat/lng.
     *
     * Web Mercator path uses standard slippy-map formulas.
     * Custom CRS path uses resolution table + proj4 inverse.
     */
    tileXYZ2LatLng = (x, y, z) => {
        if (this.tileMapResource.proj == null) {
            const lng = (x / Math.pow(2, z)) * 360 - 180
            const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
            const lat =
                (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
            return { lat: lat, lng: lng }
        } else {
            y = -y

            const easting =
                this.trueTileResolution * x * this.res[z] +
                this.tileMapResource.origin[0]
            const northing =
                this.trueTileResolution * y * this.res[z] +
                this.tileMapResource.origin[1]

            const point = this._proj4Instance.inverse([easting, northing])
            return { lat: point[1], lng: point[0] }
        }
    }

    /**
     * Convert lat/lng + zoom to tile XYZ.
     *
     * Web Mercator path uses standard slippy-map formulas.
     * Custom CRS path uses proj4 forward + resolution table.
     */
    latLngZ2TileXYZ = (lat, lng, z, dontFloor) => {
        if (this.tileMapResource.proj == null) {
            let x = ((lng + 180) / 360) * Math.pow(2, z)
            let y =
                ((1 -
                    Math.log(
                        Math.tan(lat * (Math.PI / 180)) +
                            1 / Math.cos(lat * (Math.PI / 180))
                    ) /
                        Math.PI) /
                    2) *
                Math.pow(2, z)
            if (dontFloor == null) {
                x = Math.floor(x)
                y = Math.floor(y)
            }
            return { x: x, y: y, z: z }
        } else {
            const p = this._proj4Instance.forward([lng, lat])

            const easting = p[0]
            const northing = p[1]

            const x =
                (easting - this.tileMapResource.origin[0]) /
                (this.trueTileResolution * this.res[z])
            let y =
                (northing - this.tileMapResource.origin[1]) /
                (this.trueTileResolution * this.res[z])

            y = -y

            return { x: x, y: y, z: z }
        }
    }
}

/**
 * Build a Projection_ from the current mission's projection config.
 * Called by GlobeRenderer during initialization.
 */
Projection_.buildFromConfig = function (config) {
    const tmr = config.tileMapResource || {
        bounds: [0, 0, 0, 0],
        origin: [0, 0],
        proj: null,
        resunitsperpixel: 32,
        reszoomlevel: 0,
    }
    return new Projection_(tmr, config.trueTileResolution || 256)
}

export default Projection_
