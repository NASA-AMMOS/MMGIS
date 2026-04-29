import React, { useEffect, useRef } from 'react'
import useUIStore from '../../store/uiStore'

function MapPanel() {
    const pxIsMap = useUIStore((s) => s.pxIsMap)
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const splitterSize = useUIStore((s) => s.splitterSize)
    const mainHeight = useUIStore((s) => s.mainHeight)
    const topSize = useUIStore((s) => s.topSize)
    const isMobile = useUIStore((s) => s.isMobile)
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const mapRef = useRef(null)

    // ResizeObserver on #map calls invalidateSize before the browser paints,
    // eliminating the visible "jerk" that setTimeout(0) caused.
    useEffect(() => {
        const el = mapRef.current
        if (!el) return
        const observer = new ResizeObserver(() => {
            const mapObj = useUIStore.getState()._Map
            if (mapObj && mapObj.map) mapObj.map.invalidateSize({ animate: false })
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            id="mapScreen"
            style={{
                position: 'absolute',
                width: pxIsMap - splitterSize * 2 + 'px',
                height: (isMobile ? mainHeight - pxIsTools : mainHeight) + 'px',
                transition: isMobile ? 'height 0.4s ease-out' : undefined,
                top: '0px',
                left: pxIsViewer + splitterSize + 'px',
            }}
        >
            <div
                id="map"
                ref={mapRef}
                style={{
                    position: 'absolute',
                    backgroundColor: 'var(--color-a-5)',
                    width: '100%',
                    height: '100%',
                }}
            ></div>
            <div
                id="mapToolBar"
                style={{
                    position: 'absolute',
                    bottom: '0px',
                    width: '100%',
                    height: '40px',
                    pointerEvents: 'none',
                    overflow: 'hidden',
                    zIndex: 1003,
                    transition: 'bottom 0.2s ease-out, height 0.2s ease-out',
                }}
            ></div>
            <div
                id="mapTopBar"
                style={{
                    zIndex: 400,
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'absolute',
                    top: '0px',
                    pointerEvents: 'none',
                    width: '100%',
                    height: topSize + 'px',
                    left: '0px',
                    background: 'transparent',
                    fontFamily: 'sans-serif',
                    fontSize: '24px',
                    padding: '5px',
                }}
            ></div>
        </div>
    )
}

export default MapPanel
