export default class Model {
    static nameString = "Model";
    static requiredData = [];
    
    static costName = "distance";
    static costUnitSymbol = "m";
    static defaultCost = 100;

    constructor() {
        this.data = null;
    }

    costFunction = (cPx, cLatLng, tPx, tLatLng) => 1;

    createOptions() {}
}