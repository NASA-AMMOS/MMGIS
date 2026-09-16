/**
 * dynamicExtent — core's dynamic-extent policy, kept out of any layer type.
 *
 * Acquiring data per viewport is machinery every vector-ish type shares: which
 * view to use, whether the view moved far enough to be worth a redraw, and
 * whether a response that just landed is still the newest one. A layer type
 * decides only how to fetch (`source.fetch`, see LayerCapturer), so these live
 * here as pure functions rather than in each type's renderer.
 *
 * @module dynamicExtent
 */

import F_ from '../../Formulae_/Formulae_'

/**
 * True when a dynamic-extent response is still the newest request for the layer
 * AND the view moved enough to be worth redrawing. Records the accepted
 * location on `locs` so the next response has something to compare against.
 *
 * @param {object} layerObj   The layer's config object (needs `name`).
 * @param {object} layerData  L_.layers.data entry (thresholds, override flag).
 * @param {object} view       The resolved view: center/zoom/tilt.
 * @param {number} dateNow    Timestamp this request was issued with.
 * @param {Object<string,number>} stamps  layerName → newest issued timestamp.
 * @param {Object<string,object>} locs    layerName → last accepted location.
 * @returns {boolean}
 */
export function acceptsDynamicResult(
    layerObj,
    layerData,
    view,
    dateNow,
    stamps,
    locs
) {
    if (stamps[layerObj.name] !== dateNow) return false

    const lastLoc = locs[layerObj.name]
    const nowLoc = {
        lng: view.center.lng,
        lat: view.center.lat,
        zoom: view.zoom,
        tilt: view.tilt,
    }
    const threshold = layerData?.variables?.dynamicExtentMoveThreshold
    // A threshold suffixed '/z' is in degrees at z0, so it shrinks with zoom.
    const perZoom =
        String(threshold).indexOf('/z') > -1 ? Math.pow(2, view.zoom) : 1

    const moved =
        lastLoc == null ||
        threshold == null ||
        threshold === '' ||
        layerData?._ignoreDynamicExtentMoveThreshold === true ||
        Math.round(lastLoc.zoom * 10) !== Math.round(nowLoc.zoom * 10) ||
        lastLoc.tilt !== nowLoc.tilt ||
        F_.lngLatDistBetween(
            lastLoc.lng,
            lastLoc.lat,
            nowLoc.lng,
            nowLoc.lat
        ) > parseFloat(threshold) / perZoom

    if (!moved) return false
    locs[layerObj.name] = nowLoc
    return true
}

/**
 * The `ctx` handed to a layer type's `source.fetch`: everything core knows about
 * WHAT to acquire, so the plugin decides only how. See the `source` surface in
 * plugins/core/layertypes/README.md for the field table.
 *
 * @param {object} layerData  L_.layers.data entry.
 * @param {string} url        The layer's url with time placeholders resolved.
 * @param {object|null} view  Resolved view for a dynamic-extent request, else null.
 * @param {'make'|'view'|'time'} trigger  Why this acquisition is happening.
 */
export function sourceCtx(layerData, url, view, trigger) {
    return {
        url,
        trigger,
        view: view || null,
        dynamicExtent: view != null,
        crsCode:
            typeof mmgisglobal !== 'undefined'
                ? mmgisglobal.customCRS?.code?.replace('EPSG:', '')
                : undefined,
        time:
            layerData?.time?.enabled === true
                ? {
                      start: layerData.time.start,
                      end: layerData.time.end,
                      startProp: layerData.time.startProp,
                      endProp: layerData.time.endProp,
                      requery: layerData.time.type === 'requery',
                  }
                : null,
        filters: layerData?._filterEncoded?.filters || null,
        spatialFilter: layerData?._filterEncoded?.spatialFilter || null,
    }
}

export default { acceptsDynamicResult, sourceCtx }
