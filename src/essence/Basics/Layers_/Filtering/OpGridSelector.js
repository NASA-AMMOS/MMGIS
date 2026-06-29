// Compact grid-based operator selector for the Filtering tool.
// Renders a trigger button showing the current selection and a
// fixed-position popup grid that escapes ancestor overflow clipping.

import $ from 'jquery'

import './OpGridSelector.css'

let activePopup = null
let scrollHandler = null
let clickHandler = null

function closeActivePopup() {
    if (activePopup) {
        activePopup.remove()
        activePopup = null
    }
    if (scrollHandler) {
        document.removeEventListener('scroll', scrollHandler, true)
        scrollHandler = null
    }
    if (clickHandler) {
        document.removeEventListener('mousedown', clickHandler, true)
        clickHandler = null
    }
}

/**
 * Initialize an operator grid selector.
 * @param {jQuery} $container - The container element to render into
 * @param {Array} items - Array of { html, title } for each grid cell
 * @param {number} selectedIdx - Initially selected index
 * @param {object} opts - { columns, onSelect }
 *   columns: number of grid columns (default 4)
 *   onSelect(idx): callback fired when an item is selected
 */
function init($container, items, selectedIdx, opts = {}) {
    const columns = opts.columns || 4
    const onSelect = opts.onSelect || (() => {})

    let currentIdx = selectedIdx

    // Render trigger button showing current selection
    const triggerHtml = `<div class="op-grid-trigger">${items[currentIdx].html}</div>`
    $container.html(triggerHtml)

    const $trigger = $container.find('.op-grid-trigger')

    $trigger.on('click', function (e) {
        e.stopPropagation()

        // If this popup is already open, close it
        if (activePopup && activePopup.data('owner') === $container[0]) {
            closeActivePopup()
            return
        }

        // Close any other open popup
        closeActivePopup()

        // Build grid popup
        let gridHtml = `<div class="op-grid-popup" style="grid-template-columns: repeat(${columns}, 1fr);">`
        for (let i = 0; i < items.length; i++) {
            const selectedClass = i === currentIdx ? ' op-grid-item--selected' : ''
            gridHtml += `<div class="op-grid-item${selectedClass}" data-idx="${i}" title="${items[i].title}">${items[i].html}</div>`
        }
        gridHtml += '</div>'

        const $popup = $(gridHtml)
        $popup.data('owner', $container[0])
        $('body').append($popup)
        activePopup = $popup

        // Position: fixed relative to trigger
        const bcr = $trigger[0].getBoundingClientRect()
        const openDown = bcr.top < window.innerHeight / 2

        $popup.css({
            position: 'fixed',
            left: bcr.left,
            zIndex: 10000,
        })

        if (openDown) {
            $popup.css('top', bcr.bottom + 2)
        } else {
            // Measure popup height then position above trigger
            $popup.css({ top: 0, visibility: 'hidden' })
            const popupHeight = $popup.outerHeight()
            $popup.css({
                top: bcr.top - popupHeight - 2,
                visibility: 'visible',
            })
        }

        // Item click
        $popup.on('click', '.op-grid-item', function () {
            const idx = parseInt($(this).attr('data-idx'), 10)
            currentIdx = idx
            $trigger.html(items[idx].html)
            onSelect(idx)
            closeActivePopup()
        })

        // Close on scroll (capture phase catches nested scrollables)
        scrollHandler = () => closeActivePopup()
        document.addEventListener('scroll', scrollHandler, true)

        // Close on outside click
        clickHandler = (evt) => {
            if (
                activePopup &&
                !activePopup[0].contains(evt.target) &&
                !$trigger[0].contains(evt.target)
            ) {
                closeActivePopup()
            }
        }
        // Delay to avoid catching the current click
        setTimeout(() => {
            document.addEventListener('mousedown', clickHandler, true)
        }, 0)
    })
}

// Clean up any open popup (call on destroy)
function destroy() {
    closeActivePopup()
}

export default { init, destroy }
