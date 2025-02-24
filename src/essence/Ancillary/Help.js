import $ from 'jquery'
import Modal from './Modal'
import showdown from 'showdown'

import './Help.css'

showdown.setFlavor('github')

const Help = {
    converter: new showdown.Converter(),
    getComponent: function (helpKey) {
        return `<div id='helpModal_${helpKey}' class='mmgisButton5 mmgisHelpButton' title='Help'><i class='mdi mdi-help-rhombus-outline mdi-18px'></i></div>`
    },
    finalize: function (helpKey) {
        $(`#helpModal_${helpKey}`).on('click', function () {
            $.get(
                `${
                    window.mmgisglobal.ROOT_PATH || ''
                }/public/helps/${helpKey}.md`,
                function (doc) {
                    // prettier-ignore
                    Modal.set(
                    [
                        `<div id='HelpModal'>`,
                            `<div id='HelpModalTitle'>`,
                                `<div><i class='mdi mdi-help-rhombus-outline mdi-18px'></i><div>Help</div></div>`,
                                `<div id='HelpModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                            `</div>`,
                            `<div id='HelpModalContent'>`,
                                Help.converter.makeHtml(doc),
                            `</div>`,
                        `</div>`
                    ].join('\n'),
                    function () {
                        $('#HelpModalClose').on('click', function () {
                            Modal.remove()
                        })
                    }       
                )
                }
            )
        })
    },
}

export default Help
