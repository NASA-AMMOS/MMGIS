import F_ from '../../Formulae_/Formulae_'
import Description from '../../UserInterface_/components/Description/Description'
import ToolController_ from '../../ToolController_/ToolController_'

export function addGeoJSONData(L_, layer, geojson, keepLastN, stopLoops) {
    if (layer._sourceGeoJSON) {
        if (layer._sourceGeoJSON.features)
            if (geojson.features)
                layer._sourceGeoJSON.features =
                    layer._sourceGeoJSON.features.concat(geojson.features)
            else layer._sourceGeoJSON.features.push(geojson)
        else
            layer._sourceGeoJSON = F_.getBaseGeoJSON(
                geojson.features
                    ? geojson.features
                    : geojson.length > 0 && geojson[0].type === 'Feature'
                      ? geojson
                      : null
            )
        if (keepLastN && keepLastN > 0) {
            layer._sourceGeoJSON.features =
                layer._sourceGeoJSON.features.slice(-1 * keepLastN)
        }
    }

    // Don't add data if hidden
    if (
        L_.layers.data[layer._layerName] &&
        F_.getIn(
            L_.layers.data[layer._layerName],
            'variables.hideMainFeature'
        ) === true
    )
        return
    const initialOn = L_.layers.on[layer._layerName]
    // Remove layer
    L_.Map_.rmNotNull(L_.layers.layer[layer._layerName])
    // Remove sublayers
    L_.syncSublayerData(layer._layerName, true)
    // Remake Layer
    L_.Map_.makeLayer(
        L_.layers.data[layer._layerName],
        true,
        layer._sourceGeoJSON,
        null,
        null,
        stopLoops
    )

    if (initialOn) {
        L_.toggleLayerHelper(L_.layers.data[layer._layerName], false)
        L_.layers.on[layer._layerName] = true
    }
    //L_.syncSublayerData(layer._layerName)
    if (initialOn) {
        // Reselect activeFeature
        if (L_.activeFeature) {
            L_.selectFeature(
                L_.activeFeature.layerName,
                L_.activeFeature.feature
            )
        }
    }
}

export function clearGeoJSONData(L_, layer) {
    if (layer._sourceGeoJSON) layer._sourceGeoJSON = F_.getBaseGeoJSON()
    layer.clearLayers()

    // If for some reason we still have layers, explicitly clear them
    if (Object.keys(layer._layers).length > 0) {
        layer.eachLayer((innerLayer) => {
            if (innerLayer._layers) innerLayer.clearLayers()
            if (layer.hasLayer(innerLayer)) layer.removeLayer(innerLayer)
            else {
                L_.Map_.rmNotNull(innerLayer)
            }
        })
        layer._layers = {}
    }
}

/**
 * Converts lnglat geojsons into the primary coordinate type.
 * @param {object} geojson - geojson object or geojson feature
 */
export function convertGeoJSONLngLatsToPrimaryCoordinates(L_, geojson, forceType) {
    if (geojson.features) {
        const nextGeoJSON = JSON.parse(JSON.stringify(geojson))
        const convertedFeatures = []
        nextGeoJSON.features.forEach((feature) => {
            const f = JSON.parse(JSON.stringify(feature))
            F_.coordinateDepthTraversal(
                f.geometry.coordinates,
                (coords) => {
                    let converted = []
                    const elev = coords[2]
                    converted = L_.Coordinates.convertLngLat(
                        coords[0],
                        coords[1],
                        forceType
                    )
                    if (elev != null) converted[2] = elev
                    return converted
                }
            )
            convertedFeatures.push(f)
        })
        nextGeoJSON.features = convertedFeatures
        nextGeoJSON._coordinates =
            L_.Coordinates.states[L_.Coordinates.mainType]
        nextGeoJSON._coordinates.type = L_.Coordinates.mainType

        return nextGeoJSON
    } else {
        // Just a single feature
        const feature = JSON.parse(JSON.stringify(geojson))
        F_.coordinateDepthTraversal(
            feature.geometry.coordinates,
            (coords) => {
                let converted = []
                const elev = coords[2]
                converted = L_.Coordinates.convertLngLat(
                    coords[0],
                    coords[1],
                    forceType
                )
                if (elev != null) converted[2] = elev
                return converted
            }
        )
        return feature
    }
}

