/**
 * Tile layer type — map (Leaflet) renderer.
 *
 * Moved verbatim from Map_.makeTileLayer. Renders a raster tile source
 * (TMS/WMTS/COG/STAC) as a Leaflet colorFilter tileLayer. `L` is the Leaflet
 * global (window.L, extended by bundled Leaflet plugins), matching Map_.js.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import L_ from '@basics/Layers_/Layers_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { transformStacUrl } from '@basics/Layers_/LayerUtils'

const L = window.L

async function make(layerObj, ctx = {}) {
    const mapContext = ctx.mapContext
    // Default to main map context for backward compatibility
    const mCtx = mapContext || {
        map: L_.Map_.map,
        layerRegistry: L_.layers,
        default: true,
    }

    let layerUrl = L_.getUrl(layerObj.type, layerObj.url, layerObj)

    let splitColonType
    const splitColonLayerUrl = layerObj.url.split(':')
    if (splitColonLayerUrl[1] != null) {
        let bandsParam = ''
        let b
        let resamplingParam = ''

        switch (splitColonLayerUrl[0]) {
            case 'stac-collection':
                splitColonType = splitColonLayerUrl[0]
                // Use shared transformation function
                layerUrl = transformStacUrl(
                    layerObj.url,
                    layerObj,
                    'tile',
                    window.location
                )
                // Cache transformed URL for reuse (e.g., in animations)
                layerObj._transformedUrl = layerUrl
                layerObj.tileformat = 'wmts'
                break
            case 'COG':
                splitColonType = splitColonLayerUrl[0]

                // Bands parameter (expression will be added dynamically in getTileUrl)
                bandsParam = ''

                // Only add bands if no expression exists (expression takes precedence)
                if (
                    !layerObj.cogExpression ||
                    layerObj.cogExpression.trim() === ''
                ) {
                    b = layerObj.cogBands
                    if (b != null) {
                        b.forEach((band) => {
                            if (band != null) bandsParam += `&bidx=${band}`
                        })
                    }
                }

                resamplingParam = ''
                if (layerObj.cogResampling) {
                    resamplingParam = `&resampling=${layerObj.cogResampling}`
                }

                layerUrl = `${window.location.origin}${(
                    window.location.pathname || ''
                ).replace(/\/$/g, '')}/titiler/cog/tiles/${
                    layerObj.tileMatrixSet || 'WebMercatorQuad'
                }/{z}/{x}/{y}.webp?url=${layerUrl}${bandsParam}${resamplingParam}`

                break
            default:
                break
        }
    }

    let bb = null
    if (layerObj.hasOwnProperty('boundingBox')) {
        bb = L.latLngBounds(
            L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
            L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
        )
    }
    layerUrl = await TimeControl.performTimeUrlReplacements(
        layerUrl,
        layerObj,
        null
    )

    let tileFormat = 'tms'
    // For backward compatibility with the .tms option
    if (typeof layerObj.tileformat === 'undefined') {
        tileFormat = typeof layerObj.tms === 'undefined' ? true : layerObj.tms
        tileFormat = tileFormat ? 'tms' : 'wmts'
    } else tileFormat = layerObj.tileformat

    mCtx.layerRegistry.layer[layerObj.name] = L.tileLayer.colorFilter(layerUrl, {
        minZoom: parseInt(layerObj.minZoom),
        maxZoom: parseInt(layerObj.maxZoom),
        maxNativeZoom: parseInt(layerObj.maxNativeZoom),
        tileFormat: tileFormat,
        tms: tileFormat === 'tms',
        splitColonType: splitColonType,
        //noWrap: true,
        continuousWorld: true,
        reuseTiles: true,
        bounds: bb,
        timeEnabled: layerObj.time != null && layerObj.time.enabled === true,
        time: typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
        compositeTile:
            typeof layerObj.time === 'undefined'
                ? false
                : layerObj.time.compositeTile || false,
        starttime:
            typeof layerObj.time === 'undefined' ? '' : layerObj.time.start,
        endtime: typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
        customTimes:
            typeof layerObj.time === 'undefined'
                ? null
                : layerObj.time.customTimes,
        cogTransform: layerObj.cogTransform,
        cogMin: layerObj.cogMin,
        currentCogMin: layerObj.currentCogMin,
        cogMax: layerObj.cogMax,
        currentCogMax: layerObj.currentCogMax,
        cogColormap: layerObj.cogColormap,
        cogExpression: layerObj.cogExpression,
        currentCogExpression: layerObj.currentCogExpression,
        variables: layerObj.variables || {},
    })

    // Time-enabled tile layers should never fade (instant swap on pan or time change)
    if (layerObj.time && layerObj.time.enabled === true) {
        mCtx.layerRegistry.layer[layerObj.name]._noFade = true
    }

    // Add to map
    if (mCtx.default != true) {
        mCtx.layerRegistry.layer[layerObj.name].addTo(mCtx.map)
    }

    L_.setLayerOpacity(
        layerObj.name,
        mCtx.layerRegistry.opacity[layerObj.name] || 1
    )

    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
    mCtx.layerRegistry.layer[layerObj.name].off('loading')
    mCtx.layerRegistry.layer[layerObj.name].on('loading', () => {
        L_.setGlobalLoading(layerObj.name)
    })
    mCtx.layerRegistry.layer[layerObj.name].off('load')
    mCtx.layerRegistry.layer[layerObj.name].on('load', () => {
        // Set default css filters for tile layer
        if (
            layerObj.style?.brightness != null &&
            L_.layers.filters[layerObj.name]?.brightness == null
        )
            L_.setLayerFilter(
                layerObj.name,
                'brightness',
                layerObj.style.brightness
            )
        if (
            layerObj.style?.contrast != null &&
            L_.layers.filters[layerObj.name]?.contrast == null
        )
            L_.setLayerFilter(
                layerObj.name,
                'contrast',
                layerObj.style.contrast
            )
        if (
            layerObj.style?.saturation != null &&
            L_.layers.filters[layerObj.name]?.saturation == null
        )
            L_.setLayerFilter(
                layerObj.name,
                'saturation',
                layerObj.style.saturation
            )
        if (
            layerObj.style?.blend != null &&
            L_.layers.filters[layerObj.name]?.blend == null
        )
            L_.setLayerFilter(
                layerObj.name,
                'mix-blend-mode',
                layerObj.style.blend
            )

        L_.setGlobalLoaded(layerObj.name)
    })
    L_.Map_.allLayersLoaded()
}

function remove(layerObj, ctx = {}) {
    const mCtx = ctx.mapContext || { layerRegistry: L_.layers }
    L_.Map_.rmNotNull(mCtx.layerRegistry.layer[layerObj.name])
}

export default {
    make,
    remove,
}
