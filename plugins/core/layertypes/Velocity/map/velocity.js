/**
 * Velocity layer type — map renderer.
 *
 * Renders an animated vector field (wind/current) on the 2D map: either
 * `streamlines` (leaflet-velocity) or `particles` (leaflet "rain"). The
 * engine-neutral data capture (time tokens, injectable params, dynamic-extent
 * re-querying) is done via LayerCapturer; view-change subscriptions go through
 * the MapRenderer middleware. The `L.velocityLayer`/`L.rain` constructors are
 * Leaflet-plugin-specific, so they are built via the MapRenderer escape hatch
 * (`mctx.raw` = the Leaflet namespace) rather than a neutral primitive.
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import Description from '@basics/UserInterface_/components/Description/Description'
import { captureVector } from '@basics/Layers_/capture/LayerCapturer'
import { data as colormapData } from '@external/js-colormaps/js-colormaps.js'

function make(layerObj, ctx = {}) {
    const { evenIfOff, forceGeoJSON, mapContext } = ctx
    const mctx = MapRenderer.context(mapContext)
    const L = mctx.raw

    return new Promise((resolve) => {
        if (forceGeoJSON) add(forceGeoJSON)
        else
            captureVector(
                layerObj,
                { evenIfOff: evenIfOff, useEmptyGeoJSON: null },
                add,
                (f) => {
                    MapRenderer.onViewChange(mctx, f)
                    if (
                        layerObj.time?.enabled === true &&
                        layerObj.controlled !== true
                    )
                        L_.subscribeTimeChange(
                            `dynamicgeodataset_${layerObj.name}`,
                            f
                        )
                    L_.subscribeOnSpecificLayerToggle(
                        `dynamicgeodataset_${layerObj.name}`,
                        layerObj.name,
                        f
                    )
                }
            )

        function add(data) {
            if (layerObj.type == 'velocity') {
                if (
                    layerObj.kind == 'streamlines' ||
                    'kind' in layerObj == false
                ) {
                    const defaultColors = [
                        'rgb(36,104, 180)',
                        'rgb(60,157, 194)',
                        'rgb(128,205,193 )',
                        'rgb(151,218,168 )',
                        'rgb(198,231,181)',
                        'rgb(238,247,217)',
                        'rgb(255,238,159)',
                        'rgb(252,217,125)',
                        'rgb(255,182,100)',
                        'rgb(252,150,75)',
                        'rgb(250,112,52)',
                        'rgb(245,64,32)',
                        'rgb(237,45,28)',
                        'rgb(220,24,32)',
                        'rgb(180,0,35)',
                    ]
                    let colorScale = ''
                    if (layerObj.variables?.streamlines?.colorScale) {
                        let colorConfig =
                            layerObj.variables?.streamlines?.colorScale
                        if (colorConfig.includes(',')) {
                            colorScale = colorConfig
                                .split('", "')
                                .map((item) => item.replace(/["]/g, ''))
                        } else if (colorConfig === 'DEFAULT') {
                            colorScale = defaultColors
                        } else {
                            // Assume we have a colormap name and look up the values
                            let reverse = false
                            if (colorConfig.endsWith('_r')) {
                                reverse = true
                                colorConfig = colorConfig.slice(0, -2)
                            }
                            colorScale = []
                            let colors = colormapData[colorConfig]?.colors
                            if (colors != null) {
                                colors
                                    .map((color) => {
                                        const r = Math.round(color[0] * 255)
                                        const g = Math.round(color[1] * 255)
                                        const b = Math.round(color[2] * 255)
                                        return `rgb(${r}, ${g}, ${b})`
                                    })
                                    .forEach((colorString) =>
                                        colorScale.push(colorString)
                                    )
                                if (reverse) {
                                    colorScale = colorScale.reverse()
                                }
                            } else {
                                colorScale = defaultColors
                            }
                        }
                    }
                    let velocityLayer = L.velocityLayer({
                        displayValues:
                            layerObj.variables?.streamlines?.displayValues,
                        displayOptions: {
                            position: layerObj.variables?.streamlines
                                ?.displayPosition
                                ? layerObj.variables?.streamlines
                                      ?.displayPosition
                                : 'bottomleft',
                            emptyString: '',
                        },
                        data: data,
                        minVelocity: layerObj.variables?.streamlines
                            ?.minVelocity
                            ? layerObj.variables.streamlines.minVelocity
                            : 0,
                        maxVelocity: layerObj.variables?.streamlines
                            ?.maxVelocity
                            ? layerObj.variables.streamlines.maxVelocity
                            : 15,
                        velocityScale: layerObj.variables?.streamlines
                            ?.velocityScale
                            ? layerObj.variables.streamlines.velocityScale
                            : 0.005,
                        particleAge: layerObj.variables?.streamlines
                            ?.particleAge
                            ? layerObj.variables.streamlines.particleAge
                            : 90,
                        lineWidth: layerObj.variables?.streamlines?.lineWidth
                            ? layerObj.variables.streamlines.lineWidth
                            : 1,
                        particleMultiplier: layerObj.variables?.streamlines
                            ?.particleMultiplier
                            ? layerObj.variables.streamlines.particleMultiplier
                            : 1 / 300,
                        frameRate: layerObj.variables?.streamlines?.frameRate
                            ? layerObj.variables.streamlines.frameRate
                            : 15,
                        colorScale: colorScale,
                    })
                    velocityLayer.setZIndex = function () {}
                    L_.layers.layer[layerObj.name] = velocityLayer

                    // Streamlines are animated against the current view, so
                    // they jump while the map moves: fade them out until the
                    // move settles (the opacity is restored by the layer's
                    // regular opacity refresh).
                    MapRenderer.onViewChangeStart(mctx, () => {
                        L_.layers.layer[layerObj.name]?.setOpacity(0)
                    })
                } else if (layerObj.kind == 'particles') {
                    let points = []
                    if (data.features) {
                        data.features.forEach(function (feature) {
                            points.push([
                                feature.geometry.coordinates[1],
                                feature.geometry.coordinates[0],
                            ])
                        })
                    }
                    let options = {
                        angle: layerObj.variables?.particles?.angle
                            ? layerObj.variables?.particles?.angle
                            : 80,
                        width: layerObj.variables?.particles?.width
                            ? layerObj.variables?.particles?.width
                            : 1,
                        spacing: layerObj.variables?.particles?.spacing
                            ? layerObj.variables?.particles?.spacing
                            : 10,
                        length: layerObj.variables?.particles?.length
                            ? layerObj.variables?.particles?.length
                            : 4,
                        interval: layerObj.variables?.particles?.interval
                            ? layerObj.variables?.particles?.interval
                            : 10,
                        speed: layerObj.variables?.particles?.speed
                            ? layerObj.variables?.particles?.speed
                            : 0.1,
                        color: layerObj.style?.color
                            ? layerObj.style?.color
                            : 'Oxa6b3e9',
                    }
                    let rainLayer = L.rain(points, options)
                    rainLayer.setZIndex = function () {}
                    L_.layers.layer[layerObj.name] = rainLayer
                }
                L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
            }
            L_.Map_.allLayersLoaded()
            resolve()
        }
    })
}

/**
 * A velocity field is an animation over a captured data window, not a static
 * layer: showing it again has to recapture and rebuild it (the streamline and
 * particle canvases cannot be re-attached), so this type owns show/hide instead
 * of using the core add/remove default.
 */
async function setVisibility(layerObj, ctx = {}) {
    const name = layerObj.name

    if (!ctx.visible) {
        L_.Map_.rmNotNull(L_.layers.layer[name])
        return
    }

    if (!ctx.hadToMake) {
        if (['streamlines', 'particles'].includes(layerObj.kind))
            L_.Map_.rmNotNull(L_.layers.layer[name])

        await L_.Map_.makeLayer(layerObj, true, null, null, true)
        Description.updateInfo()
    }

    L_.Map_.map.addLayer(L_.layers.layer[name])
    L_.layers.layer[name].setZIndex(
        L_._layersOrdered.length + 1 - L_._layersOrdered.indexOf(name)
    )
}

export default {
    make,
    setVisibility,
}