export function clearVectorLayer(L_, layerName) {
    layerName = L_.asLayerUUID(layerName)
    try {
        L_.clearGeoJSONData(L_.layers.layer[layerName])
        L_.clearVectorLayerInfo()
        L_.syncSublayerData(layerName)
    } catch (e) {
        console.log(e)
        console.warn('Warning: Unable to clear vector layer: ' + layerName)
    }
}

export function trimVectorLayerKeepBeforeTime(
    L_,
    layerName,
    keepBeforeTime,
    timePropPath
) {
    L_.trimVectorLayerHelper(
        layerName,
        keepBeforeTime,
        timePropPath,
        'before'
    )
}

export function trimVectorLayerKeepAfterTime(
    L_,
    layerName,
    keepAfterTime,
    timePropPath
) {
    L_.trimVectorLayerHelper(
        layerName,
        keepAfterTime,
        timePropPath,
        'after'
    )
}

export function trimVectorLayerHelper(
    L_,
    layerName,
    keepTime,
    timePropPath,
    trimType
) {
    layerName = L_.asLayerUUID(layerName)
    // Validate input parameters
    if (!keepTime) {
        console.warn(
            'Warning: The input for keep' +
                trimType.capitalizeFirstLetter() +
                'Time is invalid: ' +
                keepTime
        )
        return
    }

    if (!timePropPath) {
        console.warn(
            'Warning: The input for timePropPath is invalid: ' +
                timePropPath
        )
        return
    }

    if (keepTime) {
        const keepAfterAsDate = new Date(keepTime)
        if (isNaN(keepAfterAsDate.getTime())) {
            console.warn(
                'Warning: The input for keep' +
                    trimType.capitalizeFirstLetter() +
                    'Time is invalid: ' +
                    keepTime
            )
            return
        }
    }

    if (layerName in L_.layers.layer) {
        const updateLayer = L_.layers.layer[layerName]

        if (keepTime) {
            const layersGeoJSON = updateLayer.toGeoJSON(
                L_.GEOJSON_PRECISION
            )
            const removedLayers = []

            const keepTimeAsDate = new Date(keepTime)

            var layers = updateLayer.getLayers()
            for (let i = layers.length - 1; i >= 0; i--) {
                let layer = layers[i]
                if (layer.feature.properties[timePropPath]) {
                    const layerDate = new Date(
                        layer.feature.properties[timePropPath]
                    )
                    if (isNaN(layerDate.getTime())) {
                        console.warn(
                            'Warning: The time for the layer is invalid: ' +
                                layer.feature.properties[timePropPath]
                        )
                        continue
                    }
                    if (trimType === 'after') {
                        if (layerDate < keepTimeAsDate) {
                            removedLayers.push(layer)
                            layersGeoJSON.features.splice(i, 1)
                        }
                    } else if (trimType === 'before') {
                        if (layerDate > keepTimeAsDate) {
                            removedLayers.push(layer)
                            layersGeoJSON.features.splice(i, 1)
                        }
                    }
                }
            }

            L_.removeLayerHelper(updateLayer, removedLayers, layersGeoJSON)
            L_.syncSublayerData(layerName)
        }
    } else {
        console.warn(
            'Warning: Unable to trim vector layer as it does not exist: ' +
                layerName
        )
    }
}

export function keepFirstN(L_, layerName, keepFirstN) {
    L_.keepNHelper(layerName, keepFirstN, 'first')
}

export function keepLastN(L_, layerName, keepLastN) {
    L_.keepNHelper(layerName, keepLastN, 'last')
}

