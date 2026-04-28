import { useEffect } from 'react'
import useUIStore from '../store/uiStore'

/**
 * BottomElementPositioner — a headless React component that reactively
 * positions all non-React bottom-anchored DOM elements based on Zustand
 * store state. Replaces the imperative _repositionBottomElements()
 * function and its raw useUIStore.subscribe() call that previously
 * lived in UserInterfaceBridge.js.
 *
 * Positioned elements (created by jQuery modules, not React):
 *   Desktop: #mapToolBar, .leaflet-control-scalefactor,
 *            #mmgis-map-compass, .leaflet-bottom.leaflet-right,
 *            #CoordinatesDiv, #timeUI
 *   Mobile:  #CoordinatesDiv, #timeUI, #toolbar
 */
function BottomElementPositioner() {
    const pxIsTools = useUIStore((s) => s.pxIsTools)
    const isMobile = useUIStore((s) => s.isMobile)
    const timeUIActive = useUIStore((s) => s.timeUIActive)
    const timeUIExpanded = useUIStore((s) => s.timeUIExpanded)
    const toolPanelWidth = useUIStore((s) => s.toolPanelWidth)

    useEffect(() => {
        // Smooth transition matching the horizontal tools ease-out
        const ease = 'bottom 0.2s ease-out, left 0.2s ease-out'
        // For #timeUI, preserve the CSS opacity/pointer-events transition
        // (all 0.2s ease-in from TimeUI.css) while adding the bottom
        // transition for tool open/close animation.
        const timeUIEase = 'all 0.2s ease-in, bottom 0.4s ease-out'

        // Base left offset: 12px permanent push + tool panel width
        const leftOffset = 12 + toolPanelWidth

        if (isMobile) {
            // Mobile: reposition toolbar, coordinates, timeUI above tools
            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) {
                coordsDiv.style.transition = ease
                coordsDiv.style.bottom = pxIsTools + 'px'
            }
            const timeUIEl = document.getElementById('timeUI')
            if (timeUIEl) {
                timeUIEl.style.transition = timeUIEase
                timeUIEl.style.bottom = pxIsTools + 'px'
            }
            const toolbar = document.getElementById('toolbar')
            if (toolbar) {
                toolbar.style.transition = ease
                toolbar.style.bottom = pxIsTools + 'px'
            }
        } else {
            // Desktop: compute bottom offsets from TimeUI state
            // timeUIHeight: full height of TimeUI when active
            //   - expanded (via chevron or defaultExpanded): 177px
            //   - not expanded: 40px
            //   - inactive: 0px
            const timeUIHeight = timeUIActive
                ? (timeUIExpanded ? 177 : 40)
                : 0
            // newBottom: what bottom-positioned elements should use
            // When TimeUI is active, this is timeUIHeight.
            // When inactive, elements sit at 0 (above tools area only).
            const newBottom = timeUIActive ? timeUIHeight : 0

            const mapToolBar = document.getElementById('mapToolBar')
            if (mapToolBar) {
                mapToolBar.style.transition = ease
                mapToolBar.style.bottom = (pxIsTools + newBottom) + 'px'
                mapToolBar.style.left = (leftOffset + 12) + 'px'
            }

            // Position the scalefactor control directly
            const scaleFactor = document.querySelector('.leaflet-control-scalefactor')
            if (scaleFactor) {
                scaleFactor.style.transition = ease
                scaleFactor.style.bottom = (pxIsTools + 48) + 'px'
                scaleFactor.style.left = leftOffset + 'px'
            }

            // Compass positioned above scalefactor
            const compass = document.getElementById('mmgis-map-compass')
            if (compass) {
                compass.style.transition = ease
                compass.style.bottom = (pxIsTools + 38) + 'px'
                compass.style.left = leftOffset + 'px'
            }

            const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right')
            if (leafletBottomRight) {
                leafletBottomRight.style.transition = ease
                leafletBottomRight.style.bottom = (pxIsTools + newBottom) + 'px'
            }

            const coordsDiv = document.getElementById('CoordinatesDiv')
            if (coordsDiv) {
                coordsDiv.style.transition = ease
                coordsDiv.style.bottom = (pxIsTools + newBottom) + 'px'
            }

            const timeUIEl = document.getElementById('timeUI')
            if (timeUIEl) {
                timeUIEl.style.transition = timeUIEase
                timeUIEl.style.bottom = pxIsTools + 'px'
            }
        }
    }, [pxIsTools, isMobile, timeUIActive, timeUIExpanded, toolPanelWidth])

    // Renders nothing — this is a side-effect-only component
    return null
}

export default BottomElementPositioner
