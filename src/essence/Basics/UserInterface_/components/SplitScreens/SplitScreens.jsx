import React, { useEffect, useRef } from 'react'
import useUIStore from '../../store/uiStore'
import ViewerPanel from '../Panels/ViewerPanel'
import MapPanel from '../Panels/MapPanel'
import GlobePanel from '../Panels/GlobePanel'
import Splitter from '../Splitter/Splitter'
import SeparatedTools from '../Panels/SeparatedTools'

import styles from './SplitScreens.module.css'

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

/** Matches `bottom: 12px` on .bottomFloatingBar in SplitScreens.module.css. */
const BAR_MARGIN = 12

/**
 * BottomFloatingBar — wraps horizontal tool content + TimeUI dock.
 * Matches PR #47's bottomFloatingBar: floats inside #splitscreens with
 * 12px margins, backdrop blur, border-radius.
 * Visible when TimeUI is active or horizontal tool is open.
 */
function BottomFloatingBar() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const timeUIActive = useUIStore((s) => s.timeUIActive)
    const timeUIExpanded = useUIStore((s) => s.timeUIExpanded)
    const isDragging = useUIStore((s) => s.isDraggingSplitter)
    const timeUIDockRef = useRef(null)
    const barRef = useRef(null)

    const hasToolContent = pxIsTools > 0
    const isVisible = timeUIActive || hasToolContent

    // Publish how much room the bar takes at the bottom, so the stacked mobile
    // layout can stop the viewer above it rather than running underneath.
    // Measured, not derived from pxIsTools: the bar is also visible with a live
    // time bar and no horizontal tool, and it carries padding and a 12px margin
    // that pxIsTools does not account for. See stackedBottom() in uiStoreMath.
    useEffect(() => {
        const el = barRef.current
        const publish = () => {
            const h = !isVisible || !el ? 0 : el.offsetHeight + BAR_MARGIN
            useUIStore.getState().setPxBottomBar(h)
        }
        publish()
        if (!el || typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(publish)
        observer.observe(el)
        return () => observer.disconnect()
    }, [isVisible])

    // Reparent #timeUI into our timeUIDock when it appears in the DOM (desktop only).
    // On mobile, MobileTimeUIToggle manages #timeUI placement into #tools.
    useEffect(() => {
        if (useUIStore.getState().isMobile) return

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
            className={`${styles.bottomFloatingBar} ${!isVisible ? styles.bottomFloatingBarHidden : ''}`}
            ref={barRef}
            style={{
                zIndex: 1500,
                maxHeight: 'calc(100% - 24px)',
                boxShadow: '0 -4px 20px var(--color-shadow)',
                display: isVisible ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'visible',
            }}
        >
            {/* Horizontal tool content — expands upward */}
            <div
                id="toolsWrapper"
                style={{
                    height: pxIsTools + 'px',
                    width: '100%',
                    margin: '0',
                    background: 'transparent',
                    overflow: 'hidden',
                    transition: isDragging ? 'none' : 'height 0.3s ease-out',
                    flexShrink: 0,
                    position: 'relative',
                    borderBottom: hasToolContent ? '1px solid var(--color-a1)' : 'none',
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
            </div>
            {/* TimeUI dock — #timeUI will be reparented here */}
            <div
                id="timeUIDock"
                ref={timeUIDockRef}
                style={{
                    width: '100%',
                    minHeight: '0px',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 10000,
                    overflow: 'visible',
                }}
            ></div>
        </div>
    )
}

export default SplitScreens