export function keepNHelper(L_, layerName, keepN, keepType) {
    layerName = L_.asLayerUUID(layerName)
    // Validate input parameter
    const keepNum = parseInt(keepN)
    if (Number.isNaN(Number(keepNum))) {
        console.warn(
            'Warning: Unable to trim vector layer `' +
                layerName +
                '` as keep' +
                keepType.capitalizeFirstLetter() +
                'N == ' +
                keepN +
                ' and is not a valid integer'
        )
        return
    }

    if (layerName in L_.layers.layer) {
        // Keep N elements if greater than 0 else keep all elements
        if (keepN && keepN > 0) {
            const updateLayer = L_.layers.layer[layerName]
            var layers = updateLayer.getLayers()

            const layersGeoJSON = updateLayer.toGeoJSON(
                L_.GEOJSON_PRECISION
            )

            const removedLayers = []
            if (keepType === 'last') {
                keepN = Math.min(keepN, layersGeoJSON.features.length)

                for (
                    let i = 0;
                    i < layersGeoJSON.features.length - keepN;
                    i++
                )
                    removedLayers.push(layers[i])

                layersGeoJSON.features.splice(
                    0,
                    layersGeoJSON.features.length - keepN
                )
                L_.removeLayerHelper(
                    updateLayer,
                    removedLayers,
                    layersGeoJSON
                )
            } else if (keepType === 'first') {
                keepN = Math.min(keepN, layersGeoJSON.features.length)

                for (
                    let i = layersGeoJSON.features.length - 1;
                    i >= keepN;
                    i--
                )
                    removedLayers.push(layers[i])

                layersGeoJSON.features = layersGeoJSON.features.slice(
                    0,
                    keepN
                )
                L_.removeLayerHelper(
                    updateLayer,
                    removedLayers,
                    layersGeoJSON
                )
            }
        }
    } else {
        console.warn(
            'Warning: Unable to trim vector layer as it does not exist: ' +
                layerName
        )
    }
}

