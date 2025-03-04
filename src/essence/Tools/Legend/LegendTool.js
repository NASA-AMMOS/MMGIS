import $ from 'jquery'
import * as d3 from 'd3'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'

//Add the tool markup if you want to do it this way
var markup = [].join('\n')

var LegendTool = {
    height: 0,
    width: 200,
    activeLayerNames: null,
    MMWebGISInterface: null,
    targetId: null,
    made: false,
    displayOnStart: false,
    justification: 'left',
    initialize: function () {
        //Get tool variables
        this.displayOnStart = L_.getToolVars('legend')['displayOnStart']
        this.justification = L_.getToolVars('legend')['justification']
        if (this.justification == 'right') {
            const toolController = d3.select('#toolcontroller_sepdiv')
            const toolContent = d3.select('#toolContentSeparated_Legend')
            toolController.style('top', '110px')
            toolController.style('left', null)
            toolController.style('right', '5px')
            toolContent.style('left', null)
            toolContent.style('right', '0px')
        } else {
            const toolController = d3
                .select('#toolcontroller_sepdiv')
                .clone(false)
                .attr('id', 'toolcontroller_sepdiv_left')
            $('#toolSeparated_Legend').appendTo('#toolcontroller_sepdiv_left')
            toolController.style(
                'top',
                (L_.getToolVars('identifier')['justification'] || 'left') ==
                    'left'
                    ? '75px'
                    : '40px'
            )
            toolController.style('left', '5px')
            toolController.style('right', null)
        }
    },
    make: function (targetId) {
        this.targetId =
            typeof targetId === 'string'
                ? targetId
                : '__LegendTool_missing_targetId'
        this.MMWebGISInterface = new interfaceWithMMWebGIS()
        this.activeLayerNames = []

        L_.subscribeOnLayerToggle('LegendTool', () => {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()
        })

        this.made = true
    },
    destroy: function () {
        this.MMWebGISInterface.separateFromMMWebGIS()
        this.targetId = null
        L_.unsubscribeOnLayerToggle('LegendTool')
        this.made = false
    },
    refreshLegends: refreshLegends,
    overwriteLegends: overwriteLegends,
}

//
function interfaceWithMMWebGIS() {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }
    separateFromMMWebGIS()

    LegendTool.tools = drawLegendHeader()

    //Add the markup to tools or do it manually
    //tools.html( markup );

    //Add event functions and whatnot
    //Draw legends
    LegendTool.refreshLegends()
    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMWebGIS() {
        let tools = d3.select(
            LegendTool.targetId ? `#${LegendTool.targetId}` : '#toolPanel'
        )
        tools.style('background', 'var(--color-k)')
        //Clear it
        tools.selectAll('*').remove()
    }
}

function refreshLegends() {
    $('#LegendTool').empty()

    for (let l in L_.layers.on) {
        if (L_.layers.on[l] == true) {
            if (L_.layers.data[l].type != 'header') {
                if (L_.layers.data[l]?._legend === undefined
                        && ((['image', 'tile'].includes(L_.layers.data[l].type) && L_.layers.data[l].cogTransform)
                        || L_.layers.data[l].type === 'velocity')) {
                    const layersTool = ToolController_.getTool('LayersTool')
                    layersTool.populateCogScale(L_.layers.data[l].name)
                }

                if (L_.layers.data[l]?._legend != undefined) {
                    drawLegends(
                        LegendTool.tools,
                        L_.layers.data[l]?._legend,
                        l,
                        L_.layers.data[l].display_name,
                        L_.layers.opacity[l]
                    )
                }
            }
        }
    }
}

// The legends parameter should be an array of objects, where each object must contain
// the following keys: legend, layerUUID, display_name, opacity.
// The value for the legend key should be in the same format as what is stored in the
// layers data under the `_legend` key (i.e. `L_.layers.data[layerName]._legend`).
// layerUUID and display_name should be strings and opacity should be a number between 0 and 1.
function overwriteLegends(legends) {
    if (!Array.isArray(legends)) {
        console.warn('legends parameter must be an array.', legends)
        return
    }

    if (legends.length < 1) {
        console.warn('legends array is empty.', legends)
        return
    }

    var tools = drawLegendHeader()

    for (let l in legends) {
        const { legend, layerUUID, display_name, opacity } = legends[l]
        if (!legend || !layerUUID || !display_name || !opacity) {
            console.warn('Unable to overwrite legends in LegendTool.', legends)
            return
        }
        drawLegends(tools, legend, layerUUID, display_name, opacity)
    }
}

