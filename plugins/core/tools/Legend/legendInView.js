/**
 * legendInView — which of a class raster's legend entries are on screen.
 *
 * A class legend can run to dozens of entries when only a handful are in
 * front of the user. For a `stac-collection:` or `COG:` layer the pixel values
 * under the current view are read from TiTiler in one small request (the view,
 * sampled down to a thumbnail of raw values), and the legend is narrowed to
 * the entries those values belong to (a COG is asked for the entries
 * themselves, since TiTiler won't give up a paletted COG's raw values). A
 * vector layer's features are already
 * here, so the ones in view are simply asked what they are.
 *
 * Kept free of the map and the DOM so it can be unit tested.
 *
 * @module legendInView
 */

import {
    parseExternalStacUrl,
    formatStacBidx,
} from '../../../../src/essence/Basics/Layers_/LayerUtils.js'
import { readProperty } from '../../../../src/essence/Basics/Layers_/render/dynamicStyle.js'
import { resolveEntryIndex, parseRange, toNumber } from './legendHighlight.js'

/** Longest side, in pixels, of the thumbnail the view is sampled to. */
export const SAMPLE_SIZE = 256

const TYPED_ARRAYS = {
    u1: Uint8Array,
    i1: Int8Array,
    u2: Uint16Array,
    i2: Int16Array,
    u4: Uint32Array,
    i4: Int32Array,
    f4: Float32Array,
    f8: Float64Array,
}

/**
 * Read a NumPy `.npy` file, as TiTiler writes them.
 *
 * @param {ArrayBuffer} buffer
 * @returns {{shape: Array<number>, data: object}|null} null if it isn't one
 *   this can read (big-endian, Fortran order, or an unsupported type).
 */
export function parseNpy(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) return null
    const bytes = new Uint8Array(buffer)
    // \x93NUMPY
    if (bytes[0] !== 0x93 || String.fromCharCode(...bytes.slice(1, 6)) !== 'NUMPY')
        return null

    const view = new DataView(buffer)
    const major = bytes[6]
    const headerLength = major >= 2 ? view.getUint32(8, true) : view.getUint16(8, true)
    const headerStart = major >= 2 ? 12 : 10
    const dataStart = headerStart + headerLength
    if (dataStart > buffer.byteLength) return null

    let header = ''
    for (let i = headerStart; i < dataStart; i++)
        header += String.fromCharCode(bytes[i])

    const descr = header.match(/'descr':\s*'([<>|=])?([a-z])(\d+)'/)
    const shapeMatch = header.match(/'shape':\s*\(([^)]*)\)/)
    if (descr == null || shapeMatch == null) return null
    if (descr[1] === '>') return null
    if (/'fortran_order':\s*True/.test(header)) return null

    const TypedArray = TYPED_ARRAYS[`${descr[2]}${descr[3]}`]
    if (TypedArray == null) return null

    const shape = shapeMatch[1]
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '')
        .map((n) => parseInt(n, 10))
    if (shape.some((n) => !isFinite(n) || n < 0)) return null

    const count = shape.reduce((total, n) => total * n, 1)
    if (dataStart + count * TypedArray.BYTES_PER_ELEMENT > buffer.byteLength)
        return null
    // Copied out, because the header leaves the data unaligned for its type.
    const data = new TypedArray(
        buffer.slice(
            dataStart,
            dataStart + count * TypedArray.BYTES_PER_ELEMENT
        )
    )
    return { shape, data }
}

/**
 * The distinct pixel values in a TiTiler `.npy` read: the first band's, where
 * the last band (TiTiler appends the mask) says there is data.
 *
 * @param {{shape: Array<number>, data: object}} npy - (bands, height, width)
 * @returns {Set<number>}
 */
export function distinctValues(npy) {
    const values = new Set()
    if (npy == null || !Array.isArray(npy.shape)) return values
    if (npy.shape.length !== 3) return values
    const [bands, height, width] = npy.shape
    const size = height * width
    if (bands < 1 || size === 0) return values

    const maskStart = bands > 1 ? (bands - 1) * size : -1
    for (let i = 0; i < size; i++) {
        if (maskStart >= 0 && npy.data[maskStart + i] === 0) continue
        const value = npy.data[i]
        if (value === value) values.add(value)
    }
    return values
}

/**
 * Which of a legend's entries the values on screen belong to.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries
 * @param {Set<number>} values
 * @returns {Set<number>} indexes into `entries`
 */
export function entriesInView(entries, values) {
    const inView = new Set()
    if (!Array.isArray(entries) || values == null) return inView
    values.forEach((value) => {
        // A category is its entry's recorded value exactly, whatever its label.
        const recorded = entries.findIndex(
            (entry) =>
                entry.propertyValue != null &&
                entry.propertyValue !== '' &&
                String(entry.propertyValue) === String(value)
        )
        const index =
            recorded >= 0 ? recorded : resolveEntryIndex(entries, value, false)
        if (index >= 0) inView.add(index)
    })
    return inView
}

