/**
 * stacClassLegend — a legend read from a STAC collection's classes.
 *
 * A classified raster (land cover, geologic units, ...) served from a
 * `stac-collection:` url can say what each pixel value means in its collection
 * document, with the STAC classification extension's `classification:classes`.
 * That list is the layer's legend, so nobody has to retype it as a legend.csv.
 *
 * Kept free of the map and the DOM so it can be unit tested.
 *
 * @module stacClassLegend
 */

import { parseExternalStacUrl } from '../LayerUtils.js'

const CLASSES = 'classification:classes'

/** The asset key MMGIS requests from TiTiler-pgSTAC (`assets=asset`). */
const DEFAULT_ASSET = 'asset'

/** Collection url → Promise of its classes, so layers sharing one ask once. */
const requests = new Map()

/**
 * True if a legend is configured for the layer - a file, or entries written
 * into its variables. A configured legend is the layer's legend; one derived
 * from how it is drawn only stands in when there is none.
 *
 * @param {object} layerObj
 * @returns {boolean}
 */
export function hasConfiguredLegend(layerObj) {
    if (layerObj == null) return false
    if (layerObj.legend != null && layerObj.legend !== '') return true
    const configured = layerObj.variables?.legend
    return Array.isArray(configured) ? configured.length > 0 : configured != null
}

/**
 * True if this layer's legend should come from its STAC collection: it is
 * served from one, nothing else is configured as its legend, and it is not
 * rescaled over a colormap (which is a scale, not classes).
 *
 * @param {object} layerObj
 * @returns {boolean}
 */
export function wantsStacClassLegend(layerObj) {
    if (layerObj == null || typeof layerObj.url !== 'string') return false
    if (!layerObj.url.toLowerCase().startsWith('stac-collection:')) return false
    if (layerObj.cogTransform === true) return false
    return !hasConfiguredLegend(layerObj)
}

/**
 * Where a `stac-collection:` layer's collection document is.
 *
 * A local collection is behind this MMGIS's `/stac` proxy. An external one is
 * given by its `/titilerpgstac` url, and its `/stac` sits beside that.
 *
 * @param {string} layerUrl - `stac-collection:name?params` or
 *   `stac-collection:https://host/titilerpgstac/collections/name`
 * @param {{origin: string, pathname: string}} [location] - defaults to window.location
 * @returns {string|null}
 */
export function stacCollectionUrl(layerUrl, location = null) {
    if (typeof layerUrl !== 'string') return null
    if (!layerUrl.toLowerCase().startsWith('stac-collection:')) return null
    const afterColon = layerUrl.substring(layerUrl.indexOf(':') + 1)

    if (afterColon.includes('://')) {
        const parsed = parseExternalStacUrl(afterColon)
        if (parsed == null) return null
        const base = parsed.baseUrl.replace(/\/titilerpgstac$/, '/stac')
        return `${base}/collections/${encodeURIComponent(parsed.collectionName)}`
    }

    const collectionName = afterColon.split('?')[0].trim()
    if (collectionName === '') return null
    const loc =
        location || (typeof window !== 'undefined' ? window.location : null)
    if (loc == null) return null
    const pathname = (loc.pathname || '').replace(/\/$/g, '')
    return `${loc.origin}${pathname}/stac/collections/${encodeURIComponent(
        collectionName
    )}`
}

function usable(classes) {
    return Array.isArray(classes) && classes.length > 0 ? classes : null
}

// An asset's classes: its band's if the band lists them, else its own.
function assetClasses(asset, band) {
    if (asset == null || typeof asset !== 'object') return null
    for (const key of ['bands', 'raster:bands']) {
        const bands = asset[key]
        if (!Array.isArray(bands)) continue
        const found = usable(bands[band - 1]?.[CLASSES])
        if (found) return found
    }
    return usable(asset[CLASSES])
}

/**
 * The classes a collection document lists for a layer, or null.
 *
 * Looked for where the classification extension allows them, nearest to the
 * rendered band first: the asset's band, the asset, any other asset, then the
 * collection's summaries.
 *
 * @param {object} collection - a STAC collection document
 * @param {number} [band] - 1-based band the layer renders
 * @param {string} [assetKey]
 * @returns {Array<object>|null}
 */
