/**
 * Tile layer type — COG source helpers.
 *
 * A COG source (`COG:{url}`) is rasterised by TiTiler, so the layer's tile
 * template is a `/titiler/cog/tiles/...` endpoint whose `url` query parameter
 * carries the (already mission-resolved) source. Shared by the 2D map renderer
 * and the globe layer config so both engines request identical tiles.
 *
 * @module Tile/cog
 */

/**
 * Encode a COG source for use as a single `url=` query value. `{token}`
 * placeholders (e.g. `{starttime}`) are kept literal so time substitution and
 * Leaflet templating still work on the assembled tile URL.
 */
export function encodeCogSourceUrl(sourceUrl) {
    return encodeURIComponent(sourceUrl)
        .replace(/%7B/gi, '{')
        .replace(/%7D/gi, '}')
}

/**
 * Build the TiTiler tile template for a resolved COG source.
 * @param {string} sourceUrl - Resolved COG source (s3://, https://, ../../Missions/...)
 * @param {Object} layerObj - Layer config (cogBands, cogExpression, cogResampling, tileMatrixSet)
 * @param {Location} [location=window.location]
 */
export function buildCogTileUrl(sourceUrl, layerObj, location) {
    const loc = location || window.location
    const base = `${loc.origin}${(loc.pathname || '').replace(/\/$/g, '')}`
    const tms = (layerObj && layerObj.tileMatrixSet) || 'WebMercatorQuad'

    // Bands only apply when no expression is set (expression takes precedence)
    let bandsParam = ''
    const hasExpression =
        layerObj &&
        layerObj.cogExpression &&
        layerObj.cogExpression.trim() !== ''
    if (!hasExpression && layerObj && layerObj.cogBands != null) {
        layerObj.cogBands.forEach((band) => {
            if (band != null) bandsParam += `&bidx=${band}`
        })
    }

    let resamplingParam = ''
    if (layerObj && layerObj.cogResampling) {
        resamplingParam = `&resampling=${layerObj.cogResampling}`
    }

    return `${base}/titiler/cog/tiles/${tms}/{z}/{x}/{y}.webp?url=${encodeCogSourceUrl(
        sourceUrl
    )}${bandsParam}${resamplingParam}`
}
