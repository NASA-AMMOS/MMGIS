import $ from 'jquery'
import * as d3 from 'd3'
import L_ from '../Layers_/Layers_'
import TimeUI from '../../Ancillary/TimeUI'
import { toolModules, toolConfigs } from '../../../pre/tools'

import tippy from 'tippy.js'

let ToolController_ = {
    tools: null,
    incToolsDiv: null,
    excToolsDiv: null,
    separatedDiv: null,
    separatedDivLeft: null,
    separatedDivRight: null,
    activeSeparatedTools: [],
    toolModuleNames: [],
    toolModules: toolModules,
    activeTool: null,
    activeToolName: null,
    prevHeight: 0,
    defaultColor: 'var(--color-f)',
    hoverColor: 'var(--color-mmgis)',
    activeColor: 'var(--color-mmgis)',
    activeBG: 'var(--color-i)',
    loaded: false,
    init: function (tools) {
        this.tools = tools

        var mainDiv = d3
            .select('#toolbar')
            .append('div')
            .attr('id', 'toolbarTools')
            .style('height', '100%')
        this.incToolsDiv = mainDiv
            .append('div')
            .attr('id', 'toolcontroller_incdiv')
            .attr('class', 'sixteen wide column')
            .style('transition', 'all 0.25s ease-in')
            .style('pointer-events', 'none')
            .style('opacity', '0')
            .style('padding-bottom', '8px')

        // Create three separate containers for left, center, and right justified tools
        this.separatedDivLeft = d3
            .select('#splitscreens')
            .append('div')
            .attr('id', 'toolcontroller_sepdiv_left')
            .style('position', 'absolute')
            .style('top', '40px')
            .style('left', '5px')
            .style('z-index', '1004')

        this.separatedDiv = d3
            .select('#splitscreens')
            .append('div')
            .attr('id', 'toolcontroller_sepdiv')
            .style('position', 'absolute')
            .style('top', '40px')
            .style('left', '5px')
            .style('z-index', '1004')

        // Adjust right position if zoom controls are enabled
        const rightPosition = (L_.configData.look && L_.configData.look.zoomcontrol) ? '40px' : '5px'

        this.separatedDivRight = d3
            .select('#splitscreens')
            .append('div')
            .attr('id', 'toolcontroller_sepdiv_right')
            .style('position', 'absolute')
            .style('top', '40px')
            .style('right', rightPosition)
            .style('z-index', '1004')

        // Helper function to create a separated tool
        const createSeparatedTool = (i) => {
            d3.select('#viewerToolBar').style('padding-left', '36px')

            // Determine which container to use based on justification
            let targetDiv = this.separatedDiv // default to center/left
            const justification = tools[i].variables?.justification
            if (justification === 'left') {
                targetDiv = this.separatedDivLeft
            } else if (justification === 'right') {
                targetDiv = this.separatedDivRight
            }

            let sep = targetDiv
                .append('div')
                .attr('id', `toolSeparated_${tools[i].name}`)
                .style('position', 'relative')
                .style('border-radius', '3px')
                .style('background', 'var(--color-a)')
                .style('margin-bottom', '5px')

            sep.append('div')
                .attr('id', `toolContentSeparated_${tools[i].name}`)
                .style('position', 'absolute')
                .style('top', '0px')
                .style('left', '0px')
                .style('border-radius', '3px')
                .style('background', 'var(--color-a)')

            sep.append('div')
                .attr('id', `toolButtonSeparated_${tools[i].name}`)
                .attr('class', 'toolButtonSep')
                .style('position', 'relative')
                .style('width', '30px')
                .style('height', '30px')
                .style('display', 'inline-block')
                .style('text-align', 'center')
                .style('line-height', '30px')
                //.style( 'text-shadow', '0px 1px #111' )
                .style('vertical-align', 'middle')
                .style('cursor', 'pointer')
                .attr('tabindex', i + 1)
                .style('transition', 'all 0.2s ease-in')
                .style('color', ToolController_.defaultColor)
                .on(
                    'click',
                    (function (i) {
                        return function () {
                            const tM =
                                ToolController_.toolModules[
                                    `${ToolController_.tools[i].name}Tool`
                                ]
                            if (tM) {
                                if (tM.made === false) {
                                    tM.make(
                                        `toolContentSeparated_${ToolController_.tools[i].name}`
                                    )
                                    ToolController_.activeSeparatedTools.push(
                                        ToolController_.tools[i].name +
                                            'Tool'
                                    )
                                    $(
                                        `#toolButtonSeparated_${tools[i].name}`
                                    ).addClass('active')
                                } else {
                                    tM.destroy()
                                    ToolController_.activeSeparatedTools =
                                        ToolController_.activeSeparatedTools.filter(
                                            (a) =>
                                                a !=
                                                ToolController_.tools[i]
                                                    .name +
                                                    'Tool'
                                        )

                                    $(
                                        `#toolButtonSeparated_${tools[i].name}`
                                    ).removeClass('active')
                                }

                                // Dispatch `toggleSeparatedTool` event
                                let _event = new CustomEvent(
                                    'toggleSeparatedTool',
                                    {
                                        detail: {
                                            toggledToolName:
                                                ToolController_.tools[i].js,
                                            visible: tM.made,
                                        },
                                    }
                                )
                                document.dispatchEvent(_event)
                            }
                        }
                    })(i)
                )
                .append('i')
                .attr('id', tools[i].name + 'Tool')
                .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                .style('cursor', 'pointer')
        }

        let legendToolIndex = -1

        for (let i = 0; i < tools.length; i++) {
            this.toolModuleNames.push(tools[i].js)

            if (tools[i].separatedTool && L_.UserInterface_.isMobile !== true) {
                // Legend tool should always be last in its container
                if (tools[i].name === 'Legend') {
                    legendToolIndex = i
                    continue
                }
                createSeparatedTool(i)
            } else {
                this.incToolsDiv
                    .append('div')
                    .attr('id', `toolButton${tools[i].name}`)
                    .attr('class', 'toolButton')
                    .style('width', L_.UserInterface_.isMobile === true ? '36px' : '100%')
                    .style('height', L_.UserInterface_.isMobile === true ? '100%': '36px')
                    .style('display', 'inline-block')
                    .style('text-align', 'center')
                    .style('line-height', '36px')
                    .style(
                        'border-top',
                        i === 0 ? '1px solid var(--color-a-5)' : 'none'
                    )
                    .style('border-bottom', '1px solid var(--color-a-5)')
                    //.style( 'text-shadow', '0px 1px #111' )
                    .style('vertical-align', 'middle')
                    .style('cursor', 'pointer')
                    .attr('tabindex', i + 1)
                    .style('transition', 'all 0.2s ease-in')
                    .style('color', ToolController_.defaultColor)
                    .on(
                        'click',
                        (function (i) {
                            return function () {
                                var hasActive = false
                                if ($(this).hasClass('active')) {
                                    hasActive = true
                                }
                                var prevActive = $(
                                    '#toolcontroller_incdiv .active'
                                )
                                prevActive.removeClass('active').css({
                                    color: ToolController_.defaultColor,
                                    background: 'none',
                                })
                                prevActive.parent().css({
                                    background: 'none',
                                })
                                if (!hasActive) {
                                    var newActive = $(
                                        '#toolcontroller_incdiv #' +
                                            ToolController_.tools[i].name +
                                            'Tool'
                                    )
                                    newActive.addClass('active').css({
                                        color: ToolController_.activeColor,
                                    })
                                    newActive.parent().css({
                                        background: ToolController_.activeBG,
                                    })
                                }

                                ToolController_.makeTool(
                                    ToolController_.toolModuleNames[i],
                                    i
                                )

                                // Dispatch `toolChange` event
                                let _event = new CustomEvent('toolChange', {
                                    detail: {
                                        activeTool: ToolController_.activeTool,
                                        activeToolName:
                                            ToolController_.activeToolName,
                                    },
                                })
                                document.dispatchEvent(_event)
                            }
                        })(i)
                    )
                    .on('mouseover', function () {
                        if (!$(this).hasClass('active')) {
                            $(this).css({ color: ToolController_.hoverColor })
                        }
                    })
                    .on('mouseleave', function () {
                        if (!$(this).hasClass('active')) {
                            $(this).css({ color: ToolController_.defaultColor })
                        }
                    })
                    .append('i')
                    .attr('id', tools[i].name + 'Tool')
                    .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                    .style('cursor', 'pointer')

                if (!L_.UserInterface_.isMobile) {
                    // Only show tooltip if not in mobile mode
                    tippy(`#toolButton${tools[i].name}`, {
                        content: tools[i].name,
                        placement: 'right',
                        theme: 'blue',
                    })
                }
            }
        }

        // Add Legend tool last if it exists
        if (legendToolIndex >= 0) {
            createSeparatedTool(legendToolIndex)
        }

        // Add the time UI button if time is enabled and in mobile mode
        if (L_.UserInterface_?.isMobile === true && L_.configData.time && L_.configData.time.enabled === true) {
            let timeSelect = d3.select('#toolcontroller_incdiv')
                .append('div')
                .attr('id', 'toggleTimeUI')
                .style('position', 'relative')
                .style('width', '30px')
                .style('height', '30px')
                .style('display', 'inline-block')
                .style('text-align', 'center')
                .style('line-height', '30px')
                .style('vertical-align', 'middle')
                .style('cursor', 'pointer')
                .style('transition', 'all 0.2s ease-in')
                .style('color', ToolController_.defaultColor)
                .on(
                    'click',
                    (function () {
                        return function () {
                            var hasActive = false
                            if ($(this).hasClass('active')) {
                                hasActive = true
                            }
                            var prevActive = $(
                                '#toolcontroller_incdiv .active'
                            )
                            prevActive.removeClass('active').css({
                                color: ToolController_.defaultColor,
                                background: 'none',
                            })
                            prevActive.parent().css({
                                background: 'none',
                            })
                            if (!hasActive) {
                                var newActive = $('#toolcontroller_incdiv #toggleTimeUI')
                                newActive.addClass('active').css({
                                    color: ToolController_.activeColor,
                                })
                                newActive.parent().css({
                                    background: ToolController_.activeBG,
                                })

                                TimeUI.initialize()
                                ToolController_.setToolHeight(TimeUI.height)
                                ToolController_.setToolWidth()
                                TimeUI.make()
                            } else {
                                ToolController_.setToolHeight(0)
                                ToolController_.setToolWidth()
                                TimeUI.destroy()
                            }
                        }
                    })()
                )

            timeSelect.append('i')
                .attr('class', 'mdi mdi-clock mdi-18px')
                .style('cursor', 'pointer')
        }

        ToolController_.incToolsDiv
            .style('pointer-events', 'auto')
            .style('opacity', '1')

        ToolController_.toolModuleNames.forEach((t) => {
            if (
                ToolController_.toolModules[t] &&
                typeof ToolController_.toolModules[t].initialize === 'function'
            )
                ToolController_.toolModules[t].initialize()
        })

        ToolController_.loaded = true
        L_.toolsLoaded = true

        L_.fullyLoaded()
    },
    clear() {
        d3.select('#toolbarTools').remove()
        this.tools = null
        this.incToolsDiv = null
        this.excToolsDiv = null
        this.toolModuleNames = []
        this.toolModules = []
    },
    getTool: function (name) {
        var tool = this.toolModules[name]
        return tool || { use: function () {} }
    },
    makeTool: function (name, idx) {
        var tool = this.getTool(name)

        if (tool != undefined) {
            if (this.activeToolName == null || name != this.activeToolName) {
                //change tool
                if (
                    typeof tool.make === 'function' &&
                    typeof tool.destroy === 'function'
                ) {
                    if (this.activeTool != null) {
                        this.activeTool.destroy()
                    }

                    this.activeTool = tool
                    this.setToolHeight(this.activeTool.height)
                    this.setToolWidth(this.activeTool.width)
                    if (this.activeTool.height == 0) {
                        this.UserInterface.openToolPanel(this.activeTool.width)
                    } else {
                        this.UserInterface.closeToolPanel()
                    }
                    /*
                    if( this.prevHeight != this.activeTool.height && this.UserInterface != null ) {
                        this.UserInterface.setToolHeight( this.activeTool.height );
                    }
                    this.prevHeight = this.activeTool.height;
                    */
                    // Toggle drag handle
                    $('#toolPanelDrag').css(
                        'display',
                        toolConfigs[ToolController_.tools[idx].name]
                            ?.expandable === true
                            ? 'block'
                            : 'none'
                    )

                    this.activeTool.make(this)
                } else {
                    console.warn(
                        'WARNING: ' +
                            name +
                            ' does not have a make or destroy function.' +
                            " All tools require a 'make' and a 'destroy' function."
                    )
                }
                this.activeToolName = name
            } else {
                // Toggle drag handle
                $('#toolPanelDrag').css('display', 'none')
                //close tool
                this.closeActiveTool()
            }
        }
    },
    setToolHeight: function (newHeight) {
        if (this.prevHeight != newHeight && this.UserInterface != null) {
            this.UserInterface.setToolHeight(newHeight)
        }
        this.prevHeight = newHeight
    },
    setToolWidth: function (newWidth) {
        newWidth = newWidth || 'full'
        this.UserInterface.setToolWidth(newWidth)
    },
    notifyActiveTool: function (type, payload) {
        if (this.activeTool != null) {
            if (typeof this.activeTool.notify === 'function')
                this.activeTool.notify(type, payload)
        }
    },
    closeActiveTool: function () {
        var prevActive = $('#toolcontroller_incdiv .active')
        prevActive.removeClass('active').css({
            color: ToolController_.defaultColor,
            background: 'none',
        })
        prevActive.parent().css({ background: 'none' })

        if (this.activeTool != null) {
            this.activeTool.destroy()
            d3.select('#tools').selectAll('*').remove()
            this.UserInterface.closeToolPanel()
        }
        this.activeTool = null
        this.activeToolName = null
        if (this.prevHeight != 0 && this.UserInterface != null) {
            this.UserInterface.setToolHeight(0)
        }
        this.prevHeight = 0
    },
    getToolsUrl: function () {
        var toolsUrl = ''
        for (var i = 0; i < this.toolModuleNames.length; i++) {
            var tool = this.toolModules[this.toolModuleNames[i]]
            if (tool && typeof tool.getUrlString === 'function') {
                var urlString = tool.getUrlString()
                if (urlString.length > 0)
                    toolsUrl += this.toolModuleNames[i] + '$' + urlString + ','
            }
        }
        //get rid of last , if there is one
        if (toolsUrl[toolsUrl.length - 1] == ',')
            toolsUrl = toolsUrl.substr(0, toolsUrl.length - 1)

        if (toolsUrl.length == 0) toolsUrl = false
        return toolsUrl
    },
    fina: function (userinterface) {
        this.UserInterface = userinterface
    },
    finalizeTools: function () {
        for (let i = 0; i < this.toolModuleNames.length; i++) {
            const tool = this.toolModules[this.toolModuleNames[i]]
            if (tool && typeof tool.finalize === 'function') {
                tool.finalize()
            }
        }
    },
}

window.ToolController_ = ToolController_
export default ToolController_
