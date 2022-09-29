import $ from 'jquery'
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
                $('#ConfirmationModalClose').on('click', function () {
                    cb(false)
                    ConfirmationModal.finished = true
                    Modal.remove()
                })
                $('#ConfirmationModalNo').on('click', function () {
                    cb(false)
                    ConfirmationModal.finished = true
                    Modal.remove()
                })
                $('#ConfirmationModalYes').on('click', function () {
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
