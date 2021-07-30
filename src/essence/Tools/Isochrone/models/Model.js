export default class Model {
    static nameString = "Model";
    static requiredData = [];
    
    static costName = "distance";
    static costUnitSymbol = "m";
    static defaultCost = 1000;

    constructor() {
        this.data = {};
    }

    costFunction = (cPx, cLatLng, tPx, tLatLng) => 1;

    createOptions() {}
}
