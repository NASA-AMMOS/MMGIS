import L_ from '../Basics/Layers_/Layers_'
import ToolController_ from '../Basics/ToolController_/ToolController_'
let L = window.L

var mmgisAPI_ = {
    // Exposes Leaflet map object
    map: null,
    // Initialize the map variable
    fina: function (map_) {
        mmgisAPI_.map = map_.map
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
        for (let key in L_.layersGroup) {
            if (L_.layersGroup[key].hasOwnProperty('_layers')) {
                const foundFeatures = findFeaturesInLayer(extent, L_.layersGroup[key])
                features[key] = foundFeatures
            }
        }

        return features;

        function findFeaturesInLayer(extent, layer) {
            let features = []
            const layers = layer.getLayers()

            layers.forEach((layer) => {
                // Use the pixel coordinates instead of latlong as latlong does not work well with polar projections
                const { x: xMapSize, y: yMapSize } = mmgisAPI_.map.getSize()

                const epsilon = 1e-6
                const nw = mmgisAPI_.map.project(extent.getNorthWest())
                const se = mmgisAPI_.map.project(extent.getSouthEast())
                const ne = mmgisAPI_.map.project(extent.getNorthEast())
                const sw = mmgisAPI_.map.project(extent.getSouthWest())

                let _extent
                if (Math.abs((Math.abs(nw.x - se.x) - xMapSize)) < epsilon
                        && Math.abs((Math.abs(nw.y - se.y) - yMapSize)) < epsilon) {
                    _extent = L.bounds(nw, se)
                } else {
                    _extent = L.bounds(ne, sw)
                }

                let found = false
                if ('getBounds' in layer) {
                    const layerBounds = layer.getBounds()
                    const nwLayer = mmgisAPI_.map.project(layerBounds.getNorthEast())
                    const seLayer = mmgisAPI_.map.project(layerBounds.getSouthWest())
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
            activeFeature[infoTool.currentLayerName] = [infoTool.currentLayer.feature] 
            return activeFeature
        }

        return null;
    },
    // Returns an object with the visiblity state of all layers
    getVisibleLayers: function () {
        return L_.toggledArray
    },
    // Adds map event listener
    addEventListener: function (eventName, functionReference) {
        const listener = getLeafletMapEvent(eventName)
        if (listener) {
            console.log('Add listener', listener)
            mmgisAPI_.map.addEventListener(listener, functionReference)
        } else {
            console.warn(
                'Warning: Unable to add event listener for ' +
                    eventName
            )
        }
    },
    // Removes map event listener added using the MMGIS API
    removeEventListener: function (eventName, functionReference) {
        const listener = getLeafletMapEvent(eventName)
        if (listener) {
            console.log('Remove listener', listener)
            mmgisAPI_.map.removeEventListener(listener, functionReference)
        } else {
            console.warn(
                'Warning: Unable to remove event listener for ' +
                    eventName
            )
        }
    },
}

function getLeafletMapEvent(eventName) {
    if (eventName === 'onPan') {
        return 'dragend'
    } else if (eventName === 'onZoom') {
        return 'zoomend'
    } else if (eventName === 'onClick') {
        return 'click'
    }
    return null 
}

export default mmgisAPI_
