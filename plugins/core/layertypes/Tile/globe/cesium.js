/**
 * Tile layer type — Cesium globe renderer.
 *
 * Model-3 hybrid extraction: this module owns all Cesium-specific tile content
 * — imagery-provider construction (TMS/WMTS/WMS + COG/STAC via TiTiler),
 * per-layer opacity/visibility/removal, and COG/time refresh. GlobeRenderer
 * stays the middleware: it owns lifecycle, the shared `_layers` registry, and
 * collection-level imagery ordering, and dispatches here through
 * LayerTypeRegistry.
 *
 * gctx (cesium) = {
 *   engine: 'cesium',
 *   renderer,          // Cesium Viewer
 *   layers,            // GlobeRenderer._layers (shared registry, keyed by name)
 *   requestRender,     // () => GlobeRenderer._requestRender()
 *   utils: { calculateImageryIndex }  // collection-level helpers kept in core
 * }
 */
import * as Cesium from 'cesium'
import { utcFormat } from 'd3-time-format'
import LayerUtils from '@basics/Layers_/LayerUtils'
import { toGlobeConfig } from './layerConfig'

// TMS y-origin is at the bottom (Cesium's default); WMTS y-origin is at the top.
// Both currently pass through unchanged — kept as a seam for future transforms.
function convertTileUrl(path, format) {
    if (format === 'tms') {
        return path
    }
    return path
}

// Parse a WMS URL into its base and an uppercased param map (WMS params are
// case-insensitive).
function parseWmsUrl(url) {
    const urlSplit = url.split('?')
    const baseUrl = urlSplit[0]
    const queryString = urlSplit[1] || ''

    const wmsParams = {}
    if (queryString) {
        const urlParams = new URLSearchParams(queryString)
        for (const [key, value] of urlParams.entries()) {
            wmsParams[key.toUpperCase()] = value
        }
    }
    return { baseUrl, wmsParams }
}

// Substitute {time}/{endtime}/{starttime}/{customtime.N} tokens in a URL.
function replaceTimeParameters(url, timeConfig) {
    if (!timeConfig || !timeConfig.enabled) return url

    const timeFormat =
        timeConfig.format == null || timeConfig.format === ''
            ? utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : utcFormat(timeConfig.format)

    let processedUrl = url

    if (timeConfig.end) {
        const formattedEnd = timeFormat(Date.parse(timeConfig.end))
        processedUrl = processedUrl
            .replace(/{time}/g, formattedEnd)
            .replace(/{endtime}/g, formattedEnd)
    }

    if (timeConfig.start) {
        const formattedStart = timeFormat(Date.parse(timeConfig.start))
        processedUrl = processedUrl.replace(/{starttime}/g, formattedStart)
    }

    if (timeConfig.customTimes?.times) {
        for (let i = 0; i < timeConfig.customTimes.times.length; i++) {
            const regex = new RegExp(`\\{customtime\\.${i}\\}`, 'g')
            const formattedCustomTime = timeFormat(
                Date.parse(timeConfig.customTimes.times[i])
            )
            processedUrl = processedUrl.replace(regex, formattedCustomTime)
        }
    }

    return processedUrl
}

// Append TiTiler query params for COG / STAC-collection layers.
function buildTiTilerUrl(baseUrl, layerConfig) {
    if (
        layerConfig.splitColonType !== 'COG' &&
        layerConfig.splitColonType !== 'stac-collection'
    ) {
        return baseUrl
    }

    const queryParams = LayerUtils.buildTiTilerQueryParams({
        splitColonType: layerConfig.splitColonType,
        starttime: layerConfig.time?.start,
        endtime: layerConfig.time?.end,
        cogTransform: layerConfig.cogTransform,
        cogMin: layerConfig.cogMin,
        cogMax: layerConfig.cogMax,
        currentCogMin: layerConfig.currentCogMin,
        currentCogMax: layerConfig.currentCogMax,
        cogColormap: layerConfig.cogColormap,
        cogExpression: layerConfig.cogExpression,
        currentCogExpression: layerConfig.currentCogExpression,
    })

    if (queryParams) {
        const separator = baseUrl.indexOf('?') === -1 ? '?' : '&'
        return baseUrl + separator + queryParams
    }

    return baseUrl
}

