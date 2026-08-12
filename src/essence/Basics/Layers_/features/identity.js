/**
 * What names a feature across the map, the globe and a search result.
 *
 * A geodataset's GET endpoint writes the row id to `properties._.idx` and only
 * writes `properties.feature_id` when the layer asks for that column, so the
 * two are separate numberings: the kind is part of the identity, and an id of
 * one kind never matches an id of the other.
 *
 * @param {object} [properties]
 * @returns {string|null} null when the feature carries no id
 */
export function featureIdentity(properties) {
    if (properties == null) return null
    if (properties.feature_id != null) return `f:${properties.feature_id}`
    if (properties._?.idx != null) return `i:${properties._.idx}`
    return null
}

export default featureIdentity
