import $ from 'jquery'
import { utcFormat } from 'd3-time-format'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import calls from '../../../../pre/calls'
import TimeControl from '../../TimeControl_/TimeControl'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'
import LayerInterface from '../interface/LayerInterface'
import { acceptsDynamicResult, sourceCtx } from './dynamicExtent'
import { getStatsFields } from '../render/layerDynamicStyle'

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

// A dynamic-extent requery never goes through the layer's make, so it has to
// raise the toolbar's loading spinner itself.
let _requeryCount = 0
const _requeryLoading = (layerObj) => {
    const id = `requery_${layerObj.name}_${++_requeryCount}`
    L_.setGlobalLoading(id)
    let done = false
    return () => {
        if (done) return
        done = true
        L_.setGlobalLoaded(id)
    }
}

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

// Whether the Globe panel is on screen; a globe extent from a hidden panel is
// whatever the camera was left at.
const _isGlobeUsable = () => {
    try {
        const el = document.getElementById(L_.Globe_.id)
        return !!el && el.clientWidth > 1 && el.clientHeight > 1
    } catch (e) {
        return false
    }
}

// Which engine the user last moved, so a requery that isn't itself a move (a
// time change) is measured over the view they are actually looking at.
let _lastMovedEngine = 'map'

// Resolves which view (extent + zoom + center) a dynamic-extent query should
// use. A globe move (e.fromGlobe === true) uses the Globe's extent and a 2D
// `moveend` the map's; anything else - a time change, a layer being toggled on
// - follows whichever of them moved last. The Globe is also used whenever the
// 2D map is unusable (its panel is closed), which would otherwise query a
// degenerate extent.
const _resolveDynamicView = (e) => {
    const fromGlobe = e && typeof e === 'object' && e.fromGlobe === true
    if (fromGlobe) _lastMovedEngine = 'globe'
    else if (e && typeof e === 'object' && e.type === 'moveend')
        _lastMovedEngine = 'map'

    const wantGlobe =
        fromGlobe ||
        (_lastMovedEngine === 'globe' && _isGlobeUsable()) ||
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

// Swap a dynamic-extent layer's features for freshly acquired ones.
const _commitDynamicGeoJSON = (layerObj, layerData, data) => {
    layerData._ignoreDynamicExtentMoveThreshold = false
    L_.clearVectorLayer(layerObj.name)
    L_.updateVectorLayer(layerObj.name, data, null, layerData._stopLoops)

    Object.keys(L_?._timeLayerReloadFinishSubscriptions || {}).forEach((k) => {
        L_._timeLayerReloadFinishSubscriptions[k]()
    })
}

// A layer has one live acquisition at a time: issuing the next one aborts the
// last, so a source that honours `ctx.signal` stops paging through a viewport
// the user has already left. Core discards a stale response either way.
const _sourceAborters = {}
const _abortPrevious = (layerName) => {
    try {
        _sourceAborters[layerName]?.abort()
    } catch (e) {}
    const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null
    _sourceAborters[layerName] = controller
    return controller ? controller.signal : undefined
}

// Mission-relative by default (as core resolves a layer's url), root-relative
// for an api path, absolute left alone — so a source with an endpoint in its
// own config doesn't hand-roll this off `mmgisglobal.ROOT_PATH`.
const _resolveSourceUrl = (url) => {
    if (typeof url !== 'string' || url.length === 0) return url
    if (F_.isUrlAbsolute(url)) return url
    if (url.startsWith('/')) {
        const root = window.mmgisglobal?.ROOT_PATH || ''
        return `${root.replace(/\/$/, '')}${url}`
    }
    return L_.missionPath + url
}

// Render a page that arrived after the layer already exists. updateVectorLayer
// bails while the make-lock is held (leaving the layer cleared but not
// repopulated), and an early page can land inside that window.
const _renderPage = (layerObj, layerData, geojson, attempt = 0) => {
    const held =
        (L_._layersBeingMade || {})[L_.asLayerUUID(layerObj.name)] === true
    if (held && attempt < 40) {
        setTimeout(
            () => _renderPage(layerObj, layerData, geojson, attempt + 1),
            50
        )
        return
    }
    L_.clearVectorLayer(layerObj.name)
    L_.updateVectorLayer(layerObj.name, geojson, null, layerData?._stopLoops)
}

/**
 * Acquire a layer's GeoJSON through its type's `source.fetch` instead of core's
 * url transports. Core keeps everything around the fetch: the extent, the zoom
 * gate, request staleness, the move threshold and the clear/update.
 */
const _captureFromSource = (
    layerObj,
    layerData,
    sourceModule,
    url,
    cb,
    dynamicCb,
    isRefresh,
    isDynamic,
    headless
) => {
    const fetch = (view, trigger, onData) => {
        const ctx = sourceCtx(layerData, url, view, trigger)
        // A headless acquisition must not cancel the layer's own live one, and
        // has nothing on the map to progressively paint into: its pages are
        // collected and handed over once, whole.
        ctx.signal = _abortPrevious(
            headless ? `${layerObj.name}::acquire` : layerObj.name
        )
        ctx.resolveUrl = _resolveSourceUrl
        // A type whose data is a join of its own url and a layer of the mission
        // asks for the second one rather than reaching into what it rendered.
        ctx.acquire = acquireLayer

        // A paged source draws what it has so far instead of leaving the map
        // blank until the last page: each call is everything acquired to date.
        let painted = false
        let emitted = null
        const paint = (data) => {
            const geojson = F_.parseIntoGeoJSON(data)
            if (headless) {
                emitted = geojson
                return
            }
            if (!painted) {
                painted = true
                onData(geojson)
            } else _renderPage(layerObj, layerData, geojson)
        }
        ctx.emit = (data) => {
            if (data == null || ctx.signal?.aborted) return
            paint(data)
        }

        Promise.resolve(
            LayerInterface.run(sourceModule, 'fetch', [layerObj, ctx])
        )
            .then((data) => {
                // A source that emitted its pages may return nothing; the last
                // page it painted is the result.
                if (data == null) {
                    if (headless) onData(emitted)
                    else if (!painted) onData(null)
                    return
                }
                if (headless) {
                    onData(F_.parseIntoGeoJSON(data))
                    return
                }
                paint(data)
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return
                console.warn(
                    `ERROR! source.fetch of layer type '${layerData?.type}' failed for ${layerObj.name} /// ${err?.message || err}`
                )
                if (headless || !painted) onData(null)
            })
    }

    if (!isDynamic) {
        fetch(null, isRefresh === true ? 'refresh' : 'make', cb)
        return
    }

    dynamicCb((e) => {
        if (L_.layers.on[layerObj.name] !== true) return

        const view = _resolveDynamicView(e)
        if (
            view.zoom < (layerData.minZoom || 0) ||
            view.zoom > (layerData.maxZoom ?? 100)
        ) {
            L_.clearVectorLayer(layerObj.name)
            return
        }

        const isTimeChange = e != null && e.endTime != null
        const dateNow = new Date().getTime()
        _layerRequestLastTimestamp[layerObj.name] = Math.max(
            _layerRequestLastTimestamp[layerObj.name] || 0,
            dateNow
        )

        const ctx = sourceCtx(
            layerData,
            url,
            view,
            isTimeChange ? 'time' : 'view'
        )
        if (isTimeChange && ctx.time != null) {
            ctx.time.start = e.startTime
            ctx.time.end = e.endTime
        }
        ctx.signal = _abortPrevious(layerObj.name)
        ctx.resolveUrl = _resolveSourceUrl
        ctx.acquire = acquireLayer

        // Still the newest request for this layer. A page is held to only this
        // — the move threshold is about whether a NEW view is worth redrawing,
        // and every page after the first shares the view of the one before it.
        const isCurrent = () =>
            _layerRequestLastTimestamp[layerObj.name] === dateNow

        let painted = false
        ctx.emit = (data) => {
            if (data == null || ctx.signal?.aborted || !isCurrent()) return
            painted = true
            _commitDynamicGeoJSON(layerObj, layerData, F_.parseIntoGeoJSON(data))
        }

        const loaded = _requeryLoading(layerObj)
        Promise.resolve(
            LayerInterface.run(sourceModule, 'fetch', [layerObj, ctx])
        )
            .then((data) => {
                loaded()
                if (data == null) return
                const accepted = painted
                    ? isCurrent()
                    : acceptsDynamicResult(
                          layerObj,
                          layerData,
                          view,
                          dateNow,
                          _layerRequestLastTimestamp,
                          _layerRequestLastLoc
                      )
                if (accepted)
                    _commitDynamicGeoJSON(
                        layerObj,
                        layerData,
                        F_.parseIntoGeoJSON(data)
                    )
            })
            .catch((err) => {
                loaded()
                if (err?.name === 'AbortError') return
                console.warn(
                    `ERROR! source.fetch of layer type '${layerData?.type}' failed for ${layerObj.name} /// ${err?.message || err}`
                )
            })
    })

    // The layer is made empty; the first view event fills it.
    cb({ type: 'FeatureCollection', features: [] }, true)
}

export const captureVector = (layerObj, options, cb, dynamicCb) => {
    options = options || {}
    // A headless acquisition (`ctx.acquire`) wants the layer's data, not the
    // layer: it is not on, it has no view of its own to be bound to, and
    // nothing of it is drawn.
    const headless = options.headless === true
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

    if (options.evenIfOff !== true && !headless && !L_.layers.on[layerObj.name]) {
        cb('off')
        return
    }

    // A type that fetches its own data (`modules.source`) may have no url at all.
    const sourceModule = LayerTypeRegistry.get(layerData?.type)?.source
    const hasSourceFetch = LayerInterface.hasOp(sourceModule, 'fetch')

    if (typeof layerUrl !== 'string' || layerUrl.length === 0) {
        if (!hasSourceFetch) {
            cb(null)
            return
        }
        layerUrl = ''
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
    if (layerUrl.length > 0 && !F_.isUrlAbsolute(layerUrl))
        layerUrl = L_.missionPath + layerUrl

    // The type owns its acquisition; core's url transports below are the
    // default for types that don't.
    if (hasSourceFetch) {
        _captureFromSource(
            layerObj,
            layerData,
            sourceModule,
            layerUrl,
            cb,
            dynamicCb,
            options.isRefresh,
            !headless && layerData?.variables?.dynamicExtent === true,
            headless
        )
        return
    }

    let done = true
    let urlSplitRaw = layerObj.url.split(':')
    let urlSplit = layerObj.url.toLowerCase().split(':')

    if (!headless && layerData?.variables?.dynamicExtent === true) {
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

                        // Per-group statistics, so a feature can be styled or
                        // labelled by its group rather than only by itself.
                        const statsFields = getStatsFields(layerData)
                        if (statsFields.length > 0)
                            body.stats = statsFields.join(',')

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

                        const loaded = _requeryLoading(layerObj)
                        calls.api(
                            'geodatasets_get',
                            body,
                            (data) => {
                                loaded()
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
                                            (Math.round(lastLoc.zoom * 10) !==
                                                Math.round(nowLoc.zoom * 10) ||
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
                                loaded()
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

                        const loaded = _requeryLoading(layerObj)
                        const _dynamicDefaultSuccess = function (data) {
                            loaded()
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
                                        (Math.round(lastLoc.zoom * 10) !==
                                            Math.round(nowLoc.zoom * 10) ||
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
                            loaded()
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
                const statsFields = getStatsFields(layerData)
                if (statsFields.length > 0) body.stats = statsFields.join(',')
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

const _acquiring = new Set()

/**
 * A configured layer's data, acquired headlessly — the seam a feature needs when
 * one of its inputs is already a layer of the mission rather than a url the
 * plugin can fetch itself.
 *
 * It is *acquisition* only, deliberately: the layer is not turned on, nothing is
 * drawn, and the result is a plain GeoJSON snapshot rather than a live view of
 * another plugin's rendered state (which is unsupported for the reasons in
 * plugins/README.md — an off layer has nothing rendered, a vector-tile layer
 * never will, and there is no invalidation contract). Whatever the layer's type
 * does to get its data is what happens here, including its own `source.fetch`;
 * a dynamic-extent layer is acquired whole rather than bound to the viewport.
 * A layer with no feature collection to give (a tiled raster, whose url is a
 * template) resolves to null.
 *
 * @param {string} layerName - display name or uuid, as `L_.layers.data` keys it
 * @returns {Promise<object|null>} GeoJSON, or null if the layer can't be acquired
 */
export const acquireLayer = (layerName) =>
    new Promise((resolve) => {
        const uuid = L_.asLayerUUID(layerName)
        const layerData = L_.layers.data[uuid]
        if (layerData == null) {
            console.warn(
                `ERROR! acquire('${layerName}') — no such layer in this mission.`
            )
            resolve(null)
            return
        }
        // Two source types that acquire each other would otherwise recurse
        // until the stack gives out; the second one gets nothing instead.
        if (_acquiring.has(uuid)) {
            console.warn(
                `ERROR! acquire('${layerName}') — that layer is itself acquiring, which would not terminate.`
            )
            resolve(null)
            return
        }
        _acquiring.add(uuid)

        let settled = false
        const done = (data) => {
            if (settled) return
            settled = true
            _acquiring.delete(uuid)
            resolve(data === 'off' || data == null ? null : data)
        }

        try {
            captureVector(
                { ...layerData, name: uuid },
                { headless: true, evenIfOff: true },
                done,
                () => {}
            )
        } catch (err) {
            console.warn(
                `ERROR! acquire('${layerName}') failed /// ${err?.message || err}`
            )
            done(null)
        }
    })

export { isKmlUrl, fetchKmlAsGeoJSON }
