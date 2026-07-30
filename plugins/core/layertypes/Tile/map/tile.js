/**
 * Tile layer type — map renderer.
 *
 * Renders a raster tile source (TMS/WMTS/COG/STAC) on the 2D map. All URL/scheme
 * handling (STAC/COG transforms, TiTiler routing, time-token replacement) is
 * engine-neutral and lives here; the actual imagery is added through the
 * MapRenderer middleware's neutral `addTile` primitive rather than by touching
 * Leaflet directly. Leaflet-colorFilter-specific options (COG/time/filter fields)
 * ride through `engineOptions` — the documented per-engine escape hatch.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { transformStacUrl } from '@basics/Layers_/LayerUtils'

async function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)

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

    MapRenderer.addTile(
        layerObj,
        {
            url: layerUrl,
            tms: tileFormat === 'tms',
            minZoom: parseInt(layerObj.minZoom),
            maxZoom: parseInt(layerObj.maxZoom),
            maxNativeZoom: parseInt(layerObj.maxNativeZoom),
            boundingBox: layerObj.hasOwnProperty('boundingBox')
                ? layerObj.boundingBox
                : null,
            noFade: layerObj.time != null && layerObj.time.enabled === true,
            engineOptions: {
                tileFormat: tileFormat,
                splitColonType: splitColonType,
                //noWrap: true,
                continuousWorld: true,
                reuseTiles: true,
                timeEnabled:
                    layerObj.time != null && layerObj.time.enabled === true,
                time: typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
                compositeTile:
                    typeof layerObj.time === 'undefined'
                        ? false
                        : layerObj.time.compositeTile || false,
                starttime:
                    typeof layerObj.time === 'undefined'
                        ? ''
                        : layerObj.time.start,
                endtime:
                    typeof layerObj.time === 'undefined' ? '' : layerObj.time.end,
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
            },
            onLoad: () => {
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
            },
        },
        mctx
    )
}

export default {
    make,
}
