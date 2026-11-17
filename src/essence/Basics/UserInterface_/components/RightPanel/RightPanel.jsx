import React from 'react'
import useUIStore from '../../store/uiStore'
import styles from './RightPanel.module.css'

const MARGIN = 12
const COORDS_HEIGHT = 30

function RightPanel() {
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
    const topSize = useUIStore((s) => s.topSize)
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const timeUIActive = useUIStore((s) => s.timeUIActive)
    const timeUIExpanded = useUIStore((s) => s.timeUIExpanded)

    const isOpen = rightPanelWidth > 0

    // Compute bottom offset accounting for the bottom floating bar
    const toolsH = pxIsTools || 0
    const timeUIDockH = timeUIActive ? (timeUIExpanded ? 177 : 40) : 0
    const barBorderH = (toolsH > 0 || timeUIDockH > 0) ? 2 : 0
    const targetBarHeight = toolsH + timeUIDockH + barBorderH
    const barBottom = 12
    const isBarVisible = timeUIActive || toolsH > 0
    const totalOffset = isBarVisible ? (targetBarHeight + barBottom) : 0

    // Panel must clear: CoordinatesDiv (30px tall, sitting at totalOffset + 12)
    const coordsClearance = totalOffset + MARGIN + COORDS_HEIGHT + MARGIN
    const panelBottom = Math.max(coordsClearance, totalOffset > 0 ? (totalOffset + MARGIN) : (COORDS_HEIGHT + MARGIN + MARGIN))

    return (
        <div
            id="uiRightPanel"
            className={`${styles.rightPanel} ${
                isOpen ? styles.rightPanelOpen : styles.rightPanelClosed
            }`}
            style={{
                width: rightPanelWidth + 'px',
                top: topSize + MARGIN + 'px',
                height: `calc(100% - ${topSize + MARGIN + panelBottom}px)`,
                right: MARGIN + 'px',
                transition:
                    'width 0.2s ease-out, opacity 0.2s ease-out, border-color 0.2s ease-out',
            }}
        ></div>
    )
}

export default RightPanel
