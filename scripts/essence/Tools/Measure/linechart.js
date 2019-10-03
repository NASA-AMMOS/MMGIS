define(['jquery', 'd3', 'Formulae_', 'Map_', 'Globe_'], function(
    $,
    d3,
    F_,
    Map_,
    Globe_
) {
    var linechart = {
        elevMarkerLayer: null,
        loadingElevationChart: function(id) {
            return
            d3.select('#' + id)
                .selectAll('*')
                .remove()
            var bp = d3.select('#' + id)
            var cx = +bp.style('width').replace('px', '') / 2 - 40
            var cy = +bp.style('height').replace('px', '') / 2 - 40
            var loadingSVG = bp
                .append('svg')
                .attr('id', 'profile_loading')
                .attr('width', +bp.style('width').replace('px', ''))
                .attr('height', +bp.style('width').replace('px', ''))
                .append('g')
                .attr('transform', 'translate(' + cx + ',' + cy + ')')
                .html(
                    '<path fill="#DCDCDC" fill-opacity="1" stroke-width="0.2" stroke-linejoin="round" d="M 38,36C 36.8954,36 36,36.8954 36,38C 36,39.1046 36.8954,40 38,40C 39.1046,40 40,39.1046 40,38C 40,36.8954 39.1046,36 38,36 Z M 38,34C 40.2091,34 42,35.7909 42,38C 42,40.2091 40.2091,42 38,42C 35.7909,42 34,40.2091 34,38C 34,35.7909 35.7909,34 38,34 Z M 57.75,36C 56.6454,36 55.75,36.8954 55.75,38C 55.75,39.1046 56.6454,40 57.75,40C 58.8546,40 59.75,39.1046 59.75,38C 59.75,36.8954 58.8546,36 57.75,36 Z M 61.75,38C 61.75,39.9038 60.4199,41.497 58.6383,41.901C 56.8098,51.635 48.265,59 38,59C 26.402,59 17,49.598 17,38C 17,26.402 26.402,17 38,17C 48.265,17 56.8098,24.365 58.6383,34.099C 60.4199,34.503 61.75,36.0962 61.75,38 Z M 53.75,38C 53.75,36.5505 54.521,35.281 55.6754,34.5794C 54.0776,26.2741 46.7715,20 38,20C 28.0589,20 20,28.0589 20,38C 20,47.9411 28.0589,56 38,56C 46.7715,56 54.0776,49.7259 55.6754,41.4206C 54.521,40.719 53.75,39.4496 53.75,38 Z "><animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 38 38" to="360 38 38" begin="0" dur="1s" repeatCount="indefinite" /></path><text x="38" y="76" fill="#DCDCDC" text-anchor="middle">Loading</text>'
                )
        },
        //elevs is an array of in order y values
        //elevPoints is an object with x and y as profile line end coords
        //chartType is either "map" or "lone". "map" just makes a dot appear on the map when hovering over the chart
        makeElevationChart: function(
            id,
            elevs,
            takeEveryNth,
            elevPoints,
            chartType,
            multiplyElev,
            forcedFullData
        ) {
            var elevsSwap = []
            takeEveryNth = 1
            for (var i = 0; i < elevs.length; i += takeEveryNth) {
                elevsSwap.push(elevs[i] * multiplyElev)
            }
            elevs = elevsSwap

            var elevsErrorValue = -1100101
            d3.select('#profile_loading').remove()
            var bp = d3.select('#' + id)
            var cmargin = { top: 15, right: 55, bottom: 25, left: 8 },
                cwidth =
                    +bp.style('width').replace('px', '') -
                    cmargin.left -
                    cmargin.right,
                cheight =
                    +bp.style('height').replace('px', '') -
                    cmargin.top -
                    cmargin.bottom
            var elevSvg = bp
                .append('svg')
                .attr('id', 'elevation_chart')
                .attr('width', cwidth + cmargin.left + cmargin.right)
                .attr('height', cheight + cmargin.top + cmargin.bottom)

            var maxElev = -999999999,
                minElev = 999999999
            for (var i = 0; i < elevs.length; i++) {
                if (elevs[i] != elevsErrorValue * multiplyElev) {
                    if (parseFloat(elevs[i]) > maxElev)
                        maxElev = parseFloat(elevs[i])
                    if (parseFloat(elevs[i]) < minElev)
                        minElev = parseFloat(elevs[i])
                }
            }
            var zeroCentered =
                Math.abs(maxElev) > Math.abs(minElev)
                    ? Math.abs(maxElev)
                    : Math.abs(minElev)

            var dist = 0

            var varyDist = false
            var dists = [0]
            var distsSum = 0

            //Simplify y axis units
            var maxElevA = maxElev
            var minElevA = minElev
            var unit = 'm'
            var dif = Math.abs(maxElevA - minElevA)
            if (dif > 1000) {
                maxElevA /= 1000
                minElevA /= 1000
                unit = 'km'
            } else if (dif > 0.1) {
            } else if (dif > 0.01) {
                maxElevA *= 100
                minElevA *= 100
                unit = 'cm'
            } else {
                maxElevA *= 1000
                minElevA *= 1000
                unit = 'mm'
            }

            var elevScaleH = d3
                .scaleLinear()
                .domain([minElev, maxElev])
                .range([cheight, 0])
            var elevScaleHA = d3
                .scaleLinear()
                .domain([minElevA, maxElevA])
                .range([cheight, 0])

            if (forcedFullData === undefined) {
                dist = F_.lngLatDistBetween(
                    elevPoints[0].y,
                    elevPoints[0].x,
                    elevPoints[1].y,
                    elevPoints[1].x
                )
                if (F_.dam) dist /= F_.metersInOneDegree
            } else {
                varyDist = true
                //This is the gap between any two values of which at least one is no data
                var baseGapDist = F_.lngLatDistBetween(
                    elevPoints[0].y,
                    elevPoints[0].x,
                    elevPoints[1].y,
                    elevPoints[1].x
                )
                baseGapDist /= forcedFullData.length - 1
                if (F_.dam) baseGapDist /= F_.metersInOneDegree

                dists = [0]
                distsSum = 0
                //find earliest data value
                for (var i = 0; i < forcedFullData.length - 1; i++) {
                    var a = forcedFullData[i]
                    var b = forcedFullData[i + 1]
                    var midDist
                    if (
                        a[0] == elevsErrorValue ||
                        b[0] == elevsErrorValue ||
                        a[1] == elevsErrorValue ||
                        b[1] == elevsErrorValue ||
                        a[2] == elevsErrorValue * multiplyElev ||
                        b[2] == elevsErrorValue * multiplyElev
                    ) {
                        midDist = baseGapDist
                    } else {
                        midDist = F_.lngLatDistBetween(a[1], a[0], b[1], b[0])
                        if (F_.dam) midDist /= F_.metersInOneDegree
                    }
                    dists.push(distsSum + midDist)
                    distsSum += midDist

                    if (
                        forcedFullData[i][0] != elevsErrorValue &&
                        forcedFullData[i][1] != elevsErrorValue &&
                        forcedFullData[i][2] != elevsErrorValue * multiplyElev
                    )
                        earliest = forcedFullData[i]
                }
                dist = distsSum
            }
            var elevScaleW = d3
                .scaleLinear()
                .domain([0, distsSum])
                .range([0, cwidth - cmargin.left])

            var line = d3
                .line()
                .defined(function(d) {
                    return d != elevsErrorValue * multiplyElev
                })
                .x(function(d, i) {
                    if (!varyDist) return elevScaleW(i)
                    else {
                        return elevScaleW(dists[i])
                    }
                })
                .y(function(d) {
                    return elevScaleH(d)
                })
            //axes
            var yAxis = d3
                .axisRight()
                .scale(elevScaleHA)
                .ticks(4)
                .tickSize(cwidth - cmargin.left)

            var gy = elevSvg
                .append('g')
                .attr('class', 'elevyaxis')
                .style('fill', 'none')
                .attr(
                    'transform',
                    'translate(' + cmargin.left + ',' + cmargin.top + ')'
                )
                .call(yAxis)
            d3.selectAll('.elevyaxis .tick line')
                .style('stroke', '#DCDCDC')
                .style('opacity', 0.2)
            d3.selectAll('.elevyaxis .tick text')
                .style('fill', '#DCDCDC')
                .style('font-family', 'sans-serif')
                .style('font-size', '15px')
            d3.select('.elevyaxis .domain').remove()

            var xAxisScale = d3
                .scaleLinear()
                .domain([0, dist])
                .range([0, cwidth - cmargin.left])
            var xAxis = d3
                .axisBottom()
                .scale(xAxisScale)
                .tickSize(4)
            var gx = elevSvg
                .append('g')
                .attr('class', 'elevxaxis')
                .style('fill', 'none')
                .attr(
                    'transform',
                    'translate(' +
                        cmargin.left +
                        ',' +
                        (cheight + cmargin.top) +
                        ')'
                )
                .call(xAxis)
            d3.selectAll('.elevxaxis .tick line')
                .style('stroke', '#DCDCDC')
                .style('stroke-width', '2')
            d3.selectAll('.elevxaxis path')
                .attr('stroke', '#DCDCDC')
                .attr('stroke-width', '1')
            d3.selectAll('.elevxaxis .tick text')
                .style('fill', '#DCDCDC')
                .style('font-family', 'sans-serif')
                .style('font-size', '15px')
            //area
            var elevchart = elevSvg
                .append('g')
                .attr(
                    'transform',
                    'translate(' + cmargin.left + ',' + cmargin.top + ')'
                )

            var area = d3
                .area()
                .defined(line.defined())
                .x(function(d, i) {
                    if (!varyDist) return elevScaleW(i)
                    else {
                        return elevScaleW(dists[i])
                    }
                })
                .y0(cheight)
                .y1(function(d) {
                    return elevScaleH(d)
                })
            elevchart
                .append('path')
                .datum(elevs)
                .attr('class', 'elev_chart_area')
                .attr('d', area)
            d3.select('#elevation_chart .elev_chart_area')
                .attr('fill', '#c01919')
                .attr('opacity', '0.5')
            //line
            elevchart
                .append('path')
                .attr('d', line(elevs))
                .style('fill', 'none')
                .style('stroke', '#F90000')
                .style('stroke-width', '4')
                .style('shape-rendering', 'crisp-edges')
                .style('z-index', '15')
            //points
            elevchart
                .selectAll('.chartdot')
                .data(elevs)
                .enter()
                .append('circle')
                .attr('class', 'chartdot')
                .style('fill', '#DCDCDC')
                .style('visibility', function(d) {
                    return d != elevsErrorValue * multiplyElev
                        ? 'visible'
                        : 'hidden'
                })
                .style('stroke', '#161616')
                .style('stroke-width', '1')
                .attr('cx', line.x())
                .attr('cy', line.y())
                .attr('r', 2.5)
            //focus to map
            if (chartType == 'map') {
                var pCoord = elevPoints
                var steps = elevs.length
                var segments = steps - 1
                var x1 = pCoord[1].x
                var y1 = pCoord[1].y
                var x2 = pCoord[0].x
                var y2 = pCoord[0].y
                var xDif = x1 - x2
                var yDif = y1 - y2
                var xStep = xDif / segments
                var yStep = yDif / segments
            }
            //focus (hover over chart -> circle on map)
            Map_.rmNotNull(linechart.elevMarkerLayer)

            elevSvg
                .append('text')
                .attr('x', cwidth + cmargin.left + cmargin.right - 37)
                .attr('y', cheight + cmargin.top + 15)
                .attr('x', 7)
                .attr('y', 121)
                .attr('fill', '#DCDCDC')
                .html('[m]')
            elevSvg
                .append('text')
                .attr('x', cwidth + 39)
                .attr('y', 17)
                .attr('fill', '#DCDCDC')
                .html('[' + unit + ']')

            var focus = elevSvg
                .append('g')
                .attr('class', 'elev_focus')
                .style(
                    'transform',
                    'translate(' + cmargin.left + ',' + cmargin.top + ')'
                )
                .style('fill', 'none')
                .style('display', 'none')

            focus
                .append('circle')
                .attr('r', 4.5)
                .attr('fill', 'none')
                .attr('stroke', 'white')
                .attr('stroke-width', '2')

            focus
                .append('text')
                .attr('x', 9)
                .attr('dy', '.35em')
                .attr('fill', '#DCDCDC')
                .style('font-family', 'sans-serif')
                .style('font-size', '24')
                .style('font-weight', 'bold')

            elevSvg
                .append('rect')
                .attr('class', 'elev_overlay')
                .attr('width', cwidth - cmargin.left)
                .attr('height', cheight)
                .attr(
                    'transform',
                    'translate(' + cmargin.left + ',' + cmargin.top + ')'
                )
                .style('opacity', '0')
                .on('mouseover', function() {
                    focus.style('display', null)
                    //elevMarker.style("display", null);
                })
                .on('mouseout', function() {
                    focus.style('display', 'none')
                    if (chartType == 'map') {
                        Map_.rmNotNull(linechart.elevMarkerLayer)
                    }
                    //elevMarker.style("display", "none");
                })
                .on('mousemove', mousemove)

            function mousemove() {
                var x0 = elevScaleW.invert(d3.mouse(this)[0])
                var d, i
                if (varyDist) {
                    for (var j = 0; j < dists.length; j++) {
                        if (dists[j] > x0) {
                            //Find closest point
                            if (
                                j > 0 &&
                                Math.abs(dists[j] - x0) >
                                    Math.abs(dists[j - 1] - x0)
                            )
                                j = j - 1
                            i = j
                            d = forcedFullData[j][2] * multiplyElev
                            break
                        }
                    }
                } else {
                    var dec = x0 % 1
                    if (dec > 0.5) i = Math.ceil(x0)
                    else i = Math.floor(x0)
                    d = elevs[i]
                }

                var h = elevScaleH(d)
                var focusTextValue =
                    chartType == 'map'
                        ? Math.round(d * 1000) / 1000 + 'm'
                        : Math.round(d * 10000) / 10000 + 'm'

                if (d == elevsErrorValue * multiplyElev) {
                    h = cheight
                    focusTextValue = 'No data'
                }

                focus.attr(
                    'transform',
                    'translate(' +
                        (d3.mouse(this)[0] + cmargin.left) +
                        ',' +
                        (h + cmargin.top) +
                        ')'
                )
                focus.select('.elev_focus text').text(focusTextValue)
                if (chartType == 'map') {
                    var x, y
                    if (false && varyDist) {
                        x = forcedFullData[i][0]
                        y = forcedFullData[i][1]
                    } else {
                        x = x2 + xStep * i
                        y = y2 + yStep * i
                    }
                    //var c = coordToXY([x, y]);
                    Map_.rmNotNull(linechart.elevMarkerLayer)
                    linechart.elevMarkerLayer = new L.circleMarker([x, y], {
                        fillColor: 'yellow',
                        fillOpacity: 1,
                    })
                        .setRadius(5)
                        .addTo(Map_.map)
                    Globe_.addVectorLayer(
                        {
                            name: 'measurePoint',
                            id: 'measurePoint',
                            on: true,
                            style: { fillColor: 'yellow', color: '#000' },
                            geometry: [[x, y, d]],
                        },
                        1
                    )
                }
                //elevMarker.attr("cx", c[0]).attr("cy", c[1]);
            }
        },
    }

    return linechart
})
