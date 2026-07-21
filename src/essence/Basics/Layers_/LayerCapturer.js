import $ from 'jquery'
import { utcFormat } from 'd3-time-format'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import calls from '../../../pre/calls'
import TimeControl from '../TimeControl_/TimeControl'

function isKmlUrl(url) {
    try {
        const pathname = new URL(url, window.location.origin).pathname
        return pathname.toLowerCase().endsWith('.kml')
    } catch (e) {
        return url.toLowerCase().endsWith('.kml')
    }
}

function fetchKmlAsGeoJSON(url, successCb, failCb) {
    $.ajax({
        url: url,
        dataType: 'xml',
        success: function (xmlDoc) {
            try {
                const geojson = kmlToGeoJSON(xmlDoc)
                if (geojson.hasOwnProperty('Features')) {
                    geojson.features = geojson.Features
                    delete geojson.Features
                }
                successCb(geojson)
            } catch (e) {
                console.warn(
                    'ERROR! Failed to parse KML from ' +
                        url +
                        ' /// ' +
                        e.message
                )
                failCb(null, 'parseerror', e.message)
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            failCb(jqXHR, textStatus, errorThrown)
        },
    })
}

// This is so that an eariler and slower dynamic geodataset request
// does not override an earlier shorter one
// Object of layerName: timestamp
const _geodatasetRequestLastTimestamp = {}
const _geodatasetRequestLastLoc = {}
const _layerRequestLastTimestamp = {}
const _layerRequestLastLoc = {}

// Returns true when the 2D Leaflet map is actually visible and has a
// non-degenerate size. When the Map panel is closed the map collapses to
// 0x0 and getBounds() returns a degenerate (zero-area) extent, which would
// make dynamic-extent queries return nothing.
const _isMap2DUsable = () => {
    try {
        const size = L_.Map_?.map?.getSize?.()
        return !!size && size.x > 1 && size.y > 1
    } catch (e) {
        return false
    }
}

// Resolves which view (extent + zoom + center) a dynamic-extent query should
// use. Defaults to the 2D Leaflet map. When the callback was triggered by a
// globe move (e.fromGlobe === true) or the 2D map is not usable (its panel is
// closed), the Globe's visible extent is used instead. This lets dynamic
// extent layers populate from the Globe's own viewport — including when the
// Map panel is closed — rather than being tied solely to the 2D map.
const _resolveDynamicView = (e) => {
    const wantGlobe =
        (e && typeof e === 'object' && e.fromGlobe === true) ||
        !_isMap2DUsable()

    if (wantGlobe && L_.Globe_ && typeof L_.Globe_.getExtent === 'function') {
        const ext = L_.Globe_.getExtent()
        if (ext) {
            return {
                source: 'globe',
                zoom: ext.zoom,
                tilt: ext.tilt,
                minx: ext.minx,
                miny: ext.miny,
                maxx: ext.maxx,
                maxy: ext.maxy,
                center: { lng: ext.centerLng, lat: ext.centerLat },
            }
        }
    }

    const map = L_.Map_.map
    const bounds = map.getBounds()
    const center = map.getCenter()
    return {
        source: 'map',
        zoom: map.getZoom(),
        tilt: 0,
        minx: bounds._southWest.lng,
        miny: bounds._southWest.lat,
        maxx: bounds._northEast.lng,
        maxy: bounds._northEast.lat,
        center: { lng: center.lng, lat: center.lat },
    }
}

export const captureVector = (layerObj, options, cb, dynamicCb) => {
    options = options || {}
    // If a resolved URL was supplied by the caller (e.g.
    // TimeControl.reloadLayer already performed time placeholder
    // replacement) use that instead of reading `layerObj.url`. This lets
    // concurrent reloads execute without any caller having to mutate
    // `layerObj.url` in place — the URL template stays intact on the
    // layer for the next reload to read.
    const hasResolvedUrl =
        typeof options.resolvedUrl === 'string' &&
        options.resolvedUrl.length > 0
    let layerUrl = hasResolvedUrl ? options.resolvedUrl : layerObj.url
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
            ? utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : utcFormat(layerObj.time.format)

    const startTime =
        layerObj.time == null || layerObj.time.start == ''
            ? layerTimeFormat(Date.parse(TimeControl.getStartTime()))
            : layerObj.time.start
    const endTime =
        layerObj.time == null || layerObj.time.end == ''
            ? layerTimeFormat(Date.parse(TimeControl.getEndTime()))
            : layerObj.time.end

    // Always run time-placeholder replacement when the layer has time
    // enabled. The replacement is idempotent on an already-resolved URL
    // (regexes simply do not match), but it is required for time types
    // that bypass the replacement in TimeControl.reloadLayer — e.g.
    // `time.type === 'local'` with `endProp == null`, which still flows
    // through Map_.refreshLayer -> makeLayer -> captureVector but does
    // NOT have its placeholders pre-resolved by the caller. Reading the
    // source from `layerUrl` (the resolvedUrl or layerObj.url already
    // chosen above) keeps both code paths correct.
    if (typeof layerObj.time != 'undefined') {
        layerUrl = layerUrl
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

                    const view = _resolveDynamicView(e)
                    const zoom = view.zoom

                    if (
                        zoom >= (layerData.minZoom || 0) &&
                        (zoom <= layerData.maxZoom || 100)
                    ) {
                        // Then query, delete existing and remake
                        const bounds = {
                            _northEast: { lat: view.maxy, lng: view.maxx },
                            _southWest: { lat: view.miny, lng: view.minx },
                        }
                        // When a value filter is active, omit viewport bounds
                        // so the query returns ALL matching features regardless
                        // of their location. The filter itself constrains the
                        // result set; the spatial constraint would hide
                        // features outside the current view.
                        const hasValueFilter =
                            !!layerData._filterEncoded?.filters
                        const body = {
                            layer: urlSplitRaw[1],
                            type: 'geojson',
                            ...(hasValueFilter
                                ? {}
                                : {
                                      maxy: bounds._northEast.lat,
                                      maxx: bounds._northEast.lng,
                                      miny: bounds._southWest.lat,
                                      minx: bounds._southWest.lng,
                                  }),
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

                        if (
                            layerData.time?.enabled === true &&
                            layerData.time?.type === 'requery'
                        ) {
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
                                const nowLoc = {
                                    lng: view.center.lng,
                                    lat: view.center.lat,
                                    zoom: view.zoom,
                                    tilt: view.tilt,
                                }

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
                                        (lastLoc != null &&
                                            (lastLoc.zoom !== nowLoc.zoom ||
                                                lastLoc.tilt !==
                                                    nowLoc.tilt)) ||
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
                                                          view.zoom
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

                    const view = _resolveDynamicView(e)
                    const zoom = view.zoom

                    if (
                        zoom >= (layerData.minZoom || 0) &&
                        (zoom <= layerData.maxZoom || 100)
                    ) {
                        // Then query, delete existing and remake
                        const bounds = {
                            _northEast: { lat: view.maxy, lng: view.maxx },
                            _southWest: { lat: view.miny, lng: view.minx },
                        }
                        const hasValueFilter2 =
                            !!layerData._filterEncoded?.filters
                        const body = {
                            type: 'geojson',
                            ...(hasValueFilter2
                                ? {}
                                : {
                                      maxy: bounds._northEast.lat,
                                      maxx: bounds._northEast.lng,
                                      miny: bounds._southWest.lat,
                                      minx: bounds._southWest.lng,
                                  }),
                            crsCode: mmgisglobal.customCRS.code.replace(
                                'EPSG:',
                                ''
                            ),
                            zoom: zoom,
                        }

                        if (
                            layerData.time?.enabled === true &&
                            layerData.time?.type === 'requery'
                        ) {
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

                        const _dynamicDefaultSuccess = function (data) {
                            if (data.hasOwnProperty('Features')) {
                                data.features = data.Features
                                delete data.Features
                            }

                            data = F_.parseIntoGeoJSON(data)

                            const lastLoc = _layerRequestLastLoc[layerObj.name]
                            const nowLoc = {
                                lng: view.center.lng,
                                lat: view.center.lat,
                                zoom: view.zoom,
                                tilt: view.tilt,
                            }

                            if (
                                _layerRequestLastTimestamp[layerObj.name] ==
                                    dateNow &&
                                (lastLoc == null ||
                                    layerData?.variables
                                        ?.dynamicExtentMoveThreshold == null ||
                                    layerData._ignoreDynamicExtentMoveThreshold ===
                                        true ||
                                    (lastLoc != null &&
                                        (lastLoc.zoom !== nowLoc.zoom ||
                                            lastLoc.tilt !== nowLoc.tilt)) ||
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
                                                      view.zoom
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
                        }
                        const _dynamicDefaultFail = function (
                            jqXHR,
                            textStatus,
                            errorThrown
                        ) {
                            console.warn(
                                'ERROR! ' +
                                    textStatus +
                                    ' in ' +
                                    layerUrl +
                                    ' /// ' +
                                    errorThrown
                            )
                        }
                        if (isKmlUrl(dynamicLayerUrl)) {
                            fetchKmlAsGeoJSON(
                                dynamicLayerUrl,
                                _dynamicDefaultSuccess,
                                _dynamicDefaultFail
                            )
                        } else {
                            $.getJSON(
                                dynamicLayerUrl,
                                _dynamicDefaultSuccess
                            ).fail(_dynamicDefaultFail)
                        }
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
                if (
                    layerData.time?.enabled === true &&
                    layerData.time?.type === 'requery'
                ) {
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
        if (isKmlUrl(layerUrl)) {
            fetchKmlAsGeoJSON(
                layerUrl,
                (data) => {
                    cb(data)
                },
                (jqXHR, textStatus, errorThrown) => {
                    console.warn(
                        'ERROR! ' +
                            textStatus +
                            ' in ' +
                            layerUrl +
                            ' /// ' +
                            errorThrown
                    )
                    cb(null)
                }
            )
        } else {
            $.getJSON(layerUrl, (data) => {
                if (data.hasOwnProperty('Features')) {
                    data.features = data.Features
                    delete data.Features
                }
                cb(data)
            }).fail((jqXHR, textStatus, errorThrown) => {
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
}

export { isKmlUrl, fetchKmlAsGeoJSON }
