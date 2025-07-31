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

import Sortable from 'sortablejs'

import './Filtering.css'

const helpKey = 'LayersTool-Filtering'

const Filtering = {
    filters: {},
    current: {},
    mapSpatialLayer: null,
    initialize: function () {
        Object.keys(L_.layers.data).forEach((layerName) => {
            const layerObj = L_.layers.data[layerName]

            if (layerObj == null || layerObj.type != 'vector') return

            let shouldInitiallySubmit = false

            let initialFilterValues = []
            if (
                Filtering.filters[layerName] == null &&
                layerObj?.variables?.initialFilters &&
                layerObj.variables.initialFilters.length > 0
            ) {
                initialFilterValues = layerObj.variables.initialFilters
                initialFilterValues.forEach((f, idx) => {
                    f.id = idx
                    if (f.isGroup === true) {
                        if (f.groupOp != null) f.op = f.groupOp
                        if (f.key != null) delete f.key
                        if (f.value != null) delete f.value
                        if (f.type != null) delete f.type
                    } else {
                        f.op = f.op || '='
                    }
                })

                Filtering.filters[layerName] = Filtering.filters[layerName] || {
                    spatial: {
                        center: null,
                        radius: 0,
                    },
                    values: initialFilterValues || [],
                    geojson: null,
                }

                Filtering.submit(layerName)
            }
        })
    },
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
                        "<div id='layersTool_filtering_add_group' class='mmgisButton5' title='Add New Grouping'><div>Group</div><i class='mdi mdi-plus mdi-18px'></i></div>",
                        "<div id='layersTool_filtering_add_value' class='mmgisButton5' title='Add New Key-Value Filter'><div>Add</div><i class='mdi mdi-plus mdi-18px'></i></div>",
                    "</div>",
                "</div>",
                "<div id='layerTool_filtering_filters'>",
                    "<ul id='layerTool_filtering_filters_list'></ul>",
                    `<ul id='layerTool_filtering_filters_spatial' class='${spatialActive ? 'drawn' : ''}'>`,
                        `<div id='layerTool_filtering_filters_spatial_draw' class='mmgisButton5' title='Place a point on the map to enable a spatial filter.'><i class='mdi mdi-pencil mdi-14px'></i><div>${spatialActive ? 'Active' : 'Place Point'}</div></div>`,
                        "<div id='layerTool_filtering_filters_spatial_radius_wrapper' title='Radius\n= 0: Queries for features that contain this point.\n> 0: Queries for features intersecting this circle.'>",
                            "<div>R:</div>",
                            `<input id='layerTool_filtering_filters_spatial_radius' type='number' placeholder='Radius' value='${Filtering.filters[layerName].spatial.radius || 0}' min='0'></input>`,
                            "<div>m</div>",
                        "</div>",
                        "<div id='layerTool_filtering_filters_spatial_clear' class='mmgisButton5 layerTool_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>",
                    "</ul>",
                "</div>",
                `<div id='layersTool_filtering_footer'>`,
                    "<div id='layersTool_filtering_clear' class='mmgisButton5'><div>Clear Filter</div></div>",
                    "<div id='layersTool_filtering_submit' class='mmgisButton5'><div id='layersTool_filtering_submit_loading'><div></div></div><div id='layersTool_filtering_submit_text'>Submit</div><i class='mdi mdi-arrow-right mdi-18px'></i></div>",
                "</div>",
            "</div>",
        ].join('\n')

        container.append(markup)

        // In case of reopening the tool, recreate state
        let values = JSON.parse(
            JSON.stringify(Filtering.filters[layerName])
        ).values.filter(Boolean)
        const valuesOrder = Filtering.filters[layerName].valuesOrder

        if (valuesOrder && valuesOrder.length > 0) {
            values.sort((a, b) => {
                return valuesOrder.indexOf(a.id) - valuesOrder.indexOf(b.id)
            })
        }
        values.forEach((v) => {
            if (v && v.isGroup === true) Filtering.addGroup(layerName, v)
            else if (v) Filtering.addValue(layerName, v)
        })

        // events
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
    addGroup: function (layerName, group) {
        let id, op
        if (group) {
            id = group.id
            op = group.op
        } else {
            id = Filtering.filters[layerName].values.length
            op = 'OR' // Default to OR since AND is already the higher level op
        }

        // prettier-ignore
        const groupMarkup = [
            `<li class='layersTool_filtering_group' id='layersTool_filtering_group_${F_.getSafeName(
                layerName
            )}_${id}' idx='${id}'>`,
                `<div>`,
                    `<div class='filterDragHandle'><i class="mdi mdi-drag-vertical mdi-12px"></i></div>`,
                    "<div class='layersTool_filtering_group_key'>",
                        `Group`,
                    '</div>',
                    "<div class='layersTool_filtering_group_operator'>",
                        `<div id='layersTool_filtering_group_operator_${F_.getSafeName(
                            layerName
                        )}_${id}' class='layersTool_filtering_group_operator_select op_${(op || 'AND').toLowerCase()}'></div>`,
                    '</div>',
                `</div>`,
                `<div id='layersTool_filtering_group_clear_${F_.getSafeName(
                    layerName
                )}_${id}' class='mmgisButton5 layerTool_filtering_filters_clear'><i class='mdi mdi-close mdi-18px'></i></div>`,
            '</li>',
        ].join('\n')

        $('#layerTool_filtering_filters_list').append(groupMarkup)

        if (group == null) {
            Filtering.filters[layerName].values.push({
                isGroup: true,
                id: id,
                op: op,
            })
        }

        Filtering.attachGroupEvents(id, layerName, { op: op })

        Filtering.makeFilterListSortable()
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
            `<li class='layersTool_filtering_value' id='layersTool_filtering_value_${F_.getSafeName(layerName)}_${id}' idx='${id}'>`,
                `<div class='filterDragHandle'><i class="mdi mdi-drag-vertical mdi-12px"></i></div>`,
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
            "</li>",
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

        Filtering.makeFilterListSortable()

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
        $('#layersTool_filtering_add_group').on('click', function () {
            Filtering.addGroup(layerName)
        })
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
            Filtering.submit(layerName, true)
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
                if (v) {
                    if (v.isGroup === true)
                        $(
                            `#layersTool_filtering_group_${F_.getSafeName(
                                layerName
                            )}_${v.id}`
                        ).remove()
                    else
                        $(
                            `#layersTool_filtering_value_${F_.getSafeName(
                                layerName
                            )}_${v.id}`
                        ).remove()
                }
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
    attachGroupEvents: function (id, layerName, options) {
        options = options || {}

        let elmId

        // Clear
        elmId = `#layersTool_filtering_group_clear_${F_.getSafeName(
            layerName
        )}_${id}`

        $(elmId).on('click', () => {
            // Clear value filter element
            for (
                let i = 0;
                i < Filtering.filters[layerName].values.length;
                i++
            ) {
                if (Filtering.filters[layerName].values[i]?.isGroup) {
                    const vId = Filtering.filters[layerName].values[i]?.id
                    if (vId != null && vId === id) {
                        $(
                            `#layersTool_filtering_group_${F_.getSafeName(
                                layerName
                            )}_${vId}`
                        ).remove()
                        Filtering.filters[layerName].values[i] = null
                    }
                }
            }
            Filtering.setSubmitButtonState(true)
        })

        // Operator Dropdown
        elmId = `#layersTool_filtering_group_operator_${F_.getSafeName(
            layerName
        )}_${id}`

        const ops = ['AND', 'OR', 'NOT_AND', 'NOT_OR']
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<div style='font-family: monospace;'>All Must Match (AND)</div>`,
                    `<div style='font-family: monospace;'>Any May Match (OR)</div>`,
                    `<div style='font-family: monospace;'>Not All May Match (NOT AND)</div>`,
                    `<div style='font-family: monospace;'>None Must Match (NOT OR)</div>`,
                ],
                'op',
                opId,
                { openUp: true, hideChevron: true }
            )
        )
        Dropy.init($(elmId), function (idx) {
            const newOp = ops[idx]
            Filtering.filters[layerName].values[id].op = newOp
            switch (newOp) {
                case 'AND':
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_and')
                    break
                case 'OR':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_or')
                    break
                case 'NOT_AND':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_or')
                    $(elmId).addClass('op_not_and')
                    break
                case 'NOT_OR':
                    $(elmId).removeClass('op_and')
                    $(elmId).removeClass('op_or')
                    $(elmId).removeClass('op_not_and')
                    $(elmId).addClass('op_not_or')
                    break
                default:
                    break
            }
            Filtering.setSubmitButtonState(true)
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
                if (Filtering.filters[layerName].values[i]?.isGroup !== true) {
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
                    `3px solid ${F_.stringToColor(event.value)}`
                )
            },
        })

        $(elmId).on('blur', function (event) {
            const val = event.value || $(this).val()
            const property = Filtering.filters[layerName].aggs[val]
            if (property) {
                if (
                    Filtering.filters[layerName].values[id] &&
                    Filtering.filters[layerName].values[id].key !== val
                ) {
                    Filtering.filters[layerName].values[id].key = val
                    Filtering.filters[layerName].values[id].type = property.type
                    Filtering.updateValuesAutoComplete(id, layerName)
                    Filtering.setSubmitButtonState(true)
                }
                $(this).css('border', 'none')
                $(this).css(
                    'border-left',
                    `3px solid ${F_.stringToColor($(this).val())}`
                )
            } else $(this).css('border', '1px solid var(--color-p4)')
        })

        // Operator Dropdown
        elmId = `#layersTool_filtering_value_operator_${F_.getSafeName(
            layerName
        )}_${id}`

        const ops = [
            '=',
            '!=',
            ',',
            '<',
            '>',
            '<=',
            '>=',
            'contains',
            'beginswith',
            'endswith',
        ]
        const opId = Math.max(ops.indexOf(options.op), 0)
        $(elmId).html(
            Dropy.construct(
                [
                    `<i class='mdi mdi-equal mdi-18px' title='Equals'></i>`,
                    `<div title='Not Equals' style='font-family: monospace;'>!=</div>`,
                    `<div title='Comma-separated list' style='font-family: monospace;'>in</div>`,
                    `<i class='mdi mdi-less-than mdi-18px' title='Less than'></i>`,
                    `<i class='mdi mdi-greater-than mdi-18px' title='Greater than'></i>`,
                    `<i class='mdi mdi-less-than-or-equal mdi-18px' title='Less than or Equal'></i>`,
                    `<i class='mdi mdi-greater-than-or-equal mdi-18px' title='Greater than or Equal'></i>`,
                    `<i class='mdi mdi-contain mdi-18px' title='Contains'></i>`,
                    `<i class='mdi mdi-contain-start mdi-18px' title='Begins With'></i>`,
                    `<i class='mdi mdi-contain-end mdi-18px' title='Ends With'></i>`,
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
    submit: async function (layerName, updateValuesOrder) {
        const layerObj = L_.layers.data[layerName]

        // Update the desired order of values
        if (updateValuesOrder) {
            const valuesOrder = []
            $('#layerTool_filtering_filters_list > li').each(function () {
                const idx = $(this).attr('idx')
                if (idx !== undefined) {
                    valuesOrder.push(parseInt(idx))
                }
            })
            Filtering.filters[layerName].valuesOrder = valuesOrder
        }

        Filtering.setSubmitButtonState(true)
        $(`#layersTool_filtering_submit_loading`).addClass('active')
        if (layerObj.type === 'vector') {
            // needsToQueryGeodataset (but pulled out so submit could be called standalone)
            if (
                layerObj?.url.startsWith('geodatasets:') &&
                layerObj?.variables?.getFeaturePropertiesOnClick === true
            ) {
                GeodatasetFilterer.filter(
                    layerName,
                    Filtering.filters[layerName]
                )
            } else {
                LocalFilterer.filter(layerName, Filtering.filters[layerName])
            }
        } else if (layerObj.type === 'query') {
            await ESFilterer.filter(
                layerName,
                Filtering.filters[layerName],
                Filtering.getConfig()
            )
        }

        $(`#layersTool_filtering_submit_loading`).removeClass('active')
        Filtering.setSubmitButtonState(false)

        if (Filtering.mapSpatialLayer) Filtering.mapSpatialLayer.bringToFront()
    },
    makeFilterListSortable: function () {
        const listToSort = document.getElementById(
            'layerTool_filtering_filters_list'
        )
        Sortable.create(listToSort, {
            animation: 150,
            easing: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
            handle: '.filterDragHandle',
            onStart: () => {},
            onChange: () => {},
            onEnd: () => {},
        })
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
