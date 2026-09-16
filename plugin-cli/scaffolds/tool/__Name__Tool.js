import React from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import { IconButton } from '@design/components'

import './__Name__Tool.css'

let __Name__Tool = {
    height: 0,
    width: 300,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        __Name__Tool._root = createRoot(toolPanel)
        __Name__Tool._root.render(
            <div className='__name__Tool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>__Name__</div>
                        </div>
                        <div>
                            <IconButton
                                size='sm'
                                onClick={() => ToolController_.closeActiveTool()}
                                title='Close Tool'
                            >
                                <i className='mdi mdi-close mdi-18px' />
                            </IconButton>
                        </div>
                    </div>
                </div>
                <div className='__name__Tool_content'>
                    {/* Tool content goes here */}
                </div>
            </div>
        )
    },

    destroy: function () {
        if (__Name__Tool._root) {
            __Name__Tool._root.unmount()
            __Name__Tool._root = null
        }
    },
}

export default __Name__Tool
