import React from 'react'
import useUIStore from '../store/uiStore'

function ViewerPanel() {
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const mainHeight = useUIStore((s) => s.mainHeight)

    return (
        <div
            id="viewerScreen"
            style={{
                position: 'absolute',
                width: pxIsViewer + 'px',
                height: mainHeight + 'px',
                top: '0px',
                overflow: 'hidden',
                left: '0px',
            }}
        >
            <div
                id="viewer"
                style={{
                    position: 'absolute',
                    backgroundColor: 'var(--color-a-5)',
                    width: '100%',
                    height: '100%',
                }}
            ></div>
            <div
                id="viewerToolBar"
                style={{
                    position: 'absolute',
                    top: '40px',
                    width: '100%',
                    height: '48px',
                    pointerEvents: 'none',
                    zIndex: 5,
                }}
            ></div>
        </div>
    )
}

export default ViewerPanel