export function findClasses(collection, band = 1, assetKey = DEFAULT_ASSET) {
    if (collection == null || typeof collection !== 'object') return null
    const itemAssets = collection.item_assets
    if (itemAssets != null && typeof itemAssets === 'object') {
        const own = assetClasses(itemAssets[assetKey], band)
        if (own) return own
        for (const key of Object.keys(itemAssets)) {
            const other = assetClasses(itemAssets[key], band)
            if (other) return other
        }
    }
    return usable(collection.summaries?.[CLASSES])
}

// A discrete GDAL color table, { "value": [r, g, b, a] }, or null. An interval
// table has no single color per class value.
function discreteColortable(cogColormapJson) {
    let table = cogColormapJson
    if (typeof table === 'string') {
        try {
            table = JSON.parse(table)
        } catch (e) {
            return null
        }
    }
    if (table == null || typeof table !== 'object' || Array.isArray(table))
        return null
    return table
}

/**
 * Legend entries for a list of classes, in the Legend tool's format, or null
 * if none can be shown.
 *
 * A class is colored the way it is drawn: by the layer's color table when it
 * has one, else by the class's `color_hint`. A class the table makes fully
 * transparent, and one marked `nodata`, is left out. `propertyValue` records
 * the pixel value, which is what a reading off the map is matched on.
 *
 * @param {Array<object>} classes - `classification:classes`
 * @param {object|string} [cogColormapJson] - the layer's GDAL color table
 * @returns {Array<object>|null}
 */
export function classesToLegend(classes, cogColormapJson = null) {
    if (!Array.isArray(classes)) return null
    const table = discreteColortable(cogColormapJson)

    const entries = []
    classes.forEach((c) => {
        if (c == null || typeof c !== 'object') return
        if (c.nodata === true) return
        if (typeof c.value !== 'number' || !isFinite(c.value)) return

        let color = null
        const rgba = table?.[String(c.value)]
        if (Array.isArray(rgba)) {
            const alpha = rgba[3] == null ? 255 : rgba[3]
            if (alpha <= 0) return
            color = `rgba(${rgba[0] || 0},${rgba[1] || 0},${rgba[2] || 0},${
                alpha / 255
            })`
        } else if (
            typeof c.color_hint === 'string' &&
            /^[0-9a-f]{6}$/i.test(c.color_hint)
        ) {
            color = `#${c.color_hint}`
        }

        const label = [c.title, c.description, c.name].find(
            (text) => typeof text === 'string' && text.trim() !== ''
        )
        entries.push({
            color: color || 'transparent',
            // An uncolored class still gets an outlined swatch.
            strokecolor: color ? null : 'var(--color-a4)',
            shape: 'square',
            value: label != null ? label.trim() : String(c.value),
            propertyValue: c.value,
        })
    })
    return entries.length > 0 ? entries : null
}

/**
 * Fetch the classes of a layer's STAC collection. Resolves to null when the
 * layer has no collection, the collection can't be read, or it lists none - a
 * layer without classes is ordinary, so none of those is an error.
 *
 * @param {object} layerObj
 * @param {object} [options]
 * @param {function} [options.fetch] - defaults to the global fetch
 * @param {object} [options.location] - defaults to window.location
 * @returns {Promise<Array<object>|null>}
 */
export function loadStacClasses(layerObj, options = {}) {
    const url = stacCollectionUrl(layerObj?.url, options.location)
    const doFetch =
        options.fetch || (typeof fetch === 'function' ? fetch : null)
    if (url == null || doFetch == null) return Promise.resolve(null)

    const band = Array.isArray(layerObj.cogBands)
        ? parseInt(layerObj.cogBands.find((b) => b != null), 10) || 1
        : 1

    if (!requests.has(url)) {
        requests.set(
            url,
            Promise.resolve()
                .then(() => doFetch(url))
                .then((response) => (response.ok ? response.json() : null))
                .catch(() => null)
        )
    }
    return requests.get(url).then((collection) => findClasses(collection, band))
}

/** Forget fetched collections (for tests). */
export function clearStacClassCache() {
    requests.clear()
}

const StacClassLegend = {
    hasConfiguredLegend,
    wantsStacClassLegend,
    stacCollectionUrl,
    findClasses,
    classesToLegend,
    loadStacClasses,
    clearStacClassCache,
}

export default StacClassLegend
