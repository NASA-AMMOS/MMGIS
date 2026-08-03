// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import Map_ from '../../Map_/Map_'

import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'

import Help from '../../UserInterface_/components/Help/Help'
import OpGridSelector from './OpGridSelector'
import { circle } from '@turf/turf'

import Sortable from 'sortablejs'

import './Filtering.css'

const helpKey = 'LayersTool-Filtering'

/**
 * Which types can be filtered, and how, is the layer type's business: a type
 * ships a `filter` surface with `getAggregations` (what can I filter on?) and
 * `filter` (apply this filter state). A type without one simply isn't
 * filterable, and every call below no-ops for it.
 */
function filterModuleOf(layerName) {
    return LayerTypeRegistry.get(L_.layers.data[layerName]?.type)?.filter
}

const Filtering = {
    filters: {},
    current: {},
    currentContainer: null,
    mapSpatialLayer: null,
    /** True if this layer's type ships a filtering strategy. */
    isFilterable: function (layerName) {
        return LayerInterface.hasOp(filterModuleOf(layerName), 'filter')
    },
    /**
     * Ask the layer's type what can be filtered on. Returns undefined for a
     * type that isn't filterable and null when the type could not answer.
     */
    getAggregations: async function (layerName, ctx = {}) {
        return LayerInterface.run(filterModuleOf(layerName), 'getAggregations', [
            layerName,
            Filtering.filters[layerName],
            ctx,
        ])
    },
    /** Ask the layer's type to apply the layer's current filter state. */
    applyFilter: async function (layerName, ctx = {}) {
        return LayerInterface.run(filterModuleOf(layerName), 'filter', [
            layerName,
            Filtering.filters[layerName],
            ctx,
        ])
    },
    initialize: function () {
        Object.keys(L_.layers.data).forEach((layerName) => {
            const layerObj = L_.layers.data[layerName]

            if (layerObj == null || !Filtering.isFilterable(layerName)) return

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

                // Note: Initial filters will be applied when the layer is first turned on
                // See L_.toggleLayer() for the application logic
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
        }

        const aggs = await Filtering.getAggregations(layerName)
        // null == the type has a filtering strategy but could not answer (a
        // vector layer with no readable GeoJSON); there is nothing to show.
        if (aggs === null) return
        if (aggs !== undefined) Filtering.filters[layerName].aggs = aggs
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

        Filtering.currentContainer = container
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
        OpGridSelector.destroy()

        $('#layersTool_filtering').remove()
    },
    // Re-render the currently open filter panel (if any) to reflect
    // externally applied filter changes (e.g. from the Search component)
    refresh: function () {
        if (
            Filtering.current.layerName &&
            Filtering.currentContainer &&
            $('#layersTool_filtering').length > 0
        ) {
            const layerName = Filtering.current.layerName
            const container = Filtering.currentContainer
            Filtering.destroy()
            Filtering.make(container, layerName)
        }
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
            key = value.key != null ? ` value='${String(value.key).replace(/'/g, "&apos;")}'` : ''
            op = value.op
            val = value.value != null ? ` value='${String(value.value).replace(/'/g, "&apos;")}'` : ''
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
            await Filtering.applyFilter(layerName)

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

        // Operator Grid Selector
        elmId = `#layersTool_filtering_group_operator_${F_.getSafeName(
            layerName
        )}_${id}`

        const ops = ['AND', 'OR', 'NOT_AND', 'NOT_OR']
        const opId = Math.max(ops.indexOf(options.op), 0)

        const groupOpItems = [
            { html: `<div style='font-family: monospace; font-size: 11px; white-space: nowrap;'>AND</div>`, title: 'All Must Match (AND)' },
            { html: `<div style='font-family: monospace; font-size: 11px; white-space: nowrap;'>OR</div>`, title: 'Any May Match (OR)' },
            { html: `<div style='font-family: monospace; font-size: 11px; white-space: nowrap;'>NAND</div>`, title: 'Not All May Match (NOT AND)' },
            { html: `<div style='font-family: monospace; font-size: 11px; white-space: nowrap;'>NOR</div>`, title: 'None Must Match (NOT OR)' },
        ]

        OpGridSelector.init($(elmId), groupOpItems, opId, {
            columns: 4,
            onSelect: function (idx) {
                const newOp = ops[idx]
                Filtering.filters[layerName].values[id].op = newOp
                $(elmId)
                    .removeClass('op_and op_or op_not_and op_not_or')
                    .addClass('op_' + newOp.toLowerCase())
                Filtering.setSubmitButtonState(true)
            },
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

        // Operator Grid Selector
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
            'isnull',
            'isnotnull',
        ]
        const opId = Math.max(ops.indexOf(options.op), 0)

        const valueOpItems = [
            { html: `<i class='mdi mdi-equal mdi-18px'></i>`, title: 'Equals' },
            { html: `<div style='font-family: monospace;'>!=</div>`, title: 'Not Equals' },
            { html: `<div style='font-family: monospace;'>in</div>`, title: 'Comma-separated list' },
            { html: `<i class='mdi mdi-less-than mdi-18px'></i>`, title: 'Less than' },
            { html: `<i class='mdi mdi-greater-than mdi-18px'></i>`, title: 'Greater than' },
            { html: `<i class='mdi mdi-less-than-or-equal mdi-18px'></i>`, title: 'Less than or Equal' },
            { html: `<i class='mdi mdi-greater-than-or-equal mdi-18px'></i>`, title: 'Greater than or Equal' },
            { html: `<i class='mdi mdi-contain mdi-18px'></i>`, title: 'Contains' },
            { html: `<i class='mdi mdi-contain-start mdi-18px'></i>`, title: 'Begins With' },
            { html: `<i class='mdi mdi-contain-end mdi-18px'></i>`, title: 'Ends With' },
            { html: `<i class='mdi mdi-null mdi-18px'></i>`, title: 'Is Null (No Value)' },
            { html: `<i class='mdi mdi-check-circle-outline mdi-18px'></i>`, title: 'Is Not Null (Has Value)' },
        ]

        OpGridSelector.init($(elmId), valueOpItems, opId, {
            columns: 6,
            onSelect: function (idx) {
                Filtering.filters[layerName].values[id].op = ops[idx]
                Filtering.toggleValueInput(id, layerName, ops[idx])
                Filtering.setSubmitButtonState(true)
            },
        })

        // Value AutoComplete
        Filtering.updateValuesAutoComplete(id, layerName)

        // If initial operator is isnull/isnotnull, disable the value input
        if (options.op === 'isnull' || options.op === 'isnotnull') {
            Filtering.toggleValueInput(id, layerName, options.op)
        }
    },
    toggleValueInput: function (id, layerName, operator) {
        const elmId = `#layersTool_filtering_value_value_input_${F_.getSafeName(
            layerName
        )}_${id}`
        if (operator === 'isnull' || operator === 'isnotnull') {
            $(elmId).prop('disabled', true).css('opacity', '0.3').val('')
            Filtering.filters[layerName].values[id].value = ''
        } else {
            $(elmId).prop('disabled', false).css('opacity', '1')
        }
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
        await Filtering.applyFilter(layerName, { source: 'submit' })

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
    // Let other places of the code trigger filters as needed
    triggerFilter: function (layerName) {
        if (Filtering.filters[layerName]) {
            if (Filtering.filters[layerName]?.values?.[0]?.type != null)
                Filtering.applyFilter(layerName, { source: 'trigger' })
        }
    },
    // Useful for dynamicExtent layers so that the data and aggs match the visible features
    updateGeoJSON: async function (layerName) {
        if (Filtering.filters[layerName]) {
            const aggs = await Filtering.getAggregations(layerName, {
                refresh: true,
            })
            if (aggs === null) return
            if (aggs !== undefined) Filtering.filters[layerName].aggs = aggs

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
