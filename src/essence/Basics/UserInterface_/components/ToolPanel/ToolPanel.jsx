import React, { useRef, useCallback } from 'react'
import useUIStore from '../../store/uiStore'
import styles from './ToolPanel.module.css'

// The toolbar is always 40px wide regardless of topSize
const TOOLBAR_WIDTH = 40

function ToolPanel() {
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const toolPanelDragVisible = useUIStore((s) => s.toolPanelDragVisible)
    const topSize = useUIStore((s) => s.topSize)
    const isMobile = useUIStore((s) => s.isMobile)
    const mobileTopSize = useUIStore((s) => s.mobileTopSize)
    const dragRef = useRef(null)

    // Mobile: tool panel left offset is topSize (50px); Desktop: TOOLBAR_WIDTH + 12px margin
    const panelLeftOffset = isMobile ? mobileTopSize : (TOOLBAR_WIDTH + 12)

    const handleDragMouseDown = useCallback((e) => {
        const startX = e.pageX
        const startLeft = toolPanelWidth + panelLeftOffset

        const handleMouseMove = (ev) => {
            const newLeft = startLeft + (ev.pageX - startX)
            document.body.style.userSelect = 'none'
            if (dragRef.current) {
                dragRef.current._dragged = true
                dragRef.current.style.left = newLeft + 'px'
                dragRef.current.style.background = 'var(--color-mmgis)'
                dragRef.current.style.opacity = '0.5'
            }
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.userSelect = ''
            if (dragRef.current && dragRef.current._dragged) {
                const newWidth =
                    parseInt(dragRef.current.style.left) - panelLeftOffset
                if (newWidth > 0) {
                    const ToolController_ =
                        require('../../../ToolController_/ToolController_').default
                    const activeTool = ToolController_.getTool(
                        ToolController_.activeToolName
                    )
                    const minWidth = (activeTool && activeTool.width) || 300
                    const clampedWidth = Math.max(
                        Math.min(newWidth, window.innerWidth / 2),
                        minWidth
                    )
                    useUIStore.getState().openToolPanel(clampedWidth)
                }
                dragRef.current.style.background = 'transparent'
                dragRef.current.style.opacity = '1'
            }
            if (dragRef.current) dragRef.current._dragged = false
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [toolPanelWidth, topSize, panelLeftOffset])

    const isOpen = toolPanelWidth > 0

    return (
        <>
            {/* Tool panel - unmanaged DOM node for jQuery tool injection */}
            <div
                id="toolPanel"
                className={`${styles.toolPanel} ${isOpen ? styles.toolPanelOpen : styles.toolPanelClosed}`}
                style={{
                    width: toolPanelWidth + 'px',
                    top: (topSize + 12) + 'px',
                    height: `calc(100% - ${topSize + 24}px)`,
                    left: panelLeftOffset + 'px',
                    transition: 'width 0.2s ease-out, opacity 0.2s ease-out, border-color 0.2s ease-out',
                }}
            ></div>
            {/* Drag handle */}
            <div
                id="toolPanelDrag"
                ref={dragRef}
                className={styles.dragHandle}
                style={{
                    top: (topSize + 12) + 'px',
                    height: `calc(100% - ${topSize + 24}px)`,
                    display: toolPanelDragVisible ? 'flex' : 'none',
                    left: (toolPanelWidth + panelLeftOffset) + 'px',
                    transition: 'left 0.2s ease-out',
                }}
                onMouseDown={handleDragMouseDown}
            >
                <i className="mdi mdi-drag-vertical mdi-18px"></i>
            </div>
        </>
    )
}

export default ToolPanel
