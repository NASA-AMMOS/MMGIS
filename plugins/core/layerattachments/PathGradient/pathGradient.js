/**
 * Path-gradient attachment — the host line layer recolored along its length by
 * one of its properties, with a hover readout mirrored onto the globe.
 *
 * On the globe this primitive IS the host's geometry drawn differently, so the
 * host layer is not added there as well (capabilities.globe.suppressesHost).
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import { getCoordProperties } from '@basics/Layers_/render/ExtendedGeoJSON'
import {
    escapeHtml,
    closestPointOnSegment,
} from '@basics/Layers_/render/gradientUtils'

const L = window.L

const pathGradient = (geojson, layerObj, leafletLayerObject, config) => {
    function getLayer(geojson, layerObj, overrideColorWithProp) {
        // PATH GRADIENT
        const pathGradientVar = config
        if (
            pathGradientVar &&
            (pathGradientVar.enabled === true ||
                pathGradientVar.enabled == null)
        ) {
            const pathGradientSettings = {
                initialVisibility: F_.getIn(
                    pathGradientVar,
                    'initialVisibility',
                    true
                ),
                colorWithProp:
                    overrideColorWithProp ||
                    F_.getIn(pathGradientVar, 'colorWithProp', null),
                dropdownColorWithProp: F_.getIn(
                    pathGradientVar,
                    'dropdownColorWithProp',
                    []
                ),
                colorRamp: F_.getIn(pathGradientVar, 'colorRamp', [
                    'lime',
                    'yellow',
                    'red',
                ]),
                weight: F_.getIn(pathGradientVar, 'weight', 4),
                connectAllPoints: F_.getIn(
                    pathGradientVar,
                    'connectAllPoints',
                    false
                ),
            }

            // check validity
            if (pathGradientSettings.colorWithProp == null) {
                console.warn(
                    'LayerConstructor - `pathAttachments.gradient` set but required `pathAttachments.gradient.colorWithProp` is unset.'
                )
                return false
            }

            // Add colorWithProps to dropdown if not already
            if (
                !pathGradientSettings.dropdownColorWithProp.includes(
                    pathGradientSettings.colorWithProp
                )
            )
                pathGradientSettings.dropdownColorWithProp.unshift(
                    pathGradientSettings.colorWithProp
                )

            // format colorRamp
            const steppedColorRamp = {}
            pathGradientSettings.colorRamp.forEach((color, idx) => {
                steppedColorRamp[
                    idx / (pathGradientSettings.colorRamp.length - 1)
                ] = color
            })

            const paths = []
            var min = Infinity
            var max = -Infinity
            var prevParentIndex = null
            geojson.features.forEach((feature) => {
                let path = []
                if (pathGradientSettings.connectAllPoints) {
                    if (feature.geometry.type.toLowerCase() === 'point') {
                        let value = F_.getIn(
                            feature.properties,
                            pathGradientSettings.colorWithProp,
                            0
                        )
                        if (min > value) min = value
                        if (max < value) max = value
                        path = [
                            feature.geometry.coordinates[1],
                            feature.geometry.coordinates[0],
                            value,
                        ]
                    }
                } else {
                    F_.coordinateDepthTraversal(
                        feature.geometry.coordinates,
                        (array, _path) => {
                            // Find breaks in the coordinate array to find sepearate features
                            const splitPath = _path.split('.')
                            let parentIndex = null
                            if (splitPath.length >= 2) {
                                parentIndex = splitPath[splitPath.length - 2]
                                if (
                                    prevParentIndex != null &&
                                    parentIndex != prevParentIndex
                                ) {
                                    paths.push(path)
                                    path = []
                                }
                            }
                            const value = F_.getIn(
                                getCoordProperties(geojson, feature, array),
                                pathGradientSettings.colorWithProp,
                                0
                            )
                            if (min > value) min = value
                            if (max < value) max = value

                            path.push([array[1], array[0], value])

                            // Save this for next run through
                            prevParentIndex = parentIndex
                        }
                    )
                }
                paths.push(path)
            })

            if (min === 0 && max === 0) max = 1

            const hotlines = []

            if (pathGradientSettings.connectAllPoints) {
                hotlines.push(
                    L.hotline(paths, {
                        min: min,
                        max: max,
                        palette: steppedColorRamp,
                        weight: pathGradientSettings.weight,
                    })
                )
            } else {
                paths.forEach((path) => {
                    if (path.length > 0)
                        hotlines.push(
                            L.hotline(path, {
                                min: min,
                                max: max,
                                palette: steppedColorRamp,
                                weight: pathGradientSettings.weight,
                            })
                        )
                })
            }

            // ── Build spatial grid for 2D hover tooltip ──
            // Uses O(N) construction with a coordinate→properties Map
            // instead of the previous O(N²) per-vertex feature search that
            // froze the browser with large (24K+) datasets.  A single
            // mousemove handler replaces N individual circleMarkers.
            const coordProps =
                pathGradientSettings.dropdownColorWithProp.length > 0
                    ? pathGradientSettings.dropdownColorWithProp
                    : [pathGradientSettings.colorWithProp]

            // Pre-build coordinate→properties Map for O(1) lookup
            const featurePropsByCoord = new Map()
            geojson.features.forEach((feature) => {
                if (
                    pathGradientSettings.connectAllPoints &&
                    feature.geometry.type.toLowerCase() === 'point'
                ) {
                    const c = feature.geometry.coordinates
                    featurePropsByCoord.set(
                        `${c[1]},${c[0]}`,
                        feature.properties
                    )
                } else if (!pathGradientSettings.connectAllPoints) {
                    F_.coordinateDepthTraversal(
                        feature.geometry.coordinates,
                        (array) => {
                            featurePropsByCoord.set(
                                `${array[1]},${array[0]}`,
                                getCoordProperties(geojson, feature, array)
                            )
                        }
                    )
                }
            })

            // Build spatial grid + hover segments array (O(N))
            // Each entry is a line segment between two consecutive path vertices.
            // Segments are registered in every grid cell their bounding box covers,
            // so the mousemove handler can do point-to-segment projection rather
            // than just nearest-vertex lookup — this makes the tooltip appear
            // anywhere along the line, not only at recorded vertices.
            const hoverGridRes = 0.001 // ~100m cells
            const hoverGrid = {}
            const hoverSegments = [] // { lng1, lat1, lng2, lat2, props, val1, val2 }

            function _addHoverSegment(seg) {
                const segIdx = hoverSegments.length
                hoverSegments.push(seg)
                // Register the segment at evenly-spaced sample points along its length,
                // one sample every 2 grid cells.  The mousemove handler checks a 3×3
                // neighbourhood, so any mouse position within 1 cell of a sample will
                // find this segment — giving full coverage for segments up to ~2× the
                // cap length.  This avoids the O(N × span²) cost of bounding-box
                // registration while still covering hover anywhere on the line.
                const gx1 = Math.floor(seg.lng1 / hoverGridRes)
                const gy1 = Math.floor(seg.lat1 / hoverGridRes)
                const gx2 = Math.floor(seg.lng2 / hoverGridRes)
                const gy2 = Math.floor(seg.lat2 / hoverGridRes)
                const span = Math.max(Math.abs(gx2 - gx1), Math.abs(gy2 - gy1))
                // steps = number of intervals; sample every 2 cells, cap at 12
                const steps = Math.min(12, Math.max(1, Math.ceil(span / 2)))
                const seenCells = new Set()
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps
                    const gx = Math.floor(
                        (seg.lng1 + t * (seg.lng2 - seg.lng1)) / hoverGridRes
                    )
                    const gy = Math.floor(
                        (seg.lat1 + t * (seg.lat2 - seg.lat1)) / hoverGridRes
                    )
                    const key = `${gx},${gy}`
                    if (seenCells.has(key)) continue
                    seenCells.add(key)
                    if (!hoverGrid[key]) hoverGrid[key] = []
                    hoverGrid[key].push(segIdx)
                }
            }

            if (pathGradientSettings.connectAllPoints) {
                // connectAllPoints: paths is a flat array of [lat, lng, value] vertices
                // connected in sequence — build segments between consecutive entries.
                for (let i = 0; i < paths.length - 1; i++) {
                    const p1 = paths[i],
                        p2 = paths[i + 1]
                    if (!Array.isArray(p1) || p1.length < 3) continue
                    if (!Array.isArray(p2) || p2.length < 3) continue
                    const [lat1, lng1, val1] = p1
                    const [lat2, lng2, val2] = p2
                    _addHoverSegment({
                        lng1,
                        lat1,
                        lng2,
                        lat2,
                        props: featurePropsByCoord.get(`${lat1},${lng1}`),
                        props2: featurePropsByCoord.get(`${lat2},${lng2}`),
                        val1,
                        val2,
                    })
                }
            } else {
                // Each path is an independent array of [lat, lng, value] vertices.
                paths.forEach((path) => {
                    if (!Array.isArray(path)) return
                    for (let i = 0; i < path.length - 1; i++) {
                        const p1 = path[i],
                            p2 = path[i + 1]
                        if (!Array.isArray(p1) || p1.length < 3) continue
                        if (!Array.isArray(p2) || p2.length < 3) continue
                        const [lat1, lng1, val1] = p1
                        const [lat2, lng2, val2] = p2
                        _addHoverSegment({
                            lng1,
                            lat1,
                            lng2,
                            lat2,
                            props: featurePropsByCoord.get(`${lat1},${lng1}`),
                            props2: featurePropsByCoord.get(`${lat2},${lng2}`),
                            val1,
                            val2,
                        })
                    }
                })
            }

            const layer = L.layerGroup(hotlines)

            // Attach spatial-grid hover via onAdd/onRemove instead of
            // creating N individual circleMarkers (avoids DOM bloat and
            // rendering freeze with large datasets).
            const _origOnAdd = L.LayerGroup.prototype.onAdd
            const _origOnRemove = L.LayerGroup.prototype.onRemove

            layer.onAdd = function (map) {
                _origOnAdd.call(this, map)

                // Inject dark-theme tooltip styles once
                if (!document.getElementById('mmgisGradientTooltipStyles')) {
                    const s = document.createElement('style')
                    s.id = 'mmgisGradientTooltipStyles'
                    s.textContent = `
                        .mmgisGTip.leaflet-tooltip {
                            background: var(--color-a);
                            border: 1px solid var(--color-a1);
                            border-radius: 4px;
                            padding: 6px 10px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
                            color: var(--color-a6);
                        }
                        .mmgisGTip.leaflet-tooltip-top::before {
                            border-top-color: var(--color-a1);
                        }
                        .mmgisGTip table {
                            border-collapse: collapse;
                            font-size: 12px;
                            font-family: monospace;
                        }
                        .mmgisGTip td { padding: 1px 0; white-space: nowrap; }
                        .mmgisGTip td.gk {
                            color: var(--color-c);
                            text-align: left;
                            padding-right: 16px;
                            font-weight: bold;
                        }
                        .mmgisGTip td.gv {
                            color: var(--color-a6);
                            text-align: right;
                        }
                    `
                    document.head.appendChild(s)
                }

                const tooltip = L.tooltip({
                    direction: 'top',
                    offset: [0, -8],
                    className: 'mmgisGTip',
                })
                this._gradientTooltip = tooltip

                // Highlight dot — shows the closest point on the segment
                const highlightDot = L.circleMarker([0, 0], {
                    radius: 6,
                    color: '#000',
                    weight: 2,
                    fillColor: '#fff',
                    fillOpacity: 1,
                    interactive: false,
                    pane: 'markerPane',
                })
                this._gradientHighlightDot = highlightDot

                this._gradientHandleMove = (e) => {
                    const { lat, lng } = e.latlng
                    const gx = Math.floor(lng / hoverGridRes)
                    const gy = Math.floor(lat / hoverGridRes)

                    // Zoom-adaptive pick radius: ~15 screen pixels in degrees
                    const bounds = map.getBounds()
                    const mapH = map.getSize().y || 1
                    const pickRadius =
                        ((bounds.getNorth() - bounds.getSouth()) / mapH) * 15

                    let bestDist = Infinity
                    let bestSeg = null
                    let bestT = 0
                    const seen = new Set()

                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            const cell = hoverGrid[`${gx + dx},${gy + dy}`]
                            if (!cell) continue
                            for (let i = 0; i < cell.length; i++) {
                                const segIdx = cell[i]
                                if (seen.has(segIdx)) continue
                                seen.add(segIdx)
                                const seg = hoverSegments[segIdx]
                                const { t, dist } = closestPointOnSegment(
                                    lng,
                                    lat,
                                    seg.lng1,
                                    seg.lat1,
                                    seg.lng2,
                                    seg.lat2
                                )
                                if (dist < bestDist) {
                                    bestDist = dist
                                    bestSeg = seg
                                    bestT = t
                                }
                            }
                        }
                    }

                    if (bestSeg && bestDist < pickRadius) {
                        // Use bestT to decide which vertex's properties
                        // to show: near the start (t < 0.5) use start-
                        // vertex props, near the end (t >= 0.5) use
                        // end-vertex props.  This ensures hovering near
                        // the last vertex of a path shows correct values.
                        const props =
                            bestT >= 0.5
                                ? bestSeg.props2 || bestSeg.props
                                : bestSeg.props
                        const fallbackVal =
                            bestT >= 0.5 ? bestSeg.val2 : bestSeg.val1
                        let html = '<table>'
                        coordProps.forEach((prop) => {
                            const val = props
                                ? F_.getIn(props, prop, '—')
                                : fallbackVal
                            const label = escapeHtml(
                                prop
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (c) => c.toUpperCase())
                            )
                            html += `<tr><td class="gk">${label}</td><td class="gv">${escapeHtml(val)}</td></tr>`
                        })
                        html += '</table>'
                        tooltip.setLatLng(e.latlng).setContent(html)
                        if (!tooltip._map) tooltip.addTo(map)

                        // Move 2D highlight dot to closest point on the segment
                        const closestLat =
                            bestSeg.lat1 + bestT * (bestSeg.lat2 - bestSeg.lat1)
                        const closestLng =
                            bestSeg.lng1 + bestT * (bestSeg.lng2 - bestSeg.lng1)
                        highlightDot.setLatLng([closestLat, closestLng])
                        if (!highlightDot._map) highlightDot.addTo(map)
                        // Mirror the hover dot in 3D
                        L_.Globe_?.litho?.setGradientHoverPoint(
                            closestLng,
                            closestLat
                        )
                    } else {
                        if (tooltip._map) map.removeLayer(tooltip)
                        if (highlightDot._map) map.removeLayer(highlightDot)
                        L_.Globe_?.litho?.clearGradientHoverPoint()
                    }
                }

                this._gradientHandleOut = () => {
                    if (tooltip._map) map.removeLayer(tooltip)
                    if (highlightDot._map) map.removeLayer(highlightDot)
                    L_.Globe_?.litho?.clearGradientHoverPoint()
                }

                map.on('mousemove', this._gradientHandleMove)
                map.on('mouseout', this._gradientHandleOut)
            }

            layer.onRemove = function (map) {
                if (this._gradientHandleMove)
                    map.off('mousemove', this._gradientHandleMove)
                if (this._gradientHandleOut)
                    map.off('mouseout', this._gradientHandleOut)
                if (this._gradientTooltip && this._gradientTooltip._map) {
                    map.removeLayer(this._gradientTooltip)
                }
                if (
                    this._gradientHighlightDot &&
                    this._gradientHighlightDot._map
                ) {
                    map.removeLayer(this._gradientHighlightDot)
                }
                _origOnRemove.call(this, map)
            }
            layer.addDataEnhanced = function (
                geojson,
                layerName,
                subName,
                Map_,
                overrideColorWithProp
            ) {
                Map_.rmNotNull(L_.layers.attachments[layerName][subName].layer)
                L_.layers.attachments[layerName][subName].layer = getLayer(
                    geojson,
                    L_.layers.attachments[layerName][subName].layer.layerObj,
                    overrideColorWithProp
                )
                Map_.map.addLayer(
                    L_.layers.attachments[layerName][subName].layer
                )
            }
            layer.dropdown = pathGradientSettings.dropdownColorWithProp
            layer.dropdownValue = pathGradientSettings.colorWithProp
            layer.dropdownFunc = function (layerName, subName, Map_, prop) {
                const l = L_.layers.attachments[layerName][subName]
                l.layer.addDataEnhanced(
                    l.geojson,
                    layerName,
                    subName,
                    Map_,
                    prop
                )
                // Rebuild 3D gradient with new property.
                // removeLayer is cheap (scene.primitives.remove); defer the
                // heavy addLayer geometry build to avoid blocking the UI thread.
                if (l.cesiumLayerId && L_.Globe_ && L_.Globe_.litho) {
                    removeGlobeGradient(l)
                    l.cesiumGradientOptions = {
                        ...l.cesiumGradientOptions,
                        gradientSettings: {
                            ...l.cesiumGradientOptions.gradientSettings,
                            colorWithProp: prop,
                        },
                    }
                    clearTimeout(l._cesiumRebuildTimer)
                    l._cesiumRebuildTimer = setTimeout(() => {
                        addGlobeGradient(l)
                    }, 0)
                }
            }
            layer.layerObj = layerObj

            return layer
        } else return false
    }

    const layer = getLayer(geojson, layerObj)
    if (layer) {
        const pathGradientVar = config

        const pathGradientSettings = {
            colorWithProp: F_.getIn(pathGradientVar, 'colorWithProp', null),
            dropdownColorWithProp: F_.getIn(
                pathGradientVar,
                'dropdownColorWithProp',
                []
            ),
            colorRamp: F_.getIn(pathGradientVar, 'colorRamp', [
                'lime',
                'yellow',
                'red',
            ]),
            weight: F_.getIn(pathGradientVar, 'weight', 4),
            connectAllPoints: F_.getIn(
                pathGradientVar,
                'connectAllPoints',
                false
            ),
        }
        // Normalize: ensure colorWithProp is in the dropdown list (matches 2D behavior)
        if (
            pathGradientSettings.colorWithProp &&
            !pathGradientSettings.dropdownColorWithProp.includes(
                pathGradientSettings.colorWithProp
            )
        )
            pathGradientSettings.dropdownColorWithProp.unshift(
                pathGradientSettings.colorWithProp
            )

        return {
            on:
                pathGradientVar.initialVisibility != null
                    ? pathGradientVar.initialVisibility
                    : true,
            type: 'path_gradient',
            geojson: geojson,
            layer: layer,
            cesiumGradientOptions: {
                name: layerObj.name,
                geojson: geojson,
                gradientSettings: pathGradientSettings,
                layerObj: layerObj,
            },
            title: 'A colorful visualization of values along a path.\nPoint values from the specified feature property are min-max fit to a color ramp.',
        }
    } else return false
}

/**
 * Add this attachment's globe primitive, tracking the in-flight build so a
 * teardown that races ahead of it can't orphan it. Adding resolves
 * asynchronously, so an attachment turned off (or re-added) before the build
 * finishes would otherwise leave a stale primitive with no way to remove it.
 */
