import React, { useEffect, useRef } from 'react'
import useUIStore from '../store/uiStore'
import ViewerPanel from './ViewerPanel'
import MapPanel from './MapPanel'
import GlobePanel from './GlobePanel'
import Splitter from './Splitter'
import SeparatedTools from './SeparatedTools'

function SplitScreens() {
    const topSize = useUIStore((s) => s.topSize)
    const fullSizeViews = useUIStore((s) => s.fullSizeViews)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const isMobile = useUIStore((s) => s.isMobile)
    const toolbarVisible = useUIStore((s) => s.toolbarVisible)
    const splitscreensRef = useRef(null)

    // Initialize pxIsMap once on first mount only
    const initializedRef = useRef(false)
    useEffect(() => {
        if (!initializedRef.current) {
            const el = splitscreensRef.current
            if (el) {
                initializedRef.current = true
                const width = el.offsetWidth
                const height = el.offsetHeight
                useUIStore.setState({
                    mainWidth: width,
                    mainHeight: height,
                    pxIsMap: width,
                })
            }
        }
    }, [])

    // ResizeObserver: automatically recapture dimensions and recompute panel
    // percents whenever the splitscreens container resizes. This replaces:
    //  - window 'resize' event listener
    //  - useEffect on [topSize, toolPanelWidth, toolbarVisible] with rAF
    //  - setTimeout(250) hacks in bridge openToolPanel/closeToolPanel
    // The observer fires after layout reflow, so dimensions are always correct.
    useEffect(() => {
        const el = splitscreensRef.current
        if (!el) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                const newWidth = Math.round(width)
                const newHeight = Math.round(height)

                const state = useUIStore.getState()
                if (newWidth === state.mainWidth && newHeight === state.mainHeight) return

                // Use handleWindowResize for correct proportional scaling.
                // It computes new pixel values from the OLD mainWidth before
                // updating, avoiding the stale-percent bug where getPanelPercents
                // would divide old pixels by new mainWidth.
                if (initializedRef.current) {
                    useUIStore.getState().handleWindowResize(newWidth, newHeight)
                } else {
                    useUIStore.setState({
                        mainWidth: newWidth,
                        mainHeight: newHeight,
                    })
                }
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const topOffset = fullSizeViews ? 0 : topSize
    // Desktop toolbar is 40px wide; hidden when toolbarVisible is false
    const toolbarWidth = isMobile ? 0 : (toolbarVisible ? 40 : 0)
    const leftOffset = toolPanelWidth + toolbarWidth

    return (
        <div
            id="splitscreens"
            ref={splitscreensRef}
            style={{
                position: 'absolute',
                top: topOffset + 'px',
                width: `calc(100% - ${leftOffset}px)`,
                height: `calc(100% - ${topOffset}px)`,
                left: leftOffset + 'px',
                transition: 'left 0.2s ease-out, width 0.2s ease-out',
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
            {!isMobile && <SeparatedTools />}
            <div id="tScreen">
                <ToolsWrapper />
            </div>
        </div>
    )
}

// Inline ToolsWrapper to avoid circular dependency
function ToolsWrapper() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
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
            <Splitter type="tools" orientation="horizontal" />
        </div>
    )
}

export default SplitScreens
