import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import CursorInfo from '../../Ancillary/CursorInfo'

var clearFunction

function makeChemistryPlot(chems, names, id) {
    var svg
    var options, resetClear
    var margin = { top: 5, right: 5, bottom: 15, left: 25 },
        width = 300, //55
        height = 300 // - margin.top - margin.bottom;//20
    var dropdownX, dropdownY
    var scaleDim
    var x, y
    var xAxis, yAxis
    var zoom

    function setupDiv() {
        var cp = d3.select('#chemistry_panel')
        cp.selectAll('*').remove()

        d3.selectAll('#chemistry_plot').remove()

        svg = cp
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .attr('id', 'chemistry_plot')
            .style('margin-left', 5)
            .style('float', 'left')
            .append('g')
            .attr(
                'transform',
                'translate(' + margin.left + ',' + margin.top + ')'
            )

        options = cp
            .append('div')
            .style('margin', '2px 8px 0px 8px')
            .style('display', 'flex')
            .style('flex-flow', 'column')

        var xLabel = options
            .append('div')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .html('X Axis ')

        var xDropdown = xLabel
            .append('select')
            .style('background', 'rgba(0,0,0,0.35)')
            .style('border', 'none')
            .attr('id', 'chem_x_axis_dropdown')

        xDropdown.append('option').attr('value', 'Al2O3').html('Al2O3')
        xDropdown.append('option').attr('value', 'CaO').html('CaO')
        xDropdown.append('option').attr('value', 'FeOT').html('FeOT')
        xDropdown.append('option').attr('value', 'K2O').html('K2O')
        xDropdown.append('option').attr('value', 'MgO').html('MgO')
        xDropdown.append('option').attr('value', 'Na2O').html('Na2O')
        xDropdown.append('option').attr('value', 'SiO2').html('SiO2')
        xDropdown.append('option').attr('value', 'TiO2').html('TiO2')
        xDropdown.append('option').attr('value', 'CIA').html('CIA')

        var yLabel = options
            .append('div')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .html('Y Axis ')

        var yDropdown = yLabel
            .append('select')
            .style('background', 'rgba(0,0,0,0.35)')
            .style('border', 'none')
            .attr('id', 'chem_y_axis_dropdown')

        yDropdown.append('option').attr('value', 'Al2O3').html('Al2O3')
        yDropdown.append('option').attr('value', 'CaO').html('CaO')
        yDropdown.append('option').attr('value', 'FeOT').html('FeOT')
        yDropdown.append('option').attr('value', 'K2O').html('K2O')
        yDropdown.append('option').attr('value', 'MgO').html('MgO')
        yDropdown.append('option').attr('value', 'Na2O').html('Na2O')
        yDropdown.append('option').attr('value', 'SiO2').html('SiO2')
        yDropdown.append('option').attr('value', 'TiO2').html('TiO2')
        yDropdown.append('option').attr('value', 'CIA').html('CIA')

        dropdownX = document.getElementById('chem_x_axis_dropdown')
        dropdownY = document.getElementById('chem_y_axis_dropdown')

        scaleDim = highestInChems(
            dropdownX.options[dropdownX.selectedIndex].value,
            dropdownY.options[dropdownY.selectedIndex].value
        )

        x = d3.scale
            .linear()
            .domain([0, scaleDim * 1.1])
            .range([0, width])

        y = d3.scale
            .linear()
            .domain([0, scaleDim * 1.1])
            .range([height, 0])

        xAxis = d3.svg
            .axis()
            .scale(x)
            .orient('bottom')
            .ticks(5)
            .tickSize(-height)

        yAxis = d3.svg.axis().scale(y).orient('left').ticks(5).tickSize(-width)

        /*
        zoom = d3.behavior
            .zoom()
            .x(x)
            .y(y)
            .scaleExtent([0.38, 1000])
            .on('zoom', cPZoomed)

        svg.call(zoom)
        */

        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', '#E1E1E1')

        svg.append('g')
            .attr('class', 'cplot_x cplot_axis')
            .style('fill', '#DCDCDC')
            .attr('transform', 'translate(0,' + height + ')')
            .call(xAxis)

        svg.append('g')
            .attr('class', 'cplot_y cplot_axis')
            .style('fill', '#DCDCDC')
            .call(yAxis)

        resetClear = options.append('div').style('display', 'flex')
        resetClear
            .append('div')
            .attr('class', 'mmgisButton')
            .attr('id', 'chemistryToolReset')
            .style('text-align', 'center')
            .style('margin-left', '0px')
            .style('margin-right', '0px')
            .html('Reset')
        resetClear
            .append('div')
            .attr('class', 'mmgisButton')
            .attr('id', 'chemistryToolClear')
            .style('text-align', 'center')
            .style('margin-left', '0px')
            .style('margin-right', '0px')
            .html('Clear')
    }

    id == 0
        ? d3.select('#chem_target_type').html('CCAM')
        : d3.select('#chem_target_type').html('APXS')

    function highestInChems(cX, cY) {
        if (cX == 'CIA' || cY == 'CIA') return 100
        var highestValue = 0
        for (var i = 0; i < chems.length; i++) {
            if (parseFloat(chems[i][cX]) > highestValue)
                highestValue = parseFloat(chems[i][cX])
            if (parseFloat(chems[i][cY]) > highestValue)
                highestValue = parseFloat(chems[i][cY])
        }
        return highestValue
    }

    setupDiv()

    var marginlessSVG = svg
        .append('svg')
        .attr('width', width)
        .attr('height', height)

    var colorScale = d3.scale
        .linear()
        .domain([-1, 0, 1, 2, 3, 4, 5, 6, 7])
        .range([
            '#000',
            '#1f77b4',
            '#ff7f0e',
            '#2ca02c',
            '#d62728',
            '#9467bd',
            '#e377c2',
            '#bcbd22',
            '#17becf',
        ])

    marginlessSVG
        .selectAll('.dot')
        .data(chems)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('r', 3.5)
        .attr('cx', function (d) {
            var v = dropdownX.options[dropdownX.selectedIndex].value
            if (v == 'CIA')
                return x(
                    parseFloat(d['Al2O3']) /
                        (parseFloat(d['Al2O3']) +
                            parseFloat(d['Na2O']) +
                            parseFloat(d['K2O']) +
                            parseFloat(d['CaO']))
                )
            return x(+d[v])
        })
        .attr('cy', function (d) {
            var v = dropdownY.options[dropdownY.selectedIndex].value
            if (v == 'CIA')
                return y(
                    parseFloat(d['Al2O3']) /
                        (parseFloat(d['Al2O3']) +
                            parseFloat(d['Na2O']) +
                            parseFloat(d['K2O']) +
                            parseFloat(d['CaO']))
                )
            return y(+d[v])
        })
        .style('fill', function (d) {
            return colorScale(
                id == 0 ? names.indexOf(d.Target) : names.indexOf(d.Target)
            )
        })
        .attr('stroke', '#222')
        .attr('stroke-width', '1')

    d3.select('#chemistryToolReset').on('click', reset)
    d3.select('#chemistryToolClear').on('click', function () {
        d3.selectAll('#chemistry_plot').remove()
        d3.select('#chem_plot_legend').remove()

        if (typeof clearFunction === 'function') clearFunction()

        if (id == 0) {
            chemsArray = []
            chemsNames = []
        } else {
            apxsArray = []
            apxsNames = []
        }
    })

    //Switch between chemcam and apxs plots and change dropdown menu options accordingly
    d3.select('#chem_set_apxs').on('click', function () {
        makeDropDown('APXS')
    })
    d3.select('#chem_set_ccam').on('click', function () {
        makeDropDown('ChemCam')
    })

    d3.select('#chem_x_axis_dropdown').on('change', reset)
    d3.select('#chem_y_axis_dropdown').on('change', reset)

    function makeDropDown(type) {
        var xv = dropdownX.options[dropdownX.selectedIndex].value
        var yv = dropdownY.options[dropdownY.selectedIndex].value

        var ddx = d3.select('#chem_x_axis_dropdown')
        var ddy = d3.select('#chem_y_axis_dropdown')
        ddx.selectAll('*').remove()
        ddy.selectAll('*').remove()

        for (var k = 0; k < namedLayersData[type].variable.length; k++) {
            var newXOp = ddx
                .append('option')
                .attr('value', namedLayersData[type].variable[k])
                .html(namedLayersData[type].variable[k])
            var newYOp = ddy
                .append('option')
                .attr('value', namedLayersData[type].variable[k])
                .html(namedLayersData[type].variable[k])

            if (xv == namedLayersData[type].variable[k])
                newXOp.attr('selected', 'selected')
            if (yv == namedLayersData[type].variable[k])
                newYOp.attr('selected', 'selected')
        }
        ddx.append('option').attr('value', 'CIA').html('CIA')
        ddy.append('option').attr('value', 'CIA').html('CIA')

        type == 'ChemCam'
            ? makeChemPlot(chemsArray, chemsNames, 0)
            : makeChemPlot(apxsArray, apxsNames, 1)
    }

    function cPZoomed() {
        /*
      if(x.domain()[0] <= 0)
        x.domain()[0] = 0;
      if(x.domain()[1] <= 0)
        x.domain()[1] = 0;
      if(y.domain()[0] <= 0)
        y.domain()[0] = 0;
      if(y.domain()[1] <= 0)
        y.domain()[1] = 0;
      */
        svg.select('.cplot_x').call(xAxis)
        svg.select('.cplot_y').call(yAxis)
        svg.selectAll('.dot')
            .attr('cx', function (d) {
                var v = dropdownX.options[dropdownX.selectedIndex].value
                if (v == 'CIA')
                    return x(
                        100 *
                            (parseFloat(d['Al2O3']) /
                                (parseFloat(d['Al2O3']) +
                                    parseFloat(d['Na2O']) +
                                    parseFloat(d['K2O']) +
                                    parseFloat(d['CaO'])))
                    )
                return x(+d[v])
            })
            .attr('cy', function (d) {
                var v = dropdownY.options[dropdownY.selectedIndex].value
                if (v == 'CIA')
                    return y(
                        100 *
                            (parseFloat(d['Al2O3']) /
                                (parseFloat(d['Al2O3']) +
                                    parseFloat(d['Na2O']) +
                                    parseFloat(d['K2O']) +
                                    parseFloat(d['CaO'])))
                    )
                return y(+d[v])
            })
    }

    function reset() {
        scaleDim = highestInChems(
            dropdownX.options[dropdownX.selectedIndex].value,
            dropdownY.options[dropdownY.selectedIndex].value
        )
        d3.transition()
            .duration(750)
            .tween('zoom', function () {
                var ix = d3.interpolate(x.domain(), [0, scaleDim * 1.1]),
                    iy = d3.interpolate(y.domain(), [0, scaleDim * 1.1])
                return function (t) {
                    zoom.x(x.domain(ix(t))).y(y.domain(iy(t)))
                    cPZoomed()
                }
            })
    }

    var cPLSpacing = 30
    d3.select('#chem_plot_legend').remove()
    var chemPlotLegend = d3
        .select('#chemistry_panel')
        .append('svg')
        .attr('id', 'chem_plot_legend')
        .attr('width', width + margin.left / 2 + margin.right)
        .attr('height', names.length * cPLSpacing)
        .style('position', 'absolute')
        .style('height', '218px')
        .style('top', '120px')
        .style('left', '334px')
        .append('g')
        .attr('transform', 'translate(' + 0 + ',' + 0 + ')')
    for (var i = 0; i < names.length; i++) {
        chemPlotLegend
            .append('rect')
            .attr('width', cPLSpacing / 1.2)
            .attr('height', cPLSpacing / 1.2)
            .attr('x', 0)
            .attr('y', i * cPLSpacing)
            .attr('fill', colorScale(names.indexOf(names[i])))

        chemPlotLegend
            .append('text')
            .html(names[i])
            .attr('x', cPLSpacing)
            .attr('y', i * cPLSpacing + cPLSpacing / 1.5)
            .attr('fill', '#DCDCDC')
    }
}

export default {
    make: function (chems, chemLayerVar, id, clearFunc) {
        clearFunction = clearFunc
        makeChemistryPlot(chems, chemLayerVar, id)
    },
}
