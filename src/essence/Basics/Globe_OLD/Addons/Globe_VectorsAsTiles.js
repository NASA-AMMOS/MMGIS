import F_ from '../../Formulae_/Formulae_'
import L_ from '../../Layers_/Layers_'
import * as THREE from '../../../../external/THREE/three118'

var Globe_VectorsAsTiles = {
    G_: null,
    init: function (Globe_) {
        this.G_ = Globe_
        this.G_.addTileLayer({
            name: 'Vectors As Tiles',
            order: -1,
            on: 1,
            path: '_vectorsastile_',
            minZoom: 0,
            maxZoom: 16,
            opacity: 1,
        })
    },
    vectorsAsTile: function (tx, ty, tz) {
        var scaleFactor = 0.5

        var vt = this.G_.getVectorTileLayers()
        var canvas = document.createElement('canvas')
        canvas.id = 'vectorsastile'
        canvas.width = 256 / scaleFactor

        //Now reduce this in the case the tile is an LOD tile
        scaleFactor = scaleFactor * Math.pow(2, this.G_.zoom - tz)

        canvas.height = canvas.width
        var ctx = canvas.getContext('2d')
        //var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        var x
        var y
        //If the scaleFactor too great, then we can skip drawing
        // because if would start getting into subpixels
        if (scaleFactor < 128) {
            for (let v = 0; v < vt.length; v++) {
                if (!vt[v].on) continue

                if (vt[v].preDrawn) {
                    if (
                        vt[v].data &&
                        vt[v].data[tz] &&
                        vt[v].data[tz][tx] &&
                        vt[v].data[tz][tx][ty]
                    ) {
                        ctx.drawImage(
                            vt[v].data[tz][tx][ty],
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        )
                    }
                } else {
                    for (let l in vt[v].layers) {
                        let vl = vt[v].layers[l]

                        let fillColor = vl.options.fillColor || 'rgb(0,0,0)'
                        fillColor =
                            (vl.feature.properties.style
                                ? vl.feature.properties.style.fillColor
                                : fillColor) || fillColor

                        let color =
                            (vl.feature.properties.style
                                ? vl.feature.properties.style.color
                                : vl.options.color) || vl.options.color

                        let weight =
                            (vl.feature.properties.style
                                ? vl.feature.properties.style.weight
                                : vl.options.weight) || vl.options.weight

                        let radius =
                            (vl.feature.properties.style
                                ? vl.feature.properties.style.radius
                                : vl.options.radius) || vl.options.radius

                        let fillOpacity =
                            vl.options.fillOpacity != undefined
                                ? vl.options.fillOpacity
                                : 0.4
                        fillOpacity =
                            (vl.feature.properties.style
                                ? vl.feature.properties.style.fillOpacity
                                : fillOpacity) || fillOpacity

                        if (fillColor.substring(0, 3).toLowerCase() != 'rgb') {
                            let c = F_.hexToRGB(fillColor)
                            if (c) {
                                fillColor =
                                    'rgba(' +
                                    c.r +
                                    ',' +
                                    c.g +
                                    ',' +
                                    c.b +
                                    ',' +
                                    fillOpacity +
                                    ')'
                            }
                        } else {
                            //is rgb so add a
                            let rgb = fillColor
                                .substring(4, fillColor.length - 1)
                                .replace(/ /g, '')
                                .split(',')
                            fillColor =
                                'rgba(' +
                                rgb[0] +
                                ',' +
                                rgb[1] +
                                ',' +
                                rgb[2] +
                                ',' +
                                fillOpacity +
                                ')'
                        }
                        if (fillColor == 'none') fillColor = 'rgba(0,0,0,0)'

                        ctx.fillStyle = fillColor
                        ctx.strokeStyle = color
                        ctx.lineWidth = weight * ((1 / scaleFactor) * 1)
                        ctx.globalAlpha = L_.opacityArray[vt[v].layerName]
                        ctx.lineCap = 'round'
                        radius *= (1 / scaleFactor) * 1 || 10

                        if (
                            (vl.feature.geometry.type == 'Polygon' ||
                                vl.feature.geometry.type == 'MultiPolygon') &&
                            vl.feature.geometry.coordinates[0]
                        ) {
                            for (
                                let p = 0;
                                p < vl.feature.geometry.coordinates.length;
                                p++
                            ) {
                                if (
                                    typeof vl.feature.geometry.coordinates[
                                        p
                                    ][0][0] == 'number'
                                ) {
                                    for (
                                        let i = 0;
                                        i <
                                        vl.feature.geometry.coordinates[p]
                                            .length;
                                        i++
                                    ) {
                                        x = F_.lon2tileUnfloored(
                                            vl.feature.geometry.coordinates[p][
                                                i
                                            ][0],
                                            tz
                                        )
                                        y = F_.lat2tileUnfloored(
                                            vl.feature.geometry.coordinates[p][
                                                i
                                            ][1],
                                            tz
                                        )
                                        var canvasX = parseInt(
                                            (x - tx) * canvas.width
                                        )
                                        var canvasY = parseInt(
                                            (y - ty) * canvas.width
                                        )
                                        if (i == 0) {
                                            ctx.beginPath()
                                            ctx.moveTo(canvasX, canvasY)
                                        } else {
                                            ctx.lineTo(canvasX, canvasY)
                                        }
                                    }
                                } else if (
                                    typeof vl.feature.geometry.coordinates[
                                        p
                                    ][0][0][0] == 'number'
                                ) {
                                    for (
                                        var i = 0;
                                        i <
                                        vl.feature.geometry.coordinates[p]
                                            .length;
                                        i++
                                    ) {
                                        for (
                                            var j = 0;
                                            j <
                                            vl.feature.geometry.coordinates[p][
                                                i
                                            ].length;
                                            j++
                                        ) {
                                            x = F_.lon2tileUnfloored(
                                                vl.feature.geometry.coordinates[
                                                    p
                                                ][i][j][0],
                                                tz
                                            )
                                            y = F_.lat2tileUnfloored(
                                                vl.feature.geometry.coordinates[
                                                    p
                                                ][i][j][1],
                                                tz
                                            )
                                            var canvasX = parseInt(
                                                (x - tx) * canvas.width
                                            )
                                            var canvasY = parseInt(
                                                (y - ty) * canvas.width
                                            )
                                            if (j == 0) {
                                                ctx.beginPath()
                                                ctx.moveTo(canvasX, canvasY)
                                            } else {
                                                ctx.lineTo(canvasX, canvasY)
                                            }
                                        }
                                    }
                                }
                                ctx.stroke()
                                ctx.closePath()
                                ctx.fill()
                            }
                        } else if (
                            vl.feature.geometry.type == 'LineString' ||
                            vl.feature.geometry.type == 'MultiLineString'
                        ) {
                            if (
                                typeof vl.feature.geometry.coordinates[0][0] ==
                                'number'
                            ) {
                                for (
                                    var p = 0;
                                    p < vl.feature.geometry.coordinates.length;
                                    p++
                                ) {
                                    x = F_.lon2tileUnfloored(
                                        vl.feature.geometry.coordinates[p][0],
                                        tz
                                    )
                                    y = F_.lat2tileUnfloored(
                                        vl.feature.geometry.coordinates[p][1],
                                        tz
                                    )
                                    var canvasX = parseInt(
                                        (x - tx) * canvas.width
                                    )
                                    var canvasY = parseInt(
                                        (y - ty) * canvas.width
                                    )
                                    if (p == 0) {
                                        ctx.beginPath()
                                        ctx.moveTo(canvasX, canvasY)
                                    } else {
                                        ctx.lineTo(canvasX, canvasY)
                                    }
                                }
                                ctx.stroke()
                            } else if (
                                typeof vl.feature.geometry
                                    .coordinates[0][0][0] == 'number'
                            ) {
                                for (
                                    var p = 0;
                                    p < vl.feature.geometry.coordinates.length;
                                    p++
                                ) {
                                    for (
                                        var i = 0;
                                        i <
                                        vl.feature.geometry.coordinates[p]
                                            .length;
                                        i++
                                    ) {
                                        x = F_.lon2tileUnfloored(
                                            vl.feature.geometry.coordinates[p][
                                                i
                                            ][0],
                                            tz
                                        )
                                        y = F_.lat2tileUnfloored(
                                            vl.feature.geometry.coordinates[p][
                                                i
                                            ][1],
                                            tz
                                        )
                                        var canvasX = parseInt(
                                            (x - tx) * canvas.width
                                        )
                                        var canvasY = parseInt(
                                            (y - ty) * canvas.width
                                        )

                                        if (i == 0) {
                                            ctx.beginPath()
                                            ctx.moveTo(canvasX, canvasY)
                                        } else {
                                            ctx.lineTo(canvasX, canvasY)
                                        }
                                    }
                                    ctx.stroke()
                                }
                            }
                        } else if (
                            vl.feature.geometry.type.toLowerCase() == 'point'
                        ) {
                            if (
                                typeof vl.feature.geometry.coordinates[0] ==
                                'number'
                            ) {
                                x = F_.lon2tileUnfloored(
                                    vl.feature.geometry.coordinates[0],
                                    tz
                                )
                                y = F_.lat2tileUnfloored(
                                    vl.feature.geometry.coordinates[1],
                                    tz
                                )
                            } else {
                                x = F_.lon2tileUnfloored(
                                    vl.feature.geometry.coordinates[0][0],
                                    tz
                                )
                                y = F_.lat2tileUnfloored(
                                    vl.feature.geometry.coordinates[0][1],
                                    tz
                                )
                            }

                            var canvasX = parseInt((x - tx) * canvas.width)
                            var canvasY = parseInt((y - ty) * canvas.width)

                            ctx.beginPath()
                            ctx.arc(
                                canvasX,
                                canvasY,
                                radius,
                                0,
                                2 * Math.PI,
                                false
                            )
                            ctx.fill()
                            ctx.stroke()
                        }
                    }
                }
            }
        }

        return canvas.toDataURL()
    },
}

export default Globe_VectorsAsTiles
