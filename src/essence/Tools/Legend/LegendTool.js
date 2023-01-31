import $ from 'jquery'
import * as d3 from 'd3'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'

//Add the tool markup if you want to do it this way
var markup = [].join('\n')

var LegendTool = {
    height: 0,
    width: 200,
    activeLayerNames: null,
    MMWebGISInterface: null,
    make: function () {
        this.MMWebGISInterface = new interfaceWithMMWebGIS()

        this.activeLayerNames = []
    },
    destroy: function () {
        this.MMWebGISInterface.separateFromMMWebGIS()
    },
    overwriteLegends: overwriteLegends,
}

//
function interfaceWithMMWebGIS() {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }

    var tools = drawLegendHeader()

    //Add the markup to tools or do it manually
    //tools.html( markup );

    //Add event functions and whatnot
    //Draw legends
    var first = true
    for (let l in L_.layers.on) {
        if (L_.layers.on[l] == true) {
            if (L_.layers.data[l].type != 'header') {
                if (L_.layers.data[l]?._legend != undefined) {
                    drawLegends(tools, L_.layers.data[l]?._legend, l, L_.layers.data[l].display_name, L_.layers.opacity[l])
                }
            }
        }
    }

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMWebGIS() {}
}

// The legends parameter should be an array of objects, where each object must contain
// the following keys: legend, layerUUID, display_name, opacity.
// The value for the legend key should be in the same format as what is stored in the
// layers data under the `_legend` key (i.e. `L_.layers.data[layerName]._legend`).
// layerUUID and display_name should be strings and opacity should be a number between 0 and 1.
function overwriteLegends(legends) {
    if (!Array.isArray(legends)) {
        console.warn(
            "legends parameter must be an array.", legends
        )
        return
    }

    if (legends.length < 1) {
        console.warn(
            "legends array is empty.", legends
        )
        return
    }

    var tools = drawLegendHeader()

    for (let l in legends) {
        const { legend, layerUUID, display_name, opacity } = legends[l]
        if (!legend || !layerUUID || !display_name || !opacity) {
            console.warn(
                "Unable to overwrite legends in LegendTool.", legends
            )
            return
        }
        drawLegends(tools, legend, layerUUID, display_name, opacity)
    }
}

function drawLegendHeader() {
    //MMWebGIS should always have a div with id 'tools'
    var tools = d3.select('#toolPanel')
    tools.style('background', 'var(--color-k)')
    //Clear it
    tools.selectAll('*').remove()
    tools
        .append('div')
        .style('height', '40px')
        .style('line-height', '40px')
        .style('font-size', '16px')
        .style('padding-left', '6px')
        .style('color', 'var(--color-l)')
        .style('background', 'var(--color-a)')
        .style('font-family', 'lato-light')
        .style('text-transform', 'uppercase')
        .html('Legend')
    //Add a semantic container
    tools = tools
        .append('div')
        .attr('id', 'LegendTool')
        .style('color', '#dcdcdc')
        .style('height', 'calc(100% - 40px)')
        .style('overflow-y', 'auto')

    return tools
}

