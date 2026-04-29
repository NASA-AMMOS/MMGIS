/**
 * ConfirmationModal — "Are you sure?" confirmation dialog.
 *
 * Keeps the same imperative API: ConfirmationModal.prompt(message, cb)
 * Internally uses the React-based Modal.
 */
import Modal from './Modal'

import './ConfirmationModal.css'

const ConfirmationModal = {
    finished: false,
    prompt: function (message, cb) {
        ConfirmationModal.finished = false

        // prettier-ignore
        Modal.set(
            [
                `<div id='ConfirmationModal'>`,
                    `<div id='ConfirmationModalTitle'>`,
                        `<div><i class='mdi mdi-help mdi-18px'></i><div>Are You Sure</div></div>`,
                        `<div id='ConfirmationModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='ConfirmationModalContent'>`,
                        `<div>${message}</div>`,
                    `</div>`,
                    `<div id='ConfirmationModalFooter'>`,
                        `<div id='ConfirmationModalNo' class='mmgisButton5'>NO</div>`,
                        `<div id='ConfirmationModalYes' class='mmgisButton5'>YES</div>`,
                    `</div>`,
                `</div>`
            ].join('\n'),
            () => {
                document.getElementById('ConfirmationModalClose')?.addEventListener('click', function () {
                    cb(false)
                    ConfirmationModal.finished = true
                    Modal.remove()
                })
                document.getElementById('ConfirmationModalNo')?.addEventListener('click', function () {
                    cb(false)
                    ConfirmationModal.finished = true
                    Modal.remove()
                })
                document.getElementById('ConfirmationModalYes')?.addEventListener('click', function () {
                    cb(true)
                    ConfirmationModal.finished = true
                    Modal.remove()
                })
            },
            () => {
                if(!ConfirmationModal.finished)
                    cb(false)
                ConfirmationModal.finished = true
            }
        )
    },
}

export default ConfirmationModal
