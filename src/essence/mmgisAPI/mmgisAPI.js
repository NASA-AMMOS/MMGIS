import L_ from '../Basics/Layers_/Layers_'
import F_ from '../Basics/Formulae_/Formulae_'
import ToolController_ from '../Basics/ToolController_/ToolController_'
import QueryURL from '../Ancillary/QueryURL'
import TimeControl from '../Ancillary/TimeControl'
import Login from '../Ancillary/Login/Login'
import LegendTool from '../Tools/Legend/LegendTool.js'

import $ from 'jquery'

let L = window.L

var mmgisAPI_ = {
    // Exposes Leaflet map object
    map: null,
    // Initialize the map variable
    fina: function (map_) {
        mmgisAPI_.map = map_.map
        mmgisAPI.map = map_.map
        if (typeof mmgisAPI_.onLoadCallback === 'function') {
            mmgisAPI_.onLoadCallback()
            mmgisAPI_.onLoadCallback = null
        }
    },
    setConfiguration: function (configuration) {
        if (window.mmgisglobal.setConfiguration)
            window.mmgisglobal.setConfiguration(configuration)
    },
    // Adds a layer to the map. For a more "temporary" layer, use Leaflet directly through `mmgisAPI.map`
    addLayer: function (layerObj, placement) {
        return new Promise(async (resolve, reject) => {
            if (layerObj == null) {
                reject('Missing parameter: layerObj')
                return
            }
            if (layerObj.name == null) {
                reject('Missing parameter: layerObj.name')
                return
            }
            if (layerObj.type == null) {
                reject('Missing parameter: layerObj.type')
                return
            }

            if (
                (layerObj.uuid || layerObj.name) &&
                L_.layers.data[layerObj.uuid || layerObj.name] != null
            ) {
                reject(
                    `Layer uuid/name already in use: '${
                        layerObj.uuid || layerObj.name
                    }'`
                )
            }

            // Inject new layer into configData
            let placementPath = placement?.path
            let placementIndex = placement?.index

            const configData = JSON.parse(JSON.stringify(L_.configData))

            if (placementPath && typeof placementPath === 'string') {
                placementPath = placementPath
                    .split('.')
                    .map((p) => {
                        return L_.asLayerUUID(p)
                    })
                    .join('.')
                placementPath = placementPath
                    .replace(/\./g, '.sublayers.')
                    .split('.')
                    .concat('sublayers')
                    .join('.')

                const level = F_.getIn4Layers(
                    configData.layers,
                    placementPath,
                    null,
                    true
                )
                if (level == null) {
                    reject(
                        `Path specified in 'placement.path' not found in 'layers': ${placementPath}.`
                    )
                    return
                }
                if (placementIndex == null) placementIndex = level.length
                placementIndex = Math.max(
                    0,
                    Math.min(placementIndex, level.length)
                )

                placementPath += '.'
            } else {
                placementPath = ''
                if (placementIndex == null)
                    placementIndex = configData.layers.length
                placementIndex = Math.max(
                    0,
                    Math.min(placementIndex, configData.layers.length)
                )
            }

            const didSet = F_.setIn4Layers(
                configData.layers,
                `${placementPath}${placementIndex}`,
                layerObj,
                true,
                true
            )

            // Then add
            if (didSet)
                await L_.modifyLayer(configData, layerObj.name, 'addLayer')
            else {
                reject('Failed to add layer.')
                return
            }
            resolve()
        })
    },
    removeLayer: function (layerUUID) {
        const configData = JSON.parse(JSON.stringify(L_.configData))

        layerUUID = L_.asLayerUUID(layerUUID)
        let didRemove = false
        F_.traverseLayers(configData.layers, (layer, path, index) => {
            if (layer.uuid === layerUUID) {
                didRemove = true
                return 'remove'
            }
        })
        if (didRemove) {
            L_.modifyLayer(configData, layerUUID, 'removeLayer')
            return true
        }
        return false
    },
    // Returns an array of all features in a given extent
    featuresContained: function () {
        if (!mmgisAPI_.map) {
            console.warn(
                'Warning: Unable to find features contained as the Leaflet map object is not initialized'
            )
        }

        const extent = mmgisAPI_.map.getBounds()
        let features = {}

        // For all MMGIS layers
        for (let key in L_.layers.layer) {
            if (L_.layers.layer[key] === false || L_.layers.layer[key] == null)
                continue

            if (L_.layers.layer[key].hasOwnProperty('_layers')) {
                // For normal layers
                const foundFeatures = findFeaturesInLayer(
                    extent,
                    L_.layers.layer[key]
                )
                features[key] = foundFeatures
            } else if (
                key.startsWith('DrawTool_') &&
                Array.isArray(L_.layers.layer[key])
            ) {
                // If layer is a DrawTool array of layers
                for (let layer in L_.layers.layer[key]) {
                    let foundFeatures
                    if (layer && L_.layers.layer[key][layer]) {
                        if ('getLayers' in L_.layers.layer[key][layer]) {
                            if (
                                L_.layers.layer[key][layer]?.feature?.properties
                                    ?.arrow
                            ) {
                                // If the DrawTool sublayer is an arrow
                                foundFeatures = findFeaturesInLayer(
                                    extent,
                                    L_.layers.layer[key][layer]
                                )

                                // As long as one of the layers of the arrow layer is in the current Map bounds,
                                // return the parent arrow layer's feature
                                if (foundFeatures && foundFeatures.length > 0) {
                                    foundFeatures =
                                        L_.layers.layer[key][layer].feature
                                }
                            } else {
                                // If the DrawTool sublayer is Polygon or Line
                                foundFeatures = findFeaturesInLayer(
                                    extent,
                                    L_.layers.layer[key][layer]
                                )
                            }
                        } else if ('getLatLng' in L_.layers.layer[key][layer]) {
                            // If the DrawTool sublayer is a Point
                            if (isLayerInBounds(L_.layers.layer[key][layer])) {
                                foundFeatures = [
                                    L_.layers.layer[key][layer].feature,
                                ]
                            }
                        }
                    }

                    if (foundFeatures) {
                        features[key] =
                            key in features
                                ? features[key].concat(foundFeatures)
                                : foundFeatures
                    }
                }
            }
        }

        return features

        function isLayerInBounds(layer) {
            // Use the pixel coordinates instead of latlong as latlong does not work well with polar projections
            const { x: xMapSize, y: yMapSize } = mmgisAPI_.map.getSize()

            const epsilon = 1e-6
            const nw = mmgisAPI_.map.project(extent.getNorthWest())
            const se = mmgisAPI_.map.project(extent.getSouthEast())
            const ne = mmgisAPI_.map.project(extent.getNorthEast())
            const sw = mmgisAPI_.map.project(extent.getSouthWest())

            let _extent
            if (
                Math.abs(Math.abs(nw.x - se.x) - xMapSize) < epsilon &&
                Math.abs(Math.abs(nw.y - se.y) - yMapSize) < epsilon
            ) {
                _extent = L.bounds(nw, se)
            } else {
                _extent = L.bounds(ne, sw)
            }

            let found = false
            if ('getBounds' in layer) {
                const layerBounds = layer.getBounds()
                const nwLayer = mmgisAPI_.map.project(
                    layerBounds.getNorthEast()
                )
                const seLayer = mmgisAPI_.map.project(
                    layerBounds.getSouthWest()
                )
                const _bounds = L.bounds(nwLayer, seLayer)

                if (_extent.intersects(_bounds)) {
                    found = true
                }
            } else if ('getLatLng' in layer) {
                const _latLng = mmgisAPI_.map.project(layer.getLatLng())

                if (_extent.contains(_latLng)) {
                    found = true
                }
            }

            return found
        }

        function findFeaturesInLayer(extent, layer) {
            let features = []
            const layers = layer.getLayers()

            layers.forEach((layer) => {
                const found = isLayerInBounds(layer)

                if (found) {
                    features.push(layer.feature)
                }
            })

            return features
        }
    },
    // Returns the currently active feature (i.e. feature thats clicked and displayed in the InfoTool)
    getActiveFeature: function () {
        const infoTool = ToolController_.getTool('InfoTool')

        if (infoTool.currentLayer && infoTool.currentLayer.feature) {
            const activeFeature = {}
            activeFeature[infoTool.currentLayerName] = [
                infoTool.currentLayer.feature,
            ]
            return activeFeature
        }

        return null
    },
    selectFeature: function (layerUUID, options) {
        return L_.selectPoint({
            ...{
                layerUUID: layerUUID,
            },
            ...options,
        })
    },
    getActiveTool: function () {
        if (ToolController_) {
            return {
                activeTool: ToolController_.activeTool,
                activeToolName: ToolController_.activeToolName,
            }
        }
        return null
    },
    getActiveTools: function () {
        if (ToolController_) {
            const activeTool = mmgisAPI_.getActiveTool()
            return {
                activeToolNames: [ToolController_.activeToolName]
                    .concat(ToolController_.activeSeparatedTools)
                    .filter(Boolean),
                activeTools: [activeTool.activeTool != null ? activeTool : null]
                    .concat(
                        ToolController_.activeSeparatedTools.map((a) => {
                            return {
                                activeTool: ToolController_.getTool(a),
                                activeToolName: a,
                            }
                        })
                    )
                    .filter(Boolean),
            }
        }
        return null
    },
    getLayerConfigs: function (match) {
        if (match) {
            const matchedLayers = {}
            Object.keys(L_.layers.data).forEach((name) => {
                const layer = L_.layers.data[name]
                let matched = false
                Object.keys(match).forEach((key) => {
                    const value = F_.getIn(layer, key)
                    if (typeof value === 'string' && match[key] === value)
                        matched = true
                    else if (Array.isArray(value) && value.includes(match[key]))
                        matched = true
                })

                if (matched)
                    matchedLayers[name] = JSON.parse(JSON.stringify(layer))
            })
            return matchedLayers
        } else return L_.layers.data
    },
    getLayers: function () {
        return L_.layers.layer
    },
    // Returns an object with the visibility state of all layers
    getVisibleLayers: function () {
        // Also return the visibility of the DrawTool layers
        var drawToolVisibility = {}
        for (let l in L_.layers.layer) {
            if (!(l in L_.layers.on)) {
                var s = l.split('_')
                var onId = s[1] != 'master' ? parseInt(s[1]) : s[1]
                if (s[0] == 'DrawTool') {
                    drawToolVisibility[l] =
                        ToolController_.getTool('DrawTool').filesOn.indexOf(
                            onId
                        ) != -1
                }
            }
        }

        return { ...L_.layers.on, ...drawToolVisibility }
    },
    //customListeners: {},
    // Adds map event listener
    addEventListener: function (eventName, functionReference) {
        const listener = mmgisAPI_.getLeafletMapEvent(eventName)
        const mmgisListener = mmgisAPI_.checkMMGISEvent(eventName)
        if (listener) {
            mmgisAPI_.map.addEventListener(listener, functionReference)
        } else if (mmgisListener) {
            document.addEventListener(eventName, functionReference)
        } else {
            //mmgisAPI_.customListeners[eventName] = mmgisAPI_.customListeners[eventName] || []
            //mmgisAPI_.customListeners[eventName].push(functionReference)
            console.warn(
                'Warning: Unable to add event listener for ' + eventName
            )
        }
    },
    // Removes map event listener added using the MMGIS API
    removeEventListener: function (eventName, functionReference) {
        const listener = mmgisAPI_.getLeafletMapEvent(eventName)
        const mmgisListener = mmgisAPI_.checkMMGISEvent(eventName)
        if (listener) {
            console.log('Remove listener:', listener)
            mmgisAPI_.map.removeEventListener(listener, functionReference)
        } else if (mmgisListener) {
            console.log('Remove listener', eventName)
            document.removeEventListener(eventName, functionReference)
        } else {
            //if(mmgisAPI_.customListeners[eventName]) {
            //    mmgisAPI_.customListeners[eventName] = mmgisAPI_.customListeners[eventName].filter(f => f !== functionReference)
            //}
            console.warn(
                'Warning: Unable to remove event listener for ' + eventName
            )
        }
    },
    getLeafletMapEvent: function (eventName) {
        if (eventName === 'onPan') {
            return 'dragend'
        } else if (eventName === 'onZoom') {
            return 'zoomend'
        } else if (eventName === 'onClick') {
            return 'click'
        }
        return null
    },
    checkMMGISEvent: function (eventName) {
        const validEvents = [
            'toolChange',
            'layerVisibilityChange',
            'websocketChange',
            'toggleSeparatedTool',
        ]
        return validEvents.includes(eventName)
    },
    writeCoordinateURL: function () {
        return QueryURL.writeCoordinateURL(false)
    },
    onLoadCallback: null,
    onLoaded: function (onLoadCallback) {
        mmgisAPI_.onLoadCallback = onLoadCallback
    },
    // Convert {lng: , lat:} to x, y
    project: function (lnglat) {
        return window.mmgisglobal.customCRS.project(lnglat)
    },
    // Convert {x: , y: } to lng, lat
    unproject: function (xy) {
        return window.mmgisglobal.customCRS.unproject(xy)
    },
    toggleLayer: async function (layerName, on) {
        if (layerName in L_.layers.data) {
            if (on === undefined || on === null) {
                // If on is not defined, switch the visibility state of the layer
                await L_.toggleLayer(L_.layers.data[layerName])
            } else {
                let state = !on
                await L_.toggleLayerHelper(L_.layers.data[layerName], state)
            }

            if (ToolController_.activeToolName === 'LayersTool') {
                const id = `#layerstart${F_.getSafeName(layerName)} .checkbox`

                if (L_.layers.on[layerName]) {
                    $(id).addClass('on')
                } else {
                    $(id).removeClass('on')
                }
            }
        } else {
            console.warn(`'Warning: Unable to find layer named ${layerName}`)
            return
        }
    },
}

