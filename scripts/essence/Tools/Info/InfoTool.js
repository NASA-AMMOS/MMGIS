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
    'Kinds',
    'css!InfoTool',
], function($, d3, F_, L_, Globe_, Map_, Viewer_, Kinds) {
    //Add the tool markup if you want to do it this way
    // prettier-ignore
    // prettier-ignore
    var markup = [
        "<div id='infoTool'>",
            "<div id='infoToolTitle'>Info</div>",
            "<ul id='infoToolSelections'>",
            "</ul>",
            "<div id='infoToolContents'>",
                "<div id='infoToolProperties' class='infoToolList'>",
                    "<div class='infoToolHeader'>",
                        "<div>Properties</div>",
                        "<div><i class='mdi mdi-minus mdi-18px'></i></div>",
                    "</div>",
                    "<ul>",
                    "</ul>",
                "</div>",
                "<div id='infoToolGeometry' class='infoToolList collapsed'>",
                    "<div class='infoToolHeader'>",
                        "<div>Geometry</div>",
                        "<div><i class='mdi mdi-plus mdi-18px'></i></div>",
                    "</div>",
                    "<ul>",
                    "</ul>",
                "</div>",
            "</div>",
        "</div>"
    ].join('\n');

    var InfoTool = {
        height: 0,
        width: 250,
        currentLayer: null,
        currentLayerName: null,
        info: null,
        variables: null,
        activeFeatureI: null,
        geoOpen: false,
        vars: {},
        MMGISInterface: null,
        make: function() {
            this.MMGISInterface = new interfaceWithMMGIS()
        },
        destroy: function() {
            this.MMGISInterface.separateFromMMGIS()
        },
        getUrlString: function() {
            return ''
        },
        //We might get multiple features if vector layers overlap
        use: function(currentLayer, currentLayerName, features, variables, activeI) {
            //In the very least, update the info
            if (!$('#InfoTool').hasClass('active')) $('#InfoTool').click()

            this.currentLayer = currentLayer
            this.currentLayerName = currentLayerName
            this.info = features
            this.variables = variables
            this.activeFeatureI = activeI || 0

            //MMGIS should always have a div with id 'tools'
            var tools = d3.select('#toolPanel')
            tools.style('background', 'var(--color-a')
            //Clear it
            tools.selectAll('*').remove()
            //Add a semantic container
            tools = tools.append('div').style('height', '100%')
            //Add the markup to tools or do it manually
            tools.html(markup)

            if (this.info == null || this.info.length == 0) return

            d3.select('#infoToolSelections')
                .selectAll('*')
                .remove()
            for (var i = 0; i < this.info.length; i++) {
                var name = this.info[i].properties[
                    Object.keys(this.info[i].properties)[0]
                ]
                if (
                    this.variables &&
                    this.variables.useKeyAsName &&
                    this.info[i].properties.hasOwnProperty(
                        this.variables.useKeyAsName
                    )
                )
                    name = this.info[i].properties[this.variables.useKeyAsName]

                d3.select('#infoToolSelections')
                    .append('li')
                    .attr('class', i == this.activeFeatureI ? 'active' : '')
                    .on(
                        'click',
                        (function(idx) {
                            return function() {
                                Kinds.use(
                                    L_.layersNamed[InfoTool.currentLayerName].kind,
                                    Map_,
                                    InfoTool.info[idx],
                                    InfoTool.currentLayer
                                )
                                InfoTool.use(
                                    InfoTool.currentLayer,
                                    InfoTool.currentLayerName,
                                    InfoTool.info,
                                    InfoTool.variables,
                                    idx
                                )
                            }
                        })(i)
                    )
                    .html(name)
            }

            var propertiesLis = []
            var geometryLis = []
            depthTraversal(
                this.info[this.activeFeatureI].properties,
                0,
                'properties'
            )
            depthTraversal(
                this.info[this.activeFeatureI].geometry,
                0,
                'geometry'
            )
            function depthTraversal(node, depth, type) {
                let iter = Object.keys(node)
                for (var i = 0; i < iter.length; i++) {
                    //Add other feature information while we're at it
                    if (
                        typeof node[iter[i]] === 'object' &&
                        node[iter[i]] != null
                    ) {
                        var li =
                            '<li class="infoToolSubheader" style="padding-left: ' +
                            depth * 10 +
                            'px;"><div>' +
                            iter[i] +
                            ':</div><div>' +
                            '</div></li>'
                        if (type === 'properties') propertiesLis.push(li)
                        else if (type === 'geometry') geometryLis.push(li)
                        depthTraversal(node[iter[i]], depth + 1, type)
                    } else {
                        var li =
                            '<li style="padding-left: ' +
                            depth * 10 +
                            'px;"><div>' +
                            iter[i] +
                            '</div><div>' +
                            node[iter[i]] +
                            '</div></li>'
                        if (type === 'properties') propertiesLis.push(li)
                        else if (type === 'geometry') geometryLis.push(li)
                    }
                }
            }

            $('#infoToolProperties ul').html(propertiesLis.join('\n'))
            $('#infoToolGeometry ul').html(geometryLis.join('\n'))

            if (this.geoOpen) {
                var h = $('#infoToolGeometry .infoToolHeader i')
                h.toggleClass('mdi-plus')
                h.toggleClass('mdi-minus')
                h.parent()
                    .parent()
                    .parent()
                    .toggleClass('collapsed')
            }

            $('.infoToolHeader i').on('click', function() {
                $(this).toggleClass('mdi-plus')
                $(this).toggleClass('mdi-minus')
                $(this)
                    .parent()
                    .parent()
                    .parent()
                    .toggleClass('collapsed')
                InfoTool.geoOpen = !InfoTool.geoOpen
            })
        },
    }

    //
    function interfaceWithMMGIS() {
        this.separateFromMMGIS = function() {
            separateFromMMGIS()
        }

        //Add event functions and whatnot
        InfoTool.use(null, null, InfoTool.info)

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMGIS() {}
    }

    //Other functions

    return InfoTool
})
