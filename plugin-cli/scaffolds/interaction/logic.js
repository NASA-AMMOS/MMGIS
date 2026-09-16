/**
 * __Name__'s decisions, with nothing imported from `src/essence`.
 *
 * This split is what makes the interaction testable: the handler beside it will
 * eventually import `L_`/`F_`/Leaflet, and a module that does cannot be imported
 * in a Node unit test at all. So the handler stays a thin adapter — read `ctx`,
 * call in here, act on the answer — and this is what `tests/` covers.
 */

/**
 * @param {object|null} feature  The clicked GeoJSON feature, if there was one.
 * @param {object|null} config   This interaction's settings on the layer.
 * @returns {{label: string}|null} null when there is nothing to do.
 */
export function decide(feature, config) {
    if (feature == null) return null
    // `config` is null until an admin fills the form in, and partial after they
    // fill in some of it, so defaults belong here rather than in the manifest.
    const { property = 'name' } = config || {}
    const label = feature.properties?.[property]
    return label == null ? null : { label: String(label) }
}
