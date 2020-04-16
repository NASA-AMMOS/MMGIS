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
    'UserInterface_',
    'chemistrychart',
    'chemistryplot',
], function(
    $,
    d3,
    F_,
    L_,
    Globe_,
    Map_,
    Viewer_,
    UserInterface_,
    chemistrychart,
    chemistryplot
) {
    //Add the tool markup if you want to do it this way
    // prettier-ignore
    var markup = [
    "<div id='chemistryToolPanel' style='padding-top: 2px; display: flex; position: absolute; width: 100%; height: 100%;'>",
      "<div id='chemistry_panel' style='width: 100%; height: 100%; display: flex; text-shadow: none;'></div>",
    "</div>",
    "<div id='chemistryToolOptions' style='padding-top: 2px; margin-bottom: 8px; display: flex; justify-content: space-between;'>",
      "<p id='chemistryToolName' style='margin: 0; margin-left: 8px; font-size: 20px;'>Place Name</p>",
      "<div id='chemistryToolSingleMulti' class='mmgisRadioBar' style='margin-left: 0;'>",
        "<div id='chemistryToolSingleMode' class='active'>Single</div>",
        "<div id='chemistryToolMultiMode'>Multi</div>",
      "</div>",
    "</div>",
    ].join('\n');

    var ChemistryTool = {
        height: 220,
        width: 'full',
        heights: [220, 360],
        widths: [1200, 470],
        on: false,
        chemsArray: null,
        chemsNames: null,
        using: null,
        MMWebGISInterface: null,
        make: function() {
            this.chemsArray = []
            this.chemsNames = []
            this.MMWebGISInterface = new interfaceWithMMWebGIS()

            if (this.using != null) {
                chemOnClick(this.using)
            }

            this.on = true
        },
        use: function(layer) {
            this.using = layer
            if (this.on) {
                chemOnClick(this.using)
            }
        },
        destroy: function() {
            this.MMWebGISInterface.separateFromMMWebGIS()
            this.on = false
        },
    }

    //
    function interfaceWithMMWebGIS() {
        this.separateFromMMWebGIS = function() {
            separateFromMMWebGIS()
        }

        //MMWebGIS should always have a div with id 'tools'
        var tools = d3.select('#tools')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('id', '#chemistryTool')
            .style('display', 'flex')
            .style('flex-flow', 'column')
            .style('overflow', 'hidden')
            .style('height', '100%')
        //Add the markup to tools or do it manually
        tools.html(markup)

        $('.mmgisRadioBar#chemistryToolSingleMulti div').click(function() {
            $('.mmgisRadioBar#chemistryToolSingleMulti div').removeClass(
                'active'
            )
            $(this).addClass('active')
        })

        //Add event functions and whatnot
        var optionValue
        optionValue = $(
            '#chemistryToolOptions #chemistryToolSingleMulti .active'
        ).attr('id')
        if (optionValue == 'chemistryToolSingleMode') cPSelectorOn = false
        else cPSelectorOn = true

        //Events
        function _ct0() {
            cPSelectorOn = false
            d3.select('#chemistry_panel')
                .selectAll('*')
                .remove()
            UserInterface_.setToolWidth(ChemistryTool.widths[0])
            UserInterface_.setToolHeight(ChemistryTool.heights[0])
        }
        $('#chemistryToolOptions #chemistryToolSingleMode').click(_ct0)

        function _ct1() {
            cPSelectorOn = true
            d3.select('#chemistry_panel')
                .selectAll('*')
                .remove()
            UserInterface_.setToolWidth(ChemistryTool.widths[1])
            UserInterface_.setToolHeight(ChemistryTool.heights[1])
        }
        $('#chemistryToolOptions #chemistryToolMultiMode').click(_ct1)

        //Add chemOnClick to all layers with a chemistry variable
        /* //Moved to .use in onEachFeatureDefault
    for( var l in L_.layersNamed) {
      if( L_.layersNamed[l].hasOwnProperty( 'variables' ) &&
          L_.layersNamed[l].variables.hasOwnProperty( 'chemistry' ) ) {
        if( L_.layersGroup[l] ) {
          L_.layersGroup[l].eachLayer( function( layer ) {
            layer.on( 'click', chemOnClick );
          } );
        }
      }
    }
    */

        function separateFromMMWebGIS() {
            $('#chemistryToolOptions #chemistryToolSingleMode').off(
                'click',
                _ct0
            )
            $('#chemistryToolOptions #chemistryToolMultiMode').off(
                'click',
                _ct1
            )

            for (var l in L_.layersNamed) {
                if (
                    L_.layersNamed[l].hasOwnProperty('variables') &&
                    L_.layersNamed[l].variables.hasOwnProperty('chemistry')
                ) {
                    if (L_.layersGroup[l]) {
                        L_.layersGroup[l].eachLayer(function(layer) {
                            layer.off('click', chemOnClick)
                        })
                    }
                }
            }
        }
    }

    //Other functions
    function chemOnClick(d) {
        var layer
        if (d.hasOwnProperty('target')) {
            layer = d.target
        } else {
            layer = d
        }
        var layerName = layer.options.layerName

        //If point has no chemistry at all
        if (
            !L_.layersNamed[layerName].variables ||
            !L_.layersNamed[layerName].variables.chemistry
        ) {
            d3.select('#chemistry_panel')
                .selectAll('*')
                .remove()
            return
        }

        d3.select('#chemistryToolName').html(
            layer.useKeyAsName && layer.feature.properties[layer.useKeyAsName]
                ? layer.feature.properties[layer.useKeyAsName]
                : 'Chemistry Target'
        )

        let chemData = d.feature.properties._data

        //parse data
        if (
            (chemData && ChemistryTool.chemsNames.indexOf(name) == -1) ||
            !cPSelectorOn
        ) {
            //don't duplicate data if we don't have to
            var chems = new Object()
            var chemI = 0
            for (var i = 0; i < chemData.length; i++) {
                if (cPSelectorOn) {
                    ChemistryTool.chemsArray.push(chemData[i])
                    if (ChemistryTool.chemsNames.indexOf(name) == -1)
                        ChemistryTool.chemsNames.push(name)
                } else {
                    chems[chemI.toString()] = chemData[i]
                    chemI++
                }
            }
            if (cPSelectorOn)
                chemistryplot.make(
                    ChemistryTool.chemsArray,
                    ChemistryTool.chemsNames,
                    0,
                    function() {
                        ChemistryTool.chemsArray = []
                        ChemistryTool.chemsNames = []
                    }
                )
            else
                chemistrychart.make(
                    chems,
                    L_.layersNamed[layerName].variables.chemistry,
                    'chemistry_panel'
                )
        }
    }

    return ChemistryTool
})
