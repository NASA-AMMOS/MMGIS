/**
 * Video layer type — map renderer.
 *
 * Renders a georeferenced video overlay (.webm/.mp4) onto a bounding box on the
 * 2D map. All Leaflet access goes through the MapRenderer middleware's escape
 * hatch (`mctx.raw` = the Leaflet namespace) so the plugin never imports Leaflet
 * directly. `L.videoOverlay` is engine-specific, so there is no neutral primitive
 * for it yet — the escape hatch is the documented path for that.
 *
 * Frozen renderer interface:
 *   ctx = { mapContext, ... }
 */
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const L = mctx.raw

    let layerUrl = L_.getUrl(layerObj.type, layerObj.url, layerObj)
    if (!F_.isUrlAbsolute(layerUrl)) {
        layerUrl = `${window.location.origin}${(
            window.location.pathname || ''
        ).replace(/\/$/g, '')}/${layerUrl}`
    }

    if (!layerObj.boundingBox || layerObj.boundingBox.length !== 4) {
        console.warn(
            `Video layer '${layerObj.name}' missing required bounding box`
        )
        L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
        L_.layers.layer[layerObj.name] = null
        L_.Map_.allLayersLoaded()
        return
    }

    const bounds = [
        [
            parseFloat(layerObj.boundingBox[1]),
            parseFloat(layerObj.boundingBox[0]),
        ],
        [
            parseFloat(layerObj.boundingBox[3]),
            parseFloat(layerObj.boundingBox[2]),
        ],
    ]

    const videoOptions = {
        opacity: layerObj.initialOpacity != null ? layerObj.initialOpacity : 1,
        autoplay: F_.getIn(layerObj, 'variables.video.autoplay', false),
        loop: F_.getIn(layerObj, 'variables.video.loop', true),
        muted: true, // Always muted by default
        playsInline: true,
    }

    try {
        L_.layers.layer[layerObj.name] = L.videoOverlay(
            layerUrl,
            bounds,
            videoOptions
        )

        // Add updateFilter function to video layer for CSS filter support
        L_.layers.layer[layerObj.name].updateFilter = function (filterArray) {
            const videoElement = this.getElement()
            if (videoElement) {
                let cssFilters = []

                filterArray.forEach((filter) => {
                    const [property, value] = filter.split(':')
                    // Skip blend mode for videos - only handle CSS filters
                    if (property !== 'mix-blend-mode') {
                        if (property === 'saturate') {
                            cssFilters.push(
                                `saturate(${parseFloat(value) * 100}%)`
                            )
                        } else if (property === 'brightness') {
                            cssFilters.push(
                                `brightness(${parseFloat(value) * 100}%)`
                            )
                        } else if (property === 'contrast') {
                            cssFilters.push(
                                `contrast(${parseFloat(value) * 100}%)`
                            )
                        }
                    }
                })

                // Apply CSS filters to video element
                videoElement.style.filter = cssFilters.join(' ')
            }
        }

        L_.layers.layer[layerObj.name].setZIndex(
            L_._layersOrdered.length +
                1 -
                L_._layersOrdered.indexOf(layerObj.name)
        )

        L_.setLayerOpacity(layerObj.name, L_.layers.opacity[layerObj.name])

        L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
        L_.Map_.allLayersLoaded()
    } catch (e) {
        console.warn(`WARNING - Unable to load video layer: ${layerUrl}`, e)
        L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
        L_.layers.layer[layerObj.name] = null
        L_.Map_.allLayersLoaded()
    }
}

// The <video> element only exists once the overlay is on the map, so the
// `muted` guarantee is re-asserted whenever the layer becomes visible (the
// `muted` constructor option alone is not honored by every browser).
function onToggle(layerObj, ctx = {}) {
    if (!ctx.visible) return

    const videoLayer = L_.layers.layer[layerObj.name]
    if (!videoLayer || !videoLayer.getElement) return

    const videoElement = videoLayer.getElement()
    if (!videoElement) return

    videoElement.muted = true
    videoElement.setAttribute('muted', 'true')
}

export default {
    make,
    onToggle,
}
