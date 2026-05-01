import { useEffect } from 'react'
import useUIStore from '../../store/uiStore'

/**
 * BottomElementPositioner — a headless React component that reactively
 * positions all non-React bottom-anchored DOM elements based on Zustand
 * store state.
 *
 * With the bottom floating bar architecture (PR #47 style), #timeUI is
 * reparented into #bottomFloatingBar. The bar's total height drives
 * offsets for map controls, compass, coordinates, etc.
 */
function BottomElementPositioner() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const isMobile = useUIStore((s) => s.isMobile)
    const timeUIActive = useUIStore((s) => s.timeUIActive)
    const timeUIExpanded = useUIStore((s) => s.timeUIExpanded)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)
    const topSize = useUIStore((s) => s.topSize)
    const isDragging = useUIStore((s) => s.isDraggingSplitter)

    useEffect(() => {
        const ease = isDragging ? 'none' : 'bottom 0.3s ease-out, left 0.3s ease-out'

        if (isMobile) {
            const toolbarH = 40
            const toolsH = pxIsTools || 0

            // Scalebar/compass stay fixed above the toolbar at rest (40px).
            // They don't shift up when a tool panel opens.
            const mapControlOffset = toolbarH

            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) {
                coordsDiv.style.transition = ease
                coordsDiv.style.bottom = toolsH + 'px'
            }
            const toolbar = document.getElementById('toolbar')
            if (toolbar) {
                toolbar.style.transition = ease
                toolbar.style.bottom = toolsH + 'px'
            }
            const mapToolBar = document.getElementById('mapToolBar')
            if (mapToolBar) {
                mapToolBar.style.transition = ease
                mapToolBar.style.bottom = mapControlOffset + 'px'
            }
            const leafletBottomLeft = document.querySelector('.leaflet-bottom.leaflet-left')
            if (leafletBottomLeft) {
                leafletBottomLeft.style.transition = ease
                leafletBottomLeft.style.bottom = mapControlOffset + 'px'
            }
            const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right')
            if (leafletBottomRight) {
                leafletBottomRight.style.transition = ease
                leafletBottomRight.style.bottom = mapControlOffset + 'px'
            }
        } else {
            // Calculate target bar height from known state
            const toolsH = pxIsTools || 0
            const timeUIDockH = timeUIActive ? (timeUIExpanded ? 177 : 40) : 0
            const barBorderH = (toolsH > 0 || timeUIDockH > 0) ? 2 : 0
            const targetBarHeight = toolsH + timeUIDockH + barBorderH

            const barBottom = 12
            const isBarVisible = timeUIActive || toolsH > 0
            const totalOffset = isBarVisible ? (targetBarHeight + barBottom) : 0

            // Left offset from vertical tool panel
            const tpShift = toolPanelWidth || 0

            const mapToolBar = document.getElementById('mapToolBar')
            if (mapToolBar) {
                mapToolBar.style.transition = ease
                mapToolBar.style.bottom = totalOffset + 'px'
                mapToolBar.style.left = (12 + tpShift) + 'px'
            }

            // Compass and scalefactor are both inside .leaflet-bottom.leaflet-left
            // and use position:absolute relative to that container — they move with it.

            const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right')
            if (leafletBottomRight) {
                leafletBottomRight.style.transition = ease
                leafletBottomRight.style.bottom = totalOffset + 'px'
            }

            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) {
                coordsDiv.style.transition = ease
                coordsDiv.style.bottom = (totalOffset + 12) + 'px'
            }

            const photoAz = document.getElementById('photosphereAzIndicator')
            if (photoAz) {
                photoAz.style.transition = ease
                photoAz.style.bottom = totalOffset + 'px'
            }

            const lithoControls = document.getElementById('_lithosphere_controls_bottomleft')
            if (lithoControls) {
                lithoControls.style.transition = ease
                lithoControls.style.bottom = (totalOffset + 10) + 'px'
            }

            // Leaflet bottom-left controls (scalebar, etc.)
            const leafletBottomLeft = document.querySelector('.leaflet-bottom.leaflet-left')
            if (leafletBottomLeft) {
                leafletBottomLeft.style.transition = ease
                leafletBottomLeft.style.bottom = totalOffset + 'px'
                leafletBottomLeft.style.left = (12 + tpShift) + 'px'
            }

            // Adjust vertical tool panel height so it doesn't overlap the bottom bar
            const toolPanel = document.getElementById('toolPanel')
            if (toolPanel) {
                const panelBottom = totalOffset > 0 ? (totalOffset + 12) : 12
                toolPanel.style.height = `calc(100% - ${topSize + 12 + panelBottom}px)`
            }
            const toolPanelDrag = document.getElementById('toolPanelDrag')
            if (toolPanelDrag) {
                const panelBottom = totalOffset > 0 ? (totalOffset + 12) : 12
                toolPanelDrag.style.height = `calc(100% - ${topSize + 12 + panelBottom}px)`
            }

            // Push separated tool content panels (Legend, etc.) right of vertical tool panel
            const sepContent = document.getElementById('toolcontroller_sep_content')
            if (sepContent) {
                sepContent.style.transition = 'left 0.2s ease-out'
                sepContent.style.left = (12 + tpShift + (tpShift > 0 ? 12 : 0)) + 'px'
            }
        }
    }, [pxIsTools, isMobile, timeUIActive, timeUIExpanded, toolPanelWidth, topSize, isDragging])

    return null
}

export default BottomElementPositioner
