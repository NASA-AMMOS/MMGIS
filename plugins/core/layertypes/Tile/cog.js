/**
 * COG (TiTiler) tile URL helpers shared by the 2D map and globe renderers.
 * @module Tile/cog
 */

// Encode a COG source as one `url=` value; `{token}` placeholders stay literal for time substitution
export function encodeCogSourceUrl(sourceUrl) {
    return encodeURIComponent(sourceUrl)
        .replace(/%7B/gi, '{')
        .replace(/%7D/gi, '}')
}

// Build the /titiler/cog/tiles template for a mission-resolved COG source (s3://, https://, ../../Missions/...)
export function buildCogTileUrl(sourceUrl, layerObj, location) {
    const loc = location || window.location
    const base = `${loc.origin}${(loc.pathname || '').replace(/\/$/g, '')}`
    const tms = (layerObj && layerObj.tileMatrixSet) || 'WebMercatorQuad'

    // Expression takes precedence over bands
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
