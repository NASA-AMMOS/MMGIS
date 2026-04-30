import $ from 'jquery'
import tippy from 'tippy.js'
import L_ from '../Layers_/Layers_'
import { toolModules, toolConfigs } from '../../../pre/tools'
import useUIStore from '../UserInterface_/store/uiStore'

let ToolController_ = {
    tools: null,
    separatedContentDiv: null,
    activeSeparatedTools: [],
    toolModuleNames: [],
    toolModules: toolModules,
    activeTool: null,
    activeToolName: null,
    _pendingCloseTool: null,
    prevHeight: 0,
    defaultColor: 'var(--color-f)',
    hoverColor: 'var(--color-mmgis)',
    activeColor: 'var(--color-mmgis)',
    activeBG: 'var(--color-i)',
    loaded: false,

    // init: Build the tool module name list and initialize all tool modules.
    // DOM construction for toolbar buttons is handled by Toolbar.jsx.
    // Separated tools (Legend, Identifier) are constructed here via jQuery
    // with floating glassmorphism panels over the map (matches PR #47).
    init: function (tools) {
        this.tools = tools

        // Build toolModuleNames array (used by makeTool, getToolsUrl, etc.)
        for (let i = 0; i < tools.length; i++) {
            this.toolModuleNames.push(tools[i].js)
        }

        // Initialize all tool modules
        ToolController_.toolModuleNames.forEach((t) => {
            if (
                ToolController_.toolModules[t] &&
                typeof ToolController_.toolModules[t].initialize === 'function'
            )
                ToolController_.toolModules[t].initialize()
        })

        // --- Separated tools: jQuery DOM construction ---
        // Container for separated tool content (floats over the map)
        this.separatedContentDiv = $('<div>')
            .attr('id', 'toolcontroller_sep_content')
            .css({
                'position': 'absolute',
                'top': '12px',
                'left': '12px',
                'z-index': '1002',
                'display': 'flex',
                'gap': '12px',
                'pointer-events': 'none',
            })
        $('#splitscreens').append(this.separatedContentDiv)

        // Separator + container for separated tool buttons in toolbar
        this.sepToolbarDiv = $('<div>')
            .attr('id', 'toolcontroller_sepdiv')
        const mainDiv = $('#toolbarTools')
        if (mainDiv.length) mainDiv.append(this.sepToolbarDiv)

        const sepDivider = $('<div>')
            .attr('class', 'toolSepDivider')
            .css({
                'width': '26px',
                'height': '1px',
                'margin': '4px auto',
                'background': 'var(--color-a1)',
            })
        this.sepToolbarDiv.append(sepDivider)

        // Create each separated tool (Legend first/above Identifier in toolbar)
        let legendToolIndex = -1
        for (let i = 0; i < tools.length; i++) {
            if (tools[i].separatedTool === true && tools[i].name === 'Legend') {
                legendToolIndex = i
                break
            }
        }
        if (legendToolIndex >= 0 && L_.UserInterface_.isMobile !== true) {
            this._createSeparatedTool(tools, legendToolIndex)
        }
        for (let i = 0; i < tools.length; i++) {
            if (tools[i].separatedTool === true && L_.UserInterface_.isMobile !== true) {
                if (tools[i].name === 'Legend') continue
                this._createSeparatedTool(tools, i)
            }
        }

        // Publish tools list to Zustand store for React rendering
        useUIStore.getState().setToolsList(tools)
        useUIStore.getState().setToolsLoaded(true)

        ToolController_.loaded = true
        L_.toolsLoaded = true

        L_.fullyLoaded()
    },

    _createSeparatedTool: function (tools, i) {
        const isIdentifier = tools[i].name === 'Identifier'
        const toolWidth = this.toolModules[tools[i].name + 'Tool']
            ? this.toolModules[tools[i].name + 'Tool'].width || 200
            : 200

        // Outer floating panel wrapper (glassy styling)
        const toolPanel = $('<div>')
            .attr('id', `toolPanelSeparated_${tools[i].name}`)
            .attr('class', 'sep-tool-panel')
            .css({
                'width': isIdentifier ? '0px' : toolWidth + 'px',
                'max-height': isIdentifier ? '0px' : 'calc(100vh - 120px)',
                'border-radius': '10px',
                'background': isIdentifier ? 'transparent' : 'rgba(26,26,27,0.88)',
                'border': isIdentifier ? 'none' : '1px solid var(--color-a1)',
                'backdrop-filter': isIdentifier ? 'none' : 'blur(20px)',
                '-webkit-backdrop-filter': isIdentifier ? 'none' : 'blur(20px)',
                'box-shadow': isIdentifier ? 'none' : '0 8px 32px rgba(0,0,0,0.4)',
                'display': 'none',
                'flex-direction': 'column',
                'overflow': 'hidden',
                'pointer-events': isIdentifier ? 'none' : 'auto',
            })
        this.separatedContentDiv.append(toolPanel)

        // Header with title and close button
        if (!isIdentifier) {
            const toolHeader = $('<div>')
                .attr('class', 'sep-tool-header')
                .css({
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    'padding': '10px 12px',
                    'border-bottom': '1px solid var(--color-a1)',
                    'flex-shrink': '0',
                })
            const headerTitle = $('<span>')
                .css({
                    'font-size': '13px',
                    'font-weight': '400',
                    'color': 'var(--color-f)',
                    'text-transform': 'uppercase',
                    'letter-spacing': '0.05em',
                })
                .text(tools[i].name)
            const headerClose = $('<div>')
                .attr('title', 'Close')
                .css({
                    'cursor': 'pointer',
                    'color': 'var(--color-a3)',
                    'width': '20px',
                    'height': '20px',
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'border-radius': '4px',
                    'transition': 'all 0.15s',
                })
                .html('<i class="mdi mdi-close" style="font-size:14px"></i>')
                .on('mouseenter', function () {
                    $(this).css({ 'color': 'var(--color-f)', 'background': 'rgba(255,255,255,0.1)' })
                })
                .on('mouseleave', function () {
                    $(this).css({ 'color': 'var(--color-a3)', 'background': 'none' })
                })
                .on('click', (function (idx) {
                    return function () {
                        $(`#toolButtonSeparated_${tools[idx].name}`).click()
                    }
                })(i))
            toolHeader.append(headerTitle).append(headerClose)
            toolPanel.append(toolHeader)
        }

        // Inner content area (this is what the tool targets for rendering)
        const toolContent = $('<div>')
            .attr('id', `toolContentSeparated_${tools[i].name}`)
            .css({
                'flex': '1',
                'overflow': 'auto',
                'min-height': '0',
            })
        toolPanel.append(toolContent)

        // Tool button in the toolbar (dedicated section)
        const toolButton = $('<div>')
            .attr('id', `toolButtonSeparated_${tools[i].name}`)
            .attr('class', 'toolButton toolSep')
            .attr('tabindex', i + 1)
            .css({
                'width': '100%',
                'height': '36px',
                'display': 'inline-block',
                'text-align': 'center',
                'line-height': '36px',
                'vertical-align': 'middle',
                'cursor': 'pointer',
                'transition': 'all 0.15s',
                'color': 'var(--color-f)',
            })
            .on('click', (function (idx) {
                return function () {
                    const tM = ToolController_.toolModules[
                        `${ToolController_.tools[idx].name}Tool`
                    ]
                    if (tM) {
                        const isIdent = ToolController_.tools[idx].name === 'Identifier'
                        if (tM.made === false) {
                            tM.make(
                                `toolContentSeparated_${ToolController_.tools[idx].name}`
                            )
                            if (!isIdent) {
                                $(`#toolPanelSeparated_${ToolController_.tools[idx].name}`).css('display', 'flex')
                            }
                            ToolController_.activeSeparatedTools.push(
                                ToolController_.tools[idx].name + 'Tool'
                            )
                            $(
                                `#toolButtonSeparated_${tools[idx].name}`
                            ).addClass('active')
                        } else {
                            tM.destroy()
                            if (!isIdent) {
                                $(`#toolPanelSeparated_${ToolController_.tools[idx].name}`).css('display', 'none')
                            }
                            ToolController_.activeSeparatedTools =
                                ToolController_.activeSeparatedTools.filter(
                                    (a) =>
                                        a !==
                                        ToolController_.tools[idx].name + 'Tool'
                                )
                            $(
                                `#toolButtonSeparated_${tools[idx].name}`
                            ).removeClass('active')
                        }
                        document.dispatchEvent(
                            new CustomEvent('toggleSeparatedTool', {
                                detail: {
                                    toggledToolName: tools[idx].js,
                                    visible: tM.made,
                                },
                            })
                        )
                    }
                }
            })(i))
        toolButton.append(
            $('<i>')
                .attr('id', tools[i].name + 'Tool')
                .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                .css('cursor', 'pointer')
        )
        this.sepToolbarDiv.append(toolButton)

        // Add tooltip (desktop only)
        if (!L_.UserInterface_.isMobile) {
            tippy(`#toolButtonSeparated_${tools[i].name}`, {
                content: tools[i].name,
                placement: 'right',
                theme: 'blue',
            })
        }

        // Auto-open on start if explicitly configured
        if (tools[i].on === true) {
            setTimeout(() => {
                $(`#toolButtonSeparated_${tools[i].name}`).click()
            }, 0)
        }
    },

    clear() {
        // Don't remove #toolbarTools — it's React-managed.
        // Setting toolsLoaded: false (below) causes Toolbar.jsx to unmount it.
        this.tools = null
        this.toolModuleNames = []
        this.activeSeparatedTools = []
        this.toolModules = toolModules
        // Remove separated tool DOM
        if (this.separatedContentDiv) {
            this.separatedContentDiv.remove()
            this.separatedContentDiv = null
        }
        if (this.sepToolbarDiv) {
            this.sepToolbarDiv.remove()
            this.sepToolbarDiv = null
        }
        useUIStore.getState().setToolsList([])
        useUIStore.getState().setToolsLoaded(false)
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
                    // Destroy the currently active tool before switching
                    if (this.activeTool != null) {
                        this.activeTool.destroy()
                        this.activeTool = null
                    }
                    // If a horizontal tool is still pending close (deferred
                    // destroy via setTimeout), destroy it now before opening
                    // the new tool — otherwise its destroy() is never called.
                    if (this._pendingCloseTool) {
                        this._pendingCloseTool.destroy()
                        this._pendingCloseTool = null
                    }
                    // Cancel any pending horizontal-tool close cleanup
                    ++this._closeSeq

                    this.setToolHeight(tool.height)
                    this.setToolWidth(tool.width)
                    if (tool.height == 0) {
                        this.UserInterface.openToolPanel(tool.width)
                    } else {
                        this.UserInterface.closeToolPanel()
                    }
                    // Toggle drag handle via store (React is single source of truth)
                    useUIStore.getState().setToolPanelDragVisible(
                        toolConfigs[ToolController_.tools[idx].name]
                            ?.expandable === true
                    )

                    this.activeTool = tool
                    tool.make(this)

                    // Inject close X button into the tool's content area
                    ToolController_.injectCloseButton()
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
                // Toggle drag handle via store (React is single source of truth)
                useUIStore.getState().setToolPanelDragVisible(false)
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
    _closeSeq: 0,
    closeActiveTool: function () {
        // Button active/inactive styling is now driven by the Zustand store's
        // activeToolName field. Toolbar.jsx reads it and passes isActive to
        // each ToolButton, so no imperative DOM class toggling is needed here.
        // Setting activeToolName to null (below) triggers React to re-render
        // all buttons with isActive=false.

        var wasHorizontal = this.prevHeight != 0

        if (this.activeTool != null) {
            if (wasHorizontal) {
                // Horizontal tools: animate the wrapper height to 0 first,
                // then destroy the tool and clean up after the CSS transition
                // (0.4s ease-out) completes. This keeps the tool content
                // visible while the wrapper slides downward.
                var closingTool = this.activeTool
                this._pendingCloseTool = closingTool
                var closeId = ++this._closeSeq
                this.UserInterface.setToolHeight(0)
                // Reset wrapper width immediately so TopBar snaps to
                // the correct position at the start of the close animation
                // (the height animation provides the visual close effect).
                useUIStore.setState({
                    toolsWrapperRawWidth: 0,
                    toolsWrapperCSSWidth: '0%',
                })
                setTimeout(function () {
                    // Guard: if another tool was opened during the transition,
                    // _closeSeq will have incremented — skip stale cleanup.
                    if (ToolController_._closeSeq !== closeId) return
                    try {
                        closingTool.destroy()
                    } catch (e) {
                        console.warn('Deferred tool destroy() failed:', e)
                    }
                    ToolController_._pendingCloseTool = null
                    var toolsEl = document.getElementById('tools')
                    if (toolsEl) toolsEl.innerHTML = ''
                }, 420)
            } else {
                // Vertical/side-panel tools: destroy immediately
                this.activeTool.destroy()
                var toolsEl = document.getElementById('tools')
                if (toolsEl) toolsEl.innerHTML = ''
                this.UserInterface.closeToolPanel()
                useUIStore.setState({
                    toolsWrapperRawWidth: 0,
                    toolsWrapperCSSWidth: '0%',
                })
                if (this.UserInterface != null) {
                    this.UserInterface.setToolHeight(0)
                }
            }
        }
        this.activeTool = null
        this.activeToolName = null
        // Sync to store so React re-renders button states
        useUIStore.getState().setActiveToolName(null)
        this.prevHeight = 0
    },
    injectCloseButton: function () {
        // Horizontal tools: close button is rendered by the React
        // BottomFloatingBar component (SplitScreens.jsx) — no injection
        // needed here. Only inject for vertical (side-panel) tools.
        const isHorizontal = this.activeTool && this.activeTool.height > 0
        if (isHorizontal) return

        const container = $('#toolPanel')
        if (!container.length) return

        // Remove any existing injected close button
        container.find('.tool-close-btn').remove()

        const closeBtn = $('<div>')
            .addClass('tool-close-btn')
            .attr('title', 'Close Tool')
            .css({
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                cursor: 'pointer',
                'border-radius': '4px',
                'z-index': '10',
                color: '#9ca3af',
                'font-size': '18px',
                transition: 'background 0.15s, color 0.15s',
            })
            .html("<i class='mdi mdi-close mdi-18px'></i>")
            .on('mouseenter', function () {
                $(this).css({ background: 'rgba(255,255,255,0.1)', color: '#fff' })
            })
            .on('mouseleave', function () {
                $(this).css({ background: 'transparent', color: '#9ca3af' })
            })
            .on('click', function () {
                ToolController_.closeActiveTool()
            })

        // Ensure the container has position:relative for absolute positioning
        const firstChild = container.children().first()
        if (firstChild.length) {
            firstChild.css('position', 'relative')
            firstChild.append(closeBtn)
        } else {
            container.css('position', 'relative')
            container.append(closeBtn)
        }
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
