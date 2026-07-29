/**
 * MapRenderer - Abstraction wrapper for 2D map rendering engines.
 *
 * The 2D-map analog of GlobeRenderer. Today it wraps a single engine (Leaflet),
 * but it exists so that layer-type PLUGINS never touch Leaflet directly: a plugin
 * describes what it wants with neutral primitives (addImagery/addVector/…) and the
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

// Neutral primitive: add a templated raster (imagery) source.
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
function addImagery(layerObj, spec, mctx) {
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
        spec.opacity != null ? spec.opacity : mctx.layerRegistry.opacity[name] || 1
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

// Neutral primitive: remove a layer previously added through this middleware.
function removeLayer(layerObj, mctx) {
    L_.Map_.rmNotNull(mctx.layerRegistry.layer[layerObj.name])
}

export default {
    context,
    addImagery,
    removeLayer,
}
