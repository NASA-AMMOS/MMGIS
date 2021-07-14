//New Tool Template
//In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
import * as d3 from 'd3';
import F_ from '../../Basics/Formulae_/Formulae_';
import L_ from '../../Basics/Layers_/Layers_';
import Map_ from '../../Basics/Map_/Map_';
import DataShaders from '../../Ancillary/DataShaders';
import $ from 'jquery';
/*
import CursorInfo from '../../Ancillary/CursorInfo';
import turf from 'turf';
import shp from '../../../external/shpjs/shapefile';
import shpwrite from '../../../external/SHPWrite/shpwrite';
import { PlaneGeometry } from '../../../../../MMGIS/src/external/THREE/three118';
*/

//import generate from './IsochroneTool_Algorithm';
import IsochroneManager from './IsochroneTool_Manager';
import * as D from "./IsochroneTool_DataUtil.js";

import './IsochroneTool.css';

//Add the tool markup if you want to do it this way
// prettier-ignore
const markup = [
    "<div id='isochroneTool'>",
        "<div id='isochroneToolTitle'>Isochrone</div>",
        "<ul id='isochroneOptionsContainer'></ul>",
    "</div>"
].join('\n');

const RESOLUTION = 32; //Tile resolution

function backlinkToMove(link) {
    return [ //clockwise from right
        [0, 1],
        [1, 2],
        [1, 1],
        [2, 1],
        [1, 0],
        [2, -1],
        [1, -1],
        [1, -2],
        [0, -1],
        [-1, -2],
        [-1, -1],
        [-2, -1],
        [-1, 0],
        [-2, 1],
        [-1, 1],
        [-1, 2]
    ][link];
}

let lastHoverCall = 0;

