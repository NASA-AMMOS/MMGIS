/**
 * Vector layer type — Cesium globe renderer.
 *
 * Owns all Cesium-specific vector CONTENT: GeoJSON → GeoJsonDataSource load,
 * feature-id injection, style parsing, billboard→point conversion, per-feature
 * style overrides, and registration in the shared `_layers` registry.
 *
 * GlobeRenderer stays the middleware and owns the collection-level reload
 * serialization state (concurrent-load tokens, pending reload/removal, the
 * displayed-data-source cache) — the direct analog of keeping tile's imagery
 * ordering in core. That state is handed to this module through gctx so the
 * no-flicker in-place reload behavior is preserved exactly.
 *
 * Handles both the 'vector' type and its terrain-draped 'clamped' variant
 * (gctx.clampToGround); GlobeRenderer maps 'clamped' → this module.
 *
 * gctx (cesium) = {
 *   engine, renderer, layers, requestRender,
 *   clampToGround,               // this add() call is the 'clamped' variant
 *   loadingLayers, vectorLoadToken, pendingVectorReload,
 *   pendingVectorRemoval, displayedVectorDataSource,   // shared reload state
 *   runPendingVectorReload,      // () => GlobeRenderer._runPendingVectorReload
 * }
 */
import * as Cesium from 'cesium'
import { isClamped, toGlobeConfig } from './layerConfig'

const CESIUM_POINT_PIXEL_SCALE = 2

// Cesium drops fully transparent geometry from the pick pass, so a polygon
// with no fill would be unclickable on the globe though 2D still selects it.
const MIN_PICKABLE_ALPHA = 0.004

/** A fill colour that keeps its polygon pickable however invisible it is. */
function pickableAlpha(color, opacity) {
    const alpha = isNaN(opacity) ? 0.5 : opacity
    return color.withAlpha(Math.max(alpha, MIN_PICKABLE_ALPHA))
}

/** A CSS colour at an opacity, or null when the colour is unusable. */
function colorAt(css, opacity) {
    if (css == null) return null
    const color = Cesium.Color.fromCssColorString(css)
    if (color == null) return null
    const alpha = parseFloat(opacity)
    return isNaN(alpha) ? color : color.withAlpha(alpha)
}

function make(layerObj, gctx) {
    const layerConfig = toGlobeConfig(layerObj)
    if (layerConfig == null) return
    return render(layerConfig, {
        ...gctx,
        clampToGround: isClamped(layerObj),
    })
}

/**
 * Draw a draped polygon's edge as a clamped polyline.
 *
 * Cesium refuses outlines on geometry that follows terrain, so a polygon whose
 * fill is transparent — the usual way to configure an outline-only polygon —
 * would show nothing on the globe while 2D draws its stroke.
 */
function outlineOnTerrain(entity, loadOptions) {
    const hierarchy = entity.polygon.hierarchy?.getValue(
        Cesium.JulianDate.now()
    )
    const positions = hierarchy?.positions
    if (positions == null || positions.length < 2) return
    entity.polyline = new Cesium.PolylineGraphics({
        positions: positions.concat([positions[0]]),
        width: loadOptions.strokeWidth,
        material: loadOptions.stroke,
        clampToGround: true,
    })
}

// How long a replaced data source stays on the globe while its replacement
// builds. Draped geometry is batched asynchronously, so it isn't drawn the
// frame it is added.
const RETIRE_MS = 500

