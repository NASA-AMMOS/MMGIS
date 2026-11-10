/**
 * VectorTile layer type — where a layer's tiles come from, and how their
 * features read. Shared by the map and the globe, so both fetch the same tiles
 * and style the same values.
 *
 * @module VectorTile/source
 */

/**
 * The tile URL template of a `geodatasets:<name>` layer, served as MVT by the
 * geodatasets API; null for any other URL, which the layer's own URL resolves.
 *
 * @param {string} url  The layer's configured URL
 * @returns {string|null}
 */
export function geodatasetTileUrl(url) {
    const urlSplit = url.split(':')
    if (urlSplit[0].toLowerCase() !== 'geodatasets' || urlSplit[1] == null)
        return null
    return (
        `${window.mmgisglobal.ROOT_PATH || ''}/api/geodatasets/get?layer=${
            urlSplit[1]
        }` + '&type=mvt&x={x}&y={y}&z={z}'
    )
}

/**
 * A tile feature's properties. Some sources serialize them all into a single
 * `properties` string; those are unpacked. Any other text in a `properties`
 * field is an ordinary value, and the properties are kept as they are.
 *
 * @param {object} properties
 * @returns {object}
 */
export function featureProperties(properties) {
    const serialized = properties?.properties
    if (typeof serialized !== 'string' || !serialized.trimStart().startsWith('{'))
        return properties
    try {
        const parsed = JSON.parse(serialized)
        return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : properties
    } catch (err) {
        return properties
    }
}
