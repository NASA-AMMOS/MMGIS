import $ from 'jquery';

import Map_ from '../../Basics/Map_/Map_';
import F_ from '../../Basics/Formulae_/Formulae_';

import generateIsochrone from './IsochroneTool_Algorithm';
import QueryJob from './IsochroneTool_Query';
import { addOption, addSection, createInput, createDropdown, createLoadBar } from './ui.js';

const GLOBAL_MIN_RESOLUTION = 4;
const GLOBAL_MAX_RESOLUTION = 20;

class IsochroneManager {
    constructor(id, dataSources, models, options = {}) {
        this.id = id;
        this.dataSources = dataSources;
        this.models = models;
        
        this.options = {
            visible: true,
            color: 0,
            opacity: 0.8,
            maxRadius: 5000,
            resolution: GLOBAL_MIN_RESOLUTION,
            model: 0,
            maxCost: 5000
        };
        Object.assign(this.options, options);

        this.optionEls = {};
        this.sections = {
            data: null,
            model: null
        };

        this.onChange = () => {};
        this.onDelete = () => {};
        this.onFocus = () => {};

        this.minResolution = GLOBAL_MIN_RESOLUTION;
        this.maxResolution = GLOBAL_MAX_RESOLUTION;
        this.start = null; //L.LatLng
        this.startPx = null; //L.Point
        this.tileBounds = null; //L.Bounds

        this.currentStage = 0;
        this.queryJobs = [];

        this.modelProto = null;
        this.model = null; //Model

        this.updateTimeout = 0;

        this.cost = null;
        this.backlink = null;

        this.layerName = 'isochrone_' + this.id;
        //assigned by IsochroneTool
        this.marker = null;
    }

    /******************** UI AND INPUT ********************/

    handleInput(e, option, action = 0) {
        window.clearTimeout(this.updateTimeout);
        this.updateTimeout = window.setTimeout(() => this._handleInput(e, option, action), 100);
    }
    _handleInput(e, option, action) {
        if (option !== null) {
            if (typeof e === 'object') {
                this.options[option] = parseFloat(e.target.value);
            } else {
                this.options[option] = e;
            }
        }

        this.onFocus();

        if (this.start !== null && action >= this.currentStage) {
            switch (action) {
                case 3: //Change requires getting new data
                    this.setBounds();
                break;
                case 2: //Change requires generating new shape on same data
                    this.analyze();
                break;
                case 1: //Change requires redrawing same shape
                    this.onChange();
                break;
                default: //Change changes nothing!
            }
        }
    }

    makeElement(gradientEls) {
        let root = $('<li></li>');
        let header = $('<div class="isochroneHeader"></div>').appendTo(root);
        let options = $('<div class="isochroneOptions"></div>').appendTo(root);
        this.optionEls.options = options;
        this.optionEls.root = root;

        header.on('click', () => this.onFocus());

        $('<div class="checkbox on"></div>').appendTo(header).on('click', e => {
            let target = $(e.target);
            const visible = !target.hasClass('on');
            if (visible) {
                target.addClass('on');
            } else {
                target.removeClass('on');
            }
            this.handleInput(visible, 'visible', 1);
        });
        $(`<div class="title">Isochrone ${this.id}</div>`).appendTo(header);
        $('<i class="iscicon mdi mdi-18px mdi-close"></i>').appendTo(header).on('click', e => {
            this.onDelete();
        });
        $('<i class="iscicon mdi mdi-24px mdi-menu-down"></i>').appendTo(header).on('click', e => {
            let target = $(e.target);
            const collapsed = this.optionEls.options.hasClass('collapsed');
            if (collapsed) {
                this.optionEls.options.removeClass('collapsed');
                target.removeClass('mdi-menu-right');
                target.addClass('mdi-menu-down');
            } else {
                this.optionEls.options.addClass('collapsed');
                target.removeClass('mdi-menu-down');
                target.addClass('mdi-menu-right');
            }
        });

        this.optionEls.maxRadius = createInput(
            'Max radius',
            options,
            'km',
            this.options.maxRadius / 1000,
            `min="1" step="1" default="250"`
        ).on('change', e => {
            const inMeters = parseFloat(e.target.value) * 1000;
            this.handleInput(inMeters, 'maxRadius', inMeters > this.options.maxRadius ? 3 : 0);
        });

        this.optionEls.color = gradientEls;
        $(this.optionEls.color[this.options.color]).addClass('selected');
        const colorContainer = $('<div class="dropdown color"></div>')
            .appendTo(addOption('Color', options));
        for (const i in gradientEls) {
            $(gradientEls[i]).appendTo(colorContainer).on('click', e => {
                if(this.options.color !== i) {
                    $(this.optionEls.color[this.options.color]).removeClass('selected');
                    $(e.target).addClass('selected');
                    this.handleInput(i, 'color', 1);
                }
            });
        }

        this.optionEls.opacity =
            $(`<input class="slider2" type="range" min="0" max="1" step="0.01" value="${this.options.opacity}" default="0.4"></input>`)
            .appendTo(addOption('Opacity', options))
            .on('change', e => this.handleInput(e, 'opacity', 1));
        
        this.optionEls.steps = createInput(
            'Steps',
            options,
            false,
            0,
            'min="0" step="1" default="0"'
        ).on('change', e => this.handleInput(e, 'steps', 1));

        this.optionEls.model = createDropdown(
            'Model',
            options,
            this.models.map(m => m.nameString)
        ).on(
            'change',
            e => {
                if (this.currentStage > 3) {
                    //Recover from misconfigured model
                    this.currentStage = 0;
                    if (this.marker !== null) {
                        this.marker.dragging.enable();
                    }
                }
                const reuseData = this.setupModel(e.target.value);
                this.handleInput(e, 'model', reuseData ? 2 : 3);
            }
        );
        
        this.sections.data = addSection('Data Properties', options);
        this.sections.model = addSection('Model Properties', options);
        this.setupModel();
        
        return root;
    }

