import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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

// All supported operators for the :field:op:value syntax
const ALL_OPS = [
    { value: '=', label: 'Equals', symbol: '=' },
    { value: '!=', label: 'Not Equals', symbol: '!=' },
    { value: '<', label: 'Less Than', symbol: '<' },
    { value: '>', label: 'Greater Than', symbol: '>' },
    { value: '<=', label: 'Less Than or Equal', symbol: '<=' },
    { value: '>=', label: 'Greater Than or Equal', symbol: '>=' },
    { value: '*=', label: 'Contains', symbol: '*=' },
    { value: '^=', label: 'Begins With', symbol: '^=' },
    { value: '$=', label: 'Ends With', symbol: '$=' },
    { value: '~=', label: 'Regex Match', symbol: '~=' },
    { value: 'in', label: 'In List (comma-separated)', symbol: 'in' },
    { value: 'isnull', label: 'Is Null', symbol: 'isnull' },
    { value: 'isnotnull', label: 'Is Not Null', symbol: 'isnotnull' },
]

// Map op symbols to backend operator values
const OP_TO_BACKEND = {
    '=': '=',
    '!=': '!=',
    '<': '<',
    '>': '>',
    '<=': '<=',
    '>=': '>=',
    '*=': 'contains',
    '^=': 'beginswith',
    '$=': 'endswith',
    '~=': 'regex',
    'in': ',',
    'isnull': 'isnull',
    'isnotnull': 'isnotnull',
}

// Autocomplete stages for the structured query
const STAGE_FIELD = 'field'
const STAGE_OP = 'op'
const STAGE_VALUE = 'value'

function parseColonQuery(text) {
    if (!text.startsWith(':')) return null
    const content = text.substring(1)
    const parts = content.split(':')
    if (parts.length === 1) {
        return { stage: STAGE_FIELD, field: parts[0], op: null, value: null }
    }
    if (parts.length === 2) {
        return { stage: STAGE_OP, field: parts[0], op: parts[1], value: null }
    }
    // parts.length >= 3: value may contain colons
    return {
        stage: STAGE_VALUE,
        field: parts[0],
        op: parts[1],
        value: parts.slice(2).join(':'),
    }
}

