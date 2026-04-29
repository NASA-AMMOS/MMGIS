import React, { useEffect, useRef, useCallback } from 'react'
import useUIStore from '../store/uiStore'
import ViewerPanel from './ViewerPanel'
import MapPanel from './MapPanel'
import GlobePanel from './GlobePanel'
import Splitter from './Splitter'
import SeparatedTools from './SeparatedTools'

import './SplitScreens.css'

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
    // percents whenever the splitscreens container resizes.
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
    // Tool panel floats over map content — don't push splitscreens
    const leftOffset = toolbarWidth

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
            <BottomFloatingBar />
        </div>
    )
}

/**
 * BottomFloatingBar — wraps horizontal tool content + TimeUI dock.
 * Matches PR #47's bottomFloatingBar: floats inside #splitscreens with
 * 12px margins, backdrop blur, border-radius.
 * Visible when TimeUI is active or horizontal tool is open.
 */
function BottomFloatingBar() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const toolsWrapperCSSWidth = useUIStore((s) => s.toolsWrapperCSSWidth)
    const timeUIActive = useUIStore((s) => s.timeUIActive)
    const timeUIExpanded = useUIStore((s) => s.timeUIExpanded)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const timeUIDockRef = useRef(null)

    const hasToolContent = pxIsTools > 0
    const isVisible = timeUIActive || hasToolContent
    const barLeftOffset = (toolPanelWidth || 0) + 12

    const handleCloseTool = useCallback(() => {
        const ToolController_ =
            require('../../ToolController_/ToolController_').default
        ToolController_.closeActiveTool()
    }, [])

    // Reparent #timeUI into our timeUIDock when it appears in the DOM
    useEffect(() => {
        const dock = timeUIDockRef.current
        if (!dock) return

        const reparent = () => {
            const timeUI = document.getElementById('timeUI')
            if (timeUI && timeUI.parentElement !== dock) {
                dock.appendChild(timeUI)
                timeUI.style.position = 'relative'
                timeUI.style.bottom = 'auto'
                timeUI.style.left = 'auto'
                timeUI.style.width = '100%'
            }
        }

        // Try immediately
        reparent()

        // Also observe for #timeUI appearing later
        const observer = new MutationObserver(() => {
            reparent()
        })
        // Observe the whole splitscreens area for added nodes
        const splitscreens = document.getElementById('splitscreens')
        if (splitscreens) {
            observer.observe(splitscreens, { childList: true, subtree: true })
        }

        return () => observer.disconnect()
    }, [])

    return (
        <div
            id="bottomFloatingBar"
            style={{
                position: 'absolute',
                bottom: '12px',
                left: barLeftOffset + 'px',
                right: '12px',
                zIndex: 1500,
                transition: 'left 0.2s ease-out',
                borderRadius: '10px',
                border: '1px solid var(--color-a1)',
                background: 'rgba(29, 31, 32, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                overflow: 'visible',
                pointerEvents: 'auto',
                maxHeight: 'calc(100% - 24px)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
                display: isVisible ? 'flex' : 'none',
                flexDirection: 'column',
            }}
        >
            {/* Horizontal tool content — expands upward */}
            <div
                id="toolsWrapper"
                style={{
                    height: pxIsTools + 'px',
                    width: toolsWrapperCSSWidth || '100%',
                    margin: '0',
                    background: 'transparent',
                    overflow: 'hidden',
                    transition: 'height 0.3s ease-out',
                    flexShrink: 0,
                    position: 'relative',
                }}
            >
                <div
                    id="tools"
                    style={{
                        position: 'relative',
                        height: '100%',
                        paddingBottom: '0px',
                        width: '100%',
                    }}
                ></div>
                <Splitter type="tools" orientation="horizontal" />
                {/* Close button for horizontal tools */}
                {hasToolContent && (
                    <div
                        className="tool-close-btn"
                        title="Close Tool"
                        onClick={handleCloseTool}
                        style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            zIndex: 10,
                            color: '#9ca3af',
                            fontSize: '18px',
                            transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                            e.currentTarget.style.color = '#fff'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#9ca3af'
                        }}
                    >
                        <i className="mdi mdi-close mdi-18px"></i>
                    </div>
                )}
            </div>
            {/* TimeUI dock — #timeUI will be reparented here */}
            <div
                id="timeUIDock"
                ref={timeUIDockRef}
                style={{
                    width: '100%',
                    minHeight: '0px',
                    flexShrink: 0,
                }}
            ></div>
        </div>
    )
}

export default SplitScreens
