import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import CursorInfo from '../../Ancillary/CursorInfo'

function makeChemistryChart(chems, chemLayerVar, divId) {
    var chemsNameArr // = ["Al2O3", "CaO", "FeOT", "K2O", "MgO", "Na2O", "SiO2", "TiO2"];
    var numOfChems
    var chemsBarred = []
    var c = 1

    var bars
    var chemchart
    var cmargin
    var cwidth
    var cheight
    var scale = 0

    var colorScale = d3
        .scaleLinear()
        .domain([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        .range([
            '#1f77b4',
            '#ff7f0e',
            '#2ca02c',
            '#d62728',
            '#9467bd',
            '#e377c2',
            '#bcbd22',
            '#17becf',
            '#6b6ecf',
            '#b5cf6b',
            '#e7ba52',
            '#d6616b',
            '#ce6dbd',
        ])
    var colorScaleDark = d3
        .scaleLinear()
        .domain([0, 1, 2, 3, 4, 5, 6, 7])
        .range([
            '#A0BCCF',
            '#FFD0A6',
            '#A3BBA3',
            '#F1BCBC',
            '#C6ACD7',
            '#FDCBEE',
            '#CDD7A7',
            '#A5E2E9',
        ])

    makeChemChartHorizontal(chems, chemLayerVar)

    function barChems(chems) {
        numOfChems = chemsNameArr.length
        var chemsB = []
        c = 1
        var sum = [],
            size = 0
        function initSum() {
            sum = []
            size = 0
            for (var i = 0; i < numOfChems; i++) {
                sum.push(0)
            }
        }
        initSum()
        for (var i = 0; i < Object.keys(chems).length; i++) {
            for (var j = 0; j < chemsNameArr.length; j++) {
                sum[j] += parseFloat(chems[i][chemsNameArr[j]])
            }
            size++
            if (chems[i + 1] == undefined || chems[i + 1].ShotNumber == 1) {
                var tempObj = {}
                for (var j = 0; j < chemsNameArr.length; j++) {
                    tempObj[chemsNameArr[j]] =
                        Math.round((sum[j] / size) * 100) / 100
                }
                chemsB.push(tempObj)
                initSum()
                c++
            }
        }
        return chemsB
    }

    function makeChemChartHorizontal(chems, chemLayerVar) {
        //Clear the panel
        var bp = d3.select('#' + divId)
        bp.selectAll('*').remove()

        const headerHeight = 35

        //Make chart if there is data
        if (chems[0] != undefined) {
            chemsNameArr = chemLayerVar
            var chemsBarredH = barChems(chems)
            var newCBH = chemsBarredH

            var cmargin = {
                    top: 0,
                    right: 35,
                    bottom: 10,
                    left: 35,
                },
                cwidth =
                    $('#' + divId)[0].getBoundingClientRect().width -
                    cmargin.left -
                    cmargin.right,
                cheight =
                    $('#' + divId)[0].getBoundingClientRect().height -
                    cmargin.top -
                    cmargin.bottom +
                    headerHeight
            var xScaleFactor = cwidth / 100 //streches the bars horizontally
            var pheight = cheight * 0.8 //percent svg bars take up vertically

            var chemChartH = bp
                .append('svg')
                .attr('id', 'chemistry_chart_h')
                .attr('width', cwidth + cmargin.left + cmargin.right)
                .attr('height', cheight + cmargin.top + cmargin.bottom)
                .append('g')
                .attr(
                    'transform',
                    'translate(' + cmargin.left + ',' + cmargin.top + ')'
                )
            var y = d3
                .scaleLinear()
                .domain([0, c - 1])
                .range([headerHeight, pheight])
            if (c - 1 == 1)
                y = function () {
                    return pheight / 4
                }
            //add each group of bars
            var barSets = chemChartH
                .selectAll('.bar_sets')
                .data(chemsBarredH)
                .enter()
                .append('g')
                .attr('class', 'stacked_chem_bar')
                .attr('transform', function (d, i) {
                    return 'translate(0,' + y(i) + ')'
                })

            //add bars to each group
            d3.selectAll('.stacked_chem_bar').each(function (d, i) {
                var xPos = 0
                for (var i = 0; i < numOfChems; i++) {
                    d3.select(this)
                        .append('rect')
                        .attr('class', 'chemBarRectH')
                        .attr('width', d[chemsNameArr[i]] * xScaleFactor)
                        .attr('height', (pheight - headerHeight) / c)
                        .attr('x', xPos * xScaleFactor)
                        .attr('fill', colorScale(i))
                        .style('cursor', 'pointer')
                    xPos += d[chemsNameArr[i]]
                }
                //bar to 100%
                d3.select(this)
                    .append('rect')
                    .attr('id', 'chem_h_bar_to_100')
                    .attr('width', Math.max(0, cwidth - xPos * xScaleFactor))
                    .attr('height', (pheight - headerHeight) / c)
                    .attr('x', xPos * xScaleFactor)
                    .attr('fill', 'gray')
            })

            //create the axis
            //x 0 -> 100
            var xAxis = d3
                .axisBottom()
                .scale(
                    d3
                        .scaleLinear()
                        .domain([0, 100])
                        .range([0, 100 * xScaleFactor])
                )
                .tickSize(4)
                .ticks(10)
                .tickFormat(function (d) {
                    return d + '%'
                })
            chemChartH
                .append('g')
                .attr('id', 'chem_x_axis_h')
                .style('fill', '#DCDCDC')
                .style('font-size', '10')
                .attr(
                    'transform',
                    'translate(0,' + (cheight - cheight * 0.2) + ')'
                )
                .call(xAxis)
            d3.selectAll('#chem_x_axis_h line')
                .style('fill', 'black')
                .style('stroke', '#DCDCDC')
                .style('shape-rendering', 'crispEdges')
            d3.select('#chem_x_axis_h path')
                .style('fill', 'none')
                .style('stroke', '#DCDCDC')
                .style('shape-rendering', 'crispEdges')
            //y 1 -> points
            var yAxis = d3
                .axisLeft()
                .scale(
                    d3
                        .scaleLinear()
                        .domain([1, c - 1])
                        .range([
                            (pheight - headerHeight) / (c - 1) / 2 +
                                headerHeight,
                            pheight - pheight / (c - 1) / 2,
                        ])
                )
                .tickSize(4)
                .tickValues(F_.range(1, c - 1))
                .tickFormat(d3.format('.0f'))
            chemChartH
                .append('g')
                .attr('id', 'chem_y_axis_h')
                .style('fill', '#DCDCDC')
                .style('font-size', 0.7 * ((pheight - headerHeight) / c))
                .attr('transform', 'translate(0, 0)')
                .call(yAxis)
            d3.selectAll('#chem_y_axis_h line')
                .style('fill', 'black')
                .style('stroke', '#DCDCDC')
                .style('shape-rendering', 'crispEdges')
            d3.select('#chem_y_axis_h path')
                .style('fill', 'none')
                .style('stroke', 'none')

            //create the legend
            var chemLegend = chemChartH
                .append('g')
                .attr('transform', function () {
                    return (
                        'translate(' +
                        (cwidth / 2 - (numOfChems * 60) / 2) +
                        ',10)'
                    )
                })

            let color = 'gray'
            let html = 'Justify to 100%'

            for (var i = 0; i <= numOfChems; i++) {
                if (i == numOfChems) {
                    //white nodata to 100%
                    color = 'gray'
                    html = 'Justify to 100%'
                } else {
                    color = colorScale(i)
                    html = chemsNameArr[i]
                }
                chemLegend
                    .append('rect')
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr('x', i * 60)
                    .attr('fill', color)
                    .style('cursor', 'pointer')
                    .on(
                        'click',
                        (function (value) {
                            return function () {
                                focusOnBars(value)
                            }
                        })(i)
                    )
                chemLegend
                    .append('text')
                    .attr('x', i * 60 + 14)
                    .attr('y', 11)
                    .attr('font-size', 12)
                    .attr('fill', '#DCDCDC')
                    .style('cursor', 'pointer')
                    .html(html)
                    .on(
                        'click',
                        (function (value) {
                            return function () {
                                focusOnBars(value)
                            }
                        })(i)
                    )
            }

            //refresh button (undoes focus)
            var chemRefreshWidth = 50
            var chemRefresh = chemChartH
                .append('g')
                .attr('transform', function () {
                    return (
                        'translate(' +
                        (100 * xScaleFactor - chemRefreshWidth) +
                        ',10)'
                    )
                })
            chemRefresh
                .append('rect')
                .attr('width', chemRefreshWidth)
                .attr('height', 16)
                .attr('fill', 'none')
                .attr('stroke', '#DCDCDC')
            chemRefresh
                .append('text')
                .attr('x', 4)
                .attr('y', 12)
                .attr('font-size', 12)
                .attr('fill', '#DCDCDC')
                .style('cursor', 'pointer')
                .html('Refresh')
                .on('click', function () {
                    d3.selectAll('#chem_h_bar_to_100').attr('opacity', '1')
                    d3.selectAll('.chem_h_focus_values').remove()
                    d3.selectAll('.stacked_chem_bar').each(function (d0, i0) {
                        let xPos = 0
                        d3.select(this)
                            .selectAll('.chemBarRectH')
                            .each(function (d, i) {
                                d3.select(this)
                                    .transition()
                                    .duration(400)
                                    .attr('fill', colorScale(i))
                                    .attr('x', xPos * xScaleFactor)
                                    .attr('opacity', 1)
                                xPos += d[chemsNameArr[i]]
                            })
                    })
                })

            //bar mouse events
            d3.selectAll('.stacked_chem_bar').each(function (d0, i0) {
                d3.select(this)
                    .selectAll('.chemBarRectH')
                    .each(function (d, i) {
                        //clicked bar pushes all bar of that type to left and shades others
                        var rec = d3.select(this)
                        rec.on('click', function () {
                            focusOnBars(i)
                        })
                            .on('mousemove', function (d2, i2) {
                                rec.attr('fill-opacity', '0.4')
                                d3.selectAll('.chem_hover_focus').remove()
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_hover_focus')
                                    .attr('x', d3.pointer(d2)[0] + 16)
                                    .attr('y', d3.pointer(d2)[1] + y(i0) + 25)
                                    .attr('font-size', 26)
                                    .attr('fill', 'black')
                                    .style('fill', 'black')
                                    .style('font-weight', 'bold')
                                    .html(
                                        chemsNameArr[i] +
                                            ': ' +
                                            d2[chemsNameArr[i]] +
                                            '%'
                                    )
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_hover_focus')
                                    .attr('x', d3.pointer(d2)[0] + 14)
                                    .attr('y', d3.pointer(d2)[1] + y(i0) + 25)
                                    .attr('font-size', 26)
                                    .attr('fill', 'black')
                                    .style('fill', 'black')
                                    .style('font-weight', 'bold')
                                    .html(
                                        chemsNameArr[i] +
                                            ': ' +
                                            d2[chemsNameArr[i]] +
                                            '%'
                                    )
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_hover_focus')
                                    .attr('x', d3.pointer(d2)[0] + 15)
                                    .attr('y', d3.pointer(d2)[1] + y(i0) + 26)
                                    .attr('font-size', 26)
                                    .attr('fill', 'black')
                                    .style('fill', 'black')
                                    .style('font-weight', 'bold')
                                    .html(
                                        chemsNameArr[i] +
                                            ': ' +
                                            d2[chemsNameArr[i]] +
                                            '%'
                                    )
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_hover_focus')
                                    .attr('x', d3.pointer(d2)[0] + 15)
                                    .attr('y', d3.pointer(d2)[1] + y(i0) + 24)
                                    .attr('font-size', 26)
                                    .attr('fill', 'black')
                                    .style('fill', 'black')
                                    .style('font-weight', 'bold')
                                    .html(
                                        chemsNameArr[i] +
                                            ': ' +
                                            d2[chemsNameArr[i]] +
                                            '%'
                                    )
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_hover_focus')
                                    .attr('x', d3.pointer(d2)[0] + 15)
                                    .attr('y', d3.pointer(d2)[1] + y(i0) + 25)
                                    .attr('font-size', 26)
                                    .style('font-weight', 'bold')
                                    .html(
                                        chemsNameArr[i] +
                                            ': ' +
                                            d2[chemsNameArr[i]] +
                                            '%'
                                    )
                            })
                            .on('mouseleave', function () {
                                d3.selectAll('.chem_hover_focus').remove()
                                rec.attr('fill-opacity', '1')
                            })
                    })
            })

            function focusOnBars(i) {
                if (i >= numOfChems) return
                d3.selectAll('#chem_h_bar_to_100').attr('opacity', '0.15')
                d3.selectAll('.chem_h_focus_values').remove()
                d3.selectAll('.stacked_chem_bar').each(function (d2, i2) {
                    var xPos = 0
                    d3.select(this)
                        .selectAll('.chemBarRectH')
                        .each(function (d21, i21) {
                            if (i21 == i) {
                                d3.select(this)
                                    .transition()
                                    .duration(400)
                                    .attr('fill', colorScale(i21))
                                    .attr('x', 0)
                                    .attr('opacity', 1)
                                chemChartH
                                    .append('text')
                                    .attr('class', 'chem_h_focus_values')
                                    .attr(
                                        'x',
                                        d21[chemsNameArr[i]] * xScaleFactor + 15
                                    )
                                    .attr('y', y(i2) + (pheight / c) * 0.9)
                                    .attr('font-size', pheight / c)
                                    .attr('fill', '#DCDCDC')
                                    .attr('opacity', '0')
                                    .html(d21[chemsNameArr[i21]])
                                xPos += d21[chemsNameArr[i]]
                            } else if (i21 > i) {
                                d3.select(this)
                                    .transition()
                                    .duration(400)
                                    .attr('fill', colorScale(i21))
                                    .attr('x', xPos * xScaleFactor)
                                    .attr('opacity', '0.15')
                                xPos += d21[chemsNameArr[i21]]
                            } else {
                                d3.select(this)
                                    .transition()
                                    .duration(400)
                                    .attr('fill', colorScale(i21))
                                    .attr(
                                        'x',
                                        (xPos + d21[chemsNameArr[i]]) *
                                            xScaleFactor
                                    )
                                    .attr('opacity', '0.15')
                                xPos += d21[chemsNameArr[i21]]
                            }
                        })
                })
                var highestValue = 0
                d3.selectAll('.chem_h_focus_values').each(function () {
                    if (parseInt(d3.select(this).html()) > highestValue)
                        highestValue = d3.select(this).html()
                })
                d3.selectAll('.chem_h_focus_values').each(function () {
                    d3.select(this)
                        .attr('x', highestValue * xScaleFactor + 10)
                        .transition()
                        .delay(300)
                        .duration(200)
                        .attr('opacity', '1')
                })
            }
        } else CursorInfo.update('ERROR: No Chemistry Data.', 2500, true)
    }
}

export default {
    make: function (chems, chemLayerVar, divId) {
        makeChemistryChart(chems, chemLayerVar, divId)
    },
}
