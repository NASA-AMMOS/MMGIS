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
    "<div id='chemistryToolOptions' style='padding-top: 2px; margin-bottom: 8px; display: flex; justify-content: space-between;'>",
      "<p id='chemistryToolName' style='margin: 0; margin-left: 8px; font-size: 20px;'>Place Name</p>",
      "<div id='chemistryToolSingleMulti' class='mmgisRadioBar' style='margin-left: 0;'>",
        "<div id='chemistryToolSingleMode' class='active'>Single</div>",
        "<div id='chemistryToolMultiMode'>Multi</div>",
      "</div>",
    "</div>",
    "<div id='chemistryToolPanel' style='padding-top: 2px; display: flex;'>",
      "<div id='chemistry_panel' style='width: 100%; height: 173px; display: flex; text-shadow: none;'></div>",
    "</div>"
  ].join('\n');

    var ChemistryTool = {
        height: 220,
        width: 1200,
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

        var p = layer.feature.properties
        var name
        var search

        var file = ''
        //find correct file
        if (layerName == 'ChemCam') {
            name = p.TARGET
            var s = p.Sol
            file = 'Missions/' + L_.mission + '/Layers/ChemCam/Chemistry/'
            if (s <= 179) file += 'ccam_MOC_single_shots_0000-0179.csv'
            else if (s <= 269) file += 'ccam_MOC_single_shots_0180-0269.csv'
            else if (s <= 359) file += 'ccam_MOC_single_shots_0270-0359.csv'
            else if (s <= 449) file += 'ccam_MOC_single_shots_0360-0449.csv'
            else if (s <= 583) file += 'ccam_MOC_single_shots_0450-0583.csv'
            else if (s <= 707) file += 'ccam_MOC_single_shots_0584-0707.csv'
            else if (s <= 804) file += 'ccam_MOC_single_shots_0708-0804.csv'
            else if (s <= 938) file += 'ccam_MOC_single_shots_0805-0938.csv'
            else if (s <= 1041) file += 'ccam_MOC_single_shots_0939-1041.csv'
            else if (s <= 1127) file += 'ccam_MOC_single_shots_1042-1127.csv'
            else if (s <= 1319) file += 'ccam_MOC_single_shots_1128-1319.csv'
            else if (s <= 1446) file += 'ccam_MOC_single_shots_1320-1446.csv'
            else if (s <= 1493) file += 'ccam_MOC_single_shots_1447-1493.csv'
            search = 'Target'
        } else if (layerName == 'APXS') {
            name = p.TARGET_NOR
            file =
                'Missions/' +
                L_.mission +
                '/Layers/APXS/Chemistry/MSL_APXS_chemistry_sol1503.csv'
            search = 'Target'
        }

        d3.select('#chemistryToolName').html(name)

        //parse data
        if (ChemistryTool.chemsNames.indexOf(name) == -1 || !cPSelectorOn) {
            //don't duplicate data if we don't have to
            d3.csv(file, function(d) {
                var chems = new Object()
                var chemI = 0
                for (var i = 0; i < d.length; i++) {
                    if (d[i][search] == name) {
                        if (cPSelectorOn) {
                            ChemistryTool.chemsArray.push(d[i])
                            if (ChemistryTool.chemsNames.indexOf(name) == -1)
                                ChemistryTool.chemsNames.push(name)
                        } else {
                            chems[chemI.toString()] = d[i]
                            chemI++
                        }
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
            })
        }
    }

    return ChemistryTool
})
