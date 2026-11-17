import { useState, useEffect } from 'react'
import uiStore from '../essence/Basics/UserInterface_/store/uiStore'
import { getTheme } from './themes'

/**
 * Converts a hex color string to an rgba string with the given alpha.
 * e.g. hexToRgba('#1d1f20', 0.88) => 'rgba(29,31,32,0.88)'
 */
export function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return hex
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

/**
 * React hook that returns the current theme object.
 * Re-renders the component when the theme changes.
 * Compatible with React 16+ (uses useState + useEffect instead of useSyncExternalStore).
 */
export function useTheme() {
    const [themeName, setThemeName] = useState(uiStore.getState().themeName)

    useEffect(() => {
        const unsub = uiStore.subscribe((state) => {
            setThemeName(state.themeName)
        })
        return unsub
    }, [])

    const themeObj = getTheme(themeName)

    const result = { ...themeObj }
    result.alpha = (varName, a) => hexToRgba(result[varName], a)

    return result
}

/**
 * Non-React helper: get the current theme object with alpha helper.
 * For use in jQuery/imperative code.
 */
export function getCurrentTheme() {
    const themeObj = getTheme(uiStore.getState().themeName)
    const result = { ...themeObj }
    result.alpha = (varName, a) => hexToRgba(result[varName], a)
    return result
}

export default useTheme
