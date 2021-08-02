import Map_ from "../../Basics/Map_/Map_";
import F_ from "../../Basics/Formulae_/Formulae_";
import L_ from "../../Basics/Layers_/Layers_";

import * as D from "./IsochroneTool_Util";

const MAX_WORKERS = 8;

const QueryManager = {
    cache: {},
    //TODO: centralize job queue?
    jobQueue: [],
    jobInProgress: false,
    numWorkers: 0,
    currentJob: null,

    //TODO: expand these to maintain a max cache size
    isInCache: url => QueryManager.cache[url] !== undefined,
    addToCache: (url, data) => QueryManager.cache[url] = data,

    fillUrl: function(url, tile) {
        const pxWorldBound = Map_.map.getPixelWorldBounds(tile.z);
        const yTileWorldBound = Math.ceil(pxWorldBound.max.y / 256) - 1;

        let filledUrl = url.replace('{x}', tile.x);
        filledUrl = filledUrl.replace('{y}', yTileWorldBound - tile.y);
        filledUrl = filledUrl.replace('{z}', tile.z);
        return filledUrl;
    },

    getPNG: function(url) {
        //Basically just promisifying png.js
        const queryPromise = new Promise((resolve, reject) => {
            window.PNG.load(url, resolve, reject);
        });

        //PNG.JS HAS NO NATIVE ERROR CALLBACK!
        //Here's a terrible workaround to at least keep things moving
        const timeoutPromise = new Promise((resolve, reject) => {
            window.setTimeout(1000, () => reject(url + ": timed out"));
        });
        return Promise.race([queryPromise, timeoutPromise]);
    },

    decodePNG: function(img) {
        if(!img) return null;
        let rgbaArr = img.decode();

        const length = rgbaArr.length / 4;
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
        return heights;
    },

    getTile: async function(urlTemplate, tile) {
        const url = this.fillUrl(urlTemplate, tile);
        if(this.isInCache(url)) {
            return this.cache[url];
        } else {
            const png = await this.getPNG(url).catch(msg => {
                console.log(msg);
                return null;
            });
            const data = this.decodePNG(png);
            this.cache[url] = data;
            return data;
        }
    }
}

const emptyFunc = () => {};

class QueryJob {
    constructor({tileurl, resolution}, tileList, bounds) {
        this.tileurl = F_.isUrlAbsolute(tileurl) ? tileurl : L_.missionPath + tileurl;
        this.tileList = tileList;
        this.bounds = bounds;
        this.resolution = resolution;

        this.active = false;
        this.tilesQueried = 0;
        this.tilesLoaded = 0;
        this.numWorkers = 0;
        this.numTiles = tileList.length;

        this.result = D.createDataArray(
            (bounds.max.x - bounds.min.x) * 256,
            (bounds.max.y - bounds.min.y) * 256,
            Infinity,
            Float32Array
        );
    }

    start(onStart = emptyFunc, onProgress = emptyFunc, onEnd = emptyFunc) {
        this.active = true;

        return new Promise((resolve, reject) => {
            const createHandler = tile => result => {
                if(result) this.handleTileData(tile, result);
                this.numWorkers--;
                this.tilesLoaded++;
                onProgress(this.tilesLoaded / this.numTiles);
                startNextQuery();
            };

            const startNextQuery = () => {
                if(!this.active) {
                    onEnd();
                    reject("Query job stopped.");
                } else if(this.numWorkers < MAX_WORKERS && this.tilesQueried < this.numTiles) {
                    const currentTile = this.tileList[this.tilesQueried];
                    QueryManager.getTile(this.tileurl, currentTile)
                        .then(createHandler(currentTile));
                    this.tilesQueried++;
                    this.numWorkers++;
                    startNextQuery();
                } else if(this.numWorkers === 0 && this.tilesQueried === this.numTiles) {
                    this.active = false;
                    onEnd();
                    resolve(this.result);
                }
            };

            onStart();
            startNextQuery();
        });
    }

    handleTileData(tile, data) {
        const startX = tile.relX * this.resolution;
        const startY = tile.relY * this.resolution;
        for(let y = 0; y < this.resolution; y++) {
            const yResult = y + startY;
            const dataRow = data.slice(y * this.resolution, (y + 1) * this.resolution);
            this.result[yResult].set(dataRow, startX);
        }
    }

    stop() {
        this.active = false;
        //QueryManager.onJobFinish();
    }
}

export default QueryJob;
