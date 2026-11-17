/**
 * The ids a feature carries, by kind.
 *
 * A geodataset's GET endpoint writes the row id to `properties._.idx` and only
 * writes `properties.feature_id` when the layer asks for that column, so the
 * two are separate numberings.
 *
 * @param {object} [properties]
 * @returns {Array<string>} ids as `kind:value`, empty when it carries none
 */
export function featureIdentities(properties) {
    if (properties == null) return []
    const ids = []
    if (properties.feature_id != null) ids.push(`f:${properties.feature_id}`)
    if (properties._?.idx != null) ids.push(`i:${properties._.idx}`)
    return ids
}

/**
 * Whether two features are the same one: an id of a kind they both carry
 * agrees. An id of one kind never matches an id of the other.
 *
 * @param {object} [a]
 * @param {object} [b]
 * @returns {boolean} false when they share no kind of id
 */
export function sameFeature(a, b) {
    const bIds = featureIdentities(b)
    return featureIdentities(a).some((id) => bIds.includes(id))
}
