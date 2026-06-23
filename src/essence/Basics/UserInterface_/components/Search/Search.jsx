import React, { useState, useEffect, useRef, useCallback } from 'react'
import { center } from '@turf/turf'

import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'

import calls from '../../../../../pre/calls'

import './Search.css'

function makeSearchFields(vars) {
    let searchfields = {}
    for (let layerfield in vars) {
        let fieldString = vars[layerfield]
        fieldString = fieldString.split(')')
        for (let i = 0; i < fieldString.length; i++) {
            fieldString[i] = fieldString[i].split('(')
            const li = fieldString[i][0].lastIndexOf(' ')
            if (li !== -1) {
                fieldString[i][0] = fieldString[i][0].substring(li + 1)
            }
        }
        fieldString.pop()
        searchfields[layerfield] = fieldString
    }
    return searchfields
}

function getSearchFieldStringForFeature(searchFields, name, props) {
    const F_ = require('../../../Formulae_/Formulae_').default
    let str = ''
    if (searchFields.hasOwnProperty(name)) {
        const sf = searchFields[name]
        for (let i = 0; i < sf.length; i++) {
            switch (sf[i][0].toLowerCase()) {
                case '':
                    str += F_.getIn(props, sf[i][1])
                    break
                case 'round':
                    str += Math.round(F_.getIn(props, sf[i][1]))
                    break
                case 'rmunder':
                    if (F_.getIn(props, sf[i][1]))
                        str += F_.getIn(props, sf[i][1]).replace('_', ' ')
                    break
            }
            if (i !== sf.length - 1) str += ' '
        }
    }
    return str
}

function getSearchFieldKeys(searchFields, name) {
    let str = ''
    if (searchFields.hasOwnProperty(name)) {
        const sf = searchFields[name]
        for (let i = 0; i < sf.length; i++) {
            str += sf[i][1]
            str += ' '
        }
    }
    return str.substring(0, str.length - 1)
}

function getMapZoomCoordinate(layers) {
    const zoomLevels = [
        360, 180, 90, 45, 22.5, 11.25, 5.625, 2.813, 1.406, 0.703, 0.352,
        0.176, 0.088, 0.044, 0.022, 0.011, 0.005, 0.003, 0.001, 0.0005,
        0.0003, 0.0001,
    ]
    let boundingBoxNorth = 90
    let boundingBoxSouth = -90
    let boundingBoxEast = 180
    let boundingBoxWest = -180
    const latitudeValidRange = [-90, 90]
    const longitudeValidRange = [-180, 180]

    for (let i = 0; i < layers.length; i++) {
        const centerPt = center(layers[i].feature)?.geometry?.coordinates || [
            -1001, -1001,
        ]
        const latitude = centerPt[1]
        const longitude = centerPt[0]

        if (
            latitude < latitudeValidRange[0] ||
            latitude > latitudeValidRange[1] ||
            longitude < longitudeValidRange[0] ||
            longitude > longitudeValidRange[1]
        ) {
            continue
        }

        if (latitude <= boundingBoxNorth) boundingBoxNorth = latitude
        if (latitude >= boundingBoxSouth) boundingBoxSouth = latitude
        if (longitude <= boundingBoxEast) boundingBoxEast = longitude
        if (longitude >= boundingBoxWest) boundingBoxWest = longitude
    }

    const latitudeDiff = Math.abs(boundingBoxNorth - boundingBoxSouth)
    const longitudeDiff = Math.abs(boundingBoxEast - boundingBoxWest)
    if (latitudeDiff === 0 && longitudeDiff === 0) {
        return {
            latitude: boundingBoxNorth,
            longitude: boundingBoxEast,
            zoomLevel: 21,
        }
    }
    const maxDiff =
        latitudeDiff >= longitudeDiff ? latitudeDiff : longitudeDiff
    for (let i = 0; i < zoomLevels.length; i++) {
        if (maxDiff < zoomLevels[i] && i !== zoomLevels.length - 1) continue
        return {
            latitude:
                boundingBoxSouth + (boundingBoxNorth - boundingBoxSouth) / 2,
            longitude:
                boundingBoxWest + (boundingBoxEast - boundingBoxWest) / 2,
            zoomLevel: i,
        }
    }
}

// Modes for the search bar
const MODE_DEFAULT = 'default' // cross-layer search by display name
const MODE_FIELD = 'field' // search by a specific field across layers
const MODE_LAYER = 'layer' // search scoped to a specific layer

// Operators available per field type — icons match LayersTool Filtering
const STRING_OPS = [
    { value: '=', icon: 'mdi-equal', label: 'Equals' },
    { value: '!=', icon: null, text: '!=', label: 'Not Equals' },
    { value: 'contains', icon: 'mdi-contain', label: 'Contains' },
    { value: 'beginswith', icon: 'mdi-contain-start', label: 'Begins With' },
    { value: 'endswith', icon: 'mdi-contain-end', label: 'Ends With' },
    { value: ',', icon: null, text: 'in', label: 'In List' },
]
const NUMBER_OPS = [
    { value: '=', icon: 'mdi-equal', label: 'Equals' },
    { value: '!=', icon: null, text: '!=', label: 'Not Equals' },
    { value: '<', icon: 'mdi-less-than', label: 'Less Than' },
    { value: '>', icon: 'mdi-greater-than', label: 'Greater Than' },
    { value: '<=', icon: 'mdi-less-than-or-equal', label: 'Less Than or Equal' },
    { value: '>=', icon: 'mdi-greater-than-or-equal', label: 'Greater Than or Equal' },
    { value: ',', icon: null, text: 'in', label: 'In List' },
]

