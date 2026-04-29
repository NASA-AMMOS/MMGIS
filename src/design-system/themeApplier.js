/**
 * Imperatively applies theme colors to jQuery-managed DOM elements.
 * Subscribes to the Zustand uiStore and re-applies whenever the theme changes.
 *
 * This bridges the gap between the React useTheme() hook (for React components)
 * and the jQuery-rendered elements (Toolbar, floating panels, map controls).
 */
import uiStore from '../essence/Basics/UserInterface_/store/uiStore'
import { getTheme } from './themes'
import { hexToRgba } from './useTheme'

let lastThemeName = null

function applyThemeToDOM(themeName) {
    if (themeName === lastThemeName) return
    lastThemeName = themeName

    const t = getTheme(themeName)
    const a = (varName, alpha) => hexToRgba(t[varName], alpha)

    // --- Toolbar (solid) ---
    const toolbar = document.getElementById('toolbar')
    if (toolbar) {
        toolbar.style.background = t['--color-a']
        toolbar.style.borderRight = `1px solid ${t['--color-a1']}`
    }

    // --- Toolbar buttons ---
    document.querySelectorAll('#toolbar .toolButton').forEach((btn) => {
        if (!btn.classList.contains('active') && !btn.classList.contains('toolButtonActivated')) {
            btn.style.color = t['--color-a3']
        }
    })
    document.querySelectorAll('#toolbar .toolButton.active, #toolbar .toolButtonActivated').forEach((btn) => {
        btn.style.background = t['--color-accent-active']
        btn.style.color = t['--color-c']
    })
    document.querySelectorAll('#toolbar .toolSep').forEach((btn) => {
        btn.style.color = t['--color-c']
    })
    document.querySelectorAll('.toolSepDivider').forEach((el) => {
        el.style.background = t['--color-a2']
    })

    // NOTE: #bottomFloatingBar and #toolPanel are now styled via CSS Modules
    // (SplitScreens.module.css and ToolPanel.module.css) using CSS custom properties.

    // --- TimeUI ---
    const timeUI = document.getElementById('timeUI')
    if (timeUI) {
        timeUI.style.background = a('--color-a', 0.92)
        timeUI.style.borderTop = `1px solid ${t['--color-a1']}`
    }

    // --- Coordinate display ---
    document.querySelectorAll('#CoordinatesDiv .mouseLngLat, #CoordinatesDiv .mouseLngLatPicking').forEach((el) => {
        el.style.background = a('--color-a', 0.88)
        el.style.border = `1px solid ${t['--color-a1']}`
    })

    // --- Map compass ---
    const compass = document.getElementById('mmgis-map-compass')
    if (compass) {
        compass.style.background = a('--color-a', 0.88)
        compass.style.border = `1px solid ${t['--color-a1']}`
    }

    // --- Zoom controls (solid, matching topbar/toolbar) ---
    document.querySelectorAll('.leaflet-control-zoom').forEach((el) => {
        el.style.background = t['--color-a']
        el.style.border = `1px solid ${t['--color-a1']}`
    })
    document.querySelectorAll('.leaflet-control-zoom a').forEach((el) => {
        el.style.color = t['--color-c']
        el.style.borderBottom = `1px solid ${t['--color-a1']}`
    })
    // --- Home button (solid) ---
    document.querySelectorAll('.leaflet-control-zoom-home').forEach((el) => {
        el.style.background = t['--color-a']
        el.style.color = t['--color-c']
    })

    // --- Scalefactor goto (solid) ---
    document.querySelectorAll('.leaflet-control-scalefactor-goto').forEach((el) => {
        el.style.background = t['--color-a']
        el.style.border = `1px solid ${t['--color-a1']}`
    })

    // --- Separated tool panels (Legend, etc.) ---
    document.querySelectorAll('#toolcontroller_sep_content > div').forEach((el) => {
        el.style.background = a('--color-a', 0.88)
        el.style.border = `1px solid ${t['--color-a1']}`
    })
    // Separated tool content text
    document.querySelectorAll('#toolcontroller_sep_content .mmgisScrollbar, #toolcontroller_sep_content label, #toolcontroller_sep_content span, #toolcontroller_sep_content div').forEach((el) => {
        if (!el.style.color || el.style.color === 'white' || el.style.color === '#fff' || el.style.color === 'rgb(255, 255, 255)') {
            el.style.color = t['--color-f']
        }
    })

    // --- Attributions ---
    const attr = document.getElementById('mmgis-attributions')
    if (attr) {
        attr.style.background = a('--color-a', 0.6)
    }

    // --- Close X buttons injected into tools ---
    document.querySelectorAll('.tool-close-x').forEach((el) => {
        el.style.color = t['--color-a3']
    })

    // --- ToolsWrapper (no border) ---
    const toolsWrapper = document.getElementById('toolsWrapper')
    if (toolsWrapper) {
        toolsWrapper.style.borderBottom = 'none'
    }

    // NOTE: #topBar, #topBarTitleName, and #topBarRight icons are now styled
    // via CSS Modules (TopBar.module.css, UserInterfaceLayout.module.css)
    // using CSS custom properties.

    // --- Separated tool panel headers ---
    document.querySelectorAll('.sep-tool-header').forEach((el) => {
        el.style.borderBottom = `1px solid ${t['--color-a1']}`
        el.style.color = t['--color-a4']
    })
    document.querySelectorAll('.sep-tool-header span').forEach((el) => {
        el.style.color = t['--color-f']
    })

    // --- MMGIS logo SVG fill ---
    const logoPath = document.querySelector('#mmgislogo svg path')
    if (logoPath) {
        logoPath.setAttribute('fill', t['--color-mmgis'])
    }

    // --- Issue #10: Text color contrast for light themes ---
    // CoordinatesDiv text
    document.querySelectorAll('#CoordinatesDiv, #CoordinatesDiv *').forEach((el) => {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return
        el.style.color = t['--color-f']
    })
    // NOTE: #topBarMain color is now handled via CSS custom properties in CSS Modules.
    // TimeUI buttons (follow feature, expand)
    const timeUIFollow = document.getElementById('mmgisTimeUIFollowFeature')
    if (timeUIFollow) {
        timeUIFollow.style.color = t['--color-a3']
    }
    const timeUIExpand = document.getElementById('mmgisTimeUIExpand')
    if (timeUIExpand) {
        timeUIExpand.style.color = t['--color-a3']
    }
    // TimeUI mode, end-time, start-time text
    document.querySelectorAll('#mmgisTimeUIMode, #mmgisTimeUIStartTime, #mmgisTimeUIEndTime, #mmgisTimeUIRelativeTime').forEach((el) => {
        el.style.color = t['--color-f']
    })
    // DrawTool filter options and file names
    document.querySelectorAll('#drawToolDrawFilterOptions, #drawToolDrawFilterOptions *, .drawToolDrawFilesListElem, .drawToolDrawFilesListElem *, #drawToolDrawFilter').forEach((el) => {
        el.style.color = t['--color-f']
    })
    // DrawTool nav tabs
    document.querySelectorAll('#drawToolNav .drawToolNavButton').forEach((el) => {
        if (!el.classList.contains('active')) {
            el.style.color = t['--color-a3']
        }
    })

    // --- Issue #11: TimeUI timeline colors ---
    const timeUITimeline = document.getElementById('mmgisTimeUITimeline')
    if (timeUITimeline) {
        timeUITimeline.style.background = t['--color-a-5']
        timeUITimeline.style.borderTop = `1px solid ${t['--color-a1']}`
    }
    document.querySelectorAll('.mmgisTimeUITimelineLabel, .mmgisTimeUITimelineTick').forEach((el) => {
        el.style.color = t['--color-a3']
    })
    document.querySelectorAll('#mmgisTimeUITimelineInner').forEach((el) => {
        el.style.background = t['--color-a-5']
    })
    // TimeUI controls area
    document.querySelectorAll('#mmgisTimeUIControls').forEach((el) => {
        el.style.background = a('--color-a', 0.92)
        el.style.color = t['--color-f']
    })
}

/**
 * Start listening for theme changes and apply to DOM.
 * Call once during app init (e.g., in UserInterfaceBridge).
 */
export function initThemeApplier() {
    applyThemeToDOM(uiStore.getState().themeName)

    uiStore.subscribe((state) => {
        applyThemeToDOM(state.themeName)
    })
}

/**
 * Force a re-apply of the current theme to all DOM elements.
 * Useful after new elements are created (e.g., tool panel open, map control added).
 */
export function refreshThemeDOM() {
    lastThemeName = null
    applyThemeToDOM(uiStore.getState().themeName)
}

export default initThemeApplier