const IsochroneTool = {
    height: 0,
    width: 250,
    MMGISInterface: null,
    vars: null,
    manager: null,
    containerEl: null,
    dataSources: null,
    hoverPolyline: null,
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
        console.log(this.dataSources);

        this.manager = new IsochroneManager(this.dataSources, this.makeDataLayer);
    },
    make: function() {
        this.MMGISInterface = new interfaceWithMMGIS();
        this.containerEl = $("#isochroneOptionsContainer");
        this.containerEl.append(
            this.manager.makeElement(this.makeGradientEls())
        );
    },
    destroy: function() {
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
    valueToColor: function(val, rampIndex) {
        val = Math.min(val, 1);
        const ramp = this.colorRamps[rampIndex];
        const color = val * (ramp.length - 1);
        const i = Math.min(Math.floor(color), ramp.length - 2);
        const offset = color % 1;
        const r = ramp[i][0] * (1 - offset) + ramp[i + 1][0] * offset;
        const g = ramp[i][1] * (1 - offset) + ramp[i + 1][1] * offset;
        const b = ramp[i][2] * (1 - offset) + ramp[i + 1][2] * offset;
        return [r, g, b];
    },
    makeGradientEls: function() {
        const C_WIDTH = 120, C_HEIGHT = 29;
        const numRamps = this.colorRamps.length;
        let colorEls = [];
        for(let i = 0; i < numRamps; i++) {
            //console.log(this.colorRamps[i]);
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
    isochrone: function(start, zoom, maxRadius, maxCost) {
        //For now, just get a square around the start point
        const bounds = start.toBounds(maxRadius * 2);
        const tileBounds = IsochroneTool.getTileBoundary(bounds, zoom);
        const startPx = IsochroneTool.getStartPixel(start, tileBounds, zoom);
        console.log("START PX", startPx);
        const requiredTiles = IsochroneTool.getRequiredTilesList(tileBounds, zoom);

        IsochroneTool.queryTiles(tileBounds, requiredTiles, function(data) {
            //let result = generate(data, startPx, maxCost);
            //IsochroneTool.makeDataLayer(result, zoom, tileBounds, maxCost);
            //console.log("RESULT", result);
        });
    },
    getTileBoundary: function(bounds, zoom) {
        const min = Map_.map
            .project(bounds.getNorthWest(), zoom)
            .divideBy(256)
            .floor();
        const max = Map_.map
            .project(bounds.getSouthEast(), zoom)
            .divideBy(256)
            .floor();
        const width = max.x - min.x + 1;
        const height = max.y - min.y + 1;
        return {min, max, width, height};
    },
    getStartPixel: function(start, tileBounds, zoom) {
        return Map_.map.project(start, zoom)
            .subtract(tileBounds.min.multiplyBy(256))
            .divideBy(256 / RESOLUTION)
            .floor();
    },
    getRequiredTilesList: function(bounds, zoom) {
        let tileList = [];
        for(let y = bounds.min.y; y <= bounds.max.y; y++) {
            for(let x = bounds.min.x; x <= bounds.max.x; x++) {
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
    },
    //Based on ViewshedTool_Manager.queryDesiredTiles
    //TODO follow example of that function to make more robust
    //  (e.g. cache tiles)
    queryTiles: function(bounds, requiredTiles, callback) {
        const totalTiles = requiredTiles.length;
        const tilesPerStep = 8;
        let nextStep = tilesPerStep;
        let tilesQueried = 0, tilesLoaded = 0;

        let queryReturnData = [];
        for(let y = 0; y < bounds.height * RESOLUTION; y++) {
            let row = new Array(bounds.width * RESOLUTION).fill(Infinity);
            queryReturnData.push(row);
        }

        function eachTile(tileInfo, tileData) {
            const startX = tileInfo.relX * RESOLUTION;
            const startY = tileInfo.relY * RESOLUTION;
            for(let y = 0; y < RESOLUTION; y++) {
                const yResult = y + startY;
                let dataRow = tileData.slice(y * RESOLUTION, (y + 1) * RESOLUTION);
                queryReturnData[yResult].splice(startX, RESOLUTION, ...dataRow);
            }
            registerLoadedTile();
        }

        function registerLoadedTile() {
            tilesLoaded++;

            if(tilesLoaded >= totalTiles) {
                console.log("QUERY DATA", queryReturnData);
                callback(queryReturnData);
            } else if(tilesLoaded >= nextStep) {
                query();
            }
        }

        const query = () => {
            let url = this.url;
            if(!F_.isUrlAbsolute(url)) url = L_.missionPath + url;

            const start = tilesQueried;
            nextStep = tilesQueried + tilesPerStep;
            for(let d = start; d < totalTiles && d < nextStep; d++) {
                tilesQueried++;
                const queryUrl = F_.populateUrl(url, requiredTiles[d], true);

                window.PNG.load(queryUrl, (d => function(img) {
                    let rgbaArr = null;
                    if(img !== false) {
                        rgbaArr = img.decode();
                    }
                    //TODO: check tile against bounding box to minimize 404s
                    if(rgbaArr == null) {
                        //TODO: 404s don't reach here; fix
                        registerLoadedTile();
                        return;   
                    }

                    const length = RESOLUTION * RESOLUTION;
                    let heights = new Float32Array(length);
                    let p = 0;
                    for(let i = 0; i < length; i++) {
                        heights[i] = F_.RGBAto32({
                            r: rgbaArr[p],
                            g: rgbaArr[p + 1],
                            b: rgbaArr[p + 2],
                            a: rgbaArr[p + 3]
                        });
                        p += 4;
                    }

                    eachTile(requiredTiles[d], heights);
                })(d), true);
            }
        }

        query();
    },
    hueMap: function(val) {
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
    },
    makeDataLayer: function(data, zoom, tileBounds, maxCost, colorRamp) {
        const canvas = document.createElement("canvas");
        canvas.width = RESOLUTION;
        canvas.height = RESOLUTION;
        const length = RESOLUTION * RESOLUTION;
        const ctx = canvas.getContext("2d");
        let cImg = ctx.createImageData(RESOLUTION, RESOLUTION);
        let cData = cImg.data;
        let dl = {};
        zoom += 3;
        dl[zoom] = {};

        for(let tileX = 0; tileX < tileBounds.width; tileX++) {
            dl[zoom][tileBounds.min.x + tileX] = {};
            for(let tileY = 0; tileY < tileBounds.height; tileY++) {
                const offsetX = tileX * RESOLUTION;
                const offsetY = tileY * RESOLUTION;

                for(let p = 0; p < length; p++) {
                    const dix = p % RESOLUTION + offsetX;
                    const diy = Math.floor(p / RESOLUTION) + offsetY;
                    const pi = p * 4;
                    if(data[diy][dix] === Infinity) {
                        cData[pi] = 0;
                        cData[pi + 1] = 0;
                        cData[pi + 2] = 0;
                        cData[pi + 3] = 0;
                    } else {
                        const color =
                            IsochroneTool.valueToColor(data[diy][dix] / maxCost, colorRamp);
                        cData[pi] = color[0];
                        cData[pi + 1] = color[1];
                        cData[pi + 2] = color[2];
                        cData[pi + 3] = 128;
                    }
                }
                ctx.putImageData(cImg, 0, 0);
                dl[zoom][tileBounds.min.x + tileX][tileBounds.min.y + tileY] = canvas.toDataURL();
            }
        }

        console.log(dl);
        
        const layerName = "isochrone";

        Map_.rmNotNull(L_.layersGroup[layerName]);

        L_.layersGroup[layerName] = window.L.tileLayer.gl({
            options: {
                tms: false,
                className: 'nofade',
                minZoom: zoom,
                maxNativeZoom: zoom,
                maxZoom: 20,
                tileSize: 32
            },
            fragmentShader: DataShaders['image'].frag,
            tileUrls: [dl],
            uniforms: {},
            tileUrlsAsDataUrls: true
        });

        console.log(L_.layersGroup[layerName]);
        
        L_.layersGroup[layerName].setZIndex(1000);
        Map_.map.addLayer(L_.layersGroup[layerName]);
    },

    hoverLine: function(e) {
        if(this.manager.backlink === null) return;

        const toLinePoint = (x, y) => {
            const latlng = D.pxToLatLng(
                [y, x],
                this.manager.tileBounds,
                this.manager.options.resolution
            );
            return [latlng.lat, latlng.lng];
        }

        const now = Date.now();
        if(lastHoverCall + 500 < now && e.latlng) {
            lastHoverCall = now;
            const hoveredPx = Map_.map
                .project(e.latlng, this.manager.options.resolution)
                .subtract(this.manager.tileBounds.min.multiplyBy(256))
                .floor();
            const startVal = this.manager.backlink[hoveredPx.y][hoveredPx.x];
            if(startVal !== 0) {
                let cx = hoveredPx.x;
                let cy = hoveredPx.y;
                let step = startVal;
                let line = [toLinePoint(cx, cy)];
                let count = 0;
                while(step !== 0 && count < 50) {
                    let move = backlinkToMove(step);
                    cx += move[1];
                    cy += move[0];
                    line.push(toLinePoint(cx, cy));
                    step = this.manager.backlink[cy][cx];
                    count++;
                }
                if(this.hoverPolyline !== null)
                    this.hoverPolyline.remove(Map_.map);
                this.hoverPolyline = window.L.polyline(line);
                this.hoverPolyline.addTo(Map_.map);
            }
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

    const moveEventContainer = e => IsochroneTool.hoverLine(e);
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