function addGlobeGradient(attachment) {
    if (!attachment || !attachment.cesiumGradientOptions) return
    if (!L_.Globe_ || !L_.Globe_.litho) return
    attachment._gradientWantsOn = true
    const gen = (attachment._gradientGen = (attachment._gradientGen || 0) + 1)
    L_.Globe_.litho
        .addLayer('gradient_polyline', attachment.cesiumGradientOptions)
        .then((id) => {
            // Turned off (or superseded by a newer add) while building —
            // discard this primitive instead of leaving it orphaned.
            if (
                attachment._gradientGen !== gen ||
                !attachment._gradientWantsOn
            ) {
                L_.Globe_.litho.removeLayer(id)
                return
            }
            attachment.cesiumLayerId = id
        })
        .catch((e) => {
            console.warn('Failed to add 3D gradient polyline:', e)
        })
}

/** Remove the globe primitive and cancel any in-flight add. */
function removeGlobeGradient(attachment) {
    if (!attachment) return
    attachment._gradientWantsOn = false
    attachment._gradientGen = (attachment._gradientGen || 0) + 1
    if (attachment.cesiumLayerId && L_.Globe_ && L_.Globe_.litho) {
        L_.Globe_.litho.removeLayer(attachment.cesiumLayerId)
        attachment.cesiumLayerId = null
    }
}

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) {
        // ctx.globeOnly: the host's first toggle deferred only the heavy globe
        // geometry — the map overlay is already there.
        if (ctx.globeOnly !== true) {
            L_.Map_.map.addLayer(attachment.layer)
            ctx.applyOrder()
        }
        addGlobeGradient(attachment)
    } else {
        L_.Map_.rmNotNull(attachment.layer)
        removeGlobeGradient(attachment)
    }
}

export default {
    make: (ctx) =>
        pathGradient(
            ctx.geojson,
            ctx.layerObj,
            ctx.leafletLayerObject,
            ctx.config
        ),
    setVisibility,
}
