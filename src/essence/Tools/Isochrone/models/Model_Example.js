import Model from "./Model";

class Model_Example extends Model {
    static nameString = "Example";
    static requiredData = ["DEM", "Slope"];

    static costName = "energy use";
    static costUnitSymbol = "Kcal";
    static defaultCost = 5000;
}

export default Model_Example;
