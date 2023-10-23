// See https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf for shadeding algorithm
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import G_ from '../../Basics/Globe_/Globe_'

let ShadeTool_Algorithm = {
    // Returns a shade grid where
    // 0: hidden
    // 1: visible
    // 2: observer
    // 8: visible but not within elevation bounds
    // 9: no data
    perOctant: false,
    shade: function (d) {
        this.curveData(d)
        /*
            console.log(d)
            // TESTING =====
            d.data = [
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 2, 2, 2],
                [0, 0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
            ]
            d.source.height = 2
            d.dataSource = { x: 6, y: 1 }
            // END
            */

        let grids = this.initializeGrids(d)

        //this.processFirst(d, grids)
        if (d.targetSource.altitude > 0) {
            this.processUp(d, grids)
            this.processDown(d, grids)

            this.mask(d, grids)
        }

        //console.log(grids)

        return grids.resultGrid
    },
    initializeGrids: function (d) {
        // Initialize grids with the same dimensions as the data grid and with 0s
        let refGrid = []
        let resultGrid = []
        for (let i = 0; i < d.data.length; i++) {
            refGrid.push(new Array(d.data[0].length).fill(0))
            resultGrid.push(new Array(d.data[0].length).fill(0))
        }

        // We're going to say that all edges (2px thick) of the screen/data are visible

        // Top and Bottom
        for (let x = 0; x < d.data[0].length; x++) {
            refGrid[0][x] = d.data[0][x]
            refGrid[1][x] = d.data[1][x]
            resultGrid[0][x] = 1
            resultGrid[1][x] = 1
            refGrid[d.data.length - 1][x] = d.data[d.data.length - 1][x]
            refGrid[d.data.length - 2][x] = d.data[d.data.length - 2][x]
            resultGrid[d.data.length - 1][x] = 1
            resultGrid[d.data.length - 2][x] = 1
        }
        // Right and Left
        for (let y = 0; y < d.data.length; y++) {
            refGrid[y][0] = d.data[y][0]
            refGrid[y][1] = d.data[y][1]
            resultGrid[y][0] = 1
            resultGrid[y][1] = 1
            refGrid[y][d.data[0].length - 1] = d.data[y][d.data[0].length - 1]
            refGrid[y][d.data[0].length - 2] = d.data[y][d.data[0].length - 2]
            resultGrid[y][d.data[0].length - 1] = 1
            resultGrid[y][d.data[0].length - 2] = 1
        }

        return { refGrid, resultGrid }
    },
    // Shades the "horizontal x" axis
    processFirst: function (d, g) {
        const o = d.dataSource //observer

        const observerHeight = g.refGrid[o.y][o.x] + d.source.height
        let dataH

        // Process Left
        for (let i = o.x - 2; i >= 0; i--) {
            g.refGrid[o.y][i] = this.calcHeightLine(
                i - o.x,
                g.refGrid[o.y][i + 1],
                observerHeight
            )

            // Set visibility if our value is less than the data's
            dataH = d.data[o.y][i] + d.options.targetHeight
            if (g.refGrid[o.y][i] <= dataH) {
                if (this.isInElevationFOV(d, i, o.y, observerHeight, dataH))
                    g.resultGrid[o.y][i] = 1
                else g.resultGrid[o.y][i] = 0 //8
            }

            // Check if NoData
            if (ShadeTool_Algorithm.isNoData(d.data[o.y][i]))
                g.resultGrid[o.y][i] = 9

            // Set ref position to the greater: plane height or actual elevation
            g.refGrid[o.y][i] = Math.max(g.refGrid[o.y][i], d.data[o.y][i])
        }

        // Process Right
        for (let i = o.x + 2; i < d.data[0].length; i++) {
            g.refGrid[o.y][i] = this.calcHeightLine(
                i - o.x,
                g.refGrid[o.y][i - 1],
                observerHeight
            )

            // Set visibility if our value is less than the data's
            dataH = d.data[o.y][i] + d.options.targetHeight
            if (g.refGrid[o.y][i] <= dataH) {
                if (this.isInElevationFOV(d, i, o.y, observerHeight, dataH))
                    g.resultGrid[o.y][i] = 1
                else g.resultGrid[o.y][i] = 0 //8
            }

            // Check if NoData
            if (ShadeTool_Algorithm.isNoData(d.data[o.y][i]))
                g.resultGrid[o.y][i] = 9

            // Set ref position to the greater: plane height or actual elevation
            g.refGrid[o.y][i] = Math.max(g.refGrid[o.y][i], d.data[o.y][i])
        }

        // Process Up
        for (let j = o.y - 2; j >= 0; j--) {
            g.refGrid[j][o.x] = this.calcHeightLine(
                j - o.y,
                g.refGrid[j + 1][o.x],
                observerHeight
            )

            // Set visibility if our value is less than the data's
            dataH = d.data[j][o.x] + d.options.targetHeight
            if (g.refGrid[j][o.x] <= dataH) {
                if (this.isInElevationFOV(d, o.x, j, observerHeight, dataH))
                    g.resultGrid[j][o.x] = 1
                else g.resultGrid[j][o.x] = 0 //8
            }

            // Check if NoData
            if (ShadeTool_Algorithm.isNoData(d.data[j][o.x]))
                g.resultGrid[j][o.x] = 9

            // Set ref position to the greater: plane height or actual elevation
            g.refGrid[j][o.x] = Math.max(g.refGrid[j][o.x], d.data[j][o.x])
        }

        // Process Down
        for (let j = o.y + 2; j < d.data.length; j++) {
            g.refGrid[j][o.x] = this.calcHeightLine(
                j - o.y,
                g.refGrid[j - 1][o.x],
                observerHeight
            )

            // Set visibility if our value is less than the data's
            dataH = d.data[j][o.x] + d.options.targetHeight
            if (g.refGrid[j][o.x] <= dataH) {
                if (this.isInElevationFOV(d, o.x, j, observerHeight, dataH))
                    g.resultGrid[j][o.x] = 1
                else g.resultGrid[j][o.x] = 0 //8
            }

            // Check if NoData
            if (ShadeTool_Algorithm.isNoData(d.data[j][o.x]))
                g.resultGrid[j][o.x] = 9

            // Set ref position to the greater: plane height or actual elevation
            g.refGrid[j][o.x] = Math.max(g.refGrid[j][o.x], d.data[j][o.x])
        }
    },
    processUp: function (d, g) {
        const o = d.dataSource //observer

        const observerHeight = d.targetSource.altitude
        let dataH

        // Scan Up
        for (let j = Math.min(d.data.length - 2, o.y - 1); j >= 0; j--) {
            // Process Left
            for (let i = Math.min(d.data[0].length - 2, o.x - 1); i >= 0; i--) {
                if (ShadeTool_Algorithm.perOctant) {
                    g.refGrid[j][i] =
                        i - o.x < j - o.y
                            ? this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j][i + 1],
                                  i - o.x + 1,
                                  j - o.y,
                                  g.refGrid[j + 1][i + 1],
                                  i - o.x + 1,
                                  j - o.y + 1,
                                  observerHeight
                              )
                            : this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j + 1][i],
                                  i - o.x,
                                  j - o.y + 1,
                                  g.refGrid[j + 1][i + 1],
                                  i - o.x + 1,
                                  j - o.y + 1,
                                  observerHeight
                              )
                } else {
                    g.refGrid[j][i] = this.calcHeightDiagonal(
                        i - o.x,
                        j - o.y,
                        g.refGrid[j][i + 1],
                        g.refGrid[j + 1][i],
                        observerHeight
                    )
                }

                // Set visibility if our value is less than the data's
                dataH = d.data[j][i] + d.options.targetHeight
                if (g.refGrid[j][i] <= dataH) {
                    if (this.isInElevationFOV(d, i, j, observerHeight, dataH))
                        g.resultGrid[j][i] = 1
                    else g.resultGrid[j][i] = 0 //8
                }

                // Check if NoData
                if (ShadeTool_Algorithm.isNoData(d.data[j][i]))
                    g.resultGrid[j][i] = 9

                // Set ref position to the greater: plane height or actual elevation
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
            }

            // Process Right
            for (let i = Math.max(1, o.x + 1); i < d.data[0].length; i++) {
                if (ShadeTool_Algorithm.perOctant) {
                    g.refGrid[j][i] =
                        i - o.x > Math.abs(j - o.y)
                            ? this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j][i - 1],
                                  i - o.x - 1,
                                  j - o.y,
                                  g.refGrid[j + 1][i - 1],
                                  i - o.x - 1,
                                  j - o.y + 1,
                                  observerHeight
                              )
                            : this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j + 1][i],
                                  i - o.x,
                                  j - o.y + 1,
                                  g.refGrid[j + 1][i - 1],
                                  i - o.x - 1,
                                  j - o.y + 1,
                                  observerHeight
                              )
                } else {
                    g.refGrid[j][i] = this.calcHeightDiagonal(
                        i - o.x,
                        j - o.y,
                        g.refGrid[j][i - 1],
                        g.refGrid[j + 1][i],
                        observerHeight
                    )
                }

                // Set visibility if our value is less than the data's
                dataH = d.data[j][i] + d.options.targetHeight
                if (g.refGrid[j][i] <= dataH) {
                    if (this.isInElevationFOV(d, i, j, observerHeight, dataH))
                        g.resultGrid[j][i] = 1
                    else g.resultGrid[j][i] = 0 //8
                }

                // Check if NoData
                if (ShadeTool_Algorithm.isNoData(d.data[j][i]))
                    g.resultGrid[j][i] = 9

                // Set ref position to the greater: plane height or actual elevation
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
            }
        }
    },
    processDown: function (d, g) {
        const o = d.dataSource //observer

        const observerHeight = d.targetSource.altitude
        let dataH

        // Scan Down
        for (let j = Math.max(1, o.y + 1); j < d.data.length; j++) {
            // Process Left
            for (let i = Math.min(d.data[0].length - 2, o.x - 1); i >= 0; i--) {
                if (ShadeTool_Algorithm.perOctant) {
                    g.refGrid[j][i] =
                        Math.abs(i - o.x) > j - o.y
                            ? this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j][i + 1],
                                  i - o.x + 1,
                                  j - o.y,
                                  g.refGrid[j - 1][i + 1],
                                  i - o.x + 1,
                                  j - o.y - 1,
                                  observerHeight
                              )
                            : this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j - 1][i],
                                  i - o.x,
                                  j - o.y - 1,
                                  g.refGrid[j - 1][i + 1],
                                  i - o.x + 1,
                                  j - o.y - 1,
                                  observerHeight
                              )
                } else {
                    g.refGrid[j][i] = this.calcHeightDiagonal(
                        i - o.x,
                        j - o.y,
                        g.refGrid[j][i + 1],
                        g.refGrid[j - 1][i],
                        observerHeight
                    )
                }

                // Set visibility if our value is less than the data's
                dataH = d.data[j][i] + d.options.targetHeight
                if (g.refGrid[j][i] <= dataH) {
                    if (this.isInElevationFOV(d, i, j, observerHeight, dataH))
                        g.resultGrid[j][i] = 1
                    else g.resultGrid[j][i] = 0 //8
                }

                // Check if NoData
                if (ShadeTool_Algorithm.isNoData(d.data[j][i]))
                    g.resultGrid[j][i] = 9

                // Set ref position to the greater: plane height or actual elevation
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
            }

            // Process Right
            for (let i = Math.max(1, o.x + 1); i < d.data[0].length; i++) {
                if (ShadeTool_Algorithm.perOctant) {
                    g.refGrid[j][i] =
                        i - o.x > j - o.y
                            ? this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j][i - 1],
                                  i - o.x - 1,
                                  j - o.y,
                                  g.refGrid[j - 1][i - 1],
                                  i - o.x - 1,
                                  j - o.y - 1,
                                  observerHeight
                              )
                            : this.calcHeightDiagonal2(
                                  i - o.x,
                                  j - o.y,
                                  g.refGrid[j - 1][i],
                                  i - o.x,
                                  j - o.y - 1,
                                  g.refGrid[j - 1][i - 1],
                                  i - o.x - 1,
                                  j - o.y - 1,
                                  observerHeight
                              )
                } else {
                    g.refGrid[j][i] = this.calcHeightDiagonal(
                        i - o.x,
                        j - o.y,
                        g.refGrid[j][i - 1],
                        g.refGrid[j - 1][i],
                        observerHeight
                    )
                }

                // Set visibility if our value is less than the data's
                dataH = d.data[j][i] + d.options.targetHeight
                if (g.refGrid[j][i] <= dataH) {
                    if (this.isInElevationFOV(d, i, j, observerHeight, dataH))
                        g.resultGrid[j][i] = 1
                    else g.resultGrid[j][i] = 0 //8
                }

                // Check if NoData
                if (ShadeTool_Algorithm.isNoData(d.data[j][i]))
                    g.resultGrid[j][i] = 9

                // Set ref position to the greater: plane height or actual elevation
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
            }
        }
    },
    isInElevationFOV(d, i, j, sourceHeight, height) {
        if (d.options.FOVElevation < 180) {
            const srcLatLng = G_.litho.projection.tileXYZ2LatLng(
                d.topLeftTile.x + d.dataSource.x / d.tileResolution,
                d.topLeftTile.y + d.dataSource.y / d.tileResolution,
                d.topLeftTile.z
            )
            const latLng = G_.litho.projection.tileXYZ2LatLng(
                d.topLeftTile.x + i / d.tileResolution,
                d.topLeftTile.y + j / d.tileResolution,
                d.topLeftTile.z
            )
            const dist = F_.lngLatDistBetween(
                srcLatLng.lng,
                srcLatLng.lat,
                latLng.lng,
                latLng.lat
            )
            const ang =
                Math.atan2(height - sourceHeight, dist) * (180 / Math.PI)
            if (
                ang > d.options.centerElevation - d.options.FOVElevation / 2 &&
                ang < d.options.centerElevation + d.options.FOVElevation / 2
            )
                return true
            return false
        }
        return true
    },
    mask: function (d, grids) {
        // Azimuth
        // based on options.centerAzimuth and FOVAzimuth
        if (d.options.FOVAzimuth < 360) {
            let minAz =
                (d.options.centerAzimuth - d.options.FOVAzimuth / 2 + 90) *
                (Math.PI / 180)
            let maxAz =
                (d.options.centerAzimuth + d.options.FOVAzimuth / 2 + 90) *
                (Math.PI / 180)
            if (minAz < 0) {
                minAz += Math.PI * 2
                maxAz += Math.PI * 2
            }
            for (let y = 0; y < grids.resultGrid.length; y++) {
                for (let x = 0; x < grids.resultGrid[y].length; x++) {
                    let ang = Math.atan2(d.dataSource.y - y, d.dataSource.x - x)
                    if (ang < 0) ang += Math.PI * 2
                    if (
                        !(
                            (ang > minAz && ang < maxAz) ||
                            (ang + Math.PI * 2 > minAz &&
                                ang + Math.PI * 2 < maxAz)
                        )
                    )
                        grids.resultGrid[y][x] = 0
                }
            }
        }
    },
    isNoData(data) {
        if (data == 1010101 || data > 35000 || data < -35000) return true
        return false
    },
    // i - x coordinate from observer, follows image coordinate system
    // Za - refGrid height value, the "behind" point value
    // Zo - observer's height, constant per shade
    calcHeightLine: function (i, Za, Zo) {
        i = Math.abs(i)
        if (i == 1) return Za
        else return (Za - Zo) / (i - 1) + Za
    },
    calcHeightLine2: function (i, Za, Zo) {
        i = Math.abs(i)
        if (i == 1) return Za
        else return (Za - Zo) / (i - 1) + Za
    },
    calcHeightDiagonal: function (i, j, Za, Zb, Zo) {
        i = Math.abs(i)
        j = Math.abs(j)
        return ((Za - Zo) * i + (Zb - Zo) * j) / (i + j - 1) + Zo
    },
    calcHeightEdge: function (i, j, Za, Zb, Zo) {
        if (i == j) return this.calcHeightLine(i, Za, Zo)
        else return ((Za - Zo) * i + (Zb - Zo) * (j - i)) / (j - 1) + Zo
    },
    curveData: function (d) {
        if (d.hasDataCurved) return
        d.hasDataCurved = true
        for (let j = 0; j < d.data.length; j++) {
            for (let i = 0; i < d.data[j].length; i++) {
                d.data[j][i] = this.curve(i, j, d.data[j][i], d)
            }
        }
    },
    curve: function (i, j, height, d) {
        const ll = G_.litho.projection.tileXYZ2LatLng(
            d.topLeftTile.x + i / d.tileResolution,
            d.topLeftTile.y + j / d.tileResolution,
            d.topLeftTile.z
        )
        const dist = F_.lngLatDistBetween(
            d.source.lng,
            d.source.lat,
            ll.lng,
            ll.lat
        )
        const r = F_.radiusOfPlanetMajor
        const a = (1 / r) * dist
        return height - r * (1 - Math.cos(a))
    },
    calcHeightDiagonal2: function (i, j, Za, Ia, Ja, Zb, Ib, Jb, Zo) {
        const p = { x: 0, y: 0, z: Zo }
        const q = { x: Ia, y: Ja, z: Za }
        const r = { x: Ib, y: Jb, z: Zb }

        const a1 = q.x - p.x
        const b1 = q.y - p.y
        const c1 = q.z - p.z
        const a2 = r.x - p.x
        const b2 = r.y - p.y
        const c2 = r.z - p.z
        const a = b1 * c2 - b2 * c1
        const b = a2 * c1 - a1 * c2
        const c = a1 * b2 - b1 * a2
        const d = -a * p.x - b * p.y - c * p.z

        let result = (a * i + b * j + d) / -c

        result =
            result == Infinity || result == -Infinity || isNaN(result)
                ? this.calcHeightLine2(i, Zb, Zo)
                : result

        //console.log(p, q, r, i, j, result)

        return result
    },
}

export default ShadeTool_Algorithm
