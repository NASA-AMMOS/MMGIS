import React, { useRef, useCallback } from 'react'
import useUIStore from '../store/uiStore'

// The toolbar is always 40px wide regardless of topSize
const TOOLBAR_WIDTH = 40

function ToolPanel() {
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const toolPanelDragVisible = useUIStore((s) => s.toolPanelDragVisible)
    const topSize = useUIStore((s) => s.topSize)
    const isMobile = useUIStore((s) => s.isMobile)
    const mobileTopSize = useUIStore((s) => s.mobileTopSize)
    const dragRef = useRef(null)

    // Mobile: tool panel left offset is topSize (50px); Desktop: TOOLBAR_WIDTH (40px)
    const panelLeftOffset = isMobile ? mobileTopSize : TOOLBAR_WIDTH

    const handleDragMouseDown = useCallback((e) => {
        const startX = e.pageX
        const startLeft = toolPanelWidth + 10

        const handleMouseMove = (ev) => {
            const newLeft = startLeft + (ev.pageX - startX)
            document.body.style.userSelect = 'none'
            if (dragRef.current) {
                dragRef.current._dragged = true
                dragRef.current.style.left = newLeft + 'px'
                dragRef.current.style.height = '100%'
                dragRef.current.style.borderRight =
                    '2px solid var(--color-a1)'
            }
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.userSelect = ''
            if (dragRef.current && dragRef.current._dragged) {
                const newWidth =
                    parseInt(dragRef.current.style.left) - 10
                if (newWidth > 0) {
                    // Use active tool's configured width as minimum,
                    // matching UserInterfaceBridge.resizeToolPanel()
                    const ToolController_ =
                        require('../../ToolController_/ToolController_').default
                    const activeTool = ToolController_.getTool(
                        ToolController_.activeToolName
                    )
                    const minWidth = (activeTool && activeTool.width) || 300
                    const clampedWidth = Math.max(
                        Math.min(newWidth, window.innerWidth / 2),
                        minWidth
                    )
                    useUIStore.getState().openToolPanel(clampedWidth)
                    // TopBar styles are computed reactively by TopBar.jsx
                    // from toolPanelWidth in the store, so no imperative
                    // DOM update is needed here.
                }
                dragRef.current.style.height = '28px'
                dragRef.current.style.borderRight =
                    '1px solid transparent'
            }
            if (dragRef.current) dragRef.current._dragged = false
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [toolPanelWidth, topSize, panelLeftOffset])

    return (
        <>
            {/* Tool panel - unmanaged DOM node for jQuery tool injection */}
            <div
                id="toolPanel"
                style={{
                    position: 'absolute',
                    width: toolPanelWidth + 'px',
                    top: topSize + 'px',
                    height: `calc(100% - ${topSize}px)`,
                    left: panelLeftOffset + 'px',
                    background: 'var(--color-k)',
                    transition: 'width 0.2s ease-out',
                    overflow: 'hidden',
                    zIndex: 1400,
                }}
            ></div>
            {/* Drag handle */}
            <div
                id="toolPanelDrag"
                ref={dragRef}
                style={{
                    position: 'absolute',
                    width: '24px',
                    height: '28px',
                    padding: '10px 2px',
                    margin: '0px 3px',
                    textAlign: 'center',
                    top: '1px',
                    color: 'var(--color-a3)',
                    overflow: 'hidden',
                    cursor: 'col-resize',
                    display: toolPanelDragVisible ? 'block' : 'none',
                    zIndex: 1400,
                    borderRight: '1px solid transparent',
                    left: toolPanelWidth + 10 + 'px',
                    transition: 'left 0.2s ease-out',
                }}
                onMouseDown={handleDragMouseDown}
            >
                <div>
                    <i className="mdi mdi-drag-vertical mdi-18px"></i>
                </div>
            </div>
        </>
    )
}

export default ToolPanel
