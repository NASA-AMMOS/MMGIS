import React from 'react'
import useUIStore from '../store/uiStore'

function ToolsWrapper() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const splitterSize = useUIStore((s) => s.splitterSize)
    const toolsWrapperCSSWidth = useUIStore((s) => s.toolsWrapperCSSWidth)

    return (
        <div
            id="toolsWrapper"
            style={{
                height: pxIsTools + 'px',
                width: toolsWrapperCSSWidth,
                margin: '0',
                background: 'var(--color-a)',
                left: '0px',
                bottom: '0px',
                zIndex: 1003,
                transition: 'height 0.4s ease-out',
            }}
        >
            <div
                id="tools"
                style={{
                    position: 'absolute',
                    top: '0px',
                    height: '100%',
                    paddingBottom: '0px',
                    width: '100%',
                }}
            ></div>
            <div
                className="splitterH"
                id="toolsSplit"
                style={{
                    height: splitterSize / 2 + 'px',
                    left: '0px',
                    bottom: pxIsTools - splitterSize / 2 + 'px',
                    zIndex: 3,
                }}
            ></div>
        </div>
    )
}

export default ToolsWrapper
