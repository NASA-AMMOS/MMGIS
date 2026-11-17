import React, { useRef, useEffect, cloneElement } from 'react'
import tippy from 'tippy.js'

function Tooltip({ content, placement = 'right', delay = 200, theme = 'blue', children }) {
    const triggerRef = useRef(null)
    const tippyRef = useRef(null)

    useEffect(() => {
        if (!triggerRef.current || !content) return

        tippyRef.current = tippy(triggerRef.current, {
            content,
            placement,
            theme,
            delay: [delay, 0],
            appendTo: document.body,
        })

        return () => {
            if (tippyRef.current) {
                tippyRef.current.destroy()
                tippyRef.current = null
            }
        }
    }, [content, placement, delay, theme])

    if (!content) return children

    const child = React.Children.only(children)
    return cloneElement(child, {
        ref: (node) => {
            triggerRef.current = node
            const { ref } = child
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
        },
    })
}

export default Tooltip
