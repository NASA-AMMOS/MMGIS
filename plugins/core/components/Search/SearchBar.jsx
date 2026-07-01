import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { center } from '@turf/turf'

import IconButton from '@design/components/IconButton/IconButton'
import Switch from '@design/components/Switch/Switch'
import Tooltip from '@design/components/Tooltip/Tooltip'

import calls from '@pre/calls'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import GeodatasetFilterer from '@basics/Layers_/Filtering/GeodatasetFilterer'

// Convert a user wildcard pattern (using *) into a case-insensitive RegExp
function wildcardToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(escaped.replace(/\*/g, '.*'), 'i')
}

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
    const F_ = require('@basics/Formulae_/Formulae_').default
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

// Returns { label, fields } for a feature — label is the composite display
// string, fields is { fieldName: transformedValue } for each search field.
function getSearchFieldEntryForFeature(searchFields, name, props) {
    const F_ = require('@basics/Formulae_/Formulae_').default
    const fields = {}
    let label = ''
    if (searchFields.hasOwnProperty(name)) {
        const sf = searchFields[name]
        for (let i = 0; i < sf.length; i++) {
            let val = ''
            switch (sf[i][0].toLowerCase()) {
                case '':
                    val = String(F_.getIn(props, sf[i][1]) ?? '')
                    break
                case 'round':
                    val = String(Math.round(F_.getIn(props, sf[i][1])))
                    break
                case 'rmunder':
                    val = F_.getIn(props, sf[i][1])
                        ? String(F_.getIn(props, sf[i][1])).replace('_', ' ')
                        : ''
                    break
            }
            fields[sf[i][1]] = val
            label += val
            if (i !== sf.length - 1) label += ' '
        }
    }
    return { label, fields }
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

function SearchBar({ componentVars }) {
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

    const [geodatasetLayers, setGeodatasetLayers] = useState([])
    const [vectorLayers, setVectorLayers] = useState([])

    // Search groups: { groupId: { label, layers: [...] } }
    const [searchGroups, setSearchGroups] = useState({})
    // Tracks whether a whole group is selected (via header click) vs individual layer
    const [selectedGroupId, setSelectedGroupId] = useState(null)

    // When true, only show values that appear in every layer of the selected group
    const [valuesIntersectOnly, setValuesIntersectOnly] = useState(false)

    // Tracks whether the values-building effect is still running
    const [valuesLoading, setValuesLoading] = useState(false)

    // 'select' (default) = highlight/pan to matches; 'filter' = apply real layer filters
    const [searchMode, setSearchMode] = useState('select')

    // Cached per-layer value sets — avoids re-fetching when toggling All/Common
    const cachedPerLayerValues = useRef({})

    // Tracks layers that have search-applied filters (for clearing on layer switch)
    const searchFilteredLayers = useRef(new Set())

    // Tracks layers turned off by filter mode (to restore on layer switch or mode change)
    const filterModeHiddenLayers = useRef(new Set())

    const lastGeodatasetLayerName = useRef(null)

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const panelRef = useRef(null)

    const getL_ = useCallback(() => {
        return require('@basics/Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('@basics/Map_/Map_').default
    }, [])
    const getF_ = useCallback(() => {
        return require('@basics/Formulae_/Formulae_').default
    }, [])

    // Initialize search when layers are loaded
    useEffect(() => {
        const tryInit = () => {
            const L_ = getL_()
            if (!L_ || !L_.layers || !L_.layers.data) return false

            const searchvars = {}
            const geoLayers = []
            const vecLayers = []
            const groups = {}

            // Build search groups from component config
            const configGroups = (componentVars && componentVars.searchGroups) || []
            // Build a lookup: display_name -> uuid and uuid -> uuid
            const nameToUuid = {}
            for (let l in L_.layers.data) {
                nameToUuid[l] = l
                const dn = L_.layers.data[l].display_name
                if (dn) nameToUuid[dn] = l
            }
            configGroups.forEach((cg) => {
                if (!cg.searchGroup || !cg.layers) return
                const resolvedLayers = []
                ;(Array.isArray(cg.layers) ? cg.layers : []).forEach((ln) => {
                    const uuid = nameToUuid[ln]
                    if (uuid) resolvedLayers.push(uuid)
                })
                if (resolvedLayers.length === 0) return
                groups[cg.searchGroup] = {
                    label: cg.searchGroup,
                    layers: resolvedLayers,
                    searchConstruct: cg.searchConstruct || null,
                }
                // Apply group searchConstruct to member layers that lack their own
                if (cg.searchConstruct) {
                    resolvedLayers.forEach((uuid) => {
                        if (!searchvars[uuid]) {
                            searchvars[uuid] = cg.searchConstruct
                        }
                    })
                }
            })

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
                geoLayers.length === 0
            )
                return false

            setGeodatasetLayers(geoLayers)
            setVectorLayers(vecLayers)

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
    }, [getL_])

    // Merge cached per-layer value Maps into the final arrayToSearch.
    // Each cached value is a Map<label, {label, fields}>.
    // Runs from cache — no network calls. Called after fetch completes
    // and also when valuesIntersectOnly toggles.
    const mergePerLayerValues = useCallback(
        (targetLayers) => {
            const MAX_VALUES = 500
            const allMaps = targetLayers
                .map((l) => cachedPerLayerValues.current[l])
                .filter((m) => m && m.size !== undefined)
            if (allMaps.length === 0) {
                setArrayToSearch([])
                setPlaceholder(getSearchFieldKeys(searchFields, targetLayers[0]) || 'Search...')
                return
            }
            let merged
            if (valuesIntersectOnly && allMaps.length > 1) {
                // Intersection: keep only labels present in ALL maps
                merged = new Map(allMaps[0])
                for (let i = 1; i < allMaps.length; i++) {
                    for (const key of merged.keys()) {
                        if (!allMaps[i].has(key)) merged.delete(key)
                    }
                }
            } else {
                // Union: combine all maps
                merged = new Map()
                allMaps.forEach((m) => {
                    m.forEach((entry, key) => {
                        if (!merged.has(key)) merged.set(key, entry)
                    })
                })
            }
            const entries = [...merged.values()].filter((e) => e && e.label)
            if (entries.length > 0) {
                if (!isNaN(entries[0].label)) entries.sort((a, b) => a.label - b.label)
                else entries.sort((a, b) => a.label > b.label ? 1 : -1)
            }
            setArrayToSearch(entries.slice(0, MAX_VALUES))
            setPlaceholder(getSearchFieldKeys(searchFields, targetLayers[0]) || 'Search...')
        },
        [searchFields, valuesIntersectOnly]
    )

    // Build values array when layer changes (regular mode)
    // When a group is selected, merges suggestions from ALL member layers.
    // Vector layers use client-side toGeoJSON; geodataset layers use the
    // bulk_aggregations backend API so we get the full dataset, not just
    // whatever happens to be in the current viewport.
    // Per-layer results are cached in cachedPerLayerValues so toggling
    // All/Common doesn't re-fetch.
    useEffect(() => {
        if (!selectedLayer) return

        const L_ = getL_()
        const Map_ = getMap_()
        if (!Map_ || !L_) return

        let cancelled = false
        setValuesLoading(true)

        // Determine which layers to gather suggestions from
        const targetLayers = selectedGroupId && searchGroups[selectedGroupId]
            ? searchGroups[selectedGroupId].layers.filter((l) => L_.layers.data[l])
            : [selectedLayer]

        if (targetLayers.length === 0) return

        // Separate geodataset vs non-geodataset layers
        const isGeo = (l) => L_.layers.data[l]?.url?.startsWith('geodatasets:')
        const geoTargets = targetLayers.filter(isGeo)
        const vecTargets = targetLayers.filter((l) => !isGeo(l))

        // --- Vector layers: client-side toGeoJSON ---
        const processVecLayers = (layerNames) => {
            layerNames.forEach((lname) => {
                const vals = new Map()
                let data
                try {
                    data = L_.layers.layer[lname].toGeoJSON(L_.GEOJSON_PRECISION)
                } catch (err) {
                    data = { features: [] }
                }
                for (let i = 0; i < data.features.length; i++) {
                    const entry = getSearchFieldEntryForFeature(searchFields, lname, data.features[i].properties)
                    if (entry.label && !vals.has(entry.label)) {
                        vals.set(entry.label, entry)
                    }
                }
                cachedPerLayerValues.current[lname] = vals
            })
        }

        // --- Geodataset layers: backend bulk_aggregations API ---
        const processGeoLayers = () => {
            if (geoTargets.length === 0) return Promise.resolve()
            return Promise.all(geoTargets.map((lname) => {
                return new Promise((resolve) => {
                    const geodatasetName = L_.layers.data[lname]?.url?.split(':')[1]
                    if (!geodatasetName) {
                        cachedPerLayerValues.current[lname] = new Map()
                        resolve()
                        return
                    }
                    calls.api(
                        'geodatasets_bulk_aggregations',
                        { layers: geodatasetName, limit: 1000 },
                        (d) => {
                            const vals = new Map()
                            if (d?.status === 'success' && d.aggregations) {
                                const sf = searchFields[lname]
                                if (sf && sf.length > 0) {
                                    // For single-field constructs, build complete entries.
                                    // For multi-field, use the first field's values as labels.
                                    if (sf.length === 1) {
                                        const fieldName = sf[0][1]
                                        const transform = sf[0][0].toLowerCase()
                                        const fieldAgg = d.aggregations[fieldName]
                                        if (fieldAgg) {
                                            Object.keys(fieldAgg.aggs).forEach((val) => {
                                                let v = val
                                                if (transform === 'round') v = String(Math.round(Number(v)))
                                                else if (transform === 'rmunder') v = String(v).replace(/_/g, ' ')
                                                if (v && !vals.has(v)) {
                                                    vals.set(v, { label: v, fields: { [fieldName]: v } })
                                                }
                                            })
                                        }
                                    } else {
                                        // Multi-field: build entries from raw row data if available
                                        if (d.rows) {
                                            d.rows.forEach((row) => {
                                                const entry = getSearchFieldEntryForFeature(searchFields, lname, row)
                                                if (entry.label && !vals.has(entry.label)) {
                                                    vals.set(entry.label, entry)
                                                }
                                            })
                                        } else {
                                            // Fallback: use first field values only
                                            const fieldName = sf[0][1]
                                            const transform = sf[0][0].toLowerCase()
                                            const fieldAgg = d.aggregations[fieldName]
                                            if (fieldAgg) {
                                                Object.keys(fieldAgg.aggs).forEach((val) => {
                                                    let v = val
                                                    if (transform === 'round') v = String(Math.round(Number(v)))
                                                    else if (transform === 'rmunder') v = String(v).replace(/_/g, ' ')
                                                    if (v && !vals.has(v)) {
                                                        vals.set(v, { label: v, fields: { [fieldName]: v } })
                                                    }
                                                })
                                            }
                                        }
                                    }
                                }
                            }
                            cachedPerLayerValues.current[lname] = vals
                            resolve()
                        },
                        () => {
                            cachedPerLayerValues.current[lname] = new Map()
                            resolve()
                        }
                    )
                })
            }))
        }

        // Turn on layers that are off (permanently)
        targetLayers.filter((l) => L_.layers.on[l] !== true).forEach((l) => {
            L_.toggleLayer(L_.layers.data[l])
        })

        // Wait for vector layers to load, then process both sources
        const allVecReady = () => vecTargets.every(
            (l) => L_.layers.layer[l] && typeof L_.layers.layer[l].toGeoJSON === 'function'
        )

        const finalize = () => {
            if (cancelled) return
            setValuesLoading(false)
            mergePerLayerValues(targetLayers)
        }

        const buildAll = (availableVec) => {
            processVecLayers(availableVec)
            processGeoLayers().then(finalize)
        }

        if (vecTargets.length === 0 || allVecReady()) {
            buildAll(vecTargets)
        } else {
            let attempts = 0
            const poll = setInterval(() => {
                if (cancelled) { clearInterval(poll); return }
                attempts++
                if (allVecReady()) {
                    clearInterval(poll)
                    buildAll(vecTargets)
                } else if (attempts > 40) {
                    clearInterval(poll)
                    const available = vecTargets.filter(
                        (l) => L_.layers.layer[l] && typeof L_.layers.layer[l].toGeoJSON === 'function'
                    )
                    buildAll(available)
                }
            }, 200)
        }

        return () => { cancelled = true; setValuesLoading(false) }
    }, [selectedLayer, selectedGroupId, searchGroups, searchFields, getL_, getMap_, mergePerLayerValues])

    // Re-merge cached values when All/Common toggle changes (no re-fetch)
    useEffect(() => {
        if (!selectedLayer) return
        const L_ = getL_()
        if (!L_) return

        const targetLayers = selectedGroupId && searchGroups[selectedGroupId]
            ? searchGroups[selectedGroupId].layers.filter((l) => L_.layers.data[l])
            : [selectedLayer]

        // Only re-merge if we have cached data
        const hasCached = targetLayers.some((l) => cachedPerLayerValues.current[l])
        if (hasCached) {
            mergePerLayerValues(targetLayers)
        }
    }, [valuesIntersectOnly, selectedLayer, selectedGroupId, searchGroups, mergePerLayerValues, getL_])

    // Compute suggestions based on input.
    // arrayToSearch items are { label, fields } objects.
    // Supports * wildcard matching (e.g. "* my_cat" matches any name + category).
    useEffect(() => {
        const MAX_SUGGESTIONS = 500

        const toSuggestion = (item) => ({
            type: 'plain',
            label: item.label,
            fields: item.fields,
        })

        if (!selectedLayer || !inputValue) {
            const all = arrayToSearch.slice(0, MAX_SUGGESTIONS).map(toSuggestion)
            setSuggestions(all)
            setShowSuggestions(all.length > 0 && panelOpen)
            setActiveSuggestionIdx(-1)
            return
        }

        const isSubmitted = submittedValue != null && inputValue === submittedValue
        if (isSubmitted) {
            const all = arrayToSearch.slice(0, MAX_SUGGESTIONS).map(toSuggestion)
            setSuggestions(all)
            setShowSuggestions(all.length > 0 && panelOpen)
            setActiveSuggestionIdx(-1)
            return
        }

        const hasWildcard = inputValue.includes('*')
        let filtered

        if (hasWildcard) {
            const re = wildcardToRegex(inputValue)
            filtered = arrayToSearch
                .filter((item) => re.test(item.label))
                .slice(0, MAX_SUGGESTIONS)
                .map(toSuggestion)
        } else {
            const query = inputValue.toLowerCase()
            filtered = arrayToSearch
                .filter((item) => item.label.toLowerCase().indexOf(query) !== -1)
                .slice(0, MAX_SUGGESTIONS)
                .map(toSuggestion)
            filtered.sort((a, b) => {
                const aIdx = a.label.toLowerCase().indexOf(query)
                const bIdx = b.label.toLowerCase().indexOf(query)
                if (aIdx !== bIdx) return aIdx - bIdx
                return a.label > b.label ? 1 : -1
            })
        }
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0 && panelOpen)
        setActiveSuggestionIdx(-1)
    }, [inputValue, arrayToSearch, submittedValue, panelOpen, selectedLayer])

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
                !panelRef.current.contains(e.target)
            ) {
                setPanelOpen(false)
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Listen for keyboard shortcut to focus search
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

    // Search a geodataset layer via the backend API.
    // parsedFields: optional { fieldName: value } for per-field search.
    // skipPan: if true, don't pan/select — just return the result feature.
    // Returns a Promise that resolves with the matched feature (or null).
    const searchGeodatasets = useCallback(
        (lname, value, parsedFields, skipPan) => {
            const L_ = getL_()
            const Map_ = getMap_()
            const layerName = lname || selectedLayer
            const sf = searchFields[layerName]

            // Determine the search key and value.
            // If parsedFields is provided, use the first field's actual value
            // instead of the full composite string.
            let key = sf && sf[0] ? sf[0][1] : null
            if (key == null) return Promise.resolve(null)

            let searchValue
            if (parsedFields && parsedFields[key] != null) {
                searchValue = String(parsedFields[key])
            } else if (sf && sf.length === 1) {
                searchValue = value || inputValue
            } else {
                // Multi-field construct without parsed fields — use first field value
                // from the composite by splitting from right (best effort)
                searchValue = value || inputValue
                if (parsedFields) {
                    // parsedFields provided but doesn't have this key — skip
                    searchValue = String(Object.values(parsedFields)[0] || value || inputValue)
                }
            }

            const geodatasetName = L_.layers.data[layerName]?.url?.split(':')[1]

            return new Promise((resolve) => {
                calls.api(
                    'geodatasets_search',
                    {
                        layer: geodatasetName || lastGeodatasetLayerName.current,
                        key: key,
                        value: searchValue,
                    },
                    function (d) {
                        if (!d.body || d.body.length === 0) { resolve(null); return }
                        const r = d.body[0]

                        if (skipPan) { resolve(r); return }

                        const c = center(r)
                        const coords = c.geometry.coordinates
                        Map_.map.setView(
                            [coords[1], coords[0]],
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
                        if (!L_.layers.on[layerName]) {
                            L_.toggleLayer(L_.layers.data[layerName])
                        }

                        const layer = L_.layers.layer[layerName]
                        if (!layer) { resolve(r); return }

                        // Vectortile layers use _vectorTiles
                        if (layer._vectorTiles) {
                            let selectTimeout = setTimeout(() => {
                                layer.off('load')
                                selectVTFeature()
                            }, 1500)

                            layer.on('load', function () {
                                layer.off('load')
                                clearTimeout(selectTimeout)
                                selectVTFeature()
                            })

                            function selectVTFeature() {
                                const vts = layer._vectorTiles
                                for (let i in vts) {
                                    for (let j in vts[i]._features) {
                                        const feature = vts[i]._features[j].feature
                                        if (feature.properties[key] === searchValue) {
                                            feature._layerName = vts[i].options.layerName
                                            feature._layer = feature
                                            layer._events.click[0].fn({
                                                layer: feature,
                                                sourceTarget: feature,
                                            })
                                            resolve(r)
                                            return
                                        }
                                    }
                                }
                                resolve(r)
                            }
                        } else if (typeof layer.eachLayer === 'function') {
                            // Regular vector geodataset layers — use selectFeature
                            // which persists through dynamic extent refreshes
                            L_.selectFeature(layerName, r)
                            resolve(r)
                        } else {
                            resolve(r)
                        }
                    },
                    function () { resolve(null) }
                )
            })
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
                // Build regex matchers for wildcard patterns
                const xRegex = x.map((v) => v.includes('*') ? wildcardToRegex(v) : null)

                markers.eachLayer((layer) => {
                    const props = layer.feature.properties
                    let shouldSearch = false
                    const comparer = getSearchFieldStringForFeature(fields, lname, props)

                    for (let i = 0; i < x.length; i++) {
                        if (xRegex[i]) {
                            if (xRegex[i].test(comparer)) {
                                shouldSearch = true
                                break
                            }
                        } else if (
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

    // Apply a real Filtering filter to a layer based on the search construct and value.
    // parsedFields is an optional { fieldName: value } map from the suggestion item;
    // when provided, it is used directly instead of trying to decompose the composite string.
    const applyFilterToLayer = useCallback(
        (lname, searchValue, parsedFields) => {
            const L_ = getL_()
            const sf = searchFields[lname]
            if (!sf || sf.length === 0) return

            const ld = L_.layers.data[lname]
            if (!ld) return

            const isGeodataset = ld.url?.startsWith('geodatasets:')

            // Build filter values: one per search construct field
            const filterValues = []
            sf.forEach((field, idx) => {
                const fieldName = field[1]
                let part
                if (parsedFields && parsedFields[fieldName] != null) {
                    part = parsedFields[fieldName]
                } else if (parsedFields) {
                    // parsedFields provided but this field is missing — skip it.
                    // Don't fall back to decomposition which would produce
                    // wrong values (e.g. "Twin Peaks" → name=Twin, category=Peaks).
                    return
                } else if (sf.length === 1) {
                    part = searchValue
                } else {
                    // Fallback for free-typed text without pre-parsed fields:
                    // split from the right — last N-1 tokens go to last N-1 fields,
                    // everything remaining goes to the first field.
                    const tokens = searchValue.split(/\s+/)
                    const tailTokens = tokens.slice(-(sf.length - 1))
                    const firstFieldTokenCount = tokens.length - (sf.length - 1)
                    const parts = [tokens.slice(0, Math.max(firstFieldTokenCount, 1)).join(' '), ...tailTokens]
                    part = parts[idx]
                }
                if (part == null || part === '' || part === '*') return

                // Determine type from aggregations if available
                const aggs = Filtering.filters[lname]?.aggs
                let type = 'string'
                if (aggs && aggs[fieldName]) {
                    type = aggs[fieldName].type || 'string'
                }

                // Check if the value is a wildcard pattern
                const hasWildcard = String(part).includes('*')
                filterValues.push({
                    id: idx,
                    key: fieldName,
                    op: hasWildcard ? 'contains' : '=',
                    value: hasWildcard ? String(part).replace(/\*/g, '') : String(part),
                    type: type,
                })
            })

            if (filterValues.length === 0) return

            // Initialize Filtering.filters for this layer if needed
            Filtering.filters[lname] = Filtering.filters[lname] || {
                spatial: { center: null, radius: 0 },
                values: [],
                geojson: null,
            }

            // Set the filter values
            Filtering.filters[lname].values = filterValues

            if (isGeodataset) {
                // Geodataset layers: use GeodatasetFilterer to build the
                // _filterEncoded, but skip the built-in refreshLayer call.
                // refreshLayer's isRefresh toggle cycle has a state bug that
                // removes the newly-added layer. The caller (handleSearch)
                // handles the refresh by toggling the layer off/on instead.
                GeodatasetFilterer.filter(lname, Filtering.filters[lname], null, true)
            } else {
                // Local vector layers: need geojson cached for LocalFilterer
                if (
                    !Filtering.filters[lname].geojson &&
                    L_.layers.layer[lname] &&
                    typeof L_.layers.layer[lname].toGeoJSON === 'function'
                ) {
                    Filtering.filters[lname].geojson =
                        L_.layers.layer[lname].toGeoJSON(L_.GEOJSON_PRECISION)
                }
                Filtering.submit(lname, false)
            }

            // Track this layer as having a search-applied filter
            searchFilteredLayers.current.add(lname)

            // Refresh the LayersTool Filtering panel if it's open for this layer
            if (Filtering.current.layerName === lname) {
                Filtering.refresh()
            }
        },
        [searchFields, getL_]
    )

    const handleSearch = useCallback(
        async (value, parsedFields) => {
            const searchValue = value != null ? value : inputValue
            const L_ = getL_()
            const Map_ = getMap_()
            if (!selectedLayer) return

            // Determine which layers to search
            const targetLayers = selectedGroupId && searchGroups[selectedGroupId]
                ? searchGroups[selectedGroupId].layers.filter((l) => L_.layers.data[l])
                : [selectedLayer]

            if (searchMode === 'filter') {
                const targetSet = new Set(targetLayers)

                // Turn off all non-target vector/vectortile/query layers
                const hidePromises = []
                for (const lname in L_.layers.data) {
                    if (targetSet.has(lname)) continue
                    const ld = L_.layers.data[lname]
                    if (!ld) continue
                    const t = ld.type
                    if ((t === 'vector' || t === 'vectortile' || t === 'query') && L_.layers.on[lname]) {
                        hidePromises.push(L_.toggleLayer(ld))
                        filterModeHiddenLayers.current.add(lname)
                    }
                }

                // Ensure target layers are on (await each toggle)
                for (const lname of targetLayers) {
                    if (!L_.layers.on[lname]) {
                        await L_.toggleLayer(L_.layers.data[lname])
                    }
                }

                // Apply filters after layers are ready
                targetLayers.forEach((lname) => {
                    applyFilterToLayer(lname, searchValue, parsedFields)
                })

                // Refresh geodataset layers to apply the filter.
                // applyFilterToLayer skips refreshLayer for geodatasets (to avoid
                // the broken isRefresh toggle cycle). Instead we toggle off/on
                // which properly re-fetches data with the new _filterEncoded.
                const geoTargetLayers = targetLayers.filter(
                    (l) => L_.layers.data[l]?.url?.startsWith('geodatasets:')
                )
                for (const lname of geoTargetLayers) {
                    if (L_.layers.on[lname]) {
                        await L_.toggleLayer(L_.layers.data[lname]) // OFF
                        await L_.toggleLayer(L_.layers.data[lname]) // ON with filter
                    }
                }

                // Pan to matching features.
                // For geodatasets: search by per-field value, collect results, combined pan.
                // For vectors: iterate the now-filtered layer.
                const geoResults = []
                const vecFeatures = []

                const geoPromises = geoTargetLayers
                    .map((lname) =>
                        searchGeodatasets(lname, searchValue, parsedFields, true)
                            .then((r) => { if (r) geoResults.push({ layerName: lname, feature: r }) })
                    )

                targetLayers
                    .filter((l) => !L_.layers.data[l]?.url?.startsWith('geodatasets:'))
                    .forEach((lname) => {
                        const layer = L_.layers.layer[lname]
                        if (!layer || typeof layer.eachLayer !== 'function') return
                        layer.eachLayer((feat) => vecFeatures.push(feat))
                    })

                await Promise.all(geoPromises)

                // Combine all features for a single pan
                const allPanTargets = [...vecFeatures]
                geoResults.forEach((gr) => {
                    // Wrap GeoJSON feature as a pseudo-layer for getMapZoomCoordinate
                    allPanTargets.push({ feature: gr.feature })
                })

                if (vecFeatures.length === 1) {
                    L_.highlight(vecFeatures[0])
                    vecFeatures[0].fireEvent('click')
                    if (typeof vecFeatures[0].bringToFront === 'function')
                        vecFeatures[0].bringToFront()
                }

                if (geoResults.length === 1 && vecFeatures.length === 0) {
                    // Single geodataset result — select it
                    L_.selectFeature(geoResults[0].layerName, geoResults[0].feature)
                }

                if (allPanTargets.length > 0 && Map_) {
                    const coordinate = getMapZoomCoordinate(allPanTargets)
                    if (coordinate) {
                        Map_.map.setView(
                            [coordinate.latitude, coordinate.longitude],
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
                    }
                }
            } else {
                // Select mode: highlight/pan to matches.
                // For groups: collect all geodataset results for combined pan.
                const isGroup = targetLayers.length > 1
                if (isGroup) {
                    const geoResults = []
                    const vecLayers = []

                    targetLayers.forEach((lname) => {
                        const ld = L_.layers.data[lname]
                        const isGeodataset = ld?.url?.startsWith('geodatasets:')
                        if (ld?.type === 'vectortile' || isGeodataset) {
                            // Will collect results below
                        } else {
                            vecLayers.push(lname)
                        }
                    })

                    // Non-geodataset layers: use doWithSearch for each
                    vecLayers.forEach((lname) => {
                        doWithSearch('both', null, lname, false, searchValue)
                    })

                    // Geodataset layers: collect results, then combined pan
                    const geoPromises = targetLayers
                        .filter((l) => {
                            const ld = L_.layers.data[l]
                            return ld?.url?.startsWith('geodatasets:') || ld?.type === 'vectortile'
                        })
                        .map((lname) =>
                            searchGeodatasets(lname, searchValue, parsedFields, true)
                                .then((r) => { if (r) geoResults.push({ layerName: lname, feature: r }) })
                        )

                    Promise.all(geoPromises).then(() => {
                        if (geoResults.length === 0) return

                        // Pan to show all results
                        const panTargets = geoResults.map((gr) => ({ feature: gr.feature }))
                        if (panTargets.length > 0 && Map_) {
                            const coordinate = getMapZoomCoordinate(panTargets)
                            if (coordinate) {
                                Map_.map.setView(
                                    [coordinate.latitude, coordinate.longitude],
                                    Map_.mapScaleZoom || Map_.map.getZoom()
                                )
                            }
                        }

                        // Select single result
                        if (geoResults.length === 1) {
                            const gr = geoResults[0]
                            if (!L_.layers.on[gr.layerName]) {
                                L_.toggleLayer(L_.layers.data[gr.layerName])
                            }
                            L_.selectFeature(gr.layerName, gr.feature)
                        }
                    })
                } else {
                    // Single layer select mode
                    targetLayers.forEach((lname) => {
                        const ld = L_.layers.data[lname]
                        const isGeodataset = ld?.url?.startsWith('geodatasets:')
                        if (ld?.type === 'vectortile' || isGeodataset) {
                            searchGeodatasets(lname, searchValue, parsedFields)
                        } else {
                            doWithSearch('both', null, lname, false, searchValue)
                        }
                    })
                }
            }
        },
        [inputValue, selectedLayer, selectedGroupId, searchGroups, searchMode, searchGeodatasets, doWithSearch, applyFilterToLayer, getL_, getMap_]
    )

    const handleSuggestionClick = useCallback(
        (item) => {
            setInputValue(item.label)
            setSubmittedValue(item.label)
            handleSearch(item.label, item.fields)
        },
        [handleSearch]
    )

    const handleClear = useCallback(() => {
        setInputValue('')
        setSubmittedValue(null)
        setSuggestions([])
        setShowSuggestions(false)
        setPlaceholder('Search features...')
        // Preserve arrayToSearch so re-opening the panel still shows suggestions
        // (the rebuild effect won't re-run because selectedLayer hasn't changed)
    }, [])

    // Clear any search-applied filters and restore hidden layers
    const clearSearchFilters = useCallback(() => {
        const L_ = getL_()
        if (!L_) return

        // Clear filters from tracked layers
        searchFilteredLayers.current.forEach((lname) => {
            const ld = L_.layers.data[lname]
            if (!ld) return
            if (Filtering.filters[lname]) {
                Filtering.filters[lname].values = []
            }
            const isGeodataset = ld.url?.startsWith('geodatasets:')
            if (isGeodataset) {
                if (ld._filterEncoded) {
                    delete ld._filterEncoded.filters
                }
                if (L_.layers.on[lname]) {
                    L_.Map_.refreshLayer(ld)
                }
            } else {
                if (Filtering.filters[lname]) {
                    Filtering.submit(lname, false)
                }
            }
        })
        searchFilteredLayers.current.clear()

        // Restore layers that were hidden by filter mode
        filterModeHiddenLayers.current.forEach((lname) => {
            const ld = L_.layers.data[lname]
            if (ld && !L_.layers.on[lname]) {
                L_.toggleLayer(ld)
            }
        })
        filterModeHiddenLayers.current.clear()

        Filtering.refresh()
    }, [getL_])

    const handleRegularLayerSelect = useCallback((layerValue, groupId) => {
        // Clear any active search filters before switching
        clearSearchFilters()

        setSelectedLayer((prev) => {
            if (prev === layerValue) {
                // Same layer — force suggestion rebuild by creating a new array ref
                setArrayToSearch((arr) => [...arr])
            } else {
                // Different layer — clear stale suggestions until new data loads
                setArrayToSearch([])
            }
            return layerValue
        })
        setSelectedGroupId(groupId || null)
        setInputValue('')
        setSubmittedValue(null)
    }, [clearSearchFilters])

    const openPanel = useCallback(() => {
        if (!panelOpen) {
            setPanelOpen(true)
        }
    }, [panelOpen])

    // Layer items for the regular panel (layers with search constructs + groups)
    // Shows group headers with indented member layers, then ungrouped layers
    const layerListItems = useMemo(() => {
        const items = []
        const grouped = new Set()

        // Build display-name lookup
        const layerLabelMap = {}
        vectorLayers.forEach((vl) => { layerLabelMap[vl.value] = vl.label || vl.value })
        geodatasetLayers.forEach((gl) => { layerLabelMap[gl.value] = gl.label || gl.value })

        // Add search group entries with member layers
        Object.entries(searchGroups).forEach(([gid, group]) => {
            // Group header
            items.push({
                value: group.layers[0],
                label: group.label,
                isGroup: true,
                groupId: gid,
                layers: group.layers,
            })
            // Member layers indented
            group.layers.forEach((l) => {
                grouped.add(l)
                items.push({
                    value: l,
                    label: layerLabelMap[l] || l,
                    isGroup: false,
                    isGroupMember: true,
                    parentGroupId: gid,
                })
            })
        })

        // Add individual layers that aren't in a group
        vectorLayers.forEach((vl) => {
            if (!grouped.has(vl.value)) {
                items.push({ ...vl, isGroup: false, isGroupMember: false })
            }
        })

        return items
    }, [vectorLayers, geodatasetLayers, searchGroups])

    // Selected layer label for the trigger
    const selectedLayerLabel = useMemo(() => {
        if (!selectedLayer) return 'Layers'
        const item = layerListItems.find((li) =>
            li.isGroup ? li.layers.includes(selectedLayer) : li.value === selectedLayer
        )
        return item ? item.label : selectedLayer
    }, [selectedLayer, layerListItems])



    if (!initialized) return null

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
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => {
                        setSubmittedValue(null)
                        setInputValue(e.target.value)
                        if (!panelOpen) setPanelOpen(true)
                    }}
                    onFocus={() => {
                        openPanel()
                        if (arrayToSearch.length > 0) {
                            setShowSuggestions(true)
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                                handleSuggestionClick(suggestions[activeSuggestionIdx])
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
                <div className="searchBarDivider" />
                <Tooltip
                    content={searchMode === 'select' ? 'Select: highlight matching features' : 'Filter: show only matching features'}
                    placement="bottom"
                >
                    <div
                        className={`searchModeToggle ${searchMode === 'filter' ? 'searchModeToggleActive' : ''}`}
                        onClick={() => setSearchMode((m) => m === 'select' ? 'filter' : 'select')}
                    >
                        <i className={`mdi ${searchMode === 'select' ? 'mdi-crosshairs-gps' : 'mdi-filter'} mdi-16px`} />
                        <span className="searchModeToggleLabel">
                            {searchMode === 'select' ? 'Select' : 'Filter'}
                        </span>
                    </div>
                </Tooltip>
            </div>

            {/* Dropdown panel */}
            {panelOpen && (
                <div className="searchUnifiedPanel searchRegularPanel">
                    {/* Regular mode: Layers + Values */}
                    <div className="searchUnifiedColumns searchRegularColumns">
                        {/* Column 1: Layers */}
                        <div className="searchUnifiedCol searchRegularColLayers">
                            <div className="searchUnifiedColHeader">
                                <span>Layers</span>
                            </div>
                            <div className="searchUnifiedColBody">
                                {layerListItems.map((item, idx) => {
                                    // Group header: highlight if group was selected via header click
                                    const isActiveGroup = item.isGroup &&
                                        selectedGroupId === item.groupId
                                    // Group member: highlight if entire group selected via header,
                                    // OR if this specific layer was individually selected
                                    const isActiveMember = item.isGroupMember && (
                                        selectedGroupId === item.parentGroupId ||
                                        (!selectedGroupId && selectedLayer === item.value)
                                    )
                                    // Ungrouped layer
                                    const isActiveUngrouped = !item.isGroup && !item.isGroupMember &&
                                        selectedLayer === item.value
                                    const isActive = isActiveGroup || isActiveMember || isActiveUngrouped
                                    return (
                                    <div
                                        key={item.isGroup ? `group-${item.groupId}` : `${item.value}-${idx}`}
                                        className={`searchRegularLayerItem ${
                                            item.isGroup
                                                ? 'searchRegularLayerItemGroup'
                                                : item.isGroupMember
                                                ? 'searchRegularLayerItemGroupMember'
                                                : ''
                                        } ${isActive ? 'searchRegularLayerItemActive' : ''}`}
                                        onClick={() => {
                                            if (item.isGroup) {
                                                handleRegularLayerSelect(item.layers[0], item.groupId)
                                            } else {
                                                handleRegularLayerSelect(item.value)
                                            }
                                        }}
                                    >
                                        {item.isGroup && (
                                            <i className="mdi mdi-folder-outline mdi-14px searchGroupIcon" />
                                        )}
                                        <span className="searchRegularLayerLabel">{item.label}</span>
                                        {item.isGroup && (
                                            <span className="searchRegularLayerDetail">{item.layers.length} layers</span>
                                        )}
                                    </div>
                                    )
                                })}
                                {layerListItems.length === 0 && (
                                    <div className="searchUnifiedEmpty">No search layers</div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Values */}
                        <div className="searchUnifiedCol searchRegularColValues">
                            <div className="searchUnifiedColHeader">
                                <span>Values</span>
                                {arrayToSearch.length >= 500 && (
                                    <span className="searchValuesCount">Top 500</span>
                                )}
                                {selectedGroupId && (
                                    <Tooltip
                                        content={valuesIntersectOnly ? 'Common to all layers' : 'From any layer'}
                                        placement="bottom"
                                    >
                                        <div className="searchValuesToggle">
                                            <span className="searchValuesToggleLabel">
                                                {valuesIntersectOnly ? 'Common' : 'All'}
                                            </span>
                                            <Switch
                                                checked={valuesIntersectOnly}
                                                onCheckedChange={setValuesIntersectOnly}
                                                size="sm"
                                            />
                                        </div>
                                    </Tooltip>
                                )}
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
                                            : valuesLoading
                                            ? 'Loading...'
                                            : arrayToSearch.length === 0
                                            ? (valuesIntersectOnly ? 'No common values' : 'No values')
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
        </div>
    )
}

// Static compatibility properties
SearchBar.height = 43
SearchBar.width = 700

export { makeSearchFields }
export default SearchBar
