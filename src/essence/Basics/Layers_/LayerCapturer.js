import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import calls from '../../../pre/calls'
import TimeControl from '../../Ancillary/TimeControl'

export const captureVector = (layerObj, options, cb) => {
    options = options || {}
    let layerUrl = layerObj.url

    if (
        options.evenIfOff !== true &&
        !layerObj.visibility &&
        !options.useEmptyGeoJSON
    ) {
        cb('off')
        return
    }

    if (
        (typeof layerUrl !== 'string' || layerUrl.length === 0) &&
        !options.useEmptyGeoJSON
    ) {
        cb(null)
        return
    }

    if (options.useEmptyGeoJSON) {
        cb(F_.getBaseGeoJSON())
        return
    }

    // Give time enabled layers a default start and end time to avoid errors
    const layerTimeFormat =
        layerObj.time == null
            ? d3.utcFormat('%Y-%m-%dT%H:%M:%SZ')
            : d3.utcFormat(layerObj.time.format)
    const startTime = layerTimeFormat(Date.parse(TimeControl.getStartTime()))
    const endTime = layerTimeFormat(Date.parse(TimeControl.getEndTime()))
    if (typeof layerObj.time != 'undefined') {
        layerUrl = layerObj.url
            .replace('{starttime}', startTime)
            .replace('{endtime}', endTime)
            .replace('{time}', endTime)
    }
    if (!F_.isUrlAbsolute(layerUrl)) layerUrl = L_.missionPath + layerUrl

    let done = true
    let urlSplitRaw = layerObj.url.split(':')
    let urlSplit = layerObj.url.toLowerCase().split(':')

    switch (urlSplit[0]) {
        case 'geodatasets':
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
        // If there is no url to a JSON file but the "controlled" option is checked in the layer config,
        // create the geoJSON layer with empty GeoJSON data
        const layerData = L_.layersDataByName[layerObj.name]
        if (L_.missionPath === layerUrl && layerData.controlled) {
            cb(F_.getBaseGeoJSON())
        } else {
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
}
