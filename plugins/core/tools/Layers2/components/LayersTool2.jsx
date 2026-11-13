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
    MouseSensor,
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
import Toast from '@design/components/Toast/Toast'
import calls from '@pre/calls'
import * as tokml from '@maphubs/tokml'
import shpwrite from '@mapbox/shp-write'
import {
    fetchKmlAsGeoJSON,
    isKmlUrl,
} from '@basics/Layers_/capture/LayerCapturer'
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
const QUASI_LAYERS = new Set(['model', 'query', '3dtiles'])
const geometryByLayer = new Map()

function openLayerInfo(name, launcher) {
    const launcherElement = launcher || document.activeElement
    let modalId = null
    let sawModal = false
    let closed = false
    const observer = new MutationObserver(() => {
        const modal = document.getElementById('LayerInfoModal')
        if (modal) {
            sawModal = true
            modal.setAttribute('role', 'dialog')
            modal.setAttribute('aria-modal', 'true')
            modal.setAttribute('aria-labelledby', 'LayerInfoModalTitle')
        } else if (sawModal) {
            cleanup()
        }
    })
    const cleanup = () => {
        if (closed) return
        closed = true
        observer.disconnect()
        document.removeEventListener('keydown', onKeyDown, true)
        if (launcherElement?.isConnected)
            launcherElement.focus({ preventScroll: true })
    }
    const onKeyDown = (event) => {
        if (event.key !== 'Escape' || Modal.top() !== modalId) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        Modal.remove(false, Modal.top())
    }
    LayerInfoModal.open(name)
    modalId = Modal.top()
    document.addEventListener('keydown', onKeyDown, true)
    observer.observe(document.body, { childList: true, subtree: true })
    const modal = document.getElementById('LayerInfoModal')
    if (modal) {
        sawModal = true
        modal.setAttribute('role', 'dialog')
        modal.setAttribute('aria-modal', 'true')
        modal.setAttribute('aria-labelledby', 'LayerInfoModalTitle')
    }
    requestAnimationFrame(() => {
        if (!sawModal && Modal.top() !== modalId) cleanup()
    })
}

function layerName(layer) {
    return layer.display_name || layer.name
}

function sourceDownloadUrl(layer) {
    if (!layer) return null
    const downloadURL = layer.variables?.downloadURL
    let url
    if (layer.type === 'tile' || layer.type === 'data') {
        url = downloadURL
    } else if (layer.type === 'video') {
        url = downloadURL || layer.url
    } else {
        return null
    }
    return typeof url === 'string' && !/\{[zxy]\}/i.test(url) ? url : null
}

