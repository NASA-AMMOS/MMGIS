/**
 * LayerUtils.js
 * Pure utility functions for layer URL transformations
 *
 * These functions are extracted for reusability and testability.
 * They have no side effects and don't depend on global state.
 */

/**
 * Parse external STAC URL in format: https://example.com/titilerpgstac/collections/collection
 *
 * @param {string} afterColon - URL portion after 'stac-collection:'
 * @returns {Object|null} { baseUrl, collectionName } or null if invalid
 *
 * @example
 * // Returns { baseUrl: 'https://example.com/titilerpgstac', collectionName: 'my_collection' }
 * parseExternalStacUrl('https://example.com/titilerpgstac/collections/my_collection')
 */
export function parseExternalStacUrl(afterColon) {
    // Validate protocol
    if (!afterColon.startsWith('http://') && !afterColon.startsWith('https://')) {
        console.error('External STAC URL must use http:// or https://')
        return null
    }

    // Find /collections/ in the URL
    const collectionsIndex = afterColon.indexOf('/collections/')

    if (collectionsIndex === -1) {
        console.error(
            'Invalid external STAC URL format - missing /collections/ path.',
            `Got: ${afterColon}`,
            'Expected format: stac-collection:https://example.com/titilerpgstac/collections/collection_name'
        )
        return null
    }

    // Split on /collections/
    const baseUrl = afterColon.substring(0, collectionsIndex).trim()
    const collectionPart = afterColon.substring(collectionsIndex + '/collections/'.length)

    // Parse collection name (strip query params and trailing slashes)
    const collectionName = collectionPart.split('?')[0].split('/')[0].trim()

    // Validate
    if (!baseUrl || !collectionName) {
        console.error('Invalid external STAC URL - empty base URL or collection name')
        return null
    }

    // Validate ends with /titilerpgstac
    if (!baseUrl.endsWith('/titilerpgstac')) {
        console.error(
            'External STAC URL base must end with /titilerpgstac.',
            `Got: ${baseUrl}`,
            'Expected format: stac-collection:https://example.com/titilerpgstac/collections/collection_name'
        )
        return null
    }

    return { baseUrl, collectionName }
}

/**
 * Transforms a STAC collection URL (stac-collection:name?params) into a proper HTTP URL
 * for TiTiler PgSTAC endpoints.
 *
 * @param {string} url - The URL to transform (may or may not be a stac-collection: URL)
 * @param {object} layerData - The layer configuration object
 * @param {string} type - The type of endpoint to generate ('tile' or 'image')
 * @param {object} location - Location object with origin and pathname (defaults to window.location)
 * @returns {string} - The transformed URL or the original URL if not a STAC URL
 *
 * @example
 * // Local STAC URL
 * transformStacUrl('stac-collection:my_collection', { cogBands: [1, 2, 3] }, 'tile')
 * // => 'http://localhost:8888/MMGIS/titilerpgstac/collections/my_collection/tiles/...'
 *
 * @example
 * // External STAC URL
 * transformStacUrl('stac-collection:https://example.com/titilerpgstac:remote_collection', {}, 'tile')
 * // => 'https://example.com/titilerpgstac/collections/remote_collection/tiles/...'
 */
export function transformStacUrl(url, layerData, type = 'tile', location = null) {
    if (!url || typeof url !== 'string') return url

    // Check if this is a STAC collection URL
    const lowerUrl = url.toLowerCase()
    if (!lowerUrl.startsWith('stac-collection:')) return url

    const afterColon = url.substring(url.indexOf(':') + 1)
    let baseUrl, collectionName

    // Detect external URL format (contains ://)
    if (afterColon.includes('://')) {
        const result = parseExternalStacUrl(afterColon)
        if (!result) {
            console.error('Failed to parse external STAC URL:', url)
            return url
        }
        baseUrl = result.baseUrl
        collectionName = result.collectionName
    } else {
        // Local format (existing logic)
        const splitParams = afterColon.split('?')
        collectionName = splitParams[0]

        // Use provided location or default to window.location
        const loc = location || (typeof window !== 'undefined' ? window.location : null)
        if (!loc) {
            console.error('Cannot build local STAC URL: location not available')
            return url
        }

        const origin = loc.origin
        const pathname = (loc.pathname || '').replace(/\/$/g, '')
        baseUrl = `${origin}${pathname}/titilerpgstac`
    }

    // Build bands parameter (only if no expression exists)
    let bandsParam = ''
    if (
        layerData &&
        (!layerData.cogExpression || layerData.cogExpression.trim() === '')
    ) {
        const bands = layerData.cogBands
        if (bands != null) {
            bands.forEach((band) => {
                if (band != null) bandsParam += `&bidx=${band}`
            })
        }
    }

    // Build resampling parameter
    let resamplingParam = ''
    if (layerData && layerData.cogResampling) {
        resamplingParam = `&resampling=${layerData.cogResampling}`
    }

    // Generate different endpoints based on type
    if (type === 'tile') {
        // Tile endpoint for raster tiles
        return `${baseUrl}/collections/${collectionName}/tiles/${
            (layerData && layerData.tileMatrixSet) || 'WebMercatorQuad'
        }/{z}/{x}/{y}?assets=asset${bandsParam}${resamplingParam}`
    } else if (type === 'data') {
        const tmsId = (layerData && layerData.tileMatrixSet) || 'WebMercatorQuad'
        const parser = layerData && layerData.demparser
        const tileBase = `${baseUrl}/collections/${collectionName}/tiles/${tmsId}`
        if (parser === 'terrarium') {
            return `${tileBase}/{z}/{x}/{y}.png?algorithm=terrarium&assets=asset${bandsParam}${resamplingParam}`
        } else if (parser === 'terrainrgb') {
            return `${tileBase}/{z}/{x}/{y}.png?algorithm=terrainrgb&assets=asset${bandsParam}${resamplingParam}`
        } else {
            // Default: npy — raw float32, no compression, fastest server-side processing
            return `${tileBase}/{z}/{x}/{y}.npy?assets=asset${bandsParam}${resamplingParam}`
        }
    } else {
        // For images, we use preview endpoint
        // Note: STAC collections are typically designed for tile serving
        if (layerData && layerData.name) {
            console.warn(
                `STAC layer "${layerData.name}" is configured as an image layer. ` +
                    `STAC collections work best with tile layer type. ` +
                    `Attempting to use preview endpoint.`
            )
        }
        return `${baseUrl}/collections/${collectionName}/preview?assets=asset${bandsParam}${resamplingParam}`
    }
}

