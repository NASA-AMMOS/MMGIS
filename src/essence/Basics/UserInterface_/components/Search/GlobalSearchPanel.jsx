import React, { useState, useEffect, useCallback, useRef } from 'react'

import Button from '../../../../../design-system/components/Button/Button'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
import Select from '../../../../../design-system/components/Select/Select'
import Tooltip from '../../../../../design-system/components/Tooltip/Tooltip'

import calls from '../../../../../pre/calls'

import './GlobalSearchPanel.css'

const OPERATORS = [
    { value: '=', label: '=' },
    { value: '!=', label: '!=' },
    { value: 'in', label: 'in' },
    { value: '<', label: '<' },
    { value: '>', label: '>' },
    { value: '<=', label: '<=' },
    { value: '>=', label: '>=' },
    { value: 'contains', label: 'contains' },
    { value: 'beginswith', label: 'begins with' },
    { value: 'endswith', label: 'ends with' },
]

const GROUP_OPERATORS = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'NOT_AND', label: 'NOT AND' },
    { value: 'NOT_OR', label: 'NOT OR' },
]

const TYPE_OPTIONS = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
]

const PAGE_SIZE = 50

let nextFilterId = 1

function createFilterRow() {
    return { id: nextFilterId++, key: '', op: '=', value: '', type: 'string' }
}
function createGroupRow() {
    return { id: nextFilterId++, isGroup: true, op: 'AND' }
}

function encodeFilters(filterValues) {
    const encoded = []
    filterValues.forEach((v) => {
        if (v.value != null && v.key != null && !v.isGroup)
            encoded.push(
                `${v.key}+${v.op === ',' ? 'in' : v.op}+${v.type}+${v.value.replaceAll(',', '$')}`
            )
        else if (v.isGroup === true && v.op != null) encoded.push(`${v.op}`)
    })
    return encoded.join(',')
}

function FilterRow({ row, onChange, onRemove, aggregationKeys, aggregationValues }) {
    if (row.isGroup) {
        return (
            <div className="gspFilterGroup">
                <Select
                    value={row.op}
                    onValueChange={(val) => onChange({ ...row, op: val })}
                    options={GROUP_OPERATORS}
                    className="gspGroupOpSelect"
                />
                <Tooltip content="Remove group operator" placement="left">
                    <IconButton onClick={onRemove} size="sm">
                        <i className="mdi mdi-close mdi-14px" />
                    </IconButton>
                </Tooltip>
            </div>
        )
    }

    return (
        <div className="gspFilterRow">
            <div className="gspFilterRowInputs">
                <input
                    className="gspInput gspKeyInput"
                    type="text"
                    placeholder="Property key"
                    value={row.key}
                    onChange={(e) => onChange({ ...row, key: e.target.value })}
                    list={`keys-${row.id}`}
                />
                <datalist id={`keys-${row.id}`}>
                    {aggregationKeys.map((k) => (
                        <option key={k} value={k} />
                    ))}
                </datalist>
                <Select
                    value={row.op}
                    onValueChange={(val) => onChange({ ...row, op: val })}
                    options={OPERATORS}
                    className="gspOpSelect"
                />
                <input
                    className="gspInput gspValueInput"
                    type="text"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => onChange({ ...row, value: e.target.value })}
                    list={`vals-${row.id}`}
                />
                <datalist id={`vals-${row.id}`}>
                    {(aggregationValues[row.key] || []).slice(0, 100).map((v, i) => (
                        <option key={i} value={v} />
                    ))}
                </datalist>
                <Select
                    value={row.type}
                    onValueChange={(val) => onChange({ ...row, type: val })}
                    options={TYPE_OPTIONS}
                    className="gspTypeSelect"
                />
            </div>
            <Tooltip content="Remove filter" placement="left">
                <IconButton onClick={onRemove} size="sm">
                    <i className="mdi mdi-close mdi-14px" />
                </IconButton>
            </Tooltip>
        </div>
    )
}

