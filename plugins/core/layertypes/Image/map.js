/**
 * Image layer type — map renderer.
 *
 * Draws a georeferenced single image / GeoTIFF on the 2D map via a GeoRaster
 * layer. Single-band rasters are colormapped client-side (js-colormaps) with a
 * configurable ramp and min/max rescale (auto-derived via the GDAL minmax API
 * when unset). URL resolution and pixel colorizing are engine-neutral and live
 * here; the Leaflet `L.latLngBounds`/GeoRasterLayer construction rides through
 * the MapRenderer escape hatch (`mctx.raw`).
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import $ from 'jquery'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import calls from '@pre/calls'
import parseGeoraster from 'georaster'
import GeoRasterLayer from '@external/georaster-layer-for-leaflet/georaster-layer-for-leaflet.ts'
import {
    evaluate_cmap,
    data as colormapData,
} from '@external/js-colormaps/js-colormaps.js'

// The default color ramp used for image layer types
const IMAGE_DEFAULT_COLOR_RAMP = 'binary'

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const L = mctx.raw

    let layerUrl = L_.getUrl(layerObj.type, layerObj.url, layerObj)
    if (!F_.isUrlAbsolute(layerUrl)) {
        layerUrl = `${window.location.origin}${(
            window.location.pathname || ''
        ).replace(/\/$/g, '')}/${layerUrl}`
    }

    let bb = null
    if (layerObj.hasOwnProperty('boundingBox')) {
        bb = L.latLngBounds(
            L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
            L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
        )
    }

    parseGeoraster(layerUrl)
        .then((georaster) => {
            let pixelValuesToColorFn = null
            if (
                F_.getIn(
                    L_.layers.data[layerObj.name],
                    'variables.hideNoDataValue'
                ) === true
            ) {
                pixelValuesToColorFn = (values) => {
                    // https://github.com/GeoTIFF/georaster-layer-for-leaflet/issues/16
                    return values[0] === georaster.noDataValue
                        ? null
                        : `rgb(${values[0]},${values[1]},${values[2]})`
                }
            }

            const imageInfo = F_.getIn(
                L_.layers.data[layerObj.name],
                'variables.image'
            )

            const hideNoDataValue = F_.getIn(
                L_.layers.data[layerObj.name],
                'variables.hideNoDataValue'
            )

            let min = null
            let max = null
            if (georaster.numberOfRasters === 1) {
                min = layerObj.cogMin
                max = layerObj.cogMax

                if (
                    isNaN(parseFloat(layerObj.cogMin)) ||
                    isNaN(parseFloat(layerObj.cogMax))
                ) {
                    // Try to get the min and max values using gdal if the user did not input min/max in the layer config
                    $.ajax({
                        type: calls.getminmax.type,
                        url: calls.getminmax.url,
                        data: {
                            type: 'minmax',
                            path: calls.getprofile.pathprefix + layerUrl,
                            bands: '[1]', // Assume the geotiff images only have a single band
                        },
                        async: false,
                        success: function (data) {
                            if (
                                data &&
                                data[0] &&
                                data[0].band &&
                                data[0].band === 1
                            ) {
                                if (isNaN(parseFloat(layerObj.cogMin))) {
                                    min = data[0].min
                                    layerObj.cogMin = min
                                }
                                if (isNaN(parseFloat(layerObj.cogMax))) {
                                    max = data[0].max
                                    layerObj.cogMax = max
                                }
                            }
                        },
                        error: function (request, status, error) {
                            console.warn(
                                `Failed to get gdal minmax info for ${layerObj.name}`,
                                request,
                                status,
                                error
                            )
                        },
                    })
                }

                // FIXME A lot of this code is duplicated in LayersTool so find some way to consolidate them as functions
                var range = max - min
                let colormap = null
                let reverse = false
                if (
                    layerObj.cogTransform === true &&
                    'cogColormap' in layerObj
                ) {
                    colormap = layerObj.cogColormap
                    // TiTiler colormap variables are all lower case so we need to format them correctly for js-colormaps
                    if (colormap.toLowerCase().endsWith('_r')) {
                        colormap = colormap.substring(0, colormap.length - 2)
                        reverse = true
                    }

                    let index = Object.keys(colormapData).findIndex((v) => {
                        return v.toLowerCase() === colormap.toLowerCase()
                    })

                    if (index > -1) {
                        colormap = Object.keys(colormapData)[index]
                    } else {
                        colormap = 'binary' // Give it the default value
                    }
                } else {
                    colormap = 'binary' // Give it the default value
                }

                pixelValuesToColorFn = (values) => {
                    var pixelValue = values[0] // single band
                    // don't return a color
                    if (
                        georaster.noDataValue != null &&
                        georaster.noDataValue === pixelValue
                    ) {
                        if (hideNoDataValue) {
                            return null
                        }

                        // Handle the case where we do not want to hide noDataValue
                        return [0, 0, 0]
                    }

                    // scale from 0 - 1
                    var scaledPixelValue = (pixelValue - min) / range
                    if (!(scaledPixelValue >= 0 && scaledPixelValue <= 1)) {
                        if (imageInfo && imageInfo.fillMinMax) {
                            if (scaledPixelValue <= 0) {
                                scaledPixelValue = 0
                            } else if (scaledPixelValue >= 1.0) {
                                scaledPixelValue = 1
                            }
                        } else {
                            return null
                        }
                    }

                    return evaluate_cmap(
                        scaledPixelValue,
                        colormap || IMAGE_DEFAULT_COLOR_RAMP,
                        reverse
                    )
                }
            }

            L_.layers.layer[layerObj.name] = new GeoRasterLayer({
                georaster: georaster,
                resolution: 256,
                opacity: 1.0,
                pixelValuesToColorFn: pixelValuesToColorFn,
            })

            L_.layers.layer[layerObj.name].clearCache()

            L_.layers.layer[layerObj.name].setZIndex(
                L_._layersOrdered.length +
                    1 -
                    L_._layersOrdered.indexOf(layerObj.name)
            )

            L_.setLayerOpacity(layerObj.name, L_.layers.opacity[layerObj.name])

            L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
            L_.Map_.allLayersLoaded()
        })
        .catch((e) => {
            console.warn(`WARNING - Unable to load image: ${layerUrl}`)

            L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
            L_.layers.layer[layerObj.name] = null
            L_.Map_.allLayersLoaded()
        })
}

// A georaster layer that colorizes pixels caches the rendered tiles, and the
// cache does not survive being taken off the map — so re-show has to clear it,
// re-apply the color function and force a redraw (otherwise the image only
// reappears after a zoom).
function onToggle(layerObj, ctx = {}) {
    if (!ctx.visible) return

    const layer = L_.layers.layer[layerObj.name]
    if (!layer || layer.options?.pixelValuesToColorFn == null) return

    layer.clearCache()
    layer.updateColors(layer.options.pixelValuesToColorFn)
    layer.redraw()
}

export default {
    make,
    onToggle,
}
