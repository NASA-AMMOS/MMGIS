import { utcFormat } from 'd3-time-format'

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import { parseExternalStacUrl } from '@basics/Layers_/LayerUtils'
import calls from '@pre/calls'

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

/**
 * Where this layer's availability can be asked, or null if it can't be.
 *
 * A tile layer's times come from one of two places, both of which are this
 * type's knowledge of its own url schemes rather than core's: a
 * `stac-collection:` url (local or on another MMGIS), or a templated url with a
 * `{t}` in it, whose directory listing is the answer.
 */
function _availabilitySourceOf(layerObj) {
    let layerUrl = layerObj.url || ''

    if (layerUrl.indexOf('stac-collection:') === 0) {
        const afterColon = layerUrl.substring(layerUrl.indexOf(':') + 1)
        if (!afterColon.includes('://'))
            return { stacCollection: afterColon.split('?')[0] }

        const parsed = parseExternalStacUrl(afterColon)
        if (parsed == null) {
            console.warn(
                `Failed to parse external STAC URL for availability: ${layerUrl}`
            )
            return null
        }
        return {
            stacCollection: parsed.collectionName,
            // From https://example.com/mmgis/titilerpgstac to the MMGIS itself.
            externalBaseUrl: parsed.baseUrl.replace(/\/titilerpgstac$/, ''),
        }
    }

    if (F_.isUrlAbsolute(layerUrl)) return null

    layerUrl = L_.missionPath + layerUrl
    if (layerUrl.indexOf('{t}') === -1) return null
    return { path: `/${layerUrl}`.replace(/{t}/g, '_time_') }
}

/**
 * `time.availability` — when this layer has data, for the time bar's sparkline.
 *
 * Core asks every on, time-enabled layer whose type declares
 * `capabilities.time.histogram`, and bins and draws whatever comes back; the
 * type owns knowing what to ask and whom.
 *
 * @param {object} layerObj
 * @param {{startTime: string, endTime: string, bins: number}} ctx
 * @returns {Promise<Array<{t: string, total?: number}>>}
 */
export function availability(layerObj, ctx) {
    const source = _availabilitySourceOf(layerObj)
    if (source == null) return Promise.resolve([])

    const params = {
        starttime: ctx.startTime,
        endtime: ctx.endTime,
    }
    if (source.stacCollection != null)
        params.stacCollection = source.stacCollection
    else params.path = source.path

    if (source.externalBaseUrl != null)
        return fetch(
            `${source.externalBaseUrl}/api/utils/queryTilesetTimes?` +
                `stacCollection=${encodeURIComponent(source.stacCollection)}&` +
                `starttime=${encodeURIComponent(params.starttime)}&` +
                `endtime=${encodeURIComponent(params.endtime)}`
        )
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((data) => data?.body?.times || [])

    return new Promise((resolve) => {
        calls.api(
            'query_tileset_times',
            params,
            (data) => resolve(data?.body?.times || []),
            (err) => {
                console.warn('Failed to query tileset times:', err)
                resolve([])
            }
        )
    })
}

export default {
    format,
    applyTimeParams,
    availability,
}