/**
 * Build TiTiler query parameters for COG and STAC collection layers
 * Extracted from leaflet-tilelayer-middleware.js for reusability in both Leaflet and Cesium
 *
 * @param {Object} options - Configuration options
 * @param {string} options.splitColonType - 'COG' or 'stac-collection'
 * @param {string} options.starttime - Start time for datetime parameter
 * @param {string} options.endtime - End time for datetime parameter
 * @param {boolean} options.cogTransform - Enable rescaling and coloring
 * @param {number} options.cogMin - Minimum value for rescaling
 * @param {number} options.cogMax - Maximum value for rescaling
 * @param {number} options.currentCogMin - Runtime minimum value (overrides cogMin)
 * @param {number} options.currentCogMax - Runtime maximum value (overrides cogMax)
 * @param {string} options.cogColormap - Colormap name (e.g., 'viridis', 'cividis')
 * @param {string} options.cogExpression - Band math expression
 * @param {string} options.currentCogExpression - Runtime expression (overrides cogExpression)
 * @returns {string} Query parameters string (without leading ? or &)
 *
 * @example
 * // Returns 'datetime=2026-02-18/2026-03-18&exitwhenfull=false&skipcovered=false&rescale=[0,300]&colormap_name=cividis'
 * buildTiTilerQueryParams({
 *   splitColonType: 'stac-collection',
 *   starttime: '2026-02-18',
 *   endtime: '2026-03-18',
 *   cogTransform: true,
 *   cogMin: 0,
 *   cogMax: 300,
 *   cogColormap: 'cividis'
 * })
 */
export function buildTiTilerQueryParams(options) {
    const params = []

    // datetime parameter
    if (options.endtime != null) {
        const datetime = options.starttime != null
            ? `${options.starttime}/${options.endtime}`
            : `../${options.endtime}`
        params.push(`datetime=${datetime}`)
    }

    // STAC-specific parameters
    if (options.splitColonType === 'stac-collection') {
        params.push('exitwhenfull=false&skipcovered=false')
    }

    // rescale parameter
    if (
        options.cogTransform === true &&
        options.cogMin != null &&
        options.cogMax != null
    ) {
        const min = options.currentCogMin != null ? options.currentCogMin : options.cogMin
        const max = options.currentCogMax != null ? options.currentCogMax : options.cogMax
        params.push(`rescale=[${min},${max}]`)

        // colormap parameter (only with rescale)
        if (options.cogColormap != null) {
            params.push(`colormap_name=${options.cogColormap.toLowerCase()}`)
        }
    }

    // expression parameter
    const expressionToUse = options.currentCogExpression || options.cogExpression
    if (expressionToUse && expressionToUse.trim() !== '') {
        // Replace bX or BX (where X is a number) with asset_bX or asset_BX
        // Only replace if not already prefixed with an asset name (word_bX pattern)
        const processedExpression = expressionToUse.replace(/(?<!\w)([bB])(\d+)/g, 'asset_$1$2')
        params.push(`expression=${encodeURIComponent(processedExpression)}`)
    }

    // STAC mosaic limits from global config
    if (typeof mmgisglobal !== 'undefined' && mmgisglobal.options?.stac) {
        if (mmgisglobal.options.stac.mosaicItemLimit != null) {
            params.push(`items_limit=${mmgisglobal.options.stac.mosaicItemLimit}`)
        }
        if (mmgisglobal.options.stac.mosaicScanLimit != null) {
            params.push(`scan_limit=${mmgisglobal.options.stac.mosaicScanLimit}`)
        }
        if (mmgisglobal.options.stac.mosaicTimeLimit != null) {
            params.push(`time_limit=${mmgisglobal.options.stac.mosaicTimeLimit}`)
        }
    }

    return params.join('&')
}

export default {
    parseExternalStacUrl,
    transformStacUrl,
    buildTiTilerQueryParams
}
