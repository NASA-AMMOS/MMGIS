import $ from "jquery";

import models from "./models";
import * as IsochroneTool_Algorithm from "./IsochroneTool_Algorithm";
import Map_ from '../../Basics/Map_/Map_';
import * as U from "./IsochroneTool_Util";
import F_ from '../../Basics/Formulae_/Formulae_';


import QueryJob from "./IsochroneTool_Query";

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

function createDropdown(title, root, options = []) {
    let el = $(`<select class="dropdown"></select>`)
        .appendTo(addOption(title, root))
    const numOptions = options.length;
    let selStr = " selected";
    for(let i = 0; i < numOptions; i++) {
        const optionEl =
            $(`<option value=${i}${selStr}></option>`).appendTo(el);
        optionEl.html(options[i]);
        selStr = "";
    }
    return el;
}

function createLoadBar(msg, root) {
    const container = $(`<div class="loading"></div>`).appendTo(root);
    $(`<span>${msg}</span>`).appendTo(container);
    return $(`<div></div>`).appendTo(container);
}

const GLOBAL_MIN_RESOLUTION = 4;
const GLOBAL_MAX_RESOLUTION = 20;

class IsochroneManager {
    constructor(dataSources, onChange) {
        this.dataSources = dataSources;
        this.onChange = onChange;

        this.start = null; //L.LatLng
        this.startPx = null; //L.Point
        this.tileBounds = null; //L.Bounds

        this.modelProto = null;
        this.model = null; //Model

        this.queryJobs = [];

        this.minResolution = GLOBAL_MIN_RESOLUTION;
        this.maxResolution = GLOBAL_MAX_RESOLUTION;
        this.optionEls = {};
        this.sections = {
            data: null,
            model: null
        };
        this.options = {
            color: 0,
            opacity: 0.6,
            maxRadius: 5000,
            resolution: GLOBAL_MIN_RESOLUTION,
            model: 0,
            maxCost: 5000
        };
        this.updateTimeout = 0;

        this.cost = null;
        this.backlink = null;
    }

    /******************** UI AND INPUT ********************/

    handleInput(e, option, action = 0) {
        window.clearTimeout(this.updateTimeout);
        this.updateTimeout = window.setTimeout(
            () => this._handleInput(e, option, action),
            100
        );
    }
    _handleInput(e, option, action) {
        if(option !== null) {
            if(typeof e === "object") {
                this.options[option] = parseFloat(e.target.value);
            } else {
                this.options[option] = e;
            }
        }
        if(this.start !== null) {
            switch(action) {
                case 3: //Change requires getting new data
                    this.setBounds();
                break;
                case 2: //Change requires generating new shape on same data
                    this.generateIsochrone();
                break;
                case 1: //Change requires redrawing same shape
                    this.onChange();
                break;
                default: //Change changes nothing!
            }
        }
    }

    makeElement(gradientEls) {
        let root = $("<li></li>").addClass("isochroneOptions");
        this.optionEls.root = root;

        this.optionEls.maxRadius = createInputWithUnit(
            "Max radius",
            root,
            "m",
            this.options.maxRadius,
            `min="1" step="1" default="250"`
        ).on(
            "change",
            e => this.handleInput(e, "maxRadius", parseFloat(e.target.value) > this.options.maxRadius ? 3 : 0)
        );

        this.optionEls.color = gradientEls;
        const colorContainer = $(`<div class="dropdown color"></div>`)
            .appendTo(addOption("Color", root));
        for(const i in gradientEls) {
            $(gradientEls[i]).appendTo(colorContainer).on("click", e => {
                this.options.color = i;
                $(e.target).prependTo(colorContainer);
                if(this.start !== null) this.onChange();
            });
        }

        this.optionEls.opacity =
            $(`<input class="slider2" type="range" min="0" max="1" step="0.01" value="${this.options.opacity}" default="0.4"></input>`)
            .appendTo(addOption("Opacity", root))
            .on("change", e => this.handleInput(e, "opacity", 1));
        
        //*
        this.optionEls.steps =
            $(`<input class="nounit" type="number" min="0" step="1" value="0">`)
            .appendTo(addOption("Steps", root))
            .on("change", e => this.handleInput(e, "steps", 1));
        //*/

        this.optionEls.model = createDropdown(
            "Model",
            root,
            models.map(m => m.nameString)
        ).on(
            "change",
            e => {
                const reuseData = this.setupModel(e.target.value);
                this.handleInput(e, "model", reuseData ? 2 : 3);
            }
        );
        
        this.sections.data = addSection("Data Properties", root);
        this.sections.model = addSection("Model Properties", root);
        this.setupModel();
        
        return root;
    }

