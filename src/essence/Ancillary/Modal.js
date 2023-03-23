//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'

import './Modal.css'

const Modal = {
    _onRemoveCallback: {},
    _activeModalIds: {},
    set: function (html, onAddCallback, onRemoveCallback, modalId) {
        modalId = modalId || 0
        Modal._activeModalIds[modalId] = true
        const id = `mmgisModal_${modalId}`
        const elmId = `#${id}`
        if ($(elmId)) $(elmId).remove()
        // prettier-ignore
        $('body').append([
            `<div id='${id}' class='mmgisModal dontCloseWhenClicked'>`,
                "<div id='mmgisModalClose'><i class='mdi mdi-close mdi-24px'></i></div>",
                "<div id='mmgisModalInner'>",
                html,
                "</div>",
            "</div>"
        ].join('\n'))

        if (typeof onAddCallback === 'function') onAddCallback(id)

        $(elmId).on('click', (e) => {
            if (!$(e.target).parents().hasClass('dontCloseWhenClicked'))
                Modal.remove(false, modalId)
        })

        $('#main-container').css({
            filter: `blur(${3 * Object.keys(Modal._activeModalIds).length}px)`,
        })
        $(elmId).animate(
            {
                opacity: 1,
            },
            500
        )

        if (typeof onRemoveCallback === 'function')
            Modal._onRemoveCallback[modalId] = onRemoveCallback
        else Modal._onRemoveCallback[modalId] = null
    },
    //Remove everything CursorInfo created
    remove: function (isImmediate, modalId) {
        modalId = modalId || 0
        const elmId = `#mmgisModal_${modalId}`
        const time = isImmediate ? 0 : 500

        if (typeof Modal._onRemoveCallback[modalId] === 'function')
            Modal._onRemoveCallback[modalId]()
        Modal._onRemoveCallback[modalId] = null

        $('#main-container').css({
            filter: `blur(${
                3 * (Object.keys(Modal._activeModalIds).length - 1)
            }px)`,
        })
        $(elmId).animate(
            {
                opacity: 0,
            },
            time,
            function () {
                $(elmId).remove()

                delete Modal._activeModalIds[modalId]
            }
        )
    },
}

export default Modal
