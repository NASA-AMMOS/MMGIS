import { getTheme, getThemeNames } from './themes'

let currentThemeName = 'Dark Default'

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
}

export function getCurrentThemeName() {
    return currentThemeName
}

export { getThemeNames, getTheme }