export function trimLineString(L_, layerName, time, timeProp, trimN, startOrEnd) {
    layerName = L_.asLayerUUID(layerName)

    // Validate input parameters
    if (!time) {
        console.warn(
            'Warning: Unable to trim the LineString in vector layer `' +
                layerName +
                '` as time === ' +
                time +
                ' and is invalid'
        )
        return
    }

    const timeAsDate = new Date(time)
    if (isNaN(timeAsDate.getTime())) {
        console.warn('Warning: The input for time is not a valid date')
        return
    }

    if (!timeProp) {
        console.warn(
            'Warning: Unable to trim the LineString in vector layer `' +
                layerName +
                '` as timeProp === ' +
                timeProp +
                ' and is invalid'
        )
        return
    }

    const trimNum = parseInt(trimN)
    if (Number.isNaN(Number(trimNum))) {
        console.warn(
            'Warning: Unable to trim the LineString in vector layer `' +
                layerName +
                '` as trimN == ' +
                trimN +
                ' and is not a valid integer'
        )
        return
    }

    const TRIM_DIRECTION = ['start', 'end']
    if (!TRIM_DIRECTION.includes(startOrEnd)) {
        console.warn(
            'Warning: Unable to trim the LineString in vector layer `' +
                layerName +
                '` as startOrEnd == ' +
                startOrEnd +
                ' and is not a valid input value'
        )
        return
    }

    if (!time) {
        console.warn(
            'Warning: Unable to trim the LineString in vector layer `' +
                layerName +
                '` as startOrEnd == ' +
                startOrEnd +
                ' and is not a valid input value'
        )
        return
    }

    if (layerName in L_.layers.layer) {
        const updateLayer = L_.layers.layer[layerName]

        var layersGeoJSON = updateLayer.toGeoJSON(L_.GEOJSON_PRECISION)
        var features = layersGeoJSON.features

        // All of the features have to be a LineString
        const findNonLineString = features.filter((feature) => {
            return feature.geometry.type !== 'LineString'
        })

        if (findNonLineString.length > 0) {
            console.warn(
                'Warning: Unable to trim the vector layer `' +
                    layerName +
                    '` as the features contain geometry that is not LineString'
            )
            return
        }

        if (features.length > 0) {
            // Original layer time
            var layerTime
            if (startOrEnd === 'start') {
                layerTime = features[0].properties[timeProp]
            } else {
                layerTime =
                    features[features.length - 1].properties[timeProp]
            }
            const layerTimeAsDate = new Date(layerTime)

            // Trim only if the new start time is after the layer start time
            if (
                startOrEnd === 'start' &&
                layerTimeAsDate < timeAsDate &&
                trimNum > 0
            ) {
                let leftToTrim = trimNum
                let updatedFeatures = []
                // Walk forwards to find the new time
                while (features.length > 0) {
                    const feature = features[0]
                    // If the feature is missing the key for the time
                    if (!feature.properties.hasOwnProperty(timeProp)) {
                        console.warn(
                            'Warning: Unable to trim the vector layer `' +
                                layerName +
                                "` as the the feature's properties object is missing the `" +
                                timeProp +
                                '` key'
                        )
                        return
                    }

                    // If the number to trim is greater than the number of vertices in the current feature,
                    // trim the entire feature and move on to the next feature
                    if (leftToTrim >= feature.geometry.coordinates.length) {
                        leftToTrim -= feature.geometry.coordinates.length
                        features.shift()
                        continue
                    }

                    // Trim
                    if (leftToTrim > 0) {
                        feature.geometry.coordinates =
                            feature.geometry.coordinates.slice(leftToTrim)
                        leftToTrim -= trimNum
                    }

                    if (leftToTrim <= 0) {
                        feature.properties[timeProp] = time
                    }

                    updatedFeatures.push(feature)
                    features.shift()
                }
                layersGeoJSON.features = updatedFeatures
            }

            // Trim only if the new end time is before the layer end time
            if (
                startOrEnd === 'end' &&
                layerTimeAsDate > timeAsDate &&
                trimNum > 0
            ) {
                let leftToTrim = trimNum
                let updatedFeatures = []
                // Walk backwards to find the new time
                while (features.length > 0) {
                    const feature = features[features.length - 1]
                    // If the feature is missing the key for the end time
                    if (!feature.properties.hasOwnProperty(timeProp)) {
                        console.warn(
                            'Warning: Unable to trim the vector layer `' +
                                layerName +
                                "` as the the feature's properties object is missing the key `" +
                                timeProp +
                                '` for the end time'
                        )
                        return
                    }

                    // If the number to trim is greater than the number of vertices in the current feature,
                    // trim the entire feature and move on to the next feature
                    if (leftToTrim >= feature.geometry.coordinates.length) {
                        leftToTrim -= feature.geometry.coordinates.length
                        features.pop()
                        continue
                    }

                    // Trim
                    if (leftToTrim > 0) {
                        const length = feature.geometry.coordinates.length
                        feature.geometry.coordinates =
                            feature.geometry.coordinates.slice(
                                0,
                                length - leftToTrim
                            )
                        leftToTrim -= trimNum
                    }

                    if (leftToTrim <= 0) {
                        feature.properties[timeProp] = time
                    }

                    updatedFeatures.unshift(feature)
                    features.pop()
                }
                layersGeoJSON.features = updatedFeatures
            }

            L_.clearVectorLayerInfo()
            L_.clearGeoJSONData(updateLayer)
            L_.addGeoJSONData(updateLayer, layersGeoJSON)
        } else {
            console.warn(
                'Warning: Unable to trim the vector layer `' +
                    layerName +
                    '` as the layer contains no features'
            )
            return
        }
    } else {
        console.warn(
            'Warning: Unable to trim vector layer as it does not exist: ' +
                layerName
        )
    }
}

