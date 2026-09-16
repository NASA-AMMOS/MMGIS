/**
 * Bearing attachment — turns the host layer's markers to face a direction read
 * from each feature.
 *
 * It is the one built-in attachment that is not a sublayer: there is nothing to
 * add to the map, only a change to how its host draws its own point features.
 * Core asks every attachment declaring `decorateFeature` as it builds each
 * marker and merges the answers, so this plugin owns the whole of "what does a
 * bearing do" without core knowing a bearing exists.
 */

import F_ from '@basics/Formulae_/Formulae_'
import Map_ from '@basics/Map_/Map_'

/**
 * The rotation to draw this feature's marker with, in screen degrees.
 *
 * Two rotations are involved: the feature's own heading, and the angle between
 * north and screen-up at the marker's position (they differ away from the
 * projection's centre), which is measured by projecting one pixel down from the
 * marker and taking the bearing back.
 *
 * @param {Object} ctx  { layerObj, feature, latlong, config }
 * @returns {{yaw: number, shape?: string, color?: string}|undefined}
 */
function decorateFeature(ctx = {}) {
    const config = ctx.config
    if (config == null) return
    if (config.enabled !== true && config.enabled != null) return
    if (ctx.latlong == null || Map_.map == null) return

    const unit = config.angleUnit || 'deg'
    const bearingProp = config.angleProp || false

    let yaw = 0
    let shape
    if (bearingProp !== false) {
        yaw = parseFloat(F_.getIn(ctx.feature?.properties, bearingProp))
        if (unit === 'rad') yaw = yaw * (180 / Math.PI)
        // A bearing is meaningless on a symbol with no direction, so unless the
        // layer says it has its own directional shape, it gets one.
        if (config.useCustomShape !== true) shape = 'directional-circle'
    }

    const markerXY = Map_.map.latLngToLayerPoint(ctx.latlong)
    const markerLatLong = Map_.map.containerPointToLatLng([
        markerXY.x,
        markerXY.y,
    ])
    const pixelBelowMarkerLatLong = Map_.map.containerPointToLatLng([
        markerXY.x,
        markerXY.y + 1,
    ])
    yaw -= F_.bearingBetweenTwoLatLngs(
        pixelBelowMarkerLatLong.lat,
        pixelBelowMarkerLatLong.lng,
        markerLatLong.lat,
        markerLatLong.lng
    )
    yaw = -((360 - yaw) % 360)

    return { yaw, shape, color: config.color }
}

/**
 * The globe draws bearings itself given the layer's bearing settings, so all
 * this contributes is whether they apply at all.
 */
function globeStyle(ctx = {}) {
    const config = ctx.config
    if (config == null) return
    if (config.enabled !== true && config.enabled != null) return
    return { bearing: config }
}

export default {
    decorateFeature,
    globeStyle,
}
