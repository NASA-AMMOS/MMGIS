import React from 'react'
import useUIStore from '../store/uiStore'

function GlobePanel() {
    const pxIsGlobe = useUIStore((s) => s.pxIsGlobe)
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const pxIsMap = useUIStore((s) => s.pxIsMap)
    const mainHeight = useUIStore((s) => s.mainHeight)

    return (
        <div
            id="globeScreen"
            style={{
                position: 'absolute',
                width: pxIsGlobe + 'px',
                height: mainHeight + 'px',
                top: '0px',
                overflow: 'hidden',
                left: pxIsViewer + pxIsMap + 'px',
                zIndex: 401,
            }}
        >
            <div
                id="globe"
                style={{
                    position: 'absolute',
                    backgroundColor: 'var(--color-a1)',
                    width: '100%',
                    height: '100%',
                }}
            ></div>
            <div
                id="globeToolBar"
                style={{
                    position: 'absolute',
                    top: '40px',
                    width: '100%',
                    paddingRight: '0px',
                    height: '40px',
                    pointerEvents: 'none',
                    zIndex: 5,
                }}
            ></div>
        </div>
    )
}

export default GlobePanel
