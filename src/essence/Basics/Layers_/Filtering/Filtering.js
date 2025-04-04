// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import Map_ from '../../Map_/Map_'

import LocalFilterer from '../../../Ancillary/LocalFilterer'
import ESFilterer from './ESFilterer'
import GeodatasetFilterer from './GeodatasetFilterer'

import Help from '../../../Ancillary/Help'
import Dropy from '../../../../external/Dropy/dropy'
import { circle } from '@turf/turf'

import './Filtering.css'

const helpKey = 'LayersTool-Filtering'

const Filtering = {
    filters: {},
    current: {},
    mapSpatialLayer: null,
    make: async function (container, layerName) {
        const layerObj = L_.layers.data[layerName]

        if (layerObj == null) return

        Filtering.filters[layerName] = Filtering.filters[layerName] || {
            spatial: {
                center: null,
                radius: 0,
            },
            values: [],
            geojson: null,
        }
        Filtering.current = {
            layerName: layerName,
            layerObj: layerObj,
            type: layerObj.type,
            needsToQueryGeodataset:
                layerObj?.url.startsWith('geodatasets:') &&
                layerObj?.variables?.dynamicExtent === true &&
                layerObj?.variables?.getFeaturePropertiesOnClick === true,
        }

        if (Filtering.current.type === 'vector') {
            if (Filtering.current.needsToQueryGeodataset) {
                Filtering.filters[layerName].aggs =
                    await GeodatasetFilterer.getAggregations(layerName)
            } else {
                try {
                    Filtering.filters[layerName].geojson =
                        Filtering.filters[layerName].geojson ||
                        L_.layers.layer[layerName].toGeoJSON(
                            L_.GEOJSON_PRECISION
                        )
                } catch (err) {
                    console.warn(
                        `Filtering - Cannot find GeoJSON to filter on for layer: ${layerName}`
                    )
                    return
                }
                Filtering.filters[layerName].aggs =
                    LocalFilterer.getAggregations(
                        Filtering.filters[layerName].geojson,
                        layerName
                    )
            }
        } else if (Filtering.current.type === 'query') {
            Filtering.filters[layerName].aggs =
                await ESFilterer.getAggregations(
                    layerName,
                    Filtering.getConfig()
                )
        }
        const spatialActive =
            Filtering.filters[layerName].spatial?.center != null

        // prettier-ignore
        const markup = [
            "<div id='layersTool_filtering'>",
                "<div id='layersTool_filtering_header'>",
                    "<div id='layersTool_filtering_title_left'>",
                        "<div id='layersTool_filtering_title'>Filter</div>",
                        Help.getComponent(helpKey),
                        "<div id='layersTool_filtering_count'></div>",
                    "</div>",
                    "<div id='layersTool_filtering_adds'>",
                        "<div id='layersTool_filtering_add_value' class='mmgisButton5' title='Add New Key-Value Filter'><div>Add</div><i class='mdi mdi-plus mdi-18px'></i></div>",
                    "</div>",
                "</div>",
                "<div id='layerTool_filtering_filters'>",
                    "<ul id='layerTool_filtering_filters_list'></ul>",
                    Filtering.current.needsToQueryGeodataset === true ? null : [`<ul id='layerTool_filtering_filters_spatial' class='${spatialActive ? 'drawn' : ''}'>`,
                        `<div id='layerTool_filtering_filters_spatial_draw' class='mmgisButton5' title='Place a point on the map to enable a spatial filter.'><i class='mdi mdi-pencil mdi-14px'></i><div>${spatialActive ? 'Active' : 'Place Point'}</div></div>`,
                        "<div id='layerTool_filtering_filters_spatial_radius_wrapper' title='Radius\n= 0: Queries for features that contain this point.\n> 0: Queries for features intersecting this circle.'>",
                            "<div>R:</div>",
                            `<input id='layerTool_filtering_filters_spatial_radius' type='number' placeholder='Radius' value='${Filtering.filters[layerName].spatial.radius || 0}' min='0'></input>`,
                            "<div>m</div>",
                        "</div>",
                        "<div id='layerTool_filtering_filters_spatial_clear' class='mmgisButton5 layerTool_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>",
                    "</ul>"].join('\n'),
                "</div>",
                `<div id='layersTool_filtering_footer'>`,
                    "<div id='layersTool_filtering_clear' class='mmgisButton5'><div>Clear Filter</div></div>",
                    "<div id='layersTool_filtering_submit' class='mmgisButton5'><div id='layersTool_filtering_submit_loading'><div></div></div><div id='layersTool_filtering_submit_text'>Submit</div><i class='mdi mdi-arrow-right mdi-18px'></i></div>",
                "</div>",
            "</div>",
        ].join('\n')

        container.append(markup)

        Filtering.filters[layerName].values.forEach((v) => {
            if (v) Filtering.addValue(layerName, v)
        })

        Filtering.attachEvents(layerName)

        Filtering.drawSpatialLayer(
            layerName,
            Filtering.filters[layerName].spatial.center,
            Filtering.filters[layerName].spatial.radius
        )

        // Start with one empty row added
        if (
            $('#layerTool_filtering_filters_list .layersTool_filtering_value')
                .length === 0
        )
            Filtering.addValue(layerName)

        Help.finalize(helpKey)
    },
    destroy: function () {
        // Clear Spatial Filter
        Map_.rmNotNull(Filtering.mapSpatialLayer)

        $('#layersTool_filtering').remove()
    },
    addValue: function (layerName, value) {
        let id, key, op, val
        if (value) {
            id = value.id
            key = value.key != null ? ` value='${value.key}'` : ''
            op = value.op
            val = value.value != null ? ` value='${value.value}'` : ''
        } else id = Filtering.filters[layerName].values.length

        // prettier-ignore
        const valueMarkup = [
            `<div class='layersTool_filtering_value' id='layersTool_filtering_value_${F_.getSafeName(layerName)}_${id}'>`,
                "<div class='layersTool_filtering_value_key'>",
                    `<input id='layersTool_filtering_value_key_input_${F_.getSafeName(layerName)}_${id}' class='layersTool_filtering_value_key_input' spellcheck='false' type='text'${key} placeholder='Property...'></input>`,
                "</div>",
                "<div class='layersTool_filtering_value_operator'>",
                    `<div id='layersTool_filtering_value_operator_${F_.getSafeName(layerName)}_${id}' class='layersTool_filtering_value_operator_select'></div>`,
                "</div>",
                "<div class='layersTool_filtering_value_value'>",
                    `<input id='layersTool_filtering_value_value_input_${F_.getSafeName(layerName)}_${id}' class='layersTool_filtering_value_value_input' spellcheck='false' type='text'${val} placeholder='Value...'></input>`,
                    `<div class='layersTool_filtering_value_value_type'>`,
                        `<i id='layersTool_filtering_value_value_type_number_${F_.getSafeName(layerName)}_${id}' style='display: none;' class='mdi mdi-numeric mdi-18px'></i>`,
                        `<i id='layersTool_filtering_value_value_type_string_${F_.getSafeName(layerName)}_${id}' style='display: none;'class='mdi mdi-alphabetical-variant mdi-18px'></i>`,
                    `</div>`,
                "</div>",
                `<div id='layersTool_filtering_value_clear_${F_.getSafeName(layerName)}_${id}' class='mmgisButton5 layerTool_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>`,
            "</div>",
        ].join('\n')

        $('#layerTool_filtering_filters_list').append(valueMarkup)

        if (value == null) {
            Filtering.filters[layerName].values.push({
                id: id,
                type: null,
                key: null,
                op: '=',
                value: null,
            })
        }

        Filtering.attachValueEvents(id, layerName, { op: op })

        // Show footer iff value rows exist
        $('#layersTool_filtering_footer').css(
            'display',
            Filtering.filters[layerName].values.length === 0 ? 'none' : 'flex'
        )
    },
    drawSpatialLayer: function (layerName, center, radius) {
        Map_.rmNotNull(Filtering.mapSpatialLayer)

        Filtering.setSubmitButtonState(true)
        if (center == null) return

        const style = {
            fillOpacity: 0.1,
            fillColor: 'white',
            color: 'lime',
            weight: 2,
            opacity: 1,
            className: 'noPointerEventsImportant',
        }

        if (radius > 0) {
            // Buffered Circle
            const geojson = F_.getBaseGeoJSON()
            geojson.features.push(
                circle(
                    [center.lng, center.lat],
                    radius * 0.001 * F_.getEarthToPlanetRatio()
                )
            )

            Filtering.mapSpatialLayer = L.geoJSON(geojson, {
                style: style,
            }).addTo(Map_.map)
            Filtering.filters[layerName].spatial.feature = geojson.features[0]
        } else {
            // Circle marker
            Filtering.mapSpatialLayer = new L.circleMarker(
                [center.lat, center.lng],
                style
            )
                .setRadius(4)
                .addTo(Map_.map)

            Filtering.filters[layerName].spatial.feature = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: [center.lng, center.lat],
                },
            }
        }
        Filtering.mapSpatialLayer.bringToFront()
    },
    // To highlight the submit button to indicate a change's been made in the form
    setSubmitButtonState: function (active) {
        if (active) {
            $('#layersTool_filtering_submit_text').text('Submit')
            $('#layersTool_filtering_submit').addClass('active')
        } else if ($('#layersTool_filtering_submit').hasClass('active')) {
            $('#layersTool_filtering_submit_text').text('Submitted')
            $('#layersTool_filtering_submit').removeClass('active')
        }
    },
    attachEvents: function (layerName) {
        // Add Value
        $('#layersTool_filtering_add_value').on('click', function () {
            Filtering.addValue(layerName)
        })

        // Draw
        $('#layerTool_filtering_filters_spatial_draw').on('click', function () {
            Map_.rmNotNull(Filtering.mapSpatialLayer)
            $('#map').css('cursor', 'crosshair')
            $('#layerTool_filtering_filters_spatial_draw > div').text(
                'Placing Point'
            )
            $('#layerTool_filtering_filters_spatial').removeClass('drawn')
            $('#layerTool_filtering_filters_spatial').addClass('drawing')
            Map_.map.on('click', spatialOnClick)
        })
        function spatialOnClick(e) {
            Map_.map.off('click', spatialOnClick)
            $('#map').css('cursor', 'grab')
            $('#layerTool_filtering_filters_spatial_draw > div').text('Active')
            $('#layerTool_filtering_filters_spatial').removeClass('drawing')
            $('#layerTool_filtering_filters_spatial').addClass('drawn')

            Filtering.filters[layerName].spatial.center = {
                lng: e.latlng.lng,
                lat: e.latlng.lat,
            }
            Filtering.drawSpatialLayer(
                layerName,
                Filtering.filters[layerName].spatial.center,
                Filtering.filters[layerName].spatial.radius
            )
        }
        // Draw - Radius
        $('#layerTool_filtering_filters_spatial_radius').on(
            'input',
            function (e) {
                Filtering.filters[layerName].spatial.radius = parseFloat(
                    $(this).val()
                )
                Filtering.drawSpatialLayer(
                    layerName,
                    Filtering.filters[layerName].spatial.center,
                    Filtering.filters[layerName].spatial.radius
                )
            }
        )
        // Draw - Clear
        $('#layerTool_filtering_filters_spatial_clear').on(
            'click',
            function () {
                Filtering.filters[layerName].spatial.center = null
                Map_.map.off('click', spatialOnClick)
                $('#map').css('cursor', 'grab')
                $('#layerTool_filtering_filters_spatial_draw > div').text(
                    'Place Point'
                )
                $('#layerTool_filtering_filters_spatial').removeClass('drawn')
                $('#layerTool_filtering_filters_spatial').removeClass('drawing')

                Filtering.drawSpatialLayer(
                    layerName,
                    Filtering.filters[layerName].spatial.center,
                    Filtering.filters[layerName].spatial.radius
                )
            }
        )

        // Submit
        $(`#layersTool_filtering_submit`).on('click', async () => {
            Filtering.setSubmitButtonState(true)
            $(`#layersTool_filtering_submit_loading`).addClass('active')
            if (Filtering.current.type === 'vector') {
                if (Filtering.current.needsToQueryGeodataset) {
                    GeodatasetFilterer.filter(
                        layerName,
                        Filtering.filters[layerName]
                    )
                } else {
                    LocalFilterer.filter(
                        layerName,
                        Filtering.filters[layerName]
                    )
                }
            } else if (Filtering.current.type === 'query') {
                await ESFilterer.filter(
                    layerName,
                    Filtering.filters[layerName],
                    Filtering.getConfig()
                )
            }

            $(`#layersTool_filtering_submit_loading`).removeClass('active')
            Filtering.setSubmitButtonState(false)

            if (Filtering.mapSpatialLayer)
                Filtering.mapSpatialLayer.bringToFront()
        })

        // Clear
        $(`#layersTool_filtering_clear`).on('click', async () => {
            // Clear Spatial Filter
            $('#layerTool_filtering_filters_spatial_clear').click()
            $(`#layersTool_filtering_submit_loading`).addClass('active')

            // Clear value filter elements
            Filtering.filters[layerName].values = Filtering.filters[
                layerName
            ].values.filter((v) => {
                if (v)
                    $(
                        `#layersTool_filtering_value_${F_.getSafeName(
                            layerName
                        )}_${v.id}`
                    ).remove()
                return false
            })

            // Refilter to show all
            if (Filtering.current.type === 'vector') {
                if (Filtering.current.needsToQueryGeodataset) {
                    GeodatasetFilterer.filter(
                        layerName,
                        Filtering.filters[layerName]
                    )
                } else {
                    LocalFilterer.filter(
                        layerName,
                        Filtering.filters[layerName]
                    )
                }
            } else if (Filtering.current.type === 'query') {
                await ESFilterer.filter(
                    layerName,
                    Filtering.filters[layerName],
                    Filtering.getConfig()
                )
            }

            // Reset count
            $('#layersTool_filtering_count').text('')

            Filtering.setSubmitButtonState(false)

            $(`#layersTool_filtering_submit_loading`).removeClass('active')

            if (Filtering.mapSpatialLayer)
                Filtering.mapSpatialLayer.bringToFront()
        })
    },
    attachValueEvents: function (id, layerName, options) {
        options = options || {}

        let elmId

        // Expand input boxes on focus
        // Contract input boxes on blur
        elmId = `#layersTool_filtering_value_key_input_${F_.getSafeName(
            layerName
        )}_${id}`
        $(elmId).on('focus', function () {
            $(this).parent().css('flex', '4 1')
        })
        $(elmId).on('blur', function () {
            $(this).parent().css('flex', '1 1')
        })
        elmId = `#layersTool_filtering_value_value_input_${F_.getSafeName(
            layerName
        )}_${id}`
        $(elmId).on('focus', function () {
            $(this).parent().css('flex', '4 1')
        })
        $(elmId).on('blur', function () {
            $(this).parent().css('flex', '1 1')
        })
        // Clear
        elmId = `#layersTool_filtering_value_clear_${F_.getSafeName(
            layerName
        )}_${id}`

        $(elmId).on('click', () => {
            // Clear value filter element
            for (
                let i = 0;
                i < Filtering.filters[layerName].values.length;
                i++
            ) {
                const vId = Filtering.filters[layerName].values[i]?.id
                if (vId != null && vId === id) {
                    $(
                        `#layersTool_filtering_value_${F_.getSafeName(
                            layerName
                        )}_${vId}`
                    ).remove()
                    Filtering.filters[layerName].values[i] = null
                }
            }
            Filtering.setSubmitButtonState(true)
        })

        // Property Autocomplete
        elmId = `#layersTool_filtering_value_key_input_${F_.getSafeName(
            layerName
        )}_${id}`

        let arrayToSearch = Object.keys(Filtering.filters[layerName].aggs)
        arrayToSearch = arrayToSearch.sort((a, b) => b.localeCompare(a))

        $(elmId).autocomplete({
            lookup: arrayToSearch,
            lookupLimit: 100,
            minChars: 0,
            transformResult: function (response, originalQuery) {
                let resultSuggestions = []
                $.map(response, function (jsonItem) {
                    if (typeof jsonItem != 'string') {
                        $.map(jsonItem, function (suggestionItem) {
                            resultSuggestions.push(suggestionItem)
                        })
                    }
                })
                resultSuggestions.sort(function (a, b) {
                    const aStart = String(a.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 },
                        bStart = String(b.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 }
                    if (aStart.index != bStart.index)
                        return aStart.index - bStart.index
                    else return a > b ? 1 : -1
                })
                response.suggestions = resultSuggestions
                return response
            },
            onSelect: function (event) {
                const property = Filtering.filters[layerName].aggs[event.value]
                Filtering.filters[layerName].values[id].type = property.type
                Filtering.filters[layerName].values[id].key = event.value
                Filtering.updateValuesAutoComplete(id, layerName)
                Filtering.setSubmitButtonState(true)
                $(this).css('border', 'none')
                $(this).css(
                    'border-left',
                    `6px solid ${F_.stringToColor(event.value)}`
                )
            },
        })

        $(elmId).on('blur', function (event) {
            const property =
                Filtering.filters[layerName].aggs[event.value || $(this).val()]
            if (property) {
                if (
                    Filtering.filters[layerName].values[id] &&
                    Filtering.filters[layerName].values[id].key !== event.value
                ) {
                    Filtering.filters[layerName].values[id].key = event.value
                    Filtering.filters[layerName].values[id].type = property.type
                    Filtering.updateValuesAutoComplete(id, layerName)
                    Filtering.setSubmitButtonState(true)
                }
                $(this).css('border', 'none')
                $(this).css(
                    'border-left',
                    `6px solid ${F_.stringToColor($(this).val())}`
                )
            } else $(this).css('border', '1px solid red')
        })

        // Operator Dropdown
        elmId = `#layersTool_filtering_value_operator_${F_.getSafeName(
            layerName
        )}_${id}`

        const ops = ['=', ',', '<', '>']
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<i class='mdi mdi-equal mdi-18px' title='Equals'></i>`,
                    `<div title='Comma-separated list' style='font-family: monospace;'>in</div>`,
                    `<i class='mdi mdi-less-than mdi-18px' title='Less than'></i>`,
                    `<i class='mdi mdi-greater-than mdi-18px' title='Greater than'></i>`,
                ],
                'op',
                opId,
                { openUp: true, hideChevron: true }
            )
        )
        Dropy.init($(elmId), function (idx) {
            Filtering.filters[layerName].values[id].op = ops[idx]
            Filtering.setSubmitButtonState(true)
        })

        // Value AutoComplete
        Filtering.updateValuesAutoComplete(id, layerName)
    },
    updateValuesAutoComplete: function (id, layerName) {
        let elmId = `#layersTool_filtering_value_value_input_${F_.getSafeName(
            layerName
        )}_${id}`
        let arrayToSearch = []
        if (
            Filtering.filters[layerName].values[id].key &&
            Filtering.filters[layerName].aggs[
                Filtering.filters[layerName].values[id].key
            ]
        )
            arrayToSearch = Object.keys(
                Filtering.filters[layerName].aggs[
                    Filtering.filters[layerName].values[id].key
                ].aggs || {}
            )
        $(elmId).autocomplete({
            lookup: arrayToSearch,
            lookupLimit: 150,
            minChars: 0,
            transformResult: function (response, originalQuery) {
                let resultSuggestions = []
                $.map(response, function (jsonItem) {
                    if (typeof jsonItem != 'string') {
                        $.map(jsonItem, function (suggestionItem) {
                            resultSuggestions.push(suggestionItem)
                        })
                    }
                })
                resultSuggestions.sort(function (a, b) {
                    const aStart = String(a.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 },
                        bStart = String(b.value).match(
                            new RegExp(originalQuery, 'i')
                        ) || { index: -1 }
                    if (aStart.index != bStart.index)
                        return aStart.index - bStart.index
                    else return a > b ? 1 : -1
                })
                response.suggestions = resultSuggestions
                return response
            },
            onSelect: function (event) {
                Filtering.filters[layerName].values[id].value = event.value
                Filtering.setSubmitButtonState(true)
            },
        })
        $(elmId).on('keyup', function (e) {
            Filtering.filters[layerName].values[id].value = $(this).val()
            Filtering.setSubmitButtonState(true)
        })

        $('.autocomplete-suggestions').css({
            'max-height': '300px',
            'border-top': 'none',
        })

        // Change type indicator icons too
        const numberElmId = `#layersTool_filtering_value_value_type_number_${F_.getSafeName(
            layerName
        )}_${id}`
        const stringElmId = `#layersTool_filtering_value_value_type_string_${F_.getSafeName(
            layerName
        )}_${id}`
        switch (Filtering.filters[layerName].values[id].type) {
            case 'number':
                $(numberElmId).css('display', 'inherit')
                $(stringElmId).css('display', 'none')
                break
            case 'string':
                $(stringElmId).css('display', 'inherit')
                $(numberElmId).css('display', 'none')
                break
            default:
                $(numberElmId).css('display', 'none')
                $(stringElmId).css('display', 'none')
                break
        }
    },
    getConfig: function () {
        if (
            Filtering.current.layerObj.type === 'query' &&
            Filtering.current.layerObj.query
        ) {
            return {
                endpoint: Filtering.current.layerObj.query.endpoint,
                type: Filtering.current.layerObj.query.type || 'elasticsearch',
                ...(Filtering.current.layerObj.variables
                    ? Filtering.current.layerObj.variables.query || {}
                    : {}),
            }
        }
        return {}
    },
    // Let other places of the code trigger filters as needed
    triggerFilter: function (layerName) {
        if (Filtering.filters[layerName]) {
            if (L_.layers.data[layerName].type === 'vector')
                if (Filtering.filters[layerName]?.values?.[0]?.type != null) {
                    if (Filtering.current.needsToQueryGeodataset) {
                        GeodatasetFilterer.filter(
                            layerName,
                            Filtering.filters[layerName]
                        )
                    } else {
                        LocalFilterer.filter(
                            layerName,
                            Filtering.filters[layerName]
                        )
                    }
                }
        }
    },
    // Useful for dynamicExtent vector layers so that the geojson and aggs match the visible features
    updateGeoJSON: async function (layerName) {
        if (Filtering.filters[layerName]) {
            if (L_.layers.data[layerName].type === 'vector') {
                if (Filtering.current.needsToQueryGeodataset) {
                    Filtering.filters[layerName].aggs =
                        await GeodatasetFilterer.getAggregations(layerName)
                } else {
                    try {
                        Filtering.filters[layerName].geojson = L_.layers.layer[
                            layerName
                        ].toGeoJSON(L_.GEOJSON_PRECISION)
                    } catch (err) {
                        console.warn(
                            `Filtering - Cannot find GeoJSON to filter on for layer: ${layerName}`
                        )
                        return
                    }
                    Filtering.filters[layerName].aggs =
                        LocalFilterer.getAggregations(
                            Filtering.filters[layerName].geojson,
                            layerName
                        )
                }
            } else if (L_.layers.data[layerName].type === 'query')
                Filtering.filters[layerName].aggs =
                    await ESFilterer.getAggregations(
                        layerName,
                        Filtering.getConfig()
                    )

            if (Filtering.filters[layerName]?.values) {
                Filtering.filters[layerName]?.values.forEach((v, idx) => {
                    // Value AutoComplete
                    Filtering.updateValuesAutoComplete(idx, layerName)
                })
            }
        }
    },
}

export default Filtering
