import React, { useEffect, useRef, useState } from 'react'
import useUIStore from '../../store/uiStore'
import splitStyles from '../SplitScreens/SplitScreens.module.css'
import Description from '../Description/Description'

function ViewerPanel() {
    const pxIsViewer = useUIStore((s) => s.pxIsViewer)
    const mainHeight = useUIStore((s) => s.mainHeight)
    const mainWidth = useUIStore((s) => s.mainWidth)
    const isMobile = useUIStore((s) => s.isMobile)
    const hasViewer = useUIStore((s) => s.hasViewer)
    const hasGlobe = useUIStore((s) => s.hasGlobe)
    // Stacked: the viewer sits under the map instead of beside it, so its
    // panel size is a height. Side-by-side leaves a phone almost no map.
    const stacked = isMobile && hasViewer && !hasGlobe

    // Grey the stepping controls out at the ends of the list, so "next" never
    // looks available when it is not. Recomputed whenever the active feature
    // changes — `newActiveFeature` is dispatched by Map_ for every selection,
    // including the ones these buttons cause.
    const [navAvail, setNavAvail] = useState({ previous: true, next: true })
    useEffect(() => {
        if (!stacked) return undefined
        let alive = true
        const refresh = () => {
            void Description.navAvailability().then((a) => {
                if (alive) setNavAvail(a)
            })
        }
        refresh()
        document.addEventListener('newActiveFeature', refresh)
        return () => {
            alive = false
            document.removeEventListener('newActiveFeature', refresh)
        }
    }, [stacked])
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
            className={splitStyles.viewerScreen}
            style={
                stacked
                    ? {
                          position: 'absolute',
                          width: mainWidth + 'px',
                          height: pxIsViewer + 'px',
                          top: mainHeight - pxIsViewer + 'px',
                          overflow: 'hidden',
                          left: '0px',
                          borderTop: '1px solid var(--color-a1)',
                      }
                    : {
                          position: 'absolute',
                          width: pxIsViewer + 'px',
                          height: mainHeight + 'px',
                          top: '0px',
                          overflow: 'hidden',
                          left: '0px',
                          borderRight: '1px solid var(--color-a1)',
                      }
            }
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
            {stacked && (
                // Stepping through features lives in the Description bar, which
                // on mobile is inside a 40px top bar and effectively
                // unreachable. The viewer is where you are already looking when
                // stepping is meaningful, so surface it here. Both handlers
                // no-op without an active feature.
                <div
                    id="viewerStackedNav"
                    style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        zIndex: 6,
                        display: 'flex',
                        gap: '6px',
                    }}
                >
                    {[
                        { id: 'prev', icon: 'chevron-left', label: 'Previous feature', on: navAvail.previous, fn: () => Description.navPrevious() },
                        { id: 'next', icon: 'chevron-right', label: 'Next feature', on: navAvail.next, fn: () => Description.navNext() },
                    ].map((b) => (
                        <div
                            key={b.id}
                            role="button"
                            aria-label={b.label}
                            aria-disabled={!b.on}
                            title={b.on ? b.label : `No ${b.id === 'prev' ? 'previous' : 'further'} feature`}
                            onClick={b.on ? b.fn : undefined}
                            style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: b.on ? 'pointer' : 'default',
                                opacity: b.on ? 1 : 0.35,
                                borderRadius: '4px',
                                background: 'var(--color-a)',
                                border: '1px solid var(--color-a1)',
                            }}
                        >
                            <i className={`mdi mdi-${b.icon} mdi-18px`} />
                        </div>
                    ))}
                </div>
            )}
            {stacked && (
                // Stacked mobile has no VIEWER/MAP toggle in the top bar — that
                // control implies a side-by-side split that does not exist here
                // — so the panel needs its own way out. Dragging the bar down
                // also works, but is not discoverable.
                <div
                    id="viewerStackedClose"
                    role="button"
                    aria-label="Close viewer"
                    title="Close viewer"
                    onClick={() =>
                        useUIStore.getState().setPanelPercents(0, 100, 0)
                    }
                    style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        zIndex: 6,
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: 'var(--color-a)',
                        border: '1px solid var(--color-a1)',
                    }}
                >
                    <i className="mdi mdi-close mdi-18px" />
                </div>
            )}
            <div
                id="viewerToolBar"
                style={{
                    position: 'absolute',
                    top: '0px',
                    right: '0px',
                    pointerEvents: 'none',
                    zIndex: 5,
                }}
            ></div>
        </div>
    )
}

export default ViewerPanel