// Build a Cesium imagery provider from a resolved URL. `full` selects the
// verbose WMS parameter set (used on add / time-refresh); COG-refresh passes the
// raw WMS params through unchanged, matching the original behavior.
function makeUrlTemplateProvider(url, format, maxZoom, minZoom) {
    return new Cesium.UrlTemplateImageryProvider({
        url: convertTileUrl(url, format),
        maximumLevel: maxZoom || 18,
        minimumLevel: minZoom || 0,
    })
}

function makeWmsProviderFull(url, name, maxZoom, minZoom) {
    const { baseUrl, wmsParams } = parseWmsUrl(url)

    if (!wmsParams.LAYERS) {
        console.warn(
            `WMS layer ${name} has no LAYERS parameter in URL: ${url}`
        )
    }

    return new Cesium.WebMapServiceImageryProvider({
        url: baseUrl,
        layers: wmsParams.LAYERS || '',
        parameters: {
            format: wmsParams.FORMAT || 'image/png',
            transparent:
                wmsParams.TRANSPARENT !== undefined
                    ? wmsParams.TRANSPARENT
                    : 'true',
            version: wmsParams.VERSION || '1.1.1',
            ...Object.fromEntries(
                Object.entries(wmsParams).filter(
                    ([key]) =>
                        ![
                            'SERVICE',
                            'REQUEST',
                            'LAYERS',
                            'FORMAT',
                            'TRANSPARENT',
                            'VERSION',
                            'SRS',
                            'CRS',
                        ].includes(key)
                )
            ),
        },
        enablePickFeatures: false,
        maximumLevel: maxZoom || 18,
        minimumLevel: minZoom || 0,
    })
}

// Swap a rebuilt imagery layer back into the same collection position it held.
function restoreImageryPosition(renderer, newLayer, index) {
    if (index >= 0) {
        const currentIndex = renderer.imageryLayers.indexOf(newLayer)
        if (currentIndex !== index) {
            renderer.imageryLayers.remove(newLayer, false)
            renderer.imageryLayers.add(newLayer, index)
        }
    }
}

function make(layerObj, gctx) {
    return render(toGlobeConfig(layerObj), gctx)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    const { renderer, layers } = gctx
    const { name } = layerConfig

    const timeConfig = layerConfig.time
        ? {
              enabled: layerConfig.time.enabled || false,
              start: layerConfig.time.start || null,
              end: layerConfig.time.end || null,
              customTimes: layerConfig.time.customTimes || null,
              format: layerConfig.time.format || null,
              originalUrl: layerConfig.path,
          }
        : null

    let processedUrl = timeConfig?.enabled
        ? replaceTimeParameters(layerConfig.path, timeConfig)
        : layerConfig.path

    processedUrl = buildTiTilerUrl(processedUrl, layerConfig)

    let imageryProvider
    if (layerConfig.format === 'wms') {
        imageryProvider = makeWmsProviderFull(
            processedUrl,
            name,
            layerConfig.maxZoom,
            layerConfig.minZoom
        )
    } else {
        imageryProvider = makeUrlTemplateProvider(
            processedUrl,
            layerConfig.format,
            layerConfig.maxZoom,
            layerConfig.minZoom
        )
    }

    const layer = renderer.imageryLayers.addImageryProvider(imageryProvider)
    layer.alpha =
        layerConfig.opacity !== undefined ? layerConfig.opacity : 1.0

    layers[name] = {
        type: 'tile',
        kind: 'imagery',
        layer: layer,
        visible: true,
        timeConfig: timeConfig,
        format: layerConfig.format,
        maxZoom: layerConfig.maxZoom,
        minZoom: layerConfig.minZoom,
        opacity: layerConfig.opacity,
        order: layerConfig.order,
        cogConfig: {
            splitColonType: layerConfig.splitColonType,
            cogTransform: layerConfig.cogTransform,
            cogMin: layerConfig.cogMin,
            cogMax: layerConfig.cogMax,
            currentCogMin: layerConfig.currentCogMin,
            currentCogMax: layerConfig.currentCogMax,
            cogColormap: layerConfig.cogColormap,
            cogExpression: layerConfig.cogExpression,
            currentCogExpression: layerConfig.currentCogExpression,
        },
        originalUrl: layerConfig.path,
    }
    gctx.requestRender()
}

