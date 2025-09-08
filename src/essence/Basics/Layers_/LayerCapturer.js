import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import calls from '../../../pre/calls'
import TimeControl from '../../Ancillary/TimeControl'

// This is so that an eariler and slower dynamic geodataset request
// does not override an earlier shorter one
// Object of layerName: timestamp
const _geodatasetRequestLastTimestamp = {}
const _geodatasetRequestLastLoc = {}
const _layerRequestLastTimestamp = {}
const _layerRequestLastLoc = {}
export const captureVector = (layerObj, options, cb, dynamicCb) => {
    options = options || {}
    let layerUrl = layerObj.url
    const layerData = L_.layers.data[layerObj.name]

    // If there is no url to a JSON file but the "controlled" option is checked in the layer config,
    // create the geoJSON layer with empty GeoJSON data
    if (
        options.useEmptyGeoJSON ||
        (layerData.controlled && layerUrl.length === 0)
    ) {
        cb(F_.getBaseGeoJSON())
        return
    }

    if (options.evenIfOff !== true && !L_.layers.on[layerObj.name]) {
        cb('off')
        return
    }

    if (typeof layerUrl !== 'string' || layerUrl.length === 0) {
        cb(null)
        return
    }

    // Give time enabled layers a default start and end time to avoid errors
    const layerTimeFormat =
        layerObj.time?.format == null || layerObj.time?.format == ''
            ? d3.utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : d3.utcFormat(layerObj.time.format)

    const startTime =
        layerObj.time == null || layerObj.time.start == ''
            ? layerTimeFormat(Date.parse(TimeControl.getStartTime()))
            : layerObj.time.start
    const endTime =
        layerObj.time == null || layerObj.time.end == ''
            ? layerTimeFormat(Date.parse(TimeControl.getEndTime()))
            : layerObj.time.end

    if (typeof layerObj.time != 'undefined') {
        layerUrl = layerObj.url
            .replace(/{starttime}/g, startTime)
            .replace(/{endtime}/g, endTime)
            .replace(/{time}/g, endTime)

        if (
            TimeControl.customTimes?.times &&
            TimeControl.customTimes.times.length > 0
        ) {
            for (let i = 0; i < TimeControl.customTimes.times.length; i++) {
                layerUrl = layerUrl.replace(
                    new RegExp(`{customtime.${i}}`, 'g'),
                    TimeControl.customTimes.times[i]
                )
            }
        }
    }
    if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl

    let done = true
    let urlSplitRaw = layerObj.url.split(':')
    let urlSplit = layerObj.url.toLowerCase().split(':')

    if (layerData?.variables?.dynamicExtent === true) {
        switch (urlSplit[0]) {
            case 'geodatasets':
                // Return .on('moveend zoomend') event
                dynamicCb((e) => {
                    // Don't query if layer is off
                    if (L_.layers.on[layerObj.name] !== true) return

                    const zoom = L_.Map_.map.getZoom()

                    if (
                        zoom >= (layerData.minZoom || 0) &&
                        (zoom <= layerData.maxZoom || 100)
                    ) {
                        // Then query, delete existing and remake
                        const bounds = L_.Map_.map.getBounds()
                        const body = {
                            layer: urlSplitRaw[1],
                            type: 'geojson',
                            maxy: bounds._northEast.lat,
                            maxx: bounds._northEast.lng,
                            miny: bounds._southWest.lat,
                            minx: bounds._southWest.lng,
                            crsCode: mmgisglobal.customCRS.code.replace(
                                'EPSG:',
                                ''
                            ),
                            zoom: zoom,
                            noDuplicates:
                                layerData?.variables?.noDuplicates === true,
                            _source:
                                layerData?.variables
                                    ?.getFeaturePropertiesOnClick === true
                                    ? ['group_id', 'feature_id']
                                          .concat(L_.getDynamicProps(layerData))
                                          .filter(Boolean)
                                    : null,
                        }

                        if (layerData.time?.enabled === true && layerData.time?.type === 'requery') {
                            body.starttime = layerData.time.start
                            body.startProp = layerData.time.startProp
                            body.endtime = layerData.time.end
                            body.endProp = layerData.time.endProp

                            if (e.hasOwnProperty('endTime')) {
                                // Then this function was being called from timeChange
                                body.starttime = e.startTime
                                body.endtime = e.endTime
                            }
                        }

                        // filters
                        if (layerData._filterEncoded?.filters)
                            body.filters = layerData._filterEncoded.filters
                        if (layerData._filterEncoded?.spatialFilter)
                            body.spatialFilter =
                                layerData._filterEncoded.spatialFilter

                        const dateNow = new Date().getTime()

                        _geodatasetRequestLastTimestamp[layerObj.name] =
                            Math.max(
                                _geodatasetRequestLastTimestamp[
                                    layerObj.name
                                ] || 0,
                                dateNow
                            )

                        layerData._lastGeodatasetRequestBody = body

                        calls.api(
                            'geodatasets_get',
                            body,
                            (data) => {
                                const lastLoc =
                                    _geodatasetRequestLastLoc[layerObj.name]
                                const nowLoc = L_.Map_.map.getCenter()

                                if (
                                    _geodatasetRequestLastTimestamp[
                                        layerObj.name
                                    ] == dateNow &&
                                    (lastLoc == null ||
                                        layerData?.variables
                                            ?.dynamicExtentMoveThreshold ==
                                            null ||
                                        layerData?.variables
                                            ?.dynamicExtentMoveThreshold ===
                                            '' ||
                                        layerData._ignoreDynamicExtentMoveThreshold ===
                                            true ||
                                        F_.lngLatDistBetween(
                                            lastLoc.lng,
                                            lastLoc.lat,
                                            nowLoc.lng,
                                            nowLoc.lat
                                        ) >
                                            parseFloat(
                                                layerData?.variables
                                                    ?.dynamicExtentMoveThreshold
                                            ) /
                                                (layerData?.variables
                                                    ?.dynamicExtentMoveThreshold &&
                                                layerData?.variables?.dynamicExtentMoveThreshold.indexOf(
                                                    '/z'
                                                ) > -1
                                                    ? Math.pow(
                                                          2,
                                                          L_.Map_.map.getZoom()
                                                      )
                                                    : 1))
                                ) {
                                    layerData._ignoreDynamicExtentMoveThreshold = false
                                    L_.clearVectorLayer(layerObj.name)
                                    L_.updateVectorLayer(
                                        layerObj.name,
                                        data,
                                        null,
                                        layerData._stopLoops
                                    )
                                    _geodatasetRequestLastLoc[layerObj.name] =
                                        nowLoc

                                    if (L_?._timeLayerReloadFinishSubscriptions)
                                        Object.keys(
                                            L_._timeLayerReloadFinishSubscriptions
                                        ).forEach((k) => {
                                            L_._timeLayerReloadFinishSubscriptions[
                                                k
                                            ]()
                                        })
                                }
                            },
                            (data) => {
                                console.warn(
                                    'ERROR: ' +
                                        data?.status +
                                        ' in geodatasets_get:' +
                                        layerObj.display_name +
                                        ' /// ' +
                                        data?.message
                                )
                            }
                        )
                    } else {
                        // Just delete existing
                        L_.clearVectorLayer(layerObj.name)
                    }
                })
                cb({ type: 'FeatureCollection', features: [] }, true)
                break
            case 'api':
                break
            default:
                // Return .on('moveend zoomend') event
                dynamicCb((e) => {
                    // Don't query if layer is off
                    if (L_.layers.on[layerObj.name] !== true) return

                    const zoom = L_.Map_.map.getZoom()

                    if (
                        zoom >= (layerData.minZoom || 0) &&
                        (zoom <= layerData.maxZoom || 100)
                    ) {
                        // Then query, delete existing and remake
                        const bounds = L_.Map_.map.getBounds()
                        const body = {
                            type: 'geojson',
                            maxy: bounds._northEast.lat,
                            maxx: bounds._northEast.lng,
                            miny: bounds._southWest.lat,
                            minx: bounds._southWest.lng,
                            crsCode: mmgisglobal.customCRS.code.replace(
                                'EPSG:',
                                ''
                            ),
                            zoom: zoom,
                        }

                        if (layerData.time?.enabled === true && layerData.time?.type === 'requery') {
                            body.starttime = layerData.time.start
                            body.startProp = layerData.time.startProp
                            body.endtime = layerData.time.end
                            body.endProp = layerData.time.endProp

                            if (e.hasOwnProperty('endTime')) {
                                // Then this function was being called from timeChange
                                body.starttime = e.startTime
                                body.endtime = e.endTime
                            }
                        }

                        // filters
                        if (layerData._filterEncoded?.filters)
                            body.filters = layerData._filterEncoded.filters
                        if (layerData._filterEncoded?.spatialFilter)
                            body.spatialFilter =
                                layerData._filterEncoded.spatialFilter

                        const dateNow = new Date().getTime()

                        _layerRequestLastTimestamp[layerObj.name] = Math.max(
                            _layerRequestLastTimestamp[layerObj.name] || 0,
                            dateNow
                        )

                        let dynamicLayerUrl = layerObj.url
                            .replace(/{starttime}/g, body.starttime)
                            .replace(/{endtime}/g, body.endtime)
                            .replace(/{time}/g, body.endtime)
                            .replace(/{startprop}/g, body.startProp)
                            .replace(/{endprop}/g, body.endProp)
                            .replace(/{crscode}/g, body.crsCode)
                            .replace(/{zoom}/g, body.zoom)
                            .replace(/{minx}/g, body.minx)
                            .replace(/{miny}/g, body.miny)
                            .replace(/{maxx}/g, body.maxx)
                            .replace(/{maxy}/g, body.maxy)

                        if (
                            TimeControl.customTimes?.times &&
                            TimeControl.customTimes.times.length > 0
                        ) {
                            for (
                                let i = 0;
                                i < TimeControl.customTimes.times.length;
                                i++
                            ) {
                                dynamicLayerUrl = dynamicLayerUrl.replace(
                                    new RegExp(`{customtime.${i}}`, 'g'),
                                    TimeControl.customTimes.times[i]
                                )
                            }
                        }

                        if (!F_.isUrlAbsolute(dynamicLayerUrl))
                            dynamicLayerUrl = L_.missionPath + dynamicLayerUrl

                        $.getJSON(dynamicLayerUrl, function (data) {
                            if (data.hasOwnProperty('Features')) {
                                data.features = data.Features
                                delete data.Features
                            }

                            data = F_.parseIntoGeoJSON(data)

                            const lastLoc = _layerRequestLastLoc[layerObj.name]
                            const nowLoc = L_.Map_.map.getCenter()

                            if (
                                _layerRequestLastTimestamp[layerObj.name] ==
                                    dateNow &&
                                (lastLoc == null ||
                                    layerData?.variables
                                        ?.dynamicExtentMoveThreshold == null ||
                                    layerData._ignoreDynamicExtentMoveThreshold ===
                                        true ||
                                    F_.lngLatDistBetween(
                                        lastLoc.lng,
                                        lastLoc.lat,
                                        nowLoc.lng,
                                        nowLoc.lat
                                    ) >
                                        parseFloat(
                                            layerData?.variables
                                                ?.dynamicExtentMoveThreshold
                                        ) /
                                            (layerData?.variables
                                                ?.dynamicExtentMoveThreshold &&
                                            layerData?.variables?.dynamicExtentMoveThreshold.indexOf(
                                                '/z'
                                            ) > -1
                                                ? Math.pow(
                                                      2,
                                                      L_.Map_.map.getZoom()
                                                  )
                                                : 1))
                            ) {
                                layerData._ignoreDynamicExtentMoveThreshold = false
                                L_.clearVectorLayer(layerObj.name)
                                L_.updateVectorLayer(
                                    layerObj.name,
                                    data,
                                    null,
                                    layerData._stopLoops
                                )
                                _layerRequestLastLoc[layerObj.name] = nowLoc

                                if (L_?._timeLayerReloadFinishSubscriptions)
                                    Object.keys(
                                        L_._timeLayerReloadFinishSubscriptions
                                    ).forEach((k) => {
                                        L_._timeLayerReloadFinishSubscriptions[
                                            k
                                        ]()
                                    })
                            }
                        }).fail(function (jqXHR, textStatus, errorThrown) {
                            //Tell the console council about what happened
                            console.warn(
                                'ERROR! ' +
                                    textStatus +
                                    ' in ' +
                                    layerUrl +
                                    ' /// ' +
                                    errorThrown
                            )
                        })
                    } else {
                        // Just delete existing
                        L_.clearVectorLayer(layerObj.name)
                    }
                })
                cb({ type: 'FeatureCollection', features: [] }, true)
        }
    } else {
        switch (urlSplit[0]) {
            case 'geodatasets':
                const body = {
                    layer: urlSplitRaw[1],
                    type: 'geojson',
                }
                if (layerData.time?.enabled === true && layerData.time?.type === 'requery') {
                    body.starttime = layerData.time.start
                    body.endtime = layerData.time.end
                }
                body.noDuplicates = layerData?.variables?.noDuplicates === true
                body._source =
                    layerData?.variables?.getFeaturePropertiesOnClick === true
                        ? ['group_id', 'feature_id']
                              .concat(L_.getDynamicProps(layerData))
                              .filter(Boolean)
                        : null

                // filters
                if (layerData._filterEncoded?.filters)
                    body.filters = layerData._filterEncoded.filters
                if (layerData._filterEncoded?.spatialFilter)
                    body.spatialFilter = layerData._filterEncoded.spatialFilter

                layerData._lastGeodatasetRequestBody = body
                calls.api(
                    'geodatasets_get',
                    body,
                    (data) => {
                        cb(data)
                    },
                    (data) => {
                        console.warn(
                            'ERROR: ' +
                                data.status +
                                ' in ' +
                                layerUrl +
                                ' /// ' +
                                data.message
                        )
                        cb(null)
                    }
                )
                break
            case 'api':
                switch (urlSplit[1]) {
                    case 'publishedall':
                        calls.api(
                            'files_getfile',
                            {
                                quick_published: true,
                            },
                            function (data) {
                                data.body.features.sort((a, b) => {
                                    let intentOrder = [
                                        'polygon',
                                        'roi',
                                        'campaign',
                                        'campsite',
                                        'all',
                                        'line',
                                        'trail',
                                        'point',
                                        'signpost',
                                        'arrow',
                                        'text',
                                        'note',
                                        'master',
                                    ]
                                    let ai = intentOrder.indexOf(
                                        a.properties._.intent
                                    )
                                    let bi = intentOrder.indexOf(
                                        b.properties._.intent
                                    )
                                    return ai - bi
                                })
                                cb(data.body)
                            },
                            function (data) {
                                console.warn(
                                    'ERROR! ' +
                                        data.status +
                                        ' in ' +
                                        layerUrl +
                                        ' /// ' +
                                        data.message
                                )
                                cb(null)
                            }
                        )
                        break
                    case 'published':
                        calls.api(
                            'files_getfile',
                            {
                                intent: urlSplit[2],
                                quick_published: true,
                            },
                            function (data) {
                                cb(data.body)
                            },
                            function (data) {
                                console.warn(
                                    'ERROR! ' +
                                        data.status +
                                        ' in ' +
                                        layerUrl +
                                        ' /// ' +
                                        data.message
                                )
                                cb(null)
                            }
                        )
                        break
                    case 'tacticaltargets':
                        calls.api(
                            'tactical_targets',
                            {},
                            function (data) {
                                cb(data.body)
                            },
                            function (data) {
                                if (data) {
                                    console.warn(
                                        'ERROR! ' +
                                            data.status +
                                            ' in ' +
                                            layerUrl +
                                            ' /// ' +
                                            data.message
                                    )
                                }
                                cb(null)
                            }
                        )
                        break
                    case 'drawn':
                        calls.api(
                            'files_getfile',
                            {
                                id: urlSplit[2],
                            },
                            function (data) {
                                cb(data.body.geojson)
                            },
                            function (data) {
                                if (data) {
                                    console.warn(
                                        'ERROR! ' +
                                            data.status +
                                            ' in ' +
                                            layerUrl +
                                            ' /// ' +
                                            data.message
                                    )
                                }
                                cb(null)
                            }
                        )
                        break
                    default:
                        console.warn(
                            `Unknown layer URL ${layerUrl} in layer ${layerObj.name}`
                        )
                        cb(null)
                        break
                }
                break
            default:
                done = false
        }
    }

    if (!done) {
        $.getJSON(layerUrl, (data) => {
            if (data.hasOwnProperty('Features')) {
                data.features = data.Features
                delete data.Features
            }
            cb(data)
        }).fail((jqXHR, textStatus, errorThrown) => {
            //Tell the console council about what happened
            console.warn(
                'ERROR! ' +
                    textStatus +
                    ' in ' +
                    layerUrl +
                    ' /// ' +
                    errorThrown
            )
            cb(null)
        })
    }
}