/**
 * The distinct values a set of features holds for each of some properties.
 *
 * @param {Array<object>} features - GeoJSON features
 * @param {Array<string>} properties - property paths, dot-notated
 * @returns {Map<string, Set<*>>}
 */
export function distinctPropertyValues(features, properties) {
    const valuesByProperty = new Map()
    ;(properties || []).forEach((property) => {
        if (typeof property === 'string' && property !== '')
            valuesByProperty.set(property, new Set())
    })
    if (!Array.isArray(features)) return valuesByProperty
    features.forEach((feature) => {
        valuesByProperty.forEach((values, property) => {
            const value = readProperty(feature?.properties, property)
            if (value != null && value !== '') values.add(value)
        })
    })
    return valuesByProperty
}

// Leaflet bounds run past the antimeridian and the poles on a wide view.
function clampBounds(bounds) {
    if (bounds == null) return null
    const west = Math.max(-180, Math.min(180, bounds.west))
    const east = Math.max(-180, Math.min(180, bounds.east))
    const south = Math.max(-90, Math.min(90, bounds.south))
    const north = Math.max(-90, Math.min(90, bounds.north))
    if (![west, east, south, north].every((n) => isFinite(n))) return null
    if (east <= west || north <= south) return null
    return { west, south, east, north }
}

/**
 * The size to sample a view at: its own proportions, longest side SAMPLE_SIZE.
 *
 * @param {{x: number, y: number}} [mapSize] - the map's size in pixels
 * @returns {{width: number, height: number}}
 */
export function sampleSize(mapSize) {
    const x = mapSize?.x > 0 ? mapSize.x : 1
    const y = mapSize?.y > 0 ? mapSize.y : 1
    const scale = SAMPLE_SIZE / Math.max(x, y)
    return {
        width: Math.max(1, Math.round(x * scale)),
        height: Math.max(1, Math.round(y * scale)),
    }
}

/**
 * The request that reads a layer's raw pixel values under a view, or null if
 * the layer isn't one this can narrow: only a `stac-collection:` layer drawn
 * from its bands as they are (an expression or a rescale makes the drawn
 * values something other than the legend's).
 *
 * It asks for the same items the map tiles mosaic, so it sees what is drawn.
 *
 * @param {object} layerObj
 * @param {{west: number, south: number, east: number, north: number}} bounds
 * @param {object} [options]
 * @param {{x: number, y: number}} [options.mapSize]
 * @param {{origin: string, pathname: string}} [options.location]
 * @param {object} [options.stac] - mmgisglobal.options.stac mosaic limits
 * @returns {string|null}
 */
export function viewValuesUrl(layerObj, bounds, options = {}) {
    const url = layerObj?.url
    if (typeof url !== 'string') return null
    if (!url.toLowerCase().startsWith('stac-collection:')) return null
    if (layerObj.cogTransform === true) return null
    const expression = layerObj.currentCogExpression || layerObj.cogExpression
    if (typeof expression === 'string' && expression.trim() !== '') return null

    const box = clampBounds(bounds)
    if (box == null) return null

    const afterColon = url.substring(url.indexOf(':') + 1)
    let baseUrl, collectionName
    if (afterColon.includes('://')) {
        const parsed = parseExternalStacUrl(afterColon)
        if (parsed == null) return null
        baseUrl = parsed.baseUrl
        collectionName = parsed.collectionName
    } else {
        collectionName = afterColon.split('?')[0].trim()
        const loc =
            options.location ||
            (typeof window !== 'undefined' ? window.location : null)
        if (collectionName === '' || loc == null) return null
        baseUrl = `${loc.origin}${(loc.pathname || '').replace(
            /\/$/g,
            ''
        )}/titilerpgstac`
    }

    const { width, height } = sampleSize(options.mapSize)
    const round = (n) => Math.round(n * 1e6) / 1e6

    let assets = 'assets=asset'
    const bands = formatStacBidx(layerObj.cogBands)
    if (bands) assets += `|bidx=${bands}`

    // Nearest, so a sampled pixel is a class that is there and never a blend.
    const params = [assets, 'resampling=nearest', 'reproject=nearest']
    const stac = options.stac || {}
    params.push(`items_limit=${stac.mosaicItemLimit ?? 100}`)
    if (stac.mosaicScanLimit != null)
        params.push(`scan_limit=${stac.mosaicScanLimit}`)
    if (stac.mosaicTimeLimit != null)
        params.push(`time_limit=${stac.mosaicTimeLimit}`)
    if (layerObj.time?.enabled === true && layerObj.time.end != null)
        params.push(
            `datetime=${
                layerObj.time.start != null ? layerObj.time.start : '..'
            }/${layerObj.time.end}`
        )

    return `${baseUrl}/collections/${collectionName}/bbox/${round(
        box.west
    )},${round(box.south)},${round(box.east)},${round(
        box.north
    )}/${width}x${height}.npy?${params.join('&')}`
}