    setupModel(modelIndex = this.options.model) {
        const newModelProto = this.models[modelIndex];

        let reuseData = false;
        if (this.modelProto !== null) {
            reuseData = newModelProto.requiredData.reduce(
                (a, c) => a && this.modelProto.requiredData.indexOf(c) > -1 && this.model.data[c],
                true
            );
        }

        let newModel = new newModelProto();
        if (reuseData) {
            for (const d of newModelProto.requiredData) {
                newModel.data[d] = this.model.data[d];
            }
        }
        this.modelProto = newModelProto;
        this.model = newModel;

        this.sections.data.empty();
        this.sections.model.empty();

        this.optionEls.resolution = createDropdown(
           'Resolution',
           this.sections.data
        ).on('change', e => this.handleInput(e, 'resolution', 3));
        
        for (const dataType of this.modelProto.requiredData) {
            const lcDataType = dataType.toLowerCase();
            if (this.dataSources[lcDataType] === undefined || this.dataSources[lcDataType].length === 0) {
                //Tool is misconfigured for this model; disable
                this.sections.data.empty();
                createLoadBar(
                    `No valid source for ${dataType}!`,
                    this.sections.data,
                    true
                );
                this.currentStage = 4;
                if (this.marker !== null) {
                    this.marker.dragging.disable();
                }
                return false;
            }
            this.options[lcDataType + '_source'] = 0;
            createDropdown(
                dataType + ' source',
                this.sections.data,
                this.dataSources[lcDataType].map(s => s.name)
            ).on('change', e => {
                this.options[lcDataType + '_source'] = parseInt(e.target.value);
                this.updateResolutionRange();
                this.handleInput(e, null, 3);
            });
        }

        this.updateResolutionRange();
        
        createInput(
            'Max ' + this.modelProto.costName,
            this.sections.model,
            this.modelProto.costUnitSymbol,
            this.modelProto.defaultCost,
            `min="0" step="1"`
        ).on('change', e => this.handleInput(e, 'maxCost', parseFloat(e.target.value) < this.options.maxCost ? 1 : 2));
        this.options.maxCost = this.modelProto.defaultCost;

        this.model.createOptions(this.sections.model, (action) => this.handleInput(null, null, action));

        return reuseData;
    }

    focus() {
        this.optionEls.root.addClass('focused');
    }

    unfocus() {
        this.optionEls.root.removeClass('focused');
    }
    
