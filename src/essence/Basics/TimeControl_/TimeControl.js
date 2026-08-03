// TimeControl sets up a div that displays the time controller
import { utcFormat } from 'd3-time-format'
import * as moment from 'moment'
import $ from 'jquery'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import Map_ from '../Map_/Map_'
import LayerInterface from '../Layers_/interface/LayerInterface'
import LayerTypeRegistry from '../Layers_/registry/LayerTypeRegistry'
import MapRenderer from '../Map_/MapRenderer'
import TimeUI from './TimeUI'

import './TimeControl.css'

/**
 * How a time is written into a layer's url or request is the layer type's
 * business: a type may ship `time.format` to convert MMGIS' ISO times into
 * whatever its service expects. Core's default honors `layer.time.format`.
 */
function layerTimeFormatter(layer) {
    const coreFormat =
        layer?.time?.format == null || layer.time.format === ''
            ? utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : utcFormat(layer.time.format)

    return (date) =>
        LayerInterface.runSync(
            LayerTypeRegistry.get(layer?.type)?.time,
            'format',
            [date, layer],
            { coreDefault: (d) => coreFormat(d) }
        )
}

// Can be either hh:mm:ss or just seconds
const relativeTimeFormat = new RegExp(
    /^(-?)(?:2[0-3]|[01]?[0-9]):[0-5][0-9]:[0-5][0-9]$/
)

