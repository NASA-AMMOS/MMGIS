/**
 * Vector layer type — globe layer config.
 *
 * Built from the layer's normal MMGIS config object plus the GeoJSON of the
 * layer that map `make` produced, and shared by both globe engines. Core never
 * builds this.
 */
import L_ from '@basics/Layers_/Layers_'

/**
 * True when this layer should be drawn draped on the terrain ('clamped') rather
 * than as free geometry ('vector'). MMGIS vector layers are clamped by default;
 * `layer3dType` in the layer config opts out.
 */
export function isClamped(layerObj) {
    return (layerObj.layer3dType || 'clamped') === 'clamped'
}

/**
 * @returns the globe layer config, or null when there is nothing to draw yet
 *          (the map layer has not been made, or is not GeoJSON-backed).
 */
export function toGlobeConfig(layerObj) {
    const s = layerObj
    const mapLayer = L_.layers.layer[s.name]
    if (!mapLayer || typeof mapLayer.toGeoJSON !== 'function') return null

    const bearing = s.variables?.markerAttachments?.bearing

    return {
        name: s.name,
        order: L_._layersOrdered, // Since higher order in litho is on top
        on: L_.layers.opacity[s.name] ? true : false,
        geojson: mapLayer.toGeoJSON(L_.GEOJSON_PRECISION),
        onClick: (feature, lnglat, layer) => {
            L_.selectFeature(layer.name, feature)
        },
        useKeyAsHoverName: s.useKeyAsName,
        style: {
            // Prefer feature[f].properties.style values
            letPropertiesStyleOverride: true, // default false
            default: {
                fillColor: s.style?.fillColor, //Use only rgb and hex. No css color names
                fillOpacity: parseFloat(s.style?.fillOpacity),
                color: s.style?.color,
                weight: s.style?.weight,
                radius: s.radius,
            },
            bearing:
                (bearing && bearing.enabled == null) ||
                bearing?.enabled === true
                    ? bearing
                    : null,
        },
        opacity: L_.layers.opacity[s.name],
        minZoom: s.visibilitycutoff > 0 ? s.visibilitycutoff : 0,
        maxZoom: s.visibilitycutoff < 0 ? s.visibilitycutoff : 100,
    }
}

export default {
    isClamped,
    toGlobeConfig,
}
