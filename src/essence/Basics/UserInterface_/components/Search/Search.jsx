import React, { useState, useEffect, useRef, useCallback } from 'react'
import { center } from '@turf/turf'

import Checkbox from '../../../../../design-system/components/Checkbox/Checkbox'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Switch from '../../../../../design-system/components/Switch/Switch'
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
    { value: 'isnull', icon: 'mdi-null', label: 'Is Null' },
    { value: 'isnotnull', icon: 'mdi-check-circle-outline', label: 'Is Not Null' },
]
const NUMBER_OPS = [
    { value: '=', icon: 'mdi-equal', label: 'Equals' },
    { value: '!=', icon: null, text: '!=', label: 'Not Equals' },
    { value: '<', icon: 'mdi-less-than', label: 'Less Than' },
    { value: '>', icon: 'mdi-greater-than', label: 'Greater Than' },
    { value: '<=', icon: 'mdi-less-than-or-equal', label: 'Less Than or Equal' },
    { value: '>=', icon: 'mdi-greater-than-or-equal', label: 'Greater Than or Equal' },
    { value: ',', icon: null, text: 'in', label: 'In List' },
    { value: 'isnull', icon: 'mdi-null', label: 'Is Null' },
    { value: 'isnotnull', icon: 'mdi-check-circle-outline', label: 'Is Not Null' },
]

