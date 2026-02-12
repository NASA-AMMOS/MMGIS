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

export default {
    parseExternalStacUrl,
    transformStacUrl
}
