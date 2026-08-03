/**
 * Labels attachment — per-feature text labels beside their host's features.
 *
 * The label layer is the host layer itself with tooltips bound to it, so
 * showing labels means asking that layer to draw them rather than adding
 * anything to the map — hence its own `setVisibility`. It is built after the
 * other attachments (`order`) because it labels their features too, which is
 * what `ctx.siblings` carries.
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

const labels = (geojson, layerObj, leafletLayerObject, layer, sublayers) => {
    //LABELS
    const labelsVar = F_.getIn(layerObj, 'variables.layerAttachments.labels')

    if (
        labelsVar &&
        (labelsVar.enabled === true || labelsVar.enabled == null)
    ) {
        let theme = ['solid'].includes(labelsVar.theme)
            ? labelsVar.theme
            : 'default'

        let size = ['large'].includes(labelsVar.size)
            ? labelsVar.size
            : 'default'

        let yOffset
        if (theme === 'solid' && size === 'default') yOffset = -11
        else if (theme === 'solid' && size === 'large') yOffset = -12
        else if (theme === 'default' && size === 'default') yOffset = -9
        else if (theme === 'default' && size === 'large') yOffset = -11

        // specify tooltip options
        const customOptions = {
            className: `mmgisFeatureLabel mmgisLabelTheme-${theme} mmgisLabelSize-${size}`,
            permanent: true,
            direction: 'top',
            opacity: 1,
            offset: [0, -yOffset + 6],
            pointOffset: [0, yOffset],
        }

        const mainDropdownProps = tooltipBuilder(layer)
        if (sublayers?.coordinate_markers?.layer) {
            const coordMarkerDropdownProps = tooltipBuilder(
                sublayers?.coordinate_markers?.layer,
                mainDropdownProps.dropdownValue
            )

            mainDropdownProps.dropdown = F_.removeDuplicatesInArray(
                mainDropdownProps.dropdown.concat(
                    coordMarkerDropdownProps.dropdown
                )
            )

            mainDropdownProps.dropdownValue =
                mainDropdownProps.dropdownValue ||
                coordMarkerDropdownProps.dropdownValue
        }

        function tooltipBuilder(leafletLayer, dropdownValue) {
            let dropdownProps = {
                dropdown: [],
                dropdownValue: null,
            }
            leafletLayer.eachLayer((l) => {
                if (
                    l.feature.properties.arrow !== true &&
                    l.feature.properties.annotation !== true
                ) {
                    dropdownProps.dropdown = Object.keys(l.feature.properties)
                    dropdownProps.dropdownValue =
                        dropdownValue != null ? dropdownValue : l.useKeyAsName

                    const value =
                        l.feature.properties[dropdownProps.dropdownValue]
                    let xOffset = 1

                    if (l.feature?.geometry?.type === 'Point')
                        xOffset +=
                            (layerObj.style?.radius || 0) +
                            (layerObj.style?.weight || 0) * 2

                    customOptions.pointOffset[0] = xOffset

                    // For lines and polygons, anchor tooltip to first coordinate
                    if (
                        l.feature?.geometry?.type === 'LineString' ||
                        l.feature?.geometry?.type === 'Polygon' ||
                        l.feature?.geometry?.type === 'MultiLineString' ||
                        l.feature?.geometry?.type === 'MultiPolygon'
                    ) {
                        // Override getCenter to return first coordinate
                        l._labelAnchorLatLng = L_.getFirstCoordinate(
                            l.feature.geometry
                        )
                        l.getCenter = function () {
                            return this._labelAnchorLatLng
                        }
                    }

                    if (labelsVar.initialVisibility === true)
                        l.bindTooltip(
                            `<div class='mmgisFeatureLabelContent'>${value}</div>`,
                            customOptions
                        )
                }
            })

            return dropdownProps
        }

        layer.dropdown = mainDropdownProps.dropdown
        layer.dropdownValue = mainDropdownProps.dropdownValue
        layer.dropdownFunc = (layerName, subName, Map_, prop) => {
            const sublayer = L_.layers.attachments[layerName][subName]
            layer.dropdownValue = prop
            if (sublayer.on) layer.on()
        }

        layer.off = () => {
            const tooltipLayersOff = (leafletLayer, subname) => {
                leafletLayer.eachLayer((l) => {
                    if (l._tooltip) {
                        l.closeTooltip()
                        l.unbindTooltip()
                    }
                })

                const name =
                    `labels_${layer._layerName}_${subname || 'main'}`.replace(
                        / /g,
                        '_'
                    )
                L_.Globe_.litho.removeLayer(name)
            }
            tooltipLayersOff(layer)
            if (sublayers?.coordinate_markers?.layer)
                tooltipLayersOff(
                    sublayers?.coordinate_markers?.layer,
                    'coordinate_markers'
                )
        }
        layer.on = (firstTime) => {
            const tooltipLayersOn = (leafletLayer, subname) => {
                leafletLayer.eachLayer((l) => {
                    if (
                        l.feature.properties.arrow !== true &&
                        l.feature.properties.annotation !== true
                    ) {
                        const value = l.feature.properties[layer.dropdownValue]
                        const content = `<div class='mmgisFeatureLabelContent'>${value}</div>`
                        if (l._tooltip) l._tooltip.setContent(content)
                        else {
                            let xOffset = 1
                            if (l.feature?.geometry?.type === 'Point')
                                xOffset +=
                                    (layerObj.style?.radius || 0) +
                                    (layerObj.style?.weight || 0) * 2

                            customOptions.pointOffset[0] = xOffset

                            // For lines and polygons, anchor tooltip to first coordinate
                            if (
                                l.feature?.geometry?.type === 'LineString' ||
                                l.feature?.geometry?.type === 'Polygon' ||
                                l.feature?.geometry?.type ===
                                    'MultiLineString' ||
                                l.feature?.geometry?.type === 'MultiPolygon'
                            ) {
                                // Override getCenter to return first coordinate
                                l._labelAnchorLatLng = L_.getFirstCoordinate(
                                    l.feature.geometry
                                )
                                l.getCenter = function () {
                                    return this._labelAnchorLatLng
                                }
                            }

                            l.bindTooltip(content, customOptions)
                        }
                        l.openTooltip()
                    }
                })
                const setForGlobe = () => {
                    const globeLabels = []
                    leafletLayer.eachLayer((l) => {
                        if (
                            l.feature.properties.arrow !== true &&
                            l.feature.properties.annotation !== true &&
                            l._tooltip?._latlng?.lng != null
                        ) {
                            const value =
                                l.feature.properties[layer.dropdownValue]
                            const globeLabel = {
                                type: 'Feature',
                            }
                            globeLabel.properties = {
                                annotation: true,
                                name: value,
                            }
                            globeLabel.geometry = {
                                type: 'Point',
                                coordinates: [
                                    l._tooltip._latlng.lng,
                                    l._tooltip._latlng.lat,
                                    l._tooltip._latlng.alt,
                                ],
                            }
                            globeLabels.push(globeLabel)
                        }
                    })

                    const name = `labels_${layer._layerName}_${
                        subname || 'main'
                    }`.replace(/ /g, '_')
                    if (L_.Globe_) {
                        L_.Globe_.litho.removeLayer(name)
                        L_.Globe_.litho.addLayer('vector', {
                            name: name,
                            on: true,
                            // GeoJSON or path to geojson
                            // [lng, lat, elev?]
                            geojson: {
                                type: 'FeatureCollection',
                                features: globeLabels,
                            },
                            style: {
                                letPropertiesStyleOverride: true,
                                default: {
                                    color: 'rgb(0, 0, 0)',
                                    fillColor: 'rgb(255, 255, 255)',
                                    fillOpacity: 1,
                                    weight: 2,
                                    fontSize:
                                        size === 'large' ? '18px' : '16px',
                                    elevOffset: 4,
                                },
                            },
                            opacity: 1,
                        })
                    }
                }

                // Short timeout since initial tooltip placement computation can take a bit
                setTimeout(() => {
                    setForGlobe()
                }, 1500)
            }

            tooltipLayersOn(layer)
            if (sublayers?.coordinate_markers?.layer)
                tooltipLayersOn(
                    sublayers?.coordinate_markers?.layer,
                    'coordinate_markers'
                )
        }

        // Only show labels initially if they're within zoom range
        if (labelsVar.initialVisibility === true) {
            const labelMinZoom = layerObj.minZoom != null ? layerObj.minZoom : 0
            const labelMaxZoom =
                layerObj.maxZoom != null ? layerObj.maxZoom : 100
            const currentZoom = L_.Map_.map ? L_.Map_.map.getZoom() : 0
            if (F_.isInZoomRange(labelMinZoom, labelMaxZoom, currentZoom)) {
                layer.on(true)
            }
        }

        layer.addDataEnhanced = function (geojson, layerName, subName) {
            this.addData(geojson)
            if (L_.layers.attachments[layerName][subName].on) this.on()
        }

        return {
            on: L_.layers.attachments[layerObj.name]?.labels
                ? L_.layers.attachments[layerObj.name]?.labels.on
                : labelsVar.initialVisibility != null
                  ? labelsVar.initialVisibility
                  : true,
            type: 'labels',
            geojson: geojson,
            layer: layer,
            title: 'Feature Labels',
            minZoom: layerObj.minZoom != null ? layerObj.minZoom : 0,
            maxZoom: layerObj.maxZoom != null ? layerObj.maxZoom : 100,
        }
    } else return false
}

function setVisibility(attachment, ctx = {}) {
    if (attachment.layer == null) return

    if (ctx.visible) attachment.layer.on(false, attachment.layer)
    else attachment.layer.off()
}

export default {
    make: (ctx) =>
        labels(
            ctx.geojson,
            ctx.layerObj,
            ctx.leafletLayerObject,
            ctx.hostLayer,
            ctx.siblings
        ),
    setVisibility,
}
