import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import TimeUI from '@basics/TimeControl_/TimeUI'
import Help from '@basics/UserInterface_/components/Help/Help'
import Modal from '@basics/UserInterface_/components/Modal/Modal'
import DataShaders from '@essence/services/DataShaders'
import LayerInfoModal from '../../Layers/LayerInfoModal/LayerInfoModal'
import * as tokml from '@maphubs/tokml'
import shpwrite from '@mapbox/shp-write'
import F_ from '@basics/Formulae_/Formulae_'
import {
    applyLiveMove,
    descendantsOf,
    flatten,
    isHidden,
    layerOrder,
    parentOf,
    replay,
} from '../ordering'
import {
    Button,
    Checkbox,
    IconButton,
    Select,
    TextInput,
    Tooltip,
} from '@design/components'
import {
    LayerSettingsSection as SettingSection,
    LayerSettingsSlider as SliderSetting,
    LayerSettingsStatusBanner,
} from '@basics/UserInterface_/LayerSettings/LayerSettings'
import * as store from '../store'
import '../LayersTool2.css'

const HELP_KEY = 'LayersTool'
const TYPE_ICONS = {
    vector: 'vector-polyline',
    vectortile: 'grid',
    tile: 'map-outline',
    data: 'file-table',
    query: 'magnify',
    model: 'cube-outline',
    image: 'image',
    velocity: 'weather-windy',
    video: 'video',
}
const RASTER_TYPES = new Set(['tile', 'data', 'image', 'velocity'])
const VECTOR_TYPES = new Set(['vector', 'vectortile', 'query'])

function layerName(layer) {
    return layer.display_name || layer.name
}

function layerKey(layer) {
    return layer.uuid || layer.name
}

function findLayer(nodes, name) {
    for (const node of nodes || []) {
        if (node.name === name) return node
        if (node.type === 'header') {
            const found = findLayer(node.sublayers, name)
            if (found) return found
        }
    }
    return null
}

function layerIsOn(layer) {
    const name = layer.name
    const key = L_.asLayerUUID ? L_.asLayerUUID(name) : name
    return !!(L_.layers?.on?.[name] ?? L_.layers?.on?.[key] ?? layer.visibility)
}

function layerIsFiltered(layer) {
    if (!layer || layer.type !== 'vector') return false
    if (layer._filterEncoded?.filters || layer._filterEncoded?.spatialFilter)
        return true

    const filter = Filtering.filters[layer.name]
    if (filter?.values?.some((value) => value && !value.isGroup && value.type != null))
        return true
    return filter?.spatial?.center != null
}

function activeError(layer) {
    return layer.error || layer.failed || layer.loadError || null
}

function refreshWarning(layer) {
    return (
        layer.refreshWarning ||
        L_.layers?.refreshWarning?.[layer.name] ||
        L_.layers?.refreshWarnings?.[layer.name] ||
        null
    )
}

function emitHeaderStateChange(header, onState) {
    store.dispatchHeaderStateChange(header.name, onState)
}

function searchMatches(layer, query) {
    if (!query) return true
    const q = query.startsWith('#') ? query.slice(1) : query
    if (!q) return true
    if (query.startsWith('#'))
        return (layer.tags || []).some((tag) =>
            String(tag).toLowerCase().includes(q)
        )
    return [layerName(layer), layer.description, ...(layer.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
}

function buildRows(flat, current, query, expandedMap) {
    const rows = []
    const filtering = !!(
        current.onlyVisible ||
        current.onlyFiltered ||
        query
    )
    const matchingLeaves = new Set()
    const matchingHeaders = new Set()
    const hiddenByFilter = new Set()

    flat.forEach((entry, index) => {
        if (entry.type === 'header') return
        const node = entry.node
        const matches =
            (!current.onlyVisible || layerIsOn(node)) &&
            (!current.onlyFiltered || layerIsFiltered(node)) &&
            searchMatches(node, query)
        if (!matches) {
            hiddenByFilter.add(entry.key)
            return
        }
        matchingLeaves.add(index)
        let parentIndex = parentOf(flat, index)
        while (parentIndex != null) {
            matchingHeaders.add(parentIndex)
            parentIndex = parentOf(flat, parentIndex)
        }
    })

    flat.forEach((entry, index) => {
        const isHeader = entry.type === 'header'
        if (
            filtering &&
            (isHeader ? !matchingHeaders.has(index) : !matchingLeaves.has(index))
        )
            return
        if (!filtering && isHidden(flat, index, expandedMap)) return

        const parentIndex = parentOf(flat, index)
        const ancestors = []
        let ancestorIndex = parentIndex
        while (ancestorIndex != null) {
            ancestors.unshift(flat[ancestorIndex])
            ancestorIndex = parentOf(flat, ancestorIndex)
        }
        const node = entry.node
        rows.push({
            id: entry.key,
            node,
            label: layerName(node),
            depth: entry.depth,
            flatIndex: index,
            path: ancestors.map((ancestor) => layerName(ancestor.node)),
            isHeader,
            parentId:
                parentIndex == null ? null : flat[parentIndex].key,
            descendants: isHeader
                ? descendantsOf(flat, index)
                      .filter((descendant) => descendant.type !== 'header')
                      .map((descendant) => descendant.node)
                : [],
            descriptionOnly:
                !!query &&
                !query.startsWith('#') &&
                !layerName(node).toLowerCase().includes(query) &&
                String(node.description || '')
                    .toLowerCase()
                    .includes(query),
        })
    })

    return { rows, hiddenByFilter }
}

function highlightText(text, query) {
    if (!query || query.startsWith('#')) return text
    const index = text.toLowerCase().indexOf(query)
    if (index < 0) return text
    return (
        <>
            {text.slice(0, index)}
            <mark>{text.slice(index, index + query.length)}</mark>
            {text.slice(index + query.length)}
        </>
    )
}

function typeColor(type) {
    return LayerTypeRegistry.getConfig(type)?.color || 'var(--color-a4)'
}

function sampleTileUrl(layer) {
    try {
        const rendered = L_.layers?.layer?.[layer.name]
        const map = Map_.map || window.mmgisAPI?.map
        if (!rendered?.getTileUrl || !map?.getCenter) return null
        const center = map.getCenter()
        const zoom = Math.max(
            layer.minZoom || 0,
            Math.min(
                layer.maxNativeZoom ?? 18,
                Math.round(map.getZoom()) - 2
            )
        )
        const scale = 2 ** zoom
        const lat = (center.lat * Math.PI) / 180
        const x = Math.floor(((center.lng + 180) / 360) * scale)
        const y = Math.floor(
            ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) *
                scale
        )
        const previousZoom = rendered._tileZoom
        let url
        try {
            rendered._tileZoom = zoom
            url = rendered.getTileUrl({ x, y, z: zoom })
        } finally {
            rendered._tileZoom = previousZoom
        }
        return typeof url === 'string' && !url.includes('NaN')
            ? { key: `${layer.name}:${zoom}:${x}:${y}`, url }
            : null
    } catch (error) {
        return null
    }
}

const previewCache = new Map()

function rampColor(value) {
    if (value === 'transparent') return [0, 0, 0, 0]
    const hex = /^#([0-9a-f]{6})$/i.exec(value || '')
    if (hex)
        return [
            parseInt(hex[1].slice(0, 2), 16),
            parseInt(hex[1].slice(2, 4), 16),
            parseInt(hex[1].slice(4, 6), 16),
            255,
        ]
    const rgb = /^rgba?\(([^)]+)\)$/i.exec(value || '')
    if (rgb) {
        const parts = rgb[1].split(',').map(Number)
        return [
            parts[0] || 0,
            parts[1] || 0,
            parts[2] || 0,
            parts[3] == null ? 255 : Math.round(parts[3] * 255),
        ]
    }
    return [255, 255, 255, 0]
}

