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
     * @param {string} [startTime=00:00:00]
     * @param {string} [endTime=00:00:00]
     * @param {boolean} [isRelative=false] - If true, startTime and endTime are relative to currentTime
     * @returns {boolean} - Whether the time was successfully set
     */
    setTime: TimeControl.setTime,

    /** setTime calls this (among other things) but it can be called individually as needed too
     * @param {string} [layerName]
     * @param {string} [startTime=00:00:00]
     * @param {string} [endTime=00:00:00]
     * @param {boolean} [isRelative=false] - If true, startTime and endTime are relative to currentTime
     * @returns {boolean} - Whether the time was successfully set
     */
    setLayerTime: TimeControl.setLayerTime,
    
    /** Like the individual nature of setLayerTime, this sets a drawing file's time
     * @param {string} [fileId]
     * @param {string} [endTime=00:00:00]
     */
    // setDrawingTime: TimeControl.setDrawingTime

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
}

window.API = API

export default API
