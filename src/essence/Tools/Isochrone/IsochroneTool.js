//New Tool Template
//In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
import * as d3 from 'd3';
import L_ from '../../Basics/Layers_/Layers_';
import Map_ from '../../Basics/Map_/Map_';
import $ from 'jquery';
import CursorInfo from '../../Ancillary/CursorInfo';
//import F_ from '../../Basics/Formulae_/Formulae_';
//import turf from 'turf';

import IsochroneManager from './IsochroneTool_Manager';
import * as D from './IsochroneTool_Util';

import './IsochroneTool.css';
const L = window.L;

//Add the tool markup if you want to do it this way
// prettier-ignore
const markup = [
    "<div id='isochroneTool'>",
        "<div id='isochroneToolTitle'>Isochrone</div>",
        "<ul id='isochroneOptionsContainer'></ul>",
    "</div>"
].join('\n');

//Legacy color mapping function
function hueMap(val) {
    const hueToChannel = h => {
        h = (h + 1530) % 1530;
        if(h < 255) return h;
        if(h < 765) return 255;
        if(h < 1020) return 255 - (h % 255);
        return 0;
    }
    const hue = Math.floor(val * 1050);
    const r = hueToChannel(hue + 510);
    const g = hueToChannel(hue);
    const b = hueToChannel(hue - 510);
    return [r, g, b];
}

let lastHoverCall = 0;

//https://leafletjs.com/reference-1.7.1.html#gridlayer
L.IsochroneLayer = L.GridLayer.extend({
    //Override to make layer accept Bounds in place of LatLngBounds
    //  (for better polar projection support)
    _isValidTile(coords) {
        const bounds = this.options.bounds;
        return coords.x >= bounds.min.x
            && coords.y >= bounds.min.y
            && coords.x < bounds.max.x
            && coords.y < bounds.max.y;
    },
    createTile: function(coords) {
        const tile = L.DomUtil.create("canvas", "leaflet-tile");

        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        const ctx = tile.getContext("2d");
        const img = ctx.getImageData(0, 0, size.x, size.y);

        const bounds = this.options.bounds;
        const boundsSize = bounds.getSize();
        const tXOffset = coords.x - bounds.min.x;
        const tYOffset = coords.y - bounds.min.y;

        const alpha = Math.floor(this.options.opacity * 255);

        if(tXOffset >= 0 && tYOffset >= 0 && tXOffset < boundsSize.x && tYOffset < boundsSize.y) {
            let di = 0; //img data index
            for(let y = 0; y < size.y; y++) {
                const yIndex = tYOffset * size.y + y;
                for(let x = 0; x < size.x; x++) {
                    const xIndex = tXOffset * size.x + x;
                    const currentData = this.options.data[yIndex][xIndex];
                    if(isFinite(currentData)) {
                        const color = IsochroneTool.valueToColor(
                            currentData / this.options.maxCost,
                            this.options.color
                        );
                        img.data[di] = color[0];
                        img.data[di + 1] = color[1];
                        img.data[di + 2] = color[2];
                        img.data[di + 3] = alpha;
                    } else {
                        img.data[di] = 0;
                        img.data[di + 1] = 0;
                        img.data[di + 2] = 0;
                        img.data[di + 3] = 0;
                    }
                    di += 4;
                }
            }
        }
        ctx.putImageData(img, 0, 0);
        return tile;
    }
});

