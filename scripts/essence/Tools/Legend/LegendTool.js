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
            .style('height', '33px')
            .style('line-height', '30px')
            .style('font-size', '16px')
            .style('color', 'var(--color-mmgis)')
            .html('Legend')
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('id', 'LegendTool')
            .attr('class', 'mmgisScrollbar')
            .style('padding', '0px 5px')
            .style('color', '#cfcfcf')
            .style('height', '100%')
            .style('overflow-y', 'auto')

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
                            .style('margin-top', '4px')
                            .style('margin-bottom', '4px')
                            .style('display', 'inline-block')
                        first = false
                        c.append('div')
                            .attr('class', 'row')
                            .append('p')
                            //.style( 'float', 'left' )
                            .style('font-size', '16px')
                            .style('font-weight', 'bold')
                            .html(l)
                        for (d in L_.layersLegendsData[l]) {
                            var shape = L_.layersLegendsData[l][d].shape
                            if (
                                shape == 'circle' ||
                                shape == 'square' ||
                                shape == 'rect'
                            ) {
                                var r = c
                                    .append('div')
                                    .attr('class', 'row')
                                    .style('margin-left', '10px')
                                var svg = r
                                    .append('svg')
                                    .attr('width', '19px')
                                    .attr('height', '19px')
                                    .style('float', 'left')
                                    .style('position', 'relative')

                                switch (shape) {
                                    case 'circle':
                                        svg.append('circle')
                                            .attr('class', l + '_legendshape')
                                            .attr('r', 7)
                                            .attr('cx', 8)
                                            .attr('cy', 8)
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
                                            .attr('width', 18)
                                            .attr('height', 18)
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
                                            .attr('width', 18)
                                            .attr('height', 8)
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
                                r.append('p').html(
                                    L_.layersLegendsData[l][d].value
                                )
                            }
                        }
                    }
                }
            }
        }

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMWebGIS() {}
    }

    //Other functions

    return LegendTool
})
