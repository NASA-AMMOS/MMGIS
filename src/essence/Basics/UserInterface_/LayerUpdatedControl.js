import $ from 'jquery'
import * as d3 from 'd3'

import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_.js'
import Modal from '../../Ancillary/Modal'
import ConfirmationModal from '../../Ancillary/ConfirmationModal'

import tippy from 'tippy.js'

import './LayerUpdatedControl.css'

const BUTTON_TYPES = {
    RELOAD: {
        html: '<i class="mdi mdi-reload-alert mdi-18p"></i>',
        title: 'Reload MMGIS',
    },
    ADD_LAYER: {
        html: '<i class="mdi mdi-reload mdi-18p"></i>',
        title: 'Click to see updated layers',
    },
    DISCONNECTED: {
        html: '<i class="mdi mdi-alert-outline mdi-18p"></i>',
        title: 'WebSocket connection closed',
    },
}

// Inspired by https://github.com/Leaflet/Leaflet/blob/main/src/control/Control.Zoom.js
var LayerUpdatedControl = L.Control.extend({
    options: {
        position: 'topright',
        type: 'ADD_LAYER',
    },
    onAdd: function (map) {
        var className = 'leaflet-control-update-layer'

        if (L_.configData.look && L_.configData.look.zoomcontrol) {
            className += ' leaflet-control-update-layer-0-margin'
        } else {
            className += ' leaflet-control-update-layer-40-margin'
        }

        var container = L.DomUtil.create('div', className + ' leaflet-bar')
        var options = this.options
        var tooltipText = BUTTON_TYPES[options.type].title

        if (options.type === 'ADD_LAYER') {
            this._click = this._clickAddLayer
        } else if (options.type === 'RELOAD') {
            this._click = this._clickReload
        } else {
            this._click = this._clickReload
        }

        this._updateLayerButton = this._createButton(
            BUTTON_TYPES[options.type].html,
            tooltipText,
            'leaflet-control-update-layer-icon',
            container,
            this._click
        )

        L.DomUtil.addClass(this._updateLayerButton, options.type)

        if (
            options.type === 'ADD_LAYER' &&
            L_.addLayerQueue &&
            L_.addLayerQueue.length > 0
        ) {
            // The icon shows the correct number of new layers waiting to be added
            var number = L.DomUtil.create(
                'span',
                'update-layer-icon-text',
                this._updateLayerButton
            )
            number.innerHTML = L_.addLayerQueue.length
            if (L_.addLayerQueue.length > 9) {
                number.innerHTML = '+'
                L.DomUtil.addClass(number, 'plus')
            }
        }

        // Can't find an afterAdd function. Hate doing this but it works
        setTimeout(() => {
            tippy(`.${options.type} `, {
                content: tooltipText,
                placement: 'left',
                theme: 'blue',
            })
        }, 1500)

        return container
    },
    onRemove: function (map) {
        L.DomEvent.off(this._updateLayerButton, 'click', this._click)

        L.DomUtil.remove(this._updateLayerButton)
        this._updateLayerButton.setAttribute('aria-disabled', 'false')
    },
    _createButton: function (html, title, className, container, fn) {
        var link = L.DomUtil.create('a', className, container)
        link.innerHTML = html
        link.href = '#'

        link.setAttribute('role', 'button')
        link.setAttribute('aria-label', title)

        L.DomEvent.disableClickPropagation(link)
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
        L.DomEvent.on(link, 'click', fn, this)

        return link
    },
    _clickAddLayer: function (e) {
        this._showModal()
    },
    _clickReload: function (e) {
        ConfirmationModal.prompt(
            'Do you want to reload MMGIS to receive new updates?',
            (isYes) => {
                if (isYes) location.reload()
            }
        )
    },
    _showModal: function () {
        let table = [
            `<table class="table" style="text-align: left;">`,
            `<tr style="font-width: bold">`,
            `<th style="column-width: 100px">Action</th>`,
            `<th>Layer name</th>`,
            `</tr>`,
        ]

        for (let i in L_.addLayerQueue) {
            const { data, newLayerName, type } = L_.addLayerQueue[i]
            const typePrettify = type.split(/(?=[A-Z])/).map((e) => {
                return e.charAt(0).toUpperCase() + e.slice(1).toLowerCase()
            })

            table = table.concat([
                `<tr>`,
                `<td style="column-width: 100px">${typePrettify.join(
                    ' '
                )}</td>`,
                `<td>${newLayerName}</td>`,
                `</tr>`,
            ])
        }
        table.push(`</table>`)

        // prettier-ignore
        let modalContent = [
            `<div id='mainSettingsModal'>`,
                `<div id='mainSettingsModalTitle'>`,
                    `<div><i class='mdi mdi-reload mdi-18px'></i><div>Update map layers</div></div>`,
                    `<div id='mainSettingsModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                `</div>`,
                `<div id='update-modal-content'>`,
                    `<div class='update-modal-section'>`,
                        `<div class='update-modal-section-title'>The following changes can be updated:</div>`,
                        `<div class='update-modal-table-container'>`,
                        ...table,
                        `</div>`,
                        `<div id='update-modal-actions'>`,
                            `<div class='update-modal-flex'>`,
                                `<div class='drawToolFileCancel drawToolButton1'>Cancel</div>`,
                                `<div class='drawToolFileSave drawToolButton1'>Update</div>`,
                            `</div>`,
                        `</div>`,
                    `</div>`,
                `</div>`,
            `</div>`
        ].join('\n');

        Modal.set(
            modalContent,
            function () {
                // Save
                $('.drawToolFileSave').on('click', function () {
                    Modal.remove()

                    L_.updateQueueLayers()

                    // Destroy self
                    L_.UserInterface_.removeLayerUpdateButton()
                })

                // Cancel
                $('.drawToolFileCancel').on('click', function () {
                    Modal.remove()
                })

                // Close
                $('#mainSettingsModalClose').on('click', function () {
                    Modal.remove()
                })
            },
            function () {}
        )
    },
})

export default LayerUpdatedControl
