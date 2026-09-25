/**
 * Tile layer type — globe layer config.
 *
 * Built from the layer's normal MMGIS config object, and shared by both globe
 * engines: the LithoSphere module hands it to LithoSphere's 'tile' layerer, the
 * Cesium module translates it into an imagery provider. Core never builds this.
 */
import L_ from '@basics/Layers_/Layers_'

// COG/STAC tile sources are addressed by a scheme prefix on the configured url
// ('COG:…', 'stac-collection:…'); the globe needs to know which one it is after
// getUrl() has already rewritten the url itself.
function splitColonTypeOf(url) {
    if (typeof url !== 'string') return undefined
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.startsWith('stac-collection:')) return 'stac-collection'
    if (lowerUrl.startsWith('cog:')) return 'COG'
    return undefined
}

export function toGlobeConfig(layerObj) {
    const s = layerObj

    let demUrl = L_.getUrl(s.type, s.demtileurl, s)
    if (s.demtileurl == null || s.demtileurl.length === 0) demUrl = undefined

    return {
        name: s.name,
        order: L_._layersOrdered,
        on: L_.layers.opacity[s.name],
        format: s.tileformat || 'tms',
        formatOptions: {},
        demFormat: s.tileformat || 'tms',
        demFormatOptions: {
            correctSeams: s.tileformat === 'wms',
            wmsParams: {},
        },
        parser: s.demparser || null,
        path: L_.getUrl(s.type, s.url, s),
        demPath: demUrl,
        opacity: L_.layers.opacity[s.name],
        minZoom: s.minZoom,
        maxZoom: s.maxNativeZoom,
        time: s.time,
        // COG parameters for TiTiler layers
        splitColonType: splitColonTypeOf(s.url),
        cogTransform: s.cogTransform,
        cogMin: s.cogMin,
        cogMax: s.cogMax,
        currentCogMin: s.currentCogMin,
        currentCogMax: s.currentCogMax,
        cogColormap: s.cogColormap,
        cogExpression: s.cogExpression,
        currentCogExpression: s.currentCogExpression,
    }
}
