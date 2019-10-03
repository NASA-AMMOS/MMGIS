define(['jquery', 'd3', 'Layers_', 'semantic'], function($, d3, L_, semantic) {
    ToolController_ = {
        tools: null,
        incToolsDiv: null,
        excToolsDiv: null,
        toolModuleNames: [],
        toolModules: [],
        activeTool: null,
        activeToolName: null,
        prevHeight: 0,
        defaultColor: '#AAA',
        hoverColor: '#FFF',
        activeColor: '#000',
        activeBG: '#fffdf5',
        loaded: false,
        init: function(tools) {
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

            for (var i = 0; i < tools.length; i++) {
                this.toolModuleNames.push(tools[i].js)

                this.incToolsDiv
                    .append('div')
                    .style('transition', 'all 0.25s ease-in')
                    .style('width', '36px')
                    .style('height', '30px')
                    .style('display', 'inline-block')
                    .style('text-align', 'center')
                    .style('line-height', '30px')
                    .style('border-radius', '1px')
                    //.style( 'text-shadow', '0px 1px #111' )
                    .style('vertical-align', 'middle')
                    .append('i')
                    .style('transition', 'all 0.2s ease-in')
                    .attr('id', tools[i].name + 'Tool')
                    .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                    .attr('title', tools[i].name)
                    .style('color', ToolController_.defaultColor)
                    .style('cursor', 'pointer')
                    .on(
                        'click',
                        (function(i) {
                            return function() {
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
                                prevActive.parent().css({ background: 'none' })
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
                                    ToolController_.toolModuleNames[i]
                                )
                            }
                        })(i)
                    )
                    .on('mouseover', function() {
                        if (!$(this).hasClass('active')) {
                            $(this).css({ color: ToolController_.hoverColor })
                        }
                    })
                    .on('mouseleave', function() {
                        if (!$(this).hasClass('active')) {
                            $(this).css({ color: ToolController_.defaultColor })
                        }
                    })
            }
            //Only require the tools we need
            require(this.toolModuleNames, function() {
                ToolController_.toolModules = arguments
                ToolController_.incToolsDiv
                    .style('pointer-events', 'auto')
                    .style('opacity', '1')

                for (var i = 0; i < ToolController_.toolModules.length; i++) {
                    if (
                        typeof ToolController_.toolModules[i].initialize ===
                        'function'
                    )
                        ToolController_.toolModules[i].initialize()
                }

                ToolController_.loaded = true
                L_.toolsLoaded = true

                //Fully loaded
                $('.LoadingPage').animate(
                    {
                        opacity: 0,
                    },
                    1000,
                    function() {
                        $('.LoadingPage').remove()
                    }
                )
            })
        },
        clear() {
            d3.select('#toolbarTools').remove()
            this.tools = null
            this.incToolsDiv = null
            this.excToolsDiv = null
            this.toolModuleNames = []
            this.toolModules = []
        },
        getTool: function(name) {
            var tool = this.toolModules[this.toolModuleNames.indexOf(name)]
            return tool || { use: function() {} }
        },
        makeTool: function(name) {
            var tool = this.getTool(name)
            if (tool != undefined) {
                if (
                    this.activeToolName == null ||
                    name != this.activeToolName
                ) {
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
                            this.UserInterface.openToolPanel(
                                this.activeTool.width
                            )
                        } else {
                            this.UserInterface.closeToolPanel()
                        }
                        /*
              if( this.prevHeight != this.activeTool.height && this.UserInterface != null ) {
                this.UserInterface.setToolHeight( this.activeTool.height );
              }
              this.prevHeight = this.activeTool.height;
              */

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
                    //close tool
                    this.closeActiveTool()
                }
            }
        },
        setToolHeight: function(newHeight) {
            if (this.prevHeight != newHeight && this.UserInterface != null) {
                this.UserInterface.setToolHeight(newHeight)
            }
            this.prevHeight = newHeight
        },
        setToolWidth: function(newWidth) {
            newWidth = newWidth || 'full'
            this.UserInterface.setToolWidth(newWidth)
        },
        closeActiveTool: function() {
            var prevActive = $('#toolcontroller_incdiv .active')
            prevActive.removeClass('active').css({
                color: ToolController_.defaultColor,
                background: 'none',
            })
            prevActive.parent().css({ background: 'none' })

            if (this.activeTool != null) {
                this.activeTool.destroy()
                d3.select('#tools')
                    .selectAll('*')
                    .remove()
                this.UserInterface.closeToolPanel()
            }
            this.activeTool = null
            this.activeToolName = null
            if (this.prevHeight != 0 && this.UserInterface != null) {
                this.UserInterface.setToolHeight(0)
            }
            this.prevHeight = 0
        },
        getToolsUrl: function() {
            var toolsUrl = ''
            for (var i = 0; i < this.toolModuleNames.length; i++) {
                var tool = this.toolModules[i]
                if (tool && typeof tool.getUrlString === 'function') {
                    var urlString = tool.getUrlString()
                    if (urlString.length > 0)
                        toolsUrl +=
                            this.toolModuleNames[i] + '$' + urlString + ','
                }
            }
            //get rid of last , if there is one
            if (toolsUrl[toolsUrl.length - 1] == ',')
                toolsUrl = toolsUrl.substr(0, toolsUrl.length - 1)

            if (toolsUrl.length == 0) toolsUrl = false
            return toolsUrl
        },
        fina: function(userinterface) {
            this.UserInterface = userinterface
        },
    }

    return ToolController_
})
