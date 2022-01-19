// ! OUTDATED
// ! Just copy from existing tools

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
], function ($, d3, F_, L_, Globe_, Map_, Viewer_) {
    //Add the tool markup if you want to do it this way
    // prettier-ignore
    var markup = [].join('\n');

    var NewToolTemplate = {
        height: 48,
        width: 200,
        MMGISInterface: null,
        make: function () {
            this.MMGISInterface = new interfaceWithMMGIS()
        },
        destroy: function () {
            this.MMGISInterface.separateFromMMGIS()
        },
        getUrlString: function () {
            return ''
        },
    }

    //
    function interfaceWithMMGIS() {
        this.separateFromMMGIS = function () {
            separateFromMMGIS()
        }

        //MMGIS should always have a div with id 'tools'
        var tools = d3.select('#tools')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('class', 'center aligned ui padded grid')
            .style('height', '100%')
        //Add the markup to tools or do it manually
        //tools.html( markup );

        //Add event functions and whatnot

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMGIS() {}
    }

    //Other functions

    return NewToolTemplate
})
