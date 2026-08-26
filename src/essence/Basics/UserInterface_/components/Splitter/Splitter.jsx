import React, { useCallback, useRef } from 'react'
import useUIStore from '../../store/uiStore'
import splitterStyles from './Splitter.module.css'

const DRAG_THRESHOLD = 1

function Splitter({ type, orientation }) {
    const splitterSizeHidden = useUIStore((s) => s.splitterSizeHidden)
    const splitterSize = useUIStore((s) => s.splitterSize)
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const pxIsMap = useUIStore((s) => s.pxIsMap)
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const mainHeight = useUIStore((s) => s.mainHeight)
    const topSize = useUIStore((s) => s.topSize)
    const hasViewer = useUIStore((s) => s.hasViewer)
    const hasGlobe = useUIStore((s) => s.hasGlobe)
    const mainWidth = useUIStore((s) => s.mainWidth)
    const isMobile = useUIStore((s) => s.isMobile)
    // Stacked (mobile): viewer under the map, so this splitter is a horizontal
    // bar the user drags up and down rather than a vertical one.
    const stacked = isMobile && hasViewer && !hasGlobe

    const dragCount = useRef(0)
    const mouseIsDown = useRef(false)

    const handlePointerDown = useCallback(
        (e) => {
            dragCount.current = 0
            mouseIsDown.current = true
            e.target.setPointerCapture(e.pointerId)

            const handlePointerMove = (ev) => {
                if (!mouseIsDown.current) return
                dragCount.current++
                if (dragCount.current <= DRAG_THRESHOLD) return

                document.body.style.userSelect = 'none'
                if (!useUIStore.getState().isDraggingSplitter) {
                    useUIStore.setState({ isDraggingSplitter: true })
                }

                if (type === 'map') {
                    useUIStore
                        .getState()
                        .computeMapSplitMove(ev.clientX, ev.clientY)
                } else if (type === 'globe') {
                    useUIStore
                        .getState()
                        .computeGlobeSplitMove(ev.clientX)
                } else if (type === 'tools') {
                    useUIStore
                        .getState()
                        .computeToolsSplitMove(ev.clientY)
                }
            }

            const handlePointerUp = () => {
                mouseIsDown.current = false
                dragCount.current = 0
                document.body.style.userSelect = ''
                useUIStore.setState({ isDraggingSplitter: false })
                document.removeEventListener('pointermove', handlePointerMove)
                document.removeEventListener('pointerup', handlePointerUp)
            }

            document.addEventListener('pointermove', handlePointerMove)
            document.addEventListener('pointerup', handlePointerUp)
        },
        [type]
    )

    if (orientation === 'horizontal' || type === 'tools') {
        // Horizontal splitter (drag handle) for tools area
        const handleHeight = 6
        return (
            <div
                className="splitterH"
                id="toolsSplit"
                style={{
                    height: handleHeight + 'px',
                    left: '0px',
                    top: '0px',
                    zIndex: 3,
                    borderRadius: '3px 3px 0 0',
                }}
                onPointerDown={handlePointerDown}
            ></div>
        )
    }

    if (type === 'viewer') {
        return (
            <div
                className={splitterStyles.splitterV}
                id="viewerSplit"
                style={{
                    width: splitterSize + 'px',
                    height: mainHeight + 'px',
                    left: -splitterSize + 'px',
                    cursor: 'default',
                }}
            ></div>
        )
    }

    if (type === 'map') {
        // Hide map splitter when viewer is disabled (matches clearUnwantedPanels)
        if (!hasViewer) return null
        if (stacked) {
            // A full-width grab bar sitting on the viewer's top edge. Kept
            // deliberately tall: this is a touch target, not a mouse one.
            const barHeight = 14
            return (
                <div
                    id="mapSplit"
                    style={{
                        position: 'absolute',
                        width: mainWidth + 'px',
                        height: barHeight + 'px',
                        left: '0px',
                        top: mainHeight - pxIsViewer - barHeight + 'px',
                        zIndex: 3,
                        cursor: 'row-resize',
                        touchAction: 'none',
                        background: 'var(--color-a)',
                        borderTop: '1px solid var(--color-a1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onPointerDown={handlePointerDown}
                >
                    <div
                        style={{
                            width: '36px',
                            height: '4px',
                            borderRadius: '2px',
                            background: 'var(--color-a3)',
                        }}
                    />
                </div>
            )
        }
        return (
            <div
                className={`${splitterStyles.splitterV} ${splitterStyles.splitterVGradient}`}
                id="mapSplit"
                style={{
                    width: splitterSizeHidden + 'px',
                    height: mainHeight + 'px',
                    left:
                        pxIsViewer -
                        splitterSizeHidden / 2 +
                        'px',
                }}
                onPointerDown={handlePointerDown}
            >
                <div
                    className="splitterVInner"
                    id="mapSplitInner"
                    style={{
                        width: splitterSizeHidden * 2 + 'px',
                    }}
                >
                    <div
                        style={{
                            background: 'var(--color-a)',
                            width: '30px',
                            height: '30px',
                            position: 'absolute',
                            left: '-19px',
                            zIndex: -1,
                        }}
                    ></div>
                    <i
                        id="mapSplitInnerLeft"
                        tabIndex={500}
                        className="mdi mdi-chevron-double-left mdi-24px"
                        style={{
                            transition: 'all 0.2s ease-in',
                            position: 'absolute',
                            left: '-28px',
                        }}
                        onClick={() => {
                            const pp = useUIStore
                                .getState()
                                .getPanelPercents()
                            if (pp.map === 0) {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(0, 0, 100)
                            } else {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        0,
                                        pp.map + pp.viewer,
                                        pp.globe
                                    )
                            }
                        }}
                    ></i>
                    <div
                        style={{
                            background: 'var(--color-a)',
                            width: '30px',
                            height: '30px',
                            position: 'absolute',
                            left: '23px',
                            zIndex: -1,
                        }}
                    ></div>
                    <i
                        id="mapSplitInnerRight"
                        tabIndex={501}
                        className="mdi mdi-chevron-double-right mdi-24px"
                        style={{
                            transition: 'all 0.2s ease-in',
                            position: 'absolute',
                            right: '-29px',
                        }}
                        onClick={() => {
                            // Open viewer panel
                            const pp = useUIStore
                                .getState()
                                .getPanelPercents()
                            if (pp.map === 0) {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer + pp.globe / 2,
                                        0,
                                        pp.globe - pp.globe / 2
                                    )
                            } else {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer + pp.map / 2,
                                        pp.map - pp.map / 2,
                                        pp.globe
                                    )
                            }
                        }}
                    ></i>
                    <div id="mapSplitInnerViewerInfo">Viewer</div>
                    <div id="mapSplitInnerVMapInfo">Map</div>
                </div>
            </div>
        )
    }

    if (type === 'globe') {
        // Hide globe splitter when globe is disabled (matches clearUnwantedPanels)
        if (!hasGlobe) return null
        return (
            <div
                className={`${splitterStyles.splitterV} ${splitterStyles.splitterVGradient}`}
                id="globeSplit"
                style={{
                    width: splitterSizeHidden + 'px',
                    height: mainHeight + 'px',
                    left:
                        pxIsViewer +
                        pxIsMap -
                        splitterSizeHidden / 2 +
                        'px',
                }}
                onPointerDown={handlePointerDown}
            >
                <div
                    className="splitterVInner"
                    id="globeSplitInner"
                    style={{
                        width: splitterSizeHidden * 2 + 'px',
                    }}
                >
                    <div
                        style={{
                            background: 'var(--color-a)',
                            width: '30px',
                            height: '30px',
                            position: 'absolute',
                            left: '-18px',
                            zIndex: -1,
                        }}
                    ></div>
                    <i
                        id="globeSplitInnerLeft"
                        tabIndex={502}
                        className="mdi mdi-chevron-double-left mdi-24px"
                        style={{
                            transition: 'all 0.2s ease-in',
                            position: 'absolute',
                            left: '-27px',
                        }}
                        onClick={() => {
                            const pp = useUIStore
                                .getState()
                                .getPanelPercents()
                            if (pp.map === 0) {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer - pp.viewer / 2,
                                        0,
                                        pp.globe + pp.viewer / 2
                                    )
                            } else {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer,
                                        pp.map - pp.map / 2,
                                        pp.globe + pp.map / 2
                                    )
                            }
                        }}
                    ></i>
                    <div
                        style={{
                            background: 'var(--color-a)',
                            width: '30px',
                            height: '30px',
                            position: 'absolute',
                            left: '22px',
                            zIndex: -1,
                        }}
                    ></div>
                    <i
                        id="globeSplitInnerRight"
                        tabIndex={503}
                        className="mdi mdi-chevron-double-right mdi-24px"
                        style={{
                            transition: 'all 0.2s ease-in',
                            position: 'absolute',
                            right: '-28px',
                        }}
                        onClick={() => {
                            const pp = useUIStore
                                .getState()
                                .getPanelPercents()
                            if (pp.map === 0) {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer,
                                        pp.map + pp.globe / 2,
                                        pp.globe - pp.globe / 2
                                    )
                            } else {
                                useUIStore
                                    .getState()
                                    .setPanelPercents(
                                        pp.viewer,
                                        pp.map + pp.globe,
                                        0
                                    )
                            }
                        }}
                    ></i>
                    <div id="mapSplitInnerGlobeInfo">Globe</div>
                    <div id="mapSplitInnerGMapInfo">Map</div>
                </div>
            </div>
        )
    }

    return null
}

export default Splitter
