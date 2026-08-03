import { utcFormat } from 'd3-time-format'

import L_ from '@basics/Layers_/Layers_'

/**
 * Tile layer type — time surface.
 *
 * A tile service takes the time window as request parameters, so a time change
 * never needs the layer rebuilt: the parameters are stamped onto the live layer
 * and the next tile request carries them.
 *
 * @module Tile/time
 */

/** `time.format` — how this type writes a time into a request. */
export function format(date, layerObj) {
    const formatter =
        layerObj?.time?.format == null || layerObj.time.format === ''
            ? utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : utcFormat(layerObj.time.format)
    return formatter(date)
}

/**
 * `time.applyTimeParams` — stamp the current window onto the live layer without
 * remaking it.
 */
export function applyTimeParams(layerObj) {
    const layer = L_.layers.layer[layerObj.name]
    if (layer == null || layerObj.time == null) return

    layer.options.time = format(Date.parse(layerObj.time.end), layerObj)
    layer.options.starttime = format(Date.parse(layerObj.time.start), layerObj)
    layer.options.endtime = format(Date.parse(layerObj.time.end), layerObj)
}

export default {
    format,
    applyTimeParams,
}