function ResultsSection({ results, onFeatureClick }) {
    if (!results || results.length === 0) return null

    return (
        <div className="gspResults">
            {results.map((layerResult) => (
                <div key={layerResult.layerName} className="gspResultGroup">
                    <div className="gspResultGroupHeader">
                        <span className="gspResultGroupName">
                            {layerResult.displayName}
                        </span>
                        <span className="gspResultGroupCount">
                            {layerResult.features.length}
                            {layerResult.hasMore ? '+' : ''} features
                        </span>
                    </div>
                    {layerResult.features.map((feature, idx) => {
                        const name =
                            feature.properties[layerResult.useKeyAsName] ||
                            feature.properties.name ||
                            feature.properties.Name ||
                            `Feature ${idx + 1}`
                        return (
                            <div
                                key={idx}
                                className="gspResultItem"
                                onClick={() =>
                                    onFeatureClick(
                                        feature,
                                        layerResult.layerName
                                    )
                                }
                            >
                                <i className="mdi mdi-map-marker-outline mdi-14px gspResultIcon" />
                                <span className="gspResultName">
                                    {String(name)}
                                </span>
                            </div>
                        )
                    })}
                    {layerResult.hasMore && (
                        <div
                            className="gspLoadMore"
                            onClick={() => layerResult.onLoadMore()}
                        >
                            Load more...
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

export function GlobalSearchPanel({ onClose }) {
    const [filterValues, setFilterValues] = useState([createFilterRow()])
    const [selectedLayers, setSelectedLayers] = useState([])
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [aggregationKeys, setAggregationKeys] = useState([])
    const [aggregationValues, setAggregationValues] = useState({})
    const [geodatasetLayerOptions, setGeodatasetLayerOptions] = useState([])
    const offsetsRef = useRef({})

    const getL_ = useCallback(() => {
        return require('../../../Layers_/Layers_').default
    }, [])
    const getMap_ = useCallback(() => {
        return require('../../../Map_/Map_').default
    }, [])

    // Discover geodataset layers
    useEffect(() => {
        const L_ = getL_()
        if (!L_ || !L_.layers || !L_.layers.data) return

        const opts = []
        for (let l in L_.layers.data) {
            if (
                L_.layers.data[l].url &&
                L_.layers.data[l].url.startsWith('geodatasets:')
            ) {
                opts.push({
                    value: l,
                    label: L_.layers.data[l].display_name || l,
                    geodatasetName: L_.layers.data[l].url.split(':')[1],
                })
            }
        }
        setGeodatasetLayerOptions(opts)
        if (opts.length > 0) {
            setSelectedLayers([opts[0].value])
        }
    }, [getL_])

    // Fetch aggregations when selected layers change
    useEffect(() => {
        if (selectedLayers.length === 0) return

        const L_ = getL_()
        const allKeys = new Set()
        const allValues = {}
        let pending = selectedLayers.length

        selectedLayers.forEach((layerName) => {
            const layerData = L_.layers.data[layerName]
            if (!layerData || !layerData.url) {
                pending--
                if (pending === 0) {
                    setAggregationKeys(Array.from(allKeys))
                    setAggregationValues(allValues)
                }
                return
            }

            const geodatasetName = layerData.url.split(':')[1]
            const body = { layer: geodatasetName, limit: 500 }

            const bounds = L_.Map_?.map?.getBounds()
            if (bounds) {
                body.maxy = bounds._northEast.lat
                body.maxx = bounds._northEast.lng
                body.miny = bounds._southWest.lat
                body.minx = bounds._southWest.lng
            }

            calls.api(
                'geodatasets_aggregations',
                body,
                function (data) {
                    if (data.status === 'success' && data.aggregations) {
                        Object.keys(data.aggregations).forEach((key) => {
                            allKeys.add(key)
                            if (!allValues[key]) allValues[key] = []
                            const vals = data.aggregations[key]
                            if (Array.isArray(vals)) {
                                vals.forEach((v) => {
                                    if (!allValues[key].includes(v))
                                        allValues[key].push(v)
                                })
                            }
                        })
                    }
                    pending--
                    if (pending === 0) {
                        setAggregationKeys(Array.from(allKeys))
                        setAggregationValues(allValues)
                    }
                },
                function () {
                    pending--
                    if (pending === 0) {
                        setAggregationKeys(Array.from(allKeys))
                        setAggregationValues(allValues)
                    }
                }
            )
        })
    }, [selectedLayers, getL_])

    const handleFilterChange = useCallback((idx, newRow) => {
        setFilterValues((prev) => {
            const next = [...prev]
            next[idx] = newRow
            return next
        })
    }, [])

    const handleFilterRemove = useCallback((idx) => {
        setFilterValues((prev) => prev.filter((_, i) => i !== idx))
    }, [])

    const handleAddFilter = useCallback(() => {
        setFilterValues((prev) => [...prev, createFilterRow()])
    }, [])

    const handleAddGroup = useCallback(() => {
        setFilterValues((prev) => [...prev, createGroupRow()])
    }, [])

    const fetchLayerResults = useCallback(
        (layerName, encodedFilters, offset, existingFeatures) => {
            const L_ = getL_()
            const layerData = L_.layers.data[layerName]
            if (!layerData || !layerData.url) return

            const geodatasetName = layerData.url.split(':')[1]
            const params = {
                layer: geodatasetName,
                limit: PAGE_SIZE,
                offset: offset,
            }
            if (encodedFilters) params.filters = encodedFilters

            calls.api(
                'geodatasets_get',
                params,
                function (data) {
                    const features = data.features || []
                    const allFeatures = [...(existingFeatures || []), ...features]

                    setResults((prev) => {
                        const next = prev.filter(
                            (r) => r.layerName !== layerName
                        )
                        next.push({
                            layerName,
                            displayName:
                                layerData.display_name || layerName,
                            useKeyAsName:
                                layerData.variables?.useKeyAsName || 'name',
                            features: allFeatures,
                            hasMore: features.length >= PAGE_SIZE,
                            onLoadMore: () => {
                                const newOffset = offset + PAGE_SIZE
                                offsetsRef.current[layerName] = newOffset
                                fetchLayerResults(
                                    layerName,
                                    encodedFilters,
                                    newOffset,
                                    allFeatures
                                )
                            },
                        })
                        return next
                    })
                },
                function () {}
            )
        },
        [getL_]
    )

    const handleSearch = useCallback(() => {
        const L_ = getL_()
        setSearching(true)
        setResults([])
        offsetsRef.current = {}

        const validFilters = filterValues.filter(
            (f) => f.isGroup || (f.key && f.value)
        )
        const encodedFilters =
            validFilters.length > 0 ? encodeFilters(validFilters) : null

        // Apply filters to map layers
        selectedLayers.forEach((layerName) => {
            const layerData = L_.layers.data[layerName]
            if (!layerData) return

            // Set filter on layer for map rendering
            if (encodedFilters) {
                layerData._filterEncoded = layerData._filterEncoded || {}
                layerData._filterEncoded.filters = encodedFilters
                L_.Map_.refreshLayer(layerData, null, null, true)
            }

            // Query for results list
            fetchLayerResults(layerName, encodedFilters, 0, null)
        })

        setSearching(false)
    }, [filterValues, selectedLayers, fetchLayerResults, getL_])

    const handleFeatureClick = useCallback(
        (feature, layerName) => {
            const L_ = getL_()
            const Map_ = getMap_()
            if (!feature.geometry) return

            let coords
            if (feature.geometry.type === 'Point') {
                coords = feature.geometry.coordinates
            } else {
                const { center: turfCenter } = require('@turf/turf')
                const c = turfCenter(feature)
                coords = c.geometry.coordinates
            }

            if (coords) {
                Map_.map.setView(
                    [coords[1], coords[0]],
                    Map_.mapScaleZoom || Map_.map.getZoom()
                )
            }

            // Try to select the feature on the map
            if (L_.layers.layer[layerName]) {
                const markers = L_.layers.layer[layerName]
                if (markers && typeof markers.eachLayer === 'function') {
                    markers.eachLayer((layer) => {
                        if (
                            layer.feature &&
                            layer.feature.properties?._.idx ===
                                feature.properties?._.idx
                        ) {
                            L_.highlight(layer)
                            layer.fireEvent('click')
                        }
                    })
                }
            }
        },
        [getL_, getMap_]
    )

    const handleLayerToggle = useCallback(
        (layerValue) => {
            setSelectedLayers((prev) => {
                if (prev.includes(layerValue)) {
                    return prev.filter((l) => l !== layerValue)
                }
                return [...prev, layerValue]
            })
        },
        []
    )

    return (
        <div className="gspContainer">
            <div className="gspHeader">
                <span className="gspTitle">Advanced Search</span>
                <Tooltip content="Close panel" placement="left">
                    <IconButton onClick={onClose} size="sm">
                        <i className="mdi mdi-close mdi-18px" />
                    </IconButton>
                </Tooltip>
            </div>

            <div className="gspBody">
                {/* Layer selection */}
                <div className="gspSection">
                    <div className="gspSectionLabel">Layers</div>
                    <div className="gspLayerChips">
                        {geodatasetLayerOptions.map((opt) => (
                            <div
                                key={opt.value}
                                className={`gspChip ${
                                    selectedLayers.includes(opt.value)
                                        ? 'gspChipActive'
                                        : ''
                                }`}
                                onClick={() => handleLayerToggle(opt.value)}
                            >
                                {opt.label}
                            </div>
                        ))}
                        {geodatasetLayerOptions.length === 0 && (
                            <div className="gspNoLayers">
                                No geodataset layers available
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter builder */}
                <div className="gspSection">
                    <div className="gspSectionLabel">Filters</div>
                    <div className="gspFilters">
                        {filterValues.map((row, idx) => (
                            <FilterRow
                                key={row.id}
                                row={row}
                                onChange={(newRow) =>
                                    handleFilterChange(idx, newRow)
                                }
                                onRemove={() => handleFilterRemove(idx)}
                                aggregationKeys={aggregationKeys}
                                aggregationValues={aggregationValues}
                            />
                        ))}
                    </div>
                    <div className="gspFilterActions">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleAddFilter}
                        >
                            <i className="mdi mdi-plus mdi-14px" /> Add Filter
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleAddGroup}
                        >
                            <i className="mdi mdi-code-brackets mdi-14px" /> Add
                            Group
                        </Button>
                    </div>
                </div>

                {/* Search button */}
                <div className="gspSearchAction">
                    <Button
                        variant="primary"
                        onClick={handleSearch}
                        disabled={searching || selectedLayers.length === 0}
                    >
                        {searching ? 'Searching...' : 'Search'}
                    </Button>
                </div>

                {/* Results */}
                <div className="gspSection">
                    <div className="gspSectionLabel">Results</div>
                    <ResultsSection
                        results={results}
                        onFeatureClick={handleFeatureClick}
                    />
                    {results.length === 0 && !searching && (
                        <div className="gspNoResults">
                            No results yet. Configure filters and click Search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export { encodeFilters, createFilterRow, createGroupRow, OPERATORS, GROUP_OPERATORS, PAGE_SIZE }
export default GlobalSearchPanel
