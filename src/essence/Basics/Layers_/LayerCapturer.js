import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import calls from '../../../pre/calls'
import TimeControl from '../../Ancillary/TimeControl'

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
        layerObj.time == null
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
    }
    if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl

    let done = true
    let urlSplitRaw = layerObj.url.split(':')
    let urlSplit = layerObj.url.toLowerCase().split(':')

    switch (urlSplit[0]) {
        case 'geodatasets':
            if (layerData?.variables?.dynamicExtent === true) {
                // Return .on('moveend zoomend') event
                dynamicCb((e) => {
                    const zoom = L_.Map_.map.getZoom()
                    if (
                        zoom >= (layerData.minZoom || 0) &&
                        (zoom <= layerData.maxZoom || 100)
                    ) {
                        // Then query, delete existing and remake
                        const bounds = L_.Map_.map.getBounds()

                        calls.api(
                            'geodatasets_get',
                            {
                                layer: urlSplitRaw[1],
                                type: 'geojson',
                                bounds: {
                                    northEast: {
                                        lat: bounds._northEast.lat,
                                        lng: bounds._northEast.lng,
                                    },
                                    southWest: {
                                        lat: bounds._southWest.lat,
                                        lng: bounds._southWest.lng,
                                    },
                                },
                                crsCode: mmgisglobal.customCRS.code.replace(
                                    'EPSG:',
                                    ''
                                ),
                            },
                            (data) => {
                                L_.clearVectorLayer(layerObj.name)
                                L_.updateVectorLayer(layerObj.name, data.body)
                            },
                            (data) => {
                                console.warn(
                                    'ERROR: ' +
                                        data.status +
                                        ' in geodatasets_get:' +
                                        layerObj.display_name +
                                        ' /// ' +
                                        data.message
                                )
                            }
                        )
                    } else {
                        // Just delete existing
                    }
                })
                cb({ type: 'FeatureCollection', features: [] }, true)
            } else {
                calls.api(
                    'geodatasets_get',
                    {
                        layer: urlSplitRaw[1],
                        type: 'geojson',
                    },
                    function (data) {
                        cb(data.body)
                    },
                    function (data) {
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
            }
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

    if (!done) {
        $.getJSON(layerUrl, function (data) {
            if (data.hasOwnProperty('Features')) {
                data.features = data.Features
                delete data.Features
            }
            cb(data)
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
            cb(null)
        })
    }
}
