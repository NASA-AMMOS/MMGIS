// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'

import flat from 'flat'
import { booleanIntersects, booleanContains } from '@turf/turf'

const LocalFilterer = {
    make: function (container, layerName) {
        const layerObj = L_.layers.data[layerName]

        if (layerObj == null) return

        const type = layerObj.type

        if (type === 'vector') {
        } else if (type === 'query') {
        }
    },
    destroy: function (layerName) {},
    getAggregations: function (geojson) {
        const aggs = {
            'geometry.type': { type: 'string', aggs: {} },
        }

        geojson.features.forEach((feature) => {
            const flatProps = flat.flatten(feature.properties)
            for (let p in flatProps) {
                let value = flatProps[p]
                let type

                if (!isNaN(value) && !isNaN(parseFloat(value))) type = 'number'
                else if (typeof value === 'string') type = 'string'
                else if (typeof value === 'number') type = 'number'
                else if (typeof value === 'boolean') type = 'boolean'

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
            // feature.geometry.type
            if (feature.geometry != null) {
                aggs['geometry.type'].aggs[feature.geometry.type] =
                    aggs['geometry.type'].aggs[feature.geometry.type] || 0
                aggs['geometry.type'].aggs[feature.geometry.type]++
            }
        })

        // sort values
        Object.keys(aggs).forEach((agg) => {
            const sortedAggs = {}
            Object.keys(aggs[agg].aggs)
                .sort()
                .reverse()
                .forEach((agg2) => {
                    sortedAggs[agg2] = aggs[agg].aggs[agg2]
                })
            aggs[agg].aggs = sortedAggs
        })

        return aggs
    },
    filter: function (layerName, filter, refreshFunction) {
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
            if (filter.spatial == null || filter.spatial.center == null) {
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
        if (typeof refreshFunction === 'function') {
            refreshFunction(filteredGeoJSON)
        } else {
            L_.clearVectorLayer(layerName)
            L_.updateVectorLayer(layerName, filteredGeoJSON, null, true)
        }
    },
    match: function (feature, filter) {
        if (filter.values.length === 0) return true

        // Perform the per row match
        for (let i = 0; i < filter.values.length; i++) {
            const v = filter.values[i]
            if (v && v.isGroup === true) {
            } else if (v && v.key != null) {
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

                        case 'contains':
                            if (
                                String(featureValue).indexOf(
                                    String(filterValue)
                                ) != -1
                            )
                                v.matches = true
                            else v.matches = false
                            break
                        case 'beginswith':
                            if (
                                String(featureValue).startsWith(
                                    String(filterValue)
                                )
                            )
                                v.matches = true
                            else v.matches = false
                            break
                        case 'endswith':
                            if (
                                String(featureValue).endsWith(
                                    String(filterValue)
                                )
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

        /*
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
            */

        let fvalues = JSON.parse(JSON.stringify(filter.values))
        fvalues = fvalues.filter(Boolean)

        if (filter.valuesOrder) {
            fvalues.sort((a, b) => {
                return (
                    filter.valuesOrder.indexOf(a.id) -
                    filter.valuesOrder.indexOf(b.id)
                )
            })
        }
        return LocalFilterer.evaluateMatchGroupings(fvalues)
    },
    evaluateMatchGroupings(conditions) {
        const groups = []
        let currentOp = 'AND' // Default to AND if no op is provided
        let currentGroup = []
        let negateNextGroup = false

        for (let i = 0; i < conditions.length; i++) {
            const item = conditions[i]

            if (item.isGroup && item.op) {
                // Save the current group before switching op
                if (currentGroup.length > 0) {
                    groups.push({
                        op: currentOp,
                        matches: currentGroup,
                    })
                    currentGroup = []
                }

                currentOp = item.op
            } else if ('matches' in item) {
                currentGroup.push(item.matches)
            }
        }

        // Push the final group
        if (currentGroup.length > 0) {
            groups.push({
                op: currentOp,
                matches: currentGroup,
            })
        }

        // Evaluate each group
        const evaluatedGroups = groups.map((group) => {
            let result
            if (group.op === 'OR') {
                result = group.matches.some(Boolean)
            } else if (group.op === 'NOT_AND') {
                result = !group.matches.every(Boolean)
            } else if (group.op === 'NOT_OR') {
                result = !group.matches.some(Boolean)
            } else {
                // default to AND
                result = group.matches.every(Boolean)
            }

            return result
        })

        // Final result: AND all evaluated group results
        return evaluatedGroups.every(Boolean)
    },
}

export default LocalFilterer
