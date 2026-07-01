import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { center } from '@turf/turf'

import IconButton from '@design/components/IconButton/IconButton'
import Switch from '@design/components/Switch/Switch'
import Tooltip from '@design/components/Tooltip/Tooltip'

import calls from '@pre/calls'

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

    // Build values array when layer changes (regular mode)
    // When a group is selected, merges suggestions from ALL member layers
    useEffect(() => {
        if (!selectedLayer) return

        const L_ = getL_()
        const Map_ = getMap_()
        if (!Map_ || !L_) return

        // Determine which layers to gather suggestions from
        const targetLayers = selectedGroupId && searchGroups[selectedGroupId]
            ? searchGroups[selectedGroupId].layers.filter((l) => L_.layers.data[l])
            : [selectedLayer]

        if (targetLayers.length === 0) return

        const buildArrayForLayers = (layerNames) => {
            if (valuesIntersectOnly && layerNames.length > 1) {
                // Intersection: only values present in every layer
                const perLayer = layerNames.map((lname) => {
                    const vals = new Set()
                    let data
                    try {
                        data = L_.layers.layer[lname].toGeoJSON(L_.GEOJSON_PRECISION)
                    } catch (err) {
                        data = { features: [] }
                    }
                    for (let i = 0; i < data.features.length; i++) {
                        vals.add(getSearchFieldStringForFeature(searchFields, lname, data.features[i].properties))
                    }
                    return vals
                })
                let intersection = perLayer[0]
                for (let i = 1; i < perLayer.length; i++) {
                    intersection = new Set([...intersection].filter((v) => perLayer[i].has(v)))
                }
                const unique = [...intersection]
                if (unique[0]) {
                    if (!isNaN(unique[0])) unique.sort((a, b) => a - b)
                    else unique.sort()
                }
                setArrayToSearch(unique)
            } else {
                // Union: all values from any layer
                const arr = []
                layerNames.forEach((lname) => {
                    let data
                    try {
                        data = L_.layers.layer[lname].toGeoJSON(L_.GEOJSON_PRECISION)
                    } catch (err) {
                        data = { features: [] }
                    }
                    for (let i = 0; i < data.features.length; i++) {
                        const props = data.features[i].properties
                        arr.push(getSearchFieldStringForFeature(searchFields, lname, props))
                    }
                })
                const unique = [...new Set(arr)]
                if (unique[0]) {
                    if (!isNaN(unique[0])) unique.sort((a, b) => a - b)
                    else unique.sort()
                }
                setArrayToSearch(unique)
            }
            setPlaceholder(getSearchFieldKeys(searchFields, targetLayers[0]) || 'Search...')
        }

        // Turn on any layers that are off (permanently — no restore on clear)
        const layersToToggle = targetLayers.filter((l) => L_.layers.on[l] !== true)
        layersToToggle.forEach((l) => {
            L_.toggleLayer(L_.layers.data[l])
        })

        // Check which layers still need loading
        const allReady = () => targetLayers.every(
            (l) => L_.layers.layer[l] && typeof L_.layers.layer[l].toGeoJSON === 'function'
        )

        if (allReady()) {
            buildArrayForLayers(targetLayers)
        } else {
            let attempts = 0
            const poll = setInterval(() => {
                attempts++
                if (allReady()) {
                    clearInterval(poll)
                    buildArrayForLayers(targetLayers)
                } else if (attempts > 40) {
                    clearInterval(poll)
                    // Build with whatever is available
                    const available = targetLayers.filter(
                        (l) => L_.layers.layer[l] && typeof L_.layers.layer[l].toGeoJSON === 'function'
                    )
                    if (available.length > 0) buildArrayForLayers(available)
                }
            }, 200)
            return () => clearInterval(poll)
        }
    }, [selectedLayer, selectedGroupId, searchGroups, searchFields, getL_, getMap_, valuesIntersectOnly])

    // Compute suggestions based on input
    useEffect(() => {
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
            const L_ = getL_()
            if (!selectedLayer) return

            // Determine which layers to search
            const targetLayers = selectedGroupId && searchGroups[selectedGroupId]
                ? searchGroups[selectedGroupId].layers.filter((l) => L_.layers.data[l])
                : [selectedLayer]

            targetLayers.forEach((lname) => {
                const ltype = L_.layers.data[lname]?.type
                if (ltype === 'vectortile') {
                    searchGeodatasets(lname, searchValue)
                } else {
                    doWithSearch('both', null, lname, false, searchValue)
                }
            })
        },
        [inputValue, selectedLayer, selectedGroupId, searchGroups, searchGeodatasets, doWithSearch, getL_]
    )

    const handleSuggestionClick = useCallback(
        (item) => {
            // Plain text suggestion
            setInputValue(item.label)
            setSubmittedValue(item.label)
            handleSearch(item.label)
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

    const handleRegularLayerSelect = useCallback((layerValue, groupId) => {
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
    }, [])

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
                                {selectedGroupId && (
                                    <Tooltip
                                        content={valuesIntersectOnly ? 'Shared by all layers' : 'From any layer'}
                                        placement="bottom"
                                    >
                                        <div className="searchValuesToggle">
                                            <span className="searchValuesToggleLabel">
                                                {valuesIntersectOnly ? 'Shared' : 'All'}
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
        </div>
    )
}

// Static compatibility properties
SearchBar.height = 43
SearchBar.width = 700

export { makeSearchFields }
export default SearchBar