var TimeControl = {
    enabled: false,
    isRelative: true,
    currentTime: null,
    timeOffset: '01:00:00',
    startTime: null,
    endTime: null,
    relativeStartTime: '01:00:00',
    relativeEndTime: '00:00:00',
    globalTimeFormat: null,
    _updateLockedForAcceptingInput: false,
    timeUI: null,
    customTimes: {
        times: [],
    },
    init: function () {
        if (L_.configData.time && L_.configData.time.enabled === true) {
            TimeControl.enabled = true
            TimeControl.globalTimeFormat = utcFormat(L_.configData.time.format)
        } else {
            return
        }

        TimeControl.timeUI = TimeUI.init(timeInputChange, TimeControl.enabled)

        //updateTime()

        initLayerTimes()
        initLayerDataTimes()
    },
    fina: function () {
        if (TimeControl.enabled === true && TimeControl.timeUI != null)
            TimeControl.timeUI.fina()
    },
    subscribe: function () {},
    unsubscribe: function () {},
    _subscriptions: {},
    subscribe: function (fid, func) {
        if (typeof func === 'function') TimeControl._subscriptions[fid] = func
    },
    unsubscribe: function (fid) {
        if (TimeControl._subscriptions[fid] != null)
            delete TimeControl._subscriptions[fid]
    },
    setTime: function (
        startTime,
        endTime,
        isRelative,
        timeOffset = '00:00:00',
        currentTime,
        customTimes
    ) {
        if (!TimeControl.enabled || startTime == null || endTime == null)
            return false

        if (customTimes != null) {
            if (typeof customTimes === 'string') {
                TimeControl.customTimes.times = [customTimes]
            } else {
                TimeControl.customTimes.times = customTimes
            }
        }

        const now = new Date()
        let offset = 0
        if (relativeTimeFormat.test(timeOffset)) {
            offset = parseTime(timeOffset)
        } else {
            // assume seconds otherwise
            offset = parseInt(timeOffset)
        }
        if (currentTime != null) {
            const currentTimeD = new Date(currentTime)
            TimeControl.currentTime =
                currentTimeD.toISOString().split('.')[0] + 'Z'
            currentTime = new moment(currentTimeD)
        } else {
            currentTime = new moment(now).add(offset, 'seconds')
            TimeControl.currentTime =
                currentTime.toDate().toISOString().split('.')[0] + 'Z'
        }

        if (isRelative == true) {
            const start = parseTime(startTime)
            const end = parseTime(endTime)
            const startTimeM = new moment(currentTime).subtract(
                start,
                'seconds'
            )
            const endTimeM = new moment(currentTime).add(end, 'seconds')

            TimeControl.startTime = startTimeM.toISOString().split('.')[0] + 'Z'
            TimeControl.endTime = endTimeM.toISOString().split('.')[0] + 'Z'
        } else {
            const startTimeD = new Date(startTime)
            const endTimeD = new Date(endTime)
            TimeControl.startTime = startTimeD.toISOString().split('.')[0] + 'Z'
            TimeControl.endTime = endTimeD.toISOString().split('.')[0] + 'Z'
        }

        // Then set startTime one month before end
        if (TimeControl.startTime > TimeControl.endTime) {
            const endTimeD = new Date(endTime)
            TimeControl.startTime =
                new Date(endTimeD.setDate(endTimeD.getDate() - 30))
                    .toISOString()
                    .split('.')[0] + 'Z'
        }

        return TimeControl.timeUI.updateTimes(
            TimeControl.startTime,
            TimeControl.endTime,
            TimeControl.currentTime
        )
    },
    setLayerTime: function (layer, startTime, endTime) {
        if (typeof layer == 'string') {
            layer = L_.asLayerUUID(layer)
            layer = L_.layers.data[layer]
        }
        if (layer.time && layer.time.enabled == true) {
            layer.time.start = startTime
            layer.time.end = endTime
            layer.time.customTimes = TimeControl.customTimes
            $('.starttime.' + F_.getSafeName(layer.name)).text(layer.time.start)
            $('.endtime.' + F_.getSafeName(layer.name)).text(layer.time.end)

            TimeControl.applyTimeParams(layer)
        }
        return true
    },
    getTime: function () {
        return TimeControl.currentTime
    },
    getStartTime: function () {
        return TimeControl.startTime
    },
    getEndTime: function () {
        return TimeControl.endTime
    },
    getLayerStartTime: function (layer) {
        if (typeof layer == 'string') {
            layer = L_.asLayerUUID(layer)
            layer = L_.layers.data[layer]
        }
        if (layer.time) return layer.time.start
        return false
    },
    getLayerEndTime: function (layer) {
        if (typeof layer == 'string') {
            layer = L_.asLayerUUID(layer)
            layer = L_.layers.data[layer]
        }
        if (layer.time) return layer.time.end
        return false
    },
    reloadLayer: async function (
        layer,
        evenIfOff,
        evenIfControlled,
        forceRequery,
        skipOrderedBringToFront
    ) {
        // reload layer
        if (typeof layer == 'string') {
            layer = L_.asLayerUUID(layer)
            layer = L_.layers.data[layer]
        }

        if (L_.layers.layer[layer.name] === null) return false

        const layerTimeFormat = (date) => layerTimeFormatter(layer)(date)
        layer.time.current = TimeControl.currentTime // keeps track of when layer was refreshed

        // Compute the resolved URL locally without mutating layer.url.
        // Mutating layer.url in-place caused a race condition where a
        // concurrent reloadLayer() call would capture the resolved URL as
        // its "original", corrupting the template placeholders permanently.
        let resolvedUrl = await TimeControl.performTimeUrlReplacements(
            layer.url,
            layer,
            forceRequery
        )
        let changedUrl = null
        if (resolvedUrl !== layer.url) changedUrl = resolvedUrl

        // What a time change means to a layer is the type's business, so it is
        // dispatched through the type's map plugin (`timeChange`). The core
        // default — stamp the resolved time into the url and reload the layer's
        // data — is what most types want; a type that can scrub in place (a tile
        // service taking time parameters) or must cycle its animation
        // (streamlines) provides its own `timeChange` instead, and may still
        // call `ctx.reload()` to get the default behavior.
        const reload = (opts = {}) => {
            // replace start/endtime keywords on the resolved URL (NOT on
            // layer.url) — passed through to refreshLayer below.
            if (layer.time && layer.time.enabled === true) {
                if (
                    layer.time.type === 'global' ||
                    layer.time.type === 'requery' ||
                    forceRequery
                ) {
                    resolvedUrl = resolvedUrl
                        .replace(
                            /{starttime}/g,
                            layerTimeFormat(Date.parse(layer.time.start))
                        )
                        .replace(
                            /{endtime}/g,
                            layerTimeFormat(Date.parse(layer.time.end))
                        )
                        .replace(
                            /{time}/g,
                            layerTimeFormat(Date.parse(layer.time.end))
                        )

                    if (
                        TimeControl.customTimes?.times &&
                        TimeControl.customTimes.times.length > 0
                    ) {
                        for (
                            let i = 0;
                            i < TimeControl.customTimes.times.length;
                            i++
                        ) {
                            resolvedUrl = resolvedUrl.replace(
                                new RegExp(`{customtime.${i}}`, 'g'),
                                TimeControl.customTimes.times[i]
                            )
                        }
                    }
                }
            }

            if (evenIfControlled !== true && layer.controlled === true) return
            if (!L_.layers.on[layer.name] && !evenIfOff) return

            return Map_.refreshLayer(
                layer,
                opts.afterLoad,
                skipOrderedBringToFront,
                undefined,
                resolvedUrl
            )
        }

        await LayerInterface.run(
            LayerTypeRegistry.get(layer.type)?.map,
            'timeChange',
            [
                layer,
                {
                    ...MapRenderer.context(),
                    name: layer.name,
                    currentTime: TimeControl.currentTime,
                    timeFormat: layerTimeFormat,
                    changedUrl,
                    evenIfOff,
                    evenIfControlled,
                    forceRequery,
                    skipOrderedBringToFront,
                    reload,
                },
            ],
            { coreDefault: () => reload() }
        )

        return true
    },
    performTimeUrlReplacements: async function (
        url,
        layer,
        forceRequery,
        type
    ) {
        return new Promise(async (resolve, reject) => {
            const layerTimeFormat = (date) => layerTimeFormatter(layer)(date)

            let nextUrl = url
            if (layer.variables?.urlReplacements) {
                const keys = Object.keys(layer.variables.urlReplacements)
                for (let i = 0; i < keys.length; i++) {
                    const r = layer.variables.urlReplacements[keys[i]]
                    if (r.on === 'timeChange') {
                        const response = await fetch(r.url, {
                            method: r.type,
                            headers: {
                                accept: 'application/json',
                                'content-type': 'application/json',
                            },
                            body: JSON.stringify(r.body)
                                .replaceAll(
                                    '{starttime}',
                                    layerTimeFormat(
                                        Date.parse(layer.time.start)
                                    )
                                )
                                .replaceAll(
                                    '{endtime}',
                                    layerTimeFormat(Date.parse(layer.time.end))
                                ),
                        })
                        const res = await response.json()
                        const replacement = F_.getIn(res, r.return)
                        if (replacement)
                            nextUrl = nextUrl.replace(
                                `{${keys[i]}}`,
                                encodeURIComponent(replacement)
                            )
                    }
                }
            }

            if (forceRequery === true) {
                nextUrl += `${
                    nextUrl.indexOf('?') === -1 ? '?' : '&'
                }nocache=${new Date().getTime()}`
            }
            resolve(nextUrl)
        })
    },
    reloadTimeLayers: async function () {
        // refresh time enabled layers
        let reloadedLayers = []
        let savedActiveFeature = null

        // Save active feature if it belongs to a time-enabled layer
        if (L_.activeFeature) {
            const activeLayerName = L_.activeFeature.layerName
            const activeLayer = L_.layers.data[activeLayerName]

            if (
                activeLayer &&
                activeLayer.time &&
                activeLayer.time.enabled === true
            ) {
                // Save the active feature details for restoration
                savedActiveFeature = {
                    layerName: activeLayerName,
                    feature: JSON.parse(
                        JSON.stringify(L_.activeFeature.feature)
                    ),
                }

                // If the layer has useKeyAsId or useKeyAsName, save the key/value
                const keyProp =
                    activeLayer.variables?.useKeyAsId ||
                    activeLayer.variables?.useKeyAsName
                if (keyProp && L_.activeFeature.feature.properties) {
                    // keyProp might be a path like "properties.id" or just "id"
                    const keyPath = keyProp.includes('.')
                        ? keyProp.split('.')
                        : [keyProp]
                    const keyValue = F_.getIn(
                        L_.activeFeature.feature.properties,
                        keyPath
                    )
                    if (keyValue != null) {
                        savedActiveFeature.key = keyProp
                        savedActiveFeature.value = keyValue
                    }
                }
            }
        }

        // Kick off all reloads concurrently and wait for every reload's
        // promise to settle. Previously the loop just called reloadLayer
        // fire-and-forget and a setTimeout/500ms was used to "hope" all
        // layers had finished — that race left feature-selection and
        // follow-pan logic running against partially-loaded layers.
        //
        // Use Promise.allSettled (not Promise.all) so a single failing
        // layer (e.g. network error, malformed config) does NOT throw
        // here and skip the active-feature restoration and follow-pan
        // logic below — the old setTimeout(500) approach ran them
        // unconditionally and we preserve that robustness.
        const reloadPromises = []
        for (let layerName in L_.layers.data) {
            const layer = L_.layers.data[layerName]
            if (
                layer.time &&
                layer.time.enabled === true &&
                layer.variables?.dynamicExtent != true
            ) {
                reloadPromises.push(TimeControl.reloadLayer(layer))
                reloadedLayers.push(layer.name)
            }
        }
        await Promise.allSettled(reloadPromises)

        // Restore active feature after layers reload
        if (
            savedActiveFeature &&
            reloadedLayers.includes(savedActiveFeature.layerName)
        ) {
            // Try to restore using key/value if available
            if (savedActiveFeature.key && savedActiveFeature.value) {
                L_.selectPoint({
                    layerUUID: savedActiveFeature.layerName,
                    key: savedActiveFeature.key,
                    value: savedActiveFeature.value,
                })
            } else if (
                savedActiveFeature.feature.geometry &&
                savedActiveFeature.feature.geometry.coordinates
            ) {
                // Fallback to selecting by coordinates
                const coords = savedActiveFeature.feature.geometry.coordinates
                let lat, lon
                if (savedActiveFeature.feature.geometry.type === 'Point') {
                    lon = coords[0]
                    lat = coords[1]
                } else if (
                    savedActiveFeature.feature.geometry.type === 'LineString' ||
                    savedActiveFeature.feature.geometry.type === 'Polygon'
                ) {
                    // Get first coordinate or centroid
                    const firstCoord =
                        savedActiveFeature.feature.geometry.type === 'Polygon'
                            ? coords[0][0]
                            : coords[0]
                    lon = firstCoord[0]
                    lat = firstCoord[1]
                }

                if (lat != null && lon != null) {
                    L_.selectPoint({
                        layerUUID: savedActiveFeature.layerName,
                        lat: lat,
                        lon: lon,
                    })
                }
            }
        }

        // Pan to followed feature after layers reload
        if (TimeUI.followEnabled && TimeUI.followedFeature) {
            TimeUI.panToFollowedFeature()
        }

        return reloadedLayers
    },
    updateLayersTime: function () {
        let updatedLayers = []
        for (let layerName in L_.layers.data) {
            const layer = L_.layers.data[layerName]
            if (layer.time && layer.time.enabled === true) {
                layer.time.start = TimeControl.startTime
                layer.time.end = TimeControl.currentTime
                layer.time.customTimes = TimeControl.customTimes
                $('.starttime.' + F_.getSafeName(layer.name)).text(
                    layer.time.start
                )
                $('.endtime.' + F_.getSafeName(layer.name)).text(layer.time.end)
                updatedLayers.push(layer.name)
                TimeControl.applyTimeParams(layer)
            }
        }
        return updatedLayers
    },
    setLayerTimeStatus: function (layer, color) {
        if (typeof layer == 'string') {
            layer = L_.asLayerUUID(layer)
            layer = L_.layers.data[layer]
        }
        if (layer.time) {
            layer.time.status = color
            $('#timesettings' + F_.getSafeName(layer.name)).css(
                'color',
                layer.time.status
            )
        }
        return true
    },
    setLayersTimeStatus: function (color) {
        var updatedLayers = []
        for (let layerName in L_.layers.data) {
            const layer = L_.layers.data[layerName]
            if (
                layer.time &&
                layer.time.enabled === true &&
                (layer.time.type === 'global' || layer.time.type === 'requery')
            ) {
                TimeControl.setLayerTimeStatus(layer, color)
                updatedLayers.push(layer.name)
            }
        }
        return updatedLayers
    },
    /**
     * Some layers take the time window as parameters on the live layer rather
     * than needing a reload; whether that is possible, and what the parameters
     * are called, is the layer type's business (`time.applyTimeParams`). A type
     * without one simply has nothing to stamp.
     */
    applyTimeParams: function (layer) {
        LayerInterface.runSync(
            LayerTypeRegistry.get(layer.type)?.time,
            'applyTimeParams',
            [layer, { currentTime: TimeControl.currentTime }]
        )
    },
}

