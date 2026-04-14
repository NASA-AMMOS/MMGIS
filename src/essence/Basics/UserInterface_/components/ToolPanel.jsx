import React, { useRef, useCallback } from 'react'
import useUIStore from '../store/uiStore'

// The toolbar is always 40px wide regardless of topSize
const TOOLBAR_WIDTH = 40

function ToolPanel() {
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const topSize = useUIStore((s) => s.topSize)
    const dragRef = useRef(null)

    const handleDragMouseDown = useCallback((e) => {
        const startX = e.pageX
        const startLeft = toolPanelWidth + TOOLBAR_WIDTH + 10

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
                    parseInt(dragRef.current.style.left) - TOOLBAR_WIDTH + 24
                if (newWidth > 0) {
                    const clampedWidth = Math.max(
                        Math.min(newWidth, window.innerWidth / 2),
                        300
                    )
                    useUIStore.getState().openToolPanel(clampedWidth)
                }
                dragRef.current.style.height = '28px'
                dragRef.current.style.borderRight =
                    '1px solid transparent'
            }
            if (dragRef.current) dragRef.current._dragged = false
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [toolPanelWidth, topSize])

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
                    left: TOOLBAR_WIDTH + 'px',
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
                    display: toolPanelWidth > 0 ? 'block' : 'none',
                    zIndex: 1400,
                    borderRight: '1px solid transparent',
                    left: toolPanelWidth + TOOLBAR_WIDTH + 10 + 'px',
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
