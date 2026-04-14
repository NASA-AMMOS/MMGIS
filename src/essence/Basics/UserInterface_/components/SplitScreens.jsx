import React, { useEffect, useRef } from 'react'
import useUIStore from '../store/uiStore'
import ViewerPanel from './ViewerPanel'
import MapPanel from './MapPanel'
import GlobePanel from './GlobePanel'
import Splitter from './Splitter'

function SplitScreens() {
    const topSize = useUIStore((s) => s.topSize)
    const fullSizeViews = useUIStore((s) => s.fullSizeViews)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const splitscreensRef = useRef(null)

    useEffect(() => {
        const handleResize = () => {
            const el = splitscreensRef.current
            if (el) {
                useUIStore
                    .getState()
                    .handleWindowResize(el.offsetWidth, el.offsetHeight)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Initialize dimensions once mounted
    useEffect(() => {
        const el = splitscreensRef.current
        if (el) {
            const state = useUIStore.getState()
            const width = el.offsetWidth
            const height = el.offsetHeight
            useUIStore.setState({
                mainWidth: width,
                mainHeight: height,
                pxIsMap: width,
            })
        }
    }, [])

    const topOffset = fullSizeViews ? 0 : topSize

    return (
        <div
            id="splitscreens"
            ref={splitscreensRef}
            style={{
                position: 'absolute',
                top: topOffset + 'px',
                width: `calc(100% - ${toolPanelWidth + 40}px)`,
                height: `calc(100% - ${topOffset}px)`,
                left: toolPanelWidth + 40 + 'px',
            }}
        >
            <div id="vmgScreen">
                <ViewerPanel />
                <Splitter type="viewer" />
                <MapPanel />
                <Splitter type="map" />
                <GlobePanel />
                <Splitter type="globe" />
            </div>
            <div id="tScreen">
                <ToolsWrapper />
            </div>
        </div>
    )
}

// Inline ToolsWrapper to avoid circular dependency
function ToolsWrapper() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const splitterSize = useUIStore((s) => s.splitterSize)
    const toolsWrapperCSSWidth = useUIStore((s) => s.toolsWrapperCSSWidth)

    return (
        <div
            id="toolsWrapper"
            style={{
                height: pxIsTools + 'px',
                width: toolsWrapperCSSWidth,
                margin: '0',
                background: 'var(--color-a)',
                left: '0px',
                bottom: '0px',
                zIndex: 1003,
                transition: 'height 0.4s ease-out',
            }}
        >
            <div
                id="tools"
                style={{
                    position: 'absolute',
                    top: '0px',
                    height: '100%',
                    paddingBottom: '0px',
                    width: '100%',
                }}
            ></div>
            <div
                className="splitterH"
                id="toolsSplit"
                style={{
                    height: splitterSize / 2 + 'px',
                    left: '0px',
                    bottom:
                        pxIsTools - splitterSize / 2 + 'px',
                    zIndex: 3,
                }}
            ></div>
        </div>
    )
}

export default SplitScreens