function initLayerDataTimes() {
    for (let i in L_.layers.dataFlat) {
        const layer = L_.layers.dataFlat[i]
        if (layer.time && layer.time.enabled === true) {
            layer.time.start = L_.FUTURES.startTime
                ? L_.FUTURES.startTime.toISOString().split('.')[0] + 'Z'
                : TimeControl.startTime
            layer.time.end = L_.FUTURES.endTime
                ? L_.FUTURES.endTime.toISOString().split('.')[0] + 'Z'
                : TimeControl.endTime
            layer.time.customTimes = TimeControl.customTimes
        }
    }
}

function initLayerTimes() {
    for (let layerName in L_.layers.data) {
        const layer = L_.layers.data[layerName]
        if (layer.time && layer.time.enabled === true) {
            layer.time.start = L_.FUTURES.startTime
                ? L_.FUTURES.startTime.toISOString().split('.')[0] + 'Z'
                : TimeControl.startTime
            layer.time.end = L_.FUTURES.endTime
                ? L_.FUTURES.endTime.toISOString().split('.')[0] + 'Z'
                : TimeControl.endTime
            layer.time.customTimes = TimeControl.customTimes
            $('.starttime.' + F_.getSafeName(layer.name)).text(layer.time.start)
            $('.endtime.' + F_.getSafeName(layer.name)).text(layer.time.end)

            // Make sure time-parameterized layers (WMS and friends) carry their
            // parameters before the first load
            TimeControl.applyTimeParams(layer)
        }
    }
}