    setupModel(modelIndex = this.options.model) {
        const newModelProto = models[modelIndex];

        let reuseData = false;
        if(this.modelProto !== null) {
            reuseData = newModelProto.requiredData.reduce(
                (a, c) => a && this.modelProto.requiredData.indexOf(c) !== -1,
                true
            );
        }

        let newModel = new newModelProto();
        if(reuseData) {
            for(const d of newModelProto.requiredData) {
                newModel.data[d] = this.model.data[d];
            }
        }
        this.modelProto = newModelProto;
        this.model = newModel;

        this.sections.data.empty();
        this.sections.model.empty();

        this.optionEls.resolution = createDropdown(
           "Resolution",
           this.sections.data
        ).on("change", e => this.handleInput(e, "resolution", 3));
        
        for(const dataType of this.modelProto.requiredData) {
            this.options[dataType + "_source"] = 0;
            createDropdown(
                dataType + " source",
                this.sections.data,
                this.dataSources[dataType].map(s => s.name)
            ).on("change", e => {
                this.options[dataType + "_source"] = parseInt(e.target.value);
                this.updateResolutionRange();
                this.handleInput(e, null, 3);
            });
        }

        this.updateResolutionRange();
        
        createInputWithUnit(
            "Max " + this.modelProto.costName,
            this.sections.model,
            this.modelProto.costUnitSymbol,
            this.modelProto.defaultCost,
            `min="0" step="1"`
        ).on("change", e => this.handleInput(e, "maxCost", parseFloat(e.target.value) < this.options.maxCost ? 1 : 2));
        this.options.maxCost = this.modelProto.defaultCost;

        this.model.createOptions(this.sections.model, (e, action) => this.handleInput(e, null, action));

        return reuseData;
    }
    
    updateResolutionRange() {
        let max = GLOBAL_MAX_RESOLUTION;
        let min = GLOBAL_MIN_RESOLUTION;
        for(const dataType of this.modelProto.requiredData) {
            const sourceObj = this.dataSources[dataType][this.options[dataType + "_source"]];
            max = Math.min(max, sourceObj.maxResolution);
            min = Math.max(min, sourceObj.minResolution);
        }
        const newVal = Math.max(min, Math.min(max, this.options.resolution));
        this.optionEls.resolution.empty();
        for(let e = min; e <= max; e++) {
            $(`<option value=${e}${e === newVal ? " selected" : ""}>${e}</option>`)
                .appendTo(this.optionEls.resolution);
        }
        this.minResolution = min;
        this.maxResolution = max;
        this.optionEls.resolution.value = newVal;
        this.options.resolution = newVal;
    }

    /******************** ISOCHRONE GENERATION ********************/

    setBounds() {
        this.tileBounds = U.createTileBounds(
            this.start,
            this.options.maxRadius,
            this.options.resolution
        );
        this.startPx = Map_.map
            .project(this.start, this.options.resolution)
            .subtract(this.tileBounds.min.multiplyBy(256))
            .floor();
        /*
        console.log("TILE BOUNDS", this.tileBounds);
        console.log("START PX", this.startPx);
        //*/

        this.getData();
    }

    getRequiredTilesList(source) {
        const {zoomOffset} = source;
        const zoom = this.options.resolution + zoomOffset;
        let bounds = this.tileBounds;
        if(zoomOffset !== 0) { //Handle lower-res tiles
            const scaleFactor = Math.pow(2, zoomOffset);
            bounds = window.L.bounds(
                this.tileBounds.min.multiplyBy(scaleFactor),
                this.tileBounds.max.multiplyBy(scaleFactor)
            );
        }
        const startPoint = Map_.map.project(this.start, zoom);
        const startTile = startPoint.clone().divideBy(256).floor();
        
        let tileList = [];
        for(let y = bounds.min.y; y < bounds.max.y; y++) {
            for(let x = bounds.min.x; x < bounds.max.x; x++) {
                //Measure distance to start from nearest corner/edge
                let measureX = startPoint.x;
                if(x > startTile.x) measureX = x * 256;
                else if (x < startTile.x) measureX = (x + 1) * 256;

                let measureY = startPoint.y;
                if(y > startTile.y) measureY = y * 256;
                else if(y < startTile.y) measureY = (y + 1) * 256;

                const measureLatLng = Map_.map.unproject([measureX, measureY], zoom);
                const dist = F_.lngLatDistBetween(
                    this.start.lng,
                    this.start.lat,
                    measureLatLng.lng,
                    measureLatLng.lat
                );

                if(dist <= this.options.maxRadius) {
                    tileList.push({
                        x,
                        y,
                        z: zoom,
                        relX: x - bounds.min.x,
                        relY: y - bounds.min.y,
                        dist
                    });
                }
            }
        }

        tileList.sort((a, b) => a.dist - b.dist);
        return tileList;
    }

    getData() {
        console.time("load");
        
        this.queryJobs.map(job => job.stop());
        this.queryJobs = [];

        const promises = [];
        for(const dataType of this.modelProto.requiredData) {
            const sourceIndex = this.options[dataType +"_source"];
            const source = this.dataSources[dataType][sourceIndex];
            const requiredTiles = this.getRequiredTilesList(source);

            const job = new QueryJob(source, requiredTiles, this.tileBounds);
            this.queryJobs.push(job);
            let bar;
            promises.push(job.start(
                () => bar = createLoadBar(`Loading ${dataType}...`, this.optionEls.root),
                prog => bar.css({width: `${prog * 100}%`}),
                () => bar.parent().remove()
            ));
        }

        Promise.all(promises).then(result => {
            const dataArr = this.modelProto.requiredData.map((d, i) => [d, result[i]]);
            this.model.data = Object.fromEntries(dataArr);
            this.queryJobs = [];
            console.timeEnd("load");
            this.generateIsochrone();
        }).catch(console.log);
    }

    generateIsochrone() {
        console.time("generate");
        const result = IsochroneTool_Algorithm.generate(
            this.startPx,
            this.tileBounds,
            this.model.costFunction,
            this.options.resolution,
            this.options.maxCost
        );
        console.timeEnd("generate");
        //console.log("RESULT", result.cost);
        this.cost = result.cost;
        this.backlink = result.backlink;
        this.onChange();
    }
}

export default IsochroneManager;
