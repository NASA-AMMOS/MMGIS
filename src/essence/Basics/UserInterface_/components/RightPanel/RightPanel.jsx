import React from 'react'
import useUIStore from '../../store/uiStore'
import styles from './RightPanel.module.css'

const MARGIN = 12
// CoordinatesDiv is 30px tall at bottom:12px — panel sits above it
const COORDS_CLEARANCE = 30 + MARGIN

function RightPanel() {
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
    const topSize = useUIStore((s) => s.topSize)

    const isOpen = rightPanelWidth > 0

    return (
        <div
            id="uiRightPanel"
            className={`${styles.rightPanel} ${
                isOpen ? styles.rightPanelOpen : styles.rightPanelClosed
            }`}
            style={{
                width: rightPanelWidth + 'px',
                top: topSize + MARGIN + 'px',
                height: `calc(100% - ${
                    topSize + MARGIN + MARGIN + COORDS_CLEARANCE
                }px)`,
                right: MARGIN + 'px',
                transition:
                    'width 0.2s ease-out, opacity 0.2s ease-out, border-color 0.2s ease-out',
            }}
        ></div>
    )
}

export default RightPanel
