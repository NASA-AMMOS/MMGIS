import L_ from '../Basics/Layers_/Layers_'
import TimeControl from '../Ancillary/TimeControl'

var API = {
    /**
     * Clears a layer with a specified name
     * @param {string} - layerName - name of layer to clear
     */
    clearVectorLayer: L_.clearVectorLayer,
    /**
     * Updates a specified layer with GeoJSON data
     * @param {string} - layerName - name of layer to update
     * @param {GeoJSON} - inputData - valid GeoJSON data
     * @param {number} - keepN - number of features to keep. A value less than or equal to 0 keeps all previous features
     */
    updateVectorLayer: L_.updateVectorLayer,

    // Time Control API functions

    /**
     * Toggles the TimeUI -- a TimeConductor-like MMGIS implementation to stand alone and for dev work
     * @param {boolean} - Whether to turn the TimeUI on or off. If unset, flips state.
     * @returns {boolean} - Whether the TimeUI is now on or off
     */
    toggleTimeUI: TimeControl.toggleTimeUI,

    /**
     * Sets the global time for MMGIS. All layers influenced by time (i.e. a
     *  raster with '{t} | {time} | {end_time}' in its url, a vector layer pointing to
     *  'https://lunarsev/getLayer?start_time={start_time}&end_time={end_time}') get
     *  updated accordingly
     * @param {string} [startTime] - Can be either YYYY-MM-DDThh:mm:ssZ if absolute or hh:mm:ss or seconds if relative
     * @param {string} [endTime] - Can be either YYYY-MM-DDThh:mm:ssZ if absolute or hh:mm:ss or seconds if relative
     * @param {boolean} [isRelative=false] - If true, startTime and endTime are relative to currentTime
     * @param {string} [timeOffset=0] - Offset of currentTime; Can be either hh:mm:ss or seconds
     * @returns {boolean} - Whether the time was successfully set
     */
    setTime: TimeControl.setTime,

    /** Sets the start and end time for a single layer; overrides global time for that layer
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
     * @returns {string} - The start time for an individual layer
     */   
    getLayerStartTime: TimeControl.getLayerStartTime,
 
    /** 
     * @returns {string} - The end time for an individual layer
     */  
    getLayerEndTime: TimeControl.getLayerEndTime,

    /** reloadLayer will reload a given layer
     * @param {string} [layerName]
     * @returns {boolean} - Whether the layer was successfully reloaded
     */
    reloadLayer: TimeControl.reloadLayer,

    /** reloadTimeLayers will reload every time enabled layer
     * @returns {array} - A list of layers that were reloaded
     */
    reloadTimeLayers: TimeControl.reloadTimeLayers,

    /** updateLayersTime - will synchronize every global time enabled layer with global times
     * @returns {array} - A list of layers that were reloaded
     */
     updateLayersTime: TimeControl.updateLayersTime

}

window.API = API

export default API
