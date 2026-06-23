import React, { useState, useEffect, useRef, useCallback } from 'react'
import { center } from '@turf/turf'

import Select from '../../../../../design-system/components/Select/Select'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'

import calls from '../../../../../pre/calls'

import './Search.css'

const ALL_LAYERS_VALUE = '__ALL_LAYERS__'

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

function SearchBar() {
    const [inputValue, setInputValue] = useState('')
    const [selectedLayer, setSelectedLayer] = useState(null)
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)
    const [layerOptions, setLayerOptions] = useState([])
    const [searchFields, setSearchFields] = useState({})
    const [arrayToSearch, setArrayToSearch] = useState([])
    const lastGeodatasetLayerName = useRef(null)
    const [placeholder, setPlaceholder] = useState('Search...')
    const [initialized, setInitialized] = useState(false)

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)

    const getL_ = useCallback(() => {
        return require('../../../Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('../../../Map_/Map_').default
    }, [])

    // Initialize search when layers are loaded
    useEffect(() => {
        const tryInit = () => {
            const L_ = getL_()
            if (!L_ || !L_.layers || !L_.layers.data) return false

            const searchvars = {}
            for (let l in L_.layers.data) {
                if (
                    L_.layers.data[l].variables &&
                    L_.layers.data[l].variables.search
                )
                    searchvars[l] = L_.layers.data[l].variables.search
            }

            // Also check for geodataset layers (for global search)
            let hasGeodatasetLayers = false
            for (let l in L_.layers.data) {
                if (
                    L_.layers.data[l].url &&
                    L_.layers.data[l].url.startsWith('geodatasets:')
                ) {
                    hasGeodatasetLayers = true
                    break
                }
            }

            if (
                Object.keys(searchvars).length === 0 &&
                !hasGeodatasetLayers
            )
                return false

            const fields = makeSearchFields(searchvars)
            setSearchFields(fields)

            const uuids = []
            const names = []
            for (let l in fields) {
                if (
                    L_.layers.data[l] &&
                    (L_.layers.data[l].type === 'vector' ||
                        L_.layers.data[l].type === 'vectortile')
                ) {
                    uuids.push(l)
                    names.push(L_.layers.data[l].display_name)
                }
            }

            const opts = uuids.map((uuid, idx) => ({
                value: uuid,
                label: names[idx],
            }))

            // Add "All Layers (Fields)" option when geodataset layers exist
            if (hasGeodatasetLayers) {
                opts.unshift({
                    value: ALL_LAYERS_VALUE,
                    label: 'All Layers (Fields)',
                })
            }

            setLayerOptions(opts)

            if (hasGeodatasetLayers && uuids.length === 0) {
                setSelectedLayer(ALL_LAYERS_VALUE)
            } else if (uuids.length > 0) {
                setSelectedLayer(uuids[0])
            }

            // URL param search
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

    // Change search field when layer changes
    useEffect(() => {
        if (!selectedLayer || selectedLayer === ALL_LAYERS_VALUE) {
            setArrayToSearch([])
            if (selectedLayer === ALL_LAYERS_VALUE) {
                setPlaceholder('field:value')
            } else {
                setPlaceholder('Search...')
            }
            return
        }

        const L_ = getL_()
        const Map_ = getMap_()
        if (!Map_ || !L_) return

        const lname = selectedLayer
        const ldata = L_.layers.data[lname]
        if (!ldata) return

        // Turn the layer on if it's off
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
            if (!isNaN(arr[0]))
                arr.sort((a, b) => a - b)
            else arr.sort()
        }

        setArrayToSearch(arr)
        setPlaceholder(getSearchFieldKeys(searchFields, lname) || 'Search...')
    }, [selectedLayer, searchFields, getL_, getMap_])

    // Filter suggestions based on input
    useEffect(() => {
        if (!inputValue || inputValue.length < 1) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        if (selectedLayer === ALL_LAYERS_VALUE) {
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
    }, [inputValue, arrayToSearch, selectedLayer])

    // Close suggestions on outside click
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
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const searchWithURLParams = useCallback(
        (L_, fields) => {
            doWithSearch('both', L_.searchStrings, null, true, null, fields, L_)
        },
        []
    )

    const searchGeodatasets = useCallback(() => {
        const L_ = getL_()
        const Map_ = getMap_()
        const lname = selectedLayer
        const value = inputValue

        let key =
            searchFields[lname] && searchFields[lname][0]
                ? searchFields[lname][0][1]
                : null
        if (key == null) return

        const geodatasetName = L_.layers.data[lname]?.url?.split(':')[1]

        calls.api(
            'geodatasets_search',
            {
                layer: geodatasetName || lastGeodatasetLayerName.current,
                key: key,
                value: value,
            },
            function (d) {
                const r = d.body[0]

                let selectTimeout = setTimeout(() => {
                    L_.layers.layer[lname].off('load')
                    selectFeature()
                }, 1500)

                L_.layers.layer[lname].on('load', function () {
                    L_.layers.layer[lname].off('load')
                    clearTimeout(selectTimeout)
                    selectFeature()
                })

                Map_.map.setView(
                    [r.coordinates[1], r.coordinates[0]],
                    Map_.mapScaleZoom || Map_.map.getZoom()
                )
                if (!L_.layers.on[lname]) {
                    L_.toggleLayer(L_.layers.data[lname])
                }

                function selectFeature() {
                    const vts = L_.layers.layer[lname]._vectorTiles
                    for (let i in vts) {
                        for (let j in vts[i]._features) {
                            const feature = vts[i]._features[j].feature
                            if (feature.properties[key] === value) {
                                feature._layerName = vts[i].options.layerName
                                feature._layer = feature
                                L_.layers.layer[lname]._events.click[0].fn({
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
    }, [selectedLayer, inputValue, searchFields, getL_, getMap_])

    const searchGlobal = useCallback(() => {
        const L_ = getL_()
        const Map_ = getMap_()
        const raw = inputValue.trim()
        const colonIdx = raw.indexOf(':')
        if (colonIdx === -1) return

        const fieldKey = raw.substring(0, colonIdx).trim()
        const fieldVal = raw.substring(colonIdx + 1).trim()
        if (!fieldKey || !fieldVal) return

        // Find all geodataset layers
        const geodatasetLayers = []
        for (let l in L_.layers.data) {
            if (
                L_.layers.data[l].url &&
                L_.layers.data[l].url.startsWith('geodatasets:')
            ) {
                geodatasetLayers.push({
                    name: l,
                    geodatasetName: L_.layers.data[l].url.split(':')[1],
                })
            }
        }

        if (geodatasetLayers.length === 0) return

        // Fan out search calls
        geodatasetLayers.forEach((gl) => {
            calls.api(
                'geodatasets_search',
                {
                    layer: gl.geodatasetName,
                    key: fieldKey,
                    value: fieldVal,
                },
                function (d) {
                    if (d.body && d.body.length > 0) {
                        const r = d.body[0]
                        if (!L_.layers.on[gl.name]) {
                            L_.toggleLayer(L_.layers.data[gl.name])
                        }
                        Map_.map.setView(
                            [r.coordinates[1], r.coordinates[0]],
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
                    }
                },
                function () {}
            )
        })
    }, [inputValue, getL_, getMap_])

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
                    const comparer = getSearchFieldStringForFeature(
                        fields,
                        lname,
                        props
                    )

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
            if (selectedLayer === ALL_LAYERS_VALUE) {
                searchGlobal()
                return
            }

            const L_ = getL_()
            const ltype =
                L_.layers.data[selectedLayer]?.type

            if (ltype === 'vectortile') {
                searchGeodatasets()
            } else {
                doWithSearch('both', null, null, false, value)
            }
        },
        [selectedLayer, searchGeodatasets, searchGlobal, doWithSearch, getL_]
    )

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') {
                if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                    setInputValue(String(suggestions[activeSuggestionIdx]))
                    setShowSuggestions(false)
                    handleSearch(String(suggestions[activeSuggestionIdx]))
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
        (value) => {
            setInputValue(String(value))
            setShowSuggestions(false)
            handleSearch(String(value))
        },
        [handleSearch]
    )

    const handleClear = useCallback(() => {
        setInputValue('')
        setSuggestions([])
        setShowSuggestions(false)
    }, [])

    const handleAdvancedSearch = useCallback(() => {
        const UserInterfaceBridge =
            require('../../UserInterfaceBridge').default
        const rightPanel = document.getElementById('uiRightPanel')

        if (UserInterfaceBridge.rightPanelOpen) {
            UserInterfaceBridge.closeRightPanel()
        } else {
            UserInterfaceBridge.openRightPanel(400)
            if (rightPanel) {
                const { GlobalSearchPanel } = require('./GlobalSearchPanel')
                const { createRoot } = require('react-dom/client')

                let root = rightPanel._reactRoot
                if (!root) {
                    root = createRoot(rightPanel)
                    rightPanel._reactRoot = root
                }
                root.render(
                    React.createElement(GlobalSearchPanel, {
                        onClose: () => {
                            UserInterfaceBridge.closeRightPanel()
                        },
                    })
                )
            }
        }
    }, [])

    const handleLayerChange = useCallback((val) => {
        setSelectedLayer(val)
        setInputValue('')
        setSuggestions([])
        setShowSuggestions(false)
    }, [])

    if (!initialized) return null

    const selectOptions = layerOptions

    return (
        <div id="Search" className="searchBar">
            <Select
                value={selectedLayer}
                onValueChange={handleLayerChange}
                options={selectOptions}
                placeholder="Search Layer..."
                className="searchLayerSelect"
            />
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
                        if (suggestions.length > 0) setShowSuggestions(true)
                    }}
                    tabIndex={401}
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div
                        className="searchSuggestions"
                        ref={suggestionsRef}
                    >
                        {suggestions.map((s, idx) => (
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
                                {String(s)}
                            </div>
                        ))}
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
            <Tooltip content="Advanced Search" placement="bottom">
                <IconButton
                    className="searchAdvancedBtn"
                    onClick={handleAdvancedSearch}
                    size="sm"
                >
                    <i className="mdi mdi-filter-outline mdi-18px" />
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
