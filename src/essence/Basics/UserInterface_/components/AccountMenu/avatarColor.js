// Stable color per username, dark enough for white text
export function avatarColor(name) {
    let h = 0
    for (const c of String(name || ''))
        h = (c.charCodeAt(0) + ((h << 5) - h)) | 0
    return `hsl(${Math.abs(h) % 360}, 55%, 40%)`
}