export function appendLineString(L_, layerName, inputData, timeProp) {
    layerName = L_.asLayerUUID(layerName)

    // Validate input parameter
    if (!inputData) {
        console.warn(
            'Warning: Unable to append to vector layer `' +
                layerName +
                '` as inputData is invalid: ' +
                JSON.stringify(inputData, null, 4)
        )
        return false
    }

    // Make sure the timeProp exists as a property in the updated data
    if (!inputData.properties.hasOwnProperty(timeProp)) {
        console.warn(
            'Warning: Unable to append to the vector layer `' +
                layerName +
                '` as timeProp === ' +
                timeProp +
                ' and does not exist as a property in inputData: ' +
                JSON.stringify(lastFeature, null, 4)
        )
        return false
    }

    if (layerName in L_.layers.layer) {
        const updateLayer = L_.layers.layer[layerName]
        if (L_._layersBeingMade[layerName] === true) {
            console.error(
                `ERROR - appendLineString: Cannot make layer ${layerObj.display_name}/${layerObj.name} as it's already being made!`
            )
            return false
        }

        var layers = updateLayer.getLayers()
        var layersGeoJSON = updateLayer.toGeoJSON(L_.GEOJSON_PRECISION)
        var features = layersGeoJSON.features

        if (features.length > 0) {
            var lastFeature = features[features.length - 1]
            // Make sure the last feature is a LineString
            if (lastFeature.geometry.type !== 'LineString') {
                console.warn(
                    'Warning: Unable to append to the vector layer `' +
                        layerName +
                        '` as the feature is not a LineStringfeature: ' +
                        JSON.stringify(lastFeature, null, 4)
                )
                return false
            }

            // Make sure the timeProp exists as a property in the feature
            if (!lastFeature.properties.hasOwnProperty(timeProp)) {
                console.warn(
                    'Warning: Unable to append to the vector layer `' +
                        layerName +
                        '` as timeProp === ' +
                        timeProp +
                        ' and does not exist as a property in the feature: ' +
                        JSON.stringify(lastFeature, null, 4)
                )
                return
            }

            if (inputData.type === 'Feature') {
                if (inputData.geometry.type !== 'LineString') {
                    console.warn(
                        'Warning: Unable to append to vector layer `' +
                            layerName +
                            "` as inputData has the wrong geometry type (must be of type 'LineString'): " +
                            JSON.stringify(inputData, null, 4)
                    )
                    return false
                }

                // Append new data to the end of the last feature
                lastFeature.geometry.coordinates =
                    lastFeature.geometry.coordinates.concat(
                        inputData.geometry.coordinates
                    )

                // Update the time
                lastFeature.properties[timeProp] =
                    inputData.properties[timeProp]
            } else {
                console.warn(
                    'Warning: Unable to append to vector layer `' +
                        layerName +
                        "` as inputData has the wrong type (must be of type 'Feature'): " +
                        JSON.stringify(inputData, null, 4)
                )
                return false
            }

            const initialOn = L_.layers.on[layerName]
            if (initialOn) {
                L_.toggleLayerHelper(L_.layers.data[layerName], false)
                L_.layers.on[layerName] = true
            }

            L_.clearGeoJSONData(updateLayer)
            try {
                L_.addGeoJSONData(updateLayer, layersGeoJSON)
            } catch (e) {
                console.log(e)
                console.warn(
                    'Warning: Unable to append LineString to layer as the layer or input data is invalid: ' +
                        layerName
                )
                return false
            }

            if (initialOn) {
                // Reselect activeFeature
                if (L_.activeFeature) {
                    L_.selectFeature(
                        L_.activeFeature.layerName,
                        L_.activeFeature.feature
                    )
                }
            }
        } else {
            console.warn(
                'Warning: Unable to append to the vector layer `' +
                    layerName +
                    '` as the layer contains no features'
            )
            return false
        }
    } else {
        console.warn(
            'Warning: Unable to append to vector layer as it does not exist: ' +
                layerName
        )
        return false
    }
    return true
}

