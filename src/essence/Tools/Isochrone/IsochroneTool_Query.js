import Map_ from "../../Basics/Map_/Map_";
import F_ from "../../Basics/Formulae_/Formulae_";
import L_ from "../../Basics/Layers_/Layers_";

const MAX_WORKERS = 8;

const QueryManager = {
    cache: {},
    //TODO: queue jobs here
    //(so e.g. two isochrones will load in sequence w/o slowing each other down)
    jobQueue: [],
    jobInProgress: false,
    numWorkers: 0,
    currentJob: null,

    //These may be expanded to maintain a max cache size
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
        //just promisifying png.js
        const queryPromise = new Promise((resolve, reject) => {
            window.PNG.load(url, resolve, reject);
        });

        //PNG.js has no native error callback!
        //This workaround will at least keep things moving
        const timeoutPromise = new Promise((resolve, reject) => {
            window.setTimeout(() => reject(url + ": timed out"), 10000);
        });
        return Promise.race([queryPromise, timeoutPromise]);
    },

    decodePNG: function(img) {
        if (!img) return null;
        let rgbaArr = img.decode();

        const length = rgbaArr.length / 4;
        let heights = new Float32Array(length);
        let p = 0;
        for (let i = 0; i < length; i++) {
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
        if (this.isInCache(url)) {
            return this.cache[url];
        } else {
            const png = await this.getPNG(url).catch(msg => {
                console.log(msg);
                return null;
            });
            const data = this.decodePNG(png);
            this.addToCache(url, data);
            return data;
        }
    }
}

class QueryJob {
    constructor({tileurl, resolution, interpolateSeams}, tileList, bounds) {
        this.tileurl = F_.isUrlAbsolute(tileurl) ? tileurl : L_.missionPath + tileurl;
        this.tileList = tileList;
        this.bounds = bounds;
        this.resolution = resolution;
        this.interpolateSeams = interpolateSeams;

        this.active = false;
        this.tilesQueried = 0;
        this.tilesLoaded = 0;
        this.numWorkers = 0;
        this.numTiles = tileList.length;

        this.onStop = () => {};

        this.size = bounds.getSize().multiplyBy(256);
        this.result = [];
        for (let y = 0; y < this.size.y; y++) {
            this.result.push(new Float32Array(this.size.x).fill(Infinity));
        }
    }

    /**
     * Start this job loading tiles
     * @param {Function} onStart Function to call when the job starts
     * @param {Function} onProgress Function to call to update progress on the job
     * @param {Function} onEnd Function to call when the job ends
     * @returns 
     */
    start(onStart = () => {}, onProgress = () => {}, onEnd = () => {}) {
        this.active = true;
        this.onStop = onEnd;

        return new Promise((resolve, reject) => {
            const createHandler = tile => result => {
                if (result) {
                    this.handleTileData(tile, result);
                }
                this.numWorkers--;
                this.tilesLoaded++;
                onProgress(this.tilesLoaded / this.numTiles);
                startNextQuery();
            };

            const startNextQuery = () => {
                if (!this.active) {
                    reject("Query job stopped.");
                } else if (this.numWorkers < MAX_WORKERS && this.tilesQueried < this.numTiles) {
                    const currentTile = this.tileList[this.tilesQueried];
                    QueryManager.getTile(this.tileurl, currentTile)
                        .then(createHandler(currentTile));
                    
                    this.tilesQueried++;
                    this.numWorkers++;
                    startNextQuery();
                } else if (this.numWorkers === 0 && this.tilesQueried === this.numTiles) {
                    this.processLoadedData();
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
        for (let y = 0; y < this.resolution; y++) {
            const yResult = y + startY;
            const dataRow = data.slice(y * this.resolution, (y + 1) * this.resolution);
            this.result[yResult].set(dataRow, startX);
        }
    }

    processLoadedData() { //ViewshedTool_Manager.js (function interpolateSeams)
        if(!this.interpolateSeams) return;

        // Vertical | |
        const maxX = this.size.x - this.resolution;
        for (let x = this.resolution; x < maxX; x += this.resolution) {
            for (let y = 0; y < this.size.y; y++) {
                if (this.result[y][x - 1] === this.result[y][x] && isFinite(this.result[y][x])) {
                    const a = this.result[y][x - 2];
                    const b = this.result[y][x + 1];

                    const inc = (a - b) / 3;

                    this.result[y][x - 1] = a - inc;
                    this.result[y][x] = b + inc;
                }
            }
        }

        // Horizontal _ _
        const maxY = this.size.y - this.resolution;
        for (let y = this.resolution; y < maxY; y += this.resolution) {
            for (let x = 0; x < this.size.x; x++) {
                if (this.result[y - 1][x] === this.result[y][x] && isFinite(this.result[y][x])) {
                    const a = this.result[y - 2][x];
                    const b = this.result[y + 1][x];

                    const inc = (a - b) / 3;

                    this.result[y - 1][x] = a - inc;
                    this.result[y][x] = b + inc;
                }
            }
        }
    }

    /** Stop a job in progress */
    stop() {
        this.onStop();
        this.active = false;
    }
}

export default QueryJob;
