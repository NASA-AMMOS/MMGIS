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

    // --- Tool panel ---
    const toolPanel = document.getElementById('toolPanel')
    if (toolPanel) {
        toolPanel.style.background = a('--color-a', 0.88)
    }

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

    // --- Zoom controls ---
    document.querySelectorAll('.leaflet-control-zoom').forEach((el) => {
        el.style.background = a('--color-a', 0.88)
        el.style.border = `1px solid ${t['--color-a1']}`
    })
    document.querySelectorAll('.leaflet-control-zoom a').forEach((el) => {
        el.style.color = t['--color-c']
        el.style.borderBottom = `1px solid ${t['--color-a1']}`
    })

    // --- Scalefactor goto ---
    document.querySelectorAll('.leaflet-control-scalefactor-goto').forEach((el) => {
        el.style.background = a('--color-a', 0.88)
        el.style.border = `1px solid ${t['--color-a1']}`
    })

    // --- Separated tool panels (Legend, etc.) ---
    document.querySelectorAll('#toolcontroller_sep_content > div').forEach((el) => {
        el.style.background = a('--color-a', 0.88)
        el.style.border = `1px solid ${t['--color-a1']}`
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

    // --- TopBar title ---
    const titleName = document.getElementById('topBarTitleName')
    if (titleName) {
        titleName.style.color = t['--color-a4']
    }

    // --- TopBar right icons ---
    document.querySelectorAll('#topBarRight > i').forEach((el) => {
        el.style.color = t['--color-a3']
    })

    // --- Separated tool panel headers ---
    document.querySelectorAll('.sep-tool-panel-header').forEach((el) => {
        el.style.borderBottom = `1px solid ${t['--color-a1']}`
        el.style.color = t['--color-a4']
    })

    // --- MMGIS logo SVG fill ---
    const logoPath = document.querySelector('#mmgislogo svg path')
    if (logoPath) {
        logoPath.setAttribute('fill', t['--color-mmgis'])
    }
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