export function updateVectorLayer(L_, layerName, inputData, keepLastN, stopLoops) {
    layerName = L_.asLayerUUID(layerName)

    if (layerName in L_.layers.layer) {
        const layerObj = L_.layers.data[layerName]
        if (L_._layersBeingMade[layerName] === true) {
            console.warn(
                `WARNING - updateVectorLayer: Cannot make layer ${layerObj.display_name}/${layerObj.name} as it's already being made!`
            )
            return false
        }

        const updateLayer = L_.layers.layer[layerName]

        try {
            L_.addGeoJSONData(updateLayer, inputData, keepLastN, stopLoops)
        } catch (e) {
            console.log(e)
            console.warn(
                'Warning: Unable to update vector layer as the layer or input data is invalid: ' +
                    layerName
            )
            return false
        }
        L_.syncSublayerData(layerName)
        L_.globeLithoLayerHelper(L_.layers.layer[layerName])
        L_.setLayerOpacity(layerName, L_.layers.opacity[layerName])
    } else {
        console.warn(
            'Warning: Unable to update vector layer as it does not exist: ' +
                layerName
        )
        return false
    }
    return true
}

export function clearVectorLayerInfo(L_) {
    // Clear the InfoTools data
    const infoTool = ToolController_.getTool('InfoTool')
    if (infoTool && infoTool.hasOwnProperty('clearInfo')) {
        infoTool.clearInfo()
    }

    // Clear the description
    Description.clearDescription()
}

// Limits a Local, Time-Enabled, Prop-set, vector layer to a range of time
// start and end are unix timestamps
export function timeFilterVectorLayer(L_, layerName, start, end) {
    layerName = L_.asLayerUUID(layerName)

    let reset = false
    if (start === false) reset = true

    start = start || 0

    const layerConfig = L_.layers.data[layerName]
    const layer = L_.layers.layer[layerName]

    // A layer holding its own features (_sourceGeoJSON) whose features carry
    // their own time; the type is irrelevant.
    if (
        layerConfig.time.type === 'local' &&
        layerConfig.time.endProp != null &&
        layer != false &&
        layer != null &&
        layer._sourceGeoJSON != null
    ) {
        const filteredGeoJSON = JSON.parse(
            JSON.stringify(
                L_._localTimeFilterCache[layerName] || layer._sourceGeoJSON
            )
        )
        if (L_._localTimeFilterCache[layerName] == null)
            L_._localTimeFilterCache[layerName] = JSON.parse(
                JSON.stringify(filteredGeoJSON)
            )

        if (reset === false) {
            filteredGeoJSON.features = filteredGeoJSON.features.filter(
                (f) => {
                    let startTimeValue = false
                    if (layerConfig.time.startProp)
                        startTimeValue = F_.getIn(
                            f.properties,
                            layerConfig.time.startProp,
                            0
                        )
                    let endTimeValue = false
                    if (layerConfig.time.endProp)
                        endTimeValue = F_.getIn(
                            f.properties,
                            layerConfig.time.endProp,
                            false
                        )

                    // No prop, won't show
                    if (endTimeValue === false) return false

                    if (startTimeValue === false) {
                        //Single Point in time, just compare end times
                        let endDate = new Date(endTimeValue)
                        if (endDate == 'Invalid Date') return false

                        endDate = endDate.getTime()
                        if (endDate <= end && endDate >= start) return true
                        return false
                    } else {
                        // Then we have a range
                        let startDate = new Date(startTimeValue)
                        let endDate = new Date(endTimeValue)

                        // Bad prop value, won't show
                        if (
                            startDate == 'Invalid Date' ||
                            endDate == 'Invalid Date'
                        )
                            return false

                        startDate = startDate.getTime()
                        endDate = endDate.getTime()

                        if (end < startDate) return false
                        if (start > endDate) return false

                        return true
                    }
                }
            )
        }
        // Update layer
        L_.clearVectorLayer(layerName)
        L_.updateVectorLayer(layerName, filteredGeoJSON)
    }
}
