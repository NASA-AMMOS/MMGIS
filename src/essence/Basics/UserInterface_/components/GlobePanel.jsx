import React, { useEffect, useRef } from 'react'
import useUIStore from '../store/uiStore'
import splitStyles from './SplitScreens.module.css'

function GlobePanel() {
    const pxIsGlobe = useUIStore((s) => s.pxIsGlobe)
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const pxIsMap = useUIStore((s) => s.pxIsMap)
    const mainHeight = useUIStore((s) => s.mainHeight)
    const globeRef = useRef(null)

    // ResizeObserver calls invalidateSize before paint — no visible jerk
    useEffect(() => {
        const el = globeRef.current
        if (!el) return
        const observer = new ResizeObserver(() => {
            const g = useUIStore.getState()._Globe
            if (g && g.litho) g.litho.invalidateSize({ animate: false })
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            id="globeScreen"
            className={splitStyles.globeScreen}
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
                ref={globeRef}
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