const IsochroneTool = {
    height: 0,
    width: 250,
    MMGISInterface: null,
    vars: null,
    manager: null,
    containerEl: null,
    dataSources: null,
    marker: null,
    hoverPolyline: null,
    hovered: false,
    colorRamps: [
        [ //Red 5
            [254, 229, 217],
            [252, 187, 161],
            [252, 106, 74],
            [222, 45, 38],
            [165, 15, 21]
        ],
        [ //Orange 4
            [255, 255, 178],
            [254, 204, 92],
            [253, 141, 60],
            [240, 59, 32],
            [189, 0, 38]
        ],
        [ //Green 1
            [237, 248, 233],
            [186, 228, 179],
            [116, 196, 118],
            [49, 163, 84],
            [0, 109, 44]
        ],
        [ //Blue 4
            [240, 249, 232],
            [186, 228, 188],
            [123, 204, 196],
            [67, 162, 202],
            [8, 104, 172]
        ],
        [ //Purple 4
            [237, 248, 251],
            [179, 205, 227],
            [140, 150, 198],
            [136, 86, 167],
            [129, 15, 124]
        ]
    ],
    initialize: function() {
        this.vars = L_.getToolVars('isochrone');

        //add info for scaling low-res tiles
        this.dataSources = this.vars.data;
        for(const dataType in this.vars.data) {
            for(let src of this.vars.data[dataType]) {
                let zoomOffset = 0;
                switch(src.resolution) {
                    case 256:
                        zoomOffset = 0;
                    break;
                    case 128:
                        zoomOffset = 1;
                    break;
                    case 64:
                        zoomOffset = 2;
                    break;
                    case 32:
                        zoomOffset = 3;
                    break;
                    default:
                        console.warn(`IsochroneTool: ${dataType} source ${src.name} has undefined or nonstandard resolution: ${src.resolution}!`);
                }
                src.minResolution = src.minZoom - zoomOffset;
                src.maxResolution = src.maxNativeZoom - zoomOffset;
                src.zoomOffset = zoomOffset;
            }
        }
    },
    make: function() {
        this.MMGISInterface = new interfaceWithMMGIS();

        this.manager = new IsochroneManager(
            this.dataSources,
            () => {
                this.makeDataLayer(this.manager);
                this.makeMarker(this.manager);
            }
        );
        
        this.containerEl = $("#isochroneOptionsContainer");
        this.containerEl.append(
            this.manager.makeElement(this.makeGradientEls())
        );
    },
    destroy: function() {
        Map_.rmNotNull(this.marker);
        Map_.rmNotNull(L_.layersGroup["isochrone"]);
        if(this.hoverPolyline !== null)
            this.hoverPolyline.remove(Map_.map);
        
        this.MMGISInterface.separateFromMMGIS();
    },
    getUrlString: function() { //TODO?
        return '';
    },
    handleClick:  function(e) {
        if(e && e.latlng) {
            this.manager.setStart(e.latlng);
        }
    },
    valueToColor: function(val, rampIndex, steps = 0) {
        val = Math.min(val, 1);
        if(steps) val = Math.floor(val * steps) / steps;

        const ramp = this.colorRamps[rampIndex];
        const color = val * (ramp.length - 1);
        const i = Math.min(Math.floor(color), ramp.length - 2);
        const off = color % 1;
        const getChan = chan =>
            Math.floor(ramp[i][chan] * (1 - off) + ramp[i + 1][chan] * off);
        return [getChan(0), getChan(1), getChan(2)];
    },
    makeGradientEls: function() {
        const C_WIDTH = 120, C_HEIGHT = 29;
        const numRamps = this.colorRamps.length;
        let colorEls = [];
        for(let i = 0; i < numRamps; i++) {
            let canvas = document.createElement("canvas");
            canvas.width = C_WIDTH;
            canvas.height = C_HEIGHT;
            let ctx = canvas.getContext("2d");
            let image = ctx.getImageData(0, 0, C_WIDTH, C_HEIGHT);
            let data = image.data;
            for(let x = 0; x < C_WIDTH; x++) {
                const color = this.valueToColor(x / C_WIDTH, i);
                for(let y = 0; y < C_HEIGHT; y++) {
                    const di = (y * C_WIDTH * 4) + (x * 4);
                    data[di] = color[0];
                    data[di + 1] = color[1];
                    data[di + 2] = color[2];
                    data[di + 3] = 255;
                }
            }
            ctx.putImageData(image, 0, 0);
            colorEls.push(canvas);
        }
        return colorEls;
    },
    makeDataLayer: function(manager) {
        const {cost, tileBounds, options} = manager;
        
        const layerName = "isochrone";
        Map_.rmNotNull(L_.layersGroup[layerName]);

        L_.layersGroup[layerName] = new L.IsochroneLayer({
            className: "nofade",
            minZoom: Math.min(options.resolution, Map_.map.getMinZoom()),
            maxZoom: Map_.map.getMaxZoom(),
            minNativeZoom: options.resolution,
            maxNativeZoom: options.resolution,
            bounds: tileBounds,
            tileSize: 256,
            opacity: options.opacity,
            color: options.color,
            maxCost: options.maxCost,
            data: cost
        });
        
        L_.layersGroup[layerName].setZIndex(1000);
        Map_.map.addLayer(L_.layersGroup[layerName]);
    },

    makeMarker: function(manager) { //ViewshedTool.js:948 (function viewsheed)
        let canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        let ctx = canvas.getContext("2d");

        const radius = 7
        const strokeWeight = 2
        const ramp = IsochroneTool.colorRamps[manager.options.color];
        const c = ramp[ramp.length - 1];

        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 255)`;

        ctx.strokeStyle = "rgba(255, 255, 255, 255)";
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            radius,
            0,
            2 * Math.PI
        );

        ctx.fill();
        ctx.lineWidth = strokeWeight;
        ctx.stroke();
        ctx.strokeStyle = "rgba(0, 0, 0, 255)";
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            radius - strokeWeight,
            0,
            2 * Math.PI
        );

        ctx.fill();
        ctx.lineWidth = strokeWeight;
        ctx.stroke();

        let isochroneIcon = L.icon({
            iconUrl: canvas.toDataURL(),
            iconSize: [canvas.width, canvas.height],
            iconAnchor: [canvas.width / 2, canvas.height / 2],
            popupAnchor: [-3, -76],
            shadowSize: [68, 95],
            shadowAnchor: [22, 94],
        });

        Map_.rmNotNull(IsochroneTool.marker);
        IsochroneTool.marker = new L.marker(
            [manager.start.lat, manager.start.lng],
            {
                icon: isochroneIcon,
                draggable: false //for now... (TODO)
            }
        ).addTo(Map_.map);
    },

    handleMove: function(e) {
        const MAX_STEPS = 5000;

        if(this.manager.backlink === null) return;
        const now = Date.now();
        if(lastHoverCall + 65 > now) return;
        lastHoverCall = now;

        if(this.hoverPolyline !== null)
            this.hoverPolyline.remove(Map_.map);

        const toLinePoint = (x, y) => {
            const latlng = D.pxToLatLng(
                [y, x],
                this.manager.tileBounds,
                this.manager.options.resolution
            );
            return [latlng.lat, latlng.lng];
        }

        const hoveredPx = Map_.map
            .project(e.latlng, this.manager.options.resolution)
            .subtract(this.manager.tileBounds.min.multiplyBy(256))
            .floor();
        const width = this.manager.backlink[0].length;
        const height = this.manager.backlink.length;

        let startVal = 0;
        if(hoveredPx.x >= 0 && hoveredPx.y >= 0 && hoveredPx.x < width && hoveredPx.y < height)
            startVal = this.manager.backlink[hoveredPx.y][hoveredPx.x];
        
        if(startVal !== 0) {
            this.hovered = true;
            const hoveredCost = this.manager.cost[hoveredPx.y][hoveredPx.x];
            const tooltipMsg = hoveredCost.toFixed(1) + this.manager.modelProto.costUnitSymbol;
            CursorInfo.update(tooltipMsg, null, false);

            let cx = hoveredPx.x;
            let cy = hoveredPx.y;
            let step = startVal;
            let line = [toLinePoint(cx, cy)];
            let lastStep = 0;
            let count = 0;
            while(step !== 0 && count < MAX_STEPS) {
                let move = D.backlinkToMove(step);
                cx += move[1];
                cy += move[0];
                if(step === lastStep) { //Extend line
                    line[line.length - 1] = toLinePoint(cx, cy);
                } else { //Begin new line
                    line.push(toLinePoint(cx, cy));
                }
                lastStep = step;
                step = this.manager.backlink[cy][cx];
                count++;
            }
            this.hoverPolyline = window.L.polyline(line, {interactive: false});
            this.hoverPolyline.addTo(Map_.map);
        } else if(this.hovered) {
            this.hovered = false;
            CursorInfo.hide();
        }
    }
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function() {
        separateFromMMGIS()
    }

    //MMGIS should always have a div with id 'tools'
    var tools = d3.select('#toolPanel')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools
        .append('div')
        .attr('class', 'center aligned ui padded grid')
        .style('height', '100%')
    //Add the markup to tools or do it manually
    tools.html( markup );

    //Add event functions and whatnot
    const clickEventContainer = e => IsochroneTool.handleClick(e);
    Map_.map.on('click', clickEventContainer);

    const moveEventContainer = e => IsochroneTool.handleMove(e);
    Map_.map.on('mousemove', moveEventContainer);
    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        Map_.map.off('click', clickEventContainer);
        Map_.map.off('mousemove', moveEventContainer);
    }
}

//Other functions

export default IsochroneTool;
