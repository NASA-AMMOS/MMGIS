import React, { useRef, useCallback } from 'react'
import useUIStore from '../../store/uiStore'
import styles from './RightPanel.module.css'

const MIN_WIDTH = 280
const MARGIN = 12

function RightPanel() {
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
    const topSize = useUIStore((s) => s.topSize)
    const dragRef = useRef(null)

    const handleDragMouseDown = useCallback(
        (e) => {
            const startX = e.pageX

            const handleMouseMove = (ev) => {
                const delta = startX - ev.pageX
                const newWidth = rightPanelWidth + delta
                document.body.style.userSelect = 'none'
                if (dragRef.current) {
                    dragRef.current._dragged = true
                    dragRef.current.style.right =
                        newWidth + MARGIN + 'px'
                    dragRef.current.style.background =
                        'var(--color-mmgis)'
                    dragRef.current.style.opacity = '0.5'
                }
            }

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                document.body.style.userSelect = ''
                if (dragRef.current && dragRef.current._dragged) {
                    const newWidth =
                        window.innerWidth -
                        parseInt(dragRef.current.style.right) -
                        MARGIN
                    if (newWidth > 0) {
                        const clampedWidth = Math.max(
                            Math.min(newWidth, window.innerWidth / 2),
                            MIN_WIDTH
                        )
                        useUIStore
                            .getState()
                            .openRightPanel(clampedWidth)
                    }
                    dragRef.current.style.background = 'transparent'
                    dragRef.current.style.opacity = '1'
                }
                if (dragRef.current) dragRef.current._dragged = false
            }

            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        },
        [rightPanelWidth]
    )

    const isOpen = rightPanelWidth > 0

    return (
        <>
            {/* Right panel - unmanaged DOM node for content injection */}
            <div
                id="uiRightPanel"
                className={`${styles.rightPanel} ${
                    isOpen ? styles.rightPanelOpen : styles.rightPanelClosed
                }`}
                style={{
                    width: rightPanelWidth + 'px',
                    top: topSize + MARGIN + 'px',
                    height: `calc(100% - ${topSize + 2 * MARGIN}px)`,
                    right: MARGIN + 'px',
                    transition:
                        'width 0.2s ease-out, opacity 0.2s ease-out, border-color 0.2s ease-out',
                }}
            ></div>
            {/* Drag handle on left edge */}
            <div
                id="rightPanelDrag"
                ref={dragRef}
                className={styles.dragHandle}
                style={{
                    top: topSize + MARGIN + 'px',
                    height: `calc(100% - ${topSize + 2 * MARGIN}px)`,
                    display: isOpen ? 'flex' : 'none',
                    right: rightPanelWidth + MARGIN + 'px',
                    transition: 'right 0.2s ease-out',
                }}
                onMouseDown={handleDragMouseDown}
            ></div>
        </>
    )
}

export default RightPanel
