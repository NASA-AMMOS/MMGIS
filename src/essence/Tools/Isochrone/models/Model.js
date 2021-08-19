/** Class representing a model of resource expenditure (time, power, etc.) on a traverse */
export default class Model {
    /** Name of this model, as it will appear in the model selection dropdown */
    static nameString = 'Model';

    /** Names of all data types required for this model (e.g. "DEM", "Slope", "Cost") */
    static requiredData = ['DEM'];
    
    /** Name of the resource this class models, as it will appear in the name of the "max cost" option */
    static costName = 'distance';

    /** Units of the resource this class models, as it will appear in the "max cost" option */
    static costUnitSymbol = 'm';

    /** Default setting of the "max cost" option */
    static defaultCost = 1000;

    /** Determines whether this model is available by default (if "models" property is not set in the tool configuration) */
    static enabledByDefault = true;

    /**
     * Converts a cost value produced by this model to a human-readable string.
     * Override to specify how this model's costs are displayed (e.g. hh:mm:ss for time models)
     * @param {number} cost Cost to convert to string
     * @returns {string} `cost` as a properly-formatted string
     */
    static costToString(cost) {
        return cost.toFixed(1) + this.costUnitSymbol;
    }

    constructor() {
        /**
         * Will be filled before costFunction is run with 2D data arrays for all keys listed in `requiredData`, e.g.:
         * `{ "DEM": Float32Array[], "Slope": Float32Array[] }`.
         * All data arrays are guaranteed to be the same size and to represent the same area of the map.
         */
        this.data = {};
    }

    /**
     * Called to set or update data. Override to perform custom preprocessing on all new input data.
     * @param {Object} data Object containing data arrays
     */
    setData(data) {
        this.data = data;
    }

    /**
     * Compute the cost of moving from a "current" pixel to a "target" pixel, based on data from `this.data`.
     * This is the core of a model and must be overridden to produce a new and useful model.
     * @param {number[]} cPx Index tuple [y, x] for the current pixel
     * @param {number[]} tPx Index tuple [y, x] for the target pixel
     * @param {L.LatLng} cLatLng Lat/long position of the current pixel
     * @param {L.LatLng} tLatLng Lat/long position of the target pixel
     * @returns {number} Cost of moving from `cPx` to `tPx`.
     */
    costFunction(cPx, tPx, cLatLng, tLatLng) {
        return 10;
    }

    /**
     * Create a custom interface in the left toolbar for modifying model-specific options
     * @param {Element} root The root element within which to build the UI
     * @param {(action: number) => void} onChange Function to signal the manager to update when a parameter changes. Accepts an action number (see `IsochroneManager._handleInput`)
     */
    createOptions(root, onChange) {}
}
