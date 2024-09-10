// See https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf for viewshedding algorithm

import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import G_ from '../../Basics/Globe_/Globe_'

import ViewshedTool_Algorithm from './ViewshedTool_Algorithm'

let ViewshedTool_Manager = {
    //Never query more than maxNumOfDataTiles for a single viewshed
    maxNumOfDataTiles: 100,
    internalNoDataValue: 1010101,
    data: {},
    existingTileData: {},
    existingTileTags: [],
    existingStoreMax: 10000,
    //resolution: 0 (lowest), 1, 2, 3 (highest)
    gather: function (
        viewshedId,
        dataLayer,
        resolution,
        source,
        options,
        vars,
        progcb,
        cb
    ) {
        // Stop existing tiles from getting too big
        if (this.existingTileTags.length > this.existingStoreMax) {
            // Purge
            this.existingTileData = {}
            this.existingTileTags = []
        }

        if (this.data[viewshedId] == null) {
            this.data[viewshedId] = {
                viewshedId: viewshedId,
                dataLayer: dataLayer,
                resolution: resolution,
                source: source,
                desiredTiles: [],
                topLeftTile: {},
                bottomLeftLatLng: {},
                cellSize: 0,
                outputTopLeftTile: {},
                tileResolution: 32,
                tiles: {},
                data: [],
                dataSource: {},
                useCurvature: vars.hasOwnProperty('curvature')
                    ? vars.curvature
                    : true,
                hasDataCurved: false,
                zoom: Math.min(
                    Math.round(Map_.map.getZoom()) + resolution,
                    dataLayer.maxNativeZoom
                ),
                options: options,
                result: [],
            }
            this.data[viewshedId].resolution =
                this.data[viewshedId].zoom - Math.round(Map_.map.getZoom())

            this.updateDesiredTiles(viewshedId)
            this.refreshData(viewshedId)
            this.locateSource(viewshedId)
            this.queryDesiredTiles(viewshedId, progcb, function (dv) {
                ViewshedTool_Manager.interpolateSeams(viewshedId)
                ViewshedTool_Manager.finishUp(viewshedId)
                ViewshedTool_Manager.data[viewshedId].result =
                    ViewshedTool_Algorithm.viewshed(
                        ViewshedTool_Manager.data[viewshedId],
                        options
                    )
                cb(dv)
            })
        } else {
            this.data[viewshedId].source = source
            this.data[viewshedId].options = options
            this.locateSource(viewshedId)
            ViewshedTool_Manager.data[viewshedId].result =
                ViewshedTool_Algorithm.viewshed(
                    ViewshedTool_Manager.data[viewshedId],
                    options
                )
            cb(this.data[viewshedId])
        }
        return this.data[viewshedId]
    },
    getData: function (viewshedId) {
        return this.data[viewshedId]
    },
    updateDesiredTiles: function (viewshedId) {
        // Find all tiles between the bounds of the viewport and the bounds of the source point

        //viewport
        let viewBounds = Map_.map.getPixelBounds()
        let zoom = this.data[viewshedId].zoom
        let boundsNW = Map_.map.unproject(viewBounds.getTopLeft())
        let boundsSE = Map_.map.unproject(viewBounds.getBottomRight())
        let minPx = Map_.map.project(boundsNW, zoom)
        let maxPx = Map_.map.project(boundsSE, zoom)

        let min = minPx.divideBy(256).floor()
        let max = maxPx.divideBy(256).floor()

        let viewportDesiredTiles = []
        for (let i = min.x; i <= max.x; i++) {
            for (let j = min.y; j <= max.y; j++) {
                let coords = new L.Point(i, j)
                coords.z = zoom
                viewportDesiredTiles.push(coords)
            }
        }

        //source
        let halfViewport = L.bounds(minPx, maxPx).getSize().divideBy(2)
        let sourceCenter = Map_.map.project(this.data[viewshedId].source, zoom)
        let sourceMin = sourceCenter
            .subtract(halfViewport)
            .divideBy(256)
            .floor()
        let sourceMax = sourceCenter.add(halfViewport).divideBy(256).floor()

        let sourceDesiredTiles = []
        for (let i = sourceMin.x; i <= sourceMax.x; i++) {
            for (let j = sourceMin.y; j <= sourceMax.y; j++) {
                let coords = new L.Point(i, j)
                coords.z = zoom
                sourceDesiredTiles.push(coords)
            }
        }

        //Fill in between

        // Normalized steps from viewport to source
        let greatestViewportTile = this.getGreatestTile(viewportDesiredTiles)
        let greatestSourceTile = this.getGreatestTile(sourceDesiredTiles)
        let maxStepX = greatestSourceTile.x - greatestViewportTile.x
        let maxStepY = greatestSourceTile.y - greatestViewportTile.y
        let normalizer = Math.max(Math.abs(maxStepX), Math.abs(maxStepY))
        let stepX = maxStepX / normalizer
        let stepY = maxStepY / normalizer

        let desiredTiles = []

        for (let i = 1; i < normalizer; i++) {
            for (let v = 0; v < viewportDesiredTiles.length; v++) {
                desiredTiles.push({
                    x: viewportDesiredTiles[v].x + parseInt(stepX * i),
                    y: viewportDesiredTiles[v].y + parseInt(stepY * i),
                    z: viewportDesiredTiles[v].z,
                })
            }
        }

        // Merge and make unique
        let fullDesiredTiles = desiredTiles
            .concat(viewportDesiredTiles)
            .concat(sourceDesiredTiles)

        let tileTags = []
        let uniqueDesiredTiles = []
        for (let i = 0; i < fullDesiredTiles.length; i++) {
            const t =
                fullDesiredTiles[i].z +
                '-' +
                fullDesiredTiles[i].x +
                '-' +
                fullDesiredTiles[i].y
            if (tileTags.indexOf(t) == -1) {
                uniqueDesiredTiles.push(fullDesiredTiles[i])
                tileTags.push(t)
            }
        }

        this.data[viewshedId].desiredTiles = uniqueDesiredTiles
    },
    // Restores the viewshed's data matrix to all 0s,
    // fits it to a box around the desired tiles
    // defines it top left tile
    refreshData: function (viewshedId) {
        this.data[viewshedId].data = []
        let dataBounds = this.getTilesetBounds(
            this.data[viewshedId].desiredTiles
        )
        let w =
            (dataBounds.maxX - dataBounds.minX + 1) *
            this.data[viewshedId].tileResolution
        let h =
            (dataBounds.maxY - dataBounds.minY + 1) *
            this.data[viewshedId].tileResolution

        for (let i = 0; i < h; i++) {
            this.data[viewshedId].data.push(new Array(w).fill(0))
        }

        this.data[viewshedId].topLeftTile = {
            x: dataBounds.minX,
            y: dataBounds.minY,
            z: this.data[viewshedId].zoom,
            w: w / this.data[viewshedId].tileResolution,
            h: h / this.data[viewshedId].tileResolution,
        }

        this.data[viewshedId].bottomLeftLatLng =
            G_.litho.projection.tileXYZ2LatLng(
                this.data[viewshedId].topLeftTile.x,
                this.data[viewshedId].topLeftTile.y +
                    this.data[viewshedId].topLeftTile.h,
                this.data[viewshedId].topLeftTile.z
            )

        this.data[viewshedId].cellSize =
            G_.litho.projection.tileXYZ2LatLng(
                this.data[viewshedId].topLeftTile.x +
                    1 / this.data[viewshedId].tileResolution,
                this.data[viewshedId].topLeftTile.y +
                    this.data[viewshedId].topLeftTile.h,
                this.data[viewshedId].topLeftTile.z
            ).lng - this.data[viewshedId].bottomLeftLatLng.lng
    },
    locateSource: function (viewshedId) {
        // Locate source
        let dv = this.data[viewshedId]

        let topLeftTile = new L.Point(dv.topLeftTile.x, dv.topLeftTile.y)
        let sourcePoint = Map_.map.project(dv.source, dv.zoom).divideBy(256)
        this.data[viewshedId].dataSource = sourcePoint
            .subtract(topLeftTile)
            .multiplyBy(dv.tileResolution)
            .floor()
    },
    queryDesiredTiles: function (viewshedId, progcb, cb) {
        let url = L_.getUrl(
            this.data[viewshedId].dataLayer.type,
            this.data[viewshedId].dataLayer.demtileurl,
            this.data[viewshedId].dataLayer
        )

        let totalTiles = this.data[viewshedId].desiredTiles.length
        let tilesLoaded = 0
        let tilesQueried = 0
        let tilesPerStep = 8

        function eachTile(d, start, heights) {
            tilesLoaded++

            if (typeof progcb === 'function') {
                progcb((tilesLoaded / totalTiles) * 100)
            }

            const tileResolution =
                ViewshedTool_Manager.data[viewshedId].tileResolution

            let desired = ViewshedTool_Manager.data[viewshedId].desiredTiles[d]
            let startingX =
                (desired.x -
                    ViewshedTool_Manager.data[viewshedId].topLeftTile.x) *
                tileResolution
            let startingY =
                (desired.y -
                    ViewshedTool_Manager.data[viewshedId].topLeftTile.y) *
                tileResolution

            // Store directly for later
            let tTag = desired.z + '_' + desired.x + '_' + desired.y

            if (ViewshedTool_Manager.existingTileTags.indexOf(tTag) == -1) {
                let dlname =
                    ViewshedTool_Manager.data[viewshedId].dataLayer.name
                ViewshedTool_Manager.existingTileData[dlname] =
                    ViewshedTool_Manager.existingTileData[dlname] || {}
                ViewshedTool_Manager.existingTileData[dlname][desired.z] =
                    ViewshedTool_Manager.existingTileData[dlname][desired.z] ||
                    {}
                ViewshedTool_Manager.existingTileData[dlname][desired.z][
                    desired.x
                ] =
                    ViewshedTool_Manager.existingTileData[dlname][desired.z][
                        desired.x
                    ] || {}
                ViewshedTool_Manager.existingTileData[dlname][desired.z][
                    desired.x
                ][desired.y] = heights.slice()
                ViewshedTool_Manager.existingTileTags.push(tTag)
            }

            // Add to data
            for (let i = 0; i < tileResolution; i++) {
                ViewshedTool_Manager.data[viewshedId].data[
                    startingY + i
                ].splice(
                    startingX,
                    tileResolution,
                    ...heights.slice(
                        i * tileResolution,
                        (i + 1) * tileResolution
                    )
                )
            }

            if (tilesLoaded >= totalTiles) {
                cb(ViewshedTool_Manager.data[viewshedId])
            } else if (d == start + tilesPerStep - 1) {
                query()
            }
        }
        let ts = []
        const query = () => {
            let start = tilesQueried
            for (
                let d = start;
                d < totalTiles && d < start + tilesPerStep;
                d++
            ) {
                tilesQueried++

                let desired =
                    ViewshedTool_Manager.data[viewshedId].desiredTiles[d]
                let dlname =
                    ViewshedTool_Manager.data[viewshedId].dataLayer.name
                let existingHeights = F_.getIn(
                    ViewshedTool_Manager.existingTileData,
                    [dlname, desired.z, desired.x, desired.y]
                )

                if (existingHeights) {
                    eachTile(d, start, existingHeights)
                } else {
                    const tile = this.data[viewshedId].desiredTiles[d]
                    const pxWorldBound = Map_.map.getPixelWorldBounds(tile.z)
                    const yTileWorldBound =
                        Math.ceil(pxWorldBound.max.y / 256) - 1

                    let filledUrl = url.replace('{x}', tile.x)
                    filledUrl = filledUrl.replace(
                        '{y}',
                        yTileWorldBound - tile.y
                    )
                    filledUrl = filledUrl.replace('{z}', tile.z)
                    PNG.load(
                        filledUrl,
                        (function (d) {
                            return function (img) {
                                const tileResolution =
                                    ViewshedTool_Manager.data[viewshedId]
                                        .tileResolution
                                const trueTileResolution =
                                    ViewshedTool_Manager.data[viewshedId]
                                        .tileResolution

                                let rgbaArr = null
                                if (img !== false) {
                                    rgbaArr = img.decode()
                                }

                                if (rgbaArr == null) {
                                    tilesLoaded++
                                    if (tilesLoaded >= totalTiles) {
                                        cb(
                                            ViewshedTool_Manager.data[
                                                viewshedId
                                            ]
                                        )
                                    } else if (d == start + tilesPerStep - 1) {
                                        query()
                                    }
                                    return
                                }

                                let cnt = 0

                                let heights = new Float32Array(
                                    Math.pow(tileResolution, 2)
                                )

                                for (let i = 0; i < heights.length; i++) {
                                    heights[i] =
                                        F_.RGBAto32({
                                            r: rgbaArr[cnt],
                                            g: rgbaArr[cnt + 1],
                                            b: rgbaArr[cnt + 2],
                                            a: rgbaArr[cnt + 3],
                                        }) ||
                                        ViewshedTool_Manager.internalNoDataValue
                                    cnt +=
                                        4 *
                                        parseInt(
                                            trueTileResolution / tileResolution
                                        )
                                }

                                eachTile(d, start, heights)
                            }
                        })(d),
                        true
                    )
                }
            }
        }

        query(tilesLoaded)
    },
    interpolateSeams(viewshedId) {
        const tileRes = this.data[viewshedId].tileResolution
        let d = this.data[viewshedId].data

        // Vertical | |
        for (let y = 0; y < d.length; y++) {
            for (let x = 0; x < d[y].length; x += tileRes) {
                if (x - 2 > 0 && x + 2 < d[y].length) {
                    const a = d[y][x - 2]
                    const b = d[y][x + 1]

                    const inc = (a - b) / 3

                    d[y][x - 1] = a - inc
                    d[y][x] = b + inc
                }
            }
        }

        // Horizontal _ _
        for (let x = 0; x < d[0].length; x++) {
            for (let y = 0; y < d.length; y += tileRes) {
                if (d[y - 2] && d[y + 1]) {
                    const a = d[y - 2][x]
                    const b = d[y + 1][x]

                    const inc = (a - b) / 3

                    d[y - 1][x] = a - inc
                    d[y][x] = b + inc
                }
            }
        }
    },
    finishUp(viewshedId) {
        const outputZoom = Math.round(Map_.map.getZoom())
        const zoom = this.data[viewshedId].zoom

        const dif = zoom - outputZoom

        const difDim = Math.pow(2, dif)

        this.data[viewshedId].outputTopLeftTile = {
            x: this.data[viewshedId].topLeftTile.x / difDim,
            y: this.data[viewshedId].topLeftTile.y / difDim,
            z: outputZoom,
            w: Math.ceil(this.data[viewshedId].topLeftTile.w / difDim),
            h: Math.ceil(this.data[viewshedId].topLeftTile.h / difDim),
        }
    },
    getGreatestTile: function (tiles) {
        //Assumes tiles are a grid
        let greatest = { x: 0, y: 0, z: 0 }
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].x > greatest.x || tiles[i].y > greatest.y)
                greatest = tiles[i]
        }
        return greatest
    },
    getTilesetBounds: function (tiles) {
        //Assumes tiles are a grid
        let bounds = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
        }
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].x < bounds.minX) bounds.minX = tiles[i].x
            if (tiles[i].x > bounds.maxX) bounds.maxX = tiles[i].x
            if (tiles[i].y < bounds.minY) bounds.minY = tiles[i].y
            if (tiles[i].y > bounds.maxY) bounds.maxY = tiles[i].y
        }
        return bounds
    },
    cleanupSeams: function (viewshedId, result) {
        const tileRes = this.data[viewshedId].tileResolution

        // Vertical fill | |
        for (let y = 0; y < result.length; y++) {
            for (let x = 0; x < result[y].length; x += tileRes) {
                if (result[y][x - 2] == 1) {
                    result[y][x - 1] = 1
                }

                if (result[y][x + 1] == 1) {
                    result[y][x] = 1
                }
            }
        }

        // Horizontal fill _ _
        for (let x = 0; x < result[0].length; x++) {
            for (let y = 0; y < result.length; y += tileRes) {
                if (result[y - 2] && result[y - 2][x] == 1) {
                    result[y - 1][x] = 1
                }
                if (result[y + 1] && result[y + 1][x] == 1) {
                    result[y][x] = 1
                }
            }
        }

        return result
    },
}
export default ViewshedTool_Manager