function SearchBar() {
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)
    const [submittedValue, setSubmittedValue] = useState(null)
    const [searchFields, setSearchFields] = useState({})
    const [arrayToSearch, setArrayToSearch] = useState([])
    const [placeholder, setPlaceholder] = useState('Search...')
    const [initialized, setInitialized] = useState(false)

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false)

    // Layer selection (regular mode)
    const [selectedLayer, setSelectedLayer] = useState(null)

    // Schema for structured queries
    const [schemaFields, setSchemaFields] = useState([])
    const [geodatasetLayers, setGeodatasetLayers] = useState([])
    const [vectorSearchLayers, setVectorSearchLayers] = useState([])
    const [vectorLayers, setVectorLayers] = useState([])
    const [fieldValues, setFieldValues] = useState([])

    // Search groups: { groupId: { label, layers: [...] } }
    const [searchGroups, setSearchGroups] = useState({})

    // Help modal
    const [helpOpen, setHelpOpen] = useState(false)

    const lastGeodatasetLayerName = useRef(null)
    const vectorLayerCache = useRef({})
    const vectorSchemaRef = useRef({})
    const geodatasetSchemaRef = useRef([])

    // Pre-search layer state for restore on cancel
    const preSearchLayerState = useRef(null)
    const searchFilteredLayers = useRef([])
    const regModeToggledLayer = useRef(null)
    const vectorFilteredLayers = useRef({})

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const panelRef = useRef(null)
    const helpRef = useRef(null)

    const getL_ = useCallback(() => {
        return require('../../../Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('../../../Map_/Map_').default
    }, [])
    const getF_ = useCallback(() => {
        return require('../../../Formulae_/Formulae_').default
    }, [])

    // Discover schema from GeoJSON features
    const discoverVectorSchema = useCallback((geojson, layerName) => {
        const features = geojson.features || []
        const fieldMap = {}
        const sampleSize = Math.min(features.length, 50)

        const walkProps = (obj, prefix) => {
            for (const key in obj) {
                const fullKey = prefix ? `${prefix}.${key}` : key
                const val = obj[key]
                if (val != null && typeof val === 'object' && !Array.isArray(val)) {
                    walkProps(val, fullKey)
                } else {
                    if (!fieldMap[fullKey]) fieldMap[fullKey] = { types: new Set(), count: 0 }
                    let t = 'string'
                    if (typeof val === 'number') t = 'number'
                    else if (typeof val === 'boolean') t = 'boolean'
                    else if (Array.isArray(val)) t = 'array'
                    fieldMap[fullKey].types.add(t)
                    fieldMap[fullKey].count++
                }
            }
        }

        for (let i = 0; i < sampleSize; i++) {
            if (features[i].properties) walkProps(features[i].properties, '')
        }

        const schema = {}
        for (const fk in fieldMap) {
            const types = fieldMap[fk].types
            let type = 'string'
            if (types.has('number') && !types.has('string')) type = 'number'
            else if (types.has('boolean') && types.size === 1) type = 'boolean'
            schema[fk] = { type, layers: [layerName] }
        }
        return schema
    }, [])

    // Merge vector schema into the ref and rebuild schemaFields
    const rebuildMergedSchema = useCallback((geodatasetSchemaFields) => {
        const merged = {}
        ;(geodatasetSchemaFields || []).forEach((f) => {
            merged[f.name] = { type: f.type, layers: [...f.layers] }
        })
        for (const fieldName in vectorSchemaRef.current) {
            const vs = vectorSchemaRef.current[fieldName]
            if (merged[fieldName]) {
                vs.layers.forEach((l) => {
                    if (!merged[fieldName].layers.includes(l))
                        merged[fieldName].layers.push(l)
                })
                if (merged[fieldName].type === 'number' && vs.type === 'string')
                    merged[fieldName].type = vs.type
            } else {
                merged[fieldName] = { type: vs.type, layers: [...vs.layers] }
            }
        }
        const fieldList = Object.keys(merged)
            .map((key) => ({
                name: key,
                type: merged[key].type,
                layers: merged[key].layers,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        setSchemaFields(fieldList)
    }, [])

    const mergeVectorSchemaForLayer = useCallback((schema, layerName) => {
        for (const fk in schema) {
            if (vectorSchemaRef.current[fk]) {
                if (!vectorSchemaRef.current[fk].layers.includes(layerName))
                    vectorSchemaRef.current[fk].layers.push(layerName)
            } else {
                vectorSchemaRef.current[fk] = schema[fk]
            }
        }
        rebuildMergedSchema(geodatasetSchemaRef.current)
    }, [rebuildMergedSchema])

    // Fetch and cache GeoJSON for a vector layer
    const loadVectorLayerData = useCallback(
        (layerName) => {
            const L_ = getL_()
            const layerData = L_.layers.data[layerName]
            if (!layerData) return
            if (vectorLayerCache.current[layerName]) return

            if (L_.layers.layer[layerName] && L_.layers.layer[layerName] !== false) {
                try {
                    const geojson = L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                    vectorLayerCache.current[layerName] = geojson
                    const schema = discoverVectorSchema(geojson, layerName)
                    mergeVectorSchemaForLayer(schema, layerName)
                    return
                } catch (e) { /* fall through */ }
            }

            let url = layerData.url
            if (!url) return
            const F_ = getF_()
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url

            fetch(url)
                .then((res) => res.json())
                .then((data) => {
                    const F2_ = require('../../../Formulae_/Formulae_').default
                    const geojson = F2_.parseIntoGeoJSON(data)
                    if (!geojson || !geojson.features) return
                    vectorLayerCache.current[layerName] = geojson
                    const schema = discoverVectorSchema(geojson, layerName)
                    mergeVectorSchemaForLayer(schema, layerName)
                })
                .catch(() => {})
        },
        [getL_, getF_, discoverVectorSchema, mergeVectorSchemaForLayer]
    )

    // Save the current layer visibility state (before search modifies it)
    const saveLayerState = useCallback(() => {
        if (preSearchLayerState.current != null) return
        const L_ = getL_()
        const onState = {}
        for (let lname in L_.layers.on) {
            onState[lname] = L_.layers.on[lname]
        }
        const filterState = {}
        geodatasetLayers.forEach((gl) => {
            const ld = L_.layers.data[gl.value]
            if (ld && ld._filterEncoded) {
                filterState[gl.value] = JSON.parse(JSON.stringify(ld._filterEncoded))
            }
        })
        preSearchLayerState.current = { on: onState, filters: filterState }
    }, [getL_, geodatasetLayers])

    // Restore layer visibility and filter state
    const restoreLayerState = useCallback(() => {
        if (preSearchLayerState.current == null) return
        const L_ = getL_()
        const { on: savedOn, filters: savedFilters } = preSearchLayerState.current

        searchFilteredLayers.current.forEach((layerName) => {
            const ld = L_.layers.data[layerName]
            if (ld) {
                if (savedFilters[layerName]) {
                    ld._filterEncoded = JSON.parse(JSON.stringify(savedFilters[layerName]))
                } else {
                    delete ld._filterEncoded
                }
                L_.Map_.refreshLayer(ld, null, null, true)
            }
        })
        searchFilteredLayers.current = []

        for (const lname in vectorFilteredLayers.current) {
            const origGeoJSON = vectorFilteredLayers.current[lname]
            if (origGeoJSON && L_.layers.layer[lname] && L_.layers.layer[lname] !== false) {
                L_.clearVectorLayer(lname)
                L_.updateVectorLayer(lname, origGeoJSON)
            }
        }
        vectorFilteredLayers.current = {}

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
            const vecSearchLayers = []
            const groups = {}

            const buildPath = (l) => {
                const pathParts = []
                let parent = L_._layersParent[l]
                while (parent) {
                    const parentData = L_.layers.data[parent]
                    pathParts.unshift(
                        parentData ? (parentData.display_name || parent) : parent
                    )
                    parent = L_._layersParent[parent]
                }
                return pathParts.length > 0 ? pathParts.join(' / ') : null
            }

            for (let l in L_.layers.data) {
                const ld = L_.layers.data[l]
                if (ld.variables && ld.variables.search)
                    searchvars[l] = ld.variables.search

                // Collect search groups
                if (ld.variables && ld.variables.searchGroup) {
                    const gid = ld.variables.searchGroup
                    if (!groups[gid]) {
                        groups[gid] = {
                            label: gid,
                            layers: [],
                        }
                    }
                    groups[gid].layers.push(l)
                }

                if (ld.url && ld.url.startsWith('geodatasets:')) {
                    geoLayers.push({
                        value: l,
                        label: ld.display_name || l,
                        geodatasetName: ld.url.split(':')[1],
                        path: buildPath(l),
                        kind: 'geodataset',
                    })
                } else if (
                    ld.type === 'vector' &&
                    ld.url &&
                    !ld.url.startsWith('geodatasets:')
                ) {
                    vecSearchLayers.push({
                        value: l,
                        label: ld.display_name || l,
                        path: buildPath(l),
                        kind: 'vector',
                    })
                }
            }

            const fields = makeSearchFields(searchvars)
            setSearchFields(fields)
            setSearchGroups(groups)

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
                geoLayers.length === 0 &&
                vecSearchLayers.length === 0
            )
                return false

            setGeodatasetLayers(geoLayers)
            setVectorSearchLayers(vecSearchLayers)
            setVectorLayers(vecLayers)

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
                            geodatasetSchemaRef.current = fieldList
                            rebuildMergedSchema(fieldList)
                        }
                    },
                    function () {}
                )
            }

            // Load all vector layer schemas eagerly for structured query autocomplete
            vecSearchLayers.forEach((vl) => loadVectorLayerData(vl.value))

            // Default selected layer for regular mode
            const defaultLayer =
                vecLayers.find((vl) => L_.layers.on[vl.value] === true) ||
                vecLayers[0] || null
            if (defaultLayer) {
                setSelectedLayer(defaultLayer.value)
            }
            setPlaceholder('Search features...')

            if (
                L_.searchStrings != null &&
                L_.searchStrings.length > 0 &&
                L_.searchFile != null
            ) {
                setSelectedLayer(L_.searchFile)
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
    }, [getL_, rebuildMergedSchema, loadVectorLayerData])

    // Build values array when layer changes (regular mode)
    useEffect(() => {
        if (!selectedLayer) return
        // Only for plain text mode (non-colon queries)
        if (inputValue.startsWith(':')) return

        const L_ = getL_()
        const Map_ = getMap_()
        if (!Map_ || !L_) return

        const lname = selectedLayer
        const ldata = L_.layers.data[lname]
        if (!ldata) return

        const buildArray = () => {
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
        }

        // Turn off any previously search-toggled layer
        if (regModeToggledLayer.current && regModeToggledLayer.current !== lname) {
            const prevName = regModeToggledLayer.current
            if (L_.layers.on[prevName] === true && L_.layers.data[prevName]) {
                L_.toggleLayer(L_.layers.data[prevName])
            }
            regModeToggledLayer.current = null
        }

        // If layer is off, toggle it on and poll
        if (L_.layers.on[lname] !== true) {
            regModeToggledLayer.current = lname
            L_.toggleLayer(L_.layers.data[lname])
            let attempts = 0
            const poll = setInterval(() => {
                attempts++
                if (L_.layers.layer[lname] && typeof L_.layers.layer[lname].toGeoJSON === 'function') {
                    clearInterval(poll)
                    buildArray()
                } else if (attempts > 20) {
                    clearInterval(poll)
                }
            }, 200)
            return () => clearInterval(poll)
        }

        if (L_.layers.layer[lname] && typeof L_.layers.layer[lname].toGeoJSON === 'function') {
            buildArray()
        } else {
            let attempts = 0
            const poll = setInterval(() => {
                attempts++
                if (L_.layers.layer[lname] && typeof L_.layers.layer[lname].toGeoJSON === 'function') {
                    clearInterval(poll)
                    buildArray()
                } else if (attempts > 20) {
                    clearInterval(poll)
                }
            }, 200)
            return () => clearInterval(poll)
        }
    }, [selectedLayer, searchFields, getL_, getMap_, inputValue])

    // Compute suggestions based on input
    useEffect(() => {
        const parsed = parseColonQuery(inputValue)

        if (parsed) {
            // Compute active layer set for filtering
            let activeLayers = []
            if (selectedLayer) {
                const groupEntry = Object.values(searchGroups).find(
                    (g) => g.layers.includes(selectedLayer)
                )
                if (groupEntry) {
                    activeLayers = groupEntry.layers
                } else {
                    const geoLayer = geodatasetLayers.find((gl) => gl.value === selectedLayer)
                    activeLayers = geoLayer
                        ? [selectedLayer, geoLayer.geodatasetName]
                        : [selectedLayer]
                }
            }

            // Structured query mode
            if (parsed.stage === STAGE_FIELD) {
                const q = parsed.field.toLowerCase()
                const filtered = schemaFields
                    .filter((f) => {
                        if (f.name.toLowerCase().indexOf(q) === -1) return false
                        // Restrict to fields present on the active layer(s)
                        if (activeLayers.length > 0) {
                            return f.layers.some((l) => activeLayers.includes(l))
                        }
                        return true
                    })
                    .slice(0, 50)
                    .map((f) => ({
                        type: 'field',
                        label: f.name,
                        detail: f.type,
                        field: f,
                    }))
                setSuggestions(filtered)
                setShowSuggestions(filtered.length > 0)
                setActiveSuggestionIdx(-1)
            } else if (parsed.stage === STAGE_OP) {
                const q = parsed.op.toLowerCase()
                const filtered = ALL_OPS
                    .filter((op) =>
                        op.symbol.toLowerCase().indexOf(q) !== -1 ||
                        op.label.toLowerCase().indexOf(q) !== -1
                    )
                    .map((op) => ({
                        type: 'op',
                        label: op.symbol,
                        detail: op.label,
                        op: op,
                    }))
                setSuggestions(filtered)
                setShowSuggestions(filtered.length > 0)
                setActiveSuggestionIdx(-1)
            } else if (parsed.stage === STAGE_VALUE) {
                // Show values for the selected field
                const q = parsed.value.toLowerCase()
                const field = schemaFields.find(
                    (f) => f.name.toLowerCase() === parsed.field.toLowerCase()
                )
                if (field && fieldValues.length > 0) {
                    const filtered = fieldValues
                        .filter((v) =>
                            String(v.value).toLowerCase().indexOf(q) !== -1
                        )
                        .slice(0, 100)
                        .map((v) => ({
                            type: 'value',
                            label: String(v.value),
                            detail: v.count != null ? `(${v.count})` : '',
                        }))
                    setSuggestions(filtered)
                    setShowSuggestions(filtered.length > 0)
                } else {
                    setSuggestions([])
                    setShowSuggestions(false)
                }
                setActiveSuggestionIdx(-1)
            }
            return
        }

        // Plain text mode — search construct values
        if (!selectedLayer || !inputValue) {
            const all = arrayToSearch.slice(0, 100).map((s) => ({
                type: 'plain',
                label: String(s),
            }))
            setSuggestions(all)
            setShowSuggestions(all.length > 0 && panelOpen)
            setActiveSuggestionIdx(-1)
            return
        }

        const isSubmitted = submittedValue != null && inputValue === submittedValue
        if (isSubmitted) {
            const all = arrayToSearch.slice(0, 100).map((s) => ({
                type: 'plain',
                label: String(s),
            }))
            setSuggestions(all)
            setShowSuggestions(all.length > 0 && panelOpen)
            setActiveSuggestionIdx(-1)
            return
        }

        const query = inputValue.toLowerCase()
        const filtered = arrayToSearch
            .filter((item) => String(item).toLowerCase().indexOf(query) !== -1)
            .slice(0, 100)
            .map((s) => ({ type: 'plain', label: String(s) }))
        filtered.sort((a, b) => {
            const aIdx = a.label.toLowerCase().indexOf(query)
            const bIdx = b.label.toLowerCase().indexOf(query)
            if (aIdx !== bIdx) return aIdx - bIdx
            return a.label > b.label ? 1 : -1
        })
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0 && panelOpen)
        setActiveSuggestionIdx(-1)
    }, [inputValue, arrayToSearch, schemaFields, fieldValues, submittedValue, panelOpen, selectedLayer, searchGroups, geodatasetLayers])

    // Load field values when we enter the value stage of a structured query
    useEffect(() => {
        const parsed = parseColonQuery(inputValue)
        if (!parsed || parsed.stage !== STAGE_VALUE) {
            return
        }
        const field = schemaFields.find(
            (f) => f.name.toLowerCase() === parsed.field.toLowerCase()
        )
        if (!field) return

        // Compute active layer set (selected layer or search group members)
        let activeLayers = []
        if (selectedLayer) {
            const groupEntry = Object.values(searchGroups).find(
                (g) => g.layers.includes(selectedLayer)
            )
            if (groupEntry) {
                activeLayers = groupEntry.layers
            } else {
                const geoLayer = geodatasetLayers.find((gl) => gl.value === selectedLayer)
                activeLayers = geoLayer
                    ? [selectedLayer, geoLayer.geodatasetName]
                    : [selectedLayer]
            }
        }

        // Fetch aggregations for this field — restricted to active layers
        const geodatasetLayerNames = field.layers.filter((l) =>
            geodatasetLayers.some((gl) => gl.geodatasetName === l) &&
            (activeLayers.length === 0 || activeLayers.includes(l))
        )
        const vectorLayerNames = field.layers.filter((l) =>
            vectorSearchLayers.some((vl) => vl.value === l) &&
            (activeLayers.length === 0 || activeLayers.includes(l))
        )

        // Compute vector aggregations
        const F_ = getF_()
        const vectorAggs = {}
        vectorLayerNames.forEach((lname) => {
            const geojson = vectorLayerCache.current[lname]
            if (!geojson || !geojson.features) return
            geojson.features.forEach((feat) => {
                if (!feat.properties) return
                const val = F_.getIn(feat.properties, field.name)
                if (val != null) {
                    const key = String(val)
                    vectorAggs[key] = (vectorAggs[key] || 0) + 1
                }
            })
        })

        const mergeAndSet = (geoAggs) => {
            const allAggs = { ...geoAggs }
            for (const k in vectorAggs) {
                allAggs[k] = (allAggs[k] || 0) + vectorAggs[k]
            }
            const keys = Object.keys(allAggs)
            if (field.type === 'number') {
                keys.sort((a, b) => parseFloat(a) - parseFloat(b))
            } else {
                keys.sort()
            }
            setFieldValues(keys.map((v) => ({ value: v, count: allAggs[v] })))
        }

        if (geodatasetLayerNames.length > 0) {
            calls.api(
                'geodatasets_bulk_aggregations',
                { layers: geodatasetLayerNames.join(',') },
                function (data) {
                    let geoAggs = {}
                    if (
                        data.status === 'success' &&
                        data.aggregations &&
                        data.aggregations[field.name] &&
                        data.aggregations[field.name].aggs
                    ) {
                        geoAggs = data.aggregations[field.name].aggs
                    }
                    mergeAndSet(geoAggs)
                },
                function () { mergeAndSet({}) }
            )
        } else {
            mergeAndSet({})
        }
    }, [inputValue, schemaFields, geodatasetLayers, vectorSearchLayers, getF_, selectedLayer, searchGroups])

    // Scroll active suggestion into view on arrow key navigation
    useEffect(() => {
        if (activeSuggestionIdx < 0 || !suggestionsRef.current) return
        const container = suggestionsRef.current
        const item = container.children[activeSuggestionIdx]
        if (item) {
            item.scrollIntoView({ block: 'nearest' })
        }
    }, [activeSuggestionIdx])

    // Close panel on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                (!helpRef.current || !helpRef.current.contains(e.target))
            ) {
                setPanelOpen(false)
                setShowSuggestions(false)
                regModeToggledLayer.current = null
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Listen for "/" keyboard shortcut to focus search
    useEffect(() => {
        const handleSlash = () => {
            if (panelOpen) {
                setPanelOpen(false)
                inputRef.current?.blur()
            } else {
                setPanelOpen(true)
                setTimeout(() => inputRef.current?.focus(), 50)
            }
        }
        document.addEventListener('mmgis-open-advanced-search', handleSlash)
        return () => document.removeEventListener('mmgis-open-advanced-search', handleSlash)
    }, [panelOpen])

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

    // Match a single feature value against operator (client-side)
    const matchFeatureValue = useCallback((featureValue, searchValue, op, fieldType) => {
        if (op === 'isnull') return featureValue == null
        if (op === 'isnotnull') return featureValue != null
        if (featureValue == null) return false

        let fv = featureValue
        let sv = searchValue
        if (fieldType === 'number' && op !== ',' && op !== 'in') {
            fv = parseFloat(fv)
            sv = parseFloat(sv)
        }

        switch (op) {
            case '=': return fv == sv
            case '!=': return fv != sv
            case '<': return fv < sv
            case '>': return fv > sv
            case '<=': return fv <= sv
            case '>=': return fv >= sv
            case '*=':
            case 'contains': return String(fv).toLowerCase().indexOf(String(sv).toLowerCase()) !== -1
            case '^=':
            case 'beginswith': return String(fv).toLowerCase().startsWith(String(sv).toLowerCase())
            case '$=':
            case 'endswith': return String(fv).toLowerCase().endsWith(String(sv).toLowerCase())
            case '~=':
            case 'regex':
                try {
                    const pattern = sv.startsWith('/') && sv.lastIndexOf('/') > 0
                        ? sv.substring(1, sv.lastIndexOf('/'))
                        : sv
                    const flags = sv.startsWith('/') && sv.lastIndexOf('/') > 0
                        ? sv.substring(sv.lastIndexOf('/') + 1)
                        : 'i'
                    return new RegExp(pattern, flags).test(String(fv))
                } catch (e) { return false }
            case ',':
            case 'in': return sv.split(',').map((s) => s.trim()).includes(String(fv))
            default: return false
        }
    }, [])

    // Execute a structured query (:field:op:value)
    const executeStructuredQuery = useCallback(
        (field, op, value) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const F_ = getF_()

            const backendOp = OP_TO_BACKEND[op] || '='
            const isNullOp = op === 'isnull' || op === 'isnotnull'
            if (!value && !isNullOp) return

            const fieldObj = schemaFields.find(
                (f) => f.name.toLowerCase() === field.toLowerCase()
            )
            if (!fieldObj) return

            const fieldName = fieldObj.name
            const fieldType = fieldObj.type || 'string'
            const fieldLayers = fieldObj.layers

            saveLayerState()

            searchFilteredLayers.current.forEach((layerName) => {
                const ld = L_.layers.data[layerName]
                if (ld && ld._filterEncoded) {
                    delete ld._filterEncoded.filters
                }
            })
            searchFilteredLayers.current = []

            // Split candidate layers
            const candidateGeo = geodatasetLayers.filter(
                (gl) => fieldLayers.includes(gl.geodatasetName)
            )
            const candidateVec = vectorSearchLayers.filter(
                (vl) => fieldLayers.includes(vl.value)
            )

            if (candidateGeo.length === 0 && candidateVec.length === 0) return

            const opMap = { ',': 'in', 'contains': 'contains', 'beginswith': 'beginswith', 'endswith': 'endswith' }
            const filterOp = opMap[backendOp] || backendOp
            const filterEncoded = isNullOp
                ? `${fieldName}+${filterOp}+${fieldType}+`
                : `${fieldName}+${filterOp}+${fieldType}+${(value || '').replaceAll(',', '$')}`

            let pendingSearches = candidateGeo.length
            const allResultCoords = []
            const layersWithHits = new Set()
            const vectorMatchedFeatures = {}

            // Process vector layers client-side
            candidateVec.forEach((vl) => {
                const layerName = vl.value
                const geojson = vectorLayerCache.current[layerName]
                if (!geojson || !geojson.features) return

                const matchingFeatures = geojson.features.filter((feat) => {
                    const fv = F_.getIn(feat.properties, fieldName)
                    return matchFeatureValue(fv, value, op, fieldType)
                })

                if (matchingFeatures.length > 0) {
                    layersWithHits.add(layerName)
                    matchingFeatures.forEach((feat) => {
                        try {
                            const c = center(feat)
                            allResultCoords.push(c.geometry.coordinates)
                        } catch (e) { /* skip */ }
                    })
                    vectorMatchedFeatures[layerName] = matchingFeatures

                    if (L_.layers.layer[layerName] && L_.layers.layer[layerName] !== false) {
                        if (!vectorFilteredLayers.current[layerName]) {
                            vectorFilteredLayers.current[layerName] =
                                L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                        }
                        L_.clearVectorLayer(layerName)
                        L_.updateVectorLayer(layerName, {
                            type: 'FeatureCollection',
                            features: matchingFeatures,
                        })
                    }
                }
            })

            // Process geodataset layers via API
            candidateGeo.forEach((gl) => {
                const layerName = gl.value

                if (!L_.layers.data[layerName]._filterEncoded) {
                    L_.layers.data[layerName]._filterEncoded = {}
                }
                L_.layers.data[layerName]._filterEncoded.filters = filterEncoded
                searchFilteredLayers.current.push(layerName)

                calls.api(
                    'geodatasets_search',
                    {
                        layer: gl.geodatasetName,
                        key: fieldName,
                        value: value || '',
                        operator: backendOp,
                        type: fieldType,
                    },
                    function (d) {
                        if (d.body && d.body.length > 0) {
                            layersWithHits.add(layerName)
                            d.body.forEach((r) => {
                                try {
                                    const c = center(r)
                                    allResultCoords.push(c.geometry.coordinates)
                                } catch (e) { /* skip */ }
                            })
                        }
                        pendingSearches--
                        if (pendingSearches <= 0) applySearchResults()
                    },
                    function () {
                        pendingSearches--
                        if (pendingSearches <= 0) applySearchResults()
                    }
                )
            })

            if (candidateGeo.length === 0) applySearchResults()

            function applySearchResults() {
                const allCandidateLayerNames = new Set([
                    ...candidateGeo.map((gl) => gl.value),
                    ...candidateVec.map((vl) => vl.value),
                ])

                allCandidateLayerNames.forEach((layerName) => {
                    const hasHits = layersWithHits.has(layerName)
                    const isOn = L_.layers.on[layerName] === true

                    if (hasHits && !isOn) {
                        L_.toggleLayer(L_.layers.data[layerName])
                        if (vectorMatchedFeatures[layerName]) {
                            const filtered = vectorMatchedFeatures[layerName]
                            let attempts = 0
                            const poll = setInterval(() => {
                                attempts++
                                if (L_.layers.layer[layerName] && L_.layers.layer[layerName] !== false) {
                                    clearInterval(poll)
                                    if (!vectorFilteredLayers.current[layerName]) {
                                        vectorFilteredLayers.current[layerName] =
                                            L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                                    }
                                    L_.clearVectorLayer(layerName)
                                    L_.updateVectorLayer(layerName, {
                                        type: 'FeatureCollection',
                                        features: filtered,
                                    })
                                } else if (attempts > 30) {
                                    clearInterval(poll)
                                }
                            }, 200)
                        }
                    } else if (!hasHits && isOn) {
                        L_.toggleLayer(L_.layers.data[layerName])
                    }

                    if (hasHits && geodatasetLayers.some((gl) => gl.value === layerName)) {
                        L_.Map_.refreshLayer(L_.layers.data[layerName], null, null, true)
                    }
                })

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
        [schemaFields, geodatasetLayers, vectorSearchLayers, saveLayerState, matchFeatureValue, getL_, getMap_, getF_]
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

            const geodatasetName = L_.layers.data[layerName]?.url?.split(':')[1]

            calls.api(
                'geodatasets_search',
                {
                    layer: geodatasetName || lastGeodatasetLayerName.current,
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
                                    feature._layerName = vts[i].options.layerName
                                    feature._layer = feature
                                    L_.layers.layer[layerName]._events.click[0].fn({
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

    const doWithSearch = useCallback(
        (doX, forceX, forceSTS, isURLSearch, value, fieldsOverride, L_Override) => {
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
                    const comparer = getSearchFieldStringForFeature(fields, lname, props)

                    for (let i = 0; i < x.length; i++) {
                        if (
                            x.length === 1
                                ? x[i].toLowerCase() === comparer.toLowerCase()
                                : x[i].toLowerCase().indexOf(comparer.toLowerCase()) > -1 ||
                                  comparer.toLowerCase().indexOf(x[i].toLowerCase()) > -1
                        ) {
                            shouldSearch = true
                            break
                        }
                    }

                    if (shouldSearch) {
                        if (doX === 'both' || doX === 'select') selectLayers.push(layer)
                        if (doX === 'both' || doX === 'goto') gotoLayers.push(layer)
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
                        if (typeof selectLayers[i].bringToFront === 'function')
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
            const searchValue = value != null ? value : inputValue
            const parsed = parseColonQuery(searchValue)

            if (parsed && parsed.stage === STAGE_VALUE && parsed.field && parsed.op) {
                executeStructuredQuery(parsed.field, parsed.op, parsed.value)
                return
            }

            // Plain text search
            const L_ = getL_()
            if (!selectedLayer) return
            const ltype = L_.layers.data[selectedLayer]?.type

            if (ltype === 'vectortile') {
                searchGeodatasets(selectedLayer, searchValue)
            } else {
                doWithSearch('both', null, null, false, searchValue)
            }
        },
        [inputValue, selectedLayer, executeStructuredQuery, searchGeodatasets, doWithSearch, getL_]
    )

    const handleSuggestionClick = useCallback(
        (item) => {
            const parsed = parseColonQuery(inputValue)

            if (item.type === 'field') {
                // Complete field name, add next colon
                const newVal = `:${item.label}:`
                setInputValue(newVal)
                setFieldValues([])
                inputRef.current?.focus()
                return
            }
            if (item.type === 'op') {
                const parsed2 = parseColonQuery(inputValue)
                const fieldPart = parsed2 ? parsed2.field : ''
                const newVal = `:${fieldPart}:${item.label}:`
                setInputValue(newVal)
                inputRef.current?.focus()

                // Auto-execute for isnull/isnotnull
                if (item.label === 'isnull' || item.label === 'isnotnull') {
                    setSubmittedValue(newVal)
                    executeStructuredQuery(fieldPart, item.label, '')
                }
                return
            }
            if (item.type === 'value') {
                const parsed2 = parseColonQuery(inputValue)
                const fieldPart = parsed2 ? parsed2.field : ''
                const opPart = parsed2 ? parsed2.op : '='
                const newVal = `:${fieldPart}:${opPart}:${item.label}`
                setInputValue(newVal)
                setSubmittedValue(newVal)
                executeStructuredQuery(fieldPart, opPart, item.label)
                return
            }

            // Plain text suggestion
            setInputValue(item.label)
            setSubmittedValue(item.label)
            handleSearch(item.label)
        },
        [inputValue, handleSearch, executeStructuredQuery]
    )

    const handleClear = useCallback(() => {
        if (regModeToggledLayer.current) {
            const L_ = getL_()
            const prevName = regModeToggledLayer.current
            if (L_.layers.on[prevName] === true && L_.layers.data[prevName]) {
                L_.toggleLayer(L_.layers.data[prevName])
            }
            regModeToggledLayer.current = null
        }
        restoreLayerState()
        setInputValue('')
        setSubmittedValue(null)
        setSuggestions([])
        setShowSuggestions(false)
        setFieldValues([])
        setPlaceholder('Search features...')
        setArrayToSearch([])
        const defaultLayer =
            vectorLayers.find((vl) => {
                const L_ = getL_()
                return L_.layers.on[vl.value] === true
            }) || vectorLayers[0] || null
        if (defaultLayer) {
            setSelectedLayer(defaultLayer.value)
        } else {
            setSelectedLayer(null)
        }
    }, [restoreLayerState, vectorLayers, getL_])

    const handleRegularLayerSelect = useCallback((layerValue) => {
        setSelectedLayer(layerValue)
        setInputValue('')
        setSubmittedValue(null)
        setSuggestions([])
        setShowSuggestions(false)
    }, [])

    const openPanel = useCallback(() => {
        if (!panelOpen) {
            setPanelOpen(true)
        }
    }, [panelOpen])

    // Layer items for the regular panel (layers with search constructs + groups)
    const layerListItems = useMemo(() => {
        const items = []
        const grouped = new Set()

        // Add search group entries
        Object.entries(searchGroups).forEach(([gid, group]) => {
            items.push({
                value: group.layers[0],
                label: group.label,
                isGroup: true,
                groupId: gid,
                layers: group.layers,
            })
            group.layers.forEach((l) => grouped.add(l))
        })

        // Add individual layers that aren't in a group
        vectorLayers.forEach((vl) => {
            if (!grouped.has(vl.value)) {
                items.push({ ...vl, isGroup: false })
            }
        })

        return items
    }, [vectorLayers, searchGroups])

    // Selected layer label for the trigger
    const selectedLayerLabel = useMemo(() => {
        if (!selectedLayer) return 'Layers'
        const item = layerListItems.find((li) =>
            li.isGroup ? li.layers.includes(selectedLayer) : li.value === selectedLayer
        )
        return item ? item.label : selectedLayer
    }, [selectedLayer, layerListItems])



    if (!initialized) return null

    // Determine if we're in colon-query mode
    const isColonMode = inputValue.startsWith(':')
    const parsed = parseColonQuery(inputValue)

    return (
        <div
            id="Search"
            className={`searchBar ${panelOpen ? 'searchBarExpanded' : ''}`}
            ref={panelRef}
        >
            {/* Top bar */}
            <div className="searchCompactBar">
                <i className="mdi mdi-magnify mdi-18px searchCompactIcon" onClick={openPanel} />
                {/* Layers trigger */}
                {vectorLayers.length > 0 && (
                    <>
                        <div className="searchLayersTrigger" onClick={openPanel}>
                            <span className="searchLayersTriggerLabel">
                                {selectedLayerLabel}
                            </span>
                            <i className="mdi mdi-chevron-down mdi-14px searchLayersTriggerChevron" />
                        </div>
                        <div className="searchBarDivider" />
                    </>
                )}
                {/* Search input */}
                <input
                    ref={inputRef}
                    className="searchCompactInput"
                    type="text"
                    placeholder={placeholder + ' (or ":")'}
                    value={inputValue}
                    onChange={(e) => {
                        setSubmittedValue(null)
                        setInputValue(e.target.value)
                        if (!panelOpen) setPanelOpen(true)
                    }}
                    onFocus={() => {
                        openPanel()
                        if (arrayToSearch.length > 0 || isColonMode) {
                            setShowSuggestions(true)
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                                handleSuggestionClick(suggestions[activeSuggestionIdx])
                            } else if (isColonMode && parsed && parsed.stage === STAGE_VALUE) {
                                setSubmittedValue(inputValue)
                                executeStructuredQuery(parsed.field, parsed.op, parsed.value)
                                setShowSuggestions(false)
                            } else if (!isColonMode) {
                                handleSearch()
                                setShowSuggestions(false)
                            }
                        } else if (e.key === 'Escape') {
                            setPanelOpen(false)
                            setShowSuggestions(false)
                            regModeToggledLayer.current = null
                            inputRef.current?.blur()
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setActiveSuggestionIdx((prev) =>
                                prev < suggestions.length - 1 ? prev + 1 : prev
                            )
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setActiveSuggestionIdx((prev) => (prev > 0 ? prev - 1 : -1))
                        }
                    }}
                    tabIndex={401}
                />
                <Tooltip content="Clear" placement="bottom">
                    <IconButton
                        className="searchCompactClear"
                        style={{ visibility: inputValue ? 'visible' : 'hidden' }}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleClear()
                        }}
                        size="sm"
                    >
                        <i className="mdi mdi-close mdi-14px" />
                    </IconButton>
                </Tooltip>
                {/* Help button */}
                <Tooltip content="Search help" placement="bottom">
                    <IconButton
                        className={`searchHelpToggle ${helpOpen ? 'searchHelpToggleActive' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation()
                            setHelpOpen(!helpOpen)
                        }}
                        size="sm"
                    >
                        <i className="mdi mdi-help-circle-outline mdi-16px" />
                    </IconButton>
                </Tooltip>
            </div>

            {/* Dropdown panel */}
            {panelOpen && (
                <div className="searchUnifiedPanel searchRegularPanel">
                    {isColonMode ? (
                        /* Structured query autocomplete */
                        <div className="searchUnifiedColumns searchStructuredColumns">
                            <div className="searchUnifiedCol searchStructuredCol">
                                <div className="searchUnifiedColHeader">
                                    <span>
                                        {parsed?.stage === STAGE_FIELD && 'Fields'}
                                        {parsed?.stage === STAGE_OP && 'Operators'}
                                        {parsed?.stage === STAGE_VALUE && 'Values'}
                                    </span>
                                    <span className="searchStructuredHint">
                                        {parsed?.stage === STAGE_FIELD && ':field'}
                                        {parsed?.stage === STAGE_OP && ':field:op'}
                                        {parsed?.stage === STAGE_VALUE && ':field:op:value'}
                                    </span>
                                </div>
                                <div className="searchUnifiedColBody" ref={suggestionsRef}>
                                    {suggestions.length > 0 ? (
                                        suggestions.map((s, idx) => (
                                            <div
                                                key={idx}
                                                className={`searchSuggestionItem ${
                                                    idx === activeSuggestionIdx
                                                        ? 'searchSuggestionItemActive'
                                                        : ''
                                                }`}
                                                onMouseDown={() => handleSuggestionClick(s)}
                                                onMouseEnter={() => setActiveSuggestionIdx(idx)}
                                            >
                                                <span className="searchSuggestionLabel">
                                                    {s.label}
                                                </span>
                                                {s.detail && (
                                                    <span className="searchSuggestionDetail">
                                                        {s.detail}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="searchUnifiedEmpty">
                                            {parsed?.stage === STAGE_FIELD && 'Type to filter fields...'}
                                            {parsed?.stage === STAGE_OP && 'No matching operators'}
                                            {parsed?.stage === STAGE_VALUE && 'Loading values...'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Regular mode: Layers + Values */
                        <div className="searchUnifiedColumns searchRegularColumns">
                            {/* Column 1: Layers */}
                            <div className="searchUnifiedCol searchRegularColLayers">
                                <div className="searchUnifiedColHeader">
                                    <span>Layers</span>
                                </div>
                                <div className="searchUnifiedColBody">
                                    {layerListItems.map((item) => (
                                        <div
                                            key={item.isGroup ? `group-${item.groupId}` : item.value}
                                            className={`searchRegularLayerItem ${
                                                (item.isGroup
                                                    ? item.layers.includes(selectedLayer)
                                                    : selectedLayer === item.value)
                                                    ? 'searchRegularLayerItemActive'
                                                    : ''
                                            }`}
                                            onClick={() => handleRegularLayerSelect(
                                                item.isGroup ? item.layers[0] : item.value
                                            )}
                                        >
                                            {item.isGroup && (
                                                <i className="mdi mdi-folder-outline mdi-12px searchGroupIcon" />
                                            )}
                                            {item.label}
                                        </div>
                                    ))}
                                    {layerListItems.length === 0 && (
                                        <div className="searchUnifiedEmpty">No search layers</div>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Values */}
                            <div className="searchUnifiedCol searchRegularColValues">
                                <div className="searchUnifiedColHeader">
                                    <span>Values</span>
                                </div>
                                <div className="searchUnifiedColBody" ref={suggestionsRef}>
                                    {suggestions.length > 0 ? (
                                        suggestions.map((s, idx) => {
                                            const isSubmitted = submittedValue != null && s.label === submittedValue
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`searchSuggestionItem ${
                                                        isSubmitted
                                                            ? 'searchSuggestionItemSubmitted'
                                                            : idx === activeSuggestionIdx
                                                            ? 'searchSuggestionItemActive'
                                                            : ''
                                                    }`}
                                                    onMouseDown={() => handleSuggestionClick(s)}
                                                    onMouseEnter={() => setActiveSuggestionIdx(idx)}
                                                >
                                                    <span className="searchSuggestionLabel">
                                                        {s.label}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="searchUnifiedEmpty">
                                            {!selectedLayer
                                                ? 'Select a layer'
                                                : arrayToSearch.length === 0
                                                ? 'Loading...'
                                                : inputValue
                                                ? 'No matches'
                                                : 'Type to search'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Help modal */}
            {helpOpen && (
                <div className="searchHelpPanel" ref={helpRef}>
                    <div className="searchHelpHeader">
                        <span>Search Help</span>
                        <IconButton size="sm" onClick={() => setHelpOpen(false)}>
                            <i className="mdi mdi-close mdi-14px" />
                        </IconButton>
                    </div>
                    <div className="searchHelpBody">
                        <div className="searchHelpSection">
                            <div className="searchHelpTitle">Plain Text</div>
                            <div className="searchHelpDesc">
                                Type normally to search by display name (search construct).
                            </div>
                        </div>
                        <div className="searchHelpSection">
                            <div className="searchHelpTitle">Structured Query</div>
                            <div className="searchHelpDesc">
                                Start with <code>:</code> to enter field query mode:
                            </div>
                            <div className="searchHelpSyntax">:field:operator:value</div>
                            <div className="searchHelpDesc">
                                Autocomplete guides you at each step.
                            </div>
                        </div>
                        <div className="searchHelpSection">
                            <div className="searchHelpTitle">Operators</div>
                            <table className="searchHelpTable">
                                <tbody>
                                    <tr><td><code>=</code></td><td>Equals</td></tr>
                                    <tr><td><code>!=</code></td><td>Not equals</td></tr>
                                    <tr><td><code>&lt;</code> <code>&gt;</code> <code>&lt;=</code> <code>&gt;=</code></td><td>Numeric comparison</td></tr>
                                    <tr><td><code>*=</code></td><td>Contains</td></tr>
                                    <tr><td><code>^=</code></td><td>Begins with</td></tr>
                                    <tr><td><code>$=</code></td><td>Ends with</td></tr>
                                    <tr><td><code>~=</code></td><td>Regex match</td></tr>
                                    <tr><td><code>in</code></td><td>Comma-separated list</td></tr>
                                    <tr><td><code>isnull</code></td><td>Is null</td></tr>
                                    <tr><td><code>isnotnull</code></td><td>Is not null</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="searchHelpSection">
                            <div className="searchHelpTitle">Examples</div>
                            <div className="searchHelpExample"><code>:category:=:Commercial</code></div>
                            <div className="searchHelpExample"><code>:altitude:&gt;:1000</code></div>
                            <div className="searchHelpExample"><code>:name:~=:/^Mars.*/</code></div>
                            <div className="searchHelpExample"><code>:sensor:isnull:</code></div>
                        </div>
                        <div className="searchHelpSection">
                            <div className="searchHelpTitle">Keyboard Shortcuts</div>
                            <div className="searchHelpDesc">
                                <code>/</code> — Toggle search bar<br />
                                <code>Escape</code> — Close panel
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Static compatibility properties
SearchBar.height = 43
SearchBar.width = 700

export { makeSearchFields }
export default SearchBar
