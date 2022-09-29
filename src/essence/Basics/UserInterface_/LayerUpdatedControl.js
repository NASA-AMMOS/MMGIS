import $ from 'jquery'
import * as d3 from 'd3'

import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_.js'
import CursorInfo from '../../Ancillary/CursorInfo'
import Modal from '../../Ancillary/Modal'


import './LayerUpdatedControl.css'

const BUTTON_TYPES = {
    RELOAD: {
        html: '<i class="mdi mdi-reload-alert mdi-18p"></i>',
        title: 'Reload the entire MMGIS page',
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
        var container = L.DomUtil.create('div', className + ' leaflet-bar')
        var options = this.options
        var tooltipText = BUTTON_TYPES[options.type].title

        if (L_.addLayerQueue && L_.addLayerQueue.length > 0 && L_.addLayerQueue.length < 3) {
            tooltipText = `${tooltipText} '${L_.addLayerQueue[0].newLayerName}'`
        }

        if (ToolController_.toolModules['LayersTool']
                && ToolController_.toolModules['LayersTool'].orderingHistory.length > 0) {
            tooltipText += '; Layers have been reordered but will be reset after the new layer is added'
        }

        if (options.type === 'ADD_LAYER') {
            this._click = this._clickAddLayer
        } else if (options.type === 'RELOAD') {
            this._click = this._clickReload
        } else {
            this._click = this._clickReload
        }

        this._updateLayerButton = this._createButton(BUTTON_TYPES[options.type].html, tooltipText,
                "leaflet-control-update-layer-icon", container, this._click)

        L.DomUtil.addClass(this._updateLayerButton, options.type)

        if (options.type === 'ADD_LAYER' && L_.addLayerQueue && L_.addLayerQueue.length > 0) {
            // The icon shows the correct number of new layers waiting to be added
            var number = L.DomUtil.create('span', 'update-layer-icon-text', this._updateLayerButton)
            number.innerHTML = L_.addLayerQueue.length
            if (L_.addLayerQueue.length > 9) {
                number.innerHTML = '+'
                L.DomUtil.addClass(number, 'plus')
            }
        }

        L.DomEvent.on(this._updateLayerButton, 'mouseover', function(e) {
            const bounds = $(e.target)[0].getBoundingClientRect();
            CursorInfo.update(BUTTON_TYPES[options.type].title,
                null,
                false,
                { x: bounds.x - bounds.width * 6, y: bounds.y - bounds.height }
            )
        });

        L.DomEvent.on(this._updateLayerButton, 'mouseout', function(e) {
            CursorInfo.hide()
        });

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
        link.title = title

        link.setAttribute('role', 'button')
        link.setAttribute('aria-label', title)

        L.DomEvent.disableClickPropagation(link)
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
        L.DomEvent.on(link, 'click', fn, this)

        return link
    },
    _clickAddLayer: function(e) {
        this._showModal()
    },
    _clickReload: function(e) {
        location.reload();
    },
    _showModal: function() {
        let table = [
            `<table class="table" style="text-align: left;">`,
                `<tr style="font-width: bold">`,
                    `<th style="column-width: 100px">Type</th>`,
                    `<th>Layer name</th>`,
                `</tr>`,
        ];

        for (let i in L_.addLayerQueue) {
            const { data, newLayerName, type } = L_.addLayerQueue[i]
            table = table.concat([
                `<tr>`,
                    `<td style="column-width: 100px">${type}</td>`,
                    `<td>${newLayerName}</td>`,
                `</tr>`,
            ]);
        }
        table.push(`</table>`);

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
                    Modal.remove();

                    L_.updateQueueLayers();

                    // Destroy self
                    L_.UserInterface_.removeLayerUpdateButton();
                });

                // Cancel
                $('.drawToolFileCancel').on('click', function () {
                    Modal.remove();
                });

                // Close
                $('#mainSettingsModalClose').on('click', function () {
                    Modal.remove();
                });
            },
            function () {}
        )
    },
});

export default LayerUpdatedControl
