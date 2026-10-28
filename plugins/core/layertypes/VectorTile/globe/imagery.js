/**
 * VectorTile layer type — flat vector tiles as Cesium imagery.
 *
 * Cesium has no renderer for flat vector tiles, so each imagery tile is drawn
 * here: fetched, decoded and painted onto a canvas with the styles the 2D map
 * draws the same features with, dynamic style included. It is then draped like
 * any raster layer - on terrain, and onto a 3D Tiles tileset that drapes it.
 * Extruded layers are a different thing (CesiumMVTLayer builds them as 3D
 * primitives).
 *
 * @module VectorTile/globe/imagery
 */
import * as Cesium from 'cesium'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { vectorTileStyles } from '../dynamicStyle'

const TILE_SIZE = 256
/** Painted at twice the tile size, so outlines and edges stay crisp. */
const SCALE = 2

/** What VectorGrid draws a feature with before its style (L.Path's defaults). */
const PATH_DEFAULTS = {
    stroke: true,
    color: '#3388ff',
    weight: 3,
    opacity: 1,
    fill: false,
    fillColor: null,
    fillOpacity: 0.2,
    radius: 10,
}

/** A tile's URL; `{-y}` is the row counted from the bottom (TMS). */
export function tileUrl(template, x, y, z) {
    return template
        .replace('{z}', z)
        .replace('{x}', x)
        .replace('{-y}', 2 ** z - 1 - y)
        .replace('{y}', y)
}

/** Raw tile bytes, gunzipped if the server stored them compressed. */
async function tileBytes(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer)
    if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
    const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * The style one feature is painted with, as VectorGrid resolves it: the
 * sublayer's style (or its function of the feature's properties) over L.Path's
 * defaults. Null when it would draw nothing.
 */
function featureStyle(styles, sublayer, properties, z) {
    let style = styles[sublayer]
    if (style instanceof Function) style = style(properties, z)
    if (Array.isArray(style)) style = style[0]
    const resolved = Object.assign({}, PATH_DEFAULTS, style)
    const fills = resolved.fill && resolved.fillOpacity > 0
    const strokes = resolved.stroke && resolved.weight > 0 && resolved.opacity > 0
    return fills || strokes ? resolved : null
}

/** Paint one decoded feature. Geometry is in tile units of `extent`. */
function paintFeature(ctx, feature, style, toPixels) {
    const rings = feature.loadGeometry()
    ctx.beginPath()
    if (feature.type === 1) {
        // Points: a circle each, as L.CircleMarker draws them.
        for (const ring of rings)
            for (const point of ring) {
                const [px, py] = toPixels(point)
                ctx.moveTo(px + style.radius * SCALE, py)
                ctx.arc(px, py, style.radius * SCALE, 0, 2 * Math.PI)
            }
    } else {
        for (const ring of rings) {
            ring.forEach((point, i) => {
                const [px, py] = toPixels(point)
                if (i === 0) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
            })
            if (feature.type === 3) ctx.closePath()
        }
    }
    if (feature.type !== 2 && style.fill && style.fillOpacity > 0) {
        ctx.globalAlpha = style.fillOpacity
        ctx.fillStyle = style.fillColor || style.color
        ctx.fill('evenodd')
    }
    if (style.stroke && style.weight > 0 && style.opacity > 0) {
        ctx.globalAlpha = style.opacity
        ctx.strokeStyle = style.color
        ctx.lineWidth = style.weight * SCALE
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
    }
}

/** Decode a tile and paint every feature its styles draw. */
export function paintTile(bytes, styles, z) {
    const canvas = document.createElement('canvas')
    canvas.width = TILE_SIZE * SCALE
    canvas.height = TILE_SIZE * SCALE
    if (bytes == null || bytes.length === 0) return canvas

    const ctx = canvas.getContext('2d')
    const tile = new VectorTile(new Pbf(bytes))
    for (const sublayer in tile.layers) {
        const layer = tile.layers[sublayer]
        const toPixels = (point) => [
            (point.x * canvas.width) / layer.extent,
            (point.y * canvas.height) / layer.extent,
        ]
        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i)
            const style = featureStyle(styles, sublayer, feature.properties, z)
            if (style != null) paintFeature(ctx, feature, style, toPixels)
        }
    }
    return canvas
}

/**
 * An imagery provider that paints a layer's vector tiles.
 *
 * @param {object} layerObj  The layer's MMGIS config; its styles and dynamic
 *                           style are read as each tile is painted.
 * @param {object} options   { url, minZoom, maxZoom }
 * @returns {Cesium.UrlTemplateImageryProvider}
 */
export function makeVectorTileImageryProvider(layerObj, options) {
    const provider = new Cesium.UrlTemplateImageryProvider({
        url: options.url,
        minimumLevel: options.minZoom || 0,
        maximumLevel: options.maxZoom || 14,
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
    })
    const styles = vectorTileStyles(layerObj)
    provider.requestImage = (x, y, level, request) => {
        const resource = new Cesium.Resource({
            url: tileUrl(options.url, x, y, level),
            request: request,
        })
        // Undefined when Cesium throttles the request; it asks again later.
        const fetched = resource.fetchArrayBuffer()
        if (fetched == null) return undefined
        return fetched
            .then(
                (arrayBuffer) =>
                    arrayBuffer == null ? null : tileBytes(arrayBuffer),
                (error) => {
                    // Tile servers answer a tile outside the data with a 404,
                    // or GeoWebCache with a 400 ("out of range"): nothing to
                    // draw, rather than a tile that failed.
                    if (
                        error instanceof Cesium.RequestErrorEvent &&
                        (error.statusCode === 404 || error.statusCode === 400)
                    )
                        return null
                    throw error
                }
            )
            .then((bytes) => paintTile(bytes, styles, level))
    }
    return provider
}

const VectorTileImagery = {
    makeVectorTileImageryProvider,
    paintTile,
    tileUrl,
}

export default VectorTileImagery