// View modes for the panel
const VIEW_REGULAR = 'regular'
const VIEW_ADVANCED = 'advanced'

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

    // Panel and view mode state
    const [panelOpen, setPanelOpen] = useState(false)
    const [viewMode, setViewMode] = useState(VIEW_REGULAR)
    const [fieldFilterText, setFieldFilterText] = useState('')
    const [layerFilterText, setLayerFilterText] = useState('')
    const [checkedLayers, setCheckedLayers] = useState(new Set())
    const [commonFieldsOnly, setCommonFieldsOnly] = useState(true)

    // Search mode and selection
    const [searchMode, setSearchMode] = useState(MODE_DEFAULT)
    const [selectedField, setSelectedField] = useState(null)
    const [selectedLayer, setSelectedLayer] = useState(null)
    const [searchOperator, setSearchOperator] = useState('=')

    // Schema and layer data
    const [schemaFields, setSchemaFields] = useState([])
    const [geodatasetLayers, setGeodatasetLayers] = useState([])
    const [vectorSearchLayers, setVectorSearchLayers] = useState([])
    const [vectorLayers, setVectorLayers] = useState([])
    const [fieldValues, setFieldValues] = useState([])
    const [loadingVectorLayers, setLoadingVectorLayers] = useState(new Set())

    const lastGeodatasetLayerName = useRef(null)

    // Cached GeoJSON features for lazy-loaded vector layers { layerName: GeoJSON }
    const vectorLayerCache = useRef({})
    // Schema fields discovered from vector layers { fieldName: { type, layers: [layerName, ...] } }
    const vectorSchemaRef = useRef({})
    // Base geodataset schema (from API) stored separately for clean merges
    const geodatasetSchemaRef = useRef([])

    // Pre-search layer state for restore on cancel
    const preSearchLayerState = useRef(null)
    const searchFilteredLayers = useRef([])

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const panelRef = useRef(null)
    const fieldFilterRef = useRef(null)
    const layerFilterRef = useRef(null)
    const valueInputRef = useRef(null)

    const getL_ = useCallback(() => {
        return require('../../../Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('../../../Map_/Map_').default
    }, [])
    const getF_ = useCallback(() => {
        return require('../../../Formulae_/Formulae_').default
    }, [])

    // Discover schema from GeoJSON features (inspect first N features)
    const discoverVectorSchema = useCallback((geojson, layerName) => {
        const features = geojson.features || []
        const fieldMap = {} // { fieldName: { types: Set, count } }
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

        // Add geodataset schema fields
        ;(geodatasetSchemaFields || []).forEach((f) => {
            merged[f.name] = { type: f.type, layers: [...f.layers] }
        })

        // Add vector layer schema fields
        for (const fieldName in vectorSchemaRef.current) {
            const vs = vectorSchemaRef.current[fieldName]
            if (merged[fieldName]) {
                vs.layers.forEach((l) => {
                    if (!merged[fieldName].layers.includes(l))
                        merged[fieldName].layers.push(l)
                })
                // Let string usurp number
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

    // Merge vector schema into vectorSchemaRef from a discovered schema object
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

            // Already cached
            if (vectorLayerCache.current[layerName]) return

            // If the layer is already loaded in Leaflet, use its data
            if (L_.layers.layer[layerName] && L_.layers.layer[layerName] !== false) {
                try {
                    const geojson = L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                    vectorLayerCache.current[layerName] = geojson
                    const schema = discoverVectorSchema(geojson, layerName)
                    mergeVectorSchemaForLayer(schema, layerName)
                    return
                } catch (e) {
                    // fall through to fetch
                }
            }

            // Fetch the GeoJSON
            let url = layerData.url
            if (!url) return

            const F_ = getF_()
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url

            setLoadingVectorLayers((prev) => {
                const next = new Set(prev)
                next.add(layerName)
                return next
            })

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
                .catch((err) => {
                    console.warn(`Search: failed to fetch vector layer ${layerName}`, err)
                })
                .finally(() => {
                    setLoadingVectorLayers((prev) => {
                        const next = new Set(prev)
                        next.delete(layerName)
                        return next
                    })
                })
        },
        [getL_, getF_, discoverVectorSchema, mergeVectorSchemaForLayer]
    )

    // Track vector layers whose features were replaced by filtered results
    const vectorFilteredLayers = useRef({})

    // Save the current layer visibility and filter state (before search modifies it)
    const saveLayerState = useCallback(() => {
        if (preSearchLayerState.current != null) return
        const L_ = getL_()
        const onState = {}
        const filterState = {}
        for (let lname in L_.layers.on) {
            onState[lname] = L_.layers.on[lname]
        }
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

        // Restore geodataset filters
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

        // Restore vector layers to their original full features
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
            // Advanced mode: no layers checked by default
            setCheckedLayers(new Set())

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

            // If no search constructs exist, default to advanced-only mode
            if (vecLayers.length === 0) {
                setViewMode(VIEW_ADVANCED)
                setSearchMode(MODE_FIELD)
            } else {
                // Default selected layer for regular mode: first search-construct layer that is ON
                const defaultLayer =
                    vecLayers.find((vl) => L_.layers.on[vl.value] === true) ||
                    vecLayers[0] || null
                if (defaultLayer) {
                    setSelectedLayer(defaultLayer.value)
                    setSearchMode(MODE_LAYER)
                } else {
                    setSearchMode(MODE_DEFAULT)
                }
            }
            setPlaceholder('Search features...')

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
    }, [getL_, rebuildMergedSchema])

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

        // If layer is off, toggle it on and poll until data is ready
        if (L_.layers.on[lname] !== true) {
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

        // Layer already on — check if data is available, poll if not
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
    }, [searchMode, selectedLayer, searchFields, getL_, getMap_])

    // Filter suggestions based on input (layer mode and field mode)
    useEffect(() => {
        if (searchMode !== MODE_LAYER && searchMode !== MODE_FIELD) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        // When inputValue matches the submitted value, show all values
        // (don't filter down to just the submitted item)
        const isSubmitted = submittedValue != null && inputValue === submittedValue

        if (searchMode === MODE_FIELD) {
            if (!inputValue || inputValue.length < 1 || isSubmitted) {
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

        // Layer mode — show all when empty or when showing submitted value
        if (!inputValue || inputValue.length < 1 || isSubmitted) {
            const all = arrayToSearch.slice(0, 100)
            setSuggestions(all)
            setShowSuggestions(all.length > 0)
            setActiveSuggestionIdx(-1)
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
    }, [inputValue, arrayToSearch, fieldValues, searchMode, submittedValue])

    // Close panel on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target)
            ) {
                setPanelOpen(false)
                setShowSuggestions(false)
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

    // Match a single feature value against the search operator/value (client-side)
    const matchFeatureValue = useCallback((featureValue, searchValue, op, fieldType) => {
        if (op === 'isnull') return featureValue == null
        if (op === 'isnotnull') return featureValue != null
        if (featureValue == null) return false

        let fv = featureValue
        let sv = searchValue
        if (fieldType === 'number' && op !== ',') {
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
            case 'contains': return String(fv).indexOf(String(sv)) !== -1
            case 'beginswith': return String(fv).startsWith(String(sv))
            case 'endswith': return String(fv).endsWith(String(sv))
            case ',': return sv.split(',').includes(String(fv))
            default: return false
        }
    }, [])

    // Search by selected field across geodataset + vector layers
    const searchByField = useCallback(
        (value) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const F_ = getF_()
            const searchValue = (value || inputValue).trim()
            const isNullOp = searchOperator === 'isnull' || searchOperator === 'isnotnull'
            if ((!searchValue && !isNullOp) || !selectedField) return

            const fieldName = selectedField.name
            const fieldLayers = selectedField.layers
            const fieldType = selectedField.type || 'string'

            saveLayerState()

            searchFilteredLayers.current.forEach((layerName) => {
                const ld = L_.layers.data[layerName]
                if (ld && ld._filterEncoded) {
                    delete ld._filterEncoded.filters
                }
            })
            searchFilteredLayers.current = []

            // Split candidate layers into geodataset and vector
            const candidateGeo = geodatasetLayers.filter(
                (gl) =>
                    fieldLayers.includes(gl.geodatasetName) &&
                    checkedLayers.has(gl.geodatasetName)
            )
            const candidateVec = vectorSearchLayers.filter(
                (vl) =>
                    fieldLayers.includes(vl.value) &&
                    checkedLayers.has(vl.value)
            )

            if (candidateGeo.length === 0 && candidateVec.length === 0) return

            const opMap = { ',': 'in', 'contains': 'contains', 'beginswith': 'beginswith', 'endswith': 'endswith' }
            const filterOp = opMap[searchOperator] || searchOperator
            const filterEncoded = isNullOp
                ? `${fieldName}+${filterOp}+${fieldType}+`
                : `${fieldName}+${filterOp}+${fieldType}+${searchValue.replaceAll(',', '$')}`

            let pendingSearches = candidateGeo.length
            const allResultCoords = []
            const layersWithHits = new Set()
            const vectorMatchedFeatures = {} // { layerName: [matchingFeatures] }

            // --- Process vector layers client-side (synchronous) ---
            candidateVec.forEach((vl) => {
                const layerName = vl.value
                const geojson = vectorLayerCache.current[layerName]
                if (!geojson || !geojson.features) return

                const matchingFeatures = geojson.features.filter((feat) => {
                    const fv = F_.getIn(feat.properties, fieldName)
                    return matchFeatureValue(fv, searchValue, searchOperator, fieldType)
                })

                if (matchingFeatures.length > 0) {
                    layersWithHits.add(layerName)
                    matchingFeatures.forEach((feat) => {
                        try {
                            const c = center(feat)
                            allResultCoords.push(c.geometry.coordinates)
                        } catch (e) { /* skip invalid geometries */ }
                    })

                    // Store matching features for deferred application in applySearchResults
                    vectorMatchedFeatures[layerName] = matchingFeatures

                    // Apply visual filter immediately if the layer is already on
                    if (L_.layers.layer[layerName] && L_.layers.layer[layerName] !== false) {
                        if (!vectorFilteredLayers.current[layerName]) {
                            vectorFilteredLayers.current[layerName] =
                                L_.layers.layer[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
                        }
                        const filteredGeoJSON = {
                            type: 'FeatureCollection',
                            features: matchingFeatures,
                        }
                        L_.clearVectorLayer(layerName)
                        L_.updateVectorLayer(layerName, filteredGeoJSON)
                    }
                }
            })

            // --- Process geodataset layers via API ---
            candidateGeo.forEach((gl) => {
                const layerName = gl.value

                if (!L_.layers.data[layerName]._filterEncoded) {
                    L_.layers.data[layerName]._filterEncoded = {}
                }
                L_.layers.data[layerName]._filterEncoded.filters =
                    filterEncoded
                searchFilteredLayers.current.push(layerName)

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

            // If no geodataset layers to search, apply results immediately
            if (candidateGeo.length === 0) {
                applySearchResults()
            }

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

                        // For vector layers toggled on, apply filtered features after load
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

                    // Refresh geodataset layers to apply backend filter
                    if (hasHits && geodatasetLayers.some((gl) => gl.value === layerName)) {
                        L_.Map_.refreshLayer(
                            L_.layers.data[layerName],
                            null,
                            null,
                            true
                        )
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
        [
            inputValue,
            selectedField,
            searchOperator,
            geodatasetLayers,
            vectorSearchLayers,
            checkedLayers,
            saveLayerState,
            matchFeatureValue,
            getL_,
            getMap_,
            getF_,
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
                setPanelOpen(false)
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
            setSubmittedValue(val)
            if (viewMode === VIEW_ADVANCED) {
                // Advanced mode: keep panel open, keep full value list, just execute search
                setInputValue(val)
                handleSearch(val)
            } else {
                // Regular mode: execute search, keep suggestions visible
                setInputValue(val)
                handleSearch(val)
            }
        },
        [handleSearch, viewMode]
    )

    const handleClear = useCallback(() => {
        restoreLayerState()
        setInputValue('')
        setSubmittedValue(null)
        setSuggestions([])
        setShowSuggestions(false)
        setFieldValues([])
        setSelectedField(null)
        setSearchOperator('=')
        setPlaceholder('Search features...')
        setArrayToSearch([])
        // Reset to initial mode (advanced-only when no search constructs)
        setViewMode(vectorLayers.length > 0 ? VIEW_REGULAR : VIEW_ADVANCED)
        const defaultLayer =
            vectorLayers.find((vl) => {
                const L_ = getL_()
                return L_.layers.on[vl.value] === true
            }) || vectorLayers[0] || null
        if (defaultLayer) {
            setSelectedLayer(defaultLayer.value)
            setSearchMode(MODE_LAYER)
        } else {
            setSelectedLayer(null)
            setSearchMode(vectorLayers.length > 0 ? MODE_DEFAULT : MODE_FIELD)
        }
    }, [restoreLayerState, vectorLayers, getL_])

    // Compute client-side aggregations from cached vector layer features
    const computeVectorAggregations = useCallback((fieldName, layerNames) => {
        const F_ = getF_()
        const aggs = {}
        layerNames.forEach((lname) => {
            const geojson = vectorLayerCache.current[lname]
            if (!geojson || !geojson.features) return
            geojson.features.forEach((feat) => {
                if (!feat.properties) return
                const val = F_.getIn(feat.properties, fieldName)
                if (val != null) {
                    const key = String(val)
                    aggs[key] = (aggs[key] || 0) + 1
                }
            })
        })
        return aggs
    }, [getF_])

    // Field selection from the unified panel
    const handleFieldSelect = useCallback(
        (field) => {
            setSearchMode(MODE_FIELD)
            setSelectedField(field)
            setSelectedLayer(null)
            setInputValue('')
            setSubmittedValue(null)
            setFieldValues([])
            setSearchOperator('=')
            setPlaceholder(`Search by ${field.name}...`)
            setFieldFilterText('')

            if (!field.layers || field.layers.length === 0) return

            // Split layers into geodataset and vector, filtered to only checked layers
            const geodatasetLayerNames = field.layers.filter((l) =>
                geodatasetLayers.some((gl) => gl.geodatasetName === l) &&
                checkedLayers.has(l)
            )
            const vectorLayerNames = field.layers.filter((l) =>
                vectorSearchLayers.some((vl) => vl.value === l) &&
                checkedLayers.has(l)
            )

            // Collect vector layer aggregations immediately (client-side)
            const vectorAggs = computeVectorAggregations(field.name, vectorLayerNames)

            // Merge function that combines geodataset and vector aggs
            const mergeAndSetFieldValues = (geoAggs) => {
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
                const vals = keys.map((v) => ({
                    value: v,
                    count: allAggs[v],
                }))
                setFieldValues(vals)
            }

            if (geodatasetLayerNames.length > 0) {
                // Fetch geodataset aggregations via API
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
                        mergeAndSetFieldValues(geoAggs)
                    },
                    function () {
                        mergeAndSetFieldValues({})
                    }
                )
            } else {
                // Only vector layers — just use vector aggs
                mergeAndSetFieldValues({})
            }
        },
        [geodatasetLayers, vectorSearchLayers, computeVectorAggregations, checkedLayers]
    )

    // Toggle a layer in the layers section
    const handleLayerToggle = useCallback((layerKey, layer) => {
        setCheckedLayers((prev) => {
            const next = new Set(prev)
            if (next.has(layerKey)) {
                next.delete(layerKey)
            } else {
                next.add(layerKey)
                // Lazy-load vector layer data when first checked
                if (layer && layer.kind === 'vector') {
                    loadVectorLayerData(layer.value)
                }
            }
            return next
        })
    }, [loadVectorLayerData])

    const handleLayerSelectAll = useCallback(() => {
        const allKeys = new Set([
            ...geodatasetLayers.map((gl) => gl.geodatasetName),
            ...vectorSearchLayers.map((vl) => vl.value),
        ])
        setCheckedLayers(allKeys)
        // Trigger lazy-load for all uncached vector layers
        vectorSearchLayers.forEach((vl) => loadVectorLayerData(vl.value))
    }, [geodatasetLayers, vectorSearchLayers, loadVectorLayerData])

    const handleLayerDeselectAll = useCallback(() => {
        setCheckedLayers(new Set())
    }, [])

    const openPanel = useCallback(() => {
        if (!panelOpen) {
            setPanelOpen(true)
            setFieldFilterText('')
            setLayerFilterText('')
        }
    }, [panelOpen])

    // Select a layer in regular mode (single-select)
    const handleRegularLayerSelect = useCallback((layerValue) => {
        setSelectedLayer(layerValue)
        setSearchMode(MODE_LAYER)
        setInputValue('')
        setSubmittedValue(null)
        setSuggestions([])
        setShowSuggestions(false)
    }, [])

    // Get display name for layer given its key (geodatasetName or layer value)
    const getLayerDisplayName = useCallback(
        (layerKey) => {
            const gl = geodatasetLayers.find(
                (l) => l.geodatasetName === layerKey
            )
            if (gl) return gl.label
            const vl = vectorSearchLayers.find((l) => l.value === layerKey)
            return vl ? vl.label : layerKey
        },
        [geodatasetLayers, vectorSearchLayers]
    )

    // Filtered field list — filter by checked layers + text filter
    // When no layers are checked, show no fields (user must select layers first)
    const layerFilteredFields = checkedLayers.size > 0
        ? (commonFieldsOnly
            ? schemaFields.filter((f) =>
                  [...checkedLayers].every((l) => f.layers.includes(l))
              )
            : schemaFields.filter((f) =>
                  f.layers.some((l) => checkedLayers.has(l))
              ))
        : []
    const filteredFields = fieldFilterText
        ? layerFilteredFields.filter(
              (f) =>
                  f.name
                      .toLowerCase()
                      .indexOf(fieldFilterText.toLowerCase()) !== -1
          )
        : layerFilteredFields

    // Combined layer list: geodatasets + vector layers
    const allLayerList = [...geodatasetLayers, ...vectorSearchLayers]
    const filteredLayerList = layerFilterText
        ? allLayerList.filter(
              (l) => {
                  const q = layerFilterText.toLowerCase()
                  return (
                      l.label.toLowerCase().indexOf(q) !== -1 ||
                      (l.path && l.path.toLowerCase().indexOf(q) !== -1)
                  )
              }
          )
        : allLayerList

    // Operators for current field type
    const ops = selectedField && selectedField.type === 'number' ? NUMBER_OPS : STRING_OPS
    const activeOp = ops.find((o) => o.value === searchOperator) || ops[0]
    const isNullOp = searchOperator === 'isnull' || searchOperator === 'isnotnull'

    if (!initialized) return null

    // Selected layer label for the layers trigger — mode-responsive
    const selectedLayerInfo = (() => {
        if (viewMode === VIEW_ADVANCED) {
            const checked = [...checkedLayers]
            if (checked.length === 0) return { name: 'Layers', extra: 0 }
            const firstName = getLayerDisplayName(checked[0])
            return { name: firstName, extra: checked.length - 1 }
        }
        // Regular mode
        const name = selectedLayer
            ? (vectorLayers.find((vl) => vl.value === selectedLayer)?.label || selectedLayer)
            : 'Layers'
        return { name, extra: 0 }
    })()

    return (
        <div
            id="Search"
            className={`searchBar ${panelOpen ? 'searchBarExpanded' : ''}`}
            ref={panelRef}
        >
            {/* Top bar: [🔍] [Layers ▼] | [Search Input] [⚙] */}
            <div className="searchCompactBar">
                <i className="mdi mdi-magnify mdi-18px searchCompactIcon" onClick={openPanel} />
                {/* Layers trigger */}
                <div
                    className="searchLayersTrigger"
                    onClick={openPanel}
                >
                    <span className="searchLayersTriggerLabel">
                        {selectedLayerInfo.name}
                    </span>
                    {selectedLayerInfo.extra > 0 && (
                        <span className="searchLayersTriggerCount">+{selectedLayerInfo.extra}</span>
                    )}
                    <i className="mdi mdi-chevron-down mdi-14px searchLayersTriggerChevron" />
                </div>
                <div className="searchBarDivider" />
                {/* Search input */}
                <input
                    ref={inputRef}
                    className="searchCompactInput"
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => {
                        setSubmittedValue(null)
                        setInputValue(e.target.value)
                    }}
                    onFocus={openPanel}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                                const sel = suggestions[activeSuggestionIdx]
                                const val = sel != null && typeof sel === 'object' && sel.value != null
                                    ? String(sel.value) : String(sel)
                                setInputValue(val)
                                setShowSuggestions(false)
                                handleSearch(val)
                            } else {
                                handleSearch()
                                setShowSuggestions(false)
                            }
                        } else if (e.key === 'Escape') {
                            setPanelOpen(false)
                            setShowSuggestions(false)
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
                {/* Advanced search toggle (only shown when search constructs exist, otherwise always advanced) */}
                {vectorLayers.length > 0 && (
                    <Tooltip content={viewMode === VIEW_ADVANCED ? 'Simple search' : 'Advanced search'} placement="bottom">
                        <IconButton
                            className={`searchAdvancedToggle ${viewMode === VIEW_ADVANCED ? 'searchAdvancedToggleActive' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                // If panel is closed and already in advanced mode, just re-open
                                if (!panelOpen && viewMode === VIEW_ADVANCED) {
                                    setPanelOpen(true)
                                    return
                                }
                                const newMode = viewMode === VIEW_ADVANCED ? VIEW_REGULAR : VIEW_ADVANCED
                                setViewMode(newMode)
                                if (newMode === VIEW_ADVANCED) {
                                    setCheckedLayers(new Set())
                                    setSuggestions([])
                                    setShowSuggestions(false)
                                    setFieldValues([])
                                    setSelectedField(null)
                                    setSearchMode(MODE_FIELD)
                                    setInputValue('')
                                    setSubmittedValue(null)
                                }
                                if (!panelOpen) setPanelOpen(true)
                            }}
                            size="sm"
                        >
                            <i className="mdi mdi-tune mdi-18px" />
                        </IconButton>
                    </Tooltip>
                )}
            </div>

            {/* Dropdown panel */}
            {panelOpen && viewMode === VIEW_REGULAR && (
                <div className="searchUnifiedPanel searchRegularPanel">
                    <div className="searchUnifiedColumns searchRegularColumns">
                        {/* Column 1: Layers (single-select, search-construct only) */}
                        <div className="searchUnifiedCol searchRegularColLayers">
                            <div className="searchUnifiedColHeader">
                                <span>Layers</span>
                            </div>
                            <div className="searchUnifiedColBody">
                                {vectorLayers.map((layer) => (
                                    <div
                                        key={layer.value}
                                        className={`searchRegularLayerItem ${
                                            selectedLayer === layer.value
                                                ? 'searchRegularLayerItemActive'
                                                : ''
                                        }`}
                                        onClick={() => handleRegularLayerSelect(layer.value)}
                                    >
                                        {layer.label}
                                    </div>
                                ))}
                                {vectorLayers.length === 0 && (
                                    <div className="searchUnifiedEmpty">No search layers</div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Values (autocomplete from layer features) */}
                        <div className="searchUnifiedCol searchRegularColValues">
                            <div className="searchUnifiedColHeader">
                                <span>Values</span>
                            </div>
                            <div className="searchUnifiedColBody">
                                {suggestions.length > 0 ? (
                                    suggestions.map((s, idx) => {
                                        const label = typeof s === 'object' && s.value != null
                                            ? String(s.value)
                                            : String(s)
                                        const isSubmitted = submittedValue != null && label === submittedValue
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
                                                    {label}
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
                </div>
            )}

            {/* Advanced mode panel */}
            {panelOpen && viewMode === VIEW_ADVANCED && (
                <div className="searchUnifiedPanel">
                    <div className="searchUnifiedColumns">
                        {/* Column 1: Layers (multi-select) */}
                        <div className="searchUnifiedCol searchUnifiedColLayers">
                            <div className="searchUnifiedColHeader">
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
                            <div className="searchUnifiedColFilter">
                                <input
                                    ref={layerFilterRef}
                                    type="text"
                                    className="searchUnifiedFilterInput"
                                    placeholder="Filter layers..."
                                    value={layerFilterText}
                                    onChange={(e) =>
                                        setLayerFilterText(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="searchUnifiedColBody">
                                {filteredLayerList.map((layer) => {
                                    const layerKey = layer.kind === 'geodataset'
                                        ? layer.geodatasetName
                                        : layer.value
                                    const isLoading = layer.kind === 'vector' && loadingVectorLayers.has(layer.value)
                                    return (
                                        <div
                                            key={layer.value}
                                            className="searchUnifiedLayerItem"
                                            onClick={() =>
                                                handleLayerToggle(layerKey, layer)
                                            }
                                        >
                                            <Checkbox
                                                checked={checkedLayers.has(layerKey)}
                                                onCheckedChange={() =>
                                                    handleLayerToggle(layerKey, layer)
                                                }
                                                showCheck
                                            >
                                                <span className="searchUnifiedLayerContent">
                                                    {layer.path && (
                                                        <span className="searchUnifiedLayerPath">
                                                            {layer.path}
                                                        </span>
                                                    )}
                                                    <span className="searchUnifiedLayerName">
                                                        {layer.label}
                                                        {isLoading && (
                                                            <i className="mdi mdi-loading mdi-spin mdi-12px searchUnifiedLayerLoading" />
                                                        )}
                                                    </span>
                                                </span>
                                            </Checkbox>
                                        </div>
                                    )
                                })}
                                {filteredLayerList.length === 0 && (
                                    <div className="searchUnifiedEmpty">No layers</div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Fields */}
                        <div className="searchUnifiedCol searchUnifiedColFields">
                            <div className="searchUnifiedColHeader">
                                <span>Field</span>
                                <span className="searchFieldsToggle" onClick={(e) => e.stopPropagation()}>
                                    <span className="searchFieldsToggleLabel">{commonFieldsOnly ? 'Common' : 'All'}</span>
                                    <Switch
                                        size="sm"
                                        checked={commonFieldsOnly}
                                        onCheckedChange={setCommonFieldsOnly}
                                    />
                                </span>
                            </div>
                            <div className="searchUnifiedColFilter">
                                <input
                                    ref={fieldFilterRef}
                                    type="text"
                                    className="searchUnifiedFilterInput"
                                    placeholder="Filter fields..."
                                    value={fieldFilterText}
                                    onChange={(e) =>
                                        setFieldFilterText(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="searchUnifiedColBody">
                                {filteredFields.length === 0 && (
                                    <div className="searchUnifiedEmpty">
                                        {checkedLayers.size === 0
                                            ? 'Select layers first'
                                            : schemaFields.length === 0
                                                ? 'Loading fields...'
                                                : 'No matching fields'}
                                    </div>
                                )}
                                {filteredFields.slice(0, 200).map((field) => (
                                    <div
                                        key={field.name}
                                        className={`searchUnifiedFieldItem ${
                                            selectedField && selectedField.name === field.name
                                                ? 'searchUnifiedFieldItemActive'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            handleFieldSelect(field)
                                        }
                                    >
                                        <span className="searchUnifiedFieldName">
                                            {field.name}
                                        </span>
                                        <span className="searchDropdownFieldType" data-type={field.type}>
                                            {field.type}
                                        </span>
                                        <span className="searchUnifiedFieldLayers">
                                            {(() => {
                                                const visibleLayers = field.layers.filter(
                                                    (l) => checkedLayers.has(l)
                                                )
                                                return (
                                                    <>
                                                        {visibleLayers
                                                            .slice(0, 2)
                                                            .map((l) =>
                                                                getLayerDisplayName(l)
                                                            )
                                                            .join(', ')}
                                                        {visibleLayers.length > 2
                                                            ? ` +${visibleLayers.length - 2}`
                                                            : ''}
                                                    </>
                                                )
                                            })()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 3: Operator */}
                        <div className="searchUnifiedCol searchUnifiedColOp">
                            <div className="searchUnifiedColHeader">
                                <span>Operator</span>
                            </div>
                            <div className="searchUnifiedColBody">
                                {ops.map((op) => (
                                    <div
                                        key={op.value}
                                        className={`searchUnifiedOpItem ${
                                            op.value === searchOperator
                                                ? 'searchUnifiedOpItemActive'
                                                : ''
                                        }`}
                                        onClick={() => {
                                            setSearchOperator(op.value)
                                        }}
                                    >
                                        <span className="searchUnifiedOpIcon">
                                            {op.icon ? (
                                                <i className={`mdi ${op.icon} mdi-14px`} />
                                            ) : (
                                                <span className="searchOperatorText">{op.text}</span>
                                            )}
                                        </span>
                                        <span className="searchUnifiedOpLabel">{op.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 4: Value + autocomplete */}
                        <div className="searchUnifiedCol searchUnifiedColValue">
                            <div className="searchUnifiedColHeader">
                                <span>Value</span>
                            </div>
                            <div className="searchUnifiedValueInputWrap">
                                <input
                                    ref={valueInputRef}
                                    type="text"
                                    className="searchUnifiedValueInput"
                                    placeholder={
                                        isNullOp
                                            ? (searchOperator === 'isnull' ? 'Is Null' : 'Is Not Null')
                                            : selectedField
                                            ? `Search by ${selectedField.name}...`
                                            : 'Select a field first'
                                    }
                                    value={isNullOp ? '' : inputValue}
                                    onChange={(e) => {
                                        if (!isNullOp) {
                                            setSubmittedValue(null)
                                            setInputValue(e.target.value)
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => {
                                        if (isNullOp) return
                                        if (searchMode === MODE_FIELD && fieldValues.length > 0) {
                                            const all = fieldValues.slice(0, 100)
                                            setSuggestions(all)
                                            setShowSuggestions(true)
                                        } else if (suggestions.length > 0) {
                                            setShowSuggestions(true)
                                        }
                                    }}
                                    disabled={isNullOp || !selectedField}
                                    style={isNullOp ? { opacity: 0.4 } : undefined}
                                />
                            </div>
                            <div className="searchUnifiedColBody searchUnifiedValueBody">
                                {showSuggestions && suggestions.length > 0 ? (
                                    suggestions.map((s, idx) => {
                                        const isObj =
                                            s != null &&
                                            typeof s === 'object' &&
                                            s.value != null
                                        const label = isObj
                                            ? String(s.value)
                                            : String(s)
                                        const isSubmitted = submittedValue != null && label === submittedValue
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
                                    })
                                ) : (
                                    !selectedField && (
                                        <div className="searchUnifiedEmpty">
                                            Select a field to see values
                                        </div>
                                    )
                                )}
                                {selectedField && !showSuggestions && fieldValues.length === 0 && (
                                    <div className="searchUnifiedEmpty">
                                        Loading values...
                                    </div>
                                )}
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
