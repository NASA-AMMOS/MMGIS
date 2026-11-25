import calls from '@pre/calls'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import {
    fetchKmlAsGeoJSON,
    isKmlUrl,
} from '@basics/Layers_/capture/LayerCapturer'

const requestApi = (endpoint, body) =>
    new Promise((resolve, reject) =>
        calls.api(endpoint, body, resolve, reject)
    )

export function extents(layer) {
    const options = [{ value: 'current', label: 'Current Extent' }]
    if (layer.variables?.dynamicExtent !== true) return options
    if (
        layer.variables?.getFeaturePropertiesOnClick === true &&
        layer._lastGeodatasetRequestBody
    )
        options.push({
            value: 'raw-extent',
            label: 'Current Extent w/ Props',
        })
    options.push({ value: 'entire', label: 'Entire File' })
    return options
}

export async function getGeoJSON(layer, { extent = 'current' } = {}) {
    const mapLayer = L_.layers?.layer?.[layer.name]
    if (!mapLayer?.toGeoJSON)
        throw new Error('This layer does not expose exportable GeoJSON data.')
    let geojson
    if (
        extent === 'entire' &&
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
    } else if (extent === 'raw-extent' && layer._lastGeodatasetRequestBody) {
        const body = JSON.parse(
            JSON.stringify(layer._lastGeodatasetRequestBody)
        )
        delete body._source
        delete body.noDuplicates
        geojson = await requestApi('geodatasets_get', body)
    } else {
        const precision = L_.GEOJSON_PRECISION ?? window.L_?.GEOJSON_PRECISION
        geojson = mapLayer.toGeoJSON(precision)
    }
    if (
        layer.variables?.dynamicExtent === true &&
        extent === 'current' &&
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
    return geojson
}

const vectorExport = { extents, getGeoJSON }

export default vectorExport
