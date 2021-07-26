import Map_ from "../../Basics/Map_/Map_";
import F_ from "../../Basics/Formulae_/Formulae_";
import L_ from "../../Basics/Layers_/Layers_";

import * as D from "./IsochroneTool_Util";

const IsochroneTool_DataManager = {
    cache: {},
    //TODO: fix all this. yikes!
    queryTiles: function(
        url,
        requiredTiles,
        bounds,
        resolution,
        callback
    ) {
        if(!F_.isUrlAbsolute(url)) url = L_.missionPath + url;

        const pxWorldBound = Map_.map.getPixelWorldBounds(requiredTiles[0].z);
        const yTileWorldBound = Math.ceil(pxWorldBound.max.y / 256) - 1;

        const totalTiles = requiredTiles.length;
        const tilesPerStep = 8;
        let nextStep = tilesPerStep;
        let tilesQueried = 0, tilesLoaded = 0;

        let queryReturnData = D.createDataArray(
            (bounds.max.x - bounds.min.x) * 256,
            (bounds.max.y - bounds.min.y) * 256,
            Infinity
        );

        function eachTile(tileInfo, tileData) {
            const startX = tileInfo.relX * resolution;
            const startY = tileInfo.relY * resolution;
            for(let y = 0; y < resolution; y++) {
                const yResult = y + startY;
                const dataRow = tileData.slice(y * resolution, (y + 1) * resolution);
                queryReturnData[yResult].splice(startX, resolution, ...dataRow);
            }
            registerLoadedTile();
        }

        function registerLoadedTile() {
            tilesLoaded++;

            if(tilesLoaded >= totalTiles) {
                //console.log("QUERY DATA", queryReturnData);
                callback(queryReturnData);
            } else if(tilesLoaded >= nextStep) {
                query();
            }
        }

        const cache = (url, data) => this.cache[url] = data;

        const query = () => {
            const start = tilesQueried;
            nextStep = tilesQueried + tilesPerStep;
            for(let d = start; d < totalTiles && d < nextStep; d++) {
                tilesQueried++;

                let queryUrl = url.replace('{x}', requiredTiles[d].x);
                queryUrl = queryUrl.replace('{y}', yTileWorldBound - requiredTiles[d].y);
                queryUrl = queryUrl.replace('{z}', requiredTiles[d].z);

                if(IsochroneTool_DataManager.cache[queryUrl] !== undefined) {
                    if(IsochroneTool_DataManager.cache[queryUrl] === null) {
                        registerLoadedTile();
                    } else {
                        eachTile(requiredTiles[d], IsochroneTool_DataManager.cache[queryUrl]);
                    }
                } else {
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

                        const length = resolution * resolution;
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

                        cache(queryUrl, heights);
                        eachTile(requiredTiles[d], heights);
                    })(d), (d => function () {
                        cache(queryUrl, null);
                        registerLoadedTile();
                    })(d));
                }
            }
        }

        query();
    }
}

export default IsochroneTool_DataManager;