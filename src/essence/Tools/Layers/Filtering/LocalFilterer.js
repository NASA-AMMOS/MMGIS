// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../../Basics/Formulae_/Formulae_'
import L_ from '../../../Basics/Layers_/Layers_'

import flat from 'flat'
import { booleanIntersects, booleanContains } from '@turf/turf'

const LocalFilterer = {
    make: function (container, layerName) {
        const layerObj = L_.layersNamed[layerName]

        if (layerObj == null) return

        const type = layerObj.type

        if (type === 'vector') {
        } else if (type === 'query') {
        }
    },
    destroy: function (layerName) {},
    getAggregations: function (geojson) {
        const aggs = {}

        geojson.features.forEach((feature) => {
            const flatProps = flat.flatten(feature.properties)
            for (let p in flatProps) {
                let value = flatProps[p]
                let type

                if (!isNaN(value) && !isNaN(parseFloat(value))) type = 'number'
                else if (typeof value === 'string') type = 'string'
                else if (typeof value === 'number') type = 'number'

                if (type != null) {
                    // First type will be from index 0
                    aggs[p] = aggs[p] || { type: type, aggs: {} }
                    // Because of that, strings can usurp numbers (ex. ["1", "2", "Melon", "Pastry"])
                    if (aggs[p].type === 'number' && type === 'string')
                        aggs[p].type = type
                    aggs[p].aggs[flatProps[p]] = aggs[p].aggs[flatProps[p]] || 0
                    aggs[p].aggs[flatProps[p]]++
                }
            }
        })
        return aggs
    },
    filter: function (layerName, filter) {
        const geojson = filter.geojson
        const filteredGeoJSON = JSON.parse(JSON.stringify(geojson))
        filteredGeoJSON.features = []

        // Filter
        const halfFilteredGeoJSONFeatures = []
        geojson.features.forEach((f) => {
            if (LocalFilterer.match(f, filter))
                halfFilteredGeoJSONFeatures.push(f)
        })

        // Spatial Filter (after filter to make it quicker)
        halfFilteredGeoJSONFeatures.forEach((f) => {
            if (filter.spatial.center == null) {
                filteredGeoJSON.features.push(f)
            } else {
                if (filter.spatial.radius > 0) {
                    // Circle Intersects
                    if (
                        booleanIntersects(
                            filter.spatial.feature.geometry,
                            f.geometry
                        )
                    )
                        filteredGeoJSON.features.push(f)
                } else {
                    // Point Contained
                    if (
                        booleanContains(
                            f.geometry,
                            filter.spatial.feature.geometry
                        )
                    )
                        filteredGeoJSON.features.push(f)
                }
            }
        })

        // Set count
        $('#layersTool_filtering_count').text(
            `(${filteredGeoJSON.features.length}/${geojson.features.length})`
        )

        // Update layer
        L_.clearVectorLayer(layerName)
        L_.updateVectorLayer(layerName, filteredGeoJSON)
    },
    match: function (feature, filter) {
        if (filter.values.length === 0) return true

        let matches = false
        for (let i = 0; i < filter.values.length; i++) {
            const v = filter.values[i]
            if (v && v.key != null) {
                const featureValue = F_.getIn(feature.properties, v.key)
                let filterValue = v.value
                if (v.type === 'number') filterValue = parseFloat(filterValue)
                if (featureValue != null) {
                    switch (v.op) {
                        case '=':
                            if (featureValue == filterValue) matches = true
                            else matches = false
                            break
                        case ',':
                            if (filterValue != null) {
                                const stringFilterValue = filterValue + ''
                                const stringFeatureValue = featureValue + ''
                                if (
                                    stringFilterValue
                                        .split(',')
                                        .includes(stringFeatureValue)
                                )
                                    matches = true
                                else matches = false
                            } else matches = false
                            break
                        case '<':
                            if (
                                v.type === 'string'
                                    ? featureValue.localeCompare(filterValue) >
                                      0
                                    : featureValue < filterValue
                            )
                                matches = true
                            else matches = false
                            break
                        case '>':
                            if (
                                v.type === 'string'
                                    ? featureValue.localeCompare(filterValue) <
                                      0
                                    : featureValue > filterValue
                            )
                                matches = true
                            else matches = false
                            break
                        default:
                            break
                    }
                    if (!matches) return false
                }
            } else {
                // True if user never set a key for the filter row
                matches = true
            }
        }
        return matches
    },
}

export default LocalFilterer
