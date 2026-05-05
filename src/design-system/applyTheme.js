import { getTheme, getThemeNames } from './themes'

let currentThemeName = 'Dark Default'

function hexToRgb(hex) {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    const num = parseInt(hex, 16)
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
}

export function applyTheme(themeName) {
    const theme = getTheme(themeName)
    if (!theme) return

    currentThemeName = themeName
    const root = document.documentElement

    Object.entries(theme).forEach(([key, value]) => {
        if (key.startsWith('--')) {
            root.style.setProperty(key, value)
        }
    })

    // Derive --color-a-rgb for semi-transparent modal backgrounds
    const colorA = theme['--color-a']
    if (colorA && colorA.startsWith('#')) {
        root.style.setProperty('--color-a-rgb', hexToRgb(colorA))
    }
}

export function getCurrentThemeName() {
    return currentThemeName
}

export { getThemeNames, getTheme }
