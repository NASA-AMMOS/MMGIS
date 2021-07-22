import $ from "jquery";

import models from "./IsochroneTool_Models";
import * as IsochroneTool_Algorithm from "./IsochroneTool_Algorithm";
import Map_ from '../../Basics/Map_/Map_';
import { projectTileBounds, unprojectTileBounds } from "./IsochroneTool_Util";
import F_ from '../../Basics/Formulae_/Formulae_'; //lngLatDistBetween //wait why did i want that???


import IsochroneTool_DataManager from "./IsochroneTool_DataManager";

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

function createDropdown(title, root, options) {
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

class IsochroneManager {
    constructor(dataSources, onChange) {
        this.dataSources = dataSources;
        this.onChange = onChange;

        this.start = null; //L.LatLng
        this.startPx = null; //L.Point
        this.bounds = null; //L.LatLngBounds
        this.tileBounds = null; //TileBounds
        this.tileAlignedBounds = null; //L.LatLngBounds
        this.model = null; //Model
        this.minResolution = 0;
        this.maxResolution = 20;
        this.optionEls = {};
        this.sections = {
            data: null,
            model: null
        };
        this.options = {
            color: 0,
            maxRadius: 250,
            resolution: 17,
            model: 0,
            maxCost: 100
        };
        this.cost = null;
        this.backlink = null;
    }

    handleInput(e, option, action = 0) {
        //TODO rate-limit and queue updates
        if(option !== null) this.options[option] = parseInt(e.target.value);
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
                default:
            }
        }
    }

    makeElement(gradientEls) {
        let root = $("<li></li>").addClass("isochroneOptions");

        this.optionEls.maxRadius = createInputWithUnit(
            "Max radius",
            root,
            "m",
            this.options.maxRadius,
            `min="1" step="1" default="250"`
        ).on(
            "change",
            e => this.handleInput(e, "maxRadius", e.target.value > this.options.maxRadius ? 3 : 0)
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

        this.optionEls.model = createDropdown(
            "Model",
            root,
            models.map(m => m.nameString)
        ).on(
            "change",
            e => {
                this.setupModel(e.target.value);
                this.handleInput(e, "model", 3);
            }
        );
        
        this.sections.data = addSection("Data Properties", root);
        this.sections.model = addSection("Model Properties", root);
        this.setupModel();
        
        return root;
    }

    setupModel(modelIndex = this.options.model) {
        this.model = new models[modelIndex]();

        this.sections.data.empty();
        this.sections.model.empty();

        this.optionEls.resolution = $(
            `<input class="nounit" type="number" step="1" value="${this.options.resolution}">`
        ).appendTo(addOption("Resolution", this.sections.data))
         .on("change", e => 
            this.handleInput(e, "resolution", 3)
        );
        for(const dataType of models[modelIndex].requiredData) {
            this.options[dataType + "_source"] = 0;
            createDropdown(
                dataType + " source",
                this.sections.data,
                this.dataSources[dataType].map(s => s.name)
            ).on("change", e => this.handleInput(e, dataType + "_source", 3));
        }

        this.updateResolutionRange();
        
        createInputWithUnit(
            "Max " + models[modelIndex].costName,
            this.sections.model,
            models[modelIndex].costUnitSymbol,
            models[modelIndex].defaultCost,
            `min="0" step="1"`
        ).on("change", e => this.handleInput(e, "maxCost", 2));
        this.options.maxCost = models[modelIndex].defaultCost;
        this.model.createOptions(this.sections.model, (e, action) => this.handleInput(e, null, action));
    }
    
    updateResolutionRange() {
        let max = 25;
        let min = 0;
        for(const dataType of models[this.options.model].requiredData) {
            const sourceObj = this.dataSources[dataType][this.options[dataType + "_source"]];
            max = Math.min(max, sourceObj.maxResolution);
            min = Math.max(min, sourceObj.minResolution);
        }
        const current = this.optionEls.resolution.attr("value");
        const newVal = Math.max(min, Math.min(max, current));
        this.optionEls.resolution.attr("min", min);
        this.optionEls.resolution.attr("max", max);
        this.optionEls.resolution.attr("value", newVal);
        this.options.resolution = newVal;
    }

    setStart(latlng) {
        this.start = latlng;
        this.setBounds();
    }

    setBounds() {
        this.bounds = this.start.toBounds(this.options.maxRadius * 2);

        this.tileBounds = projectTileBounds(this.bounds, this.options.resolution);
        this.tileAlignedBounds = unprojectTileBounds(this.tileBounds, this.options.resolution);
        this.startPx = Map_.map
            .project(this.start, this.options.resolution)
            .subtract(this.tileBounds.min.multiplyBy(256))
            .floor();
        /*
        console.log("BOUNDS", this.bounds);
        console.log("TILE BOUNDS", this.tileBounds);
        console.log("START PX", this.startPx);
        */

        this.getData();
    }

    getRequiredTilesList(dataSource) {
        let tileList = [];
        const zoom = this.options.resolution + dataSource.zoomOffset;
        const bounds = dataSource.zoomOffset === 0
            ? this.tileBounds
            : projectTileBounds(this.tileAlignedBounds, zoom);
        
        for(let y = bounds.min.y; y < bounds.max.y; y++) {
            for(let x = bounds.min.x; x < bounds.max.x; x++) {
                //TODO make a circle
                tileList.push({
                    x,
                    y,
                    z: zoom,
                    relX: x - bounds.min.x,
                    relY: y - bounds.min.y
                });
            }
        }

        //console.log("TILE LIST", tileList);
        return tileList;
    }

    getData() {
        let requiredDatasets = [];
        for(const dataType of models[this.options.model].requiredData) {
            const sourceObj = this.dataSources[dataType][this.options[dataType + "_source"]];
            requiredDatasets.push({
                tileList: this.getRequiredTilesList(sourceObj),
                dataType,
                url: sourceObj.tileurl,
                resolution: sourceObj.resolution
            });
        }

        const dataCallback = (result, dataName, queryList, dataObj) => {
            dataObj[dataName] = result;
            if(queryList.length > 0) {
                const nextQuery = queryList.shift();
                IsochroneTool_DataManager.queryTiles(
                    nextQuery.url, nextQuery.tileList, nextQuery.resolution,
                    d => dataCallback(d, nextQuery.dataType, queryList, dataObj)
                );
            } else {
                this.model.data = dataObj;
                this.generateIsochrone();
            }
        }

        const firstQuery = requiredDatasets.shift();
        IsochroneTool_DataManager.queryTiles(
            firstQuery.url, firstQuery.tileList, this.tileBounds, firstQuery.resolution,
            d => dataCallback(d, firstQuery.dataType, requiredDatasets, {})
        );
    }

    generateIsochrone() {
        const result = IsochroneTool_Algorithm.generate(
            this.startPx,
            this.tileBounds,
            this.model.costFunction,
            this.options.resolution,
            this.options.maxCost
        );
        this.cost = result.cost;
        this.backlink = result.backlink;
        this.onChange();
    }
}

export default IsochroneManager;