function dispatchLayerDataLoaded(layerName) {
    document.dispatchEvent(
        new CustomEvent('layersTool2LayerDataLoaded', {
            detail: { layerName },
        })
    )
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

function leafLayerDescendants(flat, headerIndex) {
    return descendantsOf(flat, headerIndex)
        .filter((entry) => entry.type !== 'header')
        .map((entry) => entry.node)
}

function rowLayerState(row) {
    const layers = row.isHeader
        ? row.descendants.filter((layer) => layer.type !== 'header')
        : [row.node]
    const countOn = layers.filter(layerIsOn).length
    const total = layers.length
    const anyOn = countOn > 0
    const partial = row.isHeader && anyOn && countOn < total
    return {
        countOn,
        total,
        partial,
        checked: row.isHeader ? total > 0 && countOn === total : anyOn,
        ariaChecked: row.isHeader ? (partial ? 'mixed' : anyOn) : anyOn,
        label: row.isHeader
            ? partial
                ? 'some layers on'
                : anyOn
                  ? 'layers on'
                  : 'layers off'
            : anyOn
              ? 'on'
              : 'off',
    }
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
    const error = layer.error || layer.failed || layer.loadError
    if (error) return error
    if (
        !QUASI_LAYERS.has(layer.type) &&
        L_.layers?.layer?.[layer.name] == null
    )
        return { kind: 'failed', message: 'Layer not found.' }
    return null
}

function refreshWarning(layer) {
    return (
        layer.refreshWarning ||
        L_.layers?.refreshFailed?.[layer.name] ||
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
    const q = query.toLowerCase()
    const tags = query
        .split(' ')
        .filter((word) => word.startsWith('#'))
        .map((word) => word.slice(1).toLowerCase())
    const textMatches = [layerName(layer), layer.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    const tagMatches = tags.some((tag) =>
        (layer.tags || []).some((value) =>
            String(value).toLowerCase().includes(tag)
        )
    )
    return textMatches || tagMatches
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
                ? leafLayerDescendants(flat, index)
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

    const siblingSizes = new Map()
    const siblingPositions = new Map()
    rows.forEach((row) => {
        siblingSizes.set(row.parentId, (siblingSizes.get(row.parentId) || 0) + 1)
    })
    rows.forEach((row) => {
        const position = (siblingPositions.get(row.parentId) || 0) + 1
        siblingPositions.set(row.parentId, position)
        row.setSize = siblingSizes.get(row.parentId)
        row.posInSet = position
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

function layerScopedApi(api, layer) {
    const name = layer.name
    return {
        ...api,
        setOpacity: (value) => api.setOpacity(value, name),
        setTileFilter: (property, value) =>
            api.setTileFilter(property, value, name),
        setBlend: (value) => api.setBlend(value, name),
        reload: () => api.reload(name),
        zoomTo: () => api.zoomTo(name),
        download: () => api.download(name),
        refresh: () => api.refresh(name),
        reset: (sectionId) => api.reset(sectionId, name),
        resetAll: () => api.resetAll(name),
        toggle: (target = name, on) => api.toggle(target, on),
        setGlobalTimeToExtent: () => api.setGlobalTimeToExtent(name),
    }
}

function layerStatusContext(layer, api) {
    return {
        layerName: layer.name,
        layerType: layer.type,
        api: layerScopedApi(api, layer),
    }
}

function geometryFor(layer, rendered) {
    const cached = geometryByLayer.get(layer.name)
    if (cached) return cached
    let geometry
    try {
        const firstFeature = rendered
            ?.getLayers?.()
            ?.find?.((item) => item.feature)
        geometry =
            layer.geometryType ||
            layer.variables?.geometryType ||
            rendered?.feature?.geometry?.type ||
            firstFeature?.feature?.geometry?.type ||
            rendered?.toGeoJSON?.().features?.find(
                (feature) => feature.geometry
            )?.geometry?.type
    } catch (error) {}
    if (geometry) geometryByLayer.set(layer.name, geometry)
    return geometry || ''
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

function StatusSlot({ layer, onOpen, api, rowId }) {
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
        pluginStatus = typeStatus?.(layer, layerStatusContext(layer, api))
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
                <button className="lt2-status lt2-statusError" aria-label={`Layer failed; open settings for ${layerName(layer)}`} tabIndex={-1} onClick={() => onOpen(rowId)}>
                    <i className="mdi mdi-alert-circle mdi-16px" />
                </button>
            </ToolTip>
        )
    if (warning || kind === 'cached')
        return (
            <ToolTip label={message || 'Layer refresh failed. Using cached data.'}>
                <button className="lt2-status lt2-statusWarning" aria-label={`Refresh failed; open settings for ${layerName(layer)}`} tabIndex={-1} onClick={() => onOpen(rowId)}>
                    <i className="mdi mdi-cloud-alert mdi-16px" />
                </button>
            </ToolTip>
        )
    if (timeEnabled || filtered)
        return (
            <span className="lt2-statusGroup">
                {timeEnabled && (
                    <ToolTip label="Time-enabled layer settings">
                        <button className="lt2-status" aria-label={`Time settings for ${layerName(layer)}`} tabIndex={-1} onClick={() => onOpen(rowId)}>
                            <i className="mdi mdi-clock-outline mdi-16px" />
                        </button>
                    </ToolTip>
                )}
                {filtered && (
                    <ToolTip label="Layer has an active filter">
                        <button className="lt2-status lt2-statusFiltered" aria-label={`Filtered layer; open settings for ${layerName(layer)}`} tabIndex={-1} onClick={() => onOpen(rowId)}>
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
    rowState: rowStateProp,
    expanded,
    onExpand,
    onTitle,
    onMute,
    muted,
    query,
    selected,
    focused,
    dragHandle,
    depthOverride,
}) {
    const rowState = rowStateProp || rowLayerState(row)
    const mutedCount = Array.isArray(muted) ? muted.length : 0
    return (
        <div
            className={`lt2-row lt2-headerRow ${focused ? 'lt2-focused' : ''} ${selected ? 'lt2-selected' : ''}`}
            style={{
                '--depth': depthOverride ?? row.depth,
                '--lt-color': typeColor(row.node.type),
            }}
            data-row-id={row.id}
        >
            <span className="lt2-indentGuides" aria-hidden="true" />
            <button className="lt2-drag" aria-label={`Drag ${row.label} to reorder`} {...dragHandle} tabIndex={-1}>
                <i className="mdi mdi-drag-vertical mdi-16px" />
            </button>
            <button className="lt2-chevron" aria-label={expanded ? 'Collapse group' : 'Expand group'} tabIndex={-1} onClick={() => onExpand(row.id)}>
                <i className={`mdi mdi-chevron-right mdi-18px ${expanded ? 'lt2-open' : ''}`} />
            </button>
            <span className="lt2-checkWrap" title={mutedCount ? `Restore ${mutedCount} muted layers` : 'Mute or restore on layers in this group'}>
                <Checkbox
                    checked={rowState.checked}
                    indeterminate={rowState.partial}
                    onCheckedChange={() => onMute(row.id)}
                    aria-label={mutedCount ? `Restore ${mutedCount} muted layers` : 'Mute or restore group layers'}
                    showCheck
                    tabIndex={-1}
                />
            </span>
            <button className="lt2-title lt2-headerTitle" title={row.label} tabIndex={-1} onClick={() => onTitle(row.id)}>
                <span className="lt2-name">{highlightText(row.label, query)}</span>
            </button>
            <ToolTip label="Information">
                <button
                    type="button"
                    className="lt2-status"
                    aria-label={`Information about ${row.label}`}
                    title={`Information about ${row.label}`}
                    tabIndex={-1}
                    onClick={(event) =>
                        openLayerInfo(row.node.name, event.currentTarget)
                    }
                >
                    <i className="mdi mdi-information-outline mdi-16px" />
                </button>
            </ToolTip>
            {mutedCount > 0 && <span className="lt2-muted">{mutedCount} muted</span>}
        {!expanded && (
            <span
                className="lt2-count"
                aria-label={`${rowState.countOn} of ${rowState.total} layers on`}
            >
                {rowState.countOn}/{rowState.total}
            </span>
        )}
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
    api,
    isOn: isOnProp,
}) {
    const layer = row.node
    const isOn = isOnProp ?? layerIsOn(layer)
    const failed = !!activeError(layer)
    const color = typeColor(layer.type)
    const isRaster = RASTER_TYPES.has(layer.type)
    const rendered = L_.layers?.layer?.[layer.name]
    const geometry = geometryFor(layer, rendered)
    const pointGeometry =
        /point/i.test(geometry) ||
        (!geometry &&
            (layer.style?.radius != null || layer.style?.marker != null))
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
              : /polygon/i.test(geometry)
                ? 'polygon'
                : 'neutral'
        : null
    const glyphColor =
        (glyphShape === 'line' ? layer.style?.strokeColor : null) ||
        layer.style?.fillColor ||
        layer.style?.strokeColor ||
        layer.style?.color ||
        color
    const missing =
        !QUASI_LAYERS.has(layer.type) &&
        L_.layers?.layer?.[layer.name] == null
    return (
        <div
            className={`lt2-row lt2-layerRow ${isRaster && previews ? 'lt2-rasterRow' : ''} ${isRaster && row.label.length > 24 ? 'lt2-longRasterName' : ''} ${isOn ? 'lt2-on' : ''} ${failed ? 'lt2-failed' : ''} ${missing ? 'lt2-layerNotFound' : ''} ${focused ? 'lt2-focused' : ''} ${selected ? 'lt2-selected' : ''}`}
            style={{
                '--depth': depthOverride ?? row.depth,
                '--lt-color': color,
            }}
            data-row-id={row.id}
        >
            <span className="lt2-indentGuides" aria-hidden="true" />
            <button className="lt2-drag" aria-label={`Drag ${row.label} to reorder`} {...dragHandle} tabIndex={-1}>
                <i className="mdi mdi-drag-vertical mdi-16px" />
            </button>
            <span className="lt2-chevronSpace" aria-hidden="true" />
            <span className="lt2-checkWrap">
                <Checkbox
                    checked={isOn}
                    onCheckedChange={(checked) => onToggle(row.id, checked)}
                    aria-label={`${isOn ? 'Turn off' : 'Turn on'} ${row.label}`}
                    showCheck
                    tabIndex={-1}
                />
            </span>
            <button className="lt2-title" onClick={() => onOpen(row.id)} title={row.label} tabIndex={-1}>
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
            {isRaster && (
                <RasterPreview
                    key={layer.name}
                    layer={layer}
                    enabled={previews}
                    version={store.getState().previewVersions[layer.name] || 0}
                />
            )}
            <StatusSlot layer={layer} onOpen={onOpen} rowId={row.id} api={api} />
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
                <MemoHeaderRow {...rowProps} />
            ) : (
                <MemoLayerRow {...rowProps} />
            )}
        </div>
    )
}

const MemoHeaderRow = React.memo(HeaderRow)
const MemoLayerRow = React.memo(LayerRow)
const MemoSortableRow = React.memo(SortableRow)

class PluginSectionBoundary extends React.Component {
    state = { error: null }

    static getDerivedStateFromError(error) {
        return { error }
    }

    render() {
        if (this.state.error)
            return (
                <div className="lt2-inlineError" role="alert">
                    <strong>This section failed to load</strong>
                    <div>{this.state.error.message || String(this.state.error)}</div>
                </div>
            )
        return this.props.children
    }
}

function CoreSettings({ layer, api }) {
    const opacity = L_.layers?.opacity?.[layer.name] ?? layer.initialOpacity ?? 1
    const [exportError, setExportError] = useState('')
    const [actionError, setActionError] = useState('')
    const [exportFormat, setExportFormat] = useState('geojson')
    const [exportCoordinates, setExportCoordinates] = useState('source')
    const [exportExtent, setExportExtent] = useState('current')
    const [exportProperties, setExportProperties] = useState(true)
    const [exportBusy, setExportBusy] = useState(false)
    const exportResetToken =
        store.getState().resetTokens[layer.name]?.export || 0
    const layerVersion = store.getState().layerVersion
    const layerOn = layerIsOn(layer)
    const pluginContext = useMemo(
        () => layerStatusContext(layer, api),
        [layer, api]
    )
    useEffect(() => {
        setExportFormat('geojson')
        setExportCoordinates('source')
        setExportExtent('current')
        setExportProperties(true)
        setExportError('')
    }, [layer.name, exportResetToken])
    const plugin = LayerTypeRegistry.settings(layer.type)
    const testPlugin = window.__layersTool2TestPluginRegistry?.[layer.type]
    const pluginSections = useMemo(() => {
        try {
            return [
                ...(plugin?.sections?.(layer, pluginContext) || []),
                ...(testPlugin?.sections || []),
            ]
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
        } catch (error) {
            return []
        }
    }, [plugin, testPlugin, layer, pluginContext, layerVersion, layerOn])
    const displayExtension = pluginSections.find(
        (section) => section.id === 'display'
    )
    const DisplayComponent = displayExtension?.Component
    const pluginActions = useMemo(() => {
        try {
            return [
                ...(plugin?.actions?.(layer, pluginContext) || []),
                ...(testPlugin?.actions || []),
            ]
        } catch (error) {
            return []
        }
    }, [plugin, testPlugin, layer, pluginContext])

    const exportLayer = async () => {
        setExportBusy(true)
        setExportError('')
        try {
            const mapLayer = L_.layers?.layer?.[layer.name]
            if (!mapLayer?.toGeoJSON)
                throw new Error('This layer does not expose exportable GeoJSON data.')
            const requestApi = (endpoint, body) =>
                new Promise((resolve, reject) =>
                    calls.api(endpoint, body, resolve, reject)
                )
            let geojson
            if (
                exportExtent === 'entire' &&
                layer.variables?.dynamicExtent === true &&
                layer.url
            ) {
                const urlParts = layer.url.split(':')
                if (urlParts[0].toLowerCase() === 'geodatasets') {
                    const data = await requestApi('geodatasets_get', {
                        layer: urlParts[1],
                        type: 'geojson',
                    })
                    geojson = data.body
                } else {
                    const sourceUrl = L_.getUrl(layer.type, layer.url, layer)
                    if (isKmlUrl(sourceUrl)) {
                        geojson = await new Promise((resolve, reject) =>
                            fetchKmlAsGeoJSON(sourceUrl, resolve, reject)
                        )
                    } else {
                        const response = await fetch(sourceUrl)
                        if (!response.ok)
                            throw new Error(
                                `Source export failed (${response.status}).`
                            )
                        geojson = await response.json()
                    }
                }
            } else if (
                exportExtent === 'raw-extent' &&
                layer._lastGeodatasetRequestBody
            ) {
                const body = JSON.parse(
                    JSON.stringify(layer._lastGeodatasetRequestBody)
                )
                delete body._source
                delete body.noDuplicates
                geojson = await requestApi('geodatasets_get', body)
            } else {
                const precision =
                    L_.GEOJSON_PRECISION ?? window.L_?.GEOJSON_PRECISION
                geojson = mapLayer.toGeoJSON(precision)
            }
            if (
                layer.variables?.dynamicExtent === true &&
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
                const projection = window.mmgisglobal?.customCRS?.projString
                if (!projection)
                    throw new Error('The map projection is unavailable for SHP export.')
                const prj = await requestApi('proj42wkt', {
                    proj4: projection,
                })
                const blob = await shpwrite.zip(geojson, {
                    outputType: 'blob',
                    prj,
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
                    step={0.05}
                    onChange={(value) => api.setOpacity(value)}
                />
                {DisplayComponent && (
                    <PluginSectionBoundary key="display-extension">
                        <DisplayComponent
                            layer={layer}
                            api={api}
                            state={
                                store.getState().sectionState[layer.name]?.display ||
                                {}
                            }
                            setState={(value) =>
                                store.setLayerSectionState(
                                    layer.name,
                                    'display',
                                    value
                                )
                            }
                            resetToken={
                                store.getState().resetTokens[layer.name]
                                    ?.display || 0
                            }
                        />
                    </PluginSectionBoundary>
                )}
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
                                ...(layer.variables?.getFeaturePropertiesOnClick === true &&
                                layer._lastGeodatasetRequestBody
                                    ? [
                                          {
                                              value: 'raw-extent',
                                              label: 'Current Extent w/ Props',
                                          },
                                      ]
                                    : []),
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
                {sourceDownloadUrl(layer) && (
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
                layer.variables?.downloadURL &&
                sourceDownloadUrl(layer) && (
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
            {pluginSections
                .filter((section) => section.id !== 'display')
                .map((section) => {
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
                            <PluginSectionBoundary key={`${section.id}-boundary`}>
                                <Component
                                    layer={layer}
                                    api={api}
                                    state={store.getState().sectionState[layer.name]?.[section.id] || {}}
                                    setState={(value) => store.setLayerSectionState(layer.name, section.id, value)}
                                    resetToken={store.getState().resetTokens[layer.name]?.[section.id] || 0}
                                />
                            </PluginSectionBoundary>
                        ) : null}
                    </SettingSection>
                )
                })}
            <div className="lt2-pluginActions">
                {pluginActions.map((action) => (
                    <Button className="lt2-iconTextButton" key={action.id} size="sm" variant="secondary" onClick={() => {
                        setActionError('')
                        try {
                            Promise.resolve(action.onClick?.(pluginContext)).catch((error) =>
                                {
                                    const message = error.message || String(error)
                                    setActionError(message)
                                    Toast.error(message, 6000)
                                }
                            )
                        } catch (error) {
                            const message = error.message || String(error)
                            setActionError(message)
                            Toast.error(message, 6000)
                        }
                    }}>
                        {action.icon && <i className={`mdi mdi-${action.icon}`} />} {action.label}
                    </Button>
                ))}
            </div>
            {actionError && <div className="lt2-inlineError" role="alert">{actionError}</div>}
        </>
    )
}

function SettingsPage({ row, api: baseApi, onBack }) {
    const layer = row.node
    const api = useMemo(
        () => layerScopedApi(baseApi, layer),
        [baseApi, layer]
    )
    const titleRef = useRef(null)
    const settingsRef = useRef(null)
    const color = typeColor(layer.type)
    const status = activeError(layer) || refreshWarning(layer)
    const downloadUrl = sourceDownloadUrl(layer)
    const exportAction = ['vector', 'query'].includes(layer.type)
    const showDownload = Boolean(downloadUrl) || exportAction
    let typeStatus = null
    try {
        typeStatus = LayerTypeRegistry.settings(layer.type)?.status?.(
            layer,
            layerStatusContext(layer, baseApi)
        )
    } catch (error) {}
    const visible = layerIsOn(layer)
    const retry = () => api.reload()
    const info = (event) => openLayerInfo(layer.name, event.currentTarget)
    const download = () => {
        if (downloadUrl) {
            api.download()
            return
        }
        const section = settingsRef.current?.querySelector(
            '[data-section="export"]'
        )
        if (!section) return
        section.tabIndex = -1
        section.scrollIntoView({ block: 'start' })
        section.focus({ preventScroll: true })
    }
    useEffect(() => {
        titleRef.current?.focus()
    }, [layer.name])
    return (
        <div className="lt2-settings" role="region" aria-label={`${row.label} settings`} ref={settingsRef}>
            <div
                className="lt2-hero"
                style={{ '--layer-color': color }}
            >
                <div className="lt2-heroActions">
                    <ToolTip label="Back to layers (Esc)">
                        <IconButton size="sm" aria-label="Back to layers" aria-keyshortcuts="Escape" onClick={onBack}>
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
                        {showDownload && (
                            <ToolTip label="Download">
                                <IconButton
                                    size="sm"
                                    aria-label="Download layer"
                                    onClick={download}
                                >
                                    <i className="mdi mdi-download mdi-18px" />
                                </IconButton>
                            </ToolTip>
                        )}
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
                <h2 className="lt2-settingsName" title={row.label} ref={titleRef} tabIndex={-1}>{row.label}</h2>
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
    const [reorderAnnouncement, setReorderAnnouncement] = useState('')
    const [dragPreview, setDragPreview] = useState(null)
    const [activeDragId, setActiveDragId] = useState(null)
    const mobile = L_.UserInterface_.isMobile === true
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
    const settingsRowsByName = useMemo(() => {
        const expanded = Object.fromEntries(
            allHeaderNodes.map((header) => [header.name, true])
        )
        return new Map(
            buildRows(
                orderedFlat,
                { onlyVisible: false, onlyFiltered: false },
                '',
                expanded
            ).rows.map((row) => [row.node.name, row])
        )
    }, [orderedFlat, allHeaderNodes])
    const current = {
        onlyVisible: state.onlyVisible,
        onlyFiltered: state.onlyFiltered,
    }
    const isFiltering = !!(
        query ||
        state.onlyVisible ||
        state.onlyFiltered
    )
    const rowModel = useMemo(
        () => buildRows(orderedFlat, current, query, expandedMap),
        [
            orderedFlat,
            expandedMap,
            state.onlyVisible,
            state.onlyFiltered,
            isFiltering ? state.layerVersion : 0,
            query,
        ]
    )
    const rows = rowModel.rows
    const rowStates = useMemo(
        () =>
            new Map(
                rows.map((row) => [row.id, rowLayerState(row)])
            ),
        [rows, state.layerVersion]
    )
    orderedFlatRef.current = orderedFlat
    rowsRef.current = rows
    expandedMapRef.current = {
        ...expandedMap,
        searchHidden: rowModel.hiddenByFilter,
    }
    useEffect(() => {
        const layerNames = new Set(allLayerNodes.map((layer) => layer.name))
        const headerNames = new Set(allHeaderNodes.map((header) => header.name))
        const keepKeys = (record, allowed) =>
            Object.fromEntries(
                Object.entries(record || {}).filter(([name]) => allowed.has(name))
            )
        const sectionState = keepKeys(state.sectionState, layerNames)
        const resetTokens = keepKeys(state.resetTokens, layerNames)
        const expanded = keepKeys(state.expanded, headerNames)
        const muted = keepKeys(state.muted, headerNames)
        const changed =
            Object.keys(sectionState).length !== Object.keys(state.sectionState).length ||
            Object.keys(resetTokens).length !== Object.keys(state.resetTokens).length ||
            Object.keys(expanded).length !== Object.keys(state.expanded).length ||
            Object.keys(muted).length !== Object.keys(state.muted).length
        if (changed || (state.openLayer && !layerNames.has(state.openLayer)))
            store.updateState({
                sectionState,
                resetTokens,
                expanded,
                muted,
                ...(state.openLayer && !layerNames.has(state.openLayer)
                    ? { openLayer: null }
                    : {}),
            })
    }, [
        allLayerNodes,
        allHeaderNodes,
        state.sectionState,
        state.resetTokens,
        state.expanded,
        state.muted,
        state.openLayer,
    ])
    const total = allLayerNodes.length
    const visibleLayers = useMemo(
        () => rows.filter((row) => !row.isHeader).length,
        [rows]
    )
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
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollElement.current,
        estimateSize: () => rowHeight,
        overscan: 12,
        paddingStart: 22,
        scrollPaddingStart: 22,
    })
    const sortableItems = useMemo(() => rows.map((row) => row.id), [rows])
    const [liveCount, setLiveCount] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => {
            setLiveCount(
                isFiltering
                    ? `${visibleLayers} of ${total} layers${query ? ` match ${query}` : ''}`
                    : ''
            )
        }, 250)
        return () => clearTimeout(timer)
    }, [isFiltering, visibleLayers, total, query])

    const api = useMemo(
        () => ({
            setOpacity: (value, layerName = state.openLayer) => {
                L_.setLayerOpacity(layerName, value)
                store.updateState({
                    layerVersion: store.getState().layerVersion + 1,
                })
            },
            setTileFilter: (property, value, layerName = state.openLayer) => {
                if (!L_.layers.data[layerName]) return
                L_.setLayerFilter(layerName, property, value)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            setBlend: (value, layerName = state.openLayer) => {
                if (!L_.layers.data[layerName]) return
                L_.setLayerFilter(layerName, 'mix-blend-mode', value)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            reload: async (layerName = state.openLayer) => {
                const layer = L_.layers.data[layerName]
                const rendered = L_.layers.layer[layerName]
                if (!layer) return
                if (layer.type === 'image' && rendered?.refresh)
                    rendered.refresh(null, true, {
                        currentCogExpression: null,
                    })
                else if (layer.type !== 'tile')
                    await Map_.refreshLayer(layer)
                dispatchLayerDataLoaded(layerName)
                store.bumpLayerPreview(layerName)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            zoomTo: (layerName = state.openLayer) => {
                const rendered = L_.layers.layer[layerName]
                const layer = L_.layers.data[layerName]
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
            download: (layerName = state.openLayer) => {
                const layer = L_.layers.data[layerName]
                const url = sourceDownloadUrl(layer)
                if (url) window.open(url, '_blank', 'noopener')
            },
            refresh: (layerName = state.openLayer) => {
                store.bumpLayerPreview(layerName)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            reset: (sectionId, layerName = state.openLayer) => {
                const name = layerName
                const layer =
                    L_.layers.data[name] || findLayer(L_.configData?.layers, name)
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
                const section = (LayerTypeRegistry.settings(layer?.type)?.sections?.(layer, api) || [])
                    .find((entry) => entry.id === sectionId)
                section?.reset?.(layerScopedApi(api, layer), layer)
                store.resetLayerSection(name, sectionId)
            },
            resetAll: (layerName = state.openLayer) => {
                const name = layerName
                const layer =
                    L_.layers.data[name] || findLayer(L_.configData?.layers, name)
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
                const settings = LayerTypeRegistry.settings(layer?.type)
                let sectionIds = []
                try {
                    const sections = settings?.sections?.(
                        layer,
                        layerStatusContext(layer, api)
                    ) || []
                    sections.forEach((section) => section.reset?.(layerScopedApi(api, layer), layer))
                    sectionIds = sections.map((section) => section.id)
                } catch (error) {}
                store.resetAllLayerSections(name)
                sectionIds.forEach((sectionId) =>
                    store.resetLayerSection(name, sectionId)
                )
                if (!sectionIds.includes('export'))
                    store.resetLayerSection(name, 'export')
            },
            toggle: async (name, target) => {
                const layer =
                    L_.layers.data[name] ||
                    findLayer(L_.configData?.layers, name)
                if (!layer) return
                const on = layerIsOn(layer)
                if (target === undefined || target !== on) {
                    if (target === undefined) await L_.toggleLayer(layer)
                    else {
                        await L_.toggleLayerHelper(layer, !target)
                        if (target) dispatchLayerDataLoaded(name)
                    }
                }
                store.bumpLayerPreview(name)
                store.updateState({ layerVersion: store.getState().layerVersion + 1 })
            },
            setGlobalTimeToExtent: (layerName = state.openLayer) => {
                const layer = L_.layers.data[layerName]
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
        const onLayerToggle = (layerName) => {
            dispatchLayerDataLoaded(layerName)
            store.bumpLayerPreview(layerName)
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
        }
        const onRefreshStatus = () =>
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
        const onFilterStateChange = () =>
            store.updateState({
                layerVersion: store.getState().layerVersion + 1,
            })
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
            if (
                event.defaultPrevented ||
                event.key !== 'Escape' ||
                (event.target instanceof Element &&
                    event.target.closest(
                        'input, textarea, [role="listbox"], [role="menu"], [role="dialog"], [data-popup]'
                    ))
            )
                return
            if (store.getState().openLayer) {
                event.preventDefault()
                store.updateState({ openLayer: null })
                Modal.remove(true, Modal.top())
                requestAnimationFrame(() => scrollElement.current?.focus())
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
                    : leafLayerDescendants(flat, headerIndex)
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

    const openRow = useCallback(
        (rowId) => {
            const row = rowsRef.current.find((candidate) => candidate.id === rowId)
            if (row) setActiveLayer(row)
        },
        [setActiveLayer]
    )
    const toggleRow = useCallback(
        (rowId, checked) => {
            const row = rowsRef.current.find((candidate) => candidate.id === rowId)
            if (row && !row.isHeader) setLayerToggle(row.node, checked)
        },
        [setLayerToggle]
    )
    const muteRow = useCallback(
        (rowId) => {
            const row = rowsRef.current.find((candidate) => candidate.id === rowId)
            if (row?.isHeader) muteHeader(row.node)
        },
        [muteHeader]
    )

    const setHeaderExpansion = (nextExpanded, orderedHeaders = allHeaderNodes) => {
        const previous = store.getState().expanded
        store.updateState({ expanded: nextExpanded })
        orderedHeaders.forEach((header) => {
            const wasExpanded =
                previous[header.name] ??
                expandedMapRef.current[header.name] ??
                false
            if (wasExpanded !== nextExpanded[header.name])
                emitHeaderStateChange(header, nextExpanded[header.name])
        })
    }
    const expandAll = (expanded) =>
        setHeaderExpansion(
            Object.fromEntries(
                allHeaderNodes.map((header) => [header.name, expanded])
            )
        )
    const collapseAll = () => {
        const collapseOrder = orderedFlat
            .filter((row) => row.type === 'header')
            .slice()
            .sort((a, b) => b.depth - a.depth)
            .map((row) => row.node)
        setHeaderExpansion(
            Object.fromEntries(
                allHeaderNodes.map((header) => [header.name, false])
            ),
            collapseOrder
        )
    }
    const restoreExpansion = () => {
        collapseAll()
        setHeaderExpansion(
            Object.fromEntries(
                allHeaderNodes.map((header) => [
                    header.name,
                    header.expanded === true,
                ])
            ),
            allHeaderNodes.filter((header) => header.expanded === true)
        )
    }

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
        const visibleKeys = new Set(rowsRef.current.map((row) => row.id))
        const searchHidden = new Set(
            expandedMapRef.current.searchHidden || []
        )
        flat.forEach((row) => {
            if (!visibleKeys.has(row.key)) searchHidden.add(row.key)
        })
        const result = applyLiveMove(
            flat,
            oldIndex,
            newIndex,
            { ...expandedMapRef.current, searchHidden }
        )
        const history = [...currentState.orderingHistory, result.entry]
        const nextFlat = replay(
            flatten(L_.configData?.layers),
            history
        ).flat
        const before = flat.map(({ key, depth }) => `${key}:${depth}`).join('|')
        const after = nextFlat
            .map(({ key, depth }) => `${key}:${depth}`)
            .join('|')
        if (before === after) return
        store.updateState({ orderingHistory: history })
        try {
            L_.reorderLayers?.(layerOrder(nextFlat))
        } catch (error) {
            console.error(
                'LayersTool2 failed to synchronize map order after a reorder.',
                error
            )
        }
        const relation = oldIndex < newIndex ? 'below' : 'above'
        const movedIndex = nextFlat.findIndex(
            (entry) => entry.key === activeId
        )
        const newParentIndex = parentOf(nextFlat, movedIndex)
        const newParent =
            newParentIndex == null ? null : nextFlat[newParentIndex]
        const movedAcrossGroups = active.parentId !== (newParent?.key || null)
        const parentLabel =
            rowsRef.current.find((row) => row.id === newParent?.key)?.label ||
            newParent?.node?.display_name ||
            newParent?.name
        const message = movedAcrossGroups && parentLabel
            ? `Moved ${active.label} into ${parentLabel}`
            : `Moved ${active.label} ${relation} ${target.label}`
        setToast(message)
        setReorderAnnouncement('')
        requestAnimationFrame(() => setReorderAnnouncement(message))
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => {
            const toastHasFocus =
                document.activeElement?.closest('.lt2-toast') != null
            setToast(null)
            if (toastHasFocus)
                requestAnimationFrame(() => scrollElement.current?.focus())
        }, 5000)
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
        } else if (key === 'Home' || key === 'End') {
            const next = currentRows[key === 'Home' ? 0 : currentRows.length - 1]
            if (next) store.updateState({ focusedRow: next.id })
        } else if (key === 'PageDown' || key === 'PageUp') {
            const pageSize = Math.max(
                1,
                Math.floor(
                    (scrollElement.current?.clientHeight || rowHeight) / rowHeight
                )
            )
            const nextIndex = Math.max(
                0,
                Math.min(
                    currentRows.length - 1,
                    index + (key === 'PageDown' ? pageSize : -pageSize)
                )
            )
            store.updateState({ focusedRow: currentRows[nextIndex]?.id })
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
            let neighbor
            if (key === 'Alt+ArrowDown' && row.isHeader) {
                const flat = replay(
                    flatten(L_.configData?.layers),
                    store.getState().orderingHistory
                ).flat
                const flatIndex = flat.findIndex(
                    (entry) => entry.key === row.id
                )
                const target =
                    flatIndex < 0
                        ? null
                        : flat[
                              flatIndex +
                                  descendantsOf(flat, flatIndex).length +
                                  1
                          ]
                neighbor = currentRows.find(
                    (candidate) => candidate.id === target?.key
                )
            } else {
                neighbor =
                    currentRows[index + (key === 'Alt+ArrowUp' ? -1 : 1)]
            }
            if (neighbor) reorderRows(row.id, neighbor.id)
        }
    }

    const onTreeKeyDown = (event) => {
        if (store.getState().openLayer) return
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 'z'
        ) {
            event.preventDefault()
            undoReorder()
            return
        }
        const row = rowsRef.current.find(
            (candidate) => candidate.id === focused
        )
        if (!row) return
        const key = event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ? `Alt+${event.key}`
            : event.key
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Alt+ArrowUp', 'Alt+ArrowDown'].includes(key)) {
            event.preventDefault()
            moveFocus(row, key)
        }
    }

    const virtualItems = virtualizer.getVirtualItems()
    const scrollOffset = scrollElement.current?.scrollTop || 0
    const stickyItem = virtualItems.find(
        (item) => item.start + item.size > scrollOffset
    )
    const stickyPath = rows[stickyItem?.index ?? 0]?.path || []
    const rowLabel = (id) =>
        rowsRef.current.find((candidate) => candidate.id === id)?.label || 'layer'
    const dragAnnouncements = {
        onDragStart: ({ active }) => `Picked up ${rowLabel(active.id)}.`,
        onDragOver: ({ active, over }) =>
            over
                ? `${rowLabel(active.id)} is over ${rowLabel(over.id)}.`
                : `Picked up ${rowLabel(active.id)}.`,
        onDragEnd: ({ active, over }) => {
            if (!over) return `Reorder cancelled for ${rowLabel(active.id)}.`
            const activeRow = rowsRef.current.find(
                (row) => row.id === active.id
            )
            const overRow = rowsRef.current.find((row) => row.id === over.id)
            return activeRow?.parentId !== overRow?.parentId
                ? `Moved ${rowLabel(active.id)} to another group.`
                : `Moved ${rowLabel(active.id)} near ${rowLabel(over.id)}.`
        },
        onDragCancel: ({ active }) =>
            `Reorder cancelled for ${rowLabel(active.id)}.`,
    }

    return (
        <div className={`lt2-root ${mobile ? 'lt2-mobile' : ''}`}>
            <div className="lt2-liveRegion" aria-live="polite" aria-atomic="true">{liveCount}</div>
            <div
                className="lt2-listPane"
                style={
                    state.openLayer
                        ? {
                              visibility: 'hidden',
                              position: 'absolute',
                              inset: 0,
                              pointerEvents: 'none',
                          }
                        : undefined
                }
            >
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
                        onCollapseAll={collapseAll}
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
                        accessibility={{ announcements: dragAnnouncements }}
                        onDragStart={({ active }) =>
                            setActiveDragId(String(active.id))
                        }
                        onDragOver={previewReorder}
                        onDragEnd={({ active, over }) => {
                            try {
                                reorderRows(active.id, over?.id)
                            } catch (error) {
                                console.error(
                                    'LayersTool2 failed to apply a reorder.',
                                    error
                                )
                            } finally {
                                setDragPreview(null)
                                setActiveDragId(null)
                            }
                        }}
                        onDragCancel={() => {
                            setDragPreview(null)
                            setActiveDragId(null)
                        }}
                    >
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            <div
                                ref={scrollElement}
                                className="lt2-scroll"
                                role="tree"
                                aria-label="Layers"
                                data-active-drag-id={activeDragId || ''}
                                aria-activedescendant={
                                    focused
                                        ? `lt2-row-${focused.replace(/[^a-zA-Z0-9_-]/g, '_')}`
                                        : undefined
                                }
                                tabIndex={0}
                                onKeyDown={onTreeKeyDown}
                            >
                                {stickyPath.length > 0 && (
                                    <div className="lt2-stickyPath">
                                        <i className="mdi mdi-folder-outline mdi-14px" />
                                        {stickyPath.join(' › ')}
                                    </div>
                                )}
                                <div
                                    className="lt2-virtualContent"
                                    role="group"
                                    style={{ height: virtualizer.getTotalSize() }}
                                >
                                    {virtualItems.map((item) => {
                                        const row = rows[item.index]
                                        const expanded =
                                            isFiltering ||
                                            expandedMap[row.node.name] === true
                                        const rowState = rowStates.get(row.id)
                                        return (
                                            <div
                                                key={row.id}
                                                ref={(element) => {
                                                    rowElements.current[row.id] = element
                                                }}
                                                id={`lt2-row-${row.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                                                tabIndex={-1}
                                                role="treeitem"
                                                aria-label={`${row.label}, ${rowState.label}`}
                                                aria-level={row.depth + 1}
                                                aria-selected={
                                                    !row.isHeader &&
                                                    state.openLayer === row.node.name
                                                        ? true
                                                        : undefined
                                                }
                                                aria-checked={
                                                    rowState.ariaChecked
                                                }
                                                aria-setsize={row.setSize}
                                                aria-posinset={row.posInSet}
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
                                                <MemoSortableRow
                                                    row={row}
                                                    rowState={rowState}
                                                    api={api}
                                                    isOn={row.isHeader ? undefined : layerIsOn(row.node)}
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
                                                    onExpand={openRow}
                                                    onTitle={openRow}
                                                    onOpen={openRow}
                                                    onMute={muteRow}
                                                    onToggle={toggleRow}
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
                <div className="lt2-liveRegion" aria-live="polite" aria-atomic="true">
                    {reorderAnnouncement}
                </div>
            </div>
            {state.openLayer && (() => {
                const row = settingsRowsByName.get(state.openLayer)
                const layer = L_.layers.data[state.openLayer] || row?.node
                if (!row || !layer) return null
                return (
                    <SettingsPage
                        row={row}
                        api={api}
                        onBack={() => {
                            store.updateState({ openLayer: null })
                            requestAnimationFrame(() => scrollElement.current?.focus())
                        }}
                    />
                )
            })()}
        </div>
    )
}

export default LayersTool2App
