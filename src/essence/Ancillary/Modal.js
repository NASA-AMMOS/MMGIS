//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'

import './Modal.css'

const Modal = {
    _onRemoveCallback: null,
    set: function (html, onAddCallback, onRemoveCallback) {
        if ($('#mmgisModal')) $('#mmgisModal').remove()
        // prettier-ignore
        $('body').append([
            "<div id='mmgisModal'>",
                "<div id='mmgisModalClose'><i class='mdi mdi-close mdi-24px'></i></div>",
                "<div id='mmgisModalInner'>",
                html,
                "</div>",
            "</div>"
        ].join('\n'))

        if (typeof onAddCallback === 'function') onAddCallback('mmgisModal')

        $('#mmgisModal').on('click', function () {
            Modal.remove()
        })
        $('#mmgisModalInner').on('click', function (e) {
            e.stopPropagation()
        })

        $('#main-container').css({ filter: 'blur(3px)' })
        $('#mmgisModal').animate(
            {
                opacity: 1,
            },
            500
        )

        if (typeof onRemoveCallback === 'function')
            Modal._onRemoveCallback = onRemoveCallback
        else Modal._onRemoveCallback = null
    },
    //Remove everything CursorInfo created
    remove: function (isImmediate) {
        const time = isImmediate ? 0 : 500

        if (typeof Modal._onRemoveCallback === 'function')
            Modal._onRemoveCallback()
        Modal._onRemoveCallback = null

        $('#main-container').css({ filter: 'blur(0px)' })
        $('#mmgisModal').animate(
            {
                opacity: 0,
            },
            time,
            function () {
                $('#mmgisModal').remove()
            }
        )
    },
}

export default Modal