function SearchBar() {
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)
    const [searchFields, setSearchFields] = useState({})
    const [arrayToSearch, setArrayToSearch] = useState([])
    const [placeholder, setPlaceholder] = useState('Search...')
    const [initialized, setInitialized] = useState(false)

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [fieldFilterText, setFieldFilterText] = useState('')

    // Layer dropdown state
    const [layerDropdownOpen, setLayerDropdownOpen] = useState(false)
    const [layerFilterText, setLayerFilterText] = useState('')
    const [checkedLayers, setCheckedLayers] = useState(new Set()) // geodataset names checked in layers dropdown

    // Search mode and selection
    const [searchMode, setSearchMode] = useState(MODE_DEFAULT)
    const [selectedField, setSelectedField] = useState(null) // { name, type, layers }
    const [selectedLayer, setSelectedLayer] = useState(null) // layer uuid
    const [searchOperator, setSearchOperator] = useState('=') // default operator

    // Schema and layer data
    const [schemaFields, setSchemaFields] = useState([]) // [{ name, type, layers }]
    const [geodatasetLayers, setGeodatasetLayers] = useState([]) // [{ value, label, geodatasetName }]
    const [vectorLayers, setVectorLayers] = useState([]) // [{ value, label }]
    const [fieldValues, setFieldValues] = useState([]) // [{ value, count }] autocomplete values for selected field

    const lastGeodatasetLayerName = useRef(null)

    // Pre-search layer state for restore on cancel
    const preSearchLayerState = useRef(null) // { on: { layerName: bool }, filters: { layerName: filterEncoded } }
    const searchFilteredLayers = useRef([]) // layer names that have _filterEncoded applied by search

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const dropdownRef = useRef(null)
    const fieldFilterRef = useRef(null)
    const operatorDropdownRef = useRef(null)
    const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false)
    const layerDropdownRef = useRef(null)
    const layerFilterRef = useRef(null)

    const getL_ = useCallback(() => {
        return require('../../../Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('../../../Map_/Map_').default
    }, [])

    // Save the current layer visibility and filter state (before search modifies it)
    const saveLayerState = useCallback(() => {
        if (preSearchLayerState.current != null) return // already saved
        const L_ = getL_()
        const onState = {}
        const filterState = {}
        for (let lname in L_.layers.on) {
            onState[lname] = L_.layers.on[lname]
        }
        // Save existing _filterEncoded for geodataset layers
        geodatasetLayers.forEach((gl) => {
            const ld = L_.layers.data[gl.value]
            if (ld && ld._filterEncoded) {
                filterState[gl.value] = JSON.parse(
                    JSON.stringify(ld._filterEncoded)
                )
            }
        })
        preSearchLayerState.current = { on: onState, filters: filterState }
    }, [getL_, geodatasetLayers])

    // Restore layer visibility and filter state saved before search
    const restoreLayerState = useCallback(() => {
        if (preSearchLayerState.current == null) return
        const L_ = getL_()
        const { on: savedOn, filters: savedFilters } =
            preSearchLayerState.current

        // Clear search-applied filters
        searchFilteredLayers.current.forEach((layerName) => {
            const ld = L_.layers.data[layerName]
            if (ld) {
                if (savedFilters[layerName]) {
                    ld._filterEncoded = JSON.parse(
                        JSON.stringify(savedFilters[layerName])
                    )
                } else {
                    delete ld._filterEncoded
                }
                L_.Map_.refreshLayer(ld, null, null, true)
            }
        })
        searchFilteredLayers.current = []

        // Restore layer on/off state
        for (let lname in savedOn) {
            const isCurrentlyOn = L_.layers.on[lname] === true
            const shouldBeOn = savedOn[lname] === true
            if (isCurrentlyOn !== shouldBeOn) {
                L_.toggleLayer(L_.layers.data[lname])
            }
        }

        preSearchLayerState.current = null
    }, [getL_])

    // Initialize search when layers are loaded
    useEffect(() => {
        const tryInit = () => {
            const L_ = getL_()
            if (!L_ || !L_.layers || !L_.layers.data) return false

            const searchvars = {}
            const geoLayers = []
            const vecLayers = []

            for (let l in L_.layers.data) {
                if (
                    L_.layers.data[l].variables &&
                    L_.layers.data[l].variables.search
                )
                    searchvars[l] = L_.layers.data[l].variables.search

                if (
                    L_.layers.data[l].url &&
                    L_.layers.data[l].url.startsWith('geodatasets:')
                ) {
                    geoLayers.push({
                        value: l,
                        label: L_.layers.data[l].display_name || l,
                        geodatasetName: L_.layers.data[l].url.split(':')[1],
                    })
                }
            }

            const fields = makeSearchFields(searchvars)
            setSearchFields(fields)

            for (let l in fields) {
                if (
                    L_.layers.data[l] &&
                    (L_.layers.data[l].type === 'vector' ||
                        L_.layers.data[l].type === 'vectortile')
                ) {
                    vecLayers.push({
                        value: l,
                        label: L_.layers.data[l].display_name || l,
                    })
                }
            }

            if (
                Object.keys(searchvars).length === 0 &&
                geoLayers.length === 0
            )
                return false

            setGeodatasetLayers(geoLayers)
            setVectorLayers(vecLayers)
            // Default: all geodataset layers checked
            setCheckedLayers(new Set(geoLayers.map((gl) => gl.geodatasetName)))

            // Fetch bulk schema for geodataset layers
            if (geoLayers.length > 0) {
                const layerNames = geoLayers
                    .map((gl) => gl.geodatasetName)
                    .join(',')
                calls.api(
                    'geodatasets_schema',
                    { layers: layerNames },
                    function (data) {
                        if (data.status === 'success' && data.schema) {
                            const fieldList = Object.keys(data.schema)
                                .map((key) => ({
                                    name: key,
                                    type: data.schema[key].type || 'string',
                                    layers: data.schema[key].layers || [],
                                }))
                                .sort((a, b) => a.name.localeCompare(b.name))
                            setSchemaFields(fieldList)
                        }
                    },
                    function () {}
                )
            }

            // Default: cross-layer search
            setSearchMode(MODE_DEFAULT)
            setPlaceholder('Search features...')

            // URL param search
            if (
                L_.searchStrings != null &&
                L_.searchStrings.length > 0 &&
                L_.searchFile != null
            ) {
                setSelectedLayer(L_.searchFile)
                setSearchMode(MODE_LAYER)
                searchWithURLParams(L_, fields)
            }

            setInitialized(true)
            return true
        }

        if (!tryInit()) {
            const interval = setInterval(() => {
                if (tryInit()) clearInterval(interval)
            }, 500)
            return () => clearInterval(interval)
        }
    }, [getL_])

    // Update array to search + placeholder when in layer mode
    useEffect(() => {
        if (searchMode !== MODE_LAYER || !selectedLayer) {
            return
        }

        const L_ = getL_()
        const Map_ = getMap_()
        if (!Map_ || !L_) return

        const lname = selectedLayer
        const ldata = L_.layers.data[lname]
        if (!ldata) return

        if (L_.layers.on[lname] !== true) {
            L_.toggleLayer(L_.layers.data[lname])
        }

        let data
        try {
            data = L_.layers.layer[lname].toGeoJSON(L_.GEOJSON_PRECISION)
        } catch (err) {
            data = { features: [] }
        }

        const arr = []
        for (let i = 0; i < data.features.length; i++) {
            const props = data.features[i].properties
            arr.push(getSearchFieldStringForFeature(searchFields, lname, props))
        }

        if (arr[0]) {
            if (!isNaN(arr[0])) arr.sort((a, b) => a - b)
            else arr.sort()
        }

        setArrayToSearch(arr)
        setPlaceholder(getSearchFieldKeys(searchFields, lname) || 'Search...')
    }, [searchMode, selectedLayer, searchFields, getL_, getMap_])

    // Filter suggestions based on input (layer mode and field mode)
    useEffect(() => {
        if (searchMode !== MODE_LAYER && searchMode !== MODE_FIELD) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        // In field mode, show all values when input is empty (on focus)
        if (searchMode === MODE_FIELD) {
            if (!inputValue || inputValue.length < 1) {
                const all = fieldValues.slice(0, 100)
                setSuggestions(all)
                setShowSuggestions(all.length > 0)
                setActiveSuggestionIdx(-1)
                return
            }
            const query = inputValue.toLowerCase()
            const filtered = fieldValues
                .filter(
                    (item) =>
                        String(item.value)
                            .toLowerCase()
                            .indexOf(query) !== -1
                )
                .slice(0, 100)
            filtered.sort((a, b) => {
                const aIdx = String(a.value).toLowerCase().indexOf(query)
                const bIdx = String(b.value).toLowerCase().indexOf(query)
                if (aIdx !== bIdx) return aIdx - bIdx
                return a.value > b.value ? 1 : -1
            })
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
            setActiveSuggestionIdx(-1)
            return
        }

        // Layer mode
        if (!inputValue || inputValue.length < 1) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }
        const query = inputValue.toLowerCase()
        const filtered = arrayToSearch
            .filter((item) => String(item).toLowerCase().indexOf(query) !== -1)
            .slice(0, 100)
        filtered.sort((a, b) => {
            const aIdx = String(a).toLowerCase().indexOf(query)
            const bIdx = String(b).toLowerCase().indexOf(query)
            if (aIdx !== bIdx) return aIdx - bIdx
            return a > b ? 1 : -1
        })
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
        setActiveSuggestionIdx(-1)
    }, [inputValue, arrayToSearch, fieldValues, searchMode])

    // Close dropdown and suggestions on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target) &&
                inputRef.current &&
                !inputRef.current.contains(e.target)
            ) {
                setShowSuggestions(false)
            }
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setDropdownOpen(false)
            }
            if (
                operatorDropdownRef.current &&
                !operatorDropdownRef.current.contains(e.target)
            ) {
                setOperatorDropdownOpen(false)
            }
            if (
                layerDropdownRef.current &&
                !layerDropdownRef.current.contains(e.target)
            ) {
                setLayerDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const searchWithURLParams = useCallback(
        (L_, fields) => {
            doWithSearch(
                'both',
                L_.searchStrings,
                L_.searchFile,
                true,
                null,
                fields,
                L_
            )
        },
        []
    )

    const searchGeodatasets = useCallback(
        (lname, value) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const layerName = lname || selectedLayer
            const searchValue = value || inputValue

            let key =
                searchFields[layerName] && searchFields[layerName][0]
                    ? searchFields[layerName][0][1]
                    : null
            if (key == null) return

            const geodatasetName =
                L_.layers.data[layerName]?.url?.split(':')[1]

            calls.api(
                'geodatasets_search',
                {
                    layer:
                        geodatasetName || lastGeodatasetLayerName.current,
                    key: key,
                    value: searchValue,
                },
                function (d) {
                    if (!d.body || d.body.length === 0) return
                    const r = d.body[0]

                    let selectTimeout = setTimeout(() => {
                        L_.layers.layer[layerName].off('load')
                        selectFeature()
                    }, 1500)

                    L_.layers.layer[layerName].on('load', function () {
                        L_.layers.layer[layerName].off('load')
                        clearTimeout(selectTimeout)
                        selectFeature()
                    })

                    const c = center(r)
                    const coords = c.geometry.coordinates
                    Map_.map.setView(
                        [coords[1], coords[0]],
                        Map_.mapScaleZoom || Map_.map.getZoom()
                    )
                    if (!L_.layers.on[layerName]) {
                        L_.toggleLayer(L_.layers.data[layerName])
                    }

                    function selectFeature() {
                        const vts = L_.layers.layer[layerName]._vectorTiles
                        for (let i in vts) {
                            for (let j in vts[i]._features) {
                                const feature = vts[i]._features[j].feature
                                if (feature.properties[key] === searchValue) {
                                    feature._layerName =
                                        vts[i].options.layerName
                                    feature._layer = feature
                                    L_.layers.layer[layerName]._events
                                        .click[0].fn({
                                        layer: feature,
                                        sourceTarget: feature,
                                    })
                                    return
                                }
                            }
                        }
                    }
                },
                function () {}
            )
        },
        [selectedLayer, inputValue, searchFields, getL_, getMap_]
    )

    // Cross-layer search by display name (default mode)
    const searchCrossLayer = useCallback(
        (value) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const query = (value || inputValue).trim().toLowerCase()
            if (!query) return

            // Search across all layers that have search fields
            const allMatches = []
            for (let lname in searchFields) {
                const markers = L_.layers.layer[lname]
                if (!markers || typeof markers.eachLayer !== 'function')
                    continue

                if (!L_.layers.on[lname]) continue

                markers.eachLayer((layer) => {
                    const props = layer.feature.properties
                    const comparer = getSearchFieldStringForFeature(
                        searchFields,
                        lname,
                        props
                    )
                    if (comparer.toLowerCase().indexOf(query) !== -1) {
                        allMatches.push({ layer, lname })
                    }
                })
            }

            if (allMatches.length > 0) {
                L_.resetLayerFills()

                allMatches.forEach(({ layer }) => {
                    L_.highlight(layer)
                    if (typeof layer.bringToFront === 'function')
                        layer.bringToFront()
                })

                if (allMatches.length === 1) {
                    allMatches[0].layer.fireEvent('click')
                }

                const gotoLayers = allMatches.map(({ layer }) => layer)
                const coordinate = getMapZoomCoordinate(gotoLayers)
                if (coordinate) {
                    Map_.map.setView(
                        [coordinate.latitude, coordinate.longitude],
                        Map_.mapScaleZoom || Map_.map.getZoom()
                    )
                }
            }

        },
        [inputValue, searchFields, getL_, getMap_]
    )

    // Search by selected field across all geodataset layers that have it
    // - Saves layer state, applies filter to matching layers, turns off non-matching,
    //   pans to fit all results
    const searchByField = useCallback(
        (value) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const searchValue = (value || inputValue).trim()
            if (!searchValue || !selectedField) return

            const fieldName = selectedField.name
            const fieldLayers = selectedField.layers
            const fieldType = selectedField.type || 'string'

            // Save layer state before modifying anything
            saveLayerState()

            // Clear any previous search filters
            searchFilteredLayers.current.forEach((layerName) => {
                const ld = L_.layers.data[layerName]
                if (ld && ld._filterEncoded) {
                    delete ld._filterEncoded.filters
                }
            })
            searchFilteredLayers.current = []

            // All geodataset layers that could have this field AND are checked
            const candidateLayers = geodatasetLayers.filter(
                (gl) =>
                    fieldLayers.includes(gl.geodatasetName) &&
                    checkedLayers.has(gl.geodatasetName)
            )
            if (candidateLayers.length === 0) return

            // Build the filter string: fieldName+op+type+value
            // Map frontend operator names to filterEncoded format
            const opMap = { ',': 'in', 'contains': 'contains', 'beginswith': 'beginswith', 'endswith': 'endswith' }
            const filterOp = opMap[searchOperator] || searchOperator
            const filterEncoded = `${fieldName}+${filterOp}+${fieldType}+${searchValue.replaceAll(',', '$')}`

            // Track which layers have hits via search API, then pan to fit all
            let pendingSearches = candidateLayers.length
            const allResultCoords = []
            const layersWithHits = new Set()

            candidateLayers.forEach((gl) => {
                const layerName = gl.value

                // Apply filter to layer so only matching features render
                if (!L_.layers.data[layerName]._filterEncoded) {
                    L_.layers.data[layerName]._filterEncoded = {}
                }
                L_.layers.data[layerName]._filterEncoded.filters =
                    filterEncoded
                searchFilteredLayers.current.push(layerName)

                // Search to check if this layer has any matching features
                calls.api(
                    'geodatasets_search',
                    {
                        layer: gl.geodatasetName,
                        key: fieldName,
                        value: searchValue,
                        operator: searchOperator,
                    },
                    function (d) {
                        if (d.body && d.body.length > 0) {
                            layersWithHits.add(layerName)
                            d.body.forEach((r) => {
                                try {
                                    const c = center(r)
                                    allResultCoords.push(
                                        c.geometry.coordinates
                                    )
                                } catch (e) {
                                    // skip invalid geometries
                                }
                            })
                        }

                        pendingSearches--
                        if (pendingSearches <= 0) {
                            applySearchResults()
                        }
                    },
                    function () {
                        pendingSearches--
                        if (pendingSearches <= 0) {
                            applySearchResults()
                        }
                    }
                )
            })

            function applySearchResults() {
                // Turn on layers with hits, turn off those without
                candidateLayers.forEach((gl) => {
                    const layerName = gl.value
                    const hasHits = layersWithHits.has(layerName)
                    const isOn = L_.layers.on[layerName] === true

                    if (hasHits && !isOn) {
                        L_.toggleLayer(L_.layers.data[layerName])
                    } else if (!hasHits && isOn) {
                        L_.toggleLayer(L_.layers.data[layerName])
                    }

                    // Refresh filtered layers that are on
                    if (hasHits) {
                        L_.Map_.refreshLayer(
                            L_.layers.data[layerName],
                            null,
                            null,
                            true
                        )
                    }
                })

                // Turn off all other visible vector layers (not just geodatasets)
                for (let lname in L_.layers.on) {
                    if (
                        L_.layers.on[lname] === true &&
                        !layersWithHits.has(lname) &&
                        L_.layers.data[lname]
                    ) {
                        const ltype = L_.layers.data[lname].type
                        if (
                            ltype === 'vector' ||
                            ltype === 'vectortile'
                        ) {
                            L_.toggleLayer(L_.layers.data[lname])
                        }
                    }
                }

                // Pan to fit all results
                if (allResultCoords.length > 0) {
                    if (allResultCoords.length === 1) {
                        Map_.map.setView(
                            [allResultCoords[0][1], allResultCoords[0][0]],
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
                    } else {
                        const lats = allResultCoords.map((c) => c[1])
                        const lngs = allResultCoords.map((c) => c[0])
                        const bounds = [
                            [Math.min(...lats), Math.min(...lngs)],
                            [Math.max(...lats), Math.max(...lngs)],
                        ]
                        Map_.map.fitBounds(bounds, { padding: [40, 40] })
                    }
                }
            }
        },
        [
            inputValue,
            selectedField,
            searchOperator,
            geodatasetLayers,
            checkedLayers,
            saveLayerState,
            getL_,
            getMap_,
        ]
    )

    const doWithSearch = useCallback(
        (
            doX,
            forceX,
            forceSTS,
            isURLSearch,
            value,
            fieldsOverride,
            L_Override
        ) => {
            const L_ = L_Override || getL_()
            const Map_ = getMap_()
            const fields = fieldsOverride || searchFields
            const lname = forceSTS || selectedLayer

            let x
            if (forceX == null && !isURLSearch) {
                x = value != null ? [value] : [inputValue]
            } else if (forceX == null && isURLSearch) {
                x = L_.searchStrings
            } else {
                x = forceX
            }

            const markers = L_.layers.layer[lname]

            if (!L_.layers.on[lname]) {
                L_.toggleLayer(L_.layers.data[lname])
            }

            const selectLayers = []
            const gotoLayers = []

            if (doX === 'both' || doX === 'select') {
                L_.resetLayerFills()
            }

            if (markers != null && typeof markers.eachLayer === 'function') {
                markers.eachLayer((layer) => {
                    const props = layer.feature.properties
                    let shouldSearch = false
                    const comparer = getSearchFieldStringForFeature(
                        fields,
                        lname,
                        props
                    )

                    for (let i = 0; i < x.length; i++) {
                        if (
                            x.length === 1
                                ? x[i].toLowerCase() ===
                                  comparer.toLowerCase()
                                : x[i]
                                      .toLowerCase()
                                      .indexOf(comparer.toLowerCase()) > -1 ||
                                  comparer
                                      .toLowerCase()
                                      .indexOf(x[i].toLowerCase()) > -1
                        ) {
                            shouldSearch = true
                            break
                        }
                    }

                    if (shouldSearch) {
                        if (doX === 'both' || doX === 'select')
                            selectLayers.push(layer)
                        if (doX === 'both' || doX === 'goto')
                            gotoLayers.push(layer)
                    }
                })

                if (selectLayers.length === 1) {
                    L_.highlight(selectLayers[0])
                    selectLayers[0].fireEvent('click')
                    if (typeof selectLayers[0].bringToFront === 'function')
                        selectLayers[0].bringToFront()
                } else if (selectLayers.length > 1) {
                    for (let i = 0; i < selectLayers.length; i++) {
                        L_.highlight(selectLayers[i])
                        if (
                            typeof selectLayers[i].bringToFront === 'function'
                        )
                            selectLayers[i].bringToFront()
                    }
                }

                if (gotoLayers.length > 0) {
                    const coordinate = getMapZoomCoordinate(gotoLayers)
                    if (coordinate) {
                        Map_.map.setView(
                            [coordinate.latitude, coordinate.longitude],
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
                    }
                }
            }
        },
        [selectedLayer, inputValue, searchFields, getL_, getMap_]
    )

    const handleSearch = useCallback(
        (value) => {
            if (searchMode === MODE_DEFAULT) {
                searchCrossLayer(value)
                return
            }

            if (searchMode === MODE_FIELD) {
                searchByField(value)
                return
            }

            // MODE_LAYER
            const L_ = getL_()
            const ltype = L_.layers.data[selectedLayer]?.type

            if (ltype === 'vectortile') {
                searchGeodatasets(selectedLayer, value)
            } else {
                doWithSearch('both', null, null, false, value)
            }
        },
        [
            searchMode,
            selectedLayer,
            searchCrossLayer,
            searchByField,
            searchGeodatasets,
            doWithSearch,
            getL_,
        ]
    )

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') {
                if (
                    activeSuggestionIdx >= 0 &&
                    suggestions[activeSuggestionIdx]
                ) {
                    const sel = suggestions[activeSuggestionIdx]
                    const val =
                        sel != null &&
                        typeof sel === 'object' &&
                        sel.value != null
                            ? String(sel.value)
                            : String(sel)
                    setInputValue(val)
                    setShowSuggestions(false)
                    handleSearch(val)
                } else {
                    setShowSuggestions(false)
                    handleSearch()
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveSuggestionIdx((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                )
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveSuggestionIdx((prev) => (prev > 0 ? prev - 1 : -1))
            } else if (e.key === 'Escape') {
                setShowSuggestions(false)
            }
        },
        [suggestions, activeSuggestionIdx, handleSearch]
    )

    const handleSuggestionClick = useCallback(
        (item) => {
            const val =
                item != null && typeof item === 'object' && item.value != null
                    ? String(item.value)
                    : String(item)
            setInputValue(val)
            setShowSuggestions(false)
            handleSearch(val)
        },
        [handleSearch]
    )

    const handleClear = useCallback(() => {
        restoreLayerState()
        setInputValue('')
        setSuggestions([])
        setShowSuggestions(false)
        setFieldValues([])
        // Reset to default mode
        setSearchMode(MODE_DEFAULT)
        setSelectedField(null)
        setSelectedLayer(null)
        setSearchOperator('=')
        setPlaceholder('Search features...')
        setArrayToSearch([])
    }, [restoreLayerState])


    // Field selection from dropdown
    const handleFieldSelect = useCallback(
        (field) => {
            setSearchMode(MODE_FIELD)
            setSelectedField(field)
            setSelectedLayer(null)
            setInputValue('')
            setFieldValues([])
            setSearchOperator('=')
            setPlaceholder(`Search by ${field.name}...`)
            setDropdownOpen(false)
            setFieldFilterText('')
            // Focus the input after selecting
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus()
            }, 50)

            // Fetch field values via bulk aggregations
            if (field.layers && field.layers.length > 0) {
                calls.api(
                    'geodatasets_bulk_aggregations',
                    { layers: field.layers.join(',') },
                    function (data) {
                        if (
                            data.status === 'success' &&
                            data.aggregations &&
                            data.aggregations[field.name] &&
                            data.aggregations[field.name].aggs
                        ) {
                            const aggs =
                                data.aggregations[field.name].aggs
                            const fieldType =
                                data.aggregations[field.name].type
                            const keys = Object.keys(aggs)
                            if (fieldType === 'number') {
                                keys.sort(
                                    (a, b) =>
                                        parseFloat(a) - parseFloat(b)
                                )
                            } else {
                                keys.sort()
                            }
                            const vals = keys.map((v) => ({
                                value: v,
                                count: aggs[v],
                            }))
                            setFieldValues(vals)
                        }
                    },
                    function () {}
                )
            }
        },
        []
    )

    // Toggle a layer in the layers dropdown
    const handleLayerToggle = useCallback((geodatasetName) => {
        setCheckedLayers((prev) => {
            const next = new Set(prev)
            if (next.has(geodatasetName)) {
                next.delete(geodatasetName)
            } else {
                next.add(geodatasetName)
            }
            return next
        })
    }, [])

    const handleLayerSelectAll = useCallback(() => {
        setCheckedLayers(new Set(geodatasetLayers.map((gl) => gl.geodatasetName)))
    }, [geodatasetLayers])

    const handleLayerDeselectAll = useCallback(() => {
        setCheckedLayers(new Set())
    }, [])

    // Remove selected field chip to go back to default — restores layer state
    const handleRemoveChip = useCallback(() => {
        restoreLayerState()
        setSearchMode(MODE_DEFAULT)
        setSelectedField(null)
        setSelectedLayer(null)
        setSearchOperator('=')
        setInputValue('')
        setFieldValues([])
        setPlaceholder('Search features...')
        setArrayToSearch([])
    }, [restoreLayerState])

    const toggleDropdown = useCallback(() => {
        setDropdownOpen((prev) => {
            const next = !prev
            if (next) {
                setFieldFilterText('')
                setTimeout(() => {
                    if (fieldFilterRef.current) fieldFilterRef.current.focus()
                }, 50)
            }
            return next
        })
    }, [])

    const toggleLayerDropdown = useCallback(() => {
        setLayerDropdownOpen((prev) => {
            const next = !prev
            if (next) {
                setLayerFilterText('')
                setTimeout(() => {
                    if (layerFilterRef.current) layerFilterRef.current.focus()
                }, 50)
            }
            return next
        })
    }, [])

    // Get display name for layer given its geodataset table name
    const getLayerDisplayName = useCallback(
        (geodatasetName) => {
            const gl = geodatasetLayers.find(
                (l) => l.geodatasetName === geodatasetName
            )
            return gl ? gl.label : geodatasetName
        },
        [geodatasetLayers]
    )

    // Filtered field list for dropdown — filter by checked layers + text filter
    const layerFilteredFields = checkedLayers.size > 0
        ? schemaFields.filter((f) =>
              f.layers.some((l) => checkedLayers.has(l))
          )
        : schemaFields
    const filteredFields = fieldFilterText
        ? layerFilteredFields.filter(
              (f) =>
                  f.name
                      .toLowerCase()
                      .indexOf(fieldFilterText.toLowerCase()) !== -1
          )
        : layerFilteredFields

    // Filtered layer list for layer dropdown
    const filteredLayerList = layerFilterText
        ? geodatasetLayers.filter(
              (l) =>
                  l.label.toLowerCase().indexOf(layerFilterText.toLowerCase()) !== -1
          )
        : geodatasetLayers

    if (!initialized) return null

    const chipLabel =
        searchMode === MODE_FIELD && selectedField
            ? selectedField.name
            : null

    // Layer dropdown summary label
    const allLayersChecked = checkedLayers.size === geodatasetLayers.length
    const layerCountLabel = allLayersChecked
        ? 'All'
        : checkedLayers.size === 0
        ? 'None'
        : `${checkedLayers.size}`

    return (
        <div id="Search" className="searchBar">
            {/* Layers dropdown */}
            <div className="searchDropdownContainer" ref={layerDropdownRef}>
                <button
                    className="searchDropdownTrigger"
                    onClick={toggleLayerDropdown}
                    aria-expanded={layerDropdownOpen}
                    title="Select layers"
                >
                    <i className="mdi mdi-layers mdi-14px" />
                    <span className="searchDropdownTriggerLabel">{layerCountLabel}</span>
                    <i
                        className={`mdi mdi-chevron-${
                            layerDropdownOpen ? 'up' : 'down'
                        } mdi-14px`}
                    />
                </button>

                {layerDropdownOpen && (
                    <div className="searchDropdownPanel">
                        <div className="searchDropdownSection">
                            <div className="searchDropdownSectionHeader">
                                <span>Layers</span>
                                <span className="searchDropdownHeaderActions">
                                    <span
                                        className="searchDropdownHeaderAction"
                                        onClick={handleLayerSelectAll}
                                    >
                                        All
                                    </span>
                                    <span className="searchDropdownHeaderSep">/</span>
                                    <span
                                        className="searchDropdownHeaderAction"
                                        onClick={handleLayerDeselectAll}
                                    >
                                        None
                                    </span>
                                </span>
                            </div>
                            <div className="searchDropdownFieldFilter">
                                <input
                                    ref={layerFilterRef}
                                    type="text"
                                    className="searchDropdownFieldFilterInput"
                                    placeholder="Filter layers..."
                                    value={layerFilterText}
                                    onChange={(e) =>
                                        setLayerFilterText(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="searchDropdownLayerList">
                                {filteredLayerList.map((layer) => (
                                    <label
                                        key={layer.value}
                                        className="searchDropdownLayerCheckItem"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checkedLayers.has(layer.geodatasetName)}
                                            onChange={() =>
                                                handleLayerToggle(layer.geodatasetName)
                                            }
                                        />
                                        <span className="searchDropdownLayerCheckLabel">
                                            {layer.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Fields dropdown */}
            <div className="searchDropdownContainer" ref={dropdownRef}>
                <button
                    className="searchDropdownTrigger"
                    onClick={toggleDropdown}
                    aria-expanded={dropdownOpen}
                    title="Select field"
                >
                    <i className="mdi mdi-form-textbox mdi-14px" />
                    <span className="searchDropdownTriggerLabel">
                        {selectedField ? selectedField.name : 'Field'}
                    </span>
                    <i
                        className={`mdi mdi-chevron-${
                            dropdownOpen ? 'up' : 'down'
                        } mdi-14px`}
                    />
                </button>

                {dropdownOpen && (
                    <div className="searchDropdownPanel">
                        <div className="searchDropdownSection">
                            <div className="searchDropdownSectionHeader">
                                Search by Field
                            </div>
                            <div className="searchDropdownFieldFilter">
                                <input
                                    ref={fieldFilterRef}
                                    type="text"
                                    className="searchDropdownFieldFilterInput"
                                    placeholder="Filter fields..."
                                    value={fieldFilterText}
                                    onChange={(e) =>
                                        setFieldFilterText(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="searchDropdownFieldList">
                                {filteredFields.length === 0 && (
                                    <div className="searchDropdownEmpty">
                                        {schemaFields.length === 0
                                            ? 'Loading fields...'
                                            : 'No matching fields'}
                                    </div>
                                )}
                                {filteredFields.slice(0, 200).map((field) => (
                                    <div
                                        key={field.name}
                                        className="searchDropdownFieldItem"
                                        onClick={() =>
                                            handleFieldSelect(field)
                                        }
                                    >
                                        <span className="searchDropdownFieldName">
                                            {field.name}
                                        </span>
                                        <span className="searchDropdownFieldType" data-type={field.type}>
                                            {field.type}
                                        </span>
                                        <span className="searchDropdownFieldLayers">
                                            {field.layers
                                                .slice(0, 2)
                                                .map((l) =>
                                                    getLayerDisplayName(l)
                                                )
                                                .join(', ')}
                                            {field.layers.length > 2
                                                ? ` +${
                                                      field.layers.length - 2
                                                  }`
                                                : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Chip for selected field or layer */}
            {chipLabel && (
                <div className="searchChip">
                    <span className="searchChipLabel">{chipLabel}</span>
                    <span
                        className="searchChipRemove"
                        onClick={handleRemoveChip}
                    >
                        <i className="mdi mdi-close mdi-12px" />
                    </span>
                </div>
            )}

            {/* Operator dropdown (field mode only) */}
            {searchMode === MODE_FIELD && selectedField && (() => {
                const ops = selectedField.type === 'number' ? NUMBER_OPS : STRING_OPS
                const activeOp = ops.find((o) => o.value === searchOperator) || ops[0]
                return (
                    <div className="searchOperatorContainer" ref={operatorDropdownRef}>
                        <button
                            className="searchOperatorTrigger"
                            onClick={() => setOperatorDropdownOpen((p) => !p)}
                            title={activeOp.label}
                        >
                            {activeOp.icon ? (
                                <i className={`mdi ${activeOp.icon} mdi-14px`} />
                            ) : (
                                <span className="searchOperatorText">{activeOp.text}</span>
                            )}
                        </button>
                        {operatorDropdownOpen && (
                            <div className="searchOperatorDropdown">
                                {ops.map((op) => (
                                    <div
                                        key={op.value}
                                        className={`searchOperatorItem ${
                                            op.value === searchOperator
                                                ? 'searchOperatorItemActive'
                                                : ''
                                        }`}
                                        onClick={() => {
                                            setSearchOperator(op.value)
                                            setOperatorDropdownOpen(false)
                                        }}
                                    >
                                        <span className="searchOperatorItemIcon">
                                            {op.icon ? (
                                                <i className={`mdi ${op.icon} mdi-14px`} />
                                            ) : (
                                                <span className="searchOperatorText">{op.text}</span>
                                            )}
                                        </span>
                                        <span className="searchOperatorItemLabel">{op.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Main search input */}
            <div className="searchInputWrapper">
                <input
                    ref={inputRef}
                    className="topBarSearch"
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (searchMode === MODE_FIELD && fieldValues.length > 0) {
                            const all = fieldValues.slice(0, 100)
                            setSuggestions(all)
                            setShowSuggestions(true)
                        } else if (suggestions.length > 0) {
                            setShowSuggestions(true)
                        }
                    }}
                    tabIndex={401}
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="searchSuggestions" ref={suggestionsRef}>
                        {suggestions.map((s, idx) => {
                            const isObj =
                                s != null &&
                                typeof s === 'object' &&
                                s.value != null
                            const label = isObj
                                ? String(s.value)
                                : String(s)
                            return (
                                <div
                                    key={idx}
                                    className={`searchSuggestionItem ${
                                        idx === activeSuggestionIdx
                                            ? 'searchSuggestionItemActive'
                                            : ''
                                    }`}
                                    onMouseDown={() =>
                                        handleSuggestionClick(s)
                                    }
                                    onMouseEnter={() =>
                                        setActiveSuggestionIdx(idx)
                                    }
                                >
                                    <span className="searchSuggestionLabel">
                                        {label}
                                    </span>
                                    {isObj && s.count != null && (
                                        <span className="searchSuggestionCount">
                                            {s.count}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            <Tooltip content="Clear search" placement="bottom">
                <IconButton
                    className="searchClearBtn"
                    onClick={handleClear}
                    size="sm"
                >
                    <i className="mdi mdi-close mdi-18px" />
                </IconButton>
            </Tooltip>
            <Tooltip content="Search" placement="bottom">
                <IconButton
                    className="searchGoBtn"
                    onClick={() => handleSearch()}
                    size="sm"
                >
                    <i className="mdi mdi-magnify mdi-18px" />
                </IconButton>
            </Tooltip>

        </div>
    )
}

// Static compatibility properties
SearchBar.height = 43
SearchBar.width = 700

export { makeSearchFields }
export default SearchBar