async function colorizeDataTile(url, layer) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Data preview tile failed')
    const bitmap = await createImageBitmap(await response.blob())
    const source = document.createElement('canvas')
    source.width = bitmap.width
    source.height = bitmap.height
    const sourceContext = source.getContext('2d', { willReadFrequently: true })
    sourceContext.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height)
    const shader = layer.variables?.shader || {}
    const noDataValues = (shader.noDataValues || []).map(Number)
    const values = new Float32Array(source.width * source.height)
    const currentRange =
        L_.layers.layer[layer.name]?._shaderMinMax ||
        DataShaders.colorize.lastMinMax
    let min = Number(currentRange?.min)
    let max = Number(currentRange?.max)
    const fixedRange =
        Number.isFinite(min) && Number.isFinite(max) && min < max
    if (!fixedRange) {
        min = Infinity
        max = -Infinity
    }
    for (let index = 0; index < values.length; index++) {
        const offset = index * 4
        let value = F_.RGBAto32({
            r: pixels.data[offset],
            g: pixels.data[offset + 1],
            b: pixels.data[offset + 2],
            a: pixels.data[offset + 3],
        })
        if (value === 2147483648) value = 0
        values[index] = value
        if (
            !fixedRange &&
            !noDataValues.includes(value) &&
            Number.isFinite(value)
        ) {
            min = Math.min(min, value)
            max = Math.max(max, value)
        }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max)
        throw new Error('Data preview has no finite range')
    const ramp =
        L_.layers.layer[layer.name]?.ramp || shader.ramps?.[0] || []
    if (ramp.length < 2) throw new Error('Data preview has no color ramp')
    const colors = ramp.map(rampColor)
    for (let index = 0; index < values.length; index++) {
        const value = values[index]
        const offset = index * 4
        if (!Number.isFinite(value) || noDataValues.includes(value)) {
            pixels.data[offset + 3] = 0
            continue
        }
        const position = Math.max(0, Math.min(1, (value - min) / (max - min)))
        const scaled = position * (colors.length - 1)
        const low = Math.floor(scaled)
        const high = Math.min(colors.length - 1, low + 1)
        const fraction = shader.discrete === true ? 0 : scaled - low
        for (let channel = 0; channel < 4; channel++)
            pixels.data[offset + channel] = Math.round(
                colors[low][channel] * (1 - fraction) +
                    colors[high][channel] * fraction
            )
    }
    const output = document.createElement('canvas')
    output.width = source.width
    output.height = source.height
    output.getContext('2d').putImageData(pixels, 0, 0)
    return output.toDataURL()
}

function RasterPreview({ layer, enabled, version }) {
    const [sample, setSample] = useState(null)
    const fallback = typeColor(layer.type)
    useEffect(() => {
        if (!enabled) {
            setSample(null)
            return
        }
        const initial = sampleTileUrl(layer)
        if (!initial) {
            setSample(null)
            return
        }
        const cached = previewCache.get(initial.key)
        if (cached !== undefined) {
            setSample(cached)
            return
        }
        if (layer.type === 'data') {
            setSample(null)
            colorizeDataTile(initial.url, layer)
                .then((url) => {
                    const result = { key: initial.key, url }
                    previewCache.set(initial.key, result)
                    setSample(result)
                })
                .catch(() => {
                    previewCache.set(initial.key, null)
                    setSample(null)
                })
        } else {
            previewCache.set(initial.key, initial)
            setSample(initial)
        }
    }, [enabled, layer, version])
    if (!enabled) return null
    return sample?.url ? (
        <img
            className="lt2-preview"
            src={sample.url}
            alt=""
            onError={() => {
                previewCache.set(sample.key, null)
                setSample(null)
            }}
        />
    ) : (
        <span className="lt2-preview lt2-previewFallback" style={{ '--fallback': fallback }} />
    )
}

function ToolTip({ label, children }) {
    return <Tooltip content={label}>{children}</Tooltip>
}

