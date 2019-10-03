define(['three', 'Formulae_', 'Layers_'], function(THREE, F_, L_) {
    var Globe_VectorsAsTiles = {
        G_: null,
        init: function(Globe_) {
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
        vectorsAsTile: function(tx, ty, tz) {
            var scaleFactor = 0.5
            var vt = this.G_.getVectorTileLayers()
            var canvas = document.createElement('canvas')
            canvas.id = 'vectorsastile'
            canvas.width = 256 / scaleFactor
            canvas.height = canvas.width
            var ctx = canvas.getContext('2d')
            var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            var x
            var y
            for (var v = 0; v < vt.length; v++) {
                if (!vt[v].on) continue
                for (var l in vt[v].layers) {
                    var fillColor =
                        vt[v].layers[l].options.fillColor || 'rgb(0,0,0)'
                    var fillOpacity =
                        vt[v].layers[l].options.fillOpacity != undefined
                            ? vt[v].layers[l].options.fillOpacity
                            : 0.4

                    if (fillColor.substring(0, 3).toLowerCase() != 'rgb') {
                        var c = F_.hexToRGB(fillColor)
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
                        var rgb = fillColor
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
                    ctx.strokeStyle = vt[v].layers[l].options.color
                    ctx.lineWidth =
                        vt[v].layers[l].options.weight * ((1 / scaleFactor) * 1)
                    ctx.globalAlpha = L_.opacityArray[vt[v].layerName]
                    ctx.lineCap = 'round'
                    let radius =
                        vt[v].layers[l].options.radius *
                            ((1 / scaleFactor) * 1) || 10

                    if (
                        (vt[v].layers[l].feature.geometry.type == 'Polygon' ||
                            vt[v].layers[l].feature.geometry.type ==
                                'MultiPolygon') &&
                        vt[v].layers[l].feature.geometry.coordinates[0]
                    ) {
                        for (
                            var p = 0;
                            p <
                            vt[v].layers[l].feature.geometry.coordinates.length;
                            p++
                        ) {
                            if (
                                typeof vt[v].layers[l].feature.geometry
                                    .coordinates[p][0][0] == 'number'
                            ) {
                                for (
                                    var i = 0;
                                    i <
                                    vt[v].layers[l].feature.geometry
                                        .coordinates[p].length;
                                    i++
                                ) {
                                    x = F_.lon2tileUnfloored(
                                        vt[v].layers[l].feature.geometry
                                            .coordinates[p][i][0],
                                        tz
                                    )
                                    y = F_.lat2tileUnfloored(
                                        vt[v].layers[l].feature.geometry
                                            .coordinates[p][i][1],
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
                                typeof vt[v].layers[l].feature.geometry
                                    .coordinates[p][0][0][0] == 'number'
                            ) {
                                for (
                                    var i = 0;
                                    i <
                                    vt[v].layers[l].feature.geometry
                                        .coordinates[p].length;
                                    i++
                                ) {
                                    for (
                                        var j = 0;
                                        j <
                                        vt[v].layers[l].feature.geometry
                                            .coordinates[p][i].length;
                                        j++
                                    ) {
                                        x = F_.lon2tileUnfloored(
                                            vt[v].layers[l].feature.geometry
                                                .coordinates[p][i][j][0],
                                            tz
                                        )
                                        y = F_.lat2tileUnfloored(
                                            vt[v].layers[l].feature.geometry
                                                .coordinates[p][i][j][1],
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
                        vt[v].layers[l].feature.geometry.type == 'LineString' ||
                        vt[v].layers[l].feature.geometry.type ==
                            'MultiLineString'
                    ) {
                        if (
                            typeof vt[v].layers[l].feature.geometry
                                .coordinates[0][0] == 'number'
                        ) {
                            for (
                                var p = 0;
                                p <
                                vt[v].layers[l].feature.geometry.coordinates
                                    .length;
                                p++
                            ) {
                                x = F_.lon2tileUnfloored(
                                    vt[v].layers[l].feature.geometry
                                        .coordinates[p][0],
                                    tz
                                )
                                y = F_.lat2tileUnfloored(
                                    vt[v].layers[l].feature.geometry
                                        .coordinates[p][1],
                                    tz
                                )
                                var canvasX = parseInt((x - tx) * canvas.width)
                                var canvasY = parseInt((y - ty) * canvas.width)
                                if (p == 0) {
                                    ctx.beginPath()
                                    ctx.moveTo(canvasX, canvasY)
                                } else {
                                    ctx.lineTo(canvasX, canvasY)
                                }
                            }
                            ctx.stroke()
                        } else if (
                            typeof vt[v].layers[l].feature.geometry
                                .coordinates[0][0][0] == 'number'
                        ) {
                            for (
                                var p = 0;
                                p <
                                vt[v].layers[l].feature.geometry.coordinates
                                    .length;
                                p++
                            ) {
                                for (
                                    var i = 0;
                                    i <
                                    vt[v].layers[l].feature.geometry
                                        .coordinates[p].length;
                                    i++
                                ) {
                                    x = F_.lon2tileUnfloored(
                                        vt[v].layers[l].feature.geometry
                                            .coordinates[p][i][0],
                                        tz
                                    )
                                    y = F_.lat2tileUnfloored(
                                        vt[v].layers[l].feature.geometry
                                            .coordinates[p][i][1],
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
                        vt[v].layers[l].feature.geometry.type == 'Point'
                    ) {
                        x = F_.lon2tileUnfloored(
                            vt[v].layers[l].feature.geometry.coordinates[0],
                            tz
                        )
                        y = F_.lat2tileUnfloored(
                            vt[v].layers[l].feature.geometry.coordinates[1],
                            tz
                        )
                        var canvasX = parseInt((x - tx) * canvas.width)
                        var canvasY = parseInt((y - ty) * canvas.width)

                        ctx.beginPath()
                        ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI, false)
                        ctx.fill()
                        ctx.stroke()
                    }
                }
            }

            return canvas.toDataURL()
        },
    }

    return Globe_VectorsAsTiles
})
