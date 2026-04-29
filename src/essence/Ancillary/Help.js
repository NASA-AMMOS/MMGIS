/**
 * Help — renders a help button that opens a markdown help modal.
 *
 * Same imperative API as before:
 *   Help.getComponent(helpKey) → HTML string for the button
 *   Help.finalize(helpKey)     → binds the click handler
 */
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
        const btn = document.getElementById(`helpModal_${helpKey}`)
        if (!btn) return

        btn.addEventListener('click', function () {
            const baseUrl = `${window.location.origin}${(
                window.location.pathname || ''
            ).replace(/\/$/g, '')}/public/helps/${helpKey}.md`

            fetch(baseUrl)
                .then((res) => res.text())
                .then((doc) => {
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
                            document.getElementById('HelpModalClose')?.addEventListener('click', function () {
                                Modal.remove()
                            })
                        }
                    )
                })
                .catch(() => {})
        })
    },
}

export default Help
