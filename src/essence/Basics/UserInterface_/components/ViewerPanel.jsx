import React, { useEffect, useRef } from 'react'
import useUIStore from '../store/uiStore'

function ViewerPanel() {
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const mainHeight = useUIStore((s) => s.mainHeight)
    const viewerRef = useRef(null)

    // ResizeObserver calls invalidateSize before paint — no visible jerk
    useEffect(() => {
        const el = viewerRef.current
        if (!el) return
        const observer = new ResizeObserver(() => {
            const v = useUIStore.getState()._Viewer
            if (v && v.invalidateSize) v.invalidateSize({ animate: false })
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

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
                ref={viewerRef}
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
