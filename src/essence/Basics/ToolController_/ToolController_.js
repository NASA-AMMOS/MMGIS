import $ from 'jquery'
import L_ from '../Layers_/Layers_'
import TimeUI from '../TimeControl_/TimeUI'
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

        var mainDiv = $('<div>')
            .attr('id', 'toolbarTools')
            .css('height', '100%')
        $('#toolbar').append(mainDiv)

        this.incToolsDiv = $('<div>')
            .attr('id', 'toolcontroller_incdiv')
            .attr('class', 'sixteen wide column')
            .css({
                'transition': 'all 0.25s ease-in',
                'pointer-events': 'none',
                'opacity': '0',
                'padding-bottom': '8px'
            })
        mainDiv.append(this.incToolsDiv)

        // Create three separate containers for left, center, and right justified tools
        this.separatedDivLeft = $('<div>')
            .attr('id', 'toolcontroller_sepdiv_left')
            .css({
                'position': 'absolute',
                'top': '40px',
                'left': '5px',
                'z-index': '1004'
            })
        $('#splitscreens').append(this.separatedDivLeft)

        this.separatedDiv = $('<div>')
            .attr('id', 'toolcontroller_sepdiv')
            .css({
                'position': 'absolute',
                'top': '40px',
                'left': '5px',
                'z-index': '1004'
            })
        $('#splitscreens').append(this.separatedDiv)

        // Adjust right position if zoom controls are enabled
        const rightPosition =
            L_.configData.look && L_.configData.look.zoomcontrol
                ? '40px'
                : '5px'

        this.separatedDivRight = $('<div>')
            .attr('id', 'toolcontroller_sepdiv_right')
            .css({
                'position': 'absolute',
                'top': '40px',
                'right': rightPosition,
                'z-index': '1004'
            })
        $('#splitscreens').append(this.separatedDivRight)

        // Helper function to create a separated tool
        const createSeparatedTool = (i) => {
            $('#viewerToolBar').css('padding-left', '36px')

            // Determine which container to use based on justification
            let targetDiv = this.separatedDiv // default to center/left
            const justification = tools[i].variables?.justification
            if (justification === 'left') {
                targetDiv = this.separatedDivLeft
            } else if (justification === 'right') {
                targetDiv = this.separatedDivRight
            }

            let sep = $('<div>')
                .attr('id', `toolSeparated_${tools[i].name}`)
                .css({
                    'position': 'relative',
                    'border-radius': '3px',
                    'background': 'var(--color-a)',
                    'margin-bottom': '5px'
                })
            targetDiv.append(sep)

            const toolContent = $('<div>')
                .attr('id', `toolContentSeparated_${tools[i].name}`)
                .css({
                    'position': 'absolute',
                    'top': '0px',
                    'left': '0px',
                    'border-radius': '3px',
                    'background': 'var(--color-a)',
                    'transform': justification === 'right'
                        ? 'translateX(calc(-100% + 30px))'
                        : 'unset'
                })
            sep.append(toolContent)

            const toolButton = $('<div>')
                .attr('id', `toolButtonSeparated_${tools[i].name}`)
                .attr('class', 'toolButtonSep')
                .attr('tabindex', i + 1)
                .css({
                    'position': 'relative',
                    'width': '30px',
                    'height': '30px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '30px',
                    //'text-shadow': '0px 1px #111',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease-in',
                    'color': ToolController_.defaultColor
                })
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
                                        ToolController_.tools[i].name + 'Tool'
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
                                                ToolController_.tools[i].name +
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
            sep.append(toolButton)

            const sepIcon = $('<i>')
                .attr('id', tools[i].name + 'Tool')
                .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                .css('cursor', 'pointer')
            toolButton.append(sepIcon)
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
                const toolButton = $('<div>')
                    .attr('id', `toolButton${tools[i].name}`)
                    .attr('class', 'toolButton')
                    .css(
                        'width',
                        L_.UserInterface_.isMobile === true ? '36px' : '100%'
                    )
                    .css(
                        'height',
                        L_.UserInterface_.isMobile === true ? '100%' : '36px'
                    )
                    .css('display', 'inline-block')
                    .css('text-align', 'center')
                    .css('line-height', '36px')
                    .css(
                        'border-top',
                        i === 0 ? '1px solid var(--color-a-5)' : 'none'
                    )
                    .css('border-bottom', '1px solid var(--color-a-5)')
                    //.css( 'text-shadow', '0px 1px #111' )
                    .css('vertical-align', 'middle')
                    .css('cursor', 'pointer')
                    .attr('tabindex', i + 1)
                    .css('transition', 'all 0.2s ease-in')
                    .css('color', ToolController_.defaultColor)
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
                this.incToolsDiv.append(toolButton)

                const toolIcon = $('<i>')
                    .attr('id', tools[i].name + 'Tool')
                    .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                    .css('cursor', 'pointer')
                toolButton.append(toolIcon)

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

        // FIXME For now, remove the time button in the toolbar
        // Add the time UI button if time is enabled and in mobile mode
        if (
            L_.UserInterface_?.isMobile === true &&
            L_.configData.time &&
            L_.configData.time.enabled === true
        ) {
            let timeSelect = $('<div>')
                .attr('id', 'toggleTimeUI')
                .css({
                    'position': 'relative',
                    'width': '30px',
                    'height': '30px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '30px',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease-in',
                    'color': ToolController_.defaultColor
                })
                .on(
                    'click',
                    (function () {
                        return function () {
                            var hasActive = false
                            if ($(this).hasClass('active')) {
                                hasActive = true
                            }
                            var prevActive = $('#toolcontroller_incdiv .active')
                            prevActive.removeClass('active').css({
                                color: ToolController_.defaultColor,
                                background: 'none',
                            })
                            prevActive.parent().css({
                                background: 'none',
                            })
                            if (!hasActive) {
                                var newActive = $(
                                    '#toolcontroller_incdiv #toggleTimeUI'
                                )
                                newActive.addClass('active').css({
                                    color: ToolController_.activeColor,
                                })

                                TimeUI.initialize()
                                ToolController_.setToolHeight(TimeUI.height)
                                ToolController_.setToolWidth()
                                TimeUI.make()
                                TimeUI.toggleExpanded()
                                TimeUI.fina()
                            } else {
                                ToolController_.setToolHeight(0)
                                ToolController_.setToolWidth()
                                TimeUI.destroy()
                                ToolController_.closeActiveTool()
                            }

                            $('#topBar').css({
                                'padding-left': '40px',
                                'margin-left': '0px',
                                width: '100%',
                            })
                        }
                    })()
                )
            $('#toolcontroller_incdiv').append(timeSelect)

            timeSelect
                .append($('<i>')
                    .attr('class', 'mdi mdi-clock mdi-18px')
                    .css('cursor', 'pointer')
                )
        }

        if (
            L_.UserInterface_?.isMobile === true &&
            (L_.configData.coordinates.coordll == true ||
                L_.configData.coordinates.coorden == true)
        ) {
            let coordSelect = $('<div>')
                .attr('id', 'coordinatesDiv')
                .css({
                    'position': 'relative',
                    'width': '30px',
                    'height': '30px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '30px',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease-in',
                    'color': ToolController_.defaultColor
                })
                .on(
                    'click',
                    (function () {
                        return function () {
                            var hasActive = false
                            if ($(this).hasClass('active')) {
                                hasActive = true
                            }
                            var prevActive = $('#toolcontroller_incdiv .active')
                            prevActive.removeClass('active').css({
                                color: ToolController_.defaultColor,
                                background: 'none',
                            })
                            prevActive.parent().css({
                                background: 'none',
                            })
                            if (!hasActive) {
                                var newActive = $(
                                    '#toolcontroller_incdiv #coordinatesDiv'
                                )
                                newActive.addClass('active').css({
                                    color: ToolController_.activeColor,
                                })

                                L_.Coordinates.initialize()
                                L_.Coordinates.init()
                                ToolController_.setToolHeight(
                                    L_.Coordinates.height
                                )
                                ToolController_.setToolWidth()
                                L_.Coordinates.make()
                            } else {
                                ToolController_.setToolHeight(0)
                                ToolController_.setToolWidth()
                                L_.Coordinates.destroy()
                                ToolController_.closeActiveTool()
                            }

                            $('#topBar').css({
                                'padding-left': '40px',
                                'margin-left': '0px',
                                width: '100%',
                            })
                        }
                    })()
                )
            $('#toolcontroller_incdiv').append(coordSelect)

            coordSelect
                .append($('<i>')
                    .attr('class', 'mdi mdi-target mdi-18px')
                    .css('cursor', 'pointer')
                )
        }

        ToolController_.incToolsDiv
            .css('pointer-events', 'auto')
            .css('opacity', '1')

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
        $('#toolbarTools').remove()
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
            $('#tools').empty()
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
