import F_ from "../../../Basics/Formulae_/Formulae_";
import { getPx } from "../IsochroneTool_Util";
import Model from "./Model";

class Model_Traverse extends Model {
    static nameString = "Traverse Time";
    static requiredData = ["DEM"];

    static costName = "time";
    static costUnitSymbol = "min";
    static defaultCost = 60;

    costFunction = (cPx, cLatLng, tPx, tLatLng) => {
        const dist2d = F_.lngLatDistBetween(
            cLatLng.lng,
            cLatLng.lat,
            tLatLng.lng,
            tLatLng.lat
        );
        const distVert = getPx(this.data.DEM, cPx) - getPx(this.data.DEM, tPx);
        const distTotal = Math.sqrt(distVert * distVert + dist2d * dist2d);
        const slope = Math.tan(distVert / dist2d) * (180 / Math.PI);

        let velocity; // m/s
        if(slope < -15) velocity = 0;
        else if(slope < -10) velocity = 0.095 * slope + 1.95;
        else if(slope < 0) velocity = 0.06 * slope + 1.6;
        else if(slope < 6) velocity = -0.2 * slope + 1.6;
        else if(slope < 15) velocity = -0.039 * slope + 0.634;
        else velocity = 0;

        const result = distTotal / velocity / 60;
        return result;
    }
}

export default Model_Traverse;