/**
 * A TiTiler color table that paints each pixel with the legend entry it
 * belongs to, or null if no entry names a number.
 *
 * TiTiler always colors a COG that carries its own palette, so its raw values
 * can't be read back - but a color table of our own replaces that palette.
 * Entry i is written as the color (i + 1 as two bytes, 0, opaque), so the
 * image that comes back says which entries are there. A pixel no entry covers
 * stays transparent.
 *
 * @param {Array<{label: string, propertyValue: *}>} entries
 * @returns {string|null} JSON for TiTiler's `colormap` parameter
 */
export function entryIndexColormap(entries) {
    if (!Array.isArray(entries)) return null
    const intervals = []
    entries.forEach((entry, i) => {
        if (i + 1 > 0xffff) return
        const recorded =
            entry?.propertyValue != null && entry.propertyValue !== ''
                ? entry.propertyValue
                : entry?.label
        let range = parseRange(recorded)
        if (range == null) {
            const n = toNumber(recorded)
            if (n == null) return
            range = [n, n]
        }
        // TiTiler's intervals stop short of their upper bound; an entry's
        // includes it.
        intervals.push([
            [range[0], range[1] + 1e-6],
            [(i + 1) >> 8, (i + 1) & 0xff, 0, 255],
        ])
    })
    if (intervals.length === 0) return null
    // A later interval paints over an earlier one, and a value on a seam
    // belongs to the first entry that holds it.
    return JSON.stringify(intervals.reverse())
}

/**
 * The legend entries present in an image painted with entryIndexColormap().
 *
 * @param {{shape: Array<number>, data: object}} npy - (4, height, width) RGBA
 * @returns {Set<number>} indexes into the entries the color table was made of
 */
export function distinctEntryIndexes(npy) {
    const indexes = new Set()
    if (npy == null || !Array.isArray(npy.shape)) return indexes
    if (npy.shape.length !== 3 || npy.shape[0] < 4) return indexes
    const size = npy.shape[1] * npy.shape[2]
    for (let i = 0; i < size; i++) {
        if (npy.data[3 * size + i] === 0) continue
        const index = npy.data[i] * 256 + npy.data[size + i] - 1
        if (index >= 0) indexes.add(index)
    }
    return indexes
}

/**
 * The request that reads which legend entries of a `COG:` layer are under a
 * view, or null if the layer isn't one this can narrow.
 *
 * It is made from the layer's own tile url, which already says where the COG
 * is and which band is drawn, so the read can't disagree with the tiles. The
 * response is read with distinctEntryIndexes().
 *
 * @param {string} tileUrl - the layer's TiTiler tile template,
 *   `.../titiler/cog/tiles/{tms}/{z}/{x}/{y}.webp?url=...`
 * @param {object} layerObj
 * @param {{west: number, south: number, east: number, north: number}} bounds
 * @param {Array<{label: string, propertyValue: *}>} entries - the legend's
 * @param {object} [options]
 * @param {{x: number, y: number}} [options.mapSize]
 * @returns {string|null}
 */
export function cogViewEntriesUrl(
    tileUrl,
    layerObj,
    bounds,
    entries,
    options = {}
) {
    if (typeof tileUrl !== 'string') return null
    if (layerObj?.cogTransform === true) return null
    const expression = layerObj?.currentCogExpression || layerObj?.cogExpression
    if (typeof expression === 'string' && expression.trim() !== '') return null

    const match = tileUrl.match(
        /^(.*\/cog)\/tiles\/[^/?]+\/\{z\}\/\{x\}\/\{y\}(?:\.[a-z0-9]+)?\?(.*)$/i
    )
    if (match == null) return null
    const box = clampBounds(bounds)
    if (box == null) return null
    const colormap = entryIndexColormap(entries)
    if (colormap == null) return null

    // The tiles' own resampling may blend classes; a read must not.
    const query = match[2]
        .split('&')
        .filter(
            (param) =>
                param !== '' &&
                !/^(resampling|reproject|colormap|colormap_name|rescale)=/.test(
                    param
                )
        )
    if (!query.some((param) => param.startsWith('url='))) return null
    query.push(
        'resampling=nearest',
        'reproject=nearest',
        `colormap=${encodeURIComponent(colormap)}`
    )

    const { width, height } = sampleSize(options.mapSize)
    const round = (n) => Math.round(n * 1e6) / 1e6
    return `${match[1]}/bbox/${round(box.west)},${round(box.south)},${round(
        box.east
    )},${round(box.north)}/${width}x${height}.npy?${query.join('&')}`
}

const LegendInView = {
    SAMPLE_SIZE,
    parseNpy,
    distinctValues,
    entriesInView,
    distinctPropertyValues,
    sampleSize,
    viewValuesUrl,
    entryIndexColormap,
    distinctEntryIndexes,
    cogViewEntriesUrl,
}

export default LegendInView