    updateResolutionRange() {
        let max = GLOBAL_MAX_RESOLUTION;
        let min = GLOBAL_MIN_RESOLUTION;
        for (const dataType of this.modelProto.requiredData) {
            const lcDataType = dataType.toLowerCase();
            const sourceObj = this.dataSources[lcDataType][this.options[lcDataType + '_source']];
            max = Math.min(max, sourceObj.maxResolution);
            min = Math.max(min, sourceObj.minResolution);
        }
        const newVal = Math.max(min, Math.min(max, this.options.resolution));
        this.optionEls.resolution.empty();
        for (let e = min; e <= max; e++) {
            $(`<option value=${e}${e === newVal ? ' selected' : ''}>${e}</option>`)
                .appendTo(this.optionEls.resolution);
        }
        this.minResolution = min;
        this.maxResolution = max;
        this.optionEls.resolution.value = newVal;
        this.options.resolution = newVal;
    }

    /******************** ISOCHRONE GENERATION ********************/

    setBounds() {
        this.currentStage = 3;

        const startPoint = Map_.map.project(this.start, this.options.resolution);
        const measureLatLng = Map_.map.unproject(startPoint.add([1, 0]), this.options.resolution);
        const pxRadius = this.options.maxRadius / this.start.distanceTo(measureLatLng);

        const min = startPoint.subtract([pxRadius, pxRadius]).divideBy(256).floor();
        const max = startPoint.add([pxRadius, pxRadius]).divideBy(256).ceil();
        this.tileBounds = new window.L.Bounds(min, max);

        this.startPx = Map_.map
            .project(this.start, this.options.resolution)
            .subtract(min.multiplyBy(256))
            .floor();

        this.getData();
    }

    getRequiredTilesList(source) {
        const {zoomOffset} = source;
        const zoom = this.options.resolution + zoomOffset;
        let bounds = this.tileBounds;
        if (zoomOffset !== 0) { //Handle lower-res tiles
            const scaleFactor = Math.pow(2, zoomOffset);
            bounds = window.L.bounds(
                this.tileBounds.min.multiplyBy(scaleFactor),
                this.tileBounds.max.multiplyBy(scaleFactor)
            );
        }
        const startPoint = Map_.map.project(this.start, zoom);
        const startTile = startPoint.clone().divideBy(256).floor();
        
        let tileList = [];
        for (let y = bounds.min.y; y < bounds.max.y; y++) {
            for (let x = bounds.min.x; x < bounds.max.x; x++) {
                //Measure distance to start from nearest corner/edge
                let measureX = startPoint.x;
                if (x > startTile.x) {
                    measureX = x * 256;
                } else if (x < startTile.x) {
                    measureX = (x + 1) * 256;
                }

                let measureY = startPoint.y;
                if (y > startTile.y) {
                    measureY = y * 256;
                } else if (y < startTile.y) {
                    measureY = (y + 1) * 256;
                }

                const measureLatLng = Map_.map.unproject([measureX, measureY], zoom);
                const dist = F_.lngLatDistBetween(
                    this.start.lng,
                    this.start.lat,
                    measureLatLng.lng,
                    measureLatLng.lat
                );

                if (dist <= this.options.maxRadius) {
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
        this.queryJobs.map(job => job.stop());
        this.queryJobs = [];

        let promises = [];
        for (const dataType of this.modelProto.requiredData) {
            const lcDataType = dataType.toLowerCase();
            const sourceIndex = this.options[lcDataType + '_source'];
            const source = this.dataSources[lcDataType][sourceIndex];
            const requiredTiles = this.getRequiredTilesList(source);

            const job = new QueryJob(source, requiredTiles, this.tileBounds);
            this.queryJobs.push(job);
            let bar;
            const promise = job.start(
                () => bar = createLoadBar(`Loading ${dataType}...`, this.optionEls.options),
                (prog) => bar.css({width: `${prog * 100}%`}),
                () => bar.parent().remove()
            );
            promises.push(promise);
        }

        Promise.all(promises).then(result => {
            const dataArr = this.modelProto.requiredData.map((d, i) => [d, result[i]]);
            const dataObj = Object.fromEntries(dataArr);
            this.model.setData(dataObj);
            this.queryJobs = [];
            this.analyze();
        }).catch(msg => {
            if (msg !== "Query job stopped.") {
                console.log(msg);
            }
        });
    }

    analyze() {
        this.currentStage = 2;
        const result = generateIsochrone(
            this.startPx,
            this.tileBounds,
            this.model,
            this.options.resolution,
            this.options.maxCost
        );
        this.cost = result.cost;
        this.backlink = result.backlink;
        
        this.currentStage = 1;
        this.onChange();
        this.marker.dragging.enable();
       
        this.currentStage = 0;
    }
}

export default IsochroneManager;
