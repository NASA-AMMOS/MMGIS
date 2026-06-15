import F_ from "../../../Basics/Formulae_/Formulae_";
import Model from "./Model";
import { createInput } from "../ui";

const getPx = (arr, px) => arr[px[0]][px[1]];

/** Terrain-aware distance model, with scale option to emphasize or ignore terrain */
class Model_Isodistance extends Model {
    static nameString = "Isodistance";
    static requiredData = ["DEM"];
    static defaultCost = 5000;

    constructor() {
        super();
        this.terrainScale = 1;
    }

    costFunction(cPx, tPx, cLatLng, tLatLng) {
        const dist2d = F_.lngLatDistBetween(
            cLatLng.lng,
            cLatLng.lat,
            tLatLng.lng,
            tLatLng.lat
        );
        const cEl = getPx(this.data.DEM, cPx);
        const tEl = getPx(this.data.DEM, tPx);
        const vDist = (cEl - tEl) * this.terrainScale;
        const result = Math.sqrt(vDist * vDist + dist2d * dist2d);
        return result;
    }

    createOptions(root, onChange) {
        createInput(
            "Terrain scale",
            root,
            "X",
            1,
            `min="0" default="1" step="0.2"`
        ).on("change", e => {
            this.terrainScale = parseFloat(e.target.value);
            onChange(2);
        });
    }
}

export default Model_Isodistance;
