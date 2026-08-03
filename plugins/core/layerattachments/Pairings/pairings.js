/**
 * Pairings attachment — lines between a host layer's features and the matching
 * features of the layers it pairs with.
 *
 * Because the lines depend on those other layers, the pairing layer rebuilds
 * itself whenever one of them is toggled (`onPeerToggle`), and showing it means
 * asking it to draw rather than adding it to the map.
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import { centroid } from '@turf/turf'

const L = window.L

// Draws a thin faint line to the center of features from other layers that are connected to this layer
const pairings = (geojson, layerObj, leafletLayerObject) => {
    //PAIRINGS
    const pairingsVar = F_.getIn(
        layerObj,
        'variables.layerAttachments.pairings'
    )

    if (
        pairingsVar &&
        (pairingsVar.enabled === true || pairingsVar.enabled == null)
    ) {
        const layers = (pairingsVar.layers || []).map((l) => L_.asLayerUUID(l))

        const pairProp = pairingsVar.pairProp
        const layersAzProp = pairingsVar.layersAzProp
        const layersElProp = pairingsVar.layersElProp
        const style = pairingsVar.style || {}
        const styleObject = {
            style: {
                ...{
                    weight: 2,
                    color: 'yellow',
                    opacity: 0.35,
                },
                ...style,
            },
        }

        if (layers.length === 0 || pairProp == null) {
            console.warn(
                `Layer '${layerObj.name}' has badly formed 'pairings' attachments object. Missing 'layers' or 'pairProp'.`
            )
            return
        }

        const getPairingLayer = (dontCalculate, forceGeojson) => {
            const pairingLineFeatures = []
            if (forceGeojson) geojson = forceGeojson
            if (!dontCalculate)
                geojson.features.forEach((f) => {
                    const featureCenter = centroid(f).geometry.coordinates
                    const pairValue = F_.getIn(
                        f.properties,
                        pairProp,
                        '___null'
                    )

                    layers.forEach((layerName) => {
                        if (
                            L_.layers.layer[layerName] &&
                            L_.layers.layer[layerName]._sourceGeoJSON &&
                            L_.layers.on[layerName] === true
                        ) {
                            L_.layers.layer[
                                layerName
                            ]._sourceGeoJSON.features.forEach((pairFeature) => {
                                if (
                                    F_.getIn(
                                        pairFeature.properties,
                                        pairProp,
                                        null
                                    ) === pairValue
                                ) {
                                    const pairFeatureCenter =
                                        centroid(pairFeature).geometry
                                            .coordinates

                                    pairingLineFeatures.push({
                                        type: 'Feature',
                                        properties: {},
                                        geometry: {
                                            type: 'LineString',
                                            coordinates: [
                                                featureCenter,
                                                pairFeatureCenter,
                                            ],
                                        },
                                    })
                                }
                            })
                        }
                    })
                })

            let layer = L.geoJson(pairingLineFeatures, styleObject)

            layer.on = (firstTime, sublayerLayer) => {
                const layerMain =
                    L_.layers.attachments?.[layerObj.name]?.pairings?.layer
                if (layerMain == null) return

                layerMain.off()
                // For checking whether we can use the previous layer instead of recreating
                const constructedFromLayers = []
                layers.forEach((layerName) => {
                    if (
                        L_.layers.layer[layerName] &&
                        L_.layers.layer[layerName]._sourceGeoJSON &&
                        L_.layers.on[layerName] === true
                    ) {
                        constructedFromLayers.push(layerName)
                    }
                })
                const constructedTag = constructedFromLayers.join('__')

                // Check if "", since if it is, no need to add anything
                if (constructedTag.length > 0) {
                    if (
                        sublayerLayer == null ||
                        constructedTag !== layerMain.constructedTag
                    ) {
                        L_.layers.attachments[layerObj.name].pairings.layer =
                            getPairingLayer()
                        L_.layers.attachments[
                            layerObj.name
                        ].pairings.layer.constructedTag = constructedTag
                        if (sublayerLayer)
                            sublayerLayer =
                                L_.layers.attachments[layerObj.name].pairings
                                    .layer
                    }
                    L_.Map_.map.addLayer(layerMain)
                    layerMain.setZIndex(
                        L_._layersOrdered.length +
                            1 -
                            L_._layersOrdered.indexOf(layerObj.name)
                    )
                }
            }
            layer.off = () => {
                const layerMain =
                    L_.layers.attachments?.[layerObj.name]?.pairings?.layer
                if (layerMain == null) return

                L_.Map_.rmNotNull(layerMain)
            }
            return layer
        }

        // Doesn't matter if Map isn't attached to Layers for the first time
        if (L_.Map_) {
            L_.Map_.rmNotNull(
                L_.layers.attachments?.[layerObj.name]?.pairings?.layer
            )
        }
        const layer = getPairingLayer(true)

        layer.addDataEnhanced = function (geojson, layerName, subName, Map_) {
            Map_.rmNotNull(L_.layers.attachments[layerName][subName].layer)
            L_.layers.attachments[layerName][subName].geojson = geojson
            L_.layers.attachments[layerName][subName].layer = getPairingLayer(
                false,
                geojson
            )
            Map_.map.addLayer(L_.layers.attachments[layerName][subName].layer) //
        }

        return {
            on: L_.layers.attachments[layerObj.name]?.pairings
                ? L_.layers.attachments[layerObj.name]?.pairings.on
                : pairingsVar.initialVisibility != null
                  ? pairingsVar.initialVisibility
                  : true,
            pairedLayers: layers,
            pairProp: pairProp,
            layersAzProp: layersAzProp,
            layersElProp: layersElProp,
            originOffsetOrder: pairingsVar.originOffsetOrder,
            type: 'pairings',
            geojson: geojson,
            layer: layer,
            title: 'Feature Pairings',
            minZoom: layerObj.minZoom != null ? layerObj.minZoom : 0,
            maxZoom: layerObj.maxZoom != null ? layerObj.maxZoom : 100,
        }
    } else {
        return false
    }
}

function setVisibility(attachment, ctx = {}) {
    if (attachment.layer == null) return

    if (ctx.visible) attachment.layer.on(false, attachment.layer)
    else attachment.layer.off()
}

/**
 * A layer this attachment pairs with was toggled — redraw so the lines match
 * which of those layers are on. Core calls this for every visible pairing
 * attachment, so it decides for itself whether the toggled layer is one of its.
 */