function drawLegendHeader() {
    //MMWebGIS should always have a div with id 'tools'
    let tools = d3.select(
        LegendTool.targetId ? `#${LegendTool.targetId}` : '#toolPanel'
    )
    tools.style('background', 'var(--color-k)')
    //Clear it
    tools.selectAll('*').remove()
    tools
        .append('div')
        .style('height', '30px')
        .style('line-height', '30px')
        .style('font-size', '13px')
        .style(
            'padding-right',
            LegendTool.justification === 'right' ? '30px' : '8px'
        )
        .style(
            'padding-left',
            LegendTool.justification === 'right' ? '10px' : '30px'
        )
        .style('color', 'var(--color-l)')
        .style('background', 'var(--color-i)')
        .style('font-family', 'lato-light')
        .style('text-transform', 'uppercase')
        .style('border-top-left-radius', '3px')
        .style('border-top-right-radius', '3px')
        .style('border-bottom', '1px solid var(--color-i)')
        .html('Legend')
    //Add a semantic container
    tools = tools
        .append('div')
        .attr('id', 'LegendTool')
        .style('color', '#dcdcdc')
        .style('height', 'calc(100% - 40px)')
        .style('max-height', 'calc(100vh - 185px)')
        .style('border-bottom-left-radius', '3px')
        .style('border-bottom-right-radius', '3px')
        .style('overflow-y', 'auto')

    return tools
}

function drawLegends(tools, _legend, layerUUID, display_name, opacity) {
    if (tools == null) return
    var c = tools
        .append('div')
        .attr('class', 'mmgisScrollbar')
        .style('width', '100%')
        .style('display', 'inline-block')
        .style('padding-top', '5px')
        .style('padding-right', '12px')
        .style('border-bottom', '1px solid var(--color-i)')

    c.append('div')
        .attr('class', 'row')
        .append('p')
        .style('font-size', '13px')
        .style('color', 'var(--color-f)')
        .style('margin-bottom', '5px')
        .style('padding-left', '8px')
        .text(display_name)

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
                .style('margin', '0px 0px 8px 9px')

            switch (shape) {
                case 'circle':
                    r.append('div')
                        .attr('class', layerUUID + '_legendshape')
                        .style('width', '18px')
                        .style('height', '18px')
                        .style('background', _legend[d].color)
                        .style('opacity', opacity)
                        .style('border', `1px solid ${_legend[d].strokecolor}`)
                        .style('border-radius', '50%')
                    break
                case 'square':
                    r.append('div')
                        .attr('class', layerUUID + '_legendshape')
                        .style('width', '18px')
                        .style('height', '18px')
                        .style('background', _legend[d].color)
                        .style('opacity', opacity)
                        .style('border', `1px solid ${_legend[d].strokecolor}`)
                    break
                case 'rect':
                    r.append('div')
                        .attr('class', layerUUID + '_legendshape')
                        .style('width', '18px')
                        .style('height', '8px')
                        .style('margin', '5px 0px 5px 0px')
                        .style('background', _legend[d].color)
                        .style('opacity', opacity)
                        .style('border', `1px solid ${_legend[d].strokecolor}`)
                    break
                default:
            }

            r.append('div')
                .style('margin-left', '5px')
                .style('height', '100%')
                .style('line-height', '19px')
                .style('font-size', '14px')
                .style('overflow', 'hidden')
                .style('white-space', 'nowrap')
                .style('max-width', '270px')
                .style('text-overflow', 'ellipsis')
                .attr('title', _legend[d].value)
                .text(_legend[d].value)
        } else if (shape == 'continuous' || shape == 'discreet') {
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
            .style('margin', '0px 0px 8px 8px')
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
                .style('white-space', 'nowrap')
                .text(lastContinues[i].value)

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