// Engine-specific removal only; GlobeRenderer performs the generic `_layers`
// cleanup and render request.
function destroy(name, gctx) {
    const layerInfo = gctx.layers[name]
    if (layerInfo) gctx.renderer.imageryLayers.remove(layerInfo.layer)
}

function setOpacity(name, opacity, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.layer.alpha = opacity
    gctx.requestRender()
}

// Visibility toggling re-adds the imagery at its ordered position when turned
// on (Cesium drops removed imagery from the collection). GlobeRenderer issues
// the render request after dispatch.
function setVisibility(name, visible, gctx) {
    const { renderer, layers } = gctx
    const layerInfo = layers[name]
    if (!layerInfo) return

    if (visible && !layerInfo.visible) {
        const correctIndex = gctx.utils.calculateImageryIndex(
            name,
            layerInfo.order
        )

        if (renderer.imageryLayers.contains(layerInfo.layer)) {
            renderer.imageryLayers.remove(layerInfo.layer)
        }

        const newLayer = renderer.imageryLayers.add(
            layerInfo.layer,
            correctIndex
        )
        if (newLayer) layerInfo.layer = newLayer
    } else if (!visible && layerInfo.visible) {
        renderer.imageryLayers.remove(layerInfo.layer)
    }

    layerInfo.visible = visible
}

// Rebuild the imagery provider with refreshed time tokens (preserving COG
// params) and restore alpha/visibility/position.
function timeChange(name, gctx) {
    const { renderer, layers } = gctx
    const layerInfo = layers[name]
    if (!layerInfo || !layerInfo.timeConfig?.enabled) return

    const alpha = layerInfo.layer.alpha
    const show = layerInfo.layer.show
    const index = renderer.imageryLayers.indexOf(layerInfo.layer)

    renderer.imageryLayers.remove(layerInfo.layer)

    let url = replaceTimeParameters(
        layerInfo.timeConfig.originalUrl,
        layerInfo.timeConfig
    )

    if (layerInfo.cogConfig) {
        url = buildTiTilerUrl(url, {
            ...layerInfo.cogConfig,
            time: layerInfo.timeConfig,
        })
    }

    const newProvider =
        layerInfo.format === 'wms'
            ? makeWmsProviderFull(
                  url,
                  name,
                  layerInfo.maxZoom,
                  layerInfo.minZoom
              )
            : makeUrlTemplateProvider(
                  url,
                  layerInfo.format,
                  layerInfo.maxZoom,
                  layerInfo.minZoom
              )

    const newLayer = renderer.imageryLayers.addImageryProvider(newProvider)
    newLayer.alpha = alpha
    newLayer.show = show

    restoreImageryPosition(renderer, newLayer, index)

    layerInfo.layer = newLayer
    gctx.requestRender()
}

// Rebuild the imagery provider with refreshed COG params (preserving time) and
// restore alpha/visibility/position.
function setStyle(name, gctx) {
    const { renderer, layers } = gctx
    const layerInfo = layers[name]
    if (!layerInfo) return

    const alpha = layerInfo.layer.alpha
    const show = layerInfo.layer.show
    const index = renderer.imageryLayers.indexOf(layerInfo.layer)

    renderer.imageryLayers.remove(layerInfo.layer)

    let url = layerInfo.originalUrl

    if (layerInfo.timeConfig?.enabled) {
        url = replaceTimeParameters(url, layerInfo.timeConfig)
    }

    url = buildTiTilerUrl(url, {
        ...layerInfo.cogConfig,
        time: layerInfo.timeConfig,
    })

    let newProvider
    if (layerInfo.format === 'wms') {
        const { baseUrl, wmsParams } = parseWmsUrl(url)
        newProvider = new Cesium.WebMapServiceImageryProvider({
            url: baseUrl,
            layers: wmsParams.LAYERS || '',
            parameters: wmsParams,
        })
    } else {
        newProvider = makeUrlTemplateProvider(
            url,
            layerInfo.format,
            layerInfo.maxZoom,
            layerInfo.minZoom
        )
    }

    const newLayer = renderer.imageryLayers.addImageryProvider(newProvider)
    newLayer.alpha = alpha
    newLayer.show = show

    restoreImageryPosition(renderer, newLayer, index)

    layerInfo.layer = newLayer
    gctx.requestRender()
}

export default {
    make,
    render,
    destroy,
    setOpacity,
    setVisibility,
    timeChange,
    setStyle,
}