function onPeerToggle(attachment, ctx = {}) {
    if (!attachment.on) return
    if (!attachment.pairedLayers?.includes(ctx.layerName)) return
    attachment.layer?.on(false, attachment.layer)
}

/**
 * Which features of which other layers are paired with one of the host's, and
 * where they sit relative to it. This is what a pairing *means* rather than how
 * it is drawn, so anything showing a feature's surroundings (the photosphere
 * viewer) asks for it instead of reading this attachment's config itself.
 *
 * @param {Object} attachment
 * @param {Object} ctx
 * @param {Object} ctx.feature            The host feature to pair from.
 * @param {number[]} [ctx.originOffset]   Offset applied to the host feature's
 *                                        coordinates before measuring, in the
 *                                        axis order the attachment declares.
 * @returns {{origin: number[], layerNames: string[], peers: Object[]}|false}
 *          `peers` are `{ layerName, feature, az, el, dist }`; `origin` is the
 *          (possibly offset) coordinate everything was measured from.
 */
function peerFeaturesFor(attachment, ctx = {}) {
    const feature = ctx.feature
    if (!attachment.on || feature == null) return false

    let origin = feature.geometry.coordinates
    let originOffsetOrder = attachment.originOffsetOrder
    if (originOffsetOrder)
        originOffsetOrder = originOffsetOrder.map((o) => o.toLowerCase())

    // The offset is in a projected frame (meters), so project, offset along the
    // declared axes, and come back.
    // prettier-ignore
    if (ctx.originOffset != null) {
        const crs = window.mmgisglobal.customCRS
        const p = crs.project({ lng: origin[0], lat: origin[1] })
        origin = [p.x, p.y, origin[2]]
        for (let i = 0; i < 3; i++) {
            if (ctx.originOffset[i] == null) continue
            const axis = originOffsetOrder?.[i]
            if (axis != null) {
                const pos = axis.includes('z') ? 2 : axis.includes('y') ? 1 : 0
                const sign = axis.includes('-') ? -1 : 1
                origin[pos] += sign * ctx.originOffset[i]
            } else origin[i] += ctx.originOffset[i]
        }
        const up = crs.unproject({ x: origin[0], y: origin[1] })
        origin = [up.lng, up.lat, origin[2]]
    }

    const pairValue = F_.getIn(feature.properties, attachment.pairProp, '___null')
    const layerNames = []
    const peers = []

    attachment.pairedLayers.forEach((pairedLayerName) => {
        const pairedLayer = L_.layers.layer[pairedLayerName]
        if (
            !pairedLayer ||
            !pairedLayer._sourceGeoJSON ||
            L_.layers.on[pairedLayerName] !== true
        )
            return
        layerNames.push(pairedLayerName)

        pairedLayer._sourceGeoJSON.features.forEach((pairFeature) => {
            if (pairFeature.geometry.type !== 'Point') return
            if (
                F_.getIn(pairFeature.properties, attachment.pairProp, null) !==
                pairValue
            )
                return

            const pairCoords = pairFeature.geometry.coordinates
            const azElDist = F_.azElDistBetween(
                { lat: origin[1], lng: origin[0], el: origin[2] },
                {
                    lat: pairCoords[1],
                    lng: pairCoords[0],
                    el: pairCoords[2],
                }
            )

            // An az/el carried by the feature itself is authoritative over one
            // computed from coordinates.
            if (attachment.layersAzProp != null) {
                const az = F_.getIn(
                    pairFeature.properties,
                    attachment.layersAzProp,
                    null
                )
                if (az != null) azElDist.az = az
            }
            if (attachment.layersElProp != null) {
                const el = F_.getIn(
                    pairFeature.properties,
                    attachment.layersElProp,
                    null
                )
                if (el != null) azElDist.el = el
            }

            peers.push({
                layerName: pairedLayerName,
                feature: pairFeature,
                az: azElDist.az,
                el: azElDist.el,
                dist: azElDist.dist,
            })
        })
    })

    return { origin, layerNames, peers }
}

export default {
    make: (ctx) => pairings(ctx.geojson, ctx.layerObj, ctx.leafletLayerObject),
    setVisibility,
    onPeerToggle,
    peerFeaturesFor,
}