function SearchBox({ value, onChange, onExpandAll, onCollapseAll, onRestore, tags }) {
    const [query, setQuery] = useState(value)
    const [showTags, setShowTags] = useState(false)
    const timer = useRef(null)
    useEffect(() => setQuery(value), [value])
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current)
        },
        []
    )
    const matchingTags = useMemo(() => {
        const fragment = query.slice(query.lastIndexOf('#') + 1).toLowerCase()
        return query.includes('#')
            ? tags
                  .filter((tag) => tag.toLowerCase().includes(fragment))
                  .slice(0, 8)
            : []
    }, [query, tags])
    const change = (next) => {
        setQuery(next)
        setShowTags(next.includes('#'))
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => onChange(next.trim().toLowerCase()), 150)
    }
    return (
        <div className="lt2-searchWrap">
            <div className="lt2-search">
                <i className="mdi mdi-magnify mdi-18px" aria-hidden="true" />
                <input
                    aria-label="Search layers"
                    placeholder="Search layers, #tags"
                    value={query}
                    onChange={(event) => change(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && matchingTags[0]) {
                            event.preventDefault()
                            change(`#${matchingTags[0]}`)
                            setShowTags(false)
                        }
                    }}
                    onFocus={() => setShowTags(query.includes('#'))}
                    onBlur={() => setTimeout(() => setShowTags(false), 150)}
                />
                {query && (
                    <ToolTip label="Clear search">
                        <IconButton
                            size="sm"
                            aria-label="Clear search"
                            onClick={() => change('')}
                        >
                            <i className="mdi mdi-close mdi-16px" />
                        </IconButton>
                    </ToolTip>
                )}
                <ToolTip label="Expand all">
                    <IconButton size="sm" aria-label="Expand all" onClick={onExpandAll}>
                        <i className="mdi mdi-arrow-expand-vertical mdi-16px" />
                    </IconButton>
                </ToolTip>
                <ToolTip label="Collapse all">
                    <IconButton
                        size="sm"
                        aria-label="Collapse all"
                        onClick={onCollapseAll}
                    >
                        <i className="mdi mdi-arrow-collapse-vertical mdi-16px" />
                    </IconButton>
                </ToolTip>
                <ToolTip label="Restore default expansion">
                    <IconButton size="sm" aria-label="Restore default expansion" onClick={onRestore}>
                        <i className="mdi mdi-restore mdi-16px" />
                    </IconButton>
                </ToolTip>
            </div>
            {showTags && matchingTags.length > 0 && (
                <div className="lt2-tagPopup" role="listbox" aria-label="Layer tags">
                    {matchingTags.map((tag) => (
                        <button
                            type="button"
                            key={tag}
                            role="option"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                change(`#${tag}`)
                                setShowTags(false)
                            }}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function StatusSlot({ layer, onOpen }) {
    const error = activeError(layer)
    const warning = refreshWarning(layer)
    const timeEnabled = layer.time?.enabled === true
    const status =
        error ||
        (warning
            ? { kind: 'cached', message: warning.message || warning }
            : null)
    const typeStatus = LayerTypeRegistry.settings(layer.type)?.status
    const filtered = layerIsFiltered(layer)
    let pluginStatus = null
    try {
        pluginStatus = typeStatus?.(layer, {})
    } catch (errorInStatus) {}
    const message = status?.message || pluginStatus?.message
    const kind = status?.kind || pluginStatus?.kind
    if (kind === 'loading')
        return (
            <ToolTip label={message || 'Loading layer'}>
                <span className="lt2-status" aria-label="Loading layer">
                    <i className="mdi mdi-loading mdi-spin mdi-16px" />
                </span>
            </ToolTip>
        )
    if (error || kind === 'failed')
        return (
            <ToolTip label={message || error?.message || String(error || 'Layer failed to load')}>
                <button className="lt2-status lt2-statusError" aria-label="Layer failed; open settings" onClick={onOpen}>
                    <i className="mdi mdi-alert-circle mdi-16px" />
                </button>
            </ToolTip>
        )
    if (warning || kind === 'cached')
        return (
            <ToolTip label={message || 'Layer refresh failed. Using cached data.'}>
                <button className="lt2-status lt2-statusWarning" aria-label="Refresh failed; open settings" onClick={onOpen}>
                    <i className="mdi mdi-cloud-alert mdi-16px" />
                </button>
            </ToolTip>
        )
    if (timeEnabled || filtered)
        return (
            <span className="lt2-statusGroup">
                {timeEnabled && (
                    <ToolTip label="Time-enabled layer settings">
                        <button className="lt2-status" aria-label="Time-enabled; open settings" onClick={onOpen}>
                            <i className="mdi mdi-clock-outline mdi-16px" />
                        </button>
                    </ToolTip>
                )}
                {filtered && (
                    <ToolTip label="Layer has an active filter">
                        <button className="lt2-status lt2-statusFiltered" aria-label="Filtered layer; open settings" onClick={onOpen}>
                            <i className="mdi mdi-filter-check mdi-16px" />
                        </button>
                    </ToolTip>
                )}
            </span>
        )
    return null
}

function HeaderRow({
    row,
    expanded,
    onExpand,
    onTitle,
    onMute,
    muted,
    onCount,
    total,
    query,
    selected,
    focused,
    dragHandle,
    depthOverride,
}) {
    const children = row.descendants
    const countOn = children.filter(layerIsOn).length
    const isPartial = countOn > 0 && countOn < children.length
    const mutedCount = Array.isArray(muted) ? muted.length : 0
    return (
        <div
            className={`lt2-row lt2-headerRow ${focused ? 'lt2-focused' : ''} ${selected ? 'lt2-selected' : ''}`}
            style={{ '--depth': depthOverride ?? row.depth }}
            aria-level={row.depth + 1}
            aria-expanded={expanded}
            data-row-id={row.id}
        >
            <span className="lt2-indentGuides" aria-hidden="true" />
            <button className="lt2-drag" aria-label="Drag to reorder" {...dragHandle}>
                <i className="mdi mdi-drag-vertical mdi-16px" />
            </button>
            <button className="lt2-chevron" aria-label={expanded ? 'Collapse group' : 'Expand group'} onClick={onExpand}>
                <i className={`mdi mdi-chevron-right mdi-18px ${expanded ? 'lt2-open' : ''}`} />
            </button>
            <span className="lt2-checkWrap" title={mutedCount ? `Restore ${mutedCount} muted layers` : 'Mute or restore on layers in this group'}>
                <Checkbox
                    checked={countOn === children.length && children.length > 0}
                    indeterminate={isPartial}
                    onCheckedChange={onMute}
                    aria-label={mutedCount ? `Restore ${mutedCount} muted layers` : 'Mute or restore group layers'}
                    showCheck
                />
            </span>
            <button className="lt2-title lt2-headerTitle" onClick={onTitle}>
                <span className="lt2-name">{highlightText(row.label, query)}</span>
            </button>
            {row.node.description && (
                <ToolTip label="Header information">
                    <button
                        type="button"
                        className="lt2-status"
                        aria-label={`Information about ${row.label}`}
                        onClick={() =>
                            Modal.set(
                                <div className="lt2-headerInfo">
                                    <h3>{row.label}</h3>
                                    <p>{row.node.description}</p>
                                </div>
                            )
                        }
                    >
                        <i className="mdi mdi-information-outline mdi-16px" />
                    </button>
                </ToolTip>
            )}
            {mutedCount > 0 && <span className="lt2-muted">{mutedCount} muted</span>}
            {!expanded && <span className="lt2-count">{countOn}/{total}</span>}
        </div>
    )
}

function LayerRow({
    row,
    query,
    previews,
    onOpen,
    onToggle,
    focused,
    selected,
    dragHandle,
    depthOverride,
}) {
    const layer = row.node
    const isOn = layerIsOn(layer)
    const failed = !!activeError(layer)
    const color = typeColor(layer.type)
    const isRaster = RASTER_TYPES.has(layer.type)
    const rendered = L_.layers?.layer?.[layer.name]
    const firstFeature = rendered?.getLayers?.()?.find?.((item) => item.feature)
    const geometry =
        layer.geometryType ||
        layer.variables?.geometryType ||
        rendered?.feature?.geometry?.type ||
        firstFeature?.feature?.geometry?.type ||
        rendered?.toGeoJSON?.().features?.find?.((feature) => feature.geometry)?.geometry?.type ||
        ''
    const pointGeometry =
        /point/i.test(geometry) || (!geometry && layer.style?.radius != null)
    const lineGeometry =
        /line/i.test(geometry) ||
        (!geometry &&
            layer.style?.strokeColor &&
            layer.style?.fillColor == null)
    const glyphShape = VECTOR_TYPES.has(layer.type)
        ? pointGeometry
            ? 'point'
            : lineGeometry
              ? 'line'
              : 'polygon'
        : null
    const glyphColor =
        layer.style?.fillColor ||
        layer.style?.strokeColor ||
        layer.style?.color ||
        color
    return (
        <div
            className={`lt2-row lt2-layerRow ${isRaster && previews ? 'lt2-rasterRow' : ''} ${isOn ? 'lt2-on' : ''} ${failed ? 'lt2-failed' : ''} ${focused ? 'lt2-focused' : ''} ${selected ? 'lt2-selected' : ''}`}
            style={{
                '--depth': depthOverride ?? row.depth,
                '--lt-color': color,
            }}
            aria-level={row.depth + 1}
            aria-selected={selected}
            data-row-id={row.id}
        >
            <span className="lt2-indentGuides" aria-hidden="true" />
            <button className="lt2-drag" aria-label="Drag to reorder" {...dragHandle}>
                <i className="mdi mdi-drag-vertical mdi-16px" />
            </button>
            <span className="lt2-chevronSpace" aria-hidden="true" />
            <span className="lt2-checkWrap">
                <Checkbox
                    checked={isOn}
                    onCheckedChange={onToggle}
                    aria-label={`${isOn ? 'Turn off' : 'Turn on'} ${row.label}`}
                    showCheck
                />
            </span>
            <button className="lt2-title" onClick={onOpen} title={row.label}>
                {glyphShape && (
                    <span
                        className={`lt2-glyph lt2-glyph-${glyphShape}`}
                        style={{ '--glyph-color': glyphColor }}
                        aria-hidden="true"
                    />
                )}
                {!isRaster && !VECTOR_TYPES.has(layer.type) && (
                    <i
                        className={`mdi mdi-${TYPE_ICONS[layer.type] || 'layers'} lt2-typeIcon`}
                        aria-hidden="true"
                    />
                )}
                <span className="lt2-name">{highlightText(row.label, query)}</span>
                {row.descriptionOnly && (
                    <span className="lt2-descriptionHit">in description</span>
                )}
            </button>
            {isRaster && <RasterPreview layer={layer} enabled={previews} version={store.getState().layerVersion} />}
            <StatusSlot layer={layer} onOpen={onOpen} />
        </div>
    )
}

function SortableRow(props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: props.row.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
    }
    const rowProps = {
        ...props,
        dragHandle: { ...attributes, ...listeners },
    }
    return (
        <div ref={setNodeRef} style={style} className="lt2-sortable">
            {props.row.isHeader ? (
                <HeaderRow {...rowProps} />
            ) : (
                <LayerRow {...rowProps} />
            )}
        </div>
    )
}

function CoreSettings({ layer, api }) {
    const opacity = L_.layers?.opacity?.[layer.name] ?? layer.initialOpacity ?? 1
    const [exportError, setExportError] = useState('')
    const [exportFormat, setExportFormat] = useState('geojson')
    const [exportCoordinates, setExportCoordinates] = useState('source')
    const [exportExtent, setExportExtent] = useState('current')
    const [exportProperties, setExportProperties] = useState(true)
    const [exportBusy, setExportBusy] = useState(false)
    const plugin = LayerTypeRegistry.settings(layer.type)
    const pluginSections = useMemo(() => {
        try {
            return (plugin?.sections?.(layer, api) || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
        } catch (error) {
            return []
        }
    }, [plugin, layer, api])
    const pluginActions = useMemo(() => {
        try {
            return plugin?.actions?.(layer, api) || []
        } catch (error) {
            return []
        }
    }, [plugin, layer, api])

    const exportLayer = async () => {
        setExportBusy(true)
        setExportError('')
        try {
            const mapLayer = L_.layers?.layer?.[layer.name]
            if (!mapLayer?.toGeoJSON)
                throw new Error('This layer does not expose exportable GeoJSON data.')
            let geojson
            if (
                exportExtent === 'entire' &&
                layer.variables?.dynamicExtent === true &&
                layer.url
            ) {
                const response = await fetch(
                    L_.getUrl(layer.type, layer.url, layer)
                )
                if (!response.ok)
                    throw new Error(`Source export failed (${response.status}).`)
                geojson = await response.json()
            } else {
                geojson = mapLayer.toGeoJSON()
            }
            if (
                exportExtent === 'current' &&
                Array.isArray(geojson.features) &&
                Map_.map?.getBounds
            ) {
                const bounds = Map_.map.getBounds()
                const withinBounds = (feature) => {
                    let west = Infinity
                    let east = -Infinity
                    let south = Infinity
                    let north = -Infinity
                    const visit = (coordinates) => {
                        if (
                            Array.isArray(coordinates) &&
                            coordinates.length >= 2 &&
                            typeof coordinates[0] === 'number'
                        ) {
                            west = Math.min(west, coordinates[0])
                            east = Math.max(east, coordinates[0])
                            south = Math.min(south, coordinates[1])
                            north = Math.max(north, coordinates[1])
                        } else if (Array.isArray(coordinates)) {
                            coordinates.forEach(visit)
                        }
                    }
                    visit(feature.geometry?.coordinates)
                    return (
                        west <= bounds.getEast() &&
                        east >= bounds.getWest() &&
                        south <= bounds.getNorth() &&
                        north >= bounds.getSouth()
                    )
                }
                geojson.features = geojson.features.filter(withinBounds)
            }
            if (exportProperties && Array.isArray(geojson.features))
                geojson.features.forEach((feature) => {
                    feature.properties = feature.properties || {}
                })
            else if (Array.isArray(geojson.features))
                geojson.features.forEach((feature) => delete feature.properties)
            if (exportCoordinates !== 'source')
                geojson = L_.convertGeoJSONLngLatsToPrimaryCoordinates(geojson)
            let body
            let extension
            let mimeType
            if (exportFormat === 'kml') {
                body = tokml(
                    F_.geoJSONForceSimpleStyleSpec(
                        geojson,
                        true,
                        layer.style,
                        layer.useKeyAsName
                    ),
                    {
                        name: layer.useKeyAsName || false,
                        description: 'Generated by MMGIS',
                        timestamp:
                            layer.time?.enabled === true
                                ? layer.time.endProp || null
                                : null,
                        simplestyle: true,
                    }
                )
                extension = 'kml'
                mimeType = 'application/vnd.google-earth.kml+xml'
            } else if (exportFormat === 'shp') {
                const blob = await shpwrite.zip(geojson, {
                    outputType: 'blob',
                })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `${layer.display_name || layer.name}.zip`
                link.click()
                setTimeout(() => URL.revokeObjectURL(link.href), 1000)
                return
            } else {
                body = JSON.stringify(geojson)
                extension = 'geojson'
                mimeType = 'application/geo+json'
            }
            const blob = new Blob([body], { type: mimeType })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${layer.display_name || layer.name}.${extension}`
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (error) {
            setExportError(error.message || 'Unable to export this layer.')
        } finally {
            setExportBusy(false)
        }
    }

    return (
        <>
            <SettingSection
                id="display"
                label="Display"
                onReset={() => api.reset('display')}
            >
                <SliderSetting
                    label="Opacity"
                    value={opacity}
                    min={0}
                    max={1}
                    onChange={(value) => api.setOpacity(value)}
                />
            </SettingSection>
            {Array.isArray(layer.sublayers) && layer.sublayers.length > 0 && (
                <SettingSection id="composite" label="Composite layers" onReset={() => api.reset('composite')}>
                    {layer.sublayers.map((child) => (
                        <Checkbox
                            key={child.name}
                            checked={layerIsOn(child)}
                            onCheckedChange={() => api.toggle(child.name)}
                            showCheck
                        >
                            {layerName(child)}
                        </Checkbox>
                    ))}
                </SettingSection>
            )}
            {layer.time?.enabled && (
                <SettingSection id="time" label="Time" onReset={() => api.reset('time')}>
                    <div className="lt2-field">
                        <span>Data start</span>
                        <TextInput readOnly value={layer.time.dataStartTime || layer.time.start || ''} />
                    </div>
                    <div className="lt2-field">
                        <span>Data end</span>
                        <TextInput readOnly value={layer.time.dataEndTime || layer.time.end || ''} />
                    </div>
                    {layer.time.refreshIntervalEnabled === true && (
                        <div className="lt2-field">
                            <span>Auto-refreshes every</span>
                            <span>{layer.time.refreshIntervalAmount || 60} seconds</span>
                        </div>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => api.setGlobalTimeToExtent()}>
                        Set global time to data extent
                    </Button>
                </SettingSection>
            )}
            {['vector', 'query'].includes(layer.type) && (
                <SettingSection id="export" label="Export" onReset={() => api.reset('export')}>
                <div className="lt2-field">
                    <label>Format</label>
                    <Select
                        value={exportFormat}
                        onValueChange={setExportFormat}
                        aria-label="Export format"
                        options={[
                            { value: 'geojson', label: 'GeoJSON' },
                            { value: 'kml', label: 'KML' },
                            { value: 'shp', label: 'SHP' },
                        ]}
                    />
                </div>
                {layer.variables?.dynamicExtent === true && (
                    <div className="lt2-field">
                        <label>Extent</label>
                        <Select
                            value={exportExtent}
                            onValueChange={setExportExtent}
                            aria-label="Export extent"
                            options={[
                                { value: 'current', label: 'Current Extent' },
                                { value: 'entire', label: 'Entire File' },
                            ]}
                        />
                    </div>
                )}
                <Checkbox
                    checked={exportProperties}
                    onCheckedChange={setExportProperties}
                    showCheck
                >
                    Include properties
                </Checkbox>
                {L_.Coordinates?.mainType !== 'll' && (
                    <div className="lt2-field">
                        <label>Coordinates</label>
                        <Select
                            value={exportCoordinates}
                            onValueChange={setExportCoordinates}
                            aria-label="Export coordinates"
                            options={[
                                { value: 'source', label: 'Source coordinates' },
                                {
                                    value: 'primary',
                                    label: `Converted (${L_.Coordinates.getMainTypeName()})`,
                                },
                            ]}
                        />
                    </div>
                )}
                <Button className="lt2-iconTextButton" size="sm" variant="secondary" disabled={exportBusy} onClick={exportLayer}>
                    <i className="mdi mdi-download" /> {exportBusy ? 'Preparing…' : 'Download data'}
                </Button>
                {exportBusy && <progress aria-label="Export progress" />}
                {(layer.variables?.downloadURL || layer.url) && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => api.download()}
                    >
                        Download source
                    </Button>
                )}
                {exportError && <div className="lt2-inlineError" role="alert">{exportError}</div>}
                </SettingSection>
            )}
            {['tile', 'data'].includes(layer.type) &&
                layer.variables?.downloadURL && (
                    <SettingSection
                        id="export"
                        label="Export"
                        onReset={() => api.reset('export')}
                    >
                        <a
                            className="lt2-sourceDownload"
                            href={layer.variables.downloadURL}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Download Data
                        </a>
                    </SettingSection>
                )}
            {pluginSections.map((section) => {
                const Component = section.Component
                return (
                    <SettingSection
                        key={section.id}
                        id={section.id}
                        label={section.label}
                        resettable={section.resettable !== false}
                        onReset={() => api.reset(section.id)}
                        defaultOpen={section.defaultOpen !== false}
                    >
                        {Component ? (
                            <Component
                                layer={layer}
                                api={api}
                                state={store.getState().sectionState[layer.name]?.[section.id] || {}}
                                setState={(value) => store.setLayerSectionState(layer.name, section.id, value)}
                                resetToken={store.getState().resetTokens[layer.name]?.[section.id] || 0}
                            />
                        ) : null}
                    </SettingSection>
                )
            })}
            <div className="lt2-pluginActions">
                {pluginActions.map((action) => (
                    <Button className="lt2-iconTextButton" key={action.id} size="sm" variant="secondary" onClick={() => action.onClick?.(api)}>
                        {action.icon && <i className={`mdi mdi-${action.icon}`} />} {action.label}
                    </Button>
                ))}
            </div>
        </>
    )
}

function SettingsPage({ row, api, onBack }) {
    const layer = row.node
    const color = typeColor(layer.type)
    const status = activeError(layer) || refreshWarning(layer)
    let typeStatus = null
    try {
        typeStatus = LayerTypeRegistry.settings(layer.type)?.status?.(layer, api)
    } catch (error) {}
    const visible = layerIsOn(layer)
    const retry = () => api.reload()
    const info = () => LayerInfoModal.open(layer.name)
    return (
        <div className="lt2-settings" role="region" aria-label={`${row.label} settings`}>
            <div
                className="lt2-hero"
                style={{ '--layer-color': color }}
            >
                <div className="lt2-heroActions">
                    <ToolTip label="Back to layers (Esc)">
                        <IconButton size="sm" aria-label="Back to layers" onClick={onBack}>
                            <i className="mdi mdi-arrow-left mdi-18px" />
                        </IconButton>
                    </ToolTip>
                    <div>
                        <ToolTip label="Zoom to layer">
                            <IconButton size="sm" aria-label="Zoom to layer" onClick={() => api.zoomTo()}>
                                <i className="mdi mdi-crosshairs-gps mdi-18px" />
                            </IconButton>
                        </ToolTip>
                        <ToolTip label="Reload layer">
                            <IconButton size="sm" aria-label="Reload layer" onClick={retry}>
                                <i className="mdi mdi-refresh mdi-18px" />
                            </IconButton>
                        </ToolTip>
                        <ToolTip label="Download">
                            <IconButton size="sm" aria-label="Download layer" onClick={() => api.download()}>
                                <i className="mdi mdi-download mdi-18px" />
                            </IconButton>
                        </ToolTip>
                        <ToolTip label="Information">
                            <IconButton size="sm" aria-label="Layer information" onClick={info}>
                                <i className="mdi mdi-information-outline mdi-18px" />
                            </IconButton>
                        </ToolTip>
                    </div>
                </div>
                <div className="lt2-avatar" aria-hidden="true">
                    <i className={`mdi mdi-${TYPE_ICONS[layer.type] || 'layers'}`} />
                </div>
                <div className="lt2-settingsName" title={row.label}>{row.label}</div>
                <div className="lt2-path" title={row.path.join(' › ')}>
                    {row.path.map((part, index) => (
                        <React.Fragment key={`${part}-${index}`}>
                            {index > 0 && <span className="lt2-pathSeparator">›</span>}
                            <span className={`lt2-pathSegment ${index > 0 && index < row.path.length - 1 ? 'lt2-pathMiddle' : ''}`}>
                                {part}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
                <Checkbox
                    checked={visible}
                    onCheckedChange={async (checked) => {
                        await api.toggle(layer.name, checked)
                    }}
                    className="lt2-visible"
                    showCheck
                >
                    Visible
                </Checkbox>
            </div>
            {(status || typeStatus) && (
                <LayerSettingsStatusBanner
                    kind={
                        activeError(layer) || typeStatus?.kind === 'failed'
                            ? 'failed'
                            : typeStatus?.kind === 'loading'
                              ? 'loading'
                              : 'cached'
                    }
                    message={
                        activeError(layer)?.message ||
                        activeError(layer) ||
                        refreshWarning(layer)?.message ||
                        typeStatus?.message ||
                        'Layer refresh failed. Using cached data.'
                    }
                    onRetry={retry}
                />
            )}
            <div className="lt2-settingsSections">
                <CoreSettings layer={layer} api={api} />
            </div>
            <div className="lt2-settingsFooter">
                <Button className="lt2-iconTextButton" size="sm" variant="secondary" onClick={() => api.resetAll()}>
                    <i className="mdi mdi-restore" /> Reset all settings
                </Button>
            </div>
        </div>
    )
}

function LayersTool2App({ vars }) {
    const state = useSyncExternalStore(store.subscribe, store.getState)
    useEffect(() => {
        Help.finalize(HELP_KEY)
    }, [])
    const tree = L_.configData?.layers || []
    const [query, setQuery] = useState(state.search)
    const [toast, setToast] = useState(null)
    const [dragPreview, setDragPreview] = useState(null)
    const [mobile, setMobile] = useState(window.innerWidth <= 700)
    const focused = state.focusedRow
    const scrollElement = useRef(null)
    const rowElements = useRef({})
    const orderedFlatRef = useRef([])
    const rowsRef = useRef([])
    const expandedMapRef = useRef({})
    const toastTimer = useRef(null)
    const rowHeight = mobile ? 44 : 31
    const replayResult = useMemo(
        () => replay(flatten(tree), state.orderingHistory),
        [tree, state.orderingHistory]
    )
    const orderedFlat = replayResult.flat
    const allLayerNodes = useMemo(
        () =>
            orderedFlat
                .filter((row) => row.type !== 'header')
                .map((row) => row.node),
        [orderedFlat]
    )
    const allHeaderNodes = useMemo(
        () =>
            orderedFlat
                .filter((row) => row.type === 'header')
                .map((row) => row.node),
        [orderedFlat]
    )
    const expandedMap = useMemo(
        () =>
            Object.fromEntries(
                allHeaderNodes.map((header) => [
                    header.name,
                    state.expanded[header.name] ??
                        (vars.expanded === true
                            ? replayResult.headerToggles.reduce(
                                  (expanded, toggle) =>
                                      toggle.name === header.name
                                          ? toggle.expanded
                                          : expanded,
                                  true
                              )
                            : header.expanded === true),
                ])
            ),
        [allHeaderNodes, state.expanded, vars.expanded, replayResult]
    )
    const current = {
        onlyVisible: state.onlyVisible,
        onlyFiltered: state.onlyFiltered,
    }
    const rowModel = useMemo(
        () => buildRows(orderedFlat, current, query, expandedMap),
        [
            orderedFlat,
            expandedMap,
            state.onlyVisible,
            state.onlyFiltered,
            state.layerVersion,
            query,
        ]
    )
    const rows = rowModel.rows
    orderedFlatRef.current = orderedFlat
    rowsRef.current = rows
    expandedMapRef.current = {
        ...expandedMap,
        searchHidden: rowModel.hiddenByFilter,
    }
    const total = allLayerNodes.length
    const visibleLayers = rows.filter((row) => !row.isHeader).length
    const allTags = useMemo(
        () =>
            Array.from(
                new Set(
                    allLayerNodes.flatMap((layer) =>
                        (layer.tags || []).map((tag) => String(tag))
                    )
                )
            ).sort(),
        [allLayerNodes]
    )
    const isFiltering = !!(
        query ||
        state.onlyVisible ||
        state.onlyFiltered
    )
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollElement.current,
        estimateSize: () => rowHeight,
        overscan: 12,
    })

    const api = useMemo(
        () => ({
            setOpacity: (value) => L_.setLayerOpacity(state.openLayer, value),
            setTileFilter: (name, value) => {
                if (!L_.layers.data[state.openLayer]) return
                L_.setLayerFilter(state.openLayer, name, value)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            setBlend: (value) => {
                if (!L_.layers.data[state.openLayer]) return
                L_.setLayerFilter(state.openLayer, 'mix-blend-mode', value)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            reload: async () => {
                const layer = L_.layers.data[state.openLayer]
                const rendered = L_.layers.layer[state.openLayer]
                if (!layer) return
                if (layer.type === 'image' && rendered?.refresh)
                    rendered.refresh(null, true, {
                        currentCogExpression: null,
                    })
                else if (layer.type !== 'tile')
                    await Map_.refreshLayer(layer)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            zoomTo: () => {
                const rendered = L_.layers.layer[state.openLayer]
                const layer = L_.layers.data[state.openLayer]
                if (rendered?.getBounds && Map_.map)
                    Map_.map.fitBounds(rendered.getBounds())
                else if (layer?.boundingBox && Map_.map)
                    Map_.map.fitBounds([
                        [layer.boundingBox[1], layer.boundingBox[0]],
                        [layer.boundingBox[3], layer.boundingBox[2]],
                    ])
                else if (rendered?.getLatLng && Map_.map)
                    Map_.map.setView(rendered.getLatLng())
            },
            download: () => {
                const layer = L_.layers.data[state.openLayer]
                const url =
                    layer?.variables?.downloadURL ||
                    (layer?.url
                        ? L_.getUrl(layer.type, layer.url, layer)
                        : null)
                if (url) window.open(url, '_blank', 'noopener')
            },
            refresh: () => store.updateState({ layerVersion: store.getState().layerVersion + 1 }),
            reset: (sectionId) => {
                const name = state.openLayer
                if (sectionId === 'display') L_.setLayerOpacity(name, 1)
                if (sectionId === 'tile-display')
                    L_.setLayerFilter(name, 'clear')
                if (sectionId === 'filter') {
                    Filtering.filters[name] = {
                        spatial: { center: null, radius: 0 },
                        values: [],
                        geojson: null,
                    }
                    Filtering.applyFilter(name)
                    Filtering.refresh()
                }
                store.resetLayerSection(name, sectionId)
            },
            resetAll: () => {
                const name = state.openLayer
                const layer = L_.layers.data[name]
                L_.setLayerOpacity(name, 1)
                L_.setLayerFilter(name, 'clear')
                if (Filtering.isFilterable(name)) {
                    Filtering.filters[name] = {
                        spatial: { center: null, radius: 0 },
                        values: [],
                        geojson: null,
                    }
                    Filtering.applyFilter(name)
                    Filtering.refresh()
                }
                store.resetAllLayerSections(name)
                const settings = LayerTypeRegistry.settings(layer?.type)
                let sectionIds = []
                try {
                    sectionIds = (settings?.sections?.(layer, api) || []).map(
                        (section) => section.id
                    )
                } catch (error) {}
                sectionIds.forEach((sectionId) =>
                    store.resetLayerSection(name, sectionId)
                )
            },
            toggle: async (name, target) => {
                const layer =
                    L_.layers.data[name] ||
                    findLayer(L_.configData?.layers, name)
                if (!layer) return
                const on = layerIsOn(layer)
                if (target === undefined || target !== on) {
                    if (target === undefined) await L_.toggleLayer(layer)
                    else await L_.toggleLayerHelper(layer, !target)
                }
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            setGlobalTimeToExtent: () => {
                const layer = L_.layers.data[state.openLayer]
                const start = layer?.time?.dataStartTime
                const end = layer?.time?.dataEndTime
                if (start && end) {
                    const startTime = new Date(start).getTime()
                    const endTime = new Date(end).getTime()
                    TimeUI.updateTimes(startTime, endTime, endTime)
                }
            },
        }),
        [state.openLayer]
    )

    useEffect(() => {
        Help.finalize(HELP_KEY)
        const onResize = () => setMobile(window.innerWidth <= 700)
        const onLayerToggle = () =>
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
        const onRefreshStatus = () =>
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
        const onFilterStateChange = () =>
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
        window.addEventListener('resize', onResize)
        L_.subscribeOnLayerToggle('LayersTool2', onLayerToggle)
        document.addEventListener(
            'layerRefreshStatusChanged',
            onRefreshStatus
        )
        document.addEventListener(
            'layersToolFilterStateChange',
            onFilterStateChange
        )
        return () => {
            window.removeEventListener('resize', onResize)
            L_.unsubscribeOnLayerToggle('LayersTool2')
            document.removeEventListener(
                'layerRefreshStatusChanged',
                onRefreshStatus
            )
            document.removeEventListener(
                'layersToolFilterStateChange',
                onFilterStateChange
            )
        }
    }, [])

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key === 'Escape' && store.getState().openLayer) {
                event.preventDefault()
                store.updateState({ openLayer: null })
                requestAnimationFrame(() => rowElements.current[store.getState().focusedRow]?.focus())
            }
        }
        window.addEventListener('keydown', onEscape)
        return () => window.removeEventListener('keydown', onEscape)
    }, [])

    useEffect(() => {
        if (
            rows.length &&
            (focused == null || !rows.some((row) => row.id === focused))
        )
            store.updateState({ focusedRow: rows[0].id })
    }, [focused, rows])

    useEffect(() => {
        if (focused == null) return
        const index = rows.findIndex((row) => row.id === focused)
        if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
    }, [focused, rows, virtualizer])

    const setActiveLayer = useCallback(
        (row) => {
            if (row.isHeader) {
                const current = store.getState()
                const expanded =
                    current.expanded[row.node.name] ??
                    expandedMapRef.current[row.node.name] ??
                    false
                const onState = !expanded
                store.setExpanded(row.node.name, onState)
                emitHeaderStateChange(row.node, onState)
                return
            }
            store.updateState({ openLayer: row.node.name, focusedRow: row.id })
            if (!layerIsOn(row.node))
                Promise.resolve(api.toggle(row.node.name, true)).catch(() => {})
        },
        [api, vars.expanded]
    )

    const setLayerToggle = useCallback(async (layer, checked) => {
        const currentOn = layerIsOn(layer)
        if (currentOn !== checked) {
            if (checked) await L_.toggleLayer(layer)
            else await L_.toggleLayer(layer)
        }
        store.updateState({ layerVersion: store.getState().layerVersion + 1 })
    }, [])

    const muteHeader = useCallback(
        async (header) => {
            const current = store.getState()
            const flat = replay(
                flatten(L_.configData?.layers),
                current.orderingHistory
            ).flat
            const headerIndex = flat.findIndex(
                (entry) =>
                    entry.type === 'header' && entry.name === header.name
            )
            const descendants =
                headerIndex < 0
                    ? []
                    : descendantsOf(flat, headerIndex)
                          .filter((entry) => entry.type !== 'header')
                          .map((entry) => entry.node)
            const remembered = current.muted[header.name]
            if (Array.isArray(remembered)) {
                for (const name of remembered) {
                    const layer = L_.layers.data[name]
                    if (layer && !layerIsOn(layer)) await L_.toggleLayer(layer)
                }
                const muted = store.getState().muted
                store.updateState({
                    muted: { ...muted, [header.name]: null },
                    layerVersion: store.getState().layerVersion + 1,
                })
                emitHeaderStateChange(header, true)
            } else {
                const onLayers = descendants.filter(layerIsOn)
                for (const layer of onLayers) await L_.toggleLayer(layer)
                const muted = store.getState().muted
                store.updateState({
                    muted: {
                        ...muted,
                        [header.name]: onLayers.map((layer) => layer.name),
                    },
                    layerVersion: store.getState().layerVersion + 1,
                })
                emitHeaderStateChange(header, false)
            }
        },
        []
    )

    const expandAll = (expanded) => {
        store.updateState({
            expanded: Object.fromEntries(
                allHeaderNodes.map((header) => [header.name, expanded])
            ),
        })
    }
    const restoreExpansion = () =>
        store.updateState({
            expanded: Object.fromEntries(
                allHeaderNodes.map((header) => [
                    header.name,
                    header.expanded ?? vars.expanded === true,
                ])
            ),
        })

    const reorderRows = (activeId, overId) => {
        if (!overId || activeId === overId) return
        const currentRows = rowsRef.current
        const active = currentRows.find((row) => row.id === activeId)
        const target = currentRows.find((row) => row.id === overId)
        if (!active || !target) return
        const currentState = store.getState()
        const flat = replay(
            flatten(L_.configData?.layers),
            currentState.orderingHistory
        ).flat
        const oldIndex = flat.findIndex((entry) => entry.key === activeId)
        const newIndex = flat.findIndex((entry) => entry.key === overId)
        if (oldIndex < 0 || newIndex < 0) return
        const result = applyLiveMove(
            flat,
            oldIndex,
            newIndex,
            expandedMapRef.current
        )
        const history = [
            ...currentState.orderingHistory,
            result.entry,
        ]
        store.updateState({ orderingHistory: history })
        L_.reorderLayers?.(layerOrder(result.flat))
        const relation = oldIndex < newIndex ? 'below' : 'above'
        setToast(`Moved ${active.label} ${relation} ${target.label}`)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 5000)
    }

    const undoReorder = () => {
        const currentState = store.getState()
        if (!currentState.orderingHistory.length) return
        const history = currentState.orderingHistory.slice(0, -1)
        const flat = replay(flatten(L_.configData?.layers), history).flat
        store.updateState({ orderingHistory: history })
        L_.reorderLayers?.(layerOrder(flat))
        setToast(history.length ? 'Move undone' : null)
    }

    const previewReorder = ({ active, over }) => {
        if (!over || active.id === over.id) {
            setDragPreview(null)
            return
        }
        const currentState = store.getState()
        const flat = replay(
            flatten(L_.configData?.layers),
            currentState.orderingHistory
        ).flat
        const oldIndex = flat.findIndex((entry) => entry.key === active.id)
        const newIndex = flat.findIndex((entry) => entry.key === over.id)
        if (oldIndex < 0 || newIndex < 0) {
            setDragPreview(null)
            return
        }
        const preview = applyLiveMove(
            flat,
            oldIndex,
            newIndex,
            expandedMapRef.current
        )
        setDragPreview({
            id: active.id,
            depth:
                preview.flat.find((entry) => entry.key === active.id)?.depth ??
                flat[oldIndex].depth,
        })
    }

    const moveFocus = (row, key) => {
        const currentRows = rowsRef.current
        const index = currentRows.findIndex(
            (candidate) => candidate.id === row.id
        )
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            const next =
                currentRows[
                    Math.max(
                        0,
                        Math.min(
                            currentRows.length - 1,
                            index + (key === 'ArrowDown' ? 1 : -1)
                        )
                    )
                ]
            store.updateState({ focusedRow: next?.id })
        } else if (key === 'ArrowRight' && row.isHeader) {
            const expanded =
                store.getState().expanded[row.node.name] ??
                expandedMapRef.current[row.node.name] ??
                false
            if (!expanded) {
                store.setExpanded(row.node.name, true)
                emitHeaderStateChange(row.node, true)
            }
            else {
                const child = currentRows.find(
                    (candidate) => candidate.parentId === row.id
                )
                if (child) store.updateState({ focusedRow: child.id })
            }
        } else if (key === 'ArrowLeft') {
            if (
                row.isHeader &&
                (store.getState().expanded[row.node.name] ??
                    expandedMapRef.current[row.node.name] ??
                    false)
            ) {
                store.setExpanded(row.node.name, false)
                emitHeaderStateChange(row.node, false)
            }
            else if (row.parentId)
                store.updateState({ focusedRow: row.parentId })
        } else if (key === 'Enter') {
            setActiveLayer(row)
        } else if (key === ' ') {
            if (row.isHeader) muteHeader(row.node)
            else setLayerToggle(row.node, !layerIsOn(row.node))
        } else if (key === 'Alt+ArrowUp' || key === 'Alt+ArrowDown') {
            const neighbor =
                currentRows[index + (key === 'Alt+ArrowUp' ? -1 : 1)]
            if (neighbor) reorderRows(row.id, neighbor.id)
        }
    }

    const onTreeKeyDown = (event) => {
        if (store.getState().openLayer) return
        const row = rowsRef.current.find(
            (candidate) => candidate.id === focused
        )
        if (!row) return
        const key = event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ? `Alt+${event.key}`
            : event.key
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Alt+ArrowUp', 'Alt+ArrowDown'].includes(key)) {
            event.preventDefault()
            moveFocus(row, key)
        }
    }

    return (
        <div className={`lt2-root ${mobile ? 'lt2-mobile' : ''}`}>
            <div className="lt2-listPane" style={{ display: state.openLayer ? 'none' : 'flex' }}>
                <div id="layersToolHeader" className="lt2-toolbar mmgisToolHeader">
                    <div className="lt2-toolbarTitle">
                        <div className="left">
                            <div className="mmgisToolTitle">Layers</div>
                            <span className="lt2-helpSlot" dangerouslySetInnerHTML={{ __html: Help.getComponent(HELP_KEY) }} />
                        </div>
                        <div className="right lt2-toolbarButtons">
                            <ToolTip label="Show only layers that are on">
                                <IconButton
                                    size="sm"
                                    aria-label="Show only visible layers"
                                    aria-pressed={state.onlyVisible}
                                    active={state.onlyVisible}
                                    onClick={() => store.updateState({ onlyVisible: !state.onlyVisible })}
                                >
                                    <i className="mdi mdi-eye mdi-18px" />
                                </IconButton>
                            </ToolTip>
                            <ToolTip label="Show only layers with active filters">
                                <IconButton
                                    size="sm"
                                    aria-label="Show only filtered layers"
                                    aria-pressed={state.onlyFiltered}
                                    active={state.onlyFiltered}
                                    onClick={() => store.updateState({ onlyFiltered: !state.onlyFiltered })}
                                >
                                    <i className="mdi mdi-filter mdi-18px" />
                                </IconButton>
                            </ToolTip>
                        </div>
                    </div>
                    <SearchBox
                        value={state.search}
                        onChange={(search) => {
                            setQuery(search)
                            store.updateState({ search })
                        }}
                        onExpandAll={() => expandAll(true)}
                        onCollapseAll={() => expandAll(false)}
                        onRestore={restoreExpansion}
                        tags={allTags}
                    />
                </div>
                {isFiltering && (
                    <div className="lt2-filterBar">
                        <span>{visibleLayers} of {total} layers</span>
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('')
                                store.updateState({ search: '', onlyVisible: false, onlyFiltered: false })
                            }}
                        >
                            Clear filters
                        </button>
                    </div>
                )}
                {isFiltering && visibleLayers === 0 ? (
                    <div className="lt2-empty">
                        <i className="mdi mdi-layers-search-outline mdi-36px" />
                        <div>No layers match{query ? ` “${query}”` : ' these filters'}.</div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setQuery('')
                                store.updateState({ search: '', onlyVisible: false, onlyFiltered: false })
                            }}
                        >
                            Clear search
                        </Button>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragOver={previewReorder}
                        onDragEnd={({ active, over }) => {
                            reorderRows(active.id, over?.id)
                            setDragPreview(null)
                        }}
                        onDragCancel={() => setDragPreview(null)}
                    >
                        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
                            <div
                                ref={scrollElement}
                                className="lt2-scroll"
                                role="tree"
                                aria-label="Layers"
                                aria-activedescendant={
                                    focused
                                        ? `lt2-row-${focused.replace(/[^a-zA-Z0-9_-]/g, '_')}`
                                        : undefined
                                }
                                tabIndex={0}
                                onKeyDown={onTreeKeyDown}
                            >
                                {rows[
                                    virtualizer.getVirtualItems()[0]?.index || 0
                                ]?.path?.length > 0 && (
                                    <div className="lt2-stickyPath">
                                        <i className="mdi mdi-folder-outline mdi-14px" />
                                        {rows[
                                            virtualizer.getVirtualItems()[0]
                                                ?.index || 0
                                        ].path.join(' › ')}
                                    </div>
                                )}
                                <div
                                    className="lt2-virtualContent"
                                    style={{ height: virtualizer.getTotalSize() }}
                                >
                                    {virtualizer.getVirtualItems().map((item) => {
                                        const row = rows[item.index]
                                        const expanded =
                                            isFiltering ||
                                            expandedMap[row.node.name] === true
                                        return (
                                            <div
                                                key={row.id}
                                                ref={(element) => {
                                                    rowElements.current[row.id] = element
                                                    virtualizer.measureElement(element)
                                                }}
                                                id={`lt2-row-${row.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                                                tabIndex={-1}
                                                role="treeitem"
                                                aria-level={row.depth + 1}
                                                aria-selected={focused === row.id}
                                                aria-expanded={
                                                    row.isHeader
                                                        ? !!expanded
                                                        : undefined
                                                }
                                                data-index={item.index}
                                                className="lt2-virtualRow"
                                                style={{
                                                    height: rowHeight,
                                                    transform: `translateY(${item.start}px)`,
                                                }}
                                            >
                                                <SortableRow
                                                    row={row}
                                                    query={query}
                                                    previews={vars.previews !== false}
                                                    depthOverride={
                                                        dragPreview?.id === row.id
                                                            ? dragPreview.depth
                                                            : undefined
                                                    }
                                                    expanded={!!expanded}
                                                    muted={state.muted[row.node.name]}
                                                    selected={state.openLayer === row.node.name}
                                                    focused={focused === row.id}
                                                    onCount={() => {}}
                                                    onExpand={() => setActiveLayer(row)}
                                                    onTitle={() => setActiveLayer(row)}
                                                    onOpen={() => setActiveLayer(row)}
                                                    onMute={() => muteHeader(row.node)}
                                                    onToggle={(checked) => setLayerToggle(row.node, checked)}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
                {toast && (
                    <div className="lt2-toast" role="status">
                        <span>{toast}</span>
                        <button type="button" onClick={undoReorder}>Undo</button>
                    </div>
                )}
            </div>
            {state.openLayer && (() => {
                const settingsExpanded = Object.fromEntries(
                    allHeaderNodes.map((header) => [header.name, true])
                )
                const row = buildRows(
                    orderedFlat,
                    { ...current, onlyFiltered: false, onlyVisible: false },
                    '',
                    settingsExpanded
                ).rows.find(
                    (candidate) => candidate.node.name === state.openLayer
                )
                const layer = L_.layers.data[state.openLayer] || row?.node
                if (!row || !layer) return null
                return (
                    <SettingsPage
                        row={row}
                        api={api}
                        onBack={() => {
                            store.updateState({ openLayer: null })
                            requestAnimationFrame(() => rowElements.current[state.focusedRow]?.focus())
                        }}
                    />
                )
            })()}
        </div>
    )
}

export default LayersTool2App
