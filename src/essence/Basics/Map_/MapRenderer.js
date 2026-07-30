/**
 * MapRenderer - Abstraction wrapper for 2D map rendering engines.
 *
 * The 2D-map analog of GlobeRenderer. Today it wraps a single engine (Leaflet),
 * but it exists so that layer-type PLUGINS never touch Leaflet directly: a plugin
 * describes what it wants with neutral primitives (addTile/addVector/…) and the
 * middleware maps that onto the engine. Adding a second map engine later
 * (deck.gl, MapLibre, …) becomes a core-only change here plus, for genuinely
 * engine-specific layer behavior, a per-engine plugin override file
 * (map/<engine>/<type>.js) — with zero edits to neutral plugins.
 *
 * Neutral-first with a per-engine escape hatch: the common raster/vector fields
 * are first-class; anything Leaflet-plugin-specific rides through
 * `spec.engineOptions`, and a plugin can reach the raw engine via `mctx.raw`.
 *
 * NOTE: Existing tools and L_ still call Leaflet directly; that is intentionally
 * left as-is and can be migrated behind this middleware in a later change. Only
 * new layer-type plugins are required to render through MapRenderer.
 *
 * mctx (leaflet) = {
 *   engine: 'leaflet',
 *   map,             // the L.Map for this context
 *   layerRegistry,   // L_.layers (or the secondary map context's registry)
 *   default,         // true for the main map context
 *   raw,             // window.L (escape hatch for engine-specific plugin code)
 * }
 */
import L_ from '@basics/Layers_/Layers_'
import { constructVectorLayer } from '@basics/Layers_/LayerConstructors'
import LayerInterface from '@basics/Layers_/LayerInterface'
import LayerTypeRegistry from '@basics/Layers_/LayerTypeRegistry'

const L = window.L

// Resolve a neutral engine context from the frozen map `ctx.mapContext`. When no
// mapContext is provided we default to the main map, matching legacy behavior.
function context(mapContext) {
    const mCtx = mapContext || {
        map: L_.Map_.map,
        layerRegistry: L_.layers,
        default: true,
    }
    return {
        engine: 'leaflet',
        map: mCtx.map,
        layerRegistry: mCtx.layerRegistry,
        default: mCtx.default === true,
        raw: L,
    }
}

// Neutral primitive: add a tiled raster source.
//
// spec = {
//   url,                         // resolved tile-template URL
//   tms,                         // boolean (TMS vs WMTS y-ordering)
//   minZoom, maxZoom, maxNativeZoom,
//   boundingBox,                 // [w, s, e, n] | null
//   opacity,                     // 0..1 (defaults to the registry opacity or 1)
//   noFade,                      // boolean (instant swap; e.g. time-enabled tiles)
//   onLoading, onLoad,           // optional per-layer hooks (plugin-specific extras)
//   engineOptions,               // opaque, engine-specific options (Leaflet colorFilter)
// }
function addTile(layerObj, spec, mctx) {
    const name = layerObj.name

    let bounds
    if (spec.boundingBox) {
        const bb = spec.boundingBox
        bounds = L.latLngBounds(L.latLng(bb[3], bb[2]), L.latLng(bb[1], bb[0]))
    }

    const layer = L.tileLayer.colorFilter(spec.url, {
        minZoom: spec.minZoom,
        maxZoom: spec.maxZoom,
        maxNativeZoom: spec.maxNativeZoom,
        tms: spec.tms,
        bounds: bounds,
        ...(spec.engineOptions || {}),
    })

    mctx.layerRegistry.layer[name] = layer

    if (spec.noFade) layer._noFade = true

    if (!mctx.default) layer.addTo(mctx.map)

    L_.setLayerOpacity(
        name,
        spec.opacity != null
            ? spec.opacity
            : mctx.layerRegistry.opacity[name] || 1
    )

    L_._layersLoaded[L_._layersOrdered.indexOf(name)] = true

    layer.off('loading')
    layer.on('loading', () => {
        L_.setGlobalLoading(name)
        if (spec.onLoading) spec.onLoading()
    })
    layer.off('load')
    layer.on('load', () => {
        if (spec.onLoad) spec.onLoad()
        L_.setGlobalLoaded(name)
    })

    L_.Map_.allLayersLoaded()

    return layer
}

// Neutral primitive: add a vector (GeoJSON) source.
//
// The plugin owns all engine-neutral work (capture, time/injectable-param and
// dynamic-extent handling, GeoJSON validation, refresh bookkeeping) and hands
// this primitive already-valid GeoJSON. The middleware owns the engine-specific
// construction: turning GeoJSON into an engine layer (+ its attachment
// sublayers), the seamless refresh swap, registry wiring, and map insertion.
//
// spec = {
//   geojson,     // valid GeoJSON FeatureCollection to render
//   isRefresh,   // boolean — seamless swap of an already-on layer
// }
//
// Returns the constructed vector layer wrapper { layer, sublayers }.
function addVector(layerObj, spec, mctx) {
    const name = layerObj.name
    const registry = mctx.layerRegistry

    layerObj.style = layerObj.style || {}
    layerObj.style.layerName = name
    layerObj.style.opacity = registry.opacity[name] || 1

    const vl = constructVectorLayer(
        spec.geojson,
        layerObj,
        L_.Map_.onEachFeatureDefault,
        L_.Map_
    )

    // For refresh operations, toggle off the old layer first so the swap is
    // seamless, then toggle the new one back on after it is wired in.
    let wasOnForRefresh = false
    if (
        spec.isRefresh &&
        registry.on[name] &&
        registry.layer[name] &&
        mctx.map.hasLayer(registry.layer[name])
    ) {
        wasOnForRefresh = true
        L_.toggleLayer(registry.data[name], true, true)
    }

    // Clear local time filter cache on refresh so new data is used.
    if (spec.isRefresh && L_._localTimeFilterCache) {
        delete L_._localTimeFilterCache[name]
    }

    registry.attachments[name] = vl.sublayers
    registry.layer[name] = vl.layer

    if (vl.layer && mctx.default != true) {
        vl.layer.addTo(mctx.map)
    }

    // Clear refresh-failed status on successful load/refresh.
    if (registry.refreshFailed && registry.refreshFailed[name]) {
        registry.refreshFailed[name] = false
        document.dispatchEvent(
            new CustomEvent('layerRefreshStatusChanged', {
                detail: { layerName: name, failed: false },
            })
        )
    }

    if (spec.isRefresh && wasOnForRefresh) {
        L_.toggleLayer(registry.data[name], false, true)
    }

    L_._layersLoaded[L_._layersOrdered.indexOf(name)] = true
    L_.Map_.allLayersLoaded()

    return vl
}

// Neutral primitive: subscribe to map view (pan/zoom) changes. Used by
// dynamic-extent layers to re-query on `moveend`. Returns nothing; the
// capturer owns the callback lifecycle.
function onViewChange(mctx, f) {
    mctx.map.on('moveend', f)
}

// Neutral primitive: remove a layer previously added through this middleware.
// Dispatches the type's map `destroy` op (mirroring GlobeRenderer.removeLayer);
// built-ins declare none, so the core default (remove from map) runs.
function removeLayer(layerObj, mctx) {
    const ctx = mctx || context()
    LayerInterface.runMap(
        LayerTypeRegistry.get(layerObj.type)?.map,
        'destroy',
        [layerObj, ctx],
        {
            coreDefault: () =>
                L_.Map_.rmNotNull(ctx.layerRegistry.layer[layerObj.name]),
        }
    )
}

export default {
    context,
    addTile,
    addVector,
    onViewChange,
    removeLayer,
}
