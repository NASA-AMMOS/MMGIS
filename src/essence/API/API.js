import L_ from '../Basics/Layers_/Layers_'

var API = {
    /**
     * Clears a layer with a specified name
     * @param {string} - layerName - name of layer to clear
     */
    clearVectorLayer: L_.clearVectorLayer,
    /**
     * Updates a specified layer with GeoJSON data
     * @param {string} - layerName - name of layer to clear
     * @param {GeoJSON} - inputData - valid GeoJSON data
     * @param {number} - keepN - number of features to keep. A value less than or equal to 0 keeps all previous features
     */
    updateVectorLayer: L_.updateVectorLayer,
}

window.API = API

export default API
