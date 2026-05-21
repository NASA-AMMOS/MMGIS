import DOMPurify from 'dompurify'

export function safeHTML(untrusted) {
    return DOMPurify.sanitize(untrusted, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'div', 'p', 'ul', 'li'],
        ALLOWED_ATTR: ['class', 'style', 'id'],
    })
}