var mmgisAPI = {
    /**
     * Sets a new configuration object for MMGIS to use
     * @param {object} configurationObj - The new configuration JSON object (what the configuration CMS creates)
     */
    setConfiguration: mmgisAPI_.setConfiguration,
    /**
     * Adds a layer to the map. For a more "temporary" layer, use Leaflet directly through `mmgisAPI.map`
     * @param {object} layerObj - See schema in configData
     * @param {object} placement - Position to place layer relative to other layers - {path: , index: }
     * @returns {Promise}
     */
    addLayer: mmgisAPI_.addLayer,
    /**
     * Removes a layer from the map.
     * @params {string} layerUUID - layer name/uuid to remove
     * @returns {boolean} - true if found and removed, otherwise false
     */
    removeLayer: mmgisAPI_.removeLayer,
    /**
     * Clears a layer with a specified name
     * @param {string} - layerName - name of layer to clear
     */
    clearVectorLayer: L_.clearVectorLayer,
    /**
     * Updates a specified layer with GeoJSON data
     * @param {string} - layerName - name of layer to update
     * @param {GeoJSON} - inputData - valid GeoJSON data
     */
    updateVectorLayer: L_.updateVectorLayer,
    /**
     * Remove features on a specified layer before a specified time
     * @param {string} - layerName - name of layer to update
     * @param {string} - keepAfterTime - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; will keep all features after this time
     * @param {number} - timePropPath - name of time property to compare with the time specified by keepAfterTime
     */
    trimVectorLayerKeepAfterTime: L_.trimVectorLayerKeepAfterTime,
    /**
     * Remove features on a specified layer after a specified time
     * @param {string} - layerName - name of layer to update
     * @param {string} - keepBeforeTime - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; will keep all features before this time
     * @param {number} - timePropPath - name of time property to compare with the time specified by keepAfterTime
     */
    trimVectorLayerKeepBeforeTime: L_.trimVectorLayerKeepBeforeTime,
    /**
     * Number of features to keep on a specified layer. Keeps from the tail end of the feature list.
     * @param {string} - layerName - name of layer to update
     * @param {keepLastN} - keepN - number of features to keep from the tail end of the feature list. A value less than or equal to 0 keeps all previous features
     */
    keepLastN: L_.keepLastN,
    /**
     * Number of features to keep on a specified layer. Keeps features from the beginning of the feature list.
     * @param {string} - layerName - name of layer to update
     * @param {keepFirstN} - keepN - number of features to keep from the beginning of the feature list. A value less than or equal to 0 keeps all previous features
     */
    keepFirstN: L_.keepFirstN,
    /**
     * This function is used to trim a specified number of vertices on a specified layer containing GeoJson LineString features.
     * @param {string} - layerName - name of layer to update
     * @param {string} - time - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; represents start time if trimming from the beginning, otherwise represents the end time
     * @param {number} - trimN - number of vertices to trim
     * @param {string} - startOrEnd - direction to trim from; value can only be one of the following options: start, end
     */
    trimLineString: L_.trimLineString,
    /**
     * This function is used to append new LineString data to the last feature (with LineString geometry) in a layer
     * @param {string} - layerName - name of layer to update
     * @param {object} - inputData - a GeoJson Feature object containing geometry that is a LineString
     * @param {string} - timeProp - name of time property in each feature in the layer and in the inputData
     */
    appendLineString: L_.appendLineString,

    // Time Control API functions

    /**
     * This function toggles the visibility of ancillary Time Control User Interface.
     * It is useful in situations where time functions are controlled by an external application.
     * @param {boolean} - Whether to turn the TimeUI on or off. If true, makes visible.
     * @returns {boolean} - Whether the TimeUI is now on or off
     */
    toggleTimeUI: TimeControl.toggleTimeUI,

    /**
     * This function sets the global time properties for all of MMGIS.
     * All time enabled layers that are configured to use the `Global` time type will be updated by this function.
     * @param {string} [startTime] - Can be either YYYY-MM-DDThh:mm:ssZ if absolute or hh:mm:ss or seconds if relative
     * @param {string} [endTime] - Can be either YYYY-MM-DDThh:mm:ssZ if absolute or hh:mm:ss or seconds if relative
     * @param {boolean} [isRelative=false] - If true, startTime and endTime are relative to currentTime
     * @param {string} [timeOffset=0] - Offset of currentTime; Can be either hh:mm:ss or seconds
     * @returns {boolean} - Whether the time was successfully set
     */
    setTime: TimeControl.setTime,

    /** This function sets the start and end time for a single layer.
     * It will override the global time for that layer.
     * @param {string} [layerName]
     * @param {string} [startTime] - YYYY-MM-DDThh:mm:ssZ
     * @param {string} [endTime] - YYYY-MM-DDThh:mm:ssZ
     * @returns {boolean} - Whether the time was successfully set
     */
    setLayerTime: TimeControl.setLayerTime,

    /**
     * @returns {string} - The current time on the map with offset included
     */
    getTime: TimeControl.getTime,

    /**
     * @returns {string} - The start time on the map with offset included
     */
    getStartTime: TimeControl.getStartTime,

    /**
     * @returns {string} - The end time on the map with offset included
     */
    getEndTime: TimeControl.getEndTime,

    /**
     * @param {string} [layerName]
     * @returns {string} - The start time for an individual layer
     */
    getLayerStartTime: TimeControl.getLayerStartTime,

    /**
     * @param {string} [layerName]
     * @returns {string} - The end time for an individual layer
     */
    getLayerEndTime: TimeControl.getLayerEndTime,

    /** reloadTimeLayers will reload every time enabled layer
     * @returns {array} - A list of layers that were reloaded
     */
    reloadTimeLayers: TimeControl.reloadTimeLayers,

    /** reloadLayer will reload a given time enabled layer
     * @param {string} [layerName]
     * @returns {boolean} - Whether the layer was successfully reloaded
     */
    reloadLayer: TimeControl.reloadLayer,

    /** Sets layer UUIDs and layer Names to UUIDs
     * @param {string} [uuid]
     * @returns {string} - Best UUID, else null
     */
    asLayerUUID: L_.asLayerUUID,

    /** setLayersTimeStatus - will set the status color for all global time enabled layers
     * @param {string} [color]
     * @returns {array} - A list of layers that were set
     */
    setLayersTimeStatus: TimeControl.setLayersTimeStatus,

    /** setLayerTimeStatus - will set the status color for the given layer
     * @param {string} [layerName]
     * @param {string} [color]
     * @returns {boolean} - True if time status was successfully set
     */
    setLayerTimeStatus: TimeControl.setLayerTimeStatus,

    /** updateLayersTime - will synchronize every global time enabled layer with global times.
     * Probably should be a private function, but could be useful for edge cases when things
     * may need to be re-synchronized.
     * @returns {array} - A list of layers that were reloaded
     */
    updateLayersTime: TimeControl.updateLayersTime,

    /** map - exposes Leaflet map object.
     * @returns {object} - The Leaflet map object
     */
    map: null,

    /** featuresContained - returns an array of all features in the current map view.
     * @returns {object} - An object containing layer names as keys and values as arrays with all features (as GeoJson Feature objects) contained in the current map view
     */
    featuresContained: mmgisAPI_.featuresContained,

    /** getActiveFeature - returns the currently active feature (i.e. feature thats clicked and displayed in the InfoTool)
     * @returns {object} - The currently selected active feature as an object with the layer name as key and value as an array containing the GeoJson Feature object (MMGIS only allows the section of a single feature).
     */
    getActiveFeature: mmgisAPI_.getActiveFeature,

    /** Selects a feature based on latlng, key:value, or layerId
     * @param {string} [layerName]
     * @param {object} [options]
     * options: {
        lat: num,
        lon: num,
        ||
        key: 'props.dot.notation',
        value: '',
        ||
        layerId: num,

        view: 'go' || null,
        zoom: 'zoomLevel' || 'map_scale_if_view_is_go',
        }
     *
     * @returns {boolean} - true if found and selected a feature, otherwise false
     */
    selectFeature: mmgisAPI_.selectFeature,

    /** getActiveTool - returns the currently active tool
     * @returns {object} - The currently active tool and the name of the active tool as an object.
     */
    getActiveTool: mmgisAPI_.getActiveTool,

    /** getActiveTools - returns the currently active tool
     * @returns {object} - The currently active tool and the name of the active tool as an object.
     */
    getActiveTools: mmgisAPI_.getActiveTools,

    /** getLayerConfigs - returns an object with the visibility state of all layers
     * @returns {object} - an object containing the visibility state of each layer
     */
    getLayerConfigs: mmgisAPI_.getLayerConfigs,
    /** getLayers - returns an object with the visibility state of all layers
     * @returns {object} - an object containing the visibility state of each layer
     */
    getLayers: mmgisAPI_.getLayers,

    /** getVisibleLayers - returns an object with the visibility state of all layers
     * @returns {object} - an object containing the visibility state of each layer
     */
    getVisibleLayers: mmgisAPI_.getVisibleLayers,

    /** addEventListener - adds map event or MMGIS action listener.
     * @param {string} - eventName - name of event to add listener to. Available events: onPan, onZoom, onClick, toolChange, layerVisibilityChange, toggleSeparatedTool

     * @param {function} - functionReference - function reference to listener event callback function. null value removes all functions for a given eventName

     */
    addEventListener: mmgisAPI_.addEventListener,

    /** removeEventListener - removes map event or MMGIS action listener added using the MMGIS API.
     * @param {string} - eventName - name of event to add listener to. Available events: onPan, onZoom, onClick, toolChange, layerVisibilityChange, toggleSeparatedTool
     * @param {function} - functionReference - function reference to listener event callback function. null value removes all functions for a given eventName
     */
    removeEventListener: mmgisAPI_.removeEventListener,

    /** writeCoordinateURL - writes out the current view as a url. This returns the long form of
     * the 'Copy Link' feature and does not save a short url to the database.
     * @returns {string} - a string containing the current view as a url
     */
    writeCoordinateURL: mmgisAPI_.writeCoordinateURL,

    /** onLoaded - calls onLoadCallback as a function once MMGIS has finished loading.
     * @param {function} - onLoadCallback - function reference to function that is called when MMGIS is finished loading
     */
    onLoaded: mmgisAPI_.onLoaded,

    /** initialLogin: performs the initial login call to relogin returning users. Pairable with the ENV `SKIP_CLIENT_INITIAL_LOGIN=`.
     */
    initialLogin: Login.initialLogin,

    /** project - converts a lnglat into xy coordinates with the current (custom or default web mercator) proj4 definition
     * @param {object} {lng: 0, lat: 0} - lnglat to convert
     * @returns {object} {x: 0, y: 0} - converted easting northing xy
     */
    project: mmgisAPI_.project,

    /** unproject - converts an xy into lnglat coordinates with the current (custom or default web mercator) proj4 definition
     * @returns {object} {x: 0, y: 0} - easting northing xy to convert
     * @param {object} {lng: 0, lat: 0} - converted lnglat
     */
    unproject: mmgisAPI_.unproject,

    /** toggleLayer - set the visibility state for a named layer
     * @param {string} - layerName - name of layer to set visibility
     * @param {boolean} - on - (optional) Set true if the visibility should be on or false if visibility should be off. If not set, the current visibility state will switch to the opposite state.
     */
    toggleLayer: mmgisAPI_.toggleLayer,

    /** overwriteLegends - overwrite the contents displayed in the LegendTool; useful when used with `toggleSeparatedTool` event listener in mmgisAPI
     * @param {array} - legends - an array of objects, where each object must contain the following keys: legend, layerUUID, display_name, opacity. The value for the legend key should be in the same format as what is stored in the layers data under the `_legend` key (i.e. `L_.layers.data[layerName]._legend`). layerUUID and display_name should be strings and opacity should be a number between 0 and 1.
     */
    overwriteLegends: LegendTool.overwriteLegends,

    // Formulae_
    utils: { ...F_ },
}

window.mmgisAPI = mmgisAPI

export { mmgisAPI_, mmgisAPI }