function drawLegends(tools, _legend, layerUUID, display_name, opacity) {
    var c = tools
        .append('div')
        .attr('class', 'mmgisScrollbar')
        .style('width', '100%')
        .style('display', 'inline-block')
        .style('padding-top', '5px')
        .style('border-top', '1px solid var(--color-i)')

    c.append('div')
        .attr('class', 'row')
        .append('p')
        .style('font-size', '16px')
        .style('color', 'var(--color-f)')
        .style('margin-bottom', '5px')
        .style('padding-left', '10px')
        .html(display_name)

    let lastContinues = []
    let lastShape = ''
    for (let d in _legend) {
        var shape = _legend[d].shape
        if (
            shape == 'circle' ||
            shape == 'square' ||
            shape == 'rect' ||
            shape == 'triangle'
        ) {
            // finalize discreet and continuous
            if (lastContinues.length > 0) {
                pushScale(lastContinues)
                lastContinues = []
            }

            var r = c
                .append('div')
                .attr('class', 'row')
                .style('display', 'flex')
                .style('margin', '0px 0px 10px 10px')
            var svg = r
                .append('svg')
                .attr('width', '20px')
                .attr('height', '20px')

            switch (shape) {
                case 'circle':
                    svg.append('circle')
                        .attr('class', layerUUID + '_legendshape')
                        .attr('r', 7)
                        .attr('cx', 10)
                        .attr('cy', 10)
                        .attr(
                            'fill',
                            _legend[d].color
                        )
                        .attr('opacity', opacity)
                        .attr(
                            'stroke',
                            _legend[d]
                                .strokecolor
                        )
                    break
                case 'square':
                    svg.append('rect')
                        .attr('class', layerUUID + '_legendshape')
                        .attr('width', 20)
                        .attr('height', 20)
                        .attr(
                            'fill',
                            _legend[d].color
                        )
                        .attr('opacity', opacity)
                        .attr(
                            'stroke',
                            _legend[d]
                                .strokecolor
                        )
                    break
                case 'rect':
                    svg.append('rect')
                        .attr('class', layerUUID + '_legendshape')
                        .attr('width', 20)
                        .attr('height', 10)
                        .attr('y', 5)
                        .attr(
                            'fill',
                            _legend[d].color
                        )
                        .attr('opacity', opacity)
                        .attr(
                            'stroke',
                            _legend[d]
                                .strokecolor
                        )
                    break
                case 'triangle':
                    var trianglePoints = '0 0, 10 20, 20 0'
                    svg.append('polyline')
                        .attr('class', layerUUID + '_legendshape')
                        .attr('width', 20)
                        .attr('height', 20)
                        .attr('points', trianglePoints)
                        .attr(
                            'fill',
                            _legend[d].color
                        )
                        .attr('opacity', opacity)
                        .attr(
                            'stroke',
                            _legend[d]
                                .strokecolor
                        )
                    break
            }
            svg.append(shape).attr(
                'fill',
                _legend[d].color
            )
            r.append('div')
                .style('margin-left', '5px')
                .style('height', '100%')
                .style('line-height', '21px')
                .style('font-size', '14px')
                .style('overflow', 'auto')
                .html(_legend[d].value)
        } else if (
            shape == 'continuous' ||
            shape == 'discreet'
        ) {
            if (lastShape != shape) {
                if (lastContinues.length > 0) {
                    pushScale(lastContinues)
                    lastContinues = []
                }
            }
            lastContinues.push({
                color: _legend[d].color,
                shape: shape,
                value: _legend[d].value,
            })
            lastShape = shape
        }
    }
    if (lastContinues.length > 0) {
        pushScale(lastContinues)
        lastContinues = []
    }

    function pushScale(lastContinues) {
        var r = c
            .append('div')
            .attr('class', 'row')
            .style('display', 'flex')
            .style('margin', '0px 0px 10px 10px')
        var gradient = r
            .append('div')
            .style('width', '19px')
            .style('height', 19 * lastContinues.length + 'px')
            .style('border', '1px solid black')
        var values = r.append('div')
        var gradientArray = []
        for (let i = 0; i < lastContinues.length; i++) {
            let v = values
                .append('div')
                .style('margin-left', '5px')
                .style('height', '19px')
                .style('line-height', '19px')
                .style('font-size', '14px')
                .style('position', 'relative')
                .html(lastContinues[i].value)

            if (lastContinues[i].shape == 'continuous') {
                v.append('div')
                    .style('position', 'absolute')
                    .style('width', '3px')
                    .style('height', '1px')
                    .style('background', 'white')
                    .style('left', '-23px')
                    .style('top', '10px')
                    .style('mix-blend-mode', 'difference')
                v.append('div')
                    .style('position', 'absolute')
                    .style('width', '3px')
                    .style('height', '1px')
                    .style('background', 'white')
                    .style('left', '-9px')
                    .style('top', '10px')
                    .style('mix-blend-mode', 'difference')

                let color = lastContinues[i].color
                if (i === 0)
                    color += ' ' + (1 / lastContinues.length) * 50 + '%'
                else if (i === lastContinues.length - 1)
                    color += ' ' + (100 - (1 / lastContinues.length) * 50) + '%'
                gradientArray.push(color)
            } else {
                gradientArray.push(
                    lastContinues[i].color +
                        ' ' +
                        (i / lastContinues.length) * 100 +
                        '%'
                )
                gradientArray.push(
                    lastContinues[i].color +
                        ' ' +
                        ((i + 1) / lastContinues.length) * 100 +
                        '%'
                )
            }
        }

        gradient.style(
            'background',
            'linear-gradient(to bottom, ' + gradientArray.join(',') + ')'
        )
    }

}

//Other functions

export default LegendTool
