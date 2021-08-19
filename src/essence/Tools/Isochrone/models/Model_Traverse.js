import F_ from "../../../Basics/Formulae_/Formulae_";
import Model from "./Model";

const getPx = (arr, px) => arr[px[0]][px[1]];

/** Naive lunar EVA traverse time model, based on Apollo */
class Model_Traverse extends Model {
    static nameString = "Traverse Time";
    static requiredData = ["DEM"];

    static costName = "time";
    static costUnitSymbol = "min";
    static defaultCost = 60;

    static costToString(cost) {
        const roundCost = Math.round(cost);
        const hours = Math.floor(roundCost / 60);
        const mins = roundCost % 60;
        if (hours) {
            const hourString = hours.toString().padStart(2, '0');
            const minString = mins.toString().padStart(2, '0');
            return hourString + ':' + minString;
        } else {
            return mins + 'min';
        }
    }

    costFunction(cPx, tPx, cLatLng, tLatLng) {
        const dist2d = F_.lngLatDistBetween(
            cLatLng.lng,
            cLatLng.lat,
            tLatLng.lng,
            tLatLng.lat
        );
        const distVert = getPx(this.data.DEM, cPx) - getPx(this.data.DEM, tPx);
        const distTotal = Math.sqrt(distVert * distVert + dist2d * dist2d);
        const slope = Math.tan(distVert / dist2d) * (180 / Math.PI);

        //https://dspace.mit.edu/bitstream/handle/1721.1/38526/162623870-MIT.pdf (pg. 73)
        let velocity; // m/s
        if (slope < -15) velocity = 0;
        else if (slope < -10) velocity = 0.095 * slope + 1.95;
        else if (slope < 0) velocity = 0.06 * slope + 1.6;
        else if (slope < 6) velocity = -0.2 * slope + 1.6;
        else if (slope < 15) velocity = -0.039 * slope + 0.634;
        else velocity = 0;

        const result = distTotal / velocity / 60;
        return result;
    }
}

export default Model_Traverse;
