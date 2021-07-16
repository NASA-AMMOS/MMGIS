import F_ from "../../../Basics/Formulae_/Formulae_";
import * as D from "../IsochroneTool_Util";
import $ from "jquery";
import Model from "./Model";

//Terrible no-good very bad JQuery element creators
        
const addOption = (title, root) =>
    $(`<div><div>${title}</div></div>`).appendTo(root);

const addSection = (title, root) => {
    $(`<div class="sectionhead">${title}</div>`).appendTo(root);
    return $(`<section></section>`).appendTo(root);
}

function createInputWithUnit(title, root, unit, value, attr = "") {
    const innerContainer = $(`<div class="flexbetween"></div>`)
        .appendTo(addOption(title, root));
    const el = $( `<input type="number" ${attr} value="${value}">`)
        .appendTo(innerContainer);
    $(`<div class="unit">${unit}</div>`).appendTo(innerContainer);
    return el;
}

class Model_Isodistance {
    static nameString = "Isodistance";
    static requiredData = [
        "DEM"
    ];

    static costName = "distance";
    static costUnitSymbol = "m";
    static defaultCost = 100;

    constructor() {
        this.data = null;
        this.terrainScale = 2;
    }

    costFunction = (cPx, cLatLng, tPx, tLatLng) => {
        const dist2d = F_.lngLatDistBetween(
            cLatLng.lng,
            cLatLng.lat,
            tLatLng.lng,
            tLatLng.lat
        );
        const cEl = D.getPx(this.data.DEM, cPx);
        const tEl = D.getPx(this.data.DEM, tPx);
        const vDist = (cEl - tEl);
        return Math.sqrt(vDist * vDist + dist2d * dist2d);
    }

    createOptions(root, onChange) {
        createInputWithUnit(
            "Terrain scale",
            root,
            "X",
            1,
            `min="1" default ="1" step="0.2"`
        ).on("change", e => {
            this.terrainScale = e.value;
            //onChange(e, 2);
        });
    }
}

export default Model_Isodistance;