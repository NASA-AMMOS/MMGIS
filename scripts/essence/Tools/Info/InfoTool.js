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
    'jsonViewer',
    'css!InfoTool',
], function($, d3, F_, L_, Globe_, Map_, Viewer_, Kinds, jsonViewer) {
    //Add the tool markup if you want to do it this way
    // prettier-ignore
    // prettier-ignore
    var markup = [
        "<div id='infoTool'>",
            "<div id='infoToolTitle'>Info</div>",
            "<ul id='infoToolSelections'>",
            "</ul>",
            "<div id='infoToolContents'>",
            "<pre id='json-renderer'></pre>",
        "</div>"
    ].join('\n');

    var InfoTool = {
        height: 0,
        width: 300,
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
        use: function(
            currentLayer,
            currentLayerName,
            features,
            variables,
            activeI,
            open,
            initialEvent,
            additional
        ) {
            let toolActive = $('#InfoTool').hasClass('active')

            if (!open && toolActive) open = true

            //In the very least, update the info
            if (open && !toolActive) {
                $('#InfoTool').click()
            }

            if (additional && additional.idx) activeI = additional.idx

            if (currentLayer != null && currentLayerName != null) {
                this.currentLayer = currentLayer
                this.currentLayerName = currentLayerName
                this.info = features
                this.variables = variables
                this.activeFeatureI = activeI || 0
                this.initialEvent = initialEvent
            }

            if (open != true) return
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
                if (!this.info[i].properties) {
                    if (this.info[i].feature)
                        this.info[i] = this.info[i].feature
                }
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
                                let e = JSON.parse(
                                    JSON.stringify(InfoTool.initialEvent)
                                )
                                Kinds.use(
                                    L_.layersNamed[InfoTool.currentLayerName]
                                        .kind,
                                    Map_,
                                    InfoTool.info[idx],
                                    InfoTool.currentLayer,
                                    InfoTool.currentLayerName,
                                    null,
                                    e,
                                    { idx: idx },
                                    InfoTool.info
                                )
                            }
                        })(i)
                    )
                    .html(name)
            }

            $('#json-renderer').jsonViewer(this.info[this.activeFeatureI], {
                collapsed: false,
                withQuotes: false,
                withLinks: true,
            })
        },
    }

    //
    function interfaceWithMMGIS() {
        this.separateFromMMGIS = function() {
            separateFromMMGIS()
        }

        //Add event functions and whatnot
        InfoTool.use(
            null,
            null,
            InfoTool.info,
            InfoTool.variables,
            null,
            true,
            null
        )

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMGIS() {}
    }

    //Other functions

    return InfoTool
})