/** Take the data sources a load replaced off the globe, once it is drawn. */
function retire(gctx, outgoing, ds) {
    const stale = outgoing.filter((s) => s != null && s !== ds)
    if (stale.length === 0) return
    setTimeout(() => {
        stale.forEach((s) => gctx.renderer.dataSources.remove(s))
        gctx.requestRender()
    }, RETIRE_MS)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    const { name } = layerConfig
    const type = gctx.clampToGround ? 'clamped' : 'vector'

    // Serialize reloads per layer: Cesium resolves loads in completion order,
    // not call order, so a second load started mid-flight could finish first and
    // leave the older one on screen. Queue this as the latest pending reload.
    if (gctx.loadingLayers[name]) {
        gctx.pendingVectorReload[name] = { type, layerConfig }
        return
    }

    // A reload draws into a new data source and retires the old one once the
    // new is up, so the layer is never off the globe. If removeLayer deferred a
    // removal, cancel it and let this load retire that source instead.
    const pendingRemoval = gctx.pendingVectorRemoval[name]
    if (pendingRemoval) {
        if (pendingRemoval.frameHandle != null) {
            cancelAnimationFrame(pendingRemoval.frameHandle)
        }
        delete gctx.pendingVectorRemoval[name]
    }

    // Latest load wins: a slower, stale in-flight load must not replace newer
    // data nor remove the data source a newer load is showing.
    const loadToken = (gctx.vectorLoadToken[name] || 0) + 1
    gctx.vectorLoadToken[name] = loadToken

    gctx.loadingLayers[name] = true

    const defaultStyle = layerConfig.style?.default || layerConfig.style || {}
    const letPropertiesOverride =
        layerConfig.style?.letPropertiesStyleOverride || false

    // Clone GeoJSON and inject internal IDs (layerName_load_index) for fast
    // lookups. The load is part of the id so the ids of one load never stand in
    // for another's.
    const geojsonWithIds = JSON.parse(JSON.stringify(layerConfig.geojson))
    const featureMap = {}
    if (geojsonWithIds.features && Array.isArray(geojsonWithIds.features)) {
        geojsonWithIds.features.forEach((feature, index) => {
            const internalId = `${name}_${loadToken}_${index}`
            featureMap[internalId] = layerConfig.geojson.features[index]
            feature.id = internalId
        })
    }

    const strokeColor =
        Cesium.Color.fromCssColorString(defaultStyle.color || '#ffffff') ||
        Cesium.Color.WHITE
    const fillColor =
        Cesium.Color.fromCssColorString(defaultStyle.fillColor || '#ffffff') ||
        Cesium.Color.WHITE
    const fillOpacity = parseFloat(defaultStyle.fillOpacity)
    const fillWithAlpha = pickableAlpha(fillColor, fillOpacity)

    const loadOptions = {
        clampToGround: type === 'clamped',
        stroke: strokeColor,
        strokeWidth: defaultStyle.weight || 2,
        fill: fillWithAlpha,
        markerSize: defaultStyle.radius || 8,
        markerColor: fillColor,
    }

    // What this load replaces: kept on the globe until the new features are
    // drawn. Loading into the source already on screen would blank it while
    // Cesium rebuilt its batched primitives — the flash.
    const outgoing = [
        gctx.displayedVectorDataSource[name],
        pendingRemoval?.dataSource,
    ]

    const loadPromise = Cesium.GeoJsonDataSource.load(
        geojsonWithIds,
        loadOptions
    )

    loadPromise
        .then((ds) => {
            delete gctx.loadingLayers[name]

            // A newer reload superseded this load — discard the stale result.
            if (gctx.vectorLoadToken[name] !== loadToken) {
                gctx.runPendingVectorReload(name)
                return
            }

            if (!gctx.renderer.dataSources.contains(ds)) {
                gctx.renderer.dataSources.add(ds)
            }

            ds.entities.values.forEach((entity) => {
                if (entity.polygon) {
                    const draped = type === 'clamped'
                    entity.polygon.outline = !draped
                    if (draped) outlineOnTerrain(entity, loadOptions)
                }
                // Render points as circular dots instead of Cesium's default
                // teardrop pin billboards.
                if (entity.billboard) {
                    entity.billboard = undefined
                    entity.point = new Cesium.PointGraphics({
                        pixelSize:
                            (defaultStyle.radius || 8) *
                            CESIUM_POINT_PIXEL_SCALE,
                        color: fillWithAlpha,
                        outlineColor: strokeColor,
                        outlineWidth: defaultStyle.weight || 2,
                        heightReference:
                            type === 'clamped'
                                ? Cesium.HeightReference.CLAMP_TO_GROUND
                                : Cesium.HeightReference.NONE,
                    })
                }
            })

            // Apply per-feature styles if enabled (matches LithoSphere behavior).
            if (letPropertiesOverride) {
                ds.entities.values.forEach((entity) => {
                    const props = entity.properties
                    if (!props) return

                    let featureStyle = null
                    try {
                        featureStyle = props.style?.getValue(
                            Cesium.JulianDate.now()
                        )
                    } catch (e) {
                        featureStyle = props.style?._value || props.style
                    }

                    if (featureStyle) {
                        // Merged with the layer's own style so a rule on one key
                        // alone — an opacity, a fill opacity — still repaints,
                        // and every key it doesn't set keeps the configured one.
                        const st = { ...defaultStyle, ...featureStyle }

                        if (entity.polygon) {
                            entity.polygon.material = pickableAlpha(
                                colorAt(st.fillColor) || fillColor,
                                parseFloat(st.fillOpacity)
                            )
                            const outline = colorAt(st.color, st.opacity)
                            if (outline) entity.polygon.outlineColor = outline
                            if (st.weight != null)
                                entity.polygon.outlineWidth = parseFloat(
                                    st.weight
                                )
                        }

                        if (entity.polyline) {
                            const line = colorAt(st.color, st.opacity)
                            if (line) entity.polyline.material = line
                            if (st.weight != null)
                                entity.polyline.width = parseFloat(st.weight)
                        }

                        if (entity.point) {
                            if (st.radius != null)
                                entity.point.pixelSize =
                                    parseFloat(st.radius) *
                                    CESIUM_POINT_PIXEL_SCALE
                            entity.point.color = pickableAlpha(
                                colorAt(st.fillColor) || fillColor,
                                parseFloat(st.fillOpacity)
                            )
                            const ring = colorAt(st.color, st.opacity)
                            if (ring) entity.point.outlineColor = ring
                            if (st.weight != null)
                                entity.point.outlineWidth = parseFloat(st.weight)
                        }
                    }
                })
            }

            // A reused source keeps the `show` it was left with, so a layer
            // hidden (zoom cutoff, opacity) before this reload would come back
            // invisible while the registry called it visible.
            const visible = gctx.layers[name]?.visible ?? layerConfig.on !== false
            ds.show = visible

            gctx.displayedVectorDataSource[name] = ds
            gctx.layers[name] = {
                type: 'vector',
                kind: 'entities',
                dataSource: ds,
                visible: visible,
                onClick: layerConfig.onClick,
                featureMap: featureMap,
            }

            gctx.requestRender()

            retire(gctx, outgoing, ds)
            gctx.runPendingVectorReload(name)
        })
        .catch((err) => {
            // On load failure keep the previous features rather than leaving the
            // layer empty. Chained (not a sibling handler) so a rejected load
            // can't produce an unhandled promise rejection.
            delete gctx.loadingLayers[name]
            console.error(`Failed to load vector layer "${name}":`, err)
            gctx.runPendingVectorReload(name)
        })
}

export default {
    make,
    render,
}
