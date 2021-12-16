// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../../Basics/Formulae_/Formulae_'
import L_ from '../../../Basics/Layers_/Layers_'

import flat from 'flat'

const filters = {
    Waypoints: {
        spatial: {
            feature: {},
            operator: 'intersects | contains',
        },
        property: [
            {
                type: 'string | number',
                key: '',
                operator: '<, =, >, []',
                value: '',
            },
        ],
    },
}

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
    filter: function (filter, layerName) {
        console.log(filter, layerName)

        const geojson = filter.geojson
        console.log(geojson)
        const filteredGeoJSON = JSON.parse(JSON.stringify(geojson))
        filteredGeoJSON.features = []

        geojson.features.forEach((f) => {
            if (LocalFilterer.match(f, filter)) filteredGeoJSON.features.push(f)
        })
        console.log(filteredGeoJSON)

        L_.clearVectorLayer(layerName)
        L_.updateVectorLayer(layerName, filteredGeoJSON)
    },
    match: function (feature, filter) {
        let matches = false
        for (let i = 0; i < filter.values.length; i++) {
            const v = filter.values[i]
            const featureValue = F_.getIn(feature.properties, v.key)
            let filterValue = v.value
            if (v.type === 'number') filterValue = parseFloat(filterValue)
            if (featureValue != null) {
                switch (v.op) {
                    case '=':
                        if (featureValue == filterValue) matches = true
                        else matches = false
                        break
                    case '<':
                        if (
                            v.type === 'string'
                                ? featureValue.localeCompare(filterValue) > 0
                                : featureValue < filterValue
                        )
                            matches = true
                        else matches = false
                        break
                    case '>':
                        if (
                            v.type === 'string'
                                ? featureValue.localeCompare(filterValue) < 0
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
        }
        return matches
    },
}

export default LocalFilterer
