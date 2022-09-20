import $ from 'jquery'
import * as d3 from 'd3'

import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_.js'

import './LayerUpdatedControl.css'

const BUTTON_TYPES = {
    RELOAD: {
        html: '<i class="mdi mdi-reload-alert mdi-18p"></i>',
        title: 'Reload the entire MMGIS page',
    },
    ADD_LAYER: {
        html: '<i class="mdi mdi-reload mdi-18p"></i>',
        title: 'Add new layer named: ',
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

        this._click = options.type === 'ADD_LAYER' ? this._clickAddLayer : this._clickReload

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
        const firstLayer = L_.addLayerQueue.shift()
        const { data, newLayerName } = firstLayer

        // If the user rearranged the layers with the LayersTool, reset the ordering history
        if (ToolController_.toolModules['LayersTool']
                && ToolController_.toolModules['LayersTool'].orderingHistory.length > 0) {
            ToolController_.toolModules['LayersTool'].orderingHistory = []
        }

        L_.addNewLayer(data, newLayerName)

        setTimeout(() => {
            if (L_.addLayerQueue && L_.addLayerQueue.length > 0) {
                L_.UserInterface_.updateLayerUpdateButton('ADD_LAYER')
            } else {
                // Destroy self
                this.remove(L_.Map_.map)
            }
        }, 0)
    },
    _clickReload: function(e) {
        location.reload();
    },
});

export default LayerUpdatedControl
