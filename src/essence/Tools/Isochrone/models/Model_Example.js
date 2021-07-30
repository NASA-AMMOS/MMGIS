import Model from "./Model";
import * as UI from "./ui";

class Model_Example extends Model {
    static nameString = "Example";
    static requiredData = ["DEM", "Slope"];

    static costName = "energy use";
    static costUnitSymbol = "Kcal";
    static defaultCost = 5000;

    createOptions(root) {
        UI.createDropdown("Model prop 1", root, ["dropdown"]);
        UI.createInputWithUnit("Model prop 2", root, "unit", 15);
    }
}

export default Model_Example;
