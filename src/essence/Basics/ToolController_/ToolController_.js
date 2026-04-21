import L_ from '../Layers_/Layers_'
import { toolModules, toolConfigs } from '../../../pre/tools'
import useUIStore from '../UserInterface_/store/uiStore'

let ToolController_ = {
    tools: null,
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

    // init: Build the tool module name list and initialize all tool modules.
    // DOM construction is now handled by React components:
    //   - Toolbar.jsx renders sidebar tool buttons
    //   - SeparatedTools.jsx renders floating map-overlay tool buttons
    // The tools list is published to the Zustand store so React can render.
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

        // Publish tools list to Zustand store for React rendering
        useUIStore.getState().setToolsList(tools)
        useUIStore.getState().setToolsLoaded(true)

        ToolController_.loaded = true
        L_.toolsLoaded = true

        L_.fullyLoaded()
    },

    clear() {
        // Don't remove #toolbarTools — it's React-managed.
        // Setting toolsLoaded: false (below) causes Toolbar.jsx to unmount it.
        this.tools = null
        this.toolModuleNames = []
        this.toolModules = toolModules
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
                    // Toggle drag handle via store (React is single source of truth)
                    useUIStore.getState().setToolPanelDragVisible(
                        toolConfigs[ToolController_.tools[idx].name]
                            ?.expandable === true
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
    closeActiveTool: function () {
        // Deselect active button styling (vanilla DOM, no jQuery)
        var prevActive = document.querySelectorAll(
            '#toolcontroller_incdiv .active'
        )
        prevActive.forEach(function (el) {
            el.classList.remove('active')
            el.style.color = ToolController_.defaultColor
            el.style.background = 'none'
            if (el.parentElement) el.parentElement.style.background = 'none'
        })

        if (this.activeTool != null) {
            this.activeTool.destroy()
            var toolsEl = document.getElementById('tools')
            if (toolsEl) toolsEl.innerHTML = ''
            this.UserInterface.closeToolPanel()
        }
        this.activeTool = null
        this.activeToolName = null
        // Sync to store so React re-renders button states
        useUIStore.getState().setActiveToolName(null)
        // Reset tools wrapper width so TopBar returns to default layout
        useUIStore.setState({ toolsWrapperRawWidth: 0, toolsWrapperCSSWidth: '0%' })
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
