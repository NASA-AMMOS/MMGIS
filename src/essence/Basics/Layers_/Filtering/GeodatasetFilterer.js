// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import calls from '../../../../pre/calls'

import flat from 'flat'
import { booleanIntersects, booleanContains } from '@turf/turf'

const GeodatasetFilterer = {
    make: function (container, layerName) {
        const layerObj = L_.layers.data[layerName]

        if (layerObj == null) return

        const type = layerObj.type

        if (type === 'vector') {
        } else if (type === 'query') {
        }
    },
    destroy: function (layerName) {},
    getAggregations: function (layerName) {
        return new Promise((resolve, reject) => {
            const layerData = L_.layers.data[layerName]
            // Then query, delete existing and remake
            const bounds = L_.Map_.map.getBounds()
            const body = {
                layer: layerData.url.split(':')[1],
                maxy: bounds._northEast.lat,
                maxx: bounds._northEast.lng,
                miny: bounds._southWest.lat,
                minx: bounds._southWest.lng,
                limit: 500,
            }

            if (layerData.time?.enabled === true) {
                body.starttime = layerData.time.start
                body.startProp = layerData.time.startProp
                body.endtime = layerData.time.end
                body.endProp = layerData.time.endProp
            }
            calls.api(
                'geodatasets_aggregations',
                body,
                function (data) {
                    if (data.status === 'success') {
                        resolve(data.aggregations)
                    } else {
                        console.warn(
                            `Failed to get geodataset aggregations for ${layerName}`
                        )
                        resolve({})
                    }
                },
                function () {
                    console.warn(
                        `Failed to query geodataset aggregations for ${layerName}`
                    )
                    resolve({})
                }
            )
        })
    },
    filter: function (layerName, filter, refreshFunction) {
        L_.layers.data[layerName]._stopLoops = true
        L_.layers.data[layerName]._filter = filter
        L_.layers.data[layerName]._filterEncoded = {}
        if (L_.layers.data[layerName]._filter) {
            let fspatial = L_.layers.data[layerName]._filter.spatial
            let fvalues = L_.layers.data[layerName]._filter.values
            if (
                fspatial != null &&
                fspatial.radius > 0 &&
                fspatial.center?.lat != null &&
                fspatial.center?.lng != null
            )
                L_.layers.data[
                    layerName
                ]._filterEncoded.spatialFilter = `${fspatial.center.lat},${fspatial.center.lng},${fspatial.radius}`

            if (fvalues != null && fvalues.length > 0) {
                fvalues = fvalues.filter(Boolean)

                if (fvalues.length > 0) {
                    let encoded = []
                    fvalues.forEach((v) => {
                        if (v.value != null && v.key != null)
                            encoded.push(
                                `${v.key}+${v.op === ',' ? 'in' : v.op}+${
                                    v.type
                                }+${v.value.replaceAll(',', '$')}`
                            )
                    })
                    L_.layers.data[layerName]._filterEncoded.filters =
                        encoded.join(',')
                }
            }
        }
        L_.Map_.refreshLayer(L_.layers.data[layerName])
    },
    match: function (feature, filter) {
        if (filter.values.length === 0) return true

        // Perform the per row match
        for (let i = 0; i < filter.values.length; i++) {
            const v = filter.values[i]
            if (v && v.key != null) {
                let featureValue =
                    v.key === 'geometry.type'
                        ? feature.geometry.type
                        : F_.getIn(feature.properties, v.key)
                let filterValue = v.value
                if (v.type === 'number' && v.op != ',')
                    filterValue = parseFloat(filterValue)
                else if (v.type === 'boolean') {
                    if (featureValue == null) featureValue = false
                    filterValue = filterValue == 'true'
                }

                if (featureValue != null) {
                    switch (v.op) {
                        case '=':
                            if (featureValue == filterValue) v.matches = true
                            else v.matches = false
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
                                    v.matches = true
                                else v.matches = false
                            } else v.matches = false
                            break
                        case '<':
                            if (
                                v.type === 'string'
                                    ? featureValue.localeCompare(filterValue) >
                                      0
                                    : featureValue < filterValue
                            )
                                v.matches = true
                            else v.matches = false
                            break
                        case '>':
                            if (
                                v.type === 'string'
                                    ? featureValue.localeCompare(filterValue) <
                                      0
                                    : featureValue > filterValue
                            )
                                v.matches = true
                            else v.matches = false
                            break
                        default:
                            break
                    }
                    //if (!matches) return false
                } else {
                    v.matches = false
                }
            }
        }

        // Now group together all matching keys and process
        // Filter values with the same key are ORed together if = and ANDed if not
        // i.e. sol = 50, sol = 51 becomes sol == 50 OR sol == 51
        //      sol > 50, sol < 100 becomes sol > 50 AND sol < 100
        //      sol > 50, sol < 100, sol = 200 becomes (sol > 50 AND sol < 100) OR sol == 101
        const groupedValuesByKey = {}
        filter.values.forEach((v) => {
            if (v && v.key != null) {
                groupedValuesByKey[v.key] = groupedValuesByKey[v.key] || []
                groupedValuesByKey[v.key].push(v)
            }
        })

        const matches = []
        Object.keys(groupedValuesByKey).forEach((key) => {
            // For grouped values to pass, (all the >,< ANDed must be true) OR (all the rest ORed must be true)

            // To facilitate that, first group by operator
            const groupedValuesByOp = {}
            groupedValuesByKey[key].forEach((v) => {
                let op = v.op
                if (op === '<' || op === '>') op = '<>'

                groupedValuesByOp[op] = groupedValuesByOp[op] || []
                groupedValuesByOp[op].push(v)
            })

            const opMatches = []
            Object.keys(groupedValuesByOp).forEach((op) => {
                let match = null
                groupedValuesByOp[op].forEach((v) => {
                    if (op === '<>') {
                        if (match === null) match = true
                        match = match && v.matches
                    } else {
                        if (match === null) match = false
                        match = match || v.matches
                    }
                })
                opMatches.push(match)
            })
            // If at least one true, the op match passes
            matches.push(opMatches.includes(true))
        })

        // If all are true
        return matches.filter(Boolean).length === matches.length
    },
}

export default GeodatasetFilterer