function timeInputChange(startTime, endTime, currentTime, skipUpdate) {
    TimeControl.startTime = startTime
    TimeControl.currentTime = currentTime == null ? endTime : currentTime
    TimeControl.endTime = endTime

    if (L_?._timeChangeSubscriptions)
        Object.keys(L_._timeChangeSubscriptions).forEach((k) => {
            L_._timeChangeSubscriptions[k]({ startTime, currentTime, endTime })
        })

    Object.keys(TimeControl._subscriptions).forEach((k) => {
        TimeControl._subscriptions[k]({
            startTime: TimeControl.startTime,
            endTime: TimeControl.endTime,
            currentTime: TimeControl.currentTime,
        })
    })

    if (skipUpdate !== true) {
        // Update layer times and reload.
        // Store the promise so external callers (e.g. Search "Fit time
        // range") can await the reload instead of using a fixed delay.
        TimeControl.updateLayersTime()
        TimeControl._reloadPromise = TimeControl.reloadTimeLayers()
    }
}

function parseTime(t) {
    if (t.toString().indexOf(':') == -1) {
        return parseInt(t)
    }
    var s = t.split(':')
    var seconds = +s[0].replace('-', '') * 60 * 60 + +s[1] * 60 + +s[2]
    if (t.charAt(0) === '-') {
        seconds = seconds * -1
    }
    return seconds
}

export default TimeControl
