// See https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf for sightline algorithm

import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import G_ from '../../Basics/Globe_/Globe_'

import SightlineTool_Algorithm from './SightlineTool_Algorithm'

let SightlineTool_Manager = {
    //Never query more than maxNumOfDataTiles for a single sightline
    maxNumOfDataTiles: 100,
    internalNoDataValue: 1010101,
    data: {},
    existingTileData: {},
    existingTileTags: [],
    existingStoreMax: 10000,
    //resolution: 0 (lowest), 1, 2, 3 (highest)
    gather: function (
        sightlineId,
        dataLayer,
        resolution,
        source,
        targetSource,
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

        if (this.data[sightlineId] == null) {
            this.data[sightlineId] = {
                sightlineId: sightlineId,
                dataLayer: dataLayer,
                resolution: resolution,
                source: source,
                targetSource: targetSource,
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
                zoom: Math.max(
                    dataLayer.minZoom || 0,
                    Math.min(
                        Math.round(Map_.map.getZoom()) + resolution,
                        dataLayer.maxNativeZoom
                    )
                ),
                options: options,
                result: [],
            }
            this.data[sightlineId].resolution =
                this.data[sightlineId].zoom - Math.round(Map_.map.getZoom())

            this.updateDesiredTiles(sightlineId)
            this.refreshData(sightlineId)
            this.locateSource(sightlineId)
            this.queryDesiredTiles(sightlineId, progcb, function (dv) {
                SightlineTool_Manager.interpolateSeams(sightlineId)
                SightlineTool_Manager.finishUp(sightlineId)
                SightlineTool_Manager.data[sightlineId].result =
                    SightlineTool_Algorithm.sightline(
                        SightlineTool_Manager.data[sightlineId],
                        options
                    )
                cb(dv)
            })
        } else {
            this.data[sightlineId].source = source
            this.data[sightlineId].options = options
            this.locateSource(sightlineId)
            SightlineTool_Manager.data[sightlineId].result = SightlineTool_Algorithm.sightline(
                SightlineTool_Manager.data[sightlineId],
                options
            )
            cb(this.data[sightlineId])
        }
        return this.data[sightlineId]
    },
    // Fetches DEM tiles once and prepares data, without running the algorithm.
    // Use computeSightline() afterwards to run the algorithm with different targetSources.
    gatherTiles: function (
        sightlineId,
        dataLayer,
        resolution,
        source,
        options,
        vars,
        progcb,
        cb
    ) {
        if (this.existingTileTags.length > this.existingStoreMax) {
            this.existingTileData = {}
            this.existingTileTags = []
        }

        if (this.data[sightlineId] == null) {
            this.data[sightlineId] = {
                sightlineId: sightlineId,
                dataLayer: dataLayer,
                resolution: resolution,
                source: source,
                targetSource: null,
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
                zoom: Math.max(
                    dataLayer.minZoom || 0,
                    Math.min(
                        Math.round(Map_.map.getZoom()) + resolution,
                        dataLayer.maxNativeZoom
                    )
                ),
                options: options,
                result: [],
            }
            this.data[sightlineId].resolution =
                this.data[sightlineId].zoom - Math.round(Map_.map.getZoom())

            this.updateDesiredTiles(sightlineId)
            this.refreshData(sightlineId)
            this.queryDesiredTiles(sightlineId, progcb, function (dv) {
                SightlineTool_Manager.interpolateSeams(sightlineId)
                SightlineTool_Manager.finishUp(sightlineId)
                cb(dv)
            })
        } else {
            this.data[sightlineId].source = source
            this.data[sightlineId].options = options
            cb(this.data[sightlineId])
        }
    },
    // Runs the sightline algorithm on already-gathered tile data with a given targetSource.
    // Returns the resultGrid. Does not mutate data[sightlineId].result.
    computeSightline: function (sightlineId, targetSource, options) {
        const d = this.data[sightlineId]
        if (!d) return null
        if (!d.data || d.data.length === 0) return []

        d.targetSource = targetSource
        d.options = options
        this.locateSource(sightlineId)

        // curveData mutates d.data in-place; let it run on the first call
        // and skip on subsequent calls (hasDataCurved will be true)
        const result = SightlineTool_Algorithm.sightline(d, options)
        return result
    },
    getData: function (sightlineId) {
        return this.data[sightlineId]
    },
    updateDesiredTiles: function (sightlineId) {
        // Find all tiles between the bounds of the viewport and the bounds of the source point

        //viewport
        let viewBounds = Map_.map.getPixelBounds()
        let zoom = this.data[sightlineId].zoom
        let boundsNW = Map_.map.unproject(viewBounds.getTopLeft())
        let boundsSE = Map_.map.unproject(viewBounds.getBottomRight())
        let minPx = Map_.map.project(boundsNW, zoom)
        let maxPx = Map_.map.project(boundsSE, zoom)

        let min = minPx.divideBy(256).floor()
        let max = maxPx.divideBy(256).floor()

        // Clamp to bounding box if the data source defines one.
        // Sample multiple points around the bbox perimeter so that
        // non-equirectangular projections (e.g. polar stereographic)
        // produce a correct pixel-space envelope.
        const rawBbox = this.data[sightlineId].dataLayer.boundingBox
        const bbox = Array.isArray(rawBbox)
            ? rawBbox.map(Number)
            : null
        let bboxTileBounds = null
        if (bbox && bbox.length === 4 && bbox.every((v) => !isNaN(v))) {
            const samples = 8
            let pxMinX = Infinity
            let pxMinY = Infinity
            let pxMaxX = -Infinity
            let pxMaxY = -Infinity
            for (let s = 0; s <= samples; s++) {
                const t = s / samples
                const pts = [
                    L.latLng(bbox[1], bbox[0] + t * (bbox[2] - bbox[0])),
                    L.latLng(bbox[3], bbox[0] + t * (bbox[2] - bbox[0])),
                    L.latLng(bbox[1] + t * (bbox[3] - bbox[1]), bbox[0]),
                    L.latLng(bbox[1] + t * (bbox[3] - bbox[1]), bbox[2]),
                ]
                for (let p = 0; p < pts.length; p++) {
                    const px = Map_.map.project(pts[p], zoom)
                    if (px.x < pxMinX) pxMinX = px.x
                    if (px.y < pxMinY) pxMinY = px.y
                    if (px.x > pxMaxX) pxMaxX = px.x
                    if (px.y > pxMaxY) pxMaxY = px.y
                }
            }
            bboxTileBounds = {
                minX: Math.floor(pxMinX / 256),
                minY: Math.floor(pxMinY / 256),
                maxX: Math.floor(pxMaxX / 256),
                maxY: Math.floor(pxMaxY / 256),
            }
            min.x = Math.max(min.x, bboxTileBounds.minX)
            min.y = Math.max(min.y, bboxTileBounds.minY)
            max.x = Math.min(max.x, bboxTileBounds.maxX)
            max.y = Math.min(max.y, bboxTileBounds.maxY)
        }

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
        let sourceCenter = Map_.map.project(this.data[sightlineId].source, zoom)
        let sourceMin = sourceCenter
            .subtract(halfViewport)
            .divideBy(256)
            .floor()
        let sourceMax = sourceCenter.add(halfViewport).divideBy(256).floor()

        if (bboxTileBounds) {
            sourceMin.x = Math.max(sourceMin.x, bboxTileBounds.minX)
            sourceMin.y = Math.max(sourceMin.y, bboxTileBounds.minY)
            sourceMax.x = Math.min(sourceMax.x, bboxTileBounds.maxX)
            sourceMax.y = Math.min(sourceMax.y, bboxTileBounds.maxY)
        }

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
            // Skip tiles outside the bounding box
            if (bboxTileBounds) {
                if (
                    fullDesiredTiles[i].x < bboxTileBounds.minX ||
                    fullDesiredTiles[i].x > bboxTileBounds.maxX ||
                    fullDesiredTiles[i].y < bboxTileBounds.minY ||
                    fullDesiredTiles[i].y > bboxTileBounds.maxY
                )
                    continue
            }
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

        // Enforce tile limit — prioritize tiles nearest the source point
        if (uniqueDesiredTiles.length > this.maxNumOfDataTiles) {
            const srcTile = Map_.map
                .project(this.data[sightlineId].source, zoom)
                .divideBy(256)
            uniqueDesiredTiles.sort((a, b) => {
                const da =
                    Math.pow(a.x - srcTile.x, 2) +
                    Math.pow(a.y - srcTile.y, 2)
                const db =
                    Math.pow(b.x - srcTile.x, 2) +
                    Math.pow(b.y - srcTile.y, 2)
                return da - db
            })
            uniqueDesiredTiles = uniqueDesiredTiles.slice(
                0,
                this.maxNumOfDataTiles
            )
        }

        this.data[sightlineId].desiredTiles = uniqueDesiredTiles
    },
    // Restores the sightline's data matrix to all 0s,
    // fits it to a box around the desired tiles
    // defines it top left tile
    refreshData: function (sightlineId) {
        this.data[sightlineId].data = []
        if (this.data[sightlineId].desiredTiles.length === 0) return
        let dataBounds = this.getTilesetBounds(this.data[sightlineId].desiredTiles)
        let w =
            (dataBounds.maxX - dataBounds.minX + 1) *
            this.data[sightlineId].tileResolution
        let h =
            (dataBounds.maxY - dataBounds.minY + 1) *
            this.data[sightlineId].tileResolution

        for (let i = 0; i < h; i++) {
            this.data[sightlineId].data.push(
                new Array(w).fill(this.internalNoDataValue)
            )
        }

        this.data[sightlineId].topLeftTile = {
            x: dataBounds.minX,
            y: dataBounds.minY,
            z: this.data[sightlineId].zoom,
            w: w / this.data[sightlineId].tileResolution,
            h: h / this.data[sightlineId].tileResolution,
        }

        this.data[sightlineId].bottomLeftLatLng =
            G_.litho.projection.tileXYZ2LatLng(
                this.data[sightlineId].topLeftTile.x,
                this.data[sightlineId].topLeftTile.y +
                    this.data[sightlineId].topLeftTile.h,
                this.data[sightlineId].topLeftTile.z
            )

        this.data[sightlineId].cellSize =
            G_.litho.projection.tileXYZ2LatLng(
                this.data[sightlineId].topLeftTile.x +
                    1 / this.data[sightlineId].tileResolution,
                this.data[sightlineId].topLeftTile.y +
                    this.data[sightlineId].topLeftTile.h,
                this.data[sightlineId].topLeftTile.z
            ).lng - this.data[sightlineId].bottomLeftLatLng.lng
    },
    locateSource: function (sightlineId) {
        // Locate source
        let dv = this.data[sightlineId]

        let topLeftTile = new L.Point(dv.topLeftTile.x, dv.topLeftTile.y)
        let sourcePoint = Map_.map
            .project(dv.targetSource, dv.zoom)
            .divideBy(256)
        const tilePixelsAcross = dv.tileResolution * Math.pow(2, dv.zoom)
        let source = sourcePoint
            .subtract(topLeftTile)
            .multiplyBy(dv.tileResolution)
            .floor()

        // Wrap to find nearest point — only for projections that actually
        // wrap (default equirectangular / Mercator).  Non-wrapping
        // projections (e.g. polar stereographic) must keep the unwrapped
        // position so that distant sources produce nearly-parallel rays.
        const isCustomCRS =
            L_.configData.projection &&
            L_.configData.projection.custom === true
        if (!isCustomCRS) {
            if (source.x < -tilePixelsAcross / 2)
                source.x += tilePixelsAcross
            if (source.x > tilePixelsAcross / 2)
                source.x -= tilePixelsAcross
            if (source.y < -tilePixelsAcross / 2)
                source.y += tilePixelsAcross
            if (source.y > tilePixelsAcross / 2)
                source.y -= tilePixelsAcross
        }

        this.data[sightlineId].dataSource = source
    },
    queryDesiredTiles: function (sightlineId, progcb, cb) {
        let url = L_.getUrl(
            this.data[sightlineId].dataLayer.type,
            this.data[sightlineId].dataLayer.demtileurl,
            this.data[sightlineId].dataLayer
        )

        let totalTiles = this.data[sightlineId].desiredTiles.length
        if (totalTiles === 0) {
            cb(SightlineTool_Manager.data[sightlineId])
            return
        }
        let tilesLoaded = 0
        let tilesQueried = 0
        let tilesPerStep = 8

        function eachTile(d, start, heights) {
            tilesLoaded++

            if (typeof progcb === 'function') {
                progcb((tilesLoaded / totalTiles) * 100)
            }

            const tileResolution =
                SightlineTool_Manager.data[sightlineId].tileResolution

            let desired = SightlineTool_Manager.data[sightlineId].desiredTiles[d]
            let startingX =
                (desired.x - SightlineTool_Manager.data[sightlineId].topLeftTile.x) *
                tileResolution
            let startingY =
                (desired.y - SightlineTool_Manager.data[sightlineId].topLeftTile.y) *
                tileResolution

            // Store directly for later
            let tTag = desired.z + '_' + desired.x + '_' + desired.y

            if (SightlineTool_Manager.existingTileTags.indexOf(tTag) == -1) {
                let dlname = SightlineTool_Manager.data[sightlineId].dataLayer.name
                SightlineTool_Manager.existingTileData[dlname] =
                    SightlineTool_Manager.existingTileData[dlname] || {}
                SightlineTool_Manager.existingTileData[dlname][desired.z] =
                    SightlineTool_Manager.existingTileData[dlname][desired.z] || {}
                SightlineTool_Manager.existingTileData[dlname][desired.z][
                    desired.x
                ] =
                    SightlineTool_Manager.existingTileData[dlname][desired.z][
                        desired.x
                    ] || {}
                SightlineTool_Manager.existingTileData[dlname][desired.z][
                    desired.x
                ][desired.y] = heights.slice()
                SightlineTool_Manager.existingTileTags.push(tTag)
            }

            // Add to data
            for (let i = 0; i < tileResolution; i++) {
                SightlineTool_Manager.data[sightlineId].data[startingY + i].splice(
                    startingX,
                    tileResolution,
                    ...heights.slice(
                        i * tileResolution,
                        (i + 1) * tileResolution
                    )
                )
            }

            if (tilesLoaded >= totalTiles) {
                cb(SightlineTool_Manager.data[sightlineId])
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

                let desired = SightlineTool_Manager.data[sightlineId].desiredTiles[d]
                let dlname = SightlineTool_Manager.data[sightlineId].dataLayer.name
                let existingHeights = F_.getIn(
                    SightlineTool_Manager.existingTileData,
                    [dlname, desired.z, desired.x, desired.y]
                )

                if (existingHeights) {
                    eachTile(d, start, existingHeights)
                } else {
                    const tile = this.data[sightlineId].desiredTiles[d]
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
                                    SightlineTool_Manager.data[sightlineId]
                                        .tileResolution
                                const trueTileResolution =
                                    SightlineTool_Manager.data[sightlineId]
                                        .tileResolution

                                let rgbaArr = null
                                if (img !== false) {
                                    rgbaArr = img.decode()
                                }

                                if (rgbaArr == null) {
                                    tilesLoaded++
                                    if (tilesLoaded >= totalTiles) {
                                        cb(SightlineTool_Manager.data[sightlineId])
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
                                        SightlineTool_Manager.internalNoDataValue
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
    interpolateSeams(sightlineId) {
        const tileRes = this.data[sightlineId].tileResolution
        const noData = this.internalNoDataValue
        let d = this.data[sightlineId].data
        if (!d || d.length === 0) return

        // Vertical | |
        for (let y = 0; y < d.length; y++) {
            for (let x = 0; x < d[y].length; x += tileRes) {
                if (x - 2 > 0 && x + 2 < d[y].length) {
                    const a = d[y][x - 2]
                    const b = d[y][x + 1]

                    // Skip interpolation across noData boundaries
                    if (a === noData || b === noData) continue

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

                    // Skip interpolation across noData boundaries
                    if (a === noData || b === noData) continue

                    const inc = (a - b) / 3

                    d[y - 1][x] = a - inc
                    d[y][x] = b + inc
                }
            }
        }
    },
    finishUp(sightlineId) {
        const outputZoom = Math.round(Map_.map.getZoom())
        const zoom = this.data[sightlineId].zoom

        const dif = zoom - outputZoom

        const difDim = Math.pow(2, dif)

        this.data[sightlineId].outputTopLeftTile = {
            x: this.data[sightlineId].topLeftTile.x / difDim,
            y: this.data[sightlineId].topLeftTile.y / difDim,
            z: outputZoom,
            w: Math.ceil(this.data[sightlineId].topLeftTile.w / difDim),
            h: Math.ceil(this.data[sightlineId].topLeftTile.h / difDim),
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
    cleanupSeams: function (sightlineId, result) {
        const tileRes = this.data[sightlineId].tileResolution

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
export default SightlineTool_Manager
