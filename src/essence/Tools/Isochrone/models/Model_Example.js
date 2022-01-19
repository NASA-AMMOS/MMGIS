import Model from "./Model";
import { createDropdown, createInput } from "../ui";

/** Empty model demonstrating the ability of the model interface (multiple data sources, custom options, etc.) */
class Model_Example extends Model {
    static nameString = "Example";
    static requiredData = ["DEM", "Slope"];

    static costName = "energy use";
    static costUnitSymbol = "Kcal";
    static defaultCost = 100;

    static enabledByDefault = false;

    createOptions(root, onChange) {
        createDropdown("Model prop 1", root, ["dropdown"]);
        createInput("Model prop 2", root, "unit", 15);
    }
}

export default Model_Example;
