//New Tool Template
//In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'Globe_',
    'Map_',
    'Viewer_',
], function($, d3, F_, L_, Globe_, Map_, Viewer_) {
    //Add the tool markup if you want to do it this way
    var markup = [].join('\n')

    var LegendTool = {
        height: 0,
        width: 180,
        activeLayerNames: null,
        MMWebGISInterface: null,
        make: function() {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()

            this.activeLayerNames = []
        },
        destroy: function() {
            this.MMWebGISInterface.separateFromMMWebGIS()
        },
    }

    //
    function interfaceWithMMWebGIS() {
        this.separateFromMMWebGIS = function() {
            separateFromMMWebGIS()
        }

        //MMWebGIS should always have a div with id 'tools'
        var tools = d3.select('#toolPanel')
        tools.style('background', 'var(--color-a)')
        //Clear it
        tools.selectAll('*').remove()
        tools
            .append('div')
            .style('height', '30px')
            .style('line-height', '30px')
            .style('font-size', '16px')
            .style('color', 'var(--color-mmgis)')
            .style('padding-left', '6px')
            .html('Legend')
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('id', 'LegendTool')
            .attr('class', 'mmgisScrollbar')
            .style('color', '#dcdcdc')
            .style('height', '100%')
            .style('overflow-y', 'auto')
            .style('border-left', '1px solid var(--color-i)')

        //Add the markup to tools or do it manually
        //tools.html( markup );

        //Add event functions and whatnot
        //Draw legends
        var first = true
        for (l in L_.toggledArray) {
            if (L_.toggledArray[l] == true) {
                if (L_.layersNamed[l].type != 'header') {
                    if (L_.layersLegends[l] != undefined) {
                        var c = tools
                            .append('div')
                            .attr('class', 'mmgisScrollbar')
                            .style('width', '100%')
                            .style('display', 'inline-block')
                            .style('padding-top', '5px')
                            .style('border-top', '1px solid var(--color-i)')
                        first = false
                        c.append('div')
                            .attr('class', 'row')
                            .append('p')
                            .style('font-size', '16px')
                            .style('text-align', 'center')
                            .style('color', 'var(--color-mw)')
                            .style('margin-bottom', '5px')
                            .html(l)

                        let lastContinues = []
                        let lastShape = ''
                        for (d in L_.layersLegendsData[l]) {
                            var shape = L_.layersLegendsData[l][d].shape
                            if (
                                shape == 'circle' ||
                                shape == 'square' ||
                                shape == 'rect'
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
                                            .attr('class', l + '_legendshape')
                                            .attr('r', 7)
                                            .attr('cx', 10)
                                            .attr('cy', 10)
                                            .attr(
                                                'fill',
                                                L_.layersLegendsData[l][d].color
                                            )
                                            .attr('opacity', L_.opacityArray[l])
                                            .attr(
                                                'stroke',
                                                L_.layersLegendsData[l][d]
                                                    .strokecolor
                                            )
                                        break
                                    case 'square':
                                        svg.append('rect')
                                            .attr('class', l + '_legendshape')
                                            .attr('width', 20)
                                            .attr('height', 20)
                                            .attr(
                                                'fill',
                                                L_.layersLegendsData[l][d].color
                                            )
                                            .attr('opacity', L_.opacityArray[l])
                                            .attr(
                                                'stroke',
                                                L_.layersLegendsData[l][d]
                                                    .strokecolor
                                            )
                                        break
                                    case 'rect':
                                        svg.append('rect')
                                            .attr('class', l + '_legendshape')
                                            .attr('width', 20)
                                            .attr('height', 10)
                                            .attr('y', 5)
                                            .attr(
                                                'fill',
                                                L_.layersLegendsData[l][d].color
                                            )
                                            .attr('opacity', L_.opacityArray[l])
                                            .attr(
                                                'stroke',
                                                L_.layersLegendsData[l][d]
                                                    .strokecolor
                                            )
                                        break
                                }
                                svg.append(shape).attr(
                                    'fill',
                                    L_.layersLegendsData[l][d].color
                                )
                                r.append('div')
                                    .style('margin-left', '5px')
                                    .html(L_.layersLegendsData[l][d].value)
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
                                    color: L_.layersLegendsData[l][d].color,
                                    shape: shape,
                                    value: L_.layersLegendsData[l][d].value,
                                })
                                lastShape = shape
                            }
                        }
                        if (lastContinues.length > 0) {
                            pushScale(lastContinues)
                            lastContinues = []
                        }
                    }
                }
            }
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
                        color +=
                            ' ' + (100 - (1 / lastContinues.length) * 50) + '%'
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

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMWebGIS() {}
    }

    //Other functions

    return LegendTool
})
