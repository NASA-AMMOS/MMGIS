import DOMPurify from 'dompurify'

export function safeHTML(untrusted) {
    return DOMPurify.sanitize(untrusted, {
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'span', 'br', 'div', 'p', 'ul', 'ol',
            'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote',
            'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th',
            'td', 'hr', 'del', 's', 'sub', 'sup',
        ],
        ALLOWED_ATTR: [
            'class', 'style', 'id', 'href', 'title', 'target', 'rel',
            'colspan', 'rowspan',
        ],
    })
}

// Returns the url if it is http(s) (absolute or relative), otherwise null
export function safeLinkUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') return null
    try {
        const protocol = new URL(url, window.location.href).protocol
        if (protocol !== 'http:' && protocol !== 'https:') return null
    } catch (e) {
        return null
    }
    return url.trim()
}